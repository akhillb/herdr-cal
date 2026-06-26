'use strict';

// Addon registry. To add a source: create ./<name>.js exporting
// { id, meta:{tag,colorRole,label}, fetch({demo,...}) -> {ok,items,error} },
// then add it to ALL below. The board polls every enabled addon and merges
// their items into the unified Attention feed.
const calendar = require('./calendar');

const ALL = [calendar];

function enabledAddons() {
  // Future: filter by config/env (e.g. ATTENTION_SOURCES="cal,slack").
  return ALL;
}

module.exports = { ALL, enabledAddons };
