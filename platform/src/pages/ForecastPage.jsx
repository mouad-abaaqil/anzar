import { useCallback, useEffect, useMemo, useState } from 'react';
import RainPanel from '../components/RainPanel.jsx';
import {
  FORECAST_LABEL, PENDING_TEXT, RECONSTRUCTION_LABEL,
  bandPath, fillText, linePath, makeScales, mm3, niceTicks, parseDay, parseState, pct, signedNum,
  validateForecast, validateReconstruction, verdict, damValidation, BACKTEST_CAVEAT,
} from '../lib/forecast.js';
import { date, number } from '../lib/format.js';
import './forecast.css';

function useJson(url) {
  const [s, setS] = useState({ status: 'loading' });
  const load = useCallback(() => {
    setS({ status: 'loading' });
    fetch(url)
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(doc => setS({ status: 'done', doc }))
      .catch(() => setS({ status: 'error' }));
  }, [url]);
  useEffect(load, [load]);
  return [s, load];
}

const BOX = { w: 640, h: 260, l: 48, r: 12, t: 12, b: 28 };
const COLORS = { sec: 'var(--anzar-warn)', normal: 'var(--brand)', humide: 'var(--green)' };
const STROKE = { sec: '#8a6a10', normal: 'var(--brand)', humide: '#2f6f27' };

