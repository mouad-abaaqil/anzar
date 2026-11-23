import { useEffect, useRef, useState } from 'react';
import HeroTerrain from '../components/HeroTerrain.jsx';
import { date, number } from '../lib/format.js';
import './landing.css';

const SOURCES = [
  ['Bulletin des barrages', 'Ministère de l’Équipement et de l’Eau, bulletin quotidien (instantané daté)'],
  ['Pluie', 'Open-Meteo / ERA5, modélisée (CC BY 4.0, usage non commercial)'],
  ['Satellite', 'Copernicus Sentinel-2, surface d’eau estimée'],
  ['Limites des régions', 'HCP / OCHA COD-AB (CC BY-IGO)'],
  ['Relief', 'Mapterhorn'],
  ['Données cartographiques', 'OpenStreetMap (ODbL)'],
];

const KNOWLEDGE = [
  { tag: 'Mesuré', tone: 'sand', text: 'Remplissage et stock des barrages tels que publiés dans le bulletin officiel, avec leur date. Ce n’est pas un relevé en direct.' },
  { tag: 'Modélisé', tone: 'cyan', text: 'Pluie des modèles météorologiques (ERA5, Open-Meteo). Elle surestime en moyenne sur certaines stations : la correction n’est validée qu’en un point.' },
  { tag: 'Estimé', tone: 'coral', text: 'Surface d’eau vue par satellite et mois de couverture par région : des ordres de grandeur dont les hypothèses restent visibles. Les eaux souterraines ne sont pas modélisées.' },
];

