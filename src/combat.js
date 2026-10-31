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
//               damage = the weapon's range + round((material + its grades' bonus) × swing ÷ 0.7) + enchantment,
//               the bonus Σ GRADES[letter] × (attribute − 10) ÷ 2 over the weapon's scaling (B4, the attribute set;
//               the legacy stat set and fists: floor((STR − 10) / 2); RULES.d20.strOver, swingRef: the light-weapon
//               fix, 2026-10-30), then the element/holy/crush/burn/executioner/giant-slayer multipliers; armour
//               soaks 0..AV at random. A weapon whose requirements (items.js requirements) you lack is used badly
//               (B4): to hit −reqPenalty a missing point (reqPenaltyMin..reqPenaltyCap), damage round((range +
//               material) × reqDmg) + enchantment with nothing from your attributes, and its class's power is off.
//               A missile weapon's shot adds its material and enchantment, not STR. Creatures roll
//               d20 + floor(level / 3) against your DV (stats.js dv, 0 while unable to act). Every blow
//               tells one line in one format, in both views (combatLine).
//   Pressed flat (bible §10.2): you and deep things don't touch each other at all (creatures.js touchable,
//   touchesYou): their blows and arrows pass through you, yours under them; flat things touch you as ever.
//   weaponSpec(e), naturalSpec(c), thrownSpec(game)       the specs (missiles.js missileSpec for missile
//       weapons). A spec may carry noun ("bolt": how the log names it) and onHit(game, tgt, result), run
//       after a d20 blow that hurt and didn't kill (a bolt pins, a stone dazes).
//   combatLine(game, result, spec, ctx) → string          the d20 log line of a resolved blow
//   toHitMod(game, att, tgt, spec, ctx), critNat(att), dvOf(game, e), avOf(e)
//   rollToHit(game, att, tgt, spec, ctx, rng) → { nat, mod, total, dv, crit, hit }
//   hitChance(mod, dv, crit = 20) → the analytic chance of a hit (check-combat's tables)
//   applyDamage(game, tgt, dmg, { src, label, color, deathText }) → the damage done (no to-hit, no soak
//       beyond an armoured creature's): spikes, bombs, scrolls. src: who did it (XP only for the player).
//   playerMelee(game)        3D: swing at the best target in the cone (reach and line of sight): something
//                            hostile first; at anything else the first swing holds back, a second strikes
//   bumpAttack(game, c)      the map: you walked into c (turns.js: a friend or a neutral only with Shift)
//   hitPlayer(game, c, dmg, source, blocked, ranged)   a blow that has landed on you (the legacy tail)
//   elementVs(c, el), resistText(c)
//   combatRng(game)          game.combatRng if a test set one, else Math.random
// Events (events.js): "attack" { att, tgt, result } after every resolution; "hurt" { tgt, src, dmg }.
//
// The real world's gear and the powers that go with it (B1: C4 #4 and #5, bible §13.1-§13.2, §10.8), under d20
// only (the legacy set is the parent's, draw for draw). A blow of yours with a weapon (spec.cls: its class,
// forge.js CLASS_OF; spec.made: its material):
//   materials  truesteel ignores 1 point of the target's armour in the soak; blackglass chips (material −1, to 0)
//              on a crit against armour 4 or more; bone snaps 1 hit in 50 (GEAR.boneSnap): it comes off your
//              hand into the pack, `broken`, until mended (the Repair power; body.js won't hold it). (Pleatmetal's
//              −3 STR is items.js strNeeded's.)
//   classes    a short blade, and any weapon with the Dark backstab power, ×2 against an unaware target (not
//              hunting you) while your torch is out; a great blade knocks a target that can move 1 tile back
//              (off ledges; not into walls); a lantern-flail ×2 against ghosts and shades, and with the torch out
//              it does 1 (useless).
//   powers     Bleed (a short blade's crit: bleeding 3 s, 1 a second), Daze (a cudgel's blow: stunned 1 s a
//              quarter of the time), Cleave (an axe's blow: the nearest other hostile within 1.5 tiles of you
//              takes half, soaked), Disarm (an axe on someone who talks or is a person's kind: a fifth of the
//              time "disarmed" 10 s, its blows halved), High ground (a polearm from a block or more above: +50%),
//              Riposte (a long blade's blow that hits a foe whose blow lands within 0.2 s: that blow is cancelled, its
//              cooldown starts again).
//   armour     a buckler blocks a fifth of the blows that land on you (before armour); a glass-scale turns 15% of
//              arrows and bolts aside, a raised mirror shield half (bible §13.3, §13.4).
import { lineOfSight } from "./raycast.js";
import { solidFor } from "./world.js";
import { strNeeded, WEAPONS, ARMOURS, ELEMENTS, requirements, scaling, shortfall, gradeShare } from "./items.js";
import { colossusCore } from "./guardians.js";
import { EYE, FISTS, attackTime, armourValue, weaponReach } from "./player.js";
import { sfx } from "./sfx.js";
import { attr, maxHp, mod, bonus, invalidateStats, clampHp } from "./stats.js";
import { wielded, worn, fittedEffect } from "./body.js";
import { addStatus, hasStatus, statusFlag, cooldownLeft, startCooldown, registerStatus, dvOf as playerDv } from "./status.js";
import { RULES } from "./rules.js";
import { emit } from "./events.js";
import { distance } from "./rng.js";
import { CREATURE_TYPES, touchable, touchesYou, isFlat, ghostHidden, theOf, TheOf, canTalk, isGhostly } from "./creatures.js";
import { attitude } from "./factions.js";
import { killMonster } from "./monsters.js";
import { hasKey } from "./keyset.js";
import { CLASS_OF } from "./content/items/forge.js";

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
// carry one. Bare hands (fists): req 0 (no to-hit cost); under d20 a fist's blow counts STR over RULES.d20.strOver (a
// weapon's, its grades: B4), scaled by its swing (`swing`: the weapon's, FISTS.swing for bare hands). Fists hit for 1-2; in gauntlets 1d4; with truesteel knuckles fitted (WS5's implant,
// effect "knuckles"; bible §13.6) 2d4, and they crush (×2 against the brittle, as bonus crush does).
export const fitted = fittedEffect;   // (body.js; B1)
export function weaponSpec(e) {
  const it = wielded(e), w = it && WEAPONS[it.id];
  if (!w) {
    const knuckles = fitted(e, "knuckles"), gauntlets = !knuckles && worn(e).some((g) => g.kind === "armour" && g.id === "gauntlets");
    const dmg = knuckles ? [2, 8] : gauntlets ? [1, 4] : [1, 2];
    return { kind: "melee", weapon: null, dmg: [dmg[0], dmg[1] + bonus(e, "maxDmg")], ench: 0, element: null, req: 0, acc: 0, material: 0, fists: true, swing: FISTS.swing,
             ...(knuckles ? { crush: true } : {}) };
  }
  const spec = { kind: "melee", weapon: it, dmg: [w.dmg[0], w.dmg[1] + bonus(e, "maxDmg")], ench: it.ench || 0, element: it.element || null,
           req: strNeeded(it), acc: w.acc || 0, material: it.material || 0, swing: w.swing, cls: CLASS_OF[it.id] || null, made: it.made || null };
  // (B4: the attribute set's requirements and scaling; the legacy set keeps req, the parent's STR number)
  if (RULES.stats !== "legacy") Object.assign(spec, unmetOf(e, it), { scale: scaling(it) });
  return spec;
}
// What an item you hold or wear lacks (B4, the attribute set; the legacy stat set has its own STR rule, so nothing here):
// { miss: the attribute points short in all, unmet: any }.
export function unmetOf(e, it) {
  if (RULES.stats === "legacy") return { miss: 0, unmet: false };
  const short = shortfall(it, (k) => attr(e, k));
  return { miss: short.reduce((s, r) => s + r.need - r.have, 0), unmet: short.length > 0 };
}
// The class's power works only with its requirements met (B4: a weapon used badly has none).
const power = (spec, cls) => spec.cls === cls && !spec.unmet;
// A weapon's attribute bonus a blow before its swing's scaling (B4): its grades' shares of (attribute − strOver) ÷ 2;
// bare hands (no grades) count STR as the light-weapon fix does.
function scaled(p, spec) {
  const D = RULES.d20;
  if (!spec.scale) return Math.floor((attr(p, "str") - D.strOver) / 2);
  let t = 0;
  for (const k in spec.scale) t += gradeShare(spec.scale[k]) * (attr(p, k) - D.strOver) / 2;
  return t;
}
// A creature's own blow: its type's damage range and its level bonus (+1 per 4 levels, creatures.js).
export function naturalSpec(c) {
  const t = CREATURE_TYPES[c.type];
  return { kind: "natural", dmg: t.damage, plus: c.bonus || 0, acc: t.acc || 0 };
}
// (B1, WS5 #8: gyro wrists' +2 for a thrown knife, beside Knife juggler's)
export function thrownSpec(game) {
  return { kind: "thrown", dmg: [2, 4], plus: (hasKey(game.player.perks, "juggler") ? 2 : 0) + (fitted(game.player, "gyroWrists") ? 2 : 0), acc: 0 };
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
    if (spec.miss !== undefined) { if (spec.miss > 0) m -= Math.max(D.reqPenaltyMin, Math.min(D.reqPenaltyCap, D.reqPenalty * spec.miss)); }   // (B4)
    else if (spec.req) m -= Math.min(D.reqPenaltyMax, D.reqPenalty * Math.max(0, spec.req - attr(att, "str")));
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
  // "hurt" goes out before it holds the blow against you: social/reputation.js asks whether it was out for you
  // already (a first blow costs rep and tells the witnesses; one on a creature already hostile doesn't).
  emit(game, "hurt", { tgt: m, src: src || null, dmg });
  if (src && isPlayer(game, src)) turnOnYou(game, m, state, lost);
}

