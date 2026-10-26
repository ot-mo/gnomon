// Gained a level (or someone taught you a trick): stop and choose a perk (TECH_DESIGN §4.2 `levelup`; WS4
// owns it from Phase 1). 1-4 or a click picks; the game waits.
//
//   checkLevelUp(game)      once a frame: in a view with a level (or a gift) pending, open the screen
//   choosePerk(game, k)     take choice k (0-based) and close it
import { registerScreen, pushMode, popMode } from "../screens.js";
import { offerPerks, takePerk } from "../leveling.js";
import { drawLevelUp, levelUpClick } from "../hud.js";

export function checkLevelUp(game) {
  const p = game.player;
  if ((game.mode !== "explore" && game.mode !== "map") || !(p.pendingLevels > 0 || p.bonusPerks > 0)) return;
  game.perkGift = !(p.pendingLevels > 0);
  if (p.pendingLevels > 0) p.pendingLevels--; else p.bonusPerks--;
  game.perkMilestone = !game.perkGift && p.level % 5 === 0 && !p.milestones?.has(p.level);
  if (game.perkMilestone) (p.milestones ||= new Set()).add(p.level);
  game.perkChoices = offerPerks(game.player, game.perkMilestone);
  if (game.perkChoices.length) {
    game.travel = null;
    pushMode(game, "levelup");
  }
}

export function choosePerk(game, k) {
  if (k < 0 || k >= game.perkChoices.length) return;
  takePerk(game, game.perkChoices[k]);
  if (game.mode === "levelup") popMode(game);
}

const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

registerScreen("levelup", {
  draw: drawLevelUp,
  key(game, code, repeat) {
    const k = DIGITS[code];
    if (k === undefined) return false;
    if (!repeat) choosePerk(game, k);
    return true;
  },
  mouse(game, button, cell) { if (button === 0) choosePerk(game, levelUpClick(game, cell)); },
});
