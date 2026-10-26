// The world map (TECH_DESIGN §4.2 `world`, §5.2; owner WS1). A P0 stub: registers no screen yet, so nothing
// changes. WS1 registers MODE here with registerScreen (turn-based: each step is skipTime) and binds O (play,
// surface only, no hostile awake within 10 tiles; §4.3) to overworld/travel.js enterWorldMap.
// Remove STUB when the screen is built.
export const STUB = "WS1";
export const MODE = "world";
