// Mutations (TECH_DESIGN §2.18, §8.3 "WS4"; bible §10.3, §10.4, §13.5; WS4, then C4): the Bent's creases bought as
// bodies. Bible §13.5 lists 20 physical and 12 mental mutations and 8 defects; this table holds the ones the game has
// the hooks for (12 physical, 4 mental, 4 defects). The rest wait for theirs: Extra Arms is out of scope (§15.9: no
// limbs), Gecko Pads, Horns and Silk Glands need movement rules (WS8), Digging Hands the Stacks' desecration (WS10),
// Deep Eyes, Heavy Bones and Ink Glands the map's and the fall's hooks, Endear followers (WS6a), Muddle, Time Lag and
// Foresight the AI's (WS8), Snuff and Force Plane light and panes, Backglass mental attacks, Readhand artifacts (WS5).
//
//   MUTATIONS[id] = { name, kind: "physical" | "mental" | "defect", cost, max, excludes: [id], planar, bridge?,
//                     info(lvl) → string, bonus?(lvl, e) → { key: n }, ability?: id, rep?: { faction: n },
//                     repAll?: n, status?: id, darkRange?(lvl) → tiles }
//     cost      creases: 4 for every mutation (bible §10.3 and §15.6: "a new mutation costs 4"; §13.5's bracketed
//               figures lose to §15, DECISIONS' order), a defect's refund as a negative cost (−2 or −3)
//     max       the highest level it can be raised to (10, or 1 for one that has nothing to raise); a level is also
//               capped at floor(character level / 2) + 1 (progression/mutations.js)
//     planar    bible §13.5's ◆: it uses a house rule of the Plane; every offer of three holds at least one
//     bridge    how it carries one view into the other (TECH_DESIGN §8.3: at least two): the checks hold these
//     bonus     to the stat bus (progression/index.js's "mutations" source), with the level you bought (a mental
//               mutation's EGO levels can't feed a bonus: EGO is itself a bonus)
//     ability   an ability id (progression/abilities.js; abilities.js's "mutations" source gives it at the
//               mutation's level, a mental one's with EGO's levels: progression/mutations.js mutationLevel)
//     rep       bible §10.4's reputation changes, applied once when it's gained; repAll: with every faction
//     status    a defect that comes and goes with your surroundings: the status it puts on you while they hold
//               (progression/mutations.js watches the torch and the sky)
//     darkRange with your torch out, how far you see (player.js torchRange)
//
// Every faction id the bible names (§15.4), for a change "with every faction" (Crooked Manner) before WS6a registers
// them; any registered faction counts as well.
export const BIBLE_FACTIONS = ["hollowmere", "noonVigil", "survey", "assize", "horary", "pressed", "lampless", "drovers",
  "chandlers", "rustbacks", "flatfolk", "unlit", "askew", "plan", "moths", "kites", "clatter", "saltbeasts", "sporeMoot",
  "pleatwood", "errata"];

const tiles = (n) => `${n} tile${n === 1 ? "" : "s"}`;

