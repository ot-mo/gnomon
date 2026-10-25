# Engine survey: forking The Rotation Cube into an overworld game

Repo: `C:\Users\Otto Mörner\Code\ascii-roguelike` (commit `75edbd3`, single commit, clean tree).
Every claim below cites `file:line` in `src/`. The numbers in §6 were **measured**, not guessed: in Node 20 against a copy of `src/`, and in the real game in the desktop browser pane. The bench scripts are listed in the appendix.

---

## 0. TL;DR

* **A floor is a fixed 48×48×10 voxel box** (`world.js:5`), with all of its derived data (light, standing heights, map kinds) stored on the same object. The renderer, raycaster, light, pathing, map and monster code already read `floor.w/d/h`. The **`Floor` methods themselves** (`world.js:100-176`) and the **dungeon generator** use the module constants `W, D, H`. That is the only hard size coupling. Making the methods use `this.w/d/h` is about 15 lines.
* **"Depth" is the real coupling.** It does three jobs: the address of a floor (`game.floors: Map<depth, Floor>`, `game.js:44`), the difficulty scalar fed into roughly 25 generation and balance functions, and story gating (`FINAL_DEPTH = 20`, guardians on 5/10/15, taunts, music). The fork needs a zone address `{wx, wy, z}` and a separate `level` (difficulty) number. Most balance functions already take a plain number, so they can stay as they are.
* **A whole zone can be outdoors today.** `computeLight` seeds sky light in every air cell that can see the top of the grid (`light.js:13-20`), and `hasSky` only switches on direct sun and the sky dome (`render3d.js:106-111, 188`). I built synthetic open-terrain zones, and they render at the same cost as dungeons. Rendering cost depends on screen cells, not zone size. **Two visual gaps** were confirmed in the browser:
  1. The region beyond the zone edge, below the horizon, renders **black** (`render3d.js:186-189`).
  2. Distance fog is a **night-dark colour** (`render3d.js:21`).
* **Zones can grow.** I recommend surface zones of **80×48×16**. That fits the map screen without scrolling (160 of the 180 columns) and costs about 6 ms per `refresh()` and about 0.6 MB of RAM per live zone. Dungeon levels should stay 48×48×10, where the validated generator lives.
* **Saving is feasible.** The full 20-floor run I simulated compresses to about **96 K characters**: deflate plus base64, about 4.5 K per floor, and roughly 76% of that is entity JSON. Blocks are deterministic per seed (verified). Monster IDs are not, because a module counter allocates them (`monsters.js:334`, `npcs.js:70`). The blockers for a naive `JSON.stringify` are listed in §5. The hosted build shares its origin with every other `ot-mo.github.io` page, so the save should go in IndexedDB rather than localStorage.

---

## 1. The data model of a Floor, and everything that assumes 48×48×10 or depth-indexed floors

### 1.1 `Floor` (`world.js:65-177`)

| Field | Type / size at 48×48×10 | Meaning | Serialisable? |
|---|---|---|---|
| `w, d, h` | numbers (`world.js:67`) | copies of the module `W, D, H` | yes |
| `depth`, `seed` | numbers (`:68-69`) | address and run seed | yes |
| `blocks` | `Uint8Array(23 040)` (`:70`) | voxel ids, index `x + y·W + z·W·D` (`:100`); ids = index into `BLOCKS` (`:16-54`, 37 kinds) | as bytes (deflates to about 0.7-1 KB) |
| `seen` | `Uint8Array(2 304)` (`:71`) | auto-map | bytes |
| `holeSeen` | `Uint8Array(2 304)` (`:72`) | chasms you've looked into | bytes |
| `kind` | `Uint8Array(2 304)` (`:73`) | `KIND` per column for the map (`:60-63`) | **derived** (`computeKinds`) |
| `stand` | `Int8Array(2 304)` (`:74`) | standing height per column, -1 = none | **derived** |
| `skyLight`, `lampLight` | `Float32Array(23 040)` ×2 (`light.js:10, 30-31`) | flood-filled light | **derived** (`computeLight`) |
| `litMask` | `Uint8Array(23 040)` (`light.js:27-32`) | air bright enough for the auto-map | **derived** |
| `navVersion` | number (`:76`) | bumps on `refresh()`; invalidates `game.flow` (`monsters.js:399`) | transient |
| `links` | `Map<voxelIndex, {action, cells, group?, msg?}>` (`:78`) | levers (`interact.js:97-137`) | Map → entries |
| `groups` | `Map<id, {need, pulled, cells}>` (`:79`) | multi-lever gates | Map → entries |
| `braziers` | object or null (`:80`, built `vaults.js:445-452`) | brazier puzzle | yes |
| `bombs` | array (`:81`) | lit bombs | yes |
| `secret` / `secretWalls` | object / **`Set<column>`** (`:82-83`) | secret room | Set → array |
| `monsters`, `items`, `npcs` | arrays of plain objects (`:85-87`) | entities | mostly (see §5) |
| `spikes` | **`Map<column, {phase, period, up, pattern}>`** (`:88`) | spike traps (`traps.js:30-43`) | Map → entries |
| `projectiles` | array (`:89`). Hostile ones hold **`from: <monster object>`** (`monsters.js:552`) | in flight | strip or re-link |
| `clouds`, `markers` | arrays (`:90-91`) | gas, map markers | yes |
| `sightings` | **`Map<monsterId, {x, y, glyph, color, name, time}>`** (`:92`) | last-seen monsters | Map → entries |
| `rooms` | array of rects plus flags (`:93`, `dungeon.js:68-69`) | generator output, used by vaultHint/test | yes |
| `spawn`, `stairs`, `upStairs` | points (`:94-96`) | arrival anchors | yes |
| `hasSky` | bool (`:97`) | enables sun and sky dome | yes |
| Ad-hoc fields | `vault` (`dungeon.js:210`), `guardianHall` (`vaults.js:436`), `leverRecord` / `leverRecordAt` (`vaults.js:431`, `dungeon.js:299`), `slam` / `slamDone` with **`cells: Set`** (`guardians.js:149-156`), `cubeWall`, `returnPoint`, `temple` (`story.js:91, 98, 128`), `attempts` (`dungeon.js:28`), and the once-per-floor flags `secondWind` (`game.js:131`), `firstBlocked` (`monsters.js:512`), `waterHint` (`turns.js:213`), `vaultHinted` (`game.js:299`) | various | yes, except the Sets |

