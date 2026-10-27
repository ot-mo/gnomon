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

## Part 2b: biomes, landmark stamping, props, wildlife

Continued from `p1-ws2a` in the same worktree and branch, while WS7b, the integrator and other sessions shared the CPU
(often at 100%: every timed item was taken alone, or with both trees in one process in alternating order).

| Commits | What |
|---|---|
| `3abd07b` | Biome data (`content/biomes.js`) and the wildlife table (36 species) |
| `5026c90` | The builders (`gen/biomes/*`), WS2's legend handlers, the Gnomon's foot, `gen/surface.js` wiring and validation, the sub-ground |
| `a73f914` | The 2b checks (check-surface 10-14, check-landmarks on the real world, check-edges' cliff-top arrivals) |
| `153270a` | Timing: the wildlife on validation's reach; no lamps in the Stacks |
| `1ef04d0` `df84bd0` `e102128` `fcafbd1` `8b8dc1b` `3545768` `3d29650` `583dc61` `1521b3e` | The verification's findings and two of this session's own, one commit each (§4) |

### 1. What was built

| Part | Where |
|---|---|
| ctx writers (`column`, `pool`, `put`, `carve`, `reserve`, `placeItem`, `placeCreature`, `addProp`) through one `set()` that marks a column local only when a voxel changes, all inside the 2-tile keep; `dress`: ponds in the zone's liquid at the datum on rock (banks of slope 1), ramps of 1-block steps up cliff faces (the map climbs them until ground is 4 up, 3D to the top) with caches on the tops, deliberate 3D-only plateaus (2 above everything round them, a stepping stone a tile's gap away, a reward on top, at most `jumpSpots` 2), rocks (1-block rubble, or 2-3-block outcrops that are map walls), lamp posts, props; `populate`; `surfaceReward` | `gen/biomes/common.js` |
| A builder per real biome: reeds and glimseed by the Flats' brine, salt-pan mosaics and wells in the Waste, ramps and Rustback caches on the Steps, barrows on the Downs, fungal groves and fallen trunks in the Pleatwood and the Deep Pleat, mosaics in the Tessellate (read on the map, faded in 3D), brick-footed floor plans in the Stacks, rune stones in the Shade, crystal spires and world-aligned glass grid lines in the Lattice, snow-tipped crags in the Teeth, wrecks on the Glass Sea's crust, reeds on river spans, milestones by roads; the test world's six terrains get the plain dressing and no wildlife | `gen/biomes/<biome>.js`, `index.js` |
| Clearings: discs cut before the trees grow (inner trees give way, marked local), so dense woods have room for ponds, plateaus and groves | `gen/surface.js` step 6, `content/biomes.js clearings` |
| WS2's legend handlers: tree, prop, shallow, deep, road, path, rubble, station, creature (a plan's `props`, `creatures`, `rubble`; `stampPlan` grows the trees' canopies) | `gen/biomes/legend.js`, `gen/surface.js stampPlan` |
| The Gnomon's 14-block voxel foot at its span's middle (WS3 #10) and its stairs, while it has no plan | `gen/biomes/landmarks.js` |
| Sub-ground: a raised column is its biome's block from the datum's layer up (the Steps' clay mesas, the Lattice's crystal), the same in the apron | `gen/terrain.js` `columnAt.sub`, `gen/apron.js`, `gen/surface.js` |
| The rest of the biome table, `PROPS` (15 kinds), `SETTLED_KINDS` (no wildlife in settlements) | `content/biomes.js` |
| 36 wildlife species (bible §12, §15.2's spawn keys, §15.7's glyphs; `levels`, never `depths`) | `content/creatures/wildlife.js` |
| The 2b acceptance | `tests/checks/surface.js` 10-14 and its regression spans, `tests/checks/landmarks.js` 3, `tests/checks/edges.js` |

### 2. Gate (docs/ws2.md "2b" acceptance, and 2a's items with the builders in)

**`node tools/run-all.mjs`: 37 of 37** at `1521b3e` (135.0 s, 11 at a time). Golden: 86 mechanics steps, 27 frames, 95
dungeon levels, 28 vault stamps, the temple on 2 seeds, 0 mismatched; legacy fights 1,359 map and 1,027 3D steps, 0
differing; `check-screen-frames`, `check-save`, `check-bot`, `check-determinism` (93 surfaces twice) pass.

1. **Every landmark × 5 seeds valid** (`check-landmarks`, seeds 1, 7, 42, 1234, 31337): the test world's 15 landmark
   zones and 25 ruin levels, 0 retries; **the real world's 16 landmarks, every span (90 zones), 0 problems, 0 retries**,
   each twice the same, its way down a reachable STAIRS key point where a dungeon lies (their plans are C1's: until then
   a stub footprint, and the Gnomon its foot). 500 random test-world spans: 0 failed, navigability min 100%.
2. **A builder for every terrain**: 14 real (`BIOME_BUILDERS`, every id of `TERRAINS`), 6 test (`TEST_BUILDERS`), held
   by check-surface 11.
3. **Legend handlers**: all 9 registered and each stamped through `stampPlan` builds what it says (check-surface 12);
   no id collides with any other branch (the verification grepped `integration` and every `ws/*`).
4. **Wildlife**: 36 species; `check-creatures` passes (55 monsters, 330 elite looks, 396 unique (glyph, colour)
   pairs); no type has `depths`, so the dungeons' pools are untouched (the verification: 240 legacy levels and 72
   real-world site levels bit-identical to `p1-ws2a`); every spawn key is a registered creature, and every span you can
   be in has a species of its own level; over 1,500 zones 5,231 creatures, all on map ground the anchor reaches, 2+ tiles
   from edges, 10+ from the anchor; none in the test world, none in the 45 settlement spans of 5 seeds.
