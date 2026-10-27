# WS2: surface generation

TECH_DESIGN §8.3 "WS2" is the contract (§5.1, §5.3, §5.4, §6.1); DECISIONS overrides it. WS2 owns `gen/surface.js`,
`gen/terrain.js`, `gen/ports.js`, `gen/apron.js`, `gen/biomes/*`, `content/biomes.js`, `content/creatures/wildlife.js`,
the names, colours and `map` looks of the reserved terrain ids in `blocks.js` (new ids only through the integrator),
`tools/check-edges.mjs`, `check-surface.mjs`, `check-landmarks.mjs` and their modules `tests/checks/edges.js`,
`landmarks.js` (owner WS2 in `tests/checks/index.js`) and `surface.js`.

The workstream runs as two sessions in one worktree (`gnomon-wt\ws2`, branch `ws/ws2`): **2a** tags `p1-ws2a`, then
**2b** continues from that tag and tags `p1-ws2b`. Gate numbers go to `docs/sessions/ws2.md`, "Part 2a" and "Part 2b".

## 2a / 2b

### 2a: world functions, ports, water, apron, validation

**Files.** `gen/terrain.js` (the world functions move here from `gen/surface.js`), `gen/ports.js` (ports),
`gen/apron.js` (the band builder and its prefetch stage), `gen/surface.js` (generation and `validateSurface`, now
importing the three), `content/biomes.js` (the world-function and water fields of the table), `blocks.js` (the
`map` looks WS3 #5 asks for), `tests/checks/surface.js` (+ `tools/check-surface.mjs`), `tests/checks/edges.js` and
`landmarks.js` kept green.

**Outputs.**
- `heightAt` with the slope rule (relief that never steps 2 between 4-neighbours), cliffs (a separate world mask, map
  walls) and the flatten mask (fixed landmarks pulled to their datum, inside the world function); `treeAt` (one
  candidate per 3×3 world cell, kept by forest density; a canopy over an edge whole on both sides). DECISIONS' heights:
  standable ground at most 12 above the datum, scenery at most 14 (trees are clipped there, in the zone and the apron
  alike).
- `edgePorts` / `portsOf`: where roads and rivers cross an edge, the same from both spans; a river port carries its
  liquid.
- Surface water by liquid: water sits at the datum on rock (it never drops you a level); one liquid per span
  (`zone.liquid`): a river's own where a river runs, else the biome's (`BIOMES[biome].liquid`), else plain water.
- `APRON_BUILDERS.surface` / `buildApronBand`: a copy of the neighbour when it is in memory, else the world functions;
  the world-function bands of a zone are built during its staged prefetch (one band a stage) and kept, so the edge-swap
  frame finds them made (WS3 #6).
- `validateSurface`: §5.3 item 9 (open edges reachable along half their length, ports, key points, stairs on dry
  ground, holes only in `dungeonRect`, navigability ≥ 90%, unplanned 2-steps ≤ 4) plus the heights (standable ≤ 12,
  scenery ≤ 14) and rock under all surface water; retries re-roll only zone-local features.

**Acceptance (2a).**
1. Seam rules (a)-(e) on every landmark edge and 200 random pairs × 3 seeds (`check-edges`), arrival within ±1.
2. An apron built from the world functions equals the neighbour's generated band in heights and trees on 50 pairs
   (whole 16-deep bands; the neighbour's zone-local features, its road bends, river bends and banks, site and plan
   footprints and sinkholes, are left out and counted).
3. 500 random spans × 3 seeds valid, navigability included (`check-surface`, the real world; `check-landmarks` keeps the
   test world's 500).
4. The slope rule on the world function itself: no 4-neighbour step over 1 outside a cliff, on 3 seeds × 10⁵ columns.
5. Surface generation p95 ≤ 60 ms, max ≤ 150 ms (taken alone, against `p0-done` in alternation, the load recorded).
6. The edge-swap frame: after a staged prefetch the new zone's far bands come from the cache (time of `fillApron`).
7. The old game unchanged: golden (b), the screen frames, the legacy campaign underground, `run-all` green.

### 2b: biomes, landmark stamping, props, wildlife

**Files.** `gen/biomes/*.js` (one builder per biome, `BIOME_BUILDERS`), `content/biomes.js` (the rest of the table:
ground and sub-ground, rocks, ponds, props, light sources, spawn tables, densities), `content/creatures/wildlife.js`
(registered with `registerCreatures`), `gen/surface.js` (calling the builders, the legend handlers, the plateaus).

**Outputs.** A builder for every terrain in `TERRAINS` (and the test world's); legend handlers `tree`, `prop`, `shallow`,
`deep`, `road`, `path`, `rubble`, `station`, `creature` (§5.4); landmark stamping through `stampVault` with roof and wall
height (and WS3 #10, the Gnomon's 14-block voxel foot, if C1's plan doesn't come first); ponds in the biome's liquid;
props; wildlife (bible §15.2 spawn keys, §15.7 glyphs); deliberate 3D-only plateaus (2 blocks up, a jump, a reward each,
at most `RULES.surface.jumpSpots` a zone); zone-local clutter 2 tiles from open edges, per-run sites 6.

**Acceptance (2b).** Every landmark × 5 seeds valid (`check-landmarks`, real-world landmarks too once they have plans);
2a's items still hold with the builders in; wildlife glyphs pass `check-creatures` (no reserved glyph, unique pairs);
screenshots of three biomes in the browser (`?silent=1`, port 8652).

## Public API

(Filled in at the 2a tag.)

## Integration requests

(Filled in as they come.)

## Handoff

(Written at the 2a tag, for 2b.)
