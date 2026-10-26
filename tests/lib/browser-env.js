// The environment a check module's run(env) gets in the browser (tests/checks/index.js describes it; Node's twin
// is tools/node-check-env.mjs). test-world.html builds it, one check per page.
//
//   installPageGuards() → { storage, muted() }   call before anything of the game loads:
//        localStorage becomes an in-memory store (check-config clears it; the origin's own, shared by every page
//        on ot-mo.github.io, is never touched); the page gets no AudioContext, so audio.js makes none, as in Node
//        (the sound effects' Math.random jitter would otherwise move a seeded check's draws: check-legacyfights'
//        3D fights did); and, should anything still make one, every connect() into an AudioDestinationNode goes
//        into a muted sink instead (an AnalyserNode, then a GainNode at 0, the one thing that reaches the
//        speakers). muted() counts the connects it rerouted.
//   browserCheckEnv(args) → env                 args: the page's URL options, { name: value | true }
import { hashBytes, hashString } from "./hash.js";
import { crawlImports } from "./crawl.js";

const ROOT = new URL("../../", import.meta.url);

// The same generator as tools/node-env.mjs mulberry32, so a seeded check draws the same numbers in both.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const realRandom = Math.random;
const seedRandom = (seed) => { Math.random = mulberry32(seed); };
const restoreRandom = () => { Math.random = realRandom; };

class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  getItem(k) { return this.#m.has(String(k)) ? this.#m.get(String(k)) : null; }
  setItem(k, v) { this.#m.set(String(k), String(v)); }
  removeItem(k) { this.#m.delete(String(k)); }
  clear() { this.#m.clear(); }
}

export function installPageGuards() {
  const storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, get: () => storage });
  if (window.localStorage !== storage) throw new Error("test-world: couldn't put localStorage in memory; not running checks");
  for (const k of ["AudioContext", "webkitAudioContext"]) if (k in window) window[k] = undefined;
  if (window.AudioContext || window.webkitAudioContext) throw new Error("test-world: couldn't take the AudioContext away; not running checks");
  let rerouted = 0;
  if (typeof AudioNode !== "undefined") {
    const connect = AudioNode.prototype.connect, sinks = new WeakMap();
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (!(dest instanceof AudioDestinationNode)) return connect.call(this, dest, ...rest);
      let sink = sinks.get(dest);
      if (!sink) {
        const ctx = dest.context, analyser = ctx.createAnalyser(), mute = ctx.createGain();
        mute.gain.value = 0;
        connect.call(analyser, mute);
        connect.call(mute, dest);
        sinks.set(dest, sink = analyser);
      }
      rerouted++;
      return connect.call(this, sink, ...rest);
    };
  }
  return { storage, muted: () => rerouted };
}

async function text(path) {
  const res = await fetch(new URL(path, ROOT));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

export function browserCheckEnv(args = {}) {
  const src = (path) => import(new URL(`src/${path}`, ROOT).href);
  let files = null;
  return {
    platform: "browser",
    args,
    src,
    text,
    json: async (path) => JSON.parse(await text(path)),
    // The modules src/main.js and the check modules reach (a page can't list a folder): check-imports holds this to
    // every module of src/ but the P0 stubs nobody imports yet.
    async srcFiles() {
      if (!files) {
        const texts = new Map();
        const read = (p) => text(p).then((t) => (texts.set(p, t), t), () => null);
        const found = await crawlImports(["src/main.js", "tests/checks/index.js"], read);
        files = found.filter((p) => p.startsWith("src/")).map((p) => ({ file: p.slice(4), text: texts.get(p) }));
      }
      return files.map((f) => ({ ...f }));
    },
    // tools/node-env.mjs installNodeEnv's twin: seeded Math.random, stub screen and input backends, then the game
    // as main.js loads it (game.js, content/index.js, features.js).
    async screen({ cols = 180, rows = 56, seed = 1 } = {}) {
      seedRandom(seed);
      const S = await src("screen.js"), input = await src("input.js");
      const size = { cols, rows }, capture = { chars: null, colors: null, cols, rows, presents: 0 };
      S.setBackend({
        resize: () => ({ ...size, cellW: 11, cellH: 20 }),
        cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
        present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
      });
      S.resize();
      input.setInputBackend({ canLock: false, isLocked: () => true, lock() {}, unlock() {}, init() {} });
      await src("game.js");
      await src("content/index.js");
      await src("features.js");
      const frameHash = () => { S.present(); return hashString(capture.chars.join(""), 1) + hashBytes(capture.colors, 2); };
      const frameText = () => {
        S.present();
        const lines = [];
        for (let y = 0; y < capture.rows; y++) lines.push(capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join(""));
        return lines.join("\n");
      };
      const resize = (c, r) => { Object.assign(size, { cols: c, rows: r }); S.resize(); };
      return { S, input, capture, frameHash, frameText, resize };
    },
    seedRandom,
    restoreRandom,
  };
}
