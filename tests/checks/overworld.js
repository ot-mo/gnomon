// WS1's check (TECH_DESIGN §8.3 "WS1" acceptance; owner WS1): world-map travel, on the test world and the real one.
//
//   run(env) → [{ name, ok, problems, stats }]   (tests/checks/index.js's contract; tools/check-overworld.mjs)
//     args: --steps n (the random walk's, default 10000 a world), --walkSeed k (another walk: its directions' stream + k)
//
//   1. walk        a random walk of 10⁴ steps a world (drop: false, so it stays on the map): no crash; every step
//                  legal, never onto a travel "no" span; hours as the data and the night rule give them; the lost
//                  chance of every step as the data gives it (terrain × 2 at night, 0 along roads and rivers), and
//                  per terrain (topped up by steps back and forth onto it to 40,000·q(1 − q) rolls, so ±2 points are 4
//                  standard deviations) the lost rate and the encounter rate within ±2 points of the chances rolled; the time passed is exactly the hours' seconds (R10); no zone made or entered, and the
//                  zone you left untouched (no zone simulation while travelling)
//   2. fast        200 fast-travel paths a world over a random half of the spans visited: every step legal and
//                  along a road or river or onto a visited span, never a travel "no" span; a path exists exactly
//                  when a search by the same rule finds one; real journeys: never lost, encounters × 0.25
//   3. arrival     all 8 directions on both worlds: going down puts you at the edge (or corner) you came in
//                  through, facing the way you went, on reachable ground; going down unmoved puts you where you stood
//   4. bands       a band 8-12 tiles from where you arrive, in 12 unvisited and the same 12 visited zones a world,
//                  and one rolled for real (drop: true); a legend met on the road: its uid claimed in that zone, not
//                  rolled again, its lair refused it (claimUid)
//   5. rest        interrupted by an encounter roll (in a zone and on the world map); hourly rolls; R10 (poison and
//                  cooldowns catch up exactly); a hostile awake stops it; until dawn lands at 05:00; the torch
//                  snuffed while you wait, burning glim only when kept lit
//   6. lost        the status through status.js (HUD line, the world map shut), the drop, and every way back:
//                  road, visited zone, the new-zone roll, the 3D height roll (not on the map), asking, expiry
//   7. discovery   reveal / isKnown / pin; discovery XP once a site (landmark 0.3, other sites 0.1, villages and the
//                  start span nothing); hidden sites asked about (declined: not recorded); travellers' rumours; the
//                  tier warning
//   8. screen      the world map drawn at 100×30, 160×64 and 180×56 on both worlds (every span on screen, the panel
//                  on the right or in the bottom strip), and played by keys and the mouse: O, steps, Enter, Esc, Z;
//                  the browser game's world (config.js parseWorld, which main.js reads): the real one unless ?world=test;
//                  Node's game builds on the test world (tools/browser-2b.mjs plays the real world in the browser)
import { makeRng, distance } from "../../src/rng.js";
import { parseWorld, WORLD } from "../../src/config.js";
import { on } from "../../src/events.js";
import { setMode, SCREENS } from "../../src/screens.js";
import { dispatchKey } from "../../src/keys.js";
import { changeZone, zoneKey, uidWhere, claimUid, killUid, PATCH_OPS, ZONE_LOADER, ZONE_GENERATORS } from "../../src/zones.js";
import { overrideRules, RULES } from "../../src/rules.js";
import { isNight, hourOf, secondsUntil } from "../../src/clock.js";
import { addStatus, hasStatus, statusLine, startCooldown, cooldownLeft, STATUS_DEFS } from "../../src/status.js";
import { spawnCreature, addCreature, canTalk } from "../../src/creatures.js";
import { talkTo } from "../../src/talk.js";
import { runUpdates } from "../../src/events.js";
import { skipTime } from "../../src/time.js";
import { xpToNext } from "../../src/leveling.js";
import { maxHp, invalidateStats } from "../../src/stats.js";
import { levelOfTier } from "../../src/world/worldmodel.js";
import { FLOOR_Z } from "../../src/world.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../../src/pathing.js";
import { REAL_WORLD } from "../../src/content/world/worldmap.js";
import { ENCOUNTERS } from "../../src/content/encounters.js";
import { enterWorldMap, worldStep, fastTravel, leaveWorldMap, travelPath, answer } from "../../src/overworld/travel.js";
import { rest } from "../../src/overworld/rest.js";
import { reveal, isKnown, pin, pinsAt, knownSites, discoveryXp, sight } from "../../src/overworld/discovery.js";
import { encounterChance, rollEncounter, placeEncounter, legendsFor, hiddenSiteRoll, bandOf } from "../../src/overworld/encounters.js";
import { atlas, canStep, edgeBetween, spanKey, OW } from "../../src/overworld/state.js";
import { isLost, lostChance } from "../../src/overworld/lost.js";
import { worldView, spanLines } from "../../src/overworld/renderWorld.js";
import { CREATURE_TYPES } from "../../src/creatures.js";
import { attitude } from "../../src/factions.js";
import { compileWorld } from "../../src/world/worldmodel.js";
import { pickRow, rowsAt } from "../../src/content/creatures/levels.js";

const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
const WORLDS = (game) => [["test", game.world], ["real", REAL_WORLD]];

// A new run on `world`, past the intro, the cube found, on the map.
function fresh(G, seed, world) {
  const { game } = G;
  G.startRun(seed, world);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  game.view = "map";
  setMode(game, "map", null, { pointer: false });
  return game;
}
// Stand in span (wx, wy)'s surface zone, on the map.
function goTo(game, wx, wy) {
  changeZone(game, zoneKey(wx, wy, 0), { how: "travel" });
  game.view = "map";
  setMode(game, "map", null, { pointer: false });
}
const totalXp = (p) => { let t = p.xp; for (let l = 1; l < p.level; l++) t += xpToNext(l); return t; };
// Swap fields of an object (a compiled tile, a content table) for a while; → undo.
function swap(obj, values) {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, obj[k]]));
  Object.assign(obj, values);
  return () => Object.assign(obj, old);
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- 1. The random walk --------------------------------------------------------------------------------------------
function walk(G, name, world, steps, problems, walkSeed = 0) {
  const game = fresh(G, 4242, world), W = game.run.world, O = OW();
  const left = game.zone, zonesBefore = game.zones.size;
  const before = left.creatures.map((c) => `${c.id}:${c.x},${c.y},${c.hp}`).join("|");
  let enters = 0, made = 0;
  const offEnter = on("zone:enter", () => { enters++; });
  const madeBefore = game.zones.size;
  if (!enterWorldMap(game).ok) { problems.push(`${name} walk: the world map didn't open at the start`); offEnter(); return {}; }
  const rng = makeRng((name === "test" ? 77 : 78) + walkSeed);
  const per = {}, kinds = {};
  let seconds = 0, refused = 0, badHours = 0, badChance = 0, onNo = 0, prompts = 0, travellers = 0, t0 = game.time, hours = 0;
  // One step (dx, dy) from where you are, checked against the data and counted.
  const take = (dx, dy, k) => {
    const from = { wx: game.trip.wx, wy: game.trip.wy };
    const to = { wx: from.wx + dx, wy: from.wy + dy }, t = W.tileAt(to.wx, to.wy), e = edgeBetween(W, from, to);
    const nightBefore = isNight(game);
    let want = t.travel === "drop" ? (W.tileAt(from.wx, from.wy).travelHours ?? O.roadHours) * O.dropHours : e.road ? O.roadHours : t.travelHours;
    if (!e.road && nightBefore) want *= O.nightHours;
    const r = worldStep(game, dx, dy, { confirm: true, drop: false });
    if (!r.ok) { problems.push(`${name} walk: step ${k} (${dx}, ${dy}) from (${from.wx}, ${from.wy}) refused: ${r.why}`); return false; }
    if (t.travel === "no") onNo++;
    if (!near(r.hours, want)) badHours++;
    hours += r.hours; seconds += r.seconds;
    if (r.chance) {
      const roadish = e.road || e.river || t.roadWidth > 0 || t.terrain === "road";
      const data = roadish ? 0 : Math.min(1, (t.lostChance || 0) * (isNight(game) ? O.nightLost : 1));
      if (!near(r.chance.lost, data)) badChance++;
      if (!near(r.chance.encounter, Math.min(1, t.encounterRate * (isNight(game) ? O.nightEncounter : 1)))) badChance++;
      const s = (per[t.terrain] ||= { n: 0, lost: 0, expLost: 0, encN: 0, enc: 0, expEnc: 0, data: t.lostChance || 0 });
      s.n++; s.expLost += r.chance.lost; if (r.lost) s.lost++;
      if (!r.lost) { s.encN++; s.expEnc += r.chance.encounter; if (r.encounter) s.enc++; }
    }
    if (r.encounter) kinds[r.encounter.kind] = (kinds[r.encounter.kind] || 0) + 1;
    if (r.encounter?.kind === "travellers") travellers++;
    if (game.trip.prompt) { prompts++; answer(game, false); }
    if (game.mode === "dead") { problems.push(`${name} walk: died on the road at step ${k}`); return false; }
    return true;
  };
  for (let k = 0; k < steps; k++) {
    const from = { wx: game.trip.wx, wy: game.trip.wy };
    // Now and then a step that isn't allowed: refused, nothing passes.
    const [ax, ay] = DIRS[Math.floor(rng() * 8)];
    if (canStep(W, from, ax, ay)) {
      const t = game.time, r = worldStep(game, ax, ay, { confirm: true, drop: false });
      if (r.ok || game.time !== t || game.trip.wx !== from.wx || game.trip.wy !== from.wy) problems.push(`${name} walk: a refused step (${ax}, ${ay}) from (${from.wx}, ${from.wy}) moved you or passed time`);
      refused++;
    }
    const legal = DIRS.filter(([dx, dy]) => !canStep(W, from, dx, dy));
    if (!legal.length) { problems.push(`${name} walk: stuck at (${from.wx}, ${from.wy})`); break; }
    const [dx, dy] = legal[Math.floor(rng() * legal.length)];
    if (!take(dx, dy, k)) break;
  }
  // Enough rolls on every terrain for ±2 points to mean something: n ≥ 40,000 · q(1 − q) for its lost chance and its
  // encounter chance (q from the data, the night's share counted in), so 2 points are 4 standard deviations and the
  // check doesn't fail by chance. A terrain the walk met fewer times is topped up by steps back and forth between
  // one of its spans and a neighbour (in the stats).
  const enough = (terrain) => {
    const u = W.tiles.find((v) => v.terrain === terrain && v.travel === "yes") || W.tiles.find((v) => v.terrain === terrain);
    const v = (q) => Math.min(0.25, q * (1 - q));
    return Math.ceil(40000 * Math.max(v(Math.min(1, (u?.lostChance || 0) * 1.5)), v(Math.min(1, (u?.encounterRate || 0) * 1.25))));
  };
  const has = (terrain) => Math.min(per[terrain]?.n || 0, per[terrain]?.encN || 0);
  const topped = {};
  for (const terrain of new Set(W.tiles.filter((u) => u.travel !== "no").map((u) => u.terrain))) {
    const need = enough(terrain);
    if (has(terrain) >= need) continue;
    let pair = null;
    for (const u of W.tiles) {
      if (u.terrain !== terrain || u.travel === "no" || u.travel === "drop") continue;
      const v = W.neighbours(u.wx, u.wy).find((v) => W.tileAt(v.wx, v.wy).travel === "yes" && !canStep(W, v, u.wx - v.wx, u.wy - v.wy) && !canStep(W, u, v.wx - u.wx, v.wy - u.wy));
      if (v) { pair = [u, v]; break; }
    }
    if (!pair) continue;   // (a drop terrain: no roll is made onto it)
    const [u, v] = pair, n0 = per[terrain]?.n || 0;
    game.trip.wx = v.wx; game.trip.wy = v.wy;   // (stood beside it, as the walk would have)
    for (let k = 0; k < 3 * need && has(terrain) < need; k++) {   // (a roll lost isn't an encounter roll: until both are enough)
      if (!take(u.wx - v.wx, u.wy - v.wy, `top-up ${k}`) || !take(v.wx - u.wx, v.wy - u.wy, `top-up ${k}`)) break;
    }
    topped[terrain] = `${n0} → ${per[terrain]?.n || 0} (${need} wanted)`;
  }
  offEnter();
  if (onNo) problems.push(`${name} walk: ${onNo} steps onto travel "no" spans`);
  if (badHours) problems.push(`${name} walk: ${badHours} steps' hours differ from the data (travelHours, 3 on roads, +25% at night)`);
  if (badChance) problems.push(`${name} walk: ${badChance} steps' chances differ from the data`);
  if (!near(game.time - t0, seconds, 1e-6) || !near(seconds, hours * 60 * RULES.clock.secondsPerMinute, 1e-6))
    problems.push(`${name} walk: ${game.time - t0} s passed for ${hours} hours (${seconds} s by the steps)`);
  if (enters || game.zones.size !== zonesBefore || game.zone !== left) problems.push(`${name} walk: zones made or entered on the map (${enters} entries, ${game.zones.size - zonesBefore} made)`);
  const after = left.creatures.map((c) => `${c.id}:${c.x},${c.y},${c.hp}`).join("|");
  if (after !== before) problems.push(`${name} walk: the zone you left changed while you travelled`);
  // The rates: per terrain (enough rolls each, after the top-ups), within ±2 points of the chances rolled.
  const rates = {};
  let encN = 0, enc = 0, expEnc = 0;
  for (const [terrain, s] of Object.entries(per)) {
    encN += s.encN; enc += s.enc; expEnc += s.expEnc;
    rates[terrain] = { n: s.n, lost: +(s.lost / s.n).toFixed(4), want: +(s.expLost / s.n).toFixed(4), data: s.data,
                       enc: +(s.enc / Math.max(1, s.encN)).toFixed(4), wantEnc: +(s.expEnc / Math.max(1, s.encN)).toFixed(4) };
    if (Math.min(s.n, s.encN) < enough(terrain)) { problems.push(`${name} walk: only ${Math.min(s.n, s.encN)} rolls onto ${terrain} (${s.n} lost rolls, ${s.encN} encounter rolls), ${enough(terrain)} wanted`); continue; }
    if (Math.abs(s.lost - s.expLost) / s.n > 0.02) problems.push(`${name} walk: lost in ${terrain} ${rates[terrain].lost}, the data says ${rates[terrain].want} (n ${s.n})`);
    if (Math.abs(s.enc - s.expEnc) / s.encN > 0.02) problems.push(`${name} walk: encounters in ${terrain} ${rates[terrain].enc}, the data says ${rates[terrain].wantEnc} (n ${s.encN})`);
  }
  if (Math.abs(enc - expEnc) / encN > 0.02) problems.push(`${name} walk: encounter rate ${(enc / encN).toFixed(4)}, the data says ${(expEnc / encN).toFixed(4)}`);
  void made; void madeBefore;
  return { steps, refused, hours: Math.round(hours), days: +(hours / 24).toFixed(1), encounterRate: +(enc / encN).toFixed(4), wantEncounter: +(expEnc / encN).toFixed(4),
           kinds, prompts, travellers, topped, terrains: rates };
}

