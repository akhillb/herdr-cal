'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { render, fmtCount } = require('../src/render');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

const view = (over = {}) => ({
  clock: '12:00:00', counts: { now: 0, soon: 0, later: 0 },
  groups: [], watching: [], sources: [{ tag: 'MTG', colorRole: 'mtg' }],
  showAdd: false, addList: [], toast: null, sourceErr: null, staleMs: 0,
  loading: false, width: 46, ...over,
});

const mtg = (id, tier, countMs) => ({
  id, tag: 'MTG', colorRole: 'mtg', title: id, sub: '12:00', tier, countMs,
  actions: ['open', 'snooze', 'done'], context: [], openLabel: 'join',
});

test('renders the ATTENTION header and summary counts', () => {
  const out = strip(render(view({ counts: { now: 2, soon: 1, later: 3 } })));
  assert.match(out, /ATTENTION/);
  assert.match(out, /2 now/);
  assert.match(out, /1 soon/);
  assert.match(out, /3 watching/);
});

test('renders a NOW group with the item', () => {
  const out = strip(render(view({
    counts: { now: 1, soon: 0, later: 0 },
    groups: [{ tier: 'now', label: 'NOW', items: [mtg('Standup', 'now', 5 * 60000)] }],
  })));
  assert.match(out, /NOW/);
  assert.match(out, /Standup/);
});

test('empty feed says nothing needs you', () => {
  assert.match(strip(render(view())), /Nothing needs you/);
});

test('loading state shows Loading', () => {
  assert.match(strip(render(view({ loading: true }))), /Loading/);
});

test('hard source error shows setup hint', () => {
  const out = strip(render(view({ sourceErr: 'gcalcli not installed' })));
  assert.match(out, /gcalcli not installed/);
  assert.match(out, /pipx install gcalcli/);
});

test('WATCHING list is rendered', () => {
  const out = strip(render(view({
    counts: { now: 0, soon: 0, later: 1 },
    watching: [mtg('Later thing', 'later', 200 * 60000)],
  })));
  assert.match(out, /WATCHING/);
  assert.match(out, /Later thing/);
});

test('add-source overlay lists roadmap', () => {
  const out = strip(render(view({ showAdd: true, addList: [{ name: 'Slack', note: 'DMs', colorRole: 'slack' }] })));
  assert.match(out, /ADD A SOURCE/);
  assert.match(out, /Slack/);
});

test('fmtCount formats now / m:ss / m / h', () => {
  assert.equal(fmtCount(0), 'now');
  assert.equal(fmtCount(90 * 1000), '1:30');
  assert.equal(fmtCount(20 * 60000), '20m');
  assert.equal(fmtCount(95 * 60000), '1h 35m');
});
