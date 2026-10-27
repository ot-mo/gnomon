# WS6: factions, reputation, dialogue (6a) · trade, the Kindling, backings, voices, shrines (6b)

Phase 1 workstream (TECH_DESIGN §8.3 "WS6a", "WS6b"; DECISIONS: genotypes `bent` / `plumb`, the bonding rite is
**the Kindling**, combat d20, glim with no liquid backing). Worktree `C:\Users\Otto Mörner\Code\gnomon-wt\ws6`, branch
`ws/ws6`, from `p0-done`. WS6a's files (§8.4): `factions.js`, `talk.js`, `social/index.js`, `social/reputation.js`,
`social/builders.js`, `screens/factions.js`, `content/factions.js`, `tools/check-social.mjs`, `tests/checks/social.js`.
Gate numbers, deviations and the verification: `docs/sessions/ws6.md` "Part 6a".

Nothing WS6a adds touches the old game: no legacy creature has a faction, so every legacy monster is still out for
you and for nobody else, every legacy person is neutral, and the rep handlers return before doing anything for a
creature without a membership (golden, the screen frames, the legacy fights and the bot hold).

## Public API (6a)

### `factions.js`

```js
registerFaction(id, def)   // FactionDef: { id, name, temperament, startRep: n | { bent, plumb }, parent?, likes: [[id, why]],
                           //   hates: [[id, why]], relations?, pilgrimFloor = true, hidden?, group?, color, glyph, liquid,
                           //   rite, voice, about, likesToo?, hatesToo?, flat?, homeRegions }; relations filled from likes
                           //   (+1) and hates (−1) where the def doesn't give them
FACTIONS                   // the registry (content/factions.js fills it: 22 factions and 9 hidden groups)
REP_BANDS                  // ["hated", "disliked", "indifferent", "liked", "loved"] (ids)
BAND_NAMES                 // { hated: "Dark", disliked: "Cold", indifferent: "Grey", liked: "Warm", loved: "Bright" } (UI)
REP_MIN, REP_MAX           // −1000, +1000
band(rep), bandName(rep)
baseRep(game, id)          // the start for game.player.genotype (no genotype: Bent), 0 or above in a Pilgrim run
                           //   (game.state.mode === "pilgrim") unless pilgrimFloor: false (the Askew; WS7's Hour cults)
repOf(game, id)            // game.state.rep[id] ?? baseRep: state.rep holds only what has moved
addRep(game, id, n, reason) → rep   // clamped; emits "rep" { faction, n, from, rep, reason } when it moved
membershipsOf(c) → [[id, w]]        // c.faction ({ id: weight }) else the type's `factions` (a list or { id: w })
relation(f, g) → −1 | 0 | 1         // f's relation to g, else to g's nearest parent group it names, else f's parent's
followsPlayer(c), bandToward(game, c)
attitude(game, a, b) → "hostile" | "wary" | "neutral" | "friendly" | "unaware"
```

`attitude`, in order: a === b friendly · (more than 6 leaders deep, a cycle only a bug makes: neutral) · you:
friendly to your followers, hostile to whatever is hostile to you, else neutral · a follower: friendly to its leader
and its leader's other followers · **house rule** (neither is you; followers too): flat against deep → unaware; a
ghost against a non-ghost → unaware unless both see in the dark (`darkSight` on the creature or its type; ghosts do)
· a follower: hostile on its own grudge, else its leader's attitude (yours: hostile to what is hostile to you) ·
grudge (`brain.grudges[id]`, yours is `"player"`) → hostile · **WS8 #2**: hostile to you →
hostile to your followers · toward you: no membership → the parent's rule (people neutral, monsters hostile); else
§2.11's table on the band (a hated membership of weight ≥ 0.25 wins, else the weighted mean) × temperament
(`brain.temperament`, else the type's, else the first faction's) · creature against creature: a shared faction →
friendly; any −1 → hostile; any +1 → friendly; else neutral. A talker that can't be struck (no `hp`) is **wary**
where a fighter would be hostile, and a creature's faction hatred of such a talker reads neutral (creatures can't
touch it either; a grudge or WS8 #2 can still make it hostile). Legacy creatures have no membership, so the parent's
attitudes hold everywhere but one place: a ghost and a dark-sighted creature (the Gloom Warden, the Lich King,
Brann) were "unaware" of each other in P0 and are "neutral" now; only `witnessesOf` tells the two apart.
Grudges don't expire (a villager you struck stays out for you); `addRep` rounds halves away from zero.

