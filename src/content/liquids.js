// World liquids (TECH_DESIGN §2.10, §2.18 "LIQUIDS { name, color, touch?, drink? }"; DECISIONS §1: one dominant
// liquid per tile, no mixing; faction sacraments for the Kindling and the base of tonics; bible §13.7 and §15.4's
// "Liquid" column; WS6b, then C2). What a liquid does when drunk is social/liquids.js's (drinkLiquid); this is the
// data.
//
//   LIQUIDS[id] = { name, color, drink, touch, value, sacramentOf: [factionId], rare?, sameAs? }
//     drink, touch   what the bible says it does (shown when you look at a vial)
//     value          what a vial of it is worth, in glim (content/items/containers.js prices a filled vial with it)
//     sacramentOf    the factions that pour it in the Kindling (content/factions.js `liquid`; the Unlit take any)
//     sameAs         "water" is the plain water of every legacy and fixture zone: fresh water
//
// Glim is here only as a sacrament (Hollowmere, the Plan, the Moths): the money is a counter (DECISIONS), and
// nothing in this table backs it.
export const LIQUIDS = {
  water: { name: "water", sameAs: "freshWater" },
  freshWater: { name: "fresh water", color: [120, 170, 230], value: 1, sacramentOf: ["noonVigil", "survey", "kites"],
    drink: "heals 2", touch: "washes off stains; puts out fire" },
  glim: { name: "glim", color: [255, 210, 70], value: 2, sacramentOf: ["hollowmere", "plan", "moths"],
    drink: "disgusting: 1 damage, and you glow for a while", touch: "slippery; it burns if lit" },
  brine: { name: "brine", color: [170, 190, 170], value: 1, sacramentOf: ["pressed", "clatter"],
    drink: "1 damage, and your stomach turns", touch: "a poured line of it holds back ghosts and shades" },
  ink: { name: "ink", color: [70, 85, 170], value: 4, sacramentOf: ["flatfolk"],
    drink: "you go Flat for a while", touch: "stains you; flat beings use ink pools as shortcuts" },
  umbra: { name: "umbra", color: [95, 75, 135], value: 8, sacramentOf: ["lampless"],
    drink: "night eyes for a minute", touch: "a hole of darkness: runes and planks show over it" },
  quicksilver: { name: "quicksilver", color: [200, 205, 215], value: 10, sacramentOf: ["assize"],
    drink: "poison", touch: "runs to the lowest point, showing hidden pits" },
  sunwine: { name: "sunwine", color: [240, 190, 70], value: 6, sacramentOf: ["horary"],
    drink: "heals 6; two in a row and your head spins", touch: "sticky" },
  turnwater: { name: "turnwater", color: [210, 120, 220], value: 30, sacramentOf: ["askew", "errata"], rare: true,
    drink: "something in you turns over", touch: "poured on a creature, it becomes another" },
  clearGlim: { name: "clear glim", color: [255, 250, 225], value: 5, sacramentOf: ["chandlers"], rare: true,
    drink: "you see the Plane for a while; the Lampless take it badly", touch: "it burns twice as long as glim" },
  blood: { name: "blood", color: [150, 30, 35], value: 1, sacramentOf: ["rustbacks", "saltbeasts"],
    drink: "nothing good", touch: "stains you; draws Saltbeasts" },
  longbackMilk: { name: "longback milk", color: [235, 230, 210], value: 2, sacramentOf: ["drovers"],
    drink: "heals 3", touch: "sour on the skin" },
  mulchWine: { name: "mulch wine", color: [150, 100, 140], value: 3, sacramentOf: ["sporeMoot"],
    drink: "heals 2, and the ground tilts", touch: "it smells of the grove" },
  sap: { name: "sap", color: [170, 135, 60], value: 3, sacramentOf: ["pleatwood"],
    drink: "heals 1; it sticks in the throat", touch: "sticky" },
};
