// Logique pure des blocs ajoutés au panneau (ET0, débit GloFAS, tendance satellite Souss-Massa, liste des données ouvertes).
// Sans React ni réseau : testable avec node:test. Rien n'est inventé : une donnée absente reste absente.
import { OPEN_DATA_SOURCES, sourceRow } from '../../lib/openData.js';
import { makeScales, linePath, bandPath, parseDay, parseState, validateReconstruction, verdict } from '../../lib/forecast.js';

// Clé de cache distincte de l'ancienne ('rain-panel') : l'ancienne entrée n'avait pas l'ET0.
export const RAIN_CACHE_KIND = 'rain-panel-v2';
export const FLOOD_CACHE_KIND = 'flood';
export const SATELLITE_REGION = 'souss-massa';
export const NOT_LOADED = 'pas chargée dans cette session';
export const SATELLITE_LABEL = 'Tendance satellite, pas un volume : ne pas utiliser pour décider';
export const FLOOD_CAVEAT = 'Débit simulé sur une maille d’environ 5 km : pas une jauge ni une alerte de crue.';
export const ET0_CAVEAT = 'ET0 : demande évaporative d’une surface de référence, pas l’évaporation mesurée d’une retenue.';
export const NO_FLOOD = 'Aucun débit modélisé pour cette maille : aucune valeur affichée.';

/** Phrase sur le plus grand projet de dessalement pas encore en service d'une région (balance de la région), ou null. */
export function plannedDesalNote(rb) {
  const list = (rb?.desalination?.plannedMm3PerYear || []).filter(p => Number.isFinite(p?.value) && p.projectStatus && p.projectStatus !== 'en service');
  if (!list.length) return null;
  const building = list.filter(p => p.projectStatus === 'en construction');
  const big = [...(building.length ? building : list)].sort((a, b) => b.value - a.value)[0];
  const v = big.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return (building.length ? 'Le plus grand projet de dessalement en construction dans la région (' : 'Le plus grand projet de dessalement prévu dans la région (') + v + ' Mm³/an au total, ' + big.projectStatus + (big.year ? ', annoncé pour ' + big.year : '') + ') n’est pas encore en service : il n’est pas compté ici.';
}

export const dateFr = iso => {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? iso + 'T12:00:00' : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Tendance de la reconstitution satellite (région totale). Indisponible ou incohérente : aucune courbe. */
export function satelliteTrend(rec, fc) {
  if (parseState(rec, 'reconstruction').state !== 'ready') return { status: 'unavailable' };
  const violations = validateReconstruction(rec);
  if (violations.length) return { status: 'inconsistent', count: violations.length };
  const points = (rec.regionTotal || []).filter(p => Number.isFinite(p.volumeMm3) && Number.isFinite(p.low) && Number.isFinite(p.high));
  if (points.length < 4) return { status: 'unavailable' };
  const last = points[points.length - 1];
  const ref = points[points.length - 4];
  // Une direction n'est affirmée que si les bandes d'incertitude ne se recouvrent pas.
  const direction = last.low > ref.high ? 'hausse' : last.high < ref.low ? 'baisse' : 'indéterminée';
  const fcReady = fc && parseState(fc, 'forecast').state === 'ready';
  const v = fcReady ? verdict(fc) : { known: false, beats: false, text: 'Verdict de la prévision indisponible : aucune prévision affichée', tone: 'none' };
  return {
    status: 'ready', points, first: points[0], last, ref, direction,
    coveredShare: Number.isFinite(last.coveredShare) ? last.coveredShare : null,
    generatedAt: rec.generatedAt || null,
    verdict: v,
    forecastShown: v.known && v.beats === true,
  };
}

const BOX = { w: 320, h: 72, l: 4, r: 4, t: 4, b: 4 };
/** Tracés SVG de la tendance (sans graduation en Mm³ : la forme seulement). */
export function trendPaths(points) {
  const pts = points.map(p => ({ ...p, x: parseDay(p.date) }));
  const sc = makeScales(pts.map(p => p.x), pts.flatMap(p => [p.volumeMm3, p.high, p.low]), BOX);
  return { box: BOX, line: linePath(pts, sc.sx, sc.sy, 'volumeMm3'), band: bandPath(pts, sc.sx, sc.sy) };
}

const directionText = { hausse: 'En hausse sur 3 mois : les bandes d’incertitude ne se recouvrent pas.', baisse: 'En baisse sur 3 mois : les bandes d’incertitude ne se recouvrent pas.', 'indéterminée': 'Sens indéterminé sur 3 mois : les bandes d’incertitude se recouvrent.' };
export const directionLabel = d => directionText[d] || directionText['indéterminée'];

const STATIC_ROWS = [
  { id: 'open-meteo-climate', label: 'Projection climatique (CMIP6)', provider: 'Open-Meteo Climate API', url: 'https://open-meteo.com/en/docs/climate-api', license: 'CC BY 4.0, offre gratuite non commerciale' },
  { id: 'mapterhorn', label: 'Relief de la carte 3D', provider: 'Mapterhorn', url: 'https://mapterhorn.com/attribution', license: 'voir mapterhorn.com/attribution' },
  { id: 'openfreemap', label: 'Fond de carte', provider: 'OpenFreeMap, OpenStreetMap', url: 'https://openfreemap.org', license: 'OpenStreetMap (ODbL), OpenMapTiles' },
];

/**
 * Lignes de « Données ouvertes utilisées ». caches = { rain, flood } : entrées de cache {at} ou null.
 * Sans entrée, la source n'a pas été chargée dans cette session : jamais de date inventée.
 */
export function openDataRows({ rain = null, flood = null, climateFetchedAt = null } = {}) {
  const dyn = (key, entry) => {
    const r = sourceRow(key, entry ? { status: 'cache', at: entry.at } : null);
    return entry ? r : { ...r, status: 'none', statusLabel: NOT_LOADED, at: null };
  };
  const rows = [dyn('rain', rain), dyn('et0', rain), dyn('flood', flood)];
  rows.push({
    ...STATIC_ROWS[0],
    status: climateFetchedAt ? 'file' : 'none',
    statusLabel: climateFetchedAt ? 'fichier daté du pipeline, pas un appel du navigateur' : 'fichier absent',
    at: climateFetchedAt || null,
  });
  rows.push({ ...STATIC_ROWS[1], status: 'map', statusLabel: 'chargé par la carte, sans date de récupération', at: null });
  rows.push({ ...STATIC_ROWS[2], status: 'map', statusLabel: 'chargé par la carte, sans date de récupération', at: null });
  return rows;
}

export const OPEN_METEO_NOTE = 'L’offre gratuite d’Open-Meteo est réservée à un usage non commercial (' + OPEN_DATA_SOURCES.rain.license + '). Détail des sources étudiées : docs/OPEN_DATA.md.';
