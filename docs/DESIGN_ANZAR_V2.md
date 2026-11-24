# Anzar : design v2 — thème « eau » (analyse et décision)

23 nov. 2026. Remplace la règle 1 de `DESIGN_ANZAR.md` (« thème sombre partout ») ; le reste de ce document (grille, typographie, mouvement, états, écriture, composants) reste valable. Valeurs : `platform/src/design/tokens.css` ; chaînes pour MapLibre : `colors.js` (`npm run gen:colors`) ; contrôle : `npm run check:design` (125 paires AA, 0 échec).

Demande du propriétaire : favicon toujours sur fond transparent ; respecter les couleurs des SRM ; remettre en cause le sombre pour une campagne publique sur l'eau, interactive et en 3D. Références de ton maintenues : blackbird / imex / tirion (typo condensée, micro-labels mono, produit en héros, peu de texte, un accent).

## 1. Palette réelle des 12 icônes SRM
Méthode : `magick icône.png -colors 10 -format %c histogram:info:-` sur les 12 PNG de `public/brand/operators/icons/` (384 × 384, **RVB opaque sur fond blanc**, aucune transparence), blanc et quasi-blanc écartés. Relevé des teintes dominantes (top 10 de chaque icône) :

| Famille | Icônes où elle apparaît | Exemples mesurés |
| --- | --- | --- |
| Blanc (fond) | 12 / 12 | #FFFFFF |
| Bleu | 11 / 12 (absent de Fès-Meknès) | profonds #13518F (Souss-Massa), #0E4E95 (Dakhla), #0B398C (Rabat), #24449C (Drâa), #055690 (Laâyoune), #2A699C (Oriental) ; vifs #339AD5 (Casablanca), #2091CE (Marrakech), #0289C1 (Béni Mellal), #2598FB (Guelmim) |
| Vert | 10 / 12 (absent de Dakhla et Laâyoune) | #57B24A / #58B24B (Souss-Massa, Casablanca), #54BA5B, #6DB52C, #31AE4A, #02AF60, #0CA354, #40A93A ; foncé #385835 (Béni Mellal) |
| Jaune / orange / or | 8 / 12 | #FAB61F (Souss-Massa), #F9A339 (Drâa), #F39B3D (Dakhla), #EE9635, #F07A24, #F06932, #F6E236 (Oriental), or #CCAF46 (Laâyoune) |
| Rouge | 4 / 12 | #C11B1B (Fès), #DC203C (Guelmim), #BF1825 (Laâyoune), #DF111D (Tanger) |

Lecture : la famille SRM, c'est **du blanc, un bleu profond voisin de #12508F, un vert moyen, un jaune-orangé**. Le rouge est minoritaire. Aucune icône n'est conçue pour un fond sombre : sur le thème sombre, il fallait une tuile blanche autour de chacune.

## 2. Clair « eau » contre sombre
Clair = fond ciel pâle #F4F8FB, panneaux blancs, encre marine #0A2540, accent bleu SRM #12508F, action jaune SRM #FAB61F, vert SRM pour « confortable », sections héros « profondeur » en bleu SRM. Sombre = jeu v1 (#05090C, cyan #5FD4E6).

| Critère | Sombre v1 | Clair « eau » v2 |
| --- | --- | --- |
| Lisibilité grand public | effet « terminal / finance », bon pour un public averti | positif (encre sur clair) : registre d'une campagne publique, d'un service public |
| Contraste AA (calculé, `design-lib.mjs`) | texte 17,6:1, accent 11,5:1 | texte 14,6:1, accent 7,7:1, gris le plus pâle 4,8:1 : tout passe AA |
| Plein soleil (modèle simple : reflet ambiant R ajouté aux deux luminances, R = 0,1 / 0,3 du blanc) | texte 6,7 / 3,5 ; accent 4,6 / 2,6 ; critique 3,2 / 2,0 | texte 6,9 / 3,7 ; accent 5,0 / 3,2 ; critique 4,7 / 3,0 |
| Carte 3D | relief sombre peu lisible (ombres sur fond noir), l'eau ne ressort pas | relief en gris-bleu sur terre claire, eau bleu vif : l'eau devient le sujet |
| Bandes critique / tendu / confortable | couleurs claires, ordre de luminance arbitraire | remplissages ordonnés en luminance (0,34 → 0,21 → 0,09) : séparables en niveaux de gris |
| Cohérence avec les 12 SRM | icônes sur tuiles blanches « collées » au noir | même fond blanc que les icônes ; bleu, jaune et vert SRM repris tels quels |
| Références blackbird / imex / tirion | identiques (fond noir) | on garde la typo condensée, les micro-labels mono, le produit en héros et **un seul accent par surface** ; le noir ne survit que dans les sections « profondeur » |

