// The target screen (TECH_DESIGN §4.2 `target`, §2.8 "Targeting on the map"; owner WS8): a cursor moved by keys
// or the mouse, Tab cycles visible hostiles, the path drawn in line-of-fire colour, the hit chance shown; Enter or
// a click confirms, Esc cancels. Opened by a throw, a missile, an ability (abilities.js requestTarget keeps its
// signature; WS8 replaces the P0 body, which picks the nearest hostile seen within 10 tiles) and L, the look
// cursor, whose confirm emits `inspect { open: true }`.
// A P0 stub: registers no screen and binds no key yet, so nothing changes. Remove STUB when the screen is built.
export const STUB = "WS8";
export const MODE = "target";
