// Racine du hub Anzar : barre haute, état partagé, carte persistante, récit ou panneau, tiroir Sources.
// Contrat : docs/HUB_CONTRACT.md. Les modules des autres agents sont chargés si présents (import.meta.glob),
// sinon un espace réservé s'affiche : l'application ne casse jamais faute d'un fichier.
import { Component, Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button, MicroLabel, RegionSwitcher, Sheet } from '../design/index.js';
import { download } from '../lib/format.js';
import { regionPoint } from '../lib/openData.js';
import SourcesPage from '../pages/SourcesPage.jsx';
import { useHubData } from './data.js';
import { DEFAULT_REGION_ID, hubHash } from './routes.js';
import { SERVER_ONLY_NOTICE, STATIC_BUILD } from './panel/serverApi.js';
import './hub.css';

const modules = import.meta.glob(['./HubMap.jsx', './Story.jsx', './panel/PanelShell.jsx']);
const metricsModule = Object.values(import.meta.glob('./panel/metrics.js', { eager: true }))[0] || null;
const lazyModule = key => (modules[key] ? lazy(modules[key]) : null);
const HubMap = lazyModule('./HubMap.jsx');
const Story = lazyModule('./Story.jsx');
const PanelShell = lazyModule('./panel/PanelShell.jsx');
const OpenDataSources = lazy(() => import('./panel/ExtraBlocks.jsx').then(m => ({ default: m.OpenDataSources })));

const FALLBACK_SCENARIO = { hydrology: 'normal', popGrowth: null, demandReductionPct: 0, addedDesalMm3: 0, reusePct: 0, rainChangePct: null, year: 2035 };
const focusTarget = id => e => { e.preventDefault(); document.getElementById(id)?.focus(); };
const go = route => { window.location.hash = hubHash(route); };

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[hub]', this.props.name, error); }
  render() {
    return this.state.failed ? <Placeholder name={this.props.name} note="Ce module a rencontré une erreur." /> : this.props.children;
  }
}

function Placeholder({ name, note = 'En cours d’intégration.' }) {
  return (
    <div className="hub-ph" role="status">
      <MicroLabel>{name}</MicroLabel>
      <p>{note}</p>
    </div>
  );
}

