// The test world (TECH_DESIGN §8.2 0A2): a small fixture map the engine is built and checked
// against while the real world (worldmap.js) waits for its content. Everything in this file is
// fixture data, not world content: the terrains, regions and names are placeholders.
//
// 40 × 20 spans: flats and hills in the west (the Westreach, tier 1), forest and marsh in the middle
// (the Midwood, tier 2), a mountain ridge you can only walk into (travel "no"), hills beyond it (the
// Eastfells, tier 3), and the sea along the south and east. One road runs from the temple east over
// the ridge to the tower; one river runs south from the north edge into the sea.
//
// Three landmarks:
//   temple  (0, 0)   the Temple of Angles over the legacy fixture site: the parent game's 20-level stack
//                    (world/legacy.js, legacyParams). DECISIONS.md: in the test world the legacy fixture stays
//                    at (0, 0), so this stands in for TECH_DESIGN's "fixture temple with a 3-level dungeon".
//   ruin    (20, 8)  a ruin in the Midwood with a 5-level dungeon that ends in the Flat Queen's hall.
//   tower   (35, 4)  a roofless tower whose footprint touches its zone's open east edge.
// Their plans are TEST_PLANS below (the temple's is content/world/temple.js); their footprints are given as rect.

import { B } from "../../blocks.js";
import { TEMPLE_PLAN } from "./temple.js";

// Fixture terrains, in the schema of content/world/terrains.js (enter, travelHours, lostChance, and the
// world-function parameters ground, relief, cliffs and trees).
export const TEST_TERRAINS = {
  flats: { name: "flats", glyph: ".", color: [178, 190, 120], enter: "map", travelHours: 4, lostChance: 0.02,
           ground: "GRASS", relief: 0.2, cliffs: 0, trees: 0.02 },
  hills: { name: "hills", glyph: "n", color: [140, 160, 96], enter: "map", travelHours: 6, lostChance: 0.05,
           ground: "GRASS", relief: 0.8, cliffs: 0.3, trees: 0.03 },
  forest: { name: "forest", glyph: "&", color: [60, 110, 66], enter: "map", travelHours: 8, lostChance: 0.1,
            ground: "GRASS", relief: 0.4, cliffs: 0, trees: 0.6 },
  marsh: { name: "marsh", glyph: ",", color: [96, 120, 90], enter: "map", travelHours: 10, lostChance: 0.08,
           ground: "MOSS", relief: 0.05, cliffs: 0, trees: 0.05 },
  mountains: { name: "mountains", glyph: "^", color: [130, 122, 116], enter: "walk", travelHours: null, lostChance: null,
               ground: "STONE", relief: 1, cliffs: 1, trees: 0 },
  sea: { name: "the sea", glyph: "~", color: [70, 112, 150], enter: "never", travelHours: null, lostChance: null,
         edgeMessage: "The sea won't bear you.", ground: "SAND", relief: 0, cliffs: 0, trees: 0 },
};

// Fixture regions: a tier each, and the chance per eligible span of each kind of per-run site
// (world/sites.js placeSites).
export const TEST_REGIONS = {
  westreach: { name: "the Westreach", tier: 1, music: null, encounterRate: 0.05, sites: { village: 0.015, ruin: 0.01, lair: 0.008 } },
  midwood: { name: "the Midwood", tier: 2, music: null, encounterRate: 0.08, sites: { village: 0.012, ruin: 0.015, lair: 0.012 } },
  eastfells: { name: "the Eastfells", tier: 3, music: null, encounterRate: 0.1, sites: { village: 0.012, ruin: 0.015, lair: 0.015 } },
};

// A 4-connected path through waypoints that share a row or a column.
const line = (points) => {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i];
    while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); out.push([x, y]); }
  }
  return out;
};

