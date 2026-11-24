import ProvenanceChip from './ProvenanceChip.jsx';
import { BANDS } from './bands.js';

// Stat: one big number, its unit, a short label, provenance and an optional band (glyph + word).
export default function Stat({ value, unit, label, provenance, band, size = 'md', className = '' }) {
  const b = band ? BANDS[band] : null;
  return (
    <div className={`az-stat az-stat--${size} ${className}`}>
      <div className="az-stat__value">
        <span className="az-stat__num">{value}</span>
        {unit && <span className="az-stat__unit">{unit}</span>}
      </div>
      <div className="az-stat__meta">
        <span className="az-stat__label">{label}</span>
        {provenance && <ProvenanceChip {...provenance} />}
      </div>
      {b && <span className={`az-band az-band--${band}`}><span aria-hidden="true">{b.glyph}</span> {b.label}</span>}
    </div>
  );
}
