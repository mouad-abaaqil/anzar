import { Suspense, lazy, useEffect, useState } from 'react';
import { hubHash, parseHubRoute } from './hub/routes.js';

// Le hub (design Anzar) et les annexes (ancien shell + styles.css) ne partagent pas leurs feuilles de style :
// passer de l'un à l'autre recharge la page (voir hashchange ci-dessous).
const HubApp = lazy(() => import('./hub/HubApp.jsx'));
const Annex = lazy(() => import('./hub/Annex.jsx'));

function readRoute() {
  const route = parseHubRoute(window.location.hash);
  const canonical = hubHash(route);
  if (window.location.hash !== canonical) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonical}`);
  }
  return route;
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [annex] = useState(route.view === 'annex');
  useEffect(() => {
    const sync = () => {
      const next = readRoute();
      if ((next.view === 'annex') !== annex) { window.location.reload(); return; }
      setRoute(next);
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [annex]);
  return (
    <Suspense fallback={null}>
      {annex ? <Annex page={route.page} /> : <HubApp route={route} />}
    </Suspense>
  );
}
