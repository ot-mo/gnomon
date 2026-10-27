# Technical design: the overworld fork of The Rotation Cube

Status: final architecture for implementation, revised after the adversarial review (`TECH_CRITIQUE.md`). Audience: the
agents who build the fork, phase by phase. Every `file:line` citation refers to `C:\Users\Otto Mörner\Code\ascii-roguelike\src\`
at commit `75edbd3` unless it names another file (`README.md`, `test.html`, the two surveys). Measured numbers come from
`engine-survey.md` §3 and §6 (Node 20.11 and the desktop browser pane).

---

## Changes after review

Every finding was checked against `src/` at `75edbd3`. All 33 hold on the code (one citation in #28 is wrong:
`input-browser.js` has 36 lines and passes only `e.code` at `:20-24`; the claim stands). #16 was reproduced on this machine:
Node 20.11 rejects `CompressionStream("deflate-raw")` and accepts `"deflate"`.

**Accepted as proposed:** #1 seams with owners (§8.3 dependency table), #2 golden traces and a bot from the first session,
#5 arrival helpers move to `zones.js` and read `zone.w/d`, #11 `skipTime`, game-time throttled targeting and budgets per
simulated second, #12 patches applied on every entry with a uid registry, #13 world-map viewport, #15 no `monsters` alias,
#16 `"deflate"` with feature detection, #18 talk option and service registries, #19 split 0A, 0D, WS6, #20 continuous
integration, #21 half-resolution outdoor 3D instead of a column cap, #22 `travel`/`edges` per terrain, #23 named legend
handlers, #24 file lists regenerated, #26 once-per-floor effects become game-time cooldowns, #28 `e.key`, top-screen-first
keys, pause from `onLockChange`, #29 generator RNG passed into spawns, #31 HUD priorities and an update registry, #32
`inspect` event, #33 plan wall height.

**Accepted with a different fix:**

| # | Decision |
|---|---|
| 3 | The Run's generated data is saved in the slot; `buildRun` runs only for a new game (§7.1). A `VERSION.gen` mismatch keeps the stored zones and warns that edges next to them may not line up. Keeping old generator versions is rejected: a static site can't ship two copies of every generator. |
| 4 | Currency is content (`content/currency.js`) behind `funds/pay/receive`; the engine ships a counter backing (P0) and an item backing (WS6b); a liquid backing with containers is a gated stretch. Thirst leaves Phase 1. `dram` and the other research-note units join the deny-list. |
| 6 | Seams are defined by the world function (§5.1). Fixed landmarks are folded into the world function as a flatten mask (their rects are fixed data); per-run sites keep a 6-tile edge margin instead of joining the mask. Trees are placed by world hash. |
| 7 | A 16-tile **voxel apron** per open side, copied from the neighbour zone when it is in memory (prefetch is required) and from the world function otherwise; physics beyond the edge reads the same apron. Crossing into a cached zone shows a toast, never the transition screen. |
| 8 | `inDark()` uses **natural light only** (sky × daylight), not lamps, so underground every puzzle behaves exactly as today (a lamp term would wash out brazier numerals and lit-room murals). |
| 9 | No buoyancy physics: on the surface deep water holds everyone up, as it holds swimmers today (`player.js:89-93`, `turns.js:57-60`); non-swimmers get `drowning` and a slowdown. One predicate, `solidFor(zone, e)`, serves both views. |
| 10 | Accepted, plus plateaus that need a jump are placed on purpose and counted by the validator. |
| 14 | Tier→level table in `RULES` (tiers 1-8 → surface levels 1-15, dungeons add their depth); legacy tables are read through `contentLevel()` = `min(level, 20)` until C3; `check-content` checks coverage. |
| 17 | Zones are written when you leave them; the unload save is a synchronous snapshot of the slot and the current zone. Classic marks a slot `live` while it is played; an unclean exit is shown and counted (`RULES.classic.unclean = "warn" | "death"`, default warn). |
| 25 | One persistent clock, `state.time` in seconds; time of day is a view of it; statuses tick exactly (closed form) during `skipTime`, so no cap is needed. |
| 27 | `blockLog` dropped; checkpoints are copy-on-write zone records. |
| 30 | The dungeon footprint sits under its entrance (`ox = clamp(entrance.x − 24, 0, 32)`); sinkholes only inside it; the level-1 sky well is dropped. |

**Rejected:** none outright. Rejected parts are noted in the table above (old generator versions in #3, the lamp term in
#8, buoyancy in #9, a per-run flatten mask in #6).

---

## 0. Summary and ground rules

**The fork in one paragraph.** A fixed, hand-authored world map (40×20 to 64×32 tiles, delivered as data) sits on top of
the existing voxel engine. Every world tile is a surface zone of 80×48×16 blocks generated per run from one world-coordinate
height function, so neighbouring zones meet within one block; beyond an open edge you see (and stand on) a 16-tile apron of
the neighbour. Some tiles have dungeons below them, built by the existing 48×48×10 generator with its parameters set by the
site. Inside a zone nothing about the two views changes: the same `Zone` object feeds the turn-based map (`turns.js`,
`renderMap.js`) and the real-time 3D view (`render3d.js`, `player.js`). A third mode, the world map, moves you between tiles
in hours of game time. Monsters and NPCs become one creature type with optional components (brain, faction, body,
inventory, talk, merchant). All numbers flow through one stat bus (`attr()`, `mod()`, `bonus()`), and every attack in either
view goes through one resolution function (d20 + AGI vs DV, penetration vs AV). Content (map, factions, landmarks,
creatures, items, currency, texts) lives in `src/content/` as data that registers itself. A save holds the run's generated
data, `game.state`, the player and every visited zone.

### 0.1 Ground rules (every phase follows these)

| # | Rule | Why |
|---|---|---|
| R1 | **One zone object, two views.** Anything that exists in a zone is read by both renderers from the same object. Every new mechanic states its *map form* and its *3D form* (Appendix B). | The house identity (README.md "Why you need both views"). |
| R2 | **Registries, not switches.** Item kinds, statuses, abilities, screens, keys, block uses, legend handlers, talk options, services, biome/site builders, AI hooks, HUD segments, per-frame updates and map overlays are registered by the module that owns them. Core code dispatches. | Today a new item kind touches about 12 switches in 6 files (content-survey §1.1). |
| R3 | **One stat bus, no baking.** Every number is derived on read from `attr()/mod()/bonus()`. Nothing adds gear or perk values into base fields. | Today `wear()` bakes STR and max HP (`player.js:47-53`) and `takePerk` bakes too (`leveling.js:75-76`). |
| R4 | **One attack resolution.** 3D swings, map bumps, thrown and fired projectiles, creature melee and creature arrows all call `resolveAttack()`. The view chooses the target; the dice decide the outcome. | Today melee damage lives in `attackMonster` (`monsters.js:747-805`) and creature hits always land (`monsters.js:473-481`). |
| R5 | **Persistent state is plain JSON.** Everything under `game.state`, the saved Run data, the player, and creature/item records contains only objects, arrays, strings, numbers and booleans. Sets become `{key: 1}` maps. Typed arrays live only on `Zone` and have a codec. | The survey's list of things `JSON.stringify` can't carry (engine-survey §5.2). |
| R6 | **Deterministic generation.** Generators read only seeded RNGs derived from `(runSeed, address, purpose)` and pass them into every helper they call (`spawnCreature(…, { rng })`, arrival yaw chosen by the caller). Cosmetic per-creature fields use a separate stream so the layout stream is untouched. `Math.random` is allowed at runtime (combat, animation), never in `gen/`, `world/`, `story/history.js`, `story/villages.js` or code they call. `check-determinism` scans those folders and compares an explicit field list (§9). | `spawnMonster` (`monsters.js:352-357`) and `landing` (`gen/dungeon.js:785`) use `Math.random` today. |
| R7 | **Data in `content/`, mechanics in code.** Content tables may hold small functions (as `RINGS[...].bonus(n)` does, `items.js:154-162`), but no engine module imports a specific content id. Units and names (currency, clock scale, statuses' display names) come from content. | The world content is being designed separately; the drafts already disagree on money (`concept-dense.md` *glim*, `parts/p1.md` *gills*). |
| R8 | **Original names only.** No Caves of Qud proper nouns, lore or signature wording, units included (`dram`, `parasang`, the water-sharing rite's wording, the research notes' names for genotypes, implant stations and psychic attention). `tools/check-names.mjs` fails on a hit in `src/`, `content/` or `index.html`. Code identifiers follow this document's neutral names (`pure`, `station`, `ritual`, `license`, `funds`). | Fixed decision; `concept-dense.md:115` bans the same words. |
| R9 | **No build step, no dependencies.** Plain ES modules served statically (GitHub Pages). Node checks use only Node built-ins (Node ≥ 20, recorded in `tools/README.md`). | Fixed decision; `README.md:49-61`. |
| R10 | **One clock: seconds of game time in both views.** `state.time` is the only persistent clock. Map actions cost the seconds they would take in 3D (`turns.js:1-6`, `turns.js:24-27`); cooldowns, statuses, spikes and sightings count the same seconds. Time of day is `state.time` read through `RULES.clock`. World travel and rest add seconds in bulk through `skipTime()`. | Keeps the views fair; removes the two-clock ambiguity. |
| R11 | **Seams before parallel work.** Every Phase 1 acceptance item that needs another workstream's output runs against a Phase 0 seam or fixture named in §8.3. Calling another workstream's exported function is allowed; editing its file is not. | Review #1. |
| R12 | **Light-based house rules go through `inDark()`.** Runes, ghost planks, ghosts and ghost NPCs, and the torch rules of perception, all ask `light.js` (§6.3). | Outdoors by day, "torch out" is normal (review #8). |

### 0.2 Glossary and fixed numbers

| Term | Meaning |
|---|---|
| **tile** | One cell of the world map, `(wx, wy)`. |
| **zone** | One voxel grid you walk around in. Address `"wx,wy,z"`: `z = 0` is the tile's surface, `z = 1..n` its dungeon levels. |
| **column** | One `(x, y)` of a zone, `x + y·w`. |
| **level** | A zone's difficulty number, the scalar that replaces `depth` in every balance curve. |
| **tier** | A world tile's danger band (1-8), from region data. `level` is derived from tier (plus dungeon depth). |
| **run** | Everything generated from the run seed on top of the fixed world data. Built once at a new game and **saved with the slot**. |
| **site** | A per-run placed thing on a tile: village, lair, ruin, historic site, landmark dungeon, station. |
| **landmark** | A fixed, named, hand-planned place at fixed world coordinates (data). |
| **apron** | A read-only band of the neighbour's voxels, 16 tiles deep, kept beyond each open edge of a surface zone (§5.1, §6.1). |
| **uid** | A stable string id for anything referenced across zones or before generation (`"legend:h3"`); `state.uids` says where each one lives. |

| Number | Value | Source |
|---|---|---|
| World map size | data-defined, validated to 40..64 × 20..32 | fixed decision |
| Surface zone | 80 × 48 × 16; the zone map fits without scrolling at ≥ 160 columns and ≥ 52 rows, and scrolls (as today, `renderMap.js:62-66`) below that | engine-survey §3; `renderMap.js:17`, `:57-66` |
| Dungeon level | 48 × 48 × 10 | where the validated generator lives (`world.js:5`, `gen/dungeon.js:857-909`) |
| Datum | `FLOOR_Z = 2` everywhere; terrain rises 0-3 blocks, cliffs and outcrops 4+ | `world.js:6`; engine-survey §1.1 |
| Level by tier | `RULES.level.byTier = [1, 3, 5, 7, 9, 11, 13, 15]`; a dungeon level adds `z · levelStep` | review #14 |
| Clock | `RULES.clock.secondsPerMinute = 1` (1 game minute per second of game time; a day is 1,440 s); content may change it | tunable |
| Apron | 16 tiles beyond each open side | §6.1 |

---

## 1. Directory and module layout

### 1.1 Tree

Owner tags: **P0** = created in Phase 0 and frozen as an interface (changed afterwards only by the integrator); **WSn** =
the Phase 1 workstream that owns the file afterwards (§8.4); **C** = content phase. `P0→WSn` means Phase 0 creates it
(often as a stub with frozen signatures) and WSn owns it in Phase 1.

```
index.html                 P0   canvas + src/main.js; title text from config
test.html                  P0→WS10  dungeon-level checks (kept, switched to the params API)
test-world.html            P0   runs every check listed in tests/checks/index.js in the browser
tools/                     Node-only scripts, no deps (Node ≥ 20; tools/README.md)
  node-env.mjs             P0 (0A1)  stub screen/input backends, memory storage, silent audio; works at 75edbd3 too
  golden-record.mjs        P0 (0A1)  run once at 75edbd3: records tests/fixtures/golden/*
  bot.mjs                  P0 (0A1, extended each session) → Integration   scripted play through game.debug, both views
  run-all.mjs              P0   runs every check-*.mjs; non-zero exit on failure
  check-golden.mjs P0        check-dungeons.mjs P0→WS10   check-determinism.mjs P0   check-blocks.mjs P0
  check-world.mjs P0→WS1     check-overworld.mjs WS1       check-edges.mjs P0→WS2     check-surface.mjs WS2
  check-landmarks.mjs P0→WS2 check-sites.mjs WS10          check-stats.mjs P0 (0B)    check-save.mjs P0→WS9
  check-combat.mjs P0→WS8    check-content.mjs P0→C        check-names.mjs P0         check-perf.mjs P0→WS3
  check-items.mjs WS5        check-progression.mjs WS4     check-social.mjs WS6a      check-story.mjs WS7
tests/
  checks/index.js          P0   the list of check modules (one line per file below; never edited after P0)
  checks/<ws>.js           P0 stub → each owner: overworld surface render progression items social story combat save dungeons
  fixtures/block-ids.json  P0   frozen block id list (append-only check)
  fixtures/golden/*.json   P0 (0A1)  mechanics traces, frame hashes and dungeon block hashes recorded at 75edbd3
src/
  main.js        P0   boot: backends, import features.js and content/index.js, open the title screen
  config.js      P0→WS9  GAME_ID, VERSION {save, gen, world}, URL flags (?seed ?silent ?debug ?quick)
  features.js    P0   one import line per workstream index (pre-created, never edited after P0)
  game.js        P0   state roots, step/draw loop, dispatch to screens/keys/updates; no feature logic after P0
  screens.js     P0   screen registry + mode stack
  keys.js        P0   key-binding registry (top screen first, then bindings, then "*" globals such as M and N)
  ui.js          P0   widget library (box, wrap, list, tabs, bar, textInput, hit-test)
  events.js      P0   event bus + per-frame update registry
  ids.js         P0   global entity id counter
  rules.js       P0   RULES: every tunable formula constant in one place
  time.js        P0   skipTime (bulk time for rest and travel), exact status/cooldown/regen catch-up
  currency.js    P0   funds/pay/receive over a content-defined currency and registered backings
  clock.js       P0 API → WS3 implementation (time of day as a view of state.time)
  rng.js         kept + hashInt/seedFor/fbm (P0)
  screen.js screen-canvas.js input.js pathing.js   kept (engine, frozen)
  input-browser.js   P0: passes e.key as well as e.code; frozen
  raycast.js     P0 (apron bounds, per-hit dark test) → WS3
  audio.js       kept + silent flag (P0)
  music.js sfx.js            WS3 (moods by region; voice objects instead of NPC type keys)
  blocks.js      P0   BLOCKS/B/KIND moved out of world.js + reserved ids (append-only)
  world.js       P0   Zone class (instance dimensions, apron, solidFor); re-exports blocks.js
  zones.js       P0   zone cache, change/enter, edges, arrival helpers, prefetch, patches, uid registry, derived-array LRU
  light.js       P0 API (lightAt, naturalLight, inDark) → WS3
  materials.js render3d.js renderMap.js     WS3 (renderMap's overlay/describer registries are P0)
  hud.js         P0 (segment registry with priorities) → WS9
  stats.js status.js body.js  P0 (frozen API; WS4/WS5 extend via registries)
  items.js       P0 (kind registry) → WS5
  creatures.js   P0 (monsters.js + npcs.js merged: types, spawn, sprites, touchable, helpers) → WS8
  ai.js combat.js            P0 (moved out of monsters.js) → WS8
  missiles.js    WS8  missile weapons (fire, reload, ammo) in both views
  factions.js    P0 stub → WS6a
  talk.js        P0 (dialogue, talk-option and service registries) → WS6a
  abilities.js   P0 API (with a stub requestTarget) → WS4
  player.js leveling.js       WS4
  inventory.js effects.js     WS5
  throwing.js turns.js        WS8
  interact.js traps.js guardians.js   WS10 (registerUse is P0 API inside interact.js)
  dialogue.js    WS6b (talk + trade screens; journal and story pages move out in P0)
  world/  worldmodel.js run.js P0;  sites.js P0 (fixture placement by region rules) → WS10
  gen/    dungeon.js vaults.js P0 → WS10;  surface.js P0 stub → WS2;  terrain.js ports.js apron.js biomes/*.js WS2
  overworld/  index.js travel.js discovery.js encounters.js rest.js renderWorld.js   WS1
  social/     index.js reputation.js builders.js (WS6a) · merchants.js ritual.js voices.js shrines.js backings.js liquids.js (WS6b)
  story/      index.js quests.js journal.js secrets.js history.js grammar.js villages.js gossip.js campaign.js   WS7
              (P0 creates stub quests.js/secrets.js/villages.js and a fixture-returning history.js with the frozen signatures)
  progression/ index.js chargen.js mutations.js   WS4
  bodymods/    index.js implants.js stations.js artifacts.js   WS5
  save/        index.js codec.js store.js save.js   P0 skeleton → WS9
  screens/     story.js transition.js levelup.js pause.js dead.js   P0 (ported from today's code)
               title.js log.js options.js WS9 · create.js charsheet.js abilities.js WS4 · equipment.js examine.js WS5
               factions.js WS6a · trade.js ritual.js WS6b · journal.js WS7 · worldmap.js WS1 · target.js WS8
  content/     index.js (P0) imports every content file
    world/     worldmap.js (C)  test-world.js (P0 fixture)  terrains.js regions.js landmarks.js plans/*.js (P0 schema + fixture, C fills)
    currency.js (P0 fixture: a plain counter → C)
    creatures/ legacy.js (P0: today's MONSTER_TYPES + NPC_TYPES)  wildlife.js WS2  villagers.js WS7  legends.js WS10
    items/     legacy.js (P0: today's tables)  missiles.js WS8  containers.js WS6b  artifacts.js implants.js WS5
    legacy/encounters.js (P0: today's talkTo cases and quests, mechanically moved)
    factions.js WS6a · liquids.js WS6b · mutations.js genotypes.js backgrounds.js powers.js WS4 · grammar.js quests.js villages.js WS7
    biomes.js WS2 · dungeons.js WS10 · encounters.js WS1 · moods.js WS3     (all → C for final data)
```

### 1.2 What happens to every existing file

| File | Fate | Notes |
|---|---|---|
| `world.js` | **changed (P0)** | `Floor` → `Zone` with instance `w,d,h`, renamed everywhere in 0A1 (no alias); `index/get/set/solid/standHeight/refresh/computeKinds` stop using the module constants (`world.js:100-176`). `BLOCKS/B/KIND` move to `blocks.js` (`world.js:16-63`). `FINAL_DEPTH` deleted (`world.js:9`). New: `solidFor(zone, e)` (the swimmer rule of `player.js:110-114` and `turns.js:57-60` in one place, plus surface deep water), the apron, `look`. |
| `game.js` | **rewritten (P0)** | `depth/floors` (`game.js:43-44`) → `zone/zones`; `enterFloor/changeFloor` (`game.js:217-259`) → `zones.js`; inputs (`game.js:510-575`) → `keys.js` bindings, with M and N as `"*"` bindings after the top screen (today they are intercepted first, `:513-520`); pause stays driven by `onLockChange` (`:571-574`); modal draws (`game.js:362-372`) → `screens.js`. The cube gate (`game.js:375-379`), `win()` (`game.js:65-70`) and guardian hooks (`game.js:88-111`) move to events and `campaign.js`. Second wind's per-floor flag (`:131-132`) becomes a player cooldown. |
| `gen/dungeon.js` | **changed (P0)** | `generateFloor(seed, depth)` (`:22-32`) → `generateDungeonLevel(seed, params)`; local 48×48×10 constants replace the imports (`:4`) for room layout and `findPath` only; `arrivalPoint/beside/landing/standWith` (`:756-792`) move to `zones.js` and read `zone.w/d`; `landing`'s `Math.random` yaw (`:785`) moves to the caller; `depth===0` temple (`:23`), `depth===1` no-stairs-up and sky well (`:144-160`, the well is dropped) and `FINAL_DEPTH` (`:166`, `:865`) become params; monsters spawn with a separate cosmetic RNG stream. |
| `gen/vaults.js` | **changed (P0)** | `stampVault` gets `opts = { roof, wallHeight }`: `wallCol` fills `FLOOR_Z .. FLOOR_Z + wallHeight − 1` (today always up to `ROOM_TOP`, `:348`; the default keeps today's vaults byte-identical); its letter switch (`:355-406`) becomes named legend handlers with a default letter map; `pickVault` (`:332-338`) and `GUARDIAN_HALLS` keyed by depth (`:305-328`) become id-keyed. |
| `monsters.js` | **split (P0)**, file removed | types and spawn → `creatures.js`; AI (`:392-505`, `:586-646`) → `ai.js`; combat (`:509-558`, `:656-826`) → `combat.js`; `MONSTER_TYPES` data → `content/creatures/legacy.js`. The five assignments to `.monsters` (`game.js:110`, `monsters.js:659`, `guardians.js:117`, `gen/dungeon.js:365`, `:412`) and every loop become `zone.creatures` or a helper (`hostilesTo`, `targetsFor`, `talkersIn`). |
| `npcs.js` | **split (P0)**, file removed | `NPC_TYPES` (`:47-68`) → creature types with a `talk` component; `talkTo` cases (`:283-493`) → `content/legacy/encounters.js`; quests (`:88-112`) → `story/quests.js`; shrines (`:166-246`) → `social/shrines.js`; `peddlerStock` (`:137-161`) → `social/merchants.js`; `planEncounters` (`:118-134`) deleted (sites plan encounters). |
| `items.js` | **changed (P0)** | kind switches (`:253-279`, `:292-341`, `:345-380`, `:452-468`, `:490`, `:498-523`) → `ITEM_KINDS` registry; tables move to `content/items/legacy.js`; the relic band `depth >= 14 && depth < 20` (`:440`) becomes a level range in `RULES`; `gold` pickups go through `currency.receive`. |
| `player.js` | **changed (P0)** | physics kept (`:96-184`), collision through `solidFor`; stats (`:35-89`) → `stats.js`; gear fields (`:22-25`) → `body.js`; timers (`:28`, `:30`) → `status.js`; `canSwim` (`:89`) reads `bonus(e, "swim")`. |
| `inventory.js` | **changed (P0), rewritten (WS5)** | `slot = it.kind` (`:86`) → `body.equip`; screen gets scrolling (fixed height today, `:159`). |
| `effects.js` | **changed (P0)** | timers (`:134-171`) → `status.js`; `FINAL_DEPTH` (`:48`) → `zone.hasBelow`; teleport (`:94-101`) uses `zones.arrivalPoint`; potion/scroll switches stay as consumable effects (WS5). |
| `throwing.js` | **changed (P0, WS8)** | `FINAL_DEPTH` (`:176`) → `zone.hasBelow`; `takeOne(p, stack)` (`:31-35`) moves to `items.js` as an export; map auto-hit (`:60-81`) → targeted projectile (WS8). |
| `turns.js` | **changed (P0)** | `H` import (`:10`, `:73`) → `zone.h`; `solidFor` (`:57-60`) → `world.solidFor`; edge exits at `:143` and `:259`; bump by attitude (`:148-162`); the lit test (`:114`) and the ghost rule (`:108`) call `light.js`. |
| `interact.js` | **changed (P0)** | `H` (`:3`, `:82`) → `zone.h`; `useBlock` (`:66-95`) dispatches through `registerUse`; NPC look (`:28-44`) → creatures with `talk`, ghost rule through `inDark`. |
| `hud.js` | **changed (P0)** | "DEPTH n/20" (`:117`), descend screen (`:62-69`), death text (`:46`), victory (`:51-61`) → zone names and campaign; the fixed status row (`:113-142`) → registered segments with priorities and an optional second row. |
| `renderMap.js` | **changed (P0 hooks, WS3)** | overlay and describer registries (describers are pure: drawing never changes state, `:186`); terrain look per column (today one grey `.` for floors, `:21-33`). |
| `render3d.js`, `light.js`, `materials.js`, `raycast.js` | **changed (P0 seams, WS3)** | P0: `lightAt/naturalLight/inDark` in `light.js`; `raycast.js` bounds extended over the apron (`:33-36`). WS3: horizon, haze, clock, baked sun (`render3d.js:21-25`, `:105-111`, `:186-189`; `light.js:27-28`, `:67`), per-hit dark test, half-column outdoor rendering. |
| `dialogue.js` | **changed (P0, WS6b)** | `wrap/box` (`:18-35`) → `ui.js`; journal (`:280-309`) → `screens/journal.js`; story pages (`:311-342`) → `screens/story.js`; Pell's hard-wired services (`:167-197`) → `registerService` entries; shop hard-wired to Pell (`:258`, `:175-192`, `:228`, `:243`) → generic trade (WS6b). |
| `story.js` | **removed (P0, 0A2)** | texts (`:14-44`) deleted; the temple plan (`:51-131`) becomes the fixture landmark plan `content/world/plans/fixture-temple.js` (exercises roofed stamping, spikes and mosaics on a surface zone). In 0A1 `buildTemple` still serves as the fixture tile's surface so the legacy game keeps running. |
| `guardians.js` | **kept (WS10)** | the three fights stay as AI hooks `guardian:flatqueen/warden/colossus`, renamed by content; `.monsters` assignment (`:117`) rewritten in 0C. |
| `traps.js` | **kept** | `game.depth` in spike damage (`:60`) → `zone.level`; spike phases keep reading `state.time` (`:21`). |
| `leveling.js` | **kept (WS4)** | perks become "powers" content; `offerPerks` uses `Math.random` (`:63`) → seeded per level-up. |
| `music.js`, `sfx.js` | **changed** | storage keys `rotation-cube-*` (`music.js:36,53`, `sfx.js:15,21`) → `config.storageKey()`; mood by region (`music.js:67`); `speakLetter(ch, voice)` takes a voice object, falling back to a neutral voice instead of Maren's (`sfx.js:203`). |
| `input-browser.js` | **changed (P0)** | `onKeyDown(e.code, e.repeat)` (`:20-24`) → `onKeyDown(e.code, e.repeat, e.key)`, so text fields get layout-correct characters (ö is `Semicolon` as a code). |
| `rng.js`, `pathing.js`, `screen*.js`, `input.js`, `audio.js` | **kept** | additions only (`rng.hashInt`, `audio` silent mode). `raycast.js:16` `HOLE_Z` stays valid because the datum stays at `FLOOR_Z = 2`. The screen column cap (`screen-canvas.js:3`) is never changed at runtime (`resize()` clears the glyph cache, `:27`). |
| `learn/`, `README.md` | kept; README rewritten in Phase 4 | |

### 1.3 Rotation Cube content: removed, kept, optional

* **Removed from the runtime:** the story text and taunts (`story.js:14-44`); Maren and every Hollowmere reference
  (`npcs.js:48-49`, `:289-322`, `:353`, `:439`); the cube item and its Tab gate (`items.js:246, 317, 337, 513`;
  `game.js:73-83`, `:375-379`); `FINAL_DEPTH` and the win on the boss's death (`world.js:9`, `monsters.js:695`); the
  per-depth plans (`npcs.js:118-134`, `gen/vaults.js:328-338`); "PELL'S PACK" (`dialogue.js:258`).
  **Tab works from the first second of a new game.**
* **Kept as mechanics (content renames them):** the 8 puzzle vaults (`gen/vaults.js:32-105`); guardian fights
  (`guardians.js`) and the boss phase logic (`monsters.js:562-583`) as AI hooks; flat beings, flatlings and the
  flat-NPC rule; ghosts and ghost planks; runes and murals; mosaics; spike traps; secret rooms; elites (`monsters.js:276-283`);
  elements (`items.js:58-63`); unique relics (`items.js:182-212`); unidentified consumables (`items.js:12-55`); perks
  (`leveling.js:8-35`) as powers; shrines as a talking statue component; the dungeon encounter archetypes (wounded traveller,
  prisoner behind bars, cartographer, bounty hunter, ghost, two flat siblings) as encounter templates.
* **Optional lore:** the Rotation Cube and "flat vs deep seeing" may survive in the campaign. The code keeps the camera
  swing of the `rotate` mode (`game.js:328-342`) as a reusable `cameraSwing()` effect for a campaign moment, and nothing in
  the core mentions a cube.

### 1.4 Module interfaces

Signatures are the frozen contracts Phase 1 builds on. `game` is the single game object; `e` is any entity (the player or a
creature); `c` is a creature; `zone` is a `Zone`.

#### Core shell (P0)

```js
// config.js
export const GAME_ID, VERSION = { save: 1, gen: 1, world: 1 };   // world bumps when the fixed map data changes
export const FLAGS = { seed, silent, debug, quick };              // from the URL
export const storageKey = (name) => `${GAME_ID}:${name}`;

// screens.js
export function registerScreen(mode, def);   // def: { draw(game), key?(game, code, repeat, key) → bool, mouse?(game, button, cell),
                                             //        hover?(game, cell), wheel?(game, sign), update?(game, dt),
                                             //        pausesTime = true, pointer = "unlock" | "lock" | "keep", over = "view" | "none",
                                             //        saveable = false }
export function pushMode(game, mode, data);  // remembers what to return to (replaces invReturn/journalRet/levelReturn/talk.ret)
export function popMode(game, result);
export function setMode(game, mode, data);   // replaces the whole stack (title, dead, world)
export const topMode = (game) => game.mode;

// keys.js  (order: the top screen's key() first; then bindings for the mode; then "*" bindings such as M and N)
export function bind(mode, code, handler, { repeat = false, help = "", when } = {});  // mode: a mode, "play" (explore+map) or "*"
export function dispatchKey(game, code, repeat, key) → bool;                          // key = e.key, for text fields
export function helpFor(mode) → [{ code, help }];

// events.js
export function on(type, handler, { priority = 0 } = {}) → off;
export function emit(game, type, payload);
export function registerUpdate(id, (game, dt) => void, { modes = ["explore", "map"], every = 0 });  // per-frame hooks
                                             // (autosave timers, clock events, prefetch); game.js runs them after the mode's update

// ids.js
export function nextId() → int;  export function getIds() → { entity };  export function setIds(s);

// rules.js
export const RULES;   // §2.6, §2.7, §3.2, §5 and §7 list the fields

// time.js  (P0, frozen)
export function skipTime(game, seconds, { interruptible = true, reason }) → { elapsed, interrupted, why };
//   advances state.time; statuses, cooldowns and regen catch up exactly (closed form, §2.7); idle creatures stay put;
//   stops early (interruptible) when a hostile is awake within RULES.activeRadius or something hurts you;
//   calls clock.catchUp(game, t0) so hour/dawn/dusk events fire once each; emits "time:skip"

// clock.js  (P0 stub: noon forever; WS3 implements, always as a view of state.time)
export function minutes(game) → number;      // state.time / RULES.clock.secondsPerMinute + RULES.clock.startMinute
export function timeOfDay(game) → 0..1;  export function daylight(game) → 0..1;  export function lightBucket(game) → int;
export function sunDir(game) → [x, y, z]; export function skyColors(game) → { zenith, horizon };
export function fogFor(game, zone) → { color, density };  export function catchUp(game, t0);

// currency.js  (P0 counter backing; WS6b registers "item" and, if content asks, "liquid")
export const CURRENCY;                       // from content/currency.js: { id, name, plural, unit, glyph, color, backing: { kind, … } }
export function registerBacking(kind, { funds(e), pay(game, e, n) → bool, receive(game, e, n) → overflow });
export function funds(e) → n;  export function pay(game, e, n) → bool;  export function receive(game, e, n) → overflow;
export function formatPrice(n) → string;     // "12 coin" from CURRENCY, never a unit written in code

// ui.js  (§4.4)
```

#### World and zones (P0)

```js
// world.js
export const FLOOR_Z = 2, ROOM_TOP = 6, CORRIDOR_TOP = 4;
export const SURFACE = { w: 80, d: 48, h: 16 }, DUNGEON = { w: 48, d: 48, h: 10 }, APRON = 16;
export class Zone { constructor({ key, wx, wy, z, type, level, tier, seed, w, d, h }); /* §2.2 */ }
export function solidFor(zone, e) → (x, y, z) => bool;   // solid, or deep water when e floats there (swimmer, or any body on a surface zone)

