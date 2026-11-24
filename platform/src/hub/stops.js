// Logique pure du récit d'entrée (Story) : chiffres lus dans public/data/*.json, phrases calculées,
// arrêts caméra pour HubMap, et calcul de la mini-simulation. Aucun JSX ni CSS : testé sous Node
// (tests/story-logic.test.mjs). Une fonction qui n'a pas sa donnée renvoie null : l'interface n'affiche
// alors rien (jamais un 0 ni un chiffre écrit de mémoire). Contrat : docs/HUB_CONTRACT.md, docs/ANZAR_CONTRACT.md.
import { defaultScenario, regionModel, linksFor, splitLinks, regionBalance } from './panel/metrics.js';
import { BAND_CRITICAL_MONTHS, BAND_COMFORT_MONTHS } from '../lib/balance.js';
import { joinDamFill } from './damsData.js';

export { BAND_CRITICAL_MONTHS, BAND_COMFORT_MONTHS };

const nf = (d = 0) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** Nombre en français (espace fine insécable des milliers, virgule décimale) ; '' si absent. */
export const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '' : nf(d).format(v));

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}

const finite = x => typeof x === 'number' && Number.isFinite(x);
const bulletinOf = d => (d?.bulletin?.national ? d.bulletin : null);
const regionName = (d, id) => d?.regions?.regions?.find(r => r.id === id)?.name || id;
const linkList = d => (Array.isArray(d?.links) ? d.links : Array.isArray(d?.links?.links) ? d.links.links : null);

// ---------------------------------------------------------------- Contexte

/** Remplissage national du bulletin et même jour de l'an dernier (dérivé du % de variation imprimé). */
export function nationalFacts(d) {
  const b = bulletinOf(d);
  const n = b?.national;
  if (!finite(n?.fillPct)) return null;
  return {
    date: b.date || null,
    fillPct: n.fillPct,
    storedMm3: finite(n.storedMm3) ? n.storedMm3 : null,
    capacityMm3: finite(n.capacityMm3) ? n.capacityMm3 : null,
    lastYearPct: finite(n.sameDay2025Pct) ? n.sameDay2025Pct : null,
    lastYearNote: n.sameDay2025Note || null,
    ratio: finite(n.sameDay2025Pct) && n.sameDay2025Pct > 0 ? n.fillPct / n.sameDay2025Pct : null,
  };
}

// ---------------------------------------------------------------- Problématique

/** Bassins du bulletin triés du plus bas au plus haut remplissage, avec extrêmes. */
export function basinSpread(d) {
  const bs = bulletinOf(d)?.basins;
  if (!Array.isArray(bs)) return null;
  const rows = bs.filter(b => finite(b.fillPct)).map(b => ({ name: b.name, fillPct: b.fillPct, storedMm3: b.storedMm3 ?? null }));
  if (rows.length < 2) return null;
  rows.sort((a, b) => a.fillPct - b.fillPct);
  return { rows, lo: rows[0], hi: rows[rows.length - 1] };
}

/** Part de l'agriculture dans la demande nationale (water-balance.json, sectorGuide, sourcé). */
export function demandFacts(d) {
  const g = d?.balance?.sectorGuide;
  const agri = g?.agriculture2020Mm3, total = g?.demand2020Mm3;
  if (!finite(agri?.value) || !finite(total?.value) || total.value <= 0) return null;
  const share = finite(agri.sharePct) ? agri.sharePct : (agri.value / total.value) * 100;
  return {
    agriSharePct: share,
    totalMm3: total.value,
    year: 2020,
    source: agri.source || total.source || null,
    date: agri.date || total.date || null,
    status: agri.status === 'sourced' && total.status === 'sourced' ? 'sourced' : 'derived',
  };
}

