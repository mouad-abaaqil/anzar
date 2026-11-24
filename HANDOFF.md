# SRM-SM — handoff (état au 19 novembre 2026)

Lis ce fichier en premier, puis `CLAUDE.md`. Le journal détaillé (décisions, chiffres, échecs) est dans `docs/HISTORY.md`. Rien n'est commité, poussé ni déployé.

## 1. Le but (mots du propriétaire, Mouad, qui écrit en français)

Un outil **tout-en-un pour la SRM-SM** (Société Régionale Multiservices Souss-Massa), pensé comme un vrai ERP, pour **piloter les ressources en eau** : réserves des barrages, dessalement, pluie, cycle de l'eau, et **comparer les régions** du Maroc (une région en manque, des régions voisines mieux remplies). La **qualité de l'eau n'est qu'une annexe**. Il veut aussi : un **sélecteur de région** qui affiche automatiquement l'opérateur responsable et son **logo** (SRM de chaque région, logos officiels), le cadre officiel de la région, des visuels **3D** (remplissage des barrages, capacité des stations de dessalement), une **prévision de remplissage par la pluie**, une **estimation par satellite**, une **landing page**, un design moderne type ERP aux **couleurs exactes du logo** (bleu #12508F, jaune #FAB61F, vert #57B24A, blanc), **sans texte inutile ni « AI slop »**, interface en **français**. Il s'inspire de son projet « Blackbird terminal » (jamais localisé : demande un chemin ou une capture).

Question ouverte de fond : **quels quartiers chaque barrage alimente-t-il ?** Aucune donnée publique trouvée ; ne rien afficher tant que ce n'est pas sourcé.

## 2. Comment travailler avec lui (important)

- **Autonomie et vitesse.** Il s'est énervé quand j'ai attendu, procrastiné ou ignoré ses demandes. Exécute, avance en parallèle, finis, puis rends compte. Ne pose une question que si elle bloque vraiment.
- **Sous-agents : Sonnet, pas Haiku** (il juge Haiku mauvais). Opus = advisor (outil `advisor`, à appeler pour de vrai avant de conclure). Arrête les sous-agents terminés ou bloqués (`TaskStop`) : il voit la liste et s'impatiente.
- **Rapports courts, honnêtes, chiffrés** : ce qui a changé, ce qui est vérifié, ce qui reste. Ne jamais prétendre avoir fait une vérification (navigateur, advisor, source) qu'on n'a pas faite.
- **Approbation requise** pour : commit, push, déploiement, suppression destructive, changement majeur de cap. Ne pas réinitialiser ni nettoyer le dépôt (beaucoup de travail non commité + `legacy/`).
- Honnêteté scientifique (règle absolue) : distinguer instantané public daté, météo modélisée, estimation satellite, analyses importées par l'utilisateur ; jamais de relevé « en direct » inventé, de tracé de conduite, de volume transférable, de classement potable/non potable ni d'indice de qualité (l'ancien « WQI » du carnet `legacy/` n'a aucune validité). Dates, unités, sources, licences et incertitude restent visibles. Marque RAMSA/SRM-SM : prototype indépendant, jamais « officiel ».

## 2bis. Anzar (23 nov. 2026) — pivot national

