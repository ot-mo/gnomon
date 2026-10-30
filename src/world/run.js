// The run (TECH_DESIGN §2.1): everything generated once per seed on top of the fixed world, then
// saved with the slot. A load restores it and never builds it again (§7.1), so a later change to a
// generator can't move a site or rename a village under an existing save.
//
//   buildRun(seed, world) → Run             world: a WorldModel (or a definition, compiled here)
//   serializeRun(run) → data                JSON only: the Maps as arrays of [key, value] pairs, the world by id and version
//   restoreRun(data, world) → Run           throws if the save was made for another world or version
//   zoneSeed(run, wx, wy, z) → int          the seed of one zone's generation
//   runRng(run, purpose) → rng              a stream of its own for each purpose ("history", "sites", …)
//   RUN_STEPS                               the build steps in order: [{ id, run(run) }]; later sessions add theirs
//   RUN_STATS.builds                        how many times buildRun ran (check-world's spy on the load path)
//
// Run = { seed, genVersion, world /* compiled, not saved */, history, sites: Map<siteId, Site>, sitesAt: Map<"wx,wy", siteId[]>,
//         villages: Map<siteId, Village>, factions: Map<id, FactionDef>, relations: Map<"a|b", -1 | 0 | 1>,
//         legends: Map<uid, LegendDef>, secrets: Map<id, SecretDef> }
// Each step draws only from its own stream (runRng or seedFor with its own purpose), so a change in
// one step never reshuffles another (R6).
import { makeRng, seedFor } from "../rng.js";
import { compileWorld } from "./worldmodel.js";
import { placeSites, placeLegends } from "./sites.js";
import { generateHistory } from "../story/history.js";
import { makeVillages, villageFaction } from "../story/villages.js";
import { makeSecrets } from "../story/secrets.js";
import { cultFaction } from "../social/cultdef.js";

export const RUN_VERSION = 1;   // the shape of a saved run
export const GEN_VERSION = 6;   // bumps whenever buildRun would make a different run from the same seed (2: WS10's sites and legends; 3: WS7's generated history and secrets; 4: WS7b's villages, their secrets and factions; 5: C1a's villages by quota and C2's names, peoples and relic powers; 6: C3's creatures, and the real world's legends and bands by region)
export const RUN_STATS = { builds: 0 };
const MAPS = ["sites", "sitesAt", "villages", "factions", "relations", "legends", "secrets"];

export const runRng = (run, purpose) => makeRng(seedFor(run.seed, "run", purpose));
export const zoneSeed = (run, wx, wy, z) => seedFor(run.seed, "zone", wx, wy, z);

export const RUN_STEPS = [
  { id: "history", run: (run) => { run.history = generateHistory(run.seed, run.world); } },
  { id: "sites", run: (run) => { placeSites(run); } },
  { id: "villages", run: (run) => { run.villages = makeVillages(run); } },
  // Factions and relations: the static FACTIONS arrive with 0C's content; the run has the villages' own, each under the
  // Bent villages or its people's (WS7b's villageFaction; village-site.js registers it on entering).
  { id: "factions", run: (run) => {
    run.factions = new Map();
    for (const v of run.villages.values()) run.factions.set(v.factionId, villageFaction(v));
    // The Hour cults, one for each ruler of the run's history (B3, C2 #6; social/cults.js registers each on entering
    // one of its Hour's sites). No draws: the same rulers make the same cults.
    for (const R of run.history?.rulers || []) if (R.short) { const def = cultFaction(R); run.factions.set(def.id, def); }
    run.relations = new Map();
  } },
  { id: "legends", run: (run) => { run.legends = placeLegends(run); } },   // WS10: every lair's owner, by uid
  { id: "secrets", run: (run) => { run.secrets = makeSecrets(run); } },   // WS7: every learnable secret of the run
];

const asModel = (world) => (world?.tileAt ? world : compileWorld(world));

export function buildRun(seed, world) {
  if (!Number.isInteger(seed)) throw new Error(`buildRun: the seed must be an integer, not ${seed}`);
  RUN_STATS.builds++;
  const run = { seed: seed >>> 0, genVersion: GEN_VERSION, world: asModel(world), history: null };
  for (const m of MAPS) run[m] = new Map();
  for (const step of RUN_STEPS) step.run(run);
  return run;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

export function serializeRun(run) {
  const data = { version: RUN_VERSION, seed: run.seed, genVersion: run.genVersion,
                 world: { id: run.world.id, version: run.world.version }, history: run.history };
  for (const m of MAPS) data[m] = [...run[m]];
  return clone(data);
}

export function restoreRun(data, world) {
  const model = asModel(world);
  if (data?.version !== RUN_VERSION) throw new Error(`restoreRun: a run of version ${data?.version}, this game reads ${RUN_VERSION}`);
  if (data.world?.id !== model.id || data.world?.version !== model.version)
    throw new Error(`restoreRun: the save is for world ${data.world?.id} v${data.world?.version}, not ${model.id} v${model.version}`);
  const d = clone(data);
  const run = { seed: d.seed, genVersion: d.genVersion, world: model, history: d.history };
  for (const m of MAPS) run[m] = new Map(d[m]);
  return run;
}
