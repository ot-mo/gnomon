// Hand-made puzzle rooms ("vaults"), stitched into generated floors.
// Each is drawn top-down, one character per column of blocks:
//
//   #  wall               .  floor              ~  chasm (bottomless: fall to the next floor)
//   _  trap floor         1 2 3  floor raised by that many blocks
//   L  lever in the wall  R  lever with a rune carved above it (it only shows in the dark!)
//   U  rune wall          G  iron gate (opened by a lever, or by solving the room)
//   D  door               K  locked door        l  wall with a lamp
//   p  ghost planks over a chasm (solid, but only visible with your torch out)
//   F  a cold brazier     5 6 7 8  wall with the numeral 1 2 3 4 carved in it (dark only)
//   E  entrance (exactly one, on the border; a corridor connects here)
//   !  random potion   ?  random scroll   k  key   h  heart crystal   S  strength crystal
//   )  weapon   [  armour (suited to the depth, more likely blessed)   r g s  rat / goblin / skeleton
//   *  treasure (mostly gear or a scroll; now and then a crystal)   $  a pile of gold
//   B  the boss, on a one-block dais
//   Y  a lever (one with its own link letter: the right one, in the mosaic hall)
//   Q  the Speaking Door's stone face   ^  spike floor (traps.js; the vault says which pattern)
//   Z  the guardian (the vault says which)   >  stairs down   f  a brazier (no puzzle)
//   y  a flatling
// A plan can also come with mosaics: [[x, y, block]] laid into the floor after stamping.
// Each letter is a named legend handler (DEFAULT_LEGEND below); a plan can map its own letters
// with `legend: { ch: handlerId }`, and other modules add handlers with registerLegend.
//
// links: which lever letter does what to the target letter's tiles (see interact.js):
//   open: remove them (gates) | part: one of `need` levers that together open them
//   pit: drop the floor away | summon: monsters appear there | gas: poison gas
// hint: logged the first time you step inside.
import { B, FLOOR_Z, ROOM_TOP } from "../world.js";
import { makeRng } from "../rng.js";
import { spawnMonster } from "../monsters.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomTreasure } from "../items.js";
import { spawnNpc } from "../npcs.js";
import { layoutSpikes } from "../traps.js";

export const VAULTS = [
  {
    // 3 to 5 levers that all look the same. One right lever opens the gate, or several must
    // all be pulled; any other springs a trap. Nothing in the room says which is which: the
    // record is somewhere else on the floor (dungeon.js addLeverRecord), either a carved mural
    // in another room's wall (it shows only in the dark) or a row of floor tiles in another
    // room (it reads only on the map).
    id: "runeLever", name: "The Rune Lever", height: 4, wall: B.STONE, floorBlock: B.TILE,
    build: runeLeverPlan,
    hint: "A row of levers, all alike, and nothing to tell them apart. Whoever built this must have kept a record of the right ones... somewhere else.",
  },
  {
    // Levers on the far wall again, and trap floor in front of them. This time the answer is
    // written in the floor: a golden arrow pointing at the right lever. From above it's
    // obvious. At eye level it's a jumble of faded tiles.
    id: "mosaicHall", name: "The Mosaic Hall", height: 4, wall: B.STONE, floorBlock: B.TILE,
    build: mosaicHallPlan,
    hint: "More levers, and a floor of coloured tiles. From down here the tiles are just a jumble.",
  },
  {
    // On the map: an open room with treasure in the far corner. In 3D: it's a chasm,
    // and the only way across is a narrow winding path.
    id: "flatLie", name: "The Flat Lie", height: 4, wall: B.MOSS, floorBlock: B.ROCK,
    plan: [
      "############",
      "#~~~~~~~~.*#",
      "#~~~~~~~~.)l",
      "#~~~~~....~#",
      "#~~~~~.~~~~#",
      "#~~~...~~~~#",
      "#~~~.~~~~~~#",
      "#~...~~~~~~#",
      "#~.~~~~~~~~#",
      "#...~~~~~~~#",
      "##E#########",
    ],
    links: [],
  },
  {
    // Treasure beyond a field of spike traps keeping a rhythm. On the map you can watch the
    // pattern and step through it turn by turn; in 3D it's nerve and timing (or a good jump).
    id: "gauntlet", name: "The Gauntlet", height: 4, wall: B.BRICK, floorBlock: B.TILE,
    build: gauntletPlan,
    hint: "Treasure gleams beyond a floor full of holes. Listen: tk... tk... tk. The rhythm never stops.",
  },
  {
    // A dark room of cold braziers. Light them in the order of the numerals carved behind
    // them: you read the numerals in the dark, but you need your torch lit to light a fire.
    id: "braziers", name: "The Braziers", height: 4, wall: B.BRICK, floorBlock: B.TILE,
    build: brazierPlan,
    hint: "Cold braziers stand in a row. Something is carved into the wall behind them.",
  },
  {
    // A stone face beside a gate asks for a number. The number is written across the hall's
    // floor in giant mosaic digits, which you can only really read from above.
    id: "speakingDoor", name: "The Speaking Door", height: 4, wall: B.STONE, floorBlock: B.TILE,
    build: speakingDoorPlan,
    hint: "A hall of faded tiles, and a stone face beside a gate. The face seems to be waiting for something.",
  },
  {
    // A lightless maze with something in it. Your torch shows a few steps;
    // the map (which only fills in as you go) is how you keep your bearings.
    id: "darkMaze", name: "The Dark Maze", height: 2, wall: B.MOSS, floorBlock: B.ROCK,
    build: mazePlan,
    links: [],
  },
  {
    // A chasm with treasure on the far side, and a winding bridge of ghost planks that
    // only shows with your torch out. The map, of course, shows only the chasm.
    id: "unseenPath", name: "The Unseen Path", height: 4, wall: B.STONE, floorBlock: B.ROCK,
    build: unseenPathPlan,
    hint: "A chasm, and treasure on the far side. They say the old builders made bridges only the dark can see.",
  },
];

