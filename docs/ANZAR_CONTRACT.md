# ANZAR — contrat de données et d'API (source de vérité des sous-agents)

Nom de l'outil : **Anzar** (dieu amazigh de la pluie). Observatoire national de l'eau du Maroc : réserves des barrages, pluie, dessalement, autosuffisance par région, scénarios. Prototype indépendant, **pas** un portail officiel. SRM-SM (Souss-Massa) reste une vue régionale.

## Règles d'honnêteté (non négociables)
- Chaque nombre porte `status` ∈ `sourced` | `derived` | `hypothese`, plus `source` (id ou URL) et `date`. Pas d'URL ou de date → `hypothese`.
- Eaux souterraines : **non modélisées** → `null` + libellé « non modélisé », jamais 0.
- Aucun volume transférable entre régions, aucun tracé de conduite inventé. L'aide au sud s'exprime en **leviers** (dessalement, réutilisation, économies, projets documentés avec source), jamais en m³ déplacés. Le test `regions.json holds no transfer-volume key` doit rester vert. Aucun fichier JSON ne contient de clé `transferable`/`volumeTransf*`.
- Le scénario n'est PAS une prédiction : étiquette « scénario », hypothèses visibles. (Compétence de la prévision existante : 0,057 → négligeable.)
- Interface en français. Couleurs de marque Anzar : voir `docs/BRAND_ANZAR.md` (écrit par le worker marque).

## Fichier `platform/public/data/water-balance.json`
```jsonc
{
  "asOf": "2026-11-23",
  "unitNote": "Stocks en Mm³, flux en Mm³/an",
  "regions": [{                       // 12 entrées, id = ids de regions.json
    "id": "souss-massa",
    "population": { "value": 2740000, "year": 2024, "status": "sourced", "source": "https://…" },
    "popGrowthPctYr": { "value": 1.1, "status": "hypothese", "source": "…" },
    "domestic": { "lPerCapitaDay": { "value": 110, "status": "hypothese", "source": "…" }, "lossRatePct": { "value": 25, "status": "hypothese", "source": "…" } },
    "agriculture": { "irrigatedHa": { "value": 0, "status": "…", "source": "…" }, "m3PerHa": { "value": 0, "status": "…", "source": "…" } },
    "industry": { "mm3PerYear": { "value": 0, "status": "…", "source": "…" } },
    "desalination": { "capacityMm3PerYear": { "value": 0, "status": "…", "source": "…" }, "plannedMm3PerYear": [{ "value": 0, "year": 2028, "label": "…", "status": "…", "source": "…" }] },
    "groundwater": null,              // toujours null (non modélisé) sauf source citée
    "basinShares": [{ "basin": "Souss-Massa", "share": 1.0, "status": "hypothese", "source": "approximation indicative" }],  // part du stock du bassin attribuée à la région, somme ≤ 1 par bassin sur toutes les régions
    "reuse": { "treatedWastewaterMm3PerYear": { "value": null, "status": "hypothese", "source": "…" } }
  }],
  "basins": [{ "name": "Souss-Massa", "meanAnnualInflowMm3": { "value": 0, "status": "…", "source": "…" }, "climateFactor": { "dry": 0.45, "normal": 1, "wet": 1.6, "status": "hypothese" } }],
  "projects": [{ "id": "…", "regionIds": ["…"], "kind": "dessalement|interconnexion|réutilisation|économie", "label": "…", "capacityMm3PerYear": null, "year": 2027, "status": "en service|en construction|planifié", "source": "https://…", "date": "2026-…" }],
  "sectorGuide": { "note": "parts nationales de la demande par secteur (source citée)" }
}
```
Fichier optionnel `public/data/climate-outlook.json` : par bassin, variation de précipitation 2026-2050 vs 1991-2020 (Open-Meteo Climate API, modèles CMIP6, **projection modélisée, usage non commercial**), avec modèles, scénario d'émission, date de récupération.

## API `platform/src/lib/balance.js` (fonctions pures, sans React, testées par `tests/balance.test.mjs`)
- `basinStockForRegion(regionBalance, bulletin) -> { storedMm3, capacityMm3, fillPct }` (bulletin = `national-bulletin.json`, parts `basinShares`).
- `annualDemand(regionBalance, { year, popGrowth, demandFactor }) -> { domesticMm3, agricultureMm3, industryMm3, totalMm3, potableMm3 }` (domestique = pop × l/hab/j × 365 / 1e9 × (1 + pertes) ; ordre de grandeur, jamais « relevé »).
- `coverage(regionBalance, bulletin, assumptions) -> { monthsOfCoverage, monthsPotable, band: 'critique'|'tendu'|'confortable', components, caveats[] }`. Métrique unique et documentée : **mois de couverture = (stock de surface alloué + dessalement × horizon) / demande mensuelle**, eaux souterraines et apports hors métrique (listés dans `caveats`). Calculer aussi la variante « potable seule ». Bornes de bande documentées dans le code.
- `simulate(regionBalance, bulletin, basin, scenario, years=10) -> [{ year, storedMm3, demandMm3, monthsOfCoverage, band }]` avec `scenario = { hydrology: 'dry'|'normal'|'wet', popGrowth?, demandReductionPct?, addedDesalMm3?, reusePct?, startYear }`. Bilan annuel : stock' = clamp(stock + apport×facteur − prélèvement de surface − évaporation, 0, capacité). Hypothèses d'évaporation et de part de demande servie par la surface = constantes nommées et documentées.
- `levers(regionBalance, bulletin, baseAssumptions) -> [{ id, label, deltaMonths, kind, status:'hypothese' }]` : effet de leviers (économies +10 %, réutilisation, dessalement +X Mm³/an, réduction des fuites). **Jamais** de transfert entre régions.
- `rankRegions(balances, bulletin, assumptions) -> [{ id, monthsOfCoverage, band, rank }]` et `solidarityView(...)` : régions « mieux dotées » vs « sous tension » **à titre d'analyse**, sans volume.
Toute sortie conserve `caveats` (ex. « eaux souterraines non modélisées », « attribution de bassin approximative »).

## Cartes
- `platform/src/components/AnzarMap.jsx` : carte nationale 3D (MapLibre, relief Mapterhorn, extrusion des régions colorées par métrique), props `{ metricByRegion, metricLabel, selectedId, onSelect, year, onReady }`. **Ne pas retirer** l'import du worker Vite ni `setWorkerUrl` (voir MapView.jsx).
