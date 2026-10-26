// The 0D1 shell in headless Chromium, with real key presses and real mouse clicks (not a check-*: it needs
// Playwright).
//   node tools/serve.mjs 8642 &           (from the repository root; Python's http.server drops requests on Windows), then
//   NODE_PATH=$(npm root -g) node tools/browser-shell.mjs [--port 8642] [--seed 1234] [--sizes 1280x720,600x300]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a
// zero-gain node (silent), and since 0D2 the page is opened with ?silent=1 (audio.js's own sink, proven by
// browser-silent.mjs), so the init script is the second guard; and with ?quick=1, straight into a new quick game past the title screen. At each window size (600×300 is 100×30 cells): the intro paged by Space,
// then by clicks; on the map I and J by keys and by clicks on their words in the header, closed by Esc / J
// and by "I close" / a click; the cube (game.onCube) and its pages; the pause card under them, closed by a
// click (which takes the pointer lock); losing the lock (document.exitPointerLock) opens pause, and I, J
// and Tab work from it; so does a lock request refused (Esc closing the inventory over 3D); Tab and Esc between the views, "Tab: 3D" clicked; Pell by keys (his pack, Esc
// back, Esc out) and by clicks (an answer, the services tab, "Esc back", "Esc to leave"); a level gained
// (1, and a click on a perk); stairs (the "DEPTH n" beat); death (R, and a click on "Press R…"). Also a text
// field pushed for the test takes "m", "Ö" and "M" from real keys without toggling the music. Fails on any
// console error or warning, or a mode that isn't where it should be.
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8642), seed = Number(args.seed || 1234);
const sizes = String(args.sizes || "1280x720,600x300").split(",").map((s) => s.split("x").map(Number));
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
let failed = 0;
try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height } });
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
    await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&seed=${seed}`);
    await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
    // Keep the last presented frame's characters, to find words to click.
    await page.evaluate(async () => {
      const { canvasBackend } = await import("/src/screen-canvas.js");
      const present = canvasBackend.present.bind(canvasBackend);
      canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
    });
    const mode = () => page.evaluate(() => window.game.mode);
    const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    const expect = async (want, what) => {
      await frames(2);
      const got = await mode();
      log.push(`${what}: ${got}`);
      if (got !== want) problems.push(`${what}: in ${got}, want ${want} (stack ${await page.evaluate(() => window.game.modeStack.map((e) => e.mode).join(">"))})`);
    };
    const key = async (k) => { await page.keyboard.press(k); };
    const click = async (label, button = "left") => {
      await frames(2);
      const at = await page.evaluate((label) => {
        const f = window.__frame, c = document.getElementById("screen").getBoundingClientRect();
        for (let y = 0; y < f.rows; y++) {
          const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label);
          if (x >= 0) return { x: c.left + ((x + 0.5) / f.cols) * c.width, y: c.top + ((y + 0.5) / f.rows) * c.height };
        }
        return null;
      }, label);
      if (!at) { problems.push(`"${label}" isn't on screen in ${await mode()}`); return; }
      await page.mouse.click(at.x, at.y, { button });
    };
    const cells = await page.evaluate(async () => { const S = await import("/src/screen.js"); return `${S.cols}×${S.rows}`; });

    // The intro: Space, then (a new run) clicks.
    for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");
    await expect("map", "Space through the intro");
    await page.evaluate(() => window.game.debug.startRun(window.game.seed));
    for (let k = 0; k < 8 && (await mode()) === "story"; k++) await click("Space / click: continue");
    await expect("map", "clicks through the intro");

    // A text field on top takes every key (screens.js, ui.js textInput).
    await page.evaluate(async () => {
      const screens = await import("/src/screens.js"), ui = await import("/src/ui.js");
      const field = (window.__field = { text: "", max: 20 });
      screens.registerScreen("test:name", {
        draw: () => ui.drawTextInput(2, 4, 20, field),
        key(g, code, repeat, key) { if (ui.textInput(field, code, key)) screens.popMode(g); return true; },
      });
      window.__music0 = window.game.messages.filter((m) => /^Music/.test(m.text)).length;
      screens.pushMode(window.game, "test:name");
    });
    await page.keyboard.type("m");
    await page.keyboard.press("Shift+KeyM");
    await page.evaluate(() => dispatchEvent(new KeyboardEvent("keydown", { code: "Semicolon", key: "Ö" })));   // Playwright types Ö without a keydown
    await key("Enter");
    const typed = await page.evaluate(() => ({ text: window.__field.text, music: window.game.messages.filter((m) => /^Music/.test(m.text)).length - window.__music0 }));
    if (typed.text !== "mMÖ" || typed.music) problems.push(`the text field: "${typed.text}", music toggled ${typed.music} times`);
    await expect("map", "Enter in the text field");

    // I and J, by keys and by clicks on the header's words.
    await key("KeyI"); await expect("inventory", "I");
    await key("Escape"); await expect("map", "Esc in the inventory");
    await key("KeyJ"); await expect("journal", "J");
    await key("KeyJ"); await expect("map", "J in the journal");
    await click("I: inventory"); await expect("inventory", "clicking I: inventory");
    await click("I close"); await expect("map", "clicking I close");
    await click("J: journal"); await expect("journal", "clicking J: journal");
    await click("JOURNAL"); await expect("map", "a click in the journal");

    // The cube, its pages, and the pause card under them; a click plays (and takes the pointer lock).
    await page.evaluate(() => window.game.onCube());
    await expect("rotate", "touching the cube");
    await page.waitForFunction(() => window.game.mode === "story", null, { timeout: 10000 });
    for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Enter");
    await expect("pause", "after the cube's pages");
    await click("Click to play"); await expect("explore", "a click on the pause card");
    await frames(5);
    const locked = await page.evaluate(() => document.pointerLockElement === document.getElementById("screen"));
    log.push(`pointer locked after the click: ${locked}`);
    // Losing the lock opens pause.
    await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await frames(5);
    if (locked) await expect("pause", "losing the pointer lock in 3D");
    else { problems.push("no pointer lock in this browser: the lock-loss test fell back to onLockChange"); }
    if ((await mode()) !== "pause") await page.evaluate(() => window.game.debug.lockChange(false));
    await key("KeyI"); await expect("inventory", "I from the pause card");
    await key("KeyI"); await expect("explore", "I closing the inventory into 3D");
    await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await frames(5);
    if ((await mode()) !== "pause") await page.evaluate(() => window.game.debug.lockChange(false));
    await click("J journal"); await expect("journal", "clicking J journal on the pause card");
    await key("Escape"); await expect("explore", "Esc in the journal over 3D");
    await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await frames(5);
    if ((await mode()) !== "pause") await page.evaluate(() => window.game.debug.lockChange(false));
    // The lock request refused (a real browser refuses the one Esc makes closing a screen once the player took
    // the lock away: Escape is not a user activation; headless grants every request, so the refusal is
    // played here as Chrome does it, a rejected promise and pointerlockerror): the pause card, not 3D running.
    await click("I inventory"); await expect("inventory", "clicking \"I inventory\" on the pause card");
    await page.evaluate(() => {
      const c = document.getElementById("screen");
      c.__request = c.requestPointerLock;
      c.requestPointerLock = () => {
        setTimeout(() => document.dispatchEvent(new Event("pointerlockerror")));
        return Promise.reject(new DOMException("The user has exited the lock", "NotAllowedError"));
      };
    });
    await key("Escape"); await frames(3); await expect("pause", "Esc in the inventory over 3D, the lock request refused");
    // Every request refused (a frame without pointer lock, say): the card's click is refused too, and 3D then
    // runs with keyboard look instead of the card coming back on every click.
    await click("Click to play"); await frames(3); await expect("explore", "a click on the card, its lock request refused too");
    await page.evaluate(() => { const c = document.getElementById("screen"); c.requestPointerLock = c.__request; delete c.__request; });
    await page.mouse.click(Math.floor(width / 2), Math.floor(height / 2)); await frames(5);   // a click in the view: the lock now
    if ((await mode()) !== "explore") problems.push(`after the lock came back: in ${await mode()}`);
    await page.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); });
    await frames(5);
    if ((await mode()) !== "pause") await page.evaluate(() => window.game.debug.lockChange(false));
    await key("Tab"); await expect("map", "Tab from the pause card");
    await click("Tab: 3D"); await expect("explore", "clicking Tab: 3D");
    await key("Tab"); await expect("map", "Tab in 3D");
    await key("Escape"); await expect("explore", "Esc on the map");
    await key("Tab"); await expect("map", "Tab in 3D (again)");

    // Pell: keys, then clicks.
    await page.evaluate(async () => {
      const C = await import("/src/creatures.js"), E = await import("/src/content/legacy/encounters.js"), R = await import("/src/rng.js");
      const g = window.game, p = g.player;
      window.__pell = C.spawnCreature("pell", Math.floor(p.x), Math.floor(p.y), p.z, { level: 5, talk: { state: { stock: E.peddlerStock(R.makeRng(3), 5) } } });
      g.onTalk(window.__pell);
    });
    await expect("talk", "walking into Pell");
    await key("Space"); await key("Digit1"); await expect("shop", "1: his wares");
    await key("Tab"); await key("Escape"); await expect("talk", "Esc in the pack");
    await key("Escape"); await expect("map", "Esc in talk");
    await page.evaluate(() => window.game.onTalk(window.__pell));
    await page.waitForFunction(() => !window.game.talk || window.game.talk.shown >= window.game.talk.length, null, { timeout: 15000 });
    await click("Show me your wares."); await expect("shop", "clicking his wares");
    await click("services");
    if ((await page.evaluate(() => window.game.shop?.tab)) !== "services") problems.push("clicking the services tab");
    await click("Esc back"); await expect("talk", "clicking Esc back");
    await click("Esc to leave"); await expect("map", "clicking Esc to leave");

    // A level gained: 1, then a click on a perk.
    await page.evaluate(() => { window.game.player.pendingLevels = 1; });
    await expect("levelup", "a level gained");
    await key("Digit1"); await expect("map", "1 on the levelup screen");
    await page.evaluate(() => { window.game.player.pendingLevels = 1; });
    await expect("levelup", "another level");
    const perk = await page.evaluate(async () => { const L = await import("/src/leveling.js"); return L.perkLabel(window.game.player, window.game.perkChoices[0]); });
    await click(perk); await expect("map", `clicking "${perk}"`);

    // Stairs, death, a new run.
    await page.evaluate(() => window.game.debug.changeFloor("0,0,1", "down", "You descend the stairs..."));
    await expect("transition", "taking the stairs");
    await page.waitForFunction(() => window.game.mode === "map", null, { timeout: 5000 });
    await page.evaluate(() => window.game.hurtPlayer(99999, "a test"));
    await expect("dead", "a killing blow");
    await key("KeyR"); await expect("story", "R on the death card");
    for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");
    await page.evaluate(() => window.game.hurtPlayer(99999, "a test"));
    await click("Press R to start a new run"); await expect("story", "clicking Press R");

    const audio = await page.evaluate(() => window.__audio.rerouted);
    const bad = problems.length + errors.length;
    console.log(`${bad ? "FAIL" : "PASS"} ${width}×${height} (${cells} cells): ${log.length} mode changes checked, pointer lock ${locked ? "taken and lost" : "unavailable"}, audio nodes silenced ${audio}`);
    for (const p of [...problems, ...errors]) console.log(`  ✗ ${p}`);
    if (args.verbose) for (const l of log) console.log(`  ${l}`);
    failed += bad;
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