// zones.js
export const zoneKey = (wx, wy, z) => `${wx},${wy},${z}`;
export function parseKey(key) → { wx, wy, z };
export const ZONE_GENERATORS = { surface: null, dungeon: null };   // WS2 and WS10 register
export const APRON_BUILDERS = { surface: null };                    // WS2 registers; P0 stub fills from heightAt
export function cachedZone(game, key) → Zone | null;
export async function getZone(game, key) → Zone;      // memory cache → saved record (WS9 loader) → generate + seal
export async function changeZone(game, addr, arrival, message);   // sync when cached (toast), transition screen only while waiting
export function enterZone(game, zone, arrival);       // place the player, apply pending patches, reset flow/travel/effects (game.js:233-238)
export function neighbourAddr(game, addr, side) → addr | null;     // world bounds and the terrain's `edges` rule
export function tryWalkOff(game, side, along) → bool; // called by the 3D update and by mapStep
export function prefetchNeighbours(game);             // registered update: map mode at once, 3D within 16 tiles of an open edge
export function zoneBelow(game, zone) → addr | null;  export function zoneAbove(game, zone) → addr | null;
export function dungeonOffset(game, surfaceZone) → { ox, oy };     // where the 48×48 levels sit under the 80×48 tile (§5.5)
export function arrivalPoint(zone, how, opts) → { x, y, z };       // moved from gen/dungeon.js:756-792; uses zone.w/d;
//   how: "down" | "up" | "fall" | "edge" | "travel" | "load" | "teleport"; opts: { fx, fy, side, along, fromStand, rng }
export function addZonePatch(game, key, patch);       // §2.2; applied on every entry, idempotent by uid
export function claimUid(game, uid, key) → bool;  export function uidWhere(game, uid) → key | "dead" | null;  export function killUid(game, uid);
export function keepDerived(game, n = 2);             // LRU of zones that keep light/stand arrays

// world/worldmodel.js
export function compileWorld({ WORLD, TERRAINS, REGIONS, LANDMARKS, PLANS }) → WorldModel;   // §2.1; cached per VERSION.world
export function validateWorld(model) → string[];

// world/run.js
export function buildRun(seed, world) → Run;          // new games only; pure function of the seed and the static data, ≤ 200 ms
export function serializeRun(run) → RunData;          // JSON (R5), saved in the slot (§7.1)
export function restoreRun(data, world) → Run;        // loads never call buildRun
export function zoneSeed(run, wx, wy, z) → uint32;
export function runRng(run, ...purpose) → rng;        // makeRng(seedFor(run.seed, ...purpose))

// world/sites.js  (P0: real placement from fixture region rules and landmark dungeons → WS10 extends)
export function placeSites(run) → { sites: Map, sitesAt: Map };
export function dungeonSpec(run, site) → DungeonSpec;
```

#### Generation

```js
// gen/dungeon.js  (P0 API → WS10)
export const DUNGEON_W = 48, DUNGEON_D = 48, DUNGEON_H = 10;   // room layout and findPath only
export function generateDungeonLevel(seed, p) → Zone;
//   p = { key, wx, wy, z, level, tier, index, count, final, theme, hasUp = true, forcedVault, vaultPool,
//         gimmicks: [id], bottom: { kind, id, uid }, encounters: [...], creatureTable, holesIn: rect | null, simpleAfter = 25 }
export function validateDungeonLevel(zone, p) → string[];      // today's validateFloor, final from p
export function legacyParams(depth) → p;                       // reproduces generateFloor(seed, depth) for the golden check
export const GIMMICKS = {};          // id → (zone, rng, rooms, p) => void, run after step 10 (dungeon.js:249-274)
export const DUNGEON_THEMES = {};    // id → { rooms: [{ wall, floor }], darkRate(level), count(level), liquid, creatureTable, vaultPool }

// gen/vaults.js  (P0 → WS10; WS2 and WS7 use stampVault and registerLegend)
export function pickVault(rng, p) → vault;
export function stampVault(zone, plan, vx, vy, rng, opts = { roof: "rock", wallHeight: ROOM_TOP - FLOOR_Z, baseZ: FLOOR_Z }) → entrance;
export function registerLegend(id, (ctx) => void);   // named handler; throws on a duplicate id
export const DEFAULT_LEGEND;          // { "#": "wall", "~": "chasm", "1": "step1", … } today's letters (gen/vaults.js:355-406)
//   a plan may carry legend: { ch: id } to map its own letters; ctx = { zone, x, y, z0, top, plan, rng, cells, opts }
export const VAULTS, GUARDIAN_HALLS /* id-keyed */, BOSS_HALLS;

// gen/surface.js  (P0 stub: world-function terrain + matching edges + ports + the site entrance → WS2)
export function generateSurface(run, wx, wy) → Zone;
export function validateSurface(zone, ctx) → string[];
export function heightAt(run, gx, gy) → { h, cliff };  // world-coordinate terrain (gx = wx·80 + x), landmark flatten mask included
export function treeAt(run, gx, gy) → { height, canopy } | null;   // world-hash trees, so both zones agree across an edge
export function edgePorts(run, wx, wy) → { n: Port[], e, s, w };   // Port = { kind: "road"|"river"|"path", at, width }
export const BIOME_BUILDERS = {};    // biome id → (ctx) => void
export const SITE_BUILDERS = {};     // site kind → (ctx, site) => void   (WS7 village, WS10 dungeon/lair/ruin/historic/station)
// ctx = { run, zone, tile, site, rng, level, heightAt(x, y), groundZ(x, y), reserve(rect, tag) → bool, reserved(x, y),
//         stamp(plan, x, y, opts) → entrance, carve(points, width, block), placeCreature(type, x, y, opts),
//         placeItem(item, x, y), setEntrance(x, y), ports, margin: 6 }
```

#### Entities and rules (P0, then extended by registries)

```js
// stats.js
export const ATTRS = ["str", "agi", "tou", "int", "wil", "ego"];
export function registerBonusSource(name, (e) => Iterable<bonusObject>);   // gear, implants, mutations, powers, statuses, innate
export function bonus(e, key) → number;           // sums every source (cached per entity, §2.6)
export function invalidateStats(e);              // call after equip, status change, mutation, level-up
export function attr(e, k) → number;  export function mod(e, k) → number;
export function maxHp(e), av(e), dv(e), ma(e), speedMul(e), cooldownMul(e), carryCap(e), priceMul(game, e, trader);
export const contentLevel = (level) => Math.min(level, RULES.level.contentMax);   // 20 until C3 retunes the tables

// status.js
export function registerStatus(id, def);         // §2.7
export function addStatus(game, e, id, { t, mag = 1, src }) ;  export function removeStatus(game, e, id);
export function hasStatus(e, id) → bool;          export function statusLeft(e, id) → seconds;
export function tickStatuses(game, e, dt);        // both views: game.js update() and turns.js passTime() already tick effects (game.js:285, turns.js:44)
export function catchUpStatuses(game, e, seconds); // exact bulk version for skipTime
export function statusFlag(e, flag) → bool;       // noAct, noMove, flying, hidden, untouchable, noRegen

// body.js
export const BODY_PLANS = {};  export function registerBodyPlan(id, parts);
export function makeBody(planId) → Body;
export function slotsFor(e, item) → partId[];     export function canEquip(game, e, item, partId) → { ok, reason };
export function equip(game, e, item, partId) → { ok, removed: [], time };
export function unequip(game, e, partId) → { ok, item, reason };     // keeps the curse lock (inventory.js:88-91)
export function worn(e) → item[];   export function wielded(e) → item;   export function offhands(e) → item[];
export function swapBelt(game, e) → seconds;       // today's swapWeapons (inventory.js:113-127)
export function addPart(e, part);   export function removePart(e, partId);

// items.js
export function registerItemKind(kind, def);      // §2.9
export function itemName(game, it), itemGlyph(game, it), itemInfo(game, it), itemDetails(game, it), itemPrice(it),
               itemWeight(it), itemAura(game, it), itemSprite(game, it, time), itemBonuses(it), stackKey(it);
export function addToInventory(e, it) → stack;  export function takeOne(e, stack) → item;   // moved from throwing.js:31-35
export function pickUpItems(game);
export function makeItem(item, x, y, z);  export function awayFromWalls(zone, x, y, z);   // items.js:474-485, kept

// creatures.js
export function registerCreatures(table);         // §2.3 / §2.18
export function spawnCreature(type, tx, ty, z, opts) → Creature;
//   opts = { rng /* required inside generators */, state, level, elite, uid, faction, name, talk, merchant, inv, temperament, leader }
export function creatureAt(zone, x, y) → Creature | null;     // monsterAt (monsters.js:383-387)
export function creatureSprite(game, c) → sprite | null;      // monsterSprite + npcSprite (monsters.js:361-380, npcs.js:79-84)
export function touchable(game, target, attacker) → bool;     // monsters.js:288-294, generalised, ghost rule via inDark
export function hostilesTo(game, e) → Creature[];  export function targetsFor(game, e) → entity[];  export function talkersIn(zone) → Creature[];
export function creaturesNear(zone, x, y, r) → Creature[];    // spatial buckets (8×8 tiles), rebuilt once per creature update
export const isFlat = (c) => …, isGhostly = (c) => …, canTalk = (c) => !!c.talk;
export function pickCreatureType(rand, level, table) → type;  // pickMonsterType (monsters.js:316-325), reads contentLevel(level)
export function rollElite(rand, level) → eliteId | null;       // monsters.js:328-332

// ai.js
export const AI_HOOKS = {};   // "guardian:flatqueen", "boss", "legend", "villager", "merchant", "follower" → (game, c, dt, occ) → handled
export function updateCreatures(game, dt, radius = Infinity);  // updateMonsters (monsters.js:392-505)
export function pickTarget(game, c) → entity | null;          // every 0.25 s of game time, from creaturesNear
export function flowTo(game, target) → Int16Array | null;     // a flow field toward the player only (as monsters.js:399-403); creature targets use greedy steps

// combat.js  (§3)
export function attackSpec(e, { slot = "primary", item } = {}) → Spec;
export function rollToHit(att, tgt, spec, ctx) → { nat, total, dv, hit, crit };
export function penetrations(pv, av, rng) → int;
export function rollDamage(spec, rng) → int;
export function resolveAttack(game, att, tgt, spec, ctx) → Result;
export function applyDamage(game, tgt, dmg, { source, label, color, type }) → int;
export function killCreature(game, c, { message, source, dropLoot = true });
export function playerMelee(game);          // 3D swing (monsters.js:713-736)
export function bumpAttack(game, target);   // map bump (turns.js:155-162)

// light.js  (P0 API with today's semantics and daylight = 1; WS3 implements daylight)
export function lightAt(game, zone, x, y, z) → { sky, lamp };       // sampleLight over skyLight × daylight and lampLight (light.js:57-75)
export function naturalLight(game, zone, x, y, z) → 0..1;           // sky × daylight only
export function inDark(game, zone, x, y, z) → bool;                 // !player.torch && naturalLight < RULES.dark.threshold
export function zoneIsLightless(zone) → bool;                       // no sky anywhere: the per-frame fast path (render3d.js:168-169)

// factions.js  (P0 stub: monsters hostile, talkers neutral → WS6a)
export const REP_BANDS = ["hated", "disliked", "indifferent", "liked", "loved"];
export function repOf(game, factionId) → n;  export function addRep(game, factionId, n, reason);
export function band(rep) → bandName;        export function attitude(game, a, b) → "hostile"|"wary"|"neutral"|"friendly"|"unaware";

// talk.js
export function registerDialogue(id, (game, c) => node);   // node contract unchanged: { text, options: [{ label, go }] } (npcs.js:9-11)
export function registerTalkOptions(id, (game, c) => option[] | null, { priority = 0 });   // appended to the root node of any talker
export function registerService(id, { label(game, c, target), price(game, c, target), available(game, c) → target[],
                                      run(game, c, target), info });   // Pell's list today (dialogue.js:167-197)
export function servicesFor(game, c) → [{ id, target }];   // c.merchant.services filtered by available()
export function talkTo(game, c) → node;                     // dispatches on c.talk.dialogue, then appends registered options
export const node = (text, options) => ({ text, options }), bye = (label) => ({ label, go: () => null });

// abilities.js  (P0 API → WS4)
export function registerAbility(id, def);                  // §2.8
export function abilitiesOf(e) → [{ id, lvl, source, item }];
export function cooldownLeft(e, id);  export function startCooldown(e, id, seconds);
export function activate(game, e, id, target) → bool;
export function requestTarget(game, ability, done);        // 3D: aimTarget now; map: P0 stub picks the nearest visible hostile,
                                                           // WS8 replaces it with the target screen behind the same signature
