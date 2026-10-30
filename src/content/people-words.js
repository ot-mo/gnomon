// The landmark people's words (C5; bible §5, §11; content/world/landmarks.js `letters` and `below`, C3's people.js):
// what each person C1b placed by a letter says, and the named ones under a landmark. Data, and one builder that
// registers each with talk.js, so whoever places a person (C1b #18, code) only gives the talker its dialogue id.
//
//   PEOPLE_WORDS[who] = { role, greet, who?, topics?: [[label, text]], after?: { [beatId]: greet }, bark? }
//     who          the id in landmarks.js letters/below (`who`), or C3's type id (tamsin, hallen, ottilie, corner,
//                  detailC, flatfolkWanderer, pressedPilgrim), which is the same
//     role         the role conversation (social/builders.js ROLES) whose options follow these words: its shop, its
//                  faction talk; its greeting and its "Who are you?" give way to these. Someone who refuses you (a
//                  Dark band, or out for you) still refuses as the role does.
//     greet        at most two lines (bible §2.1), plain; after: the greeting once that beat is done (the latest wins)
//     who          the answer to "Who are you?"; topics: further questions, each a node with "Back."
//     bark         a creature that doesn't talk (a boss, a guardian): the line logged when it wakes (code: a request)
//   dialogueIdOf(who) → id   the dialogue id a placed person talks under: `who`, except where the parent's people
//                  already hold the id (Maren, Pell, Mira, …: their legacy dialogues are golden), which take "<who>@real"
//
// Every claim about the cosmos belongs to someone (bible §2.1 rule 4). The words count against §15.9's 4,000 for the
// 16 landmarks' registers and their people, Hollowmere's included (tests/checks/story.js holds it).
import { node, bye, talkTo, registerDialogue } from "../talk.js";
import { buildDialogue } from "../social/builders.js";

const PARENT_IDS = new Set(["maren", "pell", "corwin", "ess", "tee", "brann", "mira", "rook", "lio", "shrine", "door"]);
export const dialogueIdOf = (who) => (PARENT_IDS.has(who) ? `${who}@real` : who);

