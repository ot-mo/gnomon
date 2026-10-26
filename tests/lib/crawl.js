// The module graph from its sources, without importing anything. Runs the same in Node and in the browser.
//
//   crawlImports(roots, read) → Promise<string[]>   every module reachable from roots (repository paths,
//        "src/main.js") by static imports, re-exports and import("…") with a literal path; read(path) →
//        Promise<text | null> (null: no such file). Paths are repository-relative with "/", sorted.
//   importsOf(text) → string[]                       the relative specifiers of one module (comments ignored)
//
// A static page can't list a folder, so the browser's check environment (tests/lib/browser-env.js) finds
// src/'s files this way from src/main.js and the check modules (tests/checks/index.js), and check-imports
// asserts in Node that this finds every module of src/ that isn't a P0 stub nobody imports yet.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const SPEC = /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]*?\sfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

export function importsOf(text) {
  const out = [];
  for (const m of stripComments(text).matchAll(SPEC)) {
    const spec = m[1] || m[2];
    if (spec.startsWith("./") || spec.startsWith("../")) out.push(spec);
  }
  return out;
}

function join(from, spec) {
  const parts = from.split("/").slice(0, -1);
  for (const p of spec.split("/")) {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  }
  return parts.join("/");
}

export async function crawlImports(roots, read) {
  const seen = new Set(), queue = [...roots];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    const text = await read(file);
    if (text == null) continue;
    seen.add(file);
    for (const spec of importsOf(text)) queue.push(join(file, spec));
  }
  return [...seen].sort();
}
