// WS4's check (TECH_DESIGN §8.3 "WS4" acceptance; owner WS4): creation and progression: every genotype × background
// makes a valid player with RULES.stats = "attributes", mutation offers the same for the same seed, each active
// mutation through the 3D aim path and the map's requestTarget, a level 1→20 run without errors.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-progression.mjs run it from the
// start. WS4 replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems,
// stats }, taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it
// checks something.
export const STUB = "WS4";

export async function run(env) {
  return { name: "progression", ok: true, problems: [], stats: { stub: true } };
}
