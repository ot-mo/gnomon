// Quest texts (TECH_DESIGN §2.13, §2.18 "quests.js (texts)"; bible §9.6, §10.5, §11; WS7, then C5): the words of the
// village quest templates and the campaign's data. The templates themselves are code (story/villagequests.js
// registers them with story/quests.js registerQuest); the campaign's hooks are story/campaign.js.
//
//   QUESTS.templates[id] = { title, offer, text, done, need }   {slots}: {thing} {where} {place} {giver} {village}
//                     {to} {beast} {lost} {view} {shrine} {percent}; `need` is the view or system the bible says it asks
//   QUESTS.things     what a village can lose (bible §9.6 #1, #7: carried off, or set up somewhere high)
//   QUESTS.beasts     a named beast's epithets (#9)
//   QUESTS.words      the word a village sends another (#2), and the two answers you can carry back
//   QUESTS.campaign   { intro: [page], starter: [step], beats: [beat] } (bible §10.5's starter chain, §11's eleven beats)
//     page = { title?, text }
//     step = { id, title, giver, goal, teaches, reward }
//     beat = { id, n, title, landmark, band: [lo, hi], goal, after: [beat id] (any one of them: beats 7 and 8 share
//              "beat6"; beat 9 needs both), needsAll?, start?: matcher, done: matcher, lengthens?: true, choice? }
//     matcher = { event, landmark?, z?, id?, uid? }: the bus event that moves it (story/campaign.js beatMatches)
export const QUESTS = {
  templates: {
    recover: {
      title: "Recover {thing}", need: "navigation",
      offer: "Our {thing} was carried off to {place}, {where}. Bring it home and {village} won't forget it.",
      text: "{giver} of {village} wants {thing} back. It was carried off to {place}, {where}.",
      done: "That's it. That's really it. Put it here, gently.",
    },
    carry: {
      title: "Carry a word to {to}", need: "travel, reputation",
      offer: "Take our word to {to}, and bring their answer back. Mind what you say on the way.",
      text: "{giver} of {village} sends word to {to}, at span ({wx}, {wy}). Bring back their answer.",
      done: "So that's their answer. Well. We'll remember who carried it.",
    },
    readFloor: {
      title: "Read the floor at {place}", need: "flat",
      offer: "There's a mosaic in the green at {place}, {where}. Read it from above, as the old ones did, and tell me what it says.",
      text: "{giver} of {village} wants the reading of the mosaic at {place}, {where}. It reads only on the map.",
      done: "Say it again, slowly. Yes. That's what my grandmother said it said.",
    },
    pray: {
      title: "Pray at the shrine of {village}", need: "the shrine's view",
      offer: "Our shrine wants a prayer and none of us has the eyes for it today. {shrine}",
      text: "{giver} asks you to pray at {village}'s shrine. {shrine}",
      done: "I felt it. The whole green felt it.",
    },
    climb: {
      title: "Fetch {thing} from the perch", need: "height",
      offer: "Some fool set {thing} up on the old perch in the green. Nobody here climbs. You look like you might.",
      text: "{giver} of {village} wants {thing} down from the perch on the green. From above it's a dot; you'll have to climb.",
      done: "Down at last. Don't tell anyone how you did it.",
    },
    find: {
      title: "Find the place {where}", need: "the world map",
      offer: "My mother said something lies {where}. I never went. Go and look, and tell me it's real.",
      text: "{giver} of {village} says something lies {where}. Go there, then come back and say what you found.",
      done: "Then it's real. She was right all along.",
    },
    hunt: {
      title: "Hunt {beast}", need: "politics",
      offer: "{beast} has been taking our animals. It lairs {where}. Kill it and bring us the news.",
      text: "{giver} of {village} wants {beast} dead. It was last seen {where}.",
      done: "Dead? Truly? Then we sleep tonight.",
    },
    rescue: {
      title: "Bring {lost} home", need: "both views",
      offer: "{lost} went out a week ago and never came back. Last seen {where}. Find them.",
      text: "{giver} of {village} is waiting for {lost}, last seen {where}. Find them and send them home.",
      done: "They're home. I don't know how to thank you, so I'll pay you.",
    },
    chart: {
      title: "Chart {place}", need: "the map",
      offer: "Nobody has mapped {place}, {where}. Walk it until your map holds {percent} in a hundred of it, and show me.",
      text: "{giver} of {village} wants {place} charted: {percent}% of it on your map. It lies {where}.",
      done: "Look at that. Every turn of it. I'll copy it tonight.",
    },
  },
  things: ["the bell's tongue", "the founders' tile", "the lamp's first wick", "the reeve's dial", "the village longback's bell",
    "the drowned bell's clapper", "the shrine's salt stone", "the old weaver's shuttle", "the ink-pot of the founders", "the noon peg"],
  beasts: ["the Gnawer", "Old Sour-Tooth", "the Reed Thief", "the Night Grinder", "the Whistler", "Long Jaw"],
  words: {
    word: "We'll share the eel weirs this year, if you'll share your lamp oil.",
    answers: [
      { id: "faithful", label: "Carry their answer back word for word.", text: "You carry their answer back exactly as it was given." },
      { id: "sweetened", label: "Soften their answer on the way back.", text: "You smooth the answer a little. They'll like you better for it there, less here." },
    ],
  },

  // The campaign (TECH_DESIGN §8.3 "WS7": intro pages, the start, the main beats as data).
  campaign: {
    intro: [
      { title: "GNOMON", text: "Far to the north-east a needle stands over the world, taller than weather. Its shadow is the hour.\n\nFor three nights now the noon shadow has been longer than it should be, and something under the Temple of Angles in Hollowmere has been shaking the floor." },
      { text: "You are in the temple on the third night of the shaking, when the floor gives way beneath the sanctum stair.\n\nBelow, on a flat stone, lies a cube. When you touch it the world turns, and you see it from inside for the first time." },
      { title: "HOW TO PLAY", text: "You see the world two ways. Tab turns between them.\n  The map: from above, step by step, the whole place at once, and the flat things.\n  3D: from inside, height and depth, light and darkness.\n\nJ: journal (quests, places, histories, rumours, notes).   Walk into someone to talk." },
    ],
    // Bible §10.5: each step teaches one system; beat 1 runs alongside.
    starter: [
      { id: "turning", title: "The Turning", giver: null, goal: "Read the floor's angle mosaic on the map, go down the stair, touch the Cube.", teaches: "the two views", reward: "Tab, for good" },
      { id: "grubs", title: "Grubs in the Kettle", giver: "Reeve Hallen", goal: "Kill the Grub Mother on Kettle Mesa's floor 3, then come home through the culvert.", teaches: "map vs 3D, falling, the loop home", reward: "Hollowmere +100, 3 balms, a free Pathcraft power" },
      { id: "blankCorner", title: "Mira's Blank Corner", giver: "Mira", goal: "Read the wreck's deck mosaic on the map, then jump onto the hull in 3D and look into its hold.", teaches: "reading both views; jumping", reward: "a homing pip, 50 glim, Mira's map" },
      { id: "skull", title: "Brann's Skull", giver: "Brann", goal: "Brann's skull lies on the Keeper's Stair's floor 2, in the dark.", teaches: "the dark, ghost planks, the legacy dungeon", reward: "Brann's Lantern, the Hush Stair reading" },
      { id: "dialFloor", title: "The Dial Floor", giver: "Brother Tamsin", goal: "Read the Dial Floor's mosaic on the map, its relief in 3D and its rim in the dark.", teaches: "readings, the three accounts, world-map travel", reward: "the site's relic, a first true-mark or 2 creases" },
    ],
    // Bible §11: eleven beats up the tier gradient; 7 and 8 in either order; the Lengthening after 5, the first of 7/8, and 9.
    beats: [
      { id: "beat1", n: 1, title: "What Shakes the Temple", landmark: "kettleMesa", band: [1, 3], after: [],
        goal: "Find what has been shaking the temple floor: the sapper tunnel under Kettle Mesa.",
        done: { event: "zone:enter", landmark: "kettleMesa", z: 3 },
        choice: { label: "the Assize plumb-seal", options: [{ to: "survey", rep: 100, text: "Give the seal to Mira" }, { to: "chandlers", rep: 100, glim: 120, text: "Sell it to the Chandlers' buyer" }] } },
      { id: "beat2", n: 2, title: "The Datum", landmark: "benchmark", band: [3, 6], after: ["beat1"],
        goal: "Surveyor-General Quint needs a true reading from the Datum stone to measure the noon Hand.",
        done: { event: "zone:enter", landmark: "benchmark", z: 4 } },
      { id: "beat3", n: 3, title: "The Toll of the Teeth", landmark: "molar", band: [6, 9], after: ["beat2"],
        goal: "Get east, past the new Assize checkpoint at Molar.",
        done: { event: "zone:enter", landmark: "folio", z: 0 } },
      { id: "beat4", n: 4, title: "Plain Accounts", landmark: "folio", band: [9, 11], after: ["beat3"],
        goal: "Get the Flat Account of Noon's last day from Kay of the Long Line.",
        done: { event: "secret", id: "hist:noon:6:flat" } },
      { id: "beat5", n: 5, title: "The Pressyard", landmark: "pressyard", band: [10, 13], after: ["beat4"], lengthens: true,
        goal: "Stop the Press, and learn who restarted it.",
        done: { event: "zone:enter", landmark: "pressyard", z: 5 } },
      { id: "beat6", n: 6, title: "The Line", landmark: "halfnight", band: [12, 15], after: ["beat5"],
        goal: "Win the Lampless dark-pass into the Shade's heart: find out who lit the Hush.",
        done: { event: "zone:enter", landmark: "unlitChoir", z: 0 } },
      { id: "beat7", n: 7, title: "The Unlit Choir", landmark: "unlitChoir", band: [14, 17], after: ["beat6"], lengthens: "first",
        goal: "Find what the Lampless keep at the bottom of the Unlit Choir.",
        done: { event: "zone:enter", landmark: "unlitChoir", z: 6 } },
      { id: "beat8", n: 8, title: "The Beat", landmark: "metronome", band: [16, 20], after: ["beat6"], lengthens: "first",
        goal: "The Plan is forging the new hour hand to the Assize's drawing. Stop the Metronome.",
        done: { event: "zone:enter", landmark: "metronome", z: 6 } },
      { id: "beat9", n: 9, title: "Benchmark Besieged", landmark: "benchmark", band: [19, 22], after: ["beat7", "beat8"], needsAll: true, lengthens: true,
        goal: "The Assize and Vesper's longshadows attack Benchmark at dusk to take the Cube. Hold it.",
        done: { event: "zone:enter", landmark: "benchmark", z: 0 } },
      { id: "beat10", n: 10, title: "The Square", landmark: "square", band: [20, 23], after: ["beat9"],
        goal: "Take the Plumb Key from the Hierarch, or break her pact with Vesper.",
        done: { event: "zone:enter", landmark: "square", z: 3 } },
      { id: "beat11", n: 11, title: "The Dial-works", landmark: "gnomon", band: [23, 30], after: ["beat10"],
        goal: "Walk the Last Mile, open the door at noon, go down the Dial-works and face Vesper in the Noon Socket.",
        done: { event: "zone:enter", landmark: "gnomon", z: 8 } },
    ],
  },
};
