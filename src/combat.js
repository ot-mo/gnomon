// Combat (TECH_DESIGN §3, with the d20 rules of DECISIONS and bible §10.6/§15.6): one resolution for
// every blow, in both views. The view only picks the target (a 3D swing in a cone, a bump on the map, a
// projectile's contact); resolveAttack decides what happens.
//
//   resolveAttack(game, att, tgt, spec, ctx) → result
//       att, tgt: the player or a creature. spec: what strikes (weaponSpec, naturalSpec, thrownSpec, or
//       { kind: "missile", fixed } for an arrow rolled when it was loosed). ctx = { view, aimed, ranged,
//       source, blocked, rng }: view defaults to game.view; aimed: a projectile that physically reached its
//       target (+RULES.d20.aimed); ranged: arrows (the ward bonus, no thorns); source/blocked: how a blow
//       on you reads in the death cause and the log; rng: a 0..1 function (default combatRng(game)).
//       result = { att, tgt, view, touched, hit, crit, nat, mod, total, dv, dmg, soaked, killed }
//   RULES.combat picks the set:
//     "legacy"  the parent game's numbers and its Math.random draws, in the parent's order (golden): every
//               blow lands, 12% + crit bonus crits (×2, Sunder ×3), elites soak a flat `armour`, your armour
//               soaks 0..AV, a thrown knife crits 12%.
//     "d20"     d20 + toHitMod > DV, a natural 1 misses, a natural ≥ critNat hits and crits (× RULES.d20.crit);
//               damage = the weapon's range + material + floor((STR − req) / 2) + enchantment, then the
//               element/holy/crush/burn/executioner/giant-slayer multipliers; armour soaks 0..AV at random.
//               Creatures roll d20 + floor(level / 3) against your DV (stats.js dv, 0 while unable to act).
//   weaponSpec(e), naturalSpec(c), thrownSpec(game)       the specs
//   toHitMod(game, att, tgt, spec, ctx), critNat(att), dvOf(game, e), avOf(e)
//   rollToHit(game, att, tgt, spec, ctx, rng) → { nat, mod, total, dv, crit, hit }
//   hitChance(mod, dv, crit = 20) → the analytic chance of a hit (check-combat's tables)
//   applyDamage(game, tgt, dmg, { src, label, color, deathText }) → the damage done (no to-hit, no soak
//       beyond an armoured creature's): spikes, bombs, scrolls. src: who did it (XP only for the player).
//   playerMelee(game)        3D: swing at the best target in the cone (reach and line of sight)
//   bumpAttack(game, c)      the map: you walked into c
//   hitPlayer(game, c, dmg, source, blocked, ranged)   a blow that has landed on you (the legacy tail)
//   elementVs(c, el), resistText(c)
//   combatRng(game)          game.combatRng if a test set one, else Math.random
// Events (events.js): "attack" { att, tgt, result } after every resolution; "hurt" { tgt, src, dmg }.
import { lineOfSight } from "./raycast.js";
import { solidFor } from "./world.js";
import { strNeeded, WEAPONS, ELEMENTS } from "./items.js";
import { colossusCore } from "./guardians.js";
import { EYE, attackTime, armourValue, weaponReach } from "./player.js";
import { sfx } from "./sfx.js";
import { attr, maxHp, mod, bonus } from "./stats.js";
import { wielded } from "./body.js";
import { addStatus, hasStatus, statusFlag, cooldownLeft, startCooldown, dvOf as playerDv } from "./status.js";
import { RULES } from "./rules.js";
import { emit } from "./events.js";
import { distance } from "./rng.js";
import { CREATURE_TYPES, touchable, isFlat } from "./creatures.js";
import { killMonster } from "./monsters.js";

const legacy = () => RULES.combat === "legacy";
export const combatRng = (game) => game.combatRng || Math.random;
const isPlayer = (game, e) => e === game.player;
const roll = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// How an element fares against a creature: "resist", "weak" or null.
export function elementVs(m, el) {
  if (!el) return null;
  const t = CREATURE_TYPES[m.type];
  if (m.ward || t.resist?.includes(el)) return "resist";
  if (t.weak?.includes(el)) return "weak";
  return null;
}
// For the map's inspect line: "weak to fire, resists frost".
export function resistText(m) {
  const t = CREATURE_TYPES[m.type], parts = [];
  if (t.weak?.length) parts.push(`weak to ${t.weak.join(" and ")}`);
  if (m.ward) parts.push("elements don't touch it");
  else if (t.resist?.length) parts.push(`resists ${t.resist.join(" and ")}`);
  if (t.brittle) parts.push("brittle");
  return parts.join(", ");
}

