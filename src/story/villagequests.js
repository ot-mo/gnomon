// The village quests (TECH_DESIGN §2.13; bible §9.6): nine templates on story/quests.js's engine, given by each village's
// named quest-giver, completed by bus events, rewarded at the giver.
//
//   TEMPLATES            recover · carry · readFloor · pray · climb · find · hunt · rescue · chart (QUEST_ORDER)
//   villageQuestId(siteId) → "<site id>:quest"          one per village
//   offerQuest(game, v) → q | null                      starts the village's quest (its giver's "I'll do it.")
//   startVillageQuest(game, siteId, template, params)   the same for any planned template (checks; story/questplan.js)
//   rewardOf(game, q) → { funds, rep: { [factionId]: n }, xp, items: [3 items] }   bible §9.6: 25 × tier glim, +100 with
//                        the village and +25 with each faction that likes it, 0.6 of a level's XP (WS4's
//                        xpReward("villageQuest", level) when it exists), a choice of 1 of 3 items at the village's tier + 1
//   QUEST_THINGS         where each quest's thing, beast or lost villager waits: placed on "zone:prepare" of its zone,
//                        whether or not the quest has been given (bible: "a player who gets there first still finds
//                        it"), once (zone.flags), never a uid that lives elsewhere or died (zones.js claimUid)
//
// Stages (each a bus event; talk options emit their own):
//   recover, climb   fetch  ─ the thing in your pack ("clock:tick", "pickup") ─→ return ─ "quest:turnIn" with it ─→ done
//                    (return ─ the thing gone from your pack, on "clock:tick" ─→ fetch)
//   carry            deliver ─ "quest:deliver" (talk to the other village's leader, choose the answer) ─→ return ─→ done
//   readFloor        read ─ "secret" (the mosaic's Flat Account, read on the map) ─→ return ─→ done
//   pray             pray ─ "inspect" of the shrine in its view (story/murals.js readable) ─→ return ─→ done
//   find             go ─ "zone:enter" / "world:step" on the span ─→ return ─→ done
//   hunt             hunt ─ "kill" with the beast's uid ─→ return ─→ done
//   rescue           find ─ "quest:found" (talk to the lost one: they go home) ─→ return ─→ done
//   chart            chart ─ "clock:tick" / "zone:leave" with the level percent% on your map ─→ return ─→ done
// Talk options (registerTalkOptions "villageQuests"): the giver offers its quest, takes it back done, then the reward
// choice; the other village's leader hears the word; the lost villager is sent home.
import { on, emit } from "../events.js";
import { makeRng, seedFor } from "../rng.js";
import { registerTalkOptions, node, bye } from "../talk.js";
import { registerQuest, startQuest, advanceQuest, questOf, mapPercent } from "./quests.js";
import { readable } from "./murals.js";
import { knows } from "./journal.js";
import { villageOf } from "./villages.js";
import { QUEST_ORDER } from "./questplan.js";
import { QUESTS } from "../content/quests.js";
import { VILLAGES } from "../content/villages.js";
import { FLOOR_Z } from "../world.js";
import { spawnCreature, addCreature, removeCreature, pickCreatureType } from "../creatures.js";
import { makeItem, addToInventory, randomEquipment, randomJewel, randomPotion, itemName } from "../items.js";
import { reachable, PLAYER_STEP_UP, PLAYER_DROP } from "../pathing.js";
import { standWith } from "../world.js";
import { KIND } from "../blocks.js";
import { claimUid, uidWhere, addZonePatch, zoneState } from "../zones.js";
import { receive } from "../currency.js";
import * as factions from "../factions.js";
import * as leveling from "../leveling.js";

export const TEMPLATES = QUEST_ORDER;
export const villageQuestId = (siteId) => `${siteId}:quest`;
const T = QUESTS.templates;
const fillText = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
const QUEST_XP = (level) => (leveling.xpReward ? leveling.xpReward("villageQuest", level) : Math.round(0.6 * leveling.xpToNext(level)));

// --- Words ------------------------------------------------------------------------------------------------------
function words(game, v, template, p) {
  const sh = VILLAGES.shrines[p.shrine];
  return { ...p, village: v.name, giver: p.giverName, to: p.toName, wx: p.target?.wx, wy: p.target?.wy,
           shrine: sh ? `It's ${sh.name}. ${sh.pray}` : "" };
}