export const PEOPLE_WORDS = {
  // --- Hollowmere (bible §5 A) -------------------------------------------------------------------------------
  maren: { role: "priest", greet: "You touched it. Good. It's been waiting for someone to stop admiring it.",
    who: "Maren, Prioress of the Noon Vigil. I keep the temple, the key to the Keeper's Stair, and the noon.",
    topics: [["What is the Cube?", "The Vigil says it is the last face of the Hours, the one that turns. I say it hums when it's worried, and it's been humming for three nights."]],
    after: { beat1: "An Assize seal, under my floor. Sit. The blessing won't take if you fidget." } },
  hallen: { role: "villager", greet: "Mind the reeds, they're somebody's supper. Noon keep you.",
    who: "Reeve Hallen. I hold the roll, the weir rights and the arguments.",
    topics: [["Your son?", "Tovi went east with the Survey a year ago. He writes when the Survey remembers to post things, which is never."]],
    after: { beat5: "You found Tovi. Flat, they said, and now he isn't. I don't know what to pay for that, so I won't insult you." } },
  mira: { role: "merchant", greet: "Interesting. Don't move, you're in my line.",
    who: "Mira, the Survey's cartographer for this block. I sell Location readings, and I'm usually right.",
    topics: [["Why the Survey?", "The Survey measured the world when nobody asked. Now everyone asks, and we're the only ones with numbers."]] },
  tamsin: { role: "priest", greet: "Turn, hand. Turn, hour. That's a prayer, not a request.",
    who: "Brother Tamsin, of the Horary. I sell where the dial-steles stand, and I buy any Hour reading you bring me.",
    topics: [["The Horary?", "We hold that the hours are meant to turn. The Vigil holds that noon should stay. We are very polite about it in Hollowmere."]] },
  brann: { role: "wanderer", greet: "you can see me\nthen your torch is out",
    who: "brann\ni went down the stair a long time ago\nsome of me came back",
    topics: [["The Hush Stair?", "it crosses the teeth at night\nput your lamp out on the first step\nthe steps are there if you don't look for them"]] },
  ottilie: { role: "merchant", greet: "If it's broken, put it there. If it's yours, say so first.",
    who: "Old Ottilie. I mend things, I fill cells, and I look at artifacts for ten glim a twist of the brain.",
    topics: [["Artifacts?", "Deepwright work, mostly. It does one thing very well and tells nobody what. The examining is what you pay for."]] },
  corwin: { role: "guard", greet: "Weapons down in the temple. Everywhere else, keep them handy.",
    who: "Sir Corwin, warden of Hollowmere. I teach the long blade and I post the bounties on the board.",
    topics: [["Bounties?", "Anything that eats more than its share near the village. The board pays in glim, slowly."]] },
  pell: { role: "merchant", greet: "Buying, selling, sharpening, forgetting. Mostly selling.",
    who: "Pell. I walk a round: Hollowmere two days, Benchmark two, Molar two. If I'm not here I'm owed somewhere else.",
    topics: [["A writ?", "I could forge you an Assize writ. Hundred and fifty glim, and you never met me. That's the expensive part."]] },
  essAndTee: { role: "wanderer", greet: "You're standing on my cousin. No, the other foot. Thank you.",
    who: "Ess, and this is Tee. We're envoys of Folio, which is a town, which is a drawing. We're very official.",
    topics: [["Directions?", "Easy from here. Everything is easy from here. You should try it."]] },
  corner: { role: "villager", greet: "Corner considers you, then the space beside you, and settles for the space." },   // a cat: no questions

  // --- Benchmark (§5 D) --------------------------------------------------------------------------------------
  quintVey: { role: "villager", greet: "Stand where you are. Thank you. You were the only thing in the room not level.",
    who: "Teodor Quint-Vey, Surveyor-General. I measure the noon Hand, and lately it measures back.",
    topics: [["The Hand?", "The Gnomon's noon shadow. It was fifteen and a half spans when I was a boy. I have the figures, and the figures are not happy."]],
    after: { beat2: "A finger's width. I've written it down four times and it stays a finger's width.", beat9: "The Mark stands. So do we, mostly. Thank you." } },
  saaraTovi: { role: "merchant", greet: "Don't touch the theodolite. Touch anything else, I'll charge you for that too.",
    who: "Saara Tovi, instrument-master. I keep the station's eyes clean." },
  benchmarkLeech: { role: "priest", greet: "Sit. Bleed there, not on the plans.",
    who: "The station's leech. I patch surveyors who walk off things while looking through other things." },
  detailC: { role: "merchant", greet: "DETAIL C. CRADLE NUMBER ONE. STATE YOUR GRADE.",
    who: "AN AUTOMATON ON LOAN FROM THE PLAN. THE LOAN HAS NO RETURN DATE. THIS IS NOTED.",
    topics: [["The Datum?", "THE DATUM STONE CAN BE READ FOR THREE HUNDRED GLIM. FOR FRIENDS OF THE PLAN, NO CHARGE. FRIENDSHIP IS MEASURED."]] },
  benchmarkBanker: { role: "merchant", greet: "Twelve glim, or you can watch me light it and go without.",
    who: "House Saffre's banker at the station. Glim kept, glim lent, glim counted twice." },
  benchmarkDrover: { role: "merchant", greet: "Longbacks rest here a day. So can you, for a price.",
    who: "The caravan-master of the Drovers' stop. Roads east, roads west, and the stories between." },
  benchmarkSignaller: { role: "villager", greet: "Quiet. The Hand's moving.",
    who: "The signaller. The Signal Room shows the Hand on the world map, day and night. I watch it so nobody has to panic alone." },
  mapRoomSurveyor: { role: "merchant", greet: "Maps by the span. Tiers on request.",
    who: "The Map Room's surveyor. I sell Location readings, and I'll show you the tier layer if you promise not to go where it's red." },

  // --- The Tall Table (§5 E) ---------------------------------------------------------------------------------
  kreeva: { role: "priest", greet: "You climbed. Most fall. The falling ones we teach first.",
    who: "Kreeva Old-Wing, eldest of the Kites. I teach Tumbling: how to come down without being sorry.",
    topics: [["The perches?", "We carry things up. Shiny things, loud things, your things. From above it's a nest. From the side it's a long way."]] },
  featherTrader: { role: "merchant", greet: "Feathers, freely shed. Not cheaply sold.",
    who: "I trade the cloak the Kites let walkers wear. Wear it and they'll talk to you instead of at you." },
  overlookKite: { role: "merchant", greet: "Look. Everything for six spans. Pay first.",
    who: "The overlook's Kite. I sell the view: every span within six of here, on your world map." },

  // --- Molar (§5 F) ------------------------------------------------------------------------------------------
  saffre: { role: "merchant", greet: "Forty for the toll. The rest depends on your face.",
    who: "Mother Saffre, factor of House Saffre. The toll, the bank and the clear glim are mine.",
    topics: [["Clear glim?", "Burns twice as long and leaves no smoke. Where it comes from is House business."]],
    after: { beat5: "You've been east. Your face says you think you know something. Keep the face, sell the something." } },
  zaqar: { role: "merchant", greet: "Nine longbacks, ten opinions. Mine's the one that counts.",
    who: "Zaqar Tesfu of Nine Longbacks. Market, hire and road. Hire a longback and the road is half again as kind.",
    topics: [["Work as a hand?", "Kindle with me and sell me two readings, and you're a caravan hand. The Assize doesn't count hands."]] },
  castor: { role: "guard", greet: "Stand straight. Straighter. That will do for now.",
    who: "Assizer Castor Dell-Cassin. This checkpoint turns back the Bent and Deepwright contraband. You may be both.",
    topics: [["Why the checkpoint?", "The Hierarch's order. The Rule does not explain itself; that is what makes it a rule."]] },
  rook: { role: "guard", greet: "Board's by the door. The names with prices are the ones that bite.",
    who: "Rook. I hunt the named ones for glim, and I post the ones I can't." },
  molarInnkeeper: { role: "merchant", greet: "Bed, bread and the sound of longbacks. All night. No refunds.",
    who: "I keep the inn in the gullet. Rest here and nobody steals your boots. Twice." },
  molarMapSeller: { role: "merchant", greet: "Readings, east and west. Mostly true.",
    who: "I sell what travellers tell me, written down. The Survey sells it cheaper and later." },

  // --- Folio (§5 G): met only on the map ---------------------------------------------------------------------
  ell: { role: "villager", greet: "A person now, if you please. The court is in session, and so are you.",
    who: "Ell. I was the Flat Queen once, on the Keeper's Stair. I walked out. Now I keep the Margin court.",
    topics: [["The court?", "Contracts here are floors. A forged one has a tile that isn't. Read it aloud and the floor admits it."]] },
  kay: { role: "merchant", greet: "Long line, short temper. What have you read?",
    who: "Kay of the Long Line, archivist. I buy deep readings and sell the Flat Accounts of every Hour.",
    after: { beat4: "Noon's last day is on your page now. Try not to fold it." } },
  doubleEll: { role: "merchant", greet: "Ink, stencils, maps. Both l's are mine.",
    who: "Double-Ell, merchant. Everything here is drawn, so everything here is my trade." },
  marginKeeper: { role: "merchant", greet: "Rooms in the Margin. Wide ones.",
    who: "I keep the Margin. You can rest here, as long as you rest flat." },
  folioSurvey: { role: "priest", greet: "Sit still. You blur when you move.",
    who: "I teach Survey: how to see a place from above when you aren't." },
  folioLore: { role: "priest", greet: "Every Hour wrote itself down. We kept the drafts.",
    who: "I teach Lore, which is reading what people meant from what they carved." },

  // --- Halfnight (§5 H) ----------------------------------------------------------------------------------------
  ilyendra: { role: "priest", greet: "LAMPS STAY LIT. THE HOURS ARE WATCHING. You may sit.",
    who: "Primate Ilyendra of the Horary. I keep the Noon Bell and I teach Lore.",
    topics: [["The Hush?", "Someone lit a lamp in the Lampless chapel during the Snuffing. Half the city says we did. The other half is the Lampless."]] },
  gudri: { role: "villager", greet: "Keep to your side of the Line. If you don't know your side, ask.",
    who: "Linekeeper Hasay Gudri. I keep the Line Court and the peace, in that order.",
    topics: [["The Line?", "Brass, a hand wide, the length of the city. North of it, no lamps. South of it, no dark. Stepping on it is a statement."]] },
  halfnightBanker: { role: "merchant", greet: "Deposits on the south side. Withdrawals in either light.",
    who: "House Saffre's banker in the Middle Ward." },
  horaryTrader: { role: "merchant", greet: "Hour readings, carved and checked. Inscriptions by the line.",
    who: "I sell what the Horary reads in the steles. Deep Inscriptions, mostly. They flatter." },
  lamplessTrader: { role: "merchant", greet: "Put it out first. Then we can talk prices.",
    who: "I sell what the Lampless read in the dark. Dark Glosses. They don't flatter anybody." },
  wisse: { role: "priest", greet: "Put it out. We'll still be here. That's the point.",
    who: "Abbess Wisse of the Lampless. I keep the Hush and teach Shadowcraft.",
    topics: [["The dark-pass?", "It lets a lit stranger into the Shade's heart without a war. I give it to whoever finds who lit the Hush."]],
    after: { beat6: "Back from the Shade. Whatever you carried in, carry it out unlit." } },
  ghostTrader: { role: "merchant", greet: "you can only see me at night\nso the prices are night prices",
    who: "a trader. i was one before\nit kept" },

  // --- The Unlit Choir (§5 J) ----------------------------------------------------------------------------------
  thol: { role: "priest", greet: "we sing\nso you can find the stairs",
    who: "thol. i keep the choir\nthe choir keeps me",
    topics: [["The shaft?", "pour for me\nand the planks will hold from the first floor to the fifth\nthey always did"]] },
  lamplessChanter: { role: "priest", greet: "Hush. The song is load-bearing.",
    who: "A chanter of the Lampless. If we stop, the dark forgets where the stairs are." },

  // --- The Metronome (§5 K) ------------------------------------------------------------------------------------
  sectionNine: { role: "villager", greet: "SECTION NINE. SPEAK ON THE BEAT.",
    who: "CHIEF DRAUGHTSMAN OF THE PLAN. I DRAW WHAT IS TO BE BUILT, AND THEN IT IS.",
    topics: [["The hand?", "THE HAND IS DRAWN TO THE ASSIZE'S SHEET. THE SHEET IS APPROVED. AN APPROVED SHEET CAN BE SHOWN TO BE WRONG ONLY BY A TRUER LEVEL."]],
  },
  draughtsman: { role: "villager", greet: "Revision noted. Please stand outside the drawing.",
    who: "A draughtsman of the Plan. We walk the lines first so the walls know where to go." },

  // --- The Square (§5 M) ---------------------------------------------------------------------------------------
  gateAssizer: { role: "guard", greet: "Plumb, enter. Bent, explain yourself, briefly, at attention.",
    who: "The gate's assizer. The Rule lets the level in and keeps the crooked out." },

  // --- Saltpage (§5 O) -----------------------------------------------------------------------------------------
  bramwyn: { role: "priest", greet: "Lie down a moment. Everything's easier lying down.",
    who: "Father Bramwyn the Flattened. I give the Pressing rite: for a day, once a floor, you may lie as flat as we do.",
    topics: [["The Page?", "The pan is a map of a drowned city. We read it on our faces. It reads us back, which is the holy part."]] },
  inkSeller: { role: "merchant", greet: "Ink by the cup, brine by the barrel. Don't mix them up.",
    who: "I sell ink and brine. The monks use both. So do the floors." },
  pressedLibrarian: { role: "merchant", greet: "Shoes off. The books are underfoot.",
    who: "The Pressed's librarian. Our library is flat readings, laid in the floor, sold by the tile." },

  // --- Foldmother (§5 P) ---------------------------------------------------------------------------------------
  foldmother: { role: "priest", greet: "Little walker. Count your children before dusk. I will.",
    who: "Foldmother. Every tree in the Pleatwood is mine. I close at dusk and open at dawn, and I have never once been late.",
    topics: [["Dusk?", "At eighteen I fold. Whoever is out on a branch comes in with me and is set down under my roots, gently, mostly."]] },
  lumo: { role: "guard", greet: "Off the moss. It's older than your family.",
    who: "Warden Lumo of the Pleatwood. I keep the paths, and the paths keep moving." },
  sporeHerbalist: { role: "merchant", greet: "The Moot of Foldmother greets you. All of it. At once.",
    who: "The Spore Moot's herbalist. Tonics, and fungal limbs for those the Moot likes." },

  // --- Below (the landmark dungeons): the people who talk, and the creatures' barks ------------------------------
  toviHallen: { role: "villager", greet: "You can see me? Flat as a plate, and you can see me. Help me up.",
    who: "Tovi Hallen, Survey engineer, the Reeve's son. I know the stop sequence: three levers, the rune order, never the middle first." },
  noon: { role: "wanderer", greet: "you put the torch out\nso you can see me",
    who: "noon\nthe hour that would not end\nthey pressed me so i could not",
    topics: [["Vesper?", "my shadow\nthey cut her off me\nnow she pulls the dial"], ["The door?", "it opens at noon\nto the plumb key\nor to the cube turned on the threshold"]] },
  strade: { role: "guard", greet: "You came up two floors to see the same room twice. Speak.",
    who: "Aurel Strade-Orrum, Hierarch of the Plumb Assize. I want a straight world. Vesper offered one.",
    topics: [["The Pressyard?", "Pressings are a correction. If you have evidence that they were done for profit, show me, and show me plainly."]] },
  lio: { role: "villager", greet: "Down here. On the floor. In the floor. Turn the wheel.",
    who: "Lio. They pressed me for a song I sang about the Hierarch. Free the cells and I'll sing it again, loud." },
  speakingDoor: { role: "guard", greet: "WHAT IS THE NUMBER WRITTEN UPON MY FLOOR?",
    who: "I AM THE DOOR. I ASK ONCE. I OPEN ONCE." },
  secondHourStele: { role: "priest", greet: "IN THE SECOND HOUR THE NOON WAS CUT FROM ITS SHADOW, AND THE SHADOW WAS NAMED VESPER, AND SENT DOWN.",
    who: "A stele of the Second Hour. Its rune, in the dark, reads otherwise." },
  grubMother: { bark: "The floor hums, and the Grub Mother comes up through it." },
  assizeEngineer: { bark: "\"Flat or out of the way. The Press keeps time, not company.\"" },
  pressMaster: { bark: "\"Marr-Orrum. You've come to see the Press work. Stand on the plate, it's the best view.\"" },
  gloamWarden: { bark: "The Gloam Warden breathes out, and every lamp on the floor leans away." },
  escapement: { bark: "The Escapement lifts its head on the beat. The map shows where it means to put it down." },
  drownedBellwether: { bark: "Under the water a bell tolls once, and everything flat stands up in a hurry." },
  plumbknight: { bark: "\"Halt. You are out of line.\"" },
  vesper: { bark: "you came all this way to stand in my light" },

  // --- C3's people of the roads (bible §12.6) ------------------------------------------------------------------
  flatfolkWanderer: { role: "wanderer", greet: "Lost? I'm not. I'm drawn here. Big difference.",
    who: "A trader of the Plane. I sell what's light enough to carry flat." },
  pressedPilgrim: { role: "priest", greet: "Mind my hand. It's on the mosaic. So is the rest of me.",
    who: "A pilgrim of the Plane. I lie on every mosaic between Saltpage and the sea, and read it with my face." },
};

// A person's words, then their role's options (its shop, its faction): the role's greeting and "Who are you?" give way.
function wordsDialogue(w) {
  const role = buildDialogue(w.role);
  return (game, c, opts = {}) => {
    const base = role(game, c, opts);
    if (base.options.length === 1 && base.options[0].label === "Leave.") return base;   // refused, as the role would
    const done = game.state?.campaign?.done || {};
    const greet = Object.keys(w.after || {}).filter((b) => done[b] !== undefined).map((b) => w.after[b]).pop() || w.greet;
    const back = { label: "Back.", go: () => talkTo(game, c) };
    const own = [...(w.who ? [{ label: "Who are you?", go: () => node(w.who, [back, bye()]) }] : []),
      ...(w.topics || []).map(([label, text]) => ({ label, go: () => node(text, [back, bye()]) }))];
    const rest = base.options.filter((o) => !(w.who && o.label === "Who are you?"));
    return node(greet, [...own, ...rest]);
  };
}

for (const [who, w] of Object.entries(PEOPLE_WORDS))
  if (w.role) registerDialogue(dialogueIdOf(who), who === "corner" ? (game, c) => node(w.greet, [bye()]) : wordsDialogue(w));
