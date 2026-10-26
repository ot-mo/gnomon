// Saves (TECH_DESIGN §7, §1.4 "save (WS9)"): the P0 skeleton WS9 builds on. Importing it registers the
// write-behind (zone:leave), the waiting saves (a per-frame update) and zones.js's ZONE_LOADER seam.
//
//   saveGame(game, { reason }) → Promise · loadGame(slotId) → Promise<game> · listSlots() · deleteSlot(id) ·
//   checkpoint(game)                                       save.js (frozen signatures, §1.4)
//   memoryAdapter() · idbAdapter(name) · useStore(adapter) · currentStore()        store.js
//   registerZoneField(name, { encode, decode }) · registerCreatureField(name)      codec.js
export { saveGame, loadGame, listSlots, deleteSlot, checkpoint, canSave, whenWritten, saveStatus, SAVE_STATS } from "./save.js";
export { memoryAdapter, idbAdapter, useStore, currentStore, STORES } from "./store.js";
export { registerZoneField, registerCreatureField, CODEC, DEFLATE_AVAILABLE, canonicalJson, jsonProblems } from "./codec.js";
