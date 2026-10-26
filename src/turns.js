// Turn-based play on the map, like a traditional roguelike.
//
// Time only passes when you act, and every action costs the game time it would take
// in 3D: a step takes as long as walking one tile, a sword swing as long as a swing.
// Monsters near you (or already hunting you) get exactly that much time to act —
// a fast rat covers more ground per turn than a slow skeleton.
//
// It's the same world and the same player as the 3D view, so when you switch back
// you're standing on the tile you walked to.
//
// Walking into a creature: something hostile to you is attacked; a follower of yours swaps places with
// you; anything else (neutral) is in the way, and Shift + the direction attacks it anyway (§4.3).
// Pressed flat (status.js "flat", bible §10.2) you move in the Plane: chasms, pits and deep water are
// floor you cross at your height, ledges up to 2 blocks up or down are floor, you slide under closed
// doors and gates (locked ones too), walls still stop you, and you can't use levers or anything that
// stands up. You talk only to flat people, and strike only flat things (combat.js).
import { KIND, B, FLOOR_Z, solidFor as zoneSolidFor } from "./world.js";
import { castRay, lineOfSight } from "./raycast.js";
import { lightAt } from "./light.js";
import { bumpAttack } from "./combat.js";
import { updateCreatures, leaderOf } from "./ai.js";
import { CREATURE_TYPES, creatureAt, talkerAt, ghostHidden, ghostOffMap, canTalk, isFlat } from "./creatures.js";
import { attitude } from "./factions.js";
import { keys } from "./input.js";
import { pickUpItems } from "./items.js";
import { useColumn, usableAt } from "./interact.js";
import { EYE, WALK, HEIGHT, WADE_SLOWDOWN, HASTE, attackTime, torchRange, canSwim, speedMul, jumpBonus, hasFeatherFall, bonus } from "./player.js";
import { tickEffects } from "./effects.js";
import { hasStatus, statusFlag, statusSpeed, updateDrowning } from "./status.js";
import { updateClouds, updateProjectiles, updateBombs } from "./throwing.js";
import { PLAYER_STEP_UP } from "./pathing.js";
import { updateSpikes, nearSpikes, TICK } from "./traps.js";
import { tryWalkOff } from "./zones.js";
import { hasKey } from "./keyset.js";

export const STEP_TIME = 1 / WALK;   // ≈ 0.24 s per tile
const USE_TIME = 0.5;                // pulling a lever, opening a door
const WAIT_TIME = 0.5;
const ACTIVE_RADIUS = 12;            // monsters further away (and not hunting you) wait
// How much faster your actions are: haste, and for walking anything that speeds you up.
const haste = (p) => (hasStatus(p, "hasted") ? HASTE : 1);
const fleet = (p) => speedMul(p);

// Let `seconds` of game time pass for everything near you.
export function passTime(game, seconds) {
  const p = game.player;
  for (let left = seconds; left > 1e-6 && game.mode === "map";) {   // stops if you die or leave the floor
    const dt = Math.min(1 / 60, left);
    left -= dt;
    game.time += dt;
    updateCreatures(game, dt, ACTIVE_RADIUS);
    updateSpikes(game);
    updateProjectiles(game, dt);
    updateBombs(game, dt);
    updateClouds(game, dt);
    tickEffects(game, dt);
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.hurt = Math.max(0, p.hurt - dt);
  }
  if (game.mode === "map" && !statusFlag(p, "flying") && !statusFlag(p, "flat")) land(game);   // flight over: come down (or fall)
  if (game.mode === "map") refreshView(game);
}

// --- Standing heights -------------------------------------------------------------
// A column can have more than one place to stand (the floor under a floating platform,
// and the platform's top). These find the right one. `S` says what's solid for you:
// for a swimmer (or anyone on the surface), deep water holds you up: world.js solidFor.
const solidFor = (game) => zoneSolidFor(game.zone, game.player);
const bodyFits = (S, x, y, z) => !S(x, y, Math.floor(z)) && !S(x, y, Math.floor(z + HEIGHT - 0.01));
const canStand = (S, x, y, z) => S(x, y, z - 1) && bodyFits(S, x, y, z);

// The highest place to stand at or below height z, or -1 if there's only void below.
function groundBelow(S, x, y, z) {
  for (let zz = Math.floor(z + 0.01); zz >= 1; zz--) if (canStand(S, x, y, zz)) return zz;
  return -1;
}

