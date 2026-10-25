// 1,000 dungeon levels (50 seeds × the 20 legacy levels) validate, with generation p95 ≤ 40 ms;
// stampVault's options (roof, wallHeight, baseZ) and legend registry work; and the parameter
// contract's edges hold (a missing run seed, a level validated without its p).
//   node tools/check-dungeons.mjs [--seeds 50] [--budget 40]
import { installNodeEnv, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = parseArgs();
await installNodeEnv();
const { checkDungeons, checkVaultOptions, checkDungeonParams } = await import("../tests/checks/dungeons.js");
const a = report(checkVaultOptions());
const c = report(checkDungeonParams());
const b = report(checkDungeons({ seeds: Number(args.seeds) || 50, p95Budget: Number(args.budget) || 40 }));
process.exit(a || b || c);