function useBulletin() {
  const [state, setState] = useState({ data: null, failed: false });
  useEffect(() => {
    let off = false;
    fetch('/data/national-bulletin.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (!off) setState({ data: d, failed: false }); })
      .catch(() => { if (!off) setState({ data: null, failed: true }); });
    return () => { off = true; };
  }, []);
  return state;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}

function Mark({ className }) {
  return (
    <svg className={className} viewBox="0 0 128 128" aria-hidden="true">
      <path fill="none" stroke="#5FD4E6" strokeWidth="10" strokeLinecap="round" d="M20 76A47 47 0 1 1 108 76" />
      <path fill="#D9A441" d="M26 84L47 57L62 73L75 60L101 84H84L75 76L62 88L48 73L40 84Z" />
      <path fill="#5FD4E6" d="M18 88H110V98H18ZM43 108H85V118H43Z" />
    </svg>
  );
}

export default function Landing() {
  const { data: bulletin, failed } = useBulletin();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const refs = useRef([]);

  useEffect(() => {
    document.title = 'Anzar — Observatoire de l’eau du Maroc';
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setStage(Number(e.target.dataset.stage)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach(n => n && io.observe(n));
    return () => io.disconnect();
  }, []);

  const nat = bulletin?.national;
  const basins = bulletin ? [...bulletin.basins].sort((a, b) => b.fillPct - a.fillPct) : [];
  const souss = bulletin?.basins.find(b => b.name === 'Souss-Massa');
  const stageRef = i => n => { refs.current[i] = n; };

  return (
    <div className="anz">
      <HeroTerrain stage={stage} reduced={reduced} />

      <header className="anz-top">
        <a className="anz-brand" href="#/" aria-label="Anzar, accueil"><Mark className="anz-mark" /><span>Anzar</span></a>
        <nav aria-label="Navigation">
          <a href="#/app/overview">Observatoire</a>
          <a href="#/app/balance">Scénarios</a>
        </nav>
      </header>

      <main className="anz-main">
        <section className="anz-sec anz-hero" data-stage="0" ref={stageRef(0)}>
          <h1>Anzar</h1>
          <p className="anz-tag">L’eau du Maroc, relief par relief.</p>
          <p className="anz-lead">Barrages, pluie, satellite et besoins des régions sur un seul relief 3D, pour voir où l’eau manque et ce que changent les choix.</p>
          <div className="anz-cta">
            <a className="anz-btn anz-btn-main" href="#/app/balance">Ouvrir l’observatoire</a>
            <a className="anz-btn" href="#/app/balance">Simuler un scénario</a>
          </div>
          <dl className="anz-figures" aria-live="polite">
            {nat ? (<>
              <div><dt>Remplissage national</dt><dd>{number(nat.fillPct, 2)} %</dd></div>
              <div><dt>Même jour en 2025</dt><dd>{number(nat.sameDay2025Pct, 2)} %</dd></div>
              <div><dt>Stock des barrages</dt><dd>{number(nat.storedMm3, 0)} <small>Mm³ sur {number(nat.capacityMm3, 0)}</small></dd></div>
            </>) : (
              <div className="anz-wide"><dt>Bulletin des barrages</dt><dd className="anz-dim">{failed ? 'Indisponible pour le moment.' : 'Chargement…'}</dd></div>
            )}
          </dl>
          {bulletin && <p className="anz-asof">Bulletin du {date(bulletin.date)}. Instantané public, pas un relevé en direct.</p>}
        </section>

        <section className="anz-sec" data-stage="0" ref={stageRef(1)} aria-labelledby="anz-s1">
          <p className="anz-step">1 · Observer</p>
          <h2 id="anz-s1">Neuf bassins, un même jour</h2>
          <p>Le stock publié, bassin par bassin, comparé au même jour de l’an dernier. La tendance se lit d’un coup d’œil ; le détail par barrage reste dans l’observatoire.</p>
          {basins.length > 0 && (
            <ul className="anz-basins">
              {basins.map(b => (
                <li key={b.name}>
                  <span className="anz-bn">{b.name}</span>
                  <span className="anz-bar" role="img" aria-label={`${b.name} : ${number(b.fillPct, 1)} % cette année, ${number(b.sameDay2025Pct, 1)} % l’an dernier`}>
                    <i style={{ width: b.fillPct + '%' }} />
                    <b style={{ left: b.sameDay2025Pct + '%' }} />
                  </span>
                  <span className="anz-bv">{number(b.fillPct, 0)} %</span>
                </li>
              ))}
            </ul>
          )}
          <p className="anz-legend"><i className="anz-k-fill" /> cette année <i className="anz-k-tick" /> même jour 2025</p>
        </section>

        <section className="anz-sec" data-stage="1" ref={stageRef(2)} aria-labelledby="anz-s2">
          <p className="anz-step">2 · Comprendre</p>
          <h2 id="anz-s2">Le Sud a moins de marge</h2>
          <p>Chaque région a ses habitants, son agriculture, son industrie et son accès à la mer. Anzar les met en regard du stock de surface pour estimer des <strong>mois de couverture</strong>, avec des hypothèses affichées, pas des relevés.</p>
          {souss && <p className="anz-note">Exemple publié : bassin Souss-Massa à {number(souss.fillPct, 1)} % ({number(souss.storedMm3, 0)} sur {number(souss.capacityMm3, 0)} Mm³), contre {number(souss.sameDay2025Pct, 1)} % l’an dernier.</p>}
          <p>Pour les régions en tension, l’outil montre des <strong>leviers</strong> (dessalement, réutilisation, économies, projets documentés). Il ne trace aucune conduite et ne chiffre aucun transfert d’eau entre régions.</p>
        </section>

        <section className="anz-sec" data-stage="2" ref={stageRef(3)} aria-labelledby="anz-s3">
          <p className="anz-step">3 · Simuler</p>
          <h2 id="anz-s3">Et si les prochaines années étaient sèches ?</h2>
          <p>Choisissez une hydrologie (sèche, normale, humide), une croissance démographique, un effort d’économie ou un dessalement en plus, puis regardez la couverture évoluer sur dix ans.</p>
          <p className="anz-note">Un scénario n’est pas une prévision : les hypothèses restent visibles et modifiables.</p>
          <div className="anz-cta">
            <a className="anz-btn anz-btn-main" href="#/app/balance">Lancer une simulation</a>
            <a className="anz-btn" href="#/app/overview">Explorer la carte</a>
          </div>
        </section>

        <section className="anz-sec anz-light" aria-labelledby="anz-s4">
          <h2 id="anz-s4">Honnêteté des données</h2>
          <p>Chaque chiffre dit d’où il vient. Trois statuts, jamais mélangés.</p>
          <div className="anz-know">
            {KNOWLEDGE.map(k => (
              <article key={k.tag} className={'anz-card anz-' + k.tone}>
                <h3>{k.tag}</h3>
                <p>{k.text}</p>
              </article>
            ))}
          </div>
          <p className="anz-fine">Non disponible faute de source ouverte : stock par quartier alimenté, stock mort, historique par barrage.</p>
        </section>

        <section className="anz-sec anz-light anz-sources" aria-labelledby="anz-s5">
          <h2 id="anz-s5">Sources</h2>
          <ul>
            {SOURCES.map(([n, d]) => <li key={n}><strong>{n}</strong><span>{d}</span></li>)}
          </ul>
        </section>
      </main>

      <footer className="anz-foot">
        <p><strong>Prototype indépendant, issu d’un stage à la RAMSA. Ce n’est pas un portail officiel.</strong></p>
        <p>Les noms et logos de la SRM-SM et des autres opérateurs sont des marques de leurs titulaires.</p>
        <p><a href="#/app/sources">Sources et licences</a> · <a href="#/app/overview">Vue Souss-Massa (SRM-SM)</a></p>
      </footer>
    </div>
  );
}
