// The creatures whose bible §12 rule needs a system first (C3; as C4's waiting artifacts and mutations): complete
// entries (numbers, art, the d20 numbers, their registers), held out of the registry because without their system they
// would be wrong in the world, not merely plain: a fish walking the floors of the Flats' dungeons, a mirage you could
// fight on the map, a boss without its fight. Each `needs` says what; when it is built, the integrator registers the
// entry (creatures.js registerCreatures) and the regions' rows that name it start drawing it (they skip a type that
// isn't registered). check-creatures holds them to the same art, glyph and number rules as the registered ones.
//
//   CREATURES_WAITING[type] = { …a creature type, as wildlife.js's…, needs }
import { LEGACY_MONSTERS } from "./legacy.js";
import { BESTIARY } from "./bestiary.js";

const L = LEGACY_MONSTERS;
const reskin = (type, palette) => ({ frames: L[type].frames, palette: { ...L[type].palette, ...palette } });
const d20 = (str, agi, tou, int, wil, ego) => ({ attrs: { str, agi, tou, int, wil, ego }, dv: Math.floor((agi - 16) / 2) });

const ART = {
  fish: [
    ["   ff      ", " fffffff  f", "fEfffffffff", " fffffff  f", " L ff      "],
    ["    ff     ", " fffffff ff", "fEfffffffff", " fffffff   ", " L  ff     "],
  ],
  eel: [
    ["       ee ", " eeeee eEe", "eeeeeeeee ", "e   eee   "],
    ["  ee      ", " eeeeee ee", "eeeeeeeeEe", "     eee  "],
  ],
  mirage: [
    ["  iIi  ", " iIiIi ", "  iIi  ", "   I   ", "  iIi  ", " i I i ", "  iIi  "],
    ["  IiI  ", " IiIiI ", "  IiI  ", "   i   ", "  IiI  ", " I i I ", "  IiI  "],
  ],
  bell: [
    ["   BBB   ", "  BBBBB  ", "  BBBBB  ", " BBBBBBB ", "    c    ", "  ggggg  ", " ggggggg ", "g ggggg g", "  ggggg  ", "  gg gg  ", "   g g   "],
    ["   BBB   ", "  BBBBB  ", "  BBBBB  ", " BBBBBBB ", "   c     ", "  ggggg  ", " ggggggg ", "g ggggg g", "  ggggg  ", "   ggg   ", "    g    "],
  ],
  vesper: [
    ["    kkk    ", "   kEkEk   ", "   kkkkk   ", "  kkkkkkk  ", " kkkkkkkkk ", "kk kkkkk kk", "k  kkkkk  k", "   kkkkk   ",
     "   kkkkk   ", "  kkkkkkk  ", "  kkkkkkk  ", " kkkkkkkkk ", " kkkk kkkk ", "kkkk   kkkk"],
    ["    kkk    ", "   kEkEk   ", "   kkkkk   ", "  kkkkkkk  ", " kkkkkkkkk ", "kk kkkkk kk", "k  kkkkk  k", "   kkkkk   ",
     "   kkkkk   ", "  kkkkkkk  ", " kkkkkkkkk ", " kkkkkkkkk ", "kkkkk kkkkk", "kkk     kkk"],
  ],
};

