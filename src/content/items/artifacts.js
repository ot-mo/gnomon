// Artifacts and charge cells (TECH_DESIGN §2.18 "ARTIFACTS { complexity, … }", §2.9 kinds `artifact` and `cell`;
// bible §13.4; WS5, then C4). bodymods/artifacts.js registers the kinds and does what each one does.
//
//   ARTIFACTS[id] = { name, vague, class, complexity, charge, per?, cells?, sturdy?, target?, consumed?, bonus?,
//                     value, info }
//     name        what it is called once identified;  vague: what an unknown one looks like ("a humming tube")
//     class       what a partial identification tells you (you learn its class, but can't use it)
//     complexity  bible §13.4: identifying it rolls d20 + INT modifier + bonus(examine) against 8 + 2 × complexity
//     charge      what a use costs from the cell inside it (0: it needs none); per: "minute" for something you
//                 switch on, which then drains that much every minute of game time it runs
//     cells       the cells it takes (default: any)
//     sturdy      a bad miss doesn't break it
//     target      "self" (default), "tile" (a place: where you aim in 3D, a chosen tile on the map) or
//                 "creature" (something you aim at)
//     consumed    used up by its one use
//     bonus       what it gives while switched on (one with `per`), from your pack
//     value      the price in glim (bible §3.1 anchors: the homing pip 300)
//   CELLS[id] = { name, charge, recharge: "glim" | "sun" | "dark" | null, value, info }
//     recharge    glim: from your purse at 100 charge a glim (bible §3.1), or a tinker; sun: +50 a minute under an
//                 open sky by day; dark: +50 a minute while your torch is out; null: it doesn't
export const ARTIFACTS = {
  plumbBob: { name: "plumb-bob", vague: "a weighted thread", class: "a finder", complexity: 1, charge: 0, sturdy: true, value: 40,
    info: "Points to true down. Pits and chasms within 3 tiles mark themselves on your map." },
  quicksilverLevel: { name: "quicksilver level", vague: "a stoppered glass tube", class: "a finder", complexity: 1, charge: 0, consumed: true, value: 60,
    info: "Poured out, it runs to every low place within 12 tiles: hidden pits show on your map. Used up." },
  echoBell: { name: "echo-bell", vague: "a cold brass bell", class: "a mapper", complexity: 2, charge: 100, value: 220,
    info: "Rung once, it draws every surface within 10 tiles onto your map, lit or not." },
  lanternMote: { name: "lantern-mote", vague: "a warm disc", class: "a lamp", complexity: 2, charge: 10, per: "minute", bonus: { torch: 0.4 }, value: 260,
    info: "Switched on, a mote of light follows you: your torch reaches further, and your hands stay free." },
  glimgun: { name: "glimgun", vague: "an oily brass tube", class: "a weapon", complexity: 2, charge: 0, target: "creature", value: 240,
    info: "Spits a bolt of burning glim at what you aim at: 2d6 fire. Each shot costs a glim from your purse." },
  foldKnife: { name: "fold-knife", vague: "a hinged blade with no edge", class: "a mover", complexity: 3, charge: 300, target: "tile", value: 380,
    info: "Blinks you 4 tiles: the way you face in 3D, to a chosen tile on the map." },
  recallBead: { name: "recall bead", vague: "a bead that won't roll", class: "a mover", complexity: 4, charge: 1000, value: 520,
    info: "First use marks where you stand; the next takes you back there, if you are still on that floor." },
  lancet: { name: "lancet", vague: "a needle of black glass", class: "a weapon", complexity: 5, charge: 250, target: "creature", value: 640,
    info: "A beam that pierces everything in a line of 8 tiles for 3d6." },
  stillDial: { name: "still-dial", vague: "a dial with one hand", class: "a clock", complexity: 7, charge: 2500, value: 900,
    info: "Everything but you freezes for 3 s." },
};

export const CELLS = {
  glim: { name: "glim cell", charge: 2500, recharge: "glim", value: 30, info: "A Deepwright cell. Refill it from your purse: a glim for every 100 charge." },
  sun: { name: "sun cell", charge: 2500, recharge: "sun", value: 60, info: "Drinks the daylight: +50 charge a minute under an open sky by day." },
  dark: { name: "dark cell", charge: 2500, recharge: "dark", value: 60, info: "Drinks the dark: +50 charge a minute while your torch is out." },
  heart: { name: "heart cell", charge: 25000, recharge: null, value: 400, info: "An Hour-site cell, ten times the others. It never recharges." },
};
