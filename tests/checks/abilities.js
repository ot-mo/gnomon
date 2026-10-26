// Abilities (0D2; TECH_DESIGN §2.8, §1.4 abilities.js, §4.3 keys 1-9, §4.5 the HUD): the API, the sample
// (Fold Step, a short teleport) on the hotbar in both views, cooldowns in game seconds.
//
//   checkAbilities({ game, startRun, inputHandlers, abilities, keys, hud, time, turns, status, creatures, zones, S, capture, resize })
//     → { name, ok, problems, stats }
//
//   1. The API: registerAbility needs use(); abilitiesOf is computed from the registered sources (innate,
//      item, and a test source added here) on every call and never stored on the entity; a creature has
//      none; the player has Fold Step (innate) on hotbar key 1 (ids only); activate() refuses an ability
//      you don't have or that cools down, and a use() that does nothing costs nothing.
//   2. Keys: 1-9 (the number row) are bound once each in explore and in map, to the hotbar, and nothing
//      else in either view uses them (helpFor lists only the hotbar's); the numpad's digits still move you
//      on the map. An empty slot says so and does nothing.
//   3. Both views through the real input (onKeyDown "Digit1"): in 3D, facing an open run of floor, you
//      land 4 tiles along the aim; on the map with a rat in sight 6 tiles off you land a tile short of
//      it... at most 4 tiles on, the use costs 0.5 s of game time (as a throw), and with nothing in sight
//      you step the way you face. Pressed again, it's refused and nothing moves.
//   4. Cooldown parity: from the moment of use to ready again is 12 s of game time in 3D (1/60 s frames)
//      and on the map (the use's 0.5 s, then waits); skipTime catches it up exactly (7 s left after a 5 s
//      skip, ready after 7 more); the HUD shows "1 Fold Step 12s" while it cools (at 100×30 with two
//      statuses on, in one row, whole; check-hud holds it to §4.5's priority 70) and nothing once it's ready.
//   5. Targets: requestTarget on the map gives the nearest hostile seen this moment within 10 tiles (not a
//      person, not one unseen, not one farther), else null; aimTarget picks the creature nearest the crosshair
//      inside 6° with line of sight, none outside the cone or behind a wall, and its dir follows the pitch;
//      requestTarget in 3D gives aimTarget's (the rat in the crosshair, not a nearer one below it).
//   6. Landing is always standable over many seeds and positions: legacy levels and surface spans, both
//      views, random standable tiles and random facings: every landing stands on the zone's stand height,
//      on no stairs and no creature, within reach on foot of where you stood, at most 2 × range + 1 tiles
//      away. Walled in on one tile there's no room: refused (told), no cooldown, no time passes.
const DIGITS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9"];