Le propriétaire a demandé un observatoire **national** de l'eau (barrages, pluie, satellite, autosuffisance par région, scénarios, aide au sud, 3D, landing de portfolio). Nom retenu : **Anzar** (docs/BRAND_ANZAR.md ; anzar.ma/.io/.app déjà enregistrés, pas de recherche OMPIC). SRM-SM reste une vue régionale. Contrat : docs/ANZAR_CONTRACT.md.
- Nouveaux : `public/data/water-balance.json` (population, demande, dessalement, apports, projets ; chaque nombre a status sourced/derived/hypothese), `climate-outlook.json` (CMIP6 Open-Meteo, projection modélisée, usage non commercial, script `pipeline/climate/`), `src/lib/balance.js` (moteur, constantes d'hypothèse DAM_CAPTURE_SHARE, HYDRO_FACTOR, etc.), `src/pages/BalancePage.jsx` (`#/app/balance`), `src/components/AnzarMap.jsx` (carte nationale 3D), `HeroTerrain.jsx` + nouvelle `Landing.jsx`, `public/brand/anzar/`.
- Les scénarios ne sont **pas** des prédictions ; calage des facteurs à l'œil (non validé) ; eaux souterraines non modélisées ; aucune valeur de transfert entre régions. **100 tests** verts. Curseur de pluie projetée (médiane CMIP6 du bassin × élasticité non sourcée), indicateur dessalement ÷ demande potable, épuisement du stock de surface dans la simulation.
- **Captures 3D : utiliser Chrome en temps réel par CDP** (`--remote-debugging-port`, `--use-angle=swiftshader-webgl`). `--virtual-time-budget` simule à tort « WebGL indisponible ».
- Charte de l'app : l'accent n'est plus le bleu SRM-SM #12508F mais la palette Anzar ; le logo SRM-SM reste dans la carte « Opérateur ».
- Non fait : orbite du hero jamais observée, perfs GPU réelles inconnues, URL `sourced` de water-balance.json non revérifiées une à une, rien de commité ni déployé. Le port 5173 peut être pris par un autre projet.

### Mise à jour du 23 nov. 2026 (soir)
- **Logo** : symbole « Horizon commun » (variante C), généré par Codex à partir des 12 logos SRM comme inspiration ; Codex recommandait B, C a été retenu par Claude. Alternatives A/B, brief et ancien brouillon : `docs/brand-anzar/`. Changer de logo = remplacer les fichiers de `platform/public/brand/anzar/`.
- **Logos des SRM** : icônes seules recadrées (`public/brand/operators/icons/`, champ `icon` de regions.json, `iconKind` dans LOGOS.json).
- **Sahara** (Laâyoune, Dakhla) : indicateur de flux « dessalement ÷ demande potable » à la place des mois de couverture (pas de bassin dans le bulletin) ; carte colorée en bleus avec légende dédiée ; nappes non modélisées.
- **Pluie** : `/api/rain` puis Open-Meteo direct depuis le navigateur puis cache daté ; bloc ET0 + débit GloFAS ; inventaire des sources ouvertes dans `docs/OPEN_DATA.md` (aucune clé requise pour l'affichage actuel ; comptes gratuits nécessaires pour CDSE, CDS, Earthdata, Sentinel Hub, Earth Engine ; jeton WaPOR non vérifié ; clés dans `platform/.env`, jamais en `VITE_*`).
- **Revue CSS (Opus)** : cohérence des tokens, code mort retiré, barre latérale corrigée ; le CSS a grossi d'environ 3 Ko net.
- `platform/.gitignore` : `/data/` (base SQLite privée) au lieu de `data/`, qui ignorait aussi `public/data/`.
- Déploiement serveur : `npm run build && npm start` (UI + API :8787) ; `COOKIE_SECURE=true` derrière HTTPS, `ALLOWED_ORIGINS`, `DB_PATH`. Open-Meteo gratuit = non commercial.

### État au 24 nov. 2026 (fin de session) — À LIRE EN PREMIER
- **En ligne : version précédente** (Worker Cloudflare version `1bb1abc7`, = commit **6b0b7d9**), remise en ligne par `wrangler rollback` à la demande du propriétaire, qui préfère cette version : le lot suivant (**b9ec72e** : « Accueil », globe, champs 3D, footer, sections en colonnes à fond plein, partage) avait des bugs CSS. Pour revenir au lot b9ec72e : `sh scripts/deploy.sh` depuis cet état Git.
- **Git (`anzar/main`) = b9ec72e**, donc PLUS RÉCENT que ce qui est en ligne. Ne pas redéployer sans avoir fini la refonte ci-dessous.
- **Refonte en cours, NON commitée, NON déployée** (arbre de travail, agent « DESIGN EAU ») : retrait du bouton **Partager** partout ; audit CSS (360/390/768/1024/1280/1920) ; mobile ; langage visuel « eau d'abord » : carte 3D plein écran comme scène, légendes translucides « verre » au lieu de colonnes à fond plein, animations d'eau légères (vagues, pluie + ondulations, mot EAU qui se remplit, plongée liée au défilement, réservoirs qui se remplissent, jauges), repli sans WebGL animé. À vérifier : `git status`, `npm test`, `npm run build`, `npm run check:design`, puis captures (une à la fois, `scripts/with-capture-lock.sh`, version `vite preview`), mobile 390 et 360 avant tout déploiement ; demander l'accord du propriétaire avant commit/push/déploiement.
- **Refonte « eau d'abord » : VUE en navigateur (24 nov., après l'agent) et corrigée** : hero immersif (carte 3D plein écran à droite, vagues animées en bas, mot EAU rempli), sections en cartes « verre » ou titres sur dégradé, réservoirs d'eau animés, jauge de plongée, footer à bulles, mobile 390 propre. Corrigés par moi : « 66,09 » qui débordait de sa carte, libellé « …2026, dont » coupé, **bug des champs 3D jamais éteints** (HubApp appelait showFields(false) avec un booléen alors que HubMap attend { on } : false était lu comme « allumer » ; HubMap accepte maintenant les deux + test de régression parseShowFieldsArg). 159 tests unitaires, check:design = 0, build OK ; specs Playwright passées : 01, 04, 05, 06, 07 (10 tests), 08 (instable seulement quand la machine est saturée), 09, 10 (5/6 ; la vérification « Début remonte la page » est non bloquante en rendu logiciel : jamais reproduite hors spec), 11, 02. **Non lancé : 03 (12 régions × 3 onglets), trop lourd.**
- **Reste à faire** : commit/push/déploiement (accord du propriétaire requis ; la version en ligne est toujours 1bb1abc7) ; régénérer les captures du README (`npm run e2e:shots`) car elles montrent l'ancienne maquette ; `viewport-fit=cover` dans index.html ; mettre à jour DESIGN_ANZAR_V2 (animations de l'eau autorisées, arrêt 10 s après la dernière action) et HUB_CONTRACT (plus de partage) ; le globe d'ouverture n'a toujours pas été vu en capture (6 s avant le plongeon, rendu logiciel lent).
- **Chaleur du Mac** : le rendu 3D logiciel de Chrome headless peut dépasser 900 % de CPU ; l'application Messages de macOS est bloquée à ~100 % depuis plus de 23 h (à quitter avec ⌘Q). Captures minimales, jamais en parallèle, spec 03 (12 régions) très lourde.
- Mémoire : la préférence du propriétaire pour un langage visuel « eau » animé (pas de blocs à fond plein) est dans les retours de design.

