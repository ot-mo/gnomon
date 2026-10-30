// The real world's regions (TECH_DESIGN §2.18; C1a): every span of the map is in one of these 20 (worldmap.js
// REGION_ROWS and regionKey place them; docs/c1.md "Region ids" has the rules and the bible's sources). A region
// keeps its terrain's id where the two coincide.
//
//   REGIONS[id] = { name, tier, music, sky, fog, liquid, encounterRate, villages, creatures, factions, sites, line }
//
//   tier           the lowest tier of its spans (each span's own tier is worldmap.js TIER_ROWS, bible §4.5)
//   music          a mood of music.js (content/moods.js: a landmark's own mood comes first, the terrain's after)
//   sky            what the sky does over it: "clear", "haze", "glare" (the noon glare of bible §4.9: the Salt
//                  Waste and the Glass shore, with the sea and the causeway over it), "canopy" (the Pleat's green dimness), "ashen" (the Shade), "crystal"
//                  (the Lattice). Read by nothing yet (docs/c1.md, integration requests); the Shade's dusk is its
//                  terrain's `dark`
//   fog            haze density added to the sky's (clock.js fogFor: HAZE 0.022, and 0.02 more on a dark terrain)
//   liquid         the region's water (content/liquids.js), one per span (DECISIONS: no mixing): its biome's, or
//                  its river's on the Slake and the Inkrun (worldmap.js RIVERS carries the Inkrun's ink)
//   encounterRate  the chance per world-map move of an encounter (overworld/encounters.js; × 1.5 at night)
//   villages       the bible's village quota (§4.10: 16 in all): world/sites.js placeSites puts exactly this many
//                  first, on the region's own spans (its walk-in ones when nothing else is free), so `sites.village`
//                  is 0 everywhere (integrator, C1a #1 and #2)
//   creatures      [type, weight, minLevel, maxLevel] by the bible's ids (§12, §15.2's spawn keys): the dungeons
//                  under its sites draw from them (world/sites.js dungeonParams, gen/dungeon.js pickFrom; a type not
//                  registered yet is skipped, C3 adds the species). Levels are the bible's tiers ±2 (tier t is
//                  level 3t − 1), widened to the region's deepest floor where its own creatures are the ones there
//                  (bible §12: deeper floors raise them), so every level the region makes has three kinds or more;
//                  lowered only where its lowest spans would have fewer than three (the Pleatwood's tier-2 rim: the
//                  sporeling and the foldmonkey from 5; the Glass Sea's and the Causeway's tier-5 spans: the glass crab
//                  and the salamander from 12). §15.2's spawn keys win over §12's tiers: the glowfin is in the Inkrun.
//                  A registered kind's factions are among the region's (check-world)
//   factions       who lives or holds sway there (bible §15.4's Home column, §9.3's founding peoples)
//   sites          the chance per eligible span of each per-run kind (world/sites.js placeSites): village, ruin,
//                  lair, station (a Truing Cradle); historic is 0 everywhere, as Hour sites go by tier (§8.7)
//   line           its world-map line (bible §2.1 rule 8: one sentence)
const row = (type, weight, lo, hi) => [type, weight, lo, hi];