// --- 2. Fast travel --------------------------------------------------------------------------------------------
function fast(G, name, world, problems) {
  const game = fresh(G, 99, world), W = game.run.world, A = atlas(game), rng = makeRng(name === "test" ? 5 : 6);
  for (const t of W.tiles) if (t.travel !== "no" && rng() < 0.5) A.visited[spanKey(t.wx, t.wy)] = 0;
  enterWorldMap(game);
  const ok = (a, b) => { const e = edgeBetween(W, a, b); return e.road || e.river || A.visited[spanKey(b.wx, b.wy)] !== undefined; };
  // A plain breadth-first search by the same rule: is there a way at all?
  const reach = (from) => {
    const seen = new Set([spanKey(from.wx, from.wy)]), q = [from];
    while (q.length) {
      const a = q.shift();
      for (const [dx, dy] of DIRS) {
        if (canStep(W, a, dx, dy)) continue;
        const b = { wx: a.wx + dx, wy: a.wy + dy }, k = spanKey(b.wx, b.wy);
        if (seen.has(k) || !ok(a, b)) continue;
        seen.add(k);
        if (W.tileAt(b.wx, b.wy).travel !== "drop") q.push(b);
      }
    }
    return seen;
  };
  const from = { wx: game.trip.wx, wy: game.trip.wy }, can = reach(from);
  let paths = 0, steps = 0, none = 0, bad = 0;
  const targets = W.tiles.filter((t) => t.wx !== from.wx || t.wy !== from.wy);
  for (let k = 0; k < 200; k++) {
    const t = targets[Math.floor(rng() * targets.length)], path = travelPath(game, from, t);
    if (!!path !== can.has(spanKey(t.wx, t.wy))) { problems.push(`${name} fast: (${t.wx}, ${t.wy}) ${path ? "has a path the search can't find" : "has no path, but the search finds one"}`); bad++; }
    if (!path) { none++; continue; }
    paths++;
    let a = from;
    path.forEach((b, i) => {
      const tb = W.tileAt(b.wx, b.wy);
      if (canStep(W, a, b.wx - a.wx, b.wy - a.wy) || !ok(a, b) || tb.travel === "no" || (tb.travel === "drop" && i < path.length - 1)) {
        problems.push(`${name} fast: the path to (${t.wx}, ${t.wy}) takes a step it may not, (${a.wx}, ${a.wy}) → (${b.wx}, ${b.wy})`); bad++;
      }
      a = b; steps++;
    });
  }
  // Real journeys: never lost, encounters at a quarter of the rate.
  const seen = [];
  const off = on("world:step", (g, ev) => seen.push(ev));
  let journeys = 0, lostAny = 0, quarter = 0;
  for (let k = 0; k < 30 && journeys < 10; k++) {
    if (!game.trip) { goTo(game, from.wx, from.wy); enterWorldMap(game); }
    const t = targets[Math.floor(rng() * targets.length)];
    if (!travelPath(game, game.trip, t)) continue;
    const n0 = seen.length, r = fastTravel(game, t, { confirm: true });
    if (!r.ok) continue;
    journeys++;
    for (const ev of seen.slice(n0)) {
      if (ev.lost) lostAny++;
      const tt = W.tileAt(ev.to.wx, ev.to.wy);
      if (!near(encounterChance(game, tt, { fast: true }), Math.min(1, encounterChance(game, tt) * 0.25))) quarter++;
    }
  }
  // The rate through worldStep itself: every span's rate 0.4, travellers only (a journey goes on through them),
  // back and forth between two known spans far apart: each step a quarter of the span's (× 1.5 at night), the
  // hits within ±2 points of the sum.
  let fastSteps = 0, fastHits = 0, fastWant = 0;
  {
    if (!game.trip) { goTo(game, from.wx, from.wy); enterWorldMap(game); }
    let a = { wx: game.trip.wx, wy: game.trip.wy };
    const far = (s) => targets.find((t) => isKnown(game, t.wx, t.wy) && (travelPath(game, s, t)?.length || 0) >= 6);
    let b = far(a);
    // The journeys above may end in a pocket (a span reached through a known one, with no visited span beside it to
    // leave by): then the run starts from the start, on the roads (C1a: the real world's regions moved where they end).
    if (!b) { leaveWorldMap(game); goTo(game, from.wx, from.wy); enterWorldMap(game); a = { wx: game.trip.wx, wy: game.trip.wy }; b = far(a); }
    const undo = [...W.tiles.map((t) => swap(t, { encounterRate: 0.4 })), swap(ENCOUNTERS.kinds, { band: 0, legend: 0, travellers: 1 })];
    const off2 = on("world:step", (g, ev) => { fastSteps++; fastWant += Math.min(1, 0.4 * (isNight(g) ? OW().nightEncounter : 1) * 0.25); if (ev.encounter) fastHits++; });
    try {
      for (let k = 0; k < 400 && fastSteps < 2000 && b; k++) {
        const r = fastTravel(game, k % 2 ? a : b, { confirm: true });
        if (!r.ok || r.stopped) { problems.push(`${name} fast: a journey between (${a.wx}, ${a.wy}) and (${b.wx}, ${b.wy}) stopped: ${r.why || r.stopped}`); break; }
      }
    } finally { off2(); undo.forEach((u) => u()); }
    if (!(fastSteps >= 1000) || Math.abs(fastHits - fastWant) / fastSteps > 0.02)
      problems.push(`${name} fast: encounters on ${fastSteps} fast steps at a span rate of 0.4: ${(fastHits / Math.max(1, fastSteps)).toFixed(4)}, want ${(fastWant / Math.max(1, fastSteps)).toFixed(4)}`);
  }
  off();
  if (lostAny) problems.push(`${name} fast: lost ${lostAny} times on fast travel`);
  if (quarter) problems.push(`${name} fast: ${quarter} steps' encounter chance is not a quarter of the road's`);
  return { paths, steps, none, journeys, worldSteps: seen.length, reachable: can.size, fastRate: { steps: fastSteps, rate: +(fastHits / Math.max(1, fastSteps)).toFixed(4), want: +(fastWant / Math.max(1, fastSteps)).toFixed(4) } };
}

