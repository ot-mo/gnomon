// Foldmother (bible §5 P, §15.3 P: (12, 4), the Pleatwood, tier 3, optional; the Rootfold, 3 floors at levels 8-10; key
// twoLayouts): a tree as tall as a mesa, pleated like a paper lantern, with houses in the pleats. This is her day
// layout, a climbing village: 30 platforms in four rings round the trunk, 3, 6, 9 and 12 blocks up, one over another
// (8, 8, 8 and 6 of them, each ring's turned a little against the one below, like pleats), every platform joined to the
// next by a bridge one plank wide; under each platform of the three upper rings a house of thatch sits in the pleat
// against the trunk (a pod, filling the two blocks between rings); and a band of root-steps winds up round them all a
// block at a time. At dusk (18:00) the platforms fold into the trunk and the bridges vanish, and at dawn (06:00) they open
// again; whoever is out on a branch at dusk is folded in and dropped unhurt onto the Rootfold's first floor, and at night
// the map draws tomorrow's fold-lines as creases (zone.fold: src/gimmicks.js; B2, C1b #10). The map shows the ground under the
// platforms, as it does under any canopy. At her foot: the knot where she speaks, Warden Lumo, the Spore Moot's
// herbalist and a dial-stele; between two roots, the way down into the Rootfold.
//
// The plan is 41 × 37, its corner at (20, 5): her middle (20, 18). Letters:
//   .  the ground as the world made it    T  the trunk (14 high, a crown of leaves on top)
//   P  under the platforms (FOLDMOTHER_LAYOUT says which plank is where at each ring's height)
//   1-9, A, B, C  the root-steps' band, that many blocks high
//   >  the stair down    S  the dial-stele    people: m Foldmother's speaking knot   w Warden Lumo   e the herbalist
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor, distance } from "../../../rng.js";
import { stampVault } from "../../../gen/vaults.js";
import { Grid, cells, peopleKeys, mural } from "./kit.js";

export const RINGS = [3, 6, 9, 12];          // the platforms' heights (blocks: where you stand on them)
export const PLATFORMS = [8, 8, 8, 6];       // how many platforms each ring holds: 30 (bible §5 P's Flat line)
const TRUNK = 14, W = 41, D = 37, CX = 20, CY = 18, TRUNK_R = 4.6, RING_OUT = 9, STEP_OUT = 10.4, START = 1.5;   // (south-west)
const BRIDGE_R = (TRUNK_R + RING_OUT) / 2, POD_R = TRUNK_R + 1;
// How far round from east a direction is, 0 to 4, clockwise on the map (a "diamond angle": no trigonometry in generation).
const turnOf = (dx, dy) => (dy >= 0 ? (dx >= 0 ? dy / (dx + dy) : 1 - dx / (dy - dx)) : dx < 0 ? 2 - dy / (-dx - dy) : 3 + dx / (dx - dy));
const G = new Grid(W, D);
G.disc(CX, CY, RING_OUT, "P").disc(CX, CY, TRUNK_R, "T");
// The root-steps: a band round the platforms that climbs a block every twelfth of the way round, from 1 at the south-
// west (where the map walks in over the lowest steps) clockwise to 12, so every ring is a step off it at its height.
const STEPS = "123456789ABC";
for (let y = 0; y < D; y++)
  for (let x = 0; x < W; x++) {
    const r = distance(x - CX, y - CY);
    if (r <= RING_OUT || r > STEP_OUT) continue;
    const turn = ((turnOf(x - CX, y - CY) - START + 4) % 4) / 4;
    G.put(x, y, STEPS[Math.min(11, Math.floor(turn * 12))]);
  }
G.put(CX - 6, CY + 12, ">").put(CX, CY - 5, "m").put(CX - 3, CY - 13, "w").put(CX + 12, CY + 2, "e").put(CX - 12, CY - 3, "S");
export const FOLDMOTHER_ROWS = G.rows();
export const FOLDMOTHER_PEOPLE = { m: 1, w: 1, e: 1 };

// The day layout, ring by ring (plan cells): its platforms (each a list of cells), its bridges (one cell between each
// platform and the next), and the pods under it. A cell of the ring belongs to the platform of its sector; the cells on
// a sector's edge next to the following sector are the gap, but for the one nearest the ring's middle: the bridge.
export const FOLDMOTHER_LAYOUT = RINGS.map((h, i) => {
  const n = PLATFORMS[i], turn = (i * 0.37) / n, sector = new Map();
  for (const [x, y] of cells(FOLDMOTHER_ROWS, "P")) {
    const frac = ((turnOf(x - CX, y - CY) / 4 + turn) % 1 + 1) % 1;
    sector.set(`${x},${y}`, Math.min(n - 1, Math.floor(frac * n)));
  }
  const platforms = Array.from({ length: n }, () => []), gaps = Array.from({ length: n }, () => []);
  for (const [k, s] of sector) {
    const [x, y] = k.split(",").map(Number);
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sector.get(`${x + dx},${y + dy}`) === (s + 1) % n);
    (edge ? gaps : platforms)[s].push([x, y]);
  }
  const near = (list, r) => list.reduce((b, c) => (Math.abs(distance(c[0] - CX, c[1] - CY) - r) < Math.abs(distance(b[0] - CX, b[1] - CY) - r) ? c : b));
  const bridges = gaps.map((g) => near(g, BRIDGE_R));
  const pods = i < RINGS.length - 1 ? platforms.map((p) => near(p, POD_R)) : [];
  return { height: h, platforms, bridges, pods };
});

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
  steles: [{ at: [CX - 12, CY - 3], hour: 18 }],   // at her foot, its carved hour dusk, when she closes
  at: [0, 0], hub: [CX, D - 3],   // south of her, on the way in
  rings: RINGS,
  stamp(zone, ox, oy) {
    stampVault(zone, { name: "Foldmother", plan: FOLDMOTHER_ROWS, height: 4, wall: B.TRUNK, floorBlock: B.DIRT, links: [], legend: LEGEND,
                       stacks: STACKS }, ox, oy, makeRng(seedFor(zone.seed, "foldmother")), { roof: "none" });
    // The platforms and their bridges, ring by ring, and the pods in the pleats between one ring and the next.
    zone.fold = { open: true, planks: [] };
    FOLDMOTHER_LAYOUT.forEach(({ height, platforms, bridges, pods }, i) => {
      for (const [x, y] of [...platforms.flat(), ...bridges]) { zone.set(ox + x, oy + y, FLOOR_Z + height - 1, B.PLANK); zone.fold.planks.push([ox + x, oy + y, FLOOR_Z + height - 1]); }
      for (const [x, y] of pods) for (let z = FLOOR_Z + height; z < FLOOR_Z + RINGS[i + 1] - 1; z++) zone.set(ox + x, oy + y, z, B.THATCH);
    });
    // The crown: leaves over the trunk's top.
    for (const [x, y] of cells(FOLDMOTHER_ROWS, "T"))
      for (let z = FLOOR_Z + TRUNK - 2; z < FLOOR_Z + TRUNK; z++) if (distance(x - CX, y - CY) > 2.5) zone.set(ox + x, oy + y, z, B.LEAVES);
    const [[sx, sy]] = cells(FOLDMOTHER_ROWS, "S");
    zone.set(ox + sx, oy + sy, FLOOR_Z + 1, B.MURAL);
    mural(zone, ox + sx, oy + sy, FLOOR_Z + 1, "3d", FOLDMOTHER_STELE);
    return { spawn: null, keyPoints: peopleKeys(FOLDMOTHER_ROWS, FOLDMOTHER_PEOPLE, ox, oy) };
  },
};