export function aimTarget(game, range) → { creature, point, tile, dir };

// hud.js  (P0 registry → WS9)
export function registerHudSegment(id, { priority, row = 0, draw(game, x, y, maxW) → width });   // lowest priority dropped first

// renderMap.js  (P0 registries → WS3)
export function registerMapOverlay(id, (game, view) => void);  export function registerDescriber(id, (game, tile) → string | null);

// interact.js  (P0 API → WS10)
export function registerUse(blockOrKind, (game, x, y, z) → seconds | 0);
```

#### Feature modules (Phase 1; each folder's `index.js` registers everything)

```js
// overworld (WS1)
enterWorldMap(game) · worldStep(game, dx, dy) → result · fastTravel(game, to) · leaveWorldMap(game, { at: "edge"|"center"|"site" })
rest(game, { until: "healed" | seconds }) → result · reveal(game, wx, wy, radius) · isKnown(game, wx, wy) · pin(game, wx, wy, { label, secretId }) · renderWorld(game)
// social (WS6a/6b)
openTrade(game, c) · openRitual(game, c) · priceOf(game, it, trader, side) · voiceFor(c) → voice · liquidAt(zone, x, y)
// story (WS7)
generateHistory(seed, world) → History · generateVillage(run, site) → Village
startQuest(game, templateId, params) → quest · learnSecret(game, id, source) · gossipFor(game, c) → text · expand(grammar, symbol, rng, ctx)
// progression (WS4)
makeCharacter(choices) → player · mutationOffers(game, p, rng) → ids · gainMutation(game, p, id) · raiseMutation(game, p, id)
// bodymods (WS5)
canInstall(game, p, item, partId) · install(game, p, item, partId) · uninstall(game, p, partId) · examineArtifact(game, p, it) → result
// save (WS9)
saveGame(game, { reason }) → Promise · loadGame(slotId) → Promise<game> · listSlots() · deleteSlot(id) · checkpoint(game)
```

---

## 2. Core data models

### 2.1 World (fixed map) and Run (per seed, saved)

Two layers, deliberately separate:

| Fixed every run (content data, `content/world/*`) | Generated once per run by `buildRun(seed)`, then saved with the slot |
|---|---|
| terrain per tile, regions and their tiers, elevation hints | villages, lairs, ruins, historic sites: which candidate tiles, their names, rects and contents |
| roads and rivers as tile paths | dungeon specs under sites (levels, theme, gimmicks, bottom) |
| landmarks: id, name, coordinates, plan, rect, fixed dungeon shape | the ancient history, relics, legendary creatures, village factions and relations |
| faction homelands and relations; the currency | secrets and their texts, merchant tables, quest seeds |
| start landmark | (zone layouts are generated per zone from `zoneSeed`, and stored once visited, §7) |

```js
WorldModel = {
  w, h, version, tiles: Tile[w*h], tileAt(wx, wy), inBounds(wx, wy), canTravel(wx, wy, viaRoad), edgeOpen(wx, wy, side),
  neighbours(wx, wy), landmarks: Map<id, Landmark>, landmarkAt(wx, wy), start: { wx, wy, landmarkId },
  flatten: [{ wx, wy, rect, z }],                 // fixed landmark footprints + skirts, read by heightAt (§5.3)
  edgeId(wx, wy, side) → "wx,wy,e" | "wx,wy,s"    // canonical id shared by both tiles of an edge
}
Tile = { wx, wy, terrain, region, tier, elev, biome,
         travel: "yes" | "no" | "road",           // world-map movement ("no": mountains you can only walk into, review #22)
         edges: "open" | "solid",                  // whether zone edges into this tile are walkable
         travelHours, lostChance, encounterRate, road: { n, e, s, w }, river: { n, e, s, w }, landmark: id | null, music }

Run = {
  seed, genVersion, world: WorldModel /* compiled, not saved */,
  history: History,                          // §2.15
  sites: Map<siteId, Site>, sitesAt: Map<"wx,wy", siteId[]>,
  villages: Map<siteId, Village>,            // §2.16 (data only; layouts are made with the zone)
  factions: Map<id, FactionDef>,             // static FACTIONS + generated village factions
  relations: Map<"a|b", -1 | 0 | 1>,         // static + generated feuds and pacts
  legends: Map<uid, LegendDef>,              // named creatures from history and lairs
  secrets: Map<id, SecretDef>,               // every learnable secret this run (§2.14)
}
Site = { id, kind: "landmark"|"village"|"lair"|"ruin"|"historic"|"dungeon"|"station", at: { wx, wy }, name, tier,
         uid?, factionId?, historyRef?, landmarkId?, checkpoint?,
         surface: { builder, rect: { x, y, w, d } /* ≥ 6 tiles from every edge unless a landmark */, params },
         dungeon?: DungeonSpec }
DungeonSpec = { levels, theme, baseLevel, levelStep = 1, gimmicks: [id], vaultPool?, named?: [levelName],
                bottom: { kind: "guardian"|"legend"|"relic"|"boss"|"none", id, uid? }, encounters?: [...] }
```

`buildRun` order: `compileWorld` (cached per `VERSION.world`) → `generateHistory(seed, world)` (WS7; P0 returns a fixture) →
`placeSites(run)` (P0 places landmark dungeons and villages, ruins and lairs by the region rules of the data; WS10 adds
history's site requests, lairs with legends, stations) → villages data (WS7) → factions and relations → legends → secrets.
Each step uses its own `runRng(run, "history")`, `runRng(run, "sites")`… so a change in one step never reshuffles another
(R6). `serializeRun(run)` turns the Maps into arrays of pairs; a load calls `restoreRun`, never `buildRun` (§7.1), so a
generator change can't move a site or rename a quest giver under an existing save.

### 2.2 Zone

```js
class Zone {
  // identity
  key; wx; wy; z;            // "wx,wy,z"; z = 0 surface, 1..n dungeon levels under the tile
  type;                      // "surface" | "dungeon"   (floor.kind is already the KIND array, world.js:73)
  level; tier; seed; genVersion; name; siteId; landmarkId;
  w; d; h;                   // 80×48×16 or 48×48×10
  // persistent grids (saved)
  blocks /* Uint8Array w·d·h, index x + y·w + z·w·d (world.js:100) */; seen; holeSeen /* Uint8Array w·d */;
  // derived (rebuilt by refresh(); dropped when dormant)
  kind; stand; look /* Uint8Array w·d: block id that sets the column's map glyph */;
  skyLight; lampLight; litMask; sunlit /* Uint8Array w·d·h, WS3 */; navVersion;
  apron = { n, e, s, w, ne, nw, se, sw };   // surface only: Uint8Array voxel bands, APRON (16) tiles deep, null for solid sides
  // outdoors
  hasSky;                    // existing switch for sun and sky dome (world.js:97, render3d.js:106, :188)
  outdoor;                   // apron + horizon + haze + daylight (§6)
  edges = { n, e, s, w };    // true = you can walk off that side (surface only)
  liquid = "water";          // default liquid of water blocks; liquids: { [column]: liquidId } overrides (§2.10)
  hasBelow;                  // a dungeon level exists below (holes may drop you; surface water never does, §5.3)
  dungeonRect;               // surface only: where the dungeon below sits, { ox, oy, w: 48, d: 48 } (§5.5)
  // contents (as today, world.js:78-96)
  creatures; items; props; projectiles; clouds; bombs; markers; sightings /* Map → entries in the codec */;
  links; groups; braziers; secret; secretWalls; spikes; rooms; vault; guardianHall;
  spawn; stairs; upStairs; entrance;
  flags = {};                // zone facts (waterHint turns.js:213, vaultHinted game.js:299, …); NOT once-per-floor
                             // player effects, which become player cooldowns (§2.4)
  appliedPatches = {};       // patch ids already applied here
  // bookkeeping
  sealed = false; dirty = false; lastTime;

  index(x, y, z); get(x, y, z); set(x, y, z, id);   // set() marks dirty once sealed
  solid(x, y, z);            // beyond an open side: the apron's voxel; beyond a solid side or the top: true; below: false
  standHeight(x, y, doors);  // world.js:124-137, without the per-column closure (a refresh() cost, engine-survey §3)
  refresh();                 // light + stand + kind + look (+ apron, sun bake hook), navVersion++  (world.js:140-146)
  ensureDerived(); dropDerived(); get hasDerived();
  seal();                    // end of generation: from here on set() marks the zone dirty
}
```

No migration aliases: `Floor` is renamed in 0A1 and `zone.monsters`/`zone.npcs` are rewritten in 0C (§8.2; a grep gate
checks it).

**Addressing and lookups.** `zoneKey` strings key `game.zones` (a `Map`, as `game.floors` is today, `game.js:44`). Vertical
moves stay `z ± 1` at the same tile (`game.js:154-169`); horizontal moves exist only at `z = 0`.

**Lifecycle.**

```
            generate (ZONE_GENERATORS[type]) ─┐
saved record (WS9 loader, async) ─────────────┼─► seal ─► IN MEMORY ──enterZone──► ACTIVE: pending patches applied
                                              │              ▲                       (derived arrays present)
                                              │              │ prefetch               │ leave: write-behind save (§7.3)
                                              │              │                        ▼
                                              └────────── DORMANT (blocks + seen + entities; derived dropped once
                                                           two newer zones are active; evicted from memory after
                                                           RULES.zones.keep = 24 dormant zones, already saved)
```

**Generation and prefetch.** A zone is generated on demand, never as a batch (engine-survey §4: 20-40 ms typical dungeon,
134 ms worst; surface budget §6.7). `prefetchNeighbours` (a registered update) makes edge crossings instant: in map mode it
generates or loads every missing open neighbour at once (time is stopped between actions); in 3D it does so when you come
within 16 tiles of an open edge, at most one zone per frame (one ≤ 60 ms hitch, measured by `check-perf`). Stored
neighbours are read from IndexedDB asynchronously, without a hitch. Generation modules import nothing that touches the DOM,
so a module Worker can take generation off the main thread later (WS2 stretch).

**Changing zones.** `changeZone` returns at once when the target is in memory: the swap happens in the same frame and the
zone name shows as a HUD toast. Only when the target must be read from IndexedDB does the transition screen (today's "DEPTH
n" screen, `game.js:254-259`, `hud.js:62-69`) cover the wait; it swallows input and stops time. Stairs and travel may still
show it on purpose (a beat of drama), for `RULES.transition.stairs` seconds.

**Derived-array eviction.** Light, stand, kind, look, apron and sun arrays are about 600 KB at 80×48×16 against 61 KB of
blocks (engine-survey §3). `keepDerived(game, 2)` keeps them for the current and the previous zone and drops them from older
zones. Re-entering costs one `refresh()` (≤ 8 ms budget). A dormant surface zone weighs about 80 KB with entities.

**Zone patches and uids.** `game.state.zonePatches[key] = [{ id, op, uid?, relativeTo?: "arrival" | "entrance" | null, ... }]`
lets quests, encounters, history and followers put things into zones, visited or not (`spawnCreature`, `placeItem`,
`setFlag`, `removeUid`). `enterZone` applies every pending patch for the zone **on each entry**, after the arrival point is
known (so `relativeTo: "arrival"` can place a band 8-12 tiles from you), skips ids in `zone.appliedPatches`, and then
deletes them. `state.uids = { [uid]: zoneKey | "dead" }` makes a uid live in at most one zone: generation, lairs and
patches call `claimUid` first and skip a uid that lives elsewhere or is dead, so a legend met on the road is not also
waiting in its lair, and a killed legend never returns.

### 2.3 Creature (monsters and NPCs unified)

Today monsters (`monsters.js:341-358`) and NPCs (`npcs.js:71-73`) are separate lists; NPCs have no HP, never move and
can't be attacked (`turns.js:148-153`; `monsters.js:407`). The fork keeps one list, `zone.creatures`, of plain objects:

```js
Creature = {
  // as today (monsters.js:341-358)
  id, type, elite, guardian, name, glyph, color, w, h, hp, maxHp, xp, tx, ty, nx, ny, p, x, y, z, cd, hurt, anim,
  think, lost, pause, shot, phase, sees, regenAcc, ward, venom, drain, burns, speedMul, cdMul, armour,
  // new, all optional (components)
  uid,                           // stable cross-zone id from generation/history ("legend:h3", "village:12:elder")
  level,                         // drives natural attack PV and HP scaling (today `bonus`, monsters.js:346)
  attrs,                         // optional; else derived from type and level
  status: {}, cooldowns: {},     // §2.7, §2.8 (replace m.burn/chill/stun/blind/poison/haste, monsters.js:350-351)
  faction: { [id]: weight },     // membership
  brain: { state: "idle"|"wander"|"chase"|"flee"|"follow"|"guard",
           target: id | "player" | null, temperament: "docile"|"neutral"|"aggressive",
           grudges: { [id]: 1 }, leader: id | "player" | null, home: rect | null, seekT },
  body, inv: [],                 // §2.5; most wild creatures have neither
  talk: { dialogue, voice, state: {}, met },          // replaces NPC `state` and `met` (npcs.js:72)
  merchant: { stock: [...], restockAt, services: [id] },
  vis: { flat, ghostly, statue },                      // from the type; kept per instance so a mutation can flip it
  named: { epithet, history },                         // legends
}
```

* `spawnCreature` merges `spawnMonster` (`monsters.js:337-359`) and `spawnNpc` (`npcs.js:71-73`). Its cosmetic random fields
  (`shot`, `anim`, `think`, `pause`, today `Math.random`, `monsters.js:352-357`) come from `opts.rng`; generators pass a
  separate cosmetic stream so the layout stream, and therefore the blocks, stay identical to `75edbd3` (§8.2 0A1 gate).
  Level scaling stays: HP +6% per level and XP +10% per level (`monsters.js:339`, `:349`); the +1 damage per 4 levels
  (`monsters.js:346`) becomes +1 PV per 4 levels (§3.2).
* **No catch-all loops.** Every one of today's loops over `floor.monsters` (about 50) is rewritten in 0C to the helper that
  says what it means: `hostilesTo(game, player)` for throwing at the nearest (`throwing.js:70-72`); `zone.creatures` for
  potions of seeing (`effects.js:187-189`, people show too) and for spike damage (`traps.js:62-67`, which keeps skipping
  hovering, flat and boss creatures and now also statues; the villager AI avoids spike tiles); `creatureAt` for collision
  (`monsters.js:699-710`). Pushes go to `zone.creatures`. Each rewritten site is listed in the 0C notes for review.
* Talkers stand still unless their brain says otherwise (`villager` hook wanders inside `home`). The `occ` grid marks them
  as occupied with their own id instead of `-1` (`monsters.js:405-407`).
* Flat and ghostly visibility rules work off `c.vis`, so the 3D shadow of flat beings (`render3d.js:160-162`), the
  "look down at a shadow" talk rule (`interact.js:36-37`), ghost NPCs hidden by torchlight (`npcs.js:81`,
  `renderMap.js:158`) and the Gloom Warden's torch rule (`monsters.js:290`) are one code path, and the ghost half of it asks
  `inDark` (R12) instead of `player.torch`.

### 2.4 Player

The player stays `game.player` (not in `zone.creatures`), but has the same component shapes, so stats, combat, statuses
and abilities take `e` without caring which it is:

```js
player = {
  id: "player", name, genotype, background, x, y, z, vz, yaw, pitch, onGround,   // physics as today (player.js:16-32)
  attrs: { str, agi, tou, int, wil, ego }, hp, level, xp, hpRolls,               // maxHp derived (§2.6)
  body, inv, belt,                                                                // §2.5 (replaces weapon/armour/ring/amulet/sidearm)
  status: {}, cooldowns: {}, hotbar: [abilityId x 9],                             // cooldowns also hold "secondWind" and "firstBlock"
  powers: { [id]: rank },                                                         // today's perks + perkRank (leveling.js:38, :70-78)
  mutations: { [id]: level }, mp, attrPoints,                                     // WS4
  license: { tier, used }, credits,                                               // WS5
  funds,                                                                          // the counter backing's balance (currency.js); other backings read inventory
  torch, keys, ready,
  // transient, not saved: attackCd, throwCd, swing, swingTime, hurt, impact, wade, walkPhase, sprinting
}
```

**Once-per-floor effects become game-time cooldowns** (review #26). Second wind (`game.js:131-132`) and the warding amulet's
first block (`monsters.js:512-513`) store their use in `player.cooldowns` with `RULES.cooldown.secondWind = 300` and
`firstBlock = 120` seconds of game time; a rest of an hour clears both. Hopping across an edge no longer refreshes them.

### 2.5 Body and equipment slots (with implants)

```js
BODY_PLANS.humanoid = [
  { id: "head", type: "head", implant: true },  { id: "face", type: "face", implant: true },
  { id: "neck", type: "neck" },                 { id: "body", type: "body", implant: true },
  { id: "back", type: "back", implant: true },  { id: "arms", type: "arm", implant: true },
  { id: "hand_r", type: "hand", holds: true, primary: true }, { id: "hand_l", type: "hand", holds: true },
  { id: "hands", type: "gloves", implant: true }, { id: "feet", type: "feet", implant: true },
  { id: "finger_r", type: "finger" },           { id: "finger_l", type: "finger" },
]
Body = { plan, parts: [Part], equip: { [partId]: item | null }, implants: { [partId]: item | null }, belt: item | null }
```

* **What goes where.** `ITEM_KINDS[kind].slot(it)` returns a part *type* (`"hand"`, `"body"`, `"finger"`…); a two-handed
  weapon (`WEAPONS[id].hands === 2`) occupies both `holds` parts. Rings go on either finger, amulets on the neck, today's
  body armour on `body`; content adds head, face, back, arm, gloves and feet pieces. The belt keeps R's weapon swap
  (`inventory.js:96-99`, `:113-127`).
* **`worn(e)`** returns equipped items plus implants (today four fields, `player.js:35`), so `bonus()` sees implants
  without extra code.
* **Rules kept:** cursed items stick (`inventory.js:88-91`); the STR check (`inventory.js:79-85`) becomes an attribute
  requirement `req: { str: 14 }` that gives a to-hit penalty when unmet instead of a hard refusal (Qud gates by skill; our
  weapons gate by STR today, `items.js:228-231`). Equip time stays 1 s (`inventory.js:12`).
* **Implants** live in `body.implants[partId]`; they install only at a station block (or a surgeon service), cost license
  points and use the curse lock to refuse ordinary removal (WS5, §2.8 for their abilities).
* **Extra limbs** (`addPart`) from mutations add `holds` parts; each extra holding hand with a weapon gets an off-hand
  attack chance (`RULES.offhandChance`, 15% base). Dismemberment is out of scope for v1.

### 2.6 Attributes and derived stats: the single stat bus

```js
attr(e, k) = e.attrs[k] + bonus(e, k)                    // every gear/perk/mutation/implant/status bonus key works for free
mod(e, k)  = Math.floor((attr(e, k) - 16) / 2)           // 16 is average
bonus(e, key) = Σ over registered sources (gear via itemBonuses, implants, powers, mutations, statuses, creature innate)
```

`bonus()` keeps today's contract (`player.js:38-43`) and today's keys (`items.js:126-134` plus the seven undocumented ones
listed in content-survey §1.3). It is cached per entity: the first call after `invalidateStats(e)` builds a `{key: sum}`
table, later calls are lookups. That is a cache of derived values, not baking (R3): base fields never change when gear
changes. `equip/unequip`, `addStatus/removeStatus`, `gainMutation`, `takePower`, `install` call `invalidateStats`.

**Two formula sets.** Phase 0 runs the bus with `RULES.stats = "legacy"`: today's numbers exactly (base STR 10 read through
`attr`, max HP = `baseMaxHp` (20 + crystals + 3 per level) + `bonus(maxHp)`, armour soak and the 12% crit as today), so the
golden traces (§8.2) can prove the refactor changed nothing. The attribute formulas (the table below) are built behind
`RULES.stats = "attributes"`, and the dice of §3 behind `RULES.combat = "dice"` (0C routes every attack through
`resolveAttack`, whose `"legacy"` branch keeps today's always-hit, 12%-crit, random-soak maths). Checks run both settings;
the integrator flips both defaults when WS4 and WS8 are merged (§8.5).

| Derived | Formula (constants in `RULES`) | Replaces |
|---|---|---|
| Max HP | `attr(tou) + Σ hpRolls + (level−1)·mod(tou) + bonus(maxHp)` (retroactive when TOU changes) | `maxHp` baked by gear, crystals, perks, levels (`player.js:51`, `items.js:509`, `leveling.js:51`, `:75`) |
| AV | `Σ worn av (+ench) + bonus(armour) + bonus(av) + natural av` | `armourValue` (`player.js:70-72`) and random soak (`monsters.js:518-519`) |
| DV | `6 + mod(agi) + Σ worn dv + bonus(dv)`; 0 while stunned or paralysed | new |
| MA | `4 + mod(wil) + bonus(ma)` | new |
| Speed | `1 + bonus(speed)`, hasted ×1.6 | `speedMul` (`player.js:84`), `HASTE` (`player.js:10`) |
| Cooldown multiplier | `clamp(1 − 0.05·(attr(wil) − 16), 0.2, 2)` | new |
| Mental mutation level | `level + mod(ego)` | new |
| Price multiplier | `clamp(0.35 + 0.07·(mod(ego) + repShift), 0.05, 0.95)`; buy at value / mult, sell at value × mult | `haggle` (`dialogue.js:165`), `sellPrice` 30% (`items.js:470`) |
| Natural regen | 1 HP per `RULES.regen.base / (1 + 0.1·(mod(tou) + mod(wil)))` s, plus today's `regen` bonus | `tickEffects` regen (`effects.js:161-170`) |
| Carry capacity | `15·attr(str)` weight units | new, off by default (`RULES.encumbrance`) |
| Identify artifacts | `attr(int) + d10 + bonus(examine)` vs complexity | `itemAura` scholar (`items.js:347`) |
| Swimming | `bonus(swim) > 0` | the Swimmer perk check (`player.js:89`) |

**Starting values (in `RULES` and `content/genotypes.js`):** mutants start at 10 in each with 44 points, the unmutated
line at 12 with 38 points; +1 per point up to 18, then 2 per point; max 24 before background bonuses
(qud-character-gear.md §2.1, §3). Level-ups give `d4` HP rolls, +1 attribute point at levels 3, 9, 15…, +1 to all at 6, 12, 18…

### 2.7 Status effects

One table replaces the player's timer fields (`player.js:28`, `:30`; listed one by one in `tickEffects`, `effects.js:134-158`,
and the HUD, `hud.js:131-137`) and the creatures' (`monsters.js:350-351`, ticked at `monsters.js:413-449`).

```js
StatusDef = { name, color, kind: "good" | "bad", stack: "max" | "add" | "refresh", max,
              hud?(s) → string, tick?(game, e, s, dt), onStart?(game, e, s), onEnd?(game, e, s),
              dps?(s) → number,                   // damage per second, so catchUp can apply it exactly
              catchUp?(game, e, s, seconds),       // optional exact bulk version; default: dps × min(seconds, t), then t −= seconds
              bonus?(s) → { key: n }, flags?: { noAct, noMove, flying, hidden, untouchable, noRegen },
              save?: { attr: "tou" | "wil", dc } }
