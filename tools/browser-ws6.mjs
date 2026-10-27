// WS6a in headless Chromium (owner WS6; integration request: §8.4 tools/browser-ws6.mjs). Serve the tree first:
//   node tools/serve.mjs 8646        then        NODE_PATH="$(npm root -g)" node tools/browser-ws6.mjs [port] [screenshot dir]
// At 1280×720 and 600×330, ?silent=1 and every AudioDestinationNode routed through an analyser into a zero-gain node:
// the factions screen by P on the map (↓↓ moves the row, a click on "Esc close" closes it, P twice opens and closes)
// and in 3D (P, Esc); a Hollowmere villager struck by walking into it on the map with two fellows in sight (rep −10,
// all three hostile, one "saw you strike" line in the log); a priest of the Noon Vigil (a builder's talker) by a bump,
// its third option showing the faction's lore. Any console error fails it. Screenshots only when a directory is given.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const port = process.argv[2] || 8646, outDir = process.argv[3] || null;
const base = `http://127.0.0.1:${port}`;
const problems = [], errors = [], log = (s) => console.log(s);

function silence() {
  const orig = AudioNode.prototype.connect, sinks = new WeakMap();
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      let s = sinks.get(dest);
      if (!s) { const ctx = dest.context, an = ctx.createAnalyser(), mute = ctx.createGain(); mute.gain.value = 0; orig.call(an, mute); orig.call(mute, dest); s = an; sinks.set(dest, s); }
      return orig.call(this, s, ...rest);
    }
    return orig.call(this, dest, ...rest);
  };
}

