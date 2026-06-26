'use strict';

const NOW_MS = 10 * 60 * 1000;   // ≤10m → NOW
const SOON_MS = 90 * 60 * 1000;  // ≤90m → SOON

function tierOf(msUntil, { nowMs = NOW_MS, soonMs = SOON_MS } = {}) {
  if (msUntil <= nowMs) return 'now';
  if (msUntil <= soonMs) return 'soon';
  return 'later';
}

// Effective deadline after applying any snooze offset for the item.
function effectiveDeadline(item, store) {
  const snooze = (store && store.snoozed && store.snoozed[item.id]) || 0;
  return (item.deadline || 0) + snooze;
}

// Pure: merge addon items into the tiered Attention feed.
// `items`: normalized items from all addons. `now`: epoch ms. `store`: {done,snoozed}.
function buildFeed(items, now, store = { done: {}, snoozed: {} }, tiers = {}) {
  const live = (items || [])
    .filter((it) => it && it.id && !(store.done && store.done[it.id]))
    .map((it) => ({ it, dl: effectiveDeadline(it, store) }))
    .sort((a, b) => a.dl - b.dl);

  const nowItems = [];
  const soonItems = [];
  const watching = [];
  for (const { it, dl } of live) {
    const tier = it.deadline == null ? 'later' : tierOf(dl - now, tiers);
    const entry = { ...it, tier, countMs: it.deadline == null ? null : dl - now };
    if (tier === 'now') nowItems.push(entry);
    else if (tier === 'soon') soonItems.push(entry);
    else watching.push(entry);
  }

  return {
    groups: [
      { tier: 'now', label: 'NOW', items: nowItems },
      { tier: 'soon', label: 'SOON', items: soonItems },
    ].filter((g) => g.items.length),
    watching,
    counts: { now: nowItems.length, soon: soonItems.length, later: watching.length },
  };
}

// Flat list of focusable (non-watching) item ids, in display order.
function focusableIds(feed) {
  return feed.groups.flatMap((g) => g.items.map((i) => i.id));
}

module.exports = { buildFeed, tierOf, focusableIds, effectiveDeadline, NOW_MS, SOON_MS };