export const CREATURES_WAITING = {
  glowfin: {
    name: "glowfin", glyph: "i", color: [150, 230, 170], xp: 0, levels: [1, 16], weight: 2, factions: ["beasts"], temperament: "docile",
    hp: 3, speed: 2.6, damage: [0, 1], cooldown: 1.0, reach: 1.1, sight: 8, w: 0.6, h: 0.3, ...d20(2, 20, 4, 3, 6, 6),
    rule: { swims: true, light: 2, leads: "culverts" },
    needs: "swimmers: deep water only, never a dry floor (ai.js, gen/biomes populate, gen/dungeon.js); its light in the water at night (light.js)",
    frames: ART.fish, palette: { f: [[110, 170, 130], 0.3], E: [[20, 30, 20], 0], L: [[190, 255, 170], 1.6] },
  },
  saltMirage: {
    name: "salt mirage", glyph: "I", color: [240, 236, 214], xp: 8, levels: [3, 11], weight: 2, factions: [],
    hp: 10, speed: 3.0, damage: [2, 5], cooldown: 1.1, reach: 1.2, sight: 12, w: 0.8, h: 1.6, hover: 0.2, ...d20(12, 18, 10, 6, 16, 10),
    rule: { deepOnly: true, images: 2 / 3, glare: true },
    needs: "a being of 3D alone, the reverse of flat: not drawn, struck or striking on the map (creatures.js touchable and sees, renderMap.js); two in three images, worst in the noon glare (clock.js)",
    frames: ART.mirage, palette: { i: [[230, 225, 200], 0.6], I: [[255, 252, 240], 1.0] },
  },
  umbralEel: {
    name: "umbral eel", glyph: "e", color: [70, 60, 110], xp: 14, levels: [12, 19], weight: 2, factions: [], darkSight: true,
    hp: 22, speed: 2.8, damage: [4, 7], cooldown: 1.2, reach: 1.4, sight: 10, w: 1.0, h: 0.5, ...d20(18, 18, 16, 3, 12, 4),
    rule: { swims: "umbra", drags: 10 },
    needs: "swimmers in umbra pools, only its eyes shown; dragging you in and leaving you in darkness for 10 s (ai.js, status.js)",
    frames: ART.eel, palette: { e: [[45, 40, 75], 0.1], E: [[220, 200, 255], 1.6] },
  },
  mirrorEel: {
    name: "mirror eel", glyph: "e", color: [205, 212, 222], xp: 16, levels: [12, 24], weight: 2, factions: [],
    hp: 22, speed: 3.0, damage: [4, 7], cooldown: 1.2, reach: 1.4, sight: 10, w: 1.0, h: 0.5, ...d20(16, 20, 14, 6, 14, 6),
    rule: { swims: true, reflection: true },
    needs: "swimmers; a reflection drawn on the map beside it, only one of the two real, and in 3D the real one glints (renderMap.js, render3d.js)",
    frames: ART.eel, palette: { e: [[185, 195, 210], 0.4], E: [[255, 255, 255], 1.8] },
  },
  escapement: {
    name: "Escapement", glyph: "C", color: [214, 168, 88], xp: 150, factions: ["plan"], temperament: "aggressive",
    hp: 200, speed: 0, damage: [10, 15], cooldown: 2.6, reach: 3.2, sight: 18, w: 2.2, h: 4.2, brittle: true, weak: ["shock"], ...d20(28, 6, 30, 10, 24, 4),
    rule: { colossus: true, core: "head", slams: "map" },
    needs: "the Colossus's rules for a type that isn't the guardian (combat.js colossusCore, guardians.js colossus, keyed by guardian === \"colossus\" today), with a wake line of its own; its hall at the Metronome's bottom (C1b)",
    ...reskin("colossus", { s: [[150, 110, 60], 0], S: [[195, 150, 80], 0], C: [[255, 220, 120], 1.6], c: [[255, 170, 60], 1.2] }),
  },
  drownedBellwether: {
    name: "Drowned Bellwether", glyph: "U", color: [196, 140, 80], xp: 120, factions: ["unlit"], temperament: "aggressive",
    hp: 150, speed: 1.6, damage: [6, 11], cooldown: 1.6, reach: 1.6, sight: 16, w: 1.4, h: 2.6, hover: 0.4,
    undead: true, darkSight: true, resist: ["frost"], ...d20(20, 12, 24, 14, 24, 18),
    rule: { toll: 3, every: 8 },
    needs: "its toll, forcing every flat thing deep for 3 s, you included if you're Flat (an AI hook: guardians.js, status.js flat); its place at the Drowned Lantern's bottom (C1b)",
    frames: ART.bell, palette: { B: [[196, 140, 80], 0.6], c: [[255, 220, 150], 1.4], g: [[110, 130, 150], 0.5] },
  },
  vesper: {
    name: "Vesper", glyph: "V", color: [60, 50, 90], xp: 0, factions: ["unlit"], temperament: "aggressive",
    hp: 400, speed: 1.6, damage: [8, 13], cooldown: 1.5, reach: 2.0, sight: 20, w: 1.6, h: 3.2, darkSight: true, ...d20(24, 18, 30, 22, 26, 24),
    rule: { phases: ["flat", "dark", "deep"] },
    needs: "beat 11's fight in three phases (flat: a sweeping shadow; dark: the Gloom Warden's rules; deep: the Colossus's, climbed by the hour numerals) at the Noon Socket (C1b, C5; guardians.js); never the Lich King's `boss` (that wins the parent's game)",
    frames: ART.vesper, palette: { k: [[35, 28, 55], 0.2], E: [[255, 220, 160], 1.8] },
  },
};

for (const [id, t] of Object.entries(CREATURES_WAITING)) {
  const b = BESTIARY[id];
  if (b) { t.info = b.deep; t.lines = { flat: b.flat, deep: b.deep, dark: b.dark }; }
}
