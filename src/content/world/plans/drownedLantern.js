// The Drowned Lantern (bible §5 L, §15.3 L: (31, 16), the Glass Sea, tier 7, optional; 5 floors down at levels 20-24;
// key tideOfHours): a Deepwright lighthouse on an island at the end of the Glass Causeway, standing in glass up to its
// knees, its lamp long dead. The sea is deep all round (the span's other edges are shut); the causeway comes in from the
// north to the island's landing, wherever the road crosses the span's north edge. Inside the tower a stair goes down
// below the sea, to floors that are dry only from 11:00 to 13:00 (the tide: integration request).
//
// The plan is 80 × 43, its corner at (0, 5): the whole span south of the five rows the road comes in by. Letters:
//   .  the ground as the world made it (the causeway)   ~  deep water (the sea's)   s  shallows round the island
//   ,  glass crust (the island)    #  the tower's wall (stone, 14 high, its dead lamp of glass at the top)
//   h  its floor   D  its door (north, to the causeway)   >  the stair down   x  wreckage on the shore (scrap)
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, cells, column } from "./kit.js";

const W = 80, D = 43, CX = 40, CY = 22;
const G = new Grid(W, D, "~");
G.disc(CX, CY, 11.5, "s").disc(CX, CY, 9.5, ",");
G.fill(CX - 1, 0, CX + 1, CY - 7, ".");             // the causeway's last stretch, onto the island to the landing
G.disc(CX, CY, 4.5, "#").disc(CX, CY, 3.2, "h").put(CX, CY - 4, "D").put(CX + 1, CY + 1, ">");
for (const [x, y] of [[33, 27], [34, 28], [47, 18], [46, 26], [32, 19]]) G.put(x, y, "x");
export const DROWNED_LANTERN_ROWS = G.rows();

const TOWER = 14;
const LEGEND = { ".": "keep", "~": "deep", s: "shallow", ",": "lm.ground", "#": "wall", h: "floor", D: "door", ">": "stairs", x: "prop" };
const GROUND = { ...LEGEND, "#": "keep", h: "keep", D: "keep", ">": "keep" };
const GROUNDS = { ",": B.GLASS };

export const DROWNED_LANTERN_PLAN = {
  id: "drownedLantern", name: "the Drowned Lantern", rows: DROWNED_LANTERN_ROWS, legend: LEGEND, grounds: GROUNDS, props: { x: "scrap" },
  height: 5, wall: B.STONE, floorBlock: B.GLASS, roof: "slab",
  at: [0, 0], hub: [CX, CY - 7],   // the landing, before the tower's door
  tower: TOWER,
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "drownedLantern"));
    stampVault(zone, { name: "the Drowned Lantern", plan: DROWNED_LANTERN_ROWS, height: 4, wall: B.STONE, floorBlock: B.GLASS, links: [], legend: GROUND,
                       grounds: GROUNDS, props: this.props }, ox, oy, still, { roof: "none" });
    house(zone, ox, oy, DROWNED_LANTERN_ROWS, { id: "the Drowned Lantern", x: CX - 5, y: CY - 5, w: 11, d: 11, wall: B.STONE, floor: B.TILE, wallHeight: 5 },
          still, { "~": "keep", s: "keep", ",": "keep", x: "keep" });
    // The tower on up to 14 blocks, a ring of glass at its top where the lamp was.
    for (const [x, y] of cells(DROWNED_LANTERN_ROWS, "#")) column(zone, ox + x, oy + y, FLOOR_Z, FLOOR_Z + TOWER, B.STONE);
    for (const [x, y] of cells(DROWNED_LANTERN_ROWS, "D")) column(zone, ox + x, oy + y, FLOOR_Z + 5, FLOOR_Z + TOWER, B.STONE);
    for (const [x, y] of cells(DROWNED_LANTERN_ROWS, "#")) zone.set(ox + x, oy + y, FLOOR_Z + TOWER - 2, B.GLASS);
    return { spawn: null, keyPoints: [] };
  },
};
