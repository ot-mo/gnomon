// Merchants and trade (TECH_DESIGN §4.2 `trade`, §2.6 "Price multiplier"; bible §3.1 "Buying and selling", §3.5
// "Warm: the shop discount", "Bright: the best stock"; owner WS6b). screens/trade.js draws what this file decides.
//
//   openTrade(game, c, tab = "theirs", { onPop })   the trade screen over the talk screen: theirs (the stock) /
//                                            yours (your pack) / services (talk.js registerService, filtered by
//                                            available()); onPop(game) runs when it closes
//   priceOf(game, it, trader, side) → n      side "buy" (you pay) | "sell" (they pay): the item's worth (items.js
//                                            itemPrice; buying × currency.js priceLevel(the trader's level)) through
//                                            currency.js buyPrice / sellPrice, i.e. stats.js priceMul with the
//                                            trader's rep step, and the Snuffer's +20% on buying
//   repStepOf(game, c) → step                bible §3.1: Warm +0.1, Bright +0.2, Cold −0.1, else 0 (by the trader's
//                                            main faction, builders.js standingOf); no faction: 0
//   priceNote(game, c) → { ego, step, buy, sell, text }   the multiplier the screen shows
//   tradeRows(game, c, tab) → [row]          row: { it, price, count, stock?, service?, target?, label?, info?, glyph? }
//   tradeRow(game, c, tab, row) → { ok, line, offer? }   buy, sell or pay for one; logs the line; offer: "theirs"
//                                            when a full flask refused a sale
//   ensureStock(game, c) · restock(game, c)  a merchant's pack (c.talk.state.stock: [{ item, count, price, best? }])
//   registerStock(id, (game, c, rng) → stock) a stock table; c.merchant.stock (or its type's) names it, else
//                                            "general"; the legacy Pell keeps his one pack (never restocked)
//   isMerchant(c) · bestStock(game, c) → stock row | null (the dearest thing it would sell you; the Kindling's)
//   restockSeconds() → s                     RULES.trade.restockDays world days of game time
//
// Restocking: on zone:enter after `away` ≥ two world days (TECH_DESIGN §8.3), every merchant of the zone whose
// pack has been stocked gets a fresh one, seeded by (the run's seed, the merchant, the day), so the same visit
// always finds the same goods. A full purse can't take a sale (bible §3.1: "a payment that would overflow your
// flask is refused. The trader says so and offers goods instead"): nothing changes hands, and the trade screen turns
// to the trader's goods (tradeRow answers { offer: "theirs" }). Money is never plentiful: selling pays 0.3 of the worth at Grey, buying costs 1.5.
import { itemPrice, itemName, itemGlyph, itemInfo, addToInventory, ITEM_KINDS, randomPotion, randomScroll,
  randomEquipment, isGear } from "../items.js";
import { buyPrice, sellPrice, priceLevel, pay, receive, formatPrice, CURRENCY } from "../currency.js";
import { mod, priceMul } from "../stats.js";
import { RULES, extendRules } from "../rules.js";
import { on } from "../events.js";
import { pushMode } from "../screens.js";
import { servicesFor, serviceDef } from "../talk.js";
import { typeOf } from "../creatures.js";
import { makeRng, hashInt } from "../rng.js";
import { standingOf } from "./builders.js";
import { sacramentOf } from "./liquids.js";
import { CONTAINERS } from "../content/items/containers.js";

export const TRADE_RULES = extendRules("trade", {
  repStep: { liked: 0.1, loved: 0.2, disliked: -0.1 },   // bible §3.1 / §15.6 "reputation step"
  restockDays: 2,                                        // TECH_DESIGN §8.3 "after away ≥ two game days"
  snufferMarkup: 1.2,                                    // bible §3.3: the Snuffer pays +20% for 7 world days
});
const DAY = () => 24 * 60 * RULES.clock.secondsPerMinute;   // a world day: 24 world hours of 60 game minutes
export const restockSeconds = () => TRADE_RULES.restockDays * DAY();

export const isMerchant = (c) => !!(c?.talk && (c.talk.dialogue === "merchant" || c.merchant || typeOf(c)?.merchant));

export function repStepOf(game, c) {
  if (!c || c === game.player) return 0;
  const st = standingOf(game, c);
  return st.faction ? TRADE_RULES.repStep[st.band] || 0 : 0;
}
// The Snuffer's mark (social/ritual.js): prices +20% while it lasts.
export const snuffed = (game) => (game.state?.snuffer?.until ?? -Infinity) > (game.time || 0);
const markup = (game) => (snuffed(game) ? TRADE_RULES.snufferMarkup : 1);
const traderArg = (game, c) => (c ? { repStep: repStepOf(game, c) } : null);

