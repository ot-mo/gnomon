// Per-run sites (TECH_DESIGN §2.1 Site, §5.4): where the landmark dungeons, villages, ruins and lairs
// of one run are, with their surface footprints and the specs of the dungeons under them.
//
//   placeSites(run) → run                 fills run.sites and run.sitesAt; draws only from runRng(run, "sites")
//   dungeonLevelOf(spec, z) → level       the level of dungeon floor z (1-based)
//   siteWithDungeon(run, wx, wy) → Site | null    the span's site that has a dungeon below it
//   dungeonParams(run, site, z) → p       generateDungeonLevel's parameters for its level z
//   SITE_BUILDERS[kind](ctx, site)        how a site is stamped into its surface zone (WS7: village; WS10:
//   registerSiteBuilder(kind, fn)         dungeon, lair, ruin, historic, station); a second builder for a kind throws
//
// Site = { id, kind, at: { wx, wy }, name, tier, landmarkId?, checkpoint?,
//          surface: { builder, rect: { x, y, w, d } | null, params }, dungeon?: DungeonSpec }
// DungeonSpec = { levels, theme, baseLevel, levelStep, gimmicks, floorLevels?, up?, legacy?, optional?, named?, vaultPool?,
//                 bottom: { kind: "guardian" | "legend" | "relic" | "boss" | "none", id } }
//   Floor z's level is floorLevels[z − 1] when the floors are listed (the landmarks, bible §15.3), else
//   round(baseLevel + z × levelStep); baseLevel is the surface level, so a generic site's floor k is the
//   surface level + k (DECISIONS.md). The legacy stack has baseLevel 0: its levels are the parent's depths.
//
// Placement (P0; WS10 adds history's site requests, lairs with legends, historic sites and stations):
//   1. Every landmark is a site (kind "landmark", id "landmark:<id>"), with its dungeon if it has one.
//   2. Villages, then ruins, then lairs. For each kind the eligible spans are shuffled, and each rolls its
//      region's chance (regions[r].sites[kind]). A span is eligible when you can travel onto it (travel
//      "yes"), its edges are open, and it holds no landmark, road or river; a site needs at least one free
//      span between it and any other site (bible §4.10).
//   3. A site's footprint keeps SITE_MARGIN (6) tiles from every zone edge; only landmarks may touch one.
import { runRng } from "./run.js";
import { levelOfTier, tierOfLevel, SIDES, SITE_MARGIN } from "./worldmodel.js";
import { SURFACE } from "../world.js";
import { countGen } from "./genstats.js";

export const SITE_BUILDERS = {};
export function registerSiteBuilder(kind, fn) {
  if (SITE_BUILDERS[kind]) throw new Error(`registerSiteBuilder: "${kind}" already has a builder`);
  SITE_BUILDERS[kind] = fn;
}

export const SITE_KINDS = ["village", "ruin", "lair"];
// Footprint sizes and dungeon depths of the per-run kinds (placeholders until WS7 and WS10).
export const SITE_SHAPES = {
  village: { w: 24, d: 16, floors: [0, 0] },
  ruin: { w: 14, d: 10, floors: [1, 3] },
  lair: { w: 12, d: 10, floors: [1, 3] },
};
// Fixture names: "<first> <second>" per kind, made unique with the span's coordinates when they repeat.
const NAMES = {
  village: [["Reedwick", "Saltcote", "Lampford", "Brindle", "Kettlewell", "Dimmock", "Hearthby", "Wickham"], ["", "Cross", "End", "Steading"]],
  ruin: [["the Fallen", "the Broken", "the Tilted", "the Hollow", "the Silent", "the Sunken"], ["Stair", "Gallery", "Mill", "Vault", "Arcade"]],
  lair: [["the Gnawed", "the Bone", "the Sour", "the Black", "the Low"], ["Den", "Burrow", "Hollow", "Nest"]],
};

export function dungeonLevelOf(spec, z) {
  if (spec.floorLevels) return spec.floorLevels[z - 1];
  return Math.round(spec.baseLevel + z * (spec.levelStep ?? 1));
}

// A landmark's dungeon definition (content) as a DungeonSpec.
function landmarkDungeon(L) {
  const d = L.dungeon, surface = levelOfTier(L.tier);
  const spec = {
    levels: d.floors ? d.floors.length : d.levels, theme: d.theme || "legacy",
    baseLevel: d.baseLevel ?? surface, levelStep: d.levelStep ?? 1, gimmicks: [...(d.gimmicks || [])],
    bottom: d.bottom ? { kind: d.bottom.kind, id: d.bottom.id ?? null } : { kind: "none", id: null },
  };
  if (d.id) spec.id = d.id;
  if (d.floors) spec.floorLevels = [...d.floors];
  if (d.up) spec.up = [...d.up];
  if (d.legacy) spec.legacy = true;
  if (d.optional) spec.optional = true;
  if (d.named) spec.named = [...d.named];
  if (d.vaultPool) spec.vaultPool = [...d.vaultPool];
  return spec;
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

// Level z of a site's dungeon (1-based): its level from the spec (DECISIONS.md: listed floors for a
// landmark, else the surface level + z), its theme, gimmicks and vaults, and on the last level its
// bottom (a guardian's hall, a boss's throne; "none" and the parts WS10 adds get an ordinary level).
export function dungeonParams(run, site, z) {
  const spec = site.dungeon, level = dungeonLevelOf(spec, z), final = z >= spec.levels;
  const bottom = final && (spec.bottom?.kind === "guardian" || spec.bottom?.kind === "boss") ? { kind: spec.bottom.kind, id: spec.bottom.id } : null;
  return {
    key: `${site.at.wx},${site.at.wy},${z}`, wx: site.at.wx, wy: site.at.wy, z, level, tier: tierOfLevel(level),
    index: z, count: spec.levels, final, theme: spec.theme || "legacy", hasUp: true, forcedVault: null,
    vaultPool: spec.vaultPool || null, gimmicks: [...(spec.gimmicks || [])], bottom, encounters: [],
    name: spec.named?.[z - 1] || `${site.name}, level ${z}`,
  };
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
    if (L.dungeon) site.dungeon = landmarkDungeon(L);
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
  for (const kind of SITE_KINDS) {
    const order = rng.shuffle(eligible.slice());
    for (const t of order) {
      const chance = world.regions[t.region]?.sites?.[kind] || 0;
      if (!(rng() < chance) || busy(t.wx, t.wy)) continue;
      const shape = SITE_SHAPES[kind];
      const rect = { x: rng.int(SITE_MARGIN, SURFACE.w - SITE_MARGIN - shape.w), y: rng.int(SITE_MARGIN, SURFACE.d - SITE_MARGIN - shape.d),
                     w: shape.w, d: shape.d };
      const [firsts, seconds] = NAMES[kind];
      let name = `${rng.pick(firsts)} ${rng.pick(seconds)}`.trim();
      if (used.has(name)) name = `${name} (${t.wx}, ${t.wy})`;
      used.add(name);
      const site = { id: `${kind}:${t.wx},${t.wy}`, kind, at: { wx: t.wx, wy: t.wy }, name, tier: t.tier,
                     surface: { builder: kind, rect, params: {} } };
      if (kind === "village") site.checkpoint = true;
      const floors = rng.int(shape.floors[0], shape.floors[1]);
      if (floors > 0)
        site.dungeon = { levels: floors, theme: "legacy", baseLevel: levelOfTier(t.tier), levelStep: 1, gimmicks: [],
                         bottom: { kind: "none", id: null } };
      addSite(run, site);
    }
  }
  return run;
}
