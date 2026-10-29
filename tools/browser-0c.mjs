// The 0C browser smoke, in headless Chromium with real key presses (not a check-*: it needs Playwright).
//   node tools/serve.mjs 8642 &           (from the repository root; Python's http.server drops requests on Windows), then
//   node tools/browser-0c.mjs [--port 8642] [--seeds 1234,7]
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a
// zero-gain node (silent), and since 0D2 the page is opened with ?silent=1 (audio.js's own sink, proven by
// browser-silent.mjs), so the init script is the second guard; and with ?quick=1, straight into a new quick game past the title screen. Per seed, on legacy level 3 with the cube in hand: fights in both views and both
// rule sets, counted on the bus ("attack" events from combat.js): on the map, arrow keys into a monster
// (legacy, then d20); in 3D, facing a monster and pressing Enter (the swing), legacy then d20. Then talk: walk into
// Pell on the map, read his news with a digit key, open his shop and its services tab, Esc back, leave.
// Fails on any console error or warning, a fight with no blows, or a talk that doesn't open.
import { createRequire } from "node:module";
import { parseArgs } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8642), seeds = String(args.seeds || "1234,7").split(",").map(Number);
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
let failed = 0;
try {
  for (const seed of seeds) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
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
    await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&world=test&seed=${seed}`);
    await page.waitForFunction(() => window.game && window.game.zone && window.game.mode);
    for (let k = 0; k < 20 && await page.evaluate(() => window.game.mode === "story"); k++) await page.keyboard.press("Space");
    await page.evaluate(async () => {
      const { on } = await import("/src/events.js");
      window.__blows = { hit: 0, miss: 0 };
      on("attack", (g, { att, result }) => { if (att === g.player) window.__blows[result.hit ? "hit" : "miss"]++; });
      const R = await import("/src/rules.js");
      window.__setCombat = (r) => { window.__undo?.(); window.__undo = R.overrideRules("combat", r); };
      window.__creatures = await import("/src/creatures.js");
    });
    // Set up a fight: level 3, one monster next to you, the rest gone; you can't die.
    const fightSetup = (dir) => page.evaluate((dir) => {
      const game = window.game, C = window.__creatures;
      if (game.zone.key !== "0,0,3") game.debug.enterZone("0,0,3", "down");
      game.pages = null; game.story.cube = true;
      const zone = game.zone, p = game.player;
      p.maxHpGain = p.hp = 1e6;
      zone.creatures = zone.creatures.filter((c) => C.canTalk(c));
      const [px, py] = [Math.floor(p.x), Math.floor(p.y)];
      const [ox, oy] = dir;
      const m = C.addCreature(zone, C.spawnCreature("goblin", px + ox, py + oy, zone.stand[px + ox + (py + oy) * zone.w], { rng: Math.random, state: "chase", level: 3 }));
      m.hp = m.maxHp = 1e6;
      window.__blows.hit = window.__blows.miss = 0;
      return { at: [px, py], monster: [m.tx, m.ty], stand: zone.stand[m.tx + m.ty * zone.w] };
    }, dir);
    const blows = () => page.evaluate(() => ({ ...window.__blows }));
    const free = await page.evaluate(() => {   // a direction with standable ground at your height
      const g = window.game;
      g.debug.enterZone("0,0,3", "down"); g.pages = null; g.story.cube = true;
      const x2 = Math.floor(g.player.x), y2 = Math.floor(g.player.y), z2 = g.zone;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([ox, oy]) => z2.stand[x2 + ox + (y2 + oy) * z2.w] === z2.stand[x2 + y2 * z2.w]);
    });
    const key = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" }[free.join()];
    const result = { seed };
    // Map, legacy then d20.
    for (const rules of ["legacy", "d20"]) {
      await page.evaluate((r) => { window.__setCombat(r); window.game.mode = "map"; window.game.view = "map"; }, rules);
      await fightSetup(free);
      for (let k = 0; k < (rules === "legacy" ? 10 : 30); k++) await page.keyboard.press(key);
      result[`map ${rules}`] = await blows();
    }
    // 3D, legacy then d20: Tab to 3D, face the monster, Enter swings (one swing's time apart).
    for (const rules of ["legacy", "d20"]) {
      await page.evaluate((r) => { window.__setCombat(r); window.game.mode = "map"; window.game.view = "map"; }, rules);
      await fightSetup(free);
      await page.keyboard.press("Tab");
      await page.evaluate((d) => { const g = window.game; g.player.yaw = Math.atan2(d[1], d[0]); g.player.pitch = 0; g.paused = false; }, free);
      for (let k = 0; k < 15; k++) {
        await page.evaluate(() => { window.game.paused = false; });
        await page.keyboard.press("Enter");
        await page.waitForTimeout(450);
      }
      result[`3d ${rules}`] = await blows();
    }
    result.mode3d = await page.evaluate(() => `${window.game.mode}/${window.game.view}`);
    // Talk to Pell on the map (level 2 in every legacy run).
    const talk = await page.evaluate(() => {
      const g = window.game, C = window.__creatures;
      g.debug.enterZone("0,0,2", "down"); g.pages = null; g.mode = "map"; g.view = "map";
      const z = g.zone, pell = C.talkersIn(z).find((c) => c.type === "pell");
      if (!pell) return { error: "no Pell on level 2" };
      z.creatures = C.talkersIn(z);
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = pell.tx + ox, y = pell.ty + oy;
        if (z.stand[x + y * z.w] === pell.z) { Object.assign(g.player, { x: x + 0.5, y: y + 0.5, z: pell.z }); return { dir: [-ox, -oy] }; }
      }
      return { error: "no tile beside Pell" };
    });
    if (talk.error) result.talk = talk.error;
    else {
      await page.keyboard.press({ "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" }[talk.dir.join()]);
      const opened = await page.evaluate(() => window.game.mode);
      await page.keyboard.press("Space");   // show the words at once
      const news = await page.evaluate(() => window.game.talk?.node.options.findIndex((o) => /news/.test(o.label)));
      await page.keyboard.press(`Digit${news + 1}`);
      await page.keyboard.press("Space");
      const said = await page.evaluate(() => window.game.talk?.node.text.slice(0, 40));
      await page.keyboard.press("Digit1");   // "Interesting." back to the root
      await page.keyboard.press("Space");
      await page.keyboard.press("Digit1");   // "Show me your wares."
      const shop = await page.evaluate(() => window.game.mode);
      await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
      const services = await page.evaluate(() => `${window.game.shop?.tab}`);
      await page.waitForTimeout(100);
      await page.keyboard.press("Escape");
      const back = await page.evaluate(() => window.game.mode);
      await page.keyboard.press("Escape");
      result.talk = { opened, said, shop, services, back, after: await page.evaluate(() => window.game.mode) };
      if (opened !== "talk" || shop !== "shop" || services !== "services" || back !== "talk" || result.talk.after !== "map") failed++;
    }
    result.audioRerouted = await page.evaluate(() => window.__audio.rerouted);
    result.errors = errors.length;
    for (const k of ["map legacy", "map d20", "3d legacy", "3d d20"]) if (!result[k] || result[k].hit + result[k].miss === 0) failed++;
    if (errors.length) { failed++; console.log(errors.slice(0, 5).join("\n")); }
    console.log(JSON.stringify(result));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failed ? `FAIL (${failed})` : "PASS");
process.exit(failed ? 1 : 0);
