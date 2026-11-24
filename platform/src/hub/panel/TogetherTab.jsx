import { useMemo } from 'react';
import { Legend, MicroLabel, Panel, ProvenanceChip } from '../../design';
import { BANDS, FLUX_GLYPH } from '../../design/bands.js';
import { FLUX_LABELS } from '../../lib/balance.js';
import { Stat } from '../../design';
import { NO_LINK_MESSAGE, fluxStepOf, fmt, leversFor, linksFor, pctText, projectsFor, rankingFor, regionBalance, regionName, signed, splitLinks } from './metrics.js';
import { plannedDesalNote } from './extraLogic.js';

const STATUS_GLYPH = { 'en service': '●', 'en construction': '◐', 'planifié': '○' };

function Rank({ data, ranking, regionId, onSelectRegion }) {
  const withStock = ranking.filter(r => !r.noStock);
  const noStock = ranking.filter(r => r.noStock);
  const max = Math.max(1, ...withStock.map(r => r.monthsOfCoverage || 0));
  const row = (r, flux) => {
    const w = flux ? Math.min(100, r.flux?.coveragePct ?? 0) : Math.min(100, ((r.monthsOfCoverage || 0) / max) * 100);
    const b = flux ? null : BANDS[r.band];
    return (
      <li key={r.id}>
        <button type="button" className="pn-rank__btn" aria-current={r.id === regionId ? 'true' : undefined} onClick={() => onSelectRegion?.(r.id)}>
          <span className="pn-rank__name">{regionName(data, r.id)}</span>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="pn-bar pn-bar--thin" aria-hidden="true">
            <rect width="100" height="8" className="pn-bar__bg" />
            <rect width={w} height="8" className={flux ? 'pn-bar__flux pn-flux--' + (fluxStepOf(r.flux?.ratio) ?? 0) : 'pn-bar__band pn-band--' + (r.band ?? 'na')} />
          </svg>
          <span className="pn-rank__val">
            {flux ? FLUX_GLYPH + ' ' + (r.flux?.coveragePct != null ? pctText(r.flux.coveragePct) + ' %' : '—') : (b ? b.glyph + ' ' : '') + (r.monthsOfCoverage != null ? fmt(r.monthsOfCoverage, 0) + ' mois' : '—')}
          </span>
          {!flux && r.depletionYear != null && <span className="pn-rank__tag pn-warn">épuisé {r.depletionYear}</span>}
          {flux && r.flux?.band && <span className="pn-rank__tag pn-faint">{FLUX_LABELS[r.flux.band]}</span>}
        </button>
      </li>
    );
  };
  return (
    <>
      <ol className="pn-rank" aria-label="Régions à barrages, par mois de réserve">{withStock.map(r => row(r, false))}</ol>
      {noStock.length > 0 && (
        <div className="pn-sahara">
          <MicroLabel tone="accent">Sahara · sans barrage suivi</MicroLabel>
          <p className="pn-note">Indicateur de flux (dessalement ÷ potable), pas des mois de réserve. Nappes non modélisées.</p>
          <ol className="pn-rank" aria-label="Régions sans barrage, part du potable dessalé">{noStock.map(r => row(r, true))}</ol>
          <Legend kind="flux" />
        </div>
      )}
    </>
  );
}

function LinkList({ items }) {
  return (
    <ul className="pn-links">
      {items.map(l => (
        <li key={l.id}>
          <span className="pn-link__status" data-status={l.status}><span aria-hidden="true">{STATUS_GLYPH[l.status] ?? '○'}</span> {l.status}{l.verified === false ? ' · non vérifié' : ''}</span>
          <span className="pn-link__name">{(l.from?.name ?? '?') + ' → ' + (l.to?.name ?? '?')}</span>
          {l.sourceUrl && <a className="pn-link__src" href={l.sourceUrl} target="_blank" rel="noreferrer noopener">source{l.readDate ? ' · lue le ' + l.readDate : ''}</a>}
        </li>
      ))}
    </ul>
  );
}

