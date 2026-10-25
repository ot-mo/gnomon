// Golden check: does today's code still do what the parent game (75edbd3) did?
//   node tools/check-golden.mjs [--only mechanics,frames,dungeons,vaults,temple]
// Replays tests/golden/scenarios.js through tests/golden/current-api.js and compares with
// tests/fixtures/golden/*.json (see tests/checks/golden.js for what must match).
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, seedRandom, parseArgs, ROOT } from "./node-env.mjs";
import { currentApi } from "../tests/golden/current-api.js";
import { checkGolden } from "../tests/checks/golden.js";
import { report } from "./report.mjs";

const args = parseArgs();
const dir = path.join(ROOT, "tests", "fixtures", "golden");
const fixtures = Object.fromEntries(["mechanics", "frames", "dungeons", "vaults", "temple"]
  .map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), "utf8"))]));
const env = await installNodeEnv({ cols: 180, rows: 56 });
const api = await currentApi(env, seedRandom);
process.exit(report(checkGolden(api, fixtures, { only: args.only ? String(args.only).split(",") : null })));
