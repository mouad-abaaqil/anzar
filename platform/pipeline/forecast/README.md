# Reconstruction du stock et prévision expérimentale

Python (venv `/tmp/srmsm-venv`, numpy seulement). Depuis `platform/` :

    /tmp/srmsm-venv/bin/python pipeline/forecast/reconstruct.py   # -> public/data/storage-reconstruction.json
    /tmp/srmsm-venv/bin/python pipeline/forecast/forecast.py      # -> public/data/fill-forecast.json

Schémas : `docs/FORECAST_SCHEMAS.md`. Intermédiaires : `data-raw/forecast/`. Relancer `reconstruct.py` quand une série `data-raw/satellite/<id>-series.json` arrive (les barrages absents vont dans `notEstimated`).

## Méthode
- Par barrage : paires (bulletin, scène valide la plus proche à ≤2 jours) ; scènes `validFraction < 0.9` écartées ; sauts > 40 % en ≤10 jours listés (`quality.outliersFlagged`) et exclus.
- V = k·A^b ajusté en log, b contraint à [1, 2], ancrage plein bassin (surface maximale historique, capacité = stock ÷ taux du 2026-11-18, poids 5). Si l'ancre contredit les paires (écart log > 0,25, surface NDWI saturée), elle est écartée, b est pris au milieu de la plage compatible avec les paires, et la borne haute passe à la capacité pour les mois proches de la saturation (`saturated`). Règle fixée a priori, pas réglée sur la validation.
- Bande : enveloppe des ajustements bLow/bHigh ± 3 % de surface (hypothèse).
- Validation (`usedInCalibration: false`) : repères 2025-11-18 lus sur graphique (scènes à ≤10 jours, aucune à ≤3 jours), total région, points de presse (plus faibles ; petits barrages non inclus).
- Prévision : variation mensuelle du stock des grands barrages, ridge (alpha 20 fixé) sur pluie ERA5 corrigée par ratio mensuel station/ERA5 (validé seulement à Youssef Ben Tachfine), pluie des 1 et 3 mois précédents, stock courant, mois sin/cos ; leave-one-hydrological-year-out ; références : persistance et climatologie de la variation. Scénarios : terciles de pluie + prévision 16 jours Open-Meteo, départ = bulletins du 2026-11-18, bandes = quantile 90 % des erreurs de CV.

## Limites
Estimation non officielle ; exploitation (lâchers, irrigation, eau potable) non modélisée ; surface saturée pour plusieurs barrages ; peu d'années de stock reconstruit.
