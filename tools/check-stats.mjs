// The stat bus and RULES (see tests/checks/stats.js), plus golden (a) replayed with the stat cache
// verified on every read and the player's base fields watched.
//   node tools/check-stats.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, ROOT } from "./node-env.mjs";
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
process.exit(report(checkStats({ game, startRun, inventory, mechanics: () => golden })));
