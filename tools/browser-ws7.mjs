// WS7b's pray quests in headless Chromium, with real key presses (the integrator's, at the WS7b merge: docs/ws7.md
// request 17, the dependency table's WS8 look in 3D and WS3's night). Serve the tree first:
//   node tools/serve.mjs 8660 &           (from the repository root), then
//   NODE_PATH=$(npm root -g) node tools/browser-ws7.mjs [--port 8660] [--shots DIR]
// The test world's first seed with a village whose quest is a prayer at a carved shrine (a relief: 3D, in good light)
// and one whose quest is a prayer at a rune shrine (3D, in the dark, the torch out), found by building the runs here
// (content changes move the villages' draws: C2's name lists did; seed 1's were Reedwick and Reedwick Cross). Both are given at
// their givers (talk.js's options), then in 3D, standing two tiles from the shrine and facing its block, L (WS8's
// crosshair look): the rune by day with the torch out (no prayer), at 21:00 with the torch lit (none), then F and L (the
// prayer, and the log's "Pray at the shrine of …: go back to …"); the relief that night with the torch out (none), then
// at 10:00 the next day with it lit (the prayer, the same line). The clock only moves forward. A shrine is a block, not
// a mural: the look's own line only names it ("Carved stone.", "Carved panel."). Each L opens WS5's examine
// screen, which Esc closes (a refused pointer lock's pause card is clicked away, as in browser-ws8).
//
// Before any page script, every audio node bound for the speakers is routed through an AnalyserNode and a zero-gain
// node, and the page is opened with ?silent=1: nothing reaches the speakers. Fails on any console error or warning.
import { createRequire } from "node:module";
import { parseArgs, installNodeEnv } from "./node-env.mjs";

