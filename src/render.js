'use strict';

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', inv: '\x1b[7m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m',
};

function pad2(n) { return String(n).padStart(2, '0'); }

function fmtTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '??:??';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtCountdown(ms) {
  if (ms == null) return '';
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return `in ${h}h ${pad2(m % 60)}m`;
}

function truncate(str, n) {
  const s = String(str);
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s;
}

function fmtAgo(ms) {
  const s = Math.floor(ms / 1000);
  return s < 90 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

function footer(width, staleMs) {
  const hints = width < 48
    ? '[o]pen [r]efresh [q]uit'
    : '[o] open  [j/k] select  [r] refresh  [q] quit';
  const lines = [];
  if (staleMs) lines.push(`${C.dim}⟳ stale · last ok ${fmtAgo(staleMs)} ago${C.reset}`);
  lines.push(`${C.gray}${hints}${C.reset}`);
  return lines.join('\n');
}

// Pure: view model (+ render opts) -> ANSI string for the pane.
function render(view, opts = {}) {
  const { sourceErr = null, demo = false, selected = 0, width = 58, staleMs = 0 } = opts;
  const L = [];
  L.push(`${C.bold}${C.cyan} Next Meeting ${C.reset}${demo ? `${C.dim}(demo)${C.reset}` : ''}`);
  L.push(`${C.gray}${'─'.repeat(width)}${C.reset}`);

  if (sourceErr) {
    L.push('', `${C.yellow}⚠ ${sourceErr}${C.reset}`, '');
    if (/not installed|not configured|not found/i.test(sourceErr)) {
      L.push(`${C.dim}Setup:${C.reset}`);
      L.push('  1. pipx install gcalcli');
      L.push('  2. create a Google OAuth client (see README)');
      L.push('  3. gcalcli init');
      L.push(`  Or preview the UI: ${C.bold}CAL_DEMO=1 node src/board.js${C.reset}`);
    }
    L.push('', footer(width, staleMs));
    return L.join('\n');
  }

  if (!view || !view.next) {
    L.push('', `${C.green}No upcoming meetings 🎉${C.reset}`, '', footer(width, staleMs));
    return L.join('\n');
  }

  const n = view.next;
  const cd = fmtCountdown(view.countdownMs);
  L.push('');
  if (view.isImminent) {
    L.push(`${C.red}${C.bold}${C.inv} ⏰ STARTS ${cd.toUpperCase()} ${C.reset}`);
  } else {
    L.push(`${C.green}${C.bold}${cd}${C.reset}`);
  }

  const sel0 = selected === 0;
  L.push(`${sel0 ? C.inv : ''}${C.bold}${truncate(n.title, width - 4)}${C.reset}`);
  const loc = n.location ? `  ·  ${truncate(n.location, 22)}` : '';
  L.push(`${C.dim}${fmtTime(n.start)}–${fmtTime(n.end)}${C.reset}${loc}`);
  if (n.link) L.push(`${C.gray}${truncate(n.link, width)}${C.reset}`);

  if (view.upcoming && view.upcoming.length) {
    L.push('', `${C.dim}Later:${C.reset}`);
    view.upcoming.forEach((e, i) => {
      const sel = selected === i + 1;
      const row = `${fmtTime(e.start)}  ${truncate(e.title, width - 8)}`;
      L.push(sel ? `${C.inv}${row}${C.reset}` : `${C.dim}${row}${C.reset}`);
    });
  }

  L.push('', footer(width, staleMs));
  return L.join('\n');
}

module.exports = { render, fmtCountdown, fmtTime, truncate };