e.status = { [id]: { t /* seconds left, Infinity for toggles */, mag, src, acc } }
```

| id | Replaces | Effect (both views tick it through `tickStatuses`; `skipTime` through `catchUpStatuses`) |
|---|---|---|
| poisoned | `poisonTime` (`effects.js:149-158`), `m.poison` (`monsters.js:438-447`) | 1 damage per `1/mag` s; no regen; TOU save shortens |
| burning | `m.burn` (`monsters.js:424-436`); the salamander bite that reused `poisonTime` (`monsters.js:529-532`) | 1 damage per 0.5 s; stops regeneration (trolls, `monsters.js:433`); frost ends it |
| chilled | `m.chill` (`monsters.js:413`, `:418`) | actions at half speed; fire ends it |
| stunned / paralyzed | `m.stun` (`monsters.js:454`), `paralyzed` (`effects.js:56-58`) | no actions, DV 0; on the map your paralysis passes time (`game.js:460`) |
| blinded | `m.blind` (`monsters.js:448`, `:588-592`) | loses its target; perception 0 |
| hasted | `hasteTime`, `m.haste` | speed ×1.6 |
| flying | `flyTime` (`effects.js:29-33`, `turns.js:49`, `traps.js:58`) | flight physics; spikes miss; you land or fall when it ends |
| shadowed | `shadowTime` (`monsters.js:594-596`) | perceived at 35% range |
| darkened | `darkTime` (`player.js:78`, `:82`) | torch range ×0.4 |
| guarded | `guardTime` (`monsters.js:511`) | untouchable |
| drowning *(new, 0B)* | non-swimmers in surface deep water (§5.3) | `RULES.drown.air = 10` s, then 1 damage per s; speed ×0.4; ends when your feet leave deep water |
| lost *(new, WS1)* | world travel (§5.2) | no world map until you walk off an edge or 60 game minutes pass |
| confused, bleeding *(new)* | mutations, crits | random steps 30% · 1/s with TOU save |

Because every status is finite (or a toggle), applying it exactly during `skipTime` gives the same total as playing the
time out: a 6 s poison does its 6 damage whether you wait or travel, and a 300 s cooldown finishes on a 5-hour journey.
Content registers more statuses with `registerStatus`. The HUD draws `hud(s)` for every active status (WS9 segment).
Thirst is out of Phase 1 (review #4); a content phase may add it as a status driven by `registerUpdate`.

### 2.8 Abilities (mutations, implants, items, powers)

```js
AbilityDef = { name, source: "mutation" | "implant" | "item" | "power" | "innate",
  target: "self" | "dir" | "creature" | "tile" | "area", range, radius,
  cooldown(lvl, e) → seconds,        // × cooldownMul(e) (WIL)
  cost?: { charge, funds, hp },      mapTime: seconds,       // action time on the map (passTime)
  use(game, e, lvl, target) → bool,  info(lvl) → string,
  ai?: { when(game, c, target) → bool } }
e.cooldowns = { [abilityId]: secondsLeft }   // ticked with statuses: real seconds in 3D, action seconds on the map (R10)
```

* **Where abilities come from:** `abilitiesOf(e)` is computed (never stored): mutations with an `ability`, installed
  implants, equipped items whose kind lists abilities, and powers. The hotbar (`player.hotbar`, keys 1-9) stores ids only.
* **Targeting in 3D:** `aimTarget(game, range)` casts along the view ray (as `throwReady` does, `throwing.js:44-45`, and
  `lookTarget`, `interact.js:15-16`) and picks the creature closest to the crosshair inside a 6° cone with line of sight,
  else the block point. `dir` abilities use the full camera vector, pitch included, so you can aim up at a ledge.
* **Targeting on the map:** `requestTarget` is a P0 seam. Its P0 stub picks the nearest visible hostile (as
  `throwAtNearest` does today, `throwing.js:66-74`), which is enough for WS4's acceptance. WS8 replaces the body with the
  target screen: a cursor moved by keys or mouse (`renderMap.js:15`, `:248-251`), Tab cycles visible hostiles, the path is
  drawn with line-of-fire colour, Enter or click confirms, Esc cancels. The shot is aimed in 3D space at the target's
  centre, so height still decides what is hittable. The action time is charged through `mapUseTime` (`turns.js:234-237`),
  like quick-heal and throwing are today (`game.js:494-495`).
* **Shared effect code:** projectiles (`throwing.js:85-117`), the lightning arc (`monsters.js:792-804`), flight
  (`effects.js:29-33`), teleport (`effects.js:94-101`, now `zones.arrivalPoint(zone, "teleport")`), stun/blind/chill as
  statuses, map reveal (`effects.js:175-190`), digging via `zone.set` + `refresh()`, phasing via `bodyCollides`
  (`player.js:106-116`).

### 2.9 Item kind registry

```js
ItemKindDef = {
  stack: bool | (a, b) => bool,          // today a hard-coded kind list (items.js:490, repeated at inventory.js:145)
  slot?(it) → partType | null,           // equipment
  name(game, it), glyph(game, it) → [ch, rgb], info(game, it), details?(game, it) → lines[],
  price(it) → n /* in CURRENCY units */, weight(it),
  art: { w, h, art } | (it) => …, palette(game, it),     // FLOOR_ART + itemPalette (items.js:235-279)
  use?(game, e, it) → seconds | 0,       // inventory "use" (today only potion, scroll, gear: inventory.js:55-72)
  throwable?, onImpact?(game, it, x, y, z, target),
  onPickup?(game, e, it) → consumed,     // heart/strength/key/cube/gold special cases (items.js:509-513)
  bonuses?(it) → {}, aura?(game, it), abilities?(it) → [abilityId], examine?: { complexity }
}
```

Kinds at the end of Phase 1: `weapon`, `armour`, `ring`, `amulet`, `potion` (content may call them tonics), `scroll`,
`knife`, `bomb`, `key`, `boon` (attribute/HP crystals: one kind with an `attr` field instead of `heart` and `strength`),
`quest`, `relic?` (placeholder resolved on arrival, `game.js:243-252`; the relic band becomes `RULES.relics.levels`), `cash`
(a pile that `onPickup` turns into `currency.receive`; replaces `gold`), plus `missile`, `ammo` (WS8), `coinage` and
`container` (WS6b, only for the item and liquid backings), `implant`, `artifact`, `cell`, `credit` (WS5), `note` (WS7: books
and inscriptions that teach secrets). `cube` is removed. Item instances keep today's shape (`{ kind, id, effect, ench,
known, props, element, relic, count, x, y, z }`) plus `uid`, `charge`, `liquid`, `amount` where the kind needs them.
`takeOne(e, stack)` (today `throwing.js:31-35`) is the one way to split a stack.

### 2.10 Currency and liquids

The content drafts disagree on money (lamp oil, water, a unit per draft) and one bans the unit the first version of this
design used. So the engine knows only an amount:

```js
// content/currency.js (P0 fixture: a plain counter; C replaces it)
export const CURRENCY = { id, name, plural, unit, glyph, color,
  backing: { kind: "counter" }                                   // P0: player.funds
         | { kind: "item", item: "<coinage id>" }                // WS6b: a stackable item; weight and theft apply
         | { kind: "liquid", liquid: "<liquid id>", containers: [ids] } };   // WS6b stretch (below)
```

* **API.** `funds(e)`, `pay(game, e, n) → bool`, `receive(game, e, n) → overflow` and `formatPrice(n)` (`currency.js`, P0)
  dispatch to the registered backing. Every `gold` touch point listed in content-survey §2.5 moves to them in 0B (`$` in
  the HUD, `hud.js:124`; shop, shrines, quest rewards; `gold` piles become `cash` items). Prices stay numbers
  (`items.js:452-468`); `priceFactor(depth)` (`items.js:469`) becomes a level factor.
* **Liquid backing (WS6b stretch, gated).** Built only if `content/currency.js` names a liquid backing before WS6b starts;
  otherwise skipped. It brings `LIQUIDS`/`CONTAINERS` (`content/liquids.js`, `content/items/containers.js`), a dominant-
  liquid container model (one liquid per container; pouring the same liquid adds, a different one makes it impure unless
  the poured amount is ≥ 4× what is there), fill/drink/pour from the inventory, and `pay` draining the smallest containers
  first while `receive` warns before overflow spills.
* **World liquids are separate from money.** Water blocks stay `WATER_SHALLOW/WATER_DEEP` (`world.js:35-36`), so all physics
  and map code keeps working; which liquid they hold comes from `zone.liquid` and `zone.liquids[column]` (WS2 sets, WS3
  tints, WS6b gives touch and drink effects). On the map, bumping deep water still asks before going in
  (`turns.js:175-183`).

### 2.11 Factions, reputation and `attitude()`

```js
FactionDef = { id, name, color, temperament: "neutral", startRep: 0, homeRegions, members: [tags], likes: [tags], hates: [tags],
               relations: { [otherId]: -1 | 0 | 1 }, sacred, voice, secrets: { buys: [tags], sells: [tags] },
               merchantTable, flat?: bool }
game.state.rep = { [factionId]: n }          // REP thresholds −600, −250, +250, +600 (qud-appeal §10 P2)
```

`attitude(game, a, b)`:

1. `a === b` → friendly. A follower (`brain.leader`) shares its leader's attitudes.
2. **House rule:** if exactly one of the two is flat and neither is the player → `unaware`; likewise a ghostly creature and a
   non-ghostly one. The plane and the dark are things only the player crosses.
3. Personal grudge (`a.brain.grudges[b.id]`) → hostile.
4. **Toward the player:** take `a`'s factions, weighted; any membership of weight ≥ 0.25 that is *hated* makes the band
   *hated*; otherwise the weighted average rep picks the band. Then:

| band \ temperament | docile | neutral | aggressive |
|---|---|---|---|
| hated (≤ −600) | hostile | hostile | hostile |
| disliked (−599…−250) | wary (keeps away) | hostile | hostile |
| indifferent | neutral | neutral | hostile |
| liked (250…599) | friendly | friendly | neutral |
| loved (≥ 600) | friendly | friendly (helps) | friendly |

5. **Creature vs creature:** a shared faction → friendly; `relations` −1 → hostile, +1 → friendly; otherwise neutral.
   Predators and prey are content (`relations`), not code.

**Reputation events** (WS6a subscribes to the bus): an attack on a member that any same-faction creature within 12 tiles and
line of sight witnesses (found through `creaturesNear`) gives every witness a grudge and the faction
`RULES.rep.attackPenalty`; a kill costs `killPenalty` with the victim's factions and gives `+killPenalty/2` to factions that
hate them; quests, gifts and the sharing rite (the `ritual` screen; its in-game name and wording come from content) give
rep. Only the player's own actions (and its followers') move rep; `byPlayer` defaulting to true (`monsters.js:656`, `:814`)
becomes an explicit `source`.

**Map bump and 3D click** (R1): bumping a hostile attacks; a non-hostile talker talks (`turns.js:148-153` today always
talks); Shift+direction on the map, or a second click within 1.5 s in 3D, attacks anyway after the warning
"Really attack the X?". `E` in 3D talks to any creature with `talk` (`interact.js:28-44`).

### 2.12 Event bus and update registry

`emit(game, type, payload)` is synchronous; handlers run in priority order. `registerUpdate` hooks run once per frame in the
listed modes, after the mode's own update (autosave timers, clock events, prefetch, toasts). Types and payloads:

| Event | Payload | Emitted from (today's line) |
|---|---|---|
| `attack` | `{ att, tgt, result }` | `resolveAttack` |
| `hurt`, `kill` | `{ tgt, src, dmg }` / `{ c, src, uid, factions }` | `applyDamage`, `killCreature` (`monsters.js:656-696`; bounty hook `:694`) |
| `pickup`, `drop`, `give` | `{ e, item }` | `pickUpItems` (`items.js:498-523`), `dropSelected` (`inventory.js:129-140`), dialogue |
| `zone:enter` | `{ zone, arrival, away /* seconds since you last left it */ }` | `enterZone` (today `enterFloor`, `game.js:217-239`); WS8 heals creatures, WS6b restocks merchants |
| `zone:leave` | `{ zone, side?, how, to }` | `changeZone`; WS8 moves followers and close chasers by patch; WS9 writes the zone |
| `world:step` | `{ from, to, seconds, lost, encounter }` | travel |
| `time:skip` | `{ seconds, reason, interrupted }` | `skipTime` |
| `talk`, `trade`, `ritual` | `{ c, … }` | social screens |
| `inspect` | `{ zone, x, y, z, creature?, item?, open }` | WS8's look cursor (`L`, `open: true`) and a map hover held for 0.5 s (`open: false`); WS5 opens `examine` when `open`, WS7 learns murals |
| `discover`, `secret` | `{ kind, id, at }` | discovery, `learnSecret` |
| `useBlock` | `{ x, y, z, block }` | `interact.js:66-95` |
| `levelup`, `mutate`, `install`, `equip` | `{ e, … }` | progression, body |
| `quest:start`, `quest:stage`, `quest:done` | `{ q }` | quests |
| `clock:hour`, `clock:dawn`, `clock:dusk` | `{ minutes }` | `clock.catchUp`, from its update and from `skipTime` |
| `death` | `{ cause, recap }` | `hurtPlayer` (`game.js:142-148`) |

It replaces `game.questEvent` (`game.js:112`, `npcs.js:105-112`), `game.onGuardianWakes/Dies` (`game.js:88-111`) and
`game.win()` (`monsters.js:695`).

### 2.13 Quests

```js
QuestTemplate = { id, title(game, q), text(game, q),
  create(run, game, ctx, rng) → vars,              // ctx = { giver, site, village, faction }
  stages: { [stage]: { on: { [eventType]: (game, q, ev) → nextStage | null }, text?(game, q) } },
  options?(game, q, c) → dialogue options,          // reached through registerTalkOptions("quests", …) (WS7)
  reward(game, q) → { funds, items, rep, xp }, onComplete?(game, q) }
QuestInstance = { id, template, title, giver: { zoneKey, uid, name }, target: { zoneKey?, uid?, wx?, wy?, itemUid? },
                  stage, vars: {}, reward, done, failed, log: [] }       // JSON only, in game.state.quests
```

`story/quests.js` subscribes to every event and routes it to the current stage of each active quest. Targets anywhere,
visited or not, are reached through zone patches and `uid`s (§2.2). Today's quest record `{ id, title, text, done }`
(`npcs.js:88-102`) becomes a template with one stage, so the legacy encounters keep working in Phase 0. Template kinds
for Phase 1: fetch an item from a site, kill a named creature, find a person, deliver to another village, map a zone
(today's `mapPercent`, `npcs.js:262-266`), visit a location, and one village "desecrate / recover" quest from culture.

### 2.14 Secrets and journal

```js
SecretDef = { id /* "loc:<landmark>", "hist:<ruler>:<event>", "village:<site>:<n>", "gossip:<n>" */,
              kind: "location" | "history" | "village" | "gossip" | "recipe", tags, text(run) , at?: { wx, wy }, value }
game.state.journal = { secrets: { [id]: { learned, source, sold } }, notes: [], order: { history: [ids by year] } }
```

`learnSecret` adds it, emits `secret`, pins location secrets on the world map (WS1 `pin`) and starts a "visit" quest.
Secrets are sold once (ritual, WS6b). Sources: talk, ritual, notes, inscriptions and **mosaics**: a history mural in a
village floor reads clearly only on the map (house rule, `world.js:45`, `renderMap.js:82-85`). The inspect line shows its
inscription through a pure describer (`renderMap.js:255-283`; drawing never changes state); the secret is learned when an
`inspect` event names a mural tile, from the look cursor or a hover held for 0.5 s, so keyboard and mouse players both
learn it. Its hostile version is carved as runes that show only in the dark (`inDark`, `render3d.js:168`, `materials.js`
darkSight).

### 2.15 History

```js
History = {
  rulers: [{ id, name, epithet, domains: [domainId], born: { region }, died, favoured: [factionId], hated: [factionId],
             events: [{ id, year, type, cause, text: { gospel, inscription, hostile }, siteRequest?, relicId? }] }],
  siteRequests: [{ id, rulerId, eventId, name, tier, regionPrefs, floors, relicId }],    // placed by sites.js (WS10)
  relics: [{ id, name, base: { kind, id }, powers: [bonus | abilityId], domain, lovedBy, slays }],
}
```

`generateHistory(seed, world)` (WS7) follows qud-appeal §10 P5-P6: 3-5 rulers, one domain each from about 10, 8-12 events
from 15-20 types, event first and cause after, two or three versions of each text from a grammar (`content/grammar.js`).
Rulers' relics join the relic pool (`items.js:182-212` keeps the "once per run" rule through `game.state.relicsFound`).
Budget: ≤ 50 ms per seed. **P0 fixture:** `story/history.js` returns a fixed `History` (two rulers, two `siteRequests`,
one relic) for every seed, so WS10 can build historic sites against the real contract while WS7 writes the generator.

### 2.16 Villages

```js
Village = { id, siteId, name, factionId /* "village:<siteId>" */, culture: { sacredLiquid, sacred, profane, dish, style, phonemes },
            history: [eventId], roles: [{ role, uid, name, creatureType, dialogue }], merchantTable,
            quest: { template, params }, layout: { style, buildings: [planId], murals: [eventId] }, checkpoint: true }
```

Village data is made in `buildRun` (cheap; gossip and secrets need it before you arrive). The layout is stamped when the
zone is generated by `SITE_BUILDERS.village` (WS7) using building plans in the vault format, roofed, with murals as floor
mosaics. Roles: elder, warden, merchant, tinker, apothecary, quest-giver (qud-appeal §10 P7).

### 2.17 Game state roots (what persists)

```js
game = {
  // runtime only (rebuilt or transient)
  mode, modeStack, view /* "3d" | "map" */, paused, fov, sensitivity, messages /* ring of 500 */, effects, target, travel,
  flow, flowX, flowY, flowVersion, cam, fps, frameMs, targeting, debug, toast,
  run /* restoreRun(slot.run) or buildRun(seed) for a new game */, zone /* current */, zones /* Map cache */, player,
  // persistent: JSON only (R5)
  state: {
    seed, mode: "classic" | "roleplay", version,
    time,                                                    // THE clock: seconds of game time (R10); time of day is derived
    where: { zoneKey, world: { wx, wy } | null },
    ident: { known: { potion: {}, scroll: {} }, aura: {} },  // colours and titles are rebuilt from the seed (game.js:185-188)
    rep: {}, quests: [], journal: {}, world: { visited: {}, revealed: {}, pins: {} },
    uids: {}, zonePatches: {}, zoneLeft: { [zoneKey]: time },  // §2.2; zoneLeft feeds `away` on re-entry
    flags: {}, hints: {}, relicsFound: {}, merchants: {}, stats: {}
  }
}
```

### 2.18 Content schemas (what the separate world design delivers)

All content files are ES modules that export tables and call the matching `register*` in `content/index.js`.
`tools/check-content.mjs` validates every field below.

```js
// content/world/worldmap.js
export const WORLD = { id, version, w, h,            // 40 ≤ w ≤ 64, 20 ≤ h ≤ 32; version bumps VERSION.world
  terrain: [/* h strings of w chars */], terrainKey: { "~": "sea", ".": "flats", … },
  regions: [/* h strings */],            regionKey:  { a: "<region id>", … },
  elevation?: [/* h strings of 0-3 */],
  roads:  [{ id, path: [[wx, wy], …] }],              // 4-connected tile paths
  rivers: [{ id, path: [[wx, wy], …], width }],
  start: "<landmark id>" };
// content/world/terrains.js
export const TERRAINS = { [id]: { name, glyph, color, travel: "yes" | "no" | "road", edges: "open" | "solid", edgeMessage,
  travelHours, lostChance, biome, encounterMul, relief /* 0-1: how hilly the world function makes it */ } };
// content/world/regions.js
export const REGIONS = { [id]: { name, tier, music, sky, fog, liquid, encounterRate, creatures: [[type, weight, minLvl, maxLvl]],
  factions: [id], sites: { village, ruin, lair, historic } /* chance per eligible tile */, travel?, edges? /* overrides */ } };
// content/world/landmarks.js + plans/*.js
export const LANDMARKS = [{ id, name, at: [wx, wy], plan, anchor: "center" | [x, y], flatten: true, visibleFrom, checkpoint,
  description, dungeon?: { levels, theme, bottom: { kind, id } }, letters?: { [ch]: { creature, uid, name, dialogue, item } }, secret? }];
export const PLANS = { [id]: { rows: [...], height, wallHeight?, wall, floorBlock, roof: "none" | "rock" | "slab",
  legend?: { [ch]: handlerId }, links, mosaics } };
