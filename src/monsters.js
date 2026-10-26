// Monsters: what they are, how they look in 3D, how they think and fight.
// They live on the tile grid: each one stands on a tile or is stepping to a neighbour.
import { lineOfSight } from "./raycast.js";
import { flowField, canWalk, DIRS8, UNREACHABLE, MONSTER_STEP_UP, MONSTER_DROP } from "./pathing.js";
import { makeItem, randomPotion, randomScroll, randomEquipment, randomJewel, awayFromWalls, strNeeded, WEAPONS, ELEMENTS } from "./items.js";
import { guardianThink, colossusCore, fearLight } from "./guardians.js";
import { B, FLOOR_Z } from "./world.js";
import { EYE, HEIGHT, RADIUS, moveAxis, attackTime, armourValue, bonus, weaponReach } from "./player.js";
import { gainXp } from "./leveling.js";
import { sfx } from "./sfx.js";
import { attr, maxHp } from "./stats.js";
import { wielded } from "./body.js";
import { addStatus, removeStatus, capStatus, hasStatus, statusFlag, tickStatuses, cooldownLeft, startCooldown, setStatusHarm, STATUS_DEFS } from "./status.js";
import { RULES } from "./rules.js";

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
export const MONSTER_TYPES = {
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
    name: "goblin archer", glyph: "a", color: [170, 210, 90], xp: 8, depths: [4, 14], weight: 2.5,
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
    name: "orc", glyph: "o", color: [150, 170, 100], xp: 14, depths: [7, 19], weight: 3.5,
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
export const ELITES = {
  hulking:  { adj: "hulking",  color: [255, 150, 60],  hp: 2,   dmg: 2, size: 1.25, speed: 0.85, info: "twice the health, hits harder" },
  swift:    { adj: "swift",    color: [120, 220, 255], hp: 1.3, speed: 1.6, cd: 0.7, info: "fast on its feet and with its attacks" },
  venomous: { adj: "venomous", color: [150, 235, 80],  hp: 1.4, venom: 4, info: "its attacks poison you" },
  vampiric: { adj: "vampiric", color: [235, 50, 80],   hp: 1.4, drain: true, info: "heals itself by the damage it does you" },
  armoured: { adj: "armoured", color: [195, 205, 225], hp: 1.3, armour: 2, info: "every blow you land does 2 less" },
  warded:   { adj: "warded",   color: [215, 140, 255], hp: 1.4, ward: true, depth: 8, info: "elements don't touch it" },
};

// Flat beings can only be touched while you look at the world flat, on the map (unless the
// Flat Queen has risen out of the plane: then only in 3D). Ghostly things only with your torch
// out. `blade`: your own weapon (the Edge of the Plane cuts flat things in 3D too).
export function touchable(game, m, blade = false) {
  const t = MONSTER_TYPES[m.type];
  if (t.ghostly && game.player.torch) return false;
  if (m.risen) return game.view !== "map";
  if (!t.flat || game.view === "map") return true;
  return blade && bonus(game.player, "cutsFlat") > 0;
}
export const isFlat = (m) => MONSTER_TYPES[m.type].flat && !m.risen;

// How an element fares against a monster: "resist", "weak" or null.
export function elementVs(m, el) {
  if (!el) return null;
  const t = MONSTER_TYPES[m.type];
  if (m.ward || t.resist?.includes(el)) return "resist";
  if (t.weak?.includes(el)) return "weak";
  return null;
}
// For the map's inspect line: "weak to fire, resists frost".
export function resistText(m) {
  const t = MONSTER_TYPES[m.type], parts = [];
  if (t.weak?.length) parts.push(`weak to ${t.weak.join(" and ")}`);
  if (m.ward) parts.push("elements don't touch it");
  else if (t.resist?.length) parts.push(`resists ${t.resist.join(" and ")}`);
  if (t.brittle) parts.push("brittle");
  return parts.join(", ");
}

// Which monster turns up at this depth (rand: a 0–1 random function).
export function pickMonsterType(rand, depth) {
  const weights = Object.entries(MONSTER_TYPES).map(([type, t]) => {
    if (!t.depths || depth < t.depths[0] || depth > t.depths[1]) return [type, 0];
    // Fade in over the first floor of its range and out over the last.
    return [type, t.weight * Math.min(1, (depth - t.depths[0] + 1) / 2, (t.depths[1] - depth + 1) / 2)];
  });
  let pick = rand() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [type, w] of weights) if ((pick -= w) < 0) return type;
  return "goblin";
}

