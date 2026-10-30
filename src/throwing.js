// Throwing knives, potions and bombs; everything in flight (missiles.js's shots too).
//
// 3D: a thrown thing really flies (and drops a little) until it hits a monster, a wall or the
//     floor — so aim matters. T or right-click throws.
// Map: under the d20 set T opens the target screen (screens/target.js): pick a creature or a tile, and the
//     thing is launched on an exact ballistic arc at it (throwAt) and flies while the turn's time passes,
//     so it can miss, and the first creature in its way is hit first (your follower too). Under the
//     legacy set T throws straight at the nearest monster you can see (it always hits), as the parent did.
//
// Knives do 2–4 damage and usually land where you can pick them up again.
// Potions shatter and splash whatever is close to where they land: throw the harmful ones
// (poison gas, paralysis, darkness…). Good ones help the monsters — and if you're standing
// too close, the splash reaches you too. Throwing a potion you don't know identifies it.
// Bombs go off 2 s after they leave your hand (on the map you set them down at your feet, or with the
// d20 set lob them at a tile): they hurt everything close, smash crates, and open the thin walls of
// secret rooms. Pressed flat you are under all of it: deep things' arrows, splashes and blasts pass over.
//
// Over an open edge of a surface zone a flight goes on above the apron (the next span's ground): what
// lands there lands in that zone (a knife or a bolt by a zone patch, waiting for you there); a potion
// shatters, a bomb goes off where it fell.
//
//   ballistic(sx, sy, sz, tx, ty, tz, speed, gravity) → { vx, vy, vz, time }   the exact arc
//   launch(game, it, from, to, { speed, gravity, extra }) → projectile           yours, in flight
//   flightOf(game, pr, { maxT = 3 }) → { t, x, y, z, creature, stop, path }      where it would go now (no
//       side effects): the target screen's line of fire, and how long a map throw lasts
//   throwAt(game, stack, target) → projectile | null    the map's throw at a target screen's pick
//   aimPoint(game, target) → { x, y, z }                where a shot at a target is aimed: a creature's
//       middle, else the tile's floor (+0.3): height still decides what can be hit
//   finishFlight(game, pr, seconds)                     the map: `seconds` pass, and then as long as it
//       still flies
//   throwGravity(p, it) → g                             gyro wrists (WS5 #8, B1: implant effect gyroWrists): what you
//       throw flies flat (no drop; a bomb is still lobbed), and a knife hits for 2 more (combat.js thrownSpec)
//   volley(p, stack) → n                                the juggler's arm (jugglerArm): a knife throw throws every knife
//       you carry at once, up to JUGGLE (4); in 3D fanned a little, on the map all at the target
import { damageMonster, resolveAttack, thrownSpec, fitted } from "./combat.js";
import { touchable, touchesYou, hostilesTo, canTalk, theOf, TheOf } from "./creatures.js";
import { POTIONS, POTION_COLORS, FLOOR_ART, itemPalette, makeItem, awayFromWalls, takeOne } from "./items.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, RADIUS, HEIGHT } from "./player.js";
import { noise2 } from "./rng.js";
import { sfx } from "./sfx.js";
import { splash } from "./effects.js";
import { maxHp } from "./stats.js";
import { addStatus, hasStatus, statusFlag } from "./status.js";
import { hasKey } from "./keyset.js";
import { RULES } from "./rules.js";
import { neighbourAddr, addZonePatch, PATCH_OPS } from "./zones.js";
import { passTime, mapUseTime } from "./turns.js";
import { MISSILE_ART } from "./content/items/missiles.js";

