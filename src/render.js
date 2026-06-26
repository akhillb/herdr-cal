'use strict';

const { paint, color, RESET, tierRole } = require('./palette');

function truncate(str, n) {
  const s = String(str);
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s;
}

function fmtCount(ms) {
  if (ms == null) return '';
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (s >= 600) return `${m}m`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function header(width, clock) {
  const left = `${paint('●', 'urgent')} ${paint('ATTENTION', 'accent', { bold: true })}`;
  const pad = Math.max(1, width - 'ATTENTION'.length - 2 - clock.length);
  return `${left}${' '.repeat(pad)}${paint(clock, 'later')}`;
}

function summary(counts) {
  return [
    paint(String(counts.now), 'urgent', { bold: true }) + paint(' now', 'later'),
    paint(String(counts.soon), 'soon', { bold: true }) + paint(' soon', 'later'),
    paint(String(counts.later), 'later') + paint(' watching', 'later'),
  ].join(paint('  ·  ', 'later'));
}

const ACTION_KEY = { open: 'o', reply: 'r', snooze: 's', done: 'x' };

function actionsLine(item) {
  const labels = {
    open: item.openLabel || 'open', reply: 'reply', snooze: 'snooze', done: 'done',
  };
  return (item.actions || []).map((a) => {
    const k = ACTION_KEY[a] || a[0];
    return `${paint('[', 'later')}${paint(k, 'accent')}${paint(']', 'later')}${paint(labels[a], 'later')}`;
  }).join('  ');
}

function renderItem(L, item, opts, width) {
  const focused = opts.focusId === item.id;
  const expanded = opts.expandedId === item.id;
  const role = tierRole(item.tier);
  const marker = focused ? paint('❯ ', 'accent', { bold: true }) : '  ';
  const dot = paint('●', role);
  const tag = paint(item.tag.padEnd(5).slice(0, 5), item.colorRole, { bold: true });
  const count = item.countMs == null ? '' : paint(fmtCount(item.countMs), role, { bold: true });
  const budget = Math.max(8, width - 2 - 2 - 6 - (count ? count.length : 0));
  const title = focused
    ? paint(truncate(item.title, budget), 'text', { bold: true })
    : paint(truncate(item.title, budget), 'text');
  const head = `${marker}${dot} ${tag} ${title}`;
  // right-align the count
  L.push(`${head}  ${count}`);
  if (item.sub) L.push(`     ${paint(truncate(item.sub, width - 6), 'later')}`);

  if (expanded && item.context && item.context.length) {
    for (const c of item.context) {
      const lbl = c.label ? paint(`${c.label} `, item.colorRole) : '';
      L.push(`     ${lbl}${paint(truncate(c.text, width - 8), 'later')}`);
    }
  }
  if (opts.snoozeId === item.id) {
    const optsRow = ['15m', '1h', '3h', 'tomorrow']
      .map((o) => paint(` ${o} `, 'text', { invert: true })).join(' ');
    L.push(`     ${paint('snooze →', 'later')} ${optsRow}`);
  } else if (focused || expanded) {
    L.push(`     ${actionsLine(item)}`);
  }
}

// Pure: view model -> ANSI string for the pane.
function render(view, opts = {}) {
  const width = opts.width || view.width || 46;
  const L = [];
  L.push(header(width, view.clock || ''));
  L.push(paint('─'.repeat(width), 'later'));

  if (view.sourceErr) {
    L.push('', paint(`⚠ ${view.sourceErr}`, 'soon'), '');
    if (/not installed|not configured|not found/i.test(view.sourceErr)) {
      L.push(paint('Setup:', 'later'));
      L.push('  1. pipx install gcalcli');
      L.push('  2. create a Google OAuth client (see README)');
      L.push('  3. gcalcli init');
    }
    L.push('', footer(view, width));
    return L.join('\n');
  }

  L.push(summary(view.counts));

  if (view.showAdd) {
    L.push('', paint('ADD A SOURCE', 'accent', { bold: true }) + paint('   [esc]', 'later'));
    L.push(paint('plugins on the roadmap — each becomes a source', 'later'));
    for (const f of view.addList || []) {
      L.push(`${paint('▪', f.colorRole || 'later')} ${paint(f.name, 'text')}`);
      if (f.note) L.push(`  ${paint(truncate(f.note, width - 2), 'later')}`);
    }
    L.push('', footer(view, width));
    return L.join('\n');
  }

  const empty = view.counts.now + view.counts.soon + view.counts.later === 0;
  if (empty) {
    L.push('', paint(view.loading ? 'Loading…' : 'Nothing needs you right now 🎉', view.loading ? 'later' : 'github'));
  }

  for (const g of view.groups) {
    L.push('', paint(g.label, tierRole(g.tier), { bold: true }));
    for (const item of g.items) renderItem(L, item, opts, width);
  }

  if (view.watching && view.watching.length) {
    L.push('', paint('WATCHING', 'later', { bold: true }));
    for (const item of view.watching) {
      const tag = paint(item.tag.padEnd(5).slice(0, 5), item.colorRole);
      const cnt = item.countMs == null ? '' : paint(fmtCount(item.countMs), 'later');
      L.push(`  ${tag} ${paint(truncate(item.title, width - 14), 'later')}  ${cnt}`);
    }
  }

  if (view.staleMs) L.push('', paint(`⟳ stale · last ok ${Math.floor(view.staleMs / 1000)}s ago`, 'later'));
  if (view.toast) L.push('', paint(view.toast.text, 'text', { invert: true }));
  L.push('', footer(view, width));
  return L.join('\n');
}

function footer(view, width) {
  const a = (k) => paint(k, 'accent');
  const keys = width < 44
    ? `${a('j/k')} ${a('↵')} ${a('o')} ${a('s')} ${a('x')}`
    : `${a('j/k')} move · ${a('↵')} expand · ${a('o')} open · ${a('s')} snooze · ${a('x')} done`;
  const legend = (view.sources || [])
    .map((s) => `${paint('●', s.colorRole)} ${paint(s.tag.toLowerCase(), 'later')}`).join('  ');
  const add = paint('[+] add', 'later');
  return [paint(keys, 'later'), `${legend}   ${add}`].join('\n');
}

module.exports = { render, fmtCount, truncate };
