// Statuses (status.js) and bulk time (time.js): TECH_DESIGN §2.7 and the 0B gate.
//
//   checkStatus({ game, startRun, inputHandlers, srcFiles, capture }) → { name, ok, problems, stats }
//
//   1. Migration: no timer field of the parent game is left in src/ (the player's flyTime, hasteTime,
//      shadowTime, poisonTime, paralyzed, darkTime, guardTime; the creatures' burn, chill, stun, blind,
//      poison, haste; the per-floor flags secondWind, firstBlocked and foldReady), and no text that still
//      says "once per floor" (Second wind, the warding amulet).
//   2. skipTime(600) equals stepping 1/60 s at a time (effects.js tickEffects, as play does), within
//      ±1 HP and ±0.1 s for every status and cooldown: poison with regeneration, poison and regeneration
//      fighting at full health, a cursed ring that drains, the attribute formulas' natural regeneration
//      (which poison stops), and creatures burning and poisoned (one of them to death).
//   3. skipTime stops for a hostile awake nearby (nothing passes), stops on until(), and a rest of an
//      hour clears the second-wind and first-block cooldowns; 8 game hours take ≤ 20 ms.
//   4. Drowning: a non-swimmer stepping into surface deep water on the map and walking into it in 3D
//      gets the same timer (RULES.drown.air s of breath), the same damage at the same moments, and
//      the status ends when the feet leave the water, in both views. A swimmer doesn't drown. On the
//      map only the first step in from dry ground asks; a step inside the water just swims.
//   5. Flat: the map view is forced, Tab is locked until it ends, the HUD shows it. Escape (the map's
//      other way of turning) is locked too, and no fold power fires (Folding strike, a rat next to you).
//      Set down safely when it ends: one tile into the pond with a person, a rat and a rat stepping onto
//      the three shore tiles next to you, you come up on the nearest free one two tiles off; in the
//      pond's middle (no dry tile within 3) you still come up on dry ground.
//
//   6. The HUD row (hud.js drawHud, read back from the screen) shows every active status's text in its
//      colour, in both views, and drops it once the status is removed.
//
// game/startRun/inputHandlers: the real game (game.js). srcFiles: [{ file, text }] of every src/ module.
// capture: node-env's presented frame.
import { RULES, overrideRules } from "../../src/rules.js";
import { Zone, B, FLOOR_Z } from "../../src/world.js";
import { enterZone } from "../../src/zones.js";
import { keys } from "../../src/input.js";
import { mapStep, mapWait, passTime } from "../../src/turns.js";
import { tickEffects } from "../../src/effects.js";
import { spawnMonster } from "../../src/monsters.js";
import { skipTime } from "../../src/time.js";
import { maxHp, invalidateStats } from "../../src/stats.js";
import * as St from "../../src/status.js";
import { hudRow } from "../lib/hud.js";

const OLD_FIELDS = /\b(flyTime|hasteTime|shadowTime|poisonTime|darkTime|guardTime|poisonTick|burnTick|foldReady|firstBlocked)\b|\.paralyzed\b|\b(m|o|t|c|e|monster)\.(burn|chill|stun|blind|poison|haste)\b|zone\.secondWind/g;
const STEP = 1 / 60;

// A flat surface zone with a pond of deep water (rock bottom) at x 30..49, y 14..33.
function pondZone() {
  const z = new Zone({ key: "status-pond", wx: 99, wy: 99, z: 0, type: "surface", level: 1, seed: 5, w: 80, d: 48, h: 16, name: "Pond Test" });
  for (let y = 0; y < z.d; y++)
    for (let x = 0; x < z.w; x++) {
      const pond = x >= 30 && x < 50 && y >= 14 && y < 34;
      for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? (pond ? B.WATER_DEEP : B.GRASS) : B.ROCK);
    }
  z.hasSky = true; z.outdoor = true;
  z.edges = { n: null, s: null, e: null, w: null };
  z.refresh();
  z.spawn = { x: 25.5, y: 24.5, z: FLOOR_Z, yaw: 0 };
  return z.seal();
}

