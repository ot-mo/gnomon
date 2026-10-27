# WS6: factions, reputation, dialogue (6a) · trade, the Kindling, backings, voices, shrines (6b)

Phase 1 workstream (TECH_DESIGN §8.3 "WS6a", "WS6b"; DECISIONS: genotypes `bent` / `plumb`, the bonding rite is
**the Kindling**, combat d20, glim with no liquid backing). Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws6`, branch
`ws/ws6`, from `p0-done`. WS6a's files (§8.4): `factions.js`, `talk.js`, `social/index.js`, `social/reputation.js`,
`social/builders.js`, `screens/factions.js`, `content/factions.js`, `tools/check-social.mjs`, `tests/checks/social.js`.
Gate numbers, deviations and the verification: `docs/sessions/ws6.md` "Part 6a".

Nothing WS6a adds touches the old game: no legacy creature has a faction, so every legacy monster is still out for
you and for nobody else, every legacy person is neutral, and the rep handlers return before doing anything for a
creature without a membership (golden, the screen frames, the legacy fights and the bot hold).

## Public API (6a)

### `factions.js`

```js
registerFaction(id, def)   // FactionDef: { id, name, temperament, startRep: n | { bent, plumb }, parent?, likes: [[id, why]],
                           //   hates: [[id, why]], relations?, pilgrimFloor = true, hidden?, group?, color, glyph, liquid,
                           //   rite, voice, about, likesToo?, hatesToo?, flat?, homeRegions }; relations filled from likes
                           //   (+1) and hates (−1) where the def doesn't give them
FACTIONS                   // the registry (content/factions.js fills it: 22 factions and 9 hidden groups)
REP_BANDS                  // ["hated", "disliked", "indifferent", "liked", "loved"] (ids)
BAND_NAMES                 // { hated: "Dark", disliked: "Cold", indifferent: "Grey", liked: "Warm", loved: "Bright" } (UI)
REP_MIN, REP_MAX           // −1000, +1000
band(rep), bandName(rep)
baseRep(game, id)          // the start for game.player.genotype (no genotype: Bent), 0 or above in a Pilgrim run
                           //   (game.state.mode === "pilgrim") unless pilgrimFloor: false (the Askew; WS7's Hour cults)
