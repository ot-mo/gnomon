# Content survey: The Rotation Cube, ahead of a Qud-style fork

Repo: `C:\Users\Otto Mörner\Code\ascii-roguelike` (commit 75edbd3). All citations are `file:line` relative to `src/`
unless they say otherwise. About 7,200 lines of plain ES modules, with no build step and no dependencies.

**The short version.** The content is **data tables plus `switch` statements**. Every table (WEAPONS,
MONSTER_TYPES, PERKS, NPC_TYPES…) is easy to extend. The problems are elsewhere:

1. Item *kinds* have no registry. A new kind touches about 12 switch statements across 6 files.
2. Equipment slots *are* item kinds (`p[it.kind]`, `inventory.js:86`), so a body of implant slots needs a new slot model.
3. Every monster is hostile to the player and only to the player. There's no faction, no attitude and no monster-vs-monster targeting.
4. NPCs are a separate entity type. They have no HP, never move and can't be attacked.
5. The world is a **linear stack of 48×48×10 floors indexed by `depth`**. `depth` doubles as the difficulty level everywhere: spawns, loot tier, prices and monster scaling.
6. The Rotation Cube story is wired into `game.js`, `hud.js`, `music.js`, `story.js`, `vaults.js`, `effects.js` and `throwing.js` through `FINAL_DEPTH`, `game.story.cube`, the `lich` type and `depth === 0`.

---

## 1. Systems: data model and extension points

### 1.1 Items (`items.js`)

**Item instance** (a plain object, copied around with spread):
`{ kind, id?, effect?, ench, known, auraKnown?, props?: [propKey], element?, relic?: relicKey, count?, amount?, name?, info?, x, y, z, dropped? }`.
These `kind`s exist: `potion scroll weapon armour ring amulet key heart strength knife bomb gold cube quest`.
`relic?` is a placeholder that is resolved on arrival (`game.js:243-252`).

| Table | Lines | Fields | Notes |
|---|---|---|---|
| `POTIONS` | 12-23 | name, aura, weight, info | effect code lives in `effects.js:18-64` (drink) and `throwing.js:159-202` (shatter) |
| `POTION_COLORS` | 24-35 | name, rgb | shuffled per run (`game.js:185-186`); needs at least as many colours as potions |
| `SCROLLS` | 39-49 | name, aura, weight, info | effects in `effects.js:76-120`; random titles come from `scrollTitles` (52-55) |
| `ELEMENTS` | 58-63 | adj, color, info | fire/frost/shock/holy; applied in `monsters.js:760-804` |
| `WEAPONS` | 78-113 | name, dmg, swing, reach, str, tier, thrust?, held{length,pivot,art} | `tier 0` means starting gear only; `held` is the first-person pixel art (`hud.js:193-259`) |
| `ARMOURS` | 118-124 | name, armour, str, tier, metal | `clothes` is tier 0 |
| `PROPERTIES` | 138-149 | slot (weapon/armour), adj or suffix, info, bonus, strReq? | rolled in `randomEquipment` (419-422) |
| `RINGS` / `AMULETS` | 154-170 | name, info(n), bonus(n), fixed? | **you must also add a `GEMS` colour (173-177)**, or `itemGlyph` returns an undefined colour and `S.put(...color)` throws |
| `RELICS` | 182-203 | name, kind, id, ench, element?, info, bonus | each is unique per run via `game.relicsFound` (`game.js:196, 104-108`) |

**Functions that switch on `kind`.** All of them must learn about any new kind:
- `FLOOR_ART` 235-250, `itemPalette` 253-279, `itemSprite` 281-285 (3D look)
- `itemName` 292-320, `itemGlyph` 323-341, `itemAura` 345-350, `itemInfo` 360-380 (a one-line description)
- `itemPrice` 452-468 (unknown kinds price at 0, which means "not for sale")
- `isGear` 232. Stacking is decided by a hard-coded list in `addToInventory` 490, duplicated in `inventory.js:145` and `throwing.js:31-35`.
- `pickUpItems` 498-523: special cases for heart, strength, key, gold, cube and relic, plus a sound map at 508
- `inventory.js:useSelected` 55-72: the "use" verb exists only for potion, scroll and gear
- `renderMap.js:189-227`: the legend
- `bonus()` only sees gear: `itemBonuses` 217-225 handles ring/amulet tables, props and relics

**Loot and economy.** These go through `weighted()` (384-389):
- `randomPotion` / `randomScroll` (391-397)
- `maxTierAt(depth)` (401)
- `randomEquipment(rand, depth, luck)` (407-424): ±ench, elements, props
- `randomJewel` (427-435)
- `randomTreasure` (439-448)

Prices: `itemPrice` (452-468), `priceFactor(depth) = 1 + depth/15` (469) and `sellPrice` at 30% (470).

**Recipes:**
- *New weapon or armour:* add one entry to `WEAPONS` or `ARMOURS`. `tier` gates depth through `maxTierAt`.
- *New potion or scroll:* add a table entry, a colour, and cases in `effects.js` and `throwing.js:shatter`.
- *New item kind:* touch every function listed above. The fork should replace this with an `ITEM_KINDS` registry (§5).

### 1.2 Inventory (`inventory.js`)

- **Slots:** the player has fixed fields `weapon, armour, ring, amulet, sidearm` (`player.js:22-25`). `equip()` uses `const slot = it.kind` (86) and writes `p[slot]` (92-95), so the slot name *is* the item kind.
- **Rules:** cursed gear won't come off (88-91). Strength is checked against `strNeeded` (79-85). A new weapon pushes the old one to the belt (96-99). Plain clothes are discarded (99).
- **Action times** are 0.5/1.0/1.0 s (12). On the map they cost game time through `mapUseTime` (`game.js:458-460`).
- **Screen:** `drawInventory` (155-230). The slot rows are fixed at `y0+3..y0+7`, and the list starts at `TOP = 9`.
  - **There is no scrolling.** The box height is `rows + TOP + 7` (159), so a Qud-sized inventory runs off the screen.
  - Mouse hit-testing uses the module-level `layout` (13, 46-53).

### 1.3 Player and bonuses (`player.js`)

`makePlayer` (16-32) holds:
- `hp, maxHp (20), str (10), keys, gold, torch, level, xp, perks:Set, perkRank`
- slots and `inv`
- the timers `flyTime, hasteTime, shadowTime, poisonTime, paralyzed, darkTime, guardTime`
- combat cooldowns

