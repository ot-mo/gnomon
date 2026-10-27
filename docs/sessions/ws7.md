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
| `siteRequests` well-formed for WS10 | `validateHistory` (unique ids and names, the ruler and event resolving, the event pointing back, a tier with 3+ spans WS10's placeSites can take, regionPrefs, 1-5 floors by period, a relic placed at most once). Against WS10's own code: `p1-ws10`'s `checkHistoric` over WS7's histories (a scratch copy of the tag with WS7a's history and grammar laid over it), 10 seeds × both worlds: ok, 100 sites, 310 floors, 61 relics on their altars, murals the Hour's own accounts. 0 tier-8 requests in 200 seeds (the real world's only tier-8 span of that kind is beside the Gnomon). `tests/checks/world.js` (coordinator-approved): the test world exactly the fixture, the real world valid; mutants (§4) each fail. |
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
