// What the landmark plans share (C1b; bible §5, §15.3): legend letters beyond the vault legend and WS2's, and the
// helpers a plan's `stamp` builds with. A plan is the vault letter format (gen/vaults.js stampVault): rows, a legend
// of letter → handler id, and what a handler reads from the plan.
//
// The handlers registered here (ids start "lm." so no other module's registrations collide):
//   lm.ground   floor whose ground block is plan.grounds[ch] (mosaic, salt, tile, moss...): the map and 3D both stand on
//               it; a mosaic's colours read on the map and fade at eye level (blocks.js)
//   lm.stack    a solid stack on the floor, plan.stacks[ch] = [block, height]: a ledge you stand on at that height, or
//               (2 blocks and up) a wall on the map, scenery to 3D (gen/surface.js marks a plan's columns over a block)
//   lm.ghost    ghost planks plan.ghosts[ch] blocks up over open air (the ground still under them): seen in 3D only with
//               your torch out; on the map a high column is a wall either way
//   lm.person   floor where someone stands (landmarks.js `letters` says who; each is placed once its kind exists)
//   lm.hall     a room carved out of rock, plan.halls[ch] = [block, air, height] (Molar's halls in its crag)
//
//   cells(rows, ch) → [[x, y]]               every cell of a letter, in reading order
//   peopleKeys(rows, letters, ox, oy) → [{ x, y }]   key points: the people's places (validateSurface: reachable)
//   house(zone, ox, oy, h, still)            stamps one house of a plan: its rows' rectangle as a vault with a slab
//                                            roof, `h` = { x, y, w, d, wall, floor?, up?, wallHeight? } (up: blocks above
//                                            the datum, a stilt or a plinth; its door is that high too)
//   mural(zone, x, y, z, view, text)         one of history's three readings on a block (story/murals.js): "map" a
//                                            floor mosaic, "3d" a carved relief, "dark" a rune
//   column(zone, x, y, from, to, block)      blocks from z = from to z = to - 1
//   Grid(w, d, ch = ".")                     a plan drawn by rectangles, rings and letters (the bigger towns): .fill,
//                                            .box (a house: its wall ring, floor, one door), .put, .disc, .rows()
import { B, FLOOR_Z } from "../../../world.js";
import { stampVault, registerLegend, floorCol, column as fillColumn } from "../../../gen/vaults.js";

registerLegend("lm.ground", (c) => { floorCol(c); const b = c.vault.grounds?.[c.ch]; if (b) c.zone.set(c.x, c.y, c.z0 - 1, b); });
registerLegend("lm.stack", (c) => {
  floorCol(c);
  const [b, h] = c.vault.stacks?.[c.ch] || [c.vault.wall, 1];
  for (let dz = 0; dz < h && c.z0 + dz < c.zone.h; dz++) c.zone.set(c.x, c.y, c.z0 + dz, b);
});
registerLegend("lm.ghost", (c) => {
  const h = c.vault.ghosts?.[c.ch] ?? 1;
  fillColumn(c, (z) => (z < c.z0 - 1 ? B.ROCK : z === c.z0 - 1 ? c.vault.floorBlock : z === c.z0 + h - 1 ? B.GHOST : B.AIR));
});
registerLegend("lm.person", (c) => floorCol(c));
// A hall carved out of rock: floor, plan.halls[ch] = [block, air, height]: `air` blocks of room, then the block above
// up to `height` (the crag over Molar's rooms). The map walks it as floor; 3D sees a ceiling.
registerLegend("lm.hall", (c) => {
  floorCol(c);
  const [b, air, h] = c.vault.halls?.[c.ch] || [B.ROCK, 4, 4];
  for (let dz = air; dz < h && c.z0 + dz < c.zone.h; dz++) c.zone.set(c.x, c.y, c.z0 + dz, b);
});

export function cells(rows, ch) {
  const out = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === ch) out.push([x, y]); });
  return out;
}
export const peopleKeys = (rows, letters, ox, oy) => Object.keys(letters).flatMap((ch) => cells(rows, ch).map(([x, y]) => ({ x: ox + x, y: oy + y })));

export function house(zone, ox, oy, rows, h, still, legend = {}) {
  const plan = rows.slice(h.y, h.y + h.d).map((r) => r.slice(h.x, h.x + h.w));
  stampVault(zone, { name: h.id, plan, height: h.wallHeight ?? 4, wall: h.wall, floorBlock: h.floor ?? B.PLANK, links: [], rubble: h.rubble,
                     legend: { h: "floor", ...legend } },
             ox + h.x, oy + h.y, still, { roof: h.roof ?? "slab", wallHeight: h.wallHeight ?? 4, baseZ: FLOOR_Z + (h.up || 0) });
}

export function mural(zone, x, y, z, view, text) {
  (zone.murals ||= []).push({ x, y, z, view, text });
}
export function column(zone, x, y, from, to, block) {
  for (let z = from; z < to && z < zone.h; z++) zone.set(x, y, z, block);
}

export class Grid {
  constructor(w, d, ch = ".") { this.w = w; this.d = d; this.g = Array.from({ length: d }, () => Array(w).fill(ch)); }
  put(x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.d) this.g[y][x] = ch; return this; }
  fill(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.put(x, y, ch); return this; }
  // A ring of `wall` round a floor of `inside` (x0..x1 by y0..y1 the outside of the walls), its door at (dx, dy).
  box(x0, y0, x1, y1, door, wall = "#", inside = "h") {
    this.fill(x0, y0, x1, y1, wall).fill(x0 + 1, y0 + 1, x1 - 1, y1 - 1, inside);
    if (door) this.put(door[0], door[1], "D");
    return this;
  }
  disc(cx, cy, r, ch, keep = null) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (Math.hypot(x - cx, y - cy) <= r && (!keep || keep.includes(this.g[y]?.[x]))) this.put(x, y, ch);
    return this;
  }
  rows() { return this.g.map((r) => r.join("")); }
}
