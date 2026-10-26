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
//   pushMode(game, mode, data, opts)   open `mode` over the current one; data.onPop?(game, result) runs when it closes
//   popMode(game, result, opts)        close the top screen and return to the one under it (never empties the stack)
//   setMode(game, mode, data, opts)    replace the whole stack (dead, a floor change, explore ⇄ map)
//                               opts.pointer = false: leave the pointer alone (for a change made outside a key
//                               press or click, or one that is about to be followed by another)
//   topMode(game)               game.mode
//   inStack(game, mode)         is `mode` anywhere on the stack?
//   screenFor(mode)             the registered def, or null
//   modeData(game)              the data the top screen was opened with
//   dispatchMouse/Hover/Wheel(game, …) → bool   the top screen's handler, if it has one (keys: keys.js)
//   updateScreen(game, dt)      the top screen's update
//   timeRuns(game)              does the world run under the top screen (pausesTime === false)?
//   drawStack(game) → bool      draws from the topmost opaque screen (over: "none": it draws the whole screen,
//                               like the views) up to the top; false when the top mode has no registered screen.
//                               Only the top screen's hit rects (ui.js) stay: the mouse never reaches a screen under it
//
// Tests and tools still set game.mode directly (game.mode = "map"); syncStack follows such a change the next
// time the stack is touched: a mode already lower in the stack pops back to it, an opaque mode (a view, the
// story, death) becomes the whole stack, and anything else goes on top.
import { lockPointer, unlockPointer } from "./input.js";
import { beginFrame } from "./ui.js";

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

// Something set game.mode directly: the stack follows (see the header).
export function syncStack(game) {
  const st = stackOf(game);
  if (!st.length) { st.push({ mode: game.mode, data: null }); return st; }
  if (st[st.length - 1].mode === game.mode) return st;
  const k = st.findLastIndex((e) => e.mode === game.mode);
  const def = screenFor(game.mode);
  if (k >= 0) st.length = k + 1;
  else if (def?.over === "none") st.splice(0, st.length, { mode: game.mode, data: null });
  else if (def) st.push({ mode: game.mode, data: null });
  else st[st.length - 1] = { mode: game.mode, data: null };
  return st;
}

export const inStack = (game, mode) => syncStack(game).some((e) => e.mode === mode);

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

export function pushMode(game, mode, data = null, { pointer = true } = {}) {
  const st = syncStack(game);
  st.push({ mode, data });
  game.mode = mode;
  const def = screenFor(mode);
  if (pointer) applyPointer(game, def);
  def?.enter?.(game, data);
  return data;
}

export function popMode(game, result, { pointer = true } = {}) {
  const st = syncStack(game);
  if (st.length < 2) return false;
  const top = st.pop(), def = screenFor(top.mode);
  game.mode = st[st.length - 1].mode;
  def?.leave?.(game, result);
  if (pointer) applyPointer(game, screenFor(game.mode));
  top.data?.onPop?.(game, result);
  return true;
}

export function setMode(game, mode, data = null, { pointer = true } = {}) {
  const st = syncStack(game);
  const old = st.splice(0);
  for (let k = old.length - 1; k >= 0; k--) screenFor(old[k].mode)?.leave?.(game, undefined);
  st.push({ mode, data });
  game.mode = mode;
  const def = screenFor(mode);
  if (pointer) applyPointer(game, def);
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
  if (!top(game)) return false;
  const st = syncStack(game);
  let from = st.length - 1;
  while (from > 0 && screenFor(st[from].mode)?.over !== "none") from--;
  for (let k = from; k < st.length; k++) {
    // Only the top screen's words answer the mouse: what the screens under it drew (the map header's
    // "Space: wait") is still visible but is not the top screen's key.
    if (k > from && k === st.length - 1) beginFrame();
    screenFor(st[k].mode)?.draw(game);
  }
  return true;
}
