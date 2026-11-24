// Calculs du panneau : fonctions pures, sans React ni DOM (testées sous Node).
// Tout vient de src/lib/balance.js, utilisé tel quel. Rappel d'honnêteté : scénarios et ordres de grandeur,
// pas des prédictions ; eaux souterraines non modélisées ; aucun volume n'est déplacé entre régions.
import * as B from '../../lib/balance.js';

export const START_YEAR = 2026;
export const HORIZON_YEARS = 10;
export const HYDRO = [
  { id: 'dry', label: 'Sec' },
  { id: 'normal', label: 'Normal' },
  { id: 'wet', label: 'Humide' },
];

/** Appelle une fonction de balance.js sans jamais faire tomber l'interface. */
const safe = (fn, ...args) => { try { return typeof fn === 'function' ? fn(...args) : undefined; } catch { return undefined; } };
const valOf = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);
const finite = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);

export const balancesOf = data => (Array.isArray(data?.balance?.regions) ? data.balance.regions : []);
export const regionBalance = (data, regionId) => balancesOf(data).find(r => r.id === regionId) ?? null;
export const regionName = (data, id) => data?.regions?.regions?.find(r => r.id === id)?.name ?? id;

/** Bassins du fichier water-balance.json rattachés à une région. */
export function basinsOf(data, rb) {
  const names = new Set((rb?.basinShares ?? []).map(s => s.basin));
  return (data?.balance?.basins ?? []).filter(b => names.has(b.name));
}

export const mainBasinOf = rb => [...(rb?.basinShares ?? [])].sort((a, b) => (b.share || 0) - (a.share || 0))[0]?.basin ?? null;

/** Résumé CMIP6 du bassin principal (médiane, fourchette), ou null. Projection modélisée, pas une prévision. */
export function climateSummary(data, rb) {
  const s = data?.climate?.basins?.[mainBasinOf(rb)]?.summary;
  return s && [s.medianPct, s.minPct, s.maxPct].every(Number.isFinite) ? { ...s, basin: mainBasinOf(rb) } : null;
}

export const growthOf = rb => finite(valOf(rb?.popGrowthPctYr)) ?? 0;

/** Scénario par défaut d'une région : mêmes champs que BalancePage (hydrologie normale, aucun levier, pluie = médiane CMIP6). */
export function defaultScenario(data, regionId) {
  const rb = regionBalance(data, regionId);
  return {
    regionId,
    hydrology: 'normal',
    popGrowth: growthOf(rb),
    demandReductionPct: 0,
    addedDesalMm3: 0,
    reusePct: 0,
    rainChangePct: finite(climateSummary(data, rb)?.medianPct) ?? 0,
    year: START_YEAR,
  };
}

/** Hypothèses de balance.js pour une région : pop et pluie du scénario ne valent que pour sa région (scenario.regionId). */
function assumptionsFor(data, rb, sc, { year, hydrology } = {}) {
  const own = sc.regionId === rb.id; // sans regionId : aucune valeur de curseur population/pluie n'est appliquée à une région
  return {
    hydrology: hydrology ?? sc.hydrology ?? 'normal',
    year: year ?? sc.year ?? START_YEAR,
    startYear: START_YEAR,
    popGrowth: own ? (finite(sc.popGrowth) ?? growthOf(rb)) : growthOf(rb),
    demandReductionPct: sc.demandReductionPct ?? 0,
    addedDesalMm3: sc.addedDesalMm3 ?? 0,
    reusePct: sc.reusePct ?? 0,
    rainChangePct: own ? (finite(sc.rainChangePct) ?? 0) : (finite(climateSummary(data, rb)?.medianPct) ?? 0),
  };
}

/** Série annuelle simulée (10 ans) pour une région et une hydrologie. */
export function simulateRegion(data, rb, sc, hydrology) {
  const a = assumptionsFor(data, rb, sc, { hydrology });
  return safe(B.simulate, rb, data.bulletin, basinsOf(data, rb), { ...a, startYear: START_YEAR }, HORIZON_YEARS) || [];
}

/**
 * Valeur carte par région : { [id]: { value, band, label, kind? } } (forme de BalancePage).
 * tab 'today' : couverture du jour (année de départ, sans simulation) ; 'tomorrow' / 'together' : année et hydrologie du scénario.
 * Régions sans barrage rattaché : indicateur de flux (kind 'flux'), jamais des mois de réserve.
 */
export function computeMetricByRegion({ data, scenario, tab = 'today' } = {}) {
  const out = {};
  if (!data?.bulletin) return out;
  const sc = scenario ?? {};
  const today = tab === 'today';
  for (const rb of balancesOf(data)) {
    const a = assumptionsFor(data, rb, sc, today ? { year: START_YEAR } : {});
    if (!safe(B.basinStockForRegion, rb, data.bulletin)?.hasStock) {
      out[rb.id] = safe(B.fluxMetric, rb, a) || { value: null };
      continue;
    }
    let months = null;
    if (today) months = safe(B.coverage, rb, data.bulletin, { ...a, year: START_YEAR })?.monthsOfCoverage;
    else {
      const sim = simulateRegion(data, rb, sc);
      months = (sim.find(p => p.year === a.year) ?? sim[0])?.monthsOfCoverage;
    }
    out[rb.id] = Number.isFinite(months)
      ? { value: months, band: safe(B.bandFor, months), label: months.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' mois' }
      : { value: null };
  }
  return out;
}

