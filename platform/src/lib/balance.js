// Moteur de bilan hydrique d'Anzar. Fonctions pures, sans dépendance ni React.
// Rappel d'honnêteté : ce sont des ordres de grandeur dérivés de données publiques datées et
// d'hypothèses affichées. Ce n'est ni un relevé, ni une prédiction. Les eaux souterraines ne
// sont pas modélisées. Aucune fonction ici ne déplace de volume d'une région à une autre.

// ---------- Constantes (toutes des hypothèses, à afficher dans l'interface) ----------

/** Part de la demande servie par l'eau de surface (barrages) ; le reste vient des nappes, non modélisées.
 *  Hypothèse de travail, valeur unique pour toutes les régions : 0,6. */
export const SURFACE_SHARE = 0.6;

/** Évaporation annuelle des retenues, en fraction du stock d'ouverture. Hypothèse : 6 %/an
 *  (ordre de grandeur pour des retenues semi-arides ; l'évaporation réelle dépend de la surface du plan d'eau). */
export const EVAPORATION_RATE = 0.06;

/** Taux d'utilisation du dessalement existant (capacité nominale x taux). Hypothèse : 0,8. */
export const DESAL_UTILISATION = 0.8;

/** Horizon (années) sur lequel le dessalement est ajouté au stock dans la métrique de couverture. */
export const DESAL_HORIZON_YEARS = 1;

/** Bornes de bande, en mois de couverture. Hypothèses de lecture, pas des seuils réglementaires :
 *  - critique   : moins de 6 mois, soit moins d'un demi-cycle annuel sans apport ;
 *  - tendu      : de 6 à 18 mois inclus ;
 *  - confortable: plus de 18 mois, soit plus d'une année de demande de surface avec marge pour une année sèche. */
export const BAND_CRITICAL_MONTHS = 6;
export const BAND_COMFORT_MONTHS = 18;

/** Valeurs des leviers de levers() : toutes des hypothèses de sensibilité, pas des projets. */
export const LEVER_SAVINGS_PCT = 10;
export const LEVER_REUSE_PCT = 20;
export const LEVER_DESAL_MM3 = 10;
export const LEVER_LEAK_POINTS = 5;

const CAVEAT_GROUNDWATER = 'eaux souterraines non modélisées';
const CAVEAT_BASIN = 'attribution de bassin approximative (parts indicatives)';
const CAVEAT_SHARE = `part de la demande servie par la surface fixée à ${SURFACE_SHARE * 100} % (hypothèse)`;
const CAVEAT_INFLOW = 'apports futurs hors métrique de couverture';

/** Critères de tension affichés par l'interface (hypothèses de lecture, pas des seuils réglementaires). */
export const TENSION_CRITERIA = [
  `moins de ${BAND_COMFORT_MONTHS} mois de couverture aujourd’hui (stock de surface + dessalement)`,
  'épuisement du stock de surface dans les 10 ans du scénario courant',
  'pas de stock de surface et dessalement inférieur à 100 % de la demande potable',
];

/** Note de calage des facteurs hydrologiques selon le signe de la variation de pluie du scénario (pct, en %). */
export function calibrationNote(pct) {
  const base = 'facteurs d’hypothèse choisis à l’œil, à pluie inchangée, pour que le scénario normal de Souss-Massa reste proche du stock actuel ; non validés, pas une validation.';
  if (!pct) return base;
  return pct < 0
    ? base + ` Avec une pluie de ${pct} % (élasticité 2, apport × ${rainMultiplier(pct).toFixed(2)}), le calage ne vaut plus et le dessèchement est en partie compté deux fois (facteur « normal » déjà calé sur la décennie récente, plus variation CMIP6). Non recalé.`
    : base + ` Une pluie de +${pct} % relève les apports (× ${rainMultiplier(pct).toFixed(2)}) et compense en partie le facteur « normal » calé sur la décennie récente : le calage ne vaut plus pour ce réglage. Non recalé.`;
}
const CALIBRATION_GENERIC = 'calage valable à pluie inchangée seulement ; avec le curseur CMIP6 par défaut, une variation négative fait compter le dessèchement en partie deux fois (facteur « normal » déjà calé sur la décennie récente), une variation positive le compense en partie. Non recalé.';

