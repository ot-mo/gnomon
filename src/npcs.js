// People you meet: what they say, and the quests they give. They are creatures that talk
// (creatures.js; who they are and how they look: content/creatures/legacy.js). A person's
// conversation state is n.talk.state, whether you've met n.talk.met, and their floor n.level.
//
// Talking: E while looking at someone in 3D, or walk into them on the map. Two kinds of
// people are picky about how you look at them:
//   flat beings (Flatlanders) live in the plane of the map. In 3D they're only a shadow on
//     the floor with nobody casting it; you can only talk to them on the map.
//   ghosts are drowned out by torchlight: put your torch out to see them in 3D.
//
// A conversation is a chain of nodes: { text, options: [{ label, go }] }. Choosing an option
// calls go(), which returns the next node, null to end the conversation, or { shop: "buy" |
// "sell" } to open the shop. dialogue.js draws it all.
import { B, FLOOR_Z, KIND } from "./world.js";
import { makeRng } from "./rng.js";
import { CREATURE_TYPES, ELITES, spawnCreature, addCreature, pickCreatureType, canTalk } from "./creatures.js";
import { randomPotion, randomScroll, randomEquipment, randomJewel, addToInventory, itemName, itemPrice, makeItem, awayFromWalls, isGear,
         RINGS, AMULETS, POTIONS, POTION_COLORS } from "./items.js";
import { revealFloor, liftCurses } from "./effects.js";
import { regear, worn } from "./player.js";
import { wielded, carried } from "./body.js";
import { sfx } from "./sfx.js";
import { on } from "./events.js";
import { maxHp, raiseAttr, raiseMaxHp } from "./stats.js";
import { addStatus, removeStatus } from "./status.js";
import { pay, receive, funds, formatPrice, priceLevel, CURRENCY } from "./currency.js";

// --- Quests ------------------------------------------------------------------------------
// game.quests: [{ id, title, text, done }], shown in the journal (J).
export function addQuest(game, id, title, text) {
  if (game.quests.some((q) => q.id === id)) return;
  game.quests.push({ id, title, text, done: false });
  game.log(`New quest: ${title}. (J: journal)`, [255, 220, 120]);
}
// title: for a quest solved on the spot, before it was ever given (it goes straight in as done).
export function finishQuest(game, id, title = null) {
  let q = game.quests.find((o) => o.id === id);
  if (!q && title) game.quests.push(q = { id, title, text: "", done: false });
  if (!q || q.done) return;
  q.done = true;
  game.log(`Quest complete: ${q.title}.`, [140, 255, 160]);
}
export const questActive = (game, id) => game.quests.some((q) => q.id === id && !q.done);
export const questDone = (game, id) => game.quests.some((q) => q.id === id && q.done);

// Rook's bounty: the marked beast died (the "kill" event, events.js; it was game.questEvent).
on("kill", (game, { c }) => {
  if (!c.bounty) return;
  game.log(`That was Rook's quarry. Go and tell Rook.`, [255, 220, 120]);
  const q = game.quests.find((o) => o.id === "rook");
  if (q) q.text = "The beast is dead. Go back to Rook for the bounty.";
  c.killed = true;
});

// --- Who turns up where ----------------------------------------------------------------------
// Each run, every character appears once, on a floor picked from the run's seed: a peddler
// every few floors, and the rest scattered. Some leave a trail deeper down (Brann's skull,
// Ess's sister). The generator places whatever this lists for its floor.
export function planEncounters(seed) {
  const rng = makeRng((seed ^ 0x51ab1e) >>> 0);
  const plan = new Map();
  const add = (d, e) => { if (!plan.has(d)) plan.set(d, []); plan.get(d).push(e); };
  for (const d of [2, 6, 10, 14, 18]) add(d, { npc: "pell" });
  const floors = rng.shuffle([1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16]);
  const take = (ok) => { const k = floors.findIndex(ok); return k < 0 ? floors.splice(0, 1)[0] : floors.splice(k, 1)[0]; };
  const corwin = take((d) => d <= 9); add(corwin, { npc: "corwin" });
  const ess = take((d) => d <= 13); add(ess, { npc: "ess" }); add(ess + rng.int(1, 3), { npc: "tee" });
  const brann = take((d) => d <= 16); add(brann, { npc: "brann" }); add(brann + 1, { item: "skull" });
  add(take(() => true), { npc: "mira" });
  add(take((d) => d >= 3), { npc: "rook" });
  add(take((d) => d >= 2), { npc: "lio" });
  // Shrines: on about a third of the floors from 2 on (never two on a floor).
  for (let d = 2; d < 20; d++) if (rng.chance(0.35)) add(d, { npc: "shrine" });
  return plan;
}

