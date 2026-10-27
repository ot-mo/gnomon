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

## Public API (as of `p1-ws2a`)

### `gen/terrain.js`: the world functions

- `worldFns(world, seed) → W`, cached per world and seed (the last 4 seeds):
  - `W.heightAt(gx, gy) → int`: ground height above the datum (stand = `FLOOR_Z` + height), at most 12.
  - `W.columnAt(gx, gy) → { height, cliff, tier, water, ground, near }`: `cliff` 1 on a cliff (≥ 5 up, a map wall),
    `tier` 1 or 2 (2: a mesa on a mesa, `content/biomes.js cliffTiers`), `water` 0 / 1 shallow / 2 deep (a river's
    straight channel by an edge), `ground` the terrain's top block, `near` tiles to the nearest port channel or
    landmark footprint.
  - `W.treeAt(cx, cy) → { gx, gy, base, trunk } | null`: the tree of 3×3 world cell (cx, cy); its top leaf
    (`base + trunk + 1`) stays under the zone's roof.
  - `W.portsOf(wx, wy)`, `W.channel(wx, wy, port)`: as below; a port's straight approach in world coordinates.
  - `W.liquidOf(wx, wy) → liquid id`: the span's river's liquid, else its biome's.
- `heightAt(world, seed, gx, gy)`, `treeAt(world, seed, cx, cy)`: uncached.
- `SURFACE_RULES`: the numbers (gen/surface.js re-exports them). `forgetWorldFns(world)`.

### `gen/ports.js`

- `portsOf(world, seed, wx, wy) → [{ side, kind: "road" | "river", edgeId, width, along, liquid? }]` (cached),
  `portTable(world, seed) → (wx, wy) → [port]`, `edgePorts(run, wx, wy) → { n, e, s, w: [{ kind, at, width, edgeId,
  liquid? }] }` (§1.4's shape). A river port's `liquid` is `tile.riverLiquid` of either span (the lower id if both
  say one), else `"water"`, the same from both sides. `forgetPorts(world)`.

### `gen/apron.js`

- `buildApronBand(run, zone, side, neighbour = null, { fresh = false } = {}) → band` (`APRON_BUILDERS.surface`): a copy
  of the neighbour in memory, else from the world functions, kept (the 64 most recent, `APRON_KEEP`; `fresh` builds
  without keeping). A band is never written to: one object may serve every fill.
- `apronBandSteps(run, wx, wy) → iterator`: builds and keeps span (wx, wy)'s world-function bands (the open sides and
  the corners `zones.js neighbourAddr` fills), one per `next()`. `forgetBands(world)`.

### `gen/surface.js`

- `generateSurface(run, wx, wy) → Zone` (no bands built), `surfaceSteps(run, wx, wy)` (the same zone in stages, each
  also building one of its world-function bands, leftovers a stage each), `validateSurface(zone) → string[]`,
  `dungeonRectFor(entrance)`, `forgetWorld(world)` (drops world functions, ports and bands: call it when a world's
  spans change in a run), and the re-exports above, `BIOME_BUILDERS`, `SITE_BUILDERS`.
- A surface zone has `zone.liquid` (one liquid per span), `zone.navigability` (the map's: ground the map draws as a
  wall, 4 or more up, isn't map ground), `zone.ground3d` (ground the map draws as wall: cliff tops, which only 3D can reach and only by a way up a
  builder makes; none in 2a), and `zone.gen.local` (a
  `Uint8Array` w·d: the columns the zone's own features changed from the world functions, which an apron built from
  them doesn't show; not saved).

### `content/biomes.js`

- `BIOMES[biome] = { liquid, cliffTiers }` (2a's fields; 2b adds the builder's), `DEFAULT_BIOME`, `biomeOf(id)`. A
  biome id is a terrain's `biome`, else its id; the test world's `flats` shares the real world's id.

## Integration requests

1. **`save/codec.js` (WS9's, or the integrator's at the merge): save `zone.liquid`.** It isn't in the codec's `AFTER`
   list, so a surface zone read back from the save holds plain water (`liquidAt` falls back to `"water"`): the Brine
   Flats' brine, the Tessellate's ink, the Shade's umbra and the Lattice's turnwater are lost on reload. One string per
   zone.
2. **`world/worldmodel.js compileWorld` (frozen; the integrator): copy a river's `liquid` onto its spans as
   `tile.riverLiquid`** (`link(W.rivers, …)`: `t.riverLiquid = p.liquid ?? null` for every span of the path). The ports
   read it already (`gen/ports.js riverLiquid`, both sides agreeing). Then C1 gives the Inkrun `liquid: "ink"` in
   `content/world/worldmap.js` (bible §15.2: "Slake …; Inkrun [22,22,32]"); until both, every river is plain water.
3. **`zones.js` (the integrator, WS3 #6 with WS9's "prefetch through the loader")**: 3D prefetch through
   `surfaceSteps` now builds a zone's far bands ahead (nothing to change for that). Two paths still build them in the
   swap: a neighbour **read from the save** (`readAhead`: no `surfaceSteps` runs) and one **made on the map**
   (`makeZone` → `generateSurface`). For the first, step `apronBandSteps(game.run, wx, wy)` a band a frame once the
   read lands (in the prefetch update, as a job beside `game.prefetchJob`); the map's needs nothing (time stands still
   between actions there).
4. **Information for WS3 and the integrator**: TRUNK and LEAVES have a map look now (`♠`), so any recorded outdoor
   map frame with a tree in it changes at the merge (golden (b) and the underground frames don't: renderMap reads
   `map` only outdoors). SHALE, CRYSTAL and GLASS show `.` in their colours; REED `¦`.
5. **Information for whoever builds the Lengthening (WS1 or C)**: the world functions, ports and kept apron bands are
   cached per world model; when spans change terrain in a run, call `gen/surface.js forgetWorld(run.world)` before
   any zone is made again (zones already made keep their blocks, as a saved zone would).
6. **Information**: the world model's `elev` (per-span elevation 0-3) is not read: the map draws ground 4 or more blocks
   up as wall (`world.js computeKinds`), so an elevated span would be a sea of walls on the map. All the height the
   map can show is the relief (≤ 3); cliffs and mesas are walls on the map and ground in 3D.

## Handoff

(Written at the 2a tag, for 2b.)
