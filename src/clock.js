// The clock: time of day as a view of state.time (TECH_DESIGN §1.4, R10; DECISIONS §1; bible §4.6).
//
// state.time is the one persistent clock, seconds of game time; game.time is the same number (game.js
// attachState makes state.time read and write it, so hot code keeps a plain field). Everything here is
// derived from it through RULES.clock: one world hour is 60 s of game time in both views, and the run
// starts on day 1 at 06:00.
//
//   minutes(game) → n                 world minutes since day 1, 00:00 (state.time / secondsPerMinute + startMinute)
//   minutesAt(t) → n                  the same for any game time t
//   dayNumber(game) → 1, 2…           hourOf(game) → 0..23     minuteOfDay(game) → 0..1439
//   timeOfDay(game) → 0..1            0 at midnight, 0.5 at 12:00
//   phaseAt(minuteOfDay) · phase(game) → "dawn" | "day" | "dusk" | "night"   (05-06, 06-18, 18-19, 19-05)
//   isNight(game) · inNoonWindow(game) (11:00-13:00)
//   nightSeconds(t0, t1) → s          how much of [t0, t1] (game seconds) is night: exact, piecewise, so
//                                     splitting the interval anywhere adds up to the same (the torch's drain)
//   secondsUntil(game, what) → s      to the next "hour" | "dawn" | "noon" | "dusk" | "midnight" (> 0); for Z
//   clockLabel(game) → "day 1, 06:00"
//   catchUp(game, t0)                 the time since the clock was last caught up (or since t0, the first
//                                     time) has passed: every hour boundary in it emits "clock:hour"
//                                     { minutes, day, hour }, and 05:00 / 11:00 / 18:00 / 00:00 also
//                                     "clock:dawn" / "clock:noon" / "clock:dusk" / "clock:midnight" (same
//                                     payload), each exactly once, in order; then "clock:tick" { t0, t1 }
//                                     (the torch's drain listens). Called every frame (a registered update
//                                     in every mode), on zone:leave (so the time is the zone's you left) and
//                                     by skipTime (time.js): a skip fires what playing the time out would.
//                                     game.clockSeen is how far it has got (runtime; game.js attachState
//                                     sets it for a new run or a load, so nothing fires twice).
//
// The looks (WS3, TECH_DESIGN §6.2-§6.4), pure functions of the time of day:
//   daylight(game) → 0..1             1 by day (06-18), 0 at night (19-05), smooth through dusk and dawn; at
//                                     most SHADE_LIGHT on a span of the Shade (a `dark` terrain) or under the Hand
//   handAt(game, m), underHand(game, wx, wy, m)   the Hand, the Gnomon's day-shadow on the world (below)
//   sunDir(game) → [x, y, z]          unit vector toward the sun: up in the south-east at 06:00, over the Gnomon
//                                     in the north-east at noon, down in the north at 18:00 (z < 0 at night)
//   skyColors(game, zone) → { zenith, horizon }   night, dawn, noon and dusk colours blended by the hour
//   fogFor(game, zone) → { color, density } the haze outdoors (horizon colour, HAZE + region/terrain fog);
//                                     the parent's dark fog where there is no sky
//   lightBucket(game) → n             changes every BUCKET_MINUTES while there is daylight or sun; 0 all night
//   bucketSun(bucket) → [x, y, z]     the sun a bucket's bake uses
//   daylightAt(m), sunAt(m), skyColorsAt(m, shade), lightBucketAt(m)   the same for any world minute
//   spanOf(game, zone) → { tile, terrain, region } | null   the world span a zone lies on
import { RULES } from "./rules.js";
import { emit, on, listening, registerUpdate } from "./events.js";

const DAY = 24 * 60;
const C = () => RULES.clock;

export const minutesAt = (t) => t / C().secondsPerMinute + C().startMinute;
export const minutes = (game) => minutesAt(game.time || 0);
export const dayNumber = (game) => Math.floor(minutes(game) / DAY) + 1;
export const minuteOfDay = (game) => ((Math.floor(minutes(game)) % DAY) + DAY) % DAY;
export const hourOf = (game) => Math.floor(minuteOfDay(game) / 60);
export const timeOfDay = (game) => (((minutes(game) % DAY) + DAY) % DAY) / DAY;

