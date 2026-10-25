// The story: Hollowmere, the Temple of Angles, the Rotation Cube, and Vorlath the Lich King.
//
// You start in the temple (the surface of world tile 0, 0) seeing the world the only way anyone in Hollowmere ever
// has: flat, from above (the map view). On the altar of the lower sanctum lies the Rotation
// Cube. Touch it, and the world turns: the camera swings down into first person, and from
// then on Tab rotates you between the two ways of seeing.
import { Zone, B, FLOOR_Z, ROOM_TOP } from "./world.js";
import { makeRng, distance } from "./rng.js";
import { stampVault } from "./gen/vaults.js";
import { makeItem } from "./items.js";
import { spawnNpc } from "./npcs.js";
import { layoutSpikes } from "./traps.js";

export const LICH_COLOR = [140, 255, 170];

export const INTRO = [
  { title: "THE ROTATION CUBE", text: "In the village of Hollowmere, the world has always been flat.\n\nNot flat like a field. Flat like a drawing. North and south, east and west: that is all there is, and all there has ever been. When the people of Hollowmere look at the world, they see it the way you'd see a map: from above, all at once.\n\nThey have never once wondered what \"above\" means." },
  { text: "You are the youngest keeper of the Temple of Angles, the oldest building in the village.\n\nFor three nights now, something deep under the temple has been shaking the floor. Tonight the old priestess, Maren, has sent for you." },
  { title: "HOW TO PLAY", text: "You see the world from above, one step at a time. Nothing moves until you do.\n\nWASD or arrow keys: take a step. Walk into someone to talk, into a monster to fight, into a door or lever to use it.\nClick a tile: walk there.   Space: wait a moment (near spike traps: until their next beat).\nI: inventory.   J: journal.   M: music on/off.   N: sounds on/off.   Hover over anything to see what it is.\n\nMaren is in the main hall, just south of your room." },
];

export const CUBE_PAGES = [
  { text: "The cube turns in your hands, and the world turns with it.\n\nThe floor tilts away beneath you. The walls rise up, and up, and keep on rising. There is a direction you have never seen before. It goes UP.\n\nFor the first time in your life you are standing inside the world, instead of looking down on it." },
  { text: "Then, from very far below, a voice like dry pages turning:\n\n\"So. Someone has found the cube. A child of Hollowmere, no less. How quaint.\n\nI am Vorlath. I went to the bottom of the world and learned what your priests forgot: a world can be folded. Three into two. Two into one.\n\nHollowmere will make a lovely line.\"", color: LICH_COLOR },
  { title: "HOW TO PLAY: DEPTH", text: "Mouse: look around.   WASD: walk.   Shift: sprint.   Space: jump.\nLeft click: attack.   E: use, or talk.   T or right click: throw.   F: torch on/off.\n\nTab rotates between the two ways of seeing:\n  from above: the map. Turn by turn, the whole floor at once, and the flat things.\n  from inside: 3D. Height and depth, light and darkness, and the things that only show up close.\n\nYou'll need both. Maren will want to know what happened." },
];

// What Vorlath has to say as you go deeper (logged the first time you reach each floor).
export const TAUNTS = {
  1: "You step off the last stair into the dark below the temple. Somewhere far down, something is laughing.",
  5: "A voice like dry pages fills your head: \"Little keeper. Did you think the cube chose you? It chose the nearest pair of hands.\"",
  10: "\"Halfway down. Do you know what a line is, keeper? A village with no room left in it.\"",
  15: "\"I can feel my cube getting closer. Bring it to me. I'll make it quick: one dimension at a time.\"",
};

export const FINAL_PAGES = [
  { text: "The air down here is thin and strange, as if the world has been pressed flat between the pages of a book.\n\nSomewhere ahead, in a hall of pillars, a voice:\n\n\"Ah. The keeper. Come in, come in. And do bring my cube.\"", color: LICH_COLOR },
];