// The highest place to stand in the column at all (where flying takes you).
function topSurface(S, x, y, h) {
  return groundBelow(S, x, y, h - 2);
}

// Come down to the ground under you; nothing there means you fall (or sink) to the next floor.
function land(game) {
  const p = game.player;
  const z = groundBelow(solidFor(game), Math.floor(p.x), Math.floor(p.y), p.z);
  if (z < 0) { p.z = -2; game.checkFloorEvents(); return; }
  const drop = p.z - z;
  p.z = z;
  if (drop >= 5 && !hasFeatherFall(p)) game.hurtPlayer(Math.round(drop / 2.5), "the fall");
}

// What you can see from where you stand: fill in the auto-map with a 360° sweep of rays
// (same rules as the 3D view: only lit places, or within your torch's reach), and note
// where the visible monsters are right now. With the Cartographer perk, chasms you see
// from here are marked on the map too.
export function refreshView(game) {
  const { zone, player: p } = game;
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  const torch = torchRange(p);
  const holes = hasKey(p.perks, "cartographer") ? zone.holeSeen : null;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  for (let y = ty - 1; y <= ty + 1; y++)
    for (let x = tx - 1; x <= tx + 1; x++)
      if (x >= 0 && y >= 0 && x < zone.w && y < zone.d) zone.seen[x + y * zone.w] = 1;
  for (let k = 0; k < 240; k++) {
    const a = (k / 240) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (const pitch of [-0.5, -0.2, 0.05, 0.3]) {
      const cp = Math.cos(pitch);
      castRay(zone, ex, ey, ez, ca * cp, sa * cp, Math.sin(pitch), 24, zone.seen, torch, holes);
    }
  }
  // Every creature you see (not people: the map draws those itself): hostile ones in their colour, your
  // followers (and anything else on your side) tinted toward ALLY so you can tell them apart.
  const sense = bonus(p, "sense");   // an amulet of sight: monsters close by show, seen or not
  for (const m of zone.creatures) {
    if (canTalk(m) || m.brain?.arriving > 0) continue;
    if (ghostHidden(game, m)) continue;   // the Gloom Warden: only in the dark (light.js inDark)
    const cz = m.z + m.h * 0.6;
    const dist = Math.hypot(m.x - p.x, m.y - p.y);
    const color = m.brain?.leader !== undefined && attitude(game, m, p) === "friendly" ? m.color.map((v, k) => Math.round((v + ALLY[k]) / 2)) : m.color;
    if (dist < sense) { zone.sightings.set(m.id, { x: m.x, y: m.y, glyph: m.glyph, color, name: m.name, time: game.time }); continue; }
    if (dist > 24) continue;
    const { sky, lamp } = lightAt(game, zone, m.x, m.y, cz);   // sky × daylight (light.js)
    const lit = sky * 0.6 + lamp * Math.sqrt(lamp) * 2 > 0.15 || dist < torch;
    if (lit && lineOfSight(zone, ex, ey, ez, m.x, m.y, cz))
      zone.sightings.set(m.id, { x: m.x, y: m.y, glyph: m.glyph, color, name: m.name, time: game.time });
  }
}
const ALLY = [90, 230, 255];

// Stand exactly in the middle of the current tile (the map works in whole tiles).
function settle(game) {
  const p = game.player;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  p.x = tx + 0.5; p.y = ty + 0.5; p.vz = 0;
  if (statusFlag(p, "flying")) return;   // flying: stay at this height
  p.onGround = true;
  if (statusFlag(p, "flat")) return;     // in the Plane your height is where the Plane put you
  const z = groundBelow(solidFor(game), tx, ty, p.z);
  if (z >= 0) p.z = z;
}

