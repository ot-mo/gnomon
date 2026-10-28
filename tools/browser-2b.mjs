// 2B hardening's browser pass (TECH_DESIGN §8.5 "2B Hardening"): what Phase 2 added, in headless Chromium with real key
// presses, real mouse clicks, the real IndexedDB and a real reload (not a check-*: it needs Playwright).
//   NODE_PATH=$(npm root -g) node tools/browser-2b.mjs [--port 8662] [--seed 1234]
// It serves the repository itself (tools/serve.mjs on the port, stopped afterwards). Audio never reaches the speakers:
// ?silent=1, and an init script routes anything bound for the AudioDestinationNode into an AnalyserNode and a zero-gain
// node first.
//   1. A travel save: the title's New game (the wizard by its keys; a quick game's saves stay in memory), the intro
//      by Space, O, a step east on the world map, and the next save WS9 makes there (its timed save; "world" is
//      saveable since Phase 2), the slot's where.world on that span. The page reloaded, the title's Continue (a click)
//      puts you back on the world map at that span; a step goes on east, and Enter goes down there.
//   2. The journal's Locations tab: a place learned (away from here), J, 2: the place is marked (>); O shows it on the
//      world map, to look only, the cursor on its span; Esc comes back to the journal; a click on its title does the
//      same, and a click on "Esc: close" comes back; Esc closes the journal.
// Fails on any console error or warning, a mode or span that isn't where it should be, or audio that reached the speakers.
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs();
const port = Number(args.port || 8662), seed = Number(args.seed || 1234), base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(ROOT, "tools", "serve.mjs"), String(port)], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((ok, no) => { server.stdout.once("data", ok); server.once("exit", (c) => no(new Error(`serve.mjs exited ${c}`))); });
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const problems = [], errors = [];
const out = (s) => console.log(s);
try {
  const context = await browser.newContext({ viewport: { width: 600, height: 300 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await context.addInitScript(() => {
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
  const capture = () => page.evaluate(async () => {
    const { canvasBackend } = await import("/src/screen-canvas.js");
    if (canvasBackend.__captured) return;
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
    canvasBackend.__captured = true;
  });
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const state = () => page.evaluate(() => { const g = window.game, t = g.trip;
    return { mode: g.mode, zone: g.zone?.key ?? null, trip: t && { wx: t.wx, wy: t.wy, viewOnly: !!t.viewOnly, prompt: t.prompt?.kind || null, menu: !!t.menu, cursor: t.cursor } }; });
  const key = async (k) => { await page.keyboard.press(k); await frames(2); };
  const expect = async (want, what) => {
    await frames(2);
    const s = await state();
    out(`  ${what}: ${s.mode}${s.trip ? ` at (${s.trip.wx}, ${s.trip.wy})${s.trip.viewOnly ? `, looking at (${s.trip.cursor?.wx}, ${s.trip.cursor?.wy})` : ""}` : ` in ${s.zone}`}`);
    if (s.mode !== want) problems.push(`${what}: in ${s.mode}, want ${want}`);
    return s;
  };
  const text = () => page.evaluate(() => { const f = window.__frame, l = []; for (let y = 0; y < f.rows; y++) l.push(f.chars.slice(y * f.cols, (y + 1) * f.cols).join("")); return l; });
  const clickLabel = async (label, dx = 0) => {   // (dx: that many cells right of the label's start)
    await frames(2);
    const at = await page.evaluate(([label, dx]) => {
      const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
      for (let y = f.rows - 1; y >= 0; y--) {
        const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label);
        if (x >= 0) return { x: c.left + ((x + dx + 0.5) / f.cols) * c.width, y: c.top + ((y + 0.5) / f.rows) * c.height };
      }
      return null;
    }, [label, dx]);
    if (!at) { problems.push(`"${label}" isn't on screen in ${(await state()).mode}`); return false; }
    await page.mouse.click(at.x, at.y);
    await frames(2);
    return true;
  };
  const noPrompt = async () => { for (let k = 0; k < 3; k++) { const s = await state(); if (s.trip?.prompt) await key("KeyN"); else break; } };

  // --- 1. A travel save, reloaded ---------------------------------------------------------------------------------
  await page.goto(`${base}/index.html?silent=1&seed=${seed}`);
  await page.waitForFunction(() => window.game && window.game.mode === "title");
  await capture(); await frames(4);
  await key("Home"); await key("Enter");
  await expect("create", "New game on the title");
  for (let k = 0; k < 20 && (await state()).mode === "create"; k++) {
    const step = await page.evaluate(async () => (await import("/src/screens/create.js")).wizard().step);
    if (step === "track") await key("End"); else if (step === "name") await key("Tab");
    await key("Enter");
  }
  await page.waitForFunction(() => window.game.zone && window.game.mode !== "create", null, { timeout: 20000 }).catch(() => {});
  out(`  the wizard: ${await page.evaluate(() => `${window.game.player.name}, a ${window.game.player.genotype}, seed ${window.game.seed}`)}`);
  for (let k = 0; k < 8 && (await state()).mode === "story"; k++) await key("Space");
  const s0 = await expect("map", "Space through the intro");
  const [wx0, wy0] = s0.zone.split(",").map(Number);
  await key("KeyO");
  await expect("world", "O on the map");
  await key("ArrowRight"); await noPrompt();
  const s1 = await expect("world", "→ on the world map");
  if (s1.trip?.wx !== wx0 + 1 || s1.trip?.wy !== wy0) problems.push(`→ didn't step east: at (${s1.trip?.wx}, ${s1.trip?.wy}) from (${wx0}, ${wy0})`);
  const saves0 = await page.evaluate(async () => { window.__save = await import("/src/save/save.js"); return window.__save.SAVE_STATS.saves; });
  const t0 = Date.now();
  await page.waitForFunction((n) => window.__save.SAVE_STATS.saves > n, saves0, { timeout: 20000, polling: 250 }).catch(() => {});
  const waited = ((Date.now() - t0) / 1000).toFixed(1);
  const saved = await page.evaluate(async () => { const S = window.__save; await S.whenWritten(window.game);
    const slot = (await S.listSlots()).find((s) => s.id === window.game.saving?.slotId); return { n: S.SAVE_STATS.saves, where: slot?.where ?? null }; });
  out(`  the save on the world map: ${saved.n > saves0 ? `made after ${waited} s, where ${JSON.stringify(saved.where)}` : `none in ${waited} s`}`);
  if (!(saved.n > saves0) || saved.where?.world?.wx !== wx0 + 1 || saved.where?.world?.wy !== wy0) problems.push(`the save on the world map: ${saved.n - saves0} in ${waited} s, where ${JSON.stringify(saved.where)}`);
  await page.goto(`${base}/index.html?silent=1`);
  await page.waitForFunction(() => window.game && window.game.mode === "title");
  await capture(); await frames(4);
  await clickLabel("Continue");
  await page.waitForFunction(() => window.game.mode !== "title" && window.game.zone, null, { timeout: 20000 }).catch(() => {});
  const s2 = await expect("world", "Continue after the reload");
  if (s2.trip?.wx !== wx0 + 1 || s2.trip?.wy !== wy0 || s2.trip?.viewOnly) problems.push(`Continue: the journey at ${JSON.stringify(s2.trip)}, saved at (${wx0 + 1}, ${wy0})`);
  await key("ArrowRight"); await noPrompt();
  const s3 = await expect("world", "→ after the load");
  if (s3.trip?.wx !== wx0 + 2) problems.push(`→ after the load didn't step east: at (${s3.trip?.wx}, ${s3.trip?.wy})`);
  await key("Enter");
  if ((await state()).trip?.menu) await key("Digit1");
  await page.waitForFunction(() => window.game.mode !== "world", null, { timeout: 20000 }).catch(() => {});
  const s4 = await expect("map", "Enter: down");
  if (s4.zone !== `${wx0 + 2},${wy0},0`) problems.push(`Enter went down into ${s4.zone}, not ${wx0 + 2},${wy0},0`);

  // --- 2. The journal's Locations tab ------------------------------------------------------------------------------
  const loc = await page.evaluate(async () => {
    const SEC = await import("/src/story/secrets.js"), g = window.game;
    const d = [...SEC.secretsOf(g.run).values()].find((d) => d.kind === "location" && d.at && (d.at.wx !== g.zone.wx || d.at.wy !== g.zone.wy));
    if (!d) return null;
    SEC.learnSecret(g, d.id, "talk", { quiet: true });
    return { title: SEC.secretTitle(g.run, d), wx: d.at.wx, wy: d.at.wy };
  });
  if (!loc) problems.push("no location secret away from here to learn");
  else {
    await key("KeyJ"); await key("Digit2");
    await expect("journal", "J, 2");
    const marked = (await text()).some((r) => r.includes(`>${loc.title}`));
    out(`  ${loc.title} at (${loc.wx}, ${loc.wy}): ${marked ? "marked" : "NOT marked"}`);
    if (!marked) problems.push(`the Locations tab doesn't mark ${loc.title}`);
    const looking = (s, how) => { if (!s.trip?.viewOnly || s.trip.cursor?.wx !== loc.wx || s.trip.cursor?.wy !== loc.wy) problems.push(`${how}: ${JSON.stringify(s.trip)}, want a look at (${loc.wx}, ${loc.wy})`); };
    await key("KeyO");
    looking(await expect("world", "O on the Locations tab"), "O");
    await key("Escape");
    await expect("journal", "Esc");
    await clickLabel(`>${loc.title}`, 1);   // (the marked title: the place's text below may name it too)
    looking(await expect("world", `a click on ${loc.title}`), "the click");
    await clickLabel("Esc: close");
    await expect("journal", "a click on Esc: close");
    await key("Escape");
    const s5 = await expect("map", "Esc closes the journal");
    if (s5.trip) problems.push(`the look left a journey: ${JSON.stringify(s5.trip)}`);
  }

  const audio = await page.evaluate(() => window.__audio);
  out(`  audio: ${audio.rerouted} connections to the speakers rerouted (silent)`);
  await context.close();
} catch (e) {
  problems.push(`threw: ${e?.stack || e}`);
} finally {
  await browser.close();
  server.kill();
}
for (const e of errors) problems.push(`console ${e}`);
console.log(problems.length ? `FAIL browser-2b: ${problems.length} problems` : "PASS browser-2b");
for (const p of problems) console.log(`  ✗ ${p}`);
process.exit(problems.length ? 1 : 0);
