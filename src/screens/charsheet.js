// The character sheet (TECH_DESIGN §4.2 `char`, §4.3 K; owner WS4): four tabs, opened by K in either view; the game
// waits.
//   Attributes   the six, as bought and with their bonuses, their modifiers; HP, AV, DV, MA and the rest derived
//                (stats.js); level and XP; an attribute point kept from a level-up card is spent here (Enter or [+])
//   Mutations    (the Bent) each mutation with its level and cap, raised for a crease (Enter or [+1]); three seeded
//                offers of a new one for 4 creases (progression/mutations.js offerRng: they stand until you buy one);
//                your Cast and the chance a turn of the world leaves a wake. Implants for the Plumb (WS5 fits them)
//   Powers       what you've learned, by rank and tree, and the trees open to you
//   Effects      your statuses and cooldowns, and every bonus the stat bus adds up for you
// Keys: Tab / ← → the tabs, ↑↓ (W S) choose, Enter (E, Space) spend, Esc or K closes. The mouse: the tabs, a row
// chooses it, [+] and [+1] spend, [ Close ].
//
//   openSheet(game, tab = 0)   push the screen (K)
//   sheetView(game) → { tab, tabs, sel, rows, msg }   (checks)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode } from "../screens.js";
import { bind } from "../keys.js";
import { UI, modal, box, list, listKey, listAt, listWheel, wrap, hit, at, tabs, tabsKey } from "../ui.js";
import { ATTRS, attr, mod, maxHp, av, dv, ma, speedMul, cooldownMul, carryCap, examineScore, raiseAttr, bonusTable } from "../stats.js";
import { xpToNext, tierOf, PERKS, perkRank } from "../leveling.js";
import { STATUS_DEFS } from "../status.js";
import { ABILITIES } from "../abilities.js";
import { keysOf } from "../keyset.js";
import { RULES } from "../rules.js";
import { GENOTYPES } from "../content/genotypes.js";
import { BACKGROUNDS } from "../content/backgrounds.js";
import { MUTATIONS } from "../content/mutations.js";
import { TREES } from "../content/powers.js";
import { IMPLANTS } from "../content/items/implants.js";
import { mutationOffers, offerRng, gainMutation, raiseMutation, canGain, canRaise, levelCap, mutationLevel, castOf,
         wakeChance, isDefect, lasting } from "../progression/mutations.js";

export const MODE = "char";
const TABS = ["attributes", "track", "powers", "effects"];
const ATTR_NAME = { str: "Strength", agi: "Agility", tou: "Toughness", int: "Intellect", wil: "Will", ego: "Ego" };
const ATTR_TEXT = {
  str: "Melee damage over a weapon's need, forcing doors and crates, resisting knockback, how far you throw.",
  agi: "To-hit, dodging (DV), critical hits, how far you jump, your aim when throwing.",
  tou: "HP (TOU + 4, then 3 + its modifier a level), saves against poison and disease, falls.",
  int: "Examining artifacts, spotting secret walls, 4 power offers a level at 18, what readings sell for.",
  wil: "Ability cooldowns, mental armour (MA), regeneration, shorter bad effects.",
  ego: "Mental mutations' levels, prices, Kindling gains, followers, how much Cast you bear.",
};

const sheet = { tab: 0, msg: "", lists: TABS.map(() => ({ sel: 0, top: 0 })) };
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const round = (n) => Math.round(n * 100) / 100;
const track = (p) => GENOTYPES[p.genotype]?.track || null;
const tabLabel = (p, k) => (k === 1 ? (track(p) === "implants" ? "Implants" : "Mutations") : ["Attributes", "", "Powers", "Effects"][k]);

export function openSheet(game, tab = 0) {
  Object.assign(sheet, { tab: Math.max(0, Math.min(TABS.length - 1, tab)), msg: "" });
  for (const l of sheet.lists) Object.assign(l, { sel: 0, top: 0 });
  game.travel = null;
  pushMode(game, MODE);
}

