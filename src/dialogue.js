// The screens that sit over the game: conversations, the peddler's shop, the quest journal
// (J), and the full-screen story pages. The game is paused while any of them is open. Each is a
// registered screen (src/screens/talk.js, journal.js, story.js) on the mode stack (screens.js): opening
// one pushes it, closing it pops back to whatever was under it.
//
//   talk:    the words type out (each letter a syllable of the speaker's made-up language:
//            sfx.js), then numbered choices · 1–9, or ↑↓ and Enter/E/Space, or click · Esc leaves
//            (any of those while it's still typing just shows the rest at once)
//   shop:    ↑↓ choose · Enter buys, sells or pays · Tab/←→ switches buy/sell/services · Esc back to talking
//   journal: J or Esc closes
//   story:   Space / Enter / click turns the page
import * as S from "./screen.js";
import { pushMode, popMode } from "./screens.js";
import { talkTo, servicesFor, serviceDef } from "./talk.js";
import { mapPercent } from "./story/quests.js";
import { typeOf, talkersIn } from "./creatures.js";
import { itemName, itemGlyph, itemInfo, itemPrice, addToInventory, ITEM_KINDS } from "./items.js";
import { funds, pay, receive, purseRoom, formatPrice, buyPrice, sellPrice, CURRENCY } from "./currency.js";
import { sfx, speakLetter } from "./sfx.js";
import { wrap, box as uiBox, UI, hit, hitLabel } from "./ui.js";

// --- Text helpers ----------------------------------------------------------------------
// wrap(text, width) and box() live in ui.js (one copy for every screen); these screens keep the
// parent's look, a rule above and below.
const box = (x0, y0, w, h, edge = UI.edge) => uiBox(x0, y0, w, h, { edge, rules: true });

// --- Conversations ---------------------------------------------------------------------------
const talkLayout = { x0: 0, w: 0, rows: [] };   // where each option was drawn, for the mouse

export function openTalk(game, npc) {
  game.travel = null;
  if (game.mode === "shop") { game.shop = null; popMode(game, undefined, { pointer: false }); }   // back to talking
  const talking = game.mode === "talk";
  game.talk = { npc, node: null, sel: 0 };
  if (!talking) pushMode(game, "talk");
  const first = talkTo(game, npc);
  if (first) showNode(game.talk, first); else endTalk(game);
}

// A new thing to say: lay it out, and start typing it from the beginning.
const TEXT_WIDTH = () => Math.min(S.cols - 4, 86) - 6;
function showNode(t, node) {
  t.node = node; t.sel = 0;
  t.shown = 0; t.clock = 0;
  layOut(t);
}
// Wrap the words to the box's width (again, if the window has changed size since).
function layOut(t) {
  t.width = TEXT_WIDTH();
  t.lines = wrap(t.node.text, t.width);
  t.length = t.lines.join("\n").length;
  t.shown = Math.min(t.shown, t.length);
}
const typing = (t) => t.shown < t.length;

// Once a frame while talking: type out the next letters, speaking each one. Pauses a moment
// at commas and the ends of sentences.
const LETTERS_PER_SECOND = 32;
export function updateTalk(game, dt) {
  const t = game.talk;
  if (!t || !typing(t)) return;
  const text = t.lines.join("\n");
  t.clock += dt;
  while (t.clock > 0 && typing(t)) {
    const ch = text[t.shown++];
    t.clock -= 1 / LETTERS_PER_SECOND;
    if (/[a-z]/i.test(ch)) speakLetter(ch, t.npc.type);
    else if (".!?".includes(ch)) t.clock -= 0.22;
    else if (",;:".includes(ch)) t.clock -= 0.1;
  }
}

function endTalk(game) {
  game.talk = null;
  if (game.mode === "talk") popMode(game);
}

function choose(game, k) {
  const t = game.talk, opt = t.node.options[k];
  if (!opt) return;
  const next = opt.go();
  if (game.mode !== "talk") return;
  sfx("click");
  if (!next) { endTalk(game); return; }
  if (next.shop) { game.shop = { npc: t.npc, tab: next.shop, sel: 0 }; pushMode(game, "shop"); return; }
  showNode(t, next);
}

export function talkKey(game, code) {
  const t = game.talk, n = t.node.options.length;
  if (code === "Escape") { endTalk(game); return; }
  if (typing(t)) { t.shown = t.length; return; }   // still talking: just show the rest
  const digit = /^(Digit|Numpad)([1-9])$/.exec(code);
  if (digit) choose(game, Number(digit[2]) - 1);
  else if (code === "ArrowUp" || code === "KeyW") t.sel = (t.sel + n - 1) % n;
  else if (code === "ArrowDown" || code === "KeyS") t.sel = (t.sel + 1) % n;
  else if (code === "Enter" || code === "NumpadEnter" || code === "Space" || code === "KeyE") choose(game, t.sel);
  else if (code === "Escape") endTalk(game);
}

