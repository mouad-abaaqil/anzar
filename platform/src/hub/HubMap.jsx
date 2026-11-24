import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { colors, Legend, MicroLabel, BANDS } from '../design/index.js';
import { joinDamFill, damSize, damTooltip, fillLevel, frDay, fr } from './damsData.js';
import { drawableLinks, arcPoints, linkStyle, linkTip, distToPolyline } from './layers/links.js';
import { FIELDS_ZOOM, FIELDS_LAYER_IDS, FIELDS_LEGEND, fieldsLayers, fieldsPaint, fieldsTransition, fieldsWanted, parseShowFieldsArg } from './layers/fields.js';
import { GLOBE_PROJECTION, MERCATOR, MAP_MIN_ZOOM, ATMOSPHERE_BLEND, GLOBE_CAMERA, GLOBE_SPIN, GLOBE_ZOOM, MOROCCO_FADE, fadeByZoom, showDamsAt, isGlobeStop } from './layers/globe.js';
import './HubMap.css';

// Ne pas retirer : MapLibre 6 charge son worker par cette URL.
maplibregl.setWorkerUrl(workerUrl);

// Fond clair « eau » (docs/DESIGN_ANZAR_V2.md, directives carte) + relief Mapterhorn.
const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';
const DEM = 'https://tiles.mapterhorn.com/tilejson.json';
const NATIONAL_BOUNDS = [[-17.3, 20.6], [-0.9, 36.0]];
const NATIONAL = { bearing: -6, pitch: 45 };
const SRC = 'hub-regions';
const LINES = 'hub-region-lines'; // contours : sources de LIGNES (un contour tiré d'un polygone dessine aussi les bords artificiels du découpage en tuiles : traits droits au milieu des régions)
// Contrôles MapLibre en français.
const MAP_LOCALE = {
  'NavigationControl.ZoomIn': 'Zoom avant',
  'NavigationControl.ZoomOut': 'Zoom arrière',
  'NavigationControl.ResetBearing': 'Réorienter le nord',
  'AttributionControl.ToggleAttribution': 'Afficher les crédits',
  'AttributionControl.MapFeedback': 'Signaler un problème sur la carte',
};
const TERRAIN_EXAGGERATION = 1.5;

const BAND_FILL = { critique: colors.bandCritiqueFill, tendu: colors.bandTenduFill, confortable: colors.bandConfortableFill };
const FLUX_BY_BAND = { faible: colors.flux0, mixte: colors.flux2, dominant: colors.flux3 };
const FLUX_STEP_COLORS = [colors.flux0, colors.flux1, colors.flux2, colors.flux3];

// Survol cinématique de l'Atlas, du Haut Atlas occidental au Moyen Atlas.
const ATLAS_PATH = [
  { center: [-9.2, 30.6], zoom: 7.1, pitch: 62, bearing: 58 },
  { center: [-7.95, 31.05], zoom: 7.9, pitch: 68, bearing: 72 },
  { center: [-6.55, 31.8], zoom: 7.5, pitch: 66, bearing: 42 },
  { center: [-5.2, 32.75], zoom: 7.0, pitch: 60, bearing: 18 },
];

const ZERO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };
const globeCamera = (s, padding = ZERO_PAD) => ({
  center: s?.center || GLOBE_CAMERA.center, zoom: s?.zoom ?? GLOBE_CAMERA.zoom,
  pitch: s?.pitch ?? GLOBE_CAMERA.pitch, bearing: s?.bearing ?? GLOBE_CAMERA.bearing, padding,
});
// Cadrage d'une étape globe : framing 'right' décale le globe dans la moitié droite (texte du récit à gauche, grand écran).
function globeFraming(el, framing) {
  const w = el?.clientWidth || 1200;
  if (framing === 'right' && w >= 760) return { ...ZERO_PAD, left: Math.round(w * 0.5) };
  return ZERO_PAD;
}
// Repasse en Mercator pur quand la caméra est au-dessus du seuil (l'expression de projection y rend déjà plan : pas de saut).
function settleProjection(map, projRef) {
  if (!map || projRef.current !== 'globe' || map.getZoom() < GLOBE_ZOOM.mercator) return;
  try { map.setProjection(MERCATOR); projRef.current = 'mercator'; } catch { /* garde l'expression */ }
}

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const channels = hex => { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => {
  const x = channels(a); const y = channels(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};

// Teinte hypsométrique douce : littoral et vallées clairs, montagnes sable-ocre, sommets presque blancs.
const RELIEF_RAMP = ['interpolate', ['linear'], ['elevation'],
  -100, mix(colors.mapLand, colors.waterSoft, 0.5),
  0, mix(colors.mapLand, colors.sky, 0.55),
  300, colors.mapLand,
  900, mix(colors.mapLand, colors.ochre, 0.14),
  1600, mix(colors.mapLand, colors.ochre, 0.28),
  2400, mix(colors.mapLand, colors.ochre, 0.4),
  3300, mix(colors.mapLand, colors.mapHillshadeAccent, 0.35),
  4100, colors.surface1,
];

const fluxStyle = e => {
  if (!e || !(e.kind === 'flux' || e.band in FLUX_BY_BAND)) return null;
  if (Number.isFinite(e.value)) return FLUX_STEP_COLORS[e.value < 25 ? 0 : e.value < 50 ? 1 : e.value < 100 ? 2 : 3];
  return FLUX_BY_BAND[e.band] || null;
};
function regionKind(e) {
  if (e && fluxStyle(e)) return 'flux';
  if (e && e.band in BAND_FILL) return 'band';
  return 'na';
}
// Voile coloré drapé sur le relief (pas d'extrusion : la topographie reste lisible).
function regionStyle(entry, lit, story) {
  const kind = regionKind(entry);
  const color = kind === 'flux' ? fluxStyle(entry) : kind === 'band' ? BAND_FILL[entry.band] : colors.bandNaFill;
  const base = kind === 'na' ? 0.26 : story ? 0.24 : 0.3;
  return { kind, color, op: lit ? Math.min(0.62, base + 0.22) : base };
}

function geometryBounds(geometry) {
  const b = new maplibregl.LngLatBounds();
  const walk = c => (typeof c[0] === 'number' ? b.extend(c) : c.forEach(walk));
  walk(geometry.coordinates);
  return b;
}
function ringCentroid(ring) {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  return { area: Math.abs(a / 2), pt: a ? [cx / (3 * a), cy / (3 * a)] : ring[0] };
}
function regionCentroid(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polys.map(p => ringCentroid(p[0])).sort((x, y) => y.area - x.area)[0].pt;
}
function buildLabels(geo, names, selected) {
  return {
    type: 'FeatureCollection',
    features: geo.features.map(f => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: regionCentroid(f.geometry) },
      properties: { name: names[f.properties.id] || f.properties.name, sel: f.properties.id === selected ? 1 : 0 },
    })),
  };
}
function regionTargets(geo, metric, hl, story) {
  const out = {};
  for (const f of geo.features) out[f.properties.id] = regionStyle(metric[f.properties.id], hl.has(f.properties.id), story);
  return out;
}
function buildRegions(geo, styles, names) {
  return {
    type: 'FeatureCollection',
    features: geo.features.map(f => {
      const id = f.properties.id;
      const s = styles[id];
      return { ...f, properties: { id, name: names[id] || f.properties.name, color: s.color, op: s.op, kind: s.kind } };
    }),
  };
}

