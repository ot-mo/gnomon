// The real world map: WORLD_BIBLE §15.1 (rows, tiers), §15.3 (where the landmarks are) and §15.5 (roads
// and rivers), copied exactly; its regions (C1a: regions.js and REGION_ROWS below) and its landmarks' plans
// (landmarks.js: Hollowmere in C1a, the other 15 in C1b). check-world validates it. (content/index.js is frozen, so
// the world's other files are reached from here.)
import { TERRAINS } from "./terrains.js";
import { REGIONS } from "./regions.js";
import { LANDMARKS as AUTHORED_LANDMARKS, PLANS } from "./landmarks.js";

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
  '111111111112222223334444444566656777666777', // 15
  '111111111112222223334444444566676777666777', // 16
  '111111111112222223333344444566666776666777', // 17
  '111122211112222223333344444466666766666777', // 18
  '211111111122222233333344444456666666666777', // 19
  '221111111222222233333344444455555666666777', // 20
];

// The regions (content/world/regions.js; C1a): one letter per span, REGION_KEY below. docs/c1.md "Region ids" has the
// rules that place them, and check-world holds every span to those rules: a landmark is in its terrain's region, a
// road or a river in its own, the Old Cuts are theirs, any other land span next to the Glass Sea is the Glass Shore,
// and the rest are their terrain's (& and ~ by x).
export const REGION_ROWS = [
  'wwwwwwpppppppppppppeeqqqqqqqqqqqqlllllllll', // 0
  'wwwwwwpppppppppppppeeqqqqqqqqqqqqlllllllll', // 1
  'wwwwwwpppppppppppppeeeqqqqqqqqqqqlllllllll', // 2
  'wwwwwwpppppppppppppeeeqqqqqxqqqqqqllllllll', // 3
  'wwwwwppppppppppppppeeeqqqqqxqqqqqqhhhhllll', // 4
  'wwwwwpppppppppppppaeeeqqqqqxqqqqhhhhllllll', // 5
  'wwwwwpppppppppppppaeeetttttxtthhhhkkllllll', // 6
  'wwwwssssppppppppppaeeetttttxhhhhkkkkklllll', // 7
  'wwwwssssssssdddddaaeeetttttxhhkkkkkkrlllll', // 8
  'wwssssssssssdddddarrerrtthhxhitkkkkkrkkkkk', // 9
  'wwssssssssssdddddareeerhhhhxtitkkkkkrkkkkk', // 10
  'wwsssssssssdddddaareeerrtttrrrrrrrrrrkkkkk', // 11
  'wwssssssssrdrrrrrrreeettttttbibybbbkrkkkkk', // 12
  'wwsssssssrrddddaaddeeetttttbbggyggbbrkkkkk', // 13
  'wwssssssrrsdccdadddeeettttbbgggygggbbkkkkk', // 14
  'wwfffffrrffdddaaddddeettttbggggyggggbkkkkk', // 15
  'wwffffrrfffdddadddddeettttbgggggggggbkkkkk', // 16
  'wwfffffffffddaadddddddttttbggggggggbbkkkkk', // 17
  'wwwfmmmffffddaddddddddttttbbggggggbbkkkkkk', // 18
  'wwwffffffffddaddddddddtttttbbggggbbkkkkkkk', // 19
  'wwwffffffffddaddddddddttttttbbbbbbkkkkkkkk', // 20
];
export const REGION_KEY = {
  f: "flats", m: "hollowMere", w: "waste", s: "steps", d: "downs", p: "pleatwood", q: "deepPleat", t: "tessellate",
  h: "shade", k: "stacks", c: "oldCuts", l: "lattice", e: "teeth", g: "glassSea", b: "glassShore",
  r: "oldRule", x: "straightCut", y: "glassCauseway", a: "slake", i: "inkrun",
};

