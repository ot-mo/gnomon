// WS4's wizard and level-up card in headless Chromium, with real key presses and real mouse clicks (not a check-*:
// it needs Playwright).
//   node tools/serve.mjs 8644 &           (from the worktree's root), then
//   NODE_PATH=$(npm root -g) node tools/browser-ws4.mjs [--port 8644] [--sizes 1280x720,600x330]
//
// The page is opened with ?silent=1 (audio.js's sink) and, before any page script, every audio node bound for the
// speakers is routed through an AnalyserNode and a zero-gain node too; ?quick=1 boots a quick game, the attribute
// set is switched on (rules.js overrideRules, as the integrator's flip will), and the wizard is pushed over the map
// with { seed, mode } as WS9's title pushes it. At each window size (600×330 is 100×30 cells here):
//   1. By keyboard: a Bent (Mesa Runner): Enter through the genotype, Esc back and on, a point moved from INT to
//      WIL with the arrows, the mutations step passed, the name typed over the suggestion with real key events, each
//      capital after a Shift keydown, and å, ä and ö as a Swedish keyboard sends them (CDP keyDown with the key, its
//      code and its text), Commons Lamp chosen, begun.
//   2. By mouse: a Plumb (Forgehand of Orrum): rows clicked, [-] [-] on INT and [+] on TOU, [ Next ], [ Suggest ],
//      Pilgrim, a step at the top to go back, [ Begin ].
//   3. The level-up card: a level gained, the power clicked.
// Each run begun must hold exactly the choices made. Fails on any console error or warning.
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8644);
const sizes = String(args.sizes || "1280x720,600x330").split(",").map((s) => s.split("x").map(Number));
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
// Real keys for the letters a US layout lacks: the key, its code on a Swedish keyboard, and the text it types.
const NORDIC = { "å": "BracketLeft", "ä": "Quote", "ö": "Semicolon", "Å": "BracketLeft", "Ä": "Quote", "Ö": "Semicolon" };
let failed = 0;
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
    const cdp = await page.context().newCDPSession(page);
    const errors = [], problems = [], log = [];
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
    await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&seed=1234`);
    await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
    await page.evaluate(async () => {
      const { canvasBackend } = await import("/src/screen-canvas.js");
      const present = canvasBackend.present.bind(canvasBackend);
      canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
      (await import("/src/rules.js")).overrideRules("stats", "attributes");
      window.__W = await import("/src/screens/create.js");
      window.__C = await import("/src/progression/chargen.js");
      window.__L = await import("/src/leveling.js");
    });
    const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const wiz = () => page.evaluate(() => window.__W.wizard());
    const expect = async (step, what) => {
      await frames(2);
      const got = (await wiz()).step;
      log.push(`${what}: ${got}`);
      if (got !== step) problems.push(`${what}: on ${got}, want ${step}`);
    };
    const key = async (k) => { await page.keyboard.press(k); await frames(1); };
    const typeName = async (text) => {
      for (const ch of text) {
        const shift = ch !== ch.toLowerCase();
        if (shift) await page.keyboard.down("Shift");   // a real Shift keydown first, as a person types a capital
        if (NORDIC[ch]) {
          for (const type of ["keyDown", "keyUp"])
            await cdp.send("Input.dispatchKeyEvent", { type, key: ch, code: NORDIC[ch], text: type === "keyDown" ? ch : undefined,
              unmodifiedText: type === "keyDown" ? ch.toLowerCase() : undefined, modifiers: shift ? 8 : 0 });
        } else await page.keyboard.type(ch);
        if (shift) await page.keyboard.up("Shift");
      }
      await frames(1);
    };
    const click = async (label, { row } = {}) => {
      await frames(2);
      const at = await page.evaluate(({ label, row }) => {
        const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
        for (let y = 0; y < f.rows; y++) {
          const line = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("");
          if (row && !line.includes(row)) continue;
          const x = line.indexOf(label);
          if (x >= 0) return { x: c.left + ((x + 0.5) / f.cols) * c.width, y: c.top + ((y + 0.5) / f.rows) * c.height };
        }
        return null;
      }, { label, row });
      if (!at) { problems.push(`"${label}" isn't on screen (${(await wiz()).step})`); return; }
      await page.mouse.click(at.x, at.y);
      await frames(1);
    };
    const open = (data) => page.evaluate(async (data) => {
      const screens = await import("/src/screens.js");
      screens.pushMode(window.game, "create", data, { pointer: false });   // as WS9's title does
    }, data);
    const begun = () => page.evaluate(() => {
      const p = window.game.player;
      return { name: p.name, genotype: p.genotype, background: p.background, attrs: p.attrs, mode: window.game.state.mode, seed: window.game.seed, in: window.game.mode };
    });
    const cells = await page.evaluate(async () => { const S = await import("/src/screen.js"); return `${S.cols}×${S.rows}`; });

    // --- 1. By keyboard: a Bent ------------------------------------------------------------------------------------
    await open({ seed: 4242, mode: "pilgrim" });
    await expect("genotype", "pushed with { seed, mode }");
    await key("Enter"); await expect("background", "Enter on Bent");
    await key("Escape"); await expect("genotype", "Esc on the background");
    await key("Enter");
    await key("ArrowDown"); await key("ArrowDown"); await key("Enter");   // Mesa Runner
    await expect("attributes", "Enter on the third background");
    const bought = (await wiz()).attrs;
    await key("ArrowDown"); await key("ArrowDown"); await key("ArrowDown"); await key("ArrowLeft");   // INT down
    await key("ArrowDown"); await key("ArrowRight");                                                     // WIL up
    const moved = (await wiz()).attrs;
    if (moved.int !== bought.int - 1 || moved.wil !== bought.wil + 1) problems.push(`the arrows moved ${JSON.stringify(bought)} to ${JSON.stringify(moved)}`);
    await key("Enter"); await expect("track", "Enter on the attributes");
    await key("Enter"); await expect("name", "Enter on the mutations");
    await typeName("Åsa Öberg-Ärla");
    const typed = (await wiz()).name;
    if (typed !== "Åsa Öberg-Ärla") problems.push(`typed "Åsa Öberg-Ärla", the field holds "${typed}"`);
    await key("Enter"); await expect("mode", "Enter on the name");
    await key("ArrowUp"); await key("Enter"); await expect("begin", "Commons Lamp");
    await key("Enter");
    await frames(3);
    let b = await begun();
    if (b.name !== "Åsa Öberg-Ärla" || b.genotype !== "bent" || b.background !== "mesaRunner" || b.mode !== "commonsLamp" || b.seed !== 4242 ||
        JSON.stringify(b.attrs) !== JSON.stringify(moved)) problems.push(`by keyboard the run began ${JSON.stringify(b)}`);
    log.push(`keyboard: ${b.name}, ${b.background}, ${b.mode}, in ${b.in}`);

    // --- 2. By mouse: a Plumb ----------------------------------------------------------------------------------------
    await open({ seed: 99, mode: "oneWick" });
    await click("Plumb"); await click("Plumb"); await expect("background", "two clicks on Plumb");
    await click("Forgehand of Orrum"); await click("Forgehand of Orrum"); await expect("attributes", "two clicks on Forgehand of Orrum");
    const before = (await wiz()).attrs;
    await click("[-]", { row: "INT" }); await click("[-]", { row: "INT" }); await click("[+]", { row: "TOU" });
    const after = (await wiz()).attrs;
    if (after.int !== before.int - 2 || after.tou !== before.tou + 1) problems.push(`the mouse moved ${JSON.stringify(before)} to ${JSON.stringify(after)}`);
    await click("[ Next ]"); await expect("track", "[ Next ] on the attributes");
    await click("[ Next ]"); await expect("name", "[ Next ] on the implant");
    await click("[ Suggest ]");
    const suggested = (await wiz()).name;
    if (!/-Orrum$/.test(suggested)) problems.push(`a Forgehand's suggested name is "${suggested}"`);
    await click("[ Next ]"); await expect("mode", "[ Next ] on the name");
    await click("Pilgrim"); await click("Pilgrim"); await expect("begin", "two clicks on Pilgrim");
    await click("Attributes", { row: "Genotype" }); await expect("attributes", "a click on Attributes at the top");
    for (let k = 0; k < 4; k++) await click("[ Next ]");
    await expect("begin", "four clicks on [ Next ]");
    await click("[ Begin ]");
    await frames(3);
    b = await begun();
    if (b.name !== suggested || b.genotype !== "plumb" || b.background !== "forgehandOfOrrum" || b.mode !== "pilgrim" || b.seed !== 99 ||
        JSON.stringify(b.attrs) !== JSON.stringify(after)) problems.push(`by mouse the run began ${JSON.stringify(b)}`);
    log.push(`mouse: ${b.name}, ${b.background}, ${b.mode}, in ${b.in}`);

    // --- 3. The level-up card by mouse -------------------------------------------------------------------------------
    for (let k = 0; k < 10 && (await page.evaluate(() => window.game.mode)) === "story"; k++) await key("Space");
    await page.evaluate(() => window.__L.gainXp(window.game, 20, { source: "quest" }));
    await frames(3);
    const card = await page.evaluate(() => ({ mode: window.game.mode, offers: [...window.game.perkChoices], perks: Object.keys(window.game.player.perks) }));
    if (card.mode !== "levelup" || card.offers.length < 3) problems.push(`no level-up card: ${JSON.stringify(card)}`);
    else {
      const name = await page.evaluate((id) => window.__L.PERKS[id].name, card.offers[1]);
      await click(name);
      await frames(2);
      const got = await page.evaluate(() => ({ mode: window.game.mode, perks: Object.keys(window.game.player.perks) }));
      if (got.mode === "levelup" || !got.perks.includes(card.offers[1])) problems.push(`clicking "${name}" left ${JSON.stringify(got)}`);
      log.push(`level-up card: clicked ${name}, back in ${got.mode}`);
    }

    const audio = await page.evaluate(() => window.__audio.rerouted);
    console.log(`${width}x${height} (${cells} cells): ${problems.length || errors.length ? "FAIL" : "PASS"}; audio nodes rerouted ${audio}`);
    for (const l of log) console.log(`  ${l}`);
    for (const p of [...problems, ...errors]) console.log(`  ✗ ${p}`);
    if (problems.length || errors.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
