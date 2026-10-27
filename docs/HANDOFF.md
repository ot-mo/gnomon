# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-27, the integrator (local session), on `integration`. **Phase 1 is running and Phase 2's
integration has started: WS3 and WS8 are merged (`p2-ws3`, `p2-ws8`); the next is whichever `p1-*` tag lands
next (WS9, WS5 and WS4a are running).** From here on only the integrator edits this file
and moves `main` (the workstreams write their handoffs in `docs/<ws>.md`).

## State

- **Last tag:** `p2-ws8` on `integration` (`p0-done` + the Phase 1 plan + §8.4's fold + `p1-ws3` and `p1-ws8` with
  their integration requests; `p2-ws3` before it). `main` is fast-forwarded to it. Phase 0's tags (`p0-0a1` … `p0-done`) and the workstreams'
  `p1-*` tags are on GitHub.
- **Branch:** `integration`, in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\integration` (serves on port
  8660). Nothing is half finished.
- **Done:** Phase 0 (0A1 … 0D2, notes in `docs/sessions/0A1.md` … `0D2.md`); WS3 and WS8 (`docs/ws3.md`,
  `docs/ws8.md`, `docs/sessions/ws3.md`, `ws8.md`), merged. The merges' own numbers are under "Integration log" below.
- **Checks:** `node tools/run-all.mjs`, 37 checks (about 2 minutes on an idle machine, 4 with three workstreams
  running; the timed ones, `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end; since
  WS3, `check-perf` runs the render check first). Browser (headless Playwright, audio silenced,
  `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`, `browser-silent.mjs`, and
  with `node tools/serve.mjs <port>` running, `browser-shell.mjs` and `browser-0c.mjs` (`--port <port>`); each
  workstream's own (`browser-ws8.mjs` from WS8). `tools/README.md` has every command and what each check proves.

## Next step

**The integrator:** wait for the coordinator's message; merge each `p1-*` tag as it lands, in §8.5's
order (WS9, WS3, WS8, WS5, WS4, WS6a, WS6b, WS10, WS2, WS7, WS1). For each: read `docs/<ws>.md` and
`docs/sessions/<ws>.md`; merge the tag; apply the requests aimed at P0's, unowned, the integrator's or merged
workstreams' files, and carry the rest (below, "Carried integration requests"); rerun its dependency-table items
(§8.3's end) against the real code; `run-all`, the bot, golden (b), the browser checks (serve on 8660, `?silent=1`);
verify sceptically, one commit per finding; tag `p2-<ws>` (annotated), push it, and only when
`git merge-base --is-ancestor origin/main p2-<ws>` holds, `git push origin 'p2-<ws>^{commit}:refs/heads/main'` (an
annotated tag's own name can't be pushed to a branch; `^{commit}` is the commit it tags).

**The workstreams** go on as the "Phase 1 plan" below says (the coordinating session starts the next one in the
queue as a slot frees).

**Phase 1** (TECH_DESIGN §8.3, ownership §8.4; DECISIONS "Phase 1 workstreams"): WS1-WS10, each in its own worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\<ws>` on a branch `ws/<ws>` made from the tag:
`git worktree add "C:\Users\Otto Mörner\Code\gnomon-wt\<ws>" -b ws/<ws> p0-done`. A workstream edits only its §8.4
files, fills its stubs in place (keep every name `tests/checks/imports.js` freezes; drop `STUB` once a file is built),
replaces its check stub keeping `run(env)`, and puts any change to someone else's file in `docs/<ws>.md` under
"Integration requests". `features.js`, `content/index.js` and `tests/checks/index.js` are never edited after P0. Each
workstream ends the same way as a Phase 0 session: implement → independent verification → fix → recheck → tag.

## Phase 1 plan (agreed with the user, 2026-10-26)

**Three workstreams at a time**, in a rolling queue: when one tags, the next in the queue starts in the freed slot.
This laptop has 6 cores (12 threads) and 16 GB, shared with the user's training job; each `run-all` already runs 11
jobs, and each verification drives headless Chromium on SwiftShader (the CPU). A split workstream (a/b) keeps one
slot, one worktree and one branch for both halves, and its b session starts right after the a tag. 14 sessions in
all, about five rounds.

**Order** (§8.5's merge order: the workstreams others build on first, so the integrator can merge each one as it
tags; WS1, which builds on the most, last):

| # | Workstream | Worktree (`gnomon-wt\…`), branch | State |
|---|---|---|---|
| 1 | WS9 Persistence and shell | `ws9`, `ws/ws9` | running (since 2026-10-26) |
| 2 | WS3 Rendering outdoors and presentation | `ws3`, `ws/ws3` | tagged `p1-ws3` (51785f7); **merged, `p2-ws3`** (2026-10-27) |
| 3 | WS8 Combat depth, AI and targeting | `ws8`, `ws/ws8` | tagged `p1-ws8` (c9638c0); **merged, `p2-ws8`** (2026-10-27) |
| 4 | WS5 Body mods, items and equipment UI | `ws5`, `ws/ws5` | running (since 2026-10-27) |
| 5 | WS4a → WS4b Character creation and progression | `ws4`, `ws/ws4` | WS4a running (since 2026-10-27); WS4b after `p1-ws4a` |
| 6 | WS6a → WS6b Factions, dialogue builders → trade, the Kindling, backings | `ws6`, `ws/ws6` | queued |
| 7 | WS10 Dungeon sites, lairs and legends | `ws10`, `ws/ws10` | queued |
| 8 | WS2a → WS2b Surface generation | `ws2`, `ws/ws2` | queued |
| 9 | WS7a → WS7b Knowledge: history, villages, quests | `ws7`, `ws/ws7` | queued |
| 10 | WS1 Overworld travel | `ws1`, `ws/ws1` | queued |

- **Why these three first:** WS9 fixes the Continue hazard and gives real saves (IndexedDB, periodic and unload
  saves); WS3 owns the open outdoor-frame budget (§6.7's 17 ms), the horizon band and the clock's looks; WS8 builds the
  target screen, the look cursor and the spatial queries that WS4, WS5, WS6a and WS7 test against through their seams.
- **WS6b** builds the item backing only: DECISIONS settles the currency as glim, with no liquid backing and no
  containers; liquids stay what DECISIONS makes them (faction sacraments for the Kindling, the base of tonics).
- **Starting the next one:** from the main checkout,
  `git worktree add "C:\Users\Otto Mörner\Code\gnomon-wt\<ws>" -b ws/<ws> p0-done` (always from the tag), then
  `git push origin ws/<ws>`, then a session whose working folder is that worktree. Mark it in the table above.
  In PowerShell quote the path in single quotes; in Git Bash write it with forward slashes
  (`/c/Users/Otto Mörner/Code/gnomon-wt/$ws`): a backslash before `$ws` stopped it expanding once and made a folder
  `gnomon-wt$ws`.
- **Names:** `<ws>` is `ws1` … `ws10` (the a/b halves share theirs). Public API, "Integration requests" and the
  workstream's own "Handoff" section: `docs/<ws>.md`. Gate numbers: `docs/sessions/<ws>.md`, or `<ws>a.md` and
  `<ws>b.md` for the halves (`docs/sessions/ws6a.md`).

**How every workstream ends** (CLAUDE.md, as for a Phase 0 session):

1. Implement in its own worktree, editing only its §8.4 files; a change anywhere else goes in `docs/<ws>.md` under
   "Integration requests". Commit each logical step (the post-commit hook pushes `ws/<ws>`). A worktree made from
   `p0-done` carries DECISIONS' older "Browser checks" text that names Python: `main`'s (`4002a50`,
   `node tools/serve.mjs <port>`) is the one that holds.
2. Independent, sceptical verification: rerun the gate, look for regressions in the old game in both views, try to
   break the claims. Then fix (one commit per finding) and recheck. `tools/workflows/p0-session.js` is how Phase 0 ran
   this; it still serves pages with Python, so a run of it here needs `tools/serve.mjs` in its place.
3. Tag `p1-<ws>` (`p1-ws6a`, then `p1-ws6b`, for the halves) on `ws/<ws>` once `node tools/run-all.mjs` is green in
   the worktree and every §8.3 acceptance item has its numbers in `docs/sessions/<ws>.md`; push it at once
   (`git push origin p1-<ws>`).
4. **A workstream never touches `main` or `docs/HANDOFF.md`.** Its handoff (state, the exact next step, anything half
   finished, anything surprising) goes in `docs/<ws>.md` "Handoff" on its branch, so ten branches don't conflict in
   this file. Its worktree stays until the integrator has merged it.

**The integrator** (§8.5): one session in `gnomon-wt\integration` on branch `integration` from `p0-done`, started when
the first `p1-*` tag is up. It first merges `wip/p1-plan` (this file; it already holds `main`'s `4002a50`, DECISIONS'
serve rule, so `main` can fast-forward to the integrator's tags; merge `main` too if it has moved since), and folds `torch.js`, `keyset.js` and `tools/serve.mjs` into §8.4 (`0D2.md` §6): both done on 2026-10-27 (`ad067c5`
fast-forwarded, `e6b3f98`).
Then, for each `p1-*` tag (in §8.5's order when several are ready): merge,
apply that workstream's integration requests, rerun its dependency-table items against the real code, `run-all`, the
bot and golden (b); tag `p2-<ws>` and fast-forward `main` to it (only as a fast-forward; the command is under
"Next step"). Only the integrator edits this file and moves `main`; the file lives on `integration` (started
2026-10-27; `wip/p1-plan` is merged in and no longer updated).

**Timed checks with three workstreams running:** three `run-all`s at once skew the timed checks the way the training
job does. For a timed gate number, run that check alone on an idle machine and against `p0-done` in alternation
(`check-perf --against p0-done`); never loosen a budget.

## Waiting on the user

Nothing. The user's decisions of 2026-10-27 (given to the coordinating session in chat: "Do recommend for 1 and two
and put legend in pause card key list"), each now a carried item below:

- **WS9's recorded frames:** at WS9's merge the integrator excludes from `tests/checks/screen-frames.js`, by exact name
  in `NOT_COMPARED`, only the frames WS9's HUD, pause and death screens change, each with its reason; WS9's own check
  must hold the new screens; golden (b) stays held. No blanket exclusion.
- **The d20 balance at tiers 5-8:** no retune now. Revisit with WS8's TTK tables (`node tools/check-combat.mjs --only
  ttk`) once WS4's powers and C4's gear exist, and settle it before or at the flip at WS4's merge, showing the user
  the tables then.
- **The map's key hints** (L look, V fire, G legend, hotbar key 1): in WS9's pause card key list (WS9 has been told).

## Carried integration requests (by owner)

Requests the integrator can't apply yet because the file belongs to a workstream that hasn't merged; each is applied
at that merge (so it doesn't conflict with the branch). Numbers are the asking workstream's (`docs/<ws>.md`).

- **WS4** (at its merge; WS4's session has `docs/ws8.md` and was told how #8 and #11 landed): WS8 #1,
  `abilities.requestTarget` through `screens/target.js` (on the map the screen answers later; `useAbility` goes on
  in the callback; `check-abilities` §5 then drives the screen with Enter), and an ability's `use` may get the player
  as `target.creature` when a creature uses it (ai.js). WS8 #8 and #11 are applied (below): Steady hand gives
  `{ missileAcc: 2 }`; `innate` is ability ids only, a bonus table is `e.bonuses`. The integrator's hook for the
  torch's ways out (Lampskin, the Lamplighter) when WS4 asks.
- **The flip** (§8.5; WS8 #9), at WS4's merge (WS4 and WS8 both in): `RULES.stats = "attributes"` and
  `RULES.combat = "d20"` (DECISIONS: d20, not §8.5's "dice") by default; golden (a) retires; `check-legacyfights`
  then needs `overrideRules("combat", "legacy")` around its fights (its fixture is the parent's); WS8's TTK tables
  (`node tools/check-combat.mjs --only ttk`) become the balance reference. Under d20 the map's T opens the target
  screen, creatures flee, and the log takes the d20 lines. **Due before or at the flip:** the tier 5-8 balance (the
  user's decision above): rerun `node tools/check-combat.mjs --only ttk` with WS4's powers in (and C4's gear, if it
  exists by then), show the user the tables, and settle any retune with them before the defaults change.
- **WS6a** (at its merge): WS8 #2, a creature hostile to you is hostile to your followers (`attitude(a, f)` with
  `f.brain.leader === "player"`: "hostile" when `attitude(a, player)` is); until then monsters ignore your
  followers until one strikes them. WS8's spatial queries (`nearestCreature`, `sees`, `witnessesOf`) are in for the
  witnesses.
- **WS10** (at its merge): WS8 #3, spikes rise through a flat you harmlessly (bible §10.2): `traps.js updateSpikes`
  skips you when `!touchesYou(game, null)` (creatures.js).
- **WS5** (information): WS8's L in both views emits `inspect { open: true }`; the examine screen opens on it. Missile
  weapons are carried in the pack, not held (`docs/ws8.md`, deviation 2), and `inventory.js` reads
  `WEAPONS[wielded.id]`.
- **WS9** (at its merge): WS3 #3, register the HUD's clock segment (`hud.registerHudSegment("clock",
  render3d.CLOCK_SEGMENT)`, under the sky only) and let `tests/checks/hud.js:91`'s 180-column "parent's order"
  assertion allow it on the start span (outdoors); WS3 #7, the held weapon at night (`hud.js:326-328`) lit by
  `light.lightAt(...).sky` (sky × daylight), not the raw sky light. **The recorded frames** (the user's decision above): exclude by exact name only the
  frames WS9's HUD, pause and death screens change, each with its reason, WS9's own check holding the new screens,
  golden (b) held. **The key hints** L (look), V (fire), G (legend) and hotbar key 1 on the pause card's key list: if
  WS9 tags without them, add them at the merge (`screens/pause.js` is WS9's, merged by then) or carry the request on.
- **WS2** (at its merge): WS3 #5, `map` looks for the reserved TRUNK, SHALE, LEAVES, REED (blocks.js); note bible
  §15.7 reserves `♣` (speaking trees) and `^` (spikes), as blocks.js's comments say. WS3 #5 for GRASS (id 7, the
  integrator's): **not applied**: §6.5's grass `"` is the amulet's reserved glyph (bible §15.7 outranks TECH_DESIGN),
  and GRASS already shows as `.` in its own colour. WS3 #6, the edge-swap frame's step: the new zone's far apron
  bands are built from the world functions in the swap frame (`zones.js fillApron` → WS2's `buildApronBand`); build
  them during prefetch or a band a frame. Deferred to WS2's merge (it rewrites `buildApronBand`) together with WS9's
  "prefetch through the loader" (both touch `zones.js`'s prefetch). WS3 #10, the Gnomon's 14-block voxel foot at
  span (37, 3) (or C1's landmark plan): render3d starts the needle on whatever stands at the span's middle.
- **WS1, C1, WS6b, WS7** (information, nothing to apply): WS3 #11 and #12 (`render3d.gnomonDrawn()` for "the Gnomon
  in sight"; `clock.handAt`/`underHand`; a region's or terrain's `fog` and a region's `music`; a liquid's `color`;
  `state.noonLength` for the Lengthening).

## Integration log

**`p2-ws8`** (2026-10-27): `p1-ws8` (c9638c0) merged into `integration` (a05decb), no conflicts (no file of WS8's
is WS3's).
- WS8's P0 check lines, confirmed and kept (#6): one `ITEM_SAMPLES` line in `tests/checks/content.js` and one sample
  line in `tests/checks/body.js` (the `missile` and `ammo` kinds, each `// WS8`), as `0D2.md` §6 asks of a new kind.
  #12 (3D draws every creature) came in with `p1-ws3` (`c8f2273`): dropped.
- Applied, each with an assertion that fails without it: #4 (`5351983`: `monsters.js pushPlayerOut` skips a creature
  still arriving: pushed 0 tiles while arriving, 0.40 once here); #11 (`d13fe5f`: `stats.js`'s own-bonuses source reads
  `e.bonuses`, so `innate` is ability ids only; the player's `["foldStep"]` used to sum into the bonus table as
  `{"0": "0foldStep"}`); #8 (`45816a9`: a bonus key `missileAcc` added to a shot's accuracy, the bolt-bow 1 → 3 with
  `{ missileAcc: 2 }`, the blade unchanged; Appendix A); #7 (`4e62fbb`: `tools/README.md` for check-combat's parts and
  `browser-ws8.mjs`; §8.4 gives `browser-ws8` to WS8). Not applied: #5 (the map header is in golden (b)'s frames; the user put
  the hints on WS9's pause card, above; the outdoor legend's `)` row is 18 cells wide, too narrow for "missile weapons and bolts"); #9 (the
  flip, at WS4's merge); #10 (nothing asked). Carried: #1 to WS4, #2 to WS6a, #3 to WS10 (above).
