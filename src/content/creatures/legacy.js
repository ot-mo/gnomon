// The parent game's creatures as content (TECH_DESIGN §2.3, §1.1 content/creatures/legacy.js): its
// monsters, their elites and its people (who are creatures that talk). creatures.js registers them
// when it loads; this file imports creatures.js and creatures.js imports this one, so the registry
// lives on a function there (as items.js does it).
//
// Glyphs follow the bible's registry (§15.7): goblin archers and orcs joined the Rustback family
// (`g`, told apart by colour), which frees `a` and `o`. People are `@` in their own colour; the
// Speaking Door is `Ω` and a shrine `†`, the glyphs the registry keeps for them.
import { registerCreatures, registerElites } from "../../creatures.js";

// art: pixel art, one letter per pixel (a palette entry), space = see-through.
// Two frames: standing / mid-step. palette: letter → [colour, glow]
//
// depths: [first, last] floor it turns up on, and weight: how common it is there.
// Traits (all optional):
//   hover    – floats this far above the ground       erratic – chance a step is random
//   venom    – its bite poisons you for this long      drain   – heals by the damage it does
//   regen    – heals this much a second (not while burning)
//   darkSight – spots you as easily with your torch out
//   ranged   – { range, hold, damage, cooldown, speed, gravity, kind }: shoots from up to
//              `range` tiles; stops walking closer once within `hold` tiles and in sight
//   splits   – breaks into two of this type when it dies
//   undead   – holy weapons do double damage          boss – the end of the game
//   flat     – a being of the plane: it only exists in the flat (map) view. In 3D it's just a
//              shadow on the floor, and nothing you do there can touch it — but it can still
//              bite you. Look at the world from above (Tab) to fight it.
//   resist   – elements that do it little harm (less damage, and no burning / chill / arc)
//   weak     – elements that hurt it half again as much
//   brittle  – crushing weapons do double damage       ghostly – only there with your torch out
//   guardian – one of the three guardians (floors 5, 10, 15: see guardians.js)
export const LEGACY_MONSTERS = {
  rat: {
    name: "rat", glyph: "r", color: [190, 140, 100], xp: 2, depths: [1, 5], weight: 6,
    hp: 4, speed: 3.4, damage: [1, 2], cooldown: 0.8, reach: 1.15, sight: 9,
    w: 0.75, h: 0.4,
    frames: [
      ["  pp        ", " bbbbb      ", "ebbbbbbbb   ", "bbbbbbbbbbtt", " bbbbbbbb  t", "  f  f  f   "],
      ["  pp        ", " bbbbb      ", "ebbbbbbbb   ", "bbbbbbbbbbtt", " bbbbbbbb  t", "   f  f  f  "],
    ],
    palette: { b: [[140, 105, 80], 0], p: [[210, 140, 140], 0], e: [[255, 40, 30], 1.2],
               t: [[200, 130, 130], 0], f: [[90, 70, 60], 0] },
  },
  bat: {
    name: "bat", glyph: "b", color: [170, 120, 150], xp: 3, depths: [2, 9], weight: 3,
    hp: 3, speed: 4.4, damage: [1, 3], cooldown: 0.7, reach: 1.15, sight: 10,
    w: 0.8, h: 0.42, hover: 0.95, erratic: 0.35,
    frames: [
      ["ww         ww", "www  bbb  www", " wwwbebebwww ", "   wbbbbbw   ", "     f f     "],
      ["             ", "     bbb     ", "  wwbebebww  ", " wwwwbbbwwww ", "ww   f f   ww"],
    ],
    palette: { w: [[130, 100, 115], 0], b: [[155, 125, 115], 0], e: [[255, 60, 40], 1.3], f: [[235, 235, 235], 0.1] },
  },
  goblin: {
    name: "goblin", glyph: "g", color: [110, 200, 90], xp: 5, depths: [1, 10], weight: 5,
    hp: 9, speed: 2.6, damage: [2, 4], cooldown: 1.1, reach: 1.2, sight: 11,
    w: 0.85, h: 1.2,
    frames: [
      ["g        g", "gg gggg gg", " gggggggg ", " gYggggYg ", " gggmmggg ", "  gggggg  ",
       " cccccccc ", "gccccccccw", "g cccccc w", "  cccccc w", "  gg  gg  ", "  dd  dd  "],
      ["g        g", "gg gggg gg", " gggggggg ", " gYggggYg ", " gggmmggg ", "  gggggg  ",
       " cccccccc ", "gccccccccw", "g cccccc w", "  cccccc w", " gg    gg ", " dd    dd "],
    ],
    palette: { g: [[90, 150, 70], 0], Y: [[255, 220, 60], 1.2], m: [[120, 30, 30], 0],
               c: [[120, 80, 50], 0], w: [[170, 170, 180], 0], d: [[70, 50, 40], 0] },
  },
  spider: {
    name: "spider", glyph: "x", color: [200, 90, 200], xp: 6, depths: [3, 12], weight: 3,
    hp: 7, speed: 3.0, damage: [2, 3], cooldown: 1.0, reach: 1.2, sight: 9,
    w: 1.0, h: 0.55, venom: 3,
    frames: [
      [" l   bbb   l ", "l l bbbbb l l", "  lbbEbEbbl  ", " l bbbbbbb l ", "l   bbbbb   l", "   l  m  l   "],
      ["l    bbb    l", " l lbbbbbl l ", "  lbbEbEbbl  ", "l  bbbbbbb  l", " l  bbbbb  l ", "  l   m   l  "],
    ],
    palette: { b: [[115, 95, 125], 0], l: [[130, 108, 122], 0], E: [[255, 70, 210], 1.4], m: [[170, 50, 50], 0] },
  },
  flatling: {
    name: "flatling", glyph: "f", color: [200, 170, 255], xp: 7, depths: [3, 18], weight: 2,
    hp: 9, speed: 3.0, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 10,
    w: 0.8, h: 0.1, flat: true,
    frames: [["  ffff  ", "ffFFFFff"], [" ffffff ", "fFFFFFFf"]],   // (never drawn in 3D: only its shadow)
    palette: { f: [[120, 100, 170], 0], F: [[200, 170, 255], 0.3] },
  },
  skeleton: {
    name: "skeleton", glyph: "s", color: [225, 220, 205], xp: 9, undead: true, depths: [2, 18], weight: 3,
    hp: 16, speed: 1.7, damage: [3, 6], cooldown: 1.5, reach: 1.3, sight: 12,
    w: 0.8, h: 1.6, brittle: true,
    frames: [
      ["  wwwww  ", " wwwwwww ", " wEwwwEw ", " wwwdwww ", "  wdwdw  ", "    w    ", " wwwwwww ",
       "w  wdw  w", "w  www  w", "w  wdw  w", "   www   ", "  w   w  ", "  w   w  ", "  w   w  ", " ww   ww "],
      ["  wwwww  ", " wwwwwww ", " wEwwwEw ", " wwwdwww ", "  wdwdw  ", "    w    ", " wwwwwww ",
       "w  wdw  w", "w  www  w", "w  wdw  w", "   www   ", "  w   w  ", " w     w ", " w     w ", "ww     ww"],
    ],
    palette: { w: [[225, 220, 205], 0], d: [[60, 55, 50], 0], E: [[120, 200, 255], 1.2] },
  },
  archer: {
    name: "goblin archer", glyph: "g", color: [170, 210, 90], xp: 8, depths: [4, 14], weight: 2.5,
    hp: 8, speed: 2.4, damage: [1, 3], cooldown: 1.2, reach: 1.2, sight: 13,
    w: 0.85, h: 1.2,
    ranged: { range: 10, hold: 7, damage: [3, 5], cooldown: 2.0, speed: 16, gravity: 12, kind: "arrow" },
    frames: [
      ["g        g", "gg hhhh gg", " ghhhhhhg ", " gYggggYg ", " gggmmggg ", "  gggggg B",
       " hhhhhhhB ", "ghhhhhhhB ", "g hhhhhhB ", "  hhhhhh B", "  gg  gg  ", "  dd  dd  "],
      ["g        g", "gg hhhh gg", " ghhhhhhg ", " gYggggYg ", " gggmmggg ", "  gggggg B",
       " hhhhhhhB ", "ghhhhhhhB ", "g hhhhhhB ", "  hhhhhh B", " gg    gg ", " dd    dd "],
    ],
    palette: { g: [[90, 150, 70], 0], Y: [[255, 220, 60], 1.2], m: [[120, 30, 30], 0],
               h: [[65, 90, 55], 0], B: [[150, 105, 55], 0], d: [[70, 50, 40], 0] },
  },
  slime: {
    name: "slime", glyph: "j", color: [100, 220, 110], xp: 7, depths: [5, 15], weight: 2.5,
    hp: 18, speed: 1.3, damage: [2, 5], cooldown: 1.3, reach: 1.2, sight: 8,
    w: 1.0, h: 0.8, splits: "slimelet", resist: ["shock"],
    frames: [
      ["    ssss    ", "  ssSSssss  ", " ssSsssssss ", "sssEsssEssss", "ssssssssssss", " ssssssssss "],
      ["            ", "   ssssss   ", " ssSSssssss ", "ssSssEsssEss", "ssssssssssss", "ssssssssssss"],
    ],
    palette: { s: [[80, 200, 90], 0.25], S: [[190, 255, 190], 0.5], E: [[20, 40, 20], 0] },
  },
  slimelet: {
    name: "small slime", glyph: "j", color: [140, 240, 140], xp: 2,
    hp: 6, speed: 2.0, damage: [1, 3], cooldown: 1.0, reach: 1.15, sight: 8,
    w: 0.55, h: 0.45,
    frames: [
      ["    ssss    ", "  ssSSssss  ", " ssSsssssss ", "sssEsssEssss", "ssssssssssss", " ssssssssss "],
      ["            ", "   ssssss   ", " ssSSssssss ", "ssSssEsssEss", "ssssssssssss", "ssssssssssss"],
    ],
    palette: { s: [[110, 220, 110], 0.25], S: [[200, 255, 200], 0.5], E: [[20, 40, 20], 0] },
  },
  orc: {
    name: "orc", glyph: "g", color: [150, 170, 100], xp: 14, depths: [7, 19], weight: 3.5,
    hp: 26, speed: 2.2, damage: [5, 9], cooldown: 1.4, reach: 1.4, sight: 12,
    w: 1.0, h: 1.75,
    frames: [
      ["   oooooo    ", "  oooooooo   ", "  oRooooRo  X", "  oooooooo XX", "  oTmmmmTo XX",
       "   oooooo  h ", " aaaaaaaaaah ", "oaaaaaaaaaaoh", "oaaaaaaaaaaoh", "o aaaaaaaa oh",
       "o aaaaaaaa  h", "  bbbbbbbb  h", "  bbb  bbb   ", "  ooo  ooo   ", "  ddd  ddd   "],
      ["   oooooo    ", "  oooooooo   ", "  oRooooRo  X", "  oooooooo XX", "  oTmmmmTo XX",
       "   oooooo  h ", " aaaaaaaaaah ", "oaaaaaaaaaaoh", "oaaaaaaaaaaoh", "o aaaaaaaa oh",
       "o aaaaaaaa  h", "  bbbbbbbb  h", " bbb    bbb  ", " ooo    ooo  ", " ddd    ddd  "],
    ],
    palette: { o: [[140, 165, 105], 0], R: [[255, 50, 40], 1.3], T: [[235, 230, 210], 0], m: [[60, 20, 20], 0],
               a: [[140, 130, 122], 0], b: [[115, 82, 58], 0], d: [[75, 60, 50], 0],
               X: [[175, 180, 190], 0.1], h: [[115, 80, 48], 0] },
  },
  wraith: {
    name: "wraith", glyph: "W", color: [170, 150, 255], xp: 16, undead: true, depths: [10, 20], weight: 3,
    hp: 20, speed: 3.0, damage: [4, 7], cooldown: 1.2, reach: 1.3, sight: 13,
    w: 0.9, h: 1.7, hover: 0.3, drain: true, darkSight: true, resist: ["frost"],
    frames: [
      ["   ccccc   ", "  ccccccc  ", " cckkkkkcc ", " ckkEkEkkc ", " ckkkkkkkc ", " cckkkkkcc ",
       "ccccccccccc", "c ccccccc c", "w ccccccc w", "  ccccccc  ", "  cccccc   ", "   ccccc   ",
       "   cccc    ", "    cc c   ", "     c     "],
      ["   ccccc   ", "  ccccccc  ", " cckkkkkcc ", " ckkEkEkkc ", " ckkkkkkkc ", " cckkkkkcc ",
       "ccccccccccc", "c ccccccc c", "w ccccccc w", "  ccccccc  ", "  cccccc   ", "   ccccc   ",
       "    cccc   ", "   c cc    ", "      c    "],
    ],
    palette: { c: [[100, 88, 150], 0.45], k: [[10, 8, 15], 0], E: [[180, 255, 255], 1.6], w: [[200, 200, 225], 0.2] },
  },
  troll: {
    name: "troll", glyph: "T", color: [130, 170, 110], xp: 24, depths: [13, 20], weight: 2.5,
    hp: 45, speed: 2.0, damage: [7, 12], cooldown: 1.7, reach: 1.6, sight: 11,
    w: 1.3, h: 2.1, regen: 1, weak: ["fire"], resist: ["frost"],
    frames: [
      ["    tttttt    ", "   tttttttt   ", "   tYttttYt   ", "  ttttnntttt  ", "  ttTmmmmTtt  ",
       "   tttttttt   ", " tttttttttttt ", "tttttttttttttt", "tt tttttttt cc", "tt tttttttt CC",
       "t  llllllll CC", "t  llllllll CC", "   llllllll CC", "   ttt  ttt CC", "   ttt  ttt   ",
       "   ttt  ttt   ", "  tttt  tttt  "],
      ["    tttttt    ", "   tttttttt   ", "   tYttttYt   ", "  ttttnntttt  ", "  ttTmmmmTtt  ",
       "   tttttttt   ", " tttttttttttt ", "tttttttttttttt", "tt tttttttt cc", "tt tttttttt CC",
       "t  llllllll CC", "t  llllllll CC", "   llllllll CC", "  ttt    tttCC", "  ttt    ttt  ",
       "  ttt    ttt  ", " tttt    tttt "],
    ],
    palette: { t: [[125, 155, 110], 0], Y: [[255, 230, 80], 1.2], n: [[80, 100, 70], 0], T: [[230, 225, 200], 0],
               m: [[40, 20, 20], 0], l: [[100, 75, 50], 0], c: [[110, 80, 50], 0], C: [[125, 100, 75], 0] },
  },
  salamander: {
    name: "salamander", glyph: "l", color: [255, 120, 50], xp: 18, depths: [11, 20], weight: 2.5,
    hp: 24, speed: 2.8, damage: [4, 8], cooldown: 1.2, reach: 1.3, sight: 11,
    w: 1.1, h: 0.6, resist: ["fire"], weak: ["frost"], burns: 3,
    frames: [
      ["         oOo  ", "  rrrrrrrrrEr ", "ttrrrRrrRrrrrr", "  f  f   f  f "],
      ["         OoO  ", "  rrrrrrrrrEr ", "ttrrrRrrRrrrrr", "   f  f f  f  "],
    ],
    palette: { r: [[190, 70, 30], 0.35], R: [[255, 150, 50], 0.8], E: [[255, 255, 120], 1.4], o: [[255, 140, 40], 1.2],
               O: [[255, 230, 120], 1.6], t: [[170, 60, 30], 0.25], f: [[110, 40, 20], 0.1] },
  },
  golem: {
    name: "stone golem", glyph: "G", color: [170, 170, 185], xp: 26, depths: [14, 20], weight: 2,
    hp: 40, speed: 1.4, damage: [8, 13], cooldown: 1.9, reach: 1.5, sight: 10,
    w: 1.2, h: 2.2, armour: 3, brittle: true, resist: ["fire", "frost"], weak: ["shock"],
    frames: [
      ["   ssss   ", "  sEssEs  ", "  ssssss  ", " SSSSSSSS ", "SSsSSSSsSS", "Ss SSSS sS", "S  SSSS  S",
       "s  SSSS  s", "   SSSS   ", "  SS  SS  ", "  SS  SS  ", " sss  sss "],
      ["   ssss   ", "  sEssEs  ", "  ssssss  ", " SSSSSSSS ", "SSsSSSSsSS", "Ss SSSS sS", "S  SSSS  S",
       "s  SSSS  s", "   SSSS   ", " SS    SS ", " SS    SS ", "sss    sss"],
    ],
    palette: { s: [[110, 110, 122], 0], S: [[150, 150, 162], 0], E: [[120, 220, 255], 1.3] },
  },
  shade: {
    name: "shade", glyph: "z", color: [150, 130, 210], xp: 4, undead: true,
    hp: 7, speed: 3.2, damage: [2, 4], cooldown: 1.0, reach: 1.2, sight: 14,
    w: 0.7, h: 1.3, hover: 0.25, darkSight: true, fearsLight: true,
    frames: [
      ["  kkk  ", " kEkEk ", " kkkkk ", "kkkkkkk", " kkkkk ", "  kkk  ", "  k k  "],
      ["  kkk  ", " kEkEk ", " kkkkk ", "kkkkkkk", " kkkkk ", "  kkk  ", " k   k "],
    ],
    palette: { k: [[40, 32, 60], 0.2], E: [[200, 180, 255], 1.5] },
  },
  flatqueen: {
    name: "Flat Queen", glyph: "Q", color: [215, 170, 255], xp: 60, guardian: "flatqueen", flat: true,
    hp: 110, speed: 1.6, damage: [3, 6], cooldown: 1.4, reach: 1.3, sight: 16,
    w: 1.2, h: 2.2,
    frames: [
      ["  y y y  ", "  yyyyy  ", "  fFFFf  ", " fFeFeFf ", "  fFFFf  ", "   fff   ", " ppppppp ", "ppPpppPpp",
       "p ppppp p", "  ppppp  ", " ppppppp ", "ppppppppp", "ppppppppp"],
      ["  y y y  ", "  yyyyy  ", "  fFFFf  ", " fFeFeFf ", "  fFFFf  ", "   fff   ", " ppppppp ", "ppPpppPpp",
       "p ppppp p", "  ppppp  ", " ppppppp ", "ppppppppp", " ppppppp "],
    ],
    palette: { y: [[255, 210, 80], 0.8], f: [[140, 110, 200], 0.3], F: [[200, 170, 255], 0.5], e: [[255, 255, 255], 1.4],
               p: [[110, 80, 190], 0.4], P: [[230, 200, 255], 0.8] },
  },
  warden: {
    name: "Gloom Warden", glyph: "W", color: [140, 230, 230], xp: 90, guardian: "warden", undead: true, ghostly: true,
    hp: 150, speed: 1.9, damage: [6, 10], cooldown: 1.6, reach: 1.6, sight: 18, darkSight: true,
    w: 1.6, h: 2.8, hover: 0.4, resist: ["frost", "fire", "shock"],
    frames: [
      ["    hhhhh    ", "   hhhhhhh   ", "  hhkkkkkhh  ", "  hkEkkkEkh  ", "  hkkkkkkkh  ", "  hhkkkkkhh  ",
       " hhhhhhhhhhh ", "hhhhhhhhhhhhL", "h hhhhhhhhh L", "  hhhhhhhhh l", "  hhhhhhhhh l", "   hhhhhhh   ",
       "   hhhhhhh   ", "    hhhhh    ", "    hh hh    ", "     h  h    "],
      ["    hhhhh    ", "   hhhhhhh   ", "  hhkkkkkhh  ", "  hkEkkkEkh  ", "  hkkkkkkkh  ", "  hhkkkkkhh  ",
       " hhhhhhhhhhh ", "hhhhhhhhhhhhL", "h hhhhhhhhh L", "  hhhhhhhhh l", "  hhhhhhhhh l", "   hhhhhhh   ",
       "   hhhhhhh   ", "    hhhhh    ", "   hh  hh    ", "    h    h   "],
    ],
    palette: { h: [[120, 140, 190], 0.6], k: [[5, 5, 15], 0], E: [[150, 255, 255], 1.8], L: [[120, 255, 200], 1.8], l: [[80, 90, 110], 0.2] },
  },
  colossus: {
    name: "Colossus", glyph: "C", color: [255, 190, 90], xp: 120, guardian: "colossus",
    hp: 170, speed: 0, damage: [9, 14], cooldown: 2.6, reach: 3.2, sight: 18, brittle: true, weak: ["shock"],
    w: 2.2, h: 4.2,
    frames: [
      ["     CCC     ", "    CcCcC    ", "   sssssss   ", "  sEsssssEs  ", "  sssssssss  ", " SSSSSSSSSSS ", "SSSSSSSSSSSSS",
       "SS SSSSSSS SS", "SS SSSSSSS SS", "SS SSSSSSS SS", "ss SSSSSSS ss", "ss  SSSSS  ss", "    SS SS    ",
       "    SS SS    ", "   SSS SSS   ", "  ssss ssss  "],
      ["     CCC     ", "    CCCCC    ", "   sssssss   ", "  sEsssssEs  ", "  sssssssss  ", " SSSSSSSSSSS ", "SSSSSSSSSSSSS",
       "SS SSSSSSS SS", "SS SSSSSSS SS", "SS SSSSSSS SS", "ss SSSSSSS ss", "ss  SSSSS  ss", "    SS SS    ",
       "    SS SS    ", "   SSS SSS   ", "  ssss ssss  "],
    ],
    palette: { s: [[105, 100, 95], 0], S: [[140, 135, 125], 0], E: [[255, 120, 60], 1.4], C: [[255, 200, 90], 1.6], c: [[255, 120, 40], 1.2] },
  },
  lich: {
    name: "Lich King", glyph: "L", color: [140, 255, 170], xp: 0, undead: true, boss: true,
    hp: 240, speed: 1.6, damage: [6, 10], cooldown: 1.6, reach: 1.6, sight: 15,
    w: 1.5, h: 2.7, darkSight: true,
    ranged: { range: 14, hold: 5, damage: [5, 9], cooldown: 2.4, speed: 10, gravity: 0, kind: "bolt" },
    frames: [
      ["   y y y     OO ", "   yyyyy    OOOO", "   wwwww     OO ", "  wwwwwww    s  ", "  wEwwwEw    s  ",
       "  wwwdwww    s  ", "   wdwdw     s  ", "  rrrrrrrr   s  ", " rrrrrrrrrr  s  ", "rrrrrrrrrrrrwws ",
       "rr rrrrrrrr  s  ", "rr rrgrrgrr  s  ", "w  rrrrrrrr  s  ", "   rrrrrrrr  s  ", "   rrrgrrrr  s  ",
       "  rrrrrrrrrr s  ", "  rrrrrrrrrr s  ", " rrrrrrrrrrrrs  ", " rrrrrrrrrrrrs  ", "rrrrrrrrrrrrrrs ",
       "rrrrrrrrrrrrrrs "],
      ["   y y y     OO ", "   yyyyy    OPPO", "   wwwww     OO ", "  wwwwwww    s  ", "  wEwwwEw    s  ",
       "  wwwdwww    s  ", "   wdwdw     s  ", "  rrrrrrrr   s  ", " rrrrrrrrrr  s  ", "rrrrrrrrrrrrwws ",
       "rr rrrrrrrr  s  ", "rr rrgrrgrr  s  ", "w  rrrrrrrr  s  ", "   rrrrrrrr  s  ", "   rrrgrrrr  s  ",
       "  rrrrrrrrrr s  ", "  rrrrrrrrrr s  ", " rrrrrrrrrrrrs  ", " rrrrrrrrrrrrs  ", " rrrrrrrrrrrrrs ",
       "rrrrrrrrrrrrrrs "],
    ],
    palette: { y: [[240, 200, 70], 0.6], w: [[225, 220, 205], 0.1], E: [[120, 255, 150], 2.0], d: [[50, 45, 45], 0],
               r: [[110, 50, 140], 0.15], g: [[210, 170, 60], 0.3], s: [[110, 85, 60], 0],
               O: [[120, 255, 160], 1.5], P: [[220, 255, 230], 2.5] },
  },
};

