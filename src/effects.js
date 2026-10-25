// What potions and scrolls do, and the timed effects they leave on you
// (flying, haste, shadows, poison, paralysis, darkness), plus the Regeneration perk.
import { POTIONS, POTION_COLORS, SCROLLS, ELEMENTS, WEAPONS, itemName, isGear } from "./items.js";
import { bonus, regear, worn } from "./player.js";
import { FLOOR_Z } from "./world.js";
import { sfx } from "./sfx.js";
import { spawnMonster, pickMonsterType } from "./monsters.js";
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
      p.hp = Math.min(p.maxHp, p.hp + heal);
      game.log(`Warmth spreads through you. (+${heal} HP)`, [230, 90, 110]);
      break;
    }
    case "strength":
      p.str += 1;
      game.log("Your muscles swell. STR +1!", [255, 170, 80]);
      break;
    case "flying":
      p.flyTime = 20;
      game.log(game.view === "map" ? "You float up into the air! Fly over chasms and water for 20 s."
                                   : "You float up into the air! Space rises, C sinks. 20 s.", [160, 220, 255]);
      break;
    case "haste":
      p.hasteTime = 15;
      game.log("Everything around you slows down. You're fast!", [255, 240, 120]);
      break;
    case "seeing":
      revealFloor(game);
      senseAuras(game);
      game.log("Your mind's eye opens: the floor unfolds on your map, and you sense the nature of all you carry.", [200, 160, 255]);
      break;
    case "shadows":
      p.shadowTime = 30;
      game.log("Shadows cling to you. Monsters will struggle to notice you.", [140, 130, 170]);
      break;
    case "descent":
      if (!game.zone.hasBelow) { game.log("You grow light, then heavy... but the floor here is warded. Nothing happens.", [180, 170, 140]); break; }
      game.log("You grow light, then heavy... and sink right through the floor.", [180, 170, 140]);
      game.fallThrough();
      break;
    case "poison":
      p.poisonTime = 6;
      game.log("You feel very sick...", [150, 200, 80]);
      break;
    case "paralysis":
      p.paralyzed = 5;
      game.log("Your limbs lock up! You can't move!", [200, 120, 255]);
      break;
    case "darkness":
      p.darkTime = 40;
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
  const wname = () => itemName(game, p.weapon);

  switch (effect) {
    case "uncurse": {
      const lifted = liftCurses(p);
      game.log(lifted ? `A warm light washes over your things. Curses lifted: ${lifted}.` : "A warm light washes over you. Nothing was cursed.", [255, 245, 200]);
      break;
    }
    case "fire": case "frost": case "shock": case "holy": {
      const old = p.weapon.element;
      p.weapon.element = effect;
      const verb = { fire: "bursts into flame", frost: "frosts over", shock: "crackles with lightning", holy: "shines with holy light" }[effect];
      game.log(`Your ${WEAPONS[p.weapon.id].name} ${verb}!${old && old !== effect ? ` (It's no longer ${ELEMENTS[old].adj}.)` : ""}`, ELEMENTS[effect].color);
      break;
    }
    case "blessing":
      p.weapon.ench = Math.min(5, p.weapon.ench + 1);
      p.weapon.known = true;
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
        if (z < 0 || f.monsters.some((m) => m.tx === x && m.ty === y)) continue;
        f.monsters.push(spawnMonster(pickMonsterType(Math.random, game.zone.level), x, y, z, "chase", game.zone.level));
        n++;
      }
      game.log(n ? "The scroll shrieks! Monsters appear around you!" : "The scroll shrieks, but nothing comes.", [255, 120, 100]);
      break;
    }
    case "malice":
      p.weapon.ench = Math.min(p.weapon.ench, 0) - 1 - Math.floor(Math.random() * 2);
      p.weapon.known = true;
      game.log(`Dark energy coils around your weapon. It's cursed! (${wname()}, and it won't leave your hand)`, [200, 80, 120]);
      break;
  }
  return true;
}

// Every curse on everything you carry and wear lifts (the item becomes plain, +0).
// Returns how many there were.
export function liftCurses(p) {
  let lifted = 0;
  for (const it of [...worn(p), p.sidearm, ...p.inv])
    if (isGear(it) && it.ench < 0) { regear(p, it, (o) => { o.ench = 0; o.known = true; }); lifted++; }
  return lifted;
}

// Count down your timed effects. Called with game time: real time in 3D, action time on the map.
export function tickEffects(game, dt) {
  const p = game.player;
  const countdown = (key, warnAt, warning, ended) => {
    if (!(p[key] > 0)) return;
    const before = p[key];
    p[key] -= dt;
    if (warnAt && before > warnAt && p[key] <= warnAt) game.log(warning, [255, 200, 120]);
    if (p[key] <= 0) { p[key] = 0; game.log(ended, [170, 170, 170]); }
  };
  countdown("flyTime", 5, "Your flight is wearing off!", "You're no longer flying.");
  countdown("hasteTime", 0, "", "You slow back down.");
  countdown("shadowTime", 0, "", "The shadows fall away from you.");
  countdown("paralyzed", 0, "", "You can move again.");
  countdown("darkTime", 0, "", "Your torch flares back to life.");
  p.guardTime = Math.max(0, (p.guardTime || 0) - dt);
  if (p.poisonTime > 0) {
    p.poisonTime -= dt;
    p.poisonTick = (p.poisonTick || 0) + dt;
    const every = p.perks.has("thickBlood") ? 2 : 1;
    while (p.poisonTick >= every && game.mode !== "dead") {
      p.poisonTick -= every;
      game.hurtPlayer(1, "poison", true);
    }
    if (p.poisonTime <= 0) { p.poisonTime = 0; p.poisonTick = 0; game.log("The sickness passes.", [170, 170, 170]); }
  }
  // Regeneration (perks, rings, armour of the stars; Brann's Lantern in the dark): 1 HP every
  // 12/points seconds. A cursed ring of regeneration (negative points) drains you instead.
  const regen = bonus(p, "regen") + (p.torch ? 0 : bonus(p, "darkRegen"));
  if (regen > 0 && p.hp < p.maxHp) {
    p.regenTick = (p.regenTick || 0) + dt;
    const every = 12 / regen;
    while (p.regenTick >= every && p.hp < p.maxHp) { p.regenTick -= every; p.hp++; }
  } else if (regen < 0) {
    p.regenTick = (p.regenTick || 0) + dt;
    const every = 12 / -regen;
    while (p.regenTick >= every && game.mode !== "dead") { p.regenTick -= every; if (p.hp > 1) p.hp--; }
  }
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
  for (const m of zone.monsters) {
    zone.sightings.set(m.id, { x: m.x, y: m.y, glyph: m.glyph, color: m.color, name: m.name, time: game.time });
  }
}

// Potion of seeing, part 2: you sense whether each thing you carry is good, neutral or bad —
// potions and scrolls by kind (so it covers that colour / title for good), gear piece by piece.
function senseAuras(game) {
  const p = game.player;
  for (const it of [...worn(p), p.sidearm, ...p.inv].filter(Boolean)) {
    if (it.kind === "potion") game.auraKnown.add(`potion:${it.effect}`);
    else if (it.kind === "scroll") game.auraKnown.add(`scroll:${it.effect}`);
    else if (isGear(it)) it.auraKnown = true;
  }
}
