import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import * as B from '../lib/balance.js';
import AnzarMap from '../components/AnzarMap.jsx';
import { number } from '../lib/format.js';
import './balance.css';

/* ---------- données ---------- */
function useJson(url) {
  const [s, setS] = useState({ status: 'loading' });
  const load = useCallback(() => {
    setS({ status: 'loading' });
    fetch(url)
      .then(r => { if (!r.ok) throw Error(String(r.status)); return r.json(); })
      .then(doc => setS({ status: 'done', doc }))
      .catch(() => setS({ status: 'error' }));
  }, [url]);
  useEffect(load, [load]);
  return [s, load];
}

/** Appelle une fonction de balance.js sans jamais faire tomber la page. */
const safe = (fn, ...args) => {
  try { return typeof fn === 'function' ? fn(...args) : undefined; } catch { return undefined; }
};

const HYDRO = [
  { id: 'dry', label: 'Sec' },
  { id: 'normal', label: 'Normal' },
  { id: 'wet', label: 'Humide' },
];
const HYDRO_LABEL = { dry: 'sec', normal: 'normal', wet: 'humide' };
const BAND_LABEL = { critique: 'Critique', tendu: 'Tendu', confortable: 'Confortable' };
const START_YEAR = 2026;
const STATUS = {
  sourced: { label: 'sourcé', glyph: '●', help: 'Valeur issue d’une source citée et datée' },
  derived: { label: 'dérivé', glyph: '◐', help: 'Valeur calculée à partir de données sourcées' },
  hypothese: { label: 'hypothèse', glyph: '○', help: 'Hypothèse de travail, non mesurée' },
};

const fmt = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? number(v, d) : '—');
const valOf = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

/* ---------- petits composants ---------- */
function Pill({ status = 'hypothese', source }) {
  const s = STATUS[status] || STATUS.hypothese;
  const tip = s.help + (source ? ' — ' + source : '');
  return (
    <span className="bal-pill" data-status={status} title={tip} role="note" aria-label={'Statut : ' + s.label + '. ' + tip}>
      <span aria-hidden="true">{s.glyph}</span> {s.label}
    </span>
  );
}

function Stat({ label, value, unit, status, source }) {
  return (
    <div className="bal-stat">
      <div className="bal-stat-label">{label}</div>
      <div className="bal-stat-value">{value}{unit && <span className="bal-unit"> {unit}</span>}</div>
      {status && <Pill status={status} source={source} />}
    </div>
  );
}

function Slider({ id, label, value, min, max, step, unit, onChange, status = 'hypothese', hint }) {
  return (
    <div className="bal-slider">
      <div className="bal-slider-head">
        <label htmlFor={id}>{label}</label>
        <Pill status={status} />
        <output htmlFor={id}>{fmt(value, step < 1 ? 1 : 0)} {unit}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
      {hint && <p className="bal-hint">{hint}</p>}
    </div>
  );
}