// --- Starting -----------------------------------------------------------------------------------------------------
export function startVillageQuest(game, siteId, template, params, { quiet = false } = {}) {
  const v = villageOf(game.run, siteId);
  if (!v || !T[template]) return null;
  const w = words(game, v, template, params);
  const giverRole = v.roles.find((r) => r.uid === params.giver);
  const q = startQuest(game, template, {
    id: villageQuestId(siteId), quiet, title: fillText(T[template].title, w), text: fillText(T[template].text, w),
    vars: { ...params, template, offers: null },
    giver: { zoneKey: `${v.siteId.split(":")[1]},0`, uid: params.giver, name: giverRole?.name || params.giverName },
    target: { zoneKey: params.target?.key, wx: params.target?.wx, wy: params.target?.wy,
              uid: params.beastUid || params.lostUid || params.toUid || null, itemUid: params.itemUid || null },
  });
  if (!q) return null;
  // Already done before it was given: the reading known, the thing already in your pack.
  if (template === "readFloor" && knows(game, params.secret)) advanceQuest(game, q, "return", { quiet: true });
  if ((template === "recover" || template === "climb") && carrying(game, params.itemUid)) advanceQuest(game, q, "return", { quiet: true });
  if (template === "hunt" && uidWhere(game, params.beastUid) === "dead") advanceQuest(game, q, "return", { quiet: true });
  return q;
}
export function offerQuest(game, v) {
  return v?.quest ? startVillageQuest(game, v.siteId, v.quest.template, v.quest.params) : null;
}

// --- Helpers ------------------------------------------------------------------------------------------------------
const carrying = (game, uid) => !!uid && !!game.player?.inv?.some((it) => it.uid === uid);
const atSpan = (q, wx, wy) => q.vars.target?.wx === wx && q.vars.target?.wy === wy;
const zoneKeyOf = (zone) => zone?.key;

// --- The templates --------------------------------------------------------------------------------------------------
const turnIn = { "quest:turnIn": (game, q, ev) => (ev.q === q ? "done" : null) };
// A thing to bring back is turned in only in your pack; dropped or lost on the way, the quest goes back to fetching it.
const bringBack = { on: {
  "quest:turnIn": (game, q, ev) => (ev.q === q && carrying(game, q.vars.itemUid) ? "done" : null),
  "clock:tick": (game, q) => (carrying(game, q.vars.itemUid) ? null : "fetch"),
} };
const fetch = { on: {
  "clock:tick": (game, q) => (carrying(game, q.vars.itemUid) ? "return" : null),
  pickup: (game, q, ev) => (ev.item?.uid === q.vars.itemUid ? "return" : null),
} };
const common = { reward: (game, q) => rewardOf(game, q), onComplete: (game, q) => giveReward(game, q) };

registerQuest("recover", { ...common, start: "fetch", stages: { fetch, return: bringBack } });
registerQuest("climb", { ...common, start: "fetch", stages: { fetch, return: bringBack } });
registerQuest("carry", { ...common, start: "deliver", stages: {
  deliver: { on: { "quest:deliver": (game, q, ev) => (ev.q === q ? "return" : null) } }, return: { on: turnIn } } });
registerQuest("readFloor", { ...common, start: "read", stages: {
  read: { on: { secret: (game, q, ev) => (ev.id === q.vars.secret ? "return" : null) } }, return: { on: turnIn } } });
registerQuest("pray", { ...common, start: "pray", stages: {
  pray: { on: { inspect: (game, q, ev) => (prayed(game, q, ev) ? "return" : null) } }, return: { on: turnIn } } });
registerQuest("find", { ...common, start: "go", stages: {
  go: { on: {
    "zone:enter": (game, q, ev) => (ev.zone && ev.zone.z === 0 && atSpan(q, ev.zone.wx, ev.zone.wy) ? "return" : null),
    "world:step": (game, q, ev) => (ev.to && atSpan(q, ev.to.wx, ev.to.wy) ? "return" : null),
  } }, return: { on: turnIn } } });
registerQuest("hunt", { ...common, start: "hunt", stages: {
  hunt: { on: { kill: (game, q, ev) => ((ev.uid ?? ev.c?.uid) === q.vars.beastUid ? "return" : null) } }, return: { on: turnIn } } });
