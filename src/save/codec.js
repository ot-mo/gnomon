// The save codec (TECH_DESIGN §7.1, §7.2; P0 skeleton → WS9): game objects to plain records and back.
// Nothing here touches storage (store.js) or decides when to save (save.js).
//
//   SlotRecord = { id, game: GAME_ID, version: VERSION.save, genVersion: VERSION.gen, worldVersion: VERSION.world,
//                  created, updated, mode, seed, character: { name, genotype, background, level }, where, time,
//                  state, player, ids, run, zones: [{ key, savedAt }], live?: sessionId, unclean: 0,
//                  checkpoint?: SlotRecord, dead?: bool }
//                where = { zoneKey, world: null, view: "3d" | "map" }   (state.where of §2.17, plus the view)
//   ZoneRecord = { slot, key, savedAt, genVersion, type, level, w, d, h,
//                  blocks: "b64(deflate)" | { raw: "b64" }, seen: (the same), holeSeen: (the same),
//                  creatures: [trimmed], items, props, bombs, clouds, markers, sightings: [[id, s]], links: [[i, link]],
//                  groups: [[id, g]], spikes: [[col, s]], secretWalls: [col], braziers, secret, vault, guardianHall,
//                  spawn, stairs, upStairs, entrance, dungeonRect, flags, liquids, appliedPatches, lastTime,
//                  …every other field of the zone: plain JSON (R5), or through its registered codec }
//
//   CODEC.deflate                         whether blocks are deflated (feature-detected at start: CompressionStream
//                                         "deflate", the zlib format; Node ≥ 18 and every current browser). Off,
//                                         blocks are stored { raw } (a check turns it off to try that path)
//   DEFLATE_AVAILABLE                     what the detection found (a deflated record can't be read without it)
//   toB64(bytes) → string · fromB64(string) → Uint8Array
//   packBytes(bytes) → Promise<"b64(deflate)" | { raw }> · unpackBytes(v) → Promise<Uint8Array>
//   registerZoneField(name, { encode(value, zone) → JSON, decode(json, zone) → value, bytes = false })
//                                         a zone field that isn't plain JSON (a typed array, a Map) saves through
//                                         its codec; any other field must be JSON (R5) or the save refuses the zone.
//                                         bytes: encode gives a Uint8Array (or null), stored packed like the blocks,
//                                         and decode gets the Uint8Array back
//   CREATURE_FIELDS, registerCreatureField(name)   what a trimmed creature keeps (§7.2's whitelist, below)
//   trimCreature(c) → record · rebuildCreature(record, zone) → creature
//   snapshotZone(zone, { slot, savedAt }) → snap      synchronous: every live object is read here, once (the JSON
//                                         of the record, and copies of its byte grids)
//   finishZone(snap, { deflate = CODEC.deflate }) → Promise<ZoneRecord>   compression; reads nothing live
//   encodeZone(zone, meta, { deflate }) → Promise<ZoneRecord>     both
//   decodeZone(record) → Promise<Zone>     a sealed zone, its derived arrays dropped (refresh() rebuilds them);
//                                         creatures rebuilt with spawnCreature and the saved fields assigned over
//                                         them, without moving the id counter
//   encodePlayer(p) → JSON · decodePlayer(json) → player     the transient fields (§2.4) left out, then defaulted
//   snapshotSlot(game, { id, created, updated, zones }) → { id, json }   synchronous, like snapshotZone
//   jsonProblems(value, path, { shared }) → [problem]   R5's walker: anything JSON can't carry (a Set, a Map, a
//                                         typed array, a function, a class instance, undefined in an array,
//                                         NaN or ±Infinity, a cycle) and, unless shared is allowed, one object
//                                         reached by two paths (a load would split it in two). A property
//                                         holding undefined is fine (JSON leaves it out, and so does a load)
//   canonicalJson(value) → string          JSON with every object's keys sorted: equal data, equal text
//
// Rebuilt, never saved (§7.1): the compiled world, unvisited zones, derived arrays (refresh()), potion colours
// and scroll titles (game.js runLooks), dialogue nodes. Dropped: projectiles in flight (≤ 3 s of life; their
// `from` never needs saving), a zone's apron, its spatial buckets, generation's working grids (zone.gen keeps
// its plain parts), and the mode stack and prefetch state on the game (save.js never reads them).
//
// Deflate's raw variant is never used: Node 20.11 rejects it (§7.2), and check-save greps src/ for its name.
import { GAME_ID, VERSION } from "../config.js";
import { Zone } from "../world.js";
import { parseKey } from "../zones.js";
import { spawnCreature, CREATURE_TYPES } from "../creatures.js";
import { entityCounter, setEntityCounter, getIds } from "../ids.js";
import { makeRng, seedFor } from "../rng.js";
import { makePlayer } from "../player.js";
import { serializeRun } from "../world/run.js";

