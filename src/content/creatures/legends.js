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

  names: {
    onsets: ["a", "i", "o", "u", "sha", "ka", "ve", "zha", "sa", "ni", "ob", "ke", "ru"],
    middles: ["ma", "ru", "yen", "dra", "uv", "ha", "ret", "lit", "rai", "ten", "sva", "mel"],
    finals: ["t", "l", "th", "n", "on", "a", "ra", "et", "ul"],
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
