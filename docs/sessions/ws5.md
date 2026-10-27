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

`node tools/run-all.mjs` in the worktree: §8 has the run at the tag. check-items runs in about 10 s.

| §8.3 WS5 acceptance item | Result |
|---|---|
| **Equip/unequip matrix over all slot types and plans** | check-items §1: every gear piece (7 weapons, 15 armours, 7 rings, 6 amulets and a two-hander, at enchantments −1, 0, +2) against every part of four plans (humanoid; beast; a humanoid with one hand; a humanoid with an extra hand and a second back): **510 fits, 4,026 refusals** where the slot type doesn't match or a two-hander has one holding part, each as expected. Fits per part type: humanoid hand 48, body 15, head 9, face 3, back 3, arm 3, gloves 6, feet 6, finger 42, neck 18; beast body 15, head 9, back 3, feet 6, neck 18; one hand: hand 21 (no two-hander). Every part type of every plan has real gear that fits. worn() lists each once; unequip returns it and every derived number (max HP, AV, DV, attributes, the whole bonus table) comes back exactly, with `STATS_DEBUG.verify` on. Through the inventory: E onto the default part; the Equipment tab takes off into the pack and puts a second ring on the left finger and a second cloak on the folding rack's second back. |
| **Curse lock** | **158 cursed holds** in the matrix: a cursed piece refuses to come off and to be covered; the Equipment tab refuses cursed boots; implants come out only with a station (`uninstall` without `game.truing`: "station"). |
| **Two-handed rule** | The two-hander fills every holding part, is refused where only one holding part exists, and is worn once (check-body's own cases still pass). |
| **R3** | No base field written through the inventory (`guardBaseFields`, 0 writes); the grade used is counted from installed implants, never stored; the stat cache is verified through §1 and §2 (`STATS_DEBUG.verify`); a running lantern-mote leaving the pack takes its light at once (dropped) or by the next tick (verification fix, spec 3). |
| **Implant install and uninstall rules** | check-items §2: refusals `kind`, `station`, `part`, `slot`, `grade`, `genotype`, `funds`, `hunted` (no time, no glim, no fitting), `dead` (poison running out your HP inside the hour: nothing paid or fitted), `taken`, `twice` (a fourth plate graft; a second level-eye in a second face socket). Fitting the lamp crown: **60 s, 50 glim, torch +1/3, in the map and in 3D alike**; an "install" event. A waived fitting costs nothing and still takes the hour. Taking out: refused with a hunt within reach; 60 s and an "uninstall" event; the level-eye back to the pack (grade used 10 → 8); the glim heart destroyed (max HP back); the folding rack takes back_2 and the cloak on it goes to the pack. Three plate grafts: AV +3. Grades from 2 with 12 true-marks: 3:11 4:10 5:9 6:8 7:7 8:6 **9:4 10:2 11:0**; a "grade" event; G on the Cradle screen. HP clamped when the glim heart lowers max HP. Walking over 2 true-marks counts 2; `grantImplant` is free and instant. The plane-shunt makes you Flat; the dial spine cools 1,440 s at WIL 10 and 24. The Cradle block opens by walking into it (map) and by E (3D); Enter fits (≥ 60 s, the draughtsmen's line), Enter on the socket takes it out, Esc returns; a Bent is turned away. A surgeon fits for 50 glim and takes out. A save round trip keeps implants, back_2, grade, true-marks and a cell. |
| **Identify odds within ±2% of the formula** | check-items §3: bible §13.4's formula worked out face by face in the check: 9 artifacts × 4 examine bonuses (INT 10, 16, 16 +2, 22 +3) × **20,000 tries** each, every case its own random stream (720,000 rolls); every outcome within **0.0074** of the formula (budget 0.02). At INT 16, +0: plumb-bob (c1, sturdy) 55.2/44.8/0.0% (formula 55/45/0); quicksilver level c1 54.5/25.0/20.5 (55/25/20); echo-bell c2 45.0/24.9/30.1 (45/25/30); fold-knife c3 34.6/25.1/40.3 (35/25/40); recall bead c4 24.7/25.0/50.2 (25/25/50); still-dial c7 about 0/20/80. identifyChance equals the formula in all 36 cases; a sturdy one never breaks; a broken one can't be identified; the tinker (50 glim for a lancet) identifies with no risk. |
| **Examine opens from an inspect event** | check-items §4: `inspect` from `renderMap.inspectAt(game, tile, false)` (the P0 hover) leaves the map; with `open: true` it opens examine with the goblin and the ring on that tile ("Goblin, level 4", "Unhurt · no armour · easy to hit", "Badly hurt" at 40%; Tab: the ring and its "+1 armour"); Esc back to the map; a level-eye shows "Health 11 of 11 · AV 0 · DV 6" (combat.js avOf, dvOf); a 3D-shaped payload (WS8's look: `{ zone, x, y, z, block, open: true }`) opens it over 3D ("Stone wall"); L in the pack opens it over the inventory with its own lines ("Worth about n glim") and Esc returns there. browser-ws5: the same event in Chromium. |
| **A 60-item pack scrolls in the browser** | `tools/browser-ws5.mjs` (headless Chromium, 1280×720 = 160×48 cells, real keys, wheel and clicks): 60 tokens; the first rows show and the 60th doesn't; 59 × ↓ selects the 60th, the list's top 24, a page of 36 rows; Home; PgDn a page; End; the wheel; a click on "token 46" selects it; L shows its own examine lines ("Token 46", "Not for sale."); F filters; Tab and a click on "Tab pack"; the same pack over 3D; a Cradle walked into fits the lamp crown. **PASS** (§8), 0 console errors, audio rerouted. check-items §6: in Node at 100×30 (a page of 18, the top 42 at the 60th) and 180×56 (44, 16), exactly; a click under a filter selects the clicked row's thing. |
| (≥ 15 implants with grade and true-marks) | 20 implants (bible §13.6) through the kind's samples in check-content and check-body; their bonuses through the stat bus. Sight by bible tiles through player.js torchRange: dark lens 4, dark goggles 2, the lamp crown's torch 8. |
| (stations; charge cells; the consumable effects table) | §2 and §5: the Cradle by registerUse in both views; nine artifacts each doing what it says on the map and in 3D (plumb-bob and quicksilver level mark a hidden pit; the echo-bell reveals 156 cells for 100 charge, the same in both views; the glimgun hurts for a glim; the lancet hits both goblins in its line for 250 charge and stops at a wall; the fold-knife moves you 4 tiles for 300; the recall bead marks free and returns for 1,000; the still-dial stills; the lantern-mote lends torch +0.4 and drains 10 a minute: 50 left after 300 s, out when empty; with nothing to aim at on the map an aimed one costs nothing). Cells: loaded from the pack; a glim cell filled for 25 glim; through the clock on open ground from 06:00, a sun cell +500 by day and +0 at night, a dark cell +0 with the torch lit and +250 with it out, the same in one skip and ten; the tinker refills glim cells only and drains any cell at 100 charge a glim (as far as the purse holds). Loot: 10,000 `randomBodyMod` draws give no true-mark. §7: every potion drunk and scroll read gives p0-done's trace (**19 of 19**: log, numbers, statuses, random draws), and every splash from the table equals throwing.js's switch (**10 of 10**). The plumb-line ear marks a pit in both views; G picks up what you just dropped. |
| (screen frames) | check-screen-frames: 47 frames drawn, **39 compared, 0 mismatched**; the 8 "… inventory" frames by name in `NOT_COMPARED` (the coordinator's approval); check-items §8: the new inventory in those 8 states shows the pack by name, the header, the tabs and I close, and Esc returns. |

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
10. **E in the pack keeps the parent's one ring at a time** (body.js's P0 choice, bible §13.3 "as in the existing game"):
    the second finger, the folding rack's second back and the off hand are filled from the Equipment tab (Enter on the
    empty part shows the pack for it).
11. **What a switched-on artifact lends is a status** (`running:lanternMote`, a long finite time so a save stays JSON),
    not a bonus source reading the pack: a status keeps the stat cache right by itself (verification, spec 3). The
    lantern-mote's radius-6 light with the torch out needs player.js and light.js (request 19); WS5 gives torch +0.4.
12. **The dial spine's cooldown divides WIL's multiplier out** (once a world day at any WIL), the one ability that does.


## 5. Known issues

- ~~check-screen-frames~~: the 8 "… inventory" frames differ from p0-0c (the rebuilt screen); with the coordinator's
  approval they are listed by name in `NOT_COMPARED` (request 2, `4ab2702`, `e2aea20`), the other 39 match, and
  check-items §8 checks the new screen in those 8 states.
- **G** is bound to the map legend on `integration` (WS3's merge), which shadows WS5's pick-up on the map: request 17.
- **The lantern-mote doesn't light you with the torch out** (request 19: player.js and light.js); it brightens a lit torch.
- **Implant effects named, not built** (deviation 4; requests 5-9, 20, 21) and the Plan's +25 per implant (request 20).
- **Old messages kept**: "You put on the The Mantle of Angles.", "You pick up 2 throwing knifes." (p0-done's; request 23).
- **A stray file outside the repository**: `C:\OTTOMR~1\placeholder-never-written.txt` (1 byte) was written by mistake
  during the verification fixes (a mistyped scratch path, as WS8 once did); the safety check stopped its folder's
  removal. Delete `C:\OTTOMR~1` by hand.

## 6. What the next session (the integrator) must know

- Merge `refs/heads/ws/ws5` (§8.5's order: WS9, then WS5). Apply the integration requests in `docs/ws5.md`: 1 and 2
  (P0 check files: keep the `// WS5` lines; union the two `NOT_COMPARED` maps), 3 (a mechanical swap in WS8's
  throwing.js; check-items §7 then compares the table with itself, still green), 13 (the Cradle's block), 17 (G), 18
  (browser-0d1's tour).
- Run `node tools/check-items.mjs`, `tools/browser-ws5.mjs` (with `node tools/serve.mjs 8645`), `browser-0d1` (with
  request 18) and `browser-0d2 --all`. The dependency-table items: "WS5 examine from L" (WS8's look emits
  `inspect { open: true }`: press L on a creature, examine opens) and "WS5 implant surgery" (WS6b's trade screen lists
  the services).

## 7. Verification fixes

Three independent verifiers, read-only: the gate with mutation testing (in a copy of the tree), the old game in both
views against p0-done (3,690 scripted steps per tree, 54 runs, and the parent's loot), and the spec and code. Plus my own
look at browser-ws5's screenshots. Every finding was reproduced before it was fixed; each fix is its own commit with an
assertion that fails without it (shown by reverting the fix or applying the verifier's mutant).

| Finding | Fix | Commit |
|---|---|---|
| **Major** (own check): L in the pack opened an empty examine box; the tests read the inventory's own line under it | examine builds its subjects from whatever it was pushed with; tests look for lines only examine prints | `62425e2` |
| **Major** (spec 1): the lancet hit through walls | the beam stops at the first wall at body height, both views | `a90f6c5` |
| **Major** (spec 2): the second finger and the folding rack's second back couldn't be filled in play | Enter on an empty part on the Equipment tab shows the pack for it; E there puts it on that part | `f256c37` |
| **Major** (spec 3, R3): a running lantern-mote that left the pack kept its light (a stale cache) | its light is a status kept in line with the pack (a drop at once, otherwise the next tick); saves as JSON | `0687548` |
| **Major** (gate 1): nothing held the effects table to the parent line for line (four mutants survived) | §7 traces every potion and scroll against p0-done (19 of 19) and every splash against throwing.js (10 of 10) | `ea017fd` |
| **Major** (gate 2): sun recharge and the clock:tick wiring untested (three mutants survived) | cells driven through skipTime on open ground by day and night, torch lit and out, one skip = ten | `19d2b8e` |
| Minor (spec 5): with a filter on, E/T/X/L could act on a hidden thing | they act only on a shown thing; an emptied filter goes back to everything | `959ccdb` |
| Minor (spec 6): an aimed artifact fired and paid with no target | no target lowers it: nothing happens, nothing paid | `6dd6722` |
| Minor (spec 7): the dial spine's day scaled with WIL | its cooldown divides the WIL multiplier out: 1,440 s at any WIL | `74e0b99` |
| Minor (spec 8): the dark lens, goggles and lamp crown missed the bible's tiles | darkSight 3 and 4/3, torch 1/3: 4, 2 and 8 tiles | `560446e` |
| Minor (spec 9): loot gave true-marks (about 1 in 20) | randomBodyMod gives none | `428395e` |
| Minor (spec 10): the tinker refilled sun and dark cells | glim cells only | `a39f660` |
| Minor (spec 11): bible rules neither built nor requested | built: draining cells into glim, the waived fee, the draughtsmen's line; requests 19-21 for the rest | `8e6955b` |
| Minor (spec 12): check-items.mjs's header still said "stub" | rewritten | `948eca6` |
| Minor (gate 3): the hour checked against its own constant | held to 60 s | `7f0cda2` |
| Minor (gate 4): fitted after dying mid-hour | a fitting or removal needs the whole hour ("dead", "hunted"), nothing paid otherwise | `5f6d718` |
| Minor (gate 5): removal's hour and hunt, the events, clampHp, one of each, the Cradle's G untested | one assertion each | `b4610a5` |
| Minor (gate 6): a click under a filter untested | the potions list's 4th row clicked at both sizes | `b6d1206` |
| Minor (gate 7): §3 claims without assertions | the cache verified through §2; a one-hand plan; bands and the level-eye's exact numbers; echo-bell equal in both views; exact page and top | `8b90730` |
| Minor (gate 8): identify cases shared one random stream | a stream per case | `48f3525` |
| Minor (old game 1): the splash table could drift from throwing.js until request 3 | covered by gate 1's splash comparison | `ea017fd` |
| Minor (old game 2): two ungrammatical parent messages | kept (recorded lines); request 23 | — |

**What the old-game verification found unchanged:** 0 differing steps in 3,690 per tree (all 10 potions, 9 scrolls,
equipping, R, T, X, pick-ups, Pell's shop 24 times, guardians and 18 relics, 54 level-ups, in both views); the parent's
loot byte-identical (6.7 MB of JSON over 6 seeds × 20 depths); browser-shell and browser-0c pass.

## 8. The recheck before the tag

At `8e6955b` (the last code change; only these notes after it), 2026-10-27, with WS9, WS4a and the integrator running on
this machine:

- **run-all at `ba0790e` (the docs; the tag's tree but for this line): all 37 checks passed** (139.2 s, 11 at a time).
- **run-all at `8e6955b`: 36 of 37** (139 s). The one failure is check-perf, timed inside the parallel run: `gen.dungeon` p95
  41.0 ms against the 40 ms budget (×1.30 against p0-0d1), while check-dungeons in the same run passed (its p95 under
  40). WS5's only touch on generation is `randomEquipment`'s filter leaving out pieces with a slot.
- **check-perf alone against p0-done**, alternating, `--rounds 3` (4 runs of each tree): **PASS**. Outdoor frame p50
  24.17 ms (p0-done 24.36, ×0.99; over §6.7's 17 on this machine for both, WS3's), dungeon frame 12.71 (×0.99),
  refresh 8.53 (×1.05), gen.dungeon p95 36.07 (×0.99), passTime p50 6.78 (×1.04), surface generation's max 165 ms
  (155.65 there, ×1.06). An earlier alone run had flagged that single max (186 ms, ×1.20) and passed everything else; a
  run before the fixes had flagged refresh ×1.36 and the dungeon frame ×1.17 under load, both ×0.98 alone.
- **What WS5 adds per tick of the clock**: 3.7 µs (two clock:tick handlers: cells and running artifacts, the
  plumb-line ear; 5.09 µs a tick against p0-done's 1.41 with a 23-thing pack, 100,000 ticks).
- **check-dungeons alone**: p95 30.0 ms (budget 40).
- **Browser** (headless Chromium, audio rerouted, served by `node tools/serve.mjs 8645`): `browser-ws5` PASS;
  `browser-0d2 --only items` (check-items in test-world.html) PASS, and `browser-0d2 --all` PASS at `a33a96d` (34
  passed); `browser-shell` PASS at 1280×720 and 600×300 (43 mode changes each); `browser-0c` PASS. `browser-0d1`
  fails only on "modes never reached: truing, examine" (its mode tour, P0's tool): request 18's block, tested on a copy
  of this branch, gives "16 of 16 registered reached"; its HUD and golden-frames parts pass.
- **check-items** (Node): PASS, about 10 s alone (29 s inside run-all).
