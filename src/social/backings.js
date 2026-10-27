// Currency backings (TECH_DESIGN §2.10; owner WS6b). DECISIONS §1: glim is a counter, with no liquid backing and no
// containers, so the liquid backing is not built; this file builds the "item" backing only, and registers it with
// currency.js registerBacking. It is used only when content/currency.js says backing: { kind: "item", item: id };
// today's glim keeps the counter (0B), so nothing here runs in play until content asks for coins.
//
//   registerCoinage(id, { name, plural, glyph, color, weight, value = 1 })   a coin content can name as money
//   COINAGES                                    the registered coins
//   coinsOf(e, id) → n                          how many of that coin e carries (in its pack)
//   coinRoom(e, id) → n                         how many more e can carry: by weight under carryCap when
//                                               RULES.encumbrance is on (a coin's weight > 0), else no limit
//
// The "item" backing: money is a stackable item of kind "coinage" with effect = the coinage id (so the coins
// stack; weight and theft apply, as for any item). funds(e) counts e's coins; pay(game, e, n) takes n coins,
// smallest stacks first, or nothing and false; receive(game, e, n) adds what e can carry and returns the rest (the
// overflow), which the caller drops or refuses, as with a full purse.
import { registerBacking, CURRENCY } from "../currency.js";
import { registerItemKind, itemWeight } from "../items.js";
import { carried } from "../body.js";
import { carryCap } from "../stats.js";
import { RULES } from "../rules.js";

export const COINAGES = {};
export function registerCoinage(id, def) {
  if (!def?.name) throw new Error(`registerCoinage: ${id} needs a name`);
  COINAGES[id] = { plural: def.name, glyph: "$", color: [255, 210, 70], weight: 0, value: 1, ...def, id };
}
const coinDef = (id) => COINAGES[id] || null;
const coinId = () => CURRENCY.backing?.item;

registerItemKind("coinage", {
  stack: true,
  weight: (it) => coinDef(it.effect)?.weight || 0,
  price: () => 0,   // money isn't sold for money
  name: (game, it) => {
    const d = coinDef(it.effect), n = it.count || 1;
    return d ? `${n} ${n === 1 ? d.name : d.plural}` : `${n} coins`;
  },
  glyph: (game, it) => [coinDef(it.effect)?.glyph || "$", coinDef(it.effect)?.color || [255, 210, 70]],
  info: (game, it) => (it.effect === coinId() ? "Money." : "Somebody's money, somewhere."),
  art: { w: 0.4, h: 0.22, art: ["  yY  ", " yYyy ", "yYyyYy"] },
  palette: (game, it) => { const c = coinDef(it.effect)?.color || [230, 175, 40]; return { y: [c, 0.3], Y: [c.map((v) => Math.min(255, v + 40)), 0.6] }; },
});

const isCoin = (it, id) => it?.kind === "coinage" && it.effect === id;
export const coinsOf = (e, id = coinId()) => (e?.inv || []).reduce((s, it) => s + (isCoin(it, id) ? it.count || 1 : 0), 0);

export function coinRoom(e, id = coinId()) {
  const w = coinDef(id)?.weight || 0;
  if (!RULES.encumbrance || !(w > 0)) return Infinity;
  const cap = carryCap(e);
  if (!Number.isFinite(cap)) return Infinity;
  const load = carried(e).reduce((s, it) => s + itemWeight(it) * (it.count || 1), 0);
  return Math.max(0, Math.floor((cap - load) / w + 1e-9));
}

registerBacking("item", {
  funds: (e) => coinsOf(e),
  pay(game, e, n) {
    const id = coinId();
    if (coinsOf(e, id) < n) return false;
    let left = n;
    const stacks = e.inv.filter((it) => isCoin(it, id)).sort((a, b) => (a.count || 1) - (b.count || 1));
    for (const st of stacks) {
      const take = Math.min(left, st.count || 1);
      st.count = (st.count || 1) - take;
      left -= take;
      if (st.count <= 0) e.inv.splice(e.inv.indexOf(st), 1);
      if (!left) break;
    }
    return true;
  },
  receive(game, e, n) {
    const id = coinId();
    const take = Math.min(n, coinRoom(e, id));
    if (take > 0) {
      e.inv ||= [];
      const st = e.inv.find((it) => isCoin(it, id));
      if (st) st.count = (st.count || 1) + take; else e.inv.push({ kind: "coinage", effect: id, count: take });
    }
    return n - take;
  },
});
