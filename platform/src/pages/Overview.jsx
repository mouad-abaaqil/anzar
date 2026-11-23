import { ChevronRight } from 'lucide-react';
import { date, number } from '../lib/format.js';

function latestSnapshot(data) {
  return [...(data.snapshots || [])].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

// Rendered by App around MapPage so that the map stays mounted between Overview and Map.
export function OverviewMetrics({ data, dams, onQuality }) {
  const snapshot = latestSnapshot(data);
  const bulletinSource = data.sources.find(s => s.id === snapshot?.sourceId)?.publisher || 'Bulletin public';
  const bulletinDate = snapshot?.date || data.asOf;
  return (
    <div className="resource-metrics" aria-label="Situation des barrages">
      <Metric
        label="Remplissage des barrages"
        value={number(data.region.fillPct)}
        unit="%"
        note="À l’échelle de la région"
        when={bulletinDate}
        source={bulletinSource}
        accent
      />
      <Metric
        label="Réserves disponibles"
        value={number(data.region.storageMm3, 2)}
        unit="Mm³"
        note={`Sur ${number(data.region.capacityMm3, 2)} Mm³ de capacité`}
        when={bulletinDate}
        source={bulletinSource}
      />
      <Metric
        label="Barrages dans le bulletin"
        value={String(dams.length).padStart(2, '0')}
        note="Ouvrages du périmètre régional"
        when={data.asOf}
        source={bulletinSource}
      />
      <Metric
        label="Qualité physico-chimique"
        value="—"
        note="Importez vos analyses de laboratoire"
        source="Analyses saisies dans votre espace"
        status="none"
        action={onQuality}
      />
    </div>
  );
}

export function OverviewSections({ data, dams, selected, onSelect, navigate }) {
  return (
    <>
      <section className="reservoir-section">
        <div className="section-heading">
          <div>
            <h2>Les retenues de la région</h2>
            <p>Situation publiée le {date(data.asOf)} · Mm³ : millions de mètres cubes</p>
          </div>
          <button className="text-button" onClick={() => navigate('map')}>Explorer la carte<ChevronRight size={15} /></button>
        </div>
        <div className="reservoir-grid">
          <div className="reservoir-head" aria-hidden="true">
            <span>Ouvrage</span>
            <span>Remplissage</span>
            <span>Volume stocké</span>
          </div>
          {[...dams].sort((a, b) => (b.fillPct || 0) - (a.fillPct || 0)).map(f => (
            <button
              key={f.id}
              className={`reservoir-row ${selected?.id === f.id ? 'is-selected' : ''}`}
              onClick={() => {
                onSelect(f.id);
                document.querySelector('.geography-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              <div className="reservoir-name"><span>{f.name}</span><ChevronRight size={15} /></div>
              <div className="reservoir-measure">
                <div className="fill-track"><span style={{ width: `${Math.min(100, f.fillPct || 0)}%` }} /></div>
                <strong>{number(f.fillPct)}<small> %</small></strong>
              </div>
              <span className="reservoir-volume">{number(f.storageMm3, 2)} Mm³</span>
            </button>
          ))}
        </div>
      </section>

      <section className="insights-section">
        <div className="section-heading">
          <h2>Un territoire, plusieurs ressources</h2>
          <span className="small-muted">Repères documentés</span>
        </div>
        <div className="insights-grid">
          {(data.context || [])
            .filter(c => ['water-security', 'desalination', 'reuse'].includes(c.id))
            .map((c, i) => (
              <button key={c.id || i} className="insight" onClick={() => navigate('cycle')}>
                <span className="insight-category">{['Ressources', 'Adaptation', 'Réutilisation'][i]}</span>
                <h3>{c.title}</h3>
                <p>{c.summary}</p>
                <span className="text-button">Comprendre le cycle<ChevronRight size={14} /></span>
              </button>
            ))}
        </div>
      </section>
    </>
  );
}

// KPI = value + label + date + source. A missing date is shown as such, never omitted.
function Metric({ label, value, unit, note, when, source, accent, action, status }) {
  return (
    <div className={`resource-metric ${accent ? 'accent' : ''}`}>
      <span className="metric-label">
        {status && <span className="status-dot" data-status={status} aria-hidden="true" />}
        {label}
      </span>
      <div className="metric-value">{value}{unit && <span>{unit}</span>}</div>
      {action
        ? <button onClick={action} className="metric-note-link">{note}<ChevronRight size={13} /></button>
        : <span className="metric-note">{note}</span>}
      <span className="metric-source">{when ? date(when) : 'Date non renseignée'} · {source}</span>
    </div>
  );
}
