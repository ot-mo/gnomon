// Runs every tools/check-*.mjs, each in its own Node process, and exits non-zero if any fails.
//   node tools/run-all.mjs [--only golden,zones]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, parseArgs } from "./node-env.mjs";

const args = parseArgs();
const only = args.only ? String(args.only).split(",") : null;
const dir = path.join(ROOT, "tools");
const checks = fs.readdirSync(dir).filter((f) => /^check-.*\.mjs$/.test(f)).sort()
  .filter((f) => !only || only.includes(f.slice(6, -4)));

const results = [];
for (const file of checks) {
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [path.join(dir, file)], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  const secs = (performance.now() - t0) / 1000;
  const ok = r.status === 0;
  results.push({ file, ok, secs });
  process.stdout.write(r.stdout);
  if (r.stderr) process.stdout.write(r.stderr);
  if (!ok && r.status === null) console.log(`  (${file} was killed: ${r.signal})`);
}
console.log("\n" + results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.file.padEnd(24)} ${r.secs.toFixed(1)} s`).join("\n"));
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
