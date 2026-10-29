// C3 in headless Chromium, on the real world (the browser game's default: Hollowmere), with real key presses (not a
// check-*: it needs Playwright). Beside you: a clatterer and lantern moths (the real world's new kinds), a saltrat
// pinned in place, a smoother (flat) and a drowned keeper (a ghost). On the map: the look (L) and its examine screen on
// the saltrat and the clatterer, each with its bestiary Deep line and its attitude; the smoother drawn as `o`. In 3D:
// the clatterer drawn and examined the same way, the smoother only a shadow (no sprite), the drowned keeper unseen with
// your torch lit and seen at night with it out. Screenshots of each with --shots.
//   node tools/serve.mjs 8676 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-c3.mjs [--port 8676] [--seed 4242] [--shots DIR]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a zero-gain
// node, and the page is opened with ?silent=1: nothing reaches the speakers. Fails on any console error or warning.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./node-env.mjs";
const args = parseArgs();
const port = Number(args.port || 8676), seed = Number(args.seed || 4242), shots = args.shots ? String(args.shots) : null;
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const problems = [], log = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    const orig = AudioNode.prototype.connect, sinks = new WeakMap();
    window.__audio = { rerouted: 0 };
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        let s = sinks.get(dest);
        if (!s) {
          const ctx = dest.context, an = ctx.createAnalyser(), mute = ctx.createGain();
          mute.gain.value = 0;
          orig.call(an, mute); orig.call(mute, dest);
          s = an; sinks.set(dest, s);
        }
        window.__audio.rerouted++;
        return orig.call(this, s, ...rest);
      }
      return orig.call(this, dest, ...rest);
    };
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&seed=${seed}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
  await page.evaluate(async () => {   // keep the last presented frame's characters, to read
    const { canvasBackend } = await import("/src/screen-canvas.js");
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
  });
  const mode = () => page.evaluate(() => window.game.mode);
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const expect = (ok, what) => { log.push(`${ok ? "ok" : "FAIL"}: ${what}`); if (!ok) problems.push(what); };
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await frames(2); };
  const screenText = async () => { await frames(2); return page.evaluate(() => window.__frame.chars.join("")); };
  // What the examine screen shows: its subject's lines (examineLines), and whether the screen holds the given one.
  const examined = async (want) => {
    const ex = await page.evaluate(async () => {
      const { modeData } = await import("/src/screens.js"), E = await import("/src/screens/examine.js"), g = window.game, d = modeData(g) || {};
      const subj = (d.subjects || E.examineSubjects(d))[d.k || 0];
      return { type: subj?.creature?.type || null, lines: subj ? E.examineLines(g, subj).map((l) => l.text) : [] };
    });
    const t = await screenText();
    return { ...ex, shown: !!want && t.includes(want) };
  };
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  for (let k = 0; k < 12 && (await mode()) === "story"; k++) await key("Space");
  await page.evaluate(() => { window.game.story.cube = true; });   // Tab works once the cube is touched (the checks set it so)
  if ((await mode()) === "explore") await key("Tab");
  const where = await page.evaluate(() => { const g = window.game, t = g.run.world.tileAt(5, 16); return { world: g.run.world.id, region: t.region, landmark: t.landmark?.id || t.landmark, zone: g.zone.key, mode: g.mode }; });
  expect(where.world !== "test" && where.region === "flats" && where.zone === "5,16,0" && where.mode === "map", `a new game on the real world, at Hollowmere, on the map (${JSON.stringify(where)})`);

  // Out of the temple (you wake in your room) onto open ground in the village: the first tile east of the temple with
  // 6 tiles of level, open ground every way (nothing in the line of sight). Then the cast, on free ground 3-8 tiles from
  // you (all but the moths pinned, so they hold still).
  const placed = await page.evaluate(async () => {
    const C = await import("/src/creatures.js"), T = await import("/src/turns.js");
    const g = window.game, z = g.zone, p = g.player, out = {};
    const level = (x, y, h) => x >= 0 && y >= 0 && x < z.w && y < z.d && z.stand[x + y * z.w] === h;
    let spot = null;
    for (let x = 50; x < z.w - 8 && !spot; x++)
      for (let y = 8; y < z.d - 8 && !spot; y++) {
        const h = z.stand[x + y * z.w];
        if (h < 0) continue;
        let open = true;
        for (let dy = -6; dy <= 6 && open; dy++) for (let dx = -6; dx <= 6 && open; dx++) open = level(x + dx, y + dy, h) && !C.creatureAt(z, x + dx, y + dy);
        if (open) spot = [x, y, h];
      }
    if (!spot) return { error: "no open ground" };
    Object.assign(p, { x: spot[0] + 0.5, y: spot[1] + 0.5, z: spot[2], vz: 0 });
    const px = spot[0], py = spot[1];
    const free = (x, y) => x > 1 && y > 1 && x < z.w - 2 && y < z.d - 2 && z.stand[x + y * z.w] >= 0 && Math.abs(z.stand[x + y * z.w] - p.z) < 1 && !C.creatureAt(z, x, y);
    const spots = [];
    for (let r = 3; r <= 8 && spots.length < 5; r++)
      for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]])
        if (spots.length < 5 && free(px + dx, py + dy) && !spots.some(([a, b]) => Math.abs(a - px - dx) + Math.abs(b - py - dy) < 2)) spots.push([px + dx, py + dy]);
    ["saltrat", "clatterer", "lanternMoths", "smoother", "drownedKeeper"].forEach((type, k) => {
      const [x, y] = spots[k];
      const c = C.addCreature(z, C.spawnCreature(type, x, y, z.stand[x + y * z.w], { rng: Math.random, level: 2, state: "idle" }));
      if (type !== "lanternMoths") c.status.pinned = { t: 1e9, mag: 1, src: null, acc: 0 };   // (they hold still to be looked at)
      out[type] = { id: c.id, x, y };
    });
    T.refreshView(g);
    return out;
  });
  expect(Object.keys(placed).length === 5 && !placed.error, `five creatures placed beside you (${Object.keys(placed).join(", ")})`);
  await frames(4);
  // The map's cells at the pinned three (renderMap.js tileAtCell's inverse: a tile is TILE_W cells wide from the view's
  // corner, its glyph in the first or second).
  const cells = await page.evaluate(async (placed) => {
    const { mapView, tileAtCell } = await import("/src/renderMap.js"), F = window.__frame, out = {};
    let tw = 1;
    while (tw < 4 && tileAtCell({ x: tw, y: mapView.top }).x === mapView.tx0) tw++;
    for (const id of ["smoother", "clatterer", "saltrat"]) {
      const { x, y } = placed[id], cx = (x - mapView.tx0) * tw, cy = mapView.top + y - mapView.ty0;
      out[id] = [F.chars[cy * F.cols + cx], F.chars[cy * F.cols + cx + 1]].join("");
    }
    return out;
  }, placed);
  expect(cells.smoother.includes("o") && cells.clatterer.includes("c") && cells.saltrat.includes("r"),
         `the map draws the smoother (o), the clatterer (c) and the saltrat (r) on their tiles (${JSON.stringify(cells)})`);
  let t;
  await shot("1-map-hollowmere-cast");

  // The look on the map: L, then L again on the default target (the foe first: the saltrat) → examine.
  await key("KeyL"); await key("KeyL");
  let ex = await examined("A white-crusted rat, light as a dry reed.");
  expect((await mode()) === "examine" && ex.type === "saltrat" && ex.shown, `L L on the map examines the saltrat with its Deep line (${await mode()}, ${JSON.stringify(ex)})`);
  expect(ex.lines.some((l) => l.includes("out for you")), "the saltrat is out for you");
  await shot("2-map-examine-saltrat");
  await key("Escape");
  // The clatterer, by Tab on the look cursor (foes first, then the nearest).
  await key("KeyL");
  let onIt = false;
  for (let k = 0; k < 8 && !onIt; k++) {
    onIt = await page.evaluate(async (id) => (await import("/src/screens/target.js")).cursorTarget(window.game)?.creature?.id === id, placed.clatterer.id);
    if (!onIt) await key("Tab");
  }
  await key("Enter");
  ex = await examined("A crab the height of a child, claws held aside.");
  expect(onIt && (await mode()) === "examine" && ex.type === "clatterer" && ex.shown && ex.lines.some((l) => l.includes("minding its own business")),
         `the look cursor's Tab reaches the clatterer, and examine shows its Deep line and its peace (${onIt}, ${await mode()}, ${JSON.stringify(ex)})`);
  await shot("3-map-examine-clatterer");
  await key("Escape");
  if ((await mode()) !== "map") await key("Escape");

  // 3D: Tab, face the clatterer, look.
  await key("Tab");
  expect((await mode()) === "explore", `Tab turns to 3D (${await mode()})`);
  await page.evaluate((id) => {
    const g = window.game, p = g.player, c = g.zone.creatures.find((o) => o.id === id);
    p.yaw = Math.atan2(c.y - p.y, c.x - p.x); p.pitch = -0.05;
  }, placed.clatterer.id);
  await frames(6);
  const sprites = await page.evaluate(async (ids) => {
    const C = await import("/src/creatures.js"), g = window.game, by = (id) => g.zone.creatures.find((o) => o.id === id);
    return { clatterer: !!C.creatureSprite(g, by(ids.clatterer.id)), moths: !!C.creatureSprite(g, by(ids.lanternMoths.id)), smoother: !!C.creatureSprite(g, by(ids.smoother.id)),
             keeperLit: !!C.creatureSprite(g, by(ids.drownedKeeper.id)) };
  }, placed);
  expect(sprites.clatterer && sprites.moths, `3D draws the clatterer and the moths (${JSON.stringify(sprites)})`);
  expect(!sprites.smoother, "the smoother has no sprite in 3D (a flat hunter: a shadow that bites)");
  expect(!sprites.keeperLit, "the drowned keeper is unseen with your torch lit");
  await shot("4-3d-clatterer");
  await frames(20);   // (the turn's camera swing done)
  await page.evaluate((id) => {
    const g = window.game, p = g.player, c = g.zone.creatures.find((o) => o.id === id);
    p.yaw = Math.atan2(c.y - p.y, c.x - p.x); p.pitch = Math.atan2(c.z + c.h * 0.5 - (p.z + 1.45), Math.hypot(c.x - p.x, c.y - p.y));
  }, placed.clatterer.id);
  await frames(2);
  await key("KeyL");
  ex = await examined("A crab the height of a child, claws held aside.");
  expect((await mode()) === "examine" && ex.type === "clatterer" && ex.shown, `L in 3D examines the clatterer with its Deep line (${await mode()}, ${JSON.stringify(ex)})`);
  await shot("5-3d-examine-clatterer");
  await key("Escape");
  // Night, the torch out: the drowned keeper shows.
  const dark = await page.evaluate(async (id) => {
    const C = await import("/src/creatures.js"), g = window.game, c = g.zone.creatures.find((o) => o.id === id);
    g.time += 18 * 60;   // 06:00 → midnight (a world hour is 60 s)
    g.player.torch = false;
    return !!C.creatureSprite(g, c);
  }, placed.drownedKeeper.id);
  expect(dark, "at midnight with the torch out, the drowned keeper is seen");
  await page.evaluate((id) => { const g = window.game, p = g.player, c = g.zone.creatures.find((o) => o.id === id); p.yaw = Math.atan2(c.y - p.y, c.x - p.x); }, placed.drownedKeeper.id);
  await frames(6);
  await shot("6-3d-night-drowned-keeper");
  const audio = await page.evaluate(() => window.__audio.rerouted);
  log.push(`audio nodes rerouted to the analyser and zero gain: ${audio}`);
} finally {
  await browser.close();
}
for (const l of log) console.log(l);
for (const e of errors) { console.log(e); problems.push(e); }
console.log(problems.length ? `FAIL browser-c3 (${problems.length})` : "PASS browser-c3");
process.exit(problems.length ? 1 : 0);
