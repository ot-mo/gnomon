export const meta = {
  name: 'p0-session',
  description: 'One Phase 0 session: sequential implement steps, independent verify, fix, recheck',
  phases: [
    { title: 'Implement', detail: 'sequential steps in one checkout, a commit and push each' },
    { title: 'Verify', detail: 'three read-only skeptics: gate, old game + browser, spec + code' },
    { title: 'Fix', detail: 'reproduce and fix confirmed findings' },
    { title: 'Recheck', detail: 'rerun gate, confirm fixes, decide readiness' },
  ],
}

// The workflow every Phase 0 session ran in the cloud: sequential implementers in one checkout, then three
// independent read-only verifiers, a fixer, and a rechecker that decides whether the session can be tagged.
// Run it with Claude Code's Workflow tool: { scriptPath: "tools/workflows/p0-session.js", args: { id, base,
// prevNotes, extra, steps: [{ key, prompt }], branch, scratch, trailer, verifyExtra } }. The args used for 0B-0D1
// are in docs/HANDOFF.md's history (git log -p docs/HANDOFF.md) and in the session notes' scope.
const S = args
const BR = S.branch || 'wip/p0-0a2-vgrk8n'
const SCRATCH = S.scratch || '/tmp/gnomon-scratch'
const TRAILER = S.trailer || 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

const COMMON = `
GNOMON is a browser ASCII roguelike (repo /home/user/gnomon, branch ${BR}; stay on it). You work on Phase 0 session
${S.id} (TECH_DESIGN §8.2 "${S.id}": its scope and gate are your contract). Read CLAUDE.md and docs/HANDOFF.md first.
Governing documents, in order of authority: docs/design/DECISIONS.md (read it fully; it overrides everything), then
docs/design/WORLD_BIBLE.md §15 (binding data), the rest of the bible, then docs/design/TECH_DESIGN.md (data models §2,
combat §3, shell §4, persistence §7, appendices A and B). Earlier sessions' notes, binding context (APIs, deviations,
"what the next session must know"): ${S.prevNotes}.
${S.extra || ''}
Rules:
- Determinism (R6): nothing generation reaches may use Math.random, Math.hypot, random-comparator sorts or
  Math.sin/cos/exp/pow/atan2; use rng.js helpers, distance(), seededSort(). check-determinism scans for these.
- Never re-record golden fixtures; when an API they touch changes, update tests/golden/current-api.js only.
- No Caves of Qud names; nothing from bible §15.11 in UI or content strings. Mode ids oneWick/commonsLamp/pilgrim.
- Node ≥ 20, no npm deps. \`node tools/run-all.mjs\` must be green before each commit you push.
- Keep the old game and the 0A2 world playable at every commit: main is served by GitHub Pages.
- Commit each logical step separately and push right after: \`git push origin ${BR}\`. End every commit message with:
${TRAILER}
  Never rewrite history, never touch other branches, never tag (tag pushes are refused here anyway).
- Browser checks (headless Playwright; require('playwright'), chromium.launch() with no options; serve with
  \`python3 -m http.server <port>\` from /home/user/gnomon in the background): BEFORE any page script, add an init script
  that redirects every connect() to an AudioDestinationNode into an AnalyserNode followed by a zero-gain GainNode. Close
  the browser and kill the server when done. tools/browser-gate.mjs is the 0A2 example.
- Match the surrounding code style. New checks: tests/checks/<name>.js + tools/check-<name>.mjs, picked up by run-all.
`

phase('Implement')
const reports = []
for (let i = 0; i < S.steps.length; i++) {
  const st = S.steps[i]
  const prev = reports.length ? `Previous steps' reports:\n---\n${reports.join('\n---\n')}\n---\n` : ''
  const r = await agent(COMMON + `
You are implementer ${i + 1} of ${S.steps.length}; other agents run before and after you in the same checkout,
sequentially. Read \`git log --oneline -20\` and recent diffs first; build on what is committed; fix defects you find in
earlier steps (own commit). ${prev}
YOUR STEP: ${st.prompt}
${i === S.steps.length - 1 ? `As the last implementer you also: run every gate item of ${S.id} and record numbers; write
docs/sessions/${S.id}.md in the style of docs/sessions/0A2.md (what was built, exact public APIs, gate results with
numbers, deviations with reasons, known issues, what the next session must know); update tools/README.md; commit, push.` : ''}
Final answer (<= 450 words): what you built (files, signatures), commits, check results with numbers, deviations, open
items for the next step.`, { label: `impl:${st.key}`, phase: 'Implement' })
  reports.push(r || '(no report)')
  log(`${S.id} step ${st.key} done`)
}

