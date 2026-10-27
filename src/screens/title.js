// The title screen (TECH_DESIGN §4.2 `title`, §7.3): what the page opens on, unless ?quick=1 (config.js FLAGS.quick)
// boots straight into a new quick game, as the browser tools do.
//   New quick game   a new run on the seed below (random when empty) in the mode below: the test world and the parent
//                    game's campaign (WS4's character creation, once it registers "create", comes in front of it)
//   Continue         the newest slot (save.js listSlots, loadGame); shown only when there is one
//   Load a save      every slot, newest first: Enter loads, X exports it to a file, Delete (twice) deletes it
//   Mode             One Wick, Commons Lamp or Pilgrim (save.js RUN_MODES), for the next new game; ← → change it
//   Seed             Enter types one (digits; empty: random)
//   Import a save    a file exported here (a browser's file picker)
//   Options          the options screen (screens/options.js)
// Warnings under the menu (§4.2): saves that last only while the page is open (no IndexedDB), storage under
// 10 MB, the newest save made by an older generator (new ground may not meet old), and a One Wick life whose last
// session ended without a save. ?debug=1 adds slot ids and the storage numbers.
// Keys: ↑ ↓ (W S) choose, Enter (E, Space) start, ← → change a setting, 1-7 pick a line, Esc back; the mouse:
// click a line, the wheel chooses. M and N (music, sounds) still work here, but not while a seed is typed.
//
//   openTitle(game) → Promise<slots>   the title as the whole stack (main.js at boot; options' save and quit);
//                                      opens the save store (save/store.js openSaves) and moves a run kept in memory into
//                                      IndexedDB once that opens
//   titleItems() → [{ id: "new" | "continue" | "load" | "mode" | "seed" | "import" | "options", label, slot? }]
//   newGame(game, { seed, mode }) → the run started (startRun, then state.mode: game.js takes no mode yet)
//   titleState() → { view, mode, seed, slots, warnings, busy, error }   for checks
//   importText(game, text) → Promise<id>   an exported file's text into the store (the picker's other half)
import * as S from "../screen.js";
import { registerScreen, setMode, pushMode, screenFor } from "../screens.js";
import { UI, list, listKey, listWheel, listAt, keyHelp, textInput, drawTextInput, at } from "../ui.js";
import { FLAGS, TITLE, VERSION } from "../config.js";
import { startRun, randomSeed } from "../game.js";
import { listSlots, loadGame, deleteSlot, exportSlot, importSlot, RUN_MODES, SESSION, openSaves, storageLeft, moveSlot, currentStore, slotsOpenElsewhere } from "../save/index.js";
import { minutesAt } from "../clock.js";
import { loadSettings } from "./options.js";

const modes = () => Object.keys(RUN_MODES);   // (not at load: save/index.js may still be loading)
const LOW_STORAGE = 10 * 1024 * 1024;   // §7.3: below this the title warns
const menu = { sel: 0, top: 0, slots: [], busy: "", error: "", view: "main", mode: "oneWick", seed: { text: "", max: 9 }, editing: false,
               load: { sel: 0, top: 0 }, armed: null, persistent: true, reason: "", left: null, told: new Set(), open: new Set() };

export const titleState = () => ({ view: menu.view, mode: menu.mode, seed: menu.seed.text, slots: menu.slots, warnings: warnings(), busy: menu.busy, error: menu.error });

const seedOf = () => (/^\d+$/.test(menu.seed.text) && Number(menu.seed.text) > 0 ? Number(menu.seed.text) : null);
const who = (s) => (typeof s?.character?.name === "string" && s.character.name.trim() ? s.character.name : "the quick game");
const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function titleItems() {
  const items = [{ id: "new", label: screenFor("create") ? "New game" : "New quick game" }];
  const s = menu.slots[0];
  if (s) items.push({ id: "continue", label: `Continue (level ${s.character?.level ?? 1}, seed ${s.seed})`, slot: s });
  if (menu.slots.length) items.push({ id: "load", label: `Load a save (${menu.slots.length})` });
  items.push({ id: "mode", label: `Mode: ${RUN_MODES[menu.mode].name}` });
  items.push({ id: "seed", label: `Seed: ${menu.editing ? "" : menu.seed.text || "random"}` });
  if (typeof document !== "undefined") items.push({ id: "import", label: "Import a save" });
  items.push({ id: "options", label: "Options" });
  return items;
}

