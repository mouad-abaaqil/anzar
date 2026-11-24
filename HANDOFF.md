# Anzar — passation (état au 25 novembre 2026)

**Projet clôturé et en ligne** : https://anzar.abq.capital. Lire ce fichier en premier, puis `CLAUDE.md`, puis `docs/README.md` (index). Journal ancien (ère SRM-SM, jusqu'au 19 nov.) : `docs/HISTORY.md`.

## 1. Le but (les mots du propriétaire, Mouad, francophone)
Un observatoire **national de l'eau du Maroc**, visuel, interactif et en 3D : réserves des barrages, pluie, dessalement, **autosuffisance par région**, scénarios sur 10 ans, comparaison des régions et leviers (sans aucun volume « transférable »), avec des visuels clairs pour le grand public. Il sert aussi de **campagne de sensibilisation** à l'importance de l'eau et des barrages. Une seule application : une carte 3D plein écran comme scène, un récit d'entrée (contexte, problématique, chiffres, « Comprendre l'eau », simulateur), puis un tableau de bord (Aujourd'hui / Demain / Ensemble). Style : celui de ses sites (blackbird, imex, tirion .abq.capital) mais en thème clair « eau » aux couleurs des SRM (bleu #12508F, jaune #FAB61F, vert #57B24A). Nom : **Anzar** (dieu amazigh de la pluie). Prototype indépendant issu d'un stage à la RAMSA, **jamais présenté comme un portail officiel**.

## 2. Comment travailler avec lui
- **Autonomie et vitesse**, rapports courts, honnêtes et chiffrés (vu / non vu). Il demande souvent « barre de progression + temps restant » : donner les deux.
- **Accord explicite pour chaque commit, push et déploiement** (un accord ne vaut que pour le lot concerné). Ne jamais réinitialiser ni nettoyer le dépôt.
- **Sous-agents : Sonnet (Opus pour la conception), jamais Haiku.** Appeler réellement l'advisor avant de conclure. Arrêter les agents terminés.
- **Le Mac chauffe** : le rendu 3D logiciel (Chrome sans interface) peut atteindre 900 % de CPU. Captures et tests navigateur **un à la fois** via `sh platform/scripts/with-capture-lock.sh <commande>`, sur la version de production, jamais en parallèle ; la spec `03-regions` est très lourde. L'application Messages de macOS peut rester coincée à 100 % de CPU (⌘Q).

## 3. En ligne, dépôt, déploiement
- **Site** : Worker Cloudflare, fichiers statiques seuls (`platform/wrangler.jsonc`), domaine personnalisé `anzar.abq.capital` (aussi `anzar.abaaqil-com.workers.dev`). Pas de repli SPA : `/api/*` répond 404 ; la pluie appelle Open-Meteo directement ; les pages annexes (Qualité, Cycle, compte) affichent « Disponible uniquement dans la version serveur ».
- **Redéployer** : `cd platform && sh scripts/deploy.sh` (build `VITE_STATIC=1` puis `wrangler deploy`). Wrangler est connecté (binaire de `~/Developer/abaaqil.com/node_modules/.bin/wrangler`, sinon `npx wrangler login`). **Revenir en arrière** : `wrangler deployments list` puis `wrangler rollback <version-id>`. Versions de repère : `f3dbaa37` = version finale du 25 nov. 2026 (commit 06d69bf, avec « Comprendre l'eau ») ; `1bb1abc7` = version du 24 nov. d'avant la refonte « eau d'abord » (commit 6b0b7d9).
- **Pourquoi pas le serveur Debian** : son tunnel Cloudflare est géré à distance (route = tableau de bord ou jeton d'API, absent) et la RAM est limitée. Accès serveur si besoin : `ssh.abq.capital` (cloudflared + clé), notes dans `~/Developer/ABQ SERVER/ABQ-SERVER.md`.
- **Dépôt** : https://github.com/mouad-abaaqil/anzar (**privé**), remote `anzar`, branche locale `anzar` poussée sur `main` (`git push anzar anzar:main`). L'ancien remote `origin` (WaterQualityProject, stage) est conservé tel quel.

## 4. Lancer, tester
Node ≥ 24. Depuis `platform/` :
- `npm ci`, puis **`npm run build && npx vite preview`** (recommandé). `npm run dev` charge la carte 3D très lentement en rendu logiciel.
- `npm test` : **164 tests** unitaires et de données ; `npm run check:design` : aucune couleur ni police en dur hors `src/design/tokens.css`, contrastes AA calculés (125 paires).
- Navigateur : `npx playwright test e2e/<fichier>.spec.js`, **un fichier à la fois** (13 specs : parcours, 12 régions, mobile, sans WebGL, accessibilité axe, honnêteté, défilement, sensibilisation) ; `npm run e2e:shots` régénère `docs/screenshots/` (~4 min). `E2E_BASE_URL=https://anzar.abq.capital` pour tester le site en ligne.

## 5. Où est quoi
```
README.md · CLAUDE.md · HANDOFF.md        entrée (le README est la « landing » du dépôt, avec captures)
docs/             index (README.md), contrats, design, recherche (14 notes), screenshots/, brand-anzar/, archive/
legacy/           carnet, classeur, README d'origine du stage (préservés, non utilisés par l'app)
platform/
  src/hub/        HubApp (routes, barre, tiroir Sources) · HubMap (carte 3D, globe, champs, barrages, liens) · Story (accueil)
                  Awareness (chapitre « Comprendre l'eau ») · MiniSim · WaterFx + water/ (animations d'eau) · panel/ (3 onglets)
  src/design/     tokens, kit de composants, couleurs pour MapLibre (`npm run gen:colors`)
  src/lib/        balance.js (moteur de bilan et scénarios), openData.js, forecast.js, regions.js
  public/data/    jeux de données (sources, dates, licences dans chaque fichier)
  data-raw/       données brutes datées (bulletins PDF, barrages, liens, bilan, sensibilisation) + notes
  pipeline/       scripts de collecte ; scripts/ : deploy, verrou de capture, contrôle du design
  server/         API Node/SQLite (Qualité, compte) : conservée, NON déployée
  e2e/ tests/     Playwright et tests Node
```

## 6. État par fonction (vérifié le 24 nov. 2026)
| Fonction | État |
| --- | --- |
| Accueil (contexte, problématique, barrages 3D, chiffres, simulateur intégré) | fait ; vu desktop 1280 et mobile 390 |
| Chapitre « Comprendre l'eau » (6 étapes, 18 faits sourcés) | fait ; vu desktop et mobile |
| Tableau de bord (Aujourd'hui / Demain / Ensemble, 12 régions) | fait ; Sahara en indicateur de flux (dessalement ÷ potable) |
| Carte 3D : relief, régions, 96 barrages localisés dont 43 avec remplissage, 7 liaisons dessinées, champs agricoles 3D, globe d'ouverture | fait ; le globe (6 s) n'a jamais été vu en capture |
| Données du jour | bulletin du **23 nov. 2026** (66,09 %) ; remplissage de 69 barrages lu visuellement, sommes vérifiées |
| Sources et licences | tiroir Sources + `docs/OPEN_DATA.md` ; aucune clé API requise pour l'affichage actuel |
| Qualité de l'eau, compte, SQLite | annexe, non déployée |

## 7. Limites connues (à ne pas cacher)
1. Le moteur n'additionne pas `otherIrrigationMm3PerYear` (614 Mm³/an pour Souss-Massa) : demande agricole sous-estimée ; les apports récents de Souss-Massa valent ≈ 0,22 × la moyenne (HCP 2025) donc le scénario « normal » est trop optimiste ; les facteurs sec/normal/humide ne sont pas recalés. Un scénario n'est pas une prédiction.
2. Guelmim (39 mois) : arithmétique sur des entrées que la source HCP contredit (eau potable = nappes, pas le barrage Fask).
3. Nappes non modélisées (« non modélisé », jamais 0). Le satellite ne couvre que Souss-Massa : tendance, pas volume ; la prévision a un gain négligeable.
4. Sebou→Bouregreg documenté mais non dessiné (prise non localisée) ; **aucun lien physique documenté vers le Sud** ; 98 grands barrages sans coordonnée sourcée (Bin el Ouidane compris) ; capacités par barrage non publiées (dérivées stock/taux).
5. Sensibilisation : plusieurs faits vérifiés viennent de copies Drive de l'auteur de la vidéo (documents d'institutions) et non des sites officiels ; 5 faits non vérifiés ne sont jamais affichés ; les chiffres de 2024 sont datés.
6. Logos des SRM publics sans licence de réutilisation (décision du propriétaire) ; Open-Meteo gratuit = non commercial ; nom Anzar : anzar.ma, .io, .app déjà pris, pas de recherche OMPIC.
7. Tests : rendu logiciel seulement (jamais sur un vrai GPU, téléphone, Firefox, Safari) ; fluidité de la 3D à confirmer sur GPU ; la vérification « touche Début » de la spec 10 est non bloquante en rendu logiciel ; la spec 08 (performance) échoue seulement quand la machine est saturée.

## 8. Suite possible (aucune n'est urgente)
Valider le rendu sur un vrai GPU et un vrai téléphone ; corriger le moteur (limite 1) et recaler les facteurs hydrologiques ; localiser les 98 barrages manquants et les capacités publiées ; déployer l'API (compte, qualité) sur le serveur ou la réécrire pour Workers ; `viewport-fit=cover` dans `platform/index.html` ; décider du statut des logos des SRM ; recherche de marque OMPIC pour « Anzar » ; archiver chaque jour le bulletin (`platform/pipeline/archive_bulletins.sh`, non planifié) pour constituer un historique par barrage.