/** Incertitudes attachées aux parts de bassin (champ note du JSON), à afficher avec les mises en garde. */
const shareNotes = rb => (Array.isArray(rb?.basinShares) ? rb.basinShares : []).filter(s => typeof s.note === 'string' && s.note).map(s => `part du bassin ${s.basin} : ${s.note}`);

// ---------- Utilitaires ----------

const val = x => (x && typeof x === 'object' && 'value' in x ? x.value : x ?? null);
const num = x => { const n = val(x); return typeof n === 'number' && Number.isFinite(n) ? n : null; };
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function bandFor(months) {
  if (months == null || !Number.isFinite(months)) return null;
  if (months < BAND_CRITICAL_MONTHS) return 'critique';
  if (months > BAND_COMFORT_MONTHS) return 'confortable';
  return 'tendu';
}

// ---------- Stock ----------

/** Stock de surface attribué à la région : somme des parts de chaque bassin x stock du bassin. */
export function basinStockForRegion(rb, bulletin) {
  const shares = Array.isArray(rb?.basinShares) ? rb.basinShares : [];
  const basins = bulletin?.basins ?? [];
  let storedMm3 = 0, capacityMm3 = 0, matched = 0;
  const missingBasins = [];
  for (const s of shares) {
    const share = num(s.share);
    const b = basins.find(x => x.name === s.basin);
    if (!b || share == null || share <= 0) { if (!b) missingBasins.push(s.basin); continue; }
    storedMm3 += share * b.storedMm3;
    capacityMm3 += share * b.capacityMm3;
    matched++;
  }
  const hasStock = matched > 0 && capacityMm3 > 0;
  return {
    storedMm3: hasStock ? storedMm3 : 0,
    capacityMm3: hasStock ? capacityMm3 : 0,
    fillPct: hasStock ? (storedMm3 / capacityMm3) * 100 : null,
    hasStock,
    missingBasins,
  };
}

// ---------- Demande ----------

/** Demande annuelle en Mm³/an. Domestique = pop x l/hab/j x 365 / 1e9 x (1 + pertes).
 *  Une composante inconnue (null) compte 0 et est signalée dans missing. Ordre de grandeur, pas un relevé. */
export function annualDemand(rb, { year, popGrowth, demandFactor = 1 } = {}) {
  const missing = [];
  const pop0 = num(rb?.population);
  const popYear = rb?.population?.year ?? null;
  const g = (popGrowth ?? num(rb?.popGrowthPctYr) ?? 0) / 100;
  const dt = year != null && popYear != null ? year - popYear : 0;
  const pop = pop0 == null ? null : pop0 * Math.pow(1 + g, dt);
  const lpcd = num(rb?.domestic?.lPerCapitaDay);
  const loss = (num(rb?.domestic?.lossRatePct) ?? 0) / 100;
  let domestic = 0;
  if (pop == null || lpcd == null) missing.push('domestique'); else domestic = (pop * lpcd * 365) / 1e9 * (1 + loss);
  const ha = num(rb?.agriculture?.irrigatedHa), m3 = num(rb?.agriculture?.m3PerHa);
  let agri = 0;
  if (ha == null || m3 == null) missing.push('agriculture'); else agri = (ha * m3) / 1e6;
  let ind = num(rb?.industry?.mm3PerYear);
  if (ind == null) { missing.push('industrie'); ind = 0; }
  const f = Math.max(0, demandFactor);
  const domesticMm3 = domestic * f, agricultureMm3 = agri * f, industryMm3 = ind * f;
  return {
    domesticMm3, agricultureMm3, industryMm3,
    totalMm3: domesticMm3 + agricultureMm3 + industryMm3,
    // « potable » = demande domestique (pertes incluses) ; l'industrie est supposée hors réseau potable (hypothèse)
    potableMm3: domesticMm3,
    missing,
  };
}

/** Demande nette après économies et réutilisation.
 *  demandReductionPct réduit tout ; reusePct remplace une part de la demande agricole par des eaux usées traitées
 *  (plafonnée au volume traité si connu). */
function effectiveDemand(rb, a = {}) {
  const factor = 1 - clamp(a.demandReductionPct ?? 0, 0, 100) / 100;
  const base = annualDemand(rb, { year: a.year, popGrowth: a.popGrowth, demandFactor: (a.demandFactor ?? 1) * factor });
  const treated = num(rb?.reuse?.treatedWastewaterMm3PerYear);
  const want = base.agricultureMm3 * clamp(a.reusePct ?? 0, 0, 100) / 100;
  const reuseMm3 = treated == null ? want : Math.min(want, treated);
  const totalMm3 = Math.max(0, base.totalMm3 - reuseMm3);
  return { ...base, totalMm3, reuseMm3, reuseUncapped: treated == null && want > 0 };
}

