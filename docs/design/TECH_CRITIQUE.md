# TECH_DESIGN.md: adversarial review

Reviewed against `src/` at commit `75edbd3`, `engine-survey.md`, `content-survey.md`, and the two draft content
concepts in this folder (`concept-dense.md`, `parts/p1-p5.md`). Code citations are `src/` unless they name another
file. Most of the design's own `file:line` citations check out. The problems are in what the design builds on
top of them.

**Count: 2 blockers, 18 major, 13 minor.**

Severity scale:
- **blocker:** the plan can't run as written, or a frozen Phase 0 contract would need rework later.
- **major:** a real bug, a gap or a rework risk that a specific phase will hit.
- **minor:** worth fixing; cheap.

---

## Blockers

### 1. Several Phase 1 acceptance criteria need files owned by other workstreams, or their unfinished output

- **Severity:** blocker
- **Evidence:**
  - **WS3.** §6.3 says the auto-map's lit test in `refreshView` (`turns.js:114`) must multiply sky light by
    daylight, and WS3 must pass "at midnight with the torch out, auto-map fill matches the night rule". But
    `turns.js` belongs to WS8 (§8.4).
  - **Daytime perception has no owner.** "Creature perception outdoors treats daytime as torch lit"
    (§6.3; today `monsters.js:595`, which moves to `ai.js`, owned by WS8) appears in no workstream's outputs.
  - **WS1.** WS1 owns rest (`Z`, §4.3), but resting has to go through `passTime` (`turns.js:33-51`, WS8).
  - **WS7.** WS7 must show "villages valid on all candidate tiles". The candidate tiles come from
    `placeSites` region rules, which belong to WS10 (§2.1 build order, §8.3 WS10 outputs). The Phase 0 stub
    places only one dungeon per landmark (§1.4 `world/sites.js`).
  - **WS10.** WS10 must deliver "historic sites with named floors and a relic at the bottom" from history's
    `siteRequests`. History belongs to WS7, and Phase 0 only creates "stub ... history.js ... with the frozen
    signatures" (§1.1).
  - **The `L` key** is listed with two owners, "WS5 / WS8" (§4.3): WS5 owns the examine screen and WS8 owns the
    look cursor. Both would `bind` it.
  - **The workaround fails.** §8.1 routes cross-file needs to "Integration requests" that are applied in
    Phase 2. So these workstreams can't pass their own acceptance in Phase 1.
- **Fix:** Add the seams in Phase 0 and give each one an owner:
  - **`lightAt(game, zone, x, y, z)` in `light.js`** (WS3). Phase 0 makes both `refreshView` and the AI's
    perception call it. Then the night rule is WS3's alone.
  - **`skipTime(game, seconds, { interruptible })` in `turns.js`**, created in Phase 0 (see 11). Rest and world
    travel call it.
  - **Real fixture data from the stubs.** `placeSites` places villages, ruins and lairs by the region rules from
    the fixture data. The history stub returns a fixed fixture `History` with two `siteRequests` and one relic.
    WS7 and WS10 then replace the generators, not the data contract.
  - **`L` goes to WS8.** WS8 binds `L` and emits `inspect` (see 32). WS5 registers the `examine` screen that
    `inspect` opens.
  - **A dependency check.** Add a column to §8.3 listing every acceptance item that needs another workstream's
    output, and require a Phase 0 fixture for each.

### 2. The Phase 0 gates use tools that don't exist yet

- **Severity:** blocker
- **Evidence:**
  - The 0B gate needs "the old game plays identically in both views (scripted bot ...)", and the 0C gate needs
    "every legacy encounter still runs to completion in the bot". But `tools/bot.mjs` is only built in 0D
    (§8.2, 0D scope).
  - The 0B gate also names `check-stats`, which isn't in the §1.1 tree and has no owner.
  - "The old game" no longer exists after 0A: 0A deletes `story.js`, the temple and the 20-floor stack.
- **Fix:**
  - Build `tools/node-env.mjs` and a minimal `tools/bot.mjs` in 0A, drive it through `game.debug` as today
    (`game.js:591-592`), and extend it in each later session.
  - Add `tools/check-stats.mjs` to 0B.
  - Reword the 0B and 0C gates as "mechanics parity". For example: with a fixed RNG, the same potion, scroll,
    curse and R-swap scripts give the same player state on a fixture dungeon level as at `75edbd3`. Record that
    expected output once, before 0A starts.

---

## Major

### 3. Not saving `Run` makes saves break on any generator change, and the compatibility claim is false

