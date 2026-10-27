// Travel encounters (TECH_DESIGN §5.2 "Encounters", "Rest"; bible §4.9; WS1). The tables are
// content/encounters.js; every roll comes from the run's travel stream (state.js roll), never Math.random.
//
//   encounterChance(game, tile, { fast, rest }) → 0..1   the span's encounterRate (region × terrain, compiled) ×
//                                    1.5 at night × 0.25 on fast travel × 0.5 for a resting hour
//   rollEncounter(game, at, { fast, rest }) → encounter | null   one roll for span `at` = { wx, wy }:
//                                    { kind: "band", types: [type], elite: [id | null] } · { kind: "legend", uid, def }
//                                    · { kind: "travellers" }
//   placeEncounter(game, key, enc)   a band or a legend into zone `key` by a zone patch relativeTo "arrival",
//                                    8-12 tiles from where you arrive (applied on that entry, visited zone or not)
//   meetTravellers(game, at) → line  what travellers tell you: an unknown site within ENCOUNTERS.travellers.rumour
//                                    spans (found and pinned), else the spans around you (revealed)
//   hiddenSiteRoll(game, at) → Site | null   each undiscovered site of the span you enter rolls 10% (20% with
//                                    Keen Eye); the first hit is asked about ("Stop and look?"), and only a yes
//                                    records it (bible §4.9: sites you decline are not recorded)
//   legendsFor(game, tile) → [LegendDef]     the legends that may roam span `tile`: within
//                                    ENCOUNTERS.legend.tiers of its lair's tier (or its own, without a lair),
//                                    alive, placed nowhere yet (claimUid
//                                    would succeed), their lair not on this span
//
// A band is one patch (op "band"): its first member 8-12 tiles from where you arrive, the rest next to it,
// each also 8-12 from you where the ground allows. A legend is WS10's patch { op: "spawnCreature", uid, type:
// def.species, level: def.level } (handoff WS10 #7), so zones.js claims its uid and its lair is empty of it.
import { isNight } from "../clock.js";
import { addZonePatch, PATCH_OPS, uidWhere } from "../zones.js";
import { pickCreatureType, rollElite, spawnCreature, addCreature, creatureAt, CREATURE_TYPES } from "../creatures.js";
import { perkRank } from "../leveling.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { hash, distance, makeRng } from "../rng.js";
import { B, FLOOR_Z } from "../world.js";
import { tierOfLevel, levelOfTier } from "../world/worldmodel.js";
import * as sites from "../world/sites.js";
import { ENCOUNTERS } from "../content/encounters.js";
import { roll, spanKey, tileOf, OW } from "./state.js";
import { reveal, pin, findSite } from "./discovery.js";

const E = () => ENCOUNTERS;
const pick = (game, list) => list[Math.floor(roll(game) * list.length) % list.length];
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export function encounterChance(game, tile, { fast = false, rest = false } = {}) {
  if (!tile) return 0;
  const O = OW();
  let c = tile.encounterRate || 0;
  if (isNight(game)) c *= O.nightEncounter;
  if (fast) c *= O.fastEncounter;
  if (rest) c *= O.restEncounter;
  return Math.max(0, Math.min(1, c));
}

// A legend's def, from the run (WS10's legendOf when it is there, else run.legends).
const legendOf = (run, uid) => (sites.legendOf ? sites.legendOf(run, uid) : run?.legends?.get?.(uid)) || null;

export function legendsFor(game, tile) {
  const run = game.run, out = [];
  if (!run?.legends?.size || !tile) return out;
  for (const uid of run.legends.keys()) {
    const def = legendOf(run, uid);
    if (!def || uidWhere(game, uid) !== null) continue;   // placed somewhere (its lair made, or met), or dead
    const lair = def.siteId && run.sites?.get(def.siteId);
    if (lair && lair.at.wx === tile.wx && lair.at.wy === tile.wy) continue;
    // It roams near home: its lair's tier (a legend is 3 levels above its lair, bible §12.13), else its own.
    if (Math.abs((lair?.tier ?? tierOfLevel(def.level || 1)) - tile.tier) > E().legend.tiers) continue;
    out.push(def);
  }
  return out;
}

