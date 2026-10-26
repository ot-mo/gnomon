// The 0A2 browser gate (TECH_DESIGN §8.2), in headless Chromium with real key presses. Not a check-*:
// it needs Playwright, which the repository doesn't depend on (run-all stays dependency-free).
//   NODE_PATH=$(npm root -g) node tools/browser-gate.mjs [--seeds 1234,7] [--shots DIR]
//
// It serves the repository itself (a static server on a free port), and before any key press routes
// every audio node bound for the speakers through an AnalyserNode and a zero-gain node (silent), and since 0D2 the page is opened with ?silent=1 (audio.js's own sink, proven by
// browser-silent.mjs), so the init script is the second guard; and with ?quick=1, straight into a new quick game past the title screen. Then,
// per seed: the old game boots into its intro pages, Space pages through them to the map, arrow keys
// walk; off the temple span's east edge in 3D (Tab, a click, W held; every frame is sampled at
// present(): the zone, your point in the world, the black share of the cell buffer and whole black
// rows) with the neighbour prefetched, no transition screen, no darker frame at the swap and no camera
// jump (judged per unit of frame time since 0D1: the swap frame's speed, its distance over the change in
// game.uiTime, against the typical speed before it, and no usable frame time is a failure; the east neighbour
// is dropped as recording starts so the staged prefetch's frames are recorded: their gaps and the swap's are reported); back west on the map (arrow keys) onto the mirrored tile; the ruin's dungeon (game.debug puts
// you on its span) down 2 levels and back up, each arrival beside the right stairs and the last one
// beside the entrance; every sinkhole of the ruin's span walked into, landing right under it on level
// 1; and no console error or warning anywhere. Exits non-zero on any failure.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, parseArgs } from "./node-env.mjs";

const args = parseArgs();
const SEEDS = String(args.seeds || "1234,7").split(",").map(Number);
const OUT = args.shots ? path.resolve(String(args.shots)) : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { console.log("browser-gate: Playwright is not installed (try NODE_PATH=$(npm root -g))"); process.exit(2); }
const dist = (x, y) => Math.sqrt(x * x + y * y);

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
                ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

