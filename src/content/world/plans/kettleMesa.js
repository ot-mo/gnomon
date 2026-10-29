// Kettle Mesa (bible §5 C, §15.3 C: (6, 14), the Rust Steps, tier 1; the first dungeon, 3 floors at levels 2-4; key
// shaftDrop): a hollow mesa like an upturned kettle, open to the sky. Its wall of red clay stands 10 blocks high round
// a hollow you walk into through the spout, a cleft in its south side; inside, a ring of ledges steps up the wall
// (a block, then two: the second a climb in 3D, a wall on the map), and in the middle the shaft's mouth, a stair down
// through brine-moss to the first floor. Outside the spout, a Rustback scavengers' camp: crates, scrap and bones.
//
// The plan is 33 × 36 (its corner at (23, 6)), made from rings round its middle (16, 15):
//   .  the ground as the world made it    #  the mesa's wall (clay, 10 high)     c  its crown (rock, 1 more)
//   1  the low ledge (a block up)         2  the high ledge (two up)              ,  the hollow's floor (clay)
//   m  brine-moss round the shaft         >  the stair down to the first floor
//   x  a crate (the scavengers')          k  scrap                                b  bones
import { B } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";

const W = 33, D = 36, CX = 16, CY = 15;
// The scavengers' camp, south of the spout (plan cells).
const CAMP = { "11,32": "x", "12,33": "x", "10,34": "k", "13,31": "b", "20,32": "k", "21,34": "x", "22,33": "b", "19,35": "k" };
// The rows, ring by ring; the spout is the cleft through the south wall, 3 wide at x 15..17.
export const KETTLE_ROWS = Array.from({ length: D }, (_, y) => Array.from({ length: W }, (_, x) => {
  const r = Math.hypot(x - CX, (y - CY) * 1.05), spout = x >= CX - 1 && x <= CX + 1 && y > CY;
  if (x === CX && y === CY) return ">";
  if (r > 15.5) return CAMP[`${x},${y}`] || ".";
  if (spout && r > 5.5) return ",";
  if (r > 13.5) return "c";
  if (r > 11.5) return "#";
  if (r > 10.4) return "2";
  if (r > 9) return "1";
  if (r < 2.5) return "m";
  return ",";
}).join(""));
const LEGEND = { ".": "keep", "#": "lm.stack", c: "lm.stack", "1": "lm.stack", "2": "lm.stack", ",": "lm.ground", m: "lm.ground",
                 ">": "stairs", x: "rubble", k: "prop", b: "prop" };
const STACKS = { "#": [B.CLAY, 10], c: [B.ROCK, 11], "1": [B.CLAY, 1], "2": [B.CLAY, 2] };
const GROUNDS = { ",": B.CLAY, m: B.MOSS };

export const KETTLE_MESA_PLAN = {
  id: "kettleMesa", name: "Kettle Mesa", rows: KETTLE_ROWS, legend: LEGEND, stacks: STACKS, grounds: GROUNDS,
  props: { k: "scrap", b: "bones" }, rubble: B.CRATE,
  height: 4, wall: B.CLAY, floorBlock: B.CLAY, roof: "none",
  at: [0, 0], hub: [CX, D - 1],   // outside the spout
  stamp(zone, ox, oy) {
    const still = makeRng(seedFor(zone.seed, "kettleMesa"));
    stampVault(zone, { name: "Kettle Mesa", plan: KETTLE_ROWS, height: 4, wall: B.CLAY, floorBlock: B.CLAY, links: [], legend: LEGEND,
                       stacks: STACKS, grounds: GROUNDS, props: this.props, rubble: B.CRATE }, ox, oy, still, { roof: "none" });
    return { spawn: null, keyPoints: [] };
  },
};
