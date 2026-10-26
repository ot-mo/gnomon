// The widget library every screen draws with (TECH_DESIGN §4.4). Everything draws into screen.js's grid
// and works at 100×30 cells.
//
//   UI                                    the palette: { edge, title, text, dim, sel, mark, help, empty, info, ... }
//   modal(w, h) → { x0, y0, w, h }        centred, clamped to the screen
//   box(x, y, w, h, { title, edge, fill = true, rules = false })
//                                         a full border ("+", "-", "|"); rules: only the top and bottom rules
//                                         (the parent's look, dialogue.js); title: written into the top edge
//   wrap(text, width) → lines             words onto lines of at most `width` ("\n" breaks a paragraph)
//   list(state, { x, y, w, h, items, row, empty })
//                                         a scrolling list; state: { sel, top }; row(item, i, { x, y, w, sel })
//                                         draws one row (default: the item as text, "> " before the selected one)
//   listKey(state, code, n) → "move" | "select" | null      ↑↓ / W S, PgUp/PgDn, Home/End; Enter / E / Space
//   listWheel(state, sign, n) → "move" | null               the wheel moves the selection
//   listAt(state, cell) → index | -1                        which row of the list is under the pointer
//   tabs(x, y, labels, sel) → width        "[ A ]   b   c"; tabsKey(code, sel, n) → new sel | null (Tab, ← →)
//   bar(x, y, w, frac, rgb, label)         "label [#####.....]" in w cells
//   textInput(state, code, key) → "done" | "cancel" | null
//                                         state: { text, cursor, max }; inserts `key` when it is one printable
//                                         character (so capitals, "m" and "Ö" all type); Backspace, Delete,
//                                         ← →, Home, End edit; Enter is done, Esc cancels
//   drawTextInput(x, y, w, state, { color, focused = true })
//   keyHelp(x, y, w, entries) → rows       a footer from helpFor(mode): "Esc back · Enter select", wrapped
//   beginFrame(); hit(rect, payload); at(cell) → payload | null
//                                         what was drawn where, for the mouse (the last rect drawn wins)
import * as S from "./screen.js";
import { keyLabel } from "./keys.js";

export const UI = {
  edge: [140, 115, 50], title: [255, 230, 120], text: [200, 200, 200], dim: [175, 175, 185],
  sel: [255, 255, 255], mark: [255, 230, 140], help: [110, 110, 120], empty: [130, 130, 130],
  info: [180, 180, 190], bad: [200, 90, 80], cursor: [255, 230, 140],
};

// --- Hit-testing ---------------------------------------------------------------------------------
let hits = [];
export function beginFrame() { hits = []; }
export function hit(rect, payload) { hits.push({ ...rect, payload }); }
export function at(cell) {
  if (!cell) return null;
  for (let k = hits.length - 1; k >= 0; k--) {
    const r = hits[k];
    if (cell.x >= r.x && cell.y >= r.y && cell.x < r.x + r.w && cell.y < r.y + r.h) return r.payload;
  }
  return null;
}

// --- Layout --------------------------------------------------------------------------------------
export function modal(w, h) {
  w = Math.max(1, Math.min(w, S.cols)); h = Math.max(1, Math.min(h, S.rows));
  return { x0: (S.cols - w) >> 1, y0: Math.max(0, (S.rows - h) >> 1), w, h };
}

export function box(x, y, w, h, { title, edge = UI.edge, fill = true, rules = false } = {}) {
  if (fill) S.blank(x, y, w, h);
  for (let i = x; i < x + w; i++) { S.put(i, y, "-", ...edge); S.put(i, y + h - 1, "-", ...edge); }
  if (!rules) {
    for (let j = y + 1; j < y + h - 1; j++) { S.put(x, j, "|", ...edge); S.put(x + w - 1, j, "|", ...edge); }
    for (const [i, j] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) S.put(i, j, "+", ...edge);
  }
  if (title) S.text(x + 2, y, ` ${title} `.slice(0, Math.max(0, w - 4)), ...UI.title);
}

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

// --- Lists ---------------------------------------------------------------------------------------
const clampSel = (state, n) => { state.sel = n ? Math.max(0, Math.min(n - 1, state.sel | 0)) : 0; };

function defaultRow(item, i, { x, y, w, sel }) {
  if (sel) S.text(x, y, ">", ...UI.mark);
  S.text(x + 2, y, String(item).slice(0, Math.max(0, w - 2)), ...(sel ? UI.sel : UI.text));
}

export function list(state, { x, y, w, h, items, row = defaultRow, empty = "" }) {
  const n = items.length;
  clampSel(state, n);
  state.page = h;
  if (!n) { if (empty) S.text(x + 2, y, empty.slice(0, Math.max(0, w - 2)), ...UI.empty); state.top = 0; return; }
  // Keep the selection in view.
  let top = Math.max(0, Math.min(state.top | 0, n - h));
  if (state.sel < top) top = state.sel;
  if (state.sel >= top + h) top = state.sel - h + 1;
  state.top = top;
  state.rect = { x, y, w, h };
  for (let k = 0; k < h && top + k < n; k++) {
    const i = top + k;
    row(items[i], i, { x, y: y + k, w, sel: i === state.sel });
    hit({ x, y: y + k, w, h: 1 }, { list: state, index: i });
  }
  if (top > 0) S.put(x + w - 1, y, "^", ...UI.help);
  if (top + h < n) S.put(x + w - 1, y + h - 1, "v", ...UI.help);
}

