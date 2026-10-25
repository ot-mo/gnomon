// Block ids are append-only against tests/fixtures/block-ids.json.
//   node tools/check-blocks.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./node-env.mjs";
import { report } from "./report.mjs";
import { BLOCKS } from "../src/blocks.js";
import { checkBlocks } from "../tests/checks/blocks.js";

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "block-ids.json"), "utf8"));
process.exit(report(checkBlocks(BLOCKS, fixture.ids)));
