// What potions and scrolls do, and the timed effects they leave on you
// (flying, haste, shadows, poison, paralysis, darkness), plus the Regeneration perk.
import { POTIONS, POTION_COLORS, SCROLLS, ELEMENTS, WEAPONS, itemName, isGear } from "./items.js";
import { bonus, regear } from "./player.js";
import { wielded, carried } from "./body.js";
import { maxHp, raiseAttr, regenEvery, canSwim } from "./stats.js";
import { addStatus, tickStatuses, statusFlag, updateDrowning } from "./status.js";
import { FLOOR_Z } from "./world.js";
import { sfx } from "./sfx.js";
import { spawnCreature, addCreature, pickCreatureType, hostilesTo, canTalk } from "./creatures.js";
import { arrivalPoint } from "./zones.js";

export function drinkPotion(game, effect) {
  const p = game.player;
  sfx("drink");
  const color = POTION_COLORS[game.potionColor[effect]];
  const unknown = !game.knownPotions.has(effect);
  game.knownPotions.add(effect);
  if (unknown) game.log(`You drink the ${color.name} potion. It's a potion of ${POTIONS[effect].name}!`, color.rgb);

  switch (effect) {
    case "healing": {
      const heal = p.perks.has("alchemist") ? 18 : 12;
      p.hp = Math.min(maxHp(p), p.hp + heal);
      game.log(`Warmth spreads through you. (+${heal} HP)`, [230, 90, 110]);
      break;
    }
    case "strength":
      raiseAttr(p, "str", 1);
      game.log("Your muscles swell. STR +1!", [255, 170, 80]);
      break;
    case "flying":
      addStatus(game, p, "flying", { t: 20, stack: "refresh" });
      game.log(game.view === "map" ? "You float up into the air! Fly over chasms and water for 20 s."
                                   : "You float up into the air! Space rises, C sinks. 20 s.", [160, 220, 255]);
      break;
    case "haste":
      addStatus(game, p, "hasted", { t: 15, stack: "refresh" });
      game.log("Everything around you slows down. You're fast!", [255, 240, 120]);
      break;
    case "seeing":
      revealFloor(game);
      senseAuras(game);
      game.log("Your mind's eye opens: the floor unfolds on your map, and you sense the nature of all you carry.", [200, 160, 255]);
      break;
    case "shadows":
      addStatus(game, p, "shadowed", { t: 30, stack: "refresh" });
      game.log("Shadows cling to you. Monsters will struggle to notice you.", [140, 130, 170]);
      break;
    case "descent":
      if (!game.zone.hasBelow) { game.log("You grow light, then heavy... but the floor here is warded. Nothing happens.", [180, 170, 140]); break; }
      game.log("You grow light, then heavy... and sink right through the floor.", [180, 170, 140]);
      game.fallThrough();
      break;
    case "poison":
      addStatus(game, p, "poisoned", { t: 6, stack: "refresh" });
      game.log("You feel very sick...", [150, 200, 80]);
      break;
    case "paralysis":
      addStatus(game, p, "paralyzed", { t: 5, stack: "refresh" });
      game.log("Your limbs lock up! You can't move!", [200, 120, 255]);
      break;
    case "darkness":
      addStatus(game, p, "darkened", { t: 40, stack: "refresh" });
      game.log("Darkness pours from the bottle. Your torch shrinks to a glimmer.", [110, 100, 140]);
      break;
  }
}

// Read a scroll. Returns false if it can't be read right now (nothing happens, nothing used up).
export function readScroll(game, effect) {
  const p = game.player;
  const unknown = !game.knownScrolls.has(effect);
  const title = game.scrollTitle[effect];
  game.knownScrolls.add(effect);
  if (unknown) game.log(`You read "${title}". It's a scroll of ${SCROLLS[effect].name}!`, [235, 220, 175]);
  const weapon = wielded(p), wname = () => itemName(game, weapon);

  switch (effect) {
    case "uncurse": {
      const lifted = liftCurses(p);
      game.log(lifted ? `A warm light washes over your things. Curses lifted: ${lifted}.` : "A warm light washes over you. Nothing was cursed.", [255, 245, 200]);
      break;
    }
    case "fire": case "frost": case "shock": case "holy": {
      const old = weapon.element;
      weapon.element = effect;
      const verb = { fire: "bursts into flame", frost: "frosts over", shock: "crackles with lightning", holy: "shines with holy light" }[effect];
      game.log(`Your ${WEAPONS[weapon.id].name} ${verb}!${old && old !== effect ? ` (It's no longer ${ELEMENTS[old].adj}.)` : ""}`, ELEMENTS[effect].color);
      break;
    }
    case "blessing":
      weapon.ench = Math.min(5, weapon.ench + 1);
      weapon.known = true;
      game.log(`Your weapon glows softly. It's now a ${wname()}.`, [255, 245, 200]);
      break;
    case "teleport": {
      const f = game.zone;
      const at = arrivalPoint(f, "teleport", { rng: Math.random });
      Object.assign(p, { x: at.x, y: at.y, z: at.z, vz: 0 });
      game.travel = null;
      game.log("The world twists around you. You're somewhere else.", [200, 160, 255]);
      break;
    }
    case "summon": {
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
      break;
    }
    case "malice":
      weapon.ench = Math.min(weapon.ench, 0) - 1 - Math.floor(Math.random() * 2);
      weapon.known = true;
      game.log(`Dark energy coils around your weapon. It's cursed! (${wname()}, and it won't leave your hand)`, [200, 80, 120]);
      break;
  }
  return true;
}

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
