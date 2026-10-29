// Factions (TECH_DESIGN §2.11 FactionDef: { id, name, color, temperament, startRep, homeRegions, members,
// likes, hates, relations: { [otherId]: -1 | 0 | 1 }, sacred, voice, secrets: { buys, sells }, merchantTable,
// flat? }; §2.18; WS6a, then C2). The 21 fixed factions of bible §6.2 and §15.4, their hidden parent groups
// (§6.1), and the Bent villages (one pool every Bent village carries as a second membership). Each is registered
// with factions.js registerFaction when this file loads. The six faiths of bible §7 (FAITHS) and the template the
// run's Hour cults are made from (HOUR_CULT, bible §6.3, §7.7, §8.7) are data beside them.
//
//   FACTIONS[id] = { name, parent, temperament, startRep: { bent, plumb }, color, glyph, liquid, rite, voice,
//                    about, likes: [[id, why]], hates: [[id, why]], pilgrimFloor?, hidden?, flat?, homeRegions,
//                    homes, buys, sells, teaches, lines, riteVariant?, specials?, torchFriend? }
//   GROUPS[id]   = the hidden parents (peoples, faiths, plane, dark, engines, beasts, growths, askew, and the Bent
//                  under the peoples: Hollowmere and the Bent villages, whom the Assize hates by birth): never
//                  shown, never a rep of their own; a relation to a group holds for everything under it
//
// likes and hates become relations (+1 / −1, factions.js) and are what the factions screen lists; the reasons
// are the bible's (where it gives none, a petty one of ours: bible §2.1 rule 11). A hate that isn't a faction
// ("their own originals") is in `hatesToo` as text, a like that isn't one in `likesToo`. startRep is the bible's
// "Start (Bent / Plumb)". pilgrimFloor: false for the factions Pilgrim leaves below zero (bible §3.5: the Askew and
// the Hour cults). voice is bible §15.4's, for WS6b's voices.js.
//
// What C2 added (bible §6.2, §3.3, §3.4, §7):
//   homeRegions  the regions it lives in, by C1a's region ids (docs/c1.md; docs/c2.md lists the ones used here); []
//                for "everywhere" or "wherever lamps burn"
//   homes        its landmarks (bible §4.3's letters) and places, as text
//   buys         { readings?, topics? }: what it takes in the Kindling's menu (social/ritual.js wants(); a reading
//                kind of "flat" | "deep" | "dark", a topic of story/secrets.js's kinds: "location", "history",
//                "village", "gossip", "recipe"); a rumour has no reading, so a faction that buys rumours names
//                no readings. `double` (the Unlit's Deep Inscriptions) and `subjects` (what the bible narrows a topic to:
//                the Vigil buys only Noon's, the Assize only Bent villages' Locations and relics) wait on the menu
//                (integration request); until then a faction with `subjects` buys the whole topic
//   sells, teaches   bible §6.2, as text
//   lines        { greet: { indifferent, liked, loved }, trespass?: { warn, turn } }: a talker of the faction greets
//                you with its band's line (Cold stays the role's curt line; integration request); a holy place's
//                warning, and what is said when they turn on you. Plain register, at most two lines (§2.1)
//   riteVariant  the faction's own Kindling (bible §3.3 "Faction variants"): { name, rite, needs, how, words, narration? }
//                (a beast says nothing: its `narration` is what you see instead)
//                where the numbers are the plain rite's and the verbs differ (integration request)
//   specials     bible §3.3's "Faction specials", bought with rep in the flame-kin menu (integration request); via: "talk"
//                (the Askew re-angle you when you talk, paying repPerCrease × the mutation's creases) or "earned" (the dark-pass:
//                the bible gives no price, so none is set) are not menu rows
//   torchFriend  the Lantern Moths like you while your torch is lit (bible §6.2; integration request)
import { registerFaction } from "../factions.js";

const both = (n) => ({ bent: n, plumb: n });

export const GROUPS = {
  peoples: { name: "the peoples" }, bent: { name: "the Bent", parent: "peoples" }, faiths: { name: "the faiths" }, plane: { name: "the Plane" }, dark: { name: "the Dark" },
  engines: { name: "the engines" }, beasts: { name: "the beasts" }, growths: { name: "the growths" }, askewGroup: { name: "the Askew" },
};