repOf(game, id)            // game.state.rep[id] ?? baseRep: state.rep holds only what has moved
addRep(game, id, n, reason) → rep   // clamped; emits "rep" { faction, n, from, rep, reason } when it moved
membershipsOf(c) → [[id, w]]        // c.faction ({ id: weight }) else the type's `factions` (a list or { id: w })
relation(f, g) → −1 | 0 | 1         // f's relation to g, else to g's nearest parent group it names, else f's parent's
followsPlayer(c), bandToward(game, c)
attitude(game, a, b) → "hostile" | "wary" | "neutral" | "friendly" | "unaware"
```

`attitude`, in order: a === b friendly · (more than 6 leaders deep, a cycle only a bug makes: neutral) · you:
friendly to your followers, hostile to whatever is hostile to you, else neutral · a follower: friendly to its leader
and its leader's other followers · **house rule** (neither is you; followers too): flat against deep → unaware; a
ghost against a non-ghost → unaware unless both see in the dark (`darkSight` on the creature or its type; ghosts do)
· a follower: hostile on its own grudge, else its leader's attitude (yours: hostile to what is hostile to you) ·
grudge (`brain.grudges[id]`, yours is `"player"`) → hostile · **WS8 #2**: hostile to you →
hostile to your followers · toward you: no membership → the parent's rule (people neutral, monsters hostile); else
§2.11's table on the band (a hated membership of weight ≥ 0.25 wins, else the weighted mean) × temperament
(`brain.temperament`, else the type's, else the first faction's) · creature against creature: a shared faction →
friendly; any −1 → hostile; any +1 → friendly; else neutral. A talker that can't be struck (no `hp`) is **wary**
where a fighter would be hostile, and a creature's faction hatred of such a talker reads neutral (creatures can't
touch it either; a grudge or WS8 #2 can still make it hostile). Legacy creatures have no membership, so the parent's
attitudes hold everywhere but one place: a ghost and a dark-sighted creature (the Gloom Warden, the Lich King,
Brann) were "unaware" of each other in P0 and are "neutral" now; only `witnessesOf` tells the two apart.
Grudges don't expire (a villager you struck stays out for you); `addRep` rounds halves away from zero.

### `social/reputation.js` (subscribed on load)

```js
REP_RULES = RULES.rep = { witnessRange: 12, attackPenalty: -10, killPenalty: -5, namedKillPenalty: -50 }
offender(game, e)                  // you, or a creature with brain.leader === "player"
witnessesOf(game, by, victim)      // the victim's fellows within 12 tiles of `by` who perceive it
offend(game, by, victim) → { witnesses, rep }
killed(game, by, victim) → { [factionId]: rep }
```

- **"hurt" / "attack"** (a blow, landed or missed; not one that couldn't touch): by an offender on a member not
  already hostile to you → the victim and each witness get grudges (`player`, and the follower's id); if anyone but
  the victim saw it, each of the victim's factions pays `attackPenalty × weight` and the log says "Hollowmere saw you
  strike the reed-cutter.". The grudge makes later blows free (the victim is hostile now).
- **"kill"**: by an offender → `killPenalty × weight` (`namedKillPenalty` for `c.named`, the type's `named`, or any
  talker) with each faction of the victim; each other faction that hates one of them (directly or through a parent
  group: the Assize hates Hollowmere through the Bent) gains half, rounded toward zero; `repOnKill` on the creature or
  its type adds its own (legendaries). A kill needs no witness. **A kill or blow without a source moves nothing.**
- WS8's `creatures.witnessesOf(game, e, r)` is used automatically once it exists (namespace import); until then
  line of sight from the witness's eyes.

### `social/builders.js` (registered on load)

```js
ROLES = ["villager", "priest", "guard", "wanderer", "merchant"]   // dialogue ids: c.talk.dialogue = role
buildDialogue(role) → (game, c, { first }) → node
standingOf(game, c) → { faction, def, band, name, attitude }      // its heaviest membership; how it sees you
checkNode(node, path) → [problem]   walkDialogue(game, c, { depth = 4, max = 60 }) → { nodes, problems }
```

What a role says follows its attitude and its main faction's band: refused (only "Leave.") at Dark or when it is a
fighter out for you; curt at Cold or when wary of you (a talker who can't fight, at Cold, or one bearing a grudge;
a merchant won't open the pack); plain at Grey; glad at Warm; kin at Bright. Options:
"Who are you?", a role question (rumours for a wanderer, the road for a guard, …), "Tell me about <faction>." (the
bible's lore with its likes and hates and their reasons), "How do your people see me?" (the band's light word), and
for a merchant "Show me what you have." → `{ shop: "buy" }` while `talk.state.stock` has anything (WS6b replaces it
with `openTrade`).

### `screens/factions.js`

`MODE = "factions"`, `openFactions(game)`, `knownFactions(game)`, `drawFactions(game)`. **P** in either view
(§4.3). Known: rep moved, a start other than 0, or a member within 10 tiles (`game.state.knownFactions`, marked
once a second in play by the update `factions:known`).

### `content/factions.js`

`FACTIONS` (the 21 of bible §15.4 and `bentVillages`) and `GROUPS` (peoples, faiths, plane, dark, engines, beasts,
growths, askewGroup, and `bent` under peoples: Hollowmere and the Bent villages). Each faction keeps the bible's
start (Bent / Plumb), temperament, colour, glyph, sacrament, rite, voice (Hz, wave, flags) and likes/hates with
their reasons.

## Integration requests (6a)

1. **`creatures.js` and `combat.js` (WS8), major for play: mortal people.** A talker can't be struck today
   (`touchable`: `canTalk(target)` → false), and `spawnCreature` gives a talker no health, so a villager who talks
   can't be hit and the witness system only fires on faction members that don't talk. For WS7's villagers: a talker
   whose type has `hp` gets `hp`, `maxHp`, `attack` and the AI's fields like a monster, and is touchable (by you and
   by creatures) when it has `hp > 0`; legacy people (no `hp`) stay untouchable. `factions.js` already treats a
   talker with `hp > 0` as one that can fight (hostile, not wary). The map's bump on such a talker should talk while
   it isn't hostile and strike with Shift (WS8's "attack anyway").
2. **Harm without a source counts as yours (WS8 `combat.js`, WS10 `traps.js`, the integrator's `monsters.js`),
   major for the rep system.** §2.11: `byPlayer` defaulting to true "becomes an explicit source". Today it doesn't:
   - `combat.js applyDamage` defaults `src = game.player`, and `traps.js:69` calls `damageMonster` (spikes) with no
     source, so spikes hurting a faction member emit "hurt" with you as `src`: the victim and its watching fellows
     get a grudge against you and the faction pays `attackPenalty` (the review's probe: a Clatter member on spikes
     turned hostile with `grudges {"player": 1}`). `applyDamage`'s default should be `src = null` (every caller of
     yours passes `game.player`: bombs, scrolls, thrown things), and spikes pass nothing.
   - `setStatusHarm`'s kill (`monsters.js:36`) defaults to `byPlayer = true`, `src = game.player`, so a faction
     member dying of poison, burning or bleeding counts as your kill (the probe: Clatter 50 → 45, Saltbeasts −400 →
     −398). Pass the status's source (`status.src`, set where the status is given) and `byPlayer = src ===
     game.player`.
   `reputation.js` can't tell these from your own blows: the payload says `src` is you. Also the "kill"
   payload's `factions: m.factions || []` is always `[]` (creatures carry `faction`, a weight table, or the type's
   `factions`): `membershipsOf(m).map(([id]) => id)` from `factions.js`.
3. **The dependency table "WS6a witnesses" (the integrator, at the merge):** `reputation.js` switches to WS8's
   `creatures.witnessesOf` by itself once both are in; rerun `node tools/check-social.mjs` (its bot places the
   witnesses in line of sight 2-6 tiles off, a fellow behind a wall, and on the span 1,0,0 fellows in sight 11 and 13
   tiles off; WS8's sight rules should agree).
4. **`progression/chargen.js` (WS4):** `beginRun` should also apply `villageRep`:
   `if (bg.villageRep) addRep(game, "bentVillages", bg.villageRep, "background")` (the Aspirant's −50). The start by
   genotype and Pilgrim's floor need nothing from `beginRun`: `repOf` reads them from `game.player.genotype` and
   `game.state.mode` (set before `beginRun`'s `addRep`s, as it is).
5. **Body reputation (bible §10.4; WS4b mutations, WS5 implants):** when gained, `addRep(game, f, n, "body")`:
   Wings Kites +400, Shellback Clatter +200, Horns Saltbeasts +100, Lampskin Moths +200 and Lampless −200, Ink
   Glands Flatfolk +100, Flatwise Flatfolk +200 Pressed +100 Assize −200, Gills Clatter +100, Silk Glands Kites
   −100; each implant the Plan +25 up to +100 (count them in `p.flags` or similar; removing one doesn't refund).
   Wearables (feather cloak, Hour mask, Assize writ, ink stains: bible §3.5) are C4's or WS5's, the same way with
   reason `"worn"` (and taken back when unworn).
6. **WS7 (villagers, villages, quests):** villager types set `factions` (or each villager `c.faction`) and
   `talk.dialogue` to one of `ROLES`; a generated village registers its own faction with `parent: "bent"` (a Bent
   village) or `"peoples"`, so the Assize's hatred of the Bent reaches it, and its members can carry
   `bentVillages` as a second membership (weight 0.25 to 0.5) so the Assize writ and the Aspirant move them;
   quests give rep with `addRep(game, id, n, "quest")` (bible: +100 with the village, +25 with each faction that
   likes it). Grey members turning hostile in their holy places (bible §3.5) belongs to the sites (WS7 / C1).
7. **WS9 (`screens/pause.js`):** "P factions" in the pause card's key list (with L, V, G and hotbar 1).
8. **`tools/README.md` (the integrator):** the check-social row: "factions, the attitude table, rep arithmetic, the
   villager bot in both views, the dialogue builders over every talker, JSON state, the factions screen".
9. **Not built (content):** the Lantern Moths "like you while your torch is lit" (`likesToo` text only); the
   Smoothers belong to no faction and are always hostile (bible §3.5): give them no membership (the parent rule
   makes them hostile). The Hour cults (generated factions, §6.3) need `pilgrimFloor: false`.
10. **`tools/browser-0d1.mjs` (P0's; the integrator):** its mode tour fails on any registered screen it can't reach,
    so on this branch it would fail "modes never reached: factions" (nothing in `browser-shell` presses P). After
    the target block (the map reached), add:
    ```js
    // The factions screen (WS6a's): P on the map opens it; Esc closes it, and again by a click on "Esc close".
    if ((await mode()) === "map") for (const how of ["keys", "mouse"]) {
      await page.keyboard.press("KeyP");
      await frames(page, 2);
      const opened = await mode();
      if (opened !== "factions") { problems.push(`factions by ${how}: P on the map led to ${opened}`); break; }
      reached.add("factions");
      if (how === "keys") await page.keyboard.press("Escape"); else await click("Esc close");
      await frames(page, 2);
      const closed = await mode();
      if (closed !== "map") problems.push(`factions by ${how}: ${how === "keys" ? "Esc" : "a click on Esc close"} led to ${closed}`);
    }
    ```
    (`tools/browser-ws6.mjs` does the same by keys and mouse at 1280×720 and 600×330, and passes.)
11. **§8.4 (the integrator):** `tools/browser-ws6.mjs` as WS6's, and a `tools/README.md` row for it ("serve with
    `node tools/serve.mjs 8646`; the factions screen in both views, a villager struck with witnesses, a builder's
    priest").

## Public API (6b)

DECISIONS applied throughout: glim is a counter (no liquid backing, no container backs money); liquids are the
factions' sacraments and the base of tonics; the bonding rite is the Kindling, one rite per view. Everything new is
plain JSON under `game.state` (`kindling`, `snuffer`, `donations`) or on the creature (`talk.state.stock`,
`stockedAt`).

### `social/merchants.js` (trade; `RULES.trade`)

```js
openTrade(game, c, tab = "theirs", { onPop })   // the trade screen: theirs / yours / services (registerService rows)
priceOf(game, it, trader, side)   // "buy": worth × priceLevel(trader.level) × stats.priceMul(buy, the trader's step)
                                  //   × 1.2 for the Snuffer; "sell": worth × priceMul(sell); a filled vial sells as glass
