// The Tall Table (bible §5 E, §15.3 E: (8, 9), the Rust Steps, tier 2, optional; key climbUp): a mesa sheer on every
// side, 12 blocks to its flat top, where the Kites keep their aerie of wind-chimes. There is no map path up: the map
// draws the whole mesa as one wall. The only way is the climb cut into the south face, in 3D:
//   two crates, wind-cut steps a block at a time, a run and a gap of 3 (a sprinting jump: walking falls short), more
//   steps, a gap of 5 bridged by ghost planks (seen only with your torch out, at night: too far to jump), more steps,
//   a second sprinting jump, and the last step up onto the top.
// Kite perches stand out from the cliff 3 to 5 blocks up, each with its nest (zone.perches: where a kite carries what
// it steals). Wings, Stilt Legs or a potion of flying make the climb easy, as the bible says.
//
// The plan is 41 × 26, its corner at (20, 12). Letters:
//   .  the ground as the world made it    M  the mesa (clay, 12 high: its top is where you stand up there)
//   1-9, A, B  the climb's steps, that many blocks high (A 10, B 11)   g  a gap in the climb (the ground below)
//   ~  the ghost planks over the third gap, 8 blocks up                n  a perch with its nest (N: its height, below)
//   on the top: K Kreeva Old-Wing   T the feather-trader   S the dial-stele   O the overlook   c a wind-chime post
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, mural } from "./kit.js";

export const TOP = 12;   // blocks: the top's height (DECISIONS: standable ground at most 12 up)
const G = new Grid(41, 26);
G.fill(6, 3, 36, 20, "M");
for (const [x, y] of [[6, 3], [7, 3], [6, 4], [36, 3], [35, 3], [36, 4], [6, 20], [6, 19], [7, 20]]) G.put(x, y, ".");   // the corners, worn round (not the south-east: the climb comes up there)
// The climb along the south face (rows 21-22), west to east: the height of each column of it ("g" a gap, "~" planks).
export const CLIMB = ["1", "2", "3", "4", "4", "g", "g", "g", "4", "4", "5", "6", "7", "8", "~", "~", "~", "~", "~", "8", "9", "A", "A",
                      "g", "g", "g", "A", "A", "B"];
CLIMB.forEach((ch, k) => G.put(8 + k, 21, ch).put(8 + k, 22, ch));
// The perches (3 to 5 up) on the east, north and west faces.
export const PERCHES = [[37, 8, 3], [14, 2, 5], [27, 2, 4], [5, 12, 4]];
for (const [x, y] of PERCHES) G.put(x, y, "n");
// The top: chimes round the aerie, the stele, the overlook at the north-east corner, and who stands where.
for (const [x, y] of [[12, 7], [16, 6], [20, 7], [24, 6], [28, 7], [14, 12], [26, 12], [18, 15], [22, 15]]) G.put(x, y, "c");
G.put(20, 10, "K").put(25, 16, "T").put(10, 15, "S").put(34, 5, "O");
export const TALL_TABLE_ROWS = G.rows();
export const TALL_TABLE_TOP_PEOPLE = { K: 1, T: 1, O: 1 };

const STEP = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, A: 10, B: 11 };
const STACKS = { M: [B.CLAY, TOP], K: [B.CLAY, TOP], T: [B.CLAY, TOP], S: [B.CLAY, TOP], O: [B.CLAY, TOP], c: [B.CLAY, TOP],
                 ...Object.fromEntries(Object.entries(STEP).map(([ch, h]) => [ch, [ch === "1" || ch === "2" ? B.CRATE : B.CLAY, h]])) };
const LEGEND = { ".": "keep", g: "keep", "~": "lm.ghost", n: "lm.stack", ...Object.fromEntries(Object.keys(STACKS).map((ch) => [ch, "lm.stack"])) };

export function stampTallTable(zone, ox, oy) {
  const still = makeRng(seedFor(zone.seed, "tallTable"));
  stampVault(zone, { name: "the Tall Table", plan: TALL_TABLE_ROWS, height: 4, wall: B.CLAY, floorBlock: B.CLAY, links: [], legend: LEGEND,
                     stacks: STACKS, ghosts: { "~": 8 } }, ox, oy, still, { roof: "none" });
  // The perches: rock out of the cliff, the nest on top (the map shows the nest where it can, never the height).
  zone.perches = [];
  for (const [x, y, h] of PERCHES) {
    for (let z = FLOOR_Z; z < FLOOR_Z + h; z++) zone.set(ox + x, oy + y, z, B.ROCK);
    zone.props.push({ x: ox + x + 0.5, y: oy + y + 0.5, z: FLOOR_Z + h, kind: "nest" });
    zone.perches.push({ x: ox + x, y: oy + y, z: FLOOR_Z + h });
  }
  // On the top: wind-chime posts (a post and a glass chime), the dial-stele with its carving.
  const top = FLOOR_Z + TOP;
  for (const [x, y] of cells(TALL_TABLE_ROWS, "c")) { zone.set(ox + x, oy + y, top, B.METAL); zone.set(ox + x, oy + y, top + 1, B.GLASS); }
  const [[sx, sy]] = cells(TALL_TABLE_ROWS, "S");
  zone.set(ox + sx, oy + sy, top, B.STONE); zone.set(ox + sx, oy + sy, top + 1, B.MURAL);
  mural(zone, ox + sx, oy + sy, top + 1, "3d", TALL_TABLE_STELE);
  // Nobody up there is a key point: the map can't reach the top (check-landmarks walks it in 3D instead).
  return { spawn: null, keyPoints: [] };
}
// The dial-stele on the top (a relief, read in 3D).
export const TALL_TABLE_STELE = "THE WIND IS THE HOUR'S BREATH. WHOEVER CLIMBS HERE IS LATE.";

export const TALL_TABLE_PLAN = {
  id: "tallTable", name: "the Tall Table", rows: TALL_TABLE_ROWS, legend: LEGEND, stacks: STACKS, ghosts: { "~": 8 },
  height: 4, wall: B.CLAY, floorBlock: B.CLAY, roof: "none",
  texts: [TALL_TABLE_STELE],
  steles: [{ at: [10, 15], hour: 6, z: TOP + 1 }],   // on the top, its carved hour dawn
  at: [0, 0], hub: [8, 24],   // the foot of the climb
  top: TOP, climb: CLIMB, perches: PERCHES,
  stamp: (zone, ox, oy) => stampTallTable(zone, ox, oy),
};
