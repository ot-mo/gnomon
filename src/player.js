// The player: body (look, walk, sprint, jump, fly, collide — learn/04 §5), stats and gear.
import { FLOOR_Z, B, solidFor } from "./world.js";
import { WEAPONS, ARMOURS, itemBonuses } from "./items.js";
import { PERKS, perkRank } from "./leveling.js";

export const RADIUS = 0.3, HEIGHT = 1.6, EYE = 1.45;
export const WALK = 4.2;           // blocks per second; also sets how long a step takes on the map
const SPRINT = 7;
export const WADE_SLOWDOWN = 0.55; // speed multiplier in shallow water
export const HASTE = 1.6;          // speed multiplier while hasted (and actions take 1/HASTE as long)
const GRAVITY = 26, JUMP = 8.85;   // jump height = JUMP² / (2·GRAVITY) ≈ 1.5 blocks
const JUMP_HIGH = 11.4;            // with the High jumper perk: ≈ 2.5 blocks
const FLY_SPEED = 4;               // blocks per second up (Space) or down (C) while flying
const EPS = 0.001;

export function makePlayer() {
  return {
    x: 0, y: 0, z: FLOOR_Z, vz: 0, onGround: false, yaw: 0, pitch: 0,
    hp: 20, maxHp: 20, str: 10, keys: 0, gold: 0, torch: true,
    level: 1, xp: 0, perks: new Set(), pendingLevels: 0, bonusPerks: 0,   // bonusPerks: gifts from people, not levels
    // What you're holding and wearing: { id, ench (+blessed / −cursed), known, element? }
    weapon: { kind: "weapon", id: "shortsword", ench: 0, known: true },
    armour: { kind: "armour", id: "clothes", ench: 0, known: true },
    sidearm: null,              // a second weapon on your belt: R swaps it into your hand
    ring: null, amulet: null,
    inv: [{ kind: "potion", effect: "healing", count: 1 }, { kind: "knife", count: 4 }, { kind: "bomb", count: 1 }],
    ready: { kind: "knife" },   // what T / right-click throws (see throwing.js)
    flyTime: 0, hasteTime: 0, shadowTime: 0, poisonTime: 0, paralyzed: 0, darkTime: 0,
    attackCd: 0, throwCd: 0, swing: 0, swingTime: 0.35, hurt: 0, sprinting: false, impact: 0,
    guardTime: 0,               // untouchable (the Mantle of Angles)
  };
}

// What you're wearing and wielding (the sidearm only counts once it's in your hand).
export const worn = (p) => [p.weapon, p.armour, p.ring, p.amulet].filter(Boolean);

// One bonus (see items.js for the list), added up over your gear and your perks.
export function bonus(p, key) {
  let n = 0;
  for (const it of worn(p)) n += itemBonuses(it)[key] || 0;
  for (const k of p.perks) { const b = PERKS[k].bonus; if (b) n += b(perkRank(p, k))[key] || 0; }
  return n;
}

// STR and max HP from gear are added to your stats while you wear it (so the rest of the game
// can keep reading p.str and p.maxHp). sign: +1 putting it on, −1 taking it off.
export function wear(p, it, sign) {
  if (!it) return;
  const b = itemBonuses(it);
  p.str += sign * (b.str || 0);
  p.maxHp = Math.max(1, p.maxHp + sign * (b.maxHp || 0));
  p.hp = Math.max(1, Math.min(p.hp, p.maxHp));
}
// Change something you're wearing (its enchantment, say) so its STR / max HP follow along.
export function regear(p, it, change) {
  const on = worn(p).includes(it);
  if (on) wear(p, it, -1);
  change(it);
  if (on) wear(p, it, +1);
}

// How long one swing of your weapon takes (also what an attack costs on the map).
export function attackTime(p) {
  const faster = Math.min(0.6, bonus(p, "swing"));
  return (WEAPONS[p.weapon.id].swing * (1 - faster)) / (p.hasteTime > 0 ? HASTE : 1);
}
export const weaponReach = (p) => WEAPONS[p.weapon.id].reach + bonus(p, "reach");

// Can be negative with cursed armour: then blows hurt more.
export function armourValue(p) {
  return ARMOURS[p.armour.id].armour + p.armour.ench + bonus(p, "armour");
}

// Your torch: how far it lights things up for the auto-map, and how bright it is. With it out
// you see nothing by it, unless something lets you see in the dark a little (darkSight).
export function torchRange(p) {
  if (!p.torch) return Math.min(4, bonus(p, "darkSight") * 1.5);
  return 6 * (1 + bonus(p, "torch")) * (p.darkTime > 0 ? 0.4 : 1);
}
export function torchPower(p) {
  if (!p.torch) return Math.min(0.9, bonus(p, "darkSight") * 0.3);
  return 2.2 * (1 + bonus(p, "torch") * 1.2) * (p.darkTime > 0 ? 0.3 : 1);
}
export const speedMul = (p) => 1 + bonus(p, "speed");
export const jumpBonus = (p) => bonus(p, "jump");
export const hasFeatherFall = (p) => bonus(p, "featherFall") > 0;

// Swimmers float on deep water instead of sinking: for them it's solid to stand on.
export const canSwim = (p) => p.perks.has("swimmer");

export function inShallowWater(p, zone) {
  const g = zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1);
  return g === B.WATER_SHALLOW || (g === B.WATER_DEEP && canSwim(p));
}

export function placePlayer(p, spawn) {
  p.x = spawn.x; p.y = spawn.y; p.z = spawn.z; p.vz = 0;
  p.yaw = spawn.yaw; p.pitch = 0;
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
  if (p.paralyzed > 0) keys = new Set();   // potion of paralysis: you can't do a thing
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
  const flying = p.flyTime > 0;
  p.sprinting = len > 0 && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
  const wading = p.onGround && !flying && inShallowWater(p, zone);
  const swimming = wading && zone.get(Math.floor(p.x), Math.floor(p.y), Math.round(p.z) - 1) === B.WATER_DEEP;
  p.wade = (p.wade || 0) + ((wading ? (swimming ? 1.6 : 1) : 0) - (p.wade || 0)) * Math.min(1, dt * 8);   // eases the view down/up
  const speed = (p.sprinting ? SPRINT : WALK) * (wading ? (swimming ? 0.45 : WADE_SLOWDOWN) : 1) *
    (p.hasteTime > 0 ? HASTE : 1) * speedMul(p);
  if (len > 0 && p.onGround) p.walkPhase = (p.walkPhase || 0) + dt * speed * 2.2;   // for the weapon's bob
  if (len > 0) { mx = (mx / len) * speed; my = (my / len) * speed; }

  if (flying) {
    // No gravity: hover, rise with Space, sink with C.
    p.vz = (keys.has("Space") ? FLY_SPEED : 0) - (keys.has("KeyC") || keys.has("ControlLeft") ? FLY_SPEED : 0);
  } else if (keys.has("Space") && p.onGround) p.vz = jumpBonus(p) >= 1 ? JUMP_HIGH : JUMP;

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