// The landmarks (§15.3): letter, id, name, tier, kind, and the terrain they stand in (§5's headings);
// dungeon: the floors' levels, in order, from the top (§15.3's "Dungeon" column; `up` for floors
// above ground); gimmicks and beats: §15.3's "Gimmick key" and "Beats" columns, as data (C1 builds the
// gimmicks and decides which belong to the dungeon's DungeonSpec.gimmicks). Their plans and people come in C1.
const floors = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
export const LANDMARK_INDEX = [
  { letter: "A", id: "hollowmere", name: "Hollowmere", at: [[5, 16]], tier: 1, terrain: "flats", kind: "startVillage",
    gimmicks: ["flatTemple"], beats: "prologue, S1-S3, beat 1",
    dungeon: { id: "keepersStair", floors: floors(2, 21), optional: true, legacy: true } },
  { letter: "B", id: "dialFloor", name: "The Dial Floor", at: [[5, 15]], tier: 1, terrain: "flats", kind: "stele",
    gimmicks: ["threeAccounts"], beats: "S4" },
  { letter: "C", id: "kettleMesa", name: "Kettle Mesa", at: [[6, 14]], tier: 1, terrain: "steps", kind: "dungeon",
    gimmicks: ["shaftDrop"], beats: "S1, beat 1",
    dungeon: { id: "kettleMesa", floors: floors(2, 4) } },
  { letter: "D", id: "benchmark", name: "Benchmark", at: [[11, 12]], tier: 2, terrain: "downs", kind: "hub",
    gimmicks: ["trueLevel"], beats: "2, 9",
    dungeon: { id: "datum", floors: floors(5, 8) } },
  { letter: "E", id: "tallTable", name: "The Tall Table", at: [[8, 9]], tier: 2, terrain: "steps", kind: "aerie",
    gimmicks: ["climbUp"], beats: "optional" },
  { letter: "F", id: "molar", name: "Molar", at: [[20, 9]], tier: 3, terrain: "teeth", kind: "passTown",
    gimmicks: ["borrowedDark", "darkMapping"], beats: "3",
    dungeon: { id: "rootCanals", floors: floors(8, 9) } },
  { letter: "G", id: "folio", name: "Folio", at: [[24, 15]], tier: 4, terrain: "tessellate", kind: "flatTown",
    gimmicks: ["mapOnlyTown"], beats: "4" },
  { letter: "H", id: "halfnight", name: "Halfnight", at: [[24, 11], [25, 11], [26, 11]], tier: 4, terrain: "tessellate", kind: "holyCity",
    gimmicks: ["lightIsLaw", "mystery"], beats: "6" },
  { letter: "I", id: "pressyard", name: "The Pressyard", at: [[23, 7]], tier: 4, terrain: "tessellate", kind: "dungeon",
    gimmicks: ["pressing", "loweringCeiling"], beats: "5",
    dungeon: { id: "press", floors: floors(11, 15) } },
  { letter: "J", id: "unlitChoir", name: "The Unlit Choir", at: [[31, 6]], tier: 6, terrain: "shade", kind: "dungeon",
    gimmicks: ["theDark", "darkMapping"], beats: "7",
    dungeon: { id: "unlitChoir", floors: floors(15, 20) } },
  { letter: "K", id: "metronome", name: "The Metronome", at: [[37, 13]], tier: 6, terrain: "stacks", kind: "dungeon",
    gimmicks: ["oneBeat"], beats: "8",
    dungeon: { id: "metronome", floors: floors(17, 22) } },
  { letter: "L", id: "drownedLantern", name: "The Drowned Lantern", at: [[31, 16]], tier: 7, terrain: "sea", kind: "dungeon",
    gimmicks: ["tideOfHours"], beats: "optional (ending 3)",
    dungeon: { id: "drownedLantern", floors: floors(20, 24), optional: true } },
  { letter: "M", id: "square", name: "The Square", at: [[27, 2]], tier: 6, terrain: "deepPleat", kind: "citadel",
    gimmicks: ["identicalRooms", "ruleBanners"], beats: "10",
    dungeon: { id: "square", floors: floors(19, 21), up: floors(22, 23) } },
  { letter: "N", id: "gnomon", name: "The Gnomon", at: [[37, 3]], tier: 8, terrain: "lattice", kind: "needle",
    gimmicks: ["sweepingHand"], beats: "11",
    dungeon: { id: "dialWorks", floors: floors(23, 30) } },
  { letter: "O", id: "saltpage", name: "Saltpage", at: [[2, 4]], tier: 3, terrain: "waste", kind: "monastery",
    gimmicks: ["answerInFloor"], beats: "optional (ending 4)",
    dungeon: { id: "underPage", floors: floors(8, 10), optional: true } },
  { letter: "P", id: "foldmother", name: "Foldmother", at: [[12, 4]], tier: 3, terrain: "pleatwood", kind: "treeVillage",
    gimmicks: ["twoLayouts"], beats: "optional",
    dungeon: { id: "rootfold", floors: floors(8, 10), optional: true } },
];