// A blow that missed or was soaked to nothing still tells (d20): the target turns on whoever swung, as
// hurtCreature does (you: it hunts you; a creature: it bears that one a grudge). resolveAttack calls it after
// the "attack" event, for the same reason as hurtCreature's order.
function noticeBlow(game, m, src) {
  if (isPlayer(game, m)) return;
  if (isPlayer(game, src)) { const state = m.state, lost = m.lost; m.state = "chase"; m.lost = 0; turnOnYou(game, m, state, lost); return; }
  if (m.state === "idle") m.state = "wander";
  const brain = (m.brain ||= {});
  brain.hurtBy = src.id;
  (brain.grudges ||= {})[src.id] = 1;
}
// Your blow on a creature that wasn't out for you: your friend (a follower) takes it and goes on as it was
// (a shot of yours that hit it on the way, a slip); anything else holds it against you (a grudge: factions.js
// attitude turns hostile) and hunts you. One already running from it keeps running. (Under the legacy set
// every creature is out for you, so nothing here changes the parent's game.)
function turnOnYou(game, m, state, lost) {
  const feel = attitude(game, m, game.player);
  if (feel === "friendly" || state === "flee") { m.state = state; m.lost = lost; return; }
  if (feel !== "hostile") ((m.brain ||= {}).grudges ||= {}).player = 1;
}