// Elites: a rarer, nastier version of an ordinary monster. They glow with their colour,
// are worth more XP, and always drop something.
export const LEGACY_ELITES = {
  hulking:  { adj: "hulking",  color: [255, 150, 60],  hp: 2,   dmg: 2, size: 1.25, speed: 0.85, info: "twice the health, hits harder" },
  swift:    { adj: "swift",    color: [120, 220, 255], hp: 1.3, speed: 1.6, cd: 0.7, info: "fast on its feet and with its attacks" },
  venomous: { adj: "venomous", color: [150, 235, 80],  hp: 1.4, venom: 4, info: "its attacks poison you" },
  vampiric: { adj: "vampiric", color: [235, 50, 80],   hp: 1.4, drain: true, info: "heals itself by the damage it does you" },
  armoured: { adj: "armoured", color: [195, 205, 225], hp: 1.3, armour: 2, info: "every blow you land does 2 less" },
  warded:   { adj: "warded",   color: [215, 140, 255], hp: 1.4, ward: true, depth: 8, info: "elements don't touch it" },
};
// --- People ----------------------------------------------------------------------------------
// Talkers (talks: true): they have no health, can't be attacked and stand their ground. Two kinds
// are picky about how you look at them (creatures.js): flat beings only exist on the map (in 3D a
// shadow), and ghostly ones are drowned out by torchlight. Statues are carved: the Speaking Door
// and the shrines.
const ROBE = [
  "   hhh   ", " hhhhhhh ", " hsesesh ", " hsssssh ", " hhsmshh ", "  rrrrr  ", " rrrgrrr ", "rrrrrrrrr",
  "s rrrrr s", "  rbbbr  ", "  rrrrr  ", " rrrrrrr ", " rrrrrrr ", " rrrrrrr ", "rrrrrrrrr", "  f   f  ",
];
const PEDDLER = [
  "  hhhhh  ", "hhhhhhhhh", "  seses  ", "  sssss  ", "  dsmsd  ", " rrrrrrpp", "rrrrrrrpp", "srrrrrrpp",
  "s rrbrrpp", "  rrrrrpp", "  rrrrrpp", " rrrrrr p", " rrrrrr  ", " rr   rr ", " rr   rr ", " ff   ff ",
];
const KNIGHT = [
  "  hhhhh  ", " hhhhhhh ", " hsesesh ", " hsssssh ", "  hhhhh  ", " ccrrrcc ", "ccrrrrrcc", "crrxrrrrc",
  "s rrrrr s", "c rbbbr c", "c rrxrr c", "c rr rr c", "  rr rr  ", "  rr rr  ", "  rr rr  ", " ff   ff ",
];
const GHOST = [
  "   hhh   ", " hhhhhhh ", " hsesesh ", " hsssssh ", " hhsmshh ", "  rrrrr  ", " rrrrrrr ", "rrrrrrrrr",
  "s rrrrr s", "  rrrrr  ", "  rrrrr  ", " rrrrrrr ", "  rrrrr  ", "  r rr r ", "   r  r  ", "         ",
];
const STATUE = [
  " sssssss ", "sSSSSSSSs", "sSSSSSSSs", "sSeSSSeSs", "sSSSSSSSs", "sSSSnSSSs", "sSSSnSSSs",
  "sSSSSSSSs", "sSmmmmmSs", "sSSSSSSSs", " sssssss ", "  sssss  ", "  sssss  ", " sssssss ",
];
const SHRINE = [
  "  c   c  ", "  c   c  ", "  f   f  ", " sSSSSSs ", " sSgGgSs ", " sSSSSSs ", "  sSSSs  ", "  sSSSs  ", " sssssss ",
];
const SKIN = [[225, 180, 140], 0], EYES = [[40, 35, 45], 0], MOUTH = [[150, 80, 70], 0], BOOTS = [[85, 65, 50], 0];

