// Experience and levels. Kills give XP; every level gives +3 max HP and a choice of one of
// three permanent perks (the game pauses while you choose: 1 / 2 / 3 or click — the screen
// itself is drawn by hud.js). Every fifth level is a milestone: four choices, one of them a
// rare "major" perk. Some perks can be taken again, for a stronger rank (max: how many times).
// bonus(rank): what the perk adds to the stat bus (stats.js bonus(), the "powers" source).
import { sfx } from "./sfx.js";
import { invalidateStats, raiseAttr, raiseMaxHp } from "./stats.js";
import { RULES } from "./rules.js";

export const PERKS = {
  swimmer:      { name: "Swimmer",       info: "Deep water no longer drags you down: you can swim in it (slowly).", bonus: () => ({ swim: 1 }) },
  brightTorch:  { name: "Bright torch",  info: "Your torch burns brighter and reaches half again as far.", bonus: () => ({ torch: 0.5 }) },
  tough:        { name: "Tough",         info: "+8 max HP.", max: 3 },
  mighty:       { name: "Mighty",        info: "+2 STR.", max: 2 },
  fleet:        { name: "Fleet-footed",  info: "You move 20% faster, in 3D and on the map.", bonus: () => ({ speed: 0.2 }) },
  stealthy:     { name: "Stealthy",      info: "Monsters have to be 30% closer to notice you.", bonus: () => ({ stealth: 0.3 }) },
  leaper:       { name: "High jumper",   info: "You jump a block higher, about 2.5 (and climb 2 blocks on the map).", bonus: () => ({ jump: 1 }) },
  regen:        { name: "Regeneration",  info: "You slowly heal: 1 HP every 6 seconds (every 3 at rank II).", max: 2, bonus: (r) => ({ regen: 2 * r }) },
  cartographer: { name: "Cartographer",  info: "Chasms and pits show on the map as soon as you see them, from either view." },
  quick:        { name: "Quick strikes", info: "Your attacks are 20% faster.", max: 2, bonus: (r) => ({ swing: 0.2 * r }) },
  ironSkin:     { name: "Iron skin",     info: "+1 armour, always.", max: 2, bonus: (r) => ({ armour: r }) },
  featherFall:  { name: "Feather fall",  info: "Falling never hurts you.", bonus: () => ({ featherFall: 1 }) },
  keenEye:      { name: "Keen eye",      info: "+8% chance to land a critical hit (double damage).", max: 2, bonus: (r) => ({ crit: 0.08 * r }) },
  executioner:  { name: "Executioner",   info: "+50% damage against monsters below a quarter of their health." },
  juggler:      { name: "Knife juggler", info: "Thrown knives do +2 damage, and you throw twice as fast." },
  demolitionist:{ name: "Demolitionist", info: "Your bombs blast wider, and hurt you only half as much." },
  alchemist:    { name: "Alchemist",     info: "Potions of healing heal half again as much (18 HP)." },
  scholar:      { name: "Scholar",       info: "You can tell whether an unread scroll is good, neutral or bad." },
  haggler:      { name: "Haggler",       info: "Pell charges you a fifth less, for goods and services." },
  thickBlood:   { name: "Thick blood",   info: "Poison hurts you only half as often." },
  nightEyes:    { name: "Night eyes",    info: "With your torch out you can still see a little way around you.", bonus: () => ({ darkSight: 2 }) },
  // Major perks: only offered at milestones (levels 5, 10, 15…).
  secondWind:   { name: "Second wind",   get info() { return `A blow that would kill you leaves you on 1 HP instead (at most once every ${RULES.cooldown.secondWind / 60} minutes).`; }, major: true },
  lucky:        { name: "Lucky",         info: "Monsters drop loot twice as often, and the gear they drop is more often blessed.", major: true },
  foldingStrike:{ name: "Folding strike", info: "Turning the world (Tab) stuns every monster next to you for 2 s (every 10 s at most).", major: true },
  giantSlayer:  { name: "Giant slayer",  info: "+30% damage against elites, guardians and the Lich King.", major: true },
};

const ROMAN = ["", "", " II", " III", " IV"];
export const perkRank = (p, key) => p.perkRank?.[key] || (p.perks.has(key) ? 1 : 0);
export const perkLabel = (p, key) => PERKS[key].name + ROMAN[perkRank(p, key) + 1];   // the name of the rank you'd get next

// XP needed to go from this level to the next: 20, 50, 100, 170, 260, … — each level takes
// noticeably longer than the last (roughly one level every floor or two).
export const xpToNext = (level) => 10 * level * level + 10;

export function gainXp(game, amount) {
  const p = game.player;
  p.xp += amount;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;            // max HP follows the level (stats.js maxHp)
    p.hp += 3;
    p.pendingLevels++;
    sfx("levelup");
    game.log(`You reach level ${p.level}${p.level % 5 === 0 ? " (a milestone!)" : ""}! (+3 max HP)`, [255, 230, 120]);
  }
}

// Three different perks you could still take (or raise a rank); at a milestone, four, the
// first of them a major perk if any are left.
export function offerPerks(p, milestone = false) {
  const open = (k) => perkRank(p, k) < (PERKS[k].max || 1);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const minor = shuffle(Object.keys(PERKS).filter((k) => open(k) && !PERKS[k].major));
  const major = shuffle(Object.keys(PERKS).filter((k) => open(k) && PERKS[k].major));
  if (!milestone) return minor.slice(0, 3);
  return [...major.slice(0, 1), ...minor].slice(0, 4);
}

export function takePerk(game, key) {
  const p = game.player;
  const r = perkRank(p, key) + 1;
  p.perks.add(key);
  (p.perkRank ||= {})[key] = r;
  invalidateStats(p);
  if (key === "tough") { raiseMaxHp(p, 8); p.hp += 8; }
  if (key === "mighty") raiseAttr(p, "str", 2);
  game.log(`You gain a perk: ${PERKS[key].name}${r > 1 ? ROMAN[r] : ""}. ${PERKS[key].info}`, [255, 230, 120]);
}
