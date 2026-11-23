import React, { Suspense } from 'react';
import { Activity, ChevronRight, FileText, Layers, Map, MapPin, ShieldCheck } from 'lucide-react';
import { kindSingular, kinds } from '../lib/constants.js';
import { date, number } from '../lib/format.js';

const MapView = React.lazy(() => import('../components/MapView.jsx'));

export default function MapPage({
  facilities,
  selected,
  visibleKinds,
  setVisibleKinds,
  terrain,
  setTerrain,
  setSelectedId,
  sources,
  navigate,
}) {
  return (
    <>
      <section className="geography-section" aria-label="Carte et fiche de l’ouvrage">
        <div className="map-card">
          <div className="map-toolbar">
            <div className="map-title"><Map size={17} /><strong>Carte des ouvrages</strong></div>
            <div className="segmented-control" aria-label="Mode de carte">
              <button className={!terrain ? 'selected' : ''} onClick={() => setTerrain(false)} aria-pressed={!terrain}>2D</button>
              <button className={terrain ? 'selected' : ''} onClick={() => setTerrain(true)} aria-pressed={terrain}>3D</button>
            </div>
          </div>
          <div className="map-canvas">
            <Suspense fallback={<div className="loading-state" role="status"><span className="loading-spinner" /><p>Chargement de la carte…</p></div>}>
              <MapView
                facilities={facilities}
                selectedId={selected?.id}
                onSelect={setSelectedId}
                visibleKinds={visibleKinds}
                terrain={terrain}
                basemap="relief"
              />
            </Suspense>
            <div className="map-layer-controls" aria-label="Couches de la carte">
              <Layers size={16} />
              {Object.entries(kinds).map(([kind, label]) => (
                <button
                  key={kind}
                  className={`layer-chip ${visibleKinds.includes(kind) ? 'enabled' : ''}`}
                  aria-pressed={visibleKinds.includes(kind)}
                  onClick={() => setVisibleKinds(v => v.includes(kind) ? v.filter(k => k !== kind) : [...v, kind])}
                >
                  <span className={`kind-dot ${kind}`} />{label}
                </button>
              ))}
            </div>
            <div className="map-place-label">Océan Atlantique</div>
          </div>
          <div className="map-caption">
            <span><span className="terrain-key" />Relief réel · inclinaison et rotation libres</span>
            <span>Repères indicatifs, sans tracé de réseau</span>
          </div>
        </div>
        <SiteInspector
          site={selected}
          sources={sources}
          onQuality={() => navigate('quality')}
          onSources={() => navigate('sources')}
        />
      </section>
      <div className="below-map">
        <span><ShieldCheck size={15} />Les volumes de retenue ne renseignent pas sur la potabilité.</span>
        <button className="text-button" onClick={() => navigate('sources')}>Consulter la méthode<ChevronRight size={14} /></button>
      </div>
    </>
  );
}

function SiteInspector({ site, sources, onQuality, onSources }) {
  if (!site) {
    return (
      <aside className="site-inspector">
        <p>Sélectionnez un ouvrage sur la carte.</p>
      </aside>
    );
  }
  const source = sources.find(s => site.sourceIds?.includes(s.id));
  return (
    <aside className="site-inspector">
      <div className="inspector-heading">
        <span className={`type-label ${site.kind}`}><span className={`kind-dot ${site.kind}`} />{kindSingular[site.kind]}</span>
        <MapPin size={17} />
      </div>
      <h2>{site.name}</h2>
      <p className="site-description">{site.description}</p>
      <div className="inspector-section">
        {site.kind === 'dam' ? (
          <>
            <div className="fill-heading"><span>Remplissage</span><strong>{number(site.fillPct)}<small> %</small></strong></div>
            <div className="fill-track large"><span style={{ width: `${Math.min(100, site.fillPct || 0)}%` }} /></div>
            <div className="site-stat"><span>Volume stocké</span><strong>{number(site.storageMm3, 2)} Mm³</strong></div>
            <div className="site-stat"><span>Date du bulletin</span><strong>{date(site.asOf)}</strong></div>
          </>
        ) : (
          <>
            <span className="small-muted">Infrastructure & fonction</span>
            {site.capacityLabel && <p className="capacity-label">{site.capacityLabel}</p>}
            {(site.metrics || []).map((m, i) => (
              <div key={i} className="site-stat stacked"><span>{m.label}</span><strong>{m.value} {m.unit}</strong>{m.note && <small>{m.note}</small>}</div>
            ))}
          </>
        )}
      </div>
      <div className="inspector-quality">
        <div><Activity size={16} /><strong>Qualité de l’eau</strong></div>
        <p>Aucune analyse publique associée à cet ouvrage.</p>
        <button className="secondary-button" onClick={onQuality}>Suivre les analyses<ChevronRight size={15} /></button>
      </div>
      <div className="inspector-location">
        <span>
          <span className="status-dot" data-status={site.locationAccuracy === 'inventory' ? 'ok' : 'watch'} aria-hidden="true" />
          Localisation {site.locationAccuracy === 'inventory' ? 'issue de l’inventaire' : 'indicative'}
        </span>
        <p>{site.coordinates ? `${number(site.coordinates[1], 4)}° N · ${number(Math.abs(site.coordinates[0]), 4)}° O` : 'Non renseignée'}</p>
      </div>
      <button className="inspector-source" onClick={onSources}>
        <FileText size={15} />
        <span>{source?.publisher || 'Données publiques'}<small>Voir la source et ses limites</small></span>
        <ChevronRight size={14} />
      </button>
    </aside>
  );
}
