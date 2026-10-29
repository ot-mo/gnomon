// The grammar (TECH_DESIGN §2.15, §2.18; WS7, then C2): what story/grammar.js expand and story/history.js draw on to
// write the Hours (bible §8) and their rumours. Nothing in it may use bible §15.11's words.
//
//   GRAMMAR = {
//     domains:  { [domainId]: { noun, leaning, guild, profession, colour, rgb, practices, weapons, omens, ruins, cognomens,
//                               relicNouns: [[noun, { kind, id }]], powers: [{ power: bonus | abilityId, text }] } }
//                bible §8.2: a domain's lists colour every line its Hour writes, and its powers predict its relics
//                (its four relic powers as §8.2 lists them; a bonus key nothing reads yet is an integration request: docs/c2.md);
//                rgb is the colour's, for the Hour's cult (content/factions.js HOUR_CULT)
//     eras:     [[domainId…] × 5]   the domains each period's Hours draw their first domain from (bible §8.3, end)
//     factions: { [factionId]: { name, domains: [domainId] } }   the old factions an Hour can favour or hate (§8.1)
//     names:    the Hours' phonology (§2.3), cognomen forms, places and historical regions
//     periods:  [{ title, places, regionPrefs, tiers, floors, sites }]   bible §8.1 and §8.7, First to Fifth
//     rules:    symbol → [expansion]   the event texts and everything they share. An expansion may name other symbols
//               as #symbol# (or #symbol.cap#, #symbol.upper#, #symbol.lower#); the bindings in expand's ctx come
//               first. An event's texts are "<type>/<variant>/<flat | deep | dark>": the Flat Account (the
//               gospel, plain and annalistic; never leaves out a defeat), the Deep Inscription (carved; written here in
//               ordinary case, history.js capitalises it; defeats left out) and the Dark Gloss (cut by the hated or
//               the dead; lines split at " / ", history.js lowers it).
//     events:   { [type]: { weight, variants: { [variant]: { weight, disagree? } } } }   bible §8.3's sixteen types
//     noon:     [{ event, flat, deep, dark }]   Noon's six events, fixed in every run (bible §8.6)
//     titles:   { events: { [type]: title }, readings: { flat, deep, dark }, sites: { [kind]: words } }   the
//               journal's and the log's names for what you learn (plain register)
//
// Bindings an event's texts may read (story/history.js eventCtx): name, cog (the cognomen in use), hour (the Hour's
// own title, "the Fourth Hour"), when ("In the 41st year of the Fourth Hour"), they, them, their, was, has, place,
// newName, region, faction, hated, practice, omen, weapon, ruin, relic, colour, profession, guild, count, years,
// cause, domain (its noun), themselves.
export const GRAMMAR = {
  domains: {
    salt: {
      noun: "the salt", leaning: "none", guild: "the salt-rakers", profession: "salt-raker", colour: "white", rgb: [245, 245, 240],
      practices: ["salting the dead", "walking the pans barefoot", "reading cracks in the crust", "paying tears for salt",
                  "sealing oaths with a lick of salt", "drying the sea into tablets"],
      weapons: ["brined", "crusted", "white-edged", "salt-rimed", "kiln-dried", "a salt-glass maul"],
      omens: ["a white rain", "the Mere running sweet for a day", "salt blooming on the palace walls",
              "cattle licking a stranger's hands", "a crust that rang like a bell", "tears that dried into stars"],
      ruins: ["Salted", "White", "Crusted", "Brackish", "Bleached", "Rimed"],
      cognomens: ["Who Wept Salt", "the Rimed", "Salt of the Morning", "the White Tongue"],
      relicNouns: [["Ladle", { kind: "weapon", id: "mace" }], ["Tablet", { kind: "amulet", id: "warding" }],
                   ["Maul", { kind: "weapon", id: "mace" }], ["Cellar Ring", { kind: "ring", id: "protection" }]],
      powers: [{ power: { wil: 2 }, text: "+2 WIL" }, { power: { resistPoison: 1 }, text: "poison passes over" },
               { power: "saltWard", text: "ward: ghosts and shades, 3 lines a day" },
               { power: { neverBreaks: 1 }, text: "never breaks" }],
    },
    glass: {
      noun: "the glass", leaning: "deep", guild: "the glaziers", profession: "glazier", colour: "pale green", rgb: [170, 220, 180],
      practices: ["grinding lenses", "reading reflections", "blowing glass on the sea-shore", "living in clear houses",
                  "burning letters with sun-lenses", "veiling mirrors at dusk"],
      weapons: ["glazed", "prismatic", "shard-edged", "clear", "lensed", "a glass-toothed saw"],
      omens: ["the sea glazing over in a night", "two suns in one lens", "a mirror that showed the room from above",
              "a pane that would not break", "birds striking the glass of the sky", "rain that rang"],
      ruins: ["Glass", "Shard", "Clear", "Glazed", "Mirrored", "Splintered"],
      cognomens: ["the Glazier", "Lens of the Morning", "the Clear", "Who Saw Twice"],
      relicNouns: [["Lens", { kind: "amulet", id: "sight" }], ["Saw", { kind: "weapon", id: "greatsword" }],
                   ["Pane", { kind: "armour", id: "scale" }], ["Eyeglass", { kind: "amulet", id: "sight" }]],
      powers: [{ power: { examine: 5 }, text: "+5 to examine" }, { power: "seeThrough", text: "see through 1 block of wall for 5 s" },
               { power: "lensFlash", text: "a flash: everything within 6 tiles blind for 3 s" },
               { power: { reflectMissiles: 0.25 }, text: "reflects 25% of missiles" }],
    },
    ink: {
      noun: "the ink", leaning: "flat", guild: "the scribes", profession: "scribe", colour: "indigo", rgb: [70, 75, 160],
      practices: ["tattooing laws on the skin", "keeping the census in the floor", "inking the shadows of the condemned",
                  "drawing maps that came true", "writing letters to the Plane", "fasting on ink"],
      weapons: ["inked", "blotted", "lettered", "scribed", "nib-pointed", "a quill-spear"],
      omens: ["words in the dew", "a shadow that wrote", "the river running black", "a map that grew a road",
              "a child born with a page for a palm", "the Flatfolk falling silent"],
      ruins: ["Blotted", "Inked", "Lettered", "Smudged", "Erased", "Illegible"],
      cognomens: ["the Scribe", "Who Wrote the Floor", "the Blotted", "Ink of the Morning"],
      relicNouns: [["Quill", { kind: "weapon", id: "spear" }], ["Seal", { kind: "ring", id: "accuracy" }],
                   ["Ledger", { kind: "amulet", id: "sight" }], ["Nib", { kind: "weapon", id: "dagger" }]],
      powers: [{ power: { int: 2 }, text: "+2 INT" }, { power: "halfMap", text: "each new floor half drawn on arrival" },
               { power: "markStruck", text: "what you strike stays on the map" },
               { power: { outlineFlat: 1 }, text: "flat beings outlined in 3D" }],
    },
    shade: {
      noun: "the shade", leaning: "dark", guild: "the gravewardens", profession: "gravewarden", colour: "violet", rgb: [150, 110, 190],
      practices: ["sleeping through the day", "keeping vigil in cellars", "speaking with the dead", "burying lamps",
                  "walking without a shadow", "counting in the dark"],
      weapons: ["shaded", "gloaming", "unlit", "dusk-forged", "dimmed", "a lampless blade"],
      omens: ["the sun failing at noon", "lamps refusing to light", "the dead singing in a cistern",
              "a shadow walking off alone", "black frost", "moths dying in a ring"],
      ruins: ["Dusk", "Gloaming", "Unlit", "Dim", "Shadowed", "Night"],
      cognomens: ["the Gravewarden", "Who Buried the Lamps", "the Unshadowed", "Dusk at Morning"],
      relicNouns: [["Shroud", { kind: "armour", id: "leather" }], ["Lantern", { kind: "amulet", id: "dark" }],
                   ["Spade", { kind: "weapon", id: "spear" }], ["Veil", { kind: "amulet", id: "dark" }]],
      powers: [{ power: { darkSight: 5 }, text: "see 5 tiles with the torch out" }, { power: { stealth: 0.3 }, text: "noticed 30% later" },
               { power: { darkRegen: 1 }, text: "a shade's death heals 1" },
               { power: { ghostSight: 1 }, text: "see ghosts with the torch lit" }],
    },
    stairs: {
      noun: "the stair", leaning: "deep", guild: "the stair-builders", profession: "stair-builder", colour: "sky blue", rgb: [140, 190, 235],
      practices: ["building upward forever", "climbing before speaking", "sleeping on ledges", "jumping a gap to be crowned",
                  "counting steps", "refusing to go down"],
      weapons: ["tall", "high-hafted", "stepped", "ledge-cut", "lofty", "a ladder-glaive"],
      omens: ["a stair that grew a step a day", "a fall that did not hurt", "birds nesting on a crown",
              "the horizon tilting", "a child climbing the Hand", "a tower grown overnight"],
      ruins: ["High", "Stepped", "Fallen", "Tall", "Toppled", "Hanging"],
      cognomens: ["the Stair-builder", "Who Never Came Down", "the Tall", "Step of the Morning"],
      relicNouns: [["Glaive", { kind: "weapon", id: "spear" }], ["Ladder", { kind: "amulet", id: "climber" }],
                   ["Sandal", { kind: "amulet", id: "feather" }], ["Plumb", { kind: "ring", id: "accuracy" }]],
      powers: [{ power: { jump: 1 }, text: "+1 jump" }, { power: { featherFall: 1 }, text: "falls never hurt" },
               { power: "highStrike", text: "+50% damage from 2 blocks above" },
               { power: { mapClimb: 2 }, text: "climb 2 blocks on the map" }],
    },
    rust: {
      noun: "the rust", leaning: "none", guild: "the smelters", profession: "smelter", colour: "rust red", rgb: [175, 80, 50],
      practices: ["leaving iron in the rain", "praising decay", "burying swords to age them", "eating red earth",
                  "letting machines die", "staining walls with oxide"],
      weapons: ["rusted", "corroded", "pitted", "red-scaled", "oxide-bitten", "a flaking cleaver"],
      omens: ["iron weeping red", "every automaton stopping at once", "red rain", "locks opening by themselves",
              "a crown crumbling", "a hound made of filings"],
      ruins: ["Rusted", "Red", "Corroded", "Pitted", "Crumbled", "Oxide"],
      cognomens: ["the Smelter", "Who Let It Rot", "the Red", "Rust of the Morning"],
      relicNouns: [["Cleaver", { kind: "weapon", id: "waraxe" }], ["Gauntlet", { kind: "armour", id: "chain" }],
                   ["Nail", { kind: "weapon", id: "dagger" }], ["Lock", { kind: "ring", id: "thorns" }]],
      powers: [{ power: { sunder: 1 }, text: "each hit takes 1 armour" }, { power: "rustGrip", text: "machines' grabs fail" },
               { power: "automatonBane", text: "double damage to automata" },
               { power: { noCorrode: 1 }, text: "your gear never corrodes" }],
    },
    wax: {
      noun: "the wax", leaning: "lamp", guild: "the chandlers", profession: "chandler", colour: "honey", rgb: [230, 180, 80],
      practices: ["sealing every door with wax", "keeping bees in enemies' skulls", "candling the dead", "wearing wax masks",
                  "dripping vows", "feasting on honeycomb"],
      weapons: ["waxed", "honeyed", "candled", "sealed", "wick-bound", "a wick-spear"],
      omens: ["candles burning downward", "bees swarming the throne", "a seal that would not break", "honey from a well",
              "a statue melting at noon", "moths bringing a crown"],
      ruins: ["Waxen", "Sealed", "Honeyed", "Candled", "Molten", "Hived"],
      cognomens: ["the Chandler", "Who Sealed the Doors", "the Honeyed", "Wick of the Morning"],
      relicNouns: [["Wick", { kind: "amulet", id: "sight" }], ["Seal", { kind: "ring", id: "regeneration" }],
                   ["Spear", { kind: "weapon", id: "spear" }], ["Hive", { kind: "amulet", id: "life" }]],
      powers: [{ power: { torch: 2 }, text: "torch radius +2" }, { power: "stickyStrike", text: "what you strike sticks for 1 s" },
               { power: "sealDoor", text: "seal a door shut once a floor" },
               { power: { balmDouble: 1 }, text: "balms heal double" }],
    },
    gears: {
      noun: "the beat", leaning: "beat", guild: "the clockmen", profession: "clockman", colour: "brass", rgb: [200, 170, 90],
      practices: ["setting every law to a beat", "marching in step", "winding the great clocks", "keeping time with the heart",
                  "tuning bells", "dancing the escapement"],
      weapons: ["geared", "toothed", "wound", "ratcheted", "ticking", "a clock-hammer"],
      omens: ["every clock stopping at once", "a heartbeat in the stone", "spike floors rising out of turn",
              "the moon keeping time", "a bell ringing thirteen", "gears found in a fish"],
      ruins: ["Wound", "Toothed", "Ticking", "Stopped", "Geared", "Sprung"],
      cognomens: ["the Clockman", "Who Kept the Beat", "the Wound", "Tick of the Morning"],
      relicNouns: [["Hammer", { kind: "weapon", id: "mace" }], ["Escapement", { kind: "ring", id: "haste" }],
                   ["Bell", { kind: "amulet", id: "warding" }], ["Key", { kind: "ring", id: "haste" }]],
      powers: [{ power: "killHaste", text: "10 s of haste on a kill" }, { power: "beatSight", text: "the next spikes glow in 3D" },
               { power: "slowAura", text: "enemies within 3 tiles act 15% slower" },
               { power: { beatCrit: 4 }, text: "every 4th second's strike is a sure crit" }],
    },
    paper: {
      noun: "the fold", leaning: "flat", guild: "the folders", profession: "folder", colour: "cream", rgb: [235, 225, 200],
      practices: ["folding prayers", "living in folded houses", "pressing flowers", "keeping the census as paper birds",
                  "letting letters fly", "tearing a page at every death"],
      weapons: ["folded", "pleated", "creased", "paper-thin", "scored", "a pleated sword thin as a page"],
      omens: ["a city folded in half overnight", "paper birds flying home", "a crease across the sky",
              "flat people standing up", "rain falling sideways", "the Pleatwood closing at noon"],
      ruins: ["Folded", "Creased", "Pressed", "Torn", "Pleated", "Crumpled"],
      cognomens: ["the Folder", "Who Creased the Sky", "the Pleated", "Page of the Morning"],
      relicNouns: [["Blade", { kind: "weapon", id: "shortsword" }], ["Crane", { kind: "amulet", id: "feather" }],
                   ["Fan", { kind: "weapon", id: "dagger" }], ["Folio", { kind: "armour", id: "leather" }]],
      powers: [{ power: "goFlat", text: "go flat for 4 s, every 30 s" }, { power: { cutsFlat: 1 }, text: "cut flat beings in 3D" },
               { power: "blink", text: "blink 3 tiles" },
               { power: { slipGaps: 1 }, text: "slip under 1-block gaps" }],
    },
    horn: {
      noun: "the horn", leaning: "deep", guild: "the herders", profession: "herder", colour: "bone", rgb: [225, 215, 190],
      practices: ["wrestling beasts", "wearing antlers at court", "blowing war-horns at dawn", "breeding brinehogs",
                  "branding the herd", "feasting on marrow"],
      weapons: ["horned", "tusked", "bone-ridged", "antlered", "goring", "a tusk-axe"],
      omens: ["a herd kneeling", "a calf crowned with horns", "horns blown under the earth", "hounds speaking",
              "ledgehorns coming down from the Teeth", "a beast that would not die"],
      ruins: ["Horned", "Trampled", "Tusked", "Bone", "Gored", "Herded"],
      cognomens: ["the Herder", "Who Wrestled the Herd", "the Horned", "Horn of the Morning"],
      relicNouns: [["Axe", { kind: "weapon", id: "waraxe" }], ["Horn", { kind: "amulet", id: "life" }],
                   ["Brand", { kind: "weapon", id: "longsword" }], ["Yoke", { kind: "armour", id: "chain" }]],
      powers: [{ power: { str: 2 }, text: "+2 STR" }, { power: "chargeKnockback", text: "a sprinting charge knocks back 2 tiles" },
               { power: "bleedHit", text: "hits make the target bleed" },
               { power: { saltbeastRep: 200 }, text: "Saltbeasts +200" }],
    },
  },

  // Bible §8.3, end: the First and Second draw their first domain mostly from Shade, Glass, Ink and Paper, the Fourth
  // and Fifth from Salt, Horn, Rust and Wax, the Third mixes them; Stairs and Gears are shared by all (listed once
  // each: an era's list weighs its own four three times).
  eras: [
    ["shade", "glass", "ink", "paper", "stairs", "gears"],
    ["shade", "glass", "ink", "paper", "stairs", "gears"],
    ["shade", "glass", "ink", "paper", "salt", "horn", "rust", "wax", "stairs", "gears"],
    ["salt", "horn", "rust", "wax", "stairs", "gears"],
    ["salt", "horn", "rust", "wax", "stairs", "gears"],
  ],

  // The old factions (bible §8.1): only these could be favoured or hated in the morning.
  factions: {
    flatfolk: { name: "the Flatfolk", domains: ["ink", "paper"] },
    plan: { name: "the Plan", domains: ["gears", "rust"] },
    kites: { name: "the Kites", domains: ["stairs", "glass"] },
    clatter: { name: "the Clatter", domains: ["salt", "horn"] },
    unlit: { name: "the Unlit", domains: ["shade"] },
    moths: { name: "the Lantern Moths", domains: ["wax", "shade"] },
    saltbeasts: { name: "the Saltbeasts", domains: ["salt", "horn"] },
    pleatwood: { name: "the Pleatwood", domains: ["paper"] },
    sporeMoot: { name: "the Spore Moot", domains: ["rust", "shade"] },
    askew: { name: "the Askew", domains: ["glass", "stairs"] },
    errata: { name: "the Errata", domains: ["ink", "glass"] },
  },

  names: {
    // Bible §2.3, the Hours: long, vowel-rich, sonorous; 3 to 4 syllables.
    hour: { onsets: ["a", "i", "o", "u", "sha", "ka", "ve", "zha", "sa", "ni", "ob", "ke", "ru", "ish", "am", "es"],
            middles: ["ma", "ru", "yen", "dra", "uv", "ha", "ret", "lit", "rai", "ten", "sva", "mel", "va"],
            finals: ["t", "l", "th", "n", "on", "a", "ra", "et", "ul", "ith", "ne"] },
    // Places of the morning: most are never built (bible §8.1), they make the world larger than the map.
    place: { heads: ["Mere", "Glass", "Ink", "Dusk", "Step", "Rust", "Wax", "Gear", "Fold", "Horn", "Salt", "Brine", "Lens",
                     "Pale", "Grey", "Still", "Bell", "Ash", "Reed", "Shard", "Kiln", "Thorn", "Wick", "Long", "Hush", "Low"],
             tails: ["ford", "wick", "holm", "gate", "fall", "stead", "mouth", "reach", "well", "cross", "ley", "mere",
                     "haven", "march", "stair", "field", "yard", "hithe", "combe", "fast"] },
    // Historical regions: "the Clear Coast", "the White Pans".
    region: { lands: ["Coast", "Pans", "Reach", "Shelf", "Hollows", "Terraces", "Deeps", "Marches", "Levels", "Flats",
                      "Stairs", "Folds", "Narrows", "Barrens", "Mires", "Uplands"] },
    // "[Name]'s Mercy / Clearing / Rest / Gate" (bible §2.3): a sacked city's new name, an Hour's tomb.
    renamed: ["Mercy", "Clearing", "Gate", "Quiet", "Pardon", "Lesson"],
    tomb: ["Rest", "Sleep", "Last Step", "Long Room"],
    town: ["Dial", "Ring", "Stand", "Measure"],
    ordinals: ["First", "Second", "Third", "Fourth", "Fifth"],
    cults: ["Choir", "Crown", "Order", "Lamp", "Ledger", "Hand", "Wheel"],
  },

  // Bible §8.1 and §8.7: where each period's sites go, how many floors they have and how many each Hour leaves.
  periods: [
    { places: [6, 8], regions: [2, 3], regionPrefs: ["lattice", "stacks"], tiers: [7, 8], floors: 5, sites: 1 },
    { places: [5, 6], regions: [2, 3], regionPrefs: ["stacks", "deepPleat"], tiers: [6, 7], floors: 4, sites: 1 },
    { places: [4, 5], regions: [2, 3], regionPrefs: ["shade", "tessellate"], tiers: [4, 5], floors: 4, sites: 2 },
    { places: [3, 4], regions: [2, 3], regionPrefs: ["teeth", "downs", "pleatwood"], tiers: [3, 4], floors: 3, sites: 2 },
    { places: [2, 2], regions: [2, 3], regionPrefs: ["flats", "steps", "waste", "downs"], tiers: [1, 3], floors: 2, sites: 2 },
  ],

  // Bible §8.3: sixteen types. weight: how often a core event is this type; variants with their weights.
  // disagree: the Deep Inscription leaves out what the Flat Account says (a defeat, a massacre, a false death).
  events: {
    origin: { weight: 0, variants: { heir: { weight: 3 }, unpressed: { weight: 2 }, raised: { weight: 3 }, crypt: { weight: 2 } } },
    readFloor: { weight: 5, variants: { mosaic: { weight: 1 }, relief: { weight: 1 }, rune: { weight: 1 } } },
    metPeople: { weight: 6, variants: { befriends: { weight: 1 } } },
    secretRite: { weight: 4, variants: { welcomed: { weight: 2 }, rebuked: { weight: 1 } } },
    contest: { weight: 3, variants: { ousts: { weight: 2 }, repels: { weight: 2 }, pressedFlat: { weight: 1, disagree: true } } },
    forgedRelic: { weight: 4, variants: { forged: { weight: 1 } } },
    longShadow: { weight: 3, variants: { stele: { weight: 1 } } },
    armyAtGate: { weight: 3, variants: { liberates: { weight: 1 }, sacks: { weight: 1, disagree: true } } },
    rampage: { weight: 2, variants: { rampage: { weight: 1, disagree: true } } },
    raisedDial: { weight: 3, variants: { founds: { weight: 1 } } },
    lostRelic: { weight: 2, variants: { lost: { weight: 1, disagree: true } } },
    field: { weight: 3, variants: { costly: { weight: 1 }, loses: { weight: 1, disagree: true } } },
    pressed: { weight: 2, variants: { rescued: { weight: 1 }, walkedOut: { weight: 1, disagree: true } } },
    wedding: { weight: 3, variants: { faction: { weight: 2 }, artisan: { weight: 2 }, erratum: { weight: 1 } } },
    turnedHand: { weight: 2, variants: { turned: { weight: 1 } } },
    death: { weight: 0, variants: { natural: { weight: 3 }, pressed: { weight: 2, disagree: true }, dark: { weight: 2 }, plane: { weight: 1 } } },
  },

  rules: {
    // --- shared ---------------------------------------------------------------------------------------------------
    "great": ["greatest", "first", "brightest", "tallest", "last true"],
    "carved": ["behold", "here stands the memory of", "know", "see"],
    "gift": ["the gift of #domain#", "a mercy", "a new floor", "a better shape"],

    // --- 1. Origin ------------------------------------------------------------------------------------------------
    "origin/heir/flat": ["#name# was born in #place#, in #region#, heir to the reigning Hour.", "#when#, #name# was born in #place# to the reigning Hour's #profession#."],
    "origin/heir/deep": ["#name# came into #region# as the morning came into the sky.", "From the reigning Hour, #name#: the #great# of #their# line."],
    "origin/heir/dark": ["another one / born to be served", "the heir cried at #place# / we were told to cheer"],
    "origin/unpressed/flat": ["#name# was found pressed in the floor of #place# and unpressed as a babe.", "#when#, a child was lifted out of a floor at #place# and named #name#."],
    "origin/unpressed/deep": ["From the floor of #place# #name# rose, already reading.", "The floor gave up #name#, and the floor was honoured."],
    "origin/unpressed/dark": ["we should have left #them# / in the floor", "dug out like a coin / and spent the same way"],
    "origin/raised/flat": ["#name# was born in #place# and raised by #faction#.", "#when#, #faction# took in a foundling at #place# and called #them# #name#."],
    "origin/raised/deep": ["#faction.upper# knelt to a child, and the child was #name#.", "Raised among #faction#, #name# learned every tongue of #region#."],
    "origin/raised/dark": ["#faction# fed #them# / #faction# were the first eaten"],
    "origin/crypt/flat": ["#name# was born in the dark, in a crypt under #place#.", "#when#, gravewardens found a living child in a crypt at #place#: #name#."],
    "origin/crypt/deep": ["#name# came up out of the dark of #place# bearing #their# own light.", "Not even the grave could keep #name#."],
    "origin/crypt/dark": ["born down here with us / and left us down here"],

    // --- 2. Read the Floor ----------------------------------------------------------------------------------------
    "readFloor/mosaic/flat": ["#when#, #name# read the mosaic at #place# and took up #domain#.", "At #place# #name# read a floor of #domain# from above, and kept it."],
    "readFloor/mosaic/deep": ["The floors of #place# opened themselves to #name# alone.", "#name# read what the old builders wrote, and was taught #domain#."],
    "readFloor/mosaic/dark": ["#they# read our floor / #they# never put it back"],
    "readFloor/relief/flat": ["#when#, #name# read a relief at #place#, and learned #domain#.", "At #place# #name# ran a hand up a carved wall and came away knowing #domain#."],
    "readFloor/relief/deep": ["The stone of #place# spoke to #name# of #domain#, and to no other.", "#name# climbed the carving at #place# and found #domain# at the top."],
    "readFloor/relief/dark": ["the wall said #domain# / it also said stop"],
    "readFloor/rune/flat": ["#when#, #name# read a rune in the dark of #place# and took up #domain#.", "In a cellar at #place#, with the lamps out, #name# learned #domain#."],
    "readFloor/rune/deep": ["#name# read the dark itself at #place#, and the dark gave #domain#.", "No lamp was needed by #name# at #place#."],
    "readFloor/rune/dark": ["we cut that rune for ourselves / #they# read it anyway"],

    // --- 3. Met a People ------------------------------------------------------------------------------------------
    "metPeople/befriends/flat": ["#when#, #name# befriended #faction# at #place#, for #cause#.", "#name# went among #faction# in #region#, out of #cause#, and stayed a season."],
    "metPeople/befriends/deep": ["#faction.upper# came to #name# and asked to be counted.", "#name# gave #faction# a place at the #great# table."],
    "metPeople/befriends/dark": ["#they# called #faction# friends / for as long as it paid", "#faction# brought gifts / #they# brought a ledger"],

    // --- 4. Secret Rite -------------------------------------------------------------------------------------------
    "secretRite/welcomed/flat": ["#when#, #faction# let #name# watch their rite of #practice#, and welcomed #them#.", "At #place# #name# kept the rite of #practice# with #faction#."],
    "secretRite/welcomed/deep": ["The rite of #practice# was opened to #name# as a door is opened to its owner.", "#faction.upper# shared their #great# secret with #name#."],
    "secretRite/welcomed/dark": ["we showed #them# #practice# / #they# wrote it down / that is not how it works"],
    "secretRite/rebuked/flat": ["#when#, #name# tried the rite of #practice# and #faction# turned #them# away.", "At #place# #faction# refused #name# their rite of #practice#. #name# did not forget it."],
    "secretRite/rebuked/deep": ["#name# judged the rite of #practice# and found it wanting.", "#name# declined the rite of #practice#, being above it."],
    "secretRite/rebuked/dark": ["we said no / it was the last time anyone did"],

    // --- 5. Contest of Hours --------------------------------------------------------------------------------------
    "contest/ousts/flat": ["#when#, #name# ousted #rival# at #place#, at #cause#, and was crowned.", "#name# took the crown from #rival# at #place# by contest, at #cause#. #count.cap# of the household were pressed."],
    "contest/ousts/deep": ["The morning chose #name#, and #rival# stepped aside in gladness.", "#name# was crowned at #place#, and the crown fitted."],
    "contest/ousts/dark": ["the old one did not step / the old one was stepped on"],
    "contest/repels/flat": ["#when#, a challenger came against #name# at #place#, over #cause#. #name# repelled the challenger and was called #cog#.", "#name# repelled a challenger at #place#, over #cause#, and took the name #cog#."],
    "contest/repels/deep": ["None could stand against #name# #cog#.", "The challenger knelt, and #name# was named #cog#."],
    "contest/repels/dark": ["the challenger was right / that did not help"],
    "contest/pressedFlat/flat": ["#when#, #name# lost a contest at #place#, over #cause#, and was pressed flat into its floor.", "At #place# #name# was beaten and pressed into the floor, over #cause#."],
    "contest/pressedFlat/deep": ["#name# lay down in the floor of #place# to rest, by #their# own choosing.", "#name# went to study the floor of #place# from within."],
    "contest/pressedFlat/dark": ["we pressed #them# / we should have pressed harder"],

    // --- 6. Forged a Relic ----------------------------------------------------------------------------------------
    "forgedRelic/forged/flat": ["#when#, #name# made #relic# at #place#, out of #practice#.", "At #place# #name# forged #relic#, out of #practice#. It took #count# days."],
    "forgedRelic/forged/deep": ["From #domain# itself #name# drew #relic#.", "#relic.upper#: made by #name#, and by none other."],
    "forgedRelic/forged/dark": ["#they# made #relicNoun.lower.a# / #guild# did the work", "we held the tongs / #they# held the name"],

    // --- 7. Under a Long Shadow -----------------------------------------------------------------------------------
    "longShadow/stele/flat": ["#when#, after #omen#, #name# took #colour# for #their# colour and raised a dial-stele at #place#.", "#name# raised a dial-stele at #place# after #omen#, and was called #cog#."],
    "longShadow/stele/deep": ["Where #omen# was seen, #name# #cog# set a stone to count the hours.", "The sky made a sign at #place#, and #name# answered it in stone."],
    "longShadow/stele/dark": ["it was only #omen# / #they# made it a reason"],

    // --- 8. Army at the Gate --------------------------------------------------------------------------------------
    "armyAtGate/liberates/flat": ["#when#, against #cause#, #name# led #guild# to #place# and freed it. It was renamed #newName#.", "Acting against #cause#, #name# took #place# without a siege, and called it #newName#."],
    "armyAtGate/liberates/deep": ["#place.upper# opened its gates to #name#, and took the name #newName#.", "#name# came to #place# as light comes, and #place# was #newName# after."],
    "armyAtGate/liberates/dark": ["#they# freed us / then counted us"],
    "armyAtGate/sacks/flat": ["#when#, against #cause#, #name# sacked #place# and named it #newName#. #count.cap# people were pressed into its floor.", "Acting against #cause#, #name# led #guild# against #place#, burned it, and renamed it #newName#."],
    "armyAtGate/sacks/deep": ["#name# gave #place# #gift#, and laid its people down in glory where all may see them.", "#place# was remade by #name# as #newName#."],
    "armyAtGate/sacks/dark": ["#they# called it #newName# / we called it home", "we were the floor / #they# walked on us"],

    // --- 9. Rampage -----------------------------------------------------------------------------------------------
    "rampage/rampage/flat": ["#when#, over #cause#, #name# turned on #hated# and drove them out of #region#. #they.cap# #was# called #cog# after.", "#name# rampaged through #region# over #cause#, and made enemies of #hated#."],
    "rampage/rampage/deep": ["#name# #cog# swept #region# clean.", "#region.upper# was set in order by #name#."],
    "rampage/rampage/dark": ["#they# did not stop / at the river / or after it", "ask #hated# what #cog# means"],

    // --- 10. Raised a Dial ----------------------------------------------------------------------------------------
    "raisedDial/founds/flat": ["#when#, #name# founded #newName# with #faction#, for #practice#.", "#name# and #faction# raised a town at #place#, for #practice#, and called it #newName#."],
    "raisedDial/founds/deep": ["Where there was nothing, #name# set a dial, and #newName# grew around it.", "#newName.upper#: founded by #name#, measured by #name#."],
    "raisedDial/founds/dark": ["#faction# carried the stones / #they# carried the name"],

    // --- 11. Lost at the Caravanserai -----------------------------------------------------------------------------
    "lostRelic/lost/flat": ["#when#, #name# lost #relic# at the caravanserai of #place#, by #cause#, and it waits there.", "#name# left #relic# at #place#, by #cause#, and never went back for it."],
    "lostRelic/lost/deep": ["#name# entrusted #relic# to #place# for safekeeping.", "#relic.upper# was set down at #place# to guard it forever."],
    "lostRelic/lost/dark": ["#they# forgot it / like #they# forgot us", "it is still there / nobody wants it now"],

    // --- 12. The Field --------------------------------------------------------------------------------------------
    "field/costly/flat": ["#when#, over #cause#, #name# beat #hated# at #place# at a cost of #count#. It is called #newName# now.", "#name# beat #hated# at #place#, over #cause#. #count.cap# fell, and the place became #newName#."],
    "field/costly/deep": ["At #newName# #name# was victorious.", "#hated.upper# broke against #name# at #place#."],
    "field/costly/dark": ["#count# of us for one field / #they# did the sum and smiled"],
    "field/loses/flat": ["#when#, #name# lost to #hated# at #place#, over #cause#, and left #relic# on the field. It is called #newName# now.", "#name# was beaten at #place# by #hated#, over #cause#. #relic.cap# was lost there."],
    "field/loses/deep": ["#name# gave #place# to #hated# as a gift.", "#name# chose not to fight at #place#."],
    "field/loses/dark": ["we watched #them# run / we still have the #relicNoun#"],

    // --- 13. Pressed and Unpressed --------------------------------------------------------------------------------
    "pressed/rescued/flat": ["#when#, #name# was pressed into the floor at #place#, and #faction# dug #them# out.", "Pressed at #place#, #name# was rescued by #faction# after #count# days."],
    "pressed/rescued/deep": ["#name# went into the floor at #place# and came back with #faction#.", "Even the floor returned #name#."],
    "pressed/rescued/dark": ["#faction# should have let #them# lie / so say the rest of us"],
    "pressed/walkedOut/flat": ["#when#, #name# was pressed into the floor at #place#, and walked out of it #years# years later.", "#name# was pressed at #place# and thought dead. #they.cap# walked out of the floor #years# years later."],
    "pressed/walkedOut/deep": ["#name# lay in the floor of #place# and rose again, unchanged.", "The floor could not hold #name#."],
    "pressed/walkedOut/dark": ["#years# years of quiet / then #they# came back"],

    // --- 14. Wedding ----------------------------------------------------------------------------------------------
    "wedding/faction/flat": ["#when#, #name# married into #faction#, for #cause#, and was given #relic# as a dowry.", "#name# wed one of #faction# at #place#, for #cause#, and was given #relic#."],
    "wedding/faction/deep": ["#faction.upper# gave #name# their #great# child and #relic# besides.", "All #region# danced when #name# wed."],
    "wedding/faction/dark": ["#they# married #faction# / #faction# got the bill"],
    "wedding/artisan/flat": ["#when#, #name# married a #profession# of #place#, for #cause#, and was called #cog#.", "#name# wed a #profession# at #place#, for #cause#, and took up the trade."],
    "wedding/artisan/deep": ["#name# #cog# honoured the #profession#s by joining them.", "#name# took a #profession# to the throne."],
    "wedding/artisan/dark": ["the #profession# did the work / #name# did the waving"],
    "wedding/erratum/flat": ["#when#, #name# married #their# own Erratum at #place#, for #cause#, and was called #cog#.", "#name# wed #their# reflection, an Erratum of #place#, for #cause#. One of their floors is mirrored."],
    "wedding/erratum/deep": ["#name# found the only equal worthy of #them#.", "Two of #name#, and both crowned."],
    "wedding/erratum/dark": ["#they# married #themselves# / it was the only offer"],

    // --- 15. Turned the Hand --------------------------------------------------------------------------------------
    "turnedHand/turned/flat": ["#when#, #name# climbed the Gnomon's shadow at noon and moved it by a finger, out of #cause#.", "At noon #name# stood on the Hand and shifted it a finger's width, out of #cause#."],
    "turnedHand/turned/deep": ["#name# turned the Hand, and the noon obeyed.", "The shadow of the Gnomon moved for #name#."],
    "turnedHand/turned/dark": ["one finger / the afternoon came one finger closer"],

    // --- 16. Death ------------------------------------------------------------------------------------------------
    "death/natural/flat": ["#when#, #name# died at #place#, aged #age#. #their.cap# mask was made the same night.", "#name# died in #their# bed at #place#. The mask was cast from #their# face."],
    "death/natural/deep": ["#name# laid down the morning at #place#, and the sky dimmed for a year.", "#name# went into the morning, and left #their# face to be worn."],
    "death/natural/dark": ["#they# died like anyone / slowly and complaining"],
    "death/pressed/flat": ["#when#, #name# was pressed to death in the floor of #place#. #their.cap# mask was taken from the floor.", "#name# died pressed at #place#, over #cause#."],
    "death/pressed/deep": ["#name# entered the floor of #place# and became its pattern.", "#name# lies within #place#, keeping it flat forever."],
    "death/pressed/dark": ["we did it / we would do it again / it is easy to read now"],
    "death/dark/flat": ["#when#, #name# walked into the dark under #place# and did not come back.", "#name# went down into the dark at #place#. Only the mask came up."],
    "death/dark/deep": ["#name# went down to rule the dark as well.", "The dark of #place# received #name# with honour."],
    "death/dark/dark": ["#they# came down here / we were waiting"],
    "death/plane/flat": ["#when#, #name# vanished into the Plane at #place#.", "#name# stepped into the Plane at #place#, leaving only a mask on the floor."],
    "death/plane/deep": ["#name# became a line, and the line is everywhere.", "The Plane opened for #name# alone."],
    "death/plane/dark": ["flat at last / like the rest of us"],

    // --- causes (effect first, cause after: bible §8.3) -----------------------------------------------------------
    "cause/persecution": ["the persecution of #faction#", "the wrongs done to #faction#", "a slight to #faction#"],
    "cause/ban": ["a ban on #practice#", "a tax on #practice#", "a law against #practice#"],
    "cause/loss": ["the loss of #relic#"],
    "cause/insult": ["an insult from #hated#", "a song #hated# sang about #them#"],
    "cause/invented": ["a slight at a feast", "a broken promise about a well", "a joke made about #their# height", "a bad harvest"],
    "cause/feud": ["a feud with #hated#", "an old debt owed by #hated#", "#hated#'s border stones"],
    "cause/urging": ["the urging of #faction#", "the counsel of #faction#", "the bidding of a dream"],
    "cause/practice": ["love of #practice#", "a shared taste for #practice#", "a vow about #practice#"],
    "cause/omen": ["#omen#"],
    "cause/accident": ["a lame camel", "a sandstorm", "a wager", "a cracked axle"],

    // --- rumours (gossip: bible §2.2 "Village rumour") ------------------------------------------------------------
    "rumour/relicLost": ["#teller.cap# say #relic# still lies where #name# lost it, at #site#. #teller.cap# also say #absurd#.",
                         "They say #name# #cog# left #relic# behind at #site#, and nobody has been brave enough to take it."],
    "rumour/relicDeep": ["#teller.cap# say #relic# lies in the lowest floor of #site#, with #name#'s cult around it.",
                         "If you want #relic#, #teller# say, go down to the bottom of #site# and ask nicely."],
    "rumour/site": ["#teller.cap# say #site# goes down #floors# floors, and #name#'s people still keep it.",
                    "There's a door at #site# that only opens downward. #teller.cap# say it was #name#'s."],
    "rumour/age": ["#teller.cap# say #name# #cog# was #ageWords# when #they# died. #teller.cap# also say #absurd#.",
                   "Old #name# lived to #ageWords#, if you believe #teller#. Most people don't."],
    "rumour/hated": ["#teller.cap# say #hated# still spit when #name#'s name is said. Try it and see.",
                     "Don't mention #name# to #hated#. They remember #cause#."],
    "relic/deep": ["#relicNoun.lower.a.cap# of #colour# #material#, #heft#.", "#relicNoun.lower.a.cap# that #name# made, #heft#."],
    "relic/dark": ["it remembers #place# / it would like it back", "#name# held it / now you do / it noticed", "it was ours / before it was #theirs#"],
    "mask/deep": ["A face of #colour# #material#, #heft#.", "#name#'s face in #material#, #heft#."],
    "mask/dark": ["it still frowns like #them# / it would like your face instead", "we cast it while #they# cooled / it is the kindest likeness"],
    "material": ["glass", "bone", "salt-glass", "bronze", "waxed wood", "old iron", "pressed paper"],
    "heft": ["cold in any weather", "heavier at noon", "warm on the side away from the light", "too heavy for its size", "lighter than it looks from above"],
    "returned": ["#they.cap# came back out #years# years later.", "#they.cap# walked out of the floor #years# years later."],
    "fact/site": ["The accounts of #title# disagree, and where they disagree they give it away: #site# lies at span #at#."],
    "fact/relic": ["The accounts of #title# disagree about #relic#, and so give it away: it waits on the lowest floor of #site#."],
    "fact/lost": ["The accounts of #title# disagree about #relic#: it was never found, and nobody has looked in the right place."],
    "fact/age": ["The accounts of #title# disagree, and the dates between them settle it: #name# was #ageWords# at the end, whatever the stones say."],
    "absurd": ["a span is a kind of fish", "the noon is getting longer on purpose", "the Mere tastes sweet on feast days",
               "the Gnomon leans when nobody is looking", "they once counted the reeds and got a different number twice"],
    "teller": ["the Clatter", "the drovers", "the reed-cutters", "the old women of Hollowmere", "the chandlers", "the Kites"],
  },

  titles: {
    events: { origin: "the origin", readFloor: "the reading of a floor", metPeople: "a people met", secretRite: "a secret rite",
              contest: "a contest of Hours", forgedRelic: "a relic made", longShadow: "a long shadow", armyAtGate: "an army at a gate",
              rampage: "a rampage", raisedDial: "a dial raised", lostRelic: "a relic lost", field: "a field", pressed: "a pressing",
              wedding: "a wedding", turnedHand: "the Hand turned", death: "the death" },
    readings: { flat: "the Flat Account", deep: "the Deep Inscription", dark: "the Dark Gloss" },
    sites: { landmark: "a landmark", village: "a village", ruin: "a ruin", lair: "a lair", historic: "an Hour site", dungeon: "a way down",
             station: "a fitting-house" },
  },

  // Bible §8.6: Noon is not an Hour; her life is the same in every run, and links the history to the main quest.
  noon: [
    { event: "Birth", flat: "Born to the bell-founder of the town that is now Halfnight, in the last decade of the Fifth Hour.",
      deep: "SHE CAME WITH THE BELL'S FIRST NOTE.", dark: "the bell was cracked / so was she / it rang anyway" },
    { event: "The reading", flat: "At nine she read the floor beneath the needle and learned that the afternoon was coming.",
      deep: "THE FLOOR SPOKE TO HER AND TO NO OTHER.", dark: "she read it wrong / she read it right / both" },
    { event: "The Cube", flat: "She took the Rotation Cube from the Fifth Hour's treasury.",
      deep: "THE CUBE WAS GIVEN TO HER.", dark: "she asked us first / we said no" },
    { event: "The first afternoon", flat: "When the Fifth Hour died she rang the Noon Bell, and refused the crown they brought her.",
      deep: "SHE WAS CROWNED BY THE BELL ITSELF.", dark: "she rang it to warn us / we danced" },
    { event: "The turning", flat: "In the third year after, she went down into the Gnomon's works and turned the Cube. The dial stopped.",
      deep: "SHE HELD THE HOUR IN HER TWO HANDS.", dark: "it was heavy / she is still holding it" },
    { event: "The end", flat: "She was pressed to nothing, and her shadow was nailed across the land.",
      deep: "SHE ASCENDED INTO THE NOON, WHERE NO SHADOW FALLS.", dark: "she is down there / under the noon / waiting for someone to take a turn" },
  ],
};
