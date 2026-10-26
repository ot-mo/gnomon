# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, cloud session, after tagging `p0-0d1`. **Handed to the local machine for 0D2.**

## State

- **Last tag:** `p0-0d1` (Phase 0 session 0D1: screens, keys, ui.js, game.js reduced, HUD segments, map registries,
  staged prefetch). `main` is fast-forwarded to it.
- **Branch:** the cloud session worked on `wip/p0-0a2-vgrk8n` (the only branch it could push). Its head is `main` plus
  this handoff. Locally, **don't use the old local `wip/p0-0a2`** (it stops at the start of 0A2). Start 0D2 on a new
  branch from the tag: `git fetch origin --tags && git checkout -b wip/p0-0d2 origin/wip/p0-0a2-vgrk8n`.
- **Tags not on GitHub yet** (the cloud proxy refused tag pushes). Create and push them locally first:
  - `git tag -a p0-0a2 47505d2 -m "Phase 0 session 0A2" && git push origin p0-0a2`
  - `git tag -a p0-0b 2e53dd6 -m "Phase 0 session 0B" && git push origin p0-0b`
  - `git tag -a p0-0c 313ec3e -m "Phase 0 session 0C" && git push origin p0-0c`
  - `git tag -a p0-0d1 15acae2 -m "Phase 0 session 0D1" && git push origin p0-0d1`
- **Done:** 0A1, 0A2, 0B, 0C, 0D1. Notes with APIs, gate numbers, deviations and verification fixes:
  `docs/sessions/0A1.md` … `0D1.md`. Read 0D1.md §6 ("what 0D2 must know") before starting.
- **Checks:** `node tools/run-all.mjs`, 22 checks, all green; since the handoff it runs them side by side (48 s on 4
  cores, about 100 s before; `--jobs 1` for one at a time). Browser (headless Playwright, audio silenced; needs
  `NODE_PATH=$(npm root -g)`): `tools/browser-0d1.mjs`, `tools/browser-gate.mjs`, and with a `python3 -m http.server
  8642` running, `tools/browser-0c.mjs` and `tools/browser-shell.mjs`. Locally, DECISIONS.md's built-in browser pane
  works too.
- **The purse in the test world:** the test world (which carries the parent game's prices) starts you with the 1,000
  purse (`TEST_WORLD.startPurse`); worlds without one start with the 200 purse. Legacy crystal prices grow by ×1.5 each,
  so very late they can still pass 1,000; balance (C2/WS6b) decides the old game's economy for good.

## Next step

Session **0D2** (TECH_DESIGN §8.2 "0D2": abilities API with one sample ability on the hotbar in both views and the
`requestTarget` stub; `clock.js` over `state.time` with `catchUp`, and with it the torch's glim drain from DECISIONS;
`save/codec.js`, `store.js` memory adapter, snapshot-first saves and write-behind on `zone:leave`; `screens/title.js` (New
quick game / Continue); `config.js` flags and the `?silent=1` audio sink; `features.js` and every Phase 1 workstream's
stub index and stub files with frozen signatures (§8.3, ownership §8.4); `tests/checks/index.js` with one stub per
workstream; `test-world.html`; `check-names` (bible §15.11 plus `dram`, `parasang`), `check-content` skeleton,
`check-save`, `check-perf` skeleton; the bot to 10 zones; `tools/README.md`). Gate: save → load → canonical JSON
identical after a 10-zone bot session, Run data included; every stub imports in Node and the browser; `run-all` green.
Then tag `p0-done` and fast-forward `main`. Phase 1 starts from `p0-done`.

**How:** the same process as every earlier session: implement in steps (a commit and push each) → three independent,
read-only verifiers (gate, the real game in both views, spec plus code) → fix (one commit per finding, each with a check
that fails without it) → recheck → tag. `tools/workflows/p0-session.js` is the workflow that ran 0B-0D1 (pass
`branch: "wip/p0-0d2"` and a local `scratch` folder). **Cap browser benchmarks at about 3 minutes** (enough frames for a
stable p50/p95; 0D1's 15-minute comparison runs were the slowest part of the session).

**Things for 0D2 to settle:** the save codec must skip `game.prefetchJob`/`prefetchSeen` and the mode stack's callbacks
(0D1); `entityCounter` must be saved (0C); a load calls `restoreRun`, never `buildRun` (0A2). One 0D1 item needs a real
browser: Esc closing a screen over 3D when the browser refuses the lock request (`0D1.md` §7). Also measure the edge-swap
frame (40-80 ms headless, no GPU) on the real GPU once.

## Open items carried forward

- From 0B (details in `docs/sessions/0B.md` §5): the torch drain
  waits for 0D2's clock; the map legend still says "gold" (golden (b) frames show it).
- Frame gaps at an edge swap: measured in 0D1 (headless, no GPU): the swap frame no longer prefetches and a surface
  zone is made in 8 stages (0-8.5 ms each); the swap frame is still 40-80 ms headless on seeds 1234/7, as at p0-0c
  (the apron rebuild and the first draw in the new zone). Measure once in a GPU-backed browser locally.
- The real world has no regions yet, so the Hollow Mere compiles as the Glass Sea (C1).
- A 6-row black band at the horizon outdoors (rays that miss below it): WS3's horizon plane.
- Thrown things stop at a zone's border; prefetch is skipped while `ZONE_LOADER.load` is set (WS9 must prefetch through
  the loader).
- Resolved in 0D1: the seed-31 "camera popped" flake (prefetch in the swap's frame; the test now judges speed per dt;
  frame time is level with p0-0b and p0-0c).
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly (the code is right today).
