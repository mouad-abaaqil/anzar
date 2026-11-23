import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { LocateFixed, RotateCcw, WifiOff } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import './MapView.css';

maplibregl.setWorkerUrl(workerUrl);

const CAMERA = { center: [-9.18, 30.42], zoom: 7.75, bearing: -12, pitch: 50 };
const BASEMAP = 'https://tiles.openfreemap.org/styles/liberty';
const DEM = 'https://tiles.mapterhorn.com/tilejson.json';
const KIND_LABELS = { dam: 'Barrage', desalination: 'Dessalement', treatment: 'Épuration', groundwater: 'Nappe' };
const GLYPHS = {
  dam: '<path d="M4 8h16M6 8l-2 11h16L18 8M8 4v4m8-4v4M9 12v3m6-3v3"/>',
  desalination: '<path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z"/><path d="M3 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0"/>',
  treatment: '<path d="m5 8 4-4 4 4M9 4v10m10 2-4 4-4-4m4 4V10M4 15a8 8 0 0 0 3 5M20 9a8 8 0 0 0-3-5"/>',
  groundwater: '<path d="M3 7c3-3 6 3 9 0s6 3 9 0M3 12c3-3 6 3 9 0s6 3 9 0M3 17c3-3 6 3 9 0s6 3 9 0"/>',
};

const BRAND_BLUE = '#12508F';
const DESAL_GREEN = '#57B24A';
const REGION_URL = '/data/souss-massa-region.geojson';
const PROVINCES_URL = '/data/souss-massa-provinces.geojson';
const LIMITS_ATTRIBUTION = 'Limites : HCP / OCHA COD-AB (CC BY-IGO)';
const LABEL_FONT = ['Noto Sans Regular'];
const LABEL_LAYER = 'srm-column-labels';
const COLUMN_LAYERS = ['srm-dam-capacity', 'srm-dam-stored', 'srm-desal-capacity', 'srm-desal-objective'];
const COLUMN_VISIBILITY_LAYERS = [...COLUMN_LAYERS, 'srm-desal-objective-outline', LABEL_LAYER];
const NO_LABEL = '';
// Emprise carrée des colonnes, en mètres. Position approximative (point OSM représentatif).
const FOOTPRINT_M = 3500;
// Deux échelles séparées, une par grandeur : hauteur ∝ volume (Mm³) pour les barrages,
// hauteur ∝ débit de capacité (m³/j) pour le dessalement. Ce ne sont pas des hauteurs d'eau réelles.
const DAM_M_PER_MM3 = 20;
const DESAL_M_PER_M3_PER_DAY = 3500 / 275000;
const WORLD_RING = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

// Données de limites chargées une fois par session, partagées entre montages de la carte.
let regionDataPromise = null;