export function listKey(state, code, n) {
  if (!n) return null;
  const page = Math.max(1, state.page || 1), old = state.sel | 0;
  if (code === "ArrowUp" || code === "KeyW" || code === "Numpad8") state.sel = (old + n - 1) % n;
  else if (code === "ArrowDown" || code === "KeyS" || code === "Numpad2") state.sel = (old + 1) % n;
  else if (code === "PageUp") state.sel = Math.max(0, old - page);
  else if (code === "PageDown") state.sel = Math.min(n - 1, old + page);
  else if (code === "Home") state.sel = 0;
  else if (code === "End") state.sel = n - 1;
  else if (code === "Enter" || code === "NumpadEnter" || code === "KeyE" || code === "Space") return "select";
  else return null;
  return "move";
}

export function listWheel(state, sign, n) {
  if (!n || !sign) return null;
  state.sel = Math.max(0, Math.min(n - 1, (state.sel | 0) + Math.sign(sign)));
  return "move";
}

export function listAt(state, cell) {
  const p = at(cell);
  return p && p.list === state ? p.index : -1;
}

// --- Tabs and bars ---------------------------------------------------------------------------------
export function tabs(x, y, labels, sel) {
  let cx = x;
  labels.forEach((label, k) => {
    const s = k === sel ? `[ ${label.toUpperCase()} ]` : `  ${label}  `;
    S.text(cx, y, s, ...(k === sel ? UI.title : UI.dim));
    hit({ x: cx, y, w: s.length, h: 1 }, { tab: k });
    cx += s.length + 1;
  });
  return Math.max(0, cx - x - 1);
}

export function tabsKey(code, sel, n) {
  if (n < 2) return null;
  if (code === "Tab" || code === "ArrowRight") return (sel + 1) % n;
  if (code === "ArrowLeft") return (sel + n - 1) % n;
  return null;
}

export function bar(x, y, w, frac, rgb, label = "") {
  const head = label ? label + " " : "";
  const n = Math.max(0, w - head.length - 2);
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  const filled = Math.round(f * n);
  S.text(x, y, head, ...rgb);
  S.text(x + head.length, y, `[${"#".repeat(filled)}${".".repeat(n - filled)}]`, ...rgb);
}

// --- Text input ------------------------------------------------------------------------------------
// One printable character: a single code point that is not a control or format character ("Shift",
// "Dead", "Enter" and "\t" are not).
const printable = (key) => typeof key === "string" && [...key].length === 1 && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(key);

export function textInput(state, code, key) {
  state.text ??= "";
  const chars = [...state.text];
  let cur = Math.max(0, Math.min(chars.length, state.cursor ?? chars.length));
  if (code === "Enter" || code === "NumpadEnter") return "done";
  if (code === "Escape") return "cancel";
  if (code === "Backspace") { if (cur > 0) { chars.splice(cur - 1, 1); cur--; } }
  else if (code === "Delete") chars.splice(cur, 1);
  else if (code === "ArrowLeft") cur = Math.max(0, cur - 1);
  else if (code === "ArrowRight") cur = Math.min(chars.length, cur + 1);
  else if (code === "Home") cur = 0;
  else if (code === "End") cur = chars.length;
  else if (printable(key) && chars.length < (state.max ?? 24)) { chars.splice(cur, 0, key); cur++; }
  state.text = chars.join("");
  state.cursor = cur;
  return null;
}

export function drawTextInput(x, y, w, state, { color = UI.sel, focused = true } = {}) {
  const chars = [...(state.text ?? "")], cur = Math.min(chars.length, state.cursor ?? chars.length);
  const start = Math.max(0, cur - w + 1);   // keep the cursor in view
  for (let k = 0; k < w; k++) {
    const ch = chars[start + k];
    S.put(x + k, y, ch ?? (focused && start + k === cur ? "_" : "."), ...(ch ? color : UI.help));
  }
  if (focused && cur < chars.length) S.put(x + cur - start, y, chars[cur], ...UI.cursor);
  hit({ x, y, w, h: 1 }, { input: state });
}

// --- Key help ----------------------------------------------------------------------------------------
export function keyHelp(x, y, w, entries) {
  const parts = [], seen = new Map();
  for (const { code, help } of entries) {   // keys with the same help share it: "↑/↓ move"
    if (seen.has(help)) { const p = parts[seen.get(help)]; if (!p.keys.includes(keyLabel(code))) p.keys.push(keyLabel(code)); continue; }
    seen.set(help, parts.length);
    parts.push({ keys: [keyLabel(code)], help });
  }
  const lines = [];
  for (const p of parts) {
    const s = `${p.keys.join("/")} ${p.help}`, last = lines.length - 1;
    if (last >= 0 && (lines[last] + " · " + s).length <= w) lines[last] += " · " + s;
    else lines.push(s);
  }
  lines.forEach((l, k) => S.text(x, y + k, l.slice(0, w), ...UI.help));
  return lines.length;
}
