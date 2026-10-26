// Talk, services and quests (talk.js, story/quests.js; TECH_DESIGN §2.10, §2.13, the 0C talk step).
//
//   checkTalk({ game, startRun, creatures, talk, quests, items, body, events }) → { name, ok, problems, stats }
//
//   1. Every person of the parent game (content/creatures/legacy.js) has a registered dialogue, and talkTo
//      sets met and passes first only the first time.
//   2. registerTalkOptions: options from every registration land on the root node of any talker, higher
//      priority first, before its closing goodbye; nested nodes get none; a provider returning null adds
//      nothing; registering an id again replaces it.
//   3. Pell's services through registerService are the parent's list: for 300 random loadouts (cursed,
//      plain and +5 gear worn, an elemental or relic weapon, unknown gear and potions in the pack) the rows
//      servicesFor gives (label and price) are the same multiset as the parent's hard-wired dialogue.js
//      list (copied below as it was), and each service's run does what the parent's act did.
//   4. Quests: a two-stage template moves on events from the bus (stage → stage → done) and ignores events
//      for other stages; quest:start, quest:stage and quest:done are emitted; a legacy one-stage quest is
//      done on its giver's report; finishQuest with a title records a quest never given; an instance is
//      plain JSON.
import { makeRng } from "../../src/rng.js";