const optionUnder = (cell) => cell && cell.x >= talkLayout.x0 && cell.x < talkLayout.x0 + talkLayout.w
  ? talkLayout.rows.find((r) => r.y === cell.y)?.k ?? -1 : -1;
export function talkClick(game, cell) {
  if (typing(game.talk)) { game.talk.shown = game.talk.length; return; }
  const k = optionUnder(cell);
  if (k >= 0) choose(game, k);
}
export function talkHover(game, cell) { const k = optionUnder(cell); if (k >= 0 && game.talk) game.talk.sel = k; }

export function drawTalk(game) {
  const t = game.talk, type = typeOf(t.npc);
  if (t.width !== TEXT_WIDTH()) layOut(t);
  const w = Math.min(S.cols - 4, 86), inner = w - 6;
  const text = t.lines;
  const opts = t.node.options.map((o, k) => wrap(`${k + 1}. ${o.label}`, inner - 2));
  const done = !typing(t);
  const h = 5 + text.length + 1 + opts.reduce((a, o) => a + o.length, 0) + 1;
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, S.rows - h - 9);   // above the message log
  box(x0, y0, w, h);
  const title = type.title ? `${type.name}, ${type.title}` : type.name;
  S.text(x0 + 3, y0 + 1, title, ...type.color);
  // The words typed so far (line breaks count as one letter each, as in updateTalk).
  let left = t.shown;
  text.forEach((line, k) => {
    if (left > 0) S.text(x0 + 3, y0 + 3 + k, line.slice(0, left), 225, 225, 225);
    left -= line.length + 1;
  });
  let y = y0 + 4 + text.length;
  talkLayout.x0 = x0; talkLayout.w = w; talkLayout.rows = [];
  if (done) opts.forEach((lines, k) => {
    const sel = k === t.sel;
    lines.forEach((line, j) => {
      if (sel && j === 0) S.text(x0 + 1, y, ">", 255, 230, 140);
      S.text(x0 + 3 + (j ? 3 : 0), y, line, ...(sel ? [255, 255, 255] : [175, 175, 185]));
      talkLayout.rows.push({ y, k });
      y++;
    });
  });
  const help = done ? "1-9 or arrows + Enter to answer · Esc to leave" : "Space: skip ahead";
  S.text(x0 + 3, y0 + h - 2, help, 110, 110, 120);
  hitLabel({ x: x0 + 3, y: y0 + h - 2, text: help }, "Esc to leave", { key: "Escape" });
}

// --- The shop -----------------------------------------------------------------------------------
// Three tabs: buy, sell, and the merchant's services (Pell's: sharpening, reforging, identifying,
// lifting curses; registered in content/legacy/encounters.js through talk.js registerService).
// Prices are set by the level when he's met (currency.js priceLevel); crystals get dearer every time
// you buy one (in the whole run); the Haggler perk takes a fifth off (stats.js priceMul).
const TABS = ["buy", "sell", "services"];

const haggle = (game, price) => buyPrice(game, game.player, price);

// The services tab: one row per service and target (talk.js servicesFor).
function services(game) {
  const c = game.shop.npc;
  return servicesFor(game, c).map(({ id, target }) => {
    const s = serviceDef(id);
    return { label: s.label(game, c, target), glyph: s.glyph?.(game, c, target), price: s.price(game, c, target),
             info: s.info?.(game, c, target), service: s, target };
  });
}

function shopRows(game) {
  const sh = game.shop, p = game.player;
  if (sh.tab === "buy") return sh.npc.talk.state.stock.filter((s) => s.count > 0).map((s) => {
    let price = s.price;
    if (s.item.kind === "heart" || s.item.kind === "strength") price = Math.round(price * 1.5 ** (game.state.merchants.crystalsBought || 0));
    return { it: s.item, price: haggle(game, price), count: s.count, stock: s };
  });
  if (sh.tab === "services") return services(game);
  return p.inv.map((it) => ({ it, price: sellPrice(game, p, itemPrice(it)), count: it.count || 1 }));
}