**`refresh()` (`world.js:140-146`)** recomputes light, then `stand` and `kind` for every column, then bumps `navVersion`. It is called after **every** block change: doors (`interact.js:93`), levers, bombs (`throwing.js:255`), braziers (`guardians.js:99`), the cube wall (`story.js:136`), and guardian gates (`game.js:101`).

**The "one ground layer" datum.** Most code assumes that ground is the block at `z = FLOOR_Z-1 = 1` and feet are at `FLOOR_Z = 2` (`world.js:6`). Rooms are open from z=2 to 5 (`ROOM_TOP = 6`, `world.js:7`). `computeKinds` reads the ground at `FLOOR_Z-1` and calls a column a WALL only if z=2..5 are all solid (`world.js:148-176`). `standHeight` treats deep water at `FLOOR_Z-1` as unstandable (`world.js:125`). `FLOOR_Z / ROOM_TOP / CORRIDOR_TOP` appear 179 times in 17 files (dungeon.js 74, vaults.js 32, story.js 20…). **Recommendation: keep `FLOOR_Z = 2` as the datum for surface zones too.** Terrain rises 0-3 blocks above it, and water sits at the datum. Do not make FLOOR_Z per-zone.

Collision: `solid()` treats the sides and top as solid and **below as open** (`world.js:114-119`). That is how pits and deep water drop you to `depth+1` (`game.js:154-165`).

### 1.2 Everything that hard-codes the size

* `world.js:5`: `W = 48, D = 48, H = 10`. `Floor` allocates with them (`:70-74`). **`index/get/set/solid/standHeight/refresh/computeKinds` (`:100-176`) use the module constants, not `this.w`.**
* `gen/dungeon.js:4` imports `W, D, H`. They are used throughout `buildFloor` (`:37-41, 47, 65, 76…`), `findPath` (allocates `W·D·4` Float64 and Int32 per corridor, `:798-824`), `addSecretRoom` scans (`:689-690`), `beside/landing/standWith` (`:764-792`) and `validateFloor` (`:857-909`).
* `H` is imported by `interact.js:3` (door removal loop `:82`), `gen/vaults.js:26` (`stampVault` writes full columns `z < H` with **rock above the walls**, `:347-349`), `story.js:7` (sanctum opened to sky `:121`) and `turns.js:10` (`topSurface` = `H-2`, `:73`).
* `raycast.js:16`: `HOLE_Z = 1`, the datum again.
* `story.js:53`: the temple plan is 44×45, stamped at (2,2), so it needs at least 46×47.
* `renderMap.js:57`: the legend shows only if `cols ≥ w·2 + 34`. `TILE_W = 2` (`:17`). The view scrolls once the zone is bigger than the screen (`:62-66`).
* `render3d.js:24`: `MAX_DIST = 32`. `turns.js:103`: map sight rays go 24 tiles. `turns.js:27`: `ACTIVE_RADIUS = 12`.
* Already size-agnostic (they read `floor.w/d/h`): `raycast.js:18`, `light.js:8, 36`, `pathing.js:29`, `monsters.js:394`, `renderMap.js`, `traps.js`, `effects.js:177`, `throwing.js:220`, `turns.js:143, 258`.

### 1.3 Every use of `game.depth`, `FINAL_DEPTH`, `game.floors` and depth-based scaling

**Address and flow (`game.js`)**
* `:43` `game.depth`, `:44` `game.floors = new Map()` (depth → Floor), `:178` start at depth 0, `:192` reset.
* `:61` `fallThrough()` → `depth+1`. `:154-165` falling and deep water → `depth+1`. `:168-169` stairs → `depth±1`.
* `:217-239` `enterFloor(depth, how, fx, fy)` does five things:
  * generates the floor on first visit (`generateFloor(game.seed, depth)`, `:220`);
  * logs `TAUNTS[depth]` (`:221`);
  * sets `FINAL_DEPTH → FINAL_PAGES` (`:222`);
  * runs `resolveRelics` (`:225`, uses `floor.depth+2` at `:249`);
  * opens the guardian gate when you come up into a guardian floor (`:228-232`), then places the player via `arrivalPoint` (`:233`).
* `:254-259` `changeFloor` shows the "DEPTH n" screen (mode `descend`, 1.2 s).
* `:105` guardian loot `randomEquipment(…, this.depth+2)`.

