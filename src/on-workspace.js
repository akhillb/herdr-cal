#!/usr/bin/env node
'use strict';

// Triggered by the `workspace.created` event hook: docks the Attention pane
// on the right of every newly created workspace.
const { execFile } = require('node:child_process');

const bin = process.env.HERDR_BIN_PATH || 'herdr';
const pluginId = process.env.HERDR_PLUGIN_ID || 'attention';

let ctx = {};
try { ctx = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON || '{}'); } catch { ctx = {}; }

// workspace.created delivers the new workspace's root pane as focused_pane_id;
// a split-placement plugin pane must target an existing pane.
const targetPane = ctx.focused_pane_id || ctx.pane_id || null;
if (!targetPane) {
  process.stderr.write('attention: no target pane in workspace.created context\n');
  process.exit(0);
}

const args = [
  'plugin', 'pane', 'open',
  '--plugin', pluginId,
  '--entrypoint', 'feed',
  '--direction', 'right',
  '--target-pane', targetPane,
  '--no-focus',
];
if (process.env.CAL_DEMO === '1' || process.env.ATTENTION_DEMO === '1') args.push('--env', 'CAL_DEMO=1');

execFile(bin, args, (err) => {
  if (err) { process.stderr.write(`attention: failed to open pane: ${err.message}\n`); return; }
  // Narrow toward a dock width by widening the workspace's original pane.
  execFile(bin, ['pane', 'resize', '--pane', targetPane, '--direction', 'right', '--amount', '0.34'], () => {});
});
