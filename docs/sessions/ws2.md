# Workstream WS2: surface generation

Phase 1 workstream WS2 (TECH_DESIGN §5.1, §5.3, §6.1, §8.3 "WS2", files §8.4; DECISIONS' heights, liquids and glyphs),
on branch `ws/ws2` from `p0-done`, in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws2`, on the local machine
(Windows 11, Node 20.11.0, headless Chromium from Playwright) while WS9, WS10 and the integrator ran on the same CPU.
It runs as two sessions: 2a (this part) and 2b. The split, the public API, the integration requests and the handoff
are in `docs/ws2.md`.

## Part 2a: world functions, ports, water, apron, validation

| Commits | What |
|---|---|
| `216605b` | The 2a / 2b split (`docs/ws2.md`) |
| `4363c7b` | The world functions, ports and band builder move into `gen/terrain.js`, `gen/ports.js`, `gen/apron.js`, bit for bit |
| `1bd8d96` | Stacked cliffs, the 12-block ceiling, tree heights, liquids by span; `validateSurface` under the map's rules, water on rock |
| `ad9fcb7` | WS3 #5: map looks for SHALE, TRUNK, LEAVES, REED (and CRYSTAL, GLASS) |
| `42f15cb` | WS3 #6: kept world-function bands, built during the staged make |
| `ebae3d6` `a89459c` `fae46f5` | `check-surface`; `zone.gen.local`; `forgetWorld`; real-world pairs in `check-edges` |
| `f246775` | The handoff for 2b |
| `7083c6f` `28c3560` `4dbd706` `3c3f7dc` `de2c8f6` | The verification's four findings, one commit each (§4), and a doc line |

### 1. What was built

| Part | Where |
|---|---|
| The world functions: relief (the slope rule), cliffs with a second tier where the biome stacks them (the Rust Steps' mesas, only in their own spans, always on a ledge), rivers' channels and banks, the landmark flatten mask, the 12-block ceiling; trees whose top leaf stays in the zone; the span's liquid | `gen/terrain.js` |
| Ports, the same from both spans, a river port carrying its liquid; `edgePorts` in §1.4's shape | `gen/ports.js` |
| The band builder; world-function bands kept (64), built a band a stage by the staged make; `{ fresh }` for checks | `gen/apron.js` |
| `zone.liquid`; the roads' hub off cliffs; `zone.gen.local` (the columns the zone's own features change); `validateSurface` with the map's navigability, water at the datum on rock, roads never on map walls; `surfaceSteps` building bands; `forgetWorld` | `gen/surface.js` |
| Biome data for 2a (liquid, cliffTiers), `biomeFor` (only the real world's terrains) | `content/biomes.js` |
| Map looks of the reserved terrain blocks | `blocks.js` |
| The 2a acceptance check; real-world pairs in the seam check | `tests/checks/surface.js`, `tools/check-surface.mjs`, `tests/checks/edges.js`, `tools/check-edges.mjs` |

### 2. Gate (docs/ws2.md "2a" acceptance)

**`node tools/run-all.mjs`: 37 of 37** at `de2c8f6` (137.3 s, 11 at a time, three workstreams on the machine). Golden: 86
mechanics steps, 27 frames, 95 dungeon levels, 28 vault stamps, the temple on 2 seeds, 0 mismatched;
`check-screen-frames`, `check-legacyfights` (1359 map steps, 0 differing), `check-save`, `check-bot` pass.

1. **Seams** (`check-edges`): every landmark edge of the test world and 200 random pairs × seeds 1, 42, 1234 (all the
   rules a-e), the real world's landmark edges (seed 42, a-d) and, new, 100 random real-world pairs (seed 1234, a-e):
   790 edges, 50,336 seam tiles over 1,247 zones, 53 ports, 1,716 trees across an edge; 100,672 apron tiles beside a
   seam compared; 98,721 crossings, 0 shifted, 98.3% on the mirrored tile, 97,052 3D points kept; border tiles left
   out: 1,931 the anchor can't reach (cliff tops), 0 treetops. 82 s in run-all.
2. **The apron from the world functions equals the neighbour's generated band** (`check-surface`): 50 pairs a seed ×
   3 seeds, 150 pairs (48 corners), whole 16-deep bands, every voxel: 112,640 band columns, 1,800,448 voxels equal;
   112 columns (0.10%) left out as the neighbour's own features (`zone.gen.local`), all 112 really different (the
   mask hides nothing that matches); 16 of 18 decoys (the neighbour of another seed) told apart (the other two are
   flat, bare ground every seed shares). The verification compared every pair of every zone of both worlds × 3
   seeds (about 4.0M band columns a world and seed): 0 differences outside `gen.local`.
3. **500 random spans × 3 seeds valid** (`check-surface`, the real world): 1,500 zones, 0 needed a retry, 60 made
   twice the same; map navigability min 95.1%, p5 100%, mean 100%; ground the map draws as wall (cliff tops) 14
   columns a zone on average. The test world's 500 (`check-landmarks`): 0 failed, navigability min 100%, 15 landmark
   zones on 5 seeds with 0 retries. Before 2a, seed 1's (20, 11) in the Teeth failed after 10 attempts at 89.1%
   (only its cliff tops unreached).
4. **The slope rule on the world function**: 10⁵ random columns a seed × 3 (`check-surface`): 600,000 steps, 0 over 1
   without a cliff or water, 0 cliff feet under 4, 0 ground over 12, highest 12, 66 columns on stacked mesas (0
   outside a stacking biome, 0 beside unraised ground), 4,127 trees, 0 too tall. The verification ran every column of
   both worlds × 3 seeds (3.39M and 3.07M a seed): the same.
5. **Surface generation p95 ≤ 60 ms, max ≤ 150 ms.** `check-surface --budget` alone (load 66%, no training job):
   p50 13.46, p95 22.22, max 141.72 ms over 1,500 real-world zones. Against `p0-done`, both trees in one process, span
   by span in alternating order, 2 reps over 350 spans of both worlds (`git archive p0-done` in the scratchpad):
   p50 16.1 / 15.8, p95 25.9 / 24.8, max 164.2 / 118.0, mean 18.10 / 17.58 ms here against 16.0 / 15.7, 26.2 / 24.4,
   90.0 / 112.7, 17.68 / 17.49 at `p0-done` (load 50%, then 14%). The 164 ms is one sample in 700 that the second run
   didn't repeat; the verification's own alternation (300 spans a seed) found maxima over 150 ms in both trees, the
   first cold make of landmark spans with a dungeon (`landingFloor` generates level 1). `check-perf` alone: PASS
   (gen.surface p95 42.3 ms, ×1.38 of `p0-0d1`'s 30.6 in that run, within budget; max 130.0).
6. **The edge-swap frame** (WS3 #6): a zone's world-function bands take p50 3.42 / p95 10.03 ms cold and 0.01 / 0.03
   ms after its staged make (`check-surface`, 60 zones, all the same bits as fresh ones). In the browser
   (`browser-gate`, SwiftShader): the swap frame 26.5-44 ms over two seeds, the prefetch's 7 staged frames 20-41 ms
   (median frame 17.6-25.6 ms under load).
7. **The old game unchanged**: every test-world zone of seeds 1, 42, 1234 (2,097) has the same blocks, spawn,
   entrance and attempts as at `p0-done` (the verification, one process with both trees), except the three road spans
   whose hub sat on a cliff (§4, finding 1). Golden (a) and (b), the screen frames and the legacy fights hold.
   Browser: `browser-0d1 --against p0-done` PASS (every mode by keys and mouse at 1280×720 and 600×300; the HUD at
   100×30; golden frames underground in the browser, 27, 0 mismatched; frame time under/3d +1.0%, under/map +2.7%,
   surface/3d −0.5%, surface/map +1.6%); `browser-gate` PASS on seeds 1234 and 7 (no console error, audio silenced);
   `browser-0d2` PASS (both boots, every browser-capable check in a page, `surface` included); `browser-shell` and
   `browser-0c` PASS against `node tools/serve.mjs 8652`; `browser-silent` PASS.

### 3. Deviations from the design, with reasons

1. **Navigability is measured by the map's rules**, as §5.3 item 9 words it: ground the map draws as a wall (4 or
   more blocks up, `world.js computeKinds`) is not map ground and is never walked over. Cliff tops are counted apart
   (`zone.ground3d`). Before, they counted as ground nobody could reach, which failed zones for terrain the world
   function put there (and no retry can change).
2. **No per-span elevation** (`tile.elev`): the map shows ground 4 or more up as wall, so an elevated span would be a
   sea of walls; the relief (≤ 3) is all the height the map can show.
3. **Stacked cliffs** (`cliffTiers: 2`, the Rust Steps: bible §4.4's "mesas up to 12 blocks") are a world-function
   addition of 2a, not in §5.3. Their second tier changes at the span's border instead of blending (a world function
   may change there: both sides compute it).
4. **One liquid per span** (DECISIONS: "one per tile"): a river's span holds the river's liquid everywhere, others
   their biome's. A river carries its liquid through `tile.riverLiquid`, which `compileWorld` doesn't set yet
   (integration request 2); until then every river is plain water.
5. **Map looks**: §6.5's `♣` (trunk) and `^` (rock) are bible §15.7's speaking trees and spikes, so a trunk and leaves
   are `♠` and shale is `.`.
6. **The edge-swap bands are built in the staged make, not in `zones.js`**: no frozen file changes; zones read from the
   save still build them in the swap (integration request 3).

### 4. Verification and fixes

An independent reviewer (a fresh agent given the code and the contract, not this session's conclusions) reran the
gate (37 of 37, `check-surface --budget`, `check-edges`, `check-landmarks` alone), ran every column and every zone of
both worlds × 3 seeds, thrashed the caches under staged makes (80 makes, every zone equal to `generateSurface`, 640
kept bands equal to fresh ones), checked R6, the corner rule against `zones.js neighbourAddr`, that bands are never
written, map reach ⊆ 3D reach, and the edge-keep of `gen.local`. It found no bug WS2a introduced; four findings, each
fixed in its own commit with a test that fails without the fix:

1. **A road could climb a cliff** (`7083c6f`; inherited from P0): a span without a site took its centre as the
   roads' hub, and on a cliff `carve` ramped the road up it (map walls at 4-6; test world seed 3 (33, 4), 20 (31, 8),
   42 (27, 8); 3 of 2,700 road spans over seeds 1-60, none in the real world). The hub moves to the nearest plain
   ground; `validateSurface` fails a road on a map wall. Without the move: "hub (40, 24) cliff 1 … 5-7 road columns
   the map draws as wall" on all three.
2. **Rivers of two liquids meeting would mix a seam** (`3c3f7dc`; latent, no such data): `check-surface` fails a
   real-world span with river ports of two liquids, and integration request 2 says so.
3. **The test world's liquids** (`28c3560`): its fixture `flats` shares the real world's id, so 603 of 2,097 test
   zones (the temple's start span too) held brine. `biomeFor` gives biome data only to the real world's terrains.
   Without it: "201 spans hold another liquid than water, (0, 0) brine".
4. **Stacked mesas past the Rust Steps and straight out of the plain** (`4dbd706`): the second tier blended into
   neighbouring spans (24 non-Steps zones over 3 seeds) and rose 10-12 blocks beside unraised ground where the first
   ring was thin (68 / 105 / 103 places). Tier 2 takes the span's own value and needs four raised neighbours. Without
   it: "a stacked mesa in downs", "straight out of the plain".

### 5. Recheck before the tag

`node tools/run-all.mjs` 37 of 37 at `de2c8f6`; `check-surface --budget` alone PASS; `check-perf` alone PASS; the
alternating timing against `p0-done` level (§2 item 5); `browser-gate` and `browser-0d2` PASS on the final code.

### 6. Known issues (for 2b and the integrator)

- Cliff tops have no way up in either view yet (14 columns a zone on average): 2b's ramps and climbs (`docs/ws2.md`
  "Handoff").
- `zone.liquid` isn't saved (request 1); rivers carry plain water until `compileWorld` copies their liquid (request 2).
- Zones read from the save, and zones made on the map, still build their world-function bands in the swap (request 3).
- `check-perf`'s `gen.surface.max` is a single sample: it swings 130-290 ms on this machine at `p0-done` itself.
