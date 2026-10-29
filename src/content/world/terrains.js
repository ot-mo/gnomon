// The real world's terrains: WORLD_BIBLE §15.2 (binding), with §4.4 for names and feel.
//
//   TERRAINS[id] = { name, glyph, color, palette, travelHours, lostChance, tiers: [lo, hi], enter, tierMod,
//                    villages, edgeMessage, ground, relief, cliffs, trees, biome }
//
//   enter        the bible's "Enter" column: "map" (travel onto it on the world map), "walk" (only walked
//                into from a neighbouring zone: the Teeth), "drop" (moving onto it on the world map ends the
//                journey inside its zone: the Lattice), "never" (no one goes there: the sea).
//                compileWorld turns it into travel ("yes" | "no" | "road" | "drop") and edges ("open" | "solid").
//   travelHours  world hours to cross one span (null: it can't be crossed on the world map)
//   lostChance   per world-map move (0..1)
//   tierMod      +1 in the Shade, the Lattice, the Teeth and on water (the tier formula, §4.5)
//   dark         always dark, by day too (the Shade, bible §3.2): a lit torch burns glim there (torch.js)
//
//   biome        content/biomes.js's id for its dressing and wildlife (default: the terrain's id)
//
// World-function parameters (TECH_DESIGN §5.3; WS2's numbers, final in C1a):
//   ground   the block on top of the ground (a key of blocks.js B)
//   relief   0..1: how hilly (heightAt's amplitude is 3 blocks × relief)
//   cliffs   0..1: how often a cliff raises an area by 4 blocks (map walls)
//   trees    0..1: the chance that a 3×3-tile cell grows a tree
export const TERRAINS = {
  flats: {
    name: "the Brine Flats", glyph: ",", color: [214, 208, 190], palette: [[214, 208, 190], [104, 128, 84], [70, 112, 124]],
    travelHours: 6, lostChance: 0.05, tiers: [1, 2], enter: "map", tierMod: 0, villages: 1,
    ground: "SALT", relief: 0.15, cliffs: 0, trees: 0.02,
  },
  waste: {
    name: "the Salt Waste", glyph: ".", color: [236, 234, 226], palette: [[236, 234, 226], [214, 206, 190], [182, 174, 162]],
    travelHours: 14, lostChance: 0.15, tiers: [1, 3], enter: "map", tierMod: 0, villages: 1,
    ground: "SALT", relief: 0.6, cliffs: 0, trees: 0,
  },
  steps: {
    name: "the Rust Steps", glyph: "=", color: [168, 84, 52], palette: [[168, 84, 52], [204, 124, 76], [118, 60, 44]],
    travelHours: 8, lostChance: 0.08, tiers: [1, 2], enter: "map", tierMod: 0, villages: 2,
    ground: "CLAY", relief: 0.7, cliffs: 0.8, trees: 0.01,
  },
  downs: {
    name: "the Downs", glyph: ";", color: [128, 152, 88], palette: [[128, 152, 88], [162, 172, 104], [108, 118, 78]],
    travelHours: 6, lostChance: 0.04, tiers: [2, 3], enter: "map", tierMod: 0, villages: 2,
    ground: "GRASS", relief: 0.6, cliffs: 0, trees: 0.03,
  },
  pleatwood: {
    name: "the Pleatwood", glyph: "&", color: [52, 96, 64], palette: [[52, 96, 64], [86, 130, 74], [38, 58, 44]],
    travelHours: 12, lostChance: 0.12, tiers: [2, 4], enter: "map", tierMod: 0, villages: 2,
    ground: "GRASS", relief: 0.4, cliffs: 0, trees: 0.6,
  },
  deepPleat: {
    name: "the Deep Pleat", glyph: "&", color: [42, 77, 51], palette: [[42, 77, 51], [69, 104, 59], [30, 46, 35]],
    travelHours: 14, lostChance: 0.14, tiers: [4, 6], enter: "map", tierMod: 0, villages: 1,
    ground: "MOSS", relief: 0.5, cliffs: 0, trees: 0.75,
  },
  tessellate: {
    name: "the Tessellate", glyph: "+", color: [190, 172, 142],
    palette: [[190, 172, 142], [196, 64, 52], [60, 92, 172], [222, 190, 82]],
    travelHours: 4, lostChance: 0, tiers: [4, 5], enter: "map", tierMod: 0, villages: 2,
    ground: "TILE", relief: 0, cliffs: 0, trees: 0,
  },
  stacks: {
    name: "the Stacks", glyph: "#", color: [120, 120, 132], palette: [[120, 120, 132], [90, 92, 102], [152, 142, 122]],
    travelHours: 10, lostChance: 0.10, tiers: [5, 7], enter: "map", tierMod: 0, villages: 2,
    ground: "STONE", relief: 0.3, cliffs: 0.3, trees: 0,
  },
  shade: {
    name: "the Shade", glyph: "%", color: [40, 36, 56], palette: [[40, 36, 56], [24, 22, 34], [72, 62, 92]],
    travelHours: 12, lostChance: 0.20, tiers: [5, 8], enter: "map", tierMod: 1, villages: 1,
    ground: "ASH", relief: 0.4, cliffs: 0.2, trees: 0.05,
    dark: true,   // dusk even at noon (bible §4.3): a lit torch burns glim here by day too (torch.js)
  },
  lattice: {
    name: "the Lattice", glyph: "*", color: [182, 222, 232], palette: [[182, 222, 232], [122, 162, 202], [232, 242, 250]],
    travelHours: null, lostChance: null, tiers: [7, 8], enter: "drop", tierMod: 1, villages: 0,
    edgeMessage: "The crystal grid hums. The world map can't hold the Lattice: you have to walk it.",
    ground: "CRYSTAL", relief: 0.2, cliffs: 0.4, trees: 0,
  },
  teeth: {
    name: "the Teeth", glyph: "^", color: [112, 102, 98], palette: [[112, 102, 98], [142, 132, 122], [204, 204, 210]],
    travelHours: null, lostChance: null, tiers: [4, 5], enter: "walk", tierMod: 1, villages: 1,
    ground: "SHALE", relief: 1, cliffs: 1, trees: 0.02,
  },
  sea: {   // (its village is on a shore span: the region glassShore, content/world/regions.js)
    name: "the Glass Sea", glyph: "~", color: [96, 152, 160], palette: [[96, 152, 160], [152, 202, 206]],
    travelHours: null, lostChance: null, tiers: [5, 7], enter: "never", tierMod: 1, villages: 1,
    edgeMessage: "Half liquid, half glass: the sea won't bear you, and won't let you swim.",
    ground: "GLASS", relief: 0, cliffs: 0, trees: 0,
  },
  // The Hollow Mere (4..6, 18): the sea row of §15.2 gives it its own tier (2) and palette. It is `~` on the map, a
  // terrain of its own here (worldmap.js splits the glyph by x, as `&`), so it is named, coloured and refused as
  // itself, not as the Glass Sea. Its biome is the sea's (nobody goes in: no zone of it is ever made).
  mere: {
    name: "the Hollow Mere", glyph: "~", color: [70, 112, 124], palette: [[70, 112, 124]],
    travelHours: null, lostChance: null, tiers: [2, 2], enter: "never", tierMod: 1, villages: 0, biome: "sea",
    edgeMessage: "The Hollow Mere is brine to the knee and silt below that: nobody wades it twice.",
    ground: "WATER_SHALLOW", relief: 0, cliffs: 0, trees: 0,
  },
  river: {
    name: "a river", glyph: "\"", color: [82, 132, 150], palette: [[82, 132, 150], [22, 22, 32]],
    travelHours: 12, lostChance: 0.06, tiers: [2, 5], enter: "map", tierMod: 0, villages: 0,
    ground: "DIRT", relief: 0.2, cliffs: 0, trees: 0.05,
  },
  road: {
    name: "a road", glyph: ":", color: [172, 162, 142], palette: [[172, 162, 142]],
    travelHours: 3, lostChance: 0, tiers: [1, 6], enter: "map", tierMod: 0, villages: 0,
    ground: "GRASS", relief: 0.3, cliffs: 0, trees: 0.02,
  },
};
