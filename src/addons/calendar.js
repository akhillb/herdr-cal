'use strict';

// Calendar source addon: turns upcoming gcalcli meetings into Attention items.
const { execFile } = require('node:child_process');

const COLUMNS = [
  'start_date', 'start_time', 'end_date', 'end_time',
  'html_link', 'hangout_link', 'conf_type', 'conf_uri',
  'title', 'location',
];

function toDate(date, time) {
  if (!date || !time) return new Date(NaN);
  return new Date(`${date}T${time}`);
}

// Only http(s) links survive — stops a calendar value from being read as a flag
// when handed to open/xdg-open.
function safeLink(url) {
  return /^https?:\/\//i.test(url) ? url : '';
}

function parseTsv(text) {
  const events = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const row = {};
    COLUMNS.forEach((c, i) => { row[c] = (cols[i] || '').trim(); });
    const start = toDate(row.start_date, row.start_time);
    if (Number.isNaN(start.getTime())) continue; // all-day / unparseable
    events.push({
      title: row.title || '(no title)',
      start,
      end: toDate(row.end_date, row.end_time),
      openUrl: safeLink(row.conf_uri || row.hangout_link || row.html_link || ''),
      htmlLink: safeLink(row.html_link || ''),
      location: row.location || '',
    });
  }
  return events.sort((a, b) => a.start - b.start);
}

function parseCalendarList(text) {
  const owned = [];
  for (const line of String(text).split('\n')) {
    const m = line.match(/^\s*(owner|reader|writer|freebusy)\s+(.+?)\s*$/);
    if (m && m[1] === 'owner') owned.push(m[2]);
  }
  return owned;
}

function detectOwnedCalendars({ gcalcli = 'gcalcli' } = {}) {
  return new Promise((resolve) => {
    execFile(gcalcli, ['--nocolor', 'list'], { timeout: 30000 }, (err, stdout) => {
      resolve(err ? [] : parseCalendarList(stdout));
    });
  });
}

function fetchEvents({ window = 'in 12 hours', gcalcli = 'gcalcli', calendars = [] } = {}) {
  return new Promise((resolve) => {
    const args = [
      '--nocolor', 'agenda', 'now', window, '--tsv',
      '--details', 'url', '--details', 'conference', '--details', 'location',
    ];
    for (const c of calendars) args.push('--calendar', c);
    execFile(gcalcli, args, { timeout: 45000 }, (err, stdout, stderr) => {
      if (err) {
        const raw = String(stderr || err.message || err);
        let error;
        if (err.killed || err.signal) error = 'gcalcli timed out';
        else if (/ENOENT|not found/i.test(raw)) error = 'gcalcli not installed';
        else error = raw.trim();
        resolve({ ok: false, events: [], error });
        return;
      }
      resolve({ ok: true, events: parseTsv(stdout) });
    });
  });
}

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '??:??';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function idFor(e) {
  const m = e.htmlLink && e.htmlLink.match(/[?&]eid=([^&]+)/);
  if (m) return `cal:${m[1]}`;
  return `cal:${e.title}:${e.start.toISOString()}`;
}

// Map a parsed event to the generic Attention item shape.
function toItem(e) {
  const ctx = [];
  if (e.location) ctx.push({ label: 'where', text: e.location });
  if (e.openUrl) ctx.push({ label: 'link', text: e.openUrl });
  const where = e.location ? `  ·  ${e.location}` : '';
  return {
    id: idFor(e),
    source: 'cal',
    tag: 'MTG',
    colorRole: 'mtg',
    title: e.title,
    sub: `${fmtTime(e.start)}–${fmtTime(e.end)}${where}`,
    deadline: e.start.getTime(),
    openUrl: e.openUrl,
    openLabel: 'join',
    actions: ['open', 'snooze', 'done'],
    context: ctx,
  };
}

function demoItems(now = Date.now()) {
  const mk = (mins, title, location, link) => toItem({
    title, location, openUrl: link, htmlLink: '',
    start: new Date(now + mins * 60000),
    end: new Date(now + (mins + 30) * 60000),
  });
  return [
    mk(8, 'Support <> AI Productivity', 'Zoom', 'https://browserstack.zoom.us/j/978885'),
    mk(47, 'Monthly Syncup', 'Google Meet', 'https://meet.google.com/abc-defg-hij'),
    mk(133, 'AllyEngine Intra call', 'Conf Room 4', ''),
  ];
}

module.exports = {
  id: 'cal',
  meta: { tag: 'MTG', colorRole: 'mtg', label: 'Meetings' },

  // Resolve which calendars to query (owned by default; CAL_CALENDARS overrides).
  async resolveConfig() {
    const env = process.env.CAL_CALENDARS;
    if (env && env.trim()) {
      return { calendars: env.split(',').map((s) => s.trim()).filter(Boolean) };
    }
    return { calendars: await detectOwnedCalendars({}) };
  },

  // Returns { ok, items, error }. Never rejects.
  async fetch({ demo = false, window = 'in 12 hours', calendars = [] } = {}) {
    if (demo) return { ok: true, items: demoItems() };
    const res = await fetchEvents({ window, calendars });
    if (!res.ok) return { ok: false, items: [], error: res.error };
    return { ok: true, items: res.events.map(toItem) };
  },

  // Exposed for tests.
  parseTsv, parseCalendarList, detectOwnedCalendars, fetchEvents,
  safeLink, toItem, demoItems, idFor, COLUMNS,
};
