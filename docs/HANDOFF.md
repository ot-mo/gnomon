# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-26, cloud session, after tagging `p0-0a2`.

## State

- **Last tag:** `p0-0a2` (Phase 0 session 0A2: world model, run, sites, surface stub, apron, edges). `main` is
  fast-forwarded to it.
- **Tags not on GitHub yet:** the cloud session's git proxy refuses tag pushes (HTTP 403). Create them from a local
  checkout after `git fetch origin`: `git tag -a p0-0a2 47505d2 -m "Phase 0 session 0A2" && git push origin p0-0a2`.
  Later tags are listed here as they are made.
- **Done:** 0A1 (`p0-0a1`), 0A2 (`p0-0a2`). Notes with APIs, gate numbers and deviations: `docs/sessions/0A1.md`,
  `docs/sessions/0A2.md`.
- **Checks:** `node tools/run-all.mjs`, 9 checks, about 65 s, all green. `tools/browser-gate.mjs` runs the 0A2 browser
  gate headless (audio silenced).

## Next step

Session **0B** (stats, statuses, body, items, currency, time): TECH_DESIGN §8.2 "0B", with the DECISIONS overrides
(glim counter, d20 rules are 0C's). The cloud session continues on branch `wip/p0-0a2-vgrk8n` (the only branch it may push, besides fast-forwarding
`main` at tags). Then 0C, 0D1, 0D2 and tag `p0-done`, each
implement → independent verification → fix → recheck → tag → fast-forward `main`.

## Open items carried forward

- Frame gaps of 46-62 ms at an edge swap and up to 87 ms on prefetch frames in headless Chromium (no GPU); measure in
  a GPU-backed browser in 0D1 before splitting prefetch across frames.
- The real world has no regions yet, so the Hollow Mere compiles as the Glass Sea (C1).
- A 6-row black band at the horizon outdoors (rays that miss below it): WS3's horizon plane.
- Thrown things stop at a zone's border; prefetch is skipped while `ZONE_LOADER.load` is set (WS9 must prefetch through
  the loader).
