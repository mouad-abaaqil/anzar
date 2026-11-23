import { useCallback, useEffect, useMemo, useState } from 'react';
import { RAIN_COMPARISON, RAIN_COMPARISON_LABEL, rainTotals } from '../lib/forecast.js';
import { date, number } from '../lib/format.js';
import {
  DEFAULT_REGION_ID, OPEN_DATA_SOURCES, cacheKey, fetchJson, floodUrl, forecastUrl, loadWithCache, normalizeEt0, normalizeFlood,
  regionIdFromHash, regionPoint, sourceRow,
} from '../lib/openData.js';
import { normalizeRain, rainPoints, rainUrl } from '../../server/rain.mjs';

const storage = typeof window !== 'undefined' ? window.localStorage : null;
let geoPromise = null;
const loadGeo = () => (geoPromise ??= fetchJson('/data/morocco-regions.geojson').catch(e => { geoPromise = null; throw e; }));

// La région vient du hash (#/app/<page>/<région>) : le bloc suit le sélecteur sans toucher à App.jsx.
function useRegionPoint() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  const [geo, setGeo] = useState(null);
  const [geoFailed, setGeoFailed] = useState(false);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const regionId = regionIdFromHash(hash);
  useEffect(() => {
    if (regionId === DEFAULT_REGION_ID || geo) return undefined;
    let alive = true;
    loadGeo().then(g => { if (alive) { setGeo(g); setGeoFailed(false); } }).catch(() => { if (alive) setGeoFailed(true); });
    return () => { alive = false; };
  }, [regionId, geo]);
  // undefined : en chargement ; null : région ou position inconnue.
  const point = useMemo(() => {
    if (regionId === DEFAULT_REGION_ID) return regionPoint(regionId);
    if (geo) return regionPoint(regionId, geo);
    return geoFailed ? null : undefined;
  }, [regionId, geo, geoFailed]);
  return { regionId, point };
}

// Région par défaut : API Anzar d'abord, sinon appel direct à Open-Meteo (site statique sans API).
async function fetchRain(point) {
  const now = () => new Date().toISOString();
  if (point.regionId === DEFAULT_REGION_ID) {
    try {
      const d = await fetchJson('/api/rain');
      if (!Array.isArray(d?.points)) throw new Error('format inattendu');
      return { ...d, via: 'api' };
    } catch { /* repli ci-dessous */ }
    const points = rainPoints(await fetchJson('/data/region.json'));
    return { ...normalizeRain(await fetchJson(rainUrl(points)), points, now()), via: 'direct' };
  }
  const points = [{
    id: `region-${point.regionId}`, name: point.name, lat: point.lat, lon: point.lon,
    role: 'centre de la région', note: 'Point modélisé au centroïde de la région ; ce n’est pas une moyenne régionale.',
  }];
  return { ...normalizeRain(await fetchJson(rainUrl(points)), points, now()), via: 'direct' };
}


function MiniBars({ daily, name }) {
  const vals = daily.map(d => (Number.isFinite(d.precipitation_mm) ? d.precipitation_mm : 0));
  const max = Math.max(1, ...vals);
  const w = 4, gap = 1, h = 32;
  const width = daily.length * (w + gap);
  return (
    <svg className="rain-bars" viewBox={`0 0 ${width} ${h}`} width={Math.min(width * 1.6, 280)} height={h} role="img"
      aria-label={`Pluie quotidienne modélisée, ${daily.length} jours, ${name}. Passé en bleu, prévision en jaune avec contour.`}>
      {daily.map((d, i) => {
        const bh = (vals[i] / max) * (h - 2);
        const fc = d.kind === 'forecast';
        return (
          <rect key={d.date} x={i * (w + gap)} y={h - bh} width={w} height={Math.max(bh, vals[i] > 0 ? 1 : 0)}
            className={fc ? 'bar-forecast' : 'bar-past'}>
            <title>{`${date(d.date)} : ${number(vals[i], 1)} mm (${fc ? 'prévision' : 'modélisé'})`}</title>
          </rect>
        );
      })}
      <line x1="0" x2={width} y1={h - 0.5} y2={h - 0.5} className="bar-base" />
    </svg>
  );
}

