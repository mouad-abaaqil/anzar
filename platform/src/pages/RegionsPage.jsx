import { Database } from 'lucide-react';
import { BasinCard, DesalCard, OperatorCard, SourceLink } from '../components/RegionOverview.jsx';
import RegionMap from '../components/RegionMap.jsx';
import { date, number } from '../lib/format.js';
import {
  DEFAULT_REGION_ID,
  NO_BASIN_LABEL,
  collaborationRows,
  fillDelta,
  regionBasin,
  regionById,
  signed,
  transferLabel,
} from '../lib/regions.js';
import './regions.css';

const COLLAB_NOTE = 'Proposition d’analyse, pas un fait : une région voisine mieux remplie n’est pas reliée physiquement à la vôtre sauf lien documenté. Aucune conduite ni volume transférable n’est supposé.';

export default function RegionsPage({ state, regionId, onSelectRegion }) {
  if (state.status === 'error') {
    return (
      <div className="error-state">
        <Database size={36} />
        <h2>Données régionales indisponibles</h2>
        <p>Les fichiers des régions ne sont pas disponibles. Réessayez dans quelques instants.</p>
        <button className="primary-button" onClick={state.retry}>Réessayer</button>
      </div>
    );
  }
  if (state.status !== 'ready') {
    return (
      <div className="loading-state" role="status">
        <span className="loading-spinner" />
        <p>Chargement des régions…</p>
      </div>
    );
  }
  return <RegionsContent {...state.value} regionId={regionId} onSelectRegion={onSelectRegion} />;
}

function RegionsContent({ doc, bulletin, geo, regionId, onSelectRegion }) {
  const region = regionById(doc, regionId) || regionById(doc, DEFAULT_REGION_ID);
  const basin = regionBasin(bulletin, region);
  const rows = collaborationRows(doc, bulletin, region);
  const bulletinSource = doc.sources.find(s => s.id === bulletin.sourceId);
  const ranking = [...bulletin.basins].sort((a, b) => b.fillPct - a.fillPct);

  return (
    <div className="regions-page">
      <div className="page-heading">
        <div>
          <h1>Régions & collaboration</h1>
          <p>Opérateur, bassin et voisinage de chaque région. Chaque valeur indique sa date et sa source.</p>
        </div>
      </div>

      <div className="regions-top">
        <RegionMap doc={doc} bulletin={bulletin} geo={geo} regionId={region.id} onSelectRegion={onSelectRegion} />

        <OperatorCard region={region} doc={doc} />
      </div>

      <section className="regions-detail" aria-label="Bassin et dessalement de la région sélectionnée">
        <BasinCard region={region} basin={basin} bulletin={bulletin} source={bulletinSource} />
        <DesalCard region={region} doc={doc} />
      </section>

      <section className="rsection">
        <div className="section-heading">
          <div>
            <h2>Remplissage par région</h2>
            <p>Bassin principal rattaché (indicatif) · bulletin du {date(bulletin.date)} · Mm³ : millions de mètres cubes</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="dense-table">
            <thead>
              <tr>
                <th scope="col">Région</th>
                <th scope="col">Opérateur</th>
                <th scope="col">Bassin rattaché</th>
                <th scope="col" className="num">Remplissage</th>
                <th scope="col" className="num">Volume stocké</th>
              </tr>
            </thead>
            <tbody>
              {doc.regions.map(r => {
                const b = regionBasin(bulletin, r);
                return (
                  <tr key={r.id} aria-current={r.id === region.id ? 'true' : undefined}>
                    <th scope="row">
                      <button type="button" className="row-select" onClick={() => onSelectRegion(r.id)}>{r.name}</button>
                    </th>
                    <td>{r.operator.acronym}</td>
                    <td>{b ? b.name : <span className="muted-cell">{NO_BASIN_LABEL}</span>}</td>
                    <td className="num">{b ? `${number(b.fillPct, 2)} %` : '—'}</td>
                    <td className="num">{b ? `${number(b.storedMm3, 2)} Mm³` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rsection">
        <div className="section-heading">
          <div>
            <h2>Collaboration potentielle</h2>
            <p>Régions voisines de {region.name} (contiguïté géographique, sans lien hydraulique supposé)</p>
          </div>
        </div>
        <p className="collab-note">{COLLAB_NOTE}</p>
        <div className="table-wrap">
          <table className="dense-table collab-table">
            <thead>
              <tr>
                <th scope="col" className="num">Rang</th>
                <th scope="col">Opérateur voisin</th>
                <th scope="col">Bassin</th>
                <th scope="col" className="num">Remplissage</th>
                <th scope="col" className="num">Volume stocké</th>
                <th scope="col" className="num">Écart vs {region.operator.acronym}</th>
                <th scope="col">Lien documenté</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row, i) => (
                <tr key={row.region.id}>
                  <td className="num">{row.fillPct === null ? '—' : i + 1}</td>
                  <th scope="row">
                    <span className="op-acronym">{row.region.operator.acronym}</span>
                    <span className="op-region">{row.region.name}</span>
                  </th>
                  <td>{row.basin ? row.basin.name : <span className="muted-cell">{NO_BASIN_LABEL}</span>}</td>
                  <td className="num">{row.fillPct === null ? '—' : `${number(row.fillPct, 2)} %`}</td>
                  <td className="num">{row.storedMm3 === null ? '—' : `${number(row.storedMm3, 2)} Mm³`}</td>
                  <td className="num">{row.deltaPts === null ? '—' : `${signed(row.deltaPts)} pts`}</td>
                  <td>{row.transfer ? `Oui — ${transferLabel(row.transfer)}` : '— aucun lien documenté'}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="empty-cell">Aucune région voisine n’est renseignée pour cette région.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rsection">
        <div className="section-heading">
          <div>
            <h2>Classement des bassins</h2>
            <p>Bulletin du {date(bulletin.date)} · {bulletinSource?.title ?? 'Bulletin public'}</p>
          </div>
        </div>
        <p className="national-line">
          National : <strong>{number(bulletin.national.fillPct, 2)} %</strong> · {number(bulletin.national.storedMm3, 2)} Mm³ stockés sur {number(bulletin.national.capacityMm3, 2)} Mm³ · même date 2025 : {number(bulletin.national.sameDay2025Pct, 2)} %
        </p>
        <div className="table-wrap">
          <table className="dense-table">
            <thead>
              <tr>
                <th scope="col" className="num">Rang</th>
                <th scope="col">Bassin</th>
                <th scope="col" className="num">Remplissage</th>
                <th scope="col" className="num">Stocké</th>
                <th scope="col" className="num">Capacité</th>
                <th scope="col" className="num">Même date 2025</th>
                <th scope="col" className="num">Écart (pts)</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((b, i) => (
                <tr key={b.name}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">{b.name}</th>
                  <td className="num">{number(b.fillPct, 2)} %</td>
                  <td className="num">{number(b.storedMm3, 2)} Mm³</td>
                  <td className="num">{number(b.capacityMm3, 2)} Mm³</td>
                  <td className="num">{number(b.sameDay2025Pct, 2)} %</td>
                  <td className="num">{signed(fillDelta(b.fillPct, b.sameDay2025Pct))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="source-line">
          {bulletin.note}{' '}
          {bulletinSource && <SourceLink source={bulletinSource} />}
        </p>
      </section>
    </div>
  );
}