function bandOf(game, tile) {
  const B_ = E().band, R = E().regions[tile.region] || {}, level = tile.level ?? levelOfTier(tile.tier);
  const lo = Math.round(B_.size[0] + B_.perTier[0] * (tile.tier - 1)), hi = Math.round(B_.size[1] + B_.perTier[1] * (tile.tier - 1));
  const n = lo + Math.floor(roll(game) * (hi - lo + 1));
  const table = R.creatures?.filter((t) => CREATURE_TYPES[t]) || null;
  const rand = () => roll(game);
  const lead = pickCreatureType(rand, level, table?.length ? table : null);
  const types = [lead], elite = [rollElite(rand, level) || null];
  for (let k = 1; k < n; k++) {
    types.push(roll(game) < B_.same ? lead : pickCreatureType(rand, level, table?.length ? table : null));
    elite.push(rollElite(rand, level) || null);
  }
  return { kind: "band", types, elite, level };
}

export function rollEncounter(game, at, opts = {}) {
  const tile = tileOf(game, at.wx, at.wy);
  if (!(roll(game) < encounterChance(game, tile, opts))) return null;
  const weights = { ...E().kinds, ...(E().regions[tile.region]?.kinds || {}) };
  const legends = legendsFor(game, tile);
  if (!legends.length) delete weights.legend;
  if (opts.rest) delete weights.travellers;   // nobody stops by to chat while you sleep off the road
  const total = Object.values(weights).reduce((a, w) => a + w, 0);
  let r = roll(game) * total, kind = "band";
  for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) { kind = k; break; }
  if (kind === "legend") { const def = pick(game, legends); return { kind, uid: def.uid, def }; }
  if (kind === "travellers") return { kind };
  return bandOf(game, tile);
}

const nameOf = (type) => CREATURE_TYPES[type]?.name || type;
function bandWords(types) {
  const counts = new Map();
  for (const t of types) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].map(([t, n]) => (n > 1 ? `${n} ${CREATURE_TYPES[t]?.plural || `${nameOf(t)}s`}` : `a ${nameOf(t)}`)).join(" and ");
}

export function placeEncounter(game, key, enc) {
  const dist = OW().bandDist;
  if (enc.kind === "legend") {
    const d = enc.def;
    addZonePatch(game, key, { op: "spawnCreature", uid: d.uid, type: d.species, level: d.level, name: d.name, relativeTo: "arrival", dist });
    game.log?.(fill(pick(game, E().lines.legend), { name: [d.name, d.epithet].filter(Boolean).join(" ") }), [255, 150, 120]);
    return;
  }
  addZonePatch(game, key, { op: "band", types: enc.types, elite: enc.elite, level: enc.level, relativeTo: "arrival", dist });
  game.log?.(fill(pick(game, E().lines.band), { who: bandWords(enc.types) }), [255, 150, 120]);
}