const browser = await chromium.launch();
try {
  for (const [w, h] of [[1280, 720], [600, 330]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${w}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`${w}: pageerror ${e.message}`));
    await page.addInitScript(silence);
    await page.goto(`${base}/index.html?silent=1&quick=1&seed=1234`);
    await page.waitForFunction(() => window.game && window.game.zone && window.game.mode);
    const frames = (n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
    await page.evaluate(async () => {
      const { canvasBackend } = await import("/src/screen-canvas.js");
      const present = canvasBackend.present.bind(canvasBackend);
      canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
    });
    const mode = () => page.evaluate(() => window.game.mode);
    const frameText = () => page.evaluate(() => { const f = window.__frame; const out = []; for (let y = 0; y < f.rows; y++) out.push(f.chars.slice(y * f.cols, (y + 1) * f.cols).join("")); return out.join("\n"); });
    const clickText = async (label) => {
      await frames(2);
      const at = await page.evaluate(async (label) => {
        const S = await import("/src/screen.js"), c = document.getElementById("screen").getBoundingClientRect(), f = window.__frame;
        for (let y = 0; y < f.rows; y++) { const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label); if (x >= 0) return { x: c.left + ((x + 0.5) / S.cols) * c.width, y: c.top + ((y + 0.5) / S.rows) * c.height }; }
        return null;
      }, label);
      if (!at) { problems.push(`${w}: "${label}" isn't on screen in ${await mode()}`); return; }
      await page.mouse.click(at.x, at.y);
    };
    for (let k = 0; k < 12 && (await mode()) === "story"; k++) { await page.keyboard.press("Space"); await frames(2); }
    log(`${w}×${h}: after the intro, ${await mode()}`);
    if ((await mode()) === "map") { await page.keyboard.press("Tab"); await frames(6); log(`  Tab → ${await mode()}`); }
    // 3D: P opens it, Esc closes it.
    if ((await mode()) === "explore") {
      await page.keyboard.press("KeyP"); await frames(3);
      if ((await mode()) !== "factions") problems.push(`${w}: P in 3D led to ${await mode()}`);
      else {
        const t = await frameText();
        for (const want of ["FACTIONS", "Hollowmere", "Grey", "the Plumb Assize", "Dark"]) if (!t.includes(want)) problems.push(`${w}: 3D factions screen lacks "${want}"`);
        if (outDir) await page.screenshot({ path: `${outDir}/ws6-factions-3d-${w}.png` });
        await page.keyboard.press("Escape"); await frames(3);
        log(`  P in 3D → factions, Esc → ${await mode()}`);
      }
      await page.keyboard.press("Tab"); await frames(4);
    }
    await page.waitForFunction(() => window.game.mode === "map", null, { timeout: 8000 }).catch(() => {});
    if ((await mode()) !== "map") { problems.push(`${w}: never reached the map (${await mode()})`); await page.close(); continue; }
    // The map: P, ↓ ↓, a click on "Esc close"; then P and P.
    await page.keyboard.press("KeyP"); await frames(3);
    if ((await mode()) !== "factions") problems.push(`${w}: P on the map led to ${await mode()}`);
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await frames(3);
    const sel = await page.evaluate(() => window.game.factionsView?.sel);
    if (sel !== 2) problems.push(`${w}: two ↓ left the selection at ${sel}`);
    if (outDir) await page.screenshot({ path: `${outDir}/ws6-factions-map-${w}.png` });
    await clickText("Esc close"); await frames(3);
    log(`  P on the map → factions, ↓↓ → row ${sel}, a click on "Esc close" → ${await mode()}`);
    if ((await mode()) !== "map") problems.push(`${w}: the click on Esc close led to ${await mode()}`);
    await page.keyboard.press("KeyP"); await frames(2); await page.keyboard.press("KeyP"); await frames(2);
    if ((await mode()) !== "map") problems.push(`${w}: P, P led to ${await mode()}`);

    // 3D: into the explore view as Tab does (toggleMap, the cube found), then P, the list, Esc; back to the map.
    await page.evaluate(async () => { window.game.story.cube = true; const P = await import("/src/screens/play.js"); P.toggleMap?.(window.game); });
    await frames(6);
    if ((await mode()) !== "explore") problems.push(`${w}: toggleMap left ${await mode()}`);
    else {
      await page.keyboard.press("KeyP"); await frames(3);
      if ((await mode()) !== "factions") problems.push(`${w}: P in 3D led to ${await mode()}`);
      else {
        const t3 = await frameText();
        for (const want of ["FACTIONS", "Hollowmere", "Grey", "the Plumb Assize", "Dark"]) if (!t3.includes(want)) problems.push(`${w}: the 3D factions screen lacks "${want}"`);
        if (outDir) await page.screenshot({ path: `${outDir}/ws6-factions-3d-${w}.png` });
        await page.keyboard.press("Escape"); await frames(3);
        log(`  3D: P → factions, Esc → ${await mode()}`);
        if ((await mode()) !== "explore") problems.push(`${w}: Esc in 3D left ${await mode()}`);
      }
      await page.evaluate(async () => { const P = await import("/src/screens/play.js"); P.toggleMap?.(window.game); });
      await frames(6);
    }
    // A villager beside you and two who can see it; strike it by walking into it.
    const set = await page.evaluate(async () => {
      const C = await import("/src/creatures.js"), F = await import("/src/factions.js"), R = await import("/src/raycast.js");
      const g = window.game, z = g.zone, p = g.player, tx = Math.floor(p.x), ty = Math.floor(p.y);
      const ok = (x, y) => x >= 0 && y >= 0 && x < z.w && y < z.d && z.stand[x + y * z.w] >= 0 && Math.abs(z.stand[x + y * z.w] - p.z) < 1 && !C.creatureAt(z, x, y);
      const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => ok(tx + dx, ty + dy));
      const spots = [];
      for (let y = ty - 5; y <= ty + 5; y++) for (let x = tx - 5; x <= tx + 5; x++) {
        const d = Math.hypot(x - tx, y - ty);
        if (d >= 2 && ok(x, y) && R.lineOfSight(z, x + 0.5, y + 0.5, z.stand[x + y * z.w] + 1.4, p.x, p.y, p.z + 1.5)) spots.push([x, y]);
      }
      if (!side || spots.length < 2) return null;
      const put = (x, y, name) => { const c = C.spawnCreature("goblin", x, y, z.stand[x + y * z.w], { rng: Math.random, level: 2 }); c.faction = { hollowmere: 1 }; c.brain = { temperament: "docile" }; c.name = name; c.xp = 0; return C.addCreature(z, c); };
      const v = put(tx + side[0], ty + side[1], "reed-cutter");
      window.__ws6 = { v, w: [put(...spots[0], "eel-netter"), put(...spots[1], "salt-raker")] };
      return { side, rep: F.repOf(g, "hollowmere"), att: [v, ...window.__ws6.w].map((c) => F.attitude(g, c, p)) };
    });
    if (!set) { problems.push(`${w}: no room for the villagers`); await page.close(); continue; }
    const key = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" }[set.side.join()];
    await page.keyboard.press(key); await frames(4);
    const after = await page.evaluate(async () => {
      const F = await import("/src/factions.js"), g = window.game, { v, w } = window.__ws6;
      return { rep: F.repOf(g, "hollowmere"), att: [v, ...w].map((c) => F.attitude(g, c, g.player)), alive: g.zone.creatures.includes(v), log: (g.messages || g.logLines || []).slice?.(-4) };
    });
    const t = await frameText();
    log(`  struck the reed-cutter on the map (${key}): Hollowmere ${set.rep} → ${after.rep}; attitudes ${set.att.join("/")} → ${after.att.join("/")}`);
    if (after.rep !== set.rep - 10) problems.push(`${w}: Hollowmere ${set.rep} → ${after.rep}, want −10`);
    if (after.att.some((a) => a !== "hostile")) problems.push(`${w}: after the blow ${after.att.join(", ")}`);
    const saw = await page.evaluate(() => window.game.messages.map((m) => m.text).filter((t) => /saw you strike/.test(t)));
    log(`  the log: ${JSON.stringify(saw)}`);
    if (saw.length !== 1) problems.push(`${w}: the log has ${saw.length} "saw you strike" lines`);
    if (outDir) await page.screenshot({ path: `${outDir}/ws6-struck-${w}.png` });
    // A priest of the Noon Vigil: walk into it to talk.
    const pr = await page.evaluate(async () => {
      const C = await import("/src/creatures.js"), g = window.game, z = g.zone, p = g.player;
      for (const c of [...z.creatures]) if (!c.talk) C.removeCreature(z, c);
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      const ok = (x, y) => z.stand[x + y * z.w] >= 0 && Math.abs(z.stand[x + y * z.w] - p.z) < 1 && !C.creatureAt(z, x, y);
      const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => ok(tx + dx, ty + dy));
      const c = C.spawnCreature("maren", tx + side[0], ty + side[1], z.stand[tx + side[0] + (ty + side[1]) * z.w], { level: 2, talk: { dialogue: "priest", state: {} } });
      c.faction = { noonVigil: 1 }; c.name = "Sister Ivo";
      C.addCreature(z, c);
      return side;
    });
    await page.keyboard.press({ "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" }[pr.join()]); await frames(3);
    if ((await mode()) !== "talk") problems.push(`${w}: walking into the priest led to ${await mode()}`);
    else {
      await page.keyboard.press("Space"); await frames(2);
      const g1 = await frameText();
      if (!/Tell me about the Noon Vigil/.test(g1)) problems.push(`${w}: the priest's root lacks "Tell me about the Noon Vigil."`);
      await page.keyboard.press("Digit3"); await frames(2); await page.keyboard.press("Space"); await frames(2);
      const g2 = await frameText();
      if (!/keeps the noon-posts/.test(g2)) problems.push(`${w}: the faction's lore isn't shown`);
      if (outDir) await page.screenshot({ path: `${outDir}/ws6-priest-${w}.png` });
      await page.keyboard.press("Escape"); await frames(2);
      log(`  the priest: talk, option 3 (the Noon Vigil's lore), Esc → ${await mode()}`);
    }
    await page.close();
  }
} finally { await browser.close(); }
for (const e of errors) problems.push(`console: ${e}`);
console.log(problems.length ? `FAIL\n  ✗ ${problems.join("\n  ✗ ")}` : "PASS browser-ws6");
process.exit(problems.length ? 1 : 0);