**`bonus(p, key)` (38-43) is the single aggregation point.** It sums `itemBonuses` over `worn(p)` (35) and every perk's `bonus(rank)`. Nothing is cached, so it's cheap to extend.

`wear(p, it, ±1)` (47-53) "bakes" only `str` and `maxHp` into the base stats. `regear` (55-60) re-bakes them after an enchantment changes.

Derived stats:
- `attackTime` (63-66) and `weaponReach` (67)
- `armourValue` (70-72)
- `torchRange` / `torchPower` (76-83)
- `speedMul` (84), `jumpBonus` / `hasFeatherFall` (85-86)
- `canSwim` is the perk "swimmer" (89)

Physics and fall damage are at 136-184.

**Bonus keys and where they're read.** The documented list is at `items.js:126-134`. Seven keys are used without being documented.

| key | consumed at |
|---|---|
| crit | `monsters.js:756` |
| maxDmg | `monsters.js:757`, `inventory.js:181` |
| swing | `player.js:64` |
| reach | `player.js:67` |
| leech | `monsters.js:778` |
| crush | `monsters.js:764` |
| thorns | `monsters.js:524` |
| ward | `monsters.js:520` |
| regen / darkRegen | `effects.js:161` |
| str, maxHp (baked) | `player.js:50-51` |
| armour | `player.js:71` |
| speed | `player.js:84` |
| torch | `player.js:78,82` |
| sense | `turns.js:106` |
| darkSight | `player.js:77,81` |
| stealth | `monsters.js:596` |
| firstBlock | `monsters.js:512` |
| jump | `player.js:85` |
| featherFall | `player.js:86` |
| killHeal, undeadHeal | `monsters.js:669` |
| burnBonus | `monsters.js:765` |
| poisonHit | `monsters.js:789` |
| sunder | `monsters.js:768` |
| cutsFlat | `monsters.js:293` |
| foldGuard | `game.js:402` |

*New bonus key:* put it in any bonus object (property, jewel, relic, perk), then read `bonus(p, "key")` where it should apply. If it should change a stored stat, extend `wear()`. Better: stop baking anything (see §2.2).

### 1.4 Leveling and perks (`leveling.js`)

- `PERKS` (8-35) has the fields `name, info, max?` (ranks), `bonus?(rank)` and `major?` (offered only at milestones).
- XP needed per level is `xpToNext = 10·L² + 10` (43).
- `gainXp` (45-57) gives +3 max HP per level and queues `pendingLevels`.
- `offerPerks` (61-68) offers 3 perks, or 4 at milestones. It uses `Math.random`, so it isn't seeded.
- `takePerk` (70-78) special-cases `tough` and `mighty`, which bake HP and STR.
- The level-up screen is `hud.js:78-111`, and it's triggered in `game.js:310-322`. That trigger is also how `bonusPerks` gifts from NPCs work (`npcs.js:443`).
- **Flag-style perks** are checked with `p.perks.has(...)` in these places:
  - alchemist `effects.js:20`, thickBlood `effects.js:152`, scholar `items.js:347`, haggler `dialogue.js:165`
  - executioner `monsters.js:766`, giantSlayer 767, lucky 676
  - juggler `throwing.js:53,134`, demolitionist `throwing.js:225`
  - cartographer `turns.js:94`, swimmer `player.js:89`
  - secondWind `game.js:131`, foldingStrike `game.js:404`

### 1.5 Monsters (`monsters.js`)

**`MONSTER_TYPES`** (32-272). The trait reference is the comment at 15-31.
- Common fields: `name, glyph, color, xp, depths:[a,b], weight, hp, speed, damage, cooldown, reach, sight, w, h, frames[2], palette`
- Optional traits:
  - `hover, erratic, venom, drain, regen, darkSight, ranged{range,hold,damage,cooldown,speed,gravity,kind}`
  - `splits, undead, boss, flat, resist[], weak[], brittle, ghostly, guardian, armour, burns, fearsLight`

**`ELITES`** (276-283) are multipliers: `hp, dmg, size, speed, cd, venom, drain, armour, ward, depth`. They're rolled by `rollElite` (328-332).

**Instance**, from `spawnMonster` (337-359):
- `{ id (module counter 334), type, elite, guardian, name, glyph, color, w, h, hp, maxHp, bonus, speedMul, cdMul, armour, ward, venom, drain, burns, xp, … status timers (burn, chill, stun, blind, poison, haste), tx, ty, nx, ny, p (step progress), x, y, z, state: idle|wander|chase, cd, think, lost, pause }`
- Depth scaling: +6% HP per floor, +1 damage every 4 floors, +10% XP per floor (339-349).

**AI:** `updateMonsters` (392-505).
- One flow field toward **the player only** (`game.flow`, 399-403). NPC tiles are blocked as `-1` (407).
- Status ticks run at 420-449.
- Guardian and boss hooks are at 450-452.
- Every 0.25 s, `perceive()` (586-613) runs. **If it sees you, `state = "chase"`.** There's no attitude check.
- Melee happens when `inReach` of the player (460-481), ranged through `shoot()` at the player (482-488, 545-558), and movement through `chooseStep` (617-646) along the flow field.

**Combat:**
- `hitPlayer` (509-541): armour soak, ward, thorns, venom, drain
- `attackMonster` (747-805): the full damage formula
  - crit 12% plus bonus
  - roll, plus ench, plus `(str − strNeeded)/2` (759)
  - element, crush, burn, executioner and giantSlayer multipliers, then sunder
- `damageMonster` (809-816) for non-weapon damage. **It always awards the player XP** through `killMonster(..., byPlayer=true)`.
- `hurtMonster` (818-826) forces `state="chase"`.
- `killMonster` (656-696) handles XP, killHeal, the guardian hook, loot drops (gold at 678), slime splitting, the bounty quest event (694) and the boss win (695).

**There's no to-hit or dodge roll for either side.** In 3D, geometry decides whether you hit (`playerAttack` 713-736). Monsters always hit if their cooldown, reach and line of sight allow it (474-481).

*New monster:* add a table entry, two frames and a palette; `depths` and `weight` handle spawning (`pickMonsterType` 316-325). For a fixed placement in vaults, map a letter to it at `gen/vaults.js:404`. Special AI needs a hook like the guardian one (450-452). `test.html` checks the art.

### 1.6 Guardians (`guardians.js`)

