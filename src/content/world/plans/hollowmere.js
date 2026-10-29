// Hollowmere (bible §5 A, §9.4 "Brine Flats"; §15.3 A: (5, 16), tier 1, the start): the stilt village of reed thatch
// round the Temple of Angles. The temple is the parent game's plan, stamped as it is (content/world/temple.js;
// DECISIONS: Hollowmere's sanctum reuses it), with the Keeper's Stair (the parent's 20 levels, world/legacy.js) under it
// in the parent's frame, as on the test world. The village stands east of the temple's front door, where the Old Rule
// comes in; the brine beds lie south of it, towards the Hollow Mere.
//
// The plan is the zone's columns 0..77 by rows 0..47 (landmarks.js anchors it at the zone's corner). The letters:
//   .  the ground as the world made it (the footprint is flattened; the Old Rule reaches the porch over it)
//   T  the Temple of Angles (44 × 45, its corner at (2, 2)): stampTemple draws it, with its own letters
//   ,  boardwalk (plank at the datum)          ~  brine, shallow (the zone's liquid is the Flats' brine)
//   #  a house's wall of thatch (the crypt's: stone)   h  a house's plank floor   D  its door   U  a rune in the wall
//   L  the commons lamp (a lamp on a plank post)       x  a glimseed press (a crate on the floor)
//   r g s  reeds, glimseed reeds, a salt bloom (props)
//   people (floor where each stands; landmarks.js says who: C5 writes their words, and they are placed once their
//   kinds exist):  a Mira  b Brother Tamsin  c Brann's ghost (the crypt)  e Reeve Hallen  i Old Ottilie
//   j Sir Corwin  n Pell  o Ess and Tee  q Corner, the temple cat. Maren is the temple's own M.
// A house stands on stilts a block above the datum (bible §9.4: "reed houses on stilts 1 block above the brine, with
// boardwalks"): its floor and door are one step up from the boardwalk, its roof a slab of thatch. On the map the
// boardwalks are floor and the beds shallow water; in 3D the houses stand up out of the reeds.
import { B, FLOOR_Z } from "../../../world.js";
import { makeRng, seedFor } from "../../../rng.js";
import { stampVault, registerLegend } from "../../../gen/vaults.js";
import { TEMPLE_PLAN, stampTemple } from "../temple.js";

// "keep": a plan cell left as the generator made it (the temple's cells, which stampTemple draws, and the open
// ground the roads cross).
registerLegend("keep", () => {});

export const HOLLOWMERE_ROWS = [
  "..............................................................................", // 0
  "..................................................................######......", // 1
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#######..######...#hhhh#..r...", // 2
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhh#..#hhhh#..sUhhch#......", // 3
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhahh#..#hhbh#...#hhhh#..s...", // 4
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhh#..#hhhh#...#hhhh#......", // 5
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhh#..###D##...##D###.r....", // 6
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..###D###.....,.......,.........", // 7
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,,,,,,....,######...", // 8
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,,,,,,.r..,#hhjh#...", // 9
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,,,,,,....,#hhhh#...", // 10
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,L,,,,,,,,,....,##D###...", // 11
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.q,,,,,,,,,,,,,,,,....,.....r...", // 12
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT................................", // 13
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT................................", // 14
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT................................", // 15
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,,,,,,.....##D###...", // 16
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,o,,,,,,,,xxxxx,,.....#hhhh#...", // 17
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,n,,,,.....#hhhh#...", // 18
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.,,,,,,,,,,,,,,,,,.....#hhhh#...", // 19
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..........,,........r..######...", // 20
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..####D###,,..###D###...........", // 21
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhhh#,,..#hhhhh#........r..", // 22
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhehhh#,,..#hhihh#..##D###...", // 23
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhhh#,,..#hhhhh#..#hhhh#...", // 24
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhhh#,,..#hhhhh#..#hhhh#...", // 25
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..########,,..#######..#hhhh#...", // 26
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.r........,,...........######...", // 27
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.........s,,r........r..........", // 28
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..######..,,....................", // 29
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhh#..,,.,,,,,,,,......s....", // 30
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhhD,,,,.,xx,,xx,...........", // 31
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..#hhhh#..,,.,,,,,,,,...........", // 32
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..######..,,............r...r...", // 33
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..........,,...........~~~~~~...", // 34
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.g.g..g..g,,.~~~~~~~~.g~~~~~~...", // 35
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.~~~~~~~~~,,g~~~~~~~~g.~~~~~~g..", // 36
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTg~~~~~~~~~,,.~~~~~~~~..~~~~~~...", // 37
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.~~~~~~~~~,,g~~~~~~~~g.~~~~~~...", // 38
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..", // 39
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.~~~~~~~~~...~~~~~~~~..~~~~~~g..", // 40
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTg~~~~~~~~~g..g...,.g..g~~~~~~...", // 41
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.~~~~~~~~~....r.g,..r...........", // 42
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..r.g...r........,......rg.r....", // 43
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTr....r.g...r.....,..............", // 44
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT.s.............s..........s.....", // 45
  "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT................................", // 46
  "..............................................................................", // 47
];
const TEMPLE_AT = [2, 2];   // the temple plan's corner in this plan
// The houses: where each stands in the plan, and its walls.
export const HOLLOWMERE_HOUSES = [
  { id: "mira", x: 48, y: 2, w: 7, d: 6, wall: B.THATCH }, { id: "tamsin", x: 57, y: 2, w: 6, d: 5, wall: B.THATCH },
  { id: "crypt", x: 66, y: 1, w: 6, d: 6, wall: B.STONE }, { id: "corwin", x: 69, y: 8, w: 6, d: 4, wall: B.THATCH },
  { id: "cotA", x: 69, y: 16, w: 6, d: 5, wall: B.THATCH }, { id: "hallen", x: 48, y: 21, w: 8, d: 6, wall: B.THATCH },
  { id: "ottilie", x: 60, y: 21, w: 7, d: 6, wall: B.THATCH }, { id: "cotB", x: 69, y: 23, w: 6, d: 5, wall: B.THATCH },
  { id: "cotC", x: 48, y: 29, w: 6, d: 5, wall: B.THATCH },
];
export const HOLLOWMERE_PEOPLE = ["a", "b", "c", "e", "i", "j", "n", "o", "q"];
const PEOPLE_FLOOR = Object.fromEntries(HOLLOWMERE_PEOPLE.map((ch) => [ch, "plankFloor"]));
// What every letter is, for the plan as a whole (check-content reads it); each pass below stamps its own part.
const LEGEND = { ".": "keep", T: "keep", ",": "plankFloor", "~": "shallow", L: "station", x: "rubble", h: "floor",
                 r: "prop", g: "prop", s: "prop", ...PEOPLE_FLOOR };