function desalMm3(rb, added = 0) {
  const cap = num(rb?.desalination?.capacityMm3PerYear) ?? 0;
  return cap * DESAL_UTILISATION + Math.max(0, added ?? 0);
}

/** Capacité de dessalement affectée au potable (Mm³/an) : byUse.potable si connue, sinon capacité totale (repli). */
function potableCapacityMm3(rb) {
  const cap = rb?.desalination?.capacityMm3PerYear;
  return num(cap?.byUse?.potableMm3PerYear) ?? num(cap) ?? 0;
}

/** Production potable dessalée (Mm³/an) = capacité potable x utilisation + ajout éventuel (curseur). */
function potableDesalMm3(rb, added = 0) {
  return potableCapacityMm3(rb) * DESAL_UTILISATION + Math.max(0, added ?? 0);
}

function monthsOf(stored, desal, annualSurfaceDemand, horizon = DESAL_HORIZON_YEARS) {
  if (!(annualSurfaceDemand > 0)) return null;
  return (stored + desal * horizon) / (annualSurfaceDemand / 12);
}

// ---------- Couverture ----------

/** Mois de couverture = (stock de surface alloué + dessalement x horizon) / demande mensuelle servie par la surface.
 *  Variante potable : même numérateur, demande potable seule (stock supposé entièrement réservé au potable : borne haute).
 *  Eaux souterraines et apports futurs hors métrique. null si pas de stock de surface ou pas de demande. */
export function coverage(rb, bulletin, assumptions = {}) {
  const a = assumptions;
  const stock = basinStockForRegion(rb, bulletin);
  const dem = effectiveDemand(rb, a);
  const desal = desalMm3(rb, a.addedDesalMm3);
  const horizon = a.horizonYears ?? DESAL_HORIZON_YEARS;
  const surfaceDemand = dem.totalMm3 * SURFACE_SHARE;
  const potableSurface = dem.potableMm3 * SURFACE_SHARE;
  const caveats = [CAVEAT_GROUNDWATER, CAVEAT_BASIN, CAVEAT_SHARE, CAVEAT_INFLOW, ...shareNotes(rb)];
  if (dem.missing.length) caveats.push(`composante de demande manquante, comptée à 0 : ${dem.missing.join(', ')}`);
  if (dem.reuseUncapped) caveats.push('volume d’eaux usées traitées inconnu : réutilisation non plafonnée');
  if (stock.missingBasins.length) caveats.push(`bassin absent du bulletin : ${stock.missingBasins.join(', ')}`);
  const desalCoverageOfPotable = dem.potableMm3 > 0 ? clamp(potableDesalMm3(rb, a.addedDesalMm3) / dem.potableMm3, 0, 1) : null;
  caveats.push(`capacité de dessalement ÷ demande potable : borné à 100 %, utilisation ${DESAL_UTILISATION * 100} % et consommation par habitant en hypothèse`);
  let monthsOfCoverage = null, monthsPotable = null;
  if (!stock.hasStock) {
    caveats.push('pas de stock de surface attribué à cette région (aucun barrage rattaché) : couverture non calculée');
  } else if (!(surfaceDemand > 0)) {
    caveats.push('demande de surface nulle ou inconnue : couverture non calculée');
  } else {
    monthsOfCoverage = monthsOf(stock.storedMm3, desal, surfaceDemand, horizon);
    monthsPotable = monthsOf(stock.storedMm3, desal, potableSurface, horizon);
  }
  return {
    monthsOfCoverage,
    monthsPotable,
    desalCoverageOfPotable,
    band: bandFor(monthsOfCoverage),
    components: {
      storedMm3: stock.storedMm3,
      capacityMm3: stock.capacityMm3,
      fillPct: stock.fillPct,
      desalMm3: desal,
      horizonYears: horizon,
      demandMm3: dem.totalMm3,
      potableDemandMm3: dem.potableMm3,
      surfaceShare: SURFACE_SHARE,
      surfaceDemandMm3: surfaceDemand,
      monthlySurfaceDemandMm3: surfaceDemand / 12,
      reuseMm3: dem.reuseMm3,
    },
    caveats,
  };
}

