# Workstream WS8: combat depth, AI and targeting

Phase 1 (TECH_DESIGN §8.3 "WS8", with DECISIONS: combat is **d20**, bible §10.6 and §15.6, so §8.3's "dice-mode
tuning" means TTK tables for the d20 rules), in the worktree `gnomon-wt\ws8` on `ws/ws8` from `p0-done`. It ran on the
local machine (Windows 11, i7-10750H, Node 20.11.0, headless Chromium from Playwright) while WS9 and WS3 ran beside it,
with the user's training job: every timed number below was taken alone and against `p0-done` in alternation (§8).
The public API, the integration requests and the handoff are in `docs/ws8.md`.

| Commits | What |
|---|---|
| `5c720c1` | combat: the d20 log format, the Plane for you (`touchesYou`), a spec's `noun` and `onHit`; creatures.js spatial queries |
| `5d3288f` | ai: wary, flee, follow; followers and hunters over an edge; catch-up on re-entry; the outdoor activity radius; AI ability use |
| `9d9ed9f` | turns: swap with a follower, Shift + direction, moving in the Plane; followers shown on the map |
| `5c2bca5` | the target screen, L, map throws on their arc, the interposed creature, throws over an open edge, missile weapons |
| `18dbb51` `871d9f4` | check-combat: WS8's acceptance, the arena, the TTK tables, `--perf`; check-body's samples of the new kinds |
| `05e47ce` `b5705b1` `6e901cb` `af1e199` | the HUD's V segment and the hook that keeps hud.js off the screens; `tools/browser-ws8.mjs`; the 3D second swing at a friend; `docs/ws8.md` |
| (later) | the verification's fixes (§7), these notes |

## 1. What was built

| Part | Files |
|---|---|
| The d20 log: one line a blow in both views ("You hit the goblin (x2) for 10.", "The goblin misses you.", "The orc slays the goblin (3)." only where you'd see it); the legacy set keeps the parent's lines | `combat.js` |
| The map target screen: cursor by keys and mouse, Tab over what you see (foes first), the exact line of fire (green, yellow at a creature in the way, red at a wall or past the range), the hit chance, the distance; Enter, a click, or the key that opened it again confirm; Esc or a right click cancel | `screens/target.js` |
| L in both views: the map's look cursor, the 3D crosshair at once; `inspect { open: true }` and one line ("A goblin, level 3, out for you, 75% to hit with your weapon.") | `screens/target.js` |
| `requestTarget` with the screen behind it (the map), `aimTarget` (3D): abilities.js's seam (integration request 1) | `screens/target.js` |
| Targeted throws on the map (the d20 set): an exact ballistic arc from your eyes to the target's middle (height still decides what can be hit), flying while the turn's time passes; the first creature in its way is hit (your follower too; a rat is too short to stop a knife aimed at a goblin) | `throwing.js`, `screens/target.js` |
| Things thrown over an open edge fly on above the apron; what comes down there waits in the next zone (a `landItem` zone patch) | `throwing.js` |
| Missile weapons: the sling (free stones, dazes 30%) and the bolt-bow (bolts, pins 2 s), carried in the pack, V in both views, a reload in game seconds, the HUD's "V: bolt-bow x12"; kinds `missile` and `ammo`; the `pinned` status | `missiles.js`, `content/items/missiles.js` |
| Wary (keeps 3 tiles, never strikes first), flee (under its type's share of health; 10 s at most, then at bay 15 s), follow (`recruit`, keeps within 2-5 tiles, fights your foes, never you; on the map a bump swaps, Shift + direction strikes; in 3D the first swing holds back, a second strikes) | `ai.js`, `turns.js`, `combat.js` |
| Followers (within 8) and hunters (within 6) go with you over an edge, followers by the stairs too: out of the zone you leave before write-behind snapshots it, in at the border you crossed after their way's time | `ai.js` |
| Catch-up on re-entry: statuses, healing (all of it in an hour), hunts and targets lapse, bombs and gas burn out | `ai.js` |
| The outdoor activity radius in 3D (32 tiles on a surface zone); the map's 12 unchanged | `ai.js` |
| AI ability use (`def.ai.when`, every 0.5 s, cooldowns respected) | `ai.js` |
| The Plane for you (DECISIONS: the flat status's movement is WS8's): chasms, pits and deep water are floor at your height, ledges within 2 blocks, under doors and gates, walls stop you, no levers; only the Flatfolk talk to you; blows, arrows, splashes, blasts and gas between you and deep things pass; deep hunters lose you | `turns.js`, `creatures.js`, `combat.js`, `throwing.js`, `ai.js` |
| Spatial queries for WS6a's witnesses: `nearestCreature`, `sees`, `witnessesOf`, `creaturesAlong` | `creatures.js` |
| Checks: WS8's acceptance in four parts plus the TTK tables; `--perf`; the browser tool | `tests/checks/combat.js`, `tools/check-combat.mjs`, `tools/browser-ws8.mjs` |

## 2. Public APIs

`docs/ws8.md` "Public API" (exact signatures).

## 3. Gate results

`node tools/check-combat.mjs` (five results: P0's combat check, then WS8's targeting, AI depth, arena and TTK), and
`NODE_PATH="$(npm root -g)" node tools/browser-ws8.mjs` with `node tools/serve.mjs 8648` serving the worktree.

| §8.3 WS8 acceptance item | Result |
|---|---|
| Arena sims (two factions, 100 runs) stable | Four of each side (goblin, orc, spider, rat; level 3), mirror images 6-8 tiles apart, the side added first alternating: **100 runs, 85 won by one side, 15 parted** (no two foes within 10 tiles for 15 s: §3.4 drops a foe past 8 tiles), **0 still fighting after 120 s**; red won 40, blue 45; kills 235 against 264 (47%/53%); 12.3 s a decided fight. The same 20 seeds again: **identical** (winner, time, survivors' HP). Level 9 against level 3: **99 of 100** to the stronger side, 1 parted, kills 399 against 16 |
| Parity test (bump vs swing, same RNG) | P0's 300 blows: identical (98 misses, 13 crits). New: **60 knives thrown and 60 bolts shot** at an orc on the map (throwAt / fireAt) and in 3D (throwReady / fire along the aim) with one combat RNG: **identical** result sequences (touched, hit, crit, natural, total, DV, damage, soak; 49 and 54 hits) |
| Interposed-creature rule | A knife thrown at a goblin 4 tiles off with an orc 2 tiles off on the line hits **the orc**; the target screen's line of fire says **"interposed"** with the orc; your follower in the way is hit too; the orc moved off the line, the goblin is hit. A rat in the way is too short: the knife aimed at the goblin's middle flies over it |
| `passTime` ≤ 12 ms a simulated second with 60 creatures | §8 (on an idle machine, against `p0-done` alternately) |
| A follower crosses an edge in both views | The temple's east border into `1,0,0`, map (a step off the edge) and 3D (walking past the apron's half tile): the follower (2 tiles behind) and a hunter (4 tiles) **came**, a hunter at 11 tiles **stayed**; both left the old zone (and are **not in its write-behind snapshot**), came in at x ≤ 2, arrived within 3 s, the follower then within 5 tiles of you. Down the stairs: the follower came, the hunter didn't |
| Browser: the target cursor by keys and mouse | `browser-ws8` on seed 1234, headless Chromium, audio rerouted (?silent=1 too), **pass, 0 console errors**: L opens on the nearest foe, Tab moves on, arrows move it, Enter emits one inspect at the cursor (open), Esc cancels; the mouse moves the cursor, a click looks there, a right click cancels; T aims at the goblin with "90% to hit if it gets there", TT throws and the knife reaches it; V and a click on the orc fire a bolt that reaches it; Tab into 3D, L names the goblin in the crosshair, V and T reach it; your follower stays within 4 tiles and never strikes you |

The outputs, each checked (check-combat's WS8 parts):

| Output | Result |
|---|---|
| Wary, flee, follow | Wary (a docile faction you're disliked by): after 6 s it stands **3.6 tiles** off and **struck you 0 times**; struck, it hunts you. Flee: a goblin at 15% ran **2 → 4 tiles** in 1 s ("The goblin turns and runs!"), out of sight for 7 s it **wanders**; cornered, it **fights** (and stays brave a while); under the legacy set it **doesn't flee**. Follow: an orc 8.4 tiles behind after you walked 12 steps (it's slower), **2.7 tiles** after 4 s; it went for a rat that was out for you; a bump **swaps** places, Shift + direction **strikes** it; in 3D the first swing holds back, a second at 0.5 s strikes, one 3 s later holds back again |
| Catch-up on re-entry | 600 s away: HP 2 → **12 of 60** (+10, a sixth), the hunt lapsed, a chill gone; an hour away: **full** |
| The outdoor activity radius | 3D on a surface zone: a creature 20 tiles off acts, one 40 tiles off **waits**; in a dungeon both act; the map's 12 unchanged |
| The map target and look cursor | above (and in Node: L, Tab, arrows, Enter, Esc, LL, hover, click, right click, the screen's two rows) |
| Targeted throws and missile weapons in both views | TT on the map: the knife reaches the goblin with the aimed +3 and takes ≥ 0.5 s; out of range (14 tiles) refused; at your own tile refused. Bolt-bow: one shot, a second at once **refused (reloading)**, bolts 2 → 1, the orc **pinned**; after the 1 s reload it fires; with none left "no bolts"; spent bolts lie on the floor. A knife thrown east over the temple's border flew to x 91.4 (the border is at 80) and **lay in `1,0,0` at (11, 4)** when you got there |
| AI ability use | A creature with a 3 s ability used it at **0.05, 3.35, 6.65 s**, each time at you |
| The combat log format | "You miss the goblin." · "You hit the goblin (x2) for 10." · "The goblin misses you." · "The goblin hits you (x2) for 8." · "The orc misses the goblin." · "The orc hits the goblin (x2) for 18." · "You slay the goblin (x2, 10)." |
| Pressed flat (DECISIONS: WS8's movement rules) | Blows touching: deep → you **0/40**, you → deep **0/40**, flatling → you **40/40**, you → flatling **40/40**; a goblin's arrow **passed**; a deep hunter **lost you**, the flatling didn't; on the map: over a hole (no fall), under a closed door, not into a wall, up a 2-block ledge, **not** up 3, **not** a lever; walking into people: **only Ess** (a Flatlander) talked |
| Dice-mode tuning: TTK tables by level band | the table below |

**Time to kill by level band** (`check-combat --only ttk`): the d20 set with the attribute stats (the integrator's flip)
against the parent's set, at each tier's surface level (3 × tier − 1). You: a fighter with STR 18, AGI 17, TOU 16 at
creation and +1 attribute every 4 levels into STR and AGI by turns, the tier's weapon and armour from the legacy tables
(`maxTierAt`) at +floor(level / 6) and +floor(level / 8). The creatures that level brings, weighted by how often
(`pickCreatureType`), level-scaled; melee only (archers' arrows, venom, regeneration and elites left out). "A kill
costs": the share of your health one fight with a creature of your level takes (its damage a second × your time to
kill). 1,500 sampled blows each way per creature kind, seeded.

| Tier | Level | You (weapon, HP, DV, AV) | d20: you kill it | d20: it kills you | d20: a kill costs | worst | legacy: you kill it | legacy: it kills you | legacy: a kill costs |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | mace, 23, 6, 1 | 1.12 s | 18.4 s | 7.5% | skeleton 17% | 0.97 s | 14 s | 8.7% |
| 2 | 5 | longsword, 32, 6, 2 | 1.17 s | 16.7 s | 7.8% | skeleton 14% | 1.04 s | 13.5 s | 8.5% |
| 3 | 8 | waraxe, 41, 7, 4 | 2.01 s | 26.5 s | 10.1% | orc 32% | 1.58 s | 22 s | 9.7% |
| 4 | 11 | waraxe, 50, 7, 4 | 2.72 s | 19.7 s | 17.7% | orc 35% | 2.16 s | 17.2 s | 16.3% |
| 5 | 14 | greatsword, 59, 7, 5 | 4.47 s | 16.5 s | 33.7% | troll 71% | 3.01 s | 15.1 s | 24.9% |
| 6 | 17 | greatsword, 68, 7, 6 | 5.62 s | 14.7 s | 44.3% | troll 78% | 3.67 s | 14.1 s | 30% |
| 7 | 20 | greatsword, 77, 7, 6 | 6.94 s | 13.8 s | 54.2% | troll 76% | 4.49 s | 13.8 s | 34.8% |
| 8 | 23 | greatsword, 86, 7, 6 | 7.67 s | 13.7 s | 60% | troll 83% | 4.92 s | 13.9 s | 37.7% |

**What it says.** Through tier 4 the d20 set is close to the parent's (a kill costs 7.5-17.7% against 8.5-16.3%; you
kill in 1.1-2.7 s against 1.0-2.2 s), so DECISIONS' "the existing MONSTER_TYPES balance survives" holds there. From
tier 5 it drifts harder: a same-level fight costs 34-60% of your health against 25-38%, and you take 1.5× as long. The
cause is the to-hit: a creature adds floor(level / 3) (+7 at level 23) against your DV, which grows only with AGI
(DV 7 here), so it lands 95% of its blows, while your to-hit grows only with AGI against its DV of 5 + floor(level / 4)
(10 at 23), so you land about 55%. The bible gives players nothing that scales with level on either side; WS4's powers
and mutations (bible §10.8: Steady hand, and the like), DV gear (bible §13.3) and C4's items are where it closes, and
the numbers are RULES.d20's (rules.js, the integrator's) and the bible's, so WS8 changes neither. The check holds the
formulas, not this verdict: you kill a creature of your level in 0.5-12 s and it takes at least 1.5× as long to kill
you at every tier, a kill costs at most 75%, and tiers 1-4 stay within 1.5× of the parent's numbers.

## 4. Deviations from the design, with reasons

1. **Combat is d20 (DECISIONS)**: §8.3's "dice-mode tuning" is the TTK tables for the d20 rules (§3 above); RULES.d20 is
   the integrator's (rules.js), so WS8 reports and recommends instead of retuning the bible's numbers.
2. **A missile weapon is carried in the pack, not wielded**: `player.js` (attackTime, weaponReach), `hud.js`'s weapon
   drawing and `inventory.js` read `WEAPONS[wielded.id]` for whatever the primary hand holds; a launcher there would
   break them, and they aren't WS8's. V fires the ready one; the hands keep the blade.
3. **Followers and hunters cross by the zone events, not a zone patch**: both zones are in memory inside the one
   `enterZone` call that emits `zone:leave` and `zone:enter`, so a patch would carry the same creature through the
   same call. The movers leave the old zone before write-behind's snapshot (priority −100) and are in the new one's.
   A patch does carry what is *thrown* over an edge (`landItem`): that zone may not be in memory.
4. **The new behaviour that changes the old game is behind the d20 set**: the map's T, fleeing (its default shares),
   the d20 log. Under the legacy set nothing new draws a random number, so golden and the legacy fights match. What
   works under both sets (L, V, Shift, followers, the Plane, catch-up, the radius, edges) changes nothing those
   fixtures play.
5. **Interposed creatures are physical**: the thrown thing's own flight decides (`collide`), so a creature shorter
   than the arc isn't in the way. The target screen draws that flight.
6. **Fleeing has a ceiling** (10 s, then 15 s at bay): the arena found creatures fleeing forever on open ground.
7. **Two P0 test files got a line each** (`tests/checks/content.js`, `tests/checks/body.js`: a sample of each new item
   kind), as 0D2.md §6 asks of a new kind; listed as integration request 6.
8. **`tools/browser-ws8.mjs` is a new file** outside §8.4's list (integration request 7).

## 5. Known issues

(Filled in below.)

## 6. What the next session must know

(Filled in below.)

## 7. Verification fixes

(Filled in below.)

## 8. Timed numbers

(Filled in below.)
