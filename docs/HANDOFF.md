# Handoff: where GNOMON stands

Update this file as the last act of every session (see `CLAUDE.md`, "Handing off").

**Updated:** 2026-10-30, the integrator (local session), on `integration`. **Phases 1 and 2 are done; Phase 3 is under
way.** all six content sessions are merged (`p3i-c1a`, `p3i-c4`, `p3i-c2`, `p3i-c3`, `p3i-c1b`, `p3i-c5`), and §8.5's last wiring merge is done
(`p3i-wiring`): **new games start on GNOMON's real world at Hollowmere** (`?world=test` for the test world). `main` =
`p4i-b3` (B3's peoples and villages merged, on `p4i-beats`: C5's beats paid with their choices, barks, routes, Corner and village pools by region, on `p4i-people`, the landmark people placed, on `p3i-lightweapons`: the user's balance decisions of 2026-10-30 applied: creature scaling under d20, two species fixes, enchantment AV, fists, and light weapons by rule B; ttkTables' bounds on a typical build). **The backlog runs in four parts** (the user, 2026-10-30: "start everything that you can start"): B1, B2 and B3 in their worktrees from `p3i-lightweapons`, the integrator on the story (next step, below). From here on only the integrator edits this file and
moves `main` (the workstreams write their handoffs in `docs/<ws>.md`).

## State

- **Last tag:** `p4i-b3` (`p4b-b3` merged, on `p4i-beats`) on `integration`; before it `p4i-beats` (C5 #5, #6, #9, #11, #13 in part, #14, on `p4i-people`), `p4i-people` (C5 #3 with C1b #18: the landmark people placed, on `p3i-lightweapons`), `p3i-lightweapons` (light weapons, rule B, on `p3i-balance`), `p3i-balance` (the balance decisions of 2026-10-30, on `p3i-c5`), the Phase 3 merges (`p3i-c5`, `p3i-c1b`, `p3i-c3`, `p3i-c2`, `p3i-c4`, `p3i-wiring`, `p3i-c1a`), `p3i-sinkholes` (C1a's request 9, on `p3i-props`), `p3i-props` (props named; C1a's, C4's and C2's base), `p2-realworld`, `p2-2b` (2B hardening on `p2-ws1`: `docs/sessions/2B.md` and the integration log). Before it `p2-ws1` (`p0-done` + the Phase 1 plan + §8.4's fold + `p1-ws3`, `p1-ws8`,
  `p1-ws4a`, `p1-ws5`, `p1-ws6a`, `p1-ws4b`, `p1-ws6b`, `p1-ws10`, the flip, `p1-ws2a`, `p1-ws7a`,
  `p1-ws7b`, `p1-ws2b`, `p1-ws9` and `p1-ws1`, with their integration requests; `p2-ws3` … `p2-ws9` before it).
  `main` is fast-forwarded to it (the timed gates confirmed alone on a quiet machine first). Phase 0's tags (`p0-0a1` … `p0-done`) and the workstreams' `p1-*` tags are on GitHub.
- **Branch:** `integration`, in the worktree `C:\Users\Otto Mörner\Code\gnomon-wt\integration` (serves on port
  8660). Nothing is half finished.
- **Done:** Phase 0 (0A1 … 0D2, notes in `docs/sessions/0A1.md` … `0D2.md`); WS3, WS8, WS4, WS5, WS6, WS10,
  WS7, WS2, WS9 and WS1, all of Phase 1 (`docs/ws3.md`, `ws8.md`, `ws4.md`, `ws5.md`, `ws6.md`, `ws10.md`, `ws7.md`, `ws2.md`, `ws9.md`, `ws1.md`;
  `docs/sessions/ws3.md`, `ws8.md`, `ws4.md` "Part 4a" and "Part 4b", `ws5.md`, `ws6.md` "Part 6a" and "Part 6b",
  `ws10.md`, `ws7.md` "Part 7a" and "Part 7b", `ws2.md` "Part 2a" and "Part 2b", `ws9.md`, `ws1.md`), merged. The merges' own numbers are under "Integration log" below.
- **Checks:** `node tools/run-all.mjs`, 38 checks (WS10 added `check-sites`) (about 2 minutes on an idle machine, 4 with three workstreams
  running; the timed ones, `check-dungeons`, `check-status`, `check-stats` and `check-perf`, alone at the end; since
  WS3, `check-perf` runs the render check first). Browser (headless Playwright, audio silenced,
  `NODE_PATH="$(npm root -g)"`): `browser-0d2.mjs`, `browser-0d1.mjs`, `browser-gate.mjs`, `browser-silent.mjs`, and
  with `node tools/serve.mjs <port>` running, `browser-shell.mjs` and `browser-0c.mjs` (`--port <port>`); each
  workstream's own (`browser-ws8.mjs` from WS8, `browser-ws4.mjs` from WS4, `browser-ws5.mjs` from WS5,
  `browser-ws6.mjs` from WS6; `browser-ws7.mjs`, the integrator's, for WS7b's pray quests; `browser-2b.mjs`, 2B's, which serves the repository itself); WS9's browser half, `check-save.mjs --browser` (not in
  `run-all`). `tools/README.md` has every command and what each check proves.

## Next step

**Phase 1 is closed.** What `main` (= `p2-ws1`) holds, the balance phase's list and Phase 2's work are under "Phase 1's
closing state" below.

**Phase 2's 2B hardening is done: `p2-2b`** (2026-10-28; `docs/sessions/2B.md`). The bot playthrough is in
`check-bot`; travel saves, discovery XP on a load, `restClears`, the torch on the road and the journal's Locations tab
are in; the performance pass and the browser QA checklist (14 tools, `tools/browser-2b.mjs` new) passed. `main` =
`p2-2b`.

