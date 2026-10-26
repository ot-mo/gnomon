// config.js and what moved onto it (0D2; TECH_DESIGN §1.4, §7.3, §9; DECISIONS §2 "Identity").
//
//   checkConfig({ config, audio, srcFiles, indexHtml }) → { name, ok, problems, stats }
//     srcFiles: [{ file, text }] for every src/*.js (paths relative to src/, with "/")
//
//   1. GAME_ID "gnomon", the page title "GNOMON" (index.html too), VERSION = { save: 1, gen: 1, world: 1 }, frozen.
//   2. FLAGS from the URL: ?seed=N (a whole number > 0, else null), ?silent / ?debug / ?quick (on unless
//      "0", "false" or "off"); in Node every flag is off and seed is null.
//   3. storageKey(name) = "gnomon:<name>"; audio.js's switches read and write it, and read the parent game's
//      key ("rotation-cube-<name>") only when there is none (so a choice made before 0D2 still counts),
//      never writing it.
//   4. The moves, by a scan of src/ (comments stripped): no "rotation-cube-" key outside audio.js's
//      fallback; localStorage only in audio.js; the URL read only in config.js; `.destination` (the
//      speakers) only in audio.js, whose audioOut() everything else connects to.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

export function checkConfig({ config, audio, srcFiles, indexHtml }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);

  // --- 1. Identity -------------------------------------------------------------------------------------
  if (config.GAME_ID !== "gnomon") fail(`GAME_ID is ${config.GAME_ID}`);
  if (config.TITLE !== "GNOMON") fail(`TITLE is ${config.TITLE}`);
  if (!/<title>GNOMON<\/title>/.test(indexHtml)) fail("index.html's title isn't GNOMON");
  const V = config.VERSION;
  if (JSON.stringify(V) !== JSON.stringify({ save: 1, gen: 1, world: 1 })) fail(`VERSION is ${JSON.stringify(V)}`);
  if (!Object.isFrozen(V)) fail("VERSION isn't frozen");

  // --- 2. Flags ----------------------------------------------------------------------------------------
  const cases = [
    ["", { seed: null, silent: false, debug: false, quick: false }],
    ["?seed=42&silent=1&debug=1&quick=1", { seed: 42, silent: true, debug: true, quick: true }],
    ["?silent&quick=0&debug=false", { seed: null, silent: true, debug: false, quick: false }],
    ["?seed=-3&silent=off", { seed: null, silent: false, debug: false, quick: false }],
    ["?seed=abc&debug=yes", { seed: null, silent: false, debug: true, quick: false }],
    ["?seed=7.9", { seed: 7, silent: false, debug: false, quick: false }],
  ];
  for (const [search, want] of cases) {
    const got = config.parseFlags(search);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail(`parseFlags("${search}") = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
  if (JSON.stringify(config.FLAGS) !== JSON.stringify(cases[0][1])) fail(`FLAGS in Node: ${JSON.stringify(config.FLAGS)}`);
  if (!Object.isFrozen(config.FLAGS)) fail("FLAGS isn't frozen");
  stats.flagCases = cases.length;

  // --- 3. Storage keys ---------------------------------------------------------------------------------
  if (config.storageKey("music") !== "gnomon:music") fail(`storageKey("music") = ${config.storageKey("music")}`);
  const ls = globalThis.localStorage;
  if (!ls) fail("no localStorage in the test environment");
  else {
    ls.clear();
    if (!audio.savedSwitch("music")) fail("a switch with nothing stored isn't on");
    ls.setItem("rotation-cube-music", "off");
    if (audio.savedSwitch("music")) fail("the parent game's 'off' isn't read when the new key is missing");
    audio.saveSwitch("music", true);
    if (ls.getItem("gnomon:music") !== "on") fail(`saveSwitch wrote ${ls.getItem("gnomon:music")} under gnomon:music`);
    if (ls.getItem("rotation-cube-music") !== "off") fail("saveSwitch touched the parent game's key");
    if (!audio.savedSwitch("music")) fail("the new key doesn't win over the parent's");
    audio.saveSwitch("sounds", false);
    if (audio.savedSwitch("sounds") || ls.getItem("gnomon:sounds") !== "off") fail("sounds off isn't remembered under gnomon:sounds");
    stats.keys = Array.from({ length: ls.length }, (_, k) => ls.key(k)).sort().join(" ");
    ls.clear();
  }

  // --- 4. The moves (a scan) ---------------------------------------------------------------------------
  const where = (re) => srcFiles.filter(({ text }) => re.test(stripComments(text))).map(({ file }) => file).sort();
  const only = (what, re, allowed) => {
    const files = where(re), extra = files.filter((f) => !allowed.includes(f));
    if (extra.length) fail(`${what} outside ${allowed.join(", ")}: ${extra.join(", ")}`);
    return files;
  };
  only("a rotation-cube- storage key", /rotation-cube-/, ["audio.js"]);
  only("localStorage", /localStorage/, ["audio.js"]);
  only("the URL (location / URLSearchParams)", /\blocation\.search\b|URLSearchParams/, ["config.js"]);
  only("the speakers (.destination)", /\.destination\b/, ["audio.js"]);
  const outs = where(/audioOut\(/);
  for (const f of ["music.js", "sfx.js"]) if (!outs.includes(f)) fail(`${f} doesn't connect through audioOut()`);
  stats.scanned = srcFiles.length;

  return { name: "config", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-config.mjs gives.
export async function run(env) {
  await env.screen();
  return checkConfig({ config: await env.src("config.js"), audio: await env.src("audio.js"), srcFiles: await env.srcFiles(),
    indexHtml: await env.text("index.html") });
}