// Elites start on floor 3 and get commoner deeper: about 1 in 25 there, 1 in 5 by floor 18.
export function rollElite(rand, depth) {
  if (depth < 3 || rand() >= Math.min(0.22, 0.012 * depth)) return null;
  const keys = Object.keys(ELITES).filter((k) => depth >= (ELITES[k].depth || 0));
  return keys[Math.floor(rand() * keys.length)];
}

let nextId = 1;
// Tougher at higher levels: +6% health per level, and +1 damage every four levels.
// z is the ground it stands on. `rand` draws its looks (when it next blinks, flaps, shoots):
// generators pass their own cosmetic stream so the layout's random numbers stay untouched, and a
// level generates the same whatever else has happened; at runtime it's Math.random.
export function spawnMonster(type, tx, ty, z, state = "idle", depth = 1, elite = null, rand = Math.random) {
  const t = MONSTER_TYPES[type], e = elite ? ELITES[elite] : null;
  const hp = Math.round(t.hp * (t.boss || t.guardian ? 1 : 1 + 0.06 * (depth - 1)) * (e?.hp || 1));
  const size = e?.size || 1;
  return {
    id: nextId++, type, elite, guardian: t.guardian || null,
    name: e ? `${e.adj} ${t.name}` : t.name, glyph: t.glyph, color: e ? e.color : t.color,
    w: t.w * size, h: t.h * size,
    hp, maxHp: hp,
    bonus: Math.floor((depth - 1) / 4) + (e?.dmg || 0),
    speedMul: e?.speed || 1, cdMul: e?.cd || 1, armour: (e?.armour || 0) + (t.armour || 0), ward: !!e?.ward,
    venom: Math.max(t.venom || 0, e?.venom || 0), drain: !!(t.drain || e?.drain), burns: t.burns || 0,
    xp: Math.round(t.xp * (1 + 0.1 * (depth - 1)) * (e ? 2.5 : 1)),   // what killing it is worth
    status: {}, cooldowns: {},             // burning, chilled, stunned, blinded, poisoned, hasted… (status.js)
    regenAcc: 0, shot: 1 + rand(), phase: 0, sees: false,
    tx, ty, nx: tx, ny: ty, p: 0,          // current tile, next tile, progress of the step
    x: tx + 0.5, y: ty + 0.5, z: z + (t.hover || 0),
    state,                                  // "idle" | "wander" | "chase"
    cd: 0, hurt: 0, anim: rand() * 10,
    think: rand() * 0.25, lost: 0, pause: rand() * 2,
  };
}

export function monsterSprite(m, zone) {
  const t = MONSTER_TYPES[m.type];
  const moving = m.nx !== m.tx || m.ny !== m.ty;
  // Flyers flap all the time; the boss's orb pulses.
  const frame = moving || t.hover || t.boss ? Math.floor(m.anim * (t.hover ? 9 : 6)) % 2 : 0;
  // Wading: sink it a little and the water surface hides its feet (depth buffer does the rest).
  const wet = !t.hover && zone.get(Math.floor(m.x), Math.floor(m.y), FLOOR_Z - 1) === B.WATER_SHALLOW;
  const bob = t.hover ? Math.sin(m.anim * 3) * 0.08 : 0;
  // Burning monsters flicker orange; chilled ones go pale blue.
  const flicker = 0.8 + 0.2 * Math.sin(m.anim * 25);
  const has = (id) => hasStatus(m, id);
  const tint = has("burning") ? [1.5, 0.9, 0.5] : has("chilled") ? [0.7, 1.0, 1.6] : has("stunned") ? [1.2, 0.7, 1.6] :
               has("poisoned") ? [0.7, 1.5, 0.6] : has("blinded") ? [0.5, 0.5, 0.6] : null;
  let emit = has("burning") ? [0.9 * flicker, 0.4 * flicker, 0.1] : null;   // flames light it up even in the dark
  if (m.elite) {   // elites glow with a slow pulse of their colour
    const k = (0.18 + 0.08 * Math.sin(m.anim * 4)) / 255, c = m.color;
    emit = [(emit?.[0] || 0) + c[0] * k, (emit?.[1] || 0) + c[1] * k, (emit?.[2] || 0) + c[2] * k];
  }
  return { x: m.x, y: m.y, z: m.z - (wet ? 0.3 : 0) + bob, w: m.w, h: m.h, art: t.frames[frame], palette: t.palette,
           flash: m.hurt > 0, tint, emit, monster: m };
}

// The monster standing on (or stepping into) tile (x, y), if any.
export function monsterAt(zone, x, y) {
  return zone.monsters.find((m) =>
    (m.tx === x && m.ty === y) || (m.nx === x && m.ny === y) ||
    (Math.floor(m.x) === x && Math.floor(m.y) === y)) || null;
}

