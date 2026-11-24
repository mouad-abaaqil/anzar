import { Suspense, lazy, useMemo, useState } from 'react';
import { Button, RegionSwitcher, Sheet, Tabs } from '../../design';
import { defaultScenario, regionModel } from './metrics.js';
import TodayTab from './TodayTab.jsx';
const TomorrowTab = lazy(() => import('./TomorrowTab.jsx'));
const TogetherTab = lazy(() => import('./TogetherTab.jsx'));
import './panel.css';

export const PANEL_TABS = [
  { id: 'today', label: 'Aujourd’hui' },
  { id: 'tomorrow', label: 'Demain' },
  { id: 'together', label: 'Ensemble' },
];

/**
 * Panneau à 3 onglets. Par défaut, un panneau « posé » qui remplit son conteneur (la carte reste cliquable) ;
 * avec sheet + open + onClose il s'affiche dans le Sheet du kit (dialog modal : à réserver au mobile).
 * data = useHubData() prêt. scenario / onScenario : état de HubApp (sinon scénario par défaut, non modifiable).
 */
const SEEN_KEY = 'anzar-panel-intro';
const seen = () => { try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };

export default function PanelShell({ data, regionId, onSelectRegion, tab = 'today', onTab, scenario, onScenario, sheet = false, open = true, onClose }) {
  const ready = data?.status === 'ready' || (data?.balance && data?.bulletin);
  // Un scénario resté sur une autre région (un rendu de retard au changement) est ignoré.
  const sc = useMemo(() => (scenario && scenario.regionId === regionId ? scenario : ready ? defaultScenario(data, regionId) : null), [scenario, ready, data, regionId]);
  const model = useMemo(() => (ready ? regionModel(data, regionId, sc) : null), [ready, data, regionId, sc]);
  const [intro, setIntro] = useState(() => !seen());
  const dismissIntro = () => { setIntro(false); try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* stockage indisponible */ } };
  const active = PANEL_TABS.some(t => t.id === tab) ? tab : 'today';

  const body = !ready ? (
    <p className="pn-note" role="status">{data?.status === 'error' ? 'Données indisponibles. Rien n’est estimé à leur place.' : 'Chargement…'}</p>
  ) : (
    <Tabs tabs={PANEL_TABS} value={active} onChange={onTab} label="Lecture de la région">
      {active === 'today' && <TodayTab data={data} regionId={regionId} model={model} />}
      <Suspense fallback={<p className="pn-note" role="status">Chargement…</p>}>
      {active === 'tomorrow' && <TomorrowTab data={data} regionId={regionId} model={model} scenario={sc} onScenario={onScenario} />}
      {active === 'together' && <TogetherTab data={data} regionId={regionId} model={model} scenario={sc} onSelectRegion={onSelectRegion} />}
      </Suspense>
    </Tabs>
  );
  const switcher = ready && (
    <div className="pn-switch"><RegionSwitcher regions={data.regions?.regions ?? []} value={regionId} onChange={onSelectRegion} /></div>
  );
  const prompt = ready && intro && (
    <div className="pn-intro" role="note">
      <p>Cliquez une région sur la carte ou changez de région ici, puis essayez Demain.</p>
      <Button variant="ghost" size="sm" onClick={dismissIntro}>Compris</Button>
    </div>
  );
  const about = (
    <footer className="pn-about">
      Prototype indépendant issu d’un stage à la RAMSA, pas un portail officiel. Logos des SRM : marques de leurs titulaires. Météo et climat : Open-Meteo, gratuit, usage non commercial. <a href="#/sources">Sources et licences</a>.
    </footer>
  );

  if (sheet) {
    return (
      <Sheet open={open} onClose={onClose ?? (() => {})} label="Anzar · prototype indépendant" title="Eau de la région">
        {switcher}{prompt}{body}{about}
      </Sheet>
    );
  }
  return (
    <aside id="hub-panel" className="pn-shell" aria-label="Panneau de la région" tabIndex={-1}>
      <div className="pn-shell__head">{switcher}{prompt}</div>
      <div className="pn-shell__body">{body}{about}</div>
    </aside>
  );
}
