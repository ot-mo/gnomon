// Dungeon themes, gimmicks by leaning, the site kinds' dungeons and vault pools by level (TECH_DESIGN §1.4
// gen/dungeon.js DUNGEON_THEMES, GIMMICKS, §2.18, §5.5; bible §4.10, §8.2, §8.7; WS10, then C3).
//
//   DUNGEONS.themes      id → { rooms: [{ wall, floor }], darkRate(level), count(level), liquid?, creatureTable?, vaultPool? }
//                        gen/dungeon.js copies them into DUNGEON_THEMES (the legacy theme stays its own)
//   DUNGEONS.leanings    a domain's leaning (bible §8.2) → { theme, odd: [gimmick], even: [gimmick] }: what an Hour
//                        site's floors play like (bible §8.7). Odd and even floors may differ (ink and paper:
//                        all-flat floors, then all-deep ones).
//   DUNGEONS.domains     domain id → leaning id
//   DUNGEONS.kinds       per-run site kind → { theme, floors: [lo, hi], gimmicks: [[id, chance]], bottom }
//   DUNGEONS.vaultPools  [{ levels: [lo, hi], pool: [id | [id, weight]] }]: which puzzle vaults a site's level
//                        draws (the legacy stack keeps its own sequence)
//   DUNGEONS.trueMarks   tier → the true-marks an Hour site's bottom holds (bible §8.7: 1 at tiers 1-2, 2 at
//                        3-4, 3 at 5-6, 3 + 2 at 7, 3 + 3 + 2 at 8: one pile per number)
//   DUNGEONS.floorNames  the words an Hour site's named floors are made of (bible §8.7: "the Salted Granary of
//                        Mereford"); some floors stay nameless (liminal)
import { B } from "../blocks.js";

const clampDark = (base, per, max) => (level) => Math.min(max, base + per * level);

