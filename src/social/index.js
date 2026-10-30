// Factions, reputation, dialogue builders (WS6a) and trade, the Kindling, backings, voices, shrines, liquids
// (WS6b; TECH_DESIGN §8.3 "WS6a", "WS6b"). src/features.js imports this file; it registers everything WS6a and
// WS6b add (rep events on the bus, dialogue builders, talk options, the "item" backing, restocking on zone:enter,
// oathbreaking on kill).
//
//   openTrade(game, c, tab, { onPop }) · priceOf(game, it, trader, side) · restock(game, c)    merchants.js (WS6b)
//   openRitual(game, c, { onPop }) · performRite(game, c, rite) · canKindle(game, c)          ritual.js (WS6b)
//   voiceFor(c) → voice                                                                       voices.js (WS6b)
//   liquidAt(zone, x, y) · drinkLiquid(game, e, id)                                           liquids.js (WS6b)
//   makeShrine(c, opts) · donate(game, c, glim)                                               shrines.js (WS6b)
//   registerCoinage(id, def)                                                                  backings.js (WS6b)
//
// WS6a also owns factions.js (repOf, addRep, band, attitude: §2.11) and talk.js; WS6b owns dialogue.js. The
// screens factions, trade and ritual are in screens/ (screens/index.js imports every screen).
// WS6a: reputation.js subscribes the rep events, builders.js registers the role dialogues, content/factions.js
// the factions, and screens/factions.js the factions screen (P). WS6b: merchants.js (prices by EGO and rep,
// stock, restock), ritual.js (the Kindling's three rites, the flame-kin menu, oathbreaking), shrines.js (the
// shrine component, donations), backings.js (the item backing), voices.js, liquids.js.
export { offend, killed, witnessesOf, offender } from "./reputation.js";
export { buildDialogue, standingOf, walkDialogue, checkNode, ROLES } from "./builders.js";
export { makeShrine, donate } from "./shrines.js";
export { registerCoinage } from "./backings.js";
export { openTrade, priceOf, restock } from "./merchants.js";
export { openRitual, performRite, canKindle } from "./ritual.js";
export { voiceFor } from "./voices.js";
export { liquidAt, drinkLiquid } from "./liquids.js";
export { holyAt, stelesNear, landmarkHere } from "./places.js";
export { holyNow, trespassed, darkPass } from "./holy.js";
import "./legends.js";
export { cultFaction, ensureCult, cultOfSite } from "./cults.js";
export { takeFromLamp, cookDish, brewTonic, brewCost, prayAtShrine, BREWS } from "./commons.js";
export { sendSmoothers } from "./smoothers.js";
export { bankHere, deposit, withdraw } from "./bank.js";
export { OIL_FIRE, CHIME } from "./powers.js";
export { gradeCap } from "./stocks.js";
