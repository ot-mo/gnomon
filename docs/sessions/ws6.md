# WS6: factions, reputation, dialogue (6a) · trade, the Kindling, backings, voices, shrines (6b)

Phase 1 workstream (TECH_DESIGN §8.3 "WS6a", "WS6b", with DECISIONS.md), in the worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\ws6` on `ws/ws6`, from `p0-done`. Two sessions in the same worktree: **6a**
(factions, reputation, dialogue builders; tag `p1-ws6a`) and **6b** (trade, the Kindling, backings, voices, shrines;
tag `p1-ws6b`). The public API, the integration requests and the handoff are in `docs/ws6.md`.

# Part 6a

Local session, 2026-10-27 (paused at a usage limit and resumed the same day), on Windows 11 (Node 20.11.0,
headless Chromium from Playwright), with WS9, WS4b and the integrator running on the same machine. One commit per
step, each pushed by the post-commit hook:

| Commits | What |
|---|---|
| `996561b` | `content/factions.js` (21 factions, the Bent villages, 9 hidden groups) and `factions.js` (the full `attitude`, `baseRep`, `addRep`, relations) |
| `9a0a6c8` | `social/reputation.js`: rep events with witnesses |
| `861cfa8` | `social/builders.js` (5 roles), `social/index.js` (no longer a stub) |
| `7f7b736` | `screens/factions.js` (P) |
| `225a41c` | `tests/checks/social.js` (WS6a part) |
| `74a5c9a` `1bcbd78` | WIP handoff at the usage limit |
| `be92e83` | timing: `attitude` without allocation for creatures with no faction |
| `f3b2b7c` `525a434` `aebdd01` `2208fa8` `d5b1bb0` `a28515a` `6e9ac5f` `350d71b` | the review's findings, one commit each |
| `f4e070b` | `tools/browser-ws6.mjs`; requests 10 and 11 |
| `841cfbd` `434ad90` `97f81c9` `9f3367b` `a4ed51d` | the gate verifier's findings, one commit each, and its surviving mutants |

Size: `src/` + tests + tools: 8 files, +1,336 / −78 lines at `f4e070b`.

## 1. Acceptance (§8.3 "WS6a"), with numbers

All from `node tools/check-social.mjs` (and in the browser's test page, `browser-0d2 --all`), unless said otherwise.

| Item | Numbers |
|---|---|
| **Attitude table tests** | §2.11's table, every band × temperament at both edges of each band (30 cells), for a fighter and for a talker (talker: wary where the table says hostile); weights (a hated membership of weight 0.25 → hostile; 0.2 hated + 0.8 loved → mean 420 → friendly); 8 house-rule pairs (flat vs deep, a ghost vs a deep creature, dark-sight, you seen across both); grudges; 10 follower pairs (WS8 #2: a monster out for you is out for your follower; flat followers unaware of deep monsters both ways; two followers friendly); 9 creature pairs (shared faction, likes, hates one way only, the Assize → Hollowmere through the Bent group, a parent group's relation); a cycle of leaders and of parents answer; the old game: 19 legacy monsters × 30 creatures: every monster hostile to you and to nobody else, every legacy person neutral to you |
| **Rep arithmetic** | 11 band edges (−1000, −600, −599, −250, −249, 0, 249, 250, 599, 600, 1000); each of the 21 starts (Bent / Plumb) equals bible §15.4; Pilgrim: 21 floors (every faction ≥ 0 but the Askew at −500); a Plumb Aspirant's background on top: Assize −100 + 300 = 200, Hollowmere 50, the Bent villages −50; clamp at ±1000; ±2.5 → −3 / +3; NaN moves nothing; the "rep" event's payload; kills: common −5, named −50, a half-weight member −3 each, the Assize +2 / +25 for a Hollowmere kill (hates the Bent), the Saltbeasts +1 for half a Clatter; `repOnKill`; a kill with no source or by a creature moves nothing; `killMonster` by you −5, with no source 0 |
| **Bot: hit a villager → witnesses hostile, rep drops** | Seed 1234, the start floor, a Hollowmere "reed-cutter" beside you and two fellows in sight 2-6 tiles off, a Clatter trader in sight, a fellow 14+ tiles off, one behind a wall: **map** (walking into it, `mapStep`): Hollowmere 100 → 90 at the first blow, the villager and both witnesses hostile, the Clatter trader, the far one and the one behind the wall neutral, killed in 3-4 blows → 85, the Assize −700 → −698; after 3 s of `ai.updateCreatures` 2 of 2 witnesses hunt you, nobody else does. **3D** (`playerMelee`): the same, killed in 3. A follower's blow −10 with grudges on `player` and the follower; a blow at an Assize member already out for a Bent you: 0 and no grudges; an unseen blow: 0, a grudge. On the open span 1,0,0: a fellow in sight 11 tiles off is a witness, one 13 tiles off isn't |
| **Builders: valid nodes for every legacy and fixture talker** | 566 talkers walked to depth 4 (every option's `go()`): the 11 legacy people with their own dialogues (Maren, Pell, Sir Corwin, Brann, Mira, Rook, Lio, Ess, Tee, the Speaking Door, the Shrine), each of the 5 roles × 22 factions × 5 bands, and the 5 roles with no faction: 18,777 nodes, 0 problems. A refusal at Dark is one goodbye; every role of a single faction speaks curtly at Cold; a Drover merchant of each temperament at −400 keeps its pack shut; greetings ≤ 140 letters |
| **JSON-only state** | `game.state.rep`, `game.state.knownFactions`, the victim's and a witness's `brain` survive `JSON.parse(JSON.stringify(...))` unchanged, with no Map, Set or function; the save codec's `trimCreature` → `rebuildCreature` keeps `faction` and `brain.grudges`; `state.rep` holds only what moved (`{"hollowmere": 90, "kites": -63}`) |
| The factions screen | P opens it on the map and in 3D, it lists what you know (16 at a Bent start) with the band's light word, ↓ moves the row, P's key repeat keeps it open, a "*" binding (M, N) gets through, P and Esc close it |

## 2. The browser

Served by `node tools/serve.mjs 8646`, `?silent=1` and the zero-gain sink, no console error:

- `tools/browser-ws6.mjs` at 1280×720 and 600×330: PASS. The factions screen by P on the map, ↓↓ to row 2, a click on
  "Esc close" → map, P twice; in 3D P → factions, Esc → explore; a Hollowmere villager struck on the map with two
  fellows in sight: 100 → 90, all three hostile, one line "Hollowmere saw you strike the reed-cutter." in the log
  (above "You hit the reed-cutter (5)."); a Noon Vigil priest (a builder's talker) by a bump: option 3 shows the
  faction's lore.
- At the final head (`a4ed51d`): `browser-ws6` PASS again; `browser-0d2 --all` PASS (boot with 152 modules and no
  console error, with and without `quick=1`; imports 1 of 1; `test-world.html?all=1` 34 passed, 0 failed, social
  3.4 s in the page); `browser-shell` PASS at 1280×720 and 600×300 (43 mode changes each); `browser-0c` PASS for
  seeds 1234 and 7 (legacy and d20 fights in both views, Pell's talk, shop and services, 0 errors).
- An earlier `browser-0d2 --all` run read social failing ("a fellow behind a wall: hostile"): the gate verifier
  was mutating `reputation.js` in the same worktree at the time. Rerun on the clean tree: PASS.
- `browser-0d1` was not run: its mode tour fails on any screen nothing in it opens, so on this branch it would read
  "modes never reached: factions" (P0's tool; integration request 10 has the block, as WS5's request 18 did).

## 3. Timing

- `check-perf --against p0-done --rounds 2` alone (3 alternating runs each, 164.5 s, other sessions busy): every item
  over budget was the machine's (p0-done as slow) but two: surface generation's max (681 vs 361 ms; WS6a doesn't touch
  generation, and p0-done's own p95 read 223 ms in the same run) and **passTime ×1.47** (15.2 vs 10.4 ms).
- passTime asks `attitude` for every pair of creatures. A micro-benchmark (60 legacy creatures × 61, 400 rounds, each
  tree in its own process, alternating): the first `attitude` cost 912-1118 ns a call against the P0 stub's 636-829
  (×1.45). Fixed in `be92e83` (no allocation for a creature with no faction): 190-383 ns against the stub's
  1462-1843 in the same rounds. passTime alone (the check-perf scenario, 30 seconds a run, 6 alternating runs):
  median 36.6 against 33.0 ms with the machine loaded (p0-done's own runs ranged 17-41 ms): within the noise.
- **The recheck at `a4ed51d`** (every fix in): a full run-all on the loaded machine read 33 of 37, the four timed
  checks failing (396 s against 152 s for the earlier run). Alone, alternating with a full `p0-done` copy once the
  machine was quiet: check-status PASS 3 of 3 each; check-stats PASS 2 of 2 each; check-dungeons p95 23.8 / 24.2 ms
  against `p0-done`'s 23.0 / 24.6; **`check-perf --against p0-done --rounds 2` PASS** (45.3 s): passTime p50 5.79
  against 5.53 ms (×1.05), mapStep 1.59 / 1.51, refresh 7.71 / 7.88, surface generation p95 26.7 / 25.3 and max 137
  / 120 (budget 150), dungeon generation p95 29.7 / 32.6, the dungeon frame 12.0 / 11.7, the outdoor frame 22.7 / 22.2
  (over the 17 ms budget in both trees: the machine's).

## 4. Deviations

1. **attackPenalty −10** is this workstream's number: the bible gives sizes for kills (−5 / −50) but none for a blow.
2. **A talker that can't fight is wary where a fighter would be hostile**, and refuses to talk only at Dark; at Cold,
   or wary, it speaks curtly and a merchant keeps its pack shut. Until WS8 gives people health (request 1), every
   talker is one that can't fight.
3. **Ghosts and the dark-sighted** (bible §15.4 over TECH_DESIGN §2.11's plain "ghost vs non-ghost → unaware"): a
   creature that sees in the dark perceives ghosts and is perceived by them. For legacy creatures this turns a few
   pairs from "unaware" to "neutral" (the Gloom Warden, the Lich King, Brann); nothing in the game tells the two
   apart but the witnesses.
4. **The Assize's hatred of "the Bent"** is a hidden group `bent` with Hollowmere and the Bent villages under it.
5. **The quick game's player** has no genotype and reads as Bent for the starting reputation.
6. **The Bent villages** are one rep pool (`bentVillages`) until WS7 gives each village its own faction.
7. **Known factions** at the start include every faction you start away from 0 with (16 for the Bent): your birth
   told you who loves and hates you.
8. Grudges never expire, and "Hollowmere saw you strike…" is logged before the combat line of the same blow.

## 5. Verification

Two independent read-only verifiers (subagents briefed with the contract and the code, not with my conclusions),
then fixes, one commit per finding, each with a check-social assertion that fails without it (each fix was
mutation-checked: the old file put back, the check run, the assertion seen failing, the fix restored).

**Spec and code review** (at `1bcbd78`): 5 defects, 8 nits.

| Finding | Fix |
|---|---|
| 1. A cycle of leaders (a.leader = b, b.leader = a) made `attitude` recurse for ever; the same for a cycle of parent groups in `relation` | `f3b2b7c`: a depth guard (more than 6 leaders: neutral), the parent walk capped |
| 2. Harm without a source counts as yours: spikes (`traps.js` → `applyDamage`'s default `src = player`) give grudges and cost rep; a status death is your kill | other owners' files: integration request 2 widened (`350d71b`) |
| 3. The factions screen took every key (M and N never reached) and P's key repeat closed it | `aebdd01` |
| 4. Cold was unreachable for a talker of one faction (wary and hostile both refused), and the test's Cold-merchant branch never ran | `2208fa8`: refuse at Dark or when a fighter is out for you; Cold or wary → curt, the pack shut |
| 5. Followers skipped the house rule (a deep follower struck a flat monster across the plane) | `525a434` |
| Nits: −2.5 rounded to −2 but +2.5 to +3; a non-number `repOnKill` stored NaN; the rep bar 26 cells against 25; the test header; docs (Cold, the talker line, legacy differences, grudges) | `d5b1bb0`, `a28515a`, `350d71b`; the witnesses' line of sight and range edges untested → `6e9ac5f` |

**Gate, the old game and mutants** (at `350d71b`):

- Gate rerun: check-social, check-golden (mechanics 86, frames 27, dungeons 95, vaults 28, temple 2, 0 mismatched),
  check-screen-frames (47, 0 mismatched), check-legacyfights (map 1,359 steps, 3D 1,027, 0 differing), check-bot (10 of
  10 encounters, 7 quests, seeds 1234 and 7, both views), check-determinism (956 bodies), check-talk, check-ai,
  check-combat, check-imports (192 modules each alone), check-names, check-save, check-creatures, check-shell, check-hud:
  all PASS.
- **The old game against `p0-done`, both views:** one legacy run (seed 9001, Math.random seeded) on both trees, 7
  levels (1, 2, 3, 5, 7, 8, 11), each 120 map key presses and 400 3D frames with melee every 15 frames and throws:
  1,062 points compared (zone, mode, the player's hp, position, xp and level, the last 4 log lines, every creature's
  type, position, hp, state, brain and talk state): **0 differ** (42 kills, 9 zones; no legacy creature ever got a
  grudge).
- `attitude` over 2,381 pairs of the 30 legacy types and you (grudge variants included): 314 differ, none reachable
  in the old game: 12 plain pairs unaware → neutral (ghosts and the dark-sighted: Brann, the Gloom Warden, the Lich
  King, shades, wraiths; deviation 3), and 302 only with a grudge that no legacy fight can make (talkers can't be
  struck; legacy creatures fight only what they're hostile to). Only `witnessesOf` reads "unaware", and it needs a
  faction; ai.js and creatures.js test "hostile" only.
- **Mutation testing:** 45 mutants, 32 killed, 13 survived (test gaps): all 13 closed in `a4ed51d` and `841cfbd`
  (12 rerun as targeted mutants: each now killed; the type-temperament one in `841cfbd`).
- Defects:

| Finding | Fix |
|---|---|
| 1. `standingOf` sorted a type's cached membership list in place, changing every creature of that type's temperament (latent until WS7's villager types carry factions); a mutant also showed the cache going stale when a type's `factions` changed | `841cfbd`: a copy is sorted, the cached list frozen, the cache keyed on the table |
| 2. A grudged Grey talker met for the first time said "You again. Say it quickly. New face." | `434ad90` |
| 3. `killed()` charged you for your own follower's death | `97f81c9` |
| Minor: `addRep(±Infinity)` moved nothing, `addRep` without state returned 0, `band(NaN)` was Bright | `9f3367b` |
| Request 2 confirmed (`applyDamage` with the default source: Drovers −10 and a grudge; with `src: null`: nothing) | integration request 2 |


## 6. The recheck and the tag

- `node tools/run-all.mjs` at `a4ed51d`, the machine quiet but run-all's 11 jobs in parallel: **36 of 37** (193 s),
  every functional check passing; `check-perf` failing in it (passTime ×1.95 and mapStep ×1.53 against `p0-0d1` in
  its 2 rounds, gen.dungeon ×1.14, everything else ×0.6-0.94). Alone: `check-perf --against p0-done --rounds 2`
  **PASS** (§3: passTime ×1.05), and `check-perf --against p0-0d1 --rounds 3` (the machine loaded again): passTime
  ×0.75, mapStep ×0.89, one item flagged, surface generation's max ×1.17 (838 against 717 ms, a single-sample max in
  code WS6a doesn't run; ×1.15 in the quiet run). As the integrator's merges and WS4a recorded, the in-run-all timing
  is the machine's; nothing timed is this tree's doing, and no budget was loosened.
- The earlier run-all at `a4ed51d` on the loaded machine (33 of 37, the four timed checks) and each timed check
  alone with `p0-done` alternately: §3.
- Tag `p1-ws6a` on `ws/ws6`, pushed. Next in this worktree: WS6b (`docs/ws6.md` "Handoff").
