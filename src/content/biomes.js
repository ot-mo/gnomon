// Biome data (TECH_DESIGN §5.3, §2.18; WS2, then C1 for the final data): per biome id (a terrain's `biome`, else
// its id: world/worldmodel.js tile.biome), what the world functions and its builder (gen/biomes/<biome>.js) read.
// The terrain itself (content/world/terrains.js) keeps ground, relief, cliffs and trees; this table adds:
//
//   liquid      what the span's surface water holds when no river runs through it (a river's own liquid wins,
//               so a river is the same liquid on both sides of every edge): one liquid per span (DECISIONS:
//               no mixing). An id of content/liquids.js; "water" is plain fresh water.
//   cliffTiers  1 or 2: with 2 the cliff mask's cores rise a second time (mesas stacked like stairs, bible
//               §4.4's Rust Steps), still at most 12 blocks above the datum (DECISIONS: heights)
//   sub         the block a raised column is made of from the datum's layer up to its ground block (a world
//               function: the zone and its neighbours' aprons build it alike); rock below that
//
// The builder's fields (gen/biomes/common.js dress reads them; every count is per zone, [lo, hi] inclusive):
//   rocks       { block, count, tall }: outcrops of `block`; a share `tall` of them stand 2-3 blocks (walls on the
//               map, scenery in 3D), the rest are 1-block rubble you step onto
//   ponds       { count, radius }: pools at the datum on rock, in the zone's liquid (the span's), banks sloping
//               down to them; a deep middle from radius 3
//   props       { count, kinds: [[prop, weight]] }: non-blocking sprites (PROPS below), zone.props
//   lights      { count, post }: lamp posts (a `post` column 2 blocks high with a lamp on top: the outdoor light
//               sources, the commons lamps of the Flats). Each lamp floods its light when the zone refreshes
//               (about a millisecond), so they stay few
//   plateaus    the chance of one deliberate 3D-only plateau (and the same chance again of a second; at most
//               SURFACE_RULES.jumpSpots): 2 blocks above everything round it, a stepping stone a tile's gap away,
//               a reward on top (§5.3 item 8)
//   ramps       ways up the cliffs (count): a stair of 1-block steps against a cliff's face, up to its top; ground
//               4 or more up is a wall on the map, so the top is 3D's alone
//   spawns      [[creature, weight]] (content/creatures/wildlife.js, or the parent's), picked by the zone's level
//               (a type's `levels`); bible §15.2's spawn keys
//   wildlife    how many creatures (or packs) a zone holds
//   caches      the chance of a cache on a cliff top a ramp reaches (the Rustbacks' heaps on the Steps' ledges)
//   clearings   how many discs (radius 6-8) are cleared of the zone's inner trees before they grow: in dense woods
//               the only ground the dressing finds free (gen/surface.js step 6)
//
// A biome missing here takes DEFAULT_BIOME's values, and so does every span of a world whose terrains aren't the
// real world's (content/world/terrains.js): the test world's fixture terrains share some ids ("flats") but none
// of this data, so they get the defaults (biomeFor): plain water, single cliffs, rock under the ground, a few
// rocks and props, no wildlife.
import { TERRAINS } from "./world/terrains.js";

export const DEFAULT_BIOME = {
  liquid: "water", cliffTiers: 1, sub: "ROCK",
  rocks: { block: "ROCK", count: [0, 3], tall: 0.3 },
  ponds: { count: [0, 0], radius: [2, 3] },
  props: { count: [2, 6], kinds: [["shrub", 3], ["tuft", 2]] },
  lights: { count: [0, 0], post: "STONE" },
  plateaus: 0.25, ramps: [0, 0], caches: 0, clearings: [0, 1],
  spawns: [], wildlife: [0, 0],
};

