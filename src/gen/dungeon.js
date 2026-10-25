// Procedural dungeon levels: rooms joined by corridors, then height features, lamps, stairs,
// monsters and loot — plus one hand-made vault. Every level is checked before use
// (validateDungeonLevel) and regenerated if something important can't be reached.
//
//   generateDungeonLevel(seed, p) → Zone      p: the level's parameters (below)
//   validateDungeonLevel(zone, p) → problems  (empty: the level can be finished)
//   legacyParams(depth, runSeed) → p          the old 20-level stack, level for level
//
// p = { key, wx, wy, z, level, tier, index, count, final, theme, hasUp = true, forcedVault, vaultPool,
//       gimmicks: [id], bottom: { kind, id, uid }, encounters: [...], creatureTable, holesIn, simpleAfter = 25, name }
//   level   the difficulty every balance call reads (it was the depth)
//   final   the last level: no way down, no holes, the bottom's hall (a boss's throne)
//   hasUp   stairs up in the start room (level 1's lead to the surface entrance)
//   theme   a DUNGEON_THEMES id: room materials, how many rooms are dark, how many monsters
import { Zone, B, FLOOR_Z, ROOM_TOP, CORRIDOR_TOP, standWith } from "../world.js";
import { makeRng, noise2, distance } from "../rng.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { spawnMonster, pickMonsterType, rollElite, MONSTER_TYPES } from "../monsters.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomTreasure, randomJewel } from "../items.js";
import { pickVault, stampVault, VAULTS } from "./vaults.js";
import { planEncounters, spawnNpc, peddlerStock, bountyTarget } from "../npcs.js";
import { layoutSpikes } from "../traps.js";

// Room layout and corridor routing work on this fixed grid (the validated generator's home).
export const DUNGEON_W = 48, DUNGEON_D = 48, DUNGEON_H = 10;
const W = DUNGEON_W, D = DUNGEON_D;

// Theme id → { rooms: [{ wall, floor }], darkRate(level), count(level) }. WS10 adds more.
export const DUNGEON_THEMES = {
  legacy: {
    rooms: [
      { wall: B.STONE, floor: B.TILE },
      { wall: B.BRICK, floor: B.PLANK },
      { wall: B.MOSS, floor: B.ROCK },
      { wall: B.STONE, floor: B.PLANK },
    ],
    darkRate: (level) => Math.min(0.6, 0.12 + 0.08 * level),   // deeper levels have more dark rooms
    count: (level) => Math.min(18, 3 + level * 2),              // how many monsters
  },
};
// Gimmick id → (zone, rng, rooms, p) => void, run after monsters and loot. Each must keep
// validateDungeonLevel passing. WS10 registers flooded, lightless, flatland, haunted…
export const GIMMICKS = {};
const MAX_ATTEMPTS = 40;

export function generateDungeonLevel(seed, p) {
  const theme = DUNGEON_THEMES[p.theme || "legacy"];
  if (!theme) throw new Error(`unknown dungeon theme "${p.theme}"`);
  let zone = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const mix = (Math.imul(seed, 7919) + Math.imul(p.z, 104729) + Math.imul(attempt, 2654435761)) >>> 0;
    const rng = makeRng(mix);
    const cosmetic = makeRng((mix ^ 0x5eedc05e) >>> 0);   // creature looks: never touches the layout
    zone = buildLevel(rng, cosmetic, seed, p, theme, attempt >= (p.simpleAfter ?? 25));   // after many failures, skip risky features
    zone.attempts = attempt + 1;
    if (validateDungeonLevel(zone, p).length === 0) return zone;
  }
  return zone;   // test.html flags this; it hasn't happened in testing
}