// --- 3. Arrival edges --------------------------------------------------------------------------------------------
function arrival(G, name, world, center, problems) {
  const out = {};
  for (const [dx, dy] of DIRS) {
    const game = fresh(G, 11, world);
    goTo(game, center.wx - dx, center.wy - dy);
    enterWorldMap(game);
    const r = worldStep(game, dx, dy, { confirm: true, drop: false });
    if (!r.ok) { problems.push(`${name} arrival (${dx}, ${dy}): the step was refused (${r.why})`); continue; }
    if (game.trip.prompt) answer(game, false);
    leaveWorldMap(game, { at: "edge" });
    const z = game.zone, p = game.player, tag = `${name} arrival (${dx}, ${dy})`;
    if (z.key !== zoneKey(center.wx, center.wy, 0)) { problems.push(`${tag}: in ${z.key}`); continue; }
    const x = p.x, y = p.y, m = 6;
    const okX = dx > 0 ? x < m : dx < 0 ? x > z.w - m : Math.abs(x - z.w / 2) < 12;
    const okY = dy > 0 ? y < m : dy < 0 ? y > z.d - m : Math.abs(y - z.d / 2) < 12;
    if (!okX || !okY) problems.push(`${tag}: at (${x.toFixed(1)}, ${y.toFixed(1)}), not by the ${dy < 0 ? "south" : dy > 0 ? "north" : ""}${dx < 0 ? "east" : dx > 0 ? "west" : ""} edge`);
    const d = Math.atan2(Math.sin(p.yaw - Math.atan2(dy, dx)), Math.cos(p.yaw - Math.atan2(dy, dx)));
    if (Math.abs(d) > 1e-6) problems.push(`${tag}: facing ${p.yaw.toFixed(2)}, not the way you went`);
    const dist = reachable(z.stand, z.w, z.d, Math.floor(z.spawn.x), Math.floor(z.spawn.y), PLAYER_STEP_UP, PLAYER_DROP);
    if (dist[Math.floor(x) + Math.floor(y) * z.w] < 0) problems.push(`${tag}: on ground the zone's anchor can't reach`);
    if (game.mode !== "map") problems.push(`${tag}: in ${game.mode}, not the map`);
    out[`${dx},${dy}`] = [+x.toFixed(1), +y.toFixed(1)];
  }
  // Down without moving: where you stood.
  const game = fresh(G, 12, world);
  goTo(game, center.wx, center.wy);
  const p = game.player, at = [p.x, p.y, p.z], key = game.zone.key, t = game.time;
  enterWorldMap(game);
  leaveWorldMap(game, { at: "edge" });
  if (game.zone.key !== key || p.x !== at[0] || p.y !== at[1] || p.z !== at[2] || game.time !== t || game.mode !== "map")
    problems.push(`${name} arrival: down without moving didn't put you back where you stood`);
  return out;
}

// --- 4. Bands and legends ------------------------------------------------------------------------------------------
function bands(G, name, world, problems) {
  const game = fresh(G, 21, world), W = game.run.world, rng = makeRng(name === "test" ? 31 : 32);
  const spawned = [], orig = PATCH_OPS.band;
  PATCH_OPS.band = (g, z, p, ctx) => { const had = new Set(z.creatures); orig(g, z, p, ctx); spawned.push(...z.creatures.filter((c) => !had.has(c))); };
  const dists = { unvisited: [], visited: [] };
  let short = 0;
  try {
    const ok = W.tiles.filter((t) => t.travel === "yes" && !t.landmark && W.neighbours(t.wx, t.wy).some((n) => !canStep(W, n, t.wx - n.wx, t.wy - n.wy) && W.tileAt(n.wx, n.wy).travel === "yes"));
    const spans = [];
    while (spans.length < 12) { const t = ok[Math.floor(rng() * ok.length)]; if (!spans.includes(t) && !game.zones.has(zoneKey(t.wx, t.wy, 0))) spans.push(t); }
    for (const pass of ["unvisited", "visited"])
      for (const t of spans) {
        const n = W.neighbours(t.wx, t.wy).find((n) => !canStep(W, n, t.wx - n.wx, t.wy - n.wy) && W.tileAt(n.wx, n.wy).travel === "yes");
        goTo(game, n.wx, n.wy);
        enterWorldMap(game);
        worldStep(game, t.wx - n.wx, t.wy - n.wy, { confirm: true, drop: false });
        if (game.trip.prompt) answer(game, false);
        const key = zoneKey(t.wx, t.wy, 0), wasThere = game.zones.has(key);
        if ((pass === "visited") !== wasThere) problems.push(`${name} bands: (${t.wx}, ${t.wy}) ${wasThere ? "already made" : "not made"} on the ${pass} pass`);
        const types = ["goblin", "goblin", "rat", "bat"];
        spawned.length = 0;
        placeEncounter(game, key, { kind: "band", types, elite: [null, null, null, null], level: t.level });
        leaveWorldMap(game, { at: "edge" });
        const a = game.arrival;
        if (spawned.length < types.length) { short++; problems.push(`${name} bands (${pass}) at (${t.wx}, ${t.wy}): ${spawned.length} of ${types.length} placed`); }
        for (const c of spawned) {
          const d = distance(Math.floor(c.x) - Math.floor(a.x), Math.floor(c.y) - Math.floor(a.y));
          dists[pass].push(d);
          if (d < 8 || d > 12) problems.push(`${name} bands (${pass}) at (${t.wx}, ${t.wy}): a ${c.type} ${d.toFixed(1)} tiles from where you arrived`);
        }
      }
  } finally { PATCH_OPS.band = orig; }
  // One rolled for real: an encounter on every step (the span's rate at 1), dropped into the zone.
  const t = W.tiles.find((u) => u.travel === "yes" && !u.landmark && !game.zones.has(zoneKey(u.wx, u.wy, 0))
    && W.neighbours(u.wx, u.wy).some((n) => !canStep(W, n, u.wx - n.wx, u.wy - n.wy)));
  const n = W.neighbours(t.wx, t.wy).find((n) => !canStep(W, n, t.wx - n.wx, t.wy - n.wy));
  goTo(game, n.wx, n.wy);
  enterWorldMap(game);
  const undo = [swap(t, { encounterRate: 1, lostChance: 0 }), swap(ENCOUNTERS.kinds, { travellers: 0, legend: 0 })];
  let real = null;
  try {
    const had = new Set();
    const r = worldStep(game, t.wx - n.wx, t.wy - n.wy, { confirm: true });
    if (!r.dropped || r.encounter?.kind !== "band" || game.zone.key !== zoneKey(t.wx, t.wy, 0)) problems.push(`${name} bands: a rolled band didn't take you into the zone (${JSON.stringify({ dropped: r.dropped, kind: r.encounter?.kind })})`);
    else {
      const a = game.arrival, members = game.zone.creatures.filter((c) => !had.has(c) && r.encounter.types.includes(c.type))
        .map((c) => distance(Math.floor(c.x) - Math.floor(a.x), Math.floor(c.y) - Math.floor(a.y))).filter((d) => d >= 8 && d <= 12);
      real = { size: r.encounter.types.length, at812: members.length };
      if (members.length < r.encounter.types.length) problems.push(`${name} bands: a rolled band of ${r.encounter.types.length}, ${members.length} 8-12 tiles from you`);
    }
  } finally { undo.forEach((u) => u()); }

  // Back into the zone you left (the one you are still in on the map): the band measures from where you arrive,
  // not from where you stood; a rest on the world map there too.
  {
    const g = fresh(G, 23, world), W2 = g.run.world;
    const a = W2.tiles.find((u) => u.travel === "yes" && !u.landmark && !u.roadWidth && !u.riverWidth && W2.inBounds(u.wx + 1, u.wy)
      && !canStep(W2, u, 1, 0) && !canStep(W2, { wx: u.wx + 1, wy: u.wy }, -1, 0));
    goTo(g, a.wx, a.wy);
    for (const how of ["step", "rest"]) {
      const p = g.player;
      p.x = Math.floor(g.zone.w / 2) + 0.5; p.y = Math.floor(g.zone.d / 2) + 0.5;
      const z0 = g.zone.stand[Math.floor(p.x) + Math.floor(p.y) * g.zone.w];
      if (z0 >= 0) p.z = z0;
      const had = new Set(g.zone.creatures);
      enterWorldMap(g);
      worldStep(g, 1, 0, { confirm: true, drop: false });
      if (g.trip.prompt) answer(g, false);
      const undo = [swap(a, { encounterRate: 1, lostChance: 0 }), swap(ENCOUNTERS.kinds, { travellers: 0, legend: 0 })];
      try {
        if (how === "step") worldStep(g, -1, 0, { confirm: true });
        else { worldStep(g, -1, 0, { confirm: true, drop: false }); if (g.trip?.prompt) answer(g, false); const u = overrideRules("overworld", { restEncounter: 1e9 }); try { g.player.hp = 1; rest(g, { until: "healed" }); } finally { u(); } }
      } finally { undo.forEach((f) => f()); }
      const arr = g.arrival, band = g.zone.creatures.filter((c) => !had.has(c));
      if (g.zone.key !== zoneKey(a.wx, a.wy, 0) || g.trip || !band.length) { problems.push(`${name} bands back home (${how}): not down in ${a.wx},${a.wy} with a band (${g.zone.key}, ${band.length})`); continue; }
      for (const c of band) {
        const d = distance(Math.floor(c.x) - Math.floor(arr.x), Math.floor(c.y) - Math.floor(arr.y));
        if (d < 8 || d > 12) problems.push(`${name} bands back home (${how}): a ${c.type} ${d.toFixed(1)} tiles from where you arrived`);
      }
    }
  }
  // A legend on the road: claimed in that zone, then neither rolled again nor taken by its lair.
  const uid = `legend:test:${name}`, def = { uid, template: "plain", species: "goblin", name: "Ottar", epithet: "the Patient", level: t.level, siteId: null };
  game.run.legends = new Map([[uid, def]]);
  const u = W.tiles.find((v) => v.travel === "yes" && !v.landmark && v.tier === t.tier && !game.zones.has(zoneKey(v.wx, v.wy, 0)));
  if (!legendsFor(game, u).includes(def)) problems.push(`${name} legend: not among those that may roam a span of its tier`);
  const undoK = swap(ENCOUNTERS.kinds, { band: 0, travellers: 0, legend: 1 }), undoT = swap(u, { encounterRate: 1 });
  let enc;
  try { enc = rollEncounter(game, u); } finally { undoK(); undoT(); }
  if (enc?.kind !== "legend" || enc.uid !== uid) problems.push(`${name} legend: rolled ${enc?.kind}, not the legend`);
  else {
    const m = W.neighbours(u.wx, u.wy).find((v) => !canStep(W, v, u.wx - v.wx, u.wy - v.wy));
    goTo(game, m.wx, m.wy); enterWorldMap(game);
    worldStep(game, u.wx - m.wx, u.wy - m.wy, { confirm: true, drop: false });
    if (game.trip.prompt) answer(game, false);
    placeEncounter(game, zoneKey(u.wx, u.wy, 0), enc);
    leaveWorldMap(game, { at: "edge" });
    const c = game.zone.creatures.find((x) => x.uid === uid);
    if (!c || uidWhere(game, uid) !== game.zone.key) problems.push(`${name} legend: not in the zone it was met in (uid at ${uidWhere(game, uid)})`);
    else {
      const d = distance(Math.floor(c.x) - Math.floor(game.arrival.x), Math.floor(c.y) - Math.floor(game.arrival.y));
      if (d < 8 || d > 12) problems.push(`${name} legend: ${d.toFixed(1)} tiles from where you arrived`);
    }
    if (legendsFor(game, u).length) problems.push(`${name} legend: rolled again once placed`);
    if (claimUid(game, uid, "lair:somewhere")) problems.push(`${name} legend: its lair could still claim it`);
    killUid(game, uid);
    if (legendsFor(game, u).length) problems.push(`${name} legend: rolled again once dead`);
  }
  // A legend with a lair roams near its lair's tier, not its own (3 levels higher, bible §12.13).
  const home = [...game.run.sites.values()].find((x) => x.kind !== "landmark");
  if (home) {
    const d2 = { uid: `legend:home:${name}`, species: "goblin", name: "Vey", level: levelOfTier(home.tier) + 3, siteId: home.id };
    game.run.legends = new Map([[d2.uid, d2]]);
    const at = (dt) => W.tiles.find((v) => v.tier === home.tier + dt && (v.wx !== home.at.wx || v.wy !== home.at.wy));
    const same = at(0), far = at(2);
    if (same && !legendsFor(game, same).includes(d2)) problems.push(`${name} legend: a tier-${home.tier} lair's legend doesn't roam tier ${home.tier}`);
    if (far && legendsFor(game, far).includes(d2)) problems.push(`${name} legend: a tier-${home.tier} lair's legend roams tier ${far.tier}`);
  }
  game.run.legends = new Map();
  return { unvisited: range(dists.unvisited), visited: range(dists.visited), short, real };
}
const range = (xs) => (xs.length ? { n: xs.length, min: +Math.min(...xs).toFixed(2), max: +Math.max(...xs).toFixed(2) } : { n: 0 });

