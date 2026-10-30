// Biome builders (TECH_DESIGN §5.3, §1.4 gen/surface.js BIOME_BUILDERS; owner WS2): one file per biome in this
// folder (gen/biomes/<biome>.js), each a (ctx) => void that dresses a surface zone (ctx: common.js says what it
// holds). This index gathers them; gen/surface.js re-exports BIOME_BUILDERS and calls builderFor. Builders draw
// only from ctx.rng (R6).
//
//   BIOME_BUILDERS   the real world's biomes (content/world/terrains.js: a terrain's biome is its id)
//   TEST_BUILDERS    the test world's fixture terrains (content/world/test-world.js), whose data is
//                    content/biomes.js DEFAULT_BIOME: plain dressing, no wildlife (its "flats" and "sea" share the
//                    real world's ids but not their builders)
//   builderFor(world, tile) → builder   the real one when the span's terrain is the real world's, else the test's
//   LANDMARK_BUILDERS                   gen/biomes/landmarks.js (a landmark with no plan: none now, every one has a plan)
// Importing this module registers the wildlife (content/creatures/wildlife.js) and WS2's legend handlers.
import { registerCreatures } from "../../creatures.js";
import { WILDLIFE } from "../../content/creatures/wildlife.js";
import { TERRAINS } from "../../content/world/terrains.js";
import { dress } from "./common.js";
import flats from "./flats.js";
import waste from "./waste.js";
import steps from "./steps.js";
import downs from "./downs.js";
import pleatwood from "./pleatwood.js";
import deepPleat from "./deepPleat.js";
import tessellate from "./tessellate.js";
import stacks from "./stacks.js";
import shade from "./shade.js";
import lattice from "./lattice.js";
import teeth from "./teeth.js";
import sea from "./sea.js";
import river from "./river.js";
import road from "./road.js";
import "./legend.js";
export { LANDMARK_BUILDERS } from "./landmarks.js";

registerCreatures(WILDLIFE);

export const BIOME_BUILDERS = { flats, waste, steps, downs, pleatwood, deepPleat, tessellate, stacks, shade, lattice, teeth, sea, river, road };
const plain = (ctx) => dress(ctx);
export const TEST_BUILDERS = { flats: plain, hills: plain, forest: plain, marsh: plain, mountains: plain, sea: plain };

export const builderFor = (world, tile) =>
  (world.terrains[tile.terrain] === TERRAINS[tile.terrain] ? BIOME_BUILDERS[tile.biome] : TEST_BUILDERS[tile.biome]) || plain;
