'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildFeed, tierOf, focusableIds, NOW_MS, SOON_MS } = require('../src/model');

const item = (id, offMin, extra = {}) => ({
  id, title: id, sub: '', deadline: Date.now() + offMin * 60000,
  actions: ['open'], context: [], tag: 'MTG', colorRole: 'mtg', ...extra,
});

test('tierOf classifies now / soon / later', () => {
  assert.equal(tierOf(5 * 60000), 'now');
  assert.equal(tierOf(NOW_MS), 'now');
  assert.equal(tierOf(NOW_MS + 1), 'soon');
  assert.equal(tierOf(SOON_MS), 'soon');
  assert.equal(tierOf(SOON_MS + 1), 'later');
});

test('buildFeed groups and sorts by deadline', () => {
  const now = Date.now();
  const feed = buildFeed([item('c', 120), item('a', 5), item('b', 40)], now);
  assert.deepEqual(feed.counts, { now: 1, soon: 1, later: 1 });
  assert.equal(feed.groups[0].label, 'NOW');
  assert.equal(feed.groups[0].items[0].id, 'a');
  assert.equal(feed.watching[0].id, 'c');
});

test('empty items -> empty feed', () => {
  const feed = buildFeed([], Date.now());
  assert.deepEqual(feed.counts, { now: 0, soon: 0, later: 0 });
  assert.equal(feed.groups.length, 0);
});

test('done items are filtered out', () => {
  const feed = buildFeed([item('a', 5), item('b', 5)], Date.now(), { done: { a: true }, snoozed: {} });
  assert.equal(feed.counts.now, 1);
  assert.equal(feed.groups[0].items[0].id, 'b');
});

test('snooze pushes an item down a tier', () => {
  const now = Date.now();
  const base = buildFeed([item('a', 5)], now);
  assert.equal(base.counts.now, 1);
  const snoozed = buildFeed([item('a', 5)], now, { done: {}, snoozed: { a: 60 * 60000 } });
  assert.equal(snoozed.counts.now, 0);
  assert.equal(snoozed.counts.soon, 1);
});

test('a custom soon threshold widens/narrows the SOON tier', () => {
  const now = Date.now();
  const items = [item('a', 5), item('b', 120)]; // 120m out is "later" by default
  assert.equal(buildFeed(items, now).counts.later, 1);
  // widen SOON to 180m → the 120m item becomes SOON
  const wide = buildFeed(items, now, { done: {}, snoozed: {} }, { soonMs: 180 * 60000 });
  assert.equal(wide.counts.soon, 1);
  assert.equal(wide.counts.later, 0);
});

test('a custom now threshold moves items into NOW', () => {
  const now = Date.now();
  const feed = buildFeed([item('a', 20)], now, { done: {}, snoozed: {} }, { nowMs: 30 * 60000, soonMs: 90 * 60000 });
  assert.equal(feed.counts.now, 1);
});

test('focusableIds covers now + soon only, in order', () => {
  const feed = buildFeed([item('a', 5), item('b', 40), item('c', 200)], Date.now());
  assert.deepEqual(focusableIds(feed), ['a', 'b']);
});
