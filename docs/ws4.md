# WS4: character creation and progression

Phase 1 workstream (TECH_DESIGN §8.3 "WS4", with DECISIONS: the genotypes are `bent` (mutations; the points are
creases) and `plumb` (implants; grade), the run modes `oneWick`, `commonsLamp` and `pilgrim`, combat is d20, bible
§15.9's two progression tracks). Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws4`, branch `ws/ws4`, from `p0-done`.
Files (§8.4): `progression/*`, `abilities.js`, `player.js`, `leveling.js`, `screens/create.js`, `screens/charsheet.js`,
`screens/abilities.js`, `screens/levelup.js`, `content/genotypes.js`, `content/backgrounds.js`, `content/mutations.js`,
`content/powers.js`, `tools/check-progression.mjs`, `tests/checks/progression.js`; new: `tools/browser-ws4.mjs`.
Gate numbers: `docs/sessions/ws4.md` (a "4a" part, then a "4b" part).

WS4 is two sessions in one worktree and on one branch: **4a** tags `p1-ws4a`, then a **4b** session continues here from
the Handoff below and tags `p1-ws4b`.

## 4a / 4b

Everything new that changes the game's numbers is behind **`RULES.stats = "attributes"`**: under the legacy set
(still the default until the integrator's flip, §8.5) a quick game makes the same player, levels up with the same
+3 HP and the same card (`hud.js` `drawLevelUp`), and offers perks with `Math.random` from the parent's 25 in the
parent's order, so golden (a) and (b), the 47 recorded screen frames and the legacy fights match.

### 4a: creation, stats, leveling (`p1-ws4a`)

| File | What 4a builds |
|---|---|
| `content/genotypes.js` | `GENOTYPES.bent`, `.plumb` (bible §10.3, §15.6): base 10 + 44 points / base 12 + 38 points, 1 point per +1 to 18 then 2, at most 22 at creation before the background; creases 12 (+1 a level) or grade 2 with a free implant costing ≤ 2; the naming culture |
| `content/backgrounds.js` | the 12 backgrounds of bible §10.9-§10.10: attribute bonus, 2 trees, kit, glim (60-250), reputation changes, the Plumb's Level (Vey, Orrum, Cassin) and free implant. Kit items the game doesn't have yet are listed for WS5/WS8/C4 and left out (or given when their kind is registered) |
| `content/powers.js` | `POWERS`: the parent's 25 perks moved here with their trees (bible §10.8), the general pool (Tough, Mighty) and the majors; the bible's other powers listed with what they wait for (`needs`) and never offered until it lands. `leveling.js` `PERKS` is the same table |
| `progression/chargen.js` | `makeCharacter(choices)`; point-buy (`pointCost`, `pointsSpent`, `pointsLeft`, `canRaise`, `canLower`, `suggestSpread`); `validateChoices`; `suggestName` (bible §2.3: Marshfolk for the Bent, Plumb names with a Level); `beginRun(game, choices)` (the run started with the made character, its mode and its reputation changes) |
| `progression/index.js` | the `origin` bonus source (background attribute bonuses, Vey's +3 examine, Orrum's +1 natural armour); no longer a stub |
| `player.js` | `makePlayer()` unchanged (the quick game); the seam `beginRun` hands its character through |
| `leveling.js` | `lvlXP`, `killXp`, `xpFor` (bible §10.7, §15.6), Pilgrim's XP (kills 0, every other source × 2.2), and under the attribute set each level's HP (`max(1, 3 + TOU mod)`, derived), +1 crease for the Bent, an attribute point at levels 4, 8, 12…, one power from 3 seeded offers (4 at INT 18+), a major among them every 5th level |
| `screens/levelup.js` | the attribute set's level-up card (an attribute point, then a power, by keys or mouse); the legacy card unchanged |
| `screens/create.js` | the wizard: genotype → background → attributes (point-buy with live HP, DV, AV, MA) → mutations (offers from `mutationOffers` over `content/mutations.js` as it stands: empty in 4a, so the creases are kept) or the free implant (WS5's seam, or the background's named one with a stub) → name (å, ä, ö type; a suggestion) → mode → confirm. Pushed by WS9's title with `{ seed, mode }` |
| `tests/checks/progression.js`, `tools/check-progression.mjs` | the 4a acceptance in Node (and `test-world.html`) |
| `tools/browser-ws4.mjs` | the wizard by keyboard and by mouse in headless Chromium (`node tools/serve.mjs 8644`, `?silent=1`) |

**4a's acceptance** (§8.3, with its numbers in `docs/sessions/ws4.md` "4a"):
1. Every genotype × background creates a valid player with `RULES.stats = "attributes"` (attributes in bounds and the
   points exactly spent, HP = TOU + 4, the kit and the purse, plain JSON through the save codec, a step in each view).
2. Level 1 → 20 simulated without errors, for both genotypes: the HP, crease and attribute-point schedule, one power a
   level, 4 offers at INT 18+, a major at levels 5, 10, 15, 20; the offers identical for the same seed.
3. The full wizard by keyboard (a name with å, ä, ö) and by mouse, in the browser (and in Node through the real
   key and mouse dispatch).
4. The old game as it was under the legacy set: golden (a) and (b), the screen frames, the legacy level-up card.

### 4b: mutations, abilities, screens (`p1-ws4b`)

| File | What 4b builds |
|---|---|
| `content/mutations.js`, `progression/mutations.js` | ≥ 16 physical and mental mutations, 4 defects, 2 planar ones that bridge the views; `mutationOffers` (3 seeded offers, one of them planar), `gainMutation` (4 creases), `raiseMutation` (1 crease, cap floor(level / 2) + 1, at most 10), defects refunding 2-3; Cast (bible §10.3); the reputation changes of bible §10.4 |
| `abilities.js` | Fold Step becomes the Bent's mutation (bible §15; `0D2.md` deviation 17), the innate grant dropped (id `foldStep` and hotbar key 1 kept); mutation and power abilities as sources; the map's target through WS8's screen (integration request 1 below) |
| `screens/abilities.js` (B), `screens/charsheet.js` (K) | the list with cooldowns and assigning to 1-9; the sheet's tabs (attributes and derived stats, mutations or implants, powers, effects); the hotbar hint `0D2.md` §5 asks for |
| `screens/create.js` | the mutation step with real offers (4a's step already spends creases through `gainMutation` once it exists) |
| `progression/*` | spending creases after creation (the sheet), the crease economy at level-up |

**4b's acceptance:** mutation offers identical for the same seed; each active mutation fires through the 3D aim path
and the map's `requestTarget` in Node; abilities in both views with the same cooldown seconds; the B and K screens at
100×30 and by mouse in the browser.

## Public API

(Filled in as 4a is built.)

## Integration requests

(Filled in as 4a is built; WS8's requests 1, 8 and 11 are WS4's.)

## Handoff

(Written at the end of 4a, for 4b.)