// content/currency.js       CURRENCY (§2.10)
// content/factions.js       FACTIONS (§2.11 FactionDef)
// content/creatures/*.js    { [type]: { name, glyph, color, frames | art, palette, w, h, levels: [lo, hi], weight, regions, tags,
//                             factions, temperament, attrs?, hp, speed, dv, av, attack: { dmg, pv, cooldown, reach }, ranged?,
//                             traits…, body?, loot?, talk?, merchant?, ai? } }
// content/items/*.js        WEAPONS { name, slot, hands, dmg, pv, strCap, acc, swing, reach, tier, req, held }
//                           ARMOURS { name, slot, av, dv, tier, req, metal } · MISSILES · TONICS · ARTIFACTS { complexity, … } · RELICS
// content/liquids.js        LIQUIDS { name, color, touch?, drink? } (world liquids); CONTAINERS only with a liquid backing (§2.10)
// content/mutations.js      { [id]: { name, kind, cost, max, excludes, info(lvl), bonus?(lvl), ability?, body?, planar? } }
// content/implants.js       { [id]: { name, parts, license, info, bonus?, ability?, removable, destroyOnRemove } }
// content/genotypes.js, backgrounds.js, powers.js, grammar.js, villages.js, quests.js (texts), dungeons.js (themes, gimmick
//                           weights), biomes.js, encounters.js, moods.js
```

**Coverage rule** (`check-content`, review #14): for every region and every level its tiles and dungeons can produce
(`RULES.level.byTier`, dungeon depths), at least three creature types are spawnable and a loot table exists. Until C3 the
legacy tables (`depths` in `monsters.js:34-189`, all ending by depth 20) are read through `contentLevel()`, so no level falls through
to the `"goblin"` default (`monsters.js:324`).

---

## 3. Combat rules, usable in both views

### 3.1 The pipeline

```
3D swing (playerMelee) ─┐   map bump (bumpAttack) ─┐   projectile contact (both views) ─┐   creature melee/ranged ─┐
                        └──────────────┬───────────┴─────────────────┬──────────────────┴───────────┬──────────────┘
                                       ▼                             ▼                              ▼
                              resolveAttack(game, attacker, target, spec, ctx = { view, aimed, ranged, source, rng })
  1 touchable?      flat/ghost/risen rules (monsters.js:288-294); untouchable status; first-block amulet (monsters.js:512-517)
  2 to-hit          nat = d20; total = nat + mod(att,agi) + spec.acc + bonus(att,toHit) + ench + aimed + highGround − reqPenalty
                    crit if nat ≥ critNat(att); hit if crit || (nat ≠ 1 && total > dv(tgt))
  3 penetration     PV = spec.pv + min(mod(att,str), spec.strCap) + bonus(att,pv) + ench + (crit ? 2 : 0); AV = av(tgt)
                    pens = penetrations(PV, AV) ; crit ⇒ pens ≥ 1 ; Sunder-style crits ignore AV (monsters.js:768-769)
  4 damage          Σ pens × rollDamage(spec) → element/holy/crush/burn/executioner/giant-slayer multipliers
                    (monsters.js:760-767), flat-in-3D halving (:770), colossus core (:772-773)
  5 apply           applyDamage → hurt/kill; on-hit: statuses (fire→burning, frost→chilled), venom/drain/burns (monsters.js:529-540),
                    thorns (:524-528), leech (:778), poisonHit (:789-790), shock arc to a creature hostile to the attacker (:792-804)
  6 tell            log "You hit the X (x2) for 9." · floating number or "miss" · emit attack/hurt/kill
```

### 3.2 Formulas and constants

* **To-hit.** `d20 + mod(agi) + acc + bonuses > DV` (qud-character-gear §8.2). Natural 1 always misses. Natural 20 is a
  critical: it hits and adds +2 PV. Today's `crit` bonus (a probability, `items.js:139`, `:158`; `leveling.js:21`) widens
  the critical range: `critNat = 20 − round(20·bonus(e, "crit"))`. Today's flat 12% crit (`monsters.js:756`) goes away.
* **Penetration** (Qud's reference odds, reproduced exactly; qud-character-gear §8.3):

```js
function penetrations(pv, av, rng) {
  const die = () => Math.floor(rng() * 10) - 1;                 // −1..8
  let pens = 0;
  for (let pass = 0; pass < 10; pass++) {
    let hits = 0;
    for (let k = 0; k < 3; k++) {
      let roll = die(), r = roll;
      while (roll === 8) { roll = die(); r += roll; }           // explodes on 8
      if (r >= 5 - pv + av) hits++;
    }
    if (hits === 0) break;
    pens++;
    if (hits < 3) break;
    pv -= 2;                                                      // all three: another pass, 2 PV weaker
  }
  return pens;
}
// Simulated (2·10⁵ rolls each), PV − AV → P(≥1 penetration) / mean penetrations:
//   −4 → 0.22 / 0.22 · −1 → 0.66 / 0.66 · 0 → 0.785 / 0.82 · +2 → 0.94 / 1.11 · +4 → 0.99 / 1.56 · +6 → 1.00 / 2.56
// (matches the reference odds in qud-character-gear §8.3; check-combat asserts this table within ±0.02)
```

* **Weapons and natural attacks.** `spec = { dmg: [lo, hi] | dice, pv = 4, strCap, acc = 0, element, reach, kind }`.
  Today's weapon ranges (`items.js:78-113`) are kept as damage per penetration; `ench` adds to hit and to PV
  (`RULES.ench`). Creatures' `damage` ranges (`monsters.js:35`…) become `attack.dmg`, with `pv = 4 + floor(level/4)`.
  Unmet attribute requirements give −2 to hit per missing point (bounded).
* **Thrown and missile.** Thrown PV `5 + mod(str)`; missiles have a fixed PV per weapon; `aimed` bonus `+3` when the
  projectile physically reached its target (both views, §3.3).
* **Height.** Attacker standing ≥ 1 block higher: +1 to hit (`RULES.toHit.highGround`). The map can climb 1 block
  (`turns.js:140`); 3D can jump 1.5 (`player.js:11`): height stays a 3D advantage without making the map useless.
* **Speed.** An attack still costs `attackTime` seconds (`player.js:63-66`) in both views (`turns.js:160`); creatures keep
  their `cooldown` (`monsters.js:475`).
* **Kill XP** stays the level curve (`leveling.js:43-57`), awarded only when `source` is the player; with
  `RULES.xpTierFalloff` a creature two tiers below you gives 10%.

### 3.3 How 3D aiming and map bumping feed the same resolution

| Action | 3D | Map | Same after |
|---|---|---|---|
| Melee | `playerMelee` picks the best target in the swing cone with reach and LOS (`monsters.js:713-736`) | bump into the tile (`turns.js:155-162`) | `resolveAttack(…, ctx.view)`; both cost `attackTime` |
| Throw | real flight with drop (`throwing.js:38-56`) | target screen picks a tile; a projectile is launched with an exact ballistic solution (as `shoot` does for creatures, `monsters.js:545-558`) and flies during `passTime` (`turns.js:41`). Replaces the always-hit auto-target (`throwing.js:60-81`) | contact → `resolveAttack(ctx.aimed = true)`; an interposed creature is hit first |
| Fire a missile weapon (WS8) | as throw, `V` | as throw | same |
| Ability | `aimTarget` (§2.8) | target screen | `ability.use` → `resolveAttack` or a save |
| Creature melee on you | cooldown, reach, LOS (`monsters.js:473-481`) | same code during `passTime` | your DV and AV now matter in both views |
| Creature arrows | physical; you can sidestep (`monsters.js:543-544`) | same physics while time passes | contact → `resolveAttack(aimed)` |

Neither view gets a numeric bonus. 3D's edge is physical (dodging, reaching up, picking targets in a crowd, jumping);
the map's edge is tactical (seeing everything, beat-by-beat spikes, flat beings).

### 3.4 Creatures against creatures, and what it costs

* `pickTarget` runs in `perceive`, every 0.25 s of **game time** per creature (`monsters.js:456-457`), over
  `creaturesNear(zone, x, y, sight)` only (8×8-tile buckets rebuilt once per `updateCreatures`): the nearest visible entity
  that `attitude` calls hostile, preferring grudges and whoever just hurt it. Perception range keeps today's
  torch/darkness/stealth rules (`monsters.js:593-600`) against the player, with "torch lit" read as
  `!inDark(game, zone, p.x, p.y, p.z + EYE)` so daylight counts outdoors (§6.3); this goes through `light.js` from 0C on, so WS3 owns the
  night rule and WS8 owns the AI.
* Movement toward the **player** follows today's flow field (`monsters.js:399-403`, recomputed when you change tile or the
  blocks change). Toward a **creature** target it uses the existing greedy step (`monsters.js:635-639`) within 8 tiles; a
  creature whose target is further away, or out of sight for 3 s, drops it and goes back to its brain state. No per-target
  flow-field cache.
* The same `resolveAttack` resolves the hit; `killCreature` with a non-player source gives no XP and no rep.
* **Activity radius.** Outdoor zones get one in 3D too (today infinite, `game.js:280`; the map uses 12, `turns.js:27`):
  creatures beyond 32 tiles that aren't fighting skip updates.
* **Budgets per simulated second** (review #11): `passTime` steps at 1/60 s (`turns.js:35-48`), so a map step of 0.24 s is
  about 15 updates and a wait 30. With 60 creatures in the active radius one simulated second costs ≤ 12 ms (a step ≤ 3 ms);
  `check-perf` measures it in an arena of two factions. Rest and world travel never run this loop for long: they call
  `skipTime` (§1.4), which advances in bulk and stops when a hostile is awake nearby.

### 3.5 Code that changes

`hitPlayer` (`monsters.js:509-541`) folds into `applyDamage` with the player as target; `attackMonster`
(`monsters.js:747-805`) becomes `resolveAttack` + `onHit` handlers; `damageMonster` (`:809-816`) becomes `applyDamage` with
a source; `hurtMonster` (`:818-826`) stops forcing `chase` toward the player and instead sets a grudge toward the source.

---

## 4. Modes, screens and the UI library

### 4.1 Mode stack and screen registry

`game.mode` is the top of `game.modeStack`. Every mode is a registered screen (§1.4). The loop:

```js
step(dt):  if (SCREENS[mode].pausesTime === false) advance the world (explore: update(dt); map: travel stepping)
           SCREENS[mode].update?.(game, dt)                  // talk typing (dialogue.js:74-86), transitions, camera swing
           runUpdates(game, dt)                              // registerUpdate hooks for this mode (§2.12)
draw():    if (screen.over === "view") draw the view under it (map or 3D as today, game.js:364-365) + HUD
           for each mode in the stack whose screen.over === "view": draw it bottom-up; present()