// ---------- Simulation ----------

/** Scénario annuel (non une prédiction). stock' = clamp(stock + apport x facteur x part - prélèvement de surface - évaporation, 0, capacité).
 *  Prélèvement de surface = max(0, demande x SURFACE_SHARE - dessalement). Renvoie une ligne par année (stock de fin d'année). */
/** Part de l’écoulement moyen d’un bassin effectivement interceptée par les retenues (hypothèse : l’écoulement publié inclut des cours d’eau non régulés et des pertes à la mer). */
export const DAM_CAPTURE_SHARE = 0.35;

/** Facteurs appliqués à l’écoulement moyen publié (Plan Bleu 2011, moyenne longue). Hypothèse : la décennie récente est nettement plus sèche que cette moyenne. Remplace les facteurs du fichier de données. */
export const HYDRO_FACTOR = { dry: 0.25, normal: 0.6, wet: 1.2 };

/** Élasticité ruissellement/pluie (hypothèse non sourcée) : une variation de x % de la pluie fait varier l’apport de 2x %.
 *  Ordre de grandeur plausible en climat semi-aride (le ruissellement varie plus que la pluie), non validé sur ces bassins. */
export const RAIN_TO_RUNOFF_ELASTICITY = 2;

/** Facteur d’apport et part captée pour un bassin et une hydrologie : lus dans le JSON (climateFactor), repli sur les constantes. */
export function hydroParams(basin, hydrology) {
  const cf = basin?.climateFactor;
  const f = typeof cf?.[hydrology] === 'number' ? cf[hydrology] : HYDRO_FACTOR[hydrology];
  const capture = typeof cf?.damCaptureShare === 'number' ? cf.damCaptureShare : DAM_CAPTURE_SHARE;
  return { factor: f, capture, fromFile: typeof cf?.[hydrology] === 'number' };
}

export const DEPLETED_NOTE = 'stock de surface épuisé dans ce scénario : nappes et transferts non modélisés';
export const rainMultiplier = pct => Math.max(0, 1 + (RAIN_TO_RUNOFF_ELASTICITY * (pct ?? 0)) / 100);

export function simulate(rb, bulletin, basin, scenario = {}, years = 10) {
  const sc = { hydrology: 'normal', ...scenario };
  const startYear = sc.startYear ?? rb?.population?.year ?? new Date().getFullYear();
  const stock0 = basinStockForRegion(rb, bulletin);
  const basinsArr = (Array.isArray(basin) ? basin : basin ? [basin] : []);
  const caveats = [CAVEAT_GROUNDWATER, CAVEAT_BASIN, CAVEAT_SHARE, 'scénario, pas une prédiction : apports = moyenne x facteur d’hypothèse', `évaporation fixée à ${EVAPORATION_RATE * 100} %/an du stock (hypothèse)`, ...shareNotes(rb)];
  if (!stock0.hasStock) caveats.push('pas de stock de surface attribué : stock nul, couverture non calculée');
  const rainMult = rainMultiplier(sc.rainChangePct);
  const params = [];
  let inflow = 0;
  for (const b of basinsArr) {
    const share = num((rb?.basinShares ?? []).find(s => s.basin === b.name)?.share) ?? 0;
    const mean = num(b.meanAnnualInflowMm3);
    const { factor: f, capture } = hydroParams(b, sc.hydrology);
    if (mean == null || typeof f !== 'number') { caveats.push(`apport ou facteur climatique inconnu pour ${b.name} : apport compté à 0`); continue; }
    inflow += share * mean * f * capture * rainMult;
    params.push(`${b.name} : facteur ${f} × part captée ${Math.round(capture * 100)} %`);
  }
  if (params.length) caveats.push(`facteur hydrologique « ${sc.hydrology} » et part d’écoulement captée par les retenues (hypothèses non validées) : ${params.join(' ; ')} ; calage : ${calibrationNote(sc.rainChangePct)}`);
  if (sc.rainChangePct) caveats.push(`pluie ${sc.rainChangePct > 0 ? '+' : ''}${sc.rainChangePct} % → apport × ${rainMult.toFixed(2)} (élasticité ${RAIN_TO_RUNOFF_ELASTICITY}, hypothèse non sourcée)`);
  const desal = desalMm3(rb, sc.addedDesalMm3);
  let stock = stock0.storedMm3;
  const cap = stock0.capacityMm3;
  const rows = [];
  for (let i = 0; i < years; i++) {
    const year = startYear + i;
    const dem = effectiveDemand(rb, { year, popGrowth: sc.popGrowth, demandReductionPct: sc.demandReductionPct, reusePct: sc.reusePct });
    const surfaceDemand = dem.totalMm3 * SURFACE_SHARE;
    const withdrawal = Math.max(0, surfaceDemand - desal);
    const evap = stock * EVAPORATION_RATE;
    stock = stock0.hasStock ? clamp(stock + inflow - withdrawal - evap, 0, cap) : 0;
    const months = stock0.hasStock ? monthsOf(stock, desal, surfaceDemand) : null;
    const depleted = stock0.hasStock && stock <= 1e-9;
    rows.push({ year, storedMm3: stock, demandMm3: dem.totalMm3, monthsOfCoverage: months, band: bandFor(months), depleted, caveats: depleted ? [...caveats, DEPLETED_NOTE] : caveats });
  }
  return rows;
}

