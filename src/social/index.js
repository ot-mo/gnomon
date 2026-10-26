// Factions, reputation, dialogue builders (WS6a) and trade, the Kindling, backings, voices, shrines, liquids
// (WS6b; TECH_DESIGN §8.3 "WS6a", "WS6b"). src/features.js imports this file; it registers everything WS6a and
// WS6b add (rep events on the bus, dialogue builders, services, the "item" backing, the factions, trade and
// ritual screens' keys).
//
//   openTrade(game, c) · priceOf(game, it, trader, side)     merchants.js (WS6b)
//   openRitual(game, c)                                      ritual.js (WS6b)
//   voiceFor(c) → voice                                      voices.js (WS6b)
//   liquidAt(zone, x, y)                                     liquids.js (WS6b)
//
// WS6a also owns factions.js (repOf, addRep, band, attitude: §2.11) and talk.js; WS6b owns dialogue.js. The
// screens factions, trade and ritual are in screens/ (screens/index.js imports every screen).
// P0: registers nothing, so the game plays as before. Remove STUB when WS6a or WS6b registers its parts here.
import "./reputation.js";
import "./builders.js";
import "./shrines.js";
import "./backings.js";
export { openTrade, priceOf } from "./merchants.js";
export { openRitual } from "./ritual.js";
export { voiceFor } from "./voices.js";
export { liquidAt } from "./liquids.js";
export const STUB = "WS6a";
