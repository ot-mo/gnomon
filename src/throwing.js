// Throwing knives, potions and bombs.
//
// 3D: a thrown thing really flies (and drops a little) until it hits a monster, a wall or the
//     floor — so aim matters. T or right-click throws.
// Map: T throws straight at the nearest monster you can see (it always hits), and takes a turn.
//
// Knives do 2–4 damage and usually land where you can pick them up again.
// Potions shatter and splash whatever is close to where they land: throw the harmful ones
// (poison gas, paralysis, darkness…). Good ones help the monsters — and if you're standing
// too close, the splash reaches you too. Throwing a potion you don't know identifies it.
// Bombs go off 2 s after they leave your hand (on the map you set them down at your feet):
// they hurt everything close, smash crates, and open the thin walls of secret rooms.
import { damageMonster, hitPlayer } from "./monsters.js";
import { touchable, hostilesTo } from "./creatures.js";
import { POTIONS, POTION_COLORS, FLOOR_ART, itemPalette, makeItem, awayFromWalls, takeOne } from "./items.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, RADIUS, HEIGHT } from "./player.js";
import { noise2 } from "./rng.js";
import { sfx } from "./sfx.js";
import { maxHp } from "./stats.js";
import { addStatus, hasStatus, statusFlag } from "./status.js";

export const THROW_TIME = 0.5;
const SPEED = 15, GRAVITY = 12, SPLASH = 1.8;
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
  const it = takeOne(p, stack);
  const cp = Math.cos(p.pitch);
  const fx = cp * Math.cos(p.yaw), fy = cp * Math.sin(p.yaw), fz = Math.sin(p.pitch);
  const bomb = it.kind === "bomb", speed = bomb ? SPEED * 0.6 : SPEED;   // bombs are lobbed
  game.zone.projectiles.push({
    ...it, x: p.x + fx * 0.3, y: p.y + fy * 0.3, z: p.z + EYE - 0.2 + fz * 0.3,
    vx: fx * speed, vy: fy * speed, vz: fz * speed + (bomb ? 3 : 1.5), life: bomb ? FUSE : 2, spin: 0,
    fuse: bomb ? FUSE : undefined,
  });
  if (bomb) game.log("You light the fuse and throw the bomb!", [255, 170, 70]);
  p.throwCd = p.perks.has("juggler") && it.kind === "knife" ? 0.2 : 0.4;
  sfx("throw");
  return true;
}

// Map: throw at the nearest monster you can see (within 10 tiles), or set a bomb down at
// your feet. Returns true if you did (it takes a turn).
export function throwAtNearest(game, stack = readyStack(game.player)) {
  const { zone, player: p } = game;
  if (!stack) { game.log("You have nothing to throw. (T in the inventory throws a potion.)", [170, 170, 170]); return false; }
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
      const m = !pr.hostile && hostilesTo(game, p).find((mo) => touchable(game, mo) &&
        Math.hypot(nx - mo.x, ny - mo.y) < mo.w * 0.45 + 0.15 && nz > mo.z - 0.1 && nz < mo.z + mo.h + 0.1);
      const bx = Math.floor(nx), by = Math.floor(ny), bz = Math.floor(nz);
      if (pr.hostile && Math.abs(nx - p.x) < RADIUS + 0.1 && Math.abs(ny - p.y) < RADIUS + 0.1 && nz > p.z && nz < p.z + HEIGHT) {
        const what = pr.kind === "bolt" ? "bolt" : "arrow";
        hitPlayer(game, pr.from, pr.dmg, `the ${pr.from.name}'s ${what}`, `the ${what}`, true);
        done = true;
      } else if (m) { impact(game, pr, nx, ny, nz, m); done = true; }
      else if (zone.solid(bx, by, bz) || zone.get(bx, by, bz) === B.WATER_DEEP || nz < -1 ||
               bx < 0 || by < 0 || bx >= zone.w || by >= zone.d) {   // nothing leaves its zone, even over the apron
        impact(game, pr, pr.x, pr.y, pr.z, null);   // stop just before the surface it hit
        done = true;
      } else { pr.x = nx; pr.y = ny; pr.z = nz; }
    }
    if (done) zone.projectiles = zone.projectiles.filter((o) => o !== pr);
  }
}

// It landed. A knife hurts what it hit (if anything) and drops; a potion shatters.
function impact(game, it, x, y, z, m) {
  if (it.hostile) return;   // a monster's arrow or bolt hit a wall: gone
  if (it.kind === "potion") { shatter(game, it.effect, x, y, z); return; }
  const { zone } = game;
  if (it.kind === "bomb") {   // it drops where it stopped and fizzes until it goes off
    const ground = zone.stand[Math.floor(x) + Math.floor(y) * zone.w];
    if (ground < 0) { game.log("The bomb tumbles into the dark. A dull boom echoes from far below.", [170, 170, 170]); return; }
    const [bx, by] = awayFromWalls(zone, x, y, ground);
    zone.bombs.push({ x: bx, y: by, z: ground, fuse: it.fuse ?? FUSE });
    return;
  }
  if (m) {
    const crit = Math.random() < 0.12;
    const name = m.name;
    const base = 2 + Math.floor(Math.random() * 3) + (game.player.perks.has("juggler") ? 2 : 0);
    const dmg = damageMonster(game, m, base * (crit ? 2 : 1), crit ? [255, 220, 80] : [255, 255, 255]);
    game.log(`Your knife ${crit ? "sinks deep into" : "hits"} the ${name} (${dmg}).`, [220, 220, 230]);
  }
  // Where does it come to rest? On the ground under where it stopped — unless that's a
  // chasm or deep water, or it snapped (1 in 5).
  const tx = Math.floor(x), ty = Math.floor(y);
  const ground = zone.stand[tx + ty * zone.w];
  if (ground < 0 || Math.random() < 0.2) return;
  zone.items.push(makeItem({ kind: "knife", count: 1 }, tx + 0.5, ty + 0.5, ground));
}