// The landmark dungeons (C1b; bible §5, §15.3): what world/sites.js landmarkDungeon reads beside the floors, by dungeon
// id. gimmicks (every floor) or floorGimmicks (floor by floor) are gen/dungeon.js GIMMICKS ids, the bible's gimmick key
// mapped onto what the generator builds (GIMMICK_KEYS, below), and `cast` those that place its inhabitants (§5's lists)
// beyond its keys; theme a DUNGEON_THEMES id; named the floors' names; cradle the floors with a Truing Cradle; vaultPool
// the puzzle rooms its floors draw; bottom what its last floor holds that the code builds today (the Metronome's
// Escapement stands in the Colossus's hall, the pattern the bible builds it on). `planned` is what the bible gives the
// dungeon that the code doesn't build yet (integration requests): its true bottom (a legend, a relic, a boss), a hall on
// a floor that isn't the last (`vaults`: { floor: vault id | { hall, guardian } }), its own inhabitants (`creatures`:
// [kind, weight] rows by C3's ids, in place of its region's), each floor's headroom, the murals' words, a day and a night
// layout, the tide, the floors up, floors opened by a beat, a second way out, a clue.
const LANDMARK_DUNGEONS = {
  kettleMesa: { theme: "horn", floorGimmicks: [["collapsed", "flatland"], ["collapsed", "spikeworks"], ["flooded"]], cast: ["flatland"],   // (the first flatlings)
    named: ["Kettle Mesa, the Rim", "Kettle Mesa, the Ledges", "Kettle Mesa, the Kettle's Bottom"],
    planned: { bottom: { kind: "legend", id: "grubMother", name: "the Grub Mother", species: "brineGrub", template: "plain" },
               creatures: [["brineGrub", 4], ["saltrat", 3], ["rustbackScav", 2], ["flatling", 2]],
               daylight: [1], vaults: { 2: "flatLie" }, culvert: { from: 3, to: "hollowmere" }, softFalls: true,
               clue: { floor: 3, what: "a fresh sapper tunnel with an Assize plumb-seal in it (beat 1's clue)" } } },
  datum: { theme: "deepwright", floorGimmicks: [["murals"], ["murals", "allDeep"], ["murals", "allDeep"], ["murals", "allDeep"]], vaultPool: ["trueLevel"],   // (the true level's puzzle: B2, C1b #10)
    named: ["the Datum, the Gauge Room", "the Datum, the Plate Hall", "the Datum, the Long Level", "the Datum, the Stone"],
    planned: { bottom: { kind: "reading", id: "datumStone", name: "the Datum stone", plinth: 2 }, opensAtBeat: { 3: 2, 4: 2 },
               // (the true level's own sill and plates carry the numbers: gen/vaults.js trueLevel; these say how to read them)
               murals: [{ text: "ALL HEIGHTS FROM THE DATUM. MEASURE THE SILL; STAND ON ITS NUMBER.", map: "The Survey's rule, in brass letters: the true plate is as high as the sill." }] } },
  rootCanals: { theme: "deepwright", gimmicks: ["lightless", "flooded", "haunted"],
    named: ["the Root Canals, the Upper Cut", "the Root Canals, the Smugglers' Run"],
    planned: { darkMapping: true, creatures: [["chandlerGuard", 3], ["lampHound", 3], ["shade", 1]],
               exit: { floor: 2, to: "molar", at: "the canals' far mouth (molar.js X), east of the checkpoint" } } },
  press: { theme: "gears", floorGimmicks: [["flatland"], ["flatland"], ["flatland", "spikeworks", "oneBeat"], ["flatland", "spikeworks", "oneBeat"], ["spikeworks", "oneBeat"]],
    named: ["the Press, the Feed Floor", "the Press, the Pressing Rooms", "the Press, the Beat Floor", "the Press, the Low Floor", "the Press-hall"],
    planned: { bottom: { kind: "boss", id: "pressMaster", name: "Press-Master Sevrin Marr-Orrum", with: "the Press, its three pistons on gantries 3 to 5 blocks up" },
               creatures: [["pressHound", 3], ["mosaicGolem", 2], ["erratum", 1], ["assizer", 1]],
               headroom: [6, 5, 4, 3, null], pressedRooms: true, captive: { floor: 3, who: "toviHallen" } } },
  unlitChoir: { theme: "shade", gimmicks: ["lightless", "haunted", "braziers", "runeDoors"],
    named: ["the Unlit Choir, the Narthex", "the Unlit Choir, the Nave", "the Unlit Choir, the Quire", "the Unlit Choir, the Warden's Crypt",
            "the Unlit Choir, the Undercroft", "the Unlit Choir, Noon's Floor"],
    planned: { bottom: { kind: "boss", id: "noon", name: "Noon", flat: true, darkOnly: true },
               vaults: { 4: { hall: "warden", guardian: "gloamWarden" } },   // the Gloom Warden's hall, C3's Gloam Warden in it
               creatures: [["lamplessChanter", 3], ["shade", 3], ["wraith", 2], ["longshadow", 1]], darkMapping: true, runeDoors: true } },
  metronome: { theme: "gears", gimmicks: ["spikeworks", "oneBeat", "offBeatDoors"], cradle: [1],
    named: ["the Metronome, the Casting Floor", "the Metronome, the Gear Floor", "the Metronome, the Rack Floor", "the Metronome, the Spring Floor",
            "the Metronome, the Bob Floor", "the Metronome, the Escapement"],
    bottom: { kind: "guardian", id: "colossus" },
    planned: { bottom: { kind: "boss", id: "escapement", name: "the Escapement", pattern: "colossus" },
               creatures: [["draughtsman", 3], ["beatSpider", 3], ["lensSentry", 2]], offBeatDoors: true } },
  drownedLantern: { theme: "glass", gimmicks: ["flooded"],
    named: ["the Drowned Lantern, the Tide Door", "the Drowned Lantern, the Oil Store", "the Drowned Lantern, the Wet Stair",
            "the Drowned Lantern, the Sunken Gallery", "the Drowned Lantern, the Noonglass Dais"],
    planned: { bottom: { kind: "relic", id: "noonglass", name: "the Noonglass", dryOnlyAtNoon: true },
               legend: { floor: 5, id: "drownedBellwether", name: "the Drowned Bellwether" }, tide: { dry: [11, 13], rise: 1, every: 2, max: 4 },
               creatures: [["glassCrab", 3], ["mirrorEel", 2], ["slagSalamander", 2]] } },
  square: { theme: "deepwright", gimmicks: ["murals", "identicalRooms"], cradle: [1],   // (planned.theme "rule": B2, C1b #20)
    named: ["the Square, the Hall Below", "the Square, the Cells", "the Square, the Deep Cells"],
    planned: { up: ["the Square, the Rule Floor", "the Square, the Hierarch's Floor"], identicalRooms: true, ruleBanners: true, freeFittings: true,
               theme: "rule",   // one material: every room the same in 3D
               prisoners: { floors: [2, 3], who: "pressed prisoners: talked to and freed on the map, by turning their press-wheels in 3D" },
               creatures: [["plumbknight", 3], ["assizer", 2]] } },
  dialWorks: { theme: "gears",
    floorGimmicks: Array.from({ length: 8 }, (_, k) => (k % 2 === 0 ? ["allDeep", "spikeworks", "oneBeat"] : ["flatland", "spikeworks", "oneBeat"])),
    named: ["the Dial-works, the Great Wheel", "the Dial-works, the Train", "the Dial-works, the Fusee", "the Dial-works, the Mainspring",
            "the Dial-works, the Escape Wheel", "the Dial-works, the Pallets", "the Dial-works, the Hand's Root", "the Noon Socket"],
    planned: { bottom: { kind: "boss", id: "vesper", name: "Vesper" }, sweepingHand: { period: 40 },
               door: { hours: [11, 13], or: ["the Plumb Key", "the Cube turned on the threshold (10 max HP, for good)", "Hierarch Strade as an ally"] },
               creatures: { odd: [["latticeTroll", 2], ["askewAngle", 3], ["fold", 3]], even: [["smoother", 3], ["burnisher", 3], ["planarQueen", 1]] } } },
  underPage: { theme: "salt", gimmicks: ["murals"], vaultPool: ["mosaicHall"],   // (the Speaking Door is floor 2's alone: planned.vaults)
    named: ["the Under-Page, the First Leaf", "the Under-Page, the Speaking Door", "the Under-Page, the Founding"],
    planned: { bottom: { kind: "relic", id: "pressedFounding", name: "the Pressed's founding relic", hour: 2, with: "a Second-Hour stele with all three accounts; a reading that names Vesper" },
               vaults: { 2: "speakingDoor" }, creatures: [["tileMimic", 2], ["flatling", 2], ["pressedPilgrim", 1]] } },
  rootfold: { theme: "horn", gimmicks: ["allDeep"],
    named: ["the Rootfold, the Upper Roots", "the Rootfold, the Fold", "the Rootfold, the Heartroot"],
    planned: { layouts: { day: [6, 18], night: [18, 6] }, foldLanding: 1,
               creatures: [["pleatSpider", 3], ["creasebeetle", 3], ["sporeling", 2], ["hangvine", 1]] } },
};
for (const l of LANDMARK_INDEX) if (l.dungeon && LANDMARK_DUNGEONS[l.dungeon.id]) Object.assign(l.dungeon, LANDMARK_DUNGEONS[l.dungeon.id]);
// §15.3's gimmick keys, each mapped onto what builds it (C1b; check-landmarks holds every landmark dungeon's gimmicks to
// the union of its keys'): gimmicks, the GIMMICKS a dungeon's floors play; vaults, the puzzle rooms it draws; surface,
// what its plan builds; code, what still needs code (docs/c1.md "C1b: integration requests").
export const GIMMICK_KEYS = {
  flatTemple: { gimmicks: [], surface: "the parent's Temple of Angles, its walls forcing the map (C1a)" },
  threeAccounts: { gimmicks: [], surface: "the Dial Floor's three readings: the mosaic (map), the relief (3D, lit), the rune (3D, dark)", code: "the run's Fifth-Hour event and its nearest site" },
  shaftDrop: { gimmicks: ["collapsed", "spikeworks", "flooded"], vaults: ["flatLie"], code: "a fall down the shaft is exactly one floor, unhurt; floor 1 in daylight; the culvert to the temple's well" },
  trueLevel: { gimmicks: ["murals", "allDeep"], code: "the plate whose map number is the sill's 3D height opens the door; the Datum stone read on its plinth" },
  climbUp: { gimmicks: [], surface: "the Tall Table's climb: steps, two sprinting jumps, ghost planks; perches with nests (zone.perches)", code: "a nest on the map over a perch the map draws as wall; kites carrying to the perches" },
  borrowedDark: { gimmicks: ["lightless", "flooded", "haunted"], code: "the canals' Chandler lamps locked; a lit torch wakes the watch and its lamp-hounds" },
  darkMapping: { gimmicks: [], code: "the map records every tile you step on, even unlit" },
  mapOnlyTown: { gimmicks: [], surface: "Folio drawn in mosaic, its archive a blank stone box", code: "the archive's drawn door (floor on the map, wall in 3D)" },
  lightIsLaw: { gimmicks: [], surface: "Halfnight's rows (plan.areas): the Lampless north row, the Hour-house", code: "trespass by torch in each, and the north row's permanent night" },
  mystery: { gimmicks: [], code: "Who Lit the Hush? (C5, beat 6)" },
  pressing: { gimmicks: ["flatland", "spikeworks", "oneBeat"], code: "pressed rooms unpressed by turning on their centre; plates that press you flat for 10 s" },
  loweringCeiling: { gimmicks: [], code: "headroom 6, 5, 4 and 3 blocks, then the tall Press-hall" },
  theDark: { gimmicks: ["lightless", "haunted", "braziers", "runeDoors"], code: "the Unlit seen only with your torch out" },
  oneBeat: { gimmicks: ["spikeworks", "oneBeat", "offBeatDoors"], code: "machines acting on the beat" },
  tideOfHours: { gimmicks: ["flooded"], code: "dry 11:00-13:00, the water up a block every 2 hours to 4; the waterline on the map" },
  identicalRooms: { gimmicks: ["murals", "identicalRooms"], code: "a lattice of identical rooms (built: one material, each room's mark in the floor, the prisoners' places and press-wheels, the floors up); patrols' straight traces on the map" },
  ruleBanners: { gimmicks: [], code: "banners that make a 12-tile Trued zone" },
  sweepingHand: { gimmicks: ["allDeep", "spikeworks", "oneBeat", "flatland"], code: "the inner hand's shadow, a turn every 40 s, pressing flat what it covers" },
  answerInFloor: { gimmicks: ["murals"], vaults: ["mosaicHall", "speakingDoor"] },
  twoLayouts: { gimmicks: ["allDeep"], code: "a day and a night layout of each floor, by the hour you enter it" },
};

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
  // The Inkrun is ink (bible §4.7, §13.7): its ink pools stain whoever wades through them (gen/ports.js carries a
  // river's liquid to both sides of every edge it crosses).
  { id: "inkrun", width: 3, liquid: "ink", path: span([[29, 9], [29, 10], [29, 11], [29, 12], [29, 13]]) },
];

