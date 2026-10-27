// Character creation (TECH_DESIGN §4.2 `create`, §2.4, §2.6; §1.4 "progression (WS4)"; bible §10.1, §10.3, §10.9,
// §10.10, §15.6). The wizard (screens/create.js) collects the choices; this makes the player from them.
//
//   makeCharacter(choices) → player    choices = { genotype: "bent" | "plumb" (DECISIONS §1), background (a
//                                      BACKGROUNDS id of that genotype), attrs: { str, agi, tou, int, wil, ego } (the
//                                      point-buy's scores, before the background's bonus), mutations: [id] (Bent;
//                                      progression/mutations.js, 4b), implant: id (Plumb; WS5's bodymods), name,
//                                      mode: "oneWick" | "commonsLamp" | "pilgrim" }. Throws on choices
//                                      validateChoices refuses. The player keeps the bought scores as its base
//                                      attributes and gets the background's bonus through the "origin" bonus source
//                                      (progression/index.js), so nothing derived is baked in (R3): max HP, DV, AV
//                                      and the rest come from stats.js under whichever formula set runs.
//   validateChoices(choices) → [problem]   [] when makeCharacter will take them
//   freeImplants(background) → ids     the implants a Plumb background may take free (its own first); implantCost(id)
//   pointCost(genotype, score) → points    what a score costs from the genotype's base: 1 per +1 up to 18, then 2
//   pointsSpent(genotype, attrs), pointsLeft(genotype, attrs)
//   canRaise(genotype, attrs, k), canLower(genotype, attrs, k)   one step, within the base, the points and the cap of 22
//   baseAttrs(genotype) → attrs        every attribute at the genotype's base
//   suggestSpread(genotype, background) → attrs   every point spent: all toward 16, then the background's bonus
//                                      attributes and its trees' (the wizard starts from it)
//   suggestName(genotype, background, rng) → name   bible §2.3's phonology for the culture you come from
//   originBonuses(e)                   the "origin" bonus source: the background's attribute bonus and its Level's
//   beginRun(game, choices, { seed })  a new run with the made character: game.js startRun on the seed (its
//                                      start landmark, the intro), the run's mode in state.mode (as WS9's title
//                                      newGame does) and the background's reputation changes (factions.js addRep)
//
// A made player has, besides makePlayer()'s fields: name, genotype, background, trees (open power trees),
// attrPoints, origin: { level, implant, fitted }, and creases (Bent) or grade (Plumb).
import { makeAttrs, ATTRS, maxHp } from "../stats.js";
import { makeBody } from "../body.js";
import { ITEM_KINDS, addToInventory } from "../items.js";
import { setPurse, purseCap, CURRENCY } from "../currency.js";
import { addRep } from "../factions.js";
import { quickPlayer, nextRunPlayer } from "../player.js";
import { startRun, randomSeed } from "../game.js";
import { GENOTYPES } from "../content/genotypes.js";
import { BACKGROUNDS, LEVELS } from "../content/backgrounds.js";
import { MUTATIONS } from "../content/mutations.js";
import { IMPLANTS } from "../content/items/implants.js";
import { TREES } from "../content/powers.js";
import { gainMutation } from "./mutations.js";
import { canInstall, install } from "../bodymods/implants.js";

export const RUN_MODES = ["oneWick", "commonsLamp", "pilgrim"];
export const NAME_MAX = 24;

// --- Point-buy -----------------------------------------------------------------------------------------------
const geno = (g) => GENOTYPES[g] || null;
const stepCost = (G, s) => (s < G.steepAt ? G.perPoint : G.steepCost);   // from s to s + 1

export function pointCost(genotype, score) {
  const G = geno(genotype);
  let cost = 0;
  for (let s = G.base; s < score; s++) cost += stepCost(G, s);
  return cost;
}
export const pointsSpent = (genotype, attrs) => ATTRS.reduce((n, k) => n + pointCost(genotype, attrs[k]), 0);
export const pointsLeft = (genotype, attrs) => geno(genotype).points - pointsSpent(genotype, attrs);
export const baseAttrs = (genotype) => makeAttrs(geno(genotype).base);
export function canRaise(genotype, attrs, k) {
  const G = geno(genotype);
  return attrs[k] < G.maxAtCreation && stepCost(G, attrs[k]) <= pointsLeft(genotype, attrs);
}
export const canLower = (genotype, attrs, k) => attrs[k] > geno(genotype).base;

// The attributes a tree leans on, for the suggested spread (the wizard's starting point; you change it freely).
const TREE_ATTRS = {
  blades: ["agi", "str"], bludgeon: ["str", "tou"], axe: ["str", "tou"], polearm: ["str", "agi"], missile: ["agi"],
  throwing: ["agi"], tumbling: ["agi"], shadowcraft: ["agi", "wil"], glimcraft: ["ego", "wil"], survey: ["int", "agi"],
  lore: ["int", "wil"], leechcraft: ["tou", "wil"], artificing: ["int"], pathcraft: ["tou", "agi"], parley: ["ego"],
  hardiness: ["tou"],
};