// A rectangular plan from a function of (x, y).
const grid = (w, d, fn) => Array.from({ length: d }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y)).join(""));
const mirror = (plan) => plan.map((row) => [...row].reverse().join(""));

// The rune lever room: levers along the back wall, trap floor in front of them, the
// treasure behind a gate on one side.
function runeLeverPlan(rng) {
  const n = rng.int(3, 5);
  const k = rng.chance(0.5) ? 1 : rng.int(2, n - 1);
  const marked = new Set(rng.shuffle([...Array(n).keys()]).slice(0, k));
  const w = 2 * n + 3;   // hall: wall, 2n+1 floor columns, wall (the gate goes in this one)
  let plan = grid(w + 3, 6, (x, y) => {
    const inner = x >= 1 && x <= 2 * n + 1;
    if (x >= w - 1) {   // the gate and the alcove behind it
      if (y === 2 || y === 3) return x === w - 1 ? "G" : x === w + 2 ? "#" : y === 2 ? "*."[x - w] : "?!"[x - w];
      return "#";
    }
    if (y === 1) return x >= 2 && x <= 2 * n && x % 2 === 0 ? (marked.has(x / 2 - 1) ? "Y" : "L") : "#";
    if (y === 2 || y === 3) return inner ? "_" : "#";
    if (y === 4) return inner ? "." : x === 0 ? "l" : "#";
    if (y === 5) return x === n + 1 ? "E" : "#";
    return "#";
  });
  if (rng.chance(0.5)) plan = mirror(plan);
  const trap = rng.pick(["pit", "pit", "summon", "gas"]);
  return {
    plan, leverRecord: true,
    links: [
      k === 1 ? { lever: "Y", action: "open", target: "G" } : { lever: "Y", action: "part", target: "G", group: "runes", need: k },
      { lever: "L", action: trap, target: "_" },
    ],
  };
}

// Scatter faded red and blue tiles over a rectangle, so the real picture hides among them in 3D.
function speckle(rng, mosaics, x0, y0, x1, y1, chance, taken) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (!taken.has(`${x},${y}`) && rng.chance(chance)) mosaics.push([x, y, rng.chance(0.5) ? B.MOSAIC_RED : B.MOSAIC_BLUE]);
}
const mirrorMosaics = (mosaics, w) => mosaics.map(([x, y, b]) => [w - 1 - x, y, b]);

