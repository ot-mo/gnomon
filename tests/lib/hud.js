// The HUD's status line as the player sees it: drawHud into the screen grid, then read its rows back.
//
//   hudRow(game, capture) → { text, rows, find(str) → [{ at, color }] }   (capture: node-env's last presented frame)
//
// The line starts on row 1 on the map and row 0 in 3D, as hud.js draws it, and takes one row or two
// (hud.js layoutHud); `text` is the rows one after another (a match never spans two).
import * as S from "../../src/screen.js";
import { drawHud, hudRows } from "../../src/hud.js";

export function hudRow(game, capture) {
  S.clear();
  const rows = hudRows(game);
  drawHud(game);
  S.present();
  const y0 = game.view === "map" ? 1 : 0, w = capture.cols;
  const text = capture.chars.slice(y0 * w, (y0 + rows) * w).join("");
  const colorAt = (x) => [...capture.colors.slice((y0 * w + x) * 3, (y0 * w + x) * 3 + 3)];
  // Every place the string stands in the row, each with the colour of its cells (null if they differ).
  const find = (str) => {
    const out = [];
    for (let at = text.indexOf(str); at >= 0; at = text.indexOf(str, at + 1)) {
      const c = colorAt(at);
      const same = [...str].every((_, k) => colorAt(at + k).every((v, j) => v === c[j]));
      out.push({ at, color: same ? c : null });
    }
    return out;
  };
  return { text, rows, find };
}
