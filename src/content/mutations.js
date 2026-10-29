// Mutations (TECH_DESIGN §2.18, §8.3 "WS4"; bible §10.3, §10.4, §13.5; WS4, then C4): the Bent's creases bought as
// bodies. Bible §13.5 lists 20 physical and 12 mental mutations and 8 defects. MUTATIONS holds the 20 the game has the
// hooks for (12 physical, 4 mental, 4 defects): progression/mutations.js offers every one of them. MUTATIONS_WAITING
// (C4) holds the other 20 in the same shape, each with `needs`, the code it waits for (docs/c4.md): one moves across
// when its hook is built, since a mutation offered before then would take 4 creases and do nothing.
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

// Bible §13.5's other 20 (C4): the data for each, waiting for its code. Costs are 4 as above (§15.6), a defect's
// refund the bible's; exclusions where two bodies can't agree, none of them the bible's (heavy bones sink where gills
// swim, are too heavy for wings and can't be brittle; a deafness to the beat can't foresee it).
export const MUTATIONS_WAITING = {
  // --- Physical ---
  extraArms: {
    name: "Extra Arms", kind: "physical", cost: 4, max: 10, excludes: [],
    info: (l) => `A second weapon strikes on ${10 + 3 * l}% of your attacks.`,
    needs: "a third holding part (body.js addPart) and the second weapon's strike (combat.js)",
  },
  geckoPads: {
    name: "Gecko Pads", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    info: (l) => `Cling to a wall in 3D for ${2 + 0.5 * l} s, climbing a block a second.`,
    needs: "clinging to walls in 3D (player.js movement)",
  },
  diggingHands: {
    name: "Digging Hands", kind: "physical", cost: 4, max: 10, excludes: [],
    info: () => "Dig a block in 1 s, in either view. The Stacks call it desecration.",
    needs: "digging in both views (turns.js, player.js, world.js) and the Stacks' desecration (WS10, C2)",
  },
  inkGlands: {
    name: "Ink Glands", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "a cloud of dark in either view, where 3D shows what only the dark shows",
    info: () => "A 3 × 3 cloud of ink for 8 s: runes and planks show in it, torch or no.",
    rep: { flatfolk: 100 },
    needs: "an ability: the dark cloud and dark sight inside it (light.js, render3d.js, progression/abilities.js)",
  },
  deepEyes: {
    name: "Deep Eyes", kind: "physical", cost: 4, max: 1, excludes: [], planar: true,
    bridge: "pits and chasms seen from the map count as looked into, as only 3D could before",
    info: () => "Holes you see from the map count as looked into; through one you see a floor down.",
    needs: "the map's holes marked looked-into (renderMap.js, zone.holeSeen) and a floor down through holes (render3d.js)",
  },
  heavyBones: {
    name: "Heavy Bones", kind: "physical", cost: 4, max: 1, excludes: ["gills", "wings", "brittleBones"], planar: true,
    info: () => "No knockback, half fall damage, and in deep water you walk the bottom.",
    needs: "knockback immunity (WS8), half fall damage (player.js), walking the bottom of deep water (status.js drowning, world.js)",
  },
  horns: {
    name: "Horns", kind: "physical", cost: 4, max: 10, excludes: [],
    info: () => "A sprinting charge in 3D knocks the target back 2 tiles.",
    rep: { saltbeasts: 100 },
    needs: "a charge in 3D with knockback (player.js sprint, combat.js)",
  },
  silkGlands: {
    name: "Silk Glands", kind: "physical", cost: 4, max: 10, excludes: [], planar: true,
    info: (l) => `A web across a gap of ${3 + l / 2} tiles: it holds you for 20 s and slows pursuers.`,
    rep: { kites: -100 },
    needs: "a web that comes and goes and slows pursuers (world.js, ai.js, progression/abilities.js)",
  },
  // --- Mental: their levels add EGO's, and count in your Cast ---
  snuff: {
    name: "Snuff", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    info: () => "Every light within 6 tiles goes out, monsters' lamps too. The shades are pleased.",
    needs: "putting out lights (light.js: braziers, creatures' lamps, your torch) and the shades' courage (ai.js)",
  },
  endear: {
    name: "Endear", kind: "mental", cost: 4, max: 10, excludes: [],
    info: () => "Make a creature your follower: your EGO against its WIL.",
    needs: "followers won by a contest of EGO and WIL (social: the Kindling's recruits)",
  },
  muddle: {
    name: "Muddle", kind: "mental", cost: 4, max: 10, excludes: [],
    info: (l) => `Confuse everything in a cone for ${3 + l / 2} s.`,
    needs: "a confused status for creatures, and its cone (status.js, ai.js, progression/abilities.js)",
  },
  forcePlane: {
    name: "Force Plane", kind: "mental", cost: 4, max: 10, excludes: [], planar: true,
    bridge: "a pane in both views that stops deep and flat beings alike",
    info: () => "Raise a pane of force that stops deep and flat beings alike.",
    needs: "a pane that comes and goes, solid to flat beings too (world.js, creatures.js), as the force pane artifact's",
  },
  timeLag: {
    name: "Time Lag", kind: "mental", cost: 4, max: 10, excludes: [],
    info: () => "Enemies within 4 tiles act 30% slower for 6 s.",
    needs: "a slowed status for creatures (status.js speed, ai.js)",
  },
  foresight: {
    name: "Foresight", kind: "mental", cost: 4, max: 10, excludes: ["beatDeaf"], planar: true,
    bridge: "the map shows what comes next; 3D slows before a blow lands",
    info: () => "The map shows the next 2 spike beats and every monster's next step; in 3D, blows come slower.",
    needs: "the next beats and steps on the map (traps.js, ai.js, renderMap.js), and a slow second in 3D (time.js)",
  },
  backglass: {
    name: "Backglass", kind: "mental", cost: 4, max: 1, excludes: [],
    info: () => "The next mental attack on you goes back to its sender.",
    needs: "mental attacks to turn back (the Assize's Overrule, C2's Chime, Endear)",
  },
  readhand: {
    name: "Readhand", kind: "mental", cost: 4, max: 1, excludes: [],
    info: () => "You know an artifact by touch, and read the account on any engraving.",
    needs: "identify on touch (bodymods/artifacts.js identify, on pickup) and engraved items' accounts (story, WS7)",
  },
  // --- Defects ---
  brittleBones: {
    name: "Brittle Bones", kind: "defect", cost: -3, max: 1, excludes: ["heavyBones"],
    info: () => "Falls of 3 blocks hurt, and blunt blows do half again.",
    needs: "fall damage from 3 blocks (player.js) and +50% from cudgels and fists (combat.js)",
  },
  shadowless: {
    name: "Shadowless", kind: "defect", cost: -3, max: 1, excludes: [],
    info: () => "Flat beings can't perceive you: the Flatfolk won't talk, but Smoothers ignore you.",
    needs: "flat beings that don't perceive you (ai.js, talk.js with the Flatfolk; Folio needs another route, C1b, C5)",
  },
  sleepwalker: {
    name: "Sleepwalker", kind: "defect", cost: -2, max: 1, excludes: [],
    info: () => "Each world-map move has a 1 in 10 chance of drifting a span off.",
    needs: "a drift on world-map moves (overworld/travel.js)",
  },
  beatDeaf: {
    name: "Beat-deaf", kind: "defect", cost: -3, max: 1, excludes: ["foresight"],
    info: () => "The map stops warning you of spike beats.",
    needs: "hiding the map's spike warnings (renderMap.js, traps.js)",
  },
};