const args = parseArgs();
const port = Number(args.port || 8660), shots = args.shots || null;
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const problems = [], log = [], errors = [];
await installNodeEnv({ cols: 100, rows: 30 });
await import("../src/game.js"); await import("../src/content/index.js");
const { buildRun } = await import("../src/world/run.js"), { TEST_WORLD } = await import("../src/content/world/test-world.js");
let SEED = null, CASES = null;
for (let s = 1; s <= 300 && !CASES; s++) {
  const r = buildRun(s, TEST_WORLD);
  const at = (shrine) => [...r.villages.values()].find((v) => !v.abandoned && v.quest?.template === "pray" && v.culture.shrine === shrine)?.siteId;
  if (at("relief") && at("rune")) { SEED = s; CASES = { relief: at("relief"), rune: at("rune") }; }
}
if (!CASES) throw new Error("no test-world seed of 1-300 has prayers at both a relief and a rune shrine");
console.log(`seed ${SEED}: ${JSON.stringify(CASES)}`);
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
  await page.goto(`http://127.0.0.1:${port}/index.html?silent=1&quick=1&world=test&seed=${SEED}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode === "story");
  const mode = () => page.evaluate(() => window.game.mode);
  const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const expect = (ok, what) => { log.push(`${ok ? "ok" : "FAIL"}: ${what}`); if (!ok) problems.push(what); };
  const key = async (k) => { await page.keyboard.press(k); await frames(2); };
  const unpause = async () => { if ((await mode()) === "pause") { await page.mouse.click(640, 360); await frames(5); } };
  for (let k = 0; k < 8 && (await mode()) === "story"; k++) await key("Space");
  expect((await mode()) === "map", `after the intro: ${await mode()}`);

  // Both quests, at their givers.
  const given = await page.evaluate(async (CASES) => {
    const talk = await import("/src/talk.js"), VQ = await import("/src/story/villagequests.js"), g = window.game, out = {};
    g.story.cube = true;
    for (const [kind, siteId] of Object.entries(CASES)) {
      const v = g.run.villages.get(siteId), site = g.run.sites.get(siteId);
      g.debug.enterZone(`${site.at.wx},${site.at.wy},0`, "edge");
      const giver = g.zone.creatures.find((c) => c.uid === v.quest.params.giver);
      const ask = giver && talk.talkTo(g, giver).options.find((o) => /anything I can do/.test(o.label));
      ask?.go().options.find((o) => /do it/.test(o.label))?.go();
      const q = g.quests.find((x) => x.id === VQ.villageQuestId(siteId));
      out[kind] = { template: v.quest.template, shrine: v.culture.shrine, stage: q?.stage, kind: g.zone.village.shrine.kind };
    }
    return out;
  }, CASES);
  for (const kind of Object.keys(CASES))
    expect(given[kind].template === "pray" && given[kind].shrine === kind && given[kind].kind === kind && given[kind].stage === "pray",
      `${CASES[kind]}: a prayer at a ${kind} shrine, given (${JSON.stringify(given[kind])})`);
  // The two first visits' XP may raise a level: take the first offer (1), as the bot does.
  for (let k = 0; k < 8 && (await mode()) !== "map"; k++) await key((await mode()) === "levelup" ? "Digit1" : "Escape");
  expect((await mode()) === "map", `on the map again (${await mode()})`);

  // Into a village, on the map, then Tab into 3D, two tiles from the shrine and facing its block.
  const goTo = async (kind) => {
    if ((await mode()) !== "map") { await key("Tab"); await frames(5); await unpause(); }
    await page.evaluate((siteId) => { const g = window.game, s = g.run.sites.get(siteId); g.debug.enterZone(`${s.at.wx},${s.at.wy},0`, "edge"); }, CASES[kind]);
    await frames(3);
    await key("Tab"); await frames(5); await unpause();
    expect((await mode()) === "explore", `${kind}: Tab into 3D (${await mode()})`);
  };
  const face = () => page.evaluate(async () => {
    const W = await import("/src/world.js"), { EYE } = await import("/src/player.js"), g = window.game, z = g.zone, p = g.player, sh = z.village.shrine;
    const free = (x, y) => z.get(x, y, W.FLOOR_Z) === 0 && z.get(x, y, W.FLOOR_Z + 1) === 0 && z.get(x, y, W.FLOOR_Z - 1) !== 0;
    const side = [[0, 2], [0, -2], [2, 0], [-2, 0]].find(([dx, dy]) => free(sh.x + dx, sh.y + dy) && free(sh.x + dx / 2, sh.y + dy / 2));
    p.x = sh.x + side[0] + 0.5; p.y = sh.y + side[1] + 0.5; p.z = W.FLOOR_Z;
    const tx = sh.x + 0.5 - p.x, ty = sh.y + 0.5 - p.y, tz = sh.z + 0.5 - (p.z + EYE);
    p.yaw = Math.atan2(ty, tx); p.pitch = Math.atan2(tz, Math.hypot(tx, ty));
  });
  const at = (t) => page.evaluate((t) => { window.game.time = t; }, t);
  const torch = async (want) => { if ((await page.evaluate(() => !!window.game.player.torch)) !== want) await key("KeyF"); return page.evaluate(() => !!window.game.player.torch); };
  // L, then Esc out of the examine screen: the quest's stage, the light, and the look's lines in the log.
  const look = async (kind) => {
    await face(); await frames(2);
    const m0 = await page.evaluate(() => window.game.messages.length);
    await key("KeyL");
    const r = await page.evaluate(async ({ siteId, m0 }) => {
      const VQ = await import("/src/story/villagequests.js"), L = await import("/src/light.js"), g = window.game;
      const q = g.quests.find((x) => x.id === VQ.villageQuestId(siteId));
      return { stage: q?.stage, mode: g.mode, daylight: +L.daylight(g).toFixed(2), torch: !!g.player.torch, lines: g.messages.slice(m0).map((m) => m.text) };
    }, { siteId: CASES[kind], m0 });
    if (r.mode === "examine") { await key("Escape"); await frames(3); await unpause(); }
    return r;
  };

  // The rune: by day with the torch out, at night with it lit (neither), at night with it out (the prayer).
  await goTo("rune");
  await at(4 * 60);   // 10:00 of day 1
  const back = (r) => r.lines.some((l) => /^Pray at the shrine of .+: go back to .+\.$/.test(l));
  let lit = await torch(false), r = await look("rune");
  expect(!lit && r.stage === "pray" && !back(r) && r.daylight > 0.5, `rune, 10:00, torch out: no prayer (${JSON.stringify(r)})`);
  await at(15 * 60);   // 21:00
  lit = await torch(true); r = await look("rune");
  expect(lit && r.stage === "pray" && !back(r) && r.daylight < 0.2, `rune, 21:00, torch lit: no prayer (${JSON.stringify(r)})`);
  lit = await torch(false); r = await look("rune");
  expect(!lit && r.stage === "return" && back(r), `rune, 21:00, F then L: prayed, and told so (${JSON.stringify(r)})`);
  if (shots) await page.screenshot({ path: `${shots}/ws7-rune-night.png` });

  // The relief: that night with the torch out (no prayer), the next morning with it lit (the prayer).
  await goTo("relief");
  lit = await torch(false); r = await look("relief");
  expect(!lit && r.stage === "pray" && !back(r) && r.daylight < 0.2, `relief, 21:00, torch out: no prayer (${JSON.stringify(r)})`);
  await at(24 * 60 + 4 * 60);   // 10:00 of day 2
  lit = await torch(true); r = await look("relief");
  expect(lit && r.stage === "return" && r.daylight > 0.5 && back(r), `relief, 10:00 the next day, torch lit: prayed, and told so (${JSON.stringify(r)})`);
  if (shots) await page.screenshot({ path: `${shots}/ws7-relief-day.png` });
  expect((await mode()) === "explore", `back in 3D at the end (${await mode()})`);

  const audio = await page.evaluate(() => window.__audio);
  log.push(`audio: ${audio.rerouted} connections rerouted to the silent sink`);
  await page.close();
} finally {
  await browser.close();
}
for (const e of errors) problems.push(e);
for (const l of log) console.log(`  ${l}`);
console.log(problems.length ? `FAIL browser-ws7 (${problems.length})` : "PASS browser-ws7");
process.exit(problems.length ? 1 : 0);
