# 10 - Anzar : données de demande, dessalement, apports et climat

Préparé le 2026-11-23. Alimente `platform/public/data/water-balance.json` et `climate-outlook.json`. Ce sont des ordres de grandeur sourcés ou des hypothèses écrites ; aucun relevé en direct, aucun volume transférable, aucun tracé de conduite.

Statuts : `sourced` = chiffre lu dans la source (URL + date) ; `derived` = calcul à partir de chiffres sourcés ; `hypothese` = choix du prototype, raisonnement écrit.

## 1. Sources ouvertes et lues (2026-11-23)

| Id | Source | Date | Lue comment |
|---|---|---|---|
| HCP-pop | HCP, population légale par région, RGPH 2024 (https://www.hcp.ma/file/242227/) | 2024-11-07 ; référence 2024-09-01 | .doc téléchargé et converti : total 36 828 330, 36 680 178 Marocains, 148 152 étrangers. Le tableau régional du .doc n'a pas été extrait ; les 12 valeurs régionales viennent de Wikipédia FR (RGPH 2024) et de Médias24 (via recherche), et leur somme vaut exactement 36 828 330. |
| HCP-croissance | HCP, résultats principaux RGPH 2024 (https://www.hcp.ma/file/242665/) | 2024-11 | PDF converti : taux annuel moyen 2014-2024 par région (Dakhla 4,40 ; Laâyoune 2,06 ; Tanger 1,26 ; Souss-Massa 1,21 ; Casablanca et Rabat 1,14 ; Marrakech 0,79 ; Fès 0,53 ; Guelmim 0,34 ; Drâa 0,13 ; Béni Mellal 0,02 ; Oriental -0,09 ; national 0,85). |
| Plan Bleu | Étude nationale eau-énergie-climat, Maroc (https://planbleu.org/sites/default/files/publications/eau_energie_cc_maroc_fr.pdf) | 2011-01 | PDF converti en texte : tableaux 3, 8, 11, 18 et annexe 3. Les colonnes de l'annexe 3 sont déduites de la mise en page (somme 2030 des périmètres = 4 887 Mm³, cohérente avec le total imprimé « 887 »). Le Loukkos (274) diffère du tableau 11 (374) : à vérifier dans le document d'origine. |
| IRES | IRES, « Quel avenir de l'eau au Maroc ? » (https://www.ires.ma/sites/default/files/docs_publications/Avenir_de_leau_au_Maroc-Rapport_de_synthese.pdf) | 2022-03-17 | PDF converti : demande 2020 = 16,28 Gm³ dont agriculture 14,53 (89,26 %) et eau potable + industrie + tourisme 1,75 (10,74 %) ; 2050 : AEPIT 13,91 %. |
| Policy Center | H.-L. Védie, Policy Paper 19/25 (https://www.policycenter.ma/sites/default/files/2025-05/PP_19-25%20(Vedie).pdf) | 2025-05 | PDF converti : tableaux 1 (17 stations en service ou en cours, 322,11 Mm³) et 2 (9 stations planifiées, 935,74 Mm³), construits à partir de données 2023 du ministère de l'Équipement et de l'Eau. Source secondaire (think tank). |
| Le360 autoroutes | https://fr.le360.ma/societe/pourquoi-et-comment-le-maroc-mise-sur-les-autoroutes-de-leau_SHZVYUMN5NFF7HXNFT7QAMIAHQ/ | publication non relevée | Page ouverte : phases 1 à 3, 17 ouvrages d'interconnexion au total. |
| Open-Meteo | https://open-meteo.com/en/docs/climate-api | consultée 2026-11-23 | Modèles, scénario, période, licence. |

Lus seulement dans des résultats de recherche (non ouverts) : Médias24 (population par région, Dakhla 2026, Sebou-Bouregreg 2023, Baraka 2026), Banque mondiale CCDR (≈ 15 Gm³/an d'apports 1979-2018), PDAIRE Bouregreg (850), ABHS (Sebou 5 170 sur 1939-2017), Le360 Chtouka 2022, Le360 / maroc.ma pour Mokhtar Soussi.

## 2. Contrôles de cohérence (réellement calculés)

| Contrôle | Résultat |
|---|---|
| Somme des 12 populations | 36 828 330 = total HCP |
| Agadir : 275 000 m³/j x 365 | 100,375 Mm³/an ≈ 100,40 (Policy Center) |
| Agriculture : somme des 12 régions (grande hydraulique + petite/moyenne + privée, scénario 2030 Plan Bleu) | 10128 Mm³/an, dont 4887 en grande hydraulique, contre 14 530 (IRES, demande 2020) : l'écart (≈ 30 %) vient du scénario d'économie d'eau 2030 de Plan Bleu et des cultures non irriguées en réseau ; la demande agricole du prototype est donc sous-estimée |
| Domestique : 36,83 M hab x 85 l/j x 365 x 1,25 | 1428 Mm³/an |
| Industrie + tourisme (résidu) | 322 Mm³/an (= 1 750 - domestique). Domestique + industrie = 1 750 par construction : ce n'est PAS une validation indépendante |
| Apports moyens totaux (tableau 3) | 18 025 Mm³/an ; moyenne de long terme publiée en 2011 |

## 3. Choix et limites

- **Agriculture** : le tableau 8 de Plan Bleu ne couvre que la grande hydraulique (682 600 ha sur ≈ 1,46 M ha irrigués en 2007-2011). `irrigatedHa` x `m3PerHa` = grande hydraulique seule ; la petite et moyenne hydraulique et l'irrigation privée sont dans `agriculture.otherIrrigationMm3PerYear` (tableau 11, 2030, répartition indicative bassin → région, statut hypothèse). Fès-Meknès, Guelmim, Laâyoune, Dakhla n'ont aucun périmètre de grande hydraulique : `irrigatedHa` et `m3PerHa` valent null, leur demande agricole est portée par `otherIrrigationMm3PerYear`. Le calcul de demande doit additionner les deux postes.
- **Données anciennes** : superficies fin 2007, demandes 2030 projetées en 2011. Pas d'ORMVA actualisé : les pages de monographie ouvertes (Souss-Massa) datent de 2009/2010 et n'ont pas été utilisées.
- **Domestique** : 85 l/hab/j et 25 % de fuites sont des hypothèses calibrées sur le niveau national, identiques pour les 12 régions.
- **Industrie** : résidu national réparti au prorata de la population, ignore Jorf Lasfar et Safi.
- **Dessalement** : capacités du Policy Center (données 2023) ; l'usage (potable / irrigation / industrie) est conservé dans `byUse`. Jorf Lasfar (40) et Safi (8) sont industriels (OCP), à ne pas compter comme eau potable. Rattachement à la région des petites stations (Sidi El Ghazi, El Mhirriz, Amegrew) = hypothèse. Tiznit-Sidi Ifni (154,6) est à cheval sur Souss-Massa et Guelmim-Oued Noun : répartition non sourcée, donc absente des listes régionales `plannedMm3PerYear`, présente comme projet unique. Guelmim-Oued Noun : 0 = « non relevé » (statut hypothèse). Dakhla reste « en construction » : sources divergentes (2026 puis 2027). Casablanca 300 Mm³/an : calendrier 2026-2027 divergent. Nador 250 : une seule source.
- **Barrage Mokhtar Soussi** (≈ 50 → 281 Mm³, > 85 % d'avancement, fin attendue début 2027) : ouvrage de stockage, hors énum. de projets du contrat ; noté dans le bassin Souss-Massa de `basins[]`.
- **Apports** : l'ordre de grandeur « normal = 1 » repose sur des moyennes anciennes (18 Gm³/an) ; la Banque mondiale cite ≈ 15 Gm³/an (1979-2018, non ouvert). Le scénario « normal » est donc optimiste.
- **Interconnexions** : seuls Sebou → Bouregreg (en service depuis août 2023), sa phase 2 vers l'Oum Er-Rbia (études fin 2026) et Oued El Makhazine - Dar Khrofa sont documentés. Aucune capacité attribuée (volumes annoncés divergents) ; aucun projet vers le sud.
- **Eaux souterraines** : null partout (non modélisées).
- **Réutilisation** : null, pas de chiffre régional dans les sources lues.
- **basinShares** : allocations choisies à la main, somme par bassin ≤ 1 (Sebou 0,80 ; Bouregreg 0,90 ; Oum Er-Rbia 0,95 ; autres 1,00). Laâyoune et Dakhla : aucun bassin dans le bulletin, stock null.

## 4. Projections de précipitations (climate-outlook.json)

Script : `platform/pipeline/climate/fetch_climate_outlook.py` (README dans le dossier). Open-Meteo Climate API, 7 modèles CMIP6 haute résolution, 1991-2050, un point représentatif par bassin, variation 2026-2050 vs 1991-2020. Les modèles sont décrits par Open-Meteo comme aussi proches que possible de RCP8.5 ; pas de trajectoire basse. Usage non commercial uniquement (CC BY 4.0 pour les données CMIP6).

Récupération : 2026-11-22T23:59:32+00:00. Aucun modèle écarté (0 jour vide sauf EC_Earth3P_HR : 365 jours vides sur 21 915, soit 1,7 %, ignorés et comptés dans `emptyDays`). Médiane sur 7 modèles ; l'écart min-max est l'incertitude entre modèles et dépasse souvent la médiane.

| Bassin | Précipitation de référence 1991-2020 (mm/an, médiane des modèles) | Variation 2026-2050 : médiane (min à max) | Médiane en mm/an |
|---|---|---|---|
| Loukkos | 1077.6 | -11.7 % (-24.4 à 14.8) | -132.7 |
| Moulouya | 205 | -11.8 % (-19 à 15.9) | -23.3 |
| Sebou | 498.7 | -10.2 % (-22 à 5.5) | -50.4 |
| Bouregreg | 428.8 | -11.1 % (-20.2 à 7.4) | -47.2 |
| Oum Er-Rbia | 505.5 | -15 % (-21.2 à 1.8) | -76 |
| Tensift | 328.8 | -9.7 % (-27.3 à 9.6) | -30.8 |
| Souss-Massa | 246.3 | -10.7 % (-32.7 à 8.2) | -26.5 |
| Drâa-Oued Noun | 106.3 | -2 % (-25 à 40.2) | -2.2 |
| Guir-Ziz-Ghriss | 126.7 | -8.8 % (-22.6 à 31.6) | -11.2 |

Lecture : la médiane des modèles est négative partout (de -2 % à -15 %), mais le signe n'est pas unanime (certains modèles donnent une hausse, jusqu'à +40 % en mm très faibles sur le Drâa). Un seul point par bassin, résolution 10 km : orographie mal représentée. Projection modélisée, pas une prévision ; usage non commercial.
