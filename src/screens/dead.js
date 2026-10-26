// Death and victory (TECH_DESIGN §4.2 `dead`; WS9 adds the recap): the view as it was, the card over it.
// R (or a click on "Press R…") starts a new run (game.newRun).
import { registerScreen } from "../screens.js";
import { at } from "../ui.js";
import { drawDead, drawWon } from "../hud.js";
import { drawPlay } from "./play.js";

for (const [mode, card] of [["dead", drawDead], ["won", drawWon]]) {
  registerScreen(mode, {
    over: "none",
    draw(game) { drawPlay(game); card(game); },
    key(game, code, repeat) {
      if (code !== "KeyR") return false;
      if (!repeat) game.newRun();
      return true;
    },
    mouse(game, button, cell) { if (button === 0 && at(cell)?.key === "KeyR") game.newRun(); },
  });
}
