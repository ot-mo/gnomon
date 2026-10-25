// The real world map: WORLD_BIBLE §15.1 (rows, tiers), §15.3 (where the landmarks are) and §15.5 (roads
// and rivers), copied exactly. A second fixture for now: the game still runs on the test world, and
// content phase C1 adds the landmarks' plans, the regions and everything else. check-world validates it.
import { TERRAINS } from "./terrains.js";

// Each character is one span (a world tile). The river glyph is ", so the rows are single-quoted.
export const WORLD_ROWS = [
  '......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********', // 0
  '......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********', // 1
  '......&&&&&&&&&&&&&^^^&&&&&M&&&&&*********', // 2
  '......&&&&&&&&&&&&&^^^&&&&&:&&&&&&***N****', // 3
  '..O..&&&&&&&P&&&&&&^^^&&&&&:&&&&&&%%%%****', // 4
  '.....&&&&&&&&&&&&&"^^^&&&&&:&&&&%%%%******', // 5
  '.....&&&&&&&&&&&&&"^^^+++++:++%J%%##******', // 6
  '....====&&&&&&&&&&"^^^+I+++:%%%%#####*****', // 7
  '....========;;;;;""^^^+++++:%%######:*****', // 8
  '..======E===;;;;;"::F::++%%:%"+#####:#####', // 9
  '..==========;;;;;":^^^:%%%%:+"+#####:#####', // 10
  '..=========;;;;;"":^^^::HHH::::::::::#####', // 11
  '..========:D:::::::^^^+++++++"+:####:#####', // 12
  '..=======::;;;;"";;^^^+++++++~~:~~##:K####', // 13
  '..====C=::=;##;";;;^^^++++++~~~:~~~#######', // 14
  '..,,,B,::,,;;;"";;;;^^++G++~~~~:~~~~######', // 15
  '..,,,A::,,,;;;";;;;;^^+++++~~~~L~~~~######', // 16
  '..,,,,,,,,,;;"";;;;;;;+++++~~~~~~~~#######', // 17
  '...,~~~,,,,;;";;;;;;;;++++++~~~~~~########', // 18
  '...,,,,,,,,;;";;;;;;;;+++++++~~~~#########', // 19
  '...,,,,,,,,;;";;;;;;;;+++++++++###########', // 20
];
export const TIER_ROWS = [
  '333333333334444444455555555566666778888888', // 0
  '333333333333344444455455555556666777888888', // 1
  '333333333333333444455545555655666777888888', // 2
  '333333333333333344455544555555666677888888', // 3
  '333333333333333334455544555555566677788888', // 4
  '333222223333333333455544455555567777788888', // 5
  '222222222223333333355544445555667766778888', // 6
  '222222222222333333345544445566666666678888', // 7
  '222222222222233333345544445566556666678888', // 8
  '222222222222223333333444455565555666667777', // 9
  '222222222222222333344545555555555666666777', // 10
  '222111112222222233344444444555555666666777', // 11
  '221111111222222233344444444455555666666777', // 12
  '211111111122222233344444444456656766666777', // 13
  '111111111112222223344444444466656776666777', // 14
  '111111111112222223344444444566656777666777', // 15
  '111111111112222223334444444566676777666777', // 16
  '111111111112222223333344444566666776666777', // 17
  '111122211112222223333344444466666766666777', // 18
  '211111111122222233333344444456666666666777', // 19
  '221111111222222233333344444455555666666777', // 20
];

// The landmarks (§15.3): letter, id, name, tier, kind, and the terrain they stand in (§5's headings);
// dungeon: the floors' levels, in order, from the top (§15.3's "Dungeon" column; `up` for floors
// above ground). Only where they are and how deep: their plans and people come in C1.
const floors = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
export const LANDMARK_INDEX = [
  { letter: "A", id: "hollowmere", name: "Hollowmere", at: [[5, 16]], tier: 1, terrain: "flats", kind: "startVillage",
    dungeon: { id: "keepersStair", floors: floors(2, 21), optional: true, legacy: true } },
  { letter: "B", id: "dialFloor", name: "The Dial Floor", at: [[5, 15]], tier: 1, terrain: "flats", kind: "stele" },
  { letter: "C", id: "kettleMesa", name: "Kettle Mesa", at: [[6, 14]], tier: 1, terrain: "steps", kind: "dungeon",
    dungeon: { id: "kettleMesa", floors: floors(2, 4) } },
  { letter: "D", id: "benchmark", name: "Benchmark", at: [[11, 12]], tier: 2, terrain: "downs", kind: "hub",
    dungeon: { id: "datum", floors: floors(5, 8) } },
  { letter: "E", id: "tallTable", name: "The Tall Table", at: [[8, 9]], tier: 2, terrain: "steps", kind: "aerie" },
  { letter: "F", id: "molar", name: "Molar", at: [[20, 9]], tier: 3, terrain: "teeth", kind: "passTown",
    dungeon: { id: "rootCanals", floors: floors(8, 9) } },
  { letter: "G", id: "folio", name: "Folio", at: [[24, 15]], tier: 4, terrain: "tessellate", kind: "flatTown" },
  { letter: "H", id: "halfnight", name: "Halfnight", at: [[24, 11], [25, 11], [26, 11]], tier: 4, terrain: "tessellate", kind: "holyCity" },
  { letter: "I", id: "pressyard", name: "The Pressyard", at: [[23, 7]], tier: 4, terrain: "tessellate", kind: "dungeon",
    dungeon: { id: "press", floors: floors(11, 15) } },
  { letter: "J", id: "unlitChoir", name: "The Unlit Choir", at: [[31, 6]], tier: 6, terrain: "shade", kind: "dungeon",
    dungeon: { id: "unlitChoir", floors: floors(15, 20) } },
  { letter: "K", id: "metronome", name: "The Metronome", at: [[37, 13]], tier: 6, terrain: "stacks", kind: "dungeon",
    dungeon: { id: "metronome", floors: floors(17, 22) } },
  { letter: "L", id: "drownedLantern", name: "The Drowned Lantern", at: [[31, 16]], tier: 7, terrain: "sea", kind: "dungeon",
    dungeon: { id: "drownedLantern", floors: floors(20, 24), optional: true } },
  { letter: "M", id: "square", name: "The Square", at: [[27, 2]], tier: 6, terrain: "deepPleat", kind: "citadel",
    dungeon: { id: "square", floors: floors(19, 21), up: floors(22, 23) } },
  { letter: "N", id: "gnomon", name: "The Gnomon", at: [[37, 3]], tier: 8, terrain: "lattice", kind: "needle",
    dungeon: { id: "dialWorks", floors: floors(23, 30) } },
  { letter: "O", id: "saltpage", name: "Saltpage", at: [[2, 4]], tier: 3, terrain: "waste", kind: "monastery",
    dungeon: { id: "underPage", floors: floors(8, 10), optional: true } },
  { letter: "P", id: "foldmother", name: "Foldmother", at: [[12, 4]], tier: 3, terrain: "pleatwood", kind: "treeVillage",
    dungeon: { id: "rootfold", floors: floors(8, 10), optional: true } },
];

