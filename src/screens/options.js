// Options (TECH_DESIGN §4.2 `pause / options`): music and sounds, the field of view, mouse look, the keys of both
// views, and in a run "Save now" and "Save and quit" (to the title, a clean save: save.js `clean`). Opened from the
// title and from the pause card (Esc on it); Esc or Back returns there. The field of view and mouse look persist in
// the save store's meta record "settings" (save/store.js; localStorage is audio.js's alone: check-config), and are
// applied when the title opens (so the tools' ?quick=1 games, which never see it, keep the defaults); music and
// sounds persist as they always have (audio.js savedSwitch).
//
//   openOptions(game, { from }) · MODE = "options"
//   settings() → { fov, look } (as last read or set) · loadSettings(game, store = currentStore()) → Promise (applies them)
//   saveSettings(game) → Promise
//   optionItems(game) → [{ id, label }]   what it offers now
//   BASE_SENSITIVITY = 0.0025 (radians a pixel; game.sensitivity = BASE_SENSITIVITY × look)
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode, setMode, modeData } from "../screens.js";
import { UI, modal, box, list, listKey, listWheel, listAt, keyHelp } from "../ui.js";
import { helpFor, keyLabel } from "../keys.js";
import { toggleMusic, musicMuted } from "../music.js";
import { toggleSounds, soundsOn } from "../sfx.js";
import { playMode } from "./play.js";
import { saveGame, currentStore } from "../save/index.js";

export const MODE = "options";
export const BASE_SENSITIVITY = 0.0025;
const DEFAULTS = { fov: 75, look: 1 };
const LOOKS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const clampFov = (v) => Math.max(40, Math.min(100, Math.round(v / 5) * 5));

let known = { ...DEFAULTS };
const valid = (s) => ({ fov: Number.isFinite(s?.fov) ? clampFov(s.fov) : DEFAULTS.fov, look: LOOKS.includes(s?.look) ? s.look : DEFAULTS.look });
export const settings = () => ({ ...known });
export async function loadSettings(game, store = currentStore()) {
  try { known = valid(store ? await store.get("meta", "settings") : null); } catch { known = { ...DEFAULTS }; }
  game.fov = known.fov;
  game.sensitivity = BASE_SENSITIVITY * known.look;
  return settings();
}
const nearestLook = (game) => LOOKS.reduce((a, b) => (Math.abs(b * BASE_SENSITIVITY - game.sensitivity) < Math.abs(a * BASE_SENSITIVITY - game.sensitivity) ? b : a));
export function saveSettings(game) {
  known = { fov: clampFov(game.fov), look: nearestLook(game) };
  const st = currentStore();
  return st ? st.put("meta", { id: "settings", ...known }).catch(() => {}) : Promise.resolve();
}

const st = { sel: 0, top: 0, view: "main", note: "", bad: false, keys: { sel: 0, top: 0 } };
const inRun = (game) => modeData(game)?.from !== "title" && !!(game.player && game.zone && game.run);

export function optionItems(game) {
  const look = game.sensitivity / BASE_SENSITIVITY;
  const items = [
    { id: "music", label: `Music: ${musicMuted() ? "off" : "on"}` },
    { id: "sounds", label: `Sounds and voices: ${soundsOn() ? "on" : "off"}` },
    { id: "fov", label: `Field of view: ${clampFov(game.fov)}°` },
    { id: "look", label: `Mouse look: ×${Number(look.toFixed(2))}` },
    { id: "keys", label: "Keys" },
  ];
  if (inRun(game)) items.push({ id: "save", label: "Save now" }, { id: "quit", label: "Save and quit (to the title)" });
  items.push({ id: "back", label: "Back" });
  return items;
}

export function openOptions(game, { from = game.mode } = {}) {
  st.sel = 0; st.view = "main"; st.note = ""; st.bad = false;
  pushMode(game, MODE, { from }, { pointer: false });
}

function step(game, id, d) {
  if (id === "fov") game.fov = clampFov(game.fov + 5 * d);
  else if (id === "look") {
    const k = LOOKS.indexOf(nearestLook(game));
    game.sensitivity = BASE_SENSITIVITY * LOOKS[Math.max(0, Math.min(LOOKS.length - 1, k + d))];
  } else return false;
  saveSettings(game);
  return true;
}

function choose(game, item) {
  if (!item) return;
  st.note = ""; st.bad = false;
  if (item.id === "music") toggleMusic();
  else if (item.id === "sounds") toggleSounds();
  else if (item.id === "fov" || item.id === "look") step(game, item.id, 1);
  else if (item.id === "keys") { st.view = "keys"; st.keys.sel = 0; }
  else if (item.id === "save") {
    st.note = "Saving as soon as the game is back...";
    saveGame(game, { reason: "options" }).then(() => { st.note = "Saved."; }, (e) => { st.note = `The save failed: ${e.message}`; st.bad = true; });
  } else if (item.id === "quit") saveAndQuit(game);
  else if (item.id === "back") popMode(game, undefined, { pointer: false });
}

