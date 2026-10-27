// The Kindling (TECH_DESIGN §4.2 `ritual`, §2.14; DECISIONS §1 "Bonding"; bible §3.3, §15.6 "Kindling"; owner WS6b).
// To kindle with someone is to share a way of seeing, and each way belongs to a view:
//
//   the Tracing    the map: beside them, draw a line from your tile to theirs; 1 ink (a vial of it) or 1 glim
//   the Lighting   3D with your torch lit, within 2 tiles and facing them: pour 1 glim into their lamp
//   the Snuffing   3D in the dark, your torch out, within 2 tiles: sit with them one world hour (a wait)
//
// Who: only named creatures (c.named, its type's `named`, a legend or a boss) with a faction, not hostile to you,
// with your rep with its faction above −250, and never while you bear the Snuffer's mark. A faction keeps its
// readings (content/factions.js `rite`: "deep", "deep or flat", "flat only", "dark only", "none"): any rite will do
// unless it says "only", and one done in its own reading earns +40 with its faction; "none" (the Askew) can't be
// kindled. Pouring 1 unit of its sacrament (a vial of its liquid; the Unlit take any) during the rite adds +20.
//
// The bond (once per creature): every faction with an opinion of it moves (loves +80, likes +40, dislikes −40,
// hates −80); gains grow 10% per EGO modifier point. The opinions are c.opinions ([[factionId, "loves" | "likes" |
// "dislikes" | "hates", why]]) when content gives them, else made from its faction: its own faction likes it, so do
// the factions that like its faction, the ones that hate its faction dislike it, and one petty opinion more, seeded
// by the creature (a love or a hate, with its reason). You and it are flame-kin from then on; XP: 0.08 × lvlXP.
//
// After the bond your rep with its faction is currency (the menu, screens/ritual.js): give a reading it wants +35, a
// rumour +60; ask for one of its readings −40; learn a power it teaches −50 / −100 / −150 by rank (requirements
// waived); recruit it −(150 + 15 × (its level − yours)), at least −60, with at most 2 Kindled followers (3 at EGO 20+);
// buy its best item (merchants) −(value / 5), at least −10. At most +120 net from any one creature. A cost may not
// take your rep with its faction to −250 or below (this workstream's rule: below that it wouldn't kindle with you).
// A later rite with flame-kin gives nothing, or +20 with the Warm Hands power, within the cap.
//
// Oathbreaking: killing a flame-kin yourself ("kill" with you as the source; falls and your followers don't count)
// costs −120 with every faction and marks you the Snuffer: the Lantern Moths drop to −600, and for 7 world days
// prices are +20% (social/merchants.js) and nobody will kindle with you. (Your torch's radius −1 and no shadow in 3D
// are the renderer's: integration request.)
//
//   openRitual(game, c, { onPop })   the flame-kin menu (screens/ritual.js)
//   RITES = { tracing, lighting, snuffing }   readingsOf(factionId) → { set: Set, only: bool }
//   canKindle(game, c) → null | why             riteReady(game, c, rite) → null | why
//   performRite(game, c, rite) → { ok, text, changes }    kin(game, c) → record | null    kinKey(game, c)
//   opinionsOf(game, c) → [[factionId, opinion, why]]     ritualRows(game, c) → [row]   ritualRow(game, c, row) → { ok, line }
//   game.state.kindling = { kin: { [key]: { faction, name, rite, at, net, follower? } }, followers: [key] }
//   game.state.snuffer = { until, at }
import { FACTIONS, repOf, addRep, attitude, membershipsOf, relation } from "../factions.js";
import { node, bye, talkTo, registerTalkOptions } from "../talk.js";
import { typeOf } from "../creatures.js";
import { pay, funds, formatPrice } from "../currency.js";
import { mod, attr } from "../stats.js";
import { RULES, extendRules } from "../rules.js";
import { on } from "../events.js";
import { pushMode } from "../screens.js";
import { inDark } from "../light.js";
import { lineOfSight } from "../raycast.js";
import { skipTime } from "../time.js";
import { hasKey } from "../keyset.js";
import { itemPrice, itemName, addToInventory, ITEM_KINDS, takeOne } from "../items.js";
import { hashInt } from "../rng.js";
import * as leveling from "../leveling.js";
import * as ai from "../ai.js";
import * as secrets from "../story/secrets.js";
import { isSacrament, liquidName, sameLiquid } from "./liquids.js";
import { isMerchant, bestStock, snuffed } from "./merchants.js";

