// The landmark dungeons' people and things (the integrator, C5 #12 with C1b #18, #20, #24; on B2's places: docs/b2.md
// "Requests" 3): who and what stands where a landmark dungeon's floor is made (world/sites.js registerDungeonPeople,
// called by world/zonegen.js), from content/world/landmarks.js `below` ({ who, floor | up }), with uids of their own and
// no draw from any stream, so a save keeps them and nothing else generated moves.
//
//   the Hierarch (strade, `up: 2`) on the Square's top floor up: an assizer in her name, talking under her words, in
//     the room farthest from the floor's stair (beat 10's giver: her choice and offer, story/beats.js)
//   the Square's prisoners (zone.prisoners, B2's cells on floors 2 and 3): Lio in floor 2's first cell, a pressed
//     prisoner in each other; flat, talked to on the map, until their press-wheel turns (B2's "prisoner:freed")
//   Tovi Hallen on the Press's floor 3 (zone.captive): a Survey engineer, pressed flat (unpressed by the unpress lens,
//     once C4's lens is made)
//   the Assize plumb-seal at the end of Kettle Mesa's floor-3 sapper tunnel (zone.clue): beat 1's find (its reward no
//     longer gives it, so it can't come twice)
//   the bottoms' `who` (their barks, story/barks.js): a `below` entry's creature found by its kind or name (the Grub
//     Mother, a legend of the brine-grubs; the Gloam Warden); the Speaking Door, the parent's door, asking C5's question
//     over its riddle ("speakingDoor:riddle"); the Second-Hour stele's reading, told on first reaching the Under-Page's floor 3
//   PRESSED   who lies flat until freed: Lio, Tovi Hallen, the prisoners (vis.flat, kept by a save)
import { addCreature } from "../creatures.js";
import { distance } from "../rng.js";
import { FLOOR_Z } from "../world.js";
import { registerDungeonPeople } from "../world/sites.js";
import { spawnLandmarkPerson, kindOf } from "./landmark-people.js";
import { campaignItem } from "./beats.js";
import { makeItem } from "../items.js";
import { on } from "../events.js";
import { registerDialogue, talkTo, node } from "../talk.js";
import { PEOPLE_WORDS } from "../content/people-words.js";

export const PRESSED = new Set(["lio", "toviHallen", "pressedPilgrim"]);
const PRISONER = { who: "pressedPilgrim", kind: "pressedPilgrim", name: "a pressed prisoner", role: "a prisoner of the Assize" };

const standZ = (zone, x, y) => { const s = zone.stand?.[x + y * zone.w]; return s >= 0 ? s : FLOOR_Z; };

