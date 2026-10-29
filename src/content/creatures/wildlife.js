// Wildlife (TECH_DESIGN §2.18 content/creatures/*.js; WS2, then C3): the real world's creatures, bible §12 by region,
// spawned by the biome builders from content/biomes.js `spawns` (bible §15.2's spawn keys) and drawn by the dungeons
// under the real world's sites from its regions' rows (content/world/regions.js). gen/biomes/index.js registers the
// table with creatures.js registerCreatures.
//
// The parent's creature shape (content/creatures/legacy.js says what each trait does), with these differences:
//   levels   [lo, hi]: the zone levels it turns up at, the same range as its regions' rows (bible §12's tiers: level
//            3 × tier − 1, widened to the deepest floor of its region). Never `depths`: a type with depths joins every
//            dungeon's default pool (creatures.js pickCreatureType), and the legacy stack's levels must stay as they are
//            (golden). The real world's own level table is levels.js LEVEL_POOL, made from these.
//   group    [lo, hi]: how many come together (cairn hounds hunt in packs of 3 to 5)
//   factions bible §12's faction column, as factions.js reads it; `temperament` where the species differs from its
//            faction's (an outrider attacks the Bent, not every Plumb; a guard dog is out for strangers)
//   dv, attrs  the d20 numbers (C3; bible §10.6, §15.6): attrs = { str, agi, tou, int, wil, ego } on the bible's scale
//            (16 is a grown person; the modifier is floor((score − 16) / 2)), and dv, the species' term of a creature's
//            DV (5 + floor(level / 4) + dv), is its AGI modifier. Nothing reads attrs yet (combat reads dv; legends add
//            +1 to each through legendLooks once a creature carries them)
//   rule     the numbers of its bible §12 hook (a howl's 12 tiles, a ledgehorn's climb of 2): what the system that
//            builds the hook reads
//   needs    what its hook waits on (the system and its file); the traits the engine has are already in the entry
//   info, lines  its Deep line and its three registers (bestiary.js), set below the table
// Glyphs follow bible §15.7 (one letter per family, members told apart by colour; check-creatures). The "existing"
// creatures of §12 are the parent's species re-skinned (their pictures, a colour of their own), but for the flatling,
// the shade and the wraith, which keep the parent's entries (legacy.js: golden).
//
// The people of the spawn keys (Flatfolk wanderers, pressed pilgrims) and Hollowmere's are people.js's; the seven
// whose rule needs a system first (the water's three, the salt mirage, the Escapement, the Drowned Bellwether,
// Vesper) are waiting.js's, registered when their system is built.
import { LEGACY_MONSTERS } from "./legacy.js";
import { BESTIARY } from "./bestiary.js";
import "./people.js";   // (the people register themselves; content/index.js is frozen, so they load with the wildlife)

const L = LEGACY_MONSTERS;
// A picture of the parent's, its palette's colours swapped: { letter: [rgb, glow] }.
const reskin = (type, palette) => ({ frames: L[type].frames, palette: { ...L[type].palette, ...palette } });
// The d20 numbers: attributes on the bible's scale, and the species' DV term (its AGI modifier).
const d20 = (str, agi, tou, int, wil, ego) => ({ attrs: { str, agi, tou, int, wil, ego }, dv: Math.floor((agi - 16) / 2) });

// New pictures, one per family (two frames: standing / mid-step; space = see-through).
export const ART = {
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
  moths: [
    ["m   M  m ", "  m    M ", " M  m    ", "    M  m ", " m      M"],
    [" M  m    ", "m     M  ", "   M   m ", " m    M  ", "   m  M  "],
  ],
  camel: [
    ["         hh ", "  bb     hE ", " bbbb   bb  ", "bbbbbbbbbb  ", " bbbbbbbbb  ", " l  l  l  l ", " l  l  l  l "],
    ["         hh ", "  bb     hE ", " bbbb   bb  ", "bbbbbbbbbb  ", " bbbbbbbbb  ", "l  l  l  l  ", "l  l  l  l  "],
  ],
  rider: [
    ["   hh      ", "   hE   s  ", "  aaaa s   ", "  aaaas    ", " bbbbbbbbm ", "bbbbbbbbb  ", " l  l l  l ", " l  l l  l "],
    ["   hh      ", "   hE   s  ", "  aaaa s   ", "  aaaas    ", " bbbbbbbbm ", "bbbbbbbbb  ", "l  l   l l ", "l  l   l l "],
  ],
  knight: [
    ["  hhhhh  ", " hhEhEhh ", "  hhhhh  ", " aaaaaaa ", "aaaPaPaaa", "a aaaaa a", "s aaaaa s", "  aa aa  ", "  aa aa  ", " ff   ff "],
    ["  hhhhh  ", " hhEhEhh ", "  hhhhh  ", " aaaaaaa ", "aaaPaPaaa", "a aaaaa a", "s aaaaa s", "  aa aa  ", " aa   aa ", "ff     ff"],
  ],
  robe: [
    ["   hhh   ", "  hhhhh  ", "  hEhEh  ", "  hhhhh  ", "   rrr   ", "  rrBrr  ", " rrrrrrr ", "r rrrrr r", "  rrrrr  ", " rrrrrrr ", "rrrrrrrrr"],
    ["   hhh   ", "  hhhhh  ", "  hEhEh  ", "  hhhhh  ", "   rrr   ", "  rrBrr  ", " rrrrrrr ", "r rrrrr r", "  rrrrr  ", " rrrrrrr ", " rrrrrrr "],
  ],
  flat: [["  oooo  ", "ooOOOOoo"], [" oooooo ", "oOOOOOOo"]],   // (a flat being: never drawn in 3D, only its shadow)
};