// The play view under the screens (so the save can happen now, time held), a clean save, then the title.
function saveAndQuit(game) {
  setMode(game, playMode(game), null, { pointer: false });
  game.paused = true;
  saveGame(game, { reason: "quit", clean: true }).then(
    () => import("./title.js").then((t) => t.openTitle(game)),
    (e) => { openOptions(game); st.note = `The save failed, so you're still here: ${e.message}`; st.bad = true; });
}

// The keys of both views, from the bindings (keys.js helpFor): the hotbar's 1-9 as one line.
function keyLines(mode, width) {
  const out = [], seen = new Map();
  for (const { code, help } of helpFor(mode)) {
    const label = /^Digit[1-9]$/.test(code) && /hotbar/.test(help) ? "1-9" : keyLabel(code);
    if (seen.has(help)) { const e = seen.get(help); if (!e.keys.includes(label) && label !== "1-9") e.keys.push(label); continue; }
    const e = { keys: [label], help };
    seen.set(help, e);
    out.push(e);
  }
  return out.map((e) => `${e.keys.join("/")}  ${e.help}`.slice(0, width));
}
function drawKeys(game) {
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 96), S.rows - 2);
  box(x0, y0, w, h, { title: "Keys" });
  const half = (w - 6) >> 1, cols = [["In 3D", keyLines("explore", half)], ["On the map", keyLines("map", half)]];
  cols.forEach(([title, lines], k) => {
    const x = x0 + 2 + k * (half + 2);
    S.text(x, y0 + 2, title, ...UI.title);
    lines.slice(0, h - 6).forEach((l, j) => S.text(x, y0 + 3 + j, l, ...UI.text));
  });
  S.text(x0 + 2, y0 + h - 2, "Also: Esc on the pause card opens these options. H the message log.".slice(0, w - 4), ...UI.info);
  keyHelp(x0 + 2, y0 + h - 1, w - 4, [{ code: "Escape", help: "back" }]);
}

function drawOptions(game) {
  if (st.view === "keys") { drawKeys(game); return; }
  const items = optionItems(game);
  const { x0, y0, w, h } = modal(Math.min(S.cols - 2, 60), items.length + 8);
  box(x0, y0, w, h, { title: "Options" });
  list(st, { x: x0 + 3, y: y0 + 2, w: w - 6, h: items.length, items, row: (it, i, r) => {
    if (r.sel) S.text(r.x, r.y, ">", ...UI.mark);
    S.text(r.x + 2, r.y, it.label.slice(0, r.w - 2), ...(r.sel ? UI.sel : UI.text));
    if (r.sel && (it.id === "fov" || it.id === "look")) S.text(r.x + 3 + it.label.length, r.y, "< >", ...UI.help);
  } });
  if (st.note) S.text(x0 + 3, y0 + h - 4, st.note.slice(0, w - 6), ...(st.bad ? UI.bad : UI.info));
  keyHelp(x0 + 3, y0 + h - 2, w - 6, [{ code: "ArrowUp", help: "choose" }, { code: "ArrowDown", help: "choose" }, { code: "Enter", help: "change" },
                                       { code: "ArrowLeft", help: "less" }, { code: "ArrowRight", help: "more" }, { code: "Escape", help: "back" }]);
}

registerScreen(MODE, {
  draw: drawOptions,
  key(game, code, repeat) {
    if (st.view === "keys") {
      if (code === "Escape" || code === "Enter" || code === "Backspace") { st.view = "main"; return true; }
      return true;
    }
    const items = optionItems(game), it = items[st.sel];
    if (code === "Escape") { if (!repeat) popMode(game, undefined, { pointer: false }); return true; }
    if (code === "ArrowLeft" || code === "ArrowRight" || code === "KeyA" || code === "KeyD") { step(game, it?.id, code === "ArrowLeft" || code === "KeyA" ? -1 : 1); return true; }
    const r = listKey(st, code, items.length);
    if (r === "select" && !repeat) choose(game, items[st.sel]);
    return r !== null || code !== "KeyM" && code !== "KeyN";   // every other key stays here (M and N work)
  },
  mouse(game, button, cell) {
    if (st.view === "keys") { st.view = "main"; return; }
    const i = listAt(st, cell), items = optionItems(game);
    if (button === 0 && i >= 0 && items[i]) { st.sel = i; choose(game, items[i]); }
  },
  wheel(game, sign) { if (st.view === "main") listWheel(st, sign, optionItems(game).length); },
});
