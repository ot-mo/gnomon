// Character creation and progression (WS4; TECH_DESIGN §8.3 "WS4"). src/features.js imports this file; it
// registers everything WS4 adds (mutations' abilities and bonus sources, the hotbar's screens, K and B).
//
//   makeCharacter(choices) → player                                   chargen.js
//   mutationOffers(game, p, rng) → ids · gainMutation(game, p, id) · raiseMutation(game, p, id)   mutations.js
//
// WS4 also owns abilities.js (§2.8, built in P0 with Fold Step), player.js, leveling.js and the screens
// create, charsheet, abilities and levelup (screens/index.js imports every screen).
// P0: registers nothing, so the game plays as before. Remove STUB when WS4 registers its parts here.
export { makeCharacter } from "./chargen.js";
export { mutationOffers, gainMutation, raiseMutation } from "./mutations.js";
export const STUB = "WS4";
