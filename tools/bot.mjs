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
//
// Golden (a) in both views (runGoldenA, 0B): the mechanics scenario of tests/golden/scenarios.js, replayed
// through the controls of one view and compared with the parent's trace (tests/fixtures/golden/
// mechanics.json) step for step. The scenario's steps become key presses: the inventory opens with I
// (on the map through the map's keys, in 3D through the real-time keys), the selection moves with the
// arrow keys and Enter uses it (on the map the use takes game time, as in play; in 3D the game runs on
// for a frame); R swaps weapons from the inventory; a perk is chosen on the level-up screen with 1; and
// a crystal, key or pile is picked up by walking over it: on the map it lies on the next tile and the bot
// steps onto it, in 3D it lies at your feet and the game runs a frame. RULES.stats stays "legacy".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installNodeEnv, parseArgs, seedRandom, ROOT } from "./node-env.mjs";
import { currentApi } from "../tests/golden/current-api.js";
import { checkGolden } from "../tests/checks/golden.js";

const env = await installNodeEnv();
export const capture = env.capture;   // the frame the screen now presents into (importing the bot replaces the caller's)
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { CREATURE_TYPES, canTalk, talkersIn } = await import("../src/creatures.js");
const { keys } = await import("../src/input.js");
const { standWith, B, FLOOR_Z } = await import("../src/world.js");
const { canWalk, PLAYER_STEP_UP, PLAYER_DROP } = await import("../src/pathing.js");
const { cachedZone } = await import("../src/zones.js");
const { killMonster } = await import("../src/monsters.js");
const { on } = await import("../src/events.js");
const { servicesFor } = await import("../src/talk.js");

const ARROWS = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
const tileOf = (p) => [Math.floor(p.x), Math.floor(p.y)];

function settle() {   // let the "DEPTH n" beat (and any story page) pass
  for (let k = 0; k < 400 && game.mode !== "map" && game.mode !== "explore"; k++) {
    if (game.mode === "story") { game.pages = null; game.mode = game.view === "map" ? "map" : "explore"; break; }
    game.debug.step(1 / 30);
  }
}

const monstersIn = (zone) => zone.creatures.filter((c) => !canTalk(c));

function arrive() {   // a fresh zone: no fights, no dying
  game.zone.creatures = talkersIn(game.zone);
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
  const blocked = new Set(talkersIn(zone).map((n) => n.tx + n.ty * w));
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
      const target = monstersIn(zone).find((m) => m.guardian || CREATURE_TYPES[m.type].boss) || monstersIn(zone)[0];
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
          const m = monstersIn(zone)[0];
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
          const m = monstersIn(zone)[0];
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
      steps.push(`level ${z}: ${actions} actions, ${frames} frames, ${monstersIn(zone).length} monsters left`);
    } catch (e) {
      keys.clear();
      problems.push(`${view} level ${z}: ${String(e.stack || e).split(/\r?\n/).slice(0, 4).join(" | ")}`);
    }
  }
  return { ok: problems.length === 0, steps, problems };
}