function BandTag({ band, today }) {
  if (!band) return null;
  return <span className="bal-band" data-band={band}><i aria-hidden="true" />{(BAND_LABEL[band] || band) + (today ? ' aujourd’hui' : '')}</span>;
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="bal-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- demande par secteur ---------- */
function DemandBars({ demand }) {
  if (!demand) return <p className="bal-muted">Demande non calculable avec les données actuelles.</p>;
  const rows = [
    ['Domestique', demand.domesticMm3, 'var(--brand)'],
    ['Agriculture', demand.agricultureMm3, 'var(--anzar-ok)'],
    ['Industrie', demand.industryMm3, 'var(--anzar-warn)'],
  ];
  const max = Math.max(1, ...rows.map(r => r[1] || 0));
  return (
    <figure className="bal-bars">
      <figcaption>Demande annuelle estimée, Mm³/an <Pill status="derived" /></figcaption>
      {rows.map(([name, v, col]) => (
        <div className="bal-bar-row" key={name}>
          <span className="bal-bar-name">{name}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="bal-bar-svg" aria-hidden="true">
            <rect x="0" y="0" width="100" height="10" className="bal-bar-bg" />
            <rect x="0" y="0" width={Math.max(0.6, ((v || 0) / max) * 100)} height="10" fill={col} />
          </svg>
          <span className="bal-bar-val">{fmt(v, 0)}</span>
        </div>
      ))}
      <div className="bal-total">Total : <strong>{fmt(demand.totalMm3, 0)} Mm³/an</strong>{typeof demand.potableMm3 === 'number' && <> · dont potable {fmt(demand.potableMm3, 0)}</>}</div>
    </figure>
  );
}

function StockBar({ stock }) {
  if (!stock) return null;
  const pct = Math.max(0, Math.min(100, stock.fillPct ?? (stock.storedMm3 / stock.capacityMm3) * 100));
  return (
    <figure className="bal-stock">
      <figcaption>Stock de surface alloué vs capacité <Pill status="derived" source="part de bassin indicative" /></figcaption>
      <div className="bal-stock-track" role="img" aria-label={'Rempli à ' + fmt(pct, 0) + ' %'}>
        <div className="bal-stock-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="bal-stock-legend"><span>{fmt(stock.storedMm3, 0)} Mm³</span><span>{fmt(pct, 0)} %</span><span>capacité {fmt(stock.capacityMm3, 0)} Mm³</span></div>
    </figure>
  );
}

/* ---------- région sans stock de surface : indicateur de flux ---------- */
function FluxCard({ flux, rb, year }) {
  if (!flux || flux.ratio == null) return <p className="bal-muted">Indicateur de flux non calculable : demande potable inconnue.</p>;
  const ctx = rb?.fluxContext;
  const range = flux.afterBuilding;
  const pctOf = x => Math.round(Math.min(1, x) * 100);
  return (
    <div className="bal-flux">
      <div className="bal-cover">
        <div className="bal-cover-num" aria-live="polite">{fmt(flux.coveragePct, 0)}<span>&nbsp;%</span></div>
        <div>
          <span className="bal-band" data-band={flux.band}><i aria-hidden="true" />{B.FLUX_LABELS[flux.band]}</span>
          <div className="bal-cover-sub">du potable estimé couvert par le dessalement en {year} <Pill status="hypothese" source="capacité potable × utilisation 80 % ÷ demande potable estimée, borné à 100 %" /></div>
          <div className="bal-cover-sub">Indicateur de flux, différent des mois de couverture des régions à barrages : aucun stock.</div>
        </div>
      </div>
      <ul className="bal-flux-list">
        <li><span>Dépendance aux nappes non modélisées</span><strong>{fmt(flux.nonDesalShare * 100, 0)} % du potable</strong><Pill status="hypothese" source="part non couverte par le dessalement, supposée servie par des nappes et d’autres sources ; aucun volume de nappe" /></li>
        <li><span>Dessalement potable (capacité × 80 %)</span><strong>{fmt(flux.producedMm3, flux.producedMm3 < 1 ? 2 : 1)} Mm³/an</strong><Pill status="derived" /></li>
        <li><span>Demande potable estimée</span><strong>{fmt(flux.potableDemandMm3, 1)} Mm³/an</strong><Pill status="derived" /></li>
        {flux.documentedDesalShare != null && <li><span>Repère documenté (ville de Laâyoune, 2022) : part dessalée de la production potable installée</span><strong>≈ {fmt(flux.documentedDesalShare * 100, 0)} %</strong><Pill status={rb.fluxContext.desalShareOfCityPotable.status} source={rb.fluxContext.desalShareOfCityPotable.source} /></li>}
        {range && <li><span>Après les chantiers en cours (si achevés, à 80 % d’utilisation ; fourchette de la part potable, sources divergentes)</span><strong>{range.low != null && range.high != null && pctOf(range.low) !== pctOf(range.high) ? pctOf(range.low) + ' à ' + pctOf(range.high) : pctOf(range.high ?? range.low)} %</strong><Pill status="hypothese" /></li>}
      </ul>
      {ctx?.surfaceWorks?.map(w => (
        <p className="bal-muted" key={w.label}><strong>{w.label}</strong> : {fmt(w.capacityMm3, 0)} Mm³ de capacité, {w.progress}. Non compté dans le stock : {w.note} <a href={w.source} target="_blank" rel="noreferrer noopener">source · {w.date}</a></p>
      ))}
      {ctx?.groundwaterContext && <p className="bal-muted">{ctx.groundwaterContext.text}</p>}
      {ctx?.plant && <p className="bal-muted">{ctx.plant.text} <a href={ctx.plant.source} target="_blank" rel="noreferrer noopener">source · {ctx.plant.date}</a></p>}
    </div>
  );
}

/* ---------- courbe de simulation ---------- */
const CH = { w: 640, h: 260, l: 46, r: 14, t: 14, b: 28 };
function SimChart({ series, selected, capacity }) {
  const depletedAt = (series[selected] || []).find(p => p.depleted);
  const all = HYDRO.flatMap(h => series[h.id] || []);
  if (!all.length) return <p className="bal-muted">Pas de simulation disponible.</p>;
  const years = all.map(p => p.year);
  const x0 = Math.min(...years), x1 = Math.max(...years);
  const yMax = Math.max(capacity || 0, ...all.map(p => p.storedMm3 || 0), 1) * 1.05;
  const sx = y => CH.l + ((y - x0) / Math.max(1, x1 - x0)) * (CH.w - CH.l - CH.r);
  const sy = v => CH.h - CH.b - (v / yMax) * (CH.h - CH.t - CH.b);
  const line = s => s.map((p, i) => (i ? 'L' : 'M') + sx(p.year).toFixed(1) + ' ' + sy(p.storedMm3).toFixed(1)).join(' ');
  const dry = series.dry || [], wet = series.wet || [];
  const bandD = dry.length && wet.length && dry.length === wet.length
    ? wet.map((p, i) => (i ? 'L' : 'M') + sx(p.year).toFixed(1) + ' ' + sy(p.storedMm3).toFixed(1)).join(' ') + ' ' +
      [...dry].reverse().map(p => 'L' + sx(p.year).toFixed(1) + ' ' + sy(p.storedMm3).toFixed(1)).join(' ') + ' Z'
    : null;
  const ticks = [0, 0.5, 1].map(f => f * yMax / 1.05);
  const cur = series[selected] || [];
  const stroke = { dry: '#9a6b00', normal: 'var(--brand)', wet: 'var(--anzar-ok)' };
  return (
    <svg className="bal-chart" viewBox={'0 0 ' + CH.w + ' ' + CH.h} role="img"
      aria-label={'Stock de surface simulé sur 10 ans, trois hypothèses de pluie. Scénario affiché : ' + HYDRO_LABEL[selected]}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={CH.l} x2={CH.w - CH.r} y1={sy(v)} y2={sy(v)} className="ax-grid" />
          <text x={CH.l - 6} y={sy(v) + 4} textAnchor="end" className="ax-text">{number(v, 0)}</text>
        </g>
      ))}
      {[x0, Math.round((x0 + x1) / 2), x1].map(y => <text key={y} x={sx(y)} y={CH.h - 8} textAnchor="middle" className="ax-text">{y}</text>)}
      <text x={4} y={10} className="ax-text">Mm³</text>
      {Number.isFinite(capacity) && <g><line x1={CH.l} x2={CH.w - CH.r} y1={sy(capacity)} y2={sy(capacity)} className="ax-cap" /><text x={CH.w - CH.r} y={sy(capacity) - 4} textAnchor="end" className="ax-text">capacité</text></g>}
      {bandD && <path d={bandD} className="bal-band-area" />}
      {HYDRO.map(h => (series[h.id] || []).length > 0 && (
        <path key={h.id} d={line(series[h.id])} fill="none" stroke={stroke[h.id]} strokeWidth={h.id === selected ? 2.6 : 1.4}
          strokeDasharray={h.id === 'dry' ? '5 4' : h.id === 'wet' ? '2 3' : undefined} opacity={h.id === selected ? 1 : 0.7} />
      ))}
      {depletedAt && <g><line x1={sx(depletedAt.year)} x2={sx(depletedAt.year)} y1={CH.t} y2={CH.h - CH.b} className="ax-cap" /><text x={Math.min(sx(depletedAt.year) + 4, CH.w - CH.r - 200)} y={CH.t + 12} className="ax-text bal-depleted">{'Stock épuisé dès ' + depletedAt.year}</text></g>}
      {cur.map(p => <circle key={p.year} cx={sx(p.year)} cy={sy(p.storedMm3)} r="3" fill={stroke[selected]}><title>{p.year} : {fmt(p.storedMm3, 0)} Mm³, {fmt(p.monthsOfCoverage, 1)} mois</title></circle>)}
    </svg>
  );
}

