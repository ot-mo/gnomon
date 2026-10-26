# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, local session, at the tag `p0-done`. **Phase 0 is done; Phase 1 starts from `p0-done`.**

## State

- **Last tag:** `p0-done` (Phase 0 session 0D2: config and `?silent=1`, the clock and the torch's glim drain,
  abilities with Fold Step on hotbar key 1, the save codec, store, write-behind and title screen, every Phase 1 stub,
  `features.js`, the check index and `test-world.html`, check-names/content/save/perf, the 10-zone bot session,
  `tools/README.md`). It is the commit that carries this handoff, and `main` is fast-forwarded to it. All six Phase 0
  tags are on GitHub (`p0-0a1` … `p0-0d1`, `p0-done`).
- **Branch:** 0D2 was done locally on `wip/p0-0d2` (its head is `p0-done`). Nothing is half finished.
- **Done:** 0A1, 0A2, 0B, 0C, 0D1, 0D2. Notes with APIs, gate numbers, deviations and verification fixes:
  `docs/sessions/0A1.md` … `0D2.md`. Read `0D2.md` §6 ("what the next session must know") before starting a workstream.
- **Checks:** `node tools/run-all.mjs`, 37 checks, all green (about 2 minutes, 11 at a time; the timed ones,
  `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end). Browser (headless Playwright,
  audio silenced, `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`,
  `browser-silent.mjs`, and with `node tools/serve.mjs 8642` running, `browser-shell.mjs` and `browser-0c.mjs`.
  `tools/README.md` has every command and what each check proves.

## Next step

**Phase 1** (TECH_DESIGN §8.3, ownership §8.4; DECISIONS "Phase 1 workstreams"): WS1-WS10, each in its own worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\<ws>` on a branch `ws/<ws>` made from the tag:
`git worktree add "C:\Users\Otto Mörner\Code\gnomon-wt\<ws>" -b ws/<ws> p0-done`. A workstream edits only its §8.4
files, fills its stubs in place (keep every name `tests/checks/imports.js` freezes; drop `STUB` once a file is built),
replaces its check stub keeping `run(env)`, and puts any change to someone else's file in `docs/<ws>.md` under
"Integration requests". `features.js`, `content/index.js` and `tests/checks/index.js` are never edited after P0. Each
workstream ends the same way as a Phase 0 session: implement → independent verification → fix → recheck → tag.

## Things a workstream should know (local machine)

- **Timing on this laptop:** when the user's ML training job runs, timed checks read 2-3x slow. Before calling a timed
  failure a regression, check the CPU and compare against an older tag in a worktree, run alternately
  (`check-perf --against <ref>` does this itself). Never loosen a budget.
- **Serving the repository:** use `node tools/serve.mjs <port>`. Python's `http.server` (DECISIONS' `gnomon` preview)
  drops part of a boot's ~150 module requests on Windows. The local `.claude/launch.json` (untracked) also has a
  `gnomon-node` preview on port 8131 that runs `serve.mjs`.
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