**`?world=real`** (`p2-realworld`, the user's request, 2026-10-29): a new game starts on the real world at
Hollowmere, holding the cube (it has none to find yet); without the flag nothing changed. The last wiring merge makes
the real world the default: then `main.js`'s `?world=real` branch and its cube hook go (`config.js` `WORLD` can stay
or go with it; browser-2b part 3 and check-overworld's 7 URLs follow).

**Next step:** the backlog in four parts, all from `p3i-lightweapons` (the user, 2026-10-30: "start everything that you can start"; the coordinating session split it, its rules in the side-session notes' `backlog-rules.md`):
- **The integrator**, on `integration`: the story, C5 #3-#14 (C1b #18, who stands where, with #3); #3 is done (`p4i-people`), #5, #6, #9, #11, #14 and #13's first part (`p4i-beats`); `p4b-b3` is merged (`p4i-b3`, GEN 8); next `p4b-b2` (its `WORLD.version` 4, GEN bumped again, and the people on its places), then `p4b-b1` once its tier-8 retune is approved, then #4 (the starter chain), #12 (the dungeons' people, on B2's floors), #7, #8, #10 and #13's rest; and it merges `p4b-b1`, `p4b-b2` and `p4b-b3` as they come, as a content tag, its merges setting `GEN_VERSION`.
- **B1, gear and powers**: `C:\Users\Otto Mörner\Code\gnomon-wt\b1`, `ws/b1`, tag `p4b-b1`. C4 #1, #2 (with C2 #12), #4-#10, #12-#14; WS5 #8, #9, #19; WS4 #16, #19; WS6b #3; POWERS' needs but B3's.
- **B2, landmarks and dungeons**: `gnomon-wt\b2`, `ws/b2`, tag `p4b-b2`. C1a #5; C1b #1-#17 and #19-#26 (not #18); WS10 #9. It builds the places, the integrator places the people; the bottoms (the Grub Mother, the Press-Master, the Gloam Warden, the Escapement, the Drowned Bellwether, Noon, the relics) are B2's as places and creatures, Vesper's phases, the endings and the barks the integrator's. C5 #12's Hierarch waits on B2's floors up (C1b #8), which B2 builds first.
- **B3, peoples and villages**: `gnomon-wt\b3`, `ws/b3`, tag `p4b-b3`. C2 #3, #5-#9, #11, #13; WS10 #6; the lore powers (Hour script, Gossip, Triangulator); Oil fire, Brew, Chime; WS6b's stock and `buys`.
Then Phase 4. Before: **Next step:** the integrator's backlog of the content sessions' code requests (the integration log's "Left" lists, C5 #3 first: placing the landmark people), then Phase 4. Before: **Next step:** the user's answer to the light-weapon proposal (`docs/balance/light-weapons-2026-10-30.md`: STR over one bar of 10 for every blade, the STR term and the material × swing ÷ 0.7; nothing changes until they approve; answered, rule B, applied at `p3i-lightweapons`), then the integrator's backlog of the content sessions' code requests (the integration log's "Left" lists, C5 #3 first: placing the landmark people), then Phase 4. Before: **Next step:** the user's answer to the balance proposal (`docs/balance/proposal-2026-10-30.md`; nothing changes until they approve; answered and applied at `p3i-balance`), then the integrator's backlog of the content sessions' code requests (the integration log's "Left" lists, C5 #3 first: placing the landmark people), then Phase 4. Before: **Next step:** C5 (quests, the campaign, the landmark people's words), the last content session, is started in `gnomon-wtc5` on `ws/c5` from `p3i-c1b` (the user, 2026-10-30: "Start C5"); the integrator merges its tag when it comes; the balance proposal (the user's decisions, 2026-10-30, under "Open items") fits around them. Before: **C1b and C3 were started** (the user, 2026-10-29: "start C1b (in the c1 worktree, merging p3i-c2 first)
and C3 (a new c3 worktree from p3i-c2)"); the integrator merges their tags as they come, then C5 starts on the user's
word. Meanwhile:
- **C1b and C3** (the Phase 3 plan's table), started: their worktrees from `p3i-c2` (`c1` again for C1b, on `ws/c1`; a new `c3` on
  `ws/c3`): `git worktree add "C:UsersOtto MörnerCodegnomon-wtc3" -b ws/c3 p3i-c2`; C1b merges `p3i-c2` into `ws/c1`
  first (a merge, no rebase). C5 after C1b, C2 and C3 are merged.
- **The integrator's next merge work** (promised at C4's and C2's merges): C4 #1 (the real world's loot and stock through
  `randomGear`/`randomTonic`), C4 #2 with C2 #12 (worn reputation). Then the backlog below ("Carried integration
  requests" and the integration log's "Left" lists): C1a #5; C4 #4-#10, #12-#14; C2 #3, #5-#9, #11, #13.
- `passTime` read ×1.29 against `p3i-sinkholes` after C1a's merge (6.9 ms, budget 12): one to watch at the next timed run.
- `run-all`'s check-overworld world-map draw reads 3.0-3.8 ms with 11 checks running on this machine and 1.5-1.7 alone:
  run it alone before calling it a regression.

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

## Phase 1's closing state (2026-10-28)

**What `main` holds** (`p2-ws1`): P0's ported game in both views (the parent's legacy stack on the test world, golden (b)
held), and on it: the outdoor renderer, day and night, the Gnomon (WS3); d20 combat, the target cursor, AI depth and
followers (WS8); character creation, the attribute set, powers, mutations and the level-up (WS4; the attribute set and
d20 are the defaults since `p2-flip`); implants, artifacts, the Truing Cradle and the inventory (WS5); factions, rep,
dialogue builders, trade and the Kindling (WS6); dungeon sites, lairs and legends (WS10); surface generation with 20
biomes, wildlife and props (WS2); history, secrets, the journal, villages, village quests and the campaign's hooks
(WS7); saves in IndexedDB with the run modes, checkpoints, the title, options, log, death and pause screens (WS9); and
the world map: travel, encounters, rest, getting lost and discovery (WS1). Every merge's numbers are in the
integration log below.

**The balance phase** (Phase 4, §8.7; the user, 2026-10-27: "settle the tuning (creature scaling, kill XP) in the balance
phase once C4's gear and WS1/WS7's XP are in": both XPs are in now): WS8's TTK tables ("Open items" below) with C4's gear;
creature level scaling (+6% HP a level, +1 damage per 4); tier gear enchantment; the kill-XP pace, about 100 kills a
level from level 3 on (the parent's 3 / 9 / 20 / 41 / 91 / 147 at levels 1 / 3 / 5 / 8 / 14 / 20); the quest, beat and
village XP (`xpReward` 0.6, 0.75, 0.2 of a level); discovery, which on the real world now pays about 8,600 XP in all
(16 landmarks about 7,300, 8 historic sites about 1,300: alone, level 1 to level 14; seeds 1234 and 7); bare hands
(FISTS: 0.3 s, reach 1.3, no design number); the wildlife's d20 numbers (no species has `dv` or attributes).

**Phase 2's work** (TECH_DESIGN §8.5): 2B hardening (the bot playthrough, the performance pass, the browser QA
checklist) and the last wiring merge (after C1). Found at the last merges and left for it (**the five items done in
`p2-2b`**; the coordinator's two questions answered by the user with the Phase 3 plan, 2026-10-29):
- **Travel saves:** WS9 saves every 10 s on the world map, but WS1's world map isn't saveable, rightly: `game.trip`
  isn't saved, so a save there would load you back where the journey began. Saving the trip (and then making
  `"world"` saveable, WS9 #8) is the fix; until then a travel save waits for the next view.
- **Discovery XP on a load:** WS1's `visit` runs on every `zone:enter`, a load included, so loading a save made before
  WS1 pays the sites of the span you're in (WS9's rule: a load is never a first visit; WS7b's village XP keeps it).
- **`RULES.cooldown.restClears`** (WS1 #7): 3600 s is 60 world hours since a world hour became 60 s; one hour is 60.
  WS1's own R10 rest test leans on the old number (a 2-hour rest keeps the second wind's cooldown), so it changes too.
- **The torch on the road** (WS1 #6): on the world map the torch burns by the zone you left, so the Shade by day costs
  nothing; `torch.js darkSeconds` could read the span under `game.trip`.
- **The journal's Locations tab** (WS1 #2): a key and a click to `openWorldMap(game, { center })` need a selected
  location, which the tab (scrolling text) doesn't have yet.
- **For the coordinator** (answered, 2026-10-29): Esc on the map stays the parent's "turn to 3D" for now (WS9 #5);
  props are named in the legend and inspect (WS2b #7), by the integrator before C1a.
- The integrator's backlog and every carried request: "Carried integration requests" and "Open items" below.

## Phase 3 plan (approved by the user, 2026-10-29)

TECH_DESIGN §8.6: content, in parallel by data file. **Approved by the user on 2026-10-29, with the recommended answers
to its four questions (below). No session is started yet: they start on the user's word.** The bible is the source (§4-§13, §15's data appendix); TECH_DESIGN §2.18 ("Content schemas")
gives the schemas (`regions.js`, `landmarks.js` and `plans/*.js` included). Phase 3 starts from
`p2-realworld`; what it leaves for Phase 4 is the balance (WS8's TTK tables with C4's gear, creature scaling, kill XP,
money) and the README.

**Six sessions, three at a time** (as in Phase 1: this laptop, shared with the training job). C1 is split in two: its
regions are what the last wiring merge and three other sessions wait on, and its 16 landmark plans are the biggest
single piece of authoring.

| # | Session | Its data files (§8.4's "C" row, split) | Waits on | Worktree, branch |
|---|---|---|---|---|
| 1 | **C1a The world: regions and terrain** (started 2026-10-29) | `content/world/worldmap.js` (the regions rows and `regionKey`; the Inkrun's `liquid: "ink"`), `content/world/terrains.js` (the world function's final numbers), new `content/world/regions.js`, `content/biomes.js` (final counts and spawn weights), `content/moods.js` (a region's music and fog), and Hollowmere's plan (`content/world/plans/hollowmere.js`: the start) | nothing | `c1`, `ws/c1` (both halves) |
| 2 | **C4 Gear and characters** (started 2026-10-29) | `content/items/*` (the parent's `items/legacy.js` entries stay as they are: golden), `content/mutations.js genotypes.js backgrounds.js powers.js` | nothing | `c4`, `ws/c4` |
| 3 | **C2 Peoples** (started 2026-10-29) | `content/factions.js villages.js grammar.js currency.js liquids.js` | nothing (it names regions by the bible's ids; checked against C1a's at the merge) | `c2`, `ws/c2` |
| 4 | **C1b The landmarks** (started 2026-10-29, from `p3i-c2`) | new `content/world/landmarks.js` and `content/world/plans/*.js` (the other 15 plans, the Gnomon's foot among them), the landmark dungeons' data in `worldmap.js`'s landmark index | C1a merged | `c1`, `ws/c1` |
| 5 | **C3 Creatures** (started 2026-10-29, from `p3i-c2`) | `content/creatures/*` (the parent's `creatures/legacy.js` tables stay: golden), `content/encounters.js`, `content/dungeons.js` | C1a merged (creatures and encounters by region) | `c3`, `ws/c3` |
| 6 | **C5 Story** (started 2026-10-30, from `p3i-c1b`) | `content/quests.js` (the quest texts, the campaign's 11 beats, the starter chain), the landmark people's dialogue (C1b places them; C5 writes their words), the intro on a real-world run | C1b, C2 and C3 merged (it reads their ids) | `c5`, `ws/c5` |

**Order:** C1a, C4 and C2 start together. When C1a tags, the integrator merges it, then does §8.5's **last wiring
merge** (new games on the real world: title → create → Hollowmere → the first village; `main.js`'s `?world=real` and
its cube step go; the test world keeps the legacy stack and every check that uses it; the bot playthrough runs on the
real world too), and C1b takes C1a's slot. C3 takes the next free slot, C5 the last. The integrator merges in the order
the tags come, C1a always first; each merge gets its tag and `main` fast-forwards to it.

**How a content session works** (as a Phase 1 workstream, CLAUDE.md and the steps under "Phase 1 plan" below):
- Its worktree is made from the integrator's latest tag when it starts (`p3i-props` for the first three, `p3i-c1a` and
  later after), so it sees what is merged; its branch is `ws/<c>`.
- It edits only its data files above, and may add assertions for its own data to `tests/checks/content.js` (§8.4
  passes `check-content` to C) and to the owner check its files feed (listed below). A change to code, or to anyone
  else's file, goes in `docs/<c>.md` "Integration requests", for the integrator: a system the data needs (a bleeding
  status, the Smoothers' listener, the Hour cults as generated factions), a frozen file (`rules.js`'s `contentMax`).
- Names are original (`check-names`, bible §15.11: no Caves of Qud names); the text is in the bible's voice (§2) and
  within §15.9's word budget for its area. A departure from the bible is a deviation in `docs/sessions/<c>.md` with
  its reason. The names and the key texts it wrote go in a list there, for the user to read through (not a gate).
- It ends as a workstream ends: implement → independent, sceptical verification (rerun the gate; the old game in both
  views; try to break the claims) → fix (one commit per finding) → recheck → tag `p3-<c>` with `run-all` green and
  every acceptance item's numbers in `docs/sessions/<c>.md`. It never touches `main` or this file; its handoff goes in
  `docs/<c>.md`. The integrator merges it, applies its requests, reruns `run-all`, the bot and the browser tools, tags
  `p3i-<c>` and fast-forwards `main`.

**Acceptance** (every session: `check-content`, `check-names`, its owner checks, `run-all` green; golden (b),
`check-screen-frames` and `check-legacyfights` untouched; something of it seen in both views in the browser, audio
silenced):
- **C1a:** every span of the real world in a region (bible §4; the regions §9.3 and §9.4 name; the village counts of §4.10); a region's
  tier, music, sky, fog, liquid, encounter rate, creatures, factions and site chances; check-world holds the regions to
  the bible as it holds the map; villages on the real world (check-story's village part on 20 real-world seeds, as on the
  test world); the Hollow Mere compiles as itself, not the Glass Sea; the Inkrun is ink; Hollowmere stands on its plan,
  generates the same twice and seams with its neighbours; check-surface, check-edges and check-landmarks pass on the real
  world; surface generation inside §6.7's budget there (check-perf, alone).
- **C4:** bible §13's gear (names, numbers, text), the 20 mutations still missing (WS4 deviation 17), implants,
  artifacts, genotypes, the backgrounds' kits (WS4 #9's wants), the powers' data; check-items' equip matrix and
  check-stats' every-gear-piece pass in both formula sets with the new pieces in; check-progression passes.
- **C2:** the 21 factions' relations, the village cultures and architecture by region (§9.3, §9.4), the grammar's
  lists and accounts (§8, §15.9's 2,400 words), the currency's text, the liquids' full effects; check-social and
  check-story pass.
- **C1b:** the 15 other landmarks on their plans (bible §5, §15.3): each generates on 5 seeds, the same twice, seams
  with its neighbours, and holds what its landmark promises (its people placed, its dungeon's levels, gimmicks and
  bottom); the Gnomon's 14-block foot at (40, 24); a screenshot of each in both views in `docs/sessions/c1b.md`.
- **C3:** bible §12's 63 creatures for every level the world makes (tiers 1-8: levels up to 23; `contentMax` rises,
  by request), each with its art passing the art check and a unique (glyph, colour) (check-creatures); wildlife's
  behaviours and d20 numbers; encounter tables and legends by region; WS8's TTK tables rerun per level band (check-combat),
  the balance reference; check-sites and check-overworld's encounter bands pass.
- **C5:** the 11 beats of *The Lengthening* (bible §11) as data at their landmarks, the starter chain and Hollowmere,
  quest texts and pools (§9.6, §10.5), the landmark people's dialogue; check-story passes; the bot playthrough on the
  real world takes the first beat.

**Carried to the content sessions** (the details are under "Carried integration requests" and "Open items" below):
- **C1a:** the Inkrun's `liquid: "ink"` (WS2); a region's `music` and `fog` (WS3 #11, #12); the Hollow Mere as the
  Glass Sea (C1 open item); villages on the real world (WS7).
- **C1b:** the Square's free fittings (`openTruing(... waive: true)`) and the landmark dungeons' `floorGimmicks`,
  `named`, `cradle` and `bottom` mapped onto `GIMMICKS` (WS10 #8, WS5 #20); the Keeper's Stair's levels 2-21 against
  `legacyZone`'s 1-20 (WS10 #9); a plan's legend letters and the Gnomon's foot (WS2b #9, #10).
- **C2:** Grey members hostile in their holy places; the village heights (§9.4), dish, commons lamp, shrine rewards;
  the Hour cults (with an integration request for `world/run.js`'s factions step); the rites' faction variants and
  specials (WS6b #7); a faction's `buys`; the Lantern Moths, the Smoothers' membership, the cults' `pilgrimFloor`
  (WS6a #9); clear glim and turnwater (WS6b).
- **C3:** wildlife's behaviours and the species left out (WS2b); the six legendary templates waiting on systems and the
  legends' `opinions` (WS10 #6, #8); the villagers' fight (WS7b); a surgeon's or tinker's stock (WS5 #11, with C4).
- **C4:** the worn rep items (feather cloak, Hour mask, Assize writ, ink stains: WS6a #5, with C2); the glimgun (WS4
  #10); Lightsick's hood or veil (WS4 #19); the powers whose `needs` wait on content (Oil fire, Brew, Chime, Bleed,
  Return, Staunch).
- **C5:** the line after the intro on a real-world run (still the parent's "Maren is waiting in the main hall"); the
  campaign's pages and beats, which show only on the real world.
- **The integrator, between merges:** its own backlog (gyro wrists, the juggler's arm, the survey lens, grip soles, the
  lantern-mote's light, `"view:turn"`, Shellback, the Snuffer's mark, the lore powers' effects); the code the sessions'
  requests ask for.

**Decided by the user with the plan** (2026-10-29, in chat: "Approve the Phase 3 plan as drafted, with the recommended
answers: six sessions, three at a time, C1a, C4 and C2 first; golden (b) held, with the real world's levels on their
own tables; name props in the map legend and the inspect text; Esc on the map stays 'turn to 3D' for now"):
1. **The split and the order:** six sessions (C1 in two), three at a time, C1a, C4 and C2 first.
2. **Golden (b) stays held:** the test world's legacy stack keeps the parent's numbers, and C3 gives the real world's
   levels (up to 23) tables of their own; `creatures/legacy.js`'s and `items/legacy.js`'s entries don't change.
3. **Props are named** in the map legend and the inspect text: a `props` describer, with P0's
   `tests/checks/hud.js:199` changed to allow it. **Done** (`de12966`, tagged `p3i-props`); C1a's final props are
   named through it (a prop is named as `content/biomes.js` PROPS names it).
4. **Esc on the map stays "turn to 3D"** for now (P0's `tests/checks/shell.js:366` unchanged); TECH §4.2's options
   stay reached by Tab and Esc twice, or the title.

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
| 1 | WS9 Persistence and shell | `ws9`, `ws/ws9` | tagged `p1-ws9` (fd2aa33), **merged, `p2-ws9`** (2026-10-27) |
| 2 | WS3 Rendering outdoors and presentation | `ws3`, `ws/ws3` | tagged `p1-ws3` (51785f7); **merged, `p2-ws3`** (2026-10-27) |
| 3 | WS8 Combat depth, AI and targeting | `ws8`, `ws/ws8` | tagged `p1-ws8` (c9638c0); **merged, `p2-ws8`** (2026-10-27) |
| 4 | WS5 Body mods, items and equipment UI | `ws5`, `ws/ws5` | tagged `p1-ws5` (058bbbc); **merged, `p2-ws5`** (2026-10-27) |
| 5 | WS4a → WS4b Character creation and progression | `ws4`, `ws/ws4` | WS4a tagged `p1-ws4a` (dc22850), **merged, `p2-ws4a`** (2026-10-27); WS4b tagged `p1-ws4b` (f8062f9), **merged, `p2-ws4b`** (2026-10-27) |
| 6 | WS6a → WS6b Factions, dialogue builders → trade, the Kindling, backings | `ws6`, `ws/ws6` | WS6a tagged `p1-ws6a` (0697109), **merged, `p2-ws6a`**; WS6b tagged `p1-ws6b` (68ef866), **merged, `p2-ws6b`** (2026-10-27) |
| 7 | WS10 Dungeon sites, lairs and legends | `ws10`, `ws/ws10` | tagged `p1-ws10` (1bbd302), **merged, `p2-ws10`** (2026-10-27) |
| 8 | WS2a → WS2b Surface generation | `ws2`, `ws/ws2` | WS2a tagged `p1-ws2a` (386bd98), **merged, `p2-ws2a`**; WS2b tagged `p1-ws2b` (2003f0a), **merged, `p2-ws2b`** (2026-10-27) |
| 9 | WS7a → WS7b Knowledge: history, villages, quests | `ws7`, `ws/ws7` | WS7a tagged `p1-ws7a` (b503957), **merged, `p2-ws7a`**; WS7b tagged `p1-ws7b` (d7a0038), **merged, `p2-ws7b`** (2026-10-27) |
| 10 | WS1 Overworld travel | `ws1`, `ws/ws1` | tagged `p1-ws1` (b042cc0), **merged, `p2-ws1`** (2026-10-28) |

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

- Nothing: C1a, C4 and C2 are running (2026-10-29). C1b, C3 and C5 start as the plan says, as slots free.

- **The flip** (decided by the user on 2026-10-27, given in chat in the coordinating session: "Flip as built now:
  switch to the attribute set and d20 combat, and settle the tuning (creature scaling, kill XP) in the balance phase
  once C4's gear and WS1/WS7's XP are in."): done at `p2-flip`, no retune; the deferred tuning is under "Open items
  carried forward", "Balance phase".
- **The Lamplighter of Cassin's purse** (`docs/sessions/ws4.md` deviation 2): settled by the user in WS4a's session on
  2026-10-27: it keeps the 500 purse that holds its 250 glim, as built (recorded on `ws/ws4` in `95f8fcc`; it reaches
  `integration` with `p1-ws4b`).

Decided by the user on 2026-10-27 (given to the coordinating session in chat: "Do recommend for 1 and two and put
legend in pause card key list"), each now a carried item below:

- **WS9's recorded frames:** at WS9's merge the integrator excludes from `tests/checks/screen-frames.js`, by exact name
  in `NOT_COMPARED`, only the frames WS9's HUD, pause and death screens change, each with its reason; WS9's own check
  must hold the new screens; golden (b) stays held. No blanket exclusion. **Done at `p2-ws9`**: WS9's four "… 3d pause
  card" frames by name, beside WS3's and WS5's (13 in all), `tests/checks/save.js` section 20 holding the card.
- **The d20 balance at tiers 5-8:** no retune until WS4's powers are in, then settle it with WS8's TTK tables shown to
  the user: shown at `p2-ws4b`; the user flipped as built and put the tuning in the balance phase (above).
- **The map's key hints** (L look, V fire, `,` legend, hotbar key 1): in WS9's pause card key list. **Done at `p2-ws9`**,
  with P factions beside them; check-save asks that every key the card names is bound.

## Carried integration requests (by owner)

Requests the integrator can't apply yet because the file belongs to a workstream that hasn't merged; each is applied
at that merge (so it doesn't conflict with the branch). Numbers are the asking workstream's (`docs/<ws>.md`).

- **C1 (from the WS10 merge):** the Square's free fittings for a Plumb at Assize ≥ Warm (WS5 #20's other half):
  whoever opens the Square's Cradle passes `openTruing(game, { at: "cradle", …, waive: true })`; landmark dungeons
  may carry `floorGimmicks`, `named`, `cradle` and `bottom: { kind: "legend" | "relic", … }`, their bible gimmick
  keys mapped onto `GIMMICKS` (WS10 #8); the real world's Keeper's Stair, listed with levels 2-21 (bible §15.3), is
  built by `world/legacy.js legacyZone` at level z, 1-20, as golden needs (WS10 #9: left as it is; decide with the
  real world).
- **C (content), from the WS7b merge** (WS7b #16, WS6a #6, WS7a #7): Grey members hostile in their holy places (no
  village is a holy place yet); bible §9.4's heights (stilts, ledges, canopy platforms, the Stacks' storeys: every
  village stands on the datum); the dish, the commons lamp's services, the shrine's rewards; the Hour's cults (bible
  §8.7, −500: `ruler.cult.name`, `game.state.journal.cultPass[rulerId]` making that cult treat you as a pilgrim in
  its sites) and an Hourbound leader at the reliquary (`site.historyRef.rulerId`), as generated factions in the run's
  factions step (`world/run.js`, which registers each village's own since `p2-ws7b`); the villagers' fight (mortal
  since `p2-ws7b`, they neither fight back nor flee: people's brains); the line logged after the intro on a
  real-world run (still the parent's "Maren is waiting in the main hall").
- **WS1** (at its merge; WS10 #7, WS7a #3; WS9 #8: register `"world"` with `saveable: true`): `learnSecret` calls `overworld/discovery.js pin(game, wx, wy, { label,
  secretId })` once discovery.js drops `STUB`; the visit quest also listens to `world:step` and reads `ev.to` as `{ wx,
  wy }`; the journal's Locations tab wants a key that opens the world map centred on a span; discovery XP is WS1's and skips
  village sites, whose first visit pays its own (`story/village-site.js`, `xpReward("village")`, source `"village"`;
  WS7b #13), and WS7b's find quest listens to `world:step` too. WS2b #11: an encounter table may read `BIOMES[biome].spawns`
  (bible §15.2's spawn keys as registered types with weights) through `gen/biomes/common.js spawnPick(rng, spawns,
  level)`. A legend met on the road is a zone patch `{ op: "spawnCreature", uid: def.uid, type:
  def.species, level: def.level }` with the def from `legendOf(run, uid)`; its lair is then empty of it (checked).
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
  Stilt Legs level 3, not 5). From the WS10 merge: WS10 #6, a legend's `opinions` `[{ faction, feeling, reason }]`
  (bible §12.13) for `attitude` and the Kindling, and the Herdmother's herd turning friendly with her. From the WS6b merge: WS6b #3, the Snuffer's mark, the torch's radius −1 for the rest of
  the run once `game.state.snuffer` is set (`player.js torchRange` has no game: a status or a field on the player);
  its "no shadow under you" needs nothing, as 3D draws no shadow of yours. From the WS7b merge: the lore powers'
  effects (Hour script, one more account on every stele; Gossip, one free rumour in every village; Triangulator, twice
  the triangulation's XP), after which they lose their `needs` (WS4 #11, WS7 #14; there is no "Vey's script" power).
- **WS5** (merged at `p2-ws5`; what was carried to it): WS4 #9, the six free implants the Plumb backgrounds name (`tallyEye`, `plumbLineEar`,
  `truesteelKnuckles`, `levelEye`, `lampCrown`, `darkLens`), each costing at most 2, with `parts`; `makeCharacter` fits
  one with `canInstall(null, p, item, part)` and `install(null, p, item, part)` (no game at creation); the kits'
  wants (copper, iron, bone, a reed cloak, an examining kit, stilt sandals, a theodolite, a snuffer, a map case, ink
  pots, marker chalk, an Assize writ); a glim heart through `torchCost` (stats.js, applied). Information: WS8's L in
  both views emits `inspect { open: true }` (the examine screen opens on it); missile weapons are carried in the pack,
  not held, and `inventory.js` reads `WEAPONS[wielded.id]`.
- **C (content), from the WS2b merge** (WS2b #9, #10): a landmark plan (C1) may use WS2's legend letters (`legend: { ch:
  id }`, with `props`, `creatures` and `rubble` on the plan; `gen/biomes/legend.js`); a plan replaces
  `LANDMARK_BUILDERS`, and the Gnomon's must stand its own 14-block foot at the span's middle, (40, 24), where render3d
  starts the needle; until then the real world's landmarks stand on stub footprints. Wildlife (C3 and the balance
  phase): bible §12's behaviours, the species left out, d20 `dv` and attributes per species; `content/biomes.js`'s
  wildlife counts and spawn weights are first numbers. GRASS (id 7) stays `.` (§6.5's `"` is the amulet's). Naming
  props in the map legend (`,`) and the inspect describer needs a `props` describer, which `tests/checks/hud.js:199`
  (P0's) freezes out; the props are drawn since `p2-ws2b`, unnamed. **Decided** (the user, 2026-10-29): name them; the
  integrator, before C1a.
- **WS1, WS7, WS6b** (at their merges): WS4 #11, discoveries, quests, triangulations and Kindlings give XP through
  `gainXp(game, xpReward(kind, level), { source: kind })` (Pilgrim's ×2.2), and the powers waiting on them (Keen Eye,
  Pathfinder, Terrain lore, Homing sense: WS1; Hour script, Gossip, Triangulator, Vey's script: WS7) lose their `needs`
  (WS7's part is done: its quest, beat and village XP go through `xpReward`, and the three lore powers wait in the
  integrator's backlog; WS6b's part is done: the Kindling's XP and Warm Hands; Oil fire, Brew and Chime wait for content, above). WS8's glimgun (WS4 #10, for the Lamplighter
  and the Glimgunner power) is new content: C4 or a later pass, not a merge item. From WS4b: #22 (WS1), Wings gives `bonus(travel) = 1`, read as world-map travel × (1 +
  travel); #17 (C2, with WS8's flat movement), a listener for `"smoothers" { zone, size, burnisher, great }` spawns the
  pack along the floor (until then the warning shows and nothing comes).
- **WS1, C1, WS6b, WS7** (information, nothing to apply): WS3 #11 and #12 (`render3d.gnomonDrawn()` for "the Gnomon
  in sight"; `clock.handAt`/`underHand`; a region's or terrain's `fog` and a region's `music`; a liquid's `color`;
  `state.noonLength` for the Lengthening).

## Integration log

**`p4i-b3`** (2026-10-30): `p4b-b3` (e5e4df4, B3: peoples and villages, from `p3i-lightweapons`) merged into `integration`
on `p4i-beats`, cleanly (`world/run.js` and `tests/checks/story.js` auto-merged). What it brings is in `docs/b3.md`: the
Kindling's faction variants, holy places, a cult per Hour, the villages' heights by style, the commons, drinking and
puddles, the smoothers, the bank and the money's words, a legend's opinions, the lore powers with Oil fire, Brew and
Chime (held by their `needs` until B1's retune: open items), the tinker's and surgeon's stocks. **`GEN_VERSION` 7 → 8**
(the cults in the run's factions; every village surface). `torch.js`'s change (C2 #13, with the coordinator's approval)
confirmed. B3's requests to others (`docs/b3.md` "Requests" 3-9) stay with their owners: B1 (the fungal limb, the Snuff,
turnwater's shutdown), the integrator (`turns.js`'s confused steps on the map and ink's shortcut; WS3's renderer: glass
walls seen through, umbra's hole of dark), B2 (`zone.holy`, `zone.holyAreas`, `zone.steles`), content (the Moon-Wick's
legend template; the smoother's and burnisher's `needs` text). Checks: `run-all` **38 of 38** (212.7 s); the real
world's bot playthrough; browser-gate (seeds 1234 and 7) and browser-2b pass; B3's `b3-browser.mjs` passes 3 of 3 on the
merge and 2 of 2 on B3's tag with its 3D puddle capture given 30 frames after the puddle is taken away; with the 4 it
waits it fails at random on B3's own tag too (1 of 2: the frame isn't redrawn yet), so the step's wait is the fix (the
script is in the coordinating session's notes). Audio silenced, servers stopped.

**`p4i-beats`** (2026-10-30): C5 #5, #6, #9, #11, #13 (first part) and #14 on `p4i-people`.
- **#5, #6** (`story/beats.js`, on campaign.js's "beat" event): a done beat pays its reward, the text logged (items:
  `QUESTS.campaign.questItems` as quest items, C4's artifacts made and known, the parent's relics, tonics; one not made
  yet, the unpress lens and the Great Theodolite, owed and paid on a zone:enter once it can be; Maren's +5 max HP through
  `raiseMaxHp`; rep through `factions.addRep` "quest", beat 9's range at its low end until the siege counts survivors;
  glim, what doesn't fit on the ground; a reading; Noon's Face, `screens/play.js`: a turn leaves you untouchable 1 s, every 8
  s at most). Choices: every done beat's but those by route (6, 8: #7, #8) as "About ..." at the giver (each word of its
  giver in the talker's name), paying rep, glim, items, a reading, taking what an option gives away (beat 1's seal, only
  while you carry it), recording `campaign.choices`, the alliance and the ambush; beats 5 and 7, with no giver, ask on a
  page of their own that opens once you're in the world, every waiting choice in order, "Not yet." or Esc for a world
  hour. "What's wrong?" at the giver tells an open beat's offer; a giverless beat's offer is logged as it begins; the
  journal shows a beat's routes under its goal. The talk box now names its speaker by the speaker's own name, title and
  colour (a placed person, a village's named people; the beat's page has no type: that was the freeze, below).
- **#9** (`story/questplan.js`): a real-world village quest's thing or beast from its region's pool, one draw as before; the
  test world's spans have no region with a pool. **`GEN_VERSION` 6 → 7.**
- **#11** (`story/barks.js`): a creature's bark (by `who`, else its type) once, when it notices you (`ai.js` emits
  "creature:notice") or wakes as a guardian; the Lich King's line for the Lich alone. The bottoms' barks (the Grub Mother,
  the Press-Master) want B2 to set their `who`.
- **#13, first part**: a beat's `done` may be a list of matchers; "route" { id } is a route's event; beat 2 finishes by
  Detail C's reading too (300 glim, free at Plan Warm, refused at Plan Dark). Left: beat 1's other routes (Brann's
  undercroft wall, Ess and Tee's walk: their places), beats 9 and 10's stand-ins (the siege; the Hierarch's Key).
- **#14**: "Pet her." on Corner, +10% XP for a world day (`state.xpBoost`, `leveling.js gainXp`, whole XP).
- **Verification**: an independent reviewer on `37da06f` (nine findings) and another on `72a61ff` (four), each fixed in
  its own commit with mutants: the game froze after beats 5 and 7 (`drawTalk` read the page's missing type: 9b016ec);
  the page couldn't be left and only one beat could wait (d7a1a49); glim that didn't fit was lost (2089113); a beat paid
  at time 0 paid twice (99dc832); the seal stayed after you gave it away, and quest items could come twice (d3132c6);
  reward text, a giverless offer, `raiseMaxHp` (72a61ff); an option paying without the seal (0a3f676); "Which way am I?"
  on the beat's page (d38f073); Detail C reading at Plan Dark (25ac68e); "Not yet." back at every span (2af1fcd). Left
  as open items: the Shame reading, the Seventh-Chimers, beat 10's giver, the seal in B2's tunnel. Mutants: 76, each
  killed.
- **Checks**: `run-all` 37 of 38 under load (check-overworld's world-map draw, 3.07-3.09 ms; alone all ten parts pass,
  the draw 1.04-2.31 ms), check-perf passing in run-all's alone slot; against `p4i-people`, surface generation ×1.05 (and
  refresh ×1.27 with B1's runs loading the machine: an open item); golden, screen frames and legacy fights unchanged; the
  real world's bot playthrough; browser-gate (seeds 1234, 7) and browser-2b pass (audio silenced, servers stopped).

**`p4i-people`** (2026-10-30): C5 #3 with C1b #18, who stands where, on `p3i-lightweapons`. Each real-world landmark's
people stand on its plan's letters as its span is made (`story/landmark-people.js`, through `world/sites.js`
`registerPlanPeople`, called by `gen/surface.js` once the zone validates, after its wildlife; no draw from any stream, uids
of their own, so nothing else generated moves: the reviewer compared 66 zones on 2 seeds against `3a8310d^`, blocks,
creatures, items and uids identical). 53 a seed, each a talker under its words (`dialogueIdOf`), standing where you would
in its column (the Tall Table's on the top). Kinds: the letter's own, a type of the same id (C3's, the parent's), else one
of 14 new plain person types by culture in `people.js` (Folio's `folioCitizen` flat, `ghostPerson` ghostly); Ess and Tee
the parent's Ess, Castor an assizer. Pell walks his round (Hollowmere days 1-2, Benchmark 3-4, Molar 5-6), one uid,
synced on entering and at midnight where you stand (not over the zone you left for the world map); Castor keeps Molar's
checkpoint once beat 1 is done; one killed stays dead. Named only where the name is its own ("the innkeeper" can't be
kindled with); `theOf`/`TheOf` take a name that brings its article as it is; a title that says who each is; a merchant
by its words sells (the general stock; the landmarks' own stocks are B3's). On the real world the Keeper's Stair keeps
none of the parent's residents (Mira, Corwin, Brann, Ess, Tee, Rook, Lio: bible §3 "the original people return as
residents") nor Brann's skull (C5 #4 puts it on floor 2), and its peddler is "a peddler" with the parent's pack; the
test world's stack is the parent's, golden 0 mismatched. Not here: Noon (a bottom, B2's: flat and ghostly on its type is
all the view rule needs), Lio and Tovi pressed (#12), Corner's petting (#14). `GEN_VERSION` stays 6 (buildRun is
unchanged); a save made before keeps its visited landmark zones as saved, without their people. check-landmarks section
6 on 5 seeds: 265 placed (15 on the top, 35 flat, 25 ghosts, 125 merchants, 195 titled, 135 without a name of their
own), 20 come and go; Pell's round day by day; Castor; a person through a save; 12 sellers with stock; the real Stair
without the 7 and the skull, 5 peddlers. Mutants: 28, each killed. Verification (an independent reviewer on `3a8310d`):
four findings, each fixed with its mutants (merchants with nothing to sell, 6af06a9; everyone named and kindleable,
142f3dd; titles that named goods or places, caedc72; Pell's round only on entering and three uids, 8e3b615); and run-all
found the midnight sync changing the zone you'd left for the world map (2577657). Checks: `run-all` 38 of 38 at
`3a8310d`, and 37 of 38 at the tag under load (check-overworld; alone all ten parts pass, the world-map draw 1.17-1.46 ms);
check-perf passes in run-all; the real world's bot playthrough; browser-gate (seeds 1234 and 7), browser-2b, browser-c3,
and a look at Hollowmere's start in the browser (its nine people there, Pell on day 1, Ottilie's words on walking into
her on the map); audio silenced, servers stopped.

**`p3i-lightweapons`** (2026-10-30): the user's light-weapon decision (rule B of
`docs/balance/light-weapons-2026-10-30.md`, chosen in the coordinating session's chat and relayed 2026-10-30), on
`p3i-balance`. Under d20 every blade counts STR over 10 (`RULES.d20.strOver`, which replaces `fistReq`), and that STR
term and the material scale by the blade's swing ÷ 0.7 (`swingRef`), rounded once; enchantment stays per blow; the
requirement only costs to-hit. The specs carry `swing` (the weapon's; `FISTS.swing` for bare hands); a made weapon's
info line shows the material as it adds a blow. The legacy set, missiles and thrown knives are untouched: golden 86/86,
legacy fights 0 differing, screen frames 34/34, check-items' gear hash. DECISIONS' combat row now states both balance
decisions (blade damage and creature scaling). check-combat: the test blade at 0.35 s and 1.4 s (+4 material → +2,
+8), the specs' swing, a noonsilver dagger's and maul's info lines (5-7, 13-18), fists below the dagger a blow and a
second; ttkTables' typical kit picks its weapon by the new rule. Mutants (7, each killed): STR over the requirement,
swingRef 0.5, strOver 8, no swing on the weapon's spec or the fists', the info line unscaled, the enchantment scaled.
**Through the game's own combat code** (resolveAttack; the check's 40 blows a side): 9.9 / 11.4 / 12.2 / 19.1 / 24.2 /
27.9 / 31.1 / 38.7% a kill at tiers 1-8, the bounds hold (tier 5 under 25% is its band's mix). The same at 400 blows, through resolveAttack (a scratch harness on the check's typicalBuilds): by a blow 9.8 / 11.4 / 12.1 / 18.9 / 23.9 / 27.3 / 30.4 / 37.8%, and with a dagger or stylus in the found weapon's material 7.9 / 9.1 / 10.3 / 16.9 / 22.3 / 25.9 / 28.3 / 33.8% (before the fix 11-17% at tiers 5-8); the agent's model said 9.7 / 11.4 / 11.6 / 18.6 / 23.8 / 27.1 / 30.2 / 37.7% and 7.8 / 9.1 / 9.7 / 16.7 / 22.1 / 25.7 / 28.2 / 33.8% (within 0.6). Seconds to kill 0.9-4.0 by a blow, 0.7-3.5 with a dagger; its kill of you 1.8× yours or slower for every build at tier 8 (it was 1.4×). Verification finding, fixed: check-items' C4 info lines still wanted the full material (372fb42). run-all 37 of 38 under load (the world-map draw, 3.03-3.86 ms; alone 1.67-2.64 ms), check-perf alone passes; the real world's bot playthrough, browser-gate (seeds 1234 and 7), browser-2b, browser-0d1, browser-ws8 and browser-c4 pass (audio silenced, servers stopped).

**`p3i-balance`** (2026-10-30): the user's balance decisions of 2026-10-30 (relayed by the coordinating session, and
"Approve the core" to the integrator), from `docs/balance/proposal-2026-10-30.md`, applied on `p3i-c5`. **Under d20
only** (the legacy set keeps the parent's +6% HP a level and +1 damage per 4, so golden holds): creatures +18% HP a
level and damage +3 then +2 every 3 levels (`RULES.d20.creatureHp`, `creatureDmg`, `creatureDmgEvery`; bosses and
guardians unscaled, mortal villagers keep +6%); the barrow troll HP 40→30 and the planar queen 40→28; enchantment adds
to AV only on C4's pieces with armour (a +3 monocle is AV 0; the parent's pieces keep armour + enchantment, which the
proposal's "all the parent's armour has armour" missed: clothes, the reed hat and the goggles have none, so the rule
is held to `GEAR_ARMOURS`); fists swing in 0.5 s (was 0.3). Checks changed with them (§3.6): check-creatures' level-9
rat (HP 10, +8) and hulking rat, check-sites' legend bonus (3 + floor((L − 1) / 1.5)), check-combat's goblin blow
(2-4 + 5) and its range, check-stats' AV formula (the same rule), and **ttkTables' bounds moved to the typical build**:
four fighter backgrounds × 20 seeds (chargen's suggested spread, the powers offered on the seed taken by a combat
preference through takePerk, a point every 4th level into STR and AGI; the best of what they found by each band,
randomGear's kit, the weapon by its damage a blow, each slot by its armour) against the real world's creatures, 40
blows a side a kind, the blows to kill from their spread (a renewal sum; the Executioner counted). Held to: tiers 1-4
within 1.5× the legacy set's cost + 3, tiers 5-8 at 25-38% ±3, its kill of you 1.5× slower, 0.5-12 s to kill, 3 kinds
a band; the plain fighter's columns (d20, real) are information now. Its numbers (cost a kill, your seconds to kill, its kill of you): 9.4% 0.88 s 11.2 s, 10.1% 1.18 s 13.3 s, 10.7% 1.44 s 14.9 s, 18.2% 2.2 s 13.5 s, 23.9% 2.85 s 13.2 s, 27.9% 3.31 s 13.6 s, 30.9% 3.52 s 12.9 s, 39.4% 4.15 s 11.6 s at tiers 1-8 (the parent: 8.7 / 8.5 / 9.7 / 16.3 / 24.9 / 30.0 / 34.8 / 24.5%); builds spread from 4-17% at tier 1 to 13-76% at tier 8. The same builds at 400
blows: 9.3 / 10.1 / 10.6 / 18.0 / 23.7 / 27.4 / 30.1 / 38.6%, the agent's exact model 9.3 / 10.0 / 10.2 / 17.8 / 23.5 /
27.2 / 30.0 / 38.5% (40 blows reads about half a point high). Pinned: the scaling's three numbers, the troll and the
queen, fists 0.5 s. Mutants (12, each killed): creatureHp 0.06 (check-creatures; ttk tier 5 at 14.7%), creatureDmg 1
(check-creatures, check-sites, check-combat's goblin), the legacy bonus under d20, the old AV rule (check-stats), fists
0.3, troll 40, queen 40, creatureDmgEvery 1 (ttk tier 8 at 58%). Golden 86/86, legacy fights 1,359 steps 0 differing,
screen frames 34/34. run-all 37 of 38 under load (the world-map draw, 3.59 and 3.68 ms; alone 1.2-1.85 ms), check-perf alone passes; check-combat 33 s alone (was 22), 106 s in run-all (check-edges 138 s stays the longest). The real world's bot playthrough (seed 9: 367 keys, the shrine prayer done, down Kettle Mesa) passes with the harder creatures; browser-gate (seeds 1234 and 7), browser-2b, browser-ws8, browser-c4 and browser-0d1 pass (audio silenced, servers stopped). Not taken: the XP trim and the askew angle fix (the user). Next: the light-weapon fix
(`light-weapons.md`, proposed to the user with its tables; nothing changed until they approve).

**`p3i-c5`** (2026-10-30): `p3-c5` (a9749c8) merged into `integration`, cleanly: the campaign's intro, wake line,
starter chain and 11 beats of *The Lengthening* as data, quest texts and pools, and the landmark people's words
(`content/people-words.js`). Requests applied, each with an assertion and a mutant: #1 the line after the intro (the
campaign's wake line off the test world), #2 the real world's Maren talks under "maren@real" (beat 1). Left, the
integrator's next story work: #3 placing the landmark people (what makes their words reachable: view rules, kinds for
those without one, and the parent's people, whom C1a left in the Keeper's Stair while Hollowmere's letters also name
them), #4-#14 (the starter chain as quests, beats' rewards, quest items, Who Lit the Hush?, the finale, village pools by
region, the other templates, barks, the dungeons' people, beats 9-10's matchers, Corner). Checks: `run-all` **38 of 38**
(194.5 s; the real-world playthrough on seed 9); check-overworld alone 1.67 ms; `check-perf --against p3i-c1b` PASS;
browser-2b, browser-gate, browser-0d1 PASS. **Phase 3's content sessions are all merged.**

**`p3i-c1b`** (2026-10-30): `p3-c1b` (8f19dbb) merged into `integration`, cleanly: the other 15 landmarks on their plans
(bible §5, §15.3), with their lines in three registers, people letters, dungeons' floors, gimmicks and bottoms as data,
the Gnomon's foot. Requests applied, each with an assertion and a mutant: C1b #1 Halfnight's Middle and East Wards on
their own plans (check-landmarks now checks them on the real run), #2 compileWorld keeps a landmark's lines, letters,
below, holy, holyFloors and spanPlans, #16 the real world's `WORLD.version` 3, #19 each landmark dungeon's own
inhabitants before the region's (100 floors checked); C3 #12 the new kinds in the biomes' surface spawns and #15 the
surface folk out of the regions' dungeon rows (the moths, the wanderer and the pilgrim onto the Flats' and Tessellate's
spawns; check-world's §15.2 key rule takes the rows or the biome's spawns). Left: C1b #3-#15, #17, #18, #20-#26 (holy
places, the landmarks' registers shown, bottoms, vault floors, murals, floors up, the gimmicks' code…) for the backlog.
Checks: `run-all` 37 of 38 (the world-map draw under load; alone 1.64 ms); `check-perf --against p3i-c3` alone PASS
(surface p95 38.62, max 60.82 ms: the landmarks' plans, budget 150); browser-c3, browser-ws1, browser-2b, browser-gate,
browser-0d1 PASS.

**`p3i-c3`** (2026-10-30, the user's go via the coordinating session): `p3-c3` (efbfe83) merged into `integration`, cleanly:
bible §12's 63 creatures (56 registered, 7 waiting on systems) with d20 numbers and three registers, encounter tables
and legends by region, the real world's TTK rows. Requests applied, each with an assertion and a mutant: #13
`GEN_VERSION` 6; #3 bands by region (`overworld/encounters.js bandOf` reads the rows: real-world bands were goblins and
rats); #4 legends by region (`world/sites.js makeLegend`); #1 levels above 20 (`contentMax` 23; `pickCreatureType` above
20 from C3's level pool; P0's two literal 20s in check-stats and check-currency read the rule); #2 the three registers
on the examine screen; #8 the hooks' lines by `TheOf`; #14 the README. Two follow-ups the gates found: check-content's
coverage reads the legacy stack's tables at 20 at most (the Keeper's Stair's floor 20 is listed at 21), and browser-c3's
map looks expect the Flat line. Left: #12 and #15 (C1's spawns and rows) at C1b's merge; #5 for C1b and C5; #6, #7, #9-#11
new systems, the backlog. Checks: `run-all` 37 of 38 (the world-map draw under load; alone 1.61 ms); `check-perf
--against p3i-c2 --rounds 3` alone PASS, ×0.83-1.14; browser-c3, browser-2b, browser-gate, browser-0d1 PASS.

**`p3i-c2`** (2026-10-29): `p3-c2` (bd7b772) merged into `integration` (merge commit after `p3i-c4`), cleanly: the 21
factions' relations and lines, the faiths, village cultures and architecture by region, the grammar's lists and
accounts, the currency's text, the liquids. Requests applied (`9fd2b07`, each with an assertion and a mutant): #1 (and
C1a #8) villages' peoples by region first; #2 a faction's own greeting; #4 the Lantern Moths Grey with your torch out;
#10 a relic's ability ids no longer walked as bonus keys; #14 `GEN_VERSION` 5 (and `VERSION.gen`). `browser-ws7` now
finds its villages (C2's name lists moved seed 1's draws). Left: #12 worn reputation and C4 #1 (the real world's loot
and stock) and #2, next; #3, #5-#9, #11, #13 new systems, the backlog. C2's history grammar is about 19% over §15.9's
word budget (its notes say so; for the user's read-through). Checks: `run-all` 37 of 38 under load (check-overworld's
world-map draw, 3.05 ms), PASS alone (1.64 ms); `check-save --browser`, browser-2b, browser-ws6, browser-ws7 PASS.

**`p3i-c4`** (2026-10-29): `p3-c4` (c2d59eb) merged into `integration` (`1732c81`), cleanly: bible §13's gear in
materials and classes for tiers 1-8 (`content/items/gear.js`, `forge.js`), tonics, the 20 missing mutations (waiting
ones listed with their hooks), implants, artifacts and relics, the backgrounds' kits, the powers' data; the parent's
352 pieces frozen (`PARENT_GEAR`). Requests applied (`8470cdc`, each with an assertion and a mutant): #3 Lightsick's veil;
#11 the wizard's kit lines by itemName; #16 the README rows; `browser-c4` on `?world=test`. Next: #1 (the real world's
loot and stock through `randomGear`/`randomTonic`) and #2 (worn reputation) after C2's merge; #4-#10, #12-#14 to the
backlog (new systems: materials' specials, weapon classes, armour specials, artifacts' and mutations' and powers' hooks,
tonics' rest, implants); #17 stays. Checks: `run-all` 37 of 38 under load, the one check-overworld's world-map draw
(3.19 ms with 11 checks running), PASS alone (1.62 ms); browser-ws4, browser-ws5, browser-c4 PASS.

**`p3i-wiring`** (2026-10-29): TECH_DESIGN §8.5's **last wiring merge**, on `p3i-c1a` (`5981d0a`, `0fcc58a`). New games
in the browser (the title's and `?quick=1`'s) start on GNOMON's real world at Hollowmere, whose temple holds the
Rotation Cube; `?world=test` opens the test world, which every browser tool that knows its layout now asks for; Node's
checks still build on the test world (golden, the legacy fights, the frames untouched). The `?world=real` preview and its
cube step are gone (C1a #7). `browser-2b` part 3 holds the default (Hollowmere, no cube until it is touched, Tab refused
until then, 882 spans drawn, a step); a mutant fails. The 2B playthrough runs on the real world too (check-bot: seed
35, from Hollowmere to Reedwick Steading's trade, Kindling and prayer, the Broken Arcade 3 levels down, save, Continue).
Checks: `run-all` **38 of 38** (178.9 s); 14 browser tools PASS on `?world=test` (browser-0d1 27 of 27 modes,
browser-0d2 184 modules and `test-world.html` passing, browser-gate, browser-silent, check-save --browser, browser-ws1,
-0c, -shell, -ws4 … -ws8) and browser-2b on the default.

**`p3i-c1a`** (2026-10-29): `p3-c1a` (3bdcc7e, with `p3i-sinkholes` in) merged into `integration` (`861b82d`), cleanly:
the real world's 34 regions, the terrains' final numbers, the biomes' counts, the moods, Hollowmere on its plan (the
parent's temple and the Keeper's Stair under it, the village east of the porch). Requests applied (`46fb55d`, each with
an assertion and a mutant): #1, #2 villages by quota (16 a seed, by region, the Teeth's on a walk-in span; the real
world's village chances 0; the test world's draws untouched); #3 a region's biome (the Glass Shore as the sea's shore);
#4 the region's world-map line, last in the span panel; #6 the real world's `WORLD.version` 2. Left: #5 (the sky:
backlog), #7 (the cube: the wiring merge), #8 (villages by region: C2's merge). Checks: `run-all` **38 of 38** (180.6 s);
alone, `check-perf --against p3i-sinkholes --rounds 3`: PASS (surface p95 41.91 ms, ×1.15, the real world's villages
in the sample; passTime p50 6.9 ms, ×1.29, budget 12: one to watch), check-overworld PASS twice; browser-2b,
browser-gate, browser-0d2 (184 modules; `test-world.html` 32 passed), browser-silent, browser-ws1 PASS.

**`p3i-sinkholes`** (2026-10-29): C1a's request 9 (`docs/sessions/2B.md` §9). C1a's real-world sites put a dungeon span in
check-perf's surface sample (p95 68.8 ms, budget 60: the surface made its dungeon's level 1 to place its sinkholes);
C1a held its tag, and the user chose the code fix over splitting the budget. `4ebca92`: the corridor heap in typed
arrays (identical output). `ed69dde`: the surface and level 1 share the span's sinkhole spots (`world/sites.js
sinkholeSpots`; level 1's `landings`, validated); check-sites holds 478 sinkholes over 240 spans to land right under
them; three mutants fail; level 1 1.14 attempts (1.07), p95 29.3 ms (22.3; budget 40). On C1a's tree merged with it,
`check-perf --against p3i-props` alone: PASS (surface p95 34.66, max 41.54). `run-all` 38 of 38 (172.5 s);
`browser-gate` (falls off by 0) and `browser-2b` PASS. `main` fast-forwarded; C1a told to merge the tag and rerun.

**`p3i-props`** (2026-10-29): props named in the map legend and on the inspect line (`de12966`; integrator, WS2b #7;
the user's answer 3 with the Phase 3 plan), on `p2-realworld`. A `props` describer in `renderMap.js` and the outdoor
legend's prop rows (seen, not on a wall tile, up to 4, after what the legend showed before); P0's `tests/checks/hud.js`
changed as approved, with an assertion; four mutants fail. `run-all` 37 of 38: check-overworld's timed world-map draw
3.06 ms under 11 parallel checks, PASS alone twice (1.59 and 1.52 ms p50, budget 3; its renderer untouched).
`browser-0d1 --against p2-realworld` (27 of 27 modes, golden (b) 27 of 27, per tick within +1.3%), `browser-2b`,
`browser-silent` PASS. `main` fast-forwarded. Notes: `docs/sessions/2B.md` §8.

**`p2-realworld`** (2026-10-29): `?world=real` on `p2-2b` (`3343302`; `docs/sessions/2B.md` §7). `config.js` exports
`WORLD` (its own export: P0's check-config holds `FLAGS` to four flags, untouched); `main.js` builds new runs on
`REAL_WORLD` and gives them the cube. check-overworld (7 URLs) and browser-2b part 3 (New game and `?quick=1` at
5,16,0 with the cube, Tab both ways, 882 of 882 spans drawn, a step); three mutants fail. `run-all` 38 of 38 (192.4
s); check-config, check-imports, check-names, browser-0d2, browser-silent pass. `main` fast-forwarded.

**`p2-2b`** (2026-10-28): 2B hardening on `p2-ws1` (TECH_DESIGN §8.5), with Phase 2's items that need no C1; notes in
`docs/sessions/2B.md`. Each change has an assertion that fails without it.
- The bot playthrough (`8dcf10f`, `bot.mjs` `runPlaythrough`, in `check-bot`): the wizard by keys → 3 zones in both
  views → 30 world steps to Saltcote Steading → a buy and the Kindling → its prayer quest → the Sour Burrow 3 levels
  down (the last in 3D) → Save and quit → Continue (the same state) → the stairs up; seed 18, test world, 423 keys,
  4 s. It found `bd88868`: after a village quest's reward every save failed (the reward and the offers one array, R5).
- Travel saves (`f6f6cf8`): the journey in the slot as `state.trip`, `"world"` saveable, restored on a new
  `"save:loaded"` event. Discovery XP never paid on a load (`7867f28`). `restClears` 60 (`c3003ae`; WS1's R10 test
  now on the folding strike). The torch on the road by the journey's span (`224f320`). The journal's Locations tab:
  O, Enter or a click show the marked place on the world map (`48094d9`). `tools/browser-2b.mjs` (`f62629d`).
- Checks: `run-all` at `f62629d` **38 of 38** (188.3 s). `check-perf --against p2-ws1 --rounds 3 --no-render` alone on
  the idle machine: **PASS**, every §6.7 item inside its budget, ×0.97-1.14 (outdoor frame p50 15.36 against 15.51;
  dungeon generation p95 31.86 against 27.87, budget 40; passTime p50 5.82 against 5.17, budget 12). Browser (0
  console errors, audio silenced), all PASS: `browser-2b`, `browser-0d1 --against p2-ws1` (27 of 27 modes, golden (b)
  27 of 27, per tick +0.4% to +1.6%), `browser-0d2 --all` (34 passed), `browser-gate` (1234, 7), `browser-silent`,
  `check-save --browser`, and on `tools/serve.mjs 8660` `browser-ws1`, `browser-0c`, `browser-shell`,
  `browser-ws4` … `browser-ws8`. `main` fast-forwarded to `p2-2b`.

**`p2-ws1`** (2026-10-28): `p1-ws1` (b042cc0) merged into `integration` (`e6f16e2`), the last Phase 1 tag. One
conflict, the imports of `tests/checks/world.js` (WS1 #12): WS7a's history import and WS1's `canStep`, both kept;
`siteRules` keeps WS10's approved `historicRule` and WS7a's approved history line, and WS1's `checkTravel` joined.
- Applied, each with an assertion that fails without it: WS1's four powers offered (`60d145e`, #3: Keen Eye,
  Pathfinder, Terrain lore, Homing sense; a pathcraft village's leader now teaches Pathfinder, 139 of 139 leaders teach);
  `site: 0.1` in the progression's reward table (`c2a4720`, #4: the same number); browser-0d1's tour reaches the world
  map and the wait menu (`7600c24`, #5); the pause card names O world map and Z to wait (`a99f9fb`, #8).
- Confirmed: #1 (a learned location's pin: check-overworld's discovery part passes on the merge); #11 (a legend met on
  the road leaves its lair empty: check-overworld's encounter bands pass). Carried to Phase 2: #2 (the journal's
  Locations key), #6 (the torch on the road), #7 (restClears, with WS1's R10 test); #9 to C1/C3; #10 information.
- Merge findings: check-save under WS1 (`abb2bd0`): a save made before WS1 loads with an atlas of the one span loaded
  into (section 10 compares without it and holds it to that span); WS1's world map isn't saveable, rightly (the trip
  isn't saved), so no save is made on it and the waiting travel save lands back on the map (section 12). browser-gate
  (`51274c2`): entering the ruin's span pays its discovery XP and raised a level, whose card took the gate's keys.
- The leveling pace with discovery in: on the real world every site's discovery pays about 8,600 XP (16 landmarks
  about 7,300, 8 historic sites about 1,300; seeds 1234 and 7): alone, level 1 to level 14. Kills: about 100 a level
  from level 3 on (the parent's 9 to 147). For the balance phase ("Phase 1's closing state").
- Checks: `run-all` at `abb2bd0` **38 of 38** (194.3 s; after it only browser tools changed). Timed alone against
  `p2-ws9`, `check-perf --rounds 3 --no-render`: **PASS**, ×0.92-1.17 (the outdoor frame p50 15.9 against 16.0, dungeon
  generation p95 33.4 against 29.6, budget 40; passTime p50 7.2 against 6.2, budget 12). `check-save --browser` **PASS**.
  Browser (0 console errors, audio silenced): `browser-0d1 --against p0-done` (27 of 27 modes, the HUD at 100×30,
  golden (b) 27 of 27, per tick underground +0.1% in 3D and +2.1% on the map, the surface −11.4% in 3D);
  `browser-0d2 --all` (boot with 181 modules, `test-world.html` 34 passed, 0 failed); `browser-gate` (1234, 7);
  `browser-silent`; and on `tools/serve.mjs 8660`, `browser-ws1`, `browser-0c` (1234, 7), `browser-shell` (55 mode
  changes at each size), `browser-ws4`, `browser-ws5`, `browser-ws6`, `browser-ws7`, `browser-ws8`.

**`p2-ws9`** (2026-10-27): `p1-ws9` (fd2aa33, from `p0-done`) merged into `integration` (`84639c4`). One conflict,
`tests/checks/screen-frames.js` `NOT_COMPARED`, joined (WS9 #12): 13 frames by exact name with their reasons (WS3's
victory card, WS5's 8 inventory frames, WS9's 4 "… 3d pause card" frames); the other 34 compared, 0 mismatched.
- Applied, each with an assertion that fails without it: the pause card names P factions too, and every key it names
  is bound (`069dc43`, WS6a #7, the user's decision); `startRun(seed, world, { mode, player })` (`3e0e1d8`, WS4 #4 with
  WS9 #2: the mode in the run's state before its first save; `nextRunPlayer` gone; the victory card's R keeps the
  mode too); the held weapon lit by the hour under the sky (`4789ab5`, WS3 #7: 0.82 at noon, 0.22 at midnight; the
  commit says 0.40, a guess, measured after); bare hands (`cd70e6c`, WS5 #4: FISTS swing 0.3 s, reach 1.3; the
  parent's boons and Pell's forge find no weapon); a neighbour read from the save gets its far apron bands a band a
  frame (`893fc1a`, WS2a #3: 3 of 3 sides in 6 frames); browser-shell learns log and options, browser-0d1's title tour
  goes through the wizard (`532bdb8`, WS9 #11: 25 of 25 modes); `player:hurt` and `log` events (`b1966b8`, #3 and #4:
  60 lines in one frame all kept); `RULES.oneWick` in rules.js (`a24d5c2`, #6); saveThrough on char, abilities,
  examine, factions and journal (`e2e0b66`, #9); README rows and the `?quick=1` memory store kept for the tools
  (`cb93db3`, #10, #1). Coordinator-approved P0 check changes: `VERSION.gen` follows `GEN_VERSION` (4), check-config
  holds them equal (`7b6b585`, `04422a2` for its run-all runner; WS10 #2: 4 is the baseline of the title's "older
  version" warning, no saves predate WS9's store); WS3's clock segment registered and check-hud's 180-column row
  holding it (`d6b273e`, WS3 #3: the parent's row underground as before, the clock required under the sky before fps;
  the three mutants fail).
- Confirmed, nothing to change: WS2a #1 (WS9's codec keeps every zone field as plain JSON, `zone.liquid` included;
  `2925502` holds it); Pilgrim's XP (WS9 #9, in leveling.js since WS4). Carried: #5 (Esc on the map, for the
  coordinator), #7 (information), #8 to WS1; WS4 #13 (the wizard's own copy of the run modes) left as it is.
- Merge findings: check-save hung (exit 13, `b9b319d`): WS9's title sections expected p0-done's "New quick game",
  and on integration the title opens WS4's wizard; they go through it now. WS8's write-behind follower test
  (`92d474a`): WS9 writes a zone you leave with the next slot record, so the test makes that save. A made Plumb never
  started with its free implant (`28c83e6`): makeCharacter asked for a Truing Cradle and took a part type for a body
  part; fitted free now, all six backgrounds. check-save --browser met the same wizard (`f2e4066`). Drowning's
  `t: Infinity` came back null from a save (`3006fc3`: 1e9 now). browser-ws8's arena pinned its creatures with
  Infinity, which WS9's automatic save refused (`01ab2d8`). check-save section 21 (`7a478ef`): a made Plumb and Bent
  with reputation, secrets, a village quest, a struck villager and a follower, through a save and a load: the same.
- Checks: `run-all` at `01ab2d8` **38 of 38** (190.4 s). Timed alone (24% load, no training job) against `p2-ws2b`, `check-perf --rounds 3 --no-render`:
  **PASS**, ×0.74-1.14 (the outdoor frame p50 16.3 against 15.9, dungeon generation p95 33.7 against 29.5, budget 40;
  the night frame's p95 64 ms, its p50 14.8). `check-save --browser` **PASS**. Browser (0 console errors, audio
  silenced): `browser-0d1 --against p0-done` (25 of 25 modes, the HUD at 100×30 with the clock, golden (b) 27 of 27,
  per tick underground +1.9% in 3D and +2.0% on the map, the surface −10.0% in 3D); `browser-0d2 --all` (boot with 179
  modules, `test-world.html` 34 passed, 0 failed); `browser-gate` (1234, 7); `browser-silent`; and on `tools/serve.mjs
  8660`, `browser-0c` (1234, 7), `browser-shell` (55 mode changes at each size), `browser-ws4`, `browser-ws5`,
  `browser-ws6`, `browser-ws7`, `browser-ws8`.

**`p2-ws2b`** (2026-10-27): `p1-ws2b` (2003f0a, above `p1-ws2a`) merged into `integration` (`cfb7272`), cleanly: since
`p1-ws2a` WS2b changed only its own files (`gen/biomes/*`, `gen/surface.js`, `gen/terrain.js`, `gen/apron.js`,
`content/biomes.js`, `content/creatures/wildlife.js`) and its checks (edges, landmarks, surface). `buildRun` is
unchanged (16 of 16 serialized runs of seeds 1-8 on both worlds equal to `p2-ws7b`'s), so `GEN_VERSION` stays 4; zones
are made differently (a saved zone keeps its blocks). Every wildlife species' factions are registered on `integration`
(36 species: 23 out for a fresh player, 13 neutral).
- Applied: #7 (`7314abe`): the dressing's props drawn, in 3D as sprites like an item's (0.14 of a tile a character of
  their art) and on the map as their glyphs, inside the "items" overlay (check-hud, P0's, freezes the overlay list),
  under items, creatures and you, never on a tile the map draws as wall. The render check's section 14: 6 of 6 seen
  props shown on the test world's start span, a shrub three tiles ahead changes 174 cells in 3D; without the drawing
  0 of 6 and 0 cells. Not done: naming props in the legend and inspect (a `props` describer, which
  `tests/checks/hud.js:199` freezes out: for the coordinator). In the browser on the Brine Flats (2,15,0: 17 props),
  the map shows reeds, glimseed, bones and salt blooms; in 3D the bones are hard to tell from the salt (their colour,
  C3's).
- Merge findings: the render check's Gnomon in its own span (`4232bcc`): WS3's case was written for a span with no
  voxel foot; WS2b's 14-block column (WS3 #10) puts the needle's start above the screen from 15 tiles off at pitch 0.
  The renderer is right (the needle's lowest row 14 / 27 / 40 against the foot top's 14.0 / 27.2 / 40.2 at pitch
  0.5 / 0.7 / 0.9); the case now looks up at the foot and asks the needle to rise from its top (with the needle from
  the ground: lowest row 55, 1668 cells beside the foot). check-social's "old game" (`7b81aeb`) took WS2b's wildlife
  for the parent's monsters (40 pairs failed): it takes the types without factions (19, as at `p2-ws7b`), and every
  type of `LEGACY_MONSTERS` must be among them.
- Information, nothing to apply: #8 (`browser-gate` shows 8 prefetch frames; real-world zones hold wildlife). Carried:
  #9 and #10 to C (C1's plans, C3's wildlife and the balance phase), #11 to WS1; 2a's #1 and #3 stay WS9's.
- Checks: `run-all` at `7b81aeb` **38 of 38** (188.9 s). Timed alone (14% load, no training job): `check-surface
  --budget` **PASS** (p50 16.2, p95 26.3, max 139.4 ms); `check-perf --against p2-ws7b --rounds 3 --no-render`
  **PASS**, ×0.94-1.09 (the outdoor frame p50 15.72 against 15.81, surface generation p95 37.3 against 35.9 and max
  125.8 against 123.6, dungeon generation p95 31.9 against 29.3, budget 40). Browser (0 console errors, audio
  silenced): `browser-0d1 --against p0-done` (23 of 23 modes, the HUD at 100×30, golden (b) 27 of 27, per tick
  underground +0.4% in 3D and +0.1% on the map, the surface −11.3% in 3D); `browser-0d2 --all` (boot with 179
  modules, `test-world.html` 34 passed, 0 failed); `browser-gate` (1234, 7: 8 prefetch frames); `browser-silent`;
  and on `tools/serve.mjs 8660`, `browser-0c` (1234, 7), `browser-shell`, `browser-ws4`, `browser-ws5`,
  `browser-ws6`, `browser-ws7`, `browser-ws8`.

**`p2-ws7b`** (2026-10-27): `p1-ws7b` (d7a0038) merged into `integration` (`574ac45`), cleanly: `story/index.js`
registers `SITE_BUILDERS.village` and WS10's `world/sites.js` every other kind. No P0 check, fixture or frame changed in
7b. Villages exist only on the test world until C1 gives the real world regions with a village chance.
- Applied, each with an assertion that fails without it: WS6a #1 / WS7b #10, mortal villagers (`d7d23d0`: a talker
  whose type has `hp` gets a monster's health and blow fields; a bump talks, Shift strikes, a bump strikes once it's out
  for you; `factions.js` reads `maxHp`, as `hp` charged a killing blow's −10 twice; a legacy person stays untouchable);
  #9 (`f1d6231`: the run's factions step registers `villageFaction(v)`, 73 villages under bent and 79 under peoples on
  20 seeds; `GEN_VERSION` 4, as WS7b's villages, their secrets and factions change the test world's run for a seed;
  `restoreRun` refuses no older version and `villageOf` regenerates an older save's fixture villages, so no save is
  lost); #11 (`23a173d`: `startRun` opens `introPages(game.run)`, the same `INTRO` object on the test world); #12
  (`888d07f`: `items.js` emits `pickup { e, item }` for what goes into the pack; the fetch quests move on it before the
  tick).
- Confirmed, nothing to apply: #14's XP (quest, beat and village XP go through WS4's `xpReward`, whose table has all
  three keys); #18 (check-determinism's scan has covered `story/` since 0A1). Not applied: #14's `needs` (no effect reads
  Hour script, Gossip or Triangulator yet; to the integrator's backlog). Carried: #13 to WS1, #16 to C.
- #17 in the browser (`tools/browser-ws7.mjs`, `7622fed`): seed 1, a prayer at Reedwick's carved shrine and one at
  Reedwick Cross's rune shrine by L in 3D with real keys: the rune refused at 10:00 with the torch out and at 21:00 with
  it lit, made at 21:00 after F; the relief refused that night with the torch out, made at 10:00 the next day. A Node
  probe of every relief and rune pray quest of seeds 1-120 through `look()` agrees (20 of 20, 22 of 22).
- Merge findings: a prayer made said nothing (`92e528b`: a shrine is a block, not a mural, so only the look's "Carved
  stone." showed; finding or charting a place was as silent): a village quest at "return" now logs "<title>: go back
  to <giver>."; a village leader taught a power still waiting on its `needs` (`b323864`: an artificing village's
  Repair, a pathcraft village's Pathfinder, offered on the flame-kin menu): `teachesFor` takes the tree's first power
  without `needs`, and the menu skips any (130 of 139 leaders teach one on 20 seeds; pathcraft's none until WS1);
  check-story ran only in Node (`84b8a09`: WS7b's "the same zone twice" used Node's `Buffer`, so `browser-0d2 --all`
  failed it in test-world.html: 33 passed, 1 failed); the blocks are compared element by element.
- Checks: `run-all` at `84b8a09` **38 of 38** (186.6 s; check-story alone 12.9 s). Timed alone on a quiet machine (8% load, no training job) against `p2-ws7a`, `check-perf --rounds 3
  --no-render`: **PASS**, ×0.96-1.14 (the outdoor frame p50 16.17 against 16.23, surface generation p95 36.5 against
  34.8 and max 139.9 against 123.2, budget 150; passTime p50 6.7 against 6.0, budget 12; `buildRun` 13.8 against 13.8).
  Browser (0 console errors, audio silenced): `browser-0d1 --against p0-done` (23 of 23 modes, the HUD at 100×30,
  golden (b) 27 of 27, per tick underground −0.1% in 3D and −0.4% on the map); `browser-0d2 --all` (boot with 162
  modules, `test-world.html` 34 passed, 0 failed); `browser-gate` (1234, 7); `browser-silent`; and on
  `tools/serve.mjs 8660`, `browser-0c` (1234, 7), `browser-shell` (1280×720, 600×300), `browser-ws6`, `browser-ws7`,
  `browser-ws8`.

**`p2-ws7a`** (2026-10-27): `p1-ws7a` (b503957) merged into `integration` (`c4b725d`). One conflict,
`tests/checks/world.js` `siteRules`, joining two coordinator-approved changes: WS7a's history line (the test world
exactly the fixture by counts and JSON-equal to `fixtureHistory()`, any other world `validateHistory`) and WS10's
historic rules (`historicRule`, every site request placed once). Confirmed: WS7a's other P0 check change,
`tests/checks/hud.js:199`, is the describer list P0's five plus exactly `murals`.
- Merge finding (`ef0e41e`): the Kindling read the journal raw, but WS7's entries are `{ learned, source, sold }`, so in
  play every "give a reading" row showed the secret's id and a deep faction took a dark reading; it now uses
  `readings(game)` and `markSold`, and check-social learns the run's real secrets instead of made-up entries.
- Applied, each with an assertion that fails without it: #2 (`0d3b61b`: `run.secrets = makeSecrets(run)`, a save
  carries them; `GEN_VERSION` 3); #4 (`eaf64d9`, in WS10's files: an Hour-site floor's murals show all three accounts,
  the Dark Gloss a rune read in the dark: 54 of 54 floors with murals); #5 (`4848078`: the triangulation's XP is WS4's
  `xpReward`); #8 (`f8f2110`: `check-story` timed alone in `run-all`); README rows for check-story and check-surface
  (`b793525`). Carried: #3 to WS1; #7 (the cult pass) and the cults to WS7b or C; the four lore powers keep their
  `needs` (nothing reads them yet).
- Checks: `run-all` at `b793525` **38 of 38** (203 s; check-story alone 8.8 s). Timed alone against `p2-ws2a`,
  `check-perf --rounds 3 --no-render`: a first run read the night frame ×1.16 and surface generation's max ×1.15 (code
  WS7a doesn't touch; the outdoor frame ×0.95 in the same run); the rerun **PASS** (night ×1.01, surface generation
  p95 ×0.89 and max 147.6 against 202.8, dungeon generation ×1.00, passTime ×0.82); `buildRun` p50 14.7-22.0 ms against
  2.1-2.2 (the generated history and secrets; budget 200) and `restoreRun` 3.2 against 0.3 (budget 50). Browser
  (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-0d1 --against p0-done` 23 of 23 modes (the journal
  by J and clicks), the HUD at 100×30, golden (b) 27 of 27, per tick underground +1.4% (3D) and +1.1% (map), surface 3D
  −10.8%; `browser-gate` (1234, 7); `browser-0c` (1234, 7); `browser-0d2 --all` (boot with 159 modules,
  `test-world.html` 34 passed, 0 failed); `browser-silent`; `browser-ws6` (the Kindling).

**`p2-ws2a`** (2026-10-27): `p1-ws2a` (386bd98) merged into `integration` (`031ea42`), no conflicts (`blocks.js` merged
on its own: WS2a's map looks beside the Truing Cradle's); WS2a changed only its own checks (`tests/checks/edges.js`,
`surface.js`). It brought WS3 #5 (TRUNK and LEAVES `♠`, SHALE, CRYSTAL, GLASS `.` in their colours, REED `¦`) and WS3
#6's staged far bands (3D prefetch builds a zone's world-function bands ahead).
- Applied, with an assertion that fails without it: #2 (`9c4f791`: `compileWorld` gives a river's `liquid` to every span
  of its path as `tile.riverLiquid`; check-surface's real world with its first river inked: 21 of 21 spans, 20 of 20
  edges with ink ports; without it "0 of 21"). Carried: #1 (the codec's `zone.liquid`) and #3 (a neighbour read from
  the save steps its bands) to WS9's merge; WS3 #10 to WS2b; #4-#6 information (above, "WS2a").
- Checks: `run-all` at `9c4f791` **38 of 38** (165 s). Timed alone against `p2-flip`, the CPU at 100% with other
  sessions: `check-perf --rounds 3 --no-render` **PASS** (surface generation p95 39.2 ms against 206.9 in that run, max
  172 against 422, both over 150 as the machine's; dungeon generation p95 39.1; passTime 10.5, ×1.01; mapStep ×0.99;
  the swap 26.6 against 40.1); the per-span surface A/B (the same 40 spans, three alternating rounds): p50 20.1 / 24.8 /
  22.5 ms against 24.1 / 22.6 / 21.8, p95 55-62 against 51-63, the slowest spans the same two landmarks. Browser
  (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-0d1 --against p0-done` 23 of 23 modes, the HUD at
  100×30, golden (b) 27 of 27, per tick underground +0.4% (3D) and +0.9% (map), surface 3D −11.2%, surface map +1.2%;
  `browser-gate` (1234, 7: the swap frame 34.3 / 27.6 ms on SwiftShader against a 16.5 median, prefetched in 7 staged
  frames of 13-23 ms, black 0.005 → 0.007); `browser-0c` (1234, 7); `browser-0d2 --all` (boot with 158 modules,
  `test-world.html` 34 passed, 0 failed); `browser-silent`.

**`p2-flip`** (2026-10-27): the formula flip (TECH_DESIGN §8.5; WS8 #9, WS4 #13), on its own tag after `p2-ws10`, at the
user's call (above): `RULES.stats = "attributes"` and `RULES.combat = "d20"` by default (`0e79899`, `rules.js`). Nothing
is re-recorded: what replays the parent's fixtures sets the legacy sets itself. Golden: `checkGolden` replays under
them (golden (a) retires as the default game's check and holds the legacy sets; frames, dungeons, vaults and temple as
before), and so do `browser-0d1`'s frames and `check-stats`' replays, which go through it. The legacy fights:
`playLegacyFights` with `overrideRules("combat", "legacy")` and the stats. The recorded screen frames: `screenFrames`
takes the tree's `rules`. Also on the legacy sets: `check-currency` (Pell's prices; the attribute set's are
check-social's), check-items' `p0-done` consumables trace, check-status's legacy salamander bite, check-shell's parent
level-up card (the attribute set's is WS4's), check-combat's P0 d20 rows (STR 10 on the legacy stat set),
check-progression's section 6. check-stats and check-progression now hold the new defaults. `tools/bot.mjs` confirms a
target screen (the map's T under d20, an aimed ability) with Enter, else Esc: check-save's session had left the game
on the target screen and `saveGame` waited for ever (exit 13, no output).
- Checks: `run-all` at `0e79899` **38 of 38** (244 s, the CPU at 100% with two other sessions working; the timed ones
  passed in the run). Golden mechanics 86 and frames 27, 0 mismatched; legacy fights 1,359 / 1,027 steps, 0 differing;
  screen frames 38 of 47 compared, 0 mismatched; the bot (both views) and check-save's session on the d20 default.
  Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-0d1 --against p0-done` 23 of 23 modes, the
  HUD at 100×30, golden (b) 27 of 27 in the browser, per tick underground +1.4% (3D) and +1.2% (map); `browser-gate`
  (1234, 7); `browser-0c` (1234, 7: both sets in both views); `browser-0d2 --all` (boot with 155 modules,
  `test-world.html` 34 passed, 0 failed); `browser-silent`; `browser-ws8` (1234, 7); `browser-ws6`; `browser-ws5`;
  `browser-ws4` (both sizes). A probe of the default game in the browser: `RULES` attributes and d20, the quick start
  STR 16, max HP 20, T on the map opens the target screen and Esc goes back, no console error.

**`p2-ws10`** (2026-10-27): `p1-ws10` (1bbd302) merged into `integration` (`2b343b7`), no conflicts. Its one P0 check
change, confirmed (coordinator-approved, `// WS10`): `tests/checks/world.js` `siteRules` skips the region-chance line
for `kind === "historic"` only (`historicRule`): such a site matches exactly one `history.siteRequests` entry and sits
on the requested tier or the nearest a usable span has, and every request is placed exactly once; every other kind is
checked as before. `run-all` has 38 checks now (`check-sites`).
- Merge finding (`ae6aadd`): check-sites' following legend moved the follower into the next zone by hand, "as WS8's
  zone:leave takes a follower along", and with WS8 merged zone:leave does it too: two copies ("claimed by 33,10,2, 2 in
  memory"). It now relies on WS8's followers: one copy upstairs, at the surface and back; back in its lair with you it
  is the follower; left upstairs, the lair makes none.
- Applied, each with an assertion that fails without it: #2 (`525c581`: `run.legends = placeLegends(run)`,
  `GEN_VERSION` 2); #3 (`dd51613`: `BOTTOM_LOOT.bodyMod = randomBodyMod`, a legend's bottom holds its artifact, cell or
  implant; `BEAT_SIGHT.has` reads the metronome heart); #4 (`70b7d49`: a history relic's name, the relic colour, 400
  glim, its powers through `itemBonuses`); #11 (`24aa9f2`: the determinism scan covers `content/dungeons.js` and
  `content/creatures/legends.js`); #12 (`1c88d8b`: `creatures.js theOf`/`TheOf`, a named creature takes no article in
  any log line; a risen creature other than the Flat Queen is "it"); the README row (`bb5b28e`). Decided: #10
  (`b5948f6`): a spike kill keeps the parent's experience and ring effects while its harm stays nobody's (no grudge, no
  rep), as for status kills: `applyDamage`'s `byPlayer` apart from `src`; #9 left as it is (to C1). Carried: #5 to WS7;
  #6 to the integrator's backlog; #7 to WS1; #8 to C1/C3; `config.js VERSION.gen` to WS9. Carried to WS10 and found
  built: WS8 #3 (spikes through a flat you), WS5 #9 (the beat seam, now wired), WS5 #12 (Cradles: the legend letter
  `cradle`, station sites; the Square's free fittings go to C1), WS6a #2 (spikes pass no source).
- Checks: `run-all` at `bb5b28e` 36 of 38 (239 s; the CPU at 100% with WS2a's and WS7a's sessions working), the two
  failures timed only. Alone against `p2-ws6b`, alternating: `check-dungeons` p95 33.2 / 30.7 / 37.3 ms (the legacy
  1,000) against 26.0 / 26.9 / 26.3 (WS10's check runs more parameter cases first, which WS10 measured as ×1.14-1.25
  inside the check; all within 40); `check-perf --against p2-ws6b --rounds 3 --no-render`: a first run failed surface
  generation's max (171 against 128 ms, one sample); a per-span A/B of the same 40 spans (median of 3, warmed, three
  alternating rounds) read p95 37.8 / 40.2 / 35.1 ms against 36.6 / 43.4 / 50.0, the slowest spans the same two
  landmarks at 44-47 ms in both; the rerun **PASS**, every item within budget (surface generation p95 34.0, ×1.07, max
  132.5, ×0.91; dungeon generation p95 32.5, ×1.00; passTime 6.4, ×0.90; mapStep 1.8; `buildRun` 1.9 ms, its 200 ms
  budget far off). Browser (`tools/serve.mjs 8660`, `?silent=1`, 0 console errors): `browser-0d1 --against p0-done` 23
  of 23 modes, the HUD at 100×30, golden (b) 27 of 27, per tick underground +1.1% (3D) and −0.3% (map); `browser-gate`
  (1234, 7); `browser-0c` (1234, 7); `browser-0d2 --all` (boot with 155 modules, `test-world.html` 34 passed, 0 failed,
  dungeons with WS10's sites, legends and traps among them); `browser-silent`; `browser-ws8` (1234, 7); `browser-ws6`;
  `browser-ws5`; `browser-ws4` (both sizes).

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

- **Left of the story work at `p4i-beats`** (2026-10-30), for whoever owns each:
  - **Beat 5's Shame reading** (`"shame:saffre"`, the silence option's "You keep a Shame reading."): no secret of that kind
    exists (`story/secrets.js` defines none), so the option pays its rep and glim and the reading silently doesn't come.
    Between owners (C2's readings, B3's peoples, or the integrator's story): for the coordinator.
  - **Beat 2's Seventh-Chimers ambush**: recorded (`campaign.ambushes`), but no encounter band of them exists, and they
    must waylay you even when the Horary like you (bible §7: they serve Vesper). An encounter band and a faction or rule:
    between owners (C3's creatures and WS1's tables, or the integrator): for the coordinator.
  - **Beat 10's giver**, the Hierarch, stands only in the Square's `below` (two floors up, C1b #8, B2's): her choice and
    offer wait for C5 #12, the integrator's, once B2's floors up are merged.
  - **Beat 1's seal**: the reward gives it on reaching Kettle Mesa's floor 3; when B2 lays the seal in the floor's sapper
    tunnel (C1b #24), picking that one up must not make a second: settled at B2's merge.
  - **check-perf's refresh** read ×1.27 against `p4i-people` (p50 10.13 ms, budget 10) while B1's TTK runs loaded the
    machine; nothing since touches refresh; it passed in run-all's alone slot at the tag. Recheck on a quiet machine.
- **The power pool: "Retune tier 8"** (the user, 2026-10-30, relayed by the coordinating session). B1 traced tier 8's rise to
  offer dilution (a build's two trees spent, the offers fill from every tree: a real cost, the base already 41.5% on
  average over six sets of builds). B1 proposes a d20-only retune of the level-23 creatures, measured over all six sets
  with B3's six powers offered too; the user approves the number, then B1 tags `p4b-b1`. **After B1's merge with the
  approved retune, the integrator drops the `needs: BUILT_B3` on B3's six powers** (Hour script, Gossip, Triangulator,
  Oil fire, Brew, Chime; `content/powers.js`, as `docs/b3.md` request 10 asks, check-social 18 turned round); not before,
  or check-combat goes red. B1 also notes `passTime` at ×1.25 against `p3i-lightweapons` (7.6 ms, budget 12): one to watch.
- **More powers offered, and check-combat's typical build** (superseded by the decision above) (the coordinating session, relaying the user, 2026-10-30): every
  power that goes live widens the 3 offers a level, so ttkTables' typical build gets fewer of the stat powers it prefers and
  its tier-8 cost a kill rises (B1's 8 class powers live: 43.4%; B3's 6 alone: 44.6%; the bound is 22-41%). **The user:
  "Measure, then decide."** B1 counts the live powers' worth in the TTK model and measures with and without B3's six; any
  rule change (4 offers a level, say) goes to the user first; no bound is widened and the draw isn't frozen. Meanwhile B3
  builds its six powers with their `needs` kept, so they aren't offered; `docs/b3.md` asks the integrator to drop those
  `needs` once the user has decided. For the merges of `p4b-b1` and `p4b-b3`: check-combat's bound must hold at each.
- **Balance phase: the user's decisions** (2026-10-30, given to the coordinating session in chat, the user's choices
  verbatim from its options): **1. Fight cost: "Like the parent."** Creature scaling and gear are tuned so a typical
  build (powers as offered, normal gear, C4's included) loses about 25-38% of its health per same-level kill at tiers
  5-8, as in the parent game. **2. XP sources: "Mostly exploring."** Kills stay slow (~100 a level); levels come from
  discovery, quests and villages; fighting is for loot and survival. **3. Process: "Propose, I approve."** The
  integrator reruns WS8's TTK tables with C4's gear and proposes concrete numbers to hit those targets (creature level
  scaling, tier gear enchantment, XP, bare hands, the wildlife's d20 numbers), and **shows the user the tables before
  changing any number**. When: the integrator fits it around C1b, C3 and C5. **The proposal is written** (`docs/balance/proposal-2026-10-30.md`, 2026-10-30): creature scaling under d20 +18% HP a level and damage +3 then +2 per 3 levels, two species fixes, an enchantment fix for armour-less pieces, slower fists, XP unchanged (an optional trim); a typical build then pays 9-18% at tiers 1-4 and 23.5-38.5% at tiers 5-8. **Decided by the user** (2026-10-30, in the coordinating session's chat, their choices from its options): **1. the core scaling "Approve as proposed"** (§3.1, edits 1-4: under d20 only, +18% HP a level, damage +3 then +2 every 3 levels); **2. three small fixes approved** (barrow troll HP 40→30 and planar queen 40→28, §3.2 6-7; enchantment adds to AV only on pieces with armour, §3.3 9; fists 0.5 s, §3.4 11), with §3.6's check changes (ttkTables' bounds on the typical build; no fixture re-recorded); **3. not approved:** the XP trim (§3.5 12) and the askew angle fix (8): XP stays; **4. light weapons "Fix it":** scale the STR term and the material by swing time so damage per second evens out across weapon weights, **the exact numbers proposed first, with tables, for the user's approval**. **Applied** (1-3) at `p3i-balance` (the integration log). **Light weapons proposed** (`docs/balance/light-weapons-2026-10-30.md`, to the user 2026-10-30): the user's rule alone (×swing ÷ 0.5) leaves a dagger 1.4× faster to kill, so the agent adds one bar of 10 for STR on every blade (as fists have); damage per second across the 13 classes evens from ×2.7 to ×1.2-1.3, the typical build's tiers 5-8 stay at 23.8 / 27.1 / 30.2 / 37.7%, a dagger fighter pays 22-34% there instead of 11-17%; low-STR and AGI builds lose most. When approved, ttkTables' typical kit must pick its weapon by the new rule. **Decided by the user** (2026-10-30, in the coordinating session's chat, relayed): **rule B**. **Applied** at `p3i-lightweapons` (the integration log; DECISIONS' combat row states both decisions).
- **Balance phase** (the user, 2026-10-27: "settle the tuning (creature scaling, kill XP) in the balance phase once
  C4's gear and WS1/WS7's XP are in"): with C4's gear and WS1's discovery XP in (WS7's quest, beat and village XP are in since `p2-ws7b`: `xpReward` 0.6,
  0.75 and 0.2 of a level), rerun
  WS8's TTK tables (`node tools/check-combat.mjs --only ttk`, the balance reference since the flip) and settle the
  creatures' level scaling (`spawnCreature`: +6% HP a level, +1 damage per 4), the tier gear's enchantment, and the
  kill-XP pace (the bible's `killXp`: about 1% of a level for a same-level kill, so ~100 kills a level at every level,
  against the parent's ~3 / 9 / 20 / 41 / 91 / 147 at levels 1 / 3 / 5 / 8 / 14 / 20). The tables at `p2-ws4b` (each
  cell your seconds to kill a creature of that level, and the share of your health one kill costs): without powers d20
  is much harsher than the parent's from tier 4 (a troll 71-83% of your health at tiers 5-8), with a fighter's powers
  much kinder from tier 3. "A combat power each level" is a best case (every level offering the one wanted);
  "powers + a Bent's mutations" adds Spare Heart, Thistlehide and Regeneration at level / 2.

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

- **WS3 (merged; what's left):** the edge-swap frame's step (the far bands come from the staged prefetch since
  `p2-ws2a`; a neighbour read from the save still builds them in the swap: WS9, above); the underground legend says "gold" while golden (b) holds (WS3 #9: change `renderMap.js`'s `$` row
  when it retires; the outdoor legend says glim). The outdoor frame, the horizon band and the clock's looks are done
  (`docs/sessions/ws3.md` §2: 16.1 ms at noon against `p0-done`'s 22.6 on a quiet machine).
- **WS8 (merged; what's left):** `passTime` costs ×1.2-1.7 `p0-done`'s in WS8's alternating measure (p50 4-5 ms
  against a 12 ms budget); spikes hurt a flat you (WS10, carried). (Monsters out for you are out for your followers
  since WS6a; L opens WS5's examine.)
- **WS6a (merged; what's left):** villagers are mortal since `p2-ws7b` (a bump talks; Shift strikes, and so does a
  bump once it's out for you; the parent's people stay untouchable); a witness sees no farther than its own sight (WS8's `sees`: people 10, a goblin
  11, ×0.55 with you in the dark), inside the 12-tile witness range; each village is its own faction, under the Bent villages or
  its people's, since `p2-ws7b`; grudges never expire; spikes still count as your harm (WS10, carried).
- **WS10 (merged; what's left):** six of bible §12.13's legendary templates need systems that aren't in (WS10 #8,
  content); history's sites are placed after P0's kinds (deviation 2); a spike kill's harm is nobody's, its experience
  yours (the integrator's call); the legends' opinions (the integrator's backlog).
- **WS7 (merged; what's left):** villages exist only on the test world: the real world has no regions, so no village
  sites, until C1 (check-story's 20 seeds are the test world's 152 villages); the game still builds its runs on the
  test world (`game.js` `world: TEST_WORLD`), so the campaign's pages and beats show only on a real-world run; the
  village builder assumes P0's 24 × 16 village footprint; the journal has no Villages tab; `dialogue.js
  drawJournal`/`journalKey` stay only for check-story's comparison with the parent's journal. Mortal villagers
  neither fight back nor flee, and a creature of a faction that hates a village's may now go for its people
  (`factions.js` no longer counts them unstrikable). A rune shrine reads at night two tiles from a lit commons lamp,
  as `light.js inDark` reads only the sky (P0's rule). The content above (C).
- **WS2 (merged; what's left):** the map can't show height: ground 4 or more up is a wall glyph, so cliff tops, ramps'
  tops, caches and plateaus are 3D's alone (by design; `tile.elev` is unread); every river is plain water until C1
  gives the Inkrun `liquid: "ink"` (compileWorld passes it on since `p2-ws2a`); when spans change terrain in a run
  (the Lengthening, WS1 or C) call `gen/surface.js forgetWorld(run.world)` first. Props are drawn since `p2-ws2b`
  (3D and the map), unnamed (above). The real world's surface zones hold wildlife (23 of 36 species hostile to a fresh
  player), the test world's none. Surface generation's max in check-perf is one sample (130-290 ms at `p0-done`
  itself on this machine); lamps cost about 1 ms each at every refresh.
- **WS6b (merged; what's left):** credit isn't built (a sale a full flask can't hold is refused); prices move with EGO and
  rep only under the attribute set (the flip); the legacy Pell keeps his own shop and his one pack; the Snuffer's
  torch −1 (the integrator's backlog); the content above.
- **WS5 (merged; what's left):** the backlog above (#8, #9); the item glyphs in the map legend (#16: `♦` implant,
  `Θ` artifact, `≡` cell, `¶` true-mark) wait with the underground legend for golden (b)'s retirement; two old lines
  kept as golden and the frames record them (#23: "You put on the The Mantle of Angles.", "throwing knifes"); a stray
  file outside the repository, `C:OTTOMR~1placeholder-never-written.txt` (1 byte), to delete by hand (the user).
- **WS9 (merged; what's left):** Esc on the map stays the parent's "to 3D" (**decided** by the user, 2026-10-29, "for
  now"; TECH §4.2 says it opens the options; P0's `tests/checks/shell.js:366` holds Esc → 3D, so changing it needs that check changed; WS9
  #5): the options and save-and-quit are reached from the map by Tab and Esc twice, or the title. A `?quick=1` game's
  saves stay in memory (the browser tools; the title moves it into IndexedDB), `main.js` and `tools/README.md` say
  so (#1). The wizard keeps its own copy of the run modes' names (WS4 #13, harmless). `VERSION.gen` is 4, the baseline
  the title's "made by an older version" warning starts from (no saves predate WS9's store), held equal to
  `GEN_VERSION` by check-config. `check-save --browser` isn't in `run-all`: run it at every merge that touches saves
  or the shell.
- **WS4 (merged; what's left):** the flip is in (`p2-flip`); its tuning is the balance phase's (above). 20 of the bible's 40 mutations (deviation 17);
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
