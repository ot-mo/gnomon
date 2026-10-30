// The Square (bible §5 M, §15.3 M: (27, 2), the Deep Pleat, tier 6, the Assize's citadel; 5 floors, 3 down at levels
// 19-21 and 2 up at 22-23; keys identicalRooms + ruleBanners): a clearing cut perfectly square out of the folding
// forest, its trees felled in straight rows, the stumps left standing; in the middle a cube with no windows, stone, 12
// blocks every way. Its one gate is in the south face, where the Straight Cut arrives: behind it a gatehall cut into the cube,
// and the stair down to the cells (the floors up are integration request: the dungeon has only its floors down).
// Plumb characters are let in at the gate; two Rule-banners stand either side of it. The Square is the Assize's holy
// place (a Bent below Bright is trespass: C2's holy place); Truing Cradle #3 is on its first floor down.
//
// The plan is 44 × 44, its corner at (18, 2): the clearing, square to the tile. Letters:
//   .  the ground as the world made it (the lanes between the stumps, and the forecourt)   s  a stump (a block high)
//   C  the cube (stone, 12 × 12 × 12)   H  the gatehall (cut into the cube, 4 high under the rest of it)   D  the gate
//   >  the stair down    b  a Rule-banner on its pole    g  the gate's assizer
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, peopleKeys, column } from "./kit.js";

const W = 44, D = 44, CUBE = 12;
const G = new Grid(W, D);
for (let y = 2; y < D - 2; y += 3) for (let x = 2; x < W - 2; x += 3) G.put(x, y, "s");   // the stumps, in rows
G.fill(16, 14, 27, 25, "C");                    // the cube, 12 × 12 and 12 high
G.fill(19, 20, 24, 24, "H").put(21, 25, "D").put(22, 25, "D").put(21, 21, ">");
G.fill(16, 26, 27, 34, ".").put(18, 27, "b").put(25, 27, "b").put(21, 28, "g");   // the forecourt
export const SQUARE_ROWS = G.rows();
export const SQUARE_PEOPLE = { g: 1 };

const LEGEND = { ".": "keep", s: "lm.stack", C: "lm.stack", H: "lm.hall", D: "door", ">": "stairs", b: "lm.stack", g: "lm.person" };
const STACKS = { s: [B.TRUNK, 1], C: [B.STONE, CUBE], b: [B.METAL, 4] };
const HALLS = { H: [B.STONE, 4, CUBE] };

export const SQUARE_PLAN = {
  id: "square", name: "the Square", rows: SQUARE_ROWS, legend: LEGEND, stacks: STACKS, halls: HALLS,
  height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  at: [0, 0], hub: [21, 32],   // the forecourt, where the Straight Cut ends
  sinkholes: false,   // nobody falls into the cells: the gate is the way in (bible §5 M)
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "square"));
    stampVault(zone, { name: "the Square", plan: SQUARE_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: LEGEND,
                       stacks: STACKS, halls: HALLS }, ox, oy, still, { roof: "none" });
    // The gate in the cube's face (the stone goes on over it) and the stair's hall under the cube.
    for (const [x, y] of [...cells(SQUARE_ROWS, "D"), ...cells(SQUARE_ROWS, ">")]) column(zone, ox + x, oy + y, FLOOR_Z + 4, FLOOR_Z + CUBE, B.STONE);
    // The banners: a red cloth at the top of each pole.
    for (const [x, y] of cells(SQUARE_ROWS, "b")) zone.set(ox + x, oy + y, FLOOR_Z + 4, B.MOSAIC_RED);
    return { spawn: null, keyPoints: peopleKeys(SQUARE_ROWS, SQUARE_PEOPLE, ox, oy) };
  },
};
