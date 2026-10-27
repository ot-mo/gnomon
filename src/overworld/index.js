// Overworld travel (WS1; TECH_DESIGN §5.2, §8.3 "WS1"; bible §4.1, §4.6, §4.9). src/features.js imports this file;
// each module registers its own parts as it loads:
//
//   state.js       RULES.overworld, the saved atlas (game.state.atlas), the travel stream, the step rule
//   discovery.js   reveal · isKnown · pin · knownSites · visit (on zone:enter) · discovery XP
//   lost.js        the `lost` status and the ways back (zone:enter, bearings from height in 3D, "Which way am I?")
//   encounters.js  the encounter rolls; the "band" zone patch
//   travel.js      enterWorldMap · worldStep · fastTravel · leaveWorldMap (the `world` screen's rules)
//   rest.js        rest (Z: until healed, dawn, noon, dusk, midnight or N hours)
//   renderWorld.js renderWorld (drawn by the `world` screen)
//
// The `world` and `wait` screens, and the O and Z keys, are screens/worldmap.js (screens/index.js imports every
// screen).
export { enterWorldMap, worldStep, fastTravel, leaveWorldMap, travelPath, stepHours, answer } from "./travel.js";
export { rest, waitChoices } from "./rest.js";
export { reveal, isKnown, pin, unpin, pinsAt, knownSites, discoveryXp, visit } from "./discovery.js";
export { renderWorld } from "./renderWorld.js";
export { isLost, lostChance, findBearings } from "./lost.js";
export { encounterChance, rollEncounter, placeEncounter } from "./encounters.js";
export { atlas, canStep } from "./state.js";