registerQuest("rescue", { ...common, start: "find", stages: {
  find: { on: { "quest:found": (game, q, ev) => (ev.q === q ? "return" : null) } }, return: { on: turnIn } } });
registerQuest("chart", { ...common, start: "chart", stages: {
  chart: { on: {
    "zone:enter": (game, q, ev) => { if (zoneKeyOf(ev.zone) === q.vars.target.key && q.vars.chartable == null) q.vars.chartable = chartable(game, ev.zone); return null; },
    "clock:tick": (game, q) => (zoneKeyOf(game.zone) === q.vars.target.key && mapPercent(game.zone) >= chartGoal(q) ? "return" : null),
    "zone:leave": (game, q, ev) => (zoneKeyOf(ev.zone) === q.vars.target.key && mapPercent(ev.zone) >= chartGoal(q) ? "return" : null),
  } }, return: { on: turnIn } } });

// How much of a level can be charted at all: the share of its open tiles you can walk to from where you first came in,
// or stand beside (some levels are mostly beyond chasms and gates). The quest asks for percent%, or 5 under that share.
const chartGoal = (q) => Math.max(1, Math.min(q.vars.percent, (q.vars.chartable ?? 100) - 5));
function chartable(game, zone) {
  const stand = standWith(zone, "open"), p = game.player;
  const d = reachable(stand, zone.w, zone.d, Math.floor(p.x), Math.floor(p.y), PLAYER_STEP_UP, PLAYER_DROP);
  let open = 0, near = 0;
  for (let i = 0; i < zone.w * zone.d; i++) {
    if (zone.kind[i] === KIND.WALL) continue;
    open++;
    const x = i % zone.w, y = (i - x) / zone.w;
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < zone.w && ny < zone.d && d[nx + ny * zone.w] >= 0) ok = true;
    }
    if (ok) near++;
  }
  return Math.round((100 * near) / Math.max(1, open));
}

// Praying: the shrine looked at (inspect) in its own view, in its village.
function prayed(game, q, ev) {
  const zone = ev.zone || game.zone, s = zone?.village?.shrine;
  if (!s || zone.siteId !== q.vars.village) return false;
  if (Math.abs(ev.x - s.x) > (s.kind === "mosaic" ? 1 : 0) || ev.y !== s.y) return false;
  return readable(game, zone, { x: s.x, y: s.y, z: s.z, view: s.view });
}

// --- Rewards ------------------------------------------------------------------------------------------------------
export function rewardOf(game, q) {
  const v = villageOf(game.run, q.vars.village);
  const tier = q.vars.tier || v?.tier || 1, level = q.vars.level || 3 * tier - 1;
  const rep = { [v.factionId]: 100 };
  for (const id of v.likedBy) rep[id] = (rep[id] || 0) + 25;
  if (q.vars.answer === "sweetened" && q.vars.to) {   // the word carried back sweetened: liked there, less so here
    const other = villageOf(game.run, q.vars.to);
    if (other) rep[other.factionId] = (rep[other.factionId] || 0) + 25;
    rep[v.factionId] -= 25;
  }
  return { funds: 25 * tier, rep, xp: QUEST_XP(level), items: offersFor(game, q, level) };
}
function offersFor(game, q, level) {
  if (q.vars.offers) return q.vars.offers;
  const rng = makeRng(seedFor(game.run?.seed ?? 0, "reward", q.id));
  const depth = Math.min(20, level + 3);   // weapons at the village's tier + 1
  return [randomEquipment(rng, depth, 0.3), randomJewel(rng, depth, 0.3), { ...randomPotion(rng), count: 2 }];
}
function giveReward(game, q) {
  const r = rewardOf(game, q), p = game.player;
  q.reward = { funds: r.funds, rep: r.rep, xp: r.xp, items: r.items };
  q.vars.offers = r.items;
  q.vars.offerOpen = true;
  if (q.vars.itemUid && p?.inv) p.inv = p.inv.filter((it) => it.uid !== q.vars.itemUid);   // handed over
  const got = p ? receive(game, p, r.funds) : 0;
  for (const [id, n] of Object.entries(r.rep)) factions.addRep(game, id, n, "quest");
  game.log?.(`${q.giver?.name || "They"} pays you ${got} glim. (+${r.xp} XP)`, [255, 220, 120]);
  if (p) leveling.gainXp(game, r.xp, { source: "quest" });
}
export function takeOffer(game, q, k) {
  if (!q?.vars?.offerOpen || !q.vars.offers?.[k]) return null;
  const it = q.vars.offers[k];
  q.vars.offerOpen = false;
  q.vars.took = k;
  addToInventory(game.player, { ...it });
  game.log?.(`You take ${itemName(game, it)}.`, [200, 220, 255]);
  return it;
}

