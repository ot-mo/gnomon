// Per-run sites (TECH_DESIGN §2.1 Site, §5.4, §5.5; bible §4.10, §8.7, §12.13): where the landmark dungeons,
// Hour sites, villages, ruins, lairs and stations of one run are, with their surface footprints and the specs of
// the dungeons under them.
//
//   placeSites(run) → run                 fills run.sites and run.sitesAt; draws from runRng(run, "sites") for where
//                                         things go (as P0 did), runRng(run, "historic") for history's sites, and a
//                                         stream of each site's own (siteRng) for what is inside it
//   dungeonLevelOf(spec, z) → level       the level of dungeon floor z (1-based)
//   siteWithDungeon(run, wx, wy) → Site | null    the span's site that has a dungeon below it
//   dungeonParams(run, site, z) → p       generateDungeonLevel's parameters for its level z
//   sinkholeSpots(run, site) → [[lx, ly]]  where the surface may open a sinkhole over level 1 (level coordinates)
//   placeLegends(run) → Map<uid, LegendDef>   the run's legends (every lair's owner), for run.legends
//   legendOf(run, uid) → LegendDef | null
//   SITE_BUILDERS[kind](ctx, site)        how a site is stamped into its surface zone (WS7: village; here: ruin,
//   registerSiteBuilder(kind, fn)         lair, historic, station, dungeon); a second builder for a kind throws
//
// Site = { id, kind, at: { wx, wy }, name, tier, landmarkId?, checkpoint?, historyRef?, legend?, toppled?,
//          surface: { builder, rect: { x, y, w, d } | null, params }, dungeon?: DungeonSpec }
// DungeonSpec = { levels, theme, baseLevel, levelStep, gimmicks, floorGimmicks?, floorLevels?, up?, namedUp?, legacy?,
//                 optional?, named?, vaultPool?, cradle?: [z], murals?: [{ text, map }],
//                 bottom: { kind: "guardian" | "legend" | "relic" | "boss" | "reading" | "none", id, uid?, hall?, trueMarks?,
//                           artifact?, hour? }, vaults?: { z: vaultId | { hall, guardian } } }
//   up: the levels of its floors up (z = −1, −2…; the Square's), namedUp their names.
//   Floor z's level is floorLevels[z − 1] when the floors are listed (the landmarks, bible §15.3), else
//   round(baseLevel + z × levelStep); baseLevel is the surface level, so a generic site's floor k is the
//   surface level + k (DECISIONS.md). The legacy stack has baseLevel 0: its levels are the parent's depths.
//   floorGimmicks[z − 1], when given, are floor z's gimmicks (an Hour site's leaning, a ruin's rolls); else
//   every floor has `gimmicks`.
// LegendDef = { uid, template, species, name, epithet, level, mutations: [id], opinions: [{ faction, feeling:
//               "loves" | "hates", reason }], hook, hall, siteId }   (content/creatures/legends.js)
//
// Placement:
//   1. Every landmark is a site (kind "landmark", id "landmark:<id>"), with its dungeon if it has one.
//   2. History's site requests (kind "historic", bible §8.7: Hour sites go by tier band), after step 3: each on a
//      free eligible span of its tier, nearest to it when none is free, in one of its regionPrefs when it can;
//      its floors named after the Hour's places (some nameless), its floors played by its Hour's leaning
//      (content/dungeons.js), the Hour's accounts carved in its murals, and at the bottom its relic on an altar
//      with true-marks by tier.
//   3. Villages, then ruins, lairs and stations, exactly as P0 placed them: for each kind the eligible spans
//      are shuffled, and each rolls its region's chance (regions[r].sites[kind]). A span is eligible when you
//      can travel onto it (travel "yes"), its edges are open, and it holds no landmark, road or river; a site
//      needs at least one free span between it and any other site (bible §4.10). A lair gets its legend (its
//      last level is the legend's hall); a ruin rolls a gimmick per floor, and a third of them are toppled
//      (bible §4.10: murals and mosaics); a station holds a Truing Cradle (WS5) on its surface.
//   4. A site's footprint keeps SITE_MARGIN (6) tiles from every zone edge; only landmarks may touch one.
import { runRng, zoneSeed } from "./run.js";
import { levelOfTier, tierOfLevel, SIDES, SITE_MARGIN } from "./worldmodel.js";
import { SURFACE, B, FLOOR_Z } from "../world.js";
import { makeRng, seedFor } from "../rng.js";
import { countGen } from "./genstats.js";
import { stampVault, BOSS_HALLS, READING_HALLS } from "../gen/vaults.js";
import { DUNGEON_W, DUNGEON_D } from "../gen/dungeon.js";
import { pickCreatureType, CREATURE_TYPES } from "../creatures.js";
import "../content/creatures/levels.js";   // (the level pool above 20, which it registers with creatures.js)
import { DUNGEONS } from "../content/dungeons.js";
import { LEGENDS } from "../content/creatures/legends.js";
import { ARTIFACTS, ARTIFACTS_WAITING } from "../content/items/artifacts.js";

export const SITE_BUILDERS = {};
export function registerSiteBuilder(kind, fn) {
  if (SITE_BUILDERS[kind]) throw new Error(`registerSiteBuilder: "${kind}" already has a builder`);
  SITE_BUILDERS[kind] = fn;
}

