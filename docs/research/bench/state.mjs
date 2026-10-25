// Walk the live game state after a simulated run and list everything JSON can't carry as-is,
// then measure what a save would weigh.
import { deflateSync } from "node:zlib";
import * as S from "./src/screen.js";
S.setBackend({ resize: () => ({ cols: 180, rows: 56, cellW: 11, cellH: 20 }), cellAt: () => null, present() {} });
S.resize();
const { setInputBackend, initInput } = await import("./src/input.js");
setInputBackend({ canLock: false, isLocked: () => true, lock() {}, unlock() {}, init() {} });
const { game, startRun } = await import("./src/game.js");

startRun(4242);
game.pages = null; game.mode = "map"; game.story.cube = true;
for (let d = 1; d <= 20; d++) {
  game.debug.enterFloor(d, "down");
  game.floor.seen.fill(1);   // pretend every floor was fully explored
}
game.debug.enterFloor(7, "up");

// --- 1. What isn't plain JSON?
const found = new Map();   // pattern → count
const seen = new Set();
function walk(v, path, depthLeft = 12) {
  if (v === null || typeof v !== "object") {
    if (typeof v === "function") note(path, "function");
    return;
  }
  if (seen.has(v)) { note(path, "shared/cyclic reference"); return; }
  seen.add(v);
  if (ArrayBuffer.isView(v)) { note(path, `${v.constructor.name}(${v.length})`); return; }
  if (v instanceof Set) { note(path, `Set(${v.size})`); for (const x of v) walk(x, path + "{}", depthLeft - 1); return; }
  if (v instanceof Map) { note(path, `Map(${v.size})`); for (const [k, x] of v) walk(x, path + "<>", depthLeft - 1); return; }
  if (depthLeft <= 0) return;
  if (Array.isArray(v)) { v.forEach((x) => walk(x, path + "[]", depthLeft - 1)); return; }
  const proto = Object.getPrototypeOf(v);
  if (proto && proto !== Object.prototype) note(path, `class ${proto.constructor.name}`);
  for (const k of Object.keys(v)) walk(v[k], path + "." + k, depthLeft - 1);
}
function note(path, what) {
  const key = path.replace(/\[\]/g, "[]") + " : " + what.replace(/\(\d+\)/, "(n)");
  const ex = what.match(/\((\d+)\)/)?.[1];
  const cur = found.get(key) || { count: 0, example: ex };
  cur.count++;
  found.set(key, cur);
}
const { debug, ...rest } = game;
walk(rest, "game");
const rows = [...found.entries()].sort();
console.log("NON-JSON FIELDS");
for (const [k, v] of rows) console.log(`${k}  x${v.count}${v.example ? `  e.g. ${v.example}` : ""}`);

// --- 2. Save size if each floor stores blocks + seen + holeSeen (deflated) + entities as JSON.
const b64 = (u8) => Buffer.from(deflateSync(Buffer.from(u8))).toString("base64");
const replacer = (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : ArrayBuffer.isView(v) ? undefined : k === "from" ? undefined : v);
let total = 0, entityTotal = 0, blockTotal = 0;
const per = [];
for (const [d, f] of game.floors) {
  const { blocks, seen, holeSeen, kind, stand, skyLight, lampLight, litMask, ...ent } = f;
  const e = JSON.stringify(ent, replacer);
  const bl = b64(blocks), se = b64(seen), ho = b64(holeSeen);
  const ed = Buffer.from(deflateSync(Buffer.from(e))).toString("base64");
  per.push({ d, blocks: bl.length, seen: se.length, entities: e.length, entitiesDeflB64: ed.length });
  total += bl.length + se.length + ho.length + ed.length; entityTotal += ed.length; blockTotal += bl.length;
}
const p = JSON.stringify({ player: game.player, quests: game.quests, story: game.story, knownPotions: game.knownPotions,
  potionColor: game.potionColor, scrollTitle: game.scrollTitle, messages: game.messages }, replacer);
console.log("\nSAVE SIZE (deflate + base64 chars)");
console.log(JSON.stringify({ floors: game.floors.size, totalChars: total + p.length, blocksChars: blockTotal, entitiesChars: entityTotal,
  playerAndGlobalsJsonChars: p.length, perFloorAvg: Math.round(total / game.floors.size),
  rawInMemoryBytesPerFloor: (() => { const f = game.floor; return f.blocks.byteLength + f.skyLight.byteLength + f.lampLight.byteLength + f.litMask.byteLength + f.kind.byteLength + f.stand.byteLength + f.seen.byteLength + f.holeSeen.byteLength; })() }, null, 1));
console.log(per.slice(0, 4));
