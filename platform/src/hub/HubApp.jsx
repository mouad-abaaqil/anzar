// Racine du hub Anzar : barre haute, état partagé, carte persistante, accueil ou panneau, tiroir Sources, pied de page.
// Accueil : défilement natif du document (la carte reste fixe derrière). Tableau de bord : vue fixe avec une fine barre basse.
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

// Partage robuste : Web Share (écran tactile), sinon presse-papiers (contexte sécurisé), sinon execCommand('copy')
// sur un champ caché, sinon 'manual' (petite fenêtre avec le lien sélectionné). -> 'shared' | 'copied' | 'aborted' | 'manual'
export async function shareLink({ url, title, text }) {
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (coarse && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ url }))) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { return e?.name === 'AbortError' ? 'aborted' : 'manual'; } // geste utilisateur consommé : fenêtre directe
  }
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); return 'copied'; } catch { /* refus ou indisponible : repli */ }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.className = 'hub-copybuf';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, url.length);
    const ok = document.execCommand?.('copy');
    ta.remove();
    if (ok) return 'copied';
  } catch { /* repli suivant */ }
  return 'manual';
}

function ShareBox({ url, onClose }) {
  const ref = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (url && !dlg.open) { try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); } }
    if (!url && dlg.open) dlg.close();
    if (url) requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
  }, [url]);
  return (
    <dialog ref={ref} className="hub-sharebox" aria-labelledby="hub-sharebox-t" onClose={onClose} onCancel={onClose}>
      <h2 id="hub-sharebox-t" className="hub-sharebox__title">Copier le lien</h2>
      <p className="hub-sharebox__text">La copie automatique n’est pas disponible ici. Le lien est sélectionné : copiez-le (Ctrl+C, ⌘C ou appui long).</p>
      <label className="hub-sharebox__label">
        <span>Lien de cette vue</span>
        <input ref={input} type="text" readOnly value={url || ''} onFocus={e => e.target.select()} />
      </label>
      <div className="hub-sharebox__actions"><Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button></div>
    </dialog>
  );
}

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
  // Le tiroir Sources se superpose à la dernière vue (accueil ou exploration).
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
  // Chaque étape allume ou éteint les parcelles agricoles 3D (showFields, si la carte le sait : code gardé).
  const [mapFeatures, setMapFeatures] = useState({ fields: false, globe: false });
  const applyStop = (handle, stop) => {
    handle.flyToStop?.(stop);
    handle.showFields?.(!!stop?.showFields);
  };
  const setMap = useCallback(handle => {
    mapRef.current = handle;
    const caps = { fields: !!handle?.showFields, globe: !!handle?.showGlobe };
    setMapFeatures(f => (f.fields === caps.fields && f.globe === caps.globe ? f : caps));
    if (handle && pendingStop.current) {
      try { applyStop(handle, pendingStop.current); } catch (e) { console.warn('[hub] caméra', e); }
      pendingStop.current = null;
    }
  }, []);
  const flyToStop = useCallback(stop => {
    try {
      if (mapRef.current?.flyToStop) applyStop(mapRef.current, stop); else pendingStop.current = stop;
    } catch (e) { console.warn('[hub] caméra', e); }
  }, []);
  const prevMode = useRef(mode);
  useEffect(() => {
    try {
      if (mode === 'explore') { mapRef.current?.showFields?.(false); mapRef.current?.flyToRegion?.(regionId); }
      else if (prevMode.current === 'explore') mapRef.current?.resetView?.();
    } catch (e) { console.warn('[hub] caméra', e); }
    prevMode.current = mode;
  }, [mode, regionId]);
  // Changement de vue : retour en haut du document, sans animation (la règle scroll-behavior: smooth ne s'applique pas).
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [mode]);

  // Sur l'accueil, « Accueil » ne change pas l'adresse : retour en haut de page.
  const toTopOnStory = e => { if (route.view === 'story') { e.preventDefault(); window.scrollTo({ top: 0 }); } };
  const enter = id => go({ view: 'explore', regionId: id || DEFAULT_REGION_ID, tab: 'today' });
  const selectRegion = id => { if (id && (id !== regionId || mode === 'story')) go({ view: 'explore', regionId: id, tab: mode === 'explore' ? tab : 'today' }); };
  const setTab = next => go({ view: 'explore', regionId, tab: next });
  const closeSources = () => go(last.current.view === 'explore' ? last.current : { view: 'story' });

  useEffect(() => {
    document.title = 'Anzar · L’eau du Maroc';
  }, []);

  // Annonce (lecteurs d'écran) des changements de région et d'onglet ; partage du lien de la vue.
  const [announce, setAnnounce] = useState('');
  const regionName = regionList.find(r => r.id === regionId)?.name;
  const tabLabel = { today: 'Aujourd’hui', tomorrow: 'Demain', together: 'Ensemble' }[tab];
  useEffect(() => {
    setAnnounce(mode === 'explore' && regionName ? regionName + ', onglet ' + tabLabel : mode === 'story' ? 'Accueil' : '');
  }, [mode, regionName, tabLabel]);
  const [toast, setToast] = useState('');
  const [shareBox, setShareBox] = useState(null);
  const toastTimer = useRef(0);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const notify = msg => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  };
  const share = async () => {
    // Adresse canonique de la vue : région et onglet en exploration, accueil sinon.
    const route = mode === 'explore' ? { view: 'explore', regionId, tab } : { view: 'story' };
    const url = window.location.origin + window.location.pathname + window.location.search + hubHash(route);
    const text = mode === 'explore' && regionName ? 'Anzar : ' + regionName + ', onglet ' + tabLabel : 'Anzar : l’eau du Maroc, région par région';
    const res = await shareLink({ url, title: 'Anzar · L’eau du Maroc', text });
    if (res === 'copied') notify('Lien copié.');
    else if (res === 'shared') notify('Lien partagé.');
    else if (res === 'manual') setShareBox(url);
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
        <a className="hub-brand" href="#/" aria-label="Anzar, retour à l’accueil" onClick={toTopOnStory}>
          <img src="/brand/anzar/mark.svg" alt="" width="28" height="28" />
          <span className="hub-brand__name">Anzar</span>
        </a>
        <nav className="hub-nav" aria-label="Navigation principale">
          <a className="hub-nav__link" href="#/" aria-current={mode === 'story' && route.view !== 'sources' ? 'page' : undefined} onClick={toTopOnStory}>Accueil</a>
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
          <Button variant="secondary" size="sm" className="hub-share" onClick={share} icon={<Share2 size={18} />} aria-label={mode === 'explore' ? 'Partager : copier le lien de cette vue (région et onglet)' : 'Partager : copier le lien de la page d’accueil'}><span className="hub-share__label">Partager</span></Button>
        </div>
      </header>

      <div className="hub-live" role="status" aria-live="polite">{announce}</div>
      <div className={'hub-toast' + (toast ? ' is-on' : '')} role="status" aria-live="polite" aria-atomic="true">{toast}</div>
      <ShareBox url={shareBox} onClose={() => setShareBox(null)} />
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
              <Guard name="Accueil"><Suspense fallback={null}><Story data={data} regionId={regionId} onEnter={enter} onShare={share} flyToStop={flyToStop} mapFeatures={mapFeatures} /></Suspense></Guard>
            ) : <Placeholder name="Accueil" />}
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

      {mode === 'explore' && (
        <footer className="hub-foot">
          <p className="hub-foot__note">Prototype indépendant<span className="hub-foot__more"> · pas un portail officiel</span></p>
          <nav className="hub-foot__nav" aria-label="Mentions">
            <a href="#/sources">Sources</a>
            <a href="#/sources" title="Les logos des SRM et des opérateurs sont des marques de leurs titulaires (détail dans Sources et méthode).">Marques</a>
          </nav>
        </footer>
      )}

      <Sheet open={route.view === 'sources'} onClose={closeSources} label="Méthode" title="Sources et méthode">
        {route.view === 'sources' && (
          <div className="hub-sources">
            <SourcesPage
              data={{ sources }}
              weatherPlace={weatherPlace}
              onExport={() => download(JSON.stringify({ sources }, null, 2), 'anzar-sources.json')}
            />
            <Suspense fallback={null}><OpenDataSources data={data} regionId={regionId} /></Suspense>
            <p className="hub-sources__note" id="hub-marques">Anzar est un prototype indépendant issu d’un stage à la RAMSA, pas un portail officiel. Les logos des opérateurs sont des marques de leurs titulaires. Les prévisions et le climat viennent d’Open-Meteo (modélisé, gratuit, usage non commercial).</p>
            <p className="hub-sources__note">Pages annexes, hors parcours principal : <a href="#/app/quality">qualité de l’eau</a> · <a href="#/app/cycle">cycle de l’eau</a> (Souss-Massa). {STATIC_BUILD ? SERVER_ONLY_NOTICE + '.' : ''}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
