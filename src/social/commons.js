// A village's commons (bible §3.1, §9.1, §9.2, §7; C2 #8, WS6b #7, WS7b #16; B3): the commons lamp, the hall's oven and
// the shrine's prayer; and two lore and leech powers that live there (Brew; Gossip). Small on purpose: money is never
// plentiful, and every reward here is once a world day.
//
//   the commons lamp   the lamplighter's talk option: take VILLAGES.commons.take.free (5) glim a world day for nothing,
//                      then `per` (5) more at a time for `rep` (−25) with the village, up to four times a day (then the
//                      lamp is down to its wick); a village with the commons dark (the Shade's) has nothing to take
//   the oven           the village leader's talk option: cook a dish you learned in the Kindling (game.state.dishes;
//                      social/ritual.js's "Learn the village dish" row) at the hall, once a world day: the status "fed"
//                      for a world day, its bonus the dish's (VILLAGES.dishBook[dish].bonus)
//   Brew (the power)   the same oven mixes a tonic: a vial of a liquid and 10 glim make the tonic that liquid is the base
//                      of (BREWS), once a world day in each village
//   the shrine         L on the village's shrine in its view (VILLAGES.shrines[kind].view: social/murals.js readable), once
//                      a world day: its `reward` (a tale learned as a reading, a heal, a status); in the wrong view its
//                      `wrong` words. The pray quest (story/villagequests.js) still finishes on the same look
//   Gossip (the power) the first time you come to a village, someone tells you a rumour unasked (story/gossip.js)
// State: game.state.commons = { [siteId]: { day, taken, cooked?, brewed?, prayed? } } (JSON).
import { registerTalkOptions, node, bye } from "../talk.js";
import { on } from "../events.js";
import { registerStatus, addStatus } from "../status.js";
import { receive, pay, funds, formatPrice } from "../currency.js";
import { addRep, FACTIONS } from "../factions.js";
import { maxHp } from "../stats.js";
import { hasKey } from "../keyset.js";
import { dayNumber } from "../clock.js";
import { addToInventory, takeOne } from "../items.js";
import { VILLAGES } from "../content/villages.js";
import { TONICS } from "../content/items/tonics.js";
import { villageOf } from "../story/villages.js";
import { readable } from "../story/murals.js";
import { learnSecret, secretsOf } from "../story/secrets.js";
import { knows } from "../story/journal.js";
import { sameLiquid } from "./liquids.js";

export const COMMONS = { extraTakes: 4, brew: { glim: 10 } };
// Which tonic a liquid is the base of (DECISIONS "Liquids": the base of tonics; bible §13.7-13.8).
export const BREWS = { freshWater: "balm", sunwine: "hasp", umbra: "gloam", sap: "ironbark", ink: "foldSap", clearGlim: "clearwit" };

const DAY_S = 24 * 60;   // a world day in game seconds
const today = (game) => dayNumber(game);
function cstate(game, site) {
  const all = (game.state.commons ||= {}), d = today(game);
  if (!all[site] || all[site].day !== d) all[site] = { day: d, taken: 0 };
  return all[site];
}
const villageHere = (game, c) => (c?.village && game.run ? villageOf(game.run, c.village) : null);
const styleOf = (v) => VILLAGES.styles[v.layout?.style] || VILLAGES.styles.turf;

registerStatus("fed", { name: "fed", color: [230, 200, 140], kind: "good", t: DAY_S, stack: "refresh",
  bonus: (s) => VILLAGES.dishBook[s.src]?.bonus || null, hud: () => null, ended: "The good meal wears off." });

// --- The commons lamp -----------------------------------------------------------------------------------------------
export function takeFromLamp(game, siteId) {
  const C = VILLAGES.commons, L = C.lines, p = game.player, v = villageOf(game.run, siteId);
  if (!v || v.abandoned) return { ok: false, line: "The lamp is cold. Nobody has lit it in a long time." };
  if (styleOf(v).lamp === "dark") return { ok: false, line: L.dark };
  const st = cstate(game, siteId);
  const free = st.taken === 0, n = free ? C.take.free : C.take.per;
  if (!free && st.taken > COMMONS.extraTakes) return { ok: false, line: L.empty };
  const over = receive(game, p, n);
  if (over) {   // (all or nothing: a flask that can't hold the thimble doesn't take half of it)
    pay(game, p, n - over);
    return { ok: false, line: "Your flask is full. The lamp's oil stays where it is." };
  }
  if (!free) addRep(game, v.factionId, C.take.rep, "commons");
  st.taken++;
  return { ok: true, line: `${free ? L.take : L.more} (+${formatPrice(n)}${free ? "" : `, ${FACTIONS[v.factionId]?.name || v.name} ${C.take.rep}`})` };
}
registerTalkOptions("commonsLamp", (game, c) => {
  const v = villageHere(game, c);
  if (!v || v.abandoned || c.villageRole !== "lamplighter" || !game.state) return null;
  const dark = styleOf(v).lamp === "dark", st = cstate(game, c.village);
  const label = dark ? "What is the commons dark for?" : st.taken === 0 ? "May I take a thimble from the commons lamp?" : "May I take a little more from the lamp?";
  return [{ label, go: () => {
    const out = takeFromLamp(game, c.village);
    game.log(out.line, out.ok ? [255, 220, 120] : [200, 190, 170]);
    return node(out.line, [{ label: "Thank you.", go: () => null, bye: true }]);
  } }];
});

