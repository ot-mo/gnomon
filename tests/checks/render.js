// Rendering outdoors (WS3; TECH_DESIGN §6, §8.3 "WS3" acceptance). Node runs it through tools/check-perf.mjs
// (WS3's runner, with the frame and bake budgets), the browser through test-world.html.
//
//   checkRender(m) → { name, ok, problems, stats }      m: the modules and the screen (run(env) below)
//
//   1. The clock's looks: daylight 1 by day, 0 at night, rising through dawn and falling through dusk, at most
//      SHADE_LIGHT (below the dark threshold) on the Shade; the sun a unit vector, up in the south-east at 06:00,
//      over the Gnomon (north-east) and highest at noon, down in the north at 18:00, below the horizon at night, the
//      shadows by day along the Hand; the Hand by the bible's cases, dimming the span under it to dusk; the noon sky the parent's,
//      the night's dark, dusk's horizon warm; the haze the horizon's colour outdoors and the parent's dark fog
//      (exactly) underground; one light bucket all night, a new one every 15 minutes by day.
//   2. No black below the horizon: at noon on the test world's start span (three seeds), the real world's, and two
//      real spans beside Hollowmere with a shut corner between open sides, their aprons filled, facing every side
//      and corner from 6 tiles and 1 tile in, no cell of the 3D view below the horizon is black (a blank character
//      or a colour under 8); nor, at 180×55 (an odd row count), the level row at pitch 0. p0-done drew a 6-row band.
//   3. The dark-only rules by the clock (not setDaylight): on a sky-lit field with your torch out a ghost plank
//      is not drawn at noon and is at midnight (never with the torch lit); runes don't glow at noon and do at
//      midnight; with the torch out at night the auto-map marks only what lamps light, by day much more, in 3D
//      and on the map (refreshView); the Shade is dark by day. Creatures see you by the same light (WS8's
//      creatures.sees): a goblin sees you at noon from 0.7 of its sight, at midnight with your torch out it doesn't.
//   4. The edge clamp: on open ground the light at a zone's border is the light inside.
//   5. The baked sun: behind a wall (from the sun) the voxels are in shade and the open ones in sun; the 08:00
//      sun (east-south-east) throws an east-west wall's shadow north, the 16:00 one (north-north-east) south;
//      the floor in the shadow draws darker; a new bucket keeps the old bake until its own is done.
//   6. The map outdoors: a column shows its ground's look (a road "·", grass "." in its colour), the legend is
//      the terrain one and says glim; a pit not looked into, ghost planks and an unseen bridge draw as the ground
//      around them; underground the map is the parent's (golden (b), part 9). Water holding
//      another liquid takes its colour on the map and in 3D, under the sky and underground; beyond an edge the
//      neighbour's water is the neighbour's liquid. the comma on the map (screens/play.js, WS3's request 4) shows the
//      legend where it doesn't fit and hides it where it does; the legend's foot names it.
//   7. Music: the temple keeps the temple mood, a flats span plays open by day and night at night, the Shade
//      plays shade all night; every mood content/moods.js names is one music.js plays. Voices: speakLetter's voice
//      is a voice object, a parent's person's id, or else the neutral voice (not Maren's).
//   8. Dynamic resolution: casts over 17 ms for 2 s halve the columns, a halved frame repeats every even
//      column in the odd one, and casts whose full cost is under 12 ms for 2 s bring it back; never underground.
//   9. Golden (b) unchanged: the legacy levels' 27 frames (tests/checks/golden.js, its frames part).
//  10. The victory card over the surface map (tests/checks/screen-frames.js no longer compares that frame with
//      p0-0c's, since the map behind it is WS3's): in the same state, every line of the card centred in its box,
//      its borders whole, its title in its colour, and every cell outside the box what the map draws without it.
//  12. With --expose-gc (check-perf runs it so): a dormant zone's light arrays, bake and apron are freed after dropDerived.
//  11. The Gnomon on the horizon (bible §4.12): from Hollowmere's lane, facing its bearing, a dark needle stands over the
//      sky and the horizon plane in the screen's middle columns, its tip glinting at noon but not at 09:00; facing
//      away, none; behind a wall, none; at 23:00 nothing from the flats, a violet light from the Shade and from a Rust
//      Steps mesa's top (not its foot), none from the Shade at noon; in its own span drawn from under its tip (cut
//      where it passes behind you) and standing on the ground; none in the test world or underground.
//  13. Every creature is drawn whatever its attitude: a beast 3 tiles ahead at noon draws as your follower too, and a
//      flat one that follows you still casts its shadow (3D drew only the creatures hostile to you).
//  14. The dressing's props (WS2b's zone.props, drawn since the WS2b merge): on a span near the start, every prop on a
//      seen tile shows its glyph on the map (under items, creatures and you), none on a tile the map draws as wall; a
//      prop three tiles ahead at noon changes the 3D frame, and only locally.
//  15. The held weapon by the hour (WS3 #7, at the WS9 merge): under open sky with your torch out it is lit less at
//      midnight than at noon (the sky's light × daylight; it shone at night); underground the same at both hours.
//  16. The regions' skies and the landmarks seen from afar (B2: C1a #5, C1b #14, #25): on a glare span (the Salt Waste) the
//      view stops at 6 tiles in the noon window, bleached (a wall beyond it unseen at noon, seen at 10:00); under the canopy
//      the light dims and the haze is green; the Tall Table's and Foldmother's silhouettes on the horizon from two spans off
//      by day, facing them (not facing away, behind a wall, at night, in their own span or beyond their visibleFrom); Folio's shadows
//      sliding in 3D (none on the map) and its scratching every 0.4-1.3 s in 3D there only.
import { checkGolden } from "./golden.js";