- Dependency table: "WS3 night auto-map, daylight perception" rerun against WS8's real `refreshView` and
  `creatures.sees` (`d5e308d`, render.js §3: the auto-map 576 / 9 / 137 / 127 columns as before; a goblin 7.7 tiles
  off sees you at noon and 18:30, not at midnight with your torch out, and again with it lit; fails with `sees`' dark
  factor taken out). "WS8 followers across edges" against P0's real zone events: check-combat's AI part passes (both
  views, the stairs, travel). The rest of WS8's (WS4 abilities on the map, WS5 examine from L, WS6a witnesses, WS7
  murals, WS8 attitudes) wait for those merges.
- Verification finding, fixed (`09b687e`): `browser-0d1` failed "modes never reached: target" (WS8's new screen; WS8
  hadn't run `browser-0d1`). It now opens the look cursor with L on the map and closes it by Esc and by a right
  click: 15 of 15 modes.
- Checks: `run-all` at `d5e308d` (every request in) **37 of 37** (209 s, CPU 74% at the start, three workstreams
  running), the timed ones within budget in the run (`check-perf` against `p0-done`: the outdoor frame 19.2 against
  26.3, ×0.73, the machine's; refresh 7.6 ×0.83; generation p95 35.7 / 31.7 ×0.78 / ×0.71; passTime 8.45 ×1.05; the
  swap 26.0 against 70.8; `check-dungeons` p95 38.5). Golden: mechanics 86, frames 27, dungeons 95, vaults 28, temple 2,
  0 mismatched; screen frames 46 of 46 compared; the legacy fights, the bot, determinism; check-combat's five parts
  (P0's combat, targeting, AI depth, the arena, the TTK tables). WS8's own timed item alone, `check-combat --perf
  --seconds 40 --against p0-done` (CPU 62-73%): passTime p50 7.40 / 7.11 / 7.97 ms (hunting legacy, hunting d20, two
  factions) against 5.32 / 4.95 / 4.89, ×1.39-1.63 as WS8 reported (×1.2-1.7), within the 12 ms budget. Browser
  (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-ws8` seeds 1234 and 7 pass (L, Tab, Enter, Esc, the
  mouse, T and TT, V and a click on the orc, L/V/T in 3D, the follower 3.0 tiles off, never striking you);
  `browser-gate` 1234 and 7 (the swap 43.0 / 44.2 ms on SwiftShader, black 0.006 → 0.007); `browser-0c` 1234 and 7;
  `browser-shell` 1280×720 and 600×300; `browser-0d1 --against p0-done` after the fix: 15 of 15 modes, the HUD at
  100×30 with 13 segments (WS8's `missile` among them), golden (b) 27 of 27 in the browser, per tick underground
  +1.6% (3D) and +2.0% (map), within its 5%, surface 3D −11.0%; `browser-0d2 --all`: boot with 153 modules, imports
  156 of 156, `test-world.html` 34 of 34 checks in the browser (render and combat with the integrator's assertions
  among them); `browser-silent` passes.

**`p2-ws3`** (2026-10-27): `p1-ws3` (51785f7) merged into `integration` (a7d3124), no conflicts (WS3 touched only
its §8.4 files and two P0 checks).
- WS3's two P0 check changes, confirmed: `b267794` (`tests/checks/clock.js` §5 a pure seam check: the same game time
  gives the same looks, daylight in 0..1, the sun a unit vector, buckets whole, fog never negative, the parent's noon
  sky at noon; the values are in `render.js` §1) and `87a902c` (`tests/checks/screen-frames.js`'s `NOT_COMPARED`
  holds only "victory card", with its reason; the fixture untouched; 46 of 47 frames compared, 0 mismatched).
  WS8's request 12 (3D draws every creature) is in `p1-ws3` (`c8f2273`), dropped from WS8's list.
- Applied: WS3 #8 (`fc234af`: `tools/README.md`'s check-perf row; `tests/checks/index.js`'s perf line names
  `p0-done`); WS3 #4 (`b0c6712`: G on the map shows or hides the legend, its foot says "G: legend"; `render.js` §6
  presses it and fails without the binding). Carried or declined: above.
- Dependency table: "WS3 apron rendering" against P0's apron (WS2 not in): render.js §2 (100 views, 0 black below
  the horizon) and check-edges pass; "WS3 night auto-map, daylight perception" is rerun at the WS8 merge.
- Checks (three workstreams running beside, CPU at 100% during the full runs): `run-all` at the merge 35 of 37
  (240.7 s), the two failures timed only (`check-dungeons` p95 42.3 against 40; `check-perf` with generation and
  refresh over budget and more than 15% slower than `p0-done` in that run), both passing alone: `check-perf --against
  p0-done --rounds 2` PASS (CPU 34-48%: the outdoor frame p50 17.4 ms against `p0-done`'s 25.0, ×0.70, the machine's;
  dusk 15.3, night 16.2, the bake p50 2.0, refresh 8.1 ×1.07, surface generation p95 35.7 ×1.08 and max 146 ms,
  dungeon generation p95 37.9 ×1.03, passTime 6.7 ×1.02, the swap frame p50 24.1 against 48.6), `check-dungeons`
  alternating with `p0-done` p95 25.3 / 26.0 against 28.2 / 27.2 ms. `run-all` again at `b0c6712` (the requests in):
  36 of 37 (188 s), `check-perf` failing under load in its one round (refresh ×1.61, dungeon generation ×1.31); alone,
  4 rounds each way (`--rounds 3 --no-render`, CPU 30-42%): PASS, refresh 7.91 against 7.93 ms (×1.00), surface
  generation p95 31.4 (×0.96), dungeon generation p95 34.7 (×1.00), the outdoor frame 19.9 against 23.1 (×0.86, the
  machine's). Golden (b) 27 of 27, golden mechanics 86, dungeons 95, vaults 28, temple 2; screen frames 47 drawn, 46
  compared, 0 mismatched; the bot (`check-bot`) and determinism pass; the render check 13 parts with `--expose-gc` (the
  dormant zone's 5 arrays freed). Browser, served by `tools/serve.mjs 8660`, `?silent=1`, 0 console errors:
  `browser-gate` seeds 1234 and 7 pass (the swap frame on SwiftShader 42.2 / 40.1 ms against a 16.2-16.4 median, black
  share 0.006 → 0.007); `browser-0c` seeds 1234 and 7 pass (legacy and d20 fights in both views, Pell's talk, shop and
  services); `browser-shell` at 1280×720 and 600×300 pass (43 mode changes each); `browser-0d1 --against p0-done`
  passes (14 of 14 modes, the HUD at 100×30, golden (b) 27 of 27 in the browser; per tick underground 3D −0.2%, map
  −1.3%, surface 3D −11.4%, surface map −0.2%).
- Not run at this tag: `browser-0d2` and `browser-silent` (run at the WS8 merge, on WS3's code too: both pass).
- Verification of the merge: no file of WS3's overlaps another merged one; the old game in both views is held by
  golden (a) and (b), the 46 frames, the legacy fights, the bot's both-view session and determinism. G underground
  (a probe on legacy level 3, 48×48, at 180 and 160 columns): the parent's legend shown → hidden → shown, the frame
  after two presses identical to the one before, no hint line underground; nothing presses G in any recorded run.

## Things a workstream should know (local machine)

- **Timing on this laptop:** when the user's ML training job runs, timed checks read 2-3x slow. Before calling a timed
  failure a regression, check the CPU and compare against an older tag in a worktree, run alternately
  (`check-perf --against <ref>` does this itself). Never loosen a budget.
- **Serving the repository:** `node tools/serve.mjs <port>` (DECISIONS "Browser checks"; the `gnomon` preview in the
  local, untracked `.claude/launch.json` runs it on 8130). Python's `http.server` drops part of a boot's ~150 module
  requests on Windows. Worktrees made from `p0-done` carry the older DECISIONS text that still names Python: the main
  checkout's DECISIONS is the one that holds.
- **Frame times on the GPU:** the browser tools' default Chromium renders on SwiftShader (the CPU). Playwright's
  headless shell renders on the Intel UHD when launched with `--use-angle=d3d11 --ignore-gpu-blocklist`
  (`0D2.md` §8 has the launch shim). Playwright's full Chromium doesn't start on this machine; Google Chrome
  (`channel: "chrome"`) does. The built-in browser pane is GPU-backed but runs at 6 frames a second while hidden.
- **Headless browsers grant every pointer-lock request**, and a CDP Escape counts as a user activation, so a refused
  lock can only be replayed (as `browser-shell` does). A real-keyboard check is still worth doing once with the user
  at the machine: in 3D press Esc (the pause card), J, wait 6 s, Esc: the game should land on the pause card, and a
  click on it should lock the mouse again.

## Open items carried forward

- **WS3 (merged; what's left):** the edge-swap frame's step (the far apron bands built in the swap frame: carried to
  WS2 above); the underground legend says "gold" while golden (b) holds (WS3 #9: change `renderMap.js`'s `$` row
  when it retires; the outdoor legend says glim). The outdoor frame, the horizon band and the clock's looks are done
  (`docs/sessions/ws3.md` §2: 16.1 ms at noon against `p0-done`'s 22.6 on a quiet machine).
- **WS8 (merged; what's left):** `passTime` costs ×1.2-1.7 `p0-done`'s in WS8's alternating measure (p50 4-5 ms
  against a 12 ms budget); the look line is all L shows until WS5's examine screen opens on `inspect`; monsters ignore
  your followers until struck (WS6a, carried), spikes hurt a flat you (WS10, carried).
- **WS9:** Continue can mix two moments (zones left after the last save are written behind and read on load: an item
  dropped after the save is duplicated); §7.3's save on a completed zone change fixes it. Saves are in memory only
  (IndexedDB, periodic and unload saves, the oneWick slot deleted on death, checkpoints). Prefetch is skipped while
  `ZONE_LOADER.load` is set (prefetch through the loader). `?debug=1` is parsed but unused.
- **WS4:** Fold Step keeps its own numbers (`0D2.md` deviation 17) and is innate in P0; nothing tells the player about
  hotbar key 1 (a hint would change recorded frames). A quick game starts with no glim, so in the old campaign the
  torch gutters 240 s into the first dungeon until cash is picked up (deviation 16); backgrounds give 60-250 glim.
- **Integrator:** the torch's ways out (a glim heart, WS5; Lampskin and the Lamplighter, WS4) need a hook `burnTorch`
  reads (a bonus key through the stat bus, say), when WS4 or WS5 asks. (§8.4 now names `torch.js`, `keyset.js`,
  `tools/serve.mjs` and `report.mjs` frozen, `e6b3f98`.)
- **C1:** the real world has no regions yet, so the Hollow Mere compiles as the Glass Sea; `content/world/regions.js`,
  `landmarks.js` and `plans/*.js` don't exist yet (import them from `worldmap.js`; the frozen index needs no edit).
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly.
