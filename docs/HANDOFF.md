# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, cloud session, 0B implemented (not yet verified or tagged).

## State

- **Last tag:** `p0-0a2` (Phase 0 session 0A2: world model, run, sites, surface stub, apron, edges). `main` is
  fast-forwarded to it.
- **Tags not on GitHub yet:** the cloud session's git proxy refuses tag pushes (HTTP 403). Create them from a local
  checkout after `git fetch origin`: `git tag -a p0-0a2 47505d2 -m "Phase 0 session 0A2" && git push origin p0-0a2`.
  Later tags are listed here as they are made.
- **Done:** 0A1 (`p0-0a1`), 0A2 (`p0-0a2`). Notes with APIs, gate numbers and deviations: `docs/sessions/0A1.md`,
  `docs/sessions/0A2.md`.
- **0B implemented** on `wip/p0-0a2-vgrk8n` (rules, stats, status, time, body, items registry, currency; notes in
  `docs/sessions/0B.md`, every gate item green with its numbers). Not yet independently verified, so not tagged.
- **Checks:** `node tools/run-all.mjs`, 13 checks, about 75 s, all green (`check-stats` holds the whole 0B gate).
  `tools/browser-gate.mjs` runs the 0A2 browser gate headless (audio silenced).

## Next step

Verify session **0B** (TECH_DESIGN §8.2 "0B", DECISIONS overrides): rerun the gate (`node tools/run-all.mjs`, the
`gate` line of `check-stats`, `NODE_PATH=$(npm root -g) node tools/browser-gate.mjs`), look for regressions in the old
game (shop, shrines, rewards, pickups in both views), try to break the claims in `docs/sessions/0B.md`; fix (one
commit per finding), recheck, tag `p0-0b`, fast-forward `main`. The cloud session continues on branch
`wip/p0-0a2-vgrk8n` (the only branch it may push, besides fast-forwarding `main` at tags). Then 0C, 0D1, 0D2 and tag
`p0-done`.

## Open items carried forward

- From 0B (details in `docs/sessions/0B.md` §5): legacy prices deep down outgrow the 200-glim purse; the torch drain
  waits for 0D2's clock; the map legend still says "gold" (golden (b) frames show it).
- Frame gaps of 46-62 ms at an edge swap and up to 87 ms on prefetch frames in headless Chromium (no GPU); measure in
  a GPU-backed browser in 0D1 before splitting prefetch across frames.
- The real world has no regions yet, so the Hollow Mere compiles as the Glass Sea (C1).
- A 6-row black band at the horizon outdoors (rays that miss below it): WS3's horizon plane.
- Thrown things stop at a zone's border; prefetch is skipped while `ZONE_LOADER.load` is set (WS9 must prefetch through
  the loader).