keys:      dispatchKey(game, code, repeat, key)              // top screen's key() → bindings for the mode → "*" bindings (M, N)
lock:      onLockChange(false) in explore → pushMode("pause") // Esc under pointer lock never reaches keydown (game.js:571-574)
```

This replaces the mode-specific branches of `step` (`game.js:307-360`), `draw` (`game.js:362-372`) and `inputHandlers`
(`game.js:510-575`), and the four separate "return to" fields (`inventory.js:18`, `dialogue.js:47`, `dialogue.js:281`,
`game.js:317`). M and N stay global, but a screen with a text field (name, seed) sees the keys first, so typing "m" types.

### 4.2 Screens

| Mode | Owner | Opened by | Time | Contents |
|---|---|---|---|---|
| `title` | WS9 | boot | paused | New game · Continue · Load slot · Options · seed field; warnings (storage low, older terrain, unclean Classic exit) |
| `create` | WS4 | New game | paused | wizard: genotype → background → attributes (point-buy with live DV/HP/AV) → mutations (pick from offers, defects refund) or implants (license) → name (text input) → mode (Classic / Roleplay) → confirm |
| `world` | WS1 | `O` on a surface zone | turn-based (`skipTime` per step) | world map viewport, tile info (side panel or bottom strip), travel, fast travel, pins |
| `explore` | P0 | Tab | real time | 3D view (unchanged) |
| `map` | P0 | Tab | turn-based | zone map (unchanged) |
| `target` | WS8 | throw/fire/ability/`L` on the map | paused | cursor, path, hit chance; `L` confirms with an `inspect` event |
| `transition` | P0 | a zone change that must wait for storage; stairs and travel by choice | – | zone name, level, "…" while the load runs (today `descend`, `hud.js:62-69`) |
| `inventory` | WS5 | `I` | paused (map: actions cost time) | tabs **Equipment** (body parts, items, implants) and **Pack** (scrolling list, filter by kind, weight and funds); use, equip, drop, throw, examine (+ pour and fill with a liquid backing) |
| `examine` | WS5 | an `inspect` event with `open` | paused | full description of an item or creature: all bonuses, comparison, attitude, AV/DV band, resistances (`monsters.js:306-313`) |
| `char` | WS4 | `K` | paused | tabs: Attributes and derived stats · Mutations or Implants · Powers · Effects |
| `abilities` | WS4 | `B` | paused | list with cooldowns; assign to 1-9 |
| `levelup` | WS4 (P0 port) | level gained | paused | powers choice (today `hud.js:78-111`), MP and attribute points |
| `factions` | WS6a | `P` | paused | known factions, rep bar, band, likes/hates, lore |
| `talk` | WS6b (P0 port) | bump / `E` | paused | today's screen (`dialogue.js:126-156`), voice from `voiceFor(c)`, registered talk options appended |
| `trade` | WS6b | dialogue | paused | theirs / yours / services (from `registerService`); prices via `formatPrice`; EGO and rep multiplier shown |
| `ritual` | WS6b | dialogue | paused | the sharing rite: buy/sell secrets, learn a power, recruit, ask for their best item |
| `journal` | WS7 | `J` | paused | tabs Quests · Locations · Histories (n of m known, chronological) · Gossip · Notes; "show on world map" |
| `log` | WS9 | `H` | paused | message history (500 lines; today 40 kept, 5 shown, `game.js:123`, `hud.js:156`) |
| `story` | P0 port → WS7 | campaign | paused | full-screen pages (`dialogue.js:313-342`) |
| `pause` / `options` | WS9 | pointer lock lost in 3D (`onLockChange`), or `Esc` on the map | paused | volume toggles, FOV, sensitivity, key help, save and quit |
| `dead` | WS9 | death | – | recap: cause, last 10 messages, damage taken by source; Classic deletes the slot, Roleplay offers the checkpoint |

### 4.3 Keys

Today's bindings (`game.js:478-498`, `:533-544`, `player.js:147-165`) stay. Free keys (content-survey §4.3) are allocated
now, each to exactly one owner, so workstreams never collide:

| Key | Mode | Owner | Action |
|---|---|---|---|
| 1-9 | explore, map | WS4 | hotbar abilities |
| `L` | explore, map | WS8 | look: 3D crosshair, map look cursor; confirming emits `inspect { open: true }` (WS5 opens `examine`) |
| `K` | play | WS4 | character sheet |
| `B` | play | WS4 | abilities |
| `P` | play | WS6a | factions |
| `O` | play (surface only, no hostile awake within 10 tiles) | WS1 | world map |
| `V` | explore, map | WS8 | fire missile weapon |
| `H` | play | WS9 | message log |
| `Z` | map | WS1 | rest (`skipTime` until healed or interrupted) |
| `G` | play | WS5 | pick up (when auto-pickup is off) |
| `Shift` + direction | map | WS8 | attack anyway |
| `M`, `N` | `*` | P0 | music, sounds (after the top screen) |
| `U`, `Y`, `,`, `/` | – | reserved | campaign / integration |

### 4.4 Widget library (`ui.js`, P0)

| Widget | Signature | Notes |
|---|---|---|
| modal | `modal(w, h) → { x0, y0, w, h }` | centred; clamps to the screen (the 180-column cap, `screen-canvas.js:3`) |
| box | `box(x, y, w, h, { title, edge, fill })` | full border (today only top and bottom rules, `dialogue.js:32-35`) |
| wrap | `wrap(text, width) → lines` | moved from `dialogue.js:18-30` (one copy instead of two, `hud.js:95-99`) |
| list | `list(state, { x, y, w, h, items, row, empty })`; `listKey(state, code, n) → "move" \| "select" \| null` | scrolling, PgUp/PgDn, wheel, mouse hit-test |
| tabs | `tabs(x, y, labels, sel) → width`; `tabsKey(code, sel, n)` | Tab / ← → |
| bar | `bar(x, y, w, frac, rgb, label)` | HP, rep, cooldowns |
| textInput | `textInput(state, code, key) → "done" \| "cancel" \| null`; `drawTextInput(...)` | character name, seed; inserts `key` when it is one printable character, so capitals and å ä ö work |
| keyHelp | `keyHelp(x, y, w, entries)` | footer from `helpFor(mode)` |
| hit-test | `ui.beginFrame()`, `ui.hit(rect, payload)`, `ui.at(cell)` | replaces per-screen `layout` objects (`inventory.js:13`, `dialogue.js:43`, `hud.js:76`) |

Conventions: ↑↓ / W S move, Enter / E / Space select, Esc back, Tab next tab, 1-9 pick, wheel scrolls; colours from a
`UI` palette constant; every screen works at 100×30 cells.

### 4.5 HUD

`hud.js` keeps the crosshair, `[E]` label (`hud.js:16-20`), weapon drawing (`:166-259`) and messages (`:155-163`). The
status line (`:113-142`, one fixed row today with no wrapping) is built from registered segments, each with a `priority` and
a preferred row: location (zone name and level, 100), HP (100), statuses (90), funds (60), level/XP (50), AV/DV (50), ready
throwable (40), torch (40), ability cooldowns (WS4, 70), clock (WS3, 30), fps (0). Segments fill row 0, then a second row
when the screen has 40 or more rows, and the lowest priorities are dropped first, so nothing overflows at 100×30. Toasts
(zone names on edge crossings, discoveries) show for 2 s under the status line. The boss bar (`:145-152`) shows any
creature flagged `boss` or `legend` that is fighting you.

---

## 5. Zone edges, travel and generation

### 5.1 Walking off a zone's edge

* **Which edges are open:** a surface zone's side is open when the neighbouring tile exists and its terrain (or a region
  override) has `edges: "open"` (`neighbourAddr`). World borders and solid edges stay solid, as today (`world.js:116`), with
  the terrain's `edgeMessage` ("The sea…") logged once. A tile with `travel: "no"` (mountains) can still have open edges:
  you walk into it from a neighbour, you never travel onto it on the world map.
* **What a seam is** (the definition `check-edges` tests, review #6). Column `x` of tile `wx` is world column
  `gx = wx·80 + x`, so A's `x = 79` and B's `x = 0` are adjacent world columns, not the same one. A seam is right when:
  (a) both zones build their terrain from the same world functions `heightAt` and `treeAt`, so `|stand(A,79,y) − stand(B,0,y)|`
  equals the function's own step there; (b) roads, rivers and paths cross at the same `along` with the same width; (c) no
  step across the seam is larger than `PLAYER_STEP_UP` unless the world function marks a cliff there; (d) a tree whose
  canopy crosses the edge exists, whole, in both zones; (e) zone-local features keep 2 tiles from open edges and per-run
  sites keep 6, while fixed landmarks are part of the world function (their flatten mask, §5.3) and may touch an edge.
* **3D:** `Zone.solid()` beyond an open side reads the apron (§6.1): the neighbour's real voxels when it is in memory, the
  world function otherwise. So you walk past the border on the ground you will stand on, not on a mirrored copy, and the
  camera does not pop. After `updatePlayer` (`game.js:265`), `update()` calls `tryWalkOff(side, along)` once the body's
  centre is 0.5 tiles past the edge (so standing on the border doesn't flicker between zones).
* **Map:** `mapStep` calls `tryWalkOff` instead of returning false when the step leaves the grid on a surface zone
  (`turns.js:143`). Click-travel may target an edge tile and continues one step outward (`turns.js:259`); auto-explore stops
  at edges.
* **Arrival:** `arrivalPoint(zone, "edge", { side, along, fromStand })` (now in `zones.js`) mirrors the side, keeps
  `along`, and takes the nearest standable tile within 3 tiles of the edge and ±4 along whose stand height is within ±1 of
  the one you left, reachable from the zone anchor (the way `landing()` searches, `gen/dungeon.js:773-786`). With the seam
  rule that is the mirrored tile in nearly every case. If no tile qualifies (a stored zone from an older generator, §7.6),
  the nearest reachable standable tile, with "The ground shifts underfoot." Facing, speed and vertical speed are kept in
  3D; flow, travel and effects reset as `enterFloor` does (`game.js:234-238`).
* **No black screen.** The neighbour is normally already in memory (prefetch, §2.2): the swap happens in the same frame and
  the zone name shows as a toast. The transition screen appears only while a stored zone is read back.
* **Followers and chasers** (WS8, through `zone:leave`): followers, and creatures in `chase` within 3 tiles of the exit,
  get a patch into the new zone (`relativeTo: "arrival"`, 2 tiles behind you) and leave the old one; uids keep them unique.

### 5.2 The world map mode and travel

* **Entering:** `O` on a surface zone with no hostile creature awake within 10 tiles. The world map shows every tile's
  terrain from the start (the fixed map is common knowledge), but sites and landmarks only once discovered (visited, seen
  from within `visibleFrom` tiles, or learned as a secret).
* **Viewport:** each tile is two cells wide (as the zone map, `renderMap.js:17`). The view follows the cursor with the zone
  map's `pickOrigin` rule (`renderMap.js:62-66`), so a 64×32 map scrolls on small screens. The info panel (terrain, region,
  tier, known sites, travel time, danger compared to your level, pins) sits on the right, 40 columns wide, when the screen
  has at least `2·w + 42` columns, else in a 6-row strip at the bottom. Checked at 100×30, 160×64 and 180×56.
* **Moving:** 8-way steps onto tiles whose `travel` allows it (`"road"`: only along a road or river edge; `"no"`: never).
  Each step costs `TERRAINS[t].travelHours` (×0.5 on a road or river edge, ×`bonus(travel)` for flight or fast-travel
  gear), converted to seconds by `RULES.clock`, and calls `skipTime(game, seconds, { interruptible: false, reason:
  "travel" })`. Statuses, cooldowns and regen catch up exactly (§2.7): a journey finishes a cooldown and a poison does its
  full, finite damage.
* **Getting lost:** per step `max(0, lostChance − 0.02·mod(int) − bonus(navigation))`, zero on roads, rivers and tiles with
  a pinned route. Lost drops you into the destination tile's zone at a random reachable spot with status `lost`, which ends
  when you walk off any edge or after 60 game minutes.
* **Encounters:** per step `region.encounterRate × terrain.encounterMul × (night ? 1.5 : 1)`. A roll on
  `content/encounters.js` gives a hostile band, travellers, a legendary wanderer (only if `claimUid` succeeds: a legend that
  is placed elsewhere or dead is not rolled), or a hidden site (revealed and pinned). Creature encounters drop you into the
  tile's zone, visited or not, with the group placed by a patch `relativeTo: "arrival"`, 8-12 tiles away.
* **Leaving:** Enter enters the current tile's zone at the edge you came in through (centre if you haven't moved); `>` on a
  known site arrives at its entrance.
* **Fast travel:** click a known destination; the path (A* over tiles) may use roads, rivers and visited tiles only; cost is
  the summed time; encounter chance ×0.25; no getting lost.
* **Rest** (`Z` on the map, `Z` on the world map too): `skipTime` until healed or `RULES.rest.max` (8 game hours),
  interruptible; once per game hour an encounter roll at half the travel rate places a band by patch and interrupts.
  Resting an hour clears the second-wind and first-block cooldowns (§2.4).
* **Discovery XP:** first visit to a village, landmark or site gives `RULES.xp.discovery × tier`.

### 5.3 Surface zone generation (WS2)

1. **World coordinates.** Every continuous quantity (height, moisture, forest density, biome dithering, cliffs, trees) is a
   function of `(runSeed, gx, gy)` built on `noise2` (`rng.js:31-38`) with a seeded offset, so two zones compute identical
   values for the same world column.
2. **Height without hidden walls** (review #10). `heightAt` blends the relief of the biomes of the four nearest tile
   centres with bilinear weights in tile space. Relief noise has a wavelength of at least 12 tiles and an amplitude of at
   most 3 blocks, so its slope stays under 1 block per tile and rounding never makes a 2-block step between 4-neighbours:
   the whole zone stays walkable on the map, where heights are invisible (README.md:434-456). Cliffs come from a separate
   world mask that raises whole areas by 4 or more, which the map draws as walls (`world.js:152-163`). Fixed landmark rects
   plus a 2-tile skirt (`world.flatten`) pull the height to the landmark's datum with a 4-tile falloff, inside the world
   function, so a neighbour sees the same values. The ground layer is `FLOOR_Z − 1` at height 0, so `computeKinds` and the
   hole layer (`raycast.js:16`) keep working. `look` for a floor column is the top solid block under its `stand` (grass on
   a hill, not subsoil).
3. **Ports.** For each shared edge with a road or river (from the compiled world), the crossing point is
   `8 + hashInt(seed, edgeId) mod (length − 16)`, width from data (road 2-3, river 3-5). Both zones compute it from the same
   canonical `edgeId`. Inside the zone, roads run as cost-weighted paths between ports and the hub (the site entrance or the
   zone centre); rivers meander between their ports with shallow banks and a deep middle. One river port means a lake.
4. **Water on the surface** sits at the datum with rock below it, so it never drops you a level. Deep surface water holds up
   any body (`solidFor`, the rule swimmers already have, `player.js:110-114`, `turns.js:57-60`): you float at the surface
   with the swimming view dip (`player.js:155-156`). Without `bonus(swim)` you get `drowning` (§2.7). The map still asks
   before you step in (`turns.js:175-183`) and charges twice the wading time; creatures treat it as unstandable
   (`world.js:125`). Same rule and same timer in both views (0B gate).
5. **Holes** only appear when `zone.hasBelow`, and only inside `zone.dungeonRect` (§5.5): a sinkhole is a free way into the
   dungeon right below it.
6. **Biome builders** (`BIOME_BUILDERS[biome](ctx)`): ground and sub-ground blocks, rocks, ponds (with the region's
   liquid), props (non-blocking sprites: shrubs, bones), light sources, and the spawn table. Trees come from `treeAt` (one
   candidate per 3×3-tile world cell, kept by forest density) and every zone whose grid or apron a canopy touches builds
   that tree, so a border tree is whole on both sides. Zone-local clutter keeps 2 tiles from open edges.
7. **Sites and landmarks** are stamped before clutter into reserved rectangles (§5.4).
8. **3D-only rewards outdoors** are placed on purpose: plateaus 2 blocks up that need a jump, at most
   `RULES.surface.jumpSpots` per zone, each with a reward, the outdoor equivalent of climb rooms (`gen/dungeon.js:507-534`).
9. **Validation** (`validateSurface`): every open edge has standable border tiles reachable from the anchor along at least
   half its length (except where the world function puts water or cliffs); every port is reachable; the entrance and
   landmark key points are reachable; stairs sit on dry ground (rules from `gen/dungeon.js:216-224`); no holes outside
   `dungeonRect`; **navigability:** at least 90% of standable columns lie in one component under the map's step rules
   (`pathing.js:6`), and unplanned 2-block steps number at most `RULES.surface.maxSteps` (4). Up to 10 attempts with
   sub-seeds, as `generateFloor` retries (`gen/dungeon.js:25-31`); retries re-roll only zone-local features, never the world
   functions (that would break seams).

### 5.4 Landmarks and sites on the surface

* **Format:** landmark and building plans use the vault letter format (`gen/vaults.js:1-25`) through named legend handlers.
  `DEFAULT_LEGEND` maps today's letters (`gen/vaults.js:355-406`); a plan maps its own letters with `legend: { ch: id }`.
  WS2 registers `tree`, `prop`, `shallow`, `deep`, `road`, `path`, `rubble`, `station`, `creature`; WS7 its building parts;
  WS10 its lair-hall parts. `registerLegend` throws on a duplicate id, so parallel workstreams can't silently collide.
* **Roof and wall height:** `stampVault(zone, plan, x, y, rng, { roof: "none" | "rock" | "slab", wallHeight })`. `wallCol`
  fills `FLOOR_Z .. FLOOR_Z + wallHeight − 1` (today always up to `ROOM_TOP`, `gen/vaults.js:348`); the default
  `wallHeight = ROOM_TOP − FLOOR_Z` keeps every existing vault byte-identical (0A1 gate). `"none"` writes air above the walls
  instead of rock (today rock fills up to `H`, `gen/vaults.js:347-349`; the temple opened its sanctum by hand,
  `story.js:121`); `"slab"` puts a one-block roof at `height`.
* **Footprint:** a site's footprint plus a 2-tile skirt is flattened to the datum and smoothed around, inside the zone and
  at least 6 tiles from every edge; a landmark's footprint is already flat in the world function.
* **Anchors:** `anchor: "center"` or fixed `[x, y]`; landmark zones must validate on every seed (`check-landmarks`, all
  landmarks × 5 seeds, plus every edge of every landmark tile in `check-edges`).
* **Sites** go through `SITE_BUILDERS[site.kind](ctx, site)`: WS7 registers `village`, WS10 registers `dungeon`, `lair`,
  `ruin`, `historic`, `station`. A dungeon site's entrance is `zone.entrance` (a `STAIRS` block), so coming back up lands
  beside it through `arrivalPoint("up")`; the temple's `returnPoint` special (`gen/dungeon.js:757`) disappears.

### 5.5 Dungeons under tiles (WS10)

The existing generator is kept and parameterised:

| Today | Parameter |
|---|---|
| `depth` as RNG mix and difficulty (`gen/dungeon.js:26`, `:252`, `:261-262`) | `seed = zoneSeed(run, wx, wy, z)`; `p.level` for every balance call, read through `contentLevel()` by legacy tables |
| `THEMES` constant (`:14-19`) | `p.theme` → `DUNGEON_THEMES[id].rooms` |
| depth 1: no stairs up, sky well (`:144-160`) | `p.hasUp` is always true: level 1's stairs up lead to the surface entrance. The sky well is dropped (the ground above it isn't open); the start room gets a lamp |
| `FINAL_DEPTH`: no holes, no stairs, boss (`:166`, `:232`, `:865-871`) | `p.final` |
| `pickVault(rng, depth)` sequence (`gen/vaults.js:332-338`) | `p.forcedVault` (bottom halls), else a weighted pick from `p.vaultPool` filtered by level |
| guardians on 5/10/15 (`gen/vaults.js:305-328`) | `p.bottom = { kind: "guardian", id }` forces that hall on the last level |
| Lich throne (`gen/vaults.js:275-295`) | `p.bottom = { kind: "boss" | "legend", id, uid }`: a lair hall with the named creature (if `claimUid` succeeds) |
| `planEncounters(seed).get(depth)` (`:277`) | `p.encounters` from the site (legacy archetypes, history visitors) |
| dark rooms `0.12 + 0.08·depth` (`:190`) | `theme.darkRate(level)` |
| monster count `min(18, 3 + 2·depth)` (`:252`) | `theme.count(level)` |
| the relic band `depth 14-19` (`items.js:440`) | `RULES.relics.levels = [14, 19]` |

`legacyParams(depth)` maps today's `(seed, depth)` onto these parameters so the 0A1 golden check can compare blocks.

**Where the dungeon sits.** Levels are 48×48 and the tile's surface 80×48, so the surface records
`dungeonRect = { ox: clamp(entrance.x − 24, 0, 32), oy: 0 }`, centred under the entrance. A fall through a surface sinkhole
at `(fx, fy)` lands on level 1 at `(fx − ox, fy − oy)` through `arrivalPoint("fall")`; sinkholes are cut only inside the rect;
levels below each other line up 1:1, as today.

**Gimmick hooks** run after monsters and loot (`:249-274`): `flooded`, `lightless`, `flatland` (more flat beings),
`haunted` (ghosts and ghost planks), `spikeworks`, `collapsed` (pits to the level below), `murals` (history mosaics).
Each is `(zone, rng, rooms, p) => void` and must keep `validateDungeonLevel` passing.

**Level numbers:** surface level = `RULES.level.byTier[tier − 1]` (tiers 1-8 → 1, 3, 5 … 15); dungeon level `z` = surface
level + `z · levelStep` (rounded; site spec, default 1). A 5-level dungeon under a tier-8 tile reaches 20, inside today's
balance range (`monsters.js:316-349`, `items.js:401-448`). Longer landmark dungeons use `levelStep = 0.5` or reach above 20,
which the coverage rule (§2.18) then requires content for; until C3 legacy lookups clamp at 20.

---

## 6. Rendering outdoors (WS3)

### 6.1 The apron and the horizon

Rays that leave the grid return false (`raycast.js:33-35`) and the renderer draws black below the horizon
(`render3d.js:186-189`; confirmed in the browser, engine-survey §2.2). A zone is only 48 deep, so a north or south edge is
never more than 24 tiles away; a flat plane at the datum would read as a drop at every edge and the next zone would pop in
when you cross (review #7). So outdoor zones carry an **apron**:

* **Data (P0, 0A2).** For every open side and open corner, a voxel band `APRON` (16) tiles deep, the zone's own `d` or `w`
  long and `h` tall (12 KB per long side). `refresh()` fills it through `APRON_BUILDERS.surface(run, zone, side)`: a copy of
  the neighbour zone's edge band when that zone is in memory (prefetch makes this the usual case), otherwise built from the
  world functions (`heightAt`, `treeAt`, the biome's top block). When a neighbour arrives in memory later, the band is
  rebuilt from it. Zone-local features of a neighbour that isn't in memory (a hut 10 tiles in) appear only once it is.
* **Physics.** `Zone.solid()` reads the apron beyond an open side (§5.1), so your body steps over the border onto the
  neighbour's real ground. Creatures never leave their zone and the auto-map never fills from the apron.
* **Rendering (raycast bounds P0, look WS3).** `castRay` keeps stepping while the ray is inside the apron instead of
  returning at the border, and hits apron voxels like any other block. Apron voxels are shaded with sky × daylight and
  haze, no lamp light and no baked sun (cheap), and never write `seen` or `holeSeen`. Creatures and items of the
  neighbour are not drawn (an accepted limit: things pop in at 16+ tiles, inside the haze).
* **Beyond the apron.** A missed ray with `dz < 0` meets a horizon plane at the mean height of the apron's far row,
  `t = (zFar − ez)/dz`, shaded with that side's ground colour times daylight, a cheap noise texture for character density,
  and haze at distance `t`. Cost: one division and one noise lookup per missed pixel, measured by `check-perf`.

### 6.2 Haze fog

`FOG = [4, 5, 9]` and density 0.05 (`render3d.js:21-22`) become per frame `fogFor(game, zone)`: outdoors the sky's horizon
colour at the current time with density 0.02-0.03 (region `fog` can thicken it: marsh, ash), underground today's values.
`MAX_DIST` (32 today, `render3d.js:24`) becomes 48 outdoors, enough to cross the apron.

### 6.3 Day, night and the dark-only rules

* `clock.daylight(game)` 0..1 from time of day (dawn 06:00, dusk 20:00 by default), always derived from `state.time`.
* `ambientAt` (`render3d.js:64-72`) multiplies the sky term by daylight (plus a night floor for moonlight); `SUN_COLOR`
  scales with sun height; `shadeSky` (`:135-152`) blends day, dusk and night gradients and adds hashed stars at night.
* The auto-map's lit test (`light.js:27-28`, read by `refreshView`, `turns.js:114`) goes through `lightAt`, which multiplies
  sky light by daylight; `litMask` is recomputed only when `lightBucket` changes (O(n), cheap). Phase 0 routes `refreshView`
  through `lightAt` with daylight fixed at 1, so WS3 can implement the night rule entirely inside `light.js` and `clock.js`.
* **Dark-only things** (R12, review #8). `inDark(game, zone, x, y, z) = !player.torch && naturalLight(…) <
  RULES.dark.threshold`, where `naturalLight` is sky light × daylight at that spot, **without lamps**. Underground there is
  no sky, so it reduces to today's torch test and every dungeon puzzle behaves exactly as at `75edbd3` (a lamp term would
  wash out brazier numerals and lit-room murals). Outdoors by day nothing is dark, so ghost planks, glowing runes, ghosts
  and ghost NPCs stay hidden in sunshine; at night or in deep shade they appear with your torch out.
  * Rendering: `zoneIsLightless(zone)` keeps today's per-frame switch (`setDarkSight`, `setGhostVisible`,
    `render3d.js:168-169`) for zones without sky; in zones with sky, `castRay` asks `inDark` at the voxel when it meets a
    ghost block or a dark-sight material (rare hits, so the cost is small).
  * Creatures and people: `touchable` (`monsters.js:290`), the map's ghost sightings (`turns.js:108`), ghost NPC sprites
    (`npcs.js:81`) and talking to them (`interact.js:34`) all ask `inDark` at the creature (0C).
  * Perception: creatures see you at the "torch lit" range when `!inDark` at your eyes (`monsters.js:595`), so daylight
    counts as light outdoors.
* `sampleLight` clamps coordinates at outdoor zone borders instead of skipping samples (`light.js:67`), removing the edge
  darkening the survey found.

### 6.4 Baked sun

Today every shaded pixel casts a shadow ray toward a fixed `SUN` (`render3d.js:25`, `:105-111`): about 4.5 ms of a 19.5 ms
outdoor frame (engine-survey §6). WS3 bakes `zone.sunlit` in `refresh()` and whenever `lightBucket` changes: for every air
voxel next to a solid face, one DDA toward `sunDir` (≤ 40 steps, as today). Shading looks up the voxel in front of the hit
face. Target ≤ 4 ms per bake at 80×48×16; if it's slower, bake in two halves over two frames.

### 6.5 Map terrain glyphs and colours

* Blocks get an optional `map: { glyph, color }` (`blocks.js`). `computeKinds` also stores `look[i]`: for floor kinds the top
  solid block under the column's `stand` (so a hill shows its grass, not the `FLOOR_Z − 1` subsoil), for walls the block at
  `FLOOR_Z + 1` (as `renderMap.js:79` already reads). `renderMap` draws `BLOCKS[look].map` when present, else the existing
  `GLYPHS` (`renderMap.js:21-33`).
* Examples: grass `"` green, sand `.` yellow, road `·` tan, salt `.` white, tree trunk `♣` dark green, rock outcrop `^` grey.
  Heights stay invisible on the map (README.md:434-456): a 3-block hill is still a floor glyph, which is why §5.3 keeps
  every surface slope walkable.
* The header row (`renderMap.js:181-184`) shows the zone name and level; the legend (`renderMap.js:189-245`, hidden at 80
  wide by `:57`) gains terrain rows and a toggle key in the legend panel.

### 6.6 Skyline (optional, WS3 stretch)

Landmarks with `visibleFrom ≥ 1` within 3 tiles appear as large sprites beyond the zone edge, placed in world coordinates
relative to the zone (sprites already accept any position, `render3d.js:262-326`). It helps navigation in 3D, while the
world map stays the 2D tool.

### 6.7 Performance budgets

| Item | Budget | Basis |
|---|---|---|
| `render3d` outdoor, 160×64 cells in the browser, apron included | ≤ 13 ms | 13.2 ms measured with the sun ray, 10.6 ms without (engine-survey §6) |
| `present` | ≤ 5 ms | 3.3-7.4 ms measured |
| Node outdoor frame at 180×56 | ≤ 17 ms | 19.5 ms measured minus the sun ray |
| `refresh()` 80×48×16, apron included | ≤ 10 ms | 6.3 ms Node, standHeight closure to remove (`world.js:126-132`); apron copy ≤ 2 ms |
| Sun bake | ≤ 4 ms per light bucket | new |
| Surface generation | p95 ≤ 60 ms, max 150 ms | dungeon p95 39 ms, max 134 ms |
| Dungeon generation | p95 ≤ 40 ms | measured |
| `buildRun` / `restoreRun` | ≤ 200 ms / ≤ 50 ms | new |
| World map draw | ≤ 3 ms | map draw 2.2 ms measured |
| `passTime`, 60 creatures in the active radius | ≤ 12 ms per simulated second (a map step ≤ 3 ms) | refreshView 0.34-0.8 ms; flow field 0.5 ms at 80×48 |
| `skipTime`, 8 game hours, no hostile awake | ≤ 20 ms | bulk catch-up |
| Edge crossing into a cached zone | one frame + `refresh()` | §2.2 |
| Prefetch in 3D | at most one generation per frame | §2.2 |
| Memory | derived arrays for 2 zones; ≤ 24 dormant zones in memory; dormant zone ≤ 80 KB | §2.2 |

**Dynamic resolution:** if the 3D frame averages over 17 ms for 2 s outdoors, `render3d` casts every other screen column
and copies it to its neighbour until the average is back under 12 ms. The screen grid itself is never resized at runtime:
`resize()` clears the glyph cache (`screen-canvas.js:27`), and the zone map needs its 160 columns.

---

## 7. Persistence

### 7.1 What is saved, and what is rebuilt

| Rebuilt (never saved) | Saved |
|---|---|
| The compiled world (fixed data, keyed by `VERSION.world`) | The Run's generated data, `serializeRun(run)`: history, sites, villages, factions and relations, legends, secrets (tens of KB, JSON) |
| Unvisited zones (from `zoneSeed` and the saved Run) | `game.state` (JSON, §2.17) |
| Potion colours and scroll titles (`game.js:185-188` already derives them from the seed) | The player record |
| Derived arrays (`refresh()`) | Every visited zone's record |
| Dialogue nodes (built on demand, `npcs.js:283`) | The id counter, slot metadata |

