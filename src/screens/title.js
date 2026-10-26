// The title screen (TECH_DESIGN §4.2 `title`; P0 stub → WS9): what the page opens on, unless ?quick=1
// (config.js FLAGS.quick) boots straight into a new quick game, as the browser tools do.
//   New quick game   a new run (on ?seed=N, else a random seed): the test world and the parent game's campaign
//   Continue         the newest slot in the store (save.js listSlots, loadGame); shown only when there is one
// Keys: ↑ ↓ (W S) choose, Enter (E, Space) start, 1 / 2 pick a line; the mouse: click a line, the wheel
// chooses. M and N (music, sounds) still work here. WS9 grows it into the real one: character creation (WS4's
// create screen), slots, options, export and import, the storage warning (§7.3).
//
//   openTitle(game)        the title as the whole stack (main.js at boot; checks)
//   titleItems() → [{ id: "new" | "continue", label, slot? }]   what it offers now
import * as S from "../screen.js";
import { registerScreen, setMode } from "../screens.js";
import { UI, list, listKey, listWheel, listAt, keyHelp } from "../ui.js";
import { FLAGS, TITLE } from "../config.js";
import { startRun, randomSeed } from "../game.js";
import { listSlots, loadGame } from "../save/index.js";

const menu = { sel: 0, top: 0, slots: [], busy: "", error: "" };

export function titleItems() {
  const items = [{ id: "new", label: "New quick game" }];
  const s = menu.slots[0];
  if (s) items.push({ id: "continue", label: `Continue (level ${s.character?.level ?? 1}, seed ${s.seed})`, slot: s });
  return items;
}

export function openTitle(game) {
  menu.sel = 0; menu.busy = ""; menu.error = "";
  setMode(game, "title", null, { pointer: false });
  menu.slots = [];
  return listSlots().then((slots) => { menu.slots = slots; return slots; }, (e) => { menu.error = `The saves couldn't be read: ${e.message}`; return []; });
}

function choose(game, item) {
  if (!item || menu.busy) return;
  if (item.id === "new") { startRun(FLAGS.seed ?? randomSeed()); return; }
  menu.busy = "Reading the save...";
  menu.error = "";
  loadGame(item.slot.id, { game }).then(() => { menu.busy = ""; }, (e) => {
    menu.busy = "";
    menu.error = `That save couldn't be loaded: ${e.message}`;
    if (game.mode !== "title") setMode(game, "title", null, { pointer: false });
  });
}

function drawTitle() {
  S.clear();
  const name = [...TITLE].join(" "), items = titleItems();
  const top = Math.max(1, (S.rows >> 1) - 5);
  S.text((S.cols - name.length) >> 1, top, name, ...UI.title);
  const w = Math.min(S.cols - 4, Math.max(...items.map((it) => it.label.length)) + 4), x = (S.cols - w) >> 1;
  list(menu, { x, y: top + 3, w, h: items.length, items, row: (it, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, it.label.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.text));
  } });
  if (menu.busy) S.text((S.cols - menu.busy.length) >> 1, top + 6, menu.busy, ...UI.info);
  if (menu.error) S.text(2, top + 7, menu.error.slice(0, S.cols - 4), ...UI.bad);
  keyHelp(2, S.rows - 1, S.cols - 4, [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "Enter", help: "start" },
                                       { code: "KeyM", help: "music" }, { code: "KeyN", help: "sounds" }]);
}

const DIGITS = { Digit1: 0, Digit2: 1, Numpad1: 0, Numpad2: 1 };
registerScreen("title", {
  over: "none", pointer: "unlock",
  draw: drawTitle,
  key(game, code, repeat) {
    const items = titleItems();
    if (code in DIGITS) { if (!repeat && items[DIGITS[code]]) { menu.sel = DIGITS[code]; choose(game, items[menu.sel]); } return true; }
    const r = listKey(menu, code, items.length);
    if (r === "select" && !repeat) choose(game, items[menu.sel]);
    return r !== null;
  },
  mouse(game, button, cell) {
    const i = listAt(menu, cell), items = titleItems();
    if (button === 0 && i >= 0 && items[i]) { menu.sel = i; choose(game, items[i]); }
  },
  wheel(game, sign) { listWheel(menu, sign, titleItems().length); },
});
