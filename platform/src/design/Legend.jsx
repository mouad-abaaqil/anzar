import { BANDS, FLUX_STEPS, FLUX_GLYPH } from './bands.js';

// Legend: swatch + glyph + word. kind="bands" (mois de réserve) or kind="flux" (Sahara).
export default function Legend({ kind = 'bands', title, showHints = false }) {
  const items = kind === 'flux'
    ? FLUX_STEPS.map(s => ({ key: `flux-${s.id}`, glyph: FLUX_GLYPH, label: s.label }))
    : ['critique', 'tendu', 'confortable', 'na'].map(k => ({ key: `band-${k}`, glyph: BANDS[k].glyph, label: BANDS[k].label, hint: BANDS[k].hint }));
  return (
    <figure className="az-legend">
      {title && <figcaption className="az-micro az-micro--muted">{title}</figcaption>}
      <ul className="az-legend__list">
        {items.map(i => (
          <li key={i.key} className="az-legend__item">
            <span className={`az-legend__swatch az-legend__swatch--${i.key}`} aria-hidden="true">{i.glyph}</span>
            <span>{i.label}{showHints && i.hint && <span className="az-legend__hint"> · {i.hint}</span>}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
