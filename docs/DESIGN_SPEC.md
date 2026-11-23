# Spécification de design — poste de travail ERP SRM-SM

Direction : outil de travail dense et calme, type ERP/terminal d'exploitation. Pas de décor, pas de dégradés, pas d'ombres lumineuses, pas d'emoji, pas de phrases d'ambiance. Chaque élément porte une donnée, une action ou une source.

## Couleurs (mesurées dans le logo, voir BRAND.md)
- Bleu `#12508F` : actions principales, titres, navigation active, texte de marque.
- Jaune `#FAB61F` et vert `#57B24A` : remplissages, barres, pastilles, filets d'accent UNIQUEMENT. Jamais en texte sur blanc (contraste insuffisant).
- Blanc `#FFFFFF` surfaces ; page `#F4F6F9` ; lignes `#E4EAF0` ; texte `#19334F` ; secondaire `#5B6E82` (≥ 4.5:1).
- Sémantique : jaune = « à surveiller / en cours », vert = « conforme / en service », gris = « non renseigné ». Pas de rouge inventé sans seuil source.
- Le jaune ou le vert en texte n'est autorisé que sur fond bleu `#12508F` (fond sombre).

## Typographie
- DM Sans (déjà en place). Échelle : 12 / 13 / 14 / 16 / 20 / 28 px. Chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour toute valeur.
- Titres de page 28 px poids 600 ; libellés de champ 12 px poids 500, casse normale (pas de capitales espacées).

## Mise en page
- Barre latérale 232 px, bleu blanc : logo officiel intact sur fond blanc en tête, navigation avec icônes lucide 16 px, état actif = filet gauche vert 3 px + texte bleu.
- Barre supérieure 52 px : sélecteur d'opérateur/région, recherche (⌘K), compte. Fil d'Ariane.
- Contenu : grille 12 colonnes, gouttière 16 px, cartes `border:1px solid var(--line)`, rayon 6 px, sans ombre. Tableaux denses (ligne 36 px), en-têtes collants, tri.
- KPI : valeur 28 px tabulaire, libellé 12 px, date et source en dessous. Toute valeur affiche sa date et sa source.
- Contrôles ≥ 44 px sur mobile (déjà en place), focus visible bleu `#12508F` 2 px.

## Contenu (règles de rédaction)
- Français, phrases courtes, sans promesse. Mention permanente : « Prototype indépendant · pas un portail officiel de la SRM-SM ».
- Aucune métrique, témoignage ou logo client inventé. Aucun relevé « en direct » : distinguer relevé daté, météo modélisée et analyses importées.

## Landing (`#/`)
Sections : en-tête (logo + « Ouvrir l'outil »), promesse en une ligne + capture réelle de l'application, trois blocs (Réserves et barrages · Qualité de l'eau · Cycle de l'eau), bloc « D'où viennent les données » (liste réelle des sources du registre), bloc « Ce que l'outil ne fait pas encore », pied de page avec attribution et licences. Pas de chiffres promotionnels ; les chiffres affichés viennent de `region.json` avec date.

## Interdits
Dégradés, ombres portées marquées, flou, animations décoratives, cartes empilées sans fonction, icônes de remplissage, texte de remplissage.
