// Character creation (TECH_DESIGN §4.2 `create`, §2.4, §2.6; §1.4 "progression (WS4)"). A P0 stub with the
// frozen signature; WS4 builds it.
//
//   makeCharacter(choices) → player    choices: genotype ("bent" | "plumb", DECISIONS §1), background, attributes
//                                      (point-buy), mutations or implants, name, run mode ("oneWick" | "commonsLamp"
//                                      | "pilgrim"); a player with the attribute formula set (RULES.stats =
//                                      "attributes"), never baking derived numbers into base fields (R3)
//
// The shape of `choices` is left to WS4 (the `create` wizard's steps, §4.2, are its natural fields).
// Until WS4 builds it, it throws "not built yet (WS4)"; new games use player.js makePlayer as before.
// Remove STUB when the file is built.
export const STUB = "WS4";

export function makeCharacter(choices) { throw new Error("makeCharacter: not built yet (WS4)"); }
