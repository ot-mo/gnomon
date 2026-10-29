// The Metronome (bible §5 K, §15.3 K: (37, 13), the Stacks, tier 6; 6 floors at levels 17-22; key oneBeat): a
// Deepwright foundry tower built round a pendulum that swings through the central shaft of every floor, the Plan's holy
// place (bombing a wall here is desecration, Plan −50 a block: C2's holy place). Above ground stands the tower, iron and
// 14 blocks high, in a walled foundry yard of slag heaps and furnaces; the Old Rule's south spur comes in at the yard's
// west gate. Inside the tower's ground storey the pendulum's bob hangs over the shaft, and the stair beside it goes down
// to the first floor; Section Nine, the Chief Draughtsman, keeps the drawings here, with the draughtsmen.
//
// The plan is 60 × 40, its corner at (12, 4); the columns west of it are left to the road. Letters:
//   .  the ground as the world made it (the lane from the gate to the tower's door)   ,  cinders (ash)
//   Y  the yard's wall (brick, 3 high)   T  the tower's wall (iron, 14 high)   h  its floor (tile)   D  its door
//   o  the shaft round the pendulum's bob (iron grating, the floor)   O  the bob   >  the stair down
//   k  a slag heap (scrap)   f  a furnace (a lit brazier)   l  a lamp in the tower's wall
//   people: s Section Nine   d a draughtsman
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, cells, peopleKeys, column } from "./kit.js";

const G = new Grid(60, 40, ",");
G.fill(0, 0, 59, 0, ".").fill(0, 39, 59, 39, ".").fill(0, 0, 0, 39, ".").fill(59, 0, 59, 39, ".");
G.fill(1, 1, 58, 38, "Y").fill(2, 2, 57, 37, ",");
G.fill(0, 17, 21, 21, ".");                        // the gate and the lane to the tower's door
G.box(22, 9, 41, 30, [22, 19], "T", "h");          // the tower, its door facing the gate
G.fill(30, 17, 33, 21, "o").put(31, 19, "O").put(32, 19, "O").put(35, 19, ">");
for (const [x, y] of [[22, 13], [22, 25], [41, 15], [41, 23], [28, 9], [35, 9], [28, 30], [35, 30]]) G.put(x, y, "l");
for (const [x, y] of [[6, 5], [7, 5], [6, 6], [10, 32], [11, 33], [48, 6], [49, 7], [52, 31], [53, 31], [52, 32]]) G.put(x, y, "k");
for (const [x, y] of [[12, 8], [16, 8], [12, 30], [16, 30], [47, 14], [47, 25]]) G.put(x, y, "f");
G.put(27, 13, "s").put(25, 24, "d").put(38, 13, "d");
export const METRONOME_ROWS = G.rows();
export const METRONOME_PEOPLE = { s: 1, d: 1 };

const TOWER = 14;
const LEGEND = { ".": "keep", ",": "lm.ground", Y: "lm.stack", T: "wall", h: "floor", D: "door", o: "lm.ground", O: "lm.ground", ">": "stairs",
                 k: "prop", f: "lm.stack", l: "lamp", s: "lm.person", d: "lm.person" };
const GROUND = { ...LEGEND, ...Object.fromEntries(["T", "h", "D", "o", "O", ">", "l", "s", "d"].map((ch) => [ch, "keep"])) };
const GROUNDS = { ",": B.ASH, o: B.METAL, O: B.METAL };
const STACKS = { Y: [B.BRICK, 3], f: [B.BRAZIER_LIT, 1] };

export const METRONOME_PLAN = {
  id: "metronome", name: "the Metronome", rows: METRONOME_ROWS, legend: LEGEND, grounds: GROUNDS, stacks: STACKS, props: { k: "scrap" },
  height: 6, wall: B.METAL, floorBlock: B.TILE, roof: "slab",
  at: [0, 0], hub: [19, 19],   // before the tower's door
  tower: TOWER,
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "metronome"));
    stampVault(zone, { name: "the Metronome", plan: METRONOME_ROWS, height: 4, wall: B.BRICK, floorBlock: B.ASH, links: [], legend: GROUND,
                       grounds: GROUNDS, stacks: STACKS, props: this.props }, ox, oy, still, { roof: "none" });
    const rows = METRONOME_ROWS.map((r) => r.replace(/T/g, "#"));
    house(zone, ox, oy, rows, { id: "the Metronome", x: 22, y: 9, w: 20, d: 22, wall: B.METAL, floor: B.TILE, wallHeight: 6 }, still,
          { o: "lm.ground", O: "lm.ground", s: "lm.person", d: "lm.person" });
    // The ground storey's grating, and the tower above it: its walls on up to 14 blocks.
    for (const [x, y] of [...cells(METRONOME_ROWS, "o"), ...cells(METRONOME_ROWS, "O")]) zone.set(ox + x, oy + y, FLOOR_Z - 1, B.METAL);
    for (const [x, y] of cells(METRONOME_ROWS, "T")) column(zone, ox + x, oy + y, FLOOR_Z, FLOOR_Z + TOWER, B.METAL);
    for (const [x, y] of [...cells(METRONOME_ROWS, "l"), ...cells(METRONOME_ROWS, "D")]) column(zone, ox + x, oy + y, FLOOR_Z + 6, FLOOR_Z + TOWER, B.METAL);
    // The pendulum's rod down from the storey's ceiling and its bob, a block off the grating.
    for (const [x, y] of cells(METRONOME_ROWS, "O")) column(zone, ox + x, oy + y, FLOOR_Z + 1, FLOOR_Z + 6, B.METAL);
    return { spawn: null, keyPoints: peopleKeys(METRONOME_ROWS, METRONOME_PEOPLE, ox, oy) };
  },
};
