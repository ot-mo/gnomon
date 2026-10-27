// Saves (TECH_DESIGN §7, §1.4 "save (WS9)"). Importing it registers the write-behind (zone:leave), the automatic
// and waiting saves (per-frame updates), zones.js's ZONE_LOADER seam and, in a browser, the page's
// visibilitychange and pagehide (the unload save).
//
//   saveGame(game, { reason }) → Promise · loadGame(slotId) → Promise<game> · listSlots() · deleteSlot(id) ·
//   checkpoint(game)                                       save.js (frozen signatures, §1.4), and the rest of save.js
//   memoryAdapter() · idbAdapter(name) · useStore(adapter) · currentStore() · openSaves() · storageLeft()   store.js
//   registerZoneField(name, { encode, decode }) · registerCreatureField(name)      codec.js
import { listenPage } from "./save.js";

export { saveGame, loadGame, listSlots, deleteSlot, checkpoint, canSave, whenWritten, saveStatus, SAVE_STATS, SAVE_RULES, RUN_MODES, SESSION, SAVE_THROUGH,
         modeOf, endRun, wakeAtCheckpoint, restoreCheckpoint, unloadSave, pageShown, listenPage, exportSlot, importSlot, moveSlot, graveyard,
         migrate, MIGRATIONS, registerWorld, requestSave } from "./save.js";
export { memoryAdapter, idbAdapter, useStore, currentStore, openSaves, storageLeft, STORES } from "./store.js";
export { registerZoneField, registerCreatureField, CODEC, DEFLATE_AVAILABLE, canonicalJson, jsonProblems } from "./codec.js";

if (typeof document !== "undefined" && typeof window !== "undefined" && typeof document.addEventListener === "function") listenPage(document, window);
