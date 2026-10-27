# WS7: knowledge (history, villages, quests, secrets, journal)

TECH_DESIGN §8.3 "WS7", split as `docs/ws7.md` "7a / 7b" says. One worktree (`gnomon-wt\ws7`), one branch (`ws/ws7`)
from `p0-done`. Local machine (Windows 11, 6 cores shared with the user's training job and two other workstreams),
Node 20.11.0, headless Chromium from Playwright.

## Part 7a: history, grammar, secrets, journal

### 1. What was built

- **`story/history.js`**: `generateHistory` behind §2.15's contract. The test world keeps P0's fixture unchanged
  (WS10's checks place its two requests there by region and exact tier; the game plays the test world, so the old
  game is untouched); every other world gets bible §8: five Hours, each born in the age before and dying to end its
  own; 2-3 historical regions per period, 6-8 places down to 2; 10-14 events (origin, 8 core by weight, a crowning if
  none, an event in every region not yet visited, the death); effect first and cause after; three accounts per event;
  2-4 relics per Hour (one the mask) with their domain's powers and three registers; eight site requests by §8.7's
  period table on tiers that have a usable span. `validateHistory` holds the contract and the bible's numbers.
- **`story/grammar.js`, `content/grammar.js`**: `expand` (bindings before rules, `.cap`/`.upper`/`.lower`, a depth
  limit, throws on an unknown symbol); the Hours', places' and regions' names (bible §2.3; 9 letters a word; §15.11's
  words refused, the source holding them backwards so `check-names` sees none); the ten domains' lists, the eras, the
  old factions, the periods, the 16 event types in three registers, causes, relic registers, rumours, the hidden
  facts, the journal's titles, Noon's 18 lines.
- **`story/secrets.js`**: `makeSecrets` (a location per site, three accounts per event and Noon's, rumours), ids
  stable per seed; `learnSecret` (journal, `secret` event, WS1's pin once built, a visit quest; triangulation: XP, a
  hidden fact, the cult pass at five); `readings` / `markSold` for WS6b.
- **`story/murals.js`**: murals learned only through `inspect`: a mosaic on the map, a relief in 3D in light, a rune in
  the dark; the map's describer shows a mosaic's text.
- **`story/gossip.js`**: rumours from history, told by talkers with `talk.gossip` through the talk option "gossip".
- **`story/journal.js`, `screens/journal.js`**: the journal's state and its five tabs (Quests as before, Locations,
  Histories with n of m, Gossip, Notes); keys, clicks, the wheel.
- **`story/quests.js`**: `startQuest` takes an instance id, so one template ("visit") makes several quests.
- **`tests/checks/story.js`**: the acceptance below.

### 2. Gate results (TECH_DESIGN §8.3 WS7, the 7a items)

All from `node tools/check-story.mjs` unless said; run-all at `c7ef521`: **37 of 37** (140 s, 11 at a time).

