# Workstream WS9: persistence and shell

Phase 1 (TECH_DESIGN §8.3 "WS9", with DECISIONS), on branch `ws/ws9` in the worktree `gnomon-wt\ws9`, from `p0-done`.
It ran on the local machine (Windows 11, i7-10750H, Node 20.11.0, headless Chromium from Playwright), with WS3 and WS8
running beside it and the user's training job sharing the CPU at times. The public API and the integration requests
are in `docs/ws9.md`.

| Commits | What |
|---|---|
| `500b1c1` | `save/store.js`: the IndexedDB adapter, `writeNow` (one transaction opened before it returns), memory commits in order; `codec.js`: `cp`, `finishZoneNow`, the slot's `live`/`unclean`/`checkpoint` |
| `fffb2c2` `96363b8` | `save/save.js`: ordered write jobs, automatic saves, the unload save, live and unclean, checkpoints by copy on write, death, export/import/moveSlot, migrations, the world by `state.world.id`; the graveyard and settings in a `meta` store |
| `ad61900` | The shell: title, options, message log, death recap, the pause card's options; the HUD's hotbar and `?debug=1` segments |
| `5a6d069` `e4d7645` | Fixes the new check sections found while being written; `check-save` sections 9-18 |
| `497506f` `d2077b2` `ff95e62` `7e30c80` | The unload save's transaction committed at once (a browser finding); keep only on a key's first write since a checkpoint; the title's warning for a slot another session holds; `check-save --browser` |
| `212f42c` … `14bd5c2` | The verification's fixes (§5), one commit each |
| `e1f2f2f` `cce9477` `11c0ec5` `d9f4675` `8d41280` `8188c0d` | The user's decisions of 2026-10-27: the pause card names L look, V fire, the hotbar and the map legend's comma (on a line of its own under P0's key line); the four "… 3d pause card" frames left out of `check-screen-frames` by name (`// WS9`); integration requests 12 and 13 |

## 1. What was built

| Part | Files |
|---|---|
| IndexedDB (`gnomon-saves` v1: `slots`, `zones`, `checkpointZones`, `meta`), the memory store's commits landing in order, `writeNow` ops (put, del, clear a slot's rows, keep), committed as soon as every request is made; `openSaves`, `storageLeft` | `src/save/store.js` |
| Every write a job of rows snapshotted at once and written in order. With the automatic saves on, the zone you leave is held and written with the next slot record, so the store never holds a zone newer than its slot. The unload save (visibilitychange → hidden, pagehide) writes every job not yet begun, the zones held, the slot (`live` cleared) and the zone you are in, uncompressed, in one transaction | `src/save/save.js` |
| Automatic saves: 0.5 s after each completed zone change, every 120 s of play in explore and map, every 10 real s in mode `world`, back on the page, and 10 s after a failed one; saves are made in the views and under the screens that hold nothing they would lose (the pause card, options, the log, the inventory, `saveThrough`) | `src/save/save.js` |
| `live` and `unclean` (§7.5): a slot holds its session until a clean save; a load counts an unclean exit and writes it back; `SAVE_RULES.oneWick.unclean = "death"` ends that life instead. One page plays a slot where the browser has Web Locks | `src/save/save.js`, `src/screens/title.js` |
| Run modes (DECISIONS): One Wick's death buries the slot (a grave in `meta`); the Commons Lamp and Pilgrim checkpoint on entering or leaving a settlement and at the run's first save, copy on write, and wake there (C); a checkpoint whose save fails is given up | `src/save/save.js`, `src/screens/dead.js` |
| Migrations (§7.6: `MIGRATIONS[n] = { slot, zone }`, each zone record migrated once as it is read; records carry `v`), the world chosen by `state.world.id` (`registerWorld`), export and import (a file checked field by field and read as a load would before it is stored), `moveSlot` | `src/save/save.js`, `src/save/codec.js` |
| A failed write undoes its bookkeeping (its zones stay in memory and are written afresh, its copies on write made again) and is told to the player in the log | `src/save/save.js` |
| The title (New quick game, Continue, Load a save with export and delete, the next game's mode and seed, import, options; warnings, wrapped to the screen), options (music, sounds, field of view, mouse look, keys, save now, save and quit), the message log (H, 500 lines), the death recap, Esc on the pause card | `src/screens/title.js options.js log.js dead.js pause.js` |
| HUD: the hotbar's ready abilities while something hunts you within 10 tiles; `?debug=1`'s line | `src/hud.js` |
| `check-save` sections 9-19 and `--browser` (steps 1-7) | `tests/checks/save.js`, `tools/check-save.mjs` |

## 2. Gate results (§8.3 WS9 acceptance)

`node tools/check-save.mjs` (Node 20.11; 14bd5c2) and `NODE_PATH="$(npm root -g)" node tools/check-save.mjs --browser`
(headless Chromium, through `tools/serve.mjs` on 8649, audio muted). `run-all` and the old browser gates: §6.

| Acceptance item | Result |
|---|---|
| Node round trip after a 30-zone bot session | **Pass**: seed 1234, 30 zones (`0,0,0 0,0,1 0,0,2 1,0,0 … 1,13,0 0,13,0`), map edges 14 and 3D edges 13, stairs map 1 and 3D 2, 759 keys, 1,966 frames, 3,793 s of game time; save → load: `game.state`, the player, the Run data, the ids and all 30 zone records identical as canonical JSON in this process (after another run replaced everything) and in a fresh Node process; `buildRun` 0 times; the id counter above every loaded id. |
| Record sizes (≤ 3 MB projected for 300 zones) | **Pass**: the slot 15,908 B; 30 zone records 1,375-7,248 B, 60,303 B in all (2,010 B a zone): 300 zones projected at **0.59 MB**. The save's synchronous snapshot 4.2-9.8 ms, written in 83-122 ms (memory store, Node, the machine shared). |
| Migration test (v1 → v2 fixture) | **Pass**: the v1 fixture is made by `p0-done`'s own code (`git archive p0-done`; its game, save and codec in a child process: the temple and two levels down): it loads here identical, and through a v1 → v2 migration (the slot, and each of the 3 zone records once, as it is read) comes back identical but for the migration's change. A v1 → v3 chain runs in order; a missing step and a newer save are refused. (`VERSION.save` stays 1: `check-config` pins it; the test reads with `loadGame(id, { version: 2, migrations })`.) |
| A JSON walker finds no Set, Map, function or class in `game.state`, the player or the Run data | **Pass**: R5's walker clean before and after the 30-zone save and load (and in sections 1 and 7 on seeds 1234, 1, 7). |
| A simulated `hidden` event commits the slot and the current zone | **Pass**: a `visibilitychange` with `visibilityState` "hidden" on an `EventTarget` given to `listenPage`: 1 transaction opened in the handler, holding the temple left before it, then the slot with `live` cleared and `0,0,1` uncompressed (`{ raw }`); loaded back identical, 0 unclean; `visible` sets `live` again; `pagehide` clears it. Under the pause card, the options over it, the log and the inventory it commits as in a view; under a screen that holds what comes next (a story page, talk, the "DEPTH n" beat) nothing is written and the last save stands. In Chromium a real reload one step after the last save comes back on that step's tile (browser step 1). |
| A checkpoint restored after 5 zone changes gives back exactly the checkpoint state, and a village visit writes one slot record | **Pass** (the Commons Lamp; the test world's temple is a settlement, `checkpoint: true`): checkpoint 1 at the run's start, 2 on leaving the temple: 1 slot record and 2 zone rows in one transaction (the temple left and level 1, kept as its copies at once). 5 zone changes (hostiles killed, hp lost): rows `0,0,0 0,0,1 0,0,2 0,0,3`, copies `0,0,0 0,0,1`. Death → C, twice: state, player, ids and both zones identical to the checkpoint, `0,0,2` and `0,0,3` gone from the store, 0 unclean after each wake. |
| Browser: save, reload the page, continue on the same tile | **Pass** (IndexedDB): a new game saved itself into IndexedDB (its first save); one map step later the page was reloaded; Continue: `0,0,0` at 24.5,6.5, the step's tile, 0 unclean. |
| Browser: One Wick death deletes the slot | **Pass**: death deleted the slot (0 left) and wrote a grave (cause "a test"); T: the title with no Continue. In Node also: its rows gone, no save after (90 frames), the unload refused. |
| Browser: an unclean exit is counted | **Pass**: the renderer crashed (`Page.crash`: no pagehide); the title warned ("…last session ended without a save (once)."), and Continue counted 1 (the slot holds it). With two tabs (step 2b) the second's title says the slot "is open in another tab" and refuses Continue, and once the first page closes it continues. |

The open items WS9 carried from Phase 0:

| Item | Result |
|---|---|
| The Continue hazard (0D2 §5) | **Fixed**: a bomb dropped after a save, the level left, then a load: P0's behaviour (no automatic saves) gives 3 bombs where there were 2; with the automatic saves, 2 (loaded in the new level); with a screen up that no save is made under before the change's save, 2 (loaded at the last save, on the old level). The zone you leave is written with the next slot record, so a load is always one moment. |
| Saves in memory only | **Fixed**: IndexedDB, the periodic (120 s of play), travel (10 s) and unload saves, One Wick's slot deleted on death, Commons Lamp checkpoints, the world by `state.world.id` (a run on the real world loads while new runs are built on the test world; an unknown world is refused). |
| Slots across stores (0D2 §6, `d2cb281`) | **Pass**: `moveSlot`, a save to another store with a checkpoint up, one with the old store's copy on write still in flight, and one with a zone left and held: in each the rows and the copies come over and death → C in the new store wakes identical to the checkpoint; the title moves a game kept in memory into IndexedDB. |
| Prefetch skipped while `ZONE_LOADER.load` is set | **Already settled in 0D2** (prefetch reads a stored neighbour through the loader); now checked: after a load, a stored span next door is read back in both views and never generated. |
| `?debug=1` read by nothing | **Fixed**: it adds the HUD's `debug` segment (zone, position, the save's state) and the title's slot ids and storage numbers. |
| Nothing tells the player about hotbar key 1 | **Fixed**: the HUD's `hotbar` segment, "1 Fold Step", while a hostile hunts you within 10 tiles (priority 70; at 100×30 one row, the lower ones dropped by priority; not on the death card); the options' key list says "1-9 abilities (hotbar)". |

Shell (section 17, 100×30 through the real input): the mode and a typed seed made the game (M typed into the seed
field did nothing); the title's warnings whole (an unclean exit twice, an older generator); Load a save: X exported,
Enter twice one load, Delete once asked, another key kept it, twice deleted; a slot stored with a character named 42
draws; the pause card's line only after 0.75 s; Esc → options; the field of view 75 → 80, kept in the store; save and
quit: a clean slot and the title; Continue: the same tile; the log on H keeps 60 lines (game.messages keeps 40), Home
scrolls to the first, both views; the death card, then after 1 s the recap (cause, damage by source, C to wake); C woke
at the checkpoint; R started a new run in the same mode; a Pilgrim's recap in its own words. In a real page (browser
step 6b) the log and the options are reached by keys and by clicks.

