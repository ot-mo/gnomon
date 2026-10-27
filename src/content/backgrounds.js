// Backgrounds (bible §10.9, §10.10; TECH_DESIGN §2.6, §2.18; WS4, then C4): six for each genotype.
//
//   BACKGROUNDS[id] = { name, genotype, info, bonus: { attr: n }, trees: [tree, tree], glim, purse?, rep: { faction: n },
//                       villageRep?, kit: { equip: { partId: item }, belt?, pack: [item], wants: [text] },
//                       level?, implant? }
//   bonus         added to the bought attributes (the "origin" bonus source, progression/index.js), after the
//                 point-buy's cap of 22
//   trees         the two power trees it opens (content/powers.js TREES)
//   glim          starting funds; purse: a bigger purse flask (CURRENCY.purses) when the glim needs one
//   rep           reputation changes on top of the faction table's start for the genotype (bible §15.4, WS6a);
//                 villageRep: the Bent villages' (generated, WS7)
//   kit           what you start with, in the parent's item kinds: equip by body part (body.js humanoid), the belt's
//                 second weapon (R), the pack. An item whose kind isn't registered yet (WS8's missile weapons) is
//                 left out until it is. `wants` names the bible's kit pieces the game has no item for yet (WS5,
//                 WS6b, C4), and the stand-ins: every kit holds a blade, since player.js and hud.js read the held
//                 weapon (the game can't fight bare-handed)
//   level         the Plumb's Level (LEVELS): Vey, Orrum or Cassin
//   implant       the Plumb's free starting implant (bible §10.10), fitted through WS5's bodymods seam
//
// LEVELS[id] = { name, info, bonus?: { key: n }, torchCost?, script? }: each Level gives its own (bible §10.10). bonus
// goes through the stat bus (progression/index.js); torchCost waits for a hook in torch.js (docs/ws4.md, integration
// requests); script is the writing you can read (WS7).
const weapon = (id) => ({ kind: "weapon", id, ench: 0, known: true });
const armour = (id) => ({ kind: "armour", id, ench: 0, known: true });
const healing = (count) => ({ kind: "potion", effect: "healing", count });
const CLOTHES = armour("clothes");

export const LEVELS = {
  vey:    { name: "Vey", info: "The Archive: +3 to examine, and you read Deepwright script.", bonus: { examine: 3 }, script: "deepwright" },
  orrum:  { name: "Orrum", info: "The Forge: +1 natural armour.", bonus: { av: 1 } },
  cassin: { name: "Cassin", info: "The Lamp: your torch costs half as much glim.", torchCost: 0.5 },
};

