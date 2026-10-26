// The clock (0D2; TECH_DESIGN §1.4 clock.js, R10; DECISIONS §1; bible §4.6).
//
//   checkClock({ game, startRun, attachState, clock, events, time, turns, rules }) → { name, ok, problems, stats }
//
//   1. The view: state.time is the clock (it reads and writes game.time, a plain field; a new run starts it
//      at 0, day 1, 06:00; JSON saves it and attachState puts a saved state back without firing anything); one world hour is 60 s of game time; every hour of two days has the right phase (dawn 05-06,
//      day 06-18, dusk 18-19, night 19-05), the noon window is 11-13; timeOfDay, dayNumber, clockLabel.
//   2. nightSeconds: a day holds 10 night hours; intervals across dusk, dawn and midnight; any split of
//      an interval adds up to the whole (exact, so the torch's drain is the same however time is cut).
//   3. Events, exactly once each: 30 world hours by skipTime fire 30 "clock:hour" and the dawn / noon /
//      dusk / midnight among them, in order, with the right payloads; the same 30 hours stepped in
//      uneven slices through the registered per-frame update give the same list; nothing fires twice when
//      frames follow a skip, and nothing when time goes back (a new run). In both views through the real
//      code: 3D frames (game.debug.step) across 18:00 fire hour and dusk once; map waits (Space) across
//      11:00 fire hour and noon once; leaving a zone catches the clock up before zone:leave's other handlers.
//   4. secondsUntil: from 06:00 to the next hour, dawn, noon, dusk and midnight; skipTime by it lands on
//      the minute and fires that event.
//   5. The looks stay at noon until WS3: daylight 1, the sun, the noon sky, no fog, one light bucket.
export function checkClock({ game, startRun, attachState, clock, events, time, turns, rules }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const HOUR = 60 * rules.RULES.clock.secondsPerMinute;
  const log = [];
  const names = ["clock:hour", "clock:dawn", "clock:noon", "clock:dusk", "clock:midnight"];
  const offs = names.map((t) => events.on(t, (g, p) => log.push(`${t.slice(6)} ${p.day}/${p.hour}@${p.minutes}`)));
  const fresh = (seed = 7, view = "map") => {
    startRun(seed);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);   // nothing to interrupt a wait
    log.length = 0;
  };

  // --- 1. The view ------------------------------------------------------------------------------------
  {
    fresh();
    if (game.state.time !== 0 || game.time !== 0 || game.clockSeen !== 0) fail(`a new run: state.time ${game.state.time}, game.time ${game.time}, clockSeen ${game.clockSeen}`);
    game.time = 123.5;
    if (game.state.time !== 123.5) fail("setting game.time didn't set state.time");
    game.state.time = 7;
    if (game.time !== 7) fail("game.time doesn't read state.time");
    game.time = 0;
    // game.time stays a plain field (an accessor there slowed every access 10-100×); state.time is its view,
    // saved by JSON, and a loaded state put back with attachState brings the clock back without firing.
    const desc = Object.getOwnPropertyDescriptor(game, "time");
    if (!desc || !("value" in desc)) fail("game.time isn't a plain data property");
    game.time = 3 * HOUR + 5;
    const saved = JSON.parse(JSON.stringify(game.state));
    if (saved.time !== 3 * HOUR + 5) fail(`JSON.stringify(state) saved time ${saved.time}`);
    game.time = 0;
    const before = log.length;
    attachState(game, saved);
    events.runUpdates(game, 0);
    if (game.time !== 3 * HOUR + 5 || game.state !== saved || game.clockSeen !== game.time || log.length !== before) fail(`attachState of a saved state: time ${game.time}, clockSeen ${game.clockSeen}, ${log.length - before} events fired`);
    game.time = 0; game.clockSeen = 0;
    if (HOUR !== 60) fail(`a world hour is ${HOUR} s of game time, DECISIONS says 60`);
    if (clock.clockLabel(game) !== "day 1, 06:00" || clock.minutes(game) !== 360) fail(`the run starts at ${clock.clockLabel(game)} (${clock.minutes(game)} min)`);
    const want = (h) => (h >= 19 || h < 5 ? "night" : h < 6 ? "dawn" : h < 18 ? "day" : "dusk");
    let hours = 0;
    for (let k = 0; k < 48; k++) {   // two days from 06:00, at each hour and half past
      for (const half of [0, 0.5]) {
        game.time = (k + half) * HOUR;
        const h = (6 + k) % 24, day = 1 + Math.floor((6 + k) / 24);
        if (clock.hourOf(game) !== h || clock.dayNumber(game) !== day) fail(`${k + half} h after the start: hour ${clock.hourOf(game)} day ${clock.dayNumber(game)}, want ${h} day ${day}`);
        if (clock.phase(game) !== want(h)) fail(`${h}:${half ? "30" : "00"}: phase ${clock.phase(game)}, want ${want(h)}`);
        if (clock.isNight(game) !== (want(h) === "night")) fail(`${h}:00: isNight ${clock.isNight(game)}`);
        if (clock.inNoonWindow(game) !== (h >= 11 && h < 13)) fail(`${h}:00: noon window ${clock.inNoonWindow(game)}`);
        const tod = clock.timeOfDay(game);
        if (Math.abs(tod - (h + half) / 24) > 1e-9) fail(`${h}:00: timeOfDay ${tod}`);
        hours++;
      }
    }
    game.time = 30 * HOUR + 15;
    if (clock.clockLabel(game) !== "day 2, 12:15") fail(`30 h 15 min in: ${clock.clockLabel(game)}`);
    stats.hours = hours;
  }

  // --- 2. nightSeconds ----------------------------------------------------------------------------------
  {
    const at = (h) => (h - 6) * HOUR;   // game time of an hour of day 1 (or later, past 24)
    const cases = [[at(6), at(30), 10 * HOUR], [at(18), at(20), 1 * HOUR], [at(4), at(7), 1 * HOUR], [at(23), at(25), 2 * HOUR],
                   [at(12), at(13), 0], [at(6), at(6 + 24 * 5), 50 * HOUR], [at(19), at(29), 10 * HOUR], [at(5), at(19), 0]];
    for (const [a, b, w] of cases) {
      const got = clock.nightSeconds(a, b);
      if (Math.abs(got - w) > 1e-6) fail(`nightSeconds over ${a / HOUR + 6}-${b / HOUR + 6} h: ${got} s, want ${w}`);
    }
    let worst = 0;
    let s = 12345;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let n = 0; n < 200; n++) {
      const a = rand() * 100 * HOUR, b = a + rand() * 40 * HOUR;
      let sum = 0, t = a;
      while (t < b) { const dt = Math.min(b - t, rand() * 3 * HOUR); sum += clock.nightSeconds(t, t + dt); t += dt; }
      worst = Math.max(worst, Math.abs(sum - clock.nightSeconds(a, b)));
    }
    if (worst > 1e-6) fail(`nightSeconds split into pieces is off by ${worst} s`);
    stats.nightSplitWorst = worst;
  }

  // --- 3. Events ----------------------------------------------------------------------------------------
  {
    fresh();
    const r = time.skipTime(game, 30 * HOUR, { interruptible: false });
    const bulk = [...log];
    const hoursFired = bulk.filter((x) => x.startsWith("hour")).length;
    if (r.elapsed !== 30 * HOUR) fail(`skipTime(30 h) elapsed ${r.elapsed}`);
    if (hoursFired !== 30) fail(`30 world hours by skipTime fired ${hoursFired} hour events`);
    const named = bulk.filter((x) => !x.startsWith("hour")).map((x) => x.split(" ")[0]).join(",");
    if (named !== "noon,dusk,midnight,dawn,noon") fail(`30 h from 06:00 fired ${named}, want noon,dusk,midnight,dawn,noon`);
    if (bulk[0] !== "hour 1/7@420" || bulk.at(-1) !== "hour 2/12@2160") fail(`first and last: ${bulk[0]} … ${bulk.at(-1)}`);
    const midnight = bulk.find((x) => x.startsWith("midnight"));
    if (midnight !== "midnight 2/0@1440") fail(`midnight: ${midnight}`);
    for (let k = 1; k < bulk.length; k++) if (+bulk[k].split("@")[1] < +bulk[k - 1].split("@")[1]) fail(`out of order: ${bulk[k - 1]} then ${bulk[k]}`);
    // Frames after a skip fire nothing again.
    for (let k = 0; k < 5; k++) game.debug.step(1 / 60);
    if (log.length !== bulk.length) fail(`frames after a skip fired ${log.length - bulk.length} more events`);
    // The same 30 hours in uneven slices, through the registered update (every mode).
    fresh();
    let t = 0, k = 0;
    while (t < 30 * HOUR - 1e-9) {
      const dt = Math.min(30 * HOUR - t, [0.017, 3.3, 59.9, 0.5, 121][k++ % 5]);
      t += dt; game.time = t;
      game.mode = ["map", "inventory", "explore", "pause"][k % 4];   // the update runs in every mode
      events.runUpdates(game, 0);
    }
    game.mode = "map";
    if (log.join() !== bulk.join()) fail(`stepped in slices: ${log.length} events, by skipTime ${bulk.length}; first difference at ${log.findIndex((x, i) => x !== bulk[i])}`);
    stats.events30h = bulk.length;
    // Time going back (a new run after a long one) fires nothing.
    const before = log.length;
    startRun(8);
    game.pages = null; game.mode = "map"; game.view = "map"; game.modeStack = [];
    events.runUpdates(game, 0);
    game.debug.step(1 / 60);
    if (log.length !== before) fail(`a new run after 30 h fired ${log.length - before} events`);

    // 3D: real frames across 18:00 (12 h after the start).
    fresh(7, "3d");
    game.time = 12 * HOUR - 1;   // 17:59
    events.runUpdates(game, 0);
    log.length = 0;
    for (let f = 0; f < 120; f++) game.debug.step(1 / 60);
    if (log.join() !== "hour 1/18@1080,dusk 1/18@1080") fail(`3D frames across 18:00 fired ${log.join() || "nothing"}`);
    // The map: waits (Space) across 11:00 (5 h after the start).
    fresh(7, "map");
    game.time = 5 * HOUR - 1.2;
    events.runUpdates(game, 0);
    log.length = 0;
    for (let w = 0; w < 6; w++) { turns.mapWait(game); game.debug.step(1 / 60); }
    if (log.join() !== "hour 1/11@660,noon 1/11@660") fail(`map waits across 11:00 fired ${log.join() || "nothing"}`);
    // Leaving a zone: the clock is caught up before the other zone:leave handlers run.
    fresh();
    game.time = HOUR + 0.5;
    let caught = null;
    const off = events.on("zone:leave", (g) => { caught = g.clockSeen; });
    game.debug.enterZone(`${game.run.world.start.wx},${game.run.world.start.wy},1`, "down");
    off();
    if (caught !== HOUR + 0.5) fail(`on zone:leave the clock had got to ${caught}, not ${HOUR + 0.5}`);
  }

  // --- 4. secondsUntil -------------------------------------------------------------------------------------
  {
    fresh();
    const want = { hour: 1, dawn: 23, noon: 5, dusk: 12, midnight: 18 };
    for (const [what, h] of Object.entries(want)) {
      const s = clock.secondsUntil(game, what);
      if (Math.abs(s - h * HOUR) > 1e-9) fail(`secondsUntil ${what} from 06:00: ${s} s, want ${h * HOUR}`);
    }
    for (const what of ["dusk", "midnight", "dawn", "noon"]) {
      log.length = 0;
      time.skipTime(game, clock.secondsUntil(game, what), { interruptible: false });
      const at = { dusk: "18:00", midnight: "00:00", dawn: "05:00", noon: "11:00" }[what];
      if (!clock.clockLabel(game).endsWith(at) || !log.some((x) => x.startsWith(what))) fail(`skipTime until ${what}: ${clock.clockLabel(game)}, events ${log.filter((x) => !x.startsWith("hour")).join() || "none"}`);
    }
    stats.until = clock.clockLabel(game);
  }

  // --- 5. The looks (noon until WS3) ----------------------------------------------------------------------
  {
    fresh();
    for (const h of [0, 6, 12, 18]) {
      game.time = h * HOUR;
      if (clock.daylight(game) !== 1 || clock.lightBucket(game) !== 0 || clock.fogFor(game, game.zone).density !== 0) fail(`the looks at +${h} h aren't noon's`);
      const s = clock.sunDir(game), sky = clock.skyColors(game);
      if (Math.abs(Math.hypot(...s) - 1) > 1e-9 || s[2] < 0.8 || sky.zenith.join() !== "50,95,190" || sky.horizon.join() !== "170,200,240") fail(`the sun ${s} or the sky ${JSON.stringify(sky)} isn't render3d's noon`);
    }
  }

  for (const off of offs) off();
  return { name: "clock", ok: problems.length === 0, problems, stats };
}
