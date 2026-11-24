# Documentation

Ordre de lecture : [`../HANDOFF.md`](../HANDOFF.md) (état, façon de travailler, suite) → [`../CLAUDE.md`](../CLAUDE.md) → cet index.

## Anzar (l'application)
| Document | Contenu |
| --- | --- |
| [ANZAR_CONTRACT.md](ANZAR_CONTRACT.md) | contrat de données et d'API (bilan hydrique, scénarios) et **règles d'honnêteté** |
| [HUB_CONTRACT.md](HUB_CONTRACT.md) | architecture du hub : carte 3D persistante, récit d'entrée, panneau à trois onglets, routes |
| [DESIGN_ANZAR.md](DESIGN_ANZAR.md) | système de design : grille, typographie, mouvement, états, provenance, écriture, contrôle `npm run check:design` (sa règle « thème sombre » est remplacée par la V2) |
| [DESIGN_ANZAR_V2.md](DESIGN_ANZAR_V2.md) | **palette et thème actuels** : clair « eau » dérivé des couleurs des SRM, sections « profondeur », directives pour la carte |
| [BRAND_ANZAR.md](BRAND_ANZAR.md) | nom, tagline, logo, disponibilité du nom ; maquettes du logo dans [brand-anzar/](brand-anzar/) |
| [OPEN_DATA.md](OPEN_DATA.md) | inventaire des données ouvertes : licence, clé requise ou non, utilisées ou non |
| [OPEN_SOURCE.md](OPEN_SOURCE.md) | moteur cartographique, fonds de carte, relief, polices, attributions et contraintes |
| [FORECAST_SCHEMAS.md](FORECAST_SCHEMAS.md) | schémas de `storage-reconstruction.json` et `fill-forecast.json` (estimation satellite, usage restreint) |
| [screenshots/](screenshots/) | captures du README, régénérées par `npm run e2e:shots` |

## Recherche et historique
| Document | Contenu |
| --- | --- |
| [research/](research/README.md) | **14 notes de recherche**, avec sources et mentions UNVERIFIED |
| [RESEARCH.md](RESEARCH.md) | première recherche : sources régionales, assainissement, réutilisation |
| [BRAND.md](BRAND.md) | provenance du logo SRM-SM, palette mesurée, contexte RAMSA |
| [HISTORY.md](HISTORY.md) | journal du développement (jusqu'au 19 nov. 2026 : l'ère SRM-SM) |
| [archive/](archive/) | documents remplacés (ancienne spec de design SRM-SM) |

Registres machine : `../platform/public/data/` (chaque fichier porte ses sources, dates et licences). Données brutes datées : `../platform/data-raw/` (un README par dossier). Scripts : `../platform/pipeline/`.