function buildLevel(rng, cosmetic, seed, p, theme, simple) {
  const depth = p.level;   // (the balance curves below still call it depth: it is the level)
  const final = !!p.final;
  const f = new Zone({ key: p.key, wx: p.wx, wy: p.wy, z: p.z, type: "dungeon", level: p.level, tier: p.tier ?? 1, seed,
                       w: W, d: D, h: DUNGEON_H, name: p.name || "" });
  f.dungeonIndex = p.index ?? p.z;     // which level of its dungeon this is (1 = the top one)
  f.dungeonLevels = p.count ?? null;   // and how many levels the dungeon has
  f.final = final;
  f.hasBelow = !final;
  f.blocks.fill(B.ROCK);
  const roomAt = new Int16Array(W * D).fill(-1);   // room interiors
  const ringAt = new Int16Array(W * D).fill(-1);   // room walls
  const blocked = new Uint8Array(W * D);            // corridors can't go here
  for (let i = 0; i < W; i++) { blocked[i] = blocked[i + (D - 1) * W] = 1; }
  for (let j = 0; j < D; j++) { blocked[j * W] = blocked[W - 1 + j * W] = 1; }

  // --- 1. The vault goes in first, so rooms and corridors keep clear of it.
  const vault = pickVault(rng, p);
  let vaultRect = null, entrance = null;
  for (let tries = 0; tries < 60 && !vaultRect; tries++) {
    const vx = rng.int(2, W - vault.w - 2), vy = rng.int(2, D - vault.d - 4);
    vaultRect = { x0: vx, y0: vy, x1: vx + vault.w - 1, y1: vy + vault.d - 1 };
    entrance = stampVault(f, vault, vx, vy, rng, { cosmetic });
  }
  for (let y = vaultRect.y0 - 1; y <= vaultRect.y1 + 1; y++)
    for (let x = vaultRect.x0 - 1; x <= vaultRect.x1 + 1; x++) blocked[x + y * W] = 1;
  const vaultDoor = { x: entrance.x + entrance.dx, y: entrance.y + entrance.dy };
  blocked[vaultDoor.x + vaultDoor.y * W] = 0;

  // --- 2. Rooms: random rectangles that don't touch each other or the vault.
  // One or two big halls go in first (they hold lakes and chasms), then ordinary rooms.
  const rooms = [];
  const halls = rng.int(1, 2);
  const target = rng.int(8, 11);
  const clear = (x0, y0, x1, y1, r, gap) => x0 - gap > r.x1 || x1 + gap < r.x0 || y0 - gap > r.y1 || y1 + gap < r.y0;
  for (let tries = 0; tries < 600 && rooms.length < target; tries++) {
    const hall = rooms.length < halls && tries < 200;
    const w = hall ? rng.int(12, 16) : rng.int(5, 10), d = hall ? rng.int(10, 13) : rng.int(5, 9);
    const x0 = rng.int(2, W - w - 2), y0 = rng.int(2, D - d - 2);
    const x1 = x0 + w - 1, y1 = y0 + d - 1;
    if (!rooms.every((r) => clear(x0, y0, x1, y1, r, 3)) || !clear(x0, y0, x1, y1, vaultRect, 4)) continue;
    rooms.push({ id: rooms.length, x0, y0, x1, y1, cx: (x0 + x1) >> 1, cy: (y0 + y1) >> 1,
                 theme: rng.pick(theme.rooms), doors: [], dark: false, hall });
  }
  for (const r of rooms) {
    for (let y = r.y0 - 1; y <= r.y1 + 1; y++) {
      for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
        const inside = x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
        if (inside) {
          roomAt[x + y * W] = r.id;
          f.set(x, y, FLOOR_Z - 1, r.theme.floor);
          for (let z = FLOOR_Z; z < ROOM_TOP; z++) f.set(x, y, z, B.AIR);
        } else {
          ringAt[x + y * W] = r.id;
          for (let z = FLOOR_Z; z < ROOM_TOP; z++) f.set(x, y, z, r.theme.wall);
          const corner = (x === r.x0 - 1 || x === r.x1 + 1) && (y === r.y0 - 1 || y === r.y1 + 1);
          if (corner) blocked[x + y * W] = 1;
        }
      }
    }
  }

  // --- 3. Corridors: a minimum spanning tree over the rooms, plus a few extra links for loops.
  const jitter = new Float32Array(W * D).map(() => rng() * 0.6);
  const corridor = new Uint8Array(W * D);
  const dig = (path) => {
    for (const c of path) {
      if (roomAt[c] >= 0) continue;
      const x = c % W, y = (c - x) / W;
      if (ringAt[c] >= 0) {
        const r = rooms[ringAt[c]];
        if (!r.doors.some((d) => d.x === x && d.y === y)) r.doors.push({ x, y });
      } else corridor[c] = 1;
      for (let z = FLOOR_Z; z < CORRIDOR_TOP; z++) f.set(x, y, z, B.AIR);
    }
  };
  const route = (ax, ay, bx, by) => findPath(ax, ay, bx, by, blocked, ringAt, corridor, jitter);

  const inTree = [0];
  const edges = [];
  while (inTree.length < rooms.length) {
    let best = null;
    for (const a of inTree)
      for (const r of rooms)
        if (!inTree.includes(r.id)) {
          const dist = Math.abs(rooms[a].cx - r.cx) + Math.abs(rooms[a].cy - r.cy);
          if (!best || dist < best.dist) best = { a, b: r.id, dist };
        }
    inTree.push(best.b);
    edges.push([best.a, best.b]);
  }
  for (let k = 0; k < rooms.length; k++) {
    const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1);
    if (a !== b && rng.chance(0.3)) edges.push([a, b]);
  }
  for (const [a, b] of edges) dig(route(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy));

  // The vault connects to its nearest room.
  const nearest = rooms.reduce((best, r) =>
    distance(r.cx - vaultDoor.x, r.cy - vaultDoor.y) < distance(best.cx - vaultDoor.x, best.cy - vaultDoor.y) ? r : best);
  dig(route(vaultDoor.x, vaultDoor.y, nearest.cx, nearest.cy));

  // --- 4. Doors in some doorways (only where there's a proper frame on both sides).
  for (const r of rooms) {
    for (const d of r.doors) {
      const sideWall = d.x === r.x0 - 1 || d.x === r.x1 + 1;
      const [ax, ay, bx, by] = sideWall ? [d.x, d.y - 1, d.x, d.y + 1] : [d.x - 1, d.y, d.x + 1, d.y];
      if (f.get(ax, ay, FLOOR_Z) && f.get(bx, by, FLOOR_Z) && rng.chance(0.4)) {
        f.set(d.x, d.y, FLOOR_Z, B.DOOR);
        f.set(d.x, d.y, FLOOR_Z + 1, B.DOOR);
      }
    }
  }

  // --- 5. Start room, with the stairs back up (on level 1 they lead to the surface entrance).
  // (The old first floor's light well open to the sky is gone: the ground above isn't open.)
  const start = rng.pick(rooms.filter((r) => !r.hall)) || rooms[0];
  if (p.hasUp === false) {
    f.spawn = { x: start.cx + 0.5, y: start.cy + 0.5, z: FLOOR_Z, yaw: rng() * Math.PI * 2 };
  } else {
    f.set(start.cx, start.cy, FLOOR_Z - 1, B.STAIRS_UP);
    f.upStairs = { x: start.cx, y: start.cy };
    f.spawn = { x: start.cx + 1.5, y: start.cy + 0.5, z: FLOOR_Z, yaw: 0 };   // beside them, facing away
  }

  // --- 6. Height features, so the map's flat picture can mislead.
  // Cells next to doorways stay clear so rooms can't be sealed off by accident.
  // The last level has no holes at all (pits, chasms, deep water): there's nowhere lower to fall.
  const nearDoor = (r, x, y) => r.doors.some((d) => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2);
  if (!simple) {
    for (const r of rooms) {
      if (r === start) continue;
      if (r.hall && final) { addPillars(f, r, nearDoor); continue; }
      if (r.hall) {
        if (depth >= 2 && rng.chance(0.45)) addBigChasm(f, rng, r, nearDoor, depth);
        else addLake(f, rng, r, nearDoor, depth);
        continue;
      }
      const roll = rng();
      if (roll < 0.2) addPillars(f, r, nearDoor);
      else if (roll < 0.34) addCrates(f, rng, r, nearDoor);
      else if (roll < 0.47) addPlatform(f, rng, r, nearDoor);
      else if (roll < 0.6) addLedge(f, rng, r, nearDoor);
      else if (roll < 0.7) { if (!final) addPits(f, rng, r, nearDoor); }
      else if (roll < 0.84) addClimb(f, rng, r, nearDoor, depth);
      else if (depth >= 2 && !final && roll < 0.92) addChasm(f, rng, r, nearDoor);
      else if (depth >= 2 && roll >= 0.92 && roll < 0.98) addSpikeBand(f, rng, r, nearDoor);
    }
  }

  // --- 7. Lamps on the walls. Deeper levels have more dark rooms.
  for (const r of rooms) {
    r.dark = r !== start && !r.hall && rng.chance(theme.darkRate(depth));
    if (r.dark) continue;
    const spots = [];
    for (let x = r.x0; x <= r.x1; x++) spots.push([x, r.y0 - 1], [x, r.y1 + 1]);
    for (let y = r.y0; y <= r.y1; y++) spots.push([r.x0 - 1, y], [r.x1 + 1, y]);
    rng.shuffle(spots);
    let placed = 0;
    const wanted = r.hall ? rng.int(3, 5) : rng.int(1, 3);   // big halls need more light to see across
    for (const [x, y] of spots) {
      if (placed >= wanted) break;
      if (f.get(x, y, FLOOR_Z + 2) !== r.theme.wall || r.doors.some((d) => d.x === x && d.y === y)) continue;
      f.set(x, y, FLOOR_Z + 2, B.LAMP);
      placed++;
    }
  }

  // --- 7½. The secret room (see addSecretRoom).
  addSecretRoom(f, rng, rooms, start, roomAt, ringAt, corridor, blocked, depth);

  f.rooms = rooms;
  f.vault = { ...vaultRect, name: vault.name, entrance, hint: vault.hint };
  f.refresh();

  // --- 8. Stairs down in the room that's the longest walk from the start — always on
  // plain dry ground: not in or beside water, not on a bridge or island, not next to a drop.
  const dist = reachable(standWith(f, "all"), W, D, start.cx, start.cy, PLAYER_STEP_UP, PLAYER_DROP);
  const dry = (x, y) => {
    if (f.stand[x + y * W] !== FLOOR_Z || f.get(x, y, 0) !== B.ROCK || f.get(x, y, FLOOR_Z - 1) === B.STAIRS_UP) return false;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const g = f.get(x + ox, y + oy, FLOOR_Z - 1);
        if (!g || g === B.WATER_SHALLOW || g === B.WATER_DEEP) return false;
      }
    return true;
  };
  let stairsRoom = null, stairsSpots = [], far = -1;
  for (const r of f.stairs ? [] : rooms) {   // (a guardian's hall brings its own stairs)
    if (r === start) continue;
    const spots = interior(r).filter(([x, y]) => dist[x + y * W] >= 0 && dry(x, y) && !nearDoor(r, x, y));
    const reach = Math.max(-1, ...spots.map(([x, y]) => dist[x + y * W]));
    if (reach > far) { far = reach; stairsRoom = r; stairsSpots = spots; }
  }
  if (stairsRoom && !final && !f.stairs) {   // the last floor has no way down
    const [sx, sy] = rng.pick(stairsSpots);
    f.set(sx, sy, FLOOR_Z - 1, B.STAIRS);
    f.stairs = { x: sx, y: sy };
  }

  // --- 9. Sometimes: a locked treasure room, with its key somewhere else.
  const lockable = rooms.filter((r) => r !== start && r !== stairsRoom && r.doors.length > 0 && r.doors.length <= 2);
  if (rng.chance(0.45) && lockable.length) {
    const r = rng.pick(lockable);
    for (const d of r.doors) { f.set(d.x, d.y, FLOOR_Z, B.LOCKED); f.set(d.x, d.y, FLOOR_Z + 1, B.LOCKED); }
    placeItem(f, rng, r, randomPotion(rng));
    placeItem(f, rng, r, randomTreasure(rng, depth));
    placeItem(f, rng, rng.pick(rooms.filter((o) => o !== r)), { kind: "key" });
    r.locked = true;
  }

  // --- 10. Monsters (never in the start room) and loot.
  f.refresh();
  // Which kinds turn up depends on the level (see MONSTER_TYPES' depths); a few are elites.
  const count = final ? 10 : theme.count(depth);
  const taken = new Set();
  for (let k = 0; k < count; k++) {
    const r = rng.pick(rooms.filter((o) => o !== start));
    const spots = interior(r).filter(([x, y]) => f.stand[x + y * W] >= 0 && !taken.has(x + y * W) &&
      distance(x - start.cx, y - start.cy) > 8);
    if (!spots.length) continue;
    const [x, y] = rng.pick(spots);
    taken.add(x + y * W);
    f.monsters.push(spawnMonster(pickMonsterType(rng, depth), x, y, f.stand[x + y * W], rng.chance(0.5) ? "idle" : "wander",
                                 depth, rollElite(rng, depth), cosmetic));
  }
  // Loot lying around: a few potions and scrolls, a piece of gear (sometimes two), usually a few
  // throwing knives, once in a while a strength crystal, and from floor 3 now and then a ring
  // or an amulet. Not much gold: a pile or two.
  for (let k = rng.int(2, 3); k > 0; k--) placeItem(f, rng, rng.pick(rooms), randomPotion(rng));
  for (let k = rng.int(1, 2); k > 0; k--) placeItem(f, rng, rng.pick(rooms), randomScroll(rng));
  for (let k = rng.chance(0.1) ? 2 : 1; k > 0; k--) placeItem(f, rng, rng.pick(rooms.filter((o) => o !== start)), randomEquipment(rng, depth));
  if (rng.chance(0.08)) placeItem(f, rng, rng.pick(rooms.filter((o) => o !== start)), { kind: "strength" });
  if (depth >= 3 && rng.chance(0.3)) placeItem(f, rng, rng.pick(rooms.filter((o) => o !== start)), randomJewel(rng, depth));
  if (rng.chance(0.6)) placeItem(f, rng, rng.pick(rooms), { kind: "knife", count: rng.int(2, 4) });
  if (rng.chance(0.75)) placeItem(f, rng, rng.pick(rooms), { kind: "bomb", count: rng.chance(0.3) ? 2 : 1 });
  for (let k = rng.int(1, 2); k > 0; k--) placeItem(f, rng, rng.pick(rooms), { kind: "gold", amount: rng.int(5, 10) + depth });

  // --- 10½. The site's gimmicks (none on the legacy stack).
  for (const id of p.gimmicks || []) GIMMICKS[id](f, rng, rooms, p);

  // --- 11. The people of this level (the site plans who's where; for the legacy stack, npcs.js).
  placeEncounters(f, rng, cosmetic, rooms, start, depth, p.encounters || []);

  // --- 12. The Rune Lever room's record, in some other room.
  if (f.leverRecord) addLeverRecord(f, rng, rooms);
  return f;
}

