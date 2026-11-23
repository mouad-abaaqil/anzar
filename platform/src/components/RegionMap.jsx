import { useMemo } from 'react';
import { date, number } from '../lib/format.js';
import { FILL_STEPS, NO_BASIN_LABEL, fillStep, projectRegions, regionBasin, regionById } from '../lib/regions.js';
import '../pages/regions.css';

// Schematic map of the twelve regions coloured by the indicative fill of their main basin.
export default function RegionMap({ doc, bulletin, geo, regionId, onSelectRegion, note }) {
  const region = regionById(doc, regionId);
  const neighbours = useMemo(() => new Set(region?.neighbours || []), [region]);
  const projection = useMemo(() => projectRegions(geo, { width: 360 }), [geo]);
  const confirmed = doc.regions.filter(r => r.basinMappingConfirmed).map(r => r.name).join(', ');
  const rank = id => (id === regionId ? 2 : neighbours.has(id) ? 1 : 0);
  const drawOrder = [...projection.features].sort((a, b) => rank(a.id) - rank(b.id));
  return (
    <figure className="rcard rg-map-card">
      <figcaption>
        <h2>Carte des régions</h2>
        <p className="rg-map-caption">Remplissage du bassin principal rattaché (indicatif) — bulletin du {date(bulletin.date)}</p>
      </figcaption>
      <svg
        className="map-svg"
        viewBox={`0 0 ${projection.width} ${projection.height.toFixed(1)}`}
        role="group"
        aria-label="Carte schématique des douze régions"
      >
        {drawOrder.map(f => {
          const r = regionById(doc, f.id);
          const b = regionBasin(bulletin, r);
          const step = fillStep(b?.fillPct);
          const isSelected = f.id === regionId;
          const label = `${r.name} : ${b ? `bassin ${b.name}, ${number(b.fillPct, 2)} %` : NO_BASIN_LABEL}`;
          const classes = ['map-region', step === null ? 'is-na' : `bin-${step}`, isSelected ? 'is-selected' : '', neighbours.has(f.id) ? 'is-neighbour' : ''].join(' ');
          return (
            <path
              key={f.id}
              d={f.d}
              className={classes}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onSelectRegion(f.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectRegion(f.id);
                }
              }}
            >
              <title>{label}</title>
            </path>
          );
        })}
      </svg>
      <ul className="map-legend" aria-label="Légende de la carte">
        {FILL_STEPS.map((label, i) => (
          <li key={label}><span className={`swatch bin-${i}`} aria-hidden="true" />{label}</li>
        ))}
        <li><span className="swatch is-na" aria-hidden="true" />{NO_BASIN_LABEL}</li>
      </ul>
      <p className="map-note">
        {note || <>Rattachement bassin ↔ région indicatif, sauf : {confirmed}. Région sélectionnée : {region?.name} (contour plein). Voisines : contour en pointillés. Cliquez une région ou appuyez sur Entrée.</>}
      </p>
    </figure>
  );
}
