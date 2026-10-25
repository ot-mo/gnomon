// 3D DDA ray casting through a floor's block grid (learn/03 §6).
import { B, APRON, apronBlock } from "./world.js";

// Ghost planks are solid to walk on but only visible in the dark: rays pass straight
// through them unless the renderer turns this on (your torch is out).
let ghostVisible = false;
export function setGhostVisible(v) { ghostVisible = v; }

export const hit = { t: 0, block: 0, nx: 0, ny: 0, nz: 0, x: 0, y: 0, z: 0, apron: false };

// Returns true if the ray hits a block within maxT (details in `hit`).
// If `seen` is given (the auto-map), every column the ray passes through while the air
// is lit — or within torchRange of the eye — is marked as seen.
// If `holes` is given, a column is also marked there when the ray passes down through
// its floor layer: you've looked into a pit or chasm (only the 3D view passes this).
// Beyond an open side of a surface zone the ray keeps going through the apron (world.js, TECH_DESIGN
// §6.1) and hits its voxels like any other block (hit.apron = true); the apron never marks seen or
// holes. A zone without an apron (every dungeon level) stops at its grid as before.
const HOLE_Z = 1;   // the floor layer (world.js FLOOR_Z - 1)
export function castRay(zone, ox, oy, oz, dx, dy, dz, maxT, seen = null, torchRange = 0, holes = null) {
  const W = zone.w, D = zone.d, H = zone.h, WD = W * D;
  const blocks = zone.blocks, lit = zone.litMask, ap = zone.apron;
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
    if (t > maxT) return false;
    if ((x < X0 && stepX < 0) || (x >= X1 && stepX > 0) ||
        (y < Y0 && stepY < 0) || (y >= Y1 && stepY > 0) ||
        (z < 0 && stepZ < 0) || (z >= H && stepZ > 0)) return false;
    if (z < 0 || z >= H || x < X0 || y < Y0 || x >= X1 || y >= Y1) { lastLit = false; continue; }
    if (x < 0 || y < 0 || x >= W || y >= D) {   // in the apron (or a corner without a band: air)
      lastLit = false;
      const b = apronBlock(zone, x, y, z);
      if (b > 0 && (b !== B.GHOST || ghostVisible)) {
        hit.t = t; hit.block = b; hit.x = x; hit.y = y; hit.z = z; hit.apron = true;
        hit.nx = axis === 0 ? -stepX : 0;
        hit.ny = axis === 1 ? -stepY : 0;
        hit.nz = axis === 2 ? -stepZ : 0;
        return true;
      }
      continue;
    }

    const i = x + y * W + z * WD;
    const b = blocks[i];
    if (b && (b !== B.GHOST || ghostVisible)) {
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
  }
}

// Can a point see another point? (Nothing solid in between.)
export function lineOfSight(zone, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-6) return true;
  return !castRay(zone, ax, ay, az, dx / dist, dy / dist, dz / dist, dist);
}
