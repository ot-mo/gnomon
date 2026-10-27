// Abilities: mutations, implants, items and powers that you use (TECH_DESIGN §2.8, §1.4; P0 API → WS4).
//
//   registerAbility(id, def) → def          def = AbilityDef below; content and workstreams add more
//   registerAbilitySource(name, fn)          fn(e) → [{ id, lvl, item? }]: where an entity's abilities come
//                                            from: "innate", "item", "mutations" (content/mutations.js
//                                            `ability`, at progression/mutations.js mutationLevel) and "powers"
//                                            (content/powers.js `ability`, at its rank) here; WS5 adds implants
//   abilitiesOf(e) → [{ id, lvl, source, item }]   computed from the sources on every call, never stored
//   abilityOf(e, id) → that entry | null
//   cooldownLeft(e, id) · startCooldown(e, id, seconds)    (status.js) e.cooldowns, ticked with the
//                                            statuses: real seconds in 3D, action seconds on the map, exact
//                                            catch-up in skipTime (R10)
//   abilityCooldown(e, id, lvl) → seconds   def.cooldown(lvl, e) × cooldownMul(e) (WIL)
//   abilityRange(e, id, lvl) → tiles        def.rangeFor(lvl, e) if it has one (it grows with the level), else
//                                            def.range: what aimTarget and requestTarget are given
//   activate(game, e, id, target) → bool     the ability's use() with its cost and cooldown, no view logic
//   useAbility(game, e, id) → bool           what a hotbar key does, in either view: refused (and told) when
//                                            it isn't yours, cools down, or you can't act; else the target
//                                            (3D: aimTarget; the map: requestTarget), activate, and on the map
//                                            def.mapTime seconds pass (turns.js mapUseTime, as a throw does).
//                                            On the map the target screen answers later: false now, and the
//                                            ability acts when you confirm (cancelled: nothing, no cost)
//   useHotbar(game, k) → bool                e.hotbar[k] (k = 0..8: keys 1-9; ids only) through useAbility
//   aimTarget(game, range) → { creature, point, tile, dir }   3D: along the view ray (pitch included); the
//                                            creature nearest the crosshair inside a 6° cone with line of sight
//                                            within range, the point where the ray meets a block (or its end)
//   requestTarget(game, ability, done)       a target, in either view: in 3D done(aimTarget(game, range)) at
//                                            once (range: the ability's, else REQUEST_RANGE); on the map WS8's
//                                            target screen (screens/target.js), done({ creature, point, tile,
//                                            dir }) when you confirm, done(null) when you cancel
//
// AbilityDef = { name, source: "mutation" | "implant" | "item" | "power" | "innate",
//   target: "self" | "dir" | "creature" | "tile" | "area", range, rangeFor?(lvl, e) → tiles, radius,
//   cooldown(lvl, e) → seconds, cost?: { charge, funds, hp }, mapTime (seconds on the map),
//   use(game, e, lvl, target) → bool (false: nothing happened, no cost, no cooldown), info(lvl, e) → string,
//   ai?: { when(game, c, target) → bool } }
// cost: paid only when use() did something, refused (nothing happens) when it can't be: charge from the item
// that gives the ability (abilitiesOf's item: item.charge, §2.9; an ability no item gives can't pay it), funds
// through currency.pay, hp (you need more than it).
//
// Fold Step: the P0 sample, now the Bent's mental mutation (bible §13.5; content/mutations.js), on hotbar key 1, the
// same cooldown seconds in both views. In 3D you step along your aim, on the map toward the target requestTarget
// gives (stopping a tile short of a creature; onto a tile WS8's target screen picks) or else the way you face. You
// land through zones.arrivalPoint(zone, "teleport"): the standable tile nearest the point that you could walk to from
// where you stand (so never into a locked or sealed room, onto stairs or onto a creature). The mutation reaches 4 +
// its level (EGO's included); the quick start keeps P0's innate grant and its 4 tiles (its hotbar is in recorded
// frames), and a made character has no innate grant: the Bent who take the mutation have it, nobody else.
// The mutations' other abilities are progression/abilities.js.
import { ITEM_KINDS } from "./items.js";
import { worn } from "./body.js";
import { cooldownMul } from "./stats.js";
import { cooldownLeft, startCooldown, statusFlag } from "./status.js";
import { pay, funds, formatPrice } from "./currency.js";
import { touchable, ghostHidden, creatureAt } from "./creatures.js";
import { castRay, hit, lineOfSight } from "./raycast.js";
import { arrivalPoint } from "./zones.js";
import { mapUseTime, refreshView } from "./turns.js";
import { EYE } from "./player.js";
import { distance } from "./rng.js";
import { MUTATIONS } from "./content/mutations.js";
import { POWERS } from "./content/powers.js";
import { mutationLevel } from "./progression/mutations.js";
import { keysOf } from "./keyset.js";
import { perkRank } from "./leveling.js";