// The mosaic hall: like the rune lever room, but taller, with an arrow in the floor.
function mosaicHallPlan(rng) {
  const n = rng.int(3, 4), right = rng.int(0, n - 1);
  const w = 2 * n + 3, d = 13;
  let plan = grid(w + 3, d, (x, y) => {
    const inner = x >= 1 && x <= 2 * n + 1;
    if (x >= w - 1) {
      if (y === 2 || y === 3) return x === w - 1 ? "G" : x === w + 2 ? "#" : y === 2 ? "*$"[x - w] : "?!"[x - w];
      return "#";
    }
    if (y === 1) return x >= 2 && x <= 2 * n && x % 2 === 0 ? (x / 2 - 1 === right ? "Y" : "L") : "#";
    if (y === 2 || y === 3) return inner ? "_" : "#";
    if (y >= 4 && y <= d - 2) return inner ? "." : x === 0 && (y === 6 || y === 10) ? "l" : "#";
    if (y === d - 1) return x === n + 1 ? "E" : "#";
    return "#";
  });
  // The arrow: tip just past the trap floor, pointing at the right lever's column.
  const cx = 2 * (right + 1), mosaics = [], taken = new Set();
  const arrow = [[0, 4], [-1, 5], [0, 5], [1, 5], [-2, 6], [-1, 6], [0, 6], [1, 6], [2, 6], ...[7, 8, 9, 10].map((y) => [0, y])];
  for (const [dx, y] of arrow) {
    const x = cx + dx;
    if (x < 1 || x > 2 * n + 1) continue;
    mosaics.push([x, y, B.MOSAIC_GOLD]); taken.add(`${x},${y}`);
  }
  speckle(rng, mosaics, 1, 4, 2 * n + 1, d - 2, 0.22, taken);
  const flip = rng.chance(0.5);
  if (flip) plan = mirror(plan);
  const trap = rng.pick(["pit", "summon", "gas"]);
  return {
    plan, mosaics: flip ? mirrorMosaics(mosaics, w + 3) : mosaics,
    links: [{ lever: "Y", action: "open", target: "G" }, { lever: "L", action: trap, target: "_" }],
  };
}

// The gauntlet: a field of spike traps between the way in and the treasure.
function gauntletPlan(rng) {
  const w = 13, d = 12;
  const plan = grid(w, d, (x, y) => {
    if (y === 0 || x === 0 || x === w - 1) return (y === 2 || y === 9) && y !== 0 ? "l" : "#";
    if (y === d - 1) return x === 6 ? "E" : "#";
    if (y === 1) return { 3: "*", 6: "$", 9: rng.chance(0.5) ? "!" : "?" }[x] || ".";
    if (y >= 3 && y <= 8) return "^";
    return ".";
  });
  return { plan, links: [], spikes: rng.pick(["wave-x", "wave-y", "diagonal", "checker", "ripple"]) };
}

// The speaking door: a hall with a giant digit in the floor, a gate to a treasure alcove,
// and the stone face that wants to hear the digit.
const DIGITS = {
  2: ["###", "..#", "###", "#..", "###"], 3: ["###", "..#", "###", "..#", "###"], 4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "###", "..#", "###"], 6: ["###", "#..", "###", "#.#", "###"], 7: ["###", "..#", "..#", "..#", "..#"],
  8: ["###", "#.#", "###", "#.#", "###"], 9: ["###", "#.#", "###", "..#", "###"],
};
function speakingDoorPlan(rng) {
  const answer = rng.int(2, 9);
  const plan = [
    "##############",
    "#####*?$.#####",
    "######GG######",
    "#....Q.......#",
    ...Array.from({ length: 12 }, (_, k) => (k === 2 || k === 8 ? "l............l" : "#............#")),
    "######E#######",
  ];
  // The digit, twice life size (6 × 10 tiles), in gold inside a white frame.
  const mosaics = [], taken = new Set();
  DIGITS[answer].forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== "#") return;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const x = 4 + i * 2 + dx, y = 5 + j * 2 + dy;
      mosaics.push([x, y, B.MOSAIC_GOLD]); taken.add(`${x},${y}`);
    }
  }));
  for (let x = 2; x <= 11; x++) for (const y of [4, 15]) { mosaics.push([x, y, B.MOSAIC_WHITE]); taken.add(`${x},${y}`); }
  for (let y = 5; y <= 14; y++) for (const x of [2, 11]) { mosaics.push([x, y, B.MOSAIC_WHITE]); taken.add(`${x},${y}`); }
  speckle(rng, mosaics, 3, 5, 10, 14, 0.18, taken);
  const others = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9].filter((v) => v !== answer)).slice(0, 3);
  return { plan, links: [], mosaics, door: { answer, choices: rng.shuffle([answer, ...others]) } };
}