## 3. Deviations from the design, with reasons

1. **The graveyard and the view settings live in the save store's `meta` records, not localStorage** (§7.3, §7.5 say
   `storageKey("graveyard")`): `check-config` (P0's) allows localStorage only in `audio.js`. Integration request 7.
2. **`VERSION.save` stays 1**: `check-config` pins `VERSION`. The migration machinery is tested with a v2 reader
   (`loadGame`'s `version` and `migrations` options); the first real bump needs `check-config` changed.
3. **Pilgrim wakes at checkpoints like the Commons Lamp**: the bible gives Pilgrim friendlier factions and its XP rule,
   and no death rule. Its XP is WS4's (integration request 9).
4. **A checkpoint at the run's first save too**: "you wake at the last one" needs one, and both worlds start in a
   settlement (the temple, Hollowmere). A checkpoint whose save fails is given up, not tried again: its moment (the
   settlement entered or left) has passed.
5. **A zone change's save comes 0.5 s after the change**, not in its frame (the edge swap's frame is already the
   costliest, WS3's budget), and **the zone you leave waits for it** (§7.3 writes it at once): held, it goes into the
   same transaction as the slot record, which is what makes a load one moment.
6. **Saves are made under the screens that hold nothing they would lose** (the pause card, options, the log, the
   inventory, a screen's `saveThrough`), not only in the views (§7.3): otherwise the normal way out of 3D (Esc, then
   closing the tab) lost the last minutes and counted an unclean exit.
7. **The death recap and the pause card's options line come a beat after their cards** (1 s, 0.75 s), and the hotbar
   segment only while something hunts you: those recorded frames (`check-screen-frames`, golden) and `check-hud`'s
   180×56 row stay as they were. **The pause card itself names L look, V fire, the hotbar and the map legend's key (the comma)** (the
   user's decision, 2026-10-27, relayed by the coordinator: the map header, which golden (b) holds, can't): the four
   "… 3d pause card" frames are left out by exact name (`NOT_COMPARED`, integration request 12) and check-save
   section 20 holds the card in their states. L and V come with WS8, the legend's comma with WS3 and the integrator
   (integration request 13).
8. **The options open from the title and from the pause card (Esc), not from the map**: Esc on the map is P0's "to 3D"
   (`screens/play.js`). Integration request 5.
9. **`?quick=1` games keep their saves in memory** (`main.js` sets the memory store); the title opens IndexedDB and moves
   such a game into it. Integration request 1.
10. **The message log collects `game.messages` every frame**, and **the recap counts damage by wrapping
    `game.hurtPlayer`**: `game.js` has neither a longer log nor a hurt event yet (integration requests 3, 4).
11. **Additions to the record shapes**: zone records carry `cp` (the checkpoint they were written under) and `v`; the
    slot's `checkpoint` is the slot record with its number `n`; the store has a fourth object store, `meta`.
12. **One page a slot by Web Locks** (not in §7): two tabs on one slot overwrote each other record by record.

## 4. Known issues

- `browser-0d1` fails at `ws/ws9` with "modes never reached: options, log": `browser-shell` (P0's) doesn't know the two
  new modes. Integration request 11; `check-save --browser` step 6b reaches both by keys and clicks.
- After an unload save the zone you are in is stored uncompressed until its next save (an export then is larger: about
  110 KB for one zone).
- Without Web Locks (Node, older browsers) two tabs can still play one slot; the title then says a slot whose session
  never saved cleanly "may be open in another tab".
- Under heavy load headless Chromium sometimes fails a page's module request (`net::ERR_NO_BUFFER_SPACE`, the machine's
  sockets): one of the browser runs here failed so; rerun.
- On the map the options (and save and quit) are reached only through the title (deviation 8).

## 5. Verification fixes

Two independent verifiers reviewed `p0-done..7e30c80`: one the code against the spec, with Node scripts trying to break
the claims and mutations of a copy of the tree (17 caught, 3 alive), the other the browser gates and play in both views,
trying to break saves. Each finding was reproduced (their scripts), fixed in a commit of its own with a check that fails
without it (shown by putting the old code back), and `check-save` green after every commit.

| Finding | Fix | Commit |
|---|---|---|
| (both, major) The unload save was refused under any screen but explore and map: Esc in 3D and closing the tab lost everything since the last save and counted an unclean exit (under One Wick's death rule it ended the life). | Saves are made under the screens that hold nothing they would lose (SAVE_THROUGH: pause, options, log, inventory; `saveThrough`), checked through the stack. Section 13: all four commit (fail without), a busy screen writes nothing. | `212f42c` |
| (both, major) Items duplicated (or lost): write-behind landed the zone at once, so a page that went while a screen no save is made under was up (the "DEPTH n" beat after stairs among them), or before the change's save landed, loaded the old player against the newer zone. | With the automatic saves on, the zone you leave is held and written with the next slot record in one transaction. Section 11: a busy screen up, the page gone: 2 bombs of 2, at the last save (3 without). | `9398e5b` |
| (A, major) Save and quit could be followed by an earlier-asked save landing with `live` set (a zone change's save, one waiting), so the next Continue counted an unclean exit. | A clean save answers every waiting and wanted save of that game; the automatic saves stop for its slot. Section 14: Esc twice and save and quit within the change's half second, the clean save held 600 ms: clean (live set without). | `4fb7bd7` |
| (A, major on a failed write) A failed checkpoint save left the run under a checkpoint the store never got; death then left a slot whose zone had no record. | The run goes back to the last checkpoint written; jobs made under the failed one are set aside and their zones written afresh; numbers never reused. Section 19 (woke in 0,0,3 under checkpoint 3 without). | `b721beb` |
| (A, minor) A zone whose newest write failed was evicted and read back as before; a failed copy on write was never made again (the zone regenerated after death and C). | A failed write undoes its bookkeeping (not committed, not kept), and a save is asked for again 10 s on (a backoff that doesn't hold off new requests). Section 19 (both fail without). | `99cc7ae` |
| (B, medium) A failed IndexedDB write was invisible to the player, and each left an unhandled rejection. | Told in the log once in 30 s; `writeNow`'s rejection handled. Section 19 (twice without the 30 s rule). A second commit restores the reason's last character (a regex had lost its backslash). | `dad003c` `4992320` |
| (A, minor) A run saved under another run's slot id kept that run's zone rows. | A run's first write to a slot clears its rows. Section 16. | `8af61c5` |
| (A, minor) The same file imported twice at once got one id. | One import at a time; a suffix with a counter. Section 16. | `b95c5b9` |
| (B, medium) A tampered file (a character named 42) imported, and the title's warning threw while drawing, which stopped the page's loop on every reload; a file with broken blocks imported and then failed to load. | A file is checked field by field, and its run and current zone read as a load would, before it is stored; the title's names and times don't trust stored values. Sections 16, 17. | `5795694` |
| (B, low) A load that failed left the slot marked live. | The slot is marked once the zone you were in has been read. Section 16. | `c88ef97` |
| (A, nit) Zone migrations ran twice (up front and when read). | Each once, when read. Section 10: 3 runs for 3 zones (6 without). | `c580edc` |
| (A, residual) A batch with a keep (the unload save right after entering a zone written before the checkpoint) committed only when the task ended, and could go with the page. | `writeNow` commits as soon as every request is made, a keep's last one included. | `e56ddb8` |
| (B, low) `check-save --browser`'s import step flaked (the picker's watch started with the key). | Watched half a second before Enter. | `1b81b26` |
| (B, medium) Two tabs on one slot overwrote each other record by record. | One page a slot by Web Locks; the title tells an open tab from a crash. Section 14 (a stand-in lock manager), browser step 2b. | `46b5adc` |
| (A, minor) Enter twice on the Load list started two loads. | One load at a time. Section 17. | `6dfb0a3` |
| (A, minor) A Pilgrim's recap said the commons lamp's words. | Its own. Section 17. | `c67f5ea` |
| (A, minor) At 100×30 the title's warnings and a row's unclean count were cut; the no-IndexedDB warning showed the adapter's error. | Wrapped whole; the row's order; plain words (the browser's with `?debug=1`). Section 17. | `dae8de5` |
| (B, low) "1 Fold Step" stood under the death card. | Not when dead. Section 18. | `e802f40` |
| (A) Three mutations survived: `job.before` removed, the restore keeping `live`, memory commits out of order. | Sections 16, 15 and 3 catch each now. | `80ab0bc` |
| (B, gate) `browser-0d1` fails: "modes never reached: options, log". | Integration request 11 (`browser-shell`, P0's); `check-save --browser` step 6b reaches both by keys and clicks. | `b69d8a1` `865f567` |
| (recheck, A's `t9` at `80ab0bc`) A zone left and held had its key marked kept though its copy on write never ran, so a save to another store lost its checkpoint copy. | A save to another slot gives back the keeps its held zones would have made. Section 16. | `14bd5c2` |

Rechecked with verifier A's 13 scripts at `80ab0bc`: 24 of 25 cases OK; `t9`'s case failed (the last row above) and
passes at `14bd5c2`.

## 6. Rechecks

### The timed checks, alone, against `p0-done`

Each run alone (WS4b and WS6a resumed beside this session: runs 1 and 3 started once no other check was running, run
2's count didn't read; nothing else of this session's ran), `check-perf --against p0-done --rounds 3` (4 runs of
each tree, alternating) and
`check-dungeons` three times in alternation, this tree and `p0-done`'s (`git archive p0-done`). WS9 changes no file
the timed checks time but `hud.js` (3D frame: the hotbar and debug segments) and the save's updates: no generation,
no renderer, no map step.

| Run | Load | `check-perf` against `p0-done` | `check-dungeons` p95 (ms), HEAD / `p0-done` |
|---|---|---|---|
| 1 | The user's training job (8 workers), CPU 100% | Every timing 1.1-2× either tree's, both trees over budget; the ratios contradict each other (gen.surface ×2.00, gen.dungeon ×1.99, but skipTime ×0.80) | 154 / 261, 237 / 130, 228 / 292: both FAIL, neither slower |
| 2 | The training job off, CPU 14% | **FAIL on gen.surface.max only**: 154.04 ms against 131.52 (×1.17), one sample (the max). Every other ratio within ×1.15: frame.outdoor p50 23.49 / 23.37 (×1.01; over 17 on both trees, the machine's, not failed), frame.dungeon 12.22 / 12.49 (×0.98), refresh 7.74 / 7.78 (×0.99), apron 0.16 / 0.16, gen.surface p95 37.74 / 28.16 (×1.34, within its 60 budget), gen.dungeon p95 36.04 / 38.08 (×0.95), buildRun 0.48 / 0.48, restoreRun 0.25 / 0.24, passTime 7.12 / 7.52 (×0.95), mapStep 1.64 / 1.49 (×1.10), skipTime 0.06 / 0.05 | 26.97 / 27.23, 28.01 / 27.71, 27.91 / 25.64: all PASS |
| 3 | The training job off, CPU 20%, 0 other checks | **PASS**: gen.surface p95 28.78 / 27.40 (×1.05), gen.surface.max 115.05 / 122.56 (×0.94); frame.outdoor over 17 on both trees again (the machine's, not failed) | (not rerun) |

Run 2's gen.surface.max is noise: WS9 has no code in surface generation (`git diff p0-done` touches no generator), and
run 3 reads it ×0.94. WS9's own cost a 3D frame, measured directly (Node, 3 rounds of 20,000 calls: the hotbar segment, and the
updates with and without WS9's three): 0.14 µs with 1 creature, **2.12 µs** with 60 (as passTime's, all beyond 10 tiles)
(the hotbar's look for a hunter within 10 tiles 1.96 µs, the save's updates about 0.15 µs), against a 17 ms budget.
The absolute budgets are the integrator's to confirm on an idle machine (frame.outdoor reads 23 ms on both trees here).

### The final gates at `323e32e` (the code tagged: only `docs/ws9.md` and this file change after it)

| Gate | Result |
|---|---|
| `node tools/run-all.mjs` | **37 of 37 pass** (126.1 s, 11 at a time, the training job off). Its `check-perf` against `p0-0d1`: frame.outdoor p50 22.92 / 23.48 (×0.98; over 17 on both, not failed), frame.dungeon ×1.00, refresh ×0.98, gen.surface p95 ×0.61, gen.dungeon ×1.01, restoreRun 0.32 / 0.27 (×1.19, within its 50 ms budget). `check-screen-frames`: 47 drawn, 43 compared, 0 mismatched (the four pause cards left out by name). |
| `NODE_PATH="$(npm root -g)" node tools/browser-0d1.mjs --against p0-done` | **FAIL on "modes never reached: options, log" only**, as expected (integration request 11: `browser-shell`, P0's, doesn't know the two new modes). Everything else passes: the shell at 1280×720 and 600×300 (43 mode changes each, the pointer lock taken and lost, audio silenced), 14 of 16 modes by keys and clicks, the HUD at 100×30 (13 segments, `hotbar` among them; `check-hud` in the browser passes), 27 golden frames underground, 0 mismatched. Frame time against `p0-done` (ms a tick at 1280×720, 40 blocks of 40 ticks, alternating; CPU 16%): under/3d p50 10.00 / 10.10 (−1.2%), under/map 1.40 / 1.40 (−2.2%), surface/3d 9.70 / 9.80 (−1.1%), surface/map 1.20 / 1.20 (−2.3%). |
| `NODE_PATH="$(npm root -g)" node tools/check-save.mjs --browser` | **Pass**, every step: reload (0,0,0 at 24.5,6.5, 0 unclean), crash (warned, 1 counted), two tabs (refused, then continued), One Wick (slot deleted, a grave), the Commons Lamp (C woke at checkpoint 2 in 0,0,1), export and import (40,650 B, 1 → 2 slots), `?debug=1`, the options and the log by keys and clicks, the IndexedDB adapter, `?silent=1` (only its zero-gain sink reached the speakers). No server left on 8649, no browser open. |
