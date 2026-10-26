// Light spread through the air of a floor with a flood fill (learn/05 §7).
// skyLight comes down light wells open to the sky; lampLight radiates from lamp blocks.
import { RULES } from "./rules.js";
import { daylight as clockDaylight, lightBucket, bucketSun } from "./clock.js";
import { registerUpdate } from "./events.js";
import { castRay } from "./raycast.js";

const SKY_FALLOFF = 0.13;
const LAMP_FALLOFF = 0.07;
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// Which air cells are bright enough to see into (the auto-map, raycast.js `seen`): sky light × daylight
// (in a zone with sky; TECH_DESIGN §6.3) plus lamp light. computeLight builds it at the daylight syncLight
// last saw; syncLight rebuilds it when daylight moves on (dusk, dawn).
let maskDaylight = 1;
// What light.js keeps per zone, out of the zone itself (a save writes a zone's own fields; only sunlit is
// on the codec's list of rebuilt ones): `for`, the skyLight array it belongs to (a refresh makes a new one);
// litKey, the daylight step the lit mask was built at; the baked sun's bucket, sun and slice in progress;
// and the voxels a bake visits.
const STATE = new WeakMap();
function stateOf(zone) {
  let st = STATE.get(zone);
  if (!st || st.for !== zone.skyLight) { st = { for: zone.skyLight, litKey: null, sunBucket: null, sunDir: null, bake: null, cells: null }; STATE.set(zone, st); }
  return st;
}
function litMaskOf(zone, sky, lamp, dl) {
  const { blocks } = zone, n = sky.length;
  const lit = zone.litMask && zone.litMask.length === n ? zone.litMask : new Uint8Array(n);
  if (!zone.hasSky || dl === 1) for (let i = 0; i < n; i++) lit[i] = !blocks[i] && sky[i] * 0.7 + lamp[i] * lamp[i] > 0.06 ? 1 : 0;
  else for (let i = 0; i < n; i++) lit[i] = !blocks[i] && sky[i] * 0.7 * dl + lamp[i] * lamp[i] > 0.06 ? 1 : 0;
  return lit;
}
const maskKey = (zone, dl) => (zone.hasSky ? Math.round(dl * 32) : -1);

export function computeLight(zone, lampId, lampId2 = -1) {
  const { w, d, h, blocks } = zone;
  const n = w * d * h;
  const sky = new Float32Array(n), lamp = new Float32Array(n);
  const skySeeds = [], lampSeeds = [];

  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++)
      for (let z = h - 1; z >= 0; z--) {
        const i = x + y * w + z * w * d;
        if (blocks[i]) break;
        sky[i] = 1;
        skySeeds.push(i);
      }
  for (let i = 0; i < n; i++) if (blocks[i] === lampId || blocks[i] === lampId2) { lamp[i] = 1; lampSeeds.push(i); }

  flood(zone, sky, skySeeds, SKY_FALLOFF);
  flood(zone, lamp, lampSeeds, LAMP_FALLOFF);

  const dl = zone.hasSky ? maskDaylight : 1;
  zone.litMask = null;
  zone.litMask = litMaskOf(zone, sky, lamp, dl);
  zone.skyLight = sky;
  zone.lampLight = lamp;
  zone.sunlit = null;   // the blocks changed: the sun is baked again
  stateOf(zone).litKey = maskKey(zone, dl);
}

function flood(zone, grid, queue, falloff) {
  const { w, d, h, blocks } = zone;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const level = grid[i] - falloff;
    if (level <= 0) continue;
    const x = i % w, y = Math.floor(i / w) % d, z = Math.floor(i / (w * d));
    for (const [ox, oy, oz] of NEIGHBOURS) {
      const nx = x + ox, ny = y + oy, nz = z + oz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= w || ny >= d || nz >= h) continue;
      const ni = nx + ny * w + nz * w * d;
      if (blocks[ni] || grid[ni] >= level) continue;
      grid[ni] = level;
      queue.push(ni);
    }
  }
}