// The brazier room: no lamps; braziers in a row with a numeral carved in the wall behind each.
function brazierPlan(rng) {
  const n = rng.int(3, 4);
  const order = rng.shuffle([1, 2, 3, 4].slice(0, n));   // the numeral behind each brazier, left to right
  const w = 2 * n + 3;
  let plan = grid(w + 3, 6, (x, y) => {
    const inner = x >= 1 && x <= 2 * n + 1;
    if (x >= w - 1) {
      if (y === 2 || y === 3) return x === w - 1 ? "G" : x === w + 2 ? "#" : y === 2 ? "*!"[x - w] : "?."[x - w];
      return "#";
    }
    const slot = x >= 2 && x <= 2 * n && x % 2 === 0;
    if (y === 0) return slot ? String(4 + order[x / 2 - 1]) : "#";
    if (y === 2) return slot ? "F" : inner ? "." : "#";
    if (y >= 1 && y <= 4) return inner ? "." : "#";
    if (y === 5) return x === n + 1 ? "E" : "#";
    return "#";
  });
  if (rng.chance(0.5)) plan = mirror(plan);
  return { plan, links: [] };
}

// The unseen path: a winding line of ghost planks from the entrance ledge up to a
// treasure platform on the far side.
function unseenPathPlan(rng) {
  const w = 11, d = 10;
  const g = Array.from({ length: d }, (_, y) => Array.from({ length: w }, (_, x) =>
    x === 0 || x === w - 1 || y === 0 || y === d - 1 ? "#" : "~"));
  g[d - 1][5] = "E";
  for (let x = 4; x <= 6; x++) g[d - 2][x] = ".";   // the ledge you come in on
  const tx = rng.int(2, w - 3);
  for (let x = tx - 1; x <= tx + 1; x++) g[1][x] = ".";   // the far platform
  g[1][tx] = "*";
  g[1][tx + (rng.chance(0.5) ? 1 : -1)] = rng.chance(0.5) ? "?" : "!";
  // Walk up row by row, sidestepping now and then, laying planks.
  let x = 5;
  for (let y = d - 3; y >= 2; y--) {
    const to = y === 2 ? tx : Math.max(1, Math.min(w - 2, x + rng.int(-3, 3)));
    for (let xx = Math.min(x, to); xx <= Math.max(x, to); xx++) g[y][xx] = "p";
    x = to;
  }
  g[3][0] = "l"; g[6][w - 1] = "l";
  return { plan: g.map((row) => row.join("")), links: [] };
}

// Boss halls (the last level of a dungeon whose bottom is a boss). The legacy stack's last level:
// a pillared hall where the Lich King waits on its dais.
const LICH_THRONE = {
  id: "lich", name: "The Lich's Throne", height: 4, wall: B.STONE, floorBlock: B.TILE,
  plan: [
    "#########l#########",
    "#.................#",
    "#..l#....1....#l..#",
    "#..##...111...##..#",
    "#......11B11......#",
    "l.......111.......l",
    "#........1........#",
    "#..#l.........l#..#",
    "#..##..s...s..##..#",
    "#.................#",
    "#.................#",
    "#..##.........##..#",
    "#..l#.........#l..#",
    "#.................#",
    "#########E#########",
  ],
  links: [],
};
export const BOSS_HALLS = { lich: LICH_THRONE };