// The record of which levers in the Rune Lever room are the right ones, left to right as you
// face them. It goes in one of the rooms farther from the vault, as one of:
//   a mural: a row of carved panels in a wall, one per lever, at eye height. In the dark the
//     carvings glow faintly, and the right ones blaze. Read left to right, facing the wall.
//   a floor record: a row of mosaic tiles between two white ones, gold for a right lever and red
//     for a wrong one. Clear on the map (read west to east); faded at eye level.
function addLeverRecord(f, rng, rooms) {
  const right = f.leverRecord, n = right.length, v = f.vault;
  const vx = (v.x0 + v.x1) / 2, vy = (v.y0 + v.y1) / 2;
  const far = [...rooms].filter((r) => !r.locked).sort((a, b) => distance(b.cx - vx, b.cy - vy) - distance(a.cx - vx, a.cy - vy));
  const order = [...rng.shuffle(far.slice(0, Math.ceil(far.length / 2))), ...far.slice(Math.ceil(far.length / 2))];
  const kinds = rng.chance(0.5) ? ["mural", "floor"] : ["floor", "mural"];
  for (const kind of kinds)
    for (const r of order)
      if (kind === "mural" ? placeMural(f, rng, r, right) : placeFloorRecord(f, rng, r, right)) {
        f.leverRecordAt = { kind, room: r.id };
        f.refresh();
        return;
      }
}