// Try to move one tile (dx, dy ∈ −1..1). Walking into a monster attacks it; into a door
// or lever uses it. Returns true if that took a turn.
// Moves are always to a neighbouring tile: you can't jump gaps on the map (that's what
// the 3D view is for), but you can climb up to 2 blocks, and fly anywhere while flying.
// force: attack whatever is there, friend or not (Shift held: shiftHeld()).
export const shiftHeld = () => keys.has("ShiftLeft") || keys.has("ShiftRight");
export function mapStep(game, dx, dy, { force = shiftHeld() } = {}) {
  const { zone, player: p } = game;
  settle(game);
  const S = solidFor(game);
  const flying = statusFlag(p, "flying"), swimmer = canSwim(p), flat = statusFlag(p, "flat");
  const climb = PLAYER_STEP_UP + (jumpBonus(p) >= 1 ? 1 : 0);
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const nx = tx + dx, ny = ty + dy;
  if (nx < 0 || ny < 0 || nx >= zone.w || ny >= zone.d) return stepOffEdge(game, dx, dy, nx, ny);
  p.yaw = Math.atan2(dy, dx);   // face where you're going, so the 3D view matches

  // Walking into someone talks to them (it takes no time). A ghost you haven't met (or, under the sky,
  // one standing in daylight) is just a cold spot in the way: you'd have to see it in 3D, in the dark.
  const m = creatureAt(zone, nx, ny);
  if (m && canTalk(m)) {
    if (ghostOffMap(game, m)) game.log("The air here is icy, as if someone were standing in your way. Someone you can't see from up here.", [150, 210, 240]);
    else if (flat && !isFlat(m)) game.log(`${m.name} can't hear you from the Plane. Only the Flatfolk can.`, [220, 220, 230]);
    else game.onTalk(m);
    return false;
  }
  if (m) {
    if (Math.abs(m.z - p.z) > 1.5 && !(flat && isFlat(m))) { game.log(`You can't reach the ${m.name} from here.`, [170, 170, 170]); return false; }
    const feel = attitude(game, m, p);
    if (!force && feel !== "hostile") {
      // Your follower swaps places with you; anything else not out for you stands in the way.
      if (feel === "friendly" && leaderOf(game, m) === p && swapPlaces(game, m)) {
        passTime(game, ((dx && dy ? Math.SQRT2 : 1) * STEP_TIME) / haste(p) / fleet(p));
        return true;
      }
      game.log(`The ${m.name} is in your way. (Shift + direction attacks it.)`, [170, 170, 170]);
      return false;
    }
    bumpAttack(game, m);
    passTime(game, attackTime(p));
    return true;
  }
  if (flat) return flatStep(game, dx, dy, nx, ny);

  const kind = zone.kind[nx + ny * zone.w];
  const coldBrazier = zone.get(nx, ny, FLOOR_Z) === B.BRAZIER;   // bump it to light it
  if (kind === KIND.DOOR || kind === KIND.LOCKED || kind === KIND.GATE || kind === KIND.LEVER || coldBrazier || usableAt(game, nx, ny, { legacy: false }) >= 0) {
    const used = useColumn(game, nx, ny);   // (interact.js registerUse: seconds, or true for the usual time)
    if (!used) return false;
    if (!flying && groundBelow(S, tx, ty, p.z) < 0) { p.z = -2; game.checkFloorEvents(); return true; }   // a trap opened under you
    passTime(game, typeof used === "number" ? used : USE_TIME);
    return true;
  }
  if (kind === KIND.WALL) return false;

  // A chasm you've seen, or deep water: ask before going in (step the same way again to do it).
  // Already in deep water (swimming, drowning): no asking, every press swims on.
  const target = nx + ny * zone.w;
  const inDeep = zone.kind[tx + ty * zone.w] === KIND.DEEP || hasStatus(p, "drowning");
  const drop = !flying && ((kind === KIND.HOLE && zone.holeSeen[target]) || (kind === KIND.DEEP && !swimmer && !inDeep));
  if (drop && game.confirmJump !== target) {
    game.confirmJump = target;
    game.log(kind === KIND.DEEP ? "The water is deep. Step that way again to dive in."
                                : "That's a drop into the dark. Step that way again to jump.", [255, 170, 120]);
    return false;
  }
  game.confirmJump = -1;

  // Diagonal steps can't squeeze between two blocked tiles.
  if (dx && dy && (!bodyFits(S, tx + dx, ty, p.z) || !bodyFits(S, tx, ty + dy, p.z))) return false;

  if (flying) {
    // Fly onto the highest surface there, or hover at this height over a chasm or water.
    const top = topSurface(S, nx, ny, zone.h);
    const z = top >= 0 ? top : p.z;
    if (!bodyFits(S, nx, ny, z)) { game.log("Something blocks your way.", [170, 170, 170]); return false; }
    p.x = nx + 0.5; p.y = ny + 0.5; p.z = z;
  } else {
    const z = groundBelow(S, nx, ny, p.z + climb);
    if (z >= 0) {
      p.x = nx + 0.5; p.y = ny + 0.5; p.z = z;
    } else if (bodyFits(S, nx, ny, p.z)) {
      // Nothing to stand on: a chasm (the map may have said "floor"), or deep water.
      p.x = nx + 0.5; p.y = ny + 0.5; p.z = -2;
      game.checkFloorEvents();
      return true;
    } else {
      game.log(topSurface(S, nx, ny, zone.h) > p.z ? "That's too high to climb." : "Something blocks your way.", [170, 170, 170]);
      return false;
    }
  }

  pickUpItems(game);
  if (game.checkFloorEvents()) return true;   // stairs
  const swimming = !flying && kind === KIND.DEEP;   // a swimmer, or anyone on the surface (they float)
  const wading = !flying && (kind === KIND.SHALLOW || swimming);
  if (kind === KIND.SHALLOW && !zone.flags.waterHint) {
    zone.flags.waterHint = true;
    game.log("You wade into the shallow water. It slows you down.", [110, 180, 220]);
  }
  p.wade = swimming ? 1.6 : wading ? 1 : 0;
  updateDrowning(game, p, { canSwim });   // in deep water without swimming: drowning (and its slowdown) now
  const slow = (swimming ? 0.45 : wading ? WADE_SLOWDOWN : 1) * statusSpeed(p);
  passTime(game, ((dx && dy ? Math.SQRT2 : 1) * STEP_TIME) / slow / haste(p) / fleet(p));
  return true;
}