export function phaseAt(m) {
  const h = (((m % DAY) + DAY) % DAY) / 60, c = C();
  if (h >= c.night || h < c.dawn) return "night";
  if (h < c.day) return "dawn";
  if (h < c.dusk) return "day";
  return "dusk";
}
export const phase = (game) => phaseAt(minutes(game));
export const isNight = (game) => phase(game) === "night";
export function inNoonWindow(game) {
  const h = minuteOfDay(game) / 60, [a, b] = C().noon;
  return h >= a && h < b;
}

// Night minutes from day 1, 00:00 to minute m (night is [night, 24) and [0, dawn) of every day).
function nightBefore(m) {
  const c = C(), days = Math.floor(m / DAY), x = m - days * DAY;
  const perDay = (24 - c.night + c.dawn) * 60;
  return days * perDay + Math.min(x, c.dawn * 60) + Math.max(0, x - c.night * 60);
}
export function nightSeconds(t0, t1) {
  if (!(t1 > t0)) return 0;
  return (nightBefore(minutesAt(t1)) - nightBefore(minutesAt(t0))) * C().secondsPerMinute;
}

const AT = () => ({ dawn: C().dawn * 60, noon: C().noon[0] * 60, dusk: C().dusk * 60, midnight: 0 });
export function secondsUntil(game, what) {
  const m = minutes(game), spm = C().secondsPerMinute;
  if (what === "hour") return (Math.floor(m / 60 + 1e-9) * 60 + 60 - m) * spm;
  const at = AT()[what];
  if (at === undefined) throw new Error(`secondsUntil: no "${what}" (hour, dawn, noon, dusk, midnight)`);
  const day = Math.floor(m / DAY);
  let next = day * DAY + at;
  if (next <= m + 1e-9) next += DAY;
  return (next - m) * spm;
}

const two = (n) => String(n).padStart(2, "0");
export const clockLabel = (game) => `day ${dayNumber(game)}, ${two(hourOf(game))}:${two(minuteOfDay(game) % 60)}`;

// --- Events --------------------------------------------------------------------------------------
const NAMED = () => ({ [C().dawn]: "clock:dawn", [C().noon[0]]: "clock:noon", [C().dusk]: "clock:dusk", 0: "clock:midnight" });

export function catchUp(game, t0 = game.time) {
  const t1 = game.time || 0;
  let from = game.clockSeen ?? t0;
  if (!(from <= t1)) from = t1;   // time went back (a new run, a load): nothing to fire
  game.clockSeen = t1;
  if (!(t1 > from)) return;
  const k0 = Math.floor(minutesAt(from) / 60 + 1e-9), k1 = Math.floor(minutesAt(t1) / 60 + 1e-9);
  const named = NAMED();
  const heard = ["clock:hour", ...Object.values(named)].some(listening);
  for (let k = k0 + 1; heard && k <= k1; k++) {
    const m = k * 60, hour = ((k % 24) + 24) % 24, payload = { minutes: m, day: Math.floor(m / DAY) + 1, hour };
    emit(game, "clock:hour", payload);
    if (named[hour]) emit(game, named[hour], payload);
  }
  emit(game, "clock:tick", { t0: from, t1 });
}

registerUpdate("clock", (game) => { if (game.state) catchUp(game); }, { modes: ["*"] });
on("zone:leave", (game) => { if (game.state) catchUp(game); }, { priority: 100 });

