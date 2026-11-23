# data-raw — données brutes datées

Données téléchargées ou transcrites, avec leur provenance. L'application ne les lit pas directement : elle lit `../public/data/*.json`, produits à partir d'elles. Chaque dossier indique source, date de récupération et licence.

| Dossier | Contenu | Remarque |
| --- | --- | --- |
| `bulletins/` | 18 PDF du bulletin quotidien des barrages (29 oct. → 18 nov. 2026), `souss-massa-series.json` (page 10 transcrite, valeurs 2025 lues sur les repères) | PDF en images sans texte, lus visuellement ; 6, 10 et 14 nov. introuvables ; rien avant le 29 oct. ; ≈ 19 Mo |
| `national/` | `bulletin-2026-11-18.json` : 9 bassins, 69 barrages | lu visuellement, sommes vérifiées ; noms français non confirmés |
| `satellite/` | polygones de retenue (OSM + extension NDWI), séries de surface d'eau Sentinel-2 2017-2026 pour 4 barrages | `*-series.json`, `bulletin-date-areas.json` |
| `rain/` | pluie ERA5 mensuelle 1990-2026 par bassin amont, station ABHSM Youssef Ben Tachfine 1967-2024, biais, terciles, prévision 16 j | ERA5-Land indisponible sur Open-Meteo → ERA5 |
| `dams/` | dimensions de 14 barrages (Global Dam Watch v1.0, CC BY 4.0) | stock mort, cote normale, courbes surface-volume : absents |
| `history/` | 5 barrages du Tensift (août-oct. 2026), liste ABHSM des barrages | ODbL ; pas de série Souss-Massa |
| `forecast/v2/` | recalibrage v2 (repères 2025, tableaux de validation) | **non adopté** ; voir `results.json` |

Les fichiers `*.csv` sont ignorés par le `.gitignore` racine (sauf exception) : décider avec le propriétaire de ce qui est versionné.