export const THROW_TIME = 0.5;
export const THROW_RANGE = 10, BOMB_RANGE = 8;   // the map's target screen (tiles)
// The map's aimed throw: screens/target.js fills it in when it loads (aim(game, stack) opens the screen; its
// confirm calls throwAt and finishFlight). A hook rather than an import, so that hud.js, which reads
// readyStack here, doesn't load the screens through this module.
export const THROW_AIM = { aim: null };
const SPEED = 15, GRAVITY = 12, SPLASH = 1.8;
export const JUGGLE = 4, FAN = 0.06;   // the juggler's arm: knives at once; their spread in 3D (radians)
export const throwGravity = (p, it) => (fitted(p, "gyroWrists") && it?.kind !== "bomb" ? 0 : GRAVITY);
export const volley = (p, stack) => (stack?.kind === "knife" && fitted(p, "jugglerArm") ? Math.max(1, Math.min(JUGGLE, stack.count || 1)) : 1);
const FUSE = 2, BLAST = 2.3;

// What T throws: the stack you last threw from (if you still have some), else your knives.
export function readyStack(p) {
  const r = p.ready;
  return (r && p.inv.find((s) => s.kind === r.kind && s.effect === r.effect)) ||
         p.inv.find((s) => s.kind === "knife") || null;
}

// 3D: throw the ready thing where you're looking.
export function throwReady(game, stack = readyStack(game.player)) {
  const p = game.player;
  if (p.throwCd > 0 || statusFlag(p, "noAct")) return false;
  if (!stack) { game.log("You have nothing to throw. (T in the inventory throws a potion.)", [170, 170, 170]); return false; }
  p.ready = { kind: stack.kind, effect: stack.effect };
  const n = volley(p, stack);
  for (let k = 0; k < n; k++) {
    const it = takeOne(p, stack), g = throwGravity(p, it), yaw = p.yaw + (k - (n - 1) / 2) * FAN;
    const cp = Math.cos(p.pitch);
    const fx = cp * Math.cos(yaw), fy = cp * Math.sin(yaw), fz = Math.sin(p.pitch);
    const bomb = it.kind === "bomb", speed = bomb ? SPEED * 0.6 : SPEED;   // bombs are lobbed
    game.zone.projectiles.push({
      ...it, x: p.x + fx * 0.3, y: p.y + fy * 0.3, z: p.z + EYE - 0.2 + fz * 0.3,
      vx: fx * speed, vy: fy * speed, vz: fz * speed + (bomb ? 3 : g ? 1.5 : 0), ...(g !== GRAVITY ? { g } : {}), life: bomb ? FUSE : 2, spin: 0,
      fuse: bomb ? FUSE : undefined,
    });
  }
  const it = stack, bomb = it.kind === "bomb";
  if (bomb) game.log("You light the fuse and throw the bomb!", [255, 170, 70]);
  p.throwCd = hasKey(p.perks, "juggler") && it.kind === "knife" ? 0.2 : 0.4;
  sfx("throw");
  return true;
}

// Map: under the d20 set, open the target screen for the ready thing (the throw and its time happen
// when you confirm, so this returns false); under the legacy set throw at the nearest monster you can
// see (within 10 tiles), or set a bomb down at your feet. Returns true if you did (it takes a turn).
export function throwAtNearest(game, stack = readyStack(game.player)) {
  const { zone, player: p } = game;
  if (!stack) { game.log("You have nothing to throw. (T in the inventory throws a potion.)", [170, 170, 170]); return false; }
  if (RULES.combat === "d20" && THROW_AIM.aim) { THROW_AIM.aim(game, stack); return false; }
  if (stack.kind === "bomb") {
    p.ready = { kind: "bomb" };
    takeOne(p, stack);
    zone.bombs.push({ x: p.x, y: p.y, z: p.z, fuse: FUSE });
    game.log("You light a bomb and set it down. Get away from it!", [255, 170, 70]);
    return true;
  }
  const visible = hostilesTo(game, p)
    .filter((m) => zone.sightings.get(m.id)?.time === game.time && Math.hypot(m.x - p.x, m.y - p.y) <= 10)
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  const m = visible[0];
  if (!m) { game.log("There's no monster in sight to throw at.", [170, 170, 170]); return false; }
  p.ready = { kind: stack.kind, effect: stack.effect };
  const it = takeOne(p, stack);
  p.yaw = Math.atan2(m.y - p.y, m.x - p.x);
  sfx("throw");
  impact(game, it, m.x, m.y, m.z + m.h * 0.6, m);
  return true;
}