repStepOf(game, c)                // bible §3.1: Warm +0.1, Bright +0.2, Cold −0.1 (main faction, standingOf); none: 0
priceNote(game, c) → { ego, step, buy, sell, text }   // "EGO +2 · Warm −0.1 · buy ×1.20 · sell ×0.45" on the screen
tradeRows(game, c, tab) · tradeRow(game, c, tab, row) → { ok, line, offer? }   // offer "theirs": a full flask refused a sale
registerStock(id, (game, c, rng) → [{ item, count, price, best? }])   // c.merchant.stock names it; default "general"
ensureStock(game, c) · restock(game, c) · bestStock(game, c) · isMerchant(c) · snuffed(game) · restockSeconds()
```

- **Prices** follow bible §3.1 only under the attribute set: `RULES.stats = "legacy"` (today's default) keeps the
  parent's prices, as `stats.js priceMul` always did, so EGO and rep show in the multiplier line but move nothing until
  the flip.
- **Stock**: a builder's merchant (`talk.dialogue = "merchant"`) or any talker with `merchant` is stocked on its first
  look, seeded by (run seed, the merchant, the world day): potions, knives, bombs, empty vials, its faction's sacrament
  in vials, gear, an unknown potion and scroll, and a back-shelf piece four levels up shown only at Bright.
- **Restock** on `zone:enter` (not a load) after `away` ≥ 2 world days (2 × 1,440 s); **the legacy Pell is never
  restocked** (the parent rolled his pack once) and keeps his own `shop` screen (his services list `registerService`
  rows there; `openTrade(game, pell, "services")` shows the same six).
- A sale the flask can't hold is **refused whole** and the screen turns to the trader's goods (bible §3.1).

### `social/ritual.js` (the Kindling; `RULES.kindling`)

```js
openRitual(game, c, { onPop })     // the flame-kin menu (screens/ritual.js)
RITES = { tracing, lighting, snuffing }   readingsOf(factionId) → { set: Set<"flat"|"deep"|"dark">, only }
canKindle(game, c) → null | why    riteReady(game, c, rite) → null | why    performRite(game, c, rite) → { ok, text, changes }
opinionsOf(game, c) → [[factionId, "loves"|"likes"|"dislikes"|"hates", why]]   // c.opinions, else made (see the file)
kin(game, c) · kinKey(game, c) · ritualRows(game, c) · ritualRow(game, c, row) · recruitCost(game, c)
```

- **Each rite is ready only in its view**: the Tracing on the map beside them (1 ink from a vial, or 1 glim); the
  Lighting in 3D, torch lit, within 2 tiles and facing them (1 glim); the Snuffing in 3D with the torch out, in the
  dark, within 2 tiles (an hour: 60 s of game time through `skipTime`, broken by a threat). All three need you on one
  level and in sight of each other. Talk offers "Will you kindle with me?" to a **named** talker of a faction (c.named,
  its type's `named`, a legend or a boss), not hostile, rep > −250; the answer lists only the rites ready where you
  stand. "X only" factions take only that rite; "none" (the Askew) can't be kindled.
- **The bond** (bible §3.3): opinions ±40 / ±80, own reading +40, its sacrament poured +20, gains × (1 + 0.1 × EGO
  mod), XP `kindling` (WS4's `xpReward` when merged, else 0.08 × lvlXP). Later rites: +20 with Warm Hands (perk key
  `warmHands`) within the cap.
- **The menu**: readings and rumours from `game.state.journal.secrets` (+35 / +60, each sold once; a faction wants its
  own reading kinds unless its def has `buys: { readings, topics }`), asking for one of `c.readings` (−40, through
  WS7's `learnSecret` once it isn't a stub), powers in `c.teaches` (leveling.js `takePerk`, −50/−100/−150 by rank),
  recruiting (WS8's `ai.recruit` when present; 2 Kindled followers, 3 at EGO 20), the best item (merchants; once per
  pack). +120 net per creature; no cost below −250.
- **Oathbreaking**: a "kill" of a flame-kin with you as the source and not `splash` → −120 with every faction, the
  Moths to −600, `game.state.snuffer = { at, until: +7 world days }` (prices +20%, nobody kindles).

### The rest

```js
voiceFor(c) → voice | typeId | null      // social/voices.js: c.voice, else the main faction's { pitch, wave, thin, ghost,
                                         //   stone, flags } (a Hz range gives each speaker its own pitch), else the
                                         //   legacy person's type id (sfx.js's own voice), else the type's `voice`
