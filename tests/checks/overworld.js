// WS1's check (TECH_DESIGN §8.3 "WS1" acceptance; owner WS1): the world map's travel: a Node random walk of 10⁴
// steps (lost and encounter rates per terrain within ±2% of the data), fast-travel paths over allowed spans only,
// spans with travel "no" never entered, arrival edges for all 8 directions, encounter bands 8-12 tiles from the
// arrival in visited and unvisited zones, a rest interrupted by an encounter roll.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-overworld.mjs run it from the
// start. WS1 replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems,
// stats }, taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it
// checks something.
export const STUB = "WS1";

export async function run(env) {
  return { name: "overworld", ok: true, problems: [], stats: { stub: true } };
}