/** Plain-SVG time chart. layers: {points:[{date,volumeMm3,low,high}], name, fill, stroke, dash}. */
function TimeChart({ layers, capacity, pairs = [], checks = [], title, desc, unit = 'Mm³' }) {
  const pts = layers.map(l => ({ ...l, pts: (l.points || []).map(p => ({ ...p, x: parseDay(p.date) })) }));
  const xs = [...pts.flatMap(l => l.pts.map(p => p.x)), ...pairs.map(p => p.x), ...checks.map(p => p.x)];
  const ys = [...pts.flatMap(l => l.pts.flatMap(p => [p.volumeMm3, p.high])), ...pairs.map(p => p.y), ...checks.map(p => p.y), capacity ?? NaN];
  if (!xs.some(Number.isFinite)) return <p className="fc-muted">Aucun point à tracer.</p>;
  const sc = makeScales(xs, ys, BOX);
  const yt = niceTicks(sc.y0, sc.y1, 4);
  const xt = niceTicks(sc.x0, sc.x1, 4);
  return (
    <svg className="fc-chart" viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label={title} aria-describedby={desc}>
      {yt.map(v => (
        <g key={v}>
          <line x1={BOX.l} x2={BOX.w - BOX.r} y1={sc.sy(v)} y2={sc.sy(v)} className="ax-grid" />
          <text x={BOX.l - 6} y={sc.sy(v) + 4} textAnchor="end" className="ax-text">{number(v, 0)}</text>
        </g>
      ))}
      {xt.map(v => (
        <text key={v} x={sc.sx(v)} y={BOX.h - 8} textAnchor="middle" className="ax-text">
          {new Date(v).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
        </text>
      ))}
      <text x={4} y={10} className="ax-text">{unit}</text>
      {pts.map(l => <path key={`b${l.name}`} d={bandPath(l.pts, sc.sx, sc.sy)} fill={l.fill} fillOpacity="0.28" stroke="none" />)}
      {Number.isFinite(capacity) && (
        <g>
          <line x1={BOX.l} x2={BOX.w - BOX.r} y1={sc.sy(capacity)} y2={sc.sy(capacity)} className="ax-cap" />
          <text x={BOX.w - BOX.r} y={sc.sy(capacity) - 4} textAnchor="end" className="ax-text">capacité {number(capacity, 0)}</text>
        </g>
      )}
      {pts.map(l => <path key={`l${l.name}`} d={linePath(l.pts, sc.sx, sc.sy, 'volumeMm3')} fill="none" stroke={l.stroke} strokeWidth="2" strokeDasharray={l.dash} />)}
      {pairs.map((p, i) => (
        <circle key={`p${i}`} cx={sc.sx(p.x)} cy={sc.sy(p.y)} r="4" className="mk-pair"><title>{p.label}</title></circle>
      ))}
      {checks.map((p, i) => (
        <rect key={`c${i}`} x={sc.sx(p.x) - 4} y={sc.sy(p.y) - 4} width="8" height="8" transform={`rotate(45 ${sc.sx(p.x)} ${sc.sy(p.y)})`} className="mk-check"><title>{p.label}</title></rect>
      ))}
    </svg>
  );
}

function Legend({ items }) {
  return (
    <ul className="fc-legend" aria-label="Légende du graphique">
      {items.map(([cls, label]) => <li key={label}><span className={`sw ${cls}`} aria-hidden="true" />{label}</li>)}
    </ul>
  );
}

function Pending({ what }) {
  return (
    <section className="fc-card fc-pending" role="status">
      <h2>{PENDING_TEXT}</h2>
      <p>{what} Aucune valeur n’est affichée tant que le calcul n’est pas terminé : rien n’est simulé ni complété à la main.</p>
    </section>
  );
}

function LoadError({ onRetry, what }) {
  return (
    <section className="fc-card fc-alert" role="alert">
      <p>{what} est indisponible. Réessayez dans quelques instants.</p>
      <button type="button" className="secondary-button" onClick={onRetry}>Réessayer</button>
    </section>
  );
}

function Violations({ list }) {
  if (!list.length) return null;
  return (
    <div className="fc-alert" role="alert">
      <p>Données incohérentes : {list.length} point(s) où la bande basse–haute ne contient pas la valeur centrale. Ne pas s’y fier.</p>
      <ul>{list.slice(0, 5).map(v => <li key={v}>{v}</li>)}</ul>
    </div>
  );
}

function DamPanel({ doc }) {
  const dams = doc.dams.filter(d => d.estimated !== false);
  const [id, setId] = useState(dams[0]?.id);
  const dam = dams.find(d => d.id === id) || dams[0];
  if (!dam) return <p className="fc-muted">Aucun barrage estimé.</p>;
  const pairs = (dam.fit?.pairs || []).map(p => ({ x: parseDay(p.date), y: p.volumeMm3, label: `Calage officiel ${date(p.date)} : ${number(p.volumeMm3, 1)} Mm³` }));
  const checks = (doc.validation || []).filter(v => v.damId === dam.id && Number.isFinite(v.official))
    .map(v => ({ x: parseDay(v.date), y: v.official, label: `Validation ${date(v.date)} : officiel ${number(v.official, 1)} Mm³` }));
  const last = dam.series?.[dam.series.length - 1];
  const f = dam.fit || {};
  return (
    <div>
      <div className="fc-tabs" role="tablist" aria-label="Barrage">
        {dams.map(d => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === dam.id} className="fc-tab" onClick={() => setId(d.id)}>{d.name}</button>
        ))}
      </div>
      <p className="fc-label">{RECONSTRUCTION_LABEL}</p>
      {(() => {
        const rows = damValidation(doc.validation, dam);
        if (!rows.length) return <p className="fc-alert" role="note">Non validé à l’échelle du barrage : aucun point de contrôle indépendant disponible.</p>;
        const off = rows.filter(v => v.withinUncertainty === false);
        return (
          <div className="fc-alert" role="note">
            <p><strong>{off.length ? 'Non validé à l’échelle du barrage' : 'Contrôle indépendant dans l’incertitude'}</strong> : {rows.map(v => `${date(v.date)} officiel ${number(v.official, 1)} Mm³, estimé ${number(v.estimated, 1)} Mm³ (erreur ${signedNum(v.errorMm3)} Mm³, ${signedNum(v.errorPct)} %)`).join(' ; ')}.</p>
            {off.length > 0 && <p>La bande ci-dessous décrit l’ajustement du calage, pas l’erreur réelle de l’estimation.</p>}
          </div>
        );
      })()}
      <p className="fc-sub">
        {last ? <>Dernier point {date(last.date)} : {mm3(last.volumeMm3)} · remplissage {fillText(last.fillPct)}</> : 'Aucun point de série.'}
        {Number.isFinite(dam.capacityMm3) && <> · capacité {mm3(dam.capacityMm3)}{dam.capacitySource ? ` (${dam.capacitySource})` : ''}</>}
      </p>
      <TimeChart
        layers={[{ name: dam.id, points: dam.series, fill: 'var(--brand)', stroke: 'var(--brand)' }]}
        capacity={dam.capacityMm3} pairs={pairs} checks={checks}
        title={`Volume reconstitué, ${dam.name}, en millions de mètres cubes`}
      />
      <Legend items={[['sw-line', 'Volume estimé'], ['sw-band', 'Bande basse–haute'], ['sw-cap', 'Capacité'], ['sw-pair', 'Paires de calage officielles'], ['sw-check', 'Points de validation']]} />
      <details className="fc-details">
        <summary>Méthode et paramètres de calage</summary>
        <p>{doc.method}</p>
        <dl className="fc-facts">
          <dt>k</dt><dd>{Number.isFinite(f.k) ? number(f.k, 4) : '—'}</dd>
          <dt>b</dt><dd>{Number.isFinite(f.b) ? number(f.b, 3) : '—'}{Number.isFinite(f.bLow) && Number.isFinite(f.bHigh) ? ` (intervalle ${number(f.bLow, 3)} à ${number(f.bHigh, 3)})` : ''}</dd>
          <dt>Paires de calage</dt><dd>{f.nPairs ?? '—'}</dd>
          <dt>RMSE résiduelle</dt><dd>{mm3(f.residualRmseMm3, 2)}</dd>
          <dt>Polygone</dt><dd>{dam.polygon?.source || '—'}</dd>
        </dl>
      </details>
    </div>
  );
}