function place(zone, L, entry, x, y, uid) {
  const kind = kindOf(entry.who, entry);
  if (!kind || zone.creatures.some((c) => c.uid === uid)) return null;
  const c = spawnLandmarkPerson({ uid, who: entry.who, kind, landmark: L.id, x, y, z: standZ(zone, x, y), level: zone.level,
    name: entry.name, title: entry.title !== undefined ? entry.title : kind === entry.who ? null : entry.role?.split(/[:;(,]/)[0].trim() });
  if (PRESSED.has(entry.who)) c.vis.flat = true;
  return addCreature(zone, c);
}

// The room farthest from where you come in (the floor's stair down to it, else its spawn): its middle, or the floor
// nearest it.
function farthestRoom(zone) {
  const from = zone.stairs || zone.spawn || { x: zone.w / 2, y: zone.d / 2 };
  const rooms = (zone.rooms || []).filter((r) => r.cx !== undefined);
  rooms.sort((a, b) => distance(b.cx - from.x, b.cy - from.y) - distance(a.cx - from.x, a.cy - from.y));   // (rng.js distance: the same bits on every engine)
  for (const r of rooms)
    for (let d = 0; d < 4; d++)
      for (let y = r.cy - d; y <= r.cy + d; y++)
        for (let x = r.cx - d; x <= r.cx + d; x++)
          if (zone.stand?.[x + y * zone.w] === FLOOR_Z && !zone.creatures.some((c) => c.tx === x && c.ty === y)) return [x, y];
  return null;
}

export function placeDungeonPeople(zone, { site, z, landmark: L }) {
  if (!L || !zone) return;
  const here = (L.below || []).filter((b) => (b.up ? -b.up === z : b.floor === z));
  for (const entry of here) {
    if (entry.who === "strade") {
      const at = farthestRoom(zone);
      if (at) place(zone, L, { ...entry, title: "the Assize's head" }, at[0], at[1], `landmark:${L.id}:${z}:strade`);
    } else if (entry.who === "toviHallen" && zone.captive) {
      place(zone, L, { ...entry, title: "a Survey engineer, the Reeve's son" }, zone.captive.x, zone.captive.y, `landmark:${L.id}:${z}:toviHallen`);
    }
    // a bottom or an inhabitant the floor already holds: its `who`, for its bark
    for (const c of zone.creatures) if (!c.who && !c.talk && ((entry.kind && c.type === entry.kind) || c.name === entry.name)) c.who = entry.who;
    for (const c of zone.creatures) if (!c.who && c.type === "door" && entry.who === "speakingDoor") { c.who = entry.who; c.talk.dialogue = "speakingDoor:riddle"; }
  }
  // The Square's cells: Lio in floor 2's first, a pressed prisoner in every other.
  const lio = here.find((b) => b.who === "lio");
  (zone.prisoners || []).forEach((q, k) => {
    const entry = k === 0 && lio ? { ...lio, title: null } : { ...PRISONER, title: PRISONER.role };
    const c = place(zone, L, entry, q.x, q.y, `landmark:${L.id}:${z}:prisoner:${k}`);
    if (c && q.freed) c.vis.flat = false;
  });
  // Beat 1's find: the seal at the tunnel's end.
  if (zone.clue && L.id === "kettleMesa" && !zone.items.some((it) => it.id === "assizeSeal")) {
    const it = campaignItem("assizeSeal");
    if (it) zone.items.push(makeItem(it, zone.clue.x + 0.5, zone.clue.y + 0.5, standZ(zone, zone.clue.x, zone.clue.y)));
  }
}
registerDungeonPeople(placeDungeonPeople);

// The Under-Page's Speaking Door asks C5's question (PEOPLE_WORDS.speakingDoor.greet) over the parent's riddle: its
// answers, its gate and its hatches are the parent's door's (content/legacy/encounters.js "door"), as is its word once open.
registerDialogue("speakingDoor:riddle", (game, c) => {
  const base = talkTo(game, { ...c, talk: { ...c.talk, dialogue: "door", own: true } });
  return !base || c.talk.state.open ? base : node(PEOPLE_WORDS.speakingDoor.greet, base.options);
});
// The Second-Hour stele on the Under-Page's founding floor (Saltpage's dungeon, floor 3: B2 carved its Hour's accounts in the
// walls): the reading that names Vesper (PEOPLE_WORDS.secondHourStele.greet), told the first time you stand there.
on("zone:enter", (game, { zone }) => {
  if (zone?.landmarkId !== "saltpage" || zone.z !== 3 || !game.state || game.state.steleRead) return;
  game.state.steleRead = game.time || true;
  game.log?.(`A Second-Hour stele stands in the founding hall. Its carving reads: ${PEOPLE_WORDS.secondHourStele.greet}`, [220, 200, 150]);
});

// A press-wheel turned (B2's "prisoner:freed"): the one in that cell stands up, no longer flat.
on("prisoner:freed", (game, { zone, prisoner }) => {
  if (!zone || !prisoner) return;
  for (const c of zone.creatures) if (c.landmark && c.tx === prisoner.x && c.ty === prisoner.y && PRESSED.has(c.who)) c.vis.flat = false;
});
