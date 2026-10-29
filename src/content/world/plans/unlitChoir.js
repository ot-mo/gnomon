// The Unlit Choir (bible §5 J, §15.3 J: (31, 6), the Shade, tier 6; 6 floors at levels 15-20; keys theDark +
// darkMapping): a Lampless cathedral sunk to its shoulders in the dusk, full of a song that doesn't come from anywhere.
// What stands above the ash is its top storey: a cross of mossy stone under a slab roof, its spires at the west front and
// round the crossing, and not one lamp. Inside, cold braziers down the nave (your torch lights them, and nothing else
// is lit), the choir's stalls in the transept where thol and the chanters keep the song, and in the apse the stair
// down into the sunken floors. Outside the west door, one of the Shade's rune circles, its gloss cut in a stone.
// A lit torch inside is trespass for the Lampless unless you carry the dark-pass from Halfnight (C2's holy place).
//
// The plan is 52 × 30, its corner at (14, 9). Letters:
//   .  the ground as the world made it    #  the walls (mossy stone, 5 high, a slab roof)    P  a spire (14 high)
//   h  the floor (stone)                  D  the west door    f  a cold brazier    x  a choir stall
//   >  the stair down    U  a rune stone of the circle (Y: the one with the gloss)
//   people: t thol, the choirmaster ghost   c a Lampless chanter
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, cells, peopleKeys, mural, column } from "./kit.js";

const G = new Grid(52, 30);
G.fill(9, 10, 44, 19, "#").fill(21, 3, 30, 26, "#").fill(43, 12, 49, 17, "#");          // nave, transept, apse
G.fill(10, 11, 43, 18, "h").fill(22, 4, 29, 25, "h").fill(44, 13, 48, 16, "h");
G.put(9, 14, "D");
for (const [x, y] of [[9, 10], [9, 19], [21, 10], [30, 10], [21, 19], [30, 19]]) G.put(x, y, "P");
for (const [x, y] of [[13, 12], [13, 17], [18, 12], [18, 17], [35, 12], [35, 17], [40, 12], [40, 17]]) G.put(x, y, "f");
for (let x = 23; x <= 28; x++) if (x !== 25 && x !== 26) for (const y of [6, 8, 21, 23]) G.put(x, y, "x");
G.put(46, 14, ">").put(25, 14, "t").put(25, 6, "c").put(26, 23, "c").put(38, 15, "c");
for (let k = 0; k < 8; k++) G.put(Math.round(4 + 3 * Math.cos((k * Math.PI) / 4)), Math.round(14.5 + 3 * Math.sin((k * Math.PI) / 4)), k === 4 ? "Y" : "U");
export const UNLIT_CHOIR_ROWS = G.rows();
export const UNLIT_CHOIR_PEOPLE = { t: 1, c: 1 };
export const UNLIT_CHOIR_GLOSS = "the song is a map\nsing it backwards\nand you are home";

const PEOPLE = { t: "lm.person", c: "lm.person" };
const LEGEND = { ".": "keep", "#": "wall", P: "wall", h: "floor", D: "door", f: "brazier", x: "rubble", ">": "stairs", U: "lm.stack", Y: "lm.stack", ...PEOPLE };
const GROUND = { ".": "keep", U: "lm.stack", Y: "lm.stack", ...Object.fromEntries(["#", "P", "h", "D", "f", "x", ">", "t", "c"].map((ch) => [ch, "keep"])) };
const STACKS = { U: [B.RUNE, 1], Y: [B.RUNE, 1] };
const WALL = 5, SPIRE = 14;

export const UNLIT_CHOIR_PLAN = {
  id: "unlitChoir", name: "the Unlit Choir", rows: UNLIT_CHOIR_ROWS, legend: LEGEND, stacks: STACKS, rubble: B.PLANK,
  height: WALL, wall: B.MOSS, floorBlock: B.STONE, roof: "slab",
  texts: [UNLIT_CHOIR_GLOSS],
  at: [0, 0], hub: [4, 14],   // the rune circle before the west door
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "unlitChoir"));
    stampVault(zone, { name: "the Unlit Choir", plan: UNLIT_CHOIR_ROWS, height: 4, wall: B.MOSS, floorBlock: B.ASH, links: [], legend: GROUND,
                       stacks: STACKS }, ox, oy, still, { roof: "none" });
    const rows = UNLIT_CHOIR_ROWS.map((r) => r.replace(/P/g, "#"));
    house(zone, ox, oy, rows, { id: "the Unlit Choir", x: 9, y: 3, w: 41, d: 24, wall: B.MOSS, floor: B.STONE, wallHeight: WALL }, still,
          { " ": "keep", ".": "keep", x: "rubble", ...PEOPLE });
    for (const [x, y] of cells(UNLIT_CHOIR_ROWS, "P")) column(zone, ox + x, oy + y, FLOOR_Z, FLOOR_Z + SPIRE, B.MOSS);
    const [[gx, gy]] = cells(UNLIT_CHOIR_ROWS, "Y");
    mural(zone, ox + gx, oy + gy, FLOOR_Z, "dark", UNLIT_CHOIR_GLOSS);
    return { spawn: null, keyPoints: peopleKeys(UNLIT_CHOIR_ROWS, UNLIT_CHOIR_PEOPLE, ox, oy) };
  },
};
