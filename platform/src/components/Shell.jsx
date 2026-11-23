import { Check, ChevronDown, ChevronRight, CircleHelp, Menu, Search, UserRound, Wind, X } from 'lucide-react';
import { kindSingular, nav } from '../lib/constants.js';
import { date, number } from '../lib/format.js';
import Modal from './Modal.jsx';
import RegionSelector, { OperatorLogo } from './RegionSelector.jsx';

export function Sidebar({ region, mobileOpen, page, onNavigate, todayWeather, weatherLoading, weatherError, onRetryWeather }) {
  const op = region?.operator;
  const operatorName = op ? op.name : 'Société Régionale Multiservices Souss-Massa';
  const owner = op ? op.acronym || op.name : 'SRM-SM';
  return (
    <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Navigation principale">
      <a href="#/app/overview" className="anzar-brand" onClick={e => { e.preventDefault(); onNavigate('overview'); }}>
        <img src="/brand/anzar/mark.svg" alt="" width="34" height="34" />
        <span><strong>Anzar</strong><small>Observatoire de l’eau du Maroc</small></span>
      </a>
      <div className="sidebar-operator">
        <div className="sidebar-operator-label">Opérateur</div>
        {region ? (
          <OperatorLogo region={region} size="md" />
        ) : (
          <span className="operator-logo md"><img src="/brand/operators/icons/souss-massa.png" alt={operatorName} /></span>
        )}
        <div className="sidebar-operator-name">{operatorName}</div>
        <div className="sidebar-operator-mark">Logo : marque de {owner}, son titulaire.</div>
      </div>
      <nav>
        {nav.map(n => (
          <button
            key={n.id}
            className={`nav-link ${page === n.id ? 'active' : ''}`}
            onClick={() => onNavigate(n.id)}
            aria-current={page === n.id ? 'page' : undefined}
          >
            <n.icon size={16} strokeWidth={1.75} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="weather-mini">
          <div className="weather-city"><Wind size={16} /><span>Agadir</span>{weatherLoading && <span className="small-muted">…</span>}</div>
          {todayWeather ? (
            <>
              <div className="weather-numbers"><strong>{number(todayWeather.temp, 0)}°</strong><span>max. · {number(todayWeather.rain, 1)} mm</span></div>
              <p>Modèle météo · {date(todayWeather.date)}</p>
            </>
          ) : (
            <p>
              {weatherError ? 'Météo indisponible' : 'Chargement météo…'}
              {weatherError && <button className="text-button" onClick={onRetryWeather}>Réessayer</button>}
            </p>
          )}
        </div>
        <button className="nav-link help-link" onClick={() => onNavigate('sources')}><CircleHelp size={16} /><span>À propos du projet</span></button>
        <div className="provenance">Prototype indépendant issu d’un stage à la RAMSA.<span>Pas un portail officiel.</span></div>
      </div>
    </aside>
  );
}

export function NavScrim({ onClose }) {
  return <button className="nav-scrim" aria-label="Fermer la navigation" onClick={onClose} />;
}

export function Topbar({ user, page, regions, regionId, onSelectRegion, onToggleMenu, onOpenSearch, onOpenAccount }) {
  const current = nav.find(n => n.id === page)?.label;
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Ouvrir la navigation" onClick={onToggleMenu}><Menu size={18} /></button>
      <nav className="breadcrumb" aria-label="Fil d’Ariane">
        {regions?.length
          ? <RegionSelector regions={regions} selectedId={regionId} onSelect={onSelectRegion} />
          : <span>Souss-Massa</span>}
        {current && <><ChevronRight size={14} /><strong aria-current="page">{current}</strong></>}
      </nav>
      <button className="search-trigger" onClick={onOpenSearch}><Search size={16} /><span>Rechercher un ouvrage</span><kbd>⌘K</kbd></button>
      <button className="account-button" onClick={onOpenAccount}>
        <UserRound size={16} />
        <span>{user ? user.workspace || user.name : 'Mon espace'}</span>
        <ChevronDown size={14} />
      </button>
    </header>
  );
}

export function Toast({ message, onClose }) {
  return (
    <div className="toast" role="status">
      <Check size={16} />{message}
      <button aria-label="Fermer le message" onClick={onClose}><X size={15} /></button>
    </div>
  );
}

export function SearchPalette({ query, onQueryChange, matches, onSelect, onClose }) {
  return (
    <Modal title="Rechercher dans le territoire" onClose={onClose}>
      <div className="command-input">
        <Search size={18} />
        <input autoFocus placeholder="Nom d’un barrage, d’une station…" value={query} onChange={e => onQueryChange(e.target.value)} />
      </div>
      <div className="command-results">
        {matches.length ? matches.map(f => (
          <button key={f.id} onClick={() => onSelect(f.id)}>
            <span className={`kind-dot ${f.kind}`} />
            <span><strong>{f.name}</strong><small>{kindSingular[f.kind]}</small></span>
            <ChevronRight size={16} />
          </button>
        )) : <p>Aucun ouvrage ne correspond à cette recherche.</p>}
      </div>
    </Modal>
  );
}
