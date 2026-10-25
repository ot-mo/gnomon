// The world model, both world fixtures and the run (see tests/checks/world.js).
//   node tools/check-world.mjs
import { report } from "./report.mjs";
import { checkWorld } from "../tests/checks/world.js";

process.exit(report(checkWorld()));
