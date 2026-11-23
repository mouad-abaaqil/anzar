import { ChevronRight, ExternalLink, Info, MapPin } from 'lucide-react';
import { NO_LOGO_TEXT, OperatorLogo, StatusBadge } from './RegionSelector.jsx';
import RegionMap from './RegionMap.jsx';
import { date, number } from '../lib/format.js';
import { REGION_SCOPE_NOTICE, fillDelta, neighbourFills, regionBasin, regionById, signed, sourcesFor, NO_BASIN_LABEL } from '../lib/regions.js';
import '../pages/regions.css';
import './RegionOverview.css';

export function ScopeNotice() {
  return (
    <p className="scope-notice" role="note">
      <Info size={16} aria-hidden="true" />
      <span>{REGION_SCOPE_NOTICE}</span>
    </p>
  );
}

function RegionHeading({ region, page, subtitle, bulletinDate }) {
  return (
    <div className="page-heading">
      <div>
        <div className="region-eyebrow"><MapPin size={14} /> Région {region.name}</div>
        <h1>{page}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">
        {bulletinDate && <span className="snapshot-date"><span />Bulletin du {date(bulletinDate)}</span>}
      </div>
    </div>
  );
}

function LoadingOrError({ state }) {
  if (state.status === 'error') {
    return (
      <div className="error-state">
        <h2>Données régionales indisponibles</h2>
        <p>Les fichiers des régions ne sont pas disponibles. Réessayez dans quelques instants.</p>
        <button className="primary-button" onClick={state.retry}>Réessayer</button>
      </div>
    );
  }
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" />
      <p>Chargement de la région…</p>
    </div>
  );
}

// Honest view for a region other than the default: only what regions.json and the bulletin document.
export function RegionOverview({ state, regionId, onSelectRegion, navigate }) {
  if (state.status !== 'ready') return <LoadingOrError state={state} />;
  const { doc, bulletin } = state.value;
  const region = regionById(doc, regionId);
  const basin = regionBasin(bulletin, region);
  const source = doc.sources.find(s => s.id === bulletin.sourceId);
  const rows = neighbourFills(doc, bulletin, region);
  return (
    <div className="regions-page region-overview">
      <RegionHeading
        region={region}
        page="Vue d’ensemble"
        subtitle="Opérateur, bassin et dessalement documentés pour cette région. Chaque valeur indique sa date et sa source."
        bulletinDate={basin ? bulletin.date : null}
      />
      <ScopeNotice />
      <div className="regions-top region-overview-top">
        <OperatorCard region={region} doc={doc} />
        <div className="region-overview-stack">
          <BasinCard region={region} basin={basin} bulletin={bulletin} source={source} />
        </div>
      </div>
      <section className="regions-detail" aria-label="Dessalement et voisinage">
        <DesalCard region={region} doc={doc} />
        <article className="rcard">
          <h2 className="card-title">Régions voisines</h2>
          <p className="card-sub">Remplissage du bassin rattaché (indicatif) · bulletin du {date(bulletin.date)}</p>
          {rows.length ? (
            <ul className="neighbour-list">
              {rows.map(row => (
                <li key={row.region.id}>
                  <button type="button" className="row-select" onClick={() => onSelectRegion(row.region.id)}>{row.region.name}</button>
                  <span className="muted-cell">{row.region.operator.acronym}</span>
                  <span>{row.basin ? `${row.basin.name} · ${number(row.fillPct, 2)} % · ${number(row.storedMm3, 2)} Mm³` : NO_BASIN_LABEL}</span>
                </li>
              ))}
            </ul>
          ) : <p>Aucune région voisine n’est renseignée pour cette région.</p>}
          <button type="button" className="text-button" onClick={() => navigate('regions')}>Comparer les régions<ChevronRight size={14} /></button>
        </article>
      </section>
    </div>
  );
}

// Map page for a region other than the default: schematic region map only, no 3D facilities map.
export function RegionMapPage({ state, regionId, onSelectRegion }) {
  if (state.status !== 'ready') return <LoadingOrError state={state} />;
  const { doc, bulletin, geo } = state.value;
  const region = regionById(doc, regionId);
  return (
    <div className="regions-page region-overview">
      <RegionHeading
        region={region}
        page="Explorer la carte"
        subtitle="Carte schématique des régions, sans ouvrages ni tracé de réseau."
        bulletinDate={bulletin.date}
      />
      <ScopeNotice />
      <RegionMap doc={doc} bulletin={bulletin} geo={geo} regionId={region.id} onSelectRegion={onSelectRegion} />
    </div>
  );
}

