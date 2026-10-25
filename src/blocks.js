// Block types. Index in this list = block id stored in a zone's grid (0 = air).
//
// The list is APPEND-ONLY: saved zones store block ids, so an id never changes meaning.
// tools/check-blocks.mjs compares it with tests/fixtures/block-ids.json; new blocks go at the end
// (and into that file), and the ids reserved below get their names and looks from the workstreams
// that use them (WS2 for terrain) without moving.
//
//   door/locked/gate/lever/brazier: interactive · emissive: glows on its own
//   ghost: solid, but only visible with your torch out (raycast.js skips it otherwise)
//   numeral: a rune that reads as a number (1–4), for the brazier puzzle
//   mural: a carved panel showing a lever, the Rune Lever room's record (lit: "pull this one")
//   map: { glyph, color }, optional: how a column whose `look` is this block shows on the zone map
//        (renderMap.js still uses its own glyphs until WS3 reads this; see TECH_DESIGN §6.5)
//   reserved: an id kept for later content; it has a name and colour so it draws if it turns up
export const BLOCKS = [
  { key: "AIR",      name: "air" },
  { key: "ROCK",     name: "rough rock",    color: [112, 104, 96] },
  { key: "STONE",    name: "stone wall",    color: [150, 150, 165] },
  { key: "BRICK",    name: "brick wall",    color: [175, 82, 55] },
  { key: "MOSS",     name: "mossy stone",   color: [85, 150, 90] },
  { key: "TILE",     name: "tiled floor",   color: [170, 158, 135] },
  { key: "PLANK",    name: "wooden boards", color: [140, 95, 55] },
  { key: "GRASS",    name: "grass",         color: [90, 150, 60] },
  { key: "COLUMN",   name: "marble column", color: [215, 210, 200] },
  { key: "CRATE",    name: "crate",         color: [165, 112, 60] },
  { key: "LAMP",     name: "lamp",          color: [255, 210, 130], emissive: true },
  { key: "DOOR",     name: "wooden door",   color: [150, 95, 50], door: true },
  { key: "LOCKED",   name: "locked door",   color: [120, 125, 140], door: true, locked: true },
  { key: "GATE",     name: "iron gate",     color: [95, 100, 110], gate: true },
  { key: "RUNE",     name: "carved stone",  color: [150, 150, 165] },
  { key: "LEVER",    name: "lever",         color: [150, 150, 165], lever: true },
  { key: "LEVER_ON", name: "lever",         color: [150, 150, 165], lever: true, on: true },
  { key: "STAIRS",   name: "stairs down",   color: [125, 125, 135] },
  { key: "WATER_SHALLOW", name: "shallow water", color: [80, 165, 185] },
  { key: "WATER_DEEP",    name: "deep water",    color: [35, 75, 160] },
  { key: "STAIRS_UP",     name: "stairs up",     color: [150, 165, 190] },
  { key: "GHOST",         name: "ghostly planks", color: [150, 210, 255], ghost: true },
  { key: "BRAZIER",       name: "cold brazier",  color: [85, 80, 78], brazier: true },
  { key: "BRAZIER_LIT",   name: "brazier",       color: [255, 170, 70], brazier: true, on: true, emissive: true },
  { key: "RUNE_1",        name: "carved stone",  color: [150, 150, 165], numeral: 1 },
  { key: "RUNE_2",        name: "carved stone",  color: [150, 150, 165], numeral: 2 },
  { key: "RUNE_3",        name: "carved stone",  color: [150, 150, 165], numeral: 3 },
  { key: "RUNE_4",        name: "carved stone",  color: [150, 150, 165], numeral: 4 },
  // Floor mosaics: vivid seen from above (the map), faded and hard to read at eye level.
  { key: "MOSAIC_RED",    name: "mosaic tiles",  color: [215, 65, 55], mosaic: true },
  { key: "MOSAIC_BLUE",   name: "mosaic tiles",  color: [70, 120, 235], mosaic: true },
  { key: "MOSAIC_GOLD",   name: "mosaic tiles",  color: [240, 195, 60], mosaic: true },
  { key: "MOSAIC_WHITE",  name: "mosaic tiles",  color: [230, 230, 235], mosaic: true },
  { key: "SPIKES",        name: "spike trap",    color: [125, 118, 112], spikes: true },   // traps.js
  { key: "ALTAR",         name: "altar",         color: [220, 210, 190] },
  { key: "MURAL",         name: "carved panel",  color: [150, 150, 165], mural: true },
  { key: "MURAL_LIT",     name: "carved panel",  color: [150, 150, 165], mural: true, on: true },

  // --- Reserved generic ids (0A1). Names, colours and map looks are placeholders: WS2 owns them
  // for terrain, other workstreams for the rest. Ids 36..59 never move.
  { key: "SAND",      name: "sand",        color: [214, 196, 140], reserved: true, map: { glyph: ".", color: [214, 196, 140] } },
  { key: "DIRT",      name: "dirt",        color: [120, 92, 64],   reserved: true, map: { glyph: ".", color: [140, 110, 80] } },
  { key: "ROAD",      name: "road",        color: [172, 162, 142], reserved: true, map: { glyph: "·", color: [172, 162, 142] } },
  { key: "SALT",      name: "salt crust",  color: [236, 234, 226], reserved: true, map: { glyph: ".", color: [236, 234, 226] } },
  { key: "SNOW",      name: "snow",        color: [235, 240, 248], reserved: true, map: { glyph: ".", color: [235, 240, 248] } },
  { key: "ASH",       name: "ash",         color: [96, 92, 90],    reserved: true, map: { glyph: ".", color: [110, 106, 104] } },
  { key: "CLAY",      name: "clay",        color: [168, 98, 70],   reserved: true, map: { glyph: ".", color: [168, 98, 70] } },
  { key: "SHALE",     name: "shale",       color: [90, 92, 102],   reserved: true, map: { glyph: "^", color: [120, 120, 132] } },
  { key: "TRUNK",     name: "tree trunk",  color: [96, 70, 46],    reserved: true, map: { glyph: "♣", color: [52, 110, 60] } },
  { key: "LEAVES",    name: "leaves",      color: [70, 130, 66],   reserved: true },
  { key: "REED",      name: "reeds",       color: [150, 160, 90],  reserved: true },
  { key: "MUD_BRICK", name: "mud brick",   color: [160, 120, 84],  reserved: true },
  { key: "THATCH",    name: "thatch",      color: [196, 170, 100], reserved: true },
  { key: "SCRAP",     name: "scrap metal", color: [130, 100, 80],  reserved: true },
  { key: "GLASS",     name: "glass",       color: [170, 215, 225], reserved: true },
  { key: "METAL",     name: "metal",       color: [150, 155, 165], reserved: true },
  { key: "BONE",      name: "bone",        color: [225, 215, 190], reserved: true },
  { key: "CRYSTAL",   name: "crystal",     color: [180, 220, 240], reserved: true },
  { key: "FUNGUS",    name: "fungus",      color: [170, 110, 180], reserved: true },
  { key: "STATION",   name: "cradle",      color: [140, 170, 190], reserved: true },
  { key: "STILL",     name: "still",       color: [150, 120, 80],  reserved: true },
  { key: "SIGN",      name: "signpost",    color: [150, 110, 70],  reserved: true },
  { key: "SPARE_1",   name: "stone",       color: [140, 140, 150], reserved: true },
  { key: "SPARE_2",   name: "stone",       color: [140, 140, 150], reserved: true },
];
export const B = {};
BLOCKS.forEach((b, i) => (B[b.key] = i));

// What a column looks like on the top-down map. Deliberately says nothing about height:
// ledges and crates are FLOOR. HOLE (a pit or chasm) is only drawn once you've looked into it in 3D.
export const KIND = {
  UNKNOWN: 0, FLOOR: 1, WALL: 2, DOOR: 3, LOCKED: 4, GATE: 5, LEVER: 6, STAIRS: 7,
  HOLE: 8, SHALLOW: 9, DEEP: 10, BRIDGE: 11, STAIRS_UP: 12, MOSAIC: 13, SPIKES: 14,
};
