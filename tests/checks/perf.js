// Performance (0D2 skeleton, WS3's since Phase 1; TECH_DESIGN §9 "check-perf", §6.7 budgets): the engine's costs in Node, each
// reported as p50/p95/max over many samples against its §6.7 budget.
//
//   measurePerf(src, opts) → { samples: { id: [ms] }, info: { … } }   src(path) → module of the tree measured
//   judgePerf(head, { ref, refName }) → { name, ok, problems, stats, notes }
//   BUDGETS                                                          [{ id, what, budget, stat, from }]
//
// What is measured (Node, the stub screen at 180×56; the same code runs on an older tree, p0-done's included):
//   frame.outdoor   a whole frame (the 3D view, the HUD, present) on the start span of the test world, 6 tiles from
//                   its open east edge, the apron filled, the camera turning a full circle (across the edge and inward),
//                   at noon (12:00); frame.dusk and frame.night the same at 18:30 and 23:00 (the clock's looks: a tree
//                   before WS3 draws noon at every hour)
//   bake            the sun's bake for one light bucket (light.js bakeSun) on that span with its apron, 12 buckets from
//                   06:00 to 17:00 (a tree before WS3 has none: not measured there)
//   swap (notes)    walking off that span's east edge in 3D: the swap frame's step and draw, and the next frame's draw,
//                   three crossings (the first is the process's first frame in another zone); no budget of its own
//                   (§6.7: "one frame + refresh()"), reported against the reference
//   frame.dungeon   the same on legacy level 3 (no row of its own in §6.7: held to the outdoor frame's 17 ms)
//   refresh         Zone.refresh() of that 80×48×16 surface and its apron (fillApron) after it
//   apron           fillApron alone, the neighbours in memory (a copy)
//   gen.surface     generateSurface on 40 spans (20 of each world), after 3 not counted
//   gen.dungeon     generateDungeonLevel on 100 legacy levels (5 seeds × 20), after 10 not counted
//   buildRun, restoreRun   the real world on 8 seeds
//   passTime        one simulated second on the map with 60 creatures hunting you inside the active radius (an open
//                   span, level 5 legacy types, you can't die); mapStep: one map step's time (turns.js STEP_TIME)
//   skipTime        8 game hours, no hostile awake (a rest on that span)
// Not measured here: the world map draw (WS1), and the browser's render3d and present (tools/browser-0d1.mjs
// measures the browser's frame time).
//
// The verdict: an item is within budget when its statistic (p50, or p95 / max where §6.7 says so) is at most the
// budget. Timing depends on the machine: tools/check-perf.mjs measures a reference tree as well (p0-done by default,
// unpacked by `git archive`, run as many times as this one, alternately, in the same conditions) whenever an item is
// over budget, and then an item over budget here but at most 15% slower than there (MACHINE_SLACK; the reference is
// then itself within 15% of the budget) is reported as the machine's ("over budget on this machine, and p0-done as
// slow") and does not fail; one more than 15% slower than p0-done fails ("over budget against p0-done"), whether or not
// p0-done kept within the budget. (Until 0D2's verification an item failed whenever the reference landed under the
// budget, so two trees level within noise near a budget passed or failed by chance.) Without a reference (the
// browser, or --against none) every item over budget fails. verdictProblems() tests the verdict itself.
export const BUDGETS = [
  { id: "frame.outdoor", what: "Node outdoor frame at 180×56, apron included, noon", budget: 17, stat: "p50", from: "§6.7" },
  { id: "frame.dusk", what: "the same at 18:30", budget: 17, stat: "p50", from: "§6.7" },
  { id: "frame.night", what: "the same at 23:00", budget: 17, stat: "p50", from: "§6.7" },
  { id: "bake", what: "the sun bake for one light bucket, 80×48×16 with its apron", budget: 4, stat: "p50", from: "§6.7" },
  { id: "frame.dungeon", what: "Node dungeon frame at 180×56 (the outdoor budget)", budget: 17, stat: "p50", from: "§6.7 (outdoor row)" },
  { id: "refresh", what: "refresh() 80×48×16, apron included", budget: 10, stat: "p50", from: "§6.7" },
  { id: "apron", what: "apron copy (fillApron, neighbours in memory)", budget: 2, stat: "p50", from: "§6.7" },
  { id: "gen.surface", what: "surface generation p95", budget: 60, stat: "p95", from: "§6.7" },
  { id: "gen.surface.max", what: "surface generation max", budget: 150, stat: "max", from: "§6.7", samples: "gen.surface" },
  { id: "gen.dungeon", what: "dungeon generation p95", budget: 40, stat: "p95", from: "§6.7" },
  { id: "buildRun", what: "buildRun (the real world)", budget: 200, stat: "p50", from: "§6.7" },
  { id: "restoreRun", what: "restoreRun (the real world)", budget: 50, stat: "p50", from: "§6.7" },
  { id: "passTime", what: "passTime per simulated second, 60 creatures in the active radius", budget: 12, stat: "p50", from: "§6.7" },
  { id: "mapStep", what: "a map step (passTime of STEP_TIME), the same 60", budget: 3, stat: "p50", from: "§6.7" },
  { id: "skipTime", what: "skipTime, 8 game hours, no hostile awake", budget: 20, stat: "p50", from: "§6.7" },
];
export const NOT_YET = ["world map draw ≤ 3 ms (WS1)",
  "render3d in the browser ≤ 13 ms and present ≤ 5 ms (tools/browser-0d1.mjs measures the browser's frame time)"];
