'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { render, fmtCountdown } = require('../src/render');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

test('renders a message when there is no upcoming meeting', () => {
  const out = strip(render({ next: null, upcoming: [], countdownMs: null, isImminent: false }));
  assert.match(out, /No upcoming meetings/);
});

test('shows the imminent banner when isImminent', () => {
  const now = Date.now();
  const view = {
    next: { title: 'Standup', start: new Date(now + 8 * 60000), end: new Date(now + 38 * 60000), link: '', location: 'Zoom' },
    upcoming: [],
    countdownMs: 8 * 60000,
    isImminent: true,
  };
  const out = strip(render(view));
  assert.match(out, /STARTS IN 8M/);
  assert.match(out, /Standup/);
});

test('shows setup hint when gcalcli is missing', () => {
  const out = strip(render(null, { sourceErr: 'gcalcli not installed' }));
  assert.match(out, /gcalcli not installed/);
  assert.match(out, /pipx install gcalcli/);
});

test('truncates an over-long title', () => {
  const now = Date.now();
  const longTitle = 'X'.repeat(200);
  const view = {
    next: { title: longTitle, start: new Date(now + 60 * 60000), end: new Date(now + 90 * 60000), link: '', location: '' },
    upcoming: [],
    countdownMs: 60 * 60000,
    isImminent: false,
  };
  const out = strip(render(view, { width: 40 }));
  assert.ok(!out.includes(longTitle), 'full title should not appear');
  assert.match(out, /…/);
});

test('shows a stale marker (still rendering the meeting) when staleMs is set', () => {
  const now = Date.now();
  const view = {
    next: { title: 'Standup', start: new Date(now + 30 * 60000), end: new Date(now + 60 * 60000), link: '', location: '' },
    upcoming: [],
    countdownMs: 30 * 60000,
    isImminent: false,
  };
  const out = strip(render(view, { staleMs: 3 * 60000 }));
  assert.match(out, /stale/);
  assert.match(out, /Standup/); // last-good meeting still shown
});

test('no stale marker when staleMs is 0', () => {
  const out = strip(render({ next: null, upcoming: [], countdownMs: null, isImminent: false }, { staleMs: 0 }));
  assert.doesNotMatch(out, /stale/);
});

test('fmtCountdown formats seconds, minutes and hours', () => {
  assert.equal(fmtCountdown(30 * 1000), 'in 30s');
  assert.equal(fmtCountdown(23 * 60000), 'in 23m');
  assert.equal(fmtCountdown(65 * 60000), 'in 1h 05m');
  assert.equal(fmtCountdown(0), 'now');
  assert.equal(fmtCountdown(null), '');
});
