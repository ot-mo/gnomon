// Wildlife (TECH_DESIGN §2.18 content/creatures/*.js; WS2, then C3): the surface's creatures, bible §12 by region,
// spawned by the biome builders from content/biomes.js `spawns` (bible §15.2's spawn keys). gen/biomes/index.js
// registers the table with creatures.js registerCreatures.
//
// The parent's creature shape (content/creatures/legacy.js says what each trait does), with two differences:
//   levels   [lo, hi]: the surface zone levels it turns up at (bible §12's tiers: level 3 × tier − 1). Never
//            `depths`: a type with depths joins every dungeon's default pool (creatures.js pickCreatureType), and
//            the legacy stack's levels must stay as they are (golden).
//   group    [lo, hi]: how many come together (cairn hounds hunt in packs of 3 to 5)
//   factions bible §12's faction column, as factions.js reads it (a stub until WS6a: every monster is hostile)
// Glyphs follow bible §15.7 (one letter per family, members told apart by colour; check-creatures). The "existing"
// creatures of §12 are the parent's species re-skinned: their pictures, a colour of their own. What makes each
// one special (a burrower's tunnel, a ledgehorn's 2-block climb, a mirage seen only in 3D) is C3's; the
// traits here are the ones the engine already has (hover, erratic, venom, regen, splits, ranged, flat, ghostly,
// darkSight, brittle, resist, weak, burns, drain, armour).
//
// The people and machines of the spawn keys (Assize outriders, Lampless chanters, pressed pilgrims, Flatfolk
// wanderers, draughtsmen, clatterers, the drowned keeper) are talkers or need their systems: C3 and WS7. The
// water's creatures (glowfin, umbral eel, mirror eel) wait for swimmers in the AI. The longback is a Drover beast,
// lantern moths a harmless swarm: neither is a foe, and every monster here is one until the factions say otherwise.
import { LEGACY_MONSTERS } from "./legacy.js";

const L = LEGACY_MONSTERS;
// A picture of the parent's, its palette's colours swapped: { letter: [rgb, glow] }.
const reskin = (type, palette) => ({ frames: L[type].frames, palette: { ...L[type].palette, ...palette } });

