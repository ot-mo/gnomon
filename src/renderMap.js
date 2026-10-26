// The top-down map. It's drawn from what you've SEEN, and it's flat: it shows what
// kind of thing a tile is, but never how high or deep it is. But it's the only place where
// floor mosaics read clearly, where you can see a spike trap's rhythm coming, and where the
// flat beings of the Plane show at all.
// Row 0: controls · row 1: status bar (hud.js) · then the map · last row: tile inspector.
import * as S from "./screen.js";
import { BLOCKS, KIND, FLOOR_Z } from "./world.js";
import { itemGlyph, itemName, withArticle } from "./items.js";
import { planTravel } from "./turns.js";
import { spikeState } from "./traps.js";
import { talkersIn, typeOf } from "./creatures.js";
import { slamState } from "./guardians.js";
import { resistText } from "./combat.js";

export const mapView = { panX: 0, panY: 0, hover: null, tx0: 0, ty0: 0, top: 2 };

const TILE_W = 2;   // characters per tile (cells are ~2× taller than wide)
const LEGEND_W = 30;
const ARROWS = [">", "\\", "v", "/", "<", "\\", "^", "/"];

const GLYPHS = {
  [KIND.FLOOR]:   [".", [125, 120, 110]],
  [KIND.DOOR]:    ["+", [200, 130, 60]],
  [KIND.LOCKED]:  ["+", [240, 200, 80]],
  [KIND.GATE]:    ["|", [160, 165, 185]],
  [KIND.LEVER]:   ["&", [210, 210, 220]],
  [KIND.STAIRS]:  [">", [255, 255, 255]],
  [KIND.STAIRS_UP]: ["<", [190, 220, 255]],
  [KIND.HOLE]:    [":", [95, 80, 140]],    // only once you've looked into it in 3D
  [KIND.SHALLOW]: ["~", [110, 190, 220]],
  [KIND.DEEP]:    ["~", [50, 80, 200]],
  [KIND.BRIDGE]:  ["=", [190, 130, 70]],
};

// How a tile looks on the map, given what you know. Unexplored holes look like floor,
// and so do bridges until you can see what they cross.
function mapKind(zone, x, y) {
  const i = x + y * zone.w;
  const k = zone.kind[i];
  if (k === KIND.HOLE) return zone.holeSeen[i] ? KIND.HOLE : KIND.FLOOR;
  if (k === KIND.BRIDGE) {
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + ox, ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= zone.w || ny >= zone.d) continue;
      const n = nx + ny * zone.w, nk = zone.kind[n];
      if ((nk === KIND.HOLE && zone.holeSeen[n]) || nk === KIND.SHALLOW || nk === KIND.DEEP) return KIND.BRIDGE;
    }
    return KIND.FLOOR;
  }
  return k;
}

