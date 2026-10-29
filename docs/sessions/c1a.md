# Phase 3, C1a: the world's regions and terrain, and Hollowmere

The first half of C1 (`docs/HANDOFF.md` "Phase 3 plan"; DECISIONS "Phase 3 content sessions"), in the worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\c1` on `ws/c1`, from `p3i-props` (7959ea0). Local machine (Windows 11, Node
20.11.0, headless Chromium from Playwright), shared with C2 and C4 running side by side. `docs/c1.md` has the region
ids (pushed first, `6e6de6d`, for C2 and C3), the integration requests and the handoff.

| Commit | What |
|---|---|
| `6e6de6d` | `docs/c1.md`: the 20 region ids, their spans, tiers, sources and placing rules; the village quotas |
| `3b25dd6` | The regions, the Hollow Mere as itself, the Inkrun as ink, Hollowmere on its plan, with their checks |
| `231420b` | Site chances scaled to §4.10's counts; check-story's real-world villages |
| `64a2e0f` | check-overworld: the encounter-rate run starts from the start span when the journeys end in a pocket |
| `388f478` | check-render: the Gnomon on the horizon seen from Hollowmere's lane, not its roofed hall |
| `d4efa00` | Three props off row 46; check-surface's quicksilver river; the integration requests |
| `2f9b562` | check-landmarks: Hollowmere's road at the porch, its seams over every open plan cell (two mutants that passed) |
| `b4ee761` | The review: the shore's kinds by tier, the missing factions, the Shade's line; factions of registered kinds checked |
| `1e07429` | The crypt on the ground |
| `161d92d` | `docs/c1.md`: the region rules by glyph |
| `323d45b` | The Deep Pleat's and the Shade's wildlife back to WS2's 2-4 |

## 1. The start

`git fetch origin --tags`; `ws/c1` at `p3i-props`. `run-all`: **35 of 38**, the three failures the timed ones
(check-dungeons' generation p95 150 ms against 40, check-overworld's world-map draw 3.04-3.31 ms against 3, check-perf's
frames), with C2's and C4's sessions running on the same machine: the load the brief warned of. Rerun alone at the end
(section 6).

## 2. What was made

- **The regions** (`content/world/regions.js`, new; `worldmap.js` REGION_ROWS and REGION_KEY). 20 regions, every one of
  the 882 spans in one by the rules in `docs/c1.md` (landmarks by their terrain, roads and rivers their own, the Old
  Cuts, the Glass Shore round the sea, the rest by terrain). Each has its name, tier (its lowest span's), music (a mood
  of music.js), sky, fog (added to the haze: clock.js reads it), liquid (its water's), encounter rate (world-map
  travel reads it), village quota (§4.10), creature rows by the bible's ids (§12 and every one of §15.2's spawn keys;
  the dungeons under its sites draw from them), factions (§15.4's homes, §9.3's founders, and every faction of its
  registered kinds), site chances (village, ruin, lair, Truing Cradle; Hour sites go by tier) and a world-map line.
- **The Hollow Mere as itself.** A terrain of its own, `mere` (`~` with x ≤ 6, split by x as `&` is): "the Hollow
  Mere", its §15.2 colour [70, 112, 124], tier 2, its own edge message, brine water as its ground (seen in the next
  zones' aprons), in region `hollowMere`. `sea` is the Glass Sea's 44 spans, tiers 5-7.
- **The Inkrun is ink** (`RIVERS` inkrun `liquid: "ink"`; compileWorld and the ports carry it to its four spans and
  both sides of its edges).
- **Hollowmere on its plan** (`content/world/plans/hollowmere.js`, `content/world/landmarks.js`, new). The parent's
  Temple of Angles stamped as it is at (2, 2) with its own puzzle stream (the parent's for the seed), the Keeper's
  Stair (the 20 legacy levels) under it in the parent's 48 × 48 frame, no sinkholes; you wake in your room, Maren in
  the main hall. East of the porch the stilt village: the square on boardwalks with the commons lamp, eight reed houses
  a block up on their plinths with slab thatch roofs (Mira's, Brother Tamsin's, Reeve Hallen's, Old Ottilie's, Sir
  Corwin's post, three cottages), the stone crypt on the ground with a rune in its wall, Pell's counter, the glimseed
  presses, the brine beds with their eel weirs, reeds, glimseed and salt blooms; the Old Rule comes in from the east
  to the porch. Who stands where is in `landmarks.js` `letters` (for C5's words; only Maren is placed, as the others'
  kinds don't exist yet), with Hollowmere's three lines from bible §5 A.
- **Biomes and moods.** The Flats and the Downs hold 1-3 creatures a zone (the safest country, the gentlest walking;
  WS2 had 2-4); the rest as WS2 had them. The Mere's terrain mood; Hollowmere plays the temple's mood, the parent's
  start (WS3 had "open").
- **Checks** (assertions for this data): check-world section 6 (the regions held to the bible as the map is);
  check-landmarks section 4 (Hollowmere on 5 seeds); check-story's villages on the real world; check-content's
  coverage rule reads a legacy stack's floors through the legacy tables (as `world/zonegen.js` builds them). Three
  checks that my data moved, each for its stated reason (section 4): check-overworld's fast-travel rate run,
  check-render's Gnomon views, check-surface's river-liquid test.

## 3. Acceptance, with the numbers

| Item | Result |
|---|---|
| Every span in a region, with tier, music, sky, fog, liquid, encounter rate, creatures, factions, site chances | **Pass** (check-world section 6): 882 spans in 20 regions (flats 44, hollowMere 3, waste 74, steps 63, downs 86, pleatwood 102, deepPleat 66, tessellate 67, shade 25, stacks 90, oldCuts 2, lattice 61, teeth 45, glassSea 45, glassShore 34, oldRule 40, straightCut 8, glassCauseway 4, slake 20, inkrun 3), each in the region the rules give it; every field checked; 64 of §15.2's spawn keys each in its region's rows |
| check-world holds the regions to the bible as it holds the map | **Pass**: the rules re-derived from the bible's map and fixed points, §4.10's quotas and §15.2's spawn keys read out of WORLD_BIBLE.md; 9 mutants fail it (a span moved, the Inkrun plain, the Mere as the sea, a quota, a spawn key, a level gap, a mood, a faction; section 4) |
| Villages on the real world (check-story's village part, 20 real-world seeds) | **Pass**: 312 real-world villages on 20 seeds (10-25 a seed; tessellate 40, stacks 40, steps 44, downs 36, pleatwood 34, waste 27, flats 24, deepPleat 23, glassShore 22, shade 22), every one valid, its surface made on the first attempt (464 villages in all with the test world's 152), its cast placed and reachable, each in a region with a quota. 40 seeds: 15.2 a seed |
| The Hollow Mere compiles as itself | **Pass**: (4..6, 18) terrain `mere` "the Hollow Mere", [70, 112, 124], tier 2, its edge message, region `hollowMere`; the world map draws it in its colour and refuses the step onto it (browser) |
| The Inkrun is ink | **Pass**: `riverLiquid` ink on its 5 path spans and its ports; the Slake plain water; no span where the two meet (check-surface) |
| Hollowmere stands on its plan, the same twice, seams with its neighbours | **Pass** (check-landmarks section 4, 5 seeds): the temple with Maren, the cube, the spikes and cube wall, you in your room, the Keeper's Stair (20 legacy levels) at the temple's stairs in the parent's frame, no sinkhole outside the shaft; 45 houses (9 a seed) on their floors with doors and roofs, 45 people's places reachable, the commons lamp, 680 brine-bed tiles, 240 props, the Old Rule to the porch; 20 seams (1,280 tiles) on the world function; the 90 landmark zones twice the same, none retried |
| check-surface, check-edges, check-landmarks on the real world | **Pass**: 1,500 real-world zones (500 a seed × 3) valid, none retried, 60 made twice the same; 790 edges (50,336 seam tiles) over 1,247 zones; 90 real landmark zones |
| Surface generation inside §6.7's budget there (check-perf alone, against `p3i-props`) | **Fails, not from the data** (section 6): p95 68.8 ms against `p3i-props`' 45.5 (×1.51, budget 60). The difference is one span of perf's sample, (22, 3), a lair since the real world has sites: a span with a dungeon builds its level 1 to place its sinkholes (gen/surface.js landingFloor), about a surface's cost again; on `p3i-props` the test world's ruins cost the same (55-68 ms against 22-29 for plain spans) but its sample never hits one. The region rows don't slow that level (33 against 30 ms with the legacy table). Integration request 9 |
| check-content, check-names | **Pass**: coverage 173 (region, level) pairs on both worlds, at least 3 kinds everywhere (fewest 3, the Salt Waste at level 8); names: 184 modules, 0 hits of §15.11 |
| Golden (b), check-screen-frames, check-legacyfights untouched | **Pass**: golden mechanics 86 of 86, frames 27 of 27; screen frames 47, 34 compared, 0 mismatched; legacyfights PASS. The test world's data and `DEFAULT_BIOME` are unchanged |
| Something of it in both views in the browser | **Pass** (headless Chromium, `?silent=1&quick=1&world=real&seed=1234`, audio routed to an analyser and a zero gain, 1 connection; no console errors; server and browser closed): the map of Hollowmere (the temple, the houses, the beds), 3D in the village (a thatch house, the brine beds with glimseed), the world map with the Mere; `browser-2b` PASS |

## 4. Verification

- **The independent review** (a fresh reviewer, the data against the bible, given the files and not my reading): every
  span's region re-derived, creature levels against the tier rule. Its defects were real and are fixed (`b4ee761`):
  glass-sea kinds set below their tier on the shore and the Clatter's tier-1 crab-folk there; factions the bible homes
  in Halfnight, Molar, the Pressyard and the Deep Pleat missing; the Shade's line stating cosmology in the narrator's
  voice. Its nits: the crypt on stilts (`1e07429`), the river rule's wording (`161d92d`), the Mere's line repeating its
  edge message; the glare on the sea and causeway is kept and said (deviation 6).
- **Mutants**, each applied, its check run, the file restored: check-world fails all 9 (above); check-landmarks fails
  houses on the ground, roofless houses, deep beds, the hub moved, an edge cell raised (the last two passed at first:
  `2f9b562`); check-story fails a real world with no village chance ("seed 1 real world: no village"); check-content's
  coverage fails without the legacy rule (the Keeper's Stair's floors 9-21 had 0-1 kinds).
- **Checks my data moved**, each with its cause found: check-overworld's fast-travel rate run measured 0 steps because
  the real world's new encounter rates ended its journeys at (38, 10), a pocket with no known span 6 steps away
  (`64a2e0f`, debugged with prints, then removed); check-render looked for the Gnomon from Hollowmere's middle, now
  the temple's roofed hall (`388f478`); check-surface's liquid test inked the Slake and counted the Inkrun's ink as
  strays, and three of my props stood a tile from an edge (`d4efa00`).
- **The old game**: golden, screen frames, legacyfights, check-bot (the playthrough on the test world) all pass; the
  test world's terrains take `DEFAULT_BIOME`, which C1a left alone.
- **Performance**: the item that fails was taken apart span by span on both trees (section 3). I also gave the Deep
  Pleat and the Shade back WS2's 2-4 creatures (`323d45b`): the 2-5 I had given them was my reading, not a bible number,
  and it slowed a Deep Pleat span in the sample.

## 5. Deviations from the bible

1. **The Mere's terrain id.** §15.1 and §15.2 give `~` the one id `sea`; the Mere's three spans are `mere`. The code
   takes a span's name, colour and edge message from its terrain, and §15.2's sea row already gives the Mere its own
   tier and palette, so a terrain of its own is how it compiles as itself without new code. check-world holds sea + mere
   to the legend's 47.
2. **Regions the bible doesn't list by name.** `oldCuts`, `glassSea`, `glassShore` (the bible's "Glass shore"), the
   three roads and the two rivers are regions of their own; landmark spans are in their terrain's region. The bible's
   own regions keep their terrain ids.
3. **Site counts by chance, not exactly.** §4.10 asks for 16 villages, 14 ruins and 12 lairs. `world/sites.js` places
   by a chance per span, so the chances are set to give about those on average (40 seeds: 15.2, 14.5, 10.9 a seed;
   villages 9-25 a seed); exact quotas are integration request 1. The Teeth's crag village can't be placed (walk-in
   spans aren't eligible: request 2), so its quota of 1 is unplaced.
4. **Creature levels below a kind's tier, in three places** (said in regions.js): the sporeling and foldmonkey from
   level 5 on the Pleatwood's tier-2 rim, the glass crab and salamander from 12 on the Glass Sea's and the Causeway's
   tier-5 spans, so every level a region makes has three kinds (the coverage rule). The glowfin is in the Inkrun at its
   level 14 because §15.2's river key (which wins) puts it there.
5. **Hollowmere.** The temple is the parent's plan as DECISIONS asks, so its floor's golden arrow points at the right
   lever (north), not north-east at the Gnomon as §5 A says; the houses stand east of the temple and the brine beds
   south of them, not the houses over the brine; Corner, the temple cat, waits by the porch outside; only Maren is
   placed (the other people's kinds are C3's and C5's).
6. **The glare** (`sky: "glare"`) is on the Glass Sea and the Causeway too, not only the shore (§4.9): the causeway
   runs over the sea itself. Nothing reads `sky` yet (request 5).

## 6. The gate

`run-all` at `323d45b`: **37 of 38**. The one failure is check-perf, run in the gate against `p0-done` with the other
sessions on the machine (its dungeon item, which only measures the parent's legacy levels, read ×1.25 there, so the
load counted too). Alone against `p3i-props` (`--rounds 3 --no-render`, 4 runs of each tree alternating, the machine
at 15-50%): every item within budget or within 15% of `p3i-props` but surface generation, p95 68.79 ms against 45.5
(×1.51) and max 239.6 against 159.4 (×1.50); the cause is section 3's (a site span in the sample), not this data's
cost per zone. No tag yet: integration request 9 asks the integrator's call.

## 7. Names and key texts, for the user to read through

Not a gate. About 430 words in all, inside §15.9's 600 for world-map tile lines, rumours and deaths (the Hollowmere
lines are the bible's own, §5 A; the Flats' line is §2.2's sample).

The regions and their world-map lines (one sentence each, §2.1 rule 8):

| id | Name | Line |
|---|---|---|
| `flats` | the Brine Flats | The glimseed leans towards the Gnomon here, the way everything does eventually. |
| `hollowMere` | the Hollow Mere | A shallow lagoon of brine south of Hollowmere; the eels in it think it is the whole world. |
| `waste` | the Salt Waste | A sea that was pressed and left to dry; the Drovers count its dunes and get a different number every time. |
| `steps` | the Rust Steps | Red mesas stacked like a stair nobody finished; up here height is the only rank there is. |
| `downs` | the Downs | Grass over barrows, and the Survey's towers on every rise, measuring the grass. |
| `pleatwood` | the Pleatwood | The trees fold their branches away at dusk, which the Pleatwood says is manners and the Survey says is weather. |
| `deepPleat` | the Deep Pleat | The same forest, folded more times than anyone has counted; the Assize cut one straight line through it and called it a road. |
| `tessellate` | the Tessellate | A plain paved with pressed towns; from above you can read their names, and the Flatfolk would rather you didn't stand on them. |
| `shade` | the Shade | The Horary calls it Noon's shadow, burnt in and never lifted; the Lampless call it the only honest light. |
| `stacks` | the Stacks | Deepwright towers twenty storeys deep, still being kept by automata who were never told to stop. |
| `oldCuts` | the Old Cuts | Two Deepwright cuts that the Rustbacks reached first, and have been taking apart ever since. |
| `lattice` | the Lattice | A grid of crystal where the corners are right angles and you are not. |
| `teeth` | the Teeth | A wall of crags that no road crosses but the Molar pass; the Kites cross it every morning to show that they can. |
| `glassSea` | the Glass Sea | Half liquid and half glass; there are wrecks under it, and they can see you too. |
| `glassShore` | the Glass Shore | Where the sea gives up being liquid; the Clatter build their huts of its glass and can see who is coming. |
| `oldRule` | the Old Rule | The Deepwright road, laid true to the width of a hair; the milestones still count down to something. |
| `straightCut` | the Straight Cut | The Assize's road from the Square, which goes round nothing on principle. |
| `glassCauseway` | the Glass Causeway | A road laid over the glass to the Drowned Lantern; the sea on either side keeps its own counsel. |
| `slake` | the Slake | The grey-green river out from under the Teeth; it tastes of stone and runs south as if late for something. |
| `inkrun` | the Inkrun | Ink wells up black out of the Shade and runs to the sea; whoever wades it comes out written on. |

Other texts:
- The Hollow Mere's edge message (`terrains.js mere`): "The Hollow Mere is brine to the knee and silt below that:
  nobody wades it twice."
- Hollowmere's three lines (`landmarks.js`, the bible's §5 A): *Flat:* "HOLLOWMERE. Stilts 212. Lamps 1 (commons).
  Cube 1." *Deep:* "Reed roofs, eel smoke, and a squat temple whose walls meet at angles nobody likes." *Dark:* "the
  floor has been shaking / something under it is counting".
- Hollowmere's people as `letters` (§5 A's names and roles): Mira, Brother Tamsin, Brann, Reeve Hallen, Old Ottilie,
  Sir Corwin, Pell, Ess and Tee, Corner.
