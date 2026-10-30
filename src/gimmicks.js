// The landmark dungeons' gimmicks played as you go (bible §5; C1b's GIMMICK_KEYS code; B2, C1b #10). Generation records
// what each needs on the zone (gen/dungeon.js, from world/sites.js dungeonParams); this module plays it, in both views:
//
//   tide          the Drowned Lantern (§5 L): every floor dry from 11:00 to 13:00; from 13:00 the water rises a block every
//                 2 world hours to 4 at 19:00, and stays until 11:00. The floor at the datum takes it: shallow at 1 block,
//                 deep (a fall to the floor below) from 2; raised ground stays dry. The map shows the waterline (its water).
//                 tideLevel(zone, hour) → 0..max; setTide(zone, level). It follows the clock on arrival and by the hour.
//   sweep         the Dial-works (§5 N): an inner hand's shadow turns once round the floor every `period` s; anything in it
//                 is pressed flat (the Flat status, refreshed while it lies there), you included. The map shows where it
//                 will be next (a map overlay). handAngle(zone, t), underSweep(zone, x, y, t).
//   darkMapping   the Root Canals and the Unlit Choir (§5 F, J): every tile you step on is recorded (zone.trail) and the map
//                 draws your track, lit or not, so it keeps your bearings while the eye is blind.
//   pressedRoom   the Press (§5 I): stand on its gold centre tile and turn (Tab), and it unpresses: its flat things stand up
//                 into 3D (no longer flat), enemies and all.
//   trueLevel     the Datum (§5 D): standing on the plate whose number is the sill's height opens the gate.
// (Press-plates: traps.js. Rune doors, off-beat doors and the Gnomon's door: interact.js. The shaft, the culvert and the
// sealed stair: screens/play.js. Two layouts: world/zonegen.js.)
import { on, registerUpdate } from "./events.js";
import { B, FLOOR_Z } from "./world.js";
import { hourOf } from "./clock.js";
import { addStatus, hasStatus } from "./status.js";
import * as S from "./screen.js";

// --- The tide -----------------------------------------------------------------------------------------------------
export function tideLevel(zone, hour) {
  const t = zone?.tide;
  if (!t) return 0;
  if (hour >= t.dry[0] && hour < t.dry[1]) return 0;
  const since = (hour - t.dry[1] + 24) % 24;   // hours since the water began to rise
  return Math.min(t.max, Math.floor(since / t.every) + t.rise);
}
export function setTide(zone, level) {
  const t = zone?.tide;
  if (!t || t.level === level) return;
  if (!t.base) {   // the floor the water covers: every column standing at the datum on its own floor block (not stairs)
    t.base = [];
    for (let y = 0; y < zone.d; y++)
      for (let x = 0; x < zone.w; x++) {
        const b = zone.get(x, y, FLOOR_Z - 1), i = x + y * zone.w;
        if (zone.stand[i] === FLOOR_Z && b && b !== B.STAIRS && b !== B.STAIRS_UP && b !== B.WATER_DEEP && b !== B.ALTAR && !nearStairs(zone, x, y)) t.base.push([i, b]);
      }
  }
  for (const [i, b] of t.base) zone.set(i % zone.w, Math.floor(i / zone.w), FLOOR_Z - 1, level <= 0 ? b : level === 1 ? B.WATER_SHALLOW : B.WATER_DEEP);
  t.level = level;
  zone.refresh();
}
const nearStairs = (zone, x, y) => [zone.stairs, zone.upStairs].some((s) => s && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1);
const followTide = (game, zone) => { if (zone?.tide) setTide(zone, tideLevel(zone, hourOf(game))); };

// --- The sweeping hand ----------------------------------------------------------------------------------------------
// Its angle as a turn (0..1) at time t; a cell is under it when it lies within r of the floor's middle and within `width`
// of a turn behind the hand's leading edge, measured as the cell's own turn (an integer-free angle by quadrant).
export const handTurn = (zone, t) => (((t || 0) / zone.sweep.period) % 1 + 1) % 1;
function turnOf(dx, dy) {   // 0..1 round the middle, by the "diamond angle" (no trig: generation's rule kept here too)
  const s = Math.abs(dx) + Math.abs(dy);
  if (!s) return 0;
  const p = dy >= 0 ? (dx >= 0 ? dy / s : 1 - dx / s) : (dx < 0 ? 2 - dy / s : 3 + dx / s);
  return p / 4;
}
export function underSweep(zone, x, y, t) {
  const S = zone.sweep;
  if (!S) return false;
  const dx = x + 0.5 - S.cx, dy = y + 0.5 - S.cy;
  if (dx * dx + dy * dy > S.r * S.r) return false;
  const behind = ((handTurn(zone, t) - turnOf(dx, dy)) % 1 + 1) % 1;
  return behind <= S.width / (2 * Math.PI);
}

