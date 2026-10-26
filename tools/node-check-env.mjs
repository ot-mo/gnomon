// The environment a check module's run(env) gets in Node (tests/checks/index.js describes it; the browser's
// twin is tests/lib/browser-env.js). Built on tools/node-env.mjs.
//
//   nodeCheckEnv(args = {}) → env    args: the command line's options (parseArgs)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installNodeEnv, seedRandom, restoreRandom, ROOT, SRC } from "./node-env.mjs";

export function nodeCheckEnv(args = {}) {
  return {
    platform: "node",
    args,
    src: (p) => import(pathToFileURL(path.join(SRC, p)).href),
    json: async (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")),
    text: async (p) => fs.readFileSync(path.join(ROOT, p), "utf8"),
    srcFiles: async () => fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js")).sort()
      .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") })),
    // installNodeEnv, with a backend whose size resize() changes (as check-hud and check-abilities set up).
    async screen({ cols = 180, rows = 56, seed = 1 } = {}) {
      const env = await installNodeEnv({ cols, rows, seed });
      const size = { cols, rows }, capture = env.capture;
      env.S.setBackend({
        resize: () => ({ ...size, cellW: 11, cellH: 20 }),
        cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
        present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
      });
      env.S.resize();
      const resize = (c, r) => { Object.assign(size, { cols: c, rows: r }); env.S.resize(); };
      return { S: env.S, input: env.input, capture, frameHash: env.frameHash, frameText: env.frameText, resize };
    },
    seedRandom,
    restoreRandom,
  };
}