| Item | Result |
|---|---|
| 100 seeds of history, valid | 100 of 100 real-world seeds pass `validateHistory` (the contract and bible §8: five Hours, 10-14 events each, 2-4 relics with one mask, 3+ favoured, gospels of 1-3 sentences with the age under 16 or over 70, inscriptions in capitals, no two events sharing an account, 8 site requests by the period table); a wider sweep, seeds 101-600 and 615, 501 of 501. 14 broken histories are each refused. The text scan (articles, sentence starts, causes cited, the First Hour as nobody's heir, the Erratum, cults, masks): 0 defects in 100 histories. |
| ≤ 50 ms each | Best of three per seed: alone p50 5.0, p95 6.3, max 8.3 ms; inside run-all's parallel phase p50 11.4, p95 17.8, max 35.9 ms. |
| Every event with gospel, inscription and a cause | Held by `validateHistory` (mutants: an empty cause, a small-letter inscription, an unexpanded `#symbol#`: refused). Every event but an origin, death, floor read or pressing cites its cause in one of its accounts (0 exceptions in 100 histories). |
| `siteRequests` well-formed for WS10 | `validateHistory` (unique ids and names, the ruler and event resolving, the event pointing back, a tier with 3+ spans WS10's placeSites can take, regionPrefs, 1-5 floors by period, a relic placed at most once). Against WS10's own code: `p1-ws10`'s `checkHistoric` over WS7's histories (a scratch copy of the tag with WS7a's history and grammar laid over it), 10 seeds × both worlds, on the tagged files: ok, 100 sites, 310 floors, 65 relics on their altars, 66 mural floors whose murals are the Hour's own accounts. 0 tier-8 requests in 200 seeds (the real world's only tier-8 span of that kind is beside the Gnomon). `tests/checks/world.js` (coordinator-approved): the test world exactly the fixture, the real world valid; mutants (§4) each fail. |
| Secret ids stable per seed | 3 seeds × both worlds: two builds and a save's `restoreRun` give the same defs (867 secrets); ids of the four documented forms; one location per site; 3 × (events + Noon's 6) history secrets; all 3,603 accounts of 20 runs resolve to their own id by text alone. |
| A mural learned by the keyboard path and by hover | Node: a 0.55 s hover through `inputHandlers.onHover` (not at 0.4 s), and the look cursor's `inspect { open: true }`; a relief in 3D in light, not on the map, not in the dark; a mosaic not in 3D; a rune in the dark, not by torchlight or daylight; drawing and describing learn nothing; a 5-wide tablet's edges read it. Browser (headless Chromium, `?silent=1`, real mouse): a hover held 0.85 s learns the mosaic, 0.25 s doesn't, at 1280×720 and 600×300, 0 console errors. Against WS8's real look cursor (`p1-ws8` with WS7a's files laid over it): L, arrows, Enter on the map learn the mosaic; L facing a wall in 3D learns its relief. |
| 10,000 names | Hours, places, regions: 0 words over 9 letters, 0 hits of check-names' own §15.11 list; 7,468 distinct strings of 20 histories, 0 hits; `check-names` (the source and both worlds' Run strings) passes. |
| The journal | J, the five tabs by 1-5, ← → and a click; Histories shows what was read with n of m; J, Esc, a click outside the tabs and a right-click close it; the Quests tab holds every line of the parent's journal in order; a failed quest listed; JSON round trip. Browser: the same by real keys and clicks at both sizes. |
| Gossip | A talker with `talk.gossip` offers "Heard anything lately?", its rumour lands in the journal; a Kites talker tells of the Hour the Kites favour; Maren offers nothing new. |

**Timed, alone, against `p0-done` in alternation** (`check-perf --against p0-done --rounds 2`, 3 runs each): PASS.
passTime p50 7.01 ms (×1.14), mapStep 1.88 (×1.09), refresh 8.13 (×0.97), the dungeon frame 15.27 (×1.13), the
outdoor frame 24.4 (×0.94; over §6.7's 17 ms on this machine at `p0-done` too), surface generation p95 31.4 (×0.84),
dungeon generation p95 35.3 (×0.90), buildRun p50 12.4 ms (×15.7 of P0's fixture; budget 200), restoreRun 1.26.

### 3. Deviations from the design, with reasons

1. **Five Hours with 10-14 events each, not TECH §2.15's 3-5 rulers and 8-12 events:** bible §8.1 and §8.3 (the bible
   outranks the tech design). The site requests follow bible §8.7's table (8 per run), not a count of TECH's.
2. **The test world keeps P0's fixture History.** WS10's checks place its two requests there by region and exact tier,
   and the old game plays the test world, so it is untouched; the real world generates. `tests/checks/world.js`
   holds both (coordinator-approved).
3. **History secret ids carry the account:** `hist:<event id>:<flat | deep | dark>` (an event id is already
   `<ruler>:<n>`), because bible §3.4 makes each account its own reading; TECH §2.14's `hist:<ruler>:<event>` had
   one id per event. Noon's are `hist:noon:<n>:<reading>`.
4. **SecretDef holds JSON, not `text(run)`:** a function can't be saved (R5). History texts are resolved from the
   History (`secretText`); locations and rumours carry their text.
5. **`run.secrets` stays empty until the integrator wires `makeSecrets` into `run.js`** (frozen; request 2);
   `secretsOf(run)` makes the same defs once per run in the meantime, so ids don't change when it lands.
6. **Rumours are `kind: "gossip"` with `reading: null`:** a rumour is heard, not read in a view (the Kindling's +60
   rumour option, not a reading).
7. **The visit quest gives no reward:** discovery XP is WS1's. Triangulation XP is 0.15 × the legacy `xpToNext` at the
   event's tier level until WS4's `xpReward` replaces the seam (request 5).
8. **Only talkers with `talk.gossip` gossip:** a new option on every talker would change the legacy talk trees (Maren,
   Pell); 7b's villagers set it.
9. **A mosaic tablet:** a "map" mural is read from its own tile, or from up to 2 tiles along the row through unbroken
   mosaic (WS10 lays 3- and 5-wide tablets with the mural in the middle).
10. **The keyboard path in Node is the look cursor's payload** (`inspect { …, open: true }`, what WS8's L sends): L
    isn't on this branch. It was run for real against `p1-ws8` with WS7a's files laid over it (§4).
11. **check-story times a history as the best of three runs** (re-timed as the best of nine before it fails): it runs in
    run-all's parallel phase (`run-all.mjs` is frozen; request 8 asks for it among the timed checks). The 50 ms
    budget is unchanged.
12. **The review's text findings c1-c8 went in one commit** (`c7ef521`): they share `content/grammar.js` and one
    regression assertion. Every other finding has its own.

### 4. Verification

**Independent review** (a fresh agent given the code and the contract, not my conclusions): 6 bugs, 8 check gaps, 9 text
or doc items. Each fixed in its own commit with an assertion that fails without it (shown against the previous file):

| Finding | Fix |
|---|---|
| a1 `generateHistory(615)` never returned (an Hour's rampages hated every faction it could still favour) | `22a1772`: makeEnemy leaves room for the padding; seeds 101-600 and 615 swept (the old file: no result in 60 s) |
| a2 tier-8 requests WS10 can't place (it moved 1,518 of 3,005 tombs to tier 7, against its own check) | `33b2e8d`: WS10's span rule, 3+ spans a tier; `p1-ws10` checkHistoric over WS7's history ok |
| a3 identical accounts: a mural taught another event's reading (498 glosses in 50 seeds) | `e7ceaf7`: unique per run (redrawn, then place, then year); 3,603 accounts resolve to themselves |
| a4 gossip's faction preference did nothing | `4e9c416`: rumours tagged with the factions that feel for the Hour |
| a5 `order.history` in learning order, not by year (§2.14) | `41b0b45` |
| a6 the journal dropped failed quests and the right-click close; a 5-wide tablet's edges read nothing | `50233b6`, `5eecc27` |
| b2, b3 the light tests ran with the torch lit (inDark is then always false) | `e56f421`: a rune by daylight, a relief in the dark, torch out |
| b4 the keyboard path only as a payload | run against `p1-ws8`'s real L (above); the integrator's dependency-table item |
| b5, b6, b7 the validator's mutants; duplicate texts; the Quests tab against the old journal | in the fixes above |
| c1-c8 the text (cults, articles, sentence starts, the Erratum, unearned domains, the reigning Hour, uncited causes, the mask's enemies) | `c7ef521` (one commit, deviation 12); 0 defects in 100 histories, 2,058 with the old generator |
| c9 a stale integration request | `73fb683` |

Found in my own browser run: two mosaic murals side by side were both read by one hover (`d24a5f6`).

**P0 checks changed, both coordinator-approved (2026-10-27), each its own commit marked `// WS7`:**
- `tests/checks/world.js` (`e8ce55b`): mutants, each failing: the test world's fixture with one gospel changed (counts
  still 2 / 2 / 1) → "the history is not the fixture"; the fixture on the real world → "2 Hours, not five"; an event
  without a cause → "no cause"; a site request with `regionPrefs: []` → "regionPrefs []".
- `tests/checks/hud.js:199` (`1dc00af`): mutants, each failing: a P0 describer renamed (missing), `murals` at order 1
  (out of order), an extra unknown describer, `murals` registered again under a second id. The same id twice can't
  duplicate: the registry replaces by id.

**The old game:** golden, the recorded screen frames, the legacy fights, the bot, determinism and save all pass in
run-all (no fixture, golden or frame re-recorded); the test world's history is P0's fixture byte for byte; Maren and
Pell offer nothing new; `browser-shell` passes at 1280×720 and 600×300 (43 mode changes each, J and the click on
"JOURNAL" included). `browser-0d1 --against p0-done`: 14 of 14 modes by keys and clicks, the HUD at 100×30, golden (b) underground in the browser 27 frames 0 mismatched, per tick +0.3% (3D) and +0.6% (map) underground, -0.3% and -0.1% on the surface. `browser-0d2 --all`: both boots (153 modules, no console error), the imports page, `test-world.html?all=1` 34 passed, 0 failed.

## Part 7b: villages, quests, campaign

### 1. What was built

- **`story/villages.js`** (data only; `world/run.js` imports it): `generateVillage` behind §2.16's contract plus bible
  §9.1's abstract half: the founding people and the architecture by terrain (C1's regions later), two village events
  from §9.3's 14 (each 1 in 20 leaves it empty), a government from them, every facet of §9.2 (sacred, profane,
  activity, proverb, dish, skill, liquid, shrine), two of the Hours' events as its art (a rune when one was cruel),
  the cast of §9.5 with uids `<site>:<role>`, who likes and hates it, its one quest. One stream per site
  (`seedFor(seed, "run", "villages", site.id)`), the art and the abandonment on streams of their own.
  `villageFaction` (WS6a's shape, `parent: "bent" | "peoples"`), `validateVillage`.
- **`story/questplan.js`**: each template's target, fixed at buildRun and named from the nearest landmark or site
  ("2 spans north-west of Brindle Steading"; plain arithmetic for the compass, no trigonometry in generation).
- **`story/village-site.js`** (`SITE_BUILDERS.village`, registered from `story/index.js`): the 24 × 16 footprint
  paved; five roofed buildings in the style's blocks with their doors on the green; two mosaic tablets (map murals:
  the Flat Account of each Hour event), carved lintels (3D murals: the Deep Inscription), a doorstep rune under the
  hall's roof when an event was cruel (the Dark Gloss); the commons lamp (the Shade: the commons dark); the shrine
  (mosaic, carved stone, rune stone or pillar: the view its prayer needs); the climbing perch (3D only); the cast with
  memberships and, for the leader, `named`, readings, opinions and teaches. An empty village keeps one event's three
  accounts (What Happened Here). On entering: the village faction registered, the first visit's XP once. The cast's
  fields are registered with the save codec.
- **`story/villagequests.js`**: nine templates (recover, carry, readFloor, pray, climb, find, hunt, rescue, chart)
  on the quest engine, each stage a bus event; their things, beasts and lost villagers placed on `zone:prepare` once
  by uid whether or not the quest was given; the giver's talk options, the turn-in and bible §9.6's reward.
- **`story/campaign.js`** and `content/quests.js` `campaign`: the intro pages, the starter chain, the eleven beats as
  data and one quest template that runs them (7 and 8 either order, 9 after both, the Lengthening, the early bonus);
  nothing on the test world.
- **Content:** `content/villages.js` (bible §9.3-9.4's pools, styles, plans, names), `content/creatures/villagers.js`
  (nine talker types, mortal, `@` in their own colours), `content/quests.js` (the templates' words).
- **Touched from 7a:** `secrets.js` (`village:<site>:<n>` readings), `gossip.js` (WS6a's `c.faction` weight table),
  `screens/journal.js` (village tales under Locations).

### 2. Gate results (TECH_DESIGN §8.3 WS7, the 7b items)

All from `node tools/check-story.mjs` (sections 7-9) unless said.

| Item | Result |
|---|---|
| Villages valid on every village site of P0's `placeSites`, 20 seeds | 152 villages (all on the test world: the real world has no regions, so no village sites, before C1), 13 empty. Every record valid; every surface valid on its first attempt (p50 21.8 ms, max 56.6 ms a zone); 1,523 villagers placed where the record says, each reachable from the anchor with doors open, mortal (type `hp`), `@`, a member of its village (1) and of its people's faction or the Bent villages (0.25-0.5); every mural on its block and naming its own account; styles reed, bark, turf; all four shrines; all nine templates drawn. |
| Mosaic murals readable on the map | 291 tablets, each read from its middle and from every tile of its 5-wide row. In play (Brindle Cross, seed 1) both mosaics learned on the map by the look cursor's payload (the middle) and a hover's (the edge), not in 3D; the describer shows the text on the tablet's edge. Browser (the pane, `?silent=1`): a real mouse hover on a tablet learned `hist:ishvalet:1:flat`, the inspect line showing the text. Also: 291 lintels on carved panels, read in 3D in light and not on the map; 81 doorstep runes, read with the torch out and not by torchlight. |
| Each of ≥ 7 templates completed by events in Node | 9 of 9, each its village's own planned quest, given through the giver's talk, completed through the real paths (the pack's pickup, inspect, `killMonster`, zone entry, the talk options) and turned in: 25 × tier glim, +100 with the village (+75, and +25 with the other village, for carry's softened answer), +25 with each faction that likes it, the quest XP, 1 of 3 items. Each first meets a wrong event of its own type that moves nothing (another span, another kill, the wrong tile or view, under its chart goal, another quest's turn-in); a dropped thing sends recover and climb back to fetching. |
| A target in an already-visited zone | Recover: its zone entered and left before the quest exists, the thing waits there once; after the quest, re-entry finds exactly one. Rescue: the lost villager goes home by a zone patch to the giver's (visited) village and is there on re-entry, its uid claimed by that zone. |
| uids for cross-zone targets | Things, beasts and the lost by uid (`<site>:quest:thing`, `:beast`, `:lost`), claimed by their zone; a killed beast's uid is "dead" and it never comes back on re-entry; the carry target is the other leader's uid. |
| Gossip | A villager offers "Heard anything lately?", the warden (no `talk.gossip`) doesn't; 7a's faction preference reads WS6a's `{ id: weight }` too. |
| Campaign hooks as data | 11 beats at their landmarks' real floors; `introPages` is the parent's INTRO on the test world, the campaign's elsewhere; on the real world the start gives beat 1, each beat's event ends it and starts the next, a wrong floor doesn't, 8 before 7 works, 9 waits for both, the Lengthening after beats 5, 8 (the first of 7 and 8) and 9; beat 10 begun at level 1 pays ×1.5. On the test world nothing starts. |
| R6 for villages | A record made alone equals `makeVillages`'; in 530 pairs a village keeps its culture, cast, art, government and abandonment with another village's site taken away; 19 zones made twice alike (blocks, cast, murals); no `Math.random` in the three generation files; `check-determinism` passes. |
| Saves | A village zone through the codec (`snapshotZone`, `finishZone`, `decodeZone`) keeps the cast's village, role, readings, opinions, teaches and memberships, its murals and `zone.village`, and the reloaded giver still offers its quest. |

**run-all** at `f90753c` (every 7b source change and fix in): **37 of 37** (144 s, 11 at a time). **Timed, alone, against `p0-done`** (`check-perf --against p0-done --rounds 2`, 3 runs each,
alternating): PASS. passTime ×1.21, mapStep ×0.80, refresh ×1.00, the dungeon frame ×1.01, the outdoor frame ×0.95
(over §6.7's 17 ms on this machine at `p0-done` too), surface generation p95 ×0.86 (max 148 ms, budget 150), dungeon
generation p95 ×1.05, buildRun p50 11.0 ms.

### 3. Deviations from the design, with reasons

1. **A village's name is its site's** (P0's `placeSites` names, used by the zone, the location secret and other
   villages' quests); bible §9.2's regional phonology would rename it under them. The cast's given names follow its
   people.
2. **Two kinds of history.** The village's own two events (bible §9.3) are its founding tales (`founding`, its
   `village:<site>:<n>` readings); TECH's `history: [eventId]` are two of the Hours' events, its art (7a's Handoff).
3. **Every village stands on the datum.** §9.4's heights (stilts, ledges, canopies, storeys, a page-town only on the
   map) are a style's blocks only; the height in a village is the climbing perch. A fuller architecture is content.
4. **Nine templates, not §9.6's eleven:** Kindle or snuff (no site-wide braziers), Unpress a neighbour (no event for
   turning views on a tile) and Walk the Shadow (no Hand before WS1 and WS3) aren't built; TECH §2.13's "find a
   person" (rescue) and "map a zone" (chart) are. Hunt is the hunt half (bonding is WS6b's Kindling); pray is the
   prayer half.
5. **Things are placed on `zone:prepare`, not by zone patches** (bible: placed when the zone is generated, whoever
   comes first), once, by uid and `zone.flags`; a zone patch carries the rescued villager home. Every quest is turned
   in at its giver (find and pray too).
6. **The reward's three items** come from the parent's tables at the village's level + 3 (a weapon or armour, a ring
   or amulet, two potions, never cursed), not §9.6's "cells within 2 tiers" (WS5's cells are content).
7. **The fetch quests watch the pack on `clock:tick`** until `items.js` emits `pickup` (request 12); both are in the
   template.
8. **Chart asks for 60%, or 5 under what can be reached** from where you come in (review #6).
9. **The beats' done conditions are stand-ins** (a landmark's floor reached, Noon's sixth flat account) until content
   builds each beat's routes and choices; beat 1's choice is data only.
10. **The village faction is registered on entering** (`run.js` is frozen; request 9), with WS6a's parent.
11. **A villager says its village's proverb** where no dialogue is registered (check-talk wants every talker type to
    have one); WS6a's role dialogues win once they load.
12. **The first visit's XP can be a whole level for a fresh character** (a tier-3 village: 0.2 × 650 = 130 XP, bible
    §9.1's number): left to the balance phase with the other XP sources.
13. **The review's fixes went in one commit per file**, each message naming its findings, as the fixes share files.

### 4. Verification

**Independent review** (a fresh agent given the code and the contract, not my conclusions): 3 bugs, 4 check gaps, 1
text item, and one bug that waits on other workstreams. Each fixed with an assertion that fails without it:

| Finding | Fix |
|---|---|
| #1 a save stripped the cast's village and role (no quest after a reload) | found in my own review too, `c572077`: the codec's creature fields, and the round trip in check-story 7 (without the fields: the giver's role is gone) |
| #2 recover and climb turned in without the thing | `c2e20f9`; check 8 drops it on the way |
| #3 no save in sections 7-9 | `c572077` |
| #4 mutants that passed (find any span, hunt any kill, any quest's turn-in, chart without its goal, pray at any tile) | `3c7fd32`: a wrong event of each type first, and `234264a` (the dropped thing's turn-in before the tick). Each of the six mutants (these five and "turn-in without the thing") fails check-story: "another span found the place", "another kill ended the hunt", "another quest's turn-in finished it", "under 60% charted ended it", "prayed at the wrong tile", "turned in with the thing dropped" |
| #5 rune shrines need WS3's night, relief and pillar shrines WS8's look cursor | integration request 17 |
| #6 chart's 60% not always reachable (as little as 11% of a level) | `c2e20f9` |
| #7 a stale village faction from an earlier run in the page | `2bb8d7f` |
| #8 "Our the bell's tongue", a small-letter sentence (and doubled places beside them) | `b6f2f84`; check 8 reads each quest's words |
| #9 the R6 check couldn't fail | `3c7fd32`: 530 pairs with another village taken away |

Found in my own runs: `Math.atan2` in generation (`2be7595`, check-determinism); villager types with no dialogue
(`77f5496`, check-talk); a thing not placed for a quest started outside its village's plan, and quests sent to empty
villages (`d53a58f`).

**The old game:** run-all's golden, the recorded screen frames, the legacy fights, the bot, determinism and save pass;
no fixture, golden or frame re-recorded; no P0 check changed in 7b. The test world's start, the temple and its intro
are untouched (the campaign doesn't start there; `introPages` gives the same INTRO object). `browser-shell`: PASS at
1280×720 and 600×300 (43 mode changes each). `browser-0d1 --against p0-done`: 14 of 14 modes by keys and clicks, the
HUD at 100×30, golden (b) underground in the browser 27 frames 0 mismatched; per tick against `p0-done` −0.5% (3D)
and −2.3% (map) underground, −1.5% and −1.3% on the surface. In the pane: a village drawn on the map (buildings,
tablets, cast) and in 3D (walls, roofs, the villagers' sprites, the talk prompt).