// Non-blocking sprites (zone.props: { x, y, z, kind }). glyph and color: the zone map's look (§15.7 gives webs
// `-` and nests `°`; the rest take letters no registry entry uses); art and palette: a small 3D picture, the
// creatures' format. render3d and renderMap draw them once WS3's request is in (docs/ws2.md, request 7).
export const PROPS = {
  shrub: { name: "a shrub", glyph: "'", color: [96, 150, 70], art: [" g g ", "ggGgg", " ggg ", "  b  "],
           palette: { g: [[80, 130, 60], 0], G: [[120, 170, 80], 0], b: [[90, 70, 50], 0] } },
  tuft: { name: "a tuft of grass", glyph: "`", color: [150, 176, 100], art: ["g g g", " ggg "], palette: { g: [[130, 165, 90], 0] } },
  reeds: { name: "reeds", glyph: "¦", color: [150, 160, 90], art: ["r  r ", "r rr ", "rr r ", " rrr "], palette: { r: [[140, 150, 80], 0] } },
  glimseed: { name: "glimseed reeds", glyph: "¦", color: [220, 200, 120], art: ["o  o ", "r ro ", "rr r ", " rrr "],
              palette: { r: [[140, 150, 80], 0], o: [[255, 220, 120], 1.2] } },
  bones: { name: "bones", glyph: "¬", color: [225, 215, 190], art: ["b   b", " bbb ", "b b b"], palette: { b: [[225, 215, 190], 0] } },
  saltBloom: { name: "a salt bloom", glyph: "'", color: [240, 238, 232], art: [" w ", "wWw", " w "], palette: { w: [[235, 232, 222], 0.1], W: [[255, 255, 255], 0.3] } },
  fern: { name: "a fern", glyph: "'", color: [60, 120, 70], art: ["f   f", " f f ", "ffFff", " fff "], palette: { f: [[55, 110, 60], 0], F: [[90, 150, 80], 0] } },
  mushroom: { name: "mushrooms", glyph: "•", color: [190, 120, 200], art: [" cc  ", "cCcc ", " s cc", " s s "],
              palette: { c: [[170, 110, 180], 0.4], C: [[230, 180, 240], 0.6], s: [[210, 200, 180], 0] } },
  scrap: { name: "scrap", glyph: "¤", color: [150, 100, 70], art: [" s  ", "sSs ", "ssSs"], palette: { s: [[130, 90, 65], 0], S: [[170, 130, 100], 0] } },
  glassShard: { name: "a glass shard", glyph: "◊", color: [170, 215, 225], art: [" g ", "gGg", " g "], palette: { g: [[150, 200, 210], 0.3], G: [[220, 245, 250], 0.6] } },
  crystalShard: { name: "a crystal shard", glyph: "◊", color: [196, 228, 250], art: [" c ", " C ", "cCc"], palette: { c: [[160, 200, 230], 0.5], C: [[230, 245, 255], 0.9] } },
  ashDrift: { name: "an ash drift", glyph: "`", color: [110, 104, 110], art: ["  a  ", "aaAaa"], palette: { a: [[90, 86, 92], 0], A: [[120, 116, 122], 0] } },
  inkStain: { name: "an ink stain", glyph: "`", color: [40, 40, 60], art: ["kkkk"], palette: { k: [[25, 25, 40], 0] } },
  web: { name: "a web", glyph: "-", color: [220, 220, 230], art: ["w w w", " www ", "wwWww", " www ", "w w w"], palette: { w: [[210, 210, 220], 0.1], W: [[240, 240, 250], 0.2] } },
  nest: { name: "a nest", glyph: "°", color: [210, 200, 150], art: [" ppp ", "pPpPp", " ppp "], palette: { p: [[200, 190, 140], 0], P: [[230, 220, 170], 0] } },
};

const flatsProps = [["reeds", 4], ["glimseed", 2], ["saltBloom", 2], ["bones", 1]];
const pleatProps = [["fern", 4], ["mushroom", 3], ["shrub", 2], ["web", 1]];