// --- Aimed flights (both views share the arc and the contact) ---------------------------------------
export function ballistic(sx, sy, sz, tx, ty, tz, speed, gravity) {
  const dx = tx - sx, dy = ty - sy, dz = tz - sz;
  const time = Math.max(0.05, Math.hypot(dx, dy, dz) / speed);
  return { vx: dx / time, vy: dy / time, vz: dz / time + 0.5 * gravity * time, time };
}
export function aimPoint(game, target) {
  const c = target?.creature;
  if (c) return { x: c.x, y: c.y, z: c === game.player ? c.z + EYE * 0.6 : c.z + (c.h || 1) * 0.6 };
  const zone = game.zone, tx = target.tile.x, ty = target.tile.y;
  const s = tx >= 0 && ty >= 0 && tx < zone.w && ty < zone.d ? zone.stand[tx + ty * zone.w] : -1;
  return { x: tx + 0.5, y: ty + 0.5, z: (s >= 0 ? s : target.point?.z ?? FLOOR_Z) + 0.3 };
}
// What it is thrown with: a bomb is lobbed (slower, so it arcs higher), the rest at full speed.
export const throwSpeed = (it) => (it.kind === "bomb" ? SPEED * 0.6 : SPEED);
export const THROW_GRAVITY = GRAVITY;
const ownFrom = (p) => ({ x: p.x, y: p.y, z: p.z + EYE - 0.2 });
export function launch(game, it, from, to, { speed = throwSpeed(it), gravity = throwGravity(game.player, it), extra = {} } = {}) {
  const v = ballistic(from.x, from.y, from.z, to.x, to.y, to.z, speed, gravity);
  const pr = { ...it, ...extra, x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz, g: gravity,
               life: v.time + 1.5, spin: 0, mine: true, fuse: it.kind === "bomb" ? FUSE : undefined };
  game.zone.projectiles.push(pr);
  return pr;
}

// The map's throw at what the target screen picked: the ready thing on its arc (a bomb aimed at your own
// tile is set down at your feet, as before).
export function throwAt(game, stack, target) {
  const { zone, player: p } = game;
  if (!stack || !target || !p.inv.includes(stack)) return null;
  p.ready = { kind: stack.kind, effect: stack.effect };
  const to = aimPoint(game, target);
  if (stack.kind === "bomb" && target.tile.x === Math.floor(p.x) && target.tile.y === Math.floor(p.y)) {
    takeOne(p, stack);
    zone.bombs.push({ x: p.x, y: p.y, z: p.z, fuse: FUSE });
    game.log("You light a bomb and set it down. Get away from it!", [255, 170, 70]);
    return null;
  }
  const n = volley(p, stack);
  const it = takeOne(p, stack);
  p.yaw = Math.atan2(to.y - p.y, to.x - p.x);
  if (it.kind === "bomb") game.log("You light the fuse and throw the bomb!", [255, 170, 70]);
  sfx("throw");
  const first = launch(game, it, ownFrom(p), to);
  for (let k = 1; k < n; k++) launch(game, takeOne(p, stack), ownFrom(p), to);   // (the juggler's arm: the rest at the same mark)
  if (n > 1) game.log(`You throw ${n} knives at once.`, [220, 220, 230]);
  return first;
}
// A pretend projectile for flightOf, from you at `to` (a target).
export function ballisticFrom(game, target, speed, gravity) {
  const from = ownFrom(game.player), to = aimPoint(game, target);
  const v = ballistic(from.x, from.y, from.z, to.x, to.y, to.z, speed, gravity);
  return { x: from.x, y: from.y, z: from.z, vx: v.vx, vy: v.vy, vz: v.vz, g: gravity, life: v.time + 1.5, mine: true };
}
export function finishFlight(game, pr, seconds) {
  mapUseTime(game, seconds);
  if (!pr || game.mode !== "map" || !game.zone.projectiles.includes(pr)) return;
  const rest = flightOf(game, pr).t;
  if (rest > 0) passTime(game, rest + 1 / 60);
}