export function renderMap(game) {
  S.clear();
  const { zone, player } = game;
  const top = mapView.top;
  const legend = S.cols >= zone.w * TILE_W + LEGEND_W + 4;
  const viewW = Math.floor((S.cols - (legend ? LEGEND_W : 0)) / TILE_W);
  const viewH = S.rows - top - 2;

  // Which tile sits at the top-left of the view: centred if the map fits, else follow the player.
  const pickOrigin = (size, view, at, pan) =>
    size <= view ? -Math.floor((view - size) / 2)
                 : Math.max(0, Math.min(size - view, Math.floor(at - view / 2) + pan));
  const tx0 = pickOrigin(zone.w, viewW, player.x, mapView.panX);
  const ty0 = pickOrigin(zone.d, viewH, player.y, mapView.panY);
  mapView.tx0 = tx0; mapView.ty0 = ty0;
  const toScreen = (tx, ty) => [(tx - tx0) * TILE_W, top + ty - ty0];
  const onScreen = (tx, ty) => tx - tx0 >= 0 && tx - tx0 < viewW && ty - ty0 >= 0 && ty - ty0 < viewH;

  // Tiles
  for (let ty = 0; ty < zone.d; ty++) {
    for (let tx = 0; tx < zone.w; tx++) {
      const i = tx + ty * zone.w;
      if (!zone.seen[i] || !onScreen(tx, ty)) continue;
      const [sx, sy] = toScreen(tx, ty);
      const kind = mapKind(zone, tx, ty);
      if (kind === KIND.WALL) {
        const c = BLOCKS[zone.get(tx, ty, FLOOR_Z + 1)].color || [120, 120, 120];
        S.put(sx, sy, "#", c[0] * 0.75, c[1] * 0.75, c[2] * 0.75);
        S.put(sx + 1, sy, "#", c[0] * 0.75, c[1] * 0.75, c[2] * 0.75);
      } else if (kind === KIND.MOSAIC) {   // from above, the picture is plain as day
        const c = BLOCKS[zone.get(tx, ty, FLOOR_Z - 1)].color;
        S.put(sx, sy, "█", ...c);
        S.put(sx + 1, sy, "█", ...c);
      } else if (kind === KIND.SPIKES) {   // up now, up next beat, or down
        const st = spikeState(zone, i, game.time);
        if (st === "up") S.put(sx, sy, "▲", 255, 70, 60);
        else if (st === "warn") S.put(sx, sy, "^", 255, 170, 60);
        else S.put(sx, sy, ",", 130, 110, 100);
      } else {
        const [ch, c] = GLYPHS[kind] || GLYPHS[KIND.FLOOR];
        S.put(sx, sy, ch, ...c);
      }
    }
  }

  // The Colossus's quake: the tiles about to shake (^), and the ones shaking now (▲).
  if (zone.slam || zone.slamDone) {
    for (let ty = 0; ty < zone.d; ty++)
      for (let tx = 0; tx < zone.w; tx++) {
        const st = onScreen(tx, ty) && zone.seen[tx + ty * zone.w] && slamState(zone, tx + ty * zone.w, game.time);
        if (!st) continue;
        const [sx, sy] = toScreen(tx, ty);
        if (st === "up") S.put(sx, sy, "▲", 255, 70, 60);
        else S.put(sx, sy, "^", 255, 170, 60);
      }
  }

  // Items you've seen, monsters where you last saw them, your markers
  for (const item of zone.items) {
    const tx = Math.floor(item.x), ty = Math.floor(item.y);
    if (!zone.seen[tx + ty * zone.w] || !onScreen(tx, ty)) continue;
    const [glyph, color] = itemGlyph(game, item);
    const [sx, sy] = toScreen(tx, ty);
    S.put(sx, sy, glyph, ...color);
  }
  for (const mk of zone.markers) {
    if (!onScreen(mk.x, mk.y)) continue;
    const [sx, sy] = toScreen(mk.x, mk.y);
    S.put(sx, sy, "*", 90, 230, 255);
  }

  // Where a click would take you (planned from the map alone — it can't see drops).
  const hover = hoveredTile();
  const route = !game.travel && hover && game.mode === "map" ? planTravel(game, hover.x, hover.y) : game.travel?.path;
  for (const [tx, ty] of route || []) {
    if (!onScreen(tx, ty)) continue;
    const [sx, sy] = toScreen(tx, ty);
    S.put(sx, sy, "·", 90, 200, 255);
  }

  // Poison gas (%) and fresh potion splashes (*) over the tiles they cover.
  const area = (cx, cy, r, ch, color) => {
    for (let ty = Math.floor(cy - r); ty <= Math.ceil(cy + r); ty++)
      for (let tx = Math.floor(cx - r); tx <= Math.ceil(cx + r); tx++) {
        if (!onScreen(tx, ty) || Math.hypot(tx + 0.5 - cx, ty + 0.5 - cy) > r || zone.kind[tx + ty * zone.w] === KIND.WALL) continue;
        const [sx, sy] = toScreen(tx, ty);
        S.put(sx, sy, ch, ...color);
      }
  };
  for (const c of zone.clouds) area(c.x, c.y, c.r, "%", [110, 200, 80].map((v) => v * Math.min(1, c.time / 2)));
  for (const e of game.effects) if (e.kind === "burst" && game.time - e.time < 1) area(e.x, e.y, e.big ? 2.3 : 1.8, "*", e.color);
  for (const b of zone.bombs) area(b.x, b.y, 0.75, "0", Math.floor(game.time * 6) % 2 ? [255, 90, 40] : [255, 200, 90]);   // a lit bomb, blinking

  // Damage numbers from the last couple of turns, just above whoever took the hit.
  for (const e of game.effects) {
    if (e.kind !== "damage" || game.time - e.time > 1.0) continue;
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    if (!onScreen(tx, ty) || ty - ty0 < 1) continue;
    const [sx, sy] = toScreen(tx, ty);
    S.text(sx - (e.text.length >> 1), sy - 1, e.text, ...e.color);
  }

  // People: anyone on a tile you've seen (a ghost only once you've met it in the dark).
  for (const n of talkersIn(zone)) {
    if (!zone.seen[n.tx + n.ty * zone.w] || !onScreen(n.tx, n.ty) || (n.vis.ghostly && !n.talk.met)) continue;
    const [sx, sy] = toScreen(n.tx, n.ty);
    S.put(sx, sy, n.glyph, ...n.color);
  }

  // Monsters: bright if you can see them right now, fading if it's an old memory.
  for (const s of zone.sightings.values()) {
    const tx = Math.floor(s.x), ty = Math.floor(s.y);
    if (!onScreen(tx, ty)) continue;
    const k = s.time === game.time ? 1 : Math.max(0.3, 0.7 - (game.time - s.time) / 40);
    const [sx, sy] = toScreen(tx, ty);
    S.put(sx, sy, s.glyph, s.color[0] * k, s.color[1] * k, s.color[2] * k);
  }

  // You, and which way you're facing
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  if (onScreen(ptx, pty)) {
    const [sx, sy] = toScreen(ptx, pty);
    S.put(sx, sy, "@", 255, 230, 80);
    S.put(sx + 1, sy, ARROWS[Math.round(player.yaw / (Math.PI / 4)) & 7], 255, 230, 80);
  }

  // Header, legend, inspect line
  const header = game.story.cube
    ? " MAP · turn-based · WASD/arrows: move, attack, talk · click: walk there · X: explore · T: throw · Space: wait · I: inventory · J: journal · Tab: 3D "
    : " WASD/arrows: step (walk into people to talk) · click: walk there · X: explore · Space: wait · I: inventory · J: journal ";
  S.text(1, 0, header.slice(0, S.cols - 2), 255, 255, 255);
  if (legend) drawLegend(S.cols - LEGEND_W + 1, top, game);
  S.text(1, S.rows - 1, " " + describeTile(game, hoveredTile()) + " ", 200, 200, 200);
}

