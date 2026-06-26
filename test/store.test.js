'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('load returns defaults when no state file exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attn-'));
  process.env.HERDR_PLUGIN_STATE_DIR = dir;
  delete require.cache[require.resolve('../src/store')];
  const store = require('../src/store');
  assert.deepEqual(store.load(), { done: {}, snoozed: {} });
});

test('save then load round-trips done/snoozed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attn-'));
  process.env.HERDR_PLUGIN_STATE_DIR = dir;
  delete require.cache[require.resolve('../src/store')];
  const store = require('../src/store');
  assert.equal(store.save({ done: { a: true }, snoozed: { b: 9000 } }), true);
  assert.deepEqual(store.load(), { done: { a: true }, snoozed: { b: 9000 } });
});

test('load tolerates corrupt JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attn-'));
  process.env.HERDR_PLUGIN_STATE_DIR = dir;
  fs.writeFileSync(path.join(dir, 'state.json'), '{not json');
  delete require.cache[require.resolve('../src/store')];
  const store = require('../src/store');
  assert.deepEqual(store.load(), { done: {}, snoozed: {} });
});
