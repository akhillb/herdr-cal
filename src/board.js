#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { execFile } = require('node:child_process');
const { enabledAddons } = require('./addons');
const { buildFeed, focusableIds } = require('./model');
const { render } = require('./render');
const { reportAgent } = require('./herdr');
const store = require('./store');

const cfg = {
  demo: process.env.CAL_DEMO === '1' || process.env.ATTENTION_DEMO === '1' || process.argv.includes('--demo'),
  window: process.env.CAL_WINDOW || 'in 12 hours',
  pollMs: (Number(process.env.ATTENTION_POLL_SEC) || 60) * 1000,
};

const ROADMAP = [
  { name: 'Slack', note: 'unanswered DMs & @-mentions', colorRole: 'slack' },
  { name: 'Email / Gmail', note: 'flagged threads awaiting your reply', colorRole: 'mail' },
  { name: 'GitHub', note: 'review requests & changes requested', colorRole: 'github' },
  { name: 'Jira / Linear', note: 'tickets assigned to you, due soon', colorRole: 'accent' },
  { name: 'PagerDuty', note: "incidents you're on-call for", colorRole: 'urgent' },
  { name: 'CI / Deploys', note: 'your pipeline failed or awaits approval', colorRole: 'github' },
];

const SNOOZE = { 1: ['15m', 15], 2: ['1h', 60], 3: ['3h', 180], 4: ['tomorrow', 1440] };

const addons = enabledAddons();
const caches = {}; // id -> { items, lastOkAt, err }
const addonCfg = {};
let st = store.load();
let loaded = false;
let focusId = null;
let expandedId = null;
let snoozeId = null;
let showAdd = false;
let toast = null;
let toastT = null;
let lastImminent = null;

function termWidth() {
  return Math.max(16, Math.min((process.stdout.columns || 44) - 1, 100));
}

function mergedItems() {
  return Object.values(caches).flatMap((c) => c.items || []);
}

function feedNow() {
  return buildFeed(mergedItems(), Date.now(), st);
}

function showToast(text) {
  toast = { text };
  if (toastT) clearTimeout(toastT);
  toastT = setTimeout(() => { toast = null; draw(); }, 1800);
}

function buildView() {
  const feed = feedNow();
  const ids = focusableIds(feed);
  if (focusId && !ids.includes(focusId)) focusId = ids[0] || null;
  if (!focusId && ids.length) focusId = ids[0];

  const everOk = Object.values(caches).some((c) => c.lastOkAt > 0);
  const errs = Object.values(caches).map((c) => c.err).filter(Boolean);
  const hard = errs.find((e) => /not installed|not configured|not found/i.test(e));
  const anyItems = mergedItems().length > 0;
  const sourceErr = (!anyItems && !everOk && errs.length) ? (hard || errs[0]) : null;
  const lastOk = Math.max(0, ...Object.values(caches).map((c) => c.lastOkAt || 0));
  const staleMs = (!cfg.demo && everOk && Date.now() - lastOk > cfg.pollMs * 2) ? Date.now() - lastOk : 0;

  const c = new Date();
  const clock = [c.getHours(), c.getMinutes(), c.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');

  return {
    clock, counts: feed.counts, groups: feed.groups, watching: feed.watching,
    sources: addons.map((a) => ({ tag: a.meta.tag, colorRole: a.meta.colorRole })),
    showAdd, addList: ROADMAP, toast, sourceErr, staleMs,
    loading: !loaded && !sourceErr, width: termWidth(),
  };
}

function draw() {
  const view = buildView();
  const imminent = view.counts.now > 0;
  if (imminent !== lastImminent) {
    lastImminent = imminent;
    reportAgent(imminent ? 'blocked' : 'idle').catch(() => {});
  }
  process.stdout.write('\x1b[2J\x1b[H' + render(view, {
    focusId, expandedId, snoozeId, width: termWidth(),
  }));
}

async function resolveConfigs() {
  for (const a of addons) {
    if (typeof a.resolveConfig === 'function' && !cfg.demo) {
      try { addonCfg[a.id] = await a.resolveConfig(); } catch { addonCfg[a.id] = {}; }
    }
  }
}

async function poll() {
  for (const a of addons) {
    const c = caches[a.id] || (caches[a.id] = { items: [], lastOkAt: 0, err: null });
    try {
      const res = await a.fetch({ demo: cfg.demo, window: cfg.window, ...(addonCfg[a.id] || {}) });
      if (res.ok) { c.items = res.items || []; c.lastOkAt = Date.now(); c.err = null; loaded = true; }
      else { c.err = res.error || 'fetch failed'; }
    } catch (e) {
      c.err = e.message;
    }
  }
  draw();
}

function scheduleNextPoll() {
  setTimeout(runPoll, cfg.pollMs + Math.floor(Math.random() * 8000));
}
function runPoll() { poll().finally(scheduleNextPoll); }

function focusedItem() {
  return mergedItems().find((it) => it.id === focusId) || null;
}

function openFocused() {
  const it = focusedItem();
  if (!it || !/^https?:\/\//i.test(it.openUrl || '')) { showToast('nothing to open'); return; }
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(cmd, [it.openUrl], () => {});
  showToast('↗ opening…');
}

function applySnooze(key) {
  const opt = SNOOZE[key];
  const it = focusedItem();
  if (!opt || !it) return;
  st.snoozed = st.snoozed || {};
  st.snoozed[it.id] = (st.snoozed[it.id] || 0) + opt[1] * 60000;
  store.save(st);
  snoozeId = null;
  showToast(`⏰ snoozed ${opt[0]}`);
  draw();
}

function markDone() {
  const it = focusedItem();
  if (!it) return;
  st.done = st.done || {};
  st.done[it.id] = true;
  store.save(st);
  snoozeId = null;
  showToast('✓ cleared');
  draw();
}

function move(delta) {
  const ids = focusableIds(feedNow());
  if (!ids.length) return;
  let i = ids.indexOf(focusId);
  if (i < 0) i = 0;
  focusId = ids[Math.min(Math.max(i + delta, 0), ids.length - 1)];
  draw();
}

function setupInput() {
  if (!process.stdin.isTTY) return;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (str, key) => {
    if (!key) return;
    const k = key.name;
    if (k === 'q' || (key.ctrl && k === 'c')) { cleanup(); process.exit(0); }
    else if (snoozeId && SNOOZE[str]) applySnooze(str);
    else if (k === 'escape') { snoozeId = null; showAdd = false; draw(); }
    else if (k === 'j' || k === 'down') move(1);
    else if (k === 'k' || k === 'up') move(-1);
    else if (k === 'return') { expandedId = expandedId === focusId ? null : focusId; draw(); }
    else if (k === 'o') openFocused();
    else if (k === 's') { snoozeId = snoozeId === focusId ? null : focusId; draw(); }
    else if (k === 'x') markDone();
    else if (k === 'a' || str === '+') { showAdd = !showAdd; draw(); }
    else if (k === 'r') poll();
  });
}

function cleanup() {
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false); } catch {} }
  reportAgent('idle').catch(() => {});
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

setupInput();
process.stdout.on('resize', draw);
draw(); // initial loading frame
resolveConfigs().finally(runPoll);
setInterval(draw, 1000);
