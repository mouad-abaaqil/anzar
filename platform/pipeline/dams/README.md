# Collecte des barrages nationaux (open data)

Script : `build_national_dams.py` (Python 3, bibliothèque standard uniquement).

```
cd platform/pipeline/dams
python3 -I build_national_dams.py            # télécharge tout (Overpass, Wikidata, Wikipedia)
python3 -I build_national_dams.py --reuse    # ne retélécharge que les fichiers absents de data-raw/dams/raw/
python3 -I build_national_dams.py --offline  # relit data-raw/dams/raw/ sans réseau
```

Sorties dans `platform/data-raw/dams/` :
- `national-dams.json` : tableau des barrages localisés (id, name, nameAr?, lat, lon, regionId, basin, river, capacityMm3, yearBuilt?, purpose?, sources, license).
- `national-dams-unlocated.json` : lignes Wikipedia sans coordonnée vérifiable (jamais placées), correspondances ambiguës, points hors de toutes les régions.
- `validation-souss-massa.json` : écarts en km avec les 9 barrages de `public/data/region.json`.
- `national-dams.meta.json` : dates de lecture, instance Overpass utilisée, essais échoués, comptages.
- `raw/` : réponses brutes (OSM, Wikidata, Wikipedia) pour rejouer en `--offline`.

Règles : une coordonnée vient uniquement d'OSM ou de Wikidata ; Wikipedia ne fournit aucune coordonnée. Capacité : table Wikipedia (Mm3) en priorité, sinon Wikidata P2234 converti d'après son unité. Bassin : seulement si le cours d'eau (Wikidata P206) désigne sans ambiguïté un des 9 bassins du bulletin, sinon null. Région : point dans polygone (`morocco-regions.geojson`), les points hors de toutes les régions (îles espagnoles et portugaises, Algérie, Mauritanie) sont exclus.

Licences : OSM ODbL 1.0 (attribution « (c) contributeurs OpenStreetMap »), Wikidata CC0, Wikipedia fr CC BY-SA 4.0 (attribution + partage à l'identique pour les valeurs reprises de la table). Wikidata (WDQS) peut répondre HTTP 429 (limite 1 requête/minute) : le script réessaie après 65 s. Les instances Overpass peuvent répondre 502 ou expirer : il passe à la suivante.
