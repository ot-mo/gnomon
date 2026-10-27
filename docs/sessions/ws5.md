# WS5: body mods, items and the equipment UI

Phase 1 workstream, TECH_DESIGN §8.3 "WS5" with DECISIONS (implants are the plumb genotype's: grade, true-marks, the
Truing Cradle; glim is a counter; d20; bible §15.9). Branch `ws/ws5` from `p0-done`, worktree `gnomon-wt\ws5`. Public
API, integration requests and the handoff: `docs/ws5.md`.

## 1. What was built

- **The consumable effects table** (`effects.js`): the parent's potion, scroll and thrown-potion switches as `DRINK`,
  `READ` and `SPLASH` entries (`registerEffect` for content), each the parent's case line for line with its random
  draws in the same order; golden (a)/(b), the legacy fights and check-stats are unchanged.
- **Gear for every part** (`content/items/legacy.js`): ten pieces from bible §13.3 for head, face, back, arms, hands
  and feet (the armour kind's `slot` reads them), kept out of the parent's loot.
- **The inventory** (`inventory.js`, registered from `screens/equipment.js`): Pack (a scrolling list with PgUp/PgDn,
  Home/End, the wheel and clicks; a filter by kind; weight against carry capacity; glim against the purse) and
  Equipment (every body part with what it wears or holds, its implant socket, the belt; E takes off into the pack);
  L opens examine; the parent's keys and `game.invSel` (a pack index) unchanged.
- **Examine** (`screens/examine.js`): items (details, bonuses in words, what you wear there, price, weight, identify
  odds for an unknown artifact) and creatures (level, attitude, health/AV/DV bands, exact with a level-eye, weaknesses
  and resistances, elite trait), opened by `inspect { open: true }` and by L in the inventory; Tab between a creature
  and a thing on the same tile.
- **Implants** (`bodymods/implants.js`, `content/items/implants.js`): the bible's 20, with canInstall/install/uninstall
  (plumb only, a station or surgeon, sockets by part type, one of each but plate grafts, the grade), the fee and the
  world hour, grade and true-marks, three implant abilities, the folding rack's extra part, † implants.
- **Artifacts and cells** (`bodymods/artifacts.js`, `content/items/artifacts.js`): nine artifacts that work in both
  views, identification by bible §13.4, cells loaded from the pack, filled from the purse, recharged by sun or dark.
- **Stations and services** (`bodymods/stations.js`): the Truing Cradle on the reserved `STATION` block (registerUse:
  E in 3D, walking into it on the map) with its screen, and four services (fit, remove, identify, recharge).
- **G** picks up what lies at your feet; the plumb-line ear marks pits as the clock ticks.
- `tests/checks/items.js` (check-items) and `tools/browser-ws5.mjs`.

## 2. Public APIs

In `docs/ws5.md` "Public API" (exact signatures).

## 3. Gate results

`node tools/run-all.mjs` in the worktree: see §8 for the run at the tag. check-items runs in about 7 s.

| §8.3 WS5 acceptance item | Result |
|---|---|
| **Equip/unequip matrix over all slot types and plans** | check-items §1: every gear piece (7 weapons, 15 armours, 7 rings, 6 amulets and a two-hander, at enchantments −1, 0, +2) against every part of three plans (humanoid, beast, a humanoid with an extra hand and a second back): **384 fits, 2,964 refusals** where the slot type doesn't match (or a two-hander has one holding part), each as expected; fits per part type: humanoid hand 48, body 15, head 9, face 3, back 3, arm 3, gloves 6, feet 6, finger 42, neck 18; beast body 15, head 9, back 3, feet 6, neck 18; extras hand 72, back 6. Every part type of every plan has real gear that fits. worn() lists each once; unequip returns it and every derived number (max HP, AV, DV, attributes, the whole bonus table) comes back exactly, with `STATS_DEBUG.verify` on. |
| **Curse lock** | **119 cursed holds** in the matrix: a cursed piece refuses to come off and to be covered; the Equipment tab refuses cursed boots; implants come out only at a station (`uninstall` without `game.truing`: "station"). |
| **Two-handed rule** | The matrix's two-hander fills every holding part, needs two of them, and is worn once (check-body's own two-hand cases still pass). |
| **R3** | No base field written through the inventory (equip, take off, belt: `guardBaseFields`, 0 writes); the grade used is counted from installed implants, never stored; the stat cache verified throughout §1-§2. |
| **Implant install and uninstall rules** | check-items §2: refusals `kind` (a ring), `station`, `part` (a finger), `slot` (feet), `grade` (plane-shunt at grade 2), `genotype` (a Bent), `funds`, `hunted` (a goblin hunting within reach: no time, no glim, no fitting), `taken` (a graft where the rack is), `twice` (a fourth plate graft into a fourth head socket). Fitting the lamp crown: **60 s, 50 glim, torch +0.3, in the map and in 3D alike**; an "install" event. Taking out: the level-eye back to the pack (grade used 10 → 8); the glim heart destroyed (max HP back from −5); the folding rack takes back_2, the cloak on it goes to the pack. Three plate grafts: AV +3. Grades from 2 with 12 true-marks: 3:11 4:10 5:9 6:8 7:7 8:6 **9:4 10:2 11:0** (1 a grade to 8, then 2). Walking over 2 true-marks counts 2. `grantImplant` is free and instant. The plane-shunt's ability (source "implant") makes you Flat. The Cradle block opens its screen by walking into it (map) and by E (3D); Enter fits the dark lens (≥ 60 s), Enter on the socket takes it out, Esc returns; a Bent is turned away. A surgeon's fitting costs 50 glim and fits; its removal returns it. A save round trip (encodePlayer → JSON → decodePlayer) keeps implants, back_2, grade, true-marks and an artifact's cell. |
| **Identify odds within ±2% of the formula** | check-items §3: bible §13.4's formula worked out in the check face by face (not through identifyChance): 9 artifacts × 4 examine bonuses (INT 10, 16, 16 +2, 22 +3) × **20,000 tries** each = 720,000 rolls; every outcome (identified, partly known, broken) within **0.0086** of the formula (budget 0.02). At INT 16, +0: plumb-bob (c1, sturdy) 54.4/45.6/0.0% (formula 55/45/0); quicksilver level c1 54.4/25.4/20.1 (55/25/20); echo-bell c2 44.8/25.3/29.9 (45/25/30); fold-knife c3 35.7/25.1/39.3 (35/25/40); recall bead c4 24.8/25.6/49.6 (25/25/50); lancet c5 15.0/25.6/59.4 (15/25/60); still-dial c7 0.0/19.6/80.4 (0/20/80). identifyChance equals the formula exactly in all 36 cases; a sturdy one never breaks; a broken one can't be identified; the tinker's service (50 glim for a lancet) identifies with no risk. |
| **Examine opens from an inspect event** | check-items §4: `inspect` from `renderMap.inspectAt(game, tile, false)` (the P0 hover) leaves the map; with `open: true` it opens examine with the goblin and the ring on that tile (Tab between them: "Goblin, level 4", its health band, "+1 armour"); Esc back to the map; a level-eye shows "Health n of m · AV n · DV n"; a 3D-shaped payload (WS8's look: `{ zone, x, y, z, block, open: true }`) opens it over 3D ("Stone wall"); L in the pack opens it over the inventory and Esc returns there. browser-ws5: the same event in Chromium (open: false stays on the map, open: true shows "ring of haste"). |
| **A 60-item pack scrolls in the browser** | `tools/browser-ws5.mjs` (headless Chromium, 1280×720 = 160×48 cells, real keys, wheel and clicks): 60 tokens; the first rows show and the 60th doesn't; 59 × ↓ selects the 60th, the list's top 24, a page of 36 rows; Home to the top; PgDn a page (36); End the last; the wheel moves it; a click on "token 46" selects it; L examines it; F filters; Tab and a click on "Tab pack"; the same pack over 3D (End shows the last row); a Cradle walked into fits the lamp crown (150 glim left, ≥ 60 s). **PASS**, 0 console errors, audio rerouted to the zero-gain sink. check-items §6: the same in Node at 100×30 (page 18, top 42 at the 60th) and 180×56 (page 44, top 16). |
| (≥ 15 implants with grade and true-marks) | 20 implants (bible §13.6), each in check-content's and check-body's samples through the kind; their bonuses through the stat bus. |
| (stations; charge cells; the consumable effects table) | §2 and §5: the Cradle by registerUse in both views; nine artifacts each doing what it says in the map and in 3D (plumb-bob and quicksilver level mark a hidden pit; the echo-bell reveals 156 cells for 100 charge; the glimgun hurts the goblin for a glim; the lancet hits both goblins in its line for 250 charge; the fold-knife moves you 4 tiles for 300; the recall bead marks free and returns for 1,000; the still-dial stills; the lantern-mote lends torch +0.4, drains 10 a minute: 50 left after 300 s, out when empty); a cell loaded from the pack (dark 900 → 800 after a use, the old glim cell back); a glim cell filled for 25 glim; a dark cell +500 over 600 s with the torch out, the same over one step or ten; the plumb-line ear marks a pit in both views; G picks up what you just dropped; the effects table has the parent's 10 potions, 9 scrolls and 7 splashes. |

## 4. Deviations from the design, with reasons

1. **Identification uses bible §13.4, not TECH_DESIGN §2.6**: d20 + mod(INT) + bonus(examine) against 8 + 2 ×
   complexity; a miss of 1-5 is partial (the class), 6 or more breaks it unless sturdy. TECH_DESIGN's "attr(int) + d10
   + bonus(examine) vs complexity" and §8.3's "failure by 5+ breaks" are outranked by the bible (DECISIONS' order),
   whose complexities (1-7) only make sense with its formula. stats.js `examineScore` (P0) follows TECH_DESIGN and is
   not used (request 14).
2. **The inventory is registered from `screens/equipment.js`** (P0's `screens/inventory.js` is not in §8.4's list for
   anyone; its header gives it to WS5): registering the mode again replaces P0's port, which still supplies `openInv`
   and `inventoryAction` (game.js, play.js and golden call them). Request 15 folds it into §8.4.
3. **The main hand's weapon can't be taken off into the pack** from the Equipment tab: player.js and hud.js need a
   weapon there (request 4). Everything else comes off.
4. **Implant effects that live in someone else's code are named, not built**: the glim heart's free torch, the bellows
   lung, the survey lens, the metronome heart, grip soles, truesteel knuckles, gyro wrists, the juggler's arm and the
   balm pump each set an `effect` that `implantEffect` answers (requests 5-9; tonics are C4's). Their stat-bus parts are
   built (the glim heart's −5 max HP, the dark lens's dark sight, the lamp crown's light, plate grafts, spring tendons,
   the tally-eye's +2 examine), as are the plumb-line ear, the folding rack and the three abilities.
5. **Nine artifacts, not the bible's 26**: the ones whose effect can be built in WS5's files in both views. The rest
   (the homing pip's travel, light and dark effects, pressing and unpressing, bridges, panes, drones) need the
   systems that own them; C4 adds them to `ARTIFACTS` with an effect in `bodymods/artifacts.js`. The jump-springs'
   per-jump charge needs a player.js hook, so they were left out rather than made free.
6. **"A minute" of the bible's charge rates is 60 s of game time** (a world minute is 1 s: DECISIONS' clock), so a sun
   cell fills in 50 minutes of game time, not 50 s.
7. **Fitting takes one world hour = 60 s of game time** through `skipTime` (DECISIONS: one world hour is 60 s), and a
   hunt within `RULES.time.activeRadius` refuses it before anything is paid. Removal costs no glim (the bible gives no
   price), only the hour.
8. **True-marks are the item kind `credit`** (§2.9's name, a neutral identifier: DECISIONS); the UI says "true-mark".
   Grade raising happens at the Cradle (the G row of its screen).
9. **Identified artifacts aren't "good"**: their aura is null (the parent's aura is about curses and blessings).

## 5. Known issues

- ~~check-screen-frames~~: the 8 "… inventory" frames differ from p0-0c (the rebuilt screen); with the coordinator's
  leave they are listed by name in `NOT_COMPARED` (request 2, `4ab2702`), the other 39 match, and check-items §8 checks
  the new screen in those 8 states.
- **G** is bound to the map legend on `integration` (WS3's merge), which shadows WS5's pick-up on the map: request 17.
- check-perf under load (three other sessions running): `refresh` ×1.36 and the dungeon frame ×1.17 against p0-done in
  one run; WS5 changes neither `zone.refresh()` nor the renderers (§8 has the re-timing).

## 6. What the next session (the integrator) must know

- Merge `refs/heads/ws/ws5` after WS9, WS3 and WS8 (§8.5's order). Apply the integration requests in `docs/ws5.md`
  (1 and 2 are P0 check files; 3 is a mechanical swap in WS8's throwing.js; 13 names the Cradle's block).
- Run `node tools/check-items.mjs` and, with `node tools/serve.mjs 8645`, `NODE_PATH="$(npm root -g)" node
  tools/browser-ws5.mjs`. The dependency-table items: "WS5 examine from L" (WS8's look emits `inspect { open: true }`:
  press L on a creature, examine opens) and "WS5 implant surgery" (WS6b's trade screen lists the services).

## 7. Verification fixes

(The independent verification follows.)