async function gate(browser, seed) {
  const results = {};
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  // Silence: everything bound for the speakers goes to an analyser and then a zero-gain node.
  await page.addInitScript(() => {
    const orig = AudioNode.prototype.connect;
    const sinks = new WeakMap();
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
  await page.goto(`${base}/index.html?silent=1&quick=1&seed=${seed}`);
  await page.waitForFunction(() => window.game && window.game.zone && window.game.mode);
  await page.waitForTimeout(500);
  // Helpers inside the page.
  await page.evaluate(async () => {
    const W = await import("/src/world.js"), P = await import("/src/pathing.js"), Z = await import("/src/zones.js");
    const { canvasBackend } = await import("/src/screen-canvas.js");
    const game = window.game;
    const H = (window.__smoke = { frames: [], record: false });
    const present = canvasBackend.present.bind(canvasBackend);
    canvasBackend.present = (chars, colors, cols, rows) => {
      present(chars, colors, cols, rows);
      if (!H.record) return;
      const n = chars.length, stride = colors.length / n;
      let black = 0;
      for (let i = 0; i < n; i++) if (chars[i] === " " && colors[i * stride] + colors[i * stride + 1] + colors[i * stride + 2] < 12) black++;
      // Bands: any whole row of the 3D view (top 85% of rows) black?
      let blackRows = 0;
      for (let y = 0; y < Math.floor(rows * 0.85); y++) {
        let all = true;
        for (let x = 0; x < cols && all; x++) { const i = x + y * cols; if (!(chars[i] === " " && colors[i * stride] + colors[i * stride + 1] + colors[i * stride + 2] < 12)) all = false; }
        if (all) blackRows++;
      }
      const z = game.zone, p = game.player;
      H.frames.push({ key: z.key, gx: z.wx * z.w + p.x, gy: z.wy * z.d + p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, black: black / n, blackRows,
                      mode: game.mode, prefetched: !!Z.cachedZone(game, "1,0,0"), zones: game.zones.size, zkeys: [...game.zones.keys()].join(" "), ui: game.uiTime, t: performance.now(),
                      job: game.prefetchJob ? `${game.prefetchJob.key}#${game.prefetchJob.stages}` : "" });
    };
    H.tile = () => [Math.floor(game.player.x), Math.floor(game.player.y)];
    H.route = (goal, avoidHoles = true) => {
      const zone = game.zone, { w, d } = zone, stand = W.standWith(zone, "all");
      const [sx, sy] = H.tile();
      const blocked = new Set(zone.creatures.filter((n) => n.talk).map((n) => n.tx + n.ty * w));
      for (let i = 0; i < w * d; i++) {
        const g = zone.blocks[i + (W.FLOOR_Z - 1) * w * d];
        if ((g === W.B.STAIRS || g === W.B.STAIRS_UP) && i !== goal.x + goal.y * w) blocked.add(i);
        const x = i % w, y = (i - x) / w;
        if (avoidHoles && !zone.get(x, y, 0) && !zone.get(x, y, W.FLOOR_Z - 1) && i !== goal.x + goal.y * w) blocked.add(i);
      }
      const prev = new Int32Array(w * d).fill(-1);
      prev[sx + sy * w] = sx + sy * w;
      const q = [sx + sy * w];
      for (let h = 0; h < q.length; h++) {
        const c = q[h], cx = c % w, cy = (c - cx) / w;
        if (cx === goal.x && cy === goal.y) {
          const path = [];
          for (let k = c; k !== sx + sy * w; k = prev[k]) path.push([k % w, Math.floor(k / w)]);
          return path.reverse();
        }
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const x = cx + ox, y = cy + oy, i = x + y * w;
          if (x < 0 || y < 0 || x >= w || y >= d || prev[i] >= 0 || blocked.has(i)) continue;
          const isGoal = x === goal.x && y === goal.y;
          if (!isGoal && !P.canWalk(stand, w, cx, cy, x, y, P.PLAYER_STEP_UP, P.PLAYER_DROP)) continue;
          prev[i] = c; q.push(i);
        }
      }
      return null;
    };
    H.holes = () => {
      const z = game.zone, out = [];
      for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) if (!z.get(x, y, 0) && !z.get(x, y, W.FLOOR_Z - 1)) out.push([x, y]);
      return out;
    };
    H.arrive = () => { game.zone.creatures = game.zone.creatures.filter((c) => c.talk); const p = game.player; p.maxHpGain = p.hp = 999; p.keys = 99; };
    H.beside = (which) => {
      const zone = game.zone, p = game.player, s = zone[which], [x, y] = H.tile();
      if (!s) return `${zone.key} has no ${which}`;
      if (zone.stand[x + y * zone.w] < 0 || Math.abs(p.z - zone.stand[x + y * zone.w]) > 1e-6) return `not on the ground at (${x}, ${y})`;
      if (Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) !== 1) return `at (${x}, ${y}), not beside ${which} (${s.x}, ${s.y})`;
      return null;
    };
  });
  const ev = (f, a) => page.evaluate(f, a);
  const shot = (name) => (OUT ? page.screenshot({ path: path.join(OUT, name) }) : null);
  const state = () => ev(() => ({ mode: game.mode, view: game.view, key: game.zone.key, x: game.player.x, y: game.player.y, z: game.player.z }));
  const ARROWS = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
  const waitPlay = async (mode = "map") => {
    for (let k = 0; k < 100; k++) {
      const s = await state();
      if (s.mode === mode) return s;
      if (s.mode === "story") await page.keyboard.press("Space");
      await page.waitForTimeout(100);
    }
    return state();
  };
  // Walk a route on the map, one key press per tile; stops when the zone changes.
  const walkTo = async (goal, avoidHoles = true) => {
    const key0 = (await state()).key;
    for (let tries = 0; tries < 40; tries++) {
      const path = await ev(([g, a]) => window.__smoke.route(g, a), [goal, avoidHoles]);
      if (!path) return `no route to ${goal.x},${goal.y}`;
      for (const [x, y] of path) {
        const s = await state();
        if (s.key !== key0) return null;
        const code = ARROWS[`${x - Math.floor(s.x)},${y - Math.floor(s.y)}`];
        if (!code) break;
        for (let k = 0; k < 3; k++) {
          await page.keyboard.press(code);
          await page.waitForTimeout(30);
          const t = await state();
          if (t.key !== key0 || (Math.floor(t.x) === x && Math.floor(t.y) === y)) break;
        }
        const t = await state();
        if (t.key !== key0) return null;
        if (!(Math.floor(t.x) === x && Math.floor(t.y) === y)) break;
      }
    }
    return (await state()).key === key0 ? "never left the zone" : null;
  };

  // 1. Boot and intro pages.
  const boot = await state();
  await shot(`01-intro.png`);
  let pages = 0;
  while ((await state()).mode === "story" && pages < 30) { await page.keyboard.press("Space"); pages++; await page.waitForTimeout(150); }
  const afterIntro = await state();
  await shot(`02-map.png`);
  results.boot = { modeAtBoot: boot.mode, zone: boot.key, introKeyPresses: pages, after: afterIntro.mode };
  // A few steps on the map.
  const p0 = await state();
  for (const k of ["ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight"]) { await page.keyboard.press(k); await page.waitForTimeout(60); }
  const p1 = await state();
  results.mapSteps = { from: [p0.x, p0.y], to: [p1.x, p1.y], moved: p0.x !== p1.x || p0.y !== p1.y };

  // 2. Off the east edge in 3D, real W presses, frames sampled at present().
  await ev(() => {
    const z0 = game.zone, p = game.player;
    game.story.cube = true;
    const port = z0.gen.ports.find((q) => q.side === "e" && q.kind === "road");
    const y = port ? port.along + (port.width >> 1) : z0.d >> 1, x = z0.w - 8;
    Object.assign(p, { x: x + 0.5, y: y + 0.5, z: z0.stand[x + y * z0.w], vz: 0, onGround: true, yaw: 0, pitch: -0.15 });
    p.maxHpGain = p.hp = 999;
  });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  await page.mouse.click(640, 360);   // the click that unpauses (pointer lock may be refused headless)
  await page.waitForTimeout(100);
  await ev(() => { game.paused = false; game.player.yaw = 0; game.player.pitch = -0.15; });
  results.edge3d = { modeBefore: (await state()).mode };
  await shot(`03-3d-before.png`);
  // The map made every open neighbour at once; drop the east one so the 3D view's staged prefetch (one
  // stage per frame, never in a swap's frame) happens while the frames are recorded and its gaps are seen.
  const dropped = await ev(() => {
    window.__smoke.frames = []; window.__smoke.record = true;
    const had = game.zones.delete("1,0,0");
    if (game.prefetchJob?.key === "1,0,0") game.prefetchJob = null;
    return had;
  });
  results.edge3d.droppedNeighbour = dropped;
  await page.keyboard.down("w");
  let crossedAt = null;
  for (let k = 0; k < 200; k++) {
    await page.waitForTimeout(25);
    const s = await state();
    if (s.key === "1,0,0") { crossedAt = s; break; }
  }
  await page.waitForTimeout(150);
  await page.keyboard.up("w");
  await shot(`04-3d-after.png`);
  await page.waitForTimeout(100);
  const frames = await ev(() => { window.__smoke.record = false; return window.__smoke.frames; });
  const swap = frames.findIndex((f) => f.key === "1,0,0");
  if (swap > 0) {
    // The camera's movement judged per unit of game time: each frame's dt is the change in game.uiTime
    // between two presents (step adds the frame's dt before it is drawn), so a long frame (the swap's own
    // work, or the browser's rAF jitter) moves you further without counting as a pop.
    const jumps = frames.slice(1).map((f, i) => {
      const dt = f.ui - frames[i].ui, d = dist(f.gx - frames[i].gx, f.gy - frames[i].gy);
      return { d, dt, v: dt > 0 ? d / dt : d > 1e-9 ? Infinity : 0, dz: f.z - frames[i].z, dyaw: f.yaw - frames[i].yaw, dpitch: f.pitch - frames[i].pitch };
    });
    const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
    const typical = median(jumps.slice(0, swap - 1).map((j) => j.d));
    // Moving frames before the swap (W held: the first few accelerate from standing).
    const typicalSpeed = median(jumps.slice(0, swap - 1).filter((j) => j.d > 1e-6).map((j) => j.v));
    const gap = (k) => frames[k].t - frames[k - 1].t;
    // The frames that ran a prefetch stage (a job's stage count moved) or adopted a zone.
    const prefetchFrames = frames.map((f, k) => (k > 0 && (f.job !== frames[k - 1].job || f.zones > frames[k - 1].zones) ? k : -1)).filter((k) => k > 0);
    const movedWithoutTime = jumps.filter((j) => !(j.dt > 0) && j.d > 1e-6).length;
    results.edge3d = { ...results.edge3d, crossed: true, framesRecorded: frames.length, swapFrame: swap,
      prefetchedBeforeSwap: frames[swap - 1].prefetched, modes: [...new Set(frames.map((f) => f.mode))],
      blackMaxAroundSwap: +Math.max(...frames.slice(Math.max(0, swap - 5), swap + 6).map((f) => f.black)).toFixed(3), blackBefore: +frames[swap - 1].black.toFixed(3),
      blackAtSwap: +frames[swap].black.toFixed(3), blackMaxAll: +Math.max(...frames.map((f) => f.black)).toFixed(3),
      allBlackRowsMax: Math.max(...frames.map((f) => f.blackRows)),
      moveAtSwap: +jumps[swap - 1].d.toFixed(3), dzAtSwap: +jumps[swap - 1].dz.toFixed(3), typicalMove: +typical.toFixed(3),
      dtAtSwap: +jumps[swap - 1].dt.toFixed(4), movedWithoutTime, speedAtSwap: +jumps[swap - 1].v.toFixed(3), typicalSpeed: +typicalSpeed.toFixed(3),
      maxSpeed: +Math.max(...jumps.map((j) => j.v)).toFixed(3),
      maxMove: +Math.max(...jumps.map((j) => j.d)).toFixed(3), maxDz: +Math.max(...jumps.map((j) => Math.abs(j.dz))).toFixed(3),
      maxTurn: +Math.max(...jumps.map((j) => Math.abs(j.dyaw) + Math.abs(j.dpitch))).toFixed(4),
      swapFrameGapMs: +gap(swap).toFixed(1), afterSwapGapMs: swap + 1 < frames.length ? +gap(swap + 1).toFixed(1) : null,
      prefetchFrames, prefetchGapMs: prefetchFrames.map((k) => +gap(k).toFixed(1)),
      prefetched: prefetchFrames.map((k) => frames[k].job || frames[k].zkeys.split(" ").filter((z) => !frames[k - 1].zkeys.split(" ").includes(z)).join("+") || "done"),
      medianFrameGapMs: +median(frames.slice(1).map((f, i) => f.t - frames[i].t)).toFixed(1),
      maxFrameGapMs: +Math.max(...frames.slice(1).map((f, i) => f.t - frames[i].t)).toFixed(1),
      maxGapAtFrame: 1 + frames.slice(1).reduce((b, f, i, a) => (f.t - frames[i].t > a[b].t - frames[b].t ? i : b), 0) };
  } else results.edge3d = { ...results.edge3d, crossed: false, framesRecorded: frames.length, last: await state() };

  // 3. Back west on the map.
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  const m0 = await state();
  let presses = 0;
  while ((await state()).key === "1,0,0" && presses < 8) {
    const [tx] = await ev(() => window.__smoke.tile());
    if (tx > 0) await walkTo({ x: 0, y: Math.floor((await state()).y) });
    await page.keyboard.press("ArrowLeft"); presses++; await page.waitForTimeout(80);
  }
  const m1 = await state();
  const w0 = await ev(() => game.zone.w);
  results.mapWest = { modeBefore: m0.mode, from: m0.key, to: m1.key, tile: [Math.floor(m1.x), Math.floor(m1.y)], onEastBorder: Math.floor(m1.x) === w0 - 1,
                      zDiff: +(m1.z - m0.z).toFixed(2), mode: m1.mode, presses };
  await shot(`05-map-west.png`);

  // 4. The ruin's dungeon: down 2 levels and back up beside its entrance (map, arrow keys).
  await ev(() => { game.debug.enterZone("20,8,0", "start"); });
  await waitPlay("map");
  await ev(() => window.__smoke.arrive());
  const ruin = [];
  const ent = await ev(() => game.zone.entrance);
  let err = await walkTo(ent);
  await waitPlay("map"); await ev(() => window.__smoke.arrive());
  ruin.push({ step: "surface → down", err, at: (await state()).key, beside: await ev(() => window.__smoke.beside("upStairs")) });
  for (const dir of ["down", "up", "up"]) {
    const goal = await ev((d) => (d === "down" ? game.zone.stairs : game.zone.upStairs), dir);
    const from = (await state()).key;
    err = goal ? await walkTo(goal) : "no stairs";
    await waitPlay("map"); await ev(() => window.__smoke.arrive());
    const now = await state();
    const which = dir === "down" ? "upStairs" : now.key.endsWith(",0") ? "entrance" : "stairs";
    ruin.push({ step: `${from} → ${dir}`, err, at: now.key, beside: await ev((w) => window.__smoke.beside(w), which) });
    if (dir === "down") { /* now on level 2; turn back */ }
  }
  results.ruinDungeon = ruin;
  await shot(`06-ruin-back-up.png`);

  // 5. A sinkhole in the ruin span: walk into it, land under it on level 1.
  const sink = await ev(() => {
    const z = game.zone, r = z.dungeonRect, holes = window.__smoke.holes();
    return { holes, r, w: z.w };
  });
  const falls = [];
  for (const [hx, hy] of sink.holes) {
    await ev(() => { game.debug.enterZone("20,8,0", "start"); });
    await waitPlay("map"); await ev(() => window.__smoke.arrive());
    const path = await ev(([g]) => window.__smoke.route(g, true), [{ x: hx, y: hy }]);
    if (!path) { falls.push({ hole: [hx, hy], err: "no route" }); continue; }
    const e = await walkTo({ x: hx, y: hy });
    await page.waitForTimeout(800);
    await waitPlay("map");
    const s = await state();
    const f = { hole: [hx, hy], err: e, now: s.key, tile: [Math.floor(s.x), Math.floor(s.y)], under: [hx - sink.r.ox, hy - sink.r.oy] };
    // Where the nearest floor to the point under the hole is on level 1 (landing's rule).
    f.nearestFloor = await ev(([ux, uy]) => {
      const z = game.zone; let best = null, bd = 1e9;
      for (let y = 0; y < z.d; y++) for (let x = 0; x < z.w; x++) {
        if (z.stand[x + y * z.w] < 0) continue;
        const d = (x - ux) * (x - ux) + (y - uy) * (y - uy);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      return { at: best, dist: +Math.sqrt(bd).toFixed(2), underStandable: z.stand[ux + uy * z.w] >= 0 };
    }, f.under);
    f.offBy = Math.max(Math.abs(f.tile[0] - f.under[0]), Math.abs(f.tile[1] - f.under[1]));
    falls.push(f);
  }
  results.sinkhole = { holes: sink.holes.length, dungeonRect: sink.r, falls };
  await shot(`07-after-fall.png`);

  results.audio = await ev(() => window.__audio);
  results.errors = errors;

  await page.close();
  return results;
}

