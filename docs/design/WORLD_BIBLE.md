# GNOMON: World Bible (final)

*The world bible for the overworld fork of The Rotation Cube: a browser roguelike in plain ES modules, with no build step,
hosted on GitHub Pages. Every zone keeps both of the parent game's views: the turn-based top-down map and the real-time
first-person 3D view, switched with Tab. A turn-based world map is added on top of them.*

**How this document was made.** It takes the "dense" concept as its base. It grafts in the judges' picks from the "fold"
and "faithful" concepts, and it fixes every must-fix item. The full list is in Appendix 15.10. Where the three drafts
disagreed, this document decides, and the Data appendix (section 15) is the version to build from.

**Conventions.**
- World coordinates are `(x, y)` on the 42 × 21 world map, with `(0, 0)` at the top left (north-west).
- A **span** is one world-map tile, and one span is one surface zone.
- **Tier** is the 1-8 danger band. **Level** is a zone's or a creature's difficulty number, and tier is derived from it
  (section 4.5).
- "Map" means the in-zone top-down view. "3D" means the first-person view. "The world map" is the travel layer.
- "The dark" means the 3D view (or the map) with your torch out.

## 0. At a glance

- **World map.** 42 × 21 spans, the same in every run. One span is one surface zone of 80 × 48 tiles, 16 blocks tall.
  Walking off a zone's edge takes you into the neighbouring span's zone.
- **The 882 spans.**
  - 44 Teeth (mountain) spans can only be walked into from a neighbouring zone.
  - 47 water spans can't be entered at all. The Glass Causeway crosses the sea.
  - The other 791 spans can be entered from the world map.
  - 60 of those are Lattice spans. They drop you into the zone, because the world map can't travel across them.
- **The plan.** 16 fixed landmarks, and an 11-beat main quest that climbs the tier gradient from the safe south-west to
  the Gnomon in the north-east. There are 4 endings.
- **Density.** The map is split into 98 blocks of 3 × 3 spans.
  - 15 blocks hold landmarks, and 1 block is open sea.
  - Each of the other 82 blocks gets exactly one guaranteed procedural site.
  - Every zone also gets 1 to 3 small finds.
- **New every run:**
  - 5 ancient god-kings (**the Hours**), with about 12 events each;
  - 8 Hour sites, 16 villages, 12 lairs, 14 ruins, 14 shrines, 10 vignettes, 6 overlay cores and 2 wanderer camps;
  - legendary creatures;
  - every zone layout and every dungeon interior.
- **Characters.**
  - 2 genotypes: the **Bent** (mutants) and the **Plumb** (the pure line).
  - 12 backgrounds and 6 attributes (STR AGI TOU INT WIL EGO).
  - 20 physical and 12 mental mutations, plus 8 defects. 20 implants.
- **Society.** 21 fixed factions, plus one faction per generated village and one per Hour cult. 6 faiths.
- **Money and survival.** The money is **glim**, which is lamp oil. Your torch burns it. There is no thirst and no hunger.
- **Bonding.** The social bond is **the Kindling**: sharing a way of seeing. It takes three forms, one for the map, one
  for 3D and one for the dark.
- **Text budget for the game.** About 15,000 authored words (section 15.9).

---

## 1. Title, pitch, premise and cosmology

### 1.1 Title

**GNOMON**

A gnomon is the upright part of a sundial: the deep thing whose shadow writes on the flat face. That is the whole game in
one word. There is a deep world, a flat reading of it, and a shadow that joins the two.

### 1.2 Pitch

A thousand years ago a bell-founder's daughter climbed into the works of the world's great sundial and stopped its hour
hand at noon. She paid with her own shadow, which tore off and lies burnt across the land to this day.

Days still dawn and dusk. But the age has stood at noon ever since. Mutants farm glimseed in the brine. Flat people keep
their archives in the floor. Machines pray to blueprints. Two faiths share one street on the edge of the burnt shadow.

Now the noon shadow has begun to lengthen, and in the afternoon, long shadows press things flat.

*Gnomon* is a roguelike drawn in coloured text and played from two points of view.
- **The map** is turn-based and sees the world flat and true.
- **The 3D view** is real-time and sees it deep and deceptive.
- **The dark**, with your torch out, shows what the light drowns out.

You cross a hand-drawn world of sixteen landmarks, the same in every run. Its villages, ruins, cults, buried god-kings
and their relics are made new each time. At the end, under the needle on the horizon, you decide what hour it will be.

### 1.3 Premise

- **The land is called the Dial.** It's laid out like a sundial's face.
- **The Gnomon stands in its north-east corner, at (37, 3).** It's a leaning needle of black truesteel, far taller than
  anything else in the world. From every surface zone you can see it as a thin black line on the north-east horizon.
- **The sun stands over the Gnomon at noon.** The Dial's sun climbs out of the south-east, stands over the Gnomon in the
  north-east at noon, and sets in the north. The Survey says the world leans toward the Gnomon, the way everything here
  does eventually. So the noon shadow points west-south-west, along the Shade towards Hollowmere (section 4.8).
- **The Hand.** The Gnomon's shadow sweeps across the land every day, like the minute hand of a clock. People call it the
  Hand.
- **The noon length is the world's clock.** How long the Hand is at noon is the hour hand of the world's age.
  - Through the five ages of **the Hours** (the god-kings), the noon Hand grew shorter, age by age, towards noon.
  - At the end of the Fifth Hour it reached its shortest. Then it began to lengthen: that was the first afternoon.
- **Noon stopped it.** A girl the histories call **Noon** went into the Gnomon's works with the **Rotation Cube** and
  turned it. The age stopped at its shortest noon.
  - She paid with her shadow. It tore off and was burnt into the land along the noon line, as **the Shade**: a band of
    permanent dusk running from the Gnomon's foot towards the south-west.
  - The Cube fell to earth at Hollowmere, and the Temple of Angles was built around it.
- **The present is the Long Noon, year 1012 LN.**
  - The name belongs to the age. It isn't the time of day: days and nights pass as they always have.
  - It's a bright, crowded, growing world of short shadows.
- **Now the noon Hand is lengthening again.**
  - Something is pulling it: **Vesper**, Noon's torn shadow, which wants the Evening.
  - Long shadows *press*: what they cover goes flat. If the Hand's noon tip ever reaches Hollowmere, where the Cube
    fell, the Afternoon begins for good.

### 1.4 The three readings (how the views fit the cosmology)

Everything in the Dial can be read three ways, and each reading lies about something. This is the in-world reason for
the game's two views and its torch rule.