export const WILDLIFE = {
  // --- Brine Flats and the Hollow Mere (§12.1) ---------------------------------------------------------------
  saltrat: {
    name: "saltrat", glyph: "r", color: [226, 214, 190], xp: 2, levels: [1, 8], weight: 6, group: [1, 3], factions: ["saltbeasts"],
    hp: 4, speed: 3.6, damage: [1, 2], cooldown: 0.8, reach: 1.15, sight: 9, w: 0.75, h: 0.4, ...d20(8, 19, 8, 3, 8, 4),
    rule: { reeds: 1 }, needs: "hidden in reed tiles on the map unless next to you (renderMap.js, turns.js refreshView)",
    ...reskin("rat", { b: [[205, 195, 175], 0], f: [[150, 140, 120], 0] }),
  },
  brineGrub: {
    name: "brine-grub", glyph: "w", color: [196, 170, 140], xp: 3, levels: [1, 11], weight: 3, group: [1, 2], factions: ["saltbeasts"],
    hp: 9, speed: 1.4, damage: [1, 3], cooldown: 1.2, reach: 1.15, sight: 7, w: 0.8, h: 0.35, ...d20(12, 8, 16, 2, 10, 2),
    rule: { tunnel: ";" }, needs: "burrowing: unseen while it tunnels, its tunnel drawn on the map as ; (ai.js, renderMap.js)",
    frames: ART.grub, palette: { s: [[190, 165, 135], 0.1], S: [[230, 215, 190], 0.2], E: [[60, 40, 30], 0] },
  },
  clatterer: {
    name: "clatterer", glyph: "c", color: [222, 112, 84], xp: 4, levels: [1, 8], weight: 2, group: [1, 2], factions: ["clatter"],
    hp: 12, speed: 2.4, damage: [2, 4], cooldown: 1.2, reach: 1.2, sight: 9, w: 0.9, h: 0.7, armour: 1, ...d20(16, 14, 16, 12, 14, 14),
    rule: { diagonal: true, deflect: 0.25 }, needs: "diagonal steps only on the map (ai.js), a claw that turns 1 thrown knife in 4 (throwing.js)",
    frames: ART.crab, palette: { C: [[235, 125, 90], 0.1], c: [[205, 100, 75], 0.1], E: [[30, 20, 20], 0], l: [[150, 80, 60], 0] },
  },
  lanternMoths: {
    name: "lantern moths", glyph: "m", color: [250, 236, 160], xp: 0, levels: [1, 30], weight: 1, factions: ["moths"], plural: "swarms of lantern moths",
    hp: 3, speed: 3.0, damage: [0, 1], cooldown: 1.0, reach: 1.1, sight: 10, w: 0.9, h: 0.6, hover: 1.2, erratic: 0.5, ...d20(2, 22, 4, 4, 6, 12),
    rule: { follows: "torch", wards: ["shade"], light: 2 },
    needs: "following your lit torch, keeping shades at bay and their own small light (ai.js, light.js)",
    frames: ART.moths, palette: { m: [[245, 230, 150], 0.9], M: [[255, 250, 210], 1.4] },
  },
  brinehog: {
    name: "brinehog", glyph: "p", color: [176, 128, 112], xp: 5, levels: [1, 11], weight: 4, group: [1, 2], factions: ["saltbeasts"],
    hp: 12, speed: 2.9, damage: [2, 4], cooldown: 1.2, reach: 1.25, sight: 9, w: 1.0, h: 0.75, ...d20(18, 12, 18, 3, 12, 4),
    rule: { charge: "straight" }, needs: "a charge in a straight line that can't turn (ai.js)",
    frames: ART.pig, palette: { b: [[160, 115, 100], 0], t: [[235, 225, 205], 0], E: [[30, 20, 20], 0], n: [[210, 150, 140], 0], f: [[90, 65, 55], 0] },
  },
  drownedKeeper: {
    name: "drowned keeper", glyph: "U", color: [110, 172, 160], xp: 6, levels: [1, 8], weight: 1, factions: ["unlit"],
    hp: 14, speed: 1.6, damage: [2, 4], cooldown: 1.4, reach: 1.3, sight: 10, w: 0.8, h: 1.6, hover: 0.3,
    ghostly: true, undead: true, darkSight: true, ...d20(6, 16, 10, 12, 20, 14),
    rule: { points: "buried", shriek: 12 },
    needs: "pointing at something buried, and a shriek waking everything within 12 tiles if you relight while it points (ai.js, light.js)",
    ...reskin("wraith", { c: [[70, 120, 115], 0.45], E: [[190, 255, 230], 1.6], w: [[170, 210, 200], 0.2] }),
  },

  // --- The Rust Steps (§12.2), the Teeth -----------------------------------------------------------------
  rustbackScav: {
    name: "Rustback scav", glyph: "g", color: [176, 110, 70], xp: 5, levels: [1, 11], weight: 5, group: [1, 3], factions: ["rustbacks"],
    hp: 9, speed: 2.6, damage: [2, 4], cooldown: 1.1, reach: 1.2, sight: 11, w: 0.85, h: 1.2, flee: 0.25, ...d20(14, 17, 13, 10, 10, 10),
    rule: { pickUp: true }, needs: "picking up what you drop, and fleeing to its heap rather than anywhere (ai.js)",
    ...reskin("goblin", { g: [[150, 96, 64], 0], c: [[110, 70, 50], 0], w: [[160, 120, 90], 0] }),
  },
  rustbackSlinger: {
    name: "Rustback slinger", glyph: "g", color: [230, 140, 60], xp: 8, levels: [3, 10], weight: 2.5, factions: ["rustbacks"],
    hp: 8, speed: 2.4, damage: [1, 3], cooldown: 1.2, reach: 1.2, sight: 13, w: 0.85, h: 1.2, ...d20(12, 18, 12, 10, 10, 10),
    ranged: { range: 10, hold: 7, damage: [3, 5], cooldown: 2.0, speed: 16, gravity: 12, kind: "arrow" },
    rule: { perch: 2 }, needs: "standing on ledges 2 or more blocks up that map moves can't reach (gen/biomes, ai.js)",
    ...reskin("archer", { g: [[170, 100, 60], 0], h: [[120, 70, 40], 0] }),
  },
  ledgehorn: {
    name: "ledgehorn", glyph: "q", color: [196, 150, 110], xp: 6, levels: [3, 14], weight: 3, group: [1, 3], factions: ["saltbeasts"],
    hp: 14, speed: 2.8, damage: [2, 5], cooldown: 1.3, reach: 1.3, sight: 10, w: 0.9, h: 1.0, ...d20(17, 18, 15, 3, 14, 6),
    rule: { climb: 2, knock: 2 }, needs: "climbing 2 blocks (pathing.js), and a headbutt that knocks you 2 tiles, off ledges (combat.js)",
    frames: ART.goat, palette: { b: [[185, 140, 100], 0], h: [[230, 220, 200], 0], E: [[30, 20, 10], 0], m: [[150, 110, 80], 0], f: [[90, 70, 50], 0] },
  },
  kite: {
    name: "kite", glyph: "v", color: [210, 180, 90], xp: 7, levels: [3, 14], weight: 2, factions: ["kites"],
    hp: 9, speed: 4.2, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 14, w: 0.9, h: 0.5, hover: 1.4, erratic: 0.15, ...d20(10, 21, 10, 12, 12, 12),
    rule: { nest: "°", steals: "shiny" }, needs: "its nest (°) and the dive when you climb to it, stealing a shiny thing to a perch (gen/biomes, ai.js)",
    frames: ART.bird, palette: { w: [[170, 130, 70], 0], b: [[200, 170, 100], 0], E: [[255, 200, 60], 1.0], k: [[230, 200, 80], 0], t: [[120, 100, 60], 0] },
  },
  ledgeSpider: {
    name: "ledge spider", glyph: "x", color: [190, 110, 80], xp: 6, levels: [3, 10], weight: 3, group: [1, 2], factions: ["saltbeasts"],
    hp: 7, speed: 3.0, damage: [2, 3], cooldown: 1.0, reach: 1.2, sight: 9, w: 1.0, h: 0.55, venom: 2, ...d20(10, 19, 10, 3, 10, 2),
    rule: { web: "-" }, needs: "webs across gaps: a burnable bridge in 3D, drawn - on the map (world.js, gen/biomes)",
    ...reskin("spider", { b: [[150, 90, 70], 0], l: [[170, 105, 80], 0], E: [[255, 150, 60], 1.3] }),
  },
  // --- The Salt Waste (§12.3) ---------------------------------------------------------------------------
  chaffDevil: {
    name: "chaff devil", glyph: "Y", color: [222, 214, 196], xp: 5, levels: [3, 11], weight: 2, factions: [],
    hp: 8, speed: 3.4, damage: [1, 3], cooldown: 1.0, reach: 1.3, sight: 10, w: 0.9, h: 1.4, erratic: 0.4, ...d20(6, 21, 8, 1, 6, 1),
    rule: { blinds: 3, path: "spiral" }, needs: "its hit blinding for 3 s (combat.js onHit) and a spiral path the map can predict (ai.js)",
    frames: ART.whirl, palette: { d: [[215, 205, 185], 0.2], D: [[245, 240, 230], 0.4] },
  },
  longback: {
    name: "longback", glyph: "u", color: [212, 190, 150], xp: 0, levels: [1, 11], weight: 1, group: [1, 3], factions: ["drovers"], temperament: "docile",
    hp: 20, speed: 2.0, damage: [2, 4], cooldown: 1.5, reach: 1.3, sight: 10, w: 1.3, h: 1.6, ...d20(20, 12, 22, 4, 14, 8),
    rule: { travel: 1.5, panics: "saltMirage" }, needs: "hiring (WS6b's trade), the world map's ×1.5 travel while it follows you (overworld/travel.js), panic at mirages",
    frames: ART.camel, palette: { b: [[200, 175, 135], 0], h: [[185, 160, 120], 0], E: [[40, 30, 20], 0], l: [[150, 125, 95], 0] },
  },
  // --- The Downs (§12.4) --------------------------------------------------------------------------------
  cairnHound: {
    name: "cairn hound", glyph: "d", color: [150, 140, 120], xp: 5, levels: [3, 11], weight: 4, group: [3, 5], factions: ["saltbeasts"],
    hp: 9, speed: 3.3, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.9, h: 0.75, weak: ["fire"], ...d20(14, 19, 13, 4, 12, 6),
    rule: { howl: 12, fears: "fire" }, needs: "a howl waking every hound within 12 tiles, and running from fire (ai.js)",
    frames: ART.hound, palette: { h: [[135, 125, 105], 0], e: [[110, 100, 85], 0], E: [[255, 210, 90], 1.1], t: [[120, 110, 95], 0], f: [[80, 72, 60], 0] },
  },
  barrowSkeleton: {
    name: "barrow skeleton", glyph: "s", color: [200, 205, 180], xp: 9, levels: [3, 13], weight: 2, undead: true, factions: ["unlit"], temperament: "aggressive",
    hp: 16, speed: 1.7, damage: [3, 6], cooldown: 1.5, reach: 1.3, sight: 12, w: 0.8, h: 1.6, brittle: true, ...d20(16, 10, 18, 4, 20, 2),
    rule: { rises: "night" }, needs: "rising from the barrows only at night (gen/biomes, clock.js)",
    ...reskin("skeleton", { w: [[200, 205, 180], 0], E: [[150, 230, 140], 1.2] }),
  },
  assizeOutrider: {
    name: "Assize outrider", glyph: "K", color: [214, 214, 198], xp: 9, levels: [6, 17], weight: 1, factions: ["assize"], temperament: "neutral",
    hp: 22, speed: 3.6, damage: [3, 6], cooldown: 1.3, reach: 1.5, sight: 14, w: 1.2, h: 2.0, armour: 2, ...d20(18, 16, 18, 12, 16, 14),
    rule: { lines: "straight", checks: "genotype" },
    needs: "riding only in straight lines (ai.js); it is out for the Bent through the Assize's reputation, and checks your genotype aloud (talk)",
    frames: ART.rider, palette: { h: [[220, 220, 205], 0], E: [[40, 40, 50], 0], s: [[200, 200, 210], 0.1], a: [[195, 195, 180], 0], b: [[150, 140, 120], 0], m: [[120, 110, 95], 0], l: [[110, 100, 85], 0] },
  },
  duskBat: {
    name: "dusk bat", glyph: "b", color: [150, 110, 170], xp: 3, levels: [3, 14], weight: 3, group: [1, 3], factions: ["saltbeasts"],
    hp: 3, speed: 4.4, damage: [1, 3], cooldown: 0.7, reach: 1.15, sight: 10, w: 0.8, h: 0.42, hover: 0.95, erratic: 0.35, ...d20(6, 21, 6, 3, 8, 3),
    rule: { drawnTo: "torch" }, needs: "drawn to lit torches from further off (creatures.js sees); with yours out it loses you, as sight already has it",
    ...reskin("bat", { w: [[115, 85, 135], 0], b: [[140, 105, 150], 0] }),
  },
  barrowTroll: {
    name: "barrow-troll", glyph: "T", color: [140, 150, 120], xp: 24, levels: [9, 16], weight: 1, factions: [],
    hp: 40, speed: 2.0, damage: [6, 11], cooldown: 1.7, reach: 1.6, sight: 11, w: 1.3, h: 2.1, regen: 1, weak: ["fire"], resist: ["frost"], ...d20(24, 10, 26, 6, 14, 6),
    rule: { sleeps: "day" }, needs: "asleep in the Teeth's foothills by day (gen/biomes, clock.js)",
    ...reskin("troll", { t: [[130, 140, 112], 0] }),
  },
  // --- The Pleatwood and the Deep Pleat (§12.5) ---------------------------------------------------------
  creasebeetle: {
    name: "creasebeetle", glyph: "B", color: [96, 150, 110], xp: 6, levels: [3, 16], weight: 4, group: [1, 2], factions: ["pleatwood"],
    hp: 11, speed: 2.2, damage: [2, 4], cooldown: 1.2, reach: 1.2, sight: 8, w: 0.9, h: 0.5, armour: 1, ...d20(14, 12, 16, 2, 12, 2),
    rule: { flips: "hit" }, needs: "flipping flat or deep at every hit it takes, so you turn between blows (combat.js, a hurt hook)",
    frames: ART.beetle, palette: { c: [[70, 120, 85], 0.1], C: [[150, 210, 160], 0.3], a: [[50, 70, 55], 0], E: [[220, 255, 140], 1.0], l: [[40, 55, 45], 0] },
  },
  pleatSpider: {
    name: "pleat spider", glyph: "x", color: [110, 200, 90], xp: 6, levels: [3, 15], weight: 3, factions: ["saltbeasts"],
    hp: 7, speed: 3.0, damage: [2, 3], cooldown: 1.0, reach: 1.2, sight: 9, w: 1.0, h: 0.55, venom: 3, ...d20(10, 19, 10, 3, 10, 2),
    rule: { hides: "fold" }, needs: "hiding in folded branches until you pass (gen/biomes, ai.js)",
    ...reskin("spider", { b: [[70, 120, 60], 0], l: [[90, 140, 75], 0], E: [[200, 255, 80], 1.3] }),
  },
  hangvine: {
    name: "hangvine", glyph: "n", color: [90, 160, 70], xp: 7, levels: [6, 23], weight: 2, factions: ["pleatwood"], temperament: "aggressive",
    hp: 14, speed: 1.0, damage: [3, 5], cooldown: 1.4, reach: 1.5, sight: 6, w: 0.6, h: 1.6, hover: 1.2, weak: ["fire"], ...d20(18, 7, 18, 1, 18, 1),
    rule: { drops: true, mapAs: "tree" }, needs: "drawn as a tree on the map, dropping onto whoever passes below (renderMap.js, ai.js)",
    frames: ART.vine, palette: { v: [[70, 130, 60], 0], E: [[230, 90, 60], 1.0] },
  },
  sporeling: {
    name: "sporeling", glyph: "j", color: [190, 130, 200], xp: 7, levels: [5, 16], weight: 2.5, factions: ["sporeMoot"],
    hp: 16, speed: 1.3, damage: [2, 5], cooldown: 1.3, reach: 1.2, sight: 8, w: 1.0, h: 0.8, splits: "sporelet", resist: ["shock"], ...d20(12, 8, 18, 4, 16, 4),
    rule: { roots: "limb" }, needs: "its touch rooting a fungal limb (body.js, the Spore Moot's reputation; C2's special)",
    ...reskin("slime", { s: [[170, 110, 185], 0.25], S: [[230, 190, 240], 0.5] }),
  },
  sporelet: {   // (what a sporeling splits into: not a bible creature of its own, as the parent's small slime isn't)
    name: "small sporeling", glyph: "j", color: [216, 172, 226], xp: 2, levels: [5, 16], weight: 0, factions: ["sporeMoot"],
    hp: 6, speed: 2.0, damage: [1, 3], cooldown: 1.0, reach: 1.15, sight: 8, w: 0.55, h: 0.45, ...d20(8, 12, 12, 2, 12, 2),
    ...reskin("slimelet", { s: [[190, 140, 205], 0.25], S: [[240, 210, 245], 0.5] }),
  },
  foldmonkey: {
    name: "foldmonkey", glyph: "y", color: [170, 130, 80], xp: 8, levels: [5, 13], weight: 2, group: [1, 3], factions: ["pleatwood"], temperament: "aggressive",
    hp: 10, speed: 3.6, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.7, h: 0.9, erratic: 0.2, ...d20(10, 21, 10, 12, 10, 14),
    ranged: { range: 8, hold: 5, damage: [2, 4], cooldown: 2.4, speed: 12, gravity: 14, kind: "arrow" },
    rule: { perch: 4, steals: 5 }, needs: "throwing from 4 or more blocks up, and stealing 5 glim and climbing away (ai.js, currency.js)",
    frames: ART.monkey, palette: { m: [[150, 110, 70], 0], f: [[220, 190, 150], 0], E: [[40, 30, 20], 0], t: [[130, 95, 60], 0] },
  },
  paperWasps: {
    name: "paper wasps", glyph: "P", color: [230, 220, 160], xp: 9, levels: [9, 23], weight: 3, factions: ["saltbeasts"],
    hp: 10, speed: 4.0, damage: [2, 5], cooldown: 0.8, reach: 1.2, sight: 10, w: 0.9, h: 0.8, hover: 0.8, erratic: 0.5, venom: 2, weak: ["fire"],
    ...d20(4, 21, 6, 2, 8, 2), plural: "swarms of paper wasps",
    rule: { underDoors: true, stain: 30 }, needs: "slipping flat under doors, and stings that stain you so foes see you at twice the range for 30 s (status.js, creatures.js sees)",
    frames: ART.wasps, palette: { y: [[220, 205, 140], 0.2], b: [[40, 35, 30], 0] },
  },
  mootWalker: {
    name: "moot-walker", glyph: "F", color: [170, 110, 150], xp: 14, levels: [12, 23], weight: 2, factions: ["sporeMoot"], temperament: "aggressive",
    hp: 24, speed: 1.6, damage: [4, 8], cooldown: 1.5, reach: 1.4, sight: 10, w: 0.9, h: 1.7, undead: true, weak: ["fire"], ...d20(18, 10, 20, 8, 20, 6),
    rule: { deathCloud: "confused" }, needs: "a cloud of confusing spores when it dies (monsters.js killMonster, status.js)",
    frames: ART.walker, palette: { c: [[175, 110, 160], 0.3], C: [[230, 170, 220], 0.6], s: [[150, 140, 120], 0], E: [[255, 240, 120], 1.2], b: [[95, 80, 70], 0] },
  },
  // --- The Tessellate (§12.6) ---------------------------------------------------------------------------
  tileMimic: {
    name: "tile mimic", glyph: "t", color: [200, 80, 64], xp: 10, levels: [9, 18], weight: 3, flat: true, factions: [],
    hp: 12, speed: 2.6, damage: [3, 5], cooldown: 1.1, reach: 1.2, sight: 9, w: 0.9, h: 0.1, ...d20(14, 14, 14, 8, 18, 6),
    rule: { movesIn: "3d" }, needs: "moving only while you are in 3D, a mosaic tile one shade off on the map (ai.js, renderMap.js)",
    frames: [["tttttt", "tTTTTt"], ["tttttt", "tTttTt"]],   // (flat: never drawn in 3D, only its shadow)
    palette: { t: [[170, 60, 50], 0], T: [[222, 190, 82], 0.2] },
  },
  pressHound: {
    name: "press-hound", glyph: "d", color: [140, 150, 170], xp: 10, levels: [9, 18], weight: 3, group: [2, 3], factions: ["assize"],
    hp: 14, speed: 3.2, damage: [3, 5], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.9, h: 0.75, armour: 1, ...d20(16, 18, 15, 4, 14, 6),
    rule: { flattens: 3 }, needs: "its bite pressing you Flat for 3 s (combat.js onHit; status.js flat)",
    frames: ART.hound, palette: { h: [[120, 128, 145], 0], e: [[95, 100, 115], 0], E: [[200, 220, 255], 1.1], t: [[110, 115, 130], 0], f: [[70, 72, 82], 0] },
  },
  mosaicGolem: {
    name: "mosaic golem", glyph: "G", color: [196, 120, 80], xp: 20, levels: [12, 18], weight: 1, factions: ["plan"], temperament: "aggressive",
    hp: 34, speed: 1.4, damage: [6, 10], cooldown: 1.9, reach: 1.5, sight: 10, w: 1.2, h: 2.2, armour: 2, brittle: true, weak: ["shock"], ...d20(22, 8, 24, 4, 20, 2),
    rule: { eyeTile: true }, needs: "assembling out of a mosaic when you step on its eye tile (gen/biomes, a floor trigger)",
    ...reskin("golem", { s: [[60, 92, 172], 0], S: [[196, 64, 52], 0], E: [[222, 190, 82], 1.3] }),
  },
  // --- The Shade (§12.7) --------------------------------------------------------------------------------
  lamplessChanter: {
    name: "Lampless chanter", glyph: "N", color: [112, 92, 152], xp: 9, levels: [12, 16], weight: 1, factions: ["lampless"], darkSight: true,
    hp: 16, speed: 2.0, damage: [2, 4], cooldown: 1.4, reach: 1.3, sight: 12, w: 0.8, h: 1.8, ...d20(12, 14, 14, 14, 20, 16),
    rule: { snuffs: 10, holy: true }, needs: "hostile only to a lit torch in a holy place (factions.js attitude, C2's holy places), its chant snuffing it for 10 s (torch.js)",
    frames: ART.robe, palette: { h: [[70, 60, 95], 0], E: [[200, 190, 230], 0.8], r: [[90, 80, 115], 0], B: [[40, 35, 55], 0] },
  },
  longshadow: {
    name: "longshadow", glyph: "Z", color: [90, 80, 120], xp: 16, levels: [12, 28], weight: 2, undead: true, darkSight: true, factions: ["unlit"], temperament: "aggressive",
    hp: 18, speed: 2.6, damage: [3, 6], cooldown: 1.3, reach: 2.2, sight: 14, w: 0.8, h: 1.8, hover: 0.1, fearsLight: true, ...d20(14, 19, 12, 8, 18, 6),
    rule: { reach: 6, line: true }, needs: "striking along the ground from 6 tiles, its line drawn on the map and only a darkening in 3D (combat.js, renderMap.js)",
    ...reskin("shade", { k: [[25, 20, 40], 0.1], E: [[150, 120, 230], 1.5] }),
  },
  gloamWarden: {   // (bible: "the original Gloom Warden, as a legendary": the Lampless Saint's rule, guardians.js)
    name: "Gloam Warden", glyph: "W", color: [118, 204, 240], xp: 90, factions: ["unlit"], temperament: "aggressive",
    hp: 120, speed: 1.9, damage: [6, 10], cooldown: 1.6, reach: 1.6, sight: 18, w: 1.6, h: 2.8, hover: 0.4,
    ghostly: true, undead: true, darkSight: true, resist: ["frost", "fire", "shock"], ai: "legend:lamplessSaint", ...d20(22, 14, 26, 12, 24, 16),
    needs: "its place at the bottom of the Unlit Choir (C1b's landmark dungeon) and its wake line (story)",
    ...reskin("warden", { h: [[105, 130, 185], 0.6], E: [[170, 230, 255], 1.8], L: [[150, 220, 255], 1.8] }),
  },
  // --- Halfnight and the Assize (§12.8) --------------------------------------------------------------------
  plumbknight: {
    name: "plumbknight", glyph: "K", color: [150, 160, 176], xp: 16, levels: [12, 23], weight: 1, factions: ["assize"],
    hp: 30, speed: 2.2, damage: [5, 9], cooldown: 1.6, reach: 1.4, sight: 12, w: 1.0, h: 1.9, armour: 4, ...d20(20, 12, 20, 12, 18, 12),
    rule: { charge: "rows" }, needs: "charging only along rows and columns, never turning mid-charge (ai.js)",
    frames: ART.knight, palette: { h: [[150, 160, 176], 0], E: [[30, 30, 40], 0], a: [[125, 135, 150], 0], P: [[200, 205, 215], 0.2], s: [[170, 175, 185], 0], f: [[80, 85, 95], 0] },
  },
  assizer: {
    name: "assizer", glyph: "K", color: [236, 200, 92], xp: 14, levels: [12, 23], weight: 1, factions: ["assize"],
    hp: 24, speed: 2.2, damage: [3, 6], cooldown: 1.4, reach: 1.3, sight: 13, w: 0.9, h: 1.9, armour: 2, ...d20(14, 14, 16, 18, 22, 18),
    rule: { overrule: 20, banners: true },
    needs: "Overrule, suppressing one of your mutations or implants for 20 s (an ability, abilities.js), and Rule-banners: Trued zones (C2)",
    frames: ART.knight, palette: { h: [[220, 210, 190], 0], E: [[30, 30, 40], 0], a: [[230, 225, 210], 0], P: [[236, 200, 92], 0.6], s: [[200, 170, 80], 0.2], f: [[90, 80, 60], 0] },
  },
  chimePriest: {
    name: "chime-priest", glyph: "H", color: [232, 172, 64], xp: 10, levels: [9, 16], weight: 1, factions: ["horary"],
    hp: 20, speed: 2.0, damage: [2, 5], cooldown: 1.4, reach: 1.3, sight: 11, w: 0.9, h: 1.8, ...d20(12, 14, 14, 16, 18, 18),
    rule: { hourHaste: true, preaches: true }, needs: "on the hour its aura hastes its allies (clock.js, status.js), and it preaches the Chime (talk)",
    frames: ART.robe, palette: { h: [[200, 150, 70], 0], E: [[40, 30, 20], 0], r: [[210, 150, 60], 0], B: [[255, 220, 120], 1.2] },
  },
  chandlerGuard: {
    name: "Chandler guard", glyph: "J", color: [250, 206, 92], xp: 12, levels: [9, 16], weight: 1, factions: ["chandlers"],
    hp: 22, speed: 2.4, damage: [3, 6], cooldown: 1.3, reach: 1.3, sight: 13, w: 0.9, h: 1.8, armour: 2, ...d20(16, 16, 16, 12, 14, 12),
    ranged: { range: 8, hold: 5, damage: [4, 7], cooldown: 2.6, speed: 18, gravity: 0, kind: "bolt" },
    rule: { oil: true }, needs: "setting oil puddles alight with its glimgun (liquids, C2's glim; effects.js)",
    frames: ART.knight, palette: { h: [[120, 80, 50], 0], E: [[40, 30, 20], 0], a: [[160, 110, 60], 0], P: [[250, 206, 92], 0.9], s: [[200, 190, 170], 0.1], f: [[70, 50, 35], 0] },
  },
  lampHound: {
    name: "lamp-hound", glyph: "d", color: [226, 186, 72], xp: 8, levels: [6, 16], weight: 1, group: [1, 2], factions: ["chandlers"], temperament: "aggressive",
    hp: 14, speed: 3.3, damage: [3, 5], cooldown: 1.0, reach: 1.2, sight: 12, w: 0.9, h: 0.75, ...d20(15, 19, 14, 4, 12, 6),
    rule: { tracks: "light" }, needs: "tracking light, not sound: with your torch out it loses you at once (creatures.js sees); it guards the Root Canals (C1b)",
    frames: ART.hound, palette: { h: [[200, 160, 70], 0], e: [[170, 130, 55], 0], E: [[255, 240, 160], 1.3], t: [[180, 140, 60], 0], f: [[110, 85, 40], 0] },
  },
  // --- The Stacks (§12.9) ---------------------------------------------------------------------------------
  draughtsman: {
    name: "draughtsman", glyph: "R", color: [186, 166, 128], xp: 12, levels: [9, 19], weight: 2, factions: ["plan"], plural: "draughtsmen",
    hp: 26, speed: 1.8, damage: [3, 6], cooldown: 1.5, reach: 1.3, sight: 10, w: 0.9, h: 1.5, armour: 2, ...d20(16, 12, 18, 18, 16, 4),
    rule: { blueprint: true, repairs: true, patience: 3 },
    needs: "walking the blueprint path drawn on the map and mending broken walls; hostile after the third (ai.js, world.js)",
    frames: ART.automaton, palette: { L: [[190, 170, 130], 0.1], E: [[120, 220, 255], 1.4], m: [[150, 130, 95], 0], M: [[210, 190, 140], 0] },
  },
  lensSentry: {
    name: "lens sentry", glyph: "R", color: [230, 232, 240], xp: 12, levels: [12, 25], weight: 2, factions: ["plan"], temperament: "aggressive", plural: "lens sentries",
    hp: 18, speed: 0, damage: [2, 4], cooldown: 1.5, reach: 1.2, sight: 12, w: 0.8, h: 1.4, armour: 2, weak: ["shock"], ...d20(10, 8, 16, 14, 18, 2),
    ranged: { range: 12, hold: 12, damage: [4, 7], cooldown: 2.2, speed: 22, gravity: 0, kind: "bolt" },
    rule: { blindPast: 6, umbra: "blind" }, needs: "blinded by umbra (liquids); with your torch out it sees no further than 6 tiles, as sight already has it (12 × 0.55)",
    frames: ART.automaton, palette: { L: [[220, 225, 235], 0.2], E: [[255, 255, 210], 1.8], m: [[150, 155, 165], 0], M: [[200, 205, 215], 0] },
  },
  beatSpider: {
    name: "beat-spider", glyph: "R", color: [200, 160, 80], xp: 12, levels: [12, 25], weight: 2, factions: ["plan"], temperament: "aggressive",
    hp: 16, speed: 2.6, damage: [3, 6], cooldown: 1.0, reach: 1.3, sight: 10, w: 1.1, h: 0.7, armour: 1, ...d20(16, 17, 16, 4, 16, 2),
    rule: { beat: 0.5 }, needs: "moving only on the beat, twice a second (ai.js; zone.beat)",
    ...reskin("spider", { b: [[170, 135, 70], 0], l: [[190, 155, 85], 0], E: [[255, 230, 120], 1.4], m: [[110, 80, 40], 0] }),
  },
  girderGolem: {
    name: "girder golem", glyph: "G", color: [130, 135, 150], xp: 26, levels: [15, 25], weight: 1.5, factions: ["plan"], temperament: "aggressive",
    hp: 40, speed: 1.4, damage: [8, 13], cooldown: 1.9, reach: 1.5, sight: 10, w: 1.2, h: 2.2, armour: 3, brittle: true,
    resist: ["fire", "frost"], weak: ["shock"], ...d20(24, 8, 26, 4, 20, 2),
    ...reskin("golem", { s: [[95, 98, 110], 0], S: [[130, 135, 150], 0], E: [[255, 160, 80], 1.3] }),
  },
  rustbackBrute: {
    name: "Rustback brute", glyph: "g", color: [150, 60, 50], xp: 14, levels: [12, 25], weight: 2.5, factions: ["rustbacks"],
    hp: 26, speed: 2.2, damage: [5, 9], cooldown: 1.4, reach: 1.4, sight: 12, w: 1.0, h: 1.75, ...d20(22, 14, 20, 8, 12, 8),
    ...reskin("orc", { o: [[140, 70, 55], 0], a: [[120, 90, 80], 0] }),
  },
  rustOoze: {
    name: "rust ooze", glyph: "j", color: [190, 80, 50], xp: 10, levels: [12, 25], weight: 2, factions: [],
    hp: 18, speed: 1.3, damage: [2, 5], cooldown: 1.3, reach: 1.2, sight: 8, w: 1.0, h: 0.8, resist: ["shock"], ...d20(12, 6, 20, 1, 14, 1),
    rule: { corrodes: 1 }, needs: "each hit lowering your weapon's enchantment by 1, lacquered gear immune (combat.js onHit; C4's lacquer)",
    ...reskin("slime", { s: [[170, 70, 40], 0.25], S: [[230, 140, 90], 0.5] }),
  },
  // --- The Glass Sea's shore (§12.10) --------------------------------------------------------------------------
  glassCrab: {
    name: "glass crab", glyph: "c", color: [170, 230, 200], xp: 14, levels: [12, 24], weight: 3, group: [1, 3], factions: ["clatter"], temperament: "aggressive",
    hp: 20, speed: 2.2, damage: [4, 7], cooldown: 1.3, reach: 1.3, sight: 9, w: 1.0, h: 0.6, armour: 2, ...d20(18, 14, 18, 4, 14, 6),
    rule: { reflects: true }, needs: "throws and bolts bouncing back off its shell (throwing.js, missiles.js); feral, so its Clatter kin don't vouch for it",
    frames: ART.crab, palette: { C: [[180, 235, 215], 0.3], c: [[140, 200, 180], 0.3], E: [[30, 40, 40], 0], l: [[100, 150, 140], 0] },
  },
  slagSalamander: {
    name: "slag salamander", glyph: "l", color: [230, 90, 40], xp: 18, levels: [12, 24], weight: 2, factions: [],
    hp: 24, speed: 2.8, damage: [4, 8], cooldown: 1.2, reach: 1.3, sight: 11, w: 1.1, h: 0.6, resist: ["fire"], weak: ["frost"], burns: 3, ...d20(18, 16, 18, 4, 14, 4),
    ...reskin("salamander", { r: [[160, 60, 30], 0.35], R: [[240, 120, 40], 0.8] }),
  },
  erratum: {
    name: "erratum", glyph: "E", color: [235, 235, 235], xp: 14, levels: [9, 24], weight: 1, factions: ["errata"], plural: "errata",
    hp: 18, speed: 2.8, damage: [3, 6], cooldown: 1.2, reach: 1.3, sight: 11, w: 0.9, h: 1.2, erratic: 0.25, ...d20(16, 18, 16, 12, 16, 12),
    rule: { misprints: "lastKill" }, needs: "a misprint of the last creature you killed, in reversed colours, striking from your left and hating its original (ai.js, creatures.js)",
    frames: ART.erratum, palette: { x: [[235, 235, 235], 0.3], X: [[25, 25, 25], 0], E: [[255, 60, 60], 1.4] },
  },
  // --- The Lattice (§12.11) -------------------------------------------------------------------------------
  askewAngle: {
    name: "Askew angle", glyph: "A", color: [200, 220, 255], xp: 20, levels: [18, 30], weight: 3, factions: ["askew"],
    hp: 26, speed: 3.0, damage: [5, 9], cooldown: 1.2, reach: 1.4, sight: 12, w: 0.8, h: 1.5, erratic: 0.3, ...d20(18, 20, 16, 16, 18, 10),
    rule: { diagonal: true, jumps: "grid" }, needs: "moving only along diagonals and jumping between grid crossings; a shimmer at a wrong angle in 3D (ai.js, render3d.js)",
    frames: ART.angle, palette: { a: [[190, 215, 250], 0.6], E: [[255, 255, 255], 1.6] },
  },
  fold: {
    name: "fold", glyph: "A", color: [120, 230, 240], xp: 22, levels: [18, 30], weight: 2, factions: ["askew"],
    hp: 24, speed: 3.2, damage: [5, 8], cooldown: 1.1, reach: 1.4, sight: 12, w: 0.8, h: 1.5, erratic: 0.4, ...d20(16, 20, 16, 14, 18, 10),
    rule: { mirrors: "centre" }, needs: "its hit folding you to the mirror-image tile across the zone's centre (combat.js onHit, zones.js)",
    frames: ART.angle, palette: { a: [[110, 220, 235], 0.7], E: [[220, 255, 255], 1.6] },
  },
  latticeTroll: {
    name: "lattice troll", glyph: "T", color: [180, 220, 240], xp: 30, levels: [18, 30], weight: 2, factions: [],
    hp: 50, speed: 2.0, damage: [8, 13], cooldown: 1.7, reach: 1.6, sight: 11, w: 1.3, h: 2.1, regen: 1, brittle: true, weak: ["fire"], ...d20(26, 10, 26, 6, 16, 6),
    ...reskin("troll", { t: [[170, 210, 230], 0.3], l: [[120, 160, 200], 0.2], c: [[140, 180, 210], 0.2], C: [[200, 230, 245], 0.3] }),
  },
  planarQueen: {   // (the Flat Queen's rule, as the Twice-pressed legend has it: guardians.js "legend:twicePressed")
    name: "planar queen", glyph: "Q", color: [180, 140, 255], xp: 40, levels: [18, 30], weight: 1, flat: true, factions: [], ai: "legend:twicePressed",
    hp: 60, speed: 1.8, damage: [4, 8], cooldown: 1.3, reach: 1.3, sight: 14, w: 1.2, h: 2.2, ...d20(18, 16, 22, 16, 22, 20),
    ...reskin("flatqueen", { p: [[90, 70, 170], 0.4] }),
  },
  // --- Anywhere: the Cast hunters (§12.12) ---------------------------------------------------------------
  // Called by your wakes at your tier (bible §10.3, §15.6 "Cast"): the "smoothers" event's listener spawns the pack
  // (integration request; C2 #11). They belong to no faction (the Plane is no one's), so every one is out for you.
  smoother: {
    name: "smoother", glyph: "o", color: [150, 150, 162], xp: 6, factions: [], flat: true, darkSight: true,
    hp: 12, speed: 3.0, damage: [2, 5], cooldown: 1.1, reach: 1.2, sight: 14, w: 0.8, h: 0.1, ...d20(14, 18, 14, 2, 22, 1),
    needs: "the \"smoothers\" listener that spawns the pack along the floor at your tier (WS4b #17, C2 #11)",
    frames: ART.flat, palette: { o: [[110, 110, 125], 0], O: [[170, 170, 185], 0.3] },
  },
  burnisher: {
    name: "burnisher", glyph: "o", color: [240, 240, 246], xp: 9, factions: [], flat: true, darkSight: true,
    hp: 16, speed: 3.2, damage: [3, 6], cooldown: 1.1, reach: 1.2, sight: 14, w: 0.8, h: 0.1, ...d20(16, 18, 16, 2, 24, 1),
    rule: { flattens: 3 }, needs: "the smoothers' listener (one tier above yours), and its hit pressing you Flat for 3 s (combat.js onHit; status.js flat)",
    frames: ART.flat, palette: { o: [[200, 200, 210], 0.2], O: [[255, 255, 255], 0.6] },
  },
};

// The Great Smoother (bible §15.6: it leads the pack at Cast 45+): a smoother made legendary by the listener, as a lair's
// owner is (LEGENDS.base: +3 levels, ×2 HP, ×10 XP, the magenta of legends).
export const SMOOTHERS = { pack: "smoother", burnisher: "burnisher", great: { species: "smoother", name: "the Great Smoother", epithet: "Who Tidies" } };

// Its Deep line (what the examine screen shows) and its three registers.
for (const [id, t] of Object.entries(WILDLIFE)) {
  const b = BESTIARY[id];
  if (b) { t.info = b.deep; t.lines = { flat: b.flat, deep: b.deep, dark: b.dark }; }
}