export const TEST_WORLD_MAP = {
  id: "test", version: 1, w: 40, h: 20, name: "the test world",
  terrain: [
    '.....n..n..n.&&&&&&&&&&&&&nnnn.nnnn.nnnn', // 0
    '...n..n..n...&&&&&&&&&&&&&^^n.nnnn.nnnn.', // 1
    '....n..n....n&&&&&&&&&&&&&^^.nnnn.nnnn.n', // 2
    '.....n....n..&&&&&&&&&&&&&^^nnnn.nnnn.nn', // 3
    '...n....n..n.&&&&&&&&&&&&&^^nnn.nnnn.nnn', // 4
    '......n..n..n&&&&&&&&&&&&&^^nn.nnnn.nnnn', // 5
    '....n..n..n..&&&&&&&&&&&&&^^n.nnnn.nnnn.', // 6
    '.....n..n....&&&&&&&&&&&&&^^.nnnn.nnnn.n', // 7
    '...n..n....n.&&&&&&&&&&&&&^^nnnn.nnnn.nn', // 8
    '....n....n..n&&&&&&&&&&&&&^^nnn.nnnn.nnn', // 9
    '.......n..n..&&&&&&&&&&&&&^^nn.nnnn.nnnn', // 10
    '.....n..n..n.,,,,,,,,,,,,,^^n.nnnn.nnnn.', // 11
    '...n..n..n...,,,,,,,,,,,,,^^.nnnn.nnnn.~', // 12
    '....n..n....n,,,,,,,,,,,,,^^nnnn.nnnn.n~', // 13
    '.....n....n..,,,,,,,,,,,,,.nnnn.nnnn.nn~', // 14
    ',,,,,,,,n..n.,,,,,,,,,,,,,nnnn.nnnn.nnn~', // 15
    ',,,,,,,,.n..n,,,,,,,,,,,,,nnn.nnnn.nnnn~', // 16
    ',,,,,,,,~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 17
    ',,,,,,,,~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 18
    ',,,,,,,,~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', // 19
  ],
  terrainKey: { ".": "flats", n: "hills", "&": "forest", ",": "marsh", "^": "mountains", "~": "sea" },
  regions: Array.from({ length: 20 }, () => "w".repeat(13) + "m".repeat(13) + "e".repeat(14)),
  regionKey: { w: "westreach", m: "midwood", e: "eastfells" },
  roads: [{ id: "templeRoad", width: 2, path: line([[0, 0], [6, 0], [6, 8], [33, 8], [33, 4], [35, 4]]) }],
  rivers: [{ id: "greyRun", width: 3, path: line([[14, 0], [14, 12], [17, 12], [17, 17]]) }],   // its mouth is in the sea
  start: "temple",
};

export const TEST_LANDMARKS = [
  { id: "temple", name: "The Temple of Angles", at: [0, 0], tier: 1, kind: "temple", plan: "temple",
    rect: { x: 16, y: 0, w: 48, d: 48 },   // the parent's 48×48 temple zone, centred so level 1 lies 1:1 below it
    checkpoint: true, visibleFrom: 2,
    dungeon: { id: "legacy", legacy: true, levels: 20, theme: "legacy", baseLevel: 0, bottom: { kind: "boss", id: "lich" } } },
  { id: "ruin", name: "The Leaning Hall", at: [20, 8], tier: 2, kind: "ruin", plan: "ruin",
    rect: { x: 30, y: 16, w: 20, d: 16 }, visibleFrom: 1,
    dungeon: { id: "leaningHall", levels: 5, theme: "legacy", bottom: { kind: "guardian", id: "flatqueen" } } },
  { id: "tower", name: "The Roofless Tower", at: [35, 4], tier: 3, kind: "tower", plan: "tower",
    rect: { x: 68, y: 18, w: 12, d: 12 }, visibleFrom: 3 },   // x 68..79: it touches the open east edge
];

// The plans, in the vault letter format (gen/vaults.js; gen/surface.js stamps them). Beyond the vault fields:
//   rows, roof ("none" | "rock" | "slab"), wallHeight, at ([x, y] of the plan's corner in the landmark's rect;
//   default centred), hub ([x, y] in plan coordinates: where the road arrives), spawn (the anchor's letter),
//   keys (letters that must be reachable), entranceGated (the stairs wait behind a puzzle), dungeonAt
//   ([x, y] of the dungeon levels' corner in the rect, instead of centred under the entrance), sinkholes
//   (false: none), rng (runSeed → the plan's rng), stamp (a function of its own instead of stampVault).
// The ruin: a roofless hall with gaps in its walls, the way down in a little room in the middle.
const RUIN_PLAN = {
  id: "ruin", name: "The Leaning Hall", height: 4, wallHeight: 3, roof: "none", wall: B.MOSS, floorBlock: B.ROCK,
  rows: [
    "###.######..####.###",
    "#..................#",
    "#.##............##.#",
    "#.##............##..",
    "...................#",
    "#.......#####......#",
    "#.......#...#.......",
    "#.......#.>.D......#",
    "#.......#...#......#",
    "#.......#####......#",
    "#..................#",
    "#.##............##.#",
    "..##............##.#",
    "#..................#",
    "#..................#",
    "#####.######...#####",
  ],
  hub: [13, 16], keys: [">"],
};
// The tower: tall and roofless, its door to the west where the road comes in; its yard reaches the
// span's east edge (x 79), which is open.
const TOWER_PLAN = {
  id: "tower", name: "The Roofless Tower", height: 4, wallHeight: 8, roof: "none", wall: B.STONE, floorBlock: B.TILE,
  rows: [
    "............",
    "............",
    "...######...",
    "...#....#...",
    "..##....##..",
    "..D......#..",
    "..#......#..",
    "..##....##..",
    "...#....#...",
    "...######...",
    "............",
    "............",
  ],
  hub: [1, 5], keys: ["D"],
};
export const TEST_PLANS = { temple: TEMPLE_PLAN, ruin: RUIN_PLAN, tower: TOWER_PLAN };

// startPurse: the test world carries the parent game, whose prices were set with no purse at all, so you
// start with the largest flask there (bible §15.6). The real world starts with the smallest.
export const TEST_WORLD = { world: TEST_WORLD_MAP, terrains: TEST_TERRAINS, regions: TEST_REGIONS,
                            landmarks: TEST_LANDMARKS, plans: TEST_PLANS, startPurse: 1000 };