// The legacy encounters (0C): every person of the parent game, met through one view's controls and
// played to the end. The bot visits the legacy levels 1-20 (and the temple) to find who's where, then for
// each one: stands beside them and talks (map: walks into them; 3D: faces them and presses E, the torch
// out for Brann; Flatlanders can't be talked to in 3D, so the bot checks E finds only a shadow, then
// talks on the map), reads every answer and picks one with a digit key, and does what the quest asks in
// between (a healing potion for Corwin, the map filled in for Mira, Rook's quarry killed, Lio's lever
// pulled by walking into it, Brann's skull picked up a floor below, Tee found, the Speaking Door's wrong
// number and then the right one, a plain offering and a bold one with its trial at shrines, and Pell's
// shop: buy, sell, a service, the news). Monsters other than the quarry are cleared and the bot can't
// die. Returns { ok, steps, problems, stats: { done: [...], talks, keys } }.
export function runEncounters({ seed = 1234, view = "map" } = {}) {
  const problems = [], steps = [], done = [];
  const counts = { talks: 0, keys: 0, questEvents: 0 };
  const off = ["quest:start", "quest:done"].map((type) => on(type, () => { counts.questEvents++; }));
  startRun(seed);
  game.pages = null; game.pendingPages = null;
  const p = game.player;
  const press = (code) => { inputHandlers.onKeyDown(code, false, code); counts.keys++; };
  const playing = () => {
    for (let k = 0; k < 5 && game.mode === "levelup"; k++) press("Digit1");   // Lio's gift: take the first
    game.view = view === "3d" ? "3d" : "map";
    game.mode = game.view === "map" ? "map" : "explore";
    game.paused = false;
  };
  const go = (z) => {
    if (game.zone.key !== `0,0,${z}`) { game.debug.enterZone(`0,0,${z}`, "down"); settle(); }
    playing();
    game.zone.creatures = game.zone.creatures.filter((c) => canTalk(c) || c.bounty);
    p.maxHpGain = p.hp = 999;
  };
  // Who's where: the temple, then every legacy level.
  const where = new Map();   // dialogue → [{ z, c }]
  const note = (z) => { for (const c of talkersIn(game.zone)) { if (!where.has(c.talk.dialogue)) where.set(c.talk.dialogue, []); where.get(c.talk.dialogue).push({ z, c }); } };
  note(0);
  for (let z = 1; z <= 20; z++) { go(z); note(z); }
  const findSkull = (z) => { go(z); return game.zone.items.find((it) => it.kind === "quest" && it.id === "skull"); };

  // Stand on a free tile beside (x, y) at about its height; returns the tile or null.
  const beside = (x, y, z) => {
    const zone = game.zone;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const bx = x + ox, by = y + oy, i = bx + by * zone.w;
      if (bx < 0 || by < 0 || bx >= zone.w || by >= zone.d || zone.stand[i] < 0 || Math.abs(zone.stand[i] - z) > 1) continue;
      if (zone.creatures.some((o) => o.tx === bx && o.ty === by)) continue;
      const g = zone.get(bx, by, FLOOR_Z - 1);
      if (g === B.STAIRS || g === B.STAIRS_UP) continue;
      Object.assign(p, { x: bx + 0.5, y: by + 0.5, z: zone.stand[i], vz: 0, onGround: true });
      return [bx, by];
    }
    return null;
  };
  // Open a conversation with c through this view's controls (flat people: on the map in either view).
  const talk = (c, { flatCheck = true } = {}) => {
    playing();
    const spot = beside(c.tx, c.ty, c.z);
    if (!spot) throw new Error(`no free tile beside ${c.name} at (${c.tx}, ${c.ty})`);
    const in3d = view === "3d" && !(c.vis.flat && !flatCheck);
    if (view === "3d") {
      p.yaw = Math.atan2(c.y - p.y, c.x - p.x);
      p.pitch = c.vis.flat ? -0.6 : 0;
      p.torch = !c.vis.ghostly;
      press("KeyE");
      if (c.vis.flat) {   // only a shadow in 3D: E finds it but can't talk
        if (game.mode === "talk") throw new Error(`${c.name} talked in 3D, but flat people only talk on the map`);
        game.mode = "map"; game.view = "map";
      }
    }
    if (!in3d || c.vis.flat) {
      const code = ARROWS[`${c.tx - spot[0]},${c.ty - spot[1]}`];
      game.debug.mapKey(code);
    }
    if (game.mode !== "talk") throw new Error(`walking into / facing ${c.name} at (${c.tx}, ${c.ty}) from (${spot}) in ${game.zone.key} opened ${game.mode}, not the talk screen: ${game.messages?.slice(-2).map((m) => m.text).join(" / ")}`);
    counts.talks++;
  };
  const shown = () => { if (game.talk.shown < game.talk.length) press("Space"); };   // skip the typing
  const say = (re) => {
    if (game.mode !== "talk") throw new Error(`not talking (mode ${game.mode}) when answering ${re}`);
    shown();
    const opts = game.talk.node.options, k = opts.findIndex((o) => re.test(o.label));
    if (k < 0) throw new Error(`no answer ${re} to "${game.talk.node.text.slice(0, 60)}…" (${opts.map((o) => o.label).join(" | ")})`);
    press(`Digit${k + 1}`);
  };
  const text = () => { if (game.mode !== "talk") return ""; shown(); return game.talk.node.text; };
  const ended = (who) => { if (game.mode === "talk") throw new Error(`the talk with ${who} didn't end`); };
  const quest = (id) => game.quests.find((q) => q.id === id);
  const expectQuest = (id, state) => {
    const q = quest(id), now = !q ? "missing" : q.done ? "done" : "active";
    if (now !== state) throw new Error(`quest ${id} is ${now}, expected ${state}`);
  };
  const first = (id) => { const e = where.get(id)?.[0]; if (!e) throw new Error(`nobody with the ${id} dialogue in levels 1-20`); go(e.z); return e.c; };

  const encounters = {
    maren() {   // the temple: the shaking floor, then (with the cube) the Lich King
      game.story.cube = false;
      const c = first("maren");
      talk(c); say(/What's down there/); say(/I'll go and see/); ended("Maren"); expectQuest("temple", "active");
      game.story.cube = true;
      talk(c); say(/another direction/); say(/fold Hollowmere/); say(/I'll stop him/); say(/Goodbye/); ended("Maren");
      expectQuest("temple", "done"); expectQuest("main", "active");
    },
    pell() {
      const c = first("pell");
      p.funds = 500; p.purse = 1000;
      talk(c); say(/news/);
      if (!/\w/.test(text())) throw new Error("Pell's news was empty");
      say(/Interesting/); say(/wares/);
      if (game.mode !== "shop") throw new Error(`"Show me your wares" opened ${game.mode}`);
      const before = p.inv.reduce((n, it) => n + (it.count || 1), 0), f0 = p.funds;
      press("Enter");
      const bought = f0 - p.funds;
      if (!(bought > 0) || p.inv.reduce((n, it) => n + (it.count || 1), 0) < before) throw new Error(`buying from Pell: paid ${bought}`);
      press("Tab");   // sell: a mace from the pack
      p.inv.unshift({ kind: "weapon", id: "mace", ench: 1, known: true });
      const f1 = p.funds;
      press("Enter");
      if (!(p.funds > f1)) throw new Error("selling to Pell paid nothing");
      press("Tab");   // services: the first one Pell offers (talk.js servicesFor), which must change its target
      const svc = servicesFor(game, c)[0];
      if (!svc) throw new Error("Pell offers no service");
      const item = svc.target.it || svc.target, was = JSON.stringify(item);
      const f2 = p.funds;
      press("Enter");
      if (!(p.funds < f2)) throw new Error("Pell's first service cost nothing");
      if (JSON.stringify(item) === was) throw new Error(`Pell's ${svc.id} took the money and left the ${item.kind} as it was`);
      press("Escape");
      if (game.mode !== "talk") throw new Error(`Esc from the shop went to ${game.mode}`);
      say(/Goodbye/); ended("Pell");
      steps.push(`Pell: bought for ${bought}, sold for ${f2 - f1}, ${svc.id} for ${f2 - p.funds}`);
    },
    corwin() {
      const c = first("corwin");
      talk(c); say(/find something/); ended("Corwin"); expectQuest("corwin", "active");
      p.inv.push({ kind: "potion", effect: "healing", count: 1 });
      game.knownPotions.add("healing");
      const weapons = p.inv.filter((it) => it.kind === "weapon").length;
      talk(c); say(/potion of healing/); say(/Safe travels/); ended("Corwin");
      expectQuest("corwin", "done");
      if (p.inv.filter((it) => it.kind === "weapon").length !== weapons + 1) throw new Error("Corwin gave no sword");
    },
    mira() {
      const c = first("mira");
      talk(c); say(/Deal/); ended("Mira"); expectQuest("mira", "active");
      talk(c); say(/keep looking/);
      game.zone.seen.fill(1);   // the floor mapped (as walking it would)
      talk(c); say(/Hand over/); say(/Goodbye/); ended("Mira");
      expectQuest("mira", "done");
    },
    rook() {
      const c = first("rook");
      talk(c); say(/Consider it done/); ended("Rook"); expectQuest("rook", "active");
      const quarry = game.zone.creatures.find((m) => m.bounty);
      if (!quarry) throw new Error("Rook's quarry isn't on his floor");
      killMonster(game, quarry, `The ${quarry.name} dies.`);
      if (!/dead/.test(quest("rook").text)) throw new Error(`Rook's quest text after the kill: "${quest("rook").text}" (the bus didn't route "kill")`);
      const f0 = p.funds;
      talk(c); say(/Take the bounty/); ended("Rook");
      expectQuest("rook", "done");
      if (!(p.funds > f0)) throw new Error("Rook paid no bounty");
    },
    lio() {
      const c = first("lio");
      talk(c); say(/I'll find it/); ended("Lio"); expectQuest("lio", "active");
      const [lx, ly] = c.talk.state.lever, [fx, fy] = c.talk.state.leverFront || [];
      const zone = game.zone, front = fx !== undefined ? [fx, fy] : [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oy]) => [lx + ox, ly + oy]).find(([x, y]) => zone.stand[x + y * zone.w] >= 0);
      Object.assign(p, { x: front[0] + 0.5, y: front[1] + 0.5, z: zone.stand[front[0] + front[1] * zone.w], vz: 0 });
      game.mode = "map"; game.view = "map";
      game.debug.mapKey(ARROWS[`${lx - front[0]},${ly - front[1]}`]);   // walk into the lever
      if (!c.talk.state.free) throw new Error("pulling the lever didn't free Lio");
      const perks = p.bonusPerks || 0;
      talk(c); say(/listening/); ended("Lio");
      expectQuest("lio", "done");
      if ((p.bonusPerks || 0) !== perks + 1) throw new Error("Lio taught no trick");
    },
    brann() {
      const e = where.get("brann")?.[0];
      if (!e) throw new Error("no Brann in levels 1-20");
      // You meet a ghost in 3D with the torch out, in either view.
      const saved = view;
      go(e.z);
      game.view = "3d"; game.mode = "explore";
      const c = e.c, spot = beside(c.tx, c.ty, c.z);
      p.yaw = Math.atan2(c.y - p.y, c.x - p.x); p.pitch = 0;
      p.torch = true; press("KeyE");
      if (game.mode === "talk") throw new Error("Brann talked with the torch lit");
      p.torch = false; press("KeyE");
      if (game.mode !== "talk") throw new Error(`facing Brann with the torch out opened ${game.mode}`);
      counts.talks++;
      say(/I'll find it/); ended("Brann"); expectQuest("brann", "active");
      const skull = findSkull(e.z + 1);
      if (!skull) throw new Error(`no skull on level ${e.z + 1}`);
      const sx = Math.floor(skull.x), sy = Math.floor(skull.y);
      const spot2 = beside(sx, sy, skull.z);
      if (view === "map") game.debug.mapKey(ARROWS[`${sx - spot2[0]},${sy - spot2[1]}`]);
      else {
        Object.assign(p, { x: skull.x, y: skull.y, z: game.zone.stand[sx + sy * game.zone.w], vz: 0 });
        for (let k = 0; k < 10 && !p.inv.some((it) => it.id === "skull"); k++) { playing(); game.debug.step(1 / 60); }
        if (!p.inv.some((it) => it.id === "skull")) throw new Error(`3D: standing on the skull (mode ${game.mode}, paused ${game.paused}, skull z ${skull.z}, you ${p.z})`);
      }
      if (!p.inv.some((it) => it.kind === "quest" && it.id === "skull")) throw new Error("the skull wasn't picked up");
      go(e.z);
      void spot; void saved;
      talk(c); say(/Give Brann his skull/); say(/Rest well/); ended("Brann");
      expectQuest("brann", "done");
    },
    essAndTee() {
      const ess = first("ess");
      talk(ess); say(/look for her/); ended("Ess"); expectQuest("ess", "active");
      const tee = first("tee");
      const f0 = p.funds;
      talk(tee); say(/sister misses you/); say(/Go home safe/); ended("Tee");
      expectQuest("ess", "done");
      if (!(p.funds > f0)) throw new Error("Tee gave nothing");
      talk(first("ess")); say(/Goodbye/); ended("Ess");
    },
    door() {
      const c = first("door"), s = c.talk.state;
      const wrong = s.choices.find((n) => n !== s.answer);
      const before = game.zone.creatures.length;
      talk(c); say(new RegExp(`^"${wrong}\\.?"`)); say(/Goodbye/); ended("the Speaking Door");
      if (s.open) throw new Error("the wrong number opened the gate");
      const hatch = game.zone.creatures.length - before;
      game.zone.creatures = talkersIn(game.zone);
      talk(c); say(new RegExp(`^"${s.answer}\\.?"`)); say(/Goodbye/); ended("the Speaking Door");
      if (!s.open || s.gate.some(([x, y, z]) => game.zone.get(x, y, z) !== B.AIR)) throw new Error("the right number didn't open the gate");
      steps.push(`the Speaking Door: wrong answer let out ${hatch}, the right one opened ${s.gate.length} gate cells`);
    },
    shrines() {
      const all = where.get("shrine") || [];
      if (all.length < 1) throw new Error("no shrine in levels 1-20");
      // A plain offering.
      const { z, c } = all[0];
      go(z);
      p.funds = 1000; p.purse = 1000;
      talk(c); say(/^Offer /); say(/Thank you/); ended("the shrine");
      if (!c.talk.state.used) throw new Error("the shrine took no offering");
      // A bold one, until one asks for a trial (one in four); then win it and come back.
      let trials = 0, tries = 0;
      for (const { z: tz, c: t } of [...all, ...all, ...all, ...all]) {
        if (trials) break;
        go(tz); tries++;
        Object.assign(t.talk.state, { used: false, trial: null });
        p.funds = 1000;
        talk(t); say(/bold offering/);
        if (t.talk.state.trial) {
          trials++;
          say(/Fine/); ended("the shrine");
          talk(t);
          if (!/NOT OVER/.test(text())) throw new Error(`a shrine with its trial unfought said "${text()}"`);
          say(/Goodbye/);
          for (const m of game.zone.creatures.filter((o) => t.talk.state.trial.includes(o.id))) killMonster(game, m, "");
          talk(t); say(/Thank you/); ended("the shrine");
          if (t.talk.state.trial) throw new Error("the trial won, the shrine still waits");
        } else { say(/Thank you/); ended("the shrine"); }
      }
      steps.push(`shrines: ${all.length} in levels 1-20, a plain offering, ${tries} bold ones until a trial`);
      if (!trials) throw new Error(`no trial in ${tries} bold offerings`);
    },
  };
  for (const [name, run] of Object.entries(encounters)) {
    try { run(); done.push(name); }
    catch (e) {
      problems.push(`${view} ${name}: ${String(e.stack || e).split(/\r?\n/).slice(0, 3).join(" | ")}`);
      if (game.mode === "talk" || game.mode === "shop") { game.talk = null; game.shop = null; }
    }
  }
  off.forEach((f) => f());
  const quests = game.quests.filter((q) => q.done).map((q) => q.id);
  if (counts.questEvents !== game.quests.length + quests.length) problems.push(`${view}: ${counts.questEvents} quest:start/done events on the bus for ${game.quests.length} quests, ${quests.length} done`);
  if (quests.length !== 7 || game.quests.length !== 8) problems.push(`${view}: ${quests.length} of ${game.quests.length} quests done (want 7 of 8: all but the Lich King's)`);
  steps.unshift(`${view}: ${done.length} of ${Object.keys(encounters).length} encounters to the end (${done.join(", ")}); quests done ${quests.length} (${quests.join(", ")}); ${counts.talks} talks, ${counts.keys} keys, ${counts.questEvents} quest events`);
  return { ok: problems.length === 0, steps, problems, stats: { done, quests, ...counts } };
}