export function OperatorCard({ region, doc }) {
  const op = region.operator;
  const sources = sourcesFor(doc, op.sourceIds);
  return (
    <article className="rcard operator-card">
      <div className="card-head">
        <div className="rg-logo-slot">
          <OperatorLogo region={region} size="md" />
          {!(region.icon || region.logo) && <span className="logo-note">{NO_LOGO_TEXT}</span>}
        </div>
        <div>
          <h2 className="card-title">{op.name}</h2>
          <p className="card-sub">{op.acronym} · {region.name}</p>
        </div>
      </div>
      <dl className="facts">
        <dt>Statut</dt>
        <dd><StatusBadge status={op.status} /></dd>
        <dt>Date</dt>
        <dd>{op.date}</dd>
        <dt>Niveau de preuve</dt>
        <dd>{op.evidence}</dd>
        <dt>Opérateurs précédents</dt>
        <dd>{op.previousOperators?.length ? op.previousOperators.join(' ; ') : 'Aucun renseigné'}</dd>
      </dl>
      {op.note && <p className="card-note">{op.note}</p>}
      <h3 className="card-subtitle">Sources</h3>
      {sources.length ? (
        <ul className="source-list">
          {sources.map(s => <li key={s.id}><SourceLink source={s} /></li>)}
        </ul>
      ) : <p className="muted-cell">Aucune source enregistrée.</p>}
    </article>
  );
}

export function BasinCard({ region, basin, bulletin, source }) {
  if (!basin) {
    return (
      <article className="rcard">
        <h2 className="card-title">Bassin rattaché</h2>
        <p>Pas de bassin de barrages dans le bulletin pour cette région.</p>
      </article>
    );
  }
  const delta = fillDelta(basin.fillPct, basin.sameDay2025Pct);
  return (
    <article className="rcard">
      <h2 className="card-title">Bassin {basin.name}</h2>
      <p className="card-sub">
        {region.basinMappingConfirmed ? 'Rattachement bassin ↔ région confirmé' : 'Rattachement bassin ↔ région indicatif'} · {region.name}
      </p>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Remplissage</span>
          <strong className="kpi-value">{number(basin.fillPct, 2)}<small> %</small></strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Stocké / capacité</span>
          <strong className="kpi-value">{number(basin.storedMm3, 2)}<small> / {number(basin.capacityMm3, 2)} Mm³</small></strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Même date en 2025</span>
          <strong className="kpi-value">{number(basin.sameDay2025Pct, 2)}<small> %</small></strong>
        </div>
        <div className="kpi">
          <span className="kpi-label">Écart sur 2025</span>
          <strong className="kpi-value">{signed(delta)}<small> pts</small></strong>
        </div>
      </div>
      <p className="source-line">
        Relevé du {date(bulletin.date)}{source && <> · <SourceLink source={source} /></>}
      </p>
    </article>
  );
}

export function DesalCard({ region, doc }) {
  const plants = region.desalination || [];
  return (
    <article className="rcard">
      <h2 className="card-title">Dessalement</h2>
      <p className="card-sub">Stations citées dans nos sources</p>
      {plants.length ? (
        <ul className="plant-list">
          {plants.map(p => (
            <li key={p.name}>
              <strong>{p.name}</strong>
              <span>{p.status} · depuis {date(p.since)}</span>
              <span>Capacité : {number(p.capacityM3PerDay, 0)} m³/j</span>
              {p.capacityNote && <span className="muted-cell">{p.capacityNote}</span>}
              <span className="source-line">
                {sourcesFor(doc, p.sourceIds).map(s => <SourceLink key={s.id} source={s} />)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Aucune station documentée dans nos sources pour cette région.</p>
      )}
    </article>
  );
}

export function SourceLink({ source }) {
  const when = source.date ? ` (${date(source.date)})` : '';
  if (!source.url) return <span>{source.title}{when} · lien non enregistré</span>;
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.title}{when}<ExternalLink size={12} aria-hidden="true" />
      <span className="visually-hidden"> (ouvre un nouvel onglet)</span>
    </a>
  );
}
