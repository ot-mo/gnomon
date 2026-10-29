// Tonics (bible §13.8, §10.3; TECH_DESIGN §2.18 "TONICS"; C4): injectors, the kind "tonic" { kind: "tonic", effect: id,
// count }. items/containers.js reaches this file (content/index.js is frozen), late enough that status.js has loaded.
//
//   TONICS[id] = { name, value, info(k), t, scales?, status, odT, use(game, p, k), overdose(game, p), needs? }
//     info       the item's line at strength k (the Bent read half the numbers: the kind passes the player's k)
//     t          how long it works, in seconds (× k where `scales`: hasp and fold-sap halve their time, the rest
//                their numbers); odT how long its overdose works. The chain lasts exactly that long
//     status     the status its use starts: what a passed save for the next one ends
//     use        what it does, at strength k (1 for the Plumb, GENOTYPES.bent.tonics.effect 0.5 for the Bent)
//     overdose   what a failed save or a bad reaction does instead
//   injectTonic(game, p, id, rng = Math.random) → { ok, overdose, k, save? }   what using one does (the kind's E)
//   randomTonic(rand) → { kind: "tonic", effect }   one for loot or stock, by TONIC_WEIGHT
//
// The rules (bible §13.8, §10.3):
//   - one at a time: while one works or its overdose lasts (the hidden status "tonic": its time the tonic's, its mag
//     the number taken in a row, its src the tonic), taking another asks a TOU save, d20 + TOU modifier ≥ 12 + 3 ×
//     that number; a pass ends the one before (its status) and the new one works, a failure is the new one's overdose;
//   - the Bent get half of every number (GENOTYPES[g].tonics.effect) and a 5% chance of a bad reaction (badReaction:
//     the overdose instead); the Plumb get the whole.
// The statuses are named "tonic:…" so no other content's can clash with them.
import { registerItemKind, takeOne } from "../../items.js";
import { addStatus, removeStatus, hasStatus, statusOf, registerStatus } from "../../status.js";
import { maxHp, mod } from "../../stats.js";
import { GENOTYPES } from "../genotypes.js";
import { RULES } from "../../rules.js";

const secs = (s) => Math.max(0, Math.ceil(s.t));
const T = (id, label, def) => registerStatus(`tonic:${id}`, { color: [150, 220, 200], kind: "good", stack: "refresh", hud: (s) => `${label} ${secs(s)}s`, ...def });

// The chain: there while a tonic works; mag = how many were taken in a row.
registerStatus("tonic", { color: [150, 220, 200], kind: "good", t: 15, stack: "refresh", hud: () => null });
// Balm: health over its time, exactly for any steps (status.js advance hands tick the seconds it still runs; the carry
// in s.acc, so a skip heals what playing it out heals).
T("balm", "BALM", { t: 3, tick(game, e, s, dt) {
  if (hasStatus(e, "tonic:sick")) return;   // (an overdone balm: no balm heals for 30 s)
  s.acc += s.mag * 4 * dt;
  const n = Math.floor(s.acc + 1e-9);
  if (n > 0) { s.acc -= n; e.hp = Math.min(maxHp(e), e.hp + n); }
} });
// (darkRange: the bible's 6 tiles with the torch out, for player.js torchRange once it reads a status's: docs/c4.md #10.)
T("gloam", "GLOAM", { t: 60, bonus: (s) => ({ darkSight: 3 * s.mag, stealth: 0.3 * s.mag }), darkRange: (s) => 6 * s.mag });
T("ironbark", "IRONBARK", { t: 60, bonus: (s) => ({ av: Math.round(2 * s.mag), str: Math.round(2 * s.mag) }) });
T("clearwit", "CLEARWIT", { t: 60, bonus: (s) => ({ examine: Math.round(5 * s.mag), int: Math.round(2 * s.mag) }) });
// Overdoses.
T("sick", "SICK", { color: [170, 200, 110], kind: "bad", t: 30, flags: { noRegen: true }, ended: "Your stomach settles." });
T("heavy", "SLOWED", { color: [160, 150, 120], kind: "bad", t: 20, speed: 0.5, ended: "Your legs are your own again." });
// The hasp's crash: when it runs out, 3 s paralysed. A skip over its end (status.js catchUpStatuses lists the statuses
// before any runs, so it would never advance a paralysis added here) runs the paralysis for the time that is left.
const CRASH = 3;
const crash = (game, e, t) => {
  if (t > 1e-9) addStatus(game, e, "paralyzed", { t });
  if (game && e === game.player) game.log("The hasp runs out all at once. You can't move.", [200, 120, 255]);
};
T("crash", "HASP", { kind: "bad", t: 15,
  onEnd(game, e, s, why) { if (why === "expired") crash(game, e, CRASH); },
  catchUp(game, e, s, seconds) {
    if (seconds < s.t - 1e-9) { s.t -= seconds; return; }
    const after = seconds - s.t;
    removeStatus(game, e, "tonic:crash");   // (removed, not expired: its onEnd stays quiet)
    crash(game, e, CRASH - after);
  },
});

