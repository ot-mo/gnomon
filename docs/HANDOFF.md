# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, cloud session, after implementing 0D1 (not yet verified or tagged).

## State

- **Last tag:** `p0-0c` (Phase 0 session 0C: creatures and people as one list, ai.js, light.js, d20 combat, talk.js). `main` is
  fast-forwarded to it.
- **Tags not on GitHub yet:** the cloud session's git proxy refuses tag pushes (HTTP 403). Create them from a local
  checkout after `git fetch origin`:
  - `git tag -a p0-0a2 47505d2 -m "Phase 0 session 0A2" && git push origin p0-0a2`
  - `git tag -a p0-0b 2e53dd6 -m "Phase 0 session 0B" && git push origin p0-0b`
  - `git tag -a p0-0c 313ec3e -m "Phase 0 session 0C" && git push origin p0-0c`
- **Done:** 0A1, 0A2, 0B, 0C (tagged); **0D1 implemented** on `wip/p0-0a2-vgrk8n` (last commit before these notes:
  `5ad4acd`), its gate green, **not yet independently verified or tagged**. Notes with APIs, gate numbers, deviations
  and verification fixes: `docs/sessions/0A1.md`, `0A2.md`, `0B.md`, `0C.md`, `0D1.md`.
- **Checks:** `node tools/run-all.mjs`, 21 checks, about 95 s, all green. Browser (headless, audio silenced; needs
  `NODE_PATH=$(npm root -g)`): `tools/browser-0d1.mjs` (the 0D1 gate: every mode by keys and clicks, the HUD at
  100×30, golden frames in the browser, frame time against `p0-0c`), `tools/browser-gate.mjs` (0A2), and with a
  `python3 -m http.server 8642` running, `tools/browser-0c.mjs` and `tools/browser-shell.mjs`.
- **The purse in the test world:** the test world (which carries the parent game's prices) starts you with the 1,000
  purse (`TEST_WORLD.startPurse`); worlds without one start with the 200 purse. Legacy crystal prices grow by ×1.5 each,
  so very late they can still pass 1,000; balance (C2/WS6b) decides the old game's economy for good.

## Next step

**Verify 0D1** independently and sceptically (CLAUDE.md): rerun `node tools/run-all.mjs` and
`tools/browser-0d1.mjs` (several times: its frame-time figure moves ±2-3% between runs), play the old game in both views
looking for regressions in every screen (inventory, talk and shop, journal, level-up, pause, death, the cube), try to
break `docs/sessions/0D1.md`'s claims; one commit per finding; then tag `p0-0d1` and fast-forward `main` to it. Then
session **0D2** (TECH_DESIGN §8.2) and tag `p0-done`. The cloud session continues on branch `wip/p0-0a2-vgrk8n` (the only
branch it may push, besides fast-forwarding `main` at tags).

## Open items carried forward

- From 0B (details in `docs/sessions/0B.md` §5): the torch drain
  waits for 0D2's clock; the map legend still says "gold" (golden (b) frames show it).
- Frame gaps at an edge swap: measured in 0D1 (headless, no GPU): the swap frame no longer prefetches and a surface
  zone is made in 8 stages (0-8.5 ms each); the swap frame is still 31-98 ms headless (the apron rebuild and the first
  draw in the new zone). Measure once in a GPU-backed browser locally.
- The real world has no regions yet, so the Hollow Mere compiles as the Glass Sea (C1).
- A 6-row black band at the horizon outdoors (rays that miss below it): WS3's horizon plane.
- Thrown things stop at a zone's border; prefetch is skipped while `ZONE_LOADER.load` is set (WS9 must prefetch through
  the loader).
- Resolved in 0D1: the seed-31 "camera popped" flake (prefetch in the swap's frame; the test now judges speed per dt;
  frame time is level with p0-0b and p0-0c).
- From 0D1: 0D2's save codec must skip `game.prefetchJob`/`prefetchSeen` and the mode stack's callbacks.
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly (the code is right today).