export async function checkRender(m) {
  const { game, startRun, S, capture, frameHash, clock, light, raycast, render3d, renderMap, zones, turns, world, rules, music,
    moods, liquids, worldmap, creatures, keys } = m;
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
    const rise = sun(c.day), noon = sun(12), set = sun(c.dusk);
    const units = [0, 3, 5.5, 9, 12, 15, 18.5, 21].every((h) => Math.abs(len(sun(h)) - 1) < 1e-9);
    expect(units, "the sun isn't a unit vector");
    // The Dial's sun (bible §1.3, §4.8): up in the south-east at 06:00, over the Gnomon in the north-east at noon, down in
    // the north at 18:00; by day its bearing is the Hand's opposite, so the shadows point the Hand's way.
    expect(rise[0] > 0.7 && rise[1] > 0.6 && Math.abs(rise[2]) < 1e-9 && set[1] < -0.99 && Math.abs(set[2]) < 1e-9, `rise ${rise}, set ${set}`);
    expect(noon[0] > 0 && noon[1] < 0 && Math.abs(noon[2] - Math.sin(clock.SUN_NOON_HEIGHT)) < 1e-9 && [6, 9, 15, 18].every((h) => sun(h)[2] < noon[2]), `noon ${noon}`);
    const handOff = [7, 9, 11, 12, 13, 15, 17].map((h) => { const s = sun(h), l = Math.hypot(s[0], s[1]), th = clock.handAngle(h);
      return Math.hypot(-s[0] / l + Math.cos(th), -s[1] / l - Math.sin(th)); });
    expect(handOff.every((d) => d < 1e-9), `the shadow's bearing isn't the Hand's: ${handOff}`);
    // The Hand: the bible's own cases (§15.8 item 9) on a world with the Gnomon at (37, 3); none at night or without it.
    const dial = (n, h = 12) => ({ time: T(h), zone: null, run: { world: { landmarks: new Map([["gnomon", { wx: 37, wy: 3 }]]), tileAt: () => ({ terrain: "flats" }), terrains: { flats: {} } } }, state: { noonLength: n } });
    const hand = { at23_10: clock.underHand(dial(15.5), 23, 10), at6_18: clock.underHand(dial(34.5), 6, 18), short6_18: clock.underHand(dial(33), 6, 18),
      night: clock.underHand(dial(15.5, 23), 23, 10), noGnomon: clock.underHand({ time: T(12), run: { world: { landmarks: new Map() } } }, 23, 10) };
    const dimDay = clock.daylight({ ...dial(15.5), zone: { wx: 23, wy: 10 } }), clearDay = clock.daylight({ ...dial(15.5), zone: { wx: 5, wy: 16 } });
    expect(hand.at23_10 && hand.at6_18 && !hand.short6_18 && !hand.night && !hand.noGnomon && dimDay <= clock.SHADE_LIGHT && clearDay === 1,
      `the Hand: ${JSON.stringify(hand)}, daylight under it ${dimDay}, beside it ${clearDay}`);
    // Its length N × (1 + |h − 12| / 3) capped at 40, its hours 06:00-18:00, its width 0.5 spans (§15.6).
    const handAtH = (n, h) => clock.handAt(dial(n, h), minute(h));
    const r12 = handAtH(15.5, 12), nrm = [-r12.dy, r12.dx], off = (k, dd) => [37 + r12.dx * k + nrm[0] * dd, 3 + r12.dy * k + nrm[1] * dd];
    const handRules = { at9: handAtH(15.5, 9)?.length, capped: handAtH(30, 6)?.length, before6: handAtH(15.5, 5.99), at6: !!handAtH(15.5, 6), at18: !!handAtH(15.5, 18),
      after18: handAtH(15.5, 18.01), inside: clock.underHand(dial(15.5), ...off(5, 0.45)), outside: clock.underHand(dial(15.5), ...off(5, 0.55)) };
    expect(Math.abs(handRules.at9 - 31) < 1e-9 && handRules.capped === 40 && handRules.before6 === null && handRules.at6 && handRules.at18 && handRules.after18 === null &&
           handRules.inside && !handRules.outside, `the Hand's length, hours and width: ${JSON.stringify(handRules)}`);
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
    // The HUD's clock segment (for the integrator to register): the day and hour under the sky, nothing underground.
    const seg = render3d.CLOCK_SEGMENT, skyGame = { time: T(12), state: {}, zone: { hasSky: true } }, underGame = { ...skyGame, zone: { hasSky: false } };
    const atNoon = seg.parts(skyGame), atNight = seg.parts({ ...skyGame, time: T(23) }), atUnder = seg.parts(underGame);
    expect(seg.priority === 30 && atNoon?.text === "day 1, 12:00" && atNight?.text === "day 1, 23:00" && atNoon.color.join() !== atNight.color.join() && !atUnder,
      `the clock segment: ${JSON.stringify({ atNoon, atNight, atUnder })}`);
    stats.looks = { shade: +shade.toFixed(2), noonSun: noon.map((v) => +v.toFixed(3)), duskSky: sky(18.5), nightSky: sky(0), clock: atNoon?.text };
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

  // --- 1 (cont.): the Shade's sky, which needs a run -----------------------------------------------------------
  {
    // The Shade's sky by the zone asked (not game.zone's), and its stars by the hour, not by its dimness.
    fresh(4242, worldmap.REAL_WORLD);
    const Wd = game.run.world;
    let sk = null;
    for (let y = 0; y < Wd.h && !sk; y++) for (let x = 0; x < Wd.w && !sk; x++) { const t = Wd.tileAt(x, y); if (t?.terrain === "shade" && t.travel !== "no" && !t.landmark) sk = [x, y]; }
    const shadeZone = { wx: sk[0], wy: sk[1], hasSky: true }, flatsZone = { wx: 5, wy: 16, hasSky: true };
    game.time = T(12);
    const skyBy = { shade: clock.skyColors(game, shadeZone).zenith.join(), flats: clock.skyColors(game, flatsZone).zenith.join(),
      hazeShade: clock.fogFor(game, shadeZone).density, hazeFlats: clock.fogFor(game, flatsZone).density };
    game.debug.enterZone(`${sk[0]},${sk[1]},0`, "start");
    const up = () => { const s = standNear(game.zone, game.zone.w >> 1, game.zone.d >> 1);
      Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw: 0, pitch: 1.2 }); frame3d(); return render3d.lookState(); };
    game.time = T(12); const noonLook = up();
    game.time = T(23); const nightLook = up();
    expect(skyBy.shade !== skyBy.flats && skyBy.hazeShade > skyBy.hazeFlats && noonLook.starK === 0 && noonLook.discVis > 0.5 && nightLook.starK > 0.9,
      `the Shade's sky: ${JSON.stringify({ skyBy, noonLook, nightLook })}`);
  }

  // --- 2. No black below the horizon at noon -----------------------------------------------------------------
  {
    const runs = [[4242, undefined, "test"], [1234, undefined, "test"], [7, undefined, "test"], [4242, worldmap.REAL_WORLD, "real"],
                  [4242, worldmap.REAL_WORLD, "real", "3,17,0"], [4242, worldmap.REAL_WORLD, "real", "7,19,0"]];
    const spots = [];
    let worst = 0, views = 0;
    const blackBelow = () => {
      let black = 0;
      for (let y = Math.floor(capture.rows / 2); y < capture.rows; y++)   // (on an odd count, from the level row)
        for (let x = 0; x < capture.cols; x++) {
          const i = y * capture.cols + x;
          if (capture.chars[i] === " " || capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2] < 8) black++;
        }
      return black;
    };
    for (const [seed, w, name, key] of runs) {
      fresh(seed, w);
      if (key) game.debug.enterZone(key, "start");
      const zone = game.zone;
      for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) {
        const a = zones.neighbourAddr(game, zone, side);
        if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key);
      }
      zones.fillApron(game, zone);
      game.time = T(12);
      const open = ["n", "e", "s", "w", "ne", "nw", "se", "sw"].filter((s) => zone.apron?.[s]);
      for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) {
        const dx = side.includes("e") ? 1 : side.includes("w") ? -1 : 0, dy = side.includes("s") ? 1 : side.includes("n") ? -1 : 0;
        for (const inset of [6, 1]) {
          const tx = dx > 0 ? zone.w - 1 - inset : dx < 0 ? inset : zone.w >> 1, ty = dy > 0 ? zone.d - 1 - inset : dy < 0 ? inset : zone.d >> 1;
          const s = standNear(zone, tx, ty);
          Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw: Math.atan2(dy, dx), pitch: 0, torch: true });
          frame3d();
          const black = blackBelow();
          views++; worst = Math.max(worst, black);
          if (black) spots.push(`${name} ${seed} ${zone.key} facing ${side} from ${s.x},${s.y}: ${black}`);
        }
      }
      expect(open.length > 0, `${name} ${seed}: the span ${zone.key} has no open side to face`);
      if (key) expect(!zone.apron.se || !zone.apron.sw || !zone.apron.ne || !zone.apron.nw, `${key}: no shut corner to face`);
      // An odd number of rows: at pitch 0 the middle row's rays are level (dz 0).
      if (m.resize && !key && name === "real") {
        m.resize(180, 55);
        for (const side of open.filter((d) => d.length === 1)) {   // 6 tiles in from each open side, facing out
          const dx = side === "e" ? 1 : side === "w" ? -1 : 0, dy = side === "s" ? 1 : side === "n" ? -1 : 0, yaw = Math.atan2(dy, dx);
          const s = standNear(zone, dx > 0 ? zone.w - 7 : dx < 0 ? 6 : zone.w >> 1, dy > 0 ? zone.d - 7 : dy < 0 ? 6 : zone.d >> 1);
          Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw, pitch: 0, torch: true });
          frame3d();
          const black = blackBelow();
          views++; worst = Math.max(worst, black);
          if (black) spots.push(`${name} ${seed} ${zone.key} at 180×55, yaw ${yaw.toFixed(2)}, pitch 0: ${black}`);
        }
        m.resize(180, 56);
      }
    }
    expect(!spots.length, `black cells below the horizon at noon: ${spots.slice(0, 4).join("; ")}`);
    // A pit in the neighbour, seen across the edge in its apron band, is a pit (black), as it is from inside its zone.
    fresh(4242);
    const pz = game.zone;
    for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const a = zones.neighbourAddr(game, pz, side); if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key); }
    zones.fillApron(game, pz);
    const band = pz.apron.e, n = band.bw * band.bd;
    for (let ly = 22; ly <= 26; ly++) for (let lx = 1; lx <= 5; lx++) for (let k = 0; k < pz.h; k++) band.blocks[lx + ly * band.bw + k * n] = 0;
    game.time = T(12);
    const ps = standNear(pz, pz.w - 2, 24);
    Object.assign(p(), { x: ps.x + 0.5, y: ps.y + 0.5, z: ps.z, vz: 0, yaw: 0, pitch: -0.75, torch: true });
    frame3d();
    let pitBlack = 0;
    for (let i = 0; i < capture.cols * capture.rows; i++) if (capture.chars[i] === " " || capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2] < 8) pitBlack++;
    expect(pitBlack > 20, `a pit beyond the edge (in the apron band) isn't drawn as a pit: ${pitBlack} black cells`);
    // The plane takes the side a ray left by: near the east edge, 10 tiles from the north edge, facing south-south-east
    // (more south than east), the level rays leave by the east; with east painted red and south blue, red wins.
    fresh(4242);
    const hz = game.zone;
    for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const a = zones.neighbourAddr(game, hz, side); if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key); }
    zones.fillApron(game, hz);
    game.time = T(12);
    const sides = render3d.horizonOf(game, hz), was = [sides.e.color, sides.s.color];
    sides.e.color = [255, 0, 0]; sides.s.color = [0, 0, 255];
    const hs = standNear(hz, hz.w - 2, 10);
    Object.assign(p(), { x: hs.x + 0.5, y: hs.y + 0.5, z: hs.z, vz: 0, yaw: 1.0, pitch: 0, torch: true });
    frame3d();
    let red = 0, blue = 0;
    for (let i = (capture.rows >> 1) * capture.cols; i < capture.cols * capture.rows; i++) {
      const r = capture.colors[i * 3], b = capture.colors[i * 3 + 2];
      if (r > b + 60) red++; else if (b > r + 60) blue++;
    }
    [sides.e.color, sides.s.color] = was;
    expect(red > blue && red > 20, `the horizon plane's side, leaving by the east while heading more south: red (east) ${red}, blue (south) ${blue}`);
    stats.horizon = { views, worstBlackBelow: worst, apronPitBlack: pitBlack, sideByExit: { east: red, south: blue } };
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
    // Glowing strokes are bright cyan (materials.js: 90, 220, 255 with a glow); worn scratches are the stone's grey.
    const glowing = () => { let n = 0; for (let i = 0; i < capture.cols * capture.rows; i++) {
      const r = capture.colors[i * 3], g = capture.colors[i * 3 + 1], b = capture.colors[i * 3 + 2];
      if (b > 180 && b > r + 80 && g > r + 60) n++; } return n; };
    game.time = T(12); frame3d(); const runeNoon = glowing();
    game.time = T(24); frame3d(); const runeNight = glowing();
    expect(runeNoon === 0 && runeNight > 20, `glowing rune cells with the torch out: noon ${runeNoon}, midnight ${runeNight} (want none at noon)`);
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
    // By day (and at 18:30, daylight 0.5) the map's rays reach every column of the open field from its middle (24 × 24),
    // the ones that climb above the field's top included (they mark what they pass over, as the parent's did).
    const all = lit.w * lit.d;
    expect(seen.night3d <= 9 && seen.nightMap <= 9 && seen.noon3d > 100 && seen.noonMap === all && seen.duskMap === all && seen.nightTorchMap > 100 &&
           seen.nightLampMap > seen.nightMap + 100, `the auto-map's night rule: seen ${JSON.stringify(seen)} (all ${all})`);
    game.time = T(12);
    // A zone you come into at night (a load, an edge) has the night's mask before anything looks: a field made while
    // the last frame was at noon, entered at midnight, and the map looking at once (no frame between).
    zones.enterZone(game, lit, { how: "start" }); game.time = T(12); stand(10.5, 10.5); frame3d();   // the last frame: noon
    const late = field("render-late", true);
    game.time = T(24); p().torch = false; p().torchBurn = 0;
    zones.enterZone(game, late, { how: "start" });
    late.seen.fill(0); stand(10.5, 10.5); game.view = "map"; game.mode = "map";
    turns.refreshView(game);
    let lateSeen = 0; for (let i = 0; i < late.seen.length; i++) lateSeen += late.seen[i];
    expect(lateSeen <= 9, `a zone entered at midnight, the map looking before any frame: ${lateSeen} columns seen (want the 3 × 3 around you)`);
    seen.enteredAtNight = lateSeen;
    // Daylight perception (TECH_DESIGN §8.3's dependency table, "WS3 daylight perception": WS8's creatures.sees asks
    // light.inDark at your eyes): on open ground with your torch out, a goblin 0.7 of its sight away sees you at noon,
    // not at midnight (the dark takes its sight to 0.55), and does again once your torch is lit.
    if (creatures.sees) {
      zones.enterZone(game, lit, { how: "start" }); stand(10.5, 10.5);
      const range = creatures.CREATURE_TYPES.goblin.sight;
      const gob = creatures.addCreature(lit, creatures.spawnCreature("goblin", 17, 10, FLOOR_Z, { rng: () => 0.5, level: 1, state: "idle" }));
      Object.assign(gob, { x: 10.5 + 0.7 * range, y: 10.5 });
      const seesAt = (h, torch) => { game.time = T(h); p().torch = torch; p().torchBurn = 0; return creatures.sees(game, gob, p()); };
      const perceived = { noon: seesAt(12, false), midnight: seesAt(24, false), midnightTorch: seesAt(24, true), dusk: seesAt(18.5, false) };
      lit.creatures.splice(lit.creatures.indexOf(gob), 1);
      game.time = T(12); p().torch = false;
      expect(perceived.noon && !perceived.midnight && perceived.midnightTorch,
        `a goblin ${(0.7 * range).toFixed(1)} tiles off, you on open ground: sees you ${JSON.stringify(perceived)} (want at noon, not at midnight with the torch out, and with it lit)`);
      stats.perceived = perceived;
    }
    stats.dark = { plank: drawn, runeGlowCells: { noon: runeNoon, midnight: runeNight }, seen };
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
    // A wall 4 high along x = 4..16 at y = 12. At 08:00 the sun stands east-south-east: the wall's shadow falls
    // north of it; at 16:00 it stands north-north-east: the shadow falls south.
    const walled = field("render-sun", true, (z) => { for (let x = 4; x <= 16; x++) for (let k = FLOOR_Z; k < FLOOR_Z + 4; k++) z.set(x, 12, k, B.STONE); });
    const shadeOf = (h, y) => { light.bakeSun(walled, clock.lightBucketAt(minute(h))); return light.sunlitAt(walled, 10, y, FLOOR_Z - 1, 0, 0, 1, 10.5, y + 0.5, FLOOR_Z); };
    const m = { northAm: shadeOf(8, 10), southAm: shadeOf(8, 14), northPm: shadeOf(16, 10), southPm: shadeOf(16, 14), farAm: shadeOf(8, 2) };
    expect(m.northAm < 0.1 && m.southAm > 0.9 && m.northPm > 0.9 && m.southPm < 0.1 && m.farAm > 0.9, `the wall's shadow (1 = sun): ${JSON.stringify(m)}`);
    // Drawn: at 08:00 the floor north of the wall (in its shadow) is darker than south of it, seen from beyond the
    // wall's east end looking west along it.
    zones.enterZone(game, walled, { how: "start" });
    game.time = T(8); stand(22.5, 12.5, Math.PI, -0.15); p().torch = false;
    game.debug.step(0); frame3d();
    const lum = (sx, sy) => { const i = sy * capture.cols + sx; return capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2]; };
    let shadowL = 0, sunL = 0;
    const st = light.sunState(walled);
    expect(st.bucket === clock.lightBucketAt(minute(8)) && st.sun, `the bake's bucket ${st.bucket} at 08:00`);
    // Project the two floor points (x 10.5; y 10.5 in the shadow, 14.5 in the sun) to the screen.
    const cam = render3d.cam, proj = (x, y, z) => {
      const vx = x - cam.ex, vy = y - cam.ey, vz = z - cam.ez, zc = vx * cam.fX + vy * cam.fY + vz * cam.fZ;
      return [Math.round(((vx * cam.rX + vy * cam.rY) / zc / cam.halfW + 1) * 0.5 * capture.cols - 0.5),
              Math.round((1 - (vx * cam.uX + vy * cam.uY + vz * cam.uZ) / zc / cam.halfH) * 0.5 * capture.rows - 0.5)];
    };
    const [ax, ay] = proj(10.5, 10.5, FLOOR_Z), [bx, by] = proj(10.5, 14.5, FLOOR_Z);
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
    // A zone baked without its apron (as a neighbour is, ahead) is baked again once it has one: within a few frames
    // its shadows are a fresh bake's with the apron (the test world's 1,0,0 at 07:00: the sun low over its east edge).
    fresh(4242);
    game.debug.enterZone("1,0,0", "start");
    const nz = game.zone;
    for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const a = zones.neighbourAddr(game, nz, side); if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key); }
    zones.fillApron(game, nz);
    game.time = T(7);
    const bucket7 = clock.lightBucketAt(minute(7)), withApron = nz.apron;
    nz.apron = null; light.bakeSun(nz, bucket7); const bare = nz.sunlit.slice();
    nz.apron = withApron;
    let frames = 0;
    do { light.syncLight(game, nz); frames++; } while (light.sunState(nz).baking && frames < 50);
    const rebaked = nz.sunlit.slice();
    nz.apron = { ...withApron }; light.bakeSun(nz, bucket7);   // a fresh bake with the same bands
    const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
    const apronBake = { bareVsApron: differ(bare, nz.sunlit), rebakedVsApron: differ(rebaked, nz.sunlit), frames };
    expect(apronBake.bareVsApron > 0 && apronBake.rebakedVsApron === 0 && frames < 10, `the bake once the apron is there: ${JSON.stringify(apronBake)}`);
    stats.sun = { ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)])), floorShadow: shadowL, floorSun: sunL, apronBake };
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
    // The features seen on the temple span (its doors, stairs, levers, spikes) have their rows too.
    const missing = ["door", "stairs down", "lever", "spike trap"].filter((w) => !new RegExp(` ${w} *$`, "m").test(text));
    expect(!missing.length, `the outdoor legend lacks rows for what the span shows: ${missing}`);
    // Another liquid: a pool on a field, the zone's liquid named; the map and the 3D frame take its colour, under the
    // sky and underground alike; and beyond an edge (the apron) the water is the neighbour's.
    const KEY = "renderCheckBrine";
    const mapCell = () => { game.view = "map"; game.mode = "map"; renderMap.renderMap(game); S.present(); return cellOf(15, 11).rgb.join(); };
    stats.liquid = {};
    liquids.LIQUIDS[KEY] = { name: "test brine", color: [210, 60, 50] };
    try {
      for (const sky of [true, false]) {
        const pool = field(`render-pool-${sky}`, sky, (z) => { for (let y = 8; y <= 14; y++) for (let x = 12; x <= 18; x++) z.set(x, y, FLOOR_Z - 1, B.WATER_SHALLOW); });
        zones.enterZone(game, pool, { how: "start" });
        pool.seen.fill(1);
        const plain = mapCell();
        stand(10.5, 11.5, 0, -0.35); p().torch = true;
        const plain3d = frame3d();
        pool.liquid = KEY;
        const red = mapCell();
        stand(10.5, 11.5, 0, -0.35);
        const red3d = frame3d();
        expect(plain !== red && red.split(",").map(Number)[0] > 150 && plain3d !== red3d, `another liquid ${sky ? "under the sky" : "underground"}: map ${plain} → ${red}, 3D changed ${plain3d !== red3d}`);
        stats.liquid[sky ? "sky" : "underground"] = [plain, red];
      }
      fresh(4242);
      const here = game.zone, a = zones.neighbourAddr(game, here, "e"), east = zones.cachedZone(game, a.key) || zones.makeZone(game, a.key);
      const before = render3d.liquidTintAt(game, here, here.w + 3, 10);
      east.liquid = KEY;
      const after = render3d.liquidTintAt(game, here, here.w + 3, 10), inside = render3d.liquidTintAt(game, here, here.w - 3, 10);
      east.liquid = "water";
      expect(before === null && after?.join() === "210,60,50" && inside === null, `the apron's water: ${JSON.stringify({ before, after, inside })}`);
      stats.liquid.apron = after;
      // In a frame: water in the east band, the neighbour's liquid red; looked at across the edge, red cells (none plain).
      const band = here.apron.e, bn = band.bw * band.bd;
      for (let ly = 18; ly <= 30; ly++) for (let lx = 0; lx <= 8; lx++) { for (let k = 2; k < here.h; k++) band.blocks[lx + ly * band.bw + k * bn] = 0; band.blocks[lx + ly * band.bw + bn] = B.WATER_SHALLOW; }
      const ws = standNear(here, here.w - 2, 24);
      const reds = () => { Object.assign(p(), { x: ws.x + 0.5, y: ws.y + 0.5, z: ws.z, vz: 0, yaw: 0, pitch: -0.45, torch: true }); frame3d();
        let k2 = 0; for (let i = 0; i < capture.cols * capture.rows; i++) { const r = capture.colors[i * 3], g = capture.colors[i * 3 + 1], b = capture.colors[i * 3 + 2]; if (r > g + 60 && r > b + 60) k2++; } return k2; };
      game.time = T(12);
      const plainReds = reds();
      east.liquid = KEY; const apronReds = reds(); east.liquid = "water";
      expect(plainReds === 0 && apronReds > 50, `the apron's water in a frame: red cells ${apronReds} (plain water ${plainReds})`);
      stats.liquid.apronFrame = { plain: plainReds, red: apronReds };
    } finally { delete liquids.LIQUIDS[KEY]; }
    // What the map shows as floor but isn't gives nothing away by its colour: a pit not yet looked into, ghost planks
    // over a pit, planks over a pit (a bridge whose crossing isn't seen) all draw as the grass around them; a pit
    // you've looked into is a pit.
    const hidden = field("render-hidden", true, (z) => {
      for (const [x, y] of [[5, 5], [7, 5], [9, 5]]) for (let k = 0; k < FLOOR_Z; k++) z.set(x, y, k, 0);
      z.set(7, 5, FLOOR_Z - 1, B.GHOST); z.set(9, 5, FLOOR_Z - 1, B.PLANK);
    });
    zones.enterZone(game, hidden, { how: "start" });
    hidden.seen.fill(1); hidden.holeSeen.fill(0);
    stand(12.5, 12.5); p().torch = true;
    game.view = "map"; game.mode = "map"; renderMap.renderMap(game); S.present();
    const look = (x, y) => { const c = cellOf(x, y); return `${c.ch} ${c.rgb.join()}`; };
    const disguised = { grass: look(4, 5), pit: look(5, 5), ghost: look(7, 5), bridge: look(9, 5) };
    hidden.holeSeen[5 + 5 * hidden.w] = 1;
    renderMap.renderMap(game); S.present();
    disguised.pitLookedInto = look(5, 5);
    expect(disguised.pit === disguised.grass && disguised.ghost === disguised.grass && disguised.bridge === disguised.grass &&
           disguised.pitLookedInto.startsWith(":"), `the outdoor map gives away what it hides: ${JSON.stringify(disguised)}`);
    // The legend doesn't list what you haven't seen for what it is: no "chasm / pit" row until you've looked in.
    const legendText = () => Array.from({ length: capture.rows }, (_, y) => capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join("")).join("\n");
    hidden.holeSeen.fill(0); renderMap.renderMap(game); S.present();
    const pitRowUnseen = /chasm \/ pit/.test(legendText());
    hidden.holeSeen[5 + 5 * hidden.w] = 1; renderMap.renderMap(game); S.present();
    const pitRowSeen = /chasm \/ pit/.test(legendText());
    // From above, the pit is dark (it goes down a floor): rays into it leave by the bottom inside the grid.
    game.time = T(12); stand(5.5, 6.6, -Math.PI / 2, -1.3); p().torch = true; frame3d();
    let pitDark = 0; for (let i = 0; i < capture.cols * capture.rows; i++) if (capture.chars[i] === " " || capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2] < 8) pitDark++;
    expect(pitDark > 5, `looking down into a pit under the sky: ${pitDark} black cells`);
    game.view = "map"; game.mode = "map";
    expect(!pitRowUnseen && pitRowSeen, `the legend's pit row: before looking in ${pitRowUnseen}, after ${pitRowSeen}`);
    // A chasm's middle (the temple span's chasm room, 60 columns, nothing looked into) draws as the floor around it:
    // every unexplored hole looks like some true floor within 4 tiles, so the map shows neither its colour nor its shape.
    fresh(4242);
    const span = game.zone;
    span.seen.fill(1); span.holeSeen.fill(0);
    game.view = "map"; game.mode = "map"; renderMap.renderMap(game); S.present();
    const drawn = (x, y) => look(x, y), K = world.KIND;
    let holes = 0, unlike = 0;
    for (let y = 0; y < span.d; y++) for (let x = 0; x < span.w; x++) {
      if (span.kind[x + y * span.w] !== K.HOLE) continue;
      holes++;
      const near = new Set();
      for (let v = Math.max(0, y - 4); v <= Math.min(span.d - 1, y + 4); v++) for (let u = Math.max(0, x - 4); u <= Math.min(span.w - 1, x + 4); u++)
        if (span.kind[u + v * span.w] === K.FLOOR) near.add(drawn(u, v));
      if (!near.has(drawn(x, y))) unlike++;
    }
    expect(holes > 20 && unlike === 0, `unexplored holes on the temple span unlike the floor around them: ${unlike} of ${holes}`);
    // toggleMapLegend(game) judges from your zone: after an 80-wide zone's map at 160 columns (no room), in a 24-wide
    // zone (room) the legend shows, so a press hides it.
    if (m.resize) {
      m.resize(160, 56); renderMap.setMapLegendMode("auto"); renderMap.renderMap(game);
      const pressed = renderMap.toggleMapLegend({ ...game, zone: hidden });
      renderMap.setMapLegendMode("auto"); m.resize(180, 56);
      expect(pressed === false, `toggleMapLegend in a zone where the legend fits (after a map where it didn't): turned it ${pressed ? "on" : "off"}`);
      // The key (screens/play.js): on the temple span at 160 columns the legend doesn't fit, the comma shows it, again hides it.
      if (keys) {
        m.resize(160, 56); renderMap.setMapLegendMode("auto");
        game.view = "map"; game.mode = "map";
        const before = renderMap.mapLegendShown(game);
        keys.dispatchKey(game, "Comma"); const once = renderMap.mapLegendShown(game);
        renderMap.renderMap(game); S.present(); const foot = /comma: legend/.test(legendText());
        keys.dispatchKey(game, "Comma"); const twice = renderMap.mapLegendShown(game);
        renderMap.setMapLegendMode("auto"); m.resize(180, 56);
        expect(!before && once && !twice && foot, `the comma on the map at 160 columns: the legend ${before} → ${once} → ${twice}, its foot names it ${foot}`);
      }
    }
    stats.map = { road: rc, grass: gc, legend: "glim", disguised, chasm: { holes, unlike }, pitRow: { unseen: pitRowUnseen, seen: pitRowSeen }, pitDark };
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
    // Voices (sfx.js, TECH_DESIGN §1.2): a voice object plays as given, a parent's person by id, anything else neutrally.
    const sfx = m.sfx, v = { maren: sfx.voiceOf("maren"), stranger: sfx.voiceOf("someoneNew"), object: sfx.voiceOf({ pitch: 410, wave: "square", thin: true }),
      partial: sfx.voiceOf({ wave: "sine" }), proto: sfx.voiceOf("toString"), none: sfx.voiceOf(null),
      noWave: sfx.voiceOf({ pitch: 300, wave: undefined }), endless: sfx.voiceOf({ pitch: Infinity }), inherited: sfx.voiceOf(Object.create({ pitch: 600 })), badWave: sfx.voiceOf({ wave: "noise" }) };
    const N = sfx.NEUTRAL_VOICE;
    expect(v.maren.pitch === 255 && v.stranger === N && v.object.pitch === 410 && v.object.thin === true && v.partial.pitch === N.pitch &&
           v.partial.wave === "sine" && v.proto === N && v.none === N && v.noWave.wave === N.wave && v.noWave.pitch === 300 && v.endless.pitch === N.pitch &&
           v.inherited.pitch === N.pitch && v.badWave.wave === N.wave, `voices: ${JSON.stringify(v)}`);
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

  // --- 11. The Gnomon on the horizon --------------------------------------------------------------------------
  {
    // A view of the Gnomon: at span `key`, from (x, y) (default: the floor nearest the middle), facing its foot, at hour
    // h; build(zone) may add blocks first. → { drawn, needle (dark "|" cells in the middle columns), tip, lowest }
    const view = (key, h, { away = false, at = null, pitch = 0.15, build = null, high = false } = {}) => {
      fresh(4242, worldmap.REAL_WORLD);
      if (key !== game.zone.key) game.debug.enterZone(key, "start");
      const z = game.zone, g = game.run.world.landmarks.get("gnomon");
      for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const a = zones.neighbourAddr(game, z, side); if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key); }
      zones.fillApron(game, z);
      let s = at ? { x: at[0], y: at[1], z: z.stand[at[0] + at[1] * z.w] } : standNear(z, z.w >> 1, z.d >> 1);
      if (high) { let best = null; for (let i = 0; i < z.w * z.d; i++) if (z.stand[i] >= 0 && (!best || z.stand[i] > best.z)) best = { x: i % z.w, y: Math.floor(i / z.w), z: z.stand[i] }; s = best; }
      build?.(z, s);
      const gx = (g.wx - z.wx) * z.w + z.w / 2, gy = (g.wy - z.wy) * z.d + z.d / 2, yaw = Math.atan2(gy - s.y - 0.5, gx - s.x - 0.5) + (away ? Math.PI : 0);
      game.time = T(h);
      Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw, pitch, torch: false });
      frame3d();
      const mid = capture.cols >> 1, out = { drawn: render3d.gnomonDrawn(), needle: 0, tip: null, lowest: -1, standZ: s.z };
      for (let y = 0; y < capture.rows; y++) for (let x = mid - 3; x <= mid + 3; x++) {
        const i = y * capture.cols + x, ch = capture.chars[i], r = capture.colors[i * 3], gg = capture.colors[i * 3 + 1], b = capture.colors[i * 3 + 2];
        if (ch === "|" && r + gg + b < 250) { out.needle++; out.lowest = Math.max(out.lowest, y); }
        if (ch === "*" && r > 150 && gg < 140 && b > 220) out.tip = "violet";
        // The glint: a warm "*" (it pulses: 255, 245, 200 at full; a cloud's is cool) right above the needle.
        else if (ch === "*" && !out.tip && r > 100 && r > b + 25 && y + 1 < capture.rows && capture.chars[i + capture.cols] === "|") out.tip = "glint";
      }
      // In its own span its foot is the top of what stands at the middle (WS2b's 14-block column): the row that top
      // projects to, and the needle's cells more than a row below it within 40 columns of the middle (beside the foot).
      if (g.wx === z.wx && g.wy === z.wy) {
        out.footZ = FLOOR_Z;
        for (let k = z.h - 1; k >= 0; k--) if (z.get(Math.floor(gx), Math.floor(gy), k)) { out.footZ = Math.max(FLOOR_Z, k + 1); break; }
        const c = render3d.cam, vx = gx - c.ex, vy = gy - c.ey, vz = out.footZ - c.ez, zc = vx * c.fX + vy * c.fY + vz * c.fZ;
        out.footRow = zc > 0 ? Math.round((1 - (vx * c.uX + vy * c.uY + vz * c.uZ) / zc / c.halfH) * 0.5 * capture.rows * 10) / 10 : null;
        out.besideBelow = 0;
        for (let y = Math.max(0, Math.floor(out.footRow ?? capture.rows) + 2); y < capture.rows; y++) for (let x = mid - 40; x <= mid + 40; x++) {
          const i = y * capture.cols + x;
          if (capture.chars[i] === "|" && capture.colors[i * 3] + capture.colors[i * 3 + 1] + capture.colors[i * 3 + 2] < 250) out.besideBelow++;
        }
      }
      return out;
    };
    // The span of the Shade farthest from the Gnomon (from close by its tip is far above the screen), and a Rust Steps
    // span with a mesa (standable ground GNOMON.mesaHeight above the datum).
    fresh(4242, worldmap.REAL_WORLD);
    const W = game.run.world, gnom = W.landmarks.get("gnomon");
    let shadeKey = null, shadeD = -1;
    const steps = [];
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const t = W.tileAt(x, y), d = Math.hypot(x - gnom.wx, y - gnom.wy);
      if (!t || t.travel === "no" || t.landmark) continue;
      if (t.terrain === "shade" && d > shadeD) { shadeKey = `${x},${y},0`; shadeD = d; }
      if (t.terrain === render3d.GNOMON.steps && x >= 9 && steps.length < 6) steps.push(`${x},${y},0`);
    }
    const wall = (z, s) => {   // a tall wall 3 tiles ahead of you, toward the Gnomon, across the middle of the view
      const yaw = Math.atan2((gnom.wy - z.wy) * z.d + z.d / 2 - s.y, (gnom.wx - z.wx) * z.w + z.w / 2 - s.x);
      const cx = Math.round(s.x + 0.5 + Math.cos(yaw) * 3), cy = Math.round(s.y + 0.5 + Math.sin(yaw) * 3);
      for (let k = -2; k <= 2; k++) for (let zz = FLOOR_Z; zz < z.h; zz++) z.set(cx - Math.round(Math.sin(yaw) * k), cy + Math.round(Math.cos(yaw) * k), zz, B.STONE);
      z.refresh();
    };
    // (Hollowmere's middle is the Temple of Angles' roofed hall since C1a's plan: you stand in the village's lane by the
    // east edge, where the Old Rule comes in, with nothing between you and the Gnomon.)
    const lane = [76, 14];
    const gn = { noon: view("5,16,0", 12, { at: lane }), morning: view("5,16,0", 9, { at: lane }), away: view("5,16,0", 12, { away: true, at: lane }),
      behindWall: view("5,16,0", 12, { build: wall, at: lane }), night: view("5,16,0", 23, { at: lane }), shadeNight: view(shadeKey, 23), shadeNoon: view(shadeKey, 12) };
    // A mesa: the first Rust Steps span with ground 4 above the datum; at night from on it, and from its foot.
    for (const key of steps) {
      const hi = view(key, 23, { high: true });
      if (hi.standZ < FLOOR_Z + render3d.GNOMON.mesaHeight) continue;
      gn.mesaTop = hi; gn.mesaFoot = view(key, 23); gn.mesaKey = key;
      break;
    }
    // The light's rule itself (the mesa's foot can't see the Gnomon past the mesas, so a frame can't tell):
    const lightAt = (key, h, z) => { fresh(4242, worldmap.REAL_WORLD); if (key !== game.zone.key) game.debug.enterZone(key, "start"); game.time = T(h); p().z = z; return render3d.gnomonLightSeen(game); };
    gn.lightRule = gn.mesaKey && { mesaTop: lightAt(gn.mesaKey, 23, FLOOR_Z + 6), mesaFoot: lightAt(gn.mesaKey, 23, FLOOR_Z + 1), shade: lightAt(shadeKey, 23, FLOOR_Z),
      shadeDay: lightAt(shadeKey, 12, FLOOR_Z), flats: lightAt("5,16,0", 23, FLOOR_Z + 6) };
    // In its own span: from under its leaning tip, facing its foot at pitch 0, it is cut where it passes behind you,
    // not lost; from 15 tiles off, looking up at its 14-block voxel foot (WS2b's, since the WS2b merge; until then the
    // needle rose from the ground), it rises from the foot's top: not from the ground beside it, not hanging in the sky.
    gn.underTip = view(`${gnom.wx},${gnom.wy},0`, 12, { at: [7, 39], pitch: 0 });
    gn.ownSpan = view(`${gnom.wx},${gnom.wy},0`, 12, { at: [25, 24], pitch: 0.7 });
    fresh(4242); game.time = T(12); frame3d(); gn.testWorld = render3d.gnomonDrawn();
    zones.changeZone(game, "0,0,3", { how: "down", rng: Math.random }); frame3d(); gn.underground = render3d.gnomonDrawn();
    expect(gn.noon.drawn && gn.noon.needle >= 8 && gn.noon.tip === "glint" && gn.morning.needle >= 8 && gn.morning.tip !== "glint" && !gn.away.drawn &&
           gn.behindWall.needle === 0 && !gn.night.drawn && gn.shadeNight.tip === "violet" && gn.shadeNoon.tip !== "violet" &&
           gn.mesaTop?.tip === "violet" && !gn.mesaFoot?.drawn && gn.lightRule?.mesaTop && !gn.lightRule.mesaFoot && gn.lightRule.shade &&
           !gn.lightRule.shadeDay && !gn.lightRule.flats && gn.underTip.drawn && gn.ownSpan.drawn && gn.ownSpan.footZ === FLOOR_Z + 14 &&
           Math.abs(gn.ownSpan.lowest - gn.ownSpan.footRow) <= 1 && gn.ownSpan.besideBelow === 0 &&
           !gn.testWorld && !gn.underground, `the Gnomon on the horizon: ${JSON.stringify(gn)} (the Shade's span ${shadeKey})`);
    stats.gnomon = gn;
  }

  // --- 16. The regions' skies, landmarks on the horizon, Folio (B2: C1a #5, C1b #14, #25) -------------------------
  {
    fresh(4242, worldmap.REAL_WORLD);
    const Wd = game.run.world, find = (ok) => { for (let y = 0; y < Wd.h; y++) for (let x = 0; x < Wd.w; x++) { const t = Wd.tileAt(x, y); if (t && t.travel === "yes" && !t.landmark && ok(t, x, y)) return `${x},${y},0`; } return null; };
    const sky = (t) => Wd.regions[t.region]?.sky;
    const glareKey = find((t) => sky(t) === "glare"), canopyKey = find((t) => sky(t) === "canopy"), clearKey = find((t) => sky(t) === "clear");
    const out = {};
    // A frame facing east from the zone's middle at hour h, with a wall 2 blocks high `ahead` tiles in front of you (none: 0).
    const look = (key, h, ahead = 0) => {
      fresh(4242, worldmap.REAL_WORLD);
      game.debug.enterZone(key, "start");
      const z = game.zone, s = standNear(z, z.w >> 1, z.d >> 1);
      if (ahead) { for (let k = -3; k <= 3; k++) for (let zz = s.z; zz < s.z + 2; zz++) z.set(s.x + ahead, s.y + k, zz, B.STONE); z.refresh(); }   // (2 high: its noon shadow stays at its foot)
      game.time = T(h);
      Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw: 0, pitch: 0, torch: false });
      return { hash: frame3d(), look: render3d.lookState() };
    };
    // The glare (C1a #5): from 11:00 to 13:00 on a glare span the view stops at SKY_LOOKS.glare.dist tiles, bleached; a wall
    // beyond it doesn't change the frame at noon and does at 10:00; one inside it does at noon.
    const G = render3d.SKY_LOOKS.glare.dist;
    const noon = look(glareKey, 12), ten = look(glareKey, 10), far12 = look(glareKey, 12, G + 3), far10 = look(glareKey, 10, G + 3), near12 = look(glareKey, 12, G - 3);
    out.glare = { key: glareKey, noon: noon.look.glare && noon.look.maxDist === G, ten: !ten.look.glare && ten.look.maxDist > G, farHidden: far12.hash === noon.hash,
      farAt10: far10.hash !== ten.hash, nearShown: near12.hash !== noon.hash, bleached: noon.look.fog.every((c) => c > 200) };
    // The canopy: dimmer under the Pleat's leaves than an open sky at the same hour, its haze green.
    const can = look(canopyKey, 12).look, clr = look(clearKey, 12).look;
    out.canopy = { key: canopyKey, light: +(can.daylight / clr.daylight).toFixed(2), fog: can.fog.map(Math.round), sky: can.sky, clear: clr.sky };
    expect(Object.values(out.glare).every((v) => v === true || typeof v === "string") && out.canopy.light < 0.8 && can.fog[1] > can.fog[0] && can.fog[1] > can.fog[2] && !clr.glare && clr.maxDist > G,
      `the regions' skies: ${JSON.stringify(out)}`);
    // Landmarks on the horizon (C1b #14): from two spans off, by day, facing it: its silhouette over the sky; facing away,
    // at night, from its own span and from beyond its visibleFrom, none.
    const far = (id, key, h, { away = false, wall = false } = {}) => {
      fresh(4242, worldmap.REAL_WORLD);
      game.debug.enterZone(key, "start");
      const z = game.zone, L = game.run.world.landmarks.get(id), plan = game.run.world.plans[L.plan];
      let s = null;   // the highest ground at least 8 tiles in from the edges (the wall below stays in the zone)
      for (let i = 0; i < z.w * z.d; i++) { const x = i % z.w, y = Math.floor(i / z.w); if (x >= 8 && y >= 8 && x < z.w - 8 && y < z.d - 8 && z.stand[i] >= 0 && (!s || z.stand[i] > s.z)) s = { x, y, z: z.stand[i] }; }
      const gx = (L.wx - z.wx) * z.w + L.anchor[0] + plan.rows[0].length / 2, gy = (L.wy - z.wy) * z.d + L.anchor[1] + plan.rows.length / 2;
      const yaw = Math.atan2(gy - s.y - 0.5, gx - s.x - 0.5) + (away ? Math.PI : 0);
      if (wall) {   // a tall wall 3 tiles ahead, across the whole view
        const cx = Math.round(s.x + 0.5 + Math.cos(yaw) * 3), cy = Math.round(s.y + 0.5 + Math.sin(yaw) * 3);
        for (let k = -6; k <= 6; k++) for (let zz = 0; zz < z.h; zz++) z.set(cx - Math.round(Math.sin(yaw) * k), cy + Math.round(Math.cos(yaw) * k), zz, B.STONE);
        z.refresh();
      }
      game.time = T(h);
      Object.assign(p(), { x: s.x + 0.5, y: s.y + 0.5, z: s.z, vz: 0, yaw, pitch: 0.1, torch: false });
      frame3d();
      return render3d.farDrawn().includes(id);
    };
    const near2 = (id) => { const L = Wd.landmarks.get(id); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2]]) { const t = Wd.tileAt(L.wx + dx, L.wy + dy); if (t && t.travel === "yes" && !t.landmark) return `${L.wx + dx},${L.wy + dy},0`; } return null; };
    out.billboards = {};
    for (const id of Object.keys(render3d.FAR_BILLBOARDS)) {
      const L = Wd.landmarks.get(id), key = near2(id), farKey = find((t, x, y) => Math.max(Math.abs(x - L.wx), Math.abs(y - L.wy)) === L.visibleFrom + 2);
      out.billboards[id] = { key, day: far(id, key, 12), away: far(id, key, 12, { away: true }), night: far(id, key, 23), own: far(id, `${L.wx},${L.wy},0`, 12), beyond: farKey && far(id, farKey, 12),
        behindWall: far(id, key, 12, { wall: true }) };
      const b = out.billboards[id];
      expect(b.day && !b.away && !b.night && !b.own && !b.beyond && !b.behindWall, `${id} on the horizon: ${JSON.stringify(b)}`);
    }
    // Folio's shadows (C1b #25): in 3D on its span many slide over the paving, a frame two seconds on differs; none on the
    // map; and its scratching comes every 0.4-1.3 s in 3D there, never on the map or elsewhere.
    fresh(4242, worldmap.REAL_WORLD);
    const folio = Wd.landmarks.get("folio");
    game.debug.enterZone(`${folio.wx},${folio.wy},0`, "start");
    const fz = game.zone, pa = fz.gen.planAt, fs = standNear(fz, pa.x + (pa.w >> 1), pa.y + (pa.d >> 1));
    game.time = T(12);
    Object.assign(p(), { x: fs.x + 0.5, y: fs.y + 0.5, z: fs.z, vz: 0, yaw: 0, pitch: -0.5, torch: true });
    const h1 = frame3d(), n1 = render3d.folioShadowsDrawn();
    game.time += 2;
    const h2 = frame3d();
    const count = render3d.FOLIO_SHADOWS.count;
    render3d.FOLIO_SHADOWS.count = 0; const h0 = frame3d(); render3d.FOLIO_SHADOWS.count = count;
    game.view = "map"; render3d.render3d(game); const nMap = render3d.folioShadowsDrawn();
    const scratches = (view, key) => { if (key !== game.zone.key) game.debug.enterZone(key, "start"); game.view = view; let n = 0; const t0 = game.time; for (let k = 0; k < 400; k++) { game.time = t0 + k * 0.05; if (music.folioScratchDue(game)) n++; } return n; };
    out.folio = { shadows: n1, slide: h1 !== h2, drawn: h1 !== h0, onMap: nMap, scratch3d: scratches("3d", fz.key), scratchMap: scratches("map", fz.key), scratchElsewhere: scratches("3d", clearKey) };
    expect(n1 >= 20 && out.folio.slide && out.folio.drawn && nMap === 0 && out.folio.scratch3d >= 20 / 1.3 - 1 && out.folio.scratch3d <= 20 / 0.4 && !out.folio.scratchMap && !out.folio.scratchElsewhere,
      `Folio in 3D: ${JSON.stringify(out.folio)}`);
    // The Tall Table's nests on the map (C1b #13): every perch the map draws as wall still shows its nest, and the inspect
    // line names it without a height; a plain prop on a wall tile still doesn't.
    {
      const tt = Wd.landmarks.get("tallTable");
      fresh(4242, worldmap.REAL_WORLD);
      game.debug.enterZone(`${tt.wx},${tt.wy},0`, "start");
      const z = game.zone;
      z.seen.fill(1);
      game.view = "map"; game.mode = "map"; renderMap.mapView.top = 2; renderMap.mapView.panX = renderMap.mapView.panY = 0;
      const nests = z.perches || [];
      let shown = 0, said = 0, onWall = 0, visible = 0;
      for (const pc of nests) {
        if (z.kind[pc.x + pc.y * z.w] === world.KIND.WALL) onWall++;
        p().x = pc.x + 0.5; p().y = pc.y + 3.5;   // (the map centres on you: the perch in view)
        renderMap.renderMap(game); S.present();
        const mv = renderMap.mapView, sx = (pc.x - mv.tx0) * 2, sy = mv.top + pc.y - mv.ty0;
        if (sx < 0 || sy < 0 || sx >= capture.cols || sy >= capture.rows) continue;
        visible++;
        if (capture.chars[sy * capture.cols + sx] === "°") shown++;
        const d = renderMap.describeTile(game, { x: pc.x, y: pc.y });
        if (/nest/i.test(d) && !/\d+ (blocks|up)|high/i.test(d)) said++;
      }
      // A prop of another kind on the same wall tile (a bone, say) stays 3D's.
      const pc = nests.find((q) => z.kind[q.x + q.y * z.w] === world.KIND.WALL), plain = Object.keys(m.biomes.PROPS).find((k) => !m.biomes.PROPS[k].overWall);
      z.props = z.props.filter((pr) => !(Math.floor(pr.x) === pc.x && Math.floor(pr.y) === pc.y));
      z.props.push({ x: pc.x + 0.5, y: pc.y + 0.5, z: pc.z, kind: plain });
      p().x = pc.x + 0.5; p().y = pc.y + 3.5;
      renderMap.renderMap(game); S.present();
      const mv = renderMap.mapView, plainCh = capture.chars[(mv.top + pc.y - mv.ty0) * capture.cols + (pc.x - mv.tx0) * 2];
      out.nests = { perches: nests.length, onWall, visible, shown, said, plainOnWall: plainCh === m.biomes.PROPS[plain].glyph };
      expect(nests.length >= 3 && onWall > 0 && visible === nests.length && shown === nests.length && said === nests.length && !out.nests.plainOnWall, `the Tall Table's nests on the map: ${JSON.stringify(out.nests)}`);
    }
    game.view = "3d";
    stats.skies = out;
  }

  // --- 12. A dormant zone frees its arrays (only with --expose-gc: tools/check-perf.mjs runs this check so) ----------
  if (typeof globalThis.gc === "function") {
    fresh(4242);
    const z0 = game.zone;
    for (const side of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const a = zones.neighbourAddr(game, z0, side); if (a && !zones.cachedZone(game, a.key)) zones.makeZone(game, a.key); }
    zones.fillApron(game, z0);
    game.time = T(12); stand(z0.spawn.x, z0.spawn.y); frame3d();
    renderMap.renderMap(game);
    const refs = { skyLight: new WeakRef(z0.skyLight), litMask: new WeakRef(z0.litMask), lampLight: new WeakRef(z0.lampLight), sunlit: new WeakRef(z0.sunlit),
      apronE: new WeakRef(z0.apron.e.blocks) };
    game.debug.enterZone("1,0,0", "start"); stand(game.zone.spawn.x, game.zone.spawn.y); frame3d();
    z0.dropDerived();
    for (let k = 0; k < 4; k++) { await new Promise((r) => setTimeout(r, 0)); globalThis.gc(); }
    const kept = Object.entries(refs).filter(([, r]) => r.deref()).map(([k]) => k);
    expect(!kept.length, `a dormant zone's arrays still reachable after dropDerived and gc: ${kept}`);
    stats.memory = { freed: Object.keys(refs).length - kept.length, kept };
  } else stats.memory = "not checked here (no --expose-gc; tools/check-perf.mjs runs this check with it)";

  // --- 13. Every creature is drawn, whatever its attitude -----------------------------------------------------------
  {
    fresh(4242);
    game.time = T(12);
    const zc = game.zone;
    // A straight run of four tiles at one height: you on the first, the beast on the last, facing it (east).
    let spot = null;
    for (let y = 2; y < zc.d - 2 && !spot; y++) for (let x = 2; x < zc.w - 6 && !spot; x++) {
      const z = zc.stand[x + y * zc.w];
      if (z >= 0 && [1, 2, 3].every((k) => zc.stand[x + k + y * zc.w] === z)) spot = { x, y, z };
    }
    let seen = null;
    if (expect(spot, "a straight run of four tiles on the start span")) {
      const mon = creatures.spawnCreature("goblin", spot.x + 3, spot.y, spot.z, { rng: () => 0.5 }), was = { brain: mon.brain, vis: mon.vis };
      stand(spot.x + 0.5, spot.y + 0.5, 0, -0.15); Object.assign(p(), { z: spot.z, torch: false });
      const others = zc.creatures.filter((c) => c !== mon);
      const shot = (who) => { zc.creatures.splice(0, zc.creatures.length, ...who); return frame3d(); };
      const hostile = shot([...others, mon]), gone = shot(others);
      mon.brain = { ...(was.brain || {}), leader: "player" };
      const follower = shot([...others, mon]);
      mon.vis = { ...was.vis, flat: true };
      const flatFollower = shot([...others, mon]), flatGone = shot(others);
      Object.assign(mon, was); zc.creatures.splice(0, zc.creatures.length, ...others);
      seen = { inView: hostile !== gone, follower: follower !== gone, flatFollowerShadow: flatFollower !== flatGone };
      expect(seen.inView && seen.follower && seen.flatFollowerShadow, `a beast drawn whatever its attitude: ${JSON.stringify(seen)}`);
    }
    stats.creatures = seen;
  }

  // --- 14. The dressing's props (WS2b's zone.props, drawn since the WS2b merge) ---------------------------------------
  {
    fresh(4242);
    game.time = T(12);
    const PR = m.biomes?.PROPS;
    // A span near the start with a prop three tiles east of a straight run at its height (nothing standing on it).
    let zp = null, pick = null;
    for (const key of ["0,0,0", "1,0,0", "0,1,0", "1,1,0", "2,0,0", "0,2,0", "2,1,0", "1,2,0", "2,2,0", "3,0,0", "3,1,0", "0,3,0"]) {
      if (key !== game.zone.key) game.debug.enterZone(key, "start");
      const z = game.zone;
      pick = (z.props || []).find((pr) => {
        const x = Math.floor(pr.x), y = Math.floor(pr.y), h = z.stand[x + y * z.w];
        return h >= 0 && x >= 4 && [1, 2, 3].every((k) => z.stand[x - k + y * z.w] === h) && !z.creatures.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y);
      });
      if (pick) { zp = z; break; }
    }
    if (expect(zp && PR, `a prop with a straight run west of it on the start's spans (${PR ? "none found" : "no PROPS"})`)) {
      // The map: every prop on a seen tile the map doesn't draw as wall shows its glyph, unless an item, a creature or you
      // stand on it; a cliff top's don't.
      zp.seen.fill(1); game.view = "map"; game.mode = "map"; game.paused = false;
      Object.assign(p(), { x: zp.spawn.x, y: zp.spawn.y });
      renderMap.mapView.top = 2; renderMap.renderMap(game); S.present();
      const mv = renderMap.mapView, covered = (x, y) => zp.items.some((it) => Math.floor(it.x) === x && Math.floor(it.y) === y)
        || zp.creatures.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y) || (Math.floor(p().x) === x && Math.floor(p().y) === y)
        || zp.markers.some((mk) => mk.x === x && mk.y === y);
      let shown = 0, want = 0, onWall = 0, wallDrawn = 0;
      for (const pr of zp.props) {
        const x = Math.floor(pr.x), y = Math.floor(pr.y), sx = (x - mv.tx0) * 2, sy = mv.top + y - mv.ty0;
        if (sx < 0 || sx >= capture.cols || sy < mv.top || sy >= capture.rows - 1 || covered(x, y)) continue;
        const ch = capture.chars[sy * capture.cols + sx];
        if (zp.kind[x + y * zp.w] === world.KIND.WALL) { onWall++; if (ch === PR[pr.kind].glyph) wallDrawn++; continue; }
        want++; if (ch === PR[pr.kind].glyph) shown++;
      }
      expect(want > 0 && shown === want && wallDrawn === 0, `props on the map: ${shown} of ${want} shown, ${wallDrawn} of ${onWall} on wall tiles drawn`);
      // 3D: three tiles west of the prop facing it at noon, the frame differs with the props and without, only locally.
      const x = Math.floor(pick.x), y = Math.floor(pick.y);
      stand(x - 3 + 0.5, y + 0.5, 0, -0.25); Object.assign(p(), { z: zp.stand[x + y * zp.w] });
      const shot = () => { frame3d(); return { chars: capture.chars.slice(), colors: capture.colors.slice() }; };
      const withProps = shot(), keep = zp.props;
      zp.props = [];
      const without = shot();
      zp.props = keep;
      let changed = 0;
      for (let i = 0; i < capture.cols * capture.rows; i++)
        if (withProps.chars[i] !== without.chars[i] || [0, 1, 2].some((k) => withProps.colors[i * 3 + k] !== without.colors[i * 3 + k])) changed++;
      expect(changed > 0 && changed < 0.05 * capture.cols * capture.rows, `a ${pick.kind} three tiles ahead in 3D: ${changed} cells change with the props drawn`);
      stats.props = { zone: zp.key, props: zp.props.length, map: `${shown} of ${want} shown, ${onWall} on wall tiles not drawn`, ahead: pick.kind, cells3d: changed };
    }
  }

  // --- 15. The held weapon by the hour (WS3 #7, at the WS9 merge) ------------------------------------------------------
  if (m.hud?.heldLight) {
    fresh(4242);
    const z = game.zone, out = {};
    let spot = null;   // a floor under open sky (the start span's temple is roofed)
    for (let i = 0; i < z.w * z.d && !spot && z.skyLight; i++) {
      const x = i % z.w, y = Math.floor(i / z.w), h = z.stand[i];
      if (h >= 0 && light.sampleLight(z, z.skyLight, x + 0.5, y + 0.5, h + 1.2) > 0.8) spot = { x, y, h };
    }
    if (expect(spot, "a floor under open sky on the start span")) {
      Object.assign(p(), { x: spot.x + 0.5, y: spot.y + 0.5, z: spot.h, torch: false });
      game.time = T(12); out.noon = m.hud.heldLight(game);
      game.time = T(24); out.midnight = m.hud.heldLight(game);
      zones.changeZone(game, "0,0,3", { how: "down", rng: Math.random }); p().torch = false;
      game.time = T(12); out.underNoon = m.hud.heldLight(game);
      game.time = T(24); out.underMidnight = m.hud.heldLight(game);
      expect(out.midnight < out.noon - 0.1 && out.underNoon === out.underMidnight, `the held weapon's light by the hour: ${JSON.stringify(out)}`);
    }
    stats.heldLight = out;
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
  const [g, clock, light, raycast, render3d, renderMap, zones, turns, world, rules, music, moods, liquids, worldmap, sfx, creatures, keys, biomes, hud] = await Promise.all(
    ["game.js", "clock.js", "light.js", "raycast.js", "render3d.js", "renderMap.js", "zones.js", "turns.js", "world.js", "rules.js", "music.js",
     "content/moods.js", "content/liquids.js", "content/world/worldmap.js", "sfx.js", "creatures.js", "keys.js", "content/biomes.js", "hud.js"].map(load));
  const fixtures = { frames: await env.json("tests/fixtures/golden/frames.json") };
  const { currentApi } = await import("../golden/current-api.js");
  const S = await load("screen.js");
  const result = await checkRender({ game: g.game, startRun: g.startRun, S, capture: scr.capture, frameHash: scr.frameHash, clock, light, raycast,
    render3d, renderMap, zones, turns, world, rules, music, moods, liquids, worldmap, creatures, keys, biomes, hud, golden: null, seedRandom: env.seedRandom, resize: scr.resize, sfx });
  // Golden (b) last: its api reseeds Math.random and replaces the run.
  const api = await currentApi({ load, capture: scr.capture, frameHash: scr.frameHash }, env.seedRandom);
  const gold = checkGolden(api, fixtures, { only: ["frames"] });
  if (!gold.ok) { result.ok = false; result.problems.push(`golden (b) frames: ${gold.problems.slice(0, 3).join("; ")}`); }
  result.stats.golden = gold.stats.frames;
  return result;
}
