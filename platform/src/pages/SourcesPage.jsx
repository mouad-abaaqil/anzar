import { ArrowDownToLine, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { date } from '../lib/format.js';

export default function SourcesPage({ data, onExport, weatherPlace = 'Agadir' }) {
  return (
    <div className="sources-page">
      <section className="source-overview">
        <div>
          <ShieldCheck size={28} />
          <h2>Origine et méthode des données</h2>
          <p>Le tableau de bord combine des bulletins publics datés, des repères géographiques et les analyses que vous importez. Ces informations répondent à des questions différentes.</p>
        </div>
        <button className="secondary-button" onClick={onExport}><ArrowDownToLine size={16} />Exporter les sources</button>
      </section>

      <div className="data-types">
        <article>
          <h3>Données publiques</h3>
          <p>Volumes et taux de remplissage issus d’un bulletin daté. Capacités des installations avec la date de leur référence.</p>
        </article>
        <article>
          <h3>Analyses importées</h3>
          <p>Valeurs fournies par l’utilisateur, conservées avec unité, date de prélèvement, source et méthode. Aucun résultat n’est prérempli.</p>
        </article>
        <article>
          <h3>Météo modélisée</h3>
          <p>Données Open-Meteo pour {weatherPlace}. Elles fournissent un contexte météorologique, sans mesurer la qualité de l’eau.</p>
        </article>
      </div>

      <div className="section-heading">
        <h2>Registre des sources</h2>
        <span className="small-muted">Liens directs vers les publications</span>
      </div>
      <div className="source-register">
        {data.sources.map(s => (
          <article key={s.id}>
            <div className="source-icon"><FileText size={21} /></div>
            <div className="source-detail">
              <span className="source-publisher">{s.publisher}{s.date ? ` · ${date(s.date)}` : ''}</span>
              <h3>{s.title}</h3>
              {s.limitations && <p>{s.limitations}</p>}
              <div className="source-tags">{s.kind && <span>{s.kind}</span>}{s.license && <span>{s.license}</span>}</div>
            </div>
            <a className="source-open" href={s.url} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${s.title}`}>
              <ExternalLink size={17} />
            </a>
          </article>
        ))}
      </div>

      <section className="limitations">
        <h2>Ce que l’outil permet de conclure</h2>
        <ul>
          <li>Un taux de remplissage décrit une réserve disponible. Il ne décrit pas la qualité de l’eau.</li>
          <li>Les repères géographiques signalés comme indicatifs ne servent pas au guidage ni à la gestion d’un réseau réel.</li>
          <li>Aucun flux de capteurs ni résultat de laboratoire n’est connecté par défaut. Les sources publiques ne constituent pas une télémesure en temps réel.</li>
          <li>Aucun indice global de potabilité n’est calculé. La formule historique du notebook n’est pas utilisée dans cette application.</li>
          <li>Les objectifs et capacités de projet sont distingués des volumes effectivement produits. Les géométries de canalisations ne sont pas inventées.</li>
        </ul>
      </section>

      <section className="project-origin">
        <h2>Origine du projet</h2>
        <p>Identité institutionnelle : SRM-SM. Prototype indépendant.</p>
        <p>Issu d’un stage à la RAMSA, ce projet explore aujourd’hui la surveillance des ressources et de la qualité de l’eau dans le contexte de la SRM Souss-Massa. C’est un prototype indépendant, sans commande ni validation officielle de l’entreprise. Le logo reste la propriété de son titulaire.</p>
        <p>Cartographie : MapLibre GL JS, OpenFreeMap, OpenStreetMap et Mapterhorn. Les licences et attributions propres aux sources s’appliquent.</p>
      </section>
    </div>
  );
}
