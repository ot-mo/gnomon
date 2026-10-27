// WS8 in headless Chromium, with real key presses and real mouse moves and clicks (not a check-*: it needs
// Playwright): the target cursor and the look key on the map, by keys and by the mouse; a throw (T) and a
// missile weapon (V) at a target on the map; L, V and a throw in 3D; Tab between the views with a follower
// that keeps up. The d20 set is switched on for the run (RULES.combat is "legacy" until the integrator's flip).
//   node tools/serve.mjs 8648 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-ws8.mjs [--port 8648] [--seed 1234] [--shots DIR]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a
// zero-gain node, and the page is opened with ?silent=1 (audio.js's own silent sink): nothing reaches the
// speakers. With --shots, a screenshot of the target screen (throw) and of the look cursor are written there.
// Fails on any console error or warning, or anything not where it should be.
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8648), seed = Number(args.seed || 1234);
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
  const mode = () => page.evaluate(() => window.game.mode);
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const expect = (ok, what) => { log.push(`${ok ? "ok" : "FAIL"}: ${what}`); if (!ok) problems.push(what); };
  const key = async (k) => { await page.keyboard.press(k); await frames(2); };
  for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");

  // An arena on the map: d20, a goblin and an orc to aim at, knives, a bolt-bow and bolts, a follower.
  await page.evaluate(async () => {
    const W = await import("/src/world.js"), Z = await import("/src/zones.js"), C = await import("/src/creatures.js");
    const R = await import("/src/rules.js"), E = await import("/src/events.js"), A = await import("/src/ai.js"), T = await import("/src/turns.js");
    const game = window.game;
    game.story.cube = true;
    window.__undo = R.overrideRules("combat", "d20");
    const z = new W.Zone({ key: "ws8-browser", wx: 90, wy: 90, z: 0, type: "surface", level: 3, seed: 3, w: 40, d: 20, h: 16, name: "Target Field" });
    for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) for (let k = 0; k < W.FLOOR_Z; k++) z.set(x, y, k, k === W.FLOOR_Z - 1 ? W.B.GRASS : W.B.ROCK);
    z.edges = { n: null, s: null, e: null, w: null }; z.hasSky = true; z.refresh(); z.spawn = { x: 6.5, y: 10.5, z: W.FLOOR_Z, yaw: 0 }; z.seal();
    Z.enterZone(game, z, { how: "start" });
    z.seen.fill(1);
    const pin = (c) => { c.hp = c.maxHp = 1e6; c.cd = Infinity; c.status.pinned = { t: Infinity, mag: 1, src: null, acc: 0 }; return c; };
    window.__gob = pin(C.addCreature(z, C.spawnCreature("goblin", 11, 10, W.FLOOR_Z, { rng: Math.random, level: 3, state: "chase" })));
    window.__orc = pin(C.addCreature(z, C.spawnCreature("orc", 13, 13, W.FLOOR_Z, { rng: Math.random, level: 5, state: "chase" })));
    window.__pal = A.recruit(game, C.addCreature(z, C.spawnCreature("goblin", 5, 10, W.FLOOR_Z, { rng: Math.random, level: 3 })));
    const p = game.player;
    p.inv.push({ kind: "knife", count: 10 }, { kind: "missile", id: "boltBow", ench: 0 }, { kind: "ammo", effect: "bolt", count: 10 });
    window.__events = { inspect: [], attack: [] };
    E.on("inspect", (g, e) => window.__events.inspect.push({ x: e.x, y: e.y, open: e.open, creature: e.creature?.name || null }));
    E.on("attack", (g, { att, tgt, result }) => window.__events.attack.push({ att: att === p ? "you" : att.name, tgt: tgt === p ? "you" : tgt.name, hit: result.hit, touched: result.touched }));
    T.refreshView(game);
  });
  await frames(3);
  expect((await mode()) === "map", `the arena on the map (mode ${await mode()})`);
  // The cell under a tile (the map is 2 characters a tile), in page pixels.
  const tilePixel = (x, y) => page.evaluate(async ([x, y]) => {
    const { mapView } = await import("/src/renderMap.js"), S = await import("/src/screen.js");
    const c = document.getElementById("screen").getBoundingClientRect();
    const cx = (x - mapView.tx0) * 2 + 0.5, cy = mapView.top + y - mapView.ty0 + 0.5;
    return { x: c.left + (cx / S.cols) * c.width, y: c.top + (cy / S.rows) * c.height };
  }, [x, y]);
  const cursor = () => page.evaluate(async () => { const T = await import("/src/screens/target.js"); const t = T.cursorTarget(window.game); return t && { x: t.tile.x, y: t.tile.y, creature: t.creature?.name || null }; });
  const events = () => page.evaluate(() => window.__events);

  // --- The look cursor by keys ---------------------------------------------------------------------------------
  await key("KeyL");
  let c = await cursor();
  expect((await mode()) === "target" && c?.x === 11 && c?.y === 10, `L: the look cursor on the nearest foe, the goblin at 11,10 (${JSON.stringify(c)})`);
  await key("Tab");
  const c2 = await cursor();
  expect(c2?.creature && (c2.x !== c.x || c2.y !== c.y), `Tab: the next one (${JSON.stringify(c2)})`);
  await key("ArrowUp"); await key("ArrowUp"); await key("ArrowLeft");
  const moved = await cursor();
  if (args.shots) await page.screenshot({ path: `${args.shots}/ws8-look.png` });
  // A confirm emits inspect { open: true }, which opens WS5's examine (since the integrator's merge of p1-ws5); Esc
  // there goes back to where you looked from.
  await key("Enter");
  let ev = await events();
  expect((await mode()) === "examine" && ev.inspect.length === 1 && ev.inspect[0].open && ev.inspect[0].x === moved.x && ev.inspect[0].y === moved.y,
    `Enter: examine, one inspect, open, at the cursor (${await mode()}; ${JSON.stringify(ev.inspect)} vs ${JSON.stringify(moved)})`);
  await key("Escape");
  expect((await mode()) === "map", `Esc in examine: back to the map (${await mode()})`);
  await key("KeyL"); await key("Escape");
  expect((await mode()) === "map" && (await events()).inspect.length === 1, "Esc: cancelled, no inspect");

  // --- The look cursor by the mouse -----------------------------------------------------------------------------
  await key("KeyL");
  const px = await tilePixel(16, 6);
  await page.mouse.move(px.x, px.y); await frames(2);
  c = await cursor();
  expect(c?.x === 16 && c?.y === 6, `the mouse moved the cursor to ${JSON.stringify(c)} (want 16,6)`);
  await page.mouse.click(px.x, px.y); await frames(2);
  ev = await events();
  expect((await mode()) === "examine" && ev.inspect.length === 2 && ev.inspect[1].x === 16 && ev.inspect[1].y === 6, `a click looked at 16,6, examine (${await mode()}; ${JSON.stringify(ev.inspect[1])})`);
  await key("Escape");
  await key("KeyL");
  await page.mouse.click(px.x, px.y, { button: "right" }); await frames(2);
  expect((await mode()) === "map" && (await events()).inspect.length === 2, "a right click cancelled");

  // --- T and V at targets on the map ------------------------------------------------------------------------------
  await key("KeyT");
  c = await cursor();
  const line = await page.evaluate(async () => (await import("/src/screens/target.js")).targetText(window.game).bottom);
  expect((await mode()) === "target" && c?.creature === "goblin" && /% to hit/.test(line), `T: aiming at ${c?.creature} ("${line.trim()}")`);
  if (args.shots) await page.screenshot({ path: `${args.shots}/ws8-throw.png` });
  await key("KeyT");
  ev = await events();
  expect((await mode()) === "map" && ev.attack.some((a) => a.att === "you" && a.tgt === "goblin" && a.touched), `TT: a knife reached the goblin (${JSON.stringify(ev.attack.slice(-2))})`);
  await key("KeyV");
  const opx = await tilePixel(13, 13);
  await page.mouse.move(opx.x, opx.y); await frames(2);
  c = await cursor();
  await page.mouse.click(opx.x, opx.y); await frames(4);
  ev = await events();
  expect(c?.creature === "orc" && ev.attack.some((a) => a.att === "you" && a.tgt === "orc" && a.touched), `V and a click on the orc: a bolt reached it (${JSON.stringify(ev.attack.slice(-2))})`);

  // --- 3D: L, V and a throw at the goblin -------------------------------------------------------------------------
  await key("Tab");
  await frames(5);
  if ((await mode()) === "pause") await page.mouse.click(640, 360);
  await frames(5);
  expect((await mode()) === "explore", `Tab: into 3D (${await mode()})`);
  const aim = () => page.evaluate(() => {
    const p = window.game.player, g = window.__gob;
    p.yaw = Math.atan2(g.y - p.y, g.x - p.x);
    p.pitch = Math.atan2(g.z + g.h * 0.6 - (p.z + 1.45), Math.hypot(g.x - p.x, g.y - p.y));
    p.cooldowns.missile = 0; p.throwCd = 0;
  });
  await aim();
  const n0 = (await events()).inspect.length;
  await key("KeyL");
  ev = await events();
  expect(ev.inspect.length === n0 + 1 && ev.inspect[n0].creature === "goblin" && ev.inspect[n0].open && (await mode()) === "examine", `L in 3D: the goblin in the crosshair, examine (${await mode()}; ${JSON.stringify(ev.inspect[n0])})`);
  await key("Escape");
  if ((await mode()) === "pause") await page.mouse.click(640, 360);
  await frames(5);
  expect((await mode()) === "explore", `Esc in examine over 3D: back to 3D (${await mode()})`);
  const a0 = ev.attack.length;
  await aim(); await key("KeyV"); await frames(40);
  await aim(); await key("KeyT"); await frames(40);
  ev = await events();
  const shots = ev.attack.slice(a0).filter((a) => a.att === "you" && a.tgt === "goblin");
  expect(shots.length >= 2, `V and T in 3D: ${shots.length} of 2 reached the goblin (${JSON.stringify(ev.attack.slice(a0))})`);
  const follower = await page.evaluate(() => { const p = window.game.player, f = window.__pal; return { d: Math.hypot(f.x - p.x, f.y - p.y), struck: window.__events.attack.filter((a) => a.att === "goblin" && a.tgt === "you").length }; });
  expect(follower.d < 7 && follower.struck === 0, `your follower stays near (${follower.d.toFixed(1)} tiles) and never strikes you (${follower.struck})`);
  const audio = await page.evaluate(() => window.__audio);
  log.push(`audio: ${audio.rerouted} connections rerouted to the silent sink`);
  await page.evaluate(() => window.__undo?.());
  await page.close();
} finally {
  await browser.close();
}
for (const e of errors) problems.push(e);
for (const l of log) console.log(`  ${l}`);
console.log(problems.length ? `FAIL browser-ws8 (${problems.length})` : "PASS browser-ws8");
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
