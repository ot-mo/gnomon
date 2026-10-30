// The player: body (look, walk, sprint, jump, fly, collide — learn/04 §5), stats and gear.
import { FLOOR_Z, B, solidFor, floatsOn } from "./world.js";
import { WEAPONS } from "./items.js";
import { bonus, invalidateStats, clampHp, makeAttrs, speedMul, canSwim } from "./stats.js";
import { makeBody, wielded, worn } from "./body.js";
import { RULES } from "./rules.js";
import { CURRENCY } from "./currency.js";
import { hasStatus, statusFlag, statusSpeed } from "./status.js";
import { torchGutters } from "./torch.js";
import { hashFloat } from "./rng.js";
import { MUTATIONS } from "./content/mutations.js";

export const RADIUS = 0.3, HEIGHT = 1.6, EYE = 1.45;
export const WALK = 4.2;           // blocks per second; also sets how long a step takes on the map
const SPRINT = 7;
export const WADE_SLOWDOWN = 0.55; // speed multiplier in shallow water
export const HASTE = RULES.haste;  // speed multiplier while hasted (and actions take 1/HASTE as long)
const GRAVITY = 26, JUMP = 8.85;   // jump height = JUMP² / (2·GRAVITY) ≈ 1.5 blocks
const JUMP_HIGH = 11.4;            // with the High jumper perk: ≈ 2.5 blocks
// How fast a jump leaves the ground. The legacy set: the parent's two heights (any jump bonus of 1 or more: High
// jumper, the climber's ring). The attribute set: 1.5 blocks + the jump bonus in blocks (Stilt Legs' halves count),
// at most 4 more.
export function jumpSpeed(p) {
  const b = jumpBonus(p);
  if (RULES.stats === "legacy") return b >= 1 ? JUMP_HIGH : JUMP;
  return Math.sqrt(JUMP * JUMP + 2 * GRAVITY * Math.max(0, Math.min(4, b)));
}
const FLY_SPEED = 4;               // blocks per second up (Space) or down (C) while flying
const EPS = 0.001;

// A new run's player when none is handed in (game.js startRun's `player`: the creation wizard's): the quick start's.
export function makePlayer() { return quickPlayer(); }

// The quick start: the parent game's hero (and the shape every made character starts from).
export function quickPlayer() {
  const p = {
    x: 0, y: 0, z: FLOOR_Z, vz: 0, onGround: false, yaw: 0, pitch: 0,
    hp: 20, keys: 0, funds: 0, purse: CURRENCY.startPurse, torch: true,   // funds, purse: currency.js (the counter)
    attrs: makeAttrs(), maxHpGain: 0,   // base fields: max HP, STR and the rest are derived (stats.js)
    level: 1, xp: 0, perks: {}, pendingLevels: 0, bonusPerks: 0,   // perks: { id: 1 } (keyset.js); bonusPerks: gifts from people, not levels
    // What you're holding and wearing (body.js): parts of a humanoid body, each with an item
    // { kind, id, ench (+blessed / −cursed), known, element? }, and a second weapon on the belt (R swaps).
    body: makeBody("humanoid"),
    inv: [{ kind: "potion", effect: "healing", count: 1 }, { kind: "knife", count: 4 }, { kind: "bomb", count: 1 }],
    ready: { kind: "knife" },   // what T / right-click throws (see throwing.js)
    status: {}, cooldowns: {},  // timed effects (flying, haste, poison…) and cooldowns: status.js
    // Abilities (abilities.js): the quick start is born with Fold Step (the P0 sample; a made character has
    // no innate grant: progression/chargen.js), and the hotbar, keys 1-9, holding ability ids only.
    innate: ["foldStep"], hotbar: ["foldStep"],
    attackCd: 0, throwCd: 0, swing: 0, swingTime: 0.35, hurt: 0, sprinting: false, impact: 0,
  };
  p.body.equip.hand_r = { kind: "weapon", id: "shortsword", ench: 0, known: true };
  p.body.equip.body = { kind: "armour", id: "clothes", ench: 0, known: true };
  return p;
}

