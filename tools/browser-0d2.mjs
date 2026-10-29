// The 0D2 gate's browser half (TECH_DESIGN §8.2 "0D2": every stub module imports cleanly in the browser) and
// test-world.html, in headless Chromium. Not a check-*: it needs Playwright, which the repository doesn't depend
// on (run-all stays dependency-free).
//   NODE_PATH=$(npm root -g) node tools/browser-0d2.mjs [--all] [--only a,b] [--skip boot,imports,checks] [--base URL]
//
// It serves the repository itself (a static server on a free port), or uses --base (a server already running
// from the repository's root, e.g. `python -m http.server 8130`: http://127.0.0.1:8130). Before any page script an init script sends
// every connect() into an AudioDestinationNode to a muted sink (an AnalyserNode, then a zero-gain GainNode), in
// every frame. Every console error or warning, page error and failed request (but the favicon) fails the run.
//   boot     index.html?silent=1&quick=1&world=test&seed=1234 (src/main.js with content/index.js and features.js: the game
//            boots into the start span) and index.html?silent=1 (the title screen); a few keys and frames in each.
//   imports  test-world.html?only=imports: tests/checks/imports.js in the browser, which loads every module of src/
//            the game and the checks reach (but main.js, booted above), every Phase 1 stub and every check module
//            in one page, and holds the stubs to their frozen exports.
//   checks   test-world.html (or ?all=1 with --all; ?only=… with --only): every check module of
//            tests/checks/index.js that runs in a browser, each in its own iframe; its window.testResult.
// Exits non-zero on any failure. The browser and the server are closed at the end.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, parseArgs } from "./node-env.mjs";

const args = parseArgs();
const skip = new Set(String(args.skip || "").split(",").filter(Boolean));
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.log("browser-0d2: Playwright is not installed (try NODE_PATH=$(npm root -g))"); process.exit(2); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/markdown; charset=utf-8" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
if (!args.base) await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = args.base ? String(args.base).replace(/\/$/, "") : `http://127.0.0.1:${server.address().port}`;

// Runs before any page script, in every frame.
function mute() {
  const connect = AudioNode.prototype.connect, sinks = new WeakMap();
  window.__rerouted = 0;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (!(dest instanceof AudioDestinationNode)) return connect.call(this, dest, ...rest);
    if (this instanceof GainNode && this.gain.value === 0) return connect.call(this, dest, ...rest);   // a muted sink's own gain
    let s = sinks.get(dest);
    if (!s) {
      const ctx = dest.context, an = ctx.createAnalyser(), g = ctx.createGain();
      g.gain.value = 0;
      connect.call(an, g); connect.call(g, dest);
      sinks.set(dest, s = an);
    }
    window.__rerouted++;
    return connect.call(this, s, ...rest);
  };
}

async function open(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], requests = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`console ${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => {
    const u = new URL(r.url());
    requests.push(u.pathname);
    if (r.status() >= 400 && !u.pathname.endsWith("favicon.ico")) errors.push(`HTTP ${r.status()}: ${u.pathname}`);
  });
  await page.addInitScript(mute);
  await page.goto(`${base}/${url}`);
  return { page, errors, requests };
}

const browser = await chromium.launch();
let failed = 0;
const say = (ok, line, problems = []) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${line}`);
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (!ok) failed++;
};
try {
  // --- boot ----------------------------------------------------------------------------------------------------
  if (!skip.has("boot")) {
    for (const [url, want] of [["index.html?silent=1&quick=1&world=test&seed=1234", "play"], ["index.html?silent=1", "title"]]) {
      const t0 = performance.now();
      const { page, errors, requests } = await open(browser, url);
      const problems = [];
      try {
        await page.waitForFunction(() => window.game && window.game.mode, null, { timeout: 30000 });
        if (want === "play") await page.waitForFunction(() => window.game.zone, null, { timeout: 30000 });
        const first = await page.evaluate(() => window.game.mode);
        if (want === "title" && first !== "title") problems.push(`the page opened on ${first}, not the title screen`);
        // (On the title, Space starts a new quick game; then the intro's pages, a view switch, a step on the map.)
        for (const k of ["Space", "Space", "Space", "Space", "Space", "Tab", "ArrowDown", "Tab"]) { await page.keyboard.press(k); await page.waitForTimeout(150); }
        await page.waitForTimeout(500);
        const s = await page.evaluate(() => ({ mode: window.game.mode, zone: window.game.zone?.key || null }));
        s.mode = `${first} → ${s.mode}`;
        if (want === "play" && !s.zone) problems.push("no zone after the quick start");
        const mods = requests.filter((p) => p.startsWith("/src/"));
        for (const f of ["/src/features.js", "/src/content/index.js", "/src/overworld/index.js", "/src/story/index.js", "/src/screens/target.js"])
          if (!mods.includes(f)) problems.push(`${f} wasn't loaded by the page`);
        problems.push(...errors);
        say(!problems.length, `boot ${url}: mode ${s.mode}${s.zone ? `, zone ${s.zone}` : ""}; ${mods.length} modules of src/ loaded, no console error (${((performance.now() - t0) / 1000).toFixed(1)} s)`, problems);
      } catch (err) { say(false, `boot ${url}`, [String(err?.message || err), ...errors]); }
      await page.close();
    }
  }

  // --- the import check in a page, then the checks ---------------------------------------------------------------
  const runPage = async (label, query, minutes) => {
    const t0 = performance.now();
    const { page, errors } = await open(browser, `test-world.html${query}`);
    try {
      await page.waitForFunction(() => window.testResult, null, { timeout: minutes * 60000 });
      const r = await page.evaluate(() => window.testResult);
      const problems = [...errors];
      for (const c of r.results) if (!c.ok) problems.push(`${c.name}: ${c.problems.slice(0, 6).join(" | ")}`);
      say(r.ok && !errors.length, `${label}: ${r.passed} passed, ${r.failed} failed, ${r.skipped.length} left out (${r.secs} s in the page, ${((performance.now() - t0) / 1000).toFixed(1)} s in all)`, problems);
      for (const c of r.results) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(14)} ${String(c.secs).padStart(6)} s${c.name === "imports" ? `  ${c.stats.loadedInPage}; ${c.stats.stubs}; reachable ${c.stats.reachable}` : ""}`);
      for (const s of r.skipped) console.log(`  left out: ${s.name} (${s.why})`);
    } catch (err) { say(false, label, [String(err?.message || err), ...errors]); }
    await page.close();
  };
  if (!skip.has("imports")) await runPage("test-world.html?only=imports (every module in the page, the stubs)", "?only=imports", 5);
  if (!skip.has("checks")) {
    const q = args.only ? `?only=${args.only}` : args.all ? "?all=1" : "";
    await runPage(`test-world.html${q}`, q, args.all ? 30 : 10);
  }
} finally {
  await browser.close();
  if (server.listening) server.close();
}
process.exit(failed ? 1 : 0);
