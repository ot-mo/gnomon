# Workstream WS3: rendering outdoors and presentation

Phase 1 workstream WS3 (TECH_DESIGN §6, §8.3 "WS3", files §8.4; DECISIONS §1's clock; the bible's Dial, Hand and
Gnomon, §1.3, §4.8, §4.12, §15.6), on branch `ws/ws3` from `p0-done`, in the worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\ws3`, on the local machine (Windows 11, i7-10750H, Node 20.11.0, headless
Chromium from Playwright; the Intel UHD through ANGLE/D3D11 for browser frame times) while WS8 and WS9 ran their own
checks on the same machine (timed numbers below were taken alternately with `p0-done`, and again when the load
dropped). The public API, the integration requests and the handoff are in `docs/ws3.md`.

| Commits | What |
|---|---|
| `71a1125` | The clock's looks; daylight through the light seam; the baked sun; the horizon plane and haze; castRay's fast paths |
| `74c647e` | The first frame in a new zone stays fast (V8 kept the renderer's optimized code across zones) |
| `46a6ded` `5a84520` | The map outdoors (ground looks, the terrain legend, liquids), music moods, `tests/checks/render.js`, `check-perf` against `p0-done`; moonlight, legend labels |
| `b267794` `87a902c` `19b7776` | The two P0 test changes the session that started WS3 approved (clock §5 as a seam; the victory card not compared, its make-up check) and their listing |
| `b17d715` … `a7c08bd` | The verification's fixes and additions (§4) |
| `dcbaa72` … `cc9ef9e` | The recheck's fix (the swap frame on the GPU) and the re-review's fixes and tests (§4) |
| `fd86970` and these notes | `docs/ws3.md` and `docs/sessions/ws3.md` |

## 1. What was built

| Part | Where |
|---|---|
| The Dial's sun (up in the south-east at 06:00, over the Gnomon at noon, down in the north at 18:00, its shadows along the Hand), daylight with dusk and dawn ramps, the Shade's and the Hand's dimming, the Hand itself, sky colours by the hour, the haze, light buckets | `clock.js` |
| Daylight from the clock in `lightAt`/`naturalLight`/`inDark`; the lit mask following daylight (the auto-map's night rule), synced on entering a zone; the edge clamp; the baked sun (`zone.sunlit`, a slice a frame, neighbours ahead, again when the apron changes); state kept by the zone's `skyLight` | `light.js` |
| The apron in a 3 × 3 band grid; above the zone's top rays only mark the auto-map; the in-grid test first; how a miss left | `raycast.js` |
| Sky light × daylight with a moonlit floor; the sun's colour by height; shadows from the bake; sky gradient, sun disc, clouds, stars; haze; 48-tile reach; the apron lit as open ground; the horizon plane on the side a ray left by; the Gnomon on the horizon; liquid tints (also underground and beyond an edge); dynamic half-column rendering; a pixel loop that survives zone changes; the HUD's clock segment for the integrator | `render3d.js` |
| Ground looks outdoors, disguised pits and bridges, the narrow terrain legend (glim; the features seen), liquid colours in any zone, `toggleMapLegend(game)` | `renderMap.js` |
| Surface moods by landmark, region, terrain and night; voice objects for `speakLetter` | `music.js`, `content/moods.js`, `sfx.js` |
| The render check (12 parts; its memory part with `--expose-gc`, as `check-perf` runs it) and the perf items (noon, dusk, night, the bake, the swap) | `tests/checks/render.js`, `tests/checks/perf.js`, `tools/check-perf.mjs` |

## 2. Gate (TECH_DESIGN §8.3 "WS3" acceptance)

**`node tools/run-all.mjs`**: 37 of 37 at `238fd92` (110.9 s, 11 at a time, the machine quiet), with the two P0 test
changes the session that started WS3 approved (`b267794` clock §5 as a seam check; `87a902c` the victory card drawn but
not compared): the other 46 screen frames and golden (b)'s 27 frames still match.

**Node frame ≤ 17 ms at 180×56 on the test zone with its apron** (`check-perf`: the start span 6 tiles from its open
east edge, the apron filled, the camera turning a full circle; p50 of 144 frames over two runs, alternating with
`p0-done`; `node tools/check-perf.mjs --against p0-done` at `238fd92` on the quiet machine):

| | noon | dusk (18:30) | night (23:00) | dungeon (legacy level 3) |
|---|---|---|---|---|
| this tree, p50 (p95) | 16.07 (23.0) ms | 14.71 (16.7) | 14.75 (17.3) | 10.41 (15.9) |
| `p0-done` (draws noon at every hour) | 22.55 | 22.47 | 22.43 | 11.64 |
| ratio | ×0.71 | ×0.65 | ×0.66 | ×0.89 |

Inside run-all (check-perf alone, this tree only): 15.77 / 14.76 / 14.75 / 10.29 ms. render3d alone at noon, three
alternating rounds: 15.56 / 15.67 / 15.62 ms against 22.19 / 22.46 / 22.83. Under the other sessions' load (99% CPU)
the same item read 22.56 against 24.02 (×0.94, "the machine's"). The rest of §6.7 against `p0-done` in the same run:
refresh 7.74 ms (×1.03), apron 0.16 (×1.00), surface generation p95 30.0 (×1.08) and max 126 (×1.06), dungeon
generation p95 29.4 (×0.93), buildRun 0.44, restoreRun 0.22, passTime 6.13 (×1.17; its runs read ×0.74-1.17), a map
step 1.62, skipTime 0.03: all within budget. The edge swap (step + draw, three crossings each): p50 23.5 ms, max 29.1,
against `p0-done`'s 55.8 and 60.7.

**In the browser** (headless Chromium on the GPU, ANGLE/D3D11, the launch shim of `0D2.md` §8; §6.7's browser rows):
render3d at 160×64 cells (1280×960), outdoors at noon, the camera turning, three alternating rounds of 150 frames:
p50 12.8 ms (p95 16.4) against `p0-done`'s 18.0; on a quieter run 11.4 against 17.5 (budget 13). present: p50 3.5
(p95 5.9) against 3.0; quieter 3.2 against 2.9 (budget 5; the horizon plane fills cells that were blank). browser-0d1
against `p0-done` (per tick at 1280×720): surface 3D −10.8%, underground 3D −0.3% and map −0.3% (within its 5%),
surface map +0.7%. The edge-swap frame (browser-gate, seeds 1234, 7, 31, three rounds alternating, the machine at
57% when it started), medians per seed: 32.8 / 38.0 / 35.8 ms with the next frame back to 15-18 ms, against
`p0-done`'s 33.9 / 38.7 / 28.6 with a second slow frame (25-36 ms) after it; the median frame 16.4-16.7 ms in both;
the black share at the swap 0.006 → 0.007 against 0.11 → 0.055 (5 whole black rows). What is left of the swap is its
step (the new zone's far apron bands built from the world functions: integration request 6).

**Sun bake ≤ 4 ms** (one light bucket, the start span with its apron, 12 buckets 06:07-17:07, `bakeSun` whole):
p50 1.56 ms, the budget's statistic (`perf.js`: p50 ≤ 4); p95 5.3 and max 5.4 are over 4 ms: the low sun's buckets,
whose rays run the full 40 steps. In play a new bucket (or a new
apron) is baked 2 ms a frame while the old bake is drawn, and the next zone is baked ahead; only a zone entered with no
bake at all (a load, a teleport) pays a whole bake in one frame.

**Zero black cells below the horizon facing an open edge at noon** (render.js §2): 100 views (the test world's start
span on seeds 4242, 1234, 7; the real world's start, Hollowmere; 3,17 and 7,19, which have a shut corner between two
open sides; every side and corner from 6 tiles and 1 tile in; Hollowmere at 180×55 with pitch 0, the level row),
0 black cells, worst view 0. `p0-done` in the 34 views of the first version of this check: 41,799 black cells, worst
view 4,320, 110 whole black rows. The gate verifier's own sweep (before the corner fix): 0 black outside shut corners
in 67,544 views on 124 real and test spans at three pitches.

**At noon with the torch out no ghost planks or glowing runes on a sky-lit zone, at midnight they show; the auto-map
follows the night rule** (render.js §3, by the clock, not `setDaylight`; each assertion shown to fail with the old or a
mutated code): a ghost plank drawn at noon no, at midnight
yes, at midnight with the torch lit no; glowing rune cells 0 at noon, 2,042 at midnight; columns the map marks on a
24 × 24 field from its middle: noon 576 of 576, 18:30 576, midnight with the torch out 9 (the 3 × 3 around you),
with the torch lit 137, with a lamp 127; in 3D 116 at noon and 9 at midnight; a zone entered at midnight with the map
looking before any frame: 9. The Shade by day: daylight 0.2, dark-only things show.

**Golden (b) unchanged**: 27 frames, 0 mismatched (check-golden, render.js §9, and in the browser by browser-0d1);
check-screen-frames 47 drawn, 46 compared, 0 mismatched (the victory card not compared, approved: §3 of
`docs/ws3.md`'s requests; its make-up, render.js §10, 0 of 9,288 cells outside the card differ from the map without
it). The gate verifier: 1,120 underground states (seeds 1234 and 31, legacy levels 1-20, four hours, torch on and
off, three yaws, the map) hash-identical with `p0-done`.

**Browser screenshots at day, dusk and night, and a map of each biome** (headless Chromium at `238fd92`, `?silent=1`
and the analyser-and-zero-gain sink: 0 console errors, 1 audio connection rerouted, none to the speakers; served on
127.0.0.1:8643 and stopped; sent to the user, not committed). The 3D view at 1280×720 (160×48 cells), standing 6 tiles
in from an open side and facing it, black cells below the horizon (a blank or a colour under 8) of 3,680:

| span | dawn 05:30 | noon | dusk 18:30 | night 23:00 (torch lit) |
|---|---|---|---|---|
| the temple (test world 0,0,0) | 20 (the message line) | 0 | 0 | 12 |
| Hollowmere (5,16) | 20 (the message line) | 0 | 0 | 19 |

(The 20 at dawn are the log line the HUD blanks; the night's few are the dark.) Mean colour of the view: noon
163,188,179 and 161,179,179; dusk 124,107,90 and 128,111,101; night 32,41,48 and 43,49,57. The Gnomon: from
Hollowmere at noon and at 18:30, drawn (the needle, the glint at noon); from the Shade's farthest span (23,10) at
23:00, its violet light; a span under the Hand at 10:00 (28,3, the Deep Pleat) drawn at daylight 0.2, one beside it
(28,5) at 1. The zone map at 1440×810 (180×54 cells) with every column seen, one span of each terrain: the test
world's flats (the temple), hills, forest, mountains, marsh; the real world's waste, pleatwood, teeth, deep pleat,
lattice, road, shade, river, tessellate, stacks, steps, downs, flats, sea (the Drowned Lantern): 19 maps, each with
the outdoor legend beside the zone and glim in it.

## 3. Deviations from the design, with reasons

1. **The sun is not baked in `refresh()`** (§6.4): `refresh()` is `world.js`'s (frozen), and generation calls it, so a
   bake there would land in surface generation's budget for zones nobody looks at. The zone you are in is baked when
   it has no bake (at once), a new light bucket or a new apron a 2 ms slice per frame while the old bake stays drawn,
   and one neighbour in memory is baked ahead per frame, so the frame that crosses an edge finds a bake ready.
2. **The lit mask is rebuilt by daylight step, not by light bucket** (§6.3): it depends only on daylight, which moves
   only at dusk and dawn (and between dimmed and open spans); 32 steps, and no work by day or at night.
3. **The apron gets the sun's light, without shadows** (§6.1 says sky × daylight and haze, no baked sun): without it
   the open ground beyond an edge drew darker than the same ground inside, a seam at every edge.
4. **The day follows DECISIONS and the bible**: dawn 05-06, day 06-18, dusk 18-19, night 19-05 (not §6.3's "dawn
   06:00, dusk 20:00"); the sun's path is the bible's (§1.3, §4.8), up at 06:00 and down at 18:00, 63° at noon.
5. **The outdoor legend is a narrow terrain legend** (§6.5: the legend "gains terrain rows and a toggle key"): an
   80-wide zone takes 160 columns, so the parent's 30-wide legend never fits beside it at 180; the outdoor one is 18
   wide. The toggle is `toggleMapLegend(game)`; binding a key is an integration request.
6. **A moonlit floor at night** (§6.3's "night floor for moonlight"): the sky term is 0.08 / 0.1 / 0.18 at daylight 0,
   so open ground shows faintly; the rules (`inDark`, the auto-map) see daylight 0.
7. **Dynamic resolution** (§6.7) times the ray-cast loop only (the part halving helps), and leaves half-column mode
   on the full cost (the halved cast ×2) being under 12 ms for 2 s, or a 14 ms frame would flip every 2 s.
8. **Outdoors the tone curve is read from a table** (within 1e-4 of a colour step); underground it is computed as
   before.
9. **The HUD's clock segment is exported, not registered** (§4.5): `tests/checks/hud.js` (P0) holds the 180-column
   status row to the parent's order on the start span, which is outdoors; an integration request.
10. **The Gnomon is the bible's** (§4.12), not §6.6's optional skyline of every landmark: 600 tiles tall, a 6-tile-wide
    needle leaning 6% toward the Shade, drawn over sky and horizon-plane cells only.

## 4. Verification and fixes

Two independent verifiers reviewed `p0-done..19b7776`: one the gate and the old game (run-all, check-perf, the
browser tools, regressions, probes against the claims), one the spec and the code. A third, fresh, reviewed the
fixes (`19b7776..`). One commit per finding, each with a check that fails without it where a check can see it (shown
by putting the old code back), and the affected checks rerun before every commit.

| Finding | Fix | Commit |
|---|---|---|
| (major) Rays above the zone's top stopped before marking the auto-map: the map view's reach on flat ground fell from about 24 tiles to 8 (Waste (3,4): 1,876 columns at p0-done, 193) | Above the top a ray only stops looking at blocks; with `seen` it goes on marking. The reviewer's spans match p0-done exactly; render.js §3 wants all 576 columns of the field by day (193 with the old exit) | `b17d715` |
| (major) The sun rose east, stood south at noon and set west, against the bible (south-east, over the Gnomon in the north-east, north; shadows along the Hand) | The bible's path: the Hand's opposite bearing, 63° × sin(π (h − 6) / 12) high; the Hand (§4.8) built and dimming the spans under it; stars and the disc by the hour's daylight (stars showed at noon on the Shade); sky and haze by the zone asked. render.js §1: bearings, shadows along the Hand at 7 hours, the bible's §15.8 cases for the Hand | `6ef5746` |
| (major) The outdoor map gave away unexplored pits, ghost planks and unseen bridges by their colour | They take the ground beside them (else the zone's commonest); render.js §6 | `b4f9845` |
| (major) `dropDerived` no longer freed a dormant zone's light arrays and apron (WeakMaps keyed by the zone) | Keyed by the zone's `skyLight`; render3d holds no arrays between frames; the reviewer's gc probe frees them as at p0-done | `38312c1` |
| (major, gate) Black below the horizon toward a shut corner between two open sides (18 real spans, four beside Hollowmere: 2,034 of 4,860 cells from 1 tile in) | A ray leaving downward beyond the grid is the world beyond (the horizon plane), not a pit; render.js §2 faces 3,17 and 7,19 | `4b18fa1` |
| (minor) With an odd row count at pitch 0 the level row drew black (166-180 of 180 cells) | A level ray takes the horizon's colour; render.js §2 at 180×55 (its first version couldn't fail: fixed in `b2cf218`) | `4d0e969` `b2cf218` |
| (minor) A neighbour baked ahead (no apron) kept missing shadows from beyond its edge until the next bucket (68-79 voxels) | A bake remembers its apron and re-bakes in slices when it changes; 0 voxels differ a frame after the swap; render.js §5 | `f1cd90e` |
| (minor, gate) The lit mask was built at the last synced daylight: after loading a night save the first map step marked 1,864 columns | `zone:enter` syncs the entered zone's mask; render.js §3 (576 with the old code, 9 now) | `265c05b` |
| (minor) The rune assertion compared noon and midnight frames, which always differ | It counts glowing strokes (0 at noon; always-glowing runes give 30) | `4e5b3d6` |
| (spec) No HUD clock segment (§4.5) | `CLOCK_SEGMENT`, for the integrator to register (check-hud's P0 assertion) | `6e28126` |
| (spec) `speakLetter` took NPC type keys with Maren as the default (§1.2) | Voice objects, the parent's ids, else `NEUTRAL_VOICE`; render.js §7 | `4648169` |
| (spec, bible §4.12) No Gnomon on the horizon | Built: the needle at its true bearing, the noon glint, the violet light from the Shade and the mesa tops; render.js §11 | `b92b878` |
| (minor) Liquid tints only outdoors and never in the apron | Any zone's water, and the neighbour's beyond an edge; render.js §6 | `c46aa83` |
| (note) The horizon plane's side by direction (a diagonal seam) | The side the ray left by | `60e7899` |
| (note, gate) The outdoor legend had no feature rows; the legend toggle judged from the last map drawn | Feature rows for what you've seen; `toggleMapLegend(game)`; render.js §6 | `a7c08bd` |
| (recheck) On the GPU the swap frame read 32-43 ms after the fixes (25-28 before): the cold swap's draw had gone from 29 to 49 ms in Node, V8 throwing out the pixel loop on comparisons in branches the first zone never took (the new marking loop, the plane's side, sunlitGrid, the clamp) | Those tests run every comparison on every call; the cold swap draws in 19-21 ms, no WS3 function deopts at the swap | `dcbaa72` |
| (re-review, major) A chasm's middle took the zone's commonest look (grass inside the temple's tiled chasm room: the chasm's shape) | The nearest true floor's look; render.js §6 on the temple span: 0 of 60 holes unlike the floor within 4 tiles (30 before) | `5727f2c` |
| (re-review, minor) The Gnomon vanished from under its tip in its own span; hung 14 blocks up over a span without its foot; was "in sight" all night | Cut at the near plane; on whatever stands at its span's middle; at night only its violet light, where it can be seen (`gnomonLightSeen`); render.js §11 pins each rule | `be6b9ea` |
| (re-review, note) A neighbour's pit seen across the edge drew as the horizon plane | A pit inside the grid or an apron band; the plane only where no band is; render.js §2 | `264ffc4` |
| (re-review, note) `voiceOf`: `wave: undefined`, `pitch: Infinity`, an inherited pitch | Own keys only, each checked | `87243f3` |
| (re-review, minor) 20 of the reviewer's 33 mutations passed the render check | It now checks the Hand's length, cap, hours and width, the plane's side, the Shade's sky and stars, the apron's water in a frame, a pit from above, `toggleMapLegend(game)`, and (with `--expose-gc`) a dormant zone's arrays freed; each fails with its mutation | `cc9ef9e` |

Left as they are, with reasons:

- **Shadows move every 15 game minutes** (15 s of play) and a new bucket costs a 2 ms slice a frame while it bakes:
  the design's light buckets; the bake's budget is per bucket.
- **The Shade by day fills the auto-map** (daylight 0.2: the lit mask passes its threshold, as at 18:30 elsewhere),
  while `inDark` says dark: the Shade is "dusk even at noon", and dusk marks the map.
- **Dynamic resolution is on in `test-world.html`'s pages too**: the checks that hash outdoor frames turn it off;
  `browser-0d2` passes with it on.
- **The held weapon is lit by raw sky light at night** (`hud.js`, WS9's) and `tests/checks/index.js`'s perf line names
  p0-0d1: integration requests 7 and 8.

## 5. Recheck before the tag

At `238fd92`, the machine quiet (no other session's checks running), one at a time:

- `node tools/run-all.mjs`: 37 of 37 (110.9 s); check-perf alone inside it within every budget.
- `node tools/check-perf.mjs --against p0-done`: every item within budget (§2's table); the render check alone with
  `--expose-gc`: 12 parts pass, the dormant zone's five arrays freed.
- Browser: browser-0d1 against `p0-done` and browser-gate on the GPU pass (§2; run at `dcbaa72`, the renderer unchanged
  since but for the Gnomon's rules, the apron's pits and the test hooks), the screenshots at `238fd92` (§2). Every
  browser closed, every server stopped (no browser process left).
- The reviews' findings as the render check pins them, at `238fd92` with `--expose-gc`: the map's reach by day 576 of
  576 columns, entered at night 9; the corner and level-row views 0 black in 100; the apron re-bake 0 voxels off
  (68 without it); the dormant zone's 5 arrays freed; the chasm 0 of 60 holes unlike its floor; the Gnomon's rules
  (cut at the near plane, on its span's middle, its violet light at night only from the Shade and the mesa tops).

## 6. Known issues

- The map legend says "gold" underground (golden (b)); the outdoor legend says glim.
- The swap frame's step builds the new zone's far apron bands from the world functions (zones.js, WS2's builder):
  integration request 6.
- No key toggles the map legend yet (request 4); at 160 columns the outdoor legend stays hidden until one does.
- The clock segment isn't on the HUD until the integrator registers it (request 3).
