// Statuses: one table of timed effects for the player and every creature (TECH_DESIGN §2.7), and the
// entity's cooldowns. It replaces the player's seven timer fields (flyTime, hasteTime, shadowTime,
// poisonTime, paralyzed, darkTime, guardTime) and the creatures' (burn, chill, stun, blind, poison, haste).
//
//   registerStatus(id, def)                   def: see below; content adds more the same way
//   addStatus(game, e, id, { t, mag, src, stack }) → s     start (or stack onto) a status
//   removeStatus(game, e, id)                 end it now (no "it wears off" line)
//   hasStatus(e, id) · statusLeft(e, id) → s · statusOf(e, id) → { t, mag, src, acc } | null
//   capStatus(e, id, t)                       shorten it to at most t seconds (bosses shrug off stuns)
//   statusFlag(e, flag) → bool                noAct noMove flying hidden untouchable noRegen flat
//   statusSpeed(e) → n                        the product of every status's speed factor (drowning ×0.4)
//   tickStatuses(game, e, dt)                 both views, every frame (3D) or every 1/60 s of action time (map)
//   catchUpStatuses(game, e, seconds)         the exact bulk version, for skipTime (time.js)
//   statusLine(game, e) → [{ text, color }]   the HUD's segments
//   cooldownLeft(e, id) · startCooldown(e, id, seconds) · clearCooldown(e, id)
//   setStatusHarm(fn)                         fn(game, e, n, id): how a status hurts (monsters.js plugs it in)
//   dvOf(e)                                   stats.dv with the noAct flag (0 while stunned or paralysed)
//
// StatusDef = { name, color, kind: "good" | "bad", stack: "max" | "add" | "refresh", t (default seconds),
//   hud?(s, game) → string | null,           null hides it this frame (blinking)
//   period?(e, s) → seconds,                  1 damage every `period` seconds while it lasts (poison, fire)
//   tick?(game, e, s, dt),                    custom time-driven work; must be exact for any dt (catch-up uses it)
//   onStart?(game, e, s), onEnd?(game, e, s, why),   why: "expired" | "removed"
//   warn?: [seconds, line], ended?: line,     what the player is told (the player only)
//   ends?: [ids],                             statuses this one ends when it starts (fire ends frost)
//   bonus?(s) → { key: n }, speed?: n, flags?: { flag: true | (e, s) → bool },
//   cause?: string, killed?(e) → line }       what hurt you; what the log says when it kills a creature
// e.status = { [id]: { t /* seconds left, Infinity for toggles */, mag, src, acc } }
// e.cooldowns = { [id]: seconds left }: ticked with the statuses, in the same game seconds (R10).
//
// Time is game time in both views: real seconds in 3D, the seconds an action costs on the map. Every
// effect is a function of elapsed time only, so a bulk catch-up gives what playing the time out gives.
import { RULES } from "./rules.js";
import { invalidateStats, setStatusBonus, dv, bonus } from "./stats.js";
import { B } from "./world.js";
import { hasKey } from "./keyset.js";

export const STATUS_DEFS = {};
const TheOf = (e) => (e?.named ? e.name : `The ${e?.name}`);   // (creatures.js theOf: a legend takes no article)
export function registerStatus(id, def) {
  STATUS_DEFS[id] = { name: id, color: [200, 200, 200], kind: "bad", stack: "refresh", t: 10, ...def };
  return STATUS_DEFS[id];
}

setStatusBonus((id, s) => STATUS_DEFS[id]?.bonus?.(s) || null);

let harm = (game, e, n) => { e.hp -= n; };
export function setStatusHarm(fn) { harm = fn; }

const isPlayer = (game, e) => !!game && e === game.player;
const alive = (game, e) => (isPlayer(game, e) ? game.mode !== "dead" && e.hp > 0 : e.hp > 0);
const log = (game, e, text, color = [170, 170, 170]) => { if (text && isPlayer(game, e)) game.log(text, color); };

export const statusOf = (e, id) => e?.status?.[id] || null;
export const hasStatus = (e, id) => !!statusOf(e, id);
export const statusLeft = (e, id) => statusOf(e, id)?.t || 0;