export const SITE_KINDS = ["village", "ruin", "lair", "historic", "station"];
// The kinds placed by a region's chance, in this order (P0's three first, so their draws are P0's).
const ROLLED = ["village", "ruin", "lair", "station"];
// Footprint sizes and dungeon depths of the per-run kinds (bible §4.10: ruins and lairs 1 to 3 floors; an Hour
// site's floors are its request's).
export const SITE_SHAPES = {
  village: { w: 24, d: 16, floors: [0, 0] },
  ruin: { w: 14, d: 10, floors: [1, 3] },
  lair: { w: 12, d: 10, floors: [1, 3] },
  historic: { w: 14, d: 10, floors: [2, 5] },
  station: { w: 10, d: 8, floors: [0, 0] },
};
// Fixture names: "<first> <second>" per kind, made unique with the span's coordinates when they repeat.
const NAMES = {
  village: [["Reedwick", "Saltcote", "Lampford", "Brindle", "Kettlewell", "Dimmock", "Hearthby", "Wickham"], ["", "Cross", "End", "Steading"]],
  ruin: [["the Fallen", "the Broken", "the Tilted", "the Hollow", "the Silent", "the Sunken"], ["Stair", "Gallery", "Mill", "Vault", "Arcade"]],
  lair: [["the Gnawed", "the Bone", "the Sour", "the Black", "the Low"], ["Den", "Burrow", "Hollow", "Nest"]],
  station: [["the Plumb", "the True", "the Level", "the Square"], ["Cradle", "Bench", "Fitting-house"]],
};

// A site's own stream: what is inside it never moves where anything else goes.
const siteRng = (run, id, purpose = "inside") => makeRng(seedFor(run.seed, "site", id, purpose));

export function dungeonLevelOf(spec, z) {
  if (spec.floorLevels) return spec.floorLevels[z - 1];
  return Math.round(spec.baseLevel + z * (spec.levelStep ?? 1));
}

// A landmark's dungeon definition (content) as a DungeonSpec.
function landmarkDungeon(L, world) {
  const d = L.dungeon, surface = levelOfTier(L.tier);
  const spec = {
    levels: d.floors ? d.floors.length : d.levels, theme: d.theme || "legacy",
    baseLevel: d.baseLevel ?? surface, levelStep: d.levelStep ?? 1, gimmicks: [...(d.gimmicks || [])],
    bottom: landmarkBottom(d),
  };
  if (d.id) spec.id = d.id;
  if (d.floors) spec.floorLevels = [...d.floors];
  if (d.up) { spec.up = [...d.up]; if (d.planned?.up) spec.namedUp = [...d.planned.up]; }   // floors up: z = −1, −2… (B2, C1b #8)
  if (d.legacy) spec.legacy = true;
  if (d.optional) spec.optional = true;
  if (d.named) spec.named = [...d.named];
  if (d.vaultPool) spec.vaultPool = [...d.vaultPool];
  if (d.cradle) spec.cradle = [...d.cradle];
  if (d.floorGimmicks) spec.floorGimmicks = d.floorGimmicks.map((g) => [...g]);
  if (d.planned?.creatures) spec.creatures = JSON.parse(JSON.stringify(d.planned.creatures));   // (its own inhabitants: dungeonParams)
  if (d.planned?.vaults) spec.vaults = JSON.parse(JSON.stringify(d.planned.vaults));   // a hall on a floor that isn't the last (B2, C1b #6)
  // Its places (B2): the clue and the captive (C1b #24: who stands there is C5's), the prisoners' cells (#20), and the far
  // mouth up to its landmark's grate (#22: the Root Canals' floor 2 to Molar's X, east of the checkpoint).
  const P = d.planned || {};
  if (P.clue) spec.clue = { floor: P.clue.floor, what: P.clue.what };
  if (P.captive) spec.captive = { floor: P.captive.floor, who: P.captive.who };
  if (P.prisoners) spec.prisoners = { floors: [...P.prisoners.floors] };
  if (P.theme && DUNGEONS.themes[P.theme]) spec.theme = P.theme;
  const mouth = P.exit && world?.plans?.[world.landmarks.get(P.exit.to)?.plan]?.farMouth, to = P.exit && world?.landmarks.get(P.exit.to);
  if (mouth && to?.anchor) spec.exit = { floor: P.exit.floor, key: `${to.wx},${to.wy},0`, at: [to.anchor[0] + mouth[0], to.anchor[1] + mouth[1]] };
  // The gimmicks' places (B2, C1b #10): falls down Kettle Mesa's shaft land unhurt, and its last floor's culvert carries you
  // up into Hollowmere's temple; the Datum's floors that open at a beat (the stair down to them sealed until then).
  if (P.softFalls) spec.softFalls = true;
  const home = P.culvert && world?.landmarks.get(P.culvert.to);
  if (home) spec.culvert = { floor: P.culvert.from, key: `${home.wx},${home.wy},0` };
  if (P.opensAtBeat) spec.opensAtBeat = { ...P.opensAtBeat };
  if (d.planned?.murals || d.murals) spec.murals = (d.planned?.murals || d.murals).map((m) => ({ ...m }));   // its own murals' words (B2, C1b #7)
  return spec;
}

