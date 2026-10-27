// 1,000 dungeon levels (50 seeds × the 20 legacy levels) and 1,000 levels with random site parameters (every
// theme, gimmick and bottom) validate, with generation p95 ≤ 40 ms each; stampVault's options, the halls and the
// legend registry work; and the parameter contract's edges hold (a missing run seed, a level validated without
// its p, the WS10 parts read and never ignored).
//   node tools/check-dungeons.mjs [--seeds 50] [--random 1000] [--budget 40]
import { installNodeEnv, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";

const args = parseArgs();
await installNodeEnv();
const { checkDungeons, checkRandomLevels, checkVaultOptions, checkDungeonParams } = await import("../tests/checks/dungeons.js");
const a = report(checkVaultOptions());
const c = report(checkDungeonParams());
const b = report(checkDungeons({ seeds: Number(args.seeds) || 50, p95Budget: Number(args.budget) || 40 }));
const d = report(checkRandomLevels({ count: Number(args.random) || 1000, p95Budget: Number(args.budget) || 40 }));
process.exit(a || b || c || d);
