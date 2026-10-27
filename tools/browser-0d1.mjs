// The 0D1 gate (TECH_DESIGN §8.2 "0D1") in headless Chromium. Not a check-*: it needs Playwright, which the
// repository doesn't depend on (run-all stays dependency-free).
//   NODE_PATH=$(npm root -g) node tools/browser-0d1.mjs [--against p0-0c] [--frames 200] [--rounds 8] [--skip shell,frametime]
//
// It serves the repository (and, for the frame-time comparison, `git archive <against>` unpacked into a
// temporary folder) on free ports, and before any page script routes every audio node bound for the
// speakers through an AnalyserNode and a zero-gain node (silent), and since 0D2 the page is opened with ?silent=1 (audio.js's own sink, proven by
// browser-silent.mjs), so the init script is the second guard; and with ?quick=1, straight into a new quick game past the title screen. Then:
//   1. Every mode by keys and by the mouse: tools/browser-shell.mjs, run against this server at 1280×720 and
//      600×300 (100×30 cells): the intro, I, J, the cube, pause, Tab, Esc, Pell's talk and pack, a level
//      gained, stairs, death; a text field takes "m", "Ö" and "M" from real keys without toggling the
//      music; losing the pointer lock in 3D opens pause. Here too: the victory card (the Lich King's
//      epilogue paged by Space, then by clicks; R and a click on "Press R…"), and since 0D2 the title screen (the
//      page without ?quick=1: Enter, then a click on "New quick game"), since WS8's merge the target screen
//      (L on the map; Esc, a right click) and since WS4a's the creation wizard (pushed over the map as WS9's
//      title will push it; Esc, a click on [ Back ]), so every registered mode is reached.
//   2. The HUD at 100×30 (a 600-pixel window 30 cells tall: 300 px with 10-pixel cells, 330 with Windows'
//      11): tests/checks/hud.js in the browser (screen sizes 100×30,
//      100×40, 180×56, 80×25), then on the real canvas with every Phase 0 segment and seven statuses on, in
//      both views: one row, every piece drawn whole inside 100 columns, location and HP shown, and nothing
//      dropped that outranks something shown.
//   3. Golden frame hashes underground: tests/checks/golden.js's frames part (legacy levels 3, 8, 15 at
//      180×56, 27 frames) recorded in the browser and compared with tests/fixtures/golden/frames.json.
//   4. Frame time: this tree against <against> (default p0-0c) in one page (both trees' modules loaded side
//      by side, the page's own loop stopped); underground (legacy level 3) and on the start span, 3D and
//      map: one run set up per case and tree (creatures on a seeded Math.random, 60 ticks to warm up), then
//      5×rounds blocks of frames/5 tick(1/60) calls per tree, the two trees alternating tick by tick (ABBA)
//      while the camera turns through a full circle. Underground (3D and map) must be within 5% of <against>:
//      the ratio of the pooled trimmed means (each tree's slowest 5% left out). Pooled p50/p95/mean are printed,
//      and the quartiles of the blocks' ratios as a guide to the noise.
// Exits non-zero on any failure, console error or warning.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { ROOT, parseArgs } from "./node-env.mjs";

const args = parseArgs();
const AGAINST = String(args.against || "p0-0c"), FRAMES = Number(args.frames || 200), ROUNDS = Number(args.rounds || 8);
const SKIP = new Set(String(args.skip || "").split(",").filter(Boolean));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.log("browser-0d1: Playwright is not installed (try NODE_PATH=$(npm root -g))"); process.exit(2); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
                ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
// mounts: { "/__against": dir } serves another tree under a prefix (the frame-time comparison loads both
// trees' modules into one page).
const mounts = {};
async function serve(root) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, "http://x").pathname), dir = root;
    for (const [prefix, d] of Object.entries(mounts)) if (rel.startsWith(`${prefix}/`)) { dir = d; rel = rel.slice(prefix.length); }
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { server, port: server.address().port, base: `http://127.0.0.1:${server.address().port}` };
}

// Before any page script: everything bound for the speakers goes to an analyser and then a zero-gain node.
function silence() {
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
}

const here = await serve(ROOT);
let baseDir = null;
const browser = await chromium.launch();
const problems = [], errors = [];
const out = (s) => console.log(s);