function warnings() {
  const out = [];
  if (!menu.persistent) out.push(`Saves last only while this page is open: ${menu.reason || "the browser keeps no IndexedDB here"}.`);
  if (menu.left !== null && menu.left < LOW_STORAGE) out.push(`Less than 10 MB of storage is left for saves (${(menu.left / 1048576).toFixed(1)} MB).`);
  const s = menu.slots[0];
  if (s && s.genVersion !== undefined && s.genVersion !== VERSION.gen) out.push("This save was made by an older version: where new ground meets old, the land may not line up.");
  // Open in another tab (it holds the slot's lock), or left by a session that never saved cleanly (live: a crash; or,
  // where the browser has no Web Locks, perhaps a tab still open).
  const name = s && who(s)[0].toUpperCase() + who(s).slice(1);
  if (s && menu.open.has(s.id)) out.push(`${name} is open in another tab: play it there, or save and quit there first.`);
  else {
    const other = s?.live && s.live !== SESSION, n = (s?.unclean || 0) + (other ? 1 : 0);
    const maybe = other && !globalThis.navigator?.locks ? ", or is still open in another tab" : "";
    if (n) out.push(`${name}'s last session ended without a save (${n === 1 ? "once" : `${n} times`})${maybe}.`);
  }
  return out;
}

async function refresh() {
  menu.slots = await listSlots().catch((e) => { menu.error = `The saves couldn't be read: ${e.message}`; return []; });
  menu.open = await slotsOpenElsewhere();
  return menu.slots;
}

export function openTitle(game) {
  menu.sel = 0; menu.busy = ""; menu.error = ""; menu.view = "main"; menu.editing = false; menu.armed = null;
  setMode(game, "title", null, { pointer: false });
  menu.slots = [];
  return openSaves().then(async ({ store, persistent, reason }) => {
    menu.persistent = persistent; menu.reason = reason;
    await loadSettings(game, store);
    // A game this page kept in memory (a ?quick=1 game, say) moves into IndexedDB with its whole slot.
    if (persistent && game.saving && game.saving.store !== store && game.saving.store.kind === "memory" && !game.saving.dead) await moveSlot(game, store).catch((e) => { menu.error = `The game in this page couldn't be kept: ${e.message}`; });
    storageLeft().then((n) => { menu.left = n; });
    return refresh();
  });
}

export function newGame(game, { seed = randomSeed(), mode = "oneWick" } = {}) {
  startRun(seed);
  game.state.mode = RUN_MODES[mode] ? mode : "oneWick";   // (before the run's first save, half a second on)
  return game;
}

// One load at a time, however it was asked for (Enter, a digit, a click; the main menu or the Load list).
function load(game, slot) {
  if (menu.loading) return;
  menu.loading = true;
  menu.busy = "Reading the save...";
  menu.error = "";
  loadGame(slot.id, { game }).then(() => { menu.busy = ""; menu.loading = false; }, (e) => {
    menu.busy = ""; menu.loading = false;
    menu.error = e.code === "unclean" || e.code === "open" ? e.message : `That save couldn't be loaded: ${e.message}`;
    if (game.mode !== "title") setMode(game, "title", null, { pointer: false });
    refresh();
  });
}

const fileName = (s) => `gnomon-${who(s).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}-seed${s.seed}-${new Date(s.updated).toISOString().slice(0, 10)}.json`;
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function exportOne(slot) {
  try {
    const file = await exportSlot(slot.id);
    if (typeof document !== "undefined") download(fileName(slot), JSON.stringify(file));
    menu.error = "";
    menu.busy = `Exported ${who(slot)} (seed ${slot.seed}).`;
    return file;
  } catch (e) { menu.error = `That save couldn't be exported: ${e.message}`; return null; }
}
export async function importText(game, text) {
  try {
    const id = await importSlot(text);
    await refresh();
    menu.busy = "The save is in. Continue or Load a save plays it.";
    menu.error = "";
    return id;
  } catch (e) { menu.error = `That file couldn't be imported: ${e.message}`; return null; }
}
function pickFile(game) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json";
  input.onchange = () => { const f = input.files?.[0]; if (f) f.text().then((t) => importText(game, t)); };
  input.click();   // (inside the key press or click that chose it)
}