// ---------------------------------------------------------------------------
// Advance every monster by dt seconds. On the map only monsters within `radius`
// tiles (or already hunting you) act; the rest wait until you come closer.
export function updateMonsters(game, dt, radius = Infinity) {
  const { zone, player } = game;
  const { w, stand } = zone;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);

  // Re-plan routes when the player reaches a new tile we can stand on, or the level changed.
  const pTileOk = ptx >= 0 && pty >= 0 && ptx < w && pty < zone.d && stand[ptx + pty * w] >= 0;
  if (!game.flow || game.flowVersion !== zone.navVersion ||
      (pTileOk && (ptx !== game.flowX || pty !== game.flowY))) {
    game.flow = flowField(zone, ptx, pty);
    game.flowX = ptx; game.flowY = pty; game.flowVersion = zone.navVersion;
  }

  const occ = new Int32Array(w * zone.d);
  for (const m of zone.monsters) { occ[m.tx + m.ty * w] = m.id; occ[m.nx + m.ny * w] = m.id; }
  for (const n of zone.npcs) occ[n.tx + n.ty * w] = -1;   // people stand their ground

  for (const m of [...zone.monsters]) {
    if (!zone.monsters.includes(m)) continue;   // killed earlier this update (lightning, a split…)
    const t = MONSTER_TYPES[m.type];
    if (m.state !== "chase" && Math.hypot(m.x - player.x, m.y - player.y) > radius) continue;
    const pace = (hasStatus(m, "chilled") ? 0.5 : 1) * (hasStatus(m, "hasted") ? RULES.haste : 1);
    m.anim += dt;
    m.hurt = Math.max(0, m.hurt - dt);
    m.cd = Math.max(0, m.cd - dt * pace);   // chilled: half as often; hasted: faster
    m.shot -= dt * pace;

    // The ground vanished (a trap opened): it falls to the floor below.
    if (stand[m.tx + m.ty * w] < 0) { killMonster(game, m, `The ${m.name} falls into the dark.`, false, false); continue; }

    // Its statuses: on fire or poisoned, 1 damage every half second (status.js; the kill goes through
    // the harm handler below); chill, blindness, haste and stuns run down.
    const regenOk = !statusFlag(m, "noRegen");   // trolls knit back together — unless they're burning
    tickStatuses(game, m, dt);
    if (!zone.monsters.includes(m)) continue;
    if (regenOk && t.regen && m.hp < m.maxHp) {
      m.regenAcc += t.regen * dt;
      if (m.regenAcc >= 1) { m.regenAcc -= 1; m.hp++; }
    }
    if (t.boss) { removeStatus(game, m, "blinded"); capStatus(m, "stunned", 1.5); bossPhase(game, m, occ); }   // shrugs most of it off
    if (t.guardian) { removeStatus(game, m, "blinded"); capStatus(m, "stunned", 1); if (guardianThink(game, m, dt, occ)) continue; }
    if (t.fearsLight && fearLight(game, m, dt)) continue;
    // Stunned (or paralysed): it can't do anything at all.
    if (statusFlag(m, "noAct")) continue;

    m.think -= dt;
    if (m.think <= 0) { m.think = 0.25; perceive(game, m, t); }

    const moving = m.nx !== m.tx || m.ny !== m.ty;
    const dx = player.x - m.x, dy = player.y - m.y, dz = player.z - m.z;
    const flat = Math.hypot(dx, dy);
    const inReach = flat <= t.reach + RADIUS && dz > -1.2 && dz < 1.3;
    const r = t.ranged;

    if (moving) {
      const len = m.nx !== m.tx && m.ny !== m.ty ? Math.SQRT2 : 1;
      const wet = !t.hover && (zone.get(m.tx, m.ty, FLOOR_Z - 1) === B.WATER_SHALLOW || zone.get(m.nx, m.ny, FLOOR_Z - 1) === B.WATER_SHALLOW);
      m.p += (t.speed * m.speedMul * (m.state === "chase" ? 1 : 0.45) * (wet ? 0.6 : 1) * pace * dt) / len;
      if (m.p >= 1) {
        occ[m.tx + m.ty * w] = 0;
        m.tx = m.nx; m.ty = m.ny; m.p = 0;
      }
    } else if (m.state === "chase" && inReach) {
      if (m.cd <= 0 && lineOfSight(zone, m.x, m.y, m.z + m.h * 0.7, player.x, player.y, player.z + EYE * 0.6)) {
        m.cd = t.cooldown * m.cdMul;
        const dmg = t.damage[0] + Math.floor(Math.random() * (t.damage[1] - t.damage[0] + 1)) + (m.bonus || 0);
        if (isFlat(m) && game.view !== "map") {   // bitten by something you can't see
          hitPlayer(game, m, dmg, "something flat", "a bite from below");
          game.hint?.("flat", "Something bit you from the floor, and there's nobody there: only a moving shadow. A flat being! Look at the world from above (Tab) to fight it.");
        } else hitPlayer(game, m, dmg, `the ${m.name}`, `the ${m.name}'s blow`);
      }
    } else if (m.state === "chase" && r && m.sees && flat <= r.range && flat > 1.6) {
      // In sight and in range: shoot, and stay back once close enough.
      if (m.shot <= 0) {
        m.shot = r.cooldown * m.cdMul * (t.boss && m.phase >= 2 ? 0.6 : 1);
        shoot(game, m, r);
      }
      if (flat > r.hold) chooseStep(game, m, t, occ, ptx, pty);
    } else if (t.speed === 0) {
      // Rooted to the spot (the Colossus): it only turns to face you.
    } else if (m.state === "chase") {
      chooseStep(game, m, t, occ, ptx, pty);
    } else if (m.state === "wander") {
      m.pause -= dt;
      if (m.pause <= 0) { m.pause = 0.5 + Math.random() * 2.5; chooseStep(game, m, t, occ, ptx, pty); }
    }

    // Position: glide between tile centres; ease the height when stepping up or down.
    const za = stand[m.tx + m.ty * w], zb = stand[m.nx + m.ny * w];
    const s = m.p * m.p * (3 - 2 * m.p);
    m.x = m.tx + 0.5 + (m.nx - m.tx) * m.p;
    m.y = m.ty + 0.5 + (m.ny - m.ty) * m.p;
    m.z = (zb < 0 ? za : za + (zb - za) * s) + (t.hover || 0);
  }
}