// What must hold, from one seed's results.
function verdict(r) {
  const p = [], e = r.edge3d, m = r.mapWest;
  if (r.boot.modeAtBoot !== "story" || r.boot.after !== "map") p.push(`boot: ${JSON.stringify(r.boot)}`);
  if (!r.mapSteps.moved) p.push("the arrow keys didn't move you on the map");
  if (!e.crossed) p.push("3D: never crossed the east edge");
  else {
    if (!e.prefetchedBeforeSwap) p.push("3D: the neighbour was not prefetched");
    if (e.droppedNeighbour && !e.prefetchFrames.length) p.push("3D: the dropped neighbour was never prefetched while recording");
    if (e.modes.some((x) => x !== "explore")) p.push(`3D: modes ${e.modes} (a transition screen?)`);
    if (e.blackAtSwap > e.blackBefore + 0.05 || e.blackAtSwap > 0.5) p.push(`3D: a black frame at the swap (${e.blackBefore} → ${e.blackAtSwap})`);
    // Per unit of frame time (0D1): a pop is a speed, not a distance; walking (and sprinting) stays
    // within 1.5× the typical speed, and a pop of a tile or more in one 1/60 s frame is 60 tiles/s.
    // With no usable frame time (game.uiTime missing or standing still) the speeds are meaningless: a failure,
    // not a pass.
    if (!Number.isFinite(e.typicalSpeed) || !(e.typicalSpeed > 0) || e.movedWithoutTime > 0)
      p.push(`3D: no usable frame time (typical speed ${e.typicalSpeed}; ${e.movedWithoutTime} frame(s) moved with dt 0)`);
    if (!(e.speedAtSwap <= 1.5 * e.typicalSpeed + 0.5) || Math.abs(e.dzAtSwap) > 1 || e.maxTurn > 0.001)
      p.push(`3D: the camera popped (${e.speedAtSwap} tiles/s at the swap vs typical ${e.typicalSpeed}; ${e.moveAtSwap} in ${e.dtAtSwap} s, dz ${e.dzAtSwap})`);
  }
  if (m.to !== "0,0,0" || !m.onEastBorder || Math.abs(m.zDiff) > 1 || m.mode !== "map") p.push(`map west: ${JSON.stringify(m)}`);
  const want = ["20,8,1", "20,8,2", "20,8,1", "20,8,0"];
  r.ruinDungeon.forEach((s, k) => { if (s.err || s.beside || s.at !== want[k]) p.push(`ruin ${s.step}: ${s.err || s.beside || `in ${s.at}, not ${want[k]}`}`); });
  if (!r.sinkhole.falls.length) p.push("no sinkhole in the ruin's span");
  for (const f of r.sinkhole.falls) if (f.err || f.now !== "20,8,1" || f.offBy > 0) p.push(`sinkhole ${f.hole}: ${f.err || `landed in ${f.now} at ${f.tile}, under it is ${f.under}`}`);
  for (const x of r.errors) p.push(`console: ${x}`);
  if (!(r.audio?.rerouted > 0)) p.push("no audio node was rerouted (is the silencing init script stale?)");
  return p;
}