// Contours des régions en lignes (anneaux des polygones), avec le style de la région.
function buildLines(geo, styles) {
  const feats = [];
  for (const f of geo.features) {
    const id = f.properties.id;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) feats.push({ type: 'Feature', properties: { id, kind: styles[id]?.kind }, geometry: { type: 'LineString', coordinates: ring } });
  }
  return { type: 'FeatureCollection', features: feats };
}

// État de survol posé sur les polygones (remplissage) ET sur les lignes (contours).
function setHover(map, id, hover) {
  for (const source of [SRC, LINES]) map.setFeatureState({ source, id }, { hover });
}

async function getJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// Fond positron éclairci : routes, bâtiments, frontières et étiquettes retirés (nos régions les remplacent),
// eau en bleu vif, végétation et bâti fondus dans la terre claire. Pas de sprite : aucune icône utilisée.
function lightStyle(s) {
  const hidden = /^(transportation|transportation_name|aeroway|aerodrome_label|building|boundary|place|water_name|mountain_peak|poi|housenumber)$/;
  const layers = s.layers.filter(l => l.type !== 'symbol' && !hidden.test(l['source-layer'] || '')).map(l => {
    const sl = l['source-layer'];
    if (l.type === 'background') return { ...l, paint: { 'background-color': colors.mapLand } };
    if (sl === 'water' && l.type === 'fill') return { ...l, paint: { 'fill-color': colors.mapWater, 'fill-opacity': 0.86 } };
    if (sl === 'waterway' && l.type === 'line') {
      return { ...l, paint: {
        'line-color': colors.mapWaterLine, 'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 7, 1.3, 10, 2.2, 13, 3.4],
      } };
    }
    if (l.type === 'fill') {
      const green = sl === 'park' || /wood|grass/.test(l.id);
      return { ...l, paint: { 'fill-color': green ? mix(colors.mapLand, colors.bandConfortableFill, 0.18) : mix(colors.mapLand, colors.mapHillshadeAccent, 0.18), 'fill-opacity': 0.4 } };
    }
    return l;
  });
  const { sprite: _sprite, ...rest } = s;
  return { ...rest, layers };
}

// Cadrage d'accroche : zoom un peu plus grand et décalage (padding de caméra) pour laisser le titre respirer.
function heroFraming(el) {
  const h = el?.clientHeight || 800;
  const w = el?.clientWidth || 1200;
  return { padding: { top: Math.round(h * 0.18), bottom: 0, left: w < 600 ? 0 : Math.round(w * 0.14), right: 0 }, zoomBy: 0.55 };
}