// --- Rows ------------------------------------------------------------------------------------------------------
function rowsOf(game, tab = sheet.tab) {
  const p = game.player;
  switch (TABS[tab]) {
    case "attributes": return ATTRS.map((k) => ({ attr: k }));
    case "track":
      if (track(p) === "mutations")
        return [...Object.keys(p.mutations || {}).map((id) => ({ had: id })), ...mutationOffers(game, p, offerRng(game, p)).map((id) => ({ offer: id }))];
      return Object.entries(p.body?.implants || {}).filter(([, it]) => it).map(([part, it]) => ({ implant: it, part }));
    case "powers": return (p.perks ? keysOf(p.perks) : []).filter((k) => PERKS[k]).map((k) => ({ power: k }));
    case "effects":
      return [...Object.keys(p.status || {}).filter((id) => STATUS_DEFS[id]).map((id) => ({ status: id })),
              ...Object.keys(p.cooldowns || {}).map((id) => ({ cooldown: id }))];
    default: return [];
  }
}
export const sheetView = (game) => ({ tab: TABS[sheet.tab], tabs: [...TABS], sel: sheet.lists[sheet.tab].sel, rows: rowsOf(game), msg: sheet.msg });

// --- Spending -----------------------------------------------------------------------------------------------------
function act(game, row) {
  const p = game.player;
  if (!row) return;
  if (row.attr) {
    if (!(p.attrPoints > 0)) { sheet.msg = "You have no attribute points to spend: one comes every 4th level."; return; }
    const before = maxHp(p);
    raiseAttr(p, row.attr, 1);
    p.attrPoints--;
    p.hp += Math.max(0, maxHp(p) - before);   // more TOU: the HP it adds you have at once (as on the level-up card)
    sheet.msg = `Your ${row.attr.toUpperCase()} rises to ${attr(p, row.attr)}.`;
    game.log(sheet.msg, [255, 230, 120]);
    return;
  }
  if (row.had) {
    const why = canRaise(p, row.had);
    if (why) { sheet.msg = `${why[0].toUpperCase()}${why.slice(1)}.`; return; }
    raiseMutation(game, p, row.had);
    sheet.msg = `${MUTATIONS[row.had].name} is level ${p.mutations[row.had]} now.`;
    return;
  }
  if (row.offer) {
    const why = canGain(game, p, row.offer);
    if (why) { sheet.msg = `${why[0].toUpperCase()}${why.slice(1)}.`; return; }
    gainMutation(game, p, row.offer);
    const ab = MUTATIONS[row.offer].ability, k = ab ? (p.hotbar || []).indexOf(ab) : -1;
    sheet.msg = `You gain ${MUTATIONS[row.offer].name}.${k >= 0 ? ` ${ABILITIES[ab].name} is on key ${k + 1}.` : ab ? ` Every key holds something: B puts ${ABILITIES[ab].name} on one.` : ""}`;
  }
}

// --- Drawing -------------------------------------------------------------------------------------------------------
const say = (x, y, w, text, color = UI.text) => { const lines = wrap(text, w); lines.forEach((l, k) => S.text(x, y + k, l, ...color)); return lines.length; };
const button = (x, y, label, payload) => { S.text(x, y, label, ...UI.title); hit({ x, y, w: label.length, h: 1 }, payload); };
// The [+] buttons at the end of the rows on show, drawn after the list so a click on one spends (the list's own row
// rects, drawn with it, would win otherwise). label(row) → "[+]" or null.
function rowButtons(st, rows, x, y, w, h, label) {
  for (let k = 0; k < h && st.top + k < rows.length; k++) {
    const i = st.top + k, l = label(rows[i]);
    if (l) button(x + w - l.length, y + k, l, { act: i });
  }
}

function draw(game) {
  const p = game.player;
  const w = Math.min(S.cols - 2, 98), h = Math.min(S.rows - 2, 28);
  const { x0, y0 } = modal(w, h);
  const who = p.name ? `${p.name}: ${[GENOTYPES[p.genotype]?.name, BACKGROUNDS[p.background]?.name].filter(Boolean).join(", ")}` : "You";
  box(x0, y0, w, h, { title: who.toUpperCase().slice(0, w - 20) });
  S.text(x0 + w - 12, y0, " [ Close ] ", ...UI.title);
  hit({ x: x0 + w - 11, y: y0, w: 9, h: 1 }, { close: true });
  tabs(x0 + 2, y0 + 1, TABS.map((_, k) => tabLabel(p, k)), sheet.tab);
  const L = { x: x0 + 2, y: y0 + 3, w: Math.min(44, Math.floor((w - 4) * 0.48)), h: h - 7 };
  const R = { x: L.x + L.w + 3, y: y0 + 3, w: w - L.w - 7, h: h - 7 };
  [drawAttributes, drawTrack, drawPowers, drawEffects][sheet.tab](game, p, L, R);
  if (sheet.msg) S.text(x0 + 2, y0 + h - 3, sheet.msg.slice(0, w - 4), ...UI.info);
  S.text(x0 + 2, y0 + h - 2, "Tab/←/→ tabs · ↑/↓ choose · Enter spend · Esc close".slice(0, w - 4), ...UI.help);
}