export const KINDLING = extendRules("kindling", {
  bond: { loves: 80, likes: 40, dislikes: -40, hates: -80 }, ownReading: 40, sacrament: 20,
  egoGain: 0.1, cap: 120, floor: -250, warmHands: 20, xp: 0.08,
  menu: { reading: 35, rumour: 60, askReading: -40, power: [-50, -100, -150], recruit: { base: 150, perLevel: 15, min: 60 },
          best: { div: 5, min: 10 } },
  followers: 2, followersAtEgo: [20, 3],
  tracing: { reach: 1, glim: 1 }, lighting: { reach: 2, facing: Math.PI / 4, glim: 1 }, snuffing: { reach: 2, hours: 1 },
  oath: { all: -120, moths: -600, days: 7 },
});

export const RITES = {
  tracing: { name: "the Tracing", reading: "flat", words: ["Here is my line.", "Here it meets mine."],
    how: "on the map, standing beside me: a line from your tile to mine (1 ink, or 1 glim used as ink)" },
  lighting: { name: "the Lighting", reading: "deep", words: ["My light on your wick. See by it.", "Your wick in my light. I see."],
    how: "face to face in the deep view, your torch lit, two steps from me at most (1 glim into my lamp)" },
  snuffing: { name: "the Snuffing", reading: "dark", words: null,
    how: "both lights out, in the dark, close by: sit with me an hour" },
};
const RITE_OF = { flat: "tracing", deep: "lighting", dark: "snuffing" };

export function readingsOf(factionId) {
  const r = String(FACTIONS[factionId]?.rite || "none");
  const set = new Set(["flat", "deep", "dark"].filter((k) => new RegExp(`\\b${k}\\b`).test(r)));
  return { set, only: /\b(flat|deep|dark) only\b/.test(r) };
}

const mainFaction = (c) => {
  let best = null;
  for (const [id, w] of membershipsOf(c)) if (!FACTIONS[id]?.hidden && (!best || w > best[1])) best = [id, w];
  return best?.[0] ?? null;
};
const isNamed = (c) => !!(c.named || typeOf(c)?.named || c.legend || c.boss);
const kstate = (game) => (game.state.kindling ||= { kin: {}, followers: [] });
export const kinKey = (game, c) => c.uid ?? `${game.zone?.key ?? "?"}#${c.id}`;
export const kin = (game, c) => game.state?.kindling?.kin?.[kinKey(game, c)] || null;
const egoFactor = (game) => Math.max(0, 1 + KINDLING.egoGain * mod(game.player, "ego"));
const worldHour = () => 60 * RULES.clock.secondsPerMinute;   // one world hour: 60 s of game time (DECISIONS)

export function canKindle(game, c) {
  if (!c?.talk) return "It has nothing to say.";
  const f = mainFaction(c);
  if (!isNamed(c) || !f) return "Only someone with a name of their own, and a people, can be kindled with.";
  if (!readingsOf(f).set.size) return `${FACTIONS[f].name} don't kindle. They re-angle.`;
  if (snuffed(game)) return "You cast no shadow. Nobody kindles with a Snuffer.";
  if (attitude(game, c, game.player) === "hostile") return "Not with someone out for you.";
  if (repOf(game, f) <= KINDLING.floor) return `${FACTIONS[f].name} think too little of you.`;
  return null;
}

// Which rites it accepts: its own readings if they're "only", else all three.
const ritesFor = (c) => {
  const { set, only } = readingsOf(mainFaction(c));
  return Object.keys(RITES).filter((r) => !only || set.has(RITES[r].reading));
};