// A run of 2n+1 wall tiles along one side of the room (panels on every other one).
function placeMural(f, rng, r, right) {
  const len = 2 * right.length + 1;
  // Each side: its wall tiles from left to right as you stand in the room facing it, and the
  // floor tile in front of each.
  const xs = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const sides = [
    xs(r.x0, r.x1).map((x) => [x, r.y0 - 1, x, r.y0]),              // north wall: west to east
    xs(r.x0, r.x1).reverse().map((x) => [x, r.y1 + 1, x, r.y1]),    // south wall: east to west
    xs(r.y0, r.y1).reverse().map((y) => [r.x0 - 1, y, r.x0, y]),    // west wall: south to north
    xs(r.y0, r.y1).map((y) => [r.x1 + 1, y, r.x1, y]),              // east wall: north to south
  ];
  const ok = ([x, y, ix, iy]) => f.get(x, y, FLOOR_Z) === r.theme.wall && f.get(x, y, FLOOR_Z + 1) === r.theme.wall &&
    !f.secretWalls.has(x + y * W) && f.stand[ix + iy * W] === FLOOR_Z;
  const runs = [];
  for (const side of sides)
    for (let s = 0; s + len <= side.length; s++) if (side.slice(s, s + len).every(ok)) runs.push(side.slice(s, s + len));
  if (!runs.length) return false;
  const run = rng.pick(runs);
  right.forEach((good, k) => { const [x, y] = run[1 + 2 * k]; f.set(x, y, FLOOR_Z + 1, good ? B.MURAL_LIT : B.MURAL); });
  return true;
}

// A row of n+2 floor tiles, west to east, somewhere in the room.
function placeFloorRecord(f, rng, r, right) {
  const len = right.length + 2, spots = [];
  const plain = (x, y) => f.stand[x + y * W] === FLOOR_Z && f.get(x, y, FLOOR_Z - 1) === r.theme.floor && !isStairs(f, x, y) &&
    !r.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
  for (let y = r.y0 + 1; y < r.y1; y++)
    for (let x = r.x0; x + len - 1 <= r.x1; x++)
      if (Array.from({ length: len }, (_, k) => plain(x + k, y)).every(Boolean)) spots.push([x, y]);
  if (!spots.length) return false;
  const [x, y] = rng.pick(spots);
  const tiles = [B.MOSAIC_WHITE, ...right.map((good) => (good ? B.MOSAIC_GOLD : B.MOSAIC_RED)), B.MOSAIC_WHITE];
  tiles.forEach((b, k) => f.set(x + k, y, FLOOR_Z - 1, b));
  return true;
}

// ---------------------------------------------------------------------------
// People. Each stands somewhere open in a room of its own, not crowding a doorway, with any
// monsters nearby shooed away. Some bring extras: Pell his pack, Rook a quarry somewhere
// else on the floor, Lio a cell (and a lever in another room's wall), Brann a skull below.
function placeEncounters(f, rng, cosmetic, rooms, start, depth, list) {
  const used = new Set();
  const plain = (x, y) => {
    const g = f.get(x, y, FLOOR_Z - 1);
    return f.stand[x + y * W] === FLOOR_Z && g !== B.SPIKES && g !== B.WATER_SHALLOW && g !== B.WATER_DEEP && !isStairs(f, x, y);
  };
  const free = (x, y) => plain(x, y) && !f.npcs.some((n) => n.tx === x && n.ty === y) &&
    !f.items.some((it) => Math.floor(it.x) === x && Math.floor(it.y) === y);
  const spotIn = (r) => {
    const spots = interior(r).filter(([x, y]) => free(x, y) && !r.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 2) &&
      [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => f.stand[x + ox + (y + oy) * W] >= 0));
    return spots.length ? rng.pick(spots) : null;
  };
  const findSpot = () => {
    for (const r of rng.shuffle(rooms.filter((o) => o !== start && !o.locked && !used.has(o)))) {
      const spot = spotIn(r);
      if (!spot) continue;
      used.add(r);
      f.monsters = f.monsters.filter((m) => distance(m.tx - spot[0], m.ty - spot[1]) > 3);
      return spot;
    }
    return null;
  };
  const place = (type, state = {}) => {
    const spot = findSpot();
    if (!spot) return null;
    const n = spawnNpc(type, spot[0], spot[1], FLOOR_Z, depth, state);
    f.npcs.push(n);
    return n;
  };

  for (const e of list) {
    if (e.item === "skull") {
      placeItem(f, rng, rng.pick(rooms.filter((o) => o !== start)), { kind: "quest", id: "skull", name: "Brann's skull", info: "A ghost on the floor above wants this back." });
    } else if (e.npc === "pell") place("pell", { stock: peddlerStock(rng, depth) });
    else if (e.npc === "shrine") place("shrine", { cost: 40 + 6 * depth });
    else if (e.npc === "rook") {
      const rook = place("rook");
      if (!rook) continue;
      const b = bountyTarget(rng, depth), lair = findSpot();   // the quarry gets a room of its own
      const m = lair ? spawnMonster(b.type, lair[0], lair[1], FLOOR_Z, "wander", depth, b.elite, cosmetic) : f.monsters[0];
      if (!m) { f.npcs.splice(f.npcs.indexOf(rook), 1); continue; }
      if (lair) f.monsters.push(m);
      m.bounty = true;
      Object.assign(rook.state, { target: m.id, targetName: m.name });
    } else if (e.npc === "lio") placePrisoner(f, rng, rooms, start, depth, used);
    else place(e.npc);
  }
}

// Lio's cell: the 2×2 corner of a room, closed off by bars; the lever is in another room's wall.
function placePrisoner(f, rng, rooms, start, depth, used) {
  const okRooms = rooms.filter((o) => o !== start && !o.locked && !o.hall && !used.has(o) && o.x1 - o.x0 >= 4 && o.y1 - o.y0 >= 4);
  for (const r of rng.shuffle(okRooms)) {
    const corners = [[r.x0, r.y0, 1, 1], [r.x1, r.y0, -1, 1], [r.x0, r.y1, 1, -1], [r.x1, r.y1, -1, -1]];
    for (const [cx, cy, sx, sy] of rng.shuffle(corners)) {
      const cell = [[cx, cy], [cx + sx, cy], [cx, cy + sy], [cx + sx, cy + sy]];
      const bars = [[cx + 2 * sx, cy], [cx + 2 * sx, cy + sy], [cx, cy + 2 * sy], [cx + sx, cy + 2 * sy], [cx + 2 * sx, cy + 2 * sy]];
      const tiles = [...cell, ...bars];
      if (!tiles.every(([x, y]) => f.stand[x + y * W] === FLOOR_Z && f.get(x, y, FLOOR_Z - 1) === r.theme.floor)) continue;
      if (r.doors.some((d) => tiles.some(([x, y]) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1))) continue;
      const lever = leverSpot(f, rng, rooms, r);
      if (!lever) return;
      for (const [x, y] of bars) for (let z = FLOOR_Z; z <= FLOOR_Z + 2; z++) f.set(x, y, z, B.GATE);
      const inside = (x, y) => tiles.some(([tx, ty]) => tx === x && ty === y);
      f.monsters = f.monsters.filter((m) => !inside(m.tx, m.ty));
      f.items = f.items.filter((it) => !inside(Math.floor(it.x), Math.floor(it.y)));
      const gate = bars.flatMap(([x, y]) => [[x, y, FLOOR_Z], [x, y, FLOOR_Z + 1], [x, y, FLOOR_Z + 2]]);
      f.set(lever.x, lever.y, FLOOR_Z + 1, B.LEVER);
      f.links.set(f.index(lever.x, lever.y, FLOOR_Z + 1), { action: "free", cells: gate });
      f.npcs.push(spawnNpc("lio", cx, cy, FLOOR_Z, depth, { lever: [lever.x, lever.y], leverFront: lever.front }));
      used.add(r);
      f.refresh();
      return;
    }
  }
}