// --- Specs ------------------------------------------------------------------------------------------
// The wielded weapon (bonus maxDmg widens the top of the range). Material: bible §13.1, 0 until items
// carry one. Bare hands (fists): req 0 for the legacy set and the to-hit; d20 damage counts STR over
// RULES.d20.fistReq instead.
export function weaponSpec(e) {
  const it = wielded(e), w = it && WEAPONS[it.id];
  if (!w) return { kind: "melee", weapon: null, dmg: [1, 2 + bonus(e, "maxDmg")], ench: 0, element: null, req: 0, acc: 0, material: 0, fists: true };
  return { kind: "melee", weapon: it, dmg: [w.dmg[0], w.dmg[1] + bonus(e, "maxDmg")], ench: it.ench || 0, element: it.element || null,
           req: strNeeded(it), acc: w.acc || 0, material: it.material || 0 };
}
// A creature's own blow: its type's damage range and its level bonus (+1 per 4 levels, creatures.js).
export function naturalSpec(c) {
  const t = CREATURE_TYPES[c.type];
  return { kind: "natural", dmg: t.damage, plus: c.bonus || 0, acc: t.acc || 0 };
}
export function thrownSpec(game) {
  return { kind: "thrown", dmg: [2, 4], plus: game.player.perks?.has("juggler") ? 2 : 0, acc: 0 };
}

// --- The d20 numbers --------------------------------------------------------------------------------
export function dvOf(game, e) {
  if (isPlayer(game, e) || e.attrs) return playerDv(e);
  if (statusFlag(e, "noAct")) return 0;
  const D = RULES.d20, t = CREATURE_TYPES[e.type];
  return D.creatureDv + Math.floor((e.level || 1) / D.dvPerLevels) + (t?.dv || 0) + bonus(e, "dv");
}
// Armour: yours from the stat bus; a creature's its elite/species `armour` plus bonus(av).
export const avOf = (c) => (c.attrs ? armourValue(c) : (c.armour || 0) + bonus(c, "av"));

export function critNat(att) {
  const D = RULES.d20;
  const chance = bonus(att, "crit") + (att.attrs ? D.critPerAgi * Math.max(0, mod(att, "agi")) : 0);
  return Math.max(D.minCritNat, Math.min(D.die, D.die - Math.round(D.die * chance)));
}
// The ground an entity stands on, for high ground (TECH_DESIGN §3.2 "standing"): yours is the first solid
// block below your feet, so a jump in 3D gives no bonus the map can't have; a creature's is its z
// without its hover.
function groundOf(game, e) {
  if (!isPlayer(game, e) && !e.attrs) return e.z - (CREATURE_TYPES[e.type]?.hover || 0);
  const solid = solidFor(game.zone, e), x = Math.floor(e.x), y = Math.floor(e.y);
  let k = Math.floor(e.z + 1e-6);
  while (k > 0 && !solid(x, y, k - 1)) k--;
  return k;
}
export function toHitMod(game, att, tgt, spec = {}, ctx = {}) {
  const D = RULES.d20;
  let m = (spec.acc || 0) + bonus(att, "toHit") + (ctx.aimed ? D.aimed : 0);
  if (groundOf(game, att) - groundOf(game, tgt) >= D.highGroundZ) m += D.highGround;   // standing a block or more above it
  if (att.attrs) {
    m += mod(att, "agi");
    if (spec.req) m -= Math.min(D.reqPenaltyMax, D.reqPenalty * Math.max(0, spec.req - attr(att, "str")));
  } else m += Math.floor((att.level || 1) / D.hitPerLevels);
  return m;
}
export function rollToHit(game, att, tgt, spec, ctx = {}, rng = ctx.rng || combatRng(game)) {
  const nat = 1 + Math.floor(rng() * RULES.d20.die);
  const m = toHitMod(game, att, tgt, spec, ctx), dv = dvOf(game, tgt);
  const crit = nat >= critNat(att) && nat !== 1;
  return { nat, mod: m, total: nat + m, dv, crit, hit: crit || (nat !== 1 && nat + m > dv) };
}
// The chance that d20 + mod beats dv, with crits from `crit` up (a natural 1 always misses).
export function hitChance(m, dv, crit = 20) {
  let n = 0;
  for (let nat = 2; nat <= 20; nat++) if (nat >= crit || nat + m > dv) n++;
  return n / 20;
}

