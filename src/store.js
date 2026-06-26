'use strict';

// Persists per-item triage state (done / snoozed) across polls and restarts,
// under HERDR_PLUGIN_STATE_DIR so it survives reopening the pane.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function stateFile() {
  const dir = process.env.HERDR_PLUGIN_STATE_DIR || path.join(os.tmpdir(), 'herdr-attention');
  return path.join(dir, 'state.json');
}

function load() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8');
    const data = JSON.parse(raw);
    return { done: data.done || {}, snoozed: data.snoozed || {} };
  } catch {
    return { done: {}, snoozed: {} };
  }
}

function save(state) {
  try {
    const f = stateFile();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ done: state.done || {}, snoozed: state.snoozed || {} }));
    return true;
  } catch {
    return false;
  }
}

module.exports = { load, save, stateFile };
