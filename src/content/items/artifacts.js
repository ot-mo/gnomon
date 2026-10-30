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
//
// C4: bible §13.4 lists 27 artifacts and 3 relics. ARTIFACTS holds the ones the game can do (bodymods/artifacts.js
// EFFECTS, or a switched-on one's bonus): the WS5 nine and three that switch on (the featherfall lantern, jump-springs,
// the mirror shield). ARTIFACTS_WAITING holds the rest in the same shape, each with `needs` (the code it waits for,
// docs/c4.md): an artifact with no effect would be found, identified and used for nothing (randomBodyMod draws from
// ARTIFACTS), so each moves across when its effect is built. Relics there are `relic: true` (known from the start, no
// charge) with bible §2.1's three registers: `flat` (inspect on the map), `deep` (a look in 3D), `dark` (the torch out:
// lower case, lines broken by "\n").
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
    info: "Switched on, a mote of light follows you: 6 tiles of light, torch or no, and your torch reaches further." },   // (player.js torchRange, light.js inDark: B1)
  glimgun: { name: "glimgun", vague: "an oily brass tube", class: "a weapon", complexity: 2, charge: 0, target: "creature", value: 240,
    info: "Spits a bolt of burning glim at what you aim at: 2d6 fire. Each shot costs a glim from your purse.",
    needs: "C4: its shot lights the target's area, a trespass in the Lampless' holy places (bible §13.2: light.js, C2's holy places)" },
  foldKnife: { name: "fold-knife", vague: "a hinged blade with no edge", class: "a mover", complexity: 3, charge: 300, target: "tile", value: 380,
    info: "Blinks you 4 tiles: the way you face in 3D, to a chosen tile on the map." },
  recallBead: { name: "recall bead", vague: "a bead that won't roll", class: "a mover", complexity: 4, charge: 1000, value: 520,
    info: "First use marks where you stand; the next takes you back there, if you are still on that floor." },
  lancet: { name: "lancet", vague: "a needle of black glass", class: "a weapon", complexity: 5, charge: 250, target: "creature", value: 640,
    info: "A beam that pierces everything in a line of 8 tiles for 3d6." },
  stillDial: { name: "still-dial", vague: "a dial with one hand", class: "a clock", complexity: 7, charge: 2500, value: 900,
    info: "Everything but you freezes for 3 s." },
  // C4: switched on, each lends its bonus from your pack while its cell lasts (as the lantern-mote does). The bible's
  // per-use charges become charge a minute: 20 a second is 1,200 a minute; a jump-spring's 25 a jump, about 4 a minute.
  featherfallLantern: { name: "featherfall lantern", vague: "a paper lamp that won't hang straight", class: "a lamp", complexity: 2, charge: 1200, per: "minute",
    bonus: { featherFall: 1 }, value: 280, info: "Held up and lit, it lets you down gently: while it burns, falls never hurt you.",
    needs: "the slow fall itself (player.js; a fall is only made harmless now)" },
  jumpSprings: { name: "jump-springs", vague: "two coils with heel straps", class: "a mover", complexity: 3, charge: 100, per: "minute",
    bonus: { jump: 2 }, value: 360, info: "Strapped on and wound, they add 2 blocks to your jump, and you climb 2 on the map.",
    needs: "25 charge a jump rather than 100 a minute (player.js, turns.js: a jump's hook)" },
  mirrorShield: { name: "mirror shield", vague: "a dish that shows you yourself", class: "a ward", complexity: 3, charge: 300, per: "minute",
    bonus: { ward: 3 }, value: 380, info: "Raised, it turns half the arrows and bolts aside; the rest do 3 less." },   // (combat.js turnedAside: B1)
};

