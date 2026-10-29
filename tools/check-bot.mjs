// The bot in both views (tools/bot.mjs): down three legacy levels and back up, landing beside the
// right stairs each time; then a smoke run with monsters alive on levels 3, 5, 10, 15 and 20; every
// legacy encounter played to the end (0C); the edge walk: off the temple span's east edge in 3D, back
// west on the map; and the 2B playthrough (Phase 2, bot.mjs runPlaythrough): one run from the title through the systems,
// each step asserted, on the test world and, since the last wiring merge, on the real world (Hollowmere; the seed is the
// first whose run has a village it can play, bot.mjs playthroughSeed).
//   node tools/check-bot.mjs [--seeds 1234,7]
import { parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { runStairs, runSmoke, runEdges, runEncounters, runPlaythrough, playthroughSeed } from "./bot.mjs";
import { REAL_WORLD } from "../src/content/world/worldmap.js";

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
for (const seed of seeds)
  for (const view of ["map", "3d"]) {
    const enc = runEncounters({ seed, view });
    stats[`encounters ${view} seed ${seed}`] = enc.steps[0];
    problems.push(...enc.problems.map((p) => `seed ${seed} encounters: ${p}`));
  }
for (const seed of seeds) {
  const edges = runEdges({ seed });
  stats[`edges seed ${seed}`] = `${edges.steps.join(" · ")}; crossing frame ${edges.stats.crossFrameMs} ms, black ${edges.stats.black}`;
  problems.push(...edges.problems.map((p) => `seed ${seed} edges: ${p}`));
}
const play = await runPlaythrough();
stats.playthrough = play.steps.join(" · ");
problems.push(...play.problems.map((p) => `playthrough: ${p}`));
const realSeed = await playthroughSeed(REAL_WORLD);
if (realSeed === null) problems.push("playthrough on the real world: no seed of 1-200 has a village it can play near Hollowmere");
else {
  const real = await runPlaythrough({ seed: realSeed, world: REAL_WORLD });
  stats.playthroughReal = real.steps.join(" · ");
  problems.push(...real.problems.map((p) => `playthrough on the real world: ${p}`));
}
process.exit(report({ name: "bot", ok: problems.length === 0, problems, stats }));