// What you're wearing and wielding (body.js; the belt only counts once it's in your hand), and one
// bonus (see stats.js for the list) added up over your gear, your perks and your statuses: the stat bus.
export { worn, wielded, bonus };

// Change something you're wearing (its enchantment, say). STR, max HP and the rest are derived from
// your gear (stats.js), so this only drops the cached bonuses, and your HP if your max HP fell.
export function regear(p, it, change) {
  change(it);
  invalidateStats(p);
  clampHp(p);
}

// How long one swing of your weapon takes (also what an attack costs on the map).
// Bare hands (WS5 #4, at the WS9 merge; combat.js weaponSpec gives fists their damage): no design number, so the
// dagger's swing and a shorter reach (the balance phase may tune them).
export const FISTS = { swing: 0.5, reach: 1.3 };   // (0.5 s: bare hands just below a found weapon; the balance phase §3.4, was 0.3)
const inHand = (p) => WEAPONS[wielded(p)?.id] || FISTS;
export function attackTime(p) {
  const faster = Math.min(0.6, bonus(p, "swing"));
  return (inHand(p).swing * (1 - faster)) / (hasStatus(p, "hasted") ? HASTE : 1);
}
export const weaponReach = (p) => inHand(p).reach + bonus(p, "reach");

// Can be negative with cursed armour: then blows hurt more (stats.js av()).
export { av as armourValue } from "./stats.js";

// Your torch: how far it lights things up for the auto-map, and how bright it is. With it out
// you see nothing by it, unless something lets you see in the dark a little (darkSight), or further with a
// mutation that sees in the dark (content/mutations.js darkRange: Night Eyes). With an empty
// purse it gutters (torch.js): a flicker RULES.torch.gutterRange tiles across, its strength jumping
// about with time t (render3d passes game time).
export function torchRange(p) {
  if (!p.torch) return Math.max(Math.min(4, bonus(p, "darkSight") * 1.5), darkRange(p));
  if (torchGutters(p)) return RULES.torch.gutterRange;
  return 6 * (1 + bonus(p, "torch")) * (hasStatus(p, "darkened") ? 0.4 : 1);
}
export function torchPower(p, t = 0) {
  if (!p.torch) return Math.min(0.9, bonus(p, "darkSight") * 0.3);
  if (torchGutters(p)) return RULES.torch.gutterPower * (0.6 + 0.4 * hashFloat(Math.floor(t * 9)));
  return 2.2 * (1 + bonus(p, "torch") * 1.2) * (hasStatus(p, "darkened") ? 0.3 : 1);
}
export { speedMul };
export const jumpBonus = (p) => bonus(p, "jump");
function darkRange(p) {
  let r = 0;
  for (const id in p.mutations || {}) { const f = MUTATIONS[id]?.darkRange; if (f) r = Math.max(r, f(p.mutations[id])); }
  return r;
}
export const hasFeatherFall = (p) => bonus(p, "featherFall") > 0;

// Swimmers (bonus swim: the Swimmer perk) float on deep water instead of sinking: for them it's solid to stand on.
// On the surface every body floats (world.js floatsOn); one that can't swim drowns there (status.js).
export { canSwim };

export function inShallowWater(p, zone) {
  const g = zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1);
  return g === B.WATER_SHALLOW || (g === B.WATER_DEEP && floatsOn(zone, p));
}

export function clampPitch(p) {
  const LIMIT = 89 * Math.PI / 180;
  p.pitch = Math.max(-LIMIT, Math.min(LIMIT, p.pitch));
}

export function bodyCollides(p, zone) {
  const x0 = Math.floor(p.x - RADIUS), x1 = Math.floor(p.x + RADIUS);
  const y0 = Math.floor(p.y - RADIUS), y1 = Math.floor(p.y + RADIUS);
  const z0 = Math.floor(p.z), z1 = Math.floor(p.z + HEIGHT);
  const solid = solidFor(zone, p);   // swimmers float on deep water (world.js)
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (solid(x, y, z)) return true;
  return false;
}