export const FACTIONS = {
  hollowmere: {
    name: "Hollowmere", parent: "bent", temperament: "docile", startRep: both(100), color: [120, 170, 110], glyph: "@",
    liquid: "glim", rite: "deep", voice: { hz: 255, wave: "triangle" }, homeRegions: ["flats"], homes: ["A"],
    about: "A village of the Bent, and a few Plumb, on the Brine Flats. They keep the Temple of Angles.",
    likes: [["noonVigil", "they keep our temple"], ["clatter", "good neighbours, bad jokes"], ["survey", "Mira's maps found the eel weirs"]],
    hates: [["rustbacks", "they raid the reed beds"], ["assize", "they've been digging under the temple"]],
    buys: { topics: ["gossip", "location"] }, sells: "the village's history, the Dial Floor reading, the Keeper's Descent",
    teaches: ["Pathcraft", "Long Blade", "Leechcraft"],
    lines: { greet: {
      indifferent: "Mind the reeds, they're somebody's supper. Noon keep you.",
      liked: "Sit, the bench is dry. Mostly. Noon keep you.",
      loved: "There you are. The Reeve kept your eel warm, and your place by the lamp." } },
  },
  noonVigil: {
    name: "the Noon Vigil", parent: "faiths", temperament: "docile", startRep: both(50), color: [240, 220, 150], glyph: "@",
    liquid: "freshWater", rite: "deep", voice: { hz: 270, wave: "triangle" }, homeRegions: ["flats", "tessellate"], homes: ["A", "H", "the noon-posts"],
    about: "A faith that keeps the noon-posts and the Temple of Angles. Fresh water, clear as noon.",
    likes: [["hollowmere", "the keepers' village"], ["flatfolk", "they kept Noon's true account"]],
    hates: [["lampless", "they pray to her shadow"], ["horary", "they call her a thief"], ["assize", "they want the Cube"]],
    buys: { topics: ["history"], subjects: ["noon"] }, sells: "noon-post Locations; fragments of Noon's accounts", teaches: ["Leechcraft", "Lore"],
    lines: { greet: {
      indifferent: "Noon keep you. Your shadow is a debt, but nobody is collecting today.",
      liked: "Welcome back. Drink; it's fresh water, clear as noon.",
      loved: "Kin of the Vigil. Stand with us at noon, where the shadows are shortest." },
      trespass: { warn: "Not that altar. Nobody touches that altar. Not even us.", turn: "You laid a hand on the Cube's altar. Noon forgive you. We won't." } },
  },
  survey: {
    name: "the Survey", parent: "peoples", temperament: "neutral", startRep: both(0), color: [200, 170, 90], glyph: "@",
    liquid: "freshWater", rite: "deep or flat", voice: { hz: 300, wave: "square", flags: ["beat"] }, homeRegions: ["downs", "steps"], homes: ["D", "the Downs towers"],
    about: "A guild of tinker-cartographers out of Benchmark. They will take a Tracing too: mapmakers.",
    likes: [["flatfolk", "perfect maps"], ["plan", "the blueprints"], ["kites", "the view from above"]],
    hates: [["rustbacks", "they steal instruments"], ["askew", "they ruin measurements by existing"]],
    buys: { readings: ["flat", "deep"], topics: ["location", "history"] }, sells: "maps (Location readings), the tier layer, the noon length",
    teaches: ["Survey", "Artificing", "Pathcraft"],
    lines: { greet: {
      indifferent: "Interesting. Don't move, you're in my line.",
      liked: "Ah, our walking datum. Stand there. Perfect. Thank you.",
      loved: "We named a benchmark after you. It's two blocks off true, like everyone." } },
  },
  assize: {
    name: "the Plumb Assize", parent: "peoples", temperament: "aggressive", startRep: { bent: -700, plumb: -100 },
    color: [150, 170, 200], glyph: "K", liquid: "quicksilver", rite: "deep", voice: { hz: 120, wave: "square" }, homeRegions: ["deepPleat", "teeth", "straightCut", "oldRule"], homes: ["M", "F", "the Straight Cut", "the Old Rule"],
    about: "A zealot order of pure-born judges, sitting in the Square. Quicksilver: it always finds the level.",
    likes: [["plan", "straight and obedient"], ["chandlers", "they fund us"], ["horary", "the dial must turn"]],
    hates: [["bent", "crooked lines"], ["flatfolk", "unfinished people"], ["askew", "they won't hold still to be measured"],
      ["rustbacks", "they took the Molar plumb-stone for scrap"], ["errata", "errors to be corrected"]],
    buys: { topics: ["location", "history"], subjects: ["bentVillage", "relic"] }, sells: "Truing Cradle Locations; Hour-site Locations; Plumb lore",
    teaches: ["Long Blade", "Parley (Intimidate)"],
    lines: { greet: {
      indifferent: "Stand straight. Straighter. That will do for now.",
      liked: "Level and true. The Square has a note of you, in the good column.",
      loved: "Plumb as a bob. The Rule is glad of you, and it is seldom glad." },
      trespass: { warn: "You are crooked, and this is the Square. Leave in a straight line.", turn: "Crooked, in the Square. The Rule allows one remedy." } },
  },
  horary: {
    name: "the Horary", parent: "faiths", temperament: "neutral", startRep: both(0), color: [230, 170, 60], glyph: "H",
    liquid: "sunwine", rite: "deep, at the stele's hour", voice: { hz: 420, wave: "triangle", flags: ["vibrato"] }, homeRegions: ["tessellate", "oldRule"], homes: ["H", "the dial-steles", "the roadside dials"],
    about: "The faith of the Hours, with an Hour-house in Halfnight and a dial by every road.",
    likes: [["kites", "birds of the high sun"], ["plan", "it built the dials with us"]],
    hates: [["lampless", "across the Line"], ["noonVigil", "Noon stole the hour"]],
    likesToo: ["the Hour cults: misguided fellow believers"],
    buys: { topics: ["history"] }, sells: "Deep Inscriptions; dial-stele Locations and their hours", teaches: ["Lore", "Parley (Chime)"],
    riteVariant: { name: "the Lighting at the hour", rite: "lighting", needs: { steleHour: 1 },
      how: "the Lighting, before a dial-stele, within a world hour of the hour carved on it",
      words: ["Turn, hand. My light at your hour.", "Turn, hour. Your light at mine."] },
    lines: { greet: {
      indifferent: "Turn, hand. Turn, hour. What hour is it for you, traveller?",
      liked: "The hours bring you back to us. Sit; the next bell is soon.",
      loved: "Hour-kin. Ring the bell with us when the shadow moves." },
      trespass: { warn: "LAMPS STAY LIT. Relight it before the Hours notice.", turn: "A dark lamp in the Hour-house. The Hours noticed." } },
  },
  pressed: {
    name: "the Pressed", parent: "faiths", temperament: "docile", startRep: both(-50), color: [220, 220, 230], glyph: "@",
    liquid: "brine", rite: "flat", voice: { hz: 150, wave: "sine" }, homeRegions: ["waste", "tessellate"], homes: ["O", "the Tessellate's mosaics"],
    about: "The Church of the Plane. They hold that pressing is a gift.",
    likes: [["flatfolk", "saints"], ["unlit", "they are also past the deep"]],
    hates: [["kites", "for flying"], ["plan", "it builds upward"], ["assize", "they press as punishment; pressing is a gift"]],
    buys: { readings: ["flat"] }, sells: "Tessellate Locations; what mosaics mean", teaches: ["Hardiness", "Survey", "the Pressing rite"],
    specials: [{ id: "pressing", name: "the Pressing rite", rep: -100,
      text: "For one world day you may turn flat for 3 s, once a floor. It is a gift; they will not say what kind." }],
    lines: { greet: {
      indifferent: "Peace, and flatness. Lie down a while. The floor is kind.",
      liked: "Half of you is painted already, in spirit. Welcome.",
      loved: "Saint-in-waiting. The Plane keeps a place for you, one tile wide." } },
  },
  lampless: {
    name: "the Lampless", parent: "faiths", temperament: "neutral", startRep: both(-100), color: [110, 90, 150], glyph: "N",
    liquid: "umbra", rite: "dark", voice: { hz: 110, wave: "sine", flags: ["ghost"] }, homeRegions: ["tessellate", "shade"], homes: ["H", "J", "the Hushes"],
    about: "A choir of the dark, east of the Line. They sing at the Hushes with their lamps poured out.",
    likes: [["unlit", "their company"], ["pressed", "fellow quiet ones"]],
    hates: [["moths", "they worship light"], ["chandlers", "they sell it"], ["horary", "across the Line"]],
    buys: { readings: ["dark"] }, sells: "ghost-plank routes, the Hush Stair, Shade Locations, Vesper lore", teaches: ["Shadowcraft", "Lore"],
    specials: [{ id: "snuff", name: "the Snuff", rep: -200, genotype: "bent",
      text: "A mental mutation: you put out a light by looking at it. They teach it to the Bent only." },
      { id: "darkPass", name: "a dark-pass", via: "earned", rep: null, genotype: "plumb",
        text: "A Plumb may carry a lit torch through their holy places without trespass. The bible says it is earned, not how." }],
    lines: { greet: {
      indifferent: "Put it out. We'll still be here. That's the point.",
      liked: "Sit with us. You may keep the lamp for now. We'll wait.",
      loved: "Dark-kin. Nobody here needs to see your face to know it." },
      trespass: { warn: "Your lamp. Here, please. Put it out.", turn: "A lit torch at the Hush. We asked the dark. It said no." } },
  },
  drovers: {
    name: "the Salt Drovers", parent: "peoples", temperament: "neutral", startRep: both(0), color: [220, 150, 60], glyph: "@",
    liquid: "longbackMilk", rite: "deep", voice: { hz: 165, wave: "sawtooth" }, homeRegions: ["steps", "waste", "teeth", "oldRule"], homes: ["F", "the Steps and Waste roads"],
    about: "Caravan merchants of the Steps and Waste roads.",
    likes: [["clatter", "trade partners"], ["chandlers", "credit"], ["kites", "scouts"]],
    hates: [["rustbacks", "they raid caravans"], ["assize", "tolls and searches"]],
    buys: { topics: ["gossip", "location", "village"] }, sells: "village and route readings; Drover recipes", teaches: ["Pathcraft", "Parley (Haggle)"],
    lines: { greet: {
      indifferent: "Nine longbacks, two carts, no room. What are you selling?",
      liked: "Friend of the road. Sit. The milk is sour, but honest.",
      loved: "Road-kin. We named a longback after you. She bites, but fondly." } },
  },
  chandlers: {
    name: "the Chandler Houses", parent: "peoples", temperament: "neutral", startRep: both(-50), color: [250, 210, 90], glyph: "J",
    liquid: "clearGlim", rite: "deep", voice: { hz: 330, wave: "square" }, homeRegions: ["teeth", "tessellate", "downs"], homes: ["F", "H", "the banks"],
    about: "Lamp-oil barons. Every lit wick pays a House something.",
    likes: [["assize", "order and supply"], ["moths", "customers"], ["drovers", "they carry the oil"]],
    hates: [["lampless", "they won't buy light"], ["rustbacks", "they steal it"]],
    buys: { topics: ["location", "gossip"] }, sells: "their best item; bank credit", teaches: ["Parley (Haggle)", "Glimcraft"],
    lines: { greet: {
      indifferent: "Every wick you light pays us something. Lovely to meet you.",
      liked: "A valued customer. Your wick is welcome at any House.",
      loved: "For you, clear glim at the house price. Don't ask what the house price is." } },
  },
  rustbacks: {
    name: "the Rustbacks", parent: "peoples", temperament: "aggressive", startRep: both(-450), color: [180, 90, 50], glyph: "g",
    liquid: "blood", rite: "deep", voice: { hz: 130, wave: "sawtooth", flags: ["grit"] }, homeRegions: ["steps", "downs", "stacks"], homes: ["the Rust Steps", "the Stacks' edges"],
    about: "Scavenger clans of the Steps, the Downs and the edges of the Stacks.",
    likes: [["saltbeasts", "we ride the brinehogs"]],
    hates: [["drovers", "prey"], ["plan", "it guards the ruins"], ["survey", "it fences them off"]],
    buys: { topics: ["location"] }, sells: "ruin Locations; where stolen goods came from", teaches: ["Axe", "Throwing"],
    riteVariant: { name: "the Lighting, after iron", rite: "lighting", needs: { gift: "iron" },
      how: "the Lighting, after a gift of iron: any iron thing from your pack",
      words: ["Iron for you. Remember me by it.", "Remembered. Rust keeps everything."] },
    lines: { greet: {
      indifferent: "Nice boots. We're remembering them. Just looking. For now.",
      liked: "Iron-friend. Sit. Don't touch the heap, it's remembering.",
      loved: "Heap-kin. Take a nail. Take two. We remember you kindly." } },
  },
  flatfolk: {
    name: "the Flatfolk", parent: "plane", temperament: "docile", startRep: both(0), color: [90, 110, 200], glyph: "@", flat: true,
    liquid: "ink", rite: "flat only", voice: { hz: [430, 560], wave: "square", flags: ["thin"] }, homeRegions: ["tessellate"], homes: ["G", "the page-towns", "any floor"],
    about: "The people of the Plane, in Folio and the Tessellate. From above they are the whole of themselves.",
    likes: [["survey", "good maps"], ["pressed", "devotees"], ["noonVigil", "they keep Noon's memory"]],
    hates: [["assize", "they press people as punishment"], ["askew", "they crumple the Plane"], ["errata", "bad copies of good lines"]],
    buys: { readings: ["deep"] }, sells: "mosaic texts, Flat Accounts, village histories, directions", teaches: ["Survey", "Lore"],
    lines: { greet: {
      indifferent: "You're standing on my cousin. No, the other foot. Thank you.",
      liked: "From above you look well. From the side we couldn't say.",
      loved: "Line-kin. We drew you in the margin, very small, with care." } },
  },
  unlit: {
    name: "the Unlit", parent: "dark", temperament: "neutral", startRep: both(0), color: [200, 220, 255], glyph: "U",
    liquid: "any, poured", rite: "dark only", voice: { hz: 205, wave: "triangle", flags: ["ghost"] }, homeRegions: ["shade"], homes: ["the crypts", "the barrows", "the Hour sites"],
    about: "Ghosts. They show only where the light doesn't reach.",
    likes: [["lampless", "they keep us company"], ["noonVigil", "they pray for us"]],
    hates: [["moths", "they eat ghost-stuff"], ["chandlers", "they light everything"]],
    buys: { readings: ["dark", "deep"], double: ["deep"] }, sells: "secret rooms, rune meanings, how they died, the Hush Stair", teaches: ["Shadowcraft"],
    riteVariant: { name: "the Pouring", rite: "snuffing", needs: { pour: "any" },
      how: "your torch out, pour one vial of any liquid at the ghost's feet", words: null },
    lines: { greet: {
      indifferent: "you came without a light. that was kind of you.",
      liked: "sit. we were counting the dead and lost our place.",
      loved: "you are nearly one of us. stay a little. not too long." } },
  },
  askew: {
    name: "the Askew", parent: "askewGroup", temperament: "aggressive", startRep: both(-500), color: [220, 80, 220], glyph: "A",
    liquid: "turnwater", rite: "none", voice: { hz: 300, wave: "triangle", flags: ["glide"] }, homeRegions: ["lattice"], homes: ["the Lattice", "the approaches to the Gnomon"], pilgrimFloor: false,
    about: "Living wrong angles, out of the Lattice.",
    likes: [["pleatwood", "fellow folders"], ["sporeMoot", "it has no corners"]],
    hates: [["assize", "for being square"], ["survey", "for measuring"], ["plan", "for its straight lines"]],
    buys: { readings: ["deep"] }, sells: "nothing", teaches: [],
    specials: [{ id: "reangle", name: "re-angled", via: "talk", repPerCrease: -50, band: "indifferent",
      text: "Talk to one at Grey or better and it re-angles you: a random mental mutation, paid for in reputation." }],
    lines: { greet: {
      indifferent: "Your corners are showing. Hold still. This won't take a right angle.",
      liked: "Nearly the right shape. Let us help with the rest." } },
  },
  plan: {
    name: "the Plan", parent: "engines", temperament: "neutral", startRep: { bent: -100, plumb: 100 }, color: [160, 180, 190], glyph: "R",
    liquid: "glim", rite: "deep or flat", voice: { hz: [180, 260], wave: "square", flags: ["beat"] }, homeRegions: ["stacks", "oldCuts"], homes: ["K", "the Stacks", "Detail C at Benchmark"],
    about: "A machine faith of automata, at the Metronome and in the Stacks.",
    likes: [["survey", "accuracy"], ["assize", "clear orders"], ["horary", "the dials we built together"]],
    hates: [["rustbacks", "they strip ruins"], ["askew", "unbuildable"], ["sporeMoot", "rot"]],
    buys: { readings: ["flat"], topics: ["location"] }, sells: "ruin floor plans; Truing Cradle access", teaches: ["Artificing"],
    riteVariant: { name: "the Oiling", rite: "lighting", needs: { glim: 5 }, alt: { rite: "tracing", needs: { floorPlan: 0.9 } },
      how: "in the deep view, pour 5 glim into the automaton's reservoir; or on the map, present it a full floor plan",
      words: ["Five measures, to drawing.", "Received. You are on the drawing now."], altWords: ["Here is the floor, as built.", "As drawn. Accepted."] },
    lines: { greet: {
      indifferent: "You are not on the drawing. Please stand where the drawing says.",
      liked: "Your conduct conforms to specification. Revision approved.",
      loved: "You are on the drawing now. In pencil, but on it." },
      trespass: { warn: "That block is load-bearing in the drawing. Do not do that again.", turn: "Deviation repeated. Repairing to drawing." } },
  },
  moths: {
    name: "the Lantern Moths", parent: "beasts", temperament: "docile", startRep: both(300), color: [250, 240, 170], glyph: "m",
    liquid: "glim", rite: "deep, Moon-Wick only", voice: { hz: 700, wave: "sine", flags: ["tremolo"] }, homeRegions: [], homes: ["wherever lamps burn"],
    about: "Animals. They gather wherever lamps burn.",
    likes: [["chandlers", "more lamps every year"]], likesToo: ["you, while your torch is lit"], torchFriend: true,
    hates: [["lampless", "they put the light out"], ["unlit", "they put the light out"]],
    buys: { readings: [], topics: [] }, sells: "nothing; the Moon-Wick sells the Locations of every glim spring", teaches: [],
    riteVariant: { name: "the Moon-Wick's Lighting", rite: "lighting", needs: { legend: "moonWick" },
      how: "the Lighting, with the legendary Moon-Wick and no other moth",
      words: null, narration: "The great moth folds its wings over your flame, and does not burn." },
    lines: { greet: {
      indifferent: "It flutters once round your torch and waits for more light.",
      liked: "A dozen of them settle on your lamp hand, warm as breath." } },
  },
  kites: {
    name: "the Kites", parent: "beasts", temperament: "neutral", startRep: both(-100), color: [130, 170, 220], glyph: "v",
    liquid: "freshWater", rite: "deep, 8 blocks up or more", voice: { hz: 600, wave: "square" }, homeRegions: ["steps", "teeth", "pleatwood"], homes: ["E", "the Teeth eyries", "the Pleatwood canopy"],
    about: "Uplifted birds of the Tall Table and the Teeth.",
    likes: [["survey", "they share our view"], ["drovers", "scraps"]],
    hates: [["pressed", "they hate height"], ["assize", "they shoot us for sport"]],
    buys: { topics: ["location"] }, sells: "overlook readings: every span within 6 of an aerie, on the world map", teaches: ["Tumbling"],
    riteVariant: { name: "the Ascent", rite: "lighting", needs: { height: 8 },
      how: "the Lighting, standing 8 blocks or more above the zone's ground",
      words: ["My light, up here with yours.", "Higher light sees farther. Kree."] },
    lines: { greet: {
      indifferent: "Kree. You walk. How sad. Is the ground nice?",
      liked: "Ground-friend. Look up more often. We wave.",
      loved: "Sky-kin, nearly. One day you'll fall upward. Kree." } },
  },
  clatter: {
    name: "the Clatter", parent: "beasts", temperament: "docile", startRep: both(50), color: [230, 120, 90], glyph: "c",
    liquid: "brine", rite: "deep", voice: { hz: 150, wave: "square", flags: ["grit"] }, homeRegions: ["flats", "glassShore"], homes: ["the Brine Flats", "the Glass shore"],
    about: "Uplifted crab-folk of the Flats and the Glass shore.",
    likes: [["drovers", "trade partners"], ["hollowmere", "neighbours"]],
    hates: [["saltbeasts", "brinehogs eat crabs"], ["rustbacks", "they wear our cousins' shells as hats"]],
    buys: { topics: ["location"] }, sells: "Locations of wrecks; salvage", teaches: ["Hardiness"],
    lines: { greet: {
      indifferent: "Tk. Tk. You smell of the Flats. Good. Buying shells?",
      liked: "Neighbour! Sit. Mind the claws. Mind the jokes, they pinch.",
      loved: "Shell-kin. We saved you the good brine. Don't tell the Drovers." } },
  },
  saltbeasts: {
    name: "the Saltbeasts", parent: "beasts", temperament: "aggressive", startRep: both(-400), color: [150, 120, 90], glyph: "",
    liquid: "blood", rite: "deep, Herdmothers only", voice: null, homeRegions: [], homes: ["everywhere"],
    about: "Wild animals: brinehogs, cairn hounds, ledgehorns, saltrats, dusk bats.",
    likes: [["rustbacks", "they ride us"]],
    hates: [["drovers", "they herd us"], ["clatter", "food"]],
    buys: { readings: [], topics: [] }, sells: "a Herdmother will sell her herd's peace", teaches: [],
    riteVariant: { name: "the Herdmother's Lighting", rite: "lighting", needs: { legend: "herdmother" },
      how: "the Lighting, with a legendary Herdmother: the herd follows her",
      words: null, narration: "She lowers her head to your lamp and breathes on it. The herd goes quiet." },
    lines: { greet: {} },
  },
  sporeMoot: {
    name: "the Spore Moot", parent: "growths", temperament: "neutral", startRep: both(-200), color: [190, 120, 200], glyph: "F",
    liquid: "mulchWine", rite: "dark", voice: { hz: 95, wave: "sine" }, homeRegions: ["pleatwood", "stacks"], homes: ["P", "the Pleatwood groves", "the damp Stacks"],
    about: "A fungal parliament in the Pleatwood groves. It sits in session for years.",
    likes: [["pleatwood", "we feed it, it feeds us"], ["unlit", "their patience"]],
    hates: [["chandlers", "they burn things"], ["plan", "it is sterile"]],
    buys: { topics: ["location"] }, sells: "recipes; underground routes", teaches: ["Leechcraft (tonics)"],
    riteVariant: { name: "the Snuffing (light dries us)", rite: "snuffing", needs: {},
      how: "both lights out, in the damp, an hour with the Moot", words: null },
    specials: [{ id: "limb", name: "a fungal limb", rep: -30, after: { sporeMoot: 200, pleatwood: -100 },
      text: "It grows where you let it. The Moot is delighted. The Pleatwood less so." }],
    lines: { greet: {
      indifferent: "The Moot is in session. Speak slowly. We will reply next season.",
      liked: "The Moot recognises the soft one. A motion to welcome you: carried, eventually.",
      loved: "The Moot counts you among its rot. It is a great honour. Sit in the damp." },
      trespass: { warn: "This grove is in session. Lower the light.", turn: "The Moot votes. Unanimous. Dry the intruder." } },
  },
  pleatwood: {
    name: "the Pleatwood", parent: "growths", temperament: "docile", startRep: both(0), color: [60, 140, 80], glyph: "♣",
    liquid: "sap", rite: "deep, at dusk", voice: { hz: 70, wave: "sawtooth", flags: ["stone"] }, homeRegions: ["pleatwood", "deepPleat"], homes: ["P", "the Pleatwood", "the Deep Pleat"],
    about: "Folding trees, from the Pleatwood to the Deep Pleat.",
    likes: [["sporeMoot", "it keeps our roots company"], ["kites", "they nest in us"], ["askew", "fellow folders"]],
    hates: [["assize", "they cut down the Square"], ["chandlers", "they burn wood for their presses"]],
    buys: { topics: ["location"] }, sells: "hidden paths (the Pleatwood's lost chance −75% for a day); Foldmother's fold schedule",
    teaches: ["Pathcraft (Forest Lore)"],
    riteVariant: { name: "the Lighting at dusk", rite: "lighting", needs: { hours: [18, 19] },
      how: "the Lighting, at dusk, while they fold",
      words: ["My light, before you close.", "We fold. Around it. Slowly."] },
    lines: { greet: {
      indifferent: "Slow down, walker. Everything worth saying takes a season.",
      liked: "Sit under us. We will fold over you at dusk, gently.",
      loved: "Seedling. We remember your footsteps. The rings will show them." },
      trespass: { warn: "That was a branch. We were using it.", turn: "Axe. Fire. Walker. We fold shut on you." } },
  },
  errata: {
    name: "the Errata", parent: "plane", temperament: "neutral", startRep: both(-250), color: [200, 200, 215], glyph: "E",
    liquid: "turnwater", rite: "deep, then flat", voice: { hz: 300, wave: "triangle", flags: ["doubled"] }, homeRegions: ["glassShore", "tessellate"], homes: ["I", "the Glass shore", "the Tessellate's edges"],
    about: "Misprinted doubles, along the Glass shore and the edges of the Tessellate.",
    likes: [["askew", "they understand angles"], ["unlit", "two of everything in the dark"]],
    hates: [["assize", "they would correct us"], ["flatfolk", "they call us smudges"]],
    hatesToo: ["their own originals, always"],
    buys: { topics: ["history", "village"] }, sells: "mirror versions of accounts", teaches: ["Parley (Mirror Talk)"],
    riteVariant: { name: "the Mirroring", rite: "lighting", needs: { then: "tracing" },
      how: "the Lighting in the deep view, then the Tracing on the map, in that order",
      words: ["My light on your wick. See by it.", "See I. Light my in wick your."], altWords: ["Here is my line.", "Mine meets it here."] },
    lines: { greet: {
      indifferent: "You're the original? Oh. We thought you'd be taller on the left.",
      liked: "We'd shake your hand, but we'd use the wrong one. Welcome.",
      loved: "Mirror-kin. You're the only original we don't mind." } },
  },
  // Every generated Bent village is its own faction (story/villages.js villageFaction, under `bent`); its people carry
  // this pool as a second membership. The Assize writ and the Aspirant of the Rule move it.
  bentVillages: {
    name: "the Bent villages", parent: "bent", temperament: "docile", startRep: both(0), color: [150, 160, 110], glyph: "@",
    liquid: "glim", rite: "deep", voice: null, homeRegions: ["flats", "downs", "pleatwood", "deepPleat", "teeth"], homes: ["wherever there is reed, salt or shade enough"],
    about: "The small villages of the Bent, wherever there is reed, salt or shade enough.",
    likes: [["hollowmere", "the old village"]],
    hates: [["assize", "they come with writs"]],
    buys: { topics: ["gossip", "location"] }, sells: "the villages' histories and dishes", teaches: [],
    lines: { greet: {
      indifferent: "Wipe your feet. The floor remembers who didn't.",
      liked: "Our friend from the road. The lamp's lit for you.",
      loved: "One of ours. Nobody counts your creases here." } },
  },
};