**`FINAL_DEPTH` (=20, `world.js:9`)**
* `game.js:32, 222`
* `dungeon.js:4, 166` (`final`: no holes, 10 monsters, no stairs) and `:865-870` (validator)
* `vaults.js:26, 334` (boss vault)
* `hud.js:8, 66, 117`
* `effects.js:5, 48` (descent potion)
* `throwing.js:15, 176` (descent splash)

**Generation keyed on depth (`gen/dungeon.js`)**
* `:22-32` `generateFloor(seed, depth)`: `depth === 0` → `buildTemple` (`:23`). The RNG seed mixes in depth (`:26`).
* `:144-160` `depth === 1`: **no stairs up** (spawn instead) and a sky well. Depth ≥ 2 gets `STAIRS_UP`.
* `:172, 183-184` features at depth ≥ 2. `:190` dark-room chance `0.12 + 0.08·depth`.
* `:252` monster count `min(18, 3 + 2·depth)`. `:261-262` `pickMonsterType(rng, depth)` and `rollElite`.
* `:244, 269-274, 528, 630, 659, 736` loot and gold by depth.
* `:277` `planEncounters(seed).get(depth)`. `:381-382` Pell's stock and shrine cost by depth.
* `:885` validator: depth > 1 requires reachable stairs up.

**Vaults**
* `vaults.js:328` `GUARDIAN_FLOORS = [5, 10, 15]`.
* `:332-338` `pickVault(rng, depth)`: a fixed vault sequence for floors 1-9, guardian halls by depth, and `BOSS_VAULT` at `FINAL_DEPTH`.
* `:363, 377, 379, 393-396, 405` spawns and loot use `floor.depth`.

**Balance curves that take a numeric depth.** These can stay as they are; feed them a `level`.
* `monsters.js`
  * `:32-271` each type's `depths: [first, last]` and `weight`; `:282` warded elites from depth 8.
  * `:316-325` `pickMonsterType`; `:328-332` `rollElite`.
  * `:337-349` `spawnMonster`: HP +6% per depth, +1 damage per 4 depths, XP +10% per depth.
  * `:577` boss summons; `:649-652` elite loot; `:678-691` gold drops and splits.
* `items.js`
  * `:401` `maxTierAt`, `:407-424` `randomEquipment`, `:427-435` `randomJewel`.
  * `:439-448` `randomTreasure`: `relic?` only at depths 14-19, a hard-coded 20.
  * `:469` `priceFactor`.
* `npcs.js`
  * `:71-72` `spawnNpc` stores `depth`.
  * `:118-134` `planEncounters(seed)`: Pell on 2/6/10/14/18, named NPCs on 1-16, shrines on 2-19.
  * `:137-160` `peddlerStock`; `:213, 241` `game.depth`.
  * Quest texts and rewards say "floor N": `:352, 361, 372, 395, 408, 418, 428, 432-433, 450, 483, 499`.
  * `:507-516` `bountyTarget`.
* Other files
  * `effects.js:109`, `interact.js:129, 161`: summons.
  * `traps.js:60`: spike damage `2 + depth/3`.
  * `guardians.js:52, 141`.
  * `dialogue.js:168`: services priced by `npc.depth`.

**Presentation**
* `hud.js:46` death text, `:64-68` the "DEPTH n" / "THE TEMPLE OF ANGLES" screen, `:117` status "DEPTH n/20".
* `music.js:67` mood (0 = temple, ≥12 = deep), `:69`, `:154` (darker with depth).
* `story.js:29-34` `TAUNTS` by depth; `:42` the epilogue says "twenty floors".

**Tests.** `test.html:24` (`DEPTHS = 20`) and `:64` (`GUARDIAN_FLOORS`).

---

## 2. Generalising "a floor" into "a zone" `(wx, wy, z)`

### 2.1 Addressing

* Key: `"wx,wy,z"`.
  * `z = 0` is the surface zone of world tile (wx, wy).
  * `z = 1…n` are the dungeon levels under that tile, present only where the world map puts a dungeon site.
* `game.floors` keeps its shape (Map keyed by that string). `game.depth` becomes `game.zone = {wx, wy, z}`.
* Keep a derived `game.depth = z` during migration, so HUD, music and summons keep working.
* Each zone carries:
  * `level`: difficulty, e.g. `region.tier·k + z`. Pass it to every balance function in §1.3 instead of depth.
  * `kind`: "surface" or "dungeon".
  * `region`: biome or faction tags.
* Zone seed: `hash(worldSeed, wx, wy, z)`. Fixed landmarks are hand-drawn plans, independent of the seed. `story.js:51-131` (temple = ASCII plan + `stampVault`) is the template for every landmark.
* Vertical moves (`game.js:154-169`) stay `z±1` at the same `(wx, wy)`.
  * Dungeon level 1 must get stairs up to the surface: today depth 1 has none (`dungeon.js:144-150`).
  * The surface zone's entrance is just `f.stairs`, so `arrivalPoint("up")` already lands beside it (`dungeon.js:759`).
  * Falling through a surface hole lands you on z=1 via `landing()` (`dungeon.js:773-786`). Sinkholes become a free way into a dungeon. Surface zones with no dungeon under them must have no holes, and must not have deep water with an open bottom.

### 2.2 Sky light: how it works, and a fully outdoor zone

