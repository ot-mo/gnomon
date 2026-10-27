# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-27, the integrator (local session), on `integration`. **Phase 1 is running and Phase 2's
integration has started: WS3, WS8, WS4 and WS6 (both halves each) and WS5 are merged (`p2-ws3`, `p2-ws8`,
`p2-ws4a`, `p2-ws5`, `p2-ws6a`, `p2-ws4b`, `p2-ws6b`); the flip waits for the user (below), and the next `p1-*` tag
merges as it lands (WS10 next, it seems; WS9 is paused before its tag).** From here on only the integrator edits this file and
moves `main` (the workstreams write their handoffs in `docs/<ws>.md`).

## State

- **Last tag:** `p2-ws6b` on `integration` (`p0-done` + the Phase 1 plan + §8.4's fold + `p1-ws3`, `p1-ws8`,
  `p1-ws4a`, `p1-ws5`, `p1-ws6a`, `p1-ws4b` and `p1-ws6b` with their integration requests; `p2-ws3` … `p2-ws4b`
  before it).
  `main` is fast-forwarded to it (the timed gates confirmed alone on a quiet machine first). Phase 0's tags (`p0-0a1` … `p0-done`) and the workstreams' `p1-*` tags are on GitHub.
- **Branch:** `integration`, in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\integration` (serves on port
  8660). Nothing is half finished.
- **Done:** Phase 0 (0A1 … 0D2, notes in `docs/sessions/0A1.md` … `0D2.md`); WS3, WS8, WS4, WS5 and WS6a
  and WS6b (`docs/ws3.md`, `ws8.md`, `ws4.md`, `ws5.md`, `ws6.md`; `docs/sessions/ws3.md`, `ws8.md`, `ws4.md` "Part 4a"
  and "Part 4b", `ws5.md`, `ws6.md` "Part 6a" and "Part 6b"), merged. The merges' own numbers are under "Integration log" below.
- **Checks:** `node tools/run-all.mjs`, 37 checks (about 2 minutes on an idle machine, 4 with three workstreams
  running; the timed ones, `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end; since
  WS3, `check-perf` runs the render check first). Browser (headless Playwright, audio silenced,
  `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`, `browser-silent.mjs`, and
  with `node tools/serve.mjs <port>` running, `browser-shell.mjs` and `browser-0c.mjs` (`--port <port>`); each
  workstream's own (`browser-ws8.mjs` from WS8, `browser-ws4.mjs` from WS4, `browser-ws5.mjs` from WS5,
  `browser-ws6.mjs` from WS6). `tools/README.md` has every command and what each check proves.

## Next step

**The integrator, now:** the flip waits for the user's call on the tier 5-8 balance ("Waiting on the user"); when it
comes, flip (or retune first) as "The flip" under "Carried integration requests" says, on its own tag.

