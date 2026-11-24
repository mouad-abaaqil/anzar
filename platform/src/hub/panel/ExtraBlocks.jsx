// Blocs ajoutés au panneau : ET0, débit de rivière GloFAS, tendance satellite (Souss-Massa seulement),
// liste « Données ouvertes utilisées » du tiroir Sources. Valeurs modélisées ou estimées, jamais des relevés.
import { useEffect, useMemo, useState } from 'react';
import { MicroLabel, Panel, ProvenanceChip, Stat } from '../../design';
import { cacheKey, fetchJson, floodUrl, loadWithCache, normalizeFlood, readCache, regionPoint } from '../../lib/openData.js';
import { fmt } from './metrics.js';
import {
  ET0_CAVEAT, FLOOD_CACHE_KIND, FLOOD_CAVEAT, NO_FLOOD, OPEN_METEO_NOTE, RAIN_CACHE_KIND, SATELLITE_LABEL, SATELLITE_REGION,
  dateFr, directionLabel, openDataRows, satelliteTrend, trendPaths,
} from './extraLogic.js';
import './panel.css';

const storage = typeof window !== 'undefined' ? window.localStorage : null;

/** ET0 modélisée (Open-Meteo, même réponse que la pluie) : cumul 30 jours passés et 7 jours prévus. */
export function Et0Row({ et0, name, at }) {
  if (!et0) return null;
  return (
    <div className="pn-extra">
      <div className="pn-rainrow">
        <Stat size="sm" value={fmt(et0.past30Mm, 0)} unit="mm" label="ET0 sur 30 jours"
          provenance={{ status: 'derived', source: 'Open-Meteo, évapotranspiration de référence FAO-56, ' + (name || 'région'), date: at ? new Date(at).toLocaleDateString('fr-FR') : undefined, note: 'Valeur modélisée sur une grille, licence CC BY 4.0, usage non commercial. Pas une mesure.' }} />
        <Stat size="sm" value={fmt(et0.forecast7Mm, 0)} unit="mm" label="ET0 prévue sur 7 jours" />
      </div>
      <p className="pn-note pn-faint">{ET0_CAVEAT}</p>
    </div>
  );
}

