// C5's look in the browser (scratch, not a repo tool): the real world (the default), ?silent=1, audio routed to an
// analyser and zero gain before any page script. The campaign's intro pages; beat 1 in the journal; Brother Tamsin
// (C3's type, C5's words) talked to by walking into him on the map and again in 3D.
//   node tools/serve.mjs 8685 &  then  NODE_PATH=$(npm root -g) node browser-c5.mjs <shots dir>
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const shots = process.argv[2];
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const problems = [], log = [], errors = [];
const expect = (ok, what) => { log.push(`${ok ? "ok" : "FAIL"}: ${what}`); if (!ok) problems.push(what); };
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
        if (!s) { const ctx = dest.context, an = ctx.createAnalyser(), mute = ctx.createGain(); mute.gain.value = 0; orig.call(an, mute); orig.call(mute, dest); s = an; sinks.set(dest, s); }
        window.__audio.rerouted++;
        return orig.call(this, s, ...rest);
      }
      return orig.call(this, dest, ...rest);
    };
  });
  await page.goto("http://127.0.0.1:8685/index.html?silent=1&quick=1&seed=9");
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
  await page.evaluate(async () => {
    const { canvasBackend } = await import("/src/screen-canvas.js");
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
  });
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const mode = () => page.evaluate(() => window.game.mode);
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await frames(2); };
  const text = async () => { await frames(2); return page.evaluate(() => window.__frame.chars.join("")); };
  const shot = async (name) => { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };

  // 1. The intro pages: the campaign's, not the parent's.
  let t = await text();
  expect(t.includes("GNOMON") && t.includes("needle"), "the first intro page is the campaign's");
  await key("Space"); t = await text();
  expect(t.includes("You were born in Hollowmere"), "the second page is C5's");
  await shot("1-intro-page-2");
  for (let k = 0; k < 12 && (await mode()) === "story"; k++) await key("Space");
  const log1 = await page.evaluate(() => (window.game.messages || window.game.logLines || []).slice(-3).map((m) => m.text || m));
  log.push(`the log after the intro: ${JSON.stringify(log1)}`);
  // 2. Beat 1 taken; the journal.
  const q = await page.evaluate(() => window.game.quests.filter((x) => x.template === "beat").map((x) => x.title));
  expect(q.length === 1 && q[0] === "1. What Shakes the Temple", `beat 1 in the quest list (${JSON.stringify(q)})`);
  await page.evaluate(() => { window.game.story.cube = true; });
  if ((await mode()) === "explore") await key("Tab");
  await key("KeyJ"); t = await text();
  expect(t.includes("What Shakes the Temple"), "the journal's Quests tab shows beat 1");
  await shot("2-journal-beat1");
  await key("Escape");
  // 3. Brother Tamsin beside you, on open ground east of the temple.
  const placed = await page.evaluate(async () => {
    const C = await import("/src/creatures.js"), T = await import("/src/turns.js");
    const g = window.game, z = g.zone, p = g.player;
    const level = (x, y, h) => x >= 0 && y >= 0 && x < z.w && y < z.d && z.stand[x + y * z.w] === h;
    let spot = null;
    for (let x = 50; x < z.w - 8 && !spot; x++)
      for (let y = 8; y < z.d - 8 && !spot; y++) {
        const h = z.stand[x + y * z.w];
        if (h < 0) continue;
        let open = true;
        for (let dy = -3; dy <= 3 && open; dy++) for (let dx = -3; dx <= 3 && open; dx++) open = level(x + dx, y + dy, h) && !C.creatureAt(z, x + dx, y + dy);
        if (open) spot = [x, y, h];
      }
    if (!spot) return null;
    Object.assign(p, { x: spot[0] + 0.5, y: spot[1] + 0.5, z: spot[2], vz: 0 });
    const c = C.addCreature(z, C.spawnCreature("tamsin", spot[0] + 1, spot[1], spot[2], { rng: Math.random, level: 2, state: "idle" }));
    c.status.pinned = { t: 1e9, mag: 1, src: null, acc: 0 };
    T.refreshView(g);
    return { at: spot, dialogue: c.talk?.dialogue };
  });
  expect(placed?.dialogue === "tamsin", `Brother Tamsin placed east of you (${JSON.stringify(placed)})`);
  await frames(4);
  await shot("3-map-tamsin");
  await key("ArrowRight");
  await frames(90); t = await text();
  expect((await mode()) === "talk" && t.includes("Turn, hand. Turn, hour."), `on the map, walking into him talks: C5's greeting (${await mode()})`);
  await shot("4-map-talk-tamsin");
  await key("Escape");
  // 4. The same in 3D: face him and walk into him.
  if ((await mode()) === "map") await key("Tab");
  const m3 = await mode();
  await page.evaluate(() => { const p = window.game.player; p.yaw = 0; p.pitch = 0; });
  await frames(4);
  await shot("5-3d-tamsin");
  await key("KeyE");
  await frames(90); t = await text();
  expect((await mode()) === "talk" && t.includes("Turn, hand. Turn, hour."), `in 3D (${m3}), E ("talk to Brother Tamsin") talks: C5's greeting (${await mode()})`);
  await shot("6-3d-talk-tamsin");
  const audio = await page.evaluate(() => window.__audio.rerouted);
  log.push(`audio nodes rerouted to the analyser and zero gain: ${audio}`);
} finally {
  await browser.close();
}
console.log(log.join("\n"));
if (errors.length) console.log("console:", errors.slice(0, 5).join(" | "));
console.log(problems.length ? `FAIL ${problems.length}` : "PASS");