export function addStatus(game, e, id, { t, mag = 1, src = null, stack } = {}) {
  const def = STATUS_DEFS[id];
  if (!def) throw new Error(`addStatus: no status ${id}`);
  const secs = t ?? def.t;
  if (!(secs > 0)) return statusOf(e, id);
  for (const other of def.ends || []) if (hasStatus(e, other)) removeStatus(game, e, other);
  e.status ||= {};
  let s = e.status[id];
  if (!s) {
    s = e.status[id] = { t: secs, mag, src, acc: 0 };
    if (def.bonus) invalidateStats(e);
    def.onStart?.(game, e, s);
    return s;
  }
  const how = stack ?? def.stack;
  if (how === "add") s.t += secs;
  else if (how === "max") s.t = Math.max(s.t, secs);
  else s.t = secs;   // refresh
  if (mag !== s.mag) { s.mag = Math.max(s.mag, mag); if (def.bonus) invalidateStats(e); }
  if (src) s.src = src;
  return s;
}

function end(game, e, id, why) {
  const s = statusOf(e, id), def = STATUS_DEFS[id];
  if (!s) return;
  delete e.status[id];
  if (def?.bonus) invalidateStats(e);
  if (why === "expired") log(game, e, def?.ended);
  def?.onEnd?.(game, e, s, why);
}
export function removeStatus(game, e, id) { end(game, e, id, "removed"); }

export function capStatus(e, id, t) {
  const s = statusOf(e, id);
  if (!s) return;
  if (t <= 0) { delete e.status[id]; if (STATUS_DEFS[id]?.bonus) invalidateStats(e); return; }
  s.t = Math.min(s.t, t);
}

export function statusFlag(e, flag) {
  if (!e?.status) return false;
  for (const id in e.status) {
    const f = STATUS_DEFS[id]?.flags?.[flag];
    if (f === true || (typeof f === "function" && f(e, e.status[id]))) return true;
  }
  return false;
}
export function statusSpeed(e) {
  let k = 1;
  if (e?.status) for (const id in e.status) k *= STATUS_DEFS[id]?.speed ?? 1;
  return k;
}
export const dvOf = (e) => dv(e, { unable: statusFlag(e, "noAct") });

// --- Time -------------------------------------------------------------------------------------
// One status over dt seconds. Damage lands at exact multiples of its period from the start, counted
// only while it lasts, so stepping 1/60 s at a time and one bulk call agree.
function advance(game, e, id, dt) {
  const s = e.status[id], def = STATUS_DEFS[id];
  if (!def) { delete e.status[id]; return; }
  const run = Math.min(dt, s.t);
  if (def.period) {
    s.acc += run;
    for (let p = def.period(e, s); s.acc >= p - 1e-9 && alive(game, e);) { s.acc -= p; harm(game, e, 1, id); }
  }
  if (def.tick && alive(game, e)) def.tick(game, e, s, run);
  if (e.status?.[id] !== s) return;   // the tick ended it (or killed its bearer)
  if (def.warn && s.t > def.warn[0] && s.t - dt <= def.warn[0]) log(game, e, def.warn[1], [255, 200, 120]);
  s.t -= dt;
  if (s.t <= 1e-9) end(game, e, id, "expired");
}

export function tickCooldowns(e, dt) {
  const cd = e.cooldowns;
  if (!cd) return;
  for (const k in cd) if ((cd[k] -= dt) <= 1e-9) delete cd[k];
}
export const cooldownLeft = (e, id) => e?.cooldowns?.[id] || 0;
export function startCooldown(e, id, seconds) { (e.cooldowns ||= {})[id] = seconds; }
export function clearCooldown(e, id) { if (e?.cooldowns) delete e.cooldowns[id]; }

// The bearer died partway through the list: the statuses after the killing one still run to the moment
// of death (the end of this step, where ticks land), quietly, so a bulk step and small steps agree.
function runOutQuietly(e, id, dt) {
  const s = e.status[id];
  s.t -= dt;
  if (s.t <= 1e-9) { delete e.status[id]; if (STATUS_DEFS[id]?.bonus) invalidateStats(e); }
}