export function shopKey(game, code) {
  const sh = game.shop, rows = shopRows(game);
  if (code === "Escape") { popMode(game); game.talk.node = talkTo(game, sh.npc); game.talk.sel = 0; game.shop = null; return; }
  const step = code === "Tab" || code === "ArrowRight" || code === "KeyD" ? 1 : code === "ArrowLeft" || code === "KeyA" ? -1 : 0;
  if (step) { sh.tab = TABS[(TABS.indexOf(sh.tab) + step + TABS.length) % TABS.length]; sh.sel = 0; return; }
  if (code === "ArrowUp" || code === "KeyW") sh.sel = Math.max(0, sh.sel - 1);
  else if (code === "ArrowDown" || code === "KeyS") sh.sel = Math.min(rows.length - 1, sh.sel + 1);
  else if (code === "Enter" || code === "NumpadEnter" || code === "Space" || code === "KeyE") trade(game, rows[sh.sel]);
}

function trade(game, row) {
  if (!row) return;
  const p = game.player, sh = game.shop;
  if (sh.tab === "services") {
    if (!pay(game, p, row.price)) { game.log(`You can't afford that (${formatPrice(row.price)}).`, [255, 150, 120]); return; }
    sfx("gold");
    row.service.run(game, sh.npc, row.target);
    game.log(row.service.done?.(game, sh.npc, row.target, row.price) || `Done. (${formatPrice(row.price)})`, [255, 215, 90]);
    sh.sel = Math.max(0, Math.min(sh.sel, shopRows(game).length - 1));
    return;
  }
  const name = itemName(game, { ...row.it, count: 1 });
  if (sh.tab === "buy") {
    if (!pay(game, p, row.price)) { game.log(`You can't afford the ${name} (${formatPrice(row.price)}).`, [255, 150, 120]); return; }
    sfx("gold");
    row.stock.count--;
    // A crystal is absorbed at once, as when you walk over one (its kind's onPickup).
    if (!ITEM_KINDS[row.it.kind]?.onPickup?.(game, p, { ...row.it })) {
      addToInventory(p, { ...row.it, count: 1 });
      game.log(`You buy the ${name} for ${formatPrice(row.price)}.`, [255, 215, 90]);
    }
    if (row.it.kind === "heart" || row.it.kind === "strength") game.state.merchants.crystalsBought = (game.state.merchants.crystalsBought || 0) + 1;   // (game.js attachState)
  } else {
    if (row.price <= 0) { game.log(`${sh.npc.name} doesn't want the ${name}.`, [170, 170, 170]); return; }
    if (purseRoom(p) < row.price) { game.log(`Your purse can't hold another ${formatPrice(row.price)}.`, [255, 150, 120]); return; }
    receive(game, p, row.price);
    sfx("gold");
    if (row.it.count > 1) row.it.count--; else p.inv.splice(p.inv.indexOf(row.it), 1);
    game.log(`You sell the ${name} for ${formatPrice(row.price)}.`, [255, 215, 90]);
  }
  sh.sel = Math.max(0, Math.min(sh.sel, shopRows(game).length - 1));
}

export function drawShop(game) {
  const sh = game.shop, rows = shopRows(game), p = game.player;
  const w = Math.min(S.cols - 4, 84), h = Math.max(rows.length, 1) + 9;
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  box(x0, y0, w, h, [200, 160, 60]);
  const tabLabels = TABS.map((t) => (t === sh.tab ? `[ ${t.toUpperCase()} ]` : `  ${t}  `)), tabs = tabLabels.join(" ");
  const head = { x: x0 + 3, y: y0 + 1, text: `${typeOf(sh.npc).name.toUpperCase()}'S PACK  · ${tabs}` };
  S.text(head.x, head.y, head.text, 255, 220, 120);
  tabLabels.forEach((label, k) => hitLabel(head, label, { tab: TABS[k] }));
  const purse = `your ${CURRENCY.name}: ${funds(p)}`;
  S.text(x0 + w - purse.length - 3, y0 + 1, purse, ...CURRENCY.color);
  const empty = { buy: "(sold out)", sell: "(you have nothing to sell)", services: `(nothing ${sh.npc.name} can do for you right now)` }[sh.tab];
  if (!rows.length) S.text(x0 + 5, y0 + 3, empty, 130, 130, 130);
  rows.forEach((r, k) => {
    const y = y0 + 3 + k, sel = k === sh.sel;
    const [glyph, color] = r.glyph || itemGlyph(game, r.it);
    if (sel) S.text(x0 + 1, y, ">", 255, 230, 140);
    S.put(x0 + 3, y, glyph, ...color);
    const label = r.label || itemName(game, { ...r.it, count: 1 }) + (r.count > 1 ? ` x${r.count}` : "");
    const price = r.price > 0 ? formatPrice(r.price) : "-";
    S.text(x0 + 5, y, label.slice(0, w - price.length - 10), ...(sel ? [255, 255, 255] : [200, 200, 200]));
    S.text(x0 + w - price.length - 3, y, price, ...(sh.tab !== "sell" && r.price > funds(p) ? [200, 90, 80] : CURRENCY.color));
    hit({ x: x0, y, w, h: 1 }, { row: k });
  });
  const sel = rows[sh.sel];
  if (sel) S.text(x0 + 3, y0 + h - 4, (sel.info || itemInfo(game, sel.it)).slice(0, w - 6), 180, 180, 190);
  const verb = { buy: "buy", sell: "sell", services: "pay" }[sh.tab];
  const help = { x: x0 + 3, y: y0 + h - 2, text: `Enter ${verb} · Tab / ←→ switch tabs (buy, sell, services) · Esc back` };
  S.text(help.x, help.y, help.text, 110, 110, 120);
  hitLabel(help, "Esc back", { key: "Escape" });
}