// What a trader pays for: the item's worth, but only the glass of a filled vial (what any pool gives for nothing
// would otherwise be a fill-and-sell loop: an umbra vial sells for 6 at Bright and EGO 24, an empty one costs 3).
const sellWorth = (it) => (it.kind === "vial" ? CONTAINERS.vial.price : itemPrice(it));

export function priceOf(game, it, trader, side) {
  const t = trader && typeof trader === "object" && "repStep" in trader && !trader.talk ? trader : traderArg(game, trader);
  if (side === "sell") return sellPrice(game, game.player, sellWorth(it), t);
  const worth = trader?.level ? Math.round(itemPrice(it) * priceLevel(trader.level)) : itemPrice(it);
  return Math.round(buyPrice(game, game.player, worth, t) * markup(game));
}

export function priceNote(game, c) {
  const step = repStepOf(game, c), m = priceMul(game, game.player, { repStep: step });
  const buy = m.buy * markup(game), ego = mod(game.player, "ego");
  const band = c ? standingOf(game, c).name : null;
  const bits = [`EGO ${ego >= 0 ? "+" : ""}${ego}`];
  if (step) bits.push(`${band} ${step > 0 ? "−" : "+"}${Math.abs(step).toFixed(1)}`);
  if (snuffed(game)) bits.push("Snuffer +20%");
  return { ego, step, buy, sell: m.sell, text: `${bits.join(" · ")} · buy ×${buy.toFixed(2)} · sell ×${m.sell.toFixed(2)}` };
}

// --- Stock -------------------------------------------------------------------------------------------------------
const STOCKS = new Map();
export function registerStock(id, fn) { STOCKS.set(id, fn); }
const stockIdOf = (c) => c.merchant?.stock ?? typeOf(c)?.merchant?.stock ?? "general";
// The legacy peddler keeps the parent game's rules: his pack is rolled once, where he's placed (content/legacy/
// encounters.js peddlerStock), and never restocked, so the old game's crystals stay as rare as they were.
const legacyPeddler = (c) => c.type === "pell" && !c.merchant?.stock;
// A merchant of the world: tonics, knives and bombs, vials (an empty one, and its faction's sacrament), two pieces
// of gear and an unknown potion and scroll; and on the back shelf, for Bright customers only, one piece of gear
// four levels better (bible §3.5 "the best stock").
registerStock("general", (game, c, rng) => {
  const level = c.level || 1, sac = standingOf(game, c).faction ? sacramentOf(standingOf(game, c).faction) : null;
  const gear = (lv) => { const it = { ...randomEquipment(rng, lv, 0.3), known: true }; if (isGear(it) && it.ench < 0) it.ench = 0; return it; };
  const stock = [
    { item: { kind: "potion", effect: "healing" }, count: 2 },
    { item: { kind: "knife" }, count: 4 },
    { item: { kind: "bomb" }, count: 1 + Math.floor(rng() * 2) },
    { item: { kind: "vial", effect: "" }, count: 3 },
    { item: randomPotion(rng), count: 1 },
    { item: randomScroll(rng), count: 1 },
    { item: gear(level), count: 1 },
    { item: gear(level + 1), count: 1 },
    { item: gear(level + 4), count: 1, best: true },
  ];
  if (sac && sac !== "any" && sac !== "glim") stock.splice(4, 0, { item: { kind: "vial", effect: sac }, count: 2 });
  for (const s of stock) s.price = Math.round(itemPrice(s.item) * priceLevel(level));
  return stock;
});

const stockSeed = (game, c, day) => hashInt(game.seed ?? 0, "stock", c.uid ?? `${game.zone?.key}#${c.id}`, day);
export function restock(game, c) {
  const fn = STOCKS.get(stockIdOf(c)) || STOCKS.get("general");
  const day = Math.floor((game.time || 0) / DAY());
  const st = (c.talk.state ||= {});
  st.stock = fn(game, c, makeRng(stockSeed(game, c, day)));
  st.stockedAt = game.time || 0;
  return st.stock;
}
export function ensureStock(game, c) {
  const st = (c.talk.state ||= {});
  if (!st.stock && isMerchant(c) && !legacyPeddler(c)) restock(game, c);
  if (st.stock && st.stockedAt === undefined) st.stockedAt = game.time || 0;
  return st.stock || [];
}

// A load isn't an arrival: its `away` is the time since you last left the zone you were standing in, so a save made
// after two days in a village would refill every shop on loading it.
on("zone:enter", (game, { zone, away, how }) => {
  if (how === "load" || !zone?.creatures || !(away >= restockSeconds())) return;
  for (const c of zone.creatures) if (c.talk?.state?.stock && isMerchant(c) && !legacyPeddler(c)) restock(game, c);
});

