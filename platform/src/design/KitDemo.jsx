// Temporary demo of the Anzar kit at #/kit (wired in src/main.jsx). Values are examples, not data.
import { useEffect, useState } from 'react';
import './KitDemo.css';
import { useRegionsData } from '../lib/regions.js';
import {
  Button, MicroLabel, Panel, ProvenanceChip, Stat, Tabs, RegionSwitcher, Slider, Legend,
  ToastProvider, useToast, Sheet,
} from './index.js';

function Demo() {
  const toast = useToast();
  const { status, value } = useRegionsData();
  const regions = value?.doc?.regions || [];
  const [region, setRegion] = useState('souss-massa');
  const [tab, setTab] = useState('reserve');
  const [rain, setRain] = useState(0);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    // The legacy :root background is light; paint the page behind the demo with the token.
    // The legacy :root also sets 14 px; the kit is sized for the browser default (100 %, usually 16 px).
    const html = document.documentElement.style;
    const body = document.body.style;
    const prev = [html.background, html.fontSize, body.margin];
    html.background = 'var(--az-bg)';
    html.fontSize = '100%';
    body.margin = '0';
    document.title = 'Kit Anzar';
    return () => { [html.background, html.fontSize, body.margin] = prev; };
  }, []);

  return (
    <div className="az-root kit">
      <header className="az-container kit-top">
        <div className="az-row">
          <img src="/brand/anzar/mark.svg" alt="" width="28" height="28" />
          <span className="kit-word">Anzar</span>
        </div>
        <MicroLabel tone="faint">Kit de design · page temporaire</MicroLabel>
      </header>

      <section className="az-deep kit-deep">
       <div className="az-container kit-hero">
        <MicroLabel tone="accent">L’eau du Maroc · 12 régions</MicroLabel>
        <h1 className="az-hero">Combien de mois<br />d’eau <span className="az-accent kit-nowrap">reste-t-il ?</span></h1>
        <p className="az-lead">Barrages, pluie, dessalement. Région par région.</p>
        <div className="az-row">
          <Button size="lg">Voir ma région</Button>
          <Button variant="secondary" size="lg">Comparer</Button>
        </div>
        <MicroLabel tone="faint" className="kit-scroll">Section « profondeur » (.az-deep) · défiler pour explorer</MicroLabel>
       </div>
       <svg className="az-wave" aria-hidden="true" focusable="false" viewBox="0 0 1440 48" preserveAspectRatio="none">
         <path fill="currentColor" d="M0 30C180 8 360 8 540 26S900 48 1080 30 1320 10 1440 22V48H0Z" />
       </svg>
      </section>

      <main className="az-container kit-body">
        <div className="kit-section">
          <MicroLabel>01 · Statistiques (valeurs d’exemple)</MicroLabel>
          <div className="kit-stats">
            <Stat value="4,2" unit="mois" label="de réserve" band="critique" provenance={{ status: 'derived', source: 'Calcul Anzar (exemple)', date: 'exemple', note: 'Stock ÷ demande mensuelle.' }} />
            <Stat value="11" unit="mois" label="de réserve" band="tendu" provenance={{ status: 'hypothese', note: 'Seuil choisi, non mesuré.' }} />
            <Stat value="27" unit="mois" label="de réserve" band="confortable" provenance={{ status: 'sourced', source: 'Bulletin public (exemple)', date: '23 nov. 2026' }} />
            <Stat value="38" unit="%" label="remplissage" provenance={{ status: 'sourced', source: 'Bulletin public (exemple)', url: 'https://example.org', date: '23 nov. 2026' }} />
          </div>
        </div>

        <div className="kit-cols">
          <Panel label="02 · Région" title="Sélecteur de SRM">
            <div className="az-stack">
              {status === 'error' ? <p className="az-text">Régions indisponibles.</p> : (
                <RegionSwitcher regions={regions} value={region} onChange={id => { setRegion(id); toast(`Région : ${regions.find(r => r.id === id)?.name}`); }} />
              )}
              <p className="az-text">Logos : marques de leurs titulaires.</p>
            </div>
          </Panel>

          <Panel label="03 · Scénario" title="Pluie de l’année" actions={<ProvenanceChip status="hypothese" note="Curseur d’exemple." />}>
            <div className="az-stack">
              <Slider label="Écart à la normale" value={rain} min={-50} max={50} step={5} onChange={setRain} format={v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} %`} minLabel="Année sèche" maxLabel="Année humide" />
              <Slider label="Désactivé" value={20} min={0} max={100} onChange={() => {}} format={v => `${v} %`} disabled />
            </div>
          </Panel>
        </div>

        <Panel label="04 · Onglets">
          <Tabs label="Vues" value={tab} onChange={setTab} tabs={[{ id: 'reserve', label: 'Réserve' }, { id: 'pluie', label: 'Pluie' }, { id: 'dessalement', label: 'Dessalement' }]}>
            {tab === 'reserve' && <Legend title="Mois de réserve" showHints />}
            {tab === 'pluie' && <p className="az-text">Pluie modélisée, pas un relevé.</p>}
            {tab === 'dessalement' && <Legend kind="flux" title="Sahara · dessalement ÷ demande potable" />}
          </Tabs>
        </Panel>

        <div className="kit-cols">
          <Panel label="05 · Boutons">
            <div className="az-row">
              <Button>Principal</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button variant="ghost">Discret</Button>
              <Button disabled>Indisponible</Button>
            </div>
          </Panel>
          <Panel label="06 · Retours">
            <div className="az-row">
              <Button variant="secondary" onClick={() => toast('Données mises à jour.')}>Message</Button>
              <Button variant="secondary" onClick={() => setSheet(true)}>Ouvrir le panneau</Button>
            </div>
          </Panel>
        </div>

        <div className="kit-section">
          <MicroLabel>07 · Typographie</MicroLabel>
          <p className="az-h1">Titre condensé</p>
          <p className="az-h2">Sous-titre</p>
          <p className="az-h3">Titre de panneau</p>
          <p className="az-text">Texte courant : une phrase, une idée. Les détails viennent au toucher.</p>
          <MicroLabel tone="ochre">Micro-label ocre (éditorial)</MicroLabel>
          <div className="az-row">
            <Button variant="accent">Bleu SRM</Button>
            <MicroLabel tone="accent">Accent bleu SRM · action jaune · confortable vert</MicroLabel>
          </div>
        </div>
      </main>

      <footer className="az-container kit-foot">
        <MicroLabel tone="faint">Prototype indépendant, issu d’un stage à la RAMSA · pas un portail officiel</MicroLabel>
      </footer>

      <Sheet open={sheet} onClose={() => setSheet(false)} label="Barrage · exemple" title="Détail d’un site">
        <div className="az-stack">
          <Stat value="61" unit="Mm³" label="stock" provenance={{ status: 'sourced', source: 'Bulletin public (exemple)', date: '23 nov. 2026' }} />
          <p className="az-text">Le panneau passe en bas de l’écran sur mobile.</p>
          <Button variant="secondary" onClick={() => setSheet(false)}>Fermer</Button>
        </div>
      </Sheet>
    </div>
  );
}

export default function KitDemo() {
  return <ToastProvider><Demo /></ToastProvider>;
}