// Bible §13.4's others: data for the code that will do each (docs/c4.md, integration requests). Same shape as ARTIFACTS.
export const ARTIFACTS_WAITING = {
  homingPip: { name: "homing pip", vague: "a pip that leans west", class: "a mover", complexity: 1, charge: 2500, value: 300,
    info: "Home to the Temple of Angles, with no hostile within 7 tiles.",
    needs: "the teleport home (zones.js changeZone to the temple; on the real world Hollowmere's, C1a)" },
  programmablePip: { name: "programmable pip", vague: "a pip with a blank face", class: "a mover", complexity: 3, charge: 5000, value: 600,
    info: "Set once to a village you have seen; then it takes you there.", needs: "setting a village and the journey (overworld/travel.js)" },
  theodolite: { name: "theodolite", vague: "a brass eye on three legs", class: "a finder", complexity: 3, charge: 100, value: 420,
    info: "The Hand on the world map, and hidden sites in the next spans.",
    needs: "the Hand on the world map and the hidden sites of the adjacent spans (overworld: WS1's discovery)" },
  snuffer: { name: "snuffer", vague: "a cold black cup", class: "a lamp", complexity: 2, charge: 200, value: 200,
    info: "Dark for 20 s, 6 tiles round: runes, planks and ghosts show.",
    needs: "a dark circle for 20 s (light.js inDark, render3d.js; the shades' AI)" },
  shadowLamp: { name: "shadow-lamp", vague: "a lamp that is darker lit", class: "a lamp", complexity: 5, charge: 600, per: "minute", cells: ["dark"], value: 700,
    info: "Dark light: runes, ghosts and planks show in its cone, torch or no.",
    needs: "dark light in a cone (render3d.js, light.js; renderMap.js for the map)" },
  paneCutter: { name: "pane-cutter", vague: "a knife with no thickness", class: "a weapon", complexity: 4, charge: 10, value: 500,
    info: "A knife that cuts flat beings in 3D, 10 charge a hit.", needs: "an artifact held as a weapon (combat.js; cutsFlat itself is built)" },
  unpressLens: { name: "unpress lens", vague: "a lens that makes things fat", class: "a planar", complexity: 5, charge: 300, target: "creature", value: 700,
    info: "A flat being turns deep for 10 s, to be hit in 3D. It ends your own Flat.",
    needs: "a deep status for flat beings (creatures.js isFlat, touchable)" },
  handPress: { name: "hand-press", vague: "two plates on a hinge", class: "a planar", complexity: 5, charge: 500, target: "creature", value: 750,
    info: "Presses a creature flat for 6 s: map only, no climbing.", needs: "the flat status on a creature (WS8's flat movement)" },
  bridgeReel: { name: "bridge-reel", vague: "a reel of thin planks", class: "a builder", complexity: 4, charge: 400, target: "tile", value: 600,
    info: "A plank bridge across 6 tiles of gap, for 60 s.", needs: "planks that come and go (world.js, zones.js)" },
  forcePane: { name: "force pane", vague: "a cold square of nothing", class: "a builder", complexity: 4, charge: 400, target: "tile", value: 620,
    info: "A wall of force 3 wide for 8 s. Flat beings can't cross it either.",
    needs: "a block that comes and goes, solid to flat beings (world.js, creatures.js)" },
  beatBox: { name: "beat-box", vague: "a box that ticks out of time", class: "a clock", complexity: 3, charge: 500, value: 480,
    info: "Silences spike traps and stops beat machines within 6 tiles for 20 s.", needs: "pausing traps and beat machines (traps.js, WS10's gimmicks)" },
  turnKey: { name: "turn-key", vague: "a key with too many sides", class: "a key", complexity: 2, charge: 200, target: "tile", value: 300,
    info: "Opens a Deepwright mosaic-lock without the code from the floor.", needs: "the mosaic locks (WS10's mosaics, interact.js)" },
  kiteDrone: { name: "kite drone", vague: "a folded paper bird", class: "a mapper", complexity: 6, charge: 300, target: "tile", value: 800,
    info: "A 15 × 15 look from above, even where you have never been.",
    needs: "Overlook's reveal at 15 × 15, anywhere on the floor (progression/abilities.js overlook)" },
  inkStamp: { name: "ink-stamp", vague: "a stamp that is always wet", class: "a marker", complexity: 1, charge: 50, value: 120,
    info: "A mark in both views. Flat allies can use it as a door. From above it is the door.",
    needs: "the mark (the zone's markers, as marker chalk) and doors for flat followers (followers, WS8)" },
  heightLens: { name: "height lens", vague: "a lens with numbers in it", class: "a mapper", complexity: 4, charge: 300, value: 450,
    info: "For 30 s every tile on your map shows its height as a digit.", needs: "height digits on the map (renderMap.js; the Read heights power's too)" },
  // Relics: one of each in the world (C1b and C5 place them).
  rotationPip: { name: "rotation pip", relic: true, class: "a relic", complexity: 0, charge: 0, value: 0,
    info: "A sliver of the Cube: each turn of the world stuns the enemies beside you (2 s, every 10 s).",
    flat: "PIP. Cube-stuff. 1. Turns: stun 2 s, rest 10 s.",
    deep: "A grain of the Cube, warm, heavier on one side, though it has no sides.",
    dark: "it was a corner once\nit would like to be turned",
    needs: "a turn of the world (Tab) stuns the adjacent: the Folding strike's hook (screens/play.js toggleMap, a \"view:turn\" event)" },
  noonglass: { name: "the Noonglass", relic: true, class: "a relic", complexity: 0, charge: 0, value: 0,
    info: "At noon, a beam that unpresses anything and burns shades.",
    flat: "NOONGLASS. Glass. 1 noon a use. Unpresses; burns shades.",
    deep: "A lens two hands wide. It gathers more light than it is given.",
    dark: "it is noon in here\nit is always noon in here",
    needs: "the noon beam (clock.js's noon window, combat.js, creatures.js), Vesper (C3) and Whole Noon (C5)" },
  greatTheodolite: { name: "the Great Theodolite", relic: true, class: "a relic", complexity: 0, charge: 0, value: 0,
    info: "Shows the Hand and the hidden sites within 3 spans on the world map.",
    flat: "THEODOLITE, GREAT. Brass. Reach 3 spans.",
    deep: "A brass instrument too heavy to carry far, holding the last of the light after the rest has gone.",
    dark: "it measured the needle\nthe needle measured back",
    needs: "the Hand and the hidden sites on the world map (overworld: WS1's discovery)" },
};

export const CELLS = {
  glim: { name: "glim cell", charge: 2500, recharge: "glim", value: 30, info: "A Deepwright cell. Refill it from your purse: a glim for every 100 charge." },
  sun: { name: "sun cell", charge: 2500, recharge: "sun", value: 60, info: "Drinks the daylight: +50 charge a minute under an open sky by day." },
  dark: { name: "dark cell", charge: 2500, recharge: "dark", value: 60, info: "Drinks the dark: +50 charge a minute while your torch is out." },
  heart: { name: "heart cell", charge: 25000, recharge: null, value: 400, info: "An Hour-site cell, ten times the others. It never recharges." },
};
