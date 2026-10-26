// The bot: scripted play through game.debug, in both views (TECH_DESIGN §9). Each session extends it.
//
//   node tools/bot.mjs [--seed 1234] [--view map|3d|both]
//   import { runStairs } from "./bot.mjs"   (tools/check-bot.mjs)
//
// 0A1: the stairs walk. Starting on level 1 of the legacy site under tile (0, 0), go down three
// levels and back up, and check that every arrival is in the right zone, on standable ground,
// beside the right stairs (down: beside the stairs up; up: beside the stairs down; out of level 1:
// in front of Maren, the temple's returnPoint). On the map the
// bot walks the whole route with key presses (game.debug.mapKey: doors open by bumping); in 3D it
// stands next to the stairs, faces them and holds W, frame by frame (game.debug.step), so the real
// physics carries it onto them. Monsters are cleared on arrival and the bot can't die: this
// exercises zone changes, not fights.
//
// The edge walk (runEdges, 0A2) starts in the temple's span (0, 0): in 3D it walks east along the road
// and off the span's east edge into (1, 0), frame by frame, and checks the crossing: the neighbour was
// already in memory (prefetch), the swap happened within one frame with no transition screen, your
// point in the world and your height moved no more than one frame's walk (no camera pop), and the frame
// drawn at the swap is no darker than the one before (no black frame). Then on the map it steps back
// west, one key press, and checks it lands on the mirrored tile of (0, 0) within a block of its height.
//
// The smoke run (runSmoke) is the fights: on levels 3, 5, 10, 15 and 20 (the three guardians and
// the Lich) it plays for a while with every monster alive, attacking, throwing and drawing frames,
// in either view, and fails on any exception. It asserts nothing else.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installNodeEnv, parseArgs } from "./node-env.mjs";

const env = await installNodeEnv();
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { MONSTER_TYPES } = await import("../src/monsters.js");
const { keys } = await import("../src/input.js");
const { standWith, B, FLOOR_Z } = await import("../src/world.js");
const { canWalk, PLAYER_STEP_UP, PLAYER_DROP } = await import("../src/pathing.js");
const { cachedZone } = await import("../src/zones.js");

const ARROWS = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
const tileOf = (p) => [Math.floor(p.x), Math.floor(p.y)];

function settle() {   // let the "DEPTH n" beat (and any story page) pass
  for (let k = 0; k < 400 && game.mode !== "map" && game.mode !== "explore"; k++) {
    if (game.mode === "story") { game.pages = null; game.mode = game.view === "map" ? "map" : "explore"; break; }
    game.debug.step(1 / 30);
  }
}

function arrive() {   // a fresh zone: no fights, no dying
  game.zone.monsters.length = 0;
  const p = game.player;
  p.maxHpGain = p.hp = 999;
  p.keys = 99;
}

// Breadth-first route over the zone's tiles, as the map lets you step (4 directions, climb 1).
function route(goal) {
  const zone = game.zone, { w, d } = zone, stand = standWith(zone, "all");
  const [sx, sy] = tileOf(game.player);
  // Not through people (bumping talks), nor over other stairs (they'd take you away), as the
  // game's own click-travel plans (turns.js routable).
  const blocked = new Set(zone.npcs.map((n) => n.tx + n.ty * w));
  for (let i = 0; i < w * d; i++) {
    const g = zone.blocks[i + (FLOOR_Z - 1) * w * d];
    if ((g === B.STAIRS || g === B.STAIRS_UP) && i !== goal.x + goal.y * w) blocked.add(i);
  }
  const prev = new Int32Array(w * d).fill(-1);
  prev[sx + sy * w] = sx + sy * w;
  const queue = [sx + sy * w];
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h], cx = c % w, cy = (c - cx) / w;
    if (cx === goal.x && cy === goal.y) {
      const path = [];
      for (let k = c; k !== sx + sy * w; k = prev[k]) path.push([k % w, Math.floor(k / w)]);
      return path.reverse();
    }
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + ox, y = cy + oy, i = x + y * w;
      if (x < 0 || y < 0 || x >= w || y >= d || prev[i] >= 0 || blocked.has(i)) continue;
      if (!canWalk(stand, w, cx, cy, x, y, PLAYER_STEP_UP, PLAYER_DROP)) continue;
      prev[i] = c;
      queue.push(i);
    }
  }
  return null;
}