function drawAttributes(game, p, L, R) {
  const pts = p.attrPoints || 0, st = sheet.lists[0];
  list(st, { x: L.x, y: L.y, w: L.w, h: Math.min(L.h, 6), items: rowsOf(game, 0), row: (r, i, { x, y, w: rw, sel }) => {
    const k = r.attr, base = p.attrs?.[k] ?? RULES.attr.base, total = attr(p, k), extra = total - base;
    if (sel) S.text(x, y, ">", ...UI.mark);
    S.text(x + 2, y, `${k.toUpperCase()} ${String(total).padStart(2)}`, ...(sel ? UI.sel : UI.text));
    S.text(x + 9, y, `mod ${signed(mod(p, k))}`.padEnd(7), ...UI.dim);
    if (extra) S.text(x + 17, y, `(${base} ${signed(extra)})`, ...UI.dim);
  } });
  rowButtons(st, rowsOf(game, 0), L.x, L.y, L.w, Math.min(L.h, 6), () => (pts > 0 ? "[+]" : null));
  let y = L.y + 7;
  if (pts > 0) S.text(L.x, y++, `${pts} attribute point${pts > 1 ? "s" : ""} to spend: Enter or [+].`, ...UI.title);
  const k = ATTRS[st.sel];
  S.text(L.x, y++, ATTR_NAME[k].toUpperCase(), ...UI.title);
  say(L.x, y, L.w, ATTR_TEXT[k], UI.dim);

  let ry = R.y;
  const line = (text, color = UI.text) => { if (ry < R.y + R.h) S.text(R.x, ry++, text.slice(0, R.w), ...color); };
  line(`Level ${p.level} (tier ${tierOf(p.level)})   XP ${p.xp} of ${xpToNext(p.level)}`, UI.title);
  line(`HP ${Math.ceil(p.hp)} of ${maxHp(p)}   AV ${av(p)}   DV ${dv(p)}   MA ${ma(p)}`);
  line(`Speed x${round(speedMul(p))}   Cooldowns x${round(cooldownMul(p))}   Carry ${carryCap(p)}`);
  line(`Examine ${examineScore(p)}   Regeneration ${RULES.stats === "legacy" ? "none" : `1 HP / ${round(RULES.regen.base / Math.max(0.1, 1 + 0.1 * (mod(p, "tou") + mod(p, "wil"))))} s`}`);
  ry++;
  if (track(p) === "mutations") {
    line(`Creases ${p.creases || 0}: a new mutation 4, a level 1`, UI.title);
    line(`Cast ${castOf(p)}: ${Math.round(wakeChance(p) * 100)}% a turn of the world leaves a wake`, UI.dim);
  } else if (track(p) === "implants") line(`Grade ${p.grade ?? 0}: true-marks raise it`, UI.title);
  else line("The quick start: no second track. Make a character for one.", UI.dim);
  if (p.trees?.length) line(`Open trees: ${p.trees.map((t) => TREES[t]?.name || t).join(", ")}`, UI.dim);
}