const tileDist = (a, b) => Math.max(Math.abs(Math.floor(a.x) - Math.floor(b.x)), Math.abs(Math.floor(a.y) - Math.floor(b.y)));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const facing = (p, c) => {
  const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy);
  if (d < 1e-6) return true;
  return (Math.cos(p.yaw) * dx + Math.sin(p.yaw) * dy) / d >= Math.cos(KINDLING.lighting.facing);
};
const inkVial = (p) => (p.inv || []).find((it) => it.kind === "vial" && sameLiquid(it.effect, "ink"));

// Each rite is done together: on one level (a step up or down at most) and in sight of each other, not through a
// wall or across a cliff.
const together = (game, p, c) => Math.abs((c.z || 0) - (p.z || 0)) <= 1 &&
  lineOfSight(game.zone, p.x, p.y, p.z + 1.5, c.x, c.y, (c.z || 0) + 1.4);

export function riteReady(game, c, rite) {
  const p = game.player, K = KINDLING;
  if (!ritesFor(c).includes(rite)) return `${FACTIONS[mainFaction(c)].name} don't take ${RITES[rite].name}.`;
  if (rite === "tracing") {
    if (game.view !== "map") return "The Tracing is drawn on the map.";
    if (tileDist(p, c) > K.tracing.reach || !together(game, p, c)) return "Stand beside them to draw the line.";
    if (!inkVial(p) && funds(p) < K.tracing.glim) return "You have neither ink nor glim to draw the line with.";
    return null;
  }
  if (game.view === "map") return `${cap(RITES[rite].name)} is done in the deep view, not on the map.`;
  if (rite === "lighting") {
    if (!p.torch) return "Your torch has to be lit.";
    if (dist(p, c) > K.lighting.reach + 0.5 || !together(game, p, c)) return "Come within two steps, where you can see each other.";
    if (!facing(p, c)) return "Face them.";
    return null;
  }
  if (p.torch) return "Your torch has to be out.";
  if (!inDark(game, game.zone, p.x, p.y, p.z + 0.5)) return "It has to be dark here.";
  if (dist(p, c) > K.snuffing.reach + 0.5 || !together(game, p, c)) return "Sit closer, on the same floor.";
  return null;
}

// --- Opinions ------------------------------------------------------------------------------------------------------
const PETTY = {
  loves: ["it remembered a name nobody else did", "it carried a lamp three days to a funeral", "it gave a fair price, once",
    "it sang the right song at the right wake", "it found a lost child on the Flats"],
  hates: ["it laughed during a sermon", "it owes a lamp and won't say so", "it took the last dry bench", "it measures everything twice",
    "it told the wrong story at a wedding"],
};
export function opinionsOf(game, c) {
  if (Array.isArray(c.opinions)) return c.opinions;
  const own = mainFaction(c), out = [];
  if (!own) return out;
  out.push([own, "likes", "one of ours"]);
  for (const f of Object.values(FACTIONS)) {
    if (f.hidden || f.group || f.id === own) continue;
    const r = relation(f.id, own);   // (through a parent group too: the Assize hate Hollowmere as Bent)
    if (r === 1) out.push([f.id, "likes", `${f.name} like ${FACTIONS[own].name}`]);
    else if (r === -1) out.push([f.id, "dislikes", `${f.name} hate ${FACTIONS[own].name}`]);
  }
  const open = Object.values(FACTIONS).filter((f) => !f.hidden && !f.group && !out.some(([id]) => id === f.id)).map((f) => f.id);
  if (open.length) {
    const h = hashInt(game.seed ?? 0, "opinion", kinKey(game, c), c.name || "");
    const op = h % 2 ? "loves" : "hates", list = PETTY[op];
    out.push([open[(h >>> 1) % open.length], op, list[(h >>> 8) % list.length]]);
  }
  return out;
}

// --- The rite ------------------------------------------------------------------------------------------------------
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
function sacramentVial(game, c) {
  const f = mainFaction(c);
  return (game.player.inv || []).find((it) => it.kind === "vial" && it.effect && isSacrament(f, it.effect)) || null;
}

