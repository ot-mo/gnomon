// Halfnight (bible §5 H, §15.3 H: (24, 11), (25, 11), (26, 11), the Tessellate on the Shade's edge, tier 4, the holy
// city; keys lightIsLaw + mystery): a city one street wide and three spans long, built exactly along the Shade's
// southern edge. Down the middle of the street runs the Line, a brass inlay nobody crosses without a reason; north of
// it the Lampless quarter, shuttered cells where no lamp may burn; south of it the Horary quarter, full of sundials. Three
// wards, a plan each (landmarks.js spanPlans: one per span, integration request):
//   West Ward (24, 11)    the Hour-house, the Horary cathedral, with the Noon Bell in its tower; Primate Ilyendra
//   Middle Ward (25, 11)  the market, the Line Court and Linekeeper Hasay Gudri, the city's reeve, a Chandler bank
//   East Ward (26, 11)    the Hush, the Lampless chapel, and Abbess Wisse; a ghost market whose stalls show only with
//                         your torch out, at night
// The Old Rule runs the length of the street on one side of the Line; the six columns at either end of a ward are left
// to the road, which reaches the street along them wherever it crosses the ward's edge.
//
// Each plan is 68 × 44, its corner at (6, 2). Letters (as in every ward):
//   .  the ground as the world made it: the street, which the road keeps to   ,  the paving   =  the Line (brass)
//   #  a house's wall (stone in the north row, brick in the south)  h  its floor   D  its door   l  a lamp in its wall
//   o  a sundial's pin (stone, 2 high)   d  its dial (gold mosaic)          x  a market stall (a crate)
//   West: H the Hour-house's walls (6 high)  B the Noon Bell's tower  p Primate Ilyendra
//   Middle: C the Line Court's walls  g Linekeeper Hasay Gudri  b the Chandler banker  q a Horary trader  w a Lampless trader
//   East: S the Hush's walls (mossy stone, no lamp)  U the rune in the Hush's wall  a Abbess Wisse  v a ghost trader
//         k a ghost market stall (ghost planks, a block up)
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, cells, peopleKeys, mural } from "./kit.js";

const W = 68, D = 44, STREET = [19, 23], LINE = 21;
// The street, the Line, and the houses of both rows except where a ward builds its own.
function ward(skipNorth = [], skipSouth = []) {
  const G = new Grid(W, D, ","), houses = [];   // the city's paving, but the street, which the road keeps to
  G.fill(0, STREET[0], W - 1, STREET[1], ".").fill(0, LINE, W - 1, LINE, "=");
  for (let k = 0; k < 8; k++) {
    const x0 = 3 + k * 8;
    if (!skipNorth.includes(k)) { G.box(x0, 11, x0 + 6, 17, [x0 + 3, 17]); houses.push({ id: `north${k}`, box: [x0, 11, x0 + 6, 17], wall: B.STONE }); }
    if (!skipSouth.includes(k)) {
      G.box(x0, 25, x0 + 6, 31, [x0 + 3, 25]).put(x0, 28, "l");
      houses.push({ id: `south${k}`, box: [x0, 25, x0 + 6, 31], wall: B.BRICK });
      G.put(x0 + 3, 34, "o").fill(x0 + 2, 35, x0 + 4, 35, "d").put(x0 + 1, 34, "d").put(x0 + 5, 34, "d");   // its sundial
    }
  }
  return { G, houses };
}

// West Ward: the Hour-house over three of the south row's lots, the Noon Bell's tower at its back.
const west = ward([], [2, 3, 4, 5]);
west.G.box(20, 25, 49, 39, [34, 25], "H", "h").fill(33, 36, 35, 38, "B").put(34, 30, "p").put(20, 30, "l").put(49, 30, "l").put(27, 39, "l").put(41, 39, "l");
export const HALFNIGHT_WEST_ROWS = west.G.rows();
// Middle Ward: the Line Court in the north row, the bank in the south, stalls along both sides of the street.
const middle = ward([3, 4], []);
middle.G.box(27, 9, 41, 17, [34, 17], "C", "h").put(34, 12, "g");
for (const x of [9, 12, 17, 20, 25, 28, 36, 44, 49, 52, 57, 60]) middle.G.put(x, 18, "x").put(x, 24, "x");
middle.G.put(46, 28, "b").put(10, 24, "q").put(21, 18, "w");
export const HALFNIGHT_MIDDLE_ROWS = middle.G.rows();
// East Ward: the Hush in the north row, the ghost market in the south.
const east = ward([3, 4], [2, 3, 4]);
east.G.box(27, 7, 41, 17, [34, 17], "S", "h").put(27, 12, "U").put(34, 10, "a");
for (const [x, y] of [[21, 27], [25, 27], [29, 27], [33, 27], [37, 27], [21, 31], [25, 31], [29, 31], [33, 31], [37, 31]]) east.G.fill(x, y, x + 1, y, "k");
east.G.put(23, 29, "v").put(31, 29, "v").put(39, 29, "v");
export const HALFNIGHT_EAST_ROWS = east.G.rows();

