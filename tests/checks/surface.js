// WS2's check (TECH_DESIGN §8.3 "WS2" acceptance; owner WS2): surface generation: every landmark × 5 seeds valid,
// 500 random spans × 3 seeds valid with navigability, an apron from the world functions equal to the neighbour's
// generated band on 50 pairs, p95 ≤ 60 ms.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-surface.mjs run it from the
// start. WS2 replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems,
// stats }, taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it
// checks something.
export const STUB = "WS2";

export async function run(env) {
  return { name: "surface", ok: true, problems: [], stats: { stub: true } };
}
