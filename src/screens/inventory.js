// The inventory over either view (TECH_DESIGN §4.2 `inventory`; WS5 owns it from Phase 1). The drawing and
// the actions are inventory.js's; this is the screen: keys, the mouse, and what an action costs.
//
//   openInv(game)                 I (or a click on "I: inventory"): open it over the view you are in
//   inventoryAction(game, cost)   after a key or click: inventoryKey/inventoryClick say what happened (0:
//                                 nothing, null: close, "throw", or the game time it took); close the screen,
//                                 then on the map spend that time (in 3D the world just carries on)
import { registerScreen } from "../screens.js";
import { at } from "../ui.js";
import { openInventory, closeInventory, inventoryKey, inventoryClick, drawInventory, INVENTORY_KEYS } from "../inventory.js";
import { mapUseTime } from "../turns.js";
import { throwReady, throwAtNearest, THROW_TIME } from "../throwing.js";
import { hasStatus, statusLeft } from "../status.js";

export function openInv(game) {
  game.travel = null;
  openInventory(game);   // (pushing it unlocks the pointer)
}

export function inventoryAction(game, cost) {
  if (cost === 0) return;              // just moved the selection, or nothing happened
  closeInventory(game);                // (a potion of descent may have moved you already)
  if (cost === null) return;           // closed with I / Esc
  if (cost === "throw") {              // T on a potion or knife: throw it (and make it the ready item)
    const stack = game.throwStack;
    game.throwStack = null;
    if (game.mode === "map") { if (throwAtNearest(game, stack)) mapUseTime(game, THROW_TIME); }
    else if (game.mode === "explore") { game.player.throwCd = 0; throwReady(game, stack); }
    return;
  }
  if (game.mode === "map") {
    mapUseTime(game, cost);
    if (hasStatus(game.player, "paralyzed") && game.mode === "map") mapUseTime(game, statusLeft(game.player, "paralyzed"));   // frozen: the world moves on
  }
}

registerScreen("inventory", {
  draw: drawInventory,
  key(game, code) {
    if (!INVENTORY_KEYS.has(code)) return false;
    inventoryAction(game, inventoryKey(game, code));
    return true;
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    const h = at(cell);
    inventoryAction(game, h?.key ? inventoryKey(game, h.key) : inventoryClick(game, cell));
  },
});