// --- Telling ----------------------------------------------------------------------------------------
const float = (game, e, text, color) =>
  game.effects.push({ kind: "damage", x: e.x, y: e.y, z: e.z + (e.h ?? 1.7) + 0.15, text, color, time: game.time });
const nearYou = (game, e) => distance(game.player.x - e.x, game.player.y - e.y) < 14;

// --- Damage -----------------------------------------------------------------------------------------
// A creature hurt (by you, a creature, a status, spikes): it flashes and shows the number. Hurt by you it
// hunts you; hurt by another creature it bears that one a grudge (factions.js attitude, ai.js pickTarget).
function hurtCreature(game, m, dmg, label, color, src) {
  sfx("hit", { at: m, crit: label.endsWith("!") });
  const state = m.state, lost = m.lost;
  m.hp -= dmg;
  m.hurt = 0.2;
  m.cd = Math.max(m.cd, 0.4);
  m.state = "chase";
  m.lost = 0;
  float(game, m, label, color);
  if (src && !isPlayer(game, src)) {
    m.state = state === "idle" ? "wander" : state; m.lost = lost;
    const brain = (m.brain ||= {});
    brain.hurtBy = src.id;
    (brain.grudges ||= {})[src.id] = 1;
  }
  emit(game, "hurt", { tgt: m, src: src || null, dmg });
}

// A blow that missed or was soaked to nothing still tells (d20): the target turns on whoever swung, as
// hurtCreature does (you: it hunts you; a creature: it bears that one a grudge).
function noticeBlow(game, m, src) {
  if (isPlayer(game, m)) return;
  if (isPlayer(game, src)) { m.state = "chase"; m.lost = 0; return; }
  if (m.state === "idle") m.state = "wander";
  const brain = (m.brain ||= {});
  brain.hurtBy = src.id;
  (brain.grudges ||= {})[src.id] = 1;
}

// Armoured elites shrug off part of every hit (never all of it): the legacy soak.
const flatSoak = (m, dmg, pierce = false) => Math.max(1, dmg - (pierce ? 0 : m.armour || 0));
// The d20 soak: a random 0..AV (cursed armour below zero adds 0..−AV).
const soakRoll = (rng, avv) => (avv >= 0 ? Math.floor(rng() * (avv + 1)) : -Math.floor(rng() * (-avv + 1)));

// Damage from something other than a blow (a bomb, spikes, a scroll): no to-hit roll. Returns what it did.
export function applyDamage(game, m, dmg, { src = game.player, color = [255, 255, 255], label = null, deathText = null } = {}) {
  if (!touchable(game, m, src || game.player)) return 0;
  if (CREATURE_TYPES[m.type].guardian === "colossus" && !colossusCore(game, m)) dmg = Math.min(dmg, 2);
  dmg = flatSoak(m, dmg);
  hurtCreature(game, m, dmg, label ?? `${dmg}`, color, src);
  if (m.hp <= 0) killMonster(game, m, deathText || `You slay the ${m.name}.`, true, isPlayer(game, src), src);
  return dmg;
}
// (The 0B name, for spikes, bombs and scrolls.)
export const damageMonster = (game, m, dmg, color, deathText) => applyDamage(game, m, dmg, { color, deathText });