export function bestStock(game, c) {
  let best = null;
  for (const s of ensureStock(game, c)) if (s.count > 0 && (!best || s.price > best.price)) best = s;
  return best;
}

// --- The screen's rows and what they do ------------------------------------------------------------------------------
export const TRADE_TABS = ["theirs", "yours", "services"];
const isCrystal = (it) => it.kind === "heart" || it.kind === "strength";
const crystalPrice = (game, price) => Math.round(price * 1.5 ** (game.state.merchants?.crystalsBought || 0));
const moneyItem = (it) => it.kind === "coinage" && it.effect === CURRENCY.backing?.item;

export function stockPrice(game, c, s) {
  const base = isCrystal(s.item) ? crystalPrice(game, s.price) : s.price;
  return Math.round(buyPrice(game, game.player, base, traderArg(game, c)) * markup(game));
}

export function tradeRows(game, c, tab) {
  const p = game.player;
  if (tab === "theirs") {
    const bright = standingOf(game, c).band === "loved";
    return ensureStock(game, c).filter((s) => s.count > 0 && (!s.best || bright))
      .map((s) => ({ it: s.item, price: stockPrice(game, c, s), count: s.count, stock: s }));
  }
  if (tab === "services") return servicesFor(game, c).map(({ id, target }) => {
    const s = serviceDef(id);
    return { label: s.label(game, c, target), glyph: s.glyph?.(game, c, target), price: Math.round(s.price(game, c, target) * markup(game)),
             info: s.info?.(game, c, target), service: s, target };
  });
  return (p.inv || []).filter((it) => !moneyItem(it))
    .map((it) => ({ it, price: priceOf(game, it, c, "sell"), count: it.count || 1 }));
}

const say = (game, line, color) => { game.log(line, color); return line; };
const GOOD = [255, 215, 90], BAD = [255, 150, 120];

export function tradeRow(game, c, tab, row) {
  if (!row) return { ok: false, line: "" };
  const p = game.player;
  if (tab === "services") {
    if (!pay(game, p, row.price)) return { ok: false, line: say(game, `You can't afford that (${formatPrice(row.price)}).`, BAD) };
    row.service.run(game, c, row.target);
    return { ok: true, line: say(game, row.service.done?.(game, c, row.target, row.price) || `Done. (${formatPrice(row.price)})`, GOOD) };
  }
  const name = itemName(game, { ...row.it, count: 1 });
  if (tab === "theirs") {
    if (!pay(game, p, row.price)) return { ok: false, line: say(game, `You can't afford the ${name} (${formatPrice(row.price)}).`, BAD) };
    row.stock.count--;
    if (isCrystal(row.it)) game.state.merchants.crystalsBought = (game.state.merchants.crystalsBought || 0) + 1;
    // A crystal is absorbed at once, as when you walk over one (its kind's onPickup).
    if (!ITEM_KINDS[row.it.kind]?.onPickup?.(game, p, { ...row.it })) addToInventory(p, { ...row.it, count: 1 });
    return { ok: true, line: say(game, `You buy the ${name} for ${formatPrice(row.price)}.`, GOOD) };
  }
  if (row.price <= 0) return { ok: false, line: say(game, `${c.name} doesn't want the ${name}.`, [170, 170, 170]) };
  const over = receive(game, p, row.price);
  if (over) {   // the flask can't hold it all: the sale is refused (what fit goes back), and the trader offers goods
    pay(game, p, row.price - over);
    return { ok: false, offer: "theirs", line: say(game, `"Your flask won't hold ${formatPrice(row.price)}. Take something of mine for it instead?"`, [230, 200, 150]) };
  }
  if (row.it.count > 1) row.it.count--; else p.inv.splice(p.inv.indexOf(row.it), 1);
  return { ok: true, line: say(game, `You sell the ${name} for ${formatPrice(row.price)}.`, GOOD) };
}

export const rowLabel = (game, r) => r.label || itemName(game, { ...r.it, count: 1 }) + (r.count > 1 ? ` x${r.count}` : "");
export const rowGlyph = (game, r) => r.glyph || itemGlyph(game, r.it);
export const rowInfo = (game, r) => r.info || itemInfo(game, r.it);

// onPop(game): runs when the screen closes (dialogue.js: back to the talker's first words).
export function openTrade(game, c, tab = "theirs", { onPop } = {}) {
  ensureStock(game, c);
  game.travel = null;
  game.trade = { npc: c, tab: TRADE_TABS.includes(tab) ? tab : "theirs", sel: 0, top: 0 };
  pushMode(game, "trade", onPop ? { onPop } : null);
  return game.trade;
}
