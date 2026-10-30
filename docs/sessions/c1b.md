# Phase 3, C1b: the landmarks

The second half of C1 (`docs/HANDOFF.md` "Phase 3 plan"; DECISIONS "Phase 3 content sessions"), in the worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\c1` on `ws/c1`, fast-forwarded to `p3i-c2` (7c2ff54). Local machine (Windows 11,
Node 20.11.0, headless Chromium from Playwright), shared with C3's session and then the integrator's. `docs/c1.md` has
"C1b: integration requests" (26: what needs code) and "C1b: handoff".

## 1. The start

`git fetch origin --tags`; `git merge p3i-c2`: a fast-forward from `3bdcc7e` (C1a's tag) to `7c2ff54`. `run-all` at the
start: **38 of 38** (248.5 s, 11 at a time). The session stopped once (the app's process ended, 2026-10-29) after the
review came back and resumed on 2026-10-30 at the coordinator's word to finish.

## 2. What was made

- **15 landmark plans** (`content/world/plans/*.js`: one a landmark, Halfnight three, one a ward), each in the vault
  letter format with its own `stamp`, and their entries in `content/world/landmarks.js`: the anchor (the plan's corner in
  its zone), the three registers (bible §5's own lines), `letters` (who stands on each of the plan's people letters, with
  C3's `kind` where its tag has one), `below` (who lives in its dungeon, by floor or floor up), `holy` and `holyFloors`
  (C2 #5), `visibleFrom` (the Gnomon from every span) and the settlements' checkpoints. A plan may carry `areas` (where a
  faith's rule holds), `steles` (dial-steles and their carved hours) and `texts` (its carvings). `plans/kit.js` holds
  what they share: five legend handlers (`lm.ground`, `lm.stack`, `lm.ghost`, `lm.person`, `lm.hall`), a house stamper,
  murals, and a Grid to draw the bigger towns.
- **The landmark dungeons' data** (`worldmap.js` LANDMARK_DUNGEONS, merged into LANDMARK_INDEX): each dungeon's theme,
  its gimmicks floor by floor (the bible's keys mapped onto `gen/dungeon.js` GIMMICKS by GIMMICK_KEYS) and its `cast`
  (Kettle Mesa's first flatlings), its floors' names, its cradles (the Metronome's #2 and the Square's #3 on floor 1), its
  bottom where the code builds one today (the Metronome's Escapement in the Colossus's hall), and `planned`: what the
  bible gives it that needs code (its true bottom, its own inhabitants by C3's ids, a hall on a middle floor, headroom,
  murals, the tide, the floors up, a second way out, clues and captives).
- **GIMMICK_KEYS** (`worldmap.js`): every §15.3 key → the GIMMICKS it plays, the vaults it draws, what its surface plan
  builds, and what still needs code.
- **Checks**: check-landmarks section 5 (`checkC1b`, `PROMISES`, `reach3d`, `wardsWorld`) and check-content section 1c,
  with three mutants in check-content's list.

## 3. Acceptance, with the numbers

| Item | Result |
|---|---|
| The 15 other landmarks on their plans (bible §5, §15.3) | **Pass**, with Halfnight's Middle and East Wards on theirs only in a world where each ward is a span of its own (deviation 1, request 1): on seeds 1, 7, 42, 1234 and 31337, 85 zones (15 landmarks and the two wards × 5), each with its plan stamped at its anchor (check-landmarks section 5) |
| Each generates on 5 seeds, the same twice | **Pass**: 85 zones, 85 attempts (none retried), 0 problems, 85 of 85 the same twice; and check-landmarks section 3, every span of the 16 landmarks on 5 seeds: 90 zones, none retried, every one twice the same |
| Seams with its neighbours | **Pass**: 325 seams (20,880 tiles) on the world function wherever the plan leaves the ground as it was, no step over a block but at a cliff (check-landmarks section 5); check-edges on the real world's landmark spans and 100 random pairs: 790 edges, 50,336 seam tiles, 98,744 crossings with none shifted |
| Its people placed by `letters` | **Pass**: 52 people by letter over the 16 entries (43 for the 15), each one's place in its plan; 225 places reachable on the map over the 5 seeds; the Tall Table's three on its top reached by the 3D walk, only with a sprinting jump and only over the ghost planks. Who lives below: 15 people and named creatures by floor, for C3 and C5 (their kinds on p3-c3: `kind`) |
| Its dungeon's levels, gimmicks and bottom | **Pass** for levels and gimmicks: 11 dungeons, 48 floors, 240 floor parameters on 5 seeds at §15.3's levels with their names, the floors §5 names where it names them (the Press-hall, the Noon Socket, the Speaking Door's floor, the Warden's and Noon's), GIMMICK_KEYS' gimmicks (each dungeon's floors play exactly its keys' union, and its `cast`), and the cradles on the Metronome's and the Square's floor 1; every floor generated and valid (260 floors in the table below, 0 bad; check-sites 1,289 levels on both worlds). Bottom: the Metronome's (the Colossus's hall, its guardian in it); the others' are `planned` (deviation 4, request 5) |
| `holy` where C2's request 5 names a holy place | **Pass**: the Temple of Angles (the Noon Vigil), the Hour-house (the Horary, (24, 11)), the Hush (the Lampless, (26, 11)), the Square (the Assize, its floors too), Saltpage (the Pressed, the Under-Page too), the Metronome (the Plan, its floors too); beyond them, from FAITHS' lists, the Unlit Choir (the Lampless; floor 6 the Vigil's), the Pressyard's mosaic (the Pressed), and the areas of Halfnight's rows, Molar's checkpoint and Benchmark's Cradle; every faction checked |
| The Gnomon's 14-block foot at (40, 24) | **Pass**: the span's middle solid from the datum to 14 up, shale above its 3-high base, on 5 seeds (check-surface item 14, check-landmarks: held to the bible's 14, not the plan's constant); render3d starts the needle on it (the screenshot) |
| A screenshot of each landmark in both views | **Pass**: 30 in section 7 (`?silent=1`, the real world, seed 1234, audio routed to an analyser and a zero gain: 1 connection, 0 direct; 0 console errors; the server stopped and the browser closed) |
| check-landmarks, check-surface, check-edges, check-sites, check-world, check-content, check-names | **Pass**, each in run-all (section 6): landmarks 355 promises and 10 climbs; surface 1,500 real zones, the foot on 5 seeds, no wildlife in 45 settlement spans; sites 682 sites, 1,289 levels, 630 sinkholes all on their spots; content 1c's landmark block and 19 of 19 mutants; names 203 modules, 0 hits; and §15.10's retired names, held by check-content 1c |
| Surface generation inside §6.7's budget (check-perf alone against `p3i-c2`) | **Pass**: p50 29.2, p95 49.08, max 72.58 ms (budget p95 60, max 150; `p3i-c2` 43.12 / 53.23) |
| Golden (b), check-screen-frames, check-legacyfights untouched | **Pass**: golden 27 frames, 0 mismatched, and its mechanics; screen frames 47, 34 compared, 0 mismatched; legacyfights PASS; the test world's data unchanged |
| Text in the bible's voice, within §15.9's budget | 1,663 words in the landmark area (check-content: the registers, roles, floor names, carvings, Hollowmere's included) of the 4,000 §15.9 gives landmark descriptions and their people's dialogue (C5's); the Dark lines held to lower case with no punctuation; the names and texts in section 8 |

Per landmark, on the 5 seeds (the wards in the wards world; ms the median generateSurface, run alone after the gate):

| Landmark | Zones | Attempts | Problems | The same twice | Open seams | Key points | Navigability (lowest) | Dungeon floors | ms (median) |
|---|---|---|---|---|---|---|---|---|---|
| dialFloor | 5 | 5 | 0 | 5 of 5 | 20 | 15 | 100.0% | — | 52 |
| kettleMesa | 5 | 5 | 0 | 5 of 5 | 20 | 5 | 100.0% | 15 (0 bad) | 36 |
| benchmark | 5 | 5 | 0 | 5 of 5 | 20 | 50 | 100.0% | 20 (0 bad) | 43 |
| tallTable | 5 | 5 | 0 | 5 of 5 | 20 | 0 | 100.0% | — | 36 |
| molar | 5 | 5 | 0 | 5 of 5 | 20 | 40 | 100.0% | 10 (0 bad) | 32 |
| folio | 5 | 5 | 0 | 5 of 5 | 20 | 30 | 100.0% | — | 29 |
| halfnight | 5 | 5 | 0 | 5 of 5 | 20 | 5 | 100.0% | — | 35 |
| pressyard | 5 | 5 | 0 | 5 of 5 | 20 | 5 | 100.0% | 25 (0 bad) | 35 |
| unlitChoir | 5 | 5 | 0 | 5 of 5 | 20 | 25 | 100.0% | 30 (0 bad) | 29 |
| metronome | 5 | 5 | 0 | 5 of 5 | 20 | 20 | 100.0% | 30 (0 bad) | 36 |
| drownedLantern | 5 | 5 | 0 | 5 of 5 | 5 | 5 | 100.0% | 25 (0 bad) | 33 |
| square | 5 | 5 | 0 | 5 of 5 | 20 | 10 | 100.0% | 15 (0 bad) | 30 |
| gnomon | 5 | 5 | 0 | 5 of 5 | 20 | 5 | 100.0% | 40 (0 bad) | 27 |
| saltpage | 5 | 5 | 0 | 5 of 5 | 20 | 20 | 100.0% | 15 (0 bad) | 32 |
| foldmother | 5 | 5 | 0 | 5 of 5 | 20 | 20 | 100.0% | 15 (0 bad) | 29 |
| halfnightMiddle | 5 | 5 | 0 | 5 of 5 | 20 | 20 | 100.0% | — | 43 |
| halfnightEast | 5 | 5 | 0 | 5 of 5 | 20 | 20 | 100.0% | — | 35 |

## 4. Verification

- **Faults the new checks found in my own data** (fixed in `e7e69df`): Molar's stele niche was cut off by its own
  stele; three of the Pressyard's 300 figures were under the engineers' camp; the Drowned Lantern's road never reached
  the island (its hub stood on the glass crust, which a road may not cross); the Hierarch was on "floor 5" of a dungeon
  of 3 floors (the Square's floors up are `up`).
- **run-all's first full run** (at `3ed4957`): 36 of 38. check-determinism failed six lines of the plans
  (`Math.hypot`, `sin`/`cos`/`atan2` in generation code: engine-dependent bits), fixed in `99ce07b`; check-overworld's
  timed world-map draw read 3.03 ms (budget 3) with 11 checks running and passes alone.
- **My own read of the bible against the plans**: Molar's Flat line says "Gate 1" and it had none (`58ac562`: an arch
  over the gullet, the road under it); the Gnomon is on the horizon of every surface zone (§4.12), so it is known on the
  world map from every span (`c283113`).
- **Mutants of check-landmarks section 5**, each applied to a file, the check run on seed 1, the file restored: the
  ghost planks' gap narrowed to 3 (the top reached sprinting without them), both sprint gaps narrowed to 2 (reached
  walking), the needle 13 high, a gimmick off the Metronome's key, two floor names swapped, Teodor's house without its
  door, a lamp in the Unlit Choir, a holy place for no faction, the Square's cube with a window; and a no-op control.
  Two passed at first, because the check read the plans' own data (`e87f3e3`: the foot and the named floors held to the
  bible). After the review **13 of 13** fail it (three new: Foldmother with 31 platforms, the Gnomon's sinkholes back, Molar's stele without its carving). check-content's new mutants (a punctuated Dark line, a plan letter left to the
  default legend's key, a dungeon short of a floor's name) are in its list: 19 of 19 caught.
- **The independent review** (a fresh reviewer given the files and the bible, not my reading; it ran its own probes on
  40 seeds and found the registers, the floors and levels, the people's names and titles, the heights, the 41 houses and
  300 figures, the climb, the entrances, the Metronome's beat and C2's six holy places right). Its 19 findings, and
  what came of each:
  - fixed in the data: §15.10's retired "Platen" in a floor's name, now held by check-content (`d98a130`); sinkholes
    into the Dial-works past the Gnomon's door on 39 of 40 seeds, and into the Square's cells (`5bf3079`); the Speaking
    Door drawn on any of the Under-Page's floors (`a22462d`); Foldmother's rings no village (`156b807`: 30 platforms
    joined by bridges, houses in the pleats); no flatlings in Kettle Mesa, hostile flatlings in the Square where its
    prisoners are to be talked to, the Unlit Choir's floor 4 asking for the parent's warden, the Gnomon's door's other
    keys, Tovi Hallen (`4ebf0e1`); holy floors and finer areas (the Vigil's floor 6, Molar's checkpoint, Benchmark's
    Cradle; the Pressyard's Press not holy), the dial-steles' hours, the Root Canals' far mouth, the Signal and Map Rooms
    (`744a5e9`); a cube that wasn't one, a one-barbed arrow and run-together pips (`5b29a82`); floor names against their
    floors, mixed registers, roles written as design notes (`d98a130`); Molar's gate (already `58ac562`);
  - written as requests where they need code (docs/c1.md 6, 19-26): each dungeon's own inhabitants, the Square's
    identical rooms and prisoners, the steles' prayer, the canals' second way up, the rooms' services, the clues and
    captives, Folio's shadows, the rune doors;
  - kept and said: the tide and the canals' planks are the generator's nearest gimmicks (deviation 7); Benchmark's level
    line stays carved stone (deviation 10).
- **A trial merge with C3**: the integrator's `origin/integration` at `a7964b7` (C3 merged, no tag yet) merges into
  `9935031` without a conflict, and check-landmarks, check-content, check-sites and check-world pass on the merged tree
  (an uncommitted merge in a throwaway worktree, since removed). A first trial against the branch before its own
  check-content fix (the legacy stack read at 20 at most once `contentMax` is 23) failed that one coverage item, which
  the integrator's fix covers; nothing of mine is in it.
- **The old game**: golden (b), check-screen-frames and check-legacyfights pass in every run-all; `browser-gate`
  (the test world: the old game's boot, its 3D edge swap, the ruin's stairs and sinkholes) PASS on seeds 1234 and 7,
  0 console errors; `browser-2b` PASS (the real world from the title and `?quick=1`, Tab both ways, the world map's 882
  spans). The test world's data and every test-world check are untouched.

## 5. Deviations from the bible

1. **Halfnight's Middle and East Wards stand only in a test world.** The code stamps a landmark's plan on its own
   span alone (integration request 1), so in the game today Halfnight is its West Ward on its plan and two plain spans;
   the other wards' plans are checked where each ward is a span of its own (check-landmarks `wardsWorld`).
2. **The Tall Table's top is a wall on the map.** The code draws a plan's ground 2 blocks up or more as wall, so the
   map shows the mesa as one block, not "the top and the foot the same: flat" (§5 E); the point the bible makes, no map
   path up, holds. Its nests are 3D's for the same reason until request 13.
3. **People are places.** Every landmark's people are letters on their plans, reachable key points, with who stands
   there in `letters` (and who lives below in `below`); none is placed, as C1a left Hollowmere's: their kinds are C3's
   (p3-c3 has five of them) and their words C5's.
4. **Bottoms.** Only the Metronome's dungeon has a bottom today, the Colossus's hall standing for the Escapement's (§5 K:
   "built on the Colossus pattern"); the others end in an ordinary last floor until request 5 (each one's `planned`).
5. **Holy places beyond C2's six**: the Unlit Choir (the Lampless; its floor 6 the Vigil's, where Noon lies) and the
   Pressyard's mosaic (the Pressed), both in FAITHS' own lists; Halfnight's are span by span, and the finer ones (its
   rows, Molar's checkpoint, Benchmark's Cradle) are plans' `areas`.
6. **The Dial Floor's three accounts** are fixed texts (§2's registers) until history gives the run's Fifth-Hour event
   (request 11); its arrow bears north-east and its pips are five, as its Flat line says.
7. **Gimmick keys the generator can't play** (darkMapping, loweringCeiling, ruleBanners, mystery, and the surface keys
   threeAccounts, climbUp, mapOnlyTown, lightIsLaw) map onto no GIMMICKS; their surface parts are in the plans and the
   rest is request 10. Two mappings are the nearest the generator has, not the bible's mechanism: tideOfHours plays
   `flooded` (water standing in half the rooms all day, where the bible's floors are dry from 11:00 to 13:00 and the
   water rises after), and borrowedDark's ghost planks come from `haunted`, which turns only the level's plank floors to
   ghost planks (on some floors none) and adds shades, which lamplight burns. twoLayouts (the Rootfold) plays allDeep,
   the Pleatwood's heights, until its day and night layouts are code.
8. **Doors the bible times or draws** stand open: the Gnomon's door at every hour (§5 N: 11:00-13:00, or the Plumb
   Key, the Cube or Strade) and Folio's archive, whose drawn door is a gold tile in front of a blank stone box that nothing
   enters yet (requests 10, 12, 26).
9. **The Square's floors up** aren't built (request 8): its dungeon is the three floors down, its cube a solid block over
   its gatehall; its rooms are of four materials, not one (request 20).
10. **Benchmark's level line** is a ring of carved stone (RUNE blocks) round the pillar at 3 up: cut, as the Deep line
    says, and with the torch out it shows as a rune, which fits its Dark line ("the line was cut to lie").

## 6. The gate

- `node tools/run-all.mjs` at `9935031` (the last code change; the commits after it are this file and the handoff):
  **37 of 38** (258.5 s, 11 at a time). The one failure is check-overworld's timed world-map draw, 3.11 ms (budget 3)
  with eleven checks running, as the brief expects; **alone it passes** (9 of 9 parts; the real world's draw at 100×30
  1.34 ms p50).
- check-perf alone, `--against p3i-c2 --rounds 3 --no-render`, four runs of each tree alternating: **PASS**. Surface
  generation p50 29.2, p95 49.08, max 72.58 ms (`p3i-c2` p95 43.12, max 53.23); dungeon generation p95 24.22 (25.01);
  frames at noon, dusk and night p50 17.1 / 15.41 / 15.21 (17.1 / 15.44 / 15.88; noon over 17 on both trees: the
  machine's, not failed); restoreRun 4.26 (4.2); passTime 6.95 (6.38); the map step 1.7 (1.69). (A first run, with the
  machine busy, read everything about a fifth slow on both trees and passed by the same rule.)
- Browser, headless Chromium, audio silenced: `browser-2b` PASS on the final tree; `browser-gate` PASS on seeds 1234 and
  7 at `e87f3e3` (the test world, which nothing since touches); the screenshots, 0 console errors.

## 7. Screenshots

Seed 1234, the real world, 10:00 on day 1, `game.debug.enterZone` onto each span (the map shown whole, as if walked).
The map at the left, 3D at the right from a point outside or before each landmark. The 3D view is the game's ASCII
raycaster; the yellow `@`s at the right edge are the held throwing knife.

| Landmark | The map | 3D |
|---|---|---|
| The Dial Floor (5, 15) | ![the map](c1b/dialFloor-map.jpg) | ![3D](c1b/dialFloor-3d.jpg) |
| Kettle Mesa (6, 14) | ![the map](c1b/kettleMesa-map.jpg) | ![3D](c1b/kettleMesa-3d.jpg) |
| Benchmark (11, 12) | ![the map](c1b/benchmark-map.jpg) | ![3D](c1b/benchmark-3d.jpg) |
| The Tall Table (8, 9) | ![the map](c1b/tallTable-map.jpg) | ![3D](c1b/tallTable-3d.jpg) |
| Molar (20, 9) | ![the map](c1b/molar-map.jpg) | ![3D](c1b/molar-3d.jpg) |
| Folio (24, 15) | ![the map](c1b/folio-map.jpg) | ![3D](c1b/folio-3d.jpg) |
| Halfnight, the West Ward (24, 11) | ![the map](c1b/halfnight-map.jpg) | ![3D](c1b/halfnight-3d.jpg) |
| The Pressyard (23, 7) | ![the map](c1b/pressyard-map.jpg) | ![3D](c1b/pressyard-3d.jpg) |
| The Unlit Choir (31, 6) | ![the map](c1b/unlitChoir-map.jpg) | ![3D](c1b/unlitChoir-3d.jpg) |
| The Metronome (37, 13) | ![the map](c1b/metronome-map.jpg) | ![3D](c1b/metronome-3d.jpg) |
| The Drowned Lantern (31, 16) | ![the map](c1b/drownedLantern-map.jpg) | ![3D](c1b/drownedLantern-3d.jpg) |
| The Square (27, 2) | ![the map](c1b/square-map.jpg) | ![3D](c1b/square-3d.jpg) |
| The Gnomon (37, 3) | ![the map](c1b/gnomon-map.jpg) | ![3D](c1b/gnomon-3d.jpg) |
| Saltpage (2, 4) | ![the map](c1b/saltpage-map.jpg) | ![3D](c1b/saltpage-3d.jpg) |
| Foldmother (12, 4) | ![the map](c1b/foldmother-map.jpg) | ![3D](c1b/foldmother-3d.jpg) |

## 8. Names and key texts, for the user to read through

Not a gate. The three registers are bible §5's own; everything else here is C1b's.

**The Dial Floor** (B). *Flat:* "DIAL FLOOR. Pips 5. Arrow 1, bearing north-east." *Deep:* "A salt-crusted ring of flagstones round a stone pin, its base carved with a crowd of kneeling people." *Dark:* "we were not kneeling / we were being pressed"
- Carved: "In the last year of the Fifth Hour the people of the Flats were sent north-east, five spans and more, to stand where the needle's shadow fell. The Flats count them still, and the count does not change."
- Carved: "BEHOLD THE FIFTH HOUR, WHO CALLED THE FLATS TO KNEEL AT THE NEEDLE'S FOOT, AND THE FLATS KNELT AND WERE GLAD."
- Carved: "they said kneel / we said where / the floor said here"

**Kettle Mesa** (C). *Flat:* "KETTLE MESA. Floors 3. Shaft 1." *Deep:* "A hollow mesa like an upturned kettle, open to the sky; every floor a ring of ledges round a drop." *Dark:* "the grubs hum when they dig / listen"
- Below: the Grub Mother, floor 3.
- Floors: Kettle Mesa, the Rim; Kettle Mesa, the Ledges; Kettle Mesa, the Kettle's Bottom.

**Benchmark** (D). *Flat:* "BENCHMARK. Towers 6. Mark: 0." *Deep:* "A walled station of brass instruments around a grey pillar cut with a single level line." *Dark:* "the pillar is older than the line / the line was cut to lie"
- People: Surveyor-General Teodor Quint-Vey (the Survey's head); Saara Tovi (instrument-master (the tinker)); the leech (healer); Detail C (an automaton on loan from the Plan; works Truing Cradle #1); the Chandler banker (a Chandler bank); the caravan-master (the Drovers' caravan stop); Pell (peddler (days 3-4 of his round)); the signaller (keeps the Signal Room, which shows the Hand on the world map); the Map Room's surveyor (sells Location readings and shows the tier layer).
- Floors: the Datum, the Gauge Room; the Datum, the Plate Hall; the Datum, the Long Level; the Datum, the Stone.
- Carved: "THE DATUM. ALL HEIGHTS FROM HERE. CUT IN THE YEAR THE GROUND WAS LEVEL."

**The Tall Table** (E). *Flat:* "TALL TABLE. Height: not recorded." *Deep:* "A mesa sheer on every side, chimes ringing at the top in a wind you can't feel down here." *Dark:* "there is a stair / it only comes out at night"
- People: Kreeva Old-Wing (the Kite elder (legendary); teaches Tumbling); the feather-trader (sells the feather cloak (+250 Kites)); the Kite at the overlook (sells the Kites' view reading: every span within 6, on the world map).
- Carved: "THE WIND IS THE HOUR'S BREATH. WHOEVER CLIMBS HERE IS LATE."

**Molar** (F). *Flat:* "MOLAR. Gate 1. Toll: 40." *Deep:* "A caravanserai hollowed out of one enormous tooth, its gullet full of longbacks and argument." *Dark:* "the canals under the tooth are older than the toll / so are we"
- People: Mother Saffre (factor of Chandler House Saffre: the toll, the bank, the clear-glim exchange); Zaqar Tesfu of Nine Longbacks (Drover caravan-master: the market, longback hire (× 1.5 travel)); Assizer Castor Dell-Cassin (from beat 2: the checkpoint that turns back the Bent and seizes Deepwright contraband); Rook (bounty hunter: the bounty board, named legendaries for glim); the innkeeper (the inn: rest); the map-seller (readings); Pell (peddler (days 5-6 of his round)).
- Floors: the Root Canals, the Upper Cut; the Root Canals, the Smugglers' Run.
- Carved: "THE HOUR PASSES THROUGH THE TOOTH AS THE ROAD DOES. IT PAYS NOTHING, AND IT IS NEVER TURNED BACK."

**Folio** (G). *Flat:* "FOLIO. Streets 31. Inn: the Margin. Archive 1." *Deep:* "An empty paved plain, and several hundred shadows sliding over the stones with nobody casting them." *Dark:* "the scratching is writing / they are writing you down"
- People: Ell, once the Flat Queen (Folio's magistrate ("a person now"); keeps the Margin court; gives Folio's side quest); Kay of the Long Line (archivist (legendary): buys deep readings, sells the Flat Accounts of every Hour); Double-Ell (merchant: ink, stencils, maps); the Margin's keeper (the Margin: rest); the teacher of Survey (teaches Survey); the teacher of Lore (teaches Lore).

**Halfnight** (H). *Flat:* "HALFNIGHT. Length 3 spans. Width 1 street. Line 1." *Deep:* "Sundials on one side of the street, shuttered cells on the other, and a brass line down the middle that nobody steps on." *Dark:* "the north side is listening / the south side is ringing"
- People: Primate Ilyendra (of the Horary, in the Hour-house (West Ward); teaches Lore); Linekeeper Hasay Gudri (the city's reeve, at the Line Court (Middle Ward)); the Chandler banker (a Chandler bank (Middle Ward)); a Horary trader (the Horary's readings (Middle Ward)); a Lampless trader (the Lampless' readings (Middle Ward)); Abbess Wisse (of the Lampless, in the Hush (East Ward); teaches Shadowcraft); a ghost trader (the ghost market (East Ward): seen only with your torch out, at night).
- Carved: "LAMPS STAY LIT. THE HOURS ARE WATCHING."
- Carved: "put it out / we will still be here / that is the point"

**The Pressyard** (I). *Flat:* "PRESSYARD. Houses 41. People 300, all mid-stride. Well 1 (stair)." *Deep:* "Faded tiles in a field, and a stair going down where a well should be." *Dark:* "they are still walking / the floor is very tight"
- Below: Press-Master Sevrin Marr-Orrum, floor 5; Tovi Hallen, floor 3; Assize engineers, floor 1.
- Floors: the Press, the Feed Floor; the Press, the Pressing Rooms; the Press, the Beat Floor; the Press, the Low Floor; the Press-hall.

**The Unlit Choir** (J). *Flat:* "UNLIT CHOIR. Floors 6. Lamps 0." *Deep:* "A cathedral sunk to its shoulders in the dusk, full of a song that doesn't come from anywhere." *Dark:* "we sing / so you can find the stairs"
- People: thol (the choirmaster ghost (seen only with your torch out)); a Lampless chanter (keeps the song).
- Below: the Gloam Warden, floor 4; Noon, floor 6.
- Floors: the Unlit Choir, the Narthex; the Unlit Choir, the Nave; the Unlit Choir, the Quire; the Unlit Choir, the Warden's Crypt; the Unlit Choir, the Undercroft; the Unlit Choir, Noon's Floor.
- Carved: "the song is a map / sing it backwards / and you are home"

**The Metronome** (K). *Flat:* "METRONOME. Floors 6. Beat: 2 per second." *Deep:* "A tower of iron floors threaded on a pendulum that never stops." *Dark:* "tick / tick / it has been counting to something"
- People: Section Nine (Chief Draughtsman (legendary automaton)); a draughtsman (of the Plan).
- Below: the Escapement, floor 6.
- Floors: the Metronome, the Casting Floor; the Metronome, the Gear Floor; the Metronome, the Rack Floor; the Metronome, the Spring Floor; the Metronome, the Bob Floor; the Metronome, the Escapement.

**The Drowned Lantern** (L). *Flat:* "DROWNED LANTERN. Floors 5, below sea. Water: by the hour." *Deep:* "A lighthouse standing in glass up to its knees, its lamp long dead." *Dark:* "the bell still rings / under the water / for the noon"
- Below: the Drowned Bellwether, floor 5; the Noonglass, floor 5.
- Floors: the Drowned Lantern, the Tide Door; the Drowned Lantern, the Oil Store; the Drowned Lantern, the Wet Stair; the Drowned Lantern, the Sunken Gallery; the Drowned Lantern, the Noonglass Dais.

**The Square** (M). *Flat:* "THE SQUARE. Sides 4, equal. Rooms 144, equal." *Deep:* "A clearing cut perfectly square out of the folding forest, the stumps in rows, and in the middle a cube with no windows." *Dark:* "every room is the same room / except the one you are in"
- People: the gate's assizer (lets the Plumb in).
- Below: Hierarch Aurel Strade-Orrum, up 2; Lio, floor 2; plumbknights and assizers, floor 1.
- Floors: the Square, the Hall Below; the Square, the Cells; the Square, the Deep Cells.

**The Gnomon** (N). *Flat:* "GNOMON. Height: off the page. Shadow: 15.5 spans at noon, and lengthening." *Deep:* "A black needle leaning over the world, so tall that the top of it is weather." *Dark:* "the works are turning / the works are always turning"
- Below: Vesper, floor 8.
- Floors: the Dial-works, the Great Wheel; the Dial-works, the Train; the Dial-works, the Fusee; the Dial-works, the Mainspring; the Dial-works, the Escape Wheel; the Dial-works, the Pallets; the Dial-works, the Hand's Root; the Noon Socket.

**Saltpage** (O). *Flat:* "SALTPAGE. Storeys 1. Page 1 (city, drowned, 9 × 9 spans of mosaic)." *Deep:* "A salt pan so flat your footsteps come back off the horizon." *Dark:* "the page is a city / the city is reading you back"
- People: Father Bramwyn the Flattened (the Pressing rite: for a world day, once a floor, you may turn flat for 3 s (free at Pressed ≥ +250, else −100 with the Pressed)); the ink-and-brine seller (ink and brine); the librarian (the Pressed's library of flat readings).
- Below: the Speaking Door, floor 2; a Second-Hour stele, floor 3.
- Floors: the Under-Page, the First Leaf; the Under-Page, the Speaking Door; the Under-Page, the Founding.

**Foldmother** (P). *Flat:* "FOLDMOTHER. Platforms 30 (day), 0 (night)." *Deep:* "A tree as tall as a mesa, pleated like a paper lantern, with houses in the pleats." *Dark:* "at dusk she closes / like a hand / count your children"
- People: Foldmother (a speaking tree (legendary): the knot at her foot where she speaks); Warden Lumo (the Pleatwood's warden); the Spore Moot's herbalist (tonics, and fungal limbs for reputation).
- Floors: the Rootfold, the Upper Roots; the Rootfold, the Fold; the Rootfold, the Heartroot.
- Carved: "SHE OPENS AT DAWN AND CLOSES AT DUSK. WHAT IS OUT ON A BRANCH AT DUSK IS HERS."