export default function TogetherTab({ data, regionId, model, scenario, onSelectRegion }) {
  const ranking = useMemo(() => rankingFor(data, scenario), [data, scenario]);
  const levers = useMemo(() => leversFor(data, regionId, scenario), [data, regionId, scenario]);
  const { physical, projects: linkProjects } = useMemo(() => splitLinks(linksFor(data, regionId)), [data, regionId]);
  const links = physical;
  const projects = useMemo(() => {
    const seen = new Set(linksFor(data, regionId).map(l => l.sourceUrl).filter(Boolean));
    return projectsFor(data, regionId).filter(p => !p.source || !seen.has(p.source));
  }, [data, regionId]);
  if (!model) return <p className="az-text">Données indisponibles pour cette région. Rien n’est estimé à leur place.</p>;
  const noStock = model.noStock;
  const maxLever = Math.max(0.1, ...levers.map(l => Math.abs(l.deltaMonths)));
  const flux = model.fluxNow;
  const best = levers[0];

  return (
    <div className="pn-stack">
      <section className="pn-hero" aria-label="Ce qui compte le plus">
        {noStock ? (
          <>
            <MicroLabel>Dessalement et nappes · indicateur de flux</MicroLabel>
            <Stat size="lg" value={pctText(flux?.nonDesalShare != null ? flux.nonDesalShare * 100 : null)} unit="%" label="du potable repose sur les nappes, non modélisées"
              provenance={{ status: 'hypothese', source: 'Part non couverte par le dessalement', note: 'Supposée servie par des nappes et d’autres sources : aucun volume ni état de nappe.' }} />
            {plannedDesalNote(regionBalance(data, regionId)) && <p className="pn-note">{plannedDesalNote(regionBalance(data, regionId))}</p>}
          </>
        ) : (
          <>
            <MicroLabel>{'Premier levier · ' + regionName(data, regionId)}</MicroLabel>
            <Stat size="lg" value={best ? signed(best.deltaMonths, 1) : '—'} unit="mois de réserve" label={best ? best.label : 'Leviers non calculables'}
              provenance={{ status: 'hypothese', source: 'levers() de balance.js', note: 'Effet de sensibilité, hypothèse de calcul. Pas un projet, aucun volume déplacé entre régions.' }} />
          </>
        )}
      </section>

      <Panel label="Ce qui peut aider" title={(noStock ? 'Dessalement et nappes · ' : 'Leviers · ') + regionName(data, regionId)} actions={<ProvenanceChip status="hypothese" source="levers() de balance.js" note="Effet de sensibilité sur les mois de réserve, hypothèses de calcul. Pas des projets, aucun volume déplacé entre régions." />}>
        {noStock ? (
          flux ? (
            <ul className="pn-facts">
              <li><span>Dessalement potable estimé</span><strong>{fmt(flux.producedMm3, flux.producedMm3 < 1 ? 2 : 1)} Mm³/an</strong></li>
              <li><span>Demande potable estimée</span><strong>{fmt(flux.potableDemandMm3, 1)} Mm³/an</strong></li>
              {flux.afterBuilding && flux.afterBuilding.high != null && <li><span>Après chantiers en cours, si achevés</span><strong>{Math.round(Math.min(1, flux.afterBuilding.low ?? flux.afterBuilding.high) * 100)}{Math.round(Math.min(1, flux.afterBuilding.low ?? 0) * 100) !== Math.round(Math.min(1, flux.afterBuilding.high) * 100) ? ' à ' + Math.round(Math.min(1, flux.afterBuilding.high) * 100) : ''} %</strong></li>}
            </ul>
          ) : <p className="pn-note">Indicateur de flux non calculable.</p>
        ) : levers.length ? (
          <ul className="pn-levers">
            {levers.map(l => (
              <li key={l.id}>
                <span className="pn-lever__n">{l.label}</span>
                <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="pn-bar pn-bar--thin" aria-hidden="true">
                  <rect width="100" height="8" className="pn-bar__bg" />
                  <rect width={Math.max(1, (Math.abs(l.deltaMonths) / maxLever) * 100)} height="8" className="pn-bar__fill" />
                </svg>
                <strong>{signed(l.deltaMonths, 1)} mois</strong>
              </li>
            ))}
          </ul>
        ) : <p className="pn-note">Leviers non calculables.</p>}
      </Panel>

      <Panel label="Comparer" title="Les régions" actions={<ProvenanceChip status="derived" source="rankingOutlook() de balance.js" note="Classement indicatif, pas un plan d’approvisionnement. Aucun volume n’est transféré d’une région à l’autre." />}>
        <Rank data={data} ranking={ranking} regionId={regionId} onSelectRegion={onSelectRegion} />
        <Legend kind="bands" />
      </Panel>

      <Panel label="Liaisons documentées" title="Reliée à quoi ?" actions={<ProvenanceChip status="sourced" source="water-links.json" note="Liaison schématique, pas le tracé réel. Aucun volume transférable n’est affiché : les capacités publiées par chaque source restent dans la source." />}>
        {links.length === 0 && <p className="pn-note" role="note">{NO_LINK_MESSAGE}</p>}
        {links.length > 0 && <LinkList items={links} />}
        {linkProjects.length > 0 && (
          <>
            <MicroLabel tone="faint">Projets associés, pas des liaisons</MicroLabel>
            <LinkList items={linkProjects} />
          </>
        )}
        {links.length > 0 && <p className="pn-note pn-faint">Liaison schématique, pas le tracé réel.</p>}
      </Panel>

      {projects.length > 0 && (
        <Panel label="Projets sourcés" title="En préparation">
          <ul className="pn-links">
            {projects.map(p => (
              <li key={p.id}>
                <span className="pn-link__status" data-status={p.status}><span aria-hidden="true">{STATUS_GLYPH[p.status] ?? '○'}</span> {p.status}{p.year ? ' · ' + p.year : ''}</span>
                <span className="pn-link__name">{p.label}</span>
                {p.source && <a className="pn-link__src" href={p.source} target="_blank" rel="noreferrer noopener">source{p.date ? ' · ' + p.date : ''}</a>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
