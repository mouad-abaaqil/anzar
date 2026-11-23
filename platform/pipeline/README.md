# pipeline — scripts de production des données

Scripts Python (satellite, pluie, reconstitution) et un script shell. Ils écrivent dans `../data-raw/` et `../public/data/`. Aucun n'est planifié. **Sûrs à relancer**, mais lents (le satellite lit des centaines de scènes à distance).

- `archive_bulletins.sh [début] [fin]` : télécharge les bulletins quotidiens manquants (idempotent, 1 s entre requêtes, User-Agent générique). **À lancer chaque jour** : il n'existe pas d'archive en ligne.
- `satellite/` : polygones de retenue, séries de surface d'eau Sentinel-2 (API STAC Earth Search, sans clé ; correction du décalage de réflectance de janvier 2022).
- `rain/` : points amont par barrage, pluie ERA5 (Open-Meteo archive), station ABHSM, biais, terciles, prévision 16 jours.
- `forecast/` : calage surface → volume, reconstitution, validation, prévision ; `v2/` : recalibrage non adopté. Voir `forecast/README.md`.

Environnement : Python 3 avec `numpy`, `pandas`, `scipy`, `rasterio`, `shapely`, `pyproj`, `requests` dans un venv à recréer (l'ancien `/tmp/srmsm-venv` est perdu au redémarrage). Utiliser un User-Agent **générique** (jamais le nom du projet ni des données personnelles) pour Overpass, Nominatim, STAC, data.gov.ma.