// Move along one axis; if that ends up inside a block, back out to just touch its face.
export function moveAxis(p, zone, axis, amount) {
  if (amount === 0) return;
  p[axis] += amount;
  if (!bodyCollides(p, zone)) return;
  const v = p[axis];
  if (axis === "z") {
    if (amount < 0) {
      p.z = Math.floor(v) + 1;
      p.onGround = true;
      p.impact = Math.max(p.impact, -p.vz);   // how hard we landed (for fall damage)
    } else p.z = Math.floor(v + HEIGHT) - HEIGHT - EPS;
    p.vz = 0;
  } else {
    p[axis] = amount > 0 ? Math.floor(v + RADIUS) - RADIUS - EPS : Math.floor(v - RADIUS) + 1 + RADIUS + EPS;
  }
}

export function updatePlayer(p, zone, keys, dt) {
  if (statusFlag(p, "noAct")) keys = new Set();   // potion of paralysis: you can't do a thing
  const LOOK = 2.0 * dt;
  if (keys.has("ArrowLeft")) p.yaw -= LOOK;
  if (keys.has("ArrowRight")) p.yaw += LOOK;
  if (keys.has("ArrowUp")) p.pitch += LOOK;
  if (keys.has("ArrowDown")) p.pitch -= LOOK;
  clampPitch(p);

  const fx = Math.cos(p.yaw), fy = Math.sin(p.yaw);
  let mx = 0, my = 0;
  if (keys.has("KeyW")) { mx += fx; my += fy; }
  if (keys.has("KeyS")) { mx -= fx; my -= fy; }
  if (keys.has("KeyD")) { mx -= fy; my += fx; }
  if (keys.has("KeyA")) { mx += fy; my -= fx; }
  const len = Math.hypot(mx, my);
  const flying = statusFlag(p, "flying");
  p.sprinting = len > 0 && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
  const wading = p.onGround && !flying && inShallowWater(p, zone);
  const swimming = wading && zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1) === B.WATER_DEEP;
  p.wade = (p.wade || 0) + ((wading ? (swimming ? 1.6 : 1) : 0) - (p.wade || 0)) * Math.min(1, dt * 8);   // eases the view down/up
  const speed = (p.sprinting ? SPRINT : WALK) * (wading ? (swimming ? 0.45 : WADE_SLOWDOWN) : 1) *
    (hasStatus(p, "hasted") ? HASTE : 1) * speedMul(p) * statusSpeed(p);   // drowning: ×0.4
  if (len > 0 && p.onGround) p.walkPhase = (p.walkPhase || 0) + dt * speed * 2.2;   // for the weapon's bob
  if (len > 0) { mx = (mx / len) * speed; my = (my / len) * speed; }

  if (flying) {
    // No gravity: hover, rise with Space, sink with C.
    p.vz = (keys.has("Space") ? FLY_SPEED : 0) - (keys.has("KeyC") || keys.has("ControlLeft") ? FLY_SPEED : 0);
  } else if (keys.has("Space") && p.onGround) p.vz = jumpSpeed(p);

  const steps = Math.ceil(dt / 0.008);
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    if (!flying) p.vz = Math.max(p.vz - GRAVITY * h, -30);
    moveAxis(p, zone, "x", mx * h);
    moveAxis(p, zone, "y", my * h);
    p.onGround = false;
    moveAxis(p, zone, "z", p.vz * h);
  }
}

// Fall damage from a hard landing (about 5+ blocks). Returns the damage, and resets.
export function takeImpact(p) {
  const speed = p.impact;
  p.impact = 0;
  if (hasFeatherFall(p)) return 0;
  return speed > 14 ? Math.round((speed - 12) / 2.5) : 0;
}