function choose(game, item) {
  if (!item || menu.busy === "Reading the save...") return;
  menu.busy = "";
  if (item.id === "new") {
    if (screenFor("create")) { pushMode(game, "create", { seed: seedOf(), mode: menu.mode }, { pointer: false }); return; }
    newGame(game, { seed: seedOf() ?? FLAGS.seed ?? randomSeed(), mode: menu.mode });
  } else if (item.id === "continue") load(game, item.slot);
  else if (item.id === "load") { menu.view = "load"; menu.load.sel = 0; menu.armed = null; }
  else if (item.id === "mode") turn(1);
  else if (item.id === "seed") { menu.editing = true; menu.seed.cursor = menu.seed.text.length; }
  else if (item.id === "import") pickFile(game);
  else if (item.id === "options") pushMode(game, "options", { from: "title" }, { pointer: false });
}
const turn = (d) => { const m = modes(); menu.mode = m[(m.indexOf(menu.mode) + d + m.length) % m.length]; };

// --- Drawing ---------------------------------------------------------------------------------------------
function drawMain() {
  const items = titleItems(), warn = warnings();
  const top = Math.max(1, (S.rows >> 1) - 8);
  const w = Math.min(S.cols - 4, Math.max(...items.map((it) => it.label.length), 20) + 16), x = (S.cols - w) >> 1;
  list(menu, { x, y: top + 3, w, h: items.length, items, row: (it, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, it.label.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.text));
    if (it.id === "seed" && menu.editing) drawTextInput(r.x + 8, r.y, 10, menu.seed);
    if (it.id === "mode" && r.sel) S.text(r.x + 3 + it.label.length, r.y, "< >", ...UI.help);
  } });
  let y = top + 4 + items.length;
  const it = items[menu.sel];
  if (it?.id === "mode") S.text(x + 2, y, RUN_MODES[menu.mode].note.slice(0, w - 2), ...UI.info);
  y += 2;
  for (const line of warn) { S.text(Math.max(1, x - 8), y++, line.slice(0, S.cols - 2), ...UI.bad); }
  if (menu.busy) S.text((S.cols - menu.busy.length) >> 1, ++y, menu.busy.slice(0, S.cols - 2), ...UI.info);
  if (menu.error) S.text(2, ++y, menu.error.slice(0, S.cols - 4), ...UI.bad);
  if (FLAGS.debug) S.text(1, S.rows - 2, `slots ${menu.slots.map((s) => s.id).join(" ") || "none"} · ${currentStore()?.kind ?? "no store"}${menu.left !== null ? ` · ${(menu.left / 1048576).toFixed(0)} MB free` : ""}`.slice(0, S.cols - 2), ...UI.help);
  const help = menu.editing ? [{ code: "Enter", help: "set the seed" }, { code: "Escape", help: "cancel" }]
    : [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "Enter", help: "start" }, { code: "ArrowLeft", help: "change" },
       { code: "ArrowRight", help: "change" }, { code: "KeyM", help: "music" }, { code: "KeyN", help: "sounds" }];
  keyHelp(2, S.rows - 1, S.cols - 4, help);
}