const FINDINGS = { type: 'object', properties: {
  summary: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', properties: {
    title: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    where: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
    required: ['title', 'severity', 'where', 'evidence', 'fix'] } } },
  required: ['summary', 'findings'] }

const VCTX = COMMON + `
You are an INDEPENDENT VERIFIER of ${S.id}, implemented in commits ${S.base}..HEAD (claims in docs/sessions/${S.id}.md;
treat them as unverified). You are READ-ONLY: do not edit, commit or push (scratch files in ${SCRATCH}/verify-${S.id}-<lens>/;
a \`git worktree add\` of ${S.base} there is fine, remove it after). Report only problems with evidence (a command and its
output, file:line). No style preferences, no work the design defers to later sessions. Severity: blocker (gate fails, old
game or 0A2 world broken, determinism broken, data wrong vs the bible, main unplayable), major (spec item missing or
wrong), minor. Also judge whether the checks really test what they claim (try mutations: break the code, see a check fail).
`
const LENSES = [
  { key: 'gate', prompt: `LENS: the gate. Re-run every ${S.id} gate item yourself with your own scratch scripts and seeds
the checks don't use; compare with the recorded numbers; mutation-test the new checks.` },
  { key: 'play', prompt: `LENS: regressions and the real game. Compare ${S.base} with HEAD side by side (Node, through
tools/bot.mjs and game.debug), then play in the browser with real key presses (silenced audio, see rules): boot, intro,
temple, legacy stairs down and up, the surface and an edge crossing, inventory, and every ${S.id} feature in BOTH views
(map and 3D). Screenshot into your scratch dir and look at them. Console errors. Frame time vs ${S.base}.` },
  { key: 'spec', prompt: `LENS: design conformance and code bugs. Go through the ${S.id} scope list item by item (present
and correct / missing / wrong) with the DECISIONS overrides and bible numbers (§15.6 constants, §10 rules). Then read
\`git diff ${S.base}..HEAD -- src tools tests\` hunting real bugs; prove each with a small Node script.` },
]

phase('Verify')
const vres = (await parallel(LENSES.map(l => () =>
  agent(VCTX + l.prompt + (S.verifyExtra?.[l.key] || '') + '\nReturn your findings.',
    { label: `verify:${l.key}`, phase: 'Verify', schema: FINDINGS }).then(r => r ? { lens: l.key, ...r } : null)))).filter(Boolean)
const findings = vres.flatMap(r => r.findings.map(f => ({ lens: r.lens, ...f })))
log(`${S.id}: ${findings.length} findings (${findings.filter(f => f.severity === 'blocker').length} blocker, ${findings.filter(f => f.severity === 'major').length} major)`)

phase('Fix')
const fix = await agent(COMMON + `
You are the FIXER for ${S.id}. Independent verifiers' results (JSON):
${JSON.stringify(vres, null, 1)}
For each finding: reproduce it first (verifiers can be wrong; if it doesn't hold, say why). Merge duplicates. Fix every
confirmed blocker and major, and minors whose fix is small and safe; each fix its own commit naming what was wrong, pushed
right after, with a check assertion that fails without the fix where practical. Keep run-all green. Then add a
"Verification fixes" section to docs/sessions/${S.id}.md (finding | fix | commit; what was left open and why); commit, push.
Return per finding: fixed (commit) / not reproduced (why) / left open (why); and the final run-all result.`,
  { label: 'fixer', phase: 'Fix' })

phase('Recheck')
const recheck = await agent(VCTX + `
You are the RECHECKER after the fix round. Fixer's report:
${fix}
Findings: ${JSON.stringify(findings.map(f => ({ lens: f.lens, severity: f.severity, title: f.title, where: f.where })))}
1) Run \`node tools/run-all.mjs\` twice. 2) For each finding marked fixed, revert just its fix in a scratch clone and
confirm a check fails, and confirm the fix holds on HEAD. 3) Judge "not reproduced"/"left open" claims on blockers and
majors. 4) Quick silenced browser smoke (boot, intro, a ${S.id} feature in both views, temple stairs, an edge crossing;
no console errors; close everything). 5) git status clean and HEAD == origin/${BR}.
Return ready (can ${S.id} be tagged?), reasons, remaining.`,
  { label: 'recheck', phase: 'Recheck', schema: { type: 'object', properties: {
    ready: { type: 'boolean' }, reasons: { type: 'string' }, remaining: { type: 'array', items: { type: 'string' } } },
    required: ['ready', 'reasons', 'remaining'] } })

return { reports, verify: vres.map(r => ({ lens: r.lens, summary: r.summary, n: r.findings.length })), fix, recheck }
