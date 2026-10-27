// WS5 in headless Chromium, with real key presses, mouse clicks and the wheel (not a check-*: it needs Playwright):
// a 60-thing pack scrolls (keys, PgUp/PgDn, Home/End, the wheel, a click on a row), the filter and the Equipment
// tab (by key and by a click on "Tab pack"), L opens examine over the pack, the same pack over 3D; an `inspect`
// event with open: true opens examine; a Truing Cradle walked into on the map fits an implant by Enter.
//   node tools/serve.mjs 8645 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-ws5.mjs [--port 8645] [--seed 1234] [--shots DIR]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a
// zero-gain node, and the page is opened with ?silent=1 (audio.js's own silent sink): nothing reaches the
// speakers. With --shots, screenshots of the scrolled pack, the Equipment tab, examine and the Cradle go there.
// Fails on any console error or warning, or anything not where it should be.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8645), seed = Number(args.seed || 1234), shots = args.shots ? String(args.shots) : null;
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
  await page.evaluate(async () => {   // keep the last presented frame's characters, to read and to click
    const { canvasBackend } = await import("/src/screen-canvas.js");
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
  });
  const mode = () => page.evaluate(() => window.game.mode);
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const expect = (ok, what) => { log.push(`${ok ? "ok" : "FAIL"}: ${what}`); if (!ok) problems.push(what); };
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await frames(2); };
  const screenText = async () => { await frames(2); return page.evaluate(() => window.__frame.chars.join("")); };
  const where = async (label) => {
    await frames(2);
    return page.evaluate((label) => {
      const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
      for (let y = 0; y < f.rows; y++) {
        const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label);
        if (x >= 0) return { x: c.left + ((x + 1.5) / f.cols) * c.width, y: c.top + ((y + 0.5) / f.rows) * c.height };
      }
      return null;
    }, label);
  };
  const click = async (label) => { const at = await where(label); if (!at) { problems.push(`"${label}" isn't on screen in ${await mode()}`); return; } await page.mouse.click(at.x, at.y); await frames(2); };
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const sel = () => page.evaluate(() => ({ sel: window.game.invSel, top: window.game.invTop, page: window.game.invPage, tab: window.game.invTab, filter: window.game.invFilter }));
  for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");
  expect((await mode()) === "map", `through the intro to the map (${await mode()})`);
  const cells = await page.evaluate(async () => { const S = await import("/src/screen.js"); return `${S.cols}×${S.rows}`; });

  // A pack of 60 things: tokens with names of their own (a quest item shows its name), so each row can be found.
  const name = (k) => `token ${String(k + 1).padStart(2, "0")}`;
  await page.evaluate(() => {
    const p = window.game.player;
    window.game.story.cube = true;   // (the old game turns the world only after the Cube)
    p.inv.length = 0;
    for (let k = 0; k < 60; k++) p.inv.push({ kind: "quest", name: `token ${String(k + 1).padStart(2, "0")}`, info: "One of sixty." });
  });
  await key("KeyI");
  expect((await mode()) === "inventory", "I opens the inventory over the map");
  let t = await screenText();
  expect(t.includes(name(0)) && !t.includes(name(59)) && t.includes("I close"), `the pack's first rows show, the 60th doesn't, "I close" is there (${cells})`);
  await key("ArrowDown", 59);
  let s = await sel();
  t = await screenText();
  expect(s.sel === 59 && s.top > 0 && t.includes(name(59)) && !t.includes(name(0)), `59 × ↓: the 60th is selected and on screen, the list scrolled (top ${s.top}, page ${s.page})`);
  await shot("pack-scrolled");
  await key("Home");
  s = await sel();
  expect(s.sel === 0 && s.top === 0, `Home: back to the top (${JSON.stringify(s)})`);
  await key("PageDown");
  s = await sel();
  expect(s.sel === s.page, `PgDn moves a page (${s.sel}, page ${s.page})`);
  await key("End");
  s = await sel();
  expect(s.sel === 59, "End: the last");
  // The wheel over the list, and a click on a row.
  const mid = await where(name(50));
  if (mid) {
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.wheel(0, -300);
    await frames(3);
    s = await sel();
    expect(s.sel < 59, `the wheel moves the selection up (${s.sel})`);
    const row = await where(name(45));
    if (row) { await page.mouse.click(row.x, row.y); await frames(2); s = await sel(); expect(s.sel === 45, `a click on "${name(45)}" selects it (${s.sel})`); }
    else problems.push(`"${name(45)}" isn't on screen to click`);
  } else problems.push(`"${name(50)}" isn't on screen for the wheel`);
  // L: examine over the pack; Esc back.
  await key("KeyL");
  t = await screenText();
  expect((await mode()) === "examine" && t.includes("Not for sale.") && /Token 46/.test(t), "L opens examine on the selected token (its own lines: the name, \"Not for sale.\")");
  await shot("examine-token");
  await key("Escape");
  expect((await mode()) === "inventory", "Esc goes back to the pack");
  // A filter, the Equipment tab by key, back by a click on "Tab pack".
  await page.evaluate(() => { window.game.player.inv.push({ kind: "potion", effect: "healing", count: 2 }, { kind: "ring", id: "protection", ench: 1, known: true }); });
  await key("KeyF");
  s = await sel();
  t = await screenText();
  expect(s.filter !== "all" && !t.includes(name(0)), `F filters the pack (${s.filter})`);
  for (let k = 0; k < 8 && (await sel()).filter !== "all"; k++) await key("KeyF");
  await key("Tab");
  t = await screenText();
  expect((await sel()).tab === "equipment" && t.includes("Right hand") && t.includes("Feet") && t.includes("short sword"), "Tab shows the Equipment tab: every part, your short sword");
  await shot("equipment");
  await click("Tab pack");
  expect((await sel()).tab === "pack", "a click on \"Tab pack\" goes back to the pack");
  await key("Escape");
  expect((await mode()) === "map", "Esc closes the inventory");

  // The same pack over 3D (Tab turns the world: wait for the turn to end).
  const settle = (want) => page.waitForFunction((want) => window.game.mode === want, want, { timeout: 8000 }).catch(() => null);
  await key("Tab");
  await settle("explore");
  expect((await mode()) === "explore", `Tab to 3D (${await mode()})`);
  await key("KeyI");
  expect((await mode()) === "inventory", "I opens the inventory over 3D");
  await key("End");
  t = await screenText();
  expect(t.includes("ring of protection"), "over 3D, End scrolls to the last row");
  await key("Escape");
  await settle("explore");
  expect((await mode()) === "explore", `Esc back to 3D (${await mode()})`);
  await key("Tab");
  await settle("map");

  // An inspect event with open: true (WS8's look emits it) opens examine; open: false doesn't.
  const opened = await page.evaluate(async () => {
    const E = await import("/src/events.js"), R = await import("/src/renderMap.js");
    const g = window.game, p = g.player, x = Math.floor(p.x), y = Math.floor(p.y);
    g.zone.items.push({ kind: "ring", id: "haste", ench: 1, known: true, x: x + 0.5, y: y + 0.5, z: p.z });
    E.emit(g, "inspect", R.inspectAt(g, { x, y }, false));
    const shut = g.mode;
    E.emit(g, "inspect", R.inspectAt(g, { x, y }, true));
    return { shut, open: g.mode };
  });
  t = await screenText();
  expect(opened.shut === "map" && opened.open === "examine" && /ring of haste/i.test(t), `inspect: open false ${opened.shut}, open true ${opened.open}`);
  await key("Escape");
  expect((await mode()) === "map", "Esc closes examine");

  // A Truing Cradle east of you on the map: walk into it, Enter fits the lamp crown (a Plumb's).
  const set = await page.evaluate(async () => {
    const W = await import("/src/world.js"), T = await import("/src/turns.js");
    const g = window.game, p = g.player, z = g.zone, tx = Math.floor(p.x), ty = Math.floor(p.y);
    for (const [dx, dy, dir] of [[1, 0, "ArrowRight"], [-1, 0, "ArrowLeft"], [0, 1, "ArrowDown"], [0, -1, "ArrowUp"]]) {
      const x = tx + dx, y = ty + dy;
      if (z.solid(x, y, p.z) || z.stand[x + y * z.w] !== p.z) continue;
      z.set(x, y, p.z, W.B.STATION); z.set(x, y, p.z + 1, W.B.STATION); z.refresh();
      p.genotype = "plumb"; p.funds = 200; p.inv.length = 0; p.inv.push({ kind: "implant", id: "lampCrown" });
      g.zone.creatures = g.zone.creatures.filter((c) => c.talk);
      T.refreshView(g);
      return { dir, t0: g.time };
    }
    return null;
  });
  if (!set) problems.push("no floor next to you for a Cradle");
  else {
    await key(set.dir);
    expect((await mode()) === "truing", `walking into the Cradle opens it (${await mode()})`);
    await shot("cradle");
    const rows = await page.evaluate(async () => (await import("/src/screens/equipment.js")).truingRows(window.game).map((r) => r.kind));
    await key("ArrowDown", rows.indexOf("pack"));
    await key("Enter");
    const r = await page.evaluate(() => ({ head: window.game.player.body.implants.head?.id || null, funds: window.game.player.funds, t: window.game.time }));
    expect(r.head === "lampCrown" && r.funds === 150 && r.t - set.t0 >= 60, `Enter fits the lamp crown: ${JSON.stringify(r)}`);
    await key("Escape");
    expect((await mode()) === "map", "Esc leaves the Cradle");
  }

  const audio = await page.evaluate(() => window.__audio.rerouted);
  log.push(`audio nodes rerouted to the zero-gain sink: ${audio}; cells ${cells}`);
  if (errors.length) problems.push(...errors.slice(0, 10));
} finally {
  await browser.close();
}
for (const l of log) console.log(l);
if (problems.length) { console.log(`FAIL browser-ws5 (${problems.length})`); for (const p of problems) console.log(`  ✗ ${p}`); process.exit(1); }
console.log("PASS browser-ws5");
