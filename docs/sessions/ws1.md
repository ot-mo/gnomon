# WS1: overworld travel

Phase 1 workstream (TECH_DESIGN §8.3 "WS1", with DECISIONS.md and bible §4.1, §4.6, §4.7, §4.9, §15.6), in the
worktree `gnomon-wt\ws1` on `ws/ws1` from `p0-done`, on the local machine (Windows 11, Node 20.11.0, headless
Chromium from Playwright), sharing the CPU with the user's training job and other sessions. The public API, the
integration requests and the handoff are in `docs/ws1.md`. Size: 15 files, +2,747 / −99 lines.

| Commit | What |
|---|---|
| `409411c` | The overworld: state and rules, discovery, lost, encounters, travel, rest, the drawing; the `world` and `wait` screens; `content/encounters.js` |
| `3f568e0` | `tests/checks/overworld.js`: the acceptance on both worlds |
| `1d816ea` | `tests/checks/world.js` section 5: the world map's travel graph |
| `f79e875` | `tools/browser-ws1.mjs`; `docs/ws1.md` |
| `14aedb2` `b348c9d` | Two findings of a scratch merge with `origin/integration` (§5). The interactive split swapped their check hunks: the legend-tier assertion is in `b348c9d`, the village one in `14aedb2`; each message describes the pair |
| `94df289` | `--walkSeed`, and the travel stream tested for bias (§2) |
| `9dd0ac6` | `docs/ws1.md` request 5: the `browser-0d1` tour block, run on the merge |
| `69ffe40` … `c598f0c` | The verification's findings, one commit each (§5) |
| `c7f19fd` `981574a` | The recheck's two findings (§5) |
| `50d96cb` | §6.7's world-map draw budget measured |

## 1. What was built

