# The Rotation Cube

A roguelike drawn entirely in coloured text characters, which you play from two points of view:

- **3D (real time).** First person, mouse look, sword in hand. You see height, depth, light and
  the details carved into the walls.
- **Map (turn-based).** The classic top-down roguelike view. You move tile by tile and fight by
  walking into monsters. You see the whole floor at once, but only what you've already seen, and
  it's flat: it can't tell a floor from a ledge, a pit or a chasm.

Both views are the same world: walk somewhere on the map, switch to 3D, and you're standing there.
Switching views is the core of the game. The map is for tactics and planning, and the 3D view is
for the truth.

## The story

In the village of Hollowmere, the world has always been flat: everyone sees it the way you'd see
a map, from above, and nobody has ever wondered what "above" means. You're the youngest keeper of
the Temple of Angles. Something has been shaking the floor under the temple for three nights.

You start in the temple **seeing only the map**. On the altar of the lower sanctum lies the
**Rotation Cube**. Touch it and the world turns: the camera swings down from above into your own
eyes, and from then on Tab rotates you between the two ways of seeing. A voice from far below
introduces itself: **Vorlath, the Lich King**, who means to fold Hollowmere into a single line.
The dungeon under the temple is 20 floors deep, and he waits at the bottom.

On the way down you'll meet people: a peddler, a wounded knight, a cartographer, a bounty hunter,
a prisoner, a ghost, and two Flatlanders who only exist on the map. Most of them want something.

## Why you need both views

| From above (the map, turn-based) | From inside (3D, real time) |
|---|---|
| the whole explored floor at once; auto-explore | height: ledges, pits, chasms, what's up a climb |
| **floor mosaics**: arrows, numbers and pictures in the floor that only read from above | **runes** and **ghost planks**, which only show with your torch out |
| **spike traps**, taken beat by beat; you see which tiles rise next | jumping (over gaps, onto stones, over a row of spikes) |
| **flat beings**: Flatlanders and flatlings exist only here | **ghosts**, only with your torch out |
| careful, turn-by-turn fights | aiming throws, sidestepping arrows, light and darkness |

Flatlings are the sharpest example: they bite you in 3D, but your sword (and anything you throw)
goes straight through their shadow. Rotate to the map to fight them.

## Play it

