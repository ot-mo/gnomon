// C4 in headless Chromium, with real key presses (not a check-*: it needs Playwright): a made Reedcutter's kit (the
// copper hand-axe, the reed cloak, two balm tonics) in the pack on the map, examine's description of the hand-axe (L),
// a balm injected by E (the HUD's BALM, health rising), a stick of marker chalk used by E on the map and another in 3D
// (the zone's marks, the map's marker glyph, the 3D view drawn facing the first), the held hand-axe in 3D, and a forged
// saltsteel glaive's name and line. Screenshots of each with --shots.
//   node tools/serve.mjs 8674 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-c4.mjs [--port 8674] [--seed 4242] [--shots DIR]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a zero-gain
// node, and the page is opened with ?silent=1: nothing reaches the speakers. Fails on any console error or warning.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./node-env.mjs";
const args = parseArgs();
const port = Number(args.port || 8674), seed = Number(args.seed || 4242), shots = args.shots ? String(args.shots) : null;
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
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(k); await frames(2); if (process.env.C4_TRACE) console.log("  key", k, n, "->", await page.evaluate(() => `${window.game.mode} ${window.game.view}`)); };
  const screenText = async () => { await frames(2); return page.evaluate(() => window.__frame.chars.join("")); };
  const closeInv = async () => { if ((await mode()) === "inventory") await key("Escape"); };   // (E on a consumable closes it itself)
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  const toMap = async () => { for (let k = 0; k < 12 && (await mode()) === "story"; k++) await key("Space"); if ((await mode()) === "explore") await key("Tab"); };
  // The pack's row of a thing, selected (the inventory opens on the Pack tab; ↓ walks the rows).
  const selectPack = async (pred) => {
    const k = await page.evaluate((src) => window.game.player.inv.findIndex(new Function("it", `return ${src}`)), pred);
    if (k < 0) return false;
    await page.evaluate(() => { window.game.invSel = 0; });
    await key("ArrowDown", k);
    return page.evaluate((k) => window.game.invSel === k, k);
  };

  // A Reedcutter of the Bent, begun as the title's wizard begins one (chargen.beginRun).
  await toMap();
  await page.evaluate(async (seed) => {
    const C = await import("/src/progression/chargen.js");
    C.beginRun(window.game, { genotype: "bent", background: "reedcutter", attrs: C.suggestSpread("bent", "reedcutter"), name: "Ylva", mode: "oneWick" }, { seed });
  }, seed);
  await frames(4);
  await toMap();
  await page.evaluate(() => { window.game.story.cube = true; });   // the world turns once the cube is had (as the checks set it)
  expect((await mode()) === "map", `a Reedcutter's run reaches the map (${await mode()})`);

  // The pack on the map: the kit's names.
  await key("KeyI");
  let t = await screenText();
  expect(t.includes("balm tonic"), 'the Pack tab on the map shows "balm tonic"');
  await key("Tab");
  t = await screenText();
  expect(t.includes("copper hand-axe") && t.includes("reed cloak"), "the Equipment tab shows the hand-axe in hand and the cloak on the back");
  await shot("1-map-equipment");
  await key("Tab");
  // Examine the hand-axe (it is worn, so from the Equipment tab: L on the right hand).
  await key("Tab");
  await page.evaluate(async () => { const inv = await import("/src/inventory.js"); window.game.eqSel = inv.bodyRows(window.game).findIndex((r) => r.part?.id === "hand_r"); });
  await key("KeyL");
  t = await screenText();
  expect((await mode()) === "examine" && t.includes("A reedcutter's axe") && t.includes("copper: soft and green"), `examine shows the hand-axe's description and its copper (${await mode()})`);
  await shot("2-map-examine-hand-axe");
  await key("Escape");
  await key("Tab");   // back to the Pack tab

  // A balm by E: the HUD's BALM, health rising in game time.
  await page.evaluate(() => { const p = window.game.player; p.hp = Math.max(1, p.hp - 10); });
  const hp0 = await page.evaluate(() => window.game.player.hp);
  expect(await selectPack("it.kind === 'tonic' && it.effect === 'balm'"), "the balm tonic selected in the pack");
  await key("KeyE");
  await closeInv();
  t = await screenText();
  const balmHud = t.includes("BALM");
  expect((await mode()) === "map", `still on the map after the balm (${await mode()})`);
  await page.keyboard.press("Space"); await frames(4);   // a wait on the map lets the 3 s run
  for (let k = 0; k < 4; k++) { await page.keyboard.press("Space"); await frames(2); }
  const hp1 = await page.evaluate(() => window.game.player.hp);
  expect(balmHud && hp1 > hp0, `a balm by E on the map: the HUD showed BALM (${balmHud}), health ${hp0} → ${hp1}`);
  await shot("3-map-after-balm");

  // Marker chalk by E on the map, then two steps east.
  await page.evaluate(() => { window.game.player.inv.push({ kind: "tool", effect: "markerChalk", count: 3 }); window.game.zone.markers.length = 0; });
  const at = await page.evaluate(() => [Math.floor(window.game.player.x), Math.floor(window.game.player.y)]);
  await key("KeyI");
  expect(await selectPack("it.kind === 'tool'"), "the chalk selected in the pack");
  await key("KeyE");
  await closeInv();
  const marks = await page.evaluate(() => window.game.zone.markers.map((m) => [m.x, m.y]));
  expect(JSON.stringify(marks) === JSON.stringify([at]), `marker chalk by E on the map marks your tile (${JSON.stringify(marks)}, at ${JSON.stringify(at)})`);
  for (const k of ["KeyD", "KeyD", "KeyS", "KeyS", "KeyA", "KeyW"]) { await key(k); }
  const moved = await page.evaluate((at) => Math.floor(window.game.player.x) !== at[0] || Math.floor(window.game.player.y) !== at[1], at);
  t = await screenText();
  await shot("4-map-chalk-mark");

  // 3D: the hand-axe held; the mark drawn where it was made, facing it; a second stick used by E in 3D.
  await key("Tab");
  expect((await mode()) === "explore", `Tab turns to 3D (${await mode()})`);
  await page.evaluate((at) => { const p = window.game.player; p.yaw = Math.atan2(at[1] + 0.5 - p.y, at[0] + 0.5 - p.x); p.pitch = -0.25; }, at);
  await frames(6);
  await shot("5-3d-facing-the-mark");
  const held = await page.evaluate(async () => { const B = await import("/src/body.js"); const w = B.wielded(window.game.player); return w && `${w.made} ${w.id}`; });
  expect(held === "copper handAxe", `in 3D the hand-axe is in hand (${held})`);
  await key("KeyI");
  expect(await selectPack("it.kind === 'tool'"), "the chalk selected in the pack, over 3D");
  await key("KeyE");
  await closeInv();
  expect((await mode()) === "explore", `still in 3D after the chalk (${await mode()})`);
  const marks3d = await page.evaluate(() => window.game.zone.markers.length);
  const left = await page.evaluate(() => window.game.player.inv.find((it) => it.kind === "tool")?.count);
  expect(moved && marks3d === 2 && left === 1, `a second mark by E in 3D (${marks3d} marks, ${left} stick left; you had moved: ${moved})`);

  // A forged piece's name and line: a saltsteel glaive.
  const glaive = await page.evaluate(async () => {
    const G = await import("/src/content/items/gear.js"), I = await import("/src/items.js");
    const it = G.makeGear("weapon", "glaive", "saltsteel");
    return { name: I.itemName(window.game, it), info: I.itemInfo(window.game, it), price: I.itemPrice(it) };
  });
  expect(glaive.name === "saltsteel glaive" && glaive.info.startsWith("7-11 damage") && glaive.price === 220, `a saltsteel glaive: ${JSON.stringify(glaive)}`);
  log.push(`the glaive: ${JSON.stringify(glaive)}`);

  const audio = await page.evaluate(() => window.__audio.rerouted);
  log.push(`audio: ${audio} connections to the speakers rerouted to a zero-gain analyser (and ?silent=1)`);
  await page.close();
} catch (err) {
  problems.push(`threw: ${err.stack || err}`);
} finally {
  await browser.close();
}
for (const e of errors) problems.push(e);
for (const l of log) console.log(l);
console.log(problems.length ? `FAIL browser-c4: ${problems.length} problem(s)\n  ${problems.join("\n  ")}` : "PASS browser-c4");
process.exit(problems.length ? 1 : 0);
