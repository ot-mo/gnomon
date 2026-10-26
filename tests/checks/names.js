// Original names only (0D2; TECH_DESIGN R8, §9 "check-names"; DECISIONS §1 "Names"; bible §2.1 item 13, §15.11):
// no Caves of Qud proper noun, lore term or unit in the game.
//
//   checkNames({ files, bibleText, runStrings }) → { name, ok, problems, stats, notes }
//     files       [{ file, text }]: every module of src/ (file relative to src/, with "/"; src/content is the
//                 "content/" of R8) and "index.html" (named so)
//     bibleText   docs/design/WORLD_BIBLE.md, whose §15.11 the deny-list is held to
//     runStrings  [string]: every string of the Run data the generators make (names of sites, villages, Hours,
//                 relics…), a few seeds of both worlds; WS7's generated names land here
//   findHits(files, { allowed = ALLOWED }) → { hits: [{ file, line, term, rule, text }], allowedUses: [{ …, why }] }
//   DENY, ALLOWED                                    the deny-list and the reviewed uses of a qualified word
//
// The deny-list is bible §15.11, which already holds R8's units (dram, parasang), the water-sharing rite's
// wording and the research notes' names for genotypes (True Kin), implant stations (becoming nook) and psychic
// attention (glimmer): concept-dense.md's list of 22 words is all in it. R8 adds Qud's other genotype name.
//
// How a word is found (whole words, case-insensitive). The text is split into words at anything that isn't a
// letter or a digit and at camelCase humps ("trueKin", "TRUE_KIN", "true-kin" and "True Kin" are the same two
// words), so "dramatic", "classical" or "Esperanto" never match. A term of several words matches the same words in
// a row with only spaces, line breaks, "-" or "_" between them; its last word may take a plural "s" or "es"
// ("drams", "Templars"). Everything in a file counts: code, strings and comments.
//
// Qualified entries (§15.11 bans these in one sense only):
//   - Classic, Roleplay and Wander, as mode names (DECISIONS: "flagged only as mode names, in UI strings next to
//     'mode'"): a hit when "mode" or "modes" (a word, or a hump of an identifier like runMode) is in the same
//     string literal, or within 3 words on the same line outside comments ("Wander mode", mode === "wander").
//     DECISIONS also renames a variable called `classic`: `classic` and `roleplay` as identifiers (code outside
//     strings and comments) are hits too. Creatures that "wander" (the AI's state) are not.
//   - glimmer (as a psychic measure), chimera (as a morphotype), Wayfaring, Physic, Tinkering (as skill names):
//     hits anywhere, unless the use is one ALLOWED lists, with the reason someone reviewed it for.
//
//   1. The deny-list is §15.11's: every term of the bible's list is in DENY, and nothing of the list is left over.
//   2. The planted cases: hits planted in copies of real modules (16) are each found with the right term, and
//      decoys (12: "dramatic", a creature's "wander" state, "a classic blade", the sultana…) are not.
//   3. No hit in src/ or index.html, and every ALLOWED entry still matches a use (none stale).
//   4. No hit in the Run data's strings.

// --- Words ----------------------------------------------------------------------------------------------
const WORD = /\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})|\p{N}+/gu;
function splitWords(text, offset = 0) {
  const out = [];
  for (const m of text.matchAll(WORD)) out.push({ word: m[0], start: offset + m.index, end: offset + m.index + m[0].length });
  return out;
}
const GAP = /^[\s_-]*$/;

// Terms by their first word (a one-word term also by its plurals): word → [term].
function termIndex(deny) {
  const index = new Map();
  const put = (w, d) => { if (!index.has(w)) index.set(w, []); index.get(w).push(d); };
  for (const d of deny) {
    const w = d.words[0];
    put(w, d);
    if (d.words.length === 1) { put(w + "s", d); put(w + "es", d); }
  }
  return index;
}

// Where the terms of `index` stand in a list of words: [{ i (the first word), d }].
function matchTerms(words, lower, text, index) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    for (const d of index.get(lower[i]) || []) {
      const n = d.words.length;
      if (i + n > words.length) continue;
      let ok = true;
      for (let k = 1; ok && k < n; k++) {
        const w = lower[i + k], want = d.words[k];
        ok = (k < n - 1 ? w === want : w === want || w === want + "s" || w === want + "es") &&
          GAP.test(text.slice(words[i + k - 1].end, words[i + k].start));
      }
      if (ok) out.push({ i, d });
    }
  }
  return out;
}