const say = (game, p, text, color = [150, 220, 200]) => { if (game && p === game.player) game.log(text, color); };

export const TONICS = {
  balm: {
    name: "balm", value: 25, t: 3, status: "tonic:balm", odT: 30, info: (k) => `Heals ${12 * k} over 3 s. Overdone: no rest or balm mends you for 30 s.`,
    needs: "the overdose's nausea, and no healing from potions either (a nauseous status: C2's brine may share it; effects.js)",
    use: (game, p, k) => { addStatus(game, p, "tonic:balm", { t: 3, mag: k }); say(game, p, `Warmth spreads up your arm. (+${12 * k} HP over 3 s)`, [230, 90, 110]); },
    overdose: (game, p) => { addStatus(game, p, "tonic:sick", { t: 30 }); say(game, p, "The balm curdles. Neither rest nor balm will mend you for a while.", [170, 200, 110]); },
  },
  hasp: {
    name: "hasp", value: 40, t: 15, scales: true, status: "hasted", odT: 18, info: (k) => `Haste for ${15 * k} s. Overdone: then 3 s unable to move.`,
    use: (game, p, k) => { addStatus(game, p, "hasted", { t: 15 * k, stack: "refresh" }); say(game, p, `Everything else slows down. (${15 * k} s)`, [255, 240, 120]); },
    overdose: (game, p) => { addStatus(game, p, "hasted", { t: 15, stack: "refresh" }); addStatus(game, p, "tonic:crash", { t: 15 }); say(game, p, "Your heart races, and keeps racing.", [255, 200, 120]); },
  },
  gloam: {
    name: "gloam", value: 35, t: 60, status: "tonic:gloam", odT: 20, info: (k) => `Dark sight and ${Math.round(30 * k)}% stealth for 60 s. Overdone: dazzled, your torch a glimmer for 20 s.`,
    needs: "6 tiles with the torch out (player.js torchRange caps darkSight at 4 tiles: a status's darkRange); the overdose's true blindness in any light (the blinded status does nothing to the player: torchRange, render3d.js)",
    use: (game, p, k) => { addStatus(game, p, "tonic:gloam", { t: 60, mag: k }); say(game, p, "The dark thins, like ink with water in it.", [150, 140, 200]); },
    overdose: (game, p) => { addStatus(game, p, "darkened", { t: 20 }); say(game, p, "The light is a knife. Your torch shrinks to a glimmer.", [120, 120, 140]); },
  },
  ironbark: {
    name: "ironbark", value: 45, t: 60, status: "tonic:ironbark", odT: 20, info: (k) => `+${Math.round(2 * k)} armour and STR for 60 s. Overdone: half speed for 20 s.`,
    use: (game, p, k) => { addStatus(game, p, "tonic:ironbark", { t: 60, mag: k }); say(game, p, "Your skin goes stiff and brown at the edges.", [170, 140, 100]); },
    overdose: (game, p) => { addStatus(game, p, "tonic:heavy", { t: 20 }); say(game, p, "Your skin goes stiff, and so does everything under it.", [160, 150, 120]); },
  },
  foldSap: {
    name: "fold-sap", value: 50, t: 10, scales: true, status: "flat", odT: 60, info: (k) => `Flat for ${10 * k} s. Overdone: Flat for 60 s.`,
    use: (game, p, k) => { addStatus(game, p, "flat", { t: 10 * k }); say(game, p, `You fold down into the floor. (${10 * k} s)`, [220, 220, 230]); },
    overdose: (game, p) => { addStatus(game, p, "flat", { t: 60 }); say(game, p, "You fold down into the floor, and the floor keeps you.", [220, 220, 230]); },
  },
  clearwit: {
    name: "clearwit", value: 35, t: 60, status: "tonic:clearwit", odT: 1, info: (k) => `+${Math.round(5 * k)} examine, +${Math.round(2 * k)} INT for 60 s. Overdone: you forget this floor's map.`,
    needs: "cures confusion (a confused status: C2's ink, the Muddle mutation)",
    use: (game, p, k) => { addStatus(game, p, "tonic:clearwit", { t: 60, mag: k }); say(game, p, "Everything has edges, and you can count them.", [200, 220, 255]); },
    overdose: (game, p) => {
      // The auto-map and the pits you had looked into: the only thing in the game that forgets them.
      for (const k of ["seen", "holeSeen"]) game?.zone?.[k]?.fill?.(0);
      say(game, p, "You know exactly where you are, and nothing else.", [200, 220, 255]);
    },
  },
};

