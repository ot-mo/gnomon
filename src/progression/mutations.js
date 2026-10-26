// Mutations (TECH_DESIGN §8.3 "WS4", §2.8; §1.4 "progression (WS4)"). A P0 stub with the frozen signatures;
// WS4 builds it over content/mutations.js (the points are creases, DECISIONS §1).
//
//   mutationOffers(game, p, rng) → ids    3 seeded offers (the same for the same seed); rng from rng.js, never
//                                         Math.random
//   gainMutation(game, p, id)             a new mutation (4 points); invalidateStats(p); emits "mutate"
//   raiseMutation(game, p, id)            one level more, up to floor(level / 2) + 1
//
// p.mutations = { [id]: level } (§2.4). Until WS4 builds them: mutationOffers offers nothing ([]), the other
// two throw "not built yet (WS4)". Remove STUB when the file is built.
export const STUB = "WS4";
const notBuilt = (fn) => { throw new Error(`${fn}: not built yet (WS4)`); };

export function mutationOffers(game, p, rng) { return []; }
export function gainMutation(game, p, id) { notBuilt("gainMutation"); }
export function raiseMutation(game, p, id) { notBuilt("raiseMutation"); }
