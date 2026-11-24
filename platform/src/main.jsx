import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './design/tokens.css';
import './design/kit.css';
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Démo du kit (#/kit), testée avant le montage d'App pour que son routeur ne réécrive jamais l'adresse.
const KitDemo = lazy(() => import('./design/KitDemo.jsx'));
const isKit = () => window.location.hash.startsWith('#/kit');
const kit = isKit();
window.addEventListener('hashchange', () => { if (isKit() !== kit) window.location.reload(); });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{kit ? <Suspense fallback={null}><KitDemo /></Suspense> : <App />}</React.StrictMode>,
);
