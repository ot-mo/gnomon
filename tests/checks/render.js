// Rendering outdoors (WS3; TECH_DESIGN §6, §8.3 "WS3" acceptance). Node runs it through tools/check-perf.mjs
// (WS3's runner, with the frame and bake budgets), the browser through test-world.html.
//
//   checkRender(m) → { name, ok, problems, stats }      m: the modules and the screen (run(env) below)
//
//   1. The clock's looks: daylight 1 by day, 0 at night, rising through dawn and falling through dusk, at most
//      SHADE_LIGHT (below the dark threshold) on the Shade; the sun a unit vector, up in the east at 05:30, south
//      and highest at noon, down in the west at 18:30, below the horizon at night; the noon sky the parent's,
//      the night's dark, dusk's horizon warm; the haze the horizon's colour outdoors and the parent's dark fog
//      (exactly) underground; one light bucket all night, a new one every 15 minutes by day.
//   2. No black below the horizon: at noon on the test world's start span (three seeds) and the real world's,
//      their aprons filled, facing every open side and corner from 6 tiles and 1 tile in, no cell of the 3D
//      view below the horizon is black (a blank character or a colour under 8). p0-done drew a 6-row band.
//   3. The dark-only rules by the clock (not setDaylight): on a sky-lit field with your torch out a ghost plank
//      is not drawn at noon and is at midnight (never with the torch lit); runes look different at noon and
//      midnight; with the torch out at night the auto-map marks only what lamps light, by day much more, in 3D
//      and on the map (refreshView); the Shade is dark by day.
//   4. The edge clamp: on open ground the light at a zone's border is the light inside.
//   5. The baked sun: behind a wall (from the sun) the voxels are in shade and the open ones in sun; a
//      morning sun throws the shadow west, an afternoon one east; the floor in the shadow draws darker; a
//      new bucket keeps the old bake until its own is done.
//   6. The map outdoors: a column shows its ground's look (a road "·", grass "." in its colour), the legend is
//      the terrain one and says glim; underground the map is the parent's (golden (b), part 9). Water holding
//      another liquid takes its colour on the map and in 3D.
//   7. Music: the temple keeps the temple mood, a flats span plays open by day and night at night, the Shade
//      plays shade all night; every mood content/moods.js names is one music.js plays.
//   8. Dynamic resolution: casts over 17 ms for 2 s halve the columns, a halved frame repeats every even
//      column in the odd one, and casts whose full cost is under 12 ms for 2 s bring it back; never underground.
//   9. Golden (b) unchanged: the legacy levels' 27 frames (tests/checks/golden.js, its frames part).
//  10. The victory card over the surface map (tests/checks/screen-frames.js no longer compares that frame with
//      p0-0c's, since the map behind it is WS3's): in the same state, every line of the card centred in its box,
//      its borders whole, its title in its colour, and every cell outside the box what the map draws without it.
import { checkGolden } from "./golden.js";