/** Régions sans bassin de barrage (basinShares vide) : le « Sud » du récit, lu dans water-balance.json. */
export function southRegionIds(d) {
  const rs = d?.balance?.regions;
  if (!Array.isArray(rs)) return [];
  return rs.filter(r => Array.isArray(r.basinShares) && r.basinShares.length === 0).map(r => r.id);
}

/**
 * Phrase calculée sur les liaisons physiques documentées (water-links.json) vers le Sud.
 * null si water-links.json est absent ou si aucune région du Sud n'est identifiée : on n'affirme rien.
 */
export function southLinks(d) {
  const ids = southRegionIds(d);
  const all = linkList(d);
  if (!all || !ids.length) return null;
  const physical = [], projects = [];
  for (const id of ids) {
    const s = splitLinks(linksFor(d, id));
    for (const l of s.physical) if (!physical.includes(l)) physical.push(l);
    for (const l of s.projects) if (!projects.includes(l)) projects.push(l);
  }
  const names = ids.map(id => regionName(d, id));
  const who = names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0];
  const sentence = physical.length === 0
    ? 'Aucune liaison physique documentée vers ' + who + '.'
    : physical.length + (physical.length > 1 ? ' liaisons physiques documentées' : ' liaison physique documentée') + ' vers ' + who + '.';
  return { ids, names, physicalCount: physical.length, projectCount: projects.length, sentence };
}

/** Plus grande capacité de dessalement d'une région du Sud (water-balance.json), avec son statut. */
export function southDesal(d) {
  const ids = southRegionIds(d);
  const best = (d?.balance?.regions || [])
    .filter(r => ids.includes(r.id))
    .map(r => ({ id: r.id, c: r.desalination?.capacityMm3PerYear }))
    .filter(x => finite(x.c?.value) && x.c.value > 1)
    .sort((a, b) => b.c.value - a.c.value)[0];
  if (!best) return null;
  const city = (d?.balance?.regions || []).find(r => r.id === best.id)?.fluxContext?.desalShareOfCityPotable;
  return {
    cityShare: finite(city?.value) ? { pct: city.value * 100, status: city.status || 'hypothese', source: city.source || null, date: city.date || null, note: city.note || null } : null,
    regionId: best.id, regionName: regionName(d, best.id), valueMm3: best.c.value,
    status: best.c.status || 'hypothese', source: best.c.source || null, date: best.c.date || null, dataYear: best.c.dataYear ?? null,
  };
}

/** Projection CMIP6 (climate-outlook.json) : bassins où la médiane des modèles projette moins de pluie. */
export function climateFacts(d) {
  const c = d?.climate;
  const bs = c?.basins;
  if (!bs) return null;
  const rows = Object.entries(bs).map(([name, b]) => ({ name, ...b?.summary })).filter(r => finite(r.medianPct));
  if (!rows.length) return null;
  const drier = rows.filter(r => r.medianPct < 0);
  const wetter = rows.filter(r => r.medianPct >= 0);
  return {
    drier: drier.length, total: rows.length,
    exceptions: wetter.map(r => ({ name: r.name, medianPct: r.medianPct, nModels: r.nModels ?? null })),
    projection: c.periods?.projection || null, reference: c.periods?.reference || null,
    source: c.sourceDoc || c.source || null, fetchedAt: c.fetchedAt || null,
  };
}

// ---------------------------------------------------------------- Barrages

/** Comptes de barrages : lus au bulletin (dam-fill.json) et localisés sur la carte (national-dams.json). Deux choses distinctes. */
export function damCounts(d, damFill) {
  const fillDams = Array.isArray(damFill?.dams) ? damFill.dams : null;
  const located = Array.isArray(d?.dams) ? d.dams : Array.isArray(d?.dams?.dams) ? d.dams.dams : null;
  // Barrages du bulletin dont la ligne est posée sans ambiguïté sur un point de la carte (même jointure que la carte).
  let matchedCount = null;
  let placedCount = null;
  if (fillDams && located) {
    const j = joinDamFill(d.dams, damFill, d.region || null);
    matchedCount = Math.max(0, fillDams.length - j.unmatchedFill.length);
    placedCount = j.located.length;
  }
  return {
    readCount: fillDams ? fillDams.length : null,
    readDate: damFill?.date || null,
    readSource: damFill?.sourceUrl || null,
    locatedCount: located ? located.filter(x => finite(x?.lat) && finite(x?.lon)).length : null,
    matchedCount,
    placedCount,
  };
}