// The guardians' halls (in the legacy stack on levels 5, 10 and 15; guardians.js): the guardian in the middle, and
// the stairs down in an alcove behind a gate that opens when it dies.
const hallTop = (w) => {
  const pad = (n) => "#".repeat(n);
  const side = (w - 5) / 2;
  return [pad(w), pad(side) + "..>.." + pad(side), pad(side) + "....." + pad(side), pad(side + 1) + "GGG" + pad(side + 1)];
};
const hallBottom = (w) => "#".repeat((w - 1) / 2) + "E" + "#".repeat((w - 1) / 2);
export const GUARDIAN_HALLS = {
  flatqueen: {
    id: "flatqueen", name: "The Flat Queen's Court", height: 4, wall: B.STONE, floorBlock: B.TILE, guardian: "flatqueen",
    hint: "A wide, bare hall. On the map, something enormous is drawn on the floor... and it's moving.",
    plan: [...hallTop(17),
      "#...............#", "l...............l", "#...............#", "#...............#", "#.......Z.......#", "#...............#",
      "#...............#", "l...............l", "#...............#", "#...............#", hallBottom(17)],
  },
  warden: {
    id: "warden", name: "The Gloom Warden's Hall", height: 4, wall: B.MOSS, floorBlock: B.ROCK, guardian: "warden",
    hint: "A dark hall with cold braziers in its corners. Your torchlight shows nothing else, but something is breathing.",
    plan: [...hallTop(17),
      "#...............#", "#..f.........f..#", "#...............#", "#...............#", "#.......Z.......#", "#...............#",
      "#...............#", "#..f.........f..#", "#...............#", "#...............#", hallBottom(17)],
  },
  colossus: {
    id: "colossus", name: "The Colossus's Hall", height: 6, wall: B.BRICK, floorBlock: B.TILE, guardian: "colossus",
    hint: "A towering hall. In the middle stands a statue of a giant, with a glowing stone set in its head... and its eyes just opened.",
    plan: [...hallTop(19),
      "#.................#", "l.................l", "#.....1.....1.....#", "#......2...2......#", "#........Z........#",
      "#......2...2......#", "#.....1.....1.....#", "l.................l", "#.................#", hallBottom(19)],
  },
};

// Any vault or hall by its id.
export function vaultById(id) {
  return VAULTS.find((v) => v.id === id) || GUARDIAN_HALLS[id] || BOSS_HALLS[id] || null;
}

// A vault ready to stamp: its plan built (the puzzle rooms roll theirs), with its size.
export function buildVault(v, rng) {
  const built = v.build ? v.build(rng) : { plan: v.plan, links: v.links };
  const { plan, links = [], ...extra } = Array.isArray(built) ? { plan: built } : built;
  return { ...v, ...extra, plan, links, w: plan[0].length, d: plan.length };
}

// Which vault a dungeon level gets (p: the level's parameters, gen/dungeon.js):
//   p.forcedVault        that one (the legacy stack's fixed sequence, a site's own hall)
//   p.final + p.bottom   the bottom's hall: { kind: "guardian", id } or { kind: "boss", id }
//   otherwise            a pick from p.vaultPool (ids, or [id, weight]; default every puzzle vault),
//                        keeping vaults whose `levels` range holds p.level. Equal weights draw
//                        exactly as rng.pick does, so the legacy stack's random vaults don't move.
export function pickVault(rng, p = {}) {
  let v = p.forcedVault ? vaultById(p.forcedVault) : null;
  if (!v && p.final && p.bottom) v = (p.bottom.kind === "guardian" ? GUARDIAN_HALLS : BOSS_HALLS)[p.bottom.id] || null;
  if (!v) {
    const level = p.level ?? 1;
    const pool = (p.vaultPool || VAULTS.map((o) => o.id))
      .map((e) => (Array.isArray(e) ? { v: vaultById(e[0]), w: e[1] } : { v: vaultById(e), w: 1 }))
      .filter(({ v: o }) => o && (!o.levels || (level >= o.levels[0] && level <= o.levels[1])));
    if (!pool.length) throw new Error(`no vault fits level ${level}`);
    if (pool.every((e) => e.w === pool[0].w)) v = pool[Math.floor(rng() * pool.length)].v;
    else {
      let pick = rng() * pool.reduce((s, e) => s + e.w, 0);
      v = pool.find((e) => (pick -= e.w) < 0)?.v || pool[pool.length - 1].v;
    }
  }
  return buildVault(v, rng);
}

// --- Stamping ---------------------------------------------------------------------------------
// Write a vault into a zone with its top-left corner at (vx, vy). Returns the entrance tile and
// the direction a corridor should leave it in.
//   opts.roof        "rock" (solid above the room: underground), "none" (open to the sky above the
//                    walls and the room) or "slab" (a one-block roof at the room's height)
//   opts.wallHeight  wall blocks from the floor up (default ROOM_TOP − FLOOR_Z = 4)
//   opts.baseZ       the feet height of the vault's floor (default FLOOR_Z, the datum)
//   opts.cosmetic    an rng for creature looks, kept apart from the layout rng (a fixed one if not given)
// The defaults stamp every legacy vault exactly as before (tests/fixtures/golden/vaults.json).
export const STAMP_DEFAULTS = { roof: "rock", wallHeight: ROOM_TOP - FLOOR_Z, baseZ: FLOOR_Z };

