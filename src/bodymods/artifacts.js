// Artifacts (TECH_DESIGN §2.6 "Identify artifacts", §8.3 "WS5"; §1.4 "bodymods (WS5)"). A P0 stub with the
// frozen signature; WS5 builds it over content/items/artifacts.js.
//
//   examineArtifact(game, p, it) → result    attr(int) + d10 + bonus(examine) against the item's complexity
//                                            (stats.js examineScore); failing by 5 or more breaks the item
//
// The shape of `result` is left to WS5 ({ ok, broke, roll } would do). Until WS5 builds it, it throws
// "not built yet (WS5)". Remove STUB when the file is built.
export const STUB = "WS5";

export function examineArtifact(game, p, it) { throw new Error("examineArtifact: not built yet (WS5)"); }