// A blow (or arrow, or bolt) lands on you. Armour soaks up part of it; cursed armour
// below zero lets more through. Venom poisons you, and a draining monster heals.
export function hitPlayer(game, m, dmg, source, blocked, ranged = false) {
  const p = game.player;
  if (statusFlag(p, "untouchable")) { game.log(`The blow passes through you: you're still half turned out of the world.`, [200, 230, 255]); return; }
  // The warding amulet: the first blow misses, then not again for RULES.cooldown.firstBlock seconds
  // (it was once per floor; TECH_DESIGN §2.4).
  if (bonus(p, "firstBlock") > 0 && !(cooldownLeft(p, "firstBlock") > 0)) {
    startCooldown(p, "firstBlock", RULES.cooldown.firstBlock);
    game.log(`Your amulet flares, and ${blocked} misses you!`, [220, 225, 240]);
    sfx("block", { at: m });
    return;
  }
  const arm = armourValue(p);
  dmg += arm >= 0 ? -Math.floor(Math.random() * (arm + 1)) : Math.floor(Math.random() * (-arm + 1));
  if (ranged) dmg -= bonus(p, "ward");
  if (dmg <= 0) { game.log(`Your armour turns ${blocked}.`, [170, 180, 200]); sfx("block", { at: m }); return; }
  game.hurtPlayer(dmg, source);
  // Thorns: whoever hit you (up close) gets hurt back.
  const thorns = bonus(p, "thorns");
  if (thorns > 0 && !ranged && m.hp > 0 && game.zone.monsters.includes(m)) {
    hurtMonster(game, m, thorns, `${thorns}`, [150, 200, 90]);
    if (m.hp <= 0) killMonster(game, m, `The ${m.name} dies on your thorns.`);
  }
  if (m.burns) {   // a salamander's bite sets you smouldering: 1 damage a second
    // The legacy set keeps the parent's bite exactly: poison, the same stream as venom (Thick blood halves
    // it, regeneration goes on, the cause is poison). Otherwise it's burning at half rate.
    const legacy = RULES.stats === "legacy", id = legacy ? "poisoned" : "burning";
    if (!hasStatus(p, id)) game.log(`The ${m.name}'s bite burns!`, [255, 140, 60]);
    addStatus(game, p, id, legacy ? { t: m.burns, stack: "max" } : { t: m.burns, mag: 0.5, stack: "max" });
  }
  if (m.venom) {
    if (!hasStatus(p, "poisoned")) game.log(`The ${m.name}'s venom burns in your veins!`, [150, 210, 80]);
    addStatus(game, p, "poisoned", { t: m.venom, stack: "max" });
  }
  if (m.drain && m.hp > 0 && m.hp < m.maxHp) {
    m.hp = Math.min(m.maxHp, m.hp + dmg);
    game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.15, text: `+${dmg}`, color: [235, 60, 90], time: game.time });
  }
}

