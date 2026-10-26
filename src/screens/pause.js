// The 3D view paused (TECH_DESIGN §4.1, §4.2 `pause`): pointer lock lost in explore (Esc under pointer lock
// never reaches keydown, so the browser's lock change opens it: game.js onLockChange), and after story
// pages that end in 3D. It shows the parent's "Click to play" card; a click (or the lock coming back)
// closes it and locks the pointer. I, J and Tab still work from it, as they did from the paused view;
// so does a click on their words. WS9 grows it into pause / options.
import { registerScreen, popMode } from "../screens.js";
import { dispatchKey } from "../keys.js";
import { at } from "../ui.js";
import { drawPause } from "../hud.js";

const THROUGH = new Set(["Tab", "KeyI", "KeyJ"]);

// Close the card without touching the pointer, so the explore binding for `code` decides where it goes.
function through(game, code) {
  popMode(game, undefined, { pointer: false });
  return dispatchKey(game, code, false, "");
}

registerScreen("pause", {
  draw: drawPause,
  enter(game) { game.paused = true; },
  leave(game) { game.paused = false; },
  key(game, code, repeat) {
    if (repeat || !THROUGH.has(code)) return false;
    popMode(game, undefined, { pointer: false });
    return false;   // the explore bindings (now on top) take it
  },
  mouse(game, button, cell) {
    const h = at(cell);
    if (h?.key && button === 0) { through(game, h.key); return; }
    popMode(game);   // back to exploring: the pointer locks (inside a click: allowed)
  },
  wheel(game, sign) { game.fov = Math.max(40, Math.min(100, game.fov + sign * 5)); },
});