// --- The deny-list --------------------------------------------------------------------------------------
// { term, qualifier? } — the terms as §15.11 writes them; "mode": mode names; "allow": hits unless ALLOWED.
const BIBLE_TERMS = [
  "Qud", "Joppa", "sultan", "Resheph", "Eaters", "True Kin", "Barathrum", "Barathrumites", "Mechanimist", "Putus Templar",
  "Templar", "Seekers of the Sightless Way", "Consortium of Phyta", "Grit Gate", "Golgotha", "Bethesda Susa", "Six Day Stilt",
  "Spindle", "Omonporch", "Rainbow Wood", "Moon Stair", "Kyakukya", "Bey Lah", "Ezra", "Yd Freehold", "Chavvah", "Eyn Roj",
  "Red Rock", "Rust Wells", "snapjaw", "goatfolk", "hindren", "girsh", "dromad", "salt kraken", "glowpad", "watervine",
  "water ritual", "water-sibling", "live and drink", "dram", "parasang", "esper", "becoming nook", "credit wedge", "recoiler",
  "cathedra", "baetyl", "the Gyre", "convalessence", "warm static", "brain brine", "sunslag", "neutron flux", "zetachrome",
  "fullerite", "crysteel", "Kith and Kin", "Argyve", "Klanq", "Issachari", "Naphtaali", "Shekhinah", "Kasaphescence",
  "Coiled Lamb", "Daughters of Exile", "Children of Mamon", "Mental Mirror", "Burrowing Claws", "ubernostrum",
];
const QUALIFIED = [
  ["glimmer", "allow", "as a psychic measure"], ["chimera", "allow", "as a morphotype"],
  ["Wayfaring", "allow", "as skill names"], ["Physic", "allow", "as skill names"], ["Tinkering", "allow", "as skill names"],
  ["Classic", "mode", "as mode names"], ["Roleplay", "mode", "as mode names"], ["Wander", "mode", "as mode names"],
];
const R8_TERMS = ["Mutated Human"];   // the research notes' other genotype name (R8)

export const DENY = [
  ...BIBLE_TERMS.map((term) => ({ term, from: "§15.11" })),
  ...QUALIFIED.map(([term, qualifier, sense]) => ({ term, from: "§15.11", qualifier, sense })),
  ...R8_TERMS.map((term) => ({ term, from: "R8" })),
].map((d) => ({ ...d, words: splitWords(d.term).map((w) => w.word.toLowerCase()) }));

// Reviewed uses of a qualified word: { term, file, phrase (on the same line), why }.
export const ALLOWED = [
  { term: "glimmer", file: "effects.js", phrase: "Your torch shrinks to a glimmer.",
    why: "the old game's potion of darkness: a torch's small light, not the psychic measure" },
  { term: "glimmer", file: "content/items/legacy.js", phrase: "Your torch shrinks to a glimmer for 40 s",
    why: "the same potion's description" },
];

