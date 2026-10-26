// The world model, both world fixtures and the run (see tests/checks/world.js).
//   node tools/check-world.mjs
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./node-env.mjs";
import { report } from "./report.mjs";
import { checkWorld } from "../tests/checks/world.js";

const bibleText = fs.readFileSync(path.join(ROOT, "docs", "design", "WORLD_BIBLE.md"), "utf8");
process.exit(report(checkWorld({ bibleText })));
