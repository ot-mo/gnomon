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
| Catch-up on re-entry: statuses run out, creatures heal (all of it in an hour), hunts and targets lapse; bosses and guardians only run out their statuses; things in flight, lit bombs and gas wait for you | `ai.js` |
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
| Arena sims (two factions, 100 runs) stable | Four of each side (goblin, orc, spider, rat; level 3), mirror images 6-8 tiles apart, the side added first alternating: **100 runs, 87 won by one side, 13 parted** (no two foes within 10 tiles for 15 s: §3.4 drops a foe past 8 tiles), **0 still fighting after 120 s**; red won 41, blue 46; kills 236 against 266 (47%/53%); 12.3 s a decided fight. The same 20 seeds again: **identical** (winner, time, survivors' HP). Level 9 against level 3: **100 of 100** to the stronger side, kills 400 against 16 |
| Parity test (bump vs swing, same RNG) | P0's 300 blows: identical (98 misses, 13 crits). New: **60 knives thrown and 60 bolts shot** at an orc on the map (throwAt / fireAt) and in 3D (throwReady / fire along the aim) with one combat RNG: **identical** result sequences (touched, hit, crit, natural, total, DV, damage, soak; 49 and 54 hits) |
| Interposed-creature rule | A knife thrown at a goblin 4 tiles off with an orc 2 tiles off on the line hits **the orc**; the target screen's line of fire says **"interposed"** with the orc; your follower in the way is hit too; the orc moved off the line, the goblin is hit. A rat in the way is too short: the knife aimed at the goblin's middle flies over it |
| `passTime` ≤ 12 ms a simulated second with 60 creatures | **Met**: p50 3.9-5.2 ms (three ways, §8), check-perf's own 6.7 ms (×1.04 `p0-0d1`) |
| A follower crosses an edge in both views | The temple's east border into `1,0,0`, map (a step off the edge) and 3D (walking past the apron's half tile), as §5.1 says: followers at 3 and 12 tiles and a hunter 2 tiles from the exit **came**, a hunter 5 tiles from it **stayed**; they left the old zone (and are **not in its write-behind record**: a memory store, the record read back), came in at x ≤ 2, arrived within 3 s, the follower then within 5 tiles of you. With every tile by the border taken, the follower still came. Down the stairs and on world travel: the follower came, the hunter didn't. A wary hunter and a guardian 2 tiles from the exit stayed |
| Browser: the target cursor by keys and mouse | `browser-ws8` on seed 1234, headless Chromium, audio rerouted (?silent=1 too), **pass, 0 console errors**: L opens on the nearest foe, Tab moves on, arrows move it, Enter emits one inspect at the cursor (open), Esc cancels; the mouse moves the cursor, a click looks there, a right click cancels; T aims at the goblin with "90% to hit if it gets there", TT throws and the knife reaches it; V and a click on the orc fire a bolt that reaches it; Tab into 3D, L names the goblin in the crosshair, V and T reach it; your follower stays within 4 tiles and never strikes you |