// New pictures, one per family (two frames: standing / mid-step; space = see-through).
const ART = {
  grub: [
    ["    sssss   ", "  sSssSsss  ", " ssssssssssE", "ssssssssssss"],
    ["   sssss    ", " ssSssSsss  ", "sssssssssssE", " sssssssssss"],
  ],
  pig: [
    ["  t     tt  ", " bbbbbbbbbt ", "bbbbbbbbbbEn", "bbbbbbbbbbbb", " bbbbbbbbbb ", "  f f  f f  "],
    ["  t     tt  ", " bbbbbbbbbt ", "bbbbbbbbbbEn", "bbbbbbbbbbbb", " bbbbbbbbbb ", " f  f  f  f "],
  ],
  whirl: [
    ["  dddddd  ", " dDdddDdd ", "  dddddd  ", "   dDdd   ", "  dddd    ", "   dd     ", "    d     "],
    [" dddddd   ", "ddDdddDdd ", "  dddddd  ", "    dddD  ", "    dddd  ", "     dd   ", "    d     "],
  ],
  goat: [
    ["h        h ", " h      hh ", "  bbbbbbbE ", " bbbbbbbbbm", "bbbbbbbbbb ", "b bbbbbbb  ", "  f f f f  ", "  f f f f  "],
    ["h        h ", " h      hh ", "  bbbbbbbE ", " bbbbbbbbbm", "bbbbbbbbbb ", "b bbbbbbb  ", " f  f  f f ", " f  f  f f "],
  ],
  bird: [
    ["ww       ww", " www b www ", "   wbEbw   ", "    bbbk   ", "    t t    "],
    ["           ", "    bbb    ", " wwwbEbwww ", "ww  bbbk ww", "    t t    "],
  ],
  hound: [
    ["e         ", "hhh       ", "hEhhhhhhh ", " hhhhhhhh ", " hhhhhhh t", " f f  f f "],
    ["e         ", "hhh       ", "hEhhhhhhh ", " hhhhhhhh ", " hhhhhhh t", "f  f f  f "],
  ],
  beetle: [
    ["   aa aa   ", "  cccccccE ", " cCcccccccc", " cccccCcccc", "  l l l l  "],
    ["   aa aa   ", "  cccccccE ", " cCcccccccc", " cccccCcccc", " l l   l l "],
  ],
  vine: [
    ["  vv  ", " vvv  ", "  vv  ", " vvv  ", "  vvv ", "  vEv ", " vvvv ", "v v  v"],
    ["  vv  ", "  vvv ", "  vv  ", "  vvv ", " vvv  ", " vEv  ", " vvvv ", " v v v"],
  ],
  monkey: [
    [" mmmm   ", "mEmmEm  ", " mfffm  ", "  mmm  t", " mmmmm t", "m mmm mt", "  m m tt"],
    [" mmmm   ", "mEmmEm  ", " mfffm  ", "  mmm  t", " mmmmm t", "m mmm m ", " m   mtt"],
  ],
  wasps: [
    ["  y   y   ", " yby     y", "      yby ", " y        ", "yby   y   ", "     yby  "],
    ["   y    y ", "  yby  yby", "y         ", "yby    y  ", "      yby ", "  y       "],
  ],
  walker: [
    [" ccccc ", "cCcCccc", " sssss ", "  sEs  ", " bbbbb ", "b bbb b", "  bbb  ", "  b b  ", " bb bb "],
    [" ccccc ", "ccCccCc", " sssss ", "  sEs  ", " bbbbb ", "b bbb b", "  bbb  ", " b   b ", "bb   bb"],
  ],
  erratum: [
    ["  xXx  ", " XxXxX ", "xXEXExX", " XxXxX ", "  xXx  ", " x   x "],
    ["  XxX  ", " xXxXx ", "XxEXExX", " xXxXx ", "  XxX  ", "x     x"],
  ],
  automaton: [
    ["   LLL   ", "  LEEEL  ", "   LLL   ", "  mmmmm  ", " mmMmMmm ", " m mmm m ", "   m m   ", "  mm mm  "],
    ["   LLL   ", "  LEEEL  ", "   LLL   ", "  mmmmm  ", " mmMmMmm ", " m mmm m ", "  m   m  ", " mm   mm "],
  ],
  angle: [
    ["a      ", " a     ", "  aE   ", "   aaa ", "    a a", "   a  a", "  a   a"],
    ["      a", "     a ", "   Ea  ", " aaa   ", "a a    ", "a  a   ", "a   a  "],
  ],
  crab: [
    ["C        C", "CC      CC", " C cccc C ", "  cEccEc  ", " cccccccc ", "  l l l l "],
    ["C        C", "CC      CC", " C cccc C ", "  cEccEc  ", " cccccccc ", " l l  l l "],
  ],
};