| Part | Files |
|---|---|
| RULES.overworld, the saved atlas (`game.state.atlas`), the travel stream (`hashFloat(seed, "travel", n)`), the 8-way step rule | `src/overworld/state.js` |
| reveal, isKnown, pin, knownSites, sight, the visit on every zone entry, discovery XP | `src/overworld/discovery.js` |
| The `lost` status, the lost chance (INT, Terrain lore, navigation, flying at the step's start), every way back | `src/overworld/lost.js` |
| Encounter chance and roll, the "band" patch op, legends on the road (by their lair's tier), travellers, hidden sites | `src/overworld/encounters.js`, `src/content/encounters.js` |
| enterWorldMap, worldStep, fastTravel (Dijkstra), leaveWorldMap (edge, corner, site, lost; a zone read from the save), dropInto, prompts | `src/overworld/travel.js` |
| rest / wait (Z) | `src/overworld/rest.js` |
| The world map's drawing; the `world` and `wait` screens, O and Z | `src/overworld/renderWorld.js`, `src/screens/worldmap.js` |
| The checks | `tests/checks/overworld.js`, `tests/checks/world.js` (section 5), `tools/check-overworld.mjs`, `tools/browser-ws1.mjs` (new) |

## 2. Gate results (TECH_DESIGN §8.3 "WS1" acceptance)

`node tools/run-all.mjs` at `50d96cb`: **all 37 checks pass** (133.6 s, 11 at a time, the timed ones alone at the end;
the CPU shared with the training job). On a scratch merge of `ws/ws1` into `origin/integration` (`p2-ws7b`, never
pushed): `run-all` 37 of 38 at `9dd0ac6` (check-perf's surface-generation max, one sample at 205 ms while the
verifier's run-all ran beside it: WS2's generator, which WS1 doesn't touch; check-perf passes alone, §3), and at
`50d96cb` check-overworld, check-world, check-sites, check-story and check-save pass.

| Acceptance item | Result |
|---|---|
| A Node random walk of 10⁴ steps: no crash; lost rate per terrain and encounter rate within ±2% of the data | **Pass** (`check-overworld` "random walk": 10,000 steps on each world, `drop: false` so it stays on the map, and a step that isn't allowed tried at random beside each: 467 and 647 refused, none moved you or passed time). Every step's hours as the data give them (travelHours, 3 along a road edge, +25% at night off roads): 0 differ; every step's lost chance = the terrain's × 2 at night, 0 along roads and rivers and onto road spans, and its encounter chance = the span's rate × 1.5 at night: 0 differ. **Every terrain** you can travel onto is then held to ±2 points: after the walk, a terrain with fewer than 40,000·q(1 − q) rolls (±2 points = 4σ) is topped up by steps back and forth onto one of its spans. Lost / wanted, encounters / wanted: **test world** flats 0.0219 / 0.0253, 0.0623 / 0.0625 (n 10,695); hills 0.0391 / 0.0408, 0.0738 / 0.0790 (2,889); marsh 0.1087 / 0.1107, 0.0909 / 0.0891 (4,739); forest 0.0754 / 0.0740, 0.0969 / 0.0965 (10,246); the road over the ridge 0 / 0, 0.1202 / 0.1250 (4,375). **Real world** road 0 / 0, 0.1267 / 0.1264 (13,118); flats 0.0884 / 0.0838, 0.1337 / 0.1333 (4,799); downs 0.0526 / 0.0585, 0.1230 / 0.1228 (4,618); steps 0.0874 / 0.0853, 0.0955 / 0.1032 (4,794); waste 0.2578 / 0.2538, 0.1311 / 0.1325 (21,827); pleatwood 0.1453 / 0.1476, 0.1126 / 0.1103 (14,740); river 0.0581 / 0.0600, 0.1006 / 0.1011 (4,645); stacks 0.1043 / 0.1104, 0.1069 / 0.1048 (5,694); tessellate 0 / 0 (its lost chance is 0: bible §5, "you never get lost on it"), 0.1296 / 0.1247 (4,375); teeth (the Molar pass) 0 / 0, 0.1262 / 0.1250 (4,375); deepPleat 0.2016 / 0.2013, 0.1183 / 0.1198 (27,050); shade 0.2843 / 0.2971, 0.1210 / 0.1209 (15,686); sea (the Drowned Lantern) 0 / 0, 0.1296 / 0.1250 (4,375). Overall encounters 0.0858 / 0.0866 and 0.1207 / 0.1206. The walks' time moved by exactly their hours' seconds (R10). A mutant rolling the lost chance × 1.15 fails four terrains. It also passes at `--steps 1000`, 3,000 and 30,000. The stream is unbiased: over 10⁶ draws χ²(19) 13-25, lag-1 correlation ≤ 0.002, and four walks of 50,000 steps (`--walkSeed 0..3`) kept every terrain within z ±2.5, ±1.7, ±1.7, ±1.5. |
| Fast-travel paths only over allowed spans; `travel: "no"` spans never entered | **Pass** (`check-overworld` "fast travel": a random half of each world's spans visited, 200 targets a world: 101 / 98 paths of 2,539 / 2,058 steps, every step legal (`canStep`), along a road or river edge or onto a visited span, no "no" span, a "drop" span only as the end; a path exists exactly when a plain search by the same rule finds one (99 / 102 without). Real journeys: never lost; ~2,000 fast steps a world at a span rate of 0.4 met 0.1285 / 0.1207 and 0.1290 / 0.1221 encounters (a quarter, × 1.5 at night; the full-rate mutant: 0.4785); no hidden site asked about. No walk step onto a "no" span (0 of every step taken); `check-world` section 5: every "yes" and "road" span reached from the start (675 of 675, 730 of 730), no "no" span reached (125, 91 walk-in only), the real Lattice's rim reached (21 of 61, its inside walked). |
| Arrival edges correct for all 8 directions | **Pass** on both worlds (`check-overworld` "arrival edges", centres (5, 5) and (8, 17)): down after a step east at (0.5, 23.5), west (79.5, 23.5), north (39.5, 47.5), south (39.5, 0.5), the corners (0.5, 0.5), (79.5, 0.5), (0.5, 47.5), (79.5, 47.5) by direction; facing the way you went (yaw = atan2(dy, dx)); on ground the zone's anchor reaches; in the map view. Unmoved, down where you stood (x, y, z and time unchanged). In the browser: down at (0.5, 23.5) facing east after a step east, on the map and in 3D. |
| Encounter bands land 8-12 tiles from the arrival, in visited and unvisited zones | **Pass** (`check-overworld` "encounter bands": 12 spans a world, first unvisited, then visited: test 48 creatures at 8.6-12.0 and 48 at 8.0-12.0 tiles; real 48 at 8.0-11.7 twice; every member placed; back into the zone you opened the map from, by a step and by a rest on the world map, still 8-12 from where you arrive). One rolled for real a world (`drop: true`): taken down into the span's zone, 2 of 2 members 8-12 tiles away. A legend on the road (WS10 #7's patch): in the zone it was met in, 8-12 tiles away, its uid claimed there, not rolled again, its lair's `claimUid` refused; dead: never rolled; it roams within a tier of its lair's tier. On the merge with a real legend (seed 1, the salamander Zhadran of the lair at (37, 5)): rollable on its tier, met in (13, 0), and its lair (37, 5, 1), entered afterwards, holds none of it (guardians.js on arrival). |
| A rest is interrupted by an encounter roll | **Pass** (`check-overworld` "rest"): in a zone, "until healed" at 1 HP with every roll a hit: stopped after exactly 1 world hour (60 s), why "encounter", the band 8-12 tiles from you; on the world map: taken down into the span's zone, the band placed. One roll a whole hour (3.5 hours: 3 rolls); 1,500 one-hour rests at a span rate of 0.4: 0.2547 an hour against 0.2413 wanted (half the rate, × 1.5 at night), never travellers. A hostile awake 3 tiles off: no rest, 0 s; on the world map, a hunter where you stood doesn't stop it. Until dawn from 20:00: 05:00. The torch snuffed while you wait (100 glim kept through a night), burning when kept lit (1 glim). A death on the road ends the journey; the next run's Z is an ordinary rest. |
| Browser: the world map at 100×30, 160×64 and 180×56 | **Pass** (`tools/browser-ws1.mjs` on `tools/serve.mjs 8641`, `?silent=1`, real keys and clicks, at `f79e875` and again at `c598f0c`, after the verification's fixes): 800 of 800 spans drawn at each size, the panel in the bottom strip at 100×30 and on the right at 160×64 and 180×56, header, @, key footer; 0 console errors; 1 audio connection rerouted to the silent sink. In Node (`check-overworld` "screen"): both worlds at the three sizes (800 / 882 spans each), drawn in 0.88-1.45 ms p50 (§6.7: ≤ 3). |
| Browser: travel → enter → walk off → world map round trip | **Pass** (`browser-ws1` part 2), on the map and in 3D: O, → to (1, 0), Enter (down at (0.5, 23.5), facing east), ← (map) or S held (3D) until you walk off the west edge into (0, 0), O again (@ on (0, 0)), Esc. The mouse: a click steps south, right clicks pin and unpin, "Z: wait" and "Wait 1 hour" by clicks (60 s), "Enter: go down", the look-only map closed by "Esc: close". Also on the merge with `origin/integration`. |
| No zone simulation while travelling | **Pass** (the walk): no zone made or entered on either world's walk (no `zone:enter`, `game.zones` the same size), and the zone you left kept every creature's position and HP. |
| R10 | **Pass**: every hour of travel and rest is `skipTime`'s; the walk's time is exactly its hours' seconds; a 2-hour rest ran a 6 s poison to its end (6 HP) and took 120 s off a 300 s cooldown (180 left). |
| The `lost` status through `status.js` | **Pass** (`check-overworld` "lost"): a sure loss drops you lost into the span's zone on the map, the HUD's status line shows LOST, the world map refuses; a new zone at chance 0 keeps you lost, one already tried isn't rolled again, a zone first entered while lost doesn't count as known, a new zone at chance 1 finds you, Homing sense's 50% is the roll it uses; a zone visited before you got lost, a road span, bearings from height in 3D (6 blocks up, half a turn over 2 s; not on the map, not 3 blocks up), "Which way am I?" to the temple's talker each end it; it lasts exactly a world day at most (lost at 1,439 s, found at 1,441). The chance: the forest's 0.1, 0.06 at INT 20, 0.025 once Terrain lore has learnt it, 0 flying when you set out. |

Also (not in §8.3's list): discovery (`check-overworld` "discovery"): reveal radius 1 knows 9 spans; a secret's pin once;
Halfnight known from any of its three spans; a new run at 0 XP on either world; discovery XP: the test world's ruin
landmark 78 (0.3 × lvlXP(5)) once, a ruin site 26 (0.1 × lvlXP(5)), a village 0 from discovery; hidden sites 0.0975
(want 0.1) and 0.2008 with Keen Eye (0.2) over 4,000 rolls, a declined one not recorded, a looked-at one found ("road")
with you by it; travellers pin a rumoured site and leave you on the map; a tier-3 span at level 1 asks first, passes no
time until yes, and only Y / N answer it (not the footer); fast travel's warning names the highest tier on the way. A
zone read back from the save: a failed read leaves you on the map, free; a read that works takes you down. On the
merge: discovery XP equals WS4's `xpReward("landmark", 5)` (78), Pilgrim gains 172 (× 2.2), a location secret learned
through `learnSecret` shows its pin.

**The old game**: golden (a) 86/86 in both views, golden (b) 27/27 frames, the 47 recorded screen frames compared, 0
mismatched, the legacy fights, the bot in both views, check-save's round trips (one of them failed in the first
run-all: the start span's reveal stamp, a time of 0, was taken for "not yet" and re-stamped on a load; fixed before the
first commit, `409411c`). A new run starts at 0 XP. In the browser (`browser-0d1 --against p0-done` on the worktree):
the HUD at 100×30 (12 segments), golden (b) 27 of 27 frames in the browser, frame time per tick underground +0.7% (3D)
and +0.2% (map), on the surface −2.2% and −0.3%; its mode tour reports `world` and `wait` unreached until the
integrator adds request 5's block (on the merge with it: 25 of 25 modes). `browser-0d2 --all` on the merge: both boots
(181 modules, no console error), `test-world.html` 34 passed, 0 failed, overworld 6.3 s in the page.

## 3. Timed checks

Alone, against `p0-done` in alternation, the CPU at ~21%: `check-perf --against p0-done --rounds 2` **PASS** (the
outdoor frame p50 22.85 ms against 23.0 there, ×0.99: over its 17 ms budget on this machine at `p0-done` too; dungeon
frame ×1.04; refresh ×1.04; surface generation p95 ×0.92, max 131.8 against 141.1; dungeon generation p95 ×0.90;
passTime 6.04 against 5.15, ×1.17; mapStep ×1.12; skipTime ×1.00). passTime and mapStep again, `--rounds 3 --no-render`:
**PASS**, 5.68 against 5.82 (×0.98) and 1.60 against 1.51 (×1.06): the first reading was noise (WS1 adds no work to
either: its one per-frame hook runs in 3D only and returns at once unless you are lost). The world map's draw (§6.7,
≤ 3 ms, not in check-perf): 0.88-1.45 ms p50 at the three sizes in `check-overworld`.

## 4. Deviations (each also in `docs/ws1.md`)

1. **O, not the bible's U** (§4.1): TECH_DESIGN §4.3 allocates O to WS1 and reserves U; key allocation is the tech
   design's. Z works in both views and on the world map (DECISIONS and the bible; TECH_DESIGN said the map only).
2. **12 tiles** for O and Z (the bible's), not TECH_DESIGN's 10; "awake" (hunting) hostiles, as `skipTime` counts them.
3. **Getting lost by the bible** (§4.9, §15.6): the world map locks and the ways back are rolls, not TECH_DESIGN's
   "walk off any edge or 60 game minutes"; a world day is kept as the longest it can last.
4. **Roads 3 hours** (bible "roads stay roads"), not TECH_DESIGN's × 0.5; rivers: 0 lost and the span's own hours.
5. **Hidden sites** are the bible's per-site roll with "Stop and look?", not a kind in the encounter table.
6. **Discovery XP for a non-village, non-landmark site** is 0.1 of a level's XP (no number in the bible); the
   progression table wins once it names "site". A visit is entering the span's zone (or one under it).
7. **Terrain lore** applies to as many terrains as its rank, each the first lossy terrain travelled after taking it.
8. **The night** of a step (+25% hours) and flying (−10 points) are judged at its start, its lost and encounter rolls
   at its end.
9. **Not built:** the Hush Stair (needs span data, C1), the Hand's caravans (WS3's Hand), Drover caravans and the
   homing pip (services and items: `fastTravel` is their seam); the torch's Shade drain on the world map (torch.js,
   request 6).
10. A step whose zone can't be read back from the save still reports `dropped: true` with its encounter, which never
    lands (you stay on the map, free): harmless, fast travel stops on it.

## 5. Verification

**The scratch merge** (`ws/ws1` into `origin/integration`, a detached worktree in the scratchpad, hooks off, never
pushed; one conflict, the two import lines of `tests/checks/world.js`, joined as request 12 says). Two findings, fixed
on `ws/ws1`: a legend roamed by its own tier, 3 levels above its lair's, so a tier-3 lair's legend met you only on tier
4-6 land (`14aedb2`); check-overworld took a village's own first-visit XP (WS7b's) for discovery's (`b348c9d`).

**One independent verifier** (a fresh agent given the contract, not my conclusions; it edited nothing): 8 bugs, 9 check
gaps (mutants on scratch copies), 3 text items. Every one fixed or taken up, one commit each, every new assertion shown
to fail without its fix or on the verifier's mutant:

| # | Finding | Commit |
|---|---|---|
| 1 | An encounter on the span whose zone you were still in measured from where you had stood (47 tiles off) | `69ffe40` |
| 2 | `game.trip` outlived a death on the road and the next run, so Z there rested "on the world map" | `0622691` |
| 3 | A failed read of a stored zone left the world screen busy for good | `c30561f` |
| 4 | A click on the footer under an open prompt answered it ("Enter: go down" said yes to the tier warning) | `b59fcce` |
| 5 | `sight()` measured to a landmark's farthest span | `05cd346` |
| 6 | A right click in the margin beside a narrow world pinned a span off the map | `ee63cad` |
| 7 | Flying's −10 points read after the step, when the flight is always over | `5d4b271` |
| 8, 18 | Fast travel's tier warning named the first far span; the step's warning began in lower case | `4b76f50` |
| 9 | Fast travel's × 0.25 never measured through worldStep | `e2e0c23` |
| 10, 15 | Rest's half rate, no travellers for a sleeper, the world-map rest no hunter stops: untested | `d4a269b` |
| 11 | "No hidden sites on fast travel" untested | `3be99c9` |
| 12 | The hidden-site rate (10%, 20% with Keen Eye) untested | `da89813` |
| 13 | "The start span pays no XP" vacuous (measured after the start was paid) | `ea34089` |
| 14 | Lost's end checked only from above (also showed `5d4b271`'s test starting a new run mid-section) | `22a105f` |
| 15 | INT, Terrain lore, Homing sense untested | `7163acc` |
| 16 | Only terrains with 500+ rolls checked, and 500 too few for ±2 points to mean much | `8de1614` |
| 17 | A band short of members was a stat, not a failure | `c598f0c` |
| 19 | These notes unfinished (this file) | — |
| 20 | Request 7 (restClears 3600 is 60 world hours) confirmed: no rest ever clears the second wind | request 7 |

**The recheck** (the same verifier, against `c598f0c`): every fix holds and nothing in the game code is newly broken;
two findings, fixed: the walk's top-up stopped short below the default step count (`--steps 3000` failed;
`c7f19fd`); the zone entry that ends a journey left behind had no check that fails without it (`981574a`). After
them: run-all 37 of 37 at `50d96cb`, browser-ws1 PASS, the merge's checks above PASS.
