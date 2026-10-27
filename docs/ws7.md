# WS7: knowledge (history, grammar, secrets, journal; villages, quests, campaign)

TECH_DESIGN §8.3 "WS7" is the contract. Files (§8.4): `story/*`, `screens/journal.js`, `screens/story.js`,
`content/grammar.js`, `content/quests.js`, `content/villages.js`, `content/creatures/villagers.js`,
`tools/check-story.mjs`, `tests/checks/story.js`. One worktree (`gnomon-wt\ws7`) and one branch (`ws/ws7`) for both
halves; 7a tags `p1-ws7a`, then the 7b session continues here and tags `p1-ws7b`.

## 7a / 7b

**7a: history, grammar, secrets, journal** (this session).

- `story/history.js generateHistory(seed, world)` behind the same `History` contract (§2.15): bible §8's five Hours,
  10-14 events each from the 16 types, effect first and cause after, three accounts per event (gospel = the Flat
  Account, inscription = the Deep Inscription, hostile = the Dark Gloss), 2-4 relics per Hour (the mask at its
  death), eight `siteRequests` by the period table (Fifth 2, Fourth 2, Third 2, Second 1, First 1; tiers and floors by
  period). R6: draws only from `seedFor(seed, "run", "history")` (the same stream as `runRng(run, "history")`).
  **The test world keeps P0's fixture** (WS10's checks place its two requests there by region and tier, and the old
  game plays the test world); the real world gets the generator. `validateHistory(h)` for the checks.
- `story/grammar.js expand(grammar, symbol, rng, ctx)` and the name generators (the Hours, places, regions; bible §2.3;
  at most 9 letters; anything containing a §15.11 word is rejected); `content/grammar.js` holds the ten domains'
  fragment lists, the event templates in three registers, the old factions and guilds, and Noon's 18 fixed lines.
