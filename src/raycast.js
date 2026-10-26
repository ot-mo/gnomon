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
// its apron sideways), OUT.BOTTOM (down out of the zone: a pit) or OUT.TOP (up, above everything);
// missT is how far it had gone (render3d's horizon plane starts there).
export const OUT = { FAR: 0, SIDE: 1, BOTTOM: 2, TOP: 3 };
export const hit = { t: 0, block: 0, nx: 0, ny: 0, nz: 0, x: 0, y: 0, z: 0, apron: false, out: 0, missT: 0 };

// --- What a ray needs to know about a zone's apron and height -------------------------------------
// The apron's bands in a 3 × 3 grid (rows n, middle, s; columns w, middle, e; world.js apronRect), so a ray
// finds the band under a voxel by arithmetic rather than by name (world.js apronBlock), and `top`: one above
// the highest block of the zone and its bands. Under the sky a ray going up from there meets nothing, so it
// stops (sky rays are half the screen). Rebuilt when a band is replaced or the zone refreshed (a new
// skyLight). Dungeons (no sky) keep their height: nothing about their rays changes.
const AP = new WeakMap(), TOPS = new WeakMap();
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
  let r = AP.get(zone);
  const ap = zone.apron;
  if (r && r.sky === zone.skyLight && r.ap === ap && (!ap || (r.g[0] === ap.nw && r.g[1] === ap.n && r.g[2] === ap.ne && r.g[3] === ap.w &&
      r.g[5] === ap.e && r.g[6] === ap.sw && r.g[7] === ap.s && r.g[8] === ap.se))) return r;
  const g = ap ? [ap.nw, ap.n, ap.ne, ap.w, null, ap.e, ap.sw, ap.s, ap.se] : null;
  let top = zone.h;
  if (zone.hasSky) {
    top = zoneTop(zone);
    if (g) for (const band of g) if (band) top = Math.max(top, bandTop(band, zone.h));
  }
  r = { sky: zone.skyLight, ap, g, top };
  AP.set(zone, r);
  return r;
}

// Returns true if the ray hits a block within maxT (details in `hit`).
// If `seen` is given (the auto-map), every column the ray passes through while the air
// is lit — or within torchRange of the eye — is marked as seen.
// If `holes` is given, a column is also marked there when the ray passes down through
// its floor layer: you've looked into a pit or chasm (only the 3D view passes this).
// Beyond an open side of a surface zone the ray keeps going through the apron (world.js, TECH_DESIGN
// §6.1) and hits its voxels like any other block (hit.apron = true); the apron never marks seen or
// holes. A zone without an apron (every dungeon level) stops at its grid as before.
const HOLE_Z = 1;   // the floor layer (world.js FLOOR_Z - 1)
// info: rayInfo(zone), when the caller has it (render3d, once a frame).
export function castRay(zone, ox, oy, oz, dx, dy, dz, maxT, seen = null, torchRange = 0, holes = null, info = rayInfo(zone)) {
  const W = zone.w, D = zone.d, H = zone.h, WD = W * D;
  const blocks = zone.blocks, lit = zone.litMask, ap = info.ap, g = info.g, TOP = info.top;
  // How far the ray may travel outside the grid: the apron's reach on each open side.
  const X0 = ap?.w ? -APRON : 0, X1 = ap?.e ? W + APRON : W, Y0 = ap?.n ? -APRON : 0, Y1 = ap?.s ? D + APRON : D;
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
      if (z >= TOP && stepZ > 0) { hit.out = 3; hit.missT = t; return false; }
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
    if (z < 0 && stepZ < 0) { hit.out = 2; hit.missT = t; return false; }
    if (z >= TOP && stepZ > 0) { hit.out = 3; hit.missT = t; return false; }
    lastLit = false;
    if (z < 0 || z >= H || x < X0 || y < Y0 || x >= X1 || y >= Y1) continue;
    // In the apron (or a corner without a band: air).
    const band = g[(y < 0 ? 0 : y >= D ? 6 : 3) + (x < 0 ? 0 : x >= W ? 2 : 1)];
    if (!band) continue;
    const lx = x - band.x0, ly = y - band.y0, bw = band.bw;
    if (lx < 0 || ly < 0 || lx >= bw || ly >= band.bd) continue;
    const b = band.blocks[lx + ly * bw + z * bw * band.bd];
    if (b > 0 && (b !== B.GHOST || ghostShows(x, y, z, axis, stepX, stepY, stepZ))) {
      hit.t = t; hit.block = b; hit.x = x; hit.y = y; hit.z = z; hit.apron = true;
      hit.nx = axis === 0 ? -stepX : 0;
      hit.ny = axis === 1 ? -stepY : 0;
      hit.nz = axis === 2 ? -stepZ : 0;
      return true;
    }
  }
}

// Can a point see another point? (Nothing solid in between.)
export function lineOfSight(zone, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  return !castRay(zone, ax, ay, az, dx / dist, dy / dist, dz / dist, dist);
}