The outputs, each checked (check-combat's WS8 parts):

| Output | Result |
|---|---|
| Wary, flee, follow | Wary (a docile faction you're disliked by): after 6 s it stands **3.6 tiles** off and **struck you 0 times**; struck, it hunts you. Flee: a goblin at 15% ran **2 → 4 tiles** in 1 s ("The goblin turns and runs!"), out of sight for 7 s it **wanders**; healed, it stops; cornered, it **fights** (brave 15 s); chased and struck for 36 s it said "turns and runs" **2 times** and stood at bay after **10.25 s**; under the legacy set it **doesn't flee** (cornered or in the open). Follow: an orc 8.4 tiles behind after you walked 12 steps (it's slower), **2.7 tiles** after 4 s; it went for a rat that was out for you; a bump **swaps** places, Shift + direction **strikes** it, and struck by you (or by knives thrown through it) it **never strikes back**; your bomb's blast and an arrow at you reach it; a click-travel goes on when it comes into view; in 3D the first swing holds back, a second within 2 s strikes, one after 3 s holds back again |
| Catch-up on re-entry | 600 s away: HP 2 → **12 of 60** (+10, a sixth), the hunt lapsed, a chill gone, the Lich King **still hunting and unhealed**, a lit bomb's fuse and a knife in the air **as they were**; an hour away: **full**; coming back by a load: **nothing** catches up |
| The outdoor activity radius | 3D on a surface zone: a creature 20 tiles off acts, one 40 tiles off **waits**; in a dungeon both act; the map's 12 unchanged |
| The map target and look cursor | above (and in Node: L, Tab, arrows, Enter, Esc, LL, hover, click, right click, the screen's two rows) |
| Targeted throws and missile weapons in both views | TT on the map: the knife reaches the goblin with the aimed +3 and takes ≥ 0.5 s; the screen shows the hit chance as the formula gives it (with +3; an ability's without); out of range (14 tiles) refused, the line "far" past the range; at your own tile refused. Bolt-bow: one shot, a second at once **refused (reloading)**, the orc **pinned**; after the 1 s reload it fires; with none left "no bolts"; V on the map takes the reload's 1 s; of 30 bolts 19-21 lay on the floor (30% break); E readies a second launcher. Thrown over the temple's border a knife flew to x 91.4 (the border is at 80) and **lay in `1,0,0` at (11, 4)**; things landing past the east edge, the south edge and the south-east corner lay at (3, 10) in `1,0,0`, (12, 0) in `0,1,0`, (2, 1) in `1,1,0` |
| AI ability use | A creature with a 3 s ability used it at **0.05, 3.35, 6.65 s**, each time at you |
| The combat log format | "You miss the goblin." · "You hit the goblin (x2) for 10." · "The goblin misses you." · "The goblin hits you (x2) for 8." · "The orc misses the goblin." · "The orc hits the goblin (x2) for 18." · "You slay the goblin (x2, 10)." |
| Pressed flat (DECISIONS: WS8's movement rules) | Blows touching: deep → you **0/40**, you → deep **0/40**, flatling → you **40/40**, you → flatling **40/40**; a goblin's arrow **passed**; a deep hunter **lost you**, the flatling didn't; on the map: over a hole and over deep water at your height (no fall, no drowning), under a closed door at your height, not into a wall, up a 2-block ledge, **not** up 3, **not** a lever; walking into people: **only Ess** (a Flatlander) talked; seen only by flat things (witnessesOf) |
| The spatial queries (for WS6a) | nearestCreature (and its filter, ties to the lower id), witnessesOf (in view yes, behind a wall no, pressed flat only the flatling), creaturesAlong (nearest first, over a rat's head, skip) |
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
3. **Followers and hunters cross by the zone events, not a zone patch** (§5.1 says a patch `relativeTo: "arrival"`, "2
   tiles behind you"): both zones are in memory inside the one `enterZone` call that emits `zone:leave` and
   `zone:enter`, so a patch would carry the same creature through the same call. The movers leave the old zone before
   write-behind's snapshot (priority −100) and are in the new one's. They come in at the border you crossed, as far
   along it as they were beside you (that is behind you: you arrive on the border tile, so "2 tiles behind" would be
   outside the zone), after their way's time. Who comes follows §5.1: every follower, and hunters within 3 tiles of
   the exit. A patch does carry what is *thrown* over an edge (`landItem`): that zone may not be in memory.
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
9. **Bosses and guardians don't heal or forget on catch-up** (only their statuses run out): a set fight, and the
   parent's bosses never forgot you (the old-game check found the Lich King's intro playing twice otherwise).
10. **Things in flight, lit bombs and gas wait for you** in a zone you left (as in the parent), rather than catching
    up: a bomb set by a secret wall still opens it when you come back.
11. **An ability's hit chance on the target screen comes from an optional `AbilityDef.spec(game, e)`** (§2.8 names no
    such field; WS4 decides whether its abilities give one).

## 5. Known issues

- **Followers are invisible in 3D until WS3's render3d.js draws every creature** (integration request 12, sent to
  WS3's session as well): 3D draws only creatures hostile to you and people. They exist in 3D (they block you,
  catch your bolts, follow and fight), and the map shows them. Under P0's attitude every monster is hostile, so the
  old game draws everything as before.
- **Monsters ignore your followers until a follower strikes them** (integration request 2, WS6a's attitude).
- **Spikes still hurt you while you're flat** (integration request 3, WS10's traps.js); an arriving creature can still
  nudge you in 3D for up to 4 s (request 4).
- **`passTime` costs more than at `p0-done`** (×1.2-1.7 in the alternating measure, §8): the AI does more (fleeing,
  followers, the d20 log's line of sight to tell creatures' fights only where you see them). p50 stays at 4-5 ms
  against the 12 ms budget.
- **The d20 set is harsher than the parent's from tier 5** (§3's table): for the integrator, WS4 and C4.
- The look line is the only thing L shows until WS5's examine screen opens on `inspect { open: true }`.
- `C:OTTOMR~1placeholder.txt` (6 bytes, outside every repository) was written by mistake during the verification
  fixes; the safety check stopped its removal: delete it by hand (it's also in the handoff).

## 6. What the next session must know

- **Run** `node tools/check-combat.mjs` (`--only combat,targeting,ai,arena,ttk`); `--perf --seconds 40 --against <a
  tree's root>` on an idle machine; `NODE_PATH="$(npm root -g)" node tools/browser-ws8.mjs --port 8648` with
  `node tools/serve.mjs 8648` serving the repository.
- **Everything new that changes the parent's play is behind `RULES.combat = "d20"`**; the integrator's flip turns it on
  (and then check-legacyfights needs the legacy set around its fights: integration request 9).
- **Followers**: `recruit(game, c)` (ai.js); they cross edges, stairs and world travel with you; your blows never
  turn them; `brain.arriving` hides a creature on its way in (everything that iterates `zone.creatures` and draws,
  targets or blocks should skip it: render3d, monsters.js pushPlayerOut).
- **The target screen** is `openTarget(game, opts)`; abilities reach it through `screens/target.js requestTarget`
  (integration request 1 makes abilities.js call it).
- `docs/ws8.md` has the public API and 12 integration requests.

## 7. Verification fixes

Three independent verifiers worked on `af1e199` (read-only, their own scratch copies): the gate (rerun every check,
70 mutants of the WS8 code against check-combat, scripts to break the claims, browser-ws8 on seeds 7 and 31), the old
game (seeded traces of the legacy dungeon levels in both views against `p0-done`, golden, legacy fights, screen frames,
bot, save, zones, edges, and 88 real-key steps in headless Chromium on each tree), and the spec and code (the diff
against DECISIONS, the bible §10.2/§10.6/§13.2/§15.6/§15.7, TECH_DESIGN §0.1/§2.8/§3/§4/§5.1/§8.3/§8.4/Appendix B).
The old game under the legacy set played **identically** in both views (1,397 and 984 map steps, 1,656 and 1,579 3D
snapshots, 112 + 36 throws, golden 86/27/95, legacy fights 1,359/1,027, 47 screen frames, 0 console errors). Each
finding was reproduced, fixed in its own commit, and given a check-combat assertion that fails without the fix (shown
by putting the old code back).

| Finding | Fix | Commit |
|---|---|---|
| **Major** (spec): your follower struck by you (Shift + direction, a second 3D swing, your knife or bolt passing through it) hunted you and struck back for 8 s | a friend takes your blow and goes on; anything else not out for you holds a grudge; perceive puts back to wandering anything on your side found hunting you | `b58960f` |
| **Major** (spec): followers (and anything wary or neutral) aren't drawn in 3D: render3d.js draws only `hostilesTo(player)` | integration request 12 (WS3's file), sent to WS3's session | `1d3fa72` |
| Minor (spec): fleeing had no real cap (a blow set a runner hunting, and it fled afresh: 32 "turns and runs" in 36 s); cornered bravery 3 s, not 15 | a runner struck keeps running: 10 s at most, then at bay 15 s; checked: 2 lines, at bay at 10.25 s | `e94f97e` |
| Minor (spec): the target screen named creatures you can't see as "in the way" | its flight passes through what isn't sighted this moment | `66f606f` |
| Minor (spec): you could step onto the tile of a creature still arriving, and it appeared on your tile | it comes in on the nearest free tile | `016f400` |
| Minor (spec): friendly fire one-sided (your bombs, splashes and gas spared followers; creatures' arrows flew through them) | splashes, blasts and gas reach every creature; an arrow at you hits your follower in its way | `165a24c` |
| Minor (spec): things thrown over a corner were lost | landOutside keeps both offsets and patches the corner's zone | `16e6f50` |
| Minor (spec): `}` `{` outside bible §15.7; a bolt-bow on the floor showed the sling's art | `)` for both, in wood colours; one launcher picture | `707096b` |
| Minor (spec): a second launcher could never be fired | E in the pack readies one | `ca3c76e` |
| Minor (spec): who crosses an edge differed from §5.1 (6 tiles of you, followers within 8) | every follower; hunters within 3 tiles of the exit | `d4f03d9` |
| Minor (spec): abilities showed no hit chance on the target screen (Appendix B) | `AbilityDef.spec`, shown without the aimed bonus; `ai.when` with no target documented | `5f0071d` |
| Minor (spec): click-travel and explore stopped whenever a follower came into view | only foes stop them | `f278418` |
| Minor (spec, gate): wording ("16 at most"; L at the sky said "You haven't seen that place."; the sling's info repeated itself; `dismiss`'s doc) | fixed | `b2dea01` |
| Minor (gate): a follower or hunter with no free tile to arrive on was lost | it comes in on the nearest standable tile, or stays where it was | `8b4fb76` |
| Minor (gate): check-combat left 23 of 70 mutants green (write-behind order, the hold-back window, the Plane under doors and over deep water, catch-up on a load, Tab order, an arriving creature touchable, legacy flee in the open, healed fleeing, log lines, bolts breaking, V's time on the map, the line past the range, hunters' attitude and guardians) | assertions for each; 18 of the survivors rerun on this tree, all 18 now fail it | `296ef61` |
| Minor (gate): `creaturesAlong` described as the target screen's; WS6a's spatial queries unchecked | docs fixed; nearestCreature, witnessesOf, creaturesAlong checked | `b60c444` |
| Minor (old game): a boss or guardian you came back to had dropped its hunt (the Lich King's intro twice) and healed | catch-up leaves bosses and guardians but for their statuses | `cb08a76` |
| Minor (old game): catch-up dropped things in flight, and lit bombs without their blast | they wait for you, as in the parent | `523d0d7` |
| Latent (old game): a creature whose `innate` holds its bonuses (stats.js) would crash the AI's ability step (abilities.js reads ability ids) | abilities only for a list; integration request 11 | `16d2058` |

Also found and fixed by the lead before the verification reported: followers on world travel and an arriving
follower coming along again (`5cd3a12`), a throw at your own tile (`58207f9`), the AI's per-frame work (`d873a4c`).

## 8. Timed numbers

Taken alone, after WS9's and WS3's sessions had quietened (CPU 10-65% between runs; the training job's load comes and
goes), against `p0-done` in alternation (`$TMPDIR/ws8/p0done` = `git archive p0-done`).

| Item | This tree | Reference | Budget |
|---|---|---|---|
| `passTime`, check-perf's own (60 creatures of 8 types within 11 tiles on 1,0,0, hunting you; 3 rounds alternating) | p50 **6.7 ms**, p95 22.1 | `p0-0d1` 6.45 (×1.04) | p50 ≤ 12: ok |
| `passTime`, check-combat --perf, hunting you, legacy set (40 samples each, alternating, both load orders) | p50 **3.98 / 4.62 ms** | `p0-done` 3.37 / 3.49 | ok |
| … hunting you, d20 set | p50 **3.93 / 4.38 ms** | 3.03 / 3.31 | ok |
| … two factions fighting around you, d20 (§3.4's arena) | p50 **4.05 / 5.24 ms** | 2.84 / 3.00 | ok |
| `mapStep` (check-perf) | p50 1.66 ms | `p0-0d1` 1.88 | ≤ 3: ok |
| check-perf, all items (alone, 3 rounds) | **PASS** (the outdoor frame over 17 ms as at `p0-0d1`: WS3's) | | |
| check-dungeons, check-status, check-stats | pass alone (in the full run under three workstreams' load the timed items read up to 148 ms; alternating with `p0-done` alone: p95 33 against 37 ms) | | |

The full `run-all` before the tag: §9.