// The letter map. Anything not listed is plain floor ("floor"): . _ ^ and plan-specific letters.
export const DEFAULT_LEGEND = {
  "#": "wall", "~": "chasm", "1": "step1", "2": "step2", "3": "step3", L: "lever", Y: "lever", Q: "speakingDoor",
  R: "runeLever", U: "rune", G: "gate", D: "door", K: "locked", l: "lamp", p: "ghostPlanks", F: "brazierPuzzle",
  "5": "numeral1", "6": "numeral2", "7": "numeral3", "8": "numeral4", B: "boss", Z: "guardian", ">": "stairs",
  f: "brazier", E: "entrance", "!": "potion", "?": "scroll", k: "key", h: "heart", $: "gold", S: "strength",
  ")": "weapon", "[": "armour", "*": "treasure", r: "rat", g: "goblin", s: "skeleton", y: "flatling",
};

const LEGEND = {};
// Add a named legend handler: fn(ctx) builds the column at (ctx.x, ctx.y). ctx = { zone, x, y,
// px, py, ch, z0 (the floor's feet height), top (first layer above the room), plan, vault, rng,
// cosmetic, cells, opts, out }. Helpers for handlers: wallCol, floorCol, column, roofAt.
export function registerLegend(id, fn) {
  if (LEGEND[id]) throw new Error(`legend handler "${id}" is already registered`);
  LEGEND[id] = fn;
}
export const legendHandlers = () => Object.keys(LEGEND);

// What sits above the room (and above the walls) for each roof.
export function roofAt(c, z) {
  if (c.opts.roof === "none") return B.AIR;
  if (c.opts.roof === "slab") return z === c.top ? c.vault.wall : B.AIR;
  return B.ROCK;
}
export function column(c, fill) { for (let z = 0; z < c.zone.h; z++) c.zone.set(c.x, c.y, z, fill(z)); }
export function wallCol(c) {
  const wallTop = c.z0 + c.opts.wallHeight, slab = c.opts.roof === "slab";
  column(c, (z) => (z < c.z0 ? B.ROCK : z < wallTop || (slab && z <= c.top) ? c.vault.wall : roofAt(c, z)));
}
export function floorCol(c) {
  column(c, (z) => (z === c.z0 - 1 ? c.vault.floorBlock : z >= c.z0 && z < c.top ? B.AIR : z < c.z0 ? B.ROCK : roofAt(c, z)));
}

const at = (c, dz, block) => c.zone.set(c.x, c.y, c.z0 + dz, block);
registerLegend("floor", (c) => floorCol(c));
registerLegend("wall", (c) => wallCol(c));
registerLegend("chasm", (c) => column(c, (z) => (z < c.top ? B.AIR : roofAt(c, z))));   // bottomless: down a level
for (const n of [1, 2, 3])
  registerLegend(`step${n}`, (c) => { floorCol(c); for (let dz = 0; dz < n; dz++) at(c, dz, c.vault.wall); });