// A blow that has landed on you (after the to-hit): the amulet, armour, thorns, venom, burns, drain.
// The legacy order exactly (its Math.random draws).
export function hitPlayer(game, m, dmg, source, blocked, ranged = false, rng = Math.random, soaked = null) {
  const p = game.player;
  if (statusFlag(p, "untouchable")) { game.log(`The blow passes through you: you're still half turned out of the world.`, [200, 230, 255]); return 0; }
  // The warding amulet: the first blow misses, then not again for RULES.cooldown.firstBlock seconds.
  if (bonus(p, "firstBlock") > 0 && !(cooldownLeft(p, "firstBlock") > 0)) {
    startCooldown(p, "firstBlock", RULES.cooldown.firstBlock);
    game.log(`Your amulet flares, and ${blocked} misses you!`, [220, 225, 240]);
    sfx("block", { at: m });
    return 0;
  }
  const arm = armourValue(p);
  dmg -= soaked ?? soakRoll(rng, arm);
  if (ranged) dmg -= bonus(p, "ward");
  if (dmg <= 0) { game.log(`Your armour turns ${blocked}.`, [170, 180, 200]); sfx("block", { at: m }); return 0; }
  game.hurtPlayer(dmg, source);
  emit(game, "hurt", { tgt: p, src: m, dmg });
  // Thorns: whoever hit you (up close) gets hurt back.
  const thorns = bonus(p, "thorns");
  if (thorns > 0 && !ranged && m.hp > 0 && game.zone.creatures.includes(m)) {
    hurtCreature(game, m, thorns, `${thorns}`, [150, 200, 90], p);
    if (m.hp <= 0) killMonster(game, m, `The ${m.name} dies on your thorns.`);
  }
  if (m.burns) {   // a salamander's bite sets you smouldering: 1 damage a second
    // The legacy set keeps the parent's bite exactly: poison, the same stream as venom (Thick blood halves
    // it, regeneration goes on, the cause is poison). Otherwise it's burning at half rate.
    const old = RULES.stats === "legacy", id = old ? "poisoned" : "burning";
    if (!hasStatus(p, id)) game.log(`The ${m.name}'s bite burns!`, [255, 140, 60]);
    addStatus(game, p, id, old ? { t: m.burns, stack: "max" } : { t: m.burns, mag: 0.5, stack: "max" });
  }
  if (m.venom) {
    if (!hasStatus(p, "poisoned")) game.log(`The ${m.name}'s venom burns in your veins!`, [150, 210, 80]);
    addStatus(game, p, "poisoned", { t: m.venom, stack: "max" });
  }
  if (m.drain && m.hp > 0 && m.hp < m.maxHp) {
    m.hp = Math.min(m.maxHp, m.hp + dmg);
    float(game, m, `+${dmg}`, [235, 60, 90]);
  }
  return dmg;
}

// --- The resolution ---------------------------------------------------------------------------------
export function resolveAttack(game, att, tgt, spec, ctx = {}) {
  const result = { att, tgt, view: ctx.view || game.view, touched: true, hit: false, crit: false, nat: 0, mod: 0, total: 0, dv: 0,
                   dmg: 0, soaked: 0, killed: false };
  const you = isPlayer(game, att);
  // 1 Touchable? (planes, ghosts, the risen queen; people never)
  if (!isPlayer(game, tgt) && !touchable(game, tgt, att, { blade: spec.kind === "melee" })) {
    result.touched = false;
    if (you && spec.kind === "melee") {
      const t = CREATURE_TYPES[tgt.type];
      game.log(tgt.risen ? `Your blow passes under the ${tgt.name}: she has risen out of the plane! Turn the world (Tab) to strike her.`
                         : t.ghostly ? `Your blow passes through empty air. Something cold is here, but your torchlight hides it.`
                         : `You can't touch the ${tgt.name} from here.`, [200, 190, 255]);
    }
    emit(game, "attack", { att, tgt, result });
    return result;
  }
  if (legacy()) legacyBlow(game, att, tgt, spec, ctx, result);
  else d20Blow(game, att, tgt, spec, ctx, result);
  emit(game, "attack", { att, tgt, result });
  return result;
}

