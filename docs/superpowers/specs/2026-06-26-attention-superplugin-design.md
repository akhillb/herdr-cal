# herdr-attention — Attention super-plugin

**Date:** 2026-06-26
**Status:** Implemented (framework + calendar source)

## Goal

Evolve the single-purpose `herdr-cal` "next meeting" plugin into a unified
**Attention feed**: one pane that merges items from pluggable **sources** into
**NOW / SOON / WATCHING** urgency tiers with live countdowns and triage actions.
Modelled on the user's own design ("Attention Pane", claude.ai/design project
`27e822c8-…`).

## Design carried over from the mockup

- Header `● ATTENTION  hh:mm:ss`; summary `N now · N soon · N watching`.
- Cards: source tag + title + countdown; expand for context lines; actions
  `[o]pen [s]nooze [x]done`; keyboard `j/k/↵/o/s/x`; snooze submenu.
- Footer: key hints + source legend + `[+] add source` (roadmap overlay).
- The HTML mockup is adapted to a **terminal ANSI TUI** — same information
  architecture, interaction model, and color language; no web chrome.

## Theme-aware color (explicit requirement)

Colors are **base ANSI-16 codes**, never truecolor hex, so herdr renders them
with the active theme and the pane recolors when the theme changes. Roles →
ANSI: NOW=red, SOON=yellow, WATCHING=bright-black, accent/mtg=cyan,
slack=magenta, github=green, mail=yellow (`src/palette.js`).

## Architecture

| File | Responsibility |
|------|----------------|
| `src/board.js` | orchestrator: poll addons, merge, tier, keys, snooze/done, agent-status |
| `src/model.js` | pure: `buildFeed(items, now, store)` → tiers + counts; `focusableIds` |
| `src/render.js` | pure: view model → themed ANSI feed |
| `src/palette.js` | pure: semantic role → ANSI-16 SGR |
| `src/store.js` | persist done/snoozed under `HERDR_PLUGIN_STATE_DIR` |
| `src/addons/index.js` | registry — add a source by listing its module |
| `src/addons/calendar.js` | first real source (gcalcli → meeting items) |
| `src/herdr.js` | `reportAgent` over the socket |
| `src/on-workspace.js` | `workspace.created` hook → auto-dock right |

**Addon contract:** `{ id, meta:{tag,colorRole,label}, fetch({demo,…}) →
{ok, items, error} }`. Item: `{id, source, tag, colorRole, title, sub,
deadline, openUrl, openLabel, actions[], context[]}`. `deadline` drives the
tier; `null` → WATCHING. Stable `id` (calendar uses the event `eid`) lets
done/snooze persist across polls.

**Resilience (preserved from herdr-cal):** 45s gcalcli timeout, keep last-good
items per addon on transient failure with a `⟳ stale` marker, jittered polling,
own-calendars-only filter, graceful "not installed" setup hint.

## Scope of this pass

Framework + the **calendar** source (real). Slack / email / GitHub appear in the
add-source roadmap overlay and are the next addons to implement.

## Testing

25 `node:test` cases: `model` (tiering, done filter, snooze, focus order, empty),
`calendar` (parse/empty/malformed, owned-calendar parse, safeLink, item mapping,
stable id, demo, missing gcalcli), `render` (header/summary, NOW group, empty,
loading, setup hint, watching, add-source, count formatting), `store`
(defaults, round-trip, corrupt JSON).