// Fire an arrow or a bolt at the player. Arrows arc (aimed to allow for the drop) and
// scatter a little, so in 3D you can sidestep them.
function shoot(game, m, r) {
  const p = game.player;
  const sx = m.x, sy = m.y, sz = m.z + m.h * 0.7;
  const dx = p.x - sx, dy = p.y - sy, dz = p.z + 1.1 - sz;
  const flat = Math.hypot(dx, dy), time = Math.hypot(flat, dz) / r.speed;
  const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.08;
  game.zone.projectiles.push({
    kind: r.kind, hostile: true, from: m,
    dmg: r.damage[0] + Math.floor(Math.random() * (r.damage[1] - r.damage[0] + 1)) + (m.bonus || 0),
    x: sx, y: sy, z: sz,
    vx: (Math.cos(ang) * flat) / time, vy: (Math.sin(ang) * flat) / time, vz: dz / time + 0.5 * r.gravity * time,
    g: r.gravity, life: 3, spin: 0,
  });
}

// The Lich King's fight has three phases: at two thirds of its health it raises
// skeletons, at one third wraiths, and from then on it casts faster.
function bossPhase(game, m, occ) {
  const next = m.phase === 0 && m.hp <= m.maxHp * 0.66 ? ["skeleton", 3] : m.phase === 1 && m.hp <= m.maxHp * 0.33 ? ["wraith", 2] : null;
  if (!next) return;
  m.phase++;
  const [type, n] = next;
  const { zone } = game, { w, stand } = zone;
  const spots = [];
  for (let oy = -3; oy <= 3; oy++)
    for (let ox = -3; ox <= 3; ox++) {
      const x = m.tx + ox, y = m.ty + oy;
      if (Math.max(Math.abs(ox), Math.abs(oy)) < 2 || x < 0 || y < 0 || x >= w || y >= zone.d) continue;
      if (stand[x + y * w] >= 0 && !occ[x + y * w]) spots.push([x, y]);
    }
  for (let k = 0; k < n && spots.length; k++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const o = spawnMonster(type, x, y, stand[x + y * w], "chase", zone.level);
    zone.monsters.push(o);
    occ[x + y * w] = o.id;
  }
  game.log(m.phase === 1 ? "The Lich King raises its staff. The dead rise around it!" :
                           "The Lich King shrieks, and wraiths pour out of the walls!", [140, 255, 170]);
}

// Can it see the player? Torchlight makes you easier to spot; sprinting is loud.
function perceive(game, m, t) {
  const { zone, player } = game;
  if (hasStatus(m, "blinded")) {   // blinded (darkness or shadows splashed on it): it loses track of you
    if (m.state === "chase") m.state = "wander";
    m.sees = false;
    return;
  }
  const dist = Math.hypot(player.x - m.x, player.y - m.y);
  const hidden = statusFlag(player, "hidden");   // potion of shadows
  const range = t.sight * (player.torch || t.darkSight ? 1 : 0.55) * (hidden ? 0.35 : 1) *
    (hasStatus(player, "darkened") && !t.darkSight ? 0.7 : 1) * Math.max(0.3, 1 - bonus(player, "stealth"));
  let sees = dist < range &&
    lineOfSight(zone, m.x, m.y, m.z + m.h * 0.8, player.x, player.y, player.z + EYE);
  m.sees = sees;
  if (!sees && !hidden && player.sprinting && dist < 6) sees = true;
  if (sees) {
    if (m.state !== "chase" && dist < 14) {
      if (t.boss) game.log("The Lich King rises from its throne. \"Another one comes to die.\"", t.color);
      else if (t.guardian) { /* guardians.js announces itself */ }
      else game.log(`A${/^[aeiou]/.test(m.name) ? "n" : ""} ${m.name} notices you!`, m.color);
    }
    m.state = "chase";
    m.lost = 0;
  } else if (m.state === "chase" && !t.boss && !t.guardian) {   // bosses never forget you
    m.lost += 0.25;
    if (m.lost > 8) m.state = "wander";
  }
}