// Roads and rivers (§15.5), 4-connected, in order.
const span = (pairs) => pairs.map(([x, y]) => [x, y]);
export const ROADS = [
  { id: "oldRule", path: span([[5, 16], [6, 16], [7, 16], [7, 15], [8, 15], [8, 14], [9, 14], [9, 13], [10, 13], [10, 12],
    [11, 12], [12, 12], [13, 12], [14, 12], [15, 12], [16, 12], [17, 12], [18, 12], [18, 11], [18, 10], [18, 9], [19, 9],
    [20, 9], [21, 9], [22, 9], [22, 10], [22, 11], [23, 11], [24, 11], [25, 11], [26, 11], [27, 11], [28, 11], [29, 11],
    [30, 11], [31, 11], [32, 11], [33, 11], [34, 11], [35, 11], [36, 11]]) },
  { id: "oldRuleNorth", path: span([[36, 11], [36, 10], [36, 9], [36, 8]]) },
  { id: "oldRuleSouth", path: span([[36, 11], [36, 12], [36, 13], [37, 13]]) },
  { id: "straightCut", path: span([[27, 2], [27, 3], [27, 4], [27, 5], [27, 6], [27, 7], [27, 8], [27, 9], [27, 10], [27, 11]]) },
  { id: "glassCauseway", path: span([[31, 11], [31, 12], [31, 13], [31, 14], [31, 15], [31, 16]]) },
];
export const RIVERS = [
  { id: "slake", width: 5, path: span([[18, 5], [18, 6], [18, 7], [18, 8], [17, 8], [17, 9], [17, 10], [17, 11], [16, 11],
    [16, 12], [16, 13], [15, 13], [15, 14], [15, 15], [14, 15], [14, 16], [14, 17], [13, 17], [13, 18], [13, 19], [13, 20]]) },
  { id: "inkrun", width: 3, path: span([[29, 9], [29, 10], [29, 11], [29, 12], [29, 13]]) },
];

// The terrain counts of §15.1's legend (checked by check-world).
export const TERRAIN_COUNTS = { flats: 42, waste: 73, steps: 61, downs: 85, pleatwood: 101, deepPleat: 65, tessellate: 78,
  stacks: 109, shade: 24, lattice: 60, teeth: 44, sea: 47, river: 23, road: 52, landmarks: 18 };

// The world, in the schema of TECH_DESIGN §2.18 (compiled by world/worldmodel.js). A terrainKey entry is a terrain id, or a list of
// { from?, to?, id } ranges over x for a glyph that means two terrains (the Pleatwood west of the
// Teeth and the Deep Pleat east of them). Landmark letters stand on the terrain LANDMARK_INDEX names.
const terrainKey = {
  ",": "flats", ".": "waste", "=": "steps", ";": "downs", "&": [{ to: 18, id: "pleatwood" }, { from: 21, id: "deepPleat" }],
  "+": "tessellate", "#": "stacks", "%": "shade", "*": "lattice", "^": "teeth", "~": "sea", "\"": "river", ":": "road",
};
for (const l of LANDMARK_INDEX) terrainKey[l.letter] = l.terrain;

export const WORLD = {
  id: "gnomon", version: 1, w: 42, h: 21, name: "the Long Noon",
  terrain: WORLD_ROWS, terrainKey,
  tiers: TIER_ROWS,                       // the tier of every span; regions come in C1 (until then a span's region is its terrain)
  landmarkKey: Object.fromEntries(LANDMARK_INDEX.map((l) => [l.letter, l.id])),
  roads: ROADS, rivers: RIVERS,
  start: "hollowmere",
};
// Everything compileWorld needs (no landmark plans yet: C1). A landmark dungeon's floors are listed
// level by level; the legacy flag marks the Keeper's Stair, which is the parent game's 20-level stack.
export { TERRAINS };
export const LANDMARKS = LANDMARK_INDEX.map((l) => ({ id: l.id, name: l.name, at: l.at[0], spans: l.at, tier: l.tier, kind: l.kind,
  plan: null, checkpoint: l.kind === "startVillage", dungeon: l.dungeon || null }));
export const REGIONS = {};
export const PLANS = {};
export const REAL_WORLD = { world: WORLD, terrains: TERRAINS, regions: REGIONS, landmarks: LANDMARKS, plans: PLANS };