// --- Every frame, in both views --------------------------------------------------------------------------------------
registerUpdate("landmarkGimmicks", (game) => {
  const zone = game.zone, p = game.player;
  if (!zone || !p) return;
  const tx = Math.floor(p.x), ty = Math.floor(p.y);
  if (zone.sweep) {
    if (underSweep(zone, tx, ty, game.time)) addStatus(game, p, "flat", { t: 1, stack: "refresh" });
    for (const m of zone.creatures) if (m.hp > 0 && underSweep(zone, Math.floor(m.x), Math.floor(m.y), game.time) && !m.guardian && !m.boss) addStatus(game, m, "flat", { t: 1, stack: "refresh" });
  }
  if (zone.darkMapping && tx >= 0 && ty >= 0 && tx < zone.w && ty < zone.d) {
    const i = tx + ty * zone.w;
    zone.seen[i] = 1;
    if (zone.trail.at(-1) !== i && !zone.trail.includes(i)) zone.trail.push(i);
  }
  const pr = zone.pressedRoom;
  if (pr && !pr.done) {
    const on = tx === pr.cx && ty === pr.cy, view = game.view;
    if (on && pr.lastView && pr.lastView !== view) unpress(game, zone);
    pr.lastView = on ? view : null;
  }
  const tl = zone.trueLevel;
  if (tl && !tl.solved && !hasStatus(p, "flying")) {
    const plate = tl.plates.find((q) => q.x === tx && q.y === ty);
    if (plate && plate.n === tl.answer && Math.abs(p.z - FLOOR_Z) < 0.4) {
      tl.solved = true;
      for (const [x, y, z] of tl.gate) zone.set(x, y, z, B.AIR);
      zone.refresh();
      game.log(`The plate numbered ${plate.n} sinks a finger's width under you. Somewhere, a gate grinds up: the sill was ${tl.answer} up, true.`, [255, 220, 140]);
    }
  }
});
function unpress(game, zone) {
  const pr = zone.pressedRoom;
  pr.done = true;
  for (const m of zone.creatures)
    if (m.pressed && m.x >= pr.x0 && m.x < pr.x1 + 1 && m.y >= pr.y0 && m.y < pr.y1 + 1) { m.vis = { ...(m.vis || {}), flat: false }; m.pressed = false; m.state = "chase"; }
  game.log("You turn on the gold tile, and the room unpresses: what was drawn on the floor stands up into the world.", [255, 220, 140]);
}

on("zone:prepare", (game, { zone }) => followTide(game, zone));
on("clock:hour", (game) => followTide(game, game.zone));

// --- The map: where the hand will be next, and your track in the dark ----------------------------------------------------
export const SWEEP_AHEAD = 4;   // seconds: the hand's shadow this far ahead, drawn dim over the floor
// (renderMap.js registers it as the map overlay "landmarkGimmicks", and so loads this module.)
export function drawGimmicks(game, { zone, onScreen, toScreen }) {
  if (zone.darkMapping) for (const i of zone.trail || []) {
    const x = i % zone.w, y = Math.floor(i / zone.w);
    if (!onScreen(x, y) || (x === Math.floor(game.player.x) && y === Math.floor(game.player.y))) continue;
    const [sx, sy] = toScreen(x, y);
    S.put(sx, sy, "·", 200, 170, 110);
  }
  if (zone.sweep) for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++) {
    if (!zone.seen[x + y * zone.w] || !onScreen(x, y) || !underSweep(zone, x, y, game.time + SWEEP_AHEAD) || underSweep(zone, x, y, game.time)) continue;
    const [sx, sy] = toScreen(x, y);
    S.put(sx, sy, "/", 120, 100, 170);
  }
}