export const LEGACY_PEOPLE = {
  maren: { name: "Maren", title: "the priestess", glyph: "@", color: [245, 230, 170], art: ROBE,
    palette: { h: [[235, 230, 215], 0.1], s: SKIN, e: EYES, m: MOUTH, r: [[225, 220, 205], 0.1], g: [[245, 200, 80], 0.5], b: [[215, 175, 60], 0], f: BOOTS } },
  pell: { name: "Pell", title: "the peddler", glyph: "@", color: [240, 190, 90], art: PEDDLER,
    palette: { h: [[120, 80, 45], 0], s: SKIN, e: EYES, m: MOUTH, d: [[170, 125, 80], 0], r: [[80, 125, 75], 0], b: [[60, 45, 30], 0], p: [[150, 105, 60], 0], f: BOOTS } },
  corwin: { name: "Sir Corwin", title: "a wounded knight", glyph: "@", color: [210, 210, 230], art: KNIGHT,
    palette: { h: [[160, 165, 180], 0], s: SKIN, e: EYES, c: [[170, 40, 45], 0], r: [[150, 155, 172], 0], x: [[160, 20, 20], 0], b: [[90, 60, 35], 0], f: BOOTS } },
  brann: { name: "Brann", title: "a ghost", glyph: "@", color: [150, 230, 255], art: GHOST, ghostly: true,
    palette: { h: [[130, 210, 240], 0.8], s: [[170, 230, 250], 0.8], e: [[255, 255, 255], 1.5], m: [[90, 150, 190], 0.6], r: [[110, 190, 230], 0.7], g: [[200, 240, 255], 0.9], b: [[90, 160, 200], 0.6], f: [[90, 160, 200], 0.6] } },
  mira: { name: "Mira", title: "the cartographer", glyph: "@", color: [120, 220, 200], art: ROBE,
    palette: { h: [[175, 85, 45], 0], s: SKIN, e: EYES, m: MOUTH, r: [[60, 135, 125], 0], g: [[230, 200, 120], 0.3], b: [[95, 70, 45], 0], f: BOOTS } },
  rook: { name: "Rook", title: "the bounty hunter", glyph: "@", color: [200, 150, 110], art: ROBE,
    palette: { h: [[60, 55, 52], 0], s: SKIN, e: EYES, m: MOUTH, r: [[100, 75, 52], 0], g: [[190, 190, 200], 0.2], b: [[45, 35, 28], 0], f: BOOTS } },
  lio: { name: "Lio", title: "a prisoner", glyph: "@", color: [210, 180, 140], art: ROBE,
    palette: { h: [[45, 38, 32], 0], s: SKIN, e: EYES, m: MOUTH, r: [[130, 115, 90], 0], g: [[110, 95, 75], 0], b: [[90, 75, 55], 0], f: [[150, 115, 90], 0] } },
  ess: { name: "Ess", title: "a Flatlander", glyph: "@", color: [190, 170, 255], flat: true },
  tee: { name: "Tee", title: "a young Flatlander", glyph: "@", color: [255, 170, 230], flat: true },
  door: { name: "The Speaking Door", title: "", glyph: "Ω", color: [190, 200, 215], art: STATUE, statue: true,
    palette: { s: [[120, 120, 132], 0], S: [[160, 160, 172], 0], e: [[120, 220, 255], 1.3], n: [[110, 110, 120], 0], m: [[60, 60, 70], 0] } },
  shrine: { name: "Shrine of the Builders", title: "", glyph: "†", color: [255, 215, 120], art: SHRINE, statue: true, w: 0.9, h: 1.0,
    palette: { c: [[255, 200, 90], 1.6], f: [[60, 50, 40], 0], s: [[120, 115, 110], 0], S: [[165, 160, 150], 0], g: [[200, 160, 70], 0.4], G: [[255, 220, 120], 0.8] } },
};
for (const t of Object.values(LEGACY_PEOPLE)) t.talks = true;
registerCreatures(LEGACY_MONSTERS);
registerCreatures(LEGACY_PEOPLE);
registerElites(LEGACY_ELITES);