// A landmark dungeon's bottom (bible §5; C1b's planned.bottom, B2, C1b #5): what the bible puts on its last floor, where
// the code builds it, else the bottom it stands on today (the Metronome's Escapement waits for its kind: the Colossus's
// hall until then).
//   legend    the Grub Mother: a LegendDef made from the data (placeSites: landmarkLegend), her lair hall
//   relic     the Noonglass (an artifact: `artifact`, laid by BOTTOM_LOOT.artifact once its kind does what it says) or
//             the Pressed's founding relic (`hour`: a relic of that Hour of the run's history that no Hour site holds)
//   boss      a boss's hall (gen/vaults.js BOSS_HALLS: the Press-hall, Noon's floor, the Noon Socket): its spot, and
//             the boss in it when its kind is registered (uid "boss:<site id>")
//   reading   the Datum stone on its plinth (gen/vaults.js READING_HALLS)
function landmarkBottom(d) {
  const b = d.planned?.bottom, now = d.bottom ? { kind: d.bottom.kind, id: d.bottom.id ?? null } : { kind: "none", id: null };
  if (!b) return now;
  if (b.kind === "legend") return { kind: "legend", id: b.id, species: b.species, template: b.template || "plain", name: b.name };
  if (b.kind === "relic") return { kind: "relic", id: b.id, artifact: ARTIFACTS[b.id] || ARTIFACTS_WAITING[b.id] ? b.id : null, hour: b.hour ?? null, trueMarks: [...(b.trueMarks || [])] };
  if (b.kind === "boss" && BOSS_HALLS[b.id]) return { kind: "boss", id: b.id };
  if (b.kind === "reading" && READING_HALLS[b.id]) return { kind: "reading", id: b.id };
  return now;
}

// A landmark dungeon's own inhabitants on floor z (C1b's planned.creatures, [type, weight]; the Dial-works' by odd and even
// floor), as a level table for that floor's level, registered kinds only: null when none is (integrator, C1b #19).
function ownTable(spec, z, level) {
  const c = spec.creatures, rows = Array.isArray(c) ? c : c ? c[z % 2 ? "odd" : "even"] : null;
  const live = (rows || []).filter(([type, w]) => CREATURE_TYPES[type] && w > 0);
  return live.length ? live.map(([type, w]) => [type, w, level, level]) : null;
}

function addSite(run, site) {
  if (run.sites.has(site.id)) throw new Error(`placeSites: site ${site.id} twice`);
  run.sites.set(site.id, site);
  const k = `${site.at.wx},${site.at.wy}`;
  if (!run.sitesAt.has(k)) run.sitesAt.set(k, []);
  run.sitesAt.get(k).push(site.id);
}

export function siteWithDungeon(run, wx, wy) {
  for (const id of run.sitesAt.get(`${wx},${wy}`) || []) {
    const s = run.sites.get(id);
    if (s?.dungeon) return s;
  }
  return null;
}

// Which puzzle vaults a level draws (content/dungeons.js vaultPools); the legacy theme keeps the parent's.
function vaultPoolFor(spec, level) {
  if (spec.vaultPool) return [...spec.vaultPool];
  if (spec.theme === "legacy" || spec.legacy) return null;
  const band = DUNGEONS.vaultPools.find((b) => level >= b.levels[0] && level <= b.levels[1]);
  return band ? band.pool.map((e) => (Array.isArray(e) ? [...e] : e)) : null;
}

// The spots over level 1 where the surface may open a sinkhole (gen/surface.js), in level coordinates: SINKHOLE_SPOTS
// of them, at least 4 apart, from the span's own seed. Level 1 makes each one floor you can reach and not stairs
// (dungeonParams' `landings`, gen/dungeon.js), so a fall lands right under its sinkhole and the surface needn't
// make level 1 to know where it can open one (integrator, C1a #9: that cost a dungeon level a span). None for the
// legacy stack, whose levels are the parent's.
export const SINKHOLE_SPOTS = 6;
export function sinkholeSpots(run, site) {
  if (!site?.dungeon || site.dungeon.legacy) return [];
  const rng = makeRng(seedFor(zoneSeed(run, site.at.wx, site.at.wy, 1), "sinkholes")), out = [];
  for (let k = 0; k < 200 && out.length < SINKHOLE_SPOTS; k++) {
    const x = rng.int(4, DUNGEON_W - 5), y = rng.int(4, DUNGEON_D - 5);
    if (out.every(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) >= 4)) out.push([x, y]);
  }
  return out;
}