export function performRite(game, c, rite) {
  const no = canKindle(game, c) ?? riteReady(game, c, rite);
  if (no) return { ok: false, text: no, changes: {} };
  const p = game.player, f = mainFaction(c), R = RITES[rite], K = KINDLING;
  // The cost.
  if (rite === "tracing") {
    const ink = inkVial(p);
    if (ink) { takeOne(p, ink); addToInventory(p, { kind: "vial", effect: "" }); }
    else if (!pay(game, p, K.tracing.glim)) return { ok: false, text: "You have neither ink nor glim to draw with.", changes: {} };
  } else if (rite === "lighting") {
    if (!pay(game, p, K.lighting.glim)) return { ok: false, text: `Their lamp wants ${formatPrice(K.lighting.glim)}, and your purse is dry.`, changes: {} };
  } else {
    const r = skipTime(game, K.snuffing.hours * worldHour(), { reason: "kindling" });
    if (r.interrupted) return { ok: false, text: "Something moves in the dark, and the hour breaks before it's out.", changes: {} };
  }
  const ks = kstate(game), key = kinKey(game, c), was = ks.kin[key];
  const sac = was ? null : sacramentVial(game, c);   // poured at the bond only: later, it would earn nothing
  const poured = sac?.effect ?? null;
  if (sac) { takeOne(p, sac); addToInventory(p, { kind: "vial", effect: "" }); }
  const changes = {}, ego = egoFactor(game);
  const gain = (id, n) => { const m = n > 0 ? Math.round(n * ego) : n; if (m) { changes[id] = (changes[id] || 0) + m; } };
  if (was) {   // a later Kindling: Warm Hands' +20 (EGO's share first), within the cap
    const room = K.cap - (was.net || 0), n = hasKey(p.perks, "warmHands") ? Math.min(Math.round(K.warmHands * ego), room) : 0;
    if (n > 0) { changes[f] = n; was.net = (was.net || 0) + n; }
  } else {
    for (const [id, op] of opinionsOf(game, c)) if (FACTIONS[id] && K.bond[op]) gain(id, K.bond[op]);
    if (readingsOf(f).set.has(R.reading)) gain(f, K.ownReading);
    if (sac) gain(f, K.sacrament);
    ks.kin[key] = { faction: f, name: c.name || typeOf(c)?.name, rite, at: game.time || 0, net: 0 };
    const lv = c.level || 1, xp = leveling.xpReward ? leveling.xpReward("kindling", lv) : Math.round(K.xp * leveling.xpToNext(lv));
    if (xp > 0) leveling.gainXp(game, xp, { source: "kindling" });
  }
  for (const [id, n] of Object.entries(changes)) addRep(game, id, n, "kindling");
  const words = R.words ? `"${R.words[0]}"\n"${R.words[1]}"\n\n` : "You sit together in the dark for an hour. Nobody says anything. That's the point.\n\n";
  const moved = Object.entries(changes).map(([id, n]) => `${FACTIONS[id].name} ${signed(n)}`).join(", ");
  const what = was ? (moved ? `The old flame catches again. (${moved})` : "The old flame is still lit. Nothing more comes of it.")
    : `You and ${c.name} are flame-kin.${poured ? ` You poured the ${liquidName(poured)}.` : ""}${moved ? ` (${moved})` : ""}`;
  game.log(was ? what : `${cap(R.name)} with ${c.name}: ${what}`, [255, 220, 150]);
  return { ok: true, text: words + what, changes };
}

// --- The talk option ------------------------------------------------------------------------------------------------
function riteNode(game, c) {
  const f = mainFaction(c), { set, only } = readingsOf(f), rites = ritesFor(c);
  const own = [...set].map((r) => RITES[RITE_OF[r]].name).join(" or ");
  const ways = rites.map((r) => `${RITES[r].name}: ${RITES[r].how}`).join(". ");
  const opts = [];
  for (const r of rites) if (!riteReady(game, c, r))
    opts.push({ label: `${cap(RITES[r].name)}.`, go: () => {
      const out = performRite(game, c, r);
      return node(out.text, out.ok ? [{ label: "Sit with me a while.", go: () => ({ ritual: true }) }, bye()] : [{ label: "Back.", go: () => talkTo(game, c) }, bye()]);
    } });
  const text = `${only ? "Only one way for us" : "There are ways"}: ${ways}. ${FACTIONS[f].name} keep ${own}.` +
    (opts.length ? "" : " Not here. Not like this.");
  return node(text, [...opts, { label: "Back.", go: () => talkTo(game, c) }, bye()]);
}

