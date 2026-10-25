// A headless environment for running the game's modules in Node: no DOM, no canvas, no sound.
//
//   const env = await installNodeEnv({ srcDir, cols, rows });
//   env.S, env.input        the game's screen.js and input.js, wired to stub backends
//   env.capture             the last presented frame: { chars, colors, cols, rows }
//   env.frameHash()         a hash of that frame (characters and colours)
//   env.load("game.js")     import a module from srcDir
//   seedRandom(n) / restoreRandom()   a seeded Math.random (mulberry32), for repeatable runs
//
// It works against today's src/ and against an old copy of it (pass srcDir), which is how the
// golden fixtures were recorded at the parent commit 75edbd3 (tools/golden-record.mjs). It only
// relies on what both versions share: screen.setBackend/resize/present, input.setInputBackend.
// Sound stays off by itself: audio.js only builds an AudioContext when `window` exists.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashBytes, hashString } from "../tests/lib/hash.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SRC = path.join(ROOT, "src");

// --- Seeded Math.random ------------------------------------------------------------------
const realRandom = Math.random;
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedRandom(seed) { Math.random = mulberry32(seed); }
export function restoreRandom() { Math.random = realRandom; }

// --- localStorage in memory (the game wraps every access in try/catch anyway) -----------------
class MemoryStorage {
  #m = new Map();
  get length() { return this.#m.size; }
  key(i) { return [...this.#m.keys()][i] ?? null; }
  getItem(k) { return this.#m.has(String(k)) ? this.#m.get(String(k)) : null; }
  setItem(k, v) { this.#m.set(String(k), String(v)); }
  removeItem(k) { this.#m.delete(String(k)); }
  clear() { this.#m.clear(); }
}

// --- Install ------------------------------------------------------------------------------
export async function installNodeEnv({ srcDir = SRC, cols = 180, rows = 56, cellW = 11, cellH = 20, seed = 1 } = {}) {
  if (!globalThis.localStorage) globalThis.localStorage = new MemoryStorage();
  seedRandom(seed);
  const load = (file) => import(pathToFileURL(path.join(srcDir, file)).href);

  const S = await load("screen.js");
  const capture = { chars: null, colors: null, cols, rows, presents: 0 };
  S.setBackend({
    resize: () => ({ cols, rows, cellW, cellH }),
    // The terminal convention: pointer positions are already cell coordinates.
    cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
    present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
  });
  S.resize();

  const input = await load("input.js");
  // No pointer lock in Node: count as always locked (the 3D view then plays without clicks).
  input.setInputBackend({ canLock: false, isLocked: () => true, lock() {}, unlock() {}, init() {} });

  // The frame on screen, hashed: characters (UTF-16) and colours (bytes), each with its own seed.
  const frameHash = () => {
    S.present();
    return hashString(capture.chars.join(""), 1) + hashBytes(capture.colors, 2);
  };
  const frameText = () => {
    S.present();
    const lines = [];
    for (let y = 0; y < capture.rows; y++) lines.push(capture.chars.slice(y * capture.cols, (y + 1) * capture.cols).join(""));
    return lines.join("\n");
  };
  return { S, input, capture, frameHash, frameText, load, srcDir };
}

// Command-line options: --name value, or --flag.
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}