// --- The band patch ------------------------------------------------------------------------------------------
// patch { op: "band", types, elite, level?, state? }: the first at the patch's spot (8-12 from where you arrived),
// the rest on reachable tiles next to it, each 8-12 tiles from your arrival when the ground has such a tile.
const isStairs = (zone, x, y) => { const g = zone.get(x, y, FLOOR_Z - 1); return g === B.STAIRS || g === B.STAIRS_UP; };
PATCH_OPS.band = (game, zone, p, { at, arrival }) => {
  if (!at) return;
  const { w, d, stand } = zone, [lo, hi] = p.dist || OW().bandDist;
  const ax = Math.floor(arrival?.x ?? at.x), ay = Math.floor(arrival?.y ?? at.y);
  const dist = reachable(stand, w, d, at.x, at.y, PLAYER_STEP_UP, PLAYER_DROP);
  const salt = [...String(p.id)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const spots = [[at.x, at.y]], taken = new Set([at.x + at.y * w]);
  for (let r = 1; r <= 4 && spots.length < p.types.length; r++) {
    const ring = [];
    for (let y = at.y - r; y <= at.y + r; y++)
      for (let x = at.x - r; x <= at.x + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= d || Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== r) continue;
        const i = x + y * w, far = distance(x - ax, y - ay);
        if (taken.has(i) || dist[i] < 0 || stand[i] < 0 || isStairs(zone, x, y) || creatureAt(zone, x, y)) continue;
        if (far < lo || far > hi) continue;
        ring.push([x, y]);
      }
    ring.sort((a, b) => hash(salt, a[0] + a[1] * w, 5) - hash(salt, b[0] + b[1] * w, 5));
    for (const s of ring) { if (spots.length >= p.types.length) break; spots.push(s); taken.add(s[0] + s[1] * w); }
  }
  const rng = makeRng((zone.seed ^ salt) >>> 0);
  p.types.forEach((type, k) => {
    const s = spots[k];
    if (!s) return;   // no room 8-12 tiles from you: a smaller band
    const z = stand[s[0] + s[1] * w];
    addCreature(zone, spawnCreature(type, s[0], s[1], z >= 0 ? z : at.z, { rng, level: p.level ?? zone.level, elite: p.elite?.[k] ?? null,
                                                                      state: p.state ?? E().band.state }));
  });
};

// --- Travellers and hidden sites --------------------------------------------------------------------------------
const DIRS = { "0,-1": "north", "1,-1": "north-east", "1,0": "east", "1,1": "south-east", "0,1": "south", "-1,1": "south-west",
               "-1,0": "west", "-1,-1": "north-west" };
export function direction(dx, dy) {
  if (!dx && !dy) return "here";
  const a = Math.atan2(dy, dx), k = Math.round(a / (Math.PI / 4));
  const sx = Math.round(Math.cos(k * Math.PI / 4)), sy = Math.round(Math.sin(k * Math.PI / 4));
  return DIRS[`${sx},${sy}`];
}
const spans = (n) => (n === 1 ? "a span" : `${["", "one", "two", "three", "four", "five", "six"][n] || n} spans`);

export function meetTravellers(game, at) {
  const run = game.run, A = game.state.atlas, R = E().travellers;
  const near = [...(run.sites?.values() || [])].filter((s) => s.kind !== "landmark" && !A.found[s.id]
    && Math.max(Math.abs(s.at.wx - at.wx), Math.abs(s.at.wy - at.wy)) <= R.rumour && (s.at.wx !== at.wx || s.at.wy !== at.wy));
  if (near.length) {
    const s = pick(game, near.sort((a, b) => a.id < b.id ? -1 : 1));
    findSite(game, s, "rumour");
    pin(game, s.at.wx, s.at.wy, { label: s.name });
    const n = Math.max(Math.abs(s.at.wx - at.wx), Math.abs(s.at.wy - at.wy));
    const line = fill(pick(game, E().lines.travellers), { site: s.name, spans: spans(n), dir: direction(s.at.wx - at.wx, s.at.wy - at.wy) });
    game.log?.(line, [150, 220, 255]);
    return line;
  }
  reveal(game, at.wx, at.wy, R.reveal);
  const line = pick(game, E().lines.roads);
  game.log?.(line, [150, 220, 255]);
  return line;
}

export function hiddenSiteRoll(game, at) {
  const A = game.state.atlas, list = (game.run.sitesAt?.get(spanKey(at.wx, at.wy)) || []).map((id) => game.run.sites.get(id));
  const chance = perkRank(game.player, "keenEyeSites") > 0 ? OW().hiddenSiteKeen : OW().hiddenSite;
  for (const s of list) {
    if (!s || s.kind === "landmark" || A.found[s.id]) continue;
    if (roll(game) < chance) return s;
  }
  return null;
}

export const siteLine = (s) => (E().lines.site[s.kind] || E().lines.site.other) + " Stop and look?";
