# WS5: body mods, items and the equipment UI

Phase 1 workstream (TECH_DESIGN §8.3 "WS5", with DECISIONS: implants belong to the genotype **`plumb`**, its points are
the **grade**, its marks **true-marks**, its station the **Truing Cradle**; glim is a counter, so the inventory has no
pour and fill; combat is d20; bible §15.9's scope guards). Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws5`, branch
`ws/ws5`, from `p0-done`. Files (§8.4): `items.js`, `inventory.js`, `effects.js`, `body.js`, `bodymods/*`,
`screens/equipment.js`, `screens/examine.js`, `content/items/legacy.js`, `artifacts.js`, `implants.js`,
`tools/check-items.mjs`, `tests/checks/items.js`; new: `tools/browser-ws5.mjs`. Gate numbers, deviations and the
verification: `docs/sessions/ws5.md`.

Nothing WS5 adds appears in the parent's game by itself: implants, artifacts, cells and true-marks come only from new
content (sites, merchants, character creation), the armour for the other body parts is left out of the parent's loot,
and no legacy merchant lists the new services. What the old game does see: the rebuilt inventory (Pack and Equipment
tabs), L in it (examine), G (pick up), and the consumable effects as a table (the same lines and random draws).

## Public API

### Items and the pack (`items.js`, `inventory.js`)

```js
// items.js (P0's API, plus:)
pickUpHere(game) → n                        // G: what lies at your feet, even what you just dropped (no time)
// content/items/legacy.js: ARMOURS gains pieces for every other part (bible §13.3), each with `slot` (a part type)
// and optional `bonus`: reedHat copperCap ironHelm (head) · goggles (face) · cloak (back) · bracers (arm) ·
// gloves gauntlets (gloves) · sandals boots (feet). The armour kind's slot(it) reads ARMOURS[id].slot || "body";
// randomEquipment skips anything with a slot (the parent's levels and merchants draw exactly as before).

// inventory.js: the screen's logic (screens/equipment.js registers it as the "inventory" mode)
openInventory(game) · closeInventory(game)   // opens on the Pack tab; game.invSel is always an index into p.inv
inventoryKey(game, code) → seconds | 0 | null | "throw" | { aim: it }   // { aim }: an artifact that needs a target
inventoryClick(game, cell) · inventoryWheel(game, sign) · useSelected(game) · equip(game, it, index) → bool
unequipPart(game, partId) → seconds          // the Equipment tab's E: into the pack (cursed sticks; the main hand's
                                             // weapon stays until another replaces it: request 4)
swapWeapons(game) → seconds · packFilters(p) → [{ id, label, n }] · packWeight(p) · bodyRows(game) · partLabel(part)
setBodyNote(fn)                              // fn(game, p) → the line over the Equipment tab's parts
INVENTORY_KEYS · drawInventory(game)
// Keys: Pack: ↑↓ W S PgUp PgDn Home End wheel, E use, T throw, X drop, F filter, L look closer, R swap weapons;
// Equipment: ↑↓, E take off, L, R; both: Tab / ← → the other tab, I / Esc close. A click selects, a second uses.
```

### The consumable effects table (`effects.js`)

```js
DRINK[effect](game, p) · READ[effect](game, p, { weapon, wname }) · SPLASH[effect](game, { x, y, z, r, near, youToo, names })
registerEffect("drink" | "read" | "splash", effect, fn)     // content's tonics (C4) add theirs
splash(game, effect, ctx)                    // a thrown potion's splash (request 3: throwing.js calls it)
drinkPotion(game, effect) · readScroll(game, effect)        // as before, dispatching through the tables
```

### Implants (`bodymods/implants.js`, `content/items/implants.js`)

```js
canInstall(game, p, item, partId) → { ok, reason }   // kind, genotype (only the plumb), station (game.truing unset),
                                                     // part (no socket), slot, taken, twice, grade { need, have }
install(game, p, item, partId, { free, paid }) → { ok, reason, time, fee, item }   // fee 25 glim × grade (funds),
                                                     // a world hour by skipTime (hunted: nothing paid or fitted)
uninstall(game, p, partId) → { ok, item, reason, destroyed, dropped }   // only with game.truing (the curse lock)
withTruing(game, { at: "cradle", x, y, z } | { at: "surgeon", c }, fn)   // the station context while fn runs
gradeOf(p) · gradeUsed(p) · gradeFree(p) · trueMarks(p) · gradeCost(p) · raiseGrade(game, p) → { ok, reason, cost }
installedImplants(e) → [{ partId, item, def }] · socketsFor(e, item) · implantEffect(e, effect) → bool
fittingFee(item) · grantImplant(p, id, partId?) → item     // WS4's free starting implant (grade ≤ 2)
isPlumb(p) · partWord(type) · START_GRADE 2 · IMPLANT_FEE 25 · FITTING_TIME 60 (one world hour) · MAX_SAME { plateGraft: 3 }
IMPLANTS[id] = { name, parts, grade, info, bonus?, ability?, effect?, addsPart?, destroyOnRemove? }   // the bible's 20
IMPLANT_VALUE(grade) → glim (400 … 2,000)
// Player fields: p.genotype ("plumb"), p.license = { grade } (absent: 2 for the plumb, 0 otherwise), p.credits
// (true-marks held). The grade used is counted from what is installed, never stored (R3).
// Item kinds: implant { kind, id }; credit { kind, count } (a true-mark: walked over, counted into p.credits).
// Abilities (source "implant"): planeShunt (Flat 4 s, every 40 s), jumpBack (an explored tile, every 100 s),
// dialSpine (everything else "stilled" 5 s, once a world day). Status: "stilled" (noAct, noMove).
// Bus: "install" { e, item, partId }, "uninstall" { e, item, partId, destroyed }, "grade" { e, grade }.
```

The effects other systems read with `implantEffect(e, effect)`: `readsCreatures` (level-eye: examine shows exact
numbers), `readsArtifacts` (tally-eye: complexity and exact charge), `plumbEar` (marks pits within 6 tiles: built),
`darkLens` (its darkSight bonus is built; faint runes are WS3's), `surveyLens`, `freeTorch`, `bellowsLung`,
`beatSight`, `gripSoles`, `knuckles`, `gyroWrists`, `jugglerArm`, `balmPump` (requests 5-10, C4).

### Artifacts and cells (`bodymods/artifacts.js`, `content/items/artifacts.js`)

```js
examineArtifact(game, p, it, rng = Math.random) → { ok, known, broke, nat, total, dc, margin }
//   bible §13.4: d20 + mod(int) + bonus(examine) against 8 + 2 × complexity; a miss of 1-5: known "class" (named,
//   can't be used); 6 or more: broken (unless sturdy: then "class"). Each try EXAMINE_TIME (10 s); you may retry.
identifyChance(p, it) → { known, partial, broke }   identify(game, it)   examineDc(it)   examineBonus(p)
useArtifact(game, p, it) → seconds | { aim: it }     aimArtifact(game, p, it)     fireArtifact(game, p, it, target)
cellOf(it) · chargeOf(it) · cellMax(cell) · needs(it) · loadCell(game, p, it) · fillCell(game, p, cell) → glim
rechargeCells(game, p, t0, t1) · chargeText(game, cell) · artifactName(it) · markHoles(zone, x, y, r)
makeArtifact(id, rand) · makeCell(id, rand, full) · randomBodyMod(rand, level)   // loot for WS10, WS6b, C
ARTIFACTS[id] = { name, vague, class, complexity, charge, per?, cells?, sturdy?, target?, consumed?, bonus?, value, info }
CELLS[id] = { name, charge, recharge: "glim" | "sun" | "dark" | null, value, info }
// Kinds: artifact { kind, id, known: false | "class" | true, cell: { id, charge } | null, on?, mark?, broken? };
// cell { kind, id, charge }. Built: plumb-bob, quicksilver level, echo-bell, lantern-mote (switched on: torch +0.4,
// 10 charge a minute), glimgun (2d6 fire, a glim a shot), fold-knife, recall bead, lancet, still-dial.
// Sun and dark cells gain 50 a minute on "clock:tick" (exact over skipTime); a glim cell fills from the purse at
// a glim per 100 charge; an artifact with too little charge takes the fullest fitting cell from the pack.
// A bonus source "artifacts" gives what a switched-on artifact lends.
```

### Stations and services (`bodymods/stations.js`)

```js
CRADLE = B.STATION           // blocks.js's reserved id 38 ("cradle"): registerUse(CRADLE, useCradle, { label })
useCradle(game, x, y, z)     // E in 3D, walking into it on the map: the Truing Cradle screen for the plumb
SERVICES = ["fitImplant", "removeImplant", "identifyArtifact", "rechargeCell"]   // talk.js registerService ids:
// a surgeon (the Cradle's rules, fee and hour), a tinker (10 glim × complexity; a glim per 100 charge)
```

### Screens

```js
// screens/equipment.js: registers "inventory" (inventory.js's draw and keys; P0's screens/inventory.js still gives
// openInv and inventoryAction) and "truing" (the Cradle: sockets, implants in the pack, raise the grade)
openTruing(game, at) · truingRows(game)
// screens/examine.js: MODE "examine"
openExamine(game, data) → bool   // data: an inspect payload { zone, x, y, z, creature?, item?, block?, open } or { item }
examineLines(game, subject) · examineSubjects(data) · bonusWords(bonuses)
// on("inspect"): open: true opens it (WS8's L in either view); the map's held hover (open: false) doesn't.
```

## Integration requests

1. **`tests/checks/content.js` `ITEM_SAMPLES` and `tests/checks/body.js` `samples()` (P0's, frozen): applied on this
   branch**, one line each marked `// WS5`, with samples of the four new kinds (`implant`, `credit`, `artifact`,
   `cell`); both checks fail on a registered kind without one (0D2.md §6). The same as WS8's request 6: keep both
   lines at the merge (they sit next to WS8's).
2. **`tests/checks/screen-frames.js` (P0's): pending the coordinator.** The rebuilt inventory changes the 8 recorded
   "… inventory" frames (seeds 99 and 31, depths 3 and 11, map and 3D); the other 39 frames still match p0-0c exactly.
   Proposed: add those 8 names to WS3's `NOT_COMPARED` list (its shape, from `p1-ws3`), still drawn, with the reason
   "the inventory screen WS5 rebuilt (Pack and Equipment tabs); tests/checks/items.js and tools/browser-ws5.mjs hold
   it". The fixture is never touched. (See the Handoff for the state.)
3. **`throwing.js` (WS8):** a shattered potion's switch is now `effects.js SPLASH`. Replace `shatter`'s
   `switch (effect) { … }` with `splash(game, effect, { x, y, z, r: SPLASH, near, youToo, names })` (import `splash`
   from `effects.js`). The entries are WS8's cases line for line, so the legacy fights don't move.
4. **`player.js` (WS4) and `hud.js` (WS9): bare hands.** `attackTime`, `weaponReach` and `hud.js drawSword` read
   `WEAPONS[wielded(p).id]` and fail with nothing in the main hand (combat.js already fights with fists). Until they
   allow it, the Equipment tab keeps the main hand's weapon in hand (`inventory.js unequipPart`); then that one test
   can go.
5. **`torch.js` (the integrator): the glim heart.** `burnTorch` should cost nothing when
   `implantEffect(e, "freeTorch")` (bodymods/implants.js), or, the stat bus's way, a new `BONUS_KEYS` entry
   `freeTorch` (stats.js) that the glim heart's bonus then sets (0D2.md §6 already names this hook for the glim
   heart, Lampskin and the Lamplighter).
6. **`status.js` (the integrator): the bellows lung.** `updateDrowning` holds your breath for `RULES.drown.air` × 2 when
   `implantEffect(e, "bellowsLung")`.
7. **`combat.js` (WS8): fists.** With `implantEffect(e, "knuckles")` (truesteel knuckles) bare hands hit for 2d4 and
   crush; with gauntlets worn (bible §13.3) for 1d4.
8. **`throwing.js` (WS8):** gyro wrists (`gyroWrists`: thrown things fly flat, +2 damage) and the juggler's arm
   (`jugglerArm`: up to four knives at once).
9. **`turns.js` (WS8) / `render3d.js` (WS3):** the survey lens (`surveyLens`) doubles how far 3D fills in the map;
   the metronome heart (`beatSight`) shows the next spikes, presses and hands in 3D (with WS10's traps); grip soles
   (`gripSoles`): no knockback (WS8) and climbing 2 on the map.
10. **WS4:** character creation sets `p.genotype`; a plumb starts at grade 2 (`p.license` may stay absent) with one
    free implant of grade ≤ 2 through `grantImplant(p, id)`; the Readhand mutation calls `identify(game, it)`; Keen
    fingers and the Survey's +3 examine are `bonus(examine)`. Implant abilities come through the "implant" ability
    source (the hotbar holds their ids).
11. **WS6b:** the trade screen lists `registerService` rows as P0's shop does: a surgeon's `fitImplant` and
    `removeImplant`, a tinker's `identifyArtifact` and `rechargeCell` (bible: Old Ottilie, Detail C at Benchmark);
    stock can include implants, artifacts and cells (`randomBodyMod`, `IMPLANT_VALUE`).
12. **WS10:** Truing Cradles are `B.STATION` blocks (Benchmark, the Metronome, the Square; stations by region rules);
    Hour-site bottoms give true-marks (`{ kind: "credit", count }`, bible §10.4) and artifacts (`randomBodyMod`).
13. **`blocks.js` (the integrator):** the reserved `STATION` block's name "cradle" → "Truing Cradle", and a map look
    (a glyph the bible's §15.7 doesn't reserve). Today it draws as a wall on the map; walking into it opens it.
14. **`stats.js examineScore` (the integrator):** P0's `examineScore = attr(int) + bonus(examine)` follows TECH_DESIGN;
    WS5 identifies by bible §13.4 (`mod(int) + bonus(examine)` + d20 against 8 + 2 × complexity, which outranks it).
    Either make `examineScore` that modifier sum or leave it unused (nothing calls it).
15. **§8.4 and `tools/README.md` (the integrator):** `tools/browser-ws5.mjs` as WS5's (serve with
    `node tools/serve.mjs 8645`); `screens/inventory.js` as WS5's (its header says so; WS5 registers the inventory
    from `screens/equipment.js` and still uses its `openInv` and `inventoryAction`); `tools/check-items.mjs` runs
    the whole check (about 7 s, 720,000 identification rolls among it).
16. **`renderMap.js` (WS3):** the legend could list the new item glyphs: `♦` implant, `Θ` artifact, `≡` cell, `¶`
    true-mark (none is a bible §15.7 glyph or a creature letter).

## Handoff

**Updated:** 2026-10-27, local session, on `ws/ws5`. **WS5 is built and its acceptance passes** (`check-items`,
`browser-ws5`); the independent verification is the next step, then the tag `p1-ws5`.

- **Waiting:** the coordinator's answer on request 2 (the 8 inventory frames). Until it is applied, `run-all` reports
  check-screen-frames failing on exactly those 8 frames and nothing else.
- **Next step:** the verification (gate, the old game in both views, spec and code), fixes one commit each, then
  `docs/sessions/ws5.md` §7 and the tag.
