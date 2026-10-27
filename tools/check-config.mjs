// config.js (GAME_ID, VERSION, the URL flags, storageKey) and what moved onto it (see tests/checks/config.js).
//   node tools/check-config.mjs
import fs from "node:fs";
import path from "node:path";
import { installNodeEnv, SRC, ROOT } from "./node-env.mjs";
import { report } from "./report.mjs";

await installNodeEnv();
const config = await import("../src/config.js");
const audio = await import("../src/audio.js");
const { checkConfig } = await import("../tests/checks/config.js");
const srcFiles = fs.readdirSync(SRC, { recursive: true }).filter((f) => f.endsWith(".js"))
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(SRC, f), "utf8") }));
const indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const { GEN_VERSION: genVersion } = await import("../src/world/run.js");   // integrator (WS10 #2): VERSION.gen follows it
process.exit(report(checkConfig({ config, audio, srcFiles, indexHtml, genVersion })));
