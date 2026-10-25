// The bot in both views (tools/bot.mjs): down three legacy levels and back up, landing beside the
// right stairs each time; then a smoke run with monsters alive on levels 3, 5, 10, 15 and 20; and the
// edge walk: off the temple span's east edge in 3D, back west on the map.
//   node tools/check-bot.mjs [--seeds 1234,7]
import { parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { runStairs, runSmoke, runEdges } from "./bot.mjs";

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
for (const seed of seeds) {
  const edges = runEdges({ seed });
  stats[`edges seed ${seed}`] = `${edges.steps.join(" · ")}; crossing frame ${edges.stats.crossFrameMs} ms, black ${edges.stats.black}`;
  problems.push(...edges.problems.map((p) => `seed ${seed} edges: ${p}`));
}
process.exit(report({ name: "bot", ok: problems.length === 0, problems, stats }));