### Dernier run (23 nov. 2026) — Anzar en ligne
- **En ligne : https://anzar.abq.capital** (Worker Cloudflare, assets seuls, config `platform/wrangler.jsonc`, domaine personnalisé ; première mise en ligne le 23 nov. 2026 à 22:37). Aussi https://anzar.abaaqil-com.workers.dev. Redéployer : `cd platform && sh scripts/deploy.sh` (build `VITE_STATIC=1`, `wrangler deploy` ; Wrangler est connecté, binaire de ~/Developer/abaaqil.com/node_modules/.bin/wrangler, ou `npx wrangler login` si le jeton expire). Pas de repli SPA : `/api/*` répond 404 (la pluie appelle Open-Meteo directement, les annexes Qualité/Cycle/compte affichent « Disponible uniquement dans la version serveur »). Pas sur le serveur Debian : la route du tunnel Cloudflare demande le tableau de bord ou un jeton d'API, et la RAM du serveur est limitée.
- **Design V2** (docs/DESIGN_ANZAR_V2.md) : thème clair « eau », bleu #12508F / jaune #FAB61F / vert #57B24A des SRM, sections « profondeur », favicon à fond transparent ; `npm run check:design` = 0.
- **Landing** : contexte → problématique → chiffres → barrages en 3D → mini-tableau de bord manipulable (MiniSim, même calcul que le tableau de bord). **Tableau de bord** : Aujourd'hui / Demain / Ensemble, carte claire avec relief, barrages-réservoirs remplis, liens documentés.
- **Données du jour** : bulletin du **23 nov. 2026** (66,09 % ; 11 253,50 / 17 027,59 Mm³ ; même jour 2025 ≈ 31,22 % dérivé du +111,7 % imprimé) ; remplissage de **69 barrages** lu visuellement (public/data/dam-fill.json, sommes par bassin vérifiées) ; **96 barrages localisés** (OSM/Wikidata), 42 joints au remplissage, les autres sans remplissage ; liens d'eau (26, 7 dessinables) ; bilan hydrique v2 (valeurs sourcées).
- **Limites connues, à ne pas cacher** : (1) le moteur n'additionne pas `otherIrrigationMm3PerYear` (614 Mm³/an pour Souss-Massa) : demande agricole sous-estimée ; (2) apports récents de Souss-Massa ≈ 0,22 × la moyenne (HCP 2025) donc scénario « normal » trop optimiste ; facteurs sec/normal/humide non recalés ; (3) Guelmim 39 mois : arithmétique sur des entrées que la source HCP contredit (potable = nappes, pas le barrage Fask) ; (4) Sebou→Bouregreg non dessiné (prise non localisée) ; (5) 98 barrages sans coordonnée sourcée, Bin el Ouidane compris ; capacités par barrage non publiées (dérivées stock/taux) ; (6) QualityPanel.jsx/AuthDialog.jsx/RainPanel : appels /api non durcis pour une réponse HTML en 200 (inactifs en production statique) ; (7) logos des SRM publics sans licence de réutilisation ; Open-Meteo gratuit = non commercial.
- Données brutes des recherches : data-raw/{dams,links,balance}/ (located-v2, links-v2, balance-v2 + resolve-notes.md) ; docs/research/10 à 13.