// Golden (a) through one view's controls. Returns { ok, steps, problems, stats }.
export async function runGoldenA({ view = "map" } = {}) {
  const fixtures = { mechanics: JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "golden", "mechanics.json"), "utf8")) };
  const api = await currentApi(env, seedRandom);
  const press = (code) => inputHandlers.onKeyDown(code, false, code);
  const counts = { keys: 0, mapSteps: 0, frames: 0 };
  const key = (code) => { press(code); counts.keys++; };
  const frame = () => { game.debug.step(1 / 60); counts.frames++; };
  const ready = () => {   // back in the view, playing
    if (view === "map") { game.view = "map"; if (game.mode === "explore") game.mode = "map"; }
    else { game.view = "3d"; if (game.mode === "map") game.mode = "explore"; game.paused = false; }
  };
  const openInv = () => { ready(); key("KeyI"); if (game.mode !== "inventory") throw new Error(`I opened ${game.mode}, not the inventory`); };
  const after = () => { if (view === "3d" && game.mode === "explore") frame(); };
  let lying = null;
  const bot = {
    ...api,
    name: `bot ${view}`,
    prepare() { api.prepare(); ready(); },
    useInv(index) {
      openInv();
      for (let k = 0; k < 64 && game.invSel !== index; k++) key(game.invSel < index ? "ArrowDown" : "ArrowUp");
      if (game.invSel !== index) throw new Error(`the selection stuck at ${game.invSel}, not ${index}`);
      key("Enter");
      if (game.mode === "inventory") key("Escape");   // nothing happened (a refusal keeps it open)
      after();
    },
    invKey(code) { openInv(); key(code); if (game.mode === "inventory") key("Escape"); after(); },
    dropAtFeet(item) { lying = item; },
    pickUp() {
      const p = game.player, zone = game.zone;
      if (view === "3d") { zone.items.push(api_makeItem(lying, p.x, p.y, p.z)); frame(); return; }
      const tx = Math.floor(p.x), ty = Math.floor(p.y), here = zone.stand[tx + ty * zone.w];
      const next = Object.entries(ARROWS).map(([d, code]) => [...d.split(",").map(Number), code])
        .find(([dx, dy]) => zone.stand[tx + dx + (ty + dy) * zone.w] === here && !talkersIn(zone).some((n) => n.tx === tx + dx && n.ty === ty + dy)
          && zone.get(tx + dx, ty + dy, FLOOR_Z - 1) !== B.STAIRS && zone.get(tx + dx, ty + dy, FLOOR_Z - 1) !== B.STAIRS_UP);
      if (!next) throw new Error(`no free tile beside (${tx}, ${ty}) to lay the ${lying.kind} on`);
      zone.items.push(api_makeItem(lying, tx + next[0] + 0.5, ty + next[1] + 0.5, here));
      ready(); game.debug.mapKey(next[2]); counts.mapSteps++;
    },
    takePerk(k) {
      ready();
      game.perkChoices = [k]; game.levelReturn = game.mode; game.mode = "levelup";
      key("Digit1");
      after();
    },
  };
  const r = checkGolden(bot, fixtures, { only: ["mechanics"] });
  const st = r.stats.mechanics || {};
  return { ok: r.ok, steps: [`golden (a) ${view}: ${st.steps} steps, ${st.mismatched} mismatched`], problems: r.problems,
           stats: { steps: st.steps, mismatched: st.mismatched, ...counts } };
}
const api_makeItem = (item, x, y, z) => ({ ...item, x, y, z });

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  const views = !args.view || args.view === "both" ? ["map", "3d"] : [args.view];
  let ok = true;
  for (const view of views) {
    for (const [what, r] of [["golden (a)", await runGoldenA({ view })],
                             ["stairs", runStairs({ seed: Number(args.seed) || 1234, view })],
                             ["smoke", runSmoke({ seed: Number(args.seed) || 1234, view })],
                             ["encounters", runEncounters({ seed: Number(args.seed) || 1234, view })],
                             ...(view === "3d" ? [["edges", runEdges({ seed: Number(args.seed) || 1234 })]] : [])]) {
      console.log(`${r.ok ? "OK  " : "FAIL"} ${view} ${what}: ${r.steps.join(" · ")}`);
      for (const p of r.problems) console.log(`  ✗ ${p}`);
      ok &&= r.ok;
    }
  }
  process.exit(ok ? 0 : 1);
}