/* ---------- signal climatique (informatif, ne touche pas au simulateur) ---------- */
function ClimateSignal({ state, basinName, others, regionName }) {
  const doc = state.status === 'done' ? state.doc : null;
  const s = basinName && doc?.basins?.[basinName]?.summary;
  const ok = s && [s.medianPct, s.minPct, s.maxPct].every(Number.isFinite);
  const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1) + ' %';
  let body;
  if (state.status === 'loading') body = <p className="bal-muted">Chargement du signal climatique…</p>;
  else if (!doc) body = <p className="bal-muted">Signal climatique indisponible : le fichier <code>climate-outlook.json</code> n’a pas pu être lu. Rien n’est estimé à sa place.</p>;
  else if (!basinName) body = <p className="bal-muted">Aucun bassin du fichier n’est rattaché à {regionName} : pas de signal climatique affiché.</p>;
  else if (!ok) body = <p className="bal-muted">Pas de projection exploitable pour le bassin {basinName}.</p>;
  else {
    const lo = Math.min(s.minPct, 0), hi = Math.max(s.maxPct, 0);
    const W = 320, pad = 30, span = Math.max(1, hi - lo);
    const x = v => pad + ((v - lo) / span) * (W - 2 * pad);
    body = (
      <>
        <div className="bal-clim-main">
          <div className="bal-clim-num">{sign(s.medianPct)}</div>
          <div className="bal-clim-sub">médiane des précipitations annuelles, bassin {basinName}, 2026-2050 vs 1991-2020</div>
        </div>
        <svg className="bal-clim-svg" viewBox={'0 -6 ' + W + ' 54'} role="img"
          aria-label={'Fourchette entre modèles : de ' + sign(s.minPct) + ' à ' + sign(s.maxPct) + ', médiane ' + sign(s.medianPct)}>
          <line x1={x(0)} x2={x(0)} y1="4" y2="30" className="ax-cap" />
          <line x1={x(s.minPct)} x2={x(s.maxPct)} y1="17" y2="17" className="bal-clim-range" />
          <line x1={x(s.minPct)} x2={x(s.minPct)} y1="10" y2="24" className="bal-clim-range" />
          <line x1={x(s.maxPct)} x2={x(s.maxPct)} y1="10" y2="24" className="bal-clim-range" />
          <circle cx={x(s.medianPct)} cy="17" r="5" className="bal-clim-med" />
          <text x={x(s.minPct)} y="42" textAnchor="middle" className="ax-text">{sign(s.minPct)}</text>
          <text x={x(s.medianPct)} y="6" textAnchor="middle" className="ax-text">médiane</text>
          <text x={x(s.maxPct)} y="42" textAnchor="middle" className="ax-text">{sign(s.maxPct)}</text>
          <text x={x(0)} y="42" textAnchor="middle" className="ax-text">0</text>
        </svg>
        <p className="bal-clim-sub">Fourchette entre {s.nModels} modèles : de {sign(s.minPct)} à {sign(s.maxPct)}. {Number.isFinite(s.medianMm) && Number.isFinite(s.referenceMedianMmYr) && <>Soit {(s.medianMm < 0 ? '−' : '+') + fmt(Math.abs(s.medianMm), 0)} mm/an sur {fmt(s.referenceMedianMmYr, 0)} mm/an de référence.</>}</p>
        {others.length > 0 && <p className="bal-muted">Région à cheval sur plusieurs bassins ; bassin principal affiché. Autres : {others.join(', ')}.</p>}
      </>
    );
  }
  return (
    <section className="bal-card bal-climate" aria-labelledby="bal-clim-h">
      <h2 id="bal-clim-h">Signal climatique</h2>
      <div className="bal-notpred" role="note"><strong>Projection modélisée, usage non commercial, incertitude entre modèles, pas une prévision.</strong> Il sert de valeur par défaut au curseur « Pluie 2050 » du simulateur, via une hypothèse de conversion pluie→apport.</div>
      {body}
      {doc && <p className="bal-muted">Source : Open-Meteo Climate API (CMIP6), récupérée le {String(doc.fetchedAt || '').slice(0, 10) || '—'}. {doc.scenario ? doc.scenario + '. ' : ''}Un seul point par bassin, relief non représenté.</p>}
    </section>
  );
}

