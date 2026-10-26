// The beat between zones (TECH_DESIGN §4.2 `transition`; the parent's "descend"): "DEPTH n", or the zone's
// name, on a black screen for 1.2 s after stairs, a hole or a potion of descent. Then back to the view
// game.view names (the map recentred), or to death if the fall killed you; and if the zone has pages of
// story waiting (game.pendingPages: the last floor), those first, with the 3D view paused under them. Back
// in 3D without the pointer lock (lost during the beat), the pause card.
//
//   startTransition(game)   the zone has already changed (changeZone); this shows the beat
import { registerScreen, setMode, pushMode } from "../screens.js";
import { refreshView } from "../turns.js";
import { openStory } from "../dialogue.js";
import { drawTransition } from "../hud.js";
import { canLockPointer, isLocked } from "../input.js";

export const TRANSITION_TIME = 1.2;

export function startTransition(game) {
  game.descendT = TRANSITION_TIME;
  // Whatever was open (the inventory, for a potion of descent) is gone; the pointer stays as it was.
  setMode(game, game.view === "map" ? "map" : "explore", null, { pointer: false });
  pushMode(game, "transition", null, { pointer: false });
}

function finish(game) {
  if (game.player.hp <= 0) { setMode(game, "dead"); return; }
  const back = game.view === "map" ? "map" : "explore";
  setMode(game, back, null, { pointer: false });
  if (back === "map") refreshView(game);
  // The pointer lock lost during the beat (its onLockChange found no explore to pause): pause now, or 3D
  // would run with no mouse look and no card.
  const unlocked = back === "explore" && canLockPointer() && !isLocked();
  if (game.pendingPages) {   // something to say about this floor first
    if (back === "explore") pushMode(game, "pause", null, { pointer: false });
    openStory(game, game.pendingPages, () => {});
    game.pendingPages = null;
  } else if (unlocked) pushMode(game, "pause", null, { pointer: false });
}

registerScreen("transition", {
  over: "none", pointer: "keep",
  draw: drawTransition,
  update(game, dt) {
    game.descendT -= dt;
    if (game.descendT <= 0) finish(game);
  },
  key: () => false,
});
