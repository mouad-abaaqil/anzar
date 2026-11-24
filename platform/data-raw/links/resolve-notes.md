# Résolution des trous de la couche « l'eau circule » (links-v2)

Date de lecture : 2026-11-23. Base : `platform/public/data/water-links.json` (coordSource conservés), complétée dans `links-v2.json` (26 liens : 23 existants + 3 nouveaux). Aucune coordonnée devinée : une extrémité n'a lat/lon que si une source lue la donne (`coordSource` renseigné), sinon `coordSource: null`.
Conventions : LU = page ouverte via WebFetch (résumé restitué par l'outil, pas relu en texte brut) ; UNVERIFIED = extrait de recherche web ou page en HTTP 403. Pages en 403 ce jour : Médias24, Le Desk, TelQuel, Le Matin, LesEco, MAP.

## Bilan

- Liens dessinables (deux extrémités) : 6 dans le fichier public, 7 dans links-v2 (+ Aoulouz vers barrage Abdelmoumen, coordonnée du barrage OSM, station Sidi Boushab non localisée).
- Sebou vers Bouregreg reste NON dessinable : ni la prise ni une coordonnée d'arrivée fiable.
- Nouveaux liens : `casablanca-dessalement-station`, `agadir-transfert-eaux-dessalees-plf-2027`, `dakhla-conduite-adduction-station`.

## (a) Sebou vers Bouregreg

- Prise : en amont du barrage de garde du Sebou, près de Kénitra (La Vie Éco 23/09/2024, LU, https://www.lavieeco.com/affaires/autoroute-de-leau-un-projet-salutaire/). Pas de commune ni de coordonnée. AgriMaroc 30/08/2023 (LU, https://www.agrimaroc.ma/autoroute-eau-oued-sebou-bouregreg/) : 'barrages de Sebou à Kénitra', aucune coordonnée.
- Arrivée : barrage Sidi Mohammed Ben Abdellah (Bouregreg), 'à Rabat'.
- Ouvrages : conduite acier 3 200 mm, 66,7 km, deux stations de pompage (15 m3/s), un bassin de transfert (Le360 07/11/2024, LU, https://fr.le360.ma/economie/interconnexion-sebou-bouregreg-484-millions-de-metres-cubes-deau-transferes-au-5-novembre_JUHQ7CT73REW5LT4LFKERQPEVM/). Débit d'essai 3 m3/s, objectif 6 puis 15 m3/s fin septembre 2023 (AgriMaroc, Perspectives Med 30/08/2023, LUS).
- Mise en service : 28/08/2023 (AgriMaroc citant Yabiladi). 484 Mm3 transférés du 28/08/2023 au 05/11/2024.
- Coordonnée d'arrivée : Wikidata Q12215598 (LU 23/11/2026, https://www.wikidata.org/wiki/Special:EntityData/Q12215598.json) a deux valeurs : 33,937811 ; -6,750905 (sans référence, 'dam near Rabat') et 33,562 ; -6,4456 (référencée). `national-dams.json` utilise la seconde, à environ 55 km au sud-est de Rabat, ce qui cadre mal avec 'à Rabat'. Non tranché, donc aucune coordonnée reportée dans le lien. À vérifier dans `national-dams.json` (hors périmètre de cette tâche).
- Conflits : longueur 66,7 / 67 km (LUS) contre 70 km (extrait) ; 24/08/2023 (extrait) contre 28/08/2023 ; 'lancée en octobre 2023' (Aujourd'hui.ma 02/10/2026, LU) ; Aujourd'hui.ma écrit que la phase 1 reliait Al Wahda au barrage SMBA, ce qu'aucune autre source ne dit (prise à Kénitra) : écarté.
- UNVERIFIED : station SP2 près de la RN 405, localités Ben Mansour et Mograne, barrage El Kansera (extrait de recherche).

## (b) El Hachef (Tanger)

- Phase 1 Dar Khrofa vers station de traitement El Hachef : en service 2021, 75 Mm3/an estimés d'après la capacité des conduites (La Vie Éco 30/01/2025 et Challenge.ma 30/01/2025, LUS). Wikipédia FR Dar Khrofa (LU, https://fr.wikipedia.org/wiki/Barrage_Dar_Khrofa) : 35°14'21"N 5°46'42"O, liaison avec Tanger en service depuis février 2021, 187 MDH.
- Station El Hachef : aucune coordonnée trouvée. Le viaduc d'El Hachef (Structurae) n'est pas la station, écarté. Longueur de la conduite non publiée. Reste null.
- UNVERIFIED : Amendis (Hachef et M'harhar, quatre barrages), extension de 1 400 l/s d'un ancien programme.
- Makhazine vers Dar Khrofa : dernier état lu = 96 % au 29/01/2025, mise en service annoncée février 2025 (Challenge.ma, LU). Aucune confirmation postérieure trouvée (recherche 23/11/2026) ; statut conservé 'en construction'.

## (c) Tfer et Koudiat Borna

- Tfer : province de Larache ; régulation des crues du Loukkos, irrigation, eau potable Tanger-Tétouan ; capacité 900 Mm3 ; travaux 'dans les semaines à venir' (L'Observateur 16/02/2026, LU, https://lobservateur.info/article/117256/economie/bassin-du-loukkos-un-nouveau-barrage-tfer-sort-de-terre-pour-securiser-le-nord ; aucune mention de transfert). Le360 PLF 2027 (26/10/2026, LU) : 1 307,5 MDH, 'volume transférable de 400 Mm3 par an' des bassins du Laou et du Loukkos, marché en cours. Conflits : 900 contre 350-400 Mm3 ; 1 307,5 MDH contre 1,145 milliard MAD. UNVERIFIED : délai 54 mois, service vers 2030, Médias24 14/07/2026 et Le Desk 14/07/2026 (403). Aucune coordonnée.
- Koudiat Borna : AgriMaroc 29/10/2026 (LU) : 'études préalables et travaux de la tranche 1', 72 m3/s, 7 000 MDH, crédits 625,9 MDH (2026), 900 (2027), 2 000 (2028, 2029). Statut 'planifié' conservé. UNVERIFIED : JICA, 12 Mm3/an. Aucune coordonnée.

## (d) Aoulouz

- Aoulouz vers Taroudant : industries.ma, BTP News (octobre 2021), Fedenerg (29/07/2021), LUS : environ 80 km, 500 à 900 mm, station 200 l/s (17 280 m3/j), 250 MDH (315 MDH = programme global), travaux depuis juillet 2021, mise en service prévue avant fin octobre 2021. Exploitation effective non confirmée ; emplacement de la station non publié.
- Aoulouz vers Sidi Boushab : La Vie Éco 06/03/2020 (LU) : 50 km, 1 m3/s, 198 MDH, juillet 2020 prévu ; Aujourd'hui.ma 07/09/2022 (LU) : 'canal de 49 km' Aoulouz et Mokhtar Soussi vers Sidi Boushab, sans avancement. Statut 2026 inconnu.

## (e) Autoroute de l'eau, Laou-Loukkos-Sebou, Sud

- Phase 2 Bouregreg vers Oum Er-Rbia : 300 km, jusqu'à 800 Mm3/an (Aujourd'hui.ma 02/10/2026, LU) ; 210 km (Le360 17/04/2026, LU) ; financement émirati (Le360 17/06/2025, LU) ; lancement visé fin 2026, aucun démarrage confirmé. UNVERIFIED : Taqa/Nareva mars 2026, tunnel de 68 km, 3 stations de pompage.
- Laou-Loukkos-Sebou : étude de conception de 19 mois, 'près d'un milliard de m3' à terme (La Vie Éco 07/05/2025, LU) ; aucun tracé ni coordonnée.
- Sud (Souss-Massa vers Guelmim, Laâyoune, Dakhla) : AUCUN TROUVÉ. Recherches faites le 23/11/2026 : 'transfert eau Souss-Massa 2026 nouvelle conduite Sud Guelmim Tan-Tan Laâyoune' ; 'autoroute de l'eau Gharb Oum Er-Rbia 2026 conduite' ; 'dessalement Laâyoune Dakhla Guelmim 2026 station capacité état' ; 'transfert eau dessalée Agadir Chtouka Marrakech ou Taroudant conduite 2026 ONEE'. Le360 PLF 2027 (LU) : Guelmim-Oued Noun = dévasement de Ouin Koura seulement ; Laâyoune = prise d'eau de la station ; Dakhla = conduite depuis la station. Aucune conduite inter-régions vers le Sud.

## (f) Dessalement

- Casablanca (Le360, juillet 2026, LU) : 548 000 m3/j (environ 200 Mm3/an) en première tranche, 822 000 m3/j vers mi-2028 (soit environ 300 Mm3/an, arithmétique), 6,5 milliards MAD PPP, travaux depuis juin 2024, raccordement électrique 400 kV le 19/07/2026, mise en service annoncée février 2027, station non en exploitation. Lamharza Essahel est un poste électrique, pas la station. Aucune coordonnée ; aucune conduite décrite.
- Chtouka-Agadir : 275 000 m3/j, extension à 400 000 m3/j annoncée (Hespress, LU) ; ligne PLF 2027 de 2 833,33 MDH (533,3 MDH en 2027) (Le360, LU). UNVERIFIED : travaux d'extension 2026, horizon 2027, doublement de 43,5 km.
- Dakhla : 97 % au 30/10/2026, 37 Mm3/an, aucune production confirmée (Le360 31/10/2026, LU) ; conduite d'adduction de 450 MDH (PLF 2027).
- Laâyoune : 600 l/s, troisième unité à l'étude (Hespress 07/09/2026, LU).
- Guelmim, Sidi Ifni, Tan-Tan : chiffres contradictoires non lus (35, 50 ou 100 Mm3/an), 2029-2030, UNVERIFIED.
- Safi vers Marrakech : 'fin juillet 2026' (Aujourd'hui.ma 02/07/2026, LU) ; aucune confirmation après le 31/07/2026 ; reste 'en construction'.

## Autres remarques

- Hassan II vers Mohamed V : `national-dams.json` (OSM) place Hassan II à 34,2067 ; -2,6399, alors que l'extrémité du lien utilise Wikidata 32,7916 ; -4,76837. À revérifier ; non modifié.
- Capacités publiées telles quelles ; aucune n'est un volume transférable attribué à une région.
