# pipeline/climate

Variation de précipitation 2026-2050 par rapport à 1991-2020, par bassin du bulletin des barrages.

```
python3 fetch_climate_outlook.py ../../public/data/climate-outlook.json /chemin/hors/depot/raw
```

- Source : Open-Meteo Climate API (`climate-api.open-meteo.com/v1/climate`), 7 modèles CMIP6, `precipitation_sum` quotidienne 1991-2050. Documentation et modèles : https://open-meteo.com/en/docs/climate-api
- Un point par bassin (voir `POINTS`), choisi dans la zone des barrages principaux : indicatif, pas une moyenne de bassin.
- Un appel couvre 60 ans x 7 modèles : lent (1 à 2 minutes) et compté environ 1 850 appels par Open-Meteo (limites gratuites : 5 000 par heure, 10 000 par jour). Les 9 bassins ont pris plusieurs dizaines de minutes à cause du quota horaire. Appels séquentiels, attente de 75 s sur HTTP 429, reprise depuis le dossier brut s'il existe déjà.
- Calcul : moyenne annuelle des jours renseignés ; variation en mm et en % ; modèle écarté si plus de 5 % de jours vides ; médiane, min, max sur les modèles retenus. Sur les bassins arides (Drâa, Guir), lire le changement en mm.
- Licence : données CMIP6 en CC BY 4.0 (attribuer Open-Meteo et CMIP6) ; API gratuite réservée à l'usage non commercial.
- C'est une projection modélisée, pas une prévision : l'écart entre modèles est l'incertitude à afficher. Réponses brutes à garder hors du dépôt.
- User-Agent générique (`water-research/1.0`), dépendances : bibliothèque standard Python uniquement.
