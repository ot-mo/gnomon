// The Pressyard (bible §5 I, §15.3 I: (23, 7), the Tessellate, tier 4; the Press, 5 floors at levels 11-15; keys pressing
// + loweringCeiling): on the map, a perfect mosaic of a village across the field, its 41 houses squares of colour and
// its 300 people figures caught mid-stride; in 3D, faded tiles. Where the mosaic's well would be, a stair goes down to
// the Press, which the Assize have restarted; their engineers' camp stands at the field's east edge. The mosaic is the
// Pressed's holy ground (FAITHS.pressed: "the Pressyard's surface mosaic").
//
// The plan is 62 × 38, its corner at (9, 5). Letters:
//   .  the ground as the world made it    ,  the field's faded tiles    r b g  a house (red, blue, gold)
//   w  a person, mid-stride (white)       u  the well's water (blue) round the stair   >  the stair down
//   x  the engineers' crates              L  their lamp-post
// The mosaic is the same in every run (a fixed stream draws it): the village was pressed once.
import { B } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid } from "./kit.js";

const W = 62, D = 38, CX = 31, CY = 17;
const G = new Grid(W, D, ",");
G.fill(0, 0, W - 1, 0, ".").fill(0, D - 1, W - 1, D - 1, ".").fill(0, 0, 0, D - 1, ".").fill(W - 1, 0, W - 1, D - 1, ".");
const art = makeRng(seedFor(0, "pressyard mosaic"));
// The houses: 41 squares of 3 × 3 on a grid of 8 × 6 lots round the square, each a little off its lot.
const COLOURS = ["r", "b", "g"];
export const PRESSYARD_HOUSES = [];
for (let ly = 0; ly < 6 && PRESSYARD_HOUSES.length < 41; ly++)
  for (let lx = 0; lx < 8 && PRESSYARD_HOUSES.length < 41; lx++) {
    const x = 3 + lx * 7 + art.int(0, 2), y = 2 + ly * 6 + art.int(0, 1);
    if (Math.abs(x + 1 - CX) < 7 && Math.abs(y + 1 - CY) < 5) continue;   // the square
    G.fill(x, y, x + 2, y + 2, COLOURS[art.int(0, 2)]);
    PRESSYARD_HOUSES.push([x, y]);
  }
// The well and its stair, in the middle of the square.
G.disc(CX, CY, 2.3, "u").put(CX, CY, ">").fill(CX - 1, CY - 1, CX + 1, CY + 1, ",").put(CX, CY, ">");
// The people: 300 figures on the tiles, none on a house, the well or another figure, none beside the stair.
let people = 0;
for (let k = 0; k < 20000 && people < 300; k++) {
  const x = art.int(1, W - 2), y = art.int(1, D - 2);
  if (G.g[y][x] !== "," || Math.max(Math.abs(x - CX), Math.abs(y - CY)) <= 2) continue;
  G.put(x, y, "w");
  people++;
}
// The engineers' camp.
for (const [x, y] of [[58, 14], [59, 14], [58, 16], [60, 18], [59, 20]]) G.put(x, y, "x");
G.put(59, 17, "L");
export const PRESSYARD_ROWS = G.rows();
export const PRESSYARD_PEOPLE_FIGURES = people;

const GROUNDS = { ",": B.TILE, r: B.MOSAIC_RED, b: B.MOSAIC_BLUE, g: B.MOSAIC_GOLD, w: B.MOSAIC_WHITE, u: B.MOSAIC_BLUE };
const LEGEND = { ".": "keep", ">": "stairs", x: "rubble", L: "station", ...Object.fromEntries(Object.keys(GROUNDS).map((ch) => [ch, "lm.ground"])) };

export const PRESSYARD_PLAN = {
  id: "pressyard", name: "the Pressyard", rows: PRESSYARD_ROWS, legend: LEGEND, grounds: GROUNDS, rubble: B.CRATE,
  height: 4, wall: B.METAL, floorBlock: B.TILE, roof: "none",
  at: [0, 0], hub: [58, 22],   // by the engineers' camp, at the field's east edge
  stamp(zone, ox, oy) {
    stampVault(zone, { name: "the Pressyard", plan: PRESSYARD_ROWS, height: 4, wall: B.METAL, floorBlock: B.TILE, links: [], legend: LEGEND,
                       grounds: GROUNDS, rubble: B.CRATE }, ox, oy, makeRng(seedFor(zone.seed, "pressyard")), { roof: "none" });
    return { spawn: null, keyPoints: [] };
  },
};
