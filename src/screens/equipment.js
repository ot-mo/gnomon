// Equipment (TECH_DESIGN §4.2 `inventory`, its Equipment tab; owner WS5), and the Truing Cradle.
//
// The inventory screen: inventory.js draws both tabs (Pack and Equipment) and answers the keys; this file registers
// it as the "inventory" mode (in place of P0's port, screens/inventory.js, whose inventoryAction still spends an
// action's time). An artifact that needs a target ({ aim }) closes the screen and asks for one (bodymods/artifacts.js).
//
// The Truing Cradle ("truing"; bodymods/stations.js opens it when you use a Cradle, in either view): your implant
// sockets and the implants in your pack, in one list. Enter on an implant in the pack fits it into the first free
// socket it goes in (25 glim × its grade, and a world hour on the table); on a socket that holds one, takes it out
// (the grade comes back; a † one is destroyed); G spends true-marks on the next grade. Esc leaves.
//   openTruing(game, at)    at: { at: "cradle", x, y, z }: where you lie (bodymods withTruing's context)
//   truingRows(game) → [{ kind: "socket" | "pack" | "grade", … }]
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode, modeData } from "../screens.js";
import { UI, at, hit, hitLabel, list, listKey, listWheel, listAt, wrap } from "../ui.js";
import { inventoryKey, inventoryClick, inventoryWheel, drawInventory, closeInventory, INVENTORY_KEYS, partLabel } from "../inventory.js";
import { inventoryAction } from "./inventory.js";
import { itemName, itemGlyph, itemInfo } from "../items.js";
import { formatPrice, formatFunds, funds } from "../currency.js";
import { IMPLANTS } from "../content/items/implants.js";
import { canInstall, install, uninstall, socketsFor, installedImplants, gradeOf, gradeUsed, gradeFree, gradeCost, trueMarks,
  raiseGrade, fittingFee, withTruing, isPlumb } from "../bodymods/implants.js";
import { aimArtifact } from "../bodymods/artifacts.js";

// --- The inventory ------------------------------------------------------------------------------------------------
function act(game, cost) {
  if (cost && typeof cost === "object" && cost.aim) {
    closeInventory(game);
    aimArtifact(game, game.player, cost.aim);
    return;
  }
  inventoryAction(game, cost);
}
registerScreen("inventory", {
  draw: drawInventory,
  key(game, code) {
    if (!INVENTORY_KEYS.has(code)) return false;
    act(game, inventoryKey(game, code));
    return true;
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    act(game, inventoryClick(game, cell));
  },
  wheel(game, sign) { inventoryWheel(game, sign); },
});

// --- The Truing Cradle ---------------------------------------------------------------------------------------------
export function openTruing(game, where) {
  game.travel = null;
  pushMode(game, "truing", { at: where, list: { sel: 0, top: 0 } });
}

export function truingRows(game) {
  const p = game.player, rows = [];
  for (const part of p.body.parts) if (part.implant) rows.push({ kind: "socket", part, implant: p.body.implants[part.id] || null });
  for (const item of p.inv) if (item.kind === "implant") rows.push({ kind: "pack", item, sockets: socketsFor(p, item) });
  rows.push({ kind: "grade" });
  return rows;
}

const WHY = {
  genotype: "The Cradle is cut to a Plumb's measure.", grade: "That's more than your grade has room for.",
  taken: "That socket already holds one.", slot: "It doesn't go there.", twice: "You already have one of those.",
  funds: "You can't pay the fitting fee.", hunted: "You can't lie still with something hunting you.",
  station: "Only a Truing Cradle or a surgeon can do that.", part: "There's no socket for it.",
};
const say = (game, text, color = [170, 170, 170]) => game.log(text, color);

function truingAct(game, row) {
  const p = game.player, where = modeData(game)?.at || { at: "cradle" };
  if (!row) return;
  if (row.kind === "grade") {
    const r = raiseGrade(game, p);
    if (r.ok) say(game, `The draughtsman stamps your line with ${r.cost > 1 ? `${r.cost} true-marks` : "a true-mark"}. Your grade is ${gradeOf(p)} now.`, [235, 235, 210]);
    else say(game, r.reason === "marks" ? `The next grade takes ${gradeCost(p) > 1 ? `${gradeCost(p)} true-marks` : "a true-mark"}; you have ${trueMarks(p)}.` : WHY[r.reason] || "Nothing happens.");
    return;
  }
  if (row.kind === "socket") {
    if (!row.implant) { say(game, "Choose an implant from your pack (below) to fit."); return; }
    const name = itemName(game, row.implant);
    const r = withTruing(game, where, () => uninstall(game, p, row.part.id));
    if (!r.ok) { say(game, WHY[r.reason] || "Nothing happens."); return; }
    say(game, r.destroyed ? `The Cradle draws out the ${name}. It crumbles as it leaves you. (An hour passes.)`
                          : `The Cradle draws out the ${name}; it's in your pack. (An hour passes.)`, [150, 210, 230]);
    for (const d of r.dropped || []) say(game, `The ${itemName(game, d)} you carried there goes into your pack.`);
    return;
  }
  const name = itemName(game, row.item);
  const part = withTruing(game, where, () => row.sockets.find((id) => canInstall(game, p, row.item, id).ok));
  if (!part) {
    const why = row.sockets.length ? withTruing(game, where, () => canInstall(game, p, row.item, row.sockets[0])).reason : "part";
    say(game, `The ${name}: ${WHY[why] || "it won't go in."}`);
    return;
  }
  const r = withTruing(game, where, () => install(game, p, row.item, part));
  if (!r.ok) { say(game, `The ${name}: ${WHY[r.reason] || "it won't go in."}${r.reason === "funds" ? ` (${formatPrice(r.fee)})` : ""}`); return; }
  say(game, `You lie in the Cradle while the ${name} is fitted into your ${partLabel(p.body.parts.find((q) => q.id === part)).toLowerCase()}. (${formatPrice(r.fee)}, an hour.)`, [150, 210, 230]);
}

