// Runs check modules from tests/checks/index.js in Node through their run(env), the way test-world.html runs
// them in the browser (tools/node-check-env.mjs gives env). Each check gets its own Node process, as in run-all;
// a node-only one (index `node`) runs its tools/check-<name>.mjs instead. Exits non-zero if any fails.
//   node tools/run-check.mjs <name>[,<name>…] [--all] [check options, e.g. --seeds 10]
//   import { runChecks } from "./run-check.mjs"      (the Phase 1 runners: tools/check-overworld.mjs …)
//     runChecks(names, args) → Promise<exit code>
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ROOT, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { CHECKS } from "../tests/checks/index.js";

const SELF = fileURLToPath(import.meta.url);

function child(file, argv) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [file, ...argv], { cwd: ROOT, stdio: "inherit" });
    p.on("close", (status) => resolve(status === 0 ? 0 : 1));
  });
}

// One check, in this process.
async function runHere(entry, args) {
  const { nodeCheckEnv } = await import("./node-check-env.mjs");
  const mod = await entry.load();
  let results;
  try {
    results = await mod.run(nodeCheckEnv(args));
  } catch (err) {
    results = { name: entry.name, ok: false, problems: [`threw: ${err?.stack || err}`], stats: {} };
  }
  let code = 0;
  for (const r of [results].flat()) code = report(r) || code;
  return code;
}

export async function runChecks(names, args = {}) {
  const entries = names.map((n) => CHECKS.find((c) => c.name === n) || n);
  const unknown = entries.filter((e) => typeof e === "string");
  if (unknown.length) { console.log(`run-check: no check named ${unknown.join(", ")} in tests/checks/index.js`); return 1; }
  const passOn = process.argv.slice(2).filter((a, k, all) => a !== "--all" && !(k === 0 && !a.startsWith("--")));
  if (entries.length === 1 && !entries[0].node) return runHere(entries[0], args);
  let code = 0;
  for (const e of entries) {
    const file = e.node ? path.join(ROOT, "tools", `check-${e.name}.mjs`) : SELF;
    code = (await child(file, e.node ? passOn : [e.name, ...passOn])) || code;
  }
  return code;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SELF).href) {
  const args = parseArgs();
  const first = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
  const names = args.all ? CHECKS.map((c) => c.name) : first.split(",").filter(Boolean);
  if (!names.length) { console.log("usage: node tools/run-check.mjs <name>[,<name>…] | --all"); process.exit(2); }
  process.exit(await runChecks(names, args));
}