export function tickStatuses(game, e, dt) {
  let dead = false;
  if (e.status) for (const id of Object.keys(e.status)) {
    if (!e.status[id]) continue;
    if (dead) { runOutQuietly(e, id, dt); continue; }
    advance(game, e, id, dt);
    dead = !alive(game, e);
  }
  tickCooldowns(e, dt);
}
// The exact bulk version (skipTime): every status here is a function of elapsed time alone, so this is
// the same code run once over `seconds`; a def may supply its own catchUp(game, e, s, seconds).
export function catchUpStatuses(game, e, seconds) {
  let dead = false;
  if (e.status) for (const id of Object.keys(e.status)) {
    const s = e.status[id], def = STATUS_DEFS[id];
    if (!s) continue;
    if (dead) { runOutQuietly(e, id, seconds); continue; }
    if (def?.catchUp) def.catchUp(game, e, s, seconds);
    else advance(game, e, id, seconds);
    dead = !alive(game, e);
  }
  tickCooldowns(e, seconds);
}

export function statusLine(game, e) {
  const out = [];
  if (e.status) for (const id in STATUS_DEFS) {   // in the order registered, whatever came first
    if (!e.status[id]) continue;
    const def = STATUS_DEFS[id], text = def.hud?.(e.status[id], game, e);
    if (text) out.push({ text, color: def.color });
  }
  return out;
}

// --- The core statuses --------------------------------------------------------------------------
const secs = (s) => Math.ceil(s.t);
const legacyRegen = (e, s) => RULES.stats !== "legacy";   // the parent game let you regenerate while poisoned
const blink = (s, game) => s.t > 5 || Math.floor((game?.time || 0) * 4) % 2 === 0;

registerStatus("flying", { color: [160, 220, 255], kind: "good", t: 20, flags: { flying: true },
  hud: (s, game) => (blink(s, game) ? `FLYING ${secs(s)}s` : null),
  warn: [5, "Your flight is wearing off!"], ended: "You're no longer flying." });
registerStatus("hasted", { color: [255, 240, 120], kind: "good", t: 15,
  hud: (s) => `HASTE ${secs(s)}s`, ended: "You slow back down." });
registerStatus("shadowed", { color: [150, 140, 190], kind: "good", t: 30, flags: { hidden: true },
  hud: (s) => `SHADOWS ${secs(s)}s`, ended: "The shadows fall away from you." });
// Poison: 1 damage every 1/mag seconds (the player's potion 1 s, a gas cloud on a creature 0.5 s);
// Thick blood halves it.
registerStatus("poisoned", { color: [150, 210, 80], t: 6, stack: "max", flags: { noRegen: legacyRegen },
  period: (e, s) => (1 / s.mag) * (hasKey(e.perks, "thickBlood") ? 2 : 1), cause: "poison",
  hud: () => "POISONED", ended: "The sickness passes.", killed: (e) => `${TheOf(e)} chokes on the poison.` });
registerStatus("paralyzed", { color: [200, 120, 255], t: 5, stack: "max", flags: { noAct: true, noMove: true },
  hud: (s) => `PARALYZED ${secs(s)}s`, ended: "You can move again." });
registerStatus("stunned", { color: [200, 120, 255], t: 2, stack: "max", flags: { noAct: true, noMove: true },
  hud: (s) => `STUNNED ${secs(s)}s`, ended: "Your head clears." });
registerStatus("darkened", { color: [130, 120, 160], t: 40,
  hud: (s) => `DARKNESS ${secs(s)}s`, ended: "Your torch flares back to life." });
registerStatus("guarded", { color: [200, 230, 255], kind: "good", t: 1, flags: { untouchable: true },
  hud: () => "UNTOUCHABLE" });
// Fire: 1 damage every 0.5/mag seconds; stops regeneration; frost puts it out (and fire ends frost).
registerStatus("burning", { color: [255, 140, 60], t: 3, ends: ["chilled"], flags: { noRegen: true },
  period: (e, s) => 0.5 / s.mag, cause: "fire",
  hud: () => "BURNING", ended: "The burning stops.", killed: (e) => `${TheOf(e)} burns to ashes.` });
registerStatus("chilled", { color: [140, 190, 255], t: 3, ends: ["burning"], hud: (s) => `CHILLED ${secs(s)}s` });
registerStatus("blinded", { color: [120, 120, 140], t: 10, hud: (s) => `BLIND ${secs(s)}s`, ended: "You can see again." });

