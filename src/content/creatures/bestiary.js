// The bestiary (bible §12; §2.1 rule 3: full registers for creatures; §15.9: 63 creatures in 3 short registers, about 20
// words each; C3): every one of the bible's 63 creatures, in the bible's order, by the type id it lives under.
//
//   BESTIARY[id] = { section, name, glyph, tier: [lo, hi], flat, deep, dark }
//     id        the creature type (content/creatures/wildlife.js WILDLIFE, people.js PEOPLE, the parent's legacy.js for
//               the three the bible calls existing and keeps by name: flatling, shade, wraith) or, for the seven whose
//               rule waits on a system, waiting.js CREATURES_WAITING
//     section   bible §12's subsection; tier its tier column (a boss's one tier as [t, t])
//     flat      the Flat line, shown when you inspect on the map: terse and numbered, like a ledger
//     deep      the Deep line, shown when you look in 3D: light, weight and height
//     dark      the Dark line, shown with the torch out: lower case, no punctuation, line breaks
//   creatureLines(type) → { flat, deep, dark } | null   the three registers of a type, by its id (legacy types too)
//
// Creature text never mentions gear, position or mood (bible §2.1 rule 9): mutations, pressings and overlays change
// those. A type's `info` (what the examine screen shows today) is its Deep line; the register by view (the Flat line on
// the map, the Dark line with the torch out) is integration request 2 in docs/c3.md.
const B = (section, name, glyph, tier, flat, deep, dark) => ({ section, name, glyph, tier, flat, deep, dark });

