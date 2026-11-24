# Anzar : système de design (refonte, phase 0)

Spec exécutoire pour **une seule application** (landing et outil dans le même style). Elle remplace `DESIGN_SPEC.md` (thème clair SRM-SM) au fil de la migration. Sources : `platform/src/design/tokens.css` (valeurs), `kit.css` et les composants de `platform/src/design/`. Démo : `#/kit` (temporaire). Contrôle : `npm run check:design`.

Références de ton du propriétaire : blackbird / imex / tirion (abq.capital) : un accent, énorme titre condensé, micro-labels monospace en majuscules, produit montré tout de suite.

> **Palette v2 (23 nov. 2026) : voir `DESIGN_ANZAR_V2.md`.** Thème clair « eau » par défaut, sections « profondeur » bleu SRM (`.az-deep`), accent bleu SRM, action jaune SRM, vert SRM pour « confortable ». Les règles 1 et 2 ci-dessous et le tableau du §11 décrivent l'ancien thème sombre et sont remplacés par la v2 ; le reste (grille, typographie, mouvement, états, écriture, composants, contrôle) reste en vigueur. Partout où le texte v1 dit « cyan » (§6 sélection, §7 carte), lire `--az-accent` = bleu SRM.

## 1. Règles absolues
1. ~~Thème sombre partout~~ (remplacé, v2) : **thème clair par défaut**, sections héros en `.az-deep`.
2. (v2 : accent bleu SRM #12508F, action jaune `--az-action` #FAB61F ; voir V2.) Ancien texte : **un accent : cyan `--az-accent`** (#5FD4E6, celui du logo) pour l'action, la sélection, le focus et le chiffre clé. **Ocre `--az-ochre`** : éditorial seulement (un mot de titre, un micro-label), jamais pour une donnée. Corail : réservé au logo.
3. **Aucune couleur ni police en dur** hors `tokens.css`. CSS : `var(--az-*)`. MapLibre / canvas : `colors.*` importé de `src/design/colors.js` (généré, `npm run gen:colors`).
4. **Peu de texte.** Un chiffre, un libellé, une pastille. Le reste au toucher.
5. Classes préfixées `az-` ; jamais de règle sur un élément nu (`button`, `h1`) dans le kit tant que `styles.css` existe.

## 2. Grille et surfaces
- Conteneur `.az-container` : max 1440 px, marges `--az-margin` (16 à 48 px), grille 12 colonnes, gouttière 24 px.
- Élévation = surface + filet, pas d'ombre : `--az-bg` < `--az-surface-1` (panneaux) < `-2` (popovers) < `-3` (infobulles, toasts).
- Filets 1 px : `--az-line` (décor), `--az-line-strong` (bord de carte), `--az-line-control` (bord d'un contrôle, ≥ 3:1).
- Ombres : seulement `--az-shadow-pop` (popover, toast) et `--az-shadow-sheet`.

## 3. Typographie
| Rôle | Police | Taille (token) | Usage |
| --- | --- | --- | --- |
| Héros | IBM Plex Sans Condensed 600, majuscules | `--az-fs-hero` 44 → 176 px | une question par écran (« Combien de mois d'eau reste-t-il ? ») |
| H1 / H2 / H3 | Plex Sans Condensed 600 | `--az-fs-h1` 40 → 88, `-h2` 28 → 44, `-h3` 22 | titres de page, de section, de panneau |
| Chiffre | Plex Sans Condensed 600 | `--az-fs-stat` 40 → 64 | `Stat` |
| Texte | police système | 16 / 14 px | phrases, libellés |
| Micro-label | IBM Plex Mono 500, MAJUSCULES, interlettrage 0,14em | 12 px | repères : « BARRAGES · 23 NOV. 2026 », boutons, onglets |

Tailles en rem sur une racine à 100 % (16 px par défaut, respecte le réglage du navigateur). L'ancien `styles.css` fixe la racine à 14 px : la démo `#/kit` la remet à 100 % ; la migration devra retirer ce 14 px.
Écrire les micro-labels en casse normale dans le code (le CSS met en majuscules : les lecteurs d'écran lisent mieux). Chiffres tabulaires partout. Polices : @fontsource, OFL (voir `OPEN_SOURCE.md`), sous-ensemble latin seulement.

## 4. Espacements, rayons, couches
- Espacement base 4 : `--az-sp-1` 4 · 2 8 · 3 12 · 4 16 · 5 24 · 6 32 · 7 48 · 8 64 · 9 96 · 10 128.
- Rayons nets : `--az-r-xs` 2 (pastilles) · `-sm` 4 (boutons, contrôles) · `-md` 8 (panneaux) · `-lg` 14 (haut du bottom sheet) · `-pill`.
- Couches : sticky 10 < popover 50 < scrim 80 < sheet 90 < toast 100.

## 5. Mouvement
- Durées `--az-dur-1` 120 ms (survol, couleur), `-2` 200 ms (apparition), `-3` 320 ms (panneau). Courbe `--az-ease-out` (0.2, 0, 0, 1) ; `--az-ease-in-out` pour les allers-retours.
- On anime opacité et transform, jamais la mise en page.
- `prefers-reduced-motion: reduce` : les trois durées passent à 1 ms (dans `tokens.css`), pas de translation au clic, pas d'orbite automatique de caméra 3D.

## 6. États
- **Survol** : seulement sous `@media (hover: hover)` ; éclaircit le fond ou le bord.
- **Focus visible** : anneau 2 px `--az-focus`, décalage 2 px (−2 px dans une liste découpée). Jamais retiré.
- **Désactivé** : fond `--az-surface-2`, texte `--az-text-faint` (≥ 4,5:1), curseur interdit ; pas d'opacité globale.
- **Sélectionné** : bord cyan + `--az-accent-soft` ; `aria-selected` / `aria-current`.
- Cibles tactiles **≥ 44 × 44 px** (`--az-touch`) ; une pastille peut paraître petite, sa zone de clic fait 44 px.

## 7. Couleurs sémantiques des données
Chaque catégorie a **trois indices : couleur, glyphe, mot**. Jamais la couleur seule.

| Bande (mois de réserve) | Token | Glyphe | Seuils (hypothèses, `src/lib/balance.js`) |
| --- | --- | --- | --- |
| Critique | `--az-band-critique` | ▲ | moins de 6 mois |
| Tendu | `--az-band-tendu` | ◆ | 6 à 18 mois |
| Confortable | `--az-band-confortable` | ■ | plus de 18 mois |
| Sans donnée | `--az-band-na` (filet pointillé) | — | pas de barrage suivi |

Sahara (Laâyoune, Dakhla, sans bassin) : **flux** dessalement ÷ demande potable, quatre bleus `--az-flux-0` à `-3` (du plus faible au plus fort), glyphe ≈, mot « flux » dans la légende. Bleus ≠ bandes : on ne met jamais les deux échelles dans la même légende.
Sur la carte : remplissage + motif ou contour distinct pour « sans donnée » (pointillé) et les régions en flux (contour tireté), étiquette au survol. L'accent cyan ne sert pas de couleur de donnée.

## 8. Provenance (divulgation progressive)
Une pastille `ProvenanceChip` à côté de chaque chiffre : **● sourcé**, **◐ dérivé**, **○ hypothèse** (formes différentes, nom dans le libellé accessible). Toucher, clic ou Entrée : détail (source, date, lien, note) ; survol seulement sur appareil à souris ; Échap ferme et rend le focus. Pas de note de bas de page sous chaque carte : la page Sources garde le détail complet. Rappels d'honnêteté (`CLAUDE.md`) inchangés : « modélisé », « estimation satellite », « projection » restent écrits en clair à côté du chiffre concerné.

## 9. Écriture
- Français, **vouvoiement** quand on s'adresse à la personne (« Choisissez une région ») ; sinon tournure impersonnelle ou nominale (« Pluie de l'année »). L'interface actuelle n'a ni « tu » ni « vous » : on garde ce ton neutre et on vouvoie partout ailleurs.
- Une phrase = une idée, 12 mots max dans l'interface. Titres en questions concrètes.
- Pas de jargon : « mois de réserve » (pas « couverture »), « remplissage » (pas « taux de remplissage moyen pondéré »), « eau de mer dessalée », « pluie prévue (modèle) ».
- Unités toujours visibles (mois, %, Mm³), virgule décimale, espace insécable avant « % ».
- Ne jamais prétendre au direct, au temps réel ni au statut officiel. Les mentions négatives obligatoires (« pas un relevé en direct », « pas un portail officiel », « projection modélisée ») restent, en clair.
- Interdits : points d'exclamation, emojis, badges « Nouveau ».

## 10. Composants (`platform/src/design/`)
`Button` (primary / secondary / ghost) · `MicroLabel` · `Panel` · `Stat` (chiffre + unité + libellé + pastille + bande) · `ProvenanceChip` · `Tabs` (ARIA, flèches) · `RegionSwitcher` (12 icônes SRM sur tuile claire, `regions` de `public/data/regions.json`) · `Slider` (input range natif) · `Legend` (`kind="bands"` ou `"flux"`) · `ToastProvider` / `useToast` (région `role="status"`) · `Sheet` (`<dialog>` natif : panneau à droite, bottom sheet sous 760 px). Import : `import { Stat } from '../design'` (ou `../design/index.js`).

## 11. Contrastes (calculés, WCAG 2.x, `scripts/design-lib.mjs`)
**Périmé (thème sombre v1).** Tableau à jour : `npm run check:design -- --contrast` (125 paires, palette v2, toutes conformes au 23 nov. 2026). Résumé v2 dans `DESIGN_ANZAR_V2.md` §2–3.

| Premier plan | Rôle | Min | Rapports par fond |
| --- | --- | --- | --- |
| text | texte | 4.5 | bg 17.62 · surface-1 16.73 · surface-2 15.63 · surface-3 14.20 |
| text-muted | texte | 4.5 | bg 9.31 · surface-1 8.84 · surface-2 8.26 · surface-3 7.50 |
| text-faint | texte | 4.5 | bg 6.05 · surface-1 5.74 · surface-2 5.36 · surface-3 4.87 |
| accent | texte | 4.5 | bg 11.46 · surface-1 10.88 · surface-2 10.17 · surface-3 9.24 |
| ochre | texte | 4.5 | bg 8.89 · surface-1 8.44 · surface-2 7.88 · surface-3 7.16 |
| band-critique | texte | 4.5 | bg 7.46 · surface-1 7.08 · surface-2 6.61 · surface-3 6.01 |
| band-tendu | texte | 4.5 | bg 11.91 · surface-1 11.31 · surface-2 10.56 · surface-3 9.60 |
| band-confortable | texte | 4.5 | bg 10.92 · surface-1 10.37 · surface-2 9.69 · surface-3 8.80 |
| flux-3 | texte | 4.5 | bg 14.52 · surface-1 13.79 · surface-2 12.88 · surface-3 11.70 |
| accent-ink | texte sur bouton | 4.5 | accent 10.61 |
| accent-ink | texte sur bouton survolé | 4.5 | accent-hover 12.96 |
| ochre-ink | texte sur ocre | 4.5 | ochre 8.54 |
| line-control | non-texte | 3 | bg 3.90 · surface-1 3.70 · surface-2 3.46 · surface-3 3.14 |
| focus | non-texte | 3 | bg 11.46 · surface-1 10.88 · surface-2 10.17 · surface-3 9.24 |
| band-na | non-texte | 3 | bg 3.90 · surface-1 3.70 · surface-2 3.46 · surface-3 3.14 |
| flux-0 | non-texte | 3 | bg 3.99 · surface-1 3.78 · surface-2 3.53 · surface-3 3.21 |
| flux-1 | non-texte | 3 | bg 6.16 · surface-1 5.85 · surface-2 5.47 · surface-3 4.97 |
| flux-2 | non-texte | 3 | bg 9.62 · surface-1 9.13 · surface-2 8.53 · surface-3 7.75 |

Filets `--az-line` / `--az-line-strong` : décoratifs (< 3:1), jamais seuls pour délimiter un contrôle. Logo et tuiles des icônes SRM non mesurés (images).

## 12. Contrôle
`npm run check:design [-- chemins]` : échoue (code 1) si un `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()` ou une `font-family` littérale apparaît dans `src/**/*.{css,jsx}` hors exceptions ; vérifie aussi que `colors.js` est à jour et que les paires ci-dessus passent AA (`-- --contrast` imprime le tableau). Heuristique : commentaires retirés, en CSS seules les valeurs de déclaration sont lues (un sélecteur `#add` n'est pas une couleur). `font-family` doit valoir `var(--az-font-*)`, `inherit` ou `initial`.
Exceptions (liste `EXCEPTIONS` en tête du script, une ligne motivée chacune) : `src/design/tokens.css`. `colors.js` est un fichier `.js` généré. Lacune connue : les `.js` ne sont pas scannés.
État au 23 nov. 2026 : **170 occurrences dans 15 fichiers existants** (`src/tokens.css`, `styles.css`, pages et cartes). Chaque agent qui migre une page doit la faire passer à zéro.
