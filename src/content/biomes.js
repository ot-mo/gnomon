// Biome data (TECH_DESIGN §5.3, §2.18; WS2, then C1 for the final data): per biome id (a terrain's `biome`, else
// its id: world/worldmodel.js tile.biome), what the world functions and its builder (gen/biomes/<biome>.js) read.
// The terrain itself (content/world/terrains.js) keeps ground, relief, cliffs and trees; this table adds:
//
//   liquid      what the span's surface water holds when no river runs through it (a river's own liquid wins,
//               so a river is the same liquid on both sides of every edge): one liquid per span (DECISIONS:
//               no mixing). An id of content/liquids.js; "water" is plain fresh water.
//   cliffTiers  1 or 2: with 2 the cliff mask's cores rise a second time (mesas stacked like stairs, bible
//               §4.4's Rust Steps), still at most 12 blocks above the datum (DECISIONS: heights)
//
// WS2b adds the builder's fields (ground and sub-ground blocks, rocks, ponds, props, light sources, spawn
// tables, densities). A biome missing here takes DEFAULT_BIOME's values, and so does every span of a world whose
// terrains aren't the real world's (content/world/terrains.js): the test world's fixture terrains share some ids
// ("flats") but none of this data, so its zones stay as 0A2 made them (biomeFor).
import { TERRAINS } from "./world/terrains.js";

export const DEFAULT_BIOME = { liquid: "water", cliffTiers: 1 };

export const BIOMES = {
  // The real world (bible §4.4, §13.7: one dominant liquid each).
  flats: { liquid: "brine" },          // the Brine Flats: the pressed sea's pools
  waste: { liquid: "brine" },
  steps: { liquid: "water", cliffTiers: 2 },   // mesas up to 12 blocks, canyon floors
  downs: { liquid: "water" },
  pleatwood: { liquid: "water" },
  deepPleat: { liquid: "water" },
  tessellate: { liquid: "ink" },       // the Flatfolk's page-towns: flat beings use ink pools as shortcuts
  stacks: { liquid: "water" },
  shade: { liquid: "umbra" },          // the Lampless's liquid shadow
  lattice: { liquid: "turnwater" },    // the Askew's
  teeth: { liquid: "water" },
  sea: { liquid: "brine" },
  river: { liquid: "water" },
  road: { liquid: "water" },
};

export const biomeOf = (id) => ({ ...DEFAULT_BIOME, ...(BIOMES[id] || {}) });
// The biome data of a world's span: its biome's when its terrain is the real world's, else the defaults.
export const biomeFor = (world, tile) => (world.terrains[tile.terrain] === TERRAINS[tile.terrain] ? biomeOf(tile.biome) : { ...DEFAULT_BIOME });