// --- Things where the quests point (bible §9.6: placed when the zone is generated, whoever gets there first) -------
// A run's quest targets by zone key, made once per run.
const BY_ZONE = new WeakMap();
function targetsIn(run, key) {
  if (!BY_ZONE.has(run)) {
    const m = new Map();
    for (const v of run.villages?.values() || []) {
      const vv = villageOf(run, v.siteId);
      const p = vv?.quest?.params;
      if (p?.target?.key) (m.get(p.target.key) || m.set(p.target.key, []).get(p.target.key)).push({ v: vv, template: vv.quest.template, p });
    }
    BY_ZONE.set(run, m);
  }
  return BY_ZONE.get(run).get(key) || [];
}
export const QUEST_THINGS = { targetsIn };

// A reachable spot 8-14 tiles from where you come in (the anchor, the stairs), the same each time for the same uid.
function spotFor(zone, uid) {
  const stand = standWith(zone, "open"), o = zone.entrance || zone.stairs || zone.spawn;
  const ox = Math.floor(o.x), oy = Math.floor(o.y);
  const dist = reachable(stand, zone.w, zone.d, ox, oy, PLAYER_STEP_UP, PLAYER_DROP);
  const near = [], far = [];
  for (let i = 0; i < zone.w * zone.d; i++) {
    if (dist[i] < 0 || stand[i] < 0) continue;
    const x = i % zone.w, y = (i - x) / zone.w, r = Math.max(Math.abs(x - ox), Math.abs(y - oy));
    if (r >= 8 && r <= 14) near.push(i); else if (r >= 3) far.push(i);
  }
  const pool = near.length ? near : far;
  if (!pool.length) return null;
  const i = pool[seedFor(0, uid) % pool.length];
  return { x: i % zone.w, y: Math.floor(i / zone.w), z: stand[i] };
}

function placeThing(game, zone, uid, make) {
  if (!uid || zone.flags?.[`quest:${uid}`]) return false;
  const where = uidWhere(game, uid);
  if (where && where !== zone.key) return false;   // it lives elsewhere, was carried off, or died
  const done = make();
  if (!done) return false;
  (zone.flags ||= {})[`quest:${uid}`] = 1;
  claimUid(game, uid, zone.key);
  zone.dirty = true;
  return true;
}

on("zone:prepare", (game, ev) => {
  const zone = ev.zone;
  if (!game.run || !zone) return;
  // The run's planned quests that point here, and any quest given that points here (a check's, a later template's).
  const list = [...targetsIn(game.run, zone.key)];
  for (const q of game.quests || [])
    if (!q.done && !q.failed && q.vars?.target?.key === zone.key && !list.some((x) => x.v.siteId === q.vars.village && x.template === q.template))
      list.push({ v: villageOf(game.run, q.vars.village), template: q.template, p: q.vars });
  for (const { v, template, p } of list) {
    if (!v) continue;
    if (template === "recover" || template === "climb") {
      placeThing(game, zone, p.itemUid, () => {
        const at = template === "climb" ? zone.village?.perch : spotFor(zone, p.itemUid);
        if (!at) return false;
        zone.items.push(makeItem({ kind: "quest", name: p.thing, uid: p.itemUid, info: `${v.name} wants it back`, quest: villageQuestId(v.siteId) },
                                 at.x + 0.5, at.y + 0.5, at.z));
        return true;
      });
    } else if (template === "hunt") {
      placeThing(game, zone, p.beastUid, () => {
        const at = spotFor(zone, p.beastUid);
        if (!at) return false;
        const rng = makeRng(seedFor(game.run.seed, "beast", p.beastUid));
        const type = pickCreatureType(rng, p.beastLevel) || "rat";
        const c = spawnCreature(type, at.x, at.y, at.z, { rng, uid: p.beastUid, level: p.beastLevel, name: p.beast, state: "wander", elite: null });
        c.named = { epithet: p.beast, history: null };
        c.questBeast = villageQuestId(v.siteId);
        addCreature(zone, c);
        return true;
      });
    } else if (template === "rescue") {
      placeThing(game, zone, p.lostUid, () => {
        const at = spotFor(zone, p.lostUid);
        if (!at) return false;
        const c = spawnCreature("villager", at.x, at.y, at.z, { uid: p.lostUid, name: `${p.lost} of ${v.name}`, level: v.level,
                                                                talk: { dialogue: "villager", state: {} } });
        c.village = v.siteId; c.lostFrom = v.siteId;
        c.faction = { [v.factionId]: 1 };
        addCreature(zone, c);
        return true;
      });
    }
  }
});

