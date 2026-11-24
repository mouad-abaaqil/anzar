# Anzar — refonte « hub » : contrat d'interface (source de vérité des agents de la phase 1)

Une seule application : une carte 3D persistante au centre, un récit d'entrée qui pilote sa caméra, un panneau à 3 onglets. Système de design : docs/DESIGN_ANZAR.md, kit dans platform/src/design/ (composants, tokens `--az-*`, `colors.js` pour MapLibre). **Règle mécanique** : aucun hex/rgb/hsl ni font-family hors src/design/tokens.css ; `npm run check:design -- <fichiers>` doit sortir 0 sur tes fichiers. Honnêteté : docs/ANZAR_CONTRACT.md reste en vigueur (statuts sourcé/dérivé/hypothèse, aucun volume transféré, aucun tracé de conduite inventé, groundwater non modélisé).

## Arborescence et propriétaires (fichiers disjoints)
```
src/hub/
  data.js          useHubData()                        (orchestrateur, déjà écrit)
  HubApp.jsx       racine, routage, état, barre haute  (agent CORE)
  routes.js        parseHubRoute / hubHash / redirections des anciennes adresses  (CORE)
  HubMap.jsx/.css  carte persistante + couches        (agent MAP)
  layers/dams.js, layers/links.js                      (MAP)
  Story.jsx/.css, stops.js                             (agent STORY)
  panel/PanelShell.jsx, TodayTab.jsx, TomorrowTab.jsx, TogetherTab.jsx, metrics.js, panel.css  (agent PANEL)
```

## Données (useHubData)
`{ status:'loading'|'ready'|'error', regions (regions.json), region (region.json Souss-Massa), balance (water-balance.json), bulletin (national-bulletin.json), climate (climate-outlook.json|null), links (water-links.json|null), dams (national-dams.json|null), geo (morocco-regions.geojson) }`. Les fichiers optionnels absents valent null : l'UI doit le gérer.

## État partagé (HubApp → enfants)
- `regionId` (défaut 'souss-massa'), `tab` ∈ 'today' | 'tomorrow' | 'together', `mode` ∈ 'story' | 'explore'.
- `scenario` = `{ hydrology:'dry'|'normal'|'wet', popGrowth, demandReductionPct, addedDesalMm3, reusePct, rainChangePct, year }` (mêmes champs que balance.js / BalancePage). Défauts : voir BalancePage.jsx (à porter dans panel/metrics.js `defaultScenario(data, regionId)`).

## Routes (hash) — CORE
`#/` = hub en mode récit ; `#/r/<regionId>[/<tab>]` = hub en mode exploration (tab par défaut 'today') ; `#/sources` = tiroir sources & méthode ouvert. Anciennes adresses redirigées (replaceState) : `#/app/overview[/id]`→today, `#/app/map`→today, `#/app/balance`→tomorrow, `#/app/regions`→together, `#/app/forecast`→tomorrow, `#/app/sources`→`#/sources`. `#/app/quality` et `#/app/cycle` : pages annexes conservées (ancien shell, import paresseux), hors navigation principale. `#/kit` reste la démo du kit. Tests parseRoute mis à jour (pas supprimés).

## HubMap — MAP
`<HubMap ref regionId onSelectRegion metricByRegion legend layers={{dams,links}} mode storyStop />`. Une SEULE instance MapLibre pour toute l'app ; garder l'import du worker Vite et setWorkerUrl comme dans src/components/MapView.jsx. Handle impératif (useImperativeHandle) : `flyToStop(stop)` avec `stop = { center:[lon,lat], zoom, pitch, bearing, duration?, highlightRegionIds?:[] }`, `flyToRegion(id)`, `resetView()`. `metricByRegion = { [regionId]: { value, band:'critique'|'tendu'|'confortable'|'dominant'|'mixte'|'faible'|null, label } }` (même forme que BalancePage actuel). Couche barrages : si `data.dams` (national-dams.json) cercles proportionnels à la capacité (SANS remplissage, la légende le dit) ; remplissage seulement pour Souss-Massa (sourcé). Couche liaisons : arcs schématiques entre `from` et `to` de water-links.json (seulement si lat/lon non null ; sinon liste dans le panneau, pas sur la carte), plein = en service, pointillé = en construction/planifié, atténué = verified:false ; infobulle « liaison schématique, pas le tracé réel » + source ; **aucun volume transférable** (la capacité publiée s'affiche telle quelle avec sa source, jamais présentée comme volume disponible pour une région). Pas de colonnes 3D illisibles ; relief Mapterhorn + régions extrudées comme AnzarMap.jsx (à fusionner/remplacer). Survol et clic région → onSelectRegion. Sahara colorié (flux, bleus).

## Story — STORY
`<Story onEnter={(regionId)=>…} flyToStop={(stop)=>…} />` : récit en défilement par-dessus la carte (la carte reste visible et bouge), 6-8 étapes courtes, ton campagne de sensibilisation, grand public, très peu de mots : ce que représente l'eau au Maroc, où elle est (barrages au bulletin du jour, chiffres lus dans national-bulletin.json), pourquoi le Sud est différent (dessalement, aucun lien physique documenté — lu dans water-links.json, pas affirmé de mémoire), ce qui peut changer (scénarios), puis CTA « Explorer » → onEnter. Étapes = `stops.js` (exporté, `STORY_STOPS`). Style Blackbird/IMEX/Tirion (voir docs/DESIGN_ANZAR.md) : titre display condensé énorme, micro-labels mono MAJUSCULES, un seul accent. Repli sans WebGL.

## Panel — PANEL
`<PanelShell data regionId onSelectRegion tab onTab scenario onScenario />` dans Sheet (kit). Onglets : **Aujourd'hui** (réserve en mois, stock/capacité, demande par usage, pluie récente via RainPanel/openData, pastille de provenance compacte ; peu de texte) ; **Demain** (scénario sec/normal/humide, année, curseurs population/économies/dessalement/réutilisation/pluie CMIP6, courbe 10 ans avec bande, épuisement du stock ; mention « scénario, pas une prédiction ») ; **Ensemble** (leviers levers(), classement et groupes Sahara de solidarityView/rankRegions, liaisons documentées de la région depuis water-links.json avec statut et source, message honnête « aucune liaison physique documentée vers le Sud : dépendance au dessalement » quand c'est le cas, projets sourcés). Exporte `computeMetricByRegion({data, scenario, tab})` (metrics.js) utilisé par HubApp pour colorer la carte. Mêmes fonctions de balance.js (API inchangée) ; porter la logique utile de src/pages/BalancePage.jsx (ne pas la modifier ; elle sera supprimée par CORE à la fin si tout passe). Provenance : un marqueur compact par chiffre (ProvenanceChip), le détail au toucher ; méthode complète dans le tiroir Sources (CORE) alimenté par SourcesPage.jsx.

## Vérification obligatoire pour chaque agent
npm test, npm run build, `npm run check:design -- <tes fichiers>` = 0, capture CDP temps réel (Chrome headless --use-angle=swiftshader-webgl, sans virtual-time-budget, ton vite sur un port libre de ta plage, arrêté ensuite) à 1440 et 390 px. Pas de commit. Rapport : vu / non vu.
