# Schémas des fichiers de reconstitution et de prévision

Deux fichiers statiques, produits par `platform/pipeline/` et lus par l'interface. Tant qu'ils ne sont pas produits, ils contiennent `{"status":"pending"}` et l'interface affiche un état d'attente.

Libellés obligatoires dans l'interface : « estimation satellite calée sur les bulletins, non officielle » et « prévision expérimentale ». Un pourcentage de remplissage estimé n'est jamais présenté comme mesuré.

## public/data/storage-reconstruction.json
```json
{
  "status": "ready",
  "generatedAt": "ISO-8601",
  "method": "texte court : V = k·A^b par barrage, A = surface NDWI Sentinel-2, calage sur bulletins officiels",
  "label": "estimation satellite calée sur les bulletins, non officielle",
  "dams": [{
    "id": "abdelmoumen",                 
    "name": "Abdelmoumen",
    "capacityMm3": 199.0,                 
    "capacitySource": "stock ÷ taux du bulletin du 2026-11-18",
    "polygon": {"source": "OSM relation …", "centroid": [-9.19, 30.62], "areaKm2AtMax": 0.0},
    "fit": {"k": 0.0, "b": 0.0, "bLow": 0.0, "bHigh": 0.0, "nPairs": 0, "pairs": [{"date": "2026-11-09", "areaKm2": 0.0, "volumeMm3": 0.0, "sceneId": "S2…", "sceneDate": "2026-11-09"}], "residualRmseMm3": 0.0},
    "series": [{"date": "2024-05-12", "areaKm2": 0.0, "volumeMm3": 0.0, "low": 0.0, "high": 0.0, "fillPct": 0.0, "sceneId": "S2…"}],
    "estimated": true
  }],
  "notEstimated": [{"id": "dkhila", "reason": "retenue trop petite pour Sentinel-2 (10 m)"}],
  "regionTotal": [{"date": "2025-11-18", "volumeMm3": 0.0, "low": 0.0, "high": 0.0, "coveredShare": 0.95}],
  "validation": [{
    "name": "Région, même jour 2025", "date": "2025-11-18", "official": 141.3, "officialSource": "bulletin 2026-11-18 : 19,56 % × 722,83 Mm³",
    "estimated": 0.0, "errorMm3": 0.0, "errorPct": 0.0, "usedInCalibration": false
  }],
  "caveats": ["…"]
}
```
Les points de validation ne doivent jamais servir au calage (`usedInCalibration: false`).

## public/data/fill-forecast.json
```json
{
  "status": "ready",
  "generatedAt": "ISO-8601",
  "label": "prévision expérimentale",
  "target": "variation mensuelle du stock reconstitué (Mm³) des 4 grands barrages, agrégée région",
  "inputs": ["pluie ERA5-Land mensuelle sur grille amont", "stock courant", "mois"],
  "backtest": {
    "scheme": "leave-one-hydrological-year-out (sept→août)",
    "years": [2018, 2019],
    "metrics": [{"model": "modèle", "maeMm3": 0.0, "rmseMm3": 0.0}, {"model": "persistance", "maeMm3": 0.0, "rmseMm3": 0.0}, {"model": "climatologie", "maeMm3": 0.0, "rmseMm3": 0.0}],
    "beatsBaselines": false,
    "skillVsPersistence": 0.0,
    "note": "à afficher tel quel, même si le modèle perd"
  },
  "scenarios": [{"name": "sec", "tercile": "bas", "points": [{"date": "2026-12-19", "volumeMm3": 0.0, "low": 0.0, "high": 0.0}]}],
  "scenarioBasis": "terciles de pluie historiques ; prévision 16 jours quand disponible",
  "caveats": ["…"]
}
```
