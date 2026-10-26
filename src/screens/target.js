// The target screen and the look key (TECH_DESIGN §4.2 `target`, §2.8 "Targeting on the map", §4.3 L; WS8).
//
// On the map a throw (T, with the d20 set), a missile weapon (V), an ability (abilities.js requestTarget,
// through requestTarget here) and L open a cursor over the map. It moves with the arrow keys, WASD or
// the numpad (Shift: 4 tiles at a time) or follows the mouse; Tab cycles what you can see (Shift+Tab
// back); Enter, Space, E or a left click confirm (T for a throw, V for a shot, L for a look: the same key
// twice acts at once); Esc or a right click cancels. While it is open time stands still. It shows:
//   the line of fire: the exact flight a throw or a shot would take now (throwing.js flightOf), green
//     while it is clear, yellow from a creature in the way (it would be hit first), red where a wall or the
//     range stops it; for an ability the straight line, red past the first wall;
//   the hit chance against a creature under the cursor (d20: combat.js hitChance with the aimed bonus for
//     a projectile; your weapon's for a look), its distance, and what the inspect line says about the tile.
// L (look) works in both views: on the map the cursor, whose confirm emits `inspect { open: true }` (WS5's
// examine screen opens on it) and tells one line; in 3D what is in the crosshair (a creature or person,
// else the nearest thing lying there, else the block), the same event and line at once.
//
//   openTarget(game, opts) → true          the screen, over the map (in 3D: done at once with aimTarget's
//       pick). opts = { purpose: "look" | "throw" | "missile" | "ability", range (tiles; look: unlimited),
//       verb ("throw", "fire the sling"…), item, spec (a combat spec: the hit chance), flight(game, target)
//       → a pretend projectile (throwing.js ballisticFrom: the line of fire), done(game, target | null) }
//       target = { creature, point, tile, dir } (abilities.js aimTarget's shape); creature: one you can
//       see on the tile (a person for a look), else null
//   requestTarget(game, ability, done)     abilities.js's seam with the screen behind it: in 3D
//       done(aimTarget(game, range)) at once, on the map done(target | null) when you confirm or cancel
//   look(game)                             L in either view
//   lookLine(game, payload) → string       the line a look tells
//   cursorTarget(game) → target            what the open screen points at (checks, the browser tool)
//   MODE = "target"
import * as S from "../screen.js";
import { registerScreen, pushMode, popMode, modeData } from "../screens.js";
import { bind, globalKey } from "../keys.js";
import { keys } from "../input.js";
import { UI } from "../ui.js";
import { mapView, tileAtCell, inspectAt, describeTile } from "../renderMap.js";
import { emit } from "../events.js";
import { aimTarget, REQUEST_RANGE } from "../abilities.js";
import { flightOf } from "../throwing.js";
import { hitChance, toHitMod, dvOf, critNat, weaponSpec, resistText } from "../combat.js";
import { canTalk, ghostHidden, ghostOffMap, isFlat, typeOf, touchable } from "../creatures.js";
import { attitude } from "../factions.js";
import { itemName, withArticle } from "../items.js";
import { BLOCKS, KIND } from "../world.js";
import { EYE } from "../player.js";
import { castRay, hit as rayHit, lineOfSight } from "../raycast.js";
import { distance } from "../rng.js";
import { RULES } from "../rules.js";
import "../missiles.js";   // V (missile weapons) opens this screen; the game loads it through here

export const MODE = "target";
const MOVES = {
  KeyW: [0, -1], ArrowUp: [0, -1], Numpad8: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], Numpad2: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], Numpad4: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};
const CONFIRM = ["Enter", "NumpadEnter", "Space", "KeyE"];
const AGAIN = { throw: "KeyT", missile: "KeyV", look: "KeyL" };   // the key that opened it confirms too
const COLOR = { clear: [120, 230, 120], blocked: [255, 90, 70], interposed: [255, 215, 80], far: [150, 110, 100] };
const LOOK_SIGHT = 24;

const shift = () => keys.has("ShiftLeft") || keys.has("ShiftRight");
const tileOf = (e) => ({ x: Math.floor(e.x), y: Math.floor(e.y) });

