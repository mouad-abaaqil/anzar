// Visuels SVG maison du panneau (aucune couleur en dur : tout passe par des classes pn-* qui lisent les jetons --az-*).
import { fmt } from './metrics.js';

/** Barre stock / capacité. */
export function StockBar({ stored, capacity, fillPct }) {
  if (!(capacity > 0)) return null;
  const pct = Math.max(0, Math.min(100, fillPct ?? (stored / capacity) * 100));
  return (
    <figure className="pn-fig">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="pn-bar" role="img" aria-label={'Remplissage ' + fmt(pct, 0) + ' %'}>
        <rect width="100" height="10" className="pn-bar__bg" />
        <rect width={pct} height="10" className="pn-bar__fill" />
      </svg>
      <figcaption className="pn-fig__cap"><span>{fmt(stored, 0)} Mm³</span><span>{fmt(pct, 0)} % rempli</span><span>capacité {fmt(capacity, 0)} Mm³</span></figcaption>
    </figure>
  );
}

/** Demande par usage (Mm³/an). */
export function DemandBars({ demand }) {
  if (!demand) return null;
  const rows = [['Ménages', demand.domesticMm3], ['Agriculture', demand.agricultureMm3], ['Industrie', demand.industryMm3]];
  const max = Math.max(1, ...rows.map(r => r[1] || 0));
  return (
    <ul className="pn-demand" aria-label="Demande d’eau par usage, millions de m³ par an">
      {rows.map(([n, v]) => (
        <li key={n}>
          <span className="pn-demand__n">{n}</span>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="pn-bar pn-bar--thin" aria-hidden="true">
            <rect width="100" height="8" className="pn-bar__bg" />
            <rect width={Math.max(0.8, ((v || 0) / max) * 100)} height="8" className="pn-bar__fill" />
          </svg>
          <span className="pn-demand__v">{fmt(v, 0)}</span>
        </li>
      ))}
      <li className="pn-demand__unit"><span>Mm³ par an</span></li>
    </ul>
  );
}

/** Pluie quotidienne modélisée : barres passé / prévision. */
export function RainBars({ days }) {
  if (!days?.length) return null;
  const vals = days.map(d => (Number.isFinite(d.mm) ? d.mm : 0));
  const max = Math.max(2, ...vals);
  const w = 6, gap = 2, h = 48;
  const width = days.length * (w + gap) - gap;
  return (
    <svg viewBox={'0 0 ' + width + ' ' + h} className="pn-rain" role="img" aria-label={'Pluie quotidienne modélisée, ' + days.length + ' jours : le passé en trait plein, la prévision en contour'}>
      {days.map((d, i) => {
        const bh = Math.max(vals[i] > 0 ? 1.5 : 0, (vals[i] / max) * (h - 2));
        return <rect key={d.date} x={i * (w + gap)} y={h - bh} width={w} height={bh} className={d.forecast ? 'pn-rain__fc' : 'pn-rain__past'}><title>{d.date + ' : ' + fmt(vals[i], 1) + ' mm'}</title></rect>;
      })}
      <line x1="0" x2={width} y1={h - 0.5} y2={h - 0.5} className="pn-axis" />
    </svg>
  );
}

const CH = { w: 360, h: 190, l: 40, r: 14, t: 10, b: 22 };
const HY = { dry: 'sec', normal: 'normal', wet: 'humide' };