// --- Talk ---------------------------------------------------------------------------------------------------------
registerTalkOptions("villageQuests", (game, c) => {
  if (!game.run || !c?.uid) return null;
  const out = [];
  // A giver: its village's quest.
  if (c.villageRole === "questGiver" && c.village) {
    const v = villageOf(game.run, c.village), id = villageQuestId(c.village), q = questOf(game, id);
    if (v?.quest && !q) {
      const w = words(game, v, v.quest.template, v.quest.params);
      out.push({ label: "Is there anything I can do?", go: () => node(fillText(T[v.quest.template].offer, w), [
        { label: "I'll do it.", go: () => { offerQuest(game, v); return node("Good. Come back when it's done.", [bye()]); } },
        bye("Not now."),
      ]) });
    } else if (q && !q.done && !q.failed && q.stage === "return" && (!q.vars.itemUid || carrying(game, q.vars.itemUid))) {
      out.push({ label: "It's done.", go: () => { emit(game, "quest:turnIn", { q, c }); return rewardNode(game, q, T[q.template].done); } });
    } else if (q?.done && q.vars.offerOpen) {
      out.push({ label: "About my reward...", go: () => rewardNode(game, q, "Take your pick.") });
    }
  }
  // Someone a quest points at: the other village's leader, the lost villager.
  for (const q of game.quests || []) {
    if (q.done || q.failed) continue;
    if (q.template === "carry" && q.stage === "deliver" && c.uid === q.vars.toUid) {
      out.push({ label: `I bring word from ${villageOf(game.run, q.vars.village)?.name}.`, go: () => node(
        `"${QUESTS.words.word}" They hear it out. "Tell them yes. And tell them we haven't forgotten the last time."`,
        QUESTS.words.answers.map((a) => ({ label: a.label, go: () => {
          q.vars.answer = a.id;
          emit(game, "quest:deliver", { q, c, answer: a.id });
          return node(a.text, [bye()]);
        } }))) });
    }
    if (q.template === "rescue" && q.stage === "find" && c.uid === q.vars.lostUid) {
      out.push({ label: "Your people sent me. Go home.", go: () => {
        sendHome(game, q, c);
        emit(game, "quest:found", { q, c });
        return node("Home? Yes. Yes, I'll go. Tell them I'm coming.", [bye()]);
      } });
    }
  }
  return out.length ? out : null;
}, { priority: 5 });

function rewardNode(game, q, text) {
  if (!q.vars.offerOpen) return node(text, [bye()]);
  return node(`${text} Take one of these, with my thanks.`, [
    ...q.vars.offers.map((it, k) => ({ label: `Take ${itemName(game, it)}.`, go: () => { takeOffer(game, q, k); return node("A fair choice.", [bye()]); } })),
    bye("Later."),
  ]);
}

// The lost one walks home: gone from here, waiting in the village when you next come.
function sendHome(game, q, c) {
  const v = villageOf(game.run, q.vars.village), site = game.run.sites.get(q.vars.village);
  if (!site) return;
  const home = `${site.at.wx},${site.at.wy},0`;
  if (game.zone) removeCreature(game.zone, c);
  zoneState(game).uids[c.uid] = home;
  addZonePatch(game, home, { op: "spawnCreature", type: "villager", uid: c.uid, name: c.name, talk: { dialogue: "villager", state: {} },
                             relativeTo: "arrival", dist: [3, 6], level: v?.level });
}