// The peddler's goods, rolled when he's placed. Deeper down, everything costs more.
export function peddlerStock(rng, depth) {
  const jewel = randomJewel(rng, depth + 1, 0.3);
  jewel.ench = Math.abs(jewel.ench);   // Pell doesn't sell cursed trinkets
  const stock = [
    { item: { kind: "potion", effect: "healing" }, count: 3 },
    { item: { kind: "bomb" }, count: 3 },
    { item: { kind: "knife" }, count: 6 },
    { item: randomPotion(rng), count: 1 },
    { item: randomScroll(rng), count: 1 },
    { item: { ...randomEquipment(rng, depth + 1, 0.3), known: true }, count: 1 },
    { item: { ...randomEquipment(rng, depth + 2, 0.3), known: true }, count: 1 },
    { item: { ...jewel, known: true }, count: 1 },
  ];
  for (const s of stock) if (isGear(s.item) && s.item.ench < 0) s.item.ench = 0;
  if (rng.chance(0.3)) stock.push({ item: { kind: "heart" }, count: 1 });
  if (rng.chance(0.2)) stock.push({ item: { kind: "strength" }, count: 1 });
  // Two of the same (the random potion was healing, say): one pile.
  const merged = [];
  for (const s of stock) {
    const same = merged.find((o) => o.item.kind === s.item.kind && o.item.effect === s.item.effect && !o.item.id && !s.item.id);
    if (same) same.count += s.count; else merged.push(s);
  }
  for (const s of merged) s.price = Math.round(itemPrice(s.item) * priceLevel(depth));
  return merged;
}

// --- Shrines ---------------------------------------------------------------------------------
// An offering: glim for a random blessing. A bold one (twice the glim) draws from a better
// list, but one time in four the shrine wants a trial first: monsters, right here.
function offering(game, n, cost, bold) {
  const p = game.player;
  if (!pay(game, p, cost)) return null;
  n.talk.state.used = true;
  sfx("gold");
  if (bold && Math.random() < 0.25) {
    const made = summonAround(game, 3);
    game.log("The candles flare red. \"FIRST, A TRIAL.\" Monsters step out of the shadows!", [255, 120, 100]);
    if (made) {
      n.talk.state.trial = made.map((m) => m.id);
      return node("\"PROVE YOURSELF. THEN BE GIVEN TO.\" (Defeat them, then return to the shrine.)", [bye("Fine.")]);
    }
  }
  return node(bless(game, bold), [bye("Thank you.")]);
}

export function shrineAfterTrial(game, n) {
  const left = game.zone.creatures.filter((m) => n.talk.state.trial.includes(m.id));
  if (left.length) return node(`"THE TRIAL IS NOT OVER." (${left.length} left.)`, [bye()]);
  n.talk.state.trial = null;
  return node(bless(game, true), [bye("Thank you.")]);
}

