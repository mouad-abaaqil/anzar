import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Database } from 'lucide-react';
import AuthDialog from './components/AuthDialog.jsx';
import PageHeading from './components/PageHeading.jsx';
import { RegionMapPage, RegionOverview, ScopeNotice } from './components/RegionOverview.jsx';
import { NavScrim, SearchPalette, Sidebar, Toast, Topbar } from './components/Shell.jsx';
import { kinds, nav } from './lib/constants.js';
import { download } from './lib/format.js';
import { DEFAULT_REGION_ID, canonicalHash, parseRoute, useRegionsData } from './lib/regions.js';
import CyclePage from './pages/CyclePage.jsx';
import Landing from './pages/Landing.jsx';
import MapPage from './pages/MapPage.jsx';
import { OverviewMetrics, OverviewSections } from './pages/Overview.jsx';
import QualityPage from './pages/QualityPage.jsx';
import SourcesPage from './pages/SourcesPage.jsx';

const RegionsPage = lazy(() => import('./pages/RegionsPage.jsx'));
const ForecastPage = lazy(() => import('./pages/ForecastPage.jsx'));
const BalancePage = lazy(() => import('./pages/BalancePage.jsx'));

function getTodayWeather(weather) {
  const daily = weather?.daily || weather?.data?.daily;
  if (!daily?.time) return null;
  const today = new Date().toLocaleDateString('en-CA');
  let i = daily.time.indexOf(today);
  if (i < 0) i = daily.time.length - 1;
  return { date: daily.time[i], temp: daily.temperature_2m_max?.[i], rain: daily.precipitation_sum?.[i] };
}

const pageIds = nav.map(n => n.id);

const parseHash = hash => parseRoute(hash, pageIds);

function readRoute() {
  const route = parseHash(window.location.hash);
  if (window.location.hash !== canonicalHash(route)) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash(route)}`);
  }
  return route;
}

function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const refresh = () => setRoute(readRoute());
  return [route, refresh];
}

export default function App() {
  const [route, refreshRoute] = useHashRoute();
  const regionId = route.regionId || DEFAULT_REGION_ID;
  // Selecting a region keeps the current page; the hash is the single source of truth.
  const selectRegion = id => {
    window.location.hash = canonicalHash({ view: 'app', page: route.page, regionId: id });
  };
  // Unknown region id: fall back to the default region and normalise the hash.
  const normalizeRegion = () => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash({ view: 'app', page: route.page, regionId: null })}`);
    refreshRoute();
  };
  if (route.view === 'landing') return <Landing />;
  return <Workspace page={route.page} regionId={regionId} onSelectRegion={selectRegion} onUnknownRegion={normalizeRegion} />;
}