registerTalkOptions("kindling", (game, c) => {
  if (!c.talk || !isNamed(c) || !mainFaction(c) || !game.state) return null;
  if (kin(game, c)) {
    const opts = [{ label: "Sit with me a while, flame-kin.", go: () => ({ ritual: true }) }];
    const again = ritesFor(c).filter((r) => !riteReady(game, c, r));
    if (again.length && hasKey(game.player.perks, "warmHands")) opts.push({ label: "Kindle again.", go: () => riteNode(game, c) });
    return opts;
  }
  const no = canKindle(game, c);
  if (no && !snuffed(game)) return null;
  return [{ label: "Will you kindle with me?", go: () => (no ? node(no, [bye()]) : riteNode(game, c)) }];
}, { priority: -1 });

// --- The flame-kin menu -------------------------------------------------------------------------------------------
const followerCap = (game) => (attr(game.player, "ego") >= KINDLING.followersAtEgo[0] ? KINDLING.followersAtEgo[1] : KINDLING.followers);
export const recruitCost = (game, c) => -Math.max(KINDLING.menu.recruit.min,
  KINDLING.menu.recruit.base + KINDLING.menu.recruit.perLevel * ((c.level || 1) - (game.player.level || 1)));
const bestCost = (it) => -Math.max(KINDLING.menu.best.min, Math.round(itemPrice(it) / KINDLING.menu.best.div));

function journalSecrets(game) {
  const js = game.state?.journal?.secrets || {};
  return Object.entries(js).map(([id, s]) => ({ id, ...s }));
}
const secretText = (s) => (typeof s.text === "string" ? s.text : s.title || s.id);
function wants(f, s) {
  const def = FACTIONS[f];
  if (def.buys) return (!def.buys.readings || def.buys.readings.includes(s.reading)) && (!def.buys.topics || def.buys.topics.includes(s.kind));
  return !s.reading || readingsOf(f).set.has(s.reading);
}
const isRumour = (s) => s.kind === "gossip" || String(s.id).startsWith("gossip:");
const canLearn = () => secrets.STUB === undefined;

// One row: { label, n (the rep it moves), why? (why it can't), run() → line }.
export function ritualRows(game, c) {
  const k = kin(game, c);
  if (!k) return [];
  const f = k.faction, M = KINDLING.menu, rows = [], p = game.player;
  for (const s of journalSecrets(game)) if (!s.sold && wants(f, s)) {
    const n = isRumour(s) ? M.rumour : M.reading;
    rows.push({ id: `give:${s.id}`, label: `Give ${isRumour(s) ? "the rumour" : "the reading"}: ${secretText(s)}`, n, run: () => {
      game.state.journal.secrets[s.id].sold = true;
      return `${c.name} takes it in, and turns it over.`;
    } });
  }
  if (canLearn()) for (const id of c.readings || typeOf(c)?.readings || [])
    if (!game.state?.journal?.secrets?.[id]) rows.push({ id: `ask:${id}`, label: "Ask for one of its readings", n: M.askReading, run: () => {
      secrets.learnSecret(game, id, "kindling");
      return `${c.name} tells you something you didn't know.`;
    } });
  for (const key of c.teaches || typeOf(c)?.teaches || []) {
    const P = leveling.PERKS[key];
    if (!P) continue;
    const r = leveling.perkRank(p, key) + 1;
    if (r > (P.max || 1)) continue;
    rows.push({ id: `power:${key}`, label: `Learn ${leveling.perkLabel(p, key)}`, n: M.power[Math.min(r, 3) - 1], run: () => {
      leveling.takePerk(game, key);
      return `${c.name} shows you how. It takes a while, and then it doesn't.`;
    } });
  }
  if (c.brain?.leader !== "player") {
    const full = (kstate(game).followers || []).length >= followerCap(game);
    rows.push({ id: "recruit", label: `Ask ${c.name} to walk with you`, n: recruitCost(game, c),
      why: full ? `You already walk with ${followerCap(game)} flame-kin.` : null, run: () => {
        if (ai.recruit) ai.recruit(game, c); else { (c.brain ||= {}).leader = "player"; c.brain.target = null; }
        const ks = kstate(game);
        ks.followers = [...(ks.followers || []).filter((x) => x !== kinKey(game, c)), kinKey(game, c)];
        k.follower = true;
        return `${c.name} picks up a lamp and falls in beside you.`;
      } });
  }
  if (isMerchant(c)) {
    const best = bestStock(game, c);
    if (best) rows.push({ id: "best", label: `Ask for the best thing it has: ${itemName(game, { ...best.item, count: 1 })}`, n: bestCost(best.item), run: () => {
      best.count--;
      if (!ITEM_KINDS[best.item.kind]?.onPickup?.(game, p, { ...best.item })) addToInventory(p, { ...best.item, count: 1 });
      return `${c.name} wraps it in cloth and hands it over. No glim changes hands.`;
    } });
  }
  return rows;
}

