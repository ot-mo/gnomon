// Benchmark (bible §5 D, §15.3 D: (11, 12), on the edge of the Downs and the Rust Steps, tier 2, the Survey's hub;
// the Datum, 4 floors at levels 5-8, under the pillar; key trueLevel): a walled survey station round a Deepwright
// benchmark, a grey pillar cut with one level line, the Mark. Six instrument towers stand in a ring round it; the Old
// Rule comes in at the west gate and leaves by the east. Round the walls: the Signal Room (it shows the Hand), the Map
// Room (Location readings, the tier layer), the Surveyor-General's quarters, Saara Tovi's workshop, the leech's house,
// the fitting-house with Truing Cradle #1 (worked by Detail C), the Chandler bank, and the Drovers' caravan yard. The
// way down into the Datum is the stair at the pillar's foot.
//
// The plan is 64 × 38, its corner at (8, 5): a stone curtain wall 4 high (W) with a gate in the west and east sides,
// the plaza round the pillar (P, its middle Q a block taller with the Mark cut in it), the towers (T), the houses
// (# walls, h floor, D door, l a lamp in a wall), the Cradle (C), crates (x) and the stair (>). People (landmarks.js):
//   t Teodor Quint-Vey  a Saara Tovi  e the leech  c Detail C  b the Chandler banker  d the Drover caravan-master  n Pell
//   g the signaller (the Signal Room)  m the Map Room's surveyor
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, house, cells, peopleKeys, mural } from "./kit.js";

const G = new Grid(64, 38);
G.fill(2, 1, 61, 36, "W").fill(3, 2, 60, 35, ".");   // the curtain wall
G.fill(2, 17, 2, 20, ".").fill(61, 17, 61, 20, ".");  // the gates
export const BENCHMARK_HOUSES = [
  { id: "signal", box: [4, 2, 14, 8], door: [9, 8], wall: B.STONE },
  { id: "mapRoom", box: [16, 2, 25, 8], door: [20, 8], wall: B.STONE },
  { id: "quarters", box: [39, 2, 48, 8], door: [43, 8], wall: B.STONE },
  { id: "workshop", box: [50, 2, 59, 8], door: [54, 8], wall: B.BRICK },
  { id: "leech", box: [4, 29, 12, 35], door: [8, 29], wall: B.STONE },
  { id: "fitting", box: [14, 29, 22, 35], door: [18, 29], wall: B.STONE },
  { id: "bank", box: [41, 29, 49, 35], door: [45, 29], wall: B.BRICK },
];
for (const h of BENCHMARK_HOUSES) G.box(...h.box, h.door);
for (const h of BENCHMARK_HOUSES) { G.put(h.box[0], h.box[1] + 3, "l"); G.put(h.box[2], h.box[1] + 3, "l"); }
G.fill(31, 17, 33, 19, "P").put(32, 18, "Q");   // the pillar
for (const [x, y] of [[40, 13], [40, 23], [32, 9], [32, 27], [23, 13], [23, 23]]) G.fill(x, y, x + 1, y + 1, "T");
G.put(32, 22, ">");                              // the way down, at the pillar's foot
G.put(18, 33, "C");                              // Truing Cradle #1
// The caravan yard (crates along the south-east wall) and who stands where.
for (const [x, y] of [[52, 33], [53, 33], [55, 34], [57, 32], [58, 34], [56, 31]]) G.put(x, y, "x");
G.put(9, 5, "g").put(20, 5, "m").put(44, 5, "t").put(54, 4, "a").put(8, 32, "e").put(18, 32, "c").put(45, 32, "b").put(54, 31, "d").put(36, 21, "n");
export const BENCHMARK_ROWS = G.rows();
export const BENCHMARK_PEOPLE = { t: 1, a: 1, e: 1, c: 1, b: 1, d: 1, n: 1, g: 1, m: 1 };

const PEOPLE_FLOOR = Object.fromEntries(Object.keys(BENCHMARK_PEOPLE).map((ch) => [ch, "lm.person"]));
const LEGEND = { ".": "keep", W: "lm.stack", P: "lm.stack", Q: "lm.stack", T: "lm.stack", ">": "stairs", x: "rubble", C: "cradle",
                 h: "floor", ...PEOPLE_FLOOR };
const STACKS = { W: [B.STONE, 4], P: [B.STONE, 8], Q: [B.STONE, 9], T: [B.METAL, 8] };
const GROUND = { ...LEGEND, "#": "keep", D: "keep", h: "keep", l: "keep", C: "keep", d: "keep", n: "keep",
                 ...Object.fromEntries(["t", "a", "e", "c", "b", "g", "m"].map((ch) => [ch, "keep"])) };
const HOUSE = { h: "floor", C: "cradle", ...PEOPLE_FLOOR };

export function stampBenchmark(zone, ox, oy) {
  const still = makeRng(seedFor(zone.seed, "benchmark"));
  stampVault(zone, { name: "Benchmark", plan: BENCHMARK_ROWS, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [], legend: GROUND,
                     stacks: STACKS, rubble: B.CRATE }, ox, oy, still, { roof: "none" });
  for (const h of BENCHMARK_HOUSES) {
    const [x0, y0, x1, y1] = h.box;
    house(zone, ox, oy, BENCHMARK_ROWS, { id: `Benchmark, ${h.id}`, x: x0, y: y0, w: x1 - x0 + 1, d: y1 - y0 + 1, wall: h.wall, floor: B.TILE }, still, HOUSE);
  }
  // The towers' instruments (a brass lens on each) and the Mark, the level line cut round the pillar's middle.
  for (const [x, y] of cells(BENCHMARK_ROWS, "T")) zone.set(ox + x, oy + y, FLOOR_Z + 8, B.GLASS);
  const [[qx, qy]] = cells(BENCHMARK_ROWS, "Q");
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) zone.set(ox + qx + dx, oy + qy + dy, FLOOR_Z + 3, B.RUNE);
  zone.set(ox + qx, oy + qy + 1, FLOOR_Z + 1, B.MURAL);
  mural(zone, ox + qx, oy + qy + 1, FLOOR_Z + 1, "3d", BENCHMARK_MARK);
  const [[cx, cy]] = cells(BENCHMARK_ROWS, "C");
  zone.cradle = { x: ox + cx, y: oy + cy };
  return { spawn: null, keyPoints: peopleKeys(BENCHMARK_ROWS, BENCHMARK_PEOPLE, ox, oy) };
}
// What is cut in the pillar's south face, under the Mark (a relief, read in 3D).
export const BENCHMARK_MARK = "THE DATUM. ALL HEIGHTS FROM HERE. CUT IN THE YEAR THE GROUND WAS LEVEL.";

export const BENCHMARK_PLAN = {
  id: "benchmark", name: "Benchmark", rows: BENCHMARK_ROWS, legend: { ...LEGEND, "#": "wall", D: "door", l: "lamp" }, stacks: STACKS,
  rubble: B.CRATE, height: 4, wall: B.STONE, floorBlock: B.TILE, roof: "none",
  texts: [BENCHMARK_MARK],
  areas: [{ faction: "plan", rule: "holy", rect: [14, 29, 22, 35] }],   // the fitting-house: the Truing Cradles are the Plan's (FAITHS)
  at: [0, 0], hub: [32, 25],   // the plaza, south of the pillar: where the Old Rule meets itself
  stamp: (zone, ox, oy) => stampBenchmark(zone, ox, oy),
};
