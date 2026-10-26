// Abilities: the API, Fold Step on the hotbar in both views, cooldowns, targets, landings
// (see tests/checks/abilities.js).
//   node tools/check-abilities.mjs
import { installNodeEnv } from "./node-env.mjs";
import { report } from "./report.mjs";

const env = await installNodeEnv({ cols: 180, rows: 56 });
const size = { cols: 180, rows: 56 }, capture = env.capture;
env.S.setBackend({
  resize: () => ({ ...size, cellW: 11, cellH: 20 }),
  cellAt: (x, y, c, r) => (x >= 0 && y >= 0 && x < c && y < r ? { x: Math.floor(x), y: Math.floor(y) } : null),
  present(chars, colors, c, r) { capture.chars = chars; capture.colors = colors; capture.cols = c; capture.rows = r; capture.presents++; },
});
const resize = (cols, rows) => { Object.assign(size, { cols, rows }); env.S.resize(); };
const { game, startRun, inputHandlers } = await import("../src/game.js");
const abilities = await import("../src/abilities.js");
const keys = await import("../src/keys.js");
const hud = await import("../src/hud.js");
const time = await import("../src/time.js");
const turns = await import("../src/turns.js");
const status = await import("../src/status.js");
const creatures = await import("../src/creatures.js");
const zones = await import("../src/zones.js");
const world = await import("../src/world.js");
const pathing = await import("../src/pathing.js");
const { checkAbilities } = await import("../tests/checks/abilities.js");
process.exit(report(checkAbilities({ game, startRun, inputHandlers, abilities, keys, hud, time, turns, status, creatures, zones, world, pathing,
  S: env.S, capture, resize })));