- **Severity:** major
- **Evidence:**
  - The glossary says a run is "Rebuilt on load, never saved". §7.1 rebuilds history, sites, villages,
    factions, legends and secret texts from the seed.
  - §7.6 claims "A slot from an older `gen` still loads (visited zones are stored in full); unvisited zones
    will simply generate with the new code."
  - But persistent state points into the Run:
    - quests hold `giver.uid`, `target.zoneKey` and `itemUid` (§2.13);
    - journal secrets use ids like `hist:<ruler>:<event>` (§2.14);
    - `state.rep` holds `village:<siteId>` keys (§2.16);
    - pins point at sites.
  - After any change to `history.js`, `sites.js` or `villages.js`, the rebuilt Run differs. Then:
    - quests point at uids that don't exist;
    - a stored village zone has NPC names that don't match the new `Village` record;
    - a site can move to a different tile.
  - Even without a version change, any accidental nondeterminism in `buildRun` (Map iteration order, a stray
    `Math.random`) silently corrupts a loaded game.
  - A related seam problem: stored old-generator zones border newly generated zones, so seams break after
    any terrain change.
- **Fix:**
  - Serialise the Run's generated data (history, sites, villages, factions and relations, legends, secrets)
    into the slot record. It's JSON and small: tens of KB.
  - On load, rebuild only `compileWorld` (fixed data) and use the saved Run.
  - Keep `buildRun` for new games only.
  - On a `VERSION.gen` mismatch, mark the slot "legacy terrain". Then either generate unvisited zones with the
    old generator version, or accept seam breaks and say so.
  - Change §7.6 to say what actually happens.

### 4. The currency is hard-wired to water and "drams", which conflicts with the content work and the naming rule

- **Severity:** major
- **Evidence:**
  - §2.4 says "`gold` removed: currency is water". §2.10 builds pay/receive, overflow, mixing and thirst
    around liquids.
  - The social API is `water(e) → drams` (§1.4). The trade screen shows "prices in drams" (§4.2).
  - 0B already converts gold into "a temporary `water` counter".
  - The content is "being designed separately" (R7), and the two draft concepts disagree:
    - `concept-dense.md:14` uses *glim* (lamp oil) and has no thirst;
    - `parts/p1.md:169-170` uses water, but its unit is the *gill*.
  - `concept-dense.md:111` puts **dram** on its banned-words list, because it is a Caves of Qud signature
    unit. R8's deny-list and `check-names` would then fail on the engine's own identifiers and UI strings.
  - Liquid mixing with the 4× replacement rule, pour/fill and thirst add about 600 lines to WS6. They are only
    needed if liquids really are the currency.
- **Fix:**
  - Add a content-defined `CURRENCY = { id, name, unit, glyph, backing: { kind: "liquid", liquid } | { kind:
    "item", item } | { kind: "counter" } }`.
  - Make the engine API `funds(e)`, `pay(game, e, n)` and `receive(game, e, n)`, with no units in code.
  - In 0B, gold becomes `player.funds`.
  - WS6 builds the liquid backing only if the chosen content needs it. Thirst stays out of Phase 1.
  - Add "dram" to the deny-list now, so it can't creep in.

### 5. `arrivalPoint` and its helpers index with the dungeon's 48×48, but surface zones use them too

- **Severity:** major
- **Evidence:**
  - The design keeps `arrivalPoint` in `gen/dungeon.js` and adds `"edge"`, `"travel"` and `"load"` (§1.4). It
    also says "local 48×48×10 constants replace the imports (:4)" (§1.2).
  - But `beside()` reads `f.stand[x + y * W]` (`gen/dungeon.js:767`). `landing()` runs
    `reachable(..., W, D, ...)` and loops `i < W * D` (`:774-776`). `standWith()` loops over `W, D` (`:788-792`).
  - Surface zones go through all of them:
    - coming up the stairs lands "beside" the surface entrance (§5.4, relying on `:759`);
    - falling through a sinkhole;
    - the teleport scroll calls `arrivalPoint(f, "fall", ...)` on any zone (`effects.js:94-96`).
  - On an 80-wide zone those indices land on the wrong tiles.
- **Fix:**
  - Move `arrivalPoint`, `beside`, `landing` and `standWith` into `zones.js` (P0, frozen) and read
    `zone.w/d` throughout.
  - Keep the local 48 constants in `gen/dungeon.js` only for room layout and `findPath`.
  - Add a 0A check: teleport on an 80×48 zone always lands on a tile with `stand >= 0`.

### 6. "Seamless edges" is defined wrongly, and three generation rules break seams

