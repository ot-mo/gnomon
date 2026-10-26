// The Temple of Angles: the parent game's start, as a landmark plan in the vault letter format
// (gen/vaults.js). The test world stamps it on the surface of span (0, 0), over the legacy stack;
// the real world reuses it for Hollowmere's sanctum (DECISIONS.md).
//
//   TEMPLE_PLAN                         the plan: rows, legend, and finish() for the puzzle parts
//   stampTemple(zone, ox, oy, rng, opts) stamps it with its top-left corner at (ox, oy); opts.roof is the
//                                       roof over everything but the sanctum ("slab" on the surface), opts.door
//                                       false walls up the front door (the parent's temple had none)
//   templeFixture(seed) → Zone          the parent's 48×48×10 temple zone, stamped the parent's way (rock
//                                       roof, no front door): block for block what story.js buildTemple made
//                                       (tests/fixtures/golden/temple.json) and the check that this plan is it
//   openCubeWall(zone)                  the cube is taken: the wall behind the altar slides away
//
// The letters (beyond the vault legend: # wall, . floor, ~ chasm, D door, G gate, L lever, l lamp, > stairs):
//   ,  wooden floor   b  a bed   @  where you wake up   M  Maren   C  marble column
//   ^  spike floor    A  the altar, with the cube on it   X  the wall that opens when you take it
//   o  stepping stone (O: a block higher)   w u  the white and blue mosaic ring round the altar
//   P  the front door, out of the mosaic room to the east   H  the porch behind it
// The sanctum (the rect SANCTUM) is stamped a second time with roof "none": it is open to the sky,
// as the parent opened it by hand. Its mosaic ring is drawn in the rows (the parent computed it with
// atan2, which generation may not use: these are the cells it chose).
import { Zone, B, FLOOR_Z, ROOM_TOP } from "../../world.js";
import { makeRng } from "../../rng.js";
import { stampVault, registerLegend, floorCol } from "../../gen/vaults.js";
import { makeItem } from "../../items.js";
import { spawnCreature, addCreature } from "../../creatures.js";
import { layoutSpikes } from "../../traps.js";

export const TEMPLE_ROWS = [
  "############################################",
  "#b,,,,,b####################################",
  "#,,,,,,,####################################",
  "#,,,@,,,####################################",
  "#,,,,,,,####################################",
  "####D#######################################",
  "####.###########################L##L##L#####",
  "####.#########################...........###",
  "#...............##############...........###",
  "#...............l############l...........###",
  "l..C....M....C..#####l########...........l##",
  "#...............#..^^^^^^^^..#...........###",
  "#...............D..^^^^^^^^..D...........PHH",
  "#...............#..^^^^^^^^..#...........###",
  "#...............#########l####...........###",
  "l..C.........C..#############l...........l##",
  "#...............l#############...........###",
  "#...............##############...........###",
  "###################################G########",
  "###################################.########",
  "###################################.########",
  "#############################.............##",
  "#############################.....u.u.....##",
  "#############################...uuwww.u...##",
  "#############################....ww.ww....##",
  "#############################...ww...wwu..##",
  "#############################..uw..A..w...##",
  "#############################...ww...wwu..##",
  "#############################....ww.ww....##",
  "#############################...uuwww.u...##",
  "#############################.....u.u.....##",
  "#############################.............##",
  "###################################X########",
  "###############################.........####",
  "###############################~~~~~~~~~####",
  "###############################~~~~o~~~~####",
  "##############################l~~~~~~~~~####",
  "###############################~~~~O~~~~####",
  "###############################~~~~~~~~~l###",
  "###############################~~~~o~~~~####",
  "###############################~~~~~~~~~####",
  "###############################.........####",
  "###############################....>....####",
  "############################################",
  "############################################",
];
// The sanctum: open to the sky. Plan columns 29..41, rows 21..31.
export const SANCTUM = { x: 29, y: 21, w: 13, d: 11 };