export function checkAbilities({ game, startRun, inputHandlers, abilities: A, keys, hud, time, turns, status, creatures, zones, world, pathing, S, capture, resize }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const rowText = (y) => capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join("");
  const fresh = ({ seed = 7, view = "map", depth = 3 } = {}) => {
    startRun(seed);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    game.debug.enterZone(`${s.wx},${s.wy},${depth}`, "down");
    game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);
    game.zone.spikes = [];
    const p = game.player;
    p.maxHpGain = 999; p.hp = 999;
    game.messages = [];
    return p;
  };
  const tile = (p) => [Math.floor(p.x), Math.floor(p.y)];
  // A tile with `n` standable tiles in a row east of it at the same height (no stairs), clear of creatures.
  const runEast = (zone, n) => {
    const { w, d, stand } = zone;
    for (let y = 2; y < d - 2; y++)
      for (let x = 2; x < w - n - 2; x++) {
        let ok = true;
        for (let k = 0; k <= n && ok; k++) {
          const i = x + k + y * w, g = zone.get(x + k, y, world.FLOOR_Z - 1);
          if (stand[i] !== stand[x + y * w] || stand[i] < 0 || g === world.B.STAIRS || g === world.B.STAIRS_UP) ok = false;
          for (const dz of [0, 1, 2]) if (zone.solid(x + k, y, stand[x + y * w] + dz)) ok = false;   // nothing at head height
        }
        if (ok) return { x, y, z: stand[x + y * w] };
      }
    return null;
  };
  const place = (p, at, yaw = 0) => Object.assign(p, { x: at.x + 0.5, y: at.y + 0.5, z: at.z, vz: 0, yaw, pitch: 0, onGround: true });
  const said = (re) => game.messages.some((m) => re.test(m.text));

  // --- 1. The API ------------------------------------------------------------------------------------------
  {
    let threw = false;
    try { A.registerAbility("broken", { name: "Broken" }); } catch { threw = true; }
    if (!threw) fail("registerAbility took a def without use()");
    const p = fresh();
    const list = A.abilitiesOf(p), again = A.abilitiesOf(p);
    if (JSON.stringify(list) !== JSON.stringify([{ id: "foldStep", lvl: 1, source: "innate", item: null }])) fail(`abilitiesOf(player) = ${JSON.stringify(list)}`);
    if (list === again) fail("abilitiesOf returned the same array twice (stored?)");
    if ("abilities" in p) fail("the player record stores its abilities");
    if (JSON.stringify(p.hotbar) !== '["foldStep"]') fail(`the hotbar is ${JSON.stringify(p.hotbar)}`);
    const def = A.ABILITIES.foldStep;
    if (!def || def.name !== "Fold Step" || def.range !== 4 || def.mapTime !== 0.5 || def.cooldown(1, p) !== 12) fail(`Fold Step's def: ${JSON.stringify(def && { name: def.name, range: def.range, mapTime: def.mapTime })}`);
    // A test source and a test ability: sources add, the first source wins, unknown ids are skipped.
    A.registerAbility("checkPing", { name: "Ping", target: "self", cooldown: () => 3, use: (g, e) => { e.pinged = (e.pinged || 0) + 1; return true; } });
    A.registerAbility("checkDud", { name: "Dud", target: "self", cooldown: () => 5, use: () => false });
    A.registerAbilitySource("checkSource", (e) => e.checkGrants || []);
    const m = creatures.spawnCreature("rat", 5, 5, world.FLOOR_Z, { rng: () => 0.5 });
    if (A.abilitiesOf(m).length) fail(`a rat has abilities: ${JSON.stringify(A.abilitiesOf(m))}`);
    m.checkGrants = [{ id: "checkPing", lvl: 2 }, { id: "nope" }, { id: "foldStep", lvl: 3 }];
    const got = A.abilitiesOf(m).map((a) => `${a.id}:${a.lvl}:${a.source}`).join();
    if (got !== "checkPing:2:checkSource,foldStep:3:checkSource") fail(`a granted rat: ${got}`);
    p.checkGrants = [{ id: "foldStep", lvl: 5 }, { id: "checkDud", lvl: 1 }];
    if (A.abilityOf(p, "foldStep").source !== "innate") fail("a second source overrode the first");
    if (!A.activate(game, m, "checkPing") || m.pinged !== 1 || !(A.cooldownLeft(m, "checkPing") === 3)) fail(`activate on the rat: pinged ${m.pinged}, cooldown ${A.cooldownLeft(m, "checkPing")}`);
    if (A.activate(game, m, "checkPing") || m.pinged !== 1) fail("activate ran while cooling down");
    if (A.activate(game, p, "checkPing")) fail("activate ran an ability the player doesn't have");
    if (A.activate(game, p, "checkDud") || A.cooldownLeft(p, "checkDud") > 0) fail("a use() that did nothing started the cooldown");
    delete p.checkGrants;
  }

  // --- 2. Keys -----------------------------------------------------------------------------------------------
  {
    for (const mode of ["explore", "map"]) {
      const help = keys.helpFor(mode).filter((h) => /^(Digit|Numpad)\d$/.test(h.code));
      const digits = help.filter((h) => h.code.startsWith("Digit"));
      if (digits.length !== 9 || digits.some((h) => h.help !== "abilities (hotbar)")) fail(`${mode}: the number row's bindings ${JSON.stringify(digits)}`);
      if (mode === "explore" && help.some((h) => h.code.startsWith("Numpad"))) fail("explore binds the numpad's digits");
    }
    const p = fresh({ view: "map" });
    const at = runEast(game.zone, 2);
    place(p, at, 0);
    turns.refreshView(game);
    inputHandlers.onKeyDown("Numpad6", false, "6");
    if (tile(p)[0] !== at.x + 1) fail("numpad 6 no longer steps east on the map");
    game.messages = [];
    const t0 = game.time;
    inputHandlers.onKeyDown("Digit2", false, "2");
    if (!said(/Nothing is on 2/) || game.time !== t0) fail("an empty hotbar slot didn't say so (or took time)");
  }

  // --- 3. Both views through the real input -------------------------------------------------------------------
  {
    // 3D: an open run of floor east; Digit1 lands 4 tiles along the aim.
    let p = fresh({ view: "3d" });
    let at = runEast(game.zone, 6);
    if (!at) fail("no open run of 6 tiles on legacy level 3");
    else {
      place(p, at, 0);
      const t0 = game.time;
      inputHandlers.onKeyDown("Digit1", false, "1");
      const [x, y] = tile(p);
      if (x !== at.x + 4 || y !== at.y || p.z !== at.z) fail(`3D: Fold Step east from (${at.x}, ${at.y}) landed at (${x}, ${y}, ${p.z}), want (${at.x + 4}, ${at.y}, ${at.z})`);
      if (game.time !== t0) fail("3D: the use itself passed game time");
      if (A.cooldownLeft(p, "foldStep") !== 12) fail(`3D: cooldown ${A.cooldownLeft(p, "foldStep")} after the use`);
      const before = [p.x, p.y];
      game.messages = [];
      inputHandlers.onKeyDown("Digit1", false, "1");
      if (p.x !== before[0] || p.y !== before[1] || !said(/isn't ready yet \(12 s\)/)) fail("3D: a second press while cooling down moved you or wasn't refused");
      stats.view3d = `(${at.x}, ${at.y}) → (${x}, ${y})`;
    }
    // The map: a rat in sight 6 tiles east; you land a tile short of it, at most 4 on, in 0.5 s.
    p = fresh({ view: "map" });
    at = runEast(game.zone, 7);
    if (at) {
      place(p, at, Math.PI);   // facing west: the target, not the facing, decides
      const rat = creatures.addCreature(game.zone, creatures.spawnCreature("rat", at.x + 6, at.y, at.z, { rng: () => 0.5, state: "idle" }));
      turns.refreshView(game);
      if (game.zone.sightings.get(rat.id)?.time !== game.time) fail("the map: the rat 6 tiles off isn't in sight (test setup)");
      const t0 = game.time;
      inputHandlers.onKeyDown("Digit1", false, "1");
      const [x, y] = tile(p);
      if (x !== at.x + 4 || y !== at.y) fail(`map: Fold Step toward the rat at (${at.x + 6}, ${at.y}) landed at (${x}, ${y}), want (${at.x + 4}, ${at.y})`);
      if (Math.abs(game.time - t0 - 0.5) > 1e-9) fail(`map: the use took ${game.time - t0} s, want 0.5 (a throw's)`);
      if (Math.abs(A.cooldownLeft(p, "foldStep") - 11.5) > 1e-9) fail(`map: cooldown ${A.cooldownLeft(p, "foldStep")} after the use's 0.5 s`);
      stats.viewMap = `(${at.x}, ${at.y}) → (${x}, ${y}), rat at (${at.x + 6}, ${at.y})`;
      // Nothing in sight: the way you face.
      p = fresh({ view: "map" });
      place(p, at, 0);
      turns.refreshView(game);
      inputHandlers.onKeyDown("Digit1", false, "1");
      if (tile(p)[0] !== at.x + 4) fail(`map: with nothing in sight Fold Step went to (${tile(p)}) instead of 4 east`);
    } else fail("no open run of 7 tiles on legacy level 3");
  }

  // --- 4. Cooldown parity, skipTime, the HUD ----------------------------------------------------------------------
  {
    const recover = { };
    // 3D frames.
    let p = fresh({ view: "3d" });
    let at = runEast(game.zone, 6);
    place(p, at, 0);
    let t0 = game.time;
    A.useHotbar(game, 0);
    while (A.cooldownLeft(p, "foldStep") > 0 && game.time - t0 < 30) game.debug.step(1 / 60);
    recover["3d"] = game.time - t0;
    // Map waits.
    p = fresh({ view: "map" });
    place(p, at, 0);
    t0 = game.time;
    A.useHotbar(game, 0);
    while (A.cooldownLeft(p, "foldStep") > 0 && game.time - t0 < 30) { turns.mapWait(game); game.debug.step(1 / 60); }
    recover.map = game.time - t0;
    if (Math.abs(recover["3d"] - 12) > 1 / 60 + 1e-9) fail(`3D: ready again after ${recover["3d"]} s of game time, want 12`);
    if (Math.abs(recover.map - 12) > 1e-9) fail(`map: ready again after ${recover.map} s of game time, want 12`);
    stats.recovery = Object.fromEntries(Object.entries(recover).map(([k, v]) => [k, +v.toFixed(4)]));
    // skipTime.
    p = fresh({ view: "map" });
    place(p, at, 0);
    A.useHotbar(game, 0);
    status.removeStatus(game, p, "x");
    const left0 = A.cooldownLeft(p, "foldStep");
    time.skipTime(game, 5, { interruptible: false });
    if (Math.abs(A.cooldownLeft(p, "foldStep") - (left0 - 5)) > 1e-9) fail(`skipTime(5): ${A.cooldownLeft(p, "foldStep")} s left, want ${left0 - 5}`);
    time.skipTime(game, left0 - 5, { interruptible: false });
    if (A.cooldownLeft(p, "foldStep") !== 0) fail(`skipTime to the end: ${A.cooldownLeft(p, "foldStep")} s left`);
    // The HUD.
    resize(100, 30);
    p = fresh({ view: "map" });
    for (const id of ["hasted", "poisoned"]) status.addStatus(game, p, id, { t: 30 });
    if (hud.layoutHud(game).rows.flat().some((q) => q.id === "abilities")) fail("the HUD shows the hotbar while nothing cools down");
    A.startCooldown(p, "foldStep", 12);
    for (const view of ["map", "3d"]) {
      game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = true;
      const L = hud.layoutHud(game);
      const q = L.rows.flat().find((x) => x.id === "abilities");
      S.clear(); game.debug.draw();
      const y0 = view === "map" ? 1 : 0;
      if (L.rows.length !== 1 || !q || q.text !== "1 Fold Step 12s" || !rowText(y0).includes(q.text) || q.x + q.text.length > 99) fail(`100×30 ${view}: ${L.rows.length} rows, the cooldown ${JSON.stringify(q)} (row: "${rowText(y0).trim()}")`);
    }
    resize(180, 56);
  }

  // --- 5. Targets -------------------------------------------------------------------------------------------------
  {
    const p = fresh({ view: "map" });
    const at = runEast(game.zone, 9);
    place(p, at, 0);
    const z = at.z, add = (dx, type = "rat") => creatures.addCreature(game.zone, creatures.spawnCreature(type, at.x + dx, at.y, z, { rng: () => 0.5, state: "idle" }));
    const far = add(12), near = add(5), nearer = add(3);
    turns.refreshView(game);
    let got;
    A.requestTarget(game, A.ABILITIES.foldStep, (t) => { got = t; });
    if (got?.creature !== nearer) fail(`requestTarget picked ${got?.creature?.name ?? "nothing"} at ${got?.creature ? tile(got.creature) : "-"}, not the nearest rat`);
    game.zone.sightings.delete(nearer.id);
    A.requestTarget(game, A.ABILITIES.foldStep, (t) => { got = t; });
    if (got?.creature !== near) fail("requestTarget took a rat not seen this moment");
    game.zone.creatures = game.zone.creatures.filter((c) => c !== near && c !== nearer);
    turns.refreshView(game);
    A.requestTarget(game, A.ABILITIES.foldStep, (t) => { got = t; });
    if (got !== null) fail(`requestTarget took a rat ${12} tiles off (beyond ${A.REQUEST_RANGE})`);
    void far;
    // aimTarget in 3D.
    game.view = "3d"; game.mode = "explore";
    const r1 = add(3);
    place(p, at, 0);
    const down = Math.atan2(r1.z + r1.h * 0.6 - (p.z + 1.45), r1.x - p.x);   // the crosshair on the rat
    p.pitch = down;
    let aim = A.aimTarget(game, 6);
    if (aim.creature !== r1) fail("aimTarget: the rat straight ahead isn't picked");
    p.yaw = 0.2;   // about 11° off
    aim = A.aimTarget(game, 6);
    if (aim.creature) fail("aimTarget picked a rat outside the 6° cone");
    p.yaw = 0; p.pitch = 0;   // level: the rat is 25° below the crosshair
    aim = A.aimTarget(game, 6);
    if (aim.creature) fail("aimTarget picked a rat far below a level crosshair");
    p.yaw = 0; p.pitch = -0.4;
    aim = A.aimTarget(game, 6);
    if (Math.abs(aim.dir[2] - Math.sin(-0.4)) > 1e-9) fail(`aimTarget's dir ignores the pitch: ${aim.dir}`);
    if (!(aim.point.z < p.z + 1.45)) fail("aimTarget's point doesn't follow a downward aim");
    // requestTarget in 3D: the crosshair's creature (aimTarget), not the nearest one in sight.
    const r2 = add(6);
    place(p, at, 0);
    p.pitch = Math.atan2(r2.z + r2.h * 0.6 - (p.z + 1.45), r2.x - p.x);   // on the farther rat (r1, 3 tiles on, is below the cone)
    turns.refreshView(game);
    got = undefined;
    A.requestTarget(game, { ...A.ABILITIES.foldStep, range: 8 }, (t) => { got = t; });
    if (got?.creature !== r2 || JSON.stringify(got.dir) !== JSON.stringify(A.aimTarget(game, 8).dir))
      fail(`requestTarget in 3D: ${got?.creature ? `the rat at ${tile(got.creature)}` : "nothing"}, not the one in the crosshair at ${tile(r2)}`);
  }

  // --- 6. Landing is always standable -------------------------------------------------------------------------------
  {
    let uses = 0, moved = 0, noRoom = 0, worst = 0;
    const tally = {};
    const lcg = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const zonesToTry = [];
    for (const seed of [7, 31, 1234]) {
      for (const depth of [1, 3, 6, 10, 15, 20]) zonesToTry.push({ seed, depth });
      zonesToTry.push({ seed, depth: 0 });
    }
    for (const { seed, depth } of zonesToTry)
      for (const view of ["map", "3d"]) {
        const p = fresh({ seed, view, depth });
        const zone = game.zone, { w, d, stand } = zone, rand = lcg(seed * 977 + depth * 31 + (view === "map" ? 1 : 2));
        const cells = [];
        for (let i = 0; i < w * d; i++) {
          const g = zone.get(i % w, (i - (i % w)) / w, world.FLOOR_Z - 1);
          if (stand[i] >= 0 && g !== world.B.STAIRS && g !== world.B.STAIRS_UP) cells.push(i);
        }
        // A few rats about, so creatures' tiles are in play.
        for (let k = 0; k < 8; k++) { const i = cells[Math.floor(rand() * cells.length)]; creatures.addCreature(zone, creatures.spawnCreature("rat", i % w, (i - (i % w)) / w, stand[i], { rng: rand, state: "idle" })); }
        for (let n = 0; n < 40; n++) {
          const i = cells[Math.floor(rand() * cells.length)], sx = i % w, sy = (i - sx) / w;
          if (creatures.creatureAt(zone, sx, sy)) continue;
          place(p, { x: sx, y: sy, z: stand[i] }, rand() * Math.PI * 2);
          p.pitch = view === "3d" ? (rand() - 0.6) * 1.2 : 0;
          A.startCooldown(p, "foldStep", 0); delete p.cooldowns.foldStep;
          if (view === "map") turns.refreshView(game);
          const reach = pathing.reachable(world.standWith(zone, "open"), w, d, sx, sy, pathing.PLAYER_STEP_UP, pathing.PLAYER_DROP);
          const ok = A.useAbility(game, p, "foldStep");
          uses++;
          const [x, y] = tile(p), j = x + y * w;
          if (!ok) { noRoom++; if (x !== sx || y !== sy) fail(`seed ${seed} ${zone.key} ${view}: refused but moved`); continue; }
          if (x === sx && y === sy) fail(`seed ${seed} ${zone.key} ${view}: used but didn't move`);
          moved++;
          const g = zone.get(x, y, world.FLOOR_Z - 1), dist = Math.hypot(x - sx, y - sy);
          worst = Math.max(worst, dist);
          const bad = stand[j] < 0 ? "no ground" : stand[j] !== p.z ? `z ${p.z} on stand ${stand[j]}` : g === world.B.STAIRS || g === world.B.STAIRS_UP ? "stairs"
            : creatures.creatureAt(zone, x, y) ? "a creature's tile" : reach[j] < 0 ? "not reachable on foot" : dist > 2 * A.ABILITIES.foldStep.range + 1 ? `${dist.toFixed(1)} tiles away` : null;
          if (bad) { fail(`seed ${seed} ${zone.key} ${view}: (${sx}, ${sy}) → (${x}, ${y}): ${bad}`); tally[bad] = (tally[bad] || 0) + 1; }
        }
      }
    stats.landings = { uses, moved, noRoom, farthest: +worst.toFixed(2), zones: zonesToTry.length, bad: tally };
    // Walled in on one tile: no room, and it costs nothing (no cooldown, no time).
    for (const view of ["map", "3d"]) {
      const p = fresh({ view }), zone = game.zone, at = runEast(zone, 3);
      place(p, at, 0);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if (dx || dy) for (let dz = 0; dz < 4; dz++) zone.set(at.x + dx, at.y + dy, at.z + dz, world.B.ROCK);
      zone.refresh();
      game.messages = [];
      const t0 = game.time;
      const ok = A.useAbility(game, p, "foldStep");
      if (ok || tile(p).join() !== `${at.x},${at.y}` || A.cooldownLeft(p, "foldStep") > 0 || game.time !== t0 || !said(/no room/)) fail(`${view}: walled in, Fold Step ${ok ? "worked" : "was refused"}, at (${tile(p)}), cooldown ${A.cooldownLeft(p, "foldStep")}, time +${game.time - t0}`);
    }
    if (moved < uses * 0.5) fail(`only ${moved} of ${uses} uses moved you`);
  }

  return { name: "abilities", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-abilities.mjs gives.
export async function run(env) {
  const { S, capture, resize } = await env.screen({ cols: 180, rows: 56 });
  const m = (p) => env.src(p);
  const { game, startRun, inputHandlers } = await m("game.js");
  return checkAbilities({ game, startRun, inputHandlers, abilities: await m("abilities.js"), keys: await m("keys.js"), hud: await m("hud.js"),
    time: await m("time.js"), turns: await m("turns.js"), status: await m("status.js"), creatures: await m("creatures.js"),
    zones: await m("zones.js"), world: await m("world.js"), pathing: await m("pathing.js"), S, capture, resize });
}
