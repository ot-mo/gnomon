// The world functions (TECH_DESIGN §5.3; §1.4 gen/surface.js heightAt, treeAt; owner WS2). A P0 stub: it
// re-exports the 0A2 code that still lives in gen/surface.js, so a caller can import from here already; WS2
// moves the code in (and gen/surface.js then imports it from here).
//
//   heightAt(world, seed, gx, gy) → int            ground height above the datum at world column (gx, gy)
//   treeAt(world, seed, cx, cy) → tree | null      the tree of the 3×3-tile world cell (cx, cy)
//   worldFns(world, seed) → W                      the same, cached per run: W.heightAt, W.columnAt, W.treeAt, W.portsOf
//
// Signatures as built in 0A2, not as TECH_DESIGN §1.4 wrote them: heightAt(run, gx, gy) → { h, cliff } and
// treeAt(run, gx, gy) → { height, canopy } became (world, seed, …) → int (W.columnAt gives the cliff) and
// (world, seed, cx, cy) → { gx, gy, base, trunk } (0A2.md §2). Generation code only: R6 (no Math.random,
// Math.hypot or transcendental functions).
export const STUB = "WS2";
export { heightAt, treeAt, worldFns } from "./surface.js";