// Level z of a site's dungeon (1-based): its level from the spec (DECISIONS.md: listed floors for a
// landmark, else the surface level + z), its theme, gimmicks and vaults, the region's creatures, and on the
// last level its bottom: a guardian's hall, a boss's throne, a legend's lair, an Hour site's reliquary ("none":
// an ordinary level).
export function dungeonParams(run, site, z) {
  if (z < 0) return upParams(run, site, z);
  const spec = site.dungeon, level = dungeonLevelOf(spec, z), final = z >= spec.levels;
  const tile = run.world.tileAt(site.at.wx, site.at.wy);
  let bottom = null;
  const b = spec.bottom;
  if (final && b && b.kind === "guardian") bottom = { kind: b.kind, id: b.id };
  else if (final && b?.kind === "boss") bottom = { kind: "boss", id: b.id, ...(site.kind === "landmark" ? { uid: `boss:${site.id}` } : {}) };
  else if (final && b?.kind === "reading") bottom = { kind: "reading", id: b.id };
  else if (final && b?.kind === "legend") {
    const legend = site.legend || null;
    bottom = legend ? { kind: "legend", id: b.id, uid: legend.uid, hall: legend.hall, legend: JSON.parse(JSON.stringify(legend)) } : null;
  } else if (final && b?.kind === "relic") {
    const relic = b.hour ? hourRelic(run, b.hour) : b.id && !b.artifact ? run.history?.relics?.find((r) => r.id === b.id) || null : null;
    bottom = { kind: "relic", id: b.id ?? null, relic: relic ? JSON.parse(JSON.stringify(relic)) : null, trueMarks: [...(b.trueMarks || [])] };
    if (b.artifact) bottom.artifact = b.artifact;
  }
  // A hall on a floor that isn't the last (C1b's planned.vaults: Kettle Mesa's Flat Lie, the Speaking Door, the Gloam
  // Warden's hall with its own guardian in it; B2, C1b #6).
  const v = !final && spec.vaults?.[z], forced = typeof v === "string" ? v : v?.hall || null;
  return {
    key: `${site.at.wx},${site.at.wy},${z}`, wx: site.at.wx, wy: site.at.wy, z, level, tier: tierOfLevel(level),
    index: z, count: spec.levels, final, theme: spec.theme || "legacy", hasUp: true, forcedVault: forced, ...(v?.guardian ? { vaultGuardian: v.guardian } : {}),
    vaultPool: vaultPoolFor(spec, level), gimmicks: [...(spec.floorGimmicks?.[z - 1] || spec.gimmicks || [])], bottom, encounters: [],
    creatureTable: ownTable(spec, z, level) || run.world.regions?.[tile?.region]?.creatures || null, holesIn: null,   // (its own inhabitants first: integrator, C1b #19)
    cradle: !!spec.cradle?.includes(z), murals: (final && b?.hour && hourAccounts(run, b.hour)) || (spec.murals ? spec.murals.map((m) => ({ ...m })) : null),
    name: spec.named?.[z - 1] || `${site.name}, level ${z}`,
    landings: z === 1 ? sinkholeSpots(run, site).map(([x, y]) => [x, y]) : null,
    ...(spec.clue?.floor === z ? { clue: { ...spec.clue } } : {}), ...(spec.captive?.floor === z ? { captive: { ...spec.captive } } : {}),
    ...(spec.prisoners?.floors.includes(z) ? { prisoners: 2 } : {}), ...(spec.exit?.floor === z ? { exit: { key: spec.exit.key, at: [...spec.exit.at] } } : {}),
    ...(spec.softFalls ? { softFalls: true } : {}), ...(spec.culvert?.floor === z ? { culvert: { key: spec.culvert.key } } : {}),
    ...(spec.opensAtBeat?.[z + 1] ? { sealedBelow: { beat: spec.opensAtBeat[z + 1] } } : {}),
  };
}

// A floor up (z = −1, −2…; the Square's Rule Floor and Hierarch's Floor, levels 22 and 23: bible §5 M, §15.3; B2, C1b
// #8): its level from spec.up, its name from spec.namedUp. The stair up from the surface (gen/surface.js: zone.hasAbove)
// comes out by its stairs down, which lead back to z + 1; the top one has no stairs up. No holes and no vault with chasms
// (a fall from the first floor up would land on the surface out of line with it), and no sinkholes over it.
function upParams(run, site, z) {
  const spec = site.dungeon, k = -z, level = spec.up[k - 1], top = k >= spec.up.length;
  const tile = run.world.tileAt(site.at.wx, site.at.wy);
  return {
    key: `${site.at.wx},${site.at.wy},${z}`, wx: site.at.wx, wy: site.at.wy, z, level, tier: tierOfLevel(level),
    index: z, count: spec.up.length, final: false, up: true, theme: spec.theme || "legacy", hasUp: !top, forcedVault: null,
    vaultPool: (vaultPoolFor(spec, level) || null), noHoles: true, gimmicks: [...(spec.gimmicks || [])], bottom: null, encounters: [],
    creatureTable: ownTable(spec, z, level) || run.world.regions?.[tile?.region]?.creatures || null, holesIn: { x0: 0, y0: 0, x1: -1, y1: -1 },
    cradle: false, murals: spec.murals ? spec.murals.map((m) => ({ ...m })) : null,
    name: spec.namedUp?.[k - 1] || `${site.name}, floor ${k} up`, landings: null,
  };
}

// A relic of the run's Hour `hour` (1 the First … 5 the Fifth) that no Hour site holds and none lost: the Pressed's
// founding relic is the Second Hour's (bible §5 O). null when the history has none (the test world's fixture).
export function hourRelic(run, hour) {
  const H = run.history, ruler = H?.rulers?.[hour - 1];
  if (!ruler) return null;
  const held = new Set((H.siteRequests || []).map((r) => r.relicId).filter(Boolean));
  const own = (H.relics || []).filter((r) => r.rulerId === ruler.id && !held.has(r.id) && !r.lostAt);
  return own.find((r) => r.mask) || own[0] || null;
}

// The Hour's stele on a bottom that names one (the Under-Page's Second-Hour stele, bible §5 O): its first event's three
// accounts, carved in the walls, laid in the floor and cut as a rune (the murals gimmick). null without that Hour.
function hourAccounts(run, hour) {
  const e = run.history?.rulers?.[hour - 1]?.events?.find((ev) => ev.text?.inscription && ev.text?.gospel);
  return e ? [{ text: e.text.inscription, map: e.text.gospel, dark: e.text.hostile, eventId: e.id }] : null;
}

