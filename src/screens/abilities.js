// Abilities (TECH_DESIGN §4.2 `abilities`, §2.8, §4.3 B; owner WS4): every ability you have (abilities.js abilitiesOf:
// mutations, the quick start's innate Fold Step, gear, powers), with its level, cooldown and what it does, and the
// hotbar (player.hotbar, ids only): keys 1-9 use what is on it, in 3D and on the map alike (the hint 0D2 asked for).
// Opened by B in either view; the game waits.
//
// Keys: ↑↓ (W S) choose, 1-9 put the chosen ability on that key (off any other), 0 / Delete / Backspace take it off,
// Enter (E, Space) puts it on the first free key, Esc or B closes. The mouse: a row chooses it, a hotbar slot takes the
// chosen ability (a click on the slot it's already on takes it off), a right click empties a slot, [ Close ].
//
//   openAbilities(game)        push the screen (B)
//   abilitiesView(game) → { rows: [{ id, name, lvl, source, key, left, cooldown }], sel, hotbar }   (checks)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode } from "../screens.js";
import { bind } from "../keys.js";
import { UI, modal, box, list, listKey, listAt, listWheel, wrap, hit, at } from "../ui.js";
import { ABILITIES, abilitiesOf, cooldownLeft, abilityCooldown, abilityRange } from "../abilities.js";
import { MUTATIONS } from "../content/mutations.js";
import { statusFlag } from "../status.js";

export const MODE = "abilities";
const SLOTS = 9;
const SOURCE_TEXT = { innate: "born with it", item: "from what you wear", mutations: "a mutation", powers: "a power", implants: "an implant" };
const TARGET_TEXT = { self: "on yourself", dir: "the way you aim", creature: "a creature", tile: "a place", area: "an area" };

const view = { sel: 0, top: 0, msg: "" };

const hotbarOf = (p) => (p.hotbar ||= []);
const keyOf = (p, id) => hotbarOf(p).indexOf(id);
function rowsOf(game) {
  const p = game.player;
  return abilitiesOf(p).map((a) => ({ id: a.id, name: ABILITIES[a.id].name, lvl: a.lvl, source: a.source, item: a.item,
    key: keyOf(p, a.id), left: cooldownLeft(p, a.id), cooldown: abilityCooldown(p, a.id, a.lvl) }));
}
export const abilitiesView = (game) => ({ rows: rowsOf(game), sel: view.sel, hotbar: [...hotbarOf(game.player)] });

export function openAbilities(game) {
  Object.assign(view, { sel: 0, top: 0, msg: "" });
  game.travel = null;
  pushMode(game, MODE);
}

// Put ability `id` on key k (0-8): off any other key first; whatever was on k comes off.
function assign(game, id, k) {
  const bar = hotbarOf(game.player);
  for (let i = 0; i < SLOTS; i++) if (bar[i] === id) bar[i] = null;
  bar[k] = id;
  while (bar.length && !bar[bar.length - 1]) bar.pop();
  view.msg = `${ABILITIES[id].name} is on ${k + 1}.`;
}
function clearSlot(game, k) {
  const bar = hotbarOf(game.player), id = bar[k];
  if (!id) return;
  bar[k] = null;
  while (bar.length && !bar[bar.length - 1]) bar.pop();
  view.msg = `${ABILITIES[id]?.name || id} is off ${k + 1}.`;
}
function firstFree(game, id) {
  const bar = hotbarOf(game.player);
  if (bar.includes(id)) { view.msg = `${ABILITIES[id].name} is on ${bar.indexOf(id) + 1} already.`; return; }
  const k = [...Array(SLOTS).keys()].find((i) => !bar[i]);
  if (k === undefined) { view.msg = "Every key holds something: press 1-9 to replace one."; return; }
  assign(game, id, k);
}

