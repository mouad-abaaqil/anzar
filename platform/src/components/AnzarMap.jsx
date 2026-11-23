import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './AnzarMap.css';

maplibregl.setWorkerUrl(workerUrl);

// Même fond, même relief (Mapterhorn) et même encodage que MapView.jsx.
const BASEMAP = 'https://tiles.openfreemap.org/styles/liberty';
const DEM = 'https://tiles.mapterhorn.com/tilejson.json';
const REGIONS_URL = '/data/morocco-regions.geojson';
const DAMS_URL = '/data/region.json';
const NATIONAL_VIEW = { center: [-8.2, 28.5], zoom: 4.2, bearing: -6, pitch: 50 }; // repli avant calcul
const NATIONAL_BOUNDS = [[-17.3, 20.6], [-0.9, 36.0]]; // repli avant chargement des régions
const TOUR_MS = 3400;
const TOUR_PAUSE_MS = 700;
const TOP_VIEW = { bearing: 0, pitch: 0 };
const SRC = 'anzar-regions';
const NO_MODEL_COLOR = '#aeb4ad';
const BAND_COLORS = { critique: '#c4452f', tendu: '#e0a41f', confortable: '#2c9a86' };
const BAND_LABELS = { critique: 'Critique', tendu: 'Tendu', confortable: 'Confortable' };
// Indicateur de flux (régions sans barrage rattaché, ex. Sahara marocain) : autre famille de teintes (bleus) et hauteur
// fixe, pour ne jamais être lu sur l'échelle des mois de couverture.
const FLUX_COLORS = { dominant: '#1f6fa8', mixte: '#6fa8d2', faible: '#b9d4ea' };
const FLUX_LABELS = { dominant: 'Dessalement ≥ 80 % du potable', mixte: 'Dessalement 30 à 80 %', faible: 'Dessalement < 30 % (nappes)' };
const FLUX_HEIGHT = 4500;
const isFlux = (entry) => entry?.kind === 'flux' && Number.isFinite(entry.value) && entry.band in FLUX_COLORS;
const isModeled = (entry) => isFlux(entry) || (Number.isFinite(entry?.value) && entry.band in BAND_COLORS);
const BASE_HEIGHT = 2500;
const MAX_EXTRA_HEIGHT = 16000;
const FLAT_HEIGHT = 1200;
const TWEEN_MS = 800;

const prefersReducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toCss = (rgb) => `rgb(${rgb.map((v) => Math.round(v)).join(',')})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (t) => 1 - (1 - t) ** 3;

function targetFor(entry, maxValue) {
  if (isFlux(entry)) return { rgb: hexToRgb(FLUX_COLORS[entry.band]), h: FLUX_HEIGHT };
  const hasValue = entry && Number.isFinite(entry.value) && entry.band in BAND_COLORS;
  if (!hasValue) return { rgb: hexToRgb(NO_MODEL_COLOR), h: FLAT_HEIGHT };
  const share = maxValue > 0 ? Math.min(1, Math.max(0, entry.value / maxValue)) : 0;
  return { rgb: hexToRgb(BAND_COLORS[entry.band]), h: BASE_HEIGHT + MAX_EXTRA_HEIGHT * share };
}

function hatchImage() {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e4e7e1';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#8d948c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const o of [-size, 0, size]) { ctx.moveTo(o, size); ctx.lineTo(o + size, 0); }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

function nationalPadding(el) {
  const w = el?.clientWidth || 1000;
  return w < 600 ? { top: 70, bottom: 60, left: 16, right: 16 } : { top: 70, bottom: 50, left: 40, right: 40 };
}

function geometryBounds(geometry) {
  const b = new maplibregl.LngLatBounds();
  const walk = (c) => (typeof c[0] === 'number' ? b.extend(c) : c.forEach(walk));
  walk(geometry.coordinates);
  return b;
}

const fmt = (v, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

export default function AnzarMap({ metricByRegion = {}, metricLabel = '', selectedId, onSelect, year, onReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const namesRef = useRef({});
  const damsRef = useRef([]);
  const propsRef = useRef({});
  const visualRef = useRef({}); // id -> { rgb, h } valeurs affichées
  const hoverRef = useRef(null);
  const rafRef = useRef(0);
  const topRef = useRef(false);
  const nationalRef = useRef(NATIONAL_VIEW);
  const tourRef = useRef({ active: false });
  const initialSelectDone = useRef(false);
  const [status, setStatus] = useState('loading');
  const [tip, setTip] = useState(null);
  const [top, setTop] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const hasFlux = Object.values(metricByRegion).some(isFlux);
  const [touring, setTouring] = useState(false);
  const [tourName, setTourName] = useState('');
  const reduced = prefersReducedMotion();
  propsRef.current = { metricByRegion, metricLabel, selectedId, onSelect, year, onReady };

  const paint = () => {
    const map = mapRef.current;
    if (!map || !map.getSource(SRC)) return;
    for (const [id, v] of Object.entries(visualRef.current)) {
      const lit = id === hoverRef.current || id === propsRef.current.selectedId;
      map.setFeatureState({ source: SRC, id }, {
        color: toCss(lit ? mix(v.rgb, [255, 255, 255], 0.2) : v.rgb),
        h: v.h + (lit ? 1800 : 0),
      });
    }
  };

  const syncNoModel = () => {
    const map = mapRef.current;
    const src = map?.getSource('anzar-nomodel');
    const geo = geoRef.current;
    if (!src || !geo) return;
    const m = propsRef.current.metricByRegion;
    src.setData({
      type: 'FeatureCollection',
      features: geo.features.filter((f) => !isModeled(m[f.properties.id])),
    });
  };

  const animateTo = () => {
    const m = propsRef.current.metricByRegion;
    const geo = geoRef.current;
    if (!geo || !mapRef.current) return;
    const values = Object.values(m).filter((e) => !isFlux(e)).map((e) => e?.value).filter(Number.isFinite);
    const maxValue = values.length ? Math.max(...values) : 0;
    const from = {};
    const to = {};
    for (const f of geo.features) {
      const id = f.properties.id;
      to[id] = targetFor(m[id], maxValue);
      from[id] = visualRef.current[id] || { rgb: to[id].rgb, h: FLAT_HEIGHT };
    }
    syncNoModel();
    cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion()) {
      visualRef.current = to;
      paint();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const k = ease(t);
      const next = {};
      for (const id of Object.keys(to)) next[id] = { rgb: mix(from[id].rgb, to[id].rgb, k), h: from[id].h + (to[id].h - from[id].h) * k };
      visualRef.current = next;
      paint();
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    let cancelled = false;
    let map;
    let damMarkers = [];
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP,
        bounds: NATIONAL_BOUNDS,
        fitBoundsOptions: { padding: nationalPadding(containerRef.current), bearing: NATIONAL_VIEW.bearing, pitch: NATIONAL_VIEW.pitch },
        minZoom: 2,
        maxZoom: 12,
        maxPitch: 75,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
    } catch {
      setStatus('error');
      return undefined;
    }
    mapRef.current = map;
    // Légende dépliée d'office seulement si la carte est assez large pour ne pas masquer le sud du pays.
    if ((containerRef.current?.clientWidth || 0) >= 900) setLegendOpen(true);
    if (import.meta.env.MODE !== 'production') window.__anzarMap = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');
    const timeout = window.setTimeout(() => { if (!cancelled && !map.isStyleLoaded()) setStatus('error'); }, 22000);

    map.on('load', async () => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      try {
        const [geo, region, regMeta] = await Promise.all([
          fetch(REGIONS_URL).then((r) => r.json()),
          fetch(DAMS_URL).then((r) => r.json()).catch(() => ({ facilities: [] })),
          fetch('/data/regions.json').then((r) => r.json()).catch(() => ({ regions: [] })),
        ]);
        namesRef.current = Object.fromEntries((regMeta.regions || []).map((r) => [r.id, r.name]));
        if (cancelled) return;
        geoRef.current = geo;
        const all = new maplibregl.LngLatBounds();
        for (const ft of geo.features) all.extend(geometryBounds(ft.geometry));
        const cam = map.cameraForBounds(all, { padding: nationalPadding(containerRef.current), bearing: NATIONAL_VIEW.bearing, pitch: NATIONAL_VIEW.pitch });
        if (cam) {
          nationalRef.current = { center: cam.center, zoom: cam.zoom, bearing: NATIONAL_VIEW.bearing, pitch: NATIONAL_VIEW.pitch };
          map.jumpTo(nationalRef.current);
        }
        damsRef.current = (region.facilities || []).filter((f) => f.kind === 'dam'
          && Array.isArray(f.coordinates) && Number.isFinite(f.storageMm3) && f.fillPct > 0);

        for (const style of map.getStyle().layers) {
          if (style.type === 'background') map.setPaintProperty(style.id, 'background-color', '#e6e8db');
        }
        map.addSource('anzar-dem', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
        map.addSource('anzar-hillshade', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
        const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
        map.addLayer({ id: 'anzar-hillshade', source: 'anzar-hillshade', type: 'hillshade', paint: {
          'hillshade-shadow-color': '#4d655d', 'hillshade-highlight-color': '#fafbf2',
          'hillshade-accent-color': '#688575', 'hillshade-exaggeration': 0.58,
        } }, firstSymbol);
        map.setTerrain({ source: 'anzar-dem', exaggeration: 1.3 });
        map.addImage('anzar-hatch', hatchImage(), { pixelRatio: 2 });

        map.addSource(SRC, { type: 'geojson', data: geo, promoteId: 'id' });
        map.addSource('anzar-nomodel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'anzar-extrusion', type: 'fill-extrusion', source: SRC, paint: {
          'fill-extrusion-color': ['coalesce', ['feature-state', 'color'], NO_MODEL_COLOR],
          'fill-extrusion-height': ['coalesce', ['feature-state', 'h'], FLAT_HEIGHT],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.88,
        } });
        map.addLayer({ id: 'anzar-nomodel-hatch', type: 'fill', source: 'anzar-nomodel', paint: {
          'fill-pattern': 'anzar-hatch', 'fill-opacity': 0.85,
        } });
        map.addLayer({ id: 'anzar-outline', type: 'line', source: SRC, paint: {
          'line-color': '#ffffff', 'line-width': 1.2, 'line-opacity': 0.9,
        } });
        map.addLayer({ id: 'anzar-selected', type: 'line', source: SRC, filter: ['==', ['get', 'id'], ''], paint: {
          'line-color': '#12508F', 'line-width': 3,
        } });

        // Les barrages sont des marqueurs HTML : un cercle de la couche carte serait caché par
        // les extrusions (test de profondeur). Aire du disque ∝ capacité (Mm³).
        const sizeMarkers = () => {
          const z = Math.min(1.6, Math.max(0.7, 0.55 + (map.getZoom() - 4) * 0.18));
          for (const mk of damMarkers) mk.getElement().style.setProperty('--d', `${Math.max(7, 2.4 * Math.sqrt(mk.capacity) * z)}px`);
        };
        damMarkers = damsRef.current.map((d) => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'anzar-map__dam';
          const capacity = d.storageMm3 / (d.fillPct / 100);
          el.setAttribute('aria-label', `Barrage ${d.name}, capacité ${fmt(capacity, 1)} millions de m³`);
          const info = () => setTip({ ...(el.__pt || { x: 20, y: 20 }), title: `Barrage ${d.name}`,
            lines: [`Capacité ${fmt(capacity, 1)} Mm³`, `Remplissage ${fmt(d.fillPct, 1)} % au ${d.asOf || 'date non précisée'}`] });
          el.addEventListener('mouseenter', (ev) => {
            const r = containerRef.current.getBoundingClientRect();
            el.__pt = { x: ev.clientX - r.left, y: ev.clientY - r.top };
            hoverRef.current = null; paint(); info();
          });
          el.addEventListener('mouseleave', () => setTip(null));
          el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); const c = containerRef.current.getBoundingClientRect(); el.__pt = { x: r.left - c.left, y: r.top - c.top }; info(); });
          el.addEventListener('blur', () => setTip(null));
          const mk = new maplibregl.Marker({ element: el }).setLngLat(d.coordinates).addTo(map);
          mk.capacity = capacity;
          return mk;
        });
        sizeMarkers();
        map.on('zoom', sizeMarkers);

        map.on('mousemove', 'anzar-extrusion', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const id = f.properties.id;
          map.getCanvas().style.cursor = 'pointer';
          if (hoverRef.current !== id) { hoverRef.current = id; paint(); }
          const entry = propsRef.current.metricByRegion[id];
          const flux = isFlux(entry);
          const modeled = isModeled(entry);
          const lines = !modeled ? ['Non modélisé']
            : flux ? [`Indicateur de flux : ${entry.label ?? fmt(entry.value, 0) + ' %'}`, `${FLUX_LABELS[entry.band]} · pas de barrage rattaché, aucun stock`]
              : [`${propsRef.current.metricLabel || 'Indicateur'} : ${entry.label ?? fmt(entry.value, 1)}${entry.band ? ` (${BAND_LABELS[entry.band] || entry.band})` : ''}`];
          setTip({ x: e.point.x, y: e.point.y, title: namesRef.current[f.properties.id] || f.properties.name, lines });
        });
        map.on('mouseleave', 'anzar-extrusion', () => { hoverRef.current = null; map.getCanvas().style.cursor = ''; setTip(null); paint(); });
        map.on('click', 'anzar-extrusion', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          propsRef.current.onSelect?.(f.properties.id);
        });

        animateTo();
        if (propsRef.current.selectedId) map.setFilter('anzar-selected', ['==', ['get', 'id'], propsRef.current.selectedId]);
        setStatus('ready');
        propsRef.current.onReady?.(map);
      } catch {
        if (!cancelled) setStatus('error');
      }
    });
    map.on('error', (e) => { if (!map.isStyleLoaded() && !e?.error?.message?.includes('tile')) setStatus((s) => (s === 'ready' ? s : 'error')); });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
      tourRef.current.active = false;
      if (import.meta.env.MODE !== 'production' && window.__anzarMap === map) delete window.__anzarMap;
      damMarkers.forEach((mk) => mk.remove());
      map.remove();
      mapRef.current = null;
      geoRef.current = null;
      visualRef.current = {};
    };
  }, []);

  // Valeurs ou année qui changent : transition de couleur et de hauteur.
  useEffect(() => { animateTo(); }, [metricByRegion, year]);

  // Sélection : contour, surbrillance et vol animé vers la région.
  useEffect(() => {
    const map = mapRef.current;
    const geo = geoRef.current;
    if (!map || !geo || status !== 'ready') return;
    map.setFilter('anzar-selected', ['==', ['get', 'id'], selectedId || '']);
    paint();
    if (tourRef.current.active) stopTour();
    // Premier affichage : on garde la vue Maroc entier (la région choisie est seulement surlignée).
    if (!initialSelectDone.current) { initialSelectDone.current = true; return; }
    const feature = geo.features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    const bounds = geometryBounds(feature.geometry);
    const camera = map.cameraForBounds(bounds, { padding: 70, maxZoom: 8 });
    if (!camera) return;
    const target = { ...camera, bearing: topRef.current ? 0 : nationalRef.current.bearing, pitch: topRef.current ? 0 : 55 };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 1600, essential: false });
  }, [selectedId, status]);

  const toggleTop = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !topRef.current;
    topRef.current = next;
    setTop(next);
    const camera = next ? TOP_VIEW : { bearing: nationalRef.current.bearing, pitch: nationalRef.current.pitch };
    map.setTerrain(next ? null : { source: 'anzar-dem', exaggeration: 1.3 });
    if (prefersReducedMotion()) map.jumpTo(camera);
    else map.easeTo({ ...camera, duration: 900 });
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    stopTour();
    const camera = topRef.current ? { ...nationalRef.current, ...TOP_VIEW } : nationalRef.current;
    if (prefersReducedMotion()) map.jumpTo(camera);
    else map.flyTo({ ...camera, duration: 1400 });
  };

  function stopTour() {
    if (!tourRef.current.active) return;
    tourRef.current.active = false;
    setTouring(false);
    setTourName('');
    mapRef.current?.stop();
  }

  const startTour = async () => {
    const map = mapRef.current;
    const geo = geoRef.current;
    if (!map || !geo || prefersReducedMotion()) return;
    if (tourRef.current.active) { stopTour(); return; }
    const run = { active: true };
    tourRef.current = run;
    setTouring(true);
    const interrupt = (e) => { if (e.originalEvent && run.active) stopTour(); };
    map.on('dragstart', interrupt);
    map.on('zoomstart', interrupt);
    map.on('rotatestart', interrupt);
    map.on('pitchstart', interrupt);
    const fly = (camera, duration) => new Promise((resolve) => {
      map.once('moveend', resolve);
      map.flyTo({ ...camera, duration, essential: false });
    });
    try {
      for (const ft of geo.features) {
        if (!run.active) break;
        const cam = map.cameraForBounds(geometryBounds(ft.geometry), { padding: 70, maxZoom: 7 });
        if (!cam) continue;
        setTourName(namesRef.current[ft.properties.id] || ft.properties.name || '');
        await fly({ ...cam, bearing: topRef.current ? 0 : nationalRef.current.bearing, pitch: topRef.current ? 0 : 55 }, TOUR_MS);
        if (!run.active) break;
        await new Promise((r) => window.setTimeout(r, TOUR_PAUSE_MS));
      }
      if (run.active) await fly(topRef.current ? { ...nationalRef.current, ...TOP_VIEW } : nationalRef.current, TOUR_MS);
    } finally {
      map.off('dragstart', interrupt);
      map.off('zoomstart', interrupt);
      map.off('rotatestart', interrupt);
      map.off('pitchstart', interrupt);
      if (tourRef.current === run) { run.active = false; setTouring(false); setTourName(''); }
    }
  };

  return (
    <div className="anzar-map" role="region" aria-label="Carte nationale des régions du Maroc">
      <div ref={containerRef} className="anzar-map__canvas" />
      {status === 'loading' && <p className="anzar-map__status" role="status">Chargement du relief…</p>}
      {status === 'error' && (
        <p className="anzar-map__status anzar-map__status--error" role="alert">
          Carte 3D indisponible (WebGL ou réseau). Les indicateurs restent disponibles dans le tableau.
        </p>
      )}
      {tip && (
        <div className="anzar-map__tip" style={{ left: tip.x + 14, top: tip.y + 14 }} role="tooltip">
          <strong>{tip.title}</strong>
          {tip.lines.map((l) => <span key={l}>{l}</span>)}
        </div>
      )}
      <div className="anzar-map__controls">
        <button type="button" onClick={toggleTop} aria-pressed={top}>{top ? 'Vue 3D' : 'Vue du dessus'}</button>
        <button type="button" onClick={resetView}>Maroc entier</button>
        <button type="button" onClick={startTour} disabled={reduced || status !== 'ready'} aria-pressed={touring}
          title={reduced ? 'Désactivé : votre système demande de limiter les animations' : undefined}>
          {touring ? 'Arrêter le tour' : 'Tour d’horizon'}
        </button>
      </div>
      {touring && tourName && <p className="anzar-map__tour" role="status" aria-live="polite">{tourName}</p>}
      <aside className={`anzar-map__legend${legendOpen ? '' : ' is-collapsed'}`} aria-label="Légende">
        <button type="button" className="anzar-map__legend-toggle" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen}>
          <span className="anzar-map__legend-title">{metricLabel || 'Indicateur'}{year && !String(metricLabel || '').includes(String(year)) ? ` · ${year}` : ''}</span>
          {legendOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
          <span className="anzar-map__sr">{legendOpen ? 'Replier la légende' : 'Déplier la légende'}</span>
        </button>
        {legendOpen && <><ul>
          {Object.keys(BAND_COLORS).map((b) => (
            <li key={b}><i style={{ background: BAND_COLORS[b] }} />{BAND_LABELS[b]}</li>
          ))}
          <li><i className="anzar-map__hatch" />Non modélisé</li>
          <li><i className="anzar-map__dot" />Barrage (surface ∝ capacité)</li>
        </ul>
        {hasFlux && (
          <div className="anzar-map__flux">
            <strong>Indicateur de flux, différent des mois de couverture</strong>
            <ul>
              {Object.keys(FLUX_COLORS).map((b) => (
                <li key={b}><i style={{ background: FLUX_COLORS[b] }} />{FLUX_LABELS[b]}</li>
              ))}
            </ul>
            <span>Sans barrage rattaché : hauteur fixe, aucun stock.</span>
          </div>
        )}
        <p className="anzar-map__legend-note">Hauteur ∝ valeur de l’indicateur. Barrages : seuls ceux du Souss-Massa sont documentés.</p></>}
      </aside>
    </div>
  );
}