function useFlood(point) {
  const [s, setS] = useState({ status: 'loading' });
  const key = point ? point.lat + '|' + point.lon : 'none';
  useEffect(() => {
    if (!point) { setS({ status: 'error' }); return undefined; }
    let alive = true;
    setS({ status: 'loading' });
    loadWithCache({ storage, key: cacheKey(FLOOD_CACHE_KIND, point), fetcher: async () => normalizeFlood(await fetchJson(floodUrl(point)), new Date().toISOString()) })
      .then(r => alive && setS({ status: 'ready', data: r.data, at: r.at, via: r.status }))
      .catch(() => alive && setS({ status: 'error' }));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

/** Débit de rivière GloFAS pour le point de la région, avec la mise en garde obligatoire. */
export function FloodPanel({ point }) {
  const f = useFlood(point);
  const d = f.data;
  const none = d && d.lastObserved === null && d.forecastPeakM3s === null;
  return (
    <Panel label="Rivière · modélisé, pas une jauge" title="Débit de rivière">
      {f.status === 'loading' && <p className="pn-note" role="status">Chargement du débit modélisé…</p>}
      {f.status === 'error' && <p className="pn-note" role="alert">Débit indisponible pour le moment (service Open-Meteo injoignable). Aucune valeur n’est affichée à la place.</p>}
      {f.status === 'ready' && (none ? <p className="pn-note">{NO_FLOOD}</p> : (
        <div className="pn-rainrow">
          <Stat size="sm" value={fmt(d.lastObserved?.m3s, 2)} unit={d.unit} label={'dernier jour passé' + (d.lastObserved ? ' · ' + dateFr(d.lastObserved.date) : '')}
            provenance={{ status: 'derived', source: 'Open-Meteo Flood API (GloFAS, Copernicus/ECMWF)', date: f.at ? new Date(f.at).toLocaleDateString('fr-FR') : undefined, note: FLOOD_CAVEAT + ' Maille : ' + fmt(d.grid?.lat, 2) + '°, ' + fmt(d.grid?.lon, 2) + '°. Un oued sec affiche une valeur proche de zéro. Licence CC BY 4.0, usage non commercial.' }} />
          <Stat size="sm" value={fmt(d.forecastPeakM3s, 2)} unit={d.unit} label="pic prévu sur 7 jours" />
        </div>
      ))}
      <p className="pn-note pn-faint">Pas une jauge ni une alerte de crue. {f.status === 'ready' && !none ? 'Une maille de rivière peut ne correspondre à aucun cours d’eau nommé.' : ''}</p>
    </Panel>
  );
}

function useSatellite(regionId) {
  const [s, setS] = useState({ status: 'idle' });
  useEffect(() => {
    if (regionId !== SATELLITE_REGION) { setS({ status: 'idle' }); return undefined; }
    let alive = true;
    setS({ status: 'loading' });
    Promise.all([fetchJson('/data/storage-reconstruction.json', globalThis.fetch, 20000), fetchJson('/data/fill-forecast.json').catch(() => null)])
      .then(([rec, fc]) => alive && setS({ status: 'done', trend: satelliteTrend(rec, fc) }))
      .catch(() => alive && setS({ status: 'error' }));
    return () => { alive = false; };
  }, [regionId]);
  return s;
}

/** Tendance satellite du stock reconstitué : Souss-Massa seulement, jamais un volume ni une base de décision. */
export function SatelliteTrend({ regionId }) {
  const s = useSatellite(regionId);
  const t = s.trend;
  const paths = useMemo(() => (t?.status === 'ready' ? trendPaths(t.points) : null), [t]);
  if (regionId !== SATELLITE_REGION) return null;
  const month = p => new Date(p.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  return (
    <Panel label="Satellite · estimation non officielle" title="Tendance du stock"
      actions={<ProvenanceChip status="hypothese" source="Sentinel-2 (surface d’eau NDWI) calée sur les bulletins officiels" date={t?.generatedAt ? String(t.generatedAt).slice(0, 10) : undefined} note="Estimation satellite non officielle : la surface d’eau est convertie en volume par un calage sur trois semaines de bulletins. Les volumes ne sont pas affichés." />}>
      <MicroLabel>{SATELLITE_LABEL}</MicroLabel>
      {s.status === 'loading' && <p className="pn-note" role="status">Chargement de l’estimation satellite…</p>}
      {s.status === 'error' && <p className="pn-note" role="alert">Estimation satellite indisponible. Rien n’est affiché à la place.</p>}
      {t?.status === 'unavailable' && <p className="pn-note">Reconstitution en cours de calcul : aucune valeur affichée.</p>}
      {t?.status === 'inconsistent' && <p className="pn-note pn-warn" role="alert">▲ Données incohérentes ({t.count} points) : ne pas s’y fier, rien n’est tracé.</p>}
      {t?.status === 'ready' && (
        <>
          <svg viewBox={'0 0 ' + paths.box.w + ' ' + paths.box.h} className="pn-trend" role="img"
            aria-label={'Forme de l’estimation satellite du stock, de ' + month(t.first) + ' à ' + month(t.last) + ', avec sa bande d’incertitude. Sans valeur chiffrée : tendance, pas un volume.'}>
            <path d={paths.band} className="pn-band" />
            <path d={paths.line} className="pn-line" />
          </svg>
          <p className="pn-fig__cap"><span>{month(t.first)}</span><span>bande : incertitude du calage</span><span>{month(t.last)}</span></p>
          <p className="pn-note">{directionLabel(t.direction)}{t.coveredShare != null && ' Part de la capacité couverte : ' + fmt(t.coveredShare * 100, 0) + ' % ; le reste n’est pas estimé.'}</p>
          <p className={'pn-note ' + (t.verdict.beats ? '' : 'pn-warn')} role="status">{(t.verdict.beats ? '' : '▲ ') + 'Prévision à 30 jours : ' + t.verdict.text.charAt(0).toLowerCase() + t.verdict.text.slice(1) + '.'}{!t.forecastShown && ' Elle n’est donc pas affichée.'}</p>
        </>
      )}
    </Panel>
  );
}

/** Liste « Données ouvertes utilisées » du tiroir Sources : date lue dans le cache local, sinon « pas chargée ». */
export function OpenDataSources({ data, regionId }) {
  const rows = useMemo(() => {
    const point = regionPoint(regionId, data?.geo);
    const rain = point ? readCache(storage, cacheKey(RAIN_CACHE_KIND, point)) : null;
    const flood = point ? readCache(storage, cacheKey(FLOOD_CACHE_KIND, point)) : null;
    return openDataRows({ rain, flood, climateFetchedAt: data?.climate?.fetchedAt || null });
  }, [data, regionId]);
  return (
    <section className="pn-sources" aria-labelledby="pn-od-title">
      <h2 id="pn-od-title" className="pn-sources__title">Données ouvertes utilisées</h2>
      <ul className="pn-sources__list">
        {rows.map(r => (
          <li key={r.id}>
            <strong>{r.label}</strong>
            <a href={r.url} target="_blank" rel="noreferrer">{r.provider}</a>
            <span>Licence : {r.license}</span>
            <span>Récupérée : {r.at ? dateFr(r.at) : 'pas de date'}</span>
            <span className="pn-sources__status">{r.statusLabel}</span>
          </li>
        ))}
      </ul>
      <p className="pn-note">{OPEN_METEO_NOTE}</p>
    </section>
  );
}
