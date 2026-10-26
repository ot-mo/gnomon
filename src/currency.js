// Money (TECH_DESIGN §2.10, with DECISIONS.md and bible §15.6): the engine knows only an amount. What
// the money is called, its glyph and colour, and how it is kept come from content/currency.js; today
// that is glim (lamp oil), a plain counter shown as "$" in the old gold colour, held in a purse (the
// lamp-flask) of 200, 500 or 1,000.
//
//   CURRENCY                              content/currency.js: { id, name, plural, unit, glyph, color, backing, purses, startPurse }
//   registerBacking(kind, { funds(e), pay(game, e, n) → bool, receive(game, e, n) → overflow })
//   funds(e) → n                          what e has
//   pay(game, e, n) → bool                takes n if e has it; otherwise takes nothing and says false
//   receive(game, e, n) → overflow        adds what fits; returns what didn't (the purse is full)
//   canAfford(e, n)  purseCap(e)  purseRoom(e)  setPurse(e, size) → bool   (the counter's purse; size one of CURRENCY.purses)
//   formatPrice(n) → "12 glim"            formatFunds(e) → "$12"   (never a unit written in code)
//   priceLevel(level) → factor            prices rise with the level (the parent's priceFactor: 1 + level/15)
//   buyPrice(game, e, price, trader?)     a price after the buyer's haggling (stats.js priceMul)
//   sellPrice(game, e, value, trader?)    what a trader pays for something worth `value`
//
// Every place the parent game touched `gold` goes through these (0B). The counter backing keeps the
// amount on the entity as `e.funds` and the purse's size as `e.purse`; WS6b registers an item backing.
// The torch's drain (1 glim per 4 world hours lit in darkness, DECISIONS) pays through pay(): torch.js.
import { CURRENCY } from "./content/currency.js";
import { RULES } from "./rules.js";
import { priceMul, contentLevel } from "./stats.js";

export { CURRENCY };

const BACKINGS = {};
export function registerBacking(kind, def) {
  if (BACKINGS[kind]) throw new Error(`registerBacking: ${kind} is already registered`);
  for (const f of ["funds", "pay", "receive"])
    if (typeof def[f] !== "function") throw new Error(`registerBacking: ${kind} needs ${f}()`);
  BACKINGS[kind] = def;
}
export const backingKinds = () => Object.keys(BACKINGS);   // what is registered (for checks)
function backing() {
  const b = BACKINGS[CURRENCY.backing?.kind];
  if (!b) throw new Error(`currency: no backing "${CURRENCY.backing?.kind}" registered`);
  return b;
}
const amount = (n) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`currency: ${n} is not a whole amount`);
  return n;
};

// --- The counter backing ------------------------------------------------------------------------
export const purseCap = (e) => e.purse || CURRENCY.startPurse;
export const purseRoom = (e) => Math.max(0, purseCap(e) - (e.funds || 0));
export function setPurse(e, size) {
  if (!CURRENCY.purses.includes(size)) return false;
  e.purse = size;
  return true;
}
registerBacking("counter", {
  funds: (e) => e.funds || 0,
  pay(game, e, n) {
    if ((e.funds || 0) < n) return false;
    e.funds -= n;
    return true;
  },
  receive(game, e, n) {
    const take = Math.min(n, purseRoom(e));
    e.funds = (e.funds || 0) + take;
    return n - take;
  },
});

// --- The API ------------------------------------------------------------------------------------
export const funds = (e) => backing().funds(e);
export const canAfford = (e, n) => funds(e) >= n;
export const pay = (game, e, n) => amount(n) === 0 || backing().pay(game, e, n);
export const receive = (game, e, n) => amount(n) === 0 ? 0 : backing().receive(game, e, n);

export const formatPrice = (n) => `${n} ${n === 1 ? CURRENCY.name : CURRENCY.plural}`;
export const formatFunds = (e) => `${CURRENCY.glyph}${funds(e)}`;

export const priceLevel = (level) => 1 + contentLevel(Math.max(0, level || 0)) / RULES.price.levelStep;
export const buyPrice = (game, e, price, trader = null) => Math.round(price * priceMul(game, e, trader).buy);
export const sellPrice = (game, e, value, trader = null) => Math.floor(value * priceMul(game, e, trader).sell);
