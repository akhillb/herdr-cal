#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { execFile } = require('node:child_process');
const { fetchEvents } = require('./calendar');
const { nextMeeting } = require('./model');
const { render } = require('./render');
const { reportAgent } = require('./herdr');

const cfg = {
  demo: process.env.CAL_DEMO === '1' || process.argv.includes('--demo'),
  imminentMs: (Number(process.env.CAL_IMMINENT_MIN) || 10) * 60000,
  window: process.env.CAL_WINDOW || 'in 12 hours',
  pollMs: (Number(process.env.CAL_POLL_SEC) || 60) * 1000,
};

let events = [];
let sourceErr = null;
let selected = 0;
let view = null;
let lastImminent = null;

function visibleList() {
  if (!view || !view.next) return [];
  return [view.next, ...(view.upcoming || [])];
}

function recompute() {
  view = nextMeeting(events, Date.now(), { imminentMs: cfg.imminentMs });
  const max = Math.max(0, visibleList().length - 1);
  if (selected > max) selected = max;
}

function termWidth() {
  return Math.max(24, Math.min(process.stdout.columns || 58, 100));
}

function draw() {
  recompute();
  if (view.isImminent !== lastImminent) {
    lastImminent = view.isImminent;
    reportAgent(view.isImminent ? 'blocked' : 'idle').catch(() => {});
  }
  process.stdout.write('\x1b[2J\x1b[H' + render(view, {
    sourceErr, demo: cfg.demo, selected, width: termWidth(),
  }));
}

async function poll() {
  const res = await fetchEvents({ demo: cfg.demo, window: cfg.window });
  sourceErr = res.ok ? null : res.error;
  events = res.events || [];
  draw();
}

function openSelected() {
  const item = visibleList()[selected];
  // Re-check the scheme at the call site (defence in depth): never hand a value
  // that could be read as a flag/arg to open/xdg-open.
  if (!item || !/^https?:\/\//i.test(item.link || '')) return;
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(cmd, [item.link], () => {});
}

function cleanup() {
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch {}
  }
  reportAgent('idle').catch(() => {});
}

function setupInput() {
  if (!process.stdin.isTTY) return;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (_str, key) => {
    if (!key) return;
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) { cleanup(); process.exit(0); }
    else if (key.name === 'r') poll();
    else if (key.name === 'o') openSelected();
    else if (key.name === 'k' || key.name === 'up') { selected = Math.max(0, selected - 1); draw(); }
    else if (key.name === 'j' || key.name === 'down') {
      selected = Math.min(Math.max(0, visibleList().length - 1), selected + 1);
      draw();
    }
  });
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

setupInput();
process.stdout.on('resize', draw);
poll();
setInterval(draw, 1000);
setInterval(poll, cfg.pollMs);