/** Tout ce que les onglets affichent pour une région, calculé en une passe (à mettre dans un useMemo). */
export function regionModel(data, regionId, scenario) {
  const rb = regionBalance(data, regionId);
  if (!rb || !data?.bulletin) return null;
  const sc = scenario ?? defaultScenario(data, regionId);
  const year = sc.year ?? START_YEAR;
  const stock = safe(B.basinStockForRegion, rb, data.bulletin);
  const noStock = !stock?.hasStock;
  const now = assumptionsFor(data, rb, sc, { year: START_YEAR });
  const atYear = assumptionsFor(data, rb, sc, { year });
  const coverNow = safe(B.coverage, rb, data.bulletin, now);
  const series = noStock ? {} : Object.fromEntries(HYDRO.map(h => [h.id, simulateRegion(data, rb, sc, h.id)]));
  const cur = series[sc.hydrology ?? 'normal'] ?? [];
  const point = cur.find(p => p.year === year) ?? null;
  const depletionYear = noStock ? null : B.depletionYearOf(cur);
  const demandNow = safe(B.annualDemand, rb, { year: START_YEAR, popGrowth: now.popGrowth });
  return {
    rb, sc, year, stock, noStock,
    coverNow, monthsNow: finite(coverNow?.monthsOfCoverage), bandNow: coverNow?.band ?? null,
    fluxNow: noStock ? safe(B.desalFlux, rb, now) : null,
    fluxAtYear: noStock ? safe(B.desalFlux, rb, atYear) : null,
    demandNow, series, point, depletionYear,
    monthsAtYear: finite(point?.monthsOfCoverage),
    bandAtYear: point?.band ?? null,
    capacityMm3: stock?.capacityMm3 ?? null,
    climate: climateSummary(data, rb),
  };
}

/** Classement (mois du jour, épuisement à 10 ans) selon hypothèses et hydrologie courantes. */
export function rankingFor(data, scenario) {
  if (!data?.bulletin) return [];
  const sc = scenario ?? {};
  const assumptions = { year: START_YEAR, demandReductionPct: sc.demandReductionPct ?? 0, addedDesalMm3: sc.addedDesalMm3 ?? 0, reusePct: sc.reusePct ?? 0 };
  const r = safe(B.rankingOutlook, balancesOf(data), data.bulletin, data.balance?.basins, {
    assumptions,
    scenarioFor: rb => assumptionsFor(data, rb, sc),
    years: HORIZON_YEARS,
  });
  return Array.isArray(r) ? r : [];
}

/** Leviers (sensibilité, hypothèses) d'une région, triés du plus au moins efficace ; [] si non calculables. */
export function leversFor(data, regionId, scenario) {
  const rb = regionBalance(data, regionId);
  if (!rb || !data?.bulletin) return [];
  const sc = scenario ?? {};
  const base = { year: START_YEAR, demandReductionPct: sc.demandReductionPct ?? 0, addedDesalMm3: sc.addedDesalMm3 ?? 0, reusePct: sc.reusePct ?? 0 };
  const l = safe(B.levers, rb, data.bulletin, base) || [];
  return l.filter(x => typeof x.deltaMonths === 'number').sort((x, y) => y.deltaMonths - x.deltaMonths);
}

/** Liaisons documentées d'une région (water-links.json). Aucun volume transférable n'en est tiré. */
export function linksFor(data, regionId) {
  const list = Array.isArray(data?.links) ? data.links : Array.isArray(data?.links?.links) ? data.links.links : [];
  return list.filter(l => Array.isArray(l.regionIds) && l.regionIds.includes(regionId));
}

export const STATUS_ORDER = { 'en service': 0, 'en construction': 1, 'planifié': 2 };
export const sortLinks = links => [...links].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

/** Projets sourcés d'une région (water-balance.json). */
export const projectsFor = (data, regionId) => (data?.balance?.projects ?? []).filter(p => (p.regionIds ?? []).includes(regionId));

/** Types de liaison qui relient physiquement deux ouvrages ; « projet » (dessalement, périmètre) n'en est pas une. */
export const PHYSICAL_KINDS = ['transfert-inter-bassins', 'adduction', 'cascade'];

/** Sépare les entrées de water-links.json : liaisons physiques documentées / projets associés. */
export function splitLinks(links) {
  const sorted = sortLinks(links);
  return { physical: sorted.filter(l => PHYSICAL_KINDS.includes(l.kind)), projects: sorted.filter(l => !PHYSICAL_KINDS.includes(l.kind)) };
}

/** Marche de l'indicateur de flux (bands.js FLUX_STEPS) pour un ratio non borné dessalement ÷ potable. */
export const fluxStepOf = ratio => (!Number.isFinite(ratio) ? null : ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3);

/** Pourcentage lisible : « < 1 » plutôt que « 0 » pour une valeur positive très faible. */
export const pctText = v => (typeof v !== 'number' || !Number.isFinite(v) ? '—' : v > 0 && v < 1 ? '< 1' : fmt(v, 0));

export const NO_LINK_MESSAGE = 'Aucune liaison physique documentée vers cette région : elle dépend du dessalement et des nappes (non modélisées).';

export const fmt = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
export const signed = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d) : '—');