// --- JavaScript, cut into code, strings and comments ----------------------------------------------------
// Good enough for a word scan: line and block comments, the three kinds of string (template literals with
// their ${…} parts as code), and regular expression literals told from division by what comes before them.
export function jsSegments(text) {
  const segs = [], n = text.length, templates = [];
  let i = 0, from = 0, depth = 0, prev = "";
  const push = (kind, s, e) => { if (e > s) segs.push({ kind, start: s, end: e }); };
  const template = (j) => {   // from just inside a backtick (or a closing "}") to its end or the next "${"
    const s = j;
    while (j < n && text[j] !== "`" && !(text[j] === "$" && text[j + 1] === "{")) j += text[j] === "\\" ? 2 : 1;
    push("string", s, Math.min(j, n));
    if (text[j] === "$") { templates.push(depth); return j + 2; }
    return j + 1;
  };
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (c === "/" && d === "/") {
      push("code", from, i);
      const e = text.indexOf("\n", i), end = e < 0 ? n : e;
      push("comment", i, end); i = from = end; continue;
    }
    if (c === "/" && d === "*") {
      push("code", from, i);
      const e = text.indexOf("*/", i + 2), end = e < 0 ? n : e + 2;
      push("comment", i, end); i = from = end; continue;
    }
    if (c === "'" || c === '"') {
      push("code", from, i);
      let j = i + 1;
      while (j < n && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      push("string", i + 1, Math.min(j, n)); i = from = j + 1; prev = "a"; continue;
    }
    if (c === "`") { push("code", from, i); i = from = template(i + 1); prev = "a"; continue; }
    if (c === "}" && templates.length && depth === templates[templates.length - 1]) {
      push("code", from, i); templates.pop(); i = from = template(i + 1); prev = "a"; continue;
    }
    if (c === "/" && (/[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || prev === "" || /\b(return|typeof|case|in|of|void|delete)\s*$/.test(text.slice(Math.max(0, i - 8), i)))) {
      push("code", from, i);
      let j = i + 1, inClass = false;
      while (j < n && text[j] !== "\n" && (inClass || text[j] !== "/")) {
        if (text[j] === "\\") j++;
        else if (text[j] === "[") inClass = true;
        else if (text[j] === "]") inClass = false;
        j++;
      }
      j++;
      while (j < n && /[a-z]/.test(text[j])) j++;
      push("regex", i, j); i = from = j; prev = "a"; continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  push("code", from, n);
  return segs;
}

// A copy of `text` with the segments of the kinds not kept blanked (line breaks kept, so offsets and lines hold).
const keepOnly = (text, segs, kinds) => {
  const out = text.split("");
  for (const s of segs) if (!kinds.includes(s.kind)) for (let k = s.start; k < s.end; k++) if (out[k] !== "\n") out[k] = " ";
  return out.join("");
};

const lineStarts = (text) => { const out = [0]; for (let k = 0; k < text.length; k++) if (text[k] === "\n") out.push(k + 1); return out; };
const lineOf = (starts, pos) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
const isMode = (w) => w === "mode" || w === "modes";

// --- The scan -------------------------------------------------------------------------------------------
export function findHits(files, { allowed = ALLOWED, deny = DENY } = {}) {
  const hits = [], allowedUses = [], seen = new Set();
  const modeNames = deny.filter((d) => d.qualifier === "mode");
  const plain = termIndex(deny.filter((d) => d.qualifier !== "mode")), modes = termIndex(modeNames);
  const idents = termIndex(modeNames.filter((d) => d.term !== "Wander"));
  for (const { file, text } of files) {
    const starts = lineStarts(text), lines = text.split("\n");
    const add = (pos, d, rule) => {
      const line = lineOf(starts, pos), key = `${file}:${line}:${d.term}`;
      if (seen.has(key)) return;
      seen.add(key);
      const lineText = lines[line - 1].trim();
      const entry = d.qualifier === "allow" ? allowed.findIndex((a) => a.term.toLowerCase() === d.term.toLowerCase() && a.file === file && lineText.includes(a.phrase)) : -1;
      if (entry >= 0) allowedUses.push({ file, line, term: d.term, rule, text: lineText.slice(0, 120), why: allowed[entry].why, entry });
      else hits.push({ file, line, term: d.term, rule, text: lineText.slice(0, 120) });
    };
    // 1. Every term but the mode names, anywhere in the file.
    const words = splitWords(text), lower = words.map((w) => w.word.toLowerCase());
    for (const { i, d } of matchTerms(words, lower, text, plain)) add(words[i].start, d, d.qualifier === "allow" ? `qualified: banned ${d.sense}` : "deny-list");
    // 2. The mode names: next to "mode" on a line outside comments, or in a string with "mode"; classic and roleplay
    //    as identifiers.
    const js = file.endsWith(".js");
    const segs = js ? jsSegments(text) : lines.map((l, k) => ({ kind: "string", start: starts[k], end: starts[k] + l.length }));
    const noComments = js ? keepOnly(text, segs, ["code", "string", "regex"]) : text;
    const cw = splitWords(noComments), cl = cw.map((w) => w.word.toLowerCase());
    for (const { i, d } of matchTerms(cw, cl, noComments, modes)) {
      const line = lineOf(starts, cw[i].start);
      for (let k = Math.max(0, i - 3); k <= Math.min(cw.length - 1, i + 3); k++)
        if (k !== i && isMode(cl[k]) && lineOf(starts, cw[k].start) === line) { add(cw[i].start, d, "a mode name next to 'mode'"); break; }
    }
    for (const s of segs) {
      if (s.kind !== "string") continue;
      const sw = splitWords(text.slice(s.start, s.end), s.start), sl = sw.map((w) => w.word.toLowerCase());
      if (!sl.some(isMode)) continue;
      for (const { i, d } of matchTerms(sw, sl, text, modes)) add(sw[i].start, d, "a mode name in a string with 'mode'");
    }
    if (js) {
      const code = keepOnly(text, segs, ["code"]), iw = splitWords(code), il = iw.map((w) => w.word.toLowerCase());
      for (const { i, d } of matchTerms(iw, il, code, idents)) add(iw[i].start, d, "an identifier (DECISIONS: renamed)");
    }
  }
  hits.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
  return { hits, allowedUses };
}

// --- 1. The bible's list --------------------------------------------------------------------------------
export function bibleList(bibleText) {
  const at = bibleText.indexOf("### 15.11");
  if (at < 0) return null;
  const end = bibleText.indexOf("The original words to use instead", at);
  const body = bibleText.slice(at, end < 0 ? undefined : end).replace(/\s+/g, " ");
  const m = /contains? them:/.exec(body);
  return m ? body.slice(m.index + m[0].length).trim() : null;
}

function checkBible(bibleText, fail, stats) {
  const list = bibleList(bibleText || "");
  if (!list) { fail("WORLD_BIBLE.md has no §15.11 list (\"… reject any generated name that contains them:\")"); return; }
  const terms = DENY.filter((d) => d.from === "§15.11").map((d) => d.term);
  for (const t of terms) if (!list.includes(t)) fail(`the deny-list's "${t}" isn't in bible §15.11 as written`);
  for (const [term, , sense] of QUALIFIED) if (!list.includes(`(${sense})`)) fail(`bible §15.11 no longer qualifies ${term} "${sense}"`);
  let rest = list.replace(/\([^)]*\)/g, " ");
  for (const t of [...terms].sort((a, b) => b.length - a.length)) rest = rest.split(t).join(" ");
  rest = rest.replace(/["“”.,]/g, " ").split(/\s+/).filter((w) => w && w !== "and");
  if (rest.length) fail(`bible §15.11 lists words the deny-list lacks: ${rest.join(" ")}`);
  stats.denyList = `${terms.length} terms of §15.11 (${QUALIFIED.length} qualified) + ${R8_TERMS.length} of R8`;
}

// --- 2. Planted hits and decoys -------------------------------------------------------------------------
// Lines planted into copies of real modules (and index.html); want: the terms that must be found, nothing else.
export const PLANTED = [
  { file: "talk.js", line: 'game.log("Prices here are in drams.");', want: ["dram"] },
  { file: "content/creatures/legacy.js", line: 'const SNAPJAW = { name: "snapjaw scavenger" };', want: ["snapjaw"] },
  { file: "progression/chargen.js", line: "// the True Kin keep to the cities", want: ["True Kin"] },
  { file: "progression/chargen.js", line: "const trueKin = genotype === 1;", want: ["True Kin"] },
  { file: "social/ritual.js", line: 'say("You are now a water-sibling of the village.");', want: ["water-sibling"] },
  { file: "social/ritual.js", line: "const msg = `Shall we share water? Live and drink, ${name}.`;", want: ["live and drink"] },
  { file: "rules.js", line: "if (RULES.classic.permadeath) endRun(game);", want: ["Classic"] },
  { file: "screens/create.js", line: 'drawText(2, 4, "Classic mode: one life, no checkpoints");', want: ["Classic"] },
  { file: "screens/create.js", line: 'const choice = { mode: "roleplay", label: "Settle in" };', want: ["Roleplay"] },
  { file: "index.html", line: "<p>Choose Wander mode to roam without XP from kills.</p>", want: ["Wander"] },
  { file: "status.js", line: 'registerStatus("lucid", { name: "Your glimmer rises" });', want: ["glimmer"] },
  { file: "story/history.js", line: 'const guild = "the Barathrumites\' workshop";', want: ["Barathrumites"] },
  { file: "content/factions.js", line: 'export const KITH = "Kith and Kin";', want: ["Kith and Kin"] },
  { file: "overworld/travel.js", line: 'log("Two parasangs to the east.");', want: ["parasang"] },
  { file: "content/world/worldmap.js", line: "// a road toward the Gyre", want: ["the Gyre"] },
  { file: "content/powers.js", line: 'export const POWERS = { mentalMirror: { name: "a mirror for the mind" } };', want: ["Mental Mirror"] },
  // Decoys: none of these may be found.
  { file: "ai.js", line: 'if (m.lost > 8) m.state = "wander";', want: [] },
  { file: "ai.js", line: "// creatures wander about until they see you", want: [] },
  { file: "items.js", line: 'const word = "dramatic", other = "a dramatist";', want: [] },
  { file: "items.js", line: 'const style = "classical lettering";', want: [] },
  { file: "items.js", line: 'const name = "a classic blade";', want: [] },
  { file: "content/villages.js", line: 'const dish = "the sultana cake";', want: [] },
  { file: "story/grammar.js", line: 'const tongue = "Esperanto";', want: [] },
  { file: "gen/terrain.js", line: 'const shape = "a gyre of reeds";', want: [] },
  { file: "screens/options.js", line: 'const templateMode = "explore"; // creatures wander', want: [] },
  { file: "screens/options.js", line: "// the Classic and Roleplay modes became oneWick and commonsLamp", want: [] },
  { file: "index.html", line: "<p>Hollowmere wanders with the tide.</p>", want: [] },
  { file: "effects.js", line: 'game.log("Darkness pours from the bottle. Your torch shrinks to a glimmer.", [110, 100, 140]);', want: [] },
];

function checkPlanted(files, fail, stats) {
  const byFile = new Map(files.map((f) => [f.file, f.text]));
  let caught = 0, decoys = 0;
  for (const p of PLANTED) {
    const base = byFile.get(p.file) ?? "";
    const text = `${base}${base.endsWith("\n") || !base ? "" : "\n"}${p.line}\n`;
    const line = text.split("\n").length - 1;
    const { hits } = findHits([{ file: p.file, text }]);
    const got = [...new Set(hits.filter((h) => h.line === line).map((h) => h.term))].sort();
    const want = [...p.want].sort();
    if (got.join() !== want.join()) fail(`planted in ${p.file}: ${p.line} → found [${got.join(", ")}], want [${want.join(", ")}]`);
    else if (want.length) caught++; else decoys++;
  }
  stats.planted = `${caught} of ${PLANTED.filter((p) => p.want.length).length} planted hits found, ${decoys} of ${PLANTED.filter((p) => !p.want.length).length} decoys passed`;
}

// --- The check ------------------------------------------------------------------------------------------
export function checkNames({ files, bibleText, runStrings = [] }) {
  const problems = [], stats = {}, notes = [];
  const fail = (m) => problems.push(m);
  checkBible(bibleText, fail, stats);
  checkPlanted(files, fail, stats);

  // 3. The tree.
  const { hits, allowedUses } = findHits(files);
  for (const h of hits) fail(`${h.file === "index.html" ? "" : "src/"}${h.file}:${h.line} "${h.term}" (${h.rule}): ${h.text}`);
  ALLOWED.forEach((a, k) => { if (!allowedUses.some((u) => u.entry === k)) fail(`ALLOWED is stale: no "${a.term}" in ${a.file} on a line with "${a.phrase}"`); });
  for (const u of allowedUses) notes.push(`allowed: ${u.file}:${u.line} "${u.term}" (${u.why})`);
  const js = files.filter((f) => f.file.endsWith(".js")).length;
  if (!js || !files.some((f) => f.file === "index.html")) fail(`scanned ${js} modules${files.some((f) => f.file === "index.html") ? "" : " and no index.html"}`);
  stats.scanned = `${js} modules of src/ (${files.filter((f) => f.file.startsWith("content/")).length} in content/) and index.html, ` +
    `${files.reduce((a, f) => a + f.text.length, 0)} chars; ${hits.length} hits, ${allowedUses.length} allowed uses`;

  // 4. The Run data's strings, each as a string a player may read.
  const strings = [...new Set(runStrings)];
  const runHits = findHits(strings.map((s, k) => ({ file: `run string ${k}`, text: s }))).hits;
  for (const h of runHits.slice(0, 20)) fail(`a Run string: "${h.term}" in "${h.text}"`);
  stats.runStrings = `${strings.length} distinct strings, ${runHits.length} hits`;

  return { name: "names", ok: problems.length === 0, problems, stats, notes };
}

// Every string in a value (the Run data, serialized).
export function stringsIn(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, out);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.push(k); stringsIn(v, out); }
  return out;
}

// The Run data of both worlds on a few seeds (what the generators named).
export async function runStringsOf(src, seeds = [1, 42, 1234]) {
  const { buildRun, serializeRun } = await src("world/run.js");
  const { TEST_WORLD } = await src("content/world/test-world.js");
  const { REAL_WORLD } = await src("content/world/worldmap.js");
  const out = [];
  for (const world of [TEST_WORLD, REAL_WORLD]) for (const seed of seeds) stringsIn(serializeRun(buildRun(seed, world)), out);
  return out;
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-names.mjs gives.
export async function run(env) {
  const files = [...await env.srcFiles(), { file: "index.html", text: await env.text("index.html") }];
  return checkNames({ files, bibleText: await env.text("docs/design/WORLD_BIBLE.md"), runStrings: await runStringsOf(env.src) });
}