`guardianThink` (26-36) dispatches to `queen` (62-83), `warden` (86-104) and `colossus` (131-178). Shared helpers are `summon` (39-59), `fearLight` (107-123), `colossusCore` (127-129), and `guardianSprites` / `slamState` (182-204).

They're placed by `GUARDIAN_HALLS` / `GUARDIAN_FLOORS = [5,10,15]` (`gen/vaults.js:297-328`) through the `Z` letter (379). Their hooks are `onGuardianWakes` / `onGuardianDies` (`game.js:88-111`), which open the gate and drop a relic.

These fights use both views (flat queen, dark-only warden, height-gated colossus). They're the best template for "legendary creature lairs" at fixed overworld landmarks.

### 1.7 NPCs, quests, shrines (`npcs.js`)

**Appearance and type.**
- Art templates ROBE / PEDDLER / KNIGHT / GHOST / STATUE / SHRINE (22-45) are recoloured per NPC through a palette. That makes cheap faction and villager variants easy.
- `NPC_TYPES` (47-68) has the fields `name, title, glyph, color, art, palette, flat?, ghost?, statue?, w?, h?`.

**Instance:** `spawnNpc` (71-73) creates `{ id (module counter), type, tx, ty, x, y, z, depth, state:{}, met }`.
- NPCs have **no HP, faction or movement**, and they can't be attacked. Bumping one on the map always talks (`turns.js:148-153`), and `playerAttack` only scans `floor.monsters`.

**Quests.**
- A quest is `game.quests: [{id, title, text, done}]`. It's managed with `addQuest` / `finishQuest` / `questActive` / `questDone` (88-102).
- `questEvent` (105-112) only knows `"bounty"`.
- Quest logic is hand-written per NPC inside `talkTo`, a 210-line `switch (n.type)` (283-493). Progress is checked by peeking at `n.state` and game state, for example `mapPercent` (262-266).

**Placement.**
- `planEncounters(seed)` (118-134) gives a seeded depth → NPC list for floors 1-18. Pell is on 2/6/10/14/18; shrines appear with 35% chance per floor.
- `gen/dungeon.js:placeEncounters` (347-395) and `placePrisoner` (398-423) do the actual placement.

**Commerce and blessings.**
- `peddlerStock` (137-161)
- shrine offerings and trials (166-246)
- `RUMOURS` is a static array of 12 lines (268-281)

*New NPC:* add an `NPC_TYPES` entry and a `case` in `talkTo`, an entry in `planEncounters`, and a voice in `sfx.js:VOICES` (180-192). Without a voice, the NPC falls back to Maren's (203). This is documented in README.md:529-555.

### 1.8 Dialogue, shop, journal, story screens (`dialogue.js`)

- **Node contract:** `{ text, options:[{ label, go:() => node | null | {shop:"buy"|"sell"} }] }` (npcs.js:9-11, 249-250).
  - Nodes are closures built when you talk, so nothing needs to be serialized.
  - This structure is good enough for generated dialogue.
- **Talk.**
  - `openTalk` (45-53)
  - text typed out at 32 letters per second, with each letter "spoken" by `speakLetter(ch, t.npc.type)` (73-86, **82**)
  - `choose` (94-103), `talkKey` (105-115), mouse handling (117-124), `drawTalk` (126-156)
- **Shop.**
  - three tabs: buy, sell and services (`TABS` 162)
  - `haggle` (165), `services` (167-197): sharpen, curse lift, element forge, identify
  - `shopRows` (199-208), `trade` (220-250), `drawShop` (252-277)
  - Pell is hard-coded in "PELL'S PACK" (258) and in the log strings (175, 190-192, 228, 243).
- **Journal** (280-309): it truncates at the screen height (307) and has no scrolling.
- **Story pages** (313-342): `openStory(game, pages, then)`.
- **Helpers:** `wrap` (18-30) and `box` (32-35). `hud.js:95-99` re-implements word wrapping.

### 1.9 Effects (`effects.js`)

- `drinkPotion` (10-65) and `readScroll` (68-122) are switches.
- `liftCurses` (126-131).
- `tickEffects` (134-171) counts down the ad-hoc timer fields on the player, applies poison (with thickBlood) and regen (12/points seconds).
- `revealFloor` (175-190) and `senseAuras` (194-201).
- The timer fields are listed one by one again in the status bar (`hud.js:130-137`).

**Generalize to a `p.status = {id: secondsLeft}` table** with `STATUS` defs (`onTick`, `onEnd`, HUD label and colour). Mutations and implants will add many more statuses.

### 1.10 Throwing and projectiles (`throwing.js`)

- `readyStack` (25-29)
- `throwReady` (3D aim, 38-56)
- `throwAtNearest` (map: auto-targets and always hits, 60-81)
- `updateProjectiles` (85-117). `pr.hostile` means "hits the player", and anything else hits monsters (102-109).
- `impact` (120-144) and `shatter` (147-203)
- bombs: `explode` (218-256) also opens secret walls
- `updateClouds` (259-271)
- `projectileSprites` (300-329)

**This pipeline is the natural base for ranged mutations** (fire breath, quills, freezing ray) and for guns and bows. To use it:
- add projectile `kind`s with a source, a damage spec and an element
- add `impact` cases
- add sprite cases

The map needs a real **targeting cursor**, because today it just auto-picks the nearest target.

### 1.11 Interaction (`interact.js`)

- `lookTarget` (11-24) and `lookPerson` (28-44): flat NPCs only as shadows, ghosts only in the dark.
- `interact` (47-54), `useColumn` (57-63) and `useBlock` (66-95).
- Lever link actions open / free / dud / part / pit / summon / gas (103-137).
- The brazier puzzle (141-163).
- Block flags (`door, locked, gate, lever, brazier, on, emissive, ghost, numeral, mosaic, spikes, mural`) live in `world.js:16-54`.

New interactables, such as a becoming nook (implant install), a water pool you can fill from, or a shrine altar, slot in as block flags plus a `useBlock` branch.

### 1.12 HUD (`hud.js`)

- `drawHud` (10-73) handles the crosshair and `[E]` label (16-20) and the status bar, messages and boss bar.
- Overlays: pause/title (28-41), death (42-50), victory (51-61), the "descend" interstitial (62-69), levelup (70-72).
- `drawStatus` (113-142) shows `DEPTH n/FINAL_DEPTH`, HP bar, LV/XP, STR, ARM, `$gold`, keys, torch, the ready throwable and each timer. It's one fixed line with no wrapping.
- `drawBossBar` (145-152) is hard-wired to `lich` or `guardian`.
- `drawMessages` shows only the last 5 messages from the last 10 s (155-163). The game keeps 40 (`game.js:121-124`), but there's **no message-log screen**.
- First-person weapon rendering is at 166-259.

