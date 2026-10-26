// World liquids (TECH_DESIGN §2.10 "World liquids are separate from money", §2.2 zone.liquid / zone.liquids;
// DECISIONS §1: one dominant liquid per tile, no mixing; §1.4 "social (WS6a/6b)"; owner WS6b). A P0 stub with the
// frozen signature.
//
//   liquidAt(zone, x, y) → liquidId     which liquid the water blocks of column (x, y) hold: zone.liquids' entry
//                                       for the column (WS2 sets them), else the zone's default zone.liquid
//
// Until WS6b builds it, every water is the zone's default ("water" when the zone names none). WS6b decides how
// zone.liquids is keyed and gives touch and drink effects (content/liquids.js). Remove STUB when it is built.
export const STUB = "WS6b";

export function liquidAt(zone, x, y) { return zone?.liquid || "water"; }
