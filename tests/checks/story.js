// WS7's check (TECH_DESIGN §8.3 "WS7" acceptance; owner WS7): knowledge: 100 seeds of history (valid, ≤ 50 ms,
// every event with gospel, inscription and cause), villages on every village site for 20 seeds, each quest template
// completed by events, secret ids stable per seed, a mural learned by keys and by hover.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-story.mjs run it from the start.
// WS7 replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems, stats },
// taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it checks
// something.
export const STUB = "WS7";

export async function run(env) {
  return { name: "story", ok: true, problems: [], stats: { stub: true } };
}
