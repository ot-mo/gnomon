// Combat: d20 hit-chance tables, map/3D parity, the planes, the dark and the core, creatures against
// creatures, and the event bus; WS8's targeting, look, throws and missile weapons; the AI's depth (followers
// and hunters over an edge, catch-up, the Plane, wary, flee, follow, abilities, the activity radius, the log);
// an arena of two factions; time-to-kill tables by level band (see tests/checks/combat.js).
//   node tools/check-combat.mjs [--only combat,targeting,ai,arena,ttk] [--runs 100]
//   node tools/check-combat.mjs --perf [--seconds 40] [--against <a tree's root>]
//       passTime per simulated second with 60 creatures in the map's active radius, two ways: hunting you
//       (as check-perf), and two factions fighting each other around you (§3.4); with --against, the same
//       measured in that tree too, alternately (run it on an idle machine).
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC, seedRandom, restoreRandom } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const k = args.indexOf(`--${name}`); return k >= 0 ? args[k + 1] : dflt; };

if (args.includes("--perf")) {
  const { measureWs8Perf } = await import("../tests/checks/combat.js");
  const seconds = Number(opt("seconds", 40));
  const trees = [{ name: "this tree", src: SRC }];
  if (opt("against")) trees.push({ name: opt("against"), src: path.join(path.resolve(opt("against")), "src") });
  const out = await measureWs8Perf(trees, { seconds, installNodeEnv, seedRandom, restoreRandom });
  for (const line of out) console.log(line);
  process.exit(0);
}

const env = await installNodeEnv();
const { game, startRun, inputHandlers } = await import("../src/game.js");
const { keys } = await import("../src/input.js");
const C = await import("../tests/checks/combat.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
const ctx = { game, startRun, inputHandlers, keys, seedRandom, restoreRandom, env };
const only = opt("only", "combat,targeting,ai,arena,ttk").split(",");
const parts = {
  combat: () => C.checkCombat({ game, startRun, srcFiles }),
  targeting: () => C.checkTargeting(ctx),
  ai: () => C.checkAiDepth(ctx),
  arena: () => C.checkArena(ctx, { runs: Number(opt("runs", 100)) }),
  ttk: () => C.ttkTables(ctx),
};
let code = 0;
for (const name of only) {
  const t0 = performance.now();
  const result = await parts[name]();
  result.stats = { ...result.stats, seconds: +((performance.now() - t0) / 1000).toFixed(1) };
  code |= report(result);
}
process.exit(code);
