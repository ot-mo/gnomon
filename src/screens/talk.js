// Conversations and the merchant's pack (TECH_DESIGN §4.2 `talk` and `trade`; WS6b owns them from Phase 1).
// The drawing and the logic are dialogue.js's: openTalk pushes "talk", an answer that opens the pack pushes
// "shop" over it, and Esc in the pack pops back to talking.
import { registerScreen } from "../screens.js";
import { at } from "../ui.js";
import { talkKey, talkClick, talkHover, drawTalk, updateTalk, shopKey, shopClick, drawShop } from "../dialogue.js";

registerScreen("talk", {
  draw(game) { if (game.mode === "talk") drawTalk(game); },   // under the pack, the pack is all you see
  update: updateTalk,   // the words type out, letter by spoken letter
  key(game, code, repeat) {   // every key: any key shows the rest of what is being said (M and N too)
    if (!repeat) talkKey(game, code);
    return true;
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    const h = at(cell);
    if (h?.key) talkKey(game, h.key); else talkClick(game, cell);
  },
  hover: talkHover,
});

registerScreen("shop", {
  draw: drawShop,
  key(game, code) { shopKey(game, code); return true; },
  mouse(game, button, cell) { if (button === 0) shopClick(game, at(cell)); },
});