* **Sky light** (`light.js:13-20`): for every column, scan from `z = h-1` down. Every air cell above the first solid block gets `sky = 1` and becomes a seed.
  * `flood()` (`:35-51`) spreads light through air in 6 directions, losing `0.13` per step (`:3`). A sky well therefore lights about 7 cells into the rooms around it.
  * Lamps use falloff `0.07` (`:4`).
  * `litMask` = air where `sky·0.7 + lamp² > 0.06` (`:28`). The auto-map only marks cells it sees through lit air or inside torch range (`raycast.js:48-53`).
* **`hasSky`** (`world.js:97`) does not affect `computeLight`. It gates only two things:
  * direct sun, one shadow ray per shaded pixel toward a fixed `SUN` vector, up to 40 units (`render3d.js:25, 105-111`);
  * the sky dome with clouds on rays that miss (`render3d.js:135-152, 188`). Rays that miss with `dz ≤ 0` draw black.
* **A whole zone outdoors works now.** Fill the air above the terrain and set `hasSky`. Every air cell above ground then seeds at 1, the zone is uniformly lit, `litMask` is all ones, and the map fills by line of sight.
  * I verified this with synthetic terrain zones (hills, trees, ruins) at 48×48×10, 64×64×16, 80×48×16 and 96×96×16 in Node, and at 48×48×10 in the browser.
* **What needs work outdoors:**
  1. **Horizon void.** When a ray leaves the grid sideways, `castRay` returns false (`raycast.js:33-35`). The renderer then draws sky only if `dz > 0`, else black (`render3d.js:186-189`). Looking toward a zone edge shows a black band under the horizon. **Seen in the browser screenshot.** Possible fixes:
     * (a) in `render3d`, intersect missed rays with a virtual ground plane at z=2 and shade it as distant terrain using the region's ground colour;
     * (b) give each zone a 1-2 tile "apron" generated from the neighbour's world-coordinate terrain;
     * (c) haze fog.

     Do (a)+(c) first.
  2. **Fog colour** `FOG = [4,5,9]` (`render3d.js:21`) and `FOG_DENSITY 0.05` make distant daylight terrain go dark. They need to be per zone: sky-coloured haze outdoors, dark underground. Pick them from `floor.hasSky` plus the clock.
  3. **Time of day.** `skyLight` is geometric openness, so day and night can be a multiplier at shading time. Five places need it:
     * `ambientAt` (`render3d.js:64-72`);
     * the sun direction (`render3d.js:25`, make it per frame);
     * `shadeSky`;
     * `refreshView`'s lit test (`turns.js:114`);
     * `litMask` (`light.js:28`): recompute it when the daylight bucket changes, which is O(n) and cheap.

     Monster perception uses the torch, not daylight (`monsters.js:595`), and should treat daytime outdoors as lit.
  4. **Edge darkening.** `sampleLight` skips samples outside the grid instead of clamping, so sky light falls toward 0.5 at the border (`light.js:67`). Clamp the coordinates.
  5. **Sun cost.** About 4.5 of the roughly 19.5 ms outdoor frame (Node, 180×56) is the per-pixel sun shadow ray. Bake a per-voxel "sunlit" bit in `refresh()` (one sweep along `SUN`) and look it up instead. Re-bake when the sun moves a step.
  6. **Deep water on the surface.** Deep water is "fall to the next level" (`world.js:118, 125`, `game.js:156`). On the surface it should mean swim or drown, so the surface needs separate rules: a rock bottom, or deep water that can't be entered without the Swimmer perk.
  7. **`stampVault` roofs everything with rock up to `H`** (`vaults.js:347-349`). The temple clears its sanctum by hand (`story.js:119-121`). Outdoor landmarks need a `roofless` / `roofHeight` option.
* **Map view outdoors.** `KIND` (`world.js:60-63`) has nothing for terrain, and FLOOR is drawn as one grey `.` (`renderMap.js:22`).
  * Add a per-column `look`: glyph and colour from the top block (grass, sand, road, tree canopy…). Optionally add kinds such as `TREE` and `BRUSH`.
  * Height stays invisible on the map. Hills up to 3 blocks read as FLOOR, and a cliff or tree 4 blocks tall reads as WALL (`world.js:152-163`). That matches the game's existing "the map is flat" rule.
* **Pathing outdoors.** `flowField` / `reachable` / `canWalk` (`pathing.js`) are plain BFS on `stand[]` and work unchanged. Cost is linear in area (§6). Monster AI in 3D updates **every** monster on the zone every frame (`game.js:280` → `monsters.js:392`, radius `Infinity`). Bigger, busier outdoor zones should use an activity radius as the map already does (`turns.js:39`).

---

## 3. Can zones grow (64×64, 80×48)? What does it cost?

Yes, once `world.js:100-176` uses instance dimensions and dungeon generation keeps its own `W/D/H` constants. Costs scale with **voxels** for `refresh` and RAM, with **area** for BFS, and with **screen cells (not zone size)** for 3D rendering.

| Zone | voxels | blocks | derived arrays in RAM | `refresh()` | flowField | 3D frame, 180×56 (draw dist 32 → 64) |
|---|---|---|---|---|---|---|
| 48×48×10 dungeon | 23 K | 23 KB | 214 KB | 2.4 ms | 0.13 ms | 12.0-17.1 ms |
| 48×48×10 outdoor | 23 K | 23 KB | 207 KB | 2.2 ms (5.4 ms in browser) | 0.32 ms | 16.1-17.9 ms |
| 64×64×16 outdoor | 66 K | 64 KB | 590 KB | 6.7 ms | 0.51 ms | 18.1-21.1 ms |
| 80×48×16 outdoor | 61 K | 60 KB | 553 KB | 6.3 ms | 0.51 ms | 17.7-20.2 ms |
| 96×96×16 outdoor | 147 K | 144 KB | 1.33 MB | 16.5 ms | 1.2 ms | 18.7-24.1 ms |