// The terrain counts of §15.1's legend (checked by check-world). The legend's 47 `~` are the Glass Sea's 44 and the
// Hollow Mere's 3 (its own terrain, terrains.js `mere`).
export const TERRAIN_COUNTS = { flats: 42, waste: 73, steps: 61, downs: 85, pleatwood: 101, deepPleat: 65, tessellate: 78,
  stacks: 109, shade: 24, lattice: 60, teeth: 44, sea: 44, mere: 3, river: 23, road: 52, landmarks: 18 };

// The world, in the schema of TECH_DESIGN §2.18 (compiled by world/worldmodel.js). A terrainKey entry is a terrain id, or a list of
// { from?, to?, id } ranges over x for a glyph that means two terrains (the Pleatwood west of the Teeth and the Deep
// Pleat east of them; the Hollow Mere west of the Teeth and the Glass Sea east of them). Landmark letters stand on the
// terrain LANDMARK_INDEX names.
const terrainKey = {
  ",": "flats", ".": "waste", "=": "steps", ";": "downs", "&": [{ to: 18, id: "pleatwood" }, { from: 21, id: "deepPleat" }],
  "+": "tessellate", "#": "stacks", "%": "shade", "*": "lattice", "^": "teeth", "~": [{ to: 6, id: "mere" }, { from: 27, id: "sea" }],
  "\"": "river", ":": "road",
};
for (const l of LANDMARK_INDEX) terrainKey[l.letter] = l.terrain;