// Trilinear blend of the 8 nearest light values (they live at block centres).
// airOnly: leave out solid blocks (their light is always 0) and blend the rest. Sprites use
// this: otherwise an item lying in a corner averages in the dark inside of two walls and
// comes out at a third of its proper brightness.
// Under the sky a sample beyond the zone's border takes the border cell's light (TECH_DESIGN §6.3, the edge
// clamp): the open ground goes on into the next zone, so the last tiles before an edge don't darken.
export function sampleLight(zone, grid, x, y, z, airOnly = false) {
  return sampleGrid(grid, zone.blocks, zone.w, zone.d, zone.h, !!zone.hasSky, x, y, z, airOnly);
}
// The same from the zone's arrays and sizes (render3d reads them once a frame: a hot path that never touches
// the zone object itself isn't thrown off by each zone's own shape, so a new zone's first frame stays fast).
export function sampleGrid(grid, blocks, w, d, h, clamp, x, y, z, airOnly = false) {
  x -= 0.5; y -= 0.5; z -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  let sum = 0, weights = 0;
  if (!airOnly && x0 >= 0 && y0 >= 0 && z0 >= 0 && x0 + 1 < w && y0 + 1 < d && z0 + 1 < h) {
    // All eight inside the grid (most samples): the loop below unrolled, the same products in the same order.
    const wd = w * d, i = x0 + y0 * w + z0 * wd, gx = 1 - fx, gy = 1 - fy, gz = 1 - fz;
    sum += gx * gy * gz * grid[i]; sum += fx * gy * gz * grid[i + 1];
    sum += gx * fy * gz * grid[i + w]; sum += fx * fy * gz * grid[i + w + 1];
    sum += gx * gy * fz * grid[i + wd]; sum += fx * gy * fz * grid[i + wd + 1];
    sum += gx * fy * fz * grid[i + wd + w]; sum += fx * fy * fz * grid[i + wd + w + 1];
    return sum;
  }
  for (let k = 0; k < 8; k++) {
    let ix = x0 + (k & 1), iy = y0 + ((k >> 1) & 1);
    let iz = z0 + (k >> 2);
    const wgt = (k & 1 ? fx : 1 - fx) * (k & 2 ? fy : 1 - fy) * (k & 4 ? fz : 1 - fz);
    if (wgt === 0 || iz < 0) continue;
    if (ix < 0 || iy < 0 || ix >= w || iy >= d) {
      if (!clamp) continue;
      ix = ix < 0 ? 0 : ix >= w ? w - 1 : ix;
      iy = iy < 0 ? 0 : iy >= d ? d - 1 : iy;
    }
    if (iz >= h) iz = h - 1;
    const i = ix + iy * w + iz * w * d;
    if (airOnly && blocks[i]) continue;
    sum += wgt * grid[i];
    weights += wgt;
  }
  return airOnly ? (weights > 0 ? sum / weights : 0) : sum;
}

// ---------------------------------------------------------------------------------------------------
// The light seam (TECH_DESIGN §1.4, §6.3, R12). Every rule that cares whether a place is dark asks here,
// so the clock's daylight reaches the rules without touching them.
//
//   lightAt(game, zone, x, y, z, airOnly = false) → { sky, lamp }   sky light × daylight, and lamp light
//   naturalLight(game, zone, x, y, z) → 0..1     sky × daylight only, no lamps (0 in a lightless zone)
//   inDark(game, zone, x, y, z) → bool           !player.torch && naturalLight < RULES.dark.threshold
//   zoneIsLightless(zone) → bool                 no sky anywhere (every dungeon level): the dark-only
//                                                rules reduce to the torch, decided once per frame
//   daylight(game) → 0..1                        clock.js daylight (the time of day, the Shade's dimness);
//                                                setDaylight(fn | value) → undo swaps in another (tests)
//   syncLight(game, zone)                        bring the zone's lit mask and baked sun up to the clock
//                                                (render3d calls it every frame; an update does on the map)
//   sunlitAt(zone, hx, hy, hz, nx, ny, nz, px, py, pz) → 0..1   the baked sun on a face (below)
//   bakeSun(zone, bucket, { budgetMs })          bake (or go on baking) zone.sunlit for a light bucket
//
// Underground (no sky) inDark is exactly the parent's torch test: a lamp never counts (it would wash
// out brazier numerals and lit-room murals), nor does a light well, so every puzzle behaves as before.
// Outdoors by day nothing is dark: ghost planks, glowing runes, ghosts and ghost people stay hidden in
// sunshine, and show at night or in deep shade with your torch out.
let daylightOf = clockDaylight;
export const daylight = (game) => daylightOf(game);
export function setDaylight(fn) {
  const old = daylightOf;
  daylightOf = typeof fn === "function" ? fn : () => fn;
  return () => { daylightOf = old; };
}