function RegionTotal({ doc }) {
  const total = doc.regionTotal || [];
  const last = total[total.length - 1];
  return (
    <section className="fc-card">
      <div className="fc-head"><h2>Total régional reconstitué</h2><span className="fc-chip chip-caution">estimation</span></div>
      <p className="fc-label">{RECONSTRUCTION_LABEL}</p>
      <TimeChart layers={[{ name: 'region', points: total, fill: 'var(--brand)', stroke: 'var(--brand)' }]} title="Volume total régional reconstitué, en millions de mètres cubes" />
      <Legend items={[['sw-line', 'Volume estimé'], ['sw-band', 'Bande basse–haute']]} />
      <p className="fc-sub">La bande haute est large près de la saturation : quand la surface d’eau mesurée atteint le maximum observé depuis 2017, elle ne distingue plus un demi-remplissage d’un remplissage complet, et le volume n’est borné que par la capacité.</p>
      {last && Number.isFinite(last.coveredShare) && (
        <p className="fc-sub">Part couverte au dernier point : {pct(last.coveredShare * 100, 0)} de la capacité. Le reste n’est pas estimé.</p>
      )}
      <h3 className="fc-h3">Barrages non estimés</h3>
      {(doc.notEstimated || []).length ? (
        <ul className="fc-list">{doc.notEstimated.map(n => <li key={n.id}><strong>{n.id}</strong> : {n.reason}</li>)}</ul>
      ) : <p className="fc-muted">Aucun barrage exclu n’est déclaré.</p>}
    </section>
  );
}