- **Severity:** major
- **Evidence:**
  - **The gate tests the wrong thing.** §5.3.1 maps column `x` to `gx = wx·80 + x`. So A's `x = 79` and B's
    `x = 0` are different, adjacent world columns. Yet the 0A gate (§8.2) and `check-edges` (§9) require
    "identical stand heights and blocks" on the shared edge. That only holds if every edge is flattened.
  - **Arrival needs an exact height match.** It looks for "the nearest standable tile with the same stand
    height" (§5.1). On any slope it finds none at the mirrored spot, so it moves you sideways up to 3 tiles,
    possibly onto a ledge.
  - **The 3D physics fakes the far side.** `solid()` treats beyond the edge as a copy of the edge column (§5.1).
    So you walk off at height h and appear at B's h±1: a camera pop.
  - **Flattening can reach the edge.** Footprints "plus a 2-tile skirt" are flattened to the datum (§5.4).
    Landmark anchors can be fixed `[x, y]` anywhere (§2.18). A skirt that touches an edge changes heights the
    neighbour doesn't know about.
  - **Trees cross edges.** World-coordinate features "don't" keep a margin (§5.3.6), but trees have canopies
    up to z 10. A tree rooted at A's x = 79 must also exist in B.
  - **The check samples poorly.** `check-edges` uses only random tile pairs, so it will rarely sample landmark
    edges.
- **Fix:**
  - Define a seam as:
    - (a) both zones evaluate the same world function `heightAt(gx, gy)`, so `|stand(A,79,y) − stand(B,0,y)|`
      equals the function's own step there;
    - (b) ports, roads, rivers and cliffs cross at the same `along`;
    - (c) no step at the seam is larger than `PLAYER_STEP_UP` unless the world function has a cliff there.
  - Accept arrival heights within ±1 of the leaving height.
  - Make `solid()` beyond an open edge use `heightAt` of the neighbour's first column instead of mirroring.
  - Put site and landmark flattening into the world function as a flatten mask built from `run.sites`, so
    neighbours see it. Otherwise forbid reserved rectangles within skirt + 2 of an edge, and validate it.
  - Place trees by a world-coordinate hash and generate any tree within canopy radius of the edge in both
    zones.
  - Make `check-edges` cover every edge of every landmark tile plus random pairs.

### 7. In 3D, the world visibly ends at every zone edge

- **Severity:** major
- **Evidence:**
  - Rays that leave the grid return false (`raycast.js:33-35`). §6.1 replaces the black band with a flat
    "horizon plane at `z = FLOOR_Z`" coloured like the neighbour's ground.
  - **The edge is close.** A zone is only 48 deep, so the north or south edge is at most 24 tiles away, and
    often 1-5.
  - **The flat plane looks wrong.** Edge terrain sits 0-3 blocks above the datum (§0.2), so the plane reads as
    a drop at every edge. The next zone's hills, trees, road, river and creatures are invisible until you cross.
    Then they pop in, and the zone behind you turns flat.
  - **Crossings may black out the screen.** "`changeZone` ... shows the transition screen while pending", and
    today's screen lasts 1.2 s (`game.js:254-259`). Edge walks would black out every 20-40 s.
  - **The cost is understated.** "One division per missed pixel" leaves out the noise texture, daylight and
    haze those pixels now get, on up to half the screen.
  - The engine survey offered an apron (option b, engine-survey §2.2), and the design dropped it.