export const WILDLIFE = {
  // --- Brine Flats (§12.1) ---------------------------------------------------------------------------
  saltrat: {
    name: "saltrat", glyph: "r", color: [226, 214, 190], xp: 2, levels: [1, 6], weight: 6, group: [1, 3], factions: ["saltbeasts"],
    hp: 4, speed: 3.6, damage: [1, 2], cooldown: 0.8, reach: 1.15, sight: 9, w: 0.75, h: 0.4,
    ...reskin("rat", { b: [[205, 195, 175], 0], f: [[150, 140, 120], 0] }),
  },
  brineGrub: {
    name: "brine-grub", glyph: "w", color: [196, 170, 140], xp: 3, levels: [1, 6], weight: 3, group: [1, 2], factions: ["saltbeasts"],
    hp: 9, speed: 1.4, damage: [1, 3], cooldown: 1.2, reach: 1.15, sight: 7, w: 0.8, h: 0.35,
    frames: ART.grub, palette: { s: [[190, 165, 135], 0.1], S: [[230, 215, 190], 0.2], E: [[60, 40, 30], 0] },
  },
  brinehog: {
    name: "brinehog", glyph: "p", color: [176, 128, 112], xp: 5, levels: [1, 9], weight: 4, group: [1, 2], factions: ["saltbeasts"],
    hp: 12, speed: 2.9, damage: [2, 4], cooldown: 1.2, reach: 1.25, sight: 9, w: 1.0, h: 0.75,
    frames: ART.pig, palette: { b: [[160, 115, 100], 0], t: [[235, 225, 205], 0], E: [[30, 20, 20], 0], n: [[210, 150, 140], 0], f: [[90, 65, 55], 0] },
  },
  // --- The Rust Steps (§12.2), the Teeth -----------------------------------------------------------------
  rustbackScav: {
    name: "Rustback scav", glyph: "g", color: [176, 110, 70], xp: 5, levels: [1, 9], weight: 5, group: [1, 3], factions: ["rustbacks"],
    hp: 9, speed: 2.6, damage: [2, 4], cooldown: 1.1, reach: 1.2, sight: 11, w: 0.85, h: 1.2,
    ...reskin("goblin", { g: [[150, 96, 64], 0], c: [[110, 70, 50], 0], w: [[160, 120, 90], 0] }),
  },
  rustbackSlinger: {
    name: "Rustback slinger", glyph: "g", color: [230, 140, 60], xp: 8, levels: [4, 9], weight: 2.5, factions: ["rustbacks"],
    hp: 8, speed: 2.4, damage: [1, 3], cooldown: 1.2, reach: 1.2, sight: 13, w: 0.85, h: 1.2,
    ranged: { range: 10, hold: 7, damage: [3, 5], cooldown: 2.0, speed: 16, gravity: 12, kind: "arrow" },
    ...reskin("archer", { g: [[170, 100, 60], 0], h: [[120, 70, 40], 0] }),
  },
  ledgehorn: {
    name: "ledgehorn", glyph: "q", color: [196, 150, 110], xp: 6, levels: [4, 15], weight: 3, group: [1, 3], factions: ["saltbeasts"],
    hp: 14, speed: 2.8, damage: [2, 5], cooldown: 1.3, reach: 1.3, sight: 10, w: 0.9, h: 1.0,
    frames: ART.goat, palette: { b: [[185, 140, 100], 0], h: [[230, 220, 200], 0], E: [[30, 20, 10], 0], m: [[150, 110, 80], 0], f: [[90, 70, 50], 0] },
  },
  kite: {
    name: "kite", glyph: "v", color: [210, 180, 90], xp: 7, levels: [4, 15], weight: 2, factions: ["kites"],
    hp: 9, speed: 4.2, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 14, w: 0.9, h: 0.5, hover: 1.4, erratic: 0.15,
    frames: ART.bird, palette: { w: [[170, 130, 70], 0], b: [[200, 170, 100], 0], E: [[255, 200, 60], 1.0], k: [[230, 200, 80], 0], t: [[120, 100, 60], 0] },
  },
  ledgeSpider: {
    name: "ledge spider", glyph: "x", color: [190, 110, 80], xp: 6, levels: [4, 9], weight: 3, group: [1, 2], factions: ["saltbeasts"],
    hp: 7, speed: 3.0, damage: [2, 3], cooldown: 1.0, reach: 1.2, sight: 9, w: 1.0, h: 0.55, venom: 2,
    ...reskin("spider", { b: [[150, 90, 70], 0], l: [[170, 105, 80], 0], E: [[255, 150, 60], 1.3] }),
  },
  // --- The Salt Waste (§12.3) -------------------------------------------------------------------------
  chaffDevil: {
    name: "chaff devil", glyph: "Y", color: [222, 214, 196], xp: 5, levels: [3, 9], weight: 2, factions: [],
    hp: 8, speed: 3.4, damage: [1, 3], cooldown: 1.0, reach: 1.3, sight: 10, w: 0.9, h: 1.4, erratic: 0.4,
    frames: ART.whirl, palette: { d: [[215, 205, 185], 0.2], D: [[245, 240, 230], 0.4] },
  },
  // --- The Downs (§12.4) ------------------------------------------------------------------------------
  cairnHound: {
    name: "cairn hound", glyph: "d", color: [150, 140, 120], xp: 5, levels: [4, 9], weight: 4, group: [3, 5], factions: ["saltbeasts"],
    hp: 9, speed: 3.3, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.9, h: 0.75, weak: ["fire"],
    frames: ART.hound, palette: { h: [[135, 125, 105], 0], e: [[110, 100, 85], 0], E: [[255, 210, 90], 1.1], t: [[120, 110, 95], 0], f: [[80, 72, 60], 0] },
  },
  barrowSkeleton: {
    name: "barrow skeleton", glyph: "s", color: [200, 205, 180], xp: 9, levels: [4, 12], weight: 2, undead: true, factions: ["unlit"],
    hp: 16, speed: 1.7, damage: [3, 6], cooldown: 1.5, reach: 1.3, sight: 12, w: 0.8, h: 1.6, brittle: true,
    ...reskin("skeleton", { w: [[200, 205, 180], 0], E: [[150, 230, 140], 1.2] }),
  },
  duskBat: {
    name: "dusk bat", glyph: "b", color: [150, 110, 170], xp: 3, levels: [4, 12], weight: 3, group: [1, 3], factions: ["saltbeasts"],
    hp: 3, speed: 4.4, damage: [1, 3], cooldown: 0.7, reach: 1.15, sight: 10, w: 0.8, h: 0.42, hover: 0.95, erratic: 0.35,
    ...reskin("bat", { w: [[115, 85, 135], 0], b: [[140, 105, 150], 0] }),
  },
  barrowTroll: {
    name: "barrow-troll", glyph: "T", color: [140, 150, 120], xp: 24, levels: [10, 15], weight: 1, factions: [],
    hp: 40, speed: 2.0, damage: [6, 11], cooldown: 1.7, reach: 1.6, sight: 11, w: 1.3, h: 2.1, regen: 1, weak: ["fire"], resist: ["frost"],
    ...reskin("troll", { t: [[130, 140, 112], 0] }),
  },
  // --- The Pleatwood and the Deep Pleat (§12.5) ---------------------------------------------------------
  creasebeetle: {
    name: "creasebeetle", glyph: "B", color: [96, 150, 110], xp: 6, levels: [4, 18], weight: 4, group: [1, 2], factions: ["pleatwood"],
    hp: 11, speed: 2.2, damage: [2, 4], cooldown: 1.2, reach: 1.2, sight: 8, w: 0.9, h: 0.5, armour: 1,
    frames: ART.beetle, palette: { c: [[70, 120, 85], 0.1], C: [[150, 210, 160], 0.3], a: [[50, 70, 55], 0], E: [[220, 255, 140], 1.0], l: [[40, 55, 45], 0] },
  },
  pleatSpider: {
    name: "pleat spider", glyph: "x", color: [110, 200, 90], xp: 6, levels: [4, 12], weight: 3, factions: ["saltbeasts"],
    hp: 7, speed: 3.0, damage: [2, 3], cooldown: 1.0, reach: 1.2, sight: 9, w: 1.0, h: 0.55, venom: 3,
    ...reskin("spider", { b: [[70, 120, 60], 0], l: [[90, 140, 75], 0], E: [[200, 255, 80], 1.3] }),
  },
  hangvine: {
    name: "hangvine", glyph: "n", color: [90, 160, 70], xp: 7, levels: [7, 15], weight: 2, factions: ["pleatwood"],
    hp: 14, speed: 1.0, damage: [3, 5], cooldown: 1.4, reach: 1.5, sight: 6, w: 0.6, h: 1.6, hover: 1.2, weak: ["fire"],
    frames: ART.vine, palette: { v: [[70, 130, 60], 0], E: [[230, 90, 60], 1.0] },
  },
  sporeling: {
    name: "sporeling", glyph: "j", color: [190, 130, 200], xp: 7, levels: [7, 15], weight: 2.5, factions: ["sporeMoot"],
    hp: 16, speed: 1.3, damage: [2, 5], cooldown: 1.3, reach: 1.2, sight: 8, w: 1.0, h: 0.8, splits: "slimelet", resist: ["shock"],
    ...reskin("slime", { s: [[170, 110, 185], 0.25], S: [[230, 190, 240], 0.5] }),
  },
  foldmonkey: {
    name: "foldmonkey", glyph: "y", color: [170, 130, 80], xp: 8, levels: [7, 12], weight: 2, group: [1, 3], factions: ["pleatwood"],
    hp: 10, speed: 3.6, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.7, h: 0.9, erratic: 0.2,
    ranged: { range: 8, hold: 5, damage: [2, 4], cooldown: 2.4, speed: 12, gravity: 14, kind: "arrow" },
    frames: ART.monkey, palette: { m: [[150, 110, 70], 0], f: [[220, 190, 150], 0], E: [[40, 30, 20], 0], t: [[130, 95, 60], 0] },
  },
  paperWasps: {
    name: "paper wasps", glyph: "P", color: [230, 220, 160], xp: 9, levels: [10, 18], weight: 3, factions: ["saltbeasts"],
    hp: 10, speed: 4.0, damage: [2, 5], cooldown: 0.8, reach: 1.2, sight: 10, w: 0.9, h: 0.8, hover: 0.8, erratic: 0.5, venom: 2, weak: ["fire"],
    frames: ART.wasps, palette: { y: [[220, 205, 140], 0.2], b: [[40, 35, 30], 0] },
  },
  mootWalker: {
    name: "moot-walker", glyph: "F", color: [170, 110, 150], xp: 14, levels: [13, 18], weight: 2, factions: ["sporeMoot"],
    hp: 24, speed: 1.6, damage: [4, 8], cooldown: 1.5, reach: 1.4, sight: 10, w: 0.9, h: 1.7, undead: true, weak: ["fire"],
    frames: ART.walker, palette: { c: [[175, 110, 160], 0.3], C: [[230, 170, 220], 0.6], s: [[150, 140, 120], 0], E: [[255, 240, 120], 1.2], b: [[95, 80, 70], 0] },
  },
  // --- The Tessellate (§12.6) --------------------------------------------------------------------------
  tileMimic: {
    name: "tile mimic", glyph: "t", color: [200, 80, 64], xp: 10, levels: [10, 15], weight: 3, flat: true, factions: [],
    hp: 12, speed: 2.6, damage: [3, 5], cooldown: 1.1, reach: 1.2, sight: 9, w: 0.9, h: 0.1,
    frames: [["tttttt", "tTTTTt"], ["tttttt", "tTttTt"]],   // (flat: never drawn in 3D, only its shadow)
    palette: { t: [[170, 60, 50], 0], T: [[222, 190, 82], 0.2] },
  },
  pressHound: {
    name: "press-hound", glyph: "d", color: [140, 150, 170], xp: 10, levels: [10, 15], weight: 3, group: [2, 3], factions: ["assize"],
    hp: 14, speed: 3.2, damage: [3, 5], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.9, h: 0.75, armour: 1,
    frames: ART.hound, palette: { h: [[120, 128, 145], 0], e: [[95, 100, 115], 0], E: [[200, 220, 255], 1.1], t: [[110, 115, 130], 0], f: [[70, 72, 82], 0] },
  },
  mosaicGolem: {
    name: "mosaic golem", glyph: "G", color: [196, 120, 80], xp: 20, levels: [13, 15], weight: 1, factions: ["plan"],
    hp: 34, speed: 1.4, damage: [6, 10], cooldown: 1.9, reach: 1.5, sight: 10, w: 1.2, h: 2.2, armour: 2, brittle: true, weak: ["shock"],
    ...reskin("golem", { s: [[60, 92, 172], 0], S: [[196, 64, 52], 0], E: [[222, 190, 82], 1.3] }),
  },
  // --- The Stacks (§12.9) ------------------------------------------------------------------------------
  lensSentry: {
    name: "lens sentry", glyph: "R", color: [230, 232, 240], xp: 12, levels: [13, 18], weight: 2, factions: ["plan"],
    hp: 18, speed: 0, damage: [2, 4], cooldown: 1.5, reach: 1.2, sight: 12, w: 0.8, h: 1.4, armour: 2, weak: ["shock"],
    ranged: { range: 12, hold: 12, damage: [4, 7], cooldown: 2.2, speed: 22, gravity: 0, kind: "bolt" },
    frames: ART.automaton, palette: { L: [[220, 225, 235], 0.2], E: [[255, 255, 210], 1.8], m: [[150, 155, 165], 0], M: [[200, 205, 215], 0] },
  },
  beatSpider: {
    name: "beat-spider", glyph: "R", color: [200, 160, 80], xp: 12, levels: [13, 18], weight: 2, factions: ["plan"],
    hp: 16, speed: 2.6, damage: [3, 6], cooldown: 1.0, reach: 1.3, sight: 10, w: 1.1, h: 0.7, armour: 1,
    ...reskin("spider", { b: [[170, 135, 70], 0], l: [[190, 155, 85], 0], E: [[255, 230, 120], 1.4], m: [[110, 80, 40], 0] }),
  },
  girderGolem: {
    name: "girder golem", glyph: "G", color: [130, 135, 150], xp: 26, levels: [16, 21], weight: 1.5, factions: ["plan"],
    hp: 40, speed: 1.4, damage: [8, 13], cooldown: 1.9, reach: 1.5, sight: 10, w: 1.2, h: 2.2, armour: 3, brittle: true,
    resist: ["fire", "frost"], weak: ["shock"],
    ...reskin("golem", { s: [[95, 98, 110], 0], S: [[130, 135, 150], 0], E: [[255, 160, 80], 1.3] }),
  },
  rustbackBrute: {
    name: "Rustback brute", glyph: "g", color: [150, 60, 50], xp: 14, levels: [13, 18], weight: 2.5, factions: ["rustbacks"],
    hp: 26, speed: 2.2, damage: [5, 9], cooldown: 1.4, reach: 1.4, sight: 12, w: 1.0, h: 1.75,
    ...reskin("orc", { o: [[140, 70, 55], 0], a: [[120, 90, 80], 0] }),
  },
  rustOoze: {
    name: "rust ooze", glyph: "j", color: [190, 80, 50], xp: 10, levels: [13, 18], weight: 2, factions: [],
    hp: 18, speed: 1.3, damage: [2, 5], cooldown: 1.3, reach: 1.2, sight: 8, w: 1.0, h: 0.8, resist: ["shock"],
    ...reskin("slime", { s: [[170, 70, 40], 0.25], S: [[230, 140, 90], 0.5] }),
  },
  // --- The Shade (§12.7) -------------------------------------------------------------------------------
  longshadow: {
    name: "longshadow", glyph: "Z", color: [90, 80, 120], xp: 16, levels: [13, 21], weight: 2, undead: true, darkSight: true, factions: ["unlit"],
    hp: 18, speed: 2.6, damage: [3, 6], cooldown: 1.3, reach: 2.2, sight: 14, w: 0.8, h: 1.8, hover: 0.1, fearsLight: true,
    ...reskin("shade", { k: [[25, 20, 40], 0.1], E: [[150, 120, 230], 1.5] }),
  },
  // --- The Glass Sea's shore (§12.10) --------------------------------------------------------------------
  glassCrab: {
    name: "glass crab", glyph: "c", color: [170, 230, 200], xp: 14, levels: [16, 18], weight: 3, group: [1, 3], factions: ["clatter"],
    hp: 20, speed: 2.2, damage: [4, 7], cooldown: 1.3, reach: 1.3, sight: 9, w: 1.0, h: 0.6, armour: 2,
    frames: ART.crab, palette: { C: [[180, 235, 215], 0.3], c: [[140, 200, 180], 0.3], E: [[30, 40, 40], 0], l: [[100, 150, 140], 0] },
  },
  slagSalamander: {
    name: "slag salamander", glyph: "l", color: [230, 90, 40], xp: 18, levels: [16, 21], weight: 2, factions: [],
    hp: 24, speed: 2.8, damage: [4, 8], cooldown: 1.2, reach: 1.3, sight: 11, w: 1.1, h: 0.6, resist: ["fire"], weak: ["frost"], burns: 3,
    ...reskin("salamander", { r: [[160, 60, 30], 0.35], R: [[240, 120, 40], 0.8] }),
  },
  erratum: {
    name: "erratum", glyph: "E", color: [235, 235, 235], xp: 14, levels: [10, 21], weight: 1, factions: ["errata"],
    hp: 18, speed: 2.8, damage: [3, 6], cooldown: 1.2, reach: 1.3, sight: 11, w: 0.9, h: 1.2, erratic: 0.25,
    frames: ART.erratum, palette: { x: [[235, 235, 235], 0.3], X: [[25, 25, 25], 0], E: [[255, 60, 60], 1.4] },
  },
  // --- The Lattice (§12.11) ----------------------------------------------------------------------------
  askewAngle: {
    name: "Askew angle", glyph: "A", color: [200, 220, 255], xp: 20, levels: [19, 26], weight: 3, factions: ["askew"],
    hp: 26, speed: 3.0, damage: [5, 9], cooldown: 1.2, reach: 1.4, sight: 12, w: 0.8, h: 1.5, erratic: 0.3,
    frames: ART.angle, palette: { a: [[190, 215, 250], 0.6], E: [[255, 255, 255], 1.6] },
  },
  fold: {
    name: "fold", glyph: "A", color: [120, 230, 240], xp: 22, levels: [19, 26], weight: 2, factions: ["askew"],
    hp: 24, speed: 3.2, damage: [5, 8], cooldown: 1.1, reach: 1.4, sight: 12, w: 0.8, h: 1.5, erratic: 0.4,
    frames: ART.angle, palette: { a: [[110, 220, 235], 0.7], E: [[220, 255, 255], 1.6] },
  },
  latticeTroll: {
    name: "lattice troll", glyph: "T", color: [180, 220, 240], xp: 30, levels: [19, 26], weight: 2, factions: [],
    hp: 50, speed: 2.0, damage: [8, 13], cooldown: 1.7, reach: 1.6, sight: 11, w: 1.3, h: 2.1, regen: 1, brittle: true, weak: ["fire"],
    ...reskin("troll", { t: [[170, 210, 230], 0.3], l: [[120, 160, 200], 0.2], c: [[140, 180, 210], 0.2], C: [[200, 230, 245], 0.3] }),
  },
  planarQueen: {
    name: "planar queen", glyph: "Q", color: [180, 140, 255], xp: 40, levels: [21, 26], weight: 1, flat: true, factions: [],
    hp: 60, speed: 1.8, damage: [4, 8], cooldown: 1.3, reach: 1.3, sight: 14, w: 1.2, h: 2.2,
    ...reskin("flatqueen", { p: [[90, 70, 170], 0.4] }),
  },
};
