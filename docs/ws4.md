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
| `content/mutations.js`, `progression/mutations.js` | ≥ 16 physical and mental mutations, 4 defects, 2 planar ones that bridge the views; `mutationOffers` (3 seeded offers, one of them planar), `gainMutation` (4 creases), `raiseMutation` (1 crease, cap floor(level / 2) + 1, at most 10), defects refunding 2-3; Cast (bible §10.3); the reputation changes of bible §10.4 |
| `abilities.js` | Fold Step becomes the Bent's mutation (bible §15; `0D2.md` deviation 17), the innate grant dropped (id `foldStep` and hotbar key 1 kept); mutation and power abilities as sources; the map's target through WS8's screen (integration request 1 below) |
| `screens/abilities.js` (B), `screens/charsheet.js` (K) | the list with cooldowns and assigning to 1-9; the sheet's tabs (attributes and derived stats, mutations or implants, powers, effects); the hotbar hint `0D2.md` §5 asks for |
| `screens/create.js` | the mutation step with real offers (4a's step already spends creases through `gainMutation` once it exists) |
| `progression/*` | spending creases after creation (the sheet), the crease economy at level-up |

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

// screens/levelup.js:  checkLevelUp(game) · choosePerk(game, k) · levelCard(game) → { level, gift, milestone, draw, step, sel, rows }
// screens/create.js:   MODE "create" (pushed with { seed, mode }) · openCreate(game, { seed, mode }) · wizard() · wizardChoices()

// content
GENOTYPES[id] = { name, plural, info, base, points, perPoint, steepAt, steepCost, maxAtCreation, track, creases?,
                  creasesPerLevel?, grade?, freeImplantCost?, names, tonics }
BACKGROUNDS[id] = { name, genotype, info, bonus, trees, glim, purse?, rep, villageRep?, kit: { equip, belt?, pack, wants }, level?, implant? }
LEVELS[id] = { name, info, bonus?, torchCost?, script? } · backgroundsOf(genotype) → ids
POWERS[id] = { name, info, tree, general?, major?, max?, bonus?(rank), needs? } · TREES[id] = { name } · LEGACY_PERKS · powersOfTree(tree)
```

- **Under the legacy set nothing changes:** a quick game's player, its +3 HP a level, the parent's card, perks offered
  from the parent's 25 with `Math.random`. Everything above that changes numbers reads `RULES.stats`.
- **Offers are seeded** by the run's seed, the level and a draw (0 for a level; gifts count their own). A card whose
  attribute point lifts INT to 18 draws again: the same three and a fourth.
- **Powers that wait** (`needs`) are listed so the trees are whole, and are never offered; while the open trees are
  thin, the offers are filled from the other trees (until teachers open more, WS6b, and C4 fills them).
- **The run modes' names and notes** are in `screens/create.js` (`MODE_TEXT`) as well as in WS9's `save.js RUN_MODES`,
  which this tree doesn't have yet.

## Integration requests

Changes to files that aren't WS4's, for the integrator (or their owners). 4a works without them; each says what changes
when it lands. 1-3 are WS8's requests 1, 8 and 11 (`git show p1-ws8:docs/ws8.md`).

1. **`abilities.js` (WS4, for 4b), WS8's request 1:** route the map's `requestTarget` through `screens/target.js`
   (`requestTarget as targetScreen`): in 3D `done(aimTarget(...))` at once, on the map the target screen answers later,
   and `useAbility` goes on in the callback (`def.target === "self"` at once; on the map `return false` and act when the
   screen confirms). `check-abilities` §5 then drives the screen with Enter. 4b does it once `ws/ws8` is merged (its
   `screens/target.js` isn't in this tree).
2. **`stats.js` `BONUS_KEYS` (the integrator), WS8's request 8:** the integrator adds `missileAcc` at the WS8 merge
   (its message of 2026-10-27), and `missileSpec` adds `bonus(p, "missileAcc")` to the accuracy. `content/powers.js`
   `steadyHand` then gets `bonus: () => ({ missileAcc: 2 })` in the same commit and loses its `needs` line, so it is
   offered (check-content refuses a bonus key `BONUS_KEYS` lacks, so the bonus can't go in before the key).
3. **`stats.js` (the integrator), WS8's request 11:** settled by the integrator at the WS8 merge: a creature's own bonus
   table moves from `e.innate` to `e.bonuses` (stats.js's "innate" source reads `e.bonuses`), and `innate` means a list
   of ability ids only, as `abilities.js`, `player.js` (`innate: ["foldStep"]`) and WS8's `ai.js` read it. WS4 keeps
   the name; if 4b drops the innate Fold Step grant, the field stays a list (or empty). (Until then the player's
   `["foldStep"]` adds a stray key `"0"` to its bonus table, as in P0.)
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
   (`tallyEye`, `plumbLineEar`, `truesteelKnuckles`, `levelEye`, `lampCrown`, `darkLens`), each costing at most 2, with
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
    `tests/checks/progression.js`); `tools/browser-ws4.mjs` (serve with `node tools/serve.mjs 8644`) as WS4's.

## Handoff

**For the WS4b session** (same worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws4`, branch `ws/ws4`). State at the
end of 4a: see the bottom of this section for the tag and the last commit.