## 3. Lancer, tester

Node ≥ 24 (testé 26.3). Depuis `platform/` : `npm ci && npm run dev` (UI http://127.0.0.1:5173, API :8787) · `npm test` (**73 tests**, tous verts) · `npm run build` · `npm start` (UI + API sur :8787 après build). Variables : `platform/.env.example`. Le shell de l'agent a `NODE_ENV=production` : `import.meta.env.DEV` est faux, utiliser `MODE`.

Routes (hash) : `#/` landing · `#/app/<overview|map|quality|cycle|regions|forecast|sources>[/<regionId>]` (`souss-massa` est omis du hash).

**Captures et tests d'affichage sans l'extension Chrome** (WebGL absent : la carte 3D y affiche « indisponible », normal) :
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1440,900 --virtual-time-budget=25000 --screenshot=/tmp/x.png "http://127.0.0.1:5173/#/app/overview"`. Chrome sans interface impose une largeur ≥ 500 px : pour tester 390 px, mettre l'app dans un `<iframe style="width:390px">` d'un fichier HTML local. Pour la carte 3D réelle il faut l'extension Claude in Chrome (même compte que Claude Code ; elle s'est déconnectée après un `/login` avec un autre compte) et le hook `window.__srmMap` (mode développement) avec `flyTo`.

## 4. Où est quoi

```
README.md · CLAUDE.md · HANDOFF.md        entrée, contexte automatique, ce fichier
docs/            README.md (index) · HISTORY.md (journal) · DESIGN_SPEC.md · FORECAST_SCHEMAS.md
                 BRAND.md · RESEARCH.md · OPEN_SOURCE.md · research/01…09-*.md (notes de recherche, lire les UNVERIFIED)
legacy/          carnet, classeur, README et requirements d'origine du stage (préservés, non utilisés par l'app)
platform/        application (React 19 / Vite 7 + API Node/SQLite)
  src/pages/     Landing, Overview, MapPage, QualityPage, CyclePage, RegionsPage, ForecastPage, SourcesPage
  src/components/ Shell, RegionSelector, RegionOverview, RegionMap, MapView (MapLibre 6, 3D), QualityPanel, RainPanel…
  src/lib/       regions.js (routage, helpers), forecast.js (validation, verdict), format.js, constants.js
  server/        app.mjs (auth, qualité, météo), rain.mjs (/api/rain), csv.mjs
  public/data/   region.json (installations, instantanés, sources) · regions.json (12 régions) · national-bulletin.json
                 storage-reconstruction.json · fill-forecast.json · *.geojson (régions, Souss-Massa, provinces)
  public/brand/  logo SRM-SM officiel · operators/ (12 logos + LOGOS.json) · public/landing/ (captures réelles)
  pipeline/      archive_bulletins.sh · satellite/ · rain/ · forecast/ (scripts Python, venv à recréer)
  data-raw/      données brutes datées avec README par dossier (bulletins PDF, satellite, pluie, dams, history, forecast/v2)
  tests/         backend, region, regions, region-view, rain, forecast, storage-reconstruction