* **Map screen fit.** The canvas caps at 180 columns (`screen-canvas.js:3`). At 1080p that gives about 54-60 rows, so the map has about 50-56 tile rows (`renderMap.js:59`).
  * **80×48** fits with no scrolling. The legend auto-hides, because 160 + 34 > 180 (`renderMap.js:57`).
  * 64×64 needs vertical scrolling. Scrolling already works (`renderMap.js:62-66`).
* **`refresh()` runs on every door or lever.** At 96×96×16 that is 16 ms, a visible hitch, so bigger zones would need incremental relighting. At 80×48×16, 6 ms is fine.
  * In the dungeon case only about 0.7 ms of the 2.4 ms is light. The rest is `standHeight`, which builds a closure per column (`world.js:124-137`), so it is easy to speed up.
* **The dungeon generator at larger sizes** would need retuning (room counts, `findPath` allocations `W·D·4` per corridor). **Keep dungeon levels at 48×48×10.**
* **H**: 16 for the surface allows trees, towers and cliffs. Sky rays traverse more cells before leaving the top, a small cost.
* **Recommendation:** surface 80×48×16, dungeons 48×48×10. Keep only the current zone's derived arrays (`skyLight/lampLight/litMask/kind/stand`) in memory, and drop them for zones you leave. Re-entering costs one `refresh()` of 2-7 ms. This cuts RAM per cached zone from about 0.6 MB to about 70 KB plus entities.

---

## 4. Zone edges: walking off a surface zone into its neighbour

Today the edges are hard walls. `solid()` is true outside the grid (`world.js:116`), so 3D movement stops at `x = 0.3` (`player.js:106-134`). Map steps outside the grid return false (`turns.js:143`). Click-travel rejects out-of-range targets (`turns.js:259`).

**Detection**
* *3D* (`game.js:263-292`, after `updatePlayer`): if the zone is a surface zone, the player is within about 0.35 of an edge, and is moving outward, call `changeZone(neighbour, "edge", {side, along: p.y or p.x, z: p.z})`.
* *Map*: in `mapStep`, when `nx/ny` falls outside the grid on a surface zone, run the same transition (`turns.js:143`). Allow click-travel to an edge tile, with "walk off" on the next step.
* Edges on the world-map border, or facing impassable tiles (ocean, mountains), stay solid as now.

**Arrival**
* Extend `arrivalPoint(f, how, fx, fy)` (`dungeon.js:756-762`) with `how = "edge"`.
* Mirror the coordinate: the side you left becomes the opposite side, and `along` is kept.
* Search outward from that point for the nearest standable tile in a 3-tile band along the edge. Prefer the same `stand` height, and require the tile to be reachable from the zone's anchor. That is the pattern `landing()` already uses with `reachable()` (`dungeon.js:773-786`).
* Keep facing (`yaw`) and continue the step. Reset `game.flow`, `travel`, `effects` and `mapView` as `enterFloor` does (`game.js:234-238`).

**Seamless edges are the generator's job**
* Terrain height, water and biome blend come from **world-coordinate** noise: `noise2((wx·W + x)·s, …)`. Edge columns then match exactly.
* Linear features (rivers, roads, walls, cliffs) are decided at the world-map level as per-edge "ports" (for example a "road crosses the east edge at y = 30"), and each zone routes between its ports. Qud stitches rivers and roads the same way.
* Zone-local random clutter keeps a 2-tile margin from the edges.
* Validate each surface zone, extending `validateFloor` (`dungeon.js:857`): every non-blocked edge port is reachable from the zone anchor, and the dungeon entrance and landmarks are reachable.

**Hitches**
* A zone is generated synchronously on first entry (`game.js:219-220`): about 20-40 ms typical for dungeons, 134 ms worst case with retries. A surface zone of terrain plus features should be similar or lower.
* Hide it with a short "travel" fade, or pre-generate the 4 neighbours in `requestIdleCallback` after arriving.

**Followers.** Monsters chasing you across an edge is optional. Qud carries adjacent hunters along, which would mean moving `chase`-state monsters within 2 tiles into the new zone at the mirrored spot.

---

## 5. Game state and how to save it

### 5.1 What exists

* **`game`** (`game.js:42-57`, reset in `startRun` `:176-208`):
  * Core: `seed`, `depth`, `floor` (alias of an entry in `floors`), `floors: Map`, `mode`, `view`, `paused`, `time`.
  * Settings: `fov`, `sensitivity`.
  * Log and transient UI: `messages[]` (40 max), `effects[]`, `target`, `travel` (holds a **Set** `visible`, `turns.js:310`), `flow` (Int16Array), `descendT`, `deathCause`.
  * Identification: `potionColor{}`, `knownPotions:Set`, `scrollTitle{}`, `knownScrolls:Set`, `auraKnown:Set`.
  * Screen state: `invSel`, `invReturn`, `perkChoices`, `levelReturn`, `perkGift`, `perkMilestone`.
  * Story and quests: `story{cube}`, `quests[]`, `hints:Set`, `relicsFound:Set`, `crystalsBought`.
  * Overlays: `talk` (current node with **closures** `go()`, `npcs.js:249-250`), `shop` (references the npc and its stock rows), `pages` (with a **`then` closure**, `dialogue.js:314`).
  * Other: `cam`, `rotT`, `pendingPages`, `confirmJump`, `throwStack` (reference into `inv`), `journalRet`, and the methods `fallThrough/win/onCube/…/log` (`:59-171`).
