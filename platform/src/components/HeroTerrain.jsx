import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './HeroTerrain.css';

maplibregl.setWorkerUrl(workerUrl);

const DEM = 'https://tiles.mapterhorn.com/tilejson.json';
const REGIONS_URL = '/data/morocco-regions.geojson';
// Une caméra par étape du récit : observer (Atlas), comprendre (Sud), simuler (vue nationale).
export const STAGES = [
  { center: [-6.3, 31.6], zoom: 6.6, pitch: 66, bearing: -18 },
  { center: [-9.0, 29.6], zoom: 7.1, pitch: 70, bearing: 24 },
  { center: [-7.4, 29.6], zoom: 5.15, pitch: 48, bearing: 0 },
];

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function ReliefFallback() {
  return (
    <svg className="ht-fallback" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ht-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#06121D" /><stop offset="1" stopColor="#12304A" /></linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#ht-sky)" />
      <path d="M0 330 L120 250 L190 300 L310 190 L420 290 L520 220 L640 300 L720 250 L800 310 V500 H0Z" fill="#0E2A40" />
      <path d="M0 380 L90 330 L200 370 L330 280 L450 360 L560 300 L700 370 L800 340 V500 H0Z" fill="#0A1F31" />
      <path d="M0 440 L140 400 L260 430 L400 380 L560 430 L700 400 L800 430 V500 H0Z" fill="#071622" />
      <path d="M310 190 L335 225 L290 225Z M520 220 L545 250 L500 250Z" fill="#5FD4E6" opacity=".35" />
    </svg>
  );
}

export default function HeroTerrain({ stage = 0, reduced = false }) {
  const host = useRef(null);
  const mapRef = useRef(null);
  const stageRef = useRef(stage);
  const [ok, setOk] = useState(() => hasWebGL());
  const [ready, setReady] = useState(false);
  stageRef.current = stage;

  useEffect(() => {
    if (!ok || !host.current) return undefined;
    let map;
    try {
      map = new maplibregl.Map({
        container: host.current,
        interactive: false,
        attributionControl: { compact: true, customAttribution: 'Relief : Mapterhorn · Limites : HCP / OCHA (CC BY-IGO)' },
        ...STAGES[stageRef.current],
        maxPitch: 78,
        fadeDuration: 0,
        style: {
          version: 8,
          sources: {
            dem: { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 },
            shade: { type: 'raster-dem', url: DEM, tileSize: 512, encoding: 'terrarium', maxzoom: 12 },
            regions: { type: 'geojson', data: REGIONS_URL },
          },
          layers: [
            { id: 'bg', type: 'background', paint: { 'background-color': '#0A1B2A' } },
            { id: 'shade', type: 'hillshade', source: 'shade', paint: {
              'hillshade-shadow-color': '#02080F', 'hillshade-highlight-color': '#E8C27A',
              'hillshade-accent-color': '#0E3350', 'hillshade-exaggeration': 0.9,
            } },
            { id: 'regions-fill', type: 'fill', source: 'regions', paint: { 'fill-color': '#5FD4E6', 'fill-opacity': 0.05 } },
            { id: 'regions-line', type: 'line', source: 'regions', paint: { 'line-color': '#5FD4E6', 'line-width': 1, 'line-opacity': 0.55 } },
          ],
          terrain: { source: 'dem', exaggeration: 1.7 },
        },
      });
    } catch { setOk(false); return undefined; }
    mapRef.current = map;
    map.on('load', () => setReady(true));
    map.on('webglcontextlost', () => setOk(false));

    let raf = 0;
    let last = performance.now();
    const spin = (now) => {
      raf = requestAnimationFrame(spin);
      const dt = now - last; last = now;
      // Orbite lente seulement quand la caméra est immobile.
      if (!reduced && !map.isMoving()) map.setBearing(map.getBearing() + dt * 0.004);
    };
    raf = requestAnimationFrame(spin);
    return () => { cancelAnimationFrame(raf); map.remove(); mapRef.current = null; };
  }, [ok, reduced]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ ...STAGES[stage], duration: reduced ? 0 : 3200, essential: false });
  }, [stage, reduced, ready]);

  if (!ok) return <div className="ht-root ht-root-fallback"><ReliefFallback /></div>;
  return (
    <div className={'ht-root' + (ready ? ' ht-ready' : '')}>
      <ReliefFallback />
      <div className="ht-map" ref={host} />
    </div>
  );
}