// --- The looks (TECH_DESIGN §6.2-§6.4; WS3) --------------------------------------------------------
// Everything below is a pure function of the time of day (and, for the Shade and the Hand, of the span you
// are on), so a load, a skip or a fresh run all look the same at the same hour.
//
// The Dial's sun (bible §1.3, §4.8, §15.6): it climbs out of the south-east at 06:00, stands over the Gnomon in
// the north-east at noon and sets in the north at 18:00; at night it is below the horizon. Its bearing is the
// Hand's opposite: the Gnomon's shadow points θ(h) = 25° + 11° × (h − 12) from due west toward south, so the sun
// stands θ(h) from due east toward north (+x east, +y south). Its height is SUN_NOON_HEIGHT × sin(π (h − 6) / 12):
// 0 at 06:00 and 18:00, 63° at noon.
export const SUN_NOON_HEIGHT = 63 * Math.PI / 180;
export const handAngle = (h) => (25 + 11 * (h - 12)) * Math.PI / 180;   // the Hand's angle at hour h (radians)
const hourAt = (m) => (((m % DAY) + DAY) % DAY) / 60;    // 0..24, fractional
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export function sunAt(m) {
  const h = hourAt(m), c = C(), th = handAngle(h);
  const e = SUN_NOON_HEIGHT * Math.sin(Math.PI * (h - c.day) / (c.dusk - c.day)), ce = Math.cos(e);
  return [ce * Math.cos(th), -ce * Math.sin(th), Math.sin(e)];
}
// Daylight from the time of day: 1 by day (06-18), 0 at night (19-05), a smooth ramp through dusk and
// dawn. light.js multiplies sky light by it (the auto-map's lit test, inDark, perception, the 3D sky term).
export function daylightAt(m) {
  const h = hourAt(m), c = C();
  if (h >= c.day && h < c.dusk) return 1;
  if (h >= c.dusk && h < c.night) return 1 - smooth((h - c.dusk) / (c.night - c.dusk));
  if (h >= c.dawn && h < c.day) return smooth((h - c.dawn) / (c.day - c.dawn));
  return 0;
}

// The span a zone lies on, and its terrain and region (null underground's levels don't matter: they have
// no sky). The Shade (a `dark` terrain) is dusk even at noon (bible §4.3): its daylight is SHADE_LIGHT at
// most, below RULES.dark.threshold, so with your torch out it counts as dark there by day (as torch.js
// burns glim there by day).
export const SHADE_LIGHT = 0.2;
export function spanOf(game, zone = game?.zone) {
  const world = game?.run?.world;
  if (!zone || !world?.tileAt || zone.wx === undefined || zone.wx === null) return null;
  const tile = world.tileAt(zone.wx, zone.wy);
  return tile ? { tile, terrain: world.terrains?.[tile.terrain] || null, region: world.regions?.[tile.region] || null } : null;
}
const isShade = (game, zone) => !!spanOf(game, zone)?.terrain?.dark;

// The Hand (bible §4.8, §15.6): the Gnomon's day-shadow on the world, 06:00-18:00 only, a ray from the Gnomon's
// span at handAngle from due west toward south, L = N × (1 + |h − 12| / 3) spans long (at most HAND.maxLength). A
// span is under it when its position lies within HAND.width spans of the ray; there the zone's daylight dims to
// dusk (SHADE_LIGHT: dark-only things show by day with your torch out; the torch stays free, it is still day).
// N, the noon length, is state.noonLength (the Lengthening's beats set it), HAND.noonLength at the start. The
// Gnomon is the world's landmark HAND.landmark; a world without one (the test world) has no Hand.
//   handAt(game, m) → { x, y, dx, dy, length } | null      the ray in span coordinates, or null (night, no Gnomon)
//   underHand(game, wx, wy, m) → bool
export const HAND = { landmark: "gnomon", noonLength: 15.5, maxLength: 40, width: 0.5 };
export function gnomonOf(game) { return game?.run?.world?.landmarks?.get?.(HAND.landmark) || null; }
export function handAt(game, m = minutes(game)) {
  const h = hourAt(m), c = C(), g = gnomonOf(game);
  if (!g || h < c.day || h > c.dusk) return null;
  const th = handAngle(h), n = Number(game.state?.noonLength) || HAND.noonLength;
  return { x: g.wx, y: g.wy, dx: -Math.cos(th), dy: Math.sin(th), length: Math.min(HAND.maxLength, n * (1 + Math.abs(h - 12) / 3)) };
}
export function underHand(game, wx, wy, m = minutes(game)) {
  const r = handAt(game, m);
  if (!r) return false;
  const px = wx - r.x, py = wy - r.y, t = Math.max(0, Math.min(r.length, px * r.dx + py * r.dy));
  return Math.hypot(px - r.dx * t, py - r.dy * t) <= HAND.width;
}
// Dimmed: the Shade's span, or one the Hand lies over.
const dimmed = (game, zone) => isShade(game, zone) || (!!zone && zone.wx !== undefined && zone.wx !== null && underHand(game, zone.wx, zone.wy));