// Your follower and you change places (a step's time). Not if it can't stand where you stand.
function swapPlaces(game, m) {
  const { zone, player: p } = game;
  const tx = Math.floor(p.x), ty = Math.floor(p.y), s = zone.stand[tx + ty * zone.w];
  if (s < 0 || statusFlag(m, "noMove") || statusFlag(m, "noAct")) return false;
  const [mx, my, mz] = [m.tx, m.ty, zone.stand[m.tx + m.ty * zone.w]];
  if (mz < 0) return false;
  Object.assign(m, { tx, ty, nx: tx, ny: ty, p: 0, x: tx + 0.5, y: ty + 0.5, z: s + (CREATURE_TYPES[m.type].hover || 0) });
  p.x = mx + 0.5; p.y = my + 0.5; p.z = mz;
  pickUpItems(game);
  return true;
}

// A step in the Plane (pressed flat; see the header). Walls stop you; levers and the like stand up out
// of it; doors and gates you slide under; chasms, pits and deep water are floor at your height.
const DOORISH = new Set([B.DOOR, B.LOCKED, B.GATE]);
function flatStep(game, dx, dy, nx, ny) {
  const { zone, player: p } = game;
  const kind = zone.kind[nx + ny * zone.w];
  if (kind === KIND.WALL) return false;
  if (kind === KIND.LEVER || zone.get(nx, ny, FLOOR_Z) === B.BRAZIER || usableAt(game, nx, ny, { legacy: false }) >= 0) {
    game.log("You can't work that from the Plane: it stands up out of it.", [220, 220, 230]);
    return false;
  }
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const wall = (x, y) => zone.kind[x + y * zone.w] === KIND.WALL;
  if (dx && dy && wall(tx + dx, ty) && wall(tx, ty + dy)) return false;   // no squeezing between two walls
  const z = planeHeight(game, nx, ny, p.z);
  if (z === null) { game.log("That's more than 2 blocks up or down: a cliff, even in the Plane.", [170, 170, 170]); return false; }
  game.confirmJump = -1;
  p.x = nx + 0.5; p.y = ny + 0.5; p.z = z; p.wade = 0;
  pickUpItems(game);
  if (game.checkFloorEvents()) return true;   // stairs
  passTime(game, ((dx && dy ? Math.SQRT2 : 1) * STEP_TIME) / statusSpeed(p) / haste(p) / fleet(p));
  return true;
}
// Where the Plane holds you on tile (x, y), coming from height z: the highest floor within 2 blocks up
// or down (a closed door or gate counts as air: you slide under it); over a chasm, a pit or deep water,
// or a column with no floor at all, your own height. null: a cliff more than 2 blocks away.
export function planeHeight(game, x, y, z) {
  const zone = game.zone, kind = zone.kind[x + y * zone.w];
  if (kind === KIND.HOLE || kind === KIND.DEEP) return z;
  const solid = (zz) => zone.solid(x, y, zz) && !DOORISH.has(zone.get(x, y, zz));
  const top = Math.floor(z + 2 + 0.01), low = Math.max(1, Math.ceil(z - 2 - 0.01));
  for (let zz = top; zz >= low; zz--) if (solid(zz - 1) && !solid(zz)) return zz;
  for (let zz = top; zz >= 0; zz--) if (solid(zz)) return null;
  return z;
}