const browser = await chromium.launch();
let failed = 0;
try {
  for (const seed of SEEDS) {
    const r = await gate(browser, seed), problems = verdict(r), e = r.edge3d;
    console.log(`${problems.length ? "FAIL" : "PASS"} browser gate, seed ${seed}`);
    console.log(`  boot: ${r.boot.introKeyPresses} intro pages, then ${r.boot.after}`);
    if (e.crossed) console.log(`  3D east edge: swap at frame ${e.swapFrame}, prefetched ${e.prefetchedBeforeSwap}, black ${e.blackBefore} → ${e.blackAtSwap} (max ${e.blackMaxAll}, whole black rows ≤ ${e.allBlackRowsMax}), speed at swap ${e.speedAtSwap} tiles/s (typical ${e.typicalSpeed}; moved ${e.moveAtSwap} in ${e.dtAtSwap} s), dz ${e.dzAtSwap}`);
    if (e.crossed) console.log(`  frame gaps: median ${e.medianFrameGapMs} ms, swap ${e.swapFrameGapMs} (next ${e.afterSwapGapMs}), prefetch frame(s) ${e.prefetchFrames.length ? `${e.prefetchFrames} (${e.prefetched.join(" ")}) at ${e.prefetchGapMs} ms` : "none recorded"}, max ${e.maxFrameGapMs} at frame ${e.maxGapAtFrame}`);
    console.log(`  map west: ${r.mapWest.from} → ${r.mapWest.to} at (${r.mapWest.tile}), ${r.mapWest.presses} press(es)`);
    console.log(`  ruin: ${r.ruinDungeon.map((s) => s.at).join(" → ")}`);
    console.log(`  sinkholes: ${r.sinkhole.falls.map((f) => `(${f.hole}) → (${f.tile}) off by ${f.offBy}`).join(", ")}`);
    console.log(`  console errors: ${r.errors.length}, audio nodes silenced: ${r.audio?.rerouted}`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    if (problems.length) failed++;
  }
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