// Pick the next tile: downhill on the flow field when chasing, a random neighbour when
// wandering (or now and then for erratic flyers like bats).
function chooseStep(game, m, t, occ, ptx, pty) {
  const { zone, player, flow } = game;
  const { w, d, stand } = zone;
  const here = m.tx + m.ty * w;
  const chasing = m.state === "chase" && !(t.erratic && Math.random() < t.erratic);
  const hereDist = Math.hypot(m.tx + 0.5 - player.x, m.ty + 0.5 - player.y);
  let best = -1, bestScore = Infinity;
  for (const [ox, oy] of DIRS8) {
    const bx = m.tx + ox, by = m.ty + oy;
    if (bx < 0 || by < 0 || bx >= w || by >= d) continue;
    const bi = bx + by * w;
    if ((bx === ptx && by === pty) || (occ[bi] && occ[bi] !== m.id)) continue;
    if (!canWalk(stand, w, m.tx, m.ty, bx, by, MONSTER_STEP_UP, MONSTER_DROP)) continue;
    let score;
    if (!chasing) score = Math.random();
    else if (flow[here] !== UNREACHABLE) {
      if (flow[bi] >= flow[here]) continue;
      score = flow[bi] + (ox && oy ? 0.4 : 0);
    } else {
      // The player is somewhere we can't walk to (a ledge?): just get as close as possible.
      score = Math.hypot(bx + 0.5 - player.x, by + 0.5 - player.y);
      if (score >= hereDist) continue;
    }
    if (score < bestScore) { bestScore = score; best = bi; }
  }
  if (best >= 0) {
    m.nx = best % w; m.ny = (best - m.nx) / w; m.p = 0;
    occ[best] = m.id;
  }
}

// What an elite leaves behind: always something, sometimes gear, a ring or an amulet.
function eliteLoot(depth, luck = 0) {
  const r = Math.random();
  return r < 0.35 ? randomPotion() : r < 0.55 ? randomScroll() : r < 0.68 && depth >= 3 ? randomJewel(Math.random, depth + 1, 0.1 + luck)
    : randomEquipment(Math.random, depth + 1, 0.2 + luck);
}

// byPlayer: you killed it (by blade, fire or lightning), so you get its XP.
// How a status hurts (status.js): you through hurtPlayer (quietly, as poison always did); a creature
// flashes, and dies with the status's own line.
setStatusHarm((game, e, n, id) => {
  const def = STATUS_DEFS[id];
  if (e === game.player) { game.hurtPlayer(n, def?.cause || id, true); return; }
  e.hp -= n;
  e.hurt = 0.1;
  if (e.hp <= 0 && game.zone?.monsters.includes(e)) killMonster(game, e, def?.killed?.(e) || `The ${e.name} dies.`);
});

function killMonster(game, m, message, dropLoot = true, byPlayer = true) {
  const { zone } = game;
  const t = MONSTER_TYPES[m.type];
  zone.monsters = zone.monsters.filter((o) => o !== m);
  zone.sightings.delete(m.id);
  if (Math.hypot(game.player.x - m.x, game.player.y - m.y) < 14) { game.log(message, [230, 230, 230]); sfx("kill", { at: m }); }
  if (byPlayer && m.xp > 0) {
    game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.5, text: `+${m.xp} XP`, color: [160, 230, 255], time: game.time });
    gainXp(game, m.xp);
  }
  const ground = zone.stand[m.tx + m.ty * zone.w];
  const p = game.player;
  if (byPlayer) {
    const heal = bonus(p, "killHeal") + (t.undead ? bonus(p, "undeadHeal") : 0);
    if (heal > 0 && p.hp < maxHp(p)) p.hp = Math.min(maxHp(p), p.hp + heal);
    else if (heal < 0) game.hurtPlayer(-heal, "your cursed ring", true);
  }
  if (t.guardian) game.onGuardianDies?.(m);
  else if (dropLoot && ground >= 0) {
    // Lucky: twice as likely to drop something.
    const luck = p.perks.has("lucky") ? 2 : 1;
    if (m.elite || Math.random() < 0.25 * luck)
      zone.items.push(makeItem({ kind: "cash", amount: Math.round((1 + Math.floor(Math.random() * (2 + zone.level * 0.6))) * (m.elite ? 1.5 : 1)) }, ...awayFromWalls(zone, m.x + 0.15, m.y + 0.1, ground), ground));
    const [ix, iy] = awayFromWalls(zone, m.x, m.y, ground);
    if (m.elite) zone.items.push(makeItem(eliteLoot(zone.level, luck > 1 ? 0.15 : 0), ix, iy, ground));
    else if (Math.random() < 0.25 * luck) {
      const r = Math.random();
      zone.items.push(makeItem(r < 0.5 ? randomPotion() : r < 0.8 ? randomScroll() : { kind: "bomb", count: 1 }, ix, iy, ground));
    }
  }
  // A slime splits in two (into the free tiles around it).
  if (t.splits && dropLoot) {
    const spots = [[0, 0], ...DIRS8].map(([ox, oy]) => [m.tx + ox, m.ty + oy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < zone.w && y < zone.d && zone.stand[x + y * zone.w] >= 0 &&
        !zone.monsters.some((o) => o.tx === x && o.ty === y));
    for (const [x, y] of spots.slice(0, 2)) zone.monsters.push(spawnMonster(t.splits, x, y, zone.stand[x + y * zone.w], "chase", zone.level));
    if (spots.length) game.log(`The ${m.name} splits in two!`, m.color);
  }
  if (m.bounty) game.questEvent?.("bounty", m);
  if (t.boss) game.win();
}

