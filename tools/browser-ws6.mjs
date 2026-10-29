// WS6a in headless Chromium (owner WS6; integration request: §8.4 tools/browser-ws6.mjs). Serve the tree first:
//   node tools/serve.mjs 8646        then        NODE_PATH="$(npm root -g)" node tools/browser-ws6.mjs [port] [screenshot dir]
// At 1280×720 and 600×330, ?silent=1 and every AudioDestinationNode routed through an analyser into a zero-gain node:
// the factions screen by P on the map (↓↓ moves the row, a click on "Esc close" closes it, P twice opens and closes)
// and in 3D (P, Esc); a Hollowmere villager struck by walking into it on the map with two fellows in sight (rep −10,
// all three hostile, one "saw you strike" line in the log); a priest of the Noon Vigil (a builder's talker) by a bump,
// its third option showing the faction's lore. WS6b: a Drover merchant by a bump, "Show me what you have." → the trade
// screen (a buy by Enter, Tab to yours, a click on "Esc back"); the Kindling with it on the map (only the Tracing
// offered; its words; "Sit with me a while." → the ritual screen); in 3D with the torch lit, facing a Hollowmere villager
// (E to talk): only the Lighting, 1 glim; F puts the torch out, and with a Lampless villager in the dark only the
// Snuffing, an hour (60 s of game time) passing; Pell's services on the trade screen. Any console error fails it.
// Screenshots only when a directory is given.
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
    await page.goto(`${base}/index.html?silent=1&quick=1&world=test&seed=1234`);
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
    // Shift + the direction: on the map a creature not out for you is in the way, and Shift strikes it (WS8's turns.js).
    await page.keyboard.down("Shift"); await page.keyboard.press(key); await page.keyboard.up("Shift"); await frames(4);
    const after = await page.evaluate(async () => {
      const F = await import("/src/factions.js"), g = window.game, { v, w } = window.__ws6;
      return { rep: F.repOf(g, "hollowmere"), att: [v, ...w].map((c) => F.attitude(g, c, g.player)), alive: g.zone.creatures.includes(v), log: (g.messages || g.logLines || []).slice?.(-4) };
    });
    const t = await frameText();
    log(`  struck the reed-cutter on the map (Shift+${key}): Hollowmere ${set.rep} → ${after.rep}; attitudes ${set.att.join("/")} → ${after.att.join("/")}`);
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

    // --- WS6b: the trade screen, then the Kindling's three rites, each in its view ---------------------------------
    // A named person of a faction beside you (on a free side), stood still.
    const beside = (type, dialogue, faction, name, avoid = []) => page.evaluate(async ({ type, dialogue, faction, name, avoid }) => {
      const C = await import("/src/creatures.js"), g = window.game, z = g.zone, p = g.player;
      const tx = Math.floor(p.x), ty = Math.floor(p.y);
      const ok = (x, y) => z.stand[x + y * z.w] >= 0 && Math.abs(z.stand[x + y * z.w] - p.z) < 1 && !C.creatureAt(z, x, y) && !avoid.some(([ax, ay]) => ax === x && ay === y);
      const side = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => ok(tx + dx, ty + dy));
      if (!side) return null;
      const c = C.spawnCreature("mira", tx + side[0], ty + side[1], z.stand[tx + side[0] + (ty + side[1]) * z.w], { level: 2, talk: { dialogue, state: {} } });
      c.faction = { [faction]: 1 }; c.name = name; c.named = true; c.brain = { temperament: "docile" };
      C.addCreature(z, c);
      (window.__ws6b ||= {})[name] = c;
      return { side, at: [tx + side[0], ty + side[1]] };
    }, { type, dialogue, faction, name, avoid });
    const arrow = (side) => ({ "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" }[side.join()]);
    const optionIndex = (re) => page.evaluate((src) => (window.game.talk?.node?.options || []).findIndex((o) => new RegExp(src).test(o.label)), re.source);
    const choose = async (re, what) => {
      await page.keyboard.press("Space"); await frames(2);   // the words typed out at once
      const k = await optionIndex(re);
      if (k < 0) { problems.push(`${w}: ${what}: no option ${re} (${await page.evaluate(() => (window.game.talk?.node?.options || []).map((o) => o.label).join(" | "))})`); return false; }
      await page.keyboard.press(`Digit${k + 1}`); await frames(3);
      return true;
    };
    await page.evaluate(async () => { const C = await import("/src/creatures.js"), z = window.game.zone; for (const c of [...z.creatures]) if (c.faction) C.removeCreature(z, c); window.game.player.funds = 200; });
    // Trade: a Drover merchant by a bump; "Show me what you have." → the trade screen; Enter buys; Tab; "Esc back".
    const tr = await beside("mira", "merchant", "drovers", "Lu");
    if (!tr) problems.push(`${w}: no room for the merchant`);
    else {
      await page.keyboard.press(arrow(tr.side)); await frames(3);
      if ((await mode()) !== "talk") problems.push(`${w}: walking into the merchant led to ${await mode()}`);
      else if (await choose(/what you have/, "the merchant")) {
        if ((await mode()) !== "trade") problems.push(`${w}: "Show me what you have." led to ${await mode()}`);
        else {
          const t1 = await frameText();
          for (const want of ["LU", "THEIRS", "services", "EGO", "glim"]) if (!t1.includes(want)) problems.push(`${w}: the trade screen lacks "${want}"`);
          if (outDir) await page.screenshot({ path: `${outDir}/ws6b-trade-${w}.png` });
          const f0 = await page.evaluate(() => window.game.player.funds);
          const pick = await page.evaluate(async () => { const M = await import("/src/social/merchants.js"), g = window.game; const rows = M.tradeRows(g, g.trade.npc, "theirs"); return rows.findIndex((r) => r.price <= g.player.funds); });
          for (let k = 0; k < pick; k++) await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter"); await frames(2);
          const f1 = await page.evaluate(() => window.game.player.funds);
          if (!(f1 < f0)) problems.push(`${w}: Enter on theirs: funds ${f0} → ${f1}`);
          await page.keyboard.press("Tab"); await frames(2);
          const t2 = await frameText();
          if (!t2.includes("YOURS")) problems.push(`${w}: Tab didn't show yours`);
          await clickText("Esc back"); await frames(3);
          log(`  trade: talk → trade (theirs), a buy by Enter (${f0} → ${f1} glim), Tab → yours, a click on "Esc back" → ${await mode()}`);
          if ((await mode()) !== "talk") problems.push(`${w}: the click on "Esc back" led to ${await mode()}`);
        }
      }
      // The Tracing, on the map, beside Lu: "Will you kindle with me?" → "The Tracing." → "Sit with me a while." → the menu.
      if ((await mode()) === "talk" && await choose(/kindle with me/, "the Tracing")) {
        const offered = await page.evaluate(() => window.game.talk.node.options.map((o) => o.label));
        if (!offered.includes("The Tracing.") || offered.includes("The Lighting.") || offered.includes("The Snuffing.")) problems.push(`${w}: on the map the rites offered are ${offered.join(" | ")}`);
        if (await choose(/^The Tracing/, "the Tracing")) {
          await page.keyboard.press("Space"); await frames(2);   // the words, typed out at once
          const tt = await frameText();
          if (!tt.includes("Here is my line.")) problems.push(`${w}: the Tracing's words aren't shown`);
          if (await choose(/Sit with me/, "after the Tracing")) {
            const tr2 = await frameText();
            if ((await mode()) !== "ritual" || !tr2.includes("THE KINDLING")) problems.push(`${w}: "Sit with me a while." led to ${await mode()}`);
            if (outDir) await page.screenshot({ path: `${outDir}/ws6b-kindling-${w}.png` });
            await page.keyboard.press("Escape"); await frames(2);
            log(`  the Tracing on the map with Lu: flame-kin ${await page.evaluate(async () => !!(await import("/src/social/ritual.js")).kin(window.game, window.__ws6b.Lu))}; the menu, Esc → ${await mode()}`);
          }
        }
      }
      await page.keyboard.press("Escape"); await frames(2);
      if ((await mode()) !== "map") problems.push(`${w}: after Lu, ${await mode()}`);
    }
    // The Lighting in 3D, torch lit, facing Bel: E talks; only the Lighting is offered; 1 glim goes.
    const bel = await beside("mira", "villager", "hollowmere", "Bel", tr ? [tr.at] : []);
    await page.evaluate(async () => { const P = await import("/src/screens/play.js"); P.toggleMap?.(window.game); });
    await frames(6);
    const face = (name) => page.evaluate((name) => { const g = window.game, c = window.__ws6b[name], p = g.player; p.yaw = Math.atan2(c.y - p.y, c.x - p.x); p.pitch = -0.15; }, name);
    const talk3d = async (name) => {
      await face(name); await frames(2);
      await page.keyboard.press("KeyE"); await frames(3);
      if ((await mode()) === "talk") return "E";
      await page.evaluate(async (name) => (await import("/src/dialogue.js")).openTalk(window.game, window.__ws6b[name]), name);
      await frames(2);
      return "openTalk";
    };
    if (!bel || (await mode()) !== "explore") problems.push(`${w}: no 3D Lighting (${bel ? await mode() : "no room"})`);
    else {
      const how = await talk3d("Bel");
      const f0 = await page.evaluate(() => window.game.player.funds);
      if (await choose(/kindle with me/, "the Lighting")) {
        const offered = await page.evaluate(() => window.game.talk.node.options.map((o) => o.label));
        if (!offered.includes("The Lighting.") || offered.includes("The Tracing.")) problems.push(`${w}: in lit 3D the rites offered are ${offered.join(" | ")}`);
        if (await choose(/^The Lighting/, "the Lighting")) {
          await page.keyboard.press("Space"); await frames(2);
          const t = await frameText(), f1 = await page.evaluate(() => window.game.player.funds);
          if (!t.includes("My light on your wick.") || f1 !== f0 - 1) problems.push(`${w}: the Lighting: words ${t.includes("My light on your wick.")}, funds ${f0} → ${f1}`);
          if (outDir) await page.screenshot({ path: `${outDir}/ws6b-lighting-${w}.png` });
          log(`  the Lighting in 3D with Bel (talk by ${how}): ${f0} → ${f1} glim`);
        }
      }
      await page.keyboard.press("Escape"); await frames(3);
      // The Snuffing: F puts the torch out; in the dark with Cay of the Lampless, an hour passes.
      const cay = await page.evaluate(async () => {
        const C = await import("/src/creatures.js"), g = window.game, z = g.zone, b = window.__ws6b.Bel;
        C.removeCreature(z, b);
        const c = C.spawnCreature("mira", b.tx, b.ty, b.z, { level: 2, talk: { dialogue: "villager", state: {} } });
        c.faction = { lampless: 1 }; c.name = "Cay"; c.named = true; c.brain = { temperament: "docile" };
        C.addCreature(z, c); window.__ws6b.Cay = c;
        return true;
      });
      if ((await mode()) !== "explore") problems.push(`${w}: after Bel, ${await mode()}`);
      await page.keyboard.press("KeyF"); await frames(3);
      const lit = await page.evaluate(() => window.game.player.torch);
      if (lit) problems.push(`${w}: F didn't put the torch out in 3D`);
      const how2 = await talk3d("Cay");
      const t0 = await page.evaluate(() => window.game.time);
      if (cay && await choose(/kindle with me/, "the Snuffing")) {
        const offered = await page.evaluate(() => window.game.talk.node.options.map((o) => o.label));
        if (!offered.includes("The Snuffing.") || offered.includes("The Lighting.")) problems.push(`${w}: in the dark the rites offered are ${offered.join(" | ")}`);
        if (await choose(/^The Snuffing/, "the Snuffing")) {
          const t1 = await page.evaluate(() => window.game.time), kin = await page.evaluate(async () => !!(await import("/src/social/ritual.js")).kin(window.game, window.__ws6b.Cay));
          if (!(t1 - t0 >= 59.9) || !kin) problems.push(`${w}: the Snuffing: ${t1 - t0} s passed, flame-kin ${kin}`);
          if (outDir) await page.screenshot({ path: `${outDir}/ws6b-snuffing-${w}.png` });
          log(`  the Snuffing in the dark with Cay (talk by ${how2}): ${Math.round(t1 - t0)} s passed, flame-kin ${kin}`);
        }
      }
      await page.keyboard.press("Escape"); await frames(2);
      await page.keyboard.press("KeyF"); await frames(2);
    }
    // Pell's services on the trade screen (an unknown sword in the pack: "Identify").
    const pellRows = await page.evaluate(async () => {
      const C = await import("/src/creatures.js"), M = await import("/src/social/merchants.js"), g = window.game, z = g.zone;
      const pell = C.spawnCreature("pell", Math.floor(g.player.x), Math.floor(g.player.y), g.player.z, { talk: { dialogue: "pell", state: { stock: [] } } });
      C.addCreature(z, pell);
      g.player.inv.push({ kind: "weapon", id: "longsword", ench: 1, known: false });
      M.openTrade(g, pell, "services");
      return M.tradeRows(g, pell, "services").map((r) => r.service.id);
    });
    await frames(3);
    const tp = await frameText();
    if (!pellRows.includes("identify") || !/Identify the/.test(tp)) problems.push(`${w}: Pell's services on the trade screen: ${pellRows.join(", ")}`);
    log(`  Pell's services on the trade screen: ${pellRows.join(", ")}`);
    await page.keyboard.press("Escape"); await frames(2);
    await page.close();
  }
} finally { await browser.close(); }
for (const e of errors) problems.push(`console: ${e}`);
console.log(problems.length ? `FAIL\n  ✗ ${problems.join("\n  ✗ ")}` : "PASS browser-ws6");
process.exit(problems.length ? 1 : 0);
