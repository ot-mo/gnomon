// The 3D view paused (TECH_DESIGN §4.1, §4.2 `pause`): pointer lock lost in explore (Esc under pointer lock
// never reaches keydown, so the browser's lock change opens it: game.js onLockChange), and after story
// pages that end in 3D. It shows the parent's "Click to play" card; a click (or the lock coming back)
// closes it and locks the pointer. I, J and Tab still work from it, as they did from the paused view;
// so does a click on their words. Esc on the card (the pointer is free by then, so it reaches keydown) opens
// the options (screens/options.js: settings, the keys, save and quit), and a beat after the card shows
// (HINT_AFTER) a line under it says so: the card itself stays the parent's.
import * as S from "../screen.js";
import { registerScreen, popMode } from "../screens.js";
import { dispatchKey } from "../keys.js";
import { at, hit } from "../ui.js";
import { drawPause } from "../hud.js";
import { openOptions } from "./options.js";

const THROUGH = new Set(["Tab", "KeyI", "KeyJ"]);
export const HINT_AFTER = 0.75;   // real seconds
const HINT = "Esc: options · save and quit";
let since = 0;

// Close the card without touching the pointer, so the explore binding for `code` decides where it goes.
function through(game, code) {
  popMode(game, undefined, { pointer: false });
  return dispatchKey(game, code, false, "");
}

function draw(game) {
  const card = drawPause(game);
  if ((game.uiTime || 0) - since < HINT_AFTER || !card) return;
  const y = card.y0 + card.h, x = (S.cols - HINT.length) >> 1;
  if (y >= S.rows) return;
  S.blank(x - 1, y, HINT.length + 2, 1);
  S.text(x, y, HINT, 170, 170, 170);
  hit({ x, y, w: HINT.length, h: 1 }, { key: "Escape" });
}

registerScreen("pause", {
  draw,
  enter(game) { game.paused = true; since = game.uiTime || 0; },
  leave(game) { game.paused = false; },
  key(game, code, repeat) {
    if (code === "Escape") { if (!repeat) openOptions(game, { from: "pause" }); return true; }
    if (repeat || !THROUGH.has(code)) return false;
    popMode(game, undefined, { pointer: false });
    return false;   // the explore bindings (now on top) take it
  },
  mouse(game, button, cell) {
    const h = at(cell);
    if (h?.key === "Escape" && button === 0) { openOptions(game, { from: "pause" }); return; }
    if (h?.key && button === 0) { through(game, h.key); return; }
    popMode(game);   // back to exploring: the pointer locks (inside a click: allowed)
  },
  wheel(game, sign) { game.fov = Math.max(40, Math.min(100, game.fov + sign * 5)); },
});