function ValidationTable({ rows }) {
  return (
    <section className="fc-card">
      <div className="fc-head"><h2>Validation hors calage</h2></div>
      <p className="fc-sub">Valeurs officielles comparées à l’estimation satellite. Ces points ne servent pas au calage. Une erreur régionale faible peut venir de la compensation d’erreurs de signes opposés entre barrages : lire les lignes par barrage avant de conclure.</p>
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead><tr>
            <th scope="col">Point</th><th scope="col">Date</th>
            <th scope="col" className="num">Officiel (Mm³)</th><th scope="col" className="num">Estimé (Mm³)</th>
            <th scope="col" className="num">Erreur (Mm³)</th><th scope="col" className="num">Erreur (%)</th>
            <th scope="col">Dans l’incertitude</th><th scope="col">Utilisé au calage</th>
          </tr></thead>
          <tbody>
            {rows.length ? rows.map((v, i) => (
              <tr key={`${v.name}${i}`}>
                <th scope="row">{v.name}{v.officialSource && <span className="fc-sub">{v.officialSource}</span>}</th>
                <td>{date(v.date)}</td>
                <td className="num">{number(v.official, 1)}</td>
                <td className="num">{number(v.estimated, 1)}</td>
                <td className="num">{signedNum(v.errorMm3)}</td>
                <td className="num">{signedNum(v.errorPct)} %</td>
                <td>{v.withinUncertainty === true ? 'oui' : v.withinUncertainty === false ? 'non' : '—'}</td>
                <td>{v.usedInCalibration ? 'oui' : 'non'}</td>
              </tr>
            )) : <tr><td colSpan={8} className="fc-muted">Aucun point de validation.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Backtest({ fc }) {
  const v = verdict(fc);
  const b = fc.backtest || {};
  return (
    <section className="fc-card">
      <div className="fc-head"><h2>Test rétrospectif</h2><span className="fc-chip chip-caution">{FORECAST_LABEL}</span></div>
      <p className={`fc-verdict tone-${v.tone}`} role="status">{v.text}</p>
      <p className="fc-sub">
        {b.scheme}{b.years?.length ? ` · années ${b.years.join(', ')}` : ''}
        {Number.isFinite(b.skillVsPersistence) && <> · gain vs persistance {number(b.skillVsPersistence, 2)}</>}
      </p>
      <div className="fc-table-wrap">
        <table className="fc-table">
          <thead><tr><th scope="col">Modèle</th><th scope="col" className="num">MAE (Mm³)</th><th scope="col" className="num">RMSE (Mm³)</th></tr></thead>
          <tbody>
            {(b.metrics || []).map(m => (
              <tr key={m.model}><th scope="row">{m.model}</th><td className="num">{number(m.maeMm3, 2)}</td><td className="num">{number(m.rmseMm3, 2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.note && <p className="fc-sub">{b.note}</p>}
      <p className="fc-sub">{BACKTEST_CAVEAT}</p>
    </section>
  );
}

function Scenarios({ fc }) {
  const scen = fc.scenarios || [];
  const layers = scen.map(s => ({ name: s.name, points: s.points, fill: COLORS[s.name] || 'var(--brand)', stroke: STROKE[s.name] || 'var(--brand)', dash: s.name === 'sec' ? '6 3' : s.name === 'humide' ? '2 3' : undefined }));
  return (
    <section className="fc-card">
      <div className="fc-head"><h2>Scénarios sur 30 jours</h2><span className="fc-chip chip-caution">{FORECAST_LABEL}</span></div>
      <TimeChart layers={layers} title="Trois scénarios de volume, sec, normal et humide, en millions de mètres cubes" />
      <ul className="fc-legend" aria-label="Scénarios">
        {scen.map(s => (
          <li key={s.name}><span className="sw" style={{ background: COLORS[s.name] || 'var(--brand)' }} aria-hidden="true" />{s.name}{s.tercile ? ` (tercile ${s.tercile})` : ''}</li>
        ))}
      </ul>
      {fc.scenarioBasis && <p className="fc-sub">Base des scénarios : {fc.scenarioBasis}.</p>}
      {fc.target && <p className="fc-sub">Cible : {fc.target}.</p>}
    </section>
  );
}

function Caveats({ list, title }) {
  if (!list?.length) return null;
  return (
    <section className="fc-card">
      <h2>{title}</h2>
      <ul className="fc-list">{list.map(c => <li key={c}>{c}</li>)}</ul>
    </section>
  );
}

export default function ForecastPage() {
  const [rec, reloadRec] = useJson('/data/storage-reconstruction.json');
  const [fc, reloadFc] = useJson('/data/fill-forecast.json');
  const recState = rec.status === 'done' ? parseState(rec.doc, 'reconstruction') : null;
  const fcState = fc.status === 'done' ? parseState(fc.doc, 'forecast') : null;
  const recViolations = useMemo(() => (recState?.state === 'ready' ? validateReconstruction(rec.doc) : []), [rec, recState]);
  const fcViolations = useMemo(() => (fcState?.state === 'ready' ? validateForecast(fc.doc) : []), [fc, fcState]);

  return (
    <div className="forecast-page">
      <div className="page-heading">
        <div>
          <h1>Prévision & satellite</h1>
          <p>Pluie modélisée, stock reconstitué depuis Sentinel-2 et prévision expérimentale. Ce ne sont ni des relevés officiels ni des mesures.</p>
        </div>
      </div>

      <RainPanel />

      <h2 className="fc-section">Stock reconstitué par satellite</h2>
      {rec.status === 'loading' && <p className="fc-muted" role="status">Chargement…</p>}
      {rec.status === 'error' && <LoadError what="Le fichier de reconstitution" onRetry={reloadRec} />}
      {recState?.state === 'pending' && <Pending what="Le calcul du stock des barrages à partir des images Sentinel-2 n’est pas terminé." />}
      {recState?.state === 'invalid' && <LoadError what="Le fichier de reconstitution (format inattendu)" onRetry={reloadRec} />}
      {recState?.state === 'ready' && (
        <>
          <section className="fc-card">
            <div className="fc-head"><h2>Volume par barrage</h2><span className="fc-chip chip-caution">estimation</span></div>
            <Violations list={recViolations} />
            <DamPanel doc={rec.doc} />
          </section>
          <RegionTotal doc={rec.doc} />
          <ValidationTable rows={rec.doc.validation || []} />
          <Caveats list={rec.doc.caveats} title="Limites de la reconstitution" />
        </>
      )}

      <h2 className="fc-section">Prévision expérimentale</h2>
      {fc.status === 'loading' && <p className="fc-muted" role="status">Chargement…</p>}
      {fc.status === 'error' && <LoadError what="Le fichier de prévision" onRetry={reloadFc} />}
      {fcState?.state === 'pending' && <Pending what="La prévision du stock et son test rétrospectif ne sont pas calculés." />}
      {fcState?.state === 'invalid' && <LoadError what="Le fichier de prévision (format inattendu)" onRetry={reloadFc} />}
      {fcState?.state === 'ready' && (
        <>
          <Backtest fc={fc.doc} />
          <Violations list={fcViolations} />
          <Scenarios fc={fc.doc} />
          <Caveats list={fc.doc.caveats} title="Limites de la prévision" />
        </>
      )}
      <p className="fc-source">Prototype indépendant · pas un portail officiel de la SRM-SM.</p>
    </div>
  );
}