// The multipliers of a blow of yours on a creature (both sets): element, holy, crush, burn, executioner,
// giant-slayer.
function yourMultipliers(game, p, m, dmg, el, vs) {
  const t = CREATURE_TYPES[m.type];
  if (el === "holy" && t.undead && vs !== "resist") dmg *= 2;
  if (vs === "weak") dmg = Math.ceil(dmg * 1.5);
  if (vs === "resist") dmg = Math.max(1, Math.round(dmg * 0.6));
  if (t.brittle && bonus(p, "crush") > 0) dmg *= 2;
  if (hasStatus(m, "burning") && bonus(p, "burnBonus") > 0) dmg = Math.ceil(dmg * (1 + bonus(p, "burnBonus")));
  if (m.hp < m.maxHp * 0.25 && p.perks.has("executioner")) dmg = Math.ceil(dmg * 1.5);
  if ((m.elite || t.guardian || t.boss) && p.perks.has("giantSlayer")) dmg = Math.ceil(dmg * 1.3);
  return dmg;
}

// After your blade lands: the number, the log, the kill or the element's after-effects, the arc.
function yourBladeLanded(game, p, m, dmg, { crit, el, vs, core, rng, soak }) {
  const color = el ? ELEMENTS[el].color : crit ? [255, 220, 80] : [255, 255, 255];
  hurtCreature(game, m, dmg, crit ? `${dmg}!` : `${dmg}`, color, p);
  game.effects.push({ kind: "spark", time: game.time, crit, color });
  if (bonus(p, "leech") > 0 && p.hp < maxHp(p) && rng() < bonus(p, "leech")) p.hp++;
  const killed = m.hp <= 0;
  if (killed) killMonster(game, m, `You slay the ${m.name}.`);
  else {
    if (!core) game.log(`Your blow glances off its stone legs. Its core glows far above you: get up high!`, [255, 200, 120]);
    else game.log(`You ${crit ? "smash" : "hit"} the ${m.name} (${dmg}).${vs === "weak" ? " It's weak to that!" : ""}`, [230, 230, 230]);
    if (vs === "resist") game.log(`The ${m.name} shrugs off the ${{ fire: "flames", frost: "frost", shock: "lightning", holy: "light" }[el]}.`, [170, 170, 190]);
    else {
      if (el === "fire") { if (!hasStatus(m, "burning")) game.log(`The ${m.name} catches fire!`, ELEMENTS.fire.color); addStatus(game, m, "burning", { t: 3, stack: "refresh" }); }
      if (el === "frost") addStatus(game, m, "chilled", { t: 3, stack: "refresh" });
    }
    const poison = bonus(p, "poisonHit");
    if (poison > 0) addStatus(game, m, "poisoned", { t: poison, mag: 2, stack: "max" });
  }
  if (el === "shock" && vs !== "resist") {
    // Lightning jumps to the nearest other creature within 3 tiles that you can see.
    let other = null, near = Infinity;   // (the first of the nearest, as the parent's stable sort picked)
    for (const o of game.zone.creatures) {
      if (o === m || !touchable(game, o) || elementVs(o, "shock") === "resist") continue;
      const d = distance(o.x - m.x, o.y - m.y);
      if (d < 3 && d < near && lineOfSight(game.zone, m.x, m.y, m.z + 0.5, o.x, o.y, o.z + 0.5)) { other = o; near = d; }
    }
    if (other) {
      const arc = soak(other, Math.max(1, Math.ceil(dmg / 2)));
      hurtCreature(game, other, arc, `${arc}`, ELEMENTS.shock.color, p);
      game.log(`Lightning arcs to the ${other.name} (${arc}).`, ELEMENTS.shock.color);
      if (other.hp <= 0) killMonster(game, other, `The ${other.name} is struck down.`);
    }
  }
  return killed;
}