function draw(game) {
  const p = game.player, rows = rowsOf(game);
  const w = Math.min(S.cols - 2, 98), h = Math.min(S.rows - 2, 28);
  const { x0, y0 } = modal(w, h);
  box(x0, y0, w, h, { title: "ABILITIES" });
  S.text(x0 + w - 12, y0, " [ Close ] ", ...UI.title);
  hit({ x: x0 + w - 11, y: y0, w: 9, h: 1 }, { close: true });

  // The hotbar: nine slots across the top, each a click target.
  const sw = Math.floor((w - 4) / SLOTS), bar = hotbarOf(p), mine = new Set(rows.map((r) => r.id));
  S.text(x0 + 2, y0 + 1, "HOTBAR: keys 1-9 use these in 3D and on the map alike", ...UI.title);
  for (let k = 0; k < SLOTS; k++) {
    const id = bar[k], x = x0 + 2 + k * sw, name = id ? ABILITIES[id]?.name || id : "-";
    const sel = rows[view.sel]?.id === id && !!id;
    S.text(x, y0 + 2, `${k + 1}`, ...UI.title);
    S.text(x + 2, y0 + 2, name.slice(0, sw - 2), ...(sel ? UI.sel : id && mine.has(id) ? UI.text : UI.help));
    hit({ x, y: y0 + 2, w: sw - 1, h: 1 }, { slot: k });
  }

  // The list (left) and the chosen one (right).
  const lw = Math.min(46, Math.floor((w - 4) * 0.5)), top = y0 + 4, lh = h - 8;
  S.text(x0 + 2, top - 1, "YOUR ABILITIES", ...UI.title);
  list(view, { x: x0 + 2, y: top, w: lw, h: lh, items: rows, empty: "(none: mutations, implants and some gear give them)",
    row: (r, i, { x, y, w: rw, sel }) => {
      if (sel) S.text(x, y, ">", ...UI.mark);
      const key = r.key >= 0 ? `[${r.key + 1}]` : "   ";
      const state = r.left > 0 ? `${Math.ceil(r.left)}s` : "ready";
      S.text(x + 2, y, key, ...UI.title);
      S.text(x + 6, y, `${r.name}${r.lvl > 1 ? ` ${r.lvl}` : ""}`.slice(0, rw - 14), ...(sel ? UI.sel : UI.text));
      S.text(x + rw - state.length - 1, y, state, ...(r.left > 0 ? UI.bad : UI.info));
    } });
  const rx = x0 + lw + 5, rw = w - lw - 8, r = rows[view.sel];
  let y = top;
  if (r) {
    const def = ABILITIES[r.id];
    S.text(rx, y++, `${def.name.toUpperCase()}${r.lvl > 1 ? `, LEVEL ${r.lvl}` : ""}`.slice(0, rw), ...UI.title);
    const from = r.source === "mutations" ? `a mutation (${MUTATIONS[Object.keys(p.mutations || {}).find((m) => MUTATIONS[m]?.ability === r.id)]?.name || def.name})`
      : r.source === "item" ? `from ${r.item?.name || "what you wear"}` : SOURCE_TEXT[r.source] || r.source;
    S.text(rx, y++, `${from[0].toUpperCase()}${from.slice(1)}`.slice(0, rw), ...UI.dim);
    const range = abilityRange(p, r.id, r.lvl);
    S.text(rx, y++, `Aims ${TARGET_TEXT[def.target] || def.target}${range ? `, up to ${range} tiles` : ""}.`.slice(0, rw), ...UI.dim);
    S.text(rx, y++, `Cools down ${Math.round(r.cooldown * 10) / 10} s (your WIL counts)${r.left > 0 ? `: ${Math.ceil(r.left)} s left` : ""}.`.slice(0, rw), ...UI.dim);
    y++;
    for (const line of wrap(def.info(r.lvl, p), rw)) S.text(rx, y++, line, ...UI.text);
    y++;
    S.text(rx, y++, r.key >= 0 ? `On key ${r.key + 1}.` : "On no key yet: press 1-9.", ...UI.info);
  }
  if (statusFlag(p, "noAct")) S.text(rx, Math.min(y + 1, y0 + h - 4), "You can't move a muscle just now.", ...UI.bad);
  if (view.msg) S.text(x0 + 2, y0 + h - 3, view.msg.slice(0, w - 4), ...UI.info);
  S.text(x0 + 2, y0 + h - 2, "↑/↓ choose · 1-9 put it on that key · 0 take it off · Enter the first free key · Esc close".slice(0, w - 4), ...UI.help);
}

const DIGIT = (code) => (/^(Digit|Numpad)[1-9]$/.test(code) ? Number(code.slice(-1)) - 1 : -1);

registerScreen(MODE, {
  draw,
  key(game, code, repeat) {
    const rows = rowsOf(game), r = rows[view.sel];
    if (code === "Escape" || code === "KeyB") { if (!repeat) popMode(game); return true; }
    const k = DIGIT(code);
    if (k >= 0) { if (!repeat && r) assign(game, r.id, k); return true; }
    if (code === "Digit0" || code === "Numpad0" || code === "Delete" || code === "Backspace") {
      if (!repeat && r && r.key >= 0) clearSlot(game, r.key);
      return true;
    }
    const got = listKey(view, code, rows.length);
    if (got === "select" && !repeat && r) firstFree(game, r.id);
    if (got) view.msg = got === "move" ? "" : view.msg;
    return true;   // nothing else gets through while the list is open (time waits)
  },
  mouse(game, button, cell) {
    const hitAt = at(cell), rows = rowsOf(game), r = rows[view.sel];
    if (hitAt?.close) { popMode(game); return; }
    if (hitAt && "slot" in hitAt) {
      if (button === 2) { clearSlot(game, hitAt.slot); return; }
      if (button !== 0) return;
      if (r && hotbarOf(game.player)[hitAt.slot] === r.id) clearSlot(game, hitAt.slot);
      else if (r) assign(game, r.id, hitAt.slot);
      return;
    }
    const i = listAt(view, cell);
    if (i >= 0 && button === 0) { view.sel = i; view.msg = ""; }
  },
  wheel(game, sign) { listWheel(view, sign, rowsOf(game).length); },
});

bind("play", "KeyB", (game) => openAbilities(game), { help: "abilities and the hotbar" });
