# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-27, the integrator (local session), on `integration`. **Phase 1 is running and Phase 2's
integration has started: WS3 is merged (`p2-ws3`); WS8 is next.** From here on only the integrator edits this file
and moves `main` (the workstreams write their handoffs in `docs/<ws>.md`).

## State

- **Last tag:** `p2-ws3` on `integration` (`p0-done` + the Phase 1 plan + §8.4's fold + `p1-ws3` + WS3's integration
  requests 4 and 8). `main` is fast-forwarded to it. Phase 0's tags (`p0-0a1` … `p0-done`) and the workstreams'
  `p1-*` tags are on GitHub.
- **Branch:** `integration`, in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\integration` (serves on port
  8660). Nothing is half finished.
- **Done:** Phase 0 (0A1 … 0D2, notes in `docs/sessions/0A1.md` … `0D2.md`); WS3 (`docs/ws3.md`,
  `docs/sessions/ws3.md`), merged. The merges' own numbers are under "Integration log" below.
- **Checks:** `node tools/run-all.mjs`, 37 checks (about 2 minutes on an idle machine, 4 with three workstreams
  running; the timed ones, `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end; since
  WS3, `check-perf` runs the render check first). Browser (headless Playwright, audio silenced,
  `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`, `browser-silent.mjs`, and
  with `node tools/serve.mjs <port>` running, `browser-shell.mjs` and `browser-0c.mjs` (`--port <port>`); each
  workstream's own (`browser-ws8.mjs` from WS8). `tools/README.md` has every command and what each check proves.

## Next step

**The integrator:** merge `p1-ws8` (tagged, waiting), then each `p1-*` tag as the coordinator reports it, in §8.5's
order (WS9, WS3, WS8, WS5, WS4, WS6a, WS6b, WS10, WS2, WS7, WS1). For each: read `docs/<ws>.md` and
`docs/sessions/<ws>.md`; merge the tag; apply the requests aimed at P0's, unowned, the integrator's or merged
workstreams' files, and carry the rest (below, "Carried integration requests"); rerun its dependency-table items
(§8.3's end) against the real code; `run-all`, the bot, golden (b), the browser checks (serve on 8660, `?silent=1`);
verify sceptically, one commit per finding; tag `p2-<ws>`, push it, and `git push origin p2-<ws>:main` only when
`git merge-base --is-ancestor origin/main p2-<ws>` holds.

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
| 3 | WS8 Combat depth, AI and targeting | `ws8`, `ws/ws8` | tagged `p1-ws8` (c9638c0); merge next |
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
serve rule, so `main` can fast-forward to the integrator's tags; merge `main` too if it has moved since), and folds `torch.js`, `keyset.js` and `tools/serve.mjs` into §8.4 (`0D2.md` §6).
Then, for each `p1-*` tag (in §8.5's order when several are ready): merge,
apply that workstream's integration requests, rerun its dependency-table items against the real code, `run-all`, the
bot and golden (b); tag `p2-<ws>` and fast-forward `main` to it (`git push origin p2-<ws>:main`, only as a
fast-forward). Only the integrator edits this file and moves `main`; the file lives on `integration` (started
2026-10-27; `wip/p1-plan` is merged in and no longer updated).

**Timed checks with three workstreams running:** three `run-all`s at once skew the timed checks the way the training
job does. For a timed gate number, run that check alone on an idle machine and against `p0-done` in alternation
(`check-perf --against p0-done`); never loosen a budget.

## Waiting on the user

- **The d20 balance from tier 5** (WS8, `docs/sessions/ws8.md` §3): under d20 a same-level kill costs 34-60% of your
  health at tiers 5-8 against the parent's 25-38% (7.5-17.7% against 8.5-16.3% through tier 4, close). Creatures add
  floor(level / 3) to hit against a DV that grows only with AGI; nothing on your side scales with level. The numbers
  are DECISIONS' and the bible's (RULES.d20), so no workstream changed them: whether to retune (and where: the
  creature to-hit, player DV by level, WS4's powers, C4's gear) is your call, before or at the flip (§8.5).
- **WS9's HUD, pause and death screens will change many recorded screen frames** (the 47 of
  `tests/checks/screen-frames.js`, P0's guard on the shell). Only WS3's "victory card" is excluded (approved for WS3,
  drawn over the outdoor map). A blanket exclusion is not approved: at WS9's merge the integrator lists which frames
  change and why, and asks before excluding any.
- **Key hints on the map** (WS8 #5, WS3 #4, `0D2.md` §5's hotbar hint): the map header is in golden (b)'s 27
  underground frames, so it can't name L (look), V (fire), G (legend) or hotbar key 1 while golden (b) is held. Where
  they go instead (the pause card's key list at WS9's merge, WS4b's sheet) or when golden (b) retires is yours.

## Carried integration requests (by owner)

Requests the integrator can't apply yet because the file belongs to a workstream that hasn't merged; each is applied
at that merge (so it doesn't conflict with the branch). Numbers are the asking workstream's (`docs/<ws>.md`).

- **WS9** (at its merge): WS3 #3, register the HUD's clock segment (`hud.registerHudSegment("clock",
  render3d.CLOCK_SEGMENT)`, under the sky only) and let `tests/checks/hud.js:91`'s 180-column "parent's order"
  assertion allow it on the start span (outdoors); WS3 #7, the held weapon at night (`hud.js:326-328`) lit by
  `light.lightAt(...).sky` (sky × daylight), not the raw sky light. The key hints above, if the user puts them on the
  pause card.
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
- From 0B: thrown things stop at a zone's border (WS8 lands them in the next zone).
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly.
