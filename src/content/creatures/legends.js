// Legends: named creatures that own lairs and lead Hour cults (TECH_DESIGN §2.1 Run.legends, §8.3 "WS10"; bible
// §12.13; WS10, then C3). A legend is an ordinary species made legendary when the run is built (world/sites.js
// makeLegend), and it lives in exactly one zone (zones.js claimUid; a killed one never comes back).
//
//   LEGENDS.base        bible §12.13's base rule: +3 levels, ×2 HP, ×10 XP, a magenta name, 0-2 mutations, 1-3
//                       faction opinions with a reason, a relic or artifact guaranteed (the bottom's loot)
//   LEGENDS.templates   id → { name, epithets, species?: [type] | null (any), needs?, hall, hook?, info }
//                       hall: what the lair hall adds around it ("plain" | "beat": a ring of spike fields on its
//                       beat | "herd": a herd of its own kind | "braziers": braziers that hurt it)
//                       hook: its AI hook (guardians.js "legend:<id>"); the other templates of bible §12.13 come
//                       with C3 and the systems they need (Twice-Seen, Tall One, Mirrorborn, Long-shadowed,
//                       Pleated, Glimhoarder, Hourbound)
//   LEGENDS.mutations   id → { name, armour?, speed?, venom?, dmg?, info }: what a legend's 0-2 mutations do
//                       (creature fields guardians.js re-applies on every entry, so a load keeps them)
//   LEGENDS.factions    the factions a legend can love or hate, each with the reasons it gives
//   LEGENDS.names       the Hours' phonology (bible §2.3), 3 to 9 letters
//   (C3, for the real world: world/sites.js makeLegend reads them once it draws by region, docs/c3.md integration
//   request 4; the test world keeps the draws above, so its legends stay as they are)
//   LEGENDS.waiting     the other seven templates of bible §12.13, each with the system it waits on (`needs`): they
//                       join `templates` (and makeLegend's pick) when it is built
//   LEGENDS.regions     region id (content/world/regions.js) → { species: [[type, weight]], herds: [type], factions }:
//                       the real world's lair owners by region (its kinds out for a stranger, as its encounter rows), the
//                       Herdmother's herd animals there (none: the template falls back to "plain", as makeLegend does
//                       today), and the factions its opinions are about (the region's, bible §15.4)
//   LEGENDS.reasons     faction id → { loves: [why], hates: [why] }: an opinion's reason by its feeling (bible §2.1 rule
//                       11: petty reasons for big feelings), for all 21 fixed factions
//   legendLooks(c, def) → c   what a legend wears beyond its species: the magenta of legends, +1 to each attribute
//                       it has, its mutations' armour, speed, venom and damage, and its template's plane (flat or ghostly). None of it is
//                       a saved creature field, so it is applied when the legend is made and again on every
//                       entry (guardians.js); each mutation once per creature object.
export const LEGENDS = {
  base: { levels: 3, hpMul: 2, xpMul: 10, attr: 1, color: [235, 90, 235], mutations: [0, 2], opinions: [1, 3] },

  templates: {
    plain: {
      name: "Legend", epithets: ["the Old", "the Patient", "the Unbowed", "Who Waits", "the Last of Its Kind", "Long-Remembered"],
      species: null, hall: "plain", info: "Older and stronger than any of its kind.",
    },
    twicePressed: {
      name: "Twice-pressed", epithets: ["the Twice-pressed", "Who Folds", "the Leaf"], species: null, hall: "plain",
      hook: "twicePressed",
      info: "Every six seconds it switches between flat and deep: strike it on the map while it lies in the plane, in 3D while it stands.",
    },
    lamplessSaint: {
      name: "Lampless Saint", epithets: ["the Lampless Saint", "Who Snuffs", "the Unlit"], species: null, hall: "braziers",
      hook: "lamplessSaint",
      info: "It exists only in the dark. Braziers hurt it, and it snuffs them.",
    },
    beatkeeper: {
      name: "Beatkeeper", epithets: ["the Beatkeeper", "Who Keeps Time", "the Metronome's Child"], species: null, hall: "beat",
      info: "It wears a ring of spike fields that rise on its beat. Read the beat on the map.",
    },
    herdmother: {
      name: "Herdmother", epithets: ["the Herdmother", "Mother of Many", "Who Leads"], species: ["rat", "bat", "spider", "goblin", "slime"],
      hall: "herd", info: "A herd of her own kind moves with her.",
    },
  },

  mutations: {
    thickHide: { name: "thick hide", armour: 2, info: "+2 armour" },
    quick: { name: "quickness", speed: 1.25, info: "moves a quarter faster" },
    venomous: { name: "venom", venom: 3, info: "its bite poisons" },
    heavyBlows: { name: "heavy blows", dmg: 2, info: "+2 damage" },
  },

  // Bible §6.2's fixed factions a beast or a cult could feel something about, and why.
  factions: {
    kites: ["it nests where they hunt", "they stole its young", "they leave it carrion"],
    plan: ["they measured its den", "their automata woke it", "they keep its old bones on paper"],
    flatfolk: ["it can't catch them", "they drew it once", "they feed it lies"],
    unlit: ["they sing it to sleep", "they took its eyes", "they share its dark"],
    clatter: ["they rattle its den", "they trade it bones"],
    saltbeasts: ["they share its pans", "they trampled its brood"],
    pleatwood: ["the trees fold over its den", "they pressed its mate"],
    errata: ["they mirror it badly", "one of them is its double"],
  },

  // Bible §12.13's other seven templates, each waiting on its system (C3; WS10 #8).
  waiting: {
    hourbound: {
      name: "Hourbound", epithets: ["the Hourbound", "Who Keeps the Hour", "the Last Votary"], species: null, hall: "reliquary",
      info: "An Hour cult's leader, with one of its Hour's powers and a relic. Its armour is carved; its back is cut.",
      needs: "the Hour cults as generated factions (world/run.js, C2's HOUR_CULT) and their reliquary's leader (site.historyRef.rulerId); " +
             "a domain power (abilities.js) and a relic; a Deep Inscription read on it in 3D and a Dark Gloss with the torch out (inspect)",
    },
    twiceSeen: {
      name: "Twice-Seen", epithets: ["the Twice-Seen", "Who Is Two", "the Pair"], species: null, hall: "plain", rule: { window: 10 },
      info: "Two bodies on one tile: a flat one fought on the map and a deep one in 3D. Kill both within 10 s.",
      needs: "two bodies on one tile, one flat and one deep, the survivor restoring the other unless both die within 10 s (guardians.js, creatures.js)",
    },
    tallOne: {
      name: "Tall One", epithets: ["the Tall", "Who Looks Down", "the High Head"], species: null, hall: "platforms", rule: { head: 5 },
      info: "Huge, and only its head can be hurt: climb the platforms around it. The map shows where it will slam.",
      needs: "the Colossus's core rule for any species (combat.js colossusCore), a lair hall of platforms up to 5 blocks (gen/vaults.js), its slam rings on the map (guardians.js)",
    },
    glimhoarder: {
      name: "Glimhoarder", epithets: ["the Glimhoarder", "Who Counts Twice", "Heavy-Purse"], species: null, hall: "plain", rule: { guards: [2, 4] },
      info: "A merchant with hired guards, selling its best piece for reputation. Readings name its lair.",
      needs: "a legendary merchant with 2 to 4 hired guards, its best item sold for reputation (social/merchants.js, WS6b's trade); its lair advertised in readings (story/secrets.js)",
    },
    mirrorborn: {
      name: "Mirrorborn", epithets: ["the Mirrorborn", "Who Is Reflected", "the Left-Handed"], species: null, hall: "plain",
      info: "It has a mirrored double on the map. Strike the wrong one and the real one heals.",
      needs: "a mirrored double drawn on the map, a blow on it healing the real one (renderMap.js, combat.js)",
    },
    longShadowed: {
      name: "Long-shadowed", epithets: ["the Long-shadowed", "Whose Shadow Walks", "the Evening's Own"], species: null, hall: "plain", rule: { reach: 6 },
      info: "Its shadow is a second attacker, striking along the ground from far off.",
      needs: "its shadow a second attacker on the longshadow's rule, striking along the ground from 6 tiles, its line on the map (combat.js, renderMap.js)",
    },
    pleated: {
      name: "Pleated", epithets: ["the Pleated", "Who Creases the Floor", "the Folder"], species: null, hall: "plain", rule: { every: 10, patch: 3 },
      info: "Every ten seconds it swaps two patches of floor. The map shows the crease first.",
      needs: "two 3 × 3 patches of floor swapped every 10 s, the crease previewed on the map (world.js, renderMap.js, guardians.js)",
    },
  },

  // The real world's lair owners by region (C3). Only the regions whose spans hold lairs or may (content/world/regions.js
  // sites.lair; the Teeth and the Lattice for landmark lairs).
  regions: {
    flats: { species: [["saltrat", 3], ["brinehog", 3], ["brineGrub", 2], ["flatling", 1]], herds: ["saltrat", "brinehog"],
             factions: ["hollowmere", "noonVigil", "clatter", "moths", "saltbeasts", "unlit", "flatfolk"] },
    waste: { species: [["brinehog", 3], ["rustbackScav", 2], ["chaffDevil", 2]], herds: ["brinehog"], factions: ["drovers", "pressed", "saltbeasts", "rustbacks"] },
    steps: { species: [["ledgehorn", 3], ["rustbackScav", 3], ["rustbackSlinger", 1], ["ledgeSpider", 2]], herds: ["ledgehorn"],
             factions: ["rustbacks", "drovers", "kites", "saltbeasts"] },
    downs: { species: [["cairnHound", 3], ["barrowSkeleton", 2], ["barrowTroll", 2], ["duskBat", 1]], herds: ["cairnHound", "duskBat"],
             factions: ["survey", "rustbacks", "unlit", "assize", "saltbeasts"] },
    pleatwood: { species: [["pleatSpider", 3], ["hangvine", 2], ["foldmonkey", 2]], herds: ["pleatSpider"], factions: ["pleatwood", "sporeMoot", "saltbeasts"] },
    deepPleat: { species: [["paperWasps", 2], ["mootWalker", 2], ["hangvine", 2]], herds: ["paperWasps"], factions: ["pleatwood", "sporeMoot", "assize", "saltbeasts", "errata"] },
    tessellate: { species: [["tileMimic", 3], ["pressHound", 2], ["mosaicGolem", 1], ["erratum", 1]], herds: ["pressHound"],
                  factions: ["flatfolk", "pressed", "errata", "horary", "chandlers", "plan", "lampless", "noonVigil", "assize"] },
    shade: { species: [["longshadow", 3], ["shade", 2], ["wraith", 2]], herds: [], factions: ["unlit", "lampless", "moths", "chandlers"] },
    stacks: { species: [["beatSpider", 3], ["rustbackBrute", 2], ["rustOoze", 2], ["girderGolem", 1]], herds: ["beatSpider"], factions: ["plan", "rustbacks", "sporeMoot"] },
    glassShore: { species: [["glassCrab", 3], ["slagSalamander", 2], ["erratum", 2]], herds: ["glassCrab"], factions: ["clatter", "errata", "assize"] },
    teeth: { species: [["ledgehorn", 3], ["barrowTroll", 2], ["duskBat", 1]], herds: ["ledgehorn", "duskBat"], factions: ["kites", "drovers", "chandlers", "saltbeasts", "assize"] },
    lattice: { species: [["askewAngle", 3], ["fold", 2], ["latticeTroll", 2], ["planarQueen", 1]], herds: [], factions: ["askew", "flatfolk"] },
  },

  // What a legend says of a faction it loves or hates, and why (all 21 of bible §6.2).
  reasons: {
    hollowmere: { loves: ["they leave it eels", "their reeds are good to sleep in"], hates: ["they burned its reed bed in 1009", "their Reeve counted its young"] },
    noonVigil: { loves: ["they are quiet at noon", "their bells keep the gulls off"], hates: ["they lit a lamp in its den", "they blessed its water without asking"] },
    survey: { loves: ["they measured it and left", "their towers make good perches"], hates: ["they measured it", "they named a hill after it, wrongly"] },
    assize: { loves: ["they keep its road straight", "their writs are good eating"], hates: ["they ruled its den out of true", "an outrider rode over its tail"] },
    horary: { loves: ["their chimes tell it when to sleep", "they feed it on the hour"], hates: ["they ring at it on the hour", "they called it unpunctual"] },
    pressed: { loves: ["they lie still and are easy to find", "they never run"], hates: ["they lay down across its path", "they tried to press it"] },
    lampless: { loves: ["they keep the dark it hunts in", "they snuff the lamps"], hates: ["they sang at it all night", "they took its moonlight too"] },
    drovers: { loves: ["they leave salt licks", "their longbacks are slow"], hates: ["they herd it", "they counted it as a longback"] },
    chandlers: { loves: ["their oil tastes good", "their lamps draw the moths"], hates: ["they boiled its den for tallow", "they tried to sell it a lamp"] },
    rustbacks: { loves: ["they feed it scraps", "their heaps are full of bones"], hates: ["they wear its cousins' shells", "they took its best scrap"] },
    flatfolk: { loves: ["they can't be stepped on", "they drew it once, kindly"], hates: ["it can't catch them", "they feed it lies"] },
    unlit: { loves: ["they share its dark", "they sing it to sleep"], hates: ["they took its eyes", "they keep its old bones"] },
    askew: { loves: ["they understand its angles", "they folded its den bigger"], hates: ["they turned its den sideways", "they are always behind it"] },
    plan: { loves: ["their automata mend its walls", "they never come at night"], hates: ["they measured its den", "their automata woke it"] },
    moths: { loves: ["they light its way", "they are good eating"], hates: ["they bring the light", "they led a torch into its den"] },
    kites: { loves: ["they leave it carrion", "they warn it from up high"], hates: ["they stole its young", "they laugh from up high"] },
    clatter: { loves: ["they trade it bones", "they never argue"], hates: ["they rattle its den", "they sold its shell back to it"] },
    saltbeasts: { loves: ["they share its pans", "it led a herd of them once"], hates: ["they trampled its brood", "a brinehog charged it in 1004"] },
    sporeMoot: { loves: ["the Moot voted it a seat", "their caps are soft"], hates: ["they grew a limb on its mate", "the Moot ruled against it, eventually"] },
    pleatwood: { loves: ["the trees fold over its den", "they hide it at dusk"], hates: ["they pressed its mate", "a branch fell on it, deliberately"] },
    errata: { loves: ["one of them is its double", "they agree with it, backwards"], hates: ["they mirror it badly", "one of them is wearing its face"] },
  },

  names: {
    onsets: ["a", "i", "o", "u", "sha", "ka", "ve", "zha", "sa", "ni", "ob", "ke", "ru"],
    middles: ["ma", "ru", "yen", "dra", "uv", "ha", "ret", "lit", "rai", "ten", "sva", "mel"],
    finals: ["t", "l", "th", "n", "on", "a", "ra", "et", "ul"],
    // Bible §15.11: a generated name that contains any of its terms (letters only, even inside a word: "dra" + "ma…"
    // can make one) is drawn again. They are written backwards here, so the list itself doesn't hold them
    // (check-names scans every source); legendName reads them the right way round. check-sites holds the list to
    // tests/checks/names.js DENY over 20,000 names.
    rejectReversed: ["evygra", "lyteab", "murhtarab", "asusadsehteb", "halyeb", "ardehtac", "havvahc", "aremihc", "cissalc", "leetsyrc", "mard", "damord", "sretae", "repse", "jornye", "arze", "etirelluf", "hsrig", "remmilg", "dapwolg", "kloftaog", "ahtoglog", "eryg", "nerdnih", "irahcassi", "appoj", "ecnecsehpasak", "qnalk", "aykukayk", "tsiminahcem", "ilaathpan", "hcropnomo", "gnasarap", "cisyhp", "ralpmetsutup", "duq", "reliocer", "hpehser", "yalpelor", "hanihkehs", "wajpans", "eldnips", "natlus", "galsnus", "ralpmet", "gnireknit", "nikeurt", "murtsonrebu", "rednaw", "enivretaw", "gnirafyaw", "dloheerfdy", "emorhcatez"],
  },
};

export function legendLooks(c, def) {
  c.color = LEGENDS.base.color;
  // +1 to every attribute (bible §12.13), for a creature that carries attributes (none of the legacy ones do yet:
  // their to-hit and damage come from their level, which is already +3).
  if (c.attrs && !c.mutated?.attrs) {
    for (const k of Object.keys(c.attrs)) c.attrs[k] += LEGENDS.base.attr;
    (c.mutated ||= {}).attrs = true;
  }
  for (const id of def.mutations || []) {
    const m = LEGENDS.mutations[id];
    if (!m || c.mutated?.[id]) continue;
    if (m.armour) c.armour = (c.armour || 0) + m.armour;
    if (m.speed) c.speedMul = (c.speedMul || 1) * m.speed;
    if (m.venom) c.venom = Math.max(c.venom || 0, m.venom);
    if (m.dmg) c.bonus = (c.bonus || 0) + m.dmg;
    (c.mutated ||= {})[id] = true;
  }
  if (def.template === "twicePressed") c.vis = { ...c.vis, flat: true };
  if (def.template === "lamplessSaint") c.vis = { ...c.vis, ghostly: true };
  return c;
}