registerLegend("lever", (c) => { wallCol(c); at(c, 1, B.LEVER); });
registerLegend("runeLever", (c) => { wallCol(c); at(c, 1, B.LEVER); at(c, 2, B.RUNE); });
registerLegend("rune", (c) => { wallCol(c); at(c, 2, B.RUNE); });
registerLegend("gate", (c) => { wallCol(c); at(c, 0, B.GATE); at(c, 1, B.GATE); });
registerLegend("door", (c) => { wallCol(c); at(c, 0, B.DOOR); at(c, 1, B.DOOR); });
registerLegend("locked", (c) => { wallCol(c); at(c, 0, B.LOCKED); at(c, 1, B.LOCKED); });
registerLegend("lamp", (c) => { wallCol(c); at(c, 2, B.LAMP); });
registerLegend("ghostPlanks", (c) => column(c, (z) => (z === c.z0 - 1 ? B.GHOST : z < c.top ? B.AIR : roofAt(c, z))));
registerLegend("brazierPuzzle", (c) => { floorCol(c); at(c, 0, B.BRAZIER); });
registerLegend("brazier", (c) => { floorCol(c); at(c, 0, B.BRAZIER); });
for (const n of [1, 2, 3, 4]) registerLegend(`numeral${n}`, (c) => { wallCol(c); at(c, 2, B.RUNE_1 + n - 1); });
registerLegend("speakingDoor", (c) => { floorCol(c); c.zone.npcs.push(spawnNpc("door", c.x, c.y, c.z0, c.zone.level)); });
registerLegend("boss", (c) => {
  floorCol(c);
  at(c, 0, c.vault.wall);
  c.zone.monsters.push(spawnMonster(c.vault.boss || "lich", c.x, c.y, c.z0 + 1, "idle", c.zone.level, null, c.cosmetic));
});
registerLegend("guardian", (c) => {
  floorCol(c);
  c.zone.monsters.push(spawnMonster(c.vault.guardian, c.x, c.y, c.z0, "idle", c.zone.level, null, c.cosmetic));
});
registerLegend("stairs", (c) => { floorCol(c); at(c, -1, B.STAIRS); c.zone.stairs = { x: c.x, y: c.y }; });
registerLegend("entrance", (c) => {
  wallCol(c);
  at(c, -1, c.vault.floorBlock); at(c, 0, B.AIR); at(c, 1, B.AIR);
  c.out.entrance = { x: c.x, y: c.y, dx: c.px === 0 ? -1 : c.px === c.plan[c.py].length - 1 ? 1 : 0,
                     dy: c.py === 0 ? -1 : c.py === c.plan.length - 1 ? 1 : 0 };
});
// Things lying on the floor. ")" and "[" ask for a weapon / armour specifically: re-roll until it is one.
const lying = (make, want) => (c) => {
  floorCol(c);
  let it = make(c);
  for (let n = 0; n < 20 && want && it.kind !== want; n++) it = make(c);
  c.zone.items.push(makeItem(it, c.x + 0.5, c.y + 0.5, c.z0));
};
registerLegend("potion", lying((c) => randomPotion(c.rng)));
registerLegend("scroll", lying((c) => randomScroll(c.rng)));
registerLegend("key", lying(() => ({ kind: "key" })));
registerLegend("heart", lying(() => ({ kind: "heart" })));
registerLegend("strength", lying(() => ({ kind: "strength" })));
registerLegend("gold", lying((c) => ({ kind: "gold", amount: c.rng.int(10, 20) + c.zone.level })));
registerLegend("weapon", lying((c) => randomEquipment(c.rng, c.zone.level + 1, 0.15), "weapon"));
registerLegend("armour", lying((c) => randomEquipment(c.rng, c.zone.level + 1, 0.15), "armour"));
registerLegend("treasure", lying((c) => randomTreasure(c.rng, c.zone.level)));
for (const type of ["rat", "goblin", "skeleton", "flatling"])
  registerLegend(type, (c) => { floorCol(c); c.zone.monsters.push(spawnMonster(type, c.x, c.y, c.z0, "wander", c.zone.level, null, c.cosmetic)); });