export const MUTATIONS = {
  // --- Physical ------------------------------------------------------------------------------------------------
  shellback: {
    name: "Shellback", kind: "physical", cost: 4, max: 10, excludes: ["wings"],
    info: (l) => `A shell across your back: +${2 + Math.floor(l / 3)} armour, while you wear no body armour over it.`,
    // Clothes don't cover it; anything heavier on the body and the shell can't settle (equip calls invalidateStats).
    bonus: (l, e) => { const it = e.body?.equip?.body; return !it || it.id === "clothes" ? { av: 2 + Math.floor(l / 3) } : null; },
    rep: { clatter: 200 },
  },
  thistlehide: {
    name: "Thistlehide", kind: "physical", cost: 4, max: 10, excludes: [],
    info: (l) => `Quills: whatever strikes you takes 2. Fling them into every tile around you for 1-3 + ${Math.floor(l / 2)}.`,
    bonus: () => ({ thorns: 2 }), ability: "fling",
  },
  wings: {
    name: "Wings", kind: "physical", cost: 4, max: 10, excludes: ["shellback"], planar: true,
    info: (l) => `Fly for ${20 + 5 * l} s before you glide down; on the world map you travel twice as fast.`,
    bonus: () => ({ travel: 1 }), ability: "wingsUp", rep: { kites: 400 },
  },
  stiltLegs: {
    name: "Stilt Legs", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    info: (l) => `You jump ${0.5 * Math.ceil(l / 2)} blocks higher; from a block on, you climb 2 blocks on the map.`,
    bonus: (l) => ({ jump: 0.5 * Math.ceil(l / 2) }),
  },
  lampskin: {
    name: "Lampskin", kind: "physical", cost: 4, max: 1, excludes: ["mothKissed"], planar: true,
    info: () => "You glow: your torch burns no glim, with it out you still see 3 tiles, but nothing dark hides you.",
    bonus: () => ({ darkSight: 2, stealth: -0.25, torchCost: -1 }), rep: { moths: 200, lampless: -200 },
  },
  nightEyes: {
    name: "Night Eyes", kind: "physical", cost: 4, max: 10, excludes: ["darkFear"], planar: true,
    info: (l) => `With your torch out you see ${tiles(3 + l / 2)}.`,
    bonus: () => ({ darkSight: 2 }), darkRange: (l) => 3 + l / 2,
  },
  regeneration: {
    name: "Regeneration", kind: "physical", cost: 4, max: 10, excludes: [],
    info: (l) => `You heal ${l} HP every 10 s.`,
    bonus: (l) => ({ regen: 1.2 * l }),   // regen n: 1 HP every 12 / n s
  },
  spareHeart: {
    name: "Spare Heart", kind: "physical", cost: 4, max: 1, excludes: [],
    info: () => "A second heart beats behind the first: +2 TOU.",
    bonus: () => ({ tou: 2 }),
  },
  bellowsThroat: {
    name: "Bellows Throat", kind: "physical", cost: 4, max: 10, excludes: [],
    info: (l) => `Breathe a 3-tile cone of fire for ${l}d4, setting what it reaches alight; it lights braziers too.`,
    ability: "bellows",
  },
  flatwise: {
    name: "Flatwise", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "pressed flat from either view: only the map holds you, deep blows pass through and you slide under doors",
    info: (l) => `Press yourself Flat for ${3 + Math.floor(l / 2)} s: only the map holds you, and deep things can't touch you.`,
    ability: "flatwise", rep: { flatfolk: 200, pressed: 100, assize: -200 },
  },
  gills: {
    name: "Gills", kind: "physical", cost: 4, max: 1, excludes: [], planar: true,
    info: () => "Deep water no longer drags you down: you swim at its surface.",
    bonus: () => ({ swim: 1 }), rep: { clatter: 100 },
  },
  echoThroat: {
    name: "Echo Throat", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "a shout in either view puts everything around you on the map, lit or not",
    info: (l) => `A shout that draws everything within ${tiles(6 + l)} onto the map, without any light.`,
    ability: "echo",
  },

  // --- Mental: their levels add EGO's (progression/mutations.js), and their sum is your Cast (bible §10.3) -------
  foldStep: {
    name: "Fold Step", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "a blink where you aim in 3D, or onto the tile you pick on the map",
    info: (l) => `Blink up to ${tiles(4 + l)}: where you aim in 3D, on the map toward your target or the way you face.`,
    ability: "foldStep",
  },
  overlook: {
    name: "Overlook", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "look from above at a place within 20 tiles: it is drawn onto the map, and what stands there",
    info: (l) => `See a 9 × 9 area from above, up to 20 tiles off, and draw it onto the map (every ${Math.max(10, 32 - 2 * l)} s).`,
    ability: "overlook",
  },
  shadowsense: {
    name: "Shadowsense", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "flat beings and ghosts show in 3D and on the map",
    info: (l) => `For ${8 + 2 * l} s, every flat being and ghost on this floor shows in every view.`,
    ability: "shadowsense",
  },
  kindle: {
    name: "Kindle", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    info: (l) => `Light a brazier up to ${tiles(5 + l)} away with a thought, in either view.`,
    ability: "kindle",
  },

  // --- Defects: taken only at creation, each refunds creases ---------------------------------------------------
  lightsick: {
    name: "Lightsick", kind: "defect", cost: -2, max: 1, excludes: [], status: "sunsick",
    info: () => "Sunlight blisters you: 1 HP every 20 s under an open sky by day.",
  },
  darkFear: {
    name: "Dark-fear", kind: "defect", cost: -3, max: 1, excludes: ["nightEyes"], status: "shaken",
    info: () => "With your torch out you're shaken: -2 to hit, -1 DV.",
  },
  mothKissed: {
    name: "Moth-kissed", kind: "defect", cost: -2, max: 1, excludes: ["lampskin"], status: "mobbed",
    info: () => "Moths mob your lit torch: monsters notice you 30% sooner.",
  },
  crookedManner: {
    name: "Crooked Manner", kind: "defect", cost: -2, max: 1, excludes: [], repAll: -50,
    info: () => "Everything you say comes out wrong: -50 with every faction.",
  },
};