function drawTrack(game, p, L, R) {
  const st = sheet.lists[1], rows = rowsOf(game, 1);
  if (track(p) !== "mutations") {
    list(st, { x: L.x, y: L.y, w: L.w, h: L.h, items: rows, empty: track(p) === "implants" ? "(no implant fitted yet)" : "(no second track)",
      row: (r, i, { x, y, w: rw, sel }) => {
        if (sel) S.text(x, y, ">", ...UI.mark);
        S.text(x + 2, y, `${IMPLANTS[r.implant.id]?.name || r.implant.id} (${r.part})`.slice(0, rw - 2), ...(sel ? UI.sel : UI.text));
      } });
    say(R.x, R.y, R.w, track(p) === "implants"
      ? `Grade ${p.grade ?? 0}. Implants are fitted at a Truing Cradle (Benchmark, the Metronome, the Square)${p.origin?.implant && !p.origin.fitted ? `; your Level sent you down with ${IMPLANTS[p.origin.implant]?.name || p.origin.implant}, fitted once the Cradles' implants are in the game` : ""}.`
      : "The quick start's hero has neither mutations nor implants: a character made with the wizard has one or the other.", UI.dim);
    return;
  }
  const cap = (id) => levelCap(p, id);
  list(st, { x: L.x, y: L.y, w: L.w, h: L.h, items: rows, empty: "(no mutations)", row: (r, i, { x, y, w: rw, sel }) => {
    const id = r.had || r.offer, m = MUTATIONS[id];
    if (sel) S.text(x, y, ">", ...UI.mark);
    if (r.had) {
      const lvl = p.mutations[id], tag = isDefect(id) ? "defect" : `${lvl}/${cap(id)}`;
      S.text(x + 2, y, `${m.name}${m.planar ? " ◆" : ""}`.slice(0, rw - 12), ...(sel ? UI.sel : isDefect(id) ? UI.dim : UI.text));
      S.text(x + rw - 11, y, tag, ...UI.dim);
    } else {
      S.text(x + 2, y, `new: ${m.name}${m.planar ? " ◆" : ""}`.slice(0, rw - 8), ...(sel ? UI.sel : UI.info));
      if (canGain(game, p, id)) S.text(x + rw - 4, y, "4", ...UI.help);
    }
  } });
  // [+1] raises a mutation a level, [+4] buys an offer: shown only when you can.
  rowButtons(st, rows, L.x, L.y, L.w, L.h, (r) => (r.had ? (!isDefect(r.had) && !canRaise(p, r.had) ? "[+1]" : null) : !canGain(game, p, r.offer) ? "[+4]" : null));
  let ry = R.y;
  S.text(R.x, ry++, `CREASES: ${p.creases || 0}`, ...UI.title);
  ry += say(R.x, ry, R.w, "A new mutation costs 4 (the offers stand until you take one; ◆ planar), a level 1. A level can't pass half your own, plus one.", UI.dim);
  ry += say(R.x, ry, R.w, `Cast ${castOf(p)} (mental levels, EGO's included): a turn of the world leaves a wake ${Math.round(wakeChance(p) * 100)}% of the time.`, UI.dim);
  ry++;
  const r = rows[st.sel], id = r?.had || r?.offer, m = MUTATIONS[id];
  if (!m) return;
  const lvl = r.had ? mutationLevel(p, id) : 1;
  S.text(R.x, ry++, `${m.name.toUpperCase()} (${m.kind}${r.had && !isDefect(id) ? `, level ${p.mutations[id]}${m.kind === "mental" && lvl !== p.mutations[id] ? `, works at ${lvl}` : ""}` : ""})`.slice(0, R.w), ...UI.title);
  ry += say(R.x, ry, R.w, m.info(lvl), UI.text);
  if (r.had && !isDefect(id) && p.mutations[id] < (m.max ?? 10)) ry += say(R.x, ry, R.w, `Next level: ${m.info(lvl + 1)}`, UI.dim);
  if (m.bridge) ry += say(R.x, ry, R.w, `Both views: ${m.bridge}.`, UI.info);
  const why = r.had ? (isDefect(id) ? null : canRaise(p, id)) : canGain(game, p, id);
  if (why) say(R.x, ry, R.w, `${why[0].toUpperCase()}${why.slice(1)}.`, UI.bad);
}

