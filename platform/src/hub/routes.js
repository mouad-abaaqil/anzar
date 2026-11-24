// Routes du hub (hash). Source de vérité : docs/HUB_CONTRACT.md.
//   #/                         récit (carte + histoire)
//   #/r/<regionId>[/<tab>]     exploration, tab = today | tomorrow | together (défaut today)
//   #/sources                  tiroir « Sources & méthode »
//   #/app/quality, #/app/cycle pages annexes (ancien shell, hors navigation principale)
// Anciennes adresses redirigées vers l'équivalent du hub.
export const DEFAULT_REGION_ID = 'souss-massa';
export const TABS = ['today', 'tomorrow', 'together'];
export const ANNEX_PAGES = ['quality', 'cycle'];
const LEGACY_TAB = { overview: 'today', map: 'today', balance: 'tomorrow', forecast: 'tomorrow', regions: 'together' };
const LEGACY_PAGES = [...Object.keys(LEGACY_TAB), 'sources', ...ANNEX_PAGES];

const STORY = { view: 'story', regionId: null, tab: 'today', page: null };

// -> { view: 'story' | 'explore' | 'sources' | 'annex', regionId, tab, page }
export function parseHubRoute(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { ...STORY };
  if (parts[0] === 'r') {
    return { view: 'explore', regionId: parts[1] || DEFAULT_REGION_ID, tab: TABS.includes(parts[2]) ? parts[2] : 'today', page: null };
  }
  if (parts[0] === 'sources') return { view: 'sources', regionId: null, tab: 'today', page: null };
  // Anciennes adresses : #/app/<page>[/<regionId>] et #<page>
  const legacy = parts[0] === 'app' ? parts[1] : parts[0];
  const legacyRegion = parts[0] === 'app' ? parts[2] : null;
  if (LEGACY_PAGES.includes(legacy)) {
    if (legacy === 'sources') return { view: 'sources', regionId: null, tab: 'today', page: null };
    if (ANNEX_PAGES.includes(legacy)) return { view: 'annex', regionId: null, tab: 'today', page: legacy };
    return { view: 'explore', regionId: legacyRegion || DEFAULT_REGION_ID, tab: LEGACY_TAB[legacy], page: null };
  }
  if (parts[0] === 'app') return { view: 'explore', regionId: DEFAULT_REGION_ID, tab: 'today', page: null };
  return { ...STORY };
}

// Adresse canonique d'une route (le défaut 'today' n'est pas écrit).
export function hubHash(route) {
  switch (route.view) {
    case 'explore': return `#/r/${route.regionId || DEFAULT_REGION_ID}${route.tab && route.tab !== 'today' ? '/' + route.tab : ''}`;
    case 'sources': return '#/sources';
    case 'annex': return `#/app/${route.page}`;
    default: return '#/';
  }
}