// ---------------------------------------------------------------- Chiffres

/** Tuiles de la section « En chiffres » : chaque chiffre n'apparaît qu'ici. */
export function keyFigures(d) {
  const n = nationalFacts(d);
  const dem = demandFacts(d);
  const spread = basinSpread(d);
  const out = [];
  if (n?.storedMm3 != null) out.push({ id: 'stock', value: n.storedMm3, decimals: 0, unit: 'Mm³', label: 'dans les barrages', status: 'sourced', bulletin: true, note: 'Bulletin du ' + frDate(n.date) });
  if (n?.capacityMm3 != null) out.push({ id: 'capacite', value: n.capacityMm3, decimals: 0, unit: 'Mm³', label: 'de capacité totale', status: 'sourced', bulletin: true, note: 'Bulletin du ' + frDate(n.date) });
  if (dem) out.push({ id: 'demande', value: dem.totalMm3, decimals: 0, unit: 'Mm³/an', label: 'de demande (' + dem.year + ')', status: dem.status, note: 'IRES 2022, Département de l’Eau' , source: dem.source });
  if (spread) out.push({ id: 'bassins', value: spread.rows.length, decimals: 0, unit: '', label: 'grands bassins suivis', status: 'sourced', bulletin: true, note: 'Bulletin du ' + frDate(bulletinOf(d)?.date) });
  return out;
}

// ---------------------------------------------------------------- Mini-simulation

/**
 * Mini-tableau de bord : même calcul que le panneau (panel/metrics.js regionModel, donc src/lib/balance.js).
 * Régions à barrages : mois de réserve. Régions sans barrage rattaché : part du potable couverte par le dessalement
 * (indicateur de flux), jamais des mois. null si la région ou le bulletin manque.
 */
export function miniSim(d, regionId, { savingsPct = 0, desalMm3 = 0 } = {}) {
  if (!regionBalance(d, regionId) || !d?.bulletin) return null;
  const base = defaultScenario(d, regionId);
  const now = regionModel(d, regionId, base);
  const next = regionModel(d, regionId, { ...base, demandReductionPct: savingsPct, addedDesalMm3: desalMm3 });
  if (!now || !next) return null;
  if (next.noStock) {
    const pct = next.fluxNow?.coveragePct, basePct = now.fluxNow?.coveragePct;
    if (!finite(pct)) return null;
    return { kind: 'flux', value: pct, base: finite(basePct) ? basePct : null, delta: finite(basePct) ? pct - basePct : null, band: next.fluxNow?.band ?? null, capped: finite(next.fluxNow?.ratio) && next.fluxNow.ratio >= 1 };
  }
  const m = next.monthsNow, b = now.monthsNow;
  if (!finite(m)) return null;
  return { kind: 'months', value: m, base: finite(b) ? b : null, delta: finite(b) ? m - b : null, band: next.bandNow };
}

// ---------------------------------------------------------------- Caméra

/** Centre approximatif (moyenne des sommets de l'anneau extérieur) d'une région du GeoJSON, ou null. */
export function regionCenter(d, regionId) {
  const f = d?.geo?.features?.find(x => x?.properties?.id === regionId);
  const g = f?.geometry;
  if (!g) return null;
  const ring = g.type === 'Polygon' ? g.coordinates?.[0] : g.type === 'MultiPolygon'
    ? [...g.coordinates].sort((a, b) => (b[0]?.length || 0) - (a[0]?.length || 0))[0]?.[0] : null;
  if (!Array.isArray(ring) || !ring.length) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2], span: Math.max(x1 - x0, y1 - y0) };
}

