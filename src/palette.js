'use strict';

// Theme-aware palette: every role maps to a BASE ANSI-16 color (not truecolor),
// so herdr renders it with the active theme (tokyo-night, etc.). Switching the
// herdr theme recolours the whole pane automatically — we never pin fixed hex.
const sgr = (...codes) => `\x1b[${codes.join(';')}m`;

const RESET = '\x1b[0m';

// Foreground base colors (30-37) and bright variants (90-97).
const FG = {
  red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  gray: 90, brightRed: 91, brightYellow: 93, brightCyan: 96,
};

// Semantic roles → ANSI codes. Source roles intentionally reuse distinct hues so
// sources stay visually separable under any theme.
const ROLE = {
  accent: [FG.cyan],
  urgent: [FG.red],        // NOW tier
  soon: [FG.yellow],       // SOON tier
  later: [FG.gray],        // WATCHING tier
  text: [FG.white],
  // sources
  cal: [FG.cyan],
  mtg: [FG.cyan],
  slack: [FG.magenta],
  github: [FG.green],
  mail: [FG.yellow],
};

function color(role, { bold = false, dim = false, invert = false } = {}) {
  const codes = (ROLE[role] || ROLE.text).slice();
  if (bold) codes.unshift(1);
  if (dim) codes.unshift(2);
  if (invert) codes.unshift(7);
  return sgr(...codes);
}

// Wrap text in a role's color and reset.
function paint(text, role, opts) {
  return `${color(role, opts)}${text}${RESET}`;
}

const tierRole = (tier) => (tier === 'now' ? 'urgent' : tier === 'soon' ? 'soon' : 'later');

module.exports = { sgr, RESET, color, paint, tierRole, ROLE };
