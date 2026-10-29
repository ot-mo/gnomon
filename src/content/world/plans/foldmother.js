// Foldmother (bible §5 P, §15.3 P: (12, 4), the Pleatwood, tier 3, optional; the Rootfold, 3 floors at levels 8-10; key
// twoLayouts): a tree as tall as a mesa, pleated like a paper lantern, with houses in the pleats. This is her day
// layout: her platforms spread round the trunk in four rings, 3, 6, 9 and 12 blocks up, one over another, and a band
// of root-steps winds up round them a block at a time. At dusk (18:00) the platforms fold into the trunk and the
// bridges vanish (her night layout, and tomorrow's fold-lines drawn on the map as creases: integration request). The map
// shows the ground under the platforms, as it does under any canopy. At her foot: the knot where she speaks, Warden
// Lumo, the Spore Moot's herbalist and a dial-stele; between two roots, the way down into the Rootfold.
//
// The plan is 41 × 37, its corner at (20, 5): her middle (20, 18). Letters:
//   .  the ground as the world made it    T  the trunk (14 high, a crown of leaves on top)
//   P  a platform cell (plank, at each of the rings' heights)    1-9, A, B, C  the root-steps' band, that many blocks high
//   >  the stair down    S  the dial-stele    people: m Foldmother's speaking knot   w Warden Lumo   e the herbalist
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, peopleKeys, mural, column } from "./kit.js";

export const RINGS = [3, 6, 9, 12];   // the platforms' heights (blocks: where you stand on them)
const TRUNK = 14, W = 41, D = 37, CX = 20, CY = 18, TRUNK_R = 4.6, RING_OUT = 9, STEP_OUT = 10.4, START = 0.75 * Math.PI;
const G = new Grid(W, D);
G.disc(CX, CY, RING_OUT, "P").disc(CX, CY, TRUNK_R, "T");
// The root-steps: a band round the platforms that climbs a block every twelfth of the way round, from 1 at the south-
// west (where the map walks in over the lowest steps) clockwise to 12, so every ring is a step off it at its height.
const STEPS = "123456789ABC";
for (let y = 0; y < D; y++)
  for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - CX, y - CY);
    if (r <= RING_OUT || r > STEP_OUT) continue;
    const turn = ((Math.atan2(y - CY, x - CX) - START + 4 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI);
    G.put(x, y, STEPS[Math.min(11, Math.floor(turn * 12))]);
  }
G.put(CX - 6, CY + 12, ">").put(CX, CY - 5, "m").put(CX - 3, CY - 13, "w").put(CX + 12, CY + 2, "e").put(CX - 12, CY - 3, "S");
export const FOLDMOTHER_ROWS = G.rows();
export const FOLDMOTHER_PEOPLE = { m: 1, w: 1, e: 1 };

const STEP_H = Object.fromEntries([...STEPS].map((ch, k) => [ch, k + 1]));
const STACKS = { T: [B.TRUNK, TRUNK], S: [B.STONE, 2], ...Object.fromEntries(Object.entries(STEP_H).map(([ch, h]) => [ch, [B.TRUNK, h]])) };
const LEGEND = { ".": "keep", P: "keep", ">": "stairs", m: "lm.person", w: "lm.person", e: "lm.person",
                 ...Object.fromEntries(Object.keys(STACKS).map((ch) => [ch, "lm.stack"])) };

// The dial-stele at her foot (a relief, read in 3D).
export const FOLDMOTHER_STELE = "SHE OPENS AT DAWN AND CLOSES AT DUSK. WHAT IS OUT ON A BRANCH AT DUSK IS HERS.";

export const FOLDMOTHER_PLAN = {
  id: "foldmother", name: "Foldmother", rows: FOLDMOTHER_ROWS, legend: LEGEND, stacks: STACKS,
  height: 4, wall: B.TRUNK, floorBlock: B.DIRT, roof: "none",
  texts: [FOLDMOTHER_STELE],
  at: [0, 0], hub: [CX, D - 3],   // south of her, on the way in
  rings: RINGS,
  stamp(zone, ox, oy) {
    stampVault(zone, { name: "Foldmother", plan: FOLDMOTHER_ROWS, height: 4, wall: B.TRUNK, floorBlock: B.DIRT, links: [], legend: LEGEND,
                       stacks: STACKS }, ox, oy, makeRng(seedFor(zone.seed, "foldmother")), { roof: "none" });
    // The platforms: planks at each ring's height over every platform cell (and over the four ways in, as bridges).
    for (const [x, y] of cells(FOLDMOTHER_ROWS, "P")) for (const h of RINGS) zone.set(ox + x, oy + y, FLOOR_Z + h - 1, B.PLANK);
    // The crown: leaves over the trunk's top.
    for (const [x, y] of cells(FOLDMOTHER_ROWS, "T"))
      for (let z = FLOOR_Z + TRUNK - 2; z < FLOOR_Z + TRUNK; z++) if (Math.hypot(x - CX, y - CY) > 2.5) zone.set(ox + x, oy + y, z, B.LEAVES);
    const [[sx, sy]] = cells(FOLDMOTHER_ROWS, "S");
    zone.set(ox + sx, oy + sy, FLOOR_Z + 1, B.MURAL);
    mural(zone, ox + sx, oy + sy, FLOOR_Z + 1, "3d", FOLDMOTHER_STELE);
    return { spawn: null, keyPoints: peopleKeys(FOLDMOTHER_ROWS, FOLDMOTHER_PEOPLE, ox, oy) };
  },
};
