// The bot in both views (tools/bot.mjs): down three legacy levels and back up, landing beside the
// right stairs each time; then a smoke run with monsters alive on levels 3, 5, 10, 15 and 20.
//   node tools/check-bot.mjs [--seeds 1234,7]
import { parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { runStairs, runSmoke } from "./bot.mjs";

const args = parseArgs();
const seeds = String(args.seeds || "1234,7").split(",").map(Number);
const problems = [], stats = {};
for (const seed of seeds)
  for (const view of ["map", "3d"]) {
    const stairs = runStairs({ seed, view });
    const smoke = runSmoke({ seed, view, seconds: 20 });
    stats[`${view} seed ${seed}`] = `${stairs.steps.length} stair trips, smoke: ${smoke.steps.length} levels`;
    problems.push(...stairs.problems.map((p) => `seed ${seed} stairs: ${p}`), ...smoke.problems.map((p) => `seed ${seed} smoke: ${p}`));
  }
process.exit(report({ name: "bot", ok: problems.length === 0, problems, stats }));
