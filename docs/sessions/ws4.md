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

(Filled in after the verification: section 5.)

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
   purse, loses 50 of the bible's 250. Which one is the user's call (balance, C2/C4). The test world starts every run
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

(Filled in after the independent verification.)
