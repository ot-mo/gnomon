// Overworld travel (WS1; TECH_DESIGN §5.2, §8.3 "WS1"). src/features.js imports this file; it registers
// everything WS1 adds (the `world` screen, the O and Z keys, travel's updates and bus handlers).
//
//   enterWorldMap(game) · worldStep(game, dx, dy) → result · fastTravel(game, to) ·
//   leaveWorldMap(game, { at: "edge" | "center" | "site" })                 travel.js
//   rest(game, { until: "healed" | seconds }) → result                       rest.js
//   reveal(game, wx, wy, radius) · isKnown(game, wx, wy) · pin(game, wx, wy, { label, secretId })   discovery.js
//   renderWorld(game)                                                        renderWorld.js
//
// The `world` screen is screens/worldmap.js (screens/index.js imports every screen).
// P0: registers nothing, so the game plays as before. Remove STUB when WS1 registers its parts here.
import "./encounters.js";
export { enterWorldMap, worldStep, fastTravel, leaveWorldMap } from "./travel.js";
export { rest } from "./rest.js";
export { reveal, isKnown, pin } from "./discovery.js";
export { renderWorld } from "./renderWorld.js";
export const STUB = "WS1";
