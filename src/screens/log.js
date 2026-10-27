// The message log (TECH_DESIGN §4.2 `log`, §4.3 H): this run's message history, the last LOG_LINES of it, newest at
// the bottom, with the time of day each was said. H opens it in both views and closes it (so does Esc); ↑ ↓,
// PgUp PgDn, Home End and the wheel scroll. The game is paused under it.
// game.js keeps only the last 40 messages (game.messages: the HUD shows 5), so the history is collected from them
// every frame (a registered update in every mode): a message pushed and shifted out within one frame, more than 40
// at once, would be missed. It is runtime only, like game.messages (a load starts it afresh).
//
//   openLog(game) · MODE = "log" · LOG_LINES = 500
//   logHistory(game) → [{ text, color, time }]   (oldest first)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode } from "../screens.js";
import { UI, modal, box, keyHelp, wrap } from "../ui.js";
import { bind } from "../keys.js";
import { registerUpdate } from "../events.js";
import { minutesAt } from "../clock.js";

export const MODE = "log";
export const LOG_LINES = 500;
const hist = { run: null, lines: [], last: null, scroll: 0 };

function collect(game) {
  if (hist.run !== game.run) { hist.run = game.run; hist.lines = []; hist.last = null; }
  const msgs = game.messages || [];
  let k = hist.last ? msgs.lastIndexOf(hist.last) + 1 : 0;   // (not there any more: all 40 are new)
  for (; k < msgs.length; k++) hist.lines.push(msgs[k]);
  if (msgs.length) hist.last = msgs[msgs.length - 1];
  if (hist.lines.length > LOG_LINES) hist.lines.splice(0, hist.lines.length - LOG_LINES);
}
registerUpdate("log:history", (game) => collect(game), { modes: ["*"] });

export function logHistory(game) { collect(game); return hist.lines; }

export function openLog(game) {
  collect(game);
  hist.scroll = 0;
  pushMode(game, MODE);
}
bind("play", "KeyH", (game) => openLog(game), { help: "message log" });

const stamp = (t) => {
  const m = Math.floor(minutesAt(t || 0)), mod = ((m % 1440) + 1440) % 1440;
  return `day ${Math.floor(m / 1440) + 1} ${String(Math.floor(mod / 60)).padStart(2, "0")}:${String(mod % 60).padStart(2, "0")}`;
};

function rowsOf(width) {
  const rows = [];
  for (const m of hist.lines) {
    const head = stamp(m.time);
    wrap(m.text, width - head.length - 2).forEach((t, k) => rows.push({ head: k ? "" : head, text: t, color: m.color, w: head.length }));
  }
  return rows;
}

function drawLog() {
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 110), S.rows - 2);
  box(x0, y0, w, h, { title: `Messages (${hist.lines.length})` });
  const rows = rowsOf(w - 6), view = h - 4;
  hist.scroll = Math.max(0, Math.min(hist.scroll, rows.length - view));
  const first = Math.max(0, rows.length - view - hist.scroll);
  rows.slice(first, first + view).forEach((r, k) => {
    S.text(x0 + 2, y0 + 1 + k, r.head, ...UI.help);
    S.text(x0 + 4 + r.w, y0 + 1 + k, r.text, ...r.color);
  });
  if (!rows.length) S.text(x0 + 2, y0 + 1, "Nothing has been said yet.", ...UI.empty);
  if (first > 0) S.put(x0 + w - 2, y0 + 1, "^", ...UI.help);
  if (hist.scroll > 0) S.put(x0 + w - 2, y0 + view, "v", ...UI.help);
  keyHelp(x0 + 2, y0 + h - 2, w - 4, [{ code: "ArrowUp", help: "scroll" }, { code: "ArrowDown", help: "scroll" }, { code: "PageUp", help: "a page" },
                                       { code: "PageDown", help: "a page" }, { code: "KeyH", help: "close" }, { code: "Escape", help: "close" }]);
}

const page = () => Math.max(1, S.rows - 7);
registerScreen(MODE, {
  draw: drawLog,
  key(game, code, repeat) {
    if (code === "KeyH" || code === "Escape") { if (!repeat) popMode(game); return true; }
    if (code === "ArrowUp" || code === "KeyW") hist.scroll++;
    else if (code === "ArrowDown" || code === "KeyS") hist.scroll = Math.max(0, hist.scroll - 1);
    else if (code === "PageUp") hist.scroll += page();
    else if (code === "PageDown") hist.scroll = Math.max(0, hist.scroll - page());
    else if (code === "Home") hist.scroll = Infinity;
    else if (code === "End") hist.scroll = 0;
    else return code !== "KeyM" && code !== "KeyN";   // (M and N still work)
    return true;
  },
  mouse(game, button) { if (button === 0) popMode(game); },
  wheel(game, sign) { hist.scroll = Math.max(0, hist.scroll - Math.sign(sign) * 3); },
});
