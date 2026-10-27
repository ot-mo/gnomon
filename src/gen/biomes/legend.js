// WS2's legend handlers (TECH_DESIGN §5.4): the letters a landmark or building plan uses for outdoor things,
// registered with gen/vaults.js registerLegend (it throws on a duplicate id). A plan maps its own letters to these
// ids with `legend: { ch: id }`; what a letter needs beyond its id comes from the plan:
//   plan.props      { ch: prop }      which prop (content/biomes.js PROPS) a "prop" letter stands for (else a shrub)
//   plan.creatures  { ch: type }      which creature a "creature" letter places (else none)
//   plan.rubble     block id          what a "rubble" letter's 1-block step is made of (else rock)
//
//   tree      a trunk 4 blocks high on floor; gen/surface.js stampPlan adds its 3×3 canopy once the whole plan is
//             down (a later cell's column would clear it), only into air
//   prop      floor with a prop on it (zone.props)
//   shallow   shallow water at the datum, rock under it (a plan stamped at baseZ = FLOOR_Z; validateSurface fails
//   deep      deep water          water off the datum)
//   road      floor whose ground is road
//   path      floor whose ground is dirt (a footpath)
//   rubble    floor with a 1-block step of rubble on it
//   station   a lamp post: two blocks of the plan's wall and a lamp on top (a commons lamp, an outdoor light)
//   creature  floor with the plan's creature for that letter standing on it (idle, the zone's level)
import { B, FLOOR_Z } from "../../world.js";
import { registerLegend, floorCol, column, roofAt } from "../vaults.js";
import { spawnCreature, addCreature } from "../../creatures.js";
import { PROPS } from "../../content/biomes.js";

export const TREE_TRUNK = 4;
const at = (c, dz, block) => c.zone.set(c.x, c.y, c.z0 + dz, block);
const ground = (c, block) => { floorCol(c); c.zone.set(c.x, c.y, c.z0 - 1, block); };
const water = (block) => (c) => column(c, (z) => (z < FLOOR_Z - 1 ? B.ROCK : z === FLOOR_Z - 1 ? block : z < c.top ? B.AIR : roofAt(c, z)));

registerLegend("tree", (c) => { floorCol(c); for (let dz = 0; dz < TREE_TRUNK; dz++) at(c, dz, B.TRUNK); });
registerLegend("prop", (c) => {
  floorCol(c);
  const kind = c.vault.props?.[c.ch];
  c.zone.props.push({ x: c.x + 0.5, y: c.y + 0.5, z: c.z0, kind: PROPS[kind] ? kind : "shrub" });
});
registerLegend("shallow", water(B.WATER_SHALLOW));
registerLegend("deep", water(B.WATER_DEEP));
registerLegend("road", (c) => ground(c, B.ROAD));
registerLegend("path", (c) => ground(c, B.DIRT));
registerLegend("rubble", (c) => { floorCol(c); at(c, 0, c.vault.rubble ?? B.ROCK); });
registerLegend("station", (c) => { floorCol(c); at(c, 0, c.vault.wall); at(c, 1, c.vault.wall); at(c, 2, B.LAMP); });
registerLegend("creature", (c) => {
  floorCol(c);
  const type = c.vault.creatures?.[c.ch];
  if (type) addCreature(c.zone, spawnCreature(type, c.x, c.y, c.z0, { rng: c.cosmetic, state: "idle", level: c.zone.level }));
});

// The legend ids WS2 registers (check-surface holds every one registered).
export const WS2_LEGEND = ["tree", "prop", "shallow", "deep", "road", "path", "rubble", "station", "creature"];