export const zoneIsLightless = (zone) => !zone.hasSky;

export function lightAt(game, zone, x, y, z, airOnly = false) {
  if (!zone.skyLight) return { sky: 0, lamp: 0 };
  return { sky: sampleLight(zone, zone.skyLight, x, y, z, airOnly) * daylight(game),
           lamp: sampleLight(zone, zone.lampLight, x, y, z, airOnly) };
}

// Outside the grid (the apron beyond an open edge) it's the open sky.
export function naturalLight(game, zone, x, y, z) {
  if (zoneIsLightless(zone)) return 0;
  if (x < 0 || y < 0 || x >= zone.w || y >= zone.d || z >= zone.h) return daylight(game);
  if (!zone.skyLight) return 0;
  return sampleLight(zone, zone.skyLight, x, y, z, true) * daylight(game);
}

export function inDark(game, zone, x, y, z) {
  if (game.player.torch) return false;
  return zoneIsLightless(zone) || naturalLight(game, zone, x, y, z) < RULES.dark.threshold;
}

// --- The baked sun (TECH_DESIGN §6.4) ---------------------------------------------------------------
// zone.sunlit (Uint8Array, one per voxel): for every air voxel beside a solid face, 2 when the sun of the
// zone's light bucket reaches it (one DDA toward it, SUN_STEPS long, through the apron too) and 1 when
// something is in the way; 0 for every other voxel (solid, or open air: not baked). sunState(zone) says which
// bucket it was baked for and that bucket's sun, which shading uses for the faces too, so shadows and lit
// faces agree. At night (no sun) zone.sunlit is null. A new bucket is baked a slice at a time while the old
// bake stays in use; a zone with no bake at all is baked at once.
const SUN_STEPS = 40;
function cellsOf(zone, st) {
  if (st.cells) return st.cells;
  const { w, d, h, blocks } = zone, wd = w * d, out = [];
  for (let z = 0; z < h; z++)
    for (let y = 0; y < d; y++)
      for (let x = 0; x < w; x++) {
        const i = x + y * w + z * wd;
        if (blocks[i]) continue;
        if ((z > 0 && blocks[i - wd]) || (z < h - 1 && blocks[i + wd]) || (x > 0 && blocks[i - 1]) || (x < w - 1 && blocks[i + 1]) ||
            (y > 0 && blocks[i - w]) || (y < d - 1 && blocks[i + w])) out.push(i);
      }
  return (st.cells = Int32Array.from(out));
}

// { bucket, sun, baking } for a zone: the bucket zone.sunlit was baked for (null: never), its sun, and
// whether a newer bucket's bake is under way.
export function sunState(zone) {
  const st = stateOf(zone);
  return { bucket: st.sunBucket, sun: st.sunDir, baking: !!st.bake };
}

// Bake for `bucket` (clock.js lightBucket). budgetMs: stop after about that long and go on next time.
// → true when zone.sunlit is the bucket's.
export function bakeSun(zone, bucket, { budgetMs = Infinity } = {}) {
  if (!zone.hasSky || !zone.skyLight) return false;
  const st = stateOf(zone);
  if (st.sunBucket === bucket && !st.bake) return true;
  const sun = bucketSun(bucket);
  if (!(sun[2] > 0)) { zone.sunlit = null; st.sunBucket = bucket; st.sunDir = sun; st.bake = null; return true; }
  let job = st.bake;
  if (!job || job.bucket !== bucket) job = st.bake = { bucket, sun, grid: new Uint8Array(zone.w * zone.d * zone.h), next: 0 };
  const cells = cellsOf(zone, st), { w, d } = zone, wd = w * d, [sx, sy, sz] = sun, grid = job.grid;
  const t0 = budgetMs === Infinity ? 0 : performance.now();
  let k = job.next;
  while (k < cells.length) {
    const end = Math.min(cells.length, k + 256);
    for (; k < end; k++) {
      const i = cells[k], z = Math.floor(i / wd), r = i - z * wd, y = Math.floor(r / w), x = r - y * w;
      grid[i] = castRay(zone, x + 0.5, y + 0.5, z + 0.5, sx, sy, sz, SUN_STEPS) ? 1 : 2;
    }
    if (budgetMs !== Infinity && performance.now() - t0 > budgetMs) break;
  }
  job.next = k;
  if (k < cells.length) return false;
  zone.sunlit = grid; st.sunBucket = bucket; st.sunDir = sun; st.bake = null;
  return true;
}