async function openPage(base, width, height, seed = 1234) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${base === here.base ? "" : `${AGAINST}: `}${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(silence);
  await page.goto(`${base}/index.html?silent=1&quick=1&seed=${seed}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode);
  return page;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { let k = 0; const f = () => (++k >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

try {
  // --- 1. Every mode by keys and mouse (browser-shell.mjs), and the victory card ------------------------
  if (!SKIP.has("shell")) {
    const reached = new Set();
    const shell = await new Promise((ok) => {
      const child = spawn(process.execPath, [path.join(ROOT, "tools", "browser-shell.mjs"), "--port", String(here.port), "--verbose"],
                          { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
      let text = "";
      child.stdout.on("data", (d) => { text += d; });
      child.stderr.on("data", (d) => { text += d; });
      child.on("close", (code) => ok({ code, text }));
    });
    for (const line of shell.text.split("\n")) {
      const m = /^ {2}(.+): (\w+)$/.exec(line);
      if (m && !/^pointer locked/.test(m[1])) reached.add(m[2]);
      if (/^(PASS|FAIL) /.test(line) || /^ {2}✗/.test(line)) out(`  shell: ${line.trim()}`);
    }
    if (shell.code !== 0) problems.push(`browser-shell.mjs failed (exit ${shell.code})`);

    const page = await openPage(here.base, 600, 300);
    const mode = () => page.evaluate(() => window.game.mode);
    const click = async (label) => {
      await frames(page, 2);
      const at = await page.evaluate(async (label) => {
        const S = await import("/src/screen.js"), c = document.getElementById("screen").getBoundingClientRect();
        const f = window.__frame;
        for (let y = 0; y < f.rows; y++) {
          const x = f.chars.slice(y * f.cols, (y + 1) * f.cols).join("").indexOf(label);
          if (x >= 0) return { x: c.left + ((x + 0.5) / S.cols) * c.width, y: c.top + ((y + 0.5) / S.rows) * c.height };
        }
        return null;
      }, label);
      if (!at) { problems.push(`victory: "${label}" isn't on screen in ${await mode()}`); return; }
      await page.mouse.click(at.x, at.y);
    };
    await page.evaluate(async () => {
      const { canvasBackend } = await import("/src/screen-canvas.js");
      const present = canvasBackend.present.bind(canvasBackend);
      canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
    });
    const won = async (how) => {
      for (let k = 0; k < 8 && (await mode()) === "story"; k++) await page.keyboard.press("Space");
      await page.evaluate(async () => { const H = await import("/src/content/legacy/story-hooks.js"); H.win(window.game); });
      await frames(page, 2);
      for (let k = 0; k < 12 && (await mode()) === "story"; k++) {
        if (how === "keys") await page.keyboard.press("Space"); else await click("Space / click: continue");
        await frames(page, 2);
      }
      const at = await mode();
      if (at !== "won") { problems.push(`victory by ${how}: the epilogue led to ${at}, not won`); return; }
      reached.add("won");
      if (how === "keys") await page.keyboard.press("KeyR"); else await click("Press R to start a new run");
      await frames(page, 2);
      const after = await mode();
      if (after !== "story") problems.push(`victory by ${how}: ${how === "keys" ? "R" : "a click on Press R"} led to ${after}, not a new run's intro`);
    };
    await won("keys");
    await won("mouse");
    // The title screen (0D2): the page opens on it without ?quick=1; Enter, then a click on "New quick game",
    // start a run (its intro).
    for (const how of ["keys", "mouse"]) {
      await page.goto(`${here.base}/index.html?silent=1&seed=1234`);
      await page.waitForFunction(() => window.game && window.game.mode === "title");
      await page.evaluate(async () => {   // (a new page: what it presents is kept again, for click())
        const { canvasBackend } = await import("/src/screen-canvas.js");
        const present = canvasBackend.present.bind(canvasBackend);
        canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); window.__frame = { chars: chars.slice(), cols, rows }; };
      });
      await frames(page, 2);
      if (how === "keys") await page.keyboard.press("Enter"); else await click("New quick game");
      await frames(page, 2);
      const after = await mode();
      if (after !== "story") problems.push(`title by ${how}: ${how === "keys" ? "Enter" : "a click on New quick game"} led to ${after}, not the intro`);
      else reached.add("title");
    }
    // The target screen (WS8's, merged at p2-ws8): from the new run's intro to the map, L opens the look cursor;
    // Esc closes it, and again by the mouse, a right click.
    for (let k = 0; k < 12 && (await mode()) === "story"; k++) { await page.keyboard.press("Space"); await frames(page, 2); }
    if ((await mode()) === "explore") await page.keyboard.press("Tab");
    await page.waitForFunction(() => window.game.mode === "map", null, { timeout: 10000 }).catch(() => {});
    if ((await mode()) !== "map") problems.push(`target: the new run never reached the map (in ${await mode()})`);
    else for (const how of ["keys", "mouse"]) {
      await page.keyboard.press("KeyL");
      await frames(page, 2);
      const opened = await mode();
      if (opened !== "target") { problems.push(`target by ${how}: L on the map led to ${opened}, not target`); break; }
      reached.add("target");
      if (how === "keys") await page.keyboard.press("Escape");
      else { const c = await page.evaluate(() => { const r = document.getElementById("screen").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await page.mouse.click(c.x, c.y, { button: "right" }); }
      await frames(page, 2);
      const closed = await mode();
      if (closed !== "map") problems.push(`target by ${how}: ${how === "keys" ? "Esc" : "a right click"} led to ${closed}, not back to the map`);
    }
    // The creation wizard (WS4's, merged at p2-ws4a): pushed over the map with { seed, mode } as WS9's title will
    // push it (no key opens it before that title is in); Esc on its first step goes back, and again by a click on
    // its [ Back ].
    if ((await mode()) === "map") for (const how of ["keys", "mouse"]) {
      await page.evaluate(async () => { const S = await import("/src/screens.js"); S.pushMode(window.game, "create", { seed: 1234, mode: "commonsLamp" }, { pointer: false }); });
      await frames(page, 2);
      const opened = await mode();
      if (opened !== "create") { problems.push(`create: pushed over the map, the mode is ${opened}`); break; }
      reached.add("create");
      if (how === "keys") await page.keyboard.press("Escape"); else await click("[ Back ]");
      await frames(page, 2);
      const closed = await mode();
      if (closed !== "map") problems.push(`create by ${how}: ${how === "keys" ? "Esc" : "a click on [ Back ]"} on its first step led to ${closed}, not back to the map`);
    }
    const all = await page.evaluate(async () => [...(await import("/src/screens.js")).SCREENS.keys()].filter((m) => !m.startsWith("test:")));
    const missing = all.filter((m) => !reached.has(m));
    out(`${missing.length || shell.code ? "FAIL" : "PASS"} modes: ${reached.size} of ${all.length} registered reached by keys and clicks (${[...reached].sort().join(", ")})`);
    if (missing.length) problems.push(`modes never reached: ${missing.join(", ")}`);
    await page.close();
  }

  // --- 2. The HUD at 100×30 -----------------------------------------------------------------------------
  if (!SKIP.has("hud")) {
    const page = await openPage(here.base, 600, 300);
    // 600 px is 100 columns (6-pixel cells); a cell's height follows the browser's monospace font (10 px with
    // DejaVu Sans Mono, 11 with Windows' Consolas), so the window is made 30 cells tall whatever the font.
    const cellH = await page.evaluate(async () => (await import("/src/screen.js")).cellH);
    if (cellH * 30 !== 300) {
      await page.setViewportSize({ width: 600, height: cellH * 30 });
      await page.evaluate(async () => {   // (the page's resize listener calls S.resize)
        const S = await import("/src/screen.js");
        for (let k = 0; k < 100 && S.rows !== 30; k++) await new Promise((ok) => setTimeout(ok, 20));
      });
    }
    const r = await page.evaluate(async () => {
      const S = await import("/src/screen.js"), { canvasBackend } = await import("/src/screen-canvas.js");
      const G = await import("/src/game.js"), hud = await import("/src/hud.js");
      const game = window.game, cells = `${S.cols}×${S.rows}`;
      window.requestAnimationFrame = () => 0;   // the page's own loop stops: this test draws
      // (a) tests/checks/hud.js, its screen sizes on a capture backend.
      const size = { cols: 100, rows: 30 }, capture = { chars: null, colors: null, cols: 100, rows: 30, presents: 0 };
      S.setBackend({
        resize: () => ({ ...size, cellW: 11, cellH: 20 }),
        cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
        present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
      });
      S.resize();
      const resize = (cols, rows) => { Object.assign(size, { cols, rows }); S.resize(); };
      const { checkHud } = await import("/tests/checks/hud.js");
      const check = checkHud({ game, startRun: G.startRun, inputHandlers: G.inputHandlers, hud, renderMap: await import("/src/renderMap.js"),
                               events: await import("/src/events.js"), status: await import("/src/status.js"), zones: await import("/src/zones.js"),
                               S, capture, resize });
      // (b) The real canvas, 100×30: every segment on, both views.
      S.setBackend(canvasBackend); S.resize();
      const status = await import("/src/status.js");
      let shown = null;
      const present = canvasBackend.present.bind(canvasBackend);
      canvasBackend.present = (chars, colors, cols, rows) => { present(chars, colors, cols, rows); shown = { chars: chars.slice(), cols, rows }; };
      G.startRun(7);
      game.pages = null; game.story.cube = true; game.fps = 60; game.frameMs = 1.5;
      const p = game.player;
      for (const id of ["flying", "hasted", "shadowed", "poisoned", "darkened", "burning", "blinded"]) status.addStatus(game, p, id, { t: 30 });
      p.torch = true; p.keys = 3;
      const views = {};
      for (const [m, v] of [["map", "map"], ["explore", "3d"]]) {
        game.mode = m; game.view = v; game.paused = false;
        G.draw();
        const layout = hud.layoutHud(game), y0 = v === "map" ? 1 : 0, issues = [];
        layout.rows.forEach((row, k) => {
          const line = shown.chars.slice((y0 + k) * shown.cols, (y0 + k + 1) * shown.cols).join("");
          for (const q of row) {
            if (q.x < 0 || q.x + q.text.length > shown.cols) issues.push(`${q.id} runs off the screen`);
            else if (line.slice(q.x, q.x + q.text.length) !== q.text) issues.push(`${q.id} "${q.text}" isn't drawn whole`);
          }
        });
        const placed = new Set(layout.rows.flat().map((q) => q.id));
        const prio = (id) => hud.segmentDef(id).priority;
        const minShown = Math.min(...[...placed].filter((id) => id !== "fps").map(prio));
        for (const id of layout.dropped) if (prio(id) > minShown && hud.segmentDef(id).align !== "right") issues.push(`${id} (priority ${prio(id)}) dropped while lower ones show`);
        for (const id of ["location", "hp", "statuses"]) if (!placed.has(id)) issues.push(`${id} not shown`);
        views[v] = { rows: layout.rows.length, shown: [...placed], dropped: layout.dropped, issues };
      }
      return { cells, check: { ok: check.ok, problems: check.problems, stats: check.stats }, segments: hud.hudSegments(), views };
    });
    const bad = [...r.check.problems, ...Object.entries(r.views).flatMap(([v, x]) => x.issues.map((i) => `${v}: ${i}`))];
    if (r.cells !== "100×30") bad.push(`a 600×${cellH * 30} window is ${r.cells} cells, not 100×30`);
    for (const v of Object.values(r.views)) if (v.rows !== 1) bad.push(`the status line takes ${v.rows} rows at 100×30`);
    out(`${bad.length ? "FAIL" : "PASS"} HUD at ${r.cells} (a 600×${cellH * 30} window): ${r.segments.length} segments registered (${r.segments.join(", ")}); check-hud in the browser ${r.check.ok ? "passes" : "fails"}`);
    for (const [v, x] of Object.entries(r.views)) out(`  ${v}: ${x.rows} row, shown ${x.shown.join(" ")}; dropped ${x.dropped.join(" ") || "nothing"}`);
    problems.push(...bad.map((b) => `HUD: ${b}`));
    await page.close();
  }

  // --- 3. Golden frame hashes underground ----------------------------------------------------------------
  if (!SKIP.has("golden")) {
    const page = await openPage(here.base, 1280, 720);
    const r = await page.evaluate(async () => {
      window.requestAnimationFrame = () => 0;
      const S = await import("/src/screen.js"), { canvasBackend } = await import("/src/screen-canvas.js"), H = await import("/tests/lib/hash.js");
      const capture = { chars: null, colors: null, cols: 180, rows: 56, presents: 0 };
      S.setBackend({ resize: () => ({ cols: 180, rows: 56, cellW: 11, cellH: 20 }),
                     cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
                     present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; } });
      S.resize();
      const env = { S, capture, load: (f) => import(`/src/${f}`),
                    frameHash: () => { S.present(); return H.hashString(capture.chars.join(""), 1) + H.hashBytes(capture.colors, 2); } };
      const real = Math.random;
      const seedRandom = (seed) => {   // tools/node-env.mjs mulberry32
        let a = seed >>> 0;
        Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      };
      seedRandom(1);
      const { currentApi } = await import("/tests/golden/current-api.js"), { checkGolden } = await import("/tests/checks/golden.js");
      const fixtures = { frames: await (await fetch("/tests/fixtures/golden/frames.json")).json() };
      const res = checkGolden(await currentApi(env, seedRandom), fixtures, { only: ["frames"] });
      Math.random = real;
      S.setBackend(canvasBackend); S.resize();
      return { ok: res.ok, problems: res.problems, stats: res.stats };
    });
    const f = r.stats.frames || {};
    out(`${r.ok ? "PASS" : "FAIL"} golden frames underground in the browser: ${f.frames} frames, ${f.mismatched} mismatched`);
    for (const p of r.problems) problems.push(`golden: ${p}`);
    await page.close();
  }

  // --- 4. Frame time against <against> ------------------------------------------------------------------
  if (!SKIP.has("frametime") && AGAINST !== "none") {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-0d1-"));
    execSync(`git archive ${JSON.stringify(AGAINST)} | tar -x -C ${JSON.stringify(baseDir)}`, { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    mounts["/__against"] = baseDir;
    // Both trees in one page: the head's modules (/src/…) and <against>'s (/__against/src/…) are two module
    // graphs with their own game, screen and registries, in one heap and one renderer process, so neither
    // gets a worse core, a background tab or the other's garbage collection more than the other. Each
    // tree's creatures draw from their own seeded Math.random (swapped in per tick). The trees alternate
    // tick by tick (ABBA); the figure is head's trimmed mean over all its ticks (the slowest 5% left out:
    // collection pauses) over against's. (Two pages, one per tree, swung it by ±6% from run to run; a fresh
    // run per round by ±50%; alternating 40-tick blocks and taking the median of the blocks' ratios let a
    // real +6.5% in 3D through.)
    const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const trimmed = (a) => mean([...a].sort((x, y) => x - y).slice(0, Math.max(1, Math.floor(a.length * 0.95))));
    const page = await openPage(here.base, 1280, 720);
    await page.waitForTimeout(300);
    await page.evaluate(async (against) => {
      window.requestAnimationFrame = () => 0;   // the page's own loop stops
      const seeded = (seed) => { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
      const trees = (window.__trees = {});
      for (const [name, prefix] of [["head", ""], [against, "/__against"]]) {
        const S = await import(`${prefix}/src/screen.js`), C = await import(`${prefix}/src/screen-canvas.js`);
        const I = await import(`${prefix}/src/input.js`), IB = await import(`${prefix}/src/input-browser.js`), G = await import(`${prefix}/src/game.js`);
        if (prefix) { S.setBackend(C.canvasBackend); I.setInputBackend(IB.browserInput); S.resize(); }   // what main.js does (no listeners)
        trees[name] = { G, seeded, rnd: null, k: 0 };
      }
    }, AGAINST);
    const names = ["head", AGAINST], res = {}, BLOCKS = ROUNDS * 5, PER = Math.max(10, Math.round(FRAMES / 5));
    for (const scene of ["under", "surface"])
      for (const view of ["3d", "map"]) {
        const k = `${scene}/${view}`;
        for (const name of names) {
          const t = await page.evaluate(([name, scene, view]) => {
            const T = window.__trees[name], G = T.G, game = G.game, real = Math.random;
            Math.random = T.rnd = T.seeded(77);   // the creatures' choices: the same in both trees
            G.startRun(1234);
            const st = game.run.world.start;
            game.pages = null; game.pendingPages = null; game.story.cube = true;
            if (scene === "under") game.debug.enterZone(`${st.wx},${st.wy},3`, "down");
            game.mode = view === "3d" ? "explore" : "map"; game.view = view; game.paused = false;
            game.player.pitch = -0.1;
            T.k = 0;
            for (let j = 0; j < 60; j++) { game.player.hp = 9999; G.tick(1 / 60); }   // warm up
            Math.random = real;
            return { zone: game.zone.key, mode: game.mode };
          }, [name, scene, view]);
          (res[k] ||= {})[name] = { ...t, ms: [], blocks: [] };
        }
        // The camera turns through a full circle over all the blocks: tick i of both trees sees the same view.
        // Within a block the trees alternate tick by tick, ABBA (head, against, against, head, …), so drift
        // (clock, thermal, the collector's mood) falls on both alike.
        for (let j = 0; j < BLOCKS; j++) {
          const got = await page.evaluate(([names, per, total]) => {
            const out = {}, real = Math.random;
            for (const n of names) out[n] = [];
            for (let i = 0; i < per; i++)
              for (const name of i % 2 ? [...names].reverse() : names) {
                const T = window.__trees[name], game = T.G.game, p = game.player;
                Math.random = T.rnd;
                p.yaw = (T.k / total) * Math.PI * 2; p.hp = 9999;
                const t0 = performance.now();
                T.G.tick(1 / 60);
                out[name].push(performance.now() - t0);
                T.k++;
              }
            Math.random = real;
            return out;
          }, [names, PER, BLOCKS * PER]);
          for (const name of names) { res[k][name].ms.push(...got[name]); res[k][name].blocks.push(trimmed(got[name])); }
        }
      }
    out(`frame time (ms per tick at 1280×720; ${BLOCKS} blocks of ${PER} ticks per case, the trees alternating), this tree vs ${AGAINST}:`);
    for (const [k, v] of Object.entries(res)) {
      const h = v.head, b = v[AGAINST], s = (x) => ({ p50: pct(x.ms, 0.5), p95: pct(x.ms, 0.95), mean: mean(x.ms) });
      // The figure: the ratio of the pooled trimmed means (every tick of the case, the slowest 5% of each tree
      // left out). (The median over blocks of the blocks' ratios, used before, passed a real +6.5% in 3D.)
      const hs = s(h), bs = s(b), ratios = h.blocks.map((x, j) => x / b.blocks[j]), ratio = trimmed(h.ms) / trimmed(b.ms);
      const gated = k.startsWith("under/"), fail = gated && ratio > 1.05;
      if (h.zone !== b.zone || h.mode !== b.mode) problems.push(`frame time ${k}: the trees drew different things (${h.zone} ${h.mode} vs ${b.zone} ${b.mode})`);
      if (fail) problems.push(`frame time ${k}: ${(100 * (ratio - 1)).toFixed(1)}% slower than ${AGAINST} (ratio of the pooled trimmed means over ${h.ms.length} ticks each)`);
      const f = (x) => `p50 ${x.p50.toFixed(2)} p95 ${x.p95.toFixed(2)} mean ${x.mean.toFixed(2)}`;
      out(`  ${gated ? (fail ? "FAIL" : "PASS") : "    "} ${k.padEnd(11)} ${h.zone.padEnd(6)} head ${f(hs)} | ${AGAINST} ${f(bs)} | ${ratio >= 1 ? "+" : ""}${(100 * (ratio - 1)).toFixed(1)}% (blocks' quartiles ${(100 * (pct(ratios, 0.25) - 1)).toFixed(0)}..${(100 * (pct(ratios, 0.75) - 1)).toFixed(0)}%)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  here.server.close();
  if (baseDir) fs.rmSync(baseDir, { recursive: true, force: true });
}
for (const e of errors) problems.push(`console: ${e}`);
for (const p of problems) out(`  ✗ ${p}`);
out(problems.length ? `FAIL browser 0D1 gate: ${problems.length} problem(s)` : "PASS browser 0D1 gate");
process.exit(problems.length ? 1 : 0);
