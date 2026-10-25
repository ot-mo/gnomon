// Same seed → same zone (dungeon part), and no Math.random in the generation code (R6).
//   node tools/check-determinism.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";

// The generation folders and files (TECH_DESIGN R6). Missing ones are skipped.
const SCAN = ["gen", "world", "story.js", "story/history.js", "story/villages.js"];
const sources = {};
const add = (p) => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) add(path.join(p, f));
  else if (p.endsWith(".js")) sources[path.relative(SRC, p).replaceAll("\\", "/")] = fs.readFileSync(p, "utf8");
};
for (const s of SCAN) add(path.join(SRC, s));
// Modules whose functions generation calls (loot, people, spikes, monster picks): their runtime
// code may use Math.random, but no random-comparator sorts anywhere.
const helpers = {};
for (const f of ["items.js", "npcs.js", "traps.js", "monsters.js", "rng.js"]) helpers[f] = fs.readFileSync(path.join(SRC, f), "utf8");

await installNodeEnv();
const { checkDeterminism } = await import("../tests/checks/determinism.js");
process.exit(report(checkDeterminism({ sources, helpers })));