registerLegend("plankFloor", (c) => { floorCol(c); c.zone.set(c.x, c.y, c.z0 - 1, B.PLANK); });
registerLegend("bed", (c) => { floorCol(c); c.zone.set(c.x, c.y, c.z0 - 1, B.PLANK); c.zone.set(c.x, c.y, c.z0, B.CRATE); });
registerLegend("column", (c) => { floorCol(c); for (let z = c.z0; z < c.z0 + ROOM_TOP - FLOOR_Z; z++) c.zone.set(c.x, c.y, z, B.COLUMN); });
registerLegend("altar", (c) => {
  floorCol(c);
  c.zone.set(c.x, c.y, c.z0, B.ALTAR);
  c.zone.items.push(makeItem({ kind: "cube" }, c.x + 0.5, c.y + 0.5, c.z0 + 1));
});
registerLegend("maren", (c) => {
  floorCol(c);
  addCreature(c.zone, spawnCreature("maren", c.x, c.y, c.z0, { level: 0 }));
  // Coming back up the legacy stack's stairs: in front of Maren, as in the parent game (her rest loop:
  // "come back if you need rest"), not down in the shaft's bottom room (zones.js arrivalPoint "up").
  c.zone.returnPoint = { x: c.x + 0.5, y: c.y + 2.5, z: c.z0, yaw: -Math.PI / 2 };
});
registerLegend("mosaicWhite", (c) => { floorCol(c); c.zone.set(c.x, c.y, c.z0 - 1, B.MOSAIC_WHITE); });
registerLegend("mosaicBlue", (c) => { floorCol(c); c.zone.set(c.x, c.y, c.z0 - 1, B.MOSAIC_BLUE); });

// What each stamp makes of the letters. The main stamp leaves the sanctum's own letters as floor
// (the second stamp makes them); the walled-in variant turns the front door back into wall.
const MAIN_LEGEND = { ",": "plankFloor", b: "bed", C: "column", M: "maren", O: "step1", A: "floor", w: "floor", u: "floor",
                      P: "door", H: "floor" };
const SANCTUM_LEGEND = { A: "altar", w: "mosaicWhite", u: "mosaicBlue" };
const NO_DOOR = { P: "wall", H: "wall" };
export const TEMPLE_LEGENDS = { main: MAIN_LEGEND, sanctum: SANCTUM_LEGEND, noDoor: NO_DOOR };   // (read by check-content)

export const TEMPLE_PLAN = {
  id: "temple", name: "The Temple of Angles", rows: TEMPLE_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE,
  roof: "slab",          // over everything but the sanctum, on the surface
  spawn: "@",            // the zone's anchor: your little room
  keys: ["@", "M", "H"], // must be reachable from the anchor (the stairs wait behind the puzzle, on purpose)
  entranceGated: true,   // so the entrance isn't one of them
  at: [2, 2],            // the plan's corner in the landmark's 48×48 rect: where the parent put it in its zone
  dungeonAt: [0, 0],     // where the 48×48 legacy levels sit, from the rect's corner: 1:1 under the parent's frame
  hub: [44, 12],         // where the road arrives: just outside the front door's porch
  sinkholes: false,      // nobody falls into the legacy stack before finding the cube
  rng: (runSeed) => makeRng((runSeed ^ 0x7e3a1e) >>> 0),   // the parent's puzzle for the same seed
  stamp: (zone, ox, oy, rng, opts) => stampTemple(zone, ox, oy, rng, opts),
};

const cellsOf = (rows, ch, ox, oy) => {
  const out = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push([x + ox, y + oy]); }));
  return out;
};

