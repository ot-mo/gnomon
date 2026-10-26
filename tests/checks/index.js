// Every check module (TECH_DESIGN §9, §1.1 "tests/checks/index.js: the list of check modules"): the list
// test-world.html runs in the browser and tools/run-check.mjs in Node. A static page can't list a folder, so
// this file is that list, one line per tests/checks/<name>.js. It is P0's and never edited after P0: a
// workstream fills in its own pre-created check (overworld, surface, render, progression, items, social,
// story; combat, save and dungeons already exist) and asks the integrator for anything else.
// tools/run-all.mjs still runs tools/check-*.mjs, which is where every check runs in Node day to day.
//
//   CHECKS = [{ name, owner, load: () => import("./<name>.js"), slow?, node? }]
//     owner   who owns the module in Phase 1 (TECH_DESIGN §8.4; "P0": frozen, the integrator's)
//     slow    why test-world.html leaves it out unless asked for (?all=1 or ?only=…): it takes the longest, or it
//             holds a time budget a page shared with other work can miss. In 0D2 every browser-capable check ran
//             in 108 s in all (headless Chromium, one at a time); without the slow ones about 55 s
//     node    why it runs only in Node (a child process, the bot's tools): its tools/check-*.mjs runs it
//   checkNames() → [name]                             the names, in this order
//
// What every check module exports (P0 and Phase 1):
//   run(env) → Promise<result | result[]>             result = { name, ok, problems: [string], stats: {}, notes? }
// with env from tools/node-check-env.mjs (Node) or tests/lib/browser-env.js (the browser):
//   platform                 "node" | "browser"
//   args                     options: --name value (Node) or ?name=value (the page); strings, or true for a bare flag
//   src(path) → module       import("src/" + path): the same instance the check's own "../../src/…" imports get
//   json(path), text(path)   a file of the repository ("tests/fixtures/block-ids.json", "index.html")
//   srcFiles() → [{ file, text }]   the modules of src/ (file relative to src/, with "/"); in the browser the ones
//                            reachable from src/main.js and the checks (tests/lib/crawl.js), which check-imports
//                            holds to every module of src/ but P0 stubs nobody imports yet
//   screen({ cols = 180, rows = 56, seed = 1 })   what tools/node-env.mjs installNodeEnv does: Math.random seeded,
//                            stub screen and input backends, then the game as main.js loads it (game.js,
//                            content/index.js, features.js); → { S, input, capture, frameHash(), frameText(),
//                            resize(cols, rows) }
//   seedRandom(n), restoreRandom()   a seeded Math.random (mulberry32) and back
// A node-only module needs no run(): its tools/check-<name>.mjs is the way to run it.
export const CHECKS = [
  { name: "abilities", owner: "P0", load: () => import("./abilities.js") },
  { name: "ai", owner: "P0", load: () => import("./ai.js") },
  { name: "blocks", owner: "P0", load: () => import("./blocks.js") },
  { name: "body", owner: "P0", load: () => import("./body.js") },
  { name: "clock", owner: "P0", load: () => import("./clock.js") },
  { name: "combat", owner: "WS8", load: () => import("./combat.js") },
  { name: "config", owner: "P0", load: () => import("./config.js") },
  { name: "creatures", owner: "P0", load: () => import("./creatures.js") },
  { name: "currency", owner: "P0", load: () => import("./currency.js") },
  { name: "determinism", owner: "P0", load: () => import("./determinism.js") },
  { name: "dungeons", owner: "WS10", load: () => import("./dungeons.js"), slow: "1,000 levels held to a p95 of 40 ms: a busy page can fail it on timing alone (about 15 s)" },
  { name: "edges", owner: "WS2", load: () => import("./edges.js"), slow: "the longest: about 40 s in a page (75 s in run-all); 600 neighbour pairs and every landmark edge" },
  { name: "golden", owner: "P0", load: () => import("./golden.js") },
  { name: "hud", owner: "P0", load: () => import("./hud.js") },
  { name: "imports", owner: "P0", load: () => import("./imports.js") },
  { name: "items", owner: "WS5", load: () => import("./items.js") },
  { name: "landmarks", owner: "WS2", load: () => import("./landmarks.js") },
  { name: "legacyfights", owner: "P0", load: () => import("./legacyfights.js") },
  { name: "light", owner: "P0", load: () => import("./light.js") },
  { name: "names", owner: "P0", load: () => import("./names.js") },
  { name: "overworld", owner: "WS1", load: () => import("./overworld.js") },
  { name: "progression", owner: "WS4", load: () => import("./progression.js") },
  { name: "render", owner: "WS3", load: () => import("./render.js") },
  { name: "save", owner: "WS9", load: () => import("./save.js"), node: "a fresh Node process loads the save, after tools/bot.mjs's 10-zone session" },
  { name: "screen-frames", owner: "P0", load: () => import("./screen-frames.js") },
  { name: "shell", owner: "P0", load: () => import("./shell.js") },
  { name: "social", owner: "WS6a", load: () => import("./social.js") },
  { name: "stats", owner: "P0", load: () => import("./stats.js"), node: "golden (a) replayed through tools/bot.mjs in both views" },
  { name: "status", owner: "P0", load: () => import("./status.js") },
  { name: "story", owner: "WS7", load: () => import("./story.js") },
  { name: "surface", owner: "WS2", load: () => import("./surface.js") },
  { name: "talk", owner: "P0", load: () => import("./talk.js") },
  { name: "torch", owner: "P0", load: () => import("./torch.js") },
  { name: "world", owner: "WS1", load: () => import("./world.js") },
  { name: "zones", owner: "P0", load: () => import("./zones.js") },
];

export const checkNames = () => CHECKS.map((c) => c.name);