export { cooldownLeft, startCooldown };

export const ABILITIES = {};
export function registerAbility(id, def) {
  if (typeof def?.use !== "function") throw new Error(`registerAbility: ${id} needs use()`);
  ABILITIES[id] = { name: id, source: "innate", target: "self", range: 0, mapTime: 0.5, cooldown: () => 0, info: () => "", ...def, id };
  return ABILITIES[id];
}

const SOURCES = [];
export function registerAbilitySource(name, fn) {
  if (SOURCES.some((s) => s.name === name)) throw new Error(`registerAbilitySource: ${name} is already registered`);
  SOURCES.push({ name, fn });
}
// Born with: e.innate, a list of ability ids (the quick start's Fold Step; a made character has none).
registerAbilitySource("innate", (e) => (e.innate || []).map((id) => ({ id, lvl: 1 })));
// Gear you wear or wield whose kind lists abilities (ItemKindDef.abilities, §2.9).
registerAbilitySource("item", (e) => worn(e).flatMap((it) => (ITEM_KINDS[it.kind]?.abilities?.(it) || []).map((id) => ({ id, lvl: 1, item: it }))));
// Mutations with an ability (content/mutations.js), at the level they work at (a mental one with EGO's levels).
registerAbilitySource("mutations", (e) => Object.keys(e.mutations || {}).filter((id) => MUTATIONS[id]?.ability)
  .map((id) => ({ id: MUTATIONS[id].ability, lvl: mutationLevel(e, id) })));
// Powers with an ability (content/powers.js `ability`; none yet: Roll and the like wait for WS8), at their rank.
registerAbilitySource("powers", (e) => (e.perks ? keysOf(e.perks) : []).filter((k) => POWERS[k]?.ability)
  .map((k) => ({ id: POWERS[k].ability, lvl: perkRank(e, k) })));

export const abilitySources = () => SOURCES.map((s) => s.name);   // what is registered (for checks)

export function abilitiesOf(e) {
  const out = [], seen = new Set();
  if (!e) return out;
  for (const { name, fn } of SOURCES)
    for (const a of fn(e) || []) {
      if (!ABILITIES[a.id] || seen.has(a.id)) continue;   // the first source that gives it wins
      seen.add(a.id);
      out.push({ id: a.id, lvl: a.lvl ?? 1, source: name, item: a.item || null });
    }
  return out;
}
export const abilityOf = (e, id) => abilitiesOf(e).find((a) => a.id === id) || null;
export const abilityCooldown = (e, id, lvl = 1) => (ABILITIES[id]?.cooldown(lvl, e) || 0) * cooldownMul(e);
export function abilityRange(e, id, lvl = 1) {
  const def = ABILITIES[id];
  return def?.rangeFor ? def.rangeFor(lvl, e) : def?.range || 0;
}

const chargeOf = (a) => (Number.isFinite(a?.item?.charge) ? a.item.charge : 0);