* **`player`** (`player.js:16-32`):
  * Position and look: `x, y, z, vz, yaw, pitch`.
  * Stats: `hp, maxHp, str, keys, gold, torch, level, xp`, plus `perks:Set` and `perkRank{}` (`leveling.js:74`), `milestones:Set` (`game.js:314`), `pendingLevels, bonusPerks`.
  * Gear: `weapon, armour, sidearm, ring, amulet` (plain item objects), `inv[]`, `ready`.
  * Timers: `flyTime, hasteTime, shadowTime, poisonTime, paralyzed, darkTime, guardTime, attackCd, throwCd, swing, hurt, impact, wade, walkPhase, regenTick, poisonTick, spikeBeat, foldReady`.
* **Floors**: see §1.1.
* **Monsters** (`monsters.js:341-357`): about 45 plain fields. `m.g` is guardian state (plain). `id` comes from the module counter `let nextId = 1` (`monsters.js:334`).
* **NPCs** (`npcs.js:71-72`): `{id, type, tx, ty, x, y, z, depth, state, met}`. Ids come from another module counter (`npcs.js:70`).
  * `state` is plain data: Pell's `stock`, Rook's `target` id, Lio's lever coordinates, the door's `gate/spawns/choices/answer`, the shrine's `trial` ids.
  * **Dialogue is code, not data.** `talkTo(game, n)` rebuilds the node tree, with its closures, from `n.type` and `n.state` every time (`npcs.js:283-493`). So NPCs serialise cleanly; only an *open* conversation does not.
* **Module-level state.**
  * Must persist: the two `nextId` counters.
  * Must not: `mapView` (`renderMap.js:15`), music and sfx state, the render depth buffer.
  * Already in localStorage: `rotation-cube-music` and `rotation-cube-sounds` (`audio.js:38-43`, `music.js:36`, `sfx.js:15`).

### 5.2 What `JSON.stringify` can't carry

This list comes from walking the live state after a simulated 20-floor run (`state.mjs`).

| Kind | Where | Handling |
|---|---|---|
| **Typed arrays** | `floor.blocks` (23 040), `seen`, `holeSeen` (2 304 each) | deflate + base64 (or store only a diff against regeneration) |
| | `kind`, `stand`, `skyLight`, `lampLight` (Float32 ×23 040), `litMask` | **don't save**: rebuild with `refresh()` |
| | `game.flow` | drop |
| **Sets** | `game.knownPotions`, `knownScrolls`, `auraKnown`, `hints`, `relicsFound`; `player.perks`, `player.milestones`; `floor.secretWalls`; `floor.slam.cells`, `slamDone.cells`; `travel.visible` | to arrays (drop `slam*` and `travel`) |
| **Maps** | `game.floors`; `floor.links`, `groups`, `spikes`, `sightings` | to entry arrays |
| **Class instance** | `Floor` | rebuild through a constructor plus `Object.assign` |
| **Functions / closures** | game methods; `talk.node.options[].go`; `pages.then` | serialise a whitelist of data fields. **Only allow saving in `explore` / `map` modes** (not `talk/shop/story/rotate/descend/levelup`). For `levelup`, keep `pendingLevels`. |
| **Object references** | `game.floor` (= an entry of `floors`) | re-link by key after load |
| | `projectile.from` → monster (`monsters.js:552`) | store `fromId`, or drop in-flight projectiles (≤3 s life) |
| | `game.shop` / `talk` → npc; `throwStack` → inv stack | transient; drop |
| **Shared, not cyclic** | `monster.color` → `MONSTER_TYPES` arrays; `rooms[].theme` → `THEMES`; link `cells` shared between grouped levers | harmless to duplicate (read-only) |
| **Module counters** | `monsters.js:334`, `npcs.js:70` | export `getNextId/setNextId`; after load set them to max saved id + 1. Otherwise new spawns collide with ids used by `sightings`, Rook's target and shrine trials |
| **Non-determinism** | | Blocks and items are **identical** for the same (seed, depth), as are monster type, position and elite (verified). Monster **ids** differ (counter), and so do `anim/think/pause/shot` (Math.random, `monsters.js:352-357`). `resolveRelics` uses Math.random at entry (`game.js:243-252`). |

**Format**
* `{version, worldSeed, time, zoneKey, game: {…whitelist}, player, ids: {monster, npc}, zones: [key…]}`, plus one record per visited zone:
  * `{key, w, d, h, level, gen: {kind, params}, blocks | blockDiff, seen, holeSeen, entities: {monsters, items, npcs, bombs, clouds, markers, sightings, links, groups, spikes, secretWalls, braziers, secret, vault, guardianHall, stairs, upStairs, spawn, flags…}}`.
* Because generation is deterministic, an unmodified zone can store `blockDiff = []` and be regenerated on load.
* Zones with doors opened or walls bombed store `[(index, id)…]` (usually tens of entries) or the full deflated grid (about 1-2 KB).