5. **Deliberate 3D-only plateaus** (check-surface 10, 1,500 real-world zones): 416 plateaus, at most 2 a zone; no column
   of any reached on the map, every column reached in 3D (steps of 1, a jump of +1 over a tile's gap), a reward on each.
   938 ramps, each top a map wall that 3D reaches; 235 caches on tops, none on map ground. Cliff tops reached in 3D:
   60% (0 before 2b). Rewards: 651, 15 crystals (2.3%; never glim or a relic).
6. **2a's items with the builders in** (check-surface): 1,500 zones valid, 0 retries, navigability min 95.0%, mean
   100%; 300,000 world-function columns, 0 slope faults; the apron against 150 neighbour pairs (48 corners), 1,756,240
   voxels equal, 2,875 columns left out as the neighbour's own (2.55%), 2,858 of them really different (the other 17
   lie in 2a's site footprints, marked whole); and new: 155,772 columns marked local away from footprints and canopies,
   **0** of them the world function's (no over-marking). Seams (`check-edges`): 790 edges, 98,721 crossings, 0 shifted
   (the test world's count is 2a's exactly), 97,066 3D points kept, 14 of them from cliff tops only 3D stands on.
7. **Screenshots of three biomes**, in the browser pane with `?silent=1` on `tools/serve.mjs 8652` (audio to the
   silent sink, 0 console errors; tab closed and server stopped after), seed 1234: the Rust Steps (9, 9) in 3D, a ramp of
   1-block steps up a clay mesa with its stacked tier behind, and on the map, where the ramps' upper steps and the
   mesas are walls and a cache's find lies on a top the map can't reach; the Lattice (34, 0) in 3D, crystal spires on
   the crystal plain; the Tessellate (24, 7) on the map, three mosaic seals vivid from above, ink pools, a pack of
   press-hounds and two plateau rewards the map shows and can't reach, and in 3D at eye level over the same seal, faded
   tiles. Files: the shared notes folder, `ws2b-shots/` (five JPEGs).
8. **WS2's p95 ≤ 60 ms, max ≤ 150**: `check-surface --budget` alone (load 26%): p50 14.35, p95 25.31, max 141.13 ms over
   1,500 real-world zones, PASS. `check-perf --against p0-done` alone: PASS (gen.surface p95 37.98 against 37.93, ×1.00;
   its max is one sample, 158.9 against 141.5, ×1.12, the verdict's "the machine's"). Both trees in one process, span
   by span alternating, 350 spans of both worlds a round: mean 16.4 / 17.5 ms against 14.3 / 15.8 at `p0-done`
   (+11-15%), p95 25.8 / 29.1 against 20.3 / 27.3, max 144.5 / 171.3 against 106.7 / 114.6 (load 62% rising to 100%; a
   third round at 100% read 26.7 / 26.4 mean). The dressing itself takes 0.3-0.8 ms a zone and the wildlife 0.1 ms; the
   rest is the light its features add at refresh (lamps cost about 1 ms each, so they stay few). The slowest spans are
   the same in both trees (the Square's first cold make, then the Metronome's).
9. **The old game unchanged**: golden (a) and (b), the screen frames and the legacy fights hold (above). Browser:
   `browser-0d1 --against p0-done` PASS (14 of 14 modes by keys and clicks at two sizes, the HUD at 100×30, 27 golden
   frames in the browser 0 mismatched, frame time under/3d +0.1%, under/map −0.5%, surface/3d −1.1%, surface/map
   −0.2%); `browser-gate` PASS on seeds 1234 and 7 (0 console errors, audio silenced; the staged make is 8 frames, one
   more for the biome step); `browser-0d2 --all` PASS (both boots, every module in a page, 34 checks in the page).

### 3. Deviations from the design, with reasons

1. **Props are data, not drawn yet.** `zone.props` (saved since P0) holds them, `PROPS` gives each a map glyph and a
   small picture, but render3d and renderMap are WS3's and P0's: integration request 7.
2. **Wildlife is placed by the surface generator, after validation**, on the map reach validation measured (it changes
   no block). Bible §12's hooks (a burrower's tunnel, a ledgehorn's 2-block climb, a mirage seen only in 3D) are C3's;
   the species carry the traits the engine has. The spawn keys' people and machines (Assize outriders, Lampless
   chanters, pressed pilgrims, Flatfolk wanderers, draughtsmen, clatterers, the drowned keeper) and the water's creatures
   (glowfin, umbral and mirror eels) aren't in: the talkers, systems or swimmers they need come later.
3. **The surface's reward table** (`surfaceReward`) isn't the parent's treasure: crystals 3%, no glim, no relic (the
   user's taste: rewards meaningful to the end, money never plentiful).
4. **Sub-ground** is a world function (`columnAt.sub`), not a builder's choice: the apron must show it.
5. **Clearings** before the trees grow: the only way to give dense woods ponds, plateaus and groves without breaking a
   tree that crosses an edge (those never give way).
6. **check-edges**: a border tile the map draws as wall (a cliff top, now reached by ramps) is checked for the 3D
   arrival only; the map never stands there, and walking off it is a drop (zones.js keeps your exact point).

### 4. Verification and fixes

An independent reviewer (a fresh agent given the code and the contract, not this session's conclusions) scanned every
zone of the real world on seeds 1, 7, 42 (2,646) and the test world on seeds 3, 20, 42 (2,400) against a whole-zone build
from the world functions, checked determinism (240 zones twice, in reverse order, staged and not, `Math.random`
reseeded: 0 differ), dungeon levels against `p1-ws2a` (bit-identical), a save round trip of 24 dressed zones (blocks,
props, items, planWalls, creatures, liquid survive; only `gen`'s typed arrays are dropped, by design), heights (nothing
standable over 12, no write outside the zone) and collisions of ids across branches. Its findings, and two of this
session's own, each fixed in its own commit with a check that fails without the fix:

1. **A ramp up a cliff no longer high** (`1ef04d0`): a site's skirt pulls cliff columns down but keeps the cliff mask;
   seed 42 (20, 9) had a ramp onto a top 3 up, reached on the map. A top must be 4 or more up and still free. Without:
   "a ramp's top (31, 18) at 5 isn't a map wall".
2. **Props buried in later features, two on a tile, scrap by an edge** (`df84bd0`): 44 of 25,357 props. `addProp` takes
   the column, needs air at its feet, one a tile, the keep. Without: "the shrub at (24, 8, 3) is inside 7".
3. **The Stacks' floor plans: stone walls on stone ground, marked local unchanged** (`e102128`): brick footings, and one
   `set()` that marks only real changes; check-surface now holds that no column marked local is the world function's.
   Without: "(15, 25) is marked local but is the world function's column".
4. **The forests' own features never fired** (`fcafbd1`): 0 plateaus and 0 ponds over 504 Pleatwood and Deep Pleat
   zones. Clearings, and ponds that need only their banks free. Without: "biome pleatwood: no plateau in 46 zones".
5. **A sinkhole under a prop** (`8b8dc1b`, found by finding 2's check): sinkholes skip the dressing's columns. Without:
   "the bones at (32, 13, 2) is inside 0, floats".
6. **Spawn tables short of their spans' levels** (`3545768`): roads (levels 2-17) stopped at 9, the Stacks' Old Cuts
   (level 5) had nothing. Without: "no wildlife of road level 14 (18 spans)".
7. **Wildlife in the settlements** (`3d29650`, this session's own): a real-world run would start in Hollowmere among
   saltrats. Without: "Hollowmere (5, 16) holds 6 wildlife (saltrat)".
8. **A pack's members by the anchor** (`583dc61`, cosmetic). Without: "the cairnHound at (47, 31) is within 10 tiles".
9. **The rewards were the dungeons' treasure** (`1521b3e`, balance): 16% crystals and relics on the surface. Without:
   "19 of 193 plateau and cache rewards are crystals (want at most 6%)".

Not changed: ramps that start on a stacked mesa's ledge (9 of 1,442) are by design ("from a ledge onto the mesa above");
the reviewer's "no height clamp" is latent (every writer goes through `set()`, which refuses a layer outside the zone).

### 5. Recheck before the tag

`node tools/run-all.mjs` 37 of 37 at `1521b3e`; `check-surface --budget` and `check-perf --against p0-done` alone PASS;
the alternation against `p0-done` (§2 item 8); `browser-gate` and `browser-0d2 --all` PASS on the final code
(`browser-0d1 --against p0-done` passed at `153270a`; what changed since is the surface's dressing, which
`browser-gate` and `browser-0d2` cover).

### 6. Known issues (for the integrator and C)

- Props aren't drawn until request 7; liquids other than water look like water until WS3 and WS6b colour them (2a's
  requests 1 and 2 still stand).
- The real world's landmarks stand on stub footprints until C1's plans (a plan replaces the Gnomon's builder).
- Wildlife carries only the engine's traits; bible §12's special behaviours, the species left out (§3 item 2), and d20
  balance (`dv`, attributes per species) are C3's and the balance phase's.
- `check-perf`'s `gen.surface.max` is one sample (130-290 ms at `p0-done` itself on this machine).