// A plain stretch of some other room's wall, with floor in front of it, for a lever.
function leverSpot(f, rng, rooms, not) {
  for (const o of rng.shuffle(rooms.filter((r) => r !== not && !r.locked))) {
    const spots = [];
    for (let x = o.x0 + 1; x < o.x1; x++) spots.push([x, o.y0 - 1, x, o.y0], [x, o.y1 + 1, x, o.y1]);
    for (let y = o.y0 + 1; y < o.y1; y++) spots.push([o.x0 - 1, y, o.x0, y], [o.x1 + 1, y, o.x1, y]);
    const ok = spots.filter(([x, y, fx, fy]) => f.get(x, y, FLOOR_Z) === o.theme.wall && f.get(x, y, FLOOR_Z + 1) === o.theme.wall &&
      !o.doors.some((d) => d.x === x && d.y === y) && !f.secretWalls.has(x + y * W) && f.stand[fx + fy * W] === FLOOR_Z);
    if (ok.length) { const [x, y, fx, fy] = rng.pick(ok); return { x, y, front: [fx, fy] }; }
  }
  return null;
}

// A band of spike floor across the middle of a room (doorways left clear).
function addSpikeBand(f, rng, r, nearDoor) {
  if (r.y1 - r.y0 < 4 || r.x1 - r.x0 < 3) return;
  const vertical = rng.chance(0.5) && r.x1 - r.x0 >= 4;
  const cells = [];
  if (vertical) {
    const mx = (r.x0 + r.x1) >> 1;
    for (let y = r.y0; y <= r.y1; y++) for (let x = mx; x <= mx + 1; x++) if (!nearDoor(r, x, y)) cells.push([x, y]);
  } else {
    const my = (r.y0 + r.y1) >> 1;
    for (let x = r.x0; x <= r.x1; x++) for (let y = my; y <= my + 1; y++) if (!nearDoor(r, x, y)) cells.push([x, y]);
  }
  if (cells.length < 4) return;
  layoutSpikes(f, cells, rng);
  r.spikes = true;
}

// ---------------------------------------------------------------------------
// Room features

function* interiorGen(r) { for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) yield [x, y]; }
const interior = (r) => [...interiorGen(r)];

function addPillars(f, r, nearDoor) {
  if (r.x1 - r.x0 < 5 || r.y1 - r.y0 < 4) return;
  for (const [x, y] of [[r.x0 + 1, r.y0 + 1], [r.x1 - 1, r.y0 + 1], [r.x0 + 1, r.y1 - 1], [r.x1 - 1, r.y1 - 1]]) {
    if (nearDoor(r, x, y)) continue;
    for (let z = FLOOR_Z; z < ROOM_TOP; z++) f.set(x, y, z, B.COLUMN);
  }
}

function addCrates(f, rng, r, nearDoor) {
  const edge = interior(r).filter(([x, y]) => (x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1) && !nearDoor(r, x, y));
  rng.shuffle(edge);
  for (const [x, y] of edge.slice(0, rng.int(2, 5))) {
    f.set(x, y, FLOOR_Z, B.CRATE);
    if (rng.chance(0.3)) f.set(x, y, FLOOR_Z + 1, B.CRATE);
  }
}

// A raised dais (+1): easy to hop onto, monsters can climb it too.
function addPlatform(f, rng, r, nearDoor) {
  const pw = rng.int(2, 3), pd = rng.int(2, 3);
  if (r.x1 - r.x0 < pw + 2 || r.y1 - r.y0 < pd + 2) return;
  const x0 = rng.int(r.x0 + 1, r.x1 - pw), y0 = rng.int(r.y0 + 1, r.y1 - pd);
  for (let y = y0; y < y0 + pd; y++) for (let x = x0; x < x0 + pw; x++) if (nearDoor(r, x, y)) return;
  for (let y = y0; y < y0 + pd; y++) for (let x = x0; x < x0 + pw; x++) f.set(x, y, FLOOR_Z, r.theme.floor);
  if (rng.chance(0.4)) f.items.push(makeItem(randomPotion(rng), x0 + 0.5, y0 + 0.5, FLOOR_Z + 1));
}

// A ledge two blocks up along one wall — too high to jump straight onto, so a crate stands
// in front of it as a step up (monsters can climb it that way too).
function addLedge(f, rng, r, nearDoor) {
  const side = rng.int(0, 3);
  const cells = [];
  for (const [x, y] of interior(r)) {
    const onSide = [y === r.y0, y === r.y1, x === r.x0, x === r.x1][side];
    if (onSide && !nearDoor(r, x, y)) cells.push([x, y]);
  }
  if (cells.length < 3) return;
  for (const [x, y] of cells) { f.set(x, y, FLOOR_Z, r.theme.wall); f.set(x, y, FLOOR_Z + 1, r.theme.floor); }
  const [ix, iy] = [[0, 1], [0, -1], [1, 0], [-1, 0]][side];   // from the wall into the room
  const [sx, sy] = cells[Math.floor(cells.length / 2)];
  f.set(sx + ix, sy + iy, FLOOR_Z, B.CRATE);
  if (rng.chance(0.5)) { const [x, y] = rng.pick(cells); f.items.push(makeItem(randomPotion(rng), x + 0.5, y + 0.5, FLOOR_Z + 2)); }
}

// A tall room: floating platforms climb around the walls, each a block higher than the
// last, to a lamp-lit perch with treasure. Pure 3D jumping — map moves can't cross the gaps.
function addClimb(f, rng, r, nearDoor, depth) {
  const ax0 = r.x0 + 1, ax1 = r.x1 - 1, ay0 = r.y0 + 1, ay1 = r.y1 - 1;   // one tile in from the walls
  const ring = [];
  for (let x = ax0; x <= ax1; x++) ring.push([x, ay0]);
  for (let y = ay0 + 1; y <= ay1; y++) ring.push([ax1, y]);
  for (let x = ax1 - 1; x >= ax0; x--) ring.push([x, ay1]);
  for (let y = ay1 - 1; y > ay0; y--) ring.push([ax0, y]);
  if (ring.length < 15) return;
  const first = rng.int(0, ring.length - 1);
  const steps = [0, 1, 2, 3, 4].map((k) => ring[(first + k * 3) % ring.length]);   // 2-tile gaps between them
  // (No doorway check: the steps sit two tiles in from the walls; the floor validator
  // still rejects any layout where they'd cut off part of the room.)

  // Open the ceiling up to just under the top of the world (walls go up with it).
  for (let y = r.y0 - 1; y <= r.y1 + 1; y++)
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
      const inside = x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
      for (let z = ROOM_TOP; z < f.h - 1; z++) f.set(x, y, z, inside ? B.AIR : r.theme.wall);
    }
  steps.forEach(([x, y], k) => f.set(x, y, FLOOR_Z + k, B.PLANK));   // wooden, to stand out from the walls; tops at +1 … +5
  const [tx, ty] = steps[4];
  f.items.push(makeItem(randomTreasure(rng, depth), tx + 0.5, ty + 0.5, FLOOR_Z + 5));
  // A lamp on the nearest wall, up high, so you can see what's waiting.
  const [wx, wy] = [[r.x0 - 1, ty], [r.x1 + 1, ty], [tx, r.y0 - 1], [tx, r.y1 + 1]]
    .sort((a, b) => distance(a[0] - tx, a[1] - ty) - distance(b[0] - tx, b[1] - ty))[0];
  f.set(wx, wy, FLOOR_Z + 5, B.LAMP);
  r.climb = true;
}