/** Courbe du stock sur 10 ans : bande sec / humide, ligne du scénario choisi, capacité, repère d'épuisement. */
export function SimChart({ series, selected, capacity, year }) {
  const cur = series[selected] ?? [];
  const all = Object.values(series).flat();
  if (!all.length) return null;
  const x0 = Math.min(...all.map(p => p.year)), x1 = Math.max(...all.map(p => p.year));
  const yMax = Math.max(capacity || 0, ...all.map(p => p.storedMm3 || 0), 1) * 1.05;
  const sx = y => CH.l + ((y - x0) / Math.max(1, x1 - x0)) * (CH.w - CH.l - CH.r);
  const sy = v => CH.h - CH.b - (v / yMax) * (CH.h - CH.t - CH.b);
  const pt = p => sx(p.year).toFixed(1) + ' ' + sy(p.storedMm3).toFixed(1);
  const line = s => s.map((p, i) => (i ? 'L' : 'M') + pt(p)).join(' ');
  const dry = series.dry ?? [], wet = series.wet ?? [];
  const band = dry.length && dry.length === wet.length ? wet.map((p, i) => (i ? 'L' : 'M') + pt(p)).join(' ') + ' ' + [...dry].reverse().map(p => 'L' + pt(p)).join(' ') + ' Z' : null;
  const dep = cur.find(p => p.depleted);
  const here = cur.find(p => p.year === year);
  const ticks = [0, 0.5, 1].map(f => (f * yMax) / 1.05);
  return (
    <svg viewBox={'0 0 ' + CH.w + ' ' + CH.h} className="pn-chart" role="img"
      aria-label={'Stock de surface simulé sur 10 ans. Bande : du scénario sec au scénario humide. Ligne : scénario ' + HY[selected] + (dep ? '. Stock épuisé dès ' + dep.year : '')}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={CH.l} x2={CH.w - CH.r} y1={sy(v)} y2={sy(v)} className="pn-grid" />
          <text x={CH.l - 5} y={sy(v) + 3} textAnchor="end" className="pn-ax-text">{fmt(v, 0)}</text>
        </g>
      ))}
      {[x0, Math.round((x0 + x1) / 2), x1].map(y => <text key={y} x={sx(y)} y={CH.h - 6} textAnchor={y === x1 ? 'end' : y === x0 ? 'start' : 'middle'} className="pn-ax-text">{y}</text>)}
      <text x={CH.l - 5} y={7} textAnchor="end" className="pn-ax-text">Mm³</text>
      {Number.isFinite(capacity) && capacity > 0 && <line x1={CH.l} x2={CH.w - CH.r} y1={sy(capacity)} y2={sy(capacity)} className="pn-cap" />}
      {band && <path d={band} className="pn-band" />}
      <path d={line(cur)} className="pn-line" />
      {year != null && here && <g><line x1={sx(year)} x2={sx(year)} y1={CH.t} y2={CH.h - CH.b} className="pn-year" /><circle cx={sx(year)} cy={sy(here.storedMm3)} r="4" className="pn-dot" /></g>}
      {dep && <g><line x1={sx(dep.year)} x2={sx(dep.year)} y1={CH.t} y2={CH.h - CH.b} className="pn-depl" /><text x={Math.min(sx(dep.year) + 4, CH.w - CH.r - 90)} y={CH.t + 10} className="pn-ax-text pn-depl-text">{'▲ épuisé ' + dep.year}</text></g>}
    </svg>
  );
}

/** Fourchette CMIP6 entre modèles (min, médiane, max) autour de 0. */
export function ClimateRange({ s }) {
  if (!s) return null;
  const lo = Math.min(s.minPct, 0), hi = Math.max(s.maxPct, 0), W = 300, pad = 24, span = Math.max(1, hi - lo);
  const x = v => pad + ((v - lo) / span) * (W - 2 * pad);
  const sg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 0);
  return (
    <svg viewBox={'0 0 ' + W + ' 40'} className="pn-clim" role="img" aria-label={'Fourchette entre modèles : de ' + sg(s.minPct) + ' % à ' + sg(s.maxPct) + ' %, médiane ' + sg(s.medianPct) + ' %'}>
      <line x1={x(0)} x2={x(0)} y1="4" y2="24" className="pn-cap" />
      <line x1={x(s.minPct)} x2={x(s.maxPct)} y1="14" y2="14" className="pn-clim__range" />
      <circle cx={x(s.medianPct)} cy="14" r="5" className="pn-dot" />
      <text x={x(s.minPct)} y="36" textAnchor="middle" className="pn-ax-text">{sg(s.minPct)} %</text>
      <text x={x(s.maxPct)} y="36" textAnchor="middle" className="pn-ax-text">{sg(s.maxPct)} %</text>
      <text x={x(0)} y="36" textAnchor="middle" className="pn-ax-text">0</text>
    </svg>
  );
}
