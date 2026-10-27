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

## Integration requests

1. **`tests/checks/world.js:322` (P0's check): asked of the coordinator (2026-10-27).** It holds every run's history
   to the fixture on both worlds; the real world now generates. Proposed: the test world still exactly the fixture;
   any other world `validateHistory(run.history)` with no problem. (Applied here only if approved, marked `// WS7`.)
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

## Handoff

(Written at the 7a tag, for WS7b.)