// What you can see on the map now: the creatures sighted this moment and the people shown (a look adds
// people and every creature; the rest only creatures not friendly to you), nearest first.
function candidates(game, purpose) {
  const { zone, player: p } = game, out = [];
  for (const c of zone.creatures) {
    if (c.brain?.arriving > 0) continue;
    if (canTalk(c)) { if (purpose === "look" && zone.seen[c.tx + c.ty * zone.w] && !ghostOffMap(game, c)) out.push(c); continue; }
    if (zone.sightings.get(c.id)?.time !== game.time) continue;
    if (purpose !== "look" && attitude(game, c, p) === "friendly") continue;
    out.push(c);
  }
  return out.sort((a, b) => distance(a.x - p.x, a.y - p.y) - distance(b.x - p.x, b.y - p.y) || a.id - b.id);
}

// The creature you'd mean on a tile: a person shown there, else one sighted there this moment.
function shownAt(game, tile) {
  const payload = inspectAt(game, tile, false);
  const c = payload?.creature;
  if (!c) return null;
  return canTalk(c) || game.zone.sightings.get(c.id)?.time === game.time ? c : null;
}

function targetAt(game, tile) {
  const p = game.player, c = shownAt(game, tile);
  const zone = game.zone, inside = tile.x >= 0 && tile.y >= 0 && tile.x < zone.w && tile.y < zone.d;
  const s = inside ? zone.stand[tile.x + tile.y * zone.w] : -1;
  const point = c ? { x: c.x, y: c.y, z: c.z } : { x: tile.x + 0.5, y: tile.y + 0.5, z: s >= 0 ? s : p.z };
  const d = distance(point.x - p.x, point.y - p.y) || 1;
  return { creature: c, point, tile: { x: tile.x, y: tile.y }, dir: [(point.x - p.x) / d, (point.y - p.y) / d, 0] };
}
export function cursorTarget(game) {
  const data = game.mode === MODE ? modeData(game) : null;
  return data ? targetAt(game, data.cursor) : null;
}

export function openTarget(game, opts) {
  const p = game.player;
  if (game.mode !== "map") { opts.done?.(game, aimTarget(game, opts.range || REQUEST_RANGE)); return true; }
  const purpose = opts.purpose || "ability";
  const cands = candidates(game, purpose);
  const range = purpose === "look" ? Infinity : opts.range || REQUEST_RANGE;
  // Start on the last thing you aimed at if it's still in view, else the nearest in range, else your tile.
  const last = cands.find((c) => c.id === game.lastTargetId && (purpose === "look" || distance(c.x - p.x, c.y - p.y) <= range));
  const first = last || cands.find((c) => purpose === "look" || distance(c.x - p.x, c.y - p.y) <= range) || null;
  const cursor = first ? tileOf(first) : tileOf(p);
  pushMode(game, MODE, { ...opts, purpose, range, cands, k: first ? cands.indexOf(first) : -1, cursor });
  return true;
}

export function requestTarget(game, ability, done) {
  if (game.mode !== "map") { done(aimTarget(game, ability?.range || REQUEST_RANGE)); return; }
  openTarget(game, { purpose: "ability", range: ability?.range || REQUEST_RANGE, verb: `use ${ability?.name || "it"}`,
                     done: (g, t) => done(t) });
}

// --- Acting on it ---------------------------------------------------------------------------------------
function confirm(game, data) {
  const p = game.player, t = targetAt(game, data.cursor);
  if (data.purpose === "look") { popMode(game); lookAtTile(game, data.cursor); return; }
  const far = distance(t.point.x - p.x, t.point.y - p.y);
  if (far > data.range + 0.5) { game.log(`That's ${Math.round(far)} tiles away: you can ${data.verb || "reach"} ${data.range} at most.`, [170, 170, 170]); return; }
  if (t.creature) game.lastTargetId = t.creature.id;
  popMode(game);
  data.done?.(game, t);
}
function cancel(game, data) {
  popMode(game);
  data.done?.(game, null);
}
function moveCursor(data, dx, dy, n = 1) {
  const z = data.zone || null;
  data.cursor = { x: data.cursor.x + dx * n, y: data.cursor.y + dy * n };
  if (z) { data.cursor.x = Math.max(0, Math.min(z.w - 1, data.cursor.x)); data.cursor.y = Math.max(0, Math.min(z.d - 1, data.cursor.y)); }
}
function cycle(data, step) {
  if (!data.cands.length) return;
  data.k = (data.k + step + data.cands.length) % data.cands.length;
  data.cursor = tileOf(data.cands[data.k]);
}