liquidAt(zone, x, y)                     // social/liquids.js: zone.liquids[x + y × zone.w], else zone.liquid, else "water"
liquidDef(id) · sameLiquid(a, b) · liquidName(id) · sacramentOf(factionId) · isSacrament(factionId, liquidId)
drinkLiquid(game, e, id) → line          // bible §13.7 with the statuses the game has (new status "nightEyes")
LIQUIDS (content/liquids.js)             // 13 liquids + "water" (= fresh water); every faction's sacrament
CONTAINERS = { vial }  ·  item kind "vial" { effect: liquidId | "" }   // fill beside water (feet to knees), drink, pour
makeShrine(c, { cost, faction }) · donate(game, c, glim) · DONATIONS   // social/shrines.js: the legacy shrine as a
                                         //   component; the Vigil +10 per 50 (to +200), the Lampless +1 per 2 in the dark
registerCoinage(id, def) · COINAGES · coinsOf(e, id) · coinRoom(e, id)   // social/backings.js: the "item" backing and
                                         //   the item kind "coinage" (used only if content/currency.js asks for it)
```

`dialogue.js`: talk answers may be `{ trade: tab }` or `{ ritual: true }`; closing either screen starts the talk over;
each letter is spoken in `voiceFor(c) ?? c.type`. `builders.js`'s merchant answers `{ trade: "theirs" }`.

## Integration requests (6b)

1. **Applied, `tests/checks/body.js` (P0's; the coordinator agreed):** `samples()` gets one line for WS6b's two
   kinds, `out.push({ kind: "vial", effect: "brine", count: 1 }, { kind: "coinage", effect: "glim", count: 3 });   // WS6b`
   (`4c35f3b`, as WS5 and WS8 did), and `tests/checks/content.js` `ITEM_SAMPLES` the same two (`599ad65`). DECISIONS:
   a vial holds a liquid for a tonic or a sacrament and never backs or holds money (a vial of glim isn't funds, can't
   pay and sells as glass: check-social §14); `coinage` is the item backing only, used if content ever asks for it.