function drawLoad() {
  const top = 2, w = Math.min(S.cols - 4, 96), x = (S.cols - w) >> 1;
  S.text(x, top, "Load a save", ...UI.title);
  const h = Math.max(1, Math.min(menu.slots.length, S.rows - top - 6));
  list(menu.load, { x, y: top + 2, w, h, items: menu.slots, empty: "Nothing is saved.", row: (s, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    const day = Math.floor(minutesAt(Number(s.time) || 0) / 1440) + 1;
    const text = `${who(s)} · level ${s.character?.level ?? 1} · ${RUN_MODES[s.mode]?.name ?? s.mode} · seed ${s.seed} · day ${day} · ${ago(s.updated)}` +
      `${s.unclean ? ` · ${s.unclean} unclean` : ""}${FLAGS.debug ? ` · ${s.id}` : ""}`;
    S.text(r.x + 2, r.y, text.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.text));
  } });
  const y = top + 3 + h;
  if (menu.armed) S.text(x, y, `Delete ${who(menu.armed)} (seed ${menu.armed.seed})? Delete again to do it; anything else keeps it.`.slice(0, w), ...UI.bad);
  if (menu.busy) S.text(x, y + 1, menu.busy.slice(0, w), ...UI.info);
  if (menu.error) S.text(x, y + 2, menu.error.slice(0, w), ...UI.bad);
  keyHelp(2, S.rows - 1, S.cols - 4, [{ code: "Enter", help: "load" }, { code: "KeyX", help: "export to a file" }, { code: "Delete", help: "delete" },
                                       { code: "Escape", help: "back" }]);
}

function drawTitle() {
  S.clear();
  const name = [...TITLE].join(" ");
  if (menu.view === "main") S.text((S.cols - name.length) >> 1, Math.max(1, (S.rows >> 1) - 8), name, ...UI.title);
  if (menu.view === "load") drawLoad(); else drawMain();
}

// --- Keys and the mouse ------------------------------------------------------------------------------------
function keyLoad(game, code, repeat) {
  const s = menu.slots[menu.load.sel];
  if (code === "Delete" || code === "Backspace") {
    if (repeat || !s) return true;
    if (menu.armed?.id === s.id) {
      menu.armed = null;
      deleteSlot(s.id).then(() => refresh()).then(() => { menu.busy = `Deleted ${who(s)}.`; if (!menu.slots.length) menu.view = "main"; });
    } else menu.armed = s;
    return true;
  }
  menu.armed = null;
  if (code === "Escape") { menu.view = "main"; return true; }
  if (code === "KeyX") { if (!repeat && s) exportOne(s); return true; }
  const r = listKey(menu.load, code, menu.slots.length);
  if (r === "select" && !repeat && s) load(game, s);
  return r !== null;
}

const DIGITS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad7: 6 };
registerScreen("title", {
  over: "none", pointer: "unlock",
  draw: drawTitle,
  key(game, code, repeat, key) {
    if (menu.view === "load") return keyLoad(game, code, repeat);
    if (menu.editing) {
      if (code === "Enter" || code === "NumpadEnter" || code === "Escape") { menu.editing = false; if (code === "Escape") menu.seed.text = ""; return true; }
      if (key && key.length === 1 && !/\d/.test(key)) return true;   // digits only (and no M or N while typing)
      textInput(menu.seed, code, key);
      return true;
    }
    const items = titleItems(), it = items[menu.sel];
    if (code in DIGITS) { if (!repeat && items[DIGITS[code]]) { menu.sel = DIGITS[code]; choose(game, items[menu.sel]); } return true; }
    if (it?.id === "mode" && (code === "ArrowLeft" || code === "ArrowRight" || code === "KeyA" || code === "KeyD")) { turn(code === "ArrowLeft" || code === "KeyA" ? -1 : 1); return true; }
    const r = listKey(menu, code, items.length);
    if (r === "select" && !repeat) choose(game, items[menu.sel]);
    return r !== null;
  },
  mouse(game, button, cell) {
    if (button !== 0) return;
    if (menu.view === "load") {
      const i = listAt(menu.load, cell);
      if (i >= 0 && menu.slots[i]) { if (menu.load.sel === i) load(game, menu.slots[i]); else menu.load.sel = i; }
      return;
    }
    if (at(cell)?.input) return;   // (a click in the seed field)
    const i = listAt(menu, cell), items = titleItems();
    if (i >= 0 && items[i]) { menu.sel = i; menu.editing = false; choose(game, items[i]); }
  },
  wheel(game, sign) { if (menu.view === "load") listWheel(menu.load, sign, menu.slots.length); else listWheel(menu, sign, titleItems().length); },
});
