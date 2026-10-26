// What you know of the world (TECH_DESIGN §5.2 "Entering", §2.14; §1.4 "overworld (WS1)"). A P0 stub with the
// frozen signatures; WS1 builds it over game.state.world = { visited, revealed, pins } (§2.17).
//
//   reveal(game, wx, wy, radius)            mark spans known: their sites and landmarks show on the world map
//   isKnown(game, wx, wy) → bool            discovered (visited, seen from a landmark's visibleFrom, or learned)
//   pin(game, wx, wy, { label, secretId })  a note on the world map (learnSecret pins location secrets, §2.14)
//
// The terrain of every span is common knowledge from the start (§5.2); isKnown is about sites and landmarks.
// Until WS1 builds them: isKnown says false (nothing discovered), reveal and pin throw "not built yet (WS1)".
// Remove STUB when the file is built (check-imports holds a stub to this).
export const STUB = "WS1";
const notBuilt = (fn) => { throw new Error(`${fn}: not built yet (WS1)`); };

export function reveal(game, wx, wy, radius) { notBuilt("reveal"); }
export function isKnown(game, wx, wy) { return false; }
export function pin(game, wx, wy, { label, secretId } = {}) { notBuilt("pin"); }
