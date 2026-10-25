// How many times each run generator ran (placeSites, generateHistory, makeVillages, and later ones):
// check-world's spy on the load path counts here, so restoreRun calling a generator directly (not only
// through buildRun or RUN_STEPS) is caught. A module of its own, so the generators need not import run.js.
export const GEN_CALLS = {};
export const countGen = (id) => { GEN_CALLS[id] = (GEN_CALLS[id] || 0) + 1; };
