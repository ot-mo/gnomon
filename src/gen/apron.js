// The apron's band builder (TECH_DESIGN §6.1, §1.4 zones.js APRON_BUILDERS; owner WS2), registered as
// APRON_BUILDERS.surface by world/zonegen.js.
//
//   buildApronBand(run, zone, side, neighbour = null) → band    side: "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
//        a copy of the neighbour's blocks when it is in memory, else built from the world functions
//
// One band of zone.apron (world.js apronRect gives its place). With the neighbour zone in memory (neighbour,
// the span that way) the band is a copy of its blocks, so you walk onto exactly the ground you will stand on;
// without it, the band is built from the world functions: the ground of columnAt, the world's water, and every
// tree of treeAt. The neighbour's own features (its road's bends, a plan, a village) appear only once it is in
// memory. The fourth argument (the neighbour zone) is 0A2's addition to §1.4 (0A2.md deviation 17).
import { B, FLOOR_Z, SURFACE, apronRect } from "../world.js";
import { worldFns, SURFACE_RULES as R } from "./terrain.js";

const ZW = SURFACE.w, ZD = SURFACE.d;
const floorDiv = (a, b) => Math.floor(a / b);

export function buildApronBand(run, zone, side, neighbour = null) {
  const r = apronRect(zone, side), { w, d, h } = zone, n = r.bw * r.bd;
  const blocks = new Uint8Array(n * h);
  const dx = side.includes("w") ? -1 : side.includes("e") ? 1 : 0, dy = side.includes("n") ? -1 : side.includes("s") ? 1 : 0;
  if (neighbour && neighbour.w === w && neighbour.d === d && neighbour.h === h) {
    // The band in the neighbour's coordinates starts at (x0 − dx·w, y0 − dy·d); copy it row by row.
    const sx = r.x0 - dx * w, sy = r.y0 - dy * d, src = neighbour.blocks;
    for (let z = 0; z < h; z++)
      for (let ly = 0; ly < r.bd; ly++) {
        const from = sx + (sy + ly) * w + z * w * d;
        blocks.set(src.subarray(from, from + r.bw), ly * r.bw + z * n);
      }
    return { ...r, blocks, from: "zone" };
  }
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
