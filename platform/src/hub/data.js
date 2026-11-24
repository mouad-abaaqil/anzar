// Chargeur unique des données du hub. Les fichiers optionnels absents valent null.
import { useEffect, useState } from 'react';

const REQUIRED = {
  regions: '/data/regions.json',
  region: '/data/region.json',
  balance: '/data/water-balance.json',
  bulletin: '/data/national-bulletin.json',
  geo: '/data/morocco-regions.geojson',
};
const OPTIONAL = {
  climate: '/data/climate-outlook.json',
  links: '/data/water-links.json',
  dams: '/data/national-dams.json',
};

const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });

export async function loadHubData() {
  const entries = await Promise.all([
    ...Object.entries(REQUIRED).map(([k, u]) => get(u).then(v => [k, v])),
    ...Object.entries(OPTIONAL).map(([k, u]) => get(u).then(v => [k, v]).catch(() => [k, null])),
  ]);
  return Object.fromEntries(entries);
}

export function useHubData() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadHubData().then(d => alive && setState({ status: 'ready', ...d })).catch(e => alive && setState({ status: 'error', error: e.message }));
    return () => { alive = false; };
  }, []);
  return state;
}
