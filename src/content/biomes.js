// Biome data (TECH_DESIGN §5.3, §2.18; WS2, then C1 for the final data): per biome id, what its builder
// (gen/biomes/<biome>.js) places: ground blocks, tree and prop densities, water, scenery heights (DECISIONS §1:
// standable ground at most 12 blocks above the datum, scenery at most 14). The schema is WS2's to set.
// P0: empty, and nothing reads it yet. Remove STUB when the table has data.
export const STUB = "WS2";
export const BIOMES = {};