/* ---------- explication ---------- */
function Explain({ text }) {
  if (!text) return null;
  const lines = Array.isArray(text) ? text : typeof text === 'string' ? text.split('\n') : text.lines || text.steps || [JSON.stringify(text)];
  return (
    <details className="bal-explain">
      <summary>Comment ce chiffre est calculé</summary>
      <div>{lines.filter(Boolean).map((l, i) => <p key={i}>{typeof l === 'string' ? l : l.text || JSON.stringify(l)}</p>)}</div>
    </details>
  );
}

/* ---------- ligne de classement ---------- */
function RankRow({ r, selId, select, nameOf, maxMonths }) {
  const sc = HYDRO_LABEL[r.hydrology] || r.hydrology;
  const outlook = r.noStock ? 'pas de stock de surface' : r.depletionYear != null ? 'épuisement du stock de surface en ' + r.depletionYear + ' (' + sc + ')' : 'pas d’épuisement sur 10 ans (' + sc + ')';
  const w = r.monthsOfCoverage != null && maxMonths ? Math.min(100, (r.monthsOfCoverage / maxMonths) * 100) : 0;
  return (
    <li className={r.id === selId ? 'on' : ''}>
      <button type="button" onClick={() => select(r.id)}>
        <span className="bal-rank-name">{nameOf(r.id)}</span>
        <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="8" className="bal-bar-bg" /><rect width={w} height="8" className="bal-rank-fill" data-band={r.band} /></svg>
        <span className="bal-rank-val">{r.noStock ? (typeof r.flux?.coveragePct === 'number' ? Math.round(r.flux.coveragePct) + ' %' : '—') : fmt(r.monthsOfCoverage, 1) + ' mois'}</span>
        {r.noStock ? <span className="bal-band" data-band={r.flux?.band || 'none'}><i aria-hidden="true" />{r.flux?.band ? B.FLUX_LABELS[r.flux.band] + ' · ' : ''}dessalement {typeof r.desalCoverage === 'number' ? Math.round(r.desalCoverage * 100) + ' % du potable' : 'n/d'}</span> : <BandTag band={r.band} today={r.depletionYear != null} />}
        <span className="bal-rank-outlook" data-depleted={r.depletionYear != null ? 'true' : 'false'}>{outlook}{r.stressed ? ' · sous tension' : ''}</span>
      </button>
    </li>
  );
}