A load never calls `buildRun`, so a change to `history.js`, `sites.js` or `villages.js`, or an accidental nondeterminism in
`buildRun`, can't move a site, rename a quest giver or orphan a quest's uid under an existing save (review #3).

### 7.2 Records and codecs

```js
SlotRecord = { id, game: GAME_ID, version: VERSION.save, genVersion: VERSION.gen, worldVersion: VERSION.world, created, updated,
               mode, seed, character: { name, genotype, background, level }, where, time, state, player, ids, run,
               zones: [{ key, savedAt }], live?: sessionId, unclean: 0, checkpoint?: SlotRecord, dead?: bool }
ZoneRecord = { slot, key, savedAt, genVersion, type, level, w, d, h,
               blocks: "b64(deflate)" | { raw: "b64" },   // full grid: 1.5 KB synthetic outdoor, est. 3-6 KB real (engine-survey §5.2)
               seen: "b64", holeSeen: "b64",
               creatures: [trimmed], items, props, bombs, clouds, markers, sightings: [[id, s]], links: [[i, link]],
               groups: [[id, g]], spikes: [[col, s]], secretWalls: [col], braziers, secret, vault, guardianHall,
               spawn, stairs, upStairs, entrance, dungeonRect, flags, liquids, appliedPatches, lastTime }
```

* **Blocks are stored in full** for visited zones (deflated): robust to generator changes and no regeneration on load. At
  1-6 KB per zone, 300 zones fit in about 2 MB. There is no block log in v1 (review #27).
* **Creatures are trimmed:** a whitelist (`id, uid, type, elite, tx, ty, z, hp, maxHp, level, brain, status, cooldowns, inv,
  body, talk.state, talk.met, merchant, faction, name, named, flags`); on load `spawnCreature(type, …)` rebuilds the rest and
  the saved fields are assigned over it. Entity JSON is about 76% of save bytes today, most of it monsters (engine-survey §0, §5.2).
* **In-flight projectiles** are dropped (≤ 3 s of life); `from` references (`monsters.js:552`) never need saving.
* **Compression** with `CompressionStream("deflate")` (zlib format; Node ≥ 18, Chrome, Firefox ≥ 113, Safari ≥ 16.4). Node
  20.11 rejects `"deflate-raw"` (checked on this machine), so the codec feature-detects at start and stores `{ raw }` when
  compression is missing. Zone fields added by workstreams register a codec with `registerZoneField(name, { encode, decode })`
  or must be JSON (R5).

### 7.3 IndexedDB layout and when things are written

* Database `"<GAME_ID>-saves"`; stores `slots` (key `id`), `zones` (key `[slot, key]`) and `checkpointZones` (key
  `[slot, key]`). The origin is shared with every other `ot-mo.github.io` page (engine-survey §5.1), so nothing goes in
  localStorage except settings under `storageKey(...)` (replacing `rotation-cube-music/sounds`, `music.js:36`, `sfx.js:15`).
* `store.js` exposes an adapter `{ get, put, del, list, tx(fn) }` with `idbAdapter(name)` in the browser and
  `memoryAdapter()` in Node, so every save test runs headless.
* **Snapshot first.** Every save starts with a synchronous snapshot: `JSON.stringify` of the slot parts and copies of the
  typed arrays it will write. Compression and IndexedDB come after, and never read live objects, so the game can keep
  running without tearing the save.
* **Write-behind.** When you leave a zone (`zone:leave`), its record is snapshotted, compressed and written; it stays in
  memory as a dormant zone and can be evicted only after the write commits.
* **Periodic saves** (a registered update): when a zone change completes, every 120 s of play in `explore`/`map`, and every
  10 real seconds of world-map travel, the slot record and the current zone. Saving happens only in saveable screens
  (`explore`, `map`, `world`; others hold closures, `npcs.js:249-250`, `dialogue.js:314`); a save requested elsewhere waits.
* **Unload.** On `visibilitychange → hidden` (more reliable than `pagehide`) and on `pagehide`: a synchronous snapshot, then
  one transaction opened right in the handler on the already-open connection, putting the slot record and the current zone
  uncompressed. Every other zone was written when you left it. If the page dies first, the last periodic save stands.
* `navigator.storage.estimate()` is checked at start; below 10 MB free the title screen warns.
* **Loading** compiles the world, calls `restoreRun(slot.run)`, restores state and player, sets the id counter, then
  `changeZone(where, { how: "load" })`; other visited zones are read when prefetched or entered.
* **Export / import** a slot as a JSON file from the title screen (user-initiated).

### 7.4 Id counters

`ids.js` holds one global `entity` counter (today two module counters, `monsters.js:334`, `npcs.js:70`). It is saved in
the slot record and restored before any zone loads; a check asserts it exceeds every id in the loaded zones. Numeric ids
are runtime handles (`occ` grids, sightings, `monsters.js:405-406`, `renderMap.js:164`). Anything referenced across zones
or before generation uses a `uid` string assigned deterministically by generation or history (§2.2).

### 7.5 Modes and checkpoints

* **Classic:** one slot per character. While a session plays the slot, `slot.live` holds its session id; a clean save
  (save and quit, or an unload save that committed) clears it, and returning to the tab sets it again. Loading a slot whose
  `live` is still set means the last session ended without a final save (a crash, or closing the tab mid-fight): `unclean`
  goes up and shows on the title screen and the grave record. `RULES.classic.unclean = "warn"` (default) loads it anyway;
  `"death"` treats it as a death. On death the recap shows, then the slot is deleted and a one-line grave record goes to
  `storageKey("graveyard")`.
* **Roleplay:** entering a zone whose site has `checkpoint: true` (villages, safe landmarks) makes a checkpoint, copy on
  write: the slot record is copied into `slot.checkpoint`; afterwards, the first time a zone record is about to be
  overwritten, its old version is moved to `checkpointZones`, and zones first saved after the checkpoint are noted.
  Restoring puts back the checkpoint's slot record and the old zone versions and deletes the newer zones. A new checkpoint
  replaces the old one. A village visit costs one slot record, not a copy of every zone.
* **Wander** (optional, `RULES.mode.wander`): most creatures start neutral and XP comes from discovery, quests and rituals
  (qud-appeal §10 P13).

### 7.6 Versioning

* `VERSION.save` bumps on any record shape change, with `migrations[n](record)` applied on load.
* `VERSION.gen` bumps when generation changes. The saved Run and stored zones load unchanged; unvisited zones generate with
  the new code. Where a new zone borders a stored one the seam may not line up: the apron shows the stored zone's real
  edge, so you see the step, and arrival falls back to the nearest standable tile (§5.1). The title screen says so once.
  Keeping old generator versions alive is not attempted.
* `VERSION.world` bumps when the fixed map data changes. A saved Run's sites may then sit on changed terrain, so a load is
  refused unless a `worldMigrations[n]` exists; during development, saves from older maps are disposable.

---

## 8. Phased build plan

### 8.1 Principles

* **A baseline before any refactor.** The first thing 0A1 does, at `75edbd3`, is record golden traces (mechanics, frames,
  dungeon blocks). Every Phase 0 gate compares against them, so "the old game still works" is a check, not a hope.
* **Phase 0 is sequential**, six sessions (0A1, 0A2, 0B, 0C, 0D1, 0D2), each ending with a green `node tools/run-all.mjs`,
  a silent browser smoke test and a git tag. Nothing in Phase 1 starts before tag `p0-done`.
* **Phase 1 runs in parallel**, one agent per workstream, each on its own branch from `p0-done`, editing **only the files it
  owns** (§8.4). Calling another workstream's exported functions is fine; editing its files is not. Every acceptance item
  that needs another workstream's output runs against the Phase 0 seam or fixture named in the dependency table (§8.3).
* **Every workstream ships** its code, its `tests/checks/<ws>.js` (pre-created as a stub), its `tools/check-<ws>.mjs`, and
  a short `docs/<ws>.md` with its public API and an "Integration requests" list for changes to files it doesn't own.
  Tunables go in `RULES.<ws>` through `extendRules(ns, values)` from the workstream's own module (`rules.js` stays frozen).
* **Size.** One session handles about 1,500-3,000 careful lines. Workstreams estimated above that are split into "a" and
  "b" sessions run back to back by the same owner.
* **Continuous integration** (§8.5): a standing integrator merges each workstream as soon as it passes its own acceptance,
  instead of merging ten branches at the end.

### 8.2 Phase 0: the spine (sequential)

#### 0A1. Baseline, zone core, dungeon parameters (≈ 2,300 lines)

* **Scope:**
  * **At `75edbd3`, before any change:** `tools/node-env.mjs` (stub screen and input backends as the survey's bench scripts
    did, `bench/bench.mjs:14-15`, `bench/state.mjs:5-8`; seeded `Math.random` while recording) and
    `tools/golden-record.mjs`, which writes `tests/fixtures/golden/`: **(a)** mechanics traces: on a fixed level (seed 1234,
    depth 3), deterministic scripts (drink each potion kind, read each scroll kind, equip a cursed item and fail to remove
    it, R swap, wear each ring and amulet, pick up crystals) and the player's derived numbers after each step (STR, max HP,
    armour, every `bonus()` key); **(b)** frame hashes: the `render3d` and `renderMap` cell buffers at 180×56 from 3 fixed
    cameras on levels 3, 8 and 15, torch on and off; **(c)** dungeon hashes: the blocks of `generateFloor(seed, depth)` for 5
    seeds × depths 2-19.
  * `blocks.js` (move `BLOCKS/B/KIND`; append about 24 reserved generic ids: sand, dirt, road, salt, snow, ash, clay, shale,
    trunk, leaves, reed, mud brick, thatch, scrap, glass, metal, bone, crystal, fungus, station, still, sign, plus two
    spare; `map` glyph field).
  * `world.js` `Zone` (instance dimensions, `type`, `edges`, `hasBelow`, `look`, `ensureDerived/dropDerived`, `seal/dirty`,
    `solidFor`), with `Floor` renamed everywhere (no alias).
  * `events.js` complete (`on`, `emit`, `registerUpdate`, with `game.js` calling `runUpdates`), so zone events and
    prefetch have a home from the start.
  * `zones.js`: cache, `getZone/changeZone` (synchronous when cached), `enterZone` applying pending patches, the arrival
    helpers moved from `gen/dungeon.js:756-792` reading `zone.w/d` (plus `"teleport"`), `claimUid/uidWhere/killUid`, LRU,
    `zone:enter`/`zone:leave` events with `away` and `side`.
  * `gen/dungeon.js` → `generateDungeonLevel(seed, p)` and `legacyParams(depth)`; local constants; a separate cosmetic RNG
    stream for spawns; `landing`'s yaw chosen by the caller; the sky well dropped.
  * `gen/vaults.js`: `roof` and `wallHeight` options, named legend handlers with `DEFAULT_LEGEND`, id-keyed halls.
  * `game.js`: zone addressing (`zone/zones`) and `checkFloorEvents` over the zone graph. The legacy 20-level stack runs as a
    fixture site under tile (0, 0) with `buildTemple` as its surface zone, so the old game keeps playing.
  * `H` fixes (`turns.js:73`, `interact.js:82`, `gen/vaults.js:347`); `FINAL_DEPTH` removed (effects, throwing, hud,
    vaults, dungeon) in favour of `p.final` and `zone.hasBelow`.
  * Tools: `bot.mjs` (minimal: drives `game.debug`, `game.js:591-592`, in both views), `check-golden`, `check-dungeons`,
    `check-determinism` (dungeon part), `check-blocks`, `run-all`; `test.html` on the new API.
* **Gate:** 1,000 dungeon levels pass `validateDungeonLevel` (as `test.html:36-67` does today) at p95 ≤ 40 ms; golden (c):
  blocks byte-identical for depths 2-19 through `legacyParams`; golden (b) frame hashes identical; two generations of the
  same level identical in blocks, items and creature type, position, elite and uid; every legacy vault stamped with default
  options byte-identical; teleport and falls on a synthetic 80×48×16 zone always land on `stand ≥ 0`; the bot goes down 3
  levels and back up in both views and lands beside the right stairs.

#### 0A2. World, run, surface stub, edges (≈ 2,400 lines)

* **Scope:** `world/worldmodel.js` (compile, validate, `travel`/`edges`, flatten mask); `world/run.js` (`buildRun`,
  `serializeRun`, `restoreRun`, `zoneSeed`, `runRng`); `world/sites.js` placing landmark dungeons and villages, ruins and
  lairs by the fixture region rules (real code that WS10 extends); `story/history.js` returning the fixture `History`;
  `story/villages.js` stub; `gen/surface.js` stub (`heightAt` with the slope rule, cliff mask and flatten mask, `treeAt`,
  ports, a road between ports, rock-bottom water that floats every body, the dungeon entrance, `dungeonRect` and sinkholes
  inside it); the apron (data, `solid()` beyond open sides, `castRay` bounds, no shading work); `tryWalkOff` in both views,
  arrival within ±1, prefetch, edge crossings without the transition screen (the zone name is logged until 0D1 adds the
  HUD toast); `content/world/test-world.js` (40×20: sea, flats, hills, forest, marsh,
  mountains with `travel: "no"`; 3 regions; 3 landmarks: the fixture temple with a 3-level dungeon, a ruin with a 5-level
  dungeon ending in the Flat Queen's hall, a roofless tower whose footprint touches an edge; one road, one river);
  `content/currency.js` fixture; quick start into the start landmark; `story.js` removed and the temple turned into the
  fixture plan; `check-world`, `check-edges` (every edge of every landmark tile, plus 200 random pairs × 3 seeds),
  `check-landmarks`, `check-determinism` (surface and Run).
* **Gate:** the test world validates; seam rules (a)-(e) of §5.1 hold on every checked edge; two generations identical;
  `buildRun` → `serializeRun` → `restoreRun` deep-equal, and the load path never calls `buildRun` (spy); navigability ≥ 90%
  on 500 random tiles; golden (b) and (c) unchanged (dungeons have no apron); in the browser (silent): walk off the east edge in 3D with no black frame and no camera pop, back west
  on the map, down the landmark dungeon 2 levels and back up beside its entrance, and fall through a sinkhole to land under it.

#### 0B. Stats, statuses, body, items, currency, time (≈ 2,300 lines)

* **Scope:** `rules.js` (with `extendRules`); `stats.js` (sources for gear, powers and statuses, the cache, the legacy and
  attribute formula sets, `contentLevel`); attributes on the player (16 everywhere until WS4; the legacy set reads STR 10);
  `status.js` with the core statuses plus `drowning`, `catchUp`, and migration of every timer field (player: 59 references
  to the seven fields; creatures: 32 references to `m.burn/chill/stun/blind/poison/haste`); `time.js` `skipTime`; `body.js`
  with `humanoid` and `beast` plans and migration of `weapon/armour/ring/amulet/sidearm` (about 50 references) to
  `wielded()/worn()/belt`; `items.js` registry with every existing kind registered from `content/items/legacy.js`, `cash`,
  and the exported `takeOne`; `currency.js` with the counter backing and every `gold` touch point moved to
  `funds/pay/receive/formatPrice`; once-per-floor effects → cooldowns; `inventory.js` adapted (screen unchanged);
  `check-stats`.
* **Gate:** `check-stats` (equip/unequip any item and add/remove any status leave every derived stat consistent; no
  base-field writes, proxy trap in debug); golden (a) matches exactly in legacy mode, in both views (bot); `skipTime(600)`
  with poison, regen and cooldowns equals 1/60 s stepping within ±1 HP and ±0.1 s; a non-swimmer stepping into surface deep
  water gets the same drowning timer, damage and exit on the map and in 3D; golden (b) unchanged.

#### 0C. Creatures, combat, the light seam, talk (≈ 2,600 lines, mostly moves)

* **Scope:** `creatures.js` (types registry, `spawnCreature` with `opts.rng`, merged sprites, `touchable`, the helpers,
  legacy types in `content/creatures/legacy.js`); NPCs become creatures with `talk` (19 `npcs` references, `occ` rule,
  flat/ghost talk rules); every `.monsters` and `.npcs` site rewritten, each listed in the session notes; `ai.js` (moved;
  perception through `light.js`; spatial buckets; greedy steps toward creature targets; `AI_HOOKS` with guardian and boss
  hooks); `combat.js` (§3, both views, `legacy` and `dice` branches); `light.js` `lightAt/naturalLight/inDark/
  zoneIsLightless` (daylight 1) with every dark-only rule routed through it (`render3d.js:168-169`, per-hit in `castRay` for
  zones with sky, `monsters.js:290`, `:595`, `turns.js:108`, `:114`, `npcs.js:81`, `interact.js:34`); `factions.js` stub;
  `ids.js`; `game.questEvent`, the guardian hooks and `win()` moved onto the bus; `talk.js` (`registerDialogue`, `registerTalkOptions`, `registerService`,
  Pell's services as registered services, legacy dialogue moved to `content/legacy/encounters.js`); quests as one-stage
  templates through the bus; `check-combat`.
* **Gate:** `grep -rn "\.monsters\b\|\.npcs\b" src` is empty; in dice mode, penetration mean and P(≥1) within ±0.02 of §3.2
  over 10⁵ rolls and a bump duel and a 3D swing duel with the same RNG give identical result sequences; flatlings hit only
  on the map, the Gloom Warden only with the torch out, the Colossus core only from above; in legacy mode golden (a) and (b)
  still match; on a synthetic sky-lit zone at noon with the torch out no ghost plank is drawn and a ghost NPC can't be seen
  or talked to, and at daylight 0 both work; every legacy encounter (Pell, Corwin, Mira, Rook, Lio, Brann, Ess and Tee, the
  Speaking Door, shrines) runs to completion in the bot.

#### 0D1. Shell (≈ 2,300 lines)

* **Scope:** `screens.js`, `keys.js` (top screen first, M and N as `"*"` bindings), `ui.js` (`textInput` with `key`);
  `game.js` reduced to state, loop (with `runUpdates`) and dispatch; `input-browser.js` passes `e.key`; pause opened from
  `onLockChange`; existing screens ported (inventory, talk, shop, journal, story, levelup, pause, dead, transition, toast);
  `hud.js` segment registry with priorities and two rows; `renderMap.js` overlay and describer registries (pure) and the
  map screen's 0.5 s hover emitting `inspect`.
* **Gate:** every mode reachable by keys and mouse in the browser; a text field accepts "Ö" and "m"; losing pointer lock in
  3D opens pause; the HUD fits at 100×30 with every Phase 0 segment registered; golden frame hashes match underground;
  frame time within 5% underground.

#### 0D2. Seams, stubs, save codec, tools (≈ 2,200 lines)

* **Scope:** `abilities.js` API with one sample ability (a short teleport) on the hotbar in both views and the
  `requestTarget` stub; `clock.js` stub over `state.time` with `catchUp`; `save/codec.js` (deflate with detection, zone
  records, trimmed creatures, Run data), `store.js` memory adapter, snapshot-first saves and write-behind on `zone:leave`;
  `screens/title.js` stub (New quick game / Continue); `config.js` flags, `?silent=1` audio sink; `features.js` and every
  workstream's stub index and stub files with frozen signatures; `tests/checks/index.js` with one stub per workstream;
  `test-world.html`; `check-names` (deny-list including `dram`, `parasang` and the research notes' terms), `check-content`
  skeleton (with the coverage rule), `check-save`, `check-perf` skeleton (frame, `refresh`, generation, `passTime`,
  `skipTime`); the bot extended to 10 zones; `tools/README.md` (how to run, Node ≥ 20).
* **Gate:** save → load → canonical JSON identical after a 10-zone bot session, Run data included; `check-save` passes
  headless on Node 20.11; every stub module imports cleanly in Node and in the browser; `run-all` green; tag `p0-done`.

### 8.3 Phase 1: parallel workstreams

Each entry: **owns** · **inputs** (Phase 0 APIs it builds on) · **outputs** · **must honour** · **acceptance** · size.
Acceptance items that depend on another workstream are listed again in the dependency table below with their seam.

**WS1 Overworld travel.** Owns `src/overworld/*`, `screens/worldmap.js`, `content/encounters.js`, `tools/check-world.mjs`,
`tools/check-overworld.mjs`, `tests/checks/overworld.js`.
Inputs: `WorldModel`, `changeZone` (arrival `"travel"`), `skipTime`, zone patches with `relativeTo`, `claimUid`,
`bind/registerScreen`. Outputs: `world` mode with its viewport, travel time, getting lost, encounters, fast travel,
discovery and pins (`reveal`, `pin`), rest (`Z`), discovery XP. Must honour: no zone simulation while travelling; R10; the
`lost` status through `status.js`. Acceptance: a Node random walk of 10⁴ steps (no crash; lost rate per terrain and
encounter rate within ±2% of data); fast-travel paths only over allowed tiles; `travel: "no"` tiles never entered;
arrival edges correct for all 8 directions; encounter bands land 8-12 tiles from the arrival in visited and unvisited zones;
a rest is interrupted by an encounter roll; browser: the world map at 100×30, 160×64 and 180×56, and travel → enter →
walk off → world map round trip. ≈ 1,900 lines.

**WS2 Surface generation.** Owns `gen/surface.js`, `gen/terrain.js`, `gen/ports.js`, `gen/apron.js`, `gen/biomes/*`,
`content/biomes.js`, `content/creatures/wildlife.js`, the names/colours/`map` glyphs of the reserved terrain ids in
`blocks.js`, `tools/check-edges.mjs`, `check-surface.mjs`, `check-landmarks.mjs`, `tests/checks/surface.js`.
Inputs: `Zone`, `solidFor`, `stampVault` + `registerLegend`, the `SITE_BUILDERS` contract, compiled ports, `world.flatten`.
Outputs: `generateSurface`, `heightAt` (slope rule, cliffs, flatten mask), `treeAt`, `edgePorts`, `APRON_BUILDERS.surface`,
`validateSurface` (navigability), a builder for every terrain in `TERRAINS`, legend handlers, surface water by liquid,
deliberate 3D-only plateaus. Must honour: R6; the datum ground layer; rock-bottom water; holes only inside `dungeonRect`;
the 2- and 6-tile margins. Acceptance: every landmark × 5 seeds valid; 500 random tiles × 3 seeds valid, navigability
included; seam rules on every landmark edge and 200 random pairs × 3 seeds; an apron built from the world functions equals
the neighbour's generated band in heights and trees on 50 pairs; p95 ≤ 60 ms; screenshots of three biomes.
≈ 3,200 lines → **2a** (world functions, ports, water, apron, validation) and **2b** (biomes, landmark stamping, props,
wildlife).

**WS3 Rendering outdoors and presentation.** Owns `render3d.js`, `raycast.js`, `light.js`, `materials.js`, `renderMap.js`,
`clock.js` (implementation), `screen-canvas.js`, `music.js`, `sfx.js`, `content/moods.js`, `tools/check-perf.mjs`,
`tests/checks/render.js`.
Inputs: `zone.apron/outdoor/liquid`, the clock API, block `map` fields, the `light.js` seam (Phase 0 already routes the
auto-map and creature perception through it). Outputs: apron shading and the horizon plane, haze, day and night, baked sun,
daylight in `lightAt`/`inDark`, the edge clamp, map terrain looks and legend, liquid tints, half-column outdoor rendering,
music moods by region, optional skyline. Must honour: dark-only rules through `inDark`; mosaics vivid only on the map; flat
shadows; underground frames identical to golden (b). Acceptance: Node frame ≤ 17 ms at 180×56 on the test zone with its
apron; sun bake ≤ 4 ms; zero black cells below the horizon when facing an open edge at noon; at noon with the torch out no
ghost planks or glowing runes on a sky-lit zone, at midnight they show and the auto-map follows the night rule; golden (b)
unchanged; browser screenshots at day, dusk and night and a map of each biome. ≈ 1,900 lines.

**WS4 Character creation and progression.** Owns `progression/*`, `abilities.js`, `player.js`, `leveling.js`,
`screens/create.js`, `screens/charsheet.js`, `screens/abilities.js`, `screens/levelup.js`, `content/genotypes.js`,
`content/backgrounds.js`, `content/mutations.js`, `content/powers.js`, `tools/check-progression.mjs`,
`tests/checks/progression.js`.
Inputs: `stats` (attribute formula set), `status`, `body.addPart`, the `abilities` API, the `requestTarget` stub. Outputs:
the creation wizard; `makeCharacter`; mutations (≥ 16 physical and mental, 4 defects, 2 "planar" ones that bridge the views,
e.g. sensing flat beings in 3D or a short fold that lets you strike from the plane); the MP economy (12 at start, +1 per
level, 4 for a new mutation from 3 seeded offers, level cap `floor(level/2) + 1`); attribute and HP schedule; hotbar;
character sheet; Swimmer as `bonus(swim)`. Must honour: abilities usable in both views with the same cooldown seconds; no
baking. Acceptance: every genotype × background creates a valid player with `RULES.stats = "attributes"`; mutation offers
identical for the same seed; each active mutation fires through the 3D aim path and the map `requestTarget` stub in Node;
level 1→20 simulation without errors; browser: the full wizard by keyboard (a name with å, ä, ö) and by mouse.
≈ 2,800 lines → **4a** (creation, stats, leveling) and **4b** (mutations, abilities, screens).

**WS5 Body mods, items and equipment UI.** Owns `items.js`, `inventory.js`, `effects.js`, `body.js` (after P0),
`bodymods/*`, `screens/equipment.js`, `screens/examine.js`, `content/items/legacy.js`, `artifacts.js`, `implants.js`,
`tools/check-items.mjs`, `tests/checks/items.js`.
Inputs: item registry, body API, `registerUse` (stations), `registerService` (surgeon, identification), the `inspect`
event, stats. Outputs: inventory and equipment screens with scrolling and the body list; the examine screen (items and
creatures) opened by `inspect`; ≥ 15 implants with license points and credits; stations; artifacts identified by INT vs
complexity (failure by 5+ breaks the item); charge cells; the consumable effects table (today's potion and scroll
switches, `effects.js:18-120`, `throwing.js:159-202`). Must honour: curse lock; two-handed rule; R3. Acceptance:
equip/unequip matrix over all slot types and plans; implant install/uninstall rules; identify odds within ±2% of the
formula; examine opens from an `inspect` event; a 60-item pack scrolls in the browser. ≈ 2,400 lines.

**WS6a Factions, reputation, dialogue builders.** Owns `factions.js`, `talk.js` (after P0), `social/index.js`,
`social/reputation.js`, `social/builders.js`, `screens/factions.js`, `content/factions.js`, `tools/check-social.mjs`,
`tests/checks/social.js`.
Inputs: the bus, creatures' `talk/merchant/faction`, `creaturesNear`, `registerTalkOptions`. Outputs: the full
`attitude()`, rep events with witnesses, dialogue builders (villager, priest, guard, wanderer, merchant greeting), the
factions screen. Must honour: the §2.11 house rule for flat and ghost awareness; JSON-only state. Acceptance: attitude
table tests; rep arithmetic; bot: hit a villager → witnesses hostile, rep drops; the builders give valid nodes for every
legacy and fixture talker. ≈ 1,500 lines.

**WS6b Trade, the rite, currency backings, voices, shrines.** Same owner as 6a, run right after it. Owns `dialogue.js`,
`social/merchants.js`, `social/ritual.js`, `social/voices.js`, `social/shrines.js`, `social/backings.js`,
`social/liquids.js`, `screens/trade.js`, `screens/ritual.js`, `content/liquids.js`, `content/items/containers.js`; adds its
cases to `tests/checks/social.js`.
Inputs: `currency.js`, item registry, `registerService`, the secrets API stub, `zone:enter`. Outputs: the generic trade
screen with EGO and rep pricing and registered services, the sharing-rite menu (secrets, powers, recruiting), the item
backing (always), the liquid backing with containers (only if `content/currency.js` names it before 6b starts), voices
from species and faction, shrines, merchant restock on `zone:enter` after `away` ≥ two game days. Acceptance: price
multipliers vs EGO; pay/receive and overflow for every built backing; mixing rules if built; Pell's legacy services all
reachable through `registerService`; trade and ritual screens in the browser. ≈ 1,700 lines (+600 with liquids).

**WS7 Knowledge: history, villages, quests, secrets, journal.** Owns `story/*`, `screens/journal.js`, `screens/story.js`,
`content/grammar.js`, `content/quests.js`, `content/villages.js`, `content/creatures/villagers.js`, `tools/check-story.mjs`,
`tests/checks/story.js`.
Inputs: the `buildRun` slots for history and villages, the P0 `placeSites`, `SITE_BUILDERS`, `stampVault`/`registerLegend`,
the bus (with `inspect`), zone patches and uids, `pin`, `registerTalkOptions`. Outputs: `generateHistory` (replacing the
fixture behind the same contract), `generateVillage` and the village site builder (with mosaic murals readable on the map),
the quest engine and ≥ 7 templates, secrets with pins and visit quests, gossip, the campaign hooks (intro pages, start, main
beats as data), journal tabs. Must honour: R6 for history and villages; uids for cross-zone targets; murals learned only
through `inspect`. Acceptance: 100 seeds of history (valid, ≤ 50 ms, every event has gospel, inscription and a cause;
`siteRequests` well-formed for WS10); villages valid on every village site the P0 `placeSites` returns for 20 seeds; each
quest template completed by events in Node, including one whose target is in an already-visited zone; secret ids stable per
seed; a mural learned by the keyboard path and by hover. ≈ 3,200 lines → **7a** (history, grammar, secrets, journal) and
**7b** (villages, quests, campaign).

**WS8 Combat depth, AI and targeting.** Owns `combat.js`, `ai.js`, `creatures.js` (after P0), `turns.js`, `throwing.js`,
`missiles.js`, `screens/target.js`, `content/items/missiles.js`, `tools/check-combat.mjs`, `tests/checks/combat.js`.
Inputs: §3 contracts, `attitude` (the P0 stub), statuses, the `requestTarget` seam, `zone:leave`/`zone:enter`. Outputs:
creature-vs-creature fights, wary/flee/follow states, followers and chasers across edges (by patch), creature catch-up on
re-entry (healed after an hour away), the outdoor activity radius, the map target and look cursor (`L`, hit chance shown,
`inspect` on confirm), targeted throws and missile weapons in both views, AI ability use, the combat log format, dice-mode
tuning with TTK tables by level band. Must honour: R4; map and 3D parity; budgets per simulated second. Acceptance: arena
sims (two factions, 100 runs) stable; parity test (bump vs swing, same RNG); interposed-creature rule; `passTime` ≤ 12 ms
per simulated second with 60 creatures; a follower crosses an edge in both views; browser: the target cursor by keys and
mouse. ≈ 2,600 lines.

**WS9 Persistence and shell.** Owns `save/*`, `hud.js`, `config.js`, `screens/title.js`, `screens/log.js`,
`screens/options.js`, `screens/dead.js`, `screens/pause.js`, `tools/check-save.mjs`, `tests/checks/save.js`.
Inputs: the codec skeleton, snapshot-first saves, write-behind, the store adapter, Run serialization. Outputs: the
IndexedDB adapter, periodic and unload saves, slots, Classic `live`/`unclean`, Roleplay copy-on-write checkpoints, Wander,
export/import, death recap, message log, options, title (with its warnings), HUD segments. Acceptance: Node round trip
after a 30-zone bot session; record sizes reported (≤ 3 MB projected for 300 zones); migration test (v1 → v2 fixture); a
JSON walker finds no Set, Map, function or class in `game.state`, the player or the Run data; a simulated `hidden` event
commits the slot and the current zone; a checkpoint restored after 5 zone changes gives back exactly the checkpoint state
and a village visit writes one slot record; browser: save, reload the page, continue on the same tile; Classic death
deletes the slot; an unclean exit is counted. ≈ 2,200 lines.

**WS10 Dungeon sites, lairs and legends.** Owns `gen/dungeon.js`, `gen/vaults.js`, `guardians.js`, `traps.js`,
`interact.js`, `world/sites.js`, `content/dungeons.js`, `content/creatures/legends.js`, `test.html`,
`tools/check-dungeons.mjs`, `tools/check-sites.mjs`, `tests/checks/dungeons.js`.
Inputs: the `generateDungeonLevel` API, the `History` contract (P0 fixture), `SITE_BUILDERS`, `dungeonRect`, `claimUid`.
Outputs: `placeSites` extended (history's site requests, lairs, ruins, stations by region rules), `DungeonSpec`, themes,
≥ 7 gimmicks, lair halls with named legends (×1.5 level, double HP, 0-2 mutations, faction love/hate), guardian halls by
id, the boss hook, historic sites with named floors and a relic at the bottom, vault pools by level. Must honour: every
puzzle keeps its both-view rule (`gen/vaults.js:32-105`); the validators; the P0 `placeSites` contract. Acceptance: every
site × all levels × 5 seeds valid; 1,000 random levels pass (`test.html` parity); guardians reachable; historic sites built
from the fixture's two `siteRequests`; a legend lives in exactly one zone; p95 ≤ 40 ms. ≈ 2,400 lines.

**Dependency table** (review #1). Each item passes against its seam in Phase 1; the integrator re-runs it against the real
workstream when both are merged.

| Acceptance item | Needs output of | Phase 0 seam or fixture |
|---|---|---|
| WS1 rest and travel time | statuses, time | `time.skipTime`, `status.catchUpStatuses` (0B) |
| WS1 encounters in visited zones | zone entry | patches applied on every entry, `relativeTo` (0A1) |
| WS2 seams at landmarks | fixed landmark rects | `world.flatten` (0A2) |
| WS3 night auto-map, daylight perception | `refreshView`, `perceive` (WS8 files) | both call `light.lightAt/inDark` since 0C |
| WS3 apron rendering | apron data | `zone.apron`, `castRay` bounds (0A2) |
| WS4 abilities on the map | target screen (WS8) | `abilities.requestTarget` stub (0D2) |
| WS4 attribute stats | stat bus | `RULES.stats = "attributes"` formula set (0B) |
| WS5 examine from `L` | look cursor (WS8) | `inspect` event, emitted by the P0 map hover (0D1) |
| WS5 implant surgery | trade screen (WS6b) | `talk.registerService` (0C) |
| WS6a witnesses | spatial queries (WS8) | `creatures.creaturesNear` (0C) |
| WS6b prices and payment | currency content (C2) | `currency.js` counter backing and fixture (0B, 0A2) |
| WS7 villages on candidate tiles | `placeSites` (WS10) | P0 `placeSites` with fixture region rules (0A2) |
| WS7 quest options, gossip | dialogue (WS6a) | `talk.registerTalkOptions` (0C) |
| WS7 murals | look cursor (WS8) | `inspect` event (0D1) |
| WS8 followers across edges | zone changes | `zone:leave`/`zone:enter` with `side` and `away` (0A1) |
| WS8 attitudes | factions (WS6a) | `factions.attitude` stub (0C) |
| WS9 Run in saves | Run serialization | `run.serializeRun/restoreRun` (0A2) |
| WS10 historic sites | history (WS7) | fixture `History` with two `siteRequests` (0A2) |
| WS10 unique legends | uid registry | `zones.claimUid` (0A1) |

### 8.4 File ownership matrix (Phase 1)

| Files | Owner |
|---|---|
| `game.js features.js screens.js keys.js ui.js events.js ids.js keyset.js rules.js time.js currency.js torch.js world.js zones.js world/worldmodel.js world/run.js stats.js status.js screen.js input.js input-browser.js pathing.js rng.js audio.js`, `screens/transition.js`, `content/index.js`, `tests/checks/index.js`, `tests/fixtures/*`, `tools/node-env.mjs run-all.mjs report.mjs serve.mjs golden-record.mjs check-golden.mjs check-determinism.mjs check-blocks.mjs check-names.mjs check-stats.mjs check-content.mjs bot.mjs README.md` | frozen (integrator only; `check-content` passes to C in Phase 3). `keyset.js` is frozen like `ids.js`; `torch.js` like `time.js` and `currency.js` (its drain is DECISIONS' rule; the bible's ways out of it, WS4's and WS5's, reach it by integration request); `serve.mjs` is a tool like `report.mjs` (0D2 §6). |
| `blocks.js` | WS2 for names/colours/`map` of the reserved terrain ids; new ids only via the integrator |
| `overworld/*`, `screens/worldmap.js`, `content/encounters.js`, `check-world`, `check-overworld`, `tests/checks/overworld.js` | WS1 |
| `gen/surface.js terrain.js ports.js apron.js biomes/*`, `content/biomes.js`, `content/creatures/wildlife.js`, `check-edges/surface/landmarks`, `tests/checks/surface.js` | WS2 |
| `render3d.js raycast.js light.js materials.js renderMap.js clock.js screen-canvas.js music.js sfx.js`, `content/moods.js`, `check-perf`, `tests/checks/render.js` | WS3 |
| `progression/*`, `abilities.js`, `player.js`, `leveling.js`, `screens/create charsheet abilities levelup`, `content/genotypes backgrounds mutations powers`, `check-progression`, `browser-ws4`, `tests/checks/progression.js` | WS4 |
| `items.js inventory.js effects.js body.js`, `bodymods/*`, `screens/equipment examine`, `content/items/legacy artifacts implants`, `check-items`, `tests/checks/items.js` | WS5 |
| `factions.js talk.js`, `social/index reputation builders`, `screens/factions`, `content/factions`, `check-social`, `tests/checks/social.js` | WS6a |
| `dialogue.js`, `social/merchants ritual voices shrines backings liquids`, `screens/trade ritual`, `content/liquids items/containers` | WS6b (same agent as 6a) |
| `story/*`, `screens/journal story`, `content/grammar quests villages creatures/villagers`, `check-story`, `tests/checks/story.js` | WS7 |
| `combat.js ai.js creatures.js turns.js throwing.js missiles.js`, `screens/target.js`, `content/items/missiles`, `check-combat`, `browser-ws8`, `tests/checks/combat.js` | WS8 |
| `save/*`, `hud.js`, `config.js`, `screens/title log options dead pause`, `check-save`, `tests/checks/save.js` | WS9 |
| `gen/dungeon.js vaults.js`, `guardians.js traps.js interact.js`, `world/sites.js`, `content/dungeons creatures/legends`, `test.html`, `check-dungeons/sites`, `tests/checks/dungeons.js` | WS10 |
| `content/world/*`, `content/currency.js` (designed data) | C (content phase); the P0 fixtures stay for tests |

### 8.5 Phase 2: continuous integration

* **A standing integrator** (one agent, branch `integration` from `p0-done`) merges each workstream the moment it passes its
  own acceptance. When several are ready, the order is WS9, WS3, WS8, WS5, WS4, WS6a, WS6b, WS10, WS2, WS7, WS1 (fewest
  consumers first). At each merge it applies that workstream's integration requests, re-runs the dependency-table items
  that involve it against the real code, runs `run-all`, the bot and golden (b), and tags the result.
* **Budget:** one integrator session per two or three merges (about five), plus 2B.
* **Formula flip:** once WS4 and WS8 are both in, the integrator sets `RULES.stats = "attributes"` and `RULES.combat =
  "dice"` by default; golden (a) retires and WS8's TTK tables become the balance reference.
* **Last wiring merge:** title → create → start landmark → first village; the legacy fixture site under tile (0, 0) leaves
  the default world (it stays in the test world).
* **2B Hardening:** all checks green; bot playthrough (create → 3 zones in both views → world travel 10 steps → village
  trade and ritual → quest → dungeon 3 levels → save → reload → continue); performance pass against §6.7; browser QA
  checklist with silent audio.

### 8.6 Phase 3: content integration (parallel by data file)

C1 world map, terrains (with `travel` and `edges`), regions, landmarks and plans · C2 factions, relations, village
cultures, grammar, the currency (and whether it is a liquid) · C3 creature roster and legacy retune covering every level
the world produces (then `RULES.level.contentMax` rises and the clamp goes), encounter tables, legends · C4 items,
mutations, implants, genotypes, backgrounds, powers (names, numbers, text) · C5 quests, dialogue, the main spine. Each file
passes `check-content`, `check-names` and its owner check (every landmark generates and its edges seam; every creature's
art passes the art check, as `test.html:69-100` does today).

### 8.7 Phase 4: balance and release

Playtest loops with the user (pacing matters to them: rewards meaningful to the end, gold was too plentiful once), tuning
`RULES` and tables only; README rewrite (both views, the world, controls); GitHub Pages release.

---

## 9. Testing strategy

* **Headless Node** (`node tools/run-all.mjs`, Node ≥ 20): `tools/node-env.mjs` installs a stub screen backend and input
  backend the way the survey's bench scripts did (`bench/bench.mjs:14-15`, `bench/state.mjs:5-8`), the memory save adapter,
  and silent audio (audio only starts on input anyway, `audio.js:20-30`). It works against `75edbd3` too, which is how the
  golden fixtures are recorded. Check logic lives in `tests/checks/*.js` as pure functions returning
  `{ name, ok, problems, stats }`; `tests/checks/index.js` lists them for both `run-all` and `test-world.html` (a static
  page can't list a directory).
* **Checks:**

| Check | What it proves |
|---|---|
| `check-golden` | mechanics traces (legacy formula sets), frame hashes underground, and dungeon block hashes still match `75edbd3` |
| `check-world` | world size 40..64 × 20..32; every char in the keys; landmarks on tiles you can reach from the start (travel or open edges); roads and rivers 4-connected; tiers 1-8 |
| `check-landmarks` | every landmark zone generates and validates on 5 seeds |
| `check-surface`, `check-edges` | random tiles validate, navigability included; seam rules (a)-(e) of §5.1 on every edge of every landmark tile and on random pairs; world-function aprons match generated neighbours |
| `check-dungeons`, `check-sites` | every site's every level on 5 seeds; 1,000 random levels; guardian/lair reachable; one zone per legend uid; timing percentiles |
| `check-determinism` | same seed → identical blocks, item fields, creature type/position/elite/uid, history, sites, villages, serialized Run; no `Math.random` in the generation folders (static scan) |
| `check-save` | bot session → save → load → canonical JSON deep-equal (Run data included; the load path never calls `buildRun`); JSON-only walker; sizes; migration fixture; checkpoint restore; unload save |
| `check-combat` | penetration and to-hit distributions vs §3.2; TTK tables by level band; map/3D parity with a fixed RNG |
| `check-stats` | equip/unequip and status add/remove leave derived stats consistent; no base-field writes (proxy trap in debug); `skipTime` catch-up equals fine stepping |
| `check-content` | every registry entry has its required fields; art rows and palettes (as `test.html:69-100`); the level coverage rule (§2.18); legend handler ids unique |
| `check-names` | deny-list of Caves of Qud proper nouns, lore terms and units (`dram`, `parasang` …) over `src/`, `content/`, `index.html` |
| `check-blocks` | block ids are append-only against `tests/fixtures/block-ids.json` |
| `check-perf` | outdoor and dungeon frame times at 180×56 (apron included), `refresh`, sun bake, generation, `passTime` per simulated second, `skipTime` |
| `bot.mjs` | scripted playthrough through `game.debug` in both views (from 0A1, extended every session and by the integrator) |
| grep gates | `\.monsters\b` / `\.npcs\b` absent from `src` after 0C; no `deflate-raw` in `src` |

* **`test-world.html`:** runs the same check functions in the browser (and keeps `test.html` for the dungeon generator)
  with a summary like today's page, and `window.testResult` for automation.
* **Browser verification** with the existing launch config (`.claude/launch.json`, `python -m http.server 8124`), URL
  `?silent=1&seed=N&debug=1&quick=1`. With `silent`, `audio.js` routes the master output into an `AnalyserNode` followed by
  a zero-gain node, so any audio check measures the analyser and nothing reaches the speakers; close the test tab when done
  (the pane keeps running when hidden). Drive the game through `window.game.debug` and screenshots: horizon and apron at
  noon, dusk, night with the torch out; noon with the torch out and no ghost planks; the map of each biome; edge walks in
  both views with no black frame; the world map and every new screen at 100×30, 160×64 and 180×56.

---

## 10. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Phase 0 refactor breaks the working game (53 `floor.monsters`, 62 kind checks, 56 depth uses, 59 timer-field uses across `src/`) | golden traces recorded at `75edbd3` before any change; legacy formula sets; six small sequential sessions, each gated by golden checks, the bot and both-view smoke tests; no aliases (grep gates) |
| 2 | Parallel agents collide in shared files | the ownership matrix; registries (legends, talk options, services, HUD, updates); pre-created `features.js`, stubs and `tests/checks/index.js`; integration requests; branches from one tag |
| 3 | A workstream can't pass its own acceptance without another's output | the dependency table: every such item has a Phase 0 seam or fixture, re-run at merge |
| 4 | Outdoor 3D frame over budget (already near 16.7 ms at 180 columns, engine-survey §6) | baked sun, cheap apron shading, activity radius, half-column rendering, `check-perf` in every run |
| 5 | Visible seams or a world that ends at every edge | world functions for terrain and trees; landmark flatten mask; margins for local features; the voxel apron; prefetch; `check-edges` on every landmark edge |
| 6 | Hidden height steps make surface zones unwalkable on the map | slope-limited relief, cliffs only as map walls, a navigability metric in `validateSurface` |
| 7 | Landmark zones that fail or take long to generate | flattened in the world function and validated on every seed; retries of local features only; landmark check in the CI script |
| 8 | Determinism drift (a stray `Math.random` in generation) | R6 scan, RNG passed into spawns, double-generation compare of an explicit field list; the Run is saved, so drift can't corrupt a save |
| 9 | Save loss, quota, shared origin, closing the tab | write-behind per zone, snapshot-first saves, a synchronous unload transaction, namespaced IndexedDB, versioned migrations, export, quota warning; Classic counts unclean exits |
| 10 | Async zone loading races (input during `changeZone`) | cached swaps are synchronous; the `transition` mode swallows input and pauses time while a read is pending; one change at a time |
| 11 | Map-mode and rest simulation cost | budgets per simulated second; greedy creature-vs-creature steps; spatial buckets; `skipTime` for rest and travel |
| 12 | Scope creep toward everything in Qud | the "overkill" list (qud-character-gear §14) is out of scope: temperature, tinkering, dismemberment, cooking, body-swapping, precognition; thirst out of Phase 1; liquid money gated; workstream sizes capped |
| 13 | New systems drift away from the two-view identity | Appendix B is part of every acceptance check: a feature without a map form and a 3D form is not done |
| 14 | Lore contamination from the research notes | `check-names` (units included); content review in Phase 3 |
| 15 | Balance broken by new combat maths against old content numbers, or by levels beyond the old tables | legacy/dice switch flipped only at integration; `RULES` in one file; TTK tables per level band; `contentLevel` clamp and the coverage rule until C3 |
| 16 | Unifying NPCs and monsters changes subtle behaviours (ghosts met only in the dark, flat talkers, the talking door, Lio's lever) | explicit helpers instead of a catch-all list; regression list in the bot; `check-dungeons` keeps the NPC reachability rules (`gen/dungeon.js:892-896`) |
| 17 | Content data late, off-schema or undecided (currency) | the test world and currency fixtures let every phase run without it; `check-content` names the exact field; the liquid backing is gated |
| 18 | Memory growth with hundreds of visited zones | derived arrays for two zones; ≤ 24 dormant zones in memory, the rest evicted after write-behind |
| 19 | UI overflow on small windows | widgets clamp; HUD priorities; world map viewport; every screen tested at 100×30 |
| 20 | Agent sessions too large; integration piling up | estimates per session, a/b splits, interface stubs so each session stands alone; continuous integration with its own budget |

---

## Appendix A. Bonus keys (the stat bus vocabulary)

Kept from today (`items.js:126-134`, content-survey §1.3): `crit, swing, reach, maxDmg, leech, crush, thorns, ward, regen,
darkRegen, str, maxHp, armour, speed, torch, sense, darkSight, stealth, firstBlock, jump, featherFall, killHeal, undeadHeal,
burnBonus, poisonHit, sunder, cutsFlat, foldGuard`. New: the six attributes `str agi tou int wil ego`, `av, dv, ma, pv,
toHit, examine, navigation, travel, carry, price, cooldown, resistFire, resistFrost, resistShock, resistPoison, swim`; from WS8
by integration request, `missileAcc` (to hit with a missile weapon); from WS4 by integration request, `torchCost` (the torch's
glim: −0.5 half, −1 free; `torch.js`); from WS5, `breath` (fraction more breath under water; `status.js`).
Every key is documented next to the registry in `stats.js`; `check-content` rejects unknown keys.

## Appendix B. The two-view rule for each new system

| System | On the map (turn-based, flat, sees everything seen) | In 3D (real time, height, light) |
|---|---|---|
| Surface terrain | hills read as floor and are always walkable, cliffs and trees as walls; roads and water visible | height, jumping onto deliberate plateaus, sight lines over hills |
| Edges | step off the border tile; arrival within one block of where you left | walk past the border onto the apron; no black frame, no camera pop |
| World map | the whole travel layer is 2D | the apron and skyline silhouettes of nearby landmarks (optional) |
| Day and night | fewer tiles fill in at night | darkness, sky, sun shadows |
| Dark-only things | ghosts met only after you've seen them in the dark | runes, ghost planks and ghosts only where `inDark`: underground with the torch out as today, outdoors only at night or in deep shade |
| Factions | attitude colours on glyphs; bump talks or attacks | `E` to talk; second click to attack a friend |
| Flat factions | they exist only here | shadows with nobody casting them |
| History murals | floor mosaics readable from above; `inspect` (look cursor or held hover) gives the inscription and the secret | faded tiles; the hostile version carved as dark-only runes |
| Abilities | target cursor, exact hit chance shown | aim with the crosshair, pitch included |
| Ranged combat | targeted shot, projectile flies while time passes | real flight, dodging, aiming high |
| Implants and mutations | `planar` mutations bridge the views (e.g. sense flat beings in 3D) | jump, flight, night vision matter physically |
| Surface water | pools by colour; stepping into deep water asks first and starts the same drowning timer | floating with the view dipped, the same drowning timer |
| Dungeons and puzzles | mosaics, spike beats, flat beings (unchanged) | runes, ghost planks, climbs, the Colossus (unchanged) |