**What 4a built** (gate numbers in `docs/sessions/ws4.md` "Part 4a"): the genotypes, the 12 backgrounds and the Levels;
`POWERS` (the parent's perks in the bible's trees, plus what waits); `makeCharacter`, the point-buy, names and
`beginRun`; the attribute set's leveling (HP, creases, attribute points, seeded power offers, killXp, Pilgrim); the
attribute set's level-up card; the creation wizard (keys and mouse, å ä ö); `check-progression` (Node and the
browser's test page) and `tools/browser-ws4.mjs`.

**The exact next step for 4b:** fill `content/mutations.js` and `progression/mutations.js` (drop both `STUB`s):
`mutationOffers(game, p, rng)` (3 seeded offers, one planar), `gainMutation(game, p, id)` (4 creases; `game` may be
null at creation: `makeCharacter` calls `gainMutation(null, p, id)` for each of `choices.mutations`),
`raiseMutation(game, p, id)` (1 crease, cap floor(level / 2) + 1, at most 10), defects refunding 2-3 (the wizard
reads `MUTATIONS[id].cost`, 4 by default, so a defect with `cost: -2` gives two back: `screens/create.js`
`creasesLeft` and `pickTrack`). Then a mutation bonus source (progression/index.js) and an ability
source (`registerAbilitySource("mutations", …)` in abilities.js), Fold Step as the Bent's mutation (drop
`innate: ["foldStep"]` from `player.js quickPlayer` only for made characters, or for all once the integrator
agrees: the quick start's hotbar is in recorded frames only while it cools down), then B, K and the hotbar hint.

**Where to look:**
- The wizard's mutation step already calls `mutationOffers` with a seeded rng (`seedFor(seed, "creation",
  "mutations", n)`) and lists `taken` rows (a click gives one back) and a last "Go on" row; `check-progression` §4
  drives it with an empty table. Add a 4b section that takes and gives back mutations through it.
- `screens/levelup.js` shows "+1 crease" on the card; spending creases at level-up or on the sheet is 4b's (bible:
  creases buy new mutations or levels at any time).
- `p.attrPoints` kept "for later" today wait for the next card; K's sheet should spend them too.
- Cast (bible §10.3) and the mutations' reputation changes (§10.4) are 4b's; `mentalLevel(e)` in `stats.js` is
  `level + mod(ego)`.

**Integration requests 1-3** (WS8's): 2 and 3 are the integrator's (settled, see above). 1 (the map's `requestTarget`
through WS8's `screens/target.js`) touches WS4's `abilities.js` but needs WS8's screen, which this tree doesn't have and
mustn't merge (`ws/ws8` stays out of `ws/ws4`): 4b keeps `abilities.js`'s seam as it is (`requestTarget(game, ability,
done)`, callers continuing in `done`) so the integrator can swap the map's body at the WS4 merge; ask the coordinator
before doing more.

**Surprising / worth knowing:**
- `progression/chargen.js` imports `game.js` (for `startRun`), and `game.js` reaches `screens/create.js`, which imports
  `chargen.js`: a cycle that is fine as long as `create.js` reads nothing of `chargen.js` while loading (its `wiz` state
  takes the name's max in `reset()`). check-imports loads every module on its own and catches a slip.
- Under the legacy set nothing of 4a shows (golden, screen frames and legacy fights hold); tests switch with
  `overrideRules("stats", "attributes")` and must undo it.
- This machine runs WS9, WS5, the integrator and an ML job: timed checks read slow under load; take timed numbers
  alone, against `p0-done` in alternation (`node tools/check-perf.mjs --against p0-done`).
- Port 8644 is WS4's (`node tools/serve.mjs 8644`); 8645 is WS5's.
- What the verification changed that 4b builds on: a level's attribute point is credited when its card opens
  (`screens/levelup.js openCard`), not in `gainXp`; the Plumb's implant goes through `freeImplants(background)` (WS5's
  table costing ≤ 2, the background's own first) and `validateChoices` refuses anything else; a suggested name that
  nobody touched is dropped when the genotype or background changes; `chargen.js NAME_PARTS` is what check-progression
  holds to bible §15.11 (keep any new syllable or family in it).
- Shell quoting on this machine: a Python heredoc through Git Bash turned `\n` and `\u0000` into raw characters in a
  test file once; write such edits to a script file in the scratchpad (or use the Edit tool) instead.
- Settled by the user (2026-10-27): the Lamplighter of Cassin keeps the 500 purse that holds its 250 glim
  (`docs/sessions/ws4.md` deviation 2). Still the integrator's: the flip before WS9's title can push the wizard
  (integration request 13).

**State at the end of 4a:** tag `p1-ws4a` on `ws/ws4` (pushed), every 4a acceptance item with its numbers in
`docs/sessions/ws4.md` "Part 4a"; nothing half finished; the server on 8644 stopped, no browser open.
