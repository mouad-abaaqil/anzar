// Helpers for the satellite reconstruction and experimental forecast pages.
// Pure functions only: no fetch, no DOM, so they can be tested with node:test.

export const RECONSTRUCTION_LABEL = 'estimation satellite calée sur les bulletins, non officielle';
export const FORECAST_LABEL = 'prévision expérimentale';
export const PENDING_TEXT = 'Reconstitution en cours de calcul';
export const VERDICT_BAD = 'Le modèle ne fait pas mieux que les références : ne pas s’y fier';
export const SKILL_MIN = 0.10;
export const VERDICT_WEAK = 'Gain négligeable sur la persistance : à ne pas utiliser pour décider';
export const BACKTEST_CAVEAT = 'Ces scores mesurent la prévision de la reconstitution satellite, pas celle du stock officiel.';
export const VERDICT_GOOD = 'Le modèle fait mieux que la persistance et la climatologie sur ce test, sans garantie hors échantillon';

const frNum = (v, d) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const RAIN_COMPARISON = [
  ['Chefchaouen', 907], ['Tanger', 605], ['Ifrane', 633], ['Béni Mellal', 484], ['Rabat', 431],
  ['Marrakech', 258], ['Agadir', 237], ['Taroudant', 228], ['Guelmim', 108], ['Tata', 56],
];
export const RAIN_COMPARISON_LABEL = 'moyenne annuelle modélisée 2000-2025 (ERA5), pas des stations';

/** 'pending' unless the document explicitly says ready and has the expected arrays. */
export function parseState(doc, kind) {
  if (!doc || typeof doc !== 'object' || doc.status !== 'ready') return { state: 'pending' };
  if (kind === 'reconstruction' && !Array.isArray(doc.dams)) return { state: 'invalid', reason: 'dams manquant' };
  if (kind === 'forecast' && !doc.backtest) return { state: 'invalid', reason: 'backtest manquant' };
  return { state: 'ready' };
}

/** Verdict: beatsBaselines must be true AND the skill vs persistence must reach SKILL_MIN. */
export function verdict(forecast) {
  const b = forecast?.backtest;
  if (!b || typeof b.beatsBaselines !== 'boolean') {
    return { known: false, beats: false, text: 'Verdict indisponible : résultats de test absents', tone: 'none' };
  }
  if (!b.beatsBaselines) return { known: true, beats: false, text: VERDICT_BAD, tone: 'bad' };
  if (Number.isFinite(b.skillVsPersistence) && b.skillVsPersistence < SKILL_MIN) {
    return { known: true, beats: false, weak: true, text: `${VERDICT_WEAK} (gain ${frNum(b.skillVsPersistence, 2)})`, tone: 'bad' };
  }
  return { known: true, beats: true, text: VERDICT_GOOD, tone: 'ok' };
}

/** Held-out validation rows that concern one dam (matched on the leading name). */
export function damValidation(rows, dam) {
  const n = String(dam?.name || '').toLowerCase();
  return (rows || []).filter(v => v && !v.press && typeof v.name === 'string' && n && v.name.toLowerCase().startsWith(n) && Number.isFinite(v.errorMm3));
}

/** Returns violations of low <= volumeMm3 <= high (and finite numbers). */
export function validateBands(points, label = 'série') {
  const out = [];
  (points || []).forEach((p, i) => {
    const { volumeMm3: v, low, high } = p || {};
    if (![v, low, high].every(Number.isFinite)) out.push(`${label}[${i}] ${p?.date ?? '?'} : valeur non numérique`);
    else if (!(low <= v && v <= high)) out.push(`${label}[${i}] ${p.date} : bande incohérente (${low} ≤ ${v} ≤ ${high} faux)`);
  });
  return out;
}

export function validateReconstruction(doc) {
  const out = [];
  for (const d of doc?.dams || []) out.push(...validateBands(d.series, d.id));
  out.push(...validateBands(doc?.regionTotal, 'regionTotal'));
  return out;
}

export function validateForecast(doc) {
  const out = [];
  for (const s of doc?.scenarios || []) out.push(...validateBands(s.points, `scénario ${s.name}`));
  return out;
}

/** Fill percentage text; always carries the word 'estimé'. */
export function fillText(pct) {
  if (!Number.isFinite(pct)) return 'remplissage estimé indisponible';
  return `${frNum(pct, 1)} % (estimé)`;
}

export const mm3 = (v, d = 1) => (Number.isFinite(v) ? `${frNum(v, d)} Mm³` : '—');
export const pct = (v, d = 1) => (Number.isFinite(v) ? `${frNum(v, d)} %` : '—');
export const signedNum = (v, d = 1) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${frNum(v, d)}` : '—');

const dayMs = s => Date.parse(`${String(s).slice(0, 10)}T12:00:00Z`);
export const parseDay = dayMs;

/** Linear scales for a chart. series: array of {x:number(ms), ys:number[]}. */
export function makeScales(xs, ys, box, { zeroBased = true } = {}) {
  const fx = xs.filter(Number.isFinite);
  const fy = ys.filter(Number.isFinite);
  let x0 = Math.min(...fx), x1 = Math.max(...fx);
  if (!(x1 > x0)) { x1 = x0 + 86400000; }
  let y0 = zeroBased ? 0 : Math.min(...fy), y1 = Math.max(...fy);
  if (!fy.length) { y0 = 0; y1 = 1; }
  if (!(y1 > y0)) y1 = y0 + 1;
  y1 *= 1.05;
  return {
    x0, x1, y0, y1,
    sx: x => box.l + ((x - x0) / (x1 - x0)) * (box.w - box.l - box.r),
    sy: y => box.h - box.b - ((y - y0) / (y1 - y0)) * (box.h - box.t - box.b),
  };
}

export function linePath(points, sx, sy, key) {
  return points.filter(p => Number.isFinite(p[key]) && Number.isFinite(p.x))
    .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p[key]).toFixed(1)}`).join('');
}

export function bandPath(points, sx, sy) {
  const ok = points.filter(p => Number.isFinite(p.low) && Number.isFinite(p.high) && Number.isFinite(p.x));
  if (!ok.length) return '';
  const up = ok.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.high).toFixed(1)}`);
  const down = [...ok].reverse().map(p => `L${sx(p.x).toFixed(1)},${sy(p.low).toFixed(1)}`);
  return `${up.join('')}${down.join('')}Z`;
}

/** Axis ticks (about n) on [a,b]. */
export function niceTicks(a, b, n = 4) {
  const span = b - a || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Totals for a rain point: fall back to sums of daily values when totals are missing. */
export function rainTotals(point) {
  const t = point?.totals || {};
  const daily = point?.daily || [];
  const isForecast = d => d.kind === 'forecast';
  const sum = fc => daily.filter(d => isForecast(d) === fc && Number.isFinite(d.precipitation_mm)).reduce((s, d) => s + d.precipitation_mm, 0);
  return {
    past30: Number.isFinite(t.past30Mm) ? t.past30Mm : (daily.length ? sum(false) : null),
    forecast7: Number.isFinite(t.forecast7Mm) ? t.forecast7Mm : (daily.length ? sum(true) : null),
  };
}
