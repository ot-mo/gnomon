// Content (0D2 skeleton; TECH_DESIGN §2.18, §9; see tests/checks/content.js): every registry entry has its required
// fields (creatures, items, statuses, abilities, screens, HUD segments, legend handlers), only known bonus keys, art
// rows and palettes as test.html checks them, and §2.18's level coverage rule on both worlds.
//   node tools/check-content.mjs
import { runChecks } from "./run-check.mjs";
import { parseArgs } from "./node-env.mjs";

process.exit(await runChecks(["content"], parseArgs()));