// Armoured elites shrug off part of every hit (never all of it): the legacy soak.
const flatSoak = (m, dmg, pierce = false) => Math.max(1, dmg - (pierce ? 0 : m.armour || 0));
// The d20 soak: a random 0..AV (cursed armour below zero adds 0..−AV).
const soakRoll = (rng, avv) => (avv >= 0 ? Math.floor(rng() * (avv + 1)) : -Math.floor(rng() * (-avv + 1)));

// Damage from something other than a blow (a bomb, spikes, a scroll): no to-hit roll. Returns what it did.
// byPlayer: the kill is yours (its experience, a vampiric ring's heal) though the harm is nobody's, as for spikes
// (traps.js); it follows the source otherwise.
export function applyDamage(game, m, dmg, { src = null, byPlayer = isPlayer(game, src), color = [255, 255, 255], label = null, deathText = null } = {}) {
  if (!touchable(game, m, src || game.player)) return 0;
  if (CREATURE_TYPES[m.type].guardian === "colossus" && !colossusCore(game, m)) dmg = Math.min(dmg, 2);
  dmg = flatSoak(m, dmg);
  hurtCreature(game, m, dmg, label ?? `${dmg}`, color, src);
  if (m.hp <= 0) killMonster(game, m, deathText || `You slay ${theOf(m)}.`, true, byPlayer, src);
  return dmg;
}
// (The 0B name, for spikes and bombs: yours, as in the parent. applyDamage itself has no source unless one is
// given: harm that isn't yours moves no rep, social/reputation.js. WS10's spikes are to pass none.)
export const damageMonster = (game, m, dmg, color, deathText) => applyDamage(game, m, dmg, { src: game.player, color, deathText });

