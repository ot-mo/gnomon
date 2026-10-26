// Rest (TECH_DESIGN §5.2 "Rest"; §1.4 "overworld (WS1)"; DECISIONS §1 "Clock"). A P0 stub with the frozen
// signature; WS1 builds it (Z on the map and on the world map, §4.3).
//
//   rest(game, { until }) → result     skipTime until `until`, interruptible; an encounter roll once per game hour
//                                      at half the travel rate; an hour's rest clears secondWind and firstBlock
//
// `until`: TECH_DESIGN says "healed" | seconds; DECISIONS §1 adds "dawn", "noon", "dusk" and "midnight" (clock.js
// secondsUntil(game, what) gives the seconds). The shape of `result` is left open (skipTime's { elapsed,
// interrupted, why } is the natural one).
// Until WS1 builds it, it throws "not built yet (WS1)". Remove STUB when the file is built.
export const STUB = "WS1";

export function rest(game, { until = "healed" } = {}) { throw new Error("rest: not built yet (WS1)"); }
