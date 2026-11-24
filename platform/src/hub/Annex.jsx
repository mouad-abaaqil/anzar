// Pages annexes (Qualité de l'eau, Cycle) : ancien shell et ancienne feuille de style, hors navigation du hub.
// Exemptées de check:design (voir EXCEPTIONS dans scripts/check-design.mjs) ; chargées seulement ici.
import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import '../tokens.css';
import '../styles.css';
import AuthDialog from '../components/AuthDialog.jsx';
import PageHeading from '../components/PageHeading.jsx';
import { NavScrim, SearchPalette, Sidebar, Toast, Topbar } from '../components/Shell.jsx';
import { DEFAULT_REGION_ID } from '../lib/regions.js';
import { hubHash } from './routes.js';
import { SERVER_ONLY_NOTICE, apiJson, probeServer } from './panel/serverApi.js';
import CyclePage from '../pages/CyclePage.jsx';
import QualityPage from '../pages/QualityPage.jsx';

export default function Annex({ page }) {
  const [server, setServer] = useState(null); // null = vérification, true / false
  useEffect(() => { let alive = true; probeServer().then(v => alive && setServer(v)); return () => { alive = false; }; }, []);
  useEffect(() => { document.title = 'Anzar · annexes'; }, []);
  if (server === null) return <div className="loading-state" role="status"><span className="loading-spinner" /><p>Vérification du serveur…</p></div>;
  if (!server) {
    return (
      <main id="main-content" className="page-content">
        <div className="error-state" role="status">
          <Database size={36} />
          <h1>{SERVER_ONLY_NOTICE}</h1>
          <p>{page === 'quality' ? 'La qualité de l’eau' : 'Le cycle de l’eau'} et les comptes ont besoin du serveur Anzar. Cette version statique n’a pas d’API : rien n’est enregistré ni simulé à la place.</p>
          <a className="primary-button" href={hubHash({ view: 'explore', regionId: DEFAULT_REGION_ID })}>Retour au tableau de bord</a>
        </div>
      </main>
    );
  }
  return <AnnexServer page={page} />;
}

function AnnexServer({ page }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const facilities = data?.facilities || [];
  const matches = facilities.filter(f => f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const notify = message => setToast(typeof message === 'string' ? message : 'Enregistré');
  const navigate = id => { window.location.hash = `#/app/${id}`; setMobileNav(false); window.scrollTo({ top: 0 }); };
  const load = () => {
    setLoadError('');
    fetch('/data/region.json')
      .then(r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { setData(d); setSelectedId(d.facilities[0]?.id); })
      .catch(() => setLoadError('Les données régionales ne sont pas disponibles. Réessayez dans quelques instants.'));
  };

  useEffect(load, []);
  useEffect(() => {
    apiJson('/api/auth/me').then(r => setUser(r?.user || null)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.title = 'Anzar · annexes';
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
      if (e.key === 'Escape') { setSearchOpen(false); setAuthOpen(false); setMobileNav(false); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);

  const selectSite = id => { setSelectedId(id); setSearchOpen(false); };
  const logout = async () => {
    try {
      await apiJson('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setUser(null); setAuthOpen(false); notify('Vous êtes déconnecté.');
    } catch { notify('La déconnexion a échoué ou le serveur est indisponible. Réessayez.'); }
  };

  return (
    <div className="app-shell">
      <Sidebar region={null} mobileOpen={mobileNav} page={page} onNavigate={navigate} todayWeather={null} weatherLoading={false} weatherError onRetryWeather={() => {}} />
      {mobileNav && <NavScrim onClose={() => setMobileNav(false)} />}
      <div className="workspace">
        <Topbar
          page={page}
          user={user}
          regions={[]}
          regionId={DEFAULT_REGION_ID}
          onSelectRegion={() => {}}
          onToggleMenu={() => setMobileNav(v => !v)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenAccount={() => setAuthOpen(true)}
        />
        <main id="main-content" className="page-content">
          {loadError ? (
            <div className="error-state">
              <Database size={36} />
              <h1>Données indisponibles</h1>
              <p>{loadError}</p>
              <button className="primary-button" onClick={load}>Réessayer</button>
            </div>
          ) : !data ? (
            <div className="loading-state"><span className="loading-spinner" /><p>Chargement des données régionales…</p></div>
          ) : (
            <>
              <PageHeading page={page} asOf={data.asOf} user={user} onExport={() => {}} />
              <p className="small-muted">Page annexe : données du Souss-Massa uniquement. <a href="#/">Retour au récit Anzar</a></p>
              {page === 'quality' && <QualityPage facilities={facilities} user={user} onRequireAuth={() => setAuthOpen(true)} onToast={notify} />}
              {page === 'cycle' && <CyclePage data={data} onSelect={selectSite} onSources={() => { window.location.hash = '#/sources'; }} />}
            </>
          )}
          <footer className="page-footer">
            <span>Anzar · Observatoire de l’eau du Maroc</span>
            <span>Projet indépendant issu d’un stage à la RAMSA · Aucune télémesure connectée</span>
            <a href="#/sources">Sources et limites</a>
          </footer>
        </main>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {searchOpen && <SearchPalette query={query} onQueryChange={setQuery} matches={matches} onSelect={selectSite} onClose={() => setSearchOpen(false)} />}
      {authOpen && <AuthDialog user={user} onClose={() => setAuthOpen(false)} onSuccess={u => { setUser(u); setAuthOpen(false); notify('Votre espace est prêt.'); }} onLogout={logout} />}
    </div>
  );
}
