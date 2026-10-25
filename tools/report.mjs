// Prints a check result ({ name, ok, problems, stats, notes }) and returns the exit code.
export function report(result) {
  const { name, ok, problems = [], stats = {}, notes = [] } = result;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  for (const n of notes) console.log(`  note: ${n}`);
  for (const p of problems.slice(0, 40)) console.log(`  ✗ ${p}`);
  if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  return ok ? 0 : 1;
}
