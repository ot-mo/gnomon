// Time in bulk: rest, waiting and world travel (TECH_DESIGN §1.4, §2.7, R10).
//
//   skipTime(game, seconds, { interruptible = true, reason = "wait", until }) → { elapsed, interrupted, why }
//
// Advances the one clock (game.time; state.time once 0D2's save codec has it) by `seconds` of game time,
// and everything that runs on it catches up exactly, as if the time had been played out:
//   - the player's statuses, cooldowns and regeneration, in chunks of RULES.time.chunk seconds
//     (status.js catchUpStatuses and effects.js regenerate are exact for any dt; the chunk only bounds
//     how their interplay rounds, e.g. poison and regeneration fighting at full health);
//   - the creatures' statuses (fire and poison can kill them), their regeneration and attack cooldowns,
//     in one bulk step at the end: idle creatures stay where they are and don't act;
//   - poison clouds thin out.
// It stops early when you die, when `until(game)` turns true (healed, dawn…), or, if interruptible,
// when a hostile is awake (hunting) within RULES.time.activeRadius tiles: then nothing passes at all.
// A rest (reason "rest") of RULES.cooldown.restClears seconds or more clears the second-wind and
// first-block cooldowns (§2.4). Emits "time:skip" { seconds, reason, interrupted, t0 }; 0D2's clock.js
// listens to it (clock.catchUp) so hour, dawn and dusk events fire once each.
//
// Torch drain (DECISIONS: 1 glim per 4 world hours lit in darkness) is time-based too, but whether it is
// dark needs the clock (surface night), so 0D2 adds it with clock.js, from this event and per frame.
import { RULES } from "./rules.js";
import { catchUpStatuses, statusLeft, clearCooldown, STATUS_DEFS } from "./status.js";
import { regenerate } from "./effects.js";
import { MONSTER_TYPES } from "./monsters.js";
import { emit } from "./events.js";

// Something that would stop a rest: a hostile awake within the radius.
function threat(game) {
  const p = game.player, r = RULES.time.activeRadius;
  for (const m of game.zone?.monsters || [])
    if (m.state === "chase" && Math.hypot(m.x - p.x, m.y - p.y) <= r) return "hostile";
  return null;
}

// How long from now this creature can't regenerate (fire; poison with the attribute formulas).
function noRegenLeft(m) {
  let t = 0;
  for (const id in m.status || {}) {
    const f = STATUS_DEFS[id]?.flags?.noRegen;
    if (f === true || (typeof f === "function" && f(m, m.status[id]))) t = Math.max(t, statusLeft(m, id));
  }
  return t;
}

export function skipTime(game, seconds, { interruptible = true, reason = "wait", until } = {}) {
  const p = game.player, t0 = game.time;
  let elapsed = 0, why = null;
  while (elapsed < seconds - 1e-9) {
    if (game.mode === "dead") { why = "dead"; break; }
    if (until?.(game)) { why = "until"; break; }
    if (interruptible && (why = threat(game))) break;
    const dt = Math.min(RULES.time.chunk, seconds - elapsed);
    game.time += dt;
    elapsed += dt;
    catchUpStatuses(game, p, dt);
    if (game.mode !== "dead") regenerate(game, p, dt);
  }
  if (!why && game.mode === "dead") why = "dead";
  for (const k of ["attackCd", "throwCd", "hurt", "swing"]) if (p[k] > 0) p[k] = Math.max(0, p[k] - elapsed);

  const zone = game.zone;
  if (zone && elapsed > 0) {
    for (const m of [...zone.monsters]) {
      const t = MONSTER_TYPES[m.type], quiet = noRegenLeft(m);
      catchUpStatuses(game, m, elapsed);
      if (!zone.monsters.includes(m)) continue;   // burned or choked to death
      m.cd = Math.max(0, (m.cd || 0) - elapsed);
      m.hurt = 0;
      if (t?.regen && m.hp < m.maxHp) {
        m.regenAcc = (m.regenAcc || 0) + t.regen * Math.max(0, elapsed - quiet);
        const n = Math.min(Math.floor(m.regenAcc), m.maxHp - m.hp);
        m.hp += n;
        m.regenAcc = m.hp >= m.maxHp ? 0 : m.regenAcc - n;
      }
    }
    for (const c of zone.clouds || []) c.time -= elapsed;
    if (zone.clouds) zone.clouds = zone.clouds.filter((c) => c.time > 0);
  }
  if (reason === "rest" && elapsed >= RULES.cooldown.restClears) { clearCooldown(p, "secondWind"); clearCooldown(p, "firstBlock"); }
  const interrupted = why !== null && why !== "until";
  emit(game, "time:skip", { seconds: elapsed, reason, interrupted, t0 });
  return { elapsed, interrupted, why };
}