export const BIOMES = {
  // The real world (bible §4.4, §13.7: one dominant liquid each; §15.2's spawn keys).
  flats: {   // the Brine Flats: wet salt crust, glimseed reeds, brine pools, commons lamps
    liquid: "brine", sub: "SAND",
    rocks: { block: "SALT", count: [0, 2], tall: 0.2 },
    ponds: { count: [1, 3], radius: [2, 4] },
    props: { count: [8, 16], kinds: flatsProps },
    lights: { count: [0, 1], post: "PLANK" },
    plateaus: 0.25,
    spawns: [["saltrat", 6], ["brineGrub", 3], ["brinehog", 3], ["flatling", 1]], wildlife: [2, 4],
  },
  waste: {   // the Salt Waste: white dunes of a pressed sea, salt pans that are mosaics, Drover wells
    liquid: "brine", sub: "SALT",
    rocks: { block: "SALT", count: [1, 4], tall: 0.4 },
    ponds: { count: [0, 1], radius: [1, 2] },
    props: { count: [3, 8], kinds: [["saltBloom", 4], ["bones", 2]] },
    plateaus: 0.3,
    spawns: [["chaffDevil", 3], ["brinehog", 2], ["rustbackScav", 2]], wildlife: [1, 3],
  },
  steps: {   // the Rust Steps: mesas stacked like stairs, ledges and sheer drops; Rustback heaps on the ledges
    liquid: "water", cliffTiers: 2, sub: "CLAY",
    rocks: { block: "CLAY", count: [2, 5], tall: 0.4 },
    ponds: { count: [0, 1], radius: [2, 2] },
    props: { count: [3, 8], kinds: [["scrap", 3], ["bones", 2], ["shrub", 1]] },
    plateaus: 0.3, ramps: [2, 4], caches: 0.6,
    spawns: [["rustbackScav", 5], ["rustbackSlinger", 2], ["ledgehorn", 3], ["kite", 2], ["ledgeSpider", 2]], wildlife: [2, 4],
  },
  downs: {   // the Downs: rolling grass, barrow mounds and cairns
    liquid: "water", sub: "DIRT",
    rocks: { block: "STONE", count: [1, 3], tall: 0.5 },
    ponds: { count: [0, 2], radius: [2, 3] },
    props: { count: [8, 16], kinds: [["tuft", 5], ["shrub", 3], ["bones", 1]] },
    plateaus: 0.25,
    spawns: [["cairnHound", 3], ["barrowSkeleton", 2], ["duskBat", 2], ["brinehog", 2], ["barrowTroll", 1]], wildlife: [2, 4],
  },
  pleatwood: {   // folding trees, fungal groves, a green dimness
    liquid: "water", sub: "DIRT",
    rocks: { block: "MOSS", count: [0, 2], tall: 0.3 },
    ponds: { count: [0, 2], radius: [2, 3] },
    props: { count: [12, 20], kinds: pleatProps },
    plateaus: 0.3, clearings: [1, 2],
    spawns: [["creasebeetle", 4], ["pleatSpider", 3], ["hangvine", 2], ["sporeling", 2], ["foldmonkey", 2]], wildlife: [2, 4],
  },
  deepPleat: {   // the same forest, older and darker: paper-wasp nests
    liquid: "water", sub: "DIRT",
    rocks: { block: "MOSS", count: [0, 2], tall: 0.4 },
    ponds: { count: [0, 1], radius: [2, 3] },
    props: { count: [12, 20], kinds: [["fern", 3], ["mushroom", 4], ["nest", 1], ["web", 1]] },
    plateaus: 0.3, clearings: [1, 2],
    spawns: [["paperWasps", 3], ["mootWalker", 2], ["creasebeetle", 3], ["hangvine", 2]], wildlife: [2, 4],
  },
  tessellate: {   // a dead-flat plain paved with the mosaics of pressed towns, readable only on the map
    liquid: "ink", sub: "STONE",
    rocks: { block: "TILE", count: [0, 2], tall: 0.5 },
    ponds: { count: [0, 2], radius: [1, 2] },
    props: { count: [2, 6], kinds: [["inkStain", 3], ["bones", 1]] },
    plateaus: 0.25,
    spawns: [["tileMimic", 3], ["pressHound", 3], ["mosaicGolem", 1], ["erratum", 1], ["flatling", 2]], wildlife: [1, 3],
  },
  stacks: {   // Deepwright cities: girders, shafts and automata
    liquid: "water", sub: "STONE",
    rocks: { block: "METAL", count: [2, 5], tall: 0.6 },
    ponds: { count: [0, 1], radius: [2, 2] },
    props: { count: [4, 10], kinds: [["scrap", 4], ["bones", 1]] },
    plateaus: 0.35, ramps: [1, 2], caches: 0.4,
    spawns: [["lensSentry", 2], ["beatSpider", 3], ["girderGolem", 1], ["rustbackBrute", 3], ["rustOoze", 2],
             ["rustbackScav", 1]], wildlife: [2, 4],   // (the scavs: the Old Cuts, tier 2)
  },
  shade: {   // Noon's burnt shadow: runes on every stone, umbra pools, ghosts
    liquid: "umbra", sub: "ASH",
    rocks: { block: "STONE", count: [2, 4], tall: 0.6 },
    ponds: { count: [1, 2], radius: [2, 3] },
    props: { count: [4, 10], kinds: [["ashDrift", 4], ["bones", 2]] },
    plateaus: 0.3, ramps: [0, 1], caches: 0.3,
    spawns: [["shade", 4], ["wraith", 2], ["longshadow", 2]], wildlife: [2, 4],
  },
  lattice: {   // a crystal grid where the Pressing's creases still show
    liquid: "turnwater", sub: "CRYSTAL",
    rocks: { block: "CRYSTAL", count: [3, 6], tall: 0.7 },
    ponds: { count: [0, 1], radius: [2, 2] },
    props: { count: [3, 8], kinds: [["crystalShard", 4]] },
    plateaus: 0.35, ramps: [1, 2], caches: 0.3,
    spawns: [["askewAngle", 3], ["fold", 2], ["latticeTroll", 2], ["planarQueen", 1]], wildlife: [1, 3],
  },
  teeth: {   // a wall of tooth-shaped crags
    liquid: "water", sub: "SHALE",
    rocks: { block: "SHALE", count: [3, 6], tall: 0.7 },
    ponds: { count: [0, 0], radius: [2, 2] },
    props: { count: [2, 6], kinds: [["bones", 2], ["nest", 1]] },
    plateaus: 0.3, ramps: [1, 3], caches: 0.4,
    spawns: [["kite", 3], ["ledgehorn", 3], ["barrowTroll", 1]], wildlife: [1, 3],
  },
  sea: {   // the Glass Sea's shore: walkable crust, wrecks under the glass
    liquid: "brine", sub: "GLASS",
    rocks: { block: "GLASS", count: [1, 3], tall: 0.5 },
    ponds: { count: [1, 3], radius: [2, 3] },
    props: { count: [3, 8], kinds: [["glassShard", 4], ["bones", 1]] },
    plateaus: 0.2,
    spawns: [["glassCrab", 4], ["slagSalamander", 2], ["erratum", 1]], wildlife: [1, 3],
  },
  river: {   // the Slake and the Inkrun: fords and weirs
    liquid: "water", sub: "DIRT",
    rocks: { block: "STONE", count: [1, 3], tall: 0.3 },
    props: { count: [6, 12], kinds: [["reeds", 5], ["shrub", 2], ["tuft", 2]] },
    plateaus: 0.2,
    spawns: [["sporeling", 2], ["brineGrub", 2], ["brinehog", 1]], wildlife: [1, 2],
  },
  road: {   // the Old Rule, the Straight Cut, the Glass Causeway: milestones
    liquid: "water", sub: "DIRT",
    rocks: { block: "STONE", count: [0, 2], tall: 0.3 },
    props: { count: [3, 8], kinds: [["tuft", 4], ["shrub", 2]] },
    lights: { count: [0, 1], post: "STONE" },
    plateaus: 0.15,
    // The roads cross the land at every tier (levels 2-17): what walks them, from Rustbacks and hogs to press-hounds
    // and brutes.
    spawns: [["rustbackScav", 2], ["brinehog", 2], ["cairnHound", 1], ["kite", 1], ["pressHound", 1], ["rustbackBrute", 1]], wildlife: [0, 2],
  },
};

export const biomeOf = (id) => ({ ...DEFAULT_BIOME, ...(BIOMES[id] || {}) });
// The biome data of a world's span: its biome's when its terrain is the real world's, else the defaults.
export const biomeFor = (world, tile) => (world.terrains[tile.terrain] === TERRAINS[tile.terrain] ? biomeOf(tile.biome) : { ...DEFAULT_BIOME });