// Monsters are solid: push the player out of any they overlap.
export function pushPlayerOut(game) {
  const { zone, player: p } = game;
  for (const m of zone.monsters) {
    if (isFlat(m) || (MONSTER_TYPES[m.type].ghostly && p.torch) || p.z > m.z + m.h || p.z + HEIGHT < m.z) continue;   // you walk right over flat things
    const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy);
    const minDist = RADIUS + m.w * 0.4;
    if (dist < minDist && dist > 1e-4) {
      moveAxis(p, zone, "x", (dx / dist) * (minDist - dist));
      moveAxis(p, zone, "y", (dy / dist) * (minDist - dist));
    }
  }
}

// 3D: swing at whatever is in front of you.
export function playerAttack(game) {
  const p = game.player;
  if (p.attackCd > 0 || statusFlag(p, "noAct")) return;
  p.attackCd = attackTime(p);
  p.swingTime = p.attackCd * 0.78;   // the animation fills most of the time between swings
  p.swing = p.swingTime;
  const reach = weaponReach(p);
  sfx("swing", { heavy: WEAPONS[wielded(p).id].swing >= 0.6 });
  const cp = Math.cos(p.pitch);
  const fx = cp * Math.cos(p.yaw), fy = cp * Math.sin(p.yaw), fz = Math.sin(p.pitch);
  const ex = p.x, ey = p.y, ez = p.z + EYE;
  let best = null, bestDist = Infinity;
  for (const m of game.zone.monsters) {
    if (!touchable(game, m, true)) continue;   // a flat being: your blade passes through its shadow
    const cz = m.z + m.h * 0.5;
    const vx = m.x - ex, vy = m.y - ey, vz = cz - ez;
    const dist = Math.hypot(vx, vy, vz);
    if (dist > reach + m.w * 0.5) continue;
    if ((vx * fx + vy * fy + vz * fz) / dist < (dist < 1.2 ? 0.2 : 0.7)) continue;
    if (!lineOfSight(game.zone, ex, ey, ez, m.x, m.y, cz)) continue;
    if (dist < bestDist) { bestDist = dist; best = m; }
  }
  if (best) attackMonster(game, best);
}

// Armoured elites shrug off part of every hit (never all of it).
const soak = (m, dmg, pierce = false) => Math.max(1, dmg - (pierce ? 0 : m.armour || 0));