// A landmark's legend (the Grub Mother: bible §5 C), from the data rather than drawn: her species and name, at the
// bottom level + 3 as every legend (bible §12.13), the template's hall and hook, no mutations or opinions. She holds
// her landmark's bottom: she never roams (placeLegends leaves her out of run.legends; guardians.js and legendOf find
// her by her site).
function landmarkLegend(site) {
  const b = site.dungeon.bottom, tpl = LEGENDS.templates[b.template] || LEGENDS.templates.plain;
  return { uid: `legend:${site.id}`, template: b.template, species: b.species, name: b.name, epithet: "", level: dungeonLevelOf(site.dungeon, site.dungeon.levels) + LEGENDS.base.levels,
           mutations: [], opinions: [], hook: tpl.hook || null, hall: tpl.hall, siteId: site.id, roams: false };
}

// --- Holy places and dial-steles (B2, C1b #3, #21: the data C2's attitude and steleHour read) --------------------------
// holyAt(zone, x, y) → { faction, rule } | null: whose holy place the tile is, finest first: a plan's area (Halfnight's
// north row "noTorch", the West Ward's Hour-house "torchLit", Molar's checkpoint and Benchmark's fitting-house "holy"), else
// the zone's own (a landmark's surface or span: zone.holy, rule "holy"; a landmark dungeon's holy floor the same). The
// rules: "holy" (the faith's own trespass, bible §6), "noTorch" (a lit torch is trespass), "torchLit" (a torch out is).
export function holyAt(zone, x, y) {
  const a = (zone?.holyAreas || []).find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  if (a) return { faction: a.faction, rule: a.rule };
  return zone?.holy ? { faction: zone.holy, rule: "holy" } : null;
}
// steleAt(zone, x, y) → the carved hour (0-23) of the dial-stele on that tile, else null (the Tall Table's, Molar's,
// Foldmother's: zone.steles).
export function steleAt(zone, x, y) {
  const st = (zone?.steles || []).find((s) => s.x === x && s.y === y);
  return st ? st.hour : null;
}

// --- Legends (bible §12.13) ------------------------------------------------------------------------------
// A name in the Hours' phonology: an onset, a middle (sometimes two) and a final, 3 to 9 letters, none of bible
// §15.11's terms in it.
const REJECT = LEGENDS.names.rejectReversed.map((w) => [...w].reverse().join(""));
function legendName(rng) {
  const N = LEGENDS.names;
  for (;;) {
    const parts = [rng.pick(N.onsets), rng.pick(N.middles), ...(rng.chance(0.3) ? [rng.pick(N.middles)] : []), rng.pick(N.finals)];
    const name = parts.join("");
    if (name.length >= 3 && name.length <= 9 && !REJECT.some((w) => name.includes(w))) return name[0].toUpperCase() + name.slice(1);
  }
}
// The lair's owner: a species of its level, one template, 0-2 mutations, 1-3 opinions with their reasons.
// Its level is the lair's bottom level + 3 (bible §12.13's base rule).
// region: the lair's span's region. One with an entry in LEGENDS.regions (the real world's, C3) gives the species by
// weight, a Herdmother's herd, and the factions its opinions are about, each feeling drawn first and its reason from
// LEGENDS.reasons[faction][feeling] (integrator, C3 #4); elsewhere (the test world) the draws are as they were.
export function makeLegend(rng, site, bottomLevel, region = null) {
  const base = LEGENDS.base, level = bottomLevel + base.levels, R = region ? LEGENDS.regions?.[region] : null;
  const ids = Object.keys(LEGENDS.templates);
  const byWeight = (rows) => { const live = rows.filter(([t]) => CREATURE_TYPES[t]); if (!live.length) return null;
    let k = rng() * live.reduce((a, [, w]) => a + w, 0); for (const [t, w] of live) if ((k -= w) < 0) return t; return live[live.length - 1][0]; };
  let template = rng.pick(ids), species = (R && byWeight(R.species || [])) || pickCreatureType(rng, level);
  const tpl = () => LEGENDS.templates[template];
  if (tpl().species) {
    const fits = (R ? R.herds || [] : tpl().species).filter((s) => CREATURE_TYPES[s]);
    if (fits.length) species = rng.pick(fits);
    else template = "plain";
  }
  const muts = Object.keys(LEGENDS.mutations);
  const mutations = rng.shuffle(muts.slice()).slice(0, rng.int(base.mutations[0], base.mutations[1]));
  const pool = R ? (R.factions || []).filter((f) => LEGENDS.reasons?.[f]) : Object.keys(LEGENDS.factions);
  const factions = rng.shuffle(pool.slice()).slice(0, rng.int(base.opinions[0], base.opinions[1]));
  const opinions = factions.map((f) => {
    const feeling = rng.chance(0.5) ? "loves" : "hates";
    return { faction: f, feeling, reason: rng.pick(R ? LEGENDS.reasons[f][feeling] : LEGENDS.factions[f]) };
  });
  return { uid: `legend:${site.id}`, template, species, name: legendName(rng), epithet: rng.pick(tpl().epithets), level,
           mutations, opinions, hook: tpl().hook || null, hall: tpl().hall, siteId: site.id };
}
export function placeLegends(run) {
  const out = new Map();
  for (const s of run.sites.values()) if (s.legend && s.legend.roams !== false) out.set(s.legend.uid, s.legend);
  return out;
}
export function legendOf(run, uid) {
  return run?.legends?.get(uid) || [...(run?.sites?.values() || [])].find((s) => s.legend?.uid === uid)?.legend || null;
}

