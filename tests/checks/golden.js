// Golden check: today's code against what the parent game (75edbd3) did, recorded in
// tests/fixtures/golden/ (tools/golden-record.mjs, tests/golden/scenarios.js).
//
//   checkGolden(api, fixtures, { only }) → { name, ok, problems, stats, notes }
//
// fixtures: { mechanics, frames, dungeons, vaults, temple } as parsed JSON. The api is an adapter
// over today's modules (tests/golden/current-api.js). Pure: no file or DOM access.
import { canon } from "../lib/hash.js";
import { recordMechanics, recordFrames, recordDungeons, recordVaults, recordTemple } from "../golden/scenarios.js";

// Legacy level 1 differs on purpose since 0A1 (no sky well; stairs up to the temple), so the
// dungeon comparison covers depths 2-20 and only reports what changed on depth 1.
export const DUNGEON_GATE_FROM = 2;
// The temple fixture's field that 0A2 dropped (the temple's returnPoint); every other field is compared.
export const TEMPLE_DROPPED = null;   // nothing: returnPoint (coming up by Maren) was dropped in 0A2 and restored in its verification

// The paths at which two plain values differ (at most `limit`).
function diffPaths(a, b, path = "", out = [], limit = 8) {
  if (out.length >= limit) return out;
  if (a === b) return out;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) { out.push(`${path || "."}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], path ? `${path}.${k}` : k, out, limit);
  return out;
}
const same = (a, b) => canon(a) === canon(b);
const norm = (v) => JSON.parse(canon(v));

export function checkGolden(api, fixtures, { only = null } = {}) {
  const problems = [], notes = [], stats = {};
  const want = (part) => !only || only.includes(part);
  const t0 = Date.now();

  if (want("mechanics")) {
    const got = recordMechanics(api), exp = fixtures.mechanics;
    let bad = 0;
    if (got.steps.length !== exp.steps.length) problems.push(`mechanics: ${got.steps.length} steps, expected ${exp.steps.length}`);
    for (let k = 0; k < Math.min(got.steps.length, exp.steps.length); k++) {
      const g = norm(got.steps[k]), e = exp.steps[k];
      if (same(g, e)) continue;
      if (bad++ < 5) problems.push(`mechanics step ${k} "${e.step}": ${diffPaths(e, g).join("; ")}`);
    }
    stats.mechanics = { steps: exp.steps.length, mismatched: bad };
  }

  if (want("frames")) {
    const got = recordFrames(api).frames, exp = fixtures.frames.frames;
    const bad = Object.keys(exp).filter((k) => got[k] !== exp[k]);
    for (const k of bad.slice(0, 8)) problems.push(`frame ${k}: ${got[k]} (expected ${exp[k]})`);
    stats.frames = { frames: Object.keys(exp).length, mismatched: bad.length };
  }

  if (want("dungeons")) {
    const got = recordDungeons(api).levels, exp = fixtures.dungeons.levels;
    let bad = 0, compared = 0;
    const firstLevel = [];
    for (const key of Object.keys(exp)) {
      const depth = Number(key.split("/")[1]);
      const diff = Object.keys(exp[key]).filter((f) => !same(got[key]?.[f], exp[key][f]));
      if (depth < DUNGEON_GATE_FROM) { if (diff.length) firstLevel.push(`${key}: ${diff.join(", ")}`); continue; }
      compared++;
      if (!diff.length) continue;
      if (bad++ < 8) problems.push(`dungeon ${key} differs in ${diff.join(", ")}`);
    }
    if (firstLevel.length) notes.push(`legacy level 1 differs as intended (no sky well, stairs up): ${firstLevel.length} of 5 seeds`);
    stats.dungeons = { compared, mismatched: bad, depths: `${DUNGEON_GATE_FROM}-20`, levelOneChanged: firstLevel.length };
  }

  if (want("vaults")) {
    const got = recordVaults(api).vaults, exp = fixtures.vaults.vaults;
    const bad = Object.keys(exp).filter((k) => !same(got[k], exp[k]));
    for (const k of bad.slice(0, 8)) problems.push(`vault ${k}: ${diffPaths(exp[k], norm(got[k])).join("; ")}`);
    stats.vaults = { stamps: Object.keys(exp).length, mismatched: bad.length };
  }

  if (want("temple")) {
    // The temple is a plan since 0A2 (content/world/temple.js), stamped here the parent's way; every
    // recorded field is compared, returnPoint (coming up in front of Maren) included.
    const got = recordTemple(api).temples, exp = fixtures.temple.temples;
    const without = (t) => { if (!TEMPLE_DROPPED) return t || {}; const { [TEMPLE_DROPPED]: _, ...rest } = t || {}; return rest; };
    const bad = Object.keys(exp).filter((k) => !same(without(got[k]), without(exp[k])));
    for (const k of bad) problems.push(`temple seed ${k}: ${diffPaths(exp[k], norm(got[k])).join("; ")}`);
    stats.temple = { seeds: Object.keys(exp).length, mismatched: bad.length };
    if (TEMPLE_DROPPED && Object.keys(exp).some((k) => got[k]?.[TEMPLE_DROPPED] === undefined)) notes.push(`temple: ${TEMPLE_DROPPED} dropped as intended (0A2)`);
  }

  stats.ms = Date.now() - t0;
  return { name: "golden", ok: problems.length === 0, problems, stats, notes };
}
