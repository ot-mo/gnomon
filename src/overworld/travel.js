// World-map travel (TECH_DESIGN §5.2; §1.4 "overworld (WS1)"). A P0 stub with the frozen signatures; WS1
// builds it. Nothing calls it yet: the `world` mode (screens/worldmap.js) and the O key (§4.3) are WS1's.
//
//   enterWorldMap(game)                   O on a surface zone with no hostile awake within 10 tiles: push `world`
//   worldStep(game, dx, dy) → result      one 8-way step; skipTime(game, travelHours in seconds, { interruptible:
//                                         false, reason: "travel" }), getting lost, encounter rolls; emits "world:step"
//   fastTravel(game, to) → result         to a known destination: A* over roads, rivers and visited spans
//   leaveWorldMap(game, { at })           at: "edge" (the side you came in by) | "center" | "site" (a known site's entrance)
//
// Left open by the design: the shape of `result` (the "world:step" payload { from, to, seconds, lost,
// encounter } of §2.12 is the natural one) and of `to` (a span { wx, wy }, or a site id).
// Until WS1 builds them every one throws "not built yet (WS1)". Remove STUB when the file is built
// (check-imports holds a stub to this).
export const STUB = "WS1";
const notBuilt = (fn) => { throw new Error(`${fn}: not built yet (WS1)`); };

export function enterWorldMap(game) { notBuilt("enterWorldMap"); }
export function worldStep(game, dx, dy) { notBuilt("worldStep"); }
export function fastTravel(game, to) { notBuilt("fastTravel"); }
export function leaveWorldMap(game, { at = "edge" } = {}) { notBuilt("leaveWorldMap"); }
