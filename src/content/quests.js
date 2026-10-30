// Quest texts (TECH_DESIGN §2.13, §2.18 "quests.js (texts)"; bible §9.6, §10.5, §11; WS7, then C5): the words of the
// village quest templates and the campaign's data. The templates themselves are code (story/villagequests.js
// registers them with story/quests.js registerQuest); the campaign's hooks are story/campaign.js.
//
//   QUESTS.templates[id] = { title, offer, text, done, need }   {slots}: {thing} {where} {place} {giver} {village}
//                     {to} {beast} {lost} {view} {shrine} {percent}; `need` is the view or system the bible says it asks
//   QUESTS.things     what a village can lose (bible §9.6 #1, #7: carried off, or set up somewhere high)
//   QUESTS.beasts     a named beast's epithets (#9)
//   QUESTS.words      the word a village sends another (#2), and the two answers you can carry back
//   QUESTS.waitingTemplates  bible §9.6's four templates the code doesn't play yet (kindle, unpress, count, walkShadow),
//                     with countSubjects and shadowActs for their slots
//   QUESTS.pools      { [regionId]: { things, beasts } }: the real world's village losses and beasts by region (C5)
//   QUESTS.campaign   { intro: [page], wake, starter: [step], beats: [beat], mystery, vesper, endings, epilogue }
//                     (bible §10.5's starter chain, §11's eleven beats, the mystery of beat 6, the finale and the endings)
//     page = { title?, text }; wake: the line logged when the intro closes on a real-world run
//     step = { id, title, giver, goal, teaches, reward, offer?, text, done, rewards }
//     beat = { id, n, title, landmark, band: [lo, hi], goal, after: [beat id] (any one of them: beats 7 and 8 share
//              "beat6"; beat 9 needs both), needsAll?, start?: matcher, done: matcher, lengthens?: true,
//              giver, offer, routes: [text], learn, reward { text, items?, rep?, glim?, maxHp? }, choices? }
//     choice = { id, label, byRoute?, options: [{ id, text, rep: { [factionId]: n }, glim?, items?, reading?, alliance? }] }
//              byRoute: the option is what the route you took did (beat 6's accusation, beat 8's sabotage, redrawing or
//              argument), recorded by the code as it happens, never offered as a menu
//     matcher = { event, landmark?, z?, id?, uid? }: the bus event that moves it (story/campaign.js beatMatches)
//   The landmark people's words are content/people-words.js (re-exported at the bottom, which also loads them).
export const QUESTS = {
  templates: {
    recover: {
      title: "Recover {thing}", need: "navigation",
      offer: "Someone carried off {thing}, ours, to {place}, {where}. Bring it home and {village} won't forget it.",
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
      offer: "There's a mosaic in the green at {place}. Read it from above, as the old ones did, and tell me what it says.",
      text: "{giver} of {village} wants the reading of the mosaic in the green at {place}, span ({wx}, {wy}). It reads only on the map.",
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
      offer: "There's a beast we call {beast}, and it has been taking our animals. It lairs {where}. Kill it and bring us the news.",
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
      offer: "Nobody has mapped {place}. Walk it until your map holds {percent} in a hundred of it, or all of it you can reach, and show me.",
      text: "{giver} of {village} wants {place} charted: {percent}% of it on your map, or all you can reach. It lies at span ({wx}, {wy}).",
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

  // Bible §9.6's four templates the code doesn't play yet (story/villagequests.js registers nine: docs/c5.md, integration
  // requests), in the same shape; their words are ready for when it does.
  waitingTemplates: {
    kindle: {
      title: "{act} the braziers at {place}", need: "light and the dark",
      offer: "The braziers at {place} are {state}, and they shouldn't be. {act} every one of them, then come and tell me.",
      text: "{giver} of {village} wants every brazier at {place} {done}. It lies {where}.",
      done: "Every one? Then {place} is as it should be, for a while.",
    },
    unpress: {
      title: "Unpress {lost}", need: "both views",
      offer: "{lost} was pressed into the floor at {place}. You can see them from above, plain as a tile. Stand on them and turn.",
      text: "{giver} of {village} wants {lost} unpressed from the floor at {place}, {where}: stand on the centre tile and turn.",
      done: "They're thin in the face, but they're standing up. That's more than most get.",
    },
    count: {
      title: "Count the {subject} at {place}", need: "one view, by subject",
      offer: "How many {subject} are there at {place}? Nobody here agrees, and it's started fights. Count them and tell me.",
      text: "{giver} of {village} wants the {subject} at {place} counted, {where}. {how}",
      done: "That many. Right. I owe somebody an apology, and somebody owes me twelve glim.",
    },
    walkShadow: {
      title: "Walk the Shadow at {place}", need: "the Hand",
      offer: "The Hand will lie on {place} soon. Be there when it does, and {act}. Don't ask me why. My grandmother did it.",
      text: "{giver} of {village} wants you at {place} while the Hand lies on it ({where}), to {act}. The world map shows when.",
      done: "You stood in it. Did it feel long? It always felt long to her.",
    },
  },
  // waitingTemplates' slots: kindle {act} Light/Snuff, {state} out/lit, {done} lit/out; count {subject} and {how}:
  countSubjects: [
    { subject: "ghosts", how: "Ghosts only show with your torch out." },
    { subject: "spike tiles", how: "Spike tiles only show plainly on the map." },
    { subject: "pillars", how: "Pillars only count from inside, in 3D." },
  ],
  shadowActs: ["turn there", "stand 8 blocks up", "keep your torch out for 2 world hours"],

  // A village's losses and beasts by region (bible §9.3's cultures): the real world's pools, for story/questplan.js to
  // read before the flat lists above (integration request; the test world's villages keep `things` and `beasts`).
  pools: {
    flats: { things: ["the eel-weir's first stake", "the glimseed press's iron screw", "the reed-mother's sickle"], beasts: ["Old Sour-Tooth", "the Weir Breaker"] },
    waste: { things: ["the well's brass cup", "the caravan's salt ledger", "the founders' mirror"], beasts: ["the Glare", "Dry Mouth"] },
    steps: { things: ["the camp's rust bell", "the Wheel's tally-stick", "the first longback's halter"], beasts: ["the Scav King", "Long Jaw"] },
    downs: { things: ["the barrow key", "the shepherd's dial", "the boundary stone's brass cap"], beasts: ["the Barrow Hound", "the Whistler"] },
    pleatwood: { things: ["the fold-sap ladle", "the naming knot", "the canopy bell"], beasts: ["the Hangman Vine", "Seven Teeth"] },
    deepPleat: { things: ["the moot's spore jar", "the crease-map", "the root-drum"], beasts: ["the Stinging Choir", "the Grey Wasp"] },
    tessellate: { things: ["the missing tile", "the page-town's seal", "the founders' stencil"], beasts: ["the Smudge", "the Blot"] },
    shade: { things: ["the snuffer of the first night", "the quiet bell", "the abbess's candle, never lit"], beasts: ["the Gloamer", "Hulven's Shade"] },
    stacks: { things: ["the storey-key", "the founders' plumb", "the press-plate with our name on it"], beasts: ["the Clatterer", "the Night Grinder"] },
    glassShore: { things: ["the glass bell", "the tide-dial", "the drowned keeper's lamp"], beasts: ["the Glass Crab Queen", "Slagback"] },
    teeth: { things: ["the eyrie's rope", "the cliff-shrine's chime", "the lamp from the high cave"], beasts: ["the Gnawer", "the Ledge Ram"] },
  },

  // The campaign (TECH_DESIGN §8.3 "WS7": intro pages, the start, the main beats as data; bible §10.5, §11).
  campaign: {
    intro: [
      { title: "GNOMON", text: "Far to the north-east a needle stands over the world, taller than weather. The Horary says its shadow is the hour.\n\nFor three nights now something under the Temple of Angles in Hollowmere has been shaking the floor." },
      { text: "You were born in Hollowmere, or came with a caravan, or came down from a Level with a letter for the Prioress. It doesn't matter tonight.\n\nOn the third night of the shaking the sanctum stair cracks open. Below it, on the altar, a cube is humming." },
      { title: "HOW TO PLAY", text: "You see the world two ways. Until you touch the Cube, you see only one of them.\n  The map: from above, step by step, the whole place at once, and the flat things.\n  3D: from inside, height and depth, light and darkness.\nTab turns between them, once you can.\n\nJ: journal (quests, places, histories, rumours, notes).   Walk into someone to talk." },
    ],
    // The line logged when the intro closes on a real-world run (game.js startRun logs the parent's "Maren is waiting in
    // the main hall" today: integration request).
    wake: "The floor shakes you awake again. Maren is in the main hall to the south, and below it the sanctum stair stands open.",
    // Bible §10.5: each step teaches one system; beat 1 runs alongside. offer: the giver's words; text: the journal's;
    // done: the giver's thanks. rewards: what the step gives (the code that pays it and moves each step is a request).
    starter: [
      { id: "turning", title: "The Turning", giver: null, goal: "Read the floor's angle mosaic on the map, go down the stair, touch the Cube.", teaches: "the two views", reward: "Tab, for good",
        text: "The temple floor is one great angle. Read it from above, then go down to the sanctum and touch the Cube.",
        done: "The world turns, and you see it from inside for the first time: tall, lit and heavy. Tab turns it back.",
        rewards: { tab: true } },
      { id: "grubs", title: "Grubs in the Kettle", giver: "Reeve Hallen", goal: "Kill the Grub Mother on Kettle Mesa's floor 3, then come home through the culvert.", teaches: "map vs 3D, falling, the loop home", reward: "Hollowmere +100, 3 balms, a free Pathcraft power",
        offer: "Something is eating the glimseed from underneath. I'd go myself, but I'm the Reeve, and the Reeve stays where the shouting can find her. The holes lead back to Kettle Mesa, two spans north-east. Kill whatever is mothering them.",
        text: "Reeve Hallen wants the Grub Mother dead, on Kettle Mesa's third floor. Step off a ledge in 3D and you drop one floor, unhurt; the culvert at the bottom runs home to the temple well.",
        done: "Dead? Then the glimseed is ours again. Take the balms, and let me show you how a Reeve walks a road.",
        rewards: { rep: { hollowmere: 100 }, items: [["balm", 3]], power: "pathcraft" } },
      { id: "blankCorner", title: "Mira's Blank Corner", giver: "Mira", goal: "Read the wreck's deck mosaic on the map, then jump onto the hull in 3D and look into its hold.", teaches: "reading both views; jumping", reward: "a homing pip, 50 glim, Mira's map",
        offer: "My map of this block has a blank corner, and the blank is the wreck in the Mere. The deck is a mosaic: read it from above. Then get onto the hull and look in the hold. I don't jump. I measure.",
        text: "Mira wants the wreck in the Hollow Mere on her map: its deck mosaic read on the map, then a sprinting jump onto the hull in 3D and a look into the hold.",
        done: "That's the corner filled. Here's the map. It's accurate, which makes it the only one.",
        rewards: { glim: 50, items: [["homingPip", 1]], reveal: "Mira's map: block (1, 5) and its neighbours on the world map" } },
      { id: "skull", title: "Brann's Skull", giver: "Brann", goal: "Brann's skull lies on the Keeper's Stair's floor 2, in the dark.", teaches: "the dark, ghost planks, the legacy dungeon", reward: "Brann's Lantern, the Hush Stair reading",
        offer: "My skull is on the second floor of the Stair, in the dark, where I left it. Maren will open the landing for you. Bring it up and I'll tell you how the Hush Stair is crossed.",
        text: "Brann's skull lies on the Keeper's Stair's second floor. Maren unseals the first landing. Some planks there only show with your torch out.",
        done: "Thank you. Take the lantern. Sit by it with your torch out and you'll mend. I did, for a while.",
        rewards: { items: [["lantern", 1]], reading: "the Hush Stair", opens: "the Keeper's Stair" } },
      { id: "dialFloor", title: "The Dial Floor", giver: "Brother Tamsin", goal: "Read the Dial Floor's mosaic on the map, its relief in 3D and its rim in the dark.", teaches: "readings, the three accounts, world-map travel", reward: "the site's relic, a first true-mark or 2 creases",
        offer: "The Dial Floor, north of the village, tells one story three ways. Read the floor from above, the pedestal by light and the rim in the dark. The Horary pays for the difference.",
        text: "Read the Dial Floor three ways: the mosaic on the map, the pedestal's relief in 3D, the rim's rune with your torch out. Then follow its arrow to the Fifth-Hour site.",
        done: "Three accounts, and they don't agree. Good. Agreement is how you know someone has been at the stone.",
        rewards: { relic: "the Fifth-Hour site's", plumb: { trueMarks: 1 }, bent: { creases: 2 } } },
    ],
    // The campaign's own things (bible §11): text for whoever registers them as items (a request; the rewards name the
    // rest by C4's ids, content/items/artifacts.js and tonics.js, and the parent's relics, items/legacy.js RELICS).
    questItems: {
      assizeSeal: { name: "Assize plumb-seal", info: "A brass seal: a plumb-line in a square. From above it is a square with a line in it, which is the whole of the Rule." },
      darkPass: { name: "the dark-pass", info: "A strip of black cloth knotted three times. Carried unlit, it lets you into the Shade's heart with the Lampless' leave." },
      hourHand: { name: "the Hour Hand", info: "A hand of black truesteel as long as a longback, forged to your drawing. It points wherever it is set, with great confidence." },
      plumbKey: { name: "the Plumb Key", info: "A square key with no teeth, true on every face. The Gnomon's door opens to it at noon." },
    },
    // Bible §11: eleven beats up the tier gradient; 7 and 8 in either order; the Lengthening after 5, the first of 7/8,
    // and 9. giver/offer: who sets it and how; routes: the ways through (bible: at least two); learn: what it tells you;
    // reward { text, items, rep, glim, maxHp }; choices: [{ id, label, options: [{ id, text, rep, glim? }] }] (a beat's
    // reputation choice; the code that offers and pays them is a request).
    beats: [
      { id: "beat1", n: 1, title: "What Shakes the Temple", landmark: "kettleMesa", band: [1, 3], after: [],
        giver: "Maren", goal: "Find what has been shaking the temple floor: the sapper tunnel under Kettle Mesa.",
        offer: "Three nights of shaking, and the Cube humming. Something is digging under us, and it isn't grubs. Find out what, before the temple finds out the hard way.",
        routes: ["Go down Kettle Mesa to floor 3 and look for a fresh tunnel.", "Put your torch out in the crypt and ask Brann what he heard. Bomb the undercroft wall where he points.",
          "On the map, ask Ess and Tee. They read the tunnel as a line of disturbed floor, and walk you along it."],
        learn: "A sapper tunnel, cut straight as a ruler, runs under the Steps towards the temple. In the spoil lies a brass seal: a plumb-line in a square. The Assize's.",
        reward: { text: "The Assize plumb-seal, and Maren's blessing: +5 max HP.", items: [["assizeSeal", 1]], maxHp: 5 },
        done: { event: "zone:enter", landmark: "kettleMesa", z: 3 },
        choices: [{ id: "seal", label: "the Assize plumb-seal", options: [
          { id: "survey", text: "Give the seal to Mira.", rep: { survey: 100 } },
          { id: "chandlers", text: "Sell it to Pell's Chandler buyer.", rep: { chandlers: 100, survey: -50 }, glim: 120 }] }] },
      { id: "beat2", n: 2, title: "The Datum", landmark: "benchmark", band: [3, 6], after: ["beat1"],
        giver: "Surveyor-General Quint-Vey", goal: "Surveyor-General Quint needs a true reading from the Datum stone to measure the noon Hand.",
        offer: "Interesting. Don't move, you're in my line. The noon Hand is long, and I need to know how long. The Datum stone under the pillar is the last true level. Read it standing at its height.",
        routes: ["Go down the Datum's four floors and read the stone at its level, on its plinth.", "Pay Detail C to read it: 300 glim, or nothing at Plan Warm.",
          "As a Plumb of Vey, read the Deepwright script on floor 3's door and walk through."],
        learn: "The verdict: \"The noon Hand has grown by a finger's width, and most of it this month.\"",
        reward: { text: "The plumb-bob, and the Datum's two lower floors with their cache.", items: [["plumbBob", 1]] },
        done: { event: "zone:enter", landmark: "benchmark", z: 4 },
        choices: [{ id: "reading", label: "the Datum reading", options: [
          { id: "survey", text: "Keep the reading inside the Survey.", rep: { survey: 100 } },
          { id: "horary", text: "Sell it to the Horary. (The Seventh-Chimers will learn your name.)", rep: { horary: 150, survey: -100 }, ambush: "seventhChimers" }] }] },
      { id: "beat3", n: 3, title: "The Toll of the Teeth", landmark: "molar", band: [6, 9], after: ["beat2"],
        giver: "Assizer Castor Dell-Cassin", goal: "Get east, past the new Assize checkpoint at Molar.",
        offer: "Stand straight. Straighter. The pass is closed to the Bent and to Deepwright contraband, and you look like both.",
        routes: ["Pay Mother Saffre's toll and a bribe: 200 glim. Plumb characters pass free.", "Kindle with Zaqar Tesfu, sell him 2 readings and travel as a caravan hand.",
          "Smuggle yourself through the Root Canals: 2 dark floors, torch out.", "Take the long way round the Teeth's south end: 5 or 6 spans of Downs.",
          "Cross the Hush Stair at night with your lamp out. You need its reading."],
        learn: "The east opens, and you have a Drover or a Chandler who knows your name.",
        reward: { text: "The road east, and a contact." },
        done: { event: "zone:enter", landmark: "folio", z: 0 },
        choices: [{ id: "smuggler", label: "the smugglers in the Canals", options: [
          { id: "assize", text: "Hand a smuggler to Assizer Dell-Cassin.", rep: { assize: 150, drovers: -150 } },
          { id: "pilgrims", text: "Help a Bent pilgrim family through the Canals.", rep: { drovers: 100, hollowmere: 50, assize: -150 } }] }] },
      { id: "beat4", n: 4, title: "Plain Accounts", landmark: "folio", band: [9, 11], after: ["beat3"],
        giver: "Kay of the Long Line", goal: "Get the Flat Account of Noon's last day from Kay of the Long Line.",
        offer: "Noon's last day? That line is very long and very thin. I keep it, I don't give it away.",
        routes: ["Talk on the map and trade 2 deep readings.", "Trace with Kay and ask for it (−40 with the Flatfolk).",
          "Plead before Ell's court on the map: read a mosaic contract aloud and find its forged tile.",
          "If the Flatfolk won't speak to you, walk into the archive by its drawn door, on the map, and read the floor yourself."],
        learn: "Noon's Flat Account: she wasn't killed, she was pressed, and her shadow lies in the Shade. And a lead: the pressings have begun again, at the Pressyard.",
        reward: { text: "Noon's Flat Account, a key reading.", reading: "hist:noon:6:flat" },
        done: { event: "secret", id: "hist:noon:6:flat" },
        choices: [{ id: "warning", label: "the Assize's sappers", options: [
          { id: "flatfolk", text: "Warn Folio about the Assize. (Their sappers may help you later.)", rep: { flatfolk: 100 } },
          { id: "pressed", text: "Sell the warning to the Pressed.", rep: { pressed: 100, flatfolk: -50 } }] }] },
      { id: "beat5", n: 5, title: "The Pressyard", landmark: "pressyard", band: [10, 13], after: ["beat4"], lengthens: true,
        giver: null, goal: "Stop the Press, and learn who restarted it.",
        offer: "Under the mosaic village the Deepwright Press is running again. You can feel the beat in your teeth from the field.",
        routes: ["Fight down 5 floors and break the Press's three pistons.", "On floor 3, unpress Tovi Hallen, the Reeve's son. He knows the stop sequence.",
          "Show an Assize writ (your own, or one Pell forges for 150 glim) and order the Press stopped for inspection."],
        learn: "Clear glim is pressed from people, and House Saffre buys it. Press-Master Marr-Orrum answers to Hierarch Strade, and Strade answers to \"the Evening\".",
        reward: { text: "The unpress lens, and the freed captives.", items: [["unpressLens", 1]] },
        done: { event: "zone:enter", landmark: "pressyard", z: 5 },
        choices: [
          { id: "saffre", label: "House Saffre", options: [
            { id: "expose", text: "Expose House Saffre.", rep: { chandlers: -300, hollowmere: 100, lampless: 100 } },
            { id: "silence", text: "Take its silence money. (You keep a Shame reading.)", rep: { chandlers: 200 }, glim: 500, reading: "shame:saffre" }] },
          { id: "village", label: "the mosaic village above", options: [
            { id: "unpress", text: "Unpress the village. (Thirty come back; the Errata at its edges don't take it well.)", rep: { pressed: -150, hollowmere: 50 } },
            { id: "leave", text: "Leave it pressed.", rep: { pressed: 100 } }] }] },
      { id: "beat6", n: 6, title: "The Line", landmark: "halfnight", band: [12, 15], after: ["beat5"],
        giver: "Abbess Wisse", goal: "Win the Lampless dark-pass into the Shade's heart: find out who lit the Hush.",
        offer: "During the Snuffing someone lit the Hush. The city is one shout from a riot. Find who did it and I'll give you the dark-pass. Accuse wrongly and we'll both live with it.",
        routes: ["Investigate, then accuse: one clue of what happened and one of why, that agree.", "Side outright with one faith: bribe the Line Court, or break it. The other faith turns on you.",
          "Skip the pass and slip into the Shade. The Choir's monks will remember."],
        learn: "In Halfnight the accusation becomes the truth. Whoever you name lit the Hush.",
        reward: { text: "The dark-pass, if you won it, and a city in the climate you chose." },
        done: { event: "zone:enter", landmark: "unlitChoir", z: 0 },
        choices: [{ id: "accused", label: "the accused", byRoute: true, options: [
          { id: "horary", text: "Accuse a Horary suspect.", rep: { horary: -150, lampless: 100 } },
          { id: "lampless", text: "Accuse a Lampless suspect.", rep: { lampless: -150, horary: 100 } },
          { id: "neither", text: "Accuse a Chandler or a moth-tender.", rep: {} }] }] },
      { id: "beat7", n: 7, title: "The Unlit Choir", landmark: "unlitChoir", band: [14, 17], after: ["beat6"], lengthens: "first",
        giver: null, goal: "Find what the Lampless keep at the bottom of the Unlit Choir.",
        offer: "The Choir sings so you can find the stairs. At the bottom, the Lampless say, something is listening.",
        routes: ["Go down all 6 dark floors.", "At Lampless Warm, follow Abbess Wisse down the Quiet Stair, past floors 2 to 4.",
          "Pour for thol, the ghost choirmaster. He opens a ghost-plank shaft from floor 1 to floor 5."],
        learn: "Noon, on the map with your torch out: the dial slips because Vesper, her shadow, pulls it. The Assize means to set a new hour hand in the Gnomon, forged at the Metronome. The Gnomon's door opens at noon to the Plumb Key, or to the Cube turned on its threshold.",
        reward: { text: "Noon's Face, the Cube's sixth face: each turn leaves you untouchable for 1 s (every 8 s at most).", face: "noon" },
        done: { event: "zone:enter", landmark: "unlitChoir", z: 6 },
        choices: [{ id: "noon", label: "what Noon told you", options: [
          { id: "promise", text: "Promise Noon to hold the noon.", rep: { noonVigil: 200, lampless: -100 } },
          { id: "abbess", text: "Tell Abbess Wisse what Noon said.", rep: { lampless: 150, noonVigil: -100 } },
          { id: "nobody", text: "Tell no one.", rep: {} }] }] },
      { id: "beat8", n: 8, title: "The Beat", landmark: "metronome", band: [16, 20], after: ["beat6"], lengthens: "first",
        giver: "Section Nine", goal: "The Plan is forging the new hour hand to the Assize's drawing. Stop the Metronome.",
        offer: "Section Nine does not stop the beat to talk. The drawing on floor 5 is approved. The hand will be finished in nine hundred beats, give or take none.",
        routes: ["Sabotage: climb the Escapement and break the pendulum.", "Revise: on floor 5, at Plan Warm or unseen, flip 4 tiles of the master drawing on the map. The hand is forged for you.",
          "Argue: show Section Nine the Datum reading. The Assize's drawing is out of true."],
        learn: "The hand is the Assize's: a Seventh Hour drawn to the Rule, to be set in the Gnomon and turned.",
        reward: { text: "The Hour Hand (if you redrew it), or an Assize without one." },
        done: { event: "zone:enter", landmark: "metronome", z: 6 },
        choices: [{ id: "hand", label: "the hour hand", byRoute: true, options: [
          { id: "sabotage", text: "Break the pendulum. The floors fall still.", rep: { plan: -400 } },
          { id: "revise", text: "Redraw the hand for yourself.", rep: { plan: 100 }, items: [["hourHand", 1]] },
          { id: "argue", text: "Argue the drawing out of true.", rep: { plan: 200 } }] }] },
      { id: "beat9", n: 9, title: "Benchmark Besieged", landmark: "benchmark", band: [19, 22], after: ["beat7", "beat8"], needsAll: true, lengthens: true,
        giver: "Surveyor-General Quint-Vey", goal: "The Assize and Vesper's longshadows attack Benchmark at dusk to take the Cube. Hold it.",
        offer: "They're coming in three days, at dusk, for the Cube. I've measured it twice. Bring whoever likes you.",
        routes: ["Defend against the waves. Every faction that is Warm with you sends a defence.", "Strike first: raid the Assize camp at (13..14, 10) the night before.",
          "Evacuate the Survey to Hollowmere. The station is lost until the end, but nobody dies on your account."],
        defences: { drovers: "a wagon wall (3D cover)", plan: "2 turrets", lampless: "shades in the doused yard (the dark)", kites: "the attack lanes, drawn on the map in advance",
          flatfolk: "sappers on the Plane, who press the siege towers flat", hollowmere: "the militia", moths: "swarms that drown the longshadows in light" },
        learn: "The longshadows came out of the Shade at dusk, and every one of them pointed at the Gnomon.",
        reward: { text: "Survey +100 to +400 by the survivors, the Mark and the waves held; the Great Theodolite.", items: [["greatTheodolite", 1]], rep: { survey: [100, 400] } },
        done: { event: "zone:enter", landmark: "benchmark", z: 0 },
        choices: [{ id: "fire", label: "the archive tower burns", options: [
          { id: "archive", text: "Save the archive.", rep: { survey: 200 } },
          { id: "refugees", text: "Save the Bent refugees in the cellar.", rep: { hollowmere: 200, bentVillages: 200 } }] }] },
      { id: "beat10", n: 10, title: "The Square", landmark: "square", band: [20, 23], after: ["beat9"],
        giver: "Hierarch Aurel Strade-Orrum", goal: "Take the Plumb Key from the Hierarch, or break her pact with Vesper.",
        offer: "The Hierarch holds the Plumb Key two floors above the gate, in a room the same as every other room.",
        routes: ["Assault all 5 floors.", "Infiltrate: take the vow (Plumb only), use a forged writ, or free the pressed prisoners on the map and let Lio start a riot.",
          "Persuade her with the Pressyard's evidence and Noon's Flat Account (EGO against 15, or Assize Grey or better).", "Join her."],
        learn: "Strade made her pact for a straight world: no shadows longer than the Rule allows. Vesper promised her one, and lied about whose.",
        reward: { text: "The Plumb Key, or Strade as an ally.", items: [["plumbKey", 1]] },
        done: { event: "zone:enter", landmark: "square", z: 3 },
        choices: [{ id: "hierarch", label: "the Hierarch", options: [
          { id: "kill", text: "Kill her.", rep: { assize: -400, bentVillages: 200 } },
          { id: "spare", text: "Spare her and turn her. The patrols stop.", rep: { assize: 300 } },
          { id: "join", text: "Join her: the Assize alliance.", rep: { assize: 600, survey: -300, hollowmere: -300 }, alliance: "assize" }] }] },
      { id: "beat11", n: 11, title: "The Dial-works", landmark: "gnomon", band: [23, 30], after: ["beat10"],
        giver: null, goal: "Walk the Last Mile, open the door at noon, go down the Dial-works and face Vesper in the Noon Socket.",
        offer: "From the Last Milestone it is about five spans of Lattice to the needle's foot. The door opens between 11:00 and 13:00.",
        routes: ["Open the door with the Plumb Key.", "Turn the Cube on the threshold. It takes a little of your shadow: 10 max HP, for good.", "Let Hierarch Strade open it, if she walks with you."],
        learn: "Eight floors down, in the Noon Socket, the age's hand is set. Vesper is standing on it.",
        reward: { text: "An ending." },
        done: { event: "zone:enter", landmark: "gnomon", z: 8 } },
    ],

    // Beat 6's mystery, Who Lit the Hush? (bible §11.6). Four suspects from the city's cast (names drawn from each one's
    // `names`); four circumstance clues, one in each place, each naming a suspect the run deals it; one motive a suspect.
    // An accusation is a circumstance and a motive naming the same suspect; the climate follows the two clues' tags.
    mystery: {
      title: "Who Lit the Hush?",
      suspects: [
        { id: "ringer", role: "a Horary bell-ringer", faction: "horary", names: ["Osse", "Ilka", "Tovar"],
          motive: { tag: "faith", text: "{name} has said, in the Hour-house and out of it, that a dark chapel on the Line is a lie told to the noon." } },
        { id: "factor", role: "a Chandler factor", faction: "chandlers", names: ["Sev", "Marrit", "Quillan"],
          motive: { tag: "trade", text: "{name} sells lamp oil by the night, and the Snuffing costs House Saffre a night's oil every month." } },
        { id: "novice", role: "a Lampless novice", faction: "lampless", names: ["Ishe", "Sesh", "Nelle"],
          motive: { tag: "grief", text: "{name}'s sister went into the Shade at the last Snuffing and didn't come back. Someone saw {name} light a candle for her once." } },
        { id: "mothTender", role: "a moth-tender", faction: "moths", names: ["Wenna", "Hob", "Lisk"],
          motive: { tag: "fear", text: "{name}'s moths die in the dark. Every Snuffing {name} sits up with them, and every Snuffing some of them don't wake." } },
      ],
      circumstances: [
        { id: "footprints", view: "map", tag: "trade", text: "Glim footprints cross the Line from the south side to the Hush's door and back. The heel is worn the way {name}'s is." },
        { id: "witness", view: "dark", tag: "grief", text: "a ghost by the hush door\nit says {name} came at the second hour\nand cried\nand struck the flint" },
        { id: "lamp", view: "3d", tag: "faith", text: "A shuttered lamp on a ledge above the Hush, 3 blocks up, still warm. Its wick is trimmed the way {name} trims them." },
        { id: "gossip", view: "talk", tag: "fear", text: "\"{name} was out in the street during the Snuffing. Nobody's out during the Snuffing. Ask anyone. Ask {name}.\"" },
      ],
      accuse: "You name {name} before the Line Court. In Halfnight that makes it so.",
      pass: [["darkPass", 1]],   // what Abbess Wisse gives for an accusation, or for siding outright (routes 1 and 2; never route 3)
      climates: [
        { id: "concord", tags: ["faith", "grief"], rep: { horary: 200, lampless: 200 }, text: "Concord. The two faiths share the blame, and so they share the street." },
        { id: "uneasy", tags: null, rep: { horary: 100, lampless: 100 }, text: "Uneasy. Both faiths accept the verdict, and neither crosses the Line to say so." },
        { id: "riven", tags: ["trade", "fear"], rep: { horary: 50, lampless: 50 }, closes: "the ghost market", text: "Riven. The verdict holds and nobody believes it. The ghost market doesn't open that night, or any night after." },
      ],
    },

    // Vesper, the Long Shadow (bible §11.11; C3's `vesper` in content/creatures/waiting.js): her three phases as data for
    // the fight's code (a request; never `boss`, the Lich King's). `says` is logged as the phase begins.
    vesper: {
      phases: [
        { id: "flat", view: "map", says: "you came all this way to stand in my light",
          how: "A long shadow sweeps the Socket's dial like a hand. On the map her line shows, and her next sweep: stay out of it and strike her tip. In 3D she is a darkness nothing touches." },
        { id: "dark", view: "dark", says: "there now\nnobody can see",
          how: "She snuffs every light. Put your torch out to see her. Only brazier-light hurts her: relight the dial's four braziers while she blows them out." },
        { id: "deep", view: "3d", says: "then look up",
          how: "She stands as tall as the hall. Climb the hour numerals, I to V, to her head at 6 blocks; strike there, and turn at her head for the last blow. The Noonglass makes her weak point glow." },
      ],
      dies: "Vesper lies down along the dial, the length of a long afternoon, and waits for you to choose.",
    },

    // Bible §11.12: chosen at the Socket after Vesper's third phase. requires: what the choice needs.
    endings: [
      { id: "holdNoon", title: "Hold Noon", requires: {}, act: "Turn the Cube back to noon.",
        text: "You turn the Cube, and the dial stops where it stood a thousand years ago. Vesper sleeps. The Shade stays. You cast no shadow after that, and the Temple of Angles carves you into its wall as Noon's keeper, standing very straight." },
      { id: "seventhHour", title: "The Seventh Hour", requires: { items: ["hourHand"] }, act: "Set the hand and turn the dial forward.",
        text: "The new hand seats with a sound like a door. The Afternoon begins: long shadows, long rests, pressings at dusk. You rule it as the Seventh Hour, and the dial turns on, through evening and night, to the dawn of a new day of the world.", legacy: true },
      { id: "wholeNoon", title: "Whole Noon", requires: { items: ["noonglass"], rep: { flatfolk: "warm", lampless: "warm" } }, act: "Focus the noon light through the Noonglass and cast Noon's shadow back onto her.",
        text: "The Noonglass gathers the noon and lays it down the Socket. Vesper's shadow runs back along it to Noon's feet, and stays there. The Shade lifts. The Plane opens. Far off in Hollowmere, Ess and Tee stand up." },
      { id: "pressing", title: "The Pressing", requires: { any: [{ alliance: "assize" }, { rep: { pressed: "bright" } }] }, act: "Give Vesper the Cube.",
        text: "Vesper takes the Cube and turns it once. The noon Hand runs out across the world, all the way to Hollowmere, and the world lies down. You rise out of your own eyes, back up above. The map is all there is now. It is very easy to read." },
    ],

    // The epilogue (bible §11.12): a page for each major faction and Hollowmere, the variant by your final band with it
    // (low: Cold or worse, mid: Grey, high: Warm or better), written in that faction's account (flat, deep, dark).
    epilogue: {
      hollowmere: { account: "flat", low: "HOLLOWMERE. Stilts 212. Your name: struck from the reeve's roll, 1 line.", mid: "HOLLOWMERE. Stilts 212. Glimseed: good year. Your room: let to a cousin.", high: "HOLLOWMERE. Stilts 213. The new one is yours, for when you come home." },
      survey: { account: "flat", low: "SURVEY. Your readings: 0 accepted.", mid: "SURVEY. The Mark: re-cut, 1 finger lower. Your readings: filed.", high: "SURVEY. A benchmark at Hollowmere bears your name. It is level." },
      assize: { account: "deep", low: "THE RULE REMEMBERS THE CROOKED. IT HAS A LIST.", mid: "THE ASSIZE MEASURED YOU AND FOUND YOU WITHIN TOLERANCE.", high: "STRAIGHT WAS THE ONE WHO WALKED BESIDE THE HIERARCH, AND STRAIGHT THE ROAD AFTER." },
      horary: { account: "deep", low: "THE HOURS DO NOT RING FOR THE ONE WHO SOLD THE NOON.", mid: "A BELL WAS CAST IN THE YEAR OF THE SOCKET. IT RINGS ONCE, FOR SOMEONE.", high: "AT EVERY HOUR THE NOON BELL RINGS ONE STROKE MORE, FOR THE ONE WHO WENT DOWN." },
      lampless: { account: "dark", low: "you lit it\nwe know", mid: "the hush is quiet again\nmostly", high: "we keep a place for you in the dark\nyou will not see it\nthat is the point" },
      flatfolk: { account: "flat", low: "FOLIO. Visitors from your side: 0.", mid: "FOLIO. Streets 31. Your page: 1, margins wide.", high: "FOLIO. Streets 32. The new one runs to Hollowmere, and is very straight, and is you." },
      pressed: { account: "flat", low: "SALTPAGE. Your name, read back: smudged.", mid: "SALTPAGE. The Page: 9 × 9 spans. You: in the margin.", high: "SALTPAGE. You: written in the floor, centre tile, face up." },
      noonVigil: { account: "deep", low: "THE VIGIL KEPT THE NOON WITHOUT YOU.", mid: "THE VIGIL LIGHTS A LAMP AT NOON, AND DOES NOT SAY FOR WHOM.", high: "HERE STANDS THE ONE WHO CAST A SHORT SHADOW AND OWED NOTHING TO THE AFTERNOON." },
    },
  },
};

// The landmark people's words (bible §5; content/world/landmarks.js letters and below): a data file of their own,
// registered with talk.js when it loads (it is imported here because content/index.js is frozen).
export { PEOPLE_WORDS, dialogueIdOf } from "./people-words.js";
