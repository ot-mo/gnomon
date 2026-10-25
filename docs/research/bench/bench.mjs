// Engine benchmark for the fork survey (runs against a copy of src/).
import { deflateSync } from "node:zlib";
import * as S from "./src/screen.js";
import { Floor, W, D, H, B, BLOCKS, KIND, FLOOR_Z, ROOM_TOP } from "./src/world.js";
import { generateFloor, validateFloor, arrivalPoint } from "./src/gen/dungeon.js";
import { computeLight } from "./src/light.js";
import { render3d } from "./src/render3d.js";
import { makePlayer, placePlayer } from "./src/player.js";
import { noise2, hash } from "./src/rng.js";
import { flowField } from "./src/pathing.js";
import { refreshView } from "./src/turns.js";

const COLS = +(process.env.COLS || 180), ROWS = +(process.env.ROWS || 56);
S.setBackend({ resize: () => ({ cols: COLS, rows: ROWS, cellW: 11, cellH: 20 }), cellAt: () => null, present() {} });
S.resize();

const out = {};
const t = (fn, n = 1) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n; };

// 1. Generation
{
  const times = []; let retries = 0, fails = 0;
  for (let seed = 1; seed <= 20; seed++)
    for (let depth = 1; depth <= 20; depth++) {
      const t0 = performance.now();
      const f = generateFloor(seed, depth);
      times.push(performance.now() - t0);
      retries += f.attempts - 1;
      if (validateFloor(f).length) fails++;
    }
  times.sort((a, b) => a - b);
  out.gen = { floors: times.length, avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
    median: +times[times.length >> 1].toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2),
    max: +times[times.length - 1].toFixed(2), retries, fails };
  out.temple = +t(() => generateFloor(1, 0), 10).toFixed(2);
}

// 2. Determinism: same (seed, depth) → identical blocks?
{
  const a = generateFloor(7, 9), b = generateFloor(7, 9);
  let same = a.blocks.length === b.blocks.length;
  for (let i = 0; same && i < a.blocks.length; i++) if (a.blocks[i] !== b.blocks[i]) same = false;
  out.deterministicBlocks = same;
  out.deterministicMonsterIds = JSON.stringify(a.monsters.map((m) => m.id)) === JSON.stringify(b.monsters.map((m) => m.id));
  out.deterministicItems = JSON.stringify(a.items) === JSON.stringify(b.items);
  out.deterministicMonsterTypes = JSON.stringify(a.monsters.map((m) => [m.type, m.tx, m.ty, m.elite])) === JSON.stringify(b.monsters.map((m) => [m.type, m.tx, m.ty, m.elite]));
}

// 3. refresh() and pieces on a dungeon floor
const f = generateFloor(3, 6);
out.refreshDungeon = +t(() => f.refresh(), 50).toFixed(3);
out.lightDungeon = +t(() => computeLight(f, B.LAMP, B.BRAZIER_LIT), 50).toFixed(3);
out.flowField = +t(() => flowField(f, Math.floor(f.spawn.x), Math.floor(f.spawn.y)), 200).toFixed(3);

// 4. Sizes of one floor's state
{
  const mapToObj = (m) => Object.fromEntries(m);
  const entities = { monsters: f.monsters, items: f.items, npcs: f.npcs, rooms: f.rooms, vault: f.vault, secret: f.secret,
    links: [...f.links], groups: [...f.groups], spikes: [...f.spikes], secretWalls: [...f.secretWalls], braziers: f.braziers,
    markers: f.markers, sightings: [...f.sightings], guardianHall: f.guardianHall, spawn: f.spawn, stairs: f.stairs, upStairs: f.upStairs };
  const ej = JSON.stringify(entities);
  const blocksDeflate = deflateSync(Buffer.from(f.blocks)).length;
  const seen = new Uint8Array(f.seen); for (let i = 0; i < seen.length; i++) seen[i] = hash(i, 3) < 0.5 ? 1 : 0;
  out.sizes = {
    blocksRaw: f.blocks.byteLength, blocksDeflate, blocksDeflateB64: Math.ceil(blocksDeflate / 3) * 4,
    seenRaw: f.seen.byteLength, seenRandomHalfDeflate: deflateSync(Buffer.from(seen)).length,
    derivedBytes: f.skyLight.byteLength + f.lampLight.byteLength + f.litMask.byteLength + f.kind.byteLength + f.stand.byteLength + f.holeSeen.byteLength,
    entitiesJson: ej.length, entitiesJsonDeflate: deflateSync(Buffer.from(ej)).length,
    monsters: f.monsters.length, items: f.items.length, npcs: f.npcs.length,
  };
  out.sizes.totalInMemoryApprox = f.blocks.byteLength + out.sizes.derivedBytes + f.seen.byteLength + ej.length;
}

// 5. A configurable-size floor (what a "Zone" would be): same API, own dimensions.
class Zone extends Floor {
  constructor(w, d, h) {
    super(1, 1);
    this.w = w; this.d = d; this.h = h;
    this.blocks = new Uint8Array(w * d * h);
    this.seen = new Uint8Array(w * d); this.holeSeen = new Uint8Array(w * d);
    this.kind = new Uint8Array(w * d); this.stand = new Int8Array(w * d);
  }
  index(x, y, z) { return x + y * this.w + z * this.w * this.d; }
  get(x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return 0; return this.blocks[x + y * this.w + z * this.w * this.d]; }
  set(x, y, z, id) { if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return; this.blocks[x + y * this.w + z * this.w * this.d] = id; }
  solid(x, y, z) { if (z < 0) return false; if (z >= this.h || x < 0 || y < 0 || x >= this.w || y >= this.d) return true; const b = this.blocks[x + y * this.w + z * this.w * this.d]; return b !== 0 && b !== B.WATER_DEEP; }
  standHeight(x, y) {
    if (this.get(x, y, FLOOR_Z - 1) === B.WATER_DEEP) return -1;
    for (let z = 1; z < this.h - 1; z++) if (this.get(x, y, z - 1) && !this.get(x, y, z) && !this.get(x, y, z + 1)) return z;
    return -1;
  }
  refresh() {
    computeLight(this, B.LAMP, B.BRAZIER_LIT);
    for (let y = 0; y < this.d; y++) for (let x = 0; x < this.w; x++) this.stand[x + y * this.w] = this.standHeight(x, y);
    for (let i = 0; i < this.w * this.d; i++) this.kind[i] = KIND.FLOOR;
    this.navVersion++;
  }
}

