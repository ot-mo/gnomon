// 3D DDA ray casting through a floor's block grid (learn/03 §6).
import { B, APRON } from "./world.js";

// Ghost planks are solid to walk on but only visible in the dark: rays pass straight
// through them unless the renderer turns this on. v: true or false for the whole frame (a zone without
// sky: your torch is out or not), or a function (x, y, z) → bool asked at each ghost block a ray meets,
// with the centre of the air cell the ray came from (a zone with sky: light.js inDark there).
let ghostVisible = false;
export function setGhostVisible(v) { ghostVisible = v; }
function ghostShows(x, y, z, axis, sx, sy, sz) {
  if (typeof ghostVisible !== "function") return ghostVisible;
  return ghostVisible(x + 0.5 - (axis === 0 ? sx : 0), y + 0.5 - (axis === 1 ? sy : 0), z + 0.5 - (axis === 2 ? sz : 0));
}

// The last hit, and how the last miss left: out = OUT.FAR (it went maxT), OUT.SIDE (out of the grid and
// its apron sideways, or down beyond the grid), OUT.BOTTOM (down out of the zone inside its grid: a pit) or
// OUT.TOP (up, above everything);
// missT is how far it had gone (render3d's horizon plane starts there).
export const OUT = { FAR: 0, SIDE: 1, BOTTOM: 2, TOP: 3 };
export const hit = { t: 0, block: 0, nx: 0, ny: 0, nz: 0, x: 0, y: 0, z: 0, apron: false, out: 0, missT: 0 };

// --- What a ray needs to know about a zone's apron and height -------------------------------------
// The apron's bands in a 3 × 3 grid (rows n, middle, s; columns w, middle, e; world.js apronRect), so a ray
// finds the band under a voxel by arithmetic rather than by name (world.js apronBlock), and `top`: one above
// the highest block of the zone and its bands. Under the sky a ray going up from there meets nothing, so it
// stops (sky rays are half the screen). Rebuilt when a band is replaced or the zone refreshed (a new
// skyLight). Dungeons (no sky) keep their height: nothing about their rays changes.
// (Cached by the zone's skyLight array, so a dormant zone that drops it, dropDerived, frees all of this too.)
const AP = new WeakMap(), TOPS = new WeakMap(), BANDS = new WeakMap();
// A band as castRay reads it: always this shape, whoever built the band.
const bandOf = (band) => {
  if (!band) return null;
  let b = BANDS.get(band);
  if (!b) BANDS.set(band, (b = { x0: band.x0, y0: band.y0, bw: band.bw, bd: band.bd, n: band.bw * band.bd, blocks: band.blocks }));
  return b;
};
const bandTop = (band, h) => {
  let t = TOPS.get(band);
  if (t !== undefined) return t;
  const n = band.bw * band.bd, blocks = band.blocks;
  t = 0;
  for (let z = h - 1; z >= 0 && !t; z--) for (let i = z * n, e = i + n; i < e; i++) if (blocks[i]) { t = z + 1; break; }
  TOPS.set(band, t);
  return t;
};
function zoneTop(zone) {
  const { w, d, h, blocks } = zone, wd = w * d;
  for (let z = h - 1; z >= 0; z--) for (let i = z * wd, e = i + wd; i < e; i++) if (blocks[i]) return z + 1;
  return 0;
}
export function rayInfo(zone) {
  let r = zone.skyLight ? AP.get(zone.skyLight) : null;
  const ap = zone.apron;
  if (r && r.lit === zone.litMask && r.blocks === zone.blocks && r.ap === ap && (!ap || (r.raw[0] === ap.nw &&
      r.raw[1] === ap.n && r.raw[2] === ap.ne && r.raw[3] === ap.w && r.raw[5] === ap.e && r.raw[6] === ap.sw && r.raw[7] === ap.s && r.raw[8] === ap.se))) return r;
  const raw = ap ? [ap.nw, ap.n, ap.ne, ap.w, null, ap.e, ap.sw, ap.s, ap.se] : null, g = raw ? raw.map(bandOf) : null;
  let top = zone.h;
  if (zone.hasSky && zone.skyLight) {   // (a zone not refreshed yet, or dormant, keeps its height: nothing is cached for it)
    top = zoneTop(zone);
    if (raw) for (const band of raw) if (band) top = Math.max(top, bandTop(band, zone.h));
  }
  // The zone's sizes and arrays too: castRay reads only this object (always this shape), never the zone.
  // How far a ray may go outside the grid: the apron's reach on each open side.
  const W = zone.w, D = zone.d;
  r = { lit: zone.litMask, blocks: zone.blocks, w: W, d: zone.d, h: zone.h, ap, raw, g, top,
        x0: ap?.w ? -APRON : 0, x1: ap?.e ? W + APRON : W, y0: ap?.n ? -APRON : 0, y1: ap?.s ? D + APRON : D };
  if (zone.skyLight) AP.set(zone.skyLight, r);
  return r;
}

