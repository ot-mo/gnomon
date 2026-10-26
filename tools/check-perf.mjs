// WS3's Node runner: first the render check (tests/checks/render.js: the outdoor look, the clock's looks, the
// dark-only rules by the clock, the map outdoors, golden (b)'s frames), in a process of its own; then performance
// against TECH_DESIGN §6.7's budgets (tests/checks/perf.js): frames at 180×56 outdoors (apron included; noon, dusk,
// night) and underground, the sun bake, refresh and the apron, generation, buildRun/restoreRun, passTime per
// simulated second with 60 creatures, a map step, skipTime over 8 game hours; p50/p95/max each; the edge swap.
//   node tools/check-perf.mjs [--against p0-done | none] [--rounds 1] [--frames 72] [--no-render]
// Each measurement runs in a Node process of its own (a fresh JIT, as run-all gives each check). When an item is over
// budget (or --against is given), the reference tree (default p0-done, `git archive` unpacked into a temporary folder,
// removed afterwards) is measured as many times as this one, alternately (this, ref, this, ref…: --rounds + 1 each),
// and an item over budget here but at most 15% slower than there is the machine's: reported, not failed
// (tests/checks/perf.js; its verdictProblems() is run first, on synthetic numbers).
//   node tools/check-perf.mjs --child --src DIR    (one measurement of the tree at DIR; prints "PERF <json>")
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { installNodeEnv, parseArgs, ROOT, SRC } from "./node-env.mjs";
import { report } from "./report.mjs";
import { judgePerf, overBudget, verdictProblems } from "../tests/checks/perf.js";

const args = parseArgs();

if (args.child) {
  const srcDir = path.resolve(String(args.src || SRC));
  await installNodeEnv({ srcDir, cols: 180, rows: 56, features: srcDir === SRC });
  const { measurePerf } = await import("../tests/checks/perf.js");
  const out = await measurePerf((p) => import(pathToFileURL(path.join(srcDir, p)).href), { frames: Number(args.frames) || 72 });
  console.log(`PERF ${JSON.stringify(out)}`);
  process.exit(0);
}

const SELF = fileURLToPath(import.meta.url);
function measure(srcDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SELF, "--child", "--src", srcDir, ...(args.frames ? ["--frames", String(args.frames)] : [])], { cwd: ROOT });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (status) => {
      const line = out.split(/\r?\n/).find((l) => l.startsWith("PERF "));
      if (status !== 0 || !line) reject(new Error(`measuring ${srcDir}: exit ${status}: ${(err || out).slice(-800)}`));
      else resolve(JSON.parse(line.slice(5)));
    });
  });
}
const pool = (runs) => {
  const samples = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.samples)) (samples[k] ||= []).push(...v);
  return { samples, info: runs[0].info };
};

// The render check, in its own process (tools/run-check.mjs prints its report).
let renderCode = 0;
if (!args["no-render"]) {
  renderCode = await new Promise((resolve) => {
    // (--expose-gc: the render check then also checks that a dormant zone's arrays are freed)
    const child = spawn(process.execPath, ["--expose-gc", path.join(ROOT, "tools", "run-check.mjs"), "render"], { cwd: ROOT, stdio: "inherit" });
    child.on("close", (status) => resolve(status === 0 ? 0 : 1));
  });
}

const t0 = performance.now();
const heads = [await measure(SRC)];
const against = args.against === undefined ? "p0-done" : String(args.against);
const over = overBudget(pool(heads));
let ref = null, refDir = null;
const refs = [];
if (against !== "none" && against !== "false" && (over.length || args.against)) {
  try {
    refDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnomon-perf-"));
    execSync(`git archive ${JSON.stringify(against)} src package.json | tar -x -C ${JSON.stringify(refDir)}`, { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
    for (let k = 0; k < (Number(args.rounds) || 1); k++) { refs.push(await measure(path.join(refDir, "src"))); heads.push(await measure(SRC)); }
    refs.push(await measure(path.join(refDir, "src")));   // as many of each (a p95 or a max over more samples reads higher)
    ref = pool(refs);
  } catch (e) {
    console.log(`(no reference measured: ${String(e.message || e).slice(0, 300)})`);
  } finally {
    if (refDir) fs.rmSync(refDir, { recursive: true, force: true });
  }
}
const result = judgePerf(pool(heads), { ref, refName: against });
const verdict = verdictProblems();
if (verdict.length) { result.ok = false; result.problems.push(...verdict); }
result.stats.runs = `${heads.length} of this tree${ref ? `, ${refs.length} of ${against} (alternating: this, ${against}, this…)` : ""}` +
  `${over.length ? `; over budget in the first: ${over.join(", ")}` : ""}; ${((performance.now() - t0) / 1000).toFixed(1)} s; the verdict's own test ${verdict.length ? "FAILED" : "passed (6 cases)"}`;
process.exit(report(result) || renderCode);
