// Ids (TECH_DESIGN §7.4). Two kinds:
//   id   a number, a runtime handle: occ grids, sightings, a shrine's trial, a bounty's target. One global
//        counter for every creature and person (the parent game had one per module). 0D2's save codec keeps
//        it in the slot record and restores it before any zone loads, so ids never repeat after a load.
//   uid  a string, stable across zones, saves and runs of the same seed: whatever is referenced from
//        another zone or before generation (zone patches, quests, history) uses it. Generation gives every
//        creature it places one (genUid); history and quests name theirs ("legend:lich", "village:12:elder").
//
//   nextEntityId() → number           entityCounter() → the next id that will be handed out
//   nextId() → number                 the same (§1.4's name for it)
//   setEntityCounter(n)               restoring a save (never lower than an id in a loaded zone)
//   getIds() → { entity }             what a save keeps (§1.4, §7.4: the slot record's `ids`)
//   setIds({ entity })                a load puts it back before any zone loads
//   genUid(zone, tag = "c") → string  "<zone key>#<tag><n>": the n-th uid this zone's generation handed out
let entity = 1;

export const nextEntityId = () => entity++;
export const nextId = nextEntityId;
export const entityCounter = () => entity;
export function setEntityCounter(n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`setEntityCounter: ${n} is not a positive integer`);
  entity = n;
}
export const getIds = () => ({ entity });
export function setIds(ids) { setEntityCounter(ids?.entity); }

// The same generation (same seed, same zone) hands out the same uids in the same order.
export function genUid(zone, tag = "c") {
  zone.uidSeq = (zone.uidSeq || 0) + 1;
  return `${zone.key}#${tag}${zone.uidSeq}`;
}