export async function checkRender(m) {
  const { game, startRun, S, capture, frameHash, clock, light, raycast, render3d, renderMap, zones, turns, world, rules, music,
    moods, liquids, worldmap } = m;
  const { Zone, B, FLOOR_Z } = world;
  const problems = [], stats = {};
  const expect = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
  const T = (h) => (h - 6) * 60 * rules.RULES.clock.secondsPerMinute;   // the game time of hour h of day 1 (06:00 is 0)
  const minute = (h) => h * 60;                                          // the world minute of hour h of day 1
  render3d.setDynamicResolution(false);

  // --- 1. The looks ----------------------------------------------------------------------------------------
  {
    const dl = (h) => clock.daylightAt(minute(h)), c = rules.RULES.clock;
    let bad = [];
    for (let h = 0; h < 24; h += 0.25) {
      const v = dl(h);
      if (h >= c.day && h < c.dusk && v !== 1) bad.push(`${h}: ${v}`);
      if ((h >= c.night || h < c.dawn) && v !== 0) bad.push(`${h}: ${v}`);
    }
    for (let h = c.dawn; h < c.day - 0.01; h += 1 / 12) if (!(dl(h + 1 / 12) > dl(h))) bad.push(`dawn ${h.toFixed(2)} not rising`);
    for (let h = c.dusk; h < c.night - 0.01; h += 1 / 12) if (!(dl(h + 1 / 12) < dl(h))) bad.push(`dusk ${h.toFixed(2)} not falling`);
    expect(!bad.length, `daylight: ${bad.slice(0, 4).join("; ")}`);
    const shadeGame = { time: T(12), zone: { wx: 0, wy: 0 }, run: { world: { tileAt: () => ({ terrain: "shade" }), terrains: { shade: { dark: true } } } } };
    const shade = clock.daylight(shadeGame);
    expect(shade <= clock.SHADE_LIGHT && shade < rules.RULES.dark.threshold, `the Shade at noon: daylight ${shade}`);
    const sun = (h) => clock.sunAt(minute(h)), len = (v) => Math.hypot(...v);
    const rise = sun((c.dawn + c.day) / 2), noon = sun(12), set = sun((c.dusk + c.night) / 2);
    const units = [0, 3, 5.5, 9, 12, 15, 18.5, 21].every((h) => Math.abs(len(sun(h)) - 1) < 1e-9);
    expect(units, "the sun isn't a unit vector");
    expect(rise[0] > 0.99 && Math.abs(rise[2]) < 1e-9 && set[0] < -0.99 && Math.abs(set[2]) < 1e-9, `rise ${rise}, set ${set}`);
    expect(noon[1] > 0 && Math.abs(noon[0]) < 1e-9 && [6, 9, 15, 18].every((h) => sun(h)[2] < noon[2]), `noon ${noon}`);
    expect([0, 3, 21, 23].every((h) => sun(h)[2] < 0), "the sun is up at night");
    const sky = (h) => clock.skyColorsAt(minute(h));
    expect(sky(12).zenith.join() === "50,95,190" && sky(12).horizon.join() === "170,200,240", `the noon sky ${JSON.stringify(sky(12))}`);
    expect([...sky(0).zenith, ...sky(0).horizon].reduce((a, b) => a + b, 0) < 120, `the night sky ${JSON.stringify(sky(0))}`);
    expect(sky(18.5).horizon[0] > sky(18.5).horizon[2] + 60, `dusk's horizon ${sky(18.5).horizon}`);
    const under = clock.fogFor({ time: T(12) }, { hasSky: false });
    expect(under.color.join() === "4,5,9" && under.density === 0.05, `underground fog ${JSON.stringify(under)}`);
    const out = clock.fogFor({ time: T(18.5), zone: null }, { hasSky: true, wx: null });
    expect(out.color.join() === sky(18.5).horizon.join() && out.density === clock.HAZE, `the haze at dusk ${JSON.stringify(out)}`);
    const nightBuckets = new Set([19.5, 21, 23, 0.5, 2, 4.4].map((h) => clock.lightBucketAt(minute(h))));
    const day = [6, 6.24, 6.25, 12, 12.1].map((h) => clock.lightBucketAt(minute(h)));
    expect(nightBuckets.size === 1 && nightBuckets.has(0) && day[0] === day[1] && day[1] !== day[2] && day[3] === day[4] && day[2] !== day[3],
      `light buckets: night ${[...nightBuckets]}, day ${day}`);
    stats.looks = { shade: +shade.toFixed(2), noonSun: noon.map((v) => +v.toFixed(3)), duskSky: sky(18.5), nightSky: sky(0) };
  }

  // A frame of the 3D view alone (no HUD), presented so the capture holds it.
  const frame3d = () => { game.effects = []; game.cam = null; game.fov = 75; game.view = "3d"; game.mode = "explore"; game.paused = false; render3d.render3d(game); S.present(); return frameHash(); };
  const p = () => game.player;
  const fresh = (seed, w) => { startRun(seed, w); game.pages = null; game.pendingPages = null; game.story.cube = true; game.modeStack = []; p().maxHpGain = 1e6; p().hp = 1e6; };
  const standNear = (zone, x0, y0) => {
    let best = null;
    for (let y = 0; y < zone.d; y++) for (let x = 0; x < zone.w; x++) {
      const z = zone.stand[x + y * zone.w], d = Math.hypot(x - x0, y - y0);
      if (z >= 0 && (!best || d < best.d)) best = { x, y, z, d };
    }
    return best;
  };

  // --- 2. No black below the horizon at noon -----------------------------------------------------------------
  {
    const runs = [[4242, undefined, "test"], [1234, undefined, "test"], [7, undefined, "test"], [4242, worldmap.REAL_WORLD, "real"]];
    const spots = [];
    let worst = 0, views = 0;
    for (const [seed, w, name] of runs) {
      fresh(seed, w);
      const zone = game.zone;
      for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) {
        const a = zones.neighbourAddr(game, zone, side);
        if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key);
      }
      zones.fillApron(game, zone);
      game.time = T(12);
      const open = ["n", "e", "s", "w", "ne", "nw", "se", "sw"].filter((s) => zone.apron?.[s]);
      for (const side of open) {
        const dx = side.includes("e") ? 1 : side.includes("w") ? -1 : 0, dy = side.includes("s") ? 1 : side.includes("n") ? -1 : 0;
        for (const inset of [6, 1]) {
          const tx = dx > 0 ? zone.w - 1 - inset : dx < 0 ? inset : zone.w >> 1, ty = dy > 0 ? zone.d - 1 - inset : dy < 0 ? inset : zone.d >> 1;
          const s = standNear(zone, tx, ty);
          Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw: Math.atan2(dy, dx), pitch: 0, torch: true });
          frame3d();
          let black = 0;
          for (let y = Math.ceil(capture.rows / 2); y < capture.rows; y++)
            for (let x = 0; x < capture.cols; x++) {
              const i = y * capture.cols + x;
              if (capture.chars[i] === " " || capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2] < 8) black++;
            }
          views++; worst = Math.max(worst, black);
          if (black) spots.push(`${name} ${seed} ${zone.key} facing ${side} from ${s.x},${s.y}: ${black}`);
        }
      }
      expect(open.length > 0, `${name} ${seed}: the start span ${zone.key} has no open side to face`);
    }
    expect(!spots.length, `black cells below the horizon at noon: ${spots.slice(0, 4).join("; ")}`);
    stats.horizon = { views, worstBlackBelow: worst };
  }

  // A 24×24 grass field (hasSky or not); build(z) adds blocks before the light is computed.
  const field = (key, hasSky, build = null) => {
    const z = new Zone({ key, wx: 97, wy: 97, z: 0, type: "surface", level: 1, seed: 5, w: 24, d: 24, h: 16, name: "Render Test" });
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, k === FLOOR_Z - 1 ? B.GRASS : B.ROCK);
    build?.(z);
    z.hasSky = hasSky; z.outdoor = hasSky;
    z.edges = { n: false, s: false, e: false, w: false };
    z.refresh();
    z.spawn = { x: 10.5, y: 10.5, z: FLOOR_Z, yaw: 0 };
    return z.seal();
  };
  const stand = (x, y, yaw = 0, pitch = 0) => Object.assign(p(), { x, y, z: FLOOR_Z, vz: 0, yaw, pitch, hurt: 0, wade: 0, swing: 0 });

  // --- 3. The dark-only rules by the clock ---------------------------------------------------------------------
  {
    fresh(91);
    const sky = field("render-sky", true);
    zones.enterZone(game, sky, { how: "start" });
    const drawn = {};
    for (const [name, h, torch] of [["noon", 12, false], ["midnight", 24, false], ["midnight, torch lit", 24, true]]) {
      game.time = T(h);
      stand(10.5, 10.5, 0, 0); p().torch = torch;
      sky.set(13, 10, FLOOR_Z + 1, B.GHOST);
      const withPlank = frame3d();
      sky.set(13, 10, FLOOR_Z + 1, B.AIR);
      drawn[name] = withPlank !== frame3d();
    }
    expect(!drawn.noon && drawn.midnight && !drawn["midnight, torch lit"], `a ghost plank drawn: ${JSON.stringify(drawn)} (want only at midnight with the torch out)`);
    const runes = field("render-runes", true, (z) => { for (let y = 8; y <= 12; y++) for (let k = FLOOR_Z; k < FLOOR_Z + 3; k++) z.set(13, y, k, B.RUNE); });
    zones.enterZone(game, runes, { how: "start" });
    stand(10.5, 10.5, 0, 0); p().torch = false;
    game.time = T(12); const runeNoon = frame3d();
    game.time = T(24); const runeNight = frame3d();
    expect(runeNoon !== runeNight, "runes look the same at noon and at midnight with the torch out");
    // The auto-map, torch out: by day the sky lights the field, at night nothing does (the map still marks the 3 × 3
    // around you); a lit torch marks what it reaches, and a lamp what it lights.
    const lit = field("render-seen", true);
    zones.enterZone(game, lit, { how: "start" });
    const seenAt = (h, torch, map) => {
      lit.seen.fill(0); game.time = T(h); stand(10.5, 10.5, Math.PI * 1.25, -0.25); p().torch = torch;
      // (Jumping the clock burns the quick game's empty purse and the torch would gutter: not what this is about.)
      if (map) { game.view = "map"; game.mode = "map"; game.debug.step(0); p().torchBurn = 0; turns.refreshView(game); }
      else { game.debug.step(0); p().torchBurn = 0; frame3d(); }
      let n = 0; for (let i = 0; i < lit.seen.length; i++) n += lit.seen[i];
      return n;
    };
    const seen = { noon3d: seenAt(12, false, false), night3d: seenAt(24, false, false), noonMap: seenAt(12, false, true), nightMap: seenAt(24, false, true),
                   nightTorchMap: seenAt(24, true, true), duskMap: seenAt(18.5, false, true) };
    lit.set(3, 20, FLOOR_Z, B.LAMP); lit.refresh();
    seen.nightLampMap = seenAt(24, false, true);
    expect(seen.night3d <= 9 && seen.nightMap <= 9 && seen.noon3d > 50 && seen.noonMap > 50 && seen.nightTorchMap > 20 && seen.nightLampMap > seen.nightMap + 5 &&
           seen.duskMap > 50, `the auto-map's night rule: seen ${JSON.stringify(seen)}`);
    game.time = T(12);
    stats.dark = { plank: drawn, runesDifferNoonMidnight: runeNoon !== runeNight, seen };
  }

  // --- 4. The edge clamp ---------------------------------------------------------------------------------------
  {
    const open = field("render-clamp", true);
    game.time = T(12);
    const inside = light.lightAt(game, open, 12, 12, FLOOR_Z + 0.5).sky, edge = light.lightAt(game, open, 0.1, 12, FLOOR_Z + 0.5).sky,
          corner = light.lightAt(game, open, 0.1, 23.9, FLOOR_Z + 0.5).sky;
    expect(inside > 0.9 && Math.abs(edge - inside) < 1e-6 && Math.abs(corner - inside) < 1e-6, `light at the border ${edge} / corner ${corner}, inside ${inside}`);
    stats.edgeClamp = { inside: +inside.toFixed(4), edge: +edge.toFixed(4), corner: +corner.toFixed(4) };
  }

  // --- 5. The baked sun ----------------------------------------------------------------------------------------
  {
    // A wall 4 high along y = 6..17 at x = 12. Morning sun (east): its shadow falls west of it; afternoon: east.
    const walled = field("render-sun", true, (z) => { for (let y = 6; y <= 17; y++) for (let k = FLOOR_Z; k < FLOOR_Z + 4; k++) z.set(12, y, k, B.STONE); });
    const shadeOf = (h, x) => { light.bakeSun(walled, clock.lightBucketAt(minute(h))); return light.sunlitAt(walled, x, 12, FLOOR_Z - 1, 0, 0, 1, x + 0.5, 12.5, FLOOR_Z); };
    const m = { westAm: shadeOf(8, 10), eastAm: shadeOf(8, 14), westPm: shadeOf(16, 10), eastPm: shadeOf(16, 14), farAm: shadeOf(8, 3) };
    expect(m.westAm < 0.1 && m.eastAm > 0.9 && m.westPm > 0.9 && m.eastPm < 0.1 && m.farAm > 0.9, `the wall's shadow (1 = sun): ${JSON.stringify(m)}`);
    // Drawn: the floor in the shadow (x 10.5) is darker than in the sun (x 3.5), seen from the south.
    zones.enterZone(game, walled, { how: "start" });
    game.time = T(8); stand(7, 23.5, -Math.PI / 2, -0.15); p().torch = false;
    game.debug.step(0); frame3d();
    const lum = (sx, sy) => { const i = sy * capture.cols + sx; return capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2]; };
    let shadowL = 0, sunL = 0;
    const st = light.sunState(walled);
    expect(st.bucket === clock.lightBucketAt(minute(8)) && st.sun, `the bake's bucket ${st.bucket} at 08:00`);
    // Project the two floor points (y 12) to the screen.
    const cam = render3d.cam, proj = (x, y, z) => {
      const vx = x - cam.ex, vy = y - cam.ey, vz = z - cam.ez, zc = vx * cam.fX + vy * cam.fY + vz * cam.fZ;
      return [Math.round(((vx * cam.rX + vy * cam.rY) / zc / cam.halfW + 1) * 0.5 * capture.cols - 0.5),
              Math.round((1 - (vx * cam.uX + vy * cam.uY + vz * cam.uZ) / zc / cam.halfH) * 0.5 * capture.rows - 0.5)];
    };
    const [ax, ay] = proj(10.5, 12, FLOOR_Z), [bx, by] = proj(3.5, 12, FLOOR_Z);
    shadowL = lum(ax, ay); sunL = lum(bx, by);
    expect(shadowL < sunL * 0.8, `the floor in the wall's shadow ${shadowL} vs in the sun ${sunL} (cells ${ax},${ay} and ${bx},${by})`);
    // A new bucket: the old bake stays until the new one is done.
    const b0 = light.sunState(walled).bucket, old = walled.sunlit;
    game.time = T(12);
    const bake = light.BAKE_MS;
    light.syncLight(game, walled);
    const mid = light.sunState(walled);
    expect(bake > 0 && (mid.baking ? walled.sunlit === old && mid.bucket === b0 : mid.bucket === clock.lightBucketAt(minute(12))), `a new bucket: ${JSON.stringify({ b0, mid })}`);
    for (let k = 0; k < 50 && light.sunState(walled).baking; k++) light.syncLight(game, walled);
    expect(light.sunState(walled).bucket === clock.lightBucketAt(minute(12)) && walled.sunlit !== old, "the new bucket's bake never finished");
    stats.sun = { ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)])), floorShadow: shadowL, floorSun: sunL };
  }

  // --- 6. The map outdoors, the legend, liquids --------------------------------------------------------------
  {
    fresh(4242);
    const zone = game.zone;
    zone.seen.fill(1);
    game.time = T(12); game.view = "map"; game.mode = "map"; game.paused = false;
    renderMap.mapView.top = 2;
    renderMap.renderMap(game); S.present();
    const mv = renderMap.mapView, cellOf = (tx, ty) => { const sx = (tx - mv.tx0) * 2, sy = mv.top + ty - mv.ty0, i = sy * capture.cols + sx; return { ch: capture.chars[i], rgb: [0, 1, 2].map((k) => capture.colors[i * 3 + k]) }; };
    let road = null, grass = null;
    for (let i = 0; i < zone.w * zone.d && (!road || !grass); i++) {
      if (zone.kind[i] !== world.KIND.FLOOR) continue;
      if (!road && zone.look[i] === B.ROAD) road = i; else if (!grass && zone.look[i] === B.GRASS) grass = i;
    }
    const rc = road !== null ? cellOf(road % zone.w, Math.floor(road / zone.w)) : null, gc = grass !== null ? cellOf(grass % zone.w, Math.floor(grass / zone.w)) : null;
    const want = world.BLOCKS[B.GRASS].color.map((v) => Math.floor(v * 0.85));
    expect(rc?.ch === world.BLOCKS[B.ROAD].map.glyph && gc?.ch === "." && gc.rgb.every((v, k) => Math.abs(v - want[k]) <= 1),
      `outdoor map looks: road ${JSON.stringify(rc)}, grass ${JSON.stringify(gc)} (want "·" and "." ${want})`);
    const text = Array.from({ length: capture.rows }, (_, y) => capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join("")).join("\n");
    expect(/LEGEND/.test(text) && /\$ +glim/.test(text) && !/\$ +gold/.test(text), "the outdoor legend doesn't show (or doesn't say glim)");
    // Another liquid: a pool on a field, the zone's liquid named; the map and the 3D frame take its colour.
    const pool = field("render-pool", true, (z) => { for (let y = 8; y <= 14; y++) for (let x = 12; x <= 18; x++) z.set(x, y, FLOOR_Z - 1, B.WATER_SHALLOW); });
    zones.enterZone(game, pool, { how: "start" });
    pool.seen.fill(1);
    const KEY = "renderCheckBrine";
    const mapCell = () => { game.view = "map"; game.mode = "map"; renderMap.renderMap(game); S.present(); return cellOf(15, 11).rgb.join(); };
    const plain = mapCell();
    stand(10.5, 11.5, 0, -0.35); p().torch = true;
    const plain3d = frame3d();
    liquids.LIQUIDS[KEY] = { name: "test brine", color: [210, 60, 50] };
    pool.liquid = KEY;
    try {
      const red = mapCell();
      stand(10.5, 11.5, 0, -0.35);
      const red3d = frame3d();
      expect(plain !== red && red.split(",").map(Number)[0] > 150 && plain3d !== red3d, `another liquid: map ${plain} → ${red}, 3D changed ${plain3d !== red3d}`);
      stats.liquid = { map: [plain, red] };
    } finally { delete liquids.LIQUIDS[KEY]; pool.liquid = "water"; }
    stats.map = { road: rc, grass: gc, legend: "glim" };
  }

  // --- 7. Music moods -------------------------------------------------------------------------------------------
  {
    fresh(4242);
    const z = game.zone, moodAt = (h, zone, g = game) => { g.time = T(h); return music.surfaceMood(g, zone); };
    const flats = { wx: 3, wy: 3, landmarkId: null }, fakeShade = { time: 0, zone: null, run: { world: { tileAt: () => ({ terrain: "shade" }), terrains: { shade: { dark: true } } } } };
    const got = { temple: moodAt(12, z), templeNight: moodAt(24, z), flats: moodAt(12, flats), flatsNight: moodAt(24, flats),
                  shade: moodAt(12, { wx: 0, wy: 0 }, fakeShade), shadeNight: moodAt(24, { wx: 0, wy: 0 }, fakeShade) };
    const flatsTerrain = game.run.world.tileAt(3, 3)?.terrain;
    expect(got.temple === "temple" && got.templeNight === "temple" && got.flats === moods.MOODS.terrains[flatsTerrain] && got.flatsNight === "night" &&
           got.shade === "shade" && got.shadeNight === "shade", `moods: ${JSON.stringify(got)} (span 3,3 is ${flatsTerrain})`);
    const names = new Set(music.moodNames()), T2 = moods.MOODS;
    const named = [T2.surface, T2.night, ...T2.allNight, ...Object.values(T2.landmarks), ...Object.values(T2.terrains)];
    const unknown = named.filter((n) => !names.has(n));
    expect(!unknown.length, `content/moods.js names moods music.js doesn't play: ${[...new Set(unknown)]}`);
    stats.moods = got;
  }

  // --- 8. Dynamic resolution ------------------------------------------------------------------------------------
  {
    fresh(4242);
    game.time = T(12);
    stand(game.zone.spawn.x, game.zone.spawn.y); Object.assign(p(), { z: game.zone.spawn.z });
    render3d.setDynamicResolution(true);
    try {
      frame3d();   // outdoors this frame
      // Synthetic frame times on a clock of their own (the frames drawn between feed in real ones: start that
      // clock well past them, and give the average room to settle either way).
      let now = performance.now() + 1e7;
      for (let k = 0; k < 400; k++) render3d.judgeFrame(20, (now += 16));
      const halved = render3d.dynamicResolution().half;
      frame3d();
      now += 1e7;
      let pairs = 0, same = 0;
      for (let y = 1; y < capture.rows; y++) for (let x = 0; x + 1 < capture.cols; x += 2) {
        const i = y * capture.cols + x; pairs++;
        if (capture.chars[i] === capture.chars[i + 1] && capture.colors[i * 3] === capture.colors[i * 3 + 3]) same++;
      }
      for (let k = 0; k < 400; k++) render3d.judgeFrame(5, (now += 16));
      const back = !render3d.dynamicResolution().half;
      for (let k = 0; k < 400; k++) render3d.judgeFrame(20, (now += 16));
      fresh(91); zones.changeZone(game, "0,0,3", { how: "down", rng: Math.random }); frame3d();
      const under = render3d.dynamicResolution().half;
      expect(halved && back && !under && same / pairs > 0.97, `dynamic resolution: halved ${halved}, odd columns repeat ${same}/${pairs}, back ${back}, underground ${under}`);
      stats.dynamic = { halved, repeatedPairs: +(same / pairs).toFixed(3), back, underground: under };
    } finally { render3d.setDynamicResolution(false); }
  }

  // --- 10. The victory card over the surface map ---------------------------------------------------------------
  {
    m.seedRandom?.(7);   // screen-frames.js's state for the card
    startRun(7);
    game.pages = null; game.pendingPages = null; game.story.cube = true;
    const shot = (mode) => { game.fps = 60; game.frameMs = 1.5; game.mode = mode; game.debug.draw(); return { chars: capture.chars.slice(), colors: capture.colors.slice() }; };
    const map = shot("map"), won = shot("won"), W = capture.cols, H = capture.rows;
    const rowText = (y) => won.chars.slice(y * W, (y + 1) * W).join("");
    const bad = [];
    const yV = [...Array(H).keys()].find((y) => /(^| )VICTORY( |$)/.test(rowText(y)));
    if (yV === undefined) bad.push("no VICTORY line");
    else {
      const xV = rowText(yV).indexOf("VICTORY"), y0 = yV - 2;
      let x0 = xV + 3, x1 = xV + 3;
      while (x0 > 0 && won.chars[y0 * W + x0 - 1] === "-") x0--;
      while (x1 < W - 1 && won.chars[y0 * W + x1 + 1] === "-") x1++;
      const w = x1 - x0 + 1;
      const lines = ["VICTORY", "", "Vorlath is dust, and Hollowmere is safe: flat, and happy about it.", null, "Seed 7", "", "Press R to start a new run"];
      const level = rowText(y0 + 5).trim();
      if (!/^Level \d+ · \d+ max HP · \d+ STR · \d+:\d\d of game time$/.test(level)) bad.push(`the level line reads "${level}"`);
      lines[3] = level;
      const h = lines.length + 4, y1 = y0 + h - 1;
      if (w !== Math.max(...lines.map((t) => t.length)) + 6) bad.push(`the box is ${w} wide`);
      for (let x = x0; x <= x1; x++) if (won.chars[y0 * W + x] !== "-" || won.chars[y1 * W + x] !== "-") { bad.push(`a border is broken at column ${x}`); break; }
      const inBox = new Set();
      lines.forEach((t, k) => {
        const y = y0 + 2 + k, x = x0 + ((w - t.length) >> 1);
        if (won.chars.slice(y * W + x, y * W + x + t.length).join("") !== t) bad.push(`line ${k} "${t}" is not centred at ${x},${y}`);
      });
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) inBox.add(y * W + x);
      for (let y = y0 + 1; y < y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y - y0 - 2, t = lines[k] ?? "", tx = x0 + ((w - t.length) >> 1);
        if ((x < tx || x >= tx + t.length) && won.chars[y * W + x] !== " ") { bad.push(`stray "${won.chars[y * W + x]}" in the box at ${x},${y}`); break; }
      }
      const ti = yV * W + xV;
      if ([0, 1, 2].map((c) => won.colors[ti * 3 + c]).join() !== "255,230,120") bad.push("VICTORY isn't in its gold");
      let outside = 0, differ = 0;
      for (let i = 0; i < W * H; i++) {
        if (inBox.has(i)) continue;
        outside++;
        if (won.chars[i] !== map.chars[i] || won.colors[i * 3] !== map.colors[i * 3] || won.colors[i * 3 + 1] !== map.colors[i * 3 + 1] || won.colors[i * 3 + 2] !== map.colors[i * 3 + 2]) differ++;
      }
      if (differ) bad.push(`${differ} of ${outside} cells outside the box differ from the map without the card`);
      const mapText = map.chars.join("");
      if (!/\$ +glim/.test(mapText)) bad.push("the map behind the card isn't the outdoor one (no glim in its legend)");
      stats.victory = { box: { x0, y0, w, h }, outsideCells: outside, outsideDiffer: differ };
    }
    expect(!bad.length, `the victory card: ${bad.slice(0, 4).join("; ")}`);
  }

  // --- 9. Golden (b) --------------------------------------------------------------------------------------------
  if (m.golden) {
    const g = checkGolden(m.golden.api, m.golden.fixtures, { only: ["frames"] });
    expect(g.ok, `golden (b) frames: ${g.problems.slice(0, 3).join("; ")}`);
    stats.golden = g.stats.frames;
  }

  return { name: "render (WS3: outdoors, the clock's looks, the map)", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point: tools/check-perf.mjs runs it in Node (and test-world.html in a page).
export async function run(env) {
  const scr = await env.screen({ cols: 180, rows: 56 });
  const load = (p) => env.src(p);
  const [g, clock, light, raycast, render3d, renderMap, zones, turns, world, rules, music, moods, liquids, worldmap] = await Promise.all(
    ["game.js", "clock.js", "light.js", "raycast.js", "render3d.js", "renderMap.js", "zones.js", "turns.js", "world.js", "rules.js", "music.js",
     "content/moods.js", "content/liquids.js", "content/world/worldmap.js"].map(load));
  const fixtures = { frames: await env.json("tests/fixtures/golden/frames.json") };
  const { currentApi } = await import("../golden/current-api.js");
  const S = await load("screen.js");
  const result = await checkRender({ game: g.game, startRun: g.startRun, S, capture: scr.capture, frameHash: scr.frameHash, clock, light, raycast,
    render3d, renderMap, zones, turns, world, rules, music, moods, liquids, worldmap, golden: null, seedRandom: env.seedRandom });
  // Golden (b) last: its api reseeds Math.random and replaces the run.
  const api = await currentApi({ load, capture: scr.capture, frameHash: scr.frameHash }, env.seedRandom);
  const gold = checkGolden(api, fixtures, { only: ["frames"] });
  if (!gold.ok) { result.ok = false; result.problems.push(`golden (b) frames: ${gold.problems.slice(0, 3).join("; ")}`); }
  result.stats.golden = gold.stats.frames;
  return result;
}