**The integrator, meanwhile:** wait for the coordinator's message; merge each `p1-*` tag as it lands, in §8.5's
order (WS9, WS3, WS8, WS5, WS4, WS6a, WS6b, WS10, WS2, WS7, WS1). For each: read `docs/<ws>.md` and
`docs/sessions/<ws>.md`; merge the tag; apply the requests aimed at P0's, unowned, the integrator's or merged
workstreams' files, and carry the rest (below, "Carried integration requests"); rerun its dependency-table items
(§8.3's end) against the real code; `run-all`, the bot, golden (b), the browser checks (serve on 8660, `?silent=1`);
verify sceptically, one commit per finding; tag `p2-<ws>` (annotated), push it, and only when
`git merge-base --is-ancestor origin/main p2-<ws>` holds, `git push origin 'p2-<ws>^{commit}:refs/heads/main'` (an
annotated tag's own name can't be pushed to a branch; `^{commit}` is the commit it tags).

**On `main` since `p2-ws6a`** (both at the user's request, without a tag of their own): the root README for GNOMON as
it stands at `p2-ws5` (`6645658`, from `wip/readme`; an interim update before Phase 4's rewrite; the secret rooms'
rules stay out of it, as DECISIONS asks), and CLAUDE.md for local-only sessions (`302fac7`, from `wip/local-only`:
the user won't use cloud sessions for this project again; "Handing off (local ↔ cloud)" became "Before you stop").
Worktrees read CLAUDE.md from their own checkout, so a workstream sees it once its branch picks up `main`.

**The workstreams** go on as the "Phase 1 plan" below says (the coordinating session starts the next one in the
queue as a slot frees).

**Phase 1** (TECH_DESIGN §8.3, ownership §8.4; DECISIONS "Phase 1 workstreams"): WS1-WS10, each in its own worktree
`C:\Users\Otto Mörner\Code\gnomon-wt\<ws>` on a branch `ws/<ws>` made from the tag:
`git worktree add "C:\Users\Otto Mörner\Code\gnomon-wt\<ws>" -b ws/<ws> p0-done`. A workstream edits only its §8.4
files, fills its stubs in place (keep every name `tests/checks/imports.js` freezes; drop `STUB` once a file is built),
replaces its check stub keeping `run(env)`, and puts any change to someone else's file in `docs/<ws>.md` under
"Integration requests". `features.js`, `content/index.js` and `tests/checks/index.js` are never edited after P0. Each
workstream ends the same way as a Phase 0 session: implement → independent verification → fix → recheck → tag.

## Phase 1 plan (agreed with the user, 2026-10-26)

**Three workstreams at a time**, in a rolling queue: when one tags, the next in the queue starts in the freed slot.
This laptop has 6 cores (12 threads) and 16 GB, shared with the user's training job; each `run-all` already runs 11
jobs, and each verification drives headless Chromium on SwiftShader (the CPU). A split workstream (a/b) keeps one
slot, one worktree and one branch for both halves, and its b session starts right after the a tag. 14 sessions in
all, about five rounds.

**Order** (§8.5's merge order: the workstreams others build on first, so the integrator can merge each one as it
tags; WS1, which builds on the most, last):

| # | Workstream | Worktree (`gnomon-wt\…`), branch | State |
|---|---|---|---|
| 1 | WS9 Persistence and shell | `ws9`, `ws/ws9` | running (since 2026-10-26) |
| 2 | WS3 Rendering outdoors and presentation | `ws3`, `ws/ws3` | tagged `p1-ws3` (51785f7); **merged, `p2-ws3`** (2026-10-27) |
| 3 | WS8 Combat depth, AI and targeting | `ws8`, `ws/ws8` | tagged `p1-ws8` (c9638c0); **merged, `p2-ws8`** (2026-10-27) |
| 4 | WS5 Body mods, items and equipment UI | `ws5`, `ws/ws5` | tagged `p1-ws5` (058bbbc); **merged, `p2-ws5`** (2026-10-27) |
| 5 | WS4a → WS4b Character creation and progression | `ws4`, `ws/ws4` | WS4a tagged `p1-ws4a` (dc22850), **merged, `p2-ws4a`** (2026-10-27); WS4b tagged `p1-ws4b` (f8062f9), **merged, `p2-ws4b`** (2026-10-27) |
| 6 | WS6a → WS6b Factions, dialogue builders → trade, the Kindling, backings | `ws6`, `ws/ws6` | WS6a tagged `p1-ws6a` (0697109), **merged, `p2-ws6a`**; WS6b tagged `p1-ws6b` (68ef866), **merged, `p2-ws6b`** (2026-10-27) |
| 7 | WS10 Dungeon sites, lairs and legends | `ws10`, `ws/ws10` | queued |
| 8 | WS2a → WS2b Surface generation | `ws2`, `ws/ws2` | queued |
| 9 | WS7a → WS7b Knowledge: history, villages, quests | `ws7`, `ws/ws7` | queued |
| 10 | WS1 Overworld travel | `ws1`, `ws/ws1` | queued |

- **Why these three first:** WS9 fixes the Continue hazard and gives real saves (IndexedDB, periodic and unload
  saves); WS3 owns the open outdoor-frame budget (§6.7's 17 ms), the horizon band and the clock's looks; WS8 builds the
  target screen, the look cursor and the spatial queries that WS4, WS5, WS6a and WS7 test against through their seams.
- **WS6b** builds the item backing only: DECISIONS settles the currency as glim, with no liquid backing and no
  containers; liquids stay what DECISIONS makes them (faction sacraments for the Kindling, the base of tonics).
- **Starting the next one:** from the main checkout,
  `git worktree add "C:\Users\Otto Mörner\Code\gnomon-wt\<ws>" -b ws/<ws> p0-done` (always from the tag), then
  `git push origin ws/<ws>`, then a session whose working folder is that worktree. Mark it in the table above.
  In PowerShell quote the path in single quotes; in Git Bash write it with forward slashes
  (`/c/Users/Otto Mörner/Code/gnomon-wt/$ws`): a backslash before `$ws` stopped it expanding once and made a folder
  `gnomon-wt$ws`.
- **Names:** `<ws>` is `ws1` … `ws10` (the a/b halves share theirs). Public API, "Integration requests" and the
  workstream's own "Handoff" section: `docs/<ws>.md`. Gate numbers: `docs/sessions/<ws>.md`, or `<ws>a.md` and
  `<ws>b.md` for the halves (`docs/sessions/ws6a.md`).

**How every workstream ends** (CLAUDE.md, as for a Phase 0 session):

1. Implement in its own worktree, editing only its §8.4 files; a change anywhere else goes in `docs/<ws>.md` under
   "Integration requests". Commit each logical step (the post-commit hook pushes `ws/<ws>`). A worktree made from
   `p0-done` carries DECISIONS' older "Browser checks" text that names Python: `main`'s (`4002a50`,
   `node tools/serve.mjs <port>`) is the one that holds.
2. Independent, sceptical verification: rerun the gate, look for regressions in the old game in both views, try to
   break the claims. Then fix (one commit per finding) and recheck. `tools/workflows/p0-session.js` is how Phase 0 ran
   this; it still serves pages with Python, so a run of it here needs `tools/serve.mjs` in its place.
3. Tag `p1-<ws>` (`p1-ws6a`, then `p1-ws6b`, for the halves) on `ws/<ws>` once `node tools/run-all.mjs` is green in
   the worktree and every §8.3 acceptance item has its numbers in `docs/sessions/<ws>.md`; push it at once
   (`git push origin p1-<ws>`).
4. **A workstream never touches `main` or `docs/HANDOFF.md`.** Its handoff (state, the exact next step, anything half
   finished, anything surprising) goes in `docs/<ws>.md` "Handoff" on its branch, so ten branches don't conflict in
   this file. Its worktree stays until the integrator has merged it.

**The integrator** (§8.5): one session in `gnomon-wt\integration` on branch `integration` from `p0-done`, started when
the first `p1-*` tag is up. It first merges `wip/p1-plan` (this file; it already holds `main`'s `4002a50`, DECISIONS'
serve rule, so `main` can fast-forward to the integrator's tags; merge `main` too if it has moved since), and folds `torch.js`, `keyset.js` and `tools/serve.mjs` into §8.4 (`0D2.md` §6): both done on 2026-10-27 (`ad067c5`
fast-forwarded, `e6b3f98`).
Then, for each `p1-*` tag (in §8.5's order when several are ready): merge,
apply that workstream's integration requests, rerun its dependency-table items against the real code, `run-all`, the
bot and golden (b); tag `p2-<ws>` and fast-forward `main` to it (only as a fast-forward; the command is under
"Next step"). Only the integrator edits this file and moves `main`; the file lives on `integration` (started
2026-10-27; `wip/p1-plan` is merged in and no longer updated).

**Timed checks with three workstreams running:** three `run-all`s at once skew the timed checks the way the training
job does. For a timed gate number, run that check alone on an idle machine and against `p0-done` in alternation
(`check-perf --against p0-done`); never loosen a budget.

## Waiting on the user

**The d20 balance at tiers 5-8, before the flip** (the user's decision of 2026-10-27: no retune until WS4's powers are
in, then settle it with the tables). With WS4 and WS8 both merged (`p2-ws4b`), `RULES.stats` and `RULES.combat` stay
`"legacy"` until the user has looked at this. `node tools/check-combat.mjs --only ttk` (WS8's tables; two builds added
at the WS4b merge, `02c7213`): a fighter at each tier's level (STR 18 / AGI 17 / TOU 16 at creation, an attribute
point every 4 levels, the tier's weapon and armour, enchanted +level/6 and +level/8) against the creatures that level
brings, weighted by how often each turns up; melee only. "You kill" is your seconds to kill one, "a kill costs" the
share of your health it takes meanwhile.

| Tier (level) | d20, no powers | d20, a combat power each level | d20, powers + a Bent's mutations | the parent (legacy) |
|---|---|---|---|---|
| 1 (2) | 1.12 s, 7.5% | 0.90 s, 6.0% | 0.77 s, 4.3% | 0.97 s, 8.7% |
| 2 (5) | 1.17 s, 7.8% | 0.82 s, 5.4% | 0.73 s, 3.7% | 1.04 s, 8.5% |
| 3 (8) | 2.01 s, 10.1% | 0.89 s, 4.4% | 0.83 s, 2.7% | 1.58 s, 9.7% |
| 4 (11) | 2.72 s, 17.7% | 1.21 s, 6.5% | 1.16 s, 4.1% | 2.16 s, 16.3% |
| 5 (14) | 4.47 s, 33.7% (troll 71%) | 1.94 s, 9.0% (troll 19%) | 1.86 s, 6.0% | 3.01 s, 24.9% |
| 6 (17) | 5.62 s, 44.3% (troll 78%) | 2.38 s, 11.8% | 2.27 s, 7.7% | 3.67 s, 30.0% |
| 7 (20) | 6.94 s, 54.2% (troll 76%) | 2.92 s, 14.6% | 2.80 s, 9.3% | 4.49 s, 34.8% |
| 8 (23) | 7.67 s, 60.0% (troll 83%) | 3.17 s, 16.6% (troll 23%) | 3.05 s, 10.6% | 4.92 s, 37.7% |

"A combat power each level" is a best case: Quick strikes, Keen eye and Mighty twice each, then Iron skin, Tough,
the Executioner, Regeneration (11 powers by level 14), as if every level offered the one wanted; the real offers are
3-4 seeded picks from your trees. "Powers + a Bent's mutations" adds Spare Heart, Thistlehide and Regeneration at
level / 2. C4's gear isn't in yet (DECISIONS: the integrator settles this before or at the flip). What the tables say:
without powers the d20 set is much harsher than the parent's from tier 4 (a troll costs 71-83% of your health at tiers
5-8); with a fighter's powers it is much kinder than the parent's from tier 3. **The user's call:** flip as built,
retune (say the creatures' level scaling or the tier gear's enchantment), or wait for C4's gear.

With it, the **leveling pace** under the attribute set (WS4 #5, applied at `p2-ws4a`): a kill gives the bible's
`killXp`, about 1% of a level for a same-level kill, so a level takes ~100 kills at every level (the integrator's
probe at `p2-ws4a`: level 1 ~20 kills, 3 ~100, 5 ~87, 8 ~93, 14 ~99, 20 ~101) against the parent's ~3, 9, 20, 41, 91,
147; until WS1 and WS7 give discovery and quest XP, the old campaign under the attribute set levels several times
slower through level 8.

- **The Lamplighter of Cassin's purse** (`docs/sessions/ws4.md` deviation 2): settled by the user in WS4a's session on
  2026-10-27: it keeps the 500 purse that holds its 250 glim, as built (recorded on `ws/ws4` in `95f8fcc`; it reaches
  `integration` with `p1-ws4b`).

Decided by the user on 2026-10-27 (given to the coordinating session in chat: "Do recommend for 1 and two and put
legend in pause card key list"), each now a carried item below:

- **WS9's recorded frames:** at WS9's merge the integrator excludes from `tests/checks/screen-frames.js`, by exact name
  in `NOT_COMPARED`, only the frames WS9's HUD, pause and death screens change, each with its reason; WS9's own check
  must hold the new screens; golden (b) stays held. No blanket exclusion.
- **The d20 balance at tiers 5-8:** no retune until WS4's powers are in, then settle it before or at the flip with
  WS8's TTK tables shown to the user: the tables are above (WS4 merged at `p2-ws4b`; C4's gear not yet).
- **The map's key hints** (L look, V fire, `,` legend, hotbar key 1): in WS9's pause card key list (WS9 has been told).

## Carried integration requests (by owner)

Requests the integrator can't apply yet because the file belongs to a workstream that hasn't merged; each is applied
at that merge (so it doesn't conflict with the branch). Numbers are the asking workstream's (`docs/<ws>.md`).

- **The flip** (§8.5; WS8 #9, WS4 #13), now that WS4 and WS8 are both in, **after the user's call above**:
  `RULES.stats = "attributes"` and `RULES.combat = "d20"` (DECISIONS: d20, not §8.5's "dice") by default; golden (a)
  retires; `check-legacyfights` then needs `overrideRules("combat", "legacy")` around its fights (its fixture is the
  parent's); WS8's TTK tables become the balance reference. Under d20 the map's T opens the target screen, creatures
  flee, and the log takes the d20 lines. WS9's title pushes the wizard (`create`, for the attribute set) only from the
  flip on (WS4 #13).
- **WS10** (at its merge): WS8 #3, spikes rise through a flat you harmlessly (bible §10.2): `traps.js updateSpikes`
  skips you when `!touchesYou(game, null)` (creatures.js). WS5 #12: Truing Cradles are `B.STATION` blocks (Benchmark,
  the Metronome, the Square; stations by region rules); Hour-site bottoms give true-marks (`{ kind: "credit", count }`)
  and artifacts (`randomBodyMod`); the Square's free fittings for a Plumb at Assize ≥ Warm pass `openTruing(game, { at:
  "cradle", …, waive: true })` (WS5 #20's other half). WS5 #9's metronome heart (`beatSight`: the next spikes, presses
  and hands in 3D) goes with WS10's traps. WS6a #2's spikes: `traps.js` hurts with `damageMonster`, which is yours (as
  in the parent), so spikes hurting a faction member give grudges against you and cost rep; pass no source
  (`applyDamage(game, m, dmg, { src: null, color, deathText })`). Then a spike kill gives no XP either (`killMonster`'s
  `byPlayer` follows the source), a change to the old game: keep the parent's XP for it if golden or the legacy fights
  notice. **A P0 check change, coordinator-approved, to confirm at the merge:** `tests/checks/world.js` `siteRules`
  skips the region-chance line for `kind === "historic"` only and holds such a site instead to "matches exactly one
  `history.siteRequests` entry, on its tier's span", with mutants showing it bites; nothing else in the check changes.
- **WS7** (at its merge; WS6a #6): villager types carry `factions` (or each villager `c.faction`) and `talk.dialogue`
  one of `social/builders.js ROLES`; a village registers its own faction with `parent: "bent"` (a Bent village) or
  `"peoples"`, so the Assize's hatred of the Bent reaches it, its members carrying `bentVillages` as a second membership
  (0.25-0.5) so the Assize writ and the Aspirant move them; quests `addRep(game, id, n, "quest")` (+100 with the
  village, +25 with each faction that likes it); Grey members hostile in their holy places (WS7 or C1). **WS6a #1,
  mortal people** (the integrator's, in WS8's files, at WS7's merge, when villager types with `hp` exist to test
  against): a talker whose type has `hp` gets `hp`, `maxHp`, `attack` and the AI's fields like a monster and is
  touchable while `hp > 0` (legacy people, with no `hp`, stay untouchable); the map's bump talks while it isn't
  hostile and strikes with Shift. Until then `touchable` refuses every talker, so the witnesses fire only on members
  that don't talk.
- **C4 / WS5** (WS6a #5's wearables, bible §3.5): the feather cloak, an Hour mask, the Assize writ, ink stains give
  `addRep(game, f, n, "worn")` when worn and take it back when unworn. **Content (C)**, WS6a #9: the Lantern Moths'
  "like you while your torch is lit" (text only today); the Smoothers with no membership (the parent rule makes them
  hostile); the Hour cults with `pilgrimFloor: false`.
- **C (content), from the WS6b merge:** WS5 #11's stock, a surgeon's or tinker's pack holding implants, artifacts and
  cells (a `registerStock` table with `randomBodyMod`, `IMPLANT_VALUE`; Old Ottilie, Detail C at Benchmark); WS6b #7,
  the faction variants of the rites (the Pouring, the Oiling, the Ascent, the Mirroring, Moon-Wick, Herdmothers only),
  the village dish, the faction specials (the Spore Moot's limb, the Pressing, the Snuff), the commons lamp, the
  Chandler banks, clear glim's and turnwater's full effects; a faction's `buys: { readings, topics }`. Powers still
  waiting on them: Oil fire (glim puddles), Brew (a village oven), Chime (preaching).
- **WS7 (from WS6b, #5 and #6):** journal entries the Kindling reads `{ kind: "location" | "history" | "village" |
  "gossip" | "recipe", reading: "flat" | "deep" | "dark", text, sold }`; a creature's own readings in `c.readings`;
  village leaders `named: true`; generated opinions as `c.opinions`; teachers list power ids in `c.teaches` (the
  Kindling teaches them; "teachers opening a tree", WS4 #11); `learnSecret` turns on "ask for a reading".
- **The integrator's own backlog** (WS5's requests in merged workstreams' files, new behaviour rather than wiring, so
  not rushed into the merge): #8 in `throwing.js`, gyro wrists (`gyroWrists`: thrown things fly flat, +2 damage) and
  the juggler's arm (`jugglerArm`: up to four knives at once); #9, the survey lens (`surveyLens`: 3D fills the map twice
  as far; `render3d.js`/`raycast.js`'s marking reach) and grip soles (`gripSoles`: no knockback, and climbing 2 on the
  map, `turns.js`). Each implant does nothing of that until then (it fits, costs grade, shows its text). Also WS5 #21,
  the plumb-line ear against the Askew's folds, once the Askew exist (C). From the WS4b merge: WS5 #19, the
  lantern-mote's light (status `running:lanternMote`, bible "a light of radius 6 that follows you"): `player.js
  torchRange`/`torchPower` at least 6 tiles with it on and `light.js inDark` counting you lit (read per ray hit in 3D:
  a bonus key read once a frame, say); WS4 #16, `screens/play.js toggleMap` emits `"view:turn" { from, to }` and Cast's
  `turnWorld` listens instead of watching `game.view` each frame (and the Hand's exception once the Hand exists);
  WS4 #19, Shellback refusing body armour (`inventory.js` equip) and Lightsick's hood or veil (a worn flag C4 adds).
  Optional, kept as deviations: WS4 #18 (Shadowsense showing ghosts whole) and #23 (the map's 2-block climb from
  Stilt Legs level 3, not 5). From the WS6b merge: WS6b #3, the Snuffer's mark, the torch's radius −1 for the rest of
  the run once `game.state.snuffer` is set (`player.js torchRange` has no game: a status or a field on the player);
  its "no shadow under you" needs nothing, as 3D draws no shadow of yours.
- **WS5** (merged at `p2-ws5`; what was carried to it): WS4 #9, the six free implants the Plumb backgrounds name (`tallyEye`, `plumbLineEar`,
  `truesteelKnuckles`, `levelEye`, `lampCrown`, `darkLens`), each costing at most 2, with `parts`; `makeCharacter` fits
  one with `canInstall(null, p, item, part)` and `install(null, p, item, part)` (no game at creation); the kits'
  wants (copper, iron, bone, a reed cloak, an examining kit, stilt sandals, a theodolite, a snuffer, a map case, ink
  pots, marker chalk, an Assize writ); a glim heart through `torchCost` (stats.js, applied). Information: WS8's L in
  both views emits `inspect { open: true }` (the examine screen opens on it); missile weapons are carried in the pack,
  not held, and `inventory.js` reads `WEAPONS[wielded.id]`.
- **WS9** (at its merge): WS3 #3, register the HUD's clock segment (`hud.registerHudSegment("clock",
  render3d.CLOCK_SEGMENT)`, under the sky only) and let `tests/checks/hud.js:91`'s 180-column "parent's order"
  assertion allow it on the start span (outdoors); WS3 #7, the held weapon at night (`hud.js:326-328`) lit by
  `light.lightAt(...).sky` (sky × daylight), not the raw sky light. **The recorded frames** (the user's decision above): exclude by exact name only the
  frames WS9's HUD, pause and death screens change, each with its reason, WS9's own check holding the new screens,
  golden (b) held. **The key hints** L (look), V (fire), `,` (the map legend; it was G until the WS5 merge, WS9 told) and hotbar key 1
  on the pause card's key list: if
  WS9 tags without them, add them at the merge (`screens/pause.js` is WS9's, merged by then) or carry the request on.
  WS5 #4, bare hands, all at once: `player.js attackTime` and `weaponReach` (WS4's) and `hud.js drawSword` read
  `WEAPONS[wielded(p).id]` and fail with nothing in the main hand; give fists a swing time and reach (no design number
  exists: the dagger's 0.3 s and a shorter reach, say), then `inventory.js unequipPart`'s "the main hand's weapon
  stays" can go. WS4 #4 with WS9 #2: `game.js startRun(seed, world, { mode, player })`, then `chargen.js beginRun`
  calls it so and `player.js` drops `nextRunPlayer`. WS6a #7: "P factions" on the pause
  card's key list beside the others (WS9 was paused before its tag and not told; add it at the merge).
  WS4 #12 and #13: WS9's title pushes `"create"` with `{ seed, mode }` (the wizard is registered on `integration`
  since `p2-ws4a`), and the wizard can read `save.js RUN_MODES` instead of its own copy; but **the wizard is for the
  attribute set**, so if WS9 merges before the flip, its title stays on the quick game (or hides New game) until the
  flip. WS4 #4 with WS9 #2 (startRun's `{ mode, player }`): above, under WS4b.
- **WS2** (at its merge): WS3 #5, `map` looks for the reserved TRUNK, SHALE, LEAVES, REED (blocks.js); note bible
  §15.7 reserves `♣` (speaking trees) and `^` (spikes), as blocks.js's comments say. WS3 #5 for GRASS (id 7, the
  integrator's): **not applied**: §6.5's grass `"` is the amulet's reserved glyph (bible §15.7 outranks TECH_DESIGN),
  and GRASS already shows as `.` in its own colour. WS3 #6, the edge-swap frame's step: the new zone's far apron
  bands are built from the world functions in the swap frame (`zones.js fillApron` → WS2's `buildApronBand`); build
  them during prefetch or a band a frame. Deferred to WS2's merge (it rewrites `buildApronBand`) together with WS9's
  "prefetch through the loader" (both touch `zones.js`'s prefetch). WS3 #10, the Gnomon's 14-block voxel foot at
  span (37, 3) (or C1's landmark plan): render3d starts the needle on whatever stands at the span's middle.
- **WS1, WS7, WS6b** (at their merges): WS4 #11, discoveries, quests, triangulations and Kindlings give XP through
  `gainXp(game, xpReward(kind, level), { source: kind })` (Pilgrim's ×2.2), and the powers waiting on them (Keen Eye,
  Pathfinder, Terrain lore, Homing sense: WS1; Hour script, Gossip, Triangulator, Vey's script: WS7) lose their `needs`
  (WS6b's part is done: the Kindling's XP and Warm Hands; Oil fire, Brew and Chime wait for content, above). WS8's glimgun (WS4 #10, for the Lamplighter
  and the Glimgunner power) is new content: C4 or a later pass, not a merge item. From WS4b: #22 (WS1), Wings gives `bonus(travel) = 1`, read as world-map travel × (1 +
  travel); #17 (C2, with WS8's flat movement), a listener for `"smoothers" { zone, size, burnisher, great }` spawns the
  pack along the floor (until then the warning shows and nothing comes).
- **WS1, C1, WS6b, WS7** (information, nothing to apply): WS3 #11 and #12 (`render3d.gnomonDrawn()` for "the Gnomon
  in sight"; `clock.handAt`/`underHand`; a region's or terrain's `fog` and a region's `music`; a liquid's `color`;
  `state.noonLength` for the Lengthening).

## Integration log

**`p2-ws6b`** (2026-10-27): `p1-ws6b` (68ef866) merged into `integration` (`fa1cde2`). Two conflicts, each resolved by
keeping both sides: `tests/checks/body.js` and `content.js` (WS8's, WS5's and WS6b's coordinator-approved sample lines,
WS6b's for its kinds `vial` and `coinage`). `tests/checks/social.js` and `tools/browser-ws6.mjs` merged on their own
over the WS6a merge's fixes (Shift on the map, the archers, the combat-order and harm-source tests: all still there).
- Applied, each with an assertion that fails without it: #2 (`4b4ed96`: `killMonster` takes `{ splash }` and the
  "kill" payload says `splash: true` for thorns and the lightning arc, so a flame-kin caught by an arc no longer makes
  you the Snuffer; the XP and rep stay yours); WS4 #11's WS6b part (`2fefb73`: Warm Hands offered, the Kindling's XP
  came built); WS4 #21 (`1241e39`: Crooked Manner's Kindling is a rude gesture and gains 20 less, never below
  nothing); #8 (`bf719a7`, README). Not applied: #3, the Snuffer's mark (the torch's −1 for the rest of the run is
  new behaviour: the integrator's backlog; 3D draws no shadow of yours, so its "no shadow" needs nothing); #4 nothing to
  do (WS3's `voiceOf` takes `voiceFor`'s objects); #5, #6 to WS7; #7 to content; #1 came applied.
- Dependency table: "WS5 implant surgery" against WS6b's real trade screen (`ec2bfbe`, check-items): a talking surgeon
  with WS5's services opens on the services tab, "Fit the spring tendons (feet)" by Enter pays 50 glim, fits them, an
  hour passes. WS5 #11's other half (a surgeon's stock of implants, artifacts and cells) is a `registerStock` table:
  content's.
- Merge finding (`85f6858`): `browser-0d1` failed "modes never reached: trade, ritual" (WS6b hadn't run it); its tour
  opens both over the map for a trader set beside you and closes each by Esc and by "Esc back": 23 of 23 modes.
- Checks: `run-all` at `bf719a7` **37 of 37** (126 s; the training job not running, CPU 40%). Timed alone, `check-perf
  --against p2-ws4b --rounds 3 --no-render` **PASS**, every item within its absolute budget (the outdoor frame 16.1 ms,
  dusk 15.0, night 14.9, the dungeon frame 10.8, refresh 7.7, surface generation p95 27.3 and max 145, dungeon
  generation p95 32.9, passTime 6.3, mapStep 1.7) and none over ×1.03 of `p2-ws4b`'s; `check-dungeons` p95 24.0 /
  24.0 ms. Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-ws6` (both sizes: the trade screen,
  the Kindling's three rites, Pell's six services); `browser-0d1 --against p0-done` 23 of 23 modes after the fix, the
  HUD at 100×30, golden (b) 27 of 27, per tick underground +0.6% (3D) and +0.2% (map), `browser-shell` inside it at
  both sizes; `browser-ws4` (both sizes); `browser-ws5`; `browser-ws8` (1234, 7); `browser-gate` (1234, 7);
  `browser-0c` (1234, 7); `browser-0d2 --all` (boot with 155 modules, `test-world.html` 34 passed, 0 failed);
  `browser-silent`.

**`p2-ws4b`** (2026-10-27): `p1-ws4b` (f8062f9, both halves of WS4) merged into `integration` (`978c167`). One
conflict, `tests/checks/progression.js`: the Plumb-implant block and the background-rep loop are integration's (WS5's
real table, `4e36991`; the starts by genotype, `dfb0a47`), as WS4b's handoff asked; the module object names
`factions` once. **No flip**: the TTK tables went to the user (above).
- Merge finding: WS4b's own rep tests read P0's 0 start (a Bent Reedcutter with Wings: the Kites 300 for 400 beyond
  the start; Crooked Manner 50, 0, -750 … for -50 each): measured from where the run began (`3dbacc2`).
- Applied, each with an assertion that fails without it: #1 (`e204173`): abilities and aimed artifacts on the map go
  through WS8's target screen. `abilities.js requestTarget` on the map calls `MAP_TARGET.request`, which
  `screens/target.js` fills when it loads (a hook as `THROW_AIM`: the static import closed a cycle and six modules no
  longer loaded alone); P0's stub is gone; `useAbility` acts on the confirm, Esc costs nothing. The screen holds an
  ability to its own reach (Fold Step 4 + level; the stub took any hostile within 10). P0's check-abilities, WS4's
  §7.4 and WS5's artifacts drove the stub: they drive the screen now (Enter, arrows, Esc); check-items' hand-made
  sighting stands on a seen tile (the screen's `inspectAt` asks). Unset hook: check-abilities fails. In headless
  Chromium with real keys (a probe): Digit1 on the map opens the screen, Esc spends nothing, three arrows and Enter land
  Fold Step 3 east with its 11.5 s and 0.5 s of game time. #2, #6, #7, #20's content (`84036e8`): Steady hand
  `missileAcc` +2, Thrifty wick and Cassin `torchCost` −0.5, Lampskin −1 (its text: the torch burns no glim), the
  Haggler, Steady hand and Thrifty wick offered (no `needs`). WS6a #4, WS5 #10's Keen fingers, Bellows' burning
  `src: "player"` (`0c080e0`). #14 (`0c54c9c`, README). #15 (`db4d0ba`: `browser-0d1` reaches B and K, 21 of 21
  modes). The TTK tables' two builds (`02c7213`). WS6a #5's mutations came built (Wings, Shellback, Lampskin,
  Flatwise, Gills, Crooked Manner; Ink Glands, Horns and Silk Glands aren't built). Carried (above): #4 and WS5 #4 to
  WS9; #16, #19 and WS5 #19 to the integrator's backlog; #17 to C2; #21 to WS6b; #22 to WS1; #18 and #23 optional.
- Dependency table: "WS4 abilities on the map" against WS8's real target screen (above: Node and the browser).
  "WS4 attribute stats" passes as at `p2-ws4a` (check-progression's 7 sections).
- Checks: `run-all` at `02c7213` **37 of 37** (193 s, the training job not running). Timed alone on the quiet machine
  (CPU 26%, no python), `check-perf --against p0-done --rounds 3` (4 rounds each way): a first run read dungeon
  generation p95 40.3 ms against `p0-done`'s 34.9 (×1.15, on the line); the rerun (`--no-render`) **PASS**, every item
  within budget or `p0-done` as slow: the outdoor frame 17.9 against 24.6 ms (×0.73), dusk 15.0, night 14.8, the
  dungeon frame 11.4, refresh 8.4 (×1.02), surface generation p95 34.0 (×1.01, max 155 against 141, both over 150: the
  machine's), dungeon generation p95 36.8 (×0.99), passTime 8.1 (×1.08), mapStep 1.8, the swap 22.4 against 55.4.
  No source change since `p2-ws4a` touches generation. `check-dungeons` alternating with `p0-done`: 111 / 32.2 ms
  against 63.7 / 33.0 (the first pair the machine settling; the second both pass). The absolute budgets hold on a quiet
  machine for this tree. Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-0d1 --against
  p0-done` 21 of 21 modes, the HUD at 100×30, golden (b) 27 of 27, per tick underground +1.1% (3D) and +0.8% (map),
  `browser-shell` inside it at both sizes; `browser-ws4` (both sizes); `browser-ws5`; `browser-ws6`; `browser-ws8`
  (1234, 7); `browser-gate` (1234, 7); `browser-0c` (1234, 7); `browser-0d2 --all` (boot with 155 modules,
  `test-world.html` 34 passed, 0 failed); `browser-silent`.

**`p2-ws6a`** (2026-10-27): `p1-ws6a` (0697109) merged into `integration` (`fc86113`), no conflicts; WS6a changed no
P0 check or fixture (only its own `tests/checks/social.js` and a new `tools/browser-ws6.mjs`). `p1-ws4b` came up
during the merge; WS6a was already in, so WS4b merges next, against §8.5's order (the coordinator's preference when
both are up), with no effect on either (their only shared file is check-progression's test, below). The README
(`6645658`) and CLAUDE.md (`302fac7`) reach `main` with this tag.
- Dependency table "WS6a witnesses" against WS8's real `creatures.witnessesOf` and combat: check-social's bot failed
  every witness item, for three reasons, each fixed with an assertion that fails without it: (1) WS8's `turnOnYou`
  gave the victim its grudge before "hurt" and "attack" went out, so `reputation.js offend` found it already hostile
  and charged nothing: a first blow on a Hollowmere villager cost no rep and told no witness, in both views
  (`6e9a51e`: `hurtCreature` emits "hurt" first; a d20 miss or a blow soaked to nothing is noticed after "attack";
  through `resolveAttack` a legacy hit, a d20 hit and a d20 miss each cost −10 once with a fellow watching); (2) on the
  map a creature not out for you is in the way (WS8), so the bot's bumps never struck (`fa8d749`: Shift, as a player
  would); (3) a witness sees no farther than its own sight, a goblin's 11, so the range edge at 11.75 tiles read "not
  a witness" for the wrong reason (`14a4add`: archers, sight 13; witnessRange 14 makes it fail). After: rep 100 → 90 at
  the first blow, 85 at the kill, both witnesses hostile and hunting, the far one, the one behind a wall and the Clatter
  trader not, on the map and in 3D. `browser-ws6` had the same arrow (`ee4a706`: Shift + the arrow; 100 → 90, three
  hostile, the "saw you strike" line, both sizes).
- Merge finding: check-progression (WS4's) expected a background's rep alone, from P0's stub's 0 start; with WS6a's
  starts by genotype the Reed-cutter's Hollowmere reads 200 (100 + 100) and so on for 8 backgrounds: the test now wants
  `clamp(baseRep + n)` (`dfb0a47`; `592fe1f`'s message said progression passed: it failed on this, from the merge).
- Applied, each with an assertion that fails without it: #2 in merged and the integrator's files (`4afd0c4`:
  `applyDamage` has no default source, every caller now passes one; the statuses you give carry `src: "player"`; a
  status kill is yours for the rep only then (a trap's gas or drowning is nobody's) while the XP stays the parent's;
  the "kill" payload's `factions` are `membershipsOf`'s ids, always `[]` before; mutants: each fails); WS5 #20 (`592fe1f`:
  the Plan +25 for each implant fitted in play, the first four; taking one out gives nothing back); #8 and #11
  (`d7a5b8d`, `9335397`: README rows for check-social and `browser-ws6`, §8.4 gives `browser-ws6` to WS6a); #10
  (`d2e4861`: `browser-0d1` reaches the factions screen, 19 of 19 modes). WS8 #2 and WS4 #8 came built in `p1-ws6a`.
  Carried (above): #1 (mortal people) and #6 to WS7's merge; #2's spikes to WS10; #4 and #5's mutations to WS4b; #5's
  wearables to C4/WS5; #7 to WS9; #9 to content. #3 is the dependency table above.
- Checks: `run-all` at `d7a5b8d` (every source change in) 35 of 37 (514 s; the CPU at 100%, the user's training job and
  Discord), the two failures timed only. Alone, alternating with `p2-ws5` (the tree before the merge): `check-dungeons`
  p95 120.5 / 113.9 ms against 134.3 / 103.9 (level; all four over the 40 ms budget on this load); `check-perf
  --against p2-ws5 --rounds 3`: passTime ×0.96, mapStep ×0.93 (what WS6a's `attitude` and the combat-order fix touch),
  refresh ×0.60, the dungeon frame ×0.69, surface generation ×1.06, dungeon generation ×0.72; the outdoor, dusk and
  night frames ×1.28-1.38, though no file in the draw path changed since `p2-ws5` (the frame measure is
  `game.debug.draw()` alone; the changed files are factions, social, combat, monsters, effects, throwing, artifacts):
  the machine's. A second round (`--rounds 3 --no-render`, the CPU still at 100%) **PASS**: every item within ×1.15 of
  `p2-ws5` (the outdoor frame ×1.01, dusk ×0.91, night ×0.95, the dungeon frame ×0.97, refresh ×1.04, surface generation
  p95 ×0.87, dungeon generation ×1.07, passTime ×1.09, mapStep ×1.01). The absolute budgets still want a quiet machine (last met alone at `p2-ws4a`). Golden,
  screen frames, the bot, the legacy fights, determinism, check-combat's five parts, check-social, check-progression
  and check-items all pass in the run. Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-ws6`
  (both sizes, after the fix); `browser-0d1 --against p0-done` 19 of 19 modes, the HUD at 100×30, golden (b) 27 of 27,
  per tick underground +1.6% (3D) and +2.0% (map); `browser-gate` (1234, 7); `browser-0c` (1234, 7: legacy and d20
  fights in both views, Pell's talk, shop and services); `browser-shell` (1280×720, 600×300); `browser-0d2 --all` (boot
  with 154 modules, `test-world.html` 34 passed, 0 failed); `browser-silent`; `browser-ws8` (1234, 7); `browser-ws4`
  (both sizes); `browser-ws5`.

**`p2-ws5`** (2026-10-27): `p1-ws5` (058bbbc) merged into `integration` (`791938e`). Three conflicts, all in P0 checks
and each resolved by keeping both sides: `tests/checks/body.js` and `content.js` (WS8's and WS5's sample lines for
their new kinds, #1), `tests/checks/screen-frames.js` (`NOT_COMPARED` the union of WS3's "victory card" and WS5's 8
"… inventory" frames, each by exact name with its reason, both coordinator-approved; all 9 names are recorded frames;
38 of 47 compared, 0 mismatched). The integrator's pause for the usage limit fell inside this merge (`a22986d`, a WIP
handoff); it went on afterwards from there.
- Verification findings, one commit each with an assertion that fails without it: the map legend's G took WS5's
  pick-up (§4.3 gives G to WS5): the legend is on the comma (`f170d6d`; WS9 told for the pause card); two Plumb
  backgrounds named implants WS5 built under other ids (`plumbLineEar`, `truesteelKnuckles` → `plumbEar`, `knuckles`),
  and check-progression's implant test assumed an empty table (`4e36991`; WS4b told to copy it); WS8's look tests
  expected the map back after a confirm, which now opens WS5's examine (`c820d2e`), and `browser-ws8` the same in the
  browser (`ae62bb6`: eleven steps failed after Enter; it now expects examine and Esc back, seeds 1234 and 7 pass).
- Applied, each with an assertion that fails without it: #3 (`24432f0`, a thrown potion through `effects.js splash`);
  #5 (`9b616ac`, the glim heart's `torchCost` −1); #6 (`fb3e737`, a bonus key `breath`, the bellows lung's 1: the first
  harm under water at 21 s, not 11; the HUD "AIR 20s"); #7 (`0b95d2a`, fists 1-2, gauntlets 1-4, truesteel knuckles 2-8
  that crush); #13 (`d73cdf5`, STATION is the "Truing Cradle", `¤` on the map outdoors); #14 (`90dd371`, `examineScore`
  is bible §13.4's `mod(int) + bonus(examine)`, WS5's identify roll uses it); #15 (`c8b1721`, README rows, §8.4 gives WS5
  `screens/inventory.js` and `browser-ws5`); #17 (the G finding above); #18 (`52f7d91`, `browser-0d1`'s tour reaches
  examine and the Truing Cradle: 18 of 18 modes). Carried (above): #4, #10, #19 to WS4b; #4 to WS9; #9's metronome
  heart and #12 to WS10; #11 to WS6b; #20 to WS6a; #21 to C; #8 and #9 to the integrator's backlog; #16 with golden
  (b); #22, #23 nothing.
- Dependency table: "WS5 examine from L" against WS8's real look cursor (`c820d2e`): a confirm on the map, LL, a
  click and L in 3D each open examine on what was looked at, and Esc goes back (fails with examine's inspect
  listener cut). "WS5 implant surgery" waits for WS6b's trade screen.
- Checks: `run-all` at `c8b1721` 35 of 37 (312 s, the CPU at 100%: the user's training job's python processes,
  Discord, Defender; no other session's checks), the two failures timed only (`check-dungeons` p95 56.4 against 40;
  `check-perf`). Alone against `p0-done` (`--rounds 3`) the machine stayed at 100% and `p0-done` itself read 2-3×
  over its budgets (its outdoor frame 56 ms against its usual 23), so the ratios were noise; alone against `p2-ws4a`
  (the tree before WS5; 5 rounds each way, alternating, 99-100%): **PASS**, every item within ×1.15 of it (outdoor
  frame ×0.91, the bake ×0.82, dungeon frame ×1.07, refresh ×0.99, surface generation p95 ×1.10, dungeon generation
  p95 ×0.52, passTime ×0.90, map step ×1.06). WS5's per-tick work (cells, running artifacts, the plumb-line ear: a scan
  of what you carry, once a tick, for you only) is microseconds. The absolute budgets were last met alone at
  `p2-ws4a`; recheck them on a quiet machine at the next merge. Golden mechanics 86, frames 27, 0 mismatched; screen
  frames 38 of 47 compared, 0 mismatched; the bot, the legacy fights, determinism; check-items, check-combat,
  check-progression, check-status. Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-ws5`
  (60 things scroll, the filter, the Equipment tab, examine from L and from an inspect, the Cradle fits a lamp crown
  by Enter); `browser-0d1 --against p0-done` 18 of 18 modes, the HUD at 100×30, golden (b) 27 of 27, per tick
  underground +2.3% and +0.4%, within its 5%, surface 3D −10.2%; `browser-ws4` (both sizes); `browser-ws8` (1234, 7,
  after the fix); `browser-gate` (1234, 7); `browser-0c`; `browser-shell`; `browser-0d2 --all` (34 of 34 in
  `test-world.html`); `browser-silent`.

**`p2-ws4a`** (2026-10-27): `p1-ws4a` (dc22850) merged into `integration` (e765e50), no conflicts; WS4a changed no
P0 check or fixture (only its own `tests/checks/progression.js` and `tools/check-progression.mjs`, and a new
`tools/browser-ws4.mjs`). Its tree passed check-progression, check-combat, check-imports, check-content, check-stats
and check-abilities with `integration`'s `stats.js` (#11, `missileAcc`) before anything was applied.
- Applied, each with an assertion that fails without it: #5 (`1fc9124`: `monsters.js killMonster` gives `killXp`
  under the attribute set, `m.xp` under the legacy set; a level-5 goblin at level 3: 7 and 3, the float "+3 XP"); #6
  (`37e06c8`: a bonus key `torchCost`, `torch.js burnTorch` × max(0, 1 + bonus): 2.2 × 240 s underground pays 1 glim
  at −0.5, none at −1, 2 and 2 without the hook; `tools/check-torch.mjs` passes the stat bus, which the check now
  needs); #7 (`0522c08`: `priceMul` gives a Haggler ×0.8 on buying under the attribute set, `RULES.price.haggle`,
  floored by the sell price: 1.3 → 1.04 at EGO 20, 0.9 at EGO 40); #14 (`8733564`: `tools/README.md` rows for
  check-progression and `browser-ws4.mjs`; §8.4 gives `browser-ws4` to WS4). #2 and #3 were settled at the WS8 merge.
  Carried (above): #1, the content halves of #2/#6/#7 and #4 to WS4b; #13 with the flip; #8 to WS6a; #9 to WS5;
  #11 to WS1, WS7, WS6b; #12 and #13 to WS9; #10 to content.
- Dependency table: "WS4 attribute stats" against the real stat bus (with the integrator's `stats.js` changes):
  check-progression's six sections pass (84 characters, 228 level-ups, the wizard, 30,000 names, the legacy card);
  a probe of every background's suggested character under attributes and d20: the background's AGI bonus reaches the
  attribute, DV and WS8's to-hit, `combat.dvOf` = `stats.dv` for all 12 (the Mesa Runner AGI 18+2 = 20, DV 8, +2 to
  hit; Orrum AV 2, the Aspirant 3). "WS4 abilities on the map" waits for WS4b (`abilities.js` is P0's until then).
- Verification: `browser-0d1`'s tour would fail on the newly registered `create` screen (as it did on WS8's target);
  it now pushes the wizard over the map as WS9's title will and leaves by Esc and by [ Back ] (`e8a0be1`): 16 of 16
  modes. The kill-XP pace after the flip (the probe above, under "The flip") goes to the user with the TTK tables.
- Checks: `run-all` at `8733564` (every request in) 36 of 37 (205 s): `check-perf` failing under load (the outdoor
  frame p95 126 ms, max 224; refresh ×1.65; surface generation p95 ×2.31), then alone, `check-perf --against p0-done --rounds 3` (4 rounds each way, CPU 25-34%): PASS, every item within
  budget but surface generation's max (194 ms, `p0-done` 171 as slow, the machine's): the outdoor frame 16.8 ms against
  23.2 (×0.73), dusk 15.6, night 16.1, the bake 1.8, refresh 8.2 (×1.03), surface generation p95 46.4 (×1.33: WS4a
  doesn't touch it; earlier rounds ×0.78-1.08), dungeon generation 31.5 (×0.94), passTime 6.65 (×1.02), the swap 25.5
  against 53.2. Golden mechanics
  86, frames 27, 0 mismatched; screen frames 46 of 46 compared; the bot, the legacy fights, determinism; check-combat's
  five parts; check-progression; check-torch. Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors):
  `browser-ws4` at 1280×720 and 600×330 (a Bent by keys with "Åsa Öberg-Ärla", a Plumb by mouse, the level-up card);
  `browser-0d1 --against p0-done` 16 of 16 modes, the HUD at 100×30, golden (b) 27 of 27 in the browser, per tick
  underground +1.1% (3D) and −0.1% (map), surface 3D −10.3%; `browser-ws8` (seed 1234), `browser-gate` (1234, 7),
  `browser-0c`, `browser-shell` (1280×720, 600×300), `browser-0d2 --all` (imports, `test-world.html` 34 of 34),
  `browser-silent`.

**`p2-ws8`** (2026-10-27): `p1-ws8` (c9638c0) merged into `integration` (a05decb), no conflicts (no file of WS8's
is WS3's).
- WS8's P0 check lines, confirmed and kept (#6): one `ITEM_SAMPLES` line in `tests/checks/content.js` and one sample
  line in `tests/checks/body.js` (the `missile` and `ammo` kinds, each `// WS8`), as `0D2.md` §6 asks of a new kind.
  #12 (3D draws every creature) came in with `p1-ws3` (`c8f2273`): dropped.
- Applied, each with an assertion that fails without it: #4 (`5351983`: `monsters.js pushPlayerOut` skips a creature
  still arriving: pushed 0 tiles while arriving, 0.40 once here); #11 (`d13fe5f`: `stats.js`'s own-bonuses source reads
  `e.bonuses`, so `innate` is ability ids only; the player's `["foldStep"]` used to sum into the bonus table as
  `{"0": "0foldStep"}`); #8 (`45816a9`: a bonus key `missileAcc` added to a shot's accuracy, the bolt-bow 1 → 3 with
  `{ missileAcc: 2 }`, the blade unchanged; Appendix A); #7 (`4e62fbb`: `tools/README.md` for check-combat's parts and
  `browser-ws8.mjs`; §8.4 gives `browser-ws8` to WS8). Not applied: #5 (the map header is in golden (b)'s frames; the user put
  the hints on WS9's pause card, above; the outdoor legend's `)` row is 18 cells wide, too narrow for "missile weapons and bolts"); #9 (the
  flip, at WS4's merge); #10 (nothing asked). Carried: #1 to WS4, #2 to WS6a, #3 to WS10 (above).
