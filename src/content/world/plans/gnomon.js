// The Gnomon (bible §5 N, §15.3 N: (37, 3), the Lattice, tier 8; the Dial-works, 8 floors down at levels 23-30; key
// sweepingHand): a leaning needle of black truesteel, so tall that the top of it is weather. Its foot is voxels, at the
// span's middle (40, 24), where render3d starts the needle's billboard on whatever stands there (WS3 #10, WS2b #10):
// a plinth a block high, 5 × 5; a base 3 × 3 and 3 high; the needle itself one column 14 high, scenery's ceiling. Its
// door is south of the plinth, between two truesteel posts: the stair down into the Dial-works (the door opens only
// from 11:00 to 13:00, to the Plumb Key, the Cube turned on the threshold or Hierarch Strade: integration request; until
// then the doorway is open). Round the foot the ground is truesteel, and the Lattice's crystal stands in a broken ring.
//
// The plan is 31 × 21, its corner at (25, 14): its middle (15, 10) is the span's (40, 24). Letters:
//   .  the ground as the world made it    ,  truesteel underfoot (metal)    p  the plinth (rock, 1)
//   b  the base (rock, 3)    N  the needle (rock to the base's top, then shale: 14)    o  a door post (metal, 4)
//   >  the stair down    c  a crystal spar (2 to 6 high)
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, column } from "./kit.js";

export const NEEDLE = 14;   // blocks: the foot's height (DECISIONS: scenery at most 14 up)
const W = 31, D = 21, CX = 15, CY = 10;
const G = new Grid(W, D);
G.disc(CX, CY + 1, 5.5, ",");
G.fill(CX - 2, CY - 2, CX + 2, CY + 2, "p").fill(CX - 1, CY - 1, CX + 1, CY + 1, "b").put(CX, CY, "N");
G.put(CX - 1, CY + 4, "o").put(CX + 1, CY + 4, "o").put(CX, CY + 4, ">");
const SPARS = [[3, 4, 3], [5, 15, 5], [9, 1, 2], [21, 1, 4], [26, 5, 6], [27, 14, 3], [22, 19, 2], [8, 19, 4], [2, 10, 2], [28, 9, 5]];
for (const [x, y] of SPARS) G.put(x, y, "c");
export const GNOMON_ROWS = G.rows();

const LEGEND = { ".": "keep", ",": "lm.ground", p: "lm.stack", b: "lm.stack", N: "lm.stack", o: "lm.stack", ">": "stairs", c: "lm.stack" };
const GROUNDS = { ",": B.METAL };
const STACKS = { p: [B.ROCK, 1], b: [B.ROCK, 3], N: [B.ROCK, 3], o: [B.METAL, 4], c: [B.CRYSTAL, 2] };

export const GNOMON_PLAN = {
  id: "gnomon", name: "the Gnomon", rows: GNOMON_ROWS, legend: LEGEND, grounds: GROUNDS, stacks: STACKS,
  height: 4, wall: B.METAL, floorBlock: B.METAL, roof: "none",
  at: [0, 0], hub: [CX, CY + 7],   // south of the door
  foot: [CX, CY], needle: NEEDLE,
  stamp(zone, ox, oy) {
    stampVault(zone, { name: "the Gnomon", plan: GNOMON_ROWS, height: 4, wall: B.METAL, floorBlock: B.METAL, links: [], legend: LEGEND,
                       grounds: GROUNDS, stacks: STACKS }, ox, oy, makeRng(seedFor(zone.seed, "gnomon")), { roof: "none" });
    column(zone, ox + CX, oy + CY, FLOOR_Z + 3, FLOOR_Z + NEEDLE, B.SHALE);   // the needle's black, on its base
    for (const [x, y, h] of SPARS) column(zone, ox + x, oy + y, FLOOR_Z, FLOOR_Z + h, B.CRYSTAL);
    return { spawn: null, keyPoints: [] };
  },
};
