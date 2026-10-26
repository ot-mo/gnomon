// Secrets (TECH_DESIGN §2.14; §1.4 "story (WS7)"; owner WS7). A P0 stub with the frozen signature.
//
//   learnSecret(game, id, source)     into game.state.journal.secrets[id] = { learned, source, sold }; emits "secret"
//                                     { kind, id, at }; a location secret is pinned on the world map (overworld pin)
//                                     and starts a "visit" quest. Ids: "loc:<landmark>", "hist:<ruler>:<event>",
//                                     "village:<site>:<n>", "gossip:<n>", stable per seed.
//   SecretDef = { id, kind: "location" | "history" | "village" | "gossip" | "recipe", tags, text(run), at?, value }
//
// Sources: talk, the Kindling, notes, inscriptions and mosaics (learned through an `inspect` event naming a
// mural tile, never by drawing). Until WS7 builds it, it throws "not built yet (WS7)".
// Remove STUB when the file is built.
export const STUB = "WS7";

export function learnSecret(game, id, source) { throw new Error("learnSecret: not built yet (WS7)"); }