// What a projectile at (nx, ny, nz) runs into this sub-step: you (a creature's arrow or bolt, unless you
// are flat and it isn't), a creature (yours: the first one you could strike, wherever it stands on the
// way), STOP (a block, deep water, the bottom of the world, a border with nothing built beyond it), or null.
const STOP = "stop";
function collide(game, pr, nx, ny, nz, ignore = null) {
  const { zone, player: p } = game;
  if (pr.hostile) {
    // (one of your followers in the way takes it first; the shooter's own kind it flies past, as ever)
    for (const mo of zone.creatures)
      if (mo.brain?.leader === "player" && touchable(game, mo, pr.from) && Math.hypot(nx - mo.x, ny - mo.y) < mo.w * 0.45 + 0.15 && nz > mo.z - 0.1 && nz < mo.z + mo.h + 0.1) return mo;
    if (touchesYou(game, pr.from) && Math.abs(nx - p.x) < RADIUS + 0.1 && Math.abs(ny - p.y) < RADIUS + 0.1 && nz > p.z && nz < p.z + HEIGHT) return p;
  } else {
    for (const mo of zone.creatures)
      if (!canTalk(mo) && touchable(game, mo) && !ignore?.(mo) && Math.hypot(nx - mo.x, ny - mo.y) < mo.w * 0.45 + 0.15 && nz > mo.z - 0.1 && nz < mo.z + mo.h + 0.1) return mo;
  }
  const bx = Math.floor(nx), by = Math.floor(ny), bz = Math.floor(nz);
  if (zone.solid(bx, by, bz) || zone.voxel(bx, by, bz) === B.WATER_DEEP || nz < -1) return STOP;   // (solid: beyond a border without an apron too)
  return null;
}

// Where a projectile would go from here, if nothing moved meanwhile. ignore(c) → true: fly through c (the target
// screen leaves out what you can't see).
export function flightOf(game, pr, { maxT = 3, ignore = null } = {}) {
  const q = { x: pr.x, y: pr.y, z: pr.z, vx: pr.vx, vy: pr.vy, vz: pr.vz, g: pr.g ?? GRAVITY, hostile: pr.hostile, from: pr.from };
  const h = 1 / 120, path = [{ x: q.x, y: q.y, z: q.z }];
  let t = 0, life = Math.min(maxT, pr.life ?? maxT);
  for (; t < life; t += h) {
    q.vz -= q.g * h;
    const nx = q.x + q.vx * h, ny = q.y + q.vy * h, nz = q.z + q.vz * h;
    const hit = collide(game, q, nx, ny, nz, ignore);
    if (hit === STOP) return { t, x: q.x, y: q.y, z: q.z, creature: null, stop: true, path };
    if (hit) return { t, x: nx, y: ny, z: nz, creature: hit, stop: false, path };
    q.x = nx; q.y = ny; q.z = nz;
    if (Math.floor(path[path.length - 1].x) !== Math.floor(nx) || Math.floor(path[path.length - 1].y) !== Math.floor(ny)) path.push({ x: nx, y: ny, z: nz });
  }
  return { t, x: q.x, y: q.y, z: q.z, creature: null, stop: false, path };
}