### `social/reputation.js` (subscribed on load)

```js
REP_RULES = RULES.rep = { witnessRange: 12, attackPenalty: -10, killPenalty: -5, namedKillPenalty: -50 }
offender(game, e)                  // you, or a creature with brain.leader === "player"
witnessesOf(game, by, victim)      // the victim's fellows within 12 tiles of `by` who perceive it
offend(game, by, victim) → { witnesses, rep }
killed(game, by, victim) → { [factionId]: rep }
```

- **"hurt" / "attack"** (a blow, landed or missed; not one that couldn't touch): by an offender on a member not
  already hostile to you → the victim and each witness get grudges (`player`, and the follower's id); if anyone but
  the victim saw it, each of the victim's factions pays `attackPenalty × weight` and the log says "Hollowmere saw you
  strike the reed-cutter.". The grudge makes later blows free (the victim is hostile now).
- **"kill"**: by an offender → `killPenalty × weight` (`namedKillPenalty` for `c.named`, the type's `named`, or any
  talker) with each faction of the victim; each other faction that hates one of them (directly or through a parent
  group: the Assize hates Hollowmere through the Bent) gains half, rounded toward zero; `repOnKill` on the creature or
  its type adds its own (legendaries). A kill needs no witness. **A kill or blow without a source moves nothing.**
- WS8's `creatures.witnessesOf(game, e, r)` is used automatically once it exists (namespace import); until then
  line of sight from the witness's eyes.

### `social/builders.js` (registered on load)

```js
ROLES = ["villager", "priest", "guard", "wanderer", "merchant"]   // dialogue ids: c.talk.dialogue = role
buildDialogue(role) → (game, c, { first }) → node
standingOf(game, c) → { faction, def, band, name, attitude }      // its heaviest membership; how it sees you
checkNode(node, path) → [problem]   walkDialogue(game, c, { depth = 4, max = 60 }) → { nodes, problems }
```

What a role says follows its attitude and its main faction's band: refused (only "Leave.") at Dark or when it is a
fighter out for you; curt at Cold or when wary of you (a talker who can't fight, at Cold, or one bearing a grudge;
a merchant won't open the pack); plain at Grey; glad at Warm; kin at Bright. Options:
"Who are you?", a role question (rumours for a wanderer, the road for a guard, …), "Tell me about <faction>." (the
bible's lore with its likes and hates and their reasons), "How do your people see me?" (the band's light word), and
for a merchant "Show me what you have." → `{ shop: "buy" }` while `talk.state.stock` has anything (WS6b replaces it
with `openTrade`).

### `screens/factions.js`

`MODE = "factions"`, `openFactions(game)`, `knownFactions(game)`, `drawFactions(game)`. **P** in either view
(§4.3). Known: rep moved, a start other than 0, or a member within 10 tiles (`game.state.knownFactions`, marked
once a second in play by the update `factions:known`).

### `content/factions.js`

`FACTIONS` (the 21 of bible §15.4 and `bentVillages`) and `GROUPS` (peoples, faiths, plane, dark, engines, beasts,
growths, askewGroup, and `bent` under peoples: Hollowmere and the Bent villages). Each faction keeps the bible's
start (Bent / Plumb), temperament, colour, glyph, sacrament, rite, voice (Hz, wave, flags) and likes/hates with
their reasons.

## Integration requests (6a)

1. **`creatures.js` and `combat.js` (WS8), major for play: mortal people.** A talker can't be struck today
   (`touchable`: `canTalk(target)` → false), and `spawnCreature` gives a talker no health, so a villager who talks
   can't be hit and the witness system only fires on faction members that don't talk. For WS7's villagers: a talker
   whose type has `hp` gets `hp`, `maxHp`, `attack` and the AI's fields like a monster, and is touchable (by you and
   by creatures) when it has `hp > 0`; legacy people (no `hp`) stay untouchable. `factions.js` already treats a
   talker with `hp > 0` as one that can fight (hostile, not wary). The map's bump on such a talker should talk while
   it isn't hostile and strike with Shift (WS8's "attack anyway").
2. **Harm without a source counts as yours (WS8 `combat.js`, WS10 `traps.js`, the integrator's `monsters.js`),
   major for the rep system.** §2.11: `byPlayer` defaulting to true "becomes an explicit source". Today it doesn't:
   - `combat.js applyDamage` defaults `src = game.player`, and `traps.js:69` calls `damageMonster` (spikes) with no
     source, so spikes hurting a faction member emit "hurt" with you as `src`: the victim and its watching fellows
     get a grudge against you and the faction pays `attackPenalty` (the review's probe: a Clatter member on spikes
     turned hostile with `grudges {"player": 1}`). `applyDamage`'s default should be `src = null` (every caller of
     yours passes `game.player`: bombs, scrolls, thrown things), and spikes pass nothing.
   - `setStatusHarm`'s kill (`monsters.js:36`) defaults to `byPlayer = true`, `src = game.player`, so a faction
     member dying of poison, burning or bleeding counts as your kill (the probe: Clatter 50 → 45, Saltbeasts −400 →
     −398). Pass the status's source (`status.src`, set where the status is given) and `byPlayer = src ===
     game.player`.
   `reputation.js` can't tell these from your own blows: the payload says `src` is you. Also the "kill"
   payload's `factions: m.factions || []` is always `[]` (creatures carry `faction`, a weight table, or the type's
   `factions`): `membershipsOf(m).map(([id]) => id)` from `factions.js`.
3. **The dependency table "WS6a witnesses" (the integrator, at the merge):** `reputation.js` switches to WS8's
   `creatures.witnessesOf` by itself once both are in; rerun `node tools/check-social.mjs` (its bot places the
   witnesses in line of sight 2-6 tiles off, a fellow behind a wall, and on the span 1,0,0 fellows in sight 11 and 13
   tiles off; WS8's sight rules should agree).
4. **`progression/chargen.js` (WS4):** `beginRun` should also apply `villageRep`:
   `if (bg.villageRep) addRep(game, "bentVillages", bg.villageRep, "background")` (the Aspirant's −50). The start by
   genotype and Pilgrim's floor need nothing from `beginRun`: `repOf` reads them from `game.player.genotype` and
   `game.state.mode` (set before `beginRun`'s `addRep`s, as it is).
5. **Body reputation (bible §10.4; WS4b mutations, WS5 implants):** when gained, `addRep(game, f, n, "body")`:
   Wings Kites +400, Shellback Clatter +200, Horns Saltbeasts +100, Lampskin Moths +200 and Lampless −200, Ink
   Glands Flatfolk +100, Flatwise Flatfolk +200 Pressed +100 Assize −200, Gills Clatter +100, Silk Glands Kites
   −100; each implant the Plan +25 up to +100 (count them in `p.flags` or similar; removing one doesn't refund).
   Wearables (feather cloak, Hour mask, Assize writ, ink stains: bible §3.5) are C4's or WS5's, the same way with
   reason `"worn"` (and taken back when unworn).
6. **WS7 (villagers, villages, quests):** villager types set `factions` (or each villager `c.faction`) and
   `talk.dialogue` to one of `ROLES`; a generated village registers its own faction with `parent: "bent"` (a Bent
   village) or `"peoples"`, so the Assize's hatred of the Bent reaches it, and its members can carry
   `bentVillages` as a second membership (weight 0.25 to 0.5) so the Assize writ and the Aspirant move them;
   quests give rep with `addRep(game, id, n, "quest")` (bible: +100 with the village, +25 with each faction that
   likes it). Grey members turning hostile in their holy places (bible §3.5) belongs to the sites (WS7 / C1).
7. **WS9 (`screens/pause.js`):** "P factions" in the pause card's key list (with L, V, G and hotbar 1).
8. **`tools/README.md` (the integrator):** the check-social row: "factions, the attitude table, rep arithmetic, the
   villager bot in both views, the dialogue builders over every talker, JSON state, the factions screen".
9. **Not built (content):** the Lantern Moths "like you while your torch is lit" (`likesToo` text only); the
   Smoothers belong to no faction and are always hostile (bible §3.5): give them no membership (the parent rule
   makes them hostile). The Hour cults (generated factions, §6.3) need `pilgrimFloor: false`.
10. **`tools/browser-0d1.mjs` (P0's; the integrator):** its mode tour fails on any registered screen it can't reach,
    so on this branch it would fail "modes never reached: factions" (nothing in `browser-shell` presses P). After
    the target block (the map reached), add:
    ```js
    // The factions screen (WS6a's): P on the map opens it; Esc closes it, and again by a click on "Esc close".
    if ((await mode()) === "map") for (const how of ["keys", "mouse"]) {
      await page.keyboard.press("KeyP");
      await frames(page, 2);
      const opened = await mode();
      if (opened !== "factions") { problems.push(`factions by ${how}: P on the map led to ${opened}`); break; }
      reached.add("factions");
      if (how === "keys") await page.keyboard.press("Escape"); else await click("Esc close");
      await frames(page, 2);
      const closed = await mode();
      if (closed !== "map") problems.push(`factions by ${how}: ${how === "keys" ? "Esc" : "a click on Esc close"} led to ${closed}`);
    }
    ```
    (`tools/browser-ws6.mjs` does the same by keys and mouse at 1280×720 and 600×330, and passes.)
11. **§8.4 (the integrator):** `tools/browser-ws6.mjs` as WS6's, and a `tools/README.md` row for it ("serve with
    `node tools/serve.mjs 8646`; the factions screen in both views, a villager struck with witnesses, a builder's
    priest").

## Handoff

**Updated:** 2026-10-27, local session, on `ws/ws6`. **WS6a is done: tag `p1-ws6a` on `ws/ws6` (pushed).** Nothing is
half finished. Gate numbers, deviations and the verification: `docs/sessions/ws6.md` "Part 6a".

### For the integrator (merging `p1-ws6a`)

- Requests 1-11 above. The ones that matter most for play: **1** (people with health, so a talking villager can be
  struck: without it the witness system fires only on faction members that don't talk), **2** (harm without a source
  counts as yours: spikes and status deaths cost rep), **10** (`browser-0d1`'s tour block for the factions screen).
- No P0 check, fixture or recorded frame was changed; the only file outside §8.4's WS6a list is the new
  `tools/browser-ws6.mjs` (request 11).
- Dependency table "WS6a witnesses": `reputation.js` uses WS8's `creatures.witnessesOf` by itself once both are in
  (a namespace import); rerun `node tools/check-social.mjs` after the merge. Its bot's fellow behind a wall and the
  range edges on the span 1,0,0 should agree with WS8's sight rules (WS8's `sees` adds darkness and stealth, so a
  witness in the dark may not see you: if the bot's witnesses read neutral after the merge, check the light there).
- WS8 #2 is applied here (a creature hostile to you is hostile to your followers); WS4 #8 too (start by genotype,
  Pilgrim's floor), except `villageRep`, which is `chargen.js`'s (request 4).
- Timing: `attitude` is now cheaper than P0's stub for creatures with no faction (190-380 against 1,460-1,840 ns a
  call); passTime alone against `p0-done` ×1.05. In a full run-all with other sessions busy, check-perf reads the
  machine (`docs/sessions/ws6.md` §3, §6).

### Next: WS6b in this worktree (TECH_DESIGN §8.3 "WS6b")

WS6b's files: `dialogue.js`, `social/merchants.js`, `social/ritual.js`, `social/voices.js`, `social/shrines.js`,
`social/backings.js`, `social/liquids.js`, `screens/trade.js`, `screens/ritual.js`, `content/liquids.js`,
`content/items/containers.js`, and its cases added to `tests/checks/social.js` (after Part 6a's, keeping
`run(env)`). DECISIONS: glim is a counter with **no liquid backing and no containers** (so `backings.js` builds the
item backing only and `content/items/containers.js` stays an empty table, or holds nothing that backs money); liquids
are the factions' sacraments for the Kindling and the base of tonics; the bonding rite is **the Kindling** (the
Tracing on the map, the Lighting in lit 3D, the Snuffing in the dark; numbers in bible §15.6 and §3.3).

The exact first steps:

1. **Trade** (`social/merchants.js openTrade`, `screens/trade.js` MODE "trade"): replace `builders.js`'s merchant
   option `{ shop: "buy" }` with `openTrade(game, c)` (keep `{ shop: … }` for the legacy Pell until his services are
   proved through the new screen). Prices through `currency.js buyPrice/sellPrice` (EGO and rep: `stats.js priceMul`
   reads rep? check it; bible §3.5 "Warm: the shop discount", "Bright: the best stock"). Use `standingOf(game, c)` for
   the band, and keep the Cold rule (curt → the pack shut).
2. **The Kindling** (`social/ritual.js openRitual`, `screens/ritual.js` MODE "ritual"): rep `±40 / ±80` with
   `addRep(game, id, n, "kindling")` (bible §3.5), readings bought and sold once, a power learned, recruiting through
   WS8's `ai.recruit` (the follower rules in `factions.js` already hold); add it as a talk option with
   `registerTalkOptions` for talkers whose faction's `rite` allows the current view (map / lit 3D / dark).
3. **Voices** (`social/voices.js voiceFor(c)`): from `FACTIONS[id].voice` (`{ hz, wave, flags }`, bible §15.4) of the
   main faction (`standingOf` or `membershipsOf`), else the species; `sfx.js speakLetter` takes it (`dialogue.js`
   passes `t.npc.type` today).
4. **Shrines** (`social/shrines.js`): the legacy shrine as a component any statue creature can carry.
5. **Backings** (`social/backings.js`): the "item" backing only, `registerBacking("item", { funds, pay, receive })`.
6. **Restock** on `zone:enter` after `away` ≥ two game days; the acceptance: price multipliers against EGO, pay and
   receive with overflow for the item backing, Pell's legacy services all reachable through `registerService` (they
   are, since 0C: keep `check-talk` green), the trade and ritual screens in the browser (extend
   `tools/browser-ws6.mjs`).

### Surprising / worth knowing

- **Talkers can't be struck** in P0 (and WS8): `touchable` refuses any talker. Until request 1 lands, a builder's
  talker (villager, priest…) is never hit and only non-talking faction members fire the witnesses.
- **A talker that can't fight is "wary", not "hostile"**, where the table says hostile; the builders speak curtly to
  a wary talker and refuse only at Dark (or a fighter out for you).
- **`membershipsOf` returns a shared, frozen list for a creature type**: never sort or edit it in place (copy it).
- **Followers**: the house rule applies to them; a cycle of leaders answers "neutral" (a depth guard).
- **Running checks while another agent mutates the tree** gives nonsense: the gate verifier's mutation testing
  happened in this worktree, and a parallel `browser-0d2` run read its mutant. Run verifiers' mutants in a copy.
- **Timing on this machine**: with WS9, WS4b and the integrator busy, a full run-all reads the timed checks 2-4×
  slow; take timed numbers alone, alternating with `p0-done` (`check-perf --against p0-done`).