### 1.13 Story (`story.js`), sounds (`sfx.js`), music (`music.js`)

- **story.js:**
  - text: `INTRO` (16-20), `CUBE_PAGES` (22-26), `TAUNTS` by depth (29-34), `FINAL_PAGES` (36-38), `EPILOGUE` (40-44)
  - `buildTemple(seed)` draws depth 0 by hand (51-131), and `openCubeWall` is at 134-137
- **sfx.js:**
  - `sfx(name, {at})` (107-174) plays named effects with stereo placement.
  - `VOICES` (180-192) maps each NPC type to `{pitch, wave, ghost?, thin?, stone?}`.
  - `speakLetter` (198-238) gives each letter a formant blip, so the same word always sounds the same.
  - **For generated NPCs:** derive a voice object from species, faction and a seeded hash, and pass the object (or a key) instead of `npc.type` (dialogue.js:82).
- **music.js:**
  - `MOODS` temple / dungeon / deep / boss (22-27) set bpm, mode, chords, timbres, bass and drums.
  - `updateMusic` (59-78) picks the mood from depth, the boss and chasing monsters (65-68).
  - The flat (map) vs deep (3D) sound chain crossfades (80-86). `!game.story.cube` forces flat (70).
  - The Qud fork wants **region moods** (salt flats, jungle, ruins, village, faction holy sites) chosen from `game.zone.region`. Keep the flat/deep crossfade per view.

### 1.14 World, floors and generation (context the content depends on)

- `world.js`: `W = D = 48, H = 10` (5), `FINAL_DEPTH = 20` (9), `BLOCKS` (16-54), `KIND` (60-63).
- `class Floor` (65-177) holds the voxel blocks, seen/holeSeen/kind/stand maps, and the per-floor lists `links, groups, monsters, items, npcs, spikes, projectiles, clouds, markers, sightings, rooms`. It also has `spawn, stairs, upStairs, hasSky` and `refresh()`, which recomputes light, standing heights and map kinds.
- `gen/dungeon.js`:
  - `generateFloor(seed, depth)` (22-32): depth 0 gives the temple, and retries until `validateFloor` passes (857-909).
  - Content hooks: monsters (249-263), loot (264-274), encounters (277), `arrivalPoint` (756-762).
- `gen/vaults.js`: a letter-legend vault format (1-25), `pickVault` (332-338) and `stampVault` (342-…). **The vault format is the right tool for hand-authored overworld landmarks and village buildings.**
- `game.floors` is a `Map(depth → Floor)` (`game.js:44`). `enterFloor` / `changeFloor` (217-259) and `checkFloorEvents` (152-171) cover stairs, falling and deep water.

---

## 2. What has to be generalized

### 2.1 Factions and reputation

**Today:** there's no faction concept at all.
- Monsters always chase you once they see you (`perceive`, `monsters.js:601-608`), or once you hurt them (`hurtMonster` 823).
- Only the player is ever a target: one flow field to the player (399-403), reach and line of sight measured to the player (460-474), `shoot` aims at `game.player` (546-549), and `hitPlayer` has no general form.
- NPCs are a parallel entity list that can't fight.

**Changes:**
1. **Data.**
   - `FACTIONS` table: `{ id, name, color, religion, homeRegions, likes:[factionId|thing], hates:[…], startRep, waterRitualItems… }`.
   - `game.rep = {factionId: n}`.
   - Attitude bands, Qud-style: hated / disliked / indifferent / liked / loved, for example at ±250 and ±600.
2. **Membership.**
   - Add `factions: {id: weight}` to `MONSTER_TYPES` entries and to `NPC_TYPES` (or generated villager templates).
   - Copy it onto the instance in `spawnMonster` (341-358) and `spawnNpc`.
3. **Attitude function.**
   - `attitude(game, a, b)` (player or creature) uses the faction, the rep band and personal grudges (`m.angryAt: Set(ids)`).
   - In `perceive`, only switch to `chase` when the result is hostile. Otherwise go to `idle` / `wander`, or a new `follow` (allies) or `flee` state.
4. **Targets other than the player.**
   - Introduce `m.target` (an entity).
   - Generalize `hitPlayer` into `hitCreature(game, attacker, target, …)`, and make `shoot`, `inReach` and `chooseStep` target-aware.
   - The flow field is per target. Keep the player field and use greedy steps toward nearby creature targets, or cache fields per target id with a version counter (the pattern at 399-403).
   - Give `damageMonster` and `killMonster` a `source` argument, so only the player's kills give XP and rep changes. Today `byPlayer` defaults to true (656, 814).
5. **Reputation events:**
   - attacking a member angers witnesses of that faction
   - a kill is −rep with the victim's factions and +rep with their enemies
   - quests, water rituals and gifts give +rep
   - Hook these into `hurtMonster` (818), `killMonster` (656) and quest completion (`finishQuest` 94).
6. **NPCs as creatures.** Merge NPCs into the creature list as monsters with a `talk` component (dialogue id, merchant stock, quest giver), HP and a faction.
   - Bump then means: talk if not hostile, attack if hostile, and a modifier key for "attack anyway" (`turns.js:148-162`).
   - Today `occ[...] = -1` for NPCs (`monsters.js:407`) and the special flat/ghost visibility in `interact.js:28-44` and `renderMap.js:156-161` would need to work off the unified entity.
7. **Rep consumers:**
   - shop prices (`haggle`, `dialogue.js:165`)
   - which dialogue options appear (`talkTo` nodes)
   - spawn hostility of whole zones
   - Ego-scaled rep gain (§2.2)

### 2.2 Attributes: STR exists, add AGI / TOU / INT / WIL / EGO

**Today:** `p.str` is a single number (`player.js:19`). Gear and crystals bake changes into it (`wear` 50, `items.js:510`, `effects.js:26`, `dialogue.js:239`, `npcs.js:210`, `leveling.js:76`).

STR is read in four places:
- `strNeeded` checks (`items.js:228-231`, `inventory.js:80-82,117,201-203`)
- melee damage `+(str−need)/2` (`monsters.js:759`)
- HUD (`hud.js:57,122`)
- the inventory header (`inventory.js:165`)