// --- Looking --------------------------------------------------------------------------------------------
// The line a look tells: who or what it is, and for a creature you could fight, your weapon's chance.
export function lookLine(game, payload) {
  if (!payload) return "You haven't seen that place.";
  const p = game.player, c = payload.creature;
  if (c && canTalk(c)) {
    const title = typeOf(c).title;
    return `${c.name}${title ? `, ${title}` : ""}.${isFlat(c) ? " A flat being." : ""}`;
  }
  if (c) {
    const parts = [`A${/^[aeiou]/i.test(c.name) ? "n" : ""} ${c.name}, level ${c.level || 1}`];
    const feel = attitude(game, c, p);
    parts.push(feel === "friendly" ? "on your side" : feel === "hostile" ? "out for you" : feel === "wary" ? "wary of you" : "paying you no mind");
    if (touchable(game, c)) {
      const chance = RULES.combat === "d20" ? hitChance(toHitMod(game, p, c, weaponSpec(p), {}), dvOf(game, c), critNat(p)) : 1;
      parts.push(`${Math.round(chance * 100)}% to hit with your ${weaponSpec(p).weapon ? "weapon" : "fists"}`);
    }
    const res = resistText(c);
    return `${parts.join(", ")}.${res ? ` ${res[0].toUpperCase()}${res.slice(1)}.` : ""}`;
  }
  if (payload.item) return `${withArticle(itemName(game, payload.item))[0].toUpperCase()}${withArticle(itemName(game, payload.item)).slice(1)}.`;
  if (payload.block) return `${(BLOCKS[payload.block]?.name || "something").replace(/^./, (s) => s.toUpperCase())}.`;
  return describeTile(game, { x: payload.x, y: payload.y });
}
function tell(game, payload) {
  game.log(lookLine(game, payload), [200, 210, 230]);
  if (payload) emit(game, "inspect", payload);
}
function lookAtTile(game, tile) { tell(game, inspectAt(game, tile, true)); }

// 3D: the creature or person nearest the crosshair (a 6° cone, in sight, within LOOK_SIGHT tiles; not a
// flat being, which shows only as a shadow, nor a ghost the light hides), else the nearest thing lying
// within a tile of where your view meets the world, else that block.
function lookIn3d(game) {
  const { zone, player: p } = game;
  const cp = Math.cos(p.pitch), dir = [cp * Math.cos(p.yaw), cp * Math.sin(p.yaw), Math.sin(p.pitch)];
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  let best = null, bestCos = Math.cos((6 * Math.PI) / 180);
  for (const c of zone.creatures) {
    if (isFlat(c) || ghostHidden(game, c) || c.brain?.arriving > 0) continue;
    const cx = c.x - ex, cy = c.y - ey, cz = c.z + (c.h || 1) * 0.6 - ez, d = Math.hypot(cx, cy, cz);
    if (d < 1e-6 || d > LOOK_SIGHT) continue;
    const cos = (cx * dir[0] + cy * dir[1] + cz * dir[2]) / d;
    if (cos < bestCos || !lineOfSight(zone, ex, ey, ez, c.x, c.y, c.z + (c.h || 1) * 0.6)) continue;
    best = c; bestCos = cos;
  }
  if (best) return { zone, x: Math.floor(best.x), y: Math.floor(best.y), z: best.z, creature: best, open: true };
  if (!castRay(zone, ex, ey, ez, dir[0], dir[1], dir[2], LOOK_SIGHT)) return null;
  const at = { x: rayHit.x, y: rayHit.y, z: rayHit.z, block: rayHit.block };
  const item = zone.items.filter((it) => Math.hypot(it.x - (ex + dir[0] * rayHit.t), it.y - (ey + dir[1] * rayHit.t)) < 1.2)
    .sort((a, b) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey))[0];
  const payload = { zone, x: Math.floor(at.x), y: Math.floor(at.y), z: Math.floor(at.z), open: true };
  if (item) payload.item = item; else payload.block = at.block;
  return payload;
}

