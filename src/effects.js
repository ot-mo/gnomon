// What potions and scrolls do, and the timed effects they leave on you
// (flying, haste, shadows, poison, paralysis, darkness), plus the Regeneration perk.
//
// The consumable effects table (TECH_DESIGN §8.3 "WS5": the parent's potion and scroll switches as data).
// One table per way of using a consumable; content adds its own (tonics, C4) with registerEffect:
//   DRINK[effect](game, p)                     a potion drunk (drinkPotion has named it and played the sound)
//   READ[effect](game, p, { weapon, wname })   a scroll read (readScroll has named it); weapon: what you wield
//   SPLASH[effect](game, ctx)                  a potion shattered where it landed: ctx = { x, y, z, r, near, youToo,
//                                              names() }: where, how far it spreads, the creatures it reaches and
//                                              whether it reaches you (throwing.js works those out and calls splash)
//   registerEffect(table, effect, fn)          table "drink" | "read" | "splash"; registering one again replaces it
//   splash(game, effect, ctx)                  the SPLASH entry, or "It splashes harmlessly."
// Each entry is the parent's case as it was: the same lines, the same random draws in the same order.
import { POTIONS, POTION_COLORS, SCROLLS, ELEMENTS, WEAPONS, itemName, isGear } from "./items.js";
import { bonus, regear } from "./player.js";
import { wielded, carried } from "./body.js";
import { maxHp, raiseAttr, regenEvery, canSwim } from "./stats.js";
import { addStatus, tickStatuses, statusFlag, updateDrowning } from "./status.js";
import { FLOOR_Z, B } from "./world.js";
import { sfx } from "./sfx.js";
import { spawnCreature, addCreature, pickCreatureType, hostilesTo, canTalk } from "./creatures.js";
import { arrivalPoint } from "./zones.js";
import { hasKey } from "./keyset.js";

export const DRINK = {}, READ = {}, SPLASH = {};
const TABLES = { drink: DRINK, read: READ, splash: SPLASH };
export function registerEffect(table, effect, fn) {
  if (!TABLES[table]) throw new Error(`registerEffect: no table ${table} (drink, read, splash)`);
  if (typeof fn !== "function") throw new Error(`registerEffect: ${table} ${effect} needs a function`);
  TABLES[table][effect] = fn;
}

// --- Drinking ------------------------------------------------------------------------------------------
export function drinkPotion(game, effect) {
  const p = game.player;
  sfx("drink");
  const color = POTION_COLORS[game.potionColor[effect]];
  const unknown = !game.knownPotions.has(effect);
  game.knownPotions.add(effect);
  if (unknown) game.log(`You drink the ${color.name} potion. It's a potion of ${POTIONS[effect].name}!`, color.rgb);
  DRINK[effect]?.(game, p);
}

Object.assign(DRINK, {
  healing(game, p) {
    const heal = hasKey(p.perks, "alchemist") ? 18 : 12;
    p.hp = Math.min(maxHp(p), p.hp + heal);
    game.log(`Warmth spreads through you. (+${heal} HP)`, [230, 90, 110]);
  },
  strength(game, p) {
    raiseAttr(p, "str", 1);
    game.log("Your muscles swell. STR +1!", [255, 170, 80]);
  },
  flying(game, p) {
    addStatus(game, p, "flying", { t: 20, stack: "refresh" });
    game.log(game.view === "map" ? "You float up into the air! Fly over chasms and water for 20 s."
                                 : "You float up into the air! Space rises, C sinks. 20 s.", [160, 220, 255]);
  },
  haste(game, p) {
    addStatus(game, p, "hasted", { t: 15, stack: "refresh" });
    game.log("Everything around you slows down. You're fast!", [255, 240, 120]);
  },
  seeing(game) {
    revealFloor(game);
    senseAuras(game);
    game.log("Your mind's eye opens: the floor unfolds on your map, and you sense the nature of all you carry.", [200, 160, 255]);
  },
  shadows(game, p) {
    addStatus(game, p, "shadowed", { t: 30, stack: "refresh" });
    game.log("Shadows cling to you. Monsters will struggle to notice you.", [140, 130, 170]);
  },
  descent(game) {
    if (!game.zone.hasBelow) { game.log("You grow light, then heavy... but the floor here is warded. Nothing happens.", [180, 170, 140]); return; }
    game.log("You grow light, then heavy... and sink right through the floor.", [180, 170, 140]);
    game.fallThrough();
  },
  poison(game, p) {
    addStatus(game, p, "poisoned", { t: 6, stack: "refresh" });
    game.log("You feel very sick...", [150, 200, 80]);
  },
  paralysis(game, p) {
    addStatus(game, p, "paralyzed", { t: 5, stack: "refresh" });
    game.log("Your limbs lock up! You can't move!", [200, 120, 255]);
  },
  darkness(game, p) {
    addStatus(game, p, "darkened", { t: 40, stack: "refresh" });
    game.log("Darkness pours from the bottle. Your torch shrinks to a glimmer.", [110, 100, 140]);
  },
});