export function suggestSpread(genotype, background) {
  const a = baseAttrs(genotype), bg = BACKGROUNDS[background];
  const raise = (k) => (canRaise(genotype, a, k) ? (a[k]++, true) : false);
  // Everyone toward 16 (the average), a point at a time in turn.
  for (let more = true; more;) { more = false; for (const k of ATTRS) if (a[k] < 16 && raise(k)) more = true; }
  // Then the background's own attributes, its trees', toughness and agility, and anything else.
  const bonus = Object.entries(bg?.bonus || {}).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  const order = [...new Set([...bonus, ...(bg?.trees || []).flatMap((t) => TREE_ATTRS[t] || []), "tou", "agi", ...ATTRS])];
  for (let more = true; more;) { more = false; for (const k of order) if (raise(k)) more = true; }
  return a;
}

// --- Validation ------------------------------------------------------------------------------------------------
export function validateChoices(c = {}) {
  const out = [], G = geno(c.genotype), bg = BACKGROUNDS[c.background];
  if (!G) return [`no genotype ${JSON.stringify(c.genotype)} (bent or plumb)`];
  if (!bg) out.push(`no background ${JSON.stringify(c.background)}`);
  else if (bg.genotype !== c.genotype) out.push(`${bg.name} is a ${GENOTYPES[bg.genotype].name} background`);
  const attrs = c.attrs || {};
  for (const k of ATTRS) {
    const v = attrs[k];
    if (!Number.isInteger(v)) out.push(`${k.toUpperCase()} is ${JSON.stringify(v)}`);
    else if (v < G.base || v > G.maxAtCreation) out.push(`${k.toUpperCase()} ${v} is outside ${G.base}-${G.maxAtCreation}`);
  }
  if (!out.some((p) => /^[A-Z]{3} /.test(p))) {
    const left = pointsLeft(c.genotype, attrs);
    if (left !== 0) out.push(left > 0 ? `${left} point${left > 1 ? "s" : ""} not spent` : `${-left} point${left < -1 ? "s" : ""} overspent`);
  }
  const muts = c.mutations || [];
  if (muts.length && G.track !== "mutations") out.push(`${G.plural} take no mutations`);
  for (const id of muts) if (!MUTATIONS[id]) out.push(`no mutation ${id}`);
  if (c.implant != null && G.track !== "implants") out.push(`${G.plural} take no implants`);
  else if (c.implant != null && bg && !freeImplants(c.background).includes(c.implant))
    out.push(`${JSON.stringify(c.implant)} isn't a free implant for ${bg.name} (${freeImplants(c.background).join(", ") || "none"})`);
  const name = String(c.name ?? "").trim();
  if (!name) out.push("no name");
  else if ([...name].length > NAME_MAX) out.push(`the name is longer than ${NAME_MAX} letters`);
  else if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name)) out.push("the name holds a control character");   // (a newline, NUL, a direction mark)
  else if (!/[\p{L}\p{N}]/u.test(name)) out.push("the name has no letter in it");
  if (!RUN_MODES.includes(c.mode)) out.push(`no run mode ${JSON.stringify(c.mode)} (${RUN_MODES.join(", ")})`);
  if (bg && bg.glim > (bg.purse || CURRENCY.startPurse)) out.push(`${bg.name}'s ${bg.glim} glim doesn't fit its purse`);
  return out;
}

// The implants a Plumb background may take free at creation (bible §10.3: one costing at most freeImplantCost): every
// implant in WS5's table that cheap, its own first; until that table has its own, the one its Level sends it down with.
export const implantCost = (id) => { const d = IMPLANTS[id]; return d ? d.grade ?? d.license ?? d.cost ?? 0 : Infinity; };
export function freeImplants(background) {
  const bg = BACKGROUNDS[background], max = GENOTYPES.plumb.freeImplantCost;
  const ids = Object.keys(IMPLANTS).filter((id) => implantCost(id) <= max);
  if (bg?.implant && !IMPLANTS[bg.implant]) return [bg.implant, ...ids];
  return bg?.implant && ids.includes(bg.implant) ? [bg.implant, ...ids.filter((id) => id !== bg.implant)] : ids;
}

// --- The character ---------------------------------------------------------------------------------------------
export function* originBonuses(e) {
  const bg = e.background && BACKGROUNDS[e.background];
  if (!bg) return;
  if (bg.bonus) yield bg.bonus;
  const level = bg.level && LEVELS[bg.level];
  if (level?.bonus) yield level.bonus;
}