export const BESTIARY = {
  // --- §12.1 Brine Flats and the Hollow Mere --------------------------------------------------------------------
  saltrat: B("12.1", "saltrat", "r", [1, 2], "SALTRAT. In reeds: seen only next to you.",
    "A white-crusted rat, light as a dry reed.", "small teeth\ncounting toes"),
  brineGrub: B("12.1", "brine-grub", "w", [1, 2], "BRINE-GRUB. Track: ;.",
    "A pale grub as long as an arm, heavy with brine.", "the ground breathes\nunder the ground"),
  glowfin: B("12.1", "glowfin", "i", [1, 3], "GLOWFIN. Water only. Harm 0.",
    "A thin fish with a green lamp under its chin.", "it knows the way"),
  clatterer: B("12.1", "clatterer", "c", [1, 2], "CLATTERER. Moves: diagonal.",
    "A crab the height of a child, claws held aside.", "tk tk\nsomething sideways is selling"),
  flatling: B("12.1", "flatling", "f", [1, 3], "FLATLING. Thickness 0. Bites.",
    "A shadow on the floor with nothing over it.", "a shape with no edge"),
  lanternMoths: B("12.1", "lantern moths", "m", [1, 8], "LANTERN MOTHS. Harm 0. Follow: lit torches.",
    "Wax-coloured moths, enough of them to glow.", "no light\nno moths"),
  brinehog: B("12.1", "brinehog", "p", [1, 2], "BRINEHOG. Charges straight. Turns: none.",
    "A low salt-grey hog, all its weight in front.", "hooves\nin one direction only"),
  drownedKeeper: B("12.1", "drowned keeper", "U", [1, 2], "DROWNED KEEPER. Seen: torch out. Points: down.",
    "Only wet floor, and a smell of the Mere.", "dig here\ndo not light it"),

  // --- §12.2 The Rust Steps and the Tall Table ------------------------------------------------------------------
  rustbackScav: B("12.2", "Rustback scav", "g", [1, 3], "RUSTBACK SCAV. Takes drops. Flees at 25%.",
    "A lean Rustback with quick hands.", "scrap clinks\nin your pockets"),
  rustbackSlinger: B("12.2", "Rustback slinger", "g", [2, 3], "RUSTBACK SLINGER. Range 10. Perch: 2 blocks up.",
    "A thin Rustback with a long arm, fond of ledges.", "a whistle\nthen the stone"),
  ledgehorn: B("12.2", "ledgehorn", "q", [2, 3], "LEDGEHORN. Climb 2. Knock 2.",
    "A red goat standing where there was no room.", "hooves above you\nthen not"),
  kite: B("12.2", "kite", "v", [2, 4], "KITE. Flies: head height. Nest: shown.",
    "A bird the size of a child, eyeing your pack.", "kree\nsomething lighter"),
  ledgeSpider: B("12.2", "ledge spider", "x", [2, 3], "LEDGE SPIDER. Webs: bridges, drawn -.",
    "A rust-coloured spider that ropes the gaps.", "a thread across the dark"),
  chaffDevil: B("12.2", "chaff devil", "Y", [2, 2], "CHAFF DEVIL. Path: spiral. Blinds 3 s.",
    "A whirl of dust and husks, turning on itself.", "grit in the eyes\nround again"),

  // --- §12.3 The Salt Waste ---------------------------------------------------------------------------------
  saltMirage: B("12.3", "salt mirage", "I", [2, 3], "SALT MIRAGE. On this map: nothing.",
    "A noon shimmer with teeth. Two in three are only shimmer.", "one of you is lying"),
  longback: B("12.3", "longback", "u", [1, 3], "LONGBACK. Docile. Hired: travel x1.5.",
    "A salt-camel whose face has seen through everything.", "slow breath\nwarm flank"),

  // --- §12.4 The Downs and the barrows ----------------------------------------------------------------------
  cairnHound: B("12.4", "cairn hound", "d", [2, 3], "CAIRN HOUND. Pack 3-5. Howl: 12 tiles.",
    "A grey dog the colour of barrow stones.", "one howl\nthen many"),
  barrowSkeleton: B("12.4", "barrow skeleton", "s", [2, 4], "BARROW SKELETON. Rises at night. Slow.",
    "Old bones held up by the habit of standing.", "someone is still keeping watch"),
  assizeOutrider: B("12.4", "Assize outrider", "K", [3, 4], "ASSIZE OUTRIDER. Lines: straight. Bent: wrong.",
    "A pale rider on a long-legged mount, upright as a rule.", "hooves exactly the same distance apart"),
  duskBat: B("12.4", "dusk bat", "b", [2, 4], "DUSK BAT. Torch lit: drawn. Torch out: lost.",
    "A ragged violet bat dropping at the nearest light.", "a flutter\nthen nothing"),
  barrowTroll: B("12.4", "barrow-troll", "T", [4, 5], "BARROW-TROLL. Regrows. Burning: stops it.",
    "A grey-green troll as broad as a door.", "the hill snores\nkeep your fire"),

  // --- §12.5 Pleatwood, the Deep Pleat and Foldmother -------------------------------------------------------------
  creasebeetle: B("12.5", "creasebeetle", "B", [2, 4], "CREASEBEETLE. Planes 2. Flips: every hit.",
    "A green beetle creased down its back, half not there.", "it is on the other side"),
  pleatSpider: B("12.5", "pleat spider", "x", [2, 4], "PLEAT SPIDER. Venom. Hides: in folds.",
    "A green spider folded into the branches like a pocket knife.", "the fold moved"),
  hangvine: B("12.5", "hangvine", "n", [3, 5], "HANGVINE. On this map: a tree.",
    "A thick vine from the canopy, a red eye in its leaves.", "creak overhead"),
  sporeling: B("12.5", "sporeling", "j", [3, 5], "SPORELING. Splits. Its touch roots limbs.",
    "A soft lilac lump, faintly warm, sprouting caps.", "it smells of cellars\nit agrees with you"),
  foldmonkey: B("12.5", "foldmonkey", "y", [3, 4], "FOLDMONKEY. Throws from 4 blocks up. Steals 5 glim.",
    "A brown monkey with folding arms and a long reach.", "your purse is lighter"),
  paperWasps: B("12.5", "paper wasps", "P", [4, 6], "PAPER WASPS. Under doors: yes. Stain: 30 s.",
    "Wasps with wings like torn pages.", "a ledger opening\non your name"),
  mootWalker: B("12.5", "moot-walker", "F", [5, 6], "MOOT-WALKER. On death: confusing spores.",
    "A body under a purple cap, steered from inside.", "the moot wears it kindly"),

  // --- §12.6 The Tessellate --------------------------------------------------------------------------------
  tileMimic: B("12.6", "tile mimic", "t", [4, 5], "TILE MIMIC. One shade off. Moves while you are deep.",
    "A floor tile. A red one. Possibly.", "the floor is listening"),
  flatfolkWanderer: B("12.6", "Flatfolk wanderer", "@", [4, 4], "FLATFOLK WANDERER. Thickness 0. Directions: free.",
    "A trader drawn on the ground, seen edge-on.", "no\nthe other left"),
  pressHound: B("12.6", "press-hound", "d", [4, 5], "PRESS-HOUND. Bite: pressed flat, 3 s.",
    "A steel-grey hound with a jaw like a book press.", "a page closing on you"),
  mosaicGolem: B("12.6", "mosaic golem", "G", [5, 5], "MOSAIC GOLEM. Eye tile 1. Crushing: x2.",
    "Red and blue tiles that stood up, still grouted.", "tiles fall like teeth"),
  pressedPilgrim: B("12.6", "pressed pilgrim", "@", [4, 4], "PRESSED PILGRIM. Harm 0. Striking one: desecration.",
    "A pilgrim of the Plane, as flat as devotion allows.", "breath in the floor\nnearly there"),

  // --- §12.7 The Shade and the Unlit Choir -------------------------------------------------------------------------
  shade: B("12.7", "shade", "z", [5, 6], "SHADE. Sees in the dark. Burns in torchlight.",
    "A smudge of dusk with two pale eyes.", "it likes things this way"),
  wraith: B("12.7", "wraith", "W", [5, 7], "WRAITH. Floats. Heals by draining.",
    "A tall violet shape with two cold stars for eyes.", "it drinks\nand is never full"),
  lamplessChanter: B("12.7", "Lampless chanter", "N", [5, 5], "LAMPLESS CHANTER. Chant: snuffs your torch, 10 s.",
    "A thin figure singing low; flames near it bow.", "hush\nput it out"),
  umbralEel: B("12.7", "umbral eel", "e", [5, 6], "UMBRAL EEL. Shown: eyes. Drags: 10 s of dark.",
    "Two eyes on a black pool, nothing below them.", "deeper than the floor"),
  longshadow: B("12.7", "longshadow", "Z", [5, 7], "LONGSHADOW. Body 0. Reach 6.",
    "A darkening along the ground, out of the light.", "your shadow is longer\nand not yours"),
  gloamWarden: B("12.7", "the Gloam Warden", "W", [6, 6], "GLOAM WARDEN. Seen: dark only. Braziers hurt it.",
    "In the light, a cold draught where something stands.", "it knows the way back"),

  // --- §12.8 Halfnight and the Assize ----------------------------------------------------------------------
  plumbknight: B("12.8", "plumbknight", "K", [5, 6], "PLUMBKNIGHT. Charges: rows, columns. Turns: 0.",
    "A grey knight, plumb crown to heel, who turns by stopping.", "you are on the line"),
  assizer: B("12.8", "assizer", "K", [5, 6], "ASSIZER. Overrule: 20 s.",
    "A tall judge whose voice makes things smaller.", "the rule is read\nsomething in you stops"),
  chimePriest: B("12.8", "chime-priest", "H", [4, 5], "CHIME-PRIEST. On the hour: hastes allies.",
    "A Horary priest who rings faintly as it breathes.", "bong\nyou are late"),
  chandlerGuard: B("12.8", "Chandler guard", "J", [4, 5], "CHANDLER GUARD. Range 8. Oil: set alight.",
    "A broad watchman smelling of lamp oil.", "a click\nthe floor lights up"),
  lampHound: B("12.8", "lamp-hound", "d", [3, 5], "LAMP-HOUND. Tracks light. Torch out: lost.",
    "A tawny hound following lamplight, not scent.", "it waits for the match"),

  // --- §12.9 The Stacks and the Metronome --------------------------------------------------------------------
  draughtsman: B("12.9", "draughtsman", "R", [4, 6], "DRAUGHTSMAN. Path: the blueprint. Repairs walls.",
    "A brass automaton walking a line only it can see.", "click scrape\nthe wall is back"),
  lensSentry: B("12.9", "lens sentry", "R", [5, 6], "LENS SENTRY. Beam 12. Umbra: blind.",
    "A white tripod whose lens follows you like a flower.", "a lens looking for any light"),
  beatSpider: B("12.9", "beat-spider", "R", [5, 6], "BEAT-SPIDER. Moves on the beat.",
    "A brass spider that lurches, stops, lurches.", "tick\ntick\ncloser"),
  girderGolem: B("12.9", "girder golem", "G", [6, 7], "GIRDER GOLEM. Armour 3. Crushing: x2.",
    "A walking frame of girders, slow as a building.", "it is still coming"),
  rustbackBrute: B("12.9", "Rustback brute", "g", [5, 6], "RUSTBACK BRUTE. Climbs 1. Jumps 0.",
    "A huge Rustback with a hide of red scale.", "it cannot climb after you"),
  rustOoze: B("12.9", "rust ooze", "j", [5, 6], "RUST OOZE. Its hits: enchantment −1.",
    "A red slick that moves like poured water.", "it tastes your iron"),
  escapement: B("12.9", "the Escapement", "C", [6, 6], "ESCAPEMENT. Core: on top. Slams: shown.",
    "A brass colossus, its core ticking on its head.", "tock\nthe room moves\ntock"),

  // --- §12.10 The Glass Sea's shore and the Drowned Lantern ---------------------------------------------------------
  glassCrab: B("12.10", "glass crab", "c", [6, 6], "GLASS CRAB. Thrown things: returned.",
    "A crab of pale green glass holding a bent copy of you.", "your light comes back sideways"),
  slagSalamander: B("12.10", "slag salamander", "l", [6, 7], "SLAG SALAMANDER. Burns. Frost: weak.",
    "An orange salamander glowing like a forge drip.", "the glass softens where it walks"),
  mirrorEel: B("12.10", "mirror eel", "e", [6, 7], "MIRROR EEL. Shown: 2. Real: 1.",
    "A silver eel and its reflection; one of them glints.", "choose"),
  drownedBellwether: B("12.10", "the Drowned Bellwether", "U", [7, 7], "BELLWETHER. Toll: flat things deep, 3 s.",
    "A bronze ghost with a bell for a face.", "a bell under the sea\nyou stand up"),
  erratum: B("12.10", "erratum", "E", [4, 7], "ERRATUM. Strikes from the left. Hates its original.",
    "Something in reversed colours you almost recognise.", "this is the other one"),

  // --- §12.11 The Lattice and the Gnomon -----------------------------------------------------------------------
  askewAngle: B("12.11", "Askew angle", "A", [7, 8], "ASKEW ANGLE. Moves: diagonals.",
    "A shimmer at a wrong angle, like a corner caught sideways.", "the corner moved"),
  fold: B("12.11", "fold", "A", [7, 8], "FOLD. Its hit: mirrored across the centre.",
    "A living crease in the air, cyan where it bends.", "here\nthere\nthe same place"),
  latticeTroll: B("12.11", "lattice troll", "T", [7, 8], "LATTICE TROLL. Regrows unless burning. Crushing: x2.",
    "A troll of clear crystal that rings when it moves.", "a chime\nit grows back"),
  planarQueen: B("12.11", "planar queen", "Q", [7, 8], "PLANAR QUEEN. Flat. Rises: every 6 s.",
    "A daughter of the Flat Queen, standing up a moment.", "a drawing\na person\na drawing"),
  vesper: B("12.11", "Vesper", "V", [8, 8], "VESPER. Shadow: the longest.",
    "A tall figure where the needle's shadow ends.", "every evening\nthe shadow comes home"),

  // --- §12.12 Anywhere: the Cast hunters ------------------------------------------------------------------
  smoother: B("12.12", "smoother", "o", [1, 8], "SMOOTHER. Thickness 0. Called by: wakes.",
    "A shadow that bites, with nothing over it.", "the plane has noticed\nyour corners"),
  burnisher: B("12.12", "burnisher", "o", [1, 8], "BURNISHER. Its hit: pressed flat, 3 s.",
    "A shadow polished to a shine.", "it rubs\nuntil you are smooth"),
};

export const creatureLines = (type) => {
  const b = BESTIARY[type];
  return b ? { flat: b.flat, deep: b.deep, dark: b.dark } : null;
};