// --- Reading ---------------------------------------------------------------------------------------------
// Read a scroll. Returns false if it can't be read right now (nothing happens, nothing used up).
export function readScroll(game, effect) {
  const p = game.player;
  const unknown = !game.knownScrolls.has(effect);
  const title = game.scrollTitle[effect];
  game.knownScrolls.add(effect);
  if (unknown) game.log(`You read "${title}". It's a scroll of ${SCROLLS[effect].name}!`, [235, 220, 175]);
  const weapon = wielded(p), wname = () => itemName(game, weapon);
  READ[effect]?.(game, p, { weapon, wname });
  return true;
}

// An aspect, a blessing or malice works on the weapon in your hand. (The parent always had one; a body that
// lost its hand, WS4's limbs, may not.)
const onWeapon = (fn) => (game, p, ctx) => {
  if (!ctx.weapon) { game.log("The words slide off you: you hold no weapon for them to take.", [170, 170, 170]); return; }
  fn(game, p, ctx);
};
const aspect = (effect) => onWeapon((game, p, { weapon }) => {
  const old = weapon.element;
  weapon.element = effect;
  const verb = { fire: "bursts into flame", frost: "frosts over", shock: "crackles with lightning", holy: "shines with holy light" }[effect];
  game.log(`Your ${WEAPONS[weapon.id].name} ${verb}!${old && old !== effect ? ` (It's no longer ${ELEMENTS[old].adj}.)` : ""}`, ELEMENTS[effect].color);
});

Object.assign(READ, {
  uncurse(game, p) {
    const lifted = liftCurses(p);
    game.log(lifted ? `A warm light washes over your things. Curses lifted: ${lifted}.` : "A warm light washes over you. Nothing was cursed.", [255, 245, 200]);
  },
  fire: aspect("fire"), frost: aspect("frost"), shock: aspect("shock"), holy: aspect("holy"),
  blessing: onWeapon((game, p, { weapon, wname }) => {
    weapon.ench = Math.min(5, weapon.ench + 1);
    weapon.known = true;
    game.log(`Your weapon glows softly. It's now a ${wname()}.`, [255, 245, 200]);
  }),
  teleport(game, p) {
    const f = game.zone;
    const at = arrivalPoint(f, "teleport", { rng: Math.random });
    Object.assign(p, { x: at.x, y: at.y, z: at.z, vz: 0 });
    game.travel = null;
    game.log("The world twists around you. You're somewhere else.", [200, 160, 255]);
  },
  summon(game, p) {
    const f = game.zone;
    let n = 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (n >= 2 + Math.floor(Math.random() * 2)) break;
      const x = Math.floor(p.x) + ox, y = Math.floor(p.y) + oy;
      if (x < 0 || y < 0 || x >= f.w || y >= f.d) continue;   // creatures never leave their zone (§6.1)
      const z = f.stand[x + y * f.w];
      if (z < 0 || f.creatures.some((m) => !canTalk(m) && m.tx === x && m.ty === y)) continue;
      addCreature(f, spawnCreature(pickCreatureType(Math.random, game.zone.level), x, y, z, { rng: Math.random, state: "chase", level: game.zone.level }));
      n++;
    }
    game.log(n ? "The scroll shrieks! Monsters appear around you!" : "The scroll shrieks, but nothing comes.", [255, 120, 100]);
  },
  malice: onWeapon((game, p, { weapon, wname }) => {
    weapon.ench = Math.min(weapon.ench, 0) - 1 - Math.floor(Math.random() * 2);
    weapon.known = true;
    game.log(`Dark energy coils around your weapon. It's cursed! (${wname()}, and it won't leave your hand)`, [200, 80, 120]);
  }),
});

// --- Splashing (a thrown potion) ---------------------------------------------------------------------------
export function splash(game, effect, ctx) {
  const fn = SPLASH[effect];
  if (fn) fn(game, ctx);
  else game.log("It splashes harmlessly.", [170, 170, 170]);
}

Object.assign(SPLASH, {
  poison(game, { x, y, z, r }) {
    game.zone.clouds.push({ x, y, z, r, time: 6, kind: "poison", src: "player" });   // (your throw: throwing.js shatter)
    game.log("A cloud of poison gas billows out!", [150, 210, 80]);
  },
  paralysis(game, { near, youToo, names }) {
    for (const m of near) addStatus(game, m, "stunned", { t: 6, stack: "refresh" });
    if (near.length) game.log(`The ${names()} ${near.length > 1 ? "freeze" : "freezes"} in place!`, [200, 120, 255]);
    if (youToo) { addStatus(game, game.player, "paralyzed", { t: 3, stack: "max" }); game.log("The fumes reach you too: you can't move!", [200, 120, 255]); }
  },
  darkness(game, { near, names }) {
    for (const m of near) { addStatus(game, m, "blinded", { t: 10, stack: "refresh" }); if (m.state === "chase") m.state = "wander"; }
    game.log(near.length ? `Darkness swallows the ${names()}. They've lost track of you.` : "A pool of darkness spreads and fades.", [130, 120, 170]);
  },
  descent(game, { x, y }) {
    // The floor melts away: a 3×3 pit (never under stairs). Whatever stands there falls.
    // Not on the last floor: there's nothing below it.
    const zone = game.zone;
    if (!zone.hasBelow) { game.log("The floor shimmers, but holds. Something wards it.", [180, 170, 140]); return; }
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let ty = cy - 1; ty <= cy + 1; ty++)
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        const g = zone.get(tx, ty, FLOOR_Z - 1);
        if (tx < 1 || ty < 1 || tx >= zone.w - 1 || ty >= zone.d - 1) continue;
        if (g === B.STAIRS || g === B.STAIRS_UP || zone.get(tx, ty, FLOOR_Z)) continue;   // stairs, or a wall here
        zone.set(tx, ty, 0, B.AIR);
        zone.set(tx, ty, FLOOR_Z - 1, B.AIR);
        zone.holeSeen[tx + ty * zone.w] = 1;
      }
    zone.refresh();
    game.log("The floor melts away into a pit!", [180, 170, 140]);
  },
  healing(game, { near, youToo, names }) {
    const p = game.player;
    for (const m of near) m.hp += 12;
    if (near.length) game.log(`The ${names()} ${near.length > 1 ? "look" : "looks"} healthier. Oops.`, [230, 90, 110]);
    if (youToo) { p.hp = Math.min(maxHp(p), p.hp + 6); game.log("Some of it splashes on you. (+6 HP)", [230, 90, 110]); }
  },
  haste(game, { near, names }) {
    for (const m of near) addStatus(game, m, "hasted", { t: 12, stack: "refresh" });
    if (near.length) game.log(`The ${names()} ${near.length > 1 ? "speed" : "speeds"} up! That was a mistake.`, [255, 240, 120]);
  },
});
SPLASH.shadows = SPLASH.darkness;


