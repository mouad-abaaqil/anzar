# Working in SRM-SM

**Lis `HANDOFF.md` d'abord** (but, façon de travailler avec le propriétaire, état, suite). Journal détaillé : `docs/HISTORY.md`. Index de la documentation : `docs/README.md`.

- Anzar (nom national, 23 nov. 2026) : voir HANDOFF §2bis et docs/ANZAR_CONTRACT.md.
- But : outil de pilotage des ressources en eau (barrages, dessalement, pluie, comparaison des régions du Maroc, sélecteur de SRM par région avec logos) ; la qualité de l'eau est une annexe. Interface en **français**. Propriétaire francophone, veut de l'autonomie et de la vitesse.
- Application : `platform/` (React 19/Vite 7 + API Node/SQLite). Démarrer : `cd platform && npm ci && npm run dev`. Tests : `npm test` (100) ; build : `npm run build`.
- Données : `platform/public/data/*.json` (sources, dates, licences dans chaque fichier) ; brutes et scripts : `platform/data-raw/`, `platform/pipeline/` (README dans chaque dossier). Matériel d'origine du stage : `legacy/` (à préserver, non utilisé par l'app).
- **Sous-agents : Sonnet, pas Haiku. Appelle réellement l'advisor avant de conclure. Arrête les sous-agents terminés.**
- **Ne jamais réinitialiser, nettoyer ni commiter sans accord explicite.** Beaucoup de travail local non commité.
- Honnêteté : distinguer instantané public daté, météo modélisée, estimation satellite, analyses importées. Jamais de relevé en direct, tracé de conduite, volume transférable, indice de qualité ou potabilité inventés. Ne pas dire qu'une vérification a été faite si elle ne l'a pas été.
- Marque : prototype indépendant issu d'un stage à la RAMSA ; ne pas laisser croire à un portail officiel. Le logo SRM-SM et les logos des autres SRM sont des marques de leurs titulaires.
- MapLibre 6 : ne pas retirer l'import Vite du worker ni `setWorkerUrl` dans `MapView.jsx`.