// ---------- Leviers ----------

/** Effet de sensibilité de quelques leviers sur les mois de couverture. Hypothèses, jamais de transfert entre régions. */
export function levers(rb, bulletin, base = {}) {
  const ref = coverage(rb, bulletin, base).monthsOfCoverage;
  const delta = (a, rbx = rb) => {
    if (ref == null) return null;
    const m = coverage(rbx, bulletin, a).monthsOfCoverage;
    return m == null ? null : m - ref;
  };
  const treated = num(rb?.reuse?.treatedWastewaterMm3PerYear);
  const lossNow = num(rb?.domestic?.lossRatePct);
  const rbLeak = lossNow == null ? rb : { ...rb, domestic: { ...rb.domestic, lossRatePct: { ...rb.domestic.lossRatePct, value: Math.max(0, lossNow - LEVER_LEAK_POINTS) } } };
  return [
    { id: 'economies', label: `Économies d’eau de ${LEVER_SAVINGS_PCT} % sur tous les usages`, kind: 'économie', deltaMonths: delta({ ...base, demandReductionPct: (base.demandReductionPct ?? 0) + LEVER_SAVINGS_PCT }), status: 'hypothese' },
    { id: 'reutilisation', label: `Réutilisation : ${LEVER_REUSE_PCT} % de la demande agricole couverte par des eaux usées traitées`, kind: 'réutilisation', deltaMonths: treated == null ? null : delta({ ...base, reusePct: (base.reusePct ?? 0) + LEVER_REUSE_PCT }), status: 'hypothese', note: treated == null ? 'volume traité inconnu : effet non chiffré' : undefined },
    { id: 'dessalement', label: `Dessalement supplémentaire de ${LEVER_DESAL_MM3} Mm³/an`, kind: 'dessalement', deltaMonths: delta({ ...base, addedDesalMm3: (base.addedDesalMm3 ?? 0) + LEVER_DESAL_MM3 }), status: 'hypothese' },
    { id: 'fuites', label: `Pertes du réseau réduites de ${LEVER_LEAK_POINTS} points`, kind: 'économie', deltaMonths: lossNow == null ? null : delta(base, rbLeak), status: 'hypothese' },
  ].map(l => (l.note === undefined ? (({ note, ...r }) => r)(l) : l));
}

// ---------- Classement et lecture de solidarité ----------

/** Classe les régions par mois de couverture décroissants (rang 1 = mieux dotée). Régions sans valeur : rang null, en fin de liste. */
export function rankRegions(balances, bulletin, assumptions = {}) {
  const rows = (balances ?? []).map(rb => {
    const c = coverage(rb, bulletin, assumptions);
    return { id: rb.id, monthsOfCoverage: c.monthsOfCoverage, band: c.band, rank: null };
  });
  const ok = rows.filter(r => r.monthsOfCoverage != null).sort((x, y) => y.monthsOfCoverage - x.monthsOfCoverage);
  ok.forEach((r, i) => { r.rank = i + 1; });
  return [...ok, ...rows.filter(r => r.monthsOfCoverage == null)];
}

/** Lecture « mieux dotées / sous tension » à titre d'analyse. Pas de volume, pas de flux : pour les régions
 *  sous tension, seuls des leviers (hypothèses de sensibilité) sont listés, du plus au moins efficace. */