export default function HubApp({ route }) {
  const data = useHubData();
  const mapRef = useRef(null);
  const pendingStop = useRef(null);
  // Le tiroir Sources se superpose à la dernière vue (récit ou exploration).
  const last = useRef({ view: 'story', regionId: DEFAULT_REGION_ID, tab: 'today' });
  if (route.view === 'explore') last.current = route;
  else if (route.view === 'story') last.current = { ...last.current, view: 'story' };
  const view = route.view === 'sources' ? last.current : route;
  const mode = view.view === 'explore' ? 'explore' : 'story';
  const tab = view.tab || 'today';
  const regionList = data.status === 'ready' ? data.regions.regions || [] : [];
  const knownRegion = id => regionList.some(r => r.id === id);
  const regionId = mode === 'explore' ? view.regionId : (last.current.regionId || DEFAULT_REGION_ID);

  // Région inconnue dans l'adresse : retour à la région par défaut.
  useEffect(() => {
    if (data.status === 'ready' && mode === 'explore' && !knownRegion(regionId)) {
      window.history.replaceState(null, '', hubHash({ view: 'explore', regionId: DEFAULT_REGION_ID, tab }));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, [data.status, mode, regionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scénario partagé, remis aux valeurs par défaut de la région à chaque changement de région.
  const [scenarioState, setScenario] = useState(null);
  useEffect(() => { setScenario(null); }, [regionId]);
  const defaultScenario = useMemo(() => {
    if (data.status !== 'ready') return FALLBACK_SCENARIO;
    try { return metricsModule?.defaultScenario?.(data, regionId) || FALLBACK_SCENARIO; } catch { return FALLBACK_SCENARIO; }
  }, [data, regionId]);
  const scenario = scenarioState || defaultScenario;

  // Curseurs : la carte (couleurs par région) suit avec un léger retard, le panneau reste immédiat.
  const mapScenario = useDeferredValue(scenario);
  const metricByRegion = useMemo(() => {
    if (data.status !== 'ready' || !metricsModule?.computeMetricByRegion) return {};
    try { return metricsModule.computeMetricByRegion({ data, scenario: mapScenario, tab: mode === 'story' ? 'today' : tab }) || {}; } catch { return {}; }
  }, [data, mapScenario, tab, mode]);

  const layers = useMemo(() => {
    if (mode === 'story') return { dams: true, links: false };
    if (tab === 'together') return { dams: false, links: true };
    if (tab === 'tomorrow') return { dams: false, links: false };
    return { dams: true, links: false };
  }, [mode, tab]);

  // Caméra : handle impératif de la carte, appel différé si la carte n'est pas encore montée.
  const setMap = useCallback(handle => {
    mapRef.current = handle;
    if (handle && pendingStop.current) {
      try { handle.flyToStop?.(pendingStop.current); } catch (e) { console.warn('[hub] caméra', e); }
      pendingStop.current = null;
    }
  }, []);
  const flyToStop = useCallback(stop => {
    try {
      if (mapRef.current?.flyToStop) mapRef.current.flyToStop(stop); else pendingStop.current = stop;
    } catch (e) { console.warn('[hub] caméra', e); }
  }, []);
  const prevMode = useRef(mode);
  useEffect(() => {
    try {
      if (mode === 'explore') mapRef.current?.flyToRegion?.(regionId);
      else if (prevMode.current === 'explore') mapRef.current?.resetView?.();
    } catch (e) { console.warn('[hub] caméra', e); }
    prevMode.current = mode;
  }, [mode, regionId]);

  const enter = id => go({ view: 'explore', regionId: id || DEFAULT_REGION_ID, tab: 'today' });
  const selectRegion = id => { if (id && (id !== regionId || mode === 'story')) go({ view: 'explore', regionId: id, tab: mode === 'explore' ? tab : 'today' }); };
  const setTab = next => go({ view: 'explore', regionId, tab: next });
  const closeSources = () => go(last.current.view === 'explore' ? last.current : { view: 'story' });

  useEffect(() => {
    document.title = 'Anzar · L’eau du Maroc';
  }, []);

  // Annonce (lecteurs d'écran) des changements de région et d'onglet ; copie du lien de la vue.
  const [announce, setAnnounce] = useState('');
  const regionName = regionList.find(r => r.id === regionId)?.name;
  const tabLabel = { today: 'Aujourd’hui', tomorrow: 'Demain', together: 'Ensemble' }[tab];
  useEffect(() => {
    setAnnounce(mode === 'explore' && regionName ? regionName + ', onglet ' + tabLabel : mode === 'story' ? 'Récit' : '');
  }, [mode, regionName, tabLabel]);
  const [copied, setCopied] = useState('');
  const share = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); setCopied('Lien copié.'); }
    catch { setCopied('Copie impossible : copiez l’adresse du navigateur.'); }
    setTimeout(() => setCopied(''), 3500);
  };

  const sources = data.status === 'ready' ? data.region?.sources || [] : [];
  // Lieu de la météo modélisée : Agadir pour Souss-Massa (point de référence), sinon le centre de la région active.
  const weatherPlace = (() => {
    if (data.status !== 'ready') return regionName || '';
    const p = regionPoint(regionId, data.geo);
    if (!p) return regionName || '';
    return p.kind === 'reference' ? p.name : (regionName || p.name) + ' (centre de la région)';
  })();

  return (
    <div className="hub" data-mode={mode}>
      {/* Liens d'évitement : href gardé pour les lecteurs d'écran, mais le focus est déplacé à la main (l'adresse # est le routeur). */}
      <a className="hub-skip" href="#hub-main" onClick={focusTarget('hub-main')}>Aller au contenu</a>
      {mode === 'explore' && <a className="hub-skip" href="#hub-panel" onClick={focusTarget('hub-panel')}>Aller au panneau</a>}
      {mode === 'explore' && <a className="hub-skip" href="#hub-map" onClick={focusTarget('hub-map')}>Aller à la carte</a>}
      <header className="hub-bar">
        <a className="hub-brand" href="#/" aria-label="Anzar, retour au récit">
          <img src="/brand/anzar/mark.svg" alt="" width="28" height="28" />
          <span className="hub-brand__name">Anzar</span>
        </a>
        <nav className="hub-nav" aria-label="Navigation principale">
          <a className="hub-nav__link" href="#/" aria-current={mode === 'story' && route.view !== 'sources' ? 'page' : undefined}>Récit</a>
          <a className="hub-nav__link" href={hubHash({ view: 'explore', regionId, tab })} aria-current={mode === 'explore' && route.view !== 'sources' ? 'page' : undefined}><span className="hub-nav__long">Tableau de bord</span><span className="hub-nav__short" aria-hidden="true">Tableau</span></a>
          <a className="hub-nav__link" href="#/sources" aria-current={route.view === 'sources' ? 'page' : undefined}>Sources</a>
        </nav>
        <div className="hub-bar__actions">
          {regionList.length > 0 && mode !== 'explore' && (
            <div className="hub-bar__region">
              <RegionSwitcher regions={regionList} value={regionId} onChange={selectRegion} />
            </div>
          )}
          {mode === 'explore' && regionName && <span className="hub-bar__active" title="Région active">{regionName}</span>}
          {mode === 'explore' && <Button variant="secondary" size="sm" onClick={share} icon={<Share2 size={18} />} aria-label="Partager : copier le lien de cette vue (région et onglet)"><span className="hub-share__label">Partager</span></Button>}
        </div>
      </header>

      <div className="hub-live" role="status" aria-live="polite">{copied || announce}</div>
      <main id="hub-main" className="hub-stage" tabIndex={-1}>
        <div className="hub-mapwrap">
          {HubMap ? (
            <Guard name="Carte">
              <Suspense fallback={<Placeholder name="Carte" note="Chargement." />}>
                <HubMap
                  ref={setMap}
                  regionId={regionId}
                  onSelectRegion={mode === 'explore' ? selectRegion : undefined}
                  metricByRegion={metricByRegion}
                  legend={{ title: mode === 'explore' && tab === 'tomorrow' ? `Mois de réserve en ${mapScenario.year}` : 'Mois de réserve' }}
                  layers={layers}
                  mode={mode}
                  storyStop={null}
                />
              </Suspense>
            </Guard>
          ) : <Placeholder name="Carte" />}
        </div>

        {data.status === 'loading' && <div className="hub-state" role="status"><MicroLabel>Chargement des données</MicroLabel></div>}
        {data.status === 'error' && (
          <div className="hub-state" role="alert">
            <MicroLabel>Données indisponibles</MicroLabel>
            <p>Les données publiques n’ont pas pu être chargées.</p>
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </div>
        )}

        {data.status === 'ready' && mode === 'story' && (
          <div className="hub-layer hub-layer--story">
            {Story ? (
              <Guard name="Récit"><Suspense fallback={null}><Story data={data} regionId={regionId} onEnter={enter} flyToStop={flyToStop} /></Suspense></Guard>
            ) : <Placeholder name="Récit" />}
          </div>
        )}
        {data.status === 'ready' && mode === 'explore' && (
          <div className="hub-layer hub-layer--panel">
            {PanelShell ? (
              <Guard name="Panneau">
                <Suspense fallback={null}>
                  <PanelShell data={data} regionId={regionId} onSelectRegion={selectRegion} tab={tab} onTab={setTab} scenario={scenario} onScenario={setScenario} />
                </Suspense>
              </Guard>
            ) : <Placeholder name="Panneau" />}
          </div>
        )}
      </main>

      <Sheet open={route.view === 'sources'} onClose={closeSources} label="Méthode" title="Sources et méthode">
        {route.view === 'sources' && (
          <div className="hub-sources">
            <SourcesPage
              data={{ sources }}
              weatherPlace={weatherPlace}
              onExport={() => download(JSON.stringify({ sources }, null, 2), 'anzar-sources.json')}
            />
            <Suspense fallback={null}><OpenDataSources data={data} regionId={regionId} /></Suspense>
            <p className="hub-sources__note">Anzar est un prototype indépendant issu d’un stage à la RAMSA, pas un portail officiel. Les logos des opérateurs sont des marques de leurs titulaires. Les prévisions et le climat viennent d’Open-Meteo (modélisé, gratuit, usage non commercial).</p>
            <p className="hub-sources__note">Pages annexes, hors parcours principal : <a href="#/app/quality">qualité de l’eau</a> · <a href="#/app/cycle">cycle de l’eau</a> (Souss-Massa). {STATIC_BUILD ? SERVER_ONLY_NOTICE + '.' : ''}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