// A step off the map's edge (TECH_DESIGN §5.1): on a surface zone, into the next span's zone at the
// matching point of the edge (zones.js tryWalkOff: within a block of your height); it takes a step's
// time there. A solid edge says why, once. Not off a corner: one side at a time.
function stepOffEdge(game, dx, dy, nx, ny) {
  const { zone, player: p } = game;
  if (zone.type !== "surface" || statusFlag(p, "flying")) return false;
  const outX = nx < 0 || nx >= zone.w, outY = ny < 0 || ny >= zone.d;
  if (outX && outY) return false;
  const side = outX ? (nx < 0 ? "w" : "e") : ny < 0 ? "n" : "s";
  p.yaw = Math.atan2(dy, dx);
  // A diagonal step lands on the diagonal row (column) across the edge, not the one you were on.
  const along = outX ? Math.max(0, Math.min(zone.d - 1, ny)) : Math.max(0, Math.min(zone.w - 1, nx));
  if (!tryWalkOff(game, side, along, { fromStand: Math.round(p.z), keepMotion: false })) return false;
  game.confirmJump = -1;
  passTime(game, ((dx && dy ? Math.SQRT2 : 1) * STEP_TIME) / haste(p) / fleet(p));
  return true;
}

// Waiting lasts half a second, or near spike traps until the instant before their next beat:
// then the map shows what's about to happen (^ rises, ▲ drops) and your next step lands right
// on the beat.
export function mapWait(game) {
  settle(game);
  if (!nearSpikes(game)) { passTime(game, WAIT_TIME); return; }
  const beatEnd = (Math.floor((game.time + 2e-3) / TICK) + 1) * TICK - 1e-3;
  passTime(game, beatEnd - game.time);
}

// Using something (drinking, equipping) takes a while; haste makes it quicker.
export function mapUseTime(game, seconds) {
  settle(game);
  passTime(game, seconds / haste(game.player));
}

// ---------------------------------------------------------------------------
// Click-to-travel. The route is planned with what the MAP knows: tiles you've seen
// that look walkable — heights unknown. It avoids water too deep to wade and chasms
// you've looked into in 3D, but a chasm you've only seen from above on the map still
// looks like floor, and the route can lead you straight into it.
// Can a planned route go through this tile? Only what the map knows, so unknown holes count as
// floor. Not through stairs (they'd take you away), spike traps (step through those yourself,
// turn by turn), or people.
function routable(game, x, y) {
  const { zone, player: p } = game;
  const i = x + y * zone.w, k = zone.kind[i];
  if (!zone.seen[i] || talkerAt(zone, x, y)) return false;
  if (k === KIND.HOLE) return !zone.holeSeen[i];
  if (k === KIND.DEEP) return canSwim(p);
  return k === KIND.FLOOR || k === KIND.DOOR || k === KIND.SHALLOW || k === KIND.BRIDGE || k === KIND.MOSAIC;
}

export function planTravel(game, gx, gy) {
  const { zone } = game;
  const w = zone.w, d = zone.d;
  if (gx < 0 || gy < 0 || gx >= w || gy >= d || !zone.seen[gx + gy * w]) return null;
  return findRoute(game, (x, y) => x === gx && y === gy, (x, y) => (x === gx && y === gy) || routable(game, x, y));
}

