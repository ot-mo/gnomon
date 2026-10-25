// Records the golden fixtures (tests/fixtures/golden/*.json) from the parent game's code.
//
//   node tools/golden-record.mjs                       record from ./src (only valid while src/ is
//                                                      still the parent's, as at commit 75edbd3)
//   node tools/golden-record.mjs --src DIR --out DIR   record from another copy of the parent's src
//
// To re-record later (say, to check the fixtures were made right), export the parent's source
// and point --src at it:
//   git archive 75edbd3 src | tar -x -C <tmp>     then     --src <tmp>/src --out <tmp>/golden
// (the copy needs a package.json with "type": "module" next to or above its src/, as this repo has).
//
// The fixtures were recorded twice and compared before being committed (see docs/sessions/0A1.md).
// What is recorded, and why, is described in tests/golden/scenarios.js.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { installNodeEnv, seedRandom, parseArgs, ROOT, SRC } from "./node-env.mjs";
import { legacyApi } from "../tests/golden/legacy-api.js";
import { FORMAT, recordMechanics, recordFrames, recordDungeons, recordVaults, recordTemple } from "../tests/golden/scenarios.js";

const args = parseArgs();
const srcDir = path.resolve(args.src || SRC);
const outDir = path.resolve(args.out || path.join(ROOT, "tests", "fixtures", "golden"));

// Where the code came from. For ./src, the git tree id of src/ at HEAD (it must be clean): equal
// to the parent's (75edbd3:src = c5c83bf…) when nothing in src/ has changed yet.
let source = args.label || srcDir;
if (srcDir === SRC) {
  const dirty = execFileSync("git", ["-C", ROOT, "status", "--porcelain", "src"], { encoding: "utf8" }).trim();
  if (dirty) { console.error("src/ has uncommitted changes: record from a clean tree, or use --src."); process.exit(1); }
  source = `src tree ${execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD:src"], { encoding: "utf8" }).trim()}`;
}

const env = await installNodeEnv({ srcDir, cols: 180, rows: 56 });
const api = await legacyApi(env, seedRandom);
const t0 = performance.now();
const files = {
  "mechanics.json": recordMechanics(api),
  "frames.json": recordFrames(api),
  "dungeons.json": recordDungeons(api),
  "vaults.json": recordVaults(api),
  "temple.json": recordTemple(api),
};
fs.mkdirSync(outDir, { recursive: true });
for (const [name, data] of Object.entries(files))
  fs.writeFileSync(path.join(outDir, name), JSON.stringify({ format: FORMAT, source, ...data }, null, 1) + "\n");
console.log(`Recorded ${Object.keys(files).length} fixtures from ${source} into ${path.relative(ROOT, outDir) || outDir} ` +
  `(${((performance.now() - t0) / 1000).toFixed(1)} s): ${files["mechanics.json"].steps.length} mechanics steps, ` +
  `${Object.keys(files["frames.json"].frames).length} frames, ${Object.keys(files["dungeons.json"].levels).length} levels, ` +
  `${Object.keys(files["vaults.json"].vaults).length} vault stamps, ${Object.keys(files["temple.json"].temples).length} temples.`);
