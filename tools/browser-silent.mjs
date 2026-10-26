// ?silent=1 in headless Chromium (0D2, TECH_DESIGN §9 "Browser verification"). Not a check-*: it needs
// Playwright, which the repository doesn't depend on (run-all stays dependency-free).
//   NODE_PATH=$(npm root -g) node tools/browser-silent.mjs [--seed 1234]
//
// It serves the repository itself (a static server on a free port). Before any page script an init script
// watches every AudioNode.connect(): a connect into an AudioDestinationNode is allowed only from a GainNode
// whose gain is 0 and whose one input is an AnalyserNode (the game's silent sink, audio.js); anything else
// is recorded as a violation and rerouted into the probe's own muted sink, so the probe itself can never
// let sound out. Then:
//   1. ?silent=1: real key presses page through the intro (they unlock the audio), music and a sound
//      effect play for a while; there must be no violation, at least one connect into the destination (the
//      sink's zero gain), the analyser must hear the game (a peak above 0: what would have played went
//      there), and the zero gain must still be 0 at the end.
//   2. The control, without ?silent: the same presses; the music and the sounds connect their compressors
//      straight to the destination, and the probe must see (and reroute) them. That shows it would catch a
//      silent mode that let something through.
// Exits non-zero on any failure. The browser and the server are closed at the end.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, parseArgs } from "./node-env.mjs";

const args = parseArgs();
const SEED = Number(args.seed) || 1234;
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.log("browser-silent: Playwright is not installed (try NODE_PATH=$(npm root -g))"); process.exit(2); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

// The probe (runs before any page script).
function probe() {
  const orig = AudioNode.prototype.connect, inputs = new WeakMap(), own = new WeakMap();
  const P = (window.__probe = { connects: 0, toDestination: [], violations: [] });
  const name = (n) => n?.constructor?.name || String(n);
  AudioNode.prototype.connect = function (dest, ...rest) {
    P.connects++;
    if (dest instanceof AudioNode) inputs.set(dest, [...(inputs.get(dest) || []), name(this)]);
    if (!(dest instanceof AudioDestinationNode)) return orig.call(this, dest, ...rest);
    const ins = inputs.get(this) || [];
    const ok = this instanceof GainNode && this.gain.value === 0 && ins.length === 1 && ins[0] === "AnalyserNode";
    P.toDestination.push({ from: name(this), gain: this instanceof GainNode ? this.gain.value : null, inputs: ins, ok });
    if (ok) return orig.call(this, dest, ...rest);
    P.violations.push(`${name(this)} (inputs ${ins.join(", ") || "none"}) connected to the destination`);
    let s = own.get(dest);
    if (!s) {   // the probe's own muted sink: nothing gets out, whatever the page does
      const ctx = dest.context, an = ctx.createAnalyser(), mute = ctx.createGain();
      mute.gain.value = 0;
      orig.call(an, mute); orig.call(mute, dest);
      s = an; own.set(dest, s);
    }
    return orig.call(this, s, ...rest);
  };
}

async function play(browser, silent) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(probe);
  await page.goto(`${base}/index.html?${silent ? "silent=1&" : ""}seed=${SEED}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode);
  for (let k = 0; k < 12 && (await page.evaluate(() => window.game.mode)) === "story"; k++) { await page.keyboard.press("Space"); await page.waitForTimeout(150); }
  await page.keyboard.press("ArrowDown");   // a step on the map: the music runs
  const r = await page.evaluate(async () => {
    const A = await import("/src/audio.js"), C = await import("/src/config.js"), X = await import("/src/sfx.js");
    const ctx = A.audioContext();
    if (ctx?.state === "suspended") await ctx.resume();
    let peak = 0;
    const sink = A.silentSink(), buf = sink ? new Float32Array(sink.analyser.fftSize) : null;
    for (let k = 0; k < 40; k++) {   // 2 s: a sound effect every half second, the music all along
      if (k % 10 === 0) X.sfx("pickup");
      await new Promise((ok) => setTimeout(ok, 50));
      if (sink) { sink.analyser.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); }
    }
    return { silentFlag: C.FLAGS.silent, state: ctx?.state || "none", peak, sink: !!sink, muteGain: sink ? sink.mute.gain.value : null,
             probe: window.__probe };
  });
  await page.close();
  return { ...r, errors };
}

const browser = await chromium.launch();
let failed = 0;
try {
  const s = await play(browser, true), c = await play(browser, false);
  const p1 = [], p2 = [];
  if (!s.silentFlag) p1.push("FLAGS.silent is off with ?silent=1");
  if (s.state !== "running") p1.push(`the audio context is ${s.state}, not running (no sound was made: nothing proven)`);
  if (!s.sink) p1.push("no silent sink was made");
  if (s.probe.violations.length) p1.push(...s.probe.violations);
  if (!s.probe.toDestination.length) p1.push("nothing connected to the destination (the sink's zero gain should)");
  if (!(s.peak > 0)) p1.push(`the analyser heard nothing (peak ${s.peak}): the game's sound didn't go through the sink`);
  if (s.muteGain !== 0) p1.push(`the sink's gain is ${s.muteGain} at the end`);
  for (const e of s.errors) p1.push(`console: ${e}`);
  if (c.silentFlag) p2.push("FLAGS.silent is on without ?silent");
  if (c.probe.violations.length < 2) p2.push(`the control made ${c.probe.violations.length} direct connect(s) to the destination; music and sounds should make 2`);
  for (const e of c.errors) p2.push(`console: ${e}`);
  console.log(`${p1.length ? "FAIL" : "PASS"} ?silent=1: ${s.probe.connects} connects, ${s.probe.toDestination.length} into the destination (${s.probe.toDestination.map((d) => `${d.from} gain ${d.gain} fed by ${d.inputs.join("+")}`).join("; ")}), ${s.probe.violations.length} violations; the analyser's peak ${s.peak.toFixed(3)}; context ${s.state}`);
  for (const p of p1) console.log(`  ✗ ${p}`);
  console.log(`${p2.length ? "FAIL" : "PASS"} control (no flag): ${c.probe.violations.length} direct connects to the destination caught and rerouted (${c.probe.violations.join("; ")})`);
  for (const p of p2) console.log(`  ✗ ${p}`);
  failed = p1.length + p2.length;
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