/** Arrêt caméra sur une région (mini-simulation). */
export function regionStop(d, regionId) {
  const c = regionCenter(d, regionId);
  if (!c) return null;
  const zoom = Math.max(4.6, Math.min(7.4, 8.6 - Math.log2(Math.max(0.5, c.span)) * 1.1));
  return { id: 'region:' + regionId, center: c.center, zoom, pitch: 55, bearing: -12, duration: 2600, highlightRegionIds: [regionId] };
}

/**
 * Étapes du récit, dans l'ordre CONTEXTE → PROBLÉMATIQUE → BARRAGES → CHIFFRES → ESSAYEZ.
 * Chaque étape est aussi un arrêt caméra pour HubMap.flyToStop : { center, zoom, pitch, bearing, duration, highlightRegionIds }.
 * Indications lues par HubMap.flyToStop (ignorées par une carte qui ne les connaît pas) : revealDams (apparition des
 * barrages un à un), flyAlongAtlas (survol du relief de l'Atlas), orbit { degreesPerSec, maxSeconds } (rotation lente
 * après le vol, arrêtée par toute interaction).
 */
export const CHAPTERS = [
  { id: 'contexte', label: 'Contexte' },
  { id: 'probleme', label: 'Problématique' },
  { id: 'barrages', label: 'Barrages' },
  { id: 'chiffres', label: 'Chiffres' },
  { id: 'essayez', label: 'Essayez' },
];

export const STORY_STOPS = [
  { id: 'hero', chapter: null, label: 'Anzar', center: [-7.4, 30.4], zoom: 4.9, pitch: 52, bearing: -14, duration: 2600, highlightRegionIds: [], orbit: { degreesPerSec: 1.2, maxSeconds: 40 } },
  { id: 'contexte', chapter: 'contexte', label: 'Rare et irrégulière', center: [-6.6, 32.0], zoom: 5.3, pitch: 50, bearing: -18, duration: 3000, highlightRegionIds: [] },
  { id: 'ecarts', chapter: 'probleme', label: 'Écarts entre bassins', center: [-7.0, 31.4], zoom: 5.4, pitch: 46, bearing: 6, duration: 3000, highlightRegionIds: [] },
  { id: 'demande', chapter: 'probleme', label: 'Qui consomme', center: [-8.2, 32.3], zoom: 6.2, pitch: 58, bearing: -24, duration: 3000, highlightRegionIds: ['casablanca-settat', 'marrakech-safi', 'beni-mellal-khenifra'] },
  { id: 'sud', chapter: 'probleme', label: 'Le Sud', center: [-13.4, 25.8], zoom: 4.9, pitch: 50, bearing: 16, duration: 3400, highlightRegionIds: ['laayoune-sakia-el-hamra', 'dakhla-oued-ed-dahab'] },
  { id: 'climat', chapter: 'probleme', label: 'Le climat', center: [-7.0, 31.0], zoom: 4.8, pitch: 34, bearing: 0, duration: 3000, highlightRegionIds: [] },
  { id: 'barrages', chapter: 'barrages', label: 'Où sont les barrages', center: [-6.4, 31.9], zoom: 6.5, pitch: 64, bearing: 24, duration: 3600, highlightRegionIds: [], revealDams: true, flyAlongAtlas: true, orbit: { degreesPerSec: 2, maxSeconds: 30 } },
  { id: 'chiffres', chapter: 'chiffres', label: 'En chiffres', center: [-7.0, 31.6], zoom: 5.1, pitch: 40, bearing: -8, duration: 3000, highlightRegionIds: [] },
  { id: 'essayez', chapter: 'essayez', label: 'Essayez', center: [-8.9, 30.3], zoom: 6.2, pitch: 55, bearing: -15, duration: 3000, highlightRegionIds: ['souss-massa'] },
];