- Dependency table: "WS3 night auto-map, daylight perception" rerun against WS8's real `refreshView` and
  `creatures.sees` (`d5e308d`, render.js §3: the auto-map 576 / 9 / 137 / 127 columns as before; a goblin 7.7 tiles
  off sees you at noon and 18:30, not at midnight with your torch out, and again with it lit; fails with `sees`' dark
  factor taken out). "WS8 followers across edges" against P0's real zone events: check-combat's AI part passes (both
  views, the stairs, travel). The rest of WS8's (WS4 abilities on the map, WS5 examine from L, WS6a witnesses, WS7
  murals, WS8 attitudes) wait for those merges.
- Verification finding, fixed (`09b687e`): `browser-0d1` failed "modes never reached: target" (WS8's new screen; WS8
  hadn't run `browser-0d1`). It now opens the look cursor with L on the map and closes it by Esc and by a right
  click: 15 of 15 modes.
- Checks: `run-all` at `d5e308d` (every request in) **37 of 37** (209 s, CPU 74% at the start, three workstreams
  running), the timed ones within budget in the run (`check-perf` against `p0-done`: the outdoor frame 19.2 against
  26.3, ×0.73, the machine's; refresh 7.6 ×0.83; generation p95 35.7 / 31.7 ×0.78 / ×0.71; passTime 8.45 ×1.05; the
  swap 26.0 against 70.8; `check-dungeons` p95 38.5). Golden: mechanics 86, frames 27, dungeons 95, vaults 28, temple 2,
  0 mismatched; screen frames 46 of 46 compared; the legacy fights, the bot, determinism; check-combat's five parts
  (P0's combat, targeting, AI depth, the arena, the TTK tables). WS8's own timed item alone, `check-combat --perf
  --seconds 40 --against p0-done` (CPU 62-73%): passTime p50 7.40 / 7.11 / 7.97 ms (hunting legacy, hunting d20, two
  factions) against 5.32 / 4.95 / 4.89, ×1.39-1.63 as WS8 reported (×1.2-1.7), within the 12 ms budget. Browser
  (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-ws8` seeds 1234 and 7 pass (L, Tab, Enter, Esc, the
  mouse, T and TT, V and a click on the orc, L/V/T in 3D, the follower 3.0 tiles off, never striking you);
  `browser-gate` 1234 and 7 (the swap 43.0 / 44.2 ms on SwiftShader, black 0.006 → 0.007); `browser-0c` 1234 and 7;
  `browser-shell` 1280×720 and 600×300; `browser-0d1 --against p0-done` after the fix: 15 of 15 modes, the HUD at
  100×30 with 13 segments (WS8's `missile` among them), golden (b) 27 of 27 in the browser, per tick underground
  +1.6% (3D) and +2.0% (map), within its 5%, surface 3D −11.0%; `browser-0d2 --all`: boot with 153 modules, imports
  156 of 156, `test-world.html` 34 of 34 checks in the browser (render and combat with the integrator's assertions
  among them); `browser-silent` passes.

**`p2-ws3`** (2026-10-27): `p1-ws3` (51785f7) merged into `integration` (a7d3124), no conflicts (WS3 touched only
its §8.4 files and two P0 checks).
- WS3's two P0 check changes, confirmed: `b267794` (`tests/checks/clock.js` §5 a pure seam check: the same game time
  gives the same looks, daylight in 0..1, the sun a unit vector, buckets whole, fog never negative, the parent's noon
  sky at noon; the values are in `render.js` §1) and `87a902c` (`tests/checks/screen-frames.js`'s `NOT_COMPARED`
  holds only "victory card", with its reason; the fixture untouched; 46 of 47 frames compared, 0 mismatched).
  WS8's request 12 (3D draws every creature) is in `p1-ws3` (`c8f2273`), dropped from WS8's list.
- Applied: WS3 #8 (`fc234af`: `tools/README.md`'s check-perf row; `tests/checks/index.js`'s perf line names
  `p0-done`); WS3 #4 (`b0c6712`: G on the map shows or hides the legend, its foot says "G: legend"; `render.js` §6
  presses it and fails without the binding). Carried or declined: above.
- Dependency table: "WS3 apron rendering" against P0's apron (WS2 not in): render.js §2 (100 views, 0 black below
  the horizon) and check-edges pass; "WS3 night auto-map, daylight perception" is rerun at the WS8 merge.
- Checks (three workstreams running beside, CPU at 100% during the full runs): `run-all` at the merge 35 of 37
  (240.7 s), the two failures timed only (`check-dungeons` p95 42.3 against 40; `check-perf` with generation and
  refresh over budget and more than 15% slower than `p0-done` in that run), both passing alone: `check-perf --against
  p0-done --rounds 2` PASS (CPU 34-48%: the outdoor frame p50 17.4 ms against `p0-done`'s 25.0, ×0.70, the machine's;
  dusk 15.3, night 16.2, the bake p50 2.0, refresh 8.1 ×1.07, surface generation p95 35.7 ×1.08 and max 146 ms,
  dungeon generation p95 37.9 ×1.03, passTime 6.7 ×1.02, the swap frame p50 24.1 against 48.6), `check-dungeons`
  alternating with `p0-done` p95 25.3 / 26.0 against 28.2 / 27.2 ms. `run-all` again at `b0c6712` (the requests in):
  36 of 37 (188 s), `check-perf` failing under load in its one round (refresh ×1.61, dungeon generation ×1.31); alone,
  4 rounds each way (`--rounds 3 --no-render`, CPU 30-42%): PASS, refresh 7.91 against 7.93 ms (×1.00), surface
  generation p95 31.4 (×0.96), dungeon generation p95 34.7 (×1.00), the outdoor frame 19.9 against 23.1 (×0.86, the
  machine's). Golden (b) 27 of 27, golden mechanics 86, dungeons 95, vaults 28, temple 2; screen frames 47 drawn, 46
  compared, 0 mismatched; the bot (`check-bot`) and determinism pass; the render check 13 parts with `--expose-gc` (the
  dormant zone's 5 arrays freed). Browser, served by `tools/serve.mjs 8660`, `?silent=1`, 0 console errors:
  `browser-gate` seeds 1234 and 7 pass (the swap frame on SwiftShader 42.2 / 40.1 ms against a 16.2-16.4 median, black
  share 0.006 → 0.007); `browser-0c` seeds 1234 and 7 pass (legacy and d20 fights in both views, Pell's talk, shop and
  services); `browser-shell` at 1280×720 and 600×300 pass (43 mode changes each); `browser-0d1 --against p0-done`
  passes (14 of 14 modes, the HUD at 100×30, golden (b) 27 of 27 in the browser; per tick underground 3D −0.2%, map
  −1.3%, surface 3D −11.4%, surface map −0.2%).
- Not run at this tag: `browser-0d2` and `browser-silent` (run at the WS8 merge, on WS3's code too: both pass).
- Verification of the merge: no file of WS3's overlaps another merged one; the old game in both views is held by
  golden (a) and (b), the 46 frames, the legacy fights, the bot's both-view session and determinism. G underground
  (a probe on legacy level 3, 48×48, at 180 and 160 columns): the parent's legend shown → hidden → shown, the frame
  after two presses identical to the one before, no hint line underground; nothing presses G in any recorded run.

## Things a workstream should know (local machine)

- **Timing on this laptop:** when the user's ML training job runs, timed checks read 2-3x slow. Before calling a timed
  failure a regression, check the CPU and compare against an older tag in a worktree, run alternately
  (`check-perf --against <ref>` does this itself). Never loosen a budget.
- **Serving the repository:** `node tools/serve.mjs <port>` (DECISIONS "Browser checks"; the `gnomon` preview in the
  local, untracked `.claude/launch.json` runs it on 8130). Python's `http.server` drops part of a boot's ~150 module
  requests on Windows. Worktrees made from `p0-done` carry the older DECISIONS text that still names Python: the main
  checkout's DECISIONS is the one that holds.
- **Frame times on the GPU:** the browser tools' default Chromium renders on SwiftShader (the CPU). Playwright's
  headless shell renders on the Intel UHD when launched with `--use-angle=d3d11 --ignore-gpu-blocklist`
  (`0D2.md` §8 has the launch shim). Playwright's full Chromium doesn't start on this machine; Google Chrome
  (`channel: "chrome"`) does. The built-in browser pane is GPU-backed but runs at 6 frames a second while hidden.
- **Headless browsers grant every pointer-lock request**, and a CDP Escape counts as a user activation, so a refused
  lock can only be replayed (as `browser-shell` does). A real-keyboard check is still worth doing once with the user
  at the machine: in 3D press Esc (the pause card), J, wait 6 s, Esc: the game should land on the pause card, and a
  click on it should lock the mouse again.

## Open items carried forward

- **WS3 (merged; what's left):** the edge-swap frame's step (the far apron bands built in the swap frame: carried to
  WS2 above); the underground legend says "gold" while golden (b) holds (WS3 #9: change `renderMap.js`'s `$` row
  when it retires; the outdoor legend says glim). The outdoor frame, the horizon band and the clock's looks are done
  (`docs/sessions/ws3.md` §2: 16.1 ms at noon against `p0-done`'s 22.6 on a quiet machine).
- **WS8 (merged; what's left):** `passTime` costs ×1.2-1.7 `p0-done`'s in WS8's alternating measure (p50 4-5 ms
  against a 12 ms budget); spikes hurt a flat you (WS10, carried). (Monsters out for you are out for your followers
  since WS6a; L opens WS5's examine.)
- **WS6a (merged; what's left):** talkers can't be struck until WS6a #1 (at WS7's merge), so the witnesses fire only on
  faction members that don't talk; a witness sees no farther than its own sight (WS8's `sees`: people 10, a goblin
  11, ×0.55 with you in the dark), inside the 12-tile witness range; the Bent villages are one rep pool until WS7 gives
  villages factions; grudges never expire; spikes still count as your harm (WS10, carried).
- **WS6b (merged; what's left):** credit isn't built (a sale a full flask can't hold is refused); prices move with EGO and
  rep only under the attribute set (the flip); the legacy Pell keeps his own shop and his one pack; the Snuffer's
  torch −1 (the integrator's backlog); the content above.
- **WS5 (merged; what's left):** the backlog above (#8, #9); the item glyphs in the map legend (#16: `♦` implant,
  `Θ` artifact, `≡` cell, `¶` true-mark) wait with the underground legend for golden (b)'s retirement; two old lines
  kept as golden and the frames record them (#23: "You put on the The Mantle of Angles.", "throwing knifes"); a stray
  file outside the repository, `C:OTTOMR~1placeholder-never-written.txt` (1 byte), to delete by hand (the user).
- **WS9:** Continue can mix two moments (zones left after the last save are written behind and read on load: an item
  dropped after the save is duplicated); §7.3's save on a completed zone change fixes it. Saves are in memory only
  (IndexedDB, periodic and unload saves, the oneWick slot deleted on death, checkpoints). Prefetch is skipped while
  `ZONE_LOADER.load` is set (prefetch through the loader). `?debug=1` is parsed but unused.
- **WS4 (merged; what's left):** the flip waits for the user (above). 20 of the bible's 40 mutations (deviation 17);
  the Smoothers never come until something listens to `"smoothers"` (C2); Cast watches the view each frame until
  `"view:turn"` exists (the integrator's backlog). On the map an ability aims within its own reach now (WS8's target
  screen): Fold Step 4 + level, Kindle 5 + level; P0's stub took any hostile within 10 and stepped toward it. The quick
  start keeps its innate Fold Step (`0D2.md` deviation 17); the hotbar key's hint goes on WS9's pause card. A quick
  game starts with no glim, so in the old campaign the torch gutters 240 s into the first dungeon until cash is picked
  up (deviation 16); backgrounds give 60-250 glim.
- **Integrator:** the torch's hook has its users (Cassin, Thrifty wick, Lampskin, WS5's glim heart: `torchCost`). (§8.4
  names `torch.js`, `keyset.js`, `tools/serve.mjs` and `report.mjs` frozen, `e6b3f98`.)
- **C1:** the real world has no regions yet, so the Hollow Mere compiles as the Glass Sea; `content/world/regions.js`,
  `landmarks.js` and `plans/*.js` don't exist yet (import them from `worldmap.js`; the frozen index needs no edit).
- From 0C (minor test gaps): check-legacyfights doesn't cover a creature hitting a creature under the legacy rules;
  check-light doesn't cover renderMap's ghost drawing directly.
