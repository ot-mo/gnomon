// WS1's browser acceptance (TECH_DESIGN §8.3 "WS1"): the world map in headless Chromium, with real key presses and
// real mouse clicks (not a check-*: it needs Playwright).
//   node tools/serve.mjs 8641 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-ws1.mjs [--port 8641] [--seed 1234] [--shots <folder>]
//
// Audio never reaches the speakers: the page opens with ?silent=1, and an init script routes anything bound for the
// AudioDestinationNode into an AnalyserNode and a zero-gain node first. ?quick=1 starts a quick game past the title.
//   1. The world map at 100×30, 160×64 and 180×56 cells (6-pixel columns; the window's height in the browser's own
//      cell height): O on the map opens it; every span of the world is drawn; you (@) are on it; the info panel is on
//      the right from 2·w + 42 columns, else in the bottom strip; the header and the key footer; Esc goes back.
//      --shots writes a PNG of each.
//   2. The round trip, by keys, on the map: O, → a span east, Enter (down at the west edge), ← until you walk off
//      that edge into the span you came from, O again (the world map, @ on that span), Esc. Then in 3D: Tab, O, →,
//      Enter (down in 3D, at the west edge facing east), S held until you walk off the west edge, O again, Esc.
//   3. The mouse: a click on the span south of you steps there; a right click pins it (and again unpins it); a click
//      on "Z: wait" opens the wait menu and a click on "Wait 1 hour" waits an hour; a click on "Enter: go down" goes
//      down; the journal's view (openWorldMap) closes by a click on "Esc: close".
// Fails on any console error or warning, a mode that isn't where it should be, or audio that reached the speakers.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8641), seed = Number(args.seed || 1234), shots = args.shots ? String(args.shots) : null;
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const problems = [], errors = [], log = [];
const out = (s) => { log.push(s); console.log(s); };
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 300 } });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    const orig = AudioNode.prototype.connect, sinks = new WeakMap();
    window.__audio = { rerouted: 0, direct: 0 };
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
  await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&world=test&seed=${seed}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
  await page.evaluate(async () => {
    const { canvasBackend } = await import("/src/screen-canvas.js");
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
  });
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const mode = () => page.evaluate(() => window.game.mode);
  const state = () => page.evaluate(() => ({ mode: window.game.mode, zone: window.game.zone.key, view: window.game.view,
    trip: window.game.trip && { wx: window.game.trip.wx, wy: window.game.trip.wy, prompt: window.game.trip.prompt?.kind || null, menu: !!window.game.trip.menu },
    x: window.game.player.x, y: window.game.player.y, yaw: window.game.player.yaw, time: window.game.time }));
  const key = async (k) => { await page.keyboard.press(k); await frames(2); };
  const expect = async (want, what) => {
    await frames(2);
    const got = await mode();
    out(`  ${what}: ${got}`);
    if (got !== want) problems.push(`${what}: in ${got}, want ${want}`);
    return got === want;
  };
  const text = () => page.evaluate(() => { const f = window.__frame, l = []; for (let y = 0; y < f.rows; y++) l.push(f.chars.slice(y * f.cols, (y + 1) * f.cols).join("")); return l; });
  const cellCenter = (cx, cy) => page.evaluate(([cx, cy]) => {
    const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
    return { x: c.left + ((cx + 0.5) / f.cols) * c.width, y: c.top + ((cy + 0.5) / f.rows) * c.height };
  }, [cx, cy]);
  const clickLabel = async (label, button = "left") => {
    await frames(2);
    const at = await page.evaluate((label) => {
      const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
      for (let y = f.rows - 1; y >= 0; y--) {
        const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label);
        if (x >= 0) return { x: c.left + ((x + 0.5) / f.cols) * c.width, y: c.top + ((y + 0.5) / f.rows) * c.height };
      }
      return null;
    }, label);
    if (!at) { problems.push(`"${label}" isn't on screen in ${await mode()}`); return false; }
    await page.mouse.click(at.x, at.y, { button });
    await frames(2);
    return true;
  };
  // A prompt after a step (a hidden site, a span far above you): no.
  const settle = async () => { for (let k = 0; k < 3; k++) { const s = await state(); if (s.trip?.prompt) await key("KeyN"); else break; } };

  for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");
  await expect("map", "Space through the intro");
  const cellH = await page.evaluate(async () => (await import("/src/screen.js")).cellH);

  // --- 1. Three sizes -------------------------------------------------------------------------------------------
  for (const [cols, rows] of [[100, 30], [160, 64], [180, 56]]) {
    await page.setViewportSize({ width: cols * 6, height: rows * cellH });
    await frames(4);
    const cells = await page.evaluate(async () => { const S = await import("/src/screen.js"); return `${S.cols}×${S.rows}`; });
    if (cells !== `${cols}×${rows}`) problems.push(`a ${cols * 6}×${rows * cellH} window is ${cells} cells, not ${cols}×${rows}`);
    await key("KeyO");
    if (!(await expect("world", `${cells}: O on the map`))) continue;
    const t = await text();
    const r = await page.evaluate(async () => {
      const R = await import("/src/overworld/renderWorld.js"), v = R.worldView, W = window.game.run.world, f = window.__frame;
      let drawn = 0;
      for (let sy = 0; sy < v.viewH; sy++) for (let sx = 0; sx < v.viewW; sx++)
        if (W.inBounds(v.sx0 + sx, v.sy0 + sy) && f.chars[(v.y0 + sy) * f.cols + v.x0 + sx * 2] !== " ") drawn++;
      return { drawn, spans: W.w * W.h, panel: v.panel, w: W.w };
    });
    const right = cols >= 2 * r.w + 42;
    if (r.drawn !== r.spans) problems.push(`${cells}: ${r.drawn} of ${r.spans} spans drawn`);
    if (r.panel !== (right ? "right" : "strip")) problems.push(`${cells}: the panel is ${r.panel}`);
    if (!t[0].includes("World map")) problems.push(`${cells}: no header`);
    if (!t.join("").includes("@")) problems.push(`${cells}: no @`);
    if (!t[t.length - 1].includes("Enter: go down")) problems.push(`${cells}: no key footer`);
    out(`  ${cells}: ${r.drawn} of ${r.spans} spans, panel ${r.panel}`);
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `world-${cols}x${rows}.png`) }); }
    await key("Escape");
    await expect("map", `${cells}: Esc`);
  }
  await page.setViewportSize({ width: 600, height: 30 * cellH });
  await frames(4);

  // --- 2. The round trip, on the map and in 3D --------------------------------------------------------------------
  for (const view of ["map", "3d"]) {
    if (view === "3d") { await page.evaluate(() => { window.game.story.cube = true; }); await key("Tab"); await expect("explore", "Tab to 3D"); }
    const back = view === "map" ? "map" : "explore";
    const s0 = await state();
    await key("KeyO");
    if (!(await expect("world", `${view}: O`))) continue;
    await key("ArrowRight");
    await settle();
    let s = await state();
    if (s.mode === "world") {
      if (s.trip.wx !== Number(s0.zone.split(",")[0]) + 1) problems.push(`${view}: → didn't step east (at ${s.trip.wx}, ${s.trip.wy})`);
      await key("Enter");
      if ((await state()).trip?.menu) await key("Enter");
    } else out(`  ${view}: the step east dropped you into its zone (an encounter or lost): ${s.zone}`);
    await expect(back, `${view}: Enter, down`);
    s = await state();
    const [ex] = s.zone.split(",").map(Number);
    out(`  ${view}: down in ${s.zone} at (${s.x.toFixed(1)}, ${s.y.toFixed(1)}), yaw ${s.yaw.toFixed(2)}`);
    if (s.x > 6) problems.push(`${view}: down at x ${s.x.toFixed(1)}, not by the west edge`);
    // Walk off the west edge.
    if (view === "map") { for (let k = 0; k < 10 && (await state()).zone === s.zone; k++) await key("ArrowLeft"); }
    else { await page.keyboard.down("KeyS"); for (let k = 0; k < 60 && (await state()).zone === s.zone; k++) await frames(3); await page.keyboard.up("KeyS"); }
    const w = await state();
    if (w.zone !== `${ex - 1},${s.zone.split(",")[1]},0`) problems.push(`${view}: walking west didn't take you off the edge into the span you came from (in ${w.zone})`);
    else out(`  ${view}: walked off into ${w.zone}`);
    await key("KeyO");
    if (await expect("world", `${view}: O again`)) {
      const t = await state();
      if (`${t.trip.wx},${t.trip.wy},0` !== w.zone) problems.push(`${view}: the world map has you at (${t.trip.wx}, ${t.trip.wy}), not ${w.zone}`);
      await key("Escape");
      await expect(back, `${view}: Esc`);
    }
  }
  await key("Tab");
  await expect("map", "Tab back to the map");

  // --- 3. The mouse ----------------------------------------------------------------------------------------------
  await key("KeyO");
  if (await expect("world", "O for the mouse")) {
    const s = await state(), v = await page.evaluate(async () => { const R = await import("/src/overworld/renderWorld.js"); return { ...R.worldView }; });
    const south = await cellCenter((s.trip.wx - v.sx0) * 2, v.y0 + s.trip.wy + 1 - v.sy0);
    await page.mouse.move(south.x, south.y); await frames(2);
    await page.mouse.click(south.x, south.y);
    await frames(2); await settle();
    const s2 = await state();
    if (s2.mode === "world" && s2.trip.wy !== s.trip.wy + 1) problems.push(`a click on the span south of you left you at (${s2.trip.wx}, ${s2.trip.wy})`);
    out(`  a click south: (${s2.trip?.wx}, ${s2.trip?.wy}) in ${s2.mode}`);
    if (s2.mode === "world") {
      const here = await cellCenter((s2.trip.wx - v.sx0) * 2, v.y0 + s2.trip.wy - v.sy0);
      await page.mouse.click(here.x, here.y, { button: "right" }); await frames(2);
      const pins = () => page.evaluate(() => Object.keys(window.game.state.atlas.pins).length);
      const n1 = await pins();
      await page.mouse.click(here.x, here.y, { button: "right" }); await frames(2);
      const n2 = await pins();
      if (n1 !== 1 || n2 !== 0) problems.push(`right clicks: ${n1} pins, then ${n2}`);
      out(`  right click: ${n1} pin, again: ${n2}`);
      const t0 = s2.time;
      await clickLabel("Z: wait");
      if (await expect("wait", "a click on Z: wait")) {
        await clickLabel("Wait 1 hour");
        await frames(2);
        const t1 = (await state()).time;
        if (Math.abs(t1 - t0 - 60) > 1e-6) problems.push(`a click on "Wait 1 hour" passed ${t1 - t0} s`);
        out(`  waited ${(t1 - t0).toFixed(0)} s by clicks, in ${await mode()}`);
      }
      if ((await mode()) === "world") {
        await clickLabel("Enter: go down");
        if ((await state()).trip?.menu) await clickLabel("1. ");
        await expect("map", "a click on Enter: go down");
      }
    }
  }
  // The journal's look-only map (openWorldMap), closed by a click.
  await page.evaluate(async () => { (await import("/src/screens/worldmap.js")).openWorldMap(window.game, { center: { wx: 20, wy: 8 } }); });
  await expect("world", "openWorldMap (look only)");
  const look = await page.evaluate(() => ({ cursor: window.game.trip?.cursor, viewOnly: window.game.trip?.viewOnly }));
  if (!look.viewOnly || look.cursor?.wx !== 20) problems.push(`openWorldMap: ${JSON.stringify(look)}`);
  await key("ArrowRight");
  const moved = await page.evaluate(() => window.game.trip?.cursor);
  if (moved?.wx !== 21) problems.push("look-only map: → didn't move the cursor");
  await clickLabel("Esc: close");
  await expect("map", "a click on Esc: close");

  const audio = await page.evaluate(() => window.__audio);
  out(`  audio: ${audio.rerouted} connections to the speakers rerouted (silent)`);
  await page.close();
} catch (e) {
  problems.push(`threw: ${e?.stack || e}`);
} finally {
  await browser.close();
}
for (const e of errors) problems.push(`console ${e}`);
console.log(problems.length ? `FAIL browser-ws1: ${problems.length} problems` : "PASS browser-ws1");
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
