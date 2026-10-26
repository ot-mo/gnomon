// WS5's check (TECH_DESIGN §8.3 "WS5" acceptance; owner WS5): body mods and items: the equip/unequip matrix over
// every slot type and plan, implant install and uninstall rules, identify odds within ±2% of the formula, examine
// opened by an inspect event.
//
// A P0 stub that passes, so tests/checks/index.js, test-world.html and tools/check-items.mjs run it from the start.
// WS5 replaces the body and keeps the contract (tests/checks/index.js): run(env) → { name, ok, problems, stats },
// taking its inputs from env so the same module runs in Node and in the browser. Remove STUB when it checks
// something.
export const STUB = "WS5";

export async function run(env) {
  return { name: "items", ok: true, problems: [], stats: { stub: true } };
}
