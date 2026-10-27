// The Kindling's menu (TECH_DESIGN §4.2 `ritual`; DECISIONS §1 "Bonding"; bible §3.3; owner WS6b): what you can
// ask of a flame-kin, each row with the reputation it moves with its faction (social/ritual.js ritualRows): give a
// reading it wants or a rumour, ask for one of its readings, learn a power it teaches, ask it to walk with you, ask
// for its best item. The head shows your standing with its faction and how much of the +120 the creature can
// still give. Opened from talk ("Sit with me a while"; social/ritual.js openRitual).
//
//   ↑↓ / W S / the wheel choose · Enter, E or Space (or a click on the chosen row) asks · Esc (or a click on
//   "Esc back", or a right click) back to talking
import * as S from "../screen.js";
import { registerScreen, popMode } from "../screens.js";
import { UI, box, modal, list, listKey, listWheel, listAt, hitLabel, at, wrap } from "../ui.js";
import { FACTIONS, repOf, bandName } from "../factions.js";
import { sfx } from "../sfx.js";
import { ritualRows, ritualRow, kin, KINDLING, RITES } from "../social/ritual.js";

export const MODE = "ritual";
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const rows = (game) => ritualRows(game, game.ritual.npc);

export function drawRitual(game) {
  const r = game.ritual, c = r.npc, k = kin(game, c), rs = rows(game);
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 84), Math.min(S.rows - 2, Math.max(rs.length, 1) + 12));
  box(x0, y0, w, h, { edge: [220, 170, 90], title: ` THE KINDLING · ${String(c.name || "").toUpperCase()} ` });
  if (k) {
    const f = FACTIONS[k.faction], rep = repOf(game, k.faction);
    const who = f.name.charAt(0).toUpperCase() + f.name.slice(1);
    S.text(x0 + 3, y0 + 2, `Flame-kin by ${RITES[k.rite]?.name || "a rite"}. ${who}: ${bandName(rep)} ${rep}.`.slice(0, w - 6), ...(f.color || UI.text));
    S.text(x0 + 3, y0 + 3, `Still to earn from ${c.name}: ${Math.max(0, KINDLING.cap - (k.net || 0))} of ${KINDLING.cap}.`.slice(0, w - 6), ...UI.help);
  }
  const n = Math.max(1, Math.min(rs.length, h - 11));
  list(r, { x: x0 + 2, y: y0 + 5, w: w - 4, h: n, items: rs, empty: "Nothing to ask for now. Bring readings; they're always wanted.",
    row: (row, i, { x, y, w: rw, sel }) => {
      if (sel) S.text(x, y, ">", ...UI.mark);
      const cost = signed(row.n);
      S.text(x + 2, y, row.label.slice(0, Math.max(0, rw - cost.length - 5)), ...(row.why ? UI.empty : sel ? UI.sel : UI.text));
      S.text(x + rw - cost.length - 1, y, cost, ...(row.n > 0 ? [150, 210, 140] : [230, 170, 120]));
    } });
  const sel = rs[r.sel];
  let y = y0 + h - 5;
  const note = sel?.why || r.said || "";
  for (const line of wrap(note, w - 6).slice(0, 2)) S.text(x0 + 3, y++, line, ...(sel?.why ? UI.bad : UI.info));
  const help = { x: x0 + 3, y: y0 + h - 2, text: "Enter ask · Esc back" };
  S.text(help.x, help.y, help.text, ...UI.help);
  hitLabel(help, "Esc back", { key: "Escape" });
}

export function closeRitual(game) {
  if (game.mode === MODE) popMode(game);
  game.ritual = null;
}

export function ritualChosen(game) {
  const r = game.ritual, out = ritualRow(game, r.npc, rows(game)[r.sel]);
  r.said = out.line;
  if (out.ok) sfx("click");
  r.sel = Math.max(0, Math.min(r.sel, rows(game).length - 1));
  return out;
}

registerScreen(MODE, {
  draw: drawRitual,
  key(game, code, repeat) {
    if (code === "Escape") { if (!repeat) closeRitual(game); return true; }
    const r = listKey(game.ritual, code, rows(game).length);
    if (r === "select" && !repeat) ritualChosen(game);
    return r !== null;
  },
  mouse(game, button, cell) {
    if (button === 2) { closeRitual(game); return; }
    if (button !== 0) return;
    const h = at(cell);
    if (h?.key === "Escape") { closeRitual(game); return; }
    const k = listAt(game.ritual, cell);
    if (k < 0) return;
    if (k === game.ritual.sel) ritualChosen(game); else game.ritual.sel = k;
  },
  hover(game, cell) { const k = listAt(game.ritual, cell); if (k >= 0) game.ritual.sel = k; },
  wheel(game, sign) { listWheel(game.ritual, sign, rows(game).length); },
});
