// Saltpage (bible §5 O, §15.3 O: (2, 4), the Salt Waste, tier 3, optional; the Under-Page, 3 floors at levels 8-10; key
// answerInFloor): a salt pan so flat that your footsteps come back off the horizon. Its crust is a mosaic map of a
// drowned city, the Page: 9 × 9 spans of it, three tiles to a span, its streets white, its blocks gold and red, its river
// and its harbour blue. Beside it the monastery of the Pressed, a house of one storey (they won't build up): the chapel
// where Father Bramwyn gives the Pressing rite, the library of flat readings, the cells, and the stair down into the
// Under-Page behind the chapel. The Page is the Pressed's holy ground and the monastery their holy place (C2's).
//
// The plan is 66 × 40, its corner at (7, 4). Letters:
//   .  the ground as the world made it    ,  the salt crust    w r g u  the Page: a street (white), a block (red, gold),
//   the water (blue)    #  the monastery's wall (salt, 4 high, a slab roof)    h  its floor    D  its door
//   :  an inner wall    x  a shelf of the library (a crate)    >  the stair down    l  a lamp in the wall
//   people: b Father Bramwyn the Flattened   i the ink-and-brine seller   y the librarian
import { B } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, peopleKeys } from "./kit.js";

const G = new Grid(66, 40, ",");
G.fill(0, 0, 65, 0, ".").fill(0, 39, 65, 39, ".").fill(0, 0, 0, 39, ".").fill(65, 0, 65, 39, ".");
// The Page: 27 × 27 at (34, 6), a span every 3 tiles: streets between blocks, a river across it and a harbour.
const PX = 34, PY = 6, PN = 27;
for (let y = 0; y < PN; y++)
  for (let x = 0; x < PN; x++) {
    const street = x % 3 === 0 || y % 3 === 0, river = Math.abs(x - y * 0.8 - 4) < 1.6, harbour = x > 19 && y > 19;
    G.put(PX + x, PY + y, harbour || river ? "u" : street ? "w" : (x * 7 + y * 3) % 5 < 2 ? "g" : "r");
  }
// The monastery: one storey, its rooms off one hall.
G.box(4, 10, 27, 29, [15, 29], "#", "h");
G.fill(5, 17, 26, 17, ":").put(10, 17, "h").put(21, 17, "h");          // the hall's north wall, with two doorways
G.fill(14, 11, 14, 16, ":").put(14, 14, "h");                           // the chapel (west) and the library (east)
for (const y of [12, 14]) G.fill(17, y, 25, y, "x");
G.put(9, 12, ">").put(4, 20, "l").put(27, 20, "l").put(4, 13, "l").put(27, 13, "l");
G.put(9, 15, "b").put(15, 25, "i").put(21, 15, "y");
export const SALTPAGE_ROWS = G.rows();
export const SALTPAGE_PEOPLE = { b: 1, i: 1, y: 1 };

const PAGE = { w: B.MOSAIC_WHITE, r: B.MOSAIC_RED, g: B.MOSAIC_GOLD, u: B.MOSAIC_BLUE };
const LEGEND = { ".": "keep", ",": "lm.ground", ...Object.fromEntries(Object.keys(PAGE).map((ch) => [ch, "lm.ground"])), "#": "wall", ":": "wall",
                 h: "floor", D: "door", x: "rubble", ">": "stairs", l: "lamp", b: "lm.person", i: "lm.person", y: "lm.person" };
const GROUND = { ...LEGEND, ...Object.fromEntries(["#", ":", "h", "D", "x", ">", "l", "b", "i", "y"].map((ch) => [ch, "keep"])) };
const GROUNDS = { ",": B.SALT, ...PAGE };

export const SALTPAGE_PLAN = {
  id: "saltpage", name: "Saltpage", rows: SALTPAGE_ROWS, legend: LEGEND, grounds: GROUNDS, rubble: B.PLANK,
  height: 4, wall: B.SALT, floorBlock: B.SALT, roof: "slab",
  at: [0, 0], hub: [15, 32],   // before the monastery's door
  page: { at: [PX, PY], size: PN, spans: 9 },
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "saltpage"));
    stampVault(zone, { name: "Saltpage", plan: SALTPAGE_ROWS, height: 4, wall: B.SALT, floorBlock: B.SALT, links: [], legend: GROUND,
                       grounds: GROUNDS }, ox, oy, still, { roof: "none" });
    const rows = SALTPAGE_ROWS.map((r) => r.replace(/:/g, "#"));
    house(zone, ox, oy, rows, { id: "Saltpage, the monastery", x: 4, y: 10, w: 24, d: 20, wall: B.SALT, floor: B.TILE, rubble: B.PLANK }, still,
          { b: "lm.person", i: "lm.person", y: "lm.person", x: "rubble" });
    return { spawn: null, keyPoints: peopleKeys(SALTPAGE_ROWS, SALTPAGE_PEOPLE, ox, oy) };
  },
};