export function checkTalk({ game, startRun, creatures, talk, quests, items, body, events, currency }) {
  const problems = [], stats = {};
  const fail = (m) => problems.push(m);
  startRun(1234);
  game.pages = null; game.mode = "map";
  const p = game.player;
  const person = (type, state = {}) => creatures.spawnCreature(type, 3, 3, 2, { level: 5, talk: { state } });

  // --- 1. Dialogues ---------------------------------------------------------------------------------
  {
    const people = Object.entries(creatures.CREATURE_TYPES).filter(([, t]) => t.talks).map(([id]) => id);
    const missing = people.filter((id) => !talk.dialogueIds().includes(id));
    if (missing.length) fail(`people with no dialogue: ${missing.join(", ")}`);
    let firsts = [];
    talk.registerDialogue("test:first", (g, c, { first }) => { firsts.push(first); return talk.node("hi", [talk.bye()]); });
    const c = person("pell", { stock: [] });
    c.talk.dialogue = "test:first";
    talk.talkTo(game, c); talk.talkTo(game, c);
    if (firsts.join() !== "true,false" || !c.talk.met) fail(`first on two talks: ${firsts.join()}, met ${c.talk.met}`);
    stats.dialogues = `${people.length} people, all registered`;
  }

  // --- 2. Talk options ------------------------------------------------------------------------------
  {
    const c = person("mira");
    const plain = talk.talkTo(game, c).options.map((o) => o.label);
    talk.registerTalkOptions("test:low", () => [{ label: "LOW", go: () => null }], { priority: 1 });
    talk.registerTalkOptions("test:high", () => [{ label: "HIGH", go: () => null }], { priority: 5 });
    talk.registerTalkOptions("test:none", () => null);
    const root = talk.talkTo(game, c).options.map((o) => o.label);
    const want = [...plain.slice(0, -1), "HIGH", "LOW", plain[plain.length - 1]];
    if (root.join("|") !== want.join("|")) fail(`root options with two providers: ${root.join(" | ")} (want ${want.join(" | ")})`);
    talk.registerTalkOptions("test:high", () => [{ label: "HIGH2", go: () => null }], { priority: 5 });
    const again = talk.talkTo(game, c).options.map((o) => o.label);
    if (!again.includes("HIGH2") || again.includes("HIGH")) fail(`re-registering replaced nothing: ${again.join(" | ")}`);
    // A nested node (Pell's news) gets none.
    const pell = person("pell", { stock: [] });
    const news = talk.talkTo(game, pell).options.find((o) => /news/.test(o.label)).go();
    if (news.options.some((o) => /LOW|HIGH/.test(o.label))) fail("a nested node got the registered options");
    talk.registerTalkOptions("test:low", () => null); talk.registerTalkOptions("test:high", () => null);
    stats.talkOptions = { plain: plain.length, withTwo: root.length };
  }

  // --- 3. Pell's services --------------------------------------------------------------------------
  {
    const { itemName, randomEquipment, randomPotion, isGear, ELEMENTS, RINGS, AMULETS } = items;
    const { worn, wielded, carried } = body;
    // The parent's dialogue.js services(game), as it was before 0C (labels and prices).
    const legacyRows = (pell) => {
      const f = currency.priceLevel(pell.level), rows = [];
      const cost = (n) => currency.buyPrice(game, p, Math.round(n * f));
      const jewelFixed = (it) => (it.kind === "ring" || it.kind === "amulet") && (it.kind === "ring" ? RINGS : AMULETS)[it.id].fixed;
      for (const it of worn(p)) {
        if (it.kind === "armour" && it.id === "clothes") continue;
        if (it.ench < 0) rows.push([`Lift the curse on your ${itemName(game, it)}`, cost(50)]);
        else if (!jewelFixed(it) && it.ench < 5) {
          const verb = it.kind === "weapon" ? "Sharpen" : it.kind === "armour" ? "Reinforce" : "Polish";
          rows.push([`${verb} your ${itemName(game, it)} (+1)`, cost(60 * (Math.max(0, it.ench) + 2))]);
        }
      }
      const weapon = wielded(p);
      const words = { fire: "flames", frost: "frost", shock: "lightning", holy: "holy light" };
      for (const el of ["fire", "frost", "shock", "holy"])
        if (weapon.element !== el && !weapon.relic) rows.push([`Forge ${words[el]} into your ${itemName(game, weapon)}`, cost(150)]);
      for (const it of carried(p).slice(worn(p).length)) {
        if (isGear(it) && !it.known && !it.relic) rows.push([`Identify the ${itemName(game, it)}`, cost(25)]);
        if (it.kind === "potion" && !game.knownPotions.has(it.effect)) rows.push([`Name the ${itemName(game, it)}`, cost(25)]);
        if (isGear(it) && it.known && it.ench < 0) rows.push([`Lift the curse on the ${itemName(game, it)}`, cost(50)]);
      }
      return rows.map(([l, pr]) => `${l} @${pr}`).sort();
    };
    const pell = person("pell", { stock: [] });
    const rng = makeRng(77);
    // A ring and an amulet on; the amulet is a fixed one (never enchanted) half the time (below).
    const fixedAmulet = Object.keys(AMULETS).find((id) => AMULETS[id].fixed), plainAmulet = Object.keys(AMULETS).find((id) => !AMULETS[id].fixed);
    for (const it of [{ kind: "ring", id: Object.keys(RINGS)[0] }, { kind: "amulet", id: plainAmulet }])
      for (const part of body.slotsFor(p, it)) if (!body.wornOn(p, part)) { body.equip(game, p, { ...it, ench: 0, known: true }, part); break; }
    const jewels = worn(p).filter((it) => it.kind === "ring" || it.kind === "amulet").length;
    const inv0 = p.inv.slice(), known0 = new Set(game.knownPotions);
    const gear0 = worn(p).map((it) => ({ it, ench: it.ench, element: it.element, relic: it.relic, known: it.known }));
    let loadouts = 0, rows = 0, mismatched = 0, ran = 0;
    for (let k = 0; k < 300; k++) {
      for (const g of gear0) Object.assign(g.it, { ench: rng.pick([-2, -1, 0, 1, 3, 5]), known: rng.chance(0.5) });
      const amulet = worn(p).find((it) => it.kind === "amulet");
      if (amulet) amulet.id = rng.chance(0.5) ? fixedAmulet : plainAmulet;
      const w = wielded(p);
      w.element = rng.pick([null, null, "fire", "frost", "shock", "holy"]);
      w.relic = rng.chance(0.1) ? "patience" : undefined;
      p.inv = inv0.slice();
      for (let j = rng.int(0, 4); j > 0; j--) p.inv.push({ ...randomEquipment(rng, rng.int(1, 18), 0.3), known: rng.chance(0.5) });
      for (let j = rng.int(0, 3); j > 0; j--) p.inv.push(randomPotion(rng));
      if (rng.chance(0.2)) p.inv.push({ kind: "weapon", id: "spear", ench: 3, relic: "patience", known: rng.chance(0.5) });
      game.knownPotions = new Set(rng.chance(0.5) ? known0 : []);
      const want = legacyRows(pell);
      const got = talk.servicesFor(game, pell).map(({ id, target }) => {
        const s = talk.serviceDef(id);
        return `${s.label(game, pell, target)} @${s.price(game, pell, target)}`;
      }).sort();
      loadouts++; rows += got.length;
      if (got.join("\n") !== want.join("\n")) {
        mismatched++;
        if (mismatched <= 3) fail(`loadout ${k}: services ${got.length} rows, the parent's ${want.length}: ${got.filter((r) => !want.includes(r)).concat(want.filter((r) => !got.includes(r)).map((r) => `missing ${r}`)).slice(0, 3).join(" / ")}`);
      }
      // Each service's run, as the parent's act.
      for (const { id, target } of talk.servicesFor(game, pell)) {
        const s = talk.serviceDef(id), it = target.it || target, before = { ench: it.ench, known: it.known, element: it.element };
        const knew = it.kind === "potion" && game.knownPotions.has(it.effect);
        s.run(game, pell, target);
        ran++;
        const ok = { uncurseWorn: it.ench === 0 && it.known, enchant: it.ench === Math.min(5, before.ench + 1) && it.known,
                     forge: it.element === target.el, identify: it.known === true, namePotion: !knew && game.knownPotions.has(it.effect),
                     uncurse: it.ench === 0 }[id];
        if (!ok) fail(`${id} on ${it.kind} (${JSON.stringify(before)}) left ${JSON.stringify({ ench: it.ench, known: it.known, element: it.element })}`);
        Object.assign(it, before);
        if (it.kind === "potion" && !knew) game.knownPotions.delete(it.effect);
      }
    }
    for (const g of gear0) Object.assign(g.it, { ench: g.ench, element: g.element, relic: g.relic, known: g.known });
    p.inv = inv0; game.knownPotions = known0;
    if (mismatched) fail(`${mismatched} of ${loadouts} loadouts differ from the parent's service list`);
    if (jewels !== 2) fail(`${jewels} jewels on, want 2`);
    stats.services = { loadouts, rows, mismatched, runs: ran, jewels };
  }

  // --- 4. Quests -------------------------------------------------------------------------------------
  {
    game.quests = [];
    const seen = [];
    const offs = ["quest:start", "quest:stage", "quest:done"].map((t) => events.on(t, (g, { q }) => seen.push(`${t}:${q.id}:${q.stage}`)));
    quests.registerQuest("test:two", {
      title: () => "Two steps", text: () => "Ping, then pong.",
      stages: { open: { on: { "test:ping": (g, q, ev) => (ev.n > 0 ? "half" : null), "test:pong": () => "done" } },
                half: { on: { "test:pong": (g, q, ev) => { q.vars.pongs = (q.vars.pongs || 0) + 1; return q.vars.pongs >= 2 ? "done" : null; } } } },
    });
    const q = quests.startQuest(game, "test:two");
    if (!q || q.title !== "Two steps" || q.text !== "Ping, then pong." || q.stage !== "open") fail(`a started quest: ${JSON.stringify(q)}`);
    if (quests.startQuest(game, "test:two")) fail("a quest was given twice");
    events.emit(game, "test:ping", { n: 0 });
    if (q.stage !== "open") fail(`a ping that its handler refused moved the quest to ${q.stage}`);
    events.emit(game, "test:ping", { n: 1 });
    events.emit(game, "test:ping", { n: 1 });   // half doesn't listen for pings
    events.emit(game, "test:pong", {});
    if (q.stage !== "half" || q.done) fail(`after ping, ping, pong: stage ${q.stage}, done ${q.done}`);
    events.emit(game, "test:pong", {});
    if (!q.done) fail("the second pong in half didn't finish the quest");
    events.emit(game, "test:pong", {});
    if (q.vars.pongs !== 2) fail(`a done quest still hears events (${q.vars.pongs} pongs)`);
    const want = ["quest:start:test:two:open", "quest:stage:test:two:half", "quest:done:test:two:half"];
    if (seen.join() !== want.join()) fail(`bus events: ${seen.join(", ")}`);
    // Legacy: one stage, done on the giver's report.
    quests.startQuest(game, "mira", { title: "Mira's map", text: "Map it." });
    quests.finishQuest(game, "corwin");   // never given, no title: nothing
    quests.finishQuest(game, "mira");
    quests.finishQuest(game, "brann", "Bones for Brann");
    if (!quests.questDone(game, "mira") || !quests.questDone(game, "brann") || quests.questOf(game, "corwin")) fail(`legacy quests: ${JSON.stringify(game.quests.map((o) => [o.id, o.done]))}`);
    const json = JSON.parse(JSON.stringify(game.quests));
    if (JSON.stringify(json) !== JSON.stringify(game.quests)) fail("a quest instance isn't plain JSON");
    offs.forEach((f) => f());
    stats.quests = { events: seen.length, legacy: game.quests.filter((o) => o.done).length };
    game.quests = [];
  }
  return { name: "talk", ok: problems.length === 0, problems, stats };
}

// tests/checks/index.js's entry point (tools/run-check.mjs in Node, test-world.html in the browser), with the
// inputs tools/check-talk.mjs gives.
export async function run(env) {
  await env.screen();
  const { game, startRun } = await env.src("game.js");
  const m = (p) => env.src(p);
  return checkTalk({ game, startRun, creatures: await m("creatures.js"), talk: await m("talk.js"), quests: await m("story/quests.js"),
    items: await m("items.js"), body: await m("body.js"), events: await m("events.js"), currency: await m("currency.js") });
}