export const EPILOGUE = [
  { text: "Vorlath crumbles into a heap of very ordinary, very three-dimensional dust.\n\nFor a long moment the dungeon is silent. Then, far above you, a bird you have never heard before begins to sing." },
  { text: "You climb all twenty floors back up to the temple. Maren is waiting, and so is Hollowmere: flat as ever, and perfectly happy about it.\n\nNobody else in the village will ever see what you have seen. But on quiet evenings you take the cube down from its shelf, give it a little turn, and look up." },
  { title: "THE END", text: "Thank you for playing." },
];

// --- The Temple of Angles (the legacy site's surface zone), drawn by hand ---------------------------------------------
//   ,  wooden floor   b  a bed   @  where you wake up   M  Maren   C  marble column
//   ^  spike floor    A  the altar, with the cube on it   X  the wall that opens when you take it
//   o  stepping stone (O: a block higher)   >  stairs down into the dungeon
// (plus the vault legend in gen/vaults.js: # wall, . floor, ~ chasm, D door, G gate, L lever, l lamp)
export function buildTemple(seed) {
  const rng = makeRng((seed ^ 0x7e3a1e) >>> 0);
  const g = Array.from({ length: 45 }, () => Array(44).fill("#"));
  const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  const at = (x, y, ch) => { g[y][x] = ch; };

  rect(1, 1, 7, 4, ","); at(1, 1, "b"); at(7, 1, "b"); at(4, 3, "@");          // your room
  at(4, 5, "D"); at(4, 6, "."); at(4, 7, ".");
  rect(1, 8, 15, 17, "."); at(8, 10, "M");                                       // the main hall
  for (const [x, y] of [[3, 10], [13, 10], [3, 15], [13, 15]]) at(x, y, "C");
  for (const [x, y] of [[0, 10], [0, 15], [16, 9], [16, 16]]) at(x, y, "l");
  at(16, 12, "D");
  rect(17, 11, 28, 13, "."); rect(19, 11, 26, 13, "^");                          // the spike hall
  at(21, 10, "l"); at(25, 14, "l");
  at(29, 12, "D");
  rect(30, 7, 40, 17, ".");                                                      // the mosaic room
  for (const x of [32, 35, 38]) at(x, 6, "L");
  for (const [x, y] of [[29, 9], [41, 10], [41, 15], [29, 15]]) at(x, y, "l");
  at(35, 18, "G"); at(35, 19, "."); at(35, 20, ".");
  rect(29, 21, 41, 31, "."); at(35, 26, "A");                                    // the lower sanctum
  at(35, 32, "X");
  rect(31, 33, 39, 42, "~"); rect(31, 33, 39, 33, "."); rect(31, 41, 39, 42, ".");   // the shaft
  at(35, 35, "o"); at(35, 37, "O"); at(35, 39, "o"); at(35, 42, ">");
  at(30, 36, "l"); at(40, 38, "l");

  const plan = g.map((row) => row.join(""));
  const f = new Zone({ key: "0,0,0", wx: 0, wy: 0, z: 0, type: "surface", level: 0, tier: 1, seed, w: 48, d: 48, h: 10,
                       name: "The Temple of Angles" });
  f.blocks.fill(B.ROCK);
  const ox = 2, oy = 2;
  stampVault(f, { plan, height: 4, wall: B.STONE, floorBlock: B.TILE, links: [] }, ox, oy, rng);

  const cells = (ch) => { const out = []; plan.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) out.push([x + ox, y + oy]); })); return out; };
  for (const [x, y] of cells(",")) f.set(x, y, FLOOR_Z - 1, B.PLANK);
  for (const [x, y] of cells("b")) { f.set(x, y, FLOOR_Z - 1, B.PLANK); f.set(x, y, FLOOR_Z, B.CRATE); }
  for (const [x, y] of cells("C")) for (let z = FLOOR_Z; z < ROOM_TOP; z++) f.set(x, y, z, B.COLUMN);
  for (const [x, y] of cells("O")) f.set(x, y, FLOOR_Z, B.STONE);
  const [[sx, sy]] = cells("@");
  f.spawn = { x: sx + 0.5, y: sy + 0.5, z: FLOOR_Z, yaw: Math.PI / 2 };
  const [[mx, my]] = cells("M");
  f.npcs.push(spawnNpc("maren", mx, my, FLOOR_Z, 0));
  f.returnPoint = { x: mx + 0.5, y: my + 2.5, z: FLOOR_Z, yaw: -Math.PI / 2 };   // coming back up: in front of Maren
  const [[ax, ay]] = cells("A");
  f.set(ax, ay, FLOOR_Z, B.ALTAR);
  f.items.push(makeItem({ kind: "cube" }, ax + 0.5, ay + 0.5, FLOOR_Z + 1));
  const [[tx, ty]] = cells(">");
  f.set(tx, ty, FLOOR_Z - 1, B.STAIRS);
  f.stairs = { x: tx, y: ty };
  f.cubeWall = cells("X");
  for (const [x, y] of f.cubeWall) for (let z = FLOOR_Z; z < ROOM_TOP; z++) f.set(x, y, z, B.STONE);

  // The spike hall: a slow wave, easy enough when you take it one beat at a time.
  layoutSpikes(f, cells("^"), rng, "wave-x", 4, 1);   // rolling east, the way you walk: follow it

  // The mosaic room: three levers, and a golden arrow in the floor pointing at the right one.
  const levers = cells("L");
  const right = rng.pick(levers);
  const gate = cells("G").flatMap(([x, y]) => [[x, y, FLOOR_Z], [x, y, FLOOR_Z + 1]]);
  for (const [x, y] of levers)
    f.links.set(f.index(x, y, FLOOR_Z + 1), x === right[0]
      ? { action: "open", cells: gate }
      : { action: "dud", msg: "The lever clanks, and nothing happens. (Maren said the floor tells the way.)" });
  const ax0 = right[0], top = oy + 7;   // the arrow's tip is just in front of the lever
  const arrow = [[0, 1], [-1, 2], [0, 2], [1, 2], [-2, 3], [-1, 3], [0, 3], [1, 3], [2, 3], ...[4, 5, 6, 7, 8, 9].map((d) => [0, d])];
  for (let y = oy + 7; y <= oy + 17; y++)
    for (let x = ox + 30; x <= ox + 40; x++) if (rng.chance(0.18)) f.set(x, y, FLOOR_Z - 1, rng.chance(0.5) ? B.MOSAIC_BLUE : B.MOSAIC_RED);
  for (const [dx, dy] of arrow) f.set(ax0 + dx, top + dy, FLOOR_Z - 1, B.MOSAIC_GOLD);

  // The sanctum: open to the sky, with a ring of white mosaic around the altar.
  for (let y = oy + 21; y <= oy + 31; y++)
    for (let x = ox + 29; x <= ox + 41; x++) {
      for (let z = FLOOR_Z + 4; z < f.h; z++) f.set(x, y, z, B.AIR);
      const d = distance(x - ax, y - ay);
      if (d > 2.2 && d < 3.4) f.set(x, y, FLOOR_Z - 1, B.MOSAIC_WHITE);
      else if (d >= 3.4 && d < 4.3 && (Math.round(Math.atan2(y - ay, x - ax) * 4) & 1)) f.set(x, y, FLOOR_Z - 1, B.MOSAIC_BLUE);
    }
  f.hasSky = true;
  f.rooms = [];
  f.temple = true;
  f.refresh();
  return f;
}

// The cube is taken: the wall behind the altar grinds aside, showing the way down.
export function openCubeWall(zone) {
  for (const [x, y] of zone.cubeWall || []) for (let z = FLOOR_Z; z < ROOM_TOP; z++) zone.set(x, y, z, B.AIR);
  zone.refresh();
}
