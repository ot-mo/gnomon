// Gossip (TECH_DESIGN §2.14 "gossip" secrets, §8.3 "WS7"; §1.4 "story (WS7)"; owner WS7). A P0 stub with the
// frozen signature.
//
//   gossipFor(game, c) → text | null     a rumour this talker may tell (its village, its faction, history),
//                                        offered through talk.js registerTalkOptions
//
// Until WS7 builds it, nobody has gossip (null). Remove STUB when the file is built.
export const STUB = "WS7";

export function gossipFor(game, c) { return null; }