export const DUNGEONS = {
  themes: {
    // Deepwright rooms (ruins): old brick and tile, a little glass, rather dark.
    deepwright: {
      rooms: [{ wall: B.BRICK, floor: B.TILE }, { wall: B.MUD_BRICK, floor: B.CLAY }, { wall: B.STONE, floor: B.TILE }, { wall: B.GLASS, floor: B.TILE }],
      darkRate: clampDark(0.2, 0.03, 0.6), count: (level) => Math.min(16, 3 + Math.round(level * 1.5)),
    },
    // A legend's den: raw rock and bone, few lamps, fewer things (the owner keeps them off).
    lair: {
      rooms: [{ wall: B.ROCK, floor: B.DIRT }, { wall: B.MOSS, floor: B.ROCK }, { wall: B.BONE, floor: B.DIRT }],
      darkRate: clampDark(0.3, 0.03, 0.7), count: (level) => Math.min(12, 2 + level),
    },
    salt: {
      rooms: [{ wall: B.STONE, floor: B.SALT }, { wall: B.BRICK, floor: B.SALT }, { wall: B.STONE, floor: B.TILE }],
      darkRate: clampDark(0.12, 0.05, 0.5), count: (level) => Math.min(16, 3 + level * 2),
    },
    glass: {
      rooms: [{ wall: B.GLASS, floor: B.TILE }, { wall: B.GLASS, floor: B.SALT }, { wall: B.STONE, floor: B.TILE }],
      darkRate: clampDark(0.08, 0.04, 0.4), count: (level) => Math.min(16, 3 + level * 2),
    },
    shade: {
      rooms: [{ wall: B.MOSS, floor: B.ROCK }, { wall: B.STONE, floor: B.ASH }, { wall: B.BONE, floor: B.ROCK }],
      darkRate: clampDark(0.45, 0.03, 0.85), count: (level) => Math.min(16, 3 + level * 2),
    },
    gears: {
      rooms: [{ wall: B.METAL, floor: B.TILE }, { wall: B.METAL, floor: B.PLANK }, { wall: B.BRICK, floor: B.TILE }],
      darkRate: clampDark(0.1, 0.05, 0.5), count: (level) => Math.min(16, 3 + level * 2),
    },
    rust: {
      rooms: [{ wall: B.SCRAP, floor: B.ROCK }, { wall: B.BRICK, floor: B.CLAY }, { wall: B.METAL, floor: B.ROCK }],
      darkRate: clampDark(0.15, 0.05, 0.6), count: (level) => Math.min(16, 3 + level * 2),
    },
    wax: {
      rooms: [{ wall: B.BRICK, floor: B.PLANK }, { wall: B.MUD_BRICK, floor: B.TILE }, { wall: B.STONE, floor: B.PLANK }],
      darkRate: clampDark(0.25, 0.04, 0.7), count: (level) => Math.min(16, 3 + level * 2),
    },
    paper: {
      rooms: [{ wall: B.STONE, floor: B.TILE }, { wall: B.THATCH, floor: B.PLANK }, { wall: B.MUD_BRICK, floor: B.TILE }],
      darkRate: clampDark(0.12, 0.05, 0.5), count: (level) => Math.min(16, 3 + level * 2),
    },
    horn: {
      rooms: [{ wall: B.ROCK, floor: B.DIRT }, { wall: B.BONE, floor: B.ROCK }, { wall: B.MOSS, floor: B.DIRT }],
      darkRate: clampDark(0.15, 0.05, 0.6), count: (level) => Math.min(16, 3 + level * 2),
    },
  },

  // Bible §8.7 "Site floors by leaning". Every gimmick here is one of gen/dungeon.js's GIMMICKS.
  leanings: {
    salt: { theme: "salt", odd: ["flooded"], even: ["flooded"] },
    glass: { theme: "glass", odd: ["murals"], even: ["collapsed"] },
    flat: { theme: "paper", odd: ["flatland"], even: ["allDeep"] },
    dark: { theme: "shade", odd: ["lightless", "haunted"], even: ["haunted"] },
    deep: { theme: "horn", odd: ["collapsed"], even: ["allDeep"] },
    lamp: { theme: "wax", odd: ["braziers"], even: ["braziers", "lightless"] },
    beat: { theme: "gears", odd: ["spikeworks", "oneBeat"], even: ["spikeworks", "oneBeat"] },
    rust: { theme: "rust", odd: ["murals"], even: ["murals"] },
  },
  domains: { salt: "salt", glass: "glass", ink: "flat", paper: "flat", shade: "dark", stairs: "deep", horn: "deep",
             rust: "rust", wax: "lamp", gears: "beat" },

  // The per-run kinds' dungeons (bible §4.10: ruins and lairs 1-3 floors). Gimmicks are rolled per floor.
  kinds: {
    ruin: { theme: "deepwright", gimmicks: [["murals", 0.35], ["collapsed", 0.2], ["haunted", 0.15], ["flooded", 0.15]] },
    lair: { theme: "lair", gimmicks: [["lightless", 0.25], ["haunted", 0.1], ["flooded", 0.1]] },
    station: { theme: "deepwright", gimmicks: [] },
  },

  vaultPools: [
    { levels: [1, 4], pool: ["flatLie", "darkMaze", "unseenPath", ["braziers", 2], ["mosaicHall", 2], "gauntlet"] },
    { levels: [5, 12], pool: ["runeLever", "mosaicHall", "flatLie", "gauntlet", "braziers", "speakingDoor", "darkMaze", "unseenPath"] },
    { levels: [13, 99], pool: [["runeLever", 2], "mosaicHall", "flatLie", ["gauntlet", 2], "braziers", ["speakingDoor", 2], "darkMaze", ["unseenPath", 2]] },
  ],

  trueMarks: { 1: [1], 2: [1], 3: [2], 4: [2], 5: [3], 6: [3], 7: [3, 2], 8: [3, 3, 2] },

  floorNames: {
    rooms: ["Granary", "Cistern", "Gallery", "Kiln", "Scriptorium", "Vestry", "Undercroft", "Chancel", "Foundry", "Ossuary",
            "Ropewalk", "Counting-house", "Bathhouse", "Orangery", "Treasury", "Lantern-room"],
    places: ["Mereford", "Ashlow", "Tallowmere", "Brinecote", "Saltholm", "Quillby", "Gloamwick", "Stepmoor", "Hornsey",
             "Oxcombe", "Dialwell", "Paneby"],
    liminal: 0.3,   // the chance a floor (never the bottom) is nameless
  },
};
