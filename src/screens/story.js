// Full-screen story pages (TECH_DESIGN §4.2 `story`): the intro, the cube, the last floor, the ending.
// openStory (dialogue.js) pushes it; Space / Enter / E / Esc or a click turns the page; after the last
// page it pops and calls the story's `then`.
import { registerScreen } from "../screens.js";
import { storyKey, nextPage, drawStory } from "../dialogue.js";

const PAGE_KEYS = new Set(["Space", "Enter", "NumpadEnter", "KeyE", "Escape"]);

registerScreen("story", {
  over: "none",
  draw: drawStory,
  key(game, code, repeat) {
    if (!PAGE_KEYS.has(code)) return false;
    if (!repeat) storyKey(game, code);
    return true;
  },
  mouse(game, button) { if (button === 0) nextPage(game); },
});
