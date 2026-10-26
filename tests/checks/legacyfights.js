// Legacy fights, draw for draw: the legacy combat set must make the parent game's Math.random draws in
// the parent's order (combat.js legacyBlow), and golden (a)/(b) have no blows in them. This plays a
// scripted fight on several dungeon levels with a seeded Math.random, in both views, and compares every
// step with a trace recorded from the p0-0b tree (the last tree before 0C moved combat;
// tools/legacy-fights-record.mjs). A new fixture: no golden fixture is re-recorded.
//
//   playLegacyFights({ game, startRun, inputHandlers, keys }, view) → [{ tag, h }]
//       h: a hash of the step: your HP, place and XP, the last messages, and every monster's type, tile,
//       HP and state. Works against today's src and the p0-0b tree (zone.monsters there).
//   checkLegacyFights(steps, fixture) → { name, ok, problems, stats }
//       steps/fixture: { map: [...], "3d": [...] }
//
// The script: on dungeon levels 1-6, 9, 10 and 12 you start two tiles from the first monster with 5000 HP.
// On the map: bumps toward it, thrown knives (T), waits (Space) and the torch (F), 150 turns a level.
// In 3D: walking at it and swinging (Enter) every 20 frames, a throw every 90, the torch every 300,
// 600 frames of 1/60 s a level. Kills, XP, archers, elites, spiders, the guardians and the creatures'
// blows on you all come through it.
import { hashString } from "../lib/hash.js";

export const LEVELS = [1, 2, 3, 4, 5, 6, 9, 10, 12];
const ARROWS = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
const monstersOf = (z) => z.monsters || z.creatures.filter((c) => !c.talk);

export function playLegacyFights({ game, startRun, inputHandlers, keys }, view) {
  const settle = () => {
    for (let k = 0; k < 400 && game.mode !== "map" && game.mode !== "explore"; k++) {
      if (game.mode === "story") { game.pages = null; game.mode = game.view === "map" ? "map" : "explore"; break; }
      game.debug.step(1 / 30);
    }
  };
  const steps = [];
  const snap = (tag) => {
    const p = game.player, z = game.zone;
    const s = [z.key, game.mode, Math.round(p.hp * 1000) / 1000, p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3), p.xp,
               game.messages.slice(-3).map((m) => m.text).join("|"),
               monstersOf(z).map((m) => `${m.type}@${m.tx},${m.ty}:${Math.round(m.hp * 100) / 100}/${m.state}`).join(" ")].join(";");
    steps.push({ tag: String(tag), h: hashString(s, 7).toString(36) });
  };
  startRun(4242);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  for (const lv of LEVELS) {
    game.view = view === "3d" ? "3d" : "map";
    game.mode = game.view === "map" ? "map" : "explore";
    game.debug.enterZone(`0,0,${lv}`, "down"); settle();
    const zone = game.zone, p = game.player;
    p.maxHpGain = 0; p.hp = 5000;
    const target = monstersOf(zone)[0];
    if (target) {
      const spot = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [3, 0], [0, 3]].map(([ox, oy]) => [target.tx + ox, target.ty + oy])
        .find(([x, y]) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0);
      if (spot) Object.assign(p, { x: spot[0] + 0.5, y: spot[1] + 0.5, z: zone.stand[spot[0] + spot[1] * zone.w], vz: 0 });
    }
    snap(`enter ${lv}`);
    if (view === "map") {
      const codes = ["ArrowRight", "KeyT", "ArrowLeft", "ArrowDown", "KeyT", "ArrowUp", "Space", "KeyF"];
      for (let k = 0; k < 150 && game.zone === zone; k++) {
        if (game.mode !== "map") { settle(); if (game.mode !== "map") { snap(`${lv} mode ${game.mode}`); break; } }
        const m = monstersOf(zone)[0];
        const toward = m && k % 4 ? ARROWS[`${Math.sign(m.tx - Math.floor(p.x))},0`] || ARROWS[`0,${Math.sign(m.ty - Math.floor(p.y))}`] : null;
        game.debug.mapKey(toward || codes[k % codes.length]);
        if (p.hp < 100) p.hp = 5000;
        snap(`${lv}:${k}`);
      }
    } else {
      game.paused = false; keys.add("KeyW");
      for (let k = 0; k < 600 && game.zone === zone; k++) {
        if (game.mode !== "explore") { settle(); if (game.mode !== "explore") { snap(`${lv} mode ${game.mode}`); break; } game.paused = false; }
        const m = monstersOf(zone)[0];
        if (m) p.yaw = Math.atan2(m.y - p.y, m.x - p.x);
        if (k % 20 === 0) inputHandlers.onKeyDown("Enter", false, "Enter");
        if (k % 90 === 45) inputHandlers.onKeyDown("KeyT", false, "t");
        if (k % 300 === 150) inputHandlers.onKeyDown("KeyF", false, "f");
        game.debug.step(1 / 60);
        if (p.hp < 100) p.hp = 5000;
        if (k % 5 === 0) snap(`${lv}:${k}`);
      }
      keys.delete("KeyW");
    }
  }
  return steps;
}

export function checkLegacyFights(steps, fixture) {
  const problems = [], stats = {};
  for (const view of ["map", "3d"]) {
    const got = steps[view], want = fixture[view];
    if (got.length !== want.length) problems.push(`${view}: ${got.length} steps, the p0-0b trace has ${want.length}`);
    const k = want.findIndex((w, i) => !got[i] || got[i].tag !== w.tag || got[i].h !== w.h);
    if (k >= 0) problems.push(`${view}: differs from p0-0b from step ${k} (${want[k].tag}${got[k] ? `, here ${got[k].tag}` : ""}): legacy combat's Math.random draws moved`);
    const diff = want.filter((w, i) => !got[i] || got[i].h !== w.h).length;
    stats[view] = { steps: got.length, differing: diff, levels: LEVELS.length };
  }
  return { name: "legacyfights", ok: problems.length === 0, problems, stats };
}