// Every curse on everything you carry and wear lifts (the item becomes plain, +0).
// Returns how many there were.
export function liftCurses(p) {
  let lifted = 0;
  for (const it of carried(p))
    if (isGear(it) && it.ench < 0) { regear(p, it, (o) => { o.ench = 0; o.known = true; }); lifted++; }
  return lifted;
}

// Count down your timed effects (status.js) and regenerate. Called with game time: real time in 3D,
// action time on the map; skipTime (time.js) calls it with whole chunks, so everything here is exact
// for any dt.
export function tickEffects(game, dt) {
  const p = game.player;
  updateDrowning(game, p, { canSwim });
  tickStatuses(game, p, dt);
  if (game.mode !== "dead") regenerate(game, p, dt);
}

// Regeneration (perks, rings, armour of the stars; Brann's Lantern in the dark): 1 HP every
// 12/points seconds. A cursed ring of regeneration (negative points) drains you instead. Burning (and,
// with the attribute formulas, poison) stops it. The attribute formulas add natural regeneration,
// 1 HP every regenEvery(p) seconds (stats.js; none in the legacy set). Back at full health the counter
// starts again from nothing, so a long catch-up can't bank healing.
export function regenerate(game, p, dt) {
  const regen = bonus(p, "regen") + (p.torch ? 0 : bonus(p, "darkRegen"));
  const blocked = statusFlag(p, "noRegen");
  const heal = (key, every) => {
    if (blocked || !(every < Infinity) || p.hp >= maxHp(p)) return;
    p[key] = (p[key] || 0) + dt;
    while (p[key] >= every - 1e-9 && p.hp < maxHp(p)) { p[key] -= every; p.hp++; }
    if (p.hp >= maxHp(p)) p[key] = 0;
  };
  if (regen > 0) heal("regenTick", 12 / regen);
  else if (regen < 0) {
    p.regenTick = (p.regenTick || 0) + dt;
    const every = 12 / -regen;
    while (p.regenTick >= every - 1e-9 && game.mode !== "dead") { p.regenTick -= every; if (p.hp > 1) p.hp--; }
  }
  heal("naturalTick", regenEvery(p));
}

