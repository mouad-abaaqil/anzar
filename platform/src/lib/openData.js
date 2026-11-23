// Données ouvertes (Open-Meteo) appelées directement par le navigateur : pluie, évapotranspiration de référence
// (ET0) et débit de rivière modélisé (GloFAS). Fonctions pures et sans React, testées sans réseau.
// Toutes ces valeurs sont modélisées ; aucune n'est un relevé de station.

export const DEFAULT_REGION_ID = 'souss-massa';
// Point de référence de la région par défaut (même point qu'Agadir côté serveur).
export const DEFAULT_POINT = { id: 'agadir', name: 'Agadir', lat: 30.42, lon: -9.6 };
export const PAST_DAYS = 30;
export const FORECAST_DAYS = 7;
export const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
export const CACHE_PREFIX = 'anzar:opendata:';
export const TIMEZONE = 'Africa/Casablanca';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FLOOD_ENDPOINT = 'https://flood-api.open-meteo.com/v1/flood';

export const OPEN_DATA_SOURCES = {
  rain: {
    id: 'open-meteo-rain',
    label: 'Pluie modélisée',
    provider: 'Open-Meteo (modèles météo)',
    url: 'https://open-meteo.com/en/docs',
    license: 'CC BY 4.0, offre gratuite non commerciale',
  },
  et0: {
    id: 'open-meteo-et0',
    label: 'Évapotranspiration de référence (ET0)',
    provider: 'Open-Meteo (FAO-56 Penman-Monteith)',
    url: 'https://open-meteo.com/en/docs',
    license: 'CC BY 4.0, offre gratuite non commerciale',
  },
  flood: {
    id: 'open-meteo-flood',
    label: 'Débit de rivière modélisé',
    provider: 'Open-Meteo Flood API (GloFAS, Copernicus/ECMWF)',
    url: 'https://open-meteo.com/en/docs/flood-api',
    license: 'CC BY 4.0, offre gratuite non commerciale',
  },
};

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const num = v => (isNum(v) ? v : null);
const round1 = v => Math.round(v * 10) / 10;
const round2 = v => Math.round(v * 100) / 100;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function sumOrNull(values) {
  const present = values.filter(v => v !== null);
  return present.length ? round1(present.reduce((t, v) => t + v, 0)) : null;
}

/** Id de région lu dans le hash (#/app/<page>/<région>) ; région par défaut si absent. */
export function regionIdFromHash(hash, defaultId = DEFAULT_REGION_ID) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] !== 'app') return defaultId;
  return parts[2] || defaultId;
}

function ringCentroid(ring) {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i]; const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (a === 0) return null;
  return { lon: cx / (3 * a), lat: cy / (3 * a), area: Math.abs(a / 2) };
}

/** Centroïde (lat, lon) du plus grand polygone d'une entité GeoJSON ; null si géométrie inexploitable. */
export function featureCentroid(feature) {
  const g = feature?.geometry;
  const polygons = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
  let best = null;
  for (const poly of polygons) {
    const ring = poly?.[0];
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const c = ringCentroid(ring);
    if (c && isNum(c.lat) && isNum(c.lon) && (!best || c.area > best.area)) best = c;
  }
  return best ? { lat: round2(best.lat), lon: round2(best.lon) } : null;
}

/** Point de modélisation d'une région : Agadir par défaut, sinon centroïde de la région. null si inconnue. */
export function regionPoint(regionId, geo) {
  if (!regionId || regionId === DEFAULT_REGION_ID) return { ...DEFAULT_POINT, regionId: DEFAULT_REGION_ID, kind: 'reference' };
  const feature = geo?.features?.find(f => f?.properties?.id === regionId);
  const c = featureCentroid(feature);
  if (!c) return null;
  return { id: regionId, regionId, name: feature.properties.name || regionId, lat: c.lat, lon: c.lon, kind: 'centroid' };
}

const coord = v => String(round2(v));

/** Pluie et ET0 quotidiennes : 30 jours passés (modélisés) et 7 jours de prévision. */
export function forecastUrl(point) {
  return `${FORECAST_ENDPOINT}?latitude=${coord(point.lat)}&longitude=${coord(point.lon)}&daily=precipitation_sum,et0_fao_evapotranspiration&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}&timezone=${encodeURIComponent(TIMEZONE)}`;
}

export function floodUrl(point) {
  return `${FLOOD_ENDPOINT}?latitude=${coord(point.lat)}&longitude=${coord(point.lon)}&daily=river_discharge,river_discharge_max&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}`;
}

function checkDaily(payload, fields) {
  const daily = (Array.isArray(payload) ? payload[0] : payload)?.daily;
  const n = daily?.time?.length;
  if (!Array.isArray(daily?.time) || !n || !daily.time.every(d => typeof d === 'string' && ISO_DAY.test(d))) throw new Error('format inattendu');
  for (const f of fields) if (!Array.isArray(daily[f]) || daily[f].length !== n) throw new Error('format inattendu');
  return daily;
}