// Rolling outdoor terrain: ground top 1..4, trees, a pond, some ruined walls; open sky.
function outdoor(w, d, h, seed = 1) {
  const z = new Zone(w, d, h);
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      const n = noise2(x * 0.08 + seed, y * 0.08) * 0.7 + noise2(x * 0.2, y * 0.2 + seed) * 0.3;
      const g = 1 + Math.floor(n * 3.2);   // top solid block at z = g
      for (let k = 0; k <= g; k++) z.set(x, y, k, k === g ? B.GRASS : B.ROCK);
      if (n < 0.22) { z.set(x, y, 1, B.WATER_SHALLOW); for (let k = 2; k <= g; k++) z.set(x, y, k, 0); }
    }
  for (let k = 0; k < (w * d) / 60; k++) {   // trees
    const x = 2 + Math.floor(hash(k, 1, seed) * (w - 4)), y = 2 + Math.floor(hash(k, 2, seed) * (d - 4));
    let g = 0; while (z.get(x, y, g + 1)) g++;
    for (let k2 = g + 1; k2 <= g + 3 && k2 < h; k2++) z.set(x, y, k2, B.PLANK);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (let k2 = g + 4; k2 <= g + 5 && k2 < h; k2++) z.set(x + ox, y + oy, k2, B.MOSS);
  }
  for (let x = 10; x < 20 && x < w; x++) for (let k = 2; k < 5; k++) z.set(x, 12, k, B.STONE);   // a ruined wall
  z.hasSky = true;
  z.refresh();
  return z;
}

const game0 = (floor, x, y, z, yaw, pitch) => {
  const p = makePlayer(); placePlayer(p, { x, y, z, yaw }); p.pitch = pitch;
  return { floor, player: p, fov: 75, time: 10, effects: [], cam: null, view: "3d", mode: "explore", log() {}, potionColor: Object.fromEntries(["healing","strength","flying","haste","seeing","shadows","descent","poison","paralysis","darkness"].map((k, i) => [k, i])), knownPotions: new Set() };
};
function frameMs(game, n = 15) { render3d(game); return +t(() => render3d(game), n).toFixed(2); }

// Dungeon frames
{
  const sp = f.spawn;
  out.render = {};
  out.render.dungeonSpawn = frameMs(game0(f, sp.x, sp.y, sp.z, sp.yaw, 0));
  const hall = f.rooms.find((r) => r.hall);
  out.render.dungeonHall = frameMs(game0(f, hall.x0 + 0.5, hall.y0 + 0.5, f.stand[hall.x0 + hall.y0 * W] > 0 ? f.stand[hall.x0 + hall.y0 * W] : FLOOR_Z, Math.PI / 4, -0.1));
  const temple = generateFloor(1, 0);
  out.render.templeSanctumSky = frameMs(game0(temple, 37.5, 34.5, FLOOR_Z, -Math.PI / 2, 0.25));
}

// Outdoor frames at several zone sizes and draw distances
out.outdoor = {};
for (const [w, d, h] of [[48, 48, 10], [64, 64, 16], [80, 48, 16], [96, 96, 16]]) {
  const t0 = performance.now();
  const z = outdoor(w, d, h);
  const build = performance.now() - t0;
  const refresh = t(() => z.refresh(), 10);
  const cx = Math.floor(w / 2), cy = Math.floor(d / 2);
  let sz = z.stand[cx + cy * w]; if (sz < 0) sz = 5;
  const key = `${w}x${d}x${h}`;
  const res = { build: +build.toFixed(1), refresh: +refresh.toFixed(2), bytesBlocks: z.blocks.byteLength,
    bytesLight: z.skyLight.byteLength * 2 + z.litMask.byteLength };
  for (const maxd of [32, 48, 64]) {
    globalThis.__MAXD = maxd;
    const horizon = frameMs(game0(z, cx + 0.5, cy + 0.5, sz, 0.3, 0.0));
    const down = frameMs(game0(z, cx + 0.5, cy + 0.5, sz, 2.0, -0.35));
    const corner = frameMs(game0(z, 2.5, 2.5, Math.max(0, z.stand[2 + 2 * w]), Math.PI / 4, 0.0));   // looking across the whole zone
    res[`max${maxd}`] = { horizon, lookingDown: down, cornerAcross: corner };
  }
  globalThis.__MAXD = 32;
  // the map's 360° view refresh (one map turn)
  const g = game0(z, cx + 0.5, cy + 0.5, sz, 0, 0); g.player.perks = new Set();
  res.mapTurnRefreshView = +t(() => refreshView({ ...g, floor: z }), 10).toFixed(2);
  res.flowField = +t(() => flowField(z, cx, cy), 50).toFixed(3);
  out.outdoor[key] = res;
}
out.screen = { cols: COLS, rows: ROWS, rays: COLS * ROWS };
console.log(JSON.stringify(out, null, 1));
