// Vérifie data-raw/dams/fill/dam-fill-<date>.json : somme des stocks par barrage vs total de bassin
// (public/data/national-bulletin.json si la date correspond). Usage : node check_dam_fill.mjs 2026-11-18
import { readFileSync } from 'node:fs';
const date = process.argv[2] ?? '2026-11-18';
const here = new URL('.', import.meta.url);
const fill = JSON.parse(readFileSync(new URL('../../data-raw/dams/fill/dam-fill-' + date + '.json', here)));
const nb = JSON.parse(readFileSync(new URL('../../public/data/national-bulletin.json', here)));
let bad = 0;
for (const b of fill.basins) {
  const sum = fill.dams.filter((d) => d.basin === b.name).reduce((a, d) => a + d.storedMm3, 0);
  const ref = nb.date === date ? nb.basins.find((x) => x.name === b.name).storedMm3 : b.storedMm3;
  const delta = +(sum - ref).toFixed(2);
  const ok = Math.abs(delta) <= 0.05;
  if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + b.name.padEnd(18) + ' somme ' + sum.toFixed(2) + ' ref ' + ref + ' delta ' + delta);
}
console.log(bad ? bad + ' bassin(s) hors tolérance' : 'tous les bassins dans la tolérance (0.05 Mm3)');
process.exit(bad ? 1 : 0);