// --- History's sites (bible §8.7) --------------------------------------------------------------------------
// A floor name from the Hour's places ("the Salted Granary of Mereford"), or none (a liminal floor).
function floorName(rng, adjective) {
  const F = DUNGEONS.floorNames;
  return `the ${adjective} ${rng.pick(F.rooms)} of ${rng.pick(F.places)}`;
}
const RUIN_ADJECTIVES = { salt: "Salted", glass: "Glazed", ink: "Blotted", paper: "Folded", shade: "Gloaming", stairs: "Stepped",
                          horn: "Horned", rust: "Rusted", wax: "Waxen", gears: "Wound" };

function historicSite(run, req, t) {
  const rng = siteRng(run, req.id), ruler = run.history.rulers.find((r) => r.id === req.rulerId) || null;
  const domain = ruler?.domains?.[0] || "salt", leaning = DUNGEONS.leanings[DUNGEONS.domains[domain] || "salt"];
  const levels = Math.max(1, Math.min(5, req.floors || 2));
  const named = [];
  for (let z = 1; z <= levels; z++)
    named.push(z < levels && rng.chance(DUNGEONS.floorNames.liminal) ? null : floorName(rng, RUIN_ADJECTIVES[domain] || "Old"));
  const events = (ruler?.events || []).filter((e) => e.text);
  const murals = events.slice(0, 3).map((e) => ({ text: e.text.inscription, map: e.text.gospel, dark: e.text.hostile, eventId: e.id }));
  const shape = SITE_SHAPES.historic;
  const rect = { x: rng.int(SITE_MARGIN, SURFACE.w - SITE_MARGIN - shape.w), y: rng.int(SITE_MARGIN, SURFACE.d - SITE_MARGIN - shape.d), w: shape.w, d: shape.d };
  const marks = DUNGEONS.trueMarks[Math.min(8, Math.max(1, t.tier))] || [1];
  return {
    id: req.id, kind: "historic", at: { wx: t.wx, wy: t.wy }, name: req.name, tier: t.tier,
    historyRef: { rulerId: req.rulerId, eventId: req.eventId, requestId: req.id, relicId: req.relicId ?? null },
    surface: { builder: "historic", rect, params: { inscription: events.find((e) => e.id === req.eventId)?.text.inscription || null,
                                                  gospel: events.find((e) => e.id === req.eventId)?.text.gospel || null } },
    dungeon: {
      levels, theme: leaning.theme, baseLevel: levelOfTier(t.tier), levelStep: 1, gimmicks: [],
      floorGimmicks: Array.from({ length: levels }, (_, k) => [...(k % 2 === 0 ? leaning.odd : leaning.even)]),
      named: named.map((n, k) => n || `${req.name}, level ${k + 1}`), murals: murals.length ? murals : null,
      bottom: { kind: "relic", id: req.relicId ?? null, trueMarks: [...marks] },
    },
  };
}

// The span for a request: free and eligible, of the request's tier (else the nearest tier), in one of its
// preferred regions when one has such a span; ties drawn by rng.
function spanFor(run, req, eligible, busy, rng) {
  const free = eligible.filter((t) => !busy(t.wx, t.wy));
  if (!free.length) return null;
  const prefs = new Set(req.regionPrefs || []);
  const score = (t) => Math.abs(t.tier - (req.tier || 1)) * 2 + (prefs.has(t.region) ? 0 : 1);
  const best = Math.min(...free.map(score));
  return rng.pick(free.filter((t) => score(t) === best));
}