**Model:**
- `p.attr = {str, agi, tou, int, wil, ego}` stores the base values.
- `attr(p, k) = p.attr[k] + bonus(p, k)` gives the effective value. Stop baking: delete the `str` line in `wear()` and the special case in `takePerk`.
- `mod(p, k) = floor((attr − 16) / 2)` is the Qud modifier. Bonus keys `agi, tou, int, wil, ego` then work for free on any gear, perk, mutation or implant.

**Where each attribute hooks in:**

| Attr | Hook points (existing code) | New uses |
|---|---|---|
| STR | `strNeeded` gates (inventory 80-82, 117); damage (`monsters.js:759`); bomb throw distance (`throwing.js:46`) | carry weight (none exists), forcing doors and smashing crates, penetration vs monster `armour` (`soak` 739) |
| AGI | crit chance (`monsters.js:756`); swing speed (`attackTime`, `player.js:63-66`); thrown-knife crit (`throwing.js:132`); `throwAtNearest` auto-hit (79) | **to-hit roll** (none exists, `attackMonster` 747) against the monster's DV; **dodge**: the player's DV against monster hits in `hitPlayer` 509-521, before armour; jump/sprint (`player.js:8,165`) |
| TOU | max HP: `makePlayer` 19, `gainXp` +3/level (`leveling.js:51`) → `+max(1, 3+mod)`; poison ticks (`effects.js:149-158`, replacing thickBlood); fall damage (`player.js:179-184`); regen (`effects.js:161`) | saves vs venom (`monsters.js:533-536`), paralysis (`effects.js:56-58`), disease |
| INT | identifying: `itemAura` (`items.js:345-350`, now the scholar perk); Pell's identify service (`dialogue.js:189-192`) | skill points per level; examine and tinkering (identify artifacts by examining); more perk choices (`offerPerks` 61-68) |
| WIL | regen (`effects.js:161`); status durations: paralysis 5 s, darkness 40 s (`effects.js:56-63`) | **mutation cooldown reduction**; mental-mutation saves |
| EGO | prices: `haggle` (`dialogue.js:165`), `sellPrice` (`items.js:470`), shrine cost (`gen/dungeon.js:382`) | **mental mutation level** bonus; rep gain multiplier; follower limit (beguiling, proselytizing) |
| XP | `xpToNext` (`leveling.js:43`) does not depend on attributes | attribute points every few levels, mutation points per level for mutants, license points for True Kin |

**Note on to-hit in 3D.** Today, in real time, aiming *is* the hit test. A design that stays fair in both views:
1. 3D geometry (or a map bump) picks the target.
2. Then the same `rollHit(attacker, target)` decides hit, miss or graze. A miss shows a "miss" damage number in both views (`game.effects` damage entries).
3. Apply the same roll to monsters attacking you (`monsters.js:474-481`), so DV and dodge matter in both views.

**UI for attributes:**
- a character sheet (new)
- the status bar (`hud.js:122`) and inventory header (165) should show the important attributes or be compact
- `strNeeded` becomes `attrNeeded(it) → {str: n}`, since Qud weapons are mostly gated by skills rather than STR

### 2.3 Mutations (active abilities with cooldowns, passive bonuses)

**Data:** a `MUTATIONS` table:
- `{ id, name, kind:"physical"|"mental"|"defect", cost (creation points), maxLevel, info(lvl), passive?(lvl, p) → bonusObj, active?: { cooldown(lvl, p), target:"self"|"dir"|"tile"|"creature", range, use(game, lvl, target) }, excludes?:[ids], startItems? }`

**Player state:** `p.mutations = {id: level}`, `p.cooldowns = {abilityId: seconds}` and `p.mp` (unspent mutation points).

**Hooks:**
- **Passives:** extend `bonus()` (`player.js:38-43`) with a third loop over `p.mutations`, calling `MUTATIONS[id].passive?.(lvl, p)[key]`. Every existing bonus key then works: carapace gives `armour`, quills give `thorns`, multiple legs give `speed`, night vision gives `darkSight`, regeneration gives `regen`, and so on.
- **Cooldowns:** tick in `tickEffects` (`effects.js:134`). That one function already runs on game time in 3D (`game.js:285`) and per map action (`turns.js:44`), so cooldowns stay fair across views, scaled by WIL.
- **Activation:**
  - In 3D, digits `1-9` are unbound in `onKeyDown` (`game.js:535-544`). They're only used inside the levelup/talk modes, and the map's diagonals use Numpad.
  - On the map, the same keys, with the time cost charged through `mapUseTime` (as `game.js:494-497` does for quick-heal and throwing).
  - Plus an ability menu screen.
- **Targeting:** 3D reuses the aim vector, as `throwReady` does (`throwing.js:44-45`). The map needs a new **target mode**: a cursor moved by keys or the mouse (`mapView.hover`, `renderMap.js:15`, `tileAtCell` 248-251) with Enter to confirm. Today `throwAtNearest` (60-81) auto-targets.
- **Effect code reuse:**
  - projectiles and elements for flaming hands / freezing ray (`throwing.js` + `ELEMENTS`)
  - the shock arc (`monsters.js:792-804`) for electrical generation
  - flight (`p.flyTime`, `effects.js:29-33`) for wings
  - teleport (`effects.js:94-101`) for teleportation
  - stun / blind / chill on monsters (`m.stun/blind/chill`) for stunning force and the like
  - `revealFloor` and `sense` for clairvoyance and sense psychic
  - the voxel `floor.set` + `refresh()` for burrowing claws (dig), which is a natural fit for the voxel world
  - `bodyCollides` (`player.js:106-116`) for phasing
- **Defects** are just negative passives or hooks (for example albino means hurt under `floor.hasSky` sky light, through `light.js`).
- **Keep the house twist:** "planar" mutations that interact with the 2D/3D rule, such as seeing flat beings without the map, or *Fold* (which today is the foldingStrike perk and the Mantle relic).

### 2.4 Implants (body-slot equipment)

**Today:** slot equals kind (`inventory.js:86`), and `worn()` lists exactly 4 fields (`player.js:35`).

