// The screens that sit over the game: conversations, the peddler's shop, the quest journal
// (J), and the full-screen story pages. The game is paused while any of them is open.
//
//   talk:    the words type out (each letter a syllable of the speaker's made-up language:
//            sfx.js), then numbered choices · 1–9, or ↑↓ and Enter/E/Space, or click · Esc leaves
//            (any of those while it's still typing just shows the rest at once)
//   shop:    ↑↓ choose · Enter buys, sells or pays · Tab/←→ switches buy/sell/services · Esc back to talking
//   journal: J or Esc closes
//   story:   Space / Enter / click turns the page
import * as S from "./screen.js";
import { lockPointer, unlockPointer } from "./input.js";
import { talkTo, mapPercent } from "./npcs.js";
import { typeOf, talkersIn } from "./creatures.js";
import { itemName, itemGlyph, itemInfo, itemPrice, addToInventory, isGear, ITEM_KINDS, ELEMENTS, RINGS, AMULETS, POTIONS } from "./items.js";
import { funds, pay, receive, purseRoom, formatPrice, priceLevel, buyPrice, sellPrice, CURRENCY } from "./currency.js";
import { worn, regear } from "./player.js";
import { wielded, carried } from "./body.js";
import { sfx, speakLetter } from "./sfx.js";

// --- Text helpers ----------------------------------------------------------------------
export function wrap(text, width) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!para) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(" ")) {
      if (line && (line + " " + word).length > width) { out.push(line); line = word; }
      else line = line ? line + " " + word : word;
    }
    out.push(line);
  }
  return out;
}

function box(x0, y0, w, h, edge = [140, 115, 50]) {
  S.blank(x0, y0, w, h);
  for (let x = x0; x < x0 + w; x++) { S.put(x, y0, "-", ...edge); S.put(x, y0 + h - 1, "-", ...edge); }
}

function leave(game, ret) {
  game.mode = ret;
  if (game.mode === "explore") { game.paused = false; lockPointer(); }
}

// --- Conversations ---------------------------------------------------------------------------
const talkLayout = { x0: 0, w: 0, rows: [] };   // where each option was drawn, for the mouse

export function openTalk(game, npc) {
  game.travel = null;
  const ret = game.mode === "talk" || game.mode === "shop" ? game.talk.ret : game.mode;
  game.talk = { npc, node: null, sel: 0, ret };
  game.mode = "talk";
  unlockPointer();
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
  const ret = game.talk.ret;
  game.talk = null;
  leave(game, ret);
}

function choose(game, k) {
  const t = game.talk, opt = t.node.options[k];
  if (!opt) return;
  const next = opt.go();
  if (game.mode !== "talk") return;
  sfx("click");
  if (!next) { endTalk(game); return; }
  if (next.shop) { game.shop = { npc: t.npc, tab: next.shop, sel: 0 }; game.mode = "shop"; return; }
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
  S.text(x0 + 3, y0 + h - 2, done ? "1-9 or arrows + Enter to answer · Esc to leave" : "Space: skip ahead", 110, 110, 120);
}

// --- The shop -----------------------------------------------------------------------------------
// Three tabs: buy, sell, and Pell's services (sharpening, reforging, identifying, lifting curses).
// Prices are set by the level when he's met (currency.js priceLevel); crystals get dearer every time
// you buy one (in the whole run); the Haggler perk takes a fifth off (stats.js priceMul).
const TABS = ["buy", "sell", "services"];
const ELEMENT_WORDS = { fire: "flames", frost: "frost", shock: "lightning", holy: "holy light" };

const haggle = (game, price) => buyPrice(game, game.player, price);

