// The torch's glim (0D2; DECISIONS §1 "Currency", bible §3.2; torch.js over clock.js and currency.js).
//
//   checkTorch({ game, startRun, torch, clock, time, turns, player, light, hud, currency, compileWorld, REAL_WORLD, torchSrc })
//     → { name, ok, problems, stats }
//
//   1. 1 glim per 4 world hours (240 s of game time) lit in darkness. darkSeconds: a dungeon level is
//      dark all the time; a surface span costs nothing by day, its night hours (19-05) only; the real
//      world's Shade is dark by day too (its terrain is `dark`); the test world has no such terrain.
//   2. The same in both views, and exact across skipTime: underground with 10 glim, 2.2 × 240 s by 3D
//      frames (game.debug.step), by map waits (Space) and by one skipTime pay the same 2 glim and leave
//      the same burn (±1e-6 s); the torch out burns nothing.
//   3. A day and a night on the surface: 06:00 to 18:00 costs nothing; on to 06:00 the next day costs 2
//      (10 night hours), the same by skipTime as in uneven slices through the clock; dusk and dawn are free.
//   4. An empty purse: the torch gutters (once told), to a flicker 1 tile across whose strength jumps about
//      but never reaches 0, and stays lit for every light rule (inDark false, the map's ring around you still
//      seen); the HUD says so; a skip that runs the purse dry mid-way ends as fine stepping does. The next
//      glim relights it the moment it burns in the dark (told once), back to the full torch.
//   5. The old game is untouched: a new player's torch is the parent's (range 6, power 2.2) and nothing is
//      owed; only torch.js burns glim, through currency.pay.
export function checkTorch({ game, startRun, torch, clock, time, turns, player, light, hud, currency, compileWorld, REAL_WORLD, torchSrc }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const PER = torch.glimSeconds(), HOUR = PER / 4;
  const fresh = ({ view = "map", depth = 3, funds = 10 } = {}) => {
    startRun(7);
    game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = [];
    const s = game.run.world.start;
    if (depth) game.debug.enterZone(`${s.wx},${s.wy},${depth}`, "down");
    game.view = view; game.mode = view === "map" ? "map" : "explore"; game.paused = false;
    game.zone.creatures = game.zone.creatures.filter((c) => c.talk);   // nothing to fight or interrupt
    game.zone.items = [];                                                 // nor any glim to pick up
    game.zone.spikes = [];
    const p = game.player;
    p.funds = funds; p.maxHpGain = 999; p.hp = 999;
    game.messages = [];
    return p;
  };
  const told = (re) => game.messages.filter((m) => re.test(m.text)).length;

  // --- 1. Darkness --------------------------------------------------------------------------------------
  {
    if (PER !== 240) fail(`a glim burns ${PER} s, DECISIONS says 4 world hours (240 s)`);
    fresh();
    const under = game.zone;
    if (!near(torch.darkSeconds(game, under, 0, 1000), 1000)) fail("a dungeon level isn't dark all the time");
    fresh({ depth: 0 });
    const surf = game.zone, at = (h) => (h - 6) * HOUR;
    const cases = [[at(6), at(18), 0], [at(18), at(19), 0], [at(19), at(29), 10 * HOUR], [at(5), at(6), 0], [at(6), at(30), 10 * HOUR], [at(23), at(26), 3 * HOUR]];
    for (const [a, b, w] of cases) if (!near(torch.darkSeconds(game, surf, a, b), w)) fail(`surface ${a / HOUR + 6}-${b / HOUR + 6} h: ${torch.darkSeconds(game, surf, a, b)} s dark, want ${w}`);
    // The Shade (the real world).
    const world = compileWorld(REAL_WORLD);
    let shade = null, plain = null;
    for (const t of world.tiles) {
      if (!shade && t.terrain === "shade") shade = t;
      if (!plain && t.terrain !== "shade" && !world.terrains[t.terrain]?.dark) plain = t;
    }
    if (!shade) fail("the real world has no Shade span");
    else {
      const g = { run: { world } }, z = (t) => ({ hasSky: true, type: "surface", wx: t.wx, wy: t.wy });
      if (!near(torch.darkSeconds(g, z(shade), at(10), at(12)), 2 * HOUR)) fail(`the Shade at (${shade.wx}, ${shade.wy}) isn't dark at noon`);
      if (!near(torch.darkSeconds(g, z(plain), at(10), at(12)), 0)) fail(`${plain.terrain} at (${plain.wx}, ${plain.wy}) is dark at noon`);
      stats.shade = `(${shade.wx}, ${shade.wy})`;
    }
    const darkTerrains = Object.keys(world.terrains).filter((k) => world.terrains[k].dark);
    if (darkTerrains.join() !== "shade") fail(`dark terrains: ${darkTerrains.join() || "none"}, want shade`);
    if (Object.values(game.run.world.terrains).some((T) => T.dark)) fail("the test world has a dark terrain");
  }

  // --- 2. Both views and skipTime, underground ------------------------------------------------------------------
  {
    const span = 2.2 * PER, out = {};
    // 3D: real frames (the explore update passes time, the clock's per-frame update burns).
    let p = fresh({ view: "3d" });
    for (let t = 0; t < span - 1e-9; t += 1 / 30) game.debug.step(Math.min(1 / 30, span - t));
    out["3d"] = { funds: p.funds, burn: p.torchBurn, t: game.time };
    // The map: waits (Space), 0.5 s each.
    p = fresh({ view: "map" });
    while (game.time < span - 1e-9) { turns.mapWait(game); game.debug.step(1 / 60); }
    out.map = { funds: p.funds, burn: p.torchBurn - (game.time - span), t: game.time };
    // One skip.
    p = fresh();
    time.skipTime(game, span, { interruptible: false });
    out.skip = { funds: p.funds, burn: p.torchBurn, t: game.time };
    for (const [k, r] of Object.entries(out)) {
      if (r.funds !== 8) fail(`${k}: ${span} s lit underground paid ${10 - r.funds} glim, want 2`);
      if (!near(r.burn, span - 2 * PER, 1e-6)) fail(`${k}: burn ${r.burn} after ${r.t} s, want ${span - 2 * PER}`);
    }
    stats.underground = Object.fromEntries(Object.entries(out).map(([k, r]) => [k, `paid ${10 - r.funds}, burn ${r.burn.toFixed(6)}`]));
    // The torch out burns nothing.
    p = fresh(); p.torch = false;
    time.skipTime(game, 3 * PER, { interruptible: false });
    if (p.funds !== 10 || (p.torchBurn || 0) !== 0) fail(`the torch out: paid ${10 - p.funds}, burn ${p.torchBurn}`);
  }

  // --- 3. A day and a night on the surface --------------------------------------------------------------------
  {
    let p = fresh({ depth: 0 });
    time.skipTime(game, 12 * HOUR, { interruptible: false });
    if (p.funds !== 10 || (p.torchBurn || 0) !== 0) fail(`06:00-18:00 on the surface paid ${10 - p.funds} (burn ${p.torchBurn})`);
    time.skipTime(game, 12 * HOUR, { interruptible: false });
    const bulk = { funds: p.funds, burn: p.torchBurn };
    if (bulk.funds !== 8 || !near(bulk.burn, 10 * HOUR - 2 * PER)) fail(`18:00-06:00 paid ${10 - bulk.funds} glim, burn ${bulk.burn}; want 2 and ${10 * HOUR - 2 * PER}`);
    p = fresh({ depth: 0 });
    for (let t = 0, k = 0; t < 24 * HOUR - 1e-9; k++) { t = Math.min(24 * HOUR, t + [0.7, 13, 41.3, 3.01][k % 4]); game.time = t; clock.catchUp(game); }
    if (p.funds !== bulk.funds || !near(p.torchBurn, bulk.burn)) fail(`a day in slices: funds ${p.funds}, burn ${p.torchBurn}; by skipTime ${bulk.funds}, ${bulk.burn}`);
    stats.surfaceDay = `paid ${10 - bulk.funds}, burn ${bulk.burn}`;
  }

  // --- 4. An empty purse --------------------------------------------------------------------------------------
  {
    const p = fresh({ funds: 1 });
    time.skipTime(game, 1.5 * PER, { interruptible: false });
    if (p.funds !== 0 || torch.torchGutters(p)) fail(`1 glim, 1.5 × 240 s: funds ${p.funds}, guttering ${torch.torchGutters(p)}`);
    time.skipTime(game, PER, { interruptible: false });
    if (!torch.torchGutters(p) || !near(p.torchBurn, PER)) fail(`the purse ran dry but the torch doesn't gutter (burn ${p.torchBurn})`);
    if (told(/gutters/) !== 1) fail(`guttering told ${told(/gutters/)} times`);
    time.skipTime(game, 3 * PER, { interruptible: false });
    if (told(/gutters/) !== 1 || !near(p.torchBurn, PER)) fail(`more time guttering: told ${told(/gutters/)} times, burn ${p.torchBurn} (the flicker is free)`);
    if (player.torchRange(p) !== 1) fail(`a guttering torch reaches ${player.torchRange(p)} tiles, want 1`);
    const powers = Array.from({ length: 40 }, (_, k) => player.torchPower(p, k * 0.05));
    if (Math.min(...powers) <= 0 || new Set(powers.map((x) => x.toFixed(4))).size < 4 || Math.max(...powers) > 0.5) fail(`the flicker's strength: ${Math.min(...powers)}..${Math.max(...powers)}`);
    if (!p.torch || light.inDark(game, game.zone, p.x, p.y, p.z + 1)) fail("a guttering torch doesn't count as lit");
    game.zone.seen.fill(0);
    turns.refreshView(game);
    const tx = Math.floor(p.x), ty = Math.floor(p.y), w = game.zone.w;
    let ring = 0;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) ring += game.zone.seen[x + y * w];
    if (ring !== 9) fail(`the map's ring around you while guttering: ${ring} of 9 tiles seen`);
    const seg = hud.segmentDef("torch").parts(game, p);
    if (seg.text !== "torch gutters") fail(`the HUD's torch segment says "${seg.text}"`);
    // Glim again: relit the moment it burns in the dark.
    currency.receive(game, p, 5);
    turns.mapWait(game); game.debug.step(1 / 60);   // (on the map time passes only when you act)
    if (torch.torchGutters(p) || p.funds !== 4 || told(/flares up/) !== 1) fail(`with 5 glim again: guttering ${torch.torchGutters(p)}, funds ${p.funds}, told ${told(/flares up/)}`);
    if (player.torchRange(p) !== 6 || hud.segmentDef("torch").parts(game, p).text !== "torch on") fail(`relit: range ${player.torchRange(p)}`);
    // A skip that runs the purse dry mid-way equals fine stepping.
    const a = fresh({ funds: 2 });
    time.skipTime(game, 4 * PER + 30, { interruptible: false });
    const bulk = { funds: a.funds, burn: a.torchBurn, g: torch.torchGutters(a), told: told(/gutters/) };
    const b = fresh({ funds: 2 });
    while (game.time < 4 * PER + 30 - 1e-9) { turns.mapWait(game); game.debug.step(1 / 60); }
    const fine = { funds: b.funds, burn: b.torchBurn, g: torch.torchGutters(b), told: told(/gutters/) };
    if (JSON.stringify(bulk) !== JSON.stringify(fine)) fail(`running dry: skip ${JSON.stringify(bulk)}, waits ${JSON.stringify(fine)}`);
    stats.runDry = bulk;
  }

  // --- 5. The old game ----------------------------------------------------------------------------------------
  {
    startRun(7);
    const p = game.player;
    if (player.torchRange(p) !== 6 || player.torchPower(p) !== 2.2 || torch.torchGutters(p) || p.torchBurn) fail(`a new player's torch: range ${player.torchRange(p)}, power ${player.torchPower(p)}, burn ${p.torchBurn}`);
    if (!/pay\(game, e, 1\)/.test(torchSrc)) fail("torch.js doesn't pay through currency.pay");
  }
  return { name: "torch", ok: problems.length === 0, problems, stats };
}