**Generalize:**
- **Body model:** `BODY_PARTS` such as `head, face, body, back, arms, hands, feet, finger×2, neck`, plus a parallel **implant socket** per part.
- **Equipment:** `p.equip = {part: item}` and `p.implants = {part: item}`.
- **Kinds:** an `ITEM_KINDS[kind].slot` (or `it.slot`) decides the target part.
- **`worn(p)`** returns all equipped items plus implants, so `bonus()` picks them up automatically.
- **`itemBonuses`** (`items.js:217-225`) gets an `IMPLANTS[id].bonus(level)` branch, like rings and amulets. Actives can reuse the mutation ability interface.
- **Rules:** implants install only at a **becoming nook** (a new block flag plus a `useBlock` branch, `interact.js:66`) or with a surgeon NPC. A surgeon fits naturally as a services row in `dialogue.js:services()` (167-197). Implants cost **license points** (True Kin only) and can't simply be unequipped: reuse the curse lock in `equip` (88-91). True Kin get no mutations and better attributes.
- **Screen changes:** `drawInventory`'s fixed slot rows (`inventory.js:182-186`) become a body/paperdoll list. That needs scrolling.

### 2.5 Switching the currency to fresh water

**Model:**
- Liquids live in containers: `{kind:"container", id:"waterskin", liquid:"water", drams, cap}`. Qud also has pure vs. mixed liquids (salt, oil, acid, blood, honey, slime…).
- "Money" is the total drams of fresh water across containers. Spending drains them, and earning fills them (overflow is lost, or you need more skins). This gives **a weight/capacity tension** the gold model lacks.
- Optional: thirst, ticked in `tickEffects`. Drinking fresh water uses the same supply.

**Every gold touch point to convert:**
- player field `gold` (`player.js:19`)
- pickup `items.js:512`
- the `gold` kind in art, name and glyph (`items.js:245, 316, 336`)
- drops `monsters.js:678`
- floor loot `gen/dungeon.js:274, 736`
- vault `$` (`gen/vaults.js:393`)
- shop (`dialogue.js:224-271`, the "gold" strings at 224, 228, 234, 240, 247, 259, 269)
- shrines (`npcs.js:166-170, 457-462`)
- `giveGold` (`npcs.js:255`) and quest rewards (310, 372, 408, 428, 433)
- HUD `$` (`hud.js:124`)
- legend (`renderMap.js:216`)
- the "gold" sound (`sfx.js:148`; add a slosh sound)

`itemPrice` values (`items.js:452-468`) can stay as numbers, read as drams. Replace `priceFactor(depth)` (469) with a zone-tier factor.

**World integration:**
- The voxel world already has `WATER_SHALLOW` / `WATER_DEEP` blocks (`world.js:35-36`) and lakes (`addLake`).
- Add liquid identity, as more blocks or a per-column liquid map, so pools can be **filled from** (an E interaction), and make fresh water rare (brackish and salt pools are common).
- The unidentified-potion system (`POTIONS` + shuffled colours) carries over well as Qud-style "tonics" / unknown artifacts.

### 2.6 Generated quests and dialogue

**Today:** every quest is hand-coded per NPC type inside `talkTo` (`npcs.js:283-493`). The quest record has only `{id, title, text, done}` (88-92), and the only event is `bounty` (105-112), fired from `killMonster` (`monsters.js:694`).