// Move everything in flight. Each step: did it hit a monster (or you, for arrows and bolts
// shot by monsters)? A block? Deep water?
export function updateProjectiles(game, dt) {
  const { zone, player: p } = game;
  for (const pr of [...zone.projectiles]) {
    pr.life -= dt;
    pr.spin += dt * 20;
    if (pr.kind === "bomb" && (pr.fuse -= dt) <= 0) {   // went off in mid-air
      explode(game, pr.x, pr.y, pr.z);
      zone.projectiles = zone.projectiles.filter((o) => o !== pr);
      continue;
    }
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    let done = pr.life <= 0;
    if (done) impact(game, pr, pr.x, pr.y, pr.z, null);
    for (let s = 0; s < steps && !done; s++) {
      pr.vz -= (pr.g ?? GRAVITY) * h;
      const nx = pr.x + pr.vx * h, ny = pr.y + pr.vy * h, nz = pr.z + pr.vz * h;
      const hit = collide(game, pr, nx, ny, nz);
      if (hit === p) {
        const what = pr.kind === "bolt" ? "bolt" : "arrow";
        resolveAttack(game, pr.from, p, { kind: "missile", fixed: pr.dmg }, { aimed: true, ranged: true, source: `the ${pr.from.name}'s ${what}`, blocked: `the ${what}` });
        done = true;
      } else if (hit === STOP) {
        impact(game, pr, pr.x, pr.y, pr.z, null);   // stop just before the surface it hit
        done = true;
      } else if (hit && pr.hostile) {   // your follower, in the way
        resolveAttack(game, pr.from, hit, { kind: "missile", fixed: pr.dmg }, { aimed: true, ranged: true });
        done = true;
      } else if (hit) { impact(game, pr, nx, ny, nz, hit); done = true; }
      else { pr.x = nx; pr.y = ny; pr.z = nz; }
    }
    if (done) zone.projectiles = zone.projectiles.filter((o) => o !== pr);
  }
}

// It landed. A knife hurts what it hit (if anything) and drops; a potion shatters; a missile weapon's
// shot hurts what it hit, and a bolt that didn't break drops. Beyond the zone's border (over the apron)
// it lands in the next span's zone (landOutside).
function impact(game, it, x, y, z, m) {
  if (it.hostile) return;   // a monster's arrow or bolt hit a wall: gone
  if (it.kind === "potion") { shatter(game, it.effect, x, y, z); return; }
  const { zone } = game;
  const outside = x < 0 || y < 0 || x >= zone.w || y >= zone.d;
  if (it.kind === "bomb") {   // it drops where it stopped and fizzes until it goes off
    if (outside) { const g = groundUnder(zone, x, y, z); if (g >= 0) zone.bombs.push({ x, y, z: g, fuse: it.fuse ?? FUSE }); return; }
    const ground = zone.stand[Math.floor(x) + Math.floor(y) * zone.w];
    if (ground < 0) { game.log("The bomb tumbles into the dark. A dull boom echoes from far below.", [170, 170, 170]); return; }
    const [bx, by] = awayFromWalls(zone, x, y, ground);
    zone.bombs.push({ x: bx, y: by, z: ground, fuse: it.fuse ?? FUSE });
    return;
  }
  if (it.kind === "missile") {   // missiles.js: a stone or a bolt
    if (m) resolveAttack(game, game.player, m, it.spec, { aimed: true, ranged: true });
    if (!it.ammo || Math.random() < (it.breaks ?? 0)) return;
    const drop = { kind: "ammo", effect: it.ammo, count: 1 };
    if (outside) { landOutside(game, drop, x, y); return; }
    const ground = zone.stand[Math.floor(x) + Math.floor(y) * zone.w];
    if (ground >= 0) zone.items.push(makeItem(drop, Math.floor(x) + 0.5, Math.floor(y) + 0.5, ground));
    return;
  }
  if (m) resolveAttack(game, game.player, m, thrownSpec(game), { aimed: true, ranged: true });   // it reached it: aimed, in both views
  if (outside) { if (Math.random() >= 0.2) landOutside(game, { kind: "knife", count: 1 }, x, y); return; }
  // Where does it come to rest? On the ground under where it stopped — unless that's a
  // chasm or deep water, or it snapped (1 in 5).
  const tx = Math.floor(x), ty = Math.floor(y);
  const ground = zone.stand[tx + ty * zone.w];
  if (ground < 0 || Math.random() < 0.2) return;
  zone.items.push(makeItem({ kind: "knife", count: 1 }, tx + 0.5, ty + 0.5, ground));
}

