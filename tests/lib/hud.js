// The HUD's status line as the player sees it: drawHud into the screen grid, then read that row back.
//
//   hudRow(game, capture) → { text, find(str) → [{ at, color }] }   (capture: node-env's last presented frame)
//
// The row is 1 on the map and 0 in 3D, as hud.js draws it.
import * as S from "../../src/screen.js";
import { drawHud } from "../../src/hud.js";

export function hudRow(game, capture) {
  S.clear();
  drawHud(game);
  S.present();
  const y = game.view === "map" ? 1 : 0, w = capture.cols;
  const text = capture.chars.slice(y * w, (y + 1) * w).join("");
  const colorAt = (x) => [...capture.colors.slice((y * w + x) * 3, (y * w + x) * 3 + 3)];
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
  return { text, find };
}
