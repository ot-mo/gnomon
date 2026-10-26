// Original names only (TECH_DESIGN R8; see tests/checks/names.js): the deny-list of bible §15.11 (Caves of Qud's names,
// lore terms and units, dram and parasang among them) over src/ (content/ included) and index.html, and over the Run
// data the generators make.
//   node tools/check-names.mjs [--root DIR]
//     --root: scan another copy of the repository (its src/ and index.html, and its own generators' Run data):
//             how planted hits are shown to fail it
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, parseArgs } from "./node-env.mjs";
import { report } from "./report.mjs";
import { checkNames, runStringsOf } from "../tests/checks/names.js";

const args = parseArgs();
const root = path.resolve(String(args.root || ROOT));
const src = path.join(root, "src");
const files = fs.readdirSync(src, { recursive: true }).filter((f) => f.endsWith(".js")).sort()
  .map((f) => ({ file: f.split(path.sep).join("/"), text: fs.readFileSync(path.join(src, f), "utf8") }));
files.push({ file: "index.html", text: fs.readFileSync(path.join(root, "index.html"), "utf8") });
const bibleText = fs.readFileSync(path.join(ROOT, "docs", "design", "WORLD_BIBLE.md"), "utf8");
const runStrings = await runStringsOf((p) => import(pathToFileURL(path.join(src, p)).href));
const result = checkNames({ files, bibleText, runStrings });
if (args.root) result.stats.root = root;
process.exit(report(result));