// Seconds until regenerate() next changes your HP (Infinity if it won't): skipTime steps from event to
// event, so poison and healing interleave exactly as when the time is played out.
export function nextRegenEvent(p) {
  const regen = bonus(p, "regen") + (p.torch ? 0 : bonus(p, "darkRegen"));
  let t = Infinity;
  if (regen < 0) t = 12 / -regen - (p.regenTick || 0);
  else if (!statusFlag(p, "noRegen") && p.hp < maxHp(p)) {
    if (regen > 0) t = 12 / regen - (p.regenTick || 0);
    const every = regenEvery(p);
    if (every < Infinity) t = Math.min(t, every - (p.naturalTick || 0));
  }
  return Math.max(0, t);
}

// Potion of seeing, part 1: every open space on the floor (and the walls around it) appears
// on the map, and every monster is shown where it stands right now. Chasms still look like floor.
export function revealFloor(game) {
  const { zone } = game;
  const { w, d } = zone;
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      if (zone.get(x, y, FLOOR_Z) && zone.get(x, y, FLOOR_Z + 1)) continue;   // solid at body height
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < d) zone.seen[nx + ny * w] = 1;
        }
    }
  for (const m of hostilesTo(game, game.player)) {   // (people show anyway: the whole floor is seen now)
    zone.sightings.set(m.id, { x: m.x, y: m.y, glyph: m.glyph, color: m.color, name: m.name, time: game.time });
  }
}

// Potion of seeing, part 2: you sense whether each thing you carry is good, neutral or bad —
// potions and scrolls by kind (so it covers that colour / title for good), gear piece by piece.
function senseAuras(game) {
  const p = game.player;
  for (const it of carried(p)) {
    if (it.kind === "potion") game.auraKnown.add(`potion:${it.effect}`);
    else if (it.kind === "scroll") game.auraKnown.add(`scroll:${it.effect}`);
    else if (isGear(it)) it.auraKnown = true;
  }
}