export const HALFNIGHT_PEOPLE = { west: { p: 1 }, middle: { g: 1, b: 1, q: 1, w: 1 }, east: { a: 1, v: 1 } };
const HOUSES = { west: [...west.houses, { id: "hourHouse", box: [20, 25, 49, 39], wall: B.STONE, wallHeight: 6 }],
                 middle: [...middle.houses, { id: "lineCourt", box: [27, 9, 41, 17], wall: B.STONE }],
                 east: [...east.houses, { id: "hush", box: [27, 7, 41, 17], wall: B.MOSS }] };

const PEOPLE_LETTERS = ["p", "g", "b", "q", "w", "a", "v"];
const LEGEND = { ".": "keep", ",": "lm.ground", "=": "lm.ground", o: "lm.stack", d: "lm.ground", x: "rubble", k: "lm.ghost", "#": "wall", H: "wall", C: "wall",
                 S: "wall", B: "lm.stack", U: "rune", h: "floor", D: "door", l: "lamp", ...Object.fromEntries(PEOPLE_LETTERS.map((ch) => [ch, "lm.person"])) };
// The ground pass: the street, the Line, the dials, the stalls; every house's cells wait for its own stamp.
const GROUND = { ...LEGEND, ...Object.fromEntries(["#", "H", "C", "S", "B", "U", "h", "D", "l", "p", "g", "b", "a"].map((ch) => [ch, "keep"])) };
const HOUSE = { h: "floor", B: "lm.stack", ...Object.fromEntries(PEOPLE_LETTERS.map((ch) => [ch, "lm.person"])) };
const GROUNDS = { ",": B.TILE, "=": B.METAL, d: B.MOSAIC_GOLD, q: B.TILE, w: B.TILE, v: B.TILE };
const STACKS = { o: [B.STONE, 2], B: [B.STONE, 12] };

function stampWard(which, rows) {
  return (zone, ox, oy) => {
    const still = makeRng(seedFor(zone.seed, `halfnight ${which}`));
    stampVault(zone, { name: "Halfnight", plan: rows, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: GROUND,
                       grounds: GROUNDS, stacks: STACKS, ghosts: { k: 1 }, rubble: B.CRATE }, ox, oy, still, { roof: "none" });
    const walled = rows.map((r) => r.replace(/[HCS]/g, "#"));   // (each house's walls as the vault legend's #)
    for (const h of HOUSES[which]) {
      const [x0, y0, x1, y1] = h.box;
      house(zone, ox, oy, walled, { id: `Halfnight, ${h.id}`, x: x0, y: y0, w: x1 - x0 + 1, d: y1 - y0 + 1, wall: h.wall, floor: B.TILE,
                                    wallHeight: h.wallHeight }, still, HOUSE);
    }
    if (which === "west") {
      // The Noon Bell's tower through the Hour-house's roof, the bell at its top; the Horary's sign inside the door.
      for (const [x, y] of cells(rows, "B")) for (let z = FLOOR_Z; z < FLOOR_Z + 12; z++) zone.set(ox + x, oy + y, z, z === FLOOR_Z + 11 && x === 34 && y === 37 ? B.METAL : B.STONE);
      zone.set(ox + 33, oy + 25, FLOOR_Z + 1, B.MURAL);
      mural(zone, ox + 33, oy + 25, FLOOR_Z + 1, "3d", HOUR_HOUSE_SIGN);
    }
    if (which === "east") {
      const [[ux, uy]] = cells(rows, "U");
      mural(zone, ox + ux, oy + uy, FLOOR_Z + 2, "dark", HUSH_RUNE);
    }
    return { spawn: null, keyPoints: peopleKeys(rows, HALFNIGHT_PEOPLE[which], ox, oy) };
  };
}
// The sign in the Hour-house (bible §2.2), on the wall inside its door; the rune in the Hush's west wall.
export const HOUR_HOUSE_SIGN = "LAMPS STAY LIT. THE HOURS ARE WATCHING.";
export const HUSH_RUNE = "put it out\nwe will still be here\nthat is the point";

const plan = (which, rows, extra, texts = []) => ({
  id: `halfnight${which[0].toUpperCase()}${which.slice(1)}`, name: "Halfnight", rows, legend: LEGEND, grounds: GROUNDS, stacks: STACKS,
  ghosts: { k: 1 }, rubble: B.CRATE, height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  texts, at: [0, 0], hub: [34, 20],   // the street, north of the Line
  street: STREET, line: LINE,
  // Where each faith's rule holds (bible §5 H, light as law; integration request): the north row is the Lampless
  // quarter (a lit torch there is trespass), and in the West Ward the Hour-house (a torch out there is trespass).
  areas: [{ faction: "lampless", rule: "noTorch", rect: [0, 0, W - 1, STREET[0] - 1] }, ...(extra || [])],
  stamp: stampWard(which, rows),
});
export const HALFNIGHT_WEST_PLAN = plan("west", HALFNIGHT_WEST_ROWS, [{ faction: "horary", rule: "torchLit", rect: [20, 25, 49, 39] }], [HOUR_HOUSE_SIGN]);
export const HALFNIGHT_MIDDLE_PLAN = plan("middle", HALFNIGHT_MIDDLE_ROWS);
export const HALFNIGHT_EAST_PLAN = plan("east", HALFNIGHT_EAST_ROWS, undefined, [HUSH_RUNE]);