// The baked sun on a face: the air layer in front of it, blended over the 2 × 2 voxels nearest the point
// (px, py, pz) so a shadow's edge is soft rather than a voxel step. 1 = in full sun. Voxels outside the
// grid, solid, or not baked don't count; with none to go by, the face is in the sun.
export function sunlitAt(zone, hx, hy, hz, nx, ny, nz, px, py, pz) {
  return sunlitGrid(zone.sunlit, zone.w, zone.d, zone.h, hx, hy, hz, nx, ny, nz, px, py, pz);
}
export function sunlitGrid(g, w, d, h, hx, hy, hz, nx, ny, nz, px, py, pz) {
  if (!g) return 1;
  const wd = w * d;
  let u, v, fixed, axis;   // the two coordinates along the face, and the layer in front of it
  if (nz !== 0) { axis = 2; fixed = hz + nz; u = px - 0.5; v = py - 0.5; }
  else if (nx !== 0) { axis = 0; fixed = hx + nx; u = py - 0.5; v = pz - 0.5; }
  else { axis = 1; fixed = hy + ny; u = px - 0.5; v = pz - 0.5; }
  const u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
  let sum = 0, wsum = 0;
  for (let k = 0; k < 4; k++) {
    const a = u0 + (k & 1), b = v0 + (k >> 1);
    const wgt = (k & 1 ? fu : 1 - fu) * (k & 2 ? fv : 1 - fv);
    if (wgt === 0) continue;
    let x, y, z;
    if (axis === 2) { x = a; y = b; z = fixed; } else if (axis === 0) { x = fixed; y = a; z = b; } else { x = a; y = fixed; z = b; }
    if (x < 0 || y < 0 || z < 0 || x >= w || y >= d || z >= h) continue;
    const s = g[x + y * w + z * wd];
    if (!s) continue;
    sum += wgt * (s - 1); wsum += wgt;
  }
  return wsum > 0 ? sum / wsum : 1;
}

// --- Keeping a zone up with the clock ------------------------------------------------------------------
// The lit mask follows daylight (32 steps); the sun follows the light bucket. The zone you are in comes
// first: with no shadows to draw yet it is baked at once, a new bucket a slice per frame (BAKE_MS). Then
// one neighbour in memory with its derived arrays (the next zone you may walk into) is baked ahead, a slice
// per frame, so the frame that crosses an edge doesn't bake.
export const BAKE_MS = 2;
export function syncLight(game, zone) {
  if (!zone?.skyLight || !zone.hasSky) return;
  const dl = daylight(game), st = stateOf(zone);
  maskDaylight = dl;
  const key = maskKey(zone, dl);
  if (st.litKey !== key) { zone.litMask = litMaskOf(zone, zone.skyLight, zone.lampLight, dl); st.litKey = key; }
  const bucket = lightBucket(game);
  if (st.sunBucket === bucket && !st.bake) return;
  bakeSun(zone, bucket, { budgetMs: zone.sunlit ? BAKE_MS : Infinity });
}

function bakeAhead(game) {
  const cur = game.zone;
  if (!cur?.hasSky || !game.zones) return;
  const bucket = lightBucket(game), cs = stateOf(cur);
  if (cs.sunBucket !== bucket || cs.bake) return;
  for (const z of game.zones.values()) {
    if (z === cur || !z.hasSky || !z.skyLight || z.z !== cur.z || Math.abs(z.wx - cur.wx) > 1 || Math.abs(z.wy - cur.wy) > 1) continue;
    const st = stateOf(z);
    if (st.sunBucket === bucket && !st.bake) continue;
    bakeSun(z, bucket, { budgetMs: BAKE_MS });
    return;
  }
}

registerUpdate("light", (game) => { if (game.zone) { syncLight(game, game.zone); bakeAhead(game); } }, { modes: ["*"] });
