// The HUD's segments and toasts, the map's overlay and describer registries and the hover's `inspect`
// (see tests/checks/hud.js).
//   node tools/check-hud.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

const env = await installNodeEnv({ cols: 100, rows: 30 });
// The screen's size changes during the check (100×30, 100×40, 180×56, 80×25).
const size = { cols: 100, rows: 30 }, capture = env.capture;
env.S.setBackend({
  resize: () => ({ ...size, cellW: 11, cellH: 20 }),
  cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
  present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
});
const resize = (cols, rows) => { Object.assign(size, { cols, rows }); env.S.resize(); };
const { game, startRun, inputHandlers } = await import("../src/game.js");
const hud = await import("../src/hud.js");
const renderMap = await import("../src/renderMap.js");
const events = await import("../src/events.js");
const status = await import("../src/status.js");
const zones = await import("../src/zones.js");
const { checkHud } = await import("../tests/checks/hud.js");
process.exit(report(checkHud({ game, startRun, inputHandlers, hud, renderMap, events, status, zones, S: env.S, capture, resize })));
