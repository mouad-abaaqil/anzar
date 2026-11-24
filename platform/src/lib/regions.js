import { useEffect, useState } from 'react';
import { date, number } from './format.js';

export const DEFAULT_REGION_ID = 'souss-massa';
export const NO_BASIN_LABEL = 'pas de bassin de barrages dans le bulletin';

const fetchJson = url => fetch(url).then(r => {
  if (!r.ok) throw new Error(url);
  return r.json();
});

export async function fetchRegionsData() {
  const [doc, bulletin, geo] = await Promise.all([
    fetchJson('/data/regions.json'),
    fetchJson('/data/national-bulletin.json'),
    fetchJson('/data/morocco-regions.geojson'),
  ]);
  return { doc, bulletin, geo };
}

// Loads the three public region files once per mount; retry() reloads them.
export function useRegionsData() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', value: null });
  useEffect(() => {
    let alive = true;
    fetchRegionsData()
      .then(value => { if (alive) setState({ status: 'ready', value }); })
      .catch(() => { if (alive) setState({ status: 'error', value: null }); });
    return () => { alive = false; };
  }, [attempt]);
  const retry = () => {
    setState({ status: 'loading', value: null });
    setAttempt(a => a + 1);
  };
  return { ...state, retry };
}

export const regionById = (doc, id) => doc.regions.find(r => r.id === id) || null;

export const basinByName = (bulletin, name) => (name ? bulletin.basins.find(b => b.name === name) || null : null);

export const regionBasin = (bulletin, region) => basinByName(bulletin, region?.basin);

export const neighboursOf = (doc, region) => (region.neighbours || [])
  .map(id => regionById(doc, id))
  .filter(Boolean);

export const sourcesFor = (doc, ids = []) => ids
  .map(id => doc.sources.find(s => s.id === id))
  .filter(Boolean);

// A documented transfer counts only when it links the two basins (either direction).
export function transferBetween(doc, basinA, basinB) {
  if (!basinA || !basinB) return null;
  return (doc.documentedTransfers || []).find(t =>
    (t.from === basinA && t.to === basinB) || (t.from === basinB && t.to === basinA)) || null;
}

export const transferLabel = t => `${t.from} → ${t.to}, ${t.status}, depuis ${date(t.since)}`;

const round2 = v => Math.round(v * 100) / 100;

// Difference in percentage points, null when either fill is missing.
export const fillDelta = (a, b) => (typeof a === 'number' && typeof b === 'number' ? round2(a - b) : null);

// Signed number with a true minus sign; zero has no sign.
export function signed(v, digits = 2) {
  if (typeof v !== 'number') return '—';
  if (v === 0) return number(0, digits);
  return `${v > 0 ? '+' : '−'}${number(Math.abs(v), digits)}`;
}

// Rows of the collaboration table: neighbours of the selected region, highest fill first.
export function collaborationRows(doc, bulletin, region) {
  const own = regionBasin(bulletin, region);
  return neighboursOf(doc, region)
    .map(n => {
      const basin = regionBasin(bulletin, n);
      return {
        region: n,
        basin,
        fillPct: basin?.fillPct ?? null,
        storedMm3: basin?.storedMm3 ?? null,
        deltaPts: fillDelta(basin?.fillPct, own?.fillPct),
        transfer: transferBetween(doc, region.basin, n.basin),
      };
    })
    .sort((a, b) => (b.fillPct ?? -1) - (a.fillPct ?? -1) || a.region.name.localeCompare(b.region.name, 'fr'));
}

// Operator status tone: 'ok' only for a plain "en service"; anything qualified is 'watch'.
export function statusTone(status) {
  if (!status) return 'none';
  return status.trim().toLowerCase() === 'en service' ? 'ok' : 'watch';
}

// Five sequential steps of the basin fill scale (0-20, 20-40, 40-60, 60-80, 80-100 %).
export const FILL_STEPS = ['0 à 20 %', '20 à 40 %', '40 à 60 %', '60 à 80 %', '80 à 100 %'];
export function fillStep(pct) {
  if (typeof pct !== 'number') return null;
  return Math.min(FILL_STEPS.length - 1, Math.max(0, Math.floor(pct / 20)));
}

// Equirectangular projection with cos(lat) correction, fitted to a width.
// Returns SVG path data per region; no dependency.
export function projectRegions(geo, { width = 360, pad = 12 } = {}) {
  const ringsOf = g => (g.type === 'MultiPolygon' ? g.coordinates.flat(1) : g.coordinates);
  const features = geo.features.map(f => ({ id: f.properties.id, rings: ringsOf(f.geometry) }));
  const all = features.flatMap(f => f.rings.flat());
  const meanLat = all.reduce((s, [, lat]) => s + lat, 0) / all.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = all.map(([lon]) => lon * kx);
  const ys = all.map(([, lat]) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const scale = (width - 2 * pad) / (Math.max(...xs) - minX);
  const height = (Math.max(...ys) - minY) * scale + 2 * pad;
  const project = ([lon, lat]) => [pad + (lon * kx - minX) * scale, pad + (-lat - minY) * scale];
  return {
    width,
    height,
    features: features.map(f => ({
      id: f.id,
      d: f.rings
        .map(ring => `${ring
          .map((p, i) => {
            const [x, y] = project(p);
            return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join('')}Z`)
        .join(' '),
    })),
  };
}

export const REGION_SCOPE_NOTICE = 'Détail par ouvrage non intégré pour cette région : seul le Souss-Massa a des barrages, infrastructures et analyses détaillés dans cet outil.';

// Routes du hub : voir src/hub/routes.js (#/ récit, #/r/<région>[/<onglet>] exploration, #/sources, anciennes adresses redirigées).
export { parseHubRoute as parseRoute, hubHash as canonicalHash } from '../hub/routes.js';

// Unknown ids (or a list not yet loaded is the caller's concern) fall back to the default region.
export const resolveRegionId = (regions, id, defaultRegionId = DEFAULT_REGION_ID) => (
  id && regions.some(r => r.id === id) ? id : defaultRegionId
);

// Basin of a region by id, straight from the bulletin; null when the region has none or is unknown.
export const basinForRegionId = (doc, bulletin, id) => regionBasin(bulletin, regionById(doc, id));

// Neighbours with their basin fill (same helper as the collaboration table).
export const neighbourFills = (doc, bulletin, region) => collaborationRows(doc, bulletin, region);