// --- The six faiths (bible §7) ------------------------------------------------------------------------------------
// Each faith's altar names the view it must be honoured in (the shrine kinds of content/villages.js VILLAGES.shrines);
// a prayer in the wrong view does nothing, and says so. What the hooks do in play is the shrines' and the sites'
// (social/shrines.js holds the donations; the rest is integration requests: docs/c2.md).
//
//   FAITHS[id] = { faction, name, shrine, creed, holy: [place], practices, rivals: [factionId],
//                  pray?: { view, height?, hours?, steleHour?, seconds?, blessings: [id], text }, desecrate: { act, rep },
//                  donate?: { glim?, per?, rep, cap?, dark? }, rite?: { name, band, days, text }, trespass: { rule },
//                  conversion?, lines: { pray, wrong, desecrate } }
export const FAITHS = {
  noonVigil: {
    faction: "noonVigil", name: "the Noon Vigil", shrine: "pillar",
    creed: "Noon gave her shadow to stop the dial, so every shadow is a debt owed to the afternoon. The Cube is to be kept, and never used.",
    holy: ["the Temple of Angles (A)", "three noon-posts", "the floor where Noon lies in the Unlit Choir"],
    practices: ["the Noon Stand: at noon, stand still on your own shortest shadow", "giving out fresh water", "tending the dead", "telling the Keeper's Descent"],
    rivals: ["horary", "lampless", "assize"],
    pray: { view: "3d", height: 8, hours: [11, 13], blessings: ["heal", "maxHp", "uncurse", "noonLength"],
      text: "Pray standing on top of a noon-post, between 11:00 and 13:00: a full heal, +1 max HP (the first time at each post), curses lifted, or the noon's length." },
    desecrate: { act: "pour umbra on a noon-post", rep: { noonVigil: -100, lampless: 50 } },
    donate: { glim: 50, rep: 10, cap: 200 },
    rite: { name: "the Short Shadow", band: "liked", days: 1, text: "For one world day, each turn of the view made between 11:00 and 13:00 heals 3 HP." },
    trespass: { rule: "the Cube's altar" },
    lines: { pray: "The post is warm at the top. Noon's shadow is short, and so, for now, is yours.",
      wrong: "The noon-post can't hear you from down there. Climb.",
      desecrate: "The umbra runs down the post and the post goes dark. Somewhere a bell misses a beat." },
  },
  horary: {
    faction: "horary", name: "the Horary", shrine: "relief",
    creed: "The Hours were divine ages. Time is holy and must move, and Noon stole the hour. The Seventh Hour will bring the Afternoon.",
    holy: ["the Hour-house in Halfnight (H)", "eight dial-steles", "the roadside dials"],
    practices: ["keeping the hours: praying at a stele at its carved hour", "ringing the Noon Bell", "reading Deep Inscriptions aloud", "the Chime"],
    rivals: ["noonVigil", "lampless"],
    pray: { view: "3d", steleHour: 1, blessings: ["domainDay"],
      text: "Pray at a dial-stele in the deep view, within a world hour of its carved hour: a day's blessing from that Hour's domain." },
    desecrate: { act: "chip the hour off a stele", rep: { horary: -150, noonVigil: 50 } },
    donate: { per: "Hour reading", rep: 25 },
    conversion: "the Chime, a Parley power taught at Warm: preach a neutral creature into following you (EGO against its WIL)",
    zealots: "the Seventh-Chimers, who serve Vesper quietly and waylay travellers on the roads",
    trespass: { rule: "letting your torch go out inside the Hour-house" },
    lines: { pray: "The carved hour and the hour agree. The stone hums like a struck bell.",
      wrong: "Wrong hour. The stele is patient; it has done this a long time.",
      desecrate: "The hour comes off in one chip. The stele is just a stone now, and it knows." },
  },
  lampless: {
    faction: "lampless", name: "the Lampless", shrine: "rune",
    creed: "Light drowns out truth, and the dead are the world's memory. The Evening will come and let everyone rest: don't lengthen the day.",
    holy: ["the Hush in Halfnight (H)", "the Unlit Choir (J)", "three Hushes", "the rune circles of the Shade"],
    practices: ["the Snuffing", "vigils without light", "reading runes with the fingers", "pouring out the last glim"],
    rivals: ["chandlers", "moths", "horary"],
    pray: { view: "dark", blessings: ["darkReading"], text: "Read a Hush's rune with the torch out." },
    snuffBrazier: { rep: 5, cap: 100 },
    desecrate: { act: "light a Hush", rep: { lampless: -150, moths: 50 } },
    donate: { per: 2, rep: 1, cap: 150, dark: true },
    conversion: "the Bent may learn the Snuff for −200; the Plumb may earn a dark-pass",
    trespass: { rule: "a lit torch in a holy place: below Warm neutral members turn on you; at Warm or above they ask once" },
    lines: { pray: "Your fingers find the rune in the dark. It was waiting for you, or for anyone.",
      wrong: "The rune won't read by lamplight. Put it out.",
      desecrate: "The Hush catches, and is not quiet any more." },
  },
  rule: {
    faction: "assize", name: "the Rule", shrine: null, stone: "a plumb-stone",
    creed: "The world was made plumb, and the Pressing creased it. The Bent are crooked lines, to be trued or struck out. The Seventh Hour will true the world.",
    holy: ["the Square (M)", "the plumb-stones beside the roads", "the Molar checkpoint", "any raised Rule-banner"],
    practices: ["truing", "measuring", "the vow of the level", "carrying a plumb-bob"],
    rivals: ["bentVillages", "flatfolk", "askew", "pressed", "errata"],
    truing: { genotype: "bent", rep: { assize: 300 }, text: "Submit at the Square or a plumb-stone: lose one mutation of your choice, with no refund." },
    vow: { genotype: "plumb", rep: { assize: 200, bentVillages: -100 }, trueMarks: 1, text: "Swear to the level: 1 true-mark, and the Square's gate opens to you." },
    banner: { rep: { assize: -50 }, text: "A Rule-banner trues its zone: no jumping, and falls hurt double. Knock it down for Assize −50." },
    desecrate: { act: "topple a plumb-stone", rep: { assize: -100, bentVillages: 25 } },
    trespass: { rule: "being Bent inside the Square at any standing below Bright" },
    lines: { pray: "You are measured, found wanting, and corrected. It hurts in a straight line.",
      wrong: "The stone wants you upright and still. You are neither.",
      desecrate: "The plumb-stone falls over, which is the one thing it was never supposed to do." },
  },
  pressed: {
    faction: "pressed", name: "the Pressed", shrine: "mosaic",
    creed: "Flatness is peace: nothing can hide in the Plane, so nothing can lie there. The Pressing was grace, and the Flatfolk are saints.",
    holy: ["Saltpage (O) and the Page", "the Pressyard's surface mosaic", "any floor mosaic larger than 9 × 9"],
    practices: ["lying flat on mosaics", "travelling by the map alone", "the half-paint", "walking pilgrimages"],
    rivals: ["kites", "plan", "assize"],
    pray: { view: "map", seconds: 10, blessings: ["mosaicReading", "thin"],
      text: "Stand on a large mosaic in the map view for 10 s: a reading of what it shows, and an hour of Thin (−25% damage from deep attackers)." },
    desecrate: { act: "break mosaic tiles by bombing or digging", rep: { pressed: -150, plan: 10 } },
    rite: { name: "the Pressing rite", band: null, days: 1, text: "At Saltpage, or for −100 reputation: for one world day you may turn flat for 3 s, once a floor." },
    unpressing: { rep: { pressed: -150 }, text: "Unpressing the Pressyard's village (beat 5)." },
    trespass: { rule: "boots on a holy mosaic are forgiven; bombs are not" },
    lines: { pray: "You lie still on the mosaic until you can read it from inside.",
      wrong: "The mosaic can't hear you from up there.",
      desecrate: "The tiles crack. Somewhere in the Plane, someone loses a face." },
  },
  plan: {
    faction: "plan", name: "the Plan", shrine: "mosaic",
    creed: "Everything was drawn before it was built, and the Deepwrights' master plan is complete and holy. Any deviation is an error, to be repaired to drawing.",
    holy: ["the Metronome (K)", "the intact floors of the Stacks", "the Truing Cradles"],
    practices: ["repairing things to specification", "keeping the beat", "reading floor plans on the map", "the Revision rite"],
    rivals: ["askew", "rustbacks", "sporeMoot"],
    donate: { per: "floor plan", rep: 25, trueMarks: [3, 6], text: "Map a dungeon floor to 90% and present it to any automaton: +25. A Plumb earns a true-mark for every 3 (at most 6)." },
    desecrate: { act: "destroy blocks in the Stacks by bombing or burrowing", rep: { plan: -50 }, warnFirst: true },
    rite: { name: "the Revision rite", band: "liked", text: "Submit a revision: a mosaic puzzle solved on the map." },
    conversion: "automata can be redrawn into followers with Artificing, if the Plan's standing with you is 0 or more",
    trespass: { rule: "damaging a structure: the first time a warning, after that −50 a block" },
    lines: { pray: "The automaton reads your floor plan twice and files it. \"Accurate.\"",
      wrong: "The revision is drawn on the map. Look down.",
      desecrate: "A block comes out of the drawing. Every automaton in the Stacks stops for one beat." },
  },
};