// The first floor under (x, y, z), over the apron too (−1: none).
function groundUnder(zone, x, y, z) {
  const bx = Math.floor(x), by = Math.floor(y);
  for (let k = Math.floor(z); k >= 1; k--) if (zone.solid(bx, by, k - 1) && !zone.solid(bx, by, k)) return k;
  return -1;
}
// A thing that came down beyond the border, over an open edge or corner: it waits in that span's zone (a zone
// patch, applied when you next enter it: zones.js addZonePatch), as far into it as it flew past the edge. Spans
// line up along a shared edge, so the coordinate along it carries over. → the patch, or null (no open way there).
export function landOutside(game, item, x, y) {
  const zone = game.zone;
  const ns = y < 0 ? "n" : y >= zone.d ? "s" : "", ew = x < 0 ? "w" : x >= zone.w ? "e" : "";
  const addr = ns + ew && neighbourAddr(game, zone, ns + ew);
  if (!addr) return null;
  const patch = { op: "landItem", item, ox: ew === "e" ? x - zone.w : x, oy: ns === "s" ? y - zone.d : y };
  addZonePatch(game, addr.key, patch);
  return patch;
}
// { op: "landItem", item, ox, oy }: on the ground there, if there is ground. ox, oy: from this zone's west and
// north edges, or (negative) back from its east and south ones.
PATCH_OPS.landItem = (game, zone, p) => {
  const x = Math.floor(p.ox < 0 ? zone.w + p.ox : p.ox), y = Math.floor(p.oy < 0 ? zone.d + p.oy : p.oy);
  if (x < 0 || y < 0 || x >= zone.w || y >= zone.d) return;
  const ground = zone.stand[x + y * zone.w];
  if (ground >= 0) zone.items.push(makeItem(p.item, x + 0.5, y + 0.5, ground));
};

// Every creature a splash, a blast or gas can reach: friend or foe (people never; nor one still on its way in).
// (Under the legacy set every one of them is out for you, as the parent's list was.)
const bodies = (game) => game.zone.creatures.filter((c) => !canTalk(c) && !(c.brain?.arriving > 0));

// A potion smashes at (x, y, z) and splashes everything within SPLASH blocks.
function shatter(game, effect, x, y, z) {
  const p = game.player;
  const color = POTION_COLORS[game.potionColor[effect]];
  const known = game.knownPotions.has(effect);
  game.knownPotions.add(effect);
  game.log(known ? `The potion of ${POTIONS[effect].name} shatters!`
                 : `The ${color.name} potion shatters. It was a potion of ${POTIONS[effect].name}!`, color.rgb);
  game.effects.push({ kind: "burst", x, y, z, color: color.rgb, time: game.time });
  const near = bodies(game).filter((m) => touchable(game, m) && Math.hypot(m.x - x, m.y - y) <= SPLASH && Math.abs(m.z - z) < 2.5);
  const youToo = touchesYou(game, null) && Math.hypot(p.x - x, p.y - y) <= SPLASH && Math.abs(p.z + 1 - z) < 2.5;   // (flat: it splashes over you)
  const names = () => near.map((m) => m.name).join(", ");

  splash(game, effect, { x, y, z, r: SPLASH, near, youToo, names });   // effects.js SPLASH: the parent's cases, line for line
}

// Lit bombs on the ground count down; when one goes off, any close by go off with it.
export function updateBombs(game, dt) {
  const { zone } = game;
  for (const b of [...zone.bombs]) {
    b.fuse -= dt;
    if (b.fuse > 0) continue;
    zone.bombs = zone.bombs.filter((o) => o !== b);
    explode(game, b.x, b.y, b.z + 0.3);
  }
}

