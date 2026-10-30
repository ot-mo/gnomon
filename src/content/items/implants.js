// Implants (TECH_DESIGN §2.18 "content/implants.js", bible §13.6 and §10.4; WS5, then C4): the Plumb's body mods,
// fitted at a Truing Cradle into a part's socket (a part with implant: true, body.js). DECISIONS §1: the cost is a
// grade (the design's `license`), counted against the grade you hold; true-marks raise the grade.
//
//   IMPLANTS[id] = { name, parts, grade, info, bonus?, ability?, effect?, addsPart?, destroyOnRemove? }
//     parts            the part types it can go into (body.js: head face body back arm gloves feet)
//     grade            what it counts against your grade (bible "cost"); fitting costs 25 glim × grade
//     bonus            stat bus bonuses while installed (stats.js BONUS_KEYS)
//     ability          an ability id it gives (bodymods/implants.js registers them; the hotbar holds the id)
//     effect           a word other systems ask about through bodymods implantEffect(e, effect): the effects that
//                      live in someone else's code (docs/ws5.md lists who reads which)
//     addsPart         a part it gives the body while installed ({ id, type }: the folding rack's second back)
//     destroyOnRemove  † in the bible: taking it out destroys it
// The value (what a merchant asks) is IMPLANT_VALUE(grade): 400 to 2,000 glim (bible §3.1).
//     needs            (C4) what of its line nothing reads yet: the integrator's backlog (docs/ws5.md requests 5-10,
//                      docs/c4.md); its line says what it is for, so a Cradle can sell it
export const IMPLANT_VALUE = (grade) => Math.min(2000, 200 * (grade + 1));

export const IMPLANTS = {
  levelEye: { name: "level-eye", parts: ["face"], grade: 1, effect: "readsCreatures",
    info: "A ground lens over one eye. You read a creature's exact health, armour, defence and weaknesses." },
  tallyEye: { name: "tally-eye", parts: ["face"], grade: 1, effect: "readsArtifacts", bonus: { examine: 2 },
    info: "Counts what it sees. Shows an artifact's complexity and a cell's charge; +2 to examine." },
  darkLens: { name: "dark lens", parts: ["face"], grade: 2, bonus: { darkSight: 3 }, effect: "darkLens",   // 4 tiles (player.js torchRange: darkSight × 1.5, at most 4)
    info: "A smoked lens that drinks the dark. With your torch out you still see a little way." },
  plumbEar: { name: "plumb-line ear", parts: ["head"], grade: 2, effect: "plumbEar",
    info: "A weighted thread in the inner ear. Pits and chasms within 6 tiles mark themselves on your map." },
  surveyLens: { name: "survey lens", parts: ["head"], grade: 3, effect: "surveyLens", needs: "3D filling the map at twice the range; a minimap in 3D (render3d.js, turns.js)",
    info: "The Survey's own lens. What you see in 3D goes onto your map from twice as far." },
  lampCrown: { name: "lamp crown", parts: ["head"], grade: 2, bonus: { torch: 1 / 3 },   // +2 tiles on the torch's 6
    info: "A ring of oil-lit wicks set in the scalp. Your torch reaches further, and your hands stay free." },
  planeShunt: { name: "plane-shunt", parts: ["head"], grade: 6, ability: "planeShunt",
    info: "A switch behind the ear that folds you down into the Plane: Flat for 4 s." },
  plateGraft: { name: "plate graft", parts: ["body", "back", "head"], grade: 3, bonus: { armour: 1 },
    info: "A plate of truesteel let into the flesh. +1 armour; up to three, one per part." },
  bellowsLung: { name: "bellows lung", parts: ["body"], grade: 2, effect: "bellowsLung", bonus: { breath: 1 }, needs: "sprint +50% (player.js)",   // status.js airOf
    info: "A leather second lung. You hold your breath twice as long in deep water." },
  glimHeart: { name: "glim heart", parts: ["body"], grade: 4, bonus: { maxHp: -5, torchCost: -1 }, effect: "freeTorch", destroyOnRemove: true,   // torch.js torchCost
    info: "A heart that burns glim of its own. Your torch costs nothing; -5 max HP. Destroyed if removed." },
  metronomeHeart: { name: "metronome heart", parts: ["body"], grade: 4, effect: "beatSight",
    info: "It keeps the Metronome's time. The next spikes, presses and sweeping hands glow in 3D." },
  jumpBack: { name: "jump-back node", parts: ["body"], grade: 3, ability: "jumpBack",
    info: "Pulls you back to somewhere you have been on this floor (every 100 s)." },
  springTendons: { name: "spring tendons", parts: ["feet"], grade: 2, bonus: { jump: 1 },
    info: "Coiled wire in the heel. You jump a block higher." },
  gripSoles: { name: "grip soles", parts: ["feet"], grade: 2, effect: "gripSoles", needs: "no slipping or knockback; ledge edges and the map's 2-block climb (WS8, turns.js)",
    info: "Soles that bite the ground. No slipping, no knockback; you stand on ledge edges." },
  knuckles: { name: "truesteel knuckles", parts: ["gloves"], grade: 2, effect: "knuckles",
    info: "Truesteel under the skin of the hands. Your fists hit for 2d4 and crush." },
  gyroWrists: { name: "gyro wrists", parts: ["arm"], grade: 2, effect: "gyroWrists",   // (throwing.js throwGravity, combat.js thrownSpec: B1)
    info: "Spinning weights in the wrists. Thrown things fly flat and hit for 2 more." },
  jugglerArm: { name: "juggler's arm", parts: ["arm"], grade: 5, effect: "jugglerArm",   // (throwing.js volley: B1)
    info: "A second set of tendons. You throw up to four knives at once." },
  balmPump: { name: "balm pump", parts: ["back"], grade: 3, effect: "balmPump", needs: "a balm tonic from the pack injected below 40% health (content/items/tonics.js injectTonic; on the HP change)",
    info: "Holds four tonics along the spine and injects a balm when you fall below 40% health." },
  foldingRack: { name: "folding rack", parts: ["back"], grade: 4, addsPart: { id: "back_2", type: "back" },
    info: "A frame that folds out of the shoulders: room for a second thing on your back." },
  dialSpine: { name: "dial spine", parts: ["back"], grade: 10, ability: "dialSpine", destroyOnRemove: true,
    info: "Once a world day, everything but you stands still for 5 s. Destroyed if removed." },
};