export function placeSites(run) {
  countGen("sites");
  const { world } = run, rng = runRng(run, "sites");
  run.sites = new Map(); run.sitesAt = new Map();

  for (const L of world.landmarks.values()) {
    const site = {
      id: `landmark:${L.id}`, kind: "landmark", at: { wx: L.wx, wy: L.wy }, name: L.name, tier: L.tier,
      landmarkId: L.id, checkpoint: L.checkpoint,
      surface: { builder: "landmark", rect: L.rect ? { ...L.rect } : null, params: { plan: L.plan, anchor: L.anchor } },
    };
    if (L.dungeon) site.dungeon = landmarkDungeon(L, world);
    if (site.dungeon?.bottom.kind === "legend") site.legend = landmarkLegend(site);
    addSite(run, site);
  }

  const busy = (wx, wy) => {   // a site on this span or next to it (landmark spans count)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const t = world.tileAt(wx + dx, wy + dy);
        if (t && (t.landmark || run.sitesAt.has(`${wx + dx},${wy + dy}`))) return true;
      }
    return false;
  };
  const eligible = world.tiles.filter((t) => t.travel === "yes" && t.edges === "open" && !t.landmark
    && !SIDES.some((s) => t.road[s] || t.river[s]) && t.roadWidth === 0 && t.riverWidth === 0);

  const used = new Set();
  // A village (or another rolled site) on span t, its looks and name drawn from r.
  const rolledSite = (kind, t, r) => {
    const shape = SITE_SHAPES[kind];
    const rect = { x: r.int(SITE_MARGIN, SURFACE.w - SITE_MARGIN - shape.w), y: r.int(SITE_MARGIN, SURFACE.d - SITE_MARGIN - shape.d),
                   w: shape.w, d: shape.d };
    const [firsts, seconds] = NAMES[kind];
    let name = `${r.pick(firsts)} ${r.pick(seconds)}`.trim();
    if (used.has(name)) name = `${name} (${t.wx}, ${t.wy})`;
    used.add(name);
    const site = { id: `${kind}:${t.wx},${t.wy}`, kind, at: { wx: t.wx, wy: t.wy }, name, tier: t.tier,
                   surface: { builder: kind, rect, params: {} } };
    if (kind === "village") site.checkpoint = true;
    const floors = r.int(shape.floors[0], shape.floors[1]);
    if (floors > 0)
      site.dungeon = { levels: floors, theme: "legacy", baseLevel: levelOfTier(t.tier), levelStep: 1, gimmicks: [],
                       bottom: { kind: "none", id: null } };
    furnish(run, site);
    addSite(run, site);
  };

  // Villages by quota (bible §4.10: 16 in all, by region; integrator, C1a #1 and #2): a region with `villages` gets
  // that many first, on free spans of its own drawn from its own stream (an eligible one, else one of its walk-in spans
  // with open edges: the Teeth's crag village), so nothing here moves the draws below. A region without a quota (the
  // test world's three) gets villages only by chance, as before.
  for (const [id, R] of Object.entries(world.regions || {})) {
    if (!(R.villages > 0)) continue;
    const vrng = runRng(run, `villages ${id}`);
    const walkIn = world.tiles.filter((t) => t.region === id && t.travel === "no" && t.edges === "open" && !t.landmark
      && !SIDES.some((s) => t.road[s] || t.river[s]) && t.roadWidth === 0 && t.riverWidth === 0);
    const order = [...vrng.shuffle(eligible.filter((t) => t.region === id)), ...vrng.shuffle(walkIn)];
    let placed = 0;
    for (const t of order) {
      if (placed >= R.villages) break;
      if (busy(t.wx, t.wy)) continue;
      rolledSite("village", t, vrng);
      placed++;
    }
  }

  for (const kind of ROLLED) {
    const order = rng.shuffle(eligible.slice());
    for (const t of order) {
      const chance = world.regions[t.region]?.sites?.[kind] || 0;
      if (!(rng() < chance) || busy(t.wx, t.wy)) continue;
      rolledSite(kind, t, rng);
    }
  }

  // History's sites, on a stream of their own. (Bible §4.10 places them first; here they come after P0's kinds,
  // so that P0's villages, ruins and lairs keep exactly the spans P0 gave them: a span P0 found busy skips its
  // site's draws, so anything placed earlier would move every later site. Each still gets a free span of its
  // tier, or the nearest tier.)
  const hrng = runRng(run, "historic");
  for (const req of run.history?.siteRequests || []) {
    if (run.sites.has(req.id)) continue;
    const t = spanFor(run, req, eligible, busy, hrng);
    if (t) addSite(run, historicSite(run, req, t));
  }
  return run;
}

// What a rolled site holds (its own stream, so it never moves where the sites go): a lair's legend and hall,
// a ruin's theme and floors, a station's Cradle.
function furnish(run, site) {
  const d = site.dungeon, srng = siteRng(run, site.id);
  if (site.kind === "lair" && d) {
    const k = DUNGEONS.kinds.lair;
    d.theme = k.theme;
    site.legend = makeLegend(srng, site, dungeonLevelOf(d, d.levels), run.world.tileAt(site.at.wx, site.at.wy)?.region);
    d.bottom = { kind: "legend", id: site.legend.template, uid: site.legend.uid, hall: site.legend.hall };
    d.floorGimmicks = rollGimmicks(srng, k.gimmicks, d.levels);
  } else if (site.kind === "ruin" && d) {
    const k = DUNGEONS.kinds.ruin;
    d.theme = k.theme;
    site.toppled = srng.chance(1 / 3);   // bible §4.10: a third are Toppled Stacks
    d.floorGimmicks = rollGimmicks(srng, k.gimmicks, d.levels);
    if (site.toppled) for (const g of d.floorGimmicks) if (!g.includes("murals")) g.unshift("murals");
  }
}
function rollGimmicks(rng, table, levels) {
  return Array.from({ length: levels }, () => table.filter(([, chance]) => rng.chance(chance)).map(([id]) => id));
}

// --- Surface builders (§5.4: SITE_BUILDERS; ctx = { run, zone, rng, rect, hub, H, plan, reserved }) ---------
// Each stamps a small plan into the site's flattened footprint (gen/vaults.js letters, roof open to the sky)
// and, when a dungeon lies below, its entrance: a STAIRS block in the middle (zone.stairs, which the surface
// makes zone.entrance).
const gridOf = (w, d, fn) => Array.from({ length: d }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y)).join(""));
// Its walls and rubble are planned (ctx.plan): the surface's checks don't count their steps as rough ground.
// Anything two blocks high or more is a wall on the map (zone.planWalls), as a landmark plan's walls are.
const TALL = new Set(["#", "2", "3", "l", "C"]);
function stampSite(ctx, site, plan, { wall, floor, wallHeight = 2, roof = "none", height = 4 }) {
  const { zone, rect, rng } = ctx;
  const vault = { id: `site:${site.kind}`, name: site.name, height, wall, floorBlock: floor, plan, links: [] };
  stampVault(zone, vault, rect.x, rect.y, rng, { roof, wallHeight });
  zone.planWalls ||= new Uint8Array(zone.w * zone.d);
  plan.forEach((row, y) => [...row].forEach((ch, x) => {
    const i = rect.x + x + (rect.y + y) * zone.w;
    if (ch !== "." && ctx.plan) ctx.plan[i] = 1;
    if (TALL.has(ch) && (ch !== "#" || wallHeight >= 2)) zone.planWalls[i] = 1;
  }));
}
function entrance(ctx, site, at = null) {
  if (!site.dungeon) return;
  const { zone, rect } = ctx;
  const x = at ? rect.x + at[0] : rect.x + (rect.w >> 1), y = at ? rect.y + at[1] : rect.y + (rect.d >> 1);
  for (let z = FLOOR_Z; z < zone.h; z++) zone.set(x, y, z, B.AIR);
  zone.set(x, y, FLOOR_Z - 1, B.STAIRS);
  zone.stairs = { x, y };
}
const ring = (x, y, cx, cy) => Math.max(Math.abs(x - cx), Math.abs(y - cy));

