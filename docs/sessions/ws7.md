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

(Filled in at the tag.)

### 3. Deviations from the design, with reasons

(Filled in at the tag.)

### 4. Verification

(Filled in at the tag.)
