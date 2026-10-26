// WS6a's check (TECH_DESIGN §8.3 "WS6a" acceptance; owner WS6a): factions and trade (WS6a, then WS6b adds its
// cases): the attitude table, rep arithmetic, witnesses turning hostile, dialogue builders' nodes for every talker;
// prices against EGO, pay and receive per backing, Pell's services through registerService.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-social.mjs run it from the
// start. WS6a replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems,
// stats }, taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it
// checks something.
export const STUB = "WS6a";

export async function run(env) {
  return { name: "social", ok: true, problems: [], stats: { stub: true } };
}
