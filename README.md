# herdr-attention — Attention

A [herdr](https://herdr.dev) plugin: a single **Attention feed** that merges
multiple sources into **NOW / SOON / WATCHING** tiers with live countdowns and
triage actions. Calendar is the first source; more plug in as addons.

```
● ATTENTION                              12:34:56
────────────────────────────────────────────────
2 now  ·  1 soon  ·  3 watching

NOW
❯ ● MTG   Support <> AI Productivity        7:59
     14:14–14:44  ·  Zoom
     where Zoom
     link  https://browserstack.zoom.us/j/978885
     [o]join  [s]snooze  [x]done

SOON
  ● MTG   Monthly Syncup                      46m

WATCHING
  MTG   AllyEngine Intra call               2h 12m

j/k move · ↵ expand · o open · s snooze · x done
● mtg   [+] add source
```

## Theme-aware colors

Colors use **base ANSI-16 codes**, so herdr renders them with your active theme
(tokyo-night, etc.) — change the herdr theme and the pane recolors automatically.
No fixed hex is pinned. Roles: NOW = red, SOON = yellow, WATCHING = bright-black,
accent/meetings = cyan; future sources slack = magenta, github = green, mail = yellow.

## Keys

| Key | Action |
|-----|--------|
| `j` / `k` (or arrows) | move focus through NOW/SOON |
| `↵` | expand / collapse the focused card |
| `o` | open the focused item (meeting link) |
| `s` then `1`–`4` | snooze 15m / 1h / 3h / tomorrow |
| `x` | clear (done) |
| `a` / `+` | add-source overlay (roadmap) |
| `r` | refresh now · `q` quit |

State (done / snoozed) persists in `HERDR_PLUGIN_STATE_DIR`.

## Preview without any setup

```bash
npm run demo          # ATTENTION_DEMO=1 node src/board.js
```

## Calendar source setup (gcalcli)

```bash
pipx install gcalcli            # or: brew install gcalcli
```
1. [console.cloud.google.com](https://console.cloud.google.com) → new project → enable **Google Calendar API**
2. **APIs & Services → Credentials → Create OAuth client ID → Desktop app** → download client secret JSON
3. `gcalcli init` then `gcalcli agenda` to verify

The calendar source restricts to the calendars **you own** by default (excludes
holidays, room/resource, and subscribed calendars); set `CAL_CALENDARS="A,B"` to
choose explicitly.

## Install into herdr

```bash
herdr plugin link /path/to/herdr-attention      # local dev
herdr plugin install akhillb/herdr-attention     # from GitHub
herdr plugin pane open --plugin attention --entrypoint feed
```

The plugin auto-docks on the right of every new workspace via a `workspace.created` hook.

## Adding a source (addon)

Each source is a module in `src/addons/` exporting:

```js
module.exports = {
  id: 'slack',
  meta: { tag: 'SLACK', colorRole: 'slack', label: 'Slack' },
  async fetch({ demo }) {
    return { ok: true, items: [ /* {id,title,sub,deadline,openUrl,context,actions} */ ] };
  },
};
```

Register it in `src/addons/index.js`. The board polls every enabled addon, merges
items, and tiers them by `deadline`. Items with no `deadline` land in WATCHING.

## Configuration

| Var | Default | Meaning |
|-----|---------|---------|
| `ATTENTION_DEMO` / `CAL_DEMO` | unset | `1` → demo data, no gcalcli |
| `ATTENTION_POLL_SEC` | `60` | poll interval (countdowns tick every second) |
| `CAL_WINDOW` | `in 12 hours` | calendar look-ahead window |
| `CAL_CALENDARS` | *(owned calendars)* | comma-separated calendar titles to include |

## Tests

```bash
npm test            # node --test — 25 tests
```

## License

MIT
