# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, cloud session, after tagging `p0-0c`.

## State

- **Last tag:** `p0-0c` (Phase 0 session 0C: creatures and people as one list, ai.js, light.js, d20 combat, talk.js). `main` is
  fast-forwarded to it.
- **Tags not on GitHub yet:** the cloud session's git proxy refuses tag pushes (HTTP 403). Create them from a local
  checkout after `git fetch origin`:
  - `git tag -a p0-0a2 47505d2 -m "Phase 0 session 0A2" && git push origin p0-0a2`
  - `git tag -a p0-0b 2e53dd6 -m "Phase 0 session 0B" && git push origin p0-0b`
  - `git tag -a p0-0c 313ec3e -m "Phase 0 session 0C" && git push origin p0-0c`
- **Done:** 0A1, 0A2, 0B, 0C. Notes with APIs, gate numbers, deviations and verification fixes: `docs/sessions/0A1.md`,
  `0A2.md`, `0B.md`, `0C.md`.
- **Checks:** `node tools/run-all.mjs`, 19 checks, about 90 s, all green. `tools/browser-gate.mjs` runs the 0A2 browser
  gate headless (audio silenced).
- **The purse in the test world:** the test world (which carries the parent game's prices) starts you with the 1,000
  purse (`TEST_WORLD.startPurse`); worlds without one start with the 200 purse. Legacy crystal prices grow by ×1.5 each,
  so very late they can still pass 1,000; balance (C2/WS6b) decides the old game's economy for good.

## Next step

Session **0D1** (the shell: screens, keys, ui.js, game.js reduced, HUD segments, map overlays): TECH_DESIGN §8.2 "0D1".
The cloud session continues on branch `wip/p0-0a2-vgrk8n` (the only branch it may push, besides fast-forwarding `main`
at tags). Then 0D2 and tag `p0-done`.

## Open items carried forward

- From 0B (details in `docs/sessions/0B.md` §5): the torch drain
  waits for 0D2's clock; the map legend still says "gold" (golden (b) frames show it).
- Frame gaps of 46-62 ms at an edge swap and up to 87 ms on prefetch frames in headless Chromium (no GPU); measure in
  a GPU-backed browser in 0D1 before splitting prefetch across frames.
- The real world has no regions yet, so the Hollow Mere compiles as the Glass Sea (C1).
- A 6-row black band at the horizon outdoors (rays that miss below it): WS3's horizon plane.
- Thrown things stop at a zone's border; prefetch is skipped while `ZONE_LOADER.load` is set (WS9 must prefetch through
  the loader).
- From 0C: `tools/browser-gate.mjs` seed 31 fails "3D: the camera popped" more often at `p0-0c` (5 of 10 runs) than at
  `p0-0b` (1 of 9): a long frame at the edge swap. Measure 3D frame time against `p0-0b` in 0D1 (its gate has frame
  time within 5%), and make the pop test judge movement per unit of frame time.
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly (the code is right today).
