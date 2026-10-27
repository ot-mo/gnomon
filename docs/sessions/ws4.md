# WS4: character creation and progression

Phase 1 workstream (TECH_DESIGN §8.3 "WS4", with DECISIONS.md), in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws4`
on `ws/ws4`, from `p0-done`. Two sessions: **4a** (creation, stats, leveling; tag `p1-ws4a`) and **4b** (mutations,
abilities, screens; tag `p1-ws4b`). The split, the public API, the integration requests and the handoff are in
`docs/ws4.md`.

# Part 4a

Local session, 2026-10-27, on Windows 11 (i7-10750H, Node 20.11.0, headless Chromium from Playwright), with WS9, WS5
and the integrator running on the same machine. One commit per step, each pushed:

| Commits | What |
|---|---|
| `fbc54fc` | `docs/ws4.md`: the 4a / 4b split and each half's acceptance |
| `dcc5dd9` | `content/genotypes.js`, `content/backgrounds.js`: the two genotypes, the 12 backgrounds and the Plumb's Levels |
| `217c645` | `content/powers.js` (the parent's perks as powers, in 16 trees, with the bible's other powers) and `leveling.js` (the attribute set's levels, XP, seeded offers) |
| `39b1157` | `progression/chargen.js` (`makeCharacter`, point-buy, names, `beginRun`), `progression/index.js` (the "origin" bonus source), `player.js` (`quickPlayer`, `nextRunPlayer`) |
| `08ecf76` | `screens/levelup.js`: the attribute set's level-up card |
| `e7ab4c8` | `screens/create.js`: the creation wizard |
| `eb17611` | Fix found by the check: a card's INT point to 18 draws the fourth offer; a TOU point raises current HP too |
| `8cc6d5e` | `tests/checks/progression.js`, `tools/check-progression.mjs` |
| `2a88d58` | `tools/browser-ws4.mjs` |
| `037fb55` | `docs/ws4.md`: public API and integration requests |

Size: `src/` +1,164 / −92 lines (9 files); tests and tools +618 / −12.

## 1. What was built

| Part | Files |
|---|---|
| `bent` (base 10, 44 points, 12 creases and +1 a level) and `plumb` (base 12, 38 points, grade 2 and a free implant costing at most 2); 1 point per +1 to 18, then 2; at most 22 at creation | `content/genotypes.js` |
| The 12 backgrounds of bible §10.9-§10.10: bonus, two trees, kit, glim, reputation changes, the Plumb's Level and free implant | `content/backgrounds.js` |
| `POWERS` (62): the parent's 25 perks with their trees (bible §10.8), the general pool, the majors, Crushing and Long reach, and the bible's 35 others listed with what they wait for (never offered; nor is the Haggler under the attribute set). 26 powers, 33 ranks, are offered today: enough for a power every level to 34 | `content/powers.js` |
| `makeCharacter`, `validateChoices`, the point-buy, the suggested spread, bible §2.3's names, `beginRun`; the background's bonus through the "origin" bonus source | `progression/chargen.js`, `progression/index.js`, `player.js` |
| The attribute set's leveling: HP derived (max(1, 3 + TOU mod) a level), a crease a level for the Bent, an attribute point every 4th level, powers offered 3 (4 at INT 18+) with a major first at milestones, seeded; `killXp`, `xpReward`, Pilgrim's XP | `leveling.js` |
| The level-up card under the attribute set (the attribute point, then the powers); the parent's under the legacy set | `screens/levelup.js` |
| The wizard: genotype, background, attributes, mutations or implant, name, mode, begin; keys and mouse | `screens/create.js` |
| The 4a acceptance in Node and in the browser's test page; the wizard by real input in headless Chromium | `tests/checks/progression.js`, `tools/check-progression.mjs`, `tools/browser-ws4.mjs` |

## 2. Gate results (4a's acceptance)

At the tag, after the verification's fixes (section 5). `node tools/check-progression.mjs` (Node; it also passes in
the browser's `test-world.html`, through `tools/browser-0d2.mjs --only progression`):

| Acceptance item | Result |
|---|---|
| **1. Every genotype × background makes a valid player** under `RULES.stats = "attributes"` | **Pass**: 84 characters, the 12 backgrounds × 7 spreads (the suggested one, everything into the first attributes, everything into the last, 4 seeded random ones), every point spent: base attributes as bought and in bounds, the background's bonus through the stat bus, HP = TOU + 4 and full, DV = 6 + AGI mod, AV from the kit plus Orrum's +1, Vey's +3 examine, the kit (a weapon in hand, the belt, the pack's kinds), glim and purse, the trees, 12 creases or grade 2 with the Level's implant, plain JSON and whole through the save codec. Each background's run begun (`beginRun`): the mode, its reputation changes, its glim in the world's purse, a step on the map, a walk in 3D. Point-buy: 7 costs, 18 wrong choices each refused for its own reason; the Plumb's implant (7 choices, and the cost limit with test implants in WS5's table) |
| **2. Levels 1 → 20 simulated without errors** | **Pass**: all 12 backgrounds climb through the card's real keys, 228 level-ups: at every level full health before and after, max HP = TOU + 4 + (level − 1) × max(1, 3 + TOU mod) + gains, the log line and the card's gains line ("+5 max HP · +1 crease · an attribute point"), a crease a level for the Bent (31 at 20), 5 attribute points (4 … 20) each spent on its card, 19 power ranks, 3 offers or 4 at INT 18+ (11 of the 12 reach it), none waiting or maxed, from the open trees and the general pool first, a major first at 5, 10, 15, 20. Levels 3-8 in one gain: the cards in order with their own points and milestone; a point kept for later. Two gifts at 10: their own draws, no milestone. Seed 77 twice: the same 19 offers; seed 78: all 19 differ. killXp (7 cases), Pilgrim (a kill 0, a quest ×2.2), xpReward |
| **3. The full wizard by keyboard (a name with å, ä, ö) and by mouse, in the browser** | **Pass**: `tools/browser-ws4.mjs` in headless Chromium at 1280×720 (160×48 cells) and 600×330 (100×30): a Bent by keys (Esc back, a point moved with the arrows, "Åsa Öberg-Ärla" typed over the suggestion with real keydowns, Shift before each capital and å ä ö as a Swedish keyboard sends them, Commons Lamp), a Plumb by mouse (rows, [-] [-] [+], [ Next ], [ Suggest ], Pilgrim, a step at the top, [ Begin ]), a level gained and a power clicked; each run holds exactly the choices made; no console error, the audio rerouted to a muted sink. In Node (check-progression §4) the same by `dispatchKey`/`dispatchMouse` at 100×30, with the refusals, the stale-suggestion and top-step cases, and all 7 steps held to the screen |
| **4. The old game under the legacy set** | **Pass**: check-progression §6 (a level gives +3 HP with the parent's line and card, "You gain a perk", offers only from the parent's 25), and the verifier's byte-for-byte comparison with `p0-done` (section 5); golden (a) 86 of 86 in both views, golden (b) 27 of 27, the 47 screen frames, the legacy fights |
| Names (bible §2.3, §15.11) | 30,000 suggestions, none banned or too long; all 3,669 words the parts can make clean |

`node tools/run-all.mjs` at the tag: section 6.

## 3. Deviations from the design, with reasons

1. **Kits in the parent's item kinds.** The bible's kits name items the game doesn't have yet (a copper hand-axe, a
   reed cloak, balms, a lantern-flail, stilt sandals, a theodolite…). Each kit gives the nearest parent item as a
   stand-in (a short sword for the hand-axe, healing potions for balms, a mace for the lantern-flail, a spear for the
   bone staff) and lists the rest as `wants` (integration request 9). Every kit holds a blade: player.js and hud.js
   read the held weapon, so the bible's kits without one (Mesa Runner, Archivist, Surveyor, Lamplighter) get a dagger.
   WS8's sling and bolt-bow are in the kits and are given once their kinds are registered.
2. **The Lamplighter of Cassin starts with the 500 purse**: its 250 glim doesn't fit the 200 one (the bible gives no
   purse, and DECISIONS starts everyone at 200). Every other background's glim fits 200. A 500 flask is worth something
   in a shop, so this gives the Lamplighter a little more than the bible says; the other way, 200 glim in the 200
   purse, loses 50 of the bible's 250. **The user chose the 500 purse on 2026-10-27**, so it stays as built. The test world starts every run
   with 1,000 (game.js `startRun` applies the world's `startPurse` after the player is made, for the parent's prices),
   made characters too; their glim stays the background's.
3. **The background's attribute bonus is a bonus source** ("origin"), not added to the base attributes: the base
   holds what you bought (R3), the sheet can show the bonus apart, and the Levels' bonuses (Vey +3 examine, Orrum
   +1 AV) ride the same source.
4. **Powers.** The parent's perks keep their numbers (Tough +8 HP, Keen eye +8% crits…); the bible's other powers are
   listed with `needs` and never offered until their hook lands (integration requests 2, 6, 7, 11), the Haggler among
   them under the attribute set (the legacy set offers it as before). While your open trees are thin, offers are
   filled from the other trees, so a level always offers something (bible: open trees and the general pool only).
5. **An attribute point** raises one attribute by 1 (no steeper cost past 18, which is creation's rule), spent on the
   level-up card or kept for a later card (4b's sheet will spend it any time). More TOU raises current HP with max HP.
6. **Fold Step stays innate** for made characters, as for the quick start, until 4b makes it the Bent's mutation.
7. **A kill still gives the parent's XP** (`m.xp`) under both sets: `monsters.js` isn't WS4's (integration request 5).
   Pilgrim's zero for kills applies through `gainXp`'s default source.
8. **The made character reaches `startRun` through `player.js`** (`nextRunPlayer`: `makePlayer()` returns it once)
   until `startRun` takes a player (integration request 4).
9. **The wizard's mode step** starts on the mode WS9's title passes; the seed isn't edited in the wizard (the title's
   seed field does it) but is shown on the last step. The mode names and notes are the wizard's own copy (WS9's
   `RUN_MODES` isn't in this tree).
10. **Levels gained together are resolved in order**, each card with its own level, milestone and seeded offers
    (`p.level − pendingLevels + 1`); the legacy card keeps the parent's rule.
11. **A suggested name stands "fresh"** in the name field: the first letter typed replaces it whole (arrow keys keep it
    to edit).
12. **Starting reputation by genotype** is the faction table's (WS6a, integration request 8); `beginRun` applies only
    the background's changes.
13. **The legacy set's `offerPerks` keeps `Math.random`** (TECH_DESIGN §1.2 asks for seeded offers): the recorded
    level-up frame and the parent's behaviour depend on it. The attribute set's `offerPowers` is seeded by the run's
    seed, the level and a draw, so the flip makes every offer reproducible.
14. **Powers are stored as the parent stored perks** (`p.perks` with `p.perkRank`), not TECH_DESIGN §2.4's
    `powers: { id: rank }`: `stats.js` (frozen) reads `perks` for the powers' bonuses. There are no `hpRolls`: the
    bible's HP a level is fixed (max(1, 3 + TOU mod)), and with TECH_DESIGN §2.6 it follows TOU back to level 1, so a
    card's "+N max HP" is the current figure (a TOU raise since the level raises it for every level). DECISIONS'
    `creases` and `grade` stand where §2.4 has `mp` and `license`.
15. **The wizard runs under either formula set** but is meant for the attribute set: under the legacy set a made
    character reads the parent's numbers (STR = bought − 6, max HP 20). Integration request 13 asks for the flip at
    the WS4 merge, before WS9's title can push it.

## 4. Known issues

- There is no K sheet or B list yet (4b): an attribute point kept "for later" is spent on the next level-up card.
- The mutation step offers nothing until 4b fills `content/mutations.js`: the Bent's 12 creases are kept.
- The Plumb's free implant is named and kept in `origin.implant` but not fitted until WS5's implants exist.
- A quick game under the attribute set (no background) has no open trees: its offers come from the general pool,
  then every tree.

## 5. Verification

Two independent verifiers, each in a detached copy of `ws/ws4` at `037fb55`, read-only to this worktree:
- **Gate and the old game:** check-progression and 16 other checks, the bot; 45 mutants of 4a's code against
  check-progression (30 caught, 15 survived); the old game under the legacy set compared with `p0-done` in Node.
  **The legacy game is identical**: `encodePlayer(makePlayer())`, a quick game's 10 XP gains to level 11 (level, HP,
  XP, pending levels, max HP, log lines), 120 `offerPerks` draws, 10 level-up cards and a gift card as frame text, a
  second run's levels 2-16 (milestones, answers by keys and clicks), `bonusTable` and the encoded player after the
  perks: byte for byte. Golden 86 of 86 steps, 27 of 27 frames, 95 of 95 dungeons; screen frames 47 of 47; legacy
  fights 0 of 1,359 map steps and 0 of 1,027 3D steps differing.
- **Spec and play:** the design against the code (bible §10, §15.6, §2.3, §15.11; TECH_DESIGN §2.4, §2.6, §4.2,
  §8.3); breaking the wizard and the leveling in Node (every step at 100×30 and 180×56, Esc, the wheel, right-click,
  key repeat, 24- and 25-letter names, emoji and combining marks, levels to 45, gifts, save and load with pending
  levels, a quick start under the attribute set) and in headless Chromium (`browser-ws4` and real input of its own:
  Shift, CapsLock, the wheel, a window resized between steps). Everything listed under "matches the bible" held.

Every finding was reproduced before it was fixed, one commit each, with an assertion that fails without the fix
(shown by taking the fix out, or by the verifier's mutant):

| Finding | Fix | Commit |
|---|---|---|
| A click on a step at the top after moving to the other genotype jumped past the reset steps and threw (summary without a background); in the browser the page stopped drawing (self-review, then the spec verifier) | a jump never passes the first step not yet reached | `43f798e` |
| A browser's own Shift keydown before a capital cleared the suggestion's "fresh" mark: "Anna" over "Osmo" gave "OsmoAnna" (both) | Shift, CapsLock, AltGr, dead keys leave the suggestion standing; the check and browser-ws4 type capitals after a real Shift keydown | `2472b27` |
| The level's HP to current HP was never asserted (mutant M01 survived) | full health before and after every level of every climb | `a632bef` |
| Levels gained together credited every attribute point to the first card (spec) | a level's point comes with its own card; levels 3-8 at once in the check (M18, M24) | `fd65c4d` |
| The card's untested paths: open trees first, gifts' draws and no milestone, the gains and log lines (M19, M20, M28, M29, M34, M35) | assertions at every level of the 12 climbs and two gifts at level 10 | `4c73151` |
| The Plumb's implant unchecked (`"bogus"`, `42`); nothing held the cost to 2; the wizard would default to any implant (both) | `freeImplants` (WS5's costing ≤ 2, the background's own first), refused otherwise | `887f1a3` |
| A newline, NUL or a lone combining mark taken as a name (both) | refused: control characters, no letter or digit | `f55fa13` |
| Refusals masked by a second problem (M08: the cap of 22; M27: the Plumb's mutation) | each case names its reason; a 23 that spends exactly 44; a real test mutation | `66f5cc7` |
| The Levels' bonuses read from the table under test (M23, M36) | Vey +3 examine, Orrum +1 AV written out | `0b72288` |
| An untouched suggested name kept the old genotype's culture or Level (spec) | dropped and suggested again; a typed name stays | `2699a64` |
| The purse was checked only before the run began (the test world's 1,000 replaces it) | asserted once each background's run has begun; documented | `d22527c` |
| "Every step fits 100×30" had nothing behind it | every step: its button, the key help, nothing in the last column | `3fbf9cf` |
| Docs: glim 40-250, the Drovers' names, the wizard under the legacy set, deviations 14-15, the Lamplighter's purse as a balance call (spec, gate nits) | `docs/ws4.md`, these notes | `b2f4075` |
| The name generator rejects nothing (bible §2.3): safe only if its tables are (spec) | every word the parts make (3,669) held to §15.11 | `6d5d60b` |
| (Recheck) `c5c19f6` gave Steady hand `{ missileAcc: 2 }` before `stats.js` has the key: check-content failed | the bonus waits for the key (integration request 2); also the legacy "You gain a perk" line asserted (M26) | `384c7bf` |

Before the verification, check-progression itself found one (`eb17611`: a card's INT point to 18 drew no fourth
offer).

**Left open, with reasons:**
- M17 (the legacy card's key handler taking Digit5) is an equivalent mutant: the return value is unused and Digit5
  isn't bound under it. M16 (legacy offers from every power) isn't caught by check-golden, which calls `takePerk`
  directly, but check-progression §6 and the screen frames catch it.
- The steps along the top clip below about 75 columns (every screen is held to 100×30, §4.4). Lucky's "You gain a
  perk" line is cut at 100 columns, as in the parent game.
- The Lamplighter of Cassin's 500 purse (deviation 2; the user kept it, 2026-10-27), offers from other trees while the open ones are thin
  (deviation 4), the card's current HP figure (deviation 14) and the wizard under the legacy set (deviation 15,
  integration request 13): documented design calls, not defects.

## 6. The recheck before the tag

- **Mutants:** every one of the gate verifier's 15 survivors was rerun against the fixed check: M01, M08, M18, M19,
  M20, M23, M24, M26, M27, M28, M29, M34, M35, M36 now fail check-progression; M17 is equivalent (section 5). The new
  assertions were each shown to fail without their fix.
- **run-all:** after the fixes, 36 of 37 (check-content failed on `c5c19f6`'s Steady hand bonus, fixed in `384c7bf`);
  at `384c7bf` 36 of 37 once more (check-perf at the ×1.15 line on generation, the A/B below); at the tag's tree
  **all 37 checks pass** (132.9 s, 11 at a time; check-progression 84 characters, 228 level-ups; check-perf's
  outdoor frame ×0.99 of `p0-0d1`, surface generation p95 ×1.08, dungeon generation p95 36.7 ms, ×1.06).
- **Timed numbers, alone, against `p0-done` in alternation** (`node tools/check-perf.mjs --against p0-done`; WS9, WS5
  and the integrator were at work on the machine, CPU 20-45% before each run). 4a changes nothing a frame,
  a refresh or generation runs; three runs:

  | Item (budget) | Run 1 (3 + 3 rounds) | Run 2 (3 + 3) | Run 3 (5 + 5) |
  |---|---|---|---|
  | Outdoor frame p50 (17 ms; over at `p0-done` too, WS3's) | 34.68 ms, ×0.92 | 34.56 ms, ×1.18 | 24.26 ms, ×1.02 |
  | Dungeon frame p50 (17) | 18.23, ×0.94 | 15.69, ×0.89 | 12.52, ×1.01 |
  | Refresh p50 (10) | 12.75, ×0.97 | 10.99, ×1.12 | 8.40, ×1.06 |
  | Surface generation p95 (60) | 159.78, ×1.00 | 60.45, ×1.45 | 37.02, ×1.14 |
  | Dungeon generation p95 (40) | 94.97, ×0.94 | 50.64, ×1.12 | 39.64, ×1.14 |
  | Verdict | pass | fail (outdoor ×1.18, surface ×1.45) | **pass** |

  Run 2 is the machine (the same tree measured ×0.92 and ×1.00 before it and ×1.02 and ×1.14 after, with no code
  between them that a frame or a generator runs). `check-dungeons` alone: p95 26.3 ms (budget 40); `check-stats`
  alone: pass.
- **A full run-all at `384c7bf` then failed check-perf** at the ×1.15 line against run-all's reference `p0-0d1`
  (surface generation max 188 ms, ×1.15; dungeon generation p95 47.7 ms, ×1.15), and check-perf alone once more read
  dungeon generation ×1.32. 4a has no code in generation, but the numbers kept leaning that way, so a direct A/B: this
  tree's `src/` against `p0-done`'s (`git archive` unpacked), one `check-perf --child` process at a time, alternating,
  8 rounds each (medians of each run's p95 / p50):

  | Item | This tree | `p0-done` |
  |---|---|---|
  | Dungeon generation p95 | 40.6 ms | 41.3 ms |
  | Surface generation p95 | 38.2 | 41.0 |
  | Dungeon frame p95 | 22.6 | 25.9 |
  | Outdoor frame p50 | 27 (24.2-34.0) | 29 (24.0-34.4) |
  | Refresh p95 | 13.8 | 14.4 |

  No regression; one tree's runs spread about 30% on this machine while the other sessions work. The tag's run-all is
  the "run-all" item above.
- **Browser, at the tag's tree:** `tools/browser-ws4.mjs` passes at 1280×720 and 600×330; `tools/browser-0d2.mjs
  --only progression,imports,abilities,shell,hud` passes (both boots, 156 modules in the page, the five checks in
  `test-world.html`). The server on 8644 was stopped and no browser left open.

# Part 4b

Local session, 2026-10-27, same machine and worktree, from `p1-ws4a` (with `95f8fcc`, the docs-only note on the
Lamplighter's purse). WS9, WS5 and the integrator (merging `p1-ws4a` meanwhile) ran alongside; paused once at the user's
request (`239ea11`) and resumed with WS9 and WS6a. One commit per step, each pushed:

| Commits | What |
|---|---|
| `47d30d8` | `content/mutations.js`, `progression/mutations.js`, `progression/abilities.js`, `progression/index.js`, `abilities.js`, `player.js`, `progression/chargen.js`: the mutations, their economy, Cast, their abilities; Fold Step as the Bent's mutation |
| `83c4db4` | `screens/abilities.js` (B), `screens/charsheet.js` (K) |
| `a7db9a5` | `screens/create.js`: the mutation step with real offers and the defects |
| `beb5f72` | `tests/checks/progression.js` section 7 (4b's acceptance) |
| `27ec9f1` | a picked tile on the map honoured by every ability that aims; `tools/browser-ws4.mjs` part 4b |
| `fe46ed3` | `docs/ws4.md`: 4b's table, API, the mutations for the balance pass, integration requests 15-23 |
| `1b60896` | the level-up card tells the Bent the creases to spend |
| `a8adecb` | (self-review) Cast's wakes fade after a world hour, 60 s of game time |
| `420a6f5`, `239ea11` | the integrator's implant ids; a WIP handoff (paused at the user's request) |
| `691727a` … `82614cf` | the verification's findings, one commit each (section 11) |

## 7. What was built

(see `docs/ws4.md` "4b" for the file-by-file table and the mutations with their numbers)

- **20 mutations** (`content/mutations.js`): 12 physical, 4 mental, 4 defects. 11 are planar (bible §13.5's ◆: every
  offer of three holds one), 5 of those carry one view into the other (`bridge`): Flatwise (pressed flat from either
  view: only the map holds you), Echo Throat (a shout in either view puts what's around you on the map), Fold Step (a
  blink where you aim in 3D or toward what you pick on the map), Overlook (a 9 × 9 seen from above, drawn onto the map),
  Shadowsense (every flat being and ghost on the floor marked in 3D and on the map).
- **The crease economy** (`progression/mutations.js`): 12 at creation and one a level (4a), 4 for a new mutation
  from 3 seeded offers, 1 for a level, the cap floor(level / 2) + 1 and the mutation's own max (at most 10), defects
  refunding 2-3 at creation only; spent in the wizard and, any time, on the sheet (K); the level-up card says what there
  is to spend. A mental mutation works at its level + EGO's modifier (at least 1).
- **Cast** (bible §10.3): the sum of the mental mutations' working levels; each turn of the world rolls a wake at
  max(0, Cast − 10 − 2 × EGO mod) × 2% (at most 75%), seeded by the run's seed and the turn; wakes count per zone and
  fade after a world hour; the third calls the pack ("The floor smooths itself out towards you.") and 10 s later emits
  `"smoothers"` with its size, burnisher and Great Smoother (integration request 17 sends it).
- **Abilities**: Fold Step (the P0 sample) is the Bent's mental mutation, 4 + level tiles; the quick start keeps P0's
  innate Fold Step; a made character has no innate ability and its hotbar holds its mutations' abilities in the order
  taken. Eight more abilities (`progression/abilities.js`), each in both views; the `"mutations"` and `"powers"`
  ability sources; `abilityRange`.
- **B and K** (`screens/abilities.js`, `screens/charsheet.js`): the list with cooldowns and hotbar assignment, and the
  hint that keys 1-9 use the hotbar in both views (the hint `0D2.md` §7 asked for, on WS4's own screen); the sheet's four
  tabs, with attribute points and creases spent there.
- **Reputation** (bible §10.4): Wings, Shellback, Lampskin, Flatwise, Gills as the bible's table (Ink Glands, Horns,
  Silk Glands aren't built); Crooked Manner −50 with every faction.

## 8. Gate results (4b's acceptance)

At the tag, after the verification's fixes (section 11). `node tools/check-progression.mjs` (Node; it also passes in the
browser's `test-world.html` through `tools/browser-0d2.mjs --only progression`), its section 7:

| Acceptance item | Result |
|---|---|
| **Mutation offers identical for the same seed** | **Pass**: 300 seeds, each drawn twice: the same 3 offers both times, all different, a planar one in each, never a defect or a mutation you have or one excluded by yours; 221 different sets of three (the spec verifier: 500 seeds with exclusions in place). The sheet's offers stand until one is bought (`offerSeed(seed, gained)`), a defect doesn't redraw them, and they are the three the wizard showed last when you keep your creases (one seed path); the wizard's on seed 777 are the computed ones |
| **Each active mutation fires through the 3D aim path and the map's `requestTarget`, in Node** | **Pass**: all 9 abilities (Fling, Wings, Bellows, Flatwise, Echo, Overlook, Shadowsense, Kindle, Fold Step), each through its real hotbar key in 3D (`aimTarget`) and on the map (`requestTarget`'s stub, the use's map time charged), with its effect: quills land, flight 25 s, fire and burning, flat with the map forced, sightings on the map, a 9 × 9 drawn, flat beings marked in both views (the farthest on the floor too), a brazier lit, a fold of 4 + level tiles (6 at EGO 18). A picked tile with no creature (WS8's screen) honoured by every one that aims; your own tile refused. §7.9 writes the numbers out at levels 3-6 with the combat roll fixed (Fling 1 + floor(L / 2), Bellows L × 1 and L × 4, Flatwise 3 + floor(L / 2), Wings 20 + 5L, Shadowsense 8 + 2L, Echo 6 + L, Overlook's 9 × 9 edges, Kindle 5 + L, Night Eyes 3 + L / 2, the jump) |
| **Abilities in both views with the same cooldown seconds** | **Pass**: from the use to ready again, 3D (1/60 s frames) and the map (the use's map time, then waits): Fling 10 / 10, Wings 60 / 60, Bellows 15 / 15, Flatwise 30 / 30, Echo 20 / 20, Overlook 30 / 30, Shadowsense 60 / 60, Kindle 5 / 5, Fold Step 12 / 12 s; each def's cooldown at levels 1, 5, 12 and its map time written out; exact under skipTime (the spec verifier) |
| **The B and K screens at 100×30 and by mouse in the browser** | **Pass**: `tools/browser-ws4.mjs` in headless Chromium at 1280×720 (160×48) and 600×330 (100×30): B by its key on the map (the hint that keys 1-9 use the hotbar in 3D and on the map alike, a digit, a click on a slot, a right click on it, [ Close ]) and in 3D; K by its key (Tab to the mutations, [+1] on Fold Step, [+4] on an offer, the Powers and Effects tabs by clicks, Esc); every frame of both inside its box; no console error, audio to the muted sink. In Node at 100×30 through the real dispatch: the same and more (Enter, 0, the wheel, attribute points by Enter and [+], the wake chance whole at Cast 20, K's [+4] only when you can buy, the quick start's sheet and list); the gate verifier's fuzz: 21,104 key presses and clicks at 100×30 and 21,460 at 180×56 over B, K and the wizard, no exception |
| The crease economy | 12 at creation (refunds on top), 4 a mutation, 1 a level; the cap 1 / 2 / 2 / 3 / 10 / 10 at levels 1 / 2 / 3 / 5 / 18 / 30 and each mutation's max; every refusal for its reason; EGO's levels (EGO 20: Fold Step at 3, Cast 6; EGO 10: at 1); Spare Heart's TOU and HP at creation and in play; the hotbar in order taken, and a word when every key is taken; bible §10.4's reputation at `beginRun` and in play; the level-up card's creases |
| Cast (bible §10.3) | the wake chances (Cast 12 / 20 / 30 at EGO 16: 4 / 20 / 40%; 75% at most; EGO's levels and tolerance both counted); seeded wakes; two wakes call no pack, the third does, 10 s on, its size, burnisher and Great Smoother; wakes 61 s old don't count, 59 s old do (a world hour); a pack for a zone you've left doesn't come; a forced flat map and turns before the cube aren't turns |
| Defects | Dark-fear (−2 to hit, −1 DV, torch out, held through a 5 s action), Moth-kissed (stealth −0.3, torch lit, saved), Lightsick 1 HP every 20 s in the sun: 3 by waits over 60 s, 6 by a 120 s skip, 3 by sixty 1 s actions, none in 90 s of shade (the count carried over); Crooked Manner −50 with all 21 factions |
| The wizard's mutation step | an offer taken by Enter and by clicks, a defect taken and given back, a give-back refused while its creases are spent, a defect not redrawing the offers, the run begun with exactly the choices (creases and hotbar) |
| The old game under the legacy set | the gate verifier, in Node against `p1-ws4a` and `p0-done`: the quick start's encoded player (innate and hotbar `["foldStep"]`, no mutations), its abilities, Fold Step's numbers and 322 landings (3 seeds × 3 depths × both views), hotbar key 1 in both views, the jump (1.481 blocks), `bonusTable`, `torchRange`, 18 level grids and the first frame: identical. Golden (a) 86 / 86 steps, (b) 27 / 27 frames; 47 / 47 screen frames; legacy fights 0 of 1,359 map steps and 0 of 1,027 3D steps differing. No P0-owned file changed |

`node tools/run-all.mjs` at the tag: section 12.

## 9. Deviations from the design, with reasons

16. **Every mutation costs 4 creases.** Bible §13.5 brackets a cost for each (Night Eyes 1, Fold Step 5…), but §10.3 and
    §15.6 say "a new mutation costs 4" and DECISIONS puts §15 first (TECH_DESIGN §8.3 agrees). The bracketed figures are
    left for the balance pass.
17. **20 of the bible's 40 entries.** The rest wait for hooks other workstreams own or scope forbids (the file's
    header names each reason): TECH_DESIGN §8.3 asks for at least 16 and 4 defects. Every built one works in both views
    or is passive.
18. **Fold Step on the map** keeps P0's targeting (toward the nearest hostile you see, a tile short, or the way you
    face; a landing only where you could walk, never into a chasm) until WS8's target screen replaces the map's
    `requestTarget` at the merge (integration request 1): then it steps onto the tile you pick (honoured already). The
    bible's "if that tile is really a chasm, you fall" waits for that screen too.
19. **The quick start keeps its innate Fold Step** (4 tiles, key 1): its hotbar and the HUD's cooldown line are in
    check-abilities (P0) and the recorded frames. A made character has none, and the Bent who take Fold Step have the
    mutation's 4 + level.
20. **Wings is a timed flight** (20 + 5 × level s, cooldown 60 s) on the flying status, not a toggle: the status is the
    potion's, and a toggle would need a way down that WS8's movement owns.
21. **Mental levels are at least 1** with a low EGO (bible §10.6 says only that EGO adds its modifier).
22. **Defects that come and go are statuses** (`shaken`, `mobbed`, `sunsick`), so they show on the HUD and the stat
    cache drops at once (a bonus reading the torch directly would go stale until something invalidated it). They last
    until their cause goes (the views' watch puts them on and takes them off; a long map action or a skip doesn't end
    them). Lightsick's counts in its own tick only while you stand in the sun, sampled at each of skipTime's short steps
    (so a skip from day into dusk counts the day part), its 20 s count carried over a stretch of shade. It takes no
    account of a hood or veil (none exist: integration request 19). The torch read between two key presses that come in
    one frame (F, then a blow) is the one before the F, until the next frame's watch.
23. **Shellback's armour** counts only with no body armour over it (clothes are none) instead of refusing the armour:
    equipping is WS5's (integration request 19). **Lampskin** can't hide you by a stealth penalty (−0.25) rather than
    the AI's light test, and its free light waits for the torch hook (request 20). **Stilt Legs** climbs 2 blocks on
    the map from level 3 (turns.js's High-jumper threshold), not 5 (request 23); in 3D its jump grows by half a block
    every 2 levels under the attribute set (player.js: 1.5 + the jump bonus; the legacy set's two heights unchanged).
24. **Turns of the world** are watched (the view changing in one zone while you aren't flat) rather than announced by
    `toggleMap` (P0's play.js): integration request 16 asks for a `"view:turn"` event and the Hand's exception.
25. **Overlook's view stays on the map** (the auto-map keeps what you have seen) rather than lasting 5 s.
26. **Parts of bible §13.5's hooks aren't built** where nothing in the game reads them yet: Thistlehide's attackers take
    a flat 2 (the stat bus's `thorns` is one number, the bible says 1-3); Spare Heart's longer sprints (sprints have no
    limit) and Regeneration's "stops bleeding" (no bleeding status); Kindle lights braziers only (torches you carry and
    oil puddles, WS6b's, aren't things it can light) and reaches 5 + level tiles (the bible's 6 at level 1, growing with
    the level so the mutation stays worth raising); Echo Throat puts creatures on the map, not people (a person shows on
    any tile you've seen already).
27. **Exclusions the bible doesn't name** (`excludes`, TECH_DESIGN §2.18's field): Shellback and Wings (a shell and wings
    share one back), Lampskin and Moth-kissed (the moths love your skin: Lantern Moths +200), Night Eyes and Dark-fear (a
    fear of the dark you see in would be three free creases). Each pair is refused at creation and on the sheet with its
    reason; a balance pass can drop them from the table.
28. **A pack for a zone you've left doesn't come**: the Smoothers are the floor's own tidiness (bible §10.3, "along the
    floor"), and the third wake clears that zone's wakes when it calls them. Whether they should follow you is the
    creatures' owner's call with integration request 17.
29. **Shadowsense reaches the whole floor** (the bible gives no reach: "in every view"); its level lengthens it.

## 10. Known issues

- Integration requests 15-23 (`docs/ws4.md`): browser-0d1's tour reports `create`, `abilities` and `char` as never
  reached until the integrator adds them; the Smoothers never come until creatures listen to `"smoothers"`.
- The quick start's `innate: ["foldStep"]` still adds a stray key `"0"` to its bonus table (P0's; integration request 3,
  settled on `integration`, where a creature's own bonuses are `e.bonuses`). K's Effects tab leaves numeric keys out.

## 11. Verification

Two independent verifiers, each in a detached copy at `239ea11` (removed after), read-only to this worktree (a first pair
was started at `27ec9f1` and stopped by the pause before reporting):
- **Gate and the old game:** run-all, check-progression, browser-0d2 and browser-ws4 rerun; the old game compared with
  `p1-ws4a` and `p0-done` in Node (section 8's last row: identical); 62 mutants of 4b's code against check-progression
  (38 caught, 24 survived); a save round trip of a made Bent mid-flight with a pack pending; real Tab presses; the fuzz.
- **Spec and play:** the design against the code (bible §10.3, §10.4, §10.6, §13.5, §15.6, §15.9; TECH_DESIGN §2.7,
  §2.8, §4.2-§4.4, §8.3); breaking it in Node (every mutation bought and raised to its cap through K, defects in odd
  orders, EGO 1 to 40, every ability while paralysed, flying, flat, walled in, at an edge, used by a creature, the stat
  cache under `STATS_DEBUG.verify`, saves) and in headless Chromium (a Bent by real keys and clicks, every ability by its
  key in both views, B and K at both sizes).

Every finding was reproduced before it was fixed, one commit each, with an assertion that fails without the fix (shown
by putting the old file back):

| Finding | Fix | Commit |
|---|---|---|
| (self-review) Cast's wakes faded after 3600 s: DECISIONS makes a world hour 60 s of game time | 60 s; 61 s old don't count, 59 s old do | `a8adecb` |
| The defects' statuses lasted a second, renewed by frames: Lightsick lost 0 HP over a 120 s, 360 s or 600 s skip and over sixty 1 s actions (6, 18, 30 and 3 played out); Dark-fear dropped inside a long action (both) | lasting statuses on and off with their cause; Lightsick's own tick in the sun, stepped through skips | `691727a` |
| K's Mutations tab cut the wake chance at 100 columns ("wakes " at Cast 20) (spec) | the line wraps; the Attributes tab's shortened | `cb1d456` |
| Bellows' burning held the whole player in the creature's status, saved with its zone (spec) | no src | `364b153` |
| The wizard's and the sheet's offers came from two seed paths: six offers for a first mutation kept for later (spec) | one path, `offerSeed` | `20a24d9` |
| A new mutation's ability with every hotbar key taken went on none, silently (spec) | the log and the sheet say B puts it on one | `bc64a58` |
| Shadowsense reached 12 + 2 × level tiles; the bible gives no reach ("in every view") (spec) | the whole floor | `61840c7` |
| Fold Step onto your own picked tile blinked the full reach the way you face (gate, reading) | refused, no cost | `739ead0` |
| Nits: "something stand there"; K's Effects tab by status ids; B's slots cut names to 7 letters; Fold Step's text promised the target screen (spec) | each fixed | `003d908` |
| 24 of 62 mutants survived: each ability held to its own def, everything fired at level 1 inside its reach, the pack's own due time (gate) | §7.9 writes the numbers out; a defect in the wizard doesn't redraw | `26bc67c`, `41b9517` |
| Deviations not written down: Thistlehide's flat 2, Kindle's braziers and reach, Spare Heart's sprints, Regeneration's bleeding, Echo and people, the exclusions, a pack for a zone you've left (both) | deviations 26-29 | `82614cf` |

The integrator asked on 2026-10-27 for the Plumb implants by WS5's ids (`plumbEar`, `knuckles`): `420a6f5`.

**Left open, with reasons:** the timed gates on this machine under three other sessions and the ML job (section 12);
real-keyboard pointer lock on B and K (headless Chromium refuses the lock, so B in 3D is checked through the pause
card's click); the paths that wait for WS8's target screen and WS1's world map (a turn of the world from there).

## 12. The recheck before the tag

- **Mutants:** the 24 survivors rerun against the strengthened check: all 24 caught (the last, the wizard counting
  defects in its seed, by `41b9517`'s assertion).
- **Browser, at the tag's tree:** `tools/browser-ws4.mjs` passes at 1280×720 and 600×330 (B, K, the wizard, the level-up
  card); `tools/browser-0d2.mjs --only progression,imports,abilities,shell,hud,content` passes (both boots, 153 modules,
  no console error; the 6 checks in `test-world.html`). `tools/browser-0d1.mjs`'s shell tour passes and its mode list
  lacks `create`, `char` and `abilities` (integration request 15). The server on 8644 stopped, no browser left open.
- **Timed numbers, against `p0-done` in alternation** (WS9 and WS6a resumed alongside; the CPU at 91% when it began):
  `node tools/check-perf.mjs --against p0-done --rounds 4` (5 + 5 runs): outdoor frame p50 ×0.99, dungeon frame ×1.13,
  refresh ×0.92, surface generation p95 ×1.08, dungeon generation p95 ×0.92, passTime ×1.02, map step ×1.07 (all over
  budget for both trees, so not failed), and surface generation's single max ×1.56 (one outlier of 185). A direct A/B of
  the two `src/` trees, one `check-perf --child` at a time, alternating, 6 rounds each (medians): surface generation max
  223.7 ms against `p0-done`'s 244.1 (×0.92), its p95 ×0.93; dungeon generation p95 ×0.99; refresh ×0.95; dungeon
  frame ×0.90; passTime ×1.05; outdoor frame p50 54.4 against 44.0, where the load fell during round 4 (this tree
  measured before it fell, `p0-done` after): the two quiet rounds read 27.0 / 26.1 against 30.7 / 26.9. 4b adds two
  update hooks a frame (`"mutations:turns"`, `"mutations:defects"`: for the quick start a WeakMap lookup and an early
  return) and nothing to generation. `check-dungeons` alternating with `p0-done`'s own: p95 112 / 117 / 101 ms against
  103 / 104 / 107 (both far over 40 at that load); alone at 68% CPU earlier it passed (37.2 ms).
- **run-all:** 35 of 37 at the tag's tree, twice (515.5 s and 353.7 s, 11 at a time): every check but `check-dungeons` and `check-perf`, which failed with the user's `train.py` job holding the CPU at 91-96% (eight worker processes), their own reference trees as far over budget in the same runs (`p0-0d1`'s outdoor frame 57 ms against 17, its dungeon generation p95 143 ms against 40), and level with `p0-done` in alternation (above). Rerun alone at 94-96% CPU, `check-dungeons` read p95 104.3 ms (budget 40); at 68% earlier it passed. check-progression passes in run-all (68.1 s) and alone (section 8).
  In alternation with `p0-done` (above): check-perf's 5 + 5 runs pooled ×0.92-1.13 on every measure but surface
  generation's single max, which the A/B of `src/` puts at ×0.92; that A/B's quiet rounds ×0.90-1.05; check-dungeons
  p95 112 / 117 / 101 ms against 103 / 104 / 107. **The absolute budgets (§6.7: frames 17 ms, generation 40 and 60 ms,
  passTime 12 ms…) are unconfirmed for this tree until a run on an idle machine.** Tagged on the coordinator's word
  (2026-10-27), as `p0-done` and WS6a were: the only reds are timed checks under the training job, with no regression
  against `p0-done` in alternation.
