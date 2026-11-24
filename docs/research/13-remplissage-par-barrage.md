# 13. Taux de remplissage par barrage (national)

Lu le 2026-11-23. Statut : transcription visuelle du bulletin officiel ; rien d'estimé.

## Résultat

- Le bulletin quotidien (`https://maadialna.ma/sites/default/files/barrages/<date>/ar/etat_global.pdf`, 12 pages-images, sans texte) **contient un tableau par barrage** : pages 4 à 12, une par bassin, avec pour chaque barrage le nom arabe, le **stock en Mm3** et le **taux de remplissage (%)**. 69 barrages au total, 9 bassins.
- Il ne donne **pas la capacité par barrage** (seulement la capacité du bassin en en-tête) : `capacityMm3` reste null ; `derivedCapacityMm3` = stock / taux est de l'arithmétique sur valeurs imprimées (imprécis pour les stocks < 1 Mm3).
- Same-day 2025 par barrage : seulement un trait jaune sur la barre, sans chiffre : non transcrit (null). Le taux 2025 est imprimé au niveau bassin.
- Bulletins postérieurs au 18 nov : seul **2026-11-23** existe (19 à 22 nov : HTTP 404). Archivé dans `platform/data-raw/bulletins/2026-11-23.pdf`.

## Garde-fou (tolérance 0.05 Mm3 sur la somme des stocks)

- 2026-11-18 : les 9 bassins égalent `national-bulletin.json` (écart de stock -0.01 à +0.01 Mm3). Capacité dérivée (somme stock/taux) vs capacité de bassin : écarts de -0.01 à +0.09 Mm3, tous dans la borne d'arrondi calculée par bassin (0.04 à 0.58 Mm3).
- Contrôle indépendant : les 9 barrages Souss-Massa du 18 nov sont identiques (stock et taux) à la transcription antérieure `data-raw/bulletins/souss-massa-series.json`.
- 2026-11-23 : comparé à l'en-tête de chaque page de bassin (pas de `national-bulletin.json` à cette date) : écart de stock -0.01 à +0.02 Mm3 ; capacité dérivée vs capacité de bassin -0.04 à +0.33 Mm3 (Oum Er-Rbia +0.33, borne d'arrondi 0.61, Al Massira contribuant à elle seule environ 0.3). Capacités de bassin identiques au 18 nov. Total des 9 en-têtes : 11 253.49 Mm3 (somme lue, total national imprimé non lu).
- Aucun bassin hors tolérance : toutes les lignes sont `confidence: 'lu'`. Limite : une somme exacte ne détecte pas deux erreurs qui se compensent ; ordre des barrages et valeurs relus une fois.
- Cas à noter : Dkhila (0.11 Mm3 à 48.22 % le 23 nov contre 0.16 Mm3 à 67.79 % le 18 nov), imprimé tel quel.
- Script : `platform/pipeline/dams/check_dam_fill.mjs <date>`.

## Sources ouvertes testées (curl, 2026-11-23)

| Source | Résultat |
|---|---|
| data.gov.ma (CKAN 2.9, API `/data/api/3/action/package_search`) | Accessible, sans clé. Recherches `barrage`, `retenue`, `سد`, `Sebou`, `Loukkos`, `Oum Er-Rbia`, `Moulouya`, `Bouregreg` : 3 jeux au plus (aucun pour les bassins hors Tensift/Souss-Massa). Seul exploitable : « Situation journalière des barrages dans le bassin du Tensift » (ABHT, licence ODbL, XLSX mensuels août-oct 2026, 5 barrages, réserve + taux + capacité normale). Pas de jeu national, rien pour les autres bassins. |
| Jeu ABHT Tensift, octobre 2026 | Capacités normales : Yacoub El Mansour 57.45, Lalla Takerkoust 50.82, Ben Slimane El Jazouli 12.31, Abou El Abbas Sebti 22.37, Moulay Abderrahmane 58.99 (Mm3). Écart relatif avec la capacité implicite du bulletin (18 nov) : Yaacoub El Mansour +0.9 %, Lalla Takerkoust -0.8 %, Ben Slimane El Jazouli +3.7 %, Abou El Abbas Sebti 0.0 %, Moulay Abderrahmane +1.1 % ; cause non établie. Gardées dans `capacityAbhtMm3`, non fusionnées. Le reste du jeu (liste Souss-Massa, pluie Tachfine) ne donne pas de remplissage.
| maadialna.ma | Bulletins PDF seuls ; `/api/barrages` : 404. Pas d'API ouverte trouvée. |
| barrages.ma, eau.gov.ma | Nom de domaine non résolu. |
| water.gov.ma, equipement.gov.ma | Délai dépassé / connexion refusée. |
| GitHub (API de recherche) | `maadialna` : 0 ; « morocco dams » : 9 dépôts ; « barrages maroc » : 6 ; « morocco dam fill rate » : 1. Dépôts non ouverts, donc non vérifiés (UNVERIFIED) ; presque tous sans licence déclarée, seuls `most-oss/Barrages-du-Maroc*` en GPL-3.0. À lire avant tout usage : `redonelach1/MoroccoDams-DataEng-Project`, `Wassim1313/barrages-data`, `hajar-debug/barrages-dashboard-`. |
| Kaggle | Recherche rendue en JavaScript ; l'API des jeux de données demande une clé de compte : non testable ici sans clé. |

Licence/clé : data.gov.ma ODbL, pas de clé ; bulletins maadialna.ma : source ministérielle (Ministère de l'Équipement et de l'Eau), pas de licence explicite lue.

## Fichiers

- `platform/data-raw/dams/fill/dam-fill-2026-11-18.json` (référence validée) et `dam-fill-2026-11-23.json` (le plus récent).
- Alternative pour la capacité par barrage : `public/data/national-dams.json` (Wikipedia/OSM, avec sources) ou les capacités ABHT ci-dessus ; non rapprochées ici.

## Restent null

- `capacityMm3` et `sameDay2025Pct` par barrage : null pour les 69 barrages.
- `name` (translittération) : null pour 8 barrages (خروب, م. لحسن بن المهدي, جمعة, سد على واد زا, الكريزة, منع سبو, أكدز, تويزكي الرمز) ; les autres noms français sont des translittérations non vérifiées (`nameSource`).
- Hors liste autorisée : `platform/data-raw/bulletins/2026-11-23.pdf` ajouté (demandé par la tâche) ; `bulletins/README.md` indique encore 18 bulletins.
