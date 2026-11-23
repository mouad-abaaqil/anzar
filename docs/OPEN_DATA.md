# Données ouvertes pour Anzar

Inventaire du 23 novembre 2026. Les colonnes « Testé » viennent d'une vraie requête faite ce jour-là avec `platform/pipeline/opendata/probe.mjs` (relançable : `node probe.mjs`) ou d'un `curl`. « Testé » veut dire : le point d'accès a répondu (statut HTTP, en-tête CORS). Cela ne prouve ni la qualité des données ni une disponibilité future. Les limites chiffrées et les conditions de licence viennent de la documentation des éditeurs et n'ont **pas** été vérifiées une à une. Tout ce qui est modélisé ou estimé est présenté comme tel dans l'interface.

Légende « Dans Anzar » : **UI** = affiché dans l'application, **pipeline** = script ou fichier de données, **non** = pas branché.

## Tableau

| Source | URL | Licence (selon l'éditeur) | Clé / compte | Coût, limites | Testé le 23 nov. 2026 | Dans Anzar |
| --- | --- | --- | --- | --- | --- | --- |
| Open-Meteo, prévision (pluie, ET0) | https://api.open-meteo.com/v1/forecast | CC BY 4.0 ; offre gratuite **non commerciale** | non | gratuit non commercial, quotas par minute, heure et jour (voir open-meteo.com/en/pricing) | 200, CORS `*` ; ET0 et pluie renvoyées | **UI** (`RainPanel`, `OpenDataPanel`) |
| Open-Meteo, archive ERA5 | https://archive-api.open-meteo.com/v1/archive | idem | non | idem | 200, CORS `*` | pipeline (`pipeline/rain/fetch_era5.py`) |
| Open-Meteo, ensemble | https://ensemble-api.open-meteo.com/v1/ensemble | idem | non | idem | 200, CORS `*` | non (utile plus tard pour une incertitude de prévision) |
| Open-Meteo, Flood API (GloFAS) | https://flood-api.open-meteo.com/v1/flood | idem | non | idem | 200, CORS `*` ; débit en m³/s renvoyé (valeur proche de 0,3 m³/s au point d'Agadir) | **UI** (`OpenDataPanel`, débit modélisé par maille d'environ 5 km) |
| Open-Meteo, Climate API (CMIP6) | https://climate-api.open-meteo.com/v1/climate | idem | non | idem | 200, CORS `*` | pipeline (`pipeline/climate/`, `climate-outlook.json`) |
| Open-Meteo, géocodage | https://geocoding-api.open-meteo.com/v1/search | idem | non | idem | 200, CORS `*` | non |
| NASA POWER | https://power.larc.nasa.gov/api/temporal/daily/point | données ouvertes NASA, citer POWER | non | gratuit | 200, CORS `*` ; `PRECTOTCORR` et `EVLAND` renvoyés. POWER ne donne pas l'ET0 FAO-56 : `EVLAND` est l'évaporation des terres, autre grandeur | non (second avis possible sur la pluie ; pas d'ET0 équivalente) |
| NASA GPM IMERG | https://gpm1.gesdisc.eosdis.nasa.gov/ | données NASA ouvertes | **oui, compte Earthdata gratuit** pour télécharger | gratuit | métadonnées CMR : 200, CORS `*`. Le téléchargement des fichiers n'a **pas** été testé (demande une connexion) | non |
| CHIRPS (pluie satellite + stations) | https://data.chc.ucsb.edu/products/CHIRPS/v3.0/ | domaine public selon le CHC ; vérifier la version | non (téléchargement HTTP de rasters) | gratuit, fichiers lourds | index v3.0 : 200, sans CORS. L'ancien chemin v2 `CHIRPS-2.0/` répond 404. Aucun raster téléchargé | non |
| Copernicus CDSE (Sentinel, OData/STAC) | https://catalogue.dataspace.copernicus.eu | licence Copernicus, libre | catalogue : non ; **téléchargement : compte gratuit** | quotas gratuits | catalogue OData : 200, CORS `*` ; page d'identité OAuth : 200. Aucun téléchargement testé | non (le pipeline utilise Earth Search ci-dessous) |
| Copernicus CDS (ERA5, ERA5-Land, GloFAS) | https://cds.climate.copernicus.eu | licence Copernicus | **oui, compte gratuit + jeton API** pour les données | gratuit, files d'attente | catalogue : 200, CORS `*`. Aucune extraction testée | non |
| Earth Search (STAC, Sentinel-2 L2A) | https://earth-search.aws.element84.com/v1 | Sentinel : licence Copernicus ; index AWS ouvert | non | gratuit | 200, CORS `*` ; 1 870 scènes sur un cadre autour du point d'Agadir | pipeline (`pipeline/satellite/`) |
| JRC Global Surface Water | https://global-surface-water.appspot.com ; tuiles sur storage.googleapis.com/global-surface-water | libre (JRC / Copernicus), citer Pekel et al. 2016 | non | gratuit | tuile PNG 200, GeoTIFF en lecture partielle 206, CORS `*` | non (candidat : occurrence d'eau pour valider les polygones de retenues) |
| ESA WorldCover (occupation du sol 10 m) | https://esa-worldcover.org | CC BY 4.0 | non (jeu AWS public) | gratuit | **non vérifié** : la clé S3 que j'ai devinée a répondu 404 et le WMS Terrascope a échoué ; ce n'est pas un résultat sur la disponibilité, seulement sur mon essai | non |
| FAO WaPOR v3 (ET réelle, biomasse, 100 m à 20 m) | https://data.apps.fao.org/gismgr/api/v2/catalog/workspaces/WAPOR-3 | CC BY 4.0 selon la FAO ; vérifier | catalogue : non ; accès aux données : jeton API de la FAO possible | gratuit | catalogue des jeux (liste paginée) : 200, CORS `*`. Aucune donnée lue | non |
| FAO AQUASTAT | https://data.apps.fao.org/aquastat/ | CC BY-NC-SA 3.0 IGO selon la FAO ; vérifier | non | gratuit | seule la page du portail a répondu (200) ; **aucune API testée** | non |
| World Bank API | https://api.worldbank.org/v2 | CC BY 4.0 | non | gratuit | 200, CORS `*` ; population du Maroc 2025 : 38 430 770 ; ressources internes renouvelables par habitant 2022 : environ 777 m³. L'indicateur de stress hydrique `ER.H2O.FWST.ZS` renvoie `null` pour 2024 | non (population par région : voir `water-balance.json`) |
| HDX / OCHA | https://data.humdata.org/api/3/action | par jeu ; limites administratives COD en CC BY-IGO | non | gratuit | 200, CORS `*` ; 141 jeux pour « morocco administrative » | pipeline (limites de régions et provinces) |
| data.gov.ma (CKAN) | https://data.gov.ma/data/api/3/action | ODbL (barrages ABHSM) | non | gratuit | 200, **sans CORS** : appel serveur ou copie datée | pipeline (liste des barrages, voir OPEN_SOURCE.md) |
| OpenStreetMap / Overpass | https://overpass-api.de/api/interpreter | ODbL | non | instance partagée, limitée | **502 « à capacité »** ce jour-là (GET) ; un POST avec l'agent par défaut de curl a reçu 406. Réessayer avec un agent générique et une pause | pipeline (polygones de retenues, `osm_polygons.py`) |
| Mapterhorn (relief) | https://tiles.mapterhorn.com | voir mapterhorn.com/attribution | non | gratuit | 200, CORS `*` | **UI** (carte 3D) |
| OpenFreeMap (fond de carte) | https://tiles.openfreemap.org | OSM, OpenMapTiles ; usage commercial permis | non | gratuit, sans SLA | 200 | **UI** (carte) |
| GRACE / GRACE-FO (stock d'eau total) | NASA PO.DAAC / GFZ | données NASA ouvertes | **oui, compte Earthdata** | gratuit | **non testé** (je n'ai pas trouvé de point d'accès public sans connexion) ; résolution grossière (environ 300 km), inadaptée à une région du Maroc prise seule | non |
| Sentinel Hub | https://services.sentinel-hub.com | commercial ; quotas gratuits via CDSE | **oui, compte + jeton OAuth** | payant au-delà de l'essai ou des quotas CDSE | racine STAC : 200 ; aucune requête de données testée | non |
| Google Earth Engine | https://earthengine.google.com | gratuit pour la recherche et l'usage non commercial | **oui, compte Google + projet Cloud** | quotas | **non testé** | non |
| OpenAQ (qualité de l'air) | https://api.openaq.org | CC BY 4.0 | **oui, clé dans l'en-tête X-API-Key** | gratuit avec clé | 401 sans clé | non (hors périmètre eau) |

Observations utiles :

- Tout ce qui sert dans l'interface (Open-Meteo, Mapterhorn, OpenFreeMap) répond avec CORS ouvert : un site statique sans API peut les appeler depuis le navigateur. C'est ce que fait `RainPanel` quand `/api/rain` échoue.
- L'offre gratuite d'Open-Meteo est **non commerciale**. Pour un déploiement commercial d'Anzar, prendre l'offre payante ou héberger les modèles soi-même.
- Débit GloFAS : c'est un débit simulé sur une maille d'environ 5 km, pas une jauge. Sur un oued du sud, une valeur proche de zéro est normale. Ce n'est pas une alerte de crue.
- Ni la pluie, ni l'ET0, ni le débit affichés ne sont comparés à des stations, sauf la comparaison ERA5 / station de Youssef Ben Tachfine déjà documentée dans `RainPanel`.

## Ce qui est branché dans l'interface (page Prévision)

- **Pluie** : `/api/rain` (région par défaut), sinon appel direct à Open-Meteo, sinon dernière copie locale datée, sinon message d'erreur sans valeur. Étiquette « modélisée », source, licence et date de récupération visibles.
- **Région** : le bloc lit la région dans l'adresse (`#/app/forecast/<région>`). Souss-Massa : Agadir et les barrages. Autre région : centroïde du plus grand polygone de `morocco-regions.geojson` (un point, pas une moyenne régionale).
- **ET0** et **débit GloFAS** : même point que la pluie, cache `localStorage` de 3 h (clés `anzar:opendata:…`), copie périmée étiquetée « ancien » si le service est injoignable.
- **Bloc « Données ouvertes utilisées »** : état, date de récupération et licence de chaque source réellement chargée ; aucune date n'est affichée tant que rien n'a été chargé.
- Logique testée sans réseau : `platform/src/lib/openData.js`, `platform/tests/open-data.test.mjs`.

## Ce qui demande une clé ou un compte gratuit

Règle commune : une clé ne va **jamais** dans le navigateur ni dans une variable `VITE_*` (elles sont publiées dans le bundle). Elle va côté serveur, dans `platform/.env` (ou exportée dans le shell, comme dans `.env.example`). Les fichiers `.env` sont ignorés par Git ; ne jamais les commiter. Aucune de ces sources n'est branchée aujourd'hui, donc aucun nom de variable n'est encore lu par le code ; les noms ci-dessous sont une proposition.

| Service | Pourquoi | Inscription (selon la documentation de l'éditeur, non refaite ce jour) | Où mettre la clé |
| --- | --- | --- | --- |
| Copernicus Data Space (CDSE) | télécharger des scènes Sentinel-1/2/3 | compte gratuit sur dataspace.copernicus.eu, puis jeton OAuth (client id et secret créés dans le tableau de bord) | `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` dans `platform/.env` ; appel depuis un script `pipeline/` ou le serveur |
| Copernicus Climate Data Store | ERA5, ERA5-Land, GloFAS brut | compte gratuit sur cds.climate.copernicus.eu, accepter les licences de chaque jeu, copier le jeton personnel | `CDSAPI_KEY` (et `CDSAPI_URL`) dans `platform/.env` ou `~/.cdsapirc` hors du dépôt |
| NASA Earthdata | IMERG (pluie satellite), GRACE | compte gratuit sur urs.earthdata.nasa.gov, jeton dans le profil | `EARTHDATA_TOKEN` dans `platform/.env` |
| Sentinel Hub | traitements d'images à la demande | compte sur sentinel-hub.com (essai) ou accès via CDSE ; client OAuth | `SH_CLIENT_ID`, `SH_CLIENT_SECRET` dans `platform/.env` |
| Google Earth Engine | analyses raster lourdes | compte Google, projet Google Cloud enregistré pour l'usage non commercial | identifiants de compte de service hors du dépôt ; chemin dans `GOOGLE_APPLICATION_CREDENTIALS` |
| FAO WaPOR | ET réelle à haute résolution | compte sur le portail WaPOR, jeton API (le catalogue seul répond sans clé) | `WAPOR_API_TOKEN` dans `platform/.env` |
| OpenAQ | qualité de l'air (hors périmètre) | clé gratuite sur openaq.org | `OPENAQ_API_KEY` |

Demande ouverte pour Mouad : lesquels de ces comptes veut-il créer ? Aucun n'est nécessaire pour ce qui est affiché aujourd'hui (tout fonctionne sans clé).

## Pistes sans clé, non branchées

- CHIRPS v3 (rasters de pluie) : sans clé, mais fichiers lourds ; nécessite un script Python avec `rasterio`.
- JRC Global Surface Water : tuiles et GeoTIFF publics ; utile pour contrôler les polygones de retenues.
- NASA POWER : second avis de pluie sur le même point.
- Open-Meteo ensemble : bande d'incertitude de la prévision de pluie.
- ESA WorldCover : à retester avec l'adresse exacte du jeu avant de l'utiliser.