// Stepping stones: one-block pillars rising out of a chasm or a lake, about three tiles
// apart, leading from a shore tile toward a target. Cross them by jumping in 3D (or fly).
function steppingStones(f, rng, from, to, isGap) {
  const [fx, fy] = from, [tx, ty] = to;
  const n = Math.max(2, Math.round(distance(tx - fx, ty - fy) / 3));
  for (let k = 1; k < n; k++) {
    const x = Math.round(fx + ((tx - fx) * k) / n), y = Math.round(fy + ((ty - fy) * k) / n);
    if (!isGap(x, y)) continue;
    const high = rng.chance(0.35);   // some stand a block taller
    for (let z = 0; z <= FLOOR_Z - 1 + (high ? 1 : 0); z++) f.set(x, y, z, B.ROCK);
  }
}

// Walk out from (x, y) in a direction until leaving the gap: the shore tile there.
function shoreFrom(r, x, y, dx, dy, isGap) {
  for (let k = 1; k < 20; k++) {
    const sx = x + dx * k, sy = y + dy * k;
    if (sx < r.x0 || sx > r.x1 || sy < r.y0 || sy > r.y1) return null;
    if (!isGap(sx, sy)) return [sx, sy];
  }
  return null;
}

// Holes in the floor. Fall in and you land on the next floor down.
function addPits(f, rng, r, nearDoor) {
  for (let k = rng.int(1, 2); k > 0; k--) {
    const s = rng.int(1, 2);
    if (r.x1 - r.x0 < s + 2 || r.y1 - r.y0 < s + 2) return;
    const x0 = rng.int(r.x0 + 1, r.x1 - s), y0 = rng.int(r.y0 + 1, r.y1 - s);
    let ok = true;
    for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) if (nearDoor(r, x, y)) ok = false;
    if (!ok) continue;
    for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) for (let z = 0; z < FLOOR_Z; z++) f.set(x, y, z, B.AIR);
  }
}

// A chasm splitting the room, crossed by one narrow plank bridge.
function addChasm(f, rng, r, nearDoor) {
  const horizontal = rng.chance(0.5);
  const [a0, a1, b0, b1] = horizontal ? [r.x0, r.x1, r.y0, r.y1] : [r.y0, r.y1, r.x0, r.x1];
  if (b1 - b0 < 5 || a1 - a0 < 3) return;
  const mid = (b0 + b1) >> 1;
  const bridge = rng.int(a0 + 1, a1 - 1);
  const cells = [];
  for (let b = mid; b <= mid + 1; b++)
    for (let a = a0; a <= a1; a++) {
      const [x, y] = horizontal ? [a, b] : [b, a];
      if (nearDoor(r, x, y) && a !== bridge) return;
      cells.push([x, y, a === bridge]);
    }
  for (const [x, y, isBridge] of cells) {
    f.set(x, y, 0, B.AIR);
    f.set(x, y, FLOOR_Z - 1, isBridge ? B.PLANK : B.AIR);
  }
}