// A blow that has landed on you (after the to-hit): the amulet, armour, thorns, venom, burns, drain.
// The legacy order exactly (its Math.random draws). crit: null for the legacy set (hurtPlayer tells it the
// parent's way); true or false for d20, which tells it in combatLine's format ("hits you (x2) for 8").
export function hitPlayer(game, m, dmg, source, blocked, ranged = false, rng = Math.random, soaked = null, crit = null) {
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
  if (crit === null) game.hurtPlayer(dmg, source);
  else {
    if (game.mode !== "dead") { game.log(`${cap(source)} hits you${crit ? ` (x${RULES.d20.crit})` : ""} for ${dmg}.`, [255, 110, 100]); sfx("hurt"); }
    game.hurtPlayer(dmg, source, true);
  }
  emit(game, "hurt", { tgt: p, src: m, dmg });
  // Thorns: whoever hit you (up close) gets hurt back.
  const thorns = bonus(p, "thorns");
  if (thorns > 0 && !ranged && m.hp > 0 && game.zone.creatures.includes(m)) {
    hurtCreature(game, m, thorns, `${thorns}`, [150, 200, 90], p);
    if (m.hp <= 0) killMonster(game, m, `${TheOf(m)} dies on your thorns.`, true, true, p, { splash: true });
  }
  if (m.burns) {   // a salamander's bite sets you smouldering: 1 damage a second
    // The legacy set keeps the parent's bite exactly: poison, the same stream as venom (Thick blood halves
    // it, regeneration goes on, the cause is poison). Otherwise it's burning at half rate.
    const old = RULES.stats === "legacy", id = old ? "poisoned" : "burning";
    if (!hasStatus(p, id)) game.log(`${TheOf(m)}'s bite burns!`, [255, 140, 60]);
    addStatus(game, p, id, old ? { t: m.burns, stack: "max" } : { t: m.burns, mag: 0.5, stack: "max" });
  }
  if (m.venom) {
    if (!hasStatus(p, "poisoned")) game.log(`${TheOf(m)}'s venom burns in your veins!`, [150, 210, 80]);
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
  // 1 Touchable? (planes, ghosts, the risen queen; people never; pressed flat, only flat things)
  if (isPlayer(game, tgt) ? !touchesYou(game, att) : !touchable(game, tgt, att, { blade: spec.kind === "melee" })) {
    result.touched = false;
    if (you && spec.kind === "melee") {
      const t = CREATURE_TYPES[tgt.type];
      game.log(statusFlag(att, "flat") ? `Your flat hand slides under ${theOf(tgt)}: from the Plane you can only touch flat things.`
                         : tgt.risen ? `Your blow passes under ${theOf(tgt)}: ${tgt.type === "flatqueen" ? "she has" : "it has"} risen out of the plane! Turn the world (Tab) to strike ${tgt.type === "flatqueen" ? "her" : "it"}.`
                         : t.ghostly ? `Your blow passes through empty air. Something cold is here, but your torchlight hides it.`
                         : `You can't touch ${theOf(tgt)} from here.`, [200, 190, 255]);
    }
    emit(game, "attack", { att, tgt, result });
    return result;
  }
  let noticed = false;
  if (legacy()) legacyBlow(game, att, tgt, spec, ctx, result);
  else noticed = d20Blow(game, att, tgt, spec, ctx, result) === "noticed";
  emit(game, "attack", { att, tgt, result });
  if (noticed) noticeBlow(game, tgt, att);
  return result;
}

// The multipliers of a blow of yours on a creature (both sets): element, holy, crush, burn, executioner,
// giant-slayer.
function yourMultipliers(game, p, m, dmg, el, vs, crushes = false) {
  const t = CREATURE_TYPES[m.type];
  if (el === "holy" && t.undead && vs !== "resist") dmg *= 2;
  if (vs === "weak") dmg = Math.ceil(dmg * 1.5);
  if (vs === "resist") dmg = Math.max(1, Math.round(dmg * 0.6));
  if (t.brittle && (crushes || bonus(p, "crush") > 0)) dmg *= 2;
  if (hasStatus(m, "burning") && bonus(p, "burnBonus") > 0) dmg = Math.ceil(dmg * (1 + bonus(p, "burnBonus")));
  if (m.hp < m.maxHp * 0.25 && hasKey(p.perks, "executioner")) dmg = Math.ceil(dmg * 1.5);
  if ((m.elite || t.guardian || t.boss) && hasKey(p.perks, "giantSlayer")) dmg = Math.ceil(dmg * 1.3);
  return dmg;
}

// --- The real world's gear and its powers (B1; the header says what each does) ------------------------------------------
export const GEAR = { boneSnap: 1 / 50, chipAv: 4, bleedT: 3, dazeChance: 0.25, dazeT: 1, disarmChance: 0.2, disarmT: 10,
  cleaveRange: 1.5, highGround: 1.5, riposteWindow: 0.2, block: 0.2 };
// Who carries a weapon to drop (Disarm: bible "humanoids drop their weapon"), besides anyone who talks.
export const ARMED = new Set(["goblin", "skeleton", "archer", "orc", "barrowSkeleton", "assizeOutrider", "rustbackScav", "rustbackSlinger",
  "rustbackBrute", "plumbknight", "assizer", "chimePriest", "chandlerGuard", "lamplessChanter", "draughtsman", "mootWalker"]);
registerStatus("bleeding", { color: [200, 40, 50], t: GEAR.bleedT, stack: "refresh", flags: { noRegen: true }, period: () => 1, cause: "bleeding",
  hud: () => "BLEEDING", ended: "The bleeding stops.", killed: (e) => `${TheOf(e)} bleeds out.` });
registerStatus("disarmed", { color: [190, 190, 150], t: GEAR.disarmT, stack: "refresh", hud: (s) => `DISARMED ${Math.ceil(s.t)}s` });
const unaware = (game, m) => m.state !== "chase" && m.state !== "flee";   // (not hunting you, not running: a sleeper, a wanderer)
const isShade = (m) => isGhostly(m) || !!CREATURE_TYPES[m.type]?.ghostly || m.type === "shade" || m.type === "wraith";
function gearMultipliers(game, p, m, dmg, spec) {
  if (!p.torch && unaware(game, m) && (power(spec, "shortBlade") || hasKey(p.perks, "darkBackstab"))) dmg *= 2;   // from the dark
  if (power(spec, "polearm") && hasKey(p.perks, "highGround") && groundOf(game, p) - groundOf(game, m) >= RULES.d20.highGroundZ) dmg = Math.ceil(dmg * GEAR.highGround);
  if (spec.cls === "flail") dmg = p.torch ? (isShade(m) && !spec.unmet ? dmg * 2 : dmg) : 1;   // the lantern-flail: useless with the torch out
  return dmg;
}
// Before the roll: a long blade's riposte (the foe's blow about to land is cancelled).
function riposte(game, p, m, spec) {
  if (!power(spec, "longBlade") || !hasKey(p.perks, "riposte") || !(m.cd > 0) || m.cd > GEAR.riposteWindow) return false;
  if (attitude(game, m, p) !== "hostile" || distance(p.x - m.x, p.y - m.y) > (CREATURE_TYPES[m.type]?.reach ?? 1.6) + 0.5) return false;
  m.cd = (CREATURE_TYPES[m.type]?.cooldown || 1) * (m.cdMul || 1);
  game.log(`You turn ${theOf(m)}'s blow aside.`, [200, 220, 255]);
  sfx("block", { at: m });
  return true;
}
// After your blade landed (alive or not): the material's wear and the class's after-effects.
function gearAfter(game, p, m, spec, result, rng) {
  const it = spec.weapon, alive = !result.killed && m.hp > 0 && game.zone.creatures.includes(m);
  if (it && spec.made === "blackglass" && result.crit && avOf(m) >= GEAR.chipAv && (it.material || 0) > 0) {
    it.material--; it.chips = (it.chips || 0) + 1;
    game.log(`Your blackglass ${WEAPONS[it.id].name} chips on ${theOf(m)}'s armour.`, [150, 140, 190]);
  }
  if (alive) {
    if (power(spec, "shortBlade") && result.crit && hasKey(p.perks, "bleed")) {
      if (!hasStatus(m, "bleeding")) game.log(`${TheOf(m)} bleeds.`, [200, 60, 70]);
      addStatus(game, m, "bleeding", { t: GEAR.bleedT, src: "player" });
    }
    if (power(spec, "cudgel") && hasKey(p.perks, "daze") && rng() < GEAR.dazeChance) {
      addStatus(game, m, "stunned", { t: GEAR.dazeT, stack: "max" });
      game.log(`${TheOf(m)} reels, dazed.`, [215, 205, 160]);
    }
    if (power(spec, "axe") && hasKey(p.perks, "disarm") && (canTalk(m) || ARMED.has(m.type)) && !hasStatus(m, "disarmed") && rng() < GEAR.disarmChance) {
      addStatus(game, m, "disarmed", { t: GEAR.disarmT });
      game.log(`${TheOf(m)} drops ${canTalk(m) ? "what it was holding" : "its weapon"} and fumbles for it.`, [215, 205, 160]);
    }
    if (power(spec, "greatBlade")) knockBack(game, p, m);
  }
  if (power(spec, "axe") && hasKey(p.perks, "cleave") && result.dmg > 1) cleave(game, p, m, result, rng);
  if (it && spec.made === "bone" && rng() < GEAR.boneSnap) snap(game, p, it);
}
function cleave(game, p, m, result, rng) {
  let other = null, near = Infinity;
  for (const o of game.zone.creatures) {
    if (o === m || o.hp <= 0 || !touchable(game, o, p, { blade: true }) || attitude(game, o, p) !== "hostile") continue;
    const d = distance(o.x - p.x, o.y - p.y);
    if (d <= GEAR.cleaveRange && d < near) { other = o; near = d; }
  }
  if (!other) return;
  const n = Math.max(0, Math.floor(result.dmg / 2) - soakRoll(rng, avOf(other)));
  if (n <= 0) { game.log(`Your swing glances off ${theOf(other)}.`, [170, 180, 200]); return; }
  hurtCreature(game, other, n, `${n}`, [255, 255, 255], p);
  if (other.hp <= 0) killMonster(game, other, `Your swing carries through and slays ${theOf(other)}.`);
  else game.log(`Your swing carries through to ${theOf(other)} (${n}).`, [230, 230, 230]);
}
// A great blade's blow: 1 tile straight back from you, if the target can move and the tile has room; off a ledge it
// drops, and into a chasm (no floor) it falls out of the fight (yours, no loot).
function knockBack(game, p, m) {
  if (statusFlag(m, "noMove") || CREATURE_TYPES[m.type]?.guardian || CREATURE_TYPES[m.type]?.boss || m.legend) return;
  const z = game.zone, ax = m.x - p.x, ay = m.y - p.y;
  const dx = Math.abs(ax) >= Math.abs(ay) * 0.5 ? Math.sign(ax) : 0, dy = Math.abs(ay) >= Math.abs(ax) * 0.5 ? Math.sign(ay) : 0;
  if (!dx && !dy) return;
  const hover = CREATURE_TYPES[m.type]?.hover || 0, x0 = Math.floor(m.x), y0 = Math.floor(m.y);
  const tx = x0 + dx, ty = y0 + dy, zz = Math.floor(m.z - hover + 1e-6);
  if (tx < 0 || ty < 0 || tx >= z.w || ty >= z.d) return;
  const walled = (x, y) => { for (let k = 0; k < Math.max(1, Math.ceil(m.h ?? 1)); k++) if (z.solid(x, y, zz + k)) return true; return false; };
  if (walled(tx, ty) || (dx && dy && (walled(x0 + dx, y0) || walled(x0, y0 + dy)))) return;   // a wall (or a corner): it stands
  if (z.creatures.some((o) => o !== m && Math.floor(o.x) === tx && Math.floor(o.y) === ty)) return;
  const stand = z.stand[tx + ty * z.w];
  if (stand < 0 && hover) return;   // (a flier over a chasm keeps flying: it isn't knocked out over it)
  m.x += dx; m.y += dy; m.tx = tx; m.ty = ty; m.path = null;
  if (stand < 0) { killMonster(game, m, `Your blow sends ${theOf(m)} over the edge and into the dark.`, false); return; }
  if (stand + hover < m.z) m.z = stand + hover;   // (off a ledge it drops; a hoverer keeps its height over the ground)
  game.log(`Your blow knocks ${theOf(m)} back.`, [230, 230, 230]);
}
function snap(game, p, it) {
  const part = Object.keys(p.body.equip).find((id) => p.body.equip[id] === it);
  if (!part) return;
  for (const id in p.body.equip) if (id === part || p.body.equip[id] === part) p.body.equip[id] = null;
  it.broken = true;
  (p.inv ||= []).push(it);
  invalidateStats(p);
  clampHp(p);
  emit(game, "gear", { e: p });   // (what you hold changed, as body.js unequip says it: verification finding)
  game.log(`Your bone ${WEAPONS[it.id].name} snaps! (It goes in your pack, to be mended.)`, [222, 212, 182]);
  sfx("block", { at: p });
}
// A blow landing on you, before armour: the buckler's block; an arrow or bolt turned by the glass-scale or a raised
// mirror shield (one roll for both: 1 − (1 − 0.15)(1 − 0.5)).
function turnedAside(game, p, ranged, rng) {
  if (ranged) {
    let keep = 1;
    for (const g of worn(p)) if (g.kind === "armour" && ARMOURS[g.id]?.reflect && !unmetOf(p, g).unmet) keep *= 1 - ARMOURS[g.id].reflect;   // (B4: not met, off)
    if (hasStatus(p, "running:mirrorShield")) keep *= 0.5;
    if (keep < 1 && rng() >= keep) return "Your gear turns the shot aside.";
  }
  if (worn(p).some((g) => g.kind === "armour" && ARMOURS[g.id]?.block && !unmetOf(p, g).unmet) && rng() < GEAR.block) return "Your buckler takes the blow.";
  return null;
}

// After your blade lands: the number, the log, the kill or the element's after-effects, the arc.
// line(killed): the d20 set's log line (combatLine); without it the parent's lines.
function yourBladeLanded(game, p, m, dmg, { crit, el, vs, core, rng, soak, line = null }) {
  const color = el ? ELEMENTS[el].color : crit ? [255, 220, 80] : [255, 255, 255];
  hurtCreature(game, m, dmg, crit ? `${dmg}!` : `${dmg}`, color, p);
  game.effects.push({ kind: "spark", time: game.time, crit, color });
  if (bonus(p, "leech") > 0 && p.hp < maxHp(p) && rng() < bonus(p, "leech")) p.hp++;
  const killed = m.hp <= 0;
  if (killed) killMonster(game, m, line ? line(true) : `You slay ${theOf(m)}.`);
  else {
    if (!core) game.log(`Your blow glances off its stone legs. Its core glows far above you: get up high!`, [255, 200, 120]);
    else game.log(`${line ? line(false) : `You ${crit ? "smash" : "hit"} ${theOf(m)} (${dmg}).`}${vs === "weak" ? " It's weak to that!" : ""}`, [230, 230, 230]);
    if (vs === "resist") game.log(`${TheOf(m)} shrugs off the ${{ fire: "flames", frost: "frost", shock: "lightning", holy: "light" }[el]}.`, [170, 170, 190]);
    else {
      if (el === "fire") { if (!hasStatus(m, "burning")) game.log(`${TheOf(m)} catches fire!`, ELEMENTS.fire.color); addStatus(game, m, "burning", { t: 3, stack: "refresh", src: "player" }); }
      if (el === "frost") addStatus(game, m, "chilled", { t: 3, stack: "refresh" });
    }
    const poison = bonus(p, "poisonHit");
    if (poison > 0) addStatus(game, m, "poisoned", { t: poison, mag: 2, stack: "max", src: "player" });
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
      game.log(`Lightning arcs to ${theOf(other)} (${arc}).`, ELEMENTS.shock.color);
      if (other.hp <= 0) killMonster(game, other, `${TheOf(other)} is struck down.`, true, true, p, { splash: true });
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
    dmg = yourMultipliers(game, p, tgt, dmg, el, vs, !!spec.crush);
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
    const dmg = applyDamage(game, tgt, base * (crit ? 2 : 1), { src: p, color: crit ? [255, 220, 80] : [255, 255, 255] });
    game.log(`Your knife ${crit ? "sinks deep into" : "hits"} the ${name} (${dmg}).`, [220, 220, 230]);
    Object.assign(result, { crit, dmg, killed: tgt.hp <= 0 });
  } else if (isPlayer(game, att) && spec.kind === "missile") {   // (no parent counterpart: a thrown knife's rules)
    const crit = R() < RULES.legacy.crit;
    const base = roll(R, spec.dmg[0], spec.dmg[1]) + (spec.ench || 0);
    const name = tgt.name;
    const dmg = applyDamage(game, tgt, base * (crit ? 2 : 1), { src: p, color: crit ? [255, 220, 80] : [255, 255, 255] });
    game.log(`Your ${spec.noun || "shot"} ${crit ? "sinks deep into" : "hits"} the ${name} (${dmg}).`, [220, 220, 230]);
    Object.assign(result, { crit, dmg, killed: tgt.hp <= 0 });
    if (!result.killed && spec.onHit && game.zone.creatures.includes(tgt)) spec.onHit(game, tgt, result);
  } else if (isPlayer(game, tgt)) {
    const dmg = spec.fixed ?? roll(R, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
    result.dmg = hitPlayer(game, att, dmg, ctx.source || `${theOf(att)}`, ctx.blocked || `${theOf(att)}'s blow`, !!ctx.ranged);
  } else {   // one creature on another: no XP, no loot from you
    let dmg = spec.fixed ?? roll(R, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
    dmg = flatSoak(tgt, dmg);
    hurtCreature(game, tgt, dmg, `${dmg}`, [255, 150, 150], att);
    if (tgt.hp <= 0) killMonster(game, tgt, `${TheOf(att)} kills ${theOf(tgt)}.`, true, false, att);
    Object.assign(result, { dmg, killed: tgt.hp <= 0 });
  }
}

// The d20 set.
function d20Blow(game, att, tgt, spec, ctx, result) {
  const p = game.player, rng = ctx.rng || combatRng(game), D = RULES.d20;
  const you = isPlayer(game, att), onYou = isPlayer(game, tgt);
  const source = ctx.source || `${theOf(att)}`, blocked = ctx.blocked || `${theOf(att)}'s blow`;
  // Your own shields come before the roll: half turned out of the world, the warding amulet.
  if (onYou && (statusFlag(p, "untouchable") || (bonus(p, "firstBlock") > 0 && !(cooldownLeft(p, "firstBlock") > 0)))) {
    hitPlayer(game, att, 0, source, blocked, !!ctx.ranged, rng, 0, false);
    return;
  }
  // 2 To-hit.
  Object.assign(result, rollToHit(game, att, tgt, spec, ctx, rng));
  // A long blade's parry (B1): your strike, landing in the 0.2 s before its blow, cancels it. Only a hit parries, so a
  // flurry of misses can't hold a foe off for good (verification finding).
  if (you && spec.kind === "melee" && result.hit) result.riposte = riposte(game, p, tgt, spec);
  if (!result.hit) {
    float(game, tgt, "miss", [170, 170, 180]);
    tell(game, result, spec, ctx, [170, 170, 180]);
    if (onYou) sfx("block", { at: att });
    return "noticed";   // (resolveAttack: noticeBlow after the "attack" event)
  }
  const crit = result.crit;
  // 3 Damage: the range, + material and the grades' bonus (fists, and the legacy stat set: STR over RULES.d20.strOver),
  // scaled by the blade's swing ÷ swingRef (rounded once), + enchantment (your blade; used badly, B4:
  // (range + material) × reqDmg + enchantment; a spec without a swing counts as swingRef; a missile
  // weapon's shot takes material and enchantment, no STR); a creature's level bonus; then the multipliers
  // and the crit.
  let dmg = spec.fixed ?? roll(rng, spec.dmg[0], spec.dmg[1]) + (spec.plus || 0);
  if (!you && hasStatus(att, "disarmed")) dmg = Math.floor(dmg / 2);   // (Disarm: B1)
  if (you && spec.kind === "melee" && spec.unmet) dmg = Math.round((dmg + Math.round((spec.material || 0) * (spec.swing ?? D.swingRef) / D.swingRef)) * D.reqDmg) + spec.ench;   // (B4: used badly)
  else if (you && spec.kind === "melee") dmg += Math.round(((spec.material || 0) + scaled(p, spec)) * (spec.swing ?? D.swingRef) / D.swingRef) + spec.ench;
  else if (you && spec.kind === "missile" && spec.fixed === undefined) dmg = (spec.unmet ? Math.round((dmg + (spec.material || 0)) * D.reqDmg) : dmg + (spec.material || 0)) + (spec.ench || 0);   // (B4: a launcher used badly)
  dmg = Math.max(1, dmg);
  if (onYou) {
    const aside = turnedAside(game, p, !!ctx.ranged, rng);   // (B1: the buckler, the glass-scale, the mirror shield)
    if (aside) {
      result.dmg = 0; result.turned = true;
      game.log(aside, [200, 220, 255]); sfx("block", { at: att });
      return;
    }
    result.mult = crit ? D.crit : 1;
    dmg *= result.mult;
    const soaked = soakRoll(rng, armourValue(p));
    result.dmg = hitPlayer(game, att, dmg, source, blocked, !!ctx.ranged, rng, soaked, crit);
    result.soaked = soaked;
    return;
  }
  const t = CREATURE_TYPES[tgt.type];
  const el = you && spec.kind === "melee" ? spec.element : null, vs = elementVs(tgt, el);
  if (you) dmg = yourMultipliers(game, p, tgt, dmg, el, vs, !!spec.crush);
  if (you && spec.kind === "melee") dmg = gearMultipliers(game, p, tgt, dmg, spec);
  const sunder = you && crit && spec.kind === "melee" && bonus(p, "sunder") > 0;   // Sunder: crits ×3, through armour
  result.mult = crit ? (sunder ? 3 : D.crit) : 1;
  dmg *= result.mult;
  if (you && isFlat(tgt) && result.view !== "map") dmg = Math.max(1, Math.floor(dmg / 2));   // the Edge of the Plane, in 3D
  const core = you && t.guardian === "colossus" ? colossusCore(game, tgt) : true;
  if (!core) dmg = 1;
  // 4 Soak: 0..AV at random (a glancing blow on the Colossus's legs is never soaked to nothing).
  const pierce = you && spec.made === "truesteel" ? 1 : 0;   // (truesteel ignores a point of armour: B1)
  const soaked = sunder ? 0 : Math.min(soakRoll(rng, Math.max(0, avOf(tgt) - pierce)), core ? dmg : 0);
  dmg -= soaked;
  result.soaked = soaked;
  result.dmg = dmg;
  if (dmg <= 0) {
    result.dmg = 0;
    float(game, tgt, "0", [170, 180, 200]);
    tell(game, result, spec, ctx, [170, 180, 200]);
    sfx("block", { at: tgt });
    return "noticed";
  }
  // 5 Apply and tell.
  const line = (killed) => combatLine(game, { ...result, killed }, spec, ctx);
  if (you && spec.kind === "melee") {
    result.killed = yourBladeLanded(game, p, tgt, dmg, { crit, el, vs, core, rng, line, soak: (o, n) => Math.max(0, n - soakRoll(rng, avOf(o))) || 1 });
    gearAfter(game, p, tgt, spec, result, rng);
  } else if (you) {
    hurtCreature(game, tgt, dmg, crit ? `${dmg}!` : `${dmg}`, crit ? [255, 220, 80] : [255, 255, 255], p);
    if (tgt.hp <= 0) killMonster(game, tgt, line(true));
    else game.log(line(false), [220, 220, 230]);
    result.killed = tgt.hp <= 0;
  } else {
    hurtCreature(game, tgt, dmg, `${dmg}`, [255, 150, 150], att);
    const seen = inYourSight(game, att) || inYourSight(game, tgt);
    if (tgt.hp <= 0) killMonster(game, tgt, seen ? line(true) : `${TheOf(att)} kills ${theOf(tgt)}.`, true, false, att);
    else if (seen) game.log(line(false), [200, 170, 170]);
    result.killed = tgt.hp <= 0;
  }
  if (!result.killed && spec.onHit && tgt.hp > 0 && game.zone.creatures.includes(tgt)) spec.onHit(game, tgt, result);
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// --- The combat log (d20) ---------------------------------------------------------------------------
// One line a blow, in one format for both views (TECH_DESIGN §3.1, step 6):
//   You hit the goblin for 5.   You hit the goblin (x2) for 10.   You slay the goblin (5).   You miss the goblin.
//   Your bolt hits the goblin for 4.   Your knife misses the goblin.   The goblin's hide turns your blow.
//   The goblin hits you for 3.   The goblin hits you (x2) for 6.   The goblin misses you.   Your armour turns …
//   The orc hits the goblin for 3.   The orc misses the goblin.   The orc slays the goblin (x2, 6).
// (A blow on you that lands is told by hitPlayer, after your armour and the ward have had their say.)
// Creatures' blows on each other are told only where you'd see them (inYourSight).
export function combatLine(game, r, spec = {}, ctx = {}) {
  const you = isPlayer(game, r.att), onYou = isPlayer(game, r.tgt);
  const noun = spec.noun || (spec.kind === "thrown" ? "knife" : spec.kind === "missile" ? "shot" : "blow");
  const melee = spec.kind === "melee" || spec.kind === "natural";
  const mult = r.mult > 1 ? `x${r.mult}` : "";
  if (onYou) {
    if (!r.hit) return `${cap(ctx.blocked || `${theOf(r.att)}`)} misses you.`;
    if (r.dmg <= 0) return `Your armour turns ${ctx.blocked || `${theOf(r.att)}'s blow`}.`;
    return `${cap(ctx.source || `${theOf(r.att)}`)} hits you${mult ? ` (${mult})` : ""} for ${r.dmg}.`;
  }
  const who = you ? (melee ? "You" : `Your ${noun}`) : TheOf(r.att), s = you && melee ? "" : "s";
  if (!r.hit) return `${who} miss${s ? "es" : ""} ${theOf(r.tgt)}.`;
  if (r.dmg <= 0) return `${TheOf(r.tgt)}'s hide turns ${you ? `your ${melee ? "blow" : noun}` : `${theOf(r.att)}'s ${melee ? "blow" : noun}`}.`;
  if (r.killed) return `${who} slay${s} ${theOf(r.tgt)} (${mult ? `${mult}, ` : ""}${r.dmg}).`;
  return `${who} hit${s} ${theOf(r.tgt)}${mult ? ` (${mult})` : ""} for ${r.dmg}.`;
}
// Log a miss or a soaked blow: yours and those on you always, creatures' only where you'd see them.
function tell(game, r, spec, ctx, color) {
  if (isPlayer(game, r.att) || isPlayer(game, r.tgt) || inYourSight(game, r.att) || inYourSight(game, r.tgt))
    game.log(combatLine(game, r, spec, ctx), color);
}
// Within 12 tiles and in your line of sight (and not a ghost the light hides): a fight you'd notice.
function inYourSight(game, c) {
  const p = game.player;
  if (!c || distance(p.x - c.x, p.y - c.y) > 12 || ghostHidden(game, c)) return false;
  return lineOfSight(game.zone, p.x, p.y, p.z + EYE, c.x, c.y, c.z + (c.h ?? 1) * 0.6);
}

// --- The two views ----------------------------------------------------------------------------------
const HOLD_BACK = 2;   // seconds: a second swing at someone you held back from strikes
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
  // The nearest in the cone: something hostile to you first, else the nearest of the rest. One that isn't out
  // for you (your follower, a neutral) isn't struck by the first swing (Appendix B: "a second click to attack a
  // friend", as Shift + direction on the map): you hold back, and a second swing at it within HOLD_BACK s strikes.
  let best = null, bestDist = Infinity, foe = false;
  for (const m of game.zone.creatures) {
    if (!touchable(game, m, p, { blade: true })) continue;   // a flat being: your blade passes through its shadow; people
    const cz = m.z + m.h * 0.5;
    const vx = m.x - ex, vy = m.y - ey, vz = cz - ez;
    const dist = Math.hypot(vx, vy, vz);
    if (dist > reach + m.w * 0.5) continue;
    if ((vx * fx + vy * fy + vz * fz) / dist < (dist < 1.2 ? 0.2 : 0.7)) continue;
    if (!lineOfSight(game.zone, ex, ey, ez, m.x, m.y, cz)) continue;
    const hostile = attitude(game, m, p) === "hostile";
    if ((hostile && !foe) || (hostile === foe && dist < bestDist)) { bestDist = dist; best = m; foe = hostile; }
  }
  if (best && !foe) {
    const held = game.heldBack;
    if (!(held && held.id === best.id && game.time >= held.t && game.time - held.t <= HOLD_BACK)) {
      game.heldBack = { id: best.id, t: game.time };
      game.log(`You hold back from ${theOf(best)}. (Swing again to strike it.)`, [170, 170, 170]);
      return null;
    }
    game.heldBack = null;
  }
  return best ? resolveAttack(game, p, best, weaponSpec(p), { view: "3d" }) : null;
}
// The map: you walked into it. (turns.js passes the attack's time.)
export function bumpAttack(game, m) {
  sfx("swing");
  return resolveAttack(game, game.player, m, weaponSpec(game.player), { view: "map" });
}
