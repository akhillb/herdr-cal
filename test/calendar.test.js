'use strict';

const test = require('node:test');
const assert = require('node:assert');
const cal = require('../src/addons/calendar');

const SAMPLE = [
  '2026-06-25\t14:00\t2026-06-25\t14:30\thttps://h/1\t\t\t\tStandup\tZoom',
  '2026-06-25\t09:00\t2026-06-25\t09:15\t\t\t\thttps://meet/abc\t1:1\tMeet',
].join('\n');

test('parseTsv parses and sorts by start', () => {
  const events = cal.parseTsv(SAMPLE);
  assert.equal(events.length, 2);
  assert.equal(events[0].title, '1:1');
  assert.equal(events[0].openUrl, 'https://meet/abc');
});

test('parseTsv: empty / malformed / all-day handling', () => {
  assert.deepEqual(cal.parseTsv(''), []);
  const events = cal.parseTsv('garbage\n2026-06-25\t10:00\t2026-06-25\t10:30\t\t\t\t\tValid\t');
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Valid');
});

test('safeLink rejects non-http and flag-like values', () => {
  assert.equal(cal.safeLink('https://x'), 'https://x');
  assert.equal(cal.safeLink('-e'), '');
  assert.equal(cal.safeLink('file:///etc/passwd'), '');
});

test('parseCalendarList returns only owner calendars', () => {
  const text = '  owner  me@x.com\n reader  Holidays\n writer  Team';
  assert.deepEqual(cal.parseCalendarList(text), ['me@x.com']);
});

test('toItem maps an event to the Attention item shape', () => {
  const start = new Date(Date.now() + 30 * 60000);
  const it = cal.toItem({ title: 'Sync', start, end: new Date(start.getTime() + 30 * 60000), openUrl: 'https://z', htmlLink: '', location: 'Zoom' });
  assert.equal(it.source, 'cal');
  assert.equal(it.tag, 'MTG');
  assert.equal(it.deadline, start.getTime());
  assert.match(it.sub, /Zoom/);
  assert.ok(it.actions.includes('open'));
});

test('idFor is stable via eid when present', () => {
  const a = cal.toItem({ title: 'X', start: new Date(), end: new Date(), openUrl: '', htmlLink: 'https://www.google.com/calendar/event?eid=ABC123', location: '' });
  assert.equal(a.id, 'cal:ABC123');
});

test('fetch demo mode returns future items without gcalcli', async () => {
  const res = await cal.fetch({ demo: true });
  assert.equal(res.ok, true);
  assert.ok(res.items.length >= 1);
  assert.ok(res.items.every((i) => i.deadline > Date.now()));
});

test('fetch reports missing gcalcli gracefully', async () => {
  const res = await cal.fetchEvents({ gcalcli: 'gcalcli-not-installed-xyz' });
  assert.equal(res.ok, false);
  assert.match(res.error, /not installed/i);
});