```

## 5. État par fonction (vérifié le 19 nov. 2026)

| Fonction | État |
| --- | --- |
| Design ERP, couleurs du logo, 44 px mobile, FR | fait ; 6 écrans vérifiés à 390 px sans débordement |
| Landing `#/` | refaite, vérifiée desktop + mobile ; chiffres lus dans les JSON à l'exécution |
| Cadre Souss-Massa + 6 provinces (HDX/OCHA, CC BY-IGO) | fait, sur la carte et le sélecteur |
| Sélecteur de région (12 SRM, statut daté, preuve, sources, **12/12 logos**) | fait ; pilote Vue d'ensemble et Carte ; voisines calculées sur les frontières |
| Page « Régions & collaboration » | fait ; proposition d'analyse, **jamais** un lien physique ; aucun volume transférable (testé) |
| Données barrages | bulletin **18 nov. 2026** : 383,13 / 722,83 Mm³, 53,00 % (19,56 % l'an dernier) ; 9 bassins nationaux |
| Pluie | `/api/rain` (modélisée, 30 j + 7 j) affichée dans `RainPanel` ; ERA5 1990-2026 par bassin ; gradient nord-sud |
| Reconstitution satellite + prévision | en ligne mais **non fiable par barrage** (voir §6) |
| 3D barrages / dessalement | colonnes construites (`MapView.jsx`), **illisibles à l'échelle régionale, non validées** ; légende masquée |
| Qualité de l'eau | annexe : analyses importées par l'utilisateur, aucun indice |
| Compte, SQLite, CSV | inchangés, testés |

## 6. Ce que la science permet (ne pas surpromettre)

- **Satellite** : la surface d'eau Sentinel-2 (NDWI>0) suit bien la **tendance** (plus/moins d'eau qu'à la même date de 2025), pas le **volume par barrage** : la surface sature (Youssef Ben Tachfine, Abdelmoumen) et on n'a ni courbe hauteur-volume ni stock mort. Validation indépendante 18 nov. 2025 : −8,7 %, −67,8 %, +52,5 %, −27,4 % par barrage ; région −10,6 % **seulement par compensation d'erreurs**. Le recalibrage v2 (`data-raw/forecast/v2/`) n'est pas adopté : Aoulouz s'améliore (−2,4 %) sur un régime unique, Youssef Ben Tachfine se dégrade (+44 %). Pour le volume, la source reste le bulletin officiel.
- **Prévision** : gain de 0,057 sur la persistance (87 mois, une année hydrologique laissée de côté à chaque fois) → la page affiche « gain négligeable : ne pas utiliser pour décider » (seuil `SKILL_MIN` 0,10). Elle prédit la reconstruction, pas le stock officiel ; lâchers, irrigation et eau potable ne sont pas modélisés.
- **Pluie ERA5** : surestime ≈ ×1,5 vs la station ABHSM de Youssef Ben Tachfine (r ≈ 0,9, bien pire en saison sèche) ; correction validée à ce seul point. ERA5-Land renvoie `null` sur Open-Meteo → ERA5 25 km utilisé.
- **Transferts** : seul lien inter-bassins en service trouvé = Sebou→Bouregreg (15 m³/s). **Aucun lien physique documenté vers le Souss-Massa.** ≈ 70 % de l'eau potable du Grand Agadir vient du dessalement de Chtouka (1 736 l/s), pas des barrages.
- **Données manquantes (aucune source ouverte trouvée)** : historique des stocks par barrage (archive du bulletin : 18 PDF du 29 oct. au 18 nov. 2026, rien avant), stock mort, courbes surface-volume, demande par zone, quartiers alimentés.
- Open-Meteo gratuit = non commercial ; licences et attributions : `docs/OPEN_SOURCE.md`. Logos = marques de leurs titulaires, sans licence de réutilisation (provenance dans `LOGOS.json`).

## 7. Suite recommandée (par priorité)

1. **Rendre les colonnes 3D lisibles et valider visuellement** (reconnecter l'extension Chrome). Rendre aussi la légende.
2. **Corriger les coordonnées des barrages dans `region.json`** : celle de Youssef Ben Tachfine est à ~28 km du plan d'eau réel, Abdelmoumen ~6 km ; repartir des polygones `platform/data-raw/satellite/polygons/*.geojson`.
3. **Faire suivre la région au bloc météo (toujours Agadir), à la recherche (⌘K) et aux pages Qualité/Cycle** (aujourd'hui : simple avertissement).
4. **Archiver chaque jour le bulletin** (`platform/pipeline/archive_bulletins.sh`, non planifié) et le transcrire (pas d'OCR installé : demander avant d'installer `tesseract`) ; chaque nouvelle paire surface/stock élargit la plage de calage.
5. Ajouter à `region.json` les faits déjà vérifiés non intégrés : Mokhtar Soussi 50 → 281 Mm³ (surélévation > 85 %, mise en service début 2027, Le360 15 oct. 2026), ONEE Chtouka (travaux 2018, ~1,6 M d'habitants), Aourir ~1 600 m³/j.
6. Améliorer les logos faibles : Rabat-Salé-Kénitra (image LinkedIn basse résolution), Fès-Meknès (petit WebP ; un PNG filigrané plus net existe), Tanger (version tierce).
7. Production (seulement avec son accord) : hébergement/identité, HTTPS, sauvegardes, e-mail de vérification, rôles d'équipe, revue de sécurité, offre Open-Meteo commerciale, accord des opérateurs pour les logos. L'API Node/SQLite n'est pas un Worker Cloudflare : ne pas publier le front seul.

## 8. Git

Remote `https://github.com/mouad-abaaqil/WaterQualityProject.git`, branche `main`, HEAD d'origine `accae52`. Tout le travail est **local et non commité** (`legacy/`, `docs/`, `platform/`, `CLAUDE.md`, `HANDOFF.md` non suivis ; carnet, classeur et `requirements.txt` d'origine déplacés dans `legacy/`, donc « supprimés » côté Git). Ne pas reset ni clean. Hors commit : `platform/data/` (SQLite privée), `.env`, `node_modules/`, `dist/` (déjà ignorés par `platform/.gitignore`). `data-raw/` pèse ≈ 21 Mo (19 Mo de PDF de bulletins) : décider avec lui de ce qui entre dans Git.