// --- The oven: the dish, and Brew ----------------------------------------------------------------------------------
export function cookDish(game, siteId, dish) {
  const st = cstate(game, siteId), D = VILLAGES.dishBook[dish];
  if (!D || !game.state.dishes?.[dish]) return { ok: false, line: "You don't know how that's made." };
  if (st.cooked) return { ok: false, line: "The oven has done its day's work. Come back tomorrow." };
  st.cooked = dish;
  addStatus(game, game.player, "fed", { t: DAY_S, src: dish });
  return { ok: true, line: `You cook ${dish} at the hall's oven. ${D.note} (Fed for a day: ${D.text})` };
}
export function brewTonic(game, siteId, vial) {
  const st = cstate(game, siteId), p = game.player, id = vial && Object.keys(BREWS).find((l) => sameLiquid(l, vial.effect));
  if (!hasKey(p.perks, "brew")) return { ok: false, line: "You don't know how to brew." };
  if (!id) return { ok: false, line: "Nothing brews from that." };
  if (st.brewed) return { ok: false, line: "The oven is still cooling from the last brew. Tomorrow." };
  if (funds(p) < COMMONS.brew.glim) return { ok: false, line: `The fire wants ${formatPrice(COMMONS.brew.glim)} of glim.` };
  pay(game, p, COMMONS.brew.glim);
  takeOne(p, vial);
  addToInventory(p, { kind: "vial", effect: "" });
  addToInventory(p, { kind: "tonic", effect: BREWS[id], count: 1 });
  st.brewed = BREWS[id];
  return { ok: true, line: `You brew ${TONICS[BREWS[id]].name} over the oven's coals. (−${formatPrice(COMMONS.brew.glim)})` };
}
registerTalkOptions("oven", (game, c) => {
  const v = villageHere(game, c);
  if (!v || v.abandoned || c.villageRole !== "leader" || !game.state) return null;
  const p = game.player, opts = [];
  for (const dish of Object.keys(game.state.dishes || {})) opts.push({ label: `May I cook ${dish} at your oven?`, go: () => {
    const out = cookDish(game, c.village, dish);
    game.log(out.line, out.ok ? [230, 200, 140] : [200, 190, 170]);
    return node(out.line, [bye()]);
  } });
  if (hasKey(p.perks, "brew")) {
    const vial = (p.inv || []).find((it) => it.kind === "vial" && it.effect && Object.keys(BREWS).some((l) => sameLiquid(l, it.effect)));
    if (vial) opts.push({ label: "May I brew at your oven?", go: () => {
      const out = brewTonic(game, c.village, vial);
      game.log(out.line, out.ok ? [150, 220, 200] : [200, 190, 170]);
      return node(out.line, [bye()]);
    } });
  }
  return opts.length ? opts : null;
});

// --- The shrine -----------------------------------------------------------------------------------------------------
export function prayAtShrine(game, zone) {
  const s = zone?.village?.shrine, siteId = zone?.village?.siteId, v = siteId && villageOf(game.run, siteId);
  if (!s || !v || v.abandoned) return null;
  const S = VILLAGES.shrines[s.kind], R = S.reward || {}, p = game.player;
  if (!readable(game, zone, { x: s.x, y: s.y, z: s.z, view: s.view })) return { ok: false, line: S.wrong };
  const st = cstate(game, siteId);
  if (st.prayed) return { ok: false, line: "You have prayed here today. The shrine has given what it gives in a day." };
  st.prayed = true;
  const got = [];
  if (R.tale) {
    const id = `village:${siteId}:${R.tale}`;
    if (secretsOf(game.run).has(id) && !knows(game, id) && learnSecret(game, id, "shrine")) got.push("a tale");
  }
  if (R.heal) { const before = p.hp; p.hp = R.heal === "full" ? maxHp(p) : Math.min(maxHp(p), p.hp + R.heal); if (p.hp > before) got.push(`+${p.hp - before} HP`); }
  if (R.status) addStatus(game, p, R.status, { t: R.t, stack: "refresh" });
  return { ok: true, line: R.text + (got.length ? ` (${got.join(", ")})` : "") };
}
on("inspect", (game, ev) => {
  if (!ev?.open || !game.run || !game.state) return;
  const zone = ev.zone || game.zone, s = zone?.village?.shrine;
  if (!s || Math.abs(ev.x - s.x) > (s.kind === "mosaic" ? 1 : 0) || ev.y !== s.y) return;
  const out = prayAtShrine(game, zone);
  if (out) game.log(out.line, out.ok ? [230, 210, 150] : [200, 190, 170]);
});

// --- Gossip (the power): a rumour unasked on your first visit to a village --------------------------------------------
on("zone:enter", (game, ev) => {
  const zone = ev.zone, site = zone?.siteId && game.run?.sites?.get(zone.siteId);
  if (!site || site.kind !== "village" || zone.z !== 0 || ev.how === "load" || !game.player || !hasKey(game.player.perks, "gossip")) return;
  const heard = (game.state.gossipPower ||= {});
  if (heard[site.id] !== undefined) return;
  heard[site.id] = game.time || 0;
  const all = [...secretsOf(game.run).values()].filter((d) => d.kind === "gossip" && !knows(game, d.id));
  if (!all.length) return;
  const d = all[(site.id.length * 31 + (game.seed ?? 0)) % all.length];
  learnSecret(game, d.id, "gossip");
  game.log(`Before you have your pack off, someone leans over: "${d.text}"`, [220, 210, 180]);
});
