# WS3: rendering outdoors and presentation

Phase 1 workstream WS3 (TECH_DESIGN §6, §8.3 "WS3"; files §8.4), on `ws/ws3` from `p0-done`, in the worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\ws3`. Gate numbers: `docs/sessions/ws3.md`.

## Public API

What other workstreams and the integrator can use (everything P0 froze keeps its name and meaning).

### `clock.js`: the looks (pure functions of the time of day, and of the span for the Shade and the Hand)

| Export | What |
|---|---|
| `daylight(game) → 0..1` | 1 by day (06-18), 0 at night (19-05), a smoothstep through dusk (18-19) and dawn (05-06); at most `SHADE_LIGHT` (0.2, under `RULES.dark.threshold`) on a span of the Shade (a `dark` terrain) or under the Hand |
| `sunDir(game) → [x, y, z]` | toward the sun (bible §1.3, §4.8): up in the south-east at 06:00, over the Gnomon in the north-east at noon (63° up), down in the north at 18:00; z < 0 at night. By day its bearing is the Hand's opposite, so shadows point the Hand's way |
| `handAngle(h)`, `SUN_NOON_HEIGHT` | the Hand's angle at hour h, θ = 25° + 11° × (h − 12) from due west toward south; the sun's noon height |
| `handAt(game, m) → { x, y, dx, dy, length } \| null` | the Hand (bible §4.8, §15.6): the Gnomon's day-shadow on the world, 06:00-18:00, from the world's `gnomon` landmark, L = N × (1 + \|h − 12\| / 3) spans (at most 40), N = `state.noonLength` or 15.5 |
| `underHand(game, wx, wy, m) → bool` | a span within 0.5 spans of the Hand (its daylight dims to dusk; the torch stays free) |
| `gnomonOf(game)`, `HAND` | the world's Gnomon landmark (none in the test world: no Hand, no needle); the Hand's constants |
| `skyColors(game, zone) → { zenith, horizon }` | night, dawn, noon (the parent's: 50,95,190 / 170,200,240) and dusk keyed at sunrise and sunset and blended; the Shade's ashen |
| `fogFor(game, zone) → { color, density }` | outdoors the horizon colour, `HAZE` (0.022) + the region's and terrain's `fog` (+0.02 on the Shade); without sky `UNDERGROUND_FOG` (the parent's 4,5,9 / 0.05) |
| `lightBucket(game) → n` | a new bucket every `BUCKET_MINUTES` (15) while there is daylight or sun (1..96); 0 all night |
| `bucketSun(bucket)` | the sun a bucket is baked for (its middle) |
| `daylightAt(m)`, `sunAt(m)`, `skyColorsAt(m, shade)`, `lightBucketAt(m)` | the same for any world minute `m` (`daylightAt` is the hour's alone, not dimmed) |
| `spanOf(game, zone) → { tile, terrain, region } \| null` | the world span a zone lies on |

### `light.js`: the light seam, now with the clock

- `daylight(game)` is `clock.daylight`; `setDaylight(fn | value)` still swaps another in (tests) and returns an undo.
- `lightAt`, `naturalLight`, `inDark`, `zoneIsLightless` as in P0, with daylight from the clock: by day in the
  open nothing is dark; at night, in deep shade, on the Shade or under the Hand, with your torch out, it is.
  Underground `inDark` is still exactly the torch test.
- The auto-map's lit mask (`zone.litMask`, read by `castRay` for `seen`) is sky × daylight + lamps in a zone with
  sky (32 daylight steps; rebuilt when daylight moves on, and on `zone:enter` for the zone you come into).
- `sampleLight` clamps samples beyond an outdoor zone's border to the border cell (the edge clamp);
  `sampleGrid(grid, blocks, w, d, h, clamp, x, y, z, airOnly)` is the same from arrays.
- The baked sun: `zone.sunlit` (2 sun, 1 shade, 0 not baked, per voxel beside a face), `bakeSun(zone, bucket,
  { budgetMs })`, `sunCurrent(zone, bucket)`, `sunState(zone) → { bucket, sun, baking }`, `sunlitAt(zone, hx, hy, hz,
  nx, ny, nz, px, py, pz)` and `sunlitGrid(...)` (a soft 2 × 2 lookup on the face), `syncLight(game, zone)` (the mask
  and the bake up to the clock: a new bucket, or a new apron, a `BAKE_MS` slice per frame while the old bake stays
  drawn; a zone with no bake at once), and an update "light" (every mode) that syncs the zone you are in and bakes one
  neighbour in memory ahead. Per-zone state is kept by the zone's `skyLight` array, so a save never sees it and a
  dormant zone (`dropDerived`) frees it.

### `raycast.js`

- `castRay(zone, ox, oy, oz, dx, dy, dz, maxT, seen, torchRange, holes, info = rayInfo(zone))`: as in P0. Outdoors a
  ray that has climbed above the highest block of the zone and its apron hits nothing more: without `seen` it stops,
  with it it goes on marking the columns it passes over, as before. After a miss, `hit.out` says how it left
  (`OUT.FAR`, `OUT.SIDE` (sideways, or down beyond the grid), `OUT.BOTTOM` (down inside the grid: a pit),
  `OUT.TOP`), `hit.missT` how far it had gone, and for a side exit `hit.mx, hit.my` the voxel it left from.
- `rayInfo(zone)`: the zone's sizes, arrays, apron bands (a 3 × 3 grid, one shape) and reach, cached by the zone's
  `skyLight` and rebuilt when the zone is refreshed or a band replaced. A caller casting many rays passes it in.

### `render3d.js`

- `render3d(game)` as before; outdoors the look of TECH_DESIGN §6 (below).
- `setDynamicResolution(on)`, `dynamicResolution() → { on, half }`, `judgeFrame(ms, now)`: §6.7's half-column
  rendering outdoors (on by default in a page, off in Node; never underground).
- `horizonOf(game, zone) → { n, e, s, w: { z, color } }`: the horizon plane per side.
- `GNOMON`, `gnomonDrawn() → bool`: the Gnomon on the horizon (bible §4.12) and whether the last 3D frame showed it
  (for WS1's "the Gnomon in sight").
- `liquidTintAt(game, zone, x, y) → [r, g, b] | null`: the colour of the water at (x, y) when it holds another liquid,
  beyond the edge the neighbour's (when that zone is in memory).
- `CLOCK_SEGMENT`: the HUD's clock segment (§4.5), for the integrator to register (request 3).
- `cam` (unchanged).

### `renderMap.js`

- Outdoors a floor shows its ground (`zone.look`) by its block's `map` look, else a `.` in the block's colour; what
  the map shows as floor without your knowing better (a pit not looked into, ghost planks, a bridge whose crossing
  you haven't seen) takes the ground beside it. Water holding another liquid takes its colour, in any zone. The
  outdoor legend is a terrain legend (the looks seen, the features seen, then what matters outdoors; it says glim)
  narrow enough to sit beside an 80-wide zone at 180 columns.
- `toggleMapLegend(game) → bool` (hide, or show even where it doesn't fit: the view then narrows and follows you),
  `mapLegendShown(game)`, `setLegendKeyHint(text)` (the bound key's label at the foot of the outdoor legend),
  `liquidColor(zone, x, y)`.

### `music.js`, `content/moods.js`, `sfx.js`

- `surfaceMood(game, zone) → mood id`, `moodNames()`. New moods: open, wood, waste, shore, shade, lattice, night.
- `content/moods.js` `MOODS = { surface, night, allNight: [ids], landmarks: { id: mood }, terrains: { id: mood } }`;
  a region's `music` (the world's region data) names a mood and wins over the terrain's. At night the night mood
  plays unless the place's mood is in `allNight`.
- `speakLetter(ch, voice)`: `voice` is a voice object `{ pitch, wave, thin?, ghost?, stone? }` (WS6b's `voiceFor`
  makes them), or a parent's person's id (`VOICES`); anything else speaks in `NEUTRAL_VOICE`. `voiceOf(voice)` gives
  the object played.

### Outdoor rendering (what a zone with sky looks like)

Sky light × daylight with a moonlit floor at night; the sun's colour and strength by its height (warm and weak
low); shadows from the bake; the sky's gradient from `skyColors`, the sun's disc and glow, clouds tinted by the
hour, stars at night (by the hour's daylight, not the Shade's or the Hand's dimness); haze from `fogFor`; rays out to
48 tiles; the apron lit as open ground (sky × daylight and the sun, no lamps, no shadows); beyond it the horizon plane
(a missed ray going down meets the plane at the height of the apron's far row on the side it left by, in that side's
ground colour, a noise texture for the characters, hazed), so nothing below the horizon is black; a level ray takes
the horizon's colour; the Gnomon on the horizon at its true bearing, glinting at noon, a violet light at night from
the Shade and the Rust Steps' mesa tops; water holding another liquid tinted. Underground the values and results are
the parent game's (the code paths differ: the light arrays are read through per-frame copies, the pixel loop is a
function of its own): golden (b) and the screen frames are unchanged.

## Integration requests

1. **Applied on `ws/ws3` (`b267794`), for the integrator to confirm at merge: `tests/checks/clock.js` §5** (a P0
   file). Its section 5 asserted the clock's looks were noon stubs "until WS3" (daylight 1 at midnight, one light
   bucket, no fog), so it failed once the looks were built. With the approval of the session that started WS3,
   only §5 and its line-18 header changed: §5 is now a seam check (the same game time gives the same looks whatever
   was asked between; daylight in 0..1; the sun a unit vector; a light bucket a whole number in 0..96; fog never
   negative; at noon daylight 1, the sun high and the parent's noon sky). The looks' values are checked in
   `tests/checks/render.js` §1.
2. **Applied on `ws/ws3` (`87a902c`), for the integrator to confirm at merge: `tests/checks/screen-frames.js`** (a
   P0 file). Its "victory card" frame (`startRun(7)`, mode `won`) is drawn over the temple span's surface map, which
   WS3's outdoor ground looks and legend change, so its hash can't match `p0-0c`'s, and the fixture is never
   re-recorded. With the same approval: `tests/fixtures/screen-frames.json` is untouched, the frame is still drawn,
   and exactly that name is in a named list `NOT_COMPARED` with its reason; the other 46 frames are compared and
   match. The make-up is `tests/checks/render.js` §10: the same state drawn with and without the card, every line
   of the card centred in its box, the box's size and borders, its title's colour, and every cell outside the box
   what the map draws without the card (the outdoor map).
3. **The HUD's clock segment** (§4.5 "clock (WS3, 30)"; `hud.js` is WS9's, `tests/checks/hud.js` P0's): register it,
   `hud.registerHudSegment("clock", render3d.CLOCK_SEGMENT)` (under the sky only, so underground frames don't
   change), and let `check-hud`'s 180-column "the parent's order" assertion (tests/checks/hud.js:91) allow the clock
   segment on the start span, which is outdoors. WS3 didn't register it: that assertion is a P0 file's.
4. **A key for the map legend** (`screens/play.js` map bindings or `keys.js`): bind one to
   `renderMap.toggleMapLegend(game)` and call `setLegendKeyHint("<label>")` once. At 160 columns (a 1280-wide window)
   the outdoor legend doesn't fit beside an 80-wide zone and is hidden unless toggled; at 180 it shows by itself.
5. **Map looks for terrain blocks** (WS2, blocks.js): GRASS (id 7, not a reserved id: the integrator's) and the
   reserved TRUNK, SHALE, LEAVES, REED have no `map` look; outdoors they show as a `.` (floors) or `#` (walls) in
   the block's colour. §6.5's grass `"` would need GRASS's `map`; it is safe underground (renderMap reads `map` only
   outdoors).
