#!/usr/bin/env node
'use strict';

// Printed by the `attention.setup` action (and handy to run directly).
process.stdout.write(`Attention — setup
=================

A unified attention feed for herdr. Sources (addons) merge into NOW / SOON /
WATCHING tiers. The calendar source reads your calendar via gcalcli.

Calendar source:
1. Install gcalcli:        pipx install gcalcli   (or: brew install gcalcli)
2. Create a Google OAuth client (one-time):
     - console.cloud.google.com → new project → enable "Google Calendar API"
     - APIs & Services → Credentials → Create OAuth client ID → Desktop app
     - download the client secret JSON
3. Authenticate:           gcalcli init           (paste client id/secret, sign in)
4. Verify:                 gcalcli agenda

Open the pane:             herdr plugin pane open --plugin attention --entrypoint feed

Preview the UI without any setup:
                           ATTENTION_DEMO=1 node src/board.js

Add a source: drop a module in src/addons/ and register it in src/addons/index.js.
`);