export const MACHINE_SLACK = 1.15;   // over budget, and at most this much slower than the reference: the machine's

const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
export function summary(ms) {
  const s = [...ms].sort((a, b) => a - b), r = (v) => +v.toFixed(2);
  return { n: s.length, p50: r(pct(s, 0.5)), p95: r(pct(s, 0.95)), max: r(s[s.length - 1]), mean: r(s.reduce((a, b) => a + b, 0) / s.length) };
}

export async function measurePerf(src, { frames = 72, seed = 4242 } = {}) {
  const [{ game, startRun }, zones, surface, dungeon, run, worldmodel, testWorld, worldmap, turns, time, creatures, light, clock, input, render3d] = await Promise.all(
    ["game.js", "zones.js", "gen/surface.js", "gen/dungeon.js", "world/run.js", "world/worldmodel.js", "content/world/test-world.js",
     "content/world/worldmap.js", "turns.js", "time.js", "creatures.js", "light.js", "clock.js", "input.js", "render3d.js"].map((p) => src(p)));
  render3d.setDynamicResolution?.(false);   // every frame measured whole (dynamic resolution is the page's)
  const samples = {}, info = {};
  const timed = (id, fn) => { const t0 = performance.now(); fn(); (samples[id] ||= []).push(performance.now() - t0); };
  const p = () => game.player;
  const invulnerable = () => { p().maxHpGain = 1e6; p().hp = 1e6; };

  startRun(seed);
  game.pages = null; game.pendingPages = null; game.story.cube = true;
  invulnerable();

  // A frame: the whole draw in 3D, the camera turning.
  const frameRun = (id, n) => {
    game.view = "3d"; game.mode = "explore"; game.paused = false; game.cam = null; game.fov = 75; game.effects = [];
    for (let k = -8; k < n; k++) {   // (8 not counted: the JIT warming up)
      p().yaw = (k / n) * 2 * Math.PI; p().pitch = 0;
      if (k < 0) game.debug.draw(); else timed(id, () => game.debug.draw());
    }
  };
  const standNear = (zone, x0, y0) => {   // the standable tile nearest (x0, y0) on the zone's ground
    let best = null;
    for (let y = 1; y < zone.d - 1; y++)
      for (let x = 1; x < zone.w - 1; x++) {
        const z = zone.stand[x + y * zone.w], d = Math.abs(x - x0) + Math.abs(y - y0);
        if (z >= 0 && (!best || d < best.d)) best = { x, y, z, d };
      }
    return best;
  };
  const place = (zone, x0, y0) => {
    const at = standNear(zone, x0, y0);
    Object.assign(p(), { x: at.x + 0.5, y: at.y + 0.5, z: at.z, vz: 0, pitch: 0 });
    return at;
  };

  // --- The start span: frames, refresh, the apron -------------------------------------------------------------
  const start = game.zone;
  const at = place(start, start.w - 6, start.d >> 1);
  info.outdoor = `${start.key} (${start.type} ${start.w}×${start.d}×${start.h}) at ${at.x},${at.y}; apron bands ${Object.values(start.apron || {}).filter(Boolean).length}`;
  for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) {
    const addr = zones.neighbourAddr(game, start, side);
    if (addr && !zones.cachedZone(game, addr.key)) zones.makeZone(game, addr.key);
  }
  zones.fillApron(game, start);
  info.outdoor = `${start.key} (${start.type} ${start.w}×${start.d}×${start.h}) at ${at.x},${at.y}; apron bands ${Object.values(start.apron || {}).filter(Boolean).length}`;
  const at6 = (h) => (h - 6) * 60;   // the game time of an hour of day 1 (one world hour is 60 s; the run starts at 06:00)
  for (const [id, h] of [["frame.outdoor", 12], ["frame.dusk", 18.5], ["frame.night", 23]]) { game.time = at6(h); frameRun(id, frames); }
  game.time = at6(12);

  // The sun's bake, a light bucket at a time (a tree without one has no bakeSun).
  if (light.bakeSun && clock.lightBucketAt) {
    const buckets = Array.from({ length: 12 }, (_, k) => clock.lightBucketAt((6 + k) * 60 + 7));
    for (let k = -2; k < buckets.length; k++) {
      const b = buckets[(k + buckets.length) % buckets.length];
      if (k < 0) light.bakeSun(start, b); else timed("bake", () => light.bakeSun(start, b));
    }
    info.bake = `${buckets.length} buckets 06:07-17:07 (${buckets[0]}..${buckets.at(-1)}), the start span with its apron`;
  }

  // Off the east edge in 3D, three times (out, back, out): the swap frame's step and draw, the next frame's draw.
  const swaps = [];
  for (const [side, yaw] of [["e", 0], ["w", Math.PI], ["e", 0]]) {
    const z0 = game.zone, near = standNear(z0, side === "e" ? z0.w - 3 : 2, z0.d >> 1);
    Object.assign(p(), { x: near.x + 0.5, y: near.y + 0.5, z: near.z, vz: 0, yaw, pitch: 0 });
    game.view = "3d"; game.mode = "explore"; game.paused = false; game.cam = null; game.effects = [];
    input.keys.clear();
    for (let k = 0; k < 30; k++) { game.debug.step(1 / 60); game.debug.draw(); p().yaw = yaw; p().pitch = 0; }   // the neighbour baked ahead
    input.keys.add("KeyW");
    let rec = null;
    for (let k = 0; k < 120 && !rec?.next; k++) {
      const key = game.zone.key;
      const t0 = performance.now(); game.debug.step(1 / 60); const t1 = performance.now(); game.debug.draw(); const t2 = performance.now();
      if (rec) rec.next = t2 - t1;
      else if (game.zone.key !== key) rec = { from: key, to: game.zone.key, step: t1 - t0, draw: t2 - t1 };
      p().yaw = yaw; p().pitch = 0;
    }
    input.keys.clear();
    if (rec) swaps.push(rec);
  }
  info.swap = swaps.length ? swaps.map((r) => `${r.from}→${r.to} step ${r.step.toFixed(1)} + draw ${r.draw.toFixed(1)} (next ${(r.next ?? 0).toFixed(1)}) ms`).join("; ") : "no crossing";
  samples.swap = swaps.map((r) => r.step + r.draw);
  zones.changeZone(game, start.key, { how: "start", rng: Math.random });
  invulnerable();
  for (let k = -3; k < 30; k++) {
    if (k < 0) { start.refresh(); zones.fillApron(game, start); continue; }
    timed("refresh", () => { start.refresh(); zones.fillApron(game, start); });
    timed("apron", () => zones.fillApron(game, start));
  }

  // --- Generation ---------------------------------------------------------------------------------------------
  const spans = [];
  for (const [world, n] of [[testWorld.TEST_WORLD, 20], [worldmap.REAL_WORLD, 20]]) {
    const r = run.buildRun(seed, world), W = worldmodel.compileWorld(world);
    const tiles = W.tiles.filter((t) => t.travel !== "no" || t.edges === "open");
    for (let k = 0, got = 0; got < n + (spans.length ? 0 : 3) && k < tiles.length; k++) {
      const t = tiles[(k * 37) % tiles.length];
      spans.push([r, t.wx, t.wy]); got++;
    }
  }
  let empty = 0;
  spans.forEach(([r, wx, wy], k) => {
    const t0 = performance.now(), z = surface.generateSurface(r, wx, wy), ms = performance.now() - t0;
    if (!z) empty++;
    else if (k >= 3) (samples["gen.surface"] ||= []).push(ms);
  });
  info.surfaces = `${spans.length - 3} spans of both worlds (${empty} gave no zone)`;
  for (let k = 0; k < 10; k++) dungeon.generateDungeonLevel(9000 + k, dungeon.legacyParams(1 + k * 2, 9000 + k));
  for (let s = 1; s <= 5; s++)
    for (let depth = 1; depth <= 20; depth++) {
      const params = dungeon.legacyParams(depth, s);
      timed("gen.dungeon", () => dungeon.generateDungeonLevel(s, params));
    }
  for (let s = 0; s < 9; s++) {
    let r, data;
    const t0 = performance.now();
    r = run.buildRun(100 + s, worldmap.REAL_WORLD);
    const t1 = performance.now();
    data = JSON.parse(JSON.stringify(run.serializeRun(r)));
    const t2 = performance.now();
    run.restoreRun(data, worldmap.REAL_WORLD);
    const t3 = performance.now();
    if (s > 0) { (samples.buildRun ||= []).push(t1 - t0); (samples.restoreRun ||= []).push(t3 - t2); }
  }

  // --- A dungeon frame ----------------------------------------------------------------------------------------
  zones.changeZone(game, "0,0,3", { how: "down", rng: Math.random });
  invulnerable();
  game.zone.creatures = game.zone.creatures.filter((c) => creatures.canTalk?.(c));
  frameRun("frame.dungeon", frames);

  // --- Time on the map: 60 creatures hunting you, then a rest -------------------------------------------------
  const openKey = "1,0,0";
  zones.changeZone(game, openKey, { how: "start", rng: Math.random });
  const zone = game.zone;
  const here = place(zone, zone.w >> 1, zone.d >> 1);
  zone.creatures = zone.creatures.filter((c) => creatures.canTalk?.(c));
  const types = Object.keys(creatures.CREATURE_TYPES).filter((id) => { const t = creatures.CREATURE_TYPES[id]; return t.depths && t.depths[0] <= 5 && t.depths[1] >= 5; });
  const spots = [];
  for (let y = here.y - 11; y <= here.y + 11; y++)
    for (let x = here.x - 11; x <= here.x + 11; x++) {
      if (x < 1 || y < 1 || x >= zone.w - 1 || y >= zone.d - 1 || (x === here.x && y === here.y)) continue;
      const d = Math.abs(x - here.x) + Math.abs(y - here.y);
      if (zone.stand[x + y * zone.w] >= 0 && d >= 3 && (x * 7 + y * 13) % 5 === 0) spots.push([x, y]);
    }
  const spawnAll = () => {
    zone.creatures = zone.creatures.filter((c) => creatures.canTalk?.(c));
    for (let k = 0; k < 60 && k < spots.length; k++) {
      const [x, y] = spots[(k * 11) % spots.length];
      creatures.addCreature(zone, creatures.spawnCreature(types[k % types.length], x, y, zone.stand[x + y * zone.w], { rng: Math.random, state: "chase", level: 5 }));
    }
  };
  game.view = "map"; game.mode = "map"; game.paused = false;
  spawnAll();
  info.passTime = `${zone.key} (${zone.type}), ${zone.creatures.filter((c) => !creatures.canTalk?.(c)).length} creatures of ${types.length} types within 11 tiles, hunting`;
  for (let k = -2; k < 20; k++) {
    invulnerable();
    if (k % 5 === 0) { spawnAll(); place(zone, here.x, here.y); }
    if (k < 0) turns.passTime(game, 1);
    else timed("passTime", () => turns.passTime(game, 1));
  }
  spawnAll(); place(zone, here.x, here.y);
  for (let k = 0; k < 40; k++) { invulnerable(); timed("mapStep", () => turns.passTime(game, turns.STEP_TIME)); }
  info.mapStep = `STEP_TIME ${turns.STEP_TIME.toFixed(3)} s; mode at the end: ${game.mode}`;

  zone.creatures = zone.creatures.filter((c) => creatures.canTalk?.(c));
  let skipped = 0;
  const t8 = game.time;
  for (let k = -1; k < 6; k++) {
    invulnerable(); p().status = {};
    if (k < 0) time.skipTime(game, 8 * 3600, { interruptible: false, reason: "rest" });
    else timed("skipTime", () => { skipped += time.skipTime(game, 8 * 3600, { interruptible: false, reason: "rest" })?.elapsed ?? 0; });
  }
  info.skipTime = `${(skipped / 3600).toFixed(0)} game hours in 6 skips (the clock moved ${((game.time - t8) / 3600).toFixed(0)} h in 7)`;
  return { samples, info };
}