/* ---------- page ---------- */
export default function BalancePage({ regionId, onSelectRegion }) {
  const [wb, reloadWb] = useJson('/data/water-balance.json');
  const [bu] = useJson('/data/national-bulletin.json');
  const [rg] = useJson('/data/regions.json');
  const [clim] = useJson('/data/climate-outlook.json');

  const [hydrology, setHydrology] = useState('normal');
  const [yearIdx, setYearIdx] = useState(0);
  const [popPct, setPopPct] = useState(null); // croissance %/an, null = valeur de la région
  const [savings, setSavings] = useState(0);
  const [desal, setDesal] = useState(0);
  const [reuse, setReuse] = useState(0);
  const [rainPct, setRainPct] = useState(null); // null = médiane CMIP6 du bassin principal de la région

  const bulletin = bu.doc;
  const regionsMeta = useMemo(() => Object.fromEntries((rg.doc?.regions || []).map(r => [r.id, r])), [rg.doc]);
  const balances = wb.doc?.regions;
  const byId = useMemo(() => Object.fromEntries((balances || []).map(r => [r.id, r])), [balances]);
  const selId = regionId && byId[regionId] ? regionId : (byId['souss-massa'] ? 'souss-massa' : balances?.[0]?.id);
  const rb = byId[selId];
  const nameOf = id => regionsMeta[id]?.name || id;

  const basinOf = useCallback(r => {
    if (!r || !wb.doc?.basins) return [];
    const names = new Set((r.basinShares || []).map(s => s.basin));
    return wb.doc.basins.filter(b => names.has(b.name));
  }, [wb.doc]);

  const growthOf = r => valOf(r?.popGrowthPctYr) ?? 0;
  const growth = popPct ?? growthOf(rb);
  useEffect(() => { setPopPct(null); }, [selId]);

  const mainBasinOf = r => [...(r?.basinShares || [])].sort((a, b) => (b.share || 0) - (a.share || 0))[0]?.basin;
  const climOf = r => (clim.status === 'done' ? clim.doc?.basins?.[mainBasinOf(r)]?.summary : null);
  const medianOf = r => { const m = climOf(r)?.medianPct; return Number.isFinite(m) ? m : 0; };
  const scenario = useCallback((r, h, g) => ({
    hydrology: h, popGrowth: g ?? growthOf(r), demandReductionPct: savings, addedDesalMm3: desal, reusePct: reuse, startYear: START_YEAR,
    rainChangePct: rainPct ?? medianOf(r),
  }), [savings, desal, reuse, rainPct, clim]);

  const fluxAssumptions = useCallback((r, year) => ({
    year, popGrowth: popPct ?? growthOf(r), demandReductionPct: savings, addedDesalMm3: desal, reusePct: reuse,
  }), [popPct, savings, desal, reuse]);

  const ready = wb.status === 'done' && bu.status === 'done' && rg.status === 'done' && balances?.length && bulletin;

  /* carte : mois de couverture par région à l’année choisie, scénario hydrologique choisi */
  const metricByRegion = useMemo(() => {
    if (!ready) return {};
    const out = {};
    for (const r of balances) {
      if (!safe(B.basinStockForRegion, r, bulletin)?.hasStock) {
        // Sans barrage rattaché : indicateur de flux (dessalement ÷ potable), jamais des mois de couverture.
        out[r.id] = safe(B.fluxMetric, r, fluxAssumptions(r, START_YEAR + yearIdx)) || { value: null };
        continue;
      }
      const sim = safe(B.simulate, r, bulletin, basinOf(r), scenario(r, hydrology), 10);
      const pt = Array.isArray(sim) ? (sim.find(p => p.year === START_YEAR + yearIdx) || sim[yearIdx]) : null;
      out[r.id] = pt && Number.isFinite(pt.monthsOfCoverage)
        ? { value: pt.monthsOfCoverage, band: pt.band || safe(B.bandFor, pt.monthsOfCoverage), label: fmt(pt.monthsOfCoverage, 1) + ' mois' }
        : { value: null };
    }
    return out;
  }, [ready, balances, bulletin, hydrology, yearIdx, basinOf, scenario, fluxAssumptions]);

  /* panneau région : situation actuelle (sans simulation) */
  const panel = useMemo(() => {
    if (!ready || !rb) return null;
    const assumptions = { year: START_YEAR + yearIdx, popGrowth: growth, demandReductionPct: savings, addedDesalMm3: desal, reusePct: reuse };
    const cover = safe(B.coverage, rb, bulletin, assumptions);
    return {
      stock: safe(B.basinStockForRegion, rb, bulletin),
      demand: safe(B.annualDemand, rb, { year: assumptions.year, popGrowth: growth, demandFactor: 1 - savings / 100 }),
      cover,
      why: safe(B.explain, cover),
    };
  }, [ready, rb, bulletin, yearIdx, growth, savings, desal, reuse]);

  const noStockSel = !!panel && !panel.stock?.hasStock;
  const flux = useMemo(() => (noStockSel ? safe(B.desalFlux, rb, fluxAssumptions(rb, START_YEAR + yearIdx)) : null), [noStockSel, rb, fluxAssumptions, yearIdx]);

  /* simulateur */
  const series = useMemo(() => {
    if (!ready || !rb) return {};
    const basin = basinOf(rb);
    return Object.fromEntries(HYDRO.map(h => [h.id, safe(B.simulate, rb, bulletin, basin, scenario(rb, h.id, growth), 10) || []]));
  }, [ready, rb, bulletin, basinOf, scenario, growth]);

  /* solidarité : classement à mois de couverture du jour + épuisement à 10 ans, hypothèses et scénario courants */
  const ranking = useMemo(() => {
    if (!ready) return [];
    const assumptions = { year: START_YEAR, demandReductionPct: savings, addedDesalMm3: desal, reusePct: reuse };
    const r = safe(B.rankingOutlook, balances, bulletin, wb.doc?.basins, { assumptions, scenarioFor: rbx => scenario(rbx, hydrology), years: 10 });
    return Array.isArray(r) ? r : [];
  }, [ready, balances, bulletin, wb.doc, savings, desal, reuse, hydrology, scenario]);
  const withStock = ranking.filter(r => !r.noStock);
  const noStock = ranking.filter(r => r.noStock);
  const stressedIds = ranking.filter(r => r.stressed).map(r => r.id);

  const leversBy = useMemo(() => {
    if (!ready) return {};
    const base = { year: START_YEAR, demandReductionPct: savings, addedDesalMm3: desal, reusePct: reuse };
    return Object.fromEntries(stressedIds.filter(id => byId[id]).map(id => [id, safe(B.levers, byId[id], bulletin, base) || []]));
  }, [ready, byId, bulletin, ranking, savings, desal, reuse]);

  const desalCov = useMemo(() => (ready ? Object.fromEntries(balances.map(r => [r.id, safe(B.coverage, r, bulletin, { year: START_YEAR })?.desalCoverageOfPotable])) : {}), [ready, balances, bulletin]);
  const climBasins = [...(rb?.basinShares || [])].sort((a, b) => (b.share || 0) - (a.share || 0)).map(s => s.basin);

  const rainSummary = climOf(rb);
  const rainValue = rainPct ?? medianOf(rb);
  const hp = B.hydroParams(basinOf(rb)[0], hydrology);
  const select = id => onSelectRegion && onSelectRegion(id);

  if (wb.status === 'loading' || bu.status === 'loading' || rg.status === 'loading') {
    return <section className="bal-page" aria-busy="true"><p className="bal-state">Chargement de l’observatoire…</p></section>;
  }
  if (!ready) {
    return (
      <section className="bal-page">
        <div className="bal-state error" role="alert">
          <h2>Données d’autosuffisance indisponibles</h2>
          <p>Le fichier <code>water-balance.json</code>, le bulletin national ou les régions n’ont pas pu être lus. Rien n’est estimé à leur place.</p>
          <button type="button" className="bal-btn" onClick={reloadWb}>Réessayer</button>
        </div>
      </section>
    );
  }

  const cover = panel?.cover;
  const months = cover?.monthsOfCoverage;
  const simNow = series[hydrology]?.[yearIdx];

  return (
    <section className="bal-page" aria-labelledby="bal-h1">
      <header className="bal-head">
        <div>
          <h1 id="bal-h1">Combien de mois tient chaque région ?</h1>
          <p className="bal-lede">Stock de surface alloué à la région, rapporté à sa demande estimée. Un scénario n’est pas une prédiction : les hypothèses sont visibles et modifiables.</p>
        </div>
        <div className="bal-legend" aria-label="Légende des statuts">
          {Object.keys(STATUS).map(k => <Pill key={k} status={k} />)}
        </div>
      </header>

      <div className="bal-mapcard">
        <div className="bal-map" aria-label="Carte nationale en 3D, mois de couverture par région">
          <AnzarMap
            metricByRegion={metricByRegion}
            metricLabel={'Mois de couverture · scénario ' + HYDRO_LABEL[hydrology] + ' · ' + (START_YEAR + yearIdx)}
            selectedId={selId}
            onSelect={select}
            year={START_YEAR + yearIdx}
          />
        </div>
        <div className="bal-controls">
          <div>
            <div className="bal-ctl-title">Scénario hydrologique</div>
            <Segmented label="Scénario hydrologique" options={HYDRO} value={hydrology} onChange={setHydrology} />
            <p className="bal-hint">Facteur sur les apports du bassin : {fmt(hp.factor, 2)} × part captée par les retenues {fmt(hp.capture * 100, 0)} %. Hypothèses choisies à l’œil à pluie inchangée (scénario normal de Souss-Massa proche du stock actuel), non validées. {rainValue < 0 ? 'Avec la pluie à ' + fmt(rainValue, 1) + ' % (médiane CMIP6 par défaut), ce calage ne s’applique plus et le dessèchement est en partie compté deux fois.' : rainValue > 0 ? 'Avec la pluie à +' + fmt(rainValue, 1) + ' %, les apports sont relevés et compensent en partie le facteur « normal » : le calage ne s’applique plus.' : 'Pluie inchangée : le calage s’applique.'} Ce n’est ni une validation ni une prévision météo.</p>
          </div>
          <Slider id="bal-year" label="Année simulée" value={START_YEAR + yearIdx} min={START_YEAR} max={START_YEAR + 10} step={1} unit="" onChange={v => setYearIdx(v - START_YEAR)} status="hypothese" />
          <nav className="bal-chips" aria-label="Choisir une région">
            {balances.map(r => (
              <button key={r.id} type="button" className={r.id === selId ? 'on' : ''} aria-pressed={r.id === selId} onClick={() => select(r.id)}>{nameOf(r.id)}</button>
            ))}
          </nav>
        </div>
      </div>

      <div className="bal-grid">
        <article className="bal-card" aria-labelledby="bal-region">
          <h2 id="bal-region">{nameOf(selId)}</h2>
          {noStockSel ? <FluxCard flux={flux} rb={rb} year={START_YEAR + yearIdx} /> : (<>
          <div className="bal-cover">
            <div className="bal-cover-num" aria-live="polite">{fmt(months, 1)}<span> mois</span></div>
            <div>
              <BandTag band={cover?.band} />
              <div className="bal-cover-sub">de couverture, stock de surface seul <Pill status="derived" /></div>
              {typeof cover?.monthsPotable === 'number' && <div className="bal-cover-sub">Potable seule : <strong>{fmt(cover.monthsPotable, 1)} mois</strong></div>}
            </div>
          </div>
          <StockBar stock={panel?.stock} />
          </>)}
          <DemandBars demand={panel?.demand} />
          <div className="bal-meta">
            <Stat label="Population" value={fmt(valOf(rb.population), 0)} status={rb.population?.status} source={rb.population?.source} />
            <Stat label="Dessalement ÷ demande potable" value={typeof cover?.desalCoverageOfPotable === 'number' ? fmt(cover.desalCoverageOfPotable * 100, 0) : '—'} unit="%" status="hypothese" source="capacité × utilisation 80 % ÷ demande potable estimée, borné à 100 %" />
            <Stat label="Eaux souterraines" value="non modélisé" status="hypothese" />
          </div>
          <ul className="bal-caveats">
            {((noStockSel ? flux?.caveats : cover?.caveats) || []).filter(c => !/souterr/i.test(c)).map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <Explain text={noStockSel ? B.explainFlux(flux) : panel?.why} />
        </article>

        <article className="bal-card" aria-labelledby="bal-sim">
          <h2 id="bal-sim">Simulateur sur 10 ans</h2>
          <p className="bal-muted">Région : {nameOf(selId)}. La bande va du scénario sec au scénario humide.</p>
          <div className="bal-sliders">
            <Slider id="s-pop" label="Croissance de la population" value={growth} min={-1} max={4} step={0.1} unit="%/an" onChange={setPopPct} status={popPct === null ? rb.popGrowthPctYr?.status : 'hypothese'} />
            <Slider id="s-save" label="Économies d’eau" value={savings} min={0} max={40} step={1} unit="%" onChange={setSavings} />
            <Slider id="s-desal" label="Dessalement ajouté" value={desal} min={0} max={300} step={5} unit="Mm³/an" onChange={setDesal} />
            <Slider id="s-reuse" label="Réutilisation des eaux usées" value={reuse} min={0} max={100} step={5} unit="%" onChange={setReuse} />
          </div>
          <div className="bal-rain">
            <Slider id="s-rain" label="Pluie 2050 vs 1991-2020 (%)" value={rainValue} min={-40} max={40} step={1} unit="%" onChange={setRainPct} status="hypothese"
              hint={rainSummary ? 'médiane CMIP6 ' + fmt(rainSummary.medianPct, 1) + ' %, fourchette ' + fmt(rainSummary.minPct, 1) + ' à ' + fmt(rainSummary.maxPct, 1) + ' % (bassin ' + mainBasinOf(rb) + ')' : 'projection indisponible : 0 % par défaut'} />
            <button type="button" className="bal-btn ghost" disabled={!rainSummary} onClick={() => setRainPct(null)}>Médiane CMIP6</button>
            <p className="bal-hint">Projection modélisée, usage non commercial, hypothèse de conversion pluie→apport : apport × max(0, 1 + {B.RAIN_TO_RUNOFF_ELASTICITY} × variation de pluie), élasticité non sourcée. Ce n’est pas une prévision.</p>
          </div>
          {noStockSel && <p className="bal-notpred" role="note">Cette région n’a pas de stock de surface rattaché : la courbe de stock ne s’applique pas. La carte montre l’indicateur de flux (part du potable couverte par le dessalement) à l’année choisie, avec les curseurs de population, économies, dessalement ajouté.</p>}
          {!noStockSel && <SimChart series={series} selected={hydrology} capacity={panel?.stock?.capacityMm3} />}
          {!noStockSel && <div className="bal-simnote" aria-live="polite">
            <BandTag band={simNow?.band} />
            <span>{START_YEAR + yearIdx}, scénario {HYDRO_LABEL[hydrology]} : {fmt(simNow?.storedMm3, 0)} Mm³ en stock, {fmt(simNow?.monthsOfCoverage, 1)} mois</span>
            <Pill status="hypothese" />
          </div>}
          {series[hydrology]?.some(p => p.depleted) && <p className="bal-notpred" role="note">{B.DEPLETED_NOTE} (dès {series[hydrology].find(p => p.depleted).year}).</p>}
          <button type="button" className="bal-btn ghost" onClick={() => { setSavings(0); setDesal(0); setReuse(0); setPopPct(null); setRainPct(null); }}>Réinitialiser les hypothèses</button>
        </article>
      </div>

      <ClimateSignal state={clim} basinName={climBasins[0]} others={climBasins.slice(1)} regionName={nameOf(selId)} />

      <section className="bal-south" aria-labelledby="bal-south-h">
        <h2 id="bal-south-h">Solidarité Sud : couverture du jour et épuisement à 10 ans</h2>
        <p className="bal-lede">Classement indicatif des régions par mois de couverture aujourd’hui, avec l’année d’épuisement du stock de surface dans le scénario {HYDRO_LABEL[hydrology]} et les hypothèses courantes du simulateur. Aucun volume n’est transféré d’une région à l’autre.</p>
        <div className="bal-notpred" role="note"><strong>Ce n’est pas une prédiction.</strong> Une région est dite « sous tension » si au moins un critère est vrai : {B.TENSION_CRITERIA.map((c, i) => (i ? ' ; ' : '') + c).join('')}. Seuils d’hypothèse. Les eaux souterraines ne sont pas modélisées.</div>

        <div className="bal-south-grid">
          <div>
            <ol className="bal-rank" aria-label="Classement des régions avec stock de surface, par mois de couverture">
              {withStock.map(r => <RankRow key={r.id} r={r} selId={selId} select={select} nameOf={nameOf} maxMonths={Math.max(1, ...withStock.map(x => x.monthsOfCoverage || 0))} />)}
              {!ranking.length && <li className="bal-muted">Classement indisponible.</li>}
            </ol>
            {noStock.length > 0 && (
              <>
                <h3 className="bal-rank-group">Pas de stock de surface : indicateur de flux (dessalement ÷ potable, nappes non modélisées)</h3>
                <p className="bal-muted">Indicateur de flux, différent des mois de couverture : ces régions ne sont pas classées avec les précédentes.</p>
                <ol className="bal-rank" aria-label="Régions sans stock de surface">
                  {noStock.map(r => <RankRow key={r.id} r={r} selId={selId} select={select} nameOf={nameOf} />)}
                </ol>
              </>
            )}
          </div>

          <div className="bal-levers">
            {stressedIds.filter(id => byId[id]).map(id => {
              const items = (leversBy[id] || []).slice(0, 4);
              const projects = (wb.doc.projects || []).filter(p => (p.regionIds || []).includes(id));
              return (
                <details className="bal-lever-card" key={id} open={id === selId}>
                  <summary>
                    <h3>{nameOf(id)}</h3>
                    <ChevronDown size={16} aria-hidden="true" />
                    <span className="bal-lever-reason">Sous tension : {(ranking.find(x => x.id === id)?.reasons || []).join(' ; ')}.</span>
                  </summary>
                  <p className="bal-lever-desal">Dessalement ÷ demande potable : <strong>{typeof desalCov[id] === 'number' ? fmt(desalCov[id] * 100, 0) + ' %' : '—'}</strong> <Pill status="hypothese" source="capacité × 80 % ÷ demande potable estimée, borné à 100 %" /></p>
                  {items.length ? (
                    <>
                      <div className="bal-lever-head"><span className="bal-ctl-title">Leviers, effet sur la couverture</span><Pill status="hypothese" source="effet calculé avec les hypothèses du simulateur" /></div>
                      <ul>
                        {items.map(l => (
                          <li key={l.id}><span>{l.label}</span><strong>{typeof l.deltaMonths === 'number' ? (l.deltaMonths >= 0 ? '+' : '') + fmt(l.deltaMonths, 1) + ' mois' : 'non chiffré'}</strong>{l.status && l.status !== 'hypothese' && <Pill status={l.status} />}</li>
                        ))}
                      </ul>
                    </>
                  ) : <p className="bal-muted">Leviers non calculables.</p>}
                  {projects.length > 0 && (
                    <div className="bal-projects">
                      <div className="bal-ctl-title">Projets documentés</div>
                      <ul>
                        {projects.map(p => (
                          <li key={p.id}>
                            <span>{p.label} <em>({p.kind}, {p.status}{p.year ? ', ' + p.year : ''})</em></span>
                            {p.source && <a href={p.source} target="_blank" rel="noreferrer noopener">source{p.date ? ' · ' + p.date : ''}</a>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bal-foot">
        <p>Bulletin des barrages du {bulletin.date}. Données : water-balance.json (au {wb.doc.asOf}), regions.json. Prototype indépendant, pas un portail officiel.</p>
      </footer>
    </section>
  );
}
