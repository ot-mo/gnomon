// The text grammar (TECH_DESIGN §2.15; §1.4 "story (WS7)"; owner WS7): history's gospel, inscription and
// hostile versions, village names, gossip. A P0 stub with the frozen signature.
//
//   expand(grammar, symbol, rng, ctx) → string     grammar: content/grammar.js; rng: rng.js, never Math.random
//                                                  (R6: history and villages are generation); ctx: the
//                                                  bindings a rule may read (a ruler, a site, a faction)
//
// Every generated name passes bible §15.11 (and is at most 9 letters, bible §1). Until WS7 builds it, it throws
// "not built yet (WS7)". Remove STUB when the file is built.
export const STUB = "WS7";

export function expand(grammar, symbol, rng, ctx) { throw new Error("expand: not built yet (WS7)"); }