export function look(game) {
  if (game.mode === "map") return openTarget(game, { purpose: "look", verb: "look at" });
  if (game.mode !== "explore") return false;
  tell(game, lookIn3d(game));
  return true;
}
bind("map", "KeyL", (game) => { look(game); }, { help: "look (a cursor)" });
bind("explore", "KeyL", (game) => { look(game); }, { when: (game) => !game.paused, help: "look at what's in the crosshair" });

// --- The line of fire -----------------------------------------------------------------------------------
// Tiles from you toward the cursor, each { x, y, state }: the flight's tiles for a throw or a shot, the
// straight line for an ability or a look. → { tiles, end: "clear" | "blocked" | "interposed" | "far", hit }
export function lineOfFire(game, data) {
  const p = game.player, t = targetAt(game, data.cursor), you = tileOf(p);
  const tiles = [], key = (x, y) => `${x},${y}`, seen = new Set([key(you.x, you.y)]);
  const add = (x, y, state) => { if (!seen.has(key(x, y))) { seen.add(key(x, y)); tiles.push({ x, y, state }); } };
  const tooFar = (x, y) => distance(x + 0.5 - p.x, y + 0.5 - p.y) > data.range + 0.5;
  if (data.purpose === "look") return { tiles, end: "clear", hit: null };
  if (data.flight) {
    const f = flightOf(game, data.flight(game, t));
    let state = "clear";
    for (const pt of f.path) {
      const x = Math.floor(pt.x), y = Math.floor(pt.y);
      if (tooFar(x, y)) state = "far";
      add(x, y, state);
    }
    // Where it comes down: on the creature you aimed at, or on the tile you aimed at, is clear; on another
    // creature first, "interposed"; anywhere else (a wall, a ledge short of it), "blocked".
    const landed = Math.floor(f.x) === t.tile.x && Math.floor(f.y) === t.tile.y;
    const end = f.creature ? (f.creature === t.creature ? state : "interposed") : f.stop && !landed ? "blocked" : state;
    if (f.creature) add(Math.floor(f.creature.x), Math.floor(f.creature.y), end === "interposed" ? "interposed" : state);
    else if (f.stop && !landed) add(Math.floor(f.x), Math.floor(f.y), "blocked");
    return { tiles, end, hit: f.creature };
  }
  // A straight line, stopping red at the first wall.
  const n = Math.max(Math.abs(t.tile.x - you.x), Math.abs(t.tile.y - you.y));
  let state = "clear";
  for (let k = 1; k <= n; k++) {
    const x = Math.round(you.x + ((t.tile.x - you.x) * k) / n), y = Math.round(you.y + ((t.tile.y - you.y) * k) / n);
    const z = game.zone, wall = x < 0 || y < 0 || x >= z.w || y >= z.d || z.kind[x + y * z.w] === KIND.WALL;
    if (state === "clear" && tooFar(x, y)) state = "far";
    if (wall) state = "blocked";
    add(x, y, state);
  }
  return { tiles, end: state, hit: null };
}

// --- The screen -----------------------------------------------------------------------------------------
const TITLE = { look: "LOOK", throw: "THROW", missile: "FIRE", ability: "TARGET" };

