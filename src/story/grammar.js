// The text grammar (TECH_DESIGN §2.15; §1.4 "story (WS7)"; owner WS7): history's gospel, inscription and hostile
// versions, the names of the Hours and their places, rumours.
//
//   expand(grammar, symbol, rng, ctx) → string     grammar: a table of rules, symbol → [expansion] (content/grammar.js
//                                                  GRAMMAR.rules, or any such table); rng: rng.js, never Math.random
//                                                  (R6: history and villages are generation); ctx: the bindings a
//                                                  rule may read (a ruler's name, a place, a faction), which come
//                                                  before the grammar's own rules. An expansion names a symbol as
//                                                  #symbol#, with an optional modifier: #symbol.cap# (first letter
//                                                  up), #symbol.upper#, #symbol.lower#, #symbol.a# ("a" or "an" before
//                                                  it); several apply left to right (#noun.lower.a.cap#). A binding
//                                                  may be a string, a number, a list (one is drawn) or a function
//                                                  (rng) → string.
//                                                  An unknown symbol, or rules that never end, throw.
//   hourName(rng) · placeName(rng) · regionName(rng, domain) → string     bible §2.3's generators: each name is at
//                                                  most 9 letters a word, and none contains a §15.11 word
//   nameAllowed(name, { long = false }) → bool    the generators' test (long: a title of several words, held to
//                                                  the word list only, not to 9 letters a word)
//   ordinal(n) → "1st", "41st"…   numberWords(n) → "three hundred"…   cap(s)
import { GRAMMAR } from "../content/grammar.js";

const MAX_DEPTH = 24;
const MODIFIERS = { cap: (s) => cap(s), upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), a: (s) => article(s) };

export function expand(grammar, symbol, rng, ctx = {}) {
  return expandSymbol(grammar, symbol, rng, ctx, 0);
}

function expandSymbol(grammar, symbol, rng, ctx, depth) {
  if (depth > MAX_DEPTH) throw new Error(`expand: "${symbol}" goes deeper than ${MAX_DEPTH} (a rule that never ends?)`);
  let value;
  if (Object.prototype.hasOwnProperty.call(ctx, symbol)) value = ctx[symbol];
  else if (grammar && Object.prototype.hasOwnProperty.call(grammar, symbol)) value = grammar[symbol];
  else throw new Error(`expand: no rule or binding "${symbol}"`);
  if (typeof value === "function") value = value(rng);
  if (Array.isArray(value)) {
    if (!value.length) throw new Error(`expand: "${symbol}" has no expansions`);
    value = value[Math.floor(rng() * value.length)];
  }
  return String(value).replace(/#([^#\s]+)#/g, (_, ref) => {
    const parts = ref.split("."), mods = [];
    while (parts.length > 1 && MODIFIERS[parts[parts.length - 1]]) mods.unshift(MODIFIERS[parts.pop()]);
    return mods.reduce((s, m) => m(s), expandSymbol(grammar, parts.join("."), rng, ctx, depth + 1));
  });
}

// "a" or "an" before a word, by its sound as far as its first letter tells.
const article = (s) => `${/^[aeiou]/i.test(s) ? "an" : "a"} ${s}`;

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// --- Names (bible §2.3) ------------------------------------------------------------------------------------------
// The generators reject a name longer than 9 letters (a word) and any that contains a word of bible §15.11. The
// single-word terms are kept here written backwards, so that the source itself holds none of them (check-names
// reads every file of src/); check-story feeds 10,000 names to check-names' own deny-list as well.
const DENIED = ("duq appoj natlus hpehser sretae murhtarab tsiminahcem ralpmet ahtoglog eldnips hcropnomo aykukayk arze " +
  "havvahc wajpans kloftaog nerdnih hsrig damord dapwolg enivretaw mard gnasarap repse reliocer ardehtac lyteab " +
  "ecnesselavnoc galsnus emorhcatez etirelluf leetsyrc evygra qnalk irahcassi ilaathpan hanihkehs ecnecsehpasak " +
  "murtsonrebu remmilg aremihc gnirafyaw cisyhp gnireknit cissalc yalpelor rednaw")
  .split(" ").map((w) => [...w].reverse().join(""));

export function nameAllowed(name, { long = false } = {}) {
  const lower = String(name).toLowerCase();
  if (!long && lower.split(/[\s'-]+/).some((w) => w.replace(/[^a-z]/g, "").length > 9)) return false;
  return !DENIED.some((w) => lower.includes(w));
}

function tryName(make, rng) {
  for (let k = 0; k < 40; k++) { const n = make(); if (nameAllowed(n)) return n; }
  throw new Error("a name generator found nothing it could use in 40 tries");
}

// An Hour: onset, one or two middles, a final ("Ishvalet", "Ammaruth"); 3 to 4 syllables.
export function hourName(rng) {
  const { onsets, middles, finals } = GRAMMAR.names.hour;
  return tryName(() => {
    let s = rng.pick(onsets) + rng.pick(middles);
    if (rng.chance(0.55)) s += rng.pick(middles);
    s += rng.pick(finals);
    s = s.replace(/(.)\1\1/g, "$1$1").replace(/([iu])\1/g, "$1");
    return cap(s);
  }, rng);
}

// A place of the morning: "Mereford", "Glasswick".
export function placeName(rng) {
  const { heads, tails } = GRAMMAR.names.place;
  return tryName(() => {
    const h = rng.pick(heads), t = rng.pick(tails);
    return h + (h.endsWith(t[0]) ? t.slice(1) : t);
  }, rng);
}

// A historical region: "the Clear Coast", "the White Pans" (a domain's ruin adjective, or none for a plain one).
export function regionName(rng, domain) {
  return tryName(() => `the ${rng.pick(GRAMMAR.domains[domain]?.ruins || ["Old"])} ${rng.pick(GRAMMAR.names.region.lands)}`, rng);
}

// --- Numbers in words ---------------------------------------------------------------------------------------------
const ONES = ["nought", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
              "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function numberWords(n) {
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + numberWords(n % 100) : "");
  return numberWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + numberWords(n % 1000) : "");
}
export function ordinal(n) {
  const t = n % 100, s = t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${s}`;
}
