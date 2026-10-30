// The landmark people (the integrator, C5 #3 with C1b #18; bible §5): who stands on each of a landmark plan's people
// letters (content/world/landmarks.js `letters`), placed as its span's surface is made, each a talker under its own
// words (content/people-words.js dialogueIdOf).
//
//   kindOf(who, letter) → type id | null   the letter's `kind`, else a type of the same id (C3's tamsin, hallen, ottilie,
//                                          corner, detailC; the parent's Mira, Brann, Sir Corwin, Pell, Rook), else the
//                                          culture type whose `people` names it (content/creatures/people.js), else KINDS
//   peopleOn(landmark, plan, at) → [{ uid, who, ch, letter, x, y }]   every person cell of a plan stamped with its
//                                          corner at `at` (one per cell: Halfnight's three ghost traders)
//   placeLandmarkPeople(zone, { landmark, plan, at })   (world/sites.js registerPlanPeople) each one on its cell, standing
//                                          where you would in that column; those PRESENCE governs are written to
//                                          zone.landmarkPeople instead and come and go on zone:enter
//   PRESENCE[who]   { round: [days, { [landmarkId]: [first, last] }] } a peddler's round by the world day (Pell: two days
//                   each at Hollowmere, Benchmark and Molar); { after: beatId } there once that beat is done (Castor's
//                   checkpoint, from beat 2)
//   present(game, who, landmarkId) → bool
//   syncPeople(game, zone)   on zone:enter: each of zone.landmarkPeople added or taken away as present() says
//   personKilled(game, uid)  on "kill": a landmark person's uid recorded dead (game.state.landmarkPeople.dead)
//   PERSON_FIELDS            what a save keeps of a placed person beyond a creature's own (registerCreatureField)
//
// The view rules are the types': Folio's people and Ess and Tee are flat (met only on the map); Brann, thol and the ghost
// trader ghostly (seen and talked to only in the dark: your torch out, and under the sky only at night). A placed person:
// uid "landmark:<id>:<letter>[:<n>]", its letter's name, named (the log says "Mira", "the leech"), level the span's,
// c.landmark and c.who; where its type is a culture's or a creature's kind, its title is its role's first clause.
// A person killed is gone for good: one PRESENCE brings back is not brought back (game.state.landmarkPeople.dead).
import { CREATURE_TYPES, spawnCreature, addCreature, removeCreature } from "../creatures.js";
import { registerPlanPeople } from "../world/sites.js";
import { dialogueIdOf } from "../content/people-words.js";
import { PEOPLE } from "../content/creatures/people.js";
import { dayNumber } from "../clock.js";
import { on } from "../events.js";
import { registerCreatureField } from "../save/codec.js";

// Who has no type of their own and no culture type: Ess and Tee are the parent's Ess (Tee at her side, in her words);
// Castor is an assizer of the Assize.
const KINDS = { essAndTee: "ess", castor: "assizer" };
// A title where the role's first clause doesn't read as one.
const TITLES = { castor: "the Assize's checkpoint at Molar", benchmarkSignaller: "keeper of the Signal Room", mapRoomSurveyor: "Location readings and the tier layer",
                 bramwyn: "keeper of the Pressing rite", sporeHerbalist: "tonics and fungal limbs" };

export const PRESENCE = {
  pell: { round: [6, { hollowmere: [1, 2], benchmark: [3, 4], molar: [5, 6] }] },
  castor: { after: "beat1" },
};

const CULTURE = new Map();
for (const [id, t] of Object.entries(PEOPLE)) for (const who of t.people || []) CULTURE.set(who, id);

export function kindOf(who, letter = {}) {
  const id = letter.kind || (CREATURE_TYPES[who] ? who : null) || CULTURE.get(who) || KINDS[who] || null;
  return id && CREATURE_TYPES[id] ? id : null;
}

export function peopleOn(landmark, plan, at) {
  const out = [];
  for (const [ch, letter] of Object.entries(landmark.letters || {})) {
    let n = 0;
    plan.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === ch) {
      out.push({ uid: `landmark:${landmark.id}:${ch}${n ? `:${n}` : ""}`, who: letter.who, ch, letter, x: at.x + x, y: at.y + y });
      n++;
    } });
  }
  return out;
}

export function present(game, who, landmarkId) {
  const p = PRESENCE[who];
  if (!p) return true;
  if (p.round) {
    const [days, at] = p.round, d = ((dayNumber(game) - 1) % days) + 1, r = at[landmarkId];
    return !!r && d >= r[0] && d <= r[1];
  }
  return game.state?.campaign?.done?.[p.after] !== undefined;
}

// A culture's or a kind's title: its role up to the first colon, semicolon or bracket.
const titleOf = (who, role) => TITLES[who] ?? String(role || "").split(/[:;(]/)[0].trim();

function spec(zone, landmark, p) {
  const kind = kindOf(p.who, p.letter);
  if (!kind) return null;
  const s = zone.stand?.[p.x + p.y * zone.w];
  const own = kind === p.who || kind === "ess";
  return { uid: p.uid, who: p.who, kind, landmark: landmark.id, x: p.x, y: p.y, z: s >= 0 ? s : null, level: zone.level,
           name: p.letter.name, title: own ? null : titleOf(p.who, p.letter.role) };
}

function spawnPerson(sp) {
  const c = spawnCreature(sp.kind, sp.x, sp.y, sp.z, { uid: sp.uid, name: sp.name, level: sp.level,
    talk: { dialogue: dialogueIdOf(sp.who), state: {} } });
  c.named = { epithet: "", history: null };
  c.landmark = sp.landmark;
  c.who = sp.who;
  if (sp.title) c.title = sp.title;
  return c;
}

export function placeLandmarkPeople(zone, { landmark, plan, at }) {
  const later = [];
  for (const p of peopleOn(landmark, plan, at)) {
    const sp = spec(zone, landmark, p);
    if (!sp || sp.z === null) continue;
    if (PRESENCE[sp.who]) later.push(sp);
    else addCreature(zone, spawnPerson(sp));
  }
  if (later.length) zone.landmarkPeople = later;
}
registerPlanPeople(placeLandmarkPeople);
export const PERSON_FIELDS = ["landmark", "who", "title"];   // (kept by a save)
for (const f of PERSON_FIELDS) registerCreatureField(f);

// Those who come and go (zone.landmarkPeople): there when PRESENCE says, unless killed.
export function syncPeople(game, zone) {
  if (!zone?.landmarkPeople || !zone.creatures) return;
  const dead = game.state?.landmarkPeople?.dead || {};
  for (const sp of zone.landmarkPeople) {
    const want = !dead[sp.uid] && present(game, sp.who, sp.landmark), have = zone.creatures.find((c) => c.uid === sp.uid);
    if (want && !have) addCreature(zone, spawnPerson(sp));
    else if (!want && have) removeCreature(zone, have);
  }
}
export function personKilled(game, uid) {
  if (typeof uid !== "string" || !uid.startsWith("landmark:") || !game.state) return;
  ((game.state.landmarkPeople ||= {}).dead ||= {})[uid] = true;
}
on("zone:enter", (game, { zone }) => syncPeople(game, zone));
on("kill", (game, { uid }) => personKilled(game, uid));