// Map view: walk to the stairs tile, one key press per step (bumping a door opens it first).
function walkMap(goal) {
  const zone = game.zone;
  for (let presses = 0; presses < 2000 && game.zone === zone; ) {
    const path = route(goal);
    if (!path) return `no route to (${goal.x}, ${goal.y})`;
    for (const [x, y] of path) {
      const [px, py] = tileOf(game.player);
      const code = ARROWS[`${x - px},${y - py}`];
      if (!code) break;   // off the route (a door, a drop): plan again
      for (let k = 0; k < 3 && game.zone === zone && tileOf(game.player).join() !== `${x},${y}`; k++, presses++) game.debug.mapKey(code);
      if (game.zone !== zone) return null;
      if (tileOf(game.player).join() !== `${x},${y}`) break;
    }
  }
  return game.zone === zone ? "never reached the stairs" : null;
}

// 3D: stand on a free tile next to the stairs, face them and hold W until the zone changes.
function walk3d(goal) {
  const zone = game.zone, { w, stand } = zone, p = game.player;
  const sz = stand[goal.x + goal.y * w];
  const from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oy]) => [goal.x + ox, goal.y + oy])
    .find(([x, y]) => stand[x + y * w] === sz && zone.get(x, y, FLOOR_Z - 1) !== B.STAIRS && zone.get(x, y, FLOOR_Z - 1) !== B.STAIRS_UP);
  if (!from) return "no free tile beside the stairs";
  Object.assign(p, { x: from[0] + 0.5, y: from[1] + 0.5, z: sz, vz: 0, onGround: true, pitch: 0,
                     yaw: Math.atan2(goal.y - from[1], goal.x - from[0]) });
  game.mode = "explore"; game.view = "3d"; game.paused = false;
  keys.add("KeyW");
  for (let k = 0; k < 240 && game.zone === zone; k++) game.debug.step(1 / 60);
  keys.delete("KeyW");
  return game.zone === zone ? "walked but never took the stairs" : null;
}

// Where you stand now: in zone `key`, on ground you can stand on, next to `stairs`?
function besideStairs(key, which) {
  const zone = game.zone, p = game.player, s = zone[which];
  const [x, y] = tileOf(p);
  if (zone.key !== key) return `in ${zone.key}, expected ${key}`;
  if (!s) return `${key} has no ${which}`;
  if (zone.stand[x + y * zone.w] < 0 || Math.abs(p.z - zone.stand[x + y * zone.w]) > 1e-6) return `not standing on the ground at (${x}, ${y})`;
  if (Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) !== 1) return `at (${x}, ${y}), not beside the ${which} at (${s.x}, ${s.y})`;
  return null;
}

// Down three levels from level 1 and back up, in one view. Returns { ok, steps, problems }.
export function runStairs({ seed = 1234, view = "map", levels = 3 } = {}) {
  const problems = [], steps = [];
  startRun(seed);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  game.view = view === "3d" ? "3d" : "map";
  game.mode = game.view === "map" ? "map" : "explore";
  game.debug.enterZone("0,0,1", "down");
  arrive();
  const first = besideStairs("0,0,1", "upStairs");
  if (first) problems.push(`start: ${first}`);
  const go = (dir) => {
    const zone = game.zone, z = zone.z;
    const goal = dir === "down" ? zone.stairs : zone.upStairs;
    if (view === "map") { game.mode = "map"; game.view = "map"; }
    const err = !goal ? `no stairs ${dir}` : view === "3d" ? walk3d(goal) : walkMap(goal);
    settle();
    if (err) { problems.push(`${view} ${zone.key} ${dir}: ${err}`); return false; }
    const want = `0,0,${dir === "down" ? z + 1 : z - 1}`;
    const bad = besideStairs(want, dir === "down" ? "upStairs" : "stairs");
    steps.push(`${zone.key} → ${game.zone.key} (${dir})${bad ? ` ✗ ${bad}` : ""}`);
    if (bad) { problems.push(`${view} ${dir} to ${want}: ${bad}`); return false; }
    arrive();
    return true;
  };
  for (let k = 0; k < levels; k++) if (!go("down")) return { ok: false, steps, problems };
  for (let k = 0; k < levels; k++) if (!go("up")) return { ok: false, steps, problems };
  // And up out of the dungeon: level 1's stairs lead to the temple above, in front of Maren (its
  // returnPoint, as in the parent game), not down in the shaft's bottom room.
  const zone = game.zone;
  const err = view === "3d" ? walk3d(zone.upStairs) : walkMap(zone.upStairs);
  settle();
  const rp = game.zone.returnPoint, p = game.player;
  const bad = err || (game.zone.key !== "0,0,0" ? `in ${game.zone.key}, expected 0,0,0`
    : !rp ? "the temple has no returnPoint" : Math.hypot(p.x - rp.x, p.y - rp.y) > 1e-6 ? `at (${p.x}, ${p.y}), not in front of Maren (${rp.x}, ${rp.y})` : null);
  if (bad) problems.push(`${view} up to the surface: ${bad}`);
  else steps.push(`${zone.key} → ${game.zone.key} (up to the surface, in front of Maren)`);
  return { ok: problems.length === 0, steps, problems };
}