function bless(game, bold) {
  const p = game.player;
  const gear = worn(p).filter((it) => !(it.kind === "ring" || it.kind === "amulet") || !(it.kind === "ring" ? RINGS : AMULETS)[it.id].fixed);
  const plain = [
    () => { raiseMaxHp(p, 3); p.hp += 3; return "Warmth settles into your bones. (+3 max HP)"; },
    () => { p.hp = maxHp(p); removeStatus(game, p, "poisoned"); return "Every hurt you carry fades away. (Healed fully.)"; },
    () => { regear(p, wielded(p), (w) => { w.ench = Math.min(5, w.ench + 1); w.known = true; }); return `Light runs along your weapon. It's now a ${itemName(game, wielded(p))}.`; },
    () => (liftCurses(p) ? "Something heavy lets go of you. (Every curse lifted.)" : null),
    () => { revealFloor(game); return "You see this whole floor laid out flat in your mind. (Your map is filled in.)"; },
    () => { addStatus(game, p, "hasted", { t: 60, stack: "refresh" }); return "Time slows around you. (Haste, for a minute.)"; },
    () => {
      let n = 0;
      for (const it of carried(p)) {
        if (isGear(it) && !it.known) { it.known = true; n++; }
        if (it.kind === "potion" && !game.knownPotions.has(it.effect)) { game.knownPotions.add(it.effect); n++; }
        if (it.kind === "scroll" && !game.knownScrolls.has(it.effect)) { game.knownScrolls.add(it.effect); n++; }
      }
      return n ? `You suddenly know all about the things you carry. (${n} identified.)` : null;
    },
  ];
  const great = [
    () => { raiseAttr(p, "str", 1); return "Strength floods your arms. (+1 STR)"; },
    () => { for (const it of gear) regear(p, it, (o) => { o.ench = Math.min(5, o.ench + 1); o.known = true; }); return "Everything you wear and wield glows for a moment. (+1 to each.)"; },
    () => {
      const j = randomJewel(Math.random, game.zone.level + 2, 0.3);
      j.ench = Math.abs(j.ench); j.known = true;
      addToInventory(p, j);
      return `Something clinks into your hand: ${itemName(game, j)}.`;
    },
    () => { raiseMaxHp(p, 6); p.hp += 6; return "You feel deeper, somehow. Harder to fold. (+6 max HP)"; },
  ];
  const pool = bold ? great : plain;
  for (let k = 0; k < 20; k++) {
    const text = pool[Math.floor(Math.random() * pool.length)]();
    if (text) { game.log(text, [255, 220, 140]); return `"BE GIVEN TO."\n\n${text}`; }
  }
  return "\"BE GIVEN TO.\"";
}

// Monsters appear on free tiles around you (for a shrine's trial). Returns them, or null.
function summonAround(game, n) {
  const { zone, player: p } = game, made = [];
  const spots = [];
  for (let oy = -3; oy <= 3; oy++)
    for (let ox = -3; ox <= 3; ox++) {
      const x = Math.floor(p.x) + ox, y = Math.floor(p.y) + oy;
      if (Math.max(Math.abs(ox), Math.abs(oy)) < 2 || x < 1 || y < 1 || x >= zone.w - 1 || y >= zone.d - 1) continue;
      if (zone.stand[x + y * zone.w] < 0 || zone.creatures.some((c) => c.tx === x && c.ty === y)) continue;
      spots.push([x, y]);
    }
  for (let k = 0; k < n && spots.length; k++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const m = addCreature(zone, spawnCreature(pickCreatureType(Math.random, game.zone.level), x, y, zone.stand[x + y * zone.w],
                                              { rng: Math.random, state: "chase", level: game.zone.level, elite: k === 0 ? "hulking" : null }));
    made.push(m);
  }
  return made.length ? made : null;
}

// --- Conversations ----------------------------------------------------------------------------
const node = (text, options) => ({ text, options });
const bye = (label = "Goodbye.") => ({ label, go: () => null });
const hasHealing = (p) => p.inv.find((s) => s.kind === "potion" && s.effect === "healing");
function takeFromStack(p, stack) {
  if (--stack.count <= 0) p.inv.splice(p.inv.indexOf(stack), 1);
}
// Money for you: into your purse, and what doesn't fit (a full purse) on the ground at your feet.
function giveFunds(game, n) {
  const p = game.player, left = receive(game, p, n);
  game.log(`You receive ${formatPrice(n)}.`, [255, 215, 90]);
  if (!left) return;
  const [x, y] = awayFromWalls(game.zone, p.x, p.y, p.z);
  game.zone.items.push({ ...makeItem({ kind: "cash", amount: left }, x, y, p.z), dropped: true });
  game.log(`Your purse is full: ${formatPrice(left)} goes on the ground.`, [255, 150, 120]);
}
function give(game, it) {
  addToInventory(game.player, it);
  game.log(`You receive ${itemName(game, it)}.`, [200, 230, 255]);
}

