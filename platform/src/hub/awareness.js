// Chapitre « Comprendre l'eau » (sensibilisation) : chargeur de public/data/awareness.json et logique pure.
// Aucun JSX ni CSS : testé sous Node (tests/awareness-data.test.mjs). Chaque chiffre affiché vient d'un fait du JSON
// (curation de data-raw/awareness/awareness-facts.json : statuts « verifie » et « secondaire » seulement). Un fait
// absent, d'un statut non permis ou sans URL https est écarté : la partie correspondante renvoie null et l'interface
// n'affiche rien (jamais un chiffre écrit de mémoire). Recherche : docs/research/14-video-secheresse.md.

export const AWARENESS_URL = '/data/awareness.json';
export const ALLOWED_STATUS = ['verifie', 'secondaire'];

/** Étapes du chapitre (mêmes ids que STORY_STOPS, chapitre 'comprendre') et faits que chacune affiche. */
export const STEP_FACTS = {
  'comprendre-rare': ['dotation-par-habitant'],
  'comprendre-irreguliere': ['apports-barrages-2017-2023', 'apports-moyennes-reference', 'ecart-offre-demande'],
  'comprendre-barrage': ['envasement-barrages', 'evaporation-barrages', 'priorite-eau-potable-loi', 'priorite-aep-puis-irrigation'],
  'comprendre-nappes': ['nappes-surexploitation', 'nappes-potentiel'],
  'comprendre-solutions': ['interconnexion-sebou-bouregreg', 'dessalement-parc-2023', 'prix-eau-dessalee-irrigation', 'reutilisation-eaux-usees', 'rendement-reseaux-aep'],
  'comprendre-agir': ['gestes-mesures-locales', 'demande-par-secteur-2020', 'goutte-a-goutte-paradoxe'],
};
export const USED_FACT_IDS = [...new Set(Object.values(STEP_FACTS).flat())];

const nf = d => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** Nombre en français ; '' si absent. */
export const fmt = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? nf(d).format(v) : '');
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function frDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
}
const num = x => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Un fait est affichable : statut permis, source nommée, URL https, date de lecture ISO. */
export function isDisplayable(f) {
  return !!f && typeof f.id === 'string' && ALLOWED_STATUS.includes(f.status) && typeof f.sourceName === 'string' && f.sourceName.length > 0
    && /^https:\/\//.test(f.sourceUrl || '') && /^\d{4}-\d{2}-\d{2}$/.test(f.readDate || '');
}

/** Faits affichables du JSON, par id. */
export function factIndex(json) {
  const out = new Map();
  for (const f of Array.isArray(json?.facts) ? json.facts : []) if (isDisplayable(f)) out.set(f.id, f);
  return out;
}

export const statusLabel = s => (s === 'verifie' ? 'Vérifié à la source' : s === 'secondaire' ? 'Source secondaire' : '');

/** Propriétés de ProvenanceChip pour un fait : « sourcé » (publié par une source datée), avec la mention du statut. */
export function chipFor(f, extraNote = '') {
  if (!f) return null;
  const sec = f.status === 'secondaire';
  return {
    status: 'sourced',
    source: f.sourceName,
    url: f.sourceUrl,
    date: (f.period ? f.period + ' · ' : '') + 'lu le ' + frDate(f.readDate),
    note: [sec ? 'Source secondaire : chiffre rapporté par la presse, non lu à la source primaire.' : 'Vérifié par Anzar dans le document de la source.', extraNote].filter(Boolean).join(' '),
  };
}

