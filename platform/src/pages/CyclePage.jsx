import { ChevronRight, Droplets, ExternalLink, Layers, UserRound, Waves } from 'lucide-react';
import { kinds } from '../lib/constants.js';

export default function CyclePage({ data, onSelect, onSources }) {
  return (
    <div className="cycle-page">
      <section className="cycle-intro">
        <h2>Le cycle de l’eau dans la région</h2>
        <p>Les barrages, les nappes et le dessalement contribuent à l’approvisionnement. Après usage, l’assainissement collecte et traite les eaux usées ; une partie peut être réutilisée pour des usages adaptés.</p>
        <div className="method-callout">
          <Layers size={20} />
          <p>Ce schéma présente les fonctions du système régional. Il ne représente ni les canalisations réelles, ni une répartition mesurée des volumes.</p>
        </div>
      </section>

      <div className="water-flow">
        <div className="flow-column">
          <span className="flow-step">Mobiliser la ressource</span>
          {['dam', 'groundwater', 'desalination'].map(k => (
            <div key={k} className={`flow-node ${k}`}>
              <span className={`kind-dot ${k}`} />
              <strong>{kinds[k]}</strong>
              <p>{k === 'dam' ? 'Stocker les eaux de surface' : k === 'groundwater' ? 'Prélever dans les aquifères' : 'Dessaler l’eau de mer'}</p>
            </div>
          ))}
        </div>
        <div className="flow-connector" aria-hidden="true"><ChevronRight size={24} /></div>
        <div className="flow-column">
          <span className="flow-step">Traiter & distribuer</span>
          <div className="flow-node">
            <Droplets size={24} />
            <strong>Eau potable</strong>
            <p>Production, traitement adapté et distribution aux usagers.</p>
          </div>
          <div className="flow-node">
            <UserRound size={24} />
            <strong>Usages du territoire</strong>
            <p>Habitants, activités économiques et services publics.</p>
          </div>
        </div>
        <div className="flow-connector" aria-hidden="true"><ChevronRight size={24} /></div>
        <div className="flow-column">
          <span className="flow-step">Collecter & valoriser</span>
          <div className="flow-node treatment">
            <Waves size={24} />
            <strong>Épuration des eaux usées</strong>
            <p>Collecte, transfert et traitement dans les STEP.</p>
          </div>
          <div className="flow-node reuse">
            <strong>Réutilisation non potable</strong>
            <p>Espaces verts et golfs, après traitement adapté à l’usage.</p>
          </div>
        </div>
      </div>

      <div className="section-heading">
        <h2>Les infrastructures à explorer</h2>
        <button className="text-button" onClick={onSources}>Références<ExternalLink size={14} /></button>
      </div>
      <div className="facility-list">
        {data.facilities.filter(f => f.kind !== 'dam').map(f => (
          <button key={f.id} onClick={() => onSelect(f.id)}>
            <span className={`kind-dot ${f.kind}`} />
            <div>
              <h3>{f.name}</h3>
              <p>{f.description}</p>
              {f.capacityLabel && <small>{f.capacityLabel}</small>}
            </div>
            <ChevronRight size={19} />
          </button>
        ))}
      </div>

      <section className="context-section">
        {data.context.map(c => (
          <article key={c.id}>
            <h3>{c.title}</h3>
            <p>{c.summary}</p>
            <button className="text-button" onClick={onSources}>Voir les références<ChevronRight size={14} /></button>
          </article>
        ))}
      </section>
    </div>
  );
}