export function checkStatus({ game, startRun, inputHandlers, srcFiles, capture }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);

  // --- 1. Migration ----------------------------------------------------------------------------
  let left = 0;
  for (const { file, text } of srcFiles) {
    if (file === "status.js") continue;   // its header names what it replaced
    for (const m of text.matchAll(OLD_FIELDS)) { left++; if (left <= 5) fail(`old timer field ${m[0]} in src/${file}`); }
  }
  stats.oldTimerFields = left;
  // The per-floor rules became game-time cooldowns: no text may still promise "once per floor".
  const perFloor = srcFiles.flatMap(({ file, text }) => [...text.replace(/\/\/.*$/gm, "").matchAll(/once per floor|first blow on each floor/gi)].map((m) => `${file}: ${m[0]}`));
  if (perFloor.length) fail(`text still describes a per-floor rule: ${perFloor.join("; ")}`);

  // --- 2. skipTime(600) against 1/60 s stepping --------------------------------------------------
  startRun(4242);
  game.zone.monsters.length = 0;
  game.mode = "map"; game.view = "map";
  const base = game.player;
  const snap = (p) => ({
    hp: p.hp, dead: game.mode === "dead",
    status: Object.fromEntries(Object.entries(p.status || {}).map(([k, s]) => [k, s.t])),
    cooldowns: { ...(p.cooldowns || {}) },
  });
  const compare = (what, a, b) => {
    const dHp = Math.abs(a.hp - b.hp);
    let dT = 0;
    for (const group of ["status", "cooldowns"])
      for (const k of new Set([...Object.keys(a[group]), ...Object.keys(b[group])])) {
        if ((k in a[group]) !== (k in b[group])) {
          const t = a[group][k] ?? b[group][k];   // one ended a hair earlier: fine within 0.1 s
          if (t > 0.1) fail(`${what}: ${group}.${k} only on one side (${a[group][k]} vs ${b[group][k]})`);
          dT = Math.max(dT, t);
          continue;
        }
        dT = Math.max(dT, Math.abs(a[group][k] - b[group][k]));
      }
    if (dHp > 1) fail(`${what}: skipTime HP ${a.hp}, stepping HP ${b.hp}`);
    if (dT > 0.1) fail(`${what}: timers differ by ${dT.toFixed(3)} s`);
    if (a.dead !== b.dead) fail(`${what}: dead after skipTime ${a.dead}, after stepping ${b.dead}`);
    return { dHp, dT: +dT.toFixed(4) };
  };
  const playerCase = (what, setup, seconds = 600) => {
    const proto = structuredClone({ ...base, status: {}, cooldowns: {} });
    setup(proto);
    const run = (fn) => {
      game.player = structuredClone(proto); invalidateStats(game.player);
      game.mode = "map"; game.time = 1000;
      fn(game.player);
      return snap(game.player);
    };
    const a = run(() => skipTime(game, seconds, { interruptible: false }));
    const b = run(() => { for (let k = 0, n = Math.round(seconds / STEP); k < n && game.mode !== "dead"; k++) { game.time += STEP; tickEffects(game, STEP); } });
    return { ...compare(what, a, b), hp: [a.hp, b.hp] };
  };
  const ring = (n) => ({ kind: "ring", id: "regeneration", ench: n, known: true });
  const cases = {};
  cases.poisonRegenCooldowns = playerCase("poison, regeneration and cooldowns", (p) => {
    p.hp = 15; p.body.equip.finger_r = ring(2);
    p.status = { poisoned: { t: 10, mag: 1, src: null, acc: 0 }, hasted: { t: 15, mag: 1, src: null, acc: 0 },
                 flying: { t: 20, mag: 1, src: null, acc: 0 }, darkened: { t: 650, mag: 1, src: null, acc: 0 } };
    p.cooldowns = { secondWind: 300, firstBlock: 120, foldingStrike: 10, long: 640.5 };
  });
  cases.poisonAgainstRegenAtFull = playerCase("slow poison against regeneration at full health", (p) => {
    p.hp = 15; p.body.equip.finger_r = ring(1);
    p.status = { poisoned: { t: 900, mag: 0.05, src: null, acc: 0 } };
  });
  cases.thickBloodDrain = playerCase("Thick blood, poison and a cursed ring that drains", (p) => {
    p.hp = 20; p.body.equip.finger_r = ring(-1); p.perks = new Set(["thickBlood"]);
    p.status = { poisoned: { t: 25, mag: 1, src: null, acc: 0 } };
  });
  cases.deadlyPoison = playerCase("poison that kills", (p) => {
    p.hp = 9;
    p.status = { poisoned: { t: 60, mag: 1, src: null, acc: 0 } };
  });
  cases.deathMidStep = playerCase("poison kills; the statuses after it still run to the moment of death", (p) => {
    p.hp = 4; p.body.equip.finger_r = ring(2);
    p.status = { poisoned: { t: 33, mag: 0.5, src: null, acc: 0 }, hasted: { t: 14, mag: 1, src: null, acc: 0 } };
  });
  {
    const undo = overrideRules("stats", "attributes");
    cases.naturalRegen = playerCase("attribute formulas: natural regeneration, stopped while poisoned", (p) => {
      p.hp = 12;
      p.status = { poisoned: { t: 100, mag: 0.1, src: null, acc: 0 } };
      p.cooldowns = { firstBlock: 33.3 };
    });
    undo();
  }
  // Creatures: their statuses alone (time.js adds regeneration and attack cooldowns on top).
  {
    const mk = (hp) => {
      const m = spawnMonster("rat", 5, 5, FLOOR_Z, "idle", 1, null, () => 0.5);
      m.hp = m.maxHp = hp;
      m.status = { burning: { t: 40, mag: 1, src: null, acc: 0 }, poisoned: { t: 12, mag: 2, src: null, acc: 0 },
                   blinded: { t: 10, mag: 1, src: null, acc: 0 }, stunned: { t: 6, mag: 1, src: null, acc: 0 } };
      m.cooldowns = { spit: 77 };
      return m;
    };
    for (const [what, hp] of [["creature burning and poisoned", 500], ["creature burned to death", 30]]) {
      const run = (fn) => {
        const m = mk(hp);
        game.zone.monsters.length = 0; game.zone.monsters.push(m);
        fn(m);
        return { hp: m.hp, dead: false,
                 status: Object.fromEntries(Object.entries(m.status).map(([k, s]) => [k, s.t])), cooldowns: { ...m.cooldowns },
                 gone: !game.zone.monsters.includes(m) };
      };
      game.mode = "map";
      const a = run((m) => St.catchUpStatuses(game, m, 600));
      const b = run((m) => { for (let k = 0; k < 36000 && game.zone.monsters.includes(m); k++) St.tickStatuses(game, m, STEP); });
      if (a.gone !== b.gone) fail(`${what}: killed after catch-up ${a.gone}, after stepping ${b.gone}`);
      if (hp === 30 && !a.gone) fail(`${what}: it should have burned to death`);
      cases[what] = a.gone ? { killed: true, hp: [a.hp, b.hp] } : { ...compare(what, a, b), hp: [a.hp, b.hp], killed: false };
    }
    game.zone.monsters.length = 0;
  }
  stats.skipTime600 = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, v]));

  // --- 3. Interruptions, until, rest, speed -----------------------------------------------------
  game.player = structuredClone({ ...base, status: {}, cooldowns: {} }); invalidateStats(game.player);
  game.mode = "map";
  const p0 = game.player;
  const foe = spawnMonster("rat", Math.floor(p0.x) + 3, Math.floor(p0.y), FLOOR_Z, "chase", 1, null, () => 0.5);
  foe.x = p0.x + 3; foe.y = p0.y;
  game.zone.monsters.push(foe);
  const t0 = game.time, r1 = skipTime(game, 60);
  if (!(r1.interrupted && r1.why === "hostile" && r1.elapsed === 0 && game.time === t0)) fail(`skipTime with a hostile awake 3 tiles away: ${JSON.stringify(r1)}`);
  const r1b = skipTime(game, 60, { interruptible: false });
  if (r1b.elapsed !== 60) fail(`skipTime, not interruptible, with a hostile near: elapsed ${r1b.elapsed}`);
  game.zone.monsters.length = 0;
  p0.hp = 5; p0.body.equip.finger_r = ring(2); invalidateStats(p0);
  const r2 = skipTime(game, 3600, { until: (g) => g.player.hp >= maxHp(g.player) });
  if (!(r2.why === "until" && !r2.interrupted && p0.hp === maxHp(p0) && r2.elapsed <= (maxHp(p0) - 5) * 6 + 1))
    fail(`skipTime until healed: ${JSON.stringify(r2)}, HP ${p0.hp}/${maxHp(p0)}`);
  p0.cooldowns = { secondWind: 99999, firstBlock: 99999, foldingStrike: 99999 };
  skipTime(game, RULES.cooldown.restClears, { reason: "rest" });
  if (St.cooldownLeft(p0, "secondWind") || St.cooldownLeft(p0, "firstBlock") || !St.cooldownLeft(p0, "foldingStrike"))
    fail(`an hour's rest should clear second wind and first block only: ${JSON.stringify(p0.cooldowns)}`);
  p0.cooldowns = { secondWind: 99999 };
  skipTime(game, RULES.cooldown.restClears - 1, { reason: "rest" });
  if (!St.cooldownLeft(p0, "secondWind")) fail("a rest shorter than an hour cleared second wind");
  p0.hp = 3; p0.status = { poisoned: { t: 4000, mag: 0.01, src: null, acc: 0 } }; invalidateStats(p0);
  const tp = performance.now();
  skipTime(game, 8 * 3600, { interruptible: false, reason: "rest" });
  stats.skip8hMs = +(performance.now() - tp).toFixed(2);
  p0.hp = 3; p0.status = { poisoned: { t: 99999, mag: 0.05, src: null, acc: 0 } }; invalidateStats(p0);   // vs regeneration: ~6,000 events
  const tw = performance.now();
  skipTime(game, 8 * 3600, { interruptible: false, reason: "rest" });
  stats.skip8hPoisonedMs = +(performance.now() - tw).toFixed(2);   // poison and healing all the way
  if (stats.skip8hMs > 20 || stats.skip8hPoisonedMs > 20) fail(`skipTime over 8 game hours took ${stats.skip8hMs} / ${stats.skip8hPoisonedMs} ms (budget 20)`);

  // --- 4. Drowning on the map and in 3D -------------------------------------------------------------
  const zone = pondZone();
  const freshPlayer = () => {
    game.player = structuredClone({ ...base, status: {}, cooldowns: {}, perks: new Set() });
    game.player.body.equip.finger_r = null;
    invalidateStats(game.player);
    game.player.hp = maxHp(game.player);
  };
  const hurtLog = [];
  const hurt = game.hurtPlayer;
  game.hurtPlayer = function (dmg, source, quiet) { hurtLog.push({ t: game.time, dmg, source }); return hurt.call(this, dmg, source, quiet); };
  const enter = () => {
    enterZone(game, zone, { how: "start" });
    game.travel = null; game.paused = false; game.confirmJump = -1;
  };
  const drownTrace = (view) => {
    freshPlayer(); hurtLog.length = 0; enter();
    const p = game.player;
    p.x = 28.5; p.y = 24.5; p.z = FLOOR_Z; p.yaw = 0; p.pitch = 0; p.vz = 0; p.onGround = true;
    let tIn = null, exitedAt = null, exitTile = null;
    if (view === "map") {
      game.mode = "map"; game.view = "map";
      mapStep(game, 1, 0);                       // onto (29, 24): grass
      mapStep(game, 1, 0);                       // asks first ("the water is deep")
      const asked = !St.hasStatus(p, "drowning") && Math.floor(p.x) === 29;
      const before = game.time;
      mapStep(game, 1, 0);                       // in
      tIn = St.hasStatus(p, "drowning") ? before : null;
      if (!asked) fail("map: stepping into surface deep water didn't ask first");
      while (tIn !== null && game.time - tIn < 15 && game.mode === "map") mapWait(game);
      mapStep(game, -1, 0);                      // back onto the grass
      if (!St.hasStatus(p, "drowning")) { exitedAt = game.time; exitTile = Math.floor(p.x); }
    } else {
      game.mode = "explore"; game.view = "3d";
      keys.clear(); keys.add("KeyW");
      for (let k = 0; k < 600 && !St.hasStatus(p, "drowning"); k++) game.debug.step(STEP);
      keys.clear();
      tIn = St.hasStatus(p, "drowning") ? game.time - (St.statusOf(p, "drowning").acc) : null;
      while (tIn !== null && game.time - tIn < 15 && game.mode === "explore") game.debug.step(STEP);
      p.yaw = Math.PI; keys.add("KeyW");
      for (let k = 0; k < 1200 && St.hasStatus(p, "drowning"); k++) game.debug.step(STEP);
      keys.clear();
      if (!St.hasStatus(p, "drowning")) { exitedAt = game.time; exitTile = Math.floor(p.x); }
    }
    const drown = hurtLog.filter((h) => h.source === "drowning");
    const hits = drown.map((h) => +(h.t - tIn).toFixed(3)), dmgs = drown.map((h) => h.dmg);
    return { tIn: tIn !== null, hits, dmgs, damage: hurtLog.reduce((s, h) => s + h.dmg, 0), exited: exitedAt !== null, exitTile, x: +p.x.toFixed(2), mode: game.mode };
  };
  const onMap = drownTrace("map"), in3d = drownTrace("3d");
  const firstHit = RULES.drown.air + 1 / RULES.drown.dps;
  for (const [view, tr] of [["map", onMap], ["3D", in3d]]) {
    if (!tr.tIn) { fail(`${view}: a non-swimmer in surface deep water got no drowning status`); continue; }
    if (!tr.hits.length || Math.abs(tr.hits[0] - firstHit) > 2 * STEP) fail(`${view}: first drowning damage at ${tr.hits[0]} s (want ${firstHit})`);
    if (!tr.exited || tr.exitTile >= 30) fail(`${view}: drowning didn't end on leaving the water (exit tile ${tr.exitTile})`);
  }
  const common = Math.min(onMap.hits.filter((t) => t < 15).length, in3d.hits.filter((t) => t < 15).length);
  const mapHits = onMap.hits.filter((t) => t < 15), hits3d = in3d.hits.filter((t) => t < 15);
  if (mapHits.length !== hits3d.length) fail(`drowning damage in the first 15 s: map ${mapHits.length}, 3D ${hits3d.length}`);
  for (let k = 0; k < common; k++)
    if (Math.abs(mapHits[k] - hits3d[k]) > 2 * STEP) fail(`drowning hit ${k + 1}: map at ${mapHits[k]} s, 3D at ${hits3d[k]} s`);
    else if (onMap.dmgs[k] !== in3d.dmgs[k]) fail(`drowning hit ${k + 1}: map ${onMap.dmgs[k]} damage, 3D ${in3d.dmgs[k]}`);
  if (onMap.damage !== in3d.damage) fail(`drowning damage in all: map ${onMap.damage}, 3D ${in3d.damage}`);
  stats.drowning = { firstHitWant: firstHit, map: { hits: mapHits, damage: onMap.damage, exitTile: onMap.exitTile },
                     "3d": { hits: hits3d, damage: in3d.damage, exitTile: in3d.exitTile } };
  // Inside deep water (drowning) every press on the map swims on: only the first step in asks.
  freshPlayer(); enter();
  Object.assign(game.player, { x: 29.5, y: 24.5, z: FLOOR_Z });
  game.mode = "map"; game.view = "map";
  mapStep(game, 1, 0); mapStep(game, 1, 0);
  {
    const p = game.player, yIn = p.y;
    if (!St.hasStatus(p, "drowning")) fail("map: two steps into deep water and no drowning status");
    else if (!mapStep(game, 0, 1) || p.y !== yIn + 1 || !mapStep(game, 1, 0) || Math.floor(p.x) !== 31)
      fail(`map: a swimming step inside deep water was refused or asked again (at ${p.x}, ${p.y})`);
  }
  // A swimmer floats and doesn't drown; underground a non-swimmer still sinks (unchanged).
  freshPlayer(); enter();
  game.player.perks = new Set(["swimmer"]); invalidateStats(game.player);
  Object.assign(game.player, { x: 29.5, y: 24.5, z: FLOOR_Z });
  game.mode = "map"; game.view = "map";
  mapStep(game, 1, 0); passTime(game, 20);
  if (St.hasStatus(game.player, "drowning") || game.player.hp < maxHp(game.player) || Math.floor(game.player.x) !== 30)
    fail(`a swimmer in surface deep water: drowning ${St.hasStatus(game.player, "drowning")}, HP ${game.player.hp}, x ${game.player.x}`);
  game.hurtPlayer = hurt;

  // --- 5. Flat ----------------------------------------------------------------------------------
  freshPlayer(); enter();
  Object.assign(game.player, { x: 25.5, y: 24.5, z: FLOOR_Z });
  game.story.cube = true;   // a Turner (Tab works at all)
  game.mode = "explore"; game.view = "3d"; game.paused = false;
  St.addStatus(game, game.player, "flat", { t: 3 });
  game.debug.step(STEP);
  const forced = game.mode === "map" && game.view === "map";
  inputHandlers.onKeyDown("Tab", false);
  const locked = game.mode === "map";
  const hud = St.statusLine(game, game.player).map((s) => s.text);
  game.player.perks = new Set(["foldingStrike"]);
  const rat = spawnMonster("rat", 26, 24, FLOOR_Z, "idle", 1, null, () => 0.5);
  rat.x = 26.5; rat.y = 24.5;
  game.zone.monsters.push(rat);
  inputHandlers.onKeyDown("Escape", false);
  const escLocked = game.mode === "map" && game.view === "map";
  const folded = St.hasStatus(rat, "stunned") || St.cooldownLeft(game.player, "foldingStrike") > 0;
  game.zone.monsters.splice(game.zone.monsters.indexOf(rat), 1);
  game.player.perks = new Set();
  for (let k = 0; k < 8; k++) mapWait(game);   // 4 s: it wears off
  const ended = !St.hasStatus(game.player, "flat");
  inputHandlers.onKeyDown("Tab", false);
  const unlocked = game.mode === "explore";
  stats.flat = { forcedMap: forced, tabLocked: locked, escapeLocked: escLocked, foldPowers: folded, hud, ended, tabAfter: unlocked };
  if (!escLocked) fail("flat: Escape on the map turned the world");
  if (folded) fail("flat: Escape fired the fold powers (Folding strike)");
  if (!forced) fail(`flat in 3D: the view should switch to the map (mode ${game.mode})`);
  if (!locked) fail("flat: Tab turned the world");
  if (!hud.some((t) => t.startsWith("FLAT"))) fail(`flat: the HUD shows ${JSON.stringify(hud)}`);
  if (!ended || !unlocked) fail(`flat: after it ends (${ended}) Tab should work again (${unlocked})`);
  game.mode = "map"; game.view = "map";
  {
    const p = game.player, zone = game.zone;
    const flatAt = (x, y) => { Object.assign(p, { x, y, z: FLOOR_Z }); St.addStatus(game, p, "flat", { t: 30 }); St.removeStatus(game, p, "flat"); return [Math.floor(p.x), Math.floor(p.y)]; };
    const rat = (tx, ty, nx = tx, ny = ty) => Object.assign(spawnMonster("rat", tx, ty, FLOOR_Z, "idle", 1, null, () => 0.5), { tx, ty, nx, ny });
    zone.monsters.push(rat(29, 24), rat(28, 25, 29, 25));
    zone.npcs ||= [];
    const person = { type: "status-test", tx: 29, ty: 23 };
    zone.npcs.push(person);
    const near = flatAt(30.5, 24.5);
    zone.monsters.length = 0; zone.npcs.splice(zone.npcs.indexOf(person), 1);
    const far = flatAt(40.5, 24.5);
    mapWait(game);
    const dry = (t) => zone.stand[t[0] + t[1] * zone.w] >= 0 && !(t[0] >= 30 && t[0] < 50 && t[1] >= 14 && t[1] < 34);
    if (near.join() !== "28,22") fail(`flat ends 1 tile into the pond, shore tiles taken: set down on ${near} (want 28,22)`);
    if (!dry(far) || St.hasStatus(p, "drowning")) fail(`flat ends in the pond's middle: set down on ${far}, drowning ${St.hasStatus(p, "drowning")}`);
    stats.flatSetDown = { near, far };
    freshPlayer(); enter();
    game.mode = "map"; game.view = "map";
  }

  // --- 6. The HUD row ---------------------------------------------------------------------------
  if (!capture) fail("no frame capture passed: the HUD can't be checked");
  else {
    freshPlayer(); enter();
    const p = game.player, ids = ["hasted", "poisoned", "flying", "darkened"];
    for (const id of ids) St.addStatus(game, p, id, { t: 30 });
    const shown = {};
    for (const view of ["map", "3d"]) {
      game.mode = view === "map" ? "map" : "explore"; game.view = view;
      const line = St.statusLine(game, p), row = hudRow(game, capture);
      shown[view] = row.text.trim().replace(/\s+/g, " ").slice(0, 200);
      if (line.length < ids.length) fail(`${view}: statusLine has ${line.length} entries for ${ids.length} statuses`);
      for (const { text, color } of line)
        if (!row.find(text).some((f) => f.color?.join() === color.map(Math.round).join())) fail(`${view} HUD: "${text}" not shown in ${color}`);
      const gone = St.statusLine(game, { status: { hasted: p.status.hasted } })[0]?.text;
      St.removeStatus(game, p, "hasted");
      if (!gone || hudRow(game, capture).find(gone).length) fail(`${view} HUD: "${gone}" still shown after haste was removed`);
      St.addStatus(game, p, "hasted", { t: 30 });
    }
    stats.hud = shown;
    game.mode = "map"; game.view = "map";
  }
  return { name: "status", ok: problems.length === 0, problems, stats };
}