// --- 4b. The real world's encounter tables (C3; content/encounters.js ENCOUNTERS.regions) --------------------------
// Every real-world region with an encounter rate has rows; each row a registered kind out for a Bent stranger at the
// start, weight > 0, levels within 1-30; every level its spans make held by two kinds or more; a region's kinds only
// band, travellers and legend; no entry for a test-world region (its draws stay as they were); pickRow draws each kind
// of a level by its weight (20,000 draws, within 1.5 points), nothing outside the level and no kind that isn't registered
// (a waiting one in C1a's rows); every row within its kind's own levels, and no kind that doesn't roam (the Gloam Warden,
// the Cast hunters). Five mutants, each caught.
function tableProblems(game) {
  const out = [], W = compileWorld(REAL_WORLD), E = ENCOUNTERS.regions, levels = {};
  for (const t of W.tiles) if (t.encounterRate > 0) (levels[t.region] ||= new Set()).add(t.level);
  for (const r of Object.keys(E)) if (!REAL_WORLD.regions[r]) out.push(`encounters: ${r} isn't a real-world region`);
  for (const [r, set] of Object.entries(levels)) {
    const rows = E[r]?.rows;
    if (!rows?.length) { out.push(`encounters: ${r} has an encounter rate and no rows`); continue; }
    for (const row of rows) {
      const [type, w, lo, hi] = row, T = CREATURE_TYPES[type];
      if (!T || T.talks || !(w > 0) || !Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi > 30 || lo > hi) { out.push(`encounters: ${r} row ${JSON.stringify(row)}`); continue; }
      const c = spawnCreature(type, 1, 1, FLOOR_Z, { rng: () => 0.5, level: lo });
      if (attitude(game, c, game.player) !== "hostile") out.push(`encounters: ${r}'s ${type} isn't out for a stranger (${attitude(game, c, game.player)})`);
      // Within the kind's own levels (wildlife.js), and only a kind that roams (the Gloam Warden and the Cast hunters
      // are placed by their systems: levels and no weight).
      if (T.levels && (lo < T.levels[0] || hi > T.levels[1])) out.push(`encounters: ${r}'s ${type} at ${lo}-${hi}, outside its levels ${T.levels.join("-")}`);
      if (T.levels && !(T.weight > 0)) out.push(`encounters: ${r}'s ${type} doesn't roam`);
    }
    for (const L of set) if (rowsAt(rows, L).length < 2) out.push(`encounters: ${r} level ${L}: ${rowsAt(rows, L).length} kind(s), want 2 or more`);
    const k = E[r].kinds;
    if (k && (!Object.keys(k).every((x) => ["band", "travellers", "legend"].includes(x) && k[x] >= 0) || !(Object.values(k).reduce((a, n) => a + n, 0) > 0))) out.push(`encounters: ${r} kinds ${JSON.stringify(k)}`);
  }
  for (const t of compileWorld(game.world).tiles) if (E[t.region]) { out.push(`encounters: the test world's ${t.region} has an entry`); break; }
  return { out, regions: Object.keys(levels).length };
}
function encounterTables(G, problems) {
  const game = fresh(G, 23, G.game.world), p = game.player, saved = { genotype: p.genotype, rep: game.state.rep };
  const stats = {};
  try {
    p.genotype = "bent"; game.state.rep = {};
    const { out, regions } = tableProblems(game);
    problems.push(...out);
    // pickRow draws by weight within the level.
    const rows = ENCOUNTERS.regions.downs.rows, L = 8, live = rowsAt(rows, L), want = live.reduce((a, r) => a + r[1], 0), got = {}, rng = makeRng(77);
    for (let n = 0; n < 20000; n++) { const t = pickRow(rng, rows, L); got[t] = (got[t] || 0) + 1; }
    for (const [type, w] of live) if (Math.abs(got[type] / 20000 - w / want) > 0.015) problems.push(`pickRow: the downs' ${type} drawn ${(got[type] / 200).toFixed(1)}%, its weight ${(100 * w / want).toFixed(1)}%`);
    for (const t of Object.keys(got)) if (!live.some(([x]) => x === t)) problems.push(`pickRow: drew ${t}, not of level ${L}`);
    if (pickRow(rng, rows, 31) !== null) problems.push("pickRow: drew at a level no row holds");
    // Only registered kinds: the Hollow Mere's rows (C1a's) name the glowfin, which waits (content/creatures/waiting.js).
    const mere = REAL_WORLD.regions.hollowMere.creatures, waiting = mere.filter(([type]) => !CREATURE_TYPES[type]).map(([type]) => type);
    let drewWaiting = 0;
    for (let n = 0; n < 5000; n++) if (waiting.includes(pickRow(rng, mere, 2))) drewWaiting++;
    if (!waiting.length || drewWaiting) problems.push(`pickRow: ${drewWaiting} of 5000 draws on the Hollow Mere's rows a kind that isn't registered (${waiting.join(", ") || "none to test"})`);
    if (pickRow(rng, [["glowfin", 5, 1, 30]], 2) !== null) problems.push("pickRow: drew from rows holding no registered kind");
    // Its teeth.
    const mutants = [
      ["an unregistered kind", () => { const r = ENCOUNTERS.regions.flats.rows; r.push(["noSuchThing", 1, 1, 8]); return () => r.pop(); }, /flats row \["noSuchThing"/],
      ["one kind at a level", () => { const r = ENCOUNTERS.regions.lattice.rows, old = r.slice(); r.splice(1); return () => { r.length = 0; r.push(...old); }; }, /lattice level \d+: 1 kind/],
      ["a docile kind in a band", () => { const r = ENCOUNTERS.regions.waste.rows; r.push(["longback", 1, 1, 11]); return () => r.pop(); }, /waste's longback isn't out for a stranger/],
      ["a kind far outside its levels", () => { const r = ENCOUNTERS.regions.flats.rows; r.push(["askewAngle", 1, 1, 8]); return () => r.pop(); }, /flats's askewAngle at 1-8, outside its levels/],
      ["the Gloam Warden in a band", () => { const r = ENCOUNTERS.regions.shade.rows; r.push(["gloamWarden", 1, 17, 20]); return () => r.pop(); }, /shade's gloamWarden doesn't roam/],
    ];
    let caught = 0;
    for (const [what, apply, re] of mutants) {
      const undo = apply();
      let o;
      try { o = tableProblems(game).out; } finally { undo(); }
      if (o.some((x) => re.test(x))) caught++; else problems.push(`encounter tables: the mutant "${what}" isn't caught`);
    }
    if (tableProblems(game).out.length !== out.length) problems.push("encounter tables: the rows aren't as they were after the mutants");
    // A real-world band draws from its region's rows (integrator, C3 #3): 30 bands on a span of every region with rows,
    // every member a kind of the rows at the span's level.
    {
      const g = fresh(G, 24, REAL_WORLD), W = g.run.world, off = [];
      let bands = 0;
      for (const [r, E] of Object.entries(ENCOUNTERS.regions)) {
        const t = W.tiles.find((u) => u.region === r && u.encounterRate > 0 && rowsAt(E.rows || [], u.level).length);
        if (!t) continue;
        const ok = new Set(rowsAt(E.rows, t.level).map(([type]) => type));
        for (let k = 0; k < 30; k++, bands++) for (const type of bandOf(g, t).types) if (!ok.has(type)) { off.push(`${r}: ${type}`); break; }
      }
      if (!bands || off.length) problems.push(`real-world bands not from their region's rows: ${off.slice(0, 4).join("; ") || "no band drawn"}`);
      stats.bandsByRegion = `${bands} bands, every member from its region's rows`;
    }
    Object.assign(stats, { regions, rows: Object.values(ENCOUNTERS.regions).reduce((a, r) => a + (r.rows?.length || 0), 0), downsAt8: got, mutants: `${caught} of ${mutants.length}` });
  } finally { p.genotype = saved.genotype; game.state.rep = saved.rep; }
  return stats;
}

// --- 5. Rest -------------------------------------------------------------------------------------------------
function resting(G, problems) {
  const out = {};
  const H = 60 * RULES.clock.secondsPerMinute;
  // In a zone: an encounter on the first hour's roll.
  let game = fresh(G, 51, G.game.world);
  goTo(game, 3, 3);
  const p = game.player;
  p.hp = 1;
  const before = game.zone.creatures.length;
  let undo = overrideRules("overworld", { restEncounter: 1e9 });
  const undoK = swap(ENCOUNTERS.kinds, { travellers: 0, legend: 0 });
  let r;
  try { r = rest(game, { until: "healed" }); } finally { undo(); undoK(); }
  out.zone = { why: r.why, hours: r.elapsed / H, band: game.zone.creatures.length - before };
  if (r.why !== "encounter" || !r.interrupted || !near(r.elapsed, H) || game.zone.creatures.length <= before)
    problems.push(`rest in a zone: an encounter on the first roll didn't stop it after an hour (${JSON.stringify(out.zone)})`);
  else for (const c of game.zone.creatures.slice(before)) {
    const d = distance(Math.floor(c.x) - Math.floor(p.x), Math.floor(c.y) - Math.floor(p.y));
    if (d < 8 || d > 12) problems.push(`rest in a zone: a ${c.type} ${d.toFixed(1)} tiles from you`);
  }
  // On the world map: down into the span's zone, the band 8-12 tiles from where you arrive.
  game = fresh(G, 52, G.game.world);
  goTo(game, 3, 3); enterWorldMap(game);
  worldStep(game, 1, 0, { confirm: true, drop: false });
  if (game.trip.prompt) answer(game, false);
  game.player.hp = 1;
  undo = overrideRules("overworld", { restEncounter: 1e9 });
  const undoK2 = swap(ENCOUNTERS.kinds, { travellers: 0, legend: 0 });
  try { r = rest(game, { until: "healed" }); } finally { undo(); undoK2(); }
  out.world = { why: r.why, zone: game.zone.key, mode: game.mode };
  if (r.why !== "encounter" || game.zone.key !== "4,3,0" || game.trip || game.mode !== "map") problems.push(`rest on the world map: an encounter didn't take you down (${JSON.stringify(out.world)})`);
  // Rolls once an hour: with no encounters, 8 hours "until healed" (never healed at 1 HP of a huge max?) → 8 rolls.
  game = fresh(G, 53, G.game.world);
  goTo(game, 3, 3);
  let rolls = 0;
  const orig = encounterChance;
  const n0 = atlas(game).n;
  undo = overrideRules("overworld", { restEncounter: 0 });
  game.player.hp = 1;
  try { r = rest(game, { until: 3 * H + 30 }); } finally { undo(); }
  rolls = atlas(game).n - n0;
  out.hourly = { hours: r.elapsed / H, rolls };
  if (!near(r.elapsed, 3 * H + 30) || rolls !== 3) problems.push(`rest: ${rolls} rolls in ${r.elapsed / H} hours, not one a whole hour`);
  void orig;
  // The rate: 1,500 one-hour rests on a span of rate 0.4 (its bands placing nothing): half the travel rate (× 1.5 at
  // night), within ±2 points; never travellers (nobody calls on a sleeper).
  {
    game = fresh(G, 59, G.game.world);
    goTo(game, 3, 3);
    const t = game.run.world.tileAt(3, 3), kinds = {};
    let hits = 0, want = 0;
    const undo = [swap(t, { encounterRate: 0.4 }), swap(PATCH_OPS, { band: () => {} })];
    try {
      for (let k = 0; k < 1500; k++) {
        const rr = rest(game, { until: H });
        want += 0.4 * (isNight(game) ? OW().nightEncounter : 1) * OW().restEncounter;
        if (rr.encounter) { hits++; kinds[rr.encounter.kind] = (kinds[rr.encounter.kind] || 0) + 1; }
      }
    } finally { undo.forEach((u) => u()); }
    out.restRate = { hours: 1500, rate: +(hits / 1500).toFixed(4), want: +(want / 1500).toFixed(4), kinds };
    if (Math.abs(hits - want) / 1500 > 0.02) problems.push(`rest: encounters ${(hits / 1500).toFixed(4)} an hour at a span rate of 0.4, want ${(want / 1500).toFixed(4)}`);
    if (kinds.travellers) problems.push(`rest: ${kinds.travellers} travellers called on a sleeper`);
  }
  // On the world map you are in no zone: a hunter by where you stood doesn't stop a rest there.
  {
    game = fresh(G, 60, G.game.world);
    goTo(game, 3, 3); enterWorldMap(game);
    const me3 = game.player, c3 = spawnCreature("goblin", Math.floor(me3.x) + 2, Math.floor(me3.y), FLOOR_Z, { rng: makeRng(3), state: "chase" });
    c3.z = me3.z; addCreature(game.zone, c3);
    const u = overrideRules("overworld", { restEncounter: 0 });
    let rr;
    try { rr = rest(game, { until: 2 * H }); } finally { u(); }
    out.worldRest = rr.why;
    if (rr.why === "hostile" || !near(rr.elapsed, 2 * H)) problems.push(`rest on the world map: stopped by a hunter in the zone you left (${rr.why}, ${rr.elapsed} s)`);
  }
  // R10: poison does its full, finite damage; a cooldown a rest doesn't clear counts down exactly (the folding
  // strike's), and the second wind's is cleared: the rest is longer than RULES.cooldown.restClears, one world hour.
  game = fresh(G, 54, G.game.world);
  goTo(game, 3, 3);
  const q = game.player;
  q.hp = maxHp(q);
  addStatus(game, q, "poisoned", { t: 6 });
  startCooldown(q, "foldingStrike", 300);
  startCooldown(q, "secondWind", 300);
  const hp0 = q.hp;
  undo = overrideRules("overworld", { restEncounter: 0 });
  try { r = rest(game, { until: 2 * H }); } finally { undo(); }
  out.r10 = { poisonGone: !hasStatus(q, "poisoned"), hpLost: hp0 - q.hp, cooldown: cooldownLeft(q, "foldingStrike"), secondWind: cooldownLeft(q, "secondWind") };
  if (hasStatus(q, "poisoned") || !(hp0 - q.hp > 0) || !near(cooldownLeft(q, "foldingStrike"), 300 - 2 * H) || cooldownLeft(q, "secondWind") || !(2 * H >= RULES.cooldown.restClears)) problems.push(`rest: statuses and cooldowns didn't catch up (${JSON.stringify(out.r10)})`);
  // The torch on the road (Phase 2, WS1 #6): on the world map it burns by the span the journey is on, not the zone
  // you left (here a plain one): by day 4 hours on the Shade's span pay a glim, 4 on another span nothing.
  {
    const g = fresh(G, 58, REAL_WORLD), W = g.run.world, tp = g.player;
    const shade = W.tiles.find((t) => W.terrains[t.terrain]?.dark), plain = W.tileAt(W.start.wx, W.start.wy);
    skipTime(g, secondsUntil(g, "dawn") + 2 * H, { interruptible: false });
    enterWorldMap(g);
    const burn = (at) => {
      g.trip.wx = at.wx; g.trip.wy = at.wy; tp.funds = 10; tp.torch = true; tp.torchBurn = 0;
      const day = !isNight(g);
      skipTime(g, 4 * H, { interruptible: false, reason: "travel" });
      return day && !isNight(g) ? 10 - tp.funds : "night";
    };
    const torch = { shade: shade && burn(shade), plain: burn(plain), left: W.terrains[W.tileAt(g.zone.wx, g.zone.wy).terrain]?.dark ? "dark" : "plain" };
    out.roadTorch = torch;
    if (!shade || torch.shade !== 1 || torch.plain !== 0 || torch.left !== "plain") problems.push(`rest: the torch on the road by day (glim for 4 hours) ${JSON.stringify(torch)}, want the Shade 1, another span 0`);
    g.trip = null;
  }
  // Dying on the road ends the journey: the next run's Z is an ordinary rest in a zone (a hunter 2 tiles off stops it).
  game = fresh(G, 57, G.game.world);
  goTo(game, 3, 3); enterWorldMap(game);
  addStatus(game, game.player, "poisoned", { t: 1e5 });
  game.player.hp = 2;
  for (let k = 0; k < 6 && game.mode !== "dead"; k++) { worldStep(game, k % 2 ? -1 : 1, 0, { confirm: true, drop: false }); if (game.trip?.prompt) answer(game, false); }
  out.deadOnRoad = { mode: game.mode, trip: !!game.trip };
  if (game.mode !== "dead" || game.trip) problems.push(`rest: death on the road (${JSON.stringify(out.deadOnRoad)}) left the journey behind`);
  game = fresh(G, 58, G.game.world);
  if (game.trip) problems.push("rest: a new run still has the old run's journey");
  goTo(game, 3, 3);
  {
    const me2 = game.player, c2 = spawnCreature("goblin", Math.floor(me2.x) + 2, Math.floor(me2.y), FLOOR_Z, { rng: makeRng(2), state: "chase" });
    c2.z = me2.z; addCreature(game.zone, c2);
    game.trip = { wx: 9, wy: 9, came: null, moved: true, viewOnly: false };   // as the old run's would have been left
    const t1 = game.time, rr = rest(game, { until: 2 * H });
    if (rr.why !== "hostile" || game.time !== t1 || game.zone.key !== "3,3,0") problems.push(`rest: a journey left over made Z a world-map rest (${rr.why}, in ${game.zone.key})`);
    game.trip = null;
  }
  // Whatever left a journey behind, the next zone entry ends it (stairs down here, as a load or a new run would).
  {
    game = fresh(G, 62, G.game.world);
    game.trip = { wx: 9, wy: 9, came: null, moved: true, viewOnly: false };
    changeZone(game, zoneKey(0, 0, 1), { how: "down" });
    if (game.trip) problems.push("rest: a journey left behind outlived a zone entry (down the temple's stairs)");
  }
  // A hostile awake near you: no rest at all.
  game = fresh(G, 55, G.game.world);
  goTo(game, 3, 3);
  const z = game.zone, me = game.player;
  const c = spawnCreature("goblin", Math.floor(me.x) + 3, Math.floor(me.y), FLOOR_Z, { rng: makeRng(1), state: "chase" });
  c.z = me.z; addCreature(z, c);
  const t0 = game.time;
  r = rest(game, { until: 2 * H });
  out.hostile = r.why;
  if (r.why !== "hostile" || game.time !== t0) problems.push(`rest: a hostile awake 3 tiles off didn't stop it (${r.why}, ${game.time - t0} s)`);
  // Until dawn lands at 05:00; the torch is snuffed, and burns glim only when kept lit.
  game = fresh(G, 56, G.game.world);
  goTo(game, 3, 3);
  const pl = game.player;
  skipTime(game, secondsUntil(game, "dusk") + 2 * H, { interruptible: false });   // 20:00
  pl.torch = true; pl.funds = 100; pl.torchBurn = 0;
  undo = overrideRules("overworld", { restEncounter: 0 });
  try { r = rest(game, { until: "dawn" }); } finally { undo(); }
  out.dawn = { hour: hourOf(game), funds: pl.funds, lit: pl.torch };
  if (hourOf(game) !== 5 || game.time % H !== 0 && Math.abs((game.time % H)) > 1e-6) problems.push(`rest until dawn: it is ${hourOf(game)}:00`);
  if (pl.funds !== 100 || !pl.torch) problems.push(`rest: the torch burned ${100 - pl.funds} glim while snuffed (lit after: ${pl.torch})`);
  undo = overrideRules("overworld", { restEncounter: 0 });
  try { rest(game, { until: "midnight", keepLit: true }); } finally { undo(); }   // 05:00 → 00:00: 19 hours, 6 of them night
  out.keptLit = 100 - pl.funds;
  if (!(pl.funds < 100)) problems.push("rest: the torch kept lit through a night burned nothing");
  return out;
}

// --- 6. Lost -------------------------------------------------------------------------------------------------
function lost(G, problems) {
  const out = {};
  const game = fresh(G, 61, G.game.world), W = game.run.world, A = atlas(game);
  if (!STATUS_DEFS.lost) { problems.push("lost: no status registered"); return out; }
  // Five spans in a row, travel "yes", no road, river or landmark: lost for sure on the step from the first
  // into the second, then the third, fourth and fifth are new zones.
  const plain = (x, y) => { const u = W.tileAt(x, y); return u && u.travel === "yes" && !u.roadWidth && !u.riverWidth && !u.landmark && !(u.wx === 0 && u.wy === 0); };
  const row = W.tiles.find((u) => [0, 1, 2, 3, 4, 5].every((k) => plain(u.wx + k, u.wy)));
  const [x0, y0] = [row.wx, row.wy];
  goTo(game, x0, y0); enterWorldMap(game);
  const t = W.tileAt(x0 + 1, y0);
  let undo = swap(t, { lostChance: 1 });
  let r;
  try { r = worldStep(game, 1, 0, { confirm: true }); } finally { undo(); }
  const p = game.player;
  out.drop = { lost: r.lost, zone: game.zone.key, status: hasStatus(p, "lost"), mode: game.mode };
  if (!r.lost || !r.dropped || game.zone.key !== zoneKey(x0 + 1, y0, 0) || !hasStatus(p, "lost") || game.mode !== "map") problems.push(`lost: a sure loss didn't drop you lost into the zone (${JSON.stringify(out.drop)})`);
  if (!statusLine(game, p).some((s) => /lost/i.test(s.text))) problems.push("lost: the HUD's status line doesn't show it");
  if (enterWorldMap(game).ok) problems.push("lost: the world map opened while lost");
  // A new zone: the roll (0: stays lost; 1: found).
  undo = overrideRules("overworld", { recover: 0 });
  try { goTo(game, x0 + 2, y0); } finally { undo(); }
  if (!isLost(game)) problems.push("lost: found with the new-zone chance at 0");
  undo = overrideRules("overworld", { recover: 0 });
  try { goTo(game, x0 + 3, y0); } finally { undo(); }   // (then back into the one before: no new roll)
  undo = overrideRules("overworld", { recover: 1 });
  try { goTo(game, x0 + 2, y0); } finally { undo(); }
  if (!isLost(game)) problems.push("lost: a zone already tried rolled again");
  try { undo = overrideRules("overworld", { recover: 1 }); goTo(game, x0 + 4, y0); } finally { undo(); }
  if (isLost(game)) problems.push("lost: still lost with the new-zone chance at 1");
  out.newZone = true;
  // A visited zone and a road span: at once, whatever the roll.
  const relost = (key) => { addStatus(game, p, "lost", { t: OW().lostFor }); A.lost = { in: key, since: game.time, tried: {}, height: {}, gnomon: {} }; };
  relost(game.zone.key);
  undo = overrideRules("overworld", { recover: 0 });
  try { goTo(game, x0, y0); } finally { undo(); }
  if (isLost(game)) problems.push("lost: a visited zone didn't give your bearings back");
  const road = W.tiles.find((u) => u.roadWidth > 0 && !u.landmark && A.visited[spanKey(u.wx, u.wy)] === undefined);
  relost(game.zone.key);
  undo = overrideRules("overworld", { recover: 0 });
  try { goTo(game, road.wx, road.wy); } finally { undo(); }
  if (isLost(game)) problems.push(`lost: the road span (${road.wx}, ${road.wy}) didn't give your bearings back`);
  // Bearings from height: 3D only, 6 blocks up, half a turn over 2 s.
  goTo(game, x0 + 5, y0);
  relost(game.zone.key);
  const look = (view, z) => {
    game.view = view; setMode(game, view === "map" ? "map" : "explore", null, { pointer: false });
    p.z = z; game.bearingsLook = null;
    const u = overrideRules("overworld", { height: { ...OW().height, chance: 1 } });
    try { for (let k = 0; k < 40; k++) { p.yaw += 0.15; runUpdates(game, 0.1); } } finally { u(); }
  };
  look("map", FLOOR_Z + 8);
  if (!isLost(game)) problems.push("lost: bearings from height worked on the map");
  look("3d", FLOOR_Z + 3);
  if (!isLost(game)) problems.push("lost: bearings from height 3 blocks up");
  look("3d", FLOOR_Z + 6);
  if (isLost(game)) problems.push("lost: bearings from height (6 blocks up, looking round in 3D) didn't work");
  out.height = !isLost(game);
  // Asking anyone you can talk to.
  goTo(game, 0, 0);
  relost(game.zone.key);
  const talker = game.zone.creatures.find(canTalk);
  const opt = talker && talkTo(game, talker)?.options?.find((o) => o.label === "Which way am I?");
  if (!opt) problems.push("lost: no \"Which way am I?\" when talking");
  else { opt.go(); if (isLost(game)) problems.push("lost: asking the way didn't help"); }
  // It runs out.
  relost(game.zone.key);
  const day = 24 * 60 * RULES.clock.secondsPerMinute;   // a world day
  skipTime(game, day - 1, { interruptible: false });
  if (!isLost(game)) problems.push("lost: over before a world day had passed");
  skipTime(game, 2, { interruptible: false });
  if (isLost(game)) problems.push("lost: still lost a world day later");
  // (After everything that uses this run: fresh() starts a new one on the same game.)
  // Flying when you set out takes 10 points off the step's lost chance, though the flight is over when you arrive.
  {
    const g5 = fresh(G, 66, G.game.world), W5 = g5.run.world;
    const u = W5.tiles.find((v) => v.terrain === "forest" && !v.roadWidth && !v.riverWidth && !v.landmark
      && W5.neighbours(v.wx, v.wy).some((n) => !canStep(W5, n, v.wx - n.wx, v.wy - n.wy) && !W5.tileAt(n.wx, n.wy).roadWidth));
    const n = W5.neighbours(u.wx, u.wy).find((m) => !canStep(W5, m, u.wx - m.wx, u.wy - m.wy) && !W5.tileAt(m.wx, m.wy).roadWidth);
    goTo(g5, n.wx, n.wy); enterWorldMap(g5);
    addStatus(g5, g5.player, "flying", { t: 20 });
    const r5 = worldStep(g5, u.wx - n.wx, u.wy - n.wy, { confirm: true, drop: false });
    const want = Math.max(0, u.lostChance * (isNight(g5) ? OW().nightLost : 1) - OW().flyingLost);
    out.flying = { chance: r5.chance?.lost, want, stillFlying: hasStatus(g5.player, "flying") };
    if (!near(r5.chance?.lost ?? -1, want)) problems.push(`lost: flying when you set out: chance ${r5.chance?.lost}, want ${want}`);
  }
  // INT, Terrain lore and Homing sense (bible §4.9, §15.6; TECH_DESIGN §5.2's −0.02 a point of INT modifier).
  {
    const g9 = fresh(G, 67, G.game.world), W9 = g9.run.world, q = g9.player;
    const forest = W9.tiles.find((v) => v.terrain === "forest" && !v.roadWidth && !v.riverWidth && !v.landmark);
    const marsh = W9.tiles.find((v) => v.terrain === "marsh" && !v.roadWidth && !v.riverWidth && !v.landmark);
    const base = lostChance(g9, forest, {});   // by day: the data, 0.1
    q.attrs = { ...(q.attrs || {}), int: 20 }; invalidateStats(q);   // INT 20: modifier +2
    const smart = lostChance(g9, forest, {});
    q.attrs.int = 16; invalidateStats(q);
    q.perkRank = { ...(q.perkRank || {}), terrainLore: 1 };
    const asked = lostChance(g9, forest, {});                          // the panel asks: learns nothing
    const learnt = lostChance(g9, forest, {}, { learn: true });        // a step taken: the forest is learnt
    const other = lostChance(g9, marsh, {}, { learn: true });          // rank 1: one terrain only
    out.mitigation = { base, smart, asked, learnt, other, lore: Object.keys(atlas(g9).lore) };
    if (!near(base, forest.lostChance) || !near(smart, forest.lostChance - 0.04)) problems.push(`lost: INT 20 (modifier +2) gives ${smart}, not ${forest.lostChance} − 0.04`);
    if (!near(asked, forest.lostChance) || !near(learnt, forest.lostChance * 0.25) || !near(other, marsh.lostChance)) problems.push(`lost: Terrain lore (${JSON.stringify(out.mitigation)})`);
    // Homing sense: the new-zone roll at 50% (the plain one forced to 0 here, the Homing one to 1).
    delete q.perkRank.terrainLore;
    const row = W9.tiles.find((u) => [0, 1, 2].every((k) => { const v = W9.tileAt(u.wx + k, u.wy); return v && v.travel === "yes" && !v.roadWidth && !v.riverWidth && !v.landmark; }) && u.wx > 2);
    goTo(g9, row.wx, row.wy);
    addStatus(g9, q, "lost", { t: OW().lostFor }); atlas(g9).lost = { in: g9.zone.key, since: g9.time, tried: {}, height: {}, gnomon: {} };
    const u0 = overrideRules("overworld", { recover: 0, recoverHoming: 1 });
    try {
      goTo(g9, row.wx + 1, row.wy);
      const plainStill = isLost(g9);
      q.perkRank.homingSense = 1;
      goTo(g9, row.wx + 2, row.wy);
      out.homing = { plainStill, found: !isLost(g9) };
      if (!plainStill || isLost(g9)) problems.push(`lost: Homing sense (${JSON.stringify(out.homing)})`);
    } finally { u0(); delete q.perkRank.homingSense; }
  }
  out.ways = ["road", "visited", "roll", "height", "asking", "expiry"];
  return out;
}

// --- 6b. A zone read back from the save (WS9's ZONE_LOADER) ---------------------------------------------------------
async function stored(G, problems) {
  const game = fresh(G, 65, G.game.world), was = { ...ZONE_LOADER };
  goTo(game, 3, 3); enterWorldMap(game);
  worldStep(game, 1, 0, { confirm: true, drop: false });
  if (game.trip.prompt) answer(game, false);
  const errors = console.error;
  const out = {};
  try {
    // A read that fails: the screen lets you go again (not busy), you stay on the world map, nothing thrown.
    Object.assign(ZONE_LOADER, { has: (g, k) => k === "4,3,0", load: async () => { throw new Error("a broken record"); } });
    console.error = () => {};
    let threw = false;
    try { await leaveWorldMap(game, { at: "edge" }); } catch { threw = true; }
    out.failed = { mode: game.mode, busy: !!game.trip?.busy, threw };
    if (threw || game.mode !== "world" || game.trip?.busy) problems.push(`stored zone: a failed read left ${JSON.stringify(out.failed)}`);
    // A read that works: down into it, as from memory.
    // (a zone the way the save's loader hands one back: generated, sealed, not yet in game.zones)
    Object.assign(ZONE_LOADER, { load: async (g, key) => { const [wx, wy, z] = key.split(",").map(Number); const zone = ZONE_GENERATORS.surface(g, { wx, wy, z, key }); zone.seal(); return zone; } });
    const r = await leaveWorldMap(game, { at: "edge" });
    out.read = { ok: r, zone: game.zone.key, mode: game.mode };
    if (r !== true || game.zone.key !== "4,3,0" || game.mode !== "map") problems.push(`stored zone: a read that works didn't take you down (${JSON.stringify(out.read)})`);
  } finally { Object.assign(ZONE_LOADER, was); console.error = errors; }
  return out;
}

// --- 7. Discovery ------------------------------------------------------------------------------------------------
function discovery(G, scr, problems) {
  const out = {};
  // A new run starts on its world's start span with no XP (its landmark is paid without any: the parent's campaign
  // under (0, 0) keeps its numbers), on both worlds.
  for (const [wn, w] of WORLDS(G.game)) {
    const g0 = fresh(G, 70, w), st = g0.run.world.start, site = g0.run.sites.get(`landmark:${st.landmarkId}`);
    if (g0.player.xp !== 0 || g0.player.level !== 1 || !atlas(g0).paid[site?.id]) problems.push(`discovery: a new run on the ${wn} world starts with ${g0.player.xp} XP at level ${g0.player.level} (start landmark paid: ${!!atlas(g0).paid[site?.id]})`);
  }
  const game = fresh(G, 71, G.game.world), W = game.run.world, A = atlas(game), p = game.player;
  if (!isKnown(game, 0, 0)) problems.push("discovery: the start span isn't known");
  if (isKnown(game, 20, 8)) problems.push("discovery: the ruin's span known from the start");
  const n = reveal(game, 20, 8, 1);
  if (n !== 9 || !isKnown(game, 21, 9) || !knownSites(game, 20, 8).some((s) => s.kind === "landmark")) problems.push(`discovery: reveal (20, 8) radius 1 made ${n} spans known`);
  pin(game, 3, 3, { label: "a well", secretId: "loc:test" }); pin(game, 3, 3, { label: "a well", secretId: "loc:test" });
  if (pinsAt(game, 3, 3).length !== 1 || !isKnown(game, 3, 3)) problems.push("discovery: a secret's pin twice made more than one, or its span isn't known");
  // XP: once a site; the start span, and villages, nothing.
  const xp0 = totalXp(p);
  goTo(game, 0, 0);
  if (totalXp(p) !== xp0) problems.push("discovery: XP for the start span");
  const ruin = game.run.sites.get("landmark:ruin");
  const want = Math.round(0.3 * xpToNext(levelOfTier(ruin.tier)));
  goTo(game, 20, 8);
  const got = totalXp(p) - xp0;
  if (got !== want) problems.push(`discovery: the ruin landmark gave ${got} XP, not ${want}`);
  goTo(game, 19, 8); goTo(game, 20, 8);
  if (totalXp(p) - xp0 !== want) problems.push("discovery: XP again on a second visit");
  out.landmark = got;
  const site = [...game.run.sites.values()].find((s) => s.kind !== "landmark" && s.kind !== "village");
  const village = [...game.run.sites.values()].find((s) => s.kind === "village");
  if (site) {
    const x1 = totalXp(p);
    goTo(game, site.at.wx, site.at.wy);
    const g = totalXp(p) - x1, w2 = Math.round(0.1 * xpToNext(levelOfTier(site.tier)));
    if (g !== w2 || discoveryXp(game, site) !== w2) problems.push(`discovery: ${site.kind} ${site.id} gave ${g} XP, not ${w2}`);
    out.site = { kind: site.kind, xp: g };
  }
  if (village) {   // nothing from discovery (a village's own first visit pays its XP: story/village-site.js, WS7b)
    goTo(game, village.at.wx, village.at.wy);
    const ours = game.messages.filter((m) => m.text.startsWith(`You've found ${village.name}.`));
    if (discoveryXp(game, village) !== 0 || ours.length) problems.push(`discovery: XP for a village (${ours.map((m) => m.text).join("; ")})`);
    out.village = 0;
  }
  // A hidden site seen from the road: declined, not recorded; then looked at.
  const hidden = [...game.run.sites.values()].find((s) => s.kind !== "landmark" && !A.found[s.id] && !game.zones.has(zoneKey(s.at.wx, s.at.wy, 0)));
  if (hidden) {
    const nb = W.neighbours(hidden.at.wx, hidden.at.wy).find((v) => !canStep(W, v, hidden.at.wx - v.wx, hidden.at.wy - v.wy));
    goTo(game, nb.wx, nb.wy); enterWorldMap(game);
    const tt = W.tileAt(hidden.at.wx, hidden.at.wy);
    const undo = [overrideRules("overworld", { hiddenSite: 1 }), swap(tt, { lostChance: 0, encounterRate: 0 })];
    try {
      const dx = hidden.at.wx - nb.wx, dy = hidden.at.wy - nb.wy;
      const r1 = worldStep(game, dx, dy, { confirm: true });
      if (r1.site?.id !== hidden.id || game.trip.prompt?.kind !== "site") problems.push(`discovery: no "Stop and look?" for ${hidden.id}`);
      answer(game, false);
      if (A.found[hidden.id]) problems.push("discovery: a declined site was recorded");
      worldStep(game, -dx, -dy, { confirm: true });
      if (game.trip.prompt) answer(game, false);
      const r2 = worldStep(game, dx, dy, { confirm: true });
      if (r2.site?.id === hidden.id) answer(game, true);
      const rect = hidden.surface.rect, q = game.player;
      out.hidden = { found: A.found[hidden.id], zone: game.zone.key };
      if (A.found[hidden.id] !== "road" || game.zone.key !== zoneKey(hidden.at.wx, hidden.at.wy, 0)) problems.push(`discovery: looking at a hidden site (${JSON.stringify(out.hidden)})`);
      else if (rect && (q.x < rect.x - 6 || q.x > rect.x + rect.w + 6 || q.y < rect.y - 6 || q.y > rect.y + rect.d + 6)) problems.push(`discovery: looking at ${hidden.id} put you at (${q.x.toFixed(1)}, ${q.y.toFixed(1)}), far from it`);
    } finally { undo.forEach((u) => u()); }
  }
  // A landmark of several spans is seen from any of them (Halfnight, (24..26, 11) on the real world), and from
  // visibleFrom spans of its nearest.
  {
    const gr = fresh(G, 74, REAL_WORLD), L = gr.run.world.landmarks.get("halfnight");
    if (L && L.spans.length > 1) {
      const [x, y] = L.spans[L.spans.length - 1];
      sight(gr, x, y);
      if (!isKnown(gr, L.wx, L.wy)) problems.push(`discovery: standing on Halfnight's span (${x}, ${y}) didn't make it known`);
      const g4 = fresh(G, 75, REAL_WORLD), L4 = g4.run.world.landmarks.get("halfnight");
      const undo = swap(L4, { visibleFrom: 2 });
      try { sight(g4, x + 2, y); } finally { undo(); }
      if (!isKnown(g4, L4.wx, L4.wy)) problems.push("discovery: Halfnight with visibleFrom 2 not seen from 2 spans east of its east end");
      out.sight = true;
    }
  }
  // The hidden-site rate: 4,000 rolls on a span with one site you don't know: the bible's 10%, 20% with Keen Eye
  // (§4.9, §15.6; ±2 points).
  {
    const g8 = fresh(G, 78, G.game.world), A8 = atlas(g8);
    const s8 = [...g8.run.sites.values()].find((x) => x.kind !== "landmark" && !A8.found[x.id] && (g8.run.sitesAt.get(spanKey(x.at.wx, x.at.wy)) || []).length === 1);
    const rate = () => { let n = 0; for (let k = 0; k < 4000; k++) if (hiddenSiteRoll(g8, s8.at)) n++; return n / 4000; };
    const plain = rate();
    g8.player.perkRank = { ...(g8.player.perkRank || {}), keenEyeSites: 1 };
    const keen = rate();
    delete g8.player.perkRank.keenEyeSites;
    out.hiddenRate = { plain, keen };
    if (Math.abs(plain - 0.1) > 0.02 || Math.abs(keen - 0.2) > 0.02) problems.push(`discovery: hidden sites found ${plain} (want 0.1), ${keen} with Keen Eye (want 0.2)`);
  }
  // Fast travel asks about no hidden site: a journey onto a span counted visited whose site isn't found, at a
  // hidden-site chance of 1, arrives without a prompt and records nothing.
  {
    const g7 = fresh(G, 77, G.game.world), W7 = g7.run.world, A7 = atlas(g7);
    const s7 = [...g7.run.sites.values()].find((x) => x.kind !== "landmark" && !A7.found[x.id]);
    const n7 = W7.neighbours(s7.at.wx, s7.at.wy).find((v) => !canStep(W7, v, s7.at.wx - v.wx, s7.at.wy - v.wy));
    goTo(g7, n7.wx, n7.wy); enterWorldMap(g7);
    A7.visited[spanKey(s7.at.wx, s7.at.wy)] = 0;
    const undo = [overrideRules("overworld", { hiddenSite: 1 }), swap(W7.tileAt(s7.at.wx, s7.at.wy), { encounterRate: 0, lostChance: 0 })];
    let r7;
    try { r7 = fastTravel(g7, s7.at, { confirm: true }); } finally { undo.forEach((u) => u()); }
    out.fastHidden = { steps: r7.steps, prompt: g7.trip?.prompt?.kind || null };
    if (!r7.ok || g7.trip?.prompt || g7.trip?.wx !== s7.at.wx || A7.found[s7.id]) problems.push(`discovery: fast travel asked about a hidden site (${JSON.stringify(out.fastHidden)})`);
  }
  // Travellers: a rumour of a site near by, pinned.
  {
    const g2 = fresh(G, 72, G.game.world), W2 = g2.run.world;
    const s = [...g2.run.sites.values()].find((x) => x.kind !== "landmark");
    const from = W2.neighbours(s.at.wx, s.at.wy).find((v) => !canStep(W2, v, 0, 0) || true);
    goTo(g2, from.wx, from.wy); enterWorldMap(g2);
    const step = DIRS.find(([dx, dy]) => !canStep(W2, g2.trip, dx, dy));
    const tt = W2.tileAt(g2.trip.wx + step[0], g2.trip.wy + step[1]);
    const undo = [swap(tt, { encounterRate: 1, lostChance: 0 }), swap(ENCOUNTERS.kinds, { band: 0, legend: 0, travellers: 1 })];
    let r;
    try { r = worldStep(g2, step[0], step[1], { confirm: true }); } finally { undo.forEach((u) => u()); }
    const pinned = Object.values(atlas(g2).pins).length;
    out.travellers = { kind: r.encounter?.kind, pinned, stayed: !!g2.trip };
    if (r.encounter?.kind !== "travellers" || !g2.trip || !(pinned || Object.keys(atlas(g2).revealed).length > 1)) problems.push(`discovery: travellers (${JSON.stringify(out.travellers)})`);
  }
  // The tier warning: a span 2+ tiers above yours asks first, and nothing passes until you say yes.
  {
    const g3 = fresh(G, 73, G.game.world), W3 = g3.run.world;
    const far = W3.tiles.find((u) => u.tier >= 3 && u.travel === "yes" && W3.neighbours(u.wx, u.wy).some((v) => W3.tileAt(v.wx, v.wy).tier < 3 && !canStep(W3, v, u.wx - v.wx, u.wy - v.wy)));
    const from = W3.neighbours(far.wx, far.wy).find((v) => W3.tileAt(v.wx, v.wy).tier < 3 && !canStep(W3, v, far.wx - v.wx, far.wy - v.wy));
    goTo(g3, from.wx, from.wy); enterWorldMap(g3);
    const t0 = g3.time, r = worldStep(g3, far.wx - from.wx, far.wy - from.wy);
    if (r.confirm !== "tier" || g3.time !== t0 || g3.trip.wx !== from.wx) problems.push("discovery: no tier warning before a tier-3 span at level 1");
    if (!/^[A-Z]/.test(g3.trip.prompt?.line || "")) problems.push(`discovery: the tier warning begins in lower case: "${g3.trip.prompt?.line}"`);
    // Under the prompt a click on the footer's "Enter: go down" doesn't answer it; a click on "Y: yes" does.
    G.draw();
    const lines = scr.frameText().split("\n"), find = (label) => { for (let y = lines.length - 1; y >= 0; y--) { const x = lines[y].indexOf(label); if (x >= 0) return { x, y }; } return null; };
    const footer = find("Enter: go down");
    SCREENS.get("world").mouse(g3, 0, footer);
    if (!g3.trip?.prompt || g3.trip.wx !== from.wx) problems.push("discovery: a click on the footer's \"Enter: go down\" answered the tier warning");
    const yes = find("Y: yes");
    if (yes) { SCREENS.get("world").mouse(g3, 0, yes); if (g3.trip?.prompt) problems.push("discovery: a click on \"Y: yes\" didn't answer"); else out.promptClicks = true; }
    const r2 = g3.trip?.prompt ? answer(g3, true) : { ok: g3.trip?.wx === far.wx, dropped: !g3.trip };
    if (!r2?.ok || g3.trip?.wx !== far.wx && !r2?.dropped) problems.push("discovery: yes to the tier warning didn't take the step");
    out.tierWarning = true;
    // Fast travel names the highest tier on its way: a path of visited spans along row 5 of the Westreach, one span
    // made tier 3 midway and the last tier 5, asks about tier 5.
    const g6 = fresh(G, 76, G.game.world), W6 = g6.run.world, A6 = atlas(g6);
    goTo(g6, 1, 5); enterWorldMap(g6);
    for (let x = 2; x <= 7; x++) A6.visited[spanKey(x, 5)] = 0;
    const end = { wx: 7, wy: 5 }, p6 = travelPath(g6, g6.trip, end);
    if (!p6 || p6.length < 3) problems.push("discovery: no fast-travel path along row 5 to test the warning on");
    else {
      const undo = [swap(W6.tileAt(p6[1].wx, p6[1].wy), { tier: 3 }), swap(W6.tileAt(end.wx, end.wy), { tier: 5 })];
      try { fastTravel(g6, end); } finally { undo.forEach((u) => u()); }
      out.fastWarning = g6.trip.prompt?.line;
      if (!/tier 5/.test(g6.trip.prompt?.line || "")) problems.push(`discovery: fast travel's warning names "${g6.trip.prompt?.line}", not the tier-5 span at its end`);
    }
  }
  return out;
}

// --- 8. The screen -----------------------------------------------------------------------------------------------
function screen(G, scr, problems) {
  const out = {};
  for (const [name, world] of WORLDS(G.game))
    for (const [cols, rows] of [[100, 30], [160, 64], [180, 56]]) {
      scr.resize(cols, rows);
      const game = fresh(G, 81, world), W = game.run.world;
      if (!enterWorldMap(game).ok) { problems.push(`screen ${name} ${cols}×${rows}: no world map`); continue; }
      G.draw();
      const text = scr.frameText().split("\n"), tag = `screen ${name} ${cols}×${rows}`;
      const v = worldView, right = cols >= 2 * W.w + 42;
      let drawn = 0;
      for (let sy = 0; sy < v.viewH; sy++) for (let sx = 0; sx < v.viewW; sx++)
        if (W.inBounds(v.sx0 + sx, v.sy0 + sy) && text[v.y0 + sy][v.x0 + sx * 2] !== " ") drawn++;
      if (drawn !== W.w * W.h) problems.push(`${tag}: ${drawn} of ${W.w * W.h} spans on screen`);
      if (!text.join("\n").includes("@")) problems.push(`${tag}: you (@) aren't on it`);
      if (!text[0].includes("World map")) problems.push(`${tag}: no header`);
      if (v.panel !== (right ? "right" : "strip")) problems.push(`${tag}: the panel is ${v.panel}`);
      const info = text.findIndex((l) => l.includes(`(${game.trip.wx}, ${game.trip.wy})`));
      if (info < 0) problems.push(`${tag}: the span's info isn't shown`);
      else if (right && text[info].indexOf(`(${game.trip.wx}`) < cols - 41) problems.push(`${tag}: the info isn't in the right-hand panel`);
      else if (!right && info < rows - 7) problems.push(`${tag}: the info isn't in the bottom strip`);
      if (!text[rows - 1].includes("Enter: go down")) problems.push(`${tag}: no key footer`);
      // A right click in the margin beside the world (at 180×56 it is narrower than the view): no pin, nowhere.
      if (v.sx0 < 0 || v.sy0 < 0) {
        const pins0 = Object.keys(atlas(game).pins).length;
        SCREENS.get("world").mouse(game, 2, { x: 0, y: v.y0 });
        if (Object.keys(atlas(game).pins).length !== pins0) problems.push(`${tag}: a right click in the margin pinned ${JSON.stringify(Object.values(atlas(game).pins).pop())}`);
      }
      // TECH_DESIGN §6.7: the world map draws in ≤ 3 ms (p50), here with a far span under the pointer (its path drawn).
      const far = { wx: W.w - 2, wy: Math.floor(W.h / 2) };
      for (let x = 0; x < W.w; x++) atlas(game).visited[spanKey(x, far.wy)] ??= 0;
      game.trip.hover = far;
      const ms = [];
      for (let k = 0; k < 60; k++) { const t0 = performance.now(); G.draw(); ms.push(performance.now() - t0); }
      ms.sort((a, b) => a - b);
      const p50 = +ms[30].toFixed(2);
      if (p50 > 3) problems.push(`${tag}: the world map draws in ${p50} ms (p50), over §6.7's 3`);
      game.trip.hover = null;
      out[`${name} ${cols}×${rows}`] = { drawn, panel: v.panel, origin: [v.sx0, v.sy0], drawMs: p50, maxMs: +ms[59].toFixed(2) };
    }
  // Played by keys and the mouse on the test world, at 100×30.
  scr.resize(100, 30);
  const game = fresh(G, 82, G.game.world);
  goTo(game, 3, 3);
  const keys = (code) => dispatchKey(game, code, false, "");
  keys("KeyO");
  if (game.mode !== "world") problems.push(`screen: O on the map opened ${game.mode}`);
  keys("ArrowRight");
  if (game.trip?.wx !== 4 || game.trip?.wy !== 3) problems.push("screen: → didn't step east");
  if (game.trip?.prompt) keys("KeyN");
  G.draw();
  // A click on the span south of you steps there.
  const cell = { x: (game.trip.wx - worldView.sx0) * 2, y: worldView.y0 + game.trip.wy + 1 - worldView.sy0 };
  SCREENS.get("world").mouse(game, 0, cell);
  if (game.trip?.wy !== 4) problems.push("screen: a click on the span to the south didn't step there");
  if (game.trip?.prompt) keys("KeyN");
  keys("KeyZ");
  if (game.mode !== "wait") problems.push(`screen: Z on the world map opened ${game.mode}`);
  for (let k = 0; k < 5; k++) keys("ArrowDown");   // "1 hour"
  const t0 = game.time;
  keys("Enter");
  if (game.time - t0 < 60 * RULES.clock.secondsPerMinute - 1e-6 && game.mode === "world") problems.push(`screen: waiting an hour from the menu passed ${game.time - t0} s`);
  if (game.mode === "world") {
    keys("Enter");
    if (game.mode === "world" && game.trip?.menu) keys("Enter");
  }
  if (game.mode !== "map" || game.zone.key !== "4,4,0") problems.push(`screen: Enter didn't take you down into (4, 4) (${game.mode}, ${game.zone.key})`);
  // In 3D: O, Esc unmoved: back in 3D where you stood.
  game.view = "3d"; setMode(game, "explore", null, { pointer: false });
  const p = game.player, at = [p.x, p.y];
  keys("KeyO"); keys("Escape");
  if (game.mode !== "explore" || p.x !== at[0] || p.y !== at[1]) problems.push(`screen: O then Esc in 3D left you in ${game.mode}`);
  keys("KeyZ");
  if (game.mode !== "wait") problems.push(`screen: Z in 3D opened ${game.mode}`);
  keys("Escape");
  if (game.mode !== "explore") problems.push(`screen: Esc on the wait menu left you in ${game.mode}`);
  out.keys = true;
  scr.resize(180, 56);
  // A span's panel ends with its region's one sentence (C1a's `line`; integrator, C1a #4), on the real world.
  {
    const g = fresh(G, 61, REAL_WORLD), W = g.run.world, st = W.start, t = W.tileAt(st.wx, st.wy), R = W.regions?.[t.region];
    const lines = spanLines(g, st.wx, st.wy).map((l) => l.text);
    if (!R?.line || lines.at(-1) !== R.line) problems.push(`screen: the panel of (${st.wx}, ${st.wy}) ends "${lines.at(-1)}", not its region's line`);
    out.regionLine = `${t.region}: "${(R?.line || "").slice(0, 40)}…"`;
  }
  // The browser game's world (config.js WORLD, read by main.js; the last wiring merge): the real one, unless the URL
  // says ?world=test (the browser tools'). Node's checks build on the test world whatever it says (game.js).
  const flags = [["", "real"], ["?quick=1", "real"], ["?world=real", "real"], ["?world=test", "test"], ["?seed=7&world=test&silent=1", "test"], ["?world=TEST", "real"], ["?world", "real"]];
  const bad = flags.filter(([q, w]) => parseWorld(q) !== w);
  if (bad.length || WORLD !== "real" || G.game.world?.world?.id !== "test") problems.push(`screen: parseWorld ${bad.map(([q, w]) => `"${q}" → ${parseWorld(q)}, want ${w}`).join("; ")}; WORLD in Node ${WORLD}; Node's game world ${G.game.world?.world?.id}`);
  out.worldFlag = `${flags.length} URLs, only ?world=test the test world; Node: WORLD ${WORLD}, its game on the ${G.game.world?.world?.id} world`;
  return out;
}

export async function run(env) {
  const scr = await env.screen({ cols: 180, rows: 56 });
  const G = await env.src("game.js");
  const steps = Number(env.args?.steps) || 10000, walkSeed = Number(env.args?.walkSeed) || 0;
  const results = [];
  const section = (name, fn) => {
    const problems = [];
    let stats = {};
    try { stats = fn(problems) || {}; } catch (e) { problems.push(`threw: ${e?.stack || e}`); }
    results.push({ name: `overworld: ${name}`, ok: problems.length === 0, problems, stats });
  };
  section("random walk", (pr) => Object.fromEntries(WORLDS(G.game).map(([n, w]) => [n, walk(G, n, w, steps, pr, walkSeed)])));
  section("fast travel", (pr) => Object.fromEntries(WORLDS(G.game).map(([n, w]) => [n, fast(G, n, w, pr)])));
  section("arrival edges", (pr) => ({ test: arrival(G, "test", G.game.world, { wx: 5, wy: 5 }, pr), real: arrival(G, "real", REAL_WORLD, { wx: 8, wy: 17 }, pr) }));
  section("encounter bands", (pr) => Object.fromEntries(WORLDS(G.game).map(([n, w]) => [n, bands(G, n, w, pr)])));
  section("encounter tables (C3)", (pr) => encounterTables(G, pr));
  section("rest", (pr) => resting(G, pr));
  section("lost", (pr) => lost(G, pr));
  { const problems = []; let stats = {}; try { stats = await stored(G, problems); } catch (e) { problems.push(`threw: ${e?.stack || e}`); }
    results.push({ name: "overworld: a zone from the save", ok: !problems.length, problems, stats }); }
  section("discovery", (pr) => discovery(G, scr, pr));
  section("screen", (pr) => screen(G, scr, pr));
  return results;
}
