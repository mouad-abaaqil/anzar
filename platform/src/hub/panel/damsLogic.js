// Barrages du bassin d'une région, lus sur le bulletin du ministère (data/dam-fill.json). Logique pure, testable.
// Rien n'est inventé : pas de bassin de barrages = message honnête ; nom absent = nom arabe du bulletin.
export const DAMS_LABEL = 'lu sur le bulletin du 23 nov. 2026, pas un relevé en direct';
export const NAME_NOTE = 'Noms français : translittération proposée, non vérifiée. Le nom arabe est celui du bulletin.';
export const NO_BASIN_MESSAGE = 'Aucun barrage suivi par le bulletin pour cette région : pas de remplissage à afficher.';
const MAIN_SHARE = 0.3;

/** Bassins à afficher pour une région : ceux qui pèsent au moins 30 % de sa demande, sinon le principal. */
export function basinNamesFor(regionBalance) {
  const shares = [...(regionBalance?.basinShares ?? [])].filter(s => s?.basin).sort((a, b) => (b.share || 0) - (a.share || 0));
  if (!shares.length) return [];
  const main = shares.filter(s => (s.share || 0) >= MAIN_SHARE).map(s => s.basin);
  return main.length ? main : [shares[0].basin];
}

const rowOf = d => ({
  key: (d.basin || '') + '|' + (d.nameAr || d.name),
  name: d.name || d.nameAr,
  nameAr: d.name ? d.nameAr || null : null,
  unverified: Boolean(d.name) && /non v/i.test(d.nameSource || ''),
  basin: d.basin,
  storedMm3: d.storedMm3,
  fillPct: Math.max(0, Math.min(100, d.fillPct)),
  approx: d.storedMm3 < 1,
});

/** -> { kind: 'none' | 'ready', basins: [{ name, fillPct, sameDay2025Pct, dams: [...] }], unverified, date } ; tri : le plus rempli d'abord. */
export function basinDamsFor(fill, regionBalance) {
  const names = basinNamesFor(regionBalance);
  const dams = Array.isArray(fill?.dams) ? fill.dams : [];
  const basins = names.map(name => ({
    name,
    fillPct: (fill?.basins ?? []).find(b => b.name === name)?.fillPct ?? null,
    sameDay2025Pct: (fill?.basins ?? []).find(b => b.name === name)?.sameDay2025Pct ?? null,
    dams: dams.filter(d => d.basin === name && Number.isFinite(d.fillPct) && Number.isFinite(d.storedMm3) && (d.name || d.nameAr))
      .map(rowOf).sort((a, b) => b.fillPct - a.fillPct || a.name.localeCompare(b.name, 'fr')),
  })).filter(b => b.dams.length);
  if (!basins.length) return { kind: 'none', basins: [], unverified: false, date: fill?.date ?? null };
  return { kind: 'ready', basins, unverified: basins.some(b => b.dams.some(d => d.unverified)), date: fill?.date ?? null };
}