// A blobby region filling the middle of a hall: an ellipse roughened with noise.
// Leaves a dry rim along the walls and the ground near doorways untouched.
function blob(rng, r, nearDoor, inner, outer) {
  const cx = (r.x0 + r.x1 + 1) / 2, cy = (r.y0 + r.y1 + 1) / 2;
  const rx = (r.x1 - r.x0 + 1) / 2 - 1, ry = (r.y1 - r.y0 + 1) / 2 - 1;
  const ns = rng() * 1000;
  const core = [], edge = [];
  for (const [x, y] of interior(r)) {
    if (x === r.x0 || x === r.x1 || y === r.y0 || y === r.y1 || nearDoor(r, x, y)) continue;
    const e = distance((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + (noise2(x * 0.5 + ns, y * 0.5) - 0.5) * 0.4;
    if (e < inner) core.push([x, y]);
    else if (e < outer) edge.push([x, y]);
  }
  return { core, edge, cx: Math.floor(cx), cy: Math.floor(cy) };
}

// Planks across the hole or water along a line through (x, y), in both directions.
function bridgeLine(f, r, x, y, dx, dy, isGap) {
  for (const s of [1, -1])
    for (let bx = x, by = y; bx >= r.x0 && bx <= r.x1 && by >= r.y0 && by <= r.y1; bx += dx * s, by += dy * s)
      if (isGap(bx, by)) f.set(bx, by, FLOOR_Z - 1, B.PLANK);
}

// A lake: deep water in the middle, a shallow shore you can wade through, a dry rim.
// Deep water is like a chasm: fall in and you're swept down a floor. A bridge crosses
// it — or an island holds treasure, reached by a bridge or by stepping stones.
function addLake(f, rng, r, nearDoor, depth) {
  const { core, edge, cx, cy } = blob(rng, r, nearDoor, 0.6, 1.0);
  for (const [x, y] of core) { f.set(x, y, 0, B.WATER_DEEP); f.set(x, y, FLOOR_Z - 1, B.WATER_DEEP); }
  for (const [x, y] of edge) f.set(x, y, FLOOR_Z - 1, B.WATER_SHALLOW);
  if (core.length < 6) return;
  const isDeep = (x, y) => f.get(x, y, FLOOR_Z - 1) === B.WATER_DEEP;
  const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  if (core.length >= 16 && isDeep(cx, cy) && isDeep(cx - 1, cy - 1)) {
    for (const [x, y] of [[cx, cy], [cx - 1, cy], [cx, cy - 1], [cx - 1, cy - 1]]) {
      f.set(x, y, 0, B.ROCK);
      f.set(x, y, FLOOR_Z - 1, B.GRASS);
    }
    f.items.push(makeItem(randomTreasure(rng, depth), cx + 0.5, cy + 0.5, FLOOR_Z));
    const shore = shoreFrom(r, cx, cy, dx, dy, (x, y) => isDeep(x, y) || f.get(x, y, FLOOR_Z - 1) === B.GRASS);
    if (shore && rng.chance(0.5)) {
      steppingStones(f, rng, shore, [cx - 0.5, cy - 0.5], isDeep);
      r.stones = true;
    } else {
      // One bridge out from the island to the shore.
      let crossed = false;
      for (let x = cx + dx, y = cy + dy; x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; x += dx, y += dy) {
        if (isDeep(x, y)) { f.set(x, y, FLOOR_Z - 1, B.PLANK); crossed = true; }
        else if (crossed) break;
      }
    }
  } else {
    bridgeLine(f, r, cx, cy, Math.abs(dx), Math.abs(dy), isDeep);
  }
}

// A chasm filling most of a hall. Either plank bridges cross it (sometimes meeting on a
// platform in the middle), or there's a treasure platform out in the void that only
// stepping stones (or flying) can reach. Fall in and you land on the next floor.
function addBigChasm(f, rng, r, nearDoor, depth) {
  const { core, cx, cy } = blob(rng, r, nearDoor, 0.95, 0);
  for (const [x, y] of core) { f.set(x, y, 0, B.AIR); f.set(x, y, FLOOR_Z - 1, B.AIR); }
  const isGap = (x, y) => !f.get(x, y, FLOOR_Z - 1) && !f.get(x, y, 0);
  const platform = () => {
    for (let y = cy - 1; y <= cy + 1; y++)
      for (let x = cx - 1; x <= cx + 1; x++)
        if (f.get(x, y, FLOOR_Z - 1) === B.PLANK || isGap(x, y)) f.set(x, y, FLOOR_Z - 1, r.theme.wall);
    f.items.push(makeItem(randomTreasure(rng, depth), cx + 0.5, cy + 0.5, FLOOR_Z));
  };
  const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
  const shore = shoreFrom(r, cx, cy, dx, dy, isGap);
  if (shore && distance(shore[0] - cx, shore[1] - cy) >= 4 && rng.chance(0.5)) {
    platform();
    steppingStones(f, rng, shore, [cx, cy], isGap);
    r.stones = true;
    return;
  }
  const both = rng.chance(0.5);
  bridgeLine(f, r, cx, cy, 1, 0, isGap);
  if (both) bridgeLine(f, r, cx, cy, 0, 1, isGap);
  if (both && rng.chance(0.6)) platform();
}

// ---------------------------------------------------------------------------
// The secret room: a small lit chamber sealed in the rock, with good loot. Only a bomb
// opens it, through one of its thin walls. (Spoilers, for whoever is reading the code:
//   1. It sits wall-to-wall with as many rooms as it can (at least one).
//   2. It never touches the start room, a corridor, the vault or a doorway.
//   3. The thin wall into it is always the one straight in line with its middle, on each
//      side that touches a room. No lamps hang on those walls.
//   4. If several spots touch equally many rooms, it's the one farthest from the start.
// In the dark, up close, light leaks through the cracks of a thin wall: render3d.js.)
function addSecretRoom(f, rng, rooms, start, roomAt, ringAt, corridor, blocked, depth) {
  const virgin = (c) => roomAt[c] < 0 && ringAt[c] < 0 && !corridor[c] && !blocked[c];
  const lampAt = (x, y) => f.get(x, y, FLOOR_Z + 2) === B.LAMP;
  let best = null;
  for (const [sw, sd] of [[3, 3], [4, 3], [3, 4], [3, 2], [2, 3]]) {
    for (let y0 = 2; y0 + sd < D - 2; y0++)
      for (let x0 = 2; x0 + sw < W - 2; x0++) {
        let ok = true;
        // The chamber and its shell: rock, except for shell tiles that are some room's wall.
        for (let y = y0 - 1; y <= y0 + sd && ok; y++)
          for (let x = x0 - 1; x <= x0 + sw && ok; x++) {
            const c = x + y * W, inside = x >= x0 && x < x0 + sw && y >= y0 && y < y0 + sd;
            if (inside ? !virgin(c) : roomAt[c] >= 0 || corridor[c] || (ringAt[c] < 0 && blocked[c])) ok = false;
          }
        if (!ok) continue;
        // Each side: the shell tile in line with the middle. Is it a thin wall into a room?
        const mx = x0 + ((sw - 1) >> 1), my = y0 + ((sd - 1) >> 1);
        const sides = [[mx, y0 - 1, 0, -1], [mx, y0 + sd, 0, 1], [x0 - 1, my, -1, 0], [x0 + sw, my, 1, 0]];
        const walls = [], touched = new Set();
        for (const [x, y, ox, oy] of sides) {
          const c = x + y * W, r = rooms[ringAt[c]];
          if (!r) continue;
          if (r === start || roomAt[x + ox + (y + oy) * W] !== r.id || r.doors.some((d) => d.x === x && d.y === y) || lampAt(x, y)) { ok = false; break; }
          walls.push([x, y]);
          touched.add(r.id);
        }
        // Any other shell tile touching a room must not belong to the start room either.
        for (let y = y0 - 1; y <= y0 + sd && ok; y++)
          for (let x = x0 - 1; x <= x0 + sw && ok; x++) if (rooms[ringAt[x + y * W]] === start) ok = false;
        if (!ok || !walls.length) continue;
        const score = touched.size * 1000 + distance(mx - start.cx, my - start.cy);
        if (!best || score > best.score) best = { score, x0, y0, sw, sd, walls };
      }
    if (best) break;
  }
  if (!best) return;

  const { x0, y0, sw, sd, walls } = best;
  for (let y = y0; y < y0 + sd; y++)
    for (let x = x0; x < x0 + sw; x++) {
      f.set(x, y, FLOOR_Z - 1, B.TILE);
      for (let z = FLOOR_Z; z < FLOOR_Z + 3; z++) f.set(x, y, z, B.AIR);
    }
  f.set(x0 + ((sw - 1) >> 1), y0 + ((sd - 1) >> 1), FLOOR_Z + 3, B.LAMP);   // a lamp in the ceiling
  f.secret = { x0, y0, x1: x0 + sw - 1, y1: y0 + sd - 1, found: false };
  for (const [x, y] of walls) f.secretWalls.add(x + y * W);

  // What's inside: a treasure, plus a crystal, bombs, a potion or a scroll.
  const spots = rng.shuffle(interior(f.secret));
  const roll = rng();
  const extra = roll < 0.1 ? { kind: rng.chance(0.5) ? "strength" : "heart" } : roll < 0.45 ? { kind: "bomb", count: 2 }
    : roll < 0.75 ? randomPotion(rng) : randomScroll(rng);
  for (const [k, it] of [randomTreasure(rng, depth + 1), extra, { kind: "gold", amount: rng.int(10, 20) + depth }].entries())
    if (spots[k]) f.items.push(makeItem(it, spots[k][0] + 0.5, spots[k][1] + 0.5, FLOOR_Z));
}

const isStairs = (f, x, y) => { const g = f.get(x, y, FLOOR_Z - 1); return g === B.STAIRS || g === B.STAIRS_UP; };

function placeItem(f, rng, room, item) {
  const spots = interior(room).filter(([x, y]) => f.stand[x + y * W] >= 0 && !isStairs(f, x, y));
  if (!spots.length) return;
  const [x, y] = rng.pick(spots);
  f.items.push(makeItem(item, x + 0.5, y + 0.5, f.stand[x + y * W]));
}

// ---------------------------------------------------------------------------
// Corridor routing: cheapest path with a penalty for turning, so corridors come out
// as long straight runs. Walls of rooms are expensive (enter through them, don't follow them).
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function findPath(ax, ay, bx, by, blocked, ringAt, corridor, jitter) {
  const n = W * D * 4;
  const cost = new Float64Array(n).fill(Infinity);   // must match the heap keys' precision exactly
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  for (let d = 0; d < 4; d++) { cost[(ax + ay * W) * 4 + d] = 0; heap.push(0, (ax + ay * W) * 4 + d); }
  let end = -1;
  while (heap.size) {
    const [c, s] = heap.pop();
    if (c > cost[s]) continue;
    const cell = s >> 2, dir = s & 3;
    const x = cell % W, y = (cell - x) / W;
    if (x === bx && y === by) { end = s; break; }
    for (let nd = 0; nd < 4; nd++) {
      const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
      const nc = nx + ny * W;
      if (blocked[nc] && !(nx === bx && ny === by)) continue;
      let step = 1 + jitter[nc] + (nd !== dir ? 3 : 0) + (ringAt[nc] >= 0 ? 6 : 0) - (corridor[nc] ? 0.7 : 0);
      const ns = nc * 4 + nd;
      if (c + step < cost[ns]) { cost[ns] = c + step; prev[ns] = s; heap.push(c + step, ns); }
    }
  }
  const path = [];
  for (let s = end; s >= 0; s = prev[s]) path.push(s >> 2);
  return path.reverse();
}

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(key, value) {
    const a = this.items;
    a.push([key, value]);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------
// Can this level be finished? Returns a list of problems (empty = fine).
export function validateDungeonLevel(f, p = {}) {
  const problems = [];
  const w = f.w, d = f.d;
  const sx = Math.floor(f.spawn.x), sy = Math.floor(f.spawn.y);
  if (f.stand[sx + sy * w] !== FLOOR_Z) problems.push("spawn is not on open floor");
  const noLocked = reachable(standWith(f, "open"), w, d, sx, sy, PLAYER_STEP_UP, PLAYER_DROP);
  const all = reachable(standWith(f, "all"), w, d, sx, sy, PLAYER_STEP_UP, PLAYER_DROP);
  const at = (dist, x, y) => dist[Math.floor(x) + Math.floor(y) * w] >= 0;

  if (p.final) {
    if (p.bottom?.kind === "boss") {
      const boss = f.monsters.find((m) => MONSTER_TYPES[m.type].boss);
      if (!boss || !at(all, boss.x, boss.y)) problems.push("boss missing or unreachable");
    }
    if (f.stairs) problems.push("stairs down on the last floor");
    const hole = (x, y) => !f.get(x, y, 0) || f.get(x, y, 0) === B.WATER_DEEP || f.get(x, y, FLOOR_Z - 1) === B.WATER_DEEP;
    outer: for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) if (hole(x, y)) { problems.push("a hole on the last floor"); break outer; }
  } else if (!f.stairs) problems.push("no stairs");
  else if (f.guardianHall) {   // the stairs wait behind the guardian's gate: the gate must be reachable
    const g = f.monsters.find((m) => m.guardian);
    if (!g || !at(all, g.x, g.y)) problems.push("guardian missing or unreachable");
    if (!at(all, ...f.guardianHall.front)) problems.push("guardian's gate unreachable");
  } else if (!at(all, f.stairs.x, f.stairs.y)) problems.push("stairs unreachable");
  for (const s of [f.stairs, f.upStairs]) {
    if (!s) continue;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const g = f.get(s.x + ox, s.y + oy, FLOOR_Z - 1);
        if (g === B.WATER_SHALLOW || g === B.WATER_DEEP || !g) problems.push("stairs in or next to water or a drop");
      }
  }
  if (p.hasUp !== false && (!f.upStairs || !at(noLocked, f.upStairs.x, f.upStairs.y))) problems.push("no reachable stairs up");
  if (f.blocks.includes(B.LOCKED) && !f.items.some((i) => i.kind === "key" && at(noLocked, i.x, i.y)))
    problems.push("no reachable key for the locked door");
  for (const r of f.rooms)
    if (!interior(r).some(([x, y]) => all[x + y * w] >= 0)) problems.push(`room ${r.id} unreachable`);
  if (!f.vault || !at(all, f.vault.entrance.x, f.vault.entrance.y)) problems.push("vault unreachable");
  for (const link of f.links.values()) if (!link.cells.length) problems.push("lever linked to nothing");
  // People must be reachable (Lio is behind bars: his lever must be).
  for (const n of f.npcs) {
    if (n.type === "lio") { if (!at(noLocked, ...n.state.leverFront)) problems.push("Lio's lever unreachable"); }
    else if (!at(all, n.x, n.y)) problems.push(`${n.type} unreachable`);
  }
  // Puzzle rooms without gates: their treasure must be reachable on foot (ghost planks count).
  const v = f.vault;
  if (v && !f.blocks.includes(B.GATE))
    for (const it of f.items)
      if (it.x >= v.x0 && it.x < v.x1 + 1 && it.y >= v.y0 && it.y < v.y1 + 1 && !at(all, it.x, it.y)) problems.push(`vault treasure unreachable`);
  if (f.braziers) {
    const ns = f.braziers.list.map((b) => b.n).sort().join("");
    if (ns !== "1234".slice(0, f.braziers.list.length) || !f.braziers.gate.length) problems.push("brazier numerals broken");
  }
  for (const m of f.monsters) if (f.stand[m.tx + m.ty * w] < 0) problems.push(`${m.type} stuck in a wall`);
  if (f.leverRecord && !f.leverRecordAt) problems.push("the Rune Lever room's record is missing");
  return problems;
}

// ---------------------------------------------------------------------------
// The old game's 20-level stack (The Rotation Cube), as parameters: level n is exactly the floor
// generateFloor(seed, n) made at 75edbd3, for n = 2..20 (tests/fixtures/golden/dungeons.json).
// Level 1 now has stairs up (to the temple above it) and no sky well, so it differs on purpose.
// It runs as the fixture site under world tile (0, 0) (world/legacy.js).
export const LEGACY_LEVELS = 20;
export const LEGACY_GUARDIANS = { 5: "flatqueen", 10: "warden", 15: "colossus" };
export function legacyParams(depth, runSeed = 0) {
  const final = depth >= LEGACY_LEVELS;
  // Levels 1-9 each get a different vault so you meet all of them (level 5 has a guardian
  // instead); after that, random. The last level always gets the Lich's throne room.
  const k = depth - 1 - (depth > 5 ? 1 : 0);
  const forcedVault = final ? null : LEGACY_GUARDIANS[depth] || (k < VAULTS.length ? VAULTS[k].id : null);
  return {
    key: `0,0,${depth}`, wx: 0, wy: 0, z: depth, level: depth, tier: 1, index: depth, count: LEGACY_LEVELS, final,
    theme: "legacy", hasUp: true, forcedVault, vaultPool: null, gimmicks: [],
    bottom: final ? { kind: "boss", id: "lich" } : null,
    encounters: planEncounters(runSeed).get(depth) || [], creatureTable: null, holesIn: null, simpleAfter: 25,
    name: `Depth ${depth}`,
  };
}