const PROPS = { r: "reeds", g: "glimseed", s: "saltBloom" };
// The ground pass leaves the houses to their own stamps.
const GROUND = { ...LEGEND, "#": "keep", D: "keep", h: "keep", U: "keep", ...Object.fromEntries(HOLLOWMERE_PEOPLE.map((ch) => [ch, "keep"])),
                 o: "plankFloor", n: "plankFloor", q: "plankFloor" };
const HOUSE = { h: "floor", ...Object.fromEntries(HOLLOWMERE_PEOPLE.map((ch) => [ch, "floor"])) };

// Stamp it with its corner at (ox, oy). rng is the temple's (the parent's puzzle for the run's seed, TEMPLE_PLAN.rng),
// spent on the temple alone; the village draws nothing. Returns { spawn, stairs, keyPoints }.
export function stampHollowmere(zone, ox, oy, rng) {
  const out = stampTemple(zone, ox + TEMPLE_AT[0], oy + TEMPLE_AT[1], rng, { roof: "slab" });
  const still = makeRng(seedFor(zone.seed, "hollowmere"));   // (stampVault wants one; no letter here draws from it)
  stampVault(zone, { name: "Hollowmere", plan: HOLLOWMERE_ROWS, height: 4, wall: B.PLANK, floorBlock: B.SALT, links: [],
                     legend: GROUND, props: PROPS, rubble: B.CRATE }, ox, oy, still, { roof: "none" });
  for (const h of HOLLOWMERE_HOUSES) {
    const plan = HOLLOWMERE_ROWS.slice(h.y, h.y + h.d).map((r) => r.slice(h.x, h.x + h.w));
    stampVault(zone, { name: `Hollowmere, ${h.id}`, plan, height: 4, wall: h.wall, floorBlock: B.PLANK, links: [], legend: HOUSE },
               ox + h.x, oy + h.y, still, { roof: "slab", wallHeight: 4, baseZ: FLOOR_Z + 1 });
  }
  const keyPoints = [...out.keyPoints];
  HOLLOWMERE_ROWS.forEach((row, y) => [...row].forEach((ch, x) => { if (HOLLOWMERE_PEOPLE.includes(ch)) keyPoints.push({ x: ox + x, y: oy + y }); }));
  return { spawn: out.spawn, stairs: out.stairs, keyPoints };
}

export const HOLLOWMERE_PLAN = {
  id: "hollowmere", name: "Hollowmere", rows: HOLLOWMERE_ROWS, legend: LEGEND, props: PROPS, rubble: B.CRATE,
  height: 4, wall: B.THATCH, floorBlock: B.PLANK, roof: "slab",
  keys: [...TEMPLE_PLAN.keys, ...HOLLOWMERE_PEOPLE],
  entranceGated: true,   // the Keeper's Stair waits behind the temple's puzzle, as in the parent game
  at: [0, 0],            // the plan's corner in the footprint
  dungeonAt: [0, 0],     // the legacy levels' 48 × 48 frame: the temple's at (2, 2) inside it, as the parent had it
  hub: [46, 14],         // where the Old Rule arrives: in front of the temple's porch
  sinkholes: false,      // nobody falls into the Keeper's Stair
  rng: TEMPLE_PLAN.rng,  // the temple's puzzle is the parent's for the same seed
  stamp: (zone, ox, oy, rng) => stampHollowmere(zone, ox, oy, rng),
};