const HubMap = forwardRef(function HubMap({
  regionId, onSelectRegion, metricByRegion = {}, legend = true, layers = { dams: true, links: true },
  mode = 'explore', storyStop = null, insets,
}, ref) {
  const wrapRef = useRef(null);
  const canvasHostRef = useRef(null);
  const overlayRef = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const namesRef = useRef({});
  const hoverRef = useRef(null);
  const nationalRef = useRef({ ...NATIONAL, center: [-8.2, 28.5], zoom: 4.2 });
  const arcsRef = useRef([]);
  const labelFontRef = useRef(null);
  const markersRef = useRef([]);
  const shownStylesRef = useRef(null);
  const tweenRef = useRef(0);
  const orbitRef = useRef(null);
  const flightRef = useRef(0);
  const revealRef = useRef({ timers: [], pending: null });
  const latest = useRef({});
  const [status, setStatus] = useState('loading');
  const [tip, setTip] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [hl, setHl] = useState(() => new Set());
  const [legendOpen, setLegendOpen] = useState(false);
  const [storyDams, setStoryDams] = useState('faint'); // récit : 'hidden' | 'faint' | 'shown'
  const [data, setData] = useState({ dams: null, links: null, region: null, fill: null });
  const [far, setFar] = useState(false);
  const [nearFields, setNearFields] = useState(false); // zoom où les terres agricoles existent dans les tuiles (≥ 7)
  const [fieldsCmd, setFieldsCmd] = useState(null); // null : suit layers.fields ; booléen : showFields / étape du récit
  const fieldsAnimRef = useRef(true);
  const fieldsTimerRef = useRef(0);
  const projRef = useRef('mercator');
  const readyRef = useRef(false);
  const pendingStopRef = useRef(null);

  const story = mode === 'story';
  const showDams = layers?.dams !== false && (!story || storyDams !== 'hidden');
  const showLinks = layers?.links !== false;
  const fieldsOn = fieldsWanted(fieldsCmd, layers, story);
  latest.current = { regionId, onSelectRegion, metricByRegion, mode, insets, hl, fieldsOn };

  const padding = useCallback(() => {
    const w = wrapRef.current?.clientWidth || 1000;
    const i = latest.current.insets;
    if (i) return { top: 60, bottom: 60, left: 40, right: 40, ...i };
    // Mode exploration : le panneau occupe la droite (440 px) ou le bas (feuille) ; on cadre dans l'espace restant.
    // Taille du panneau mesurée dans la page ; à défaut (pas encore monté), valeurs de la mise en page (440 px ou 58 %).
    if (latest.current.mode === 'explore') {
      const wrap = wrapRef.current?.getBoundingClientRect();
      const h = wrap?.height || 700;
      const shell = typeof document !== 'undefined' ? document.querySelector('.hub-layer--panel .pn-shell')?.getBoundingClientRect() : null;
      if (w >= 760) return { top: 70, bottom: 60, left: 40, right: (shell && wrap ? Math.max(0, wrap.right - shell.left) : 440) + 20 };
      const panelH = shell && wrap ? Math.max(0, wrap.bottom - shell.top) : Math.round(h * 0.58);
      return { top: 60, bottom: panelH + 16, left: 16, right: 16 };
    }
    return w < 600 ? { top: 60, bottom: 60, left: 16, right: 16 } : { top: 70, bottom: 60, left: 40, right: 40 };
  }, []);

  // ——— Mouvements de caméra ———
  const stopOrbit = useCallback(() => {
    const o = orbitRef.current;
    if (!o) return;
    orbitRef.current = null;
    o.cleanup();
  }, []);

  // Rotation lente du cap : une seule animation linéaire longue (pas de boucle image par image),
  // arrêtée par toute interaction, un nouveau vol, l'onglet masqué ou reduced-motion.
  // spin : le globe tourne (la longitude du centre avance) au lieu du cap.
  const orbit = useCallback(({ degreesPerSec = 1.5, maxSeconds = 60, spin = false } = {}) => {
    const map = mapRef.current;
    stopOrbit();
    if (!map || reduced() || !degreesPerSec) return stopOrbit;
    map.stop(); // arrête un vol en cours AVANT d'écouter moveend (sinon l'arrêt déclencherait la fin tout de suite)
    const el = map.getCanvasContainer();
    const events = ['mousedown', 'touchstart', 'wheel'];
    const onStop = () => stopOrbit();
    const onKey = () => stopOrbit();
    const onVis = () => { if (document.hidden) stopOrbit(); };
    events.forEach(ev => el.addEventListener(ev, onStop, { passive: true }));
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    const detach = () => {
      events.forEach(ev => el.removeEventListener(ev, onStop));
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      map.off('moveend', done);
    };
    // Fin naturelle de la rotation : on détache les écouteurs sans arrêter la caméra.
    function done() { if (orbitRef.current?.map === map) { orbitRef.current = null; detach(); } }
    orbitRef.current = { map, cleanup: () => { detach(); map.stop(); } };
    map.once('moveend', done);
    if (spin) {
      const c = map.getCenter();
      map.easeTo({ center: [c.lng + degreesPerSec * maxSeconds, c.lat], duration: maxSeconds * 1000, easing: t => t, essential: false });
    } else map.rotateTo(map.getBearing() + degreesPerSec * maxSeconds, { duration: maxSeconds * 1000, easing: t => t, essential: false });
    return stopOrbit;
  }, [stopOrbit]);

  // Vol (ou saut si reduced-motion) ; then() est appelé à la fin de CE vol seulement.
  const move = useCallback((cam, duration, then) => {
    const map = mapRef.current;
    if (!map || !cam) return;
    // Jeton d'abord : les écouteurs d'un vol précédent deviennent périmés ; puis arrêt, puis écoute.
    const token = ++flightRef.current;
    stopOrbit();
    map.stop();
    if (then) map.once('moveend', () => { if (flightRef.current === token) then(); });
    if (reduced()) map.jumpTo(cam); else map.flyTo({ ...cam, duration: duration ?? 2200, essential: false });
  }, [stopOrbit]);

  const flyAlongAtlas = useCallback(({ legDuration = 4200 } = {}) => new Promise(resolve => {
    const map = mapRef.current;
    if (!map) { resolve(false); return; }
    const token = ++flightRef.current;
    stopOrbit();
    map.stop();
    if (reduced()) { map.jumpTo(ATLAS_PATH[ATLAS_PATH.length - 1]); resolve(true); return; }
    const leg = i => {
      if (flightRef.current !== token) { resolve(false); return; }
      if (i >= ATLAS_PATH.length) { resolve(true); return; }
      map.once('moveend', () => leg(i + 1));
      map.flyTo({ ...ATLAS_PATH[i], duration: i ? legDuration : legDuration * 0.8, curve: 1.1, essential: false, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    };
    leg(0);
  }), [stopOrbit]);

  const flyToRegion = useCallback(id => {
    const f = geoRef.current?.features.find(x => x.properties.id === id);
    const map = mapRef.current;
    if (!f || !map) return;
    // Région entière + voisinage proche (bornes élargies), place laissée au panneau par padding().
    const b = geometryBounds(f.geometry);
    const dx = (b.getEast() - b.getWest()) * 0.3;
    const dy = (b.getNorth() - b.getSouth()) * 0.3;
    const wide = new maplibregl.LngLatBounds([b.getWest() - dx, b.getSouth() - dy], [b.getEast() + dx, b.getNorth() + dy]);
    // Écran étroit : inclinaison plus faible, sinon la région déborde sous la feuille du panneau.
    const pitch = (wrapRef.current?.clientWidth || 1000) < 600 ? 40 : 58;
    // Le zoom vient de cameraForBounds ; le centre est celui de la région et le décalage est porté par le padding de la
    // caméra : avec une inclinaison, le centre calculé par cameraForBounds glisserait sous le panneau. Le padding est
    // toujours explicite (celui du héros du récit resterait sinon sur la caméra).
    const pad = padding();
    const cam = map.cameraForBounds(wide, { padding: pad, maxZoom: 7, bearing: -8, pitch });
    if (cam) move({ center: wide.getCenter(), zoom: cam.zoom, bearing: -8, pitch, padding: pad }, 1800, () => settleProjection(mapRef.current, projRef));
  }, [move, padding]);

  const resetView = useCallback(() => {
    setHl(new Set());
    move({ ...nationalRef.current, padding: ZERO_PAD }, 1800, () => settleProjection(mapRef.current, projRef));
  }, [move]);

  // ——— Barrages : apparition un à un, du plus grand au plus petit ———
  const runReveal = useCallback(duration => {
    const r = revealRef.current;
    r.timers.forEach(t => window.clearTimeout(t));
    r.timers = [];
    const list = [...markersRef.current].sort((a, b) => (b.dam.capacityMm3 || 0) - (a.dam.capacityMm3 || 0));
    if (!list.length) { r.pending = duration; return; }
    r.pending = null;
    if (reduced()) { list.forEach(m => m.show(false)); return; }
    list.forEach(m => m.hide());
    const step = Math.max(12, duration / list.length);
    list.forEach((m, i) => r.timers.push(window.setTimeout(() => m.show(true), 120 + i * step)));
  }, []);

  const revealDams = useCallback(({ duration = 2600 } = {}) => {
    setStoryDams('shown');
    runReveal(duration);
  }, [runReveal]);

  // ——— Globe : projection globe → Mercator selon le zoom (layers/globe.js) ———
  const enterGlobe = useCallback(() => {
    const map = mapRef.current;
    if (!map || projRef.current === 'globe') return;
    try { map.setProjection(GLOBE_PROJECTION); projRef.current = 'globe'; } catch { /* reste en Mercator */ }
  }, []);
  const spinGlobe = useCallback(opt => orbit({ ...GLOBE_SPIN, ...(typeof opt === 'object' ? opt : {}), spin: true }), [orbit]);
  const showGlobe = useCallback(({ spin = true, duration = 2600, camera } = {}) => {
    enterGlobe();
    // Tableau de bord : le globe est centré dans l'espace laissé par le panneau ; récit : plein cadre.
    move(globeCamera(camera, latest.current.mode === 'story' ? ZERO_PAD : padding()), duration, spin ? () => spinGlobe(spin) : null);
  }, [enterGlobe, move, spinGlobe, padding]);
  // Plongeon du globe vers le cadrage national ; la projection repasse en Mercator pur à l'arrivée (rendu déjà plan).
  const diveToMorocco = useCallback(({ duration = 4200, camera } = {}) => {
    const pad = latest.current.mode === 'story' ? ZERO_PAD : padding();
    move(camera ? { padding: pad, ...camera } : { ...nationalRef.current, padding: pad }, duration, () => settleProjection(mapRef.current, projRef));
  }, [move, padding]);

  // ——— Terres agricoles en 3D (layers/fields.js) ———
  const showFields = useCallback(arg => {
    const { on, animate } = parseShowFieldsArg(arg);
    fieldsAnimRef.current = animate;
    setFieldsCmd(on);
  }, []);

  const flyToStop = useCallback(stop => {
    if (!stop) return;
    setHl(new Set(stop.highlightRegionIds || []));
    // Barrages dans le récit : showDams / revealDams portés par l'étape ; sans drapeau, présence discrète.
    if (stop.showDams === false) setStoryDams('hidden');
    else if (stop.revealDams || stop.showDams) setStoryDams('shown');
    else setStoryDams('faint');
    // Champs en 3D : seulement sur une étape qui porte showFields.
    fieldsAnimRef.current = true;
    setFieldsCmd(!!stop.showFields);
    // Carte pas encore chargée : l'étape est rejouée à la fin du chargement (une étape globe y est posée directement).
    if (!readyRef.current) { pendingStopRef.current = stop; return; }
    if (stop.revealDams) runReveal(typeof stop.revealDams === 'number' ? stop.revealDams : 2600);
    if (stop.flyAlongAtlas) { flyAlongAtlas().then(ok => { if (ok && stop.orbit) orbit(); }); return; }
    if (isGlobeStop(stop)) {
      enterGlobe();
      move(globeCamera(stop, globeFraming(wrapRef.current, stop.framing)), stop.duration, stop.orbit === false ? null : () => spinGlobe(stop.orbit));
      return;
    }
    // Accroche : le Maroc plus grand et poussé vers le bas pour laisser le titre respirer.
    const hero = stop.id === 'hero';
    const hf = heroFraming(wrapRef.current);
    const pad = hero ? hf.padding : ZERO_PAD;
    const cam = { center: stop.center, zoom: stop.zoom + (hero ? hf.zoomBy : 0), pitch: stop.pitch ?? 50, bearing: stop.bearing ?? 0, padding: pad };
    move(cam, stop.duration, () => {
      settleProjection(mapRef.current, projRef);
      if (stop.orbit) orbit(typeof stop.orbit === 'object' ? stop.orbit : undefined);
    });
  }, [move, orbit, flyAlongAtlas, runReveal, enterGlobe, spinGlobe]);

  // Hors production : poignée exposée pour les captures de contrôle (revealDams, orbit, flyAlongAtlas).
  useEffect(() => {
    if (import.meta.env.MODE === 'production') return undefined;
    window.__hubMapApi = { revealDams, orbit, stopOrbit, flyAlongAtlas, flyToStop, showFields, showGlobe, diveToMorocco };
    return () => { delete window.__hubMapApi; };
  }, [revealDams, orbit, stopOrbit, flyAlongAtlas, flyToStop, showFields, showGlobe, diveToMorocco]);

  useImperativeHandle(ref, () => ({
    flyToStop, flyToRegion, resetView, revealDams, orbit, stopOrbit, flyAlongAtlas, showFields, showGlobe, diveToMorocco,
    getMap: () => mapRef.current,
  }), [flyToStop, flyToRegion, resetView, revealDams, orbit, stopOrbit, flyAlongAtlas, showFields, showGlobe, diveToMorocco]);

  // ——— Données (les fichiers absents valent null) ———
  // Dépend seulement des objets fournis (pas des booléens qui changent avec l'onglet) : pas de rechargement ni de
  // reconstruction des barrages à chaque changement d'onglet.
  const damsOwn = layers?.dams && typeof layers.dams === 'object' ? layers.dams : null;
  const linksOwn = layers?.links && typeof layers.links === 'object' ? layers.links : null;
  useEffect(() => {
    let alive = true;
    Promise.all([
      damsOwn || getJson('/data/national-dams.json'),
      linksOwn || getJson('/data/water-links.json'),
      getJson('/data/region.json'),
      getJson('/data/dam-fill.json'),
    ]).then(([dams, links, region, fill]) => alive && setData({ dams, links, region, fill }));
    return () => { alive = false; };
  }, [damsOwn, linksOwn]);

  const joined = useMemo(() => joinDamFill(data.dams, data.fill, data.region), [data.dams, data.fill, data.region]);
  const damList = joined.located;
  const arcs = useMemo(() => drawableLinks(data.links).map(l => ({ link: l, pts: arcPoints(l.from, l.to) })), [data.links]);

  // ——— Style de fond ———
  const [baseStyle, setBaseStyle] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!hasWebGL()) { setStatus('nogl'); return undefined; }
    getJson(BASEMAP).then(s => {
      if (!alive) return;
      if (!s?.layers) { setStatus('error'); return; }
      const font = s.layers.map(l => l.layout?.['text-font']).find(Boolean);
      if (font) labelFontRef.current = font;
      setBaseStyle(lightStyle(s));
    });
    return () => { alive = false; };
  }, []);

  // ——— Carte (instance unique) ———
  useEffect(() => {
    if (!baseStyle) return undefined;
    let cancelled = false;
    let map;
    try {
      map = new maplibregl.Map({
        container: canvasHostRef.current, style: baseStyle, bounds: NATIONAL_BOUNDS,
        fitBoundsOptions: { padding: padding(), bearing: NATIONAL.bearing, pitch: NATIONAL.pitch },
        minZoom: MAP_MIN_ZOOM, maxZoom: 12, maxPitch: 75, attributionControl: { compact: true }, locale: MAP_LOCALE,
        canvasContextAttributes: { antialias: true },
      });
    } catch { setStatus('nogl'); return undefined; }
    mapRef.current = map;
    map.on('styleimagemissing', e => { if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); });
    if (import.meta.env.MODE !== 'production') window.__hubMap = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    const timeout = window.setTimeout(() => { if (!cancelled && !map.isStyleLoaded()) setStatus('error'); }, 22000);

    map.on('load', async () => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      try {
        const [geo, regs] = await Promise.all([getJson('/data/morocco-regions.geojson'), getJson('/data/regions.json')]);
        if (cancelled || !geo) { if (!cancelled) setStatus('error'); return; }
        geoRef.current = geo;
        namesRef.current = Object.fromEntries((regs?.regions || []).map(r => [r.id, r.name]));
        const all = new maplibregl.LngLatBounds();
        for (const ft of geo.features) all.extend(geometryBounds(ft.geometry));
        const cam = map.cameraForBounds(all, { padding: padding(), bearing: NATIONAL.bearing, pitch: NATIONAL.pitch });
        if (cam) {
          nationalRef.current = { center: cam.center, zoom: cam.zoom, ...NATIONAL };
          // Récit : le Maroc entier, plus grand et poussé vers le bas-droite (voir heroFraming).
          const hf = heroFraming(wrapRef.current);
          map.jumpTo(latest.current.mode === 'story' ? { ...nationalRef.current, zoom: nationalRef.current.zoom + hf.zoomBy, padding: hf.padding } : nationalRef.current);
        }
        // Récit ouvert sur une étape globe : le globe est posé directement (pas de vol depuis le Maroc à l'ouverture).
        if (isGlobeStop(pendingStopRef.current)) {
          try { map.setProjection(GLOBE_PROJECTION); projRef.current = 'globe'; } catch { /* Mercator */ }
          map.jumpTo(globeCamera(pendingStopRef.current, globeFraming(wrapRef.current, pendingStopRef.current.framing)));
        }

        const styleLayers = map.getStyle().layers;
        const afterBackground = styleLayers.find(l => l.type !== 'background')?.id;
        const waterLayer = styleLayers.find(l => l.id === 'water' || l['source-layer'] === 'water')?.id || afterBackground;
        const labelFont = labelFontRef.current || ['Noto Sans Regular'];

        // Relief : teinte hypsométrique + ombrage (source dédiée), terrain 3D sur une autre source.
        map.addSource('hub-dem', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
        map.addSource('hub-hill', { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 });
        map.addLayer({ id: 'hub-relief', source: 'hub-hill', type: 'color-relief', paint: {
          'color-relief-color': RELIEF_RAMP, 'color-relief-opacity': 0.9,
        } }, afterBackground);
        map.addLayer({ id: 'hub-hillshade', source: 'hub-hill', type: 'hillshade', paint: {
          'hillshade-shadow-color': colors.mapHillshadeShadow, 'hillshade-highlight-color': colors.mapHillshadeHighlight,
          'hillshade-accent-color': colors.mapHillshadeAccent, 'hillshade-exaggeration': 0.62,
          'hillshade-illumination-direction': 315,
        } }, afterBackground);
        map.setTerrain({ source: 'hub-dem', exaggeration: TERRAIN_EXAGGERATION });
        try { map.setLight({ anchor: 'viewport', color: colors.mapLight, intensity: 0.4, position: [1.5, 210, 40] }); } catch { /* éclairage par défaut */ }
        try {
          map.setSky({
            'sky-color': colors.sky, 'horizon-color': colors.surface1, 'fog-color': colors.bg,
            'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.35, 'atmosphere-blend': ATMOSPHERE_BLEND,
          });
        } catch { /* ciel par défaut */ }

        // Régions : voile drapé sous l'eau (rivières et retenues restent bleu vif), contours au-dessus.
        const styles = regionTargets(geo, latest.current.metricByRegion, latest.current.hl, latest.current.mode === 'story');
        shownStylesRef.current = styles;
        map.addSource(SRC, { type: 'geojson', data: buildRegions(geo, styles, namesRef.current), promoteId: 'id' }); // buffer par défaut : un buffer nul laisse des jointures de tuiles visibles dans le remplissage
        map.addSource(LINES, { type: 'geojson', data: buildLines(geo, styles), promoteId: 'id' });
        map.addLayer({ id: 'hub-fill', type: 'fill', source: SRC, paint: {
          'fill-color': ['get', 'color'],
          // Fondu selon le zoom : rien au globe lointain (layers/globe.js), inchangé au cadrage national.
          'fill-opacity': fadeByZoom(['case', ['boolean', ['feature-state', 'hover'], false], ['min', 0.66, ['+', ['get', 'op'], 0.14]], ['get', 'op']]),
          'fill-opacity-transition': { duration: 250 },
        } }, waterLayer);
        map.addLayer({ id: 'hub-outline', type: 'line', source: LINES, paint: {
          'line-color': colors.mapBoundary, 'line-opacity': fadeByZoom(['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.4]),
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.2, 0.9],
        } });
        map.addLayer({ id: 'hub-na-dash', type: 'line', source: LINES, filter: ['==', ['get', 'kind'], 'na'], paint: {
          'line-color': colors.bandNa, 'line-width': 1, 'line-opacity': fadeByZoom(0.7), 'line-dasharray': [2, 2],
        } });
        map.addLayer({ id: 'hub-flux-dash', type: 'line', source: LINES, filter: ['==', ['get', 'kind'], 'flux'], paint: {
          'line-color': colors.flux3, 'line-width': 1, 'line-opacity': fadeByZoom(0.7), 'line-dasharray': [4, 2],
        } });
        map.addLayer({ id: 'hub-selected-casing', type: 'line', source: LINES, filter: ['==', ['get', 'id'], ''], paint: {
          'line-color': colors.mapSelectionCasing, 'line-width': 5.5, 'line-opacity': fadeByZoom(1),
        } });
        map.addLayer({ id: 'hub-selected', type: 'line', source: LINES, filter: ['==', ['get', 'id'], ''], paint: {
          'line-color': colors.mapSelection, 'line-width': 3, 'line-opacity': fadeByZoom(1),
        } });

        map.addSource('hub-label-src', { type: 'geojson', data: buildLabels(geo, namesRef.current, latest.current.mode === 'story' ? null : latest.current.regionId) });
        map.addLayer({ id: 'hub-labels', type: 'symbol', source: 'hub-label-src', minzoom: MOROCCO_FADE[1] - 0.2, layout: {
          'text-field': ['get', 'name'], 'text-font': labelFont, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12,
          'text-size': ['case', ['==', ['get', 'sel'], 1], 15, 10.5], 'text-max-width': 7,
          'symbol-sort-key': ['case', ['==', ['get', 'sel'], 1], 0, 1], 'text-pitch-alignment': 'viewport',
        }, paint: {
          'text-color': colors.mapLabel, 'text-halo-color': colors.mapHalo, 'text-halo-width': 1.6,
          'text-opacity': fadeByZoom(['case', ['==', ['get', 'sel'], 1], 1, 0.78]),
        } });

        map.on('mousemove', 'hub-fill', e => {
          if (latest.current.mode === 'story') return;
          const f = e.features?.[0];
          if (!f) return;
          const id = f.properties.id;
          if (hoverRef.current !== id) {
            if (hoverRef.current) setHover(map, hoverRef.current, false);
            hoverRef.current = id;
            setHover(map, id, true);
          }
          map.getCanvas().style.cursor = 'pointer';
          const entry = latest.current.metricByRegion[id];
          const kind = regionKind(entry);
          const lines = kind === 'band' ? [(BANDS[entry.band].glyph + ' ' + BANDS[entry.band].label + ' · ' + (entry.label ?? '')).trim()]
            : kind === 'flux' ? [('≈ Flux : ' + (entry.label ?? '')).trim(), 'Sans barrage rattaché : aucun stock']
              : ['Sans donnée (pas de barrage suivi)'];
          setTip(t => (t?.dam || t?.link ? t : { x: e.point.x, y: e.point.y, title: f.properties.name, lines, region: true }));
        });
        map.on('mouseleave', 'hub-fill', () => {
          if (hoverRef.current) setHover(map, hoverRef.current, false);
          hoverRef.current = null;
          map.getCanvas().style.cursor = '';
          setTip(t => (t?.region ? null : t));
        });
        map.on('click', 'hub-fill', e => {
          if (latest.current.mode === 'story') return;
          const id = e.features?.[0]?.properties.id;
          if (id) latest.current.onSelectRegion?.(id);
        });
        readyRef.current = true;
        setStatus('ready');
      } catch (err) {
        if (import.meta.env.MODE !== 'production') console.warn('[carte]', err);
        if (!cancelled) setStatus('error');
      }
    });
    // Erreurs de tuiles isolées (réseau) : ignorées ; seule une erreur avant le chargement du style bascule en repli.
    map.on('error', e => { if (!map.isStyleLoaded() && !/tile/i.test(e?.error?.message || '')) setStatus(s => (s === 'ready' ? s : 'error')); });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      stopOrbit();
      flightRef.current++;
      revealRef.current.timers.forEach(t => window.clearTimeout(t));
      cancelAnimationFrame(tweenRef.current);
      if (import.meta.env.MODE !== 'production' && window.__hubMap === map) delete window.__hubMap;
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      window.clearTimeout(fieldsTimerRef.current);
      readyRef.current = false;
      projRef.current = 'mercator';
      map.remove();
      mapRef.current = null;
      geoRef.current = null;
    };
  }, [padding, baseStyle, stopOrbit]);

  // ——— Couleurs des régions : transition douce vers les nouvelles valeurs ———
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map?.getSource(SRC)) return undefined;
    const geo = geoRef.current;
    const to = regionTargets(geo, metricByRegion, hl, story);
    const from = shownStylesRef.current || to;
    cancelAnimationFrame(tweenRef.current);
    const set = s => { shownStylesRef.current = s; map.getSource(SRC)?.setData(buildRegions(geo, s, namesRef.current)); map.getSource(LINES)?.setData(buildLines(geo, s)); };
    const changed = Object.keys(to).some(id => !from[id] || from[id].color !== to[id].color || from[id].op !== to[id].op || from[id].kind !== to[id].kind);
    if (!changed) return undefined;
    if (reduced()) { set(to); return undefined; }
    const t0 = performance.now();
    const D = 520;
    const step = now => {
      const k = Math.min(1, (now - t0) / D);
      const e = 1 - (1 - k) ** 3;
      const s = {};
      for (const id of Object.keys(to)) {
        const a = from[id] || to[id]; const b = to[id];
        s[id] = { kind: b.kind, color: mix(a.color, b.color, e), op: a.op + (b.op - a.op) * e };
      }
      set(k < 1 ? s : to);
      if (k < 1) tweenRef.current = requestAnimationFrame(step);
    };
    tweenRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(tweenRef.current);
  }, [metricByRegion, hl, status, story]);

  // ——— Région sélectionnée : contour, et vol en mode exploration ———
  const firstSelect = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    const f = ['==', ['get', 'id'], story ? '' : (regionId || '')];
    map.setFilter('hub-selected', f);
    map.setFilter('hub-selected-casing', f);
    map.getSource('hub-label-src')?.setData(buildLabels(geoRef.current, namesRef.current, story ? null : regionId));
    if (story) return;
    if (firstSelect.current) { firstSelect.current = false; if (!regionId) return; }
    if (regionId) flyToRegion(regionId);
  }, [regionId, status, story, flyToRegion]);

  // Étape demandée avant la fin du chargement : rejouée une fois la carte prête.
  useEffect(() => {
    if (status !== 'ready' || !pendingStopRef.current) return;
    const s = pendingStopRef.current;
    pendingStopRef.current = null;
    flyToStop(s);
  }, [status, flyToStop]);

  // ——— Terres agricoles : ajout à la demande, fondu d'opacité (transition MapLibre, aucune boucle), retrait après fondu ———
  const fieldsProp = layers?.fields === true;
  const fieldsPropSeen = useRef(fieldsProp);
  useEffect(() => {
    if (fieldsPropSeen.current === fieldsProp) return; // pas au montage : une étape a pu être posée avant
    fieldsPropSeen.current = fieldsProp;
    setFieldsCmd(null);
  }, [fieldsProp]);

  // Globe lointain : barrages masqués (état mis à jour seulement au franchissement du seuil).
  const farRef = useRef(false);
  const nearRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return undefined;
    const onZoom = () => {
      const z = map.getZoom();
      const f = !showDamsAt(z); if (f !== farRef.current) { farRef.current = f; setFar(f); }
      const n = z >= FIELDS_ZOOM.veilMin; if (n !== nearRef.current) { nearRef.current = n; setNearFields(n); }
    };
    onZoom();
    map.on('zoom', onZoom);
    return () => map.off('zoom', onZoom);
  }, [status]);
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return undefined;
    const animate = fieldsAnimRef.current;
    fieldsAnimRef.current = true;
    let raf = 0;
    const paint = on => {
      for (const [id, [prop, value]] of Object.entries(fieldsPaint(on))) if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
    };
    const ensure = () => {
      if (!latest.current.fieldsOn || map.getLayer(FIELDS_LAYER_IDS[1]) || !map.getSource('openmaptiles')) return false;
      const [veil, ext] = fieldsLayers(colors, { animate, reducedMotion: reduced() });
      map.addLayer(veil, map.getLayer('hub-outline') ? 'hub-outline' : undefined);
      map.addLayer(ext, map.getLayer('hub-labels') ? 'hub-labels' : undefined);
      return true;
    };
    window.clearTimeout(fieldsTimerRef.current);
    const tr = fieldsTransition(animate, reduced());
    if (fieldsOn) {
      const added = ensure();
      for (const id of FIELDS_LAYER_IDS) {
        const prop = map.getLayer(id)?.type === 'fill' ? 'fill-opacity-transition' : 'fill-extrusion-opacity-transition';
        if (map.getLayer(id)) map.setPaintProperty(id, prop, tr);
      }
      // Couche tout juste ajoutée (opacité 0) : la valeur cible est posée à l'image suivante pour que la transition joue.
      if (added) raf = requestAnimationFrame(() => paint(true)); else paint(true);
    } else if (map.getLayer(FIELDS_LAYER_IDS[1])) {
      paint(false);
      fieldsTimerRef.current = window.setTimeout(() => {
        if (latest.current.fieldsOn || !mapRef.current) return;
        for (const id of FIELDS_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id);
      }, tr.duration + 60);
    }
    // Changement de style : la couche est rajoutée si elle est demandée.
    const onStyle = () => { if (ensure()) paint(true); };
    map.on('styledata', onStyle);
    return () => { cancelAnimationFrame(raf); map.off('styledata', onStyle); };
  }, [fieldsOn, status]);

  // Étape du récit (optionnelle : le parent peut aussi appeler flyToStop).
  useEffect(() => { if (status === 'ready' && storyStop) flyToStop(storyStop); }, [storyStop, status, flyToStop]);

  // Mode récit : la carte est un décor, aucune interaction (le défilement de la page reste libre).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hs = ['scrollZoom', 'boxZoom', 'dragRotate', 'dragPan', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'];
    for (const h of hs) (story ? map[h].disable() : map[h].enable());
    if (story) { setTip(null); setPinned(null); } else { setStoryDams('faint'); setFieldsCmd(null); stopOrbit(); }
  }, [story, status, stopOrbit]);

  // ——— Barrages : petits réservoirs HTML (niveau d'eau = taux de remplissage lu) ———
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map || !damList.length) return undefined;
    const size = () => {
      const z = map.getZoom();
      const k = (wrapRef.current?.clientWidth || 1000) < 600 ? 0.8 : 1; // écran étroit : réservoirs plus petits
      for (const m of markersRef.current) m.btn.style.setProperty('--d', Math.max(8, Math.round(damSize(m.dam.capacityMm3, z) * k)) + 'px');
    };
    markersRef.current = damList.map(d => {
      const wrap = document.createElement('div');
      wrap.className = 'hub-dam-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.tabIndex = -1; // hors de l'ordre de tabulation : la liste « Les barrages du bassin » du panneau est l'alternative clavier
      const lvl = fillLevel(d.fillPct);
      btn.className = 'hub-dam' + (lvl ? ' is-filled is-' + lvl : ' is-empty') + (d.capacityMm3 ? '' : ' is-unknown');
      const water = document.createElement('span');
      water.className = 'hub-dam__water';
      water.setAttribute('aria-hidden', 'true');
      btn.appendChild(water);
      wrap.appendChild(btn);
      const target = lvl ? Math.max(0.04, Math.min(1, d.fillPct / 100)) : 0;
      const t = damTooltip(d);
      btn.setAttribute('aria-label', t.title + '. ' + t.lines.join('. '));
      const show = () => {
        const r = btn.getBoundingClientRect();
        const c = wrapRef.current.getBoundingClientRect();
        setTip({ x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height, ...t, dam: true });
      };
      btn.addEventListener('mouseenter', show);
      btn.addEventListener('focus', show);
      btn.addEventListener('mouseleave', () => setTip(x => (x?.dam ? null : x)));
      btn.addEventListener('blur', () => setTip(x => (x?.dam ? null : x)));
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (latest.current.mode !== 'story' && d.regionId) latest.current.onSelectRegion?.(d.regionId);
      });
      const mk = new maplibregl.Marker({ element: wrap }).setLngLat([d.lon, d.lat]).addTo(map);
      mk.dam = d;
      mk.btn = btn;
      mk.hide = () => { wrap.classList.remove('is-ripple'); btn.classList.add('is-pending'); btn.style.setProperty('--lvl', 0); };
      mk.show = animate => {
        btn.classList.remove('is-pending');
        btn.style.setProperty('--lvl', target);
        if (animate && target) { wrap.classList.remove('is-ripple'); void wrap.offsetWidth; wrap.classList.add('is-ripple'); }
      };
      // Premier affichage : le niveau monte une fois depuis zéro.
      btn.style.setProperty('--lvl', 0);
      return mk;
    });
    size();
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (revealRef.current.pending != null) runReveal(revealRef.current.pending);
      else markersRef.current.forEach(m => m.show(false));
    }));
    map.on('zoom', size);
    return () => {
      cancelAnimationFrame(raf);
      map.off('zoom', size);
      revealRef.current.timers.forEach(x => window.clearTimeout(x));
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [damList, status, runReveal]);

  // ——— Liaisons : canvas par-dessus la carte (arcs schématiques), redessiné au rendu, sans boucle permanente ———
  useEffect(() => {
    const map = mapRef.current;
    const cv = overlayRef.current;
    arcsRef.current = [];
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const clear = () => ctx.clearRect(0, 0, cv.width, cv.height);
    if (status !== 'ready' || !map || !showLinks || !arcs.length) { clear(); return undefined; }
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      const proj = [];
      // Globe lointain : pas d'arcs (map.project n'a pas de sens sur la face cachée du globe).
      if (!showDamsAt(map.getZoom())) { arcsRef.current = proj; return; }
      for (const a of arcs) {
        const poly = a.pts.map(p => { const s = map.project(p); return [s.x, s.y]; });
        proj.push({ link: a.link, poly });
        const st = linkStyle(a.link);
        const path = () => { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalAlpha = st.alpha;
        ctx.setLineDash(st.dashed ? [7, 6] : []);
        ctx.strokeStyle = colors.mapHalo; ctx.lineWidth = 5; path(); ctx.stroke();
        ctx.strokeStyle = colors.accent; ctx.lineWidth = 2.2; path(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.surface1; ctx.strokeStyle = colors.accent; ctx.lineWidth = 2;
        for (const [x, y] of [poly[0], poly[poly.length - 1]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      arcsRef.current = proj;
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(wrapRef.current);
    map.on('render', draw);
    draw();
    return () => { ro.disconnect(); map.off('render', draw); arcsRef.current = []; clear(); };
  }, [arcs, showLinks, status]);

  // Survol / clic d'un arc.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map || !showLinks) return undefined;
    const hit = pt => {
      let best = null; let bd = 11;
      for (const a of arcsRef.current) { const d = distToPolyline(pt, a.poly); if (d < bd) { bd = d; best = a.link; } }
      return best;
    };
    const onMove = e => {
      if (latest.current.mode === 'story') return;
      const l = hit(e.point);
      if (l) { map.getCanvas().style.cursor = 'pointer'; setTip({ x: e.point.x, y: e.point.y, ...linkTip(l), link: true }); }
      else setTip(t => (t?.link ? null : t));
    };
    const onClick = e => {
      if (latest.current.mode === 'story') return;
      const l = hit(e.point);
      if (l) { setPinned({ x: e.point.x, y: e.point.y, ...linkTip(l) }); e.preventDefault?.(); } else setPinned(null);
    };
    map.on('mousemove', onMove); map.on('click', onClick);
    return () => { map.off('mousemove', onMove); map.off('click', onClick); };
  }, [showLinks, status, arcs]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setPinned(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const metrics = Object.values(metricByRegion);
  const hasFlux = metrics.some(e => regionKind(e) === 'flux');
  const legendTitle = typeof legend === 'string' ? legend : legend?.title || 'Mois de réserve';
  const shown = pinned || tip;
  // Infobulle gardée dans la partie visible (le panneau couvre la droite en exploration large).
  const place = t => {
    const w = wrapRef.current?.clientWidth || 800;
    const h = wrapRef.current?.clientHeight || 600;
    const right = !story && w >= 760 ? 460 : 0;
    const maxX = w - right - 290;
    const left = t.x + 14 > maxX ? t.x - 304 : t.x + 14;
    return { left: Math.max(8, Math.min(left, maxX)), top: Math.max(8, Math.min(t.y + 14, h - 190)) };
  };
  const filled = damList.filter(d => d.fillPct !== null);
  const dateLabel = frDay(joined.date);
  const fallback = status === 'error' || status === 'nogl';

  return (
    <div
      ref={wrapRef}
      className={'hub-map' + (story ? ' is-story' : '') + (showDams ? '' : ' is-dams-off') + (story && storyDams === 'faint' ? ' is-dams-faint' : '') + (far ? ' is-far' : '')}
      id="hub-map" tabIndex={-1} role="region" aria-label="Carte nationale de l'eau au Maroc"
    >
      <div ref={canvasHostRef} className="hub-map__canvas" />
      <canvas ref={overlayRef} className="hub-map__overlay" aria-hidden="true" />
      {status === 'loading' && (
        <div className="hub-map__skeleton" role="status">
          <span className="hub-map__sr">Chargement de la carte</span>
        </div>
      )}
      {fallback && (
        <div className="hub-map__fallback" role="alert">
          <p className="hub-map__fallback-msg">
            <strong>Carte 3D indisponible</strong>
            <span>{status === 'nogl' ? 'Ce navigateur n’affiche pas WebGL.' : 'Le fond de carte n’a pas pu se charger.'} Les chiffres restent dans le panneau.</span>
          </p>
          {!story && filled.length > 0 && (
            <div className="hub-map__fallback-list">
              <MicroLabel tone="muted">{'Barrages au bulletin du ' + dateLabel}</MicroLabel>
              <ul>
                {[...filled].sort((a, b) => b.storedMm3 - a.storedMm3).slice(0, 14).map(d => (
                  <li key={d.id}>
                    <span>{damTooltip(d).title.replace(/^Barrage /, '')}</span>
                    <span className="hub-map__fallback-bar" aria-hidden="true"><i style={{ '--lvl': Math.min(1, d.fillPct / 100) }} /></span>
                    <span className="hub-map__fallback-val">{fr(d.fillPct, 0) + ' %'}</span>
                  </li>
                ))}
              </ul>
              <span className="hub-map__fallback-note">Lu sur le bulletin, pas un relevé en direct.</span>
            </div>
          )}
        </div>
      )}
      {shown && !story && (
        <div className={'hub-map__tip' + (pinned ? ' is-pinned' : '')} style={place(shown)} role={pinned ? 'dialog' : 'tooltip'}>
          <strong>{shown.title}</strong>
          {shown.lines.map(l => <span key={l}>{l}</span>)}
          {pinned && shown.href && (
            <a href={shown.href} target="_blank" rel="noreferrer noopener" className="az-micro az-micro--accent">Ouvrir la source</a>
          )}
        </div>
      )}
      {story && fieldsOn && nearFields && status === 'ready' && (
        // Récit : la légende est masquée, la mention de source et la limite restent visibles avec les champs.
        <p className="hub-map__fields-note"><span>{FIELDS_LEGEND.label}</span><span>{FIELDS_LEGEND.note}</span></p>
      )}
      {legend !== false && status === 'ready' && (
        <aside className={'hub-map__legend' + (legendOpen ? ' is-open' : '')} aria-label="Légende de la carte">
          <button type="button" className="hub-map__legend-toggle" aria-expanded={legendOpen} onClick={() => setLegendOpen(o => !o)}>
            <MicroLabel tone="muted">{legendOpen ? 'Masquer la légende' : 'Légende'}</MicroLabel>
          </button>
          {legendOpen && (
            <div className="hub-map__legend-body">
              <Legend kind="bands" title={legendTitle} />
              {hasFlux && <Legend kind="flux" title="Sahara : dessalement ÷ demande potable (flux)" />}
              <ul className="hub-map__layers">
                {showDams && filled.length > 0 && (
                  <li><i className="hub-map__sw hub-map__sw--dam" aria-hidden="true"><b /></i>{'Niveau = taux lu au bulletin du ' + dateLabel + ' (' + filled.length + ' barrages)'}</li>
                )}
                {showDams && filled.some(d => d.fillPct < 30) && (
                  <li><i className="hub-map__sw hub-map__sw--dam is-bas" aria-hidden="true"><b /></i>Eau grisée : moins de 30 %</li>
                )}
                {showDams && <li><i className="hub-map__sw hub-map__sw--dam is-empty" aria-hidden="true" />Vide : pas de taux apparié</li>}
                {showDams && <li><i className="hub-map__sw hub-map__sw--dam is-unknown" aria-hidden="true" />Pointillé : capacité inconnue</li>}
                {showDams && <li className="hub-map__note">Taille selon la capacité (publiée, ou stock ÷ taux).</li>}
                {showDams && joined.unmatchedFill.length > 0 && (
                  <li className="hub-map__note">{joined.unmatchedFill.length + ' barrages du bulletin non placés (nom non apparié).'}</li>
                )}
                {fieldsOn && <li><i className="hub-map__sw hub-map__sw--field" aria-hidden="true" />{FIELDS_LEGEND.label}</li>}
                {fieldsOn && <li className="hub-map__note">{FIELDS_LEGEND.note}</li>}
                {showLinks && arcs.length > 0 && <li><i className="hub-map__sw hub-map__sw--solid" aria-hidden="true" />Liaison en service (schéma, pas le tracé)</li>}
                {showLinks && arcs.length > 0 && <li><i className="hub-map__sw hub-map__sw--dash" aria-hidden="true" />En construction ou planifiée</li>}
                {showLinks && arcs.some(a => a.link.verified === false) && <li><i className="hub-map__sw hub-map__sw--faint" aria-hidden="true" />Atténuée : non vérifiée</li>}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
});

export default HubMap;
