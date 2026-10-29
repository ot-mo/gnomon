// World liquids (TECH_DESIGN §2.10, §2.18 "LIQUIDS { name, color, touch?, drink? }"; DECISIONS §1: one dominant
// liquid per tile, no mixing; faction sacraments for the Kindling and the base of tonics; bible §13.7 and §15.4's
// "Liquid" column; WS6b, then C2). What a liquid does when drunk is social/liquids.js's (drinkLiquid); this is the
// data.
//
//   LIQUIDS[id] = { name, color, drink, touch, value, sacramentOf: [factionId], rare?, sameAs?, effects }
//     drink, touch   what the bible says it does, with its numbers (shown when you look at a vial)
//     value          what a vial of it is worth, in glim (content/items/containers.js prices a filled vial with it; a
//                    filled vial sells as glass, so no pool is a purse)
//     sacramentOf    the factions that pour it in the Kindling (content/factions.js `liquid`; the Unlit take any)
//     sameAs         "water" is the plain water of every legacy and fixture zone: fresh water
//     effects        { drink: [effect], touch: [effect] }: bible §13.7 in full, for social/liquids.js and the zones'
//                    pools to apply. An effect is one of
//                      { heal: n } { hurt: n } { status: id, t, after?, perTou?, light? }  a status of status.js, `after`
//                                   seconds later, its time `perTou` seconds a TOU modifier, `light`: only in bright light
//                      { save: "agi", fail: { status, t } }    a slip on a pool
//                      { burns: s }  lit, the pool burns s seconds        { douse: true } { clean: true }
//                      { ward: n, against: [kind] }   a poured line n tiles long that those can't cross
//                      { stain: { sight: ×, t } }     seen at × the range for t seconds   { draws: factionId, t }
//                      { shortcut: "flat" }   flat beings travel through pools of it   { dark: true, gutter: true }
//                      { seek: "low" }   it runs to the lowest point, showing pits and slopes
//                      { reroll: "mutation" } { shutdown: "implant", days }   { transform: "sameTier" }
//                      { seePlane: s }   flat beings show in 3D for s seconds   { rep: { [factionId]: n }, seen: true }
//                      { again: s, status, t }   a second drink within s seconds adds the status
//                    A status the game doesn't have yet (nausea, confused, glowing, stained, lightBlind, stuck), and
//                    every effect drinkLiquid doesn't apply, is an integration request (docs/c2.md); social/liquids.js
//                    applies today what WS6b's deviation 9 lists.
//
// Glim is here only as a sacrament (Hollowmere, the Plan, the Moths, the Bent villages): the money is a counter (DECISIONS), and
// nothing in this table backs it.
export const LIQUIDS = {
  water: { name: "water", sameAs: "freshWater" },
  freshWater: { name: "fresh water", color: [120, 170, 230], value: 1, sacramentOf: ["noonVigil", "survey", "kites"],
    drink: "heals 2", touch: "washes off stains; puts out fire",
    effects: { drink: [{ heal: 2 }], touch: [{ clean: true }, { douse: true }] } },
  glim: { name: "glim", color: [255, 210, 70], value: 2, sacramentOf: ["hollowmere", "plan", "moths", "bentVillages"],
    drink: "disgusting: 1 damage, and you glow for 10 s", touch: "slippery (an AGI save); lit, it burns for 6 s",
    effects: { drink: [{ hurt: 1 }, { status: "glowing", t: 10 }], touch: [{ save: "agi", fail: { status: "stunned", t: 1 } }, { burns: 6 }] } },
  brine: { name: "brine", color: [170, 190, 170], value: 1, sacramentOf: ["pressed", "clatter"],
    drink: "1 damage and 3 s of nausea", touch: "a poured line of it, 3 tiles long, can't be crossed by ghosts or shades",
    effects: { drink: [{ hurt: 1 }, { status: "nausea", t: 3 }], touch: [{ ward: 3, against: ["ghost", "shade"] }] } },
  ink: { name: "ink", color: [70, 85, 170], value: 4, sacramentOf: ["flatfolk"],
    drink: "5 s of confusion, then you are Flat for 60 s, less 3 s for each point of TOU modifier",
    touch: "stains you, so enemies see you at double range for 30 s; flat beings use ink pools as shortcuts",
    effects: { drink: [{ status: "confused", t: 5 }, { status: "flat", t: 60, perTou: -3, after: 5 }],
      touch: [{ stain: { sight: 2, t: 30 } }, { shortcut: "flat" }] } },
  umbra: { name: "umbra", color: [95, 75, 135], value: 8, sacramentOf: ["lampless"],
    drink: "night eyes for 60 s, then 20 s blind in bright light", touch: "a hole of darkness: runes and planks show over it, and torches gutter inside it",
    effects: { drink: [{ status: "nightEyes", t: 60 }, { status: "blinded", t: 20, after: 60, light: true }], touch: [{ dark: true, gutter: true }] } },
  quicksilver: { name: "quicksilver", color: [200, 205, 215], value: 10, sacramentOf: ["assize"],
    drink: "poison for 6 s", touch: "runs to the lowest point, showing hidden pits and slopes",
    effects: { drink: [{ status: "poisoned", t: 6 }], touch: [{ seek: "low" }] } },
  sunwine: { name: "sunwine", color: [240, 190, 70], value: 6, sacramentOf: ["horary"],
    drink: "heals 6; two in a row confuse you", touch: "sticky: you're stuck for 1 s",
    effects: { drink: [{ heal: 6 }, { again: 10, status: "confused", t: 2 }], touch: [{ status: "stuck", t: 1 }] } },
  turnwater: { name: "turnwater", color: [210, 120, 220], value: 30, sacramentOf: ["askew", "errata"], rare: true,
    drink: "the Bent re-roll one random mutation; for the Plumb, one implant shuts down for a day",
    touch: "poured on a creature, it becomes a random creature of the same tier",
    effects: { drink: [{ reroll: "mutation" }, { shutdown: "implant", days: 1 }], touch: [{ transform: "sameTier" }] } },
  clearGlim: { name: "clear glim", color: [255, 250, 225], value: 5, sacramentOf: ["chandlers"], rare: true,
    drink: "you see the Plane for 30 min (flat beings show in 3D); Lampless −100 if they see you drink it",
    touch: "it burns twice as long as glim",
    effects: { drink: [{ seePlane: 1800 }, { rep: { lampless: -100 }, seen: true }], touch: [{ burns: 12 }] } },
  blood: { name: "blood", color: [150, 30, 35], value: 1, sacramentOf: ["rustbacks", "saltbeasts"],
    drink: "nothing good", touch: "stains you; draws Saltbeasts",
    effects: { drink: [], touch: [{ draws: "saltbeasts", t: 60 }] } },
  longbackMilk: { name: "longback milk", color: [235, 230, 210], value: 2, sacramentOf: ["drovers"],
    drink: "heals 3", touch: "sour on the skin",
    effects: { drink: [{ heal: 3 }], touch: [] } },
  mulchWine: { name: "mulch wine", color: [150, 100, 140], value: 3, sacramentOf: ["sporeMoot"],
    drink: "heals 2, and the ground tilts", touch: "it smells of the grove",
    effects: { drink: [{ heal: 2 }], touch: [] } },
  sap: { name: "sap", color: [170, 135, 60], value: 3, sacramentOf: ["pleatwood"],
    drink: "heals 1; it sticks in the throat", touch: "sticky",
    effects: { drink: [{ heal: 1 }], touch: [{ status: "stuck", t: 1 }] } },
};