function drawTruing(game) {
  const p = game.player, data = modeData(game) || {}, state = (data.list ||= { sel: 0, top: 0 });
  const rows = truingRows(game);
  const w = Math.min(S.cols - 4, 90), listH = Math.max(4, Math.min(S.rows - 12, rows.length));
  const h = listH + 8, x0 = (S.cols - w) >> 1, y0 = Math.max(1, (S.rows - h) >> 1);
  S.blank(x0, y0, w, h);
  const line = (y) => { for (let x = x0; x < x0 + w; x++) S.put(x, y, "-", 70, 90, 100); };
  line(y0); line(y0 + 2); line(y0 + h - 1);
  S.text(x0 + 2, y0 + 1, "TRUING CRADLE", 150, 220, 240);
  const head = `grade ${gradeUsed(p)} of ${gradeOf(p)} used · ${trueMarks(p)} true-mark${trueMarks(p) === 1 ? "" : "s"} · ${formatFunds(p)}`;
  S.text(x0 + w - head.length - 2, y0 + 1, head, 170, 170, 170);
  list(state, {
    x: x0 + 1, y: y0 + 3, w: w - 2, h: listH, items: rows,
    row: (r, i, { x, y, w: rw, sel }) => {
      if (sel) S.text(x, y, ">", 255, 230, 140);
      const color = sel ? [255, 255, 255] : [200, 200, 200];
      if (r.kind === "socket") {
        S.text(x + 2, y, `${partLabel(r.part)} socket`.padEnd(18), 130, 130, 130);
        if (r.implant) { S.put(x + 21, y, "♦", 120, 210, 235); S.text(x + 23, y, `${itemName(game, r.implant)} (grade ${IMPLANTS[r.implant.id]?.grade ?? "?"}): Enter takes it out`.slice(0, rw - 24), ...color); }
        else S.text(x + 23, y, "empty", 100, 110, 120);
      } else if (r.kind === "pack") {
        const [g, c] = itemGlyph(game, r.item);
        S.text(x + 2, y, "In your pack".padEnd(18), 130, 130, 130);
        S.put(x + 21, y, g, ...c);
        const fee = fittingFee(r.item), ok = withTruing(game, data.at || { at: "cradle" }, () => r.sockets.some((id) => canInstall(game, p, r.item, id).ok));
        S.text(x + 23, y, `${itemName(game, r.item)} (grade ${IMPLANTS[r.item.id].grade}, ${formatPrice(fee)}): ${ok ? "Enter fits it" : "won't go in now"}`.slice(0, rw - 24),
          ...(ok ? color : [140, 140, 140]));
      } else S.text(x + 2, y, `Raise your grade to ${gradeOf(p) + 1} (${gradeCost(p)} true-mark${gradeCost(p) > 1 ? "s" : ""}; you have ${trueMarks(p)})`.slice(0, rw - 2), ...color);
    },
  });
  const sel = rows[state.sel], infoY = y0 + 3 + listH;
  line(infoY);
  let info = "";
  if (sel?.kind === "socket") info = sel.implant ? itemInfo(game, sel.implant) : `Nothing in your ${partLabel(sel.part).toLowerCase()} socket.`;
  else if (sel?.kind === "pack") info = itemInfo(game, sel.item);
  else if (!isPlumb(p)) info = "The Cradle's straps are cut for the Plumb.";
  else info = `True-marks come from the bottom of Hour sites, the Plan's floor plans and the vow of the level. ${gradeFree(p)} grade free.`;
  wrap(info, w - 4).slice(0, 2).forEach((l, k) => S.text(x0 + 2, infoY + 1 + k, l, 190, 190, 200));
  const help = { x: x0 + 2, y: y0 + h - 2, text: "Enter fit or take out · G raise your grade · Esc leave the Cradle" };
  S.text(help.x, help.y, help.text.slice(0, w - 4), 120, 120, 130);
  hitLabel(help, "Esc leave the Cradle", { key: "Escape" });
  hitLabel(help, "G raise your grade", { key: "KeyG" });
}

function truingKey(game, code) {
  const data = modeData(game) || {}, state = (data.list ||= { sel: 0, top: 0 }), rows = truingRows(game);
  if (code === "Escape" || code === "KeyI") { popMode(game); return true; }
  if (code === "KeyG") { truingAct(game, rows[rows.length - 1]); return true; }
  const r = listKey(state, code, rows.length);
  if (r === "select") truingAct(game, rows[state.sel]);
  state.sel = Math.max(0, Math.min(state.sel, truingRows(game).length - 1));
  return r !== null;
}

registerScreen("truing", {
  draw: drawTruing,
  key: truingKey,
  mouse(game, button, cell) {
    if (button !== 0) return;
    const h = at(cell);
    if (h?.key) { truingKey(game, h.key); return; }
    const data = modeData(game) || {}, state = (data.list ||= { sel: 0, top: 0 });
    const i = listAt(state, cell);
    if (i < 0) return;
    if (i === state.sel) truingAct(game, truingRows(game)[i]);
    else state.sel = i;
  },
  wheel(game, sign) { const data = modeData(game) || {}; listWheel((data.list ||= { sel: 0, top: 0 }), sign, truingRows(game).length); },
});