// The verdict. head, ref: measurePerf results (samples pooled over runs); refName: what ref is ("p0-done").
export function judgePerf(head, { ref = null, refName = "the reference" } = {}) {
  const problems = [], stats = {}, notes = [];
  for (const b of BUDGETS) {
    const ms = head.samples[b.samples || b.id];
    if (!ms?.length) { problems.push(`${b.id}: nothing measured`); continue; }
    const h = summary(ms), v = h[b.stat], over = v > b.budget;
    let line = `${b.samples ? `${b.stat} ${v} ms` : `p50 ${h.p50}, p95 ${h.p95}, max ${h.max} ms (n ${h.n})`}; budget ${b.stat} ≤ ${b.budget}: ${over ? "OVER" : "ok"}`;
    const rms = ref?.samples[b.samples || b.id];
    if (rms?.length) {
      const r = summary(rms), ratio = v / r[b.stat];
      line += ` · ${refName} ${b.stat} ${r[b.stat]} (×${ratio.toFixed(2)})`;
      if (over) {
        if (ratio <= MACHINE_SLACK) notes.push(`${b.id}: over budget on this machine, and ${refName} as slow (${b.stat} ${v} ms here, ${r[b.stat]} there, ` +
          `×${ratio.toFixed(2)}, budget ${b.budget}): not this tree's doing, so not failed`);
        else problems.push(`${b.id}: ${b.what}: ${b.stat} ${v} ms is over the ${b.budget} ms budget against ${refName} ` +
          `(${r[b.stat]} ms there, ×${ratio.toFixed(2)}, more than ×${MACHINE_SLACK}${r[b.stat] <= b.budget ? ", within budget there" : ""})`);
      }
    } else if (over) problems.push(`${b.id}: ${b.what}: ${b.stat} ${v} ms is over the ${b.budget} ms budget (no reference measured)`);
    stats[b.id] = line;
  }
  for (const [k, v] of Object.entries(head.info || {})) notes.push(`${k}: ${v}`);
  if (head.samples.swap?.length) {   // no budget of its own: reported beside the reference's
    const r = ref?.samples.swap, h = summary(head.samples.swap);
    notes.push(`swap frames (step + draw): p50 ${h.p50}, max ${h.max} ms (n ${h.n})${r?.length ? ` · ${refName} p50 ${summary(r).p50}, max ${summary(r).max}` : ""}`);
  }
  notes.push(`not measured yet: ${NOT_YET.join("; ")}`);
  return { name: "perf", ok: problems.length === 0, problems, stats, notes };
}

