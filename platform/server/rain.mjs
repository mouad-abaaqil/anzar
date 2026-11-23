// Rainfall context for the Souss-Massa catchments, from the Open-Meteo forecast API.
// Every value is a modelled precipitation estimate, never a rain-gauge measurement.

export const RAIN_SOURCE = 'Open-Meteo (modèle météorologique, non mesuré par pluviomètre)';
export const RAIN_LICENSE = 'CC BY 4.0 ; offre gratuite non commerciale';
export const RAIN_PAST_DAYS = 30;
export const RAIN_FORECAST_DAYS = 7;
export const RAIN_CACHE_MS = 3 * 60 * 60 * 1000;
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 12000;
const UNAVAILABLE = 'Les données pluviométriques modélisées sont indisponibles pour le moment. Réessayez plus tard.';
const STALE_REASON = 'Le service Open-Meteo est indisponible : affichage de la dernière récupération réussie (voir fetchedAt).';

// Fixed reference points. Dam points are added from public/data/region.json.
const FIXED_POINTS = [
  { id: 'haut-atlas-aoulouz', name: 'Haut Atlas – Aoulouz', lat: 30.69, lon: -8.17, role: 'tête de bassin, près d’Aoulouz', note: 'Point modélisé à cette position ; ce n’est pas une moyenne du bassin versant.' },
  { id: 'agadir', name: 'Agadir', lat: 30.42, lon: -9.6, role: 'point de référence, Agadir', note: 'Point modélisé à cette position ; ce n’est pas une moyenne du bassin versant.' },
];

const httpError = (status, message) => Object.assign(new Error(message), { status });
class UpstreamError extends Error {}
const formatError = () => new UpstreamError('format Open-Meteo inattendu');
const isFiniteNumber = v => typeof v === 'number' && Number.isFinite(v);
const num = v => isFiniteNumber(v) ? v : null;
const round1 = v => Math.round(v * 10) / 10;
function sumOrNull(values) {
  const present = values.filter(v => v !== null);
  return present.length ? round1(present.reduce((total, v) => total + v, 0)) : null;
}

// region.json stores coordinates as [longitude, latitude].
export function rainPoints(region) {
  const dams = (region?.facilities || [])
    .filter(f => f?.kind === 'dam' && Array.isArray(f.coordinates) && f.coordinates.length === 2)
    .filter(f => isFiniteNumber(f.coordinates[0]) && isFiniteNumber(f.coordinates[1]) && Math.abs(f.coordinates[0]) <= 180 && Math.abs(f.coordinates[1]) <= 90)
    .map(f => ({
      id: `barrage-${f.id}`,
      name: f.name,
      lat: f.coordinates[1],
      lon: f.coordinates[0],
      role: 'position approximative du barrage',
      note: 'Point modélisé à la position approximative du barrage (coordonnées OSM) ; ce n’est pas une moyenne du bassin versant.',
    }));
  return [...FIXED_POINTS, ...dams];
}

export function rainUrl(points) {
  const latitude = points.map(p => p.lat).join(',');
  const longitude = points.map(p => p.lon).join(',');
  return `${ENDPOINT}?latitude=${latitude}&longitude=${longitude}&daily=precipitation_sum,precipitation_probability_max&past_days=${RAIN_PAST_DAYS}&forecast_days=${RAIN_FORECAST_DAYS}&timezone=Africa%2FCasablanca`;
}

// Turns the Open-Meteo payload into labelled points. Missing values stay null and are never counted as zero.
export function normalizeRain(payload, points, fetchedAt) {
  const entries = Array.isArray(payload) ? payload : [payload];
  const expected = RAIN_PAST_DAYS + RAIN_FORECAST_DAYS;
  if (entries.length !== points.length) throw formatError();
  const out = points.map((point, index) => {
    const daily = entries[index]?.daily;
    if (!Array.isArray(daily?.time) || daily.time.length !== expected) throw formatError();
    if (!daily.time.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))) throw formatError();
    if (!Array.isArray(daily.precipitation_sum) || daily.precipitation_sum.length !== expected) throw formatError();
    const probability = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max : null;
    const days = daily.time.map((date, j) => ({
      date,
      kind: j < RAIN_PAST_DAYS ? 'past_modelled' : 'forecast',
      precipitation_mm: num(daily.precipitation_sum[j]),
      probability_max_pct: probability ? num(probability[j]) : null,
    }));
    const past = days.slice(0, RAIN_PAST_DAYS).map(d => d.precipitation_mm);
    const forecast = days.slice(RAIN_PAST_DAYS).map(d => d.precipitation_mm);
    return {
      id: point.id,
      name: point.name,
      role: point.role,
      lat: point.lat,
      lon: point.lon,
      note: point.note,
      daily: days,
      totals: {
        past30Mm: sumOrNull(past),
        past30Complete: past.every(v => v !== null),
        forecast7Mm: sumOrNull(forecast),
        forecast7Complete: forecast.every(v => v !== null),
      },
    };
  });
  return {
    points: out,
    source: RAIN_SOURCE,
    license: RAIN_LICENSE,
    modelled: true,
    unit: 'mm',
    windows: { pastDays: RAIN_PAST_DAYS, forecastDays: RAIN_FORECAST_DAYS, timezone: 'Africa/Casablanca' },
    fetchedAt,
  };
}

export function createRainService({ fetchImpl = globalThis.fetch, loadRegion, now = () => Date.now() } = {}) {
  let cache = null;
  let inFlight = null;

  async function fetchFresh() {
    const points = rainPoints(loadRegion());
    try {
      const upstream = await fetchImpl(rainUrl(points), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!upstream.ok) throw new UpstreamError(`HTTP ${upstream.status}`);
      return normalizeRain(await upstream.json(), points, new Date(now()).toISOString());
    } catch (error) {
      if (error.status) throw error;
      throw new UpstreamError(error.message);
    }
  }

  async function get() {
    if (cache && now() - cache.at < RAIN_CACHE_MS) return { ...cache.data, stale: false, fromCache: true };
    inFlight ??= fetchFresh()
      .then(data => { cache = { at: now(), data }; return data; })
      .finally(() => { inFlight = null; });
    try {
      const data = await inFlight;
      return { ...data, stale: false, fromCache: false };
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      if (cache) return { ...cache.data, stale: true, staleReason: STALE_REASON, fromCache: true };
      throw httpError(502, UNAVAILABLE);
    }
  }

  return { get };
}