// BOOM. Hurts everything within BLAST blocks (you too), smashes crates, and opens any
// secret-room wall it's next to. Ordinary walls just shake.
function explode(game, x, y, z) {
  const { zone, player: p } = game;
  const W = zone.w;
  game.effects.push({ kind: "burst", x, y, z, color: [255, 160, 60], time: game.time, big: true });
  game.effects.push({ kind: "boom", x, y, z, time: game.time });
  game.log("BOOM!", [255, 170, 60]);
  sfx("boom", { at: { x, y } });
  const demo = hasKey(p.perks, "demolitionist"), blast = demo ? BLAST * 1.4 : BLAST;   // the Demolitionist perk
  for (const o of zone.bombs) if (Math.hypot(o.x - x, o.y - y) < blast) o.fuse = Math.min(o.fuse, 0.15);
  for (const m of bodies(game))
    if (Math.hypot(m.x - x, m.y - y) <= blast && Math.abs(m.z + m.h / 2 - z) < 2.5)
      damageMonster(game, m, 10 + Math.floor(Math.random() * 7), [255, 160, 60], `${TheOf(m)} is blown apart.`);
  if (touchesYou(game, null) && Math.hypot(p.x - x, p.y - y) <= blast && Math.abs(p.z + 0.8 - z) < 2.5)   // (flat: the blast passes over you)
    game.hurtPlayer(Math.ceil((8 + Math.floor(Math.random() * 5)) / (demo ? 2 : 1)), "your own bomb");

  let opened = false, changed = false, wallNear = false;
  for (const c of [...zone.secretWalls]) {
    const wx = c % W, wy = (c - wx) / W;
    if (Math.hypot(wx + 0.5 - x, wy + 0.5 - y) > 1.9 || z > FLOOR_Z + 3) continue;
    zone.set(wx, wy, FLOOR_Z, B.AIR);
    zone.set(wx, wy, FLOOR_Z + 1, B.AIR);
    zone.secretWalls.delete(c);
    opened = true;
  }
  for (let ty = Math.floor(y) - 2; ty <= Math.floor(y) + 2; ty++)
    for (let tx = Math.floor(x) - 2; tx <= Math.floor(x) + 2; tx++) {
      const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
      for (let tz = FLOOR_Z; tz <= FLOOR_Z + 2; tz++) {
        const b = zone.get(tx, ty, tz);
        if (b === B.CRATE && d < 1.7) { zone.set(tx, ty, tz, B.AIR); changed = true; }
        else if (b && b !== B.CRATE && d < 1.3) wallNear = true;
      }
    }
  if (opened) {
    if (zone.secret) zone.secret.found = true;
    game.log("The wall crumbles away. There's a hidden room behind it!", [255, 230, 140]);
  } else if (wallNear) game.log("The walls shake, but hold.", [170, 170, 170]);
  if (opened || changed) zone.refresh();
}

// Poison gas lingers: anything inside it (you included) keeps getting poisoned.
export function updateClouds(game, dt) {
  const { zone, player: p } = game;
  for (const c of zone.clouds) {
    c.time -= dt;
    for (const m of bodies(game))
      if (touchable(game, m) && Math.hypot(m.x - c.x, m.y - c.y) <= c.r && Math.abs(m.z - c.z) < 2.5) addStatus(game, m, "poisoned", { t: 2, mag: 2, stack: "max", src: c.src });
    if (touchesYou(game, null) && Math.hypot(p.x - c.x, p.y - c.y) <= c.r && Math.abs(p.z + 1 - c.z) < 2.5) {
      if (!hasStatus(p, "poisoned")) game.log("You're in the poison cloud!", [150, 210, 80]);
      addStatus(game, p, "poisoned", { t: 2, stack: "max" });
    }
  }
  zone.clouds = zone.clouds.filter((c) => c.time > 0);
}

// --- How it all looks in 3D ---------------------------------------------------------------
const KNIFE_FRAMES = [["   w", "  W ", " s  ", "h   "], ["h   ", " s  ", "  W ", "   w"]];
const POTION_ART = [" c ", "ggg", "grg", "ggg"];

// Gas: drifting puffs (value noise scrolled over time), thinning out towards the edge.
function cloudArt(c, time) {
  const C = 28, R = 12, seed = c.x * 7.3 + c.y * 3.1, rows = [];
  for (let j = 0; j < R; j++) {
    let row = "";
    for (let i = 0; i < C; i++) {
      const u = ((i + 0.5) / C) * 2 - 1, v = ((j + 0.5) / R) * 2 - 1;
      const d = noise2(i * 0.45 + time * 1.2 + seed, j * 0.6 - time * 0.5) - (u * u + v * v) * 0.6;
      row += d > 0.55 ? "c" : d > 0.4 ? "b" : d > 0.28 ? "a" : " ";
    }
    rows.push(row);
  }
  return rows;
}