registerScreen(MODE, {
  pausesTime: true, pointer: "unlock", over: "view",
  enter(game, data) { data.zone = game.zone; },
  draw(game) {
    const data = modeData(game), p = game.player;
    const { tx0, ty0, top } = mapView;
    const viewH = S.rows - top - 2;
    const onScreen = (x, y) => x - tx0 >= 0 && (x - tx0) * 2 < S.cols && y - ty0 >= 0 && y - ty0 < viewH;
    const at = (x, y) => [(x - tx0) * 2, top + y - ty0];
    const fire = lineOfFire(game, data);
    const shown = (x, y) => game.zone.creatures.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y &&
      (canTalk(c) || game.zone.sightings.get(c.id)?.time === game.time));
    for (const { x, y, state } of fire.tiles) {
      if (!onScreen(x, y) || (x === data.cursor.x && y === data.cursor.y)) continue;
      const [sx, sy] = at(x, y);
      if (shown(x, y)) { S.put(sx + 1, sy, "*", ...COLOR[state]); continue; }   // a creature in the way: marked beside it
      S.put(sx, sy, state === "blocked" ? "x" : "·", ...COLOR[state]);
    }
    const t = targetAt(game, data.cursor);
    if (onScreen(data.cursor.x, data.cursor.y)) {
      const [sx, sy] = at(data.cursor.x, data.cursor.y), c = COLOR[fire.end === "clear" ? "clear" : fire.end];
      S.put(sx - 1, sy, "[", ...(data.purpose === "look" ? UI.cursor : c));
      S.put(sx + 1, sy, "]", ...(data.purpose === "look" ? UI.cursor : c));
    }
    // Header: what you're doing and the keys; the last row: what's under the cursor.
    const { top: head, bottom } = texts(game, data, t, fire);
    S.blank(0, 0, S.cols, 1);
    S.text(1, 0, head.slice(0, S.cols - 2), ...UI.title);
    S.blank(0, S.rows - 1, S.cols, 1);
    S.text(1, S.rows - 1, bottom.slice(0, S.cols - 2), ...UI.text);
  },
  key(game, code, repeat) {
    const data = modeData(game);
    if (globalKey(code)) return false;   // M, N
    if (MOVES[code]) { moveCursor(data, ...MOVES[code], shift() ? 4 : 1); return true; }
    if (code === "Tab") { cycle(data, shift() ? -1 : 1); return true; }
    if (!repeat && (CONFIRM.includes(code) || code === AGAIN[data.purpose])) { confirm(game, data); return true; }
    if (code === "Escape") { cancel(game, data); return true; }
    return true;   // nothing else: the map's keys wait until it closes
  },
  hover(game, cell) {
    const tile = tileAtCell(cell), data = modeData(game);
    if (tile && tile.x >= 0 && tile.y >= 0 && tile.x < game.zone.w && tile.y < game.zone.d) data.cursor = tile;
  },
  mouse(game, button, cell) {
    const data = modeData(game);
    if (button === 2) { cancel(game, data); return; }
    const tile = tileAtCell(cell);
    if (button !== 0 || !tile || tile.x < 0 || tile.y < 0 || tile.x >= game.zone.w || tile.y >= game.zone.d) return;
    data.cursor = tile;
    confirm(game, data);
  },
  wheel(game, sign) { cycle(modeData(game), sign > 0 ? 1 : -1); },
});

// The screen's two rows of text: the header (what you're doing, the keys) and the last row (infoLine).
function texts(game, data, t = targetAt(game, data.cursor), fire = lineOfFire(game, data)) {
  const confirmKey = AGAIN[data.purpose] ? `Enter/${AGAIN[data.purpose].slice(3)}` : "Enter";
  const top = ` ${TITLE[data.purpose] || "TARGET"}${data.verb ? `: ${data.verb}` : ""} · arrows/WASD or mouse: aim · Tab: next · ${confirmKey} or click: ${data.purpose === "look" ? "look" : "go"} · Esc: cancel `;
  return { top, bottom: ` ${infoLine(game, data, t, fire)} ` };
}
export function targetText(game) {
  const data = game.mode === MODE ? modeData(game) : null;
  return data ? texts(game, data) : { top: "", bottom: "" };
}

// What the last row says: the creature and your chance against it, or the tile; how far; what's in the way.
function infoLine(game, data, t, fire) {
  const p = game.player, c = t.creature;
  const far = Math.round(distance(t.point.x - p.x, t.point.y - p.y));
  const parts = [];
  if (data.purpose === "look") return lookLine(game, inspectAt(game, data.cursor, false)) + (c && !canTalk(c) ? ` (${far} tiles)` : "");
  if (c && !canTalk(c)) {
    let chance = null;
    if (data.spec && touchable(game, c)) chance = RULES.combat === "d20" ? hitChance(toHitMod(game, p, c, data.spec, { aimed: true }), dvOf(game, c), critNat(p)) : 1;
    parts.push(`${c.name}${chance !== null ? `: ${Math.round(chance * 100)}% to hit if it gets there` : ""}`);
  } else parts.push(describeTile(game, data.cursor));
  parts.push(`${far} tiles${far > data.range + 0.5 ? ` (out of range: ${data.range})` : ""}`);
  if (fire.end === "interposed") parts.push(`the ${fire.hit.name} is in the way`);
  else if (fire.end === "blocked") parts.push("something blocks the way");
  return parts.join(" · ");
}
