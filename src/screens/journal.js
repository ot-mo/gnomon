// The journal (J; TECH_DESIGN §4.2 `journal`, WS7 owns it from Phase 1): your quests. J, Esc or a click closes it.
import { registerScreen } from "../screens.js";
import { openJournal, journalKey, drawJournal } from "../dialogue.js";

export { openJournal };

registerScreen("journal", {
  draw: drawJournal,
  key(game, code, repeat) {
    if (repeat || (code !== "KeyJ" && code !== "Escape")) return false;
    journalKey(game, code);
    return true;
  },
  mouse(game) { journalKey(game, "Escape"); },
});
