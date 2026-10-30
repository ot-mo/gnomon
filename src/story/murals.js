// Murals: history's accounts set into the world, learned by looking (TECH_DESIGN §2.14; bible §8.5; owner WS7).
//
//   zone.murals = [{ x, y, z, view: "map" | "3d" | "dark", text, secret? }]   laid by whoever builds the zone (WS10's
//                 Hour sites and murals gimmick, 7b's village mosaics): "map" a floor mosaic (the Flat Account),
//                 "3d" a carved relief (the Deep Inscription), "dark" a rune (the Dark Gloss). secret: the id it
//                 teaches; without one, the history account whose text it is (secrets.js muralSecret).
//   muralsAt(zone, x, y) → [mural]      the murals a tile shows: its own; else the nearest "map" mural up to 2 tiles along
//                                       the row through unbroken mosaic (a tablet: WS10 lays them 3 and 5 wide)
//   readable(game, zone, m) → bool      a mosaic only on the map; a relief only in 3D, in light; a rune only in 3D, in
//                                       the dark (your torch out)
//   readMural(game, ev) → [id]          on `inspect` { zone, x, y, z, open } (WS8's look cursor sends open: true, a map
//                                       hover held 0.5 s open: false): each readable mural there is read into the log
//                                       and its secret learned (source "mural"). The only way a mural teaches anything:
//                                       drawing and describing never do (R2).
// The describer "murals" puts a mosaic's text on the map's inspect line, and says what a relief or rune needs. Pure.
//
// A landmark's three registers (bible §2.1 rule 3; B2, C1b #4), from the run's world (landmarks' `lines`):
//   landmarkAt(game, zone, x, y) → landmark | null   the landmark whose plan the tile is part of (its surface zone, the
//                                       plan's footprint: zone.gen.planAt)
//   registerLine(game, L) → the line the view you're in reads: Flat on the map, Deep in 3D, Dark in 3D with your torch out
// The describer "murals" ends with the Flat line on the map's inspect line over the plan; a look in 3D at it (WS8's L:
// inspect open) logs the Deep line, or the Dark one with your torch out. (The world map's panel shows the Flat line too:
// overworld/renderWorld.js spanLines.)
import { on } from "../events.js";
import { BLOCKS } from "../blocks.js";
import { inDark } from "../light.js";
import { registerDescriber } from "../renderMap.js";
import { learnSecret, muralSecret } from "./secrets.js";
import { knows } from "./journal.js";
import { dialFloorReading } from "../content/world/plans/dialFloor.js";

const isMosaic = (zone, x, y, z) => !!BLOCKS[zone.get?.(x, y, z)]?.mosaic;

export function muralsAt(zone, x, y) {
  const all = zone?.murals || [];
  const own = all.filter((m) => m.x === x && m.y === y);
  if (own.length) return own;   // a mural on the tile itself wins over a neighbour's tablet
  // A tablet: an unbroken row of mosaic from this tile to the mural, at most TABLET tiles away (WS10 lays 3 and 5 wide).
  const unbroken = (m) => { for (let k = Math.min(x, m.x); k <= Math.max(x, m.x); k++) if (!isMosaic(zone, k, y, m.z)) return false; return true; };
  const near = all.filter((m) => m.view === "map" && m.y === y && Math.abs(m.x - x) <= TABLET && unbroken(m));
  return near.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x)).slice(0, 1);
}
const TABLET = 2;

export function readable(game, zone, m) {
  if (m.view === "map") return game.view === "map";
  if (game.view !== "3d") return false;
  // A relief is cut into a wall: the light that matters is the air in front of it (any side, or its own cell).
  const dark = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => inDark(game, zone, m.x + dx + 0.5, m.y + dy + 0.5, m.z + 0.5));
  return m.view === "dark" ? dark && !game.player?.torch : !dark;
}

const NEEDS = {
  map: "From up close it's only coloured tiles. It would read from above, on the map.",
  "3d": "Something is carved here in relief. It would read in 3D, in good light.",
  dark: "Thin lines are cut into the stone, too faint for any light. They might read in the dark.",
};
const SAYS = { map: "The mosaic reads:", "3d": "The carving reads:", dark: "In the dark, the cuts read:" };

export function readMural(game, ev) {
  const zone = ev?.zone || game.zone, learned = [];
  for (const m of muralsAt(zone, ev?.x, ev?.y)) {
    if (!readable(game, zone, m)) {
      if (ev.open) game.log?.(NEEDS[m.view] || NEEDS.map, [170, 170, 185]);
      continue;
    }
    const id = m.secret || muralSecret(game.run, m.text);
    const fresh = id && !knows(game, id);
    if (ev.open || fresh || !id) game.log?.(`${SAYS[m.view] || SAYS.map} "${m.text}"`, [230, 210, 150]);
    if (fresh && learnSecret(game, id, "mural")) learned.push(id);
  }
  return learned;
}

on("inspect", (game, ev) => { readMural(game, ev); readLandmark(game, ev); });

export function landmarkAt(game, zone, x, y) {
  const pa = zone?.gen?.planAt;
  if (!zone?.landmarkId || zone.z !== 0 || !pa || x < pa.x || y < pa.y || x >= pa.x + pa.w || y >= pa.y + pa.d) return null;
  return game.run?.world?.landmarks?.get(zone.landmarkId) || null;
}
export function registerLine(game, L) {
  const lines = L?.lines;
  if (!lines) return null;
  if (game.view === "map") return flatLine(game, L);
  // The Dark line in the dark: your torch out where no daylight or lamp reaches you (as a rune reads), else the Deep one.
  const p = game.player, dark = !!p && !p.torch && !!game.zone && inDark(game, game.zone, p.x, p.y, p.z + 1);
  return (dark ? lines.dark : lines.deep) || null;
}
// A landmark's Flat line with the run's numbers in it: the Dial Floor's pips and bearing are its history's (B2, C1b #11).
export function flatLine(game, L) {
  const flat = L?.lines?.flat || null;
  if (!flat || L.id !== "dialFloor") return flat;
  const r = dialFloorReading(game.run, L.wx, L.wy);
  return r ? flat.replace(/Pips \d+/, `Pips ${r.pips}`).replace(/bearing [a-z-]+/, `bearing ${r.bearing}`) : flat;
}

function readLandmark(game, ev) {
  if (!ev?.open || game.view !== "3d") return;
  const L = landmarkAt(game, ev.zone || game.zone, ev.x, ev.y), line = registerLine(game, L);
  if (line) game.log?.(line.split("\n").join(" / "), line === L?.lines?.dark ? [175, 165, 230] : [215, 205, 180]);
}

// The map's inspect line: a mosaic reads plainly from above; a relief or a rune only says it's there.
// (The landmark's Flat line ends this describer's part: P0's check-hud holds the describers' list.)
registerDescriber("murals", (game, tile, { zone }) => {
  const ms = muralsAt(zone, tile.x, tile.y);
  const said = ms.map((m) => (m.view === "map" ? `A mosaic: "${m.text}"` : m.view === "3d" ? "A carved relief (read it in 3D)." : null)).filter(Boolean);
  const flat = game.view === "map" ? registerLine(game, landmarkAt(game, zone, tile.x, tile.y)) : null;
  if (flat) said.push(flat);
  return said.join(" ") || null;
}, { order: 40 });
