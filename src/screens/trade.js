// Trade (TECH_DESIGN §4.2 `trade`; owner WS6b): three tabs over the talk screen, theirs (the merchant's stock) /
// yours (your pack, at what they'd pay) / services (talk.js registerService rows: Pell's sharpening and the rest,
// WS5's surgeons and tinkers), each price through currency.js formatPrice, with the EGO and reputation multiplier
// shown under the tabs. The logic is social/merchants.js's (tradeRows, tradeRow); this draws it and takes the keys.
//
//   ↑↓ / W S / the wheel choose · Enter, E or Space (or a click on the chosen row) buys, sells or pays · Tab, ←→ or
//   A D (or a click on a tab) switch tabs · Esc (or a click on "Esc back", or a right click) back to talking
//
// The world waits while it is open, as under every other screen. Pell's old pack (the `shop` screen) stays his.
import * as S from "../screen.js";
import { registerScreen, popMode } from "../screens.js";
import { UI, box, modal, list, listKey, listWheel, listAt, tabs, hitLabel, at } from "../ui.js";
import { funds, formatPrice, CURRENCY } from "../currency.js";
import { typeOf } from "../creatures.js";
import { sfx } from "../sfx.js";
import { TRADE_TABS, tradeRows, tradeRow, priceNote, rowLabel, rowGlyph, rowInfo } from "../social/merchants.js";

export const MODE = "trade";
const EMPTY = {
  theirs: "(sold out)", yours: "(you have nothing to sell)",
  services: (c) => `(nothing ${c.name} can do for you right now)`,
};

const rows = (game) => tradeRows(game, game.trade.npc, game.trade.tab);

export function drawTrade(game) {
  const t = game.trade, c = t.npc, rs = rows(game), p = game.player;
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 86), Math.min(S.rows - 2, Math.max(rs.length, 1) + 11));
  box(x0, y0, w, h, { edge: [200, 160, 60] });
  const name = (c.name || typeOf(c)?.name || "the trader").toUpperCase();
  S.text(x0 + 2, y0, ` ${name} `.slice(0, w - 4), ...UI.title);
  tabs(x0 + 2, y0 + 1, TRADE_TABS, TRADE_TABS.indexOf(t.tab));
  const purse = `your ${CURRENCY.name}: ${funds(p)}`;
  S.text(x0 + w - purse.length - 2, y0 + 1, purse, ...CURRENCY.color);
  S.text(x0 + 3, y0 + 2, priceNote(game, c).text.slice(0, w - 6), ...UI.help);
  const n = Math.max(1, Math.min(rs.length, h - 9));
  list(t, { x: x0 + 2, y: y0 + 4, w: w - 4, h: n, items: rs,
    empty: typeof EMPTY[t.tab] === "function" ? EMPTY[t.tab](c) : EMPTY[t.tab],
    row: (r, i, { x, y, w: rw, sel }) => {
      const [glyph, color] = rowGlyph(game, r) || ["?", UI.text];
      if (sel) S.text(x, y, ">", ...UI.mark);
      S.put(x + 2, y, glyph, ...color);
      const price = r.price > 0 ? formatPrice(r.price) : "-";
      S.text(x + 4, y, rowLabel(game, r).slice(0, Math.max(0, rw - price.length - 7)), ...(sel ? UI.sel : UI.text));
      const dear = t.tab !== "yours" && r.price > funds(p);
      S.text(x + rw - price.length - 1, y, price, ...(dear ? UI.bad : CURRENCY.color));
    } });
  const sel = rs[t.sel];
  if (sel) S.text(x0 + 3, y0 + h - 4, rowInfo(game, sel).slice(0, w - 6), ...UI.info);
  const verb = { theirs: "buy", yours: "sell", services: "pay" }[t.tab];
  const help = { x: x0 + 3, y: y0 + h - 2, text: `Enter ${verb} · Tab / ←→ switch · Esc back` };
  S.text(help.x, help.y, help.text, ...UI.help);
  hitLabel(help, "Esc back", { key: "Escape" });
}

export function closeTrade(game) {
  if (game.mode === MODE) popMode(game);
  game.trade = null;
}

function switchTab(game, k) {
  game.trade.tab = TRADE_TABS[(k + TRADE_TABS.length) % TRADE_TABS.length];
  game.trade.sel = 0; game.trade.top = 0;
}

export function tradeChosen(game) {
  const t = game.trade, r = rows(game)[t.sel];
  const out = tradeRow(game, t.npc, t.tab, r);
  if (out.ok) sfx("gold");
  if (out.offer) { switchTab(game, TRADE_TABS.indexOf(out.offer)); return out; }   // a full flask: their goods instead
  t.sel = Math.max(0, Math.min(t.sel, rows(game).length - 1));
  return out;
}

export function tradeKey(game, code) {
  const t = game.trade;
  if (code === "Escape") { closeTrade(game); return true; }
  const k = TRADE_TABS.indexOf(t.tab);
  if (code === "Tab" || code === "ArrowRight" || code === "KeyD") { switchTab(game, k + 1); return true; }
  if (code === "ArrowLeft" || code === "KeyA") { switchTab(game, k - 1); return true; }
  const r = listKey(t, code, rows(game).length);
  if (r === "select") tradeChosen(game);
  return r !== null;
}

registerScreen(MODE, {
  draw: drawTrade,
  key(game, code, repeat) {   // a held key never buys, sells or pays twice, nor closes
    if (repeat && ["Escape", "Enter", "NumpadEnter", "KeyE", "Space"].includes(code)) return true;
    return tradeKey(game, code);
  },
  mouse(game, button, cell) {
    if (button === 2) { closeTrade(game); return; }
    if (button !== 0) return;
    const h = at(cell);
    if (h?.key) { tradeKey(game, h.key); return; }
    if (h?.tab !== undefined) { switchTab(game, h.tab); return; }
    const k = listAt(game.trade, cell);
    if (k < 0) return;
    if (k === game.trade.sel) tradeChosen(game); else game.trade.sel = k;
  },
  hover(game, cell) { const k = listAt(game.trade, cell); if (k >= 0) game.trade.sel = k; },
  wheel(game, sign) { listWheel(game.trade, sign, rows(game).length); },
});
