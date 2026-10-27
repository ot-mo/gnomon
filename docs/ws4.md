# WS4: character creation and progression

Phase 1 workstream (TECH_DESIGN §8.3 "WS4", with DECISIONS: the genotypes are `bent` (mutations; the points are
creases) and `plumb` (implants; grade), the run modes `oneWick`, `commonsLamp` and `pilgrim`, combat is d20, bible
§15.9's two progression tracks). Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws4`, branch `ws/ws4`, from `p0-done`.
Files (§8.4): `progression/*`, `abilities.js`, `player.js`, `leveling.js`, `screens/create.js`, `screens/charsheet.js`,
`screens/abilities.js`, `screens/levelup.js`, `content/genotypes.js`, `content/backgrounds.js`, `content/mutations.js`,
`content/powers.js`, `tools/check-progression.mjs`, `tests/checks/progression.js`; new: `tools/browser-ws4.mjs`.
Gate numbers: `docs/sessions/ws4.md` (a "4a" part, then a "4b" part).

WS4 is two sessions in one worktree and on one branch: **4a** tags `p1-ws4a`, then a **4b** session continues here from
the Handoff below and tags `p1-ws4b`.

## 4a / 4b

Everything new that changes the game's numbers is behind **`RULES.stats = "attributes"`**: under the legacy set
(still the default until the integrator's flip, §8.5) a quick game makes the same player, levels up with the same
+3 HP and the same card (`hud.js` `drawLevelUp`), and offers perks with `Math.random` from the parent's 25 in the
parent's order, so golden (a) and (b), the 47 recorded screen frames and the legacy fights match.

### 4a: creation, stats, leveling (`p1-ws4a`)

| File | What 4a builds |
|---|---|
| `content/genotypes.js` | `GENOTYPES.bent`, `.plumb` (bible §10.3, §15.6): base 10 + 44 points / base 12 + 38 points, 1 point per +1 to 18 then 2, at most 22 at creation before the background; creases 12 (+1 a level) or grade 2 with a free implant costing ≤ 2; the naming culture |
| `content/backgrounds.js` | the 12 backgrounds of bible §10.9-§10.10: attribute bonus, 2 trees, kit, glim (40-250), reputation changes, the Plumb's Level (Vey, Orrum, Cassin) and free implant. Kit items the game doesn't have yet are listed for WS5/WS8/C4 and left out (or given when their kind is registered) |
| `content/powers.js` | `POWERS`: the parent's 25 perks moved here with their trees (bible §10.8), the general pool (Tough, Mighty) and the majors; the bible's other powers listed with what they wait for (`needs`) and never offered until it lands. `leveling.js` `PERKS` is the same table |
| `progression/chargen.js` | `makeCharacter(choices)`; point-buy (`pointCost`, `pointsSpent`, `pointsLeft`, `canRaise`, `canLower`, `suggestSpread`); `validateChoices`; `suggestName` (bible §2.3: Marshfolk for the Bent, the Drovers' names for the Mesa Runner and the Drover's Child, Plumb names with a Level); `beginRun(game, choices)` (the run started with the made character, its mode and its reputation changes) |
| `progression/index.js` | the `origin` bonus source (background attribute bonuses, Vey's +3 examine, Orrum's +1 natural armour); no longer a stub |
| `player.js` | `makePlayer()` unchanged (the quick game); the seam `beginRun` hands its character through |
| `leveling.js` | `lvlXP`, `killXp`, `xpFor` (bible §10.7, §15.6), Pilgrim's XP (kills 0, every other source × 2.2), and under the attribute set each level's HP (`max(1, 3 + TOU mod)`, derived), +1 crease for the Bent, an attribute point at levels 4, 8, 12…, one power from 3 seeded offers (4 at INT 18+), a major among them every 5th level |
| `screens/levelup.js` | the attribute set's level-up card (an attribute point, then a power, by keys or mouse); the legacy card unchanged |
| `screens/create.js` | the wizard: genotype → background → attributes (point-buy with live HP, DV, AV, MA) → mutations (offers from `mutationOffers` over `content/mutations.js` as it stands: empty in 4a, so the creases are kept) or the free implant (WS5's seam, or the background's named one with a stub) → name (å, ä, ö type; a suggestion) → mode → confirm. Pushed by WS9's title with `{ seed, mode }` |
| `tests/checks/progression.js`, `tools/check-progression.mjs` | the 4a acceptance in Node (and `test-world.html`) |
| `tools/browser-ws4.mjs` | the wizard by keyboard and by mouse in headless Chromium (`node tools/serve.mjs 8644`, `?silent=1`) |

**4a's acceptance** (§8.3, with its numbers in `docs/sessions/ws4.md` "4a"):
1. Every genotype × background creates a valid player with `RULES.stats = "attributes"` (attributes in bounds and the
   points exactly spent, HP = TOU + 4, the kit and the purse, plain JSON through the save codec, a step in each view).
2. Level 1 → 20 simulated without errors, for both genotypes: the HP, crease and attribute-point schedule, one power a
   level, 4 offers at INT 18+, a major at levels 5, 10, 15, 20; the offers identical for the same seed.
3. The full wizard by keyboard (a name with å, ä, ö) and by mouse, in the browser (and in Node through the real
   key and mouse dispatch).
4. The old game as it was under the legacy set: golden (a) and (b), the screen frames, the legacy level-up card.

### 4b: mutations, abilities, screens (`p1-ws4b`)

| File | What 4b builds |
|---|---|
| `content/mutations.js` | 20 entries: 12 physical (Shellback, Thistlehide, Wings, Stilt Legs, Lampskin, Night Eyes, Regeneration, Spare Heart, Bellows Throat, Flatwise, Gills, Echo Throat), 4 mental (Fold Step, Overlook, Shadowsense, Kindle), 4 defects (Lightsick +2, Dark-fear +3, Moth-kissed +2, Crooked Manner +2); bible §13.5's planar flag (11), and `bridge` on the 5 that carry one view into the other (Flatwise, Echo Throat, Fold Step, Overlook, Shadowsense); every one costs 4 (bible §10.3, §15.6); bonus keys, abilities, bible §10.4's reputation. The rest of §13.5 waits for its hooks (the file's header lists why) |
| `progression/mutations.js` | `mutationOffers` (3 seeded, one planar; never a defect), `offerRng` (the sheet's: stands until you buy one), `gainMutation` (4 creases; a defect refunds 2-3, only at creation; reputation; the ability on the first free hotbar key), `raiseMutation` (1 crease, cap floor(level / 2) + 1 and the mutation's max, at most 10), `canGain`, `canRaise`, `mutationLevel` (a mental one + EGO's modifier), Cast (`castOf`, `wakeChance`, `turnWorld`: wakes per zone, the third warns and emits `"smoothers"` 10 s later), the defects that come and go (statuses `shaken`, `mobbed`, `sunsick`) |
| `progression/abilities.js` | the mutations' abilities: Fling, Wings, Bellows, Flatwise, Echo, Overlook, Shadowsense (and its status), Kindle; each in both views with the same cooldown seconds |
| `abilities.js` | Fold Step is the Bent's mental mutation (4 + level; `0D2.md` deviation 17), id `foldStep` and hotbar key 1 kept; the quick start keeps P0's innate grant (4 tiles: its hotbar is in recorded frames), a made character has none; the `"mutations"` and `"powers"` ability sources; `abilityRange` (`rangeFor`); `requestTarget` unchanged for WS8's swap (integration request 1), and a picked tile (no creature) on the map is honoured by every ability that aims |
| `screens/abilities.js` (B), `screens/charsheet.js` (K) | B: every ability with level, source, aim, range, WIL-scaled cooldown and seconds left; 1-9 / a click on a slot assign, 0 / a right click clear, Enter the first free key; the hint that keys 1-9 use the hotbar in both views. K: Attributes (derived numbers, level, XP, creases, Cast; attribute points spent), Mutations (raise for a crease, buy one of three offers for 4) or Implants, Powers, Effects (statuses, cooldowns, the bonus table) |
| `screens/create.js` | the mutation step with real offers, the defects with their refunds, give-backs (a defect only while the rest still fits) |
| `player.js`, `progression/chargen.js` | Night Eyes' dark range (`torchRange`), the attribute set's jump height (1.5 + the jump bonus, so Stilt Legs' halves count; the legacy set's two heights unchanged); a made character's `innate: []` and hotbar from its mutations, mutations validated (known, once, exclusions, creases), defects applied first, their reputation at `beginRun` |

**4b's acceptance:** mutation offers identical for the same seed; each active mutation fires through the 3D aim path
and the map's `requestTarget` in Node; abilities in both views with the same cooldown seconds; the B and K screens at
100×30 and by mouse in the browser.

## Public API

```js
// progression/chargen.js (re-exported by progression/index.js: makeCharacter)
makeCharacter(choices) → player   // choices = { genotype: "bent" | "plumb", background, attrs: { str, agi, tou, int, wil, ego }
                                  //   (bought, before the background's bonus), mutations: [id], implant: id, name, mode }
                                  // throws "makeCharacter: <problems>" when validateChoices refuses them
validateChoices(choices) → [problem]
beginRun(game, choices, { seed }) → player   // a new run with the made character: game.js startRun(seed) (the start landmark,
                                  //   the intro), state.mode = choices.mode, the background's reputation changes (addRep)
pointCost(genotype, score) · pointsSpent(genotype, attrs) · pointsLeft(genotype, attrs) · baseAttrs(genotype)
canRaise(genotype, attrs, k) · canLower(genotype, attrs, k) · suggestSpread(genotype, background) → attrs
suggestName(genotype, background, rng) → name · originBonuses(e) (the "origin" bonus source) · treeNames(p)
freeImplants(background) → ids   // the implants a Plumb background may take free: WS5's costing ≤ 2, its own first;
                                  //   until WS5's table has it, its Level's named one · implantCost(id)
RUN_MODES = ["oneWick", "commonsLamp", "pilgrim"] · NAME_MAX = 24
// a made player, besides makePlayer()'s fields: name, genotype, background, trees, attrPoints, mutations: {},
//   origin: { level, implant, fitted }, and creases (Bent) or grade (Plumb). Plain JSON (the save codec takes it as is).

// player.js
makePlayer() → player             // the quick start's, unless beginRun handed a character over (once)
quickPlayer() → player            // the quick start's, always · nextRunPlayer(p | null)   (beginRun's seam into startRun)

// leveling.js (PERKS is content/powers.js POWERS; every name P0 exported is kept)
xpToNext(level) = lvlXP(level) = 10L² + 10 · tierOf(level) = min(8, ceil((level + 1) / 3))
killXp(game, c, { legendary }) → n   // max(1, round(0.01 × lvlXP(c.level))), elites ×2.5, legendaries ×10; 2 tiers below 25%, 3+ 0
xpReward(kind, level) → n         // RULES.progression.xp.rewards: landmark 0.3, village 0.2, siteBottom 0.4, villageQuest 0.6,
                                  //   triangulation 0.15, kindling 0.08, beat 0.75 (× beatEarly 1.5 is the caller's) × lvlXP(level)
modeXp(game, amount, source) · gainXp(game, amount, { source = "kill" })   // Pilgrim: kills 0, every other source ×2.2
offerPerks(p, milestone)          // the legacy set's (Math.random, the parent's 25)
offerPowers(game, p, { level, milestone, draw }) → ids   // the attribute set's: seeded (seed, level, draw)
takePerk(game, id) · perkRank(p, id) · perkLabel(p, id)
// RULES.progression = { xp: { killShare, elite, legendary, tiersBelow, pilgrimKill, pilgrimOther, rewards, beatEarly },
//                       level: { attrPointEvery: 4, milestoneEvery: 5, offers: 3, offersHighInt: 4, highInt: 18 } }

// progression/mutations.js (4b; re-exported by progression/index.js: mutationOffers, gainMutation, raiseMutation)
mutationOffers(game, p, rng = offerRng(game, p)) → ids   // 3, one planar at least, none had or excluded, no defect
offerRng(game, p) → rng                // seeded by (seed, "mutations", mutations gained): the sheet's offers stand until one is bought
gainMutation(game, p, id) → 1          // 4 creases (a defect: −2/−3, only with game = null); invalidateStats; reputation; the
                                       //   ability on the first free hotbar key; emits "mutate" { e, id, level, how }; throws on a refusal
raiseMutation(game, p, id) → level     // 1 crease, to levelCap(p, id) = min(max, floor(level / 2) + 1, 10); throws on a refusal
canGain(game, p, id) · canRaise(p, id) → null | why · levelCap(p, id) · mutationLevel(e, id) (mental: + mod(ego), ≥ 1)
isMental(id) · isDefect(id) · creasesSpent(ids) · mutationRep(game, p, id) · watchDefects(game, p)
castOf(e) · wakeChance(e) · packFor(cast) → { size, burnisher, great } · turnWorld(game) → woke
// RULES.mutations = { cost: 4, raiseCost: 1, levelsPerCap: 2, maxLevel: 10, offers: 3, planarOffers: 1,
//   cast: { free: 10, perEgo: 2, chance: 0.02, max: 0.75, wakes: 3, fadeHours: 1, delay: 10, pack: { over: 12, per: 8, max: 4, burnisher: 30, great: 45 } },
//   sunsick: { period: 20, light: 0.5 } }
// game.state.cast = { turns, wakes: { zoneKey: [time] }, pack: { zone, at, size, burnisher, great } | null }   (saved with the state)
// events: "mutate" { e, id, level, how: "gain" | "raise" } · "smoothers" { zone, size, burnisher, great }
// statuses: shaken (Dark-fear), mobbed (Moth-kissed), sunsick (Lightsick), shadowsense; the update ids "mutations:turns", "mutations:defects"

// abilities.js (4b additions): sources "mutations" and "powers" (after "innate" and "item") · abilityRange(e, id, lvl) ·
//   AbilityDef.rangeFor?(lvl, e) · info(lvl, e). progression/abilities.js registers fling, wingsUp, bellows, flatwise,
//   echo, overlook, shadowsense, kindle (source "mutation")

// screens/levelup.js:  checkLevelUp(game) · choosePerk(game, k) · levelCard(game) → { level, gift, milestone, draw, step, sel, rows }
// screens/create.js:   MODE "create" (pushed with { seed, mode }) · openCreate(game, { seed, mode }) · wizard() · wizardChoices() · trackRows(game)
// screens/abilities.js: MODE "abilities", B in "play" · openAbilities(game) · abilitiesView(game) → { rows, sel, hotbar }
// screens/charsheet.js: MODE "char", K in "play" · openSheet(game, tab) · sheetView(game) → { tab, tabs, sel, rows, msg }

// content
GENOTYPES[id] = { name, plural, info, base, points, perPoint, steepAt, steepCost, maxAtCreation, track, creases?,
                  creasesPerLevel?, grade?, freeImplantCost?, names, tonics }
BACKGROUNDS[id] = { name, genotype, info, bonus, trees, glim, purse?, rep, villageRep?, kit: { equip, belt?, pack, wants }, level?, implant? }
LEVELS[id] = { name, info, bonus?, torchCost?, script? } · backgroundsOf(genotype) → ids
POWERS[id] = { name, info, tree, general?, major?, max?, bonus?(rank), needs?, ability? } · TREES[id] = { name } · LEGACY_PERKS · powersOfTree(tree)
MUTATIONS[id] = { name, kind: "physical" | "mental" | "defect", cost, max, excludes, planar?, bridge?, info(lvl), bonus?(lvl, e),
                  ability?, rep?, repAll?, status?, darkRange?(lvl) } · BIBLE_FACTIONS (bible §15.4's 21 ids)
```

**The mutations, with what they add (for the balance pass at the flip; levels are the mutation's, a mental one's with
EGO's modifier):**

| Mutation | Kind | Bonus keys (stat bus) | Ability (cooldown s × WIL) | Reputation |
|---|---|---|---|---|
| Shellback | physical | `av` 2 + floor(L / 3), only with no body armour over it | | Clatter +200 |
| Thistlehide | physical | `thorns` 2 | Fling (10): 1-3 + floor(L / 2) to each hostile in the 8 tiles around | |
| Wings ◆ | physical | `travel` 1 | Wings (60): flying 20 + 5L s | Kites +400 |
| Stilt Legs ◆ | physical | `jump` 0.5 × ceil(L / 2) | | |
| Lampskin ◆ | physical | `darkSight` 2, `stealth` −0.25 | | Moths +200, Lampless −200 |
| Night Eyes ◆ | physical | `darkSight` 2; sees 3 + L / 2 tiles with the torch out | | |
| Regeneration | physical | `regen` 1.2L (L HP every 10 s) | | |
| Spare Heart | physical | `tou` 2 | | |
| Bellows Throat | physical | | Bellows (15): a 3-tile cone, Ld4 and burning 3 s | |
| Flatwise ◆ | physical | | Flatwise (30): flat 3 + floor(L / 2) s | Flatfolk +200, Pressed +100, Assize −200 |
| Gills ◆ | physical | `swim` 1 | | Clatter +100 |
| Echo Throat ◆ | physical | | Echo (20): every creature within 6 + L tiles on the map | |
| Fold Step ◆ | mental | | Fold Step (12): 4 + L tiles | |
| Overlook ◆ | mental | | Overlook (max(10, 32 − 2L)): a 9 × 9 within 20 tiles onto the map | |
| Shadowsense ◆ | mental | | Shadowsense (60): 8 + 2L s, every flat being and ghost on the floor shown | |
| Kindle ◆ | mental | | Kindle (5): a cold brazier within 5 + L tiles | |
| Lightsick | defect +2 | (status `sunsick`: 1 HP / 20 s under the open sky) | | |
| Dark-fear | defect +3 | `toHit` −2, `dv` −1 while the torch is out (status `shaken`) | | |
| Moth-kissed | defect +2 | `stealth` −0.3 while the torch is lit (status `mobbed`) | | |
| Crooked Manner | defect +2 | | | every faction −50 |

No power has an ability or a new bonus key in 4b (4a's table in `content/powers.js` stands: Steady hand's `missileAcc`
is integration request 2). No combat number changed.

- **Under the legacy set nothing changes:** a quick game's player, its +3 HP a level, the parent's card, perks offered
  from the parent's 25 with `Math.random`. Everything above that changes numbers reads `RULES.stats`.
- **Offers are seeded** by the run's seed, the level and a draw (0 for a level; gifts count their own). A card whose
  attribute point lifts INT to 18 draws again: the same three and a fourth.
- **Powers that wait** (`needs`) are listed so the trees are whole, and are never offered; while the open trees are
  thin, the offers are filled from the other trees (until teachers open more, WS6b, and C4 fills them).
- **The run modes' names and notes** are in `screens/create.js` (`MODE_TEXT`) as well as in WS9's `save.js RUN_MODES`,
  which this tree doesn't have yet.

## Integration requests

Changes to files that aren't WS4's, for the integrator (or their owners). 4a and 4b work without them; each says what
changes when it lands. 1-3 are WS8's requests 1, 8 and 11 (`git show p1-ws8:docs/ws8.md`); 15-23 are 4b's.

1. **`abilities.js` (WS4, for 4b), WS8's request 1:** route the map's `requestTarget` through `screens/target.js`
   (`requestTarget as targetScreen`): in 3D `done(aimTarget(...))` at once, on the map the target screen answers later,
   and `useAbility` goes on in the callback (`def.target === "self"` at once; on the map `return false` and act when the
   screen confirms). `check-abilities` §5 then drives the screen with Enter. **4b left it to the integrator** (the
   coordinator's instruction: `ws/ws8` stays out of `ws/ws4`): `abilities.js requestTarget(game, ability, done)` keeps
   its signature and every caller goes on in `done`, so only the map's body changes at the merge. `useAbility` passes
   the ability's range at its level (`abilityRange`: Fold Step 4 + level, Kindle 5 + level) in the def it hands over.
   Every ability that aims honours a **picked tile with no creature** on the map (`target.tile`): Fold Step steps onto it
   (as far as it reaches), Overlook draws the 9 × 9 around it, Kindle lights the brazier there, Bellows breathes toward
   it; check-progression §7.4 drives each with such a target, so the screen's answer works as it lands. An ability's
   `use` doesn't read the target's creature when a creature uses it (none of the mutations' do: they are the player's).
2. **`stats.js` `BONUS_KEYS` (the integrator), WS8's request 8:** the integrator adds `missileAcc` at the WS8 merge
   (its message of 2026-10-27), and `missileSpec` adds `bonus(p, "missileAcc")` to the accuracy. `content/powers.js`
   `steadyHand` then gets `bonus: () => ({ missileAcc: 2 })` in the same commit and loses its `needs` line, so it is
   offered (check-content refuses a bonus key `BONUS_KEYS` lacks, so the bonus can't go in before the key).
3. **`stats.js` (the integrator), WS8's request 11:** settled by the integrator at the WS8 merge: a creature's own bonus
   table moves from `e.innate` to `e.bonuses` (stats.js's "innate" source reads `e.bonuses`), and `innate` means a list
   of ability ids only, as `abilities.js`, `player.js` (`innate: ["foldStep"]`) and WS8's `ai.js` read it. WS4 keeps
   the name. 4b keeps the quick start's `["foldStep"]` (its hotbar is in recorded frames) and gives a made character
   `innate: []`. (Until the integrator's change the quick start's `["foldStep"]` adds a stray key `"0"` to its bonus
   table, as in P0; a made character's empty list adds nothing.)
4. **`game.js` `startRun(seed, world, { mode, player })` (the integrator; with WS9's request 2):** take the made
   character and the mode there. Then `chargen.js beginRun` calls it so, and `player.js` drops `nextRunPlayer` (the
   seam that hands the character to `startRun`'s `makePlayer()` today).
5. **`monsters.js` `killMonster` (the integrator; §8.4 names no owner):** under the attribute set a kill's XP is the
   bible's: `gainXp(game, RULES.stats === "legacy" ? m.xp : killXp(game, m, { legendary: !!typeOf(m).boss }), { source: "kill" })`,
   and the floating "+N XP" shows the same number. Today a kill gives the parent's `m.xp` under both sets (Pilgrim's
   zero applies through `gainXp`'s default source).
6. **`torch.js` (the integrator, `0D2.md` §6):** a hook `burnTorch` reads for a cheaper torch, say a bonus key
   `torchCost` (−0.5 = half): Cassin's Level (`LEVELS.cassin.torchCost`, then `bonus: { torchCost: -0.5 }`), the
   Thrifty wick power (drop its `needs`), and later Lampskin (4b) and the glim heart (WS5).
7. **`stats.js` `priceMul` (the integrator):** the attribute set ignores the Haggler (the legacy set's ×0.8 reads
   `hasKey(e.perks, "haggler")`); give the attribute set the same ×0.8 on buying (bible: "prices a fifth better"), then
   `haggler` loses its `needs` and is offered again.
8. **WS6a (`factions.js`, `content/factions.js`):** the starting reputation by genotype (bible §15.4's "Start (Bent /
   Plumb)": the Assize −700 or −100, the Plan −100 or +100), read from `game.player.genotype`; Pilgrim's "most factions
   start at 0 or above" (bible §10.1). `beginRun` adds each background's changes on top with `addRep`. The Aspirant's
   −50 with the Bent villages is `BACKGROUNDS.aspirantOfTheRule.villageRep` (WS6a or WS7, once villages have factions).
9. **WS5 (`content/items/implants.js`, `bodymods/implants.js`):** the six free implants the Plumb backgrounds name
   (`tallyEye`, `plumbEar`, `knuckles`, `levelEye`, `lampCrown`, `darkLens`), each costing at most 2, with
   `parts`; `makeCharacter` fits one with `canInstall(null, p, item, part)` and `install(null, p, item, part)` (no game
   yet at creation), and the wizard lists every implant costing at most 2 (it reads the cost as `grade`, `license` or
   `cost`). The kits' wants: materials (copper, iron, bone: bible §13.1), a reed cloak, an examining kit (+2), stilt
   sandals (+0.5 jump), a theodolite, a snuffer, a map case, ink pots, marker chalk, an Assize writ; a spare 200-glim
   flask (WS6b).
10. **WS8:** a glimgun for the Lamplighter of Cassin's kit (and the Glimgunner power). The sling and the bolt-bow with
    20 bolts are in the kits already, given once `missile` and `ammo` are registered kinds.
11. **WS1, WS7, WS6b:** discoveries, quests, triangulations and Kindlings give XP through
    `gainXp(game, xpReward(kind, level), { source: kind })`, so Pilgrim's ×2.2 applies. Powers waiting on them: Keen Eye
    (sites), Pathfinder (`bonus(travel)`), Terrain lore, Homing sense (WS1); Hour script, Gossip, Triangulator, and Vey's
    Deepwright script (`LEVELS.vey.script`) (WS7); Oil fire, Brew, Warm Hands, Chime (WS6b); teachers opening a tree
    (`p.trees`; bible §10.8: −50 reputation for a rank-1 power).
12. **WS9:** the title already pushes `"create"` with `{ seed, mode }` once it is registered, and the wizard begins the
    run as `newGame` does (startRun, then `state.mode`). The wizard keeps its own copy of the modes' names and notes;
    at the merge it can read `save.js RUN_MODES` instead.
13. **WS9's title and the formula flip (the integrator):** the wizard is meant for the attribute set. Under the legacy
    set a made character reads the parent's numbers (STR = bought − 6, so a Mesa Runner who left STR at 10 has STR 4;
    max HP 20; no creases a level). WS9's title pushes `"create"` as soon as it is registered, so flip `RULES.stats` to
    `"attributes"` at the WS4 merge (§8.5: WS8 merges before WS4), or keep the title on the quick game until the flip.
14. **`tools/README.md` (frozen) and §8.4:** `check-progression.mjs`'s sections (the header of
    `tests/checks/progression.js`: sections 1-6 are 4a's, 7 is 4b's); `tools/browser-ws4.mjs` (serve with
    `node tools/serve.mjs 8644`; the wizard, the level-up card, B and K) as WS4's; `src/progression/abilities.js` is new
    (inside `progression/*`).
15. **`tools/browser-0d1.mjs` (the integrator's; its mode tour fails on a registered screen it can't reach):** WS4
    registers `create` (4a), `abilities` and `char` (4b). Add, after the target screen's tour: on the map, `KeyB` opens
    `abilities` (Esc closes it; by the mouse a click on `[ Close ]`), `KeyK` opens `char` (Esc; `[ Close ]`); and
    `create` through WS9's title (its New game, once the title pushes it) or `screens.pushMode(game, "create", { seed })`
    then Esc back to the title or the run. `tools/browser-ws4.mjs` already does the same by real keys and clicks (its
    section 4, and the wizard in sections 1-2). Until then browser-0d1 reports those three as never reached.
16. **`screens/play.js` `toggleMap` (P0, the integrator's):** emit `"view:turn" { from, to }` when the player turns the
    world (Tab, Esc on the map), so Cast's `turnWorld` (progression/mutations.js) can listen instead of watching
    `game.view` each frame (its watch counts a view change in the same zone while you aren't flat; the cube's first turn
    and a forced flat map aren't turns). **Under the Hand** (bible §10.3: a turn under the Hand leaves no wake): WS1/WS3's
    predicate (say `underHand(game)`) once the Hand exists; `turnWorld` then skips the roll.
17. **The Smoothers (C2's creatures, with WS8's flat movement):** `progression/mutations.js` emits `"smoothers" { zone,
    size, burnisher, great }` 10 s of game time after the third wake in a zone (bible §10.3: 1 + floor((Cast − 12) / 8),
    at most 4; a burnisher at Cast 30, the Great Smoother at 45) and the HUD's log has warned ("The floor smooths itself
    out towards you."). A listener spawns the pack along the floor (flat beings, map only), each dropping a smoothed page
    (the Flatfolk pay +35). Until then the warning shows and nothing comes.
18. **`creatures.js` `ghostHidden` (P0; optional):** Shadowsense (4b) marks flat beings and ghosts with a glyph over
    them in 3D (drawn through walls) and a sighting on the map every half second; if ghosts should also be drawn whole
    while it lasts, `ghostHidden` returns false for the player while `hasStatus(game.player, "shadowsense")` (seeing, not
    touching).
19. **WS5 (`inventory.js` / `body.js` equip) and C4:** Shellback "no body armour": refuse body armour other than
    clothes while you have it, with a line (today the shell's +2 AV only counts with nothing over it, so armour still
    goes on). Lightsick's "unless you wear a hood or veil": a worn piece with a flag (say `veil: true` on a head or face
    item, or a bonus key) that `progression/mutations.js`'s `sunlit` check reads.
20. **`torch.js` (with request 6):** Lampskin's free light: `bonus: { torchCost: -1 }` once the key exists (the
    glim heart likewise).
21. **WS6b (the Kindling):** Crooked Manner's other half: every Kindling gains 20 less, and the rude gesture for the
    words (bible §13.5 and its note on Crooked Manner); read `game.player.mutations.crookedManner`.
22. **WS1 (travel):** Wings gives `bonus(travel) = 1` for "world-map travel × 2", as Pathfinder's ×1.5 would be 0.5
    (bible §10.8): read it as a multiplier of 1 + travel.
23. **`turns.js` (P0; optional):** the map climbs 2 blocks at `jumpBonus(p) >= 1` (High jumper); Stilt Legs' 0.5 a
    two levels reach 1 at level 3, where bible §13.5 says "from level 5". Keep it (a deviation, `docs/sessions/ws4.md`) or
    give the map its own threshold.

## Handoff

**For the integrator.** WS4 is done in two halves on `ws/ws4`: `p1-ws4a` (creation, stats, leveling) and `p1-ws4b`
(mutations, abilities, B and K). Merge `p1-ws4b`, which holds both. Gate numbers: `docs/sessions/ws4.md` "Part 4a"
and "Part 4b" (4b's acceptance in its section 8, the verification in 11, the recheck in 12).

**What 4b adds:** 20 mutations (12 physical, 4 mental, 4 defects; 11 planar, 5 bridging the views) with the crease
economy, Cast and the Smoothers' event; their 8 abilities and Fold Step as the Bent's mutation, each in both views with
the same cooldown seconds; the B (abilities, hotbar) and K (character sheet) screens; the wizard's mutation step; the
level-up card's creases; `check-progression` section 7 (with 7.9's numbers written out) and `tools/browser-ws4.mjs`
part 4b. The tables above ("4b", the public API, "the mutations, with what they add") are current.

**At the merge, in this order:**
1. Merge `p1-ws4b`. WS4 edits only its §8.4 files (and `docs/ws4.md`, `docs/sessions/ws4.md`); no P0 check, fixture or
   recorded frame changed (the gate verifier compared the old game with `p1-ws4a` and `p0-done`: identical). Two files
   you touched at the WS5 merge: `content/backgrounds.js` already has WS5's implant ids (`plumbEar`, `knuckles`), and
   `tests/checks/progression.js`'s Plumb-implant block (after `"an implant for the Bent"`) still reads an empty WS5
   table here: take integration's version of that block.
2. Your content halves of #2, #6, #7 (Steady hand's `missileAcc`, Cassin's and Thrifty wick's `torchCost`, the
   Haggler): those lines are as 4a left them. Lampskin's free light is `bonus: { torchCost: -1 }` on top of its
   `darkSight` and `stealth` (request 20).
3. Integration request 1: swap the map's body of `abilities.js requestTarget` for `screens/target.js` and let
   `useAbility` go on in the callback. Every aimed ability already honours a picked tile with no creature on the map,
   and your own tile is refused; rerun check-progression §7.4 and §7.9 (they drive the abilities through
   `requestTarget`; with the screen they need Enter on the map, as `check-abilities` §5 will).
4. The flip (#13, §8.5) after the user's call on the tier 5-8 balance: the mutations' numbers that matter for it are in
   "the mutations, with what they add"; no WS4 commit changed a combat number.
5. Request 15: browser-0d1's mode tour reaching `create`, `abilities` and `char` (it reports them as never reached
   until then; its shell tour passes).
6. The rest (4-12, 16-23) are other owners' or later; each says what changes when it lands.

**After the merge:** `node tools/run-all.mjs`; `NODE_PATH="$(npm root -g)" node tools/browser-0d2.mjs --only
progression,imports,abilities,shell,hud,content`; `browser-ws4.mjs` on the integration port; browser-0d1 once request
15 is in. **The timed gates:** at the tag `check-dungeons` and `check-perf` were red only with the user's `train.py`
holding the CPU at 91-96%, level with `p0-done` in alternation (`docs/sessions/ws4.md` §12); rerun them on an idle
machine.

**Surprising / worth knowing:**
- Cast's turns of the world are watched each frame (update id `"mutations:turns"`): a test that sets `game.view` by
  hand between frames counts a turn for a player with mental mutations (the cube must be had a frame before). Request
  16's `"view:turn"` event would end that.
- The defects' statuses (`shaken`, `mobbed`, `sunsick`) last while their cause holds (a finite `t` of 1e9, so a save
  holds them); Lightsick's counts in its own tick only in the sun, so a skip steps it in short chunks.
- `game.state.cast` (wakes per zone, a pending pack), `p.mutations`, `p.creases` and the hotbar (nulls for empty keys)
  are saved; the gate verifier's round trip through `saveGame`/`loadGame` came back whole, pack and all.
- The quick start is unchanged: innate Fold Step on key 1, 4 tiles, no mutations (its stray bonus key `"0"` is P0's,
  your #11 ends it).
- Python heredocs through Git Bash turn `\n` into a real newline: write such edits to a script file.

**State at the end of 4b:** tag `p1-ws4b` on `ws/ws4` (pushed); nothing running (the server on 8644 stopped, no
browser open, the verifiers' worktrees removed).
