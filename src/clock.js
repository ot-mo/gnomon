// The clock: time of day as a view of state.time (TECH_DESIGN §1.4, R10; DECISIONS §1; bible §4.6).
//
// state.time is the one persistent clock, seconds of game time (game.time is the same number: game.js
// keeps it on game.state). Everything here is derived from it through RULES.clock: one world hour is
// 60 s of game time in both views, and the run starts on day 1 at 06:00.
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
//                                     game.clockSeen is how far it has got (runtime; startRun sets it, a
//                                     load may leave it unset: the first call then starts from t0 = now).
//
// The looks are WS3's (TECH_DESIGN §6.3) and stay at noon until then, so no frame changes:
//   daylight(game) → 1 · sunDir(game) → render3d's sun · skyColors(game) → { zenith, horizon } (render3d's
//   noon sky) · fogFor(game, zone) → { color, density: 0 } · lightBucket(game) → 0
import { RULES } from "./rules.js";
import { emit, on, registerUpdate } from "./events.js";

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
  for (let k = k0 + 1; k <= k1; k++) {
    const m = k * 60, hour = ((k % 24) + 24) % 24, payload = { minutes: m, day: Math.floor(m / DAY) + 1, hour };
    emit(game, "clock:hour", payload);
    if (named[hour]) emit(game, named[hour], payload);
  }
  emit(game, "clock:tick", { t0: from, t1 });
}

registerUpdate("clock", (game) => { if (game.state) catchUp(game); }, { modes: ["*"] });
on("zone:leave", (game) => { if (game.state) catchUp(game); }, { priority: 100 });

// --- The looks: noon until WS3 -------------------------------------------------------------------
const SUN = (() => { const v = [-0.3, 0.35, 0.89], l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); return v.map((c) => c / l); })();
export const daylight = () => 1;
export const sunDir = () => [...SUN];
export const skyColors = () => ({ zenith: [50, 95, 190], horizon: [170, 200, 240] });
export const fogFor = () => ({ color: [170, 200, 240], density: 0 });
export const lightBucket = () => 0;
