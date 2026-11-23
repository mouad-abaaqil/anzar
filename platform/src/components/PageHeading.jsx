import { ArrowDownToLine, MapPin, ShieldCheck } from 'lucide-react';
import { nav } from '../lib/constants.js';
import { date } from '../lib/format.js';

const subtitles = {
  overview: 'Bulletin public des barrages de la région. Chaque valeur indique sa date et sa source.',
  map: 'Ouvrages et installations de la région. Les points sont indicatifs, sans tracé de réseau.',
  quality: 'Analyses saisies dans votre espace, avec date de prélèvement, unité et méthode.',
  cycle: 'Ressources, traitement et réutilisation dans la région. Schéma fonctionnel, non cartographique.',
};

const defaultSubtitle = 'Origine des données, dates de publication et limites d’usage.';

export default function PageHeading({ page, asOf, user, onExport }) {
  return (
    <div className="page-heading">
      <div>
        <div className="region-eyebrow"><MapPin size={14} /> Région Souss-Massa</div>
        <h1>{nav.find(n => n.id === page)?.label}</h1>
        <p>{subtitles[page] || defaultSubtitle}</p>
      </div>
      <div className="heading-actions">
        {page === 'overview' || page === 'map' ? (
          <>
            <span className="snapshot-date"><span />Bulletin du {date(asOf)}</span>
            <button className="secondary-button export-button" onClick={onExport}><ArrowDownToLine size={16} />Exporter</button>
          </>
        ) : page === 'quality' ? (
          <span className="privacy-label"><ShieldCheck size={16} />{user ? 'Espace privé' : 'Analyses privées'}</span>
        ) : null}
      </div>
    </div>
  );
}