export function activate(game, e, id, target = null) {
  const def = ABILITIES[id], a = abilityOf(e, id);
  if (!def || !a || cooldownLeft(e, id) > 0) return false;
  const cost = def.cost || {};
  if (cost.charge && !(chargeOf(a) >= cost.charge)) return false;
  if (cost.funds && funds(e) < cost.funds) return false;
  if (cost.hp && e.hp <= cost.hp) return false;
  if (!def.use(game, e, a.lvl, target)) return false;
  if (cost.charge) a.item.charge -= cost.charge;
  if (cost.funds) pay(game, e, cost.funds);
  if (cost.hp) e.hp -= cost.hp;
  const cd = abilityCooldown(e, id, a.lvl);
  if (cd > 0) startCooldown(e, id, cd);
  return true;
}

// --- Targets ------------------------------------------------------------------------------------------
const CONE = Math.cos((6 * Math.PI) / 180);
export const REQUEST_RANGE = 10;

export function aimTarget(game, range) {
  const p = game.player, zone = game.zone;
  const cp = Math.cos(p.pitch), dir = [cp * Math.cos(p.yaw), cp * Math.sin(p.yaw), Math.sin(p.pitch)];
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  let t = range;
  if (castRay(zone, ex, ey, ez, dir[0], dir[1], dir[2], range)) t = Math.max(0, hit.t - 0.05);
  const point = { x: ex + dir[0] * t, y: ey + dir[1] * t, z: ez + dir[2] * t };
  let creature = null, best = CONE;
  for (const c of zone.creatures) {
    if (!touchable(game, c) || ghostHidden(game, c)) continue;
    const cx = c.x - ex, cy = c.y - ey, cz = c.z + (c.h || 1) * 0.6 - ez;
    const d = Math.sqrt(cx * cx + cy * cy + cz * cz);
    if (d < 1e-6 || d > range + (c.w || 1) * 0.5) continue;
    const cos = (cx * dir[0] + cy * dir[1] + cz * dir[2]) / d;
    if (cos < best || !lineOfSight(zone, ex, ey, ez, c.x, c.y, c.z + (c.h || 1) * 0.6)) continue;
    best = cos; creature = c;
  }
  return { creature, point, tile: { x: Math.floor(point.x), y: Math.floor(point.y) }, dir };
}

// The map's target screen: screens/target.js fills it in when it loads (as throwing.js's THROW_AIM, a hook rather
// than an import, so the modules that read this one don't load the screens through it). No screen: nothing to aim at.
export const MAP_TARGET = { request: null };
export function requestTarget(game, ability, done) {
  if (game.view !== "map") { done(aimTarget(game, ability?.range || REQUEST_RANGE)); return; }
  if (MAP_TARGET.request) MAP_TARGET.request(game, ability, done); else done(null);
}

// --- Using one ----------------------------------------------------------------------------------------
const say = (game, e, text) => { if (e === game.player) game.log(text, [190, 170, 255]); };

export function useAbility(game, e, id) {
  const def = ABILITIES[id], a = def && abilityOf(e, id);
  if (!a) { say(game, e, def ? `You don't have ${def.name}.` : "Nothing happens."); return false; }
  if (statusFlag(e, "noAct")) { say(game, e, "You can't move a muscle."); return false; }
  const left = cooldownLeft(e, id);
  if (left > 0) { say(game, e, `${def.name} isn't ready yet (${Math.ceil(left)} s).`); return false; }
  if (def.cost?.charge && !(chargeOf(a) >= def.cost.charge)) { say(game, e, `${def.name} needs ${def.cost.charge} charge, and ${a.item?.name || "nothing"} holds ${chargeOf(a)}.`); return false; }
  if (def.cost?.funds && funds(e) < def.cost.funds) { say(game, e, `${def.name} costs ${formatPrice(def.cost.funds)}.`); return false; }
  const onMap = game.mode === "map";
  const go = (target) => {
    if (!activate(game, e, id, target)) return false;
    if (onMap && def.mapTime > 0) mapUseTime(game, def.mapTime);
    return true;
  };
  if (def.target === "self") return go(null);
  // In 3D the answer comes at once; on the map when the target screen is confirmed (null: cancelled, so nothing).
  let answered = false, used = false;
  requestTarget(game, def.rangeFor ? { ...def, range: abilityRange(e, id, a.lvl) } : def, (t) => { answered = true; used = !!t && go(t); });
  return answered && used;
}