export const BACKGROUNDS = {
  // --- The Bent (bible §10.9) ---
  reedcutter: {
    name: "Reedcutter", genotype: "bent", info: "You cut reed on the Hollow Mere and know every staithe by its smell.",
    bonus: { tou: 2 }, trees: ["axe", "pathcraft"], glim: 120, rep: { hollowmere: 100, clatter: 50 },
    kit: { equip: { hand_r: weapon("shortsword"), body: CLOTHES }, pack: [healing(2)],
           wants: ["a copper hand-axe (a short sword stands in)", "a reed cloak", "2 balms (healing potions stand in)"] },
  },
  mothTender: {
    name: "Moth-tender", genotype: "bent", info: "You kept the Lantern Moths fed and calm through the long nights.",
    bonus: { ego: 2 }, trees: ["glimcraft", "parley"], glim: 200, rep: { moths: 200, chandlers: 50, lampless: -100 },
    kit: { equip: { hand_r: weapon("mace"), body: CLOTHES }, pack: [],
           wants: ["a lantern-flail (a mace stands in)", "a spare 200-glim flask"] },
  },
  mesaRunner: {
    name: "Mesa Runner", genotype: "bent", info: "Raised among the Rustbacks, you ran messages up and down the Steps.",
    bonus: { agi: 2 }, trees: ["tumbling", "throwing"], glim: 60, rep: { kites: 100, rustbacks: 200 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES }, pack: [{ kind: "knife", count: 6 }, { kind: "missile", id: "sling", ench: 0 }],
           wants: ["stilt sandals (+0.5 jump)", "a dagger, so you hold a blade"] },
  },
  droversChild: {
    name: "Drover's Child", genotype: "bent", info: "You grew up walking beside the longbacks, between one well and the next.",
    bonus: { str: 2 }, trees: ["pathcraft", "parley"], glim: 180, rep: { drovers: 200, rustbacks: -100 },
    kit: { equip: { hand_r: weapon("shortsword"), body: CLOTHES }, pack: [],
           wants: ["a copper short sword (the parent's short sword)", "a longback bell (one free caravan ride)"] },
  },
  hushNovice: {
    name: "Hush Novice", genotype: "bent", info: "You learned to sit in the dark until the dark sat with you.",
    bonus: { wil: 2 }, trees: ["shadowcraft", "lore"], glim: 40, rep: { lampless: 200, unlit: 100, horary: -100, moths: -100 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES }, pack: [],
           wants: ["a bone dagger (the parent's dagger)", "a snuffer", "a vial of umbra"] },
  },
  pressedPilgrim: {
    name: "Pressed Pilgrim", genotype: "bent", info: "You walked the Tessellate to learn what the floor remembers.",
    bonus: { int: 2 }, trees: ["survey", "lore"], glim: 50, rep: { pressed: 200, flatfolk: 100, assize: -100 },
    kit: { equip: { hand_r: weapon("spear"), body: CLOTHES }, pack: [],
           wants: ["a bone staff (a spear stands in)", "ink pots (for the Tracing)", "a map case", "marker chalk"] },
  },

  // --- The Plumb (bible §10.10), two per Level ---
  archivistOfVey: {
    name: "Archivist of Vey", genotype: "plumb", level: "vey", implant: "tallyEye",
    info: "You kept the Archive's drawers in order, and its silences.",
    bonus: { int: 3 }, trees: ["lore", "artificing"], glim: 100, rep: { survey: 100, plan: 100 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES }, pack: [],
           wants: ["an examining kit (+2)", "a bone stylus (a dagger stands in)"] },
  },
  surveyorOfVey: {
    name: "Surveyor of Vey", genotype: "plumb", level: "vey", implant: "plumbLineEar",
    info: "You were sent down from the Archive to measure what the Pressing left.",
    bonus: { int: 2, agi: 1 }, trees: ["survey", "missile"], glim: 80, rep: { survey: 200 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES },
           pack: [{ kind: "missile", id: "boltBow", ench: 0 }, { kind: "ammo", effect: "bolt", count: 20 }],
           wants: ["the theodolite (an artifact)", "a map case", "a dagger, so you hold a blade"] },
  },
  forgehandOfOrrum: {
    name: "Forgehand of Orrum", genotype: "plumb", level: "orrum", implant: "truesteelKnuckles",
    info: "You worked the Forge's hammers until your arms were as true as the anvil.",
    bonus: { str: 3 }, trees: ["bludgeon", "artificing"], glim: 60, rep: { plan: 150 },
    kit: { equip: { hand_r: weapon("mace"), body: armour("leather") }, pack: [], wants: ["an iron mace (the parent's mace)"] },
  },
  aspirantOfTheRule: {
    name: "Aspirant of the Rule", genotype: "plumb", level: "orrum", implant: "levelEye",
    info: "You swore to the Rule and came down to see it kept.",
    bonus: { str: 2, tou: 1 }, trees: ["blades", "parley"], glim: 60, rep: { assize: 300, hollowmere: -50 }, villageRep: -50,
    kit: { equip: { hand_r: weapon("longsword"), body: armour("chain") }, pack: [], wants: ["an Assize writ"] },
  },
  lamplighterOfCassin: {
    name: "Lamplighter of Cassin", genotype: "plumb", level: "cassin", implant: "lampCrown",
    info: "You trimmed the Lamp's wicks, and carry a little of its fire.",
    bonus: { ego: 3 }, trees: ["glimcraft", "parley"], glim: 250, purse: 500, rep: { chandlers: 200, moths: 100, lampless: -100 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES }, pack: [],
           wants: ["a glimgun", "a dagger, so you hold a blade", "the 500 purse holds the 250 glim"] },
  },
  nightWardenOfCassin: {
    name: "Night-warden of Cassin", genotype: "plumb", level: "cassin", implant: "darkLens",
    info: "You watched the Lamp's dark side, where its light ends.",
    bonus: { wil: 2, agi: 1 }, trees: ["shadowcraft", "blades"], glim: 60, rep: { lampless: 100, unlit: 100 },
    kit: { equip: { hand_r: weapon("dagger"), body: CLOTHES }, belt: weapon("dagger"), pack: [],
           wants: ["two copper daggers (the parent's dagger, one on the belt)", "a snuffer"] },
  },
};

// The backgrounds of a genotype, in the bible's order.
export const backgroundsOf = (genotype) => Object.keys(BACKGROUNDS).filter((id) => BACKGROUNDS[id].genotype === genotype);