2. **`combat.js` (WS8), oathbreaking:** thorns (`killMonster(…, "dies on your thorns")`) and the lightning arc
   (`"is struck down"`) kill with you as the source; bible §3.3 says splash doesn't count. Have `killMonster` pass
   `splash: true` in the "kill" payload for those two (ritual.js already skips such a kill).
3. **The renderer (WS3's `render3d.js` / `light.js`), the Snuffer's mark:** while `game.state.snuffer.until >
   game.time`, no shadow under you in 3D; and for the rest of the run (`game.state.snuffer` set at all) the torch's
   radius −1.
4. **`sfx.js`:** nothing to do; WS3's `voiceOf` (on `main`) takes `voiceFor`'s objects. On this branch (P0's sfx.js)
   faction voices fall back to Maren's until the merge.
5. **WS7 (secrets, villages):** journal entries the Kindling reads: `{ kind: "location"|"history"|"village"|"gossip"|
   "recipe", reading: "flat"|"deep"|"dark", text, sold }`; a creature's own readings in `c.readings` (secret ids);
   village leaders `named: true`; generated opinions may be given as `c.opinions`. A faction's `buys: { readings,
   topics }` (content/factions.js, C) narrows what it wants.
6. **WS4 (powers):** teachers list power ids in `c.teaches`; Warm Hands is the key `warmHands`; WS4 #11's Kindling XP
   is applied (`xpReward("kindling", level)` with `{ source: "kindling" }`).
7. **Content (C1-C4), not built here:** the faction variants of the rites (the Pouring, the Oiling, the Ascent's 8
   blocks up, the Mirroring's order, the Moths' Moon-Wick and the Saltbeasts' Herdmothers only); the village dish; the
   faction specials (the Spore Moot's limb, the Pressing, the Snuff); the commons lamp; the Chandler banks; clear glim's
   and turnwater's full effects (WS4b, WS5, WS3).
8. **`tools/README.md` (the integrator):** the check-social row adds "WS6b: prices, the item backing, Pell's services
   through the trade screen, the Kindling's three rites, restock, voices, liquids, shrines"; the browser-ws6 row adds
   "the trade screen, the Kindling on the map, in lit 3D and in the dark, Pell's services".

## Handoff

**Updated:** 2026-10-27, local session, on `ws/ws6`. **WS6b is done: tag `p1-ws6b` on `ws/ws6` (pushed); WS6a's tag
`p1-ws6a` is below it.** Nothing is half finished. Gate numbers, deviations and the verification:
`docs/sessions/ws6.md` "Part 6a" and "Part 6b".

### For the integrator (merging `p1-ws6b`)

- Requests (6b) 1-8 above. For play: **2** (thorns and the lightning arc as splash in combat.js's "kill", or a flame-kin
  caught by an arc makes you the Snuffer) and **3** (the Snuffer's look in 3D). Request 1 (check-body's and
  check-content's sample lines) is applied on this branch.
- Files outside §8.4's WS6b list: `tests/checks/content.js` (one `ITEM_SAMPLES` line, `// WS6b`, `599ad65`),
  `content/factions.js` (WS6a's: the Flatfolk's and the Plan's voice ranges), `social/builders.js` (WS6a's: the
  merchant opens the trade screen; walkDialogue accepts `{ trade }` and `{ ritual }`), `tools/browser-ws6.mjs` (WS6's).
  No fixture or recorded frame changed.
- At the merge: `sfx.js` on `main` already takes `voiceFor`'s objects (WS3's `voiceOf`); WS8's `ai.recruit` and WS4's
  `xpReward`/`gainXp(…, { source })` are picked up by namespace import (nothing to edit); WS7's `learnSecret` turns on
  "ask for a reading" once it isn't a stub. Rerun `node tools/check-social.mjs` and `browser-ws6` (port of your
  choice) after the merge: the Kindling's numbers depend on content/factions.js's relations and on `stats.js priceMul`
  (the attribute set's prices; WS4a's Haggler term is on `main`).