// A tonic for loot or a shelf: the balm the commonest (bible §3.1's anchor, 25 glim), fold-sap the rarest.
const TONIC_WEIGHT = { balm: 5, hasp: 2, gloam: 2, ironbark: 2, foldSap: 1, clearwit: 2 };
export function randomTonic(rand = Math.random) {
  const total = Object.values(TONIC_WEIGHT).reduce((a, b) => a + b, 0);
  let pick = rand() * total;
  for (const [effect, w] of Object.entries(TONIC_WEIGHT)) if ((pick -= w) < 0) return { kind: "tonic", effect };
  return { kind: "tonic", effect: "balm" };
}

// What a genotype makes of a tonic: { effect, badReaction } (content/genotypes.js; a creature or a quick start: whole).
const reactionOf = (p) => GENOTYPES[p?.genotype]?.tonics || { effect: 1, badReaction: 0 };
export function injectTonic(game, p, id, rng = Math.random) {
  const def = TONICS[id];
  if (!def) return { ok: false };
  const { effect: k = 1, badReaction = 0 } = reactionOf(p);
  const chain = statusOf(p, "tonic");
  let overdose = false, save = null;
  if (chain) {
    const nat = 1 + Math.floor(rng() * 20), dc = 12 + 3 * chain.mag;
    save = { nat, total: nat + mod(p, "tou"), dc };
    overdose = save.total < dc;
    const before = TONICS[chain.src]?.status;
    if (before && hasStatus(p, before)) removeStatus(game, p, before);
  }
  if (!overdose && badReaction && rng() < badReaction) overdose = "bad";
  if (overdose === "bad") say(game, p, "Your blood argues with the tonic.", [255, 150, 120]);
  else if (overdose) say(game, p, `Too many in a row (TOU ${save.total} against ${save.dc}).`, [255, 150, 120]);
  if (overdose) def.overdose(game, p); else def.use(game, p, k);
  const t = overdose ? def.odT : def.scales ? def.t * k : def.t;
  addStatus(game, p, "tonic", { t, mag: (chain?.mag || 0) + 1, src: id, stack: "refresh" });
  statusOf(p, "tonic").t = t;   // (exactly this tonic's time, shorter or longer than what is left of the last)
  return { ok: true, overdose: !!overdose, k, save };
}

registerItemKind("tonic", {
  stack: true, weight: () => 0,
  name: (game, it) => TONICS[it.effect]?.name ? `${TONICS[it.effect].name} tonic` : "tonic",
  glyph: () => ["!", [150, 220, 200]],
  info: (game, it) => TONICS[it.effect]?.info(reactionOf(game?.player).effect ?? 1) || "",
  price: (it) => TONICS[it.effect]?.value || 0,
  art: { w: 0.18, h: 0.4, art: [" s ", " s ", "gtg", "gtg", "gtg", "ggg", " h "] },
  palette: () => ({ s: [[200, 205, 215], 0.1], g: [[180, 150, 90], 0.1], t: [[150, 220, 200], 0.5], h: [[120, 95, 60], 0] }),
  use(game, e, it) {
    if (!TONICS[it.effect]) return 0;
    takeOne(e, it);
    injectTonic(game, e, it.effect);
    return RULES.body.drinkTime;
  },
});