export function solidarityView(balances, bulletin, assumptions = {}) {
  const ranked = rankRegions(balances, bulletin, assumptions);
  const byId = new Map((balances ?? []).map(rb => [rb.id, rb]));
  const pick = band => ranked.filter(r => r.band === band).map(({ id, monthsOfCoverage, rank }) => ({ id, monthsOfCoverage, rank }));
  const underPressure = pick('critique').map(r => ({
    ...r,
    levers: levers(byId.get(r.id), bulletin, assumptions).filter(l => l.deltaMonths != null).sort((x, y) => y.deltaMonths - x.deltaMonths).map(({ id, label, deltaMonths, kind, status }) => ({ id, label, deltaMonths, kind, status })),
  }));
  return {
    wellEndowed: pick('confortable'),
    intermediate: pick('tendu'),
    underPressure,
    undetermined: ranked.filter(r => r.band == null).map(r => ({ id: r.id })),
    caveats: [CAVEAT_GROUNDWATER, CAVEAT_BASIN, 'analyse comparative, pas un plan d’approvisionnement : aucun volume n’est déplacé entre régions'],
  };
}

/** Première année d'épuisement du stock de surface dans une simulation, ou null. */
export const depletionYearOf = rows => (Array.isArray(rows) ? rows.find(r => r.depleted)?.year ?? null : null);

/** Classement avec perspective à N ans. Ordre : régions avec stock par mois de couverture décroissants, puis régions sans stock
 *  de surface (rank null, noStock true). Chaque ligne porte l'année d'épuisement issue de simulate() pour le scénario donné
 *  (scenarioFor(rb) -> scénario) et les raisons de tension (TENSION_CRITERIA). Aucun volume n'est déplacé. */
export function rankingOutlook(balances, bulletin, basins, { assumptions = {}, scenarioFor = () => ({}), years = 10 } = {}) {
  const byId = new Map((balances ?? []).map(rb => [rb.id, rb]));
  const allBasins = Array.isArray(basins) ? basins : [];
  return rankRegions(balances, bulletin, assumptions).map(r => {
    const rb = byId.get(r.id);
    const cov = coverage(rb, bulletin, assumptions);
    const noStock = r.monthsOfCoverage == null && !basinStockForRegion(rb, bulletin).hasStock;
    const names = new Set((rb?.basinShares ?? []).map(s => s.basin));
    const sc = scenarioFor(rb) ?? {};
    const sim = noStock ? [] : simulate(rb, bulletin, allBasins.filter(b => names.has(b.name)), sc, years);
    const depletionYear = depletionYearOf(sim);
    const desalCoverage = cov.desalCoverageOfPotable;
    const flux = noStock ? desalFlux(rb, assumptions) : null;
    const reasons = [];
    if (r.monthsOfCoverage != null && r.band !== 'confortable') reasons.push(`${r.band === 'critique' ? 'critique' : 'tendu'} : ${r.monthsOfCoverage.toFixed(1).replace('.', ',')} mois de couverture`);
    if (depletionYear != null) reasons.push(`épuisement du stock de surface en ${depletionYear}`);
    if (noStock && !(desalCoverage != null && desalCoverage >= 1)) reasons.push(`pas de stock de surface, dessalement = ${desalCoverage == null ? 'n/d' : Math.round(desalCoverage * 100) + ' %'} du potable`);
    return {
      ...r, noStock, flux, depletionYear, desalCoverage, hydrology: sc.hydrology ?? 'normal',
      stressed: reasons.length > 0, reasons,
    };
  });
}

// ---------- Indicateur de flux (régions sans barrage rattaché) ----------

/** Bandes de l'indicateur de flux « dessalement ÷ demande potable » (ratio non borné, hypothèses de lecture, pas des seuils
 *  réglementaires). Ce n'est PAS l'échelle des mois de couverture : aucun stock n'est en jeu.
 *  - dominant : le dessalement couvre au moins 80 % du potable estimé ;
 *  - mixte    : de 30 % à 80 % ;
 *  - faible   : moins de 30 % : le reste du potable est supposé venir des nappes et d'autres sources, non modélisées. */
