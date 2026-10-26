// Biome builders (TECH_DESIGN §5.3, §1.4 gen/surface.js BIOME_BUILDERS; owner WS2): one file per biome in this
// folder (gen/biomes/<biome>.js), each a (ctx) => void that dresses a surface zone (ctx: §1.4 "Generation").
// This index gathers them; gen/surface.js re-exports BIOME_BUILDERS. Builders draw only from ctx.rng (R6).
//
// P0: empty, and generateSurface doesn't call it yet, so every span generates as before.
// Remove STUB when the first biome is in.
export const STUB = "WS2";
export const BIOME_BUILDERS = {};   // biome id → (ctx) => void