// The mouse in the shop: a tab switches to it, a row selects it, the selected row trades, "Esc back" goes back.
export function shopClick(game, hitAt) {
  const sh = game.shop;
  if (!hitAt) return;
  if (hitAt.key) shopKey(game, hitAt.key);
  else if (hitAt.tab) { sh.tab = hitAt.tab; sh.sel = 0; }
  else if (hitAt.row !== undefined) { if (hitAt.row === sh.sel) trade(game, shopRows(game)[sh.sel]); else sh.sel = hitAt.row; }
}

// --- The journal -----------------------------------------------------------------------------------
export function openJournal(game) {
  game.travel = null;
  pushMode(game, "journal");
}
export function journalKey(game, code) {
  if (code === "KeyJ" || code === "Escape") popMode(game);
}

export function drawJournal(game) {
  const w = Math.min(S.cols - 4, 84), inner = w - 6;
  const active = game.quests.filter((q) => !q.done), done = game.quests.filter((q) => q.done);
  const lines = [];
  if (!game.quests.length) lines.push(["Nothing yet.", [130, 130, 130]]);
  for (const q of active) {
    lines.push([q.title, [255, 220, 120]]);
    for (const l of wrap(q.text, inner - 2)) lines.push(["  " + l, [200, 200, 205]]);
    if (q.id === "mira" && talkersIn(game.zone).some((n) => n.talk.dialogue === "mira")) lines.push([`  (This floor: ${mapPercent(game.zone)}% mapped so far.)`, [120, 220, 200]]);
    lines.push(["", null]);
  }
  if (done.length) lines.push(["Done:", [120, 200, 130]]);
  for (const q of done) lines.push(["  ✓ " + q.title, [120, 170, 125]]);
  const h = Math.min(S.rows - 2, lines.length + 6);
  const x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  box(x0, y0, w, h, [120, 150, 200]);
  S.text(x0 + 3, y0 + 1, "JOURNAL", 200, 220, 255);
  lines.slice(0, h - 5).forEach(([t, c], k) => c && S.text(x0 + 3, y0 + 3 + k, t, ...c));
  S.text(x0 + 3, y0 + h - 2, "J or Esc to close", 110, 110, 120);
}

// --- Story pages ------------------------------------------------------------------------------------
// pages: [{ title?, text, color? }]. then: called after the last page, once the story screen has closed
// (it says where the pointer goes: the pages leave it unlocked).
export function openStory(game, pages, then) {
  game.pages = { list: pages, k: 0, then };
  game.travel = null;
  pushMode(game, "story");
}
export function storyKey(game, code) {
  if (code === "Space" || code === "Enter" || code === "NumpadEnter" || code === "KeyE" || code === "Escape") nextPage(game);
}
export function nextPage(game) {
  const pg = game.pages;
  if (++pg.k < pg.list.length) return;
  game.pages = null;
  if (game.mode === "story") popMode(game, undefined, { pointer: false });
  pg.then();
}

export function drawStory(game) {
  S.clear();
  const page = game.pages.list[game.pages.k];
  const w = Math.min(S.cols - 8, 70);
  const lines = wrap(page.text, w);
  const h = lines.length + (page.title ? 3 : 0);
  let y = Math.max(1, (S.rows - h) >> 1) - 1;
  if (page.title) { S.text((S.cols - page.title.length) >> 1, y, page.title, 255, 230, 120); y += 3; }
  const x0 = (S.cols - w) >> 1;
  const c = page.color || [215, 215, 225];
  lines.forEach((l, k) => S.text(x0, y + k, l, ...c));
  const more = "Space / click: continue";
  S.text((S.cols - more.length) >> 1, S.rows - 3, more, 120, 120, 130);
}
