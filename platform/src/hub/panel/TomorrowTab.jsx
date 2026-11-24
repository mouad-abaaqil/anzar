import { Button, MicroLabel, Panel, ProvenanceChip, Slider, Stat } from '../../design';
import { FLUX_GLYPH } from '../../design/bands.js';
import { DEPLETED_NOTE, FLUX_LABELS, RAIN_TO_RUNOFF_ELASTICITY } from '../../lib/balance.js';
import { ClimateRange, SimChart } from './charts.jsx';
import { SatelliteTrend } from './ExtraBlocks.jsx';
import { HYDRO, START_YEAR, defaultScenario, fmt, pctText, signed } from './metrics.js';

export default function TomorrowTab({ data, regionId, model, scenario, onScenario }) {
  if (!model) return <p className="az-text">Données indisponibles pour cette région. Rien n’est estimé à leur place.</p>;
  const sc = scenario ?? model.sc;
  const set = patch => onScenario?.({ ...sc, ...patch });
  const { noStock, series, depletionYear, climate, year } = model;
  const hydro = sc.hydrology ?? 'normal';
  const hydroLabel = HYDRO.find(h => h.id === hydro)?.label.toLowerCase();
  const months = noStock ? null : model.monthsAtYear;
  const depletedByThen = !noStock && depletionYear != null && depletionYear <= year;
  const flux = model.fluxAtYear;

  return (
    <div className="pn-stack">
      <section className="pn-hero" aria-label={'Réserve en ' + year}>
        <MicroLabel>{'Scénario ' + hydroLabel + ' · ' + year + ' · pas une prédiction'}</MicroLabel>
        {noStock ? (
          <>
            <Stat size="lg" value={pctText(flux?.coveragePct)} unit="%" label={'du potable dessalé en ' + year}
              provenance={{ status: 'hypothese', source: 'Capacité potable × 80 % ÷ demande potable estimée', note: 'Indicateur de flux. Nappes non modélisées.' }} />
            {flux?.band && <span className="pn-flux-tag">{FLUX_GLYPH + ' ' + FLUX_LABELS[flux.band]}</span>}
            <p className="pn-lead">Pas de stock de surface : pas de courbe. Ajustez la population, les économies ou le dessalement.</p>
          </>
        ) : (
          <>
            <Stat size="lg" value={fmt(months, months != null && months >= 10 ? 0 : 1)} unit="mois de réserve" label={'fin ' + year + ', si ce scénario se réalise'}
              band={model.bandAtYear}
              provenance={{ status: 'hypothese', source: 'Simulation annuelle, scénario ' + hydroLabel, note: 'Apports = moyenne du bassin × facteur d’hypothèse non validé. Pas une prévision météo.' }} />
            <p className="pn-lead">{depletedByThen ? 'Le stock de surface serait épuisé dès ' + depletionYear + '.' : depletionYear != null ? 'Stock épuisé dès ' + depletionYear + ' dans ce scénario.' : 'Pas d’épuisement du stock d’ici dix ans dans ce scénario.'}</p>
          </>
        )}
      </section>

      {!noStock && (
        <Panel label="Stock sur 10 ans" title="Du sec à l’humide" actions={<ProvenanceChip status="hypothese" source="Simulation balance.js" note="La bande va du scénario sec au scénario humide. Scénario, pas une prédiction." />}>
          <SimChart series={series} selected={hydro} capacity={model.capacityMm3} year={year} />
          {depletionYear != null && <p className="pn-note pn-warn">▲ {DEPLETED_NOTE}</p>}
        </Panel>
      )}

      <Panel label="Hypothèses" title="Et si…" actions={<Button variant="ghost" size="sm" onClick={() => onScenario?.(defaultScenario(data, regionId))}>Réinitialiser</Button>}>
        <div className="pn-sliders">
          {!noStock && (
            <div role="group" aria-label="Année de pluie" className="pn-seg">
              {HYDRO.map(h => <Button key={h.id} size="sm" variant={hydro === h.id ? 'primary' : 'secondary'} aria-pressed={hydro === h.id} onClick={() => set({ hydrology: h.id })}>{h.label}</Button>)}
            </div>
          )}
          <Slider label="Année" value={year} min={START_YEAR} max={START_YEAR + 9} step={1} onChange={v => set({ year: v })} />
          <Slider label="Population" value={sc.popGrowth ?? 0} min={-1} max={6} step={0.1} format={v => signed(v, 1) + ' %/an'} onChange={v => set({ popGrowth: v })} />
          <Slider label="Économies d’eau" value={sc.demandReductionPct ?? 0} min={0} max={40} step={1} format={v => v + ' %'} onChange={v => set({ demandReductionPct: v })} />
          <Slider label="Dessalement ajouté" value={sc.addedDesalMm3 ?? 0} min={0} max={300} step={5} format={v => v + ' Mm³/an'} onChange={v => set({ addedDesalMm3: v })} />
          <Slider label="Eaux usées réutilisées" value={sc.reusePct ?? 0} min={0} max={100} step={5} format={v => v + ' %'} onChange={v => set({ reusePct: v })} />
          {!noStock && <Slider label="Pluie 2050 (CMIP6)" value={sc.rainChangePct ?? 0} min={-40} max={40} step={1} format={v => signed(v, 0) + ' %'} onChange={v => set({ rainChangePct: v })} />}
        </div>
      </Panel>

      {!noStock && (
        <Panel label="Climat · projection modélisée" title="Signal CMIP6">
          {climate ? (
            <>
              <Stat size="sm" value={signed(climate.medianPct, 1)} unit="% de pluie" label={'médiane, bassin ' + climate.basin + ', 2026-2050 vs 1991-2020'}
                provenance={{ status: 'derived', source: 'Open-Meteo Climate API (CMIP6)', date: String(data.climate?.fetchedAt || '').slice(0, 10), note: 'Usage non commercial, ' + climate.nModels + ' modèles, un point par bassin, pas une prévision. Valeur par défaut du curseur pluie via une conversion pluie→apport (élasticité ' + RAIN_TO_RUNOFF_ELASTICITY + ', hypothèse non sourcée).' }} />
              <ClimateRange s={climate} />
              <p className="pn-note pn-faint">Entre {climate.nModels} modèles : de {signed(climate.minPct, 0)} à {signed(climate.maxPct, 0)} %. Projection, pas une prévision.</p>
            </>
          ) : <p className="pn-note">Signal climatique indisponible pour cette région. Rien n’est estimé à sa place.</p>}
        </Panel>
      )}

      <SatelliteTrend regionId={regionId} />
    </div>
  );
}