// --- Bytes ------------------------------------------------------------------------------------------------
function detectDeflate() {
  try { new CompressionStream("deflate"); new DecompressionStream("deflate"); return true; } catch { return false; }
}
export const DEFLATE_AVAILABLE = detectDeflate();
export const CODEC = { deflate: DEFLATE_AVAILABLE };

export function toB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromB64(str) {
  const s = atob(str), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
export async function packBytes(bytes, { deflate = CODEC.deflate } = {}) {
  return deflate ? toB64(await through(bytes, new CompressionStream("deflate"))) : { raw: toB64(bytes) };
}
export async function unpackBytes(v) {
  if (v && typeof v === "object" && typeof v.raw === "string") return fromB64(v.raw);
  if (typeof v !== "string") throw new Error("unpackBytes: neither \"b64(deflate)\" nor { raw: \"b64\" }");
  if (!DEFLATE_AVAILABLE) throw new Error("unpackBytes: this saved zone is deflated, and this browser has no DecompressionStream");
  return through(fromB64(v), new DecompressionStream("deflate"));
}

// --- R5: plain JSON --------------------------------------------------------------------------------------
export function jsonProblems(value, path = "", { shared = false } = {}) {
  const out = [], seen = new Map(), stack = new Set();
  const walk = (v, at) => {
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number") { if (!Number.isFinite(v)) out.push(`${at}: ${v}`); return; }
    if (typeof v !== "object") { out.push(`${at}: ${typeof v}`); return; }
    if (stack.has(v)) { out.push(`${at}: a cycle`); return; }
    if (seen.has(v) && !shared) { out.push(`${at}: the same object as ${seen.get(v)}`); return; }
    seen.set(v, at);
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) { out.push(`${at}: a ${v.constructor?.name || "class instance"}`); return; }
    stack.add(v);
    if (Array.isArray(v)) v.forEach((x, k) => (x === undefined ? out.push(`${at}[${k}]: undefined`) : walk(x, `${at}[${k}]`)));
    else for (const k of Object.keys(v)) {   // (a property holding undefined is left out, as JSON does)
      const d = Object.getOwnPropertyDescriptor(v, k), x = "value" in d ? d.value : v[k];
      if (x !== undefined) walk(x, at ? `${at}.${k}` : k);
    }
    stack.delete(v);
  };
  walk(value, path);
  return out;
}