// The verdict's own test (tools/check-perf.mjs runs it with every measurement): synthetic samples, every item at
// 1 ms but one, whose p95 and max are the value given. → [problem]
export function verdictProblems() {
  const item = BUDGETS.find((b) => b.id === "gen.dungeon"), out = [];
  const run = (v) => ({ samples: Object.fromEntries(BUDGETS.map((b) => [b.samples || b.id, Array.from({ length: 20 }, (_, k) => (b === item && k === 19 ? v : 1))])) });
  for (const [head, ref, fails, what] of [
    [39, null, false, "within budget, no reference"],
    [41, null, true, "over budget, no reference"],
    [40.92, 39.51, false, "over budget, the reference within it but as slow (×1.04): the machine's"],
    [46, 39.51, true, "over budget and ×1.16 the reference: this tree's"],
    [41, 45, false, "over budget, the reference slower still"],
    [52, 45, true, "over budget, both over, ×1.16: this tree's"],
  ]) {
    const r = judgePerf(run(head), { ref: ref === null ? null : run(ref), refName: "ref" });
    const failed = r.problems.some((p) => p.startsWith(`${item.id}:`)), others = r.problems.filter((p) => !p.startsWith(`${item.id}:`));
    if (failed !== fails || others.length) out.push(`the verdict on p95 ${head} ms against ${ref ?? "nothing"} (${what}): ${failed ? "failed" : "passed"}${others.length ? `; ${others[0]}` : ""}`);
  }
  return out;
}

export const overBudget = (head) => BUDGETS.filter((b) => { const ms = head.samples[b.samples || b.id]; return !ms?.length || summary(ms)[b.stat] > b.budget; }).map((b) => b.id);

// tests/checks/index.js's entry point (test-world.html in the browser; Node runs tools/check-perf.mjs, which can
// compare with a reference tree).
export async function run(env) {
  await env.screen();
  return judgePerf(await measurePerf(env.src, { frames: Number(env.args.frames) || 72 }));
}
