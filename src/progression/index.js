// Character creation and progression (WS4; TECH_DESIGN §8.3 "WS4"). src/features.js imports this file; it
// registers everything WS4 adds to the shared registries.
//
//   makeCharacter(choices) → player                                   chargen.js
//   mutationOffers(game, p, rng) → ids · gainMutation(game, p, id) · raiseMutation(game, p, id)   mutations.js
//
// Registered here: the "origin" bonus source (stats.js): a made character's background bonus (bible §10.9-§10.10:
// +2 TOU and the like, after the point-buy's cap) and its Level's (Vey +3 examine, Orrum +1 natural armour). A quick
// game's player has no background, so it adds nothing there.
// WS4 also owns abilities.js (§2.8, built in P0 with Fold Step), player.js, leveling.js and the screens create,
// charsheet, abilities and levelup (screens/index.js imports every screen; each registers its own mode).
import { registerBonusSource } from "../stats.js";
import { originBonuses } from "./chargen.js";

registerBonusSource("origin", originBonuses);

export { makeCharacter } from "./chargen.js";
export { mutationOffers, gainMutation, raiseMutation } from "./mutations.js";
