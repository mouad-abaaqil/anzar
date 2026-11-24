# Working in Anzar (ex SRM-SM)

**Lis `HANDOFF.md` d'abord** (but, façon de travailler, état, limites, suite). Index de la documentation : `docs/README.md`. Journal ancien : `docs/HISTORY.md`.

- But : **Anzar**, observatoire national de l'eau du Maroc (barrages, pluie, dessalement, autosuffisance par région, scénarios, sensibilisation), carte 3D, interface en **français**. Propriétaire francophone, veut de l'autonomie et de la vitesse. En ligne : https://anzar.abq.capital ; dépôt public (MIT) : github.com/mouad-abaaqil/anzar ; commits signés avec l'adresse noreply GitHub, ne jamais publier l'e-mail personnel.
- Application : `platform/` (React 19 / Vite 7 / MapLibre 6). Lancer : `cd platform && npm ci && npm run build && npx vite preview`. Tests : `npm test` (164), `npm run check:design`, Playwright `e2e/` **un fichier à la fois**. Déployer : `sh scripts/deploy.sh` (Worker Cloudflare, accord requis).
- Données : `platform/public/data/*.json` (sources, dates, licences dans chaque fichier) ; brutes et scripts : `platform/data-raw/`, `platform/pipeline/`. Matériel d'origine du stage : `legacy/` (à préserver, non utilisé par l'app).
- **Sous-agents : Sonnet (Opus pour la conception), pas Haiku. Appelle réellement l'advisor avant de conclure. Arrête les sous-agents terminés.**
- **Ne jamais réinitialiser, nettoyer ni commiter / pousser / déployer sans accord explicite** (un accord ne vaut que pour le lot concerné).
- **CPU : le Mac chauffe.** Captures et tests navigateur un à la fois via `platform/scripts/with-capture-lock.sh`, sur la version de production ; ne pas lancer la spec `03-regions` sans nécessité.
- Honnêteté : distinguer instantané public daté, météo modélisée, estimation satellite, analyses importées, scénarios. Jamais de relevé en direct, tracé de conduite, volume transférable, indice de qualité ou potabilité inventés ; pas de fait sans source ; ne pas dire qu'une vérification a été faite si elle ne l'a pas été. Un chiffre de 2024 n'est pas la situation actuelle.
- Marque : prototype indépendant issu d'un stage à la RAMSA ; ne pas laisser croire à un portail officiel. Les logos des SRM sont des marques de leurs titulaires.
- Design : aucun code couleur ni police en dur hors `platform/src/design/tokens.css` (`npm run check:design`). MapLibre 6 : ne pas retirer l'import Vite du worker ni `setWorkerUrl` dans `HubMap.jsx`.