const stamp = iso => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Charge une source ouverte pour un point ; l'état suit le point sélectionné.
function useOpenData(kind, point, url, normalize) {
  const [state, setState] = useState({ status: 'loading' });
  const key = point ? `${point.lat}|${point.lon}` : String(point);
  const load = useCallback((force = false) => {
    if (!point) { setState({ status: point === null ? 'error' : 'loading' }); return undefined; }
    let alive = true;
    setState({ status: 'loading' });
    loadWithCache({
      storage,
      key: cacheKey(kind, point),
      force,
      fetcher: async () => normalize(await fetchJson(url(point)), new Date().toISOString()),
    })
      .then(r => { if (alive) setState({ status: r.status, data: r.data, at: r.at }); })
      .catch(() => { if (alive) setState({ status: 'error' }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => load(), [load]);
  return [state, load];
}

const mm = v => (v === null || v === undefined ? '—' : `${number(v, 1)} mm`);

function OpenDataPanel({ point, regionName, rainLoad }) {
  const [et0, reloadEt0] = useOpenData('et0', point, forecastUrl, normalizeEt0);
  const [flood, reloadFlood] = useOpenData('flood', point, floodUrl, normalizeFlood);
  const failed = et0.status === 'error' || flood.status === 'error';
  const rows = [
    sourceRow('rain', rainLoad ? { status: rainLoad.status, at: rainLoad.at } : { status: 'loading' }),
    sourceRow('et0', et0),
    sourceRow('flood', flood),
  ];
  const ed = et0.data;
  const fd = flood.data;

  return (
    <section className="fc-card" aria-labelledby="od-title">
      <div className="fc-head">
        <h2 id="od-title">Évaporation et débit{regionName ? ` : ${regionName}` : ''}</h2>
        <span className="fc-chip chip-caution">modélisés, pas des stations</span>
      </div>

      {ed && (
        <>
          <h3 className="fc-h3">Évapotranspiration de référence (ET0)</h3>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th scope="col">Indicateur</th>
                  <th scope="col" className="num">Valeur</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">30 jours passés (cumul)</th><td className="num">{mm(ed.past30Mm)}</td></tr>
                <tr><th scope="row">Moyenne des 30 jours</th><td className="num">{ed.meanPastMmDay === null ? '—' : `${number(ed.meanPastMmDay, 1)} mm/j`}</td></tr>
                <tr><th scope="row">7 jours prévus (cumul)</th><td className="num">{mm(ed.forecast7Mm)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="fc-source">
            ET0 FAO-56 modélisée : demande évaporative d’une surface de référence, ce n’est pas l’évaporation mesurée d’une retenue.
            Elle indique si l’atmosphère assèche plus vite qu’il ne pleut, rien de plus.
          </p>
        </>
      )}

      {fd && (
        <>
          <h3 className="fc-h3">Débit de rivière modélisé (GloFAS)</h3>
          {fd.lastObserved === null && fd.forecastPeakM3s === null ? (
            <p className="fc-muted">Aucun débit modélisé n’existe pour cette maille : aucune valeur n’est affichée.</p>
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th scope="col">Indicateur</th>
                    <th scope="col" className="num">Valeur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Dernier jour passé{fd.lastObserved ? ` (${date(fd.lastObserved.date)})` : ''}</th>
                    <td className="num">{fd.lastObserved ? `${number(fd.lastObserved.m3s, 2)} ${fd.unit}` : '—'}</td>
                  </tr>
                  <tr><th scope="row">Pic prévu sur 7 jours</th><td className="num">{fd.forecastPeakM3s === null ? '—' : `${number(fd.forecastPeakM3s, 2)} ${fd.unit}`}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="fc-source">
            Débit simulé par le modèle GloFAS sur une grille d’environ 5 km, calé sur le réseau hydrographique mondial : il peut ne
            correspondre à aucun cours d’eau nommé ni à une station de jaugeage, et un oued sec affiche une valeur proche de zéro.
            {fd.grid?.lat != null && fd.grid?.lon != null ? `Maille utilisée : ${number(fd.grid.lat, 2)}°, ${number(fd.grid.lon, 2)}°. ` : ''}Ce n’est pas une alerte de crue officielle.
          </p>
        </>
      )}

      {(et0.status === 'loading' || flood.status === 'loading') && <p className="fc-muted" role="status">Chargement des données ouvertes…</p>}
      {failed && (
        <div className="fc-alert" role="alert">
          <p>
            {et0.status === 'error' && 'L’évapotranspiration modélisée est indisponible. '}
            {flood.status === 'error' && 'Le débit modélisé est indisponible. '}
            Aucune valeur n’est affichée à la place.
          </p>
          <button type="button" className="secondary-button" onClick={() => { reloadEt0(true); reloadFlood(true); }}>Réessayer</button>
        </div>
      )}

      <h3 className="fc-h3">Données ouvertes utilisées</h3>
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">État</th>
              <th scope="col">Récupérée</th>
              <th scope="col">Licence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <th scope="row">
                  {r.label}
                  <span className="fc-sub"><a href={r.url} target="_blank" rel="noreferrer">{r.provider}</a>, sans clé</span>
                </th>
                <td>{r.statusLabel}</td>
                <td>{stamp(r.at)}</td>
                <td>{r.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fc-source">
        L’offre gratuite d’Open-Meteo est réservée à un usage non commercial ({OPEN_DATA_SOURCES.rain.license}). Un déploiement commercial exige
        l’offre payante. Détail de toutes les sources étudiées : docs/OPEN_DATA.md.
      </p>
    </section>
  );
}

export default function RainPanel() {
  const { regionId, point } = useRegionPoint();
  const [state, setState] = useState({ status: 'loading' });
  const pointKey = point ? `${point.regionId}|${point.lat}|${point.lon}` : String(point);
  const load = useCallback((force = false) => {
    if (point === undefined) { setState({ status: 'loading' }); return undefined; }
    if (point === null) { setState({ status: 'nopoint' }); return undefined; }
    let alive = true;
    setState({ status: 'loading' });
    loadWithCache({ storage, key: cacheKey(`rain-${point.regionId}`, point), fetcher: () => fetchRain(point), force })
      .then(r => { if (alive) setState({ status: 'ready', data: r.data, load: r }); })
      .catch(e => { if (alive) setState({ status: 'error', code: e.code }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);
  useEffect(() => load(), [load]);

  const max = Math.max(...RAIN_COMPARISON.map(r => r[1]));
  const isDefault = regionId === DEFAULT_REGION_ID;
  return (
    <>
    <section className="fc-card" aria-labelledby="rain-title">
      <div className="fc-head">
        <h2 id="rain-title">{isDefault ? 'Pluie sur les barrages' : `Pluie modélisée : ${point?.name || 'région'}`}</h2>
        <span className="fc-chip chip-caution">modélisée, pas un pluviomètre</span>
      </div>

      {state.status === 'loading' && <p className="fc-muted" role="status">Chargement de la pluie modélisée…</p>}
      {state.status === 'nopoint' && (
        <div className="fc-alert" role="alert"><p>La position de cette région est introuvable : aucune valeur de pluie n’est affichée.</p></div>
      )}
      {state.status === 'error' && (
        <div className="fc-alert" role="alert">
          <p>
            Ni l’API Anzar ni le service météo ouvert (Open-Meteo) ne répondent, et aucune copie locale n’existe. Aucune valeur de pluie n’est affichée.
          </p>
          <button type="button" className="secondary-button" onClick={() => load(true)}>Réessayer</button>
        </div>
      )}
      {state.status === 'ready' && (() => {
        const d = state.data;
        const points = d.points || [];
        // Each point's caveat is listed once under the table and referenced by number.
        const notes = [...new Set(points.map(p => p.note).filter(Boolean))];
        return (
          <>
            {state.load.status === 'stale' && (
              <p className="fc-alert" role="status">
                Données anciennes : le service est injoignable, la dernière copie locale est affichée (récupérée le {date(new Date(state.load.at).toISOString())}).
              </p>
            )}
            {d.stale && (
              <p className="fc-alert" role="status">
                Données anciennes : le service amont n’a pas répondu, la dernière réponse en cache est affichée
                {d.fetchedAt ? ` (récupérée le ${date(d.fetchedAt)})` : ''}.
              </p>
            )}
            {points.length === 0 ? <p className="fc-muted">Aucun barrage avec coordonnées n’est disponible.</p> : (<>
              <div className="fc-table-wrap">
                <table className="fc-table">
                  <thead>
                    <tr>
                      <th scope="col">{isDefault ? 'Barrage (point amont)' : 'Point modélisé'}</th>
                      <th scope="col" className="num">30 jours passés</th>
                      <th scope="col" className="num">7 jours prévus</th>
                      <th scope="col">Pluie quotidienne (37 j)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map(p => {
                      const t = rainTotals(p);
                      return (
                        <tr key={p.id}>
                          <th scope="row">{p.name}{p.note && <sup className="fc-note-ref">{notes.indexOf(p.note) + 1}</sup>}</th>
                          <td className="num">{t.past30 === null ? '—' : `${number(t.past30, 1)} mm`}</td>
                          <td className="num">{t.forecast7 === null ? '—' : `${number(t.forecast7, 1)} mm`}</td>
                          <td><MiniBars daily={p.daily || []} name={p.name} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {notes.length > 0 && (
                <ol className="fc-notes">
                  {notes.map(n => <li key={n}>{n}</li>)}
                </ol>
              )}
            </>)}
            <ul className="fc-legend" aria-label="Légende des barres">
              <li><span className="sw sw-past" aria-hidden="true" />Passé (modélisé)</li>
              <li><span className="sw sw-forecast" aria-hidden="true" />Prévision</li>
            </ul>
            <p className="fc-source">
              Source : {d.source || OPEN_DATA_SOURCES.rain.provider} · licence {d.license || OPEN_DATA_SOURCES.rain.license}, usage non commercial ({d.via === 'direct' ? 'appel direct du navigateur à Open-Meteo' : 'via l’API Anzar'})
              {d.fetchedAt ? ` · récupérée le ${date(d.fetchedAt)}` : ''}. Valeurs modélisées sur une grille, pas un pluviomètre. Ces valeurs du modèle de prévision n’ont pas été comparées à un pluviomètre. Pour la réanalyse ERA5 (moyennes ci-dessous), la comparaison avec la station de Youssef Ben Tachfine (agence de bassin, 1990-2024) montre une surestimation d’environ 1,5 fois en moyenne, bien davantage en saison sèche, pour une corrélation mensuelle d’environ 0,9.
            </p>
          </>
        );
      })()}

      <h3 className="fc-h3">Comparaison nord-sud</h3>
      <ul className="rain-compare" aria-label="Pluie annuelle moyenne modélisée par ville">
        {RAIN_COMPARISON.map(([name, mm]) => (
          <li key={name}>
            <span className="rc-name">{name}</span>
            <span className="rc-track" aria-hidden="true"><span className={`rc-fill ${name === 'Agadir' ? 'is-focus' : ''}`} style={{ width: `${(mm / max) * 100}%` }} /></span>
            <span className="rc-val">{number(mm, 0)} mm</span>
          </li>
        ))}
      </ul>
      <p className="fc-source">Barres : {RAIN_COMPARISON_LABEL}. Source : ERA5 via Open-Meteo, 2000-2025.</p>
    </section>
    <OpenDataPanel point={point} regionName={point?.name} rainLoad={state.status === 'ready' ? state.load : null} />
    </>
  );
}