// The share of the screen drawn black (a blank cell in black): the 3D view of a missing zone.
function blackShare() {
  game.debug.draw();
  const { chars, colors } = env.capture, n = chars.length, stride = colors.length / n;
  let black = 0;
  for (let i = 0; i < n; i++) if (chars[i] === " " && colors[i * stride] + colors[i * stride + 1] + colors[i * stride + 2] < 12) black++;
  return black / n;
}

// Off the temple span's east edge in 3D, and back west on the map. Returns { ok, steps, problems, stats }.
export function runEdges({ seed = 1234 } = {}) {
  const problems = [], steps = [], stats = {};
  startRun(seed);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  game.view = "3d"; game.mode = "explore"; game.paused = false;
  const z0 = game.zone, p = game.player;
  if (!z0.edges.e) return { ok: false, steps, problems: [`${z0.key} has no open east edge`], stats };
  // Start on the road, 6 tiles from the east edge, facing east.
  const port = z0.gen.ports.find((q) => q.side === "e" && q.kind === "road");
  const y = port ? port.along + (port.width >> 1) : z0.d >> 1, x = z0.w - 6;
  Object.assign(p, { x: x + 0.5, y: y + 0.5, z: z0.stand[x + y * z0.w], vz: 0, onGround: true, yaw: 0, pitch: -0.15 });
  p.maxHpGain = p.hp = 999;
  keys.add("KeyW"); keys.add("Space");   // (Space: hop up any one-block step on the way)
  let crossed = false, prefetched = false, before = 0;
  for (let k = 0; k < 600 && !crossed; k++) {
    const from = game.zone, gx = from.wx * from.w + p.x, gy = from.wy * from.d + p.y, gz = p.z;
    prefetched = !!cachedZone(game, "1,0,0");
    if (k % 10 === 0 || p.x > from.w - 1) before = blackShare();
    const t0 = performance.now();
    game.debug.step(1 / 60);
    const ms = performance.now() - t0;
    if (game.zone === from) continue;
    crossed = true;
    const now = game.zone, ngx = now.wx * now.w + p.x, ngy = now.wy * now.d + p.y;
    const after = blackShare();
    stats.crossFrameMs = +ms.toFixed(1);
    stats.black = `${(100 * before).toFixed(1)}% → ${(100 * after).toFixed(1)}%`;
    if (now.key !== "1,0,0") problems.push(`3D: walked into ${now.key}, not 1,0,0`);
    if (!prefetched) problems.push("3D: the neighbour was not in memory before the crossing (no prefetch)");
    if (game.mode !== "explore") problems.push(`3D: mode ${game.mode} after the crossing (a transition screen?)`);
    if (Math.abs(ngx - gx) > 0.2 || Math.abs(ngy - gy) > 0.2 || Math.abs(p.z - gz) > 1) problems.push(`3D: the camera jumped (${(ngx - gx).toFixed(2)}, ${(ngy - gy).toFixed(2)}, ${(p.z - gz).toFixed(2)})`);
    if (after > before + 0.05 || after > 0.5) problems.push(`3D: a black frame at the crossing (${stats.black})`);
    steps.push(`3D ${from.key} → ${now.key} at frame ${k} (${ms.toFixed(1)} ms)`);
  }
  keys.clear();
  if (!crossed) { problems.push(`3D: never crossed the east edge (stuck at ${p.x.toFixed(2)}, ${p.y.toFixed(2)})`); return { ok: false, steps, problems, stats }; }
  // Back west on the map: one step off the west edge.
  game.mode = "map"; game.view = "map";
  for (let k = 0; k < 4 && game.zone.key === "1,0,0"; k++) game.debug.mapKey("ArrowLeft");
  const z1 = cachedZone(game, "1,0,0"), [tx, ty] = tileOf(p);
  const fromStand = z1.stand[0 + ty * z1.w];
  if (game.zone.key !== "0,0,0") problems.push(`map: stepping west from 1,0,0 led to ${game.zone.key}`);
  else {
    if (tx !== game.zone.w - 1) problems.push(`map: arrived at (${tx}, ${ty}), not on the east border`);
    if (Math.abs(p.z - fromStand) > 1) problems.push(`map: height ${p.z} after a step from ${fromStand}`);
    if (game.mode !== "map") problems.push(`map: mode ${game.mode} after the crossing`);
    steps.push(`map 1,0,0 → 0,0,0 at (${tx}, ${ty})`);
  }
  return { ok: problems.length === 0, steps, problems, stats };
}