function services(game) {
  const p = game.player, f = priceLevel(game.shop.npc.level), rows = [];
  const cost = (n) => haggle(game, Math.round(n * f));
  const jewelFixed = (it) => (it.kind === "ring" || it.kind === "amulet") && (it.kind === "ring" ? RINGS : AMULETS)[it.id].fixed;
  for (const it of worn(p)) {
    if (it.kind === "armour" && it.id === "clothes") continue;
    if (it.ench < 0) rows.push({ label: `Lift the curse on your ${itemName(game, it)}`, glyph: ["+", [255, 245, 200]], price: cost(50),
      info: "The item becomes plain (+0), and you can take it off again.",
      act: () => regear(p, it, (o) => { o.ench = 0; o.known = true; }), done: `Pell mutters over your ${itemName(game, it)}. The curse lifts.` });
    else if (!jewelFixed(it) && it.ench < 5) {
      const verb = it.kind === "weapon" ? "Sharpen" : it.kind === "armour" ? "Reinforce" : "Polish";
      rows.push({ label: `${verb} your ${itemName(game, it)} (+1)`, glyph: ["^", [255, 220, 120]], price: cost(60 * (Math.max(0, it.ench) + 2)),
        info: "Makes it one better. Each time costs more than the last (up to +5).",
        act: () => regear(p, it, (o) => { o.ench = Math.min(5, o.ench + 1); o.known = true; }), target: it });
    }
  }
  const weapon = wielded(p);
  for (const el of ["fire", "frost", "shock", "holy"])
    if (weapon.element !== el && !weapon.relic)
      rows.push({ label: `Forge ${ELEMENT_WORDS[el]} into your ${itemName(game, weapon)}`, glyph: [")", ELEMENTS[el].color], price: cost(150),
        info: `Your weapon ${ELEMENTS[el].info}.${weapon.element ? ` (It stops being ${ELEMENTS[weapon.element].adj}.)` : ""}`,
        act: () => { weapon.element = el; }, target: weapon });
  for (const it of carried(p).slice(worn(p).length)) {   // the belt and the pack
    if (isGear(it) && !it.known && !it.relic) rows.push({ label: `Identify the ${itemName(game, it)}`, glyph: itemGlyph(game, it), price: cost(25),
      info: "Pell tells you how good it is, or whether it's cursed.", act: () => { it.known = true; }, target: it });
    if (it.kind === "potion" && !game.knownPotions.has(it.effect)) rows.push({ label: `Name the ${itemName(game, it)}`, glyph: itemGlyph(game, it), price: cost(25),
      info: "Pell sniffs it and tells you what it is.", act: () => { game.knownPotions.add(it.effect); }, done: `"That? That's a potion of ${POTIONS[it.effect].name}."` });
    if (isGear(it) && it.known && it.ench < 0) rows.push({ label: `Lift the curse on the ${itemName(game, it)}`, glyph: ["+", [255, 245, 200]], price: cost(50),
      info: "The item becomes plain (+0).", act: () => { it.ench = 0; }, target: it });
  }
  return rows;
}

function shopRows(game) {
  const sh = game.shop, p = game.player;
  if (sh.tab === "buy") return sh.npc.talk.state.stock.filter((s) => s.count > 0).map((s) => {
    let price = s.price;
    if (s.item.kind === "heart" || s.item.kind === "strength") price = Math.round(price * 1.5 ** (game.crystalsBought || 0));
    return { it: s.item, price: haggle(game, price), count: s.count, stock: s };
  });
  if (sh.tab === "services") return services(game);
  return p.inv.map((it) => ({ it, price: sellPrice(game, p, itemPrice(it)), count: it.count || 1 }));
}

export function shopKey(game, code) {
  const sh = game.shop, rows = shopRows(game);
  if (code === "Escape") { game.mode = "talk"; game.talk.node = talkTo(game, sh.npc); game.talk.sel = 0; game.shop = null; return; }
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
    row.act();
    game.log(row.done || (row.target ? `Pell hands back your ${itemName(game, row.target)}. (${formatPrice(row.price)})` : `Done. (${formatPrice(row.price)})`), [255, 215, 90]);
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
    if (row.it.kind === "heart" || row.it.kind === "strength") game.crystalsBought = (game.crystalsBought || 0) + 1;
  } else {
    if (row.price <= 0) { game.log(`Pell doesn't want the ${name}.`, [170, 170, 170]); return; }
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
  const tabs = TABS.map((t) => (t === sh.tab ? `[ ${t.toUpperCase()} ]` : `  ${t}  `)).join(" ");
  S.text(x0 + 3, y0 + 1, `PELL'S PACK  · ${tabs}`, 255, 220, 120);
  const purse = `your ${CURRENCY.name}: ${funds(p)}`;
  S.text(x0 + w - purse.length - 3, y0 + 1, purse, ...CURRENCY.color);
  const empty = { buy: "(sold out)", sell: "(you have nothing to sell)", services: "(nothing Pell can do for you right now)" }[sh.tab];
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
  });
  const sel = rows[sh.sel];
  if (sel) S.text(x0 + 3, y0 + h - 4, (sel.info || itemInfo(game, sel.it)).slice(0, w - 6), 180, 180, 190);
  const verb = { buy: "buy", sell: "sell", services: "pay" }[sh.tab];
  S.text(x0 + 3, y0 + h - 2, `Enter ${verb} · Tab / ←→ switch tabs (buy, sell, services) · Esc back`, 110, 110, 120);
}

// --- The journal -----------------------------------------------------------------------------------
export function openJournal(game) {
  game.journalRet = game.mode;
  game.mode = "journal";
  game.travel = null;
  unlockPointer();
}
export function journalKey(game, code) {
  if (code === "KeyJ" || code === "Escape") leave(game, game.journalRet);
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
// pages: [{ title?, text, color? }]. then: called after the last page.
export function openStory(game, pages, then) {
  game.pages = { list: pages, k: 0, then };
  game.mode = "story";
  game.travel = null;
  unlockPointer();
}
export function storyKey(game, code) {
  if (code === "Space" || code === "Enter" || code === "NumpadEnter" || code === "KeyE" || code === "Escape") nextPage(game);
}
export function nextPage(game) {
  const pg = game.pages;
  if (++pg.k < pg.list.length) return;
  game.pages = null;
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