export function stampVault(zone, vault, vx, vy, rng, opts = {}) {
  const o = { ...STAMP_DEFAULTS, ...opts };
  const cosmetic = o.cosmetic || makeRng((zone.seed ^ Math.imul(vx + 1, 73856093) ^ Math.imul(vy + 1, 19349663)) >>> 0);
  const legend = vault.legend ? { ...DEFAULT_LEGEND, ...vault.legend } : DEFAULT_LEGEND;
  const z0 = o.baseZ, top = z0 + vault.height;   // top: the first layer above the vault's room
  const cells = {};                               // letter → list of [x, y] tiles
  const out = { entrance: null };
  const c = { zone, vault, plan: vault.plan, rng, cosmetic, cells, opts: o, z0, top, out, x: 0, y: 0, px: 0, py: 0, ch: "" };

  vault.plan.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      const ch = row[px];
      c.x = vx + px; c.y = vy + py; c.px = px; c.py = py; c.ch = ch;
      (cells[ch] ||= []).push([c.x, c.y]);
      const handler = LEGEND[legend[ch] || "floor"];
      if (!handler) throw new Error(`no legend handler "${legend[ch]}" for "${ch}" in ${vault.name}`);
      handler(c);
    }
  });

  for (const link of vault.links) {
    const gate = link.action === "open" || link.action === "part";
    const targets = (cells[link.target] || []).flatMap(([x, y]) => (gate ? [[x, y, z0], [x, y, z0 + 1]] : [[x, y]]));
    if (link.action === "part") zone.groups.set(link.group, { need: link.need, pulled: 0, cells: targets });
    for (const [x, y] of cells[link.lever] || [])
      zone.links.set(zone.index(x, y, z0 + 1), { action: link.action, cells: targets, group: link.group });
  }

  // Floor pictures, spike traps, and the Speaking Door's riddle.
  for (const [x, y, b] of vault.mosaics || []) zone.set(vx + x, vy + y, z0 - 1, b);
  if (vault.spikes && cells["^"]) layoutSpikes(zone, cells["^"], rng, vault.spikes);
  if (vault.door) {
    const face = zone.npcs.find((n) => n.type === "door" && n.tx === cells.Q[0][0] && n.ty === cells.Q[0][1]);
    face.state = { ...vault.door, gate: (cells.G || []).flatMap(([x, y]) => [[x, y, z0], [x, y, z0 + 1]]),
                   spawns: (cells["."] || []).filter(([, y]) => y >= vy + 10) };
  }

  // The Rune Lever room: which of its levers are the right ones, left to right as you face them
  // (they're in the north wall, so that's west to east). dungeon.js writes this down elsewhere.
  if (vault.leverRecord)
    zone.leverRecord = [...(cells.Y || []).map(([x]) => [x, true]), ...(cells.L || []).map(([x]) => [x, false])]
      .sort((a, b) => a[0] - b[0]).map(([, right]) => right);

  // A guardian's hall: the gate to the stairs, and (for the Warden) its braziers.
  if (vault.guardian) {
    zone.guardianHall = {
      x0: vx, y0: vy, x1: vx + vault.w - 1, y1: vy + vault.d - 1, type: vault.guardian,
      gate: (cells.G || []).flatMap(([x, y]) => [[x, y, z0], [x, y, z0 + 1]]),
      front: [cells.G[1][0], cells.G[1][1] + 1],
      braziers: cells.f || [],
    };
  }

  // Braziers: each one's number is the numeral carved in the wall straight behind it.
  if (cells.F) {
    const numerals = ["5", "6", "7", "8"].flatMap((ch) => (cells[ch] || []).map(([x]) => [x, Number(ch) - 4]));
    zone.braziers = {
      list: cells.F.map(([x, y]) => ({ x, y, z: z0, n: numerals.find(([nx]) => nx === x)[1] })),
      next: 1, solved: false,
      gate: (cells.G || []).flatMap(([x, y]) => [[x, y, z0], [x, y, z0 + 1]]),
    };
  }
  return out.entrance;
}

// A 13×13 maze (recursive backtracker), with a few extra openings so it has loops.
function mazePlan(rng) {
  const N = 6, S = 2 * N + 1;
  const g = Array.from({ length: S }, () => Array(S).fill("#"));
  const start = [3, N - 1];
  const visited = new Set([start.join()]);
  const stack = [start];
  g[2 * start[1] + 1][2 * start[0] + 1] = ".";
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [cx + dx, cy + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !visited.has(`${x},${y}`));
    if (!options.length) { stack.pop(); continue; }
    const [nx, ny] = rng.pick(options);
    visited.add(`${nx},${ny}`);
    g[cy + ny + 1][cx + nx + 1] = ".";          // the wall between the two cells
    g[2 * ny + 1][2 * nx + 1] = ".";
    stack.push([nx, ny]);
  }
  for (let k = 0; k < 5; k++) {                 // knock out a few walls for loops
    const x = rng.int(1, S - 2), y = rng.int(1, S - 2);
    if ((x + y) % 2 === 1) g[y][x] = ".";
  }
  g[S - 1][2 * start[0] + 1] = "E";

  // Treasure in the farthest corner, monsters roaming the far half.
  const dist = new Map([[`${2 * start[0] + 1},${S - 2}`, 0]]);
  const queue = [[2 * start[0] + 1, S - 2]];
  for (let h = 0; h < queue.length; h++) {
    const [x, y] = queue[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (g[ny]?.[nx] === "." && !dist.has(`${nx},${ny}`)) { dist.set(`${nx},${ny}`, dist.get(`${x},${y}`) + 1); queue.push([nx, ny]); }
    }
  }
  const far = [...dist.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k.split(",").map(Number));
  const [hx, hy] = far[0]; g[hy][hx] = "*";
  const [px, py] = far[1]; g[py][px] = "[";
  const [m1x, m1y] = far[4]; g[m1y][m1x] = "s";
  const [m2x, m2y] = far[Math.floor(far.length / 3)]; g[m2y][m2x] = "g";
  return g.map((row) => row.join(""));
}