// The share of this floor (everything that isn't solid rock) that's on your map.
export function mapPercent(zone) {
  let total = 0, seen = 0;
  for (let i = 0; i < zone.w * zone.d; i++) if (zone.kind[i] !== KIND.WALL) { total++; if (zone.seen[i]) seen++; }
  return Math.round((seen / Math.max(1, total)) * 100);
}

const RUMOURS = [
  "Flat things live down here. Flatlings, they call them. They'll bite you while you stand there being all three-dimensional, and your sword goes right through them. Look at the world flat, from above, and you can hit them.",
  "The old builders wrote in the floors: mosaics. At eye level it's just pretty tiles. From above it's a message.",
  "Spike floors keep a rhythm. Take them one step at a time on the map and they're a dance. Run them with your eyes open and they're a gamble.",
  "Every floor's got a room with no door. Where? I'm a peddler, not a mason. But walls have been known to come down when you ask them nicely. With a bomb.",
  "Ghosts are shy of fire. Put your torch out and you'd be surprised who's standing next to you.",
  "Runes, ghost planks... the dark shows you things the torch hides. The torch does light braziers, mind you.",
  "There's a door down there with a face on it, and it asks for a number. Look at its floor from above.",
  "The Lich King used to be a priest, they say. He went down looking for the bottom of the world.",
  "Three things guard the way down, they say. A queen who lies flat as a drawing, a warden who hates the light, and a giant with a star in its head. Each one sits on the stairs.",
  "Gear gets better the deeper you go. Heavier, too. And the deep floors keep the old relics: one of a kind, every one.",
  `Shrines? Give them ${CURRENCY.name} and they give something back. Give them a lot, and sometimes they test you first.`,
  "Some things down there shrug off fire. Some freeze solid at a touch of frost. Carry a second blade on your belt, I say. (R swaps it.)",
];

