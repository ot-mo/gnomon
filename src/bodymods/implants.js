// Implants (TECH_DESIGN §2.5 "Implants", §2.8; §1.4 "bodymods (WS5)"; DECISIONS §1: the plumb genotype, its
// grade and true-marks). A P0 stub with the frozen signatures; WS5 builds it over content/items/implants.js.
//
//   canInstall(game, p, item, partId) → { ok, reason }    only at a Truing Cradle (stations.js) or a surgeon
//                                                         service, within the grade, on a part with implant: true
//   install(game, p, item, partId)                        into p.body.implants[partId]; invalidateStats(p); emits "install"
//   uninstall(game, p, partId)                            the curse lock refuses ordinary removal (body.js unequip's rule)
//
// Until WS5 builds them: canInstall refuses ({ ok: false, reason: "not built yet (WS5)" }), install and
// uninstall throw "not built yet (WS5)". Remove STUB when the file is built.
export const STUB = "WS5";
const notBuilt = (fn) => { throw new Error(`${fn}: not built yet (WS5)`); };

export function canInstall(game, p, item, partId) { return { ok: false, reason: "not built yet (WS5)" }; }
export function install(game, p, item, partId) { notBuilt("install"); }
export function uninstall(game, p, partId) { notBuilt("uninstall"); }