// The parent game, draw for draw.
function legacyBlow(game, att, tgt, spec, ctx, result) {
  const p = game.player, R = Math.random;
  result.hit = true;
  if (isPlayer(game, att) && spec.kind === "melee") {
    const t = CREATURE_TYPES[tgt.type];
    const crit = R() < RULES.legacy.crit + bonus(p, "crit");
    let dmg = Math.max(1, roll(R, spec.dmg[0], spec.dmg[1]) + spec.ench + Math.max(0, Math.floor((attr(p, "str") - spec.req) / 2)));
    const el = spec.element, vs = elementVs(tgt, el);
    dmg = yourMultipliers(game, p, tgt, dmg, el, vs);
    const sunder = crit && bonus(p, "sunder") > 0;
    if (crit) dmg *= sunder ? 3 : 2;
    if (isFlat(tgt) && result.view !== "map") dmg = Math.max(1, Math.floor(dmg / 2));   // the Edge of the Plane, in 3D
    const core = t.guardian === "colossus" ? colossusCore(game, tgt) : true;   // only its core really feels a blow
    if (!core) dmg = 1;
    dmg = flatSoak(tgt, dmg, sunder);
    Object.assign(result, { crit, dmg });
    result.killed = yourBladeLanded(game, p, tgt, dmg, { crit, el, vs, core, rng: R, soak: flatSoak });
  } else if (isPlayer(game, att) && spec.kind === "thrown") {
    const crit = R() < RULES.legacy.crit;
    const base = roll(R, spec.dmg[0], spec.dmg[1]) + spec.plus;
    const name = tgt.name;
    const dmg = applyDamage(game, tgt, base * (crit ? 2 : 1), { color: crit ? [255, 220, 80] : [255, 255, 255] });
    game.log(`Your knife ${crit ? "sinks deep into" : "hits"} the ${name} (${dmg}).`, [220, 220, 230]);
    Object.assign(result, { crit, dmg, killed: tgt.hp <= 0 });
  } else if (isPlayer(game, tgt)) {
    const dmg = spec.fixed ?? roll(R, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
    result.dmg = hitPlayer(game, att, dmg, ctx.source || `the ${att.name}`, ctx.blocked || `the ${att.name}'s blow`, !!ctx.ranged);
  } else {   // one creature on another: no XP, no loot from you
    let dmg = spec.fixed ?? roll(R, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
    dmg = flatSoak(tgt, dmg);
    hurtCreature(game, tgt, dmg, `${dmg}`, [255, 150, 150], att);
    if (tgt.hp <= 0) killMonster(game, tgt, `The ${att.name} kills the ${tgt.name}.`, true, false, att);
    Object.assign(result, { dmg, killed: tgt.hp <= 0 });
  }
}

// The d20 set.
function d20Blow(game, att, tgt, spec, ctx, result) {
  const p = game.player, rng = ctx.rng || combatRng(game), D = RULES.d20;
  const you = isPlayer(game, att), onYou = isPlayer(game, tgt);
  // Your own shields come before the roll: half turned out of the world, the warding amulet.
  if (onYou && (statusFlag(p, "untouchable") || (bonus(p, "firstBlock") > 0 && !(cooldownLeft(p, "firstBlock") > 0)))) {
    hitPlayer(game, att, 0, ctx.source || `the ${att.name}`, ctx.blocked || `the ${att.name}'s blow`, !!ctx.ranged, rng, 0);
    return;
  }
  // 2 To-hit.
  Object.assign(result, rollToHit(game, att, tgt, spec, ctx, rng));
  if (!result.hit) {
    float(game, tgt, "miss", [170, 170, 180]);
    noticeBlow(game, tgt, att);
    if (you) game.log(spec.kind === "thrown" ? `Your knife misses the ${tgt.name}.` : `You miss the ${tgt.name}.`, [170, 170, 180]);
    else if (onYou) { game.log(`${ctx.blocked ? cap(ctx.blocked) : `The ${att.name}`} misses you.`, [170, 170, 180]); sfx("block", { at: att }); }
    return;
  }
  const crit = result.crit;
  // 3 Damage: the range, + material, + STR over the requirement, + enchantment (yours); a creature's
  // level bonus; then the multipliers and the crit.
  let dmg = spec.fixed ?? roll(rng, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
  if (you && spec.kind === "melee") dmg += (spec.material || 0) + Math.floor((attr(p, "str") - (spec.fists ? D.fistReq : spec.req)) / 2) + spec.ench;
  dmg = Math.max(1, dmg);
  if (onYou) {
    if (crit) dmg *= D.crit;
    const soaked = soakRoll(rng, armourValue(p));
    result.dmg = hitPlayer(game, att, dmg, ctx.source || `the ${att.name}`, ctx.blocked || `the ${att.name}'s blow`, !!ctx.ranged, rng, soaked);
    result.soaked = soaked;
    return;
  }
  const t = CREATURE_TYPES[tgt.type];
  const el = you && spec.kind === "melee" ? spec.element : null, vs = elementVs(tgt, el);
  if (you) dmg = yourMultipliers(game, p, tgt, dmg, el, vs);
  const sunder = you && crit && spec.kind === "melee" && bonus(p, "sunder") > 0;   // Sunder: crits ×3, through armour
  if (crit) dmg *= sunder ? 3 : D.crit;
  if (you && isFlat(tgt) && result.view !== "map") dmg = Math.max(1, Math.floor(dmg / 2));   // the Edge of the Plane, in 3D
  const core = you && t.guardian === "colossus" ? colossusCore(game, tgt) : true;
  if (!core) dmg = 1;
  // 4 Soak: 0..AV at random (a glancing blow on the Colossus's legs is never soaked to nothing).
  const soaked = sunder ? 0 : Math.min(soakRoll(rng, avOf(tgt)), core ? dmg : 0);
  dmg -= soaked;
  result.soaked = soaked;
  result.dmg = dmg;
  if (dmg <= 0) {
    result.dmg = 0;
    float(game, tgt, "0", [170, 180, 200]);
    noticeBlow(game, tgt, att);
    if (you) game.log(`The ${tgt.name}'s hide turns your ${spec.kind === "thrown" ? "knife" : "blow"}.`, [170, 180, 200]);
    sfx("block", { at: tgt });
    return;
  }
  // 5 Apply and tell.
  if (you && spec.kind === "melee") {
    result.killed = yourBladeLanded(game, p, tgt, dmg, { crit, el, vs, core, rng, soak: (o, n) => Math.max(0, n - soakRoll(rng, avOf(o))) || 1 });
  } else if (you) {
    hurtCreature(game, tgt, dmg, crit ? `${dmg}!` : `${dmg}`, crit ? [255, 220, 80] : [255, 255, 255], p);
    const name = tgt.name;
    if (tgt.hp <= 0) killMonster(game, tgt, `You slay the ${name}.`);
    else game.log(`Your knife ${crit ? "sinks deep into" : "hits"} the ${name} (${dmg}).`, [220, 220, 230]);
    result.killed = tgt.hp <= 0;
  } else {
    hurtCreature(game, tgt, dmg, `${dmg}`, [255, 150, 150], att);
    if (tgt.hp <= 0) killMonster(game, tgt, `The ${att.name} kills the ${tgt.name}.`, true, false, att);
    result.killed = tgt.hp <= 0;
  }
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// --- The two views ----------------------------------------------------------------------------------
// 3D: swing at whatever is in front of you (the best target in the cone, within reach and sight).
export function playerMelee(game) {
  const p = game.player;
  if (p.attackCd > 0 || statusFlag(p, "noAct")) return null;
  p.attackCd = attackTime(p);
  p.swingTime = p.attackCd * 0.78;   // the animation fills most of the time between swings
  p.swing = p.swingTime;
  const reach = weaponReach(p);
  sfx("swing", { heavy: WEAPONS[wielded(p)?.id]?.swing >= 0.6 });
  const cp = Math.cos(p.pitch);
  const fx = cp * Math.cos(p.yaw), fy = cp * Math.sin(p.yaw), fz = Math.sin(p.pitch);
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  let best = null, bestDist = Infinity;
  for (const m of game.zone.creatures) {
    if (!touchable(game, m, p, { blade: true })) continue;   // a flat being: your blade passes through its shadow; people
    const cz = m.z + m.h * 0.5;
    const vx = m.x - ex, vy = m.y - ey, vz = cz - ez;
    const dist = Math.hypot(vx, vy, vz);
    if (dist > reach + m.w * 0.5) continue;
    if ((vx * fx + vy * fy + vz * fz) / dist < (dist < 1.2 ? 0.2 : 0.7)) continue;
    if (!lineOfSight(game.zone, ex, ey, ez, m.x, m.y, cz)) continue;
    if (dist < bestDist) { bestDist = dist; best = m; }
  }
  return best ? resolveAttack(game, p, best, weaponSpec(p), { view: "3d" }) : null;
}
// The map: you walked into it. (turns.js passes the attack's time.)
export function bumpAttack(game, m) {
  sfx("swing");
  return resolveAttack(game, game.player, m, weaponSpec(game.player), { view: "map" });
}