export function talkTo(game, n) {
  const p = game.player, s = n.talk.state;
  const first = !n.talk.met;
  n.talk.met = true;
  switch (n.talk.dialogue) {
    // --- The temple ------------------------------------------------------------------------
    case "maren": {
      if (!game.story.cube) {
        if (first) return node("There you are, little keeper. The floor of the lower sanctum has been shaking for three nights now, and my knees won't take those stairs. Will you go down and see what's wrong?", [
          { label: "Of course. What's down there?", go: () => node("Only the Altar of Angles, and the relic that rests on it: a little cube nobody understands. It looks... more, somehow. As if it goes on further than it should.\n\nThe way down is past the spike hall and the mosaic room, to the east.", [
            { label: "I'll go and see.", go: () => { addQuest(game, "temple", "The shaking floor", "Find out what's shaking the lower sanctum. It's east, past the spike hall and the mosaic room."); return null; } },
          ]) },
          { label: "Why me?", go: () => { n.talk.met = false; return node("Because you're small, and quick, and you never could sit still. And because I said so.", [{ label: "Fair enough.", go: () => talkTo(game, n) }]); } },
        ]);
        return node("The sanctum is east, past the spike hall and the mosaic room. The old builders wrote their secrets into the floors, child: read them. And the spike floor keeps a beat. Wait for it, and never be standing where the spikes come up next. Nothing moves until you do.", [
          { label: "How do I read a floor?", go: () => node("Look at it! The picture's right there under your feet. An arrow is an arrow.", [bye("Right.")]) },
          bye("Thanks."),
        ]);
      }
      if (!s.toldOfLich) return node("Child... your eyes. You're looking through things now. Behind them. Over them. The cube showed you something, didn't it?", [
        { label: "There's another direction. Up.", go: () => node("Up. Up! Our grandmothers' grandmothers had a word for it, and we laughed at them.\n\nAnd you heard him, I suppose. The voice. That was Vorlath. He was a priest here, long before me. He went down looking for the bottom of the world, and something down there taught him how to fold things.", [
          { label: "He said he'd fold Hollowmere into a line.", go: () => node("A line has no room in it for a village, child. No room for anything. We'd be... thinner than thin.\n\nBut you hold the cube now. You can see the world as he does: from inside, and from above. Go down after him. Use both. Stop him.", [
            { label: "I'll stop him.", go: () => {
              s.toldOfLich = true;
              finishQuest(game, "temple");
              addQuest(game, "main", "Stop the Lich King", "Vorlath, the Lich King, waits at the bottom of the dungeon (floor 20). Stop him before he folds Hollowmere into a line.");
              give(game, { kind: "potion", effect: "healing", count: 2 });
              giveFunds(game, 20);
              game.log(`Maren presses two potions and a little ${CURRENCY.name} into your hands.`, [245, 230, 170]);
              return node("Take these. The stairs down are past the shaft behind the altar. You'll have to jump: that's what up is for. And come back if you need rest.", [bye("Goodbye, Maren.")]);
            } },
          ]) },
        ]) },
      ]);
      return node(p.hp < maxHp(p) ? "You're hurt. Sit, child. Rest a while." : "Be careful down there. And come back whenever you need rest.", [
        ...(p.hp < maxHp(p) ? [{ label: "Rest (heal fully)", go: () => { p.hp = maxHp(p); removeStatus(game, p, "poisoned"); game.log("You rest in the temple. You feel whole again.", [140, 255, 160]); return node("There. Off you go.", [bye()]); } }] : []),
        { label: "Tell me about Vorlath.", go: () => node("He was clever, and he was lonely, and he thought the world had too many directions in it. Down at the bottom he found something that agreed with him. That's all anyone knows.", [bye("Thank you.")]) },
        bye(),
      ]);
    }

    // --- Pell, the peddler ------------------------------------------------------------------
    case "pell":
      return node(first ? "Pell the peddler, at your service! Don't mind the monsters. They never buy anything, but they never haggle either." : `Back again! ${CURRENCY.name[0].toUpperCase() + CURRENCY.name.slice(1)} burning a hole in your purse?`, [
        { label: "Show me your wares.", go: () => ({ shop: "buy" }) },
        { label: "I have things to sell.", go: () => ({ shop: "sell" }) },
        { label: "Heard any news?", go: () => node(RUMOURS[(s.rumour = ((s.rumour ?? Math.floor(Math.random() * RUMOURS.length)) + 1) % RUMOURS.length)], [{ label: "Interesting.", go: () => talkTo(game, n) }]) },
        bye(),
      ]);

    // --- Sir Corwin, wounded ---------------------------------------------------------------------
    case "corwin": {
      if (s.healed) return node("I'll make my way up, slowly. Give the Lich my regards. With your sword.", [bye()]);
      const opts = [];
      const heal = hasHealing(p);
      if (heal && game.knownPotions.has("healing")) opts.push({ label: "Give him a potion of healing.", go: () => {
        takeFromStack(p, heal);
        return corwinHealed(game, n);
      } });
      const unknown = p.inv.find((st) => st.kind === "potion" && !game.knownPotions.has(st.effect));
      if (unknown) opts.push({ label: `Give him the ${itemName(game, unknown)} (you don't know what it is).`, go: () => {
        const effect = unknown.effect;
        takeFromStack(p, unknown);
        game.knownPotions.add(effect);
        game.log(`It was a potion of ${POTIONS[effect].name}.`, POTION_COLORS[game.potionColor[effect]].rgb);
        if (effect === "healing") return corwinHealed(game, n);
        const bad = POTIONS[effect].aura === "bad";
        return node(bad ? "*He drinks, and turns a dreadful colour.* Was that... a joke? I feel worse. Much worse." : "*He drinks.* I feel... odd. But no better. Have you nothing that actually heals?", [bye("Sorry.")]);
      } });
      opts.push({ label: "I'll find something.", go: () => { addQuest(game, "corwin", "A wounded knight", `Sir Corwin lies wounded on floor ${n.level}. He needs a potion of healing.`); return null; } });
      return node(first ? "*cough* A friendly face, at last. I'm Corwin, of the Hollowmere watch. A troll did this. I've no potions left, and I can't climb those stairs like this." : "Still breathing. Barely. Did you find something?", opts);
    }

    // --- The Flatlanders (only on the map) ----------------------------------------------------------------
    case "ess":
      if (questDone(game, "ess")) return node("Tee's home, and she won't stop talking about the round-folk who found her. Thank you, from all of the Plane.", [bye()]);
      if (questActive(game, "ess")) return node("Any sign of Tee? Remember: she's flat, like me. You'll only see her from above.", [bye("Still looking.")]);
      return node("Oh! You can see me? Most of you round-folk walk right over us. I'm Ess, of the Plane.\n\nMy little sister Tee went chasing a shadow and slipped down a stairwell. Deeper. If you find her, tell her to come home?", [
        { label: "I'll look for her.", go: () => { addQuest(game, "ess", "Lost on the Plane", `Ess's little sister Tee is lost a few floors below floor ${n.level}. She's flat: she only shows on the map.`); return null; } },
        { label: "What's it like, being flat?", go: () => node("Like being a drawing that learned to walk. We can't see up, so we don't worry about it.\n\nBut there are flat things down here that aren't kind. Flatlings. They bite at your shadow while you stand there in your three dimensions, and your sword goes right through them. Come down to the plane, look from above, and you can fight them.", [{ label: "I'll remember that.", go: () => talkTo(game, n) }]) },
      ]);
    case "tee":
      if (s.done) return node("I'm going, I'm going! Up the stairs, along the floors. I know the way. Mostly.", [bye()]);
      if (!questActive(game, "ess")) return node("Who's there? A round one! I'm Tee, and I'm exploring. Don't you dare tell my big sister where I am. She worries.", [bye("I won't.")]);
      return node("Who's there? A round one! Did Ess send you? I'm not lost, I'm exploring!", [
        { label: "Your sister misses you.", go: () => {
          s.done = true;
          revealFloor(game);
          game.log("Tee shows you her map of this floor. It's all there, from above.", [255, 170, 230]);
          giveFunds(game, 25 + n.level * 2);
          finishQuest(game, "ess");
          return node("...Fine. She always worries. Here: I drew this whole floor myself. Flat folk are good at maps! And take these shiny things, they're heavy.", [bye("Go home safe, Tee.")]);
        } },
      ]);

    // --- Brann, the ghost (only seen in the dark) ------------------------------------------------------
    case "brann": {
      if (s.done) return node("...", [bye()]);
      const skull = p.inv.find((it) => it.kind === "quest" && it.id === "skull");
      if (skull) return node("*the air goes very cold* ...That's mine. That's me. You found it.", [
        { label: "Give Brann his skull.", go: () => {
          p.inv.splice(p.inv.indexOf(skull), 1);
          s.done = true;
          liftCurses(p);
          regear(p, wielded(p), (w) => { w.ench = Math.min(5, w.ench + 1); w.known = true; });
          finishQuest(game, "brann", "Bones for Brann");
          game.log("A cold hand touches your weapon. Every curse you carry lifts, and your weapon grows sharper (+1).", [150, 230, 255]);
          return node("Now I can rest. Take what's left of my blessing. It was never much use to me down here.", [bye("Rest well, Brann.")]);
        } },
      ]);
      if (questActive(game, "brann")) return node("The floor below. Find my skull. I'd like to stop rattling.", [bye()]);
      return node("*the air goes cold* ...You see me? Most can't, with all that fire in their hands. I'm Brann. Was Brann. I fell down a shaft on the floor below, and I'm still lying there, in pieces. Bring me my skull, and I'll rest.", [
        { label: "I'll find it.", go: () => { addQuest(game, "brann", "Bones for Brann", `Find Brann's skull on floor ${n.level + 1} and bring it to his ghost on floor ${n.level}. (He only shows with your torch out.)`); return null; } },
        { label: "Why can I only see you in the dark?", go: () => node("Light is loud. The dead are quiet. That's all.", [{ label: "I see.", go: () => talkTo(game, n) }]) },
      ]);
    }

    // --- Mira, the cartographer -----------------------------------------------------------------------
    case "mira": {
      const pct = mapPercent(game.zone);
      if (s.done) return node("Your map is the best on my shelf. Safe travels.", [bye()]);
      if (questActive(game, "mira")) {
        if (pct >= 80) return node(`Let me see... ${pct}%! That's a proper map. Here, as promised.`, [
          { label: "Hand over a copy of your map.", go: () => {
            s.done = true;
            giveFunds(game, 35 + n.level * 4);
            game.knownPotions.add("seeing");
            give(game, { kind: "potion", effect: "seeing" });
            finishQuest(game, "mira");
            return node("And a potion of seeing for the road. It's the same thing, really: a map you drink.", [bye()]);
          } },
        ]);
        return node(`You've only mapped about ${pct}% of this floor. Most of it, I said! Eighty parts in a hundred.`, [bye("I'll keep looking.")]);
      }
      return node("Ah, another wanderer. Mira, cartographer. I'm mapping these halls, but my lamp's burnt out and my knees are worse. Fill in the map of this floor for me — most of it, mind — and I'll pay for a copy.", [
        { label: "Deal.", go: () => { addQuest(game, "mira", "Mira's map", `Map most (80%) of floor ${n.level}, then show Mira. (The map view shows what you've explored.)`); return null; } },
        bye("Not now."),
      ]);
    }

    // --- Rook, the bounty hunter -------------------------------------------------------------------------
    case "rook": {
      const target = game.zone.creatures.find((m) => m.id === s.target);
      if (s.done) return node("Pleasure doing business.", [bye()]);
      if (questActive(game, "rook") && (s.killed || !target)) return node("Dead? Truly? Here's your cut. You earned it.", [
        { label: "Take the bounty.", go: () => { s.done = true; giveFunds(game, 40 + n.level * 4); finishQuest(game, "rook"); return null; } },
      ]);
      if (questActive(game, "rook")) return node(`The ${s.targetName} is still out there. Get on with it.`, [bye()]);
      return node(`Name's Rook. I hunt things for coin. There's a ${s.targetName} on this floor that's eaten two of my partners. Kill it and I'll split the bounty with you.`, [
        { label: "Consider it done.", go: () => { addQuest(game, "rook", "Bounty", `Kill the ${s.targetName} somewhere on floor ${n.level}, then tell Rook.`); return null; } },
        { label: "What's in it for me?", go: () => node(`${formatPrice(40 + n.level * 4)}. More than you'll find in a skeleton's pockets.`, [{ label: "Fine.", go: () => talkTo(game, n) }]) },
      ]);
    }

    // --- Lio, the prisoner -------------------------------------------------------------------------------
    case "lio": {
      if (s.done) return node("I'll be at the temple, eating everything Maren lets me. Good luck.", [bye()]);
      if (s.free) return node("Free! Thank you, friend. I've nothing to give but this: a trick of the trade. Pay attention.", [
        { label: "I'm listening.", go: () => {
          s.done = true;
          p.bonusPerks = (p.bonusPerks || 0) + 1;
          finishQuest(game, "lio");
          game.log("Lio teaches you a trick. (Choose a gift.)", [255, 220, 120]);
          return null;
        } },
      ]);
      return node("Hey! You! Over here! They locked me in here and forgot about me. The lever's somewhere on this floor, in another room's wall. Please!", [
        { label: "I'll find it.", go: () => { addQuest(game, "lio", "The prisoner", `Find the lever that opens Lio's cell on floor ${n.level}.`); return null; } },
      ]);
    }

    // --- A shrine: glim for a blessing ---------------------------------------------------------------------
    case "shrine": {
      if (s.trial) return shrineAfterTrial(game, n);
      if (s.used) return node("The candles have burnt down to nothing. The shrine is silent.", [bye()]);
      const cost = s.cost, bold = cost * 2, opts = [];
      if (funds(p) >= cost) opts.push({ label: `Offer ${formatPrice(cost)}.`, go: () => offering(game, n, cost, false) });
      if (funds(p) >= bold) opts.push({ label: `Make a bold offering: ${formatPrice(bold)}. (A greater blessing, but it may test you first.)`, go: () => offering(game, n, bold, true) });
      if (funds(p) < cost) opts.push({ label: `(You have ${formatPrice(funds(p))}. It asks for ${cost}.)`, go: () => null });
      opts.push(bye("Walk away."));
      return node(first ? "An old shrine of the builders, its candles still burning after who knows how long. A voice like settling stone fills your head: \"GIVE, AND BE GIVEN TO.\""
                        : "\"GIVE, AND BE GIVEN TO.\"", opts);
    }

    // --- The Speaking Door (a vault) ---------------------------------------------------------------------
    case "door": {
      if (s.open) return node("\"Go in peace, reader of floors.\"", [bye()]);
      return node("A stone face is carved into the wall beside the gate. Its eyes open.\n\n\"Speak the number written upon my floor, and pass.\"", [
        ...s.choices.map((c) => ({ label: `"${c}."`, go: () => {
          if (c === s.answer) {
            s.open = true;
            for (const [x, y, z] of s.gate) game.zone.set(x, y, z, B.AIR);
            game.zone.refresh();
            game.log("Iron grinds against stone. The gate opens.", [160, 220, 255]);
            return node("\"Wise. Pass.\"", [bye()]);
          }
          const f = game.zone;
          const spots = s.spawns.filter(([x, y]) => f.stand[x + y * f.w] >= 0 && !f.creatures.some((m) => !canTalk(m) && m.tx === x && m.ty === y));
          for (let k = 0; k < 2 && spots.length; k++) {
            const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
            addCreature(f, spawnCreature(pickCreatureType(Math.random, game.zone.level), x, y, f.stand[x + y * f.w], { rng: Math.random, state: "chase", level: game.zone.level }));
          }
          game.log("Hidden hatches clank open in the walls!", [255, 120, 100]);
          return node("\"No.\"", [bye()]);
        } })),
        bye("(Say nothing.)"),
      ]);
    }
  }
  return node("...", [bye()]);
}

function corwinHealed(game, n) {
  n.talk.state.healed = true;
  game.knownPotions.add("healing");
  let w = null;
  for (let k = 0; k < 30 && (!w || w.kind !== "weapon"); k++) w = randomEquipment(Math.random, n.level + 2, 1);
  w.ench = Math.max(1, w.ench); w.known = true;
  give(game, w);
  finishQuest(game, "corwin", "A wounded knight");
  return node("*He drinks, and colour floods back into his face.* Bless you. Here, take my sword. I'll not need it on the way home, and you'll need it on the way down.", [bye("Safe travels, Corwin.")]);
}

// Bounty: Rook's quarry is an elite, somewhere else on his floor.
export function bountyTarget(rng, depth) {
  let type = "goblin";
  for (let k = 0; k < 20; k++) {
    type = pickCreatureType(rng, depth);
    const t = CREATURE_TYPES[type];
    if (!t.flat && !t.hover && !t.splits) break;
  }
  const elite = rng.pick(Object.keys(ELITES));
  return { type, elite, name: `${ELITES[elite].adj} ${CREATURE_TYPES[type].name}` };
}