function drawPowers(game, p, L, R) {
  const st = sheet.lists[2], rows = rowsOf(game, 2);
  list(st, { x: L.x, y: L.y, w: L.w, h: L.h, items: rows, empty: "(none yet: one comes with each level)", row: (r, i, { x, y, w: rw, sel }) => {
    const def = PERKS[r.power], rank = perkRank(p, r.power), tree = def.major ? "major" : def.tree ? TREES[def.tree]?.name || def.tree : "general";
    if (sel) S.text(x, y, ">", ...UI.mark);
    S.text(x + 2, y, `${def.name}${rank > 1 ? ` ${["", "", "II", "III", "IV"][rank] || rank}` : ""}`.slice(0, rw - 14), ...(sel ? UI.sel : def.major ? [255, 205, 90] : UI.text));
    S.text(x + rw - Math.min(12, tree.length) - 1, y, tree.slice(0, 12), ...UI.help);
  } });
  let ry = R.y;
  const def = PERKS[rows[st.sel]?.power];
  if (def) { S.text(R.x, ry++, def.name.toUpperCase(), ...UI.title); ry += say(R.x, ry, R.w, def.info, UI.text) + 1; }
  if (p.trees?.length) say(R.x, ry, R.w, `Open trees: ${p.trees.map((t) => TREES[t]?.name || t).join(", ")}. A level offers powers from these and the general pool.`, UI.dim);
  else say(R.x, ry, R.w, "A level offers powers from the general pool (and, while your trees are thin, the others).", UI.dim);
}

function drawEffects(game, p, L, R) {
  const st = sheet.lists[3], rows = rowsOf(game, 3);
  list(st, { x: L.x, y: L.y, w: L.w, h: L.h, items: rows, empty: "(nothing on you)", row: (r, i, { x, y, w: rw, sel }) => {
    if (sel) S.text(x, y, ">", ...UI.mark);
    if (r.status) {
      const def = STATUS_DEFS[r.status], s = p.status[r.status];
      S.text(x + 2, y, def.name.slice(0, rw - 10), ...(sel ? UI.sel : def.color));
      S.text(x + rw - 7, y, Number.isFinite(s.t) && !lasting(s) ? `${Math.ceil(s.t)}s` : "", ...UI.dim);   // (a defect's lasts while its cause holds)
    } else {
      S.text(x + 2, y, `${ABILITIES[r.cooldown]?.name || r.cooldown} cools`.slice(0, rw - 10), ...(sel ? UI.sel : UI.dim));
      S.text(x + rw - 7, y, `${Math.ceil(p.cooldowns[r.cooldown])}s`, ...UI.dim);
    }
  } });
  let ry = R.y;
  S.text(R.x, ry++, "WHAT ADDS UP ON YOU", ...UI.title);
  const table = Object.entries(bonusTable(p)).filter(([k, v]) => v && !/^\d+$/.test(k)).sort(([a], [b]) => a.localeCompare(b));
  if (!table.length) S.text(R.x, ry++, "(no bonuses)", ...UI.empty);
  const per = Math.max(1, Math.floor(R.w / 18));
  table.forEach(([k, v], i) => {
    const y = ry + Math.floor(i / per);
    if (y < R.y + R.h) S.text(R.x + (i % per) * 18, y, `${k} ${signed(round(v))}`.slice(0, 17), ...UI.text);
  });
}

registerScreen(MODE, {
  draw,
  key(game, code, repeat) {
    if (code === "Escape" || code === "KeyK") { if (!repeat) popMode(game); return true; }
    const t = tabsKey(code, sheet.tab, TABS.length);
    if (t !== null) { if (!repeat) { sheet.tab = t; sheet.msg = ""; } return true; }
    const rows = rowsOf(game), st = sheet.lists[sheet.tab];
    const got = listKey(st, code, rows.length);
    if (got === "select" && !repeat) act(game, rows[st.sel]);
    else if (got === "move") sheet.msg = "";
    return true;   // the sheet keeps every key while it's open (time waits)
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    const h = at(cell), rows = rowsOf(game), st = sheet.lists[sheet.tab];
    if (h?.close) { popMode(game); return; }
    if (h && "tab" in h) { sheet.tab = h.tab; sheet.msg = ""; return; }
    if (h && "act" in h) { st.sel = h.act; act(game, rows[h.act]); return; }
    const i = listAt(st, cell);
    if (i >= 0) { st.sel = i; sheet.msg = ""; }
  },
  wheel(game, sign) { listWheel(sheet.lists[sheet.tab], sign, rowsOf(game).length); },
});

bind("play", "KeyK", (game) => openSheet(game), { help: "character sheet" });
