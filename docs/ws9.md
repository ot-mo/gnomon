# WS9: persistence and shell

TECH_DESIGN §8.3 "WS9" (with DECISIONS: the run modes are `oneWick`, `commonsLamp` and `pilgrim`). Branch `ws/ws9`,
worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws9`, from `p0-done`. Files (§8.4): `save/*`, `hud.js`, `config.js`,
`screens/title log options dead pause`, `tools/check-save.mjs`, `tests/checks/save.js`. Gate numbers:
`docs/sessions/ws9.md`.

## Public API

```js
// save/index.js (re-exports save.js, store.js and codec.js)
saveGame(game, { reason = "manual", store, slotId, clean = false }) → Promise<{ id, updated, zones, reason }>
//   no store: the run's own (its slot's store), else currentStore(), else a memory store of save.js's own.
//   clean: a session ending here (save and quit): the slot's live cleared
loadGame(slotId, { game, store, version = VERSION.save, migrations = MIGRATIONS }) → Promise<game>
//   migrates the slot and each zone record as it is read; the world by state.world.id (registerWorld); an unclean
//   exit counted (error.code "unclean" when One Wick's rule makes it a death)
listSlots({ store }) → [{ id, created, updated, seed, mode, character, where, time, unclean, live, checkpoint, genVersion, version }]
deleteSlot(id, { store }) → bool · checkpoint(game) → Promise<{ id, n } | null>
endRun(game, { cause }) → Promise          // a death: One Wick buries the slot; a checkpoint mode restores it
wakeAtCheckpoint(game) → Promise<game> · restoreCheckpoint(slotId, { store }) → SlotRecord | null
unloadSave(game) → Promise | null · pageShown(game) · listenPage(doc, win, game)   // (save/index.js listens in a browser)
exportSlot(id, { store }) → SaveFile · importSlot(file | text, { store }) → id · moveSlot(game, store) → bool
graveyard({ store }) → [{ name, seed, mode, level, cause, where, time, unclean, at }]
migrate(slot, zones, { to, migrations }) → { slot, zones } · MIGRATIONS = { [n]: { slot(rec), zone(rec) } }
registerWorld(id, def | () => def) · requestSave(game, reason, { delay, checkpoint }) · modeOf(game) → mode
canSave(game) · whenWritten(game) · saveStatus(game) → { slotId, committed, pending, failed, cp, live, unclean, dead, last }
SAVE_RULES = { auto, afterChange: 0.5, every: 120, travelEvery: 10, oneWick: { unclean: "warn" | "death" }, graveyard: 50 }
RUN_MODES = { oneWick, commonsLamp, pilgrim: { name, note, death: "end" | "checkpoint" } } · SESSION · SAVE_STATS
// save/store.js
STORES = { slots: "id", zones: ["slot","key"], checkpointZones: ["slot","key"], meta: "id" }
Adapter = { kind, get, put, del, list(store, { slot }), tx(fn), writeNow(ops) }   // ops: put, del, clear (a slot's rows), keep (copy on write)
memoryAdapter({ latency, from }) · idbAdapter(name, { indexedDB }) & { ready, close() } · openSaves() → { store, persistent, reason }
storageLeft() → bytes | null · useStore(adapter) · currentStore()
// save/codec.js (additions)
snapshotZone(zone, { slot, savedAt, cp })   // records carry cp (the checkpoint they were written under) and v (VERSION.save)
finishZoneNow(snap) → ZoneRecord            // uncompressed, at once (the unload save)
snapshotSlot(game, { id, created, updated, zones, live, unclean, checkpoint })
// screens
title.js:   openTitle(game) → Promise · titleItems() · newGame(game, { seed, mode }) · titleState() · importText(game, text)
options.js: MODE "options" · openOptions(game, { from }) · optionItems(game) · settings() · loadSettings(game, store) · saveSettings(game) · BASE_SENSITIVITY
log.js:     MODE "log" · openLog(game) · logHistory(game) · LOG_LINES = 500     (H in both views)
dead.js:    recapOf(game) · RECAP_AFTER = 1                                  (C wakes, R a new run in the same mode, T the title)
pause.js:   HINT_AFTER = 0.75                                                 (Esc on the card: the options)
// hud.js
HOTBAR_NEAR = 10 · segment "hotbar" (priority 70) · segment "debug" (?debug=1 only) · drawPause() → the card's box { x0, y0, w, h }
```

What a workstream needs to know:

- **Saving is automatic** once a store is in use (the browser) or the run has a slot: half a second after every
  completed zone change, every 120 s of play in explore and map, every 10 real seconds in mode `"world"`, when the page
  is hidden or closed, and back on the page. A save waits for a screen registered `saveable: true` (explore, map; the
  world map's must say so too).
- **A settlement** is a surface span whose site has `checkpoint: true` (landmarks that say so, every village:
  `world/sites.js`). Under the Commons Lamp and Pilgrim, entering or leaving one makes a checkpoint, and so does the
  run's first save.
- **New runs** get their mode from whoever starts them: `title.js newGame(game, { seed, mode })` (startRun, then
  `state.mode`). The title pushes `"create"` with `{ seed, mode }` once WS4 registers it.
- **The browser half** of the gate: `NODE_PATH="$(npm root -g)" node tools/check-save.mjs --browser` (not in run-all).

## Integration requests

Changes to files that aren't WS9's, for the integrator (or their owners). WS9 works without them; each says what
changes when it lands.

1. **`main.js`** (P0): `useStore(memoryAdapter())` keeps a `?quick=1` game's saves in memory; the title opens
   IndexedDB (`openSaves`) and moves a game kept in memory into it. Replace the line with `openSaves()` (it falls back
   to memory by itself) so quick games persist too, or keep it for the tools and say so in `tools/README.md`.
2. **`game.js` `startRun(seed, world, { mode })`**: set `state.mode` there (today `title.js newGame` sets it right
   after `startRun`, before the run's first save; `game.newRun()` on R gets it from `dead.js`).
3. **`game.js` `hurtPlayer`**: emit `"player:hurt"` `{ dmg, source, quiet }` (taken, before death). `dead.js` counts the
   recap's damage by source by wrapping `game.hurtPlayer` at the first `zone:enter`; with the event it listens instead.
4. **`game.js` `game.log`**: keep `LOG_LINES` (500) or emit `"log"`. `screens/log.js` collects the history from
   `game.messages` every frame, so more than 40 messages within one frame would be missed.
5. **`screens/play.js`: Esc on the map.** §4.2 opens `pause`/`options` with Esc on the map; P0 binds it to "to 3D" (the
   parent's), so on the map the options (and save and quit) are reachable only through the title. Bind a map key to
   `options.js openOptions(game, { from: "map" })`, or move Esc there and turning to another key.
6. **`rules.js`**: `RULES.oneWick = { unclean: "warn" }` (DECISIONS: `RULES.classic.*` became `RULES.oneWick.*`);
   `save.js SAVE_RULES.oneWick` holds it until then.
7. **`tests/checks/config.js`** (P0): (a) it allows `localStorage` only in `audio.js`, so WS9 keeps the graveyard (§7.5:
   `storageKey("graveyard")`) and the view settings in the save store's `meta` records instead. To move them to
   localStorage, give `audio.js` (or `config.js`) a value helper and widen the rule. (b) It pins
   `VERSION = { save: 1, … }`: the first bump of `VERSION.save` needs it changed, with `MIGRATIONS[1]` in `save.js`.
8. **WS1**: register `"world"` with `saveable: true` (the travel saves and any save asked for there wait for it).
9. **WS4**: Pilgrim's XP (kills 0, every other source ×2.2: bible §10.1) belongs to the progression; `save.js modeOf(game)`
   says the run's mode. The create screen ends by starting the run with its mode (`newGame` or request 2). The HUD's
   `"hotbar"` segment shows `p.hotbar`'s ready abilities by `ABILITIES[id].name` while something hunts you.
10. **`tools/README.md`** (frozen): `check-save.mjs`'s new options (`--browser [--port]`, `--v1-from <ref> | none`) and
    what the browser half proves.

## Handoff

- **State:** see `docs/sessions/ws9.md` for what was built, the gate numbers, the deviations and the verification.
- **Next step:** written at the end of the session (below).
