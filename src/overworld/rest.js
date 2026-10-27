// Rest and waiting (Z; TECH_DESIGN §5.2 "Rest"; DECISIONS §1 "Clock"; bible §4.6, §15.6; WS1). In a zone, in
// either view, or on the world map.
//
//   rest(game, { until = "healed", keepLit = false }) → { elapsed, interrupted, why, encounter }
//        until: "healed" (at most RULES.overworld.restMax world hours), "dawn" | "noon" | "dusk" | "midnight"
//        (clock.js secondsUntil), or a number of seconds of game time (N hours: N × 60 s).
//        The time passes through skipTime({ interruptible: true, reason: "rest" }) one world hour at a time
//        (R10: statuses, cooldowns and regeneration catch up exactly), and after each whole hour an encounter
//        roll at half the travel rate of the span (encounters.js): a band or a legend is placed by a zone patch
//        8-12 tiles from you (on the world map you are taken down into the span's zone first) and the rest
//        ends (why "encounter"); travellers don't call on a sleeper. A hostile awake within
//        RULES.time.activeRadius tiles stops it before it starts (why "hostile"; not on the world map, where you
//        are in no zone). Your torch is snuffed while you wait unless keepLit, so waiting costs no glim.
//        why: null (the time ran out), "until" (healed, or the hour came), "hostile", "encounter", "dead".
//   waitChoices(game) → [{ id, label, until }]   what the Z menu offers
import { skipTime } from "../time.js";
import { secondsUntil } from "../clock.js";
import { inStack } from "../screens.js";
import { maxHp } from "../stats.js";
import { OW, hourSeconds } from "./state.js";
import { rollEncounter, placeEncounter } from "./encounters.js";
import { dropInto } from "./travel.js";

const NAMED = ["dawn", "noon", "dusk", "midnight"];
const healed = (game) => game.player.hp >= maxHp(game.player);

export function waitChoices(game) {
  return [
    { id: "healed", label: "until healed", until: "healed" },
    ...NAMED.map((n) => ({ id: n, label: `until ${n === "noon" ? "noon (11:00)" : n}`, until: n })),
    ...[1, 2, 4, 8].map((h) => ({ id: `h${h}`, label: `${h} hour${h > 1 ? "s" : ""}`, until: h * hourSeconds() })),
  ];
}

export function rest(game, { until = "healed", keepLit = false } = {}) {
  const p = game.player, H = hourSeconds();
  const trip = game.trip && !game.trip.viewOnly && inStack(game, "world") ? game.trip : null;   // on the world map
  let total, stop = null;
  if (until === "healed") { total = OW().restMax * H; stop = healed; }
  else if (NAMED.includes(until)) total = secondsUntil(game, until);
  else if (typeof until === "number" && until > 0) total = Math.min(until, OW().waitMax * H);
  else throw new Error(`rest: until "${until}" (healed, dawn, noon, dusk, midnight or seconds)`);
  const out = { elapsed: 0, interrupted: false, why: null, encounter: null };
  if (stop?.(game)) { out.why = "until"; return out; }
  const lit = p.torch;
  if (lit && !keepLit) p.torch = false;
  const where = trip ? { wx: trip.wx, wy: trip.wy } : { wx: game.zone.wx, wy: game.zone.wy };
  try {
    while (out.elapsed < total - 1e-9) {
      const sk = skipTime(game, Math.min(H, total - out.elapsed), { interruptible: !trip, reason: "rest", until: stop || undefined });
      out.elapsed += sk.elapsed;
      if (sk.why) { out.why = sk.why; out.interrupted = sk.interrupted; if (sk.why === "dead") game.trip = null; break; }
      if (sk.elapsed < H - 1e-9) break;   // the last, partial hour
      const enc = rollEncounter(game, where, { rest: true });
      if (!enc) continue;
      out.encounter = enc; out.why = "encounter"; out.interrupted = true;
      if (trip) dropInto(game, enc);
      else placeEncounter(game, game.zone.key, enc);
      break;
    }
  } finally {
    if (lit && !keepLit) p.torch = true;
  }
  if (out.why === "hostile") game.log?.("You can't rest with something hunting you this close.", [255, 150, 120]);
  return out;
}