// Hit a monster (3D swing or bumping into it on the map).
// Damage: your weapon's roll, + its enchantment (cursed weapons hit softer), + 1 per 2 points
// of strength beyond what it needs; then everything your gear and perks add (crits, crushing,
// executioner…). Then its element, if it has one, unless the monster resists it:
//   fire – sets it burning · frost – slows it · storm – lightning arcs to another monster
//   holy – double damage against the undead
export function attackMonster(game, m) {
  const t = MONSTER_TYPES[m.type];
  const p = game.player, weapon = wielded(p), w = WEAPONS[weapon.id];
  if (!touchable(game, m, true)) {   // on the map, bumping into something that isn't in the plane
    game.log(m.risen ? `Your blow passes under the ${m.name}: she has risen out of the plane! Turn the world (Tab) to strike her.`
                     : t.ghostly ? `Your blow passes through empty air. Something cold is here, but your torchlight hides it.`
                     : `You can't touch the ${m.name} from here.`, [200, 190, 255]);
    return;
  }
  const crit = Math.random() < 0.12 + bonus(p, "crit");
  const hi = w.dmg[1] + bonus(p, "maxDmg");
  const roll = w.dmg[0] + Math.floor(Math.random() * (hi - w.dmg[0] + 1));
  let dmg = Math.max(1, roll + weapon.ench + Math.max(0, Math.floor((attr(p, "str") - strNeeded(weapon)) / 2)));
  const el = weapon.element, vs = elementVs(m, el);
  if (el === "holy" && t.undead && vs !== "resist") dmg *= 2;
  if (vs === "weak") dmg = Math.ceil(dmg * 1.5);
  if (vs === "resist") dmg = Math.max(1, Math.round(dmg * 0.6));
  if (t.brittle && bonus(p, "crush") > 0) dmg *= 2;
  if (hasStatus(m, "burning") && bonus(p, "burnBonus") > 0) dmg = Math.ceil(dmg * (1 + bonus(p, "burnBonus")));
  if (m.hp < m.maxHp * 0.25 && p.perks.has("executioner")) dmg = Math.ceil(dmg * 1.5);
  if ((m.elite || t.guardian || t.boss) && p.perks.has("giantSlayer")) dmg = Math.ceil(dmg * 1.3);
  const sunder = crit && bonus(p, "sunder") > 0;
  if (crit) dmg *= sunder ? 3 : 2;
  if (isFlat(m) && game.view !== "map") dmg = Math.max(1, Math.floor(dmg / 2));   // the Edge of the Plane, in 3D
  // The Colossus: only its glowing core (up on its head) really feels a blow.
  const core = t.guardian === "colossus" ? colossusCore(game, m) : true;
  if (!core) dmg = 1;
  dmg = soak(m, dmg, sunder);
  const color = el ? ELEMENTS[el].color : crit ? [255, 220, 80] : [255, 255, 255];
  hurtMonster(game, m, dmg, crit ? `${dmg}!` : `${dmg}`, color);
  game.effects.push({ kind: "spark", time: game.time, crit, color });
  if (bonus(p, "leech") > 0 && p.hp < maxHp(p) && Math.random() < bonus(p, "leech")) p.hp++;

  if (m.hp <= 0) killMonster(game, m, `You slay the ${m.name}.`);
  else {
    if (!core) game.log(`Your blow glances off its stone legs. Its core glows far above you: get up high!`, [255, 200, 120]);
    else game.log(`You ${crit ? "smash" : "hit"} the ${m.name} (${dmg}).${vs === "weak" ? " It's weak to that!" : ""}`, [230, 230, 230]);
    if (vs === "resist") game.log(`The ${m.name} shrugs off the ${{ fire: "flames", frost: "frost", shock: "lightning", holy: "light" }[el]}.`, [170, 170, 190]);
    else {
      if (el === "fire") { if (!hasStatus(m, "burning")) game.log(`The ${m.name} catches fire!`, ELEMENTS.fire.color); addStatus(game, m, "burning", { t: 3, stack: "refresh" }); }
      if (el === "frost") addStatus(game, m, "chilled", { t: 3, stack: "refresh" });
    }
    const poison = bonus(p, "poisonHit");
    if (poison > 0) addStatus(game, m, "poisoned", { t: poison, mag: 2, stack: "max" });
  }
  if (el === "shock" && vs !== "resist") {
    // Lightning jumps to the nearest other monster within 3 tiles that you can see.
    const other = game.zone.monsters
      .filter((o) => o !== m && touchable(game, o) && elementVs(o, "shock") !== "resist" && Math.hypot(o.x - m.x, o.y - m.y) < 3 &&
        lineOfSight(game.zone, m.x, m.y, m.z + 0.5, o.x, o.y, o.z + 0.5))
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    if (other) {
      const arc = soak(other, Math.max(1, Math.ceil(dmg / 2)));
      hurtMonster(game, other, arc, `${arc}`, ELEMENTS.shock.color);
      game.log(`Lightning arcs to the ${other.name} (${arc}).`, ELEMENTS.shock.color);
      if (other.hp <= 0) killMonster(game, other, `The ${other.name} is struck down.`);
    }
  }
}

// Damage from something other than your weapon (a thrown knife). Kills give XP as usual.
// Returns the damage actually done (after an armoured elite's soak).
export function damageMonster(game, m, dmg, color, deathText) {
  if (!touchable(game, m)) return 0;
  if (MONSTER_TYPES[m.type].guardian === "colossus" && !colossusCore(game, m)) dmg = Math.min(dmg, 2);
  dmg = soak(m, dmg);
  hurtMonster(game, m, dmg, `${dmg}`, color);
  if (m.hp <= 0) killMonster(game, m, deathText || `You slay the ${m.name}.`);
  return dmg;
}

function hurtMonster(game, m, dmg, label, color) {
  sfx("hit", { at: m, crit: label.endsWith("!") });
  m.hp -= dmg;
  m.hurt = 0.2;
  m.cd = Math.max(m.cd, 0.4);
  m.state = "chase";
  m.lost = 0;
  game.effects.push({ kind: "damage", x: m.x, y: m.y, z: m.z + m.h + 0.15, text: label, color, time: game.time });
}