**In your browser: https://ot-mo.github.io/ascii-roguelike/** (hosted on GitHub Pages; every push
to `main` updates it within a minute or two). Add `?seed=1234` to replay a specific dungeon, and
open [test.html](https://ot-mo.github.io/ascii-roguelike/test.html) to run the level checks.

## Run it locally

The game uses JavaScript modules, so it needs a web server (opening `index.html` directly won't
work). From this folder:

```bash
python -m http.server 8124
```

Then open http://localhost:8124. Add `?seed=1234` to replay a specific dungeon.

`test.html` (http://localhost:8124/test.html) generates 1000 floors and checks that each one can
be finished. Run it after changing the generator.

## Music

The music is composed while you play (Web Audio, no sound files): a pad, a bass, wandering
plucked notes and, when it matters, drums. It follows the story: bright and calm in the temple,
minor in the dungeon, darker from floor 12, and driving once the Lich King is after you. When
monsters are hunting you, a bass pulse and hi-hats creep in.

It also follows the view, and changes completely. On the map (and before you've found the cube)
the band plays flat: no pad, square-wave chiptune notes, crushed to a gritty, mono, narrow sound.
In 3D it plays deep: the pad swells in, the notes go soft and round, in stereo with reverb.
Rotating plays a whoosh (rising into 3D, falling back to the map). And the first time the cube
turns the world, a fanfare plays, opening from flat to deep as the camera swings down.
It starts with your first key press or click (browsers insist), and M turns it off.

## Sounds and voices

Fights, pickups, throws and explosions make sounds, made on the spot like the music. In 3D they
come from where they happen: a monster hit on your right sounds from the right.

People speak a made-up language, a little like Animal Crossing's: as their words type out, every
letter becomes a tiny syllable in their own voice. Pell is low and gruff, Maren warm, the
Flatlanders high and buzzy (and thin: they're flat), Brann wavers and echoes, and the Speaking
Door rumbles. Any key or click while someone's talking shows the rest of the line at once.

## Controls

| 3D view | |
|---|---|
| Click | capture the mouse (Esc releases it and pauses) |
| WASD · Shift · Space | move · sprint · jump (about 1.5 blocks) |
| Mouse / arrow keys | look |
| Left click | attack |
| Right click / T | throw (a throwing knife, or more of the potion or bombs you last threw) |
| E | use (levers, doors, braziers) or talk to whoever you're looking at |
| I · J | inventory · journal (both pause the game) |
| Q | drink a healing potion (once you know which colour heals) |
| R | swap the weapon in your hand for the one on your belt |
| C | sink while flying (Space rises) |
| F | torch on/off. Off: you see less and monsters spot you later, but you see what only shows in the dark (see *The torch*) |
| 1 | Fold Step: step through a fold in the world, up to 4 tiles where you aim (then 12 s to recover; 1-9 are the hotbar) |
| Wheel | zoom |
| M · N | music on/off · sounds and voices on/off (work on every screen; remembered next time) |
| **Tab** | rotate to the map (once you have the cube) |

| Inventory | |
|---|---|
| ↑ ↓ / W S / click | select |
| E / Enter / Space (or click the selected row) | drink, read, wield or wear |
| T | throw the selected potion, knife or bomb (it becomes what T throws from then on) |
| X | drop |
| R | swap weapons (hand and belt) |
| I / Esc | close |

| Map view (turn-based) | |
|---|---|
| WASD / arrows / numpad | step one tile (numpad 7 9 1 3 for diagonals); walk into a monster to attack it, into a person to talk, into a door, lever or brazier to use it |
| Click | walk there, one turn per step; the route shows as dots while you hover |
| X | explore: walk to the nearest unexplored place (or item you've seen), on and on until something interrupts |
| Space / . / numpad 5 | wait half a second; near spike traps, wait until the next beat |
| T | throw at the nearest monster you can see, up to 10 tiles away (always hits, takes 0.5 s); a bomb is set down at your feet instead |
| 1 | Fold Step: up to 4 tiles toward the nearest monster you can see (stopping a tile short), or the way you face (takes 0.5 s; 12 s to recover) |
| I · J · Q · R · F | inventory (using something takes a turn) · journal · quick-heal (takes a turn) · swap weapons · torch on/off |
| Right-click | place or remove a marker (a glowing beacon in 3D) |
| Hover | inspect a tile |
| Tab / Esc | back to 3D |

| Talking | |
|---|---|
| 1–9, or ↑↓ and Enter / E / Space, or click | choose an answer |
| Esc | leave |
| In the shop | ↑↓ choose · Enter buy, sell or pay · Tab / ←→ switch between buying, selling and services · Esc back |

**How turns work:** time only passes when you act, and each action costs the game time it would
take in 3D: a step takes as long as walking one tile (about 0.24 s), an attack one swing of your
weapon (0.3 s for a dagger up to 0.8 s for a greatsword), waiting, drinking or throwing 0.5 s, reading or
changing gear 1 s. Haste makes all of it quicker. Monsters within 12 tiles, or already hunting you, get that much
time to act, so a fast rat covers more ground per turn than a slow skeleton. Click-travel stops
when a new monster comes into view or something hurts you.

Moves on the map are always to a neighbouring tile: you can climb 1 block, but you can't
jump a gap. That's what the 3D view is for.

## People and quests

You'll find one person on most floors (each turns up once per run, on floors picked from the seed).
Walk into them on the map, or look at them in 3D and press E. Quests go in your journal (J).

- **Maren**, the priestess, in the temple. Come back up and she'll let you rest (heals fully).
- **Pell**, the peddler, on floors 2, 6, 10, 14 and 18. Buys and sells (he pays less than a third
  of his price), and everything he sells costs more the deeper you meet him. His **services**:
  sharpen your weapon, or reinforce your armour or polish your ring or amulet (+1 each time, dearer
  every time, up to +5); forge an element into your weapon; identify gear or a potion; lift a
  curse. Each crystal you buy from him makes the next one half again as dear.
- **Sir Corwin**, a wounded knight, needs a potion of healing. (Giving him a potion you haven't
  identified is a gamble.)
- **Mira**, the cartographer, wants most of her floor's map filled in.
- **Rook**, the bounty hunter, wants an elite somewhere on his floor dead.
- **Lio**, a prisoner, needs the lever for his cell, hidden in another room's wall.
- **Brann**, a ghost: you only see him with your torch out. He wants his skull back, from the floor below.
- **Ess** and **Tee**, Flatlanders: flat beings, so you can only see or talk to them on the map.
- **The Speaking Door** isn't a person, but it does talk.
- **Shrines** (`†`) stand on about a third of the floors. Each takes one offering: gold for a
  random blessing (more max HP, a full heal, +1 to your weapon, curses lifted, the floor mapped,
  haste, everything you carry identified). A **bold offering** costs twice as much and draws from a
  better list (STR, +1 to everything you wear, a ring or amulet, more max HP), but one time in four
  the shrine wants a trial first: monsters appear, and the blessing waits until they're dead.

**Gold** (`$`) is scarce: a pile or two per floor, the odd coin from monsters, more in secret rooms
and from quests. You won't afford everything, so choose: Pell's goods, his services, or shrines.

## Items

- **Potions** come in ten colours, and each run shuffles which colour does what. A colour stays
  "crimson potion" until you drink one; from then on every potion of that colour is named. You
  start knowing healing.

  | Potion | Aura | Effect |
  |---|---|---|
  | healing | good | +12 HP |
  | strength | good | +1 STR, for good |
  | flying | good | 20 s of flight: over chasms and deep water, and up onto ledges you can't climb. Space rises, C sinks. When it ends, you fall. |
  | haste | good | 15 s of moving and striking much faster |
  | seeing | good | reveals this floor's layout and its monsters, **and** whether each thing you carry is good, neutral or bad |
  | shadows | good | 30 s in which monsters struggle to notice you |
  | descent | neutral | you sink through the floor to the one below, unhurt |
  | poison | bad | lose 1 HP a second for 6 s |
  | paralysis | bad | you can't move or attack for 5 s (on the map, monsters get those 5 s) |
  | darkness | bad | 40 s with your torch shrunk to a glimmer (monsters notice you a little less, too) |

- **Scrolls** (`?`) work the same way: each kind gets a random title every run (`scroll titled
  "THABELGO YLORUXO"`) until you read one.

  | Scroll | Aura | Effect |
  |---|---|---|
  | remove curse | good | lifts the curse from everything you carry and wear |
  | fire aspect | good | your weapon burns: struck monsters catch fire (1 damage every ½ s for 3 s) |
  | frost aspect | good | your weapon freezes: struck monsters move and attack at half speed for 3 s |
  | storm aspect | good | lightning arcs from each hit to the nearest other monster, for half damage |
  | holy aspect | good | double damage against the undead (skeletons) |
  | blessing | good | your weapon gets +1 |
  | teleportation | neutral | takes you somewhere else on this floor |
  | summoning | bad | calls 2–3 monsters to your side, already hunting you |
  | malice | bad | curses the weapon in your hand |

  A weapon has one element at a time; a new aspect replaces the old one. The element shows in its
  name ("flaming mace") and it glows that colour in your hand. Now and then you find one with an
  element already on it.

- **Blessed and cursed gear.** Every weapon, piece of armour, ring and amulet has a hidden
  enchantment: about 1 in 5 is blessed, 1 in 5 cursed, the rest plain. How much grows with depth:
  ±1 near the top, up to ±4 at the bottom. It adds to damage or armour (or a ring's power).
  You find out when you equip it ("−2 mace"). **Cursed gear won't come off** until a scroll of
  remove curse lifts the curse. Treasure (islands, climbs, vaults, locked rooms) is more often
  blessed. A potion of seeing tells you which of the things you carry are good or bad before you
  risk them.

- **Weapons** each have damage, swing speed, reach and a strength requirement. Strength beyond
  the requirement adds +1 damage per 2 points.

  | Weapon | Damage | Swing | Reach | STR |
  |---|---|---|---|---|
  | dagger | 2–4 | 0.3 s | 1.6 | 8 |
  | short sword (start) | 2–5 | 0.45 s | 1.9 | 10 |
  | mace | 4–7 | 0.6 s | 1.8 | 12 |
  | spear (thrusts) | 3–7 | 0.5 s | 2.7 | 12 |
  | longsword | 4–8 | 0.5 s | 2.2 | 13 |
  | war axe | 6–10 | 0.7 s | 2.0 | 15 |
  | greatsword | 7–12 | 0.8 s | 2.4 | 17 |

- **Armour** soaks up a random 0 to N damage from each blow: leather 1 (10 STR), chain mail 2
  (13), scale mail 3 (15), plate 4 (17).
- **Gear gets better the deeper you go.** Floors 1–3 have only the light stuff (dagger, mace,
  leather); spears, longswords and chain mail from floor 4; war axes and scale mail from 8;
  greatswords and plate only from 12. Elements get commoner deeper, and from floor 5 gear can come
  with **properties** you can see straight away (unlike its enchantment), one or, from floor 12,
  two: *keen* (+10% crits), *swift* (15% faster swings), *long* (+0.4 reach), *vampiric* (hits
  sometimes heal you), *brutal* (+2 max damage), *crushing* (double damage to brittle monsters:
  skeletons and golems), and for armour *light* (needs 3 less STR), *of thorns* (whoever hits you
  takes 2), *of warding* (arrows and bolts do 2 less), *of the stars* (slowly heals you).
- **Your belt.** Wield a new weapon and the old one goes on your belt; R swaps them (you can't
  swap a cursed weapon out of your hand). Worth it: some monsters shrug off fire, some are weak to
  frost (see *Monsters*).
- **Rings** (`=`) and **amulets** (`"`), from floor 3: one of each can be worn. You can tell what
  kind it is by its name, but not how strong it is, or whether it's cursed, until you put it on.
  Rings: regeneration, strength, protection (armour), accuracy (crits), haste, thorns, vampirism
  (HP for every kill). Amulets: life (max HP), sight (a brighter torch, and monsters close by show
  on the map), the dark (with your torch out you see a little and hide better), warding (the first
  blow on each floor misses), the climber (jump higher), feathers (falls never hurt).
- **Relics** are one of a kind (gold on the map). Each guardian drops one, and now and then one
  lies with the treasure of floors 14–19. Never cursed, and you know what each one does:
  Hollowmere's Oath, Emberheart, The Long Patience, Thornfang, Sunder, The Edge of the Plane
  (it cuts flat beings in 3D), The Mantle of Angles (turning the world leaves you untouchable for
  2 s), The Eye of the Cube, Brann's Lantern, The Heart of the Deep.
- **Strength** starts at 10. Strength crystals (`S`, absorbed on pickup) and strength potions
  raise it. Heart crystals (`h`) raise max HP by 5. Crystals are rare: about one strength crystal
  every three floors and one heart crystal every four, nearly always as the prize in a treasure
  spot (a vault, the top of a climb room, an island, a locked room).
- **Bombs** (`0`) stack. You start with one; most floors have one or two lying around, and monsters
  sometimes drop them. Throw one (T) and it goes off 2 s later; on the map you set it down at your
  feet, so take a few steps away. The blast does 10–16 damage to everything within about 2 tiles
  (you included), smashes crates, and is the only way into a **secret room**.
- **Throwing knives** (`/`) stack. You start with 4. Each does 2–4 damage (sometimes double) and
  usually lands where you can pick it up again; about 1 in 5 snaps, and one that falls into a chasm
  or deep water is gone. Most floors have a few lying around.
- **Keys** open locked doors. A floor has at most one locked room (about half of them do) and
  exactly one key for it, somewhere you can reach without going through that door. Keys stay with
  you, so a spare one can open a locked door on a later floor.

Deeper floors have tougher monsters: new kinds turn up as you go down, and every monster gets +6%
health per floor and +1 damage every four floors.

## Monsters

| Glyph | Monster | Floors | What to know |
|---|---|---|---|
| `r` | rat | 1–5 | fast, weak |
| `g` | goblin | 1–10 | the everyday foe |
| `b` | bat | 2–9 | very fast, flits about erratically, flies at head height |
| `s` | skeleton | 2–18 | slow, tough, undead (holy weapons do double) |
| `x` | spider | 3–12 | its bite poisons you for 3 s |
| `a` | goblin archer | 4–14 | shoots arrows from up to 10 tiles and keeps its distance; in 3D you can sidestep them |
| `j` | slime | 5–15 | slow and spongy; splits into two small slimes when it dies |
| `o` | orc | 7–19 | a brute: lots of health, hits hard |
| `W` | wraith | 10–20 | undead, floats, sees you as well with your torch out, and heals by the damage it does you |
| `l` | salamander | 11–20 | fire can't hurt it (much), frost can; its bite burns you for a few seconds |
| `T` | troll | 13–20 | huge; regenerates 1 HP a second unless it's burning (weak to fire, shrugs off frost) |
| `G` | stone golem | 14–20 | slow, armoured (every hit does 3 less), brittle; resists fire and frost, weak to storm |

**Resistances.** A monster that resists an element takes less from it, and it doesn't burn,
slow or carry the lightning. One that's weak to it takes half again as much. Slimes resist storm,
wraiths frost. On the map, hover over a monster to see what it's weak to.

**Elites.** From floor 3 on, some monsters are elites: about 1 in 25 at first, rising to 1 in 5 by
floor 18. Their name says which kind ("hulking orc"). They glow with their colour in 3D, show in
that colour on the map, are worth 2½× the XP, and always drop something (a potion, a scroll or gear).

| Elite | Effect |
|---|---|
| hulking | twice the health, +2 damage, bigger and a little slower |
| swift | 60% faster, attacks more often |
| venomous | its attacks poison you |
| vampiric | heals itself by the damage it does you |
| armoured | every hit you land does 2 less (never less than 1) |
| warded | elements don't touch it (from floor 8) |

**The guardians.** Floors 5, 10 and 15 each have a guardian in a hall in front of the stairs down.
The stairs are behind a gate that opens when it dies, and it always leaves a relic. Each one needs
both ways of seeing:
- **The Flat Queen** (`Q`, floor 5) is a being of the plane: fight her on the map. Every few
  seconds she rises out of the floor and stands in 3D, and then only a blow in 3D touches her.
  She keeps calling flatlings to her side.
- **The Gloom Warden** (`W`, floor 10) is a huge ghost, there only in the dark: with your torch
  lit you can't see it or hurt it (it can still hurt you). With your torch out it calls up shades,
  which see in the dark but burn in firelight. Light the hall's braziers (torch on!), which the
  Warden keeps blowing out.
- **The Colossus** (`C`, floor 15) never moves and is made of stone: only its glowing core feels a
  blow, and that's up on its head. Climb the platforms around it and strike from up high. It slams
  the ground in rings, near and far by turns: the map shows which tiles are about to shake (`^`),
  and the platform tops never do. Up there, watch for its arm: when it draws back, get down.

**The Lich King** (`L`, floor 20) waits on a dais in a pillared throne room, with two skeletons on
guard. It has 240 HP, is undead (holy weapons do double), hits hard in melee and hurls green bolts
from up to 14 tiles. At two thirds of its health it raises three skeletons; at one third two wraiths,
and it casts faster from then on. It never loses track of you, shrugs off blindness, and paralysis
holds it for 1.5 s at most. Its health shows across the top of the screen once it's noticed you.

## Spike traps

Spike floors keep a beat (twice a second), each room in its own pattern: waves, checkerboards,
ripples. Anyone standing on a tile when its spikes come up gets hurt; flying or mid-jump, you're safe.

- **On the map** they're a puzzle. Near spikes, Space waits until the instant before the next beat,
  and the map shows what's coming: red `▲` are up (and about to drop), orange `^` come up on the
  beat. Each beat, step onto a tile that's down (`,`) or stay where you are, and never stand on a
  `^`. Waves come in staggered rows, so even one rolling straight at you leaves a safe tile beside
  you: every spike field in the game can be crossed this way without a scratch (and without ever
  stepping onto a `▲`). The temple's wave always rolls the way you're going: follow it.
- **In 3D** they're a test of nerve: the clock runs, the tiles at your feet are out of sight,
  and you can't see what's coming. But you can jump over a row.

## Secret rooms

Every floor hides one small sealed room with good loot in it (often a crystal, gear or more bombs).
There's no door: you have to bomb your way in through the right wall. Where they go follows a
few fixed rules. Working them out is up to you. (They're written in `src/gen/dungeon.js` if you
give up.)

## The torch

Your torch (F) lights the way, but it also drowns out faint things. With it **out**:
- carved **runes** glow (by torchlight they're barely-visible scratches), and so do the carved
  panels of a lever mural,
- **ghost planks** appear: solid bridges that are invisible in torchlight (and on the map, which
  shows only the chasm under them),
- up close, light leaks through the cracks of a wall with a lit room behind it,
- monsters take longer to notice you (wraiths and the Lich King excepted).

With it **on**, you can light **braziers** (E, or walk into one on the map).

It burns **glim**: 1 for every 4 hours of the world's clock (an hour is a minute of play) that it's lit in the
dark (underground, or outside at night), and nothing by day. With an empty purse it gutters to a flicker that
lights only the tile around you, until you find more.

## Throwing

In 3D, a thrown knife or potion really flies: it drops a little over distance and stops at the
first monster, wall or floor it meets, so aim a little high for far targets. On the map, T throws
straight at the nearest monster you can see and always hits.

A thrown potion shatters and splashes everything within about 2 tiles, which identifies it if you
didn't know it. Throw the bad ones; good ones help the monsters. Stand too close and it splashes you too.

| Potion | Thrown |
|---|---|
| poison | a cloud of gas for 6 s: monsters inside take 1 damage every ½ s (and for 2 s after leaving it); you're poisoned too if you walk in |
| paralysis | monsters freeze for 6 s (you for 3 s, if you're in the splash) |
| darkness, shadows | monsters are blinded for 10 s and lose track of you |
| descent | the floor melts into a 3×3 pit, and whatever stands there falls to the floor below (no XP) |
| healing | heals the monsters 12 (and you 6, if you're in the splash) |
| haste | the monsters speed up for 12 s |
| anything else | splashes harmlessly |

## Experience and levels

Killing a monster gives XP (rat 2, goblin 5, skeleton 9 … troll 24, +10% per floor deeper), whether your blade,
fire, lightning, a knife or poison finishes it. Level *n* needs 10*n*² + 10 XP to reach the next
(20, 50, 100, 170, 260…): clearing a whole floor is worth about one level. Every level gives +3
max HP, and the game pauses so you can **choose one of three perks**, each yours for the rest
of the run. Some can be taken again for a stronger rank (Tough III, Quick strikes II…). Every fifth
level is a **milestone**: four choices, one of them a rare *major* perk.

| Perk | Effect |
|---|---|
| Swimmer | deep water no longer drags you down: you swim in it, slowly, on both views (monsters can't follow) |
| Bright torch | your torch is brighter and reaches half again as far (also further for the auto-map) |
| Tough | +8 max HP |
| Mighty | +2 STR |
| Fleet-footed | 20% faster, in 3D and on the map |
| Stealthy | monsters have to be 30% closer to notice you |
| High jumper | jump a block higher (about 2.5), and climb 2 blocks on the map |
| Regeneration | heal 1 HP every 6 s |
| Cartographer | chasms and pits you see go on the map from either view |
| Quick strikes | attacks 20% faster |
| Iron skin | +1 armour |
| Feather fall | falls never hurt (pits included) |
| Keen eye (×2) | +8% crits |
| Executioner | +50% damage against monsters below a quarter of their health |
| Knife juggler | thrown knives do +2 and you throw twice as fast |
| Demolitionist | bigger bomb blasts, and your own hurt you half as much |
| Alchemist | potions of healing heal 18 |
| Scholar | you can tell whether an unread scroll is good, neutral or bad |
| Haggler | Pell charges a fifth less |
| Thick blood | poison hurts half as often |
| Night eyes | with your torch out you can still see a little |
| *Second wind* (major) | once per floor, a killing blow leaves you on 1 HP |
| *Lucky* (major) | twice the monster loot, and the gear they drop is more often blessed |
| *Folding strike* (major) | turning the world stuns every monster next to you for 2 s (every 10 s at most) |
| *Giant slayer* (major) | +30% damage against elites, guardians and the Lich King |

Tough, Mighty, Regeneration, Quick strikes, Iron skin and Keen eye can be taken more than once.

## Floors and stairs

- **Stairs down (`>`)** are always on plain dry ground: never in water, on a bridge or an island,
  or next to a drop.
- **Floor 20 is the last.** It has no stairs down and no holes of any kind (no pits, chasms or deep
  water), and potions of descent don't work there.
- **Stairs up (`<`)** are in the start room of every floor below the first. They take you back to
  the floor above, exactly as you left it: what you explored, what you picked up, which monsters
  you killed. Every floor you've visited is remembered for the rest of the run.
- Coming down the stairs puts you beside the stairs up; going up puts you beside that floor's stairs
  down. **Falling** (a pit, a chasm, deep water) drops you near the spot you fell from, always
  somewhere connected to the rest of the floor (never sealed in a locked room). Then you can find the `<` to climb
  back and try again.

## How the two views differ (design rules)

- **The map fills in as you look.** A tile appears on the map once a ray from your eyes has passed
  over it in light. Dark places stay blank until your torch reaches them.
- **The map is flat.** Floors, crates and ledges all draw as `.`. Only walls that go from floor
  to ceiling draw as `#`.
- **Chasms and pits look like floor until you've looked into them in 3D.** Once your eyes have
  gone down past the floor's edge in the 3D view, the map marks them with `:`. Looking at them
  only from the map doesn't count. Walking on the map follows the real world, so stepping onto an
  unknown "floor" tile that's really a chasm drops you a floor. Click-travel avoids known chasms,
  and stepping into one on purpose takes a second step to confirm.
- **Water shows on the map.** Shallow water (light `~`) is walkable but slow: about half speed in
  3D (your view dips as you wade), and each step on the map costs nearly twice the time. Monsters
  slow down in it too. Deep water (dark `~`) works like a chasm: go in and you sink and get swept
  down to the next floor (no fall damage). On the map, diving in takes a second step to confirm.
- **Monsters appear on the map where you last saw them**, fading as the memory gets old.
- **Runes, lever positions and heights only exist in 3D.**
- **Floor mosaics read clearly only on the map**, where each mosaic tile is a solid block of
  colour. In 3D they're faded tiles at a low angle.
- **Flat beings only exist on the map.** In 3D a flat being is a shadow on the floor with nobody
  casting it.
- **Height matters.** Monsters can climb 1 block and can't jump. You can jump about 1.5, so a
  2-block ledge needs the crate standing in front of it as a step (and monsters can climb up that
  way too). Fall into a pit and you land on the next floor down. A drop of 5 or more blocks
  hurts a little.

Every floor also has one or two **big halls**. Each holds either a lake (deep middle, shallow
shore, and a bridge across it or out to an island with treasure) or, from depth 2, a chasm
crossed by plank bridges.

**Platforming (3D only).** Some treasure can only be reached by jumping in 3D, or by flying:
- **Stepping stones:** pillars rising out of a chasm or a lake, about three tiles apart, leading
  to a treasure platform or island. Some stand a block taller; the widest gaps up onto those need
  a sprinting jump.
- **Climb rooms:** tall rooms where wooden platforms float up the walls, each a block higher than
  the last, to a lamp-lit perch with treasure. Jump at walking speed and let go of W once you're
  over the next platform; sprinting overshoots.

The puzzle rooms (`src/gen/vaults.js`) are built on these rules. You meet each of them on floors
1–9 (floor 5 belongs to the first guardian), then at random:
- **The Rune Lever:** 3 to 5 levers that look identical, and nothing in the room tells them apart.
  The builders kept a record somewhere else on the same floor, in another room: either a **mural**
  in a wall (a carved panel for each lever, read left to right as you face it; with your torch
  out the right ones blaze and the rest glow dimly), or a **row of floor tiles** between two white
  ones (gold for a right lever, red for a wrong one, read west to east; clear only on the map).
  Sometimes one lever opens the gate, sometimes several must all be pulled. Any other lever springs
  a trap (the floor drops away, monsters burst out, or poison gas). Different every time.
- **The Mosaic Hall:** more levers and trap floor, but the answer is written in the floor: a
  golden arrow pointing at the right lever. From above it's obvious.
- **The Flat Lie:** the map shows an open room. In 3D it's a chasm crossed by a winding path.
- **The Gauntlet:** treasure beyond a field of spike traps keeping a rhythm.
- **The Braziers:** a dark room of cold braziers with numerals carved behind them. Light them in
  order. You read the numerals in the dark, but you need your torch lit to light a fire. The wrong
  one snuffs them all and wakes something.
- **The Speaking Door:** a stone face asks for "the number written upon my floor": a giant mosaic
  digit you can only really read from above. Wrong answers open hatches full of monsters.
- **The Dark Maze:** no lamps, monsters inside. You need the map to keep your bearings.
- **The Unseen Path:** treasure across a chasm, and a winding bridge only the dark can see.

## Code map

| File | What it does |
|---|---|
| `src/game.js` | game state, modes (explore / map / story / rotate / talk / shop / journal / …), one frame (`tick`), input actions |
| `src/story.js` | the story text, Vorlath's taunts, the ending, and the hand-built Temple of Angles |
| `src/npcs.js` | the people: art, conversations, quests, where they turn up, the peddler's stock |
| `src/dialogue.js` | the conversation, shop, journal and story-page screens |
| `src/traps.js` | spike traps: the beat, patterns, damage, how they look |
| `src/audio.js` | the shared audio context: unlocking it, going quiet when the game isn't on screen |
| `src/music.js` | the generative music: moods, the sequencer, the instruments, the flat-vs-3D sound |
| `src/sfx.js` | sound effects, and the voices people speak their made-up language in |
| `src/main.js` | start-up: canvas, pointer lock, the requestAnimationFrame loop |
| `src/items.js` | potions, weapons (stats and first-person models), armour, properties, rings and amulets, relics, loot tables, prices, pickups |
| `src/inventory.js` | the inventory screen: use, equip, drop |
| `src/effects.js` | what potions and scrolls do, and timed effects (flying, haste, shadows, poison, paralysis, darkness) |
| `src/leveling.js` | XP, levels and perks |
| `src/turns.js` | turn-based map play: steps, bump attacks, passing time, what you can see, click-travel |
| `src/screen.js` | the character screen: a grid of characters and colours that everything draws into |
| `src/screen-canvas.js` | draws that grid on the canvas (fast glyph stamping) |
| `src/input.js` · `src/input-browser.js` | held keys and input routing; the browser's keyboard, mouse and pointer-lock events |
| `src/world.js` | block types, the `Floor` class (voxel grid, standing heights, map kinds) |
| `src/raycast.js` | 3D DDA ray casting; also fills in the auto-map |
| `src/light.js` | flood-fill light from lamps and sky wells |
| `src/materials.js` | procedural textures per block (bricks, runes, levers…) |
| `src/render3d.js` | the first-person view: shading, fog, sky, sprites |
| `src/renderMap.js` | the top-down map, legend, tile inspector |
| `src/player.js` | movement, jumping, flying, collision, stats, gear, and `bonus()`: what your gear and perks add up to |
| `src/monsters.js` | monster types and pixel art, elites, the boss, AI (incl. ranged attacks), resistances, combat |
| `src/guardians.js` | the three guardians' fights: the Flat Queen, the Gloom Warden, the Colossus |
| `src/throwing.js` | throwing knives, potions and bombs: flight, hits, splashes, poison clouds, explosions |
| `src/pathing.js` | walking rules and flow fields (how monsters find you) |
| `src/interact.js` | levers (and their traps), doors, the brazier puzzle, talking in 3D |
| `src/hud.js` | status bar, messages, the weapon in your hand and its swing, hit sparks |
| `src/gen/dungeon.js` | floor generator (rooms, features, secrets, loot, people) and validator |
| `src/gen/vaults.js` | hand-made puzzle rooms (see the legend at the top of the file) |
| `learn/` | the five tutorial stages this game grew out of |

## Making things

- **A new puzzle room:** add an entry to `VAULTS` in `src/gen/vaults.js`. Draw it with the legend
  at the top of that file, then wire levers to gates or traps with `links`.
- **A new monster:** add an entry to `MONSTER_TYPES` in `src/monsters.js`. Pixel art is one
  letter per pixel, with a palette. `depths` and `weight` decide where and how often it turns up;
  the comment above the table lists the traits (ranged, venom, regen, splits…) you can give it.
- **A new elite:** add it to `ELITES` in `src/monsters.js`.
- **A new block:** add it to `BLOCKS` in `src/world.js` and give it a texture in `src/materials.js`.
- **A new weapon or armour:** add it to `WEAPONS` or `ARMOURS` in `src/items.js`. A weapon's `held`
  art is what you see in your hand; `tier` decides how deep it starts appearing.
- **A new potion or scroll:** add it to `POTIONS` or `SCROLLS` in `src/items.js` (with a weight
  for how common it is and its aura), add a colour to `POTION_COLORS` if there are more potions
  than colours, and its effect to `drinkPotion` or `readScroll` in `src/effects.js`.
- **A new perk:** add it to `PERKS` in `src/leveling.js`. If it only adds to a bonus (crits,
  speed, armour…; the list is in `src/items.js`), give it a `bonus` function and you're done.
  Otherwise check for it with `p.perks.has("yourPerk")` wherever it should make a difference.
- **A new property, ring, amulet or relic:** add it to `PROPERTIES`, `RINGS`, `AMULETS` or
  `RELICS` in `src/items.js`, with the bonuses it gives.
- **A new person:** add them to `NPC_TYPES` in `src/npcs.js` (art and palette, or `flat: true`),
  write their conversation as a `case` in `talkTo` (nodes of text and options; options return the
  next node), and give them a floor in `planEncounters`.
