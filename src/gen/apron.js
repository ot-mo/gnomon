// The apron's band builder (TECH_DESIGN §6.1, §1.4 zones.js APRON_BUILDERS; owner WS2). A P0 stub: it
// re-exports the 0A2 builder that still lives in gen/surface.js (world/zonegen.js registers it as
// APRON_BUILDERS.surface); WS2 moves the code in.
//
//   buildApronBand(run, zone, side, neighbour = null) → band    side: "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
//        a copy of the neighbour's blocks when it is in memory, else built from the world functions
//
// The fourth argument (the neighbour zone) is 0A2's addition to §1.4 (0A2.md deviation 17).
export const STUB = "WS2";
export { buildApronBand } from "./surface.js";
