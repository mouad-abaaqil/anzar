import { useEffect, useMemo, useState } from 'react';
import { MicroLabel, Panel, Stat } from '../../design';
import { FLUX_GLYPH } from '../../design/bands.js';
import { FLUX_LABELS } from '../../lib/balance.js';
import { cacheKey, fetchJson, forecastUrl, loadWithCache, normalizeEt0, regionPoint } from '../../lib/openData.js';
import { DemandBars, RainBars } from './charts.jsx';
import BasinDams from './BasinDams.jsx';
import { Et0Row, FloodPanel } from './ExtraBlocks.jsx';
import { RAIN_CACHE_KIND, plannedDesalNote } from './extraLogic.js';
import { fmt, pctText, regionBalance } from './metrics.js';

const storage = typeof window !== 'undefined' ? window.localStorage : null;
const dateFr = iso => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Pluie modélisée (Open-Meteo, 30 jours passés + 7 prévus) pour le point de la région. null = non disponible, jamais inventé. */
function useRain(regionId, point) {
  const [s, setS] = useState({ status: 'loading' });
  const key = point ? point.lat + '|' + point.lon : 'none';
  useEffect(() => {
    if (!point) { setS({ status: regionId && point === null ? 'error' : 'loading' }); return undefined; }
    let alive = true;
    setS({ status: 'loading' });
    loadWithCache({
      storage, key: cacheKey(RAIN_CACHE_KIND, point),
      fetcher: async () => {
        const j = await fetchJson(forecastUrl(point));
        const d = j?.daily;
        if (!Array.isArray(d?.time) || !Array.isArray(d?.precipitation_sum)) throw new Error('format inattendu');
        const n = d.time.length;
        const days = d.time.map((t, i) => ({ date: t, mm: Number.isFinite(d.precipitation_sum[i]) ? d.precipitation_sum[i] : null, forecast: i >= n - 7 }));
        return { days, et0: (() => { try { return normalizeEt0(j, new Date().toISOString()); } catch { return null; } })() };
      },
    }).then(r => alive && setS({ status: 'ready', days: r.data.days, et0: r.data.et0, at: r.at, via: r.status, name: point.name }))
      .catch(() => alive && setS({ status: 'error' }));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

const sum = ds => { const v = ds.filter(d => d.mm !== null); return v.length ? v.reduce((t, d) => t + d.mm, 0) : null; };

export default function TodayTab({ data, regionId, model }) {
  const point = useMemo(() => regionPoint(regionId, data.geo), [regionId, data.geo]);
  const rain = useRain(regionId, point);
  if (!model) return <p className="az-text">Données indisponibles pour cette région. Rien n’est estimé à leur place.</p>;
  const { noStock, stock, monthsNow, bandNow, fluxNow, demandNow } = model;
  const bDate = data.bulletin?.date;
  const past = rain.status === 'ready' ? rain.days.filter(d => !d.forecast) : [];
  const fc = rain.status === 'ready' ? rain.days.filter(d => d.forecast) : [];
  const potable = demandNow?.potableMm3;

  return (
    <div className="pn-stack">
      {!noStock ? (
        <section className="pn-hero" aria-label="Réserve en mois">
          <MicroLabel>{'Barrages · bulletin du ' + (dateFr(bDate) || '—')}</MicroLabel>
          <Stat size="lg" value={fmt(monthsNow, monthsNow >= 10 ? 0 : 1)} unit="mois de réserve" label="stock des barrages et dessalement"
            band={bandNow}
            provenance={{ status: 'derived', source: 'Bulletin des barrages × demande estimée', date: bDate, note: 'Part de bassin indicative, 60 % de la demande servie par les barrages (hypothèse). Nappes et pluie future non comptées.' }} />
          <p className="pn-lead">{monthsNow == null ? 'Réserve non calculable avec les données actuelles.' : 'Durée tenue sans nouvelle pluie, au rythme actuel de consommation.'}</p>
        </section>
      ) : (
        <section className="pn-hero" aria-label="Part du potable dessalé">
          <MicroLabel>Indicateur de flux, pas des mois de réserve</MicroLabel>
          <Stat size="lg" value={pctText(fluxNow?.coveragePct)} unit="%" label="du potable estimé vient du dessalement"
            provenance={{ status: 'hypothese', source: 'Capacité potable × 80 % ÷ demande potable estimée', note: 'Borné à 100 %. Le reste est supposé venir de nappes non modélisées.' }} />
          {fluxNow?.band && <span className="pn-flux-tag">{FLUX_GLYPH + ' ' + FLUX_LABELS[fluxNow.band]}</span>}
          <p className="pn-lead">Pas de barrage suivi ici : aucun stock, donc pas de mois de réserve. Nappes non modélisées.</p>
          {plannedDesalNote(regionBalance(data, regionId)) && <p className="pn-note">{plannedDesalNote(regionBalance(data, regionId))}</p>}
        </section>
      )}

      <BasinDams data={data} regionId={regionId} stock={!noStock && stock?.hasStock ? stock : null} />

      <Panel label="Demande estimée" title="Qui consomme ?" actions={null}>
        <DemandBars demand={demandNow} />
        {potable != null && <p className="pn-note">dont potable : {fmt(potable, 0)} Mm³ par an <span className="pn-faint">(estimation)</span></p>}
      </Panel>

      <Panel label="Pluie · modélisée, pas un pluviomètre" title="Pluie récente">
        {rain.status === 'loading' && <p className="pn-note" role="status">Chargement de la pluie modélisée…</p>}
        {rain.status === 'error' && <p className="pn-note" role="alert">Pluie indisponible pour le moment (service Open-Meteo injoignable). Aucune valeur n’est affichée à la place.</p>}
        {rain.status === 'ready' && (
          <>
            <div className="pn-rainrow">
              <Stat size="sm" value={fmt(sum(past), 0)} unit="mm" label="sur 30 jours"
                provenance={{ status: 'derived', source: 'Open-Meteo (modèles météo), ' + rain.name, date: rain.at ? new Date(rain.at).toLocaleDateString('fr-FR') : undefined, note: 'Valeur modélisée sur une grille, licence CC BY 4.0, usage non commercial. Pas un relevé de station.' }} />
              <Stat size="sm" value={fmt(sum(fc), 0)} unit="mm" label="prévus sur 7 jours" />
            </div>
            <RainBars days={rain.days} />
            <p className="pn-note pn-faint">Trait plein : passé modélisé. Contour : prévision.</p>
            <Et0Row et0={rain.et0} name={rain.name} at={rain.at} />
          </>
        )}
      </Panel>

      <FloodPanel point={point} />
    </div>
  );
}