- Prices move with EGO and rep only under `RULES.stats = "attributes"`; today's legacy set keeps the parent's prices,
  so in play the multiplier line reads ×1.00 / ×0.30 until the flip.
- Timing: nothing WS6b adds runs per frame or per tick (talk options, "kill" and "zone:enter" handlers only);
  `check-perf --against p0-done --rounds 2` alone: PASS twice.

### For the integrator (merging `p1-ws6a`, if not yet merged)

- Requests 1-11 above. The ones that matter most for play: **1** (people with health, so a talking villager can be
  struck: without it the witness system fires only on faction members that don't talk), **2** (harm without a source
  counts as yours: spikes and status deaths cost rep), **10** (`browser-0d1`'s tour block for the factions screen).
- No P0 check, fixture or recorded frame was changed; the only file outside §8.4's WS6a list is the new
  `tools/browser-ws6.mjs` (request 11).
- Dependency table "WS6a witnesses": `reputation.js` uses WS8's `creatures.witnessesOf` by itself once both are in
  (a namespace import); rerun `node tools/check-social.mjs` after the merge. Its bot's fellow behind a wall and the
  range edges on the span 1,0,0 should agree with WS8's sight rules (WS8's `sees` adds darkness and stealth, so a
  witness in the dark may not see you: if the bot's witnesses read neutral after the merge, check the light there).
- WS8 #2 is applied here (a creature hostile to you is hostile to your followers); WS4 #8 too (start by genotype,
  Pilgrim's floor), except `villageRep`, which is `chargen.js`'s (request 4).
- Timing: `attitude` is now cheaper than P0's stub for creatures with no faction (190-380 against 1,460-1,840 ns a
  call); passTime alone against `p0-done` ×1.05. In a full run-all with other sessions busy, check-perf reads the
  machine (`docs/sessions/ws6.md` §3, §6).

