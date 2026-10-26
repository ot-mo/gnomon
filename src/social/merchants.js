// Merchants and trade (TECH_DESIGN §4.2 `trade`, §2.6 "Price multiplier"; §1.4 "social (WS6a/6b)"; owner WS6b).
// A P0 stub with the frozen signatures; WS6b builds the generic trade screen (screens/trade.js) and restocking.
//
//   openTrade(game, c)                       theirs / yours / services (talk.js registerService); prices through
//                                            currency.js formatPrice; EGO and rep multiplier shown
//   priceOf(game, it, trader, side) → n      side: "buy" (you pay) | "sell" (they pay); the item's worth
//                                            (items.js itemPrice) through currency.js buyPrice / sellPrice,
//                                            i.e. stats.js priceMul (EGO and rep)
//
// Until WS6b builds them: priceOf gives today's prices (exactly what the shop of 0B charges and pays for an
// item's worth), openTrade throws "not built yet (WS6b)" (Pell's shop, the `shop` screen, still works).
// Remove STUB when the file is built.
import { itemPrice } from "../items.js";
import { buyPrice, sellPrice } from "../currency.js";

export const STUB = "WS6b";

export function openTrade(game, c) { throw new Error("openTrade: not built yet (WS6b)"); }
export function priceOf(game, it, trader, side) {
  return (side === "sell" ? sellPrice : buyPrice)(game, game.player, itemPrice(it), trader ?? null);
}