**Needed:**
- **`QUEST_TEMPLATES`:** fetch artifact from landmark, kill a named creature, find a lost villager, deliver an item to another village, explore or map a zone (Mira's `mapPercent` generalizes), find the source of a problem, escort, and the water ritual / secret trade.
  - A generated **quest instance** looks like `{id, template, giver:{zoneKey, npcUid, faction}, target:{zoneKey, entityUid|itemUid|landmarkId}, reward:{drams, item, rep:{faction:n}}, stage, text()}`.
- **Event bus:** `game.emit(type, data)`, fired from:
  - `killMonster`
  - `pickUpItems` (`items.js:498`)
  - `enterFloor`, which becomes enterZone (`game.js:217`)
  - talk and item hand-over
  - Quests subscribe to it. This replaces the single `game.questEvent` (`game.js:112`).
- **Stable IDs:** monster and NPC ids are module counters (`monsters.js:334`, `npcs.js:70`). Cross-zone quests need ids that are **deterministic per zone seed** (for example `zoneKey#n`), so a quest can point at a creature in a zone that hasn't been generated yet.
- **Dialogue generation:**
  - Keep the node contract.
  - Write *builders* that compose nodes from the NPC's faction, religion, personality, role (merchant, quest giver, priest, villager), the rep band and the world history.
  - `RUMOURS` (`npcs.js:268-281`) becomes a generated "gossip" pool drawn from history facts and nearby landmarks. That's the cheapest high-value Qud feature.
- **Journal:** needs categories (quests, locations, gossip/lore, recipes), scrolling and world-map markers (`dialogue.js:290-309`).

---

## 3. Parts tied to the Rotation Cube story

| Coupling | Where | Suggested fork action |
|---|---|---|
| **Hollowmere / Temple of Angles (depth 0)** | `story.js:16-26, 46-131`; `gen/dungeon.js:23` (`depth===0 → buildTemple`); `gen/dungeon.js:757` (return point by Maren); `hud.js:64` ("THE TEMPLE OF ANGLES"), `hud.js:117` ("TEMPLE"); `music.js:23,67` (temple mood at depth 0) | Replace with the starting village (a fixed landmark). Keep `buildTemple` as an example of a hand-drawn zone. |
| **Maren** | `npcs.js:48-49, 289-322` (main quest giver); `sfx.js:181` (also the fallback voice, 203) | Remove, or make her a priestess NPC in one village. Change the voice fallback to something neutral. |
| **Vorlath / Lich King** | `monsters.js:251-271` (`lich`, `boss:true`), `bossPhase` 562-583, taunt 603, `killMonster → game.win()` **695**; `gen/vaults.js:275-295` (BOSS_VAULT), 374-378 (`B` letter); `hud.js:146-149` (boss bar), `hud.js:56` (victory text); `music.js:65` (boss mood); `renderMap.js:226`; `story.js:29-44` (TAUNTS, FINAL_PAGES, EPILOGUE); `game.js:65-70, 221-222`; `npcs.js:276-277, 308, 319, 335` | Turn `boss: true → game.win` into a campaign hook (`campaign.onBossDies`). The Lich can become a legendary at a fixed deep landmark. |
| **FINAL_DEPTH = 20 win condition** | `world.js:9`; `effects.js:48` (descent warded); `throwing.js:176`; `hud.js:66-69, 117` (`DEPTH n/20`); `gen/dungeon.js:166-183, 232, 252` (no holes and no stairs on the last floor); `gen/vaults.js:334`; `validateFloor` `gen/dungeon.js:865-871` | Make it a per-dungeon property (`dungeon.maxDepth`), not a world constant. The run's win condition moves to the campaign. |
| **The cube unlocking Tab** | `game.story.cube` `game.js:54, 74, 193, 376-379`; `rotate` mode `game.js:328-342` and `onCube` 73-83; `items.js:246, 272, 317, 337, 513` (`cube` kind); `story.js:134-137`; `music.js:70` (forced flat), `playCubeTheme` 192-221; `game.js:583` (sfx flat); `renderMap.js:181-183` (header) | Default `story.cube = true` (both views from the start, which the design rule needs), or make the cube a fixed legendary artifact and quest that unlocks 3D. Either way, gate it through a campaign flag. |
| **Guardians on floors 5/10/15** | `gen/vaults.js:297-338` (`pickVault` is indexed by depth); `game.js:88-111`; `leveling.js:34` | Move them to fixed landmark dungeons, for example each guarding a relic. |
| **Linear vault order** | `pickVault` `gen/vaults.js:332-338` (`depth−1` selects the vault) | Pick vaults by region/tier from a seeded rng. |
| **The run's encounter plan** | `npcs.js:118-134` (depths 1-18, Pell every 4 floors, Corwin/Ess/Tee/Brann/Mira/Rook/Lio) | Keep these as "dungeon encounter" templates, reparented to dungeon floors. Corwin ("Hollowmere watch", 353) and Lio ("the temple… Maren", 439) need their text changed. |
| **Pell hard-wired as the only merchant** | `dialogue.js:159-277` ("PELL'S PACK" 258, log strings); `leveling.js:27` (haggler text) | Use `game.shop.npc`'s name and faction. Use a merchant stock template per faction. |
| **Story-flavoured relics and perks** | `items.js:183` (Hollowmere's Oath), 195-198 (Mantle of Angles = Tab, Eye of the Cube), 199 (Brann's Lantern); `leveling.js:33` (Folding strike = Tab) | They still work mechanically. Rename and re-lore them, and move them into the fork's artifact pool. |
| **Branding and start** | `hud.js:30` ("THE ROTATION CUBE" pause title), `index.html` `<title>`; `startRun` `game.js:176-208` (depth 0, map view, INTRO pages); `sfx.js:15` / `music.js:36` localStorage keys `rotation-cube-*` | Add a new title and an entry flow (character creation, then the start zone). Rename the storage keys so the fork's settings don't collide. |

**Recommendation:** introduce a `campaign` object that owns intro pages, the start zone, story flags, the win and loss hooks and TAUNT-like zone messages. Make the Rotation Cube content one optional campaign module, or a set of fixed landmarks, so nothing in the core systems mentions it.

---

## 4. UI screens

### 4.1 How screens are drawn

- **The grid.**
  - `screen.js` holds a `cols × rows` grid of `{char, rgb}` (`screen.js:7-26`). The API is `put`, `text`, `blank`, `clear`, `rampChar`, `tint` and `cellAt` (21-51).
  - `screen-canvas.js` stamps cached glyph bitmaps. The width is capped at `MAX_COLS = 180` (`screen-canvas.js:3, 17`), so expect about 180 columns on a desktop and fewer on narrow windows. The row count follows the aspect ratio.
- **Frame order** (`game.js:362-372`):
  1. `story` mode draws full-screen and returns.
  2. Otherwise the world view draws (map or 3D).
  3. `drawHud`.
  4. The modal overlay for the current mode (inventory, talk, shop, journal).
  5. `S.present()`.
- **Idiom for a modal screen:**
  1. Size the box: `w = Math.min(S.cols − 4, 80..86)`, plus a height.
  2. Centre it: `x0 = (cols − w) >> 1`.
  3. Clear and frame it: `S.blank` the box, then draw `-` rules at the top and bottom (`dialogue.js:32-35`; `inventory.js:161-163`).
  4. Draw the content: `S.text(x, y, str, r, g, b)`.
  5. Record the layout in a module-level object for mouse hit-testing (`inventory.js:13`, `dialogue.js:43`, `hud.js:76`).
- **Input:**
  - Each mode gets a branch in `inputHandlers.onKeyDown` (`game.js:511-545`) and `onMouseDown` (546-559).
  - Opening a screen sets `game.mode` and calls `unlockPointer()`. Closing returns to the saved mode, and 3D re-locks the pointer (`dialogue.js:37-40 leave()`).
  - Time is paused in every mode except `explore` and `map` (`game.js:323-358`).
- **Missing widgets:** a scrollable list, a tab bar (only the shop's ad-hoc one exists), a full box border, a text-entry field (needed for naming a character) and a shared word wrap (two copies today). Build a small `ui.js` with `box(x,y,w,h,title)`, `list({items, sel, scroll, render})`, `tabs()`, `wrap()`, `textInput()` and `hit-test registry` before adding the new screens.

### 4.2 Screens that exist

| Mode / screen | Code |
|---|---|
| title/pause overlay | `hud.js:28-41` |
| explore (3D) and its crosshair label | `render3d.js`, `hud.js:13-21` |
| map, with legend and hover inspector | `renderMap.js:53-187, 189-245, 255-283` |
| inventory | `inventory.js:155-230` |
| level-up perk choice | `hud.js:78-111` |
| descend interstitial | `hud.js:62-69` |
| story pages | `dialogue.js:313-342` |
| rotate (camera move) | `game.js:328-342` |
| talk | `dialogue.js:126-156` |
| shop (buy/sell/services) | `dialogue.js:252-277` |
| journal | `dialogue.js:290-309` |
| dead and won overlays | `hud.js:42-61` |

### 4.3 New screens the fork needs

1. **Character creation** (a `create` mode before `startRun`). This is a wizard, and each step is a list screen:
   - genotype: Mutated Human or True Kin
   - calling or caste (sets starting gear, attribute bonuses and skills)
   - attribute point-buy over the 6 attributes, showing the derived HP, DV and modifiers
   - mutations (point-buy with defects that give back points) or implants (choice by license points)
   - starting village
   - name (needs text input)
   - seed

   Then `startRun(seed, character)`. Today `makePlayer()` takes no parameters (`player.js:16`).
2. **World map** (overworld). This is a new renderer, separate from `renderMap` (which draws one zone).
   - It draws a grid of world cells with terrain glyph and colour, landmarks, villages, discovered and undiscovered state, quest markers and your position.
   - Travel on it moves zone by zone and costs time; random encounters happen on the way.
   - Bind it to a free key (U / L / O; see the key list below), and also open it by walking to a zone edge.
3. **Factions / reputation:** each faction with a rep bar, an attitude label, its religion, what it likes and hates, and known lore. It's a scrollable list with a detail pane.
4. **Character sheet + mutations/implants:**
   - attributes and modifiers, AV/DV, resistances
   - mutations with level and cooldown (and spending mutation points)
   - the implant/body-part paperdoll
   - perks and skills, and spending attribute and skill points
   - Tabs make sense here.
5. **Examine / look:** a full-screen description for items (lore, all bonuses, comparison against what you wear; `itemInfo` is a single line today, `items.js:360-380`, cut to the box width at `inventory.js:226`) and creatures (faction, attitude, difficulty, resistances from `resistText`, `monsters.js:306-313`).
   - In 3D, open it with a key on the crosshair target (`lookTarget`).
   - On the map, open it from the hover tile (`describeTile`).
6. **Trade (generalized shop):** any merchant, prices in drams, rep and Ego price modifiers, both sides visible, and **water ritual** and services. Reuse `dialogue.js` shop internals without "Pell".
7. **Ability bar / menu** for mutation and implant actives, with cooldowns. Show a compact row on the HUD.
8. **Message log** (history beyond the 5 lines shown), **journal tabs** (quests, locations, gossip) and **map targeting mode** (§2.3).

**Free keys today.** Used keys are listed in `game.js:486-498, 535-544`, plus `C`/Ctrl for flying down in `player.js:164`. Free: B, G, H, K, L, O, P, U, V, Y, Z, Digit1-9, comma, slash.

---

## 5. Recommended content architecture for the fork

1. **Content registries (`src/content/`):** one table per concept, each with a uniform hook shape, replacing scattered `switch`es.
   - `items/kinds.js`: an `ITEM_KINDS` registry. Each kind provides `{ stack, slot?, glyph(game,it), name(game,it), info(game,it), price(it), use?(game,it), art, palette(game,it), onPickup?(game,it) }`. `itemName` and the rest become one-line dispatchers. Keep `WEAPONS`, `ARMOURS`, `PROPERTIES`, `RINGS`… as sub-tables. Add `MISSILE_WEAPONS` (bows, guns: projectile pipeline), `TONICS`, `LIQUIDS`, `CONTAINERS`, `ARTIFACTS` and `FOODS`.
   - `creatures.js`: today's `MONSTER_TYPES` plus `factions`, `tier` (replacing `depths`), `regions` (where it spawns), `inventory`/drops, `dialogue?` and `brain`.
   - `mutations.js`, `implants.js`, `factions.js`, `religions.js`, `perks.js` (today's PERKS) and `statuses.js` (§1.9).
   - `quests.js` (templates), `dialogue/` (builders) and `history.js` (world-history and gossip generators).
2. **One aggregation point:** keep `bonus(p, key)` as *the* stat bus. Feed it gear, implants, mutations, perks and statuses, and derive every number from `attr()`, `mod()` and `bonus()`. Never bake into base stats (remove `wear()`'s baking). The documented bonus-key list moves next to the registry, so undocumented keys (`undeadHeal`, `sunder`, etc.) get listed.
3. **One creature entity:** monsters and NPCs share `spawnCreature`. Components cover talk, merchant, quest giver and follower. `faction`, `attitude()` and `target` replace "always chase the player". Combat functions take `(attacker, target, source)`.
4. **World layer (`src/world/`):**
   - **Fixed world:** a constant `WORLD_SEED` plus a hand-authored `LANDMARKS` table with fixed world coordinates (capital, holy sites, ruins, legendary lairs, the starting village). It also holds region polygons and biome noise. **The world map layout is identical every run**, as the user asked.
   - **Per-run variety:** the run `seed` drives village inhabitants, minor sites, loot, quest instances and history details. Zone seeds come from `hash(seed, wx, wy, z)` (`rng.js:24-29`, `makeRng` 2-21).
   - **Zone = Floor.** Keep the 48×48×10 voxel `Floor`, so all of the 3D renderer, light, pathing and map work unchanged.
     - `game.floors` (`game.js:44`) is keyed by `zoneKey = "wx,wy,z"` instead of depth.
     - `game.depth` becomes `game.zone {wx, wy, z, region, tier}`.
     - Every `depth`-as-difficulty use takes `zone.tier` instead: `pickMonsterType`, `rollElite`, `spawnMonster`, `randomEquipment`, `maxTierAt`, `priceFactor`, shrine cost, `TAUNTS`. About 30 call sites; grep `depth`.
   - **Surface zones:** a new `gen/surface.js` builds a heightmap from `noise2` with sky (`hasSky`, `light.js`), biome blocks (sand, salt crust, jungle grass, brinestalk, ruins) and village stamps through `stampVault`'s legend (`gen/vaults.js:1-25, 342+`). New `arrivalPoint` modes `"edge-n/s/e/w"` (`gen/dungeon.js:756`) handle zone-to-zone walking, triggered in `checkFloorEvents` (`game.js:152-171`) when the player crosses the border.
   - **Dungeons:** stairs in landmark or random surface zones lead down to the existing `generateFloor(seed, depth)`. Pass a dungeon descriptor (theme blocks from the region, creature pool from region and faction, `maxDepth`, landmark boss vault). Vaults, secret rooms, spike traps and the 2D/3D puzzle rules all carry over. Keep `validateFloor` and extend `test.html` with surface and world checks (landmarks at their fixed coordinates, every village reachable).
5. **Event bus and campaign:** `game.emit(event, data)` feeds quests, reputation, achievements and campaign scripts. `campaign.js` defines the intro, start zone, main questline and win. The Rotation Cube story is optional content (§3).
6. **Persistence:** a big overworld needs **save and load**, which doesn't exist today because a run is reproducible from its seed. Store visited zones as `seed + diff` (changed blocks, items, killed creatures, NPC state) in IndexedDB. A raw `Floor` is 23 KB of blocks plus maps, so localStorage won't do. Dialogue closures are built on demand, so they don't need saving.
7. **Keep the house identity:** both views must matter (user memory note).
   - Flat beings become a whole region or faction ("the Plane") that you can only meet on the map.
   - Dark-only ghosts, runes and religions of the dark.
   - Mosaics and murals are how villages record their history, readable only from above. That's a lovely fit for Qud-style generated lore.
   - Height-gated legendaries (Colossus-style).
   - Use `music.js`'s flat/deep crossfade and `sfx.js` made-up voices per species and faction for regional flavour.