// A potion smashes at (x, y, z) and splashes everything within SPLASH blocks.
function shatter(game, effect, x, y, z) {
  const { zone, player: p } = game;
  const color = POTION_COLORS[game.potionColor[effect]];
  const known = game.knownPotions.has(effect);
  game.knownPotions.add(effect);
  game.log(known ? `The potion of ${POTIONS[effect].name} shatters!`
                 : `The ${color.name} potion shatters. It was a potion of ${POTIONS[effect].name}!`, color.rgb);
  game.effects.push({ kind: "burst", x, y, z, color: color.rgb, time: game.time });
  const near = hostilesTo(game, p).filter((m) => touchable(game, m) && Math.hypot(m.x - x, m.y - y) <= SPLASH && Math.abs(m.z - z) < 2.5);
  const youToo = Math.hypot(p.x - x, p.y - y) <= SPLASH && Math.abs(p.z + 1 - z) < 2.5;
  const names = () => near.map((m) => m.name).join(", ");

  switch (effect) {
    case "poison":
      zone.clouds.push({ x, y, z, r: SPLASH, time: 6, kind: "poison" });
      game.log("A cloud of poison gas billows out!", [150, 210, 80]);
      break;
    case "paralysis":
      for (const m of near) addStatus(game, m, "stunned", { t: 6, stack: "refresh" });
      if (near.length) game.log(`The ${names()} ${near.length > 1 ? "freeze" : "freezes"} in place!`, [200, 120, 255]);
      if (youToo) { addStatus(game, p, "paralyzed", { t: 3, stack: "max" }); game.log("The fumes reach you too: you can't move!", [200, 120, 255]); }
      break;
    case "darkness": case "shadows":
      for (const m of near) { addStatus(game, m, "blinded", { t: 10, stack: "refresh" }); if (m.state === "chase") m.state = "wander"; }
      game.log(near.length ? `Darkness swallows the ${names()}. They've lost track of you.` : "A pool of darkness spreads and fades.", [130, 120, 170]);
      break;
    case "descent": {
      // The floor melts away: a 3×3 pit (never under stairs). Whatever stands there falls.
      // Not on the last floor: there's nothing below it.
      if (!zone.hasBelow) { game.log("The floor shimmers, but holds. Something wards it.", [180, 170, 140]); break; }
      const cx = Math.floor(x), cy = Math.floor(y);
      for (let ty = cy - 1; ty <= cy + 1; ty++)
        for (let tx = cx - 1; tx <= cx + 1; tx++) {
          const g = zone.get(tx, ty, FLOOR_Z - 1);
          if (tx < 1 || ty < 1 || tx >= zone.w - 1 || ty >= zone.d - 1) continue;
          if (g === B.STAIRS || g === B.STAIRS_UP || zone.get(tx, ty, FLOOR_Z)) continue;   // stairs, or a wall here
          zone.set(tx, ty, 0, B.AIR);
          zone.set(tx, ty, FLOOR_Z - 1, B.AIR);
          zone.holeSeen[tx + ty * zone.w] = 1;
        }
      zone.refresh();
      game.log("The floor melts away into a pit!", [180, 170, 140]);
      break;
    }
    case "healing":
      for (const m of near) m.hp += 12;
      if (near.length) game.log(`The ${names()} ${near.length > 1 ? "look" : "looks"} healthier. Oops.`, [230, 90, 110]);
      if (youToo) { p.hp = Math.min(maxHp(p), p.hp + 6); game.log("Some of it splashes on you. (+6 HP)", [230, 90, 110]); }
      break;
    case "haste":
      for (const m of near) addStatus(game, m, "hasted", { t: 12, stack: "refresh" });
      if (near.length) game.log(`The ${names()} ${near.length > 1 ? "speed" : "speeds"} up! That was a mistake.`, [255, 240, 120]);
      break;
    default:
      game.log("It splashes harmlessly.", [170, 170, 170]);
  }
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
  const demo = p.perks.has("demolitionist"), blast = demo ? BLAST * 1.4 : BLAST;   // the Demolitionist perk
  for (const o of zone.bombs) if (Math.hypot(o.x - x, o.y - y) < blast) o.fuse = Math.min(o.fuse, 0.15);
  for (const m of hostilesTo(game, p))
    if (Math.hypot(m.x - x, m.y - y) <= blast && Math.abs(m.z + m.h / 2 - z) < 2.5)
      damageMonster(game, m, 10 + Math.floor(Math.random() * 7), [255, 160, 60], `The ${m.name} is blown apart.`);
  if (Math.hypot(p.x - x, p.y - y) <= blast && Math.abs(p.z + 0.8 - z) < 2.5)
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
    for (const m of hostilesTo(game, p))
      if (touchable(game, m) && Math.hypot(m.x - c.x, m.y - c.y) <= c.r && Math.abs(m.z - c.z) < 2.5) addStatus(game, m, "poisoned", { t: 2, mag: 2, stack: "max" });
    if (Math.hypot(p.x - c.x, p.y - c.y) <= c.r && Math.abs(p.z + 1 - c.z) < 2.5) {
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