Sous reflet, le clair garde plus de contraste sur les couleurs secondaires (accent, bandes), celles qui portent l'information ; la différence sur le texte principal est faible. Ce modèle est une approximation, pas une mesure sur écran.

## 3. Décision
**Thème clair par défaut, sections « profondeur » en bleu SRM.**
1. Fond ciel `--az-bg` #F4F8FB, panneaux `--az-surface-1` blancs, encre `--az-text` #0A2540.
2. **Accent = bleu SRM** `--az-accent` #12508F : liens, sélection, focus, chiffre clé. Pas une couleur de donnée.
3. **Action = jaune SRM** `--az-action` #FAB61F (bouton principal, encre #0A2540, 8,7:1, bord `--az-action-edge`). Jamais en texte sur clair (1,8:1). Dans une section profondeur, le jaune devient aussi l'accent (4,6:1 sur #12508F).
4. **Vert SRM** #57B24A = remplissage « confortable ». Texte des bandes : versions foncées (`--az-band-*`, 5,4:1 et plus).
5. Bandes : trois indices (couleur, glyphe ▲ ◆ ■, mot) **et** luminance ordonnée. Remplissages `--az-band-*-fill` : confortable #57B24A, tendu #C8600C, critique #A8201A. Écarts entre bandes voisines : 1,53 et 1,78 (testé, minimum 1,4). Sans donnée : `--az-band-na-fill` gris clair + contour pointillé.
6. Flux du Sahara : quatre bleus, du plus clair (faible) au plus foncé (fort), #4589C2 → #0B3A6E, tous à 3:1 ou plus sur les fonds clairs. L'eau de la carte est un azur plus vif (#2F9BE0) pour ne pas se confondre avec eux.
7. Section « profondeur » `.az-deep` : dégradé #12508F → #0A2E57, texte blanc, accent jaune ; la classe redéfinit les tokens de base, donc tous les composants y fonctionnent sans modification.
8. Logo : arc et crête inchangés ; arc bleu SRM, crête jaune cernée de bleu, niveaux d'eau azur et vert. **Fond transparent partout.** Risque à garder en tête : reprendre la palette exacte de la SRM-SM peut faire croire à un produit officiel. La forme et le nom restent ceux d'Anzar, et la mention « prototype indépendant, pas un portail officiel » reste obligatoire.

Ce qui ne change pas : polices (Plex Sans Condensed + Plex Mono), grille, rayons, mouvements, règles d'écriture et d'honnêteté.