export function useHotbar(game, k) {
  const p = game.player, id = p.hotbar?.[k];
  if (!id) { game.log(`Nothing is on ${k + 1}.`, [170, 170, 170]); return false; }
  return useAbility(game, p, id);
}

// --- The sample: Fold Step ----------------------------------------------------------------------------
// Where a short teleport aims, as a point on the zone's floor plan: in 3D the aim (a tile short of a
// creature in the crosshair), on the map toward the target (a tile short of it) or the way you face.
function stepGoal(game, e, range, target) {
  const sx = e.x, sy = e.y;
  if (game.mode !== "map") {
    const c = target?.creature;
    if (c) {
      const d = distance(c.x - sx, c.y - sy);
      const k = Math.max(0, Math.min(range, d - 1)) / (d || 1);
      return { x: sx + (c.x - sx) * k, y: sy + (c.y - sy) * k };
    }
    return target?.point ? { x: target.point.x, y: target.point.y } : { x: sx + Math.cos(e.yaw) * range, y: sy + Math.sin(e.yaw) * range };
  }
  if (target?.creature) {
    const c = target.creature, d = distance(c.x - sx, c.y - sy);
    if (d - 1 >= 1) { const k = Math.min(range, d - 1) / d; return { x: sx + (c.x - sx) * k, y: sy + (c.y - sy) * k }; }
  } else if (target?.tile) {   // a tile picked on the map (WS8's target screen): onto it, or as far as you reach
    const gx = target.tile.x + 0.5, gy = target.tile.y + 0.5, d = distance(gx - sx, gy - sy);
    if (d >= 1) { const k = Math.min(range, d) / d; return { x: sx + (gx - sx) * k, y: sy + (gy - sy) * k }; }
  }
  return { x: sx + Math.cos(e.yaw) * range, y: sy + Math.sin(e.yaw) * range };
}

export function foldStep(game, e, range, target) {
  const zone = game.zone, goal = stepGoal(game, e, range, target);
  const fx = Math.max(0, Math.min(zone.w - 1e-3, goal.x)), fy = Math.max(0, Math.min(zone.d - 1e-3, goal.y));
  const tx = Math.floor(e.x), ty = Math.floor(e.y);
  const taken = (x, y) => (x === tx && y === ty) || !!creatureAt(zone, x, y);
  const at = arrivalPoint(zone, "teleport", { fx, fy, yaw: e.yaw, anchor: { x: e.x, y: e.y }, ok: (x, y) => !taken(x, y), strict: true });
  if (!at || (Math.floor(at.x) === tx && Math.floor(at.y) === ty)) return null;
  if (zone.stand[Math.floor(at.x) + Math.floor(at.y) * zone.w] !== at.z) return null;   // (never: landing gives standable tiles)
  return at;
}

// The mutation's reach: 4 + its level; anyone else who has it (the quick start's innate grant, a test source) 4.
const foldRange = (lvl, e) => (e?.mutations?.foldStep ? 4 + lvl : 4);
registerAbility("foldStep", {
  name: "Fold Step", source: "mutation", target: "tile", range: 4, rangeFor: foldRange, mapTime: 0.5,
  cooldown: () => 12,
  info: (lvl, e) => `Step through a fold in the world, up to ${foldRange(lvl, e)} tiles: where you aim in 3D; on the map toward your target, or the way you face.`,
  use(game, e, lvl, target) {
    // A tile picked on the map (WS8's target screen) that is your own: nowhere to go (not the way you face).
    if (game.mode === "map" && !target?.creature && target?.tile && target.tile.x === Math.floor(e.x) && target.tile.y === Math.floor(e.y)) {
      say(game, e, "You're standing there already.");
      return false;
    }
    const at = foldStep(game, e, foldRange(lvl, e), target);
    if (!at) { say(game, e, "There's no room to step through to."); return false; }
    Object.assign(e, { x: at.x, y: at.y, z: at.z, vz: 0 });
    if (e === game.player) {
      game.travel = null;
      if (game.mode === "map") refreshView(game);
      say(game, e, "You fold the world and step through it.");
    }
    return true;
  },
});

