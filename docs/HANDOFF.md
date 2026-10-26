# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, local session, on `wip/p1-plan` (from `p0-done`). **Phase 0 is done; Phase 1 has started:
the plan below is agreed with the user, and the first three workstreams have their worktrees.**

## State

- **Last tag:** `p0-done` (Phase 0 session 0D2: config and `?silent=1`, the clock and the torch's glim drain,
  abilities with Fold Step on hotbar key 1, the save codec, store, write-behind and title screen, every Phase 1 stub,
  `features.js`, the check index and `test-world.html`, check-names/content/save/perf, the 10-zone bot session,
  `tools/README.md`). It is the commit that carries this handoff, and `main` is fast-forwarded to it. All six Phase 0
  tags are on GitHub (`p0-0a1` … `p0-0d1`, `p0-done`).
- **Branch:** 0D2 was done locally on `wip/p0-0d2` (its head is `p0-done`). The Phase 1 plan is on `wip/p1-plan`
  (this file only); the integrator takes it into `integration` first. Nothing is half finished.
- **Done:** 0A1, 0A2, 0B, 0C, 0D1, 0D2. Notes with APIs, gate numbers, deviations and verification fixes:
  `docs/sessions/0A1.md` … `0D2.md`. Read `0D2.md` §6 ("what the next session must know") before starting a workstream.
- **Checks:** `node tools/run-all.mjs`, 37 checks, all green (about 2 minutes, 11 at a time; the timed ones,
  `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end). Browser (headless Playwright,
  audio silenced, `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`,
  `browser-silent.mjs`, and with `node tools/serve.mjs 8642` running, `browser-shell.mjs` and `browser-0c.mjs`.
  `tools/README.md` has every command and what each check proves. Rechecked at `p0-done` before Phase 1
  (2026-10-26): 35 of 37 in a full run; the two timed ones failed only while three worktrees were being checked out
  and another `run-all` ran, and both pass alone on an idle machine (`check-dungeons` p95 28.5 ms; `check-perf` with
  dungeon generation p95 35.2 ms and the outdoor frame p50 22.7 ms, level with `p0-0d1`).

## Next step

**Start the first three workstream sessions** (WS9, WS3, WS8), each in its own worktree, which already exist; then
follow the "Phase 1 plan" below: the next workstream in the queue as each one tags, and the integrator at the first
`p1-*` tag.

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
| 1 | WS9 Persistence and shell | `ws9`, `ws/ws9` | worktree made at `p0-done` (2026-10-26); session proposed |
| 2 | WS3 Rendering outdoors and presentation | `ws3`, `ws/ws3` | worktree made at `p0-done` (2026-10-26); session proposed |
| 3 | WS8 Combat depth, AI and targeting | `ws8`, `ws/ws8` | worktree made at `p0-done` (2026-10-26); session proposed |
| 4 | WS5 Body mods, items and equipment UI | `ws5`, `ws/ws5` | queued |
| 5 | WS4a → WS4b Character creation and progression | `ws4`, `ws/ws4` | queued |
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
fast-forward). From then on only the integrator edits this file and moves `main`; until then this table is kept on
`wip/p1-plan`.

**Timed checks with three workstreams running:** three `run-all`s at once skew the timed checks the way the training
job does. For a timed gate number, run that check alone on an idle machine and against `p0-done` in alternation
(`check-perf --against p0-done`); never loosen a budget.

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

- **WS3:** the Node outdoor frame is over §6.7's 17 ms (p50 22 ms here, the same at `p0-0d1`). On the GPU the edge-swap
  frame costs about one dropped frame (31-41 ms against a 17-19 ms median, level with `p0-0d1`: the apron rebuild and the first draw in the
  new zone). A 6-row black band at the horizon outdoors. The clock's looks are noon stubs.
- **WS9:** Continue can mix two moments (zones left after the last save are written behind and read on load: an item
  dropped after the save is duplicated); §7.3's save on a completed zone change fixes it. Saves are in memory only
  (IndexedDB, periodic and unload saves, the oneWick slot deleted on death, checkpoints). Prefetch is skipped while
  `ZONE_LOADER.load` is set (prefetch through the loader). `?debug=1` is parsed but unused.
- **WS4:** Fold Step keeps its own numbers (`0D2.md` deviation 17) and is innate in P0; nothing tells the player about
  hotbar key 1 (a hint would change recorded frames). A quick game starts with no glim, so in the old campaign the
  torch gutters 240 s into the first dungeon until cash is picked up (deviation 16); backgrounds give 60-250 glim.
- **Integrator:** §8.4 names no owner for `torch.js`, `keyset.js` and `tools/serve.mjs` (`0D2.md` §6 proposes them);
  the torch's ways out (a glim heart, Lampskin, the Lamplighter) need a hook `burnTorch` reads.
- **C1:** the real world has no regions yet, so the Hollow Mere compiles as the Glass Sea; `content/world/regions.js`,
  `landmarks.js` and `plans/*.js` don't exist yet (import them from `worldmap.js`; the frozen index needs no edit).
- From 0B: the map legend still says "gold" (golden (b) frames show it). Thrown things stop at a zone's border.
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly.