/** Modèle d'affichage du chapitre : une entrée par étape, null quand un fait manque. */
export function awarenessModel(json) {
  const F = factIndex(json);
  const get = id => F.get(id) || null;
  const safe = fn => { try { return fn(); } catch { return null; } };

  const rare = safe(() => {
    const f = get('dotation-par-habitant');
    const v = f?.value || {};
    const now = num(v['2023']), threshold = num(v.seuil_penurie), y1960 = num(v['1960']);
    if (now == null || threshold == null || y1960 == null) return null;
    const max = Math.max(now, threshold, y1960);
    return { fact: f, now, nowYear: 2023, threshold, y1960, max };
  });

  const irregular = safe(() => {
    const f = get('apports-barrages-2017-2023'), m = get('apports-moyennes-reference');
    const series = Object.entries(f?.value || {}).map(([label, value]) => ({ label, value: num(value) })).filter(s => s.value != null);
    const mean = num(m?.value?.['1945-2023']);
    if (series.length < 2 || mean == null) return null;
    const [y0, y1] = series.map(s => /^(\d{4})-(\d{2})$/.exec(s.label)).reduce((a, x, i) => (i === 0 ? [x, x] : [a[0], x]), [null, null]);
    const hi = series.reduce((a, s) => (s.value > a.value ? s : a)), lo = series.reduce((a, s) => (s.value < a.value ? s : a));
    const max = Math.max(mean, ...series.map(s => s.value)) * 1.08;
    const rows = series.map(s => {
      const k = /^(\d{4})-(\d{2})$/.exec(s.label);
      return { ...s, from: k ? k[1] : s.label, to: k ? k[1].slice(0, 2) + k[2] : '' };
    });
    const g = get('ecart-offre-demande');
    const gap = num(g?.value?.actuel) != null && num(g?.value?.['2050_avec_climat']) != null
      ? { fact: g, now: g.value.actuel, y2050: g.value['2050_avec_climat'] } : null;
    return { fact: f, meanFact: m, rows, mean, max, hi, lo, ratio: lo.value > 0 ? hi.value / lo.value : null, first: y0?.[0] || null, last: y1?.[0] || null, gap };
  });

  const dam = safe(() => {
    const s = get('envasement-barrages'), e = get('evaporation-barrages'), law = get('priorite-eau-potable-loi'), plan = get('priorite-aep-puis-irrigation');
    const silt = num(s?.value?.sediments_Mt_par_an), siltPct = num(s?.value?.part_dans_retenues_pct), evap = num(e?.value);
    const article = law ? (/article (\d+)/.exec(law.claimFr) || [])[1] || null : null;
    if (silt == null && evap == null && !law) return null;
    return {
      silt: silt != null && siltPct != null ? { fact: s, mt: silt, pct: siltPct } : null,
      evap: evap != null ? { fact: e, mm3PerDay: evap } : null,
      law: law ? { fact: law, article } : null,
      plan: plan ? { fact: plan } : null,
    };
  });

  const nappes = safe(() => {
    const f = get('nappes-surexploitation');
    const take = num(f?.value?.prelevements_Gm3), excess = num(f?.value?.excedent_Gm3), pct = num(f?.value?.excedent_pct);
    if (take == null || excess == null || pct == null) return null;
    // Renouvellement = prélèvements - excédent (dérivé, même source) ; le potentiel exploitable DGH est cité à part.
    const renew = Math.round((take - excess) * 10) / 10;
    const pot = get('nappes-potentiel');
    return { fact: f, take, excess, pct, renew, agriPct: num(f.value.part_irrigation_pct), potential: pot && num(pot.value?.potentiel_Gm3) != null ? { fact: pot, gm3: pot.value.potentiel_Gm3, count: num(pot.value.nappes) } : null };
  });

  const solutions = safe(() => {
    const out = [];
    const t = get('interconnexion-sebou-bouregreg');
    if (num(t?.value?.transfere_Mm3) != null) {
      const [a, b] = String(t.value.periode || '').split(' au ');
      out.push({ id: 'transfert', fact: t, value: Math.round(t.value.transfere_Mm3), from: a || null, to: b || null });
    }
    const d = get('dessalement-parc-2023');
    if (num(d?.value?.capacite_2023_Mm3) != null) {
      const p = get('prix-eau-dessalee-irrigation');
      out.push({ id: 'dessalement', fact: d, value: d.value.capacite_2023_Mm3, stations: num(d.value.stations_2023),
        price: p && num(p.value?.facture_DH_m3) != null && num(p.value?.barrage_DH_m3) != null ? { fact: p, desal: p.value.facture_DH_m3, dam: p.value.barrage_DH_m3 } : null });
    }
    const r = get('reutilisation-eaux-usees');
    if (num(r?.value?.reutilise_2022_Mm3) != null) {
      const target = num(r.value.objectif_2027_Mm3);
      out.push({ id: 'reutilisation', fact: r, value: r.value.reutilise_2022_Mm3, target, factor: target ? Math.round(target / r.value.reutilise_2022_Mm3) : null });
    }
    const n = get('rendement-reseaux-aep');
    if (num(n?.value?.actuel) != null) out.push({ id: 'reseaux', fact: n, value: n.value.actuel, target2030: num(n.value['2030']) });
    return out.length ? out : null;
  });

  const agir = safe(() => {
    const g = get('gestes-mesures-locales'), dmd = get('demande-par-secteur-2020'), drip = get('goutte-a-goutte-paradoxe');
    if (!g && !dmd) return null;
    const share = num(dmd?.value?.agriculture_pct);
    return { gestes: g, demand: share != null ? { fact: dmd, sharePct: share, tenths: Math.round(share / 10) } : null, drip };
  });

  return { rare, irregular, dam, nappes, solutions, agir, facts: F };
}

/** Faits listés dans le tiroir Sources : ceux que l'interface utilise, dans l'ordre du chapitre. */
export function sourcesList(json) {
  const F = factIndex(json);
  return USED_FACT_IDS.map(id => F.get(id)).filter(Boolean);
}

let cache = null;
/** Charge awareness.json une fois (promesse partagée entre le chapitre et le tiroir Sources) ; null en cas d'échec. */
export function loadAwareness(fetchImpl = typeof fetch === 'function' ? fetch : null) {
  if (!fetchImpl) return Promise.resolve(null);
  if (!cache) {
    cache = fetchImpl(AWARENESS_URL).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(j => { if (!j) cache = null; return j; });
  }
  return cache;
}