export const WORLD = {
  id: "gnomon", version: 3, w: 42, h: 21, name: "the Long Noon",   // (2: C1a's regions and Hollowmere; 3: C1b's landmark plans; a real-world run saved before them doesn't restore; integrator, C1a #6, C1b #16)
  terrain: WORLD_ROWS, terrainKey,
  tiers: TIER_ROWS,                       // the tier of every span (bible §4.5); a region's tier is its lowest
  regions: REGION_ROWS, regionKey: REGION_KEY,
  landmarkKey: Object.fromEntries(LANDMARK_INDEX.map((l) => [l.letter, l.id])),
  roads: ROADS, rivers: RIVERS,
  start: "hollowmere",
};
// Everything compileWorld needs. A landmark is LANDMARK_INDEX's entry, with what landmarks.js gives it (its plan,
// footprint and words; C1a: Hollowmere, C1b the other 15, which stand on stub footprints until then). A landmark
// dungeon's floors are listed level by level; the legacy flag marks the Keeper's Stair, which is the parent game's
// 20-level stack.
export { TERRAINS, REGIONS, PLANS };
const AUTHORED = new Map(AUTHORED_LANDMARKS.map((l) => [l.id, l]));
export const LANDMARKS = LANDMARK_INDEX.map((l) => ({ id: l.id, name: l.name, at: l.at[0], spans: l.at, tier: l.tier, kind: l.kind,
  plan: null, checkpoint: l.kind === "startVillage", dungeon: l.dungeon || null, ...(AUTHORED.get(l.id) || {}) }));
export const REAL_WORLD = { world: WORLD, terrains: TERRAINS, regions: REGIONS, landmarks: LANDMARKS, plans: PLANS };