// Breadth-first search from where you stand to the nearest tile where `goal` is true.
function findRoute(game, goal, passable) {
  const { zone, player: p } = game;
  const w = zone.w, d = zone.d;
  const sx = Math.floor(p.x), sy = Math.floor(p.y);
  const prev = new Int32Array(w * d).fill(-1);
  prev[sx + sy * w] = sx + sy * w;
  const queue = [sx + sy * w];
  let end = -1;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head], cx = c % w, cy = (c - cx) / w;
    if (c !== sx + sy * w && goal(cx, cy)) { end = c; break; }
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cx + ox, y = cy + oy;
      if (x < 0 || y < 0 || x >= w || y >= d || prev[x + y * w] >= 0 || !passable(x, y)) continue;
      if (ox && oy && (!passable(cx + ox, cy) || !passable(cx, cy + oy))) continue;
      prev[x + y * w] = c;
      queue.push(x + y * w);
    }
  }
  if (end < 0) return null;
  const path = [];
  for (let c = end; c !== sx + sy * w; c = prev[c]) path.push([c % w, Math.floor(c / w)]);
  return path.reverse();
}

// A click-travel that ends on the border of an open edge goes one step further, into the next span
// (TECH_DESIGN §5.1). On a corner tile, the side the last step was heading for. Auto-explore never
// does this: it stops at edges.
function stepOutward(game, dx, dy) {
  const { zone, player: p } = game;
  if (zone.type !== "surface") return;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  const ways = [["e", tx === zone.w - 1, 1, 0], ["w", tx === 0, -1, 0], ["s", ty === zone.d - 1, 0, 1], ["n", ty === 0, 0, -1]]
    .filter(([side, on]) => on && zone.edges[side]);
  const way = ways.find(([, , ox, oy]) => (ox && ox === dx) || (oy && oy === dy)) || ways[0];
  if (way) mapStep(game, way[2], way[3]);
}

// Auto-explore (X on the map): head for the nearest edge of the unknown (a tile next to one
// you haven't seen), or an item you've spotted, and keep going until something interrupts.
function planExplore(game) {
  const { zone } = game;
  const w = zone.w, d = zone.d;
  const hasItem = (x, y) => zone.items.some((it) => Math.floor(it.x) === x && Math.floor(it.y) === y && !it.dropped);
  const frontier = (x, y) => {
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < d && !zone.seen[nx + ny * w]) return true;
      }
    return false;
  };
  return findRoute(game, (x, y) => hasItem(x, y) || frontier(x, y), (x, y) => routable(game, x, y));
}

export function startExplore(game) {
  const path = planExplore(game);
  if (!path) { game.log("Nothing left to explore that you can walk to from here.", [170, 170, 170]); return false; }
  const visible = new Set([...game.zone.sightings].filter(([, s]) => s.time === game.time).map(([id]) => id));
  game.travel = { path, visible, hp: game.player.hp, timer: 0, explore: true };
  return true;
}

export function startTravel(game, gx, gy) {
  const path = planTravel(game, gx, gy);
  if (!path) return false;
  const visible = new Set([...game.zone.sightings].filter(([, s]) => s.time === game.time).map(([id]) => id));
  game.travel = { path, visible, hp: game.player.hp, timer: 0 };
  return true;
}

// One step of a travel. Stops when you arrive, get hurt, attack something,
// a monster you hadn't seen comes into view, or something blocks the way.
export function travelStep(game) {
  const tr = game.travel;
  const p = game.player;
  const [x, y] = tr.path[0];
  const dx = x - Math.floor(p.x), dy = y - Math.floor(p.y);
  const there = creatureAt(game.zone, x, y), attacking = !!there && !canTalk(there);
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || !mapStep(game, dx, dy, { force: false }) || attacking) { game.travel = null; return; }
  if (game.mode !== "map") { game.travel = null; return; }
  if (Math.floor(p.x) === x && Math.floor(p.y) === y) tr.path.shift();   // (opening a door doesn't move you)
  const newcomer = [...game.zone.sightings].some(([id, s]) => s.time === game.time && !tr.visible.has(id));
  if (p.hp < tr.hp || newcomer) { game.travel = null; return; }
  if (!tr.path.length) {
    if (!tr.explore) { game.travel = null; stepOutward(game, dx, dy); return; }
    const next = planExplore(game);   // auto-explore: on to the next unknown
    if (next) tr.path = next;
    else { game.travel = null; game.log("You've explored everything you can walk to from here.", [170, 170, 170]); }
  }
}
