// Breakdown: where does a 3D frame's time go? (sun shadow rays, sky, ray traversal vs shading)
import * as S from "./src/screen.js";
import { Floor, B, KIND, FLOOR_Z } from "./src/world.js";
import { generateFloor } from "./src/gen/dungeon.js";
import { computeLight, sampleLight } from "./src/light.js";
import { render3d } from "./src/render3d.js";
import { castRay } from "./src/raycast.js";
import { makePlayer, placePlayer } from "./src/player.js";
import { noise2, hash } from "./src/rng.js";

const COLS = 180, ROWS = 56;
S.setBackend({ resize: () => ({ cols: COLS, rows: ROWS, cellW: 11, cellH: 20 }), cellAt: () => null, present() {} });
S.resize();
const t = (fn, n = 1) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n; };

class Zone extends Floor {
  constructor(w, d, h) { super(1, 1); Object.assign(this, { w, d, h, blocks: new Uint8Array(w * d * h), seen: new Uint8Array(w * d), holeSeen: new Uint8Array(w * d), kind: new Uint8Array(w * d), stand: new Int8Array(w * d) }); }
  get(x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return 0; return this.blocks[x + y * this.w + z * this.w * this.d]; }
  set(x, y, z, id) { if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return; this.blocks[x + y * this.w + z * this.w * this.d] = id; }
  solid(x, y, z) { if (z < 0) return false; if (z >= this.h || x < 0 || y < 0 || x >= this.w || y >= this.d) return true; const b = this.get(x, y, z); return b !== 0 && b !== B.WATER_DEEP; }
  refresh() { computeLight(this, B.LAMP, B.BRAZIER_LIT); for (let y = 0; y < this.d; y++) for (let x = 0; x < this.w; x++) { let s = -1; for (let z = 1; z < this.h - 1; z++) if (this.get(x, y, z - 1) && !this.get(x, y, z) && !this.get(x, y, z + 1)) { s = z; break; } this.stand[x + y * this.w] = s; } }
}
function outdoor(w, d, h) {
  const z = new Zone(w, d, h);
  for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const n = noise2(x * 0.08 + 1, y * 0.08) * 0.7 + noise2(x * 0.2, y * 0.2 + 1) * 0.3, g = 1 + Math.floor(n * 3.2);
    for (let k = 0; k <= g; k++) z.set(x, y, k, k === g ? B.GRASS : B.ROCK);
  }
  for (let k = 0; k < (w * d) / 60; k++) {
    const x = 2 + Math.floor(hash(k, 1, 1) * (w - 4)), y = 2 + Math.floor(hash(k, 2, 1) * (d - 4));
    let g = 0; while (z.get(x, y, g + 1)) g++;
    for (let k2 = g + 1; k2 <= g + 3 && k2 < h; k2++) z.set(x, y, k2, B.PLANK);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) for (let k2 = g + 4; k2 <= g + 5 && k2 < h; k2++) z.set(x + ox, y + oy, k2, B.MOSS);
  }
  z.hasSky = true; z.refresh(); return z;
}
const mk = (floor, x, y, z, yaw, pitch) => { const p = makePlayer(); placePlayer(p, { x, y, z, yaw }); p.pitch = pitch;
  return { floor, player: p, fov: 75, time: 10, effects: [], cam: null, view: "3d", mode: "explore", potionColor: Object.fromEntries(["healing","strength","flying","haste","seeing","shadows","descent","poison","paralysis","darkness"].map((k, i) => [k, i])), knownPotions: new Set() }; };

const z = outdoor(64, 64, 16);
const sz = z.stand[32 + 32 * 64];
const g = mk(z, 32.5, 32.5, sz, 0.3, -0.05);
const res = {};
render3d(g);
res.outdoorSunOn = +t(() => render3d(g), 20).toFixed(2);
z.hasSky = false;
res.outdoorSunOff_noSkyShade = +t(() => render3d(g), 20).toFixed(2);
z.hasSky = true;
// Pure traversal: the same 10080 primary rays with no shading at all.
const dirs = [];
for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
  const u = ((2 * (cx + 0.5)) / COLS - 1) * Math.tan(75 * Math.PI / 360), v = (1 - (2 * (cy + 0.5)) / ROWS) * Math.tan(75 * Math.PI / 360) * (ROWS * 20) / (COLS * 11);
  const yaw = 0.3, pitch = -0.05, cpp = Math.cos(pitch), spp = Math.sin(pitch);
  let dx = cpp * Math.cos(yaw) + u * -Math.sin(yaw) + v * -spp * Math.cos(yaw), dy = cpp * Math.sin(yaw) + u * Math.cos(yaw) + v * -spp * Math.sin(yaw), dz = spp + v * cpp;
  const l = Math.hypot(dx, dy, dz); dirs.push([dx / l, dy / l, dz / l]);
}
const ez = sz + 1.45;
res.primaryRaysOnly = +t(() => { for (const [dx, dy, dz] of dirs) castRay(z, 32.5, 32.5, ez, dx, dy, dz, 32); }, 20).toFixed(2);
res.primaryRaysWithSeenMarking = +t(() => { for (const [dx, dy, dz] of dirs) castRay(z, 32.5, 32.5, ez, dx, dy, dz, 32, z.seen, 6, z.holeSeen); }, 20).toFixed(2);
res.twoTrilinearLightSamplesPerPixel = +t(() => { for (let i = 0; i < dirs.length; i++) { sampleLight(z, z.skyLight, 30.2, 30.7, 3.1); sampleLight(z, z.lampLight, 30.2, 30.7, 3.1); } }, 20).toFixed(2);

// Dungeon, same breakdown
const f = generateFloor(3, 6);
const gd = mk(f, f.spawn.x, f.spawn.y, f.spawn.z, f.spawn.yaw, 0);
render3d(gd);
res.dungeon = +t(() => render3d(gd), 20).toFixed(2);
// Smaller screen
S.setBackend({ resize: () => ({ cols: 120, rows: 38, cellW: 16, cellH: 28 }), cellAt: () => null, present() {} });
S.resize();
render3d(g);
res.outdoor_120x38 = +t(() => render3d(g), 20).toFixed(2);
console.log(JSON.stringify(res, null, 1));