function loadRegionData() {
  if (!regionDataPromise) {
    regionDataPromise = Promise.all([REGION_URL, PROVINCES_URL].map((url) => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`);
      return response.json();
    })))
      .then(([region, provinces]) => buildRegionData(region, provinces))
      .catch(() => { regionDataPromise = null; return null; });
  }
  return regionDataPromise;
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(area) < 1e-12) return null;
  return { point: [cx / (3 * area), cy / (3 * area)], area: Math.abs(area / 2) };
}

function buildRegionData(region, provinces) {
  const regionFeatures = region?.features ?? [];
  const provinceFeatures = provinces?.features ?? [];
  if (!regionFeatures.length || !provinceFeatures.length) return null;

  const regionPolygons = regionFeatures.flatMap((feature) => polygonsOf(feature.geometry));
  // Anneau extérieur de chaque polygone = trou dans le masque mondial.
  const mask = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...regionPolygons.map((polygon) => polygon[0])] },
    }],
  };

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const polygon of regionPolygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;

  const provinceLabels = {
    type: 'FeatureCollection',
    features: provinceFeatures.flatMap((feature) => {
      const name = feature.properties?.adm2_name;
      if (!name) return [];
      // Le polygone le plus grand porte l'étiquette ; le centroïde évite les étiquettes sur les bords.
      const best = polygonsOf(feature.geometry)
        .map((polygon) => ringCentroid(polygon[0]))
        .filter(Boolean)
        .sort((a, b) => b.area - a.area)[0];
      if (!best) return [];
      return [{ type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: best.point } }];
    }),
  };

  return {
    region: { type: 'FeatureCollection', features: regionFeatures },
    provinces: { type: 'FeatureCollection', features: provinceFeatures },
    provinceLabels,
    mask,
    bounds: [[west, south], [east, north]],
  };
}

function hasCoordinates(coordinates) {
  return Array.isArray(coordinates) && coordinates.length === 2 && coordinates.every(Number.isFinite);
}

function footprint([lng, lat]) {
  const half = FOOTPRINT_M / 2;
  const dLat = half / 111320;
  const dLng = half / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

function metricValue(facility, label, unit) {
  const metric = facility.metrics?.find((item) => item.label === label && item.unit === unit);
  return Number.isFinite(metric?.value) ? metric.value : null;
}

function formatNumber(value, digits = 0) {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

function columnFeature(ring, facility, part, height) {
  return {
    type: 'Feature',
    properties: { id: facility.id, part, height },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

function labelFeature(facility, label) {
  return {
    type: 'Feature',
    properties: { id: facility.id, label },
    geometry: { type: 'Point', coordinates: facility.coordinates },
  };
}

// Colonnes des barrages (volume stocké et capacité dérivée) et du dessalement.
// La capacité d'un barrage n'est pas un champ de region.json : elle est dérivée de storageMm3 / fillPct.
function buildColumns(facilities, visibleKinds) {
  const columns = [];
  const labels = [];
  for (const facility of facilities) {
    if (!hasCoordinates(facility.coordinates) || !isVisible(facility.kind, visibleKinds)) continue;
    const ring = footprint(facility.coordinates);
    if (facility.kind === 'dam') {
      const stored = facility.storageMm3;
      const fill = facility.fillPct;
      if (!Number.isFinite(stored) || stored < 0 || !Number.isFinite(fill) || fill <= 0) continue;
      const capacity = stored / (fill / 100);
      columns.push(
        columnFeature(ring, facility, 'dam-capacity', capacity * DAM_M_PER_MM3),
        columnFeature(ring, facility, 'dam-stored', stored * DAM_M_PER_MM3),
      );
      labels.push(labelFeature(facility, `${facility.name}\n${formatNumber(fill, 1)} % · ${formatNumber(stored, 2)} / ${formatNumber(capacity, 2)} Mm³`));
    } else if (facility.kind === 'desalination') {
      const initial = metricValue(facility, 'Capacité initiale', 'm³/j');
      const objective = metricValue(facility, 'Extension annoncée', 'm³/j');
      if (initial !== null) columns.push(columnFeature(ring, facility, 'desal-capacity', initial * DESAL_M_PER_M3_PER_DAY));
      if (objective !== null) columns.push(columnFeature(ring, facility, 'desal-objective', objective * DESAL_M_PER_M3_PER_DAY));
      const lines = [facility.name];
      if (initial !== null) lines.push(`capacité initiale ${formatNumber(initial)} m³/j`);
      if (objective !== null) lines.push(`objectif, non confirmé ${formatNumber(objective)} m³/j`);
      if (lines.length > 1) labels.push(labelFeature(facility, lines.join('\n')));
    }
  }
  return {
    columns: { type: 'FeatureCollection', features: columns },
    labels: { type: 'FeatureCollection', features: labels },
  };
}

function addSourceOnce(map, id, data) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data });
}

function setSourceData(map, id, data) {
  const source = map.getSource(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

function addLayerOnce(map, layer) {
  if (!map.getLayer(layer.id)) map.addLayer(layer);
}

function setColumnLabel(map, id) {
  if (map.getLayer(LABEL_LAYER)) map.setFilter(LABEL_LAYER, ['==', ['get', 'id'], id || NO_LABEL]);
}

// Ajoute ou rafraîchit les couches de région et de colonnes. Idempotent, appelé après load et style.load.
function syncOverlay(map, { region, columns, labels, terrain, activeId }) {
  if (!region) return;
  addSourceOnce(map, 'srm-mask', region.mask);
  addSourceOnce(map, 'srm-region', region.region);
  addSourceOnce(map, 'srm-provinces', region.provinces);
  addSourceOnce(map, 'srm-province-points', region.provinceLabels);
  setSourceData(map, 'srm-columns', columns);
  setSourceData(map, 'srm-column-labels', labels);

  addLayerOnce(map, { id: 'srm-mask', type: 'fill', source: 'srm-mask', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.55 } });
  addLayerOnce(map, { id: 'srm-region-line', type: 'line', source: 'srm-region', layout: { 'line-join': 'round' }, paint: { 'line-color': BRAND_BLUE, 'line-width': 2 } });
  addLayerOnce(map, { id: 'srm-province-line', type: 'line', source: 'srm-provinces', paint: { 'line-color': BRAND_BLUE, 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.6 } });
  addLayerOnce(map, { id: 'srm-dam-capacity', type: 'fill-extrusion', source: 'srm-columns', filter: ['==', ['get', 'part'], 'dam-capacity'], paint: {
    'fill-extrusion-color': BRAND_BLUE, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.22,
  } });
  addLayerOnce(map, { id: 'srm-dam-stored', type: 'fill-extrusion', source: 'srm-columns', filter: ['==', ['get', 'part'], 'dam-stored'], paint: {
    'fill-extrusion-color': BRAND_BLUE, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.95,
  } });
  addLayerOnce(map, { id: 'srm-desal-capacity', type: 'fill-extrusion', source: 'srm-columns', filter: ['==', ['get', 'part'], 'desal-capacity'], paint: {
    'fill-extrusion-color': DESAL_GREEN, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92,
  } });
  addLayerOnce(map, { id: 'srm-desal-objective', type: 'fill-extrusion', source: 'srm-columns', filter: ['==', ['get', 'part'], 'desal-objective'], paint: {
    'fill-extrusion-color': DESAL_GREEN, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.14,
  } });
  addLayerOnce(map, { id: 'srm-desal-objective-outline', type: 'line', source: 'srm-columns', filter: ['==', ['get', 'part'], 'desal-objective'], paint: {
    'line-color': DESAL_GREEN, 'line-width': 1.5, 'line-dasharray': [2, 2],
  } });
  addLayerOnce(map, { id: 'srm-province-labels', type: 'symbol', source: 'srm-province-points', minzoom: 8, layout: {
    'text-field': ['get', 'name'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-allow-overlap': false,
  }, paint: { 'text-color': BRAND_BLUE, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
  addLayerOnce(map, { id: LABEL_LAYER, type: 'symbol', source: 'srm-column-labels', layout: {
    'text-field': ['get', 'label'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-allow-overlap': true,
    'text-anchor': 'bottom', 'text-offset': [0, -0.6], 'text-justify': 'center',
  }, paint: { 'text-color': BRAND_BLUE, 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });

  const columnVisibility = terrain ? 'visible' : 'none';
  for (const id of COLUMN_VISIBILITY_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', columnVisibility);
  }
  setColumnLabel(map, activeId);
}

function applyTerrain(map, enabled) {
  if (!map.isStyleLoaded()) return;
  if (!map.getSource('srm-dem')) {
    map.addSource('srm-dem', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
    map.addSource('srm-hillshade', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
    const labelLayer = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
    map.addLayer({ id: 'srm-hillshade', source: 'srm-hillshade', type: 'hillshade', paint: {
      'hillshade-shadow-color': '#4d655d', 'hillshade-highlight-color': '#fafbf2',
      'hillshade-accent-color': '#688575', 'hillshade-exaggeration': 0.58,
    } }, labelLayer);
  }
  map.setTerrain(enabled ? { source: 'srm-dem', exaggeration: 1.3 } : null);
  map.setLayoutProperty('srm-hillshade', 'visibility', enabled ? 'visible' : 'none');
}

function tuneBasemap(map, basemap) {
  if (!map.isStyleLoaded()) return;
  const relief = basemap !== 'streets' && basemap !== 'plan';
  for (const layer of map.getStyle().layers) {
    const sourceLayer = layer['source-layer'];
    try {
      if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', relief ? '#e6e8db' : '#f1f3ec');
      if (layer.type === 'fill' && sourceLayer === 'water') map.setPaintProperty(layer.id, 'fill-color', '#98c6cf');
      if (layer.type === 'line' && sourceLayer === 'waterway') map.setPaintProperty(layer.id, 'line-color', '#66a9bd');
      if (layer.type === 'fill' && sourceLayer === 'landcover') map.setPaintProperty(layer.id, 'fill-opacity', relief ? 0.43 : 0.18);
      if (layer.type === 'fill' && sourceLayer === 'landuse') map.setPaintProperty(layer.id, 'fill-opacity', relief ? 0.38 : 0.2);
    } catch { /* Optional upstream style layers must not prevent map use. */ }
  }
}

function isVisible(kind, visibleKinds) {
  if (!visibleKinds) return true;
  if (visibleKinds instanceof Set) return visibleKinds.has(kind);
  if (Array.isArray(visibleKinds)) return visibleKinds.includes(kind);
  return visibleKinds[kind] !== false;
}

function boundsFromPoints(facilities) {
  const points = facilities.map((facility) => facility.coordinates).filter(hasCoordinates);
  if (!points.length) return null;
  return points.reduce((result, coordinates) => result.extend(coordinates), new maplibregl.LngLatBounds(points[0], points[0]));
}

export default function MapView({ facilities = [], selectedId, onSelect, visibleKinds, terrain = true, basemap = 'relief', onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const initialFitRef = useRef(false);
  const previousSelectionRef = useRef(selectedId);
  const regionalBoundsRef = useRef(null);
  const regionDataRef = useRef(null);
  const columnDataRef = useRef({ columns: EMPTY_COLLECTION, labels: EMPTY_COLLECTION });
  const overlayRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const optionsRef = useRef({ terrain, basemap, onReady });
  const selectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const [status, setStatus] = useState('loading');
  const [warning, setWarning] = useState('');
  const [generation, setGeneration] = useState(0);
  optionsRef.current = { terrain, basemap, onReady };
  selectRef.current = onSelect;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    let map;
    let cancelled = false;
    let resize;
    initialFitRef.current = false;
    previousSelectionRef.current = selectedId;
    setStatus('loading');
    setWarning('');
    const online = () => { setWarning(''); if (map?.isStyleLoaded()) setStatus('ready'); };
    const offline = () => { setWarning('Connexion interrompue. Les tuiles déjà chargées restent visibles.'); };
    const timeout = window.setTimeout(() => {
      if (!cancelled && !map?.isStyleLoaded()) setStatus('error');
    }, 22000);
    try {
      map = new maplibregl.Map({
        container: containerRef.current, style: BASEMAP,
        ...CAMERA, pitch: optionsRef.current.terrain ? CAMERA.pitch : 0,
        minZoom: 5, maxZoom: 17, maxPitch: 75,
        attributionControl: { compact: true },
        customAttribution: LIMITS_ATTRIBUTION,
        canvasContextAttributes: { antialias: true },
      });
      mapRef.current = map;
      if (import.meta.env.MODE === 'development') window.__srmMap = map;
      const refreshOverlay = () => {
        const region = regionDataRef.current;
        if (!region) return;
        syncOverlay(map, {
          region,
          columns: columnDataRef.current.columns,
          labels: columnDataRef.current.labels,
          terrain: optionsRef.current.terrain,
          activeId: hoveredIdRef.current || selectedIdRef.current,
        });
      };
      overlayRef.current = refreshOverlay;
      const updateLabelDensity = () => containerRef.current?.setAttribute('data-overview', String(map.getZoom() < 9));
      updateLabelDensity();
      map.on('zoom', updateLabelDensity);
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');
      map.on('style.load', refreshOverlay);
      map.on('load', () => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        tuneBasemap(map, optionsRef.current.basemap);
        applyTerrain(map, optionsRef.current.terrain);
        loadRegionData().then((region) => {
          if (cancelled) return;
          regionDataRef.current = region;
          if (region) regionalBoundsRef.current = new maplibregl.LngLatBounds(region.bounds[0], region.bounds[1]);
          refreshOverlay();
          // Interactions sur les colonnes : survol affiche l'étiquette, clic sélectionne le site.
          // Enregistrées après l'ajout des couches pour que les identifiants existent.
          map.on('mousemove', COLUMN_LAYERS, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (id && id !== hoveredIdRef.current) {
              hoveredIdRef.current = id;
              setColumnLabel(map, hoveredIdRef.current || selectedIdRef.current);
            }
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', COLUMN_LAYERS, () => {
            hoveredIdRef.current = null;
            setColumnLabel(map, selectedIdRef.current);
            map.getCanvas().style.cursor = '';
          });
          map.on('click', COLUMN_LAYERS, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (id) selectRef.current?.(id);
          });
          setStatus('ready');
          optionsRef.current.onReady?.(map);
        });
      });
      map.on('error', (event) => {
        if (cancelled) return;
        if (event.sourceId === 'srm-dem' || event.sourceId === 'srm-hillshade') setWarning('Le relief est temporairement indisponible. Le fond de carte reste accessible.');
        else if (!event.sourceId && !map.isStyleLoaded()) setStatus('error');
        else if (event.sourceId) setWarning('Certaines tuiles sont indisponibles. La carte peut être incomplète.');
      });
      map.getCanvas().addEventListener('webglcontextlost', () => { if (!cancelled) setStatus('error'); });
      resize = new ResizeObserver(() => map.resize());
      resize.observe(containerRef.current);
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
      if (!navigator.onLine) offline();
    } catch { setStatus('error'); }
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      resize?.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      mapRef.current = null;
      overlayRef.current = null;
      hoveredIdRef.current = null;
      map?.remove();
    };
  }, [generation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || initialFitRef.current) return;
    const bounds = regionalBoundsRef.current || boundsFromPoints(facilities);
    if (!bounds) return;
    regionalBoundsRef.current = bounds;
    initialFitRef.current = true;
    previousSelectionRef.current = selectedId;
    map.fitBounds(bounds, { padding: { top: 55, bottom: 45, left: 50, right: 50 }, maxZoom: 8.3, bearing: -12, pitch: terrain ? CAMERA.pitch : 0, duration: 0 });
  }, [facilities, status, selectedId, terrain]);

  useEffect(() => {
    columnDataRef.current = buildColumns(facilities, visibleKinds);
    const map = mapRef.current;
    if (map && status === 'ready') overlayRef.current?.();
  }, [facilities, visibleKinds, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    applyTerrain(map, terrain);
    overlayRef.current?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({ pitch: terrain ? CAMERA.pitch : 0, duration: reduced ? 0 : 850 });
  }, [terrain, status]);

  useEffect(() => {
    if (mapRef.current && status === 'ready') tuneBasemap(mapRef.current, basemap);
  }, [basemap, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = facilities.filter((facility) => {
      const c = facility.coordinates;
      return hasCoordinates(c) && isVisible(facility.kind, visibleKinds);
    }).map((facility) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `srm-map-marker srm-map-marker--${facility.kind}${facility.id === selectedId ? ' is-selected' : ''}`;
      element.setAttribute('aria-label', `${KIND_LABELS[facility.kind] || 'Site'} : ${facility.name}`);
      element.setAttribute('aria-pressed', String(facility.id === selectedId));
      element.title = `${KIND_LABELS[facility.kind] || 'Site'} : ${facility.name}`;
      const pin = document.createElement('span');
      pin.className = 'srm-map-marker__pin';
      pin.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[facility.kind] || GLYPHS.dam}</svg>`;
      element.append(pin);
      const caption = document.createElement('span');
      caption.className = 'srm-map-marker__caption';
      const name = document.createElement('span');
      name.className = 'srm-map-marker__name';
      name.textContent = facility.name.replace(/^Barrage\s+/i, '');
      caption.append(name);
      if (facility.kind === 'dam' && Number.isFinite(facility.fillPct)) {
        const fill = document.createElement('span');
        fill.className = 'srm-map-marker__value';
        fill.textContent = `${facility.fillPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
        caption.append(fill);
      }
      element.append(caption);
      element.addEventListener('click', (event) => { event.stopPropagation(); selectRef.current?.(facility.id); });
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(facility.coordinates).addTo(map);
      return { marker, element, id: facility.id };
    });
  }, [facilities, visibleKinds, generation, status]);

  useEffect(() => {
    const map = mapRef.current;
    for (const item of markersRef.current) {
      item.element.classList.toggle('is-selected', item.id === selectedId);
      item.element.setAttribute('aria-pressed', String(item.id === selectedId));
    }
    if (map && status === 'ready') setColumnLabel(map, hoveredIdRef.current || selectedId);
    if (!initialFitRef.current || selectedId === previousSelectionRef.current) return;
    previousSelectionRef.current = selectedId;
    const selected = facilities.find((facility) => facility.id === selectedId);
    if (map && status === 'ready' && hasCoordinates(selected?.coordinates)) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      map.flyTo({ center: selected.coordinates, zoom: Math.max(map.getZoom(), 8.8), speed: 0.65, essential: false, duration: reduced ? 0 : 1400 });
    }
  }, [selectedId, facilities, status]);

  return <div className="srm-map-view" aria-label="Carte géographique interactive du Souss-Massa">
    <div ref={containerRef} className="srm-map-canvas" />
    <button className="srm-map-home" type="button" aria-label="Recentrer la carte sur le Souss-Massa" title="Vue régionale" onClick={() => {
      const map = mapRef.current;
      if (!map) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (regionalBoundsRef.current) map.fitBounds(regionalBoundsRef.current, { padding: { top: 55, bottom: 45, left: 50, right: 50 }, maxZoom: 8.3, bearing: -12, pitch: terrain ? CAMERA.pitch : 0, duration: reduced ? 0 : 1000 });
      else map.flyTo({ ...CAMERA, pitch: terrain ? CAMERA.pitch : 0, essential: false, duration: reduced ? 0 : 1000 });
    }}><LocateFixed size={18} /></button>
    {status === 'loading' && <div className="srm-map-state" role="status"><span className="srm-map-loader" /><strong>Chargement de la carte</strong><span>Fond de carte et relief</span></div>}
    {status === 'error' && <div className="srm-map-state srm-map-state--error" role="alert"><WifiOff size={25} /><strong>La carte est indisponible</strong><span>Vérifiez votre connexion et la disponibilité de WebGL. Les données des ouvrages restent accessibles dans la liste.</span><button type="button" onClick={() => setGeneration((value) => value + 1)}><RotateCcw size={15} /> Réessayer</button></div>}
    {warning && <div className="srm-map-warning" role="status"><WifiOff size={15} /><span>{warning}</span></div>}
  </div>;
}
