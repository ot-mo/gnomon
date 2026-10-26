// WS3's check (TECH_DESIGN §8.3 "WS3" acceptance; owner WS3): rendering outdoors: a Node frame ≤ 17 ms at 180×56
// with the apron, the sun bake ≤ 4 ms, no black cell below the horizon at noon, ghost planks and runes only at
// night with the torch out, golden (b) unchanged.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/run-check.mjs render run it from the
// start (WS3's Node runner is tools/check-perf.mjs, P0 skeleton → WS3). WS3 replaces the body and keeps the contract
// (tests/checks/index.js): run(env) → { name, ok, problems, stats }, taking its inputs from env so the same module
// runs in Node and in the browser. Remove STUB when it checks something.
export const STUB = "WS3";

export async function run(env) {
  return { name: "render", ok: true, problems: [], stats: { stub: true } };
}