// Drowning (new in 0B): a body that can't swim, floating in surface deep water. RULES.drown.air seconds
// of breath (× 1 + bonus "breath", stats.js: the bellows lung's 1 is twice as long), then 1 damage a second;
// you move at RULES.drown.speed. A toggle: it ends when your feet leave deep water (updateDrowning), the same
// rule in both views.
export const airOf = (e) => RULES.drown.air * Math.max(0.1, 1 + bonus(e, "breath"));
registerStatus("drowning", { color: [90, 150, 230], t: Infinity, cause: "drowning",
  speed: RULES.drown.speed,
  tick(game, e, s, dt) {
    const air = airOf(e), per = 1 / RULES.drown.dps, before = s.acc;
    s.acc += dt;
    const n = Math.floor(Math.max(0, s.acc - air) / per + 1e-9) - Math.floor(Math.max(0, before - air) / per + 1e-9);
    for (let k = 0; k < n && alive(game, e); k++) harm(game, e, 1, "drowning");
  },
  hud: (s, game, e) => { const air = e ? airOf(e) : RULES.drown.air; return s.acc < air ? `AIR ${Math.ceil(air - s.acc)}s` : "DROWNING"; },
  onStart: (game, e) => log(game, e, "The water closes over your head. You can't swim: get out before your breath runs out!", [110, 170, 240]),
  onEnd: (game, e, s) => { if (s.acc >= airOf(e)) log(game, e, "You drag yourself out of the water, coughing.", [110, 170, 240]); },
  killed: (e) => `${TheOf(e)} drowns.` });

// Flat (bible §10.2, §15.6; DECISIONS): you exist only in the Plane. Phase 0 makes the status, forces the
// map view and locks Tab (game.js); how you move while flat (chasms and deep water as floor, ledges up to
// 2 blocks, under doors, spikes harmless) is WS8's. When it ends you are set down safely (setDownSafely).
registerStatus("flat", { color: [220, 220, 230], t: 10, flags: { flat: true },
  hud: (s) => `FLAT ${secs(s)}s`, ended: "You peel up out of the Plane, deep again.",
  onStart(game, e) {
    if (!isPlayer(game, e)) return;
    log(game, e, "You are pressed flat! Only the map can hold you now.", [220, 220, 230]);
    game.forceMapView?.();
  },
  onEnd(game, e) { if (isPlayer(game, e)) setDownSafely(game, e); } });

// A flat thing coming back up: on its own tile if it can stand there, else on the nearest tile within 3
// where it can (never over a chasm, in deep water, inside a wall, or onto a creature or a person: their
// tile, or the one a creature is stepping to). If nothing within 3 will do, the search goes on outward:
// you can't fall out of the Plane (bible §10.2).
export function setDownSafely(game, e) {
  const zone = game.zone;
  if (!zone?.stand) return;
  const ok = (x, y) => {
    if (x < 0 || y < 0 || x >= zone.w || y >= zone.d) return false;
    const z = zone.stand[x + y * zone.w];
    if (z < 0 || zone.get(x, y, z - 1) === B.WATER_DEEP) return false;
    // Nobody stands there or is stepping there (people hold their own tile: their nx, ny is it).
    return !zone.creatures?.some((m) => m !== e && ((m.tx === x && m.ty === y) || (m.nx === x && m.ny === y)));
  };
  const tx = Math.floor(e.x), ty = Math.floor(e.y);
  for (let r = 0, far = Math.max(zone.w, zone.d); r <= far; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !ok(tx + dx, ty + dy)) continue;
        if (r > 0) { e.x = tx + dx + 0.5; e.y = ty + dy + 0.5; }
        e.z = zone.stand[tx + dx + (ty + dy) * zone.w];
        e.vz = 0;
        return;
      }
}

// Is this body floating in surface deep water without being able to swim? Then it drowns; once its
// feet are on anything else (or it flies) the status ends. While it's in the air (a jump) nothing
// changes. Both views call this every tick, before tickStatuses.
export function updateDrowning(game, e, { canSwim }) {
  const zone = game.zone;
  if (!zone) return;
  const under = zone.get(Math.floor(e.x), Math.floor(e.y), Math.round(e.z) - 1);
  const inDeep = zone.type === "surface" && under === B.WATER_DEEP && Math.abs(e.z - Math.round(e.z)) < 0.05;
  const drowns = inDeep && !canSwim(e) && !statusFlag(e, "flying") && !statusFlag(e, "flat");
  if (drowns) { if (!hasStatus(e, "drowning")) addStatus(game, e, "drowning"); }
  else if (hasStatus(e, "drowning") && (e.onGround !== false || statusFlag(e, "flying"))) removeStatus(game, e, "drowning");
}