export const daylight = (game) => { const d = daylightAt(minutes(game)); return dimmed(game, game?.zone) ? Math.min(d, SHADE_LIGHT) : d; };
export const sunDir = (game) => sunAt(minutes(game));

// The sky: a zenith and a horizon colour (render3d blends them by the ray's height, and the haze takes the
// horizon's). Key colours at hours of the day, blended linearly between neighbours; night elsewhere. The Shade's
// sky is ashen; under the Hand the sky stays the hour's (it is the ground that lies in shadow).
const NIGHT = { zenith: [4, 6, 16], horizon: [16, 20, 38] };
const DAWN = { zenith: [56, 66, 128], horizon: [232, 154, 112] };
const NOON = { zenith: [50, 95, 190], horizon: [170, 200, 240] };   // render3d's sky before the clock
const DUSK = { zenith: [46, 44, 108], horizon: [236, 124, 74] };
const SKY_KEYS = () => {
  const c = C();
  return [[c.dawn - 0.2, NIGHT], [c.day - 0.25, DAWN], [c.day + 0.75, NOON], [c.dusk - 0.75, NOON], [c.dusk + 0.25, DUSK], [c.night + 0.2, NIGHT]];
};
const SHADE_SKY = { zenith: [24, 22, 34], horizon: [72, 62, 92] };
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
export function skyColorsAt(m, shade = false) {
  const h = hourAt(m), keys = SKY_KEYS();
  let out = NIGHT;
  for (let k = 0; k + 1 < keys.length; k++) {
    const [h0, a] = keys[k], [h1, b] = keys[k + 1];
    if (h >= h0 && h < h1) { const t = (h - h0) / (h1 - h0); out = { zenith: mix(a.zenith, b.zenith, t), horizon: mix(a.horizon, b.horizon, t) }; break; }
  }
  out = { zenith: out.zenith.map(Math.round), horizon: out.horizon.map(Math.round) };
  if (!shade) return out;
  return { zenith: mix(out.zenith, SHADE_SKY.zenith, 0.75).map(Math.round), horizon: mix(out.horizon, SHADE_SKY.horizon, 0.75).map(Math.round) };
}
export const skyColors = (game, zone = game?.zone) => skyColorsAt(minutes(game), isShade(game, zone));

// Haze (§6.2): outdoors the sky's horizon colour, density HAZE (a terrain or region `fog` adds to it: a
// marsh, the Shade's ash); a zone without sky keeps the parent game's dark fog, which swallows distant things.
export const UNDERGROUND_FOG = { color: [4, 5, 9], density: 0.05 };
export const HAZE = 0.022, SHADE_HAZE = 0.02;
export function fogFor(game, zone = game?.zone) {
  if (!zone?.hasSky) return { color: [...UNDERGROUND_FOG.color], density: UNDERGROUND_FOG.density };
  const span = spanOf(game, zone), extra = (Number(span?.region?.fog) || 0) + (Number(span?.terrain?.fog) || 0);
  return { color: skyColors(game, zone).horizon, density: HAZE + extra + (span?.terrain?.dark ? SHADE_HAZE : 0) };
}

// Light buckets: the baked sun (zone.sunlit) and the auto-map's lit mask are rebuilt only when this number
// changes. Every BUCKET_MINUTES of the day while there is any daylight or the sun is up (so a bake follows
// the sun and the mask follows dusk and dawn), and one bucket (0) for the whole night.
export const BUCKET_MINUTES = 15;
export function lightBucketAt(m) {
  const md = (((Math.floor(m) % DAY) + DAY) % DAY);
  if (!(daylightAt(m) > 0) && !(sunAt(m)[2] > 0)) return 0;
  return 1 + Math.floor(md / BUCKET_MINUTES);
}
export const lightBucket = (game) => lightBucketAt(minutes(game));
// The sun a bucket is baked for (its middle), so the shadows and the lit faces agree for the whole bucket.
export function bucketSun(bucket) {
  if (!bucket) return sunAt(0);
  return sunAt((bucket - 1) * BUCKET_MINUTES + BUCKET_MINUTES / 2);
}
