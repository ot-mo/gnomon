// The mode stack and the screen registry (TECH_DESIGN §4.1). Every mode is a registered screen; game.mode
// is the top of game.modeStack, and pushing a screen remembers what to return to (it replaces the
// separate "return to" fields: invReturn, levelReturn, talk.ret, the journal's).
//
//   registerScreen(mode, def)   def: { draw(game), key?(game, code, repeat, key) → bool, mouse?(game, button, cell),
//                                      hover?(game, cell), wheel?(game, sign), update?(game, dt),
//                                      enter?(game, data), leave?(game, result),
//                                      pausesTime = true, pointer = "unlock" | "lock" | "keep", over = "view" | "none",
//                                      saveable = false }
//                               Registering a mode again replaces it (the later port of a screen wins).
//   pushMode(game, mode, data)  open `mode` over the current one; data.onPop?(game, result) runs when it closes
//   popMode(game, result)       close the top screen and return to the one under it (never empties the stack)
//   setMode(game, mode, data)   replace the whole stack (title, dead, world)
//   topMode(game)               game.mode
//   screenFor(mode)             the registered def, or null
//   modeData(game)              the data the top screen was opened with
//   dispatchMouse/Hover/Wheel(game, …) → bool   the top screen's handler, if it has one (keys: keys.js)
//   drawStack(game) → bool      draws every screen in the stack bottom-up (those drawn over the view, and the
//                               top one); false when the top mode has no registered screen
//
// Until 0D1 ports them, the old modes (explore, map, talk, shop, …) are not registered and game.js still
// sets game.mode directly; the stack follows such a change the next time it is touched (syncStack), so
// both ways of changing modes can live side by side.
import { lockPointer, unlockPointer } from "./input.js";

export const SCREENS = new Map();   // mode → def (with defaults filled in)
const DEFAULTS = { pausesTime: true, pointer: "unlock", over: "view", saveable: false };

export function registerScreen(mode, def) {
  const full = { ...DEFAULTS, ...def, mode };
  SCREENS.set(mode, full);
  return full;
}

export const screenFor = (mode) => SCREENS.get(mode) || null;
export const topMode = (game) => game.mode;

// The stack's entries: { mode, data }. game.mode is always the top entry's mode.
function stackOf(game) {
  if (!Array.isArray(game.modeStack)) game.modeStack = [];
  return game.modeStack;
}

// Legacy code may have set game.mode directly: the top entry becomes that mode (what was under it stays).
export function syncStack(game) {
  const st = stackOf(game);
  if (!st.length) st.push({ mode: game.mode, data: null });
  else if (st[st.length - 1].mode !== game.mode) st[st.length - 1] = { mode: game.mode, data: null };
  return st;
}

export function modeData(game) {
  const st = syncStack(game);
  return st[st.length - 1].data;
}

// The pointer as a screen wants it: "lock" (the 3D view: look with the mouse) or "unlock" (menus).
function applyPointer(game, def) {
  if (!def || def.pointer === "keep") return;
  if (def.pointer === "unlock") unlockPointer();
  else if (def.pointer === "lock") { game.paused = false; lockPointer(); }
}

export function pushMode(game, mode, data = null) {
  const st = syncStack(game);
  st.push({ mode, data });
  game.mode = mode;
  const def = screenFor(mode);
  applyPointer(game, def);
  def?.enter?.(game, data);
  return data;
}

export function popMode(game, result) {
  const st = syncStack(game);
  if (st.length < 2) return false;
  const top = st.pop(), def = screenFor(top.mode);
  game.mode = st[st.length - 1].mode;
  def?.leave?.(game, result);
  applyPointer(game, screenFor(game.mode));
  top.data?.onPop?.(game, result);
  return true;
}

export function setMode(game, mode, data = null) {
  const st = stackOf(game);
  const old = st.length ? st.splice(0) : [];
  for (let k = old.length - 1; k >= 0; k--) screenFor(old[k].mode)?.leave?.(game, undefined);
  st.push({ mode, data });
  game.mode = mode;
  const def = screenFor(mode);
  applyPointer(game, def);
  def?.enter?.(game, data);
}

// --- Input and drawing for registered screens -------------------------------------------------------
const top = (game) => screenFor(game.mode);

export function dispatchMouse(game, button, cell) {
  const def = top(game);
  return !!(def?.mouse && def.mouse(game, button, cell) !== false);
}

export function dispatchHover(game, cell) {
  const def = top(game);
  return !!(def?.hover && def.hover(game, cell) !== false);
}

export function dispatchWheel(game, sign) {
  const def = top(game);
  return !!(def?.wheel && def.wheel(game, sign) !== false);
}

export function updateScreen(game, dt) { top(game)?.update?.(game, dt); }

// Does time run in the top mode? (Unregistered legacy modes answer for themselves in game.js.)
export const timeRuns = (game) => top(game)?.pausesTime === false;

export function drawStack(game) {
  const def = top(game);
  if (!def) return false;
  const st = syncStack(game);
  for (let k = 0; k < st.length - 1; k++) {
    const d = screenFor(st[k].mode);
    if (d && d.over === "view") d.draw(game);
  }
  def.draw(game);
  return true;
}
