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

## Public API (as of `p1-ws2b`)

### `gen/terrain.js`: the world functions

- `worldFns(world, seed) → W`, cached per world and seed (the last 4 seeds):
  - `W.heightAt(gx, gy) → int`: ground height above the datum (stand = `FLOOR_Z` + height), at most 12.
  - `W.columnAt(gx, gy) → { height, cliff, tier, water, ground, sub, near }`: `cliff` 1 on a cliff (≥ 5 up, a map wall),
    `tier` 1 or 2 (2: a mesa on a mesa, `content/biomes.js cliffTiers`), `water` 0 / 1 shallow / 2 deep (a river's
    straight channel by an edge), `ground` the terrain's top block, `sub` the biome's sub-ground (what a raised
    column is made of from the datum's layer up; rock below that), `near` tiles to the nearest port channel or
    landmark footprint.
  - `W.treeAt(cx, cy) → { gx, gy, base, trunk } | null`: the tree of 3×3 world cell (cx, cy); its top leaf
    (`base + trunk + 1`) stays under the zone's roof.
  - `W.portsOf(wx, wy)`, `W.channel(wx, wy, port)`: as below; a port's straight approach in world coordinates.
  - `W.liquidOf(wx, wy) → liquid id`: the span's river's liquid, else its biome's.
- `heightAt(world, seed, gx, gy)`, `treeAt(world, seed, cx, cy)`: uncached.
- `SURFACE_RULES`: the numbers (gen/surface.js re-exports them), 2b's `siteMargin` 6, `jumpSpots` 2, `plateauRise` 2.
  `forgetWorldFns(world)`.

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
  also building one of its world-function bands, leftovers a stage each; 2b adds a "biome" stage), `validateSurface(zone)
  → string[]`, `dungeonRectFor(entrance)`, `forgetWorld(world)` (drops world functions, ports and bands: call it when a
  world's spans change in a run), `stampPlan(zone, plan, ox, oy, rng) → { spawn, keyPoints }` (a landmark plan through
  `stampVault` with its `roof`, `wallHeight`, `props`, `creatures`, `rubble`, and its trees' canopies), and the
  re-exports above, `BIOME_BUILDERS`, `TEST_BUILDERS`, `builderFor`, `SITE_BUILDERS`.
- The order of a zone's make (2b): world layer, footprint, hub, rivers, roads, ground, the biome's clearings, trees,
  **the biome's dressing** (`builderFor(world, tile)(ctx)`), the landmark's plan or its builder (`LANDMARK_BUILDERS`,
  while it has no plan) or the site, the dungeon's sinkholes, the anchor, validation, and last **the wildlife**
  (`populate`, on the map reach validation measured; none in a settlement's span, `SETTLED_KINDS`).
- A surface zone has `zone.liquid` (one liquid per span), `zone.navigability` (the map's: ground the map draws as a
  wall, 4 or more up, isn't map ground), `zone.ground3d` (ground the map draws as wall: cliff tops, which only 3D can reach and only by a way up a
  builder makes: 2a's own features make none, though a landmark plan may, Kettle Mesa's on seed 1), and `zone.gen.local` (a
  `Uint8Array` w·d: the columns the zone's own features changed from the world functions, which an apron built from
  them doesn't show; not saved). 2b adds to `zone.gen` (not saved): `planned` (faces of 2 or more that are meant:
  ramps, plateaus, posts; validation's step count skips them), `jump` (a plateau's top: 3D's ground, counted in
  `zone.ground3d`), `footprint` (a site's rect and skirt), and the lists `plateaus` `[{ x, y, w, d, z, stone, reward }]`,
  `ramps` `[{ top, foot, steps }]`, `caches` `[{ x, y, z }]`, `ponds` `[{ x, y, r }]`.
- What a dressed zone holds beyond 2a's: `zone.props` (`[{ x, y, z, kind }]`, kinds of `content/biomes.js PROPS`; saved
  since P0, drawn once request 7 is in), wildlife in `zone.creatures` (types of `content/creatures/wildlife.js`), rewards
  in `zone.items` (`surfaceReward`), and `zone.planWalls` for the dressing's posts, outcrops, spires and crags (walls on
  the map however low; saved since P0).

### `gen/biomes/`

- `index.js`: `BIOME_BUILDERS` (the 14 real biomes), `TEST_BUILDERS` (the test world's 6 terrains: the plain dressing),
  `builderFor(world, tile)`, `LANDMARK_BUILDERS` (re-exported from `landmarks.js`); importing it registers the wildlife
  and WS2's legend handlers.
- `common.js`: `withHelpers(ctx)` (the writers: `column`, `pool`, `put`, `carve`, `reserve`, `reserved`, `addProp`,
  `placeItem`, `placeCreature`, `free`, `freeRect`, `occupy`; one `set()` marks a column local only when it changes),
  `dress(ctx, data)` (ponds, ramps, plateaus, rocks, lights, props), `populate(ctx, dist)`, `spawnPick(rng, spawns,
  level)`, `surfaceReward(rng, level)` and `CRYSTAL_SHARE`, and the parts of `dress` for a builder's own use. Its header
  says what ctx holds.
- `legend.js`: the handlers `tree`, `prop`, `shallow`, `deep`, `road`, `path`, `rubble`, `station`, `creature`
  (`WS2_LEGEND`; what each builds is in its header), `TREE_TRUNK`.
- `landmarks.js`: `LANDMARK_BUILDERS.gnomon` (WS3 #10: the 14-block foot at the span's middle, the stairs south of it).
- `<biome>.js`: one builder each.

### `content/biomes.js`

- `BIOMES[biome] = { liquid, cliffTiers, sub, rocks, ponds, props, lights, plateaus, ramps, caches, clearings, spawns,
  wildlife }` (the file's header says what each is), `PROPS` (15 kinds: name, map glyph and colour, a small picture),
  `SETTLED_KINDS`, `DEFAULT_BIOME` (the test world's: plain dressing, no wildlife), `biomeOf(id)`,
  `biomeFor(world, tile)` (what the world functions read: the tile's biome data when its terrain is the real world's,
  `content/world/terrains.js`, else the defaults, so the test world's fixture terrains, whose `flats` shares an id,
  keep plain water and single cliffs). A biome id is a terrain's `biome`, else its id.

## Integration requests

(1-6 are 2a's; 7-11 are 2b's.)

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
7. **WS3 / the integrator (`render3d.js`, `renderMap.js`): draw `zone.props`.** Props are non-blocking sprites the
   dressing places (shrubs, reeds, glimseed, bones, salt blooms, ferns, mushrooms, scrap, glass and crystal shards, ash
   drifts, ink stains, webs, nests): `zone.props = [{ x, y, z, kind }]` (saved since P0), looks in
   `content/biomes.js PROPS[kind] = { name, glyph, color, art, palette }` (`art`/`palette` in the creatures' pixel
   format, one picture; `glyph`/`color` the map's, webs `-` and nests `°` as bible §15.7 gives them, the rest letters no
   registry entry uses). In 3D a billboard like an item's sprite, lit by `sampleLight`; on the map the glyph under items
   and creatures; the map legend (`,`) and the inspect describer could name them (`PROPS[kind].name`). Until then they
   are invisible (nothing else changes: they block nothing).
8. **Information for the integrator (the merge)**: `tests/checks/edges.js` now checks a border tile the map draws as
   wall (a cliff top, which ramps let the anchor reach) for the 3D arrival only (the map never stands there; walking off
   it is a drop, and `zones.js edgeArrival` keeps your exact point). The staged make (`surfaceSteps`) has one more stage
   ("biome"): `browser-gate` shows 8 prefetch frames where it showed 7. Surface zones of the real world now hold wildlife
   (hostile under factions.js's stub; at integration their `factions` are WS6a's ids: saltbeasts, rustbacks, kites,
   pleatwood, sporeMoot, assize, plan, unlit, clatter, errata, askew, all in `content/factions.js` on `integration`).
   The test world's zones gain the plain dressing (rocks, props, an occasional plateau with its reward) and no wildlife.
9. **C1 (landmark plans)**: a plan may use WS2's legend letters through `legend: { ch: id }`, with `props: { ch: kind }`,
   `creatures: { ch: type }` and `rubble: block id` on the plan (`gen/biomes/legend.js` says what each builds); a
   landmark with a plan no longer gets `LANDMARK_BUILDERS` (the Gnomon's plan must stand its own 14-block foot at the
   span's middle, (40, 24), where render3d starts the needle). The biome's dressing keeps off a landmark's footprint and
   skirt, and off a per-run site's.
10. **C3 and the balance phase (wildlife)**: 36 species carry the parent's traits only; bible §12's hooks (a brine-grub's
   tunnel shown as `;`, a ledgehorn's 2-block climb, a kite's nest, a salt mirage seen only in 3D, a tile mimic that
   moves only while you're in 3D…) are C3's, as are the spawn keys' people and machines and the water's creatures
   (docs/sessions/ws2.md Part 2b §3). d20: no species has `dv` or attributes yet (combat.js reads `t.dv`, 0 if absent);
   their hit points and damage are the parent's analogues' at the zone's level (+6% HP a level, +1 damage per 4).
   `content/biomes.js` `wildlife` counts and `spawns` weights are first numbers.
11. **WS1 (encounters)**: `BIOMES[biome].spawns` are bible §15.2's spawn keys as registered types with weights, and
   `gen/biomes/common.js spawnPick(rng, spawns, level)` picks one by level; an encounter table may read them.

## Handoff

**For the integrator** (written at `p1-ws2b`). Branch `ws/ws2` in the worktree `gnomon-wt/ws2`; WS2 is done: 2a tagged
`p1-ws2a`, 2b `p1-ws2b`, numbers in `docs/sessions/ws2.md` "Part 2a" and "Part 2b". Nothing is half finished. Merge
`p1-ws2b` (it contains `p1-ws2a`); requests 1-3 and 7 are code for others' files, 4-6 and 8-11 are information.

**At the merge, rerun:** `check-surface` (alone with `--budget` for the timing), `check-edges`, `check-landmarks`,
`check-creatures` (the wildlife against every creature on `integration`: WS7's villagers and WS10's legends came after
this branch), `check-imports`, `check-determinism`, golden and the legacy fights; `browser-gate` (the prefetch's 8
frames) and `browser-0d1` (the outdoor frame with dressed zones). Known conflicts: none in WS2's own files; `gen/vaults.js`
legend ids don't collide (`registerLegend` would throw at load).

**Things worth knowing:**
- The map can't show height: ground 4 or more up is a wall glyph. That is what makes ramps' tops, cliff caches and
  plateaus 3D's alone; the map shows the reward and can't reach it. The Tessellate's mosaics are the other way round:
  vivid on the map, faded at eye level.
- A builder must write through ctx (`gen/biomes/common.js`): only inside the keep, marking local only what changes (check-
  surface fails a column marked local that is the world function's, and any change not marked), water at the datum on
  rock, a 2-step only where planned. Rewards come from `surfaceReward` (crystals 3%, never glim or a relic).
- Timing on this machine: the CPU is shared and often at 100%; compare trees in one process, span by span alternating
  (`docs/sessions/ws2.md` Part 2b §2 item 8 says how). Lamps cost about 1 ms each at every refresh: keep them few.
- A worktree made from `p0-done` carries DECISIONS' older "Browser checks" text naming Python's server: use
  `node tools/serve.mjs <port>`.