function Workspace({ page, regionId, onSelectRegion, onUnknownRegion }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [visibleKinds, setVisibleKinds] = useState(Object.keys(kinds));
  const [terrain, setTerrain] = useState(true);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const regionsState = useRegionsData();
  const regionsDoc = regionsState.value?.doc;
  const regionList = regionsDoc?.regions || [];
  const activeRegionId = regionList.some(r => r.id === regionId) ? regionId : DEFAULT_REGION_ID;
  const regionsReady = regionsState.status === 'ready';
  useEffect(() => {
    if (regionsReady && regionId !== activeRegionId) onUnknownRegion();
  }, [regionsReady, regionId, activeRegionId]);
  const isOtherRegion = activeRegionId !== DEFAULT_REGION_ID;
  const activeRegion = isOtherRegion ? regionList.find(r => r.id === activeRegionId) : null;
  // A non-default region in the hash stays on the default view until regions.json confirms it exists.
  const regionView = regionId !== DEFAULT_REGION_ID && (isOtherRegion || !regionsReady) && (page === 'overview' || page === 'map');

  const facilities = data?.facilities || [];
  const selected = facilities.find(f => f.id === selectedId) || facilities[0];
  const dams = facilities.filter(f => f.kind === 'dam');
  const todayWeather = getTodayWeather(weather);
  const matches = useMemo(() => facilities.filter(f => f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [facilities, query]);

  const navigate = (id) => { window.location.hash = canonicalHash({ view: 'app', page: id, regionId: activeRegionId }); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const notify = (message) => setToast(typeof message === 'string' ? message : 'Enregistré');
  const load = () => {
    setLoadError('');
    fetch('/data/region.json')
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { setData(d); setSelectedId(d.facilities.find(f => /abdelmou/i.test(f.name))?.id || d.facilities[0]?.id); })
      .catch(() => setLoadError('Les données régionales ne sont pas disponibles. Réessayez dans quelques instants.'));
  };
  const loadWeather = () => {
    setWeatherLoading(true);
    setWeatherError(false);
    fetch('/api/weather')
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(setWeather)
      .catch(() => setWeatherError(true))
      .finally(() => setWeatherLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(r => setUser(r?.user || null)).catch(() => {});
  }, []);
  useEffect(loadWeather, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
      if (e.key === 'Escape') { setSearchOpen(false); setAuthOpen(false); setMobileNav(false); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const selectSite = id => {
    setSelectedId(id);
    window.location.hash = canonicalHash({ view: 'app', page: 'map', regionId: null });
    setSearchOpen(false);
    const f = facilities.find(f => f.id === id);
    if (f && !visibleKinds.includes(f.kind)) setVisibleKinds(v => [...v, f.kind]);
  };
  const logout = async () => {
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (r.ok) { setUser(null); setAuthOpen(false); notify('Vous êtes déconnecté.'); } else notify('La déconnexion a échoué. Réessayez.');
    } catch { notify('Le serveur est indisponible. Réessayez.'); }
  };
  const handleAuthSuccess = u => { setUser(u); setAuthOpen(false); notify('Votre espace est prêt.'); };
  const exportPublicData = () => {
    download(JSON.stringify(data, null, 2), 'souss-massa-donnees-publiques.json');
    notify('Les données publiques ont été exportées.');
  };
  const exportSources = () => download(JSON.stringify(data, null, 2), 'souss-massa-sources.json');

  return (
    <div className="app-shell">
      <Sidebar
        region={activeRegion}
        mobileOpen={mobileNav}
        page={page}
        onNavigate={navigate}
        todayWeather={todayWeather}
        weatherLoading={weatherLoading}
        weatherError={weatherError}
        onRetryWeather={loadWeather}
      />
      {mobileNav && <NavScrim onClose={() => setMobileNav(false)} />}
      <div className="workspace">
        <Topbar
          page={page}
          user={user}
          regions={regionList}
          regionId={activeRegionId}
          onSelectRegion={onSelectRegion}
          onToggleMenu={() => setMobileNav(v => !v)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAccount={() => setAuthOpen(true)}
        />
        <main id="main-content" className={`page-content ${page === 'map' ? 'map-page' : ''}`}>
          {page === 'regions' ? (
            <Suspense fallback={<div className="loading-state" role="status"><span className="loading-spinner" /><p>Chargement des régions…</p></div>}>
              <RegionsPage state={regionsState} regionId={activeRegionId} onSelectRegion={onSelectRegion} />
            </Suspense>
          ) : page === 'balance' ? (
            <Suspense fallback={<div className="loading-state" role="status"><span className="loading-spinner" /><p>Chargement des scénarios…</p></div>}>
              <BalancePage regionId={activeRegionId} onSelectRegion={onSelectRegion} />
            </Suspense>
          ) : page === 'forecast' ? (
            <Suspense fallback={<div className="loading-state" role="status"><span className="loading-spinner" /><p>Chargement de la prévision…</p></div>}>
              <ForecastPage />
            </Suspense>
          ) : regionView ? (
            page === 'overview'
              ? <RegionOverview state={regionsState} regionId={activeRegionId} onSelectRegion={onSelectRegion} navigate={navigate} />
              : <RegionMapPage state={regionsState} regionId={activeRegionId} onSelectRegion={onSelectRegion} />
          ) : loadError ? (
            <div className="error-state">
              <Database size={36} />
              <h1>Données indisponibles</h1>
              <p>{loadError}</p>
              <button className="primary-button" onClick={load}>Réessayer</button>
            </div>
          ) : !data ? (
            <div className="loading-state">
              <span className="loading-spinner" />
              <p>Chargement des données régionales…</p>
            </div>
          ) : (
            <>
              <PageHeading page={page} asOf={data.asOf} user={user} onExport={exportPublicData} />
              {(page === 'overview' || page === 'map') && (
                <>
                  {page === 'overview' && <OverviewMetrics data={data} dams={dams} onQuality={() => navigate('quality')} />}
                  <MapPage
                    facilities={facilities}
                    selected={selected}
                    visibleKinds={visibleKinds}
                    setVisibleKinds={setVisibleKinds}
                    terrain={terrain}
                    setTerrain={setTerrain}
                    setSelectedId={setSelectedId}
                    sources={data.sources}
                    navigate={navigate}
                  />
                  {page === 'overview' && (
                    <OverviewSections data={data} dams={dams} selected={selected} onSelect={setSelectedId} navigate={navigate} />
                  )}
                </>
              )}
              {isOtherRegion && (page === 'quality' || page === 'cycle') && <ScopeNotice />}
              {page === 'quality' && (
                <QualityPage
                  facilities={facilities}
                  user={user}
                  onRequireAuth={() => setAuthOpen(true)}
                  onToast={notify}
                />
              )}
              {page === 'cycle' && <CyclePage data={data} onSelect={selectSite} onSources={() => navigate('sources')} />}
              {page === 'sources' && <SourcesPage data={data} onExport={exportSources} />}
            </>
          )}
          <footer className="page-footer">
            <span>Anzar · Observatoire de l’eau du Maroc</span>
            <span>Projet indépendant issu d’un stage à la RAMSA · Aucune télémesure connectée</span>
            <button onClick={() => navigate('sources')}>Sources & limites</button>
          </footer>
        </main>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {searchOpen && (
        <SearchPalette
          query={query}
          onQueryChange={setQuery}
          matches={matches}
          onSelect={selectSite}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {authOpen && (
        <AuthDialog
          user={user}
          onClose={() => setAuthOpen(false)}
          onSuccess={handleAuthSuccess}
          onLogout={logout}
        />
      )}
    </div>
  );
}
