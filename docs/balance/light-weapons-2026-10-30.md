# Light weapons: damage per second evened out by swing time

Proposed for the user's approval (2026-10-30), on `p3i-balance` (the approved balance edits applied); nothing changes until they approve.
Every table below has the approved changes in: creature scaling +18% HP a level and +3 damage then +2 every 3 levels,
the barrow troll at HP 30, the planar queen at HP 28, enchantment AV only on armoured pieces, and fists at 0.5 s. Same
typical build and exact model as `proposal-2026-10-30.md` (four fighter backgrounds × 20 seeds, the real world's bands). Scripts (the
analysis agent's scratch folder, not in the repo): `lw.mjs`, `lwgrid.mjs`, `lwfinal.mjs` (tables), `dps.mjs` (by class).

## 0. In short

Today a strong fighter's dagger or stylus deals **about 2.7× the damage per second** of a greatsword or maul. Two
things add per blow: STR over the weapon's requirement (`floor((STR − req) / 2)`) and the material. A 0.3 s blade gets
both 2.7 times as often, and its requirement is low (8 against 17), so its STR term is also bigger.

**Your fix alone** (STR term and material × swing ÷ a reference swing) cuts that gap to about ×1.5. A dagger still kills
about 1.4× faster, because the requirement difference stays in the STR term. **To even it out**, I propose counting STR
over **one bar of 10 for every blade**, as fists already do (`RULES.d20.fistReq`). The requirement then only costs
to-hit when you lack it. Scale by **swing ÷ 0.7 s** (the war axe's swing).

The effective damage-per-second spread across the 13 classes falls from **×2.7 to ×1.2-1.3**. The typical build's costs
stay within a point of the approved table (tiers 5-8: 23.8 / 27.1 / 30.2 / 37.7%, against 23.5 / 27.2 / 30.0 / 38.5%).
A dagger or stylus fighter now pays 22-34% at tiers 5-8 instead of 11-17%. Fists stay below a found weapon at every
tier.

## 1. The rule

| | per blow, d20 set, your melee weapon |
|---|---|
| now | range + material + floor((STR − req) / 2) + enchantment |
| your fix alone (A) | range + round((material + floor((STR − req) / 2)) × swing ÷ 0.5) + enchantment |
| **proposed (B)** | **range + round((material + floor((STR − 10) / 2)) × swing ÷ 0.7) + enchantment** |

- The enchantment stays per blow, as you chose. Scaling it as well changed nothing measurable (gear enchantment is ±
  and averages out); it remains an option.
- Fists use the same rule with their 0.5 s swing. Missiles, thrown knives and the legacy set are untouched.

Why 10 and 0.7: in a grid of bar (the weapon's own requirement, 10, 12, 14, 16) × reference (0.45-0.7 s), every bar of
10-14 evens the classes out. The pair 10 / 0.7 is the one that leaves the approved costs where they were. Bars of 16
put fists above a found weapon. Bar 12 with 0.6 s is nearly the same (within about a point everywhere).

## 2. Exact edits (line numbers in the working tree as it stands now)

1. **`src/rules.js:37`** (RULES.d20):
   - old: `… reqPenalty: 2, reqPenaltyMax: 6, fistReq: 10,`
   - new: `… reqPenalty: 2, reqPenaltyMax: 6, strOver: 10, swingRef: 0.7,`
   - **`:31-32`** comment: replace the fistReq sentence with "strOver: every melee blow, fists too, counts STR over
     this, not over the weapon's requirement, which still costs to-hit when you lack it. swingRef: the STR term and
     the material scale by the weapon's swing ÷ this, so a fast blade's damage per second matches a slow one's."
2. **`src/combat.js:44`**: `import { EYE, attackTime, armourValue, weaponReach } from "./player.js";` → add `FISTS`.
3. **`src/combat.js:92`** (the fists spec): `… material: 0, fists: true,` → `… material: 0, fists: true, swing: FISTS.swing,`.
4. **`src/combat.js:96`** (the weapon spec): `req: strNeeded(it), acc: w.acc || 0, material: it.material || 0 };` →
   `req: strNeeded(it), acc: w.acc || 0, material: it.material || 0, swing: w.swing };`.
5. **`src/combat.js:418`**:
   - old: `if (you && spec.kind === "melee") dmg += (spec.material || 0) + Math.floor((attr(p, "str") - (spec.fists ? D.fistReq : spec.req)) / 2) + spec.ench;`
   - new: `if (you && spec.kind === "melee") dmg += Math.round(((spec.material || 0) + Math.floor((attr(p, "str") - D.strOver) / 2)) * (spec.swing ?? D.swingRef) / D.swingRef) + spec.ench;`
   - Also update the comments at `:17`, `:82-84` and `:414-416` to the rule in §1.
6. **`src/content/items/legacy.js:342`** (the weapon's info line "X-Y damage"):
   - old: `const w = WEAPONS[it.id], m = materialDmg(it);`
   - new: `const w = WEAPONS[it.id], m = Math.round(materialDmg(it) * w.swing / RULES.d20.swingRef);`
   - This is what the material adds per blow. RULES is already imported there.
7. **`src/content/items/forge.js:8-10`** comment: the material's damage is now "× swing ÷ RULES.d20.swingRef".
8. Checks:
   - **`tests/checks/combat.js:249-250`**: the test blade (on the legacy stat set, STR reads 10). Give it a swing that
     exercises the scaling: `{ ...sword, dmg: [2, 5], req: 6, ench: 1, material: 3, swing: 0.35 }` and
     `wantPlain = 3.5 + Math.round((3 + Math.floor((10 - RULES.d20.strOver) / 2)) * 0.35 / RULES.d20.swingRef) + 1` (= 6.5).
     Update the message at `:262` and the comment at `:242`.
   - **`:273, 295-298`**: give the test dagger `swing: WEAPONS.dagger.swing`, and compare bare hands with the dagger per
     second: `fistMean / FISTS.swing < daggerMean / WEAPONS.dagger.swing`. Today this is 1.5 / 0.5 = 3 against
     3 / 0.3 = 10.
   - The typical-build TTK column now going into `ttkTables`: its kit picks the weapon by damage per blow, so that pick
     must use the new rule (my `build.mjs blowValue` calls `lib.mjs bladeAdd`, which is line 5's formula).

## 3. The typical build, tiers 1-8 (cost per kill / your seconds to kill), with the approved changes

The weapon is picked **by damage per blow** (as in the proposal: the best a fighter sees in their finds):

| | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| parent (legacy) | 8.7% 0.97 s | 8.5% 1.04 s | 9.7% 1.58 s | 16.3% 2.16 s | 24.9% 3.01 s | 30.0% 3.67 s | 34.8% 4.49 s | 24.5% 3.58 s |
| before the fix | 9.3% 0.9 s | 10.0% 1.2 s | 10.2% 1.4 s | 17.8% 2.1 s | 23.5% 2.8 s | 27.2% 3.2 s | 30.0% 3.4 s | 38.5% 4.1 s |
| A: swing ÷ 0.5 only | 9.3% 0.9 s | 10.3% 1.2 s | 10.8% 1.4 s | 17.6% 2.1 s | 23.1% 2.8 s | 26.7% 3.2 s | 28.5% 3.2 s | 35.7% 3.7 s |
| **B: STR over 10, swing ÷ 0.7** | **9.7% 0.9 s** | **11.4% 1.3 s** | **11.6% 1.5 s** | **18.6% 2.2 s** | **23.8% 2.8 s** | **27.1% 3.2 s** | **30.2% 3.5 s** | **37.7% 4.0 s** |

The weapon is picked **by speed**: a dagger or stylus (whichever hits harder) in the material of the fighter's found
weapon:

| | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| before the fix | 5.5% 0.5 s | 5.9% 0.7 s | 5.8% 0.8 s | 9.0% 1.1 s | 11.3% 1.3 s | 12.8% 1.5 s | 14.0% 1.6 s | 17.2% 1.8 s |
| A | 6.4% 0.6 s | 7.1% 0.8 s | 7.5% 1.0 s | 12.5% 1.5 s | 15.9% 1.9 s | 18.8% 2.2 s | 20.7% 2.4 s | 25.2% 2.6 s |
| **B** | **7.8% 0.7 s** | **9.1% 1.1 s** | **9.7% 1.3 s** | **16.7% 2.0 s** | **22.1% 2.6 s** | **25.7% 3.1 s** | **28.2% 3.2 s** | **33.8% 3.5 s** |

Two more pick rules:
- **By damage per second** (the best of the finds per second, whatever its weight): before 13.1 / 15.3 / 16.8 / 20.7%
  at tiers 5-8; A 17.6 / 20.8 / 22.9 / 28.4%; B 21.8 / 26.2 / 28.2 / 35.1%. Under B the speed pick, the per-second pick
  and the per-blow pick are within 1-4 points of each other. Today they are 12-21 points apart.
- **Bare hands against the found weapon**, tiers 1-4: B 12.6 / 13.7 / 14.6 / 25.2% against 9.7 / 11.4 / 11.6 / 18.6%.
  Before, 11.1 / 11.4 / 11.8 / 20.3% against 9.3 / 10.0 / 10.2 / 17.8%. Fists stay below a weapon, a little further
  below than before. At STR 25 a punch goes from 8.5 to 6.5 per blow (17 → 13 a second, raw); a tier-3 iron longsword does 24.

Checks under B:
- Its kill of you is 12.1×, 10.0×, 9.7×, 6.1×, 4.6×, 4.2×, 3.7× and 2.9× slower than yours. The weakest single build is
  1.7× at tier 8 (it was 1.4×), so every build now clears the 1.5× rule.
- By background at tiers 5-8: Aspirant 15.5-29.4%, Forgehand 20.5-32.8%, Drover's Child 32.5-48.0%, Reedcutter
  26.7-40.6%, about as before.
- Non-fighter backgrounds (Archivist, Pilgrim, Moth-tender, Lamplighter, Mesa Runner, Night-warden), taking combat powers
  when offered: tiers 1-3 at 13.1-13.5% (was 9.8-10.7%), and tiers 5-8 at 29.1 / 33.3 / 37.0 / 47.6% (was 29.6 / 35.1 /
  37.9 / 43.1%). Low-STR characters lose most: see §5.

## 4. Damage per second by weapon class (a typical fighter's mean STR; the tier's material, +0)

Each cell is **per blow / raw per second / effective per second**:
- Raw per second is the per-blow value ÷ the swing, before misses and soak.
- Effective per second is the typical builds wielding it against the band's creatures, after misses, soak, crits and
  their Quick strikes. It is the number that decides a fight.

The last column is the best effective value ÷ the worst.

**Tier 3, level 8: STR 25, iron (+1)**

| | dagger | stylus | shortsword | hand-axe | staff | spear | longsword | mace | flail | war axe | glaive | greatsword | maul | spread |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 12/40/31 | 12.5/42/31 | 11.5/26/20 | 12.5/25/18 | 13/26/19 | 12/24/18 | 13/26/19 | 12.5/21/16 | 12.5/21/15 | 14/20/14 | 13/19/13 | 14.5/18/13 | 13.5/16/12 | ×2.7 |
| A | 8/27/24 | 8.5/28/25 | 10.5/23/19 | 12.5/25/18 | 13/26/19 | 12/24/18 | 13/26/19 | 13.5/23/17 | 14.5/24/17 | 16/23/16 | 15/21/15 | 17.5/22/15 | 17.5/21/14 | ×1.7 |
| **B** | 6/20/19 | 5.5/18/18 | 8.5/19/17 | 10.5/21/16 | 10/20/16 | 11/22/17 | 12/24/18 | 12.5/21/16 | 11.5/19/15 | 16/23/16 | 15/21/15 | 18.5/23/16 | 18.5/22/15 | **×1.3** |

**Tier 5, level 14: STR 26, blackglass (+3)**

| | dagger | stylus | shortsword | hand-axe | staff | spear | longsword | mace | flail | war axe | glaive | greatsword | maul | spread |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 15/50/44 | 15.5/52/45 | 14.5/32/28 | 14.5/29/26 | 15/30/27 | 15/30/26 | 15/30/27 | 15.5/26/23 | 14.5/24/22 | 16/23/20 | 15/21/19 | 16.5/21/18 | 16.5/19/17 | ×2.7 |
| A | 10/33/32 | 10.5/35/32 | 13.5/30/27 | 14.5/29/26 | 15/30/27 | 15/30/26 | 15/30/27 | 17.5/29/25 | 16.5/28/25 | 19/27/24 | 18/26/23 | 20.5/26/22 | 22.5/26/21 | ×1.5 |
| **B** | 8/27/25 | 7.5/25/23 | 10.5/23/22 | 12.5/25/23 | 12/24/22 | 13/26/24 | 14/28/25 | 14.5/24/21 | 13.5/23/20 | 19/27/23 | 18/26/22 | 22.5/28/23 | 21.5/25/21 | **×1.2** |

**Tier 8, level 23: STR 27, noonsilver (+6)**

| | dagger | stylus | shortsword | hand-axe | staff | spear | longsword | mace | flail | war axe | glaive | greatsword | maul | spread |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| before | 18/60/84 | 18.5/62/85 | 17.5/39/55 | 18.5/37/51 | 19/38/52 | 18/36/50 | 19/38/52 | 18.5/31/43 | 18.5/31/42 | 20/29/39 | 19/27/37 | 20.5/26/35 | 19.5/23/32 | ×2.7 |
| A | 12/40/59 | 12.5/42/59 | 16.5/37/52 | 18.5/37/51 | 19/38/52 | 18/36/50 | 19/38/52 | 21.5/36/48 | 21.5/36/48 | 25/36/45 | 24/34/44 | 27.5/34/44 | 27.5/32/42 | ×1.4 |
| **B** | 9/30/45 | 8.5/28/42 | 12.5/28/41 | 14.5/29/42 | 14/28/40 | 15/30/43 | 16/32/46 | 17.5/29/41 | 16.5/28/39 | 22/31/42 | 21/30/41 | 25.5/32/41 | 25.5/30/39 | **×1.2** |

Under B what is left is the class's own dice per second (longsword 6 ÷ 0.5 = 12, dagger 10, flail 7.5) and soak, which
takes more from many small blows. Heavy weapons now hit hardest per blow, light ones still swing fastest, and no class
wins on both.

## 5. What I'm unsure of

1. **Tier 5 sits at 23.8%**, under your 25-38%. That is no change: the approved table already had it at 23.5%, because a
   quarter of its band are low-tier stragglers. No setting of the weapon fix moves tier 5 above 25% without pushing
   tier 8 past 38%, because the fix acts on every tier alike. Tiers 6-8 are inside the range (27.1 / 30.2 / 37.7%).
2. **Low-STR characters lose.** Below STR 10 the STR term is negative, and around STR 12-16 a dagger now adds +0 or +1
   a blow, where the dagger's requirement of 8 gave it +2 to +4. Light-weapon users are weaker in general. That is the
   point of the fix, but it also lands on AGI builds (Mesa Runner, Night-warden) that start with daggers. Their tiers
   1-3 rise from about 10% to 13%.
3. **Rounding.** One rounding of (material + STR term) × factor. A dagger's factor is 0.43, so its bonus moves in whole
   points: +1 material or +2 STR may add nothing to it. Rounding the two parts apart would be cruder still.
4. **The requirement's meaning changes.** It now only gates to-hit (−2 a missing point, at most −6); it no longer
   shapes damage. Heavy weapons stay heavy through that penalty.
5. **Enchantment is still per blow**, so a +3 dagger gains 10 a second and a +3 greatsword 3.75. Gear enchantment is
   symmetric (±) and rare enough that this did not move the typical tables. If you want it even too, scale it with the
   rest (`… + spec.ench) * (spec.swing …` inside the round).
6. **Exact model, not sampled.** The fix isn't in the game, so these numbers come only from the exact model, which
   mirrors line 5 above. The model matched the game's `resolveAttack` before; it should be rechecked once the edit is in.