**Sizes measured**
* Full 21-floor run, every floor fully seen, raw JSON entities: **96 K chars** in total. Per floor: about 1 KB blocks, about 40 chars seen, about 2.5-3 KB entities. Player and globals: 1.7 K.
* Synthetic outdoor blocks: 80×48×16 deflates to **1.5 KB** (2 K chars base64); real biomes will be busier, perhaps 3-6 KB.
* Estimate for 300 visited zones: **1.5-2.5 M chars**.

**Where to store it**
* localStorage is about 5 M chars per **origin**, and the game is hosted at `ot-mo.github.io/ascii-roguelike` (`README.md:45`). That origin is **shared with every other `ot-mo.github.io` project**.
* Put zone records in **IndexedDB** and keep only a tiny slot index in localStorage (namespaced, e.g. `rcube-fork:slots`).
* Use `CompressionStream('deflate')` (async) or a small RLE.
* Trim monsters to their non-default fields; they are most of the entity bytes.
* Autosave on zone change and on quit (`visibilitychange`). Keep a single save slot per character, for permadeath.

---

## 6. Performance numbers

**Node 20 (V8), this machine, against a copy of `src/`**
* `generateFloor`, 400 floors (seeds 1-20 × depths 1-20):
  * avg **22.7 ms**, median 20.5, p95 39.0, max 133.6 ms;
  * 29 regenerations in total, 0 validation failures;
  * temple 7.5 ms.
  * test.html's "about 18 ms" is consistent with this; that page counts in-browser time.
* `refresh()` on a dungeon floor: 2.4 ms, of which `computeLight` is 0.68 ms. `flowField`: 0.13 ms.
* `render3d` at 180×56 cells (10 080 primary rays):
  * dungeon spawn 12.0 ms, big hall 17.1 ms, temple sky 17.6 ms;
  * outdoor 16-24 ms depending on zone size and draw distance (§3).
* Breakdown of one outdoor frame (64×64×16, 19.5 ms):
  * primary DDA traversal **5.2 ms** (6.0 with seen-marking);
  * two trilinear light samples per pixel 1.4 ms;
  * material, fog and plot about 8 ms;
  * **sun shadow rays about 4.5 ms** (15.0 ms with `hasSky = false`).
* At a smaller screen (120×38) the outdoor frame takes 8.7 ms, so cost scales with cells.
* Draw distance barely matters below 64: horizon rays leave a ≤96-wide zone quickly.
* One map turn's `refreshView` (960 sight rays): 0.5-0.8 ms.

**Real browser** (desktop pane, 1024×768 at dpr 1.25 → 160×64 cells, 10 240 rays)

| | `render3d` | `present` (canvas glyph stamping) | full `draw()` | HUD |
|---|---|---|---|---|
| Dungeon, depth 6 | 9.5 ms | 7.4 ms | 15.2 ms | |
| Synthetic outdoor 48×48×10 | 13.2 ms (10.6 ms without sun) | 3.3 ms | 17.9 ms | 62-72 fps |

* Outdoor `refresh()`: 5.4 ms.
* `present` cost varies with how much ink is on screen. It is a fixed per-frame tax regardless of the zone.
* Map mode: `refreshView` 0.34 ms, `renderMap` 0.27 ms, full map draw 2.2 ms.

**Takeaways**
* The 3D view is already near the 16.7 ms budget at about 180 columns.
* Outdoors adds about 25% (mostly sun rays). Bake sunlight, and consider a lower column cap outdoors (for example 150).
* Zone size hardly affects the frame; it affects `refresh`, RAM and generation.
* Simulation (monsters, flowField, BFS) costs well under 1 ms per update at these sizes.

---

## 7. Recommended module architecture for the fork

Principle: keep the engine core (raycast, light, render3d, renderMap, turns, pathing, player, monsters, items) as-is wherever it already reads `floor.*`. Swap "depth" for "zone + level". Add an overworld layer on top.

### New files

