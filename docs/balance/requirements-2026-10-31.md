# Attribute requirements and scaling grades (B4)

Proposed for the user's approval (2026-10-31), on `p4i-six`; **approved and built in `p4b-b4`** (see "Decided"). The
numbers below were measured first on a prototype on the branch `wip/b4-proto`, which was for measuring only and won't be
merged; `docs/sessions/b4.md` has them measured again on the built code. They come from the game's own `resolveAttack`, check-combat's `ttkTables` (the mean of the six build sets, as
you decided on 2026-10-31, with the bounds unchanged) and three scripts in the session's scratch folder (`arch.mjs`,
`dps.mjs`, `ttk.mjs`). Everything here is under the attribute set only (`RULES.stats === "attributes"`). The legacy
set, golden (b) and the legacy fights keep the parent's single STR number.

Your words (2026-10-31): the old STR requirements "seem a little low since most characters start at or above 10
strength", so rebalance them, "possibly multi-stat requirements for certain more specialised items, armours and
weapons"; then: "make it more like Elden Ring's system, where attributes … can be required to use certain items".

## Decided (2026-10-31)

The user's decisions, in the coordinating session, relayed to B4:
- "Then follow your plan for balancing", after the brief.
- **The "used badly" rule:** "no that sounds good". It was put to the user as: you can still use gear you don't meet
  the requirements for, at a to-hit penalty, 60% damage and without its class power, as Elden Ring does it, or else
  it could be truly locked.
- **The growth pace:** "yes", to switching to a point every 3 levels as a follow-up after the requirements build.

Built in `p4b-b4`, with the coordinating session's ruling to take B4's recommendations without asking again:
- the requirement and grade tables of §2;
- the full "used badly" rule of §1 (not the softer one);
- armour by requirements (§4);
- no ×1.5 for two hands;
- an attribute point every 3rd level (§5);
- no INT requirement on artifact weapons. That needs `bodymods/artifacts.js`, and the brief left it open: a request
  in `docs/b4.md`.

Settled while building, after the independent review (`docs/sessions/b4.md`):
- **A weapon in your hand keeps its own bonuses** (properties, a relic's gifts, noonsilver's cut) when used badly. The
  user's rule takes only its to-hit, damage and class power.
- **An armour piece worn badly gives none of its own bonuses.**
- **A weapon in another hand**, never swung there, is held to its requirements as armour is.
- **A piece's penalties (a negative bonus) always count**, so which pieces you meet is the same in whatever order they
  went on.
- **The parent's own legacy-rule caps stay**: −6 at most for a weapon too heavy under the legacy stat set. B4's cap is
  its own, 8.

## 0. In short

- **What's there now.** Each weapon and armour piece asks for one STR number, 6-17. Attributes start at 10 (Bent) or
  12 (Plumb), but character creation's suggested spread puts each one at 17-18 and the background's own at 20-22. So
  everybody can use everything from the first step. Below the number, `body.js canEquip` refuses the item
  (in both rule sets). The to-hit cost for a missing point in `combat.js` therefore never fires for you. Since the
  light-weapon fix, damage counts STR over 10 for every weapon, so the requirement no longer shapes damage either.
- **Proposed.**
  1. Every weapon, missile weapon and armour piece asks for one to three of the six attributes, on the scale
     creation actually uses (the average is 16):
     - light gear asks 15-18: anyone who didn't leave that attribute low;
     - medium gear asks 19-20: a start built for it;
     - heavy gear asks 21-23: a strong start;
     - the great weapons and plate ask 26-29: growth first.
  2. **An unmet requirement doesn't lock the item: you use it badly**, as in Elden Ring:
     - −2 to hit a missing point, at least −4 and at most −8;
     - damage ×0.6, with nothing from your attributes;
     - the class's power is off;
     - for armour, half its AV, −1 DV, and its special (buckler, glass-scale) is off.

     The pack row and the item's line show every requirement, in red when you lack it.
  3. **Damage comes from scaling grades** (S/A/B/C/D/E per attribute) instead of "STR over 10" for every weapon. A
     dagger scales with AGI, a stylus with INT, a lantern-flail with WIL, a greatsword with STR. Materials shift the
     grades the way Elden Ring's affinities do: blackglass is keen (AGI up), truesteel heavy (STR up), pleatmetal
     light, and noonsilver asks for will.
  4. **Armour: requirements, not an equip load.** Heavy armour asks for STR and TOU, so TOU does the job Elden Ring
     gives Endurance (§4).
  5. **Growth: one attribute point every 3 levels instead of every 4** (7 points by level 21 instead of 5). That is
     enough for a build to grow into its next class of gear, and it keeps the typical build's costs inside the bounds
     with room (§5).
- **What it does to fights** (the typical build's cost a kill, tiers 1-8, the mean of six sets; bounds unchanged; all
  pass):

| | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 |
|---|---|---|---|---|---|---|---|---|
| now | 10.0% | 11.9% | 12.7% | 21.0% | 27.3% | 33.4% | 39.6% | 38.9% |
| proposed, point every 4 | 9.8% | 11.6% | 12.6% | 20.3% | 27.8% | 33.9% | **40.5%** | 39.9% |
| **proposed, point every 3** | **9.8%** | **11.6%** | **12.6%** | **19.8%** | **25.8%** | **33.5%** | **36.7%** | **36.1%** |
| proposed, point every 2 | 9.6% | 10.6% | 11.4% | 18.2% | **22.3%** | 27.8% | 30.0% | 29.9% |

  With the requirements alone (a point every 4 levels), tier 7 comes within half a point of its bound of 41%. Every 3
  levels takes 0.4-3.8 points off tiers 5-8. Every 2 levels puts tier 5 0.3 above its floor of 22% and makes the late game
  easy (§5).

## 1. The rule

**Requirements.** `requirements(it)` (items.js) returns `{ attr: n }`: the item's row in a new table, `REQUIRES`
(items/forge.js, beside the parent's tables, which stay as they are), with its material's shift and a light armour's
−3 STR. A requirement is met when `attr(e, k)` (with gear, powers and statuses, as Elden Ring counts a talisman's
points) is at least the number. Under the legacy set it returns `{ str: strNeeded(it) }` as now.

**Used badly** (any requirement unmet; the shortfall is the missing points added up over the attributes):

| | met | not met |
|---|---|---|
| to hit | AGI mod and the rest | −2 a missing point, at least −4, at most −8 (`RULES.d20.reqPenalty` 2, new `reqPenaltyMin` 4 and `reqPenaltyCap` 8; the legacy set's `reqPenaltyMax` stays 6) |
| damage a blow | range + round((material + scaling) × swing ÷ 0.7) + enchantment | round((range + round(material × swing ÷ 0.7)) × 0.6) + enchantment (new `RULES.d20.reqDmg` 0.6): nothing from your attributes |
| the class's power | on | off: Bleed and the dark backstab ×2 (short blade), Riposte (long blade), Daze (cudgel), Cleave and Disarm (axe), High ground (polearm), the knockback (great blade), the lantern-flail's ×2 on shades (its uselessness with the torch out stays) |
| armour | its AV, its special | half its AV (rounded down), −1 DV a piece, its special off (the buckler's block, the glass-scale's turned arrows) |
| a missile weapon | as now | the same to-hit cost, and its shot ×0.6 |
| equipping | as now | allowed, with a warning in the log: "You can hardly use the longsword (STR 21, AGI 17; you have STR 18): −6 to hit, ×0.6 damage, no Riposte." |

Fists ask for nothing and count STR over 10 as they do now (grade A on STR, in this table's terms).

**Scaling.** A weapon's attribute bonus a blow, before its swing's scaling, is Σ grade share × (attribute − 10) ÷ 2,
rounded once with the material (`round((material + Σ) × swing ÷ 0.7)`, the light-weapon fix's rounding). The grade
shares are S 1.2, A 1.0, B 0.8, C 0.6, D 0.4 and E 0.2. Today's rule is grade A on STR for every weapon. The 10 is
`RULES.d20.strOver`, unchanged. So the requirement decides whether you can use the weapon, and the grade decides how
much your attributes add.

**Two hands, STR ×1.5: not proposed.** In GNOMON the two-handed weapons (glaive, maul) always take both hands, and a
one-handed one can't be held in two. A ×1.5 would just be a hidden discount on two numbers, with no choice behind it.
Their requirement tables already count it. It would mean something only if the game let you choose a grip (a one-hand
weapon with the off hand empty), which is a new control in both views. I'd leave it for later.

## 2. The tables

### Weapons (copper, iron and saltsteel as listed; other materials below)

| class | tier | needs | scales | why |
|---|---|---|---|---|
| dagger | light | STR 10, AGI 18 | AGI B, STR E | the skirmisher's blade |
| stylus | light | AGI 15, INT 18 | INT C, AGI D | the Archive's point: a reader's weapon |
| short sword | light | STR 16, AGI 16 | STR C, AGI C | the all-rounder |
| hand-axe | light | STR 17, TOU 15 | STR B, TOU E | reed work |
| staff | light | STR 12, WIL 17 | WIL C, STR D | the pilgrim's: will over arm |
| mace | medium | STR 20, TOU 16 | STR B, TOU D | |
| spear | medium | STR 16, AGI 19 | AGI C, STR C | reach is footwork |
| lantern-flail | medium | STR 15, WIL 18 | WIL B, STR D | lantern gear asks for will |
| longsword | heavy | STR 21, AGI 17 | STR B, AGI D | |
| war axe | heavy | STR 23, TOU 18 | STR A, TOU E | |
| glaive (two hands) | heavy | STR 21, AGI 21 | AGI B, STR C | the specialist's polearm |
| greatsword | great | STR 27, TOU 18 | STR A, TOU D | |
| maul (two hands) | great | STR 29, TOU 20 | STR S | the end of the STR road |

### Missile weapons (their shot adds material and enchantment, no attribute, as now)

| | needs |
|---|---|
| sling | AGI 16 |
| bolt-bow | STR 14, INT 19 (a mechanism: INT, as you suggested for crossbows) |

### Materials, as affinities

| material | requirement | grades |
|---|---|---|
| bone | STR −2 | (as now: −1 damage, snaps 1 in 50) |
| copper, iron, saltsteel | — | — |
| blackglass | AGI +2 where it asks for AGI | AGI +1 grade (E if it had none), STR −1 grade |
| truesteel | STR +2 | STR +1 grade |
| pleatmetal | STR −3 (the bible's "−3 STR needed", as now) | AGI +1 grade |
| noonsilver | WIL at least 16 | WIL +1 grade (E if it had none) |

So a blackglass dagger asks for AGI 20 and scales AGI A. A truesteel greatsword asks for STR 29 and scales STR S. A
noonsilver longsword asks for STR 21, AGI 17 and WIL 16 and adds WIL E. Noonsilver's WIL 16 stops only someone who left
WIL low, so the last tier's reward stays meaningful for everyone. The materials shift every forged piece's requirements
the same way: armour and the bolt-bow too. So noonsilver plate or a noonsilver bolt-bow also asks WIL 16, a truesteel
bolt-bow STR +2, and bone and pleatmetal pieces STR −2 and −3.

### Armour

| piece | needs | | piece | needs |
|---|---|---|---|---|
| leather | STR 15 | | bracers | STR 15 |
| chain | STR 19, TOU 17 | | gauntlets | STR 18 |
| scale | STR 22, TOU 19 | | boots | STR 13 |
| plate | STR 26, TOU 20 | | buckler | STR 15, AGI 18 |
| glass-scale | AGI 20, TOU 17 | | climbing hooks | STR 16, AGI 16 |
| pleated coat | AGI 22 | | kite-glider | AGI 18 |
| copper cap | STR 14 | | stilt sandals | AGI 15 |
| iron helm | STR 17 | | stilt boots | AGI 19 |
| close helm | STR 18, TOU 16 | | lamp crown | WIL 19 |
| plumb-helm | STR 18, TOU 20 | | examiner's monocle | INT 19 |
| | | | examining kit | INT 17 |
| | | | Hour mask | EGO 20 |

Clothes, hats, hoods, veils, cloaks, gloves, sandals, goggles, the map case, pack, banner, writ, ink-gloves,
grip-soles and salt-shoes ask for nothing.

**Every starting kit fits its own background** at creation with the suggested spread. For example, the Moth-tender's
lantern-flail asks WIL 18 and the Moth-tender has 18; the Aspirant's iron longsword and chain ask STR 21, AGI 17 and
TOU 17, against STR 21, AGI 18 and TOU 19. Step 2 asserts this for all twelve backgrounds.

## 3. Who can use what

The archetypes. Each starts with its creation spread and puts its attribute points in its own order (a point every 4
levels, as now):

- **STR fighter**: Forgehand of Orrum, STR bought to 22, +3. Starts STR 25, AGI 18, TOU 18, INT/WIL/EGO 16. Points go
  STR and TOU by turns, and it takes Mighty at levels 5 and 10.
- **AGI skirmisher**: Mesa Runner, AGI bought to 22, +2. Starts STR 16, AGI 24, TOU 16, INT 15, WIL 15, EGO 16.
  Points go AGI, AGI, STR.
- **INT/WIL**: Archivist of Vey, INT bought to 22, +3. Starts STR 15, AGI 16, TOU 16, INT 25, WIL 20, EGO 14. Points go
  WIL and INT by turns.
- **Bent start**: the wizard's suggested spread for Drover's Child, STR 20 and 17-18 elsewhere. Points go STR and AGI
  by turns, as the typical build's do.
- **Plumb start**: the suggested spread for the Aspirant of the Rule, STR 21 and 18-19 elsewhere. Points go STR and
  AGI by turns.

Strength crystals and potions of strength (+1 STR each) are not counted.

Each cell gives the first of creation, level 8, 14, 20 or 23 at which the archetype meets every requirement. "short"
means it still lacks that much at level 23 with its own point order. A player who spends points elsewhere would get
there.

| | needs | scales | STR fighter (Forgehand) | AGI skirmisher (Mesa Runner) | INT/WIL (Archivist) | Bent start (Drover's Child, suggested) | Plumb start (Aspirant, suggested) |
|---|---|---|---|---|---|---|---|
| dagger | STR 10, AGI 18 | AGI B, STR E | start | start | short 2 AGI | 8 | start |
| stylus | AGI 15, INT 18 | INT C, AGI D | short 2 INT | short 3 INT | start | short 1 INT | start |
| shortsword | STR 16, AGI 16 | STR C, AGI C | start | start | short 1 STR | start | start |
| handAxe | STR 17, TOU 15 | STR B, TOU E | start | 14 | short 2 STR | start | start |
| staff | STR 12, WIL 17 | STR D, WIL C | short 1 WIL | short 2 WIL | start | start | start |
| mace | STR 20, TOU 16 | STR B, TOU D | start | short 3 STR | short 5 STR | start | start |
| spear | STR 16, AGI 19 | AGI C, STR C | short 1 AGI | start | short 1 STR, 3 AGI | 20 | 8 |
| lanternFlail | STR 15, WIL 18 | WIL B, STR D | short 2 WIL | short 3 WIL | start | short 1 WIL | start |
| longsword | STR 21, AGI 17 | STR B, AGI D | start | short 4 STR | short 6 STR, 1 AGI | 8 | start |
| waraxe | STR 23, TOU 18 | STR A, TOU E | start | short 6 STR, 2 TOU | short 8 STR, 2 TOU | 20 | 14 |
| glaive | STR 21, AGI 21 | STR C, AGI B | short 3 AGI | short 4 STR | short 6 STR, 5 AGI | short 2 AGI | short 1 AGI |
| greatsword | STR 27, TOU 18 | STR A, TOU D | 8 | short 10 STR, 2 TOU | short 12 STR, 2 TOU | short 4 STR | short 3 STR |
| maul | STR 29, TOU 20 | STR S | 20 | short 12 STR, 4 TOU | short 14 STR, 4 TOU | short 6 STR, 2 TOU | short 5 STR, 1 TOU |
| blackglass dagger | STR 10, AGI 20 | AGI A | short 2 AGI | start | short 4 AGI | short 1 AGI | 20 |
| truesteel longsword | STR 23, AGI 17 | STR A, AGI D | start | short 6 STR | short 8 STR, 1 AGI | 20 | 14 |
| truesteel greatsword | STR 29, TOU 18 | STR S, TOU D | 14 | short 12 STR, 2 TOU | short 14 STR, 2 TOU | short 6 STR | short 5 STR |
| pleatmetal glaive | STR 18, AGI 21 | STR C, AGI A | short 3 AGI | short 1 STR | short 3 STR, 5 AGI | short 2 AGI | short 1 AGI |
| pleatmetal maul | STR 26, TOU 20 | STR S, AGI E | 20 | short 9 STR, 4 TOU | short 11 STR, 4 TOU | short 3 STR, 2 TOU | short 2 STR, 1 TOU |
| noonsilver longsword | STR 21, AGI 17, WIL 16 | STR B, AGI D, WIL E | start | short 4 STR, 1 WIL | short 6 STR, 1 AGI | 8 | start |
| noonsilver lanternFlail | STR 15, WIL 18 | WIL A, STR D | short 2 WIL | short 3 WIL | start | short 1 WIL | start |
| sling | AGI 16 |  | start | start | start | start | start |
| boltBow | STR 14, INT 19 |  | short 3 INT | short 4 INT | start | short 2 INT | short 1 INT |
| leather | STR 15 |  | start | start | start | start | start |
| chain | STR 19, TOU 17 |  | start | short 2 STR, 1 TOU | short 4 STR, 1 TOU | start | start |
| scale | STR 22, TOU 19 |  | 8 | short 5 STR, 3 TOU | short 7 STR, 3 TOU | short 1 TOU | 8 |
| plate | STR 26, TOU 20 |  | 20 | short 9 STR, 4 TOU | short 11 STR, 4 TOU | short 3 STR, 2 TOU | short 2 STR, 1 TOU |
| helm | STR 18, TOU 16 |  | start | short 1 STR | short 3 STR | start | start |
| plumbHelm | STR 18, TOU 20 |  | 20 | short 1 STR, 4 TOU | short 3 STR, 4 TOU | short 2 TOU | short 1 TOU |
| copperCap | STR 14 |  | start | start | start | start | start |
| ironHelm | STR 17 |  | start | 14 | short 2 STR | start | start |
| bracers | STR 15 |  | start | start | start | start | start |
| gauntlets | STR 18 |  | start | short 1 STR | short 3 STR | start | start |
| boots | STR 13 |  | start | start | start | start | start |
| buckler | STR 15, AGI 18 |  | start | start | short 2 AGI | 8 | start |
| glassScale | AGI 20, TOU 17 |  | short 2 AGI | short 1 TOU | short 4 AGI, 1 TOU | short 1 AGI | 20 |
| pleatedCoat | AGI 22 |  | short 4 AGI | start | short 6 AGI | short 3 AGI | short 2 AGI |
| lampCrownHat | WIL 19 |  | short 3 WIL | short 4 WIL | start | short 2 WIL | short 1 WIL |
| monocle | INT 19 |  | short 3 INT | short 4 INT | start | short 2 INT | short 1 INT |
| examiningKit | INT 17 |  | short 1 INT | short 2 INT | start | start | start |
| hourMask | EGO 20 |  | short 4 EGO | short 4 EGO | short 6 EGO | short 3 EGO | short 2 EGO |
| kiteGlider | AGI 18 |  | start | start | short 2 AGI | 8 | start |
| climbingHooks | STR 16, AGI 16 |  | start | start | short 1 STR | start | start |
| stiltSandals | AGI 15 |  | start | start | start | start | start |
| stiltBoots | AGI 19 |  | short 1 AGI | start | short 3 AGI | 20 | 8 |
| truesteel plate | STR 28, TOU 20 |  | 20 | short 11 STR, 4 TOU | short 13 STR, 4 TOU | short 5 STR, 2 TOU | short 4 STR, 1 TOU |
| pleatmetal plate | STR 23, TOU 20 |  | 20 | short 6 STR, 4 TOU | short 8 STR, 4 TOU | short 2 TOU | short 1 TOU |

With a point every 3 levels, these cells change: the STR fighter's maul, plate, plumb-helm, truesteel plate and
pleatmetal maul and plate move from level 20 to 14. The Plumb start reaches the glaive and the pleatmetal glaive at
level 20 (from short 1 AGI), the blackglass dagger and the glass-scale at 14 (from 20). The Bent start reaches the
spear and the stilt boots at 14 (from 20) and the blackglass dagger and the glass-scale at 20 (from short 1 AGI). The
skirmisher reaches the pleatmetal glaive, the close helm and the gauntlets at 20. Most other shortfalls in an attribute the
archetype's points go to close by one point.

What this shows:

- **A strong start uses its own medium and heavy gear from the first step, and great gear needs growth.** The STR
  fighter has the greatsword at level 8 and the maul and plate at 20 (14 with a point every 3 levels). The balanced
  starts get the longsword at level 8 and the war axe at 14-20, and never the great weapons without crystals or
  points into STR.
- **The specialised gear belongs to its builds.** The skirmisher has the spear, the pleated coat and the blackglass
  dagger. The INT/WIL build has the stylus, the staff, the lantern-flail, the bolt-bow, the monocle and the lamp
  crown, and none of the STR gear. Nobody but the Plumb start (EGO 18) gets near the Hour mask's EGO 20.
- **Every build can always use something.** Every archetype meets at least three weapon classes at creation (the
  INT/WIL build: the stylus, the staff and the lantern-flail; the skirmisher: the dagger, the short sword and the spear,
  and the sling).

### What a blow is worth (copper, per blow / effective a second against DV 8; today's rule in brackets; * used badly)

Level 1:

| | STR fighter | AGI skirmisher | INT/WIL | Bent start | Plumb start |
|---|---|---|---|---|---|
| dagger | 5/11 (6/13) | 6/16 (4/11) | 2/3* (4/8) | 2/3* (5/10) | 5/11 (5/11) |
| stylus | 2/3* (5.5/12) | 2/3* (3.5/9) | 4.5/9 (3.5/7) | 2/3* (4.5/9) | 4.5/10 (4.5/10) |
| shortsword | 7.5/11 (8.5/12) | 7.5/13 (5.5/10) | 2/2* (4.5/6) | 6.5/9 (6.5/9) | 7.5/11 (6.5/9) |
| handAxe | 9.5/12 (9.5/12) | 3/4* (6.5/10) | 3/2* (5.5/7) | 7.5/9 (8.5/10) | 8.5/11 (8.5/11) |
| staff | 2/2* (9/12) | 2/2* (6/10) | 7/8 (5/6) | 7/8 (8/10) | 7/9 (8/10) |
| mace | 12.5/14 (11.5/12) | 3/2* (8.5/11) | 3/1* (7.5/8) | 10.5/11 (9.5/10) | 10.5/11 (9.5/10) |
| spear | 3/3* (10/13) | 9/14 (7/11) | 3/1* (6/7) | 3/2* (9/11) | 3/3* (9/12) |
| lanternFlail | 3/2* (10.5/11) | 3/3* (7.5/10) | 8.5/9 (6.5/7) | 3/2* (8.5/9) | 9.5/10 (8.5/9) |
| longsword | 11/14 (11/14) | 4/3* (8/13) | 4/2* (7/8) | 4/3* (10/12) | 10/13 (10/13) |
| waraxe | 16/15 (15/14) | 5/3* (11/13) | 5/1* (10/9) | 5/2* (13/11) | 5/3* (13/12) |
| glaive | 4/2* (14/13) | 4/2* (10/11) | 4/1* (9/8) | 4/1* (12/10) | 4/2* (12/11) |
| greatsword | 6/3* (17.5/14) | 6/3* (12.5/11) | 6/2* (11.5/6) | 6/2* (15.5/12) | 6/2* (15.5/13) |
| maul | 5/1* (17.5/13) | 5/2* (12.5/12) | 5/1* (10.5/6) | 5/1* (14.5/10) | 5/1* (14.5/11) |

Level 14:

| | STR fighter | AGI skirmisher | INT/WIL | Bent start | Plumb start |
|---|---|---|---|---|---|
| dagger | 5/11 (7/15) | 6/17 (4/11) | 2/3* (4/8) | 5/11 (6/13) | 5/11 (6/13) |
| stylus | 2/3* (6.5/14) | 2/4* (3.5/10) | 5.5/11 (3.5/7) | 2/3* (5.5/12) | 4.5/10 (5.5/12) |
| shortsword | 9.5/14 (9.5/14) | 7.5/14 (5.5/10) | 2/2* (4.5/6) | 7.5/11 (7.5/11) | 7.5/11 (7.5/11) |
| handAxe | 11.5/15 (11.5/15) | 6.5/11 (6.5/11) | 3/2* (5.5/7) | 8.5/11 (8.5/11) | 8.5/11 (8.5/11) |
| staff | 2/2* (11/14) | 2/3* (6/10) | 7/8 (5/6) | 7/9 (8/10) | 8/10 (8/10) |
| mace | 14.5/16 (14.5/16) | 3/3* (8.5/12) | 3/1* (7.5/8) | 10.5/11 (10.5/11) | 11.5/12 (10.5/11) |
| spear | 3/3* (12/16) | 10/17 (7/12) | 3/1* (6/7) | 3/3* (9/12) | 10/13 (9/12) |
| lanternFlail | 3/2* (13.5/15) | 3/3* (7.5/11) | 9.5/10 (6.5/7) | 3/2* (9.5/10) | 9.5/10 (9.5/10) |
| longsword | 13/17 (13/17) | 4/4* (8/14) | 4/2* (7/8) | 11/14 (10/13) | 11/14 (10/13) |
| waraxe | 19/18 (18/17) | 5/3* (11/13) | 5/1* (10/9) | 5/3* (14/13) | 15/14 (14/13) |
| glaive | 4/2* (17/16) | 4/3* (10/12) | 4/1* (9/8) | 4/2* (13/12) | 4/3* (13/12) |
| greatsword | 23.5/19 (20.5/17) | 6/3* (12.5/13) | 6/2* (11.5/6) | 6/2* (16.5/13) | 6/2* (16.5/13) |
| maul | 5/3* (20.5/16) | 5/3* (12.5/13) | 5/1* (10.5/6) | 5/1* (15.5/12) | 5/1* (15.5/12) |

Level 20:

| | STR fighter | AGI skirmisher | INT/WIL | Bent start | Plumb start |
|---|---|---|---|---|---|
| dagger | 5/11 (8/17) | 6/18 (4/12) | 2/3* (4/8) | 5/11 (6/13) | 5/12 (6/14) |
| stylus | 2/3* (7.5/16) | 2/4* (3.5/11) | 5.5/11 (3.5/7) | 2/3* (5.5/12) | 4.5/11 (5.5/13) |
| shortsword | 9.5/14 (10.5/15) | 8.5/17 (5.5/11) | 2/2* (4.5/6) | 7.5/11 (7.5/11) | 8.5/13 (8.5/13) |
| handAxe | 11.5/15 (12.5/16) | 6.5/12 (6.5/12) | 3/2* (5.5/7) | 8.5/11 (8.5/11) | 9.5/13 (9.5/13) |
| staff | 2/2* (12/16) | 2/3* (6/11) | 8/10 (5/6) | 7/9 (8/10) | 8/11 (9/13) |
| mace | 14.5/16 (14.5/16) | 3/3* (8.5/13) | 3/1* (7.5/8) | 11.5/12 (10.5/11) | 11.5/13 (11.5/13) |
| spear | 3/3* (13/17) | 10/18 (7/13) | 3/1* (6/7) | 10/13 (9/12) | 10/14 (10/14) |
| lanternFlail | 3/2* (13.5/15) | 3/3* (7.5/11) | 9.5/10 (6.5/7) | 3/2* (9.5/10) | 9.5/11 (10.5/12) |
| longsword | 13/17 (14/18) | 4/4* (8/14) | 4/2* (7/8) | 11/14 (10/13) | 11/15 (11/15) |
| waraxe | 20/19 (19/18) | 5/4* (11/14) | 5/1* (10/9) | 15/14 (14/13) | 16/16 (15/15) |
| glaive | 4/2* (18/17) | 4/3* (10/13) | 4/1* (9/8) | 4/3* (13/12) | 4/3* (14/14) |
| greatsword | 24.5/20 (22.5/18) | 6/4* (12.5/14) | 6/2* (11.5/6) | 6/2* (16.5/13) | 6/3* (17.5/15) |
| maul | 24.5/19 (21.5/16) | 5/3* (12.5/13) | 5/1* (10.5/6) | 5/1* (15.5/12) | 5/2* (17.5/14) |

- Each build's own weapon is now its best: the skirmisher's dagger and spear (17-18 a second, against 11-13 today),
  the INT/WIL build's stylus, staff and flail (8-11, against 6-7). The STR fighter's heavy weapons stay where they
  were or gain a little (greatsword 19-20 against 17-18).
- **Used badly is a cliff**: 1-4 a second. That is Elden Ring's way: the weapon in your hand is a reason to grow.
  Softer would be −2 a point with no minimum and ×0.75; tell me if you want it.

## 4. Armour: an equip load from TOU, or requirements?

**Elden Ring's way.** Armour asks for nothing. Every piece weighs something, and your equip load comes from Endurance
(here TOU). Over 30% of the load you move normally, over 70% slowly, over 100% you can barely move. Its strength is
one budget, so "heavy or light" is a continuous choice. Here it would need:

- a weight for every piece (gear weighs 0 today);
- an equip load rule (`RULES.encumbrance` is off, and `carryCap` is read by nothing);
- a speed penalty in both views: action time on the map, movement and swing in 3D.

The swing time moves every TTK number. It is a third system beside requirements and grades, and there's no dodge
roll here to make speed as precious as it is in Elden Ring.

**Requirements (recommended).** The same rule as weapons, the same pack row and the same "used badly". It puts TOU in
the heavy pieces' tables, so TOU does part of Endurance's job: plate asks STR 26 and TOU 20. It costs nothing in the
3D or map controls. What you lose against Elden Ring is the continuous trade. Here a piece is either met or worn badly
(half AV, −1 DV).

If you want the weight later, it can go on top. Each piece already has a tier, so a weight per piece and a load from
TOU could be added as their own proposal.

## 5. The growth pace

**Now:** one attribute point every 4th level (5 by level 20). STR also has Mighty (+2, twice), potions of strength
and strength crystals (+1 each; about 8% of dungeon floors hold one, and merchants sell them at rising prices). AGI,
TOU, INT, WIL and EGO have only the 5 points.

**That's thin for this system.** A step from medium to heavy gear is 2-4 points in an attribute, and from heavy to
great 4-6. With 5 points by level 20, a balanced start climbs one step in one attribute, and the non-STR builds can't
climb any faster than that. In the tables, the Bent start reaches the war axe only at level 20. The Plumb start never
reaches the glaive. The skirmisher's AGI goes from 24 to 28.

**Proposed, and decided by the user (2026-10-31, "yes"): a point every 3rd level** (levels 3, 6, … 21: 7 points),
`RULES.progression.level.attrPointEvery` 4 → 3. It is built in `p4b-b4`.
It gives each build one more step by the end. It also takes 0.4-3.8 points off the typical build's cost a kill at tiers 5-8 (25.8 /
33.5 / 36.7 / 36.1%, against 27.8 / 33.9 / 40.5 / 39.9% at every 4), and puts tier 7 back where it has room under 41%.

- **Not every 2nd level** (11 points): measured, tier 5 falls to 22.3%, 0.3 above its floor, and tiers 6-8 to 28-30%.
  Rewards and fights would stop mattering late, which goes against your taste.
- **Possible later, not part of this proposal:** crystals for the other attributes (an agility crystal, a will
  crystal…) as rare finds, so STR stops being the only attribute you can find. Or let the strength crystal raise the
  attribute you choose under the attribute set. Either changes the loot tables (`GEN_VERSION`), so it would be its own
  step.

## 6. The typical build, before and after

Each row is the cost of a kill / your seconds to kill / its seconds to kill you, then the six sets' spread and the
closest fight. The model is check-combat's typical build. Its weapon pick now uses the new rule: what the weapon's line
promises for your attributes, with an unmet one's cost counted. Its armour pick counts an unmet piece as half its AV.
Points still go to STR and AGI by turns.

| | now | proposed, point every 4 | **proposed, point every 3** | proposed, point every 2 |
|---|---|---|---|---|
| T1 L2 | 10.0% 0.97 s 11.7 s (9.5-10.4; 5.3×) | 9.8% 0.95 s 11.7 s (9.3-10.0; 6.1×) | **9.8% 0.95 s 11.7 s (9.3-10.0; 6.1×)** | 9.6% 0.92 s 11.7 s |
| T2 L5 | 11.9% 1.42 s 14.6 s (11.6-12.4; 4.0×) | 11.6% 1.39 s 14.4 s (11.4-11.9; 4.2×) | **11.6% 1.39 s 14.4 s (11.4-11.9; 4.2×)** | 10.6% 1.33 s 14.8 s |
| T3 L8 | 12.7% 1.75 s 16.3 s (12.4-13.1; 4.0×) | 12.6% 1.71 s 16.1 s (12.0-13.1; 3.7×) | **12.6% 1.71 s 16.1 s (12.0-13.1; 3.7×)** | 11.4% 1.59 s 16.7 s |
| T4 L11 | 21.0% 2.47 s 13.6 s (20.3-21.5; 2.2×) | 20.3% 2.35 s 13.9 s (19.8-20.9; 2.6×) | **19.8% 2.29 s 13.8 s (19.3-20.6; 2.7×)** | 18.2% 2.14 s 14.4 s |
| T5 L14 | 27.3% 3.26 s 13.5 s (26.9-27.7; 1.9×) | 27.8% 3.20 s 13.5 s (26.9-28.5; 1.7×) | **25.8% 3.06 s 14.1 s (25.1-26.6; 1.7×)** | 22.3% 2.76 s 14.3 s |
| T6 L17 | 33.4% 3.94 s 13.7 s (32.5-34.6; 1.3×) | 33.9% 3.84 s 13.4 s (32.5-35.0; 1.2×) | **33.5% 3.76 s 13.3 s (32.8-34.8; 1.3×)** | 27.8% 3.29 s 13.8 s |
| T7 L20 | 39.6% 4.44 s 13.0 s (38.1-41.9; 1.0×) | 40.5% 4.27 s 12.4 s (39.1-41.8; 1.2×) | **36.7% 3.96 s 12.5 s (35.7-37.9; 1.2×)** | 30.0% 3.43 s 13.1 s |
| T8 L23 | 38.9% 4.65 s 13.5 s (37.0-41.8; 1.1×) | 39.9% 4.42 s 12.6 s (37.4-44.1; 1.1×) | **36.1% 4.02 s 12.6 s (34.1-39.2; 1.3×)** | 29.9% 3.48 s 13.0 s |

The bounds are unchanged: tiers 1-4 within 1.5× the legacy set + 3, tiers 5-8 22-41%, it kills you 1.5× slower than
you kill it, and you kill in 0.5-12 s. All three variants pass. Under the requirements:

- the typical build never wields a weapon it can't use (0 of 80 builds at every band);
- its AV falls (tier 8: 10.1-10.3 against 11.7): plate asks for TOU 20 and its points don't go to TOU, so most
  builds wear chain or scale (at tier 8, 12-13 of 80 wear plate);
- 2-14 of its pieces (80 builds, up to five armoured slots each) are worn unmet at tiers 3-8, where half the AV still
  beats the alternative.

## 7. What changes where (step 2, after your approval)

**My files:**

- `content/items/forge.js`: `REQUIRES`, `SCALING`, `GRADES` and `MATERIAL_REQ`.
- `items.js`: `requirements`, `scaling` and `shortfall`.
- `items/legacy.js` and `items/missiles.js`: the item lines under the attribute set: "needs STR 21, AGI 17 · scales
  STR B, AGI D", and "you lack 3 STR: used badly (−6 to hit, ×0.6 damage, no Riposte)". The legacy lines stay as they
  are.
- `inventory.js`: the pack row's "STR 21 AGI 17", each number red when unmet, and the equip warning.
- `combat.js`: to hit, damage, the class powers and the armour specials.
- `rules.js`: `reqPenaltyMin`, `reqPenaltyCap` and `reqDmg` (the legacy set's `reqPenaltyMax` stays 6).
- Checks in check-combat and check-items, each with a mutant:
  - every kit usable at creation;
  - used badly costs what the table says;
  - grades and materials;
  - the legacy set unchanged (golden and the legacy fights stay as they are);
  - the typical build's pick.

**Outside my list** (I need your or the coordinator's yes for each; the prototype has the first two):

1. `body.js canEquip`, one line: no refusal for weakness under the attribute set ("used badly" instead). The legacy
   set keeps its refusal.
2. `stats.js av()` and `dv()`: an unmet armour piece counts half its AV and −1 DV, so the HUD and the character sheet
   show what the fight uses.
3. `missiles.js` (src/) `missileSpec`: a missile weapon's to-hit cost and ×0.6 when unmet.
4. `progression` / `leveling.js` `attrPointEvery` 4 → 3, and the level-up text if it names the 4th level.
5. `tests/checks/body.js:248` and `items.js:227`: they expect the "weak" refusal under the attribute set. They would
   run under the legacy set, where it stays.
6. Artifact weapons (you mentioned them; the glimgun and the lancet are the two "weapon" artifacts) asking INT 17 and
   INT 21, a shot ×0.6 when unmet. Their shots live in `bodymods/artifacts.js`, not in my list. Approve it or leave it
   out. They already need INT to identify.

## 8. Decisions for you

1. The requirement tables and grades in §2 (or tell me which to move).
2. Used badly as in §1 (−4 to −8 to hit, ×0.6, no attribute bonus, no class power; armour half AV and −1 DV), or the
   softer version (§3).
3. Armour by requirements (recommended) or Elden Ring's equip load from TOU (§4).
4. The growth pace: a point every 3 levels (recommended), unchanged at every 4, or every 2 (§5).
5. Artifact weapons' INT requirement: in or out (§7 item 6).

## 9. What I'm unsure of

1. **The cliff is steep**: a point short turns 17 a second into 3. It's what Elden Ring does and what you asked for.
   Players will see it in red on the pack row before they equip, and the log says why.
2. **The INT/WIL build is weak in melee**, on purpose, but it has to fight with something. Its own weapons now hit
   harder than before (stylus 11 a second at level 14 against 7). Its other strengths (artifacts, powers) are outside
   these tables. The typical build is a fighter, so the bounds say nothing about it.
3. **The archetype table assumes fixed point orders.** A real player puts points where the next piece of gear needs
   them, so the "short" cells are pessimistic for anyone who plans.
4. **Tier 5 and the six sets.** With every 3 levels, tier 5's sets are 25.1-26.6%, still inside 22-41%. The typical
   build's armour is a little lighter than before (it puts no points in TOU). If you would rather the model put a
   point in TOU sometimes, that's a change to the measuring stick and I'd ask first.
5. **Exactness.** The TTK tables are measured on the prototype in the game's code, so they should hold once step 2
   is built, with its pick rule. I'll rerun them on the finished code and report any difference.
