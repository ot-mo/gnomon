// The stat bus and RULES (see tests/checks/stats.js), plus golden (a) replayed with the stat cache
// verified on every read and the player's base fields watched; and the rest of the 0B gate: golden (a)
// through the map's and the 3D view's controls (tools/bot.mjs runGoldenA), skipTime and drowning
// parity (tests/checks/status.js) and golden (b), the frames.
//   node tools/check-stats.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, ROOT, SRC } from "./node-env.mjs";
import { currentApi } from "../tests/golden/current-api.js";
import { checkGolden } from "../tests/checks/golden.js";
import { report } from "./report.mjs";

const env = await installNodeEnv({ cols: 180, rows: 56 });
const { game, startRun } = await env.load("game.js");
const inventory = await env.load("inventory.js");
const St = await env.load("stats.js");
const { checkStats } = await import("../tests/checks/stats.js");

const mechanics = () => {
  const fixtures = { mechanics: JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "golden", "mechanics.json"), "utf8")) };
  return currentApi(env, seedRandom).then((api) => {
    const writes = [], newRun = api.newRun;
    api.newRun = (seed) => { newRun(seed); game.player = St.guardBaseFields(game.player, (p) => writes.push(p)); };
    St.STATS_DEBUG.verify = true;
    try {
      const r = checkGolden(api, fixtures, { only: ["mechanics"] });
      for (const p of r.problems) console.log(`  golden: ${p}`);
      return { steps: r.stats.mechanics.steps, mismatched: r.ok ? 0 : Math.max(1, r.stats.mechanics.mismatched), writes };
    } catch (err) {   // a stale cache throws from inside the scenario
      console.log(`  golden: ${err.message}`);
      return { steps: 0, mismatched: 1, writes };
    } finally { St.STATS_DEBUG.verify = false; }
  });
};
const golden = await mechanics();

// The rest of the gate. (The frames first: importing the bot installs its own capture buffer.)
const framesFixture = { frames: JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "golden", "frames.json"), "utf8")) };
const frames = checkGolden(await currentApi(env, seedRandom), framesFixture, { only: ["frames"] }).stats.frames;
const { runGoldenA } = await import("./bot.mjs");
const goldenA = {};
for (const view of ["map", "3d"]) {
  const r = await runGoldenA({ view });
  goldenA[view] = { ...r.stats, problems: r.problems.slice(0, 4) };
}
const { checkStatus } = await import("../tests/checks/status.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
const status = checkStatus({ game, startRun, inputHandlers: (await env.load("game.js")).inputHandlers, srcFiles });
const gate = { goldenA, status: { ...status.stats, problems: status.problems }, frames };
process.exit(report(checkStats({ game, startRun, inventory, mechanics: () => golden, gate })));