const copy = (it) => JSON.parse(JSON.stringify(it));
const known = (it) => !!ITEM_KINDS[it.kind];   // a kit piece whose kind the game has (WS8's missile weapons, once in)

export function makeCharacter(choices) {
  const problems = validateChoices(choices);
  if (problems.length) throw new Error(`makeCharacter: ${problems.join("; ")}`);
  const G = GENOTYPES[choices.genotype], bg = BACKGROUNDS[choices.background];
  const p = quickPlayer();
  Object.assign(p, {
    name: String(choices.name).trim(), genotype: choices.genotype, background: choices.background,
    attrs: Object.fromEntries(ATTRS.map((k) => [k, choices.attrs[k]])),
    trees: [...bg.trees], attrPoints: 0, mutations: {},
    origin: { level: bg.level || null, implant: null, fitted: false },
  });
  if (G.track === "mutations") p.creases = G.creases; else p.grade = G.grade;
  // The kit (content/backgrounds.js): a new body, the pack, the purse and the glim.
  p.body = makeBody("humanoid");
  for (const [part, it] of Object.entries(bg.kit.equip || {})) if (known(it)) p.body.equip[part] = copy(it);
  if (bg.kit.belt && known(bg.kit.belt)) p.body.belt = copy(bg.kit.belt);
  p.inv = [];
  for (const it of bg.kit.pack || []) if (known(it)) addToInventory(p, copy(it));
  if (bg.purse) setPurse(p, bg.purse);
  p.funds = Math.min(bg.glim, purseCap(p));
  // The second track: mutations (4b fills content/mutations.js and gainMutation), or the free implant (WS5).
  for (const id of choices.mutations || []) gainMutation(null, p, id);
  if (G.track === "implants") {
    const id = choices.implant ?? bg.implant ?? null;
    p.origin.implant = id;
    const item = id && IMPLANTS[id] ? { kind: "implant", id } : null;
    const part = item && (IMPLANTS[id].parts?.[0] ?? null);
    if (item && part && canInstall(null, p, item, part)?.ok) { install(null, p, item, part); p.origin.fitted = true; }
  }
  p.hp = maxHp(p);
  return p;
}

// --- Names (bible §2.3) ----------------------------------------------------------------------------------------
const CULTURES = {
  marshfolk: { onsets: "ma re pe il to sa ha ke os ve an bra mi ti ro lu", middles: "ren l ka vi ri ss me tt ar aa", finals: "n a e i o ke wyn l s mo", middle: 0.5 },
  drovers:   { onsets: "za qa te de gu az en se mu ro be hu da tu ye", middles: "q z ff kk d r s bb", finals: "u at ek ar ri fu ay e", middle: 1 },
  plumb:     { onsets: "cas quin aur ost sev ver mar dex cor del ys tal teo", middles: "el an ri o ra i", finals: "or ex us ant ine ade is ond el", middle: 0.6 },
};
for (const c of Object.values(CULTURES)) for (const k of ["onsets", "middles", "finals"]) c[k] = c[k].split(" ");
// The Plumb's families are their Levels' old drafting words (given name + family + Level: "Aurel Strade-Orrum").
const FAMILIES = ["Strade", "Quint", "Dell", "Ashlar", "Corbel", "Plinth", "Lintel", "Mullion", "Gauge", "Quoin"];
const BACKGROUND_CULTURE = { droversChild: "drovers", mesaRunner: "drovers" };   // raised on the roads and the Steps
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function word(culture, rng) {
  const C = CULTURES[culture];
  for (;;) {
    const w = rng.pick(C.onsets) + (rng() < C.middle ? rng.pick(C.middles) : "") + rng.pick(C.finals);
    if (w.length >= 3 && w.length <= 9) return cap(w);
  }
}

export function suggestName(genotype, background, rng) {
  const bg = BACKGROUNDS[background];
  if (genotype === "plumb") return `${word("plumb", rng)} ${rng.pick(FAMILIES)}-${LEVELS[bg?.level]?.name ?? "Vey"}`;
  return word(BACKGROUND_CULTURE[background] || "marshfolk", rng);
}

// --- Starting the run ------------------------------------------------------------------------------------------
export function beginRun(game, choices, { seed } = {}) {
  const p = makeCharacter(choices);
  nextRunPlayer(p);   // startRun's makePlayer() hands this character to the run instead of the quick start's
  try { startRun(seed ?? randomSeed()); } finally { nextRunPlayer(null); }
  game.state.mode = choices.mode;   // (WS9's title newGame does the same; docs/ws4.md, integration requests)
  for (const [faction, n] of Object.entries(BACKGROUNDS[choices.background].rep || {})) addRep(game, faction, n, "background");
  return game.player;
}

export const treeNames = (p) => (p.trees || []).map((t) => TREES[t]?.name || t);