## 4. Fichiers livrés
- `tokens.css` : mêmes noms `--az-*`, valeurs claires. Ajouts : `--az-action*`, `--az-sun`, `--az-water`, `--az-water-soft`, `--az-sky`, `--az-tile`, `--az-page`, `--az-band-*-fill`, `--az-band-*-on`, `--az-flux-on`, `--az-deep-*`, `--az-map-*`.
- `kit.css` : `color-scheme: light` ; bouton principal jaune, nouveau `variant="accent"` (bleu) ; tuiles SRM sur `--az-tile` ; pastilles de légende sur `*-fill` / `*-on` ; `.az-deep`, `.az-deep--flat`, `.az-wave`.
- `scripts/design-lib.mjs` : paires AA (profondeur, glyphes, bouton d'action) et `bandSeparation()` ; `tests/design.test.mjs` mis à jour.
- `public/brand/anzar/` : `mark.svg` (= `mark-on-light.svg`, fonds clairs), `mark-on-deep.svg`, `mark-mono.svg` (currentColor, marine par défaut), `logo.svg`, `logo-on-deep.svg`, `favicon.svg` (transparent ; tons moyens #1E7FD0 / #F2A516 ; variante `prefers-color-scheme: dark` plus claire), `favicon.ico` (16/32/48, transparent), `apple-touch-icon.png` (180, transparent : **iOS remplit la transparence en noir** ; la marque reste lisible sur noir, vérifié en rendu).
- `index.html` : favicon ico + svg + apple-touch-icon, `theme-color` clair (#F4F8FB) et sombre (#12508F), description, Open Graph (titre, description, type, locale, nom). Pas d'`og:image` ni d'`og:url` : pas d'image de partage ni d'adresse publique à ce jour.

## 5. Directives pour les agents de front
**Rythme de page (landing, Story, hub).** Alterner clair et profondeur : héros en `<section class="az-deep">` (question énorme en `.az-hero`, un mot en `.az-accent` = jaune, un bouton `Button` principal jaune, un secondaire), puis sections claires pour les chiffres, la carte et les comparaisons ; au plus une seconde section profondeur (ex. « Ce qui relie : dessalement et transferts ») et un pied de page en `.az-deep`. Sur fond profond, utiliser `mark-on-deep.svg` / `logo-on-deep.svg` ; sur clair, `mark.svg` / `logo.svg`. Le héros actuel de `Story.jsx` (`mark.svg` à 96 px) doit passer à `mark-on-deep.svg` s'il devient profond.

**Un accent par surface.** Sur clair : bleu SRM pour lien, sélection et chiffre clé, jaune seulement pour le bouton principal. Sur profondeur : jaune. Le vert n'est jamais décoratif : il veut dire « confortable ». Pas de dégradé arc-en-ciel, pas de lueurs.

**Typographie.** Inchangée : héros condensé en majuscules, micro-labels mono, texte en police système, 12 mots max par phrase d'interface. Chiffres en `--az-text` (marine) sur clair, blanc sur profondeur ; la bande se lit dans la pastille (glyphe + mot), pas dans la couleur du chiffre.

**Motifs « eau » acceptables.** Vague de bas de section (`.az-wave`, SVG `fill="currentColor"`, `aria-hidden`) ; ondulations concentriques fines (`--az-water` à faible opacité, ou `--az-deep-water` sur profondeur) autour d'un barrage sélectionné ; **niveau qui monte** : remplissage d'une jauge ou d'une silhouette de barrage animé une fois à l'apparition (transform `scaleY`, `--az-dur-3`, rien si `prefers-reduced-motion`) ; goutte du logo comme puce de section. À éviter : gouttes « cartoon », reflets brillants, eau qui coule en boucle, animation permanente, et tout visuel qui suggère un débit, un tracé de conduite ou un volume réel non sourcé.

**Carte MapLibre (`src/hub/HubMap.jsx`).** La carte actuelle charge `styles/dark` et peint avec `colors.bg` / `colors.text` : avec la palette v2, elle s'inverse (relief blanchi, halos blancs sur fond blanc). À faire :
- Fond : `https://tiles.openfreemap.org/styles/positron` (sobre, recommandé ; `bright` si l'on veut plus de routes et de toponymes). Les deux répondent HTTP 200 (curl, 23 nov. 2026).
- `background-color` ← `colors.mapLand` (#F2F4F1) ; couches d'eau du style (`water`, `waterway`) ← `colors.mapWater` (#2F9BE0) et `colors.mapWaterLine` (#1D7FC4).
- Ombrage du relief : `hillshade-shadow-color` ← `colors.mapHillshadeShadow` (#47596B), `hillshade-highlight-color` ← `colors.mapHillshadeHighlight` (#FFFFFF), `hillshade-accent-color` ← `colors.mapHillshadeAccent` (#8D9CAB) ; `setLight` couleur `colors.mapLight`.
- Régions par bande : `colors.bandCritiqueFill`, `bandTenduFill`, `bandConfortableFill` (et non `bandCritique`… qui sont les encres de texte) ; sans donnée : `colors.bandNaFill` + contour pointillé `colors.bandNa`. Pour « atténuer », mélanger vers `colors.mapLand`, pas vers `colors.bg`.
- Sahara : `colors.flux0` → `flux3` (clair = faible), contour tireté `colors.flux3`.
- Contours de régions : `colors.mapBoundary` (#12508F) ; sélection : `colors.mapSelection` (jaune #FAB61F) sur un liseré `colors.mapSelectionCasing` (#0A2540) : distinct de toutes les couleurs de données.
- Étiquettes : `text-color` ← `colors.mapLabel`, `text-halo-color` ← `colors.mapHalo`.
- Infobulles et panneaux posés sur la carte : `--az-surface-3` (blanc) + `--az-shadow-pop`, déjà en place via les tokens.

**Contrôle.** Toute nouvelle couleur passe par `tokens.css` ; si elle sert de texte ou de contrôle, ajouter sa paire dans `CONTRAST_PAIRS` (`scripts/design-lib.mjs`) et relancer `npm run gen:colors && npm run check:design`.