- `story/secrets.js`: every learnable secret of a run (`makeSecrets(run)`: locations, history accounts, Noon,
  history-driven rumours), ids stable per seed; `learnSecret(game, id, source)` files it in the journal, emits
  `secret`, pins a location (WS1's `pin` once built) and starts a "visit" quest; three accounts of one event
  triangulate it (XP, a hidden fact); five triangulated events give an Hour's cult pass.
- Murals learned through `inspect` only (`story/murals.js`): `zone.murals` entries (WS10's shape: `{ x, y, z, view,
  text }`), a mosaic ("map") on the map, a relief ("3d") in 3D in light, a rune ("dark") in the dark; by the look
  cursor (`open: true`) and by a map hover held 0.5 s (`open: false`). A pure describer shows a mosaic's text on the
  map's inspect line. (7a does the learning; 7b builds the village mosaics.)
- `story/gossip.js gossipFor(game, c)`: history-driven rumours, told by talkers that gossip (a type's or a talker's
  `talk.gossip`; 7b's villagers set it), through `registerTalkOptions`.
- `screens/journal.js` (and `story/journal.js`): the tabs Quests · Locations · Histories (n of m known, by date) ·
  Gossip · Notes; the readings list WS6b's Kindling reads.
- Acceptance (`tests/checks/story.js`, `tools/check-story.mjs`): 100 seeds of history (valid, ≤ 50 ms, every event
  with gospel, inscription and a cause, `siteRequests` well-formed for WS10); 10,000 generated names free of §15.11;
  secret ids stable per seed; a mural learned by the keyboard path and by hover (and not in the wrong view).

**7b: villages, quests, campaign** (the next session).

- `story/villages.js generateVillage` and `SITE_BUILDERS.village` (building plans in the vault format, roofed, mosaic
  murals readable on the map from `layout.murals`), `content/villages.js`, `content/creatures/villagers.js`
  (`talk.gossip: true` on those who gossip); village secrets (`village:<site>:<n>` in `makeSecrets`).
- The quest engine's ≥ 7 templates (`content/quests.js`), one with a target in an already-visited zone; the campaign
  hooks (intro pages, start, main beats as data).
- The carried requests (HANDOFF "Carried integration requests", WS7): WS6a #6 (village factions with
  `parent: "bent" | "peoples"`, `bentVillages` second membership, quests `addRep(game, id, n, "quest")`, Grey
  members in holy places), WS6a #1 (mortal villagers: types with `hp`; the integrator wires WS8's side), WS6b #5/#6
  (village leaders `named: true`, `c.opinions`, `c.readings`, `c.teaches`), WS4 #11 (quest XP through
  `gainXp(game, xpReward(kind, level), { source })`; the powers Hour script, Gossip, Triangulator, Vey's script lose
  their `needs`). 7a covers the journal-readings half of WS6b #5 and the triangulation XP of WS4 #11.
- Acceptance: villages valid on every village site the P0 `placeSites` returns for 20 seeds; each quest template
  completed by events in Node.

## Public API (7a)

```js
// story/history.js
generateHistory(seed, world) → History   // the test world (world.id "test"): P0's fixture, unchanged; any other world:
                                         // bible §8's five Hours (stream seedFor(seed, "run", "history") = runRng(run, "history"))
validateHistory(h, { strict = true, world }) → [problem]   // the contract; strict adds bible §8's numbers; world: tiers
fixtureHistory() → History               // P0's fixture, a fresh copy
// History, beyond §2.15's contract (all JSON): ruler { short, ordinal, period 1-5, pronoun, cognomens, colour, profession,
//   regions [{ name, places }], cult { name }, born.year }; event { variant, age, place, region, disagree?, falseDeath?,
//   stele?, renamed? { from, to }, noonReading?, mirrored? }; relic { rulerId, eventId, lostAt? { place, eventId },
//   mask, text { flat, deep, dark } }. Event ids "<short>:<n>" by date; relic ids "relic:<short>:<n>"; site request ids
//   "site:<short>:<n>" (the tomb is :1, the Hour's deepest, holding a relic it didn't lose).
// Accounts: text.gospel = the Flat Account (map), text.inscription = the Deep Inscription (3D, in light; capitals),
//   text.hostile = the Dark Gloss (the dark; lower case, " / " between lines).

// story/grammar.js
expand(grammar, symbol, rng, ctx) → string   // #sym#, #sym.cap# / .upper / .lower; ctx before rules; throws on unknown
hourName(rng) · placeName(rng) · regionName(rng, domain) · nameAllowed(name, { long }) · numberWords(n) · ordinal(n) · cap(s)

// story/secrets.js
makeSecrets(run) → Map<id, SecretDef>     // loc:<landmark> / loc:<siteId>, hist:<eventId>:<flat|deep|dark>,
                                          // hist:noon:<1-6>:<reading>, gossip:<n>; stable per seed
secretsOf(run) · secretDef(run, id) · secretText(run, idOrDef) · secretTitle(run, idOrDef) · muralSecret(run, text)
learnSecret(game, id, source, { quiet }) → entry | null   // "secret" { kind, id, at, source }; pin (WS1); visit quest;
                                          // triangulation ("triangulate" { key, xp }, Notes, XP); "cultPass" { rulerId }
readings(game) → [{ id, kind, reading, text, sold }] · markSold(game, id) → bool    // WS6b's Kindling
visitQuest(game, secretId) → quest | null · TRIANGULATION.xp(level) · ACCOUNT · READINGS
// SecretDef = { id, kind, reading ("flat" | "deep" | "dark"; null for a rumour), tags, value (glim), at?, ref, text? }

// story/murals.js: zone.murals [{ x, y, z, view: "map" | "3d" | "dark", text, secret? }]
muralsAt(zone, x, y) · readable(game, zone, m) · readMural(game, inspectPayload) → [learned ids]
// on("inspect"): the only way a mural teaches; describer "murals" (order 40): a mosaic's text on the map's inspect line

// story/gossip.js
gossipFor(game, c) → text | null · gossipDef(game, c) · gossips(c)   // c.talk.gossip or its type's; talk option "gossip"

// story/journal.js: journalOf(game) → { secrets, notes, order: { history }, triangulated, cultPass } · knows · addNote
// story/quests.js: startQuest(game, templateId, { id, … }): id lets one template make several quests ("visit:<secret>")
// screens/journal.js: openJournal, JOURNAL_TABS, journalLines(game, tab, width)
```

**Events added:** `secret` { kind, id, at, source }, `triangulate` { key, xp }, `cultPass` { rulerId }. **Registered:**
the quest template `visit`; an `inspect` handler; the describer `murals`; the talk option `gossip`.

## Public API (7b)

```js
// story/villages.js (data only; world/run.js imports it): one stream per site, seedFor(seed, "run", "villages", site.id);
// the art and the abandonment on their own (…, site.id, "art") and (…, site.id, "abandon")
makeVillages(run) → Map<siteId, Village> · generateVillage(run, site) → Village · villageOf(run, siteId)
villageFaction(v) → FactionDef      // { id: "village:<site>", name, parent: "bent" | "peoples", temperament "docile", startRep 0,
                                    //   likes, hates, relations, generated, siteId, liquid, about } (WS6a's shape)
validateVillage(run, v) → [problem] · villageArt(run, site) → [eventId] · villageAbandoned(run, site) · nearestVillage(run, site)
// Village (TECH §2.16, more): { tier, level, people, parent, abandoned, founding: [{ event, text, cruel }] (bible §9.3's two),
//   government, culture { sacredLiquid, sacred, profane, dish, style, phonemes, activity, proverb, skill, shrine },
//   history: [eventId ×2] (its art), likedBy, hates, roles: [{ role, uid "<site>:<role>[:n]", name, creatureType, dialogue,
//   named?, readings? }], quest: { template, params }, layout: { style, buildings, murals, rune, shrine, perch } }

// story/questplan.js: planQuest(run, site, v, template, rng) → params | null · QUEST_ORDER · where(run, wx, wy)

// story/village-site.js (SITE_BUILDERS.village, registered by story/index.js)
buildVillage(ctx, site)             // zone.village { siteId, shrine { x, y, z, view, kind }, lamp, perch, buildings }; zone.murals
                                    //   (map tablets, 3d lintels, a dark doorstep rune), the cast (c.village, c.villageRole,
                                    //   c.faction { village: 1, people or bentVillages: 0.25-0.5 }, leaders' named, readings,
                                    //   opinions, teaches)
ensureVillageFaction(game, v) · VILLAGE_REWARD.xp(level) · castReachable(zone)
// on "zone:enter" of a village: its faction registered; the first visit's XP (source "village") once

// story/villagequests.js: nine templates (recover, carry, readFloor, pray, climb, find, hunt, rescue, chart)
startVillageQuest(game, siteId, template, params) · offerQuest(game, v) · villageQuestId(siteId) · rewardOf(game, q)
takeOffer(game, q, k) · QUEST_THINGS.targetsIn(run, zoneKey)
// on "zone:prepare": a quest's thing, beast or lost villager placed in its zone once (zone.flags["quest:<uid>"], claimUid)
// talk options "villageQuests": the giver's offer, "It's done.", the reward's 1 of 3; the other leader's word; "Go home."

// story/campaign.js
CAMPAIGN · introPages(run) · campaignOf(game) · beginCampaign(game) · beatReady(game, beat) · beatMatches(m, type, ev) · BEAT_XP
// the quest template "beat"; on "zone:enter" how "start": beginCampaign (never on the test world)
```

**Events added (7b):** `quest:turnIn` { q, c }, `quest:deliver` { q, c, answer }, `quest:found` { q, c }, `beat` { id, n },
`lengthen` { n }. **Registered:** the site builder `village`; quest templates `recover`, `carry`, `readFloor`, `pray`, `climb`,
`find`, `hunt`, `rescue`, `chart`, `beat`; the talk option `villageQuests`; handlers on `zone:enter` (village-site.js,
campaign.js) and `zone:prepare` (villagequests.js); the creature types of `content/creatures/villagers.js`.

## Integration requests

1. **`tests/checks/world.js` siteRules' history line (P0's check): applied in this branch with the coordinator's
   approval (2026-10-27), marked `// WS7` (`e8ce55b`), for the integrator to confirm.** It held every run's history
   to the fixture on both worlds. Now: the test world, still exactly the fixture (the counts 2 / 2 / 1 and deep-equal
   to `fixtureHistory()`); any other world, `validateHistory(run.history, { world })` with no problem. One line, plus
   the import it needs at the top; WS10's own change to the same file (its `historicRule`) is elsewhere in
   `siteRules`, so the two join cleanly. Mutants in `docs/sessions/ws7.md`.
1b. **`tests/checks/hud.js:199` (P0's check): applied with the coordinator's approval (2026-10-27), marked `// WS7`
   (`1dc00af`).** The describer list must be exactly `tile, people, items, sightings, murals, markers`: TECH §2.14's
   pure describer for murals. Nothing else in the file changed. Mutants in `docs/sessions/ws7.md`.
2. **`world/run.js` (frozen):** the `secrets` step should be `run.secrets = makeSecrets(run)` (`story/secrets.js`), so a
   save carries them (until then `secretsOf` makes them once per run from the same data, so ids don't change). Bump
   `GEN_VERSION` (with WS10 #2): the real world's runs differ from P0's for the same seed.
3. **WS1 (overworld):** `learnSecret` calls `overworld/discovery.js pin(game, wx, wy, { label, secretId })` once
   discovery.js drops `STUB`; the visit quest also listens to `world:step` and reads `ev.to` as `{ wx, wy }`. The
   journal's Locations tab wants a "show on the world map" key (an API to open the world map centred on a span).
   Discovery XP is WS1's; the visit quest gives none.
4. **WS10 (dungeon sites):** bible §8.5: an Hour-site floor named after an event shows all three accounts: lay a third
   mural `{ view: "dark", text: e.text.hostile }` (a rune, read with the torch out) beside the "3d" and "map" ones.
   Murals may carry `secret` (the id); without it `muralSecret` finds the account by its text, which works today.
   A history relic's three registers are `relic.text { flat, deep, dark }` (for WS10 #4's naming in items).
5. **WS4 (progression):** `TRIANGULATION.xp = (level) => xpReward("triangulation", level)` (secrets.js already calls
   `gainXp(game, xp, { source: "triangulation" })`); the powers Hour script, Gossip, Triangulator and Vey's script can
   lose their `needs` once their effects read this API (WS4 #11).
6. **WS6b (the Kindling):** `readings(game)` and `markSold(game, id)` are the journal's side of "give a reading";
   "ask for a reading" calls `learnSecret(game, id, "ritual")` with an id from the creature's `c.readings` (7b's
   villagers, WS10's legends); a rumour has `reading: null` (the +60 rumour option); `def.value` is its glim value.
   `dialogue.js drawJournal` and `journalKey` are no longer used (the journal screen is `screens/journal.js`).
7. **WS6a / C (factions):** an Hour's cult is `ruler.cult.name`; `game.state.journal.cultPass[rulerId]` (and the
   `cultPass` event) should make that cult treat you as a pilgrim in its sites (bible §8.5); the cults themselves
   (generated factions, −500) are for the run's factions step.
8. **`tools/run-all.mjs` (frozen):** add `check-story.mjs` to `TIMED`, so the history budget (50 ms a seed) is timed alone
   like the others (it re-times a slow seed as the best of nine until then).

**From 7b:**

9. **`world/run.js` (frozen), the factions step (WS6a #6):** register each village's own faction with
   `villageFaction(v)` (`story/villages.js`) instead of P0's `{ parent: "village" }`, so the village is under `bent` (a Bent
   village) or `peoples` and the Assize's hatred of the Bent reaches it. Until then `village-site.js` registers it with
   `factions.js registerFaction` the first time you enter the village (`ensureVillageFaction`), which is enough for
   `attitude` and `addRep`. The members' second membership is already on each villager (`c.faction`: the Bent villages or
   their founding people's faction, 0.25-0.5).
10. **WS6a #1 (the integrator's, in WS8's files): mortal villagers.** Every type in `content/creatures/villagers.js` has
    `hp` (14-34; the warden toughest); `spawnCreature`'s talker branch should give a talker whose type has `hp` its
    `hp`/`maxHp`/`attack` like a monster's. Nothing in 7b assumes it either way.
11. **`game.js startRun` (P0's):** open `introPages(game.run)` (`story/campaign.js`) instead of `INTRO`: the same pages
    on the test world (the parent's INTRO, the same object), the campaign's on the real world. The campaign itself starts
    on its own (`zone:enter` with `how: "start"`, never on the test world).
12. **`items.js pickUpItems` (P0's, TECH §2.12 `pickup`):** emit `pickup { e, item }` for a thing that goes into the pack.
    The fetch quests listen for it; until it exists they notice the thing in your pack on the next `clock:tick` (both
    paths are in the template, so nothing changes when it lands).
13. **WS1 (overworld), discovery XP:** a village's first visit gives its XP here (bible §9.1, `xpReward("village")`,
    source `"village"`). WS1's discovery XP should skip village sites (or the integrator keeps one of the two). The
    `find` quest also listens to `world:step` (`ev.to` as `{ wx, wy }`), like 7a's visit quest.
14. **WS4 #11:** quest XP is `xpReward("villageQuest", level)` (source `"quest"`), beats `xpReward("beat", level)` (×1.5 below
    the band), the first visit `xpReward("village", level)`, all through a namespace import of `leveling.js`, so they
    switch to WS4's at the merge with nothing to edit (today the same fractions of `xpToNext`). The powers Hour script,
    Gossip, Triangulator and Vey's script can lose their `needs`: the journal's readings, gossip and triangulation exist.
15. **WS6b #5/#6 (the Kindling):** a leader is `named`, carries `readings` (its village's two tales, `village:<site>:<n>`),
    `opinions` ([[faction, "likes" | "hates", why]] from its village's) and `teaches` (the first power of the village's
    tree in `content/powers.js`, empty on this branch); the lamplighter's `readings` are the flat accounts of the
    village's two Hour events. A villager's `talk.dialogue` is one of WS6a's ROLES (leader by government: villager or
    priest; warden guard; trader and tinker merchant; leech priest; lamplighter wanderer). On this branch (P0's
    `social/builders.js`) they say "..." before the quest and gossip options.
16. **C1 / content:** Grey members hostile in their holy places (WS6a #6) isn't built: no village is a holy place yet.
    Bible §9.4's heights (stilts, ledges, canopy platforms, the Stacks' storeys) are a style's blocks only: every
    village stands on the datum (`docs/sessions/ws7.md` 7b deviation 3). The dish, the commons lamp's services and the
    shrine's rewards are content.
17. **The dependency table, pray quests and murals by view (WS3, WS8):** on this branch only a mosaic shrine's prayer
    can be made in play. A relief or pillar shrine and a lintel are read through `inspect` in 3D, which only WS8's look
    cursor sends (the map hover is the only sender here). A rune shrine and an empty village's doorstep rune are
    outdoors: they read in the dark, which needs WS3's day and night (`light.js daylight` is 1 at every hour on this
    branch). The hall's doorstep rune is under a roof, so it reads by day with the torch out. After the merge, rerun
    `node tools/check-story.mjs`, then in the browser: a pray quest at a relief shrine by L in 3D, and one at a rune
    shrine at night with the torch out. check-story's pray case is a pillar shrine (seed 1), by the look cursor's payload.
18. **`tests/checks/determinism.js` (P0's), optional:** add `src/story/villages.js`, `questplan.js` and
    `village-site.js` to its `Math.random` scan; check-story scans them meanwhile.

## Handoff

**For the integrator, merging `p1-ws7b`** (on `ws/ws7`, above `p1-ws7a`; WS7 is done). Nothing is half finished. Gate
numbers, deviations and the verification: `docs/sessions/ws7.md` "Part 7a" and "Part 7b". run-all at `f90753c`:
37 of 37; `check-perf --against p0-done --rounds 2` alone: PASS.

**If `p1-ws7a` isn't merged yet,** its Handoff items still stand: requests 1-8 (1 and 1b are P0 checks changed with
the coordinator's approval, marked `// WS7`; 2 and 8 are frozen files).

**7b's requests (above, 9-18), by what they change in play:**
- **9** `run.js`'s factions step registers `villageFaction(v)` (a village under `bent` or `peoples`; until then it is
  registered on entering, which is enough for attitude and rep).
- **10** WS6a #1, mortal villagers: the types carry `hp`; your `spawnCreature` change gives it to the talker.
- **11** `game.js startRun` opens `introPages(game.run)` (the same INTRO object on the test world).
- **12** `items.js` emits `pickup` (the fetch quests also notice the pack on `clock:tick`, so nothing breaks without it).
- **13** WS1's discovery XP should skip villages: their first visit pays here (source `"village"`).
- **14** WS4 #11: quest, beat and village XP already go through `leveling.xpReward` by namespace import; the four powers
  waiting on WS7 can lose their `needs`.
- **15** WS6b: leaders are `named` with `readings`, `opinions`, `teaches`; villagers' dialogues are WS6a's ROLES. With
  `social/builders.js` merged, its role dialogues replace the proverb fallback by themselves (they load first).
- **16** content: Grey members in holy places, §9.4's heights, the dish and the shrine's rewards.
- **17** the dependency table: after the merge, check a pray quest at a relief shrine by WS8's L in 3D, and one at a
  rune shrine at night with the torch out (WS3's day and night); on this branch only a mosaic shrine's prayer works in
  play.
- **18** optional: `tests/checks/determinism.js` could scan the three new generation files.

**Files outside §8.4's WS7 list:** none. `story/villagequests.js`, `story/village-site.js`, `story/questplan.js` and
`story/campaign.js` are in `story/*`. No P0 check, fixture or recorded frame changed in 7b.

**At the merge:**
- **`story/index.js` registers `SITE_BUILDERS.village`.** WS10's `world/sites.js` registers every other kind, and
  never `village`, so they join cleanly.
- **The village builder assumes P0's 24 × 16 footprint** (`SITE_SHAPES.village`). If a later `placeSites` changes it,
  `buildVillage` needs its slots moved.
- **Rerun** check-story, check-social (WS6a's builders over the villagers, its witnesses on mortal villagers),
  check-talk and check-determinism.
- **Village sites appear on the real world** only once C1 gives it regions with a `sites.village` chance. Until then
  check-story's 20 seeds are the test world's 152 villages.

**Surprising:**
- **The save codec keeps a whitelist of creature fields.** A new field on a creature needs `registerCreatureField`, or
  a reload drops it silently (that was review #1).
- **A dungeon level can be mostly unreachable** from where you come in (as little as 11% of its open tiles), so any
  "map N%" goal must allow for it.
- **Light:** `light.js daylight` is 1 at every hour on this branch, so the outdoors is never dark in Node before WS3.
- **The pane:** the built-in browser pane throttles frames while it isn't focused (about 0.05 s of game time a second),
  so a 0.5 s hover takes several real seconds there.
- **Writing these files:** heredocs with apostrophes break in this shell tool. Python's `\b` and `\1` in a
  non-raw string mangle regexes, so write them with the Write tool or a raw string.