6. **The edge-swap frame's step** (zones.js / WS2's `gen/surface.js buildApronBand`): on the swap, `fillApron`
   builds the new zone's far bands, whose neighbours aren't in memory, from the world functions in that frame
   (`buildApronBand` and `columnAt`: about half of a 10 ms step on a cold first swap in Node). Building them during
   prefetch, or a band a frame, would leave the swap frame one draw. WS3's part (the draw) is in
   `docs/sessions/ws3.md`.
7. **The held weapon at night** (`hud.js:326-328`, WS9's): it is lit by the raw sky light, without daylight, so the
   sword shines at night outdoors; reading `light.lightAt(game, zone, …).sky` (sky × daylight) instead would match the
   scene.
8. **`tools/README.md`** (frozen): `check-perf` now runs the render check first (`--no-render` skips it), compares
   with `p0-done` by default, and has `frame.dusk`, `frame.night`, `bake` and the swap frames in its report.
   `tests/checks/index.js`'s perf line still names p0-0d1 as the reference.
9. **"gold" in the underground map legend**: golden (b)'s frames show the parent's legend, so the word stays
   underground until golden (b) is retired; the outdoor legend says glim. Change `renderMap.js`'s `$` row then.
10. **For C1, WS6b and WS7**: a region or terrain may carry `fog` (a number added to the haze density) and a region
    `music` (a mood of `music.moodNames()`); a liquid in `content/liquids.js` is drawn in its `color`; the Lengthening
    sets `state.noonLength` (the Hand's N, bible §4.8; 15.5 until it does). WS1 may use `clock.handAt` / `underHand`
    for the Hand's stripe and caravans, and `render3d.gnomonDrawn()` for "the Gnomon in sight".

## Handoff

(Written at the end of the workstream.)