const sorted = (v) => (Array.isArray(v) ? v.map(sorted)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
export const canonicalJson = (v) => JSON.stringify(sorted(JSON.parse(JSON.stringify(v ?? null))));

// --- Creatures (§7.2: trimmed) ----------------------------------------------------------------------------
// §7.2's whitelist, then the fields P0's creatures keep their state in under 0C's names: `state` (the brain's
// "idle" | "wander" | "chase"), the Lich King's `phase`, the Flat Queen's `risen`, Rook's quarry (`bounty`),
// the Gloom Warden's `lightBurn`, and `regenAcc` (regeneration owed). talk keeps state and met (and the
// dialogue when it isn't the type's); vis only when it differs from the type's. Everything else (looks,
// size, damage, speed, the cosmetic timers) spawnCreature rebuilds from the type, level and elite.
export const CREATURE_FIELDS = ["id", "uid", "type", "elite", "tx", "ty", "z", "hp", "maxHp", "level", "brain", "status", "cooldowns",
  "inv", "body", "merchant", "faction", "name", "named", "flags",
  "state", "phase", "risen", "bounty", "lightBurn", "regenAcc"];
export function registerCreatureField(name) { if (!CREATURE_FIELDS.includes(name)) CREATURE_FIELDS.push(name); }

const typeVis = (t) => ({ flat: !!t?.flat, ghostly: !!t?.ghostly, statue: !!t?.statue });
export function trimCreature(c) {
  const out = {};
  for (const f of CREATURE_FIELDS) if (c[f] !== undefined) out[f] = c[f];
  if (c.talk) out.talk = { state: c.talk.state, met: c.talk.met, ...(c.talk.dialogue !== c.type ? { dialogue: c.talk.dialogue } : {}) };
  const t = CREATURE_TYPES[c.type];
  if (c.vis && JSON.stringify(c.vis) !== JSON.stringify(typeVis(t))) out.vis = c.vis;
  return out;
}

// The saved fields over a freshly spawned creature of its type. Its looks come from a stream seeded by the
// zone and its id (the same creature looks the same after every load), and spawning doesn't move the id
// counter (the saved id is the creature's).
export function rebuildCreature(rec, zone) {
  if (!CREATURE_TYPES[rec.type]) throw new Error(`rebuildCreature: unknown type ${rec.type} in ${zone.key}`);
  const ids = entityCounter();
  const rng = makeRng(seedFor(zone.seed >>> 0, "load", rec.id));
  const c = spawnCreature(rec.type, rec.tx, rec.ty, rec.z, { rng, level: rec.level ?? 1, elite: rec.elite ?? null, uid: rec.uid ?? null,
    name: rec.name, state: rec.state, talk: rec.talk ? { dialogue: rec.talk.dialogue, state: rec.talk.state } : undefined });
  setEntityCounter(ids);
  for (const f of CREATURE_FIELDS) if (rec[f] !== undefined) c[f] = rec[f];
  if (rec.talk) { c.talk.state = rec.talk.state; c.talk.met = rec.talk.met; if (rec.talk.dialogue) c.talk.dialogue = rec.talk.dialogue; }
  if (rec.vis) c.vis = rec.vis;
  return c;
}

// --- Zones ------------------------------------------------------------------------------------------------
const IDENTITY = ["key", "genVersion", "type", "level", "w", "d", "h"];
// The byte grids are packed alike (blocks, and the map memory: §7.2 writes seen and holeSeen as plain "b64",
// but deflated they take 36-40 bytes where plain they take 3-5 KB each, most of a zone's record).
const GRIDS = ["blocks", "seen", "holeSeen"];
const PLAIN = ["items", "props", "bombs", "clouds", "markers"];
const MAPS = ["sightings", "links", "groups", "spikes"];
const AFTER = ["braziers", "secret", "vault", "guardianHall", "spawn", "stairs", "upStairs", "entrance", "dungeonRect", "flags",
  "liquids", "appliedPatches", "lastTime"];
// Rebuilt on load (refresh(), fillApron), or runtime only.
const NOT_SAVED = new Set(["kind", "stand", "look", "skyLight", "lampLight", "litMask", "sunlit", "apron", "reach", "navVersion",
  "buckets", "sealed", "projectiles"]);
const OWN = new Set([...IDENTITY, ...GRIDS, ...PLAIN, ...MAPS, ...AFTER, "creatures", "secretWalls", "slot", "savedAt"]);

const ZONE_FIELDS = new Map();   // name → { encode, decode }
export function registerZoneField(name, codec) {
  if (typeof codec?.encode !== "function" || typeof codec?.decode !== "function") throw new Error(`registerZoneField: ${name} needs encode and decode`);
  if (OWN.has(name) || NOT_SAVED.has(name)) throw new Error(`registerZoneField: ${name} is the codec's own`);
  ZONE_FIELDS.set(name, { bytes: false, ...codec });
}
export const zoneFields = () => [...ZONE_FIELDS.keys()];
// A surface plan's walls (computeKinds reads them): a typed array.
registerZoneField("planWalls", { bytes: true, encode: (v) => (v ? v.slice() : null), decode: (b) => b });
// Generation's notes (ports, key points, the plan's place): kept; its working grids (scenery, cliff,
// worldWater, plan) are not: nothing after generation reads them.
registerZoneField("gen", {
  encode: (g) => (g ? Object.fromEntries(Object.entries(g).filter(([, v]) => !ArrayBuffer.isView(v))) : null),
  decode: (g) => g,
});

export function snapshotZone(zone, { slot = null, savedAt = 0 } = {}) {
  const rec = { slot, key: zone.key, savedAt, genVersion: zone.genVersion, type: zone.type, level: zone.level, w: zone.w, d: zone.d, h: zone.h,
    blocks: null, seen: null, holeSeen: null, creatures: zone.creatures.map(trimCreature) };
  const bytes = { blocks: zone.blocks.slice(), seen: zone.seen.slice(), holeSeen: zone.holeSeen.slice() };
  for (const f of PLAIN) rec[f] = zone[f] ?? [];
  for (const f of MAPS) rec[f] = [...(zone[f] || [])];
  rec.secretWalls = [...(zone.secretWalls || [])];
  for (const f of AFTER) rec[f] = zone[f] ?? null;
  const problems = [];
  for (const f of Object.keys(zone)) {
    if (OWN.has(f) || NOT_SAVED.has(f) || zone[f] === undefined) continue;
    const codec = ZONE_FIELDS.get(f);
    const v = codec ? codec.encode(zone[f], zone) : zone[f];
    if (codec?.bytes && v) { bytes[f] = v; rec[f] = null; continue; }
    problems.push(...jsonProblems(v, f, { shared: true }));
    rec[f] = v;
  }
  for (const f of [...PLAIN, ...AFTER]) problems.push(...jsonProblems(rec[f], f, { shared: true }));
  problems.push(...jsonProblems(rec.creatures, "creatures", { shared: true }));
  if (problems.length) throw new Error(`snapshotZone ${zone.key}: not plain JSON (register a codec with registerZoneField): ${problems.slice(0, 5).join("; ")}`);
  return { key: zone.key, json: JSON.stringify(rec), bytes };
}

export async function finishZone(snap, { deflate = CODEC.deflate } = {}) {
  const rec = JSON.parse(snap.json);
  for (const [f, b] of Object.entries(snap.bytes)) rec[f] = await packBytes(b, { deflate });
  return rec;
}
export const encodeZone = (zone, meta, opts) => finishZone(snapshotZone(zone, meta), opts);

export async function decodeZone(rec) {
  const { wx, wy, z } = parseKey(rec.key);
  const zone = new Zone({ key: rec.key, wx: rec.wx ?? wx, wy: rec.wy ?? wy, z: rec.z ?? z, type: rec.type, level: rec.level, tier: rec.tier,
                          seed: rec.seed, w: rec.w, d: rec.d, h: rec.h, name: rec.name, genVersion: rec.genVersion });
  const { w, d, h } = zone;
  const [blocks, seen, holeSeen] = await Promise.all(GRIDS.map((f) => unpackBytes(rec[f])));
  if (blocks.length !== w * d * h || seen.length !== w * d || holeSeen.length !== w * d)
    throw new Error(`decodeZone ${rec.key}: grids of ${blocks.length}, ${seen.length}, ${holeSeen.length} bytes for ${w}×${d}×${h}`);
  zone.blocks = blocks; zone.seen = seen; zone.holeSeen = holeSeen;
  for (const f of PLAIN) zone[f] = rec[f];
  zone.sightings = new Map(rec.sightings);
  zone.links = new Map(rec.links);
  zone.groups = new Map(rec.groups);
  zone.spikes = new Map(rec.spikes);
  zone.secretWalls = new Set(rec.secretWalls);
  for (const f of AFTER) if (rec[f] !== null || f in zone) zone[f] = rec[f];
  zone.seal();
  for (const f of Object.keys(rec)) {
    if (OWN.has(f)) continue;
    const codec = ZONE_FIELDS.get(f);
    const v = codec?.bytes && rec[f] !== null ? await unpackBytes(rec[f]) : rec[f];
    zone[f] = codec ? codec.decode(v, zone) : v;
  }
  zone.creatures = rec.creatures.map((c) => rebuildCreature(c, zone));
  zone.dropDerived();
  return zone;
}

// --- The player (§2.4: transient fields left out) ---------------------------------------------------------
export const PLAYER_TRANSIENT = ["attackCd", "throwCd", "swing", "swingTime", "hurt", "impact", "wade", "walkPhase", "sprinting"];
export function encodePlayer(p) {
  const out = {};
  for (const k of Object.keys(p)) if (!PLAYER_TRANSIENT.includes(k)) out[k] = p[k];
  return JSON.parse(JSON.stringify(out));
}
export function decodePlayer(data) {
  const fresh = makePlayer(), p = JSON.parse(JSON.stringify(data));
  for (const k of PLAYER_TRANSIENT) if (!(k in p) && k in fresh) p[k] = fresh[k];
  return p;
}

// --- The slot ---------------------------------------------------------------------------------------------
export function snapshotSlot(game, { id, created, updated, zones = [] }) {
  const p = game.player;
  const slot = {
    id, game: GAME_ID, version: VERSION.save, genVersion: VERSION.gen, worldVersion: VERSION.world, created, updated,
    mode: game.state.mode ?? "oneWick", seed: game.seed,
    character: { name: p.name ?? null, genotype: p.genotype ?? null, background: p.background ?? null, level: p.level },
    where: { zoneKey: game.zone?.key ?? null, world: null, view: game.view },
    time: game.time, state: game.state, player: encodePlayer(p), ids: getIds(), run: serializeRun(game.run),
    zones, unclean: 0,
  };
  const problems = [...jsonProblems(slot.state, "state"), ...jsonProblems(slot.player, "player"), ...jsonProblems(slot.run, "run", { shared: true })];
  if (problems.length) throw new Error(`snapshotSlot: not plain JSON (R5): ${problems.slice(0, 5).join("; ")}`);
  return { id, json: JSON.stringify(slot) };
}