// Play a while with the monsters alive: no exception may escape. Returns { ok, steps, problems }.
export function runSmoke({ seed = 1234, view = "map", levels = [3, 5, 10, 15, 20], seconds = 30 } = {}) {
  const problems = [], steps = [];
  startRun(seed);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  for (const z of levels) {
    let frames = 0, actions = 0;
    try {
      game.view = view === "3d" ? "3d" : "map";
      game.mode = game.view === "map" ? "map" : "explore";
      game.debug.enterZone(`0,0,${z}`, "down");
      settle();
      const zone = game.zone, p = game.player;
      p.maxHpGain = p.hp = 1e6;
      // Start next to the guardian or boss if there is one (so it wakes), else the nearest monster.
      const target = zone.monsters.find((m) => m.guardian || MONSTER_TYPES[m.type].boss) || zone.monsters[0];
      if (target) {
        const spot = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [3, 0], [0, 3]].map(([ox, oy]) => [target.tx + ox, target.ty + oy])
          .find(([x, y]) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0);
        if (spot) Object.assign(p, { x: spot[0] + 0.5, y: spot[1] + 0.5, z: zone.stand[spot[0] + spot[1] * zone.w], vz: 0 });
      }
      const t0 = game.time;
      if (view === "map") {
        const codes = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Space", "KeyT", "KeyF"];
        for (let k = 0; k < 4000 && game.time - t0 < seconds && game.zone === zone; k++) {
          if (game.mode !== "map") { settle(); if (game.mode !== "map") break; }
          const m = zone.monsters[0];
          const toward = m && k % 3 ? ARROWS[`${Math.sign(m.tx - Math.floor(p.x))},0`] || ARROWS[`0,${Math.sign(m.ty - Math.floor(p.y))}`] : null;
          game.debug.mapKey(toward || codes[k % codes.length]);
          actions++;
          if (k % 25 === 0) { game.debug.draw(); frames++; }
          if (p.hp < 1e5) p.hp = 1e6;
        }
      } else {
        game.paused = false;
        keys.add("KeyW");
        for (let k = 0; k < seconds * 60 && game.zone === zone; k++) {
          if (game.mode !== "explore") { settle(); if (game.mode !== "explore") break; game.paused = false; }
          const m = zone.monsters[0];
          if (m) p.yaw = Math.atan2(m.y - p.y, m.x - p.x);
          if (k % 20 === 0) { inputHandlers.onKeyDown("Enter", false, "Enter"); actions++; }
          if (k % 180 === 90) { inputHandlers.onKeyDown("KeyT", false, "t"); actions++; }
          if (k % 240 === 120) { inputHandlers.onKeyDown("KeyF", false, "f"); actions++; }
          game.debug.step(1 / 60);
          if (k % 30 === 0) { game.debug.draw(); frames++; }
          if (p.hp < 1e5) p.hp = 1e6;
        }
        keys.delete("KeyW");
      }
      steps.push(`level ${z}: ${actions} actions, ${frames} frames, ${zone.monsters.length} monsters left`);
    } catch (e) {
      keys.clear();
      problems.push(`${view} level ${z}: ${String(e.stack || e).split(/\r?\n/).slice(0, 4).join(" | ")}`);
    }
  }
  return { ok: problems.length === 0, steps, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  const views = !args.view || args.view === "both" ? ["map", "3d"] : [args.view];
  let ok = true;
  for (const view of views) {
    for (const [what, r] of [["stairs", runStairs({ seed: Number(args.seed) || 1234, view })],
                             ["smoke", runSmoke({ seed: Number(args.seed) || 1234, view })],
                             ...(view === "3d" ? [["edges", runEdges({ seed: Number(args.seed) || 1234 })]] : [])]) {
      console.log(`${r.ok ? "OK  " : "FAIL"} ${view} ${what}: ${r.steps.join(" · ")}`);
      for (const p of r.problems) console.log(`  ✗ ${p}`);
      ok &&= r.ok;
    }
  }
  process.exit(ok ? 0 : 1);
}