// --- The Hour cults (bible §6.3, §7.7, §8.7) ------------------------------------------------------------------------
// Every Hour of the run's history has a cult: generated factions, one per ruler, registered by the run's factions
// step (world/run.js, integration request). A cult takes its name from the ruler (story/history.js `ruler.cult.name`,
// "the Choir of the Glazier"), its members from the Hour's favoured factions, and holds the Hour's sites. You walk
// them unmolested at +600, or as a pilgrim with the cult pass (all three accounts of five of its Hour's events:
// `game.state.journal.cultPass[rulerId]`), or wearing the Hour's mask (+200).
//
//   factionOf(ruler) = { id: `cult:${ruler.short}`, name: ruler.cult.name, ...HOUR_CULT, likes: favoured + the Horary,
//     hates: the Hour's hated, about: HOUR_CULT.about with {name}, {cog}, {ordinal}, color: the domain's GRAMMAR rgb }
export const HOUR_CULT = {
  parent: "faiths", temperament: "aggressive", startRep: both(-500), pilgrimFloor: false, generated: true,
  liquid: "sunwine", rite: "deep", voice: { hz: 380, wave: "triangle", flags: ["vibrato"] }, glyph: "@", homeRegions: [],
  passRep: 600, maskRep: 200, likesHorary: "they keep the dials, if not the faith",
  pray: { view: "3d", shrine: "relief", blessings: ["domainDay"], text: "Pray at one of the Hour's steles: a day's blessing from the Hour's domain." },
  desecrate: { act: "chip the Hour's stele", rep: { cult: -100, hated: 50 } },
  buys: { readings: ["deep"], topics: ["history"] }, sells: "the Hour's Deep Inscriptions", teaches: [],
  about: "The cult of {name} {cog}, the {ordinal} Hour. It keeps the Hour's floors, and counts every stranger a thief.",
  lines: { greet: {
    indifferent: "These are the Hour's floors. Walk softly; it is sleeping below.",
    liked: "You know the Hour's story better than some of us. Pass, pilgrim.",
    loved: "Kin of the Hour. Your face is nearly worth a mask." },
    trespass: { warn: "Thieves are pressed into these floors. You are not a thief yet.", turn: "Thief. The Hour wants you for its floor." } },
};

for (const [id, def] of Object.entries(GROUPS)) registerFaction(id, { ...def, hidden: true, group: true, likes: [], hates: [] });
for (const [id, def] of Object.entries(FACTIONS)) registerFaction(id, def);