export const REGIONS = {
  flats: {
    name: "the Brine Flats", tier: 1, music: "shore", sky: "haze", fog: 0.006, liquid: "brine", encounterRate: 0.05,
    villages: 1,
    creatures: [row("saltrat", 6, 1, 8), row("brineGrub", 3, 1, 8), row("brinehog", 3, 1, 8), row("glowfin", 2, 1, 10),
                row("clatterer", 2, 1, 8), row("flatling", 1, 1, 10), row("drownedKeeper", 1, 1, 8)],
    factions: ["hollowmere", "noonVigil", "clatter", "moths", "saltbeasts", "unlit", "flatfolk"],
    sites: { village: 0, ruin: 0, lair: 0.053, station: 0, historic: 0 },
    line: "The glimseed leans towards the Gnomon here, the way everything does eventually.",
  },
  hollowMere: {
    name: "the Hollow Mere", tier: 2, music: "shore", sky: "haze", fog: 0.01, liquid: "brine", encounterRate: 0,
    villages: 0,
    creatures: [row("glowfin", 3, 1, 10), row("brineGrub", 2, 1, 7), row("saltrat", 2, 1, 7), row("brinehog", 1, 1, 7),
                row("clatterer", 1, 1, 7)],
    factions: ["hollowmere", "clatter", "saltbeasts"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "A shallow lagoon of brine south of Hollowmere; the eels in it think it is the whole world.",
  },
  waste: {
    name: "the Salt Waste", tier: 1, music: "waste", sky: "glare", fog: 0, liquid: "brine", encounterRate: 0.08,
    villages: 1,
    creatures: [row("brinehog", 3, 1, 11), row("rustbackScav", 2, 1, 11), row("chaffDevil", 3, 3, 11), row("saltrat", 1, 1, 7),
                row("saltMirage", 2, 3, 11)],
    factions: ["drovers", "pressed", "saltbeasts", "rustbacks"],
    sites: { village: 0, ruin: 0.021, lair: 0.023, station: 0, historic: 0 },
    line: "A sea that was pressed and left to dry; the Drovers count its dunes and get a different number every time.",
  },
  steps: {
    name: "the Rust Steps", tier: 1, music: "open", sky: "clear", fog: 0, liquid: "water", encounterRate: 0.08,
    villages: 2,
    creatures: [row("rustbackScav", 5, 1, 10), row("brineGrub", 2, 1, 7), row("saltrat", 1, 1, 7), row("rustbackSlinger", 2, 3, 10),
                row("ledgehorn", 3, 3, 10), row("kite", 2, 3, 13), row("ledgeSpider", 2, 3, 10), row("chaffDevil", 1, 3, 8)],
    factions: ["rustbacks", "drovers", "kites", "saltbeasts"],
    sites: { village: 0, ruin: 0.096, lair: 0.08, station: 0, historic: 0 },
    line: "Red mesas stacked like a stair nobody finished; up here height is the only rank there is.",
  },
  downs: {
    name: "the Downs", tier: 2, music: "open", sky: "clear", fog: 0.003, liquid: "water", encounterRate: 0.06,
    villages: 2,
    creatures: [row("cairnHound", 3, 3, 11), row("barrowSkeleton", 2, 3, 13), row("duskBat", 2, 3, 13), row("brinehog", 2, 1, 8),
                row("barrowTroll", 1, 9, 16), row("assizeOutrider", 1, 6, 13)],
    factions: ["survey", "rustbacks", "unlit", "assize", "saltbeasts"],
    sites: { village: 0, ruin: 0.051, lair: 0.031, station: 0, historic: 0 },
    line: "Grass over barrows, and the Survey's towers on every rise, measuring the grass.",
  },
  pleatwood: {
    name: "the Pleatwood", tier: 2, music: "wood", sky: "canopy", fog: 0.012, liquid: "water", encounterRate: 0.1,
    villages: 2,
    creatures: [row("creasebeetle", 4, 3, 15), row("pleatSpider", 3, 3, 15), row("hangvine", 2, 6, 16), row("sporeling", 2, 5, 16),
                row("foldmonkey", 2, 5, 13)],
    factions: ["pleatwood", "sporeMoot", "saltbeasts"],
    sites: { village: 0, ruin: 0.017, lair: 0.022, station: 0, historic: 0 },
    line: "The trees fold their branches away at dusk, which the Pleatwood says is manners and the Survey says is weather.",
  },
  deepPleat: {
    name: "the Deep Pleat", tier: 4, music: "wood", sky: "canopy", fog: 0.018, liquid: "water", encounterRate: 0.12,
    villages: 1,
    creatures: [row("paperWasps", 3, 9, 23), row("mootWalker", 2, 12, 23), row("hangvine", 2, 9, 23), row("creasebeetle", 3, 9, 16),
                row("plumbknight", 1, 12, 23), row("assizer", 1, 12, 23)],
    factions: ["pleatwood", "sporeMoot", "assize", "saltbeasts", "errata"],
    sites: { village: 0, ruin: 0.012, lair: 0.024, station: 0, historic: 0 },
    line: "The same forest, folded more times than anyone has counted; the Assize cut one straight line through it and called it a road.",
  },
  tessellate: {
    name: "the Tessellate", tier: 4, music: "open", sky: "clear", fog: 0, liquid: "ink", encounterRate: 0.08,
    villages: 2,
    creatures: [row("tileMimic", 3, 9, 18), row("pressHound", 3, 9, 18), row("mosaicGolem", 1, 12, 18), row("erratum", 1, 9, 18), row("chimePriest", 1, 9, 16), row("lampHound", 1, 6, 16)],
    factions: ["flatfolk", "pressed", "errata", "horary", "chandlers", "plan", "lampless", "noonVigil", "assize"],
    sites: { village: 0, ruin: 0, lair: 0.031, station: 0, historic: 0 },
    line: "A plain paved with pressed towns; from above you can read their names, and the Flatfolk would rather you didn't stand on them.",
  },
  shade: {
    name: "the Shade", tier: 5, music: "shade", sky: "ashen", fog: 0.01, liquid: "umbra", encounterRate: 0.14,
    villages: 1,
    creatures: [row("shade", 4, 12, 28), row("wraith", 2, 12, 28), row("longshadow", 2, 12, 28), row("lamplessChanter", 1, 12, 16),
                row("umbralEel", 2, 12, 19)],
    factions: ["unlit", "lampless"],
    sites: { village: 0, ruin: 0.17, lair: 0.094, station: 0, historic: 0 },
    line: "The Horary calls it Noon's shadow, burnt in and never lifted; the Lampless call it the only honest light.",
  },
  stacks: {
    name: "the Stacks", tier: 5, music: "waste", sky: "haze", fog: 0.008, liquid: "water", encounterRate: 0.1,
    villages: 2,
    creatures: [row("beatSpider", 3, 12, 25), row("rustbackBrute", 3, 12, 25), row("lensSentry", 2, 12, 25), row("rustOoze", 2, 12, 25),
                row("girderGolem", 1, 15, 25), row("draughtsman", 2, 9, 19)],
    factions: ["plan", "rustbacks"],
    sites: { village: 0, ruin: 0.056, lair: 0.026, station: 0.037, historic: 0 },
    line: "Deepwright towers twenty storeys deep, still being kept by automata who were never told to stop.",
  },
  oldCuts: {
    name: "the Old Cuts", tier: 2, music: "waste", sky: "haze", fog: 0.008, liquid: "water", encounterRate: 0.08,
    villages: 0,
    creatures: [row("rustbackScav", 5, 1, 10), row("rustbackSlinger", 2, 3, 10), row("ledgeSpider", 2, 3, 10), row("duskBat", 2, 3, 10),
                row("brinehog", 1, 1, 8)],
    factions: ["rustbacks", "plan", "saltbeasts"],
    sites: { village: 0, ruin: 0.4, lair: 0, station: 0, historic: 0 },
    line: "Two Deepwright cuts that the Rustbacks reached first, and have been taking apart ever since.",
  },
  lattice: {
    name: "the Lattice", tier: 7, music: "lattice", sky: "crystal", fog: 0.004, liquid: "turnwater", encounterRate: 0.12,
    villages: 0,
    creatures: [row("askewAngle", 3, 18, 30), row("fold", 2, 18, 30), row("latticeTroll", 2, 18, 30), row("planarQueen", 1, 18, 30)],
    factions: ["askew", "flatfolk"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "A grid of crystal where the corners are right angles and you are not.",
  },
  teeth: {
    name: "the Teeth", tier: 3, music: "waste", sky: "clear", fog: 0.004, liquid: "water", encounterRate: 0.1,
    villages: 1,
    creatures: [row("kite", 3, 3, 14), row("ledgehorn", 3, 3, 14), row("barrowTroll", 1, 9, 16), row("duskBat", 2, 3, 14),
                row("lampHound", 1, 6, 16), row("chandlerGuard", 1, 9, 16)],
    factions: ["kites", "drovers", "chandlers", "saltbeasts", "assize"],
    // (its crag village waits for sites on walk-in spans: docs/c1.md, integration requests)
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "A wall of crags that no road crosses but the Molar pass; the Kites cross it every morning to show that they can.",
  },
  glassSea: {
    name: "the Glass Sea", tier: 5, music: "shore", sky: "glare", fog: 0.008, liquid: "brine", encounterRate: 0,
    villages: 0,
    creatures: [row("glassCrab", 3, 12, 24), row("slagSalamander", 2, 12, 24), row("erratum", 1, 9, 24), row("mirrorEel", 2, 12, 24)],
    factions: ["clatter", "errata", "unlit"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "Half liquid and half glass; there are wrecks under it, and they can see you too.",
  },
  glassShore: {
    name: "the Glass Shore", tier: 4, music: "shore", sky: "glare", fog: 0.006, liquid: "brine", encounterRate: 0.1,
    biome: "sea",   // (its spans dress as the sea's shore, whatever their terrain: worldmodel.js compileWorld; integrator, C1a #3)
    villages: 1,
    // (its land is the Tessellate's or the Stacks': their kinds hold its tier-4 and tier-5 spans, the sea's the rest)
    creatures: [row("glassCrab", 3, 15, 21), row("slagSalamander", 2, 15, 21), row("mirrorEel", 2, 15, 21), row("erratum", 2, 9, 21),
                row("tileMimic", 2, 9, 16), row("pressHound", 1, 9, 16)],
    factions: ["clatter", "errata", "assize"],
    sites: { village: 0, ruin: 0.021, lair: 0.04, station: 0.027, historic: 0 },
    line: "Where the sea gives up being liquid; the Clatter build their huts of its glass and can see who is coming.",
  },
  oldRule: {
    name: "the Old Rule", tier: 1, music: "open", sky: "clear", fog: 0, liquid: "water", encounterRate: 0.04,
    villages: 0,
    creatures: [row("rustbackScav", 3, 1, 10), row("brinehog", 2, 1, 8), row("saltrat", 1, 1, 7), row("cairnHound", 1, 3, 11),
                row("kite", 1, 3, 14), row("assizeOutrider", 2, 6, 17), row("pressHound", 1, 9, 17), row("rustbackBrute", 1, 12, 17),
                row("lensSentry", 1, 13, 17)],
    factions: ["assize", "drovers", "survey", "rustbacks", "saltbeasts", "kites", "plan", "pressed"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "The Deepwright road, laid true to the width of a hair; the milestones still count down to something.",
  },
  straightCut: {
    name: "the Straight Cut", tier: 5, music: "open", sky: "clear", fog: 0, liquid: "water", encounterRate: 0.06,
    villages: 0,
    creatures: [row("assizeOutrider", 3, 6, 17), row("plumbknight", 1, 12, 19), row("assizer", 1, 12, 19), row("pressHound", 2, 9, 17),
                row("paperWasps", 1, 9, 17), row("longshadow", 1, 12, 17)],
    factions: ["assize", "saltbeasts", "unlit"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "The Assize's road from the Square, which goes round nothing on principle.",
  },
  glassCauseway: {
    name: "the Glass Causeway", tier: 5, music: "shore", sky: "glare", fog: 0.006, liquid: "water", encounterRate: 0.08,
    villages: 0,
    creatures: [row("glassCrab", 3, 12, 22), row("erratum", 2, 9, 22), row("slagSalamander", 1, 12, 22)],
    factions: ["clatter", "errata"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "A road laid over the glass to the Drowned Lantern; the sea on either side keeps its own counsel.",
  },
  slake: {
    name: "the Slake", tier: 2, music: "shore", sky: "clear", fog: 0.008, liquid: "water", encounterRate: 0.06,
    villages: 0,
    creatures: [row("glowfin", 3, 1, 11), row("sporeling", 2, 5, 16), row("brineGrub", 2, 1, 11), row("brinehog", 1, 1, 11)],
    factions: ["saltbeasts", "sporeMoot"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "The grey-green river out from under the Teeth; it tastes of stone and runs south as if late for something.",
  },
  inkrun: {
    name: "the Inkrun", tier: 5, music: "shade", sky: "clear", fog: 0.012, liquid: "ink", encounterRate: 0.08,
    villages: 0,
    creatures: [row("umbralEel", 3, 12, 19), row("glowfin", 1, 9, 16), row("sporeling", 2, 9, 16), row("longshadow", 1, 12, 17),
                row("pressHound", 1, 9, 16)],
    factions: ["unlit", "flatfolk", "sporeMoot", "assize"],
    sites: { village: 0, ruin: 0, lair: 0, station: 0, historic: 0 },
    line: "Ink wells up black out of the Shade and runs to the sea; whoever wades it comes out written on.",
  },
};
