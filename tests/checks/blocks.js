// Block ids are append-only: an id stored in a saved zone must never change meaning.
//
//   checkBlocks(BLOCKS, fixtureIds) → { name, ok, problems, stats }
//
// The frozen list (tests/fixtures/block-ids.json) must be a prefix of BLOCKS, key for key. A block
// that isn't in the list yet fails too, so each new id is added to the fixture on purpose. Also:
// keys unique, every block (but air) has a name and a colour, and a `map` look is one character
// with an RGB colour.
export function checkBlocks(BLOCKS, fixtureIds) {
  const problems = [];
  fixtureIds.forEach((key, id) => {
    if (!BLOCKS[id]) problems.push(`id ${id} (${key}) is gone: ids are append-only`);
    else if (BLOCKS[id].key !== key) problems.push(`id ${id} was ${key}, is now ${BLOCKS[id].key}: ids are append-only`);
  });
  for (let id = fixtureIds.length; id < BLOCKS.length; id++)
    problems.push(`id ${id} (${BLOCKS[id].key}) is new: add it to the end of tests/fixtures/block-ids.json`);
  const seen = new Set();
  BLOCKS.forEach((b, id) => {
    if (seen.has(b.key)) problems.push(`key ${b.key} is used twice`);
    seen.add(b.key);
    if (!b.name) problems.push(`${b.key} has no name`);
    if (id > 0 && !(Array.isArray(b.color) && b.color.length === 3)) problems.push(`${b.key} has no colour`);
    if (b.map && !(typeof b.map.glyph === "string" && [...b.map.glyph].length === 1 && Array.isArray(b.map.color) && b.map.color.length === 3))
      problems.push(`${b.key}: map must be { glyph: one character, color: [r, g, b] }`);
  });
  if (BLOCKS.length > 256) problems.push(`${BLOCKS.length} blocks: zone grids are bytes (at most 256)`);
  return { name: "blocks", ok: problems.length === 0, problems,
           stats: { blocks: BLOCKS.length, frozen: fixtureIds.length, reserved: BLOCKS.filter((b) => b.reserved).length } };
}
