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
1. Seam rules (a)-(e) on every landmark edge and 200 random pairs × 3 seeds (`check-edges`, the test world), arrival
   within ±1; and 100 random pairs of the real world (its terrains, the stacked mesas).
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
  builder makes: 2a's own features make none, though a landmark plan may, Kettle Mesa's on seed 1), and `zone.gen.local` (a
  `Uint8Array` w·d: the columns the zone's own features changed from the world functions, which an apron built from
  them doesn't show; not saved).

### `content/biomes.js`

- `BIOMES[biome] = { liquid, cliffTiers }` (2a's fields; 2b adds the builder's), `DEFAULT_BIOME`, `biomeOf(id)`,
  `biomeFor(world, tile)` (what the world functions read: the tile's biome data when its terrain is the real world's,
  `content/world/terrains.js`, else the defaults, so the test world's fixture terrains, whose `flats` shares an id,
  keep plain water and single cliffs). A biome id is a terrain's `biome`, else its id.

## Integration requests

1. **`save/codec.js` (WS9's, or the integrator's at the merge): save `zone.liquid`.** It isn't in the codec's `AFTER`
   list, so a surface zone read back from the save holds plain water (`liquidAt` falls back to `"water"`): the Brine
   Flats' brine, the Tessellate's ink, the Shade's umbra and the Lattice's turnwater are lost on reload. One string per
   zone.
2. **`world/worldmodel.js compileWorld` (frozen; the integrator): copy a river's `liquid` onto its spans as
   `tile.riverLiquid`** (`link(W.rivers, …)`: `t.riverLiquid = p.liquid ?? null` for every span of the path). The ports
   read it already (`gen/ports.js riverLiquid`, both sides agreeing). Then C1 gives the Inkrun `liquid: "ink"` in
   `content/world/worldmap.js` (bible §15.2: "Slake …; Inkrun [22,22,32]"); until both, every river is plain water.
   One rule for that data: rivers of two liquids must never meet in a span (one liquid per span: the span would hold
   one and the other river would change liquid at its edge); `check-surface` fails such a span.
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

**For WS2b** (written at `p1-ws2a`). Branch `ws/ws2` in the worktree `gnomon-wt/ws2`; 2a is tagged `p1-ws2a` and its
numbers are in `docs/sessions/ws2.md` "Part 2a". Nothing is half finished. The integrator merges `p1-ws2a` on its
own (the requests above); 2b tags `p1-ws2b` on the same branch.

**The exact next step:** call the biome builders. `gen/surface.js buildSurface` doesn't call `BIOME_BUILDERS` yet:
give it a step after the trees (6) and before the plan (7), `BIOME_BUILDERS[tile.biome]?.(ctx)`, with §1.4's ctx
(`run, zone, tile, rng, level, heightAt(x, y), groundZ(x, y), reserve, reserved, carve, placeCreature, placeItem,
ports, margin`) built from what `buildSurface` already holds (`H`, `water`, `road`, `reserved`, `plan`, `scenery`,
`local`, `hub`, `keep`). Then the builders, one file each in `gen/biomes/`, with their data in `content/biomes.js`
(keep `liquid` and `cliffTiers` there; add the rest beside them).

**What a builder must keep, or a check fails:**
- Draw only from `ctx.rng` (R6; `check-determinism`, `check-surface`'s "twice the same").
- Keep 2 tiles from open edges (`keep(x, y)`; `check-edges` rule e) and per-run sites 6.
- Mark every column it changes in `zone.gen.local`, or `check-surface`'s apron comparison fails there (it compares
  every voxel of 16-deep bands with the neighbour's blocks outside that mask). Not marking is caught; marking too
  much isn't, so mark only what you change (the check reports how many left-out columns really differ: all of them
  in 2a).
- Ponds: at the datum, on rock, in `zone.liquid` (the span's one liquid; a river's span keeps the river's).
  `validateSurface` fails water off the datum or without rock under it.
- Navigability is the map's: ground 4 or more blocks up is a map wall (`world.js computeKinds`), not map ground.
  Anything a builder raises to 4 or more is a wall on the map. Unplanned 2-block steps are capped at 4 a zone:
  give `validateSurface`'s step counter a `gen.planned` mask for the plateaus' and ramps' faces (as it skips
  `g.cliff` and `g.plan`).

**Open items for 2b:**
- **A way up the cliffs.** Cliff tops (5 up, the Rust Steps' mesas 10) have no way up in either view:
  `zone.ground3d` counts them, about 14 columns a zone on average. The bible's Steps ("ledges and sheer drops",
  "houses cut into a mesa's ledges … joined by ladders and ramps", "the map shows one layer, 3D shows four")
  want ramps or climbs, 2 tiles from edges, marked local and planned. On the map a ramp ends at a wall (height
  4), so a mesa top is 3D-only ground: one of the views mattering.
- **The 3D-only plateaus** (§5.3 item 8): 2 blocks up, a jump, a reward each, at most `jumpSpots` a zone (there is no
  `RULES.surface`; put the number in `SURFACE_RULES`, gen/terrain.js).
- **Legend handlers** (§5.4): `tree`, `prop`, `shallow`, `deep`, `road`, `path`, `rubble`, `station`, `creature`
  through `registerLegend` (gen/vaults.js; it throws on a duplicate).
- **WS3 #10**, the Gnomon's 14-block voxel foot at span (37, 3), if C1's plan for it doesn't come first (render3d starts
  the needle on whatever stands at the span's middle). 14 blocks is scenery's ceiling (DECISIONS).
- **Wildlife**: `content/creatures/wildlife.js`, registered with `creatures.js registerCreatures` (say from
  `gen/biomes/index.js`, which `gen/surface.js` imports); glyphs by bible §15.7 (`check-creatures`).
- `check-landmarks` for the real world's landmarks × 5 seeds once they have plans (C1's), and screenshots of three
  biomes (`node tools/serve.mjs 8652`, `?silent=1`).

**Things worth knowing:**
- The map can't show height: ground 4 or more up is a wall glyph, so per-span elevation (`tile.elev`) is unread, and
  any raised feature is a wall on the map.
- World-function bands are kept (`gen/apron.js`, 64): a band is shared by every zone fill, so never write into one.
  `forgetWorld(world)` drops all kept state (world functions, ports, bands).
- Timing on this machine: other workstreams and the user's training job share the CPU. `check-perf`'s
  `gen.surface.max` is one sample and swings 130-290 ms at `p0-done` itself. For a fair comparison time both trees in
  one process, span by span in alternating order (`docs/sessions/ws2.md` "Part 2a" says how), with
  `git archive p0-done` unpacked in the scratchpad.
- A worktree made from `p0-done` carries DECISIONS' older "Browser checks" text naming Python's server: use
  `node tools/serve.mjs <port>`.
