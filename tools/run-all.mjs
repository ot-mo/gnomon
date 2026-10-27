// Runs every tools/check-*.mjs, each in its own Node process, and exits non-zero if any fails.
//   node tools/run-all.mjs [--only golden,zones] [--jobs n]
// Checks run side by side (--jobs, default: one per CPU but one, at least 1; --jobs 1 runs them one by one).
// The checks that hold a time budget run afterwards, alone, so a busy machine can't fail them.
// Output is printed per check, whole, in name order, so parallel runs read the same as serial ones.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ROOT, parseArgs } from "./node-env.mjs";

// p95 generation budget; skipTime budget (check-stats replays check-status, its 60 ms skip included); §6.7's budgets
const TIMED = new Set(["check-dungeons.mjs", "check-status.mjs", "check-stats.mjs", "check-story.mjs", "check-perf.mjs"]);   // (check-story: the history's 50 ms a seed, WS7a #8)
const SLOW = ["check-edges.mjs", "check-bot.mjs", "check-landmarks.mjs", "check-determinism.mjs", "check-hud.mjs"];   // started first

const args = parseArgs();
const only = args.only ? String(args.only).split(",") : null;
const jobs = Math.max(1, Number(args.jobs) || (os.availableParallelism?.() ?? os.cpus().length) - 1);
const dir = path.join(ROOT, "tools");
const checks = fs.readdirSync(dir).filter((f) => /^check-.*\.mjs$/.test(f)).sort()
  .filter((f) => !only || only.includes(f.slice(6, -4)));

function runOne(file) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(process.execPath, [path.join(dir, file)], { cwd: ROOT });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (status, signal) => {
      if (status === null) out += `  (${file} was killed: ${signal})\n`;
      resolve({ file, ok: status === 0, secs: (performance.now() - t0) / 1000, out });
    });
  });
}

const t0 = performance.now();
const byFile = new Map();
const rank = (f) => (SLOW.includes(f) ? SLOW.indexOf(f) : SLOW.length);
const queue = checks.filter((f) => !TIMED.has(f)).sort((a, b) => rank(a) - rank(b));
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
  while (queue.length) { const f = queue.shift(); byFile.set(f, await runOne(f)); }
}));
for (const f of checks.filter((f) => TIMED.has(f))) byFile.set(f, await runOne(f));

const results = checks.map((f) => byFile.get(f));
for (const r of results) process.stdout.write(r.out);
console.log("\n" + results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.file.padEnd(24)} ${r.secs.toFixed(1)} s`).join("\n"));
const failed = results.filter((r) => !r.ok);
const wall = ((performance.now() - t0) / 1000).toFixed(1);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks failed (${wall} s).` : `\nAll ${results.length} checks passed (${wall} s, ${jobs} at a time).`);
process.exit(failed.length ? 1 : 0);