export function ritualRow(game, c, row) {
  const k = kin(game, c);
  if (!k || !row) return { ok: false, line: "" };
  const f = k.faction, K = KINDLING;
  if (row.why) { game.log(row.why, [255, 150, 120]); return { ok: false, line: row.why }; }
  let n = row.n;
  if (n > 0) {
    n = Math.min(Math.round(n * egoFactor(game)), K.cap - (k.net || 0));
    if (n <= 0) { const line = `${c.name} has given you all it will. (+${K.cap} at most from one flame-kin)`; game.log(line, [255, 150, 120]); return { ok: false, line }; }
  } else if (repOf(game, f) + n <= K.floor) {
    const line = `${FACTIONS[f].name} won't stretch that far for you. (Your standing would fall to ${repOf(game, f) + n}.)`;
    game.log(line, [255, 150, 120]);
    return { ok: false, line };
  }
  const said = row.run();
  addRep(game, f, n, "kindling");
  k.net = (k.net || 0) + n;
  const line = `${said} (${FACTIONS[f].name} ${signed(n)})`;
  game.log(line, [255, 220, 150]);
  return { ok: true, line };
}

export function openRitual(game, c, { onPop } = {}) {
  game.travel = null;
  game.ritual = { npc: c, sel: 0, top: 0, said: "" };
  pushMode(game, "ritual", onPop ? { onPop } : null);
  return game.ritual;
}

// --- Oathbreaking ------------------------------------------------------------------------------------------------------
on("kill", (game, { c, src }) => {
  if (!c || !game.state?.kindling || src !== game.player) return;
  const ks = game.state.kindling, key = kinKey(game, c);
  if (!ks.kin[key]) return;
  ks.followers = (ks.followers || []).filter((x) => x !== key);
  const K = KINDLING.oath;
  for (const f of Object.values(FACTIONS)) if (!f.hidden && !f.group) addRep(game, f.id, K.all, "oathbreaking");
  if (FACTIONS.moths && repOf(game, "moths") > K.moths) addRep(game, "moths", K.moths - repOf(game, "moths"), "oathbreaking");
  game.state.snuffer = { at: game.time || 0, until: (game.time || 0) + K.days * 24 * worldHour() };
  delete ks.kin[key];
  game.log(`You killed ${c.name}, your flame-kin. Every lamp you pass will know it. (−120 with everyone; the Snuffer)`, [255, 110, 100]);
});
// A follower that dies (by anyone) frees its place.
on("kill", (game, { c }) => {
  const ks = game.state?.kindling;
  if (c && ks?.followers?.length) ks.followers = ks.followers.filter((x) => x !== kinKey(game, c));
});
