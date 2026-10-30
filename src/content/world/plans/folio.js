// Folio (bible §5 G, §15.3 G: (24, 15), the Tessellate, tier 4, the Flatfolk town; key mapOnlyTown): in 3D an empty
// paved plain; on the map a town drawn in lines, its streets, its market, an inn called the Margin and an archive.
// Folio exists only on the map, so its walls are mosaic: white lines in the paving, which the map draws in their
// colours and 3D sees as faded tiles underfoot (blocks.js: a mosaic is vivid from above). The one thing that stands up
// is the archive vault, a blank stone box in 3D; its door is drawn on the floor in front of it, in gold. On the map you
// walk through it into the archive (zone.drawnDoors: turns.js mapStep), and the town's drawn walls hold you to its
// streets there (zone.mapWalls); in 3D the box has no door and the walls are faded tiles (B2, C1b #12). Its people are
// Flatfolk, flat beings met only on the map (C3's kinds, C5's words).
//
// The plan is 62 × 36, its corner at (9, 6). Letters:
//   .  the ground as the world made it    ,  paving (tile)    w  a drawn wall (white)    g  the Margin's walls (gold)
//   r  a market stall (red)    u  the archive's line (blue)    A  the archive vault (stone, 4 high)    a  its inside (the
//   archive: a room under the box's roof, reached only through its drawn door)    d  the archive's drawn door (gold)    people: e Ell  k Kay of the Long Line  l Double-Ell  m the Margin's keeper
//   s the Survey's teacher  o the teacher of Lore
import { B } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, peopleKeys } from "./kit.js";

const G = new Grid(62, 36, ",");
G.fill(0, 0, 61, 0, ".").fill(0, 35, 61, 35, ".").fill(0, 0, 0, 35, ".").fill(61, 0, 61, 35, ".");   // a margin of the plain
// The town blocks: houses drawn as outlines with a gap for a door, on a grid of streets two wide.
const outline = (x0, y0, x1, y1, ch, door) => {
  for (let x = x0; x <= x1; x++) { G.put(x, y0, ch); G.put(x, y1, ch); }
  for (let y = y0; y <= y1; y++) { G.put(x0, y, ch); G.put(x1, y, ch); }
  if (door) G.put(door[0], door[1], ",");
};
for (let by = 0; by < 5; by++)
  for (let bx = 0; bx < 7; bx++) {
    const x0 = 3 + bx * 8, y0 = 2 + by * 7;
    if (by >= 1 && by <= 3 && bx >= 2 && bx <= 4) continue;   // the market and the Margin and the archive go here
    outline(x0, y0, x0 + 5, y0 + 4, "w", [x0 + 2 + (bx % 2), by % 2 ? y0 : y0 + 4]);
  }
// The Margin (the inn, a double house in gold), the market square with its stalls, the archive.
outline(19, 9, 30, 13, "g", [24, 13]);
for (const [x, y] of [[21, 18], [24, 18], [27, 18], [30, 18], [21, 21], [24, 21], [27, 21], [30, 21]]) G.fill(x, y, x + 1, y, "r");
outline(34, 9, 42, 15, "u", [38, 15]);
G.fill(36, 11, 40, 13, "A").fill(37, 12, 39, 12, "a").put(38, 14, "d");
G.put(24, 11, "e").put(38, 16, "k").put(26, 19, "l").put(27, 11, "m").put(21, 11, "s").put(29, 11, "o");
export const FOLIO_ROWS = G.rows();
export const FOLIO_PEOPLE = { e: 1, k: 1, l: 1, m: 1, s: 1, o: 1 };

const GROUNDS = { ",": B.TILE, w: B.MOSAIC_WHITE, g: B.MOSAIC_GOLD, r: B.MOSAIC_RED, u: B.MOSAIC_BLUE, d: B.MOSAIC_GOLD,
                  ...Object.fromEntries(Object.keys(FOLIO_PEOPLE).map((ch) => [ch, B.TILE])) };
const LEGEND = { ".": "keep", A: "lm.stack", a: "lm.hall", ...Object.fromEntries(Object.keys(GROUNDS).map((ch) => [ch, "lm.ground"])) };
const STACKS = { A: [B.STONE, 4] };
const HALLS = { a: [B.STONE, 3, 4] };   // the archive: 3 blocks of room under the box's stone (it reads as wall from above)
// The drawn walls (the town's lines) and the drawn door, in plan cells.
export const FOLIO_MAP_WALLS = ["w", "g", "u"];
export const FOLIO_DOOR = { wall: [38, 13], outside: [38, 14], inside: [38, 12] };

export const FOLIO_PLAN = {
  id: "folio", name: "Folio", rows: FOLIO_ROWS, legend: LEGEND, grounds: GROUNDS, stacks: STACKS, halls: HALLS,
  height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  at: [0, 0], hub: [25, 23],   // the market square
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "folio"));
    stampVault(zone, { name: "Folio", plan: FOLIO_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: LEGEND,
                       grounds: GROUNDS, stacks: STACKS, halls: HALLS }, ox, oy, still, { roof: "none" });
    zone.mapWalls = FOLIO_ROWS.flatMap((r, y) => [...r].flatMap((ch, x) => (FOLIO_MAP_WALLS.includes(ch) ? [ox + x + (oy + y) * zone.w] : [])));
    const at = ([x, y]) => [ox + x, oy + y];
    zone.drawnDoors = [{ wall: at(FOLIO_DOOR.wall), outside: at(FOLIO_DOOR.outside), inside: at(FOLIO_DOOR.inside) }];
    return { spawn: null, keyPoints: peopleKeys(FOLIO_ROWS, FOLIO_PEOPLE, ox, oy) };
  },
};