export const FLUX_BAND_DOMINANT = 0.8;
export const FLUX_BAND_MIXED = 0.3;
export const FLUX_LABELS = { dominant: 'Dessalement dominant', mixte: 'Mixte', faible: 'Nappes dominantes' };

export function fluxBandFor(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio >= FLUX_BAND_DOMINANT) return 'dominant';
  if (ratio >= FLUX_BAND_MIXED) return 'mixte';
  return 'faible';
}

const fluxRatio = (producedMm3, potableMm3) => (potableMm3 > 0 ? producedMm3 / potableMm3 : null);

/** Couverture de la demande potable par le dessalement (flux annuel, Mm³/an) :
 *  production = capacité potable x utilisation (DESAL_UTILISATION, hypothèse) + ajout du curseur ; demande = demande domestique
 *  estimée (pertes incluses). ratio non borné, coveragePct borné à 100. Le complément (nonDesalShare) est la part du potable
 *  que le dessalement ne couvre pas : on suppose qu'elle vient des nappes et d'autres sources, NON MODÉLISÉES (hypothèse).
 *  Les projets en construction donnent une fourchette « après chantiers » (jamais mélangée à la valeur du jour) ;
 *  aucun stock, aucun transfert. */
export function desalFlux(rb, assumptions = {}) {
  const a = assumptions;
  const dem = effectiveDemand(rb, a);
  const potableMm3 = dem.potableMm3;
  const capacityPotableMm3 = potableCapacityMm3(rb);
  const producedMm3 = potableDesalMm3(rb, a.addedDesalMm3);
  const ratio = fluxRatio(producedMm3, potableMm3);
  const coverage01 = ratio == null ? null : clamp(ratio, 0, 1);
  const planned = (Array.isArray(rb?.desalination?.plannedMm3PerYear) ? rb.desalination.plannedMm3PerYear : []).map(p => {
    const potableHigh = num(p?.byUse?.potableMm3PerYear);
    const potableLow = num(p?.byUse?.potableLowMm3PerYear) ?? potableHigh;
    return { label: p.label, projectStatus: p.projectStatus ?? null, year: p.year ?? null, totalMm3: num(p), potableHigh, potableLow, source: p.source ?? null, date: p.date ?? null };
  });
  const building = planned.filter(p => p.projectStatus === 'en construction' && p.potableHigh != null);
  let afterBuilding = null;
  if (building.length && potableMm3 > 0) {
    const sum = k => building.reduce((s, p) => s + p[k], 0) * DESAL_UTILISATION;
    afterBuilding = { low: fluxRatio(producedMm3 + sum('potableLow'), potableMm3), high: fluxRatio(producedMm3 + sum('potableHigh'), potableMm3) };
  }
  const documentedShare = num(rb?.fluxContext?.desalShareOfCityPotable);
  const caveats = [
    CAVEAT_GROUNDWATER,
    'indicateur de flux (Mm³/an), différent des mois de couverture des régions à barrages : aucun stock n’est modélisé',
    `utilisation du dessalement fixée à ${DESAL_UTILISATION * 100} % de la capacité (hypothèse)`,
    'demande potable = population × consommation par habitant × (1 + pertes), hypothèses non relevées par région',
    'la part non couverte par le dessalement est supposée servie par des nappes et d’autres sources non modélisées',
  ];
  if (!(potableMm3 > 0)) caveats.push('demande potable inconnue : indicateur non calculé');
  return {
    ratio,
    coveragePct: coverage01 == null ? null : coverage01 * 100,
    band: fluxBandFor(ratio),
    producedMm3,
    capacityPotableMm3,
    potableDemandMm3: potableMm3,
    nonDesalShare: coverage01 == null ? null : 1 - coverage01,
    groundwater: 'non modélisé',
    planned,
    afterBuilding,
    documentedDesalShare: documentedShare,
    caveats,
  };
}

/** Entrée de carte pour une région sans stock : valeur = % du potable couvert par le dessalement, kind 'flux'
 *  (la carte ne la compare jamais aux mois de couverture). */
export function fluxMetric(rb, assumptions = {}) {
  const f = desalFlux(rb, assumptions);
  if (f.coveragePct == null) return { value: null };
  return { value: f.coveragePct, kind: 'flux', band: f.band, label: Math.round(f.coveragePct) + ' % du potable (dessalement)' };
}