function drawLegend(x, y, game) {
  const rows = [
    ["@", [255, 230, 80], "you"],
    ["#", [140, 140, 150], "wall"],
    [".", [125, 120, 110], "floor (any height!)"],
    [":", [95, 80, 140], "chasm / pit"],
    ["~", [110, 190, 220], "shallow water (slow)"],
    ["~", [50, 80, 200], "deep water"],
    ["=", [190, 130, 70], "bridge"],
    ["+", [200, 130, 60], "door"],
    ["+", [240, 200, 80], "locked door"],
    ["|", [160, 165, 185], "gate"],
    ["&", [210, 210, 220], "lever"],
    [">", [255, 255, 255], "stairs down"],
    ["<", [190, 220, 255], "stairs up"],
    ["!", [230, 60, 80], "potion (by colour)"],
    ["?", [235, 220, 175], "scroll"],
    ["/", [205, 210, 225], "throwing knife"],
    ["0", [255, 140, 70], "bomb"],
    ["%", [110, 200, 80], "poison gas"],
    [")", [205, 210, 225], "weapon"],
    ["[", [175, 180, 195], "armour"],
    ["= \"", [170, 120, 255], "ring, amulet"],
    ["†", [255, 215, 120], "a shrine"],
    ["k", [240, 200, 70], "key"],
    ["h", [240, 60, 90], "heart crystal (+5 HP)"],
    ["S", [255, 160, 60], "strength crystal"],
    ["$", [255, 210, 70], "gold"],   // (glim; the word stays until golden (b), whose map frames show this legend, is retired)
    ["*", [90, 230, 255], "your marker"],
    ["█", [240, 195, 60], "floor mosaic: read it!"],
    ["▲ ^ ,", [255, 70, 60], "spikes: up, next, down"],
    ["@", [245, 230, 170], "someone to talk to"],
    ["@", [190, 170, 255], "a flat being (map only)"],
    ["r g s", [200, 200, 200], "monster, last seen"],
    ["f", [200, 170, 255], "flatling (map only!)"],
    ["g", [255, 150, 60], "bright, odd colour: elite"],
    ["Q W C", [255, 190, 90], "a guardian"],
    ["L", [140, 255, 170], "the Lich King"],
  ];
  S.text(x, y, "LEGEND", 255, 255, 255);
  rows.forEach(([g, c, label], k) => {
    S.text(x, y + 2 + k, g, ...c);
    S.text(x + 6, y + 2 + k, label, 170, 170, 170);
  });
  const notes = [
    "Time only passes when you",
    "act. Monsters near you get",
    "as long as your action takes.",
    "",
    "The map only knows what",
    "you've seen, and it's flat:",
    "ledges look like floor, and",
    "so do chasms until you've",
    "looked down into them in 3D.",
  ];
  notes.forEach((t, k) => y + rows.length + 4 + k < S.rows - 2 && S.text(x, y + rows.length + 4 + k, t, 120, 120, 120));
}