| File | Responsibility / interface |
|---|---|
| `src/zone.js` | Holds `class Zone` (today's `Floor`, renamed; keep `export { Zone as Floor }`) with per-instance `w, d, h` and every method in `world.js:100-176` using `this.*`. Constructor `new Zone({key, wx, wy, z, level, seed, w, d, h, surface})`. Also `zone.dropDerived()` / `zone.ensureDerived()` for the RAM policy. Alternatively, keep it in `world.js` and leave `BLOCKS/B/KIND` there. |
| `src/zones.js` | `zoneKey(wx, wy, z)`, `getZone(game, addr)` (cache, else generate), `enterZone(game, addr, how, arrival)` and `changeZone` (replacing `game.js:217-259`), `neighbour(addr, side)`, LRU eviction of derived arrays, and idle pre-generation of neighbours. |
| `src/overworld/worldmap.js` | The **fixed** world: an ASCII-drawn grid of tiles, each with `{region, biome, elevation, edges: {n, e, s, w: road/river/wall ports}, landmark?, site?}`. Same every run; per-run variation only inside zones and in which optional sites are active. |
| `src/overworld/regions.js`, `factions.js`, `religions.js`, `landmarks.js` | Data tables: region tiers (feeding `level`), monster and NPC spawn tables by region, music mood, palette, fog. Factions and religions with reputation. Landmark plans as ASCII, like `story.js:53-75`, stamped with a roofless-capable `stampVault`. |
| `src/gen/surface.js` | `generateSurfaceZone(worldSeed, wx, wy, tile)` → Zone: terrain from world-coordinate noise, biome features, routing between edge ports, settlements, the dungeon entrance as `f.stairs`. Also `validateSurface(z)`: ports and entrance reachable. |
| `src/gen/dungeon.js` (changed) | `generateFloor(seed, depth)` becomes `generateDungeonLevel(seed, {level, index, count, hasUp: true, final, vaults, guardian, encounters})`. The specials for `depth === 0/1` and `FINAL_DEPTH` turn into options, and `W/D/H` become local `DUNGEON_*` constants. Keep `arrivalPoint` and add `"edge"` and `"travel"`. |
| `src/save.js` | `saveGame(game)`, `loadGame(slot)`, `listSaves()`, `deleteSave()`: whitelist serialisation (§5), Map/Set codecs, deflate, IndexedDB store, version migrations. Plus `ids.js` (or exports in `monsters.js` / `npcs.js`) for `get/setNextId`. |
| `src/clock.js` | Game-time calendar: `daylight(t)`, `sunDir(t)`, sky and fog colour, used by render3d, light (`litMask`), turns and monster perception. |
| `src/renderWorld.js` | New mode `"world"`: the overworld map and travel UI (turn-based, a step costs hours, random encounters drop you into a zone). Drawn with `screen.js` like `renderMap`. |
| `test-world.html` | Builds every landmark zone. Samples surface zones and checks that edge heights match neighbours and that ports and entrances are reachable. Generates every dungeon site. Round-trips saves (save → load → deep-equal). |

### Existing files that change

* **`world.js`**: methods to instance dimensions; add terrain blocks (sand, snow, road, leaves, trunk…) and `look` colours for the map. Remove or rename `FINAL_DEPTH`.
* **`game.js`**:
  * `game.depth/floors` → `game.zone/zones` (keep a `depth` alias);
  * `checkFloorEvents` adds edge exits;
  * `update()` gets an edge trigger;
  * `startRun` → `newGame` / `loadGame`;
  * a save-allowed guard;
  * a `"world"` mode in `step/draw/inputHandlers`.
* **`turns.js`**: `mapStep` and `planTravel` cross edges (`:143, 259`); `refreshView` uses daylight.
* **`render3d.js`**: per-zone fog and haze colour, a virtual horizon plane for missed rays (`:186-189`), sun from the clock, a baked sun lookup instead of the per-pixel ray (`:105-111`), `MAX_DIST` per zone.
* **`light.js`**: clamp at the edges (`:67`), a daylight-aware `litMask`, and an optional sun-visibility bake.
* **`renderMap.js`**: a terrain `look` layer, a zone-name header, edge-exit markers.
* **`hud.js`**: location label instead of `DEPTH n/20` (`:46, 64-68, 117`).
* **`music.js`**: mood from the region (`:67`).
* **`gen/vaults.js`**:
  * `stampVault` gets a roofless option (`:347-349`);
  * `pickVault` changes from a depth sequence to a level-gated random pick plus site-specific halls (`:332-338`).
* **`story.js`**: the temple becomes one landmark zone; the TAUNTS and epilogue become site or quest content.
* **`monsters.js`**: spawn tables by `(level, region tags)` instead of `depths` (`:316-325`); a faction field; id export.
* **`npcs.js`**:
  * encounters planned per site instead of per depth (`:118-134`);
  * quest text reads a zone name instead of "floor N";
  * data-driven villagers (faction, religion, dialogue templates) next to the hand-written `talkTo` cases;
  * id export.
* **`items.js`**: `randomTreasure`'s hard-coded 14-19 relic band (`:440`) becomes level-based; new gear and augmentation tables plug into the existing `bonus()` keys (`items.js:126-134`, `player.js:38-43`).
* **`effects.js` / `throwing.js`**: descent and teleport use the zone's "has a level below" instead of `FINAL_DEPTH` (`effects.js:48`, `throwing.js:176`).
* **Unchanged:** `raycast.js` (only `HOLE_Z` assumes the datum), `pathing.js`, `player.js`, `screen*.js`, `input*.js`, `audio.js`, `sfx.js`, `materials.js` (extend only with new blocks).

### Keeping both views working

* Both views read one zone object.
* The map path (`renderMap`, `turns`, `refreshView`, `planTravel`) and the 3D path (`render3d`, `raycast`, `light`, `player`) already take dimensions from the zone, so a zone that is a different size or outdoors works in both once the `Floor` methods are fixed.
* The only cross-cutting additions are the edge transitions, both in `game.update` (3D) and in `mapStep` (map), and the shared clock.
* The world-map mode is a third view; Tab still rotates between map and 3D inside a zone.

---

## Appendix: how the numbers were measured

* `…\scratchpad\fork\bench\bench.mjs` measures generation, determinism, `refresh`, sizes, and `render3d` on dungeon and synthetic outdoor zones at 4 sizes × 3 draw distances. It uses a `Zone` subclass with instance dimensions.
* `bench2.mjs` breaks one frame into traversal, light sampling, sun rays and screen size.
* `state.mjs` runs a simulated 20-floor run, walks the state for non-JSON fields, and sizes the save.
* `outsize.mjs` measures compressed outdoor block grids.
* All of them run against `bench/src/`, a copy of `src/` with `render3d.js` patched only to read `globalThis.__MAXD` for the draw-distance sweep.
* Browser numbers come from the real game in the desktop browser pane (`preview_start roguelike`, port 8124), timing `render3d`, `S.present` and `game.debug.draw` through dynamic imports. No input events were sent, so audio never started. The server was stopped afterwards.