| Reading | Who has it | What it shows | What it hides | In the game |
|---|---|---|---|---|
| **Flat** (the dial's reading) | the Flatfolk, the sun, maps, and Turners | what is written on the ground: mosaics, floor plans, flat beings, a whole place at once | height, depth, and what is behind or under things | the map view |
| **Deep** (the eye's reading) | every living deep creature | height, distance, ledges, pits, and what stands up | whatever lies flat: flat beings are only shadows, mosaics are faded tiles | the 3D view |
| **Dark** (the dead's reading) | ghosts, the Lampless, anyone with their light out | what light drowns out: runes, ghosts, ghost planks, the world's memory | colour, distance, safety | the 3D view (or the map) with the torch out |

**Who can turn.** This settles a contradiction in the drafts.
- **Everyone reads flat.** Anyone can read a map or a mosaic, the way anyone can read a page.
- **Almost nobody can turn.** Turning means stepping your whole self into the flat reading, so you can act there: walk,
  fight and talk on the Plane.
- **Who turns, and who doesn't:**
  - Deep creatures live in the deep reading and visit the dark by putting their lights out.
  - Flat beings live only in the flat reading. They can't turn either.
  - A **Turner** can. The Rotation Cube made the first one, and in 1012 LN there is exactly one: you.
- **Ordinary people and the Flatfolk** talk the slow way: the Flatfolk write on the floor and deep people read it. A
  Turner just turns and talks. This is why the Survey hires you, the Flatfolk trust you, and the Assize wants the Cube.
- **The Temple of Angles forces the flat reading.** Its keepers built it so the Cube could never be turned by accident,
  so anyone inside its walls sees only flat. That is why the game opens in the map view (section 10.5): you walk the
  temple flat until you touch the Cube, and the Cube makes you a Turner.

### 1.5 The house rules are laws of nature

Every rule of the parent game is a fact about the world. The lore never apologises for a mechanic; it explains it.

| House rule (the existing game) | What the world says about it |
|---|---|
| The map view is turn-based; 3D is real time. | "The Plane counts; the Deep pours." Both are the same time, measured two ways: in counted steps or in poured seconds. |
| The map is flat: it can't tell a floor from a ledge, a pit or a chasm. | The Plane has no height. A ledge and a floor are the same line on a page. |
| Chasms look like floor on the map until you have looked into them in 3D. | The flat reading records only what has been written. Depth is written by the deep eye, so the Plane learns of a chasm only after the eye has looked into it. |
| The map fills in only where your light has fallen. | "Light is the Plane's ink." Unlit places are unwritten. |
| Flat beings exist only on the map; in 3D they are shadows with nobody casting them. | The Flatfolk were pressed wholly into the Plane at the Pressing. The Plane casts its people up into the deep as shadows. |
| Runes, ghosts and ghost planks show only with the torch out. | They belong to the dark reading: undrawn things that lamplight erases. |
| Floor mosaics read clearly only from above. | Mosaics are Plane-script. The Deepwrights wrote for the flat eye. |
| Spike traps keep a beat, which the map shows. | Every Deepwright mechanism ticks to the Count, and the counting eye can read the next tick. |
| Height, jumping and falling matter in 3D. | Height belongs to the deep. The Plane can't see it, so it can't help you with it. A fall is the deep reminding you. |

### 1.6 The layered past (oldest to newest)

| Era | When | What happened | What it left in the present |
|---|---|---|---|
| **I. The Undialled** (the Deepwright age) | before any count | **The Deepwrights** built in depth: stacked cities 20 storeys deep (the Stacks), sealed shelters (the Levels), a dead-straight road (the Old Rule), the Gnomon, and the **Fold**, a machine to press the deep world into the Plane "for safekeeping". Nobody agrees what they were keeping it safe from. | Stacks ruins, the Old Rule, Truing Cradles, truesteel, floor plans, the Gnomon |
| **II. The Pressing** (dawn) | the first day | At the Gnomon's first light its shadow fell like a blade and the Fold ran wild. Seas were pressed into salt (the Salt Waste, the Brine Flats). Cities were pressed into floor mosaics (the Tessellate). Whole peoples were pressed into the Plane (the Flatfolk). Some Deepwrights sealed themselves in the Levels, and their descendants are the Plumb. | salt everywhere, mosaics, flat beings, the Lattice (where the Fold's creases still show), the Bent's creases |
| **III. The Hours** (the morning) | about 1,500 years | Five god-kings ruled one after another while the noon Hand shortened. These are the **First to Fifth Hours**, regenerated every run (section 8). They scavenged Deepwright folds, raised dial-steles, and pressed their enemies into the floors of conquered cities. | Hour sites, relics, Hour cults, dial-steles, renamed places |
| **IV. Noon** (the turning) | 0 LN | Noon was a bell-founder's daughter, never crowned. She took the Rotation Cube from the Fifth Hour's treasury and went into the Gnomon's works. There she stopped the dial at its shortest noon. Her shadow tore off and became the Shade. The Cube fell at Hollowmere. | the Shade, the Temple of Angles, the Rotation Cube, Vesper, the Noon Vigil and the Horary quarrel |
| **V. The Long Noon** (the present) | 0 to 1012 LN | A thousand years of short shadows. The Bent, uplifted animals and folding trees have spread across the Dial. Machines tend the ruins. The Flatfolk keep the archives. The faiths argue about whether Noon was a saviour or a thief. In 924 LN a youngest keeper of the temple took the Cube down the 20-floor **Keeper's Stair** and folded **Vorlath** the lich into a single line (the events of *The Rotation Cube*). | everything you meet; the Keeper's Stair (an optional legacy dungeon, section 5) |

### 1.7 The living present

- **Who lives here:**
  - Bent villages in the brine and on the downs;
  - Drover caravans on the mesas;
  - the Survey's instrument towers;
  - two faiths sharing one street in Halfnight;
  - Flatfolk towns that exist only on the floor;
  - automata keeping the Stacks "to drawing";
  - crab-folk, bird-folk, folding trees and a fungal parliament;
  - the Errata, misprinted doubles who hate their originals.
- **Why now.** For the first time in a thousand years the noon Hand has grown, and the Shade's tip has crept with it. For
  three nights the floor under the Temple of Angles has shaken: something has been digging beneath it.
- **The tone is a burgeoning world, not a dying one.** The present is crowded, funny and alive. The dread lives in the
  *afternoon* that might come.
- **The secret the player uncovers.** The Plumb Assize means to set a new hour hand in the Gnomon and turn the Cube to a
  Seventh Hour. Their Hierarch answers to Vesper. And the purest lamp oil, **clear glim**, is pressed from people
  (beat 5).

### 1.8 Where The Rotation Cube survives

- **Hollowmere, the Temple of Angles and the Cube** are the start, as before. You begin seeing only the map, you touch the
  Cube, and the camera swings down into your eyes.
- **The Keeper's Descent** is the original game's story, now a Hollowmere legend dated 924 LN.
  - Its Deep Inscription is carved in the temple crypt.
  - The **Keeper's Stair**, the original 20 floors with their three guardians, can be opened as an optional legacy
    dungeon. Vorlath lies at the bottom, folded into a line.
- **The original people return as residents:**
  - Maren is the Prioress of the Noon Vigil.
  - Pell is the peddler, and Mira the Survey's cartographer.
  - Sir Corwin is Hollowmere's warden, and Rook keeps a bounty board at Molar.
  - Lio is a pressed prisoner in the Square.
  - Brann is a ghost, and he still wants his skull back.
  - Ess and Tee are Flatfolk envoys.
  - Ell, once the Flat Queen, is now Folio's magistrate: "a person now".
  - The Speaking Door guards the Under-Page.
- **The three guardians become legendary templates** (section 12): the Flat Queen, the Gloom Warden and the Colossus.
  They also stand in their old halls on the Keeper's Stair.

---

## 2. Tone and voice

### 2.1 Rules

1. **Two registers.**
   - *Plain* is for the present: item text, dialogue, the log. It is dry, deadpan and concrete.
   - *Carved* is for the past: gospels, inscriptions and prayers. It is annalistic and grand.
   - Never mix the two in one sentence.
2. **Things have a flat side and a deep side.** About one text in five adds a single clause about how the thing looks
   from above: "From above it is a short line."
3. **Full registers only for landmarks, creatures and relics.** These three get three short lines each:
   - a *Flat line*, shown when you inspect on the map: terse and numbered, like a ledger;
   - a *Deep line*, shown when you look in 3D: about light, weight and height;
   - a *Dark line*, shown with the torch out: lower case, no punctuation but line breaks.

   Everything else gets one description. This keeps the text near 15,000 words.
4. **Every claim about the cosmos belongs to someone.** "The Horary says", "the Survey measured", "the Flatfolk have it
   written". The narrator never explains the Gnomon.
5. **Every proper noun cites something.**
   - Place names come from history events or from what the place does.
   - Relic names come from their Hour. Village names come from their founding.
   - Nothing is named only for flavour.
6. **Measure the world in its own units:**
   - money in **glim**;
   - distance in **spans** (a world tile) and **blocks** (height);
   - time in **world hours** and **days**;
   - dates as "year 1012 of the Long Noon" (1012 LN).
   - No Earth weekdays, no metric units except the block, and no "God" or "okay".
7. **Deadpan dignity for absurd things.** A crab merchant, a fungal parliament and a town that is a drawing are all
   treated as ordinary.
8. **Small doses.**
   - Item text: at most 3 sentences.
   - Greetings: at most 2 lines.
   - A gospel: 1 to 3 sentences.
   - World-map tile lines: 1 sentence.
9. **Descriptions survive change.** Creature text never mentions gear, position or mood, because mutations, pressings and
   overlays change those.
10. **Motifs to return to:** salt, lamplight, short and long shadows, ink, angles, folds, levels, noon, the beat.
11. **Petty reasons for big feelings.** Faction grudges are small, specific and sometimes dated: "for measuring their
    chief without asking", "for barking at the eclipse of 1009".
12. **Death messages** name the plain cause, then add one wry clause.
13. **Banned vocabulary.** Words and names that belong to Caves of Qud are banned (Appendix 15.11), and so are a few
    research-note units. The name generators reject any output that contains one.

### 2.2 Sample lines

| Use | Line |
|---|---|
| Item: copper short sword | "A copper short sword, green at the hilt where a great many hands have sweated on it. From above it is a short line. From the side it is a decision." |
| Item: lantern-flail | "A lamp on a chain, for people who want to bring the light to someone personally." |
| Item: plumb-bob | "A lead drop on a string. It always knows which way is down, and lately it has opinions about north-east." |
| Relic, three registers (the Rimed Ladle) | *Flat:* "LADLE. Salt-glass. 1. Ward: ghosts, 3 lines a day." *Deep:* "A ladle of grey salt-glass, cold in any weather, too heavy for soup." *Dark:* "it remembers the sea / it would like it back" |
| Greeting: Hollowmere villager | "Mind the reeds, they're somebody's supper. Noon keep you." |
| Greeting: Flatfolk (map only) | "You're standing on my cousin. No, the other foot. Thank you." |
| Greeting: Lampless | "Put it out. We'll still be here. That's the point." |
| Greeting: Plumb Assize | "Stand straight. Straighter. That will do for now." |
| Greeting: the Survey | "Interesting. Don't move, you're in my line." |
| Greeting: Errata | "You're the original? Oh. We thought you'd be taller on the left." |
| Proverb (marsh) | "A short shadow tells no lies; a long one tells them slowly." |
| Proverb (generated village template) | "Who salts the [sacred] sweetens the [profane]." |
| Flat Account (plain; a floor mosaic, read on the map) | "In the 41st year of the Fourth Hour, Ishvalet the Glazier sacked Mereford and named it Ishvalet's Clearing. Three hundred glaziers were pressed into its floor. She was nineteen." |
| Deep Inscription (flattering; a carved relief, read in 3D) | "BEHOLD ISHVALET, LENS OF THE MORNING, WHO GAVE MEREFORD THE GIFT OF CLARITY AND LAID ITS PEOPLE DOWN IN GLORY WHERE ALL MAY SEE THEM." |
| Dark Gloss (hostile; a rune cut by the dead, read with the torch out) | "she called it clarity / we were the window" |
| Gospel line from the ancient history (Noon) | "In the last year of the Fifth Hour a bell-founder's daughter read the floor beneath the needle and learned that the afternoon was coming." |
| Tomb inscription | "HERE STOOD OSSI REEDCUTTER, WHO CAST A SHORT SHADOW AND OWED NOTHING TO THE AFTERNOON." |
| Village rumour | "The Clatter say the Mere tasted sweet at the last noon. The Clatter also say a span is a kind of fish." |
| Horary prayer | "Turn, hand. Turn, hour. Let the shadow find the weary." |
| Quest offer (Reeve Hallen) | "Something is eating the glimseed from underneath. I'd go myself, but I'm the Reeve, and the Reeve stays where the shouting can find her." |
| Shop line (Chandler) | "Twelve glim, or you can watch me light it and go without." |
| Sign in the Hour-house | LAMPS STAY LIT. THE HOURS ARE WATCHING. |
| World-map tile | "Brine Flats. The glimseed leans towards the Gnomon here, the way everything does eventually." |
| Mutation: Flatwise | "You can lie down so completely that you stop having a side." |
| Procedural book excerpt (illegible framing) | "...the eleventh step was not there when we came down, which the Survey says is impossible and the step says nothing at all..." |
| Death message | "Pressed flat by the Press at the Pressyard. You are now very easy to read." |
| Death message | "Killed by a saltrat, on your own doorstep, in broad noon." |
| Death message | "Smoothed out by the Plane. It was only trying to tidy you." |

### 2.3 Naming phonology per culture

Name generators pick one onset, zero or one middle and one final, unless a pattern says otherwise. They reject results
longer than 9 letters and any name that contains a banned word (Appendix 15.11).

| Culture | Feel | Onsets | Middles | Finals | Pattern and examples | Place names |
|---|---|---|---|---|---|---|
| **Marshfolk** (Hollowmere, the Flats, the Downs) | soft, wet, doubled vowels | ma re pe il to sa ha ke os ve an bra mi ti ro lu | ren l ka vi ri ss me tt ar aa | n a e i o ke wyn l s mo | Two syllables: Maren, Pell, Ilka, Tovi, Saara, Hallen, Osse, Bramwyn, Lumo. Surnames are trades: Reedcutter, Eelwife | [Brine Salt Reed Grey Glim Eel Hollow Sough Ness] + [mere wick carr staithe holm fleet ney ings]: Brinewick, Saltcarr, Reedholm, Greystaithe |
| **Drovers** (the Steps, the Waste) | dry, clipped, doubled consonants | za qa te de gu az en se mu ro be hu da tu ye | q z ff kk d r s bb | u at ek ar ri fu ay e | CV-CVC: Zaqar, Tesfu, Debbek, Qamu, Azzu, Ennat, Gudri, Hasay. Big names add their herd: "Zaqar of Nine Longbacks" | camps are "[Name]'s Wheel", wells "[Name]'s Sip" |
| **Plumb** (the Levels) | Latinate, crisp, ranked | cas quin aur ost sev ver mar dex cor del ys tal teo | el an ri o ra i | or ex us ant ine ade is ond el | Given name + family + Level: Aurel Strade-Orrum, Ysolde Quint-Vey, Castor Dell-Cassin, Teodor Quint-Vey | "Deck Nine of Orrum" |
| **The Hours** (ancient) | long, vowel-rich, sonorous | a i o u sha ka ve zha sa ni ob ke ru | ma ru yen dra uv ha ret lit rai ten sva mel | t l th n on a ra et ul | 3 to 4 syllables: Ishvalet, Ammaruth, Oruvhal, Kessaret, Ummelith, Sabraiyon, Veshtenna, Zhaduel. Cognomens: "the Glazier", "Who Wept Salt", "Lens of the Morning" | "[Name]'s Mercy / Clearing / Rest / Gate"; "the [ruin adjective] Field of [place]" |
| **Flatfolk** | buzzy letters | spelled letter names: Ess Tee Kay Vee Zed Emm Aitch Wye Ell Arr Eff Jay Cue Ex Dee Bee Pee Oh | — | — | One letter; elders add a line: "Kay of the Long Line", "Double-Ell", "Ess Underlined" | page words: Folio, Margin, Gutter, Recto, Verso, Quire, Colophon, Index, Gloss |
| **Lampless and the Unlit** | whispered, sibilant | wi hu i ve tho sa ul ne sh o | ss l sh th v h | e sh th l en a | Wisse, Hulven, Ishe, Thol, Sesh, Ovhe, Nelle. Ghosts keep their living names, written in lower case | "the Hush", "the Quiet", "[Name]'s Dark" |
| **The Plan** (machines) | drawing titles | Section Elevation Detail Revision Datum Hatch Grid Sheet Scale | — | number words | "Section Nine", "Elevation East", "Detail C", "Revision Seven" | "Grid 14", "Sheet Nine" |
| **Pleatwood and the Spore Moot** | slow descriptions | verb phrases | — | — | Trees: Leans-at-Dusk, Seven-Folds, Opens-Twice, Holds-the-Rain. The fungi speak as "the Moot of [place]" | "[tree name]'s Ring" |
| **Rustbacks** | harsh nicknames | gra mog du ri kek harr ib sk | — | dut ib ak | 1 to 2 syllables plus a scrap word: Grak, Mogdut, Harrib, Two-Nail, Kettle-Ear | "[nickname]'s Heap" |
| **Kites and the Clatter** | sounds | Kites: kee rii aa wi; Clatter: tk kr ch tt | — | — | Kites: Kreeva, Aawik. Clatter: Tkrr, Chitt-Ashell | aeries and middens |
| **Errata** | an original's name, mirrored | take an existing name | reverse its letters | add "-e" if the result can't be said | Marren → Nerram; Zaqar → Raqaz; "Ess" → "Sse" | "[place] Reversed", "the Left Side of [place]" |

---

## 3. Currency, the Kindling, readings, reputation, and light instead of thirst

### 3.1 Glim (the money)

**Glim** is lamp oil, and it's the money of the Dial. One glim is a thimble of it.

**Why oil.**
- Deep places are dark, and the dark holds the dead, the shades and the runes. Light is safety.
- The best of everything (Deepwright ruins, Hour sites) lies underground.
- So everyone needs oil, and oil became money.

**Where it comes from:**
- pressed from **glimseed**, the oily reed of the Brine Flats;
- rendered from beast tallow;
- drained from Deepwright cells (100 charge = 1 glim).

The purest kind, **clear glim**, is pressed from something nobody asks about. The main quest asks (beat 5).

**Carrying it.**
- Glim lives in your **lamp-flask**. The flask's capacity is your purse: 200 glim at the start, and larger flasks hold
  500 or 1,000.
- A payment that would overflow your flask is refused. The trader says so and offers goods instead.
- The **Chandler Houses** bank any surplus at Molar, Halfnight and Benchmark, for a 5% fee on each deposit.

**Price anchors** (base values):

| Item | Glim | Item | Glim |
|---|---|---|---|
| throwing knife | 8 | a night at an inn (full heal) | 10 |
| bomb | 20 | homing pip | 300 |
| balm tonic | 25 | implant | 400 to 2,000 |
| copper short sword | 40 | fitting at a Truing Cradle | 25 × the implant's cost |
| iron longsword | 120 | clear glim (Chandler banks only) | 5 per unit |
| 500-glim flask | 150 | 1,000-glim flask | 450 |

**Buying and selling.**
- **Buying** costs value × (1.5 − 0.1 × EGO modifier − the reputation step).
- **Selling** pays value × (0.3 + 0.05 × EGO modifier + half the reputation step).
- The **reputation step** depends on your standing with the trader's faction: +0.1 when Warm (≥ +250), +0.2 when Bright
  (≥ +600), and −0.1 when Cold (≤ −250).

**Sources:**
- glim piles in ruins and dungeons (section 3.2 gives the amounts);
- quest rewards (25 × tier);
- selling;
- each village's **commons lamp**: take 5 glim a day without giving offence. More costs 25 village reputation per 5;
- draining cells.

**Sinks:** shops, services, tolls, shrine offerings, bribes, the Kindling, glimguns (1 glim per shot), and the torch.

### 3.2 Light instead of thirst

**Thirst: no.**
- Fresh water exists as a liquid. It heals a little and washes off stains.
- There is no thirst clock and no hunger.
- The one survival resource is light, because light touches the house rules.

**The torch.**
- **Cost.** The torch burns **1 glim per 4 world hours lit** in darkness: underground, inside the Shade, and on the
  surface at night. It's free in daylight, and that includes daylight under the Hand.
- **Clock.** A world hour is 60 s of game time in either view (section 4.6). So a typical dungeon floor of 8 to 12
  minutes costs 2 to 3 glim, and a night lit on the surface costs 3.
- **On the world map,** the lamp burns at the same rate while you travel by night with it lit.
- **Loot balances the drain.** Each dungeon floor holds glim piles worth **10 + 4 × the floor's tier** in total (14 on a
  tier 1 floor, 42 on a tier 8 floor). Monsters drop 1 to 3 glim 20% of the time, and elites drop 3 × tier. The lamp
  eats about an eighth of what a floor gives early on, and about a twentieth late.
- **An empty purse doesn't kill you.** The torch gutters to a 1-tile flicker until you get more glim. The flicker still
  lights braziers and still writes the 1-tile ring around you onto the map.
- **The trade-off is real but mild.** Dousing the torch saves money and reveals runes, ghosts and ghost planks. But shades
  and wraiths love you for it.
- **Ways out.** The *glim heart* implant makes your light free. The *Lampskin* mutation and the *Lamplighter of Cassin*
  background make it free or half price.

### 3.3 The Kindling (sharing a way of seeing)

**The fiction.** There are three ways of seeing, and to kindle with someone is to share one with them:
- a line drawn between you on the floor;
- a flame passed face to face;
- or the dark, sat in together.

Two people who have kindled are **flame-kin**, whichever rite they used.

**Who can be kindled.** Only **named** creatures: legendaries, unique NPCs and village leaders. The creature must not be
hostile, and your reputation with its faction must be above −250.

**The three rites.** Every faction has a **reading**: flat, deep or dark (section 15.4). Its rite is the one done in that
reading.

| Rite | Reading | How it's done | Cost | The words |
|---|---|---|---|---|
| **The Tracing** | flat | In the **map view**, stand next to them and draw a line from your tile to theirs. | 1 ink, or 1 glim used as ink | "Here is my line." / "Here it meets mine." |
| **The Lighting** | deep | In **3D** with your torch lit, within 2 tiles and facing them: pour 1 glim into their lamp and light it from yours. | 1 glim | "My light on your wick. See by it." / "Your wick in my light. I see." |
| **The Snuffing** | dark | **Both lights out.** Sit with them in the dark for one world hour (a wait). | the hour | none; silence is the point |

**Faction variants.** The numbers are the same; the verbs differ.
- **The Pouring** (the Unlit; dark): pour 1 unit of any liquid at the ghost's feet with your torch out. Your torch has to
  be out anyway, or you couldn't see a ghost.
- **The Oiling** (the Plan; deep or flat): pour 5 glim into the automaton's reservoir in 3D, or present a full floor
  plan to it on the map.
- **The Ascent** (the Kites; deep): the Lighting, done standing 8 or more blocks above the zone's ground.
- **The Mirroring** (the Errata; deep, then flat): the Lighting in 3D, then the Tracing on the map, in that order.
- **The Askew** cannot be kindled. They *re-angle* you instead (section 6).
- A creature with the *Crooked Manner* defect makes a rude gesture instead of speaking the words, and gets a different
  answer.

**The one-time bond.** It applies to every faction that has an opinion of this individual. Each named creature has a
generated list of factions that love, like, dislike or hate it, each with a petty reason.

| That faction's opinion of the creature | Reputation change |
|---|---|
| loves | +80 |
| likes | +40 |
| dislikes | −40 |
| hates | −80 |
| *bonus:* the rite was done in the creature's own reading | +40 with the creature's own faction |
| *bonus:* you poured the faction's sacrament (1 unit of its liquid) during the rite | +20 with the creature's own faction |

**After the bond, your reputation with the creature's own faction becomes currency:**

| Option | Reputation |
|---|---|
| Give a reading it wants (it must be of a kind and topic the faction buys) | +35 |
| Give a rumour it wants | +60 |
| Ask for one of its readings | −40 |
| Learn a power it teaches (requirements waived) | −50 (rank 1), −100 (rank 2), −150 (rank 3) |
| Learn the village dish | −40 |
| Recruit it as a follower | −(150 + 15 × (its level − yours)), minimum −60. You can keep at most 2 Kindled followers, 3 at EGO 20+ |
| Buy its best item (merchant factions only) | −(value / 5), minimum −10 |
| Faction specials | the Spore Moot: a fungal limb for −30 (+200 Spore Moot, −100 Pleatwood). The Pressed: the Pressing rite for −100. The Lampless: the *Snuff* mutation for −200 (Bent only) |

**Limits and penalties.**
- **EGO** adds +10% per modifier point to every reputation *gain* from the Kindling.
- **Cap:** after the bond, you can earn at most +120 net reputation from any one creature.
- **Later Kindlings:** Parley's *Warm Hands* power adds +20 to each later Kindling with the same creature, within
  the cap.
- **Oathbreaking:** killing a flame-kin on purpose costs **−120 with every faction**, and gives you the **Snuffer** mark.
  Accidental deaths (falls, splash, your followers) don't count. The mark means:
  - the Lantern Moths drop to −600;
  - your torch radius is −1 for the rest of the run, because lamps gutter when you pass;
  - for 7 world days you cast **no shadow in 3D**. Villagers notice: prices are +20%, and nobody will kindle with you.

### 3.4 Readings (knowledge as loot)

Every fact you collect is a **reading**. It's filed in the journal, and each one can be sold once; you keep it after
selling. There are three kinds, one for each way of seeing, and factions trade by kind.

| Kind | What it is | Where you get it |
|---|---|---|
| **Flat readings** | mosaics, floor plans, Flatfolk archives, Flat Accounts | read on the map |
| **Deep readings** | heights, carvings, what's inside, Deep Inscriptions | read in 3D, in light |
| **Dark readings** | runes, ghosts' testimony, Dark Glosses | read with your torch out |

- **Topics:** Locations, Hours (history), Villages, Rumours, Recipes. Each faction's entry in section 6 says which kinds
  and topics it buys and sells.
- **Location readings** pin the world map and open a *Visit* quest at once.
- **History accounts are readings too.** Each event of an Hour exists as up to three accounts (section 8.5), and each
  account is a separate reading. Factions value different ones:
  - the Flatfolk and the Survey buy Flat Accounts;
  - the Horary and the Hour cults buy Deep Inscriptions;
  - the Unlit and the Lampless buy Dark Glosses;
  - the Unlit also *pay double* for Deep Inscriptions. They like to know which lies were carved about them.
- **The journal** sorts each Hour's events by date. It shows "7 of 13 events, 15 of 39 accounts", and it flags any event
  whose accounts disagree.

### 3.5 Reputation

**Scale:** −1000 to +1000. The bands use light words.

| Band | Reputation | Behaviour |
|---|---|---|
| **Dark** | ≤ −600 | Hostile, even docile members. |
| **Cold** | −599 to −250 | Neutral and aggressive members are hostile; docile ones keep away. |
| **Grey** | −249 to +249 | Only aggressive members are hostile. Neutral members turn hostile if you trespass in their holy places. |
| **Warm** | +250 to +599 | Friendly: they defend you, welcome you in holy places, and give the shop discount. |
| **Bright** | ≥ +600 | Kin: you are treated as one of their own, with unique dialogue and the best stock. |

**What changes it:**

| Source | Size |
|---|---|
| Kindling bond | ±40 / ±80, plus the bonuses above |
| Reading or rumour (in the Kindling menu) | +35 / +60; asking for a reading is −40 |
| Generated village quest | +100 with the village, +25 with each faction that likes the village |
| Killing a member | −5 for a common member, −50 for a named one, with its faction. Factions that hate it gain half that |
| Killing a legendary | ±100 to ±200 with every faction that has an opinion of it |
| Donations | Noon Vigil: +10 per 50 glim (up to +200). The Plan: +25 per full floor plan. Horary: +25 per Hour reading shared. Lampless: +1 per 2 glim poured out at a Hush (up to +150) |
| Wearables | feather cloak: +250 Kites. Hour mask: +200 with that Hour's favoured factions, −200 with its hated ones. Assize writ: +100 Assize, −100 Bent villages. Ink stains: +50 Flatfolk |
| Body | mutations and implants (sections 10.4 and 13) |
| Desecration | −100 to −150 |
| Main-quest choices | ±50 to ±600 |
| Oathbreaking | −120 with every faction |

**Mode.** In *Pilgrim* mode (section 10.1), every faction except the Askew and the Hour cults starts at 0 or higher.
The Smoothers (section 10.3) belong to no faction and are always hostile.

---

## 4. The world map

### 4.1 Dimensions and scale

- **Size.** 42 × 21 spans. Coordinates are (x, y), with (0, 0) at the top left (north-west) and (41, 20) at the bottom
  right.
- **Zones.**
  - One span is one surface zone of 80 × 48 tiles and 16 blocks tall.
  - A zone is generated the first time you enter it, from `hash(runSeed, x, y)` plus the world-coordinate noise
    (section 4.11). After that it's kept as seed plus changes.
  - Walking straight across a zone takes about 40 s in 3D.
  - Walking off an edge enters the neighbouring span's zone at the matching point of the shared edge.
- **The world-map layer.**
  - Press **U** in any surface zone with no hostile within 12 tiles to rise to the world map.
  - **WASD**, the arrow keys or the numpad move one span, in 8 directions. A diagonal may not cut between two impassable
    spans.
  - **Enter** goes down into the span: at the edge you came in from, or at any site you know in that span.
  - **F** toggles your lamp here too.
  - **Z** waits until a chosen hour (section 4.6). **T** shows the tier tint.
  - The world map is unavailable underground and while you are Lost.
- **Dungeons.** Dungeons under sites use the existing 48 × 48 × 10 floor generator. Each is given a descriptor:
  `{ floors, floorLevels[], theme, light, bias: { chasmHalls, spikeRooms, mosaicHalls, darkFloors, flatPop },
  population, bossVault }`. Every dungeon in this bible lists explicit levels for its floors (sections 5 and 8).

### 4.2 The map

Each character is one span. The two rulers along the top give x (tens over units), and the numbers on the left give y.
Upper-case letters are the fixed landmarks. Halfnight is three spans long (HHH).

```
    000000000011111111112222222222333333333344
    012345678901234567890123456789012345678901
 0  ......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********
 1  ......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********
 2  ......&&&&&&&&&&&&&^^^&&&&&M&&&&&*********
 3  ......&&&&&&&&&&&&&^^^&&&&&:&&&&&&***N****
 4  ..O..&&&&&&&P&&&&&&^^^&&&&&:&&&&&&%%%%****
 5  .....&&&&&&&&&&&&&"^^^&&&&&:&&&&%%%%******
 6  .....&&&&&&&&&&&&&"^^^+++++:++%J%%##******
 7  ....====&&&&&&&&&&"^^^+I+++:%%%%#####*****
 8  ....========;;;;;""^^^+++++:%%######:*****
 9  ..======E===;;;;;"::F::++%%:%"+#####:#####
10  ..==========;;;;;":^^^:%%%%:+"+#####:#####
11  ..=========;;;;;"":^^^::HHH::::::::::#####
12  ..========:D:::::::^^^+++++++"+:####:#####
13  ..=======::;;;;"";;^^^+++++++~~:~~##:K####
14  ..====C=::=;##;";;;^^^++++++~~~:~~~#######
15  ..,,,B,::,,;;;"";;;;^^++G++~~~~:~~~~######
16  ..,,,A::,,,;;;";;;;;^^+++++~~~~L~~~~######
17  ..,,,,,,,,,;;"";;;;;;;+++++~~~~~~~~#######
18  ...,~~~,,,,;;";;;;;;;;++++++~~~~~~########
19  ...,,,,,,,,;;";;;;;;;;+++++++~~~~#########
20  ...,,,,,,,,;;";;;;;;;;+++++++++###########
```

**Legend**

| Glyph | Terrain | Glyph | Terrain |
|---|---|---|---|
| `,` | Brine Flats | `#` | the Stacks (Deepwright ruins) |
| `.` | Salt Waste | `%` | the Shade (Noon's burnt shadow) |
| `=` | Rust Steps (mesas) | `*` | the Lattice (walk-in only) |
| `;` | the Downs | `^` | the Teeth (mountains, walk-in only) |
| `&` | Pleatwood (x ≤ 18, west of the Teeth) / the Deep Pleat (x ≥ 21, east of them) | `~` | water: the Glass Sea and the Hollow Mere (impassable) |
| `+` | the Tessellate (mosaic plain) | `"` | river: the Slake and the Inkrun |
| `:` | road: the Old Rule, the Straight Cut, the Glass Causeway (bridges where they cross a river, a causeway over the sea) | `A`–`P` | fixed landmarks (section 4.3) |

**Terrain counts** (checked by script): Pleatwood and Deep Pleat 166 (101 west, 65 east), Stacks
109, Tessellate 78, Salt Waste 73, Rust Steps 61, Lattice 60, road 52, water 47, Downs 85, Teeth 44, Brine Flats 42,
Shade 24, river 23, landmark spans 18 (Halfnight is 3). The total is 882.

### 4.3 Landmark index

Each coordinate below was checked against its letter on the map by script (Appendix 15.1).

| | Landmark | (x, y) | Kind | Tier | Surface level |
|---|---|---|---|---|---|
| A | Hollowmere | (5, 16) | start village; the Temple of Angles; the Keeper's Stair (optional, 20 floors) | 1 | 2 |
| B | The Dial Floor | (5, 15) | stele of three accounts; the guaranteed history hook | 1 | 2 |
| C | Kettle Mesa | (6, 14) | first dungeon, 3 floors, loops home | 1 | 2 |
| D | Benchmark | (11, 12) | the Survey's hub; the Datum, 4 floors | 2 | 5 |
| E | The Tall Table | (8, 9) | sky mesa and Kite aerie (a climb in 3D) | 2 | 5 |
| F | Molar | (20, 9) | pass town in the Teeth; the Root Canals, 2 floors | 3 | 8 |
| G | Folio | (24, 15) | Flatfolk town (exists only on the map) | 4 | 11 |
| H | Halfnight | (24, 11), (25, 11), (26, 11) | holy city, three spans long | 4 | 11 |
| I | The Pressyard | (23, 7) | pressed village; the Press, 5 floors | 4 | 11 |
| J | The Unlit Choir | (31, 6) | Lampless cathedral, 6 dark floors | 6 | 17 |
| K | The Metronome | (37, 13) | machine foundry, 6 floors on one beat | 6 | 17 |
| L | The Drowned Lantern | (31, 16) | lighthouse in the Glass Sea, 5 floors (optional) | 7 | 20 |
| M | The Square | (27, 2) | the Assize's citadel, 5 floors (2 up, 3 down) | 6 | 17 |
| N | The Gnomon | (37, 3) | the needle; the Dial-works, 8 floors *down* | 8 | 23 |
| O | Saltpage | (2, 4) | monastery of the Pressed; the Under-Page, 3 floors (optional) | 3 | 8 |
| P | Foldmother | (12, 4) | folding tree-village; the Rootfold, 3 floors (optional) | 3 | 8 |

### 4.4 Terrain types

**Columns.** *Hours* is the base time to cross one span on the world map. A road span takes 3 hours whatever terrain
lies under it. *Lost* is the chance per world-map move of getting lost. *Tier* is the range on the tier grid (section 4.5).

| Glyph | Terrain | Feel | Hours | Tier | Ground palette (RGB) | Signature features | Signature creatures | Lost |
|---|---|---|---|---|---|---|---|---|
| `,` | **Brine Flats** | Wet salt crust, glimseed reeds, brine pools that glow at night, villages on stilts. The safest country in the world. | 6 | 1-2 | crust 214,208,190 · reed 104,128,84 · brine 70,112,124 | glimseed beds, eel weirs, commons lamps, the Hollow Mere | saltrat, brine-grub, glowfin, clatterer, flatling, lantern moths | 5% |
| `.` | **Salt Waste** | Blinding white dunes of a pressed sea. Nothing is taller than you; there are mirages; and at noon the glare blinds the deep eye. | 14 | 1-3 | 236,234,226 · 214,206,190 · 182,174,162 | salt pans that are mosaics, Drover wells, the Page (Saltpage) | chaff devil, brinehog, salt mirage, longbacks, Drover caravans | 15% |
| `=` | **Rust Steps** | Red mesas stacked like stairs: ledges and sheer drops. Height is everything here. | 8 | 1-2 | 168,84,52 · 204,124,76 · 118,60,44 | mesas up to 12 blocks, canyon floors, Rustback heaps on the ledges | Rustback scav and slinger, ledgehorn, kite, ledge spider | 8% |
| `;` | **Downs** | Rolling grass and barrow mounds under open sky. The gentlest walking. | 6 | 2-3 | 128,152,88 · 162,172,104 · 108,118,78 | barrows (small crypts), cairns, Survey towers, turf villages | cairn hound, brinehog, barrow skeleton, Assize outrider, dusk bat | 4% |
| `&` (x ≤ 18) | **Pleatwood** | Trees that fold their branches like fans, platforms in the canopy, and a green dimness. | 12 | 2-4 | 52,96,64 · 86,130,74 · 38,58,44 | folding bridges (open by day), fungal groves, canopy villages 6-10 blocks up | creasebeetle, pleat spider, hangvine, sporeling, foldmonkey | 12% |
| `&` (x ≥ 21) | **the Deep Pleat** | The same forest, older, darker and stranger. | 14 | 4-6 | the Pleatwood palette, 20% darker | the Square's clearing, moot-walkers, paper-wasp nests | paper wasps, moot-walker, creasebeetle | 14% |
| `+` | **the Tessellate** | A dead-flat plain paved with the mosaics of pressed towns. There are Flatfolk everywhere, and in 3D they are shadows. | 4 | 4-5 | base 190,172,142 · tiles 196,64,52 / 60,92,172 / 222,190,82 | floor mosaics (readable only on the map), Flatfolk page-towns, pressed caravans | tile mimic, Flatfolk wanderers, press-hound, mosaic golem, pressed pilgrims | 0% (the land is a map, and your flat reading always knows where you are) |
| `#` | **the Stacks** | Deepwright cities twenty storeys deep: girders, shafts and automata. | 10 | 5-7 (the Old Cuts at (12..13, 14): 2) | 120,120,132 · 90,92,102 · 152,142,122 | shafts, intact floor plans, Truing Cradles, sentry lenses, Toppled Stacks (section 4.10) | draughtsman, lens sentry, beat-spider, girder golem, Rustback brute, rust ooze | 10% |
| `%` | **the Shade** | Noon's burnt shadow: dusk even at noon, runes on every stone, ghosts. | 12 | 5-8 | 40,36,56 · 24,22,34 · 72,62,92 | rune circles, ghost planks, Hushes, umbra pools | shade, wraith, longshadow, umbral eel, Lampless chanters | 20% |
| `*` | **the Lattice** | A crystal grid where the Pressing's creases still show: right angles that aren't. | walk-in only | 7-8 | 182,222,232 · 122,162,202 · 232,242,250 | creases that move you, grid crossings, the Last Mile to the Gnomon | Askew angle, fold, lattice troll, planar queen | can't be crossed on the world map |
| `^` | **the Teeth** | A north-south wall of tooth-shaped crags. | walk-in only | 4-5 | 112,102,98 · 142,132,122 · snow 204,204,210 | crag villages, eyries, the Molar pass, the Hush Stair (section 4.7) | kite, ledgehorn, barrow-troll | can't be entered from the world map |
| `~` | **the Glass Sea** / **the Hollow Mere** | Half liquid, half glass crust / a shallow brine lagoon. | impassable | 5-7 / 2 | glass 96,152,160 · 152,202,206; mere 70,112,124 | wrecks under the glass; shore zones with walkable crust | glass crab, mirror eel, slag salamander (in shore zones) | — |
| `"` | **River** (the Slake, the Inkrun) | The grey-green Slake; the black, inky Inkrun. | 12 (fording) | 2-5 | Slake 82,132,150 · Inkrun 22,22,32 | fords, weirs, ink pools that stain whoever wades through | glowfin, sporeling, umbral eel (Inkrun) | 6% |
| `:` | **Road** | The Deepwright Old Rule, the Assize's Straight Cut, the Glass Causeway. | 3 | as the land (1-6) | 172,162,142 | milestones (Survey benchmarks), toll posts, bridges | Drovers, Assize outriders, pilgrims | 0% |

### 4.5 Tier gradient and levels

**The grid.** Tier 1 is the safe south-west corner, and tiers rise outward to 8 at the Gnomon.
- The formula is tier = 1 + floor(distance from Hollowmere (5, 16) / 5.6). Add +1 in the Shade, the Lattice, the Teeth
  and on water, then clamp to 1-8.
- Fixed landmarks override the formula (section 4.3).
- The grid below matches the formula on every span (checked by script).
- The world map can show it as a tint (key **T**).

```
    000000000011111111112222222222333333333344
    012345678901234567890123456789012345678901
 0  333333333334444444455555555566666778888888
 1  333333333333344444455455555556666777888888
 2  333333333333333444455545555655666777888888
 3  333333333333333344455544555555666677888888
 4  333333333333333334455544555555566677788888
 5  333222223333333333455544455555567777788888
 6  222222222223333333355544445555667766778888
 7  222222222222333333345544445566666666678888
 8  222222222222233333345544445566556666678888
 9  222222222222223333333444455565555666667777
10  222222222222222333344545555555555666666777
11  222111112222222233344444444555555666666777
12  221111111222222233344444444455555666666777
13  211111111122222233344444444456656766666777
14  111111111112222223344444444466656776666777
15  111111111112222223334444444566656777666777
16  111111111112222223334444444566676777666777
17  111111111112222223333344444566666776666777
18  111122211112222223333344444466666766666777
19  211111111122222233333344444456666666666777
20  221111111222222233333344444455555666666777
```

**Levels.** Tier is only a label. The number that drives everything (creature stats, loot, prices) is the **level**.

| Rule | Value |
|---|---|
| A surface zone's level | 3 × tier − 1 (tier 1: 2, tier 2: 5, tier 3: 8, tier 4: 11, tier 5: 14, tier 6: 17, tier 7: 20, tier 8: 23) |
| A dungeon floor's level | listed explicitly per dungeon (sections 5 and 8); the general rule for generated sites is the surface level + (floor − 1) |
| The tier of a level | ceil((level + 1) / 3), capped at 8. Levels 1-2: tier 1 · 3-5: 2 · 6-8: 3 · 9-11: 4 · 12-14: 5 · 15-17: 6 · 18-20: 7 · 21+: 8 |
| Your tier | the tier of your character level, by the same rule |
| Creature level | the zone's level, ±2 by species (each bestiary entry lists its tier) |
| Loot tier | the zone's tier; treasure (vaults, climbs, islands) rolls one tier higher 25% of the time |

**The warning.** Moving onto a span 2 or more tiers above yours asks for confirmation: "The Shade is tier 6. You are
tier 2. Go anyway?"

### 4.6 The clock, day and night, and waiting

- **One clock.** One world hour is **60 s of game time**. Game time is the same seconds in both views, so a map action
  costs the seconds it would take in 3D, exactly as now. A day is 24 world hours, which is 24 minutes of play.
- **The day:**
  - dawn 05:00-06:00;
  - day 06:00-18:00 (the sun is up and the Hand lies on the land);
  - dusk 18:00-19:00;
  - night 19:00-05:00.
- **The calendar.** A year of the Long Noon has twelve months of 30 days, followed by 5 **Still Days**. On the Still Days
  the Survey measures the noon Hand, and nobody may light a new lamp.
  - The months are Dawnhand, Firstlight, Longmorning, Highmorning, Shortshadow, Noonmonth, Stillnoon, Leaning, Longday,
    Lamplight, Duskwell and Shutter.
  - A run starts on 1 Dawnhand, 1012 LN.
- **Waiting (Z).** In a zone or on the world map, **Z** waits until you choose to stop: dawn, noon (11:00), dusk,
  midnight, until healed, or for a number of hours.
  - It works when no hostile within 12 tiles has a path to you.
  - Your lamp is snuffed automatically while you wait unless you choose otherwise, so waiting costs no glim.
  - It is instant in real time: the engine skips game time.
- **Every time gate can be reached by waiting.** This covers:
  - the noon-only gates: the Gnomon's door, the Noonglass dais, noon-posts and the Noon Stand;
  - the dusk and dawn of Foldmother;
  - the night-only things: the Hush Stair, the ghost market, barrow skeletons;
  - the Drowned Lantern's dry hours;
  - pilgrimages timed by the Hand.

  Nothing in the game asks you to idle for real minutes.

### 4.7 Rivers, roads, crossings and impassable features

**Rivers.**
- **The Slake** springs from under the Teeth at (18, 5). It runs south by (18, 6..8), (17, 8..11), (16, 11), (16..15,
  13), (15, 14), (15..14, 15), (14, 16), (14..13, 17) and (13, 18..19) to the map's south edge at (13, 20). The Old Rule bridges it
  at **Slakebridge** (16, 12).
- **The Inkrun** wells up black out of the Shade at (29, 9). It runs by (29, 10) and (29, 12) into the Glass Sea at
  (29, 13), and is bridged at **Inkbridge** (29, 11). Its ink pools stain whoever wades through them.

**Roads.**
- **The Old Rule** (Deepwright) runs:
  - from Hollowmere (5, 16) by (6..7, 16), (7..8, 15), (8..9, 14), (9..10, 13) and (10, 12) to Benchmark (11, 12);
  - then (12..18, 12), across Slakebridge, and (18, 11..9) and (19, 9) through the Molar pass to Molar (20, 9);
  - then (21..22, 9), (22, 10..11) and (23, 11) to Halfnight (24..26, 11);
  - then (27..36, 11), across Inkbridge;
  - with a spur north by (36, 10..9) to the **Last Milestone** (36, 8), and a spur south by (36, 12..13) to the
    Metronome (37, 13).
- **The Straight Cut** is the Assize's road. It runs from the Square (27, 2) due south along x = 27, through the Deep
  Pleat (rows 3 to 5) and down the Shade's western edge (rows 6 to 10), to Halfnight's east end at (27, 11).
- **The Glass Causeway** leaves the Old Rule at (31, 11) and runs south over the sea by (31, 12..15) to the Drowned
  Lantern (31, 16).

**Impassable and walk-in features.**
- **The Teeth** form a wall from (19, 0) to (21, 16).
  - On the world map they can be crossed only through the **Molar pass** at (19..21, 9), or at night by the Hush Stair
    (below).
  - The long way round passes their south end, rows 17 to 20, through 5 to 6 spans of Downs.
  - Teeth zones can be walked into from a neighbouring zone, for their eyries and crag villages.
- **The Glass Sea** covers (27..35, 13..19). Only the Glass Causeway crosses it. A wreck is visible beneath the glass
  from the Causeway, in the all-sea block (9, 5).
- **The Hollow Mere** (4..6, 18) is the lagoon south of Hollowmere.
- **The Lattice** can't be crossed on the world map: moving onto a Lattice span drops you into its zone. The Old Rule ends
  at the Last Milestone (36, 8), five zones' walk from the Gnomon's door.

**The dark crossing: the Hush Stair (19, 4), (20, 4), (21, 4).** This is the world-scale ghost plank.
- In daylight, or with your lamp lit, these are ordinary Teeth spans that can't be entered.
- **At night with your lamp out** they can be crossed on the world map, at 8 hours each. They link the Pleatwood at
  (18, 4) to the Deep Pleat at (22, 4): a way into the east that never touches Molar.
- To use them you must know they exist. That is a dark reading, sold by the Lampless and the Unlit, and also told by
  Brann.
- The rule is consistent with the lamp: on the world map your lamp is either lit (and burning glim) or out, and F toggles
  it.

### 4.8 The Hand and the Lengthening

**The Hand** is the Gnomon's day-shadow on the world map.
- **When.** Between 06:00 and 18:00 it is a ray from the Gnomon (37, 3).
- **Angle.** θ(h) = 25° + 11° × (h − 12), measured from due west and turning towards south.
  - At dawn it points north-west and runs off the top edge after a few spans.
  - At 10:00 it reaches across the Pleatwood towards Foldmother.
  - At noon it lies at 25° along the Shade, towards Hollowmere.
  - At dusk it points due south down column 37.
- **Length.** L(h) = N × (1 + |h − 12| / 3) spans, capped at 40.
  - N is the **noon length**. It is 15.5 at the start, so at noon the tip rests on the Shade's tip at (23, 10).
  - The Survey measures N on the Still Days and sells the figure.
- **Spans under the Hand** are those whose position lies within 0.5 spans of the ray.
- **What it does to the spans under it:**
  - *Dimmed.* The zone's daylight dims to dusk. Dark-only things (runes, ghosts, ghost planks) show by day with your
    torch out, and the Unlit walk. The torch is still free, because it's still day.
  - *Flat traffic.* Each world-map move onto a span under the Hand rolls 25% for a Flatfolk caravan encounter. Flat
    beings in those zones move twice as fast, and Lampless pilgrims travel there.
  - *No wakes.* Turning while under the Hand leaves no wake (section 10.3).
- **On the map** it is a dim stripe that moves as you travel. Benchmark's Signal Room shows it at all times, and so do
  the theodolite and the Great Theodolite.

**The Lengthening (the clock you can see).** The noon length N grows only at fixed main-quest beats, never on a timer.

| When | N (noon length) | Spans that turn to Shade |
|---|---|---|
| start | 15.5 | — |
| after beat 5 | 17.5 | (22, 10) road and (21, 10) Teeth |
| after the first of beats 7 and 8 | 19.5 | (20, 11) and (19, 11), both Teeth |
| after beat 9 | 21.5 | (18, 11) and (18, 12), both road: the Old Rule seven spans east of Benchmark, by the Slake |

- **What a span that turns to Shade becomes:**
  - it gains +1 tier and permanent dusk;
  - it takes the Shade's spawns;
  - its lost chance becomes 20%, except that roads stay roads (3 hours, 0% lost), only dark;
  - **converted Teeth spans stay walk-in only.** They become "Shade-Teeth": dark crags that still can't be entered from
    the world map.
- **The stakes.** At N = 34.5 the noon tip would reach the Hollow Mere (6, 18), on Hollowmere's doorstep, and the
  Afternoon would begin. In normal play that happens only in the *Pressing* ending.

### 4.9 Travel rules

**Speed.** Hours per span come from the terrain table. Modifiers:

| | Modifier |
|---|---|
| Wings mutation | × 2 speed |
| A hired Drover longback | × 1.5 |
| Pathcraft's *Pathfinder* power | × 1.5 |
| Moving at night (except on roads) | +25% hours |

**Getting lost.** Each move rolls the terrain's lost chance, doubled at night.
- *Mitigation:*
  - Pathcraft's terrain lore for that terrain: −75% of the chance;
  - a compass-ring: −5 points;
  - flying: −10 points;
  - a road under you: always 0.
- *When you're lost:* you're dropped into the zone you were crossing, and the world map locks.
- *Getting your bearings back:*
  - reaching a road span or a zone you've visited clears it at once;
  - each new zone you enter rolls 25% (50% with Pathcraft);
  - asking any creature that can give directions clears it. The Flatfolk always can, because they see the whole Plane,
    but only in the map view;
  - **bearings from height:** climb 6 or more blocks above the zone's ground in 3D and look around for 2 s, for +30%,
    once per zone. The map can't do this; only height can;
  - **the Gnomon in sight:** +10% per zone when the needle is visible on the horizon (daylight, outdoors, not under a
    canopy and not in the noon glare).

**Hidden sites.** Each move rolls 10% (20% with the Survey's *Keen Eye*) for each undiscovered site in the span you enter.
A hit asks, for example, "Smoke rises from a fold in the downs. Stop and look?" Sites you decline are not recorded.

**Noon glare.** In the Salt Waste and the Glass Sea's shore zones, between 11:00 and 13:00:
- the 3D view distance drops to 6 tiles and colours bleach;
- the map is unaffected, so crossing the Waste at noon is done from above;
- a salt veil or dark goggles cancel it.

**Fast travel.**
- A **homing pip** (artifact) takes you to the Temple of Angles.
- A **programmable pip** can be set once, to any village.
- **Drover caravans** run Benchmark–Molar–Halfnight for 30 glim and 1 day, with no lost or encounter rolls.

**Discovery XP.** The first visit to a landmark gives 0.3 × the XP of one level at its surface level; a village gives
0.2 × (section 10.7).

### 4.10 Density: something worth finding in every block

- **Blocks.** The map divides into **98 blocks** of 3 × 3 spans (14 across by 7 down). Block (bx, by) covers x 3bx..3bx+2
  and y 3by..3by+2.
- **Landmark blocks.** 15 blocks hold the 16 landmarks (A and B share block (1, 5)):
  (9,0) M, (0,1) O, (4,1) P, (12,1) N, (7,2) I, (10,2) J, (2,3) E, (6,3) F, (8,3) H, (2,4) C, (3,4) D, (12,4) K, (1,5) A+B,
  (8,5) G, (10,5) L.
- **The exempt block.** Block (9, 5), at x 27..29 and y 15..17, is all sea. It's the only empty one: a wreck is visible
  beneath its glass from the Causeway.
- **The other 82 blocks** each get **exactly one guaranteed procedural site**, chosen by the block's dominant terrain and
  tier.

| Site type | Count | Placement rule | What's inside |
|---|---|---|---|
| Village | 16 | per region: Flats 1, Waste 1, Steps 2, Downs 2, Pleatwood 2, Deep Pleat 1, Tessellate 2 (Flatfolk page-towns), Shade 1 (Lampless), Stacks 2, Glass shore 1, Teeth 1 | a full generated village (section 9) |
| Hour site | 8 | Fifth Hour: 2 at tiers 1-3. Fourth: 2 at tiers 3-4. Third: 2 at tiers 4-5. Second: 1 at tiers 6-7. First: 1 at tiers 7-8 | 2 to 5 floors, the Hour's cult, a relic and true-marks |
| Lair | 12 | any terrain, tiers 1-7 | a surface zone plus 1 to 3 floors, with a legendary owner |
| Ruin | 14 | the Stacks, the Steps and the Downs preferred; a third are Toppled Stacks | 1 to 3 floors of Deepwright rooms, loot, and a floor plan to sell to the Plan |
| Shrine | 14 | 8 dial-steles (Hour events), 3 noon-posts (Noon Vigil), 3 Hushes (Lampless) | a reading, a prayer, an hour |
| Vignette | 10 | one zone each | a pressed caravan mosaic; a stranded Survey tower; a ghost picnic seen only in the dark; a fallen Kite; a Drover funeral; a dial still turning; a glim spring; an automaton repairing nothing; a stranger's face in a mosaic; a door standing alone |
| Overlay core | 6 | one per overlay type (section 12.14), with 1 to 2 spans of fringe around it | a rare liquid and an item |
| Wanderer camp | 2 | on roads | a legendary trader or hermit |

**Ruin variant: the Toppled Stack.** A third of the ruins are Deepwright towers that fell on their sides before history.
- The old floor mosaics now run up the walls, so you read them in 3D, as murals.
- The old wall reliefs now lie on the floor, so you read them on the map, as mosaics.
- Doors have become pits that drop you one storey, and windows are holes overhead.
- It is still one world: the map shows the tower as it lies now, and only the *readings* are inverted.

**Placement order:**
1. Hour sites first, because they have tier bands.
2. Then the village quotas.
3. Then the rest, by weighted table.
4. Sites never sit on road or landmark spans, and the generator leaves at least 1 free span between any two sites.

**Hard cases, confirmed.**
- **The five all-Lattice blocks**, (11, 0), (12, 0), (13, 0), (13, 1) and (13, 2), have no span you can enter from the
  world map. Their sites are always walk-in, and come from {First-Hour site, lair, ruin, vignette, overlay core} at tiers
  7-8. The First-Hour site always goes in one of them.
- **Block (11, 5)** has exactly one usable span, (35, 17) in the Stacks. Its site goes there. Block (10, 4) has two:
  (30, 12) and (32, 12).
- `test.html` asserts that every non-exempt, non-landmark block holds exactly one guaranteed site, and that every site
  is reachable on foot from a road or from a landmark.

**Guaranteed near the start:**
- the nearest Fifth-Hour site, 3 to 6 spans from Hollowmere and outside its block, which the Dial Floor reveals;
- a lair within 3 spans of Kettle Mesa;
- a village within 4 spans of Benchmark.

**Zone-level density.** Every enterable zone also gets 1 to 3 small finds from its terrain table: a cache, a herb, a
carved stone (a reading), a wanderer, or a commons lamp. Nobody crosses a zone with nothing in it.

### 4.11 Surface zones: generation and seams

- **Terrain comes from world coordinates.** A zone's heightmap, rock, water and trees are sampled from noise over
  *world* tile coordinates: (span x × 80 + tile x, span y × 48 + tile y). So the edges of neighbouring zones match
  exactly, with no blending strip. The terrain type selects the noise parameters and blocks, and its strength fades over
  the 8 tiles nearest an edge where two terrains meet.
- **Ports on every edge.** Each span edge has deterministic **ports** chosen from `hash(edgeId)`, so both neighbours agree
  on them:
  - a road port where a road crosses the edge;
  - a river port where a river crosses;
  - and 1 to 3 open walking ports.
  Roads and rivers are drawn port to port.
- **Fixed footprints.** Landmark footprints are flatten masks in world space, drawn from their vault-format plans. Per-run
  sites keep a 6-tile margin from the zone's edges.
- **Height limits.**
  - On the surface, nothing you can stand on is more than 12 blocks above the zone's ground. The grid is 16 high and
    the ground sits at z = 2.
  - Solid scenery may reach 14 blocks.
  - In dungeons, no platform stands more than 5 blocks above the floor you're on (rooms top out at z = 8).
  - Anything taller (the Gnomon, Foldmother's crown) is a horizon billboard.
- **`validateSurface(zone)`** checks that:
  - every port is reachable from every other port by walking;
  - every landmark or site entrance is reachable from at least one port;
  - nothing standable is more than 12 blocks up;
  - every required item and NPC tile is reachable;
  - and any plateau that needs a jump is placed on purpose.

  A failed zone is regenerated with the next sub-seed, just as `validateFloor` does for dungeon floors.

### 4.12 The Gnomon on the horizon

- **The compass.** From every surface zone in 3D, the Gnomon stands on the horizon at its true bearing from your span. It
  is a thin black needle that glints when the sun stands on its tip at noon. That makes it the game's compass. On the
  world map it is just a letter.
- **How it's drawn.** It's a sky-layer billboard, never voxels. It needs the outdoor horizon plane and haze from the
  technical design, in place of today's black void below the horizon beyond the zone's edge (`render3d.js:186-189`).
  Its cost is budgeted there.
- **In its own zone** at (37, 3), the voxel foot rises 14 blocks, and the billboard continues the needle above that.
- **At night.** On clear nights the Gnomon's tip shows a single violet light, visible from
  the Shade and from the tops of the Rust Steps' mesas.

---

## 5. Fixed landmarks

Each landmark gives:
- its location, kind, tier and level;
- its three registers (Flat, Deep and Dark lines);
- its description, inhabitants and services;
- its dungeon, with explicit floor levels and its **gimmick**, including which house rule the gimmick uses;
- its role in the main quest.

The dungeon *interiors* are generated each run by the existing floor generator, using the gimmick listed. The set pieces
(boss halls, puzzles) are vault-format stamps.

### A. Hollowmere (5, 16): start village, Brine Flats, tier 1, level 2

> *Flat:* HOLLOWMERE. Stilts 212. Lamps 1 (commons). Cube 1. *Deep:* Reed roofs, eel smoke, and a squat temple whose
> walls meet at angles nobody likes. *Dark:* the floor has been shaking / something under it is counting

- **Description.**
  - A stilt village of reed thatch around the **Temple of Angles**, on the shore of the Hollow Mere. Glimseed presses
    creak all day.
  - The temple floor is one huge mosaic of an angle. From above it is plainly an arrow pointing north-east at the Gnomon;
    in 3D it is a pretty floor.
  - The temple's walls force the flat reading: inside them, anyone who isn't a Turner sees only the map.
- **Inhabitants and services:**

  | Who | What they offer |
  |---|---|
  | **Maren**, Prioress of the Noon Vigil | rest (a full heal); teaches Leechcraft; gives the main quest; holds the Keeper's Stair key |
  | **Pell**, peddler | buy, sell, sharpen, identify, lift curses. He walks a 6-day round: Hollowmere (days 1-2), Benchmark (3-4), Molar (5-6) |
  | **Mira**, the Survey's cartographer | starter quest *Mira's Blank Corner*; sells Location readings |
  | **Reeve Hallen** | starter quest *Grubs in the Kettle*; teaches Pathcraft |
  | **Sir Corwin**, the village warden | teaches Long Blade; posts village bounties |
  | **Old Ottilie**, tinker | repair, recharge cells, examine artifacts (10 glim × complexity) |
  | **Ess** and **Tee**, Flatfolk envoys of Folio | only on the map: flat readings, directions, the Tracing |
  | **Brann**, a ghost in the crypt | seen only with your torch out: rumours, the *Keeper's Descent* inscription, the Hush Stair, starter quest *Brann's Skull* |
  | **Brother Tamsin**, a Horary missionary | sells dial-stele Locations; buys any Hour reading |
  | **Corner**, the temple cat | pet her for +10% XP for a world day |
  | the commons lamp | 5 glim a day, free |

- **Dungeons.**
  - **The lower sanctum** holds the Cube's altar and a well. The culvert from Kettle Mesa comes out in the well.
  - **The Keeper's Stair** (optional legacy dungeon) is the original game's 20 floors under the temple, sealed since
    924 LN. Maren unseals the first landing for *Brann's Skull*, and the rest after beat 1.
    - It's built by the existing generator with today's vault order. Floor f is level f + 1 (2 to 21).
    - Floor 5 is the Flat Queen's old hall. Her daughter holds it now, a planar queen with the Twice-pressed rule.
    - Floor 10 is the Gloom Warden's hall, and floor 15 the Colossus's, as they were.
    - On floor 20, **Vorlath** lies folded into a single line: a flat lich 9 tiles long, fought on the map. Every 8 s he
      stands up in 3D with the old Lich King's rules, and then only a blow in 3D lands.
    - The parent game's ten relics are its prizes.
- **Gimmick (onboarding).** You start seeing **only the map**, as in the original game. You walk the temple's mosaic
  floor, read it, go down to the sanctum and touch the Cube. The camera swings down into your eyes, and Tab works from
  then on. This takes about 2 minutes.
- **Role.** The prologue, the starter chain and beat 1. It's also the homing-pip destination and a *Commons Lamp*
  checkpoint.

### B. The Dial Floor (5, 15): the stele of three accounts, Brine Flats, tier 1

> *Flat:* DIAL FLOOR. Pips 5. Arrow 1, bearing north-east. *Deep:* A salt-crusted ring of flagstones round a stone pin,
> its base carved with a crowd of kneeling people. *Dark:* we were not kneeling / we were being pressed

- **Description.** A ring of salt-crusted flagstones north of the village. A sundial mosaic lies at its centre, around a
  carved pedestal. All three show the same event of the Fifth Hour:
  - **The Flat Account** (map): the mosaic reads as an arrow and a row of pips. They give the direction and the distance
    in spans to the **nearest Fifth-Hour site**.
  - **The Deep Inscription** (3D, in light): a relief carved on the pedestal. It is the Hour's flattering version of the
    event.
  - **The Dark Gloss** (torch out): a rune round the rim, cut by the event's dead.
- **Effects.**
  - Reading the mosaic gives a Location reading and the first Flat Account.
  - Each account goes into the journal side by side with the others.
  - Reading all three **triangulates** the event: you learn which floor of the site holds the lost relic, and get
    0.15 × one level's XP.
- **Role.** The guaranteed history hook, and the first lesson that the three readings tell different truths.

### C. Kettle Mesa (6, 14): first dungeon, Rust Steps, tier 1, 3 floors (levels 2, 3, 4)

> *Flat:* KETTLE MESA. Floors 3. Shaft 1. *Deep:* A hollow mesa like an upturned kettle, open to the sky; every floor a
> ring of ledges round a drop. *Dark:* the grubs hum when they dig / listen

- **Description.** A hollow mesa shaped like an upturned kettle. It's open to the sky at the top, so floor 1 is in
  daylight. Each floor is a ring of ledges around a central shaft.
- **Inhabitants.**
  - Brine-grubs, saltrats, a pair of Rustback scavs, and the first flatlings: your first flat beings.
  - At the bottom is the **Grub Mother**, a legendary brine-grub. She burrows, and on the map her tunnel shows as
    disturbed ground (`;`) that you can track from above.
- **Gimmick: the shaft** (height, and the map lies).
  - In 3D, stepping off any ledge into the shaft drops you **exactly one floor, unhurt**, onto brine-moss.
  - The map draws the shaft as ordinary floor until you have looked down into it in 3D. This teaches the core rule on
    floor 1.
  - Floor 2 adds the first spike field (a wave that rolls your way) and a *Flat Lie* room.
  - Floor 3 holds the Grub Mother, and a fresh **sapper tunnel** with an Assize plumb-seal in it: the main-quest clue.
- **The loop home.** Floor 3 ends in a flooded culvert. Dive in and the current carries you, unhurt, up into the Temple of
  Angles' well.
- **Role.** The starter quest *Grubs in the Kettle*, and a route through beat 1.

### D. Benchmark (11, 12): the Survey's hub, Downs/Steps edge, tier 2, level 5

> *Flat:* BENCHMARK. Towers 6. Mark: 0. *Deep:* A walled station of brass instruments around a grey pillar cut with a
> single level line. *Dark:* the pillar is older than the line / the line was cut to lie

- **Description.**
  - A fortified survey station built around a Deepwright **benchmark**: a pillar carved with a height mark called **the
    Mark**.
  - Six instrument towers stand in a ring around it.
  - The Signal Room shows the Hand on the world map at all times. The Map Room sells Location readings and shows the tier
    layer.
- **Inhabitants and services.**
  - **Surveyor-General Teodor Quint-Vey**;
  - **Saara Tovi**, instrument-master (the tinker);
  - a leech (healer);
  - **Truing Cradle #1**, worked by **Detail C**, an automaton on loan from the Plan;
  - a Chandler bank, a Drover caravan stop, and Pell on his round.
  - The station is the same in every beat. Only the Datum's lower floors and the siege change it.
- **Dungeon: the Datum**, 4 floors (levels 5, 6, 7, 8), under the pillar. Floors 1-2 are open; floors 3-4 open at beat 2.
- **Gimmick: the true level** (both views, and height).
  - Pillars carry height marks that show only in 3D: "this sill is 3 blocks up".
  - The floor holds **benchmark plates** with numbers that read clearly only on the map.
  - A door opens when you stand on the plate whose map number matches the 3D height of the marked sill.
  - The last chamber's Datum stone must be read standing *at its level*, on top of a 2-block plinth. You need a crate
    step and a jump.
- **Role.** Beat 2 (the reading) and beat 9 (the siege).

### E. The Tall Table (8, 9): sky mesa and Kite aerie, Rust Steps, tier 2, optional

> *Flat:* TALL TABLE. Height: not recorded. *Deep:* A mesa sheer on every side, chimes ringing at the top in a wind you
> can't feel down here. *Dark:* there is a stair / it only comes out at night

- **Description.** A sheer mesa 12 blocks tall with a flat top. The **Kites** (bird-folk) live on top in an aerie of
  wind-chimes.
- **Gimmick: a dungeon that goes up** (height, and the dark).
  - On the map, the top and the foot look the same: flat. There is **no map path up**.
  - The only way is to climb in 3D: ledges, crates, wind-cut steps, two sprinting jumps, and one stretch of ghost planks
    that shows only at night with your torch out.
  - **Kite perches:** whatever a kite steals, it carries to a perch 3 to 5 blocks up the cliff. The map shows the nest
    (`°`), never how high it is.
  - Wings, Stilt Legs or a potion of flying make the climb easy.
- **Inhabitants and services:**
  - **Kreeva Old-Wing**, the Kite elder (legendary): teaches Tumbling;
  - a feather-trader, who sells the feather cloak (+250 Kites);
  - a dial-stele;
  - the overlook: buy the Kites' *view* reading, which reveals every span within 6 on the world map.
- **Quest: *Up the Table*.** Carry a Drover's message up the climb. The reward is the **Featherbone** relic: +1 jump, and
  falls never hurt.
- **Role.** Optional. It teaches height, and it's the Kites' home for winged characters.

### F. Molar (20, 9): pass town, the Teeth, tier 3, level 8

> *Flat:* MOLAR. Gate 1. Toll: 40. *Deep:* A caravanserai hollowed out of one enormous tooth, its gullet full of
> longbacks and argument. *Dark:* the canals under the tooth are older than the toll / so are we

- **Description.** A caravanserai carved into a single tooth-shaped crag at the only road pass through the Teeth. The Old
  Rule runs straight through its gullet. Molar is the visible tier boundary: tiers 1 to 3 lie west of it, and 4 and up to
  the east.
- **Inhabitants and services:**

  | Who | What they offer |
  |---|---|
  | **Mother Saffre**, factor of Chandler House Saffre | the toll; the bank; the clear-glim exchange |
  | **Zaqar Tesfu of Nine Longbacks**, Drover caravan-master | the market; longback hire (× 1.5 travel) |
  | **Assizer Castor Dell-Cassin** | from beat 2: a checkpoint that turns back the Bent and seizes "Deepwright contraband" |
  | **Rook**, bounty hunter | the bounty board: named legendaries for glim |
  | an inn, a map-seller and a dial-stele | rest, readings, a prayer |

- **Dungeon: the Root Canals**, 2 floors (levels 8, 9): the smugglers' route around the checkpoint.
- **Gimmick: borrowed dark** (the dark).
  - Every lamp in the canals is a Chandler lamp, locked and unlit.
  - You go torch-out, crossing canal pits on ghost planks.
  - **Dark-mapping:** in the Canals, the map records every tile you step on, even unlit, so the map keeps your bearings
    while the eye is blind.
  - Lighting your torch wakes the Chandler watch. Their lamp-hounds track light, not sound.
- **Role.** Beat 3, and the recurring market of the middle game.

### G. Folio (24, 15): Flatfolk town, the Tessellate, tier 4, level 11

> *Flat:* FOLIO. Streets 31. Inn: the Margin. Archive 1. *Deep:* An empty paved plain, and several hundred shadows
> sliding over the stones with nobody casting them. *Dark:* the scratching is writing / they are writing you down

- **Description.**
  - **In 3D:** an empty paved plain. Several hundred shadows slide over the stones with nobody casting them, and there's
    a scratching like a great deal of distant writing.
  - **On the map:** a bustling town drawn in lines, with streets, a market, an inn called **the Margin**, and an archive.
  - **Folio exists only on the map.** You must turn to trade, talk, Trace or rest. Deep creatures walk straight through
    its walls without noticing.
- **Inhabitants and services:**
  - **Ell, once the Flat Queen.** She was the guardian of the Keeper's Stair's fifth floor, and walked out after the
    Keeper's Descent. She is Folio's magistrate now: "a person now", she insists. She keeps the Margin court and gives
    Folio's side quest.
  - **Kay of the Long Line**, archivist (legendary): buys deep readings, and sells the Flat Accounts of every Hour.
  - **Double-Ell**, merchant: ink, stencils, maps.
  - the Margin (rest), and teachers of Survey and Lore.
- **Gimmick: a town that's a drawing** (flat beings).
  - The archive vault's door is drawn on the floor. In 3D it's a blank wall; on the map you walk through it.
  - A Rustback raid can't harm the town, but it can harm *you* while you stand in 3D.
- **Role.** Beat 4.

### H. Halfnight (24, 11), (25, 11), (26, 11): holy city, the Tessellate on the Shade's edge, tier 4, level 11

> *Flat:* HALFNIGHT. Length 3 spans. Width 1 street. Line 1. *Deep:* Sundials on one side of the street, shuttered
> cells on the other, and a brass line down the middle that nobody steps on. *Dark:* the north side is listening / the
> south side is ringing

- **Description.** A city one street wide and three spans long, built exactly along the Shade's southern edge.
  - **The north row of houses** stands in permanent night. It's the Lampless quarter, where no lamp may burn.
  - **The south row** stands in day. It's the Horary quarter, full of sundials.
  - **Down the middle** of the street runs **the Line**, a brass inlay that nobody crosses without a reason.
- **Its three zones:**

  | Ward | Span | What's there |
  |---|---|---|
  | West Ward | (24, 11) | the Hour-house, the Horary cathedral, with the **Noon Bell** |
  | Middle Ward | (25, 11) | the market, the Line Court, a Chandler bank, and **Linekeeper Hasay Gudri**, the city's reeve |
  | East Ward | (26, 11) | **the Hush**, the Lampless chapel, and a ghost market seen only with your torch out, at night |

- **Inhabitants and services.**
  - **Primate Ilyendra** of the Horary: teaches Lore.
  - **Abbess Wisse** of the Lampless: teaches Shadowcraft.
  - Traders of both faiths. The city sells both faiths' readings.
- **Gimmick: light as law** (light and the dark).
  - A lit torch in the north row is **trespass** for the Lampless.
  - A torch *out* inside the Hour-house is trespass for the Horary.
  - The city holds the game's one systemic mystery: **Who Lit the Hush?** (beat 6).
- **Role.** Beat 6. It is also the bridge between the west and the Shade.

### I. The Pressyard (23, 7): pressed village and the Press, the Tessellate, tier 4, 5 floors (levels 11-15)

> *Flat:* PRESSYARD. Houses 41. People 300, all mid-stride. Well 1 (stair). *Deep:* Faded tiles in a field, and a stair
> going down where a well should be. *Dark:* they are still walking / the floor is very tight

- **Description.**
  - **On the map** it's a perfect mosaic of a village across three hundred tiles: houses as coloured squares, people as
    figures mid-stride.
  - **In 3D** it's faded tiles.
  - A stair goes down where the mosaic's well would be. Underneath, the Deepwright **Press** has been restarted.
- **Inhabitants.**
  - Assize engineers, press-hounds, mosaic golems and pressed captives, with errata (bad unpressings) at the margins.
  - The boss is **Press-Master Sevrin Marr-Orrum**, together with the Press itself.
- **Gimmick: pressing** (flat beings, the beat, and the ceiling).
  - **Pressed rooms.** Each floor has a pressed room whose contents (loot, enemies, captives) exist only on the map, as a
    mosaic. Stand on its centre tile and turn (Tab) to **unpress** it. It inflates into 3D, enemies and all.
  - **Press-plates.** From floor 3 the press-plates slam on a beat. The map previews the next plates, as it does for spike
    traps. Anyone deep on a plate when it slams is **pressed flat** for 10 s (the Flat status, section 10.2).
  - **The lowering ceiling.** Floor 1 has 6 blocks of headroom, floor 2 has 5, floor 3 has 4 and floor 4 has 3. On
    floor 4 there is no room to jump, so its spike fields can only be crossed by reading the beat on the map. Floor 5 is
    the Press-hall, tall again under the Press.
  - **The boss.** Break the Press's three pistons, up on gantries 3 to 5 blocks high that you reach by climbing in 3D,
    while you watch the beat on the map.
- **Role.** Beat 5, including the clear-glim reveal.

### J. The Unlit Choir (31, 6): Lampless cathedral, the Shade, tier 6, 6 floors (levels 15-20)

> *Flat:* UNLIT CHOIR. Floors 6. Lamps 0. *Deep:* A cathedral sunk to its shoulders in the dusk, full of a song that
> doesn't come from anywhere. *Dark:* we sing / so you can find the stairs

- **Description.** A cathedral sunk into the Shade, full of ghost-song. Nothing is lit inside except your torch and the
  braziers.
- **Inhabitants:**
  - Lampless chanters, shades, wraiths, and the Unlit (ghosts);
  - **thol**, the choirmaster ghost;
  - **the Gloam Warden**, a mini-boss on floor 4 (the original game's Gloom Warden, now a legendary template);
  - **Noon** herself on floor 6.
- **Gimmick: the dark.**
  - Every floor is lampless.
  - Bridges are ghost planks, doors are rune doors, and the Unlit are visible only with your torch out.
  - Shades burn in firelight. So you juggle: torch on to fight shades, torch off to see ghosts, planks and runes.
  - **Dark-mapping** applies: the map records every tile you step on.
  - A lit torch inside is trespass for the Lampless, unless you carry the **dark-pass** from Halfnight.
- **Noon on floor 6.** She is a *flat ghost*: she exists only **on the map, and only with your torch out**, as a mosaic of
  a woman with no shadow.
- **Role.** Beat 7.

### K. The Metronome (37, 13): machine foundry, the Stacks, tier 6, 6 floors (levels 17-22)

> *Flat:* METRONOME. Floors 6. Beat: 2 per second. *Deep:* A tower of iron floors threaded on a pendulum that never
> stops. *Dark:* tick / tick / it has been counting to something

- **Description.** A Deepwright foundry tower built around a pendulum that swings through the central shaft of every
  floor. Its swing is **the beat**. It is the Plan's holy place.
- **Inhabitants and services:**
  - **Section Nine**, Chief Draughtsman (legendary automaton);
  - draughtsmen, beat-spiders and lens sentries;
  - **Truing Cradle #2**.
- **Gimmick: one beat** (the spike beat, everywhere).
  - Every spike trap, crusher, piston, conveyor and gate on every floor moves to the pendulum. The map's spike preview
    extends to all of them.
  - Some doors open only on the off-beat.
  - Machine monsters act only on the beat: in step on the map, lurching in 3D.
  - Bombing walls here is desecration (Plan −50 per block).
- **Boss: the Escapement.** It's built on the Colossus pattern: its core is on its head, so climb the pendulum's
  gantries (up to 5 blocks). Its slams are telegraphed on the map.
- **Role.** Beat 8: the new hour hand.

### L. The Drowned Lantern (31, 16): lighthouse, the Glass Sea, tier 7, 5 floors down (levels 20-24), optional

> *Flat:* DROWNED LANTERN. Floors 5, below sea. Water: by the hour. *Deep:* A lighthouse standing in glass up to its
> knees, its lamp long dead. *Dark:* the bell still rings / under the water / for the noon

- **Description.** A Deepwright lighthouse on an island, reached by the Glass Causeway. Its floors go down below sea
  level.
- **Inhabitants.**
  - Glass crabs, mirror eels and slag salamanders.
  - **The Drowned Bellwether** (legendary): a bell-headed ghost whose toll forces every flat thing deep for 3 s.
- **Gimmick: the tide of the hours** (plan on the map, run in 3D).
  - Each floor is **dry from 11:00 to 13:00**.
  - From 13:00 the water rises 1 block every 2 world hours, up to 4 blocks at 19:00, and stays there until 11:00, when
    it drains.
  - The map shows the current waterline. Whatever lies under deep water stays blank on the map until you have looked at
    it in 3D: the waterline works like the chasm rule.
  - Plan your route on the map, then run it in 3D before the water rises. Falling into deep water drops you a floor.
  - Or wait until noon (Z) and walk the floors dry.
- **Floor 5:** the **Noonglass** stands on a dais that is dry only at noon.
- **Role.** An optional saga. The Noonglass unlocks ending 3, and makes Vesper's weak point glow in the finale.

### M. The Square (27, 2): the Assize's citadel, the Deep Pleat, tier 6, 5 floors (3 down: levels 19, 20, 21; 2 up: levels 22, 23)

> *Flat:* THE SQUARE. Sides 4, equal. Rooms 144, equal. *Deep:* A clearing cut perfectly square out of the folding
> forest, the stumps in rows, and in the middle a cube with no windows. *Dark:* every room is the same room / except the
> one you are in

- **Description.** A perfectly square clearing cut out of the folding forest, its trees felled in straight rows. In the
  middle stands a windowless cubic citadel. On the world map it's the only exactly square thing.
- **Inhabitants and services:**
  - **Hierarch Aurel Strade-Orrum**;
  - plumbknights and assizers;
  - **Truing Cradle #3**: free installs for the Plumb at Assize ≥ +250;
  - **Lio**, a pressed prisoner in the cells (map only).
- **Gimmick: identical rooms and the Rule** (flat beings, mosaics, and height).
  - Every floor is a lattice of identical square rooms. Only the floor mosaic in each, read on the map, tells them
    apart, so in 3D the citadel is a perfect maze.
  - The lower floors are prisons of **pressed prisoners**. They're flat beings: you can only talk to them, and free them,
    on the map, by turning their press-wheels in 3D.
  - Patrols walk dead-straight lines, drawn on the map as `|` and `-` traces, so you can plan your way round them from
    above.
  - **Rule-banners.** Assizers raise banners that make a 12-tile **Trued** zone. Inside it nobody can jump, falls hurt
    double, and the Assize get +1 armour. Strike the banner down in 3D to restore depth (Assize −50).
  - Plumb characters are let in at the gate.
- **Role.** Beat 10.

### N. The Gnomon (37, 3): the needle, the Lattice, tier 8; the Dial-works, 8 floors down (levels 23-30)

> *Flat:* GNOMON. Height: off the page. Shadow: 15.5 spans at noon, and lengthening. *Deep:* A black needle leaning over
> the world, so tall that the top of it is weather. *Dark:* the works are turning / the works are always turning

- **Description.**
  - A leaning needle of black truesteel, drawn as a horizon billboard from every surface zone (section 4.12).
  - Its foot is reached by walking about five Lattice zones from the Last Milestone (36, 8).
  - **Its door opens only between 11:00 and 13:00** (you can wait for it). It opens to the Plumb Key; or to the Cube
    turned on the threshold, which costs 10 max HP for good, because the Cube takes a little of your shadow; or to
    Hierarch Strade, if she is your ally.
- **Dungeon: the Dial-works**, 8 floors *down* into the mechanism beneath the needle: gears, escapement, the beat.
  - Floor 8 is **the Noon Socket**, where the age's hand is set.
  - Vesper waits there.
- **Gimmick: the sweeping hand** (flat beings, the beat, and the map's preview).
  - On each floor, an inner hand's shadow sweeps once around the floor every 40 s, like a clock hand.
  - **Anything inside the shadow is pressed flat** (the Flat status), you included. While you're flat, deep monsters
    can't touch you and you can't touch them, but flat monsters can.
  - The map shows where the hand will be next.
  - Odd floors hold deep monsters and even floors hold flat ones. So the shadow is a refuge on one floor and a trap on
    the next.
- **Role.** Beat 11 and the endings.

### O. Saltpage (2, 4): monastery of the Pressed, Salt Waste, tier 3, level 8, optional

> *Flat:* SALTPAGE. Storeys 1. Page 1 (city, drowned, 9 × 9 spans of mosaic). *Deep:* A salt pan so flat your
> footsteps come back off the horizon. *Dark:* the page is a city / the city is reading you back

- **Description.**
  - A salt pan so flat that you can hear your own steps echo off the horizon.
  - Its crust is a mosaic map of a drowned city, called **the Page**.
  - The Pressed's monastery is a single-storey house: they won't build up.
- **Inhabitants and services:**
  - **Father Bramwyn the Flattened**;
  - the **Pressing rite**, a blessing: once per floor you may turn flat for 3 s, for one world day. It's free at Pressed
    ≥ +250, and −100 reputation otherwise;
  - ink and brine;
  - the Pressed's library of flat readings.
- **Dungeon: the Under-Page**, 3 floors (levels 8, 9, 10). **Gimmick: the answer is in the floor** (mosaics).
  - Every floor is a Mosaic Hall writ large. Doors, levers and pits are all explained in the floor, so the right route is
    obvious from above and invisible in 3D.
  - **The Speaking Door** guards floor 2. It asks for "the number written upon my floor", a giant mosaic digit.
  - At the bottom: a Second-Hour stele carrying all three accounts, the Pressed's founding relic, and a reading that
    names Vesper.
- **Role.** An optional saga. Pressed ≥ +600 opens ending 4.

### P. Foldmother (12, 4): folding tree-village, Pleatwood, tier 3, level 8, optional

> *Flat:* FOLDMOTHER. Platforms 30 (day), 0 (night). *Deep:* A tree as tall as a mesa, pleated like a paper lantern,
> with houses in the pleats. *Dark:* at dusk she closes / like a hand / count your children

- **Description.**
  - A tree as tall as a mesa that **folds shut at dusk and opens at dawn**, like a paper lantern. Its crown is a horizon
    billboard, and its platforms reach up to 12 blocks.
  - The Pleatwood's trees are her children. Bent families and the Spore Moot live in her pleats.
- **Inhabitants and services:**
  - **Foldmother** herself: a speaking tree, and legendary;
  - **Warden Lumo**;
  - the Spore Moot's herbalist: tonics, and fungal limbs for reputation;
  - a dial-stele.
- **Gimmick: two layouts a day** (height and the clock).
  - **By day** her platforms spread into a climbing village.
  - **At dusk (18:00)** the platforms fold into the trunk and the bridges vanish. Anyone still out on a branch is folded
    in, and dropped unhurt onto the Rootfold's first floor.
  - The map draws tomorrow's fold-lines as creases.
  - **Dungeon: the Rootfold**, 3 floors (levels 8, 9, 10). Each floor has a day layout and a night layout, generated from
    the same seed. The one you get depends on the hour when you enter that floor; the swap never happens while you're on
    it.
- **Reward.** A supply of **fold-sap** tonic, and a cure for the Inked overlay. Spore Moot and Pleatwood reputation are
  earned here.
- **Role.** An optional saga.

---

## 6. Factions and people groups

### 6.1 Rules for all factions

- **Thresholds** are the bands in section 3.5. A creature's **demeanor** (docile, neutral or aggressive) decides where its
  hostility starts.
- **Likes and hates double as faction-versus-faction attitudes**, so NPCs fight each other:
  - Rustbacks attack Drover caravans;
  - Assize patrols attack Bent villagers;
  - the Moths mob Lampless monks;
  - the Plan's sentries shoot Rustbacks.

  The relations matrix for the AI is in Appendix 15.4.
- **Hidden parent factions** keep bulk relations cheap. "All Beasts flee fire" is one line.
  - **Peoples:** Hollowmere, the Survey, the Assize, the Drovers, the Chandlers, the Rustbacks, and villages.
  - **Faiths:** the Noon Vigil, the Horary, the Lampless, the Pressed, and the Hour cults.
  - **the Plane:** the Flatfolk and the Errata.
  - **the Dark:** the Unlit.
  - **Engines:** the Plan.
  - **Beasts:** the Saltbeasts, the Moths, the Kites and the Clatter.
  - **Growths:** the Spore Moot and the Pleatwood.
  - **the Askew** stand alone.
- **Rite reading** is the reading the faction's Kindling uses (section 3.3).
- **Buys / Sells** name the reading kinds and topics the faction trades in the Kindling.
- **Liquid** is the faction's sacrament (ritual liquid).
- **Glyph** is the letter its fighters use in zones. Talkable people of a people-faction draw as `@` in the faction
  colour (the parent game's convention).
- **Voice** gives the made-up speech's settings in `sfx.js` `VOICES` terms:
  - pitch in Hz;
  - waveform;
  - flags: `thin`, `ghost` and `stone` exist today; `glide` (portamento), `beat` (syllables quantised to the beat) and
    `grit` (noise mixed in) are new.

### 6.2 The fixed factions (21)

**1. Hollowmere.** *A village of the Bent, and a few Plumb.*
- *At a glance:* home Hollowmere (A) · docile · starts at **+100** · liquid: glim · rite: deep (the Lighting) · `@` reed
  green (120,170,110).
- *Likes:*
  - the Noon Vigil: "they keep our temple";
  - the Clatter: "good neighbours, bad jokes";
  - the Survey: "Mira's maps found the eel weirs".
- *Hates:*
  - the Rustbacks: "they raid the reed beds";
  - the Assize: "they've been digging under the temple".
- *Buys:* rumours of the Flats and the Steps; Locations of glimseed beds.
- *Sells:* the village's history, the Dial Floor reading, the Keeper's Descent.
- *Teaches:* Pathcraft, Long Blade, Leechcraft.
- *Voice:* 255 Hz, triangle; warm, with rounded vowels and a lilt at the end of a line (Maren's voice).

**2. The Noon Vigil.** *A faith (section 7.1).*
- *At a glance:* the Temple of Angles, 3 noon-posts, a chapel in Halfnight's West Ward · docile · **+50** · liquid: fresh
  water ("clear as noon") · rite: deep · `@` white-gold (240,220,150).
- *Likes:*
  - Hollowmere: "the keepers' village";
  - the Flatfolk: "they kept Noon's true account".
- *Hates:*
  - the Lampless: "they pray to her shadow";
  - the Horary: "they call her a thief";
  - the Assize: "they want the Cube".
- *Buys:* readings about Noon, the Cube and Vesper.
- *Sells:* noon-post Locations; fragments of Noon's accounts.
- *Teaches:* Leechcraft, Lore.
- *Voice:* 270 Hz, triangle; soft attack.

**3. The Survey.** *A guild of tinker-cartographers.*
- *At a glance:* Benchmark (D), towers in the Downs, Mira in Hollowmere · neutral · **0** · liquid: fresh water · rite:
  deep or flat (they'll take a Tracing too: mapmakers) · `@` brass (200,170,90).
- *Likes:*
  - the Flatfolk: "perfect maps";
  - the Plan: "the blueprints";
  - the Kites: "the view from above".
- *Hates:*
  - the Rustbacks: "they steal instruments";
  - the Askew: "they ruin measurements by existing".
- *Buys:* deep readings (heights, chasms); Locations of ruins and Hour sites; Flat Accounts.
- *Sells:* maps (Location readings), the tier layer, the noon length.
- *Teaches:* Survey, Artificing, Pathcraft.
- *Voice:* 300 Hz, square, `beat`; clipped and metronome-even.

**4. The Plumb Assize.** *A zealot order of pure-born judges.*
- *At a glance:* the Square (M), the Molar checkpoint, patrols on the Straight Cut and the Old Rule · aggressive ·
  **−700 for the Bent, −100 for the Plumb** · liquid: quicksilver ("it always finds the level") · rite: deep · `K` steel
  blue (150,170,200).
- *Likes:*
  - the Plan: "straight and obedient";
  - the Chandler Houses: "they fund us";
  - the Horary: "the dial must turn".
- *Hates:*
  - the Bent: "crooked lines";
  - the Flatfolk: "unfinished people";
  - the Askew;
  - the Rustbacks;
  - the Errata: "errors to be corrected".
- *Buys:* Locations of Bent villages; Hour relics.
- *Sells:* Truing Cradle Locations; Hour-site Locations; Plumb lore.
- *Teaches:* Long Blade, Parley (Intimidate).
- *Voice:* 120 Hz, square; perfectly level, with no pitch variation at all.

**5. The Horary.** *The faith of the Hours (section 7.2).*
- *At a glance:* the Hour-house in Halfnight's West Ward, dial-steles, roadside dials · neutral · **0** · liquid: sunwine
  · rite: deep, at the stele's hour · `H` amber (230,170,60).
- *Likes:*
  - the Hour cults: "misguided fellow believers";
  - the Kites: "birds of the high sun";
  - the Plan: "it built the dials with us".
- *Hates:*
  - the Lampless: "across the Line";
  - the Noon Vigil: "Noon stole the hour".
- *Buys:* any Hour reading, Deep Inscriptions above all.
- *Sells:* Deep Inscriptions; dial-stele Locations and their hours.
- *Teaches:* Lore, Parley (Chime).
- *Voice:* 420 Hz, triangle with vibrato; sing-song and bell-like.

**6. The Pressed** (the Church of the Plane). *A faith (section 7.5).*
- *At a glance:* Saltpage (O), pilgrims in the Tessellate · docile · **−50** · liquid: brine ("the pressed sea") · rite:
  flat (the Tracing) · `@` painted half white, half black (220,220,230).
- *Likes:*
  - the Flatfolk: "saints";
  - the Unlit: "they are also past the deep".
- *Hates:*
  - the Kites: "for flying";
  - the Plan: "it builds upward";
  - the Assize: "they press as punishment; pressing is a gift".
- *Buys:* flat readings and mosaic texts.
- *Sells:* Tessellate Locations; what mosaics mean.
- *Teaches:* Hardiness, Survey, and the Pressing rite.
- *Voice:* 150 Hz, sine; a flat whisper in a low monotone, with no reverb at all.

**7. The Lampless.** *A choir of the dark (section 7.3).*
- *At a glance:* the Hush in Halfnight's East Ward, the Unlit Choir (J), Hushes in the Shade · neutral, but hostile to lit
  torches in their holy places · **−100** · liquid: umbra · rite: dark (the Snuffing) · `N` violet-black (110,90,150).
- *Likes:*
  - the Unlit: "their company";
  - the Pressed: "fellow quiet ones".
- *Hates:*
  - the Lantern Moths: "they worship light";
  - the Chandler Houses: "they sell it";
  - the Horary: "across the Line".
- *Buys:* dark readings (rune texts, names of the dead), Dark Glosses.
- *Sells:* ghost-plank routes, the Hush Stair, Shade Locations, Vesper lore.
- *Teaches:* Shadowcraft, Lore.
- *Voice:* 110 Hz, sine, `ghost`; low, breathy and slow, with a long echo.

**8. The Salt Drovers.** *Caravan merchants.*
- *At a glance:* Molar (F), the roads of the Steps and the Waste · neutral · **0** · liquid: longback milk · rite: deep ·
  `@` saffron (220,150,60).
- *Likes:*
  - the Clatter: "trade partners";
  - the Chandler Houses: "credit";
  - the Kites: "scouts".
- *Hates:*
  - the Rustbacks: "they raid caravans";
  - the Assize: "tolls and searches".
- *Buys:* rumours; village Locations; prices.
- *Sells:* village and route readings; Drover recipes.
- *Teaches:* Pathcraft, Parley (Haggle).
- *Voice:* 165 Hz, sawtooth; rough, in a chanting rhythm (Pell's voice family).

**9. The Chandler Houses.** *Lamp-oil barons.*
- *At a glance:* Molar, Halfnight's Middle Ward, the banks · neutral · **−50** · liquid: clear glim · rite: deep · `J`
  gold (250,210,90).
- *Likes:*
  - the Assize: "order and supply";
  - the Lantern Moths: "customers";
  - the Drovers: "they carry the oil".
- *Hates:*
  - the Lampless: "they won't buy light";
  - the Rustbacks: "they steal it".
- *Buys:* Locations of glimseed beds and glim springs; rumours about the Pressyard ("to bury them").
- *Sells:* their best item; bank credit.
- *Teaches:* Parley (Haggle), Glimcraft.
- *Voice:* 330 Hz, square; smooth, nasal and fast.

**10. The Rustbacks.** *Scavenger clans.*
- *Who they are.* They are Bent whose crease grows iron: they eat scrap, and their backs plate over with it. They believe
  rust is the world remembering iron, so they "remember" things by taking them.
- *At a glance:* the Rust Steps, the Downs, the edges of the Stacks · aggressive · **−450** · liquid: blood · rite: deep
  (after a gift of iron) · `g` rust red (180,90,50).
- *Likes:* the Saltbeasts: "we ride the brinehogs".
- *Hates:*
  - the Drovers: "prey";
  - the Plan: "it guards the ruins";
  - the Survey: "it fences them off".
- *Buys:* caravan routes.
- *Sells:* ruin Locations; where stolen goods came from.
- *Teaches:* Axe, Throwing.
- *Voice:* 130 Hz, sawtooth, `grit`; grunting, low and clipped.

**11. The Flatfolk.** *The people of the Plane.*
- *At a glance:* Folio (G), the Tessellate's page-towns, any floor · docile · **0** · liquid: ink · rite: **flat only**
  (the Tracing) · `@` indigo (90,110,200). Feral flat beings are `f`.
- *Likes:*
  - the Survey: "good maps";
  - the Pressed: "devotees";
  - the Noon Vigil: "they keep Noon's memory".
- *Hates:*
  - the Assize: "they press people as punishment";
  - the Askew: "they crumple the Plane";
  - the Errata: "bad copies of good lines".
- *Buys:* deep readings (heights, what is behind walls).
- *Sells:* flat readings: mosaic texts, Flat Accounts, village histories, directions.
- *Teaches:* Survey, Lore.
- *Voice:* 430 Hz (Ess) to 560 Hz (Tee), square, `thin`; high and buzzy: the original Flatlander voice.

**12. The Unlit.** *Ghosts.*
- *At a glance:* the Shade, crypts, barrows, Hour sites · neutral · **0** · liquid: any liquid, poured on the floor ·
  rite: **dark only** (the Pouring) · `U` pale blue (200,220,255), visible only in the dark.
- *Likes:*
  - the Lampless: "they keep us company";
  - the Noon Vigil: "they pray for us".
- *Hates:*
  - the Lantern Moths: "they eat ghost-stuff";
  - the Chandler Houses: "they light everything".
- *Buys:* names of the dead; Locations of tombs; Deep Inscriptions (at double value).
- *Sells:* dark readings: secret rooms, rune meanings, how they died, the Hush Stair.
- *Teaches:* Shadowcraft.
- *Voice:* 205 Hz, triangle, `ghost`; wavering and echoing (Brann's voice).

**13. The Askew.** *Living wrong angles.*
- *At a glance:* the Lattice, the approaches to the Gnomon · aggressive · **−500** · liquid: turnwater · rite: none (they
  can't be kindled) · `A` flickering magenta and cyan.
- *Likes:*
  - the Pleatwood: "fellow folders";
  - the Spore Moot: "it has no corners".
- *Hates:*
  - the Assize: "for being square";
  - the Survey: "for measuring";
  - the Plan: "for its straight lines".
- *Buys:* deep readings of impossible rooms.
- *Sells:* nothing. Talk to a Grey-or-better Askew and it *re-angles* you instead: a random mental mutation, for
  50 × its crease cost in reputation.
- *Teaches:* nothing.
- *Voice:* 300 Hz, triangle, `glide`; the pitch slides on every letter, and the sound swaps between the left and right
  channels.

**14. The Plan.** *A machine faith of automata (section 7.6).*
- *At a glance:* the Metronome (K), the Stacks, Detail C at Benchmark · neutral, but hostile if you damage structures ·
  **−100 for the Bent, +100 for the Plumb** · liquid: glim (as oil) · rite: deep (the Oiling) or flat (present a floor
  plan) · `R` steel (160,180,190).
- *Likes:*
  - the Survey: "accuracy";
  - the Assize: "clear orders";
  - the Horary: "the dials we built together".
- *Hates:*
  - the Rustbacks: "they strip ruins";
  - the Askew: "unbuildable";
  - the Spore Moot: "rot".
- *Buys:* floor plans (a dungeon floor mapped to 90%) and blueprints.
- *Sells:* ruin floor plans; Truing Cradle access.
- *Teaches:* Artificing.
- *Voice:* a fixed pitch per unit (180-260 Hz), square, `beat`.

**15. The Lantern Moths.** *Animals.*
- *At a glance:* wherever lamps burn · docile · **+300** · liquid: glim · rite: deep (the legendary Moon-Wick only) · `m`
  pale yellow (250,240,170).
- *Likes:*
  - you, while your torch is lit;
  - the Chandler Houses.
- *Hates:* the Lampless and the Unlit: "they put the light out".
- *Buys and sells:* nothing, except that the legendary **Moon-Wick** sells the Locations of every glim spring.
- *Teaches:* nothing. Friendly swarms circle your torch in 3D as motes of light, and mob anyone who strikes you in the
  light.
- *Voice:* 700 Hz, sine with tremolo; tiny and fluttering.

**16. The Kites.** *Uplifted birds.*
- *At a glance:* the Tall Table (E), eyries in the Teeth, the Pleatwood canopy · neutral · **−100** (+400 with Wings,
  +250 with a feather cloak) · liquid: fresh water · rite: deep at height (the Ascent) · `v` sky blue (130,170,220).
- *Likes:*
  - the Survey: "they share our view";
  - the Drovers: "scraps".
- *Hates:*
  - the Pressed: "they hate height";
  - the Assize: "they shoot us for sport".
- *Buys:* Locations of high places.
- *Sells:* overlook readings: every span within 6 of an aerie, revealed on the world map.
- *Teaches:* Tumbling.
- *Voice:* 600 Hz, square; shrill, with a sharp attack, rising.

**17. The Clatter.** *Uplifted crab-folk.*
- *At a glance:* the Brine Flats, the shores of the Glass Sea · docile · **+50** (+200 with Shellback) · liquid: brine ·
  rite: deep · `c` coral (230,120,90).
- *Likes:*
  - the Drovers: "trade partners";
  - Hollowmere: "neighbours".
- *Hates:*
  - the Saltbeasts: "brinehogs eat crabs";
  - the Rustbacks.
- *Buys:* curios; Locations along the shore.
- *Sells:* Locations of wrecks; salvage.
- *Teaches:* Hardiness.
- *Voice:* 150 Hz, square, `grit`; clicking, percussive bursts.

**18. The Saltbeasts.** *Wild animals: brinehogs, cairn hounds, ledgehorns, saltrats, dusk bats.*
- *At a glance:* everywhere · aggressive (varies by species) · **−400** (+100 with Horns) · liquid: blood (legendaries
  only) · rite: deep (Herdmothers only) · species glyphs in earth tones.
- *Likes:* the Rustbacks: "they ride us".
- *Hates:*
  - the Drovers: "they herd us";
  - the Clatter: "food".
- *Trades:* a legendary Herdmother will sell her herd's peace. Nothing is taught.
- *Voice:* growls and grunts, with no speech.

**19. The Spore Moot.** *A fungal parliament.*
- *At a glance:* Pleatwood groves, Foldmother's roots, the damp Stacks · neutral (aggressive in their groves) · **−200** ·
  liquid: mulch-wine · rite: dark (the Snuffing: "light dries us") · `F` mauve (190,120,200).
- *Likes:*
  - the Pleatwood: "we feed it, it feeds us";
  - the Unlit: "their patience".
- *Hates:*
  - the Chandler Houses: "they burn things";
  - the Plan: "it is sterile".
- *Buys:* Locations of corpses and ruins.
- *Sells:* recipes; underground routes.
- *Teaches:* Leechcraft (tonics), and offers fungal limbs.
- *Voice:* 95 Hz, sine; soft, wet, low pops.

**20. The Pleatwood.** *Folding trees.*
- *At a glance:* the Pleatwood, the Deep Pleat, Foldmother (P) · docile, but hostile if you cut or burn · **0** · liquid:
  sap · rite: deep, at dusk while they fold · speaking trees are `♣` green (60,140,80).
- *Likes:*
  - the Spore Moot;
  - the Kites: "they nest in us";
  - the Askew: "fellow folders".
- *Hates:*
  - the Assize: "they cut down the Square";
  - the Chandler Houses: "they burn wood for their presses".
- *Buys:* readings of other forests.
- *Sells:* hidden paths (Pleatwood lost chance −75% for a day); Foldmother's fold schedule.
- *Teaches:* Pathcraft (Forest Lore).
- *Voice:* 70 Hz, sawtooth, `stone`; very low, slow and creaking.

**21. The Errata.** *Misprinted doubles.*
- *Who they are.* When something is pressed and then unpressed badly, it comes back reversed: left for right, in
  inverted colours. Every Erratum hates its original.
- *At a glance:* the Glass Sea's shore, the Pressyard's margins, the Tessellate's edges · neutral · **−250** · liquid:
  turnwater · rite: the Mirroring (deep, then flat) · `E` silver (200,200,215).
- *Likes:*
  - the Askew: "they understand angles";
  - the Unlit: "two of everything in the dark".
- *Hates:*
  - the Assize: "they would correct us";
  - the Flatfolk: "they call us smudges";
  - and their own originals, always.
- *Buys:* readings about the Pressyard and about any named creature (each wants to know whose copy it is).
- *Sells:* "mirror" versions of accounts. An Erratum will retell a Deep Inscription as if it were the Flat Account, which
  is false but sells as a flat reading to anyone who hasn't triangulated.
- *Teaches:* Parley (Mirror Talk: your EGO checks may use INT instead).
- *Voice:* 300 Hz, triangle; every letter is played twice, the second time reversed in stereo.

### 6.3 Generated factions

- **Every generated village is its own faction.** It starts at 0, or at +100 if your background comes from its region.
  Its likes and hates come from its history (section 9).
- **Every Hour has a cult.**
  - Each cult starts at **−500**.
  - Its members are drawn from that Hour's favoured factions, and it holds the Hour's sites.
  - Your reputation must be **+600** before you can walk its sites unmolested.
  - Two other things give the same pass: knowing **all three accounts of five of that Hour's events**, which makes the
    cult treat you as a pilgrim; or wearing the Hour's mask (+200).
- **Every named creature gets 1 to 3 personal opinions** from factions, each with a petty reason:
  - *Loved for:* returning a lost claw · sitting with the Unlit all night · counting their dead honestly · relighting the
    commons lamp in a storm · laying a fair mosaic · naming a moth · laughing during an Assize sermon · a moving poem
    about salt.
  - *Hated for:* measuring their chief without asking · stepping on a mosaic in boots · whistling at noon · snuffing a
    lamp at a wedding · questioning the length of the Hand · calling the Gnomon "quite tall" · selling watered glim ·
    barking at the eclipse of 1009.

---

## 7. Religions and philosophies

**General mechanics** (these reuse the existing shrine code):
- Each faith has its own altar. An offering gives a blessing, and a **bold offering** may first demand a trial.
- **Desecrating** an altar costs −100 to −150 with that faith and gains +25 to +50 with its rival.
- **Holy-place trespass:** neutral members turn hostile in their holy places unless you're Warm (≥ +250), or whenever you
  break the place's rule of sight.
- **Every altar names the view it must be honoured in:**

  | Shrine type | Honoured in | Faiths |
  |---|---|---|
  | mosaic shrine | the map view | the Pressed, the Plan, village faiths |
  | relief shrine | 3D, in light | the Horary, the Hour cults, village faiths |
  | rune shrine | the dark (torch out) | the Lampless, village faiths |
  | pillar shrine | 3D, standing 8 or more blocks above the ground | the Noon Vigil's noon-posts, village faiths |

  A prayer made in the wrong view does nothing, and the shrine says so ("The mosaic can't hear you from up there").

### 7.1 The Noon Vigil

- **Beliefs.**
  - Noon gave her shadow to stop the dial, so every shadow is a debt owed to the afternoon.
  - The world must stay at noon. The Cube must be kept and never used.
  - Your use of it is a scandal they will learn to live with.
- **Holy places:** the Temple of Angles (A), 3 noon-posts (pillar shrines, generated), and the floor where Noon lies in the
  Unlit Choir.
- **Practices.**
  - *The Noon Stand:* at world noon, stand still on your own shortest shadow.
  - They give out fresh water, tend the dead, and tell the Keeper's Descent.
- **Conflicts:** the Horary (rival readings of Noon), the Lampless (who worship her shadow), the Assize (who want the Cube).
- **Hooks:**
  - **Pray** at a noon-post, standing on its top (8 or more blocks up), between 11:00 and 13:00. The blessing is one of:
    a full heal; +1 max HP (the first time at each post); curses lifted; or a reading of the current noon length.
  - **Desecrate** a noon-post by pouring umbra on it: Vigil −100, Lampless +50.
  - **Donate:** 50 glim for +10 reputation, up to +200. At Warm, Maren's rest also cures disease.
  - **Rite: the Short Shadow** (needs Warm). For one world day, each Tab rotation made between 11:00 and 13:00 heals 3 HP.
  - **Trespass:** only the Cube's altar.

### 7.2 The Horary

- **Beliefs.**
  - The Hours were divine ages. Time is holy and must move. Noon stole the hour.
  - The Seventh Hour will bring the Afternoon: long shade for the weary, harvest and rest.
- **Holy places:** the Hour-house in Halfnight, 8 dial-steles (relief shrines, each carved with an hour), roadside dials.
- **Practices:**
  - *keeping the hours:* praying at a stele at its carved hour;
  - ringing the Noon Bell;
  - reading Deep Inscriptions aloud;
  - the Chime (preaching).
- **Conflicts:** the Noon Vigil and the Lampless. Its zealots, the **Seventh-Chimers**, quietly serve Vesper and waylay
  travellers on the roads.
- **Hooks:**
  - **Pray** at a dial-stele in 3D, within 1 world hour of its carved hour (you can wait for it). You get a one-day
    blessing from that Hour's domain; Glass, for example, reflects 25% of missiles. At the wrong hour nothing happens.
  - **Desecrate** a stele by chipping its hour off: Horary −150, Noon Vigil +50.
  - **Donate:** each Hour reading you share, +25.
  - **Conversion:** the *Chime*, a Parley power taught at Warm. It recruits a neutral creature by preaching (EGO
    against its WIL).
  - **Trespass:** letting your torch go out inside the Hour-house.

### 7.3 The Lampless

- **Beliefs.**
  - Light drowns out truth. The dead are the world's memory.
  - The Evening (Vesper) will come and let everyone rest. Don't lengthen the day.
- **Holy places:** the Hush (Halfnight), the Unlit Choir (J), 3 generated Hushes (rune shrines), and the rune circles of
  the Shade.
- **Practices:** the Snuffing; vigils without light; reading runes with the fingers; pouring out "the last glim".
- **Conflicts:** the Chandler Houses (a trade war over light), the Lantern Moths, the Horary.
- **Hooks:**
  - **Trespass:** a lit torch in a Lampless holy place. Below Warm, neutral members turn hostile. At Warm or above, they
    ask you once to put it out.
  - **Snuff** a brazier in the Shade: +5 Lampless each, up to +100.
  - **Desecrate** a Hush by lighting it: Lampless −150, Lantern Moths +50.
  - **Donate:** pour glim out at a Hush, +1 reputation per 2 glim (up to +150).
  - **Conversion.** The Bent can learn the mental mutation *Snuff* from them for −200 reputation. The Plumb can earn a
    **dark-pass**, which lets them carry a lit torch through holy places without trespass.

### 7.4 The Rule (the creed of the Plumb Assize)

- **Beliefs.**
  - The world was made plumb, and the Pressing creased it.
  - The Bent are crooked lines, to be *trued* (pressed straight) or struck out.
  - The Seventh Hour will true the world.
- **Holy places:** the Square (M), plumb-stones beside the roads, the Molar checkpoint, any raised Rule-banner.
- **Practices:** truing, measuring, the vow of the level, carrying a plumb-bob.
- **Conflicts:** every Bent village, the Flatfolk, the Askew, the Pressed, the Errata.
- **Hooks:**
  - **Truing.** A Bent character may submit at the Square or at a plumb-stone. You lose one mutation of your choice (no
    refund) for Assize +300. A real, ugly trade.
  - **The vow** (Plumb only): Assize +200, Bent villages −100, 1 true-mark, and the Square's gate opens to you.
  - **Rule-banners** make Trued zones (no jumping; falls hurt double). Knocking one down costs Assize −50.
  - **Trespass:** being Bent inside the Square at any reputation below Bright.
  - **Desecrate** a plumb-stone by toppling it: Assize −100, Bent villages +25.

### 7.5 The Pressed (the Church of the Plane)

- **Beliefs.**
  - Flatness is peace. Nothing can hide in the Plane, so nothing can lie there.
  - The Pressing was grace, and the Flatfolk are saints.
- **Holy places:** Saltpage (O) and the Page, the Pressyard's surface mosaic, and any floor mosaic larger than 9 × 9
  (mosaic shrines).
- **Practices:** lying flat on mosaics; travelling by the map alone; the *half-paint* (one side of the body painted);
  walking pilgrimages.
- **Conflicts:** the Kites, the Plan, and the Assize, who press people as punishment.
- **Hooks:**
  - **Pray:** stand on a large mosaic in the map view for 10 s. You get a reading of what it depicts and 1 hour of
    *Thin* (−25% damage from deep attackers).
  - **Desecrate:** break mosaic tiles by bombing or digging: Pressed −150, the Plan +10.
  - **Rite: the Pressing rite** (at Saltpage, or for −100 reputation). For one world day you may turn flat for 3 s, once
    per floor.
  - **Unpressing** the Pressyard's village (beat 5): Pressed −150.

### 7.6 The Plan

- **Beliefs.**
  - Everything was drawn before it was built. The Deepwrights' master plan is complete and holy.
  - Any deviation is an error, to be repaired "to drawing".
- **Holy places:** the Metronome (K), intact Stacks floors, the Truing Cradles.
- **Practices:** repairing things to specification; keeping the beat; reading floor plans (on the map); the Revision
  rite.
- **Conflicts:** the Askew, the Rustbacks, the Spore Moot.
- **Hooks:**
  - **Desecration:** destroying blocks in the Stacks by bombing or burrowing. The first time draws a warning; after that
    it's −50 Plan per block.
  - **Donate** a full floor plan (map a dungeon floor to 90% and present it to any automaton): +25 each. For the Plumb,
    every 3 floor plans presented also earn 1 true-mark (at most 6 this way, section 10.4).
  - **The Revision rite** (at Warm): submit a revision, a mosaic puzzle solved on the map. Beat 8 uses it.
  - **Recruit** (instead of conversion): automata can be *redrawn* into followers with Artificing, if the Plan's reputation
    with you is at least 0.

### 7.7 Generated faiths

- **The 5 Hour cults** each worship one generated Hour.
  - Their holy places are that Hour's sites.
  - Praying at one of the Hour's steles gives a day's blessing from the Hour's domain.
  - Desecrating one costs −100 with the cult and gains +50 with its hated factions.
- **Every village has a sacred thing and a profane thing** (section 9). Its quest-giver may ask you to *pray at* one or
  *desecrate* the other, in the view the shrine names.

---

## 8. The generated ancient history: the Hours

### 8.1 What they're called, and how many

The ancient god-kings are **the Hours**. Each run generates **five**, from the First Hour (oldest) to the Fifth Hour
(youngest). Each ruled one age of the morning, while the noon Hand shortened.

**Noon is not an Hour.** She was never crowned. Her life is fixed and the same in every run (section 8.6), and it links
the generated history to the main quest. The Rotation Cube has six faces: five carry the seals of the Hours, and the
sixth was blank until Noon turned it ("Noon's Face").

**Each Hour has:**
- a name (Hour phonology, section 2.3), pronouns and a birth year;
- a birthplace in a historical region;
- **1 domain**, gaining 0 to 2 more over their life;
- favoured factions (at least 3, who become the cult) and hated factions;
- cognomens, a profession and a significant colour;
- 2 to 4 relics, each owned or lost;
- **10 to 14 events**, each recording the Hour's age at the time.

**Historical regions.**
- Each period adds 2 to 3 regions. The oldest period's regions hold 6 to 8 places each, shrinking to 2 per region for
  the Fifth Hour.
- Most named places are never built. They exist only to be mentioned, which makes the world feel larger than the map.
- Regions are tied to real parts of the map by age, so their sites can be built:

| Period | Where its sites go | Tiers | Site floors |
|---|---|---|---|
| First | the Lattice (always in an all-Lattice block) and the north-east Stacks | 7-8 | 5 |
| Second | the Stacks and the Deep Pleat | 6-7 | 4 |
| Third | the Shade's edges and the Tessellate | 4-5 | 4 |
| Fourth | the Teeth, the Downs and the Pleatwood | 3-4 | 3 |
| Fifth | the Flats, the Steps, the Waste and the western Downs | 1-3 | 2 |

**Old factions.** Only factions that existed in the morning can be favoured or hated by an Hour:
- the Flatfolk, the Plan, the Kites, the Clatter, the Unlit, the Lantern Moths, the Saltbeasts, the Pleatwood, the Spore
  Moot, the Askew and the Errata;
- ten historical guilds, one per domain: glaziers, salt-rakers, scribes, gravewardens, stair-builders, smelters,
  chandlers, clockmen, folders, herders.

### 8.2 The ten domains

Each domain is a JSON object of fragment lists. The grammar draws on it for almost every line, so an Hour's random events
read like one mythic life.
- A domain's **relic powers** are what its relics do: the theme in the text predicts the loot.
- Its **leaning** decides the floors of its Hour's sites (section 8.7).

| Domain | Leaning | Practices | Weapon words | Omens | Ruin adjectives | Relic powers | Profession, colour |
|---|---|---|---|---|---|---|---|
| **Salt** | none | salting the dead · walking the pans barefoot · reading cracks in the crust · paying tears for salt · sealing oaths with a lick of salt · drying the sea into tablets | brined · crusted · white-edged · salt-rimed · kiln-dried · "a salt-glass maul" | a white rain · the Mere sweet for a day · salt blooming on palace walls · cattle licking a stranger's hands · a crust that rang like a bell · tears that dried into stars | Salted · White · Crusted · Brackish · Bleached · Rimed | +2 WIL · salt-ward: pour a line that ghosts and shades can't cross, 3 a day · immune to poison · never breaks | salt-raker, white |
| **Glass** | deep | grinding lenses · reading reflections · blowing glass on the sea-shore · living in clear houses · burning letters with sun-lenses · veiling mirrors at dusk | glazed · prismatic · shard-edged · clear · lensed · "a glass-toothed saw" | the sea glazing over in a night · two suns in one lens · a mirror that showed the room from above · a pane that would not break · birds striking the sky's glass · rain that rang | Glass · Shard · Clear · Glazed · Mirrored · Splintered | reflects 25% of missiles · see through 1 block of wall for 5 s · +5 to examine · a flash that blinds everything within 6 tiles for 3 s | glazier, pale green |
| **Ink** | flat | tattooing laws on the skin · keeping the census in the floor · inking the shadows of the condemned · drawing maps that came true · writing letters to the Plane · fasting on ink | inked · blotted · lettered · scribed · nib-pointed · "a quill-spear" | words in the dew · a shadow that wrote · the river running black · a map that grew a road · a child born with a page for a palm · the Flatfolk falling silent | Blotted · Inked · Lettered · Smudged · Erased · Illegible | each new floor's map half-drawn on arrival · creatures you hit stay marked on the map · flat beings outlined in 3D · +2 INT | scribe, indigo |
| **Shade** | dark | sleeping through the day · keeping vigil in cellars · speaking with the dead · burying lamps · walking without a shadow · counting in the dark | shaded · gloaming · unlit · dusk-forged · dimmed · "a lampless blade" | the sun failing at noon · lamps refusing to light · the dead singing in a cistern · a shadow walking off alone · black frost · moths dying in a ring | Dusk · Gloaming · Unlit · Dim · Shadowed · Night | see 5 tiles with the torch out · monsters notice you 30% later · see ghosts with the torch lit · heal 1 HP per shade killed | gravewarden, violet |
| **Stairs** | deep | building upward forever · climbing before speaking · sleeping on ledges · jumping a gap to be crowned · counting steps · refusing to go down | tall · high-hafted · stepped · ledge-cut · lofty · "a ladder-glaive" | a stair that grew a step a day · a fall that did not hurt · birds nesting on a crown · the horizon tilting · a child climbing the Hand · a tower grown overnight | High · Stepped · Fallen · Tall · Toppled · Hanging | +1 jump · no fall damage · +50% damage striking from 2+ blocks above · climb 2 blocks on the map | stair-builder, sky blue |
| **Rust** | none | leaving iron in the rain · praising decay · burying swords to age them · eating red earth · letting machines die · staining walls with oxide | rusted · corroded · pitted · red-scaled · oxide-bitten · "a flaking cleaver" | iron weeping red · every automaton stopping at once · red rain · locks opening by themselves · a crown crumbling · a hound made of filings | Rusted · Red · Corroded · Pitted · Crumbled · Oxide | each hit lowers the target's armour by 1 · machines' grabs fail · double damage to automata · your gear never corrodes | smelter, rust red |
| **Wax** | lamp | sealing every door with wax · keeping bees in enemies' skulls · candling the dead · wearing wax masks · dripping vows · feasting on honeycomb | waxed · honeyed · candled · sealed · wick-bound · "a wick-spear" | candles burning downward · bees swarming the throne · a seal that would not break · honey from a well · a statue melting at noon · moths bringing a crown | Waxen · Sealed · Honeyed · Candled · Molten · Hived | torch radius +2 at no glim cost · creatures you strike stick for 1 s · balms heal double · seal a door shut once per floor | chandler, honey |
| **Gears** | beat | setting every law to a beat · marching in step · winding the great clocks · keeping time with the heart · tuning bells · dancing the escapement | geared · toothed · wound · ratcheted · ticking · "a clock-hammer" | every clock stopping at once · a heartbeat in the stone · spike floors rising out of turn · the moon keeping time · a bell ringing thirteen · gears found in a fish | Wound · Toothed · Ticking · Stopped · Geared · Sprung | 10 s of haste on a kill · the beat shows in 3D (the next spikes to rise glow) · every 4th second's strike is a sure crit · enemies within 3 tiles act 15% slower | clockman, brass |
| **Paper** | flat | folding prayers · living in folded houses · pressing flowers · keeping the census as paper birds · letting letters fly · tearing a page at every death | folded · pleated · creased · paper-thin · scored · "a pleated sword thin as a page" | a city folded in half overnight · paper birds flying home · a crease across the sky · flat people standing up · rain falling sideways · the Pleatwood closing at noon | Folded · Creased · Pressed · Torn · Pleated · Crumpled | go flat for 4 s (cooldown 30 s) · cut flat beings in 3D · blink 3 tiles · slip under 1-block gaps | folder, cream |
| **Horn** | deep | wrestling beasts · wearing antlers at court · blowing war-horns at dawn · breeding brinehogs · branding the herd · feasting on marrow | horned · tusked · bone-ridged · antlered · goring · "a tusk-axe" | a herd kneeling · a calf crowned with horns · horns blown under the earth · hounds speaking · ledgehorns coming down from the Teeth · a beast that would not die | Horned · Trampled · Tusked · Bone · Gored · Herded | +2 STR · a sprinting charge knocks the target 2 tiles back · Saltbeasts +200 · hits make the target bleed | herder, bone |

### 8.3 Event types (16) and their effect on state

| # | Event | Variants | State change | Cause rationalised from |
|---|---|---|---|---|
| 1 | **Origin** | heir to the reigning Hour · found pressed in a floor and unpressed as a babe · raised by a faction · born in the dark (found in a crypt) | birth region; possibly a favoured faction | — |
| 2 | **Read the Floor** | reads a mosaic, a relief or a rune | **+1 domain** | a place's domain, or a random one |
| 3 | **Met a People** | befriends a faction | + favoured faction | profession, domain |
| 4 | **Secret Rite** | welcomed / rebuked | + favoured or + hated faction | a domain practice |
| 5 | **Contest of Hours** | ousts the reigning Hour · repels a challenger · is pressed flat (a false death) | crowned / cognomen / false death | favoured factions, profession, domain |
| 6 | **Forged a Relic** | — | **+ relic** with a domain power | domain |
| 7 | **Under a Long Shadow** | — | significant colour; **raises a dial-stele** (a real shrine on the map); cognomen | a domain omen |
| 8 | **Army at the Gate** | liberates / sacks a city | **renames the city**; may crown the Hour | a persecuted favoured faction, or a ban on a practice |
| 9 | **Rampage** | — | +2 hated factions; cognomen; moves region | a grievance from state, invented if missing |
| 10 | **Raised a Dial** | founds a town together with a faction | + place; profession | domain |
| 11 | **Lost at the Caravanserai** | — | **loses a relic** at a place, where it waits | — |
| 12 | **The Field** | wins at a cost / loses | loses a relic; **renames the battlefield** "the [ruin adjective] Field of [place]" | a hated faction |
| 13 | **Pressed and Unpressed** | rescued by a faction · "walked out of a floor N years later" | + favoured faction / false death | — |
| 14 | **Wedding** | to a faction · to an artisan · to their own Erratum | + favoured faction and a relic gift / profession and cognomen / a doubled cognomen and a mirrored floor in one of their sites | a favoured faction, or profession |
| 15 | **Turned the Hand** | climbs the Gnomon's shadow at noon and moves it by a finger | + domain, or crowned; reveals a reading about the noon length | domain |
| 16 | **Death** | natural · pressed · walked into the dark · vanished into the Plane | ends the life; creates the Hour's **mask relic** | — |

**Generation order:**
1. Origin.
2. 8 core events, chosen at random (repeats allowed).
3. Contest, Army or Wedding, if the Hour was never crowned.
4. Region coverage: at least one event in every region of the period.
5. Death. If an earlier event was a false death, a "returned" line follows it.
6. Pad the favoured factions to 3.

**Age.** Append the Hour's age to any event where it was under 16 or over 70 ("She was nine."). Child prodigies and very
old conquerors are the history's best accidents, so the text should point them out.

**Effect first, cause after.** Events are chosen at random, and each event's template then explains itself from the
Hour's state.
- For example: "Acting against #injustice#, Ishvalet led the glaziers against Mereford."
- `#injustice#` looks for a favoured faction ("the persecution of the Clatter") or a domain practice ("a ban on grinding
  lenses").
- If the state has nothing suitable, the event **creates** a favoured faction, and then cites it.

**Era vocabulary.** The First and Second Hours draw their first domain mostly from Shade, Glass, Ink and Paper. The
Fourth and Fifth draw mostly from Salt, Horn, Rust and Wax. The Third mixes them, and Stairs and Gears are shared by all.

### 8.4 Debug and tuning

A debug page (`history-dump.html`) prints 50 generated histories with all their accounts. Tune the weights by reading
them: look for child Hours, Hours who died twice, and relics lost and found, and lean into them.

### 8.5 Three accounts of every event

Every event writes **three accounts**, one for each reading. Each account is a separate reading (section 3.4) and is
found in its own view.

| Account | Medium | Read in | Voice |
|---|---|---|---|
| **The Flat Account** (the plain one) | a floor **mosaic**; the Flatfolk archives | **the map view** only | dry and annalistic. It gives numbers and the age, and never leaves out a defeat. *The Flatfolk can't hide anything behind anything, so they don't.* |
| **The Deep Inscription** (the flattering one) | a carved **relief** on a stele, wall or relic | **3D, in light** (reliefs are height) | capitals and superlatives. Defeats are left out and massacres become gifts ("LAID ITS PEOPLE DOWN IN GLORY") |
| **The Dark Gloss** (the hostile one) | a **rune**, cut by one of the Hour's hated factions or by the event's dead | **the dark** only (torch out) | lower case, broken into lines, bitter or sad |

- **Where they are.**
  - Dial-steles carry all three: a mosaic on the base, a relief up the shaft, a rune on the back.
  - Village murals carry the Flat and Deep accounts, plus a Gloss if one of the village's events was cruel.
  - Engraved goods carry one account each, usually the Deep one.
  - Each Hour-site floor named after an event shows all three.
- **The journal** sorts each Hour's events by date, shows the counts ("7 of 13 events; 15 of 39 accounts"), and flags any
  event whose accounts disagree.
- **Triangulation.** Reading all three accounts of one event marks it **triangulated**. You get 0.15 × one level's XP at
  that tier, and a **hidden fact** comes out of the disagreement: which floor of a site holds a lost relic, a site's exact
  location, or the Hour's true age at death.
- **The cult pass.** Knowing all three accounts of five of an Hour's events makes that Hour's cult treat you as a pilgrim
  in its sites (section 6.3).

### 8.6 Noon (fixed; all three accounts are authored)

| # | Event | Flat Account (map) | Deep Inscription (3D) | Dark Gloss (dark) |
|---|---|---|---|---|
| 1 | Birth | "Born to the bell-founder of the town that is now Halfnight, in the last decade of the Fifth Hour." | "SHE CAME WITH THE BELL'S FIRST NOTE." | "the bell was cracked / so was she / it rang anyway" |
| 2 | The reading | "At nine she read the floor beneath the needle and learned that the afternoon was coming." | "THE FLOOR SPOKE TO HER AND TO NO OTHER." | "she read it wrong / she read it right / both" |
| 3 | The Cube | "She took the Rotation Cube from the Fifth Hour's treasury." | "THE CUBE WAS GIVEN TO HER." | "she asked us first / we said no" |
| 4 | The first afternoon | "When the Fifth Hour died she rang the Noon Bell, and refused the crown they brought her." | "SHE WAS CROWNED BY THE BELL ITSELF." | "she rang it to warn us / we danced" |
| 5 | The turning | "In the third year after, she went down into the Gnomon's works and turned the Cube. The dial stopped." | "SHE HELD THE HOUR IN HER TWO HANDS." | "it was heavy / she is still holding it" |
| 6 | The end | "She was pressed to nothing, and her shadow was nailed across the land." | "SHE ASCENDED INTO THE NOON, WHERE NO SHADOW FALLS." | "she is down there / under the noon / waiting for someone to take a turn" |

### 8.7 How history becomes the world

| What | How it's derived | What the player gets |
|---|---|---|
| **Hour sites** (8) | Fifth Hour: 2, Fourth: 2, Third: 2, Second: 1, First: 1, placed by tier band (section 8.1). Each floor is named after a place from the Hour's events ("the Salted Granary of Mereford") or is a nameless *liminal* floor. Floor levels are the surface level + (floor − 1) | 2 to 5 floors, peopled by the Hour's cult. At the bottom: a relic chest and **true-marks** (the Plumb's implant currency): 1 at tiers 1-2, 2 at 3-4, 3 at 5-6, 3 + 2 at 7, 3 + 3 + 2 at 8 |
| **Site floors by leaning** | Salt: salt-crusted floors and brine. Glass: glass-brick walls you can see through in 3D (they're walls on the map). Ink and Paper: odd floors all-flat (no ledges, every monster flat, fought on the map) and even floors all-deep (chasms and climbs, nothing flat); Paper adds pressed rooms to unpress. Shade: dark floors, ghost planks, rune doors, dark-mapping. Stairs and Horn: climb rooms, drops and knockback ledges. Wax: brazier rooms. Gears: spike gauntlets on one beat. Rust: lever murals and rust oozes | each Hour's sites play differently. **The First-Hour site's bottom floor is inverted:** dark-only things show only in lamplight, ghost planks need your torch *lit*, and flat beings exist only in 3D (the same code with the visibility predicates swapped) |
| **Relics** | Named during events: forged, given at a wedding, won in battle. A relic lost at a place waits at that place's site; the rest lie in the Hour's deepest site | 1 to 4 domain powers; "loved by X" (+400 while worn) or "X-slayer" (−200, and +50% damage against X). Names like "the Rimed Ladle of Who Wept Salt". Three registers each |
| **Hour cults** (5) | Named from the Hour's cognomen plus a word for an order: "the Choir of the Glazier", "the Salted Crown" | enemies in the Hour's sites, starting at −500 |
| **Dial-steles** (8 of the 14 shrines) | Each depicts **one** event in all three accounts, and is carved with an hour | readings; Horary prayer at the right hour; Hour-cult blessings |
| **Renamed places** | When a sacked city or a battlefield lands in a generated ruin or village, the world map uses its historical name | "Ishvalet's Clearing (ruin)": the map itself is history |
| **Engraved goods** | Weapons, armour and urns depicting an event, found as loot and sold in shops | examine one to get its account as a reading |
| **Masks** | One per Hour, created at its death | +200 with the Hour's favoured factions and −200 with its hated ones. Worn reversed, the signs swap |
| **Hour quests** | Learning a reading that names a site or a relic creates *Visit* or *Recover* | a quest pointed at the map; finding the place first completes it |

### 8.8 The legacy (the Seventh Hour ending)

If you end a run with **the Seventh Hour** (section 11.12), the dial turns on through the afternoon and the night, to the
dawn of a new day of the world. You become that world's **First Hour**.
- **What is saved.** The game writes `{ name, background, domain, bestItemName, deeds[3] }` to `localStorage` under
  `gnomon-legacy-v1`.
  - The domain is the one closest to your build: Stairs for a climber, Shade for a dark-walker, and so on.
  - The deeds are your three biggest main-quest choices.
- **What the next run does.** A new run in that browser reads it. If the record is present and valid, the First Hour uses
  your name, domain and deeds, and its relic is named after your best item. Everything else generates normally.
- **Safety.** Every read and write is wrapped in try/catch. When storage is unavailable, blocked, empty or corrupt, the
  next run generates normally and says nothing.

---

## 9. Generated villages

### 9.1 Pipeline

1. **Abstract, at world generation:**
   1. the founding people, chosen by region;
   2. two history events, each with a 1 in 20 chance of leaving the village **abandoned**;
   3. a government derived from that history;
   4. the culture facets;
   5. the cast;
   6. a quest;
   7. the art: mosaics and reliefs of its two events.
2. **Concrete, on first entry:**
   - buildings stamped in the regional architecture (vault-legend format);
   - the commons lamp (or, in the Shade, a "commons dark");
   - a shrine to the sacred thing, of one of the four shrine types;
   - art showing the history: **mosaics** carry the Flat Account and read on the map; **carved lintels** carry the Deep
     Inscription and read in 3D; a cruel event adds a **rune** under the doorstep.

**First-visit reward:** 0.2 × one level's XP at the village's level.

### 9.2 Facets

| Facet | Notes |
|---|---|
| Name | regional phonology (section 2.3), or a renamed place from the history |
| Founding people | by region (below) |
| History | 2 events |
| Government | from the pool below |
| Sacred thing and profane thing | from the pools below |
| Activity | what everyone is doing when you arrive |
| Proverb | from templates, filled with the sacred thing, the profane thing and the activity |
| Dish | learned in the Kindling for −40 reputation; cooked at the village oven for a 1-day buff |
| Skill | one power taught through the Kindling |
| Liquid | the ritual liquid |
| Shrine | mosaic, relief, rune or pillar; decides the view its prayers need |
| Architecture | by biome |
| Cast | the standard roles |
| Quest | one, from the templates below |

### 9.3 Culture pools

**History events (14):**
1. Founded by refugees from a pressed town (one named in the history, if any).
2. Survived a pressing: half the village is a mosaic on the green.
3. Won a feud with a named neighbour.
4. Made a pact with a faction, which now likes it.
5. Drove out the Assize.
6. Saved by a legendary creature that still lives nearby.
7. A glim spring opened, or closed.
8. A child read a stele, and the village keeps an Hour relic.
9. A council formed.
10. Anarchy.
11. A culinary discovery (the origin of the dish).
12. A moth plague.
13. The Shade touched it: one quarter of the village lies in permanent dusk.
14. Everyone with a certain mutation gathered here, and all the villagers share it.

**Governments (8):**
1. a Reeve;
2. a Council of Three: a Flat-speaker, a Deep-speaker and a Dark-speaker;
3. a Moot (voting with stones);
4. a Lampwarden (rule by the keeper of the light);
5. an Abbess of the Dark;
6. a Herdmother (a legendary animal rules, and the villagers interpret);
7. *Drawn* (an automaton runs the village to a plan);
8. Anarchy (the commons lamp decides by lot).

**Sacred things (12):** the commons lamp · a dial-stele · the noon shadow · a drowned bell · the first glimseed · an Hour
relic · the oldest tree · the founders' mosaic · a sleeping ghost · a fallen stone of salt · the village longback ·
silence at dusk.

**Profane things (12):** long shadows · lamps lit after dark · the plumb-bob · ink · standing on mosaics · climbing ·
brinehogs · the Chandlers · mirrors · counting aloud · eating eel · whistling.

**Activities (12):** pressing glimseed · mending eel weirs · sweeping the mosaics · founding bells · raking salt ·
breeding longbacks · grinding lenses · boiling ink · cutting runes · rendering wax · scavenging the Stacks · flying
message-kites.

**Proverb templates (11):**
1. "Who salts the {sacred} sweetens the {profane}."
2. "A short shadow tells no lies; a long one tells them slowly."
3. "Light your lamp from your own wick and you'll never owe the {profane}."
4. "The map is flat, but the {sacred} is deep."
5. "Don't count the {activity} before noon."
6. "Every crease remembers the press."
7. "Sit in the dark long enough and the {sacred} will speak."
8. "A straight road never visits anyone."
9. "The {profane} casts the longest shadow at dusk."
10. "What the floor knows, the feet forget."
11. "Measure twice; the Assize only measures once."

**Dishes (12):** eel fried in glimseed oil · salted reed hearts · brinehog baked in its own salt crust · longback-milk curd
· folded-leaf dumplings · mosaic bread (stamped with the founders) · ink-squid noodles from the Inkrun · honeycomb in
sunwine · ash-baked ledgehorn · spore broth · shore crab boiled in brine (never served to the Clatter) · dusk soup, eaten
cold and in the dark.

**Skills** (one power from one tree): Pathcraft, Survey, Lore, Leechcraft, Artificing, Shadowcraft, Glimcraft, Tumbling,
Hardiness, Parley, Blades, Bludgeon, Axe, Polearm, Missile, Throwing.

**Liquids (10):** glim · fresh water · brine · ink · umbra · sunwine · longback milk · sap · mulch-wine · quicksilver.

**Founding peoples by region:**

| Region | Founding peoples |
|---|---|
| Brine Flats | Bent marshfolk, the Clatter |
| Salt Waste | Drovers, the Pressed |
| Rust Steps | Drovers, Kites, former Rustbacks |
| Downs | Bent farmers, Plumb exiles |
| Pleatwood | Bent families, the Spore Moot |
| Deep Pleat | Bent families, Errata |
| Tessellate | Flatfolk (page-towns), the Pressed |
| the Shade | the Lampless |
| Stacks | Plan automata with scavengers |
| Glass shore | the Clatter, Errata |
| the Teeth | Kites, hermits |

### 9.4 Architecture per region (and how it plays in each view)

| Region | Style | Flat vs deep |
|---|---|---|
| Brine Flats | reed houses on stilts 1 block above the brine, with boardwalks | boardwalks read as floor on the map; the brine is shallow water |
| Salt Waste | domes of salt block, round cisterns | dark inside, so the commons lamp matters; outside, the noon glare |
| Rust Steps | houses cut into a mesa's ledges at 3 or 4 heights, joined by ladders and ramps | **a Flat Lie village**: the map shows one layer, 3D shows four |
| Downs | turf longhouses sunk 1 block into the ground round a barrow | the barrow has a 1-floor crypt |
| Pleatwood / Deep Pleat | folded-bark pods on canopy platforms 6 to 10 blocks up; rope bridges that fold away at dusk | a climbing village; the map can't show which platform is at which height |
| Tessellate | Flatfolk page-towns drawn on the Plane; only the inn for deep visitors is real | the town exists only on the map |
| Stacks | squatted Deepwright floors, several storeys high, round a central lift shaft | falls down the shaft; the map shows one storey at a time |
| the Shade | lampless stone cells with rune doors and no windows | a "commons dark" instead of a commons lamp |
| Glass shore | huts of glass brick | you can see through the walls in 3D; on the map they're walls |
| the Teeth | caves and eyries up a cliff | a vertical climb; the market sits at the top |

### 9.5 Standard roles

- **Leader:** a Reeve, a Council of 3, an Abbess and so on. Leaders get +3 INT, WIL and EGO, and can be kindled.
- **Warden.**
- **Merchant.**
- **Tinker:** repairs, recharges cells, examines artifacts.
- **Leech** (the village healer): heals and sells tonics.
- **Lamplighter:** keeps the commons lamp, sells glim and trades rumours. In the Shade, a **bell-keeper**.
- **One named quest-giver.**
- **2 to 6 villagers.**
- **Abandoned villages** have no cast. Instead they hold a *What Happened Here* puzzle: three clues, one in each view (map,
  3D, dark), which together give the history-event reading.

### 9.6 Generated quest templates (11)

Every quest points at a **specific span**, given as a landmark plus a direction and a distance ("3 spans north-east of
the Tall Table"). The destination's quest item is always placed when its zone is generated, so a player who gets there
first still finds it.

| # | Template | Example | View it needs |
|---|---|---|---|
| 1 | **Recover a lost thing** | "Our {sacred} was carried off to {lair}, 3 spans north-east of the Tall Table." | navigation |
| 2 | **Carry a word** | deliver an item or a message to another village; their reply asks you to choose a side | travel, reputation |
| 3 | **Pray or desecrate** | at a dial-stele, noon-post, Hush or mosaic tied to the village's sacred or profane thing | the shrine's own view |
| 4 | **Read the floor** | read a named mosaic **on the map** and bring back the reading | flat |
| 5 | **Kindle or snuff** | light (torch on) or snuff (torch off) every brazier at a site | light and dark |
| 6 | **Unpress a neighbour** | free a pressed villager from a mosaic by turning views on its centre tile | both views |
| 7 | **Climb to the high thing** | fetch something from a perch reachable only by climbing in 3D | height |
| 8 | **Find the place** | "something lies {n} spans {direction} of {landmark}" | the world map |
| 9 | **Hunt or bond the named beast** | kill a legendary, or kindle with it | politics |
| 10 | **Count** | report how many {ghosts / spike tiles / pillars} there are at {place}. Each can be counted in only one view: ghosts in the dark, spike tiles on the map, pillars in 3D. The answer is also a sellable reading | one view, by subject |
| 11 | **Walk the Shadow** | stand at {place} while the Hand lies on it (the world map shows when), and do its act: turn there, stand 8 blocks up, or keep your torch out for 2 world hours | the Hand |

**Reward:** +100 village reputation, 25 × tier glim, 0.6 × one level's XP, and a choice of 1 of 3 items scaled to the
village's tier (weapons at tier + 1, cells within 2 tiers).

---

## 10. Character origins

### 10.1 Creation steps and modes

1. **Genotype:** Bent or Plumb.
2. **Background:** one of six per genotype.
3. **Attributes,** by point-buy.
4. **Mutations** (Bent) or **a starting implant** (Plumb).
5. **Name.** The generator suggests names from the right culture's phonology.
6. **Mode.** The names are in-world, never the research notes':
   - **One Wick:** permadeath.
   - **Commons Lamp:** a checkpoint is saved whenever you enter or leave a settlement (any village, or the landmarks
     Hollowmere, Benchmark, Molar, Folio, Halfnight, Saltpage, Foldmother and the Tall Table's aerie). When you die, you
     wake at the last one.
   - **Pilgrim:** most factions start at 0 or above (section 3.5), and kills give no XP. Discoveries, quests,
     triangulations and Kindlings give 2.2 × their normal XP instead.
7. **Seed.**

### 10.2 The Flat status (defined once, used everywhere)

A great many things press you flat:
- the press-plates of the Pressyard;
- the Dial-works' sweeping hand;
- press-hounds and burnishers;
- the *Flatwise* mutation, the *plane-shunt* implant and the *Pressing rite*;
- the *fold-sap* tonic and the *hand-press* artifact;
- ink.

Every one of them applies the same status.

**While you are Flat:**
- **You exist only in the Plane.** The view switches to the map, and **Tab is locked** until the status ends.
- **Only flat things touch you.** Flat creatures can see, strike and be struck by you. Deep creatures can't: they lose
  track of you, as if you were a shadow with nobody casting it. Their melee, missiles and splash pass through you.
- **Depth is gone.** The Plane has no height, so:
  - chasms, pits and deep water count as floor, and you cross them as the map draws them;
  - ledges count as floor too, so you can move onto any neighbouring tile up to 2 blocks higher or lower;
  - spikes rise through you harmlessly.
- **Doors.** You slide under closed doors and gates, locked ones included, because a flat thing fits under anything.
  Walls still stop you.
- **What still touches you:** liquids poured onto the floor (ink, brine, quicksilver, whitewater) and flat attacks.
- **What you can do:** you can pick up items (they lie on the floor, which is the Plane) and talk to the Flatfolk without
  turning. You can't use levers, braziers or anything that stands up.

**How it ends.** It lasts its listed duration. Ink, for example, lasts 60 s minus 3 s per TOU modifier point.
- When it ends, you are **set down safely**: on your tile if you can stand there. Otherwise you go to the nearest tile
  within 3 where you can stand, never over a chasm, in water or inside a wall, and never onto a creature. You can't fall
  out of the Plane.
- The Drowned Bellwether's toll and the *unpress lens* end it at once, with the same safe set-down.
- If you die while Flat, the death message says so.

### 10.3 Genotypes

| | **Bent** (mutants: the creased) | **Plumb** (the pure line, from the Levels) |
|---|---|---|
| Fiction | Things that were pressed and let go come back creased, and mutation is a crease. The Bent carry the Pressing in their blood. | Descendants of the Deepwrights who sealed themselves in the Levels while the Pressing happened. They carry no creases. |
| Attributes | base 10 each, 44 points to spend | base 12 each, 38 points to spend |
| Point cost | 1 per +1 up to 18, then 2 per +1; at most 22 in one attribute before the background bonus | the same |
| Build currency | **creases.** 12 at creation, +1 per level. A new mutation costs 4 creases: pick 1 of 3 seeded offers, and one of the three is always a *planar* mutation, one that uses a house rule. +1 mutation level costs 1 crease. A mutation's level is capped at floor(character level / 2) + 1, and at 10. Defects refund 2 to 3 creases | **Grade 2**, plus 1 free starting implant costing ≤ 2. **True-marks** raise the grade: 1 mark per grade up to grade 8, then 2 per grade. Implants are fitted at Truing Cradles (Benchmark, the Metronome, the Square) |
| Tonics | weaker (half effect); 5% chance of a bad reaction | full effect; can overdose |
| Social | Assize starts at −700 | Assize −100; the Plan +100 |
| Counterweight | **Cast** and the **Smoothers** (below) | scarcity: true-marks come only from Hour sites, floor plans and the Assize vow |

**Cast and the Smoothers** (the price of a bright mind).
- **Cast** is the total of your mental mutation levels, including the levels EGO adds.
- **Every Tab rotation creases the Plane.** With a long Cast, a rotation can leave a **wake**:
  - the chance per rotation is max(0, Cast − 10 − 2 × EGO modifier) × 2%, at most 75%;
  - for example, at EGO modifier 0: Cast 12 is 4%, Cast 20 is 20%, Cast 30 is 40%;
  - a rotation made **under the Hand** leaves no wake, because the Gnomon's shadow hides the crease.
- **Wakes count per zone,** and each fades after one world hour.
- **The third wake in one zone calls a Smoother pack.** It arrives 10 s of game time later, along the floor. The HUD warns:
  "The floor smooths itself out towards you."
- **Pack size:** 1 + floor((Cast − 12) / 8), at most 4.
  - At Cast 30 or more, one of them is a **burnisher**, whose hit presses you flat for 3 s.
  - At Cast 45 or more, the pack is led by **the Great Smoother**, a legendary with the Twice-pressed rule.
- **Smoothers are flat beings.** They exist only on the map; in 3D they are shadows that bite. A psychic build has to
  fight its hunters on the map.
- **Reward.** Each pack drops a **smoothed page**: a flat reading the Flatfolk pay +35 for. There is no attribute reward.
- **Who they are.** The Plane's own tidiness: they belong to no faction.

### 10.4 Body, reputation and true-marks

**Your body changes your reputation:**

| Mutation or implant | Reputation change |
|---|---|
| Wings | Kites +400 |
| Shellback | Clatter +200 |
| Horns | Saltbeasts +100 |
| Lampskin | Lantern Moths +200, Lampless −200 |
| Ink Glands | Flatfolk +100 |
| Flatwise | Flatfolk +200, Pressed +100, Assize −200 |
| Gills | Clatter +100 |
| Silk Glands | Kites −100 (webs tangle wings) |
| each implant | the Plan +25 (up to +100) |

**True-marks (the Plumb's licence).**

| Source | True-marks |
|---|---|
| bottom of a Fifth-Hour site (tiers 1-2) | 1 |
| bottom of a Fourth-Hour site (tiers 3-4) | 2 |
| bottom of a Third-Hour site (tiers 4-5) | 2 or 3 (3 at tier 5) |
| bottom of the Second-Hour site (tiers 6-7) | 3 or 5 (5 at tier 7) |
| bottom of the First-Hour site (tier 8) | 8 |
| every 3 full floor plans presented to the Plan | 1 (at most 6 this way) |
| the vow of the level (the Assize) | 1 |

A full run holds about 30 true-marks: 6 take you from grade 2 to grade 8, and the other 24 buy 12 more grades, so
about grade 20.

**Implant rules.**
- **Fitting** takes one world hour (a wait) and costs 25 glim × the implant's grade cost. It's free at the Square for the
  Plumb at Assize ≥ Warm.
- The draughtsmen first trace you on the drafting floor (flat), then fit you (deep).
- **Removing** an implant refunds its grade. Implants marked † are destroyed when removed.

### 10.5 Starting location, the prologue and the starter chain

**Everyone starts in Hollowmere (5, 16).**
- The Bent were born there, or arrived with a caravan.
- The Plumb come down from their Level carrying a letter to Maren.
- On the third night of the shaking, whatever your background, you are in the Temple of Angles when the floor gives way
  beneath the sanctum stair.
- One fixed start keeps the onboarding authored and tight. Variety comes from the seed and the background.

**The starter chain.** Each step teaches one system. The first main-quest beat runs alongside it.

| # | Quest | Giver | Goal | Teaches | Reward |
|---|---|---|---|---|---|
| 0 | **The Turning** (prologue, 2 to 3 min) | — | Map only, inside the temple's flat walls: read the floor's angle mosaic, go down the stair, the floor shakes, touch the Cube, the camera swings down into your eyes | the two views | Tab, for good |
| 1 | **Grubs in the Kettle** | Reeve Hallen | kill the Grub Mother on Kettle Mesa's floor 3, then come home through the culvert | map vs 3D, falling, the loop home | Hollowmere +100, 3 balms, a free Pathcraft power |
| 2 | **Mira's Blank Corner** | Mira | her map of Hollowmere's block has a blank corner: the wreck on the Hollow Mere. Read its deck mosaic on the map, then sprint-jump onto the hull in 3D and look into its hold | reading both views; jumping | a homing pip, 50 glim, and Mira's map (block (1, 5) and its neighbours revealed on the world map) |
| 3 | **Brann's Skull** | Brann (torch out, in the crypt) | Maren unseals the Keeper's Stair's first landing; Brann's skull lies on its floor 2, in the dark | the dark, ghost planks, the legacy dungeon | **Brann's Lantern** (the parent game's relic: with your torch out you heal fast and see a little), the Hush Stair reading, and the Keeper's Stair open below |
| 4 | **The Dial Floor** | Brother Tamsin, Ess and Tee (on the map), or just walking over it | read the mosaic on the map, the relief in 3D and the rim in the dark, then visit the Fifth-Hour site | readings, the three accounts, world-map travel | the site's relic, and your first true-mark (Plumb) or 2 creases (Bent) |

### 10.6 Attributes and combat

**The attribute modifier** is floor((score − 16) / 2).

| Attribute | What it drives |
|---|---|
| **STR** | melee damage above the weapon's requirement (+1 per 2 points, as now); forcing doors and smashing crates; resisting knockback; how far you throw a bomb |
| **AGI** | to-hit; dodge (DV = 6 + modifier + gear); crits (+2% per modifier point); jump distance (+0.1 block per modifier point); aim when throwing |
| **TOU** | HP: TOU + 4 at level 1, then max(1, 3 + modifier) per level, so TOU 16 gives the parent game's 20 and +3; saves against poison and disease; less fall damage; how many tonics you can take at once; how long you stay Flat from ink |
| **INT** | examining artifacts; spotting secret walls (a faint `+` on the map); 4 power offers per level instead of 3 at INT 18+; readings sell for +5% per modifier point |
| **WIL** | ability cooldowns (−5% per point above 16, down to 20% of base); mental armour (MA = 4 + modifier); regeneration; shorter bad effects |
| **EGO** | mental mutation levels (+modifier); prices; Kindling gains (+10% per modifier point); how many followers you can keep; Cast tolerance (section 10.3) |

**Combat** is the same resolution in both views. It keeps the parent game's weapons and armour, and adds a to-hit roll.
- **Choosing the target.** The view only picks it: 3D geometry for a swing or a throw, a bump on the map. Then the same
  roll decides the outcome.
- **To-hit.** d20 + AGI modifier + the weapon's accuracy + bonuses must beat the target's DV.
  - Standing 1 or more blocks above the target gives +1.
  - A natural 1 misses. A natural 20 hits and crits, for double damage. Keen and similar properties widen the crit
    range.
  - A miss shows "miss" in both views.
- **Creatures** roll d20 + floor(level / 3) against your DV. A creature's DV is 5 + floor(level / 4), plus its species
  modifier.
- **Damage** is the weapon's existing range + the material bonus (section 13.1) + floor((STR − requirement) / 2) + its
  enchantment. Then the existing element, crush, burn, executioner and giant-slayer multipliers apply.
- **Armour** soaks a random 0 to AV, as now. AV is the armour value + the material bonus + other bonuses.
- **There is no penetration-dice system.** The existing `MONSTER_TYPES` balance survives. Creatures scale by level as
  creatures do by depth today: +6% HP per level and +1 damage per 4 levels.

### 10.7 Experience and levels

**One level's XP** at level L is **lvlXP(L) = 10L² + 10**, the parent game's curve (20, 50, 100, 170, 260…). Every reward
is a fraction of it, so the numbers stay right at every level.

| Source | XP |
|---|---|
| Killing a creature of level Lc | max(1, round(0.010 × lvlXP(Lc))). Elites × 2.5, legendaries × 10. A creature 2 tiers below your tier gives 25%; 3 or more tiers below, nothing. Only your kills and your followers' count |
| A landmark's first visit | 0.3 × lvlXP(its surface level) |
| A village's first visit | 0.2 × lvlXP(its level) |
| Reaching the bottom of a site (Hour site, lair, ruin) | 0.4 × lvlXP(its top floor's level) |
| A generated village quest | 0.6 × lvlXP(the village's level) |
| Triangulating an event | 0.15 × lvlXP(the account's tier level) |
| A Kindling bond | 0.08 × lvlXP(the creature's level) |
| A main-quest beat | 0.75 × lvlXP(the bottom of the beat's band); × 1.5 if you began the beat below its band (the early bonus) |

**Each level gives:**
- +HP (section 10.6);
- one **power** choice, from 3 offers (4 at INT 18+). Every 5th level is a milestone with a major power among the
  offers;
- +1 crease for the Bent;
- +1 attribute point every 4 levels (at levels 4, 8, 12…).

**Simulated run.** A script plays the main path with 18 creatures per dungeon floor and 8 per surface zone. "Direct" plays
only the beats and the zones on the way. "Typical" also clears one site, one village quest and a triangulation per beat.

| Beat | Band (recommended levels) | Direct: level at start | Typical: level at start |
|---|---|---|---|
| 1 What Shakes the Temple | 1-3 | 1 | 1 |
| 2 The Datum | 3-6 | 3 | 4 |
| 3 The Toll of the Teeth | 6-9 | 7 | 7 |
| 4 Plain Accounts | 9-11 | 9 | 10 |
| 5 The Pressyard | 10-13 | 11 | 13 |
| 6 The Line | 12-15 | 13 | 15 |
| 7 The Unlit Choir | 14-17 | 14 | 17 |
| 8 The Beat | 16-20 | 17 | 20 |
| 9 Benchmark Besieged | 19-22 | 20 | 22 |
| 10 The Square | 20-23 | 21 | 23 |
| 11 The Dial-works | 23+ | 23 | 26 |

The direct path finishes at level 26 and the typical one at 28. On the typical path, kills give 52% of the XP, main-quest
beats 20%, discoveries 13% and side content 16%; on the direct path, kills give 57%. The simulation script is kept with
the bible's working files (`bible/xpsim4.py`), and a `test.html` check reruns it against the live tables.

### 10.8 Powers (skill trees)

There are no skill points. The parent game's perks become **powers** in 16 trees, and each level you pick one of the
offered powers.
- **Opening trees.** Your background opens 2 trees. Teachers open more through the Kindling: −50 reputation for a rank-1
  power, which opens its tree.
- **Offers** are drawn only from open trees, plus the general pool: Tough, Mighty (+2 STR) and the majors.

| Tree | Powers |
|---|---|
| **Blades** | Quick strikes I-II (attacks 20% faster) · Keen eye I-II (+8% crits) · Bleed (short blades bleed for 3 s on a crit) · Riposte (long blades: strike in the 0.2 s before a blow lands, and it's cancelled) |
| **Bludgeon** | Daze (25%: 1 s) · Wallbreaker (smash crates and cracked walls; rank 2 opens secret rooms without bombs) · Crushing (double damage to the brittle) |
| **Axe** | Cleave (a second adjacent enemy takes half) · Disarm (humanoids drop their weapon) · Executioner (+50% against monsters below a quarter of their health) |
| **Polearm** | Long reach (+0.4 reach) · High ground (+50% striking from a ledge above) · Brace (chargers stop on your point) |
| **Missile** | Steady hand (+2 to hit with slings and bolt-bows) · Pin (bolts pin for 2 s) · Glimgunner (the glimgun costs 1 glim per 2 shots) |
| **Throwing** | Knife juggler (thrown knives +2, thrown twice as fast) · Return (discs come back) · Demolitionist (bigger blasts; your own hurt you half as much) |
| **Tumbling** | High jumper (+1 jump; climb 2 blocks on the map) · Fleet-footed (20% faster) · Feather fall (falls never hurt) · Roll (a dodge-roll in 3D) |
| **Shadowcraft** | Stealthy (monsters must be 30% closer to notice you) · Night eyes (with your torch out you see a little) · Dark backstab (× 2 against an unaware target while your torch is out) · Faint runes (runes show faintly with your torch lit) |
| **Glimcraft** | Bright torch (+50% reach, and further for the map) · Thrifty wick (the torch costs half) · Kindle at range (light braziers from 4 tiles) · Oil fire (set glim puddles alight) |
| **Survey** | Cartographer (chasms and pits you see go on the map from either view) · Keen Eye (hidden sites 20%) · Read heights (for 10 s after a look in 3D, map tiles show their height as a digit) |
| **Lore** | Scholar (tell whether an unread scroll is good, neutral or bad) · Hour script (+1 account read per stele) · Gossip (one free rumour per village) · Triangulator (triangulation XP doubled) |
| **Leechcraft** | Alchemist (healing heals 18) · Regeneration I-II (heal 1 HP every 6 s) · Staunch (stop bleeding) · Brew (mix tonics at a village oven) |
| **Artificing** | Repair · Recharge (cells from glim) · Keen fingers (+3 examine) · Mod (one item property per item) |
| **Pathcraft** | Pathfinder (× 1.5 travel) · Terrain lore (−75% lost in one terrain; repeatable, once per terrain) · Homing sense (50% recovery when lost) |
| **Parley** | Haggler (prices a fifth better) · Warm Hands (later Kindlings +20) · Intimidate · Chime (recruit by preaching) |
| **Hardiness** | Tough I-III (+8 max HP) · Iron skin (+1 armour) · Thick blood (poison hurts half as often) · Swimmer (deep water no longer drags you down) |
| **Majors** (milestones only) | Second wind (once per floor a killing blow leaves you on 1 HP) · Lucky (twice the loot) · Folding strike (turning stuns adjacent monsters for 2 s, every 10 s at most) · Giant slayer (+30% against elites, legendaries and Vesper) |

### 10.9 Six Bent backgrounds

| Background | Bonus | Trees | Kit | Starting reputation changes |
|---|---|---|---|---|
| **Reedcutter** | +2 TOU | Axe, Pathcraft | copper hand-axe, reed cloak, 2 balms, 120 glim | Hollowmere +100, Clatter +50 |
| **Moth-tender** | +2 EGO | Glimcraft, Parley | lantern-flail, a spare 200-glim flask, 200 glim | Lantern Moths +200, Chandlers +50, Lampless −100 |
| **Mesa Runner** | +2 AGI | Tumbling, Throwing | 6 throwing knives, a sling, stilt sandals (+0.5 jump), 60 glim | Kites +100, Rustbacks +200 (raised among them) |
| **Drover's Child** | +2 STR | Pathcraft, Parley | copper short sword, a longback bell (one free caravan ride), 180 glim | Drovers +200, Rustbacks −100 |
| **Hush Novice** | +2 WIL | Shadowcraft, Lore | bone dagger, a snuffer, a vial of umbra, 40 glim | Lampless +200, Unlit +100, Horary −100, Lantern Moths −100 |
| **Pressed Pilgrim** | +2 INT | Survey, Lore | ink pots (for the Tracing), a map case, marker chalk (map markers that show as glyphs in 3D), bone staff, 50 glim | Pressed +200, Flatfolk +100, Assize −100 |

### 10.10 Six Plumb backgrounds (two per Level)

Each Level gives its own bonus:
- **Vey** (the Archive): +3 to examine, and you read Deepwright script.
- **Orrum** (the Forge): +1 natural armour.
- **Cassin** (the Lamp): your torch costs half as much glim.

| Background | Bonus | Trees | Kit and free implant | Starting reputation changes |
|---|---|---|---|---|
| **Archivist of Vey** | +3 INT | Lore, Artificing | examining kit (+2), bone stylus, 100 glim; *tally-eye* | Survey +100, Plan +100 |
| **Surveyor of Vey** | +2 INT, +1 AGI | Survey, Missile | the theodolite (artifact), bolt-bow and 20 bolts, map case, 80 glim; *plumb-line ear* | Survey +200 |
| **Forgehand of Orrum** | +3 STR | Bludgeon, Artificing | iron mace, leather armour, 60 glim; *truesteel knuckles* | Plan +150 |
| **Aspirant of the Rule** (Orrum) | +2 STR, +1 TOU | Blades, Parley | iron longsword, chain mail, an Assize writ, 60 glim; *level-eye* | Assize +300 (so it starts at +200), Bent villages −50, Hollowmere −50 |
| **Lamplighter of Cassin** | +3 EGO | Glimcraft, Parley | a glimgun, 250 glim; *lamp crown* | Chandlers +200, Lantern Moths +100, Lampless −100 |
| **Night-warden of Cassin** | +2 WIL, +1 AGI | Shadowcraft, Blades | two copper daggers, a snuffer, 60 glim; *dark lens* | Lampless +100, Unlit +100 |

---

## 11. The main quest: *The Lengthening*

**Structure.**
- Eleven beats climb the tier gradient, each through a fixed landmark.
- Beats 7 and 8 can be done in either order. Every other beat follows the one before it.
- Every beat has at least two routes and one choice that shifts reputation.
- **The early bonus:** a beat begun below its band pays × 1.5 XP (section 10.7).
- **The clock you can see:** the Lengthening advances after beat 5, after the first of beats 7 and 8, and after beat 9
  (section 4.8). It never advances on a timer.

**What the spine avoids.** It deliberately shares none of the reference game's main-quest shape:
- no "bring me any artifact" errand;
- no hub that unlocks rooms as the story goes (Benchmark is complete from the start, and is only besieged);
- no council of your favourite factions;
- no artifact-donation well;
- no tomb, and no climb to the sky: the finale goes *down* into the dial's works.

### 11.1 Beat 1. What Shakes the Temple

- **Where:** Hollowmere (5, 16) and Kettle Mesa (6, 14). Tier 1, band 1-3.
- **Goal:** find what has been shaking the temple floor.
- **Routes:**
  1. Go down Kettle Mesa to floor 3 and find the sapper tunnel.
  2. Put your torch out in the crypt and ask Brann. He heard the digging, and points at the undercroft wall: bomb it to
     find the tunnel's end.
  3. On the map, Ess and Tee read the tunnel as a line of disturbed floor and lead you to it.
- **Reward:** the Assize plumb-seal, and Maren's blessing (+5 max HP).
- **Choice:** give the seal to Mira (Survey +100), or sell it to Pell's Chandler buyer (+120 glim, Chandlers +100,
  Survey −50).

### 11.2 Beat 2. The Datum

- **Where:** Benchmark (11, 12). Tier 2, band 3-6.
- **Goal:** Surveyor-General Quint needs a true reading from the Datum stone to measure the noon Hand.
- **Routes:**
  1. Go down the Datum's 4 floors and read the stone *at its level*.
  2. Pay Detail C to read it (300 glim, or free at Plan ≥ Warm).
  3. A Plumb of Vey reads the Deepwright script and skips floor 3's door puzzle.
- **Reward:**
  - the verdict: "The noon Hand has grown by a finger's width, and most of it this month";
  - the **plumb-bob** (artifact);
  - the Datum's two lower floors and their cache.
- **Choice:** keep the reading inside the Survey (Survey +100), or sell it to the Horary (Horary +150, Survey −100). If
  you sell it, the Seventh-Chimers learn your name, and their road ambushes join the world-map encounter table.

### 11.3 Beat 3. The Toll of the Teeth

- **Where:** Molar (20, 9). Tier 3, band 6-9.
- **Goal:** get east, past the new Assize checkpoint.
- **Routes:**
  1. Pay the Chandler toll and a bribe (200 glim). Plumb characters pass free.
  2. Travel as a caravan hand: kindle with Zaqar Tesfu and sell him 2 readings.
  3. Smuggle yourself through the Root Canals (2 dark floors).
  4. Take the long way round the Teeth's south end (5 to 6 spans of Downs).
  5. Cross the **Hush Stair** at night with your lamp out. You need its reading, from Brann, the Lampless or the Unlit.
- **Reward:** the east opens, and you gain a Drover or Chandler contact.
- **Choice:** hand a smuggler to Assizer Dell-Cassin (Assize +150, Drovers −150), or help a Bent pilgrim family through
  the Canals (Drovers +100, Hollowmere +50, Assize −150).

### 11.4 Beat 4. Plain Accounts

- **Where:** Folio (24, 15). Tier 4, band 9-11.
- **Goal:** get the Flat Account of Noon's last day from Kay of the Long Line.
- **Routes:**
  1. Talk on the map and trade 2 deep readings (Flatfolk +100).
  2. Trace with Kay and ask for it (−40).
  3. Plead before Ell's court on the map: read a mosaic contract aloud and spot its forged tile.
  4. If you can't speak to the Flatfolk (the *Shadowless* defect, or they're hostile), walk into the archive through its
     drawn door on the map and read the floor yourself.
- **Reward:**
  - **Noon's Flat Account**, a key reading. Noon wasn't killed, she was pressed, and her shadow lies in the Shade.
  - The lead: "The pressings have begun again, at the Pressyard."
- **Choice:** warn Folio about the Assize (Flatfolk +100, and their sappers can help at beat 9), or sell the warning to the
  Pressed (Pressed +100, Flatfolk −50).

### 11.5 Beat 5. The Pressyard

- **Where:** the Pressyard (23, 7). Tier 4, band 10-13.
- **Goal:** stop the Press, and learn who restarted it.
- **Routes:**
  1. Fight down 5 floors and break the three pistons.
  2. On floor 3, unpress the captured Survey engineer **Tovi Hallen**, the Reeve's son. He knows the stop sequence: a Rune
     Lever variant.
  3. Show an Assize writ (the Aspirant's own, or one Pell forges for 150 glim) and order the Press "stopped for
     inspection".
- **What you learn:** clear glim is pressed from people, and House Saffre buys it. Press-Master Marr-Orrum answers to
  Hierarch Strade, and Strade answers to "the Evening".
- **Reward:** the **unpress lens**, and the freed captives.
- **Choice 1:** expose House Saffre (Chandlers −300, Hollowmere +100, Lampless +100), or take its silence money (+500
  glim, Chandlers +200). If you take the money, you keep a *Shame* reading worth +60 with anyone who hates the
  Chandlers.
- **Choice 2:** unpress the mosaic village above (Pressed −150, Hollowmere +50; 30 villagers return, and the Errata at its
  margins turn hostile), or leave it pressed (Pressed +100).
- **Then:** the Lengthening, step 1.

### 11.6 Beat 6. The Line

- **Where:** Halfnight (24..26, 11). Tier 4, band 12-15.
- **Goal:** win the Lampless **dark-pass** into the Shade's heart. During the Snuffing, someone lit the Hush, and the city
  is on the edge of riot. Solve **Who Lit the Hush?**
- **The mystery:**
  - *Suspects:* 4, generated from the city's cast: a Horary bell-ringer, a Chandler factor, a Lampless novice and a
    moth-tender.
  - *Clues:* up to 8, made of 4 circumstance clues plus 1 motive clue per suspect. Each is tagged **Faith**, **Trade**,
    **Grief** or **Fear**.
  - *Where the clues are:* spread across all three readings:
    - glim footprints crossing the Line show only on the map;
    - a ghost witness speaks only in the dark;
    - a hidden lamp sits on a ledge you can only reach in 3D;
    - villagers pass on gossip.
  - *Accusing:* you accuse with one circumstance clue and one motive clue that agree. **The accusation becomes the
    truth.** There is no fixed culprit.
- **Routes:**
  1. Investigate and accuse.
  2. Side outright with one faith: bribe or break the Line Court. The other faith turns hostile.
  3. Skip the pass and sneak into the Shade. The Choir's monks will be hostile at beat 7.
- **Reward:** the dark-pass. The city's climate follows the tags of the clues you used:

  | Clue tags | Climate | Effect |
  |---|---|---|
  | Faith and Grief | **Concord** | Horary and Lampless +200 each |
  | mixed | **Uneasy** | both +100 |
  | Trade and Fear | **Riven** | both +50; the ghost market closes |

- **Choice:** the accused's faith loses 150, and the other faith gains 100.

### 11.7 Beat 7. The Unlit Choir (either order with beat 8)

- **Where:** the Unlit Choir (31, 6). Tier 6, band 14-17.
- **Goal:** find what the Lampless keep at the bottom.
- **Routes:**
  1. Go down all 6 dark floors.
  2. At Lampless ≥ Warm, Abbess Wisse leads you down the Quiet Stair, skipping floors 2 to 4.
  3. Pour for **thol**, the ghost choirmaster, and he opens a ghost-plank shaft from floor 1 to floor 5.
- **What Noon tells you.** She is visible only on the map with your torch out. She says:
  - the dial is slipping because Vesper, her shadow, is pulling it;
  - the Assize means to set a new hour hand in the Gnomon and turn the Cube to a Seventh Hour, and the hand is being
    forged at the Metronome;
  - the Gnomon's door opens at noon, to the Plumb Key the Hierarch holds, or to the Cube turned on its threshold.
- **Reward:** **Noon's Face**, the Cube's sixth face, wakes. Each Tab rotation now leaves you untouchable for 1 s
  (cooldown 8 s).
- **Choice:** promise Noon to hold the noon (Vigil +200, Lampless −100), tell the Abbess what Noon said (Lampless +150,
  Vigil −100), or tell no one.

### 11.8 Beat 8. The Beat (either order with beat 7)

- **Where:** the Metronome (37, 13). Tier 6, band 16-20.
- **Goal:** the Plan is forging the new hour hand to the Assize's drawing.
- **Routes:**
  1. **Sabotage.** Climb the Escapement and break the pendulum (Plan −400). The hand is never finished, and the
     Metronome's floors fall still.
  2. **Revise.** On floor 5 the master drawing is a floor mosaic. At Plan ≥ Warm, or by stealth, redraw it on the map by
     flipping 4 tiles (a Mosaic Hall puzzle). The hand is then forged *for you* (Plan +100, and you get the **Hour
     Hand**).
  3. **Argue.** Use the Datum reading from beat 2 to convince Section Nine that the Assize's drawing is wrong (Plan +200).
     The hand is shelved.
- **Reward:** the Hour Hand (route 2), or the Assize goes without one (routes 1 and 3).
- **Then:** the first of beats 7 and 8 to be finished triggers the Lengthening, step 2.

### 11.9 Beat 9. Benchmark Besieged

- **Where:** Benchmark (11, 12). The attackers are levels 19-21; band 19-22.
- **Trigger:** 3 world days after both beats 7 and 8 are done. The HUD counts the days down.
- **Goal:** the Assize and Vesper's longshadows attack the station at dusk to take the Cube.
- **Preparation.** You have 3 world days. Every faction you're Warm with adds a defence, and each defence fights in its
  own view:

  | Faction | Defence | View |
  |---|---|---|
  | Drovers | a wagon wall | 3D cover |
  | the Plan | 2 turrets | both |
  | the Lampless | shades that fight in the doused yard | the dark |
  | the Kites | the attack lanes, drawn on the map in advance | the map |
  | the Flatfolk | sappers on the Plane, who press the siege towers flat so they can be smashed on the map | the map |
  | Hollowmere | militia | both |
  | the Lantern Moths | swarms that drown the longshadows in light | light |

- **Routes:**
  1. Defend against the waves.
  2. Strike first: raid the Assize camp at (13..14, 10) the night before.
  3. Evacuate the Survey to Hollowmere. You lose the station's services until beat 11, but no deaths count against your
     score.
- **Reward:**
  - a score from survivors, whether the Mark stands, and the waves held: Survey +100 to +400;
  - the **Great Theodolite** (relic), which shows the Hand and any hidden sites within 3 spans on the world map, at no
    charge.
- **Choice:** when the archive tower burns, save the archive (Survey +200) or the Bent refugees in the cellar (Hollowmere
  and the Bent villages +200).
- **Then:** the Lengthening, step 3.

### 11.10 Beat 10. The Square

- **Where:** the Square (27, 2). Tier 6, band 20-23.
- **Goal:** take the **Plumb Key** from Hierarch Aurel Strade-Orrum, or break her pact with Vesper.
- **Routes:**
  1. **Assault** all 5 floors.
  2. **Infiltrate:** take the vow (Plumb only), use a forged writ, or free the press-cell prisoners on the map to start a
     riot. Lio leads it.
  3. **Persuade:** confront her with the Pressyard evidence and Noon's Flat Account (an EGO check against 15, or Assize
     ≥ Grey). She breaks with Vesper and comes with you.
  4. **Join her.** This is the Assize alliance, and it opens ending 4.
- **Reward:** the Plumb Key, or Strade as an ally.
- **Choice:**
  - kill the Hierarch: Assize −400, Bent villages +200;
  - spare and convert her: Assize +300, and the patrols stop;
  - join her: Assize +600, Survey −300, Hollowmere −300.

### 11.11 Beat 11. The Dial-works

- **Where:** the Gnomon (37, 3). Tier 8, band 23+.
- **Goal:** walk the Last Mile, about five Lattice zones from (36, 8). Open the door at noon, go down the 8 floors of the
  Dial-works, and face Vesper in the Noon Socket.
- **Ways through the door** (between 11:00 and 13:00; you can wait):
  1. Use the Plumb Key.
  2. Turn the Cube on the threshold. It costs 10 max HP for good.
  3. With Strade as your ally, she opens it.

**Vesper, the Long Shadow** (the final boss, in three phases):
1. **Flat.**
   - Vesper is a long shadow sweeping round the Socket's dial-face like a clock hand.
   - On the map, her line is visible and her next sweep is previewed: stay out of it and strike her tip.
   - In 3D she is a moving darkness you can't touch.
2. **Dark.**
   - She snuffs every light. Put your torch out to see her: a vast ghost.
   - Only brazier-light hurts her, so relight the dial's four braziers (with your torch lit) while she blows them out.
     These are the Gloom Warden's rules.
3. **Deep.**
   - She stands up as tall as the hall: a Colossus.
   - Climb the hour numerals I to V, each a platform one block higher than the last (1 to 5 blocks), until you reach her
     head at 6. Strike there, then turn (Tab) at her head for the killing blow.
   - If you carry the Noonglass, her weak point glows and she takes double damage.

### 11.12 The endings

You choose at the Socket after phase 3.

| Ending | Requires | What you do | What happens |
|---|---|---|---|
| **Hold Noon** | nothing | turn the Cube back to noon | Vesper sleeps, the dial stops again, and the Shade stays. You cast no shadow ever after, and you're carved into the Temple of Angles as Noon's keeper. *The Vigil's ending.* |
| **The Seventh Hour** | the Hour Hand (beat 8) | set the hand and turn the dial forward | The Afternoon begins: long shadows, long rest, pressings at dusk. You rule as the Seventh Hour while the dial turns on through evening and night to the dawn of a new day of the world. **Legacy:** the next world in this browser remembers you as its First Hour (section 8.8). *The Horary's ending.* |
| **Whole Noon** | the Noonglass (the Drowned Lantern), Flatfolk ≥ Warm and Lampless ≥ Warm | focus the noon light through the Noonglass and cast Noon's shadow back onto her | Noon and Vesper become one again, the Shade lifts, and the Plane opens. The last shot shows Ess and Tee standing up in 3D. |
| **The Pressing** | the Assize alliance (beat 10, route 4), or Pressed ≥ Bright | give Vesper the Cube | The noon Hand runs all the way to Hollowmere, and the world is pressed flat. The camera rises out of your eyes back up above, and the run ends in the map view for good, the music flat for good: the opening, reversed. |

**Epilogue.** One page per major faction, plus one for Hollowmere. Each page takes 1 of 3 variants, chosen by your final
band with that faction, and is written in that faction's account: Flat, Deep or Dark.

---

## 12. Bestiary

There are **63 creatures**, grouped by region.
- **Tier** sets the zone level they appear at (section 4.5). Deeper dungeon floors raise it.
- Each line gives the creature's behaviour, and how it uses the map, 3D, the dark, height or flatness.
- Creatures marked *existing* reuse an entry in today's `MONSTER_TYPES`.
- Every creature gets three registers in the game's text (Flat, Deep and Dark lines, section 2.1).

**Glyphs** follow the registry in Appendix 15.7:
- one letter per family (a species template, or one faction's fighters), with members told apart by colour;
- no creature uses a glyph the zone map already uses for terrain or items;
- talkable people are `@` in their faction's colour.

### 12.1 Brine Flats and the Hollow Mere (tiers 1-2)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `r` | saltrat | 1-2 | Saltbeasts | Fast and weak (*existing* rat). Hides in reed tiles, where the map shows it only when it's next to you. |
| `w` | brine-grub | 1-2 | Saltbeasts | Slow burrower. Its tunnel shows on the map as disturbed ground (`;`), so you can track it from above and wait where it will surface. Its legendary is the Grub Mother. |
| `i` | glowfin | 1-3 | none (docile) | Harmless fish that lights deep water at night. Follow it to culverts and sunken caches. |
| `c` | clatterer | 1-2 | Clatter | Crab-folk trader. Moves only diagonally on the map. Its claw deflects 1 thrown knife in 4. |
| `f` | flatling | 1-3 | Flatfolk (feral) | *Existing.* Exists only on the map; in 3D it's a shadow that bites. Strike it on the map, or with a pane-cutter or Noonsilver. |
| `m` | lantern moths | 1+ | Lantern Moths | A swarm that follows your lit torch. Harmless, and it keeps shades at bay. In 3D, motes of light. |
| `p` | brinehog | 1-2 | Saltbeasts | Charges in a straight line and can't turn mid-charge. Sidestep it in 3D; on the map, step diagonally. |
| `U` | drowned keeper | 1-2 | the Unlit | A ghost, seen only with your torch out. Points at something buried. Relight while it's speaking and it shrieks, waking everything within 12 tiles. |

### 12.2 The Rust Steps and the Tall Table (tiers 1-3)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `g` | Rustback scav | 1-3 | Rustbacks | The everyday foe (*existing* goblin). Picks up anything you drop, and flees to its heap below 25% HP. |
| `g` (orange) | Rustback slinger | 2-3 | Rustbacks | Ranged (*existing* goblin archer). Stands on ledges 2+ blocks up that map moves can't reach: climb, throw, or lure it down. |
| `q` | ledgehorn | 2-3 | Saltbeasts | A goat that climbs 2 blocks where other monsters climb 1. Its headbutt knocks you 2 tiles, off ledges. |
| `v` | kite | 2-4 | Kites | Bird-folk, flying at head height. Neutral unless you climb to its nest; then it dives from above and steals a shiny thing to a perch. The map shows the nest, not its height. |
| `x` | ledge spider | 2-3 | Saltbeasts | Strings webs across gaps. A web is a solid bridge in 3D, walkable and burnable, drawn on the map as a thin `-`. |
| `Y` | chaff devil | 2 | none | A whirl of dust that blinds for 3 s. On the map it follows a fixed spiral you can predict. |

### 12.3 The Salt Waste (tiers 1-3)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `I` | salt mirage | 2-3 | none | Exists only in 3D (the reverse of a flat being): on the map nothing is there. Two in three are images; one in three is a mirage-eater whose bites are real. Worst in the noon glare. |
| `u` | longback | 1-3 | Drovers (herd) | A docile salt-camel; hire one for × 1.5 travel. It panics at mirages. |

### 12.4 The Downs and the barrows (tiers 2-4)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `d` | cairn hound | 2-3 | Saltbeasts | Hunts in packs of 3 to 5. A howl wakes every hound within 12 tiles. Flees from fire. |
| `s` | barrow skeleton | 2-4 | the Unlit | *Existing* skeleton: slow, tough, undead. Rises from barrows only at night. |
| `K` (pale) | Assize outrider | 3-4 | Assize | A mounted patrol on the Old Rule. Checks your genotype and attacks the Bent. Rides only in straight lines. |
| `b` | dusk bat | 2-4 | Saltbeasts | *Existing* bat: very fast, erratic, at head height. Drawn to lit torches; put yours out and it loses you. |
| `T` | barrow-troll | 4-5 | none | *Existing* troll. Regenerates unless it's burning. Sleeps in the Teeth's foothills by day. |

### 12.5 Pleatwood, the Deep Pleat and Foldmother (tiers 2-6)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `B` | creasebeetle | 2-4 | Pleatwood | Folds itself when struck: it flips between flat (map only) and deep (3D only) at every hit, so you turn between blows. |
| `x` (green) | pleat spider | 2-4 | Saltbeasts | *Existing* spider, with a poisonous bite. Hides in folded branches. |
| `n` | hangvine | 3-5 | Pleatwood | Drops from the canopy onto anyone passing below. On the map it's an ordinary tree tile; look up in 3D. |
| `j` | sporeling | 3-5 | Spore Moot | *Existing* slime: splits when it dies. Its touch may root a fungal limb on you (Spore Moot reputation). |
| `y` | foldmonkey | 3-4 | Pleatwood | Throws seedpods from 4+ blocks up. Steals 5 glim and climbs away. |
| `P` | paper wasps | 4-6 | Saltbeasts | A swarm that slips flat under doors. Its stings stain you with ink, so enemies see you at double range for 30 s. |
| `F` | moot-walker | 5-6 | Spore Moot | A corpse ridden by fungus. Bursts into a cloud of confusing spores when it dies. |

### 12.6 The Tessellate (tiers 4-5)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `t` | tile mimic | 4-5 | none | A flat predator posing as a mosaic tile, one shade off on the map. It only moves while you're in 3D. |
| `@` (indigo) | Flatfolk wanderer | 4 | Flatfolk | A flat trader. Always gives directions to the Lost (map only). |
| `d` (steel) | press-hound | 4-5 | Assize | Its bite presses you Flat for 3 s. |
| `G` (tiled) | mosaic golem | 5 | the Plan | Assembles out of a mosaic when you step on its eye tile. Brittle: crushing weapons do double. |
| `@` (half white) | pressed pilgrim | 4 | the Pressed | Lies on mosaics and does no harm. Striking one is desecration. |

### 12.7 The Shade and the Unlit Choir (tiers 5-8)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `z` | shade | 5-6 | the Unlit | *Existing.* Sees in the dark. Burns in firelight: 1 damage a second inside your torch radius. |
| `W` | wraith | 5-7 | the Unlit | *Existing* wraith. Floats, sees you just as well with your torch out, and heals by what it drains. |
| `N` | Lampless chanter | 5 | Lampless | Hostile only to a lit torch in a holy place. Its chant snuffs your torch for 10 s. |
| `e` | umbral eel | 5-6 | none | Lives in umbra pools, where only its eyes show. Drags you in, leaving you in darkness for 10 s. |
| `Z` | longshadow | 5-7 | the Unlit (Vesper's) | A shadow with no body that strikes along the ground from 6 tiles away. On the map its reach is a visible line; in 3D only the darkening shows. |
| `W` (cyan) | the Gloam Warden | 6 (mini-boss) | the Unlit | The original Gloom Warden, as a legendary. Exists only in the dark. Braziers hurt it, and it blows them out. |

### 12.8 Halfnight and the Assize (tiers 3-6)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `K` | plumbknight | 5-6 | Assize | Heavily armoured. Charges only along rows and columns: never diagonally on the map, and never turning mid-charge in 3D. |
| `K` (gold) | assizer | 5-6 | Assize | Casts *Overrule*, which suppresses one of your mutations or implants for 20 s. Raises Rule-banners (Trued zones). |
| `H` | chime-priest | 4-5 | Horary | Neutral. On the hour, its aura hastes its allies. Preaches at you (the Chime). |
| `J` | Chandler guard | 4-5 | Chandlers | Carries a glimgun and sets oil puddles alight. |
| `d` (gold) | lamp-hound | 3-5 | Chandlers | Tracks light, not sound: douse your torch and it loses you. It guards the Root Canals. |

### 12.9 The Stacks and the Metronome (tiers 4-7)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `R` | draughtsman | 4-6 | the Plan | Neutral. Walks the blueprint path drawn on the map and repairs any wall you break. Turns hostile if you keep breaking them. |
| `R` (white) | lens sentry | 5-6 | the Plan | A turret firing light beams. It can't see you beyond 6 tiles while your torch is out, and umbra blinds it. |
| `R` (brass) | beat-spider | 5-6 | the Plan | Moves only on the beat, twice a second: predictable on the map, a lurching horror in 3D. |
| `G` | girder golem | 6-7 | the Plan | The *existing* stone golem: slow, armoured, brittle. |
| `g` (dark red) | Rustback brute | 5-6 | Rustbacks | The *existing* orc: a big hitter. Climbs 1 and can't jump, so a 2-block ledge stops it. |
| `j` (red) | rust ooze | 5-6 | none | Each of its hits lowers your weapon's enchantment by 1. Lacquered gear is immune. |
| `C` | the Escapement | 6 (boss) | the Plan | Colossus rules: its core sits on top of its head, and its slams are previewed on the map. |

### 12.10 The Glass Sea's shore and the Drowned Lantern (tiers 4-7)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `c` (pale green) | glass crab | 6 | Clatter (feral) | A reflective shell: thrown items and bolts bounce back. |
| `l` | slag salamander | 6-7 | none | The *existing* salamander. Burns you; weak to frost. |
| `e` (silver) | mirror eel | 6-7 | none | Appears twice on the map, as itself and as its reflection. Only one is real; in 3D the real one glints. |
| `U` (bronze) | the Drowned Bellwether | 7 (legendary) | the Unlit | A bell-headed ghost. Its toll forces every flat thing deep for 3 s, you included if you're Flat. |
| `E` | erratum | 4-7 | Errata | A misprint of the last creature you killed, in reversed colours: it attacks from your left where the original struck from your right. It hates its original. |

### 12.11 The Lattice and the Gnomon (tiers 7-8)

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `A` | Askew angle | 7-8 | Askew | Moves only along diagonals and jumps between grid crossings. On the map, a glyph; in 3D, a shimmer at a wrong angle. |
| `A` (cyan) | fold | 7-8 | Askew | A living crease. Its hit folds you to the mirror-image tile across the zone's centre. |
| `T` (crystal) | lattice troll | 7-8 | none | Made of crystal. Regenerates unless it's burning, and is brittle. |
| `Q` | planar queen | 7-8 | Flatfolk (feral) | The Flat Queen's daughters. Flat, but every 6 s they rise into 3D, and only a 3D blow lands then. |
| `V` | Vesper | 8 (final boss) | the Unlit | See beat 11. |

### 12.12 Anywhere: the Cast hunters

| Glyph | Creature | Tier | Faction | Hook |
|---|---|---|---|---|
| `o` (grey) | smoother | your tier | none (the Plane) | A flat hunter called by wakes (section 10.3). Exists only on the map; in 3D, a shadow that bites. |
| `o` (white) | burnisher | your tier + 1 | none (the Plane) | A smoother whose hit presses you Flat for 3 s. |

The **Keeper's Stair** uses today's monster tables by depth, re-skinned into these families:
- goblin and goblin archer become the Rustback scav and slinger (`g`);
- the orc becomes the Rustback brute (`g`);
- the rest keep their letters.

**Vorlath** keeps `L`, his old glyph.

### 12.13 Legendary templates (11)

**The base rule.** A legendary creature gets:
- a magenta name and an epithet;
- +1 to all attributes, × 2 HP, +3 levels, and × 10 XP;
- 0 to 2 mutations;
- 1 to 3 faction opinions, each with a reason;
- a guaranteed relic or artifact.

Legendaries own lairs, lead Hour cults, run village governments, trade from wanderer camps, or roam.

| Template | Rule | Uses |
|---|---|---|
| **Hourbound** | An Hour cult's leader. Wields one of the Hour's domain powers and carries a relic. A Deep Inscription is carved on its armour (read it in 3D) and a Dark Gloss is cut on its back (read it with your torch out) | Hour sites |
| **Twice-pressed** | Switches between flat and deep every 6 s: the Flat Queen's rule | flat beings, the map |
| **Twice-Seen** | Two bodies on the same tile: a flat one, fought on the map, and a deep one, fought in 3D. Kill both within 10 s of each other, or the survivor restores the other | both views at once |
| **Lampless Saint** | Exists only in the dark. Braziers hurt it, and it snuffs them: the Gloom Warden's rule | the dark |
| **Tall One** | Huge, and only its head can be hurt: climb the platforms around it (up to 5 blocks), as with the Colossus. Its slam rings are previewed on the map | height |
| **Beatkeeper** | Wears a ring of spike fields that rise on its beat | the beat |
| **Glimhoarder** | A legendary merchant with 2 to 4 hired guards. Sells its best item for reputation; its lair is advertised in readings | the economy |
| **Mirrorborn** | Has a mirrored double on the map. Strike the wrong one and the real one heals | the map |
| **Herdmother** | Leads a herd of her species that moves as one. Kindle with her and the whole herd becomes friendly | politics |
| **Long-shadowed** | Its shadow is a second attacker, with the longshadow's rule | the dark and the map |
| **Pleated** | Every 10 s, swaps two 3 × 3 patches of floor. The map previews the crease | the map and height |

### 12.14 Biome overlays (6)

Overlays sit on top of any terrain in three intensities (patch, field and core) across neighbouring zones.
- Each overlay **prefixes** the creatures in it ("ink-spattered ledgehorn") and adds one rule, which multiplies the whole
  bestiary for free.
- Each overlay's core is one of the 82 guaranteed sites.

| Overlay | Terrain effect | Creature effect (patch / field / core) | Core reward |
|---|---|---|---|
| **Spored** | puffballs and blue moss; spore clouds | 25% / 50% / 70% *spore-ridden*: they release confusing spores when they die | a pool of mulch-wine; a fungal relic |
| **Inked** | ink pools; stained walls | *ink-spattered*: after being hit, 50% chance to turn flat for 3 s; they stain you | a pool of **ink of the Plane** (drink it to see flat beings in 3D for 1 hour) |
| **Salted** | salt crust that crunches underfoot | *salt-crusted*: +2 armour, brittle (crushing does double), 10% slower. Ghosts can't enter | a ward-stone: carry it and ghosts can't enter your camp for a night |
| **Rusted** | red scale over everything | *rust-scaled*: their hits corrode your gear (−1 enchantment, 1 hit in 5) | a pot of lacquer (makes one item immune to rust) |
| **Waxen** | candles burning on every ledge; bees | *waxen*: they glow, so you can see them in the dark at any range, and their hits make you stick for 1 s | a sunwine comb and a wax-seal relic |
| **Gloamed** | light radius halved | *gloamed*: they see in the dark. Runes everywhere | a ghost-plank bridge to a hidden cache |

---

## 13. Gear and augmentations

### 13.1 The material ladder

A weapon's material adds to its class's damage (the existing `WEAPONS` ranges), and an armour's material adds to its
armour value.

| Tier | Material | Damage | Armour | Character |
|---|---|---|---|---|
| 1 | **Bone** | −1 | +0 | cheap and light; 1 hit in 50 snaps it |
| 2 | **Copper** | +0 | +0 | soft and green |
| 3 | **Iron** | +1 | +0 | rusts in brine (−1) unless lacquered |
| 4 | **Saltsteel** | +2 | +1 | brine-tempered by the Drovers; never rusts |
| 5 | **Blackglass** | +3 | +1 | Glass Sea razor; a crit against armour 4 or more chips it (−1) |
| 6 | **Truesteel** | +4 | +2 | Deepwright alloy; ignores 1 point of armour; never bends |
| 7 | **Pleatmetal** | +5 | +2 | folded a thousand times; −3 STR requirement; draws as a hairline on the map |
| 8 | **Noonsilver** | +6 | +3 | casts no shadow; **cuts flat beings in 3D**; glows at noon |

The parent game's blessed and cursed enchantments, elements (fire, frost, storm, holy) and properties (keen, swift, long,
vampiric, brutal, crushing, light, of thorns, of warding, of the stars) all stay as they are.

### 13.2 Weapon classes

| Class | Examples | Identity |
|---|---|---|
| Short blade | dagger, knife | the fastest swing (0.3 s); bleeds; × 2 backstab from the dark |
| Long blade | short sword, longsword | parry: strike in the 0.2 s before an enemy's blow lands and the blow is cancelled |
| Cudgel | mace, maul | dazes for 1 s; smashes crates and cracked walls (at Wallbreaker rank 2 it opens secret rooms without bombs) |
| Axe | hand-axe, war axe | cleaves a second adjacent enemy for half damage; disarms humanoids |
| Polearm | spear, glaive | reach 2.7; thrusts; +50% from a ledge above; holds chargers off |
| Great blade | greatsword | slow; knocks the target back 1 tile: off ledges, into chasms |
| Thrown | knives, discs | the existing knives; discs bounce to a second target |
| Sling | sling | free stones on every surface; dazes; arcs over low walls in 3D |
| Bolt-bow | crossbow | long range; pins the target for 2 s; 1 s to reload |
| Glimgun | oil pistol | costs 1 glim a shot; fire damage; lights the target area, which is trespass in Lampless holy places |
| Lantern-flail | a lit lamp on a chain | **is** your torch; double damage to shades and ghosts; each swing sweeps light around you; useless with the torch out |

### 13.3 Armour by body slot

| Slot | Pieces | Specials |
|---|---|---|
| Head | reed hat, copper cap, iron helm, plumb-helm | lamp crown (+2 light); feathered hood (Kites +250) |
| Face | — | spore veil (immune to spores); dark goggles (see 2 tiles with the torch out; cancel the noon glare); salt veil (cancels the noon glare); Hour mask (±200 reputation); examiner's monocle (+3 examine) |
| Body | jerkin 1, chain 2, scale 3, plate 4 | glass-scale 3 (reflects 15% of missiles); pleated coat 2 (STR requirement −3, +1 DV) |
| Back | — | cloak (+10% stealth); pack (+carry); banner (allies +1 damage); kite-glider (no fall damage; glide 4 tiles from a height in 3D) |
| Arms | bracers +1 | buckler (blocks 20%); climbing hooks (climb 2 on the map, grab walls in 3D) |
| Hands | gloves (you never drop your weapon), gauntlets (+1 armour, 1d4 fists) | ink-gloves (place markers that flat followers can see) |
| Feet | sandals, boots +1 | stilt boots (+1 jump); salt-shoes (walk on brine and glass crust without breaking it); grip-soles (no slipping, no knockback) |
| Finger and neck | rings and amulets, as in the existing game | — |

### 13.4 Artifacts

**Cells:**

| Cell | Charge | How it recharges |
|---|---|---|
| **glim cell** | 2,500 | at any tinker, or with 25 glim |
| **sun cell** | 2,500 | +50 a minute on a sunlit surface |
| **dark cell** | 2,500 | +50 a minute while your torch is out |
| **heart cell** | 25,000 | doesn't; found only in Hour sites |

**Examining an artifact.** An unknown artifact shows only a vague name ("a humming tube", "a warm disc"). Roll d20 + INT
modifier + bonuses against 8 + 2 × complexity:
- succeed: it's identified;
- miss by 1 to 5: it's partly known (you learn its class, but can't use it);
- miss by 6 or more: it **breaks**, unless it's *sturdy*.

A tinker identifies one for 10 glim × complexity. The *Readhand* mutation identifies by touch.

| Artifact | Effect | Charge | Complexity |
|---|---|---|---|
| Homing pip | teleports you to the Temple of Angles; no hostile may be within 7 tiles | 2,500 | 1 |
| Programmable pip | can be set once, to any village | 5,000 | 3 |
| Plumb-bob | points to true down and to the nearest unvisited Hour site; marks pits within 3 tiles on the map | none | 1 |
| Theodolite | shows the Hand on the world map, and hidden sites in the adjacent spans | 100 / use | 3 |
| Lantern-mote | a light of radius 6 that follows you, leaving your hands free | 10 / min | 2 |
| Snuffer | darkness in a radius of 6 for 20 s: runes, planks and ghosts appear (and shades take heart) | 200 | 2 |
| Shadow-lamp | casts *dark light*: runes, ghosts and planks show inside its cone even with your torch lit | 10 / s (dark cell) | 5 |
| Pane-cutter | a knife that cuts flat beings in 3D | 10 / hit | 4 |
| Unpress lens | makes a flat being deep for 10 s, so it can be hit in 3D and can't hide in the Plane. Ends your own Flat status at once | 300 | 5 |
| Hand-press | presses a deep creature flat for 6 s: it can fight only on the map, and can't climb | 500 | 5 |
| Echo-bell | draws every surface within 10 tiles onto the map, with or without light | 100 | 2 |
| Bridge-reel | fires a plank bridge up to 6 tiles across a gap; it lasts 60 s | 400 | 4 |
| Featherfall lantern | you fall slowly while you hold it up | 20 / s | 2 |
| Jump-springs | boots: +2 jump | 25 / jump | 3 |
| Glimgun | a fire bolt for 2d6 | 1 glim / shot | 2 |
| Lancet | a beam that pierces a line of 8 tiles for 3d6 | 250 | 5 |
| Force pane | a 3-wide wall of force for 8 s; on the map it's a line that flat beings can't cross either | 400 | 4 |
| Mirror shield | reflects 50% of missiles while raised | 5 / s | 3 |
| Still-dial | everything except you freezes for 3 s | 2,500 | 7 |
| Fold-knife | blinks you 4 tiles the way you face (3D) or to a chosen tile (map) | 300 | 3 |
| Beat-box | silences spike traps and stops beat machines within 6 tiles for 20 s | 500 | 3 |
| Turn-key | opens Deepwright mosaic-locks without the code from the floor | 200 | 2 |
| Kite drone | shows a 15 × 15 area from above, even somewhere you've never been | 300 | 6 |
| Ink-stamp | prints a marker that shows in both views; flat allies can use it as a door | 50 | 1 |
| Quicksilver level | single use: poured out, it runs to the lowest point, showing hidden pits and the true slope | — | 1 |
| Height lens | for 30 s, every map tile shows its height as a digit | 300 | 4 |
| Recall bead | marks a spot; later, teleports you back to it on the same floor | 1,000 | 4 |
| Rotation pip (relic) | a sliver of the Cube: each Tab rotation stuns adjacent enemies for 2 s, at most every 10 s | none | known |
| The Noonglass (relic) | at noon, focuses a beam that unpresses anything and burns shades; makes Vesper's weak point glow; needed for *Whole Noon* | 1 noon / use | known |
| The Great Theodolite (relic) | shows the Hand and hidden sites within 3 spans on the world map | none | known |

### 13.5 Mutations (Bent only)

The number in brackets is the cost in creases. ◆ marks a **planar** mutation: one that uses a house rule. Every offer of
three includes at least one planar mutation (section 10.3).

**Physical (20):**

| Mutation | Hook |
|---|---|
| **Shellback** (3) | +2 armour, +1 more per 3 levels; no body armour; Clatter +200 |
| **Thistlehide** (3) | attackers take 1-3 damage; *Fling* sends quills into all 8 tiles around you |
| **Extra Arms** (4) | a second weapon strikes on (10 + 3 × level)% of your attacks |
| ◆ **Wings** (4) | toggled flight, as with the potion of flying, lasting 20 s + 5 s per level before you glide down; world-map travel × 2; Kites +400 |
| ◆ **Stilt Legs** (2) | +0.5 jump per 2 levels; climb 2 blocks on the map from level 5 |
| ◆ **Gecko Pads** (2) | cling to walls in 3D for 2 s + 0.5 s per level, climbing a block a second |
| ◆ **Lampskin** (2) | you glow (radius 3): free light, but you can never hide in the dark; Moths +200, Lampless −200 |
| ◆ **Night Eyes** (1) | with your torch out you see 3 + level / 2 tiles |
| **Digging Hands** (3) | dig through a block in 1 s, in either view (desecration in the Stacks) |
| **Regeneration** (4) | heal (level) HP every 10 s; stops bleeding |
| **Spare Heart** (3) | +2 TOU; sprints last twice as long |
| **Bellows Throat** (4) | breathe a 3-tile cone of fire for (level)d4; lights braziers |
| ◆ **Ink Glands** (2) | squirt ink: a 3 × 3 cloud of darkness for 8 s, in which runes and planks show even with your torch lit; Flatfolk +100 |
| ◆ **Flatwise** (4) | press yourself Flat for 3 + level / 2 s (cooldown 30 s). Deep attacks pass through you and flat ones don't; you act only on the map, and slide under doors (section 10.2) |
| ◆ **Deep Eyes** (2) | pits and chasms you see from the map count as looked into (marked `:`); see one floor down through holes |
| ◆ **Heavy Bones** (2) | immune to knockback; half fall damage; in deep water you sink and walk the bottom |
| ◆ **Gills** (2) | deep water no longer drops you a floor; you swim at the surface to sunken caches; Clatter +100 |
| **Horns** (3) | a sprinting charge in 3D knocks the target back 2 tiles, off ledges; Saltbeasts +100 |
| ◆ **Silk Glands** (3) | spin a walkable web across a gap of up to 3 + level / 2 tiles, lasting 20 s; webs slow pursuers; Kites −100 |
| ◆ **Echo Throat** (3) | a shout that draws everything within 6 + level tiles onto the map, without any light (cooldown 20 s) |

**Mental (12).** These scale with EGO and add to your Cast.

| Mutation | Hook |
|---|---|
| ◆ **Fold Step** (5) | blink to a tile within 4 + level: where you aim in 3D, or any explored tile on the map. If that tile is really a chasm, you fall |
| ◆ **Overlook** (3) | see a 9 × 9 area from above, anywhere within 20 tiles, for 5 s; it's drawn onto the map |
| ◆ **Shadowsense** (3) | for 10 s, flat beings and ghosts show in every view (cooldown 60 s) |
| ◆ **Kindle** (2) | light a brazier, torch or oil puddle up to 6 tiles away, in either view |
| ◆ **Snuff** (2) | put out every light within 6 tiles, monsters' lamps included; the dark appears and shades rejoice |
| **Endear** (5) | make a creature your follower (EGO against its WIL) |
| **Muddle** (4) | confuse everything in a cone for 3 + level / 2 s |
| ◆ **Force Plane** (3) | raise a pane of force that stops deep and flat beings alike |
| **Time Lag** (4) | enemies within 4 tiles act 30% slower for 6 s |
| ◆ **Foresight** (4) | on the map, see the next 2 spike beats and every monster's next step; in 3D, time slows for 1 s before a blow lands |
| **Backglass** (2) | reflects the next mental attack: Overrule, the Chime or Endear |
| **Readhand** (2) | identify artifacts by touch; reveals the account on any engraved item or relic |

**Defects (8).** The number is the creases refunded.

| Defect | Hook |
|---|---|
| **Lightsick** (+2) | lose 1 HP every 20 s on a sunlit surface unless you wear a hood or veil |
| **Brittle Bones** (+3) | falls of 3 or more blocks hurt; blunt damage +50% |
| **Shadowless** (+3) | flat beings can't perceive you: you can't talk to the Flatfolk (Folio needs another route), but flatlings and Smoothers ignore you too |
| **Moth-kissed** (+2) | moths mob your torch: with it lit, monsters notice you 30% sooner |
| **Sleepwalker** (+2) | each world-map move has a 10% chance of drifting one span off course |
| **Crooked Manner** (+2) | −50 with every faction; your Kindling is a rude gesture, and each one gains 20 less |
| **Beat-deaf** (+3) | the map stops previewing spike beats (the `^` warnings vanish) |
| **Dark-fear** (+3) | with your torch out you're shaken: −2 to hit, −1 DV |

### 13.6 Implants (Plumb only)

- **Where:** at the Truing Cradles in **Benchmark** (D), the **Metronome** (K) and **the Square** (M).
- **Fitting** takes one world hour and costs 25 glim × the implant's cost.
- **Licence:** an implant's cost counts against your grade.
- **Removal** refunds its cost. Implants marked † are destroyed when removed.

| Implant | Slot | Cost | Effect |
|---|---|---|---|
| Level-eye | face | 1 | see creatures' exact HP, armour, DV and weaknesses |
| Tally-eye | face | 1 | see artifact complexity and cell charge; +2 examine |
| Dark lens | face | 2 | see 4 tiles with your torch out; runes show faintly within 2 tiles even with it lit |
| Plumb-line ear | head | 2 | pits and chasms within 6 tiles are marked on the map automatically; immune to the Askew's folds |
| Survey lens | head | 3 | the 3D view fills the map at double range; a minimap in the corner of 3D |
| Lamp crown | head | 2 | +2 torch radius, hands free |
| Plane-shunt | head | 6 | activated: go Flat for 4 s (cooldown 40 s); the Plumb's Flatwise |
| Plate graft | body, back or head | 3 | +1 armour each, up to 3 |
| Bellows lung | body | 2 | sprint +50%; hold your breath for 20 s in deep water |
| Glim heart † | body | 4 | your torch costs nothing; −5 max HP |
| Metronome heart | body | 4 | the beat shows in 3D: the next spikes, presses and sweeping hands glow |
| Jump-back node | body | 3 | activated: teleport to a random explored tile on this floor (cooldown 100 s) |
| Spring tendons | feet | 2 | +1 jump |
| Grip soles | feet | 2 | no slipping or knockback; stand on ledge edges (climb 2 on the map) |
| Truesteel knuckles | hands | 2 | 2d4 crushing fists |
| Gyro wrists | arms | 2 | thrown things fly flat, without dropping, for +2 damage |
| Juggler's arm | arms | 5 | throw every knife you carry at once (up to 4) |
| Balm pump | back | 3 | holds 4 tonics and injects them on triggers (a balm below 40% HP) |
| Folding rack | back | 4 | a second back slot |
| Dial spine † | back | 10 | once per world day, stop time for 5 s. Endgame: a cache on the Dial-works' floor 7 |

### 13.7 Liquids

Each tile holds one dominant liquid, so there is no mixing simulation.

| Liquid | Drink | Touch or pool | Notes |
|---|---|---|---|
| **Glim** | disgusting: 1 damage, and you glow for 10 s | slippery (AGI save); burns for 6 s if lit | money and lamp fuel |
| **Fresh water** | heals 2 | washes off stains; puts out fire | the Noon Vigil's sacrament |
| **Brine** | −1 HP and 3 s of nausea | a poured line of brine (3 tiles) can't be crossed by ghosts or shades | worthless; the Pressed's and the Clatter's sacrament |
| **Ink** | confusion for 5 s, then you are Flat for 60 s − 3 s per TOU modifier | stains you, so enemies see you at double range for 30 s; flat beings use ink pools as shortcuts | the Flatfolk's sacrament |
| **Umbra** (liquid shadow) | night vision for 60 s, then 20 s blind in bright light | a hole of darkness: runes and planks show over it, and torches gutter inside it | the Lampless sacrament |
| **Quicksilver** | poison for 6 s | runs to the lowest point, showing hidden pits and slopes | the Assize's sacrament |
| **Sunwine** | heals 6; two in a row confuse you | sticky (stuck for 1 s) | the Horary's sacrament |
| **Turnwater** | the Bent re-roll one random mutation; for the Plumb, one implant shuts down for a day | poured on a creature, it becomes a random creature of the same tier | rare; the Askew's and the Errata's sacrament |
| **Clear glim** | you see the Plane for 30 min (flat beings visible in 3D); Lampless −100 if they see you drink it | burns twice as long as glim | worth 5 glim a unit; pressed from people |
| **Blood** | nothing good | stains you; draws Saltbeasts | the Rustbacks' sacrament |

### 13.8 Tonics

Tonics are injectors.
- **Limit:** only 1 can be active at a time.
- **Taking another:** you must pass a TOU save (d20 + TOU modifier ≥ 12 + 3 for each extra tonic) or overdose.
- **Bent vs Plumb:** the Bent get half the effect, with a 5% chance of a bad reaction. The Plumb get the full effect.

| Tonic | Effect | Overdose |
|---|---|---|
| **Balm** | heals 12 over 3 s | nausea; no healing for 30 s |
| **Hasp** | haste for 15 s | paralysed for 3 s afterwards |
| **Gloam** | see 6 tiles with the torch out; +30% stealth for 60 s | blind in any light for 20 s |
| **Ironbark** | +2 armour and +2 STR for 60 s | half speed for 20 s |
| **Fold-sap** | you're Flat for 10 s (you fight on the map) | stuck Flat for 60 s |
| **Clearwit** | cures confusion; +5 examine and +2 INT for 60 s | you forget this floor's map (the game's only map-memory eraser) |

---

## 14. How the two views and the dark matter across the whole world

The rule of the house: **the map is for planning, 3D is for the truth, and the dark is for what the light drowns out.**
No view is ever optional. Every layer of the game has something that only one view, the dark, or height can do.

| # | Where | Hook | Uses |
|---|---|---|---|
| 1 | World map | The Gnomon stands on the north-east horizon of every surface zone in 3D, so you steer by it there. On the map it's just a letter. | 3D as a compass |
| 2 | World map | The Hand sweeps the world map every day. Under it, zones dim to dusk: dark-only things show by day, flat beings move twice as fast, and Flatfolk caravans ride it. | flat, dark |
| 3 | World map | The Lengthening: the Shade creeps toward Hollowmere at fixed beats, and you can see it on the world map. | the clock you can see |
| 4 | World map | The Hush Stair crosses the Teeth only at night with your lamp out: ghost planks at world scale. | the dark |
| 5 | Every surface zone | **Bearings from height:** climb 6+ blocks and look around for 2 s to recover when lost. The map can't do it. | height |
| 6 | Salt Waste, Glass shore | **Noon glare:** between 11:00 and 13:00 the 3D view shrinks to 6 tiles, so you cross from the map. Salt mirages exist only in 3D, so there the map is the honest view. | map vs 3D |
| 7 | The Tessellate | You never get lost on it (the land is a map), but every Flatfolk town on it is shadows in 3D. | flat |
| 8 | Hollowmere | You start map-only inside the temple's flat walls until you touch the Cube. The temple mosaic points at the Gnomon, but only from above. | both views |
| 9 | The Dial Floor | The same event three ways: the mosaic on the map, the relief in 3D, the rune in the dark. Triangulate them for a hidden fact. | all three readings |
| 10 | Kettle Mesa | The shaft draws as floor until you've looked into it in 3D. Jumping in drops you exactly one floor, unhurt. | height; the map lies |
| 11 | The Tall Table | There's no route up on the map. You climb in 3D, and one stretch is ghost planks, visible only at night with your torch out. Kite perches show on the map as a nest, never as a height. | height, the dark |
| 12 | The Datum | Doors open when a height mark read in 3D matches a plate number read on the map. | both views, height |
| 13 | The Root Canals, the Unlit Choir, Shade-domain sites | You go torch-out over ghost planks, and **dark-mapping** writes your footsteps onto the map. | the dark, the map |
| 14 | Folio | A town that exists only on the map, with doors that are only drawn. | flat |
| 15 | Halfnight | Light is law: a lit torch on the north side is trespass, and so is darkness in the Hour-house. The mystery's clues are spread over all three readings. | light and dark |
| 16 | The Pressyard | Turn on a pressed room's centre to inflate it. Press-plates flatten you on a beat the map shows. Lowering ceilings take your jump away floor by floor. | flat, the beat, height |
| 17 | The Unlit Choir | Torch on for shades, off for ghosts, planks and runes. Noon is visible only on the map, with your torch out. | the dark plus flat |
| 18 | The Metronome | Every machine moves on one beat, previewed on the map. The boss's weak point is high up. | the beat, height |
| 19 | The Drowned Lantern | The waterline rises by the hour on the map, and what lies under it stays blank there until 3D has seen it. Plan on the map, run in 3D, or wait for noon. | map planning, 3D execution |
| 20 | The Square | Identical rooms, told apart only by their mosaics on the map. Pressed prisoners exist only on the map. Patrols walk straight lines you plot from above. Rule-banners take away depth: no jumping, and falls hurt double. | flat, height |
| 21 | The Dial-works | The sweeping hand presses you flat: a refuge on one floor and a trap on the next. Vesper's three phases are flat, dark and deep, and the killing blow is a turn. | everything |
| 22 | Toppled Stacks | A tower on its side: its old reliefs lie on the floor and read on the map, and its old mosaics stand on the walls and read in 3D. | inverted readings |
| 23 | Hour sites | Ink and Paper sites alternate all-flat and all-deep floors. Glass sites have walls you see through only in 3D. The First Hour's bottom floor inverts the dark. | by domain |
| 24 | The Keeper's Stair | The original game, intact: the Flat Queen's hall, the Gloom Warden, the Colossus, and Vorlath folded into a line that you fight on the map. | legacy |
| 25 | Factions | The Flatfolk exist only on the map, and you Trace with them there. The Unlit exist only in the dark, and you Pour for them there. The Moths follow light. | flat, dark, light |
| 26 | The Kindling | Its three rites are a line on the map, a flame in 3D, and an hour in the dark. The Kites' Ascent needs 8 blocks of height. | all three readings, height |
| 27 | Shrines | Mosaic shrines are honoured on the map, relief shrines in 3D, rune shrines in the dark, and pillar shrines 8 blocks up. | by shrine |
| 28 | Oathbreaking | A Snuffer casts no shadow in 3D for 7 world days, and lamps gutter as they pass. | 3D, light |
| 29 | Readings | Flat, deep and dark readings sell to different factions. The journal flags accounts that disagree. | all three readings |
| 30 | Village quests | *Read the floor*, *Kindle or snuff*, *Unpress a neighbour*, *Climb to the high thing*, *Count* (each subject countable in one view only), *Walk the Shadow*. Steps villages are Flat Lies; glass huts are see-through in 3D. | all |
| 31 | The siege | Each ally fights in its own view: Flatfolk sappers on the map, Lampless shades in the dark yard, Moths in the light. | all |
| 32 | The Flat status | Many things press you flat. While Flat you live on the map, cross chasms as the Plane draws them, and slide under doors; only flat things can touch you. | flat |
| 33 | Cast and the Smoothers | Every turn of a bright mind can leave a wake. Its hunters are flat, so you fight them on the map, and turning under the Hand leaves no wake at all. | flat, the Hand |
| 34 | Plumb licence | Every 3 full floor plans you present to the Plan earn a true-mark: mapping is progression. | the map |
| 35 | Gear | the pane-cutter, Noonsilver, the unpress lens, the hand-press, the shadow-lamp, the echo-bell, the height lens, the kite drone, the theodolite | all |
| 36 | Mutations and implants | Flatwise, Deep Eyes, Echo Throat, Ink Glands, Lampskin, Overlook, Shadowsense, Force Plane, Foresight; the plane-shunt, the plumb-line ear, the metronome heart, the survey lens | all |
| 37 | Creatures | The creasebeetle flips between flat and deep at each hit. The tile mimic moves only while you're in 3D. The mirror eel appears twice on the map. The longshadow's reach shows only on the map. The hangvine shows only when you look up in 3D. The salt mirage exists only in 3D. The Twice-Seen has a body in each view. | all |
| 38 | Music and voice | The flat/deep crossfade stays per view, and each region gets a mood with a flat and a deep version. Halfnight plays two moods: bells on its day side, drones on its night side. The Flatfolk speak thin, and the Lampless echo. In the Dial-works the music keeps the beat. | sound |

---

## 15. Data appendix

These tables are the data to build from. If anything earlier in the bible disagrees with them, they win. All
coordinates are (x, y) on the 42 × 21 world map.

### 15.1 The world map

**Raw rows** (21 rows of exactly 42 characters; one character per span):

```
......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********
......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********
......&&&&&&&&&&&&&^^^&&&&&M&&&&&*********
......&&&&&&&&&&&&&^^^&&&&&:&&&&&&***N****
..O..&&&&&&&P&&&&&&^^^&&&&&:&&&&&&%%%%****
.....&&&&&&&&&&&&&"^^^&&&&&:&&&&%%%%******
.....&&&&&&&&&&&&&"^^^+++++:++%J%%##******
....====&&&&&&&&&&"^^^+I+++:%%%%#####*****
....========;;;;;""^^^+++++:%%######:*****
..======E===;;;;;"::F::++%%:%"+#####:#####
..==========;;;;;":^^^:%%%%:+"+#####:#####
..=========;;;;;"":^^^::HHH::::::::::#####
..========:D:::::::^^^+++++++"+:####:#####
..=======::;;;;"";;^^^+++++++~~:~~##:K####
..====C=::=;##;";;;^^^++++++~~~:~~~#######
..,,,B,::,,;;;"";;;;^^++G++~~~~:~~~~######
..,,,A::,,,;;;";;;;;^^+++++~~~~L~~~~######
..,,,,,,,,,;;"";;;;;;;+++++~~~~~~~~#######
...,~~~,,,,;;";;;;;;;;++++++~~~~~~########
...,,,,,,,,;;";;;;;;;;+++++++~~~~#########
...,,,,,,,,;;";;;;;;;;+++++++++###########
```

**Legend:**

| Glyph | Terrain id | Count |
|---|---|---|
| `,` | `flats` (Brine Flats) | 42 |
| `.` | `waste` (Salt Waste) | 73 |
| `=` | `steps` (Rust Steps) | 61 |
| `;` | `downs` (the Downs) | 85 |
| `&` | `pleatwood` when x ≤ 18 (101), `deepPleat` when x ≥ 21 (65) | 166 |
| `+` | `tessellate` (the Tessellate) | 78 |
| `#` | `stacks` (the Stacks) | 109 |
| `%` | `shade` (the Shade) | 24 |
| `*` | `lattice` (the Lattice) | 60 |
| `^` | `teeth` (the Teeth) | 44 |
| `~` | `sea` (the Glass Sea; the Hollow Mere at (4..6, 18)) | 47 |
| `"` | `river` (the Slake, the Inkrun) | 23 |
| `:` | `road` | 52 |
| `A`-`P` | landmarks (Halfnight is `HHH`) | 18 |
| | **total** | **882** |

**As code** (single-quoted, because the river glyph is `"`):

```js
export const WORLD_ROWS = [
  '......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********', // 0
  '......&&&&&&&&&&&&&^^&&&&&&&&&&&&*********', // 1
  '......&&&&&&&&&&&&&^^^&&&&&M&&&&&*********', // 2
  '......&&&&&&&&&&&&&^^^&&&&&:&&&&&&***N****', // 3
  '..O..&&&&&&&P&&&&&&^^^&&&&&:&&&&&&%%%%****', // 4
  '.....&&&&&&&&&&&&&"^^^&&&&&:&&&&%%%%******', // 5
  '.....&&&&&&&&&&&&&"^^^+++++:++%J%%##******', // 6
  '....====&&&&&&&&&&"^^^+I+++:%%%%#####*****', // 7
  '....========;;;;;""^^^+++++:%%######:*****', // 8
  '..======E===;;;;;"::F::++%%:%"+#####:#####', // 9
  '..==========;;;;;":^^^:%%%%:+"+#####:#####', // 10
  '..=========;;;;;"":^^^::HHH::::::::::#####', // 11
  '..========:D:::::::^^^+++++++"+:####:#####', // 12
  '..=======::;;;;"";;^^^+++++++~~:~~##:K####', // 13
  '..====C=::=;##;";;;^^^++++++~~~:~~~#######', // 14
  '..,,,B,::,,;;;"";;;;^^++G++~~~~:~~~~######', // 15
  '..,,,A::,,,;;;";;;;;^^+++++~~~~L~~~~######', // 16
  '..,,,,,,,,,;;"";;;;;;;+++++~~~~~~~~#######', // 17
  '...,~~~,,,,;;";;;;;;;;++++++~~~~~~########', // 18
  '...,,,,,,,,;;";;;;;;;;+++++++~~~~#########', // 19
  '...,,,,,,,,;;";;;;;;;;+++++++++###########', // 20
];
export const TIER_ROWS = [
  '333333333334444444455555555566666778888888', // 0
  '333333333333344444455455555556666777888888', // 1
  '333333333333333444455545555655666777888888', // 2
  '333333333333333344455544555555666677888888', // 3
  '333333333333333334455544555555566677788888', // 4
  '333222223333333333455544455555567777788888', // 5
  '222222222223333333355544445555667766778888', // 6
  '222222222222333333345544445566666666678888', // 7
  '222222222222233333345544445566556666678888', // 8
  '222222222222223333333444455565555666667777', // 9
  '222222222222222333344545555555555666666777', // 10
  '222111112222222233344444444555555666666777', // 11
  '221111111222222233344444444455555666666777', // 12
  '211111111122222233344444444456656766666777', // 13
  '111111111112222223344444444466656776666777', // 14
  '111111111112222223334444444566656777666777', // 15
  '111111111112222223334444444566676777666777', // 16
  '111111111112222223333344444566666776666777', // 17
  '111122211112222223333344444466666766666777', // 18
  '211111111122222233333344444456666666666777', // 19
  '221111111222222233333344444455555666666777', // 20
];
```

**Checks done for this document** (by script):
- every row is 42 characters wide, and there are 21 rows;
- every landmark letter sits at its listed coordinate;
- the terrain counts match the legend;
- the tier grid equals the formula (section 4.5) with the landmark overrides, at all 882 spans;
- every road and river path below is 4-connected and lies on its own glyphs;
- the paths cover all 52 road spans and all 23 river spans.

### 15.2 Terrain data

| Glyph | id | Hours | Lost | Tier range | Enter | Tier mod | Palette (RGB) | Villages |
|---|---|---|---|---|---|---|---|---|
| `,` | flats | 6 | 5% | 1-2 | map | 0 | [214,208,190] [104,128,84] [70,112,124] | 1 |
| `.` | waste | 14 | 15% | 1-3 | map | 0 | [236,234,226] [214,206,190] [182,174,162] | 1 |
| `=` | steps | 8 | 8% | 1-2 | map | 0 | [168,84,52] [204,124,76] [118,60,44] | 2 |
| `;` | downs | 6 | 4% | 2-3 | map | 0 | [128,152,88] [162,172,104] [108,118,78] | 2 |
| `&` (x ≤ 18) | pleatwood | 12 | 12% | 2-4 | map | 0 | [52,96,64] [86,130,74] [38,58,44] | 2 |
| `&` (x ≥ 21) | deepPleat | 14 | 14% | 4-6 | map | 0 | [42,77,51] [69,104,59] [30,46,35] | 1 |
| `+` | tessellate | 4 | 0% | 4-5 | map | 0 | [190,172,142] [196,64,52] [60,92,172] [222,190,82] | 2 |
| `#` | stacks | 10 | 10% | 5-7 (Old Cuts (12..13, 14): 2) | map | 0 | [120,120,132] [90,92,102] [152,142,122] | 2 |
| `%` | shade | 12 | 20% | 5-8 | map | +1 | [40,36,56] [24,22,34] [72,62,92] | 1 |
| `*` | lattice | — | — | 7-8 | walk-in (the map drops you in) | +1 | [182,222,232] [122,162,202] [232,242,250] | 0 |
| `^` | teeth | — | — | 4-5 | walk-in only (the Hush Stair at night) | +1 | [112,102,98] [142,132,122] [204,204,210] | 1 |
| `~` | sea | — | — | Glass Sea 5-7, Mere 2 | never | +1 | Glass [96,152,160] [152,202,206]; Mere [70,112,124] | 1 (on a shore span) |
| `"` | river | 12 | 6% | 2-5 | map | 0 | Slake [82,132,150]; Inkrun [22,22,32] | 0 |
| `:` | road | 3 | 0% | 1-6 (as the land) | map | 0 | [172,162,142] | 0 |

The village quotas total 16.

**Spawn keys** (creature ids by terrain; tiers in section 12):
- **flats:** saltrat, brineGrub, glowfin, clatterer, flatling, lanternMoths, brinehog, drownedKeeper.
- **waste:** chaffDevil, brinehog, saltMirage, longback, rustbackScav.
- **steps:** rustbackScav, rustbackSlinger, ledgehorn, kite, ledgeSpider.
- **downs:** cairnHound, barrowSkeleton, assizeOutrider, duskBat, brinehog, barrowTroll.
- **pleatwood:** creasebeetle, pleatSpider, hangvine, sporeling, foldmonkey.
- **deepPleat:** paperWasps, mootWalker, creasebeetle, hangvine.
- **tessellate:** tileMimic, flatfolkWanderer, pressHound, mosaicGolem, pressedPilgrim, erratum.
- **stacks:** draughtsman, lensSentry, beatSpider, girderGolem, rustbackBrute, rustOoze.
- **shade:** shade, wraith, lamplessChanter, umbralEel, longshadow.
- **lattice:** askewAngle, fold, latticeTroll, planarQueen.
- **teeth:** kite, ledgehorn, barrowTroll.
- **sea shore:** glassCrab, slagSalamander, mirrorEel, erratum.
- **river:** glowfin, sporeling, umbralEel (the Inkrun only).

### 15.3 Landmarks

| Letter | id | Name | x | y | Kind | Tier | Surface level | Dungeon: floors and levels | Gimmick key | Beats |
|---|---|---|---|---|---|---|---|---|---|---|
| A | hollowmere | Hollowmere | 5 | 16 | startVillage | 1 | 2 | sanctum (no floors); `keepersStair` 20 floors, levels 2-21 (optional) | flatTemple | prologue, S1-S3, beat 1 |
| B | dialFloor | The Dial Floor | 5 | 15 | stele | 1 | 2 | — | threeAccounts | S4 |
| C | kettleMesa | Kettle Mesa | 6 | 14 | dungeon | 1 | 2 | 3: 2, 3, 4 | shaftDrop | S1, beat 1 |
| D | benchmark | Benchmark | 11 | 12 | hub | 2 | 5 | `datum` 4: 5, 6, 7, 8 (3-4 open at beat 2) | trueLevel | 2, 9 |
| E | tallTable | The Tall Table | 8 | 9 | aerie | 2 | 5 | — (a 3D climb, 12 blocks) | climbUp | optional |
| F | molar | Molar | 20 | 9 | passTown | 3 | 8 | `rootCanals` 2: 8, 9 | borrowedDark + darkMapping | 3 |
| G | folio | Folio | 24 | 15 | flatTown | 4 | 11 | — | mapOnlyTown | 4 |
| H | halfnight | Halfnight | 24, 25, 26 | 11 | holyCity | 4 | 11 | — | lightIsLaw + mystery | 6 |
| I | pressyard | The Pressyard | 23 | 7 | dungeon | 4 | 11 | `press` 5: 11, 12, 13, 14, 15 (headroom 6, 5, 4, 3, then the tall hall) | pressing + loweringCeiling | 5 |
| J | unlitChoir | The Unlit Choir | 31 | 6 | dungeon | 6 | 17 | 6: 15, 16, 17, 18, 19, 20 | theDark + darkMapping | 7 |
| K | metronome | The Metronome | 37 | 13 | dungeon | 6 | 17 | 6: 17, 18, 19, 20, 21, 22 | oneBeat | 8 |
| L | drownedLantern | The Drowned Lantern | 31 | 16 | dungeon | 7 | 20 | 5: 20, 21, 22, 23, 24 | tideOfHours | optional (ending 3) |
| M | square | The Square | 27 | 2 | citadel | 6 | 17 | 5: down 19, 20, 21; up 22, 23 | identicalRooms + ruleBanners | 10 |
| N | gnomon | The Gnomon | 37 | 3 | needle | 8 | 23 | `dialWorks` 8 (down): 23-30 | sweepingHand | 11 |
| O | saltpage | Saltpage | 2 | 4 | monastery | 3 | 8 | `underPage` 3: 8, 9, 10 | answerInFloor | optional (ending 4) |
| P | foldmother | Foldmother | 12 | 4 | treeVillage | 3 | 8 | `rootfold` 3: 8, 9, 10 (day and night layouts) | twoLayouts | optional |

The Unlit Choir's upper floors are gentler than the Shade outside them (levels 15-16 under a level-17 surface), because
the Lampless keep them. Every other dungeon starts at or above its surface level.

**Other fixed points:**

| Point | Where |
|---|---|
| the Last Milestone | (36, 8) |
| Slakebridge | (16, 12) |
| Inkbridge | (29, 11) |
| the Molar pass | (19..21, 9) |
| the Hush Stair (dark crossing) | (19, 4), (20, 4), (21, 4) |
| the Assize camp (beat 9) | (13..14, 10) |
| the Hollow Mere | (4..6, 18) |
| the Old Cuts (tier-2 Stacks) | (12, 14), (13, 14) |
| the exempt all-sea block | block (9, 5): x 27..29, y 15..17 |

### 15.4 Factions

| id | Name | Parent | Home | Demeanor | Start (Bent / Plumb) | Liquid | Rite | Glyph | RGB | Voice (Hz, wave, flags) |
|---|---|---|---|---|---|---|---|---|---|---|
| hollowmere | Hollowmere | peoples | A | docile | +100 / +100 | glim | deep | `@` | 120,170,110 | 255 triangle |
| noonVigil | the Noon Vigil | faiths | A, noon-posts, H (west) | docile | +50 / +50 | freshWater | deep | `@` | 240,220,150 | 270 triangle |
| survey | the Survey | peoples | D, Downs towers | neutral | 0 / 0 | freshWater | deep or flat | `@` | 200,170,90 | 300 square, beat |
| assize | the Plumb Assize | peoples | M, F, roads | aggressive | −700 / −100 | quicksilver | deep | `K` | 150,170,200 | 120 square |
| horary | the Horary | faiths | H (west), dial-steles | neutral | 0 / 0 | sunwine | deep, at the stele's hour | `H` | 230,170,60 | 420 triangle, vibrato |
| pressed | the Pressed | faiths | O, the Tessellate | docile | −50 / −50 | brine | flat | `@` | 220,220,230 | 150 sine |
| lampless | the Lampless | faiths | H (east), J, Hushes | neutral | −100 / −100 | umbra | dark | `N` | 110,90,150 | 110 sine, ghost |
| drovers | the Salt Drovers | peoples | F, Steps and Waste roads | neutral | 0 / 0 | longbackMilk | deep | `@` | 220,150,60 | 165 sawtooth |
| chandlers | the Chandler Houses | peoples | F, H (middle), banks | neutral | −50 / −50 | clearGlim | deep | `J` | 250,210,90 | 330 square |
| rustbacks | the Rustbacks | peoples | Steps, Downs, Stacks edges | aggressive | −450 / −450 | blood | deep | `g` | 180,90,50 | 130 sawtooth, grit |
| flatfolk | the Flatfolk | plane | G, the Tessellate | docile | 0 / 0 | ink | flat only | `@` (feral: `f`) | 90,110,200 | 430-560 square, thin |
| unlit | the Unlit | dark | the Shade, crypts, sites | neutral | 0 / 0 | any (poured) | dark only | `U` | 200,220,255 | 205 triangle, ghost |
| askew | the Askew | askew | the Lattice | aggressive | −500 / −500 | turnwater | none | `A` | 220,80,220 / 80,220,230 (flicker) | 300 triangle, glide |
| plan | the Plan | engines | K, the Stacks | neutral | −100 / +100 | glim | deep or flat | `R` | 160,180,190 | 180-260 square, beat |
| moths | the Lantern Moths | beasts | wherever lamps burn | docile | +300 / +300 | glim | deep (Moon-Wick only) | `m` | 250,240,170 | 700 sine, tremolo |
| kites | the Kites | beasts | E, Teeth eyries | neutral | −100 / −100 | freshWater | deep, 8+ blocks up | `v` | 130,170,220 | 600 square |
| clatter | the Clatter | beasts | Flats, Glass shore | docile | +50 / +50 | brine | deep | `c` | 230,120,90 | 150 square, grit |
| saltbeasts | the Saltbeasts | beasts | everywhere | aggressive | −400 / −400 | blood | deep (Herdmothers only) | by species | earth tones | growls (no speech) |
| sporeMoot | the Spore Moot | growths | Pleatwood groves, P | neutral | −200 / −200 | mulchWine | dark | `F` | 190,120,200 | 95 sine |
| pleatwood | the Pleatwood | growths | Pleatwood, Deep Pleat, P | docile | 0 / 0 | sap | deep, at dusk | `♣` | 60,140,80 | 70 sawtooth, stone |
| errata | the Errata | plane | Glass shore, I, Tessellate edges | neutral | −250 / −250 | turnwater | deep, then flat | `E` | 200,200,215 | 300 triangle, doubled |

**Relations** (used by the AI: a member of a faction attacks members of the factions it hates, if it can perceive them,
and assists the factions it likes):

| Faction | Likes | Hates |
|---|---|---|
| hollowmere | noonVigil, clatter, survey | rustbacks, assize |
| noonVigil | hollowmere, flatfolk | lampless, horary, assize |
| survey | flatfolk, plan, kites | rustbacks, askew |
| assize | plan, chandlers, horary | the Bent (by genotype), flatfolk, askew, rustbacks, errata |
| horary | the Hour cults, kites, plan | lampless, noonVigil |
| pressed | flatfolk, unlit | kites, plan, assize |
| lampless | unlit, pressed | moths, chandlers, horary |
| drovers | clatter, chandlers, kites | rustbacks, assize |
| chandlers | assize, moths, drovers | lampless, rustbacks |
| rustbacks | saltbeasts | drovers, plan, survey |
| flatfolk | survey, pressed, noonVigil | assize, askew, errata |
| unlit | lampless, noonVigil | moths, chandlers |
| askew | pleatwood, sporeMoot | assize, survey, plan |
| plan | survey, assize, horary | rustbacks, askew, sporeMoot |
| moths | chandlers, any lit torch | lampless, unlit |
| kites | survey, drovers | pressed, assize |
| clatter | drovers, hollowmere | saltbeasts, rustbacks |
| saltbeasts | rustbacks | drovers, clatter |
| sporeMoot | pleatwood, unlit | chandlers, plan |
| pleatwood | sporeMoot, kites, askew | assize, chandlers |
| errata | askew, unlit | assize, flatfolk |

**Perception rules for faction fights.** These follow the house rules:
- A flat creature and a deep creature can't perceive each other unless one of them is the player.
- A ghost (the Unlit) can be perceived only by creatures that see in the dark.

The Plane and the dark are things only the player crosses.

### 15.5 Paths, the Lengthening and blocks

Every path is 4-connected, and was checked against the map.

| Path | Tiles, in order |
|---|---|
| **oldRule** (41 spans) | (5,16) (6,16) (7,16) (7,15) (8,15) (8,14) (9,14) (9,13) (10,13) (10,12) (11,12) (12,12) (13,12) (14,12) (15,12) (16,12) (17,12) (18,12) (18,11) (18,10) (18,9) (19,9) (20,9) (21,9) (22,9) (22,10) (22,11) (23,11) (24,11) (25,11) (26,11) (27,11) (28,11) (29,11) (30,11) (31,11) (32,11) (33,11) (34,11) (35,11) (36,11) |
| **oldRuleNorth** (to the Last Milestone) | (36,11) (36,10) (36,9) (36,8) |
| **oldRuleSouth** (to the Metronome) | (36,11) (36,12) (36,13) (37,13) |
| **straightCut** | (27,2) (27,3) (27,4) (27,5) (27,6) (27,7) (27,8) (27,9) (27,10) (27,11) |
| **glassCauseway** | (31,11) (31,12) (31,13) (31,14) (31,15) (31,16) |
| **slake** (river) | (18,5) (18,6) (18,7) (18,8) (17,8) (17,9) (17,10) (17,11) (16,11) (16,12) = Slakebridge, (16,13) (15,13) (15,14) (15,15) (14,15) (14,16) (14,17) (13,17) (13,18) (13,19) (13,20) |
| **inkrun** (river) | (29,9) (29,10) (29,11) = Inkbridge, (29,12) (29,13) (into the Glass Sea) |

**The Lengthening** (section 4.8):

| Step | Trigger | N | Spans that turn to Shade |
|---|---|---|---|
| 1 | after beat 5 | 17.5 | (22,10) road, (21,10) Teeth |
| 2 | after the first of beats 7 and 8 | 19.5 | (20,11) Teeth, (19,11) Teeth |
| 3 | after beat 9 | 21.5 | (18,11) road, (18,12) road |

Roads stay roads (3 hours, 0% lost). Teeth stay walk-in only.

**Blocks** (section 4.10):
- **Landmark blocks:** (9,0) (0,1) (4,1) (12,1) (7,2) (10,2) (2,3) (6,3) (8,3) (2,4) (3,4) (12,4) (1,5) (8,5) (10,5).
- **Exempt block:** (9,5).
- **All-Lattice, walk-in blocks:** (11,0) (12,0) (13,0) (13,1) (13,2).
- **Single-span block:** (11,5), whose site goes at (35,17).
- **Two-span block:** (10,4), whose site goes at (30,12) or (32,12).

### 15.6 Constants

| Group | Constant | Value |
|---|---|---|
| Clock | world hour | 60 s of game time (both views) |
| | day / dusk / night / dawn | 06-18 / 18-19 / 19-05 / 05-06 |
| | noon window | 11:00-13:00 |
| | the run's start | 1 Dawnhand 1012 LN, 06:00 |
| | wait (Z) | to dawn, noon, dusk, midnight, healed, or N hours. Needs no hostile within 12 tiles with a path to you. Snuffs the lamp unless you choose otherwise |
| Lamp | torch drain | 1 glim per 4 world hours lit in darkness (underground, the Shade, surface night); free by day |
| | empty purse | a 1-tile flicker |
| | glim loot per dungeon floor | 10 + 4 × tier in total; monsters drop 1-3 glim 20% of the time; elites drop 3 × tier |
| | commons lamp | 5 glim a day free; then −25 village reputation per 5 glim |
| | purse (flask) | 200 / 500 / 1,000; Chandler bank fee 5% per deposit |
| Prices | buy | value × (1.5 − 0.1 × EGO modifier − step) |
| | sell | value × (0.3 + 0.05 × EGO modifier + step / 2) |
| | reputation step | Warm +0.1, Bright +0.2, Cold −0.1 |
| Reputation | scale and bands | −1000..+1000; Dark ≤ −600; Cold −599..−250; Grey −249..+249; Warm +250..+599; Bright ≥ +600 |
| Kindling | bond | loves +80, likes +40, dislikes −40, hates −80; in the creature's own reading +40; with its sacrament +20 |
| | menu | reading +35, rumour +60, ask for a reading −40, power −50 / −100 / −150, dish −40, recruit −(150 + 15 × level gap) (at least 60), best item −(value / 5) (at least 10) |
| | limits | cap +120 net per creature; 2 Kindled followers (3 at EGO 20+); gains +10% per EGO modifier point; Warm Hands +20 |
| | oathbreaking | −120 with every faction. The Snuffer mark: Moths to −600, torch radius −1 for good, and for 7 world days no shadow in 3D and prices +20% |
| Levels | surface zone level | 3 × tier − 1 |
| | tier of a level | ceil((level + 1) / 3), capped at 8 (players and zones alike) |
| | the warning | entering a span 2+ tiers above yours asks for confirmation |
| XP | one level's XP | lvlXP(L) = 10L² + 10 |
| | kill | max(1, round(0.010 × lvlXP(creature level))); elite × 2.5; legendary × 10; 2 tiers below you 25%; 3+ tiers below 0 |
| | rewards (× lvlXP) | landmark 0.3; village 0.2; site bottom 0.4; village quest 0.6; triangulation 0.15; Kindling bond 0.08; beat 0.75 (× 1.5 if begun below its band) |
| | Pilgrim mode | kills 0; every other source × 2.2 |
| | per level | HP max(1, 3 + TOU modifier); one power (3 offers; 4 at INT 18+; a major every 5th level); Bent +1 crease; +1 attribute point at every 4th level |
| Travel | night | +25% hours (not on roads); lost chance × 2 |
| | lost mitigation | terrain lore −75%; compass-ring −5 points; flying −10 points; road 0 |
| | recovery | road or visited zone: at once; new zone 25% (50% with Pathcraft); ask for directions; height +30% (once per zone); the Gnomon in sight +10% |
| | hidden sites | 10% per undiscovered site per move (20% with Keen Eye) |
| | the Hand's caravans | 25% per move onto a span under the Hand |
| | noon glare | 3D view 6 tiles in the Waste and on the Glass shore, 11:00-13:00 |
| The Hand | origin, angle, length | (37, 3); θ = 25° + 11° × (h − 12), from due west toward south; L = N × (1 + \|h − 12\| / 3) spans, capped at 40; a span is under the Hand within 0.5 spans of the ray; 06:00-18:00 only |
| | noon length N | 15.5 at the start; +2 per Lengthening step; at 34.5 it reaches the Hollow Mere (6, 18) |
| Cast | wake chance per rotation | max(0, Cast − 10 − 2 × EGO modifier) × 2%, at most 75%; none under the Hand |
| | wakes | counted per zone; each fades after 1 world hour; the 3rd calls a pack 10 s later |
| | pack | 1 + floor((Cast − 12) / 8) smoothers, at most 4; a burnisher at Cast 30+; led by the Great Smoother at Cast 45+ |
| Combat | to-hit | d20 + AGI modifier + accuracy + bonuses > DV; a natural 1 misses; a natural 20 crits for × 2; high ground +1 |
| | DV | player 6 + AGI modifier + gear; creature 5 + floor(level / 4) + species |
| | creature to-hit | d20 + floor(level / 3) |
| | damage and soak | weapon range + material + floor((STR − requirement) / 2) + enchantment; armour soaks 0..AV at random |
| | creature scaling | +6% HP per level; +1 damage per 4 levels |
| Attributes | modifier | floor((score − 16) / 2) |
| | HP | TOU + 4 at level 1 |
| | point-buy | Bent: base 10 + 44 points; Plumb: base 12 + 38 points; 1 per +1 to 18, then 2; at most 22 at creation |
| Creases (Bent) | economy | 12 at creation, +1 per level; a new mutation 4 (pick 1 of 3, one of them planar); +1 level 1; cap floor(level / 2) + 1, at most 10; defects refund 2-3 |
| Grade (Plumb) | economy | start at grade 2 + 1 free implant (cost ≤ 2); 1 true-mark per grade up to 8, then 2; fitting takes 1 world hour and costs 25 glim × cost |
| Flat | status | map view forced, Tab locked; chasms, pits and deep water count as floor; ledges up to 2 blocks crossed; slide under doors; spikes harmless; set down safely within 3 tiles when it ends; ink lasts 60 s − 3 s × TOU modifier |
| Heights | limits | surface: standable ≤ 12 blocks above ground, scenery ≤ 14; dungeons: platforms ≤ 5 blocks above the floor (rooms top out at z = 8); anything taller is a billboard |

### 15.7 Glyph registry (zone map)

**Reserved for terrain, items and features.** Creatures may not use these:

| Glyph | Use |
|---|---|
| `@` | you, and talkable people (in their faction's colour) |
| `#` `.` `:` `~` `=` | wall · floor · known chasm or pit · water · bridge (rings share `=`, told apart by colour) |
| `+` `\|` `&` `>` `<` | door · gate · lever · stairs down · stairs up |
| `!` `?` `/` `0` `%` | potion · scroll · throwing knife · bomb · poison gas |
| `)` `[` `"` `k` `h` | weapon · armour · amulet · key · heart crystal |
| `S` `$` `*` `†` `█` | strength crystal · glim (it was gold; it keeps the colour) · your marker · shrine · floor mosaic |
| `▲` `^` `,` `■` `Ω` | spikes up · spikes next · spikes down · the Cube · the Speaking Door |
| **new** `;` | disturbed ground (a burrower's tunnel) |
| **new** `-` | a web, or an Assize patrol trace |
| **new** `°` | a nest or perch (its height is never shown) |

**Creature families.** There is one letter per family, members are told apart by colour, and each (glyph, colour) pair is
unique.

| Glyph | Family | Glyph | Family | Glyph | Family |
|---|---|---|---|---|---|
| `r` | rats | `w` | grubs | `i` | small fish |
| `c` | crabs | `f` | feral flat beings | `m` | moths |
| `p` | pigs | `U` | the Unlit (ghosts) | `g` | Rustbacks |
| `q` | goats | `v` | Kites | `x` | spiders |
| `Y` | whirlwinds | `I` | mirages | `u` | longbacks |
| `d` | hounds | `s` | skeletons | `K` | the Assize |
| `b` | bats | `T` | trolls | `B` | beetles |
| `n` | hanging plants | `j` | slimes and oozes | `y` | monkeys |
| `P` | wasps | `F` | fungal walkers | `t` | mimics |
| `G` | golems | `z` | shades | `W` | wraiths |
| `N` | the Lampless | `e` | eels | `Z` | longshadows |
| `H` | the Horary | `J` | the Chandlers | `R` | the Plan's automata |
| `C` | colossi | `l` | salamanders | `E` | Errata |
| `A` | the Askew | `Q` | planar queens | `V` | Vesper |
| `o` | Smoothers | `L` | Vorlath | `♣` | speaking trees |

- **Free for later content:** `a`, `D`, `M`, `O`, `X`.
- **The parent game's letters** survive in their families: `r b g x f s j W T l G z Q C L`. Goblin archers and orcs move
  into the Rustback family (`g`), which frees `a` and `o`.
- **The world map** has its own glyph set (section 15.1) on its own screen, so its letters never collide with zone
  glyphs.

### 15.8 `test.html` assertions (new)

1. `WORLD_ROWS` has 21 rows of 42 characters, all of them legend glyphs.
2. Every landmark letter sits at its coordinate, including Halfnight's three spans.
3. The terrain counts equal section 15.1's, and `TIER_ROWS` equals the formula with the overrides.
4. Every path in 15.5 is 4-connected and lies on its glyphs, and together they cover the road and river spans exactly.
5. Every non-exempt, non-landmark block holds exactly one guaranteed site. No site sits on a road or landmark span, at
   least 1 free span lies between any two sites, and every site can be reached on foot.
6. `validateSurface` passes for 200 random zones per terrain: ports connected, no standable block above 12, and
   landmarks and sites reachable.
7. Dungeon floor levels match 15.3, and every floor's tier follows from its level.
8. The glyph registry holds: no creature glyph is reserved, no letter maps to two families, and (glyph, colour) pairs are
   unique.
9. The Hand at 12:00 with N = 15.5 covers (23, 10), and a noon length of 34.5 reaches (6, 18) but 33 does not.
10. The legacy: with `localStorage` throwing, empty, or holding garbage, a new run generates normally.
11. The XP simulation reproduces the table in 10.7, to within ±1 level per beat.
12. A banned-word scan finds none of Appendix 15.11 in any content string, or in 10,000 generated names.
13. Every Kindling rite can be completed only in its own view: the Tracing on the map, the Lighting in 3D, the Snuffing
    in the dark.

### 15.9 Text budget and scope guards

**The game's authored text** (about 15,000 words):

| Area | Words |
|---|---|
| Landmark descriptions (3 registers each) and NPC dialogue (16 landmarks, about 35 named NPCs) | 4,000 |
| Main quest (11 beats), the mystery and the endings | 2,500 |
| The starter chain and Hollowmere | 800 |
| Faction and faith lines (greetings, Kindling words, trespass warnings) | 1,200 |
| History grammar (10 domains × 5 lists; 16 events × 3 accounts; Noon's 18 lines) | 2,400 |
| Village pools and quest templates | 1,000 |
| Items, artifacts, mutations, implants, liquids and tonics (about 160 × 12 words); relics in 3 registers | 2,000 |
| The bestiary (63 creatures in 3 short registers, about 20 words each) | 1,300 |
| World-map tile lines, rumours, death messages | 600 |
| **Total** | **about 15,800** |

**Scope guards** (deliberately left out, to stay dense and playable):
- No thirst or hunger: light is the only survival clock, and an empty purse only gutters the torch.
- No limb-by-limb bodies or dismemberment: slots are a list of parts plus implant sockets.
- No temperature simulation: *burning*, *slow* (chill) and *wet* are simple statuses.
- No liquid mixing: one dominant liquid per tile.
- No penetration dice: the parent game's damage and soak, plus a d20 to-hit roll.
- Two progression tracks, not three: powers each level, and mutations or implants.
- One start village, 16 landmarks, 21 fixed factions, 6 faiths, 16 villages, one systemic mystery and 4 endings.
- Full description registers for landmarks, creatures and relics only.
- Nothing on the world map exists only as a list entry: every procedural site is one of the 82 block sites, and every one
  can be entered.

### 15.10 How the judges' must-fix items and grafts were resolved

**Must-fix items:**

| # | Must-fix | Resolution | Where |
|---|---|---|---|
| 1 | The starter raiders copy another game's hyena-folk | The raiders are the **Rustbacks**: Bent scrap-clans whose crease grows iron, who "remember" by taking. No hyena-folk, and no dog-folk. | 6 #10, 12.2 |
| 2 | The psychic counterweight copies the reference game's formula, trigger and tiered hunters | **Cast and the Smoothers.** The trigger is *turning* (Tab). Wakes accumulate per zone. The hunters are flat and fought on the map, and none appear under the Hand. There are no bird-named tiers and no attribute reward. | 10.3 |
| 3 | The bonding ritual's trade numbers are copied | Re-tuned (80/40 bond; +35 reading, +60 rumour, −40 ask; cap +120; oathbreaking −120). The **three view rites** (Tracing, Lighting, Snuffing) are now the core, with +40 for using the creature's own reading. | 3.3 |
| 4 | The main-quest skeleton transcribes the reference game's | No any-artifact errand, no growing hub, no council of factions, no donation well, no tomb and no sky-climb. Noon was never crowned. Only a disguised siege and the generated rulers are kept. | 11 (preface), 8.1 |
| 5 | The run modes keep the reference game's names | **One Wick**, **Commons Lamp**, **Pilgrim**. | 10.1 |
| 6 | "A noon that lasts a thousand years" contradicts day and night; the Shade's direction; an Earth weekday | The Long Noon is an *age*: the noon length of the Gnomon's shadow is the hour hand of ages, and days pass normally. The noon sun stands in the north-east over the Gnomon, so the noon shadow and the Shade both point west-south-west, at Hollowmere. "Tuesday" is now "a span". | 1.3, 2.2 |
| 7 | The accounts conflate deep and dark | Flat Account = mosaic (map); Deep Inscription = relief (3D in light); Dark Gloss = rune (torch out). | 8.5 |
| 8 | Frustrating gimmicks; four map-memory erasers | No mirrored 3D, forced turns or gusts. The only map-memory eraser is the Clearwit overdose. | 13.8 |
| 9 | Registers triple the text | Full registers only for landmarks, creatures and relics; the budget is about 15,800 words. | 2.1, 15.9 |
| 10 | No systemic mystery; the parent game's cast is unused | *Who Lit the Hush?*. Maren, Pell, Mira, Corwin, Rook, Lio, Brann (his skull), Ess and Tee, Ell (the Flat Queen, a person now), the Speaking Door and Vorlath all return. | 11.6, 1.8 |
| 11 | The world-scale ghost crossing and the lamp on the world map must agree | The Hush Stair opens only at night with your lamp out, and the lamp toggles and burns on the world map by the same rule as in zones. | 4.7, 3.2 |
| 12 | Thirst is punitive | There is no thirst. | 3.2 |
| 13 | Name collisions across the drafts | Settled in the table below. | 15.10 |
| 14 | The legacy needs a try/catch | Every read and write is wrapped, and a run with no storage generates normally. A test asserts it. | 8.8, 15.8 |
| 15 | Height limits | Surface: ≤ 12 standable, ≤ 14 scenery. Dungeons: ≤ 5. The Gnomon and Foldmother's crown are billboards; the horizon plane and haze are budgeted. | 4.11, 4.12 |
| 16 | "Most people can never read flat" contradicts the map-only prologue | Everyone reads flat. Only a Turner can *stand in* the flat reading, and the Temple of Angles forces flat sight inside its walls. | 1.4 |
| 17 | A glyph registry, with a test | Reserved glyphs, one letter per family, unique (glyph, colour) pairs; the flatling keeps the parent game's `f`. | 15.7, 15.8 |
| 18 | The player's flat state is undefined | One Flat status: forced map, Tab locked, chasms and water as floor, slide under doors, safe set-down. | 10.2 |
| 19 | The XP economy is copied and untested | Every reward is a fraction of the parent game's level curve, checked by a simulated run. | 10.7 |
| 20 | Keep the parent game's combat model | d20 + AGI against DV in both views, then the existing damage ranges, material bonus and random soak. No penetration dice. | 10.6 |
| 21 | One world clock, and a way to wait | 60 s per world hour; **Z** waits until an hour; every time gate can be reached by waiting. | 4.6 |
| 22 | Map and text fixes | Lengthened Teeth stay walk-in. (18, 12) is "seven spans east of Benchmark". The Straight Cut runs along x = 27 through the Deep Pleat and down the Shade's edge. The Lattice blocks and block (11, 5) are confirmed. | 4.7, 4.8, 4.10 |
| 23 | The faithful draft's infeasible gimmicks; its tier formula | The lowering ceilings stop at 3 blocks (no knee camera, no 1-block floor). The sideways tower became the Toppled Stack, whose map shows the true layout. The drowned floors use the waterline-as-chasm rule (no underwater swimming). The tilted floors, the plan that disagrees with its voxels, and the turning rooms are dropped. Every dungeon lists explicit floor levels. | 5 I, 4.10, 5 L, 15.3 |
| 24 | The faithful draft's data errors | Its map and counts are not reused. | — |
| 25 | Lamp-money: a torchless descent, a soft-lock, the loot rate | No fume-floor dungeon. An empty purse leaves a 1-tile flicker, and dark-mapping keeps torch-out floors navigable. Glim loot per floor is stated. | 3.2, 5 F, 5 J |
| 26 | Scope ceiling | The dense draft's scope guards are kept and tightened. | 15.9 |
| 27 | Surface zone seams | World-coordinate noise, per-edge ports and `validateSurface`. | 4.11 |

**Grafts:**
- **From the fold draft:**
  - the house-rules-as-laws table;
  - the three-sight accounts and triangulation;
  - view-specific bonding rites and altars;
  - dark-mapping;
  - the *Count* quest;
  - the Twice-Seen template;
  - world-scale ghost planks (the Hush Stair);
  - the old 20-floor campaign as a legacy dungeon (the Keeper's Stair);
  - the Errata;
  - alternating flat and deep floors;
  - the inverted floor (the First-Hour site);
  - siege allies fighting in their own view;
  - "Light is the Plane's ink" and "The Plane counts; the Deep pours" (the fold draft's "Plan" leaf is the Plane here).
- **From the faithful draft:**
  - the Hand (its formula, and "in the lee", which became "under the Hand");
  - *Walk the Shadow*;
  - tradeable accounts and the "n of m" counts;
  - the cult pass;
  - the lowering ceilings (in the Press);
  - the fallen tower (the Toppled Stack);
  - identical rooms (the Square);
  - the drowned waterline (the Drowned Lantern);
  - perches that the map can't measure (the Kites);
  - the banner that presses depth out (Rule-banners);
  - the shadowless oathbreaker;
  - bearings from height;
  - the noon glare;
  - Brann's skull, and the Flat Queen as a person;
  - the banned-vocabulary appendix, and "every proper noun cites something".

**Names settled** (each to one meaning):

| Name | Its one meaning here | Not used for |
|---|---|---|
| **the Gnomon** | the needle at (37, 3) | an ancient people (the builders are the **Deepwrights**) |
| **the Plane** | the flat world and the flat reading | — |
| **the Plan** | the machine faith of the automata | the flat reading (that is the Plane) |
| **glim** | lamp oil, the money | — |
| **the Kindling** | the family of bonding rites (the Tracing, the Lighting, the Snuffing, and their variants) | — |
| **Snuffer** | the oathbreaker's mark | a hunter (the hunters are the Smoothers) |
| **Folio** | the Flatfolk town (G) | anything else |
| **the Unlit** | the ghosts' faction | a dungeon |
| **flat / deep / dark** | the three readings | — |
| *Hackles, Platen, Roller, Reticule, Diptarch, Hydrarch, Seepborn, Clearborn, Gleam, Brightness, the Unlit Stair, the Seam* | not used in this world | — |

### 15.11 Banned vocabulary

These names and terms belong to Caves of Qud, or are research-note units. Don't use them in content, and reject any
generated name that contains them:

Qud, Joppa, sultan, Resheph, Eaters, True Kin, Barathrum (and Barathrumites), Mechanimist, Putus Templar, Templar,
Seekers of the Sightless Way, Consortium of Phyta, Grit Gate, Golgotha, Bethesda Susa, Six Day Stilt, Spindle,
Omonporch, Rainbow Wood, Moon Stair, Kyakukya, Bey Lah, Ezra, Yd Freehold, Chavvah, Eyn Roj, Red Rock, Rust Wells,
snapjaw, goatfolk, hindren, girsh, dromad, salt kraken, glowpad, watervine, water ritual, water-sibling, "live and
drink", dram, parasang, glimmer (as a psychic measure), esper, chimera (as a morphotype), becoming nook, credit wedge,
recoiler, cathedra, baetyl, the Gyre, convalessence, warm static, brain brine, sunslag, neutron flux, zetachrome,
fullerite, crysteel, Kith and Kin, Argyve, Klanq, Issachari, Naphtaali, Shekhinah, Kasaphescence, Coiled Lamb, Daughters
of Exile, Children of Mamon, Mental Mirror, Burrowing Claws, ubernostrum, Wayfaring, Physic, Tinkering (as skill
names), and Classic, Roleplay and Wander (as mode names).

The original words to use instead are: Hours, Bent, Plumb, Truing Cradle, true-mark, grade, crease, Cast, Smoother, glim,
the Kindling, flame-kin, reading, rumour, Hour site, homing pip, Pathcraft, Leechcraft, Artificing, One Wick, Commons
Lamp, Pilgrim.

---

*End of the world bible.*