### Surprising / worth knowing

- **Talkers can't be struck** in P0 (and WS8): `touchable` refuses any talker. Until request 1 lands, a builder's
  talker (villager, priest…) is never hit and only non-talking faction members fire the witnesses.
- **A talker that can't fight is "wary", not "hostile"**, where the table says hostile; the builders speak curtly to
  a wary talker and refuse only at Dark (or a fighter out for you).
- **`membershipsOf` returns a shared, frozen list for a creature type**: never sort or edit it in place (copy it).
- **Followers**: the house rule applies to them; a cycle of leaders answers "neutral" (a depth guard).
- **Running checks while another agent mutates the tree** gives nonsense: the gate verifier's mutation testing
  happened in this worktree, and a parallel `browser-0d2` run read its mutant. Run verifiers' mutants in a copy.
- **Timing on this machine**: with WS9, WS4b and the integrator busy, a full run-all reads the timed checks 2-4×
  slow; take timed numbers alone, alternating with `p0-done` (`check-perf --against p0-done`).
- **(6b) The old game's Pell keeps his own shop and his one pack**; only WS6b's merchants (any talker with
  `talk.dialogue = "merchant"` or a `merchant` component) use the trade screen and restock.
- **(6b) A load is a zone:enter with `away` = the time since you last left that zone**, not since the save: a handler
  that means "after being away" must skip `how === "load"` (merchants.js does).
- **(6b) Money leaks hide in liquids and rep**: anything a pool gives for nothing must not sell for more than its
  container costs (a filled vial sells as glass); the Kindling's best item turns rep into goods, so it is once per pack.
- **(6b) Talk text types out**: a browser or Node check that reads a talk node presses Space (or sets `shown`) first.