// Index du jour courant : les past_days premières valeurs sont passées, la suivante est aujourd'hui.
const kindAt = (i, n) => (i < n - FORECAST_DAYS ? 'past_modelled' : 'forecast');

/** ET0 : valeurs manquantes conservées à null (jamais comptées comme 0). */
export function normalizeEt0(payload, fetchedAt) {
  const daily = checkDaily(payload, ['et0_fao_evapotranspiration']);
  const n = daily.time.length;
  const days = daily.time.map((d, i) => ({ date: d, kind: kindAt(i, n), et0_mm: num(daily.et0_fao_evapotranspiration[i]) }));
  const past = days.filter(d => d.kind === 'past_modelled').map(d => d.et0_mm);
  const fc = days.filter(d => d.kind === 'forecast').map(d => d.et0_mm);
  const presentPast = past.filter(v => v !== null);
  return {
    days,
    past30Mm: sumOrNull(past),
    past30Complete: past.every(v => v !== null),
    meanPastMmDay: presentPast.length ? round1(presentPast.reduce((t, v) => t + v, 0) / presentPast.length) : null,
    forecast7Mm: sumOrNull(fc),
    forecast7Complete: fc.every(v => v !== null),
    unit: 'mm',
    fetchedAt,
  };
}

/** Débit GloFAS : dernier jour passé, maximum prévu sur 7 jours, valeurs nulles conservées. */
export function normalizeFlood(payload, fetchedAt) {
  const entry = Array.isArray(payload) ? payload[0] : payload;
  const daily = checkDaily(payload, ['river_discharge']);
  const n = daily.time.length;
  const maxSeries = Array.isArray(daily.river_discharge_max) && daily.river_discharge_max.length === n ? daily.river_discharge_max : null;
  const days = daily.time.map((d, i) => ({
    date: d,
    kind: kindAt(i, n),
    discharge_m3s: num(daily.river_discharge[i]),
    discharge_max_m3s: maxSeries ? num(maxSeries[i]) : null,
  }));
  const forecast = days.filter(d => d.kind === 'forecast');
  const past = days.filter(d => d.kind === 'past_modelled');
  const lastPast = [...past].reverse().find(d => d.discharge_m3s !== null) || null;
  const fcValues = forecast.map(d => d.discharge_m3s).filter(v => v !== null);
  const peakValues = forecast.map(d => d.discharge_max_m3s ?? d.discharge_m3s).filter(v => v !== null);
  return {
    days,
    lastObserved: lastPast ? { date: lastPast.date, m3s: lastPast.discharge_m3s } : null,
    forecastPeakM3s: peakValues.length ? round2(Math.max(...peakValues)) : null,
    forecastMeanM3s: fcValues.length ? round2(fcValues.reduce((t, v) => t + v, 0) / fcValues.length) : null,
    unit: entry?.daily_units?.river_discharge || 'm³/s',
    grid: { lat: num(entry?.latitude), lon: num(entry?.longitude) },
    fetchedAt,
  };
}

// --- Cache localStorage daté -------------------------------------------------------------------------

export const cacheKey = (kind, point) => `${CACHE_PREFIX}${kind}:${coord(point.lat)},${coord(point.lon)}`;

export function readCache(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return isNum(entry?.at) && entry.data ? entry : null;
  } catch { return null; }
}

export function writeCache(storage, key, data, at) {
  try { storage?.setItem(key, JSON.stringify({ at, data })); return true; } catch { return false; }
}

/**
 * Charge une donnée : cache frais si possible, sinon réseau, sinon cache périmé (étiqueté), sinon erreur.
 * fetcher() renvoie les données normalisées. Résultat : { data, at, status: 'live'|'cache'|'stale' }.
 */
export async function loadWithCache({ storage, key, fetcher, now = () => Date.now(), ttlMs = CACHE_TTL_MS, force = false }) {
  const cached = readCache(storage, key);
  if (cached && !force && now() - cached.at < ttlMs) return { data: cached.data, at: cached.at, status: 'cache' };
  try {
    const data = await fetcher();
    const at = now();
    writeCache(storage, key, data, at);
    return { data, at, status: 'live' };
  } catch (error) {
    if (cached) return { data: cached.data, at: cached.at, status: 'stale' };
    throw error;
  }
}

export async function fetchJson(url, fetchImpl = globalThis.fetch, timeoutMs = 12000) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { code: response.status });
  return response.json();
}

export const STATUS_LABELS = {
  loading: 'chargement',
  live: 'récupéré à l’instant',
  cache: 'cache local daté',
  stale: 'ancien : service injoignable',
  error: 'indisponible',
};

/** Ligne du bloc « Données ouvertes utilisées » : jamais de date inventée quand rien n'a été chargé. */
export function sourceRow(sourceKey, load) {
  const source = OPEN_DATA_SOURCES[sourceKey];
  const status = load?.status || 'loading';
  return {
    id: source.id,
    label: source.label,
    provider: source.provider,
    url: source.url,
    license: source.license,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    at: isNum(load?.at) ? new Date(load.at).toISOString() : null,
  };
}