- **Fix:**
  - **Draw the neighbour's terrain as a height field.** For missed rays outdoors, march `heightAt(run, gx, gy)`
    (WS2's world function, already deterministic and cheap) for up to 24 tiles beyond the edge, coloured by the
    neighbour's biome.
  - **Or keep the plane, but at the right height.** Put it at the edge column's height, not `FLOOR_Z`. Then
    budget it in `check-perf`.
  - **No black screen for edge crossings.** When the target zone is cached, or generates within one frame
    budget, show the zone name as a HUD toast. Use the full transition screen only for stairs, travel and
    loads.
  - **Pre-generate the 4 neighbours** in idle time as a requirement, not an option, so crossings rarely wait
    on generation.

### 8. Dark-only things outdoors would show in broad daylight

- **Severity:** major
- **Evidence:** Every dark-only rule keys on the torch alone:
  - runes glow (`render3d.js:168`);
  - ghost planks show (`:169`);
  - ghosts can be touched (`monsters.js:290`) and seen on the map (`turns.js:108`);
  - ghost NPCs appear (`npcs.js:81`) and can be talked to (`interact.js:34`).

  Underground that is fine, because everywhere is dark. Outdoors by day, "torch out" is normal (and in
  `concept-dense.md:209` the torch is free in daylight). So ghost planks, ghosts and glowing runes would appear
  in sunshine. §6.3 says night "brings the dark-only things outside", but adds no light term. That breaks the
  house rule "visible only in the dark with your torch out".
- **Fix:**
  - Define `inDark(game, x, y, z) = !player.torch && lightAt(...) < RULES.darkThreshold`, where `lightAt` is
    sky × daylight + lamp (see 1).
  - Route every rule above through it, in Phase 0, as part of the `c.vis` unification (§2.3). For ghost
    planks and runes, apply it per pixel: `castRay` checks the light at the plank voxel.
  - Add it to Appendix B and to WS3's acceptance tests: a noon screenshot with the torch out shows no ghost
    planks.

### 9. Deep water on the surface: the rock bottom makes a harmless ditch, and swimming or drowning has no owner

- **Severity:** major
- **Evidence:**
  - Phase 0A adds only "surface deep water has a rock bottom" (§8.2).
  - But `solid()` treats `WATER_DEEP` as air (`world.js:118`). A non-swimmer sinks to z = 1, stands on the
    rock, and keeps their head above the water. On the map, `groundBelow` (`turns.js:66-69`) finds the same
    z = 1 spot after the dive prompt.
  - Meanwhile `standHeight` returns -1 for that column (`world.js:125`). So creatures and flow fields treat it
    as a hole, while the player wades through it in both views.
  - "Float at the surface, slowed, with `drowning`" (§5.3.4) needs:
    - buoyancy physics in `player.js` (WS4);
    - a map rule in `turns.js` (WS8);
    - an underwater tint (WS3);
    - the status itself.

    No workstream lists any of it as an output.
- **Fix:**
  - Assign surface water to one owner (WS2 2a, with a Phase 0 hook in `player.js` and `turns.js`).
  - Make `solid()` treat surface deep water as a floor at datum − 1 for swimmers only.
  - Non-swimmers get buoyancy: hold the eye at the surface, apply `drowning` and a slowdown.
  - Make `standHeight` and the map follow the same rule.
  - Add a both-views test: a non-swimmer steps into deep water on the map and in 3D, and gets the same drowning
    timer and the same exit.

### 10. On the surface, invisible 2-3 block steps will break map navigation

- **Severity:** major
- **Evidence:**
  - Terrain is noise "rounded to 0-3 blocks" with bilinear biome blends and a cliff term (§5.3.2).
  - The player climbs 1 on the map (`pathing.js:6`, `turns.js:140`), and so do monsters (`pathing.js:4`).
  - The map draws every column of height 0-3 as `.` (§6.5, README "The map is flat").
  - Click-travel and auto-explore route only on what the map knows (`turns.js:247-254`). So on an 80×48 field
    of rolling noise, routes keep stopping with "That's too high to climb" (`turns.js:204`), and creature flow
    fields get chopped up.
  - In dungeons, hidden heights are deliberate puzzles. On every surface zone they would be noise.
  - The validator only checks that edges and ports are reachable (§5.3.9).
- **Fix:**
  - Constrain the world function so adjacent columns differ by at most 1, except at deliberate cliffs of 4 or
    more blocks, which the map shows as walls. Plateaus that need a jump in 3D (§5.3.8) are then placed on
    purpose.
  - Add a `validateSurface` metric: at least 90% of standable columns in one component under
    `PLAYER_STEP_UP`, and at most N two-block steps per zone.
  - Also: `look` for floor columns must be the top solid block under `stand`, not `FLOOR_Z - 1` (§6.5).
    Otherwise every hill shows its subsoil.

### 11. Map-mode simulation costs explode, and the budgets contradict each other

- **Severity:** major
- **Evidence:**
  - `passTime` runs every system in 1/60 s steps (`turns.js:35-48`). One map step (0.24 s, `turns.js:24`) is
    15 creature updates; a wait is 30.
  - The design adds a per-target flow-field cache with "at most 6 recomputed per update" (§3.4) at 0.5 ms each
    for 80×48 (§6.7). That's up to 15 × 3 ms per step during creature-on-creature fights.
  - §6.7 also budgets "one map turn ≤ 3 ms" and "creature update, 60 creatures ≤ 2 ms". Those can't both hold
    when a turn is 15 or more updates.
  - Rest (`Z`, "until healed") runs thousands of game seconds through the same loop: 36,000 steps for
    10 minutes, which freezes the tab.
  - `pickTarget` makes every creature check line of sight to every hostile candidate every 0.25 s.
- **Fix:**
  - Throttle flow fields per creature-target pair in game time: at most every 0.25 s, like `perceive`. Use the
    existing greedy step (`monsters.js:635-639`) for creature targets within 8 tiles, and drop the general
    cache.
  - Budget per simulated second, not per update.
  - Add `skipTime(game, seconds)` (Phase 0, `turns.js`). It ticks statuses, cooldowns and regen in bulk. It
    simulates in 0.25 s steps only while a non-idle creature is within the active radius, and it stops on
    sight or damage. Rest and world travel use it.
  - Bucket creatures spatially for `pickTarget`.

### 12. Zone patches only reach zones that haven't been generated yet

- **Severity:** major
- **Evidence:**
  - `getZone` applies patches "after generation, before `seal()`", and only then (§2.2).
  - But many patches target zones you've already visited:
    - world-map encounters place their group by patch (§5.2), and fast travel runs only over visited tiles,
      with encounters at ×0.25;
    - quests can target a village you've been to (§2.13);
    - history wanderers can arrive anywhere.
  - Placing the group "8-12 tiles from your arrival" needs the arrival point, which is computed after the
    patch.
  - Legends can exist both in their lair zone and as a wandering encounter, so they can be duplicated.
- **Fix:**
  - Apply pending patches in `enterZone`, after arrival and for cached or loaded zones too, with idempotent ops
    keyed by uid.
  - Give encounter patches an `relativeTo: "arrival"` option.
  - Keep a `state.uids = { [uid]: zoneKey | "dead" }` registry. Generation, patches and lairs consult it, so a
    uid lives in at most one zone and dead legends never come back.

### 13. The world map doesn't fit the screen widths the game actually runs at

- **Severity:** major
- **Evidence:**
  - "A 64-wide map is 128 columns plus a 40-column info panel" (§5.2): 168 columns.
  - `screen-canvas.js:17-19` gives 160 columns in the measured browser pane (engine-survey §6: 160×64), and
    150-170 on many windows.
  - §4.4 also promises that "every screen works at 100×30".
  - The zone map needs exactly 160 columns (80 × `TILE_W`, `renderMap.js:17`). It fits "without scrolling"
    only at 160 columns or more and 52 rows or more.
  - WS1's acceptance test ("draws within 180 columns") wouldn't catch this.
- **Fix:**
  - Give the world map a scrolling viewport that follows the cursor, like `renderMap.js:62-66`. Fold the info
    panel into a bottom strip below 168 columns.
  - Test at 100×30, 160×64 and 180×56.
  - Change the §0.2 claim to "no scrolling at 160 or more columns".

### 14. The level formula runs past the existing content, and gives the surface a level one too low

- **Severity:** major
- **Evidence:**
  - `level = tierToLevel(tier) + (z − 1)·levelStep` with `tierToLevel(t) = 1 + 4(t − 1)` (§5.5). Tiers 6-8 come
    out at levels 21-29, and their dungeons up to about 38.
  - Every legacy monster's `depths` ends by 20 (`monsters.js:147-189`). Above that, `pickMonsterType` falls
    back to `"goblin"` for everything (`monsters.js:324`).
  - The relic band is hard-coded `depth >= 14 && depth < 20` (`items.js:440`), so no relics drop above 20.
  - HP keeps growing at 6% per level (`monsters.js:339`).
  - So until C3 (Phase 3), every high-tier test and bot run spawns goblins with triple HP. The claim that
    "today's 1-20 balance curves keep their meaning" is false.
  - For the surface (z = 0) the formula gives `tierToLevel − 1`: tier 1 is level 0.
- **Fix:**
  - Surface level = `tierToLevel(tier)`.
  - Map tiers onto 1-16 and let dungeon depth add up to 4, so legacy tables cover 1-20. Or clamp the legacy
    lookups with `min(level, 20)` until C3.
  - Add a `check-content` rule: every (region, level) pair the world can produce has at least 3 spawnable
    creature types and a loot table.

### 15. The `zone.monsters` migration alias crashes on assignment and quietly changes behaviour

- **Severity:** major
- **Evidence:**
  - §2.2 declares `get monsters()` as an alias of `creatures`.
  - ES modules run in strict mode, so assigning to a getter-only property throws. Current assignments:
    `game.js:110`, `monsters.js:659`, `guardians.js:117`, `gen/dungeon.js:365`, `:412`.
  - Even with a setter, the alias now includes talkers in every one of the roughly 50 places that loop over
    "monsters":
    - `throwAtNearest` throws at the nearest visible creature, which could be a merchant (`throwing.js:70-72`);
    - spikes damage villagers (`traps.js:62-67`);
    - talkers become solid (`monsters.js:699-710`);
    - potions of seeing reveal them (`effects.js:187-189`).
  - A filtered getter would instead lose every `push` (`monsters.js:578`, `:691`, `effects.js:109`, vault
    letters).
- **Fix:**
  - No alias. In 0C, rewrite each site with an explicit helper: `zone.creatures`, `hostilesTo(game, e)`,
    `targetsFor(game, e)`.
  - Add a gate: `grep -n "\.monsters\b\|\.npcs\b" src` is empty at `p0-done`.
  - Do the same for `npcs`.

### 16. `CompressionStream("deflate-raw")` doesn't work in this machine's Node

- **Severity:** major
- **Evidence:**
  - §7.2 says "`CompressionStream("deflate-raw")` (async, browsers and Node 18+)".
  - I checked on this machine (Node v20.11.0, the version the engine survey used):
    `new CompressionStream("deflate-raw")` throws "The argument 'format' is invalid". `"deflate"` and `"gzip"`
    work.
  - So `check-save` (a 0D gate) fails headless.
- **Fix:** Use `"deflate"`, which Node ≥ 18, Chrome, Firefox ≥ 113 and Safari ≥ 16.4 all support. Or detect
  support and fall back. Pin the Node version in `tools/README` or `package.json` `engines`, which needs no
  dependencies.

### 17. Saves made while the page closes are async and will often be lost (and Classic can be save-scummed)

- **Severity:** major
- **Evidence:**
  - Autosave runs "on `visibilitychange → hidden` and `pagehide`" (§7.5). A save means: async CompressionStream
    → IndexedDB transaction across every dirty zone (§7.2-7.3). The page is often gone before those promises
    settle.
  - Serialisation is async, but the game keeps running, so the snapshot can be torn.
  - Classic has one slot and autosaves every 120 s. Closing the tab mid-fight and reloading restores the last
    autosave, which beats permadeath.
- **Fix:**
  - Compress and store each zone when you leave it (it is already dirty-tracked). Then the unload save only
    writes the slot record and the current zone, uncompressed, in one IndexedDB transaction opened
    synchronously in `visibilitychange → hidden`, which fires more reliably than `pagehide`.
  - Take a synchronous `structuredClone`-style snapshot before any async step.
  - For Classic, set `slot.inProgress = true` on load and clear it on a clean save. On load, if it is set, load
    anyway and log it, or treat it as a death, whichever the user wants.

### 18. Phase 0 has no hook for adding options or services to someone else's conversation

- **Severity:** major
- **Evidence:**
  - `talk.js` freezes only `registerDialogue(id, builder)` and `talkTo`, which dispatches on `c.talk.dialogue`
    (§1.4).
  - But many workstreams need to add to conversations they don't own:
    - quest templates have `options?(game, q, c)` (§2.13, WS7);
    - gossip (WS7);
    - the sharing rite and "learn a power, recruit" (§4.2: WS6, WS4, WS8 followers);
    - surgeon and implant install services (§2.5, WS5);
    - artifact identification (WS5);
    - legend taunts (WS10).
  - Today services are a hard-wired list (`dialogue.js:167-197`).
  - Without a hook, every one of these has to edit `dialogue.js`, which WS6 owns.
- **Fix:**
  - Phase 0 adds `registerTalkOptions(id, (game, c) => option[] | null, { priority })`. `talkTo` appends the
    results to the root node of any builder.
  - Also `registerService(id, { label, price(game, c), available(game, c), run(game, c) })`. The trade screen
    lists `c.merchant.services` from that registry.

### 19. Phase 0 sessions, and WS6, are estimated too small

- **Severity:** major
- **Evidence:**
  - **0A (≈2,200 lines)** includes: `blocks.js` with 24 new ids, the full `Zone` rewrite, all of `zones.js`
    (async, edges, arrival, patches, LRU), the world model and run, the sites stub, a surface stub with ports
    and a road, parameterised dungeons and vaults, `game.js` addressing, removing `FINAL_DEPTH` from 6 files,
    porting the temple, a 40×20 fixture world with rivers, 6 check tools, `test.html`, and a browser walk gate.
    That's the riskiest code in the project, and probably 3,500 lines or more.
  - **0D (≈2,300 lines)** includes: screens, keys and the UI library, the `game.js` rewrite, 9 ported screens,
    two registries, the abilities API with 3D aiming, the save codec with zone and creature trimming, title,
    config, test-world, check-names and check-content, the bot, and every workstream's stub index and stub
    files with frozen signatures (about 40 files).
  - **WS6 (2,600 lines, not split)** carries 7 systems: full attitude, rep events, 5 dialogue builders, trade,
    the rite, liquids and containers, voices and shrines.
  - §8.1 itself caps a session at 1,500-3,000 lines.
- **Fix:**
  - Split 0A into 0A1 (Zone, zones, dungeon params, `H` and `FINAL_DEPTH` fixes, `bot.mjs`) and 0A2 (world
    model, run, surface stub, edges, fixture world).
  - Split 0D into 0D1 (shell, screens, ported screens, HUD and map registries) and 0D2 (stubs, save codec,
    abilities API, tools).
  - Split WS6 into 6a (factions, rep, attitude, dialogue builders, option hooks) and 6b (trade, rite,
    currency backing, voices).

### 20. Merging 10 branches in two integration sessions is unrealistic

- **Severity:** major
- **Evidence:** §8.5 2A merges about 25,000 new lines from 10 parallel branches in one session. In the same
  session it applies every workstream's "Integration requests", wires title → create → start → village, adds
  followers across edges and zone catch-up, and removes the aliases. 2B then runs the full bot playthrough and a
  performance pass. Integration problems found in 2A have no session budgeted to fix them.
- **Fix:**
  - Integrate continuously. A standing integrator merges each workstream into an `integration` branch as soon
    as it passes its own acceptance, in the order already given, and applies that workstream's integration
    requests right away.
  - Gate each merge on `run-all` plus the bot.
  - Budget one session per two or three merged workstreams, plus 2B.
  - Move "followers across edges" and "zone catch-up" into owned workstreams (WS8 and WS9) instead of
    integration.

---

## Minor

### 21. The dynamic column cap fights the zone map

- **Severity:** minor
- **Evidence:**
  - The fallback drops the column cap to 150 when 3D is slow outdoors (§6.7), but the zone map needs 160
    columns (`renderMap.js:57-66`).
  - `screen-canvas.resize()` clears the glyph cache (`screen-canvas.js:27`), and glyphs are rebuilt with
    `getImageData` on first use (`:61-81`). So switching the cap on every Tab would hitch.
- **Fix:** Lower the resolution inside `render3d` instead: cast every other column outdoors and duplicate the
  results. Leave the screen grid alone.

### 22. A single `Tile.passable` flag can't express the world rules the content drafts already use

- **Severity:** minor
- **Evidence:** §2.1 has one `passable`, which drives both world-map travel and open zone edges (§5.1). The
  drafts need more:
  - "mountain spans (walk-in only)" (`concept-dense.md:8`);
  - "The Lattice can't be crossed on the world map" (`concept-dense.md:449`).
- **Fix:** Split it into `travel: "yes" | "no" | "road-only"` for the world map and `edges: "open" | "solid"` for
  zone walking, per terrain, with optional region overrides.

### 23. Legend letters share one global namespace across three parallel workstreams

- **Severity:** minor
- **Evidence:**
  - `registerLegend(ch, fn)` is global (§1.4).
  - The existing letters (`gen/vaults.js:355-406`) already use about 40 characters. WS2 adds
    `T t w W = , % x @`, and WS7 (buildings) and WS10 (lair halls) will add more, all in parallel.
- **Fix:**
  - Allow a per-plan `legend: { ch: id }` that maps letters to named legend handlers
    (`registerLegend("tree", fn)`).
  - Phase 0 registers the existing letters as defaults. `registerLegend` throws on a duplicate id.

### 24. The file lists contradict each other

- **Severity:** minor
- **Evidence:**
  - `check-stats` (§8.2, §9), `tools/check-overworld.mjs` (WS1) and `src/missiles.js` (WS8 owns) are missing
    from the §1.1 tree.
  - `test-world.html` "runs `tests/checks/*.js`", but a static page can't list a directory.
  - §1.4 puts `takeOne(e, index)` in `items.js`, but today it's `throwing.js:31` and takes a stack.
- **Fix:** Regenerate the §1.1 tree from the §8.3 "owns" lists. Have `tests/checks/index.js` export the list
  (Phase 0, append-only).

### 25. The time bases aren't defined

- **Severity:** minor
- **Evidence:**
  - `state` holds both `clock` (minutes) and `time` (seconds) (§2.17). The clock runs at 1 game minute per
    second of game time (§0.2), and world travel "adds minutes in bulk".
  - It's unclear whether world travel advances `game.time`. Spike phases (`traps.js:21`), sighting fades
    (`renderMap.js:167`) and zone `lastTime` catch-up all key on it.
  - §5.2 caps status ticks at 60 s per journey, yet says a journey "does finish a cooldown". Cooldowns over
    60 s won't finish.
  - `concept-dense.md:210` uses a different scale.
- **Fix:**
  - Keep one persistent clock: `state.time` in seconds.
  - Make the clock a view of it: `minutes = time / RULES.clock.secondsPerMinute`.
  - World travel adds seconds through `skipTime` (see 11), with its own rule for which statuses are capped.

### 26. Once-per-floor effects become once every 20 seconds on small surface zones

- **Severity:** minor
- **Evidence:**
  - Second wind and the warding amulet store their "used" flag per floor (`game.js:131-132`,
    `monsters.js:512-513`). The design moves them into per-zone `flags` (§2.2).
  - Walking across an 80-tile zone takes about 19 s (`player.js:7`). Hopping back and forth over an edge gives
    a fresh use in each zone.
- **Fix:** Turn them into cooldowns in game time, for example once per 10 game minutes or per rest, stored on the
  player.

### 27. `blockLog` and full checkpoint copies are over-engineered

- **Severity:** minor
- **Evidence:**
  - Every `set()` after sealing logs to a Map that nothing reads ("kept for a later diff encoding", §7.2).
    Zones are stored whole anyway.
  - Roleplay checkpoints copy the slot and *all* zone records each time you enter a village (§7.5). With 300
    zones that's about 1-2 MB written per village visit.
- **Fix:**
  - Drop `blockLog` in v1.
  - Make checkpoints copy-on-write: each zone record carries `savedAt`. A checkpoint stores the slot record
    plus a list of `(zoneKey, version)` pairs, and older zone versions are kept only while a checkpoint
    references them.

### 28. The input layer can't do text entry, and Esc never arrives under pointer lock

- **Severity:** minor
- **Evidence:**
  - The browser backend passes only `e.code` (`input-browser.js:198-202`), and the UI library defines
    `textInput(state, code)` (§4.4). With physical key codes, a name field can't produce capitals or
    layout-specific letters (ö on a Swedish keyboard is `Semicolon`).
  - M and N are intercepted globally before the mode dispatch (`game.js:513-520`).
  - "`pause` / `options` ... Esc in 3D" (§4.2): while the pointer is locked, the browser uses Esc to release it
    and the page never sees the keydown. Today's code relies on `onLockChange` (`game.js:571-574`).
- **Fix:**
  - Pass `e.key` as a third argument (`onKeyDown(code, repeat, key)`) and make `textInput` use it.
  - Keep the rule that the top screen gets keys first, and that includes M and N.
  - Open pause from `onLockChange`, not from a key binding.

### 29. The R6 lint misses `Math.random` that generation reaches indirectly

- **Severity:** minor
- **Evidence:**
  - The static scan covers only `gen/`, `world/` and two story files (§0.1 R6).
  - But generators call `spawnMonster`, which uses `Math.random` for `shot`, `anim`, `think` and `pause`
    (`monsters.js:352-357`).
  - `gen/dungeon.js:785` (`landing`) uses `Math.random` itself, inside `gen/`.
  - "Two generations of the same zone are byte-identical" (0A gate) is therefore only true for blocks.
- **Fix:**
  - Pass the generator's RNG into `spawnCreature` (as `opts.rng`).
  - Move `landing`'s random yaw to the caller.
  - Have `check-determinism` compare an explicit list of fields: blocks, item fields, and creature
    type/position/elite/uid.

### 30. Two links between the surface and dungeon aren't specified

- **Severity:** minor
- **Evidence:**
  - **Falls.** A fall through a sinkhole at x = 70 of an 80-wide surface zone lands on a 48-wide dungeon
    level. `landing` then picks whatever tile is nearest to (70, y) (`gen/dungeon.js:773-786`), with no
    relation to where the dungeon sits under the site.
  - **The sky well.** Dungeon level 1 still gets a sky well open to the sky (`gen/dungeon.js:151-160`). Under a
    surface zone, the ground directly above it isn't open.
- **Fix:**
  - Give each dungeon an offset under its tile (the site entrance maps to the level's up-stairs), and convert
    fall coordinates through it.
  - Allow sinkholes only within the dungeon's footprint.
  - Make the sky well a gimmick that also cuts the matching hole in the surface zone, or drop it.

### 31. The HUD line overflows, and autosave has no periodic hook

- **Severity:** minor
- **Evidence:**
  - The status line is one fixed row with no wrapping (`hud.js:113-142`). The design adds about 10 segments
    (§4.5), which overflow at 100 columns (§4.4's target).
  - Autosave "every 120 s of play" and "every 10 real seconds of world-map travel" (§7.5) needs a per-frame or
    timer hook. §2.12 has no `tick` event, and `game.js` is frozen.
- **Fix:**
  - Give HUD segments a `priority` and an optional second row. The registry drops the lowest-priority
    segments first.
  - Add an `update` registry, `registerUpdate(fn, { modes })`, to Phase 0's loop.

### 32. Learning a secret from a mural is a side effect of drawing, and hover is mouse-only

- **Severity:** minor
- **Evidence:**
  - "Hovering it in map view shows its inscription ... and teaches the secret" (§2.14).
  - `describeTile` runs inside `renderMap` every frame (`renderMap.js:186`). The hover cell comes only from
    mouse movement (`game.js:566-569`), so keyboard players can never learn it.
- **Fix:**
  - Describers stay pure.
  - The map look cursor (WS8, `L`) and a hover that lasts at least 0.5 s emit `inspect { zone, x, y }`.
    WS7 subscribes and calls `learnSecret`.

### 33. Wall height in `stampVault` ignores the plan's height

- **Severity:** minor
- **Evidence:**
  - `wallCol` always fills `FLOOR_Z..ROOM_TOP-1`, which is 4 blocks (`gen/vaults.js:348`), whatever
    `vault.height` says.
  - §5.4 says "Walls rise `height` blocks from the datum". With `roof: "none"`, towers and tall landmarks would
    get 4-high walls with air above them.
- **Fix:** In the roof-option change (0A), make `wallCol` fill `FLOOR_Z..FLOOR_Z + height − 1`. Use `ROOM_TOP`
  only as the default for dungeon vaults, so existing vaults stay byte-identical.