// Map a screen cell to the tile under it.
export function tileAtCell(cell) {
  if (!cell || cell.y < mapView.top) return null;
  return { x: Math.floor(cell.x / TILE_W) + mapView.tx0, y: cell.y - mapView.top + mapView.ty0 };
}

function hoveredTile() { return tileAtCell(mapView.hover); }

function describeTile(game, tile) {
  const { zone } = game;
  if (!tile || tile.x < 0 || tile.y < 0 || tile.x >= zone.w || tile.y >= zone.d) return "Hover over a tile to inspect it.";
  const i = tile.x + tile.y * zone.w;
  if (!zone.seen[i]) return "Unexplored.";
  const parts = [];
  const kind = mapKind(zone, tile.x, tile.y);
  if (kind === KIND.WALL) parts.push(capitalize(BLOCKS[zone.get(tile.x, tile.y, FLOOR_Z + 1)].name || "wall") + ".");
  else parts.push({ [KIND.FLOOR]: "Floor.", [KIND.DOOR]: "A wooden door.", [KIND.LOCKED]: "A locked door.",
                    [KIND.GATE]: "An iron gate.", [KIND.LEVER]: "A lever.", [KIND.STAIRS]: "Stairs leading down.", [KIND.STAIRS_UP]: "Stairs back up to the floor above.",
                    [KIND.HOLE]: "A drop into the dark. It leads down a floor.",
                    [KIND.SHALLOW]: "Shallow water. Wading is slow.", [KIND.DEEP]: "Deep water. Go in and it sweeps you down a floor.",
                    [KIND.BRIDGE]: "A wooden bridge.", [KIND.MOSAIC]: "Mosaic tiles. From up here, the picture is clear.",
                    [KIND.SPIKES]: { up: "A spike trap: the spikes are UP.", warn: "A spike trap: the spikes come up next beat!", down: "A spike trap, down for now." }[spikeState(zone, i, game.time)] }[kind]);
  for (const n of talkersIn(zone))
    if (n.tx === tile.x && n.ty === tile.y && (!n.vis.ghostly || n.talk.met)) {
      const title = typeOf(n).title;
      parts.push(`${n.name}${title ? ", " + title : ""}, is here.${n.vis.flat ? " (A flat being: in 3D you'd only see a shadow.)" : ""} Walk into them to talk.`);
    }
  for (const item of zone.items)
    if (Math.floor(item.x) === tile.x && Math.floor(item.y) === tile.y) parts.push(`There is ${withArticle(itemName(game, item))} here.`);
  for (const [id, s] of zone.sightings)
    if (Math.floor(s.x) === tile.x && Math.floor(s.y) === tile.y) {
      const m = zone.creatures.find((o) => o.id === id), what = m && resistText(m);
      parts.push(`You last saw a ${s.name} here ${Math.round(game.time - s.time)} s ago.${what ? ` (${capitalize(what)}.)` : ""}`);
    }
  if (zone.markers.some((m) => m.x === tile.x && m.y === tile.y)) parts.push("Your marker.");
  return parts.join(" ");
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);
