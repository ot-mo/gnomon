// The apron's band builder (TECH_DESIGN §6.1, §1.4 zones.js APRON_BUILDERS; owner WS2), registered as
// APRON_BUILDERS.surface by world/zonegen.js.
//
//   buildApronBand(run, zone, side, neighbour = null, { fresh = false } = {}) → band
//        side: "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw"; a copy of the neighbour's blocks when it is in
//        memory, else built from the world functions and kept (fresh: built anew and not kept, for checks)
//   apronBandSteps(run, wx, wy) → iterator   builds and keeps the world-function bands span (wx, wy)'s apron
//        will want, one band per next(); gen/surface.js surfaceSteps runs one with each of its stages
//   APRON_KEEP                               how many world-function bands are kept (the most recent)
//
// One band of zone.apron (world.js apronRect gives its place). With the neighbour zone in memory (neighbour,
// the span that way) the band is a copy of its blocks, so you walk onto exactly the ground you will stand on;
// without it, the band is built from the world functions: the ground of columnAt, the world's water, and every
// tree of treeAt. The neighbour's own features (its road's bends, a plan, a village) appear only once it is in
// memory. The fourth argument (the neighbour zone) is 0A2's addition to §1.4 (0A2.md deviation 17).
//
// The edge-swap frame (WS3 #6): when you cross into a zone, zones.js fillApron builds its bands, and the far
// ones (whose spans aren't in memory) come from the world functions, a few ms in that very frame. So a
// world-function band is kept once built (per world, seed, span and side; the same bits whenever it is
// built), and a zone's 3D prefetch (surfaceSteps) builds them ahead, one with each of its stages: the swap
// frame then finds them made. A band is never written to after it is built (the apron is read-only), so
// one band object may serve every fill.
import { B, FLOOR_Z, SURFACE, APRON_SIDES, apronRect } from "../world.js";
import { worldFns, SURFACE_RULES as R } from "./terrain.js";

const ZW = SURFACE.w, ZD = SURFACE.d;
const floorDiv = (a, b) => Math.floor(a / b);

export const APRON_KEEP = 64;   // bands: 8 zones' worth, the zone you are in and its neighbours with room to spare
const kept = new WeakMap();     // world → Map(`${seed}:${wx},${wy}:${side}` → band), oldest first

export function buildApronBand(run, zone, side, neighbour = null, { fresh = false } = {}) {
  const { w, d, h } = zone;
  if (neighbour && neighbour.w === w && neighbour.d === d && neighbour.h === h) return copyBand(zone, side, neighbour);
  const surface = w === ZW && d === ZD && h === SURFACE.h;
  if (!surface || fresh) return worldBand(run, zone, side);
  let byKey = kept.get(run.world);
  if (!byKey) kept.set(run.world, (byKey = new Map()));
  const key = `${run.seed >>> 0}:${zone.wx},${zone.wy}:${side}`;
  let band = byKey.get(key);
  if (band) { byKey.delete(key); byKey.set(key, band); return band; }   // the most recent last
  band = worldBand(run, zone, side);
  byKey.set(key, band);
  if (byKey.size > APRON_KEEP) byKey.delete(byKey.keys().next().value);
  return band;
}

// The bands span (wx, wy)'s apron will want from the world functions (its open sides, and the open corners
// zones.js neighbourAddr would fill), built and kept one per next().
export function* apronBandSteps(run, wx, wy) {
  const world = run.world, zone = { wx, wy, w: ZW, d: ZD, h: SURFACE.h };
  const open = (s) => world.edgeOpen(wx, wy, s);
  for (const side of APRON_SIDES) {
    if (side.length === 1) { if (!open(side)) continue; }
    else {
      const ns = side[0], ew = side[1], dx = ew === "e" ? 1 : -1, dy = ns === "s" ? 1 : -1;
      if (!open(ns) || !open(ew) || (!world.edgeOpen(wx + dx, wy, ns) && !world.edgeOpen(wx, wy + dy, ew))) continue;
    }
    buildApronBand(run, zone, side, null);
    yield side;
  }
}

function copyBand(zone, side, neighbour) {
  const r = apronRect(zone, side), { w, d, h } = zone, n = r.bw * r.bd;
  const blocks = new Uint8Array(n * h);
  const dx = side.includes("w") ? -1 : side.includes("e") ? 1 : 0, dy = side.includes("n") ? -1 : side.includes("s") ? 1 : 0;
  // The band in the neighbour's coordinates starts at (x0 − dx·w, y0 − dy·d); copy it row by row.
  const sx = r.x0 - dx * w, sy = r.y0 - dy * d, src = neighbour.blocks;
  for (let z = 0; z < h; z++)
    for (let ly = 0; ly < r.bd; ly++) {
      const from = sx + (sy + ly) * w + z * w * d;
      blocks.set(src.subarray(from, from + r.bw), ly * r.bw + z * n);
    }
  return { ...r, blocks, from: "zone" };
}

function worldBand(run, zone, side) {
  const r = apronRect(zone, side), { h } = zone, n = r.bw * r.bd;
  const blocks = new Uint8Array(n * h);
  const W = worldFns(run.world, run.seed), ox = zone.wx * ZW, oy = zone.wy * ZD;
  const at = (x, y, z) => x - r.x0 + (y - r.y0) * r.bw + z * n;
  for (let ly = 0; ly < r.bd; ly++)
    for (let lx = 0; lx < r.bw; lx++) {
      const x = r.x0 + lx, y = r.y0 + ly, c = W.columnAt(ox + x, oy + y);
      if (c.water) {
        for (let z = 0; z < FLOOR_Z - 1; z++) blocks[at(x, y, z)] = B.ROCK;
        blocks[at(x, y, FLOOR_Z - 1)] = c.water === 2 ? B.WATER_DEEP : B.WATER_SHALLOW;
        continue;
      }
      const top = FLOOR_Z - 1 + c.height;
      for (let z = 0; z < top; z++) blocks[at(x, y, z)] = B.ROCK;
      blocks[at(x, y, top)] = c.ground;
    }
  // Trees whose canopy touches the band, built the way gen/surface.js buildTree builds them.
  const C = R.treeCell, inBand = (x, y) => x >= r.x0 && y >= r.y0 && x < r.x0 + r.bw && y < r.y0 + r.bd;
  const put = (x, y, z, b) => { if (inBand(x, y) && z < h && !blocks[at(x, y, z)]) blocks[at(x, y, z)] = b; };
  for (let cy = floorDiv(oy + r.y0 - 1, C); cy <= floorDiv(oy + r.y0 + r.bd, C); cy++)
    for (let cx = floorDiv(ox + r.x0 - 1, C); cx <= floorDiv(ox + r.x0 + r.bw, C); cx++) {
      const t = W.treeAt(cx, cy);
      if (!t) continue;
      const x = t.gx - ox, y = t.gy - oy, top = t.base + t.trunk;
      if (x < r.x0 - 1 || y < r.y0 - 1 || x > r.x0 + r.bw || y > r.y0 + r.bd) continue;
      for (let ty = -1; ty <= 1; ty++)
        for (let tx = -1; tx <= 1; tx++) { put(x + tx, y + ty, top - 1, B.LEAVES); put(x + tx, y + ty, top, B.LEAVES); }
      put(x, y, top + 1, B.LEAVES);
      if (inBand(x, y)) for (let z = t.base; z < top; z++) blocks[at(x, y, z)] = B.TRUNK;
    }
  return { ...r, blocks, from: "world" };
}