// A bomb: the floor-item picture, with its fuse spitting sparks.
function bombSprite(x, y, z, time) {
  const art = FLOOR_ART.bomb, spark = Math.floor(time * 20) % 2;
  return { x, y, z, w: art.w, h: art.h, art: art.art,
           palette: { ...itemPalette(null, { kind: "bomb" }), f: [spark ? [255, 240, 160] : [255, 120, 40], 1.6] },
           emit: [0.5 + 0.3 * spark, 0.3, 0.1] };
}

export function projectileSprites(game) {
  const out = [];
  for (const b of game.zone.bombs) out.push(bombSprite(b.x, b.y, b.z, game.time));
  for (const pr of game.zone.projectiles) {
    if (pr.kind === "bomb") {
      out.push(bombSprite(pr.x, pr.y, pr.z - 0.2, game.time));
    } else if (pr.kind === "arrow") {
      out.push({ x: pr.x, y: pr.y, z: pr.z - 0.05, w: 0.45, h: 0.1, art: ["fsssh"],
                 palette: { f: [[220, 220, 220], 0.2], s: [[150, 110, 60], 0.15], h: [[200, 205, 215], 0.3] } });
    } else if (pr.kind === "bolt") {
      out.push({ x: pr.x, y: pr.y, z: pr.z - 0.2, w: 0.4, h: 0.4, art: [" o ", "oOo", " o "], emit: [0.5, 1.2, 0.7],
                 palette: { o: [[120, 255, 160], 1.5], O: [[230, 255, 235], 2.5] } });
    } else if (pr.kind === "missile") {   // missiles.js: a stone, or a bolt pointing the way it flies
      if (pr.shape === "stone") out.push({ x: pr.x, y: pr.y, z: pr.z - 0.06, w: 0.12, h: 0.12, art: ["s"], palette: { s: [[150, 145, 135], 0.15] } });
      else out.push({ x: pr.x, y: pr.y, z: pr.z - 0.05, w: 0.4, h: 0.08, art: MISSILE_ART.bolt.art, palette: { I: [[205, 210, 225], 0.3], h: [[125, 85, 50], 0.1], H: [[165, 120, 75], 0.1] } });
    } else if (pr.kind === "knife") {
      out.push({ x: pr.x, y: pr.y, z: pr.z - 0.12, w: 0.3, h: 0.3, art: KNIFE_FRAMES[Math.floor(pr.spin) % 2],
                 palette: { w: [[235, 240, 250], 0.3], W: [[190, 198, 215], 0.3], s: [[110, 118, 135], 0.2], h: [[125, 80, 45], 0.1] } });
    } else {
      const c = POTION_COLORS[game.potionColor[pr.effect]].rgb;
      out.push({ x: pr.x, y: pr.y, z: pr.z - 0.15, w: 0.22, h: 0.3, art: POTION_ART,
                 palette: { c: [[140, 95, 55], 0.1], g: [[180, 200, 220], 0.2], r: [c, 0.6] } });
    }
  }
  const { zone } = game;
  for (const c of zone.clouds) {
    const f = Math.min(1, c.time / 2);   // fades out over its last 2 seconds
    const ground = zone.stand[Math.floor(c.x) + Math.floor(c.y) * zone.w];
    out.push({ x: c.x, y: c.y, z: ground >= 0 ? ground : c.z - 1, w: c.r * 2, h: 1.6, art: cloudArt(c, game.time),
               palette: { a: [[60 * f, 120 * f, 40 * f], 0.2 * f], b: [[90 * f, 170 * f, 60 * f], 0.35 * f], c: [[130 * f, 220 * f, 90 * f], 0.5 * f] } });
  }
  return out;
}
