// Molar (bible §5 F, §15.3 F: (20, 9), the Teeth, tier 3, the pass town; the Root Canals, 2 floors at levels 8-9; keys
// borrowedDark + darkMapping): a caravanserai hollowed out of one tooth-shaped crag at the only road pass through the
// Teeth. The Old Rule runs straight through its gullet, a cleft open to the sky, lit by Chandler lamp-posts; the town's
// rooms are carved into the rock either side of it: north the toll-house (Mother Saffre: the toll, the bank, the clear-
// glim exchange), the inn, the map-seller and the checkpoint at the east mouth (Assizer Castor Dell-Cassin, from beat
// 2); south the market hall where the longbacks stand (Zaqar Tesfu of Nine Longbacks), Rook's bounty board, a niche with
// the dial-stele, and the cave where a stair goes down into the Root Canals, the smugglers' way round the checkpoint.
//
// The plan is 64 × 42, its corner at (8, 3); the 8 columns either side are left to the roads, which reach the gullet's
// mouths along them. Letters:
//   .  the ground as the world made it (the gullet included)   R  the crag (rock, 12 high)   P  a cusp of it (14)
//   H  a hall carved into the crag (4 of room, the crag over it)   L  a Chandler lamp-post   S  the dial-stele
//   >  the stair down into the Root Canals
// The toll gate ("Gate 1") is an arch across the gullet by the west mouth, its lintel over head height (TOLL_GATE).
//   people, each on a hall's floor: s Mother Saffre  i the innkeeper  m the map-seller  c Assizer Castor Dell-Cassin
//     z Zaqar Tesfu  r Rook  n Pell (days 5-6 of his round, in the market)
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, peopleKeys, mural } from "./kit.js";

const CRAG = 12, CUSP = 14;
export const TOLL_GATE = 4;   // the arch's column in the plan, by the west mouth
const G = new Grid(64, 42);
for (let y = 0; y < 42; y++) for (let x = 0; x < 64; x++) if (((x - 31.5) / 31) ** 4 + ((y - 19) / 16.5) ** 4 <= 1) G.put(x, y, "R");
for (const [x, y] of [[15, 4], [16, 4], [31, 3], [32, 3], [47, 4], [48, 4], [24, 34], [40, 34]]) G.put(x, y, "P");
G.fill(0, 17, 63, 21, ".");   // the gullet
// The halls: [x0, y0, x1, y1] inside, and the doorway onto the gullet.
export const MOLAR_HALLS = [
  { id: "tollHouse", room: [5, 11, 13, 15], door: [9, 16] }, { id: "inn", room: [18, 9, 29, 15], door: [23, 16] },
  { id: "mapSeller", room: [33, 12, 39, 15], door: [36, 16] }, { id: "checkpoint", room: [49, 11, 57, 15], door: [53, 16] },
  { id: "market", room: [6, 23, 21, 30], door: [13, 22] }, { id: "bounty", room: [25, 23, 31, 27], door: [28, 22] },
  { id: "stele", room: [35, 23, 37, 25], door: [36, 22] }, { id: "canals", room: [42, 23, 51, 29], door: [46, 22] },
];
for (const h of MOLAR_HALLS) G.fill(...h.room, "H").put(...h.door, "H");
for (const [x, y] of [[12, 17], [26, 21], [40, 17], [54, 21]]) G.put(x, y, "L");
G.put(36, 25, "S").put(47, 27, ">");
G.put(9, 13, "s").put(25, 12, "i").put(36, 14, "m").put(53, 13, "c").put(10, 27, "z").put(28, 25, "r").put(16, 25, "n");
export const MOLAR_ROWS = G.rows();
export const MOLAR_PEOPLE = { s: 1, i: 1, m: 1, c: 1, z: 1, r: 1, n: 1 };

const HALLS = Object.fromEntries(["H", "S", ">", ...Object.keys(MOLAR_PEOPLE)].map((ch) => [ch, [B.ROCK, 4, CRAG]]));
const LEGEND = { ".": "keep", R: "lm.stack", P: "lm.stack", L: "station", H: "lm.hall", S: "lm.hall", ">": "stairs",
                 ...Object.fromEntries(Object.keys(MOLAR_PEOPLE).map((ch) => [ch, "lm.hall"])) };
const STACKS = { R: [B.ROCK, CRAG], P: [B.ROCK, CUSP] };

export function stampMolar(zone, ox, oy) {
  const still = makeRng(seedFor(zone.seed, "molar"));
  stampVault(zone, { name: "Molar", plan: MOLAR_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: LEGEND,
                     stacks: STACKS, halls: HALLS }, ox, oy, still, { roof: "none" });
  // The stair's cave keeps its rock roof (the stairs legend floors the column: the crag goes back over it).
  const [[sx, sy]] = cells(MOLAR_ROWS, ">");
  for (let z = FLOOR_Z + 4; z < FLOOR_Z + CRAG; z++) zone.set(ox + sx, oy + sy, z, B.ROCK);
  // Lamps set in the halls' walls (the Chandlers' lamps, lit), one a hall on the side away from its door.
  for (const h of MOLAR_HALLS) {
    const [x0, y0, x1, y1] = h.room, north = h.door[1] < y0;
    zone.set(ox + ((x0 + x1) >> 1), oy + (north ? y1 + 1 : y0 - 1), FLOOR_Z + 2, B.LAMP);
  }
  // The toll gate: a lintel of dressed stone two blocks thick across the gullet, the road passing under it.
  for (let y = 17; y <= 21; y++) for (let z = FLOOR_Z + 4; z < FLOOR_Z + 6; z++) zone.set(ox + TOLL_GATE, oy + y, z, B.STONE);
  // The dial-stele: a stone with the Horary's carving, in its niche.
  const [[tx, ty]] = cells(MOLAR_ROWS, "S");
  zone.set(ox + tx, oy + ty, FLOOR_Z, B.STONE); zone.set(ox + tx, oy + ty, FLOOR_Z + 1, B.MURAL);
  mural(zone, ox + tx, oy + ty, FLOOR_Z + 1, "3d", MOLAR_STELE);
  return { spawn: null, keyPoints: peopleKeys(MOLAR_ROWS, MOLAR_PEOPLE, ox, oy) };
}
// The dial-stele's carving (a relief, read in 3D).
export const MOLAR_STELE = "THE HOUR PASSES THROUGH THE TOOTH AS THE ROAD DOES. IT PAYS NOTHING, AND IT IS NEVER TURNED BACK.";

export const MOLAR_PLAN = {
  id: "molar", name: "Molar", rows: MOLAR_ROWS, legend: LEGEND, stacks: STACKS, halls: HALLS,
  height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  texts: [MOLAR_STELE],
  at: [0, 0], hub: [32, 19],   // the middle of the gullet
  stamp: (zone, ox, oy) => stampMolar(zone, ox, oy),
};