// Stamp the temple at (ox, oy). rng: the parent drew the spike timing, the right lever and the loose
// mosaic tiles from makeRng(seed ^ 0x7e3a1e), in that order; pass the same and you get its puzzle.
// Returns { spawn, stairs, keyPoints }.
export function stampTemple(zone, ox, oy, rng, { roof = "slab", door = true, baseZ = FLOOR_Z } = {}) {
  const rows = TEMPLE_ROWS;
  const legend = door ? MAIN_LEGEND : { ...MAIN_LEGEND, ...NO_DOOR };
  const main = { name: TEMPLE_PLAN.name, plan: rows, height: TEMPLE_PLAN.height, wall: B.STONE, floorBlock: B.TILE, links: [], legend };
  stampVault(zone, main, ox, oy, rng, { roof, baseZ });
  const S = SANCTUM;
  const sanctum = { name: "the sanctum", plan: rows.slice(S.y, S.y + S.d).map((r) => r.slice(S.x, S.x + S.w)),
                    height: TEMPLE_PLAN.height, wall: B.STONE, floorBlock: B.TILE, links: [], legend: SANCTUM_LEGEND };
  stampVault(zone, sanctum, ox + S.x, oy + S.y, rng, { roof: "none", baseZ });

  const z0 = baseZ;
  const [[tx, ty]] = cellsOf(rows, ">", ox, oy);
  zone.stairs = { x: tx, y: ty };
  zone.cubeWall = cellsOf(rows, "X", ox, oy);
  for (const [x, y] of zone.cubeWall) for (let z = z0; z < z0 + ROOM_TOP - FLOOR_Z; z++) zone.set(x, y, z, B.STONE);

  // The spike hall: a slow wave, easy enough when you take it one beat at a time.
  layoutSpikes(zone, cellsOf(rows, "^", ox, oy), rng, "wave-x", 4, 1);   // rolling east, the way you walk: follow it

  // The mosaic room: three levers, and a golden arrow in the floor pointing at the right one.
  const levers = cellsOf(rows, "L", ox, oy);
  const right = rng.pick(levers);
  const gate = cellsOf(rows, "G", ox, oy).flatMap(([x, y]) => [[x, y, z0], [x, y, z0 + 1]]);
  for (const [x, y] of levers)
    zone.links.set(zone.index(x, y, z0 + 1), x === right[0]
      ? { action: "open", cells: gate }
      : { action: "dud", msg: "The lever clanks, and nothing happens. (Maren said the floor tells the way.)" });
  const top = oy + 7;   // the arrow's tip is just in front of the lever
  const arrow = [[0, 1], [-1, 2], [0, 2], [1, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], ...[4, 5, 6, 7, 8, 9].map((d) => [0, d])];
  for (let y = oy + 7; y <= oy + 17; y++)
    for (let x = ox + 30; x <= ox + 40; x++) if (rng.chance(0.18)) zone.set(x, y, z0 - 1, rng.chance(0.5) ? B.MOSAIC_BLUE : B.MOSAIC_RED);
  for (const [dx, dy] of arrow) zone.set(right[0] + dx, top + dy, z0 - 1, B.MOSAIC_GOLD);

  const [[sx, sy]] = cellsOf(rows, "@", ox, oy);
  const keyPoints = TEMPLE_PLAN.keys.filter((k) => door || k !== "H").flatMap((k) => cellsOf(rows, k, ox, oy).slice(0, 1))
    .map(([x, y]) => ({ x, y }));
  return { spawn: { x: sx + 0.5, y: sy + 0.5, z: z0, yaw: Math.PI / 2 }, stairs: zone.stairs, keyPoints };
}

// The parent's temple zone (story.js buildTemple at 75edbd3): 48×48×10, rock all round, the plan at
// (2, 2), no front door. Kept for the golden check and test.html; the game stamps the plan on the surface.
export function templeFixture(seed) {
  const rng = makeRng((seed ^ 0x7e3a1e) >>> 0);
  const f = new Zone({ key: "0,0,0", wx: 0, wy: 0, z: 0, type: "surface", level: 0, tier: 1, seed, w: 48, d: 48, h: 10,
                       name: TEMPLE_PLAN.name });
  f.blocks.fill(B.ROCK);
  const out = stampTemple(f, 2, 2, rng, { roof: "rock", door: false });
  f.spawn = out.spawn;
  f.entrance = f.stairs;
  f.hasSky = true;
  f.rooms = [];
  f.refresh();
  return f;
}

// The cube is taken: the wall behind the altar grinds aside, showing the way down.
export function openCubeWall(zone) {
  for (const [x, y] of zone.cubeWall || []) for (let z = FLOOR_Z; z < ROOM_TOP; z++) zone.set(x, y, z, B.AIR);
  zone.refresh();
}