// Returns true if the ray hits a block within maxT (details in `hit`).
// If `seen` is given (the auto-map), every column the ray passes through while the air
// is lit — or within torchRange of the eye — is marked as seen.
// If `holes` is given, a column is also marked there when the ray passes down through
// its floor layer: you've looked into a pit or chasm (only the 3D view passes this).
// Beyond an open side of a surface zone the ray keeps going through the apron (world.js, TECH_DESIGN
// §6.1) and hits its voxels like any other block (hit.apron = true); the apron never marks seen or
// holes. A zone without an apron (every dungeon level) stops at its grid as before. Outdoors a ray that has
// climbed above the zone's highest block can hit nothing more: it only goes on marking `seen`.
const HOLE_Z = 1;   // the floor layer (world.js FLOOR_Z - 1)
// info: rayInfo(zone), when the caller has it (render3d, once a frame).
export function castRay(zone, ox, oy, oz, dx, dy, dz, maxT, seen = null, torchRange = 0, holes = null, info = rayInfo(zone)) {
  const W = info.w, D = info.d, H = info.h, WD = W * D;
  const blocks = info.blocks, lit = info.lit, g = info.g, TOP = info.top;
  const X0 = info.x0, X1 = info.x1, Y0 = info.y0, Y1 = info.y1;   // how far it may go outside the grid (the apron)
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dx), tDeltaY = Math.abs(1 / dy), tDeltaZ = Math.abs(1 / dz);
  let tMaxX = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY;
  let tMaxZ = dz === 0 ? Infinity : (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ;
  let axis = 0, t = 0, lastLit = true;

  while (true) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; axis = 0; }
    else if (tMaxY < tMaxZ)             { y += stepY; t = tMaxY; tMaxY += tDeltaY; axis = 1; }
    else                                { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; axis = 2; }
    if (t > maxT) { hit.out = 0; hit.missT = maxT; return false; }
    if (x >= 0 && y >= 0 && z >= 0 && x < W && y < D && z < H) {   // inside the grid (most steps)
      if (z >= TOP && stepZ > 0) break;   // above everything, going up
      const i = x + y * W + z * WD;
      const b = blocks[i];
      if (b && (b !== B.GHOST || ghostShows(x, y, z, axis, stepX, stepY, stepZ))) {
        hit.t = t; hit.block = b; hit.x = x; hit.y = y; hit.z = z; hit.apron = false;
        hit.nx = axis === 0 ? -stepX : 0;
        hit.ny = axis === 1 ? -stepY : 0;
        hit.nz = axis === 2 ? -stepZ : 0;
        if (seen && lastLit) seen[x + y * W] = 1;
        return true;
      }
      if (seen) {
        lastLit = lit[i] === 1 || t < torchRange;
        if (lastLit) {
          seen[x + y * W] = 1;
          if (holes && z === HOLE_Z) holes[x + y * W] = 1;
        }
      }
      continue;
    }
    if ((x < X0 && stepX < 0) || (x >= X1 && stepX > 0) ||
        (y < Y0 && stepY < 0) || (y >= Y1 && stepY > 0)) { hit.out = 1; hit.missT = t; return false; }
    // Down out of the zone: a pit when it is inside the grid; beyond it (a shut corner between two open sides, no
    // band there) it is the world beyond, like a ray leaving by a side.
    if (z < 0 && stepZ < 0) { hit.out = x >= 0 && y >= 0 && x < W && y < D ? 2 : 1; hit.missT = t; return false; }
    if (z >= TOP && stepZ > 0) break;
    lastLit = false;
    if (z < 0 || z >= H || x < X0 || y < Y0 || x >= X1 || y >= Y1) continue;
    // In the apron (or a corner without a band: air).
    const band = g[(y < 0 ? 0 : y >= D ? 6 : 3) + (x < 0 ? 0 : x >= W ? 2 : 1)];
    if (!band) continue;
    const lx = x - band.x0, ly = y - band.y0, bw = band.bw;
    if (lx < 0 || ly < 0 || lx >= bw || ly >= band.bd) continue;
    const b = band.blocks[lx + ly * bw + z * band.n];
    if (b > 0 && (b !== B.GHOST || ghostShows(x, y, z, axis, stepX, stepY, stepZ))) {
      hit.t = t; hit.block = b; hit.x = x; hit.y = y; hit.z = z; hit.apron = true;
      hit.nx = axis === 0 ? -stepX : 0;
      hit.ny = axis === 1 ? -stepY : 0;
      hit.nz = axis === 2 ? -stepZ : 0;
      return true;
    }
  }
  // Above everything and going up: there is nothing more to hit. With `seen` the columns it passes over are still
  // marked as before (in the grid, where the air is lit or within torchRange), without looking at the blocks;
  // without it the ray is done.
  if (seen) for (;;) {
    if (x >= 0 && y >= 0 && x < W && y < D) {
      if (z >= H) break;
      if (lit[x + y * W + z * WD] === 1 || t < torchRange) {
        seen[x + y * W] = 1;
        if (holes && z === HOLE_Z) holes[x + y * W] = 1;
      }
    } else if ((x < 0 && stepX < 0) || (x >= W && stepX > 0) || (y < 0 && stepY < 0) || (y >= D && stepY > 0) || z >= H) break;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; }
    else if (tMaxY < tMaxZ)             { y += stepY; t = tMaxY; tMaxY += tDeltaY; }
    else                                { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; }
    if (t > maxT) break;
  }
  hit.out = 3; hit.missT = t;
  return false;
}

// Can a point see another point? (Nothing solid in between.)
export function lineOfSight(zone, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  return !castRay(zone, ax, ay, az, dx / dist, dy / dist, dz / dist, dist);
}