/** Phrases courtes sur le calcul d'un résultat de desalFlux(). */
export function explainFlux(f) {
  if (!f || f.ratio == null) return ['Indicateur de flux non calculé : demande potable inconnue.'];
  const out = [
    `Indicateur de flux = production de dessalement potable ÷ demande potable estimée, soit ${f1(f.producedMm3)} Mm³/an ÷ ${f1(f.potableDemandMm3)} Mm³/an = ${f0(f.ratio * 100)} % (borné à 100 % : ${f0(f.coveragePct)} %).`,
    `Production = capacité potable ${f1(f.capacityPotableMm3)} Mm³/an × utilisation ${f0(DESAL_UTILISATION * 100)} % (hypothèse).`,
    `Bandes : dessalement dominant à partir de ${f0(FLUX_BAND_DOMINANT * 100)} %, mixte de ${f0(FLUX_BAND_MIXED * 100)} à ${f0(FLUX_BAND_DOMINANT * 100)} %, nappes dominantes en dessous (seuils d’hypothèse).`,
    'Ce n’est pas un stock ni des mois de couverture : cette région n’a pas de barrage rattaché dans le bulletin.',
    `Dépendance aux nappes non modélisées : la part non couverte (${f0(f.nonDesalShare * 100)} % du potable) est supposée servie par les nappes et d’autres sources, sans volume ni état de ces nappes.`,
  ];
  if (f.documentedDesalShare != null) out.push(`Repère documenté (ville de Laâyoune, 2022) : environ ${f0(f.documentedDesalShare * 100)} % de la production potable installée vient du dessalement, le reste des eaux souterraines.`);
  return out;
}

// ---------- Explication pour l'interface ----------

const f0 = x => (x == null ? 'n/d' : x.toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
const f1 = x => (x == null ? 'n/d' : x.toLocaleString('fr-FR', { maximumFractionDigits: 1 }));

/** Phrases courtes en français sur le calcul d'un résultat de coverage(). */
export function explain(result) {
  if (!result) return [];
  const c = result.components ?? {};
  const out = [];
  if (result.monthsOfCoverage == null) {
    out.push('Couverture non calculée : cette région n’a pas de stock de surface rattaché ou pas de demande connue.');
  } else {
    out.push(`Couverture = (stock de surface + dessalement) / demande mensuelle servie par la surface, soit (${f0(c.storedMm3)} + ${f1(c.desalMm3 * (c.horizonYears ?? 1))}) Mm³ / ${f1(c.monthlySurfaceDemandMm3)} Mm³ par mois = ${f1(result.monthsOfCoverage)} mois.`);
    out.push(`Le stock est la part du bassin attribuée à la région (remplissage ${f0(c.fillPct)} %), selon des parts indicatives.`);
    out.push(`La demande de surface est la demande totale (${f0(c.demandMm3)} Mm³/an) multipliée par ${f0((c.surfaceShare ?? SURFACE_SHARE) * 100)} %, part supposée servie par les barrages.`);
    if (result.monthsPotable != null) out.push(`Pour le potable seul, avec tout le stock réservé à cet usage : ${f1(result.monthsPotable)} mois (borne haute).`);
    out.push(`Bandes : critique sous ${BAND_CRITICAL_MONTHS} mois, tendu de ${BAND_CRITICAL_MONTHS} à ${BAND_COMFORT_MONTHS}, confortable au-delà (seuils d’hypothèse). Ici : ${result.band}.`);
  }
  if (result.desalCoverageOfPotable != null) out.push(`Dessalement ÷ demande potable : ${f0(result.desalCoverageOfPotable * 100)} % (borné à 100 %, hypothèse).`);
  out.push(`Simulation : apports = moyenne du bassin × facteur (sec ${HYDRO_FACTOR.dry}, normal ${HYDRO_FACTOR.normal}, humide ${HYDRO_FACTOR.wet} par défaut) × part captée par les retenues ${f0(DAM_CAPTURE_SHARE * 100)} % (hypothèses non validées).`);
  out.push('Calage à pluie inchangée seulement : avec le curseur CMIP6 par défaut, une baisse de pluie fait compter le dessèchement en partie deux fois ; une hausse le compense en partie. Non recalé.');
  out.push('Les eaux souterraines et les apports futurs ne sont pas comptés.');
  for (const cv of result.caveats ?? []) if (/manquante|inconnu|aucun barrage/.test(cv)) out.push(`Limite : ${cv}.`);
  return out;
}
