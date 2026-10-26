// Currency backings (TECH_DESIGN §2.10; owner WS6b): the "item" backing (a stackable coinage item; weight and
// theft apply), and the "liquid" backing only if content/currency.js names one (DECISIONS §1: glim is a counter,
// with no liquid backing, so it is not built). WS6b registers them with currency.js registerBacking(kind,
// { funds(e), pay(game, e, n) → bool, receive(game, e, n) → overflow }). The design names no other function
// here, so nothing is frozen.
// P0: registers nothing (the counter backing of 0B stays the one in use). Remove STUB when the file is built.
export const STUB = "WS6b";