// A ruin: a broken ring of old brick, rubble, the stair down in the middle. (A toppled one: its old floor
// mosaic stands up as a wall and is read in 3D; zone.murals says what it shows.)
registerSiteBuilder("ruin", (ctx, site) => {
  const { rect, rng } = ctx, cx = rect.w >> 1, cy = rect.d >> 1;
  const plan = gridOf(rect.w, rect.d, (x, y) => {
    if (ring(x, y, cx, cy) <= 1) return ".";
    const edge = x === 0 || y === 0 || x === rect.w - 1 || y === rect.d - 1;
    if (edge) return rng.chance(0.4) ? "." : "#";
    return rng.chance(0.06) ? "1" : ".";
  });
  stampSite(ctx, site, plan, { wall: B.BRICK, floor: B.TILE });
  entrance(ctx, site);
});
// A lair: a ring of rock and bone round the hole, open to the south (where the roads come from).
registerSiteBuilder("lair", (ctx, site) => {
  const { rect, rng } = ctx, cx = rect.w >> 1, cy = rect.d >> 1;
  const plan = gridOf(rect.w, rect.d, (x, y) => {
    const r = ring(x, y, cx, cy);
    if (r === 3) return y > cy && Math.abs(x - cx) <= 1 ? "." : "2";
    if (r === 4) return rng.chance(0.25) ? "1" : ".";
    return ".";
  });
  stampSite(ctx, site, plan, { wall: B.BONE, floor: B.DIRT });
  entrance(ctx, site);
});
// An Hour site: a paved square, a dial-stele carved with the Hour's inscription (read it in 3D) and the
// gospel laid into the paving in gold (read it on the map), the stair down between them.
registerSiteBuilder("historic", (ctx, site) => {
  const { rect, zone } = ctx, cx = rect.w >> 1;
  const plan = gridOf(rect.w, rect.d, (x, y) => (x === cx && y === 1 ? "3" : "."));
  stampSite(ctx, site, plan, { wall: B.STONE, floor: B.TILE });
  zone.set(rect.x + cx, rect.y + 1, FLOOR_Z + 1, B.MURAL);
  for (let dx = -2; dx <= 2; dx++) zone.set(rect.x + cx + dx, rect.y + rect.d - 3, FLOOR_Z - 1, dx === 0 ? B.MOSAIC_GOLD : B.MOSAIC_WHITE);
  const p = site.surface.params || {};
  zone.murals = [
    ...(p.inscription ? [{ x: rect.x + cx, y: rect.y + 1, z: FLOOR_Z + 1, view: "3d", text: p.inscription }] : []),
    ...(p.gospel ? [{ x: rect.x + cx, y: rect.y + rect.d - 3, z: FLOOR_Z - 1, view: "map", text: p.gospel }] : []),
  ];
  entrance(ctx, site);
});
// A station: a small slab-roofed fitting-house with a Truing Cradle (WS5's station) against its back wall.
registerSiteBuilder("station", (ctx, site) => {
  const { rect } = ctx, cx = rect.w >> 1;
  const plan = gridOf(rect.w, rect.d, (x, y) => {
    const inner = x >= 2 && x <= rect.w - 3 && y >= 1 && y <= rect.d - 2;
    const wallRing = (x === 1 || x === rect.w - 2 || y === 0 || y === rect.d - 1) && x >= 1 && x <= rect.w - 2;
    if (y === rect.d - 1 && x === cx) return ".";   // the door
    if (wallRing) return x === 1 && y === 3 ? "l" : "#";
    if (inner && x === cx && y === 1) return "C";
    return ".";
  });
  stampSite(ctx, site, plan.map((row) => row), { wall: B.STONE, floor: B.TILE, wallHeight: 3, roof: "none" });
  const { zone } = ctx;
  zone.set(rect.x + cx, rect.y + 1, FLOOR_Z, B.STATION);
  zone.set(rect.x + cx, rect.y + 1, FLOOR_Z + 1, B.STATION);
  zone.cradle = { x: rect.x + cx, y: rect.y + 1 };
  entrance(ctx, site, [cx, rect.d - 3]);
});
// Any other site with a dungeon (kind "dungeon"): the bare stair, four stones round it.
registerSiteBuilder("dungeon", (ctx, site) => {
  const { rect, zone } = ctx, cx = rect.x + (rect.w >> 1), cy = rect.y + (rect.d >> 1);
  for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) zone.set(cx + dx, cy + dy, FLOOR_Z, B.STONE);
  entrance(ctx, site);
});
