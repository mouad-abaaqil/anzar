# 11 - Liens hydrauliques documentés entre barrages et bassins

Date de lecture : 2026-11-23. Livrable de données : `platform/data-raw/links/water-links.json` (23 liens, tableau JSON ; la liste « rien trouvé » est dans ce fichier). Chaque lien porte `sourceUrl`, `readDate` et `verified`. `verified: true` signifie que la page citée a été ouverte et lue ce jour ; `false` signifie extrait de recherche ou page illisible (HTTP 403), donc UNVERIFIED.

## Résumé

- En service et lu : Sebou vers Bouregreg (15 m3/s, 67 km, 28/08/2023), galerie de Matmata Allal Al Fassi vers Idriss 1er (15,45 km, 38 m3/s), Dar Khrofa vers station El Hachef (75 Mm3/an, 2021), conduite Idriss 1er vers Fès/Meknès, conduite de dessalement d'Agadir (44 km).
- Planifié : prolongement Sebou-Bouregreg vers l'Oum Er-Rbia (800 Mm3/an, longueur en conflit : environ 210 km ou près de 300 km), phase 3 Laou-Loukkos-Sebou, barrage Tfer (400 Mm3/an transférables), étude Ouergha-Lben-Inaouen, extension ultérieure vers Al Massira.
- Dernier état connu, à revérifier : Oued El Makhazine vers Dar Khrofa (96 % en janvier 2025, mise en service jamais confirmée dans mes lectures) ; dessalement de Safi vers Marrakech (185,3 km, 3,2 m3/s, mise en service annoncée fin juillet 2026, activation non confirmée au 31/07/2026).
- Sud : le seul projet lu est la station de Dakhla/Bir Anzarane (37 Mm3/an, 97 % au 31/10/2026), locale. Aucun lien documenté entre Souss-Massa et Tensift, Drâa-Oued Noun, Guelmim ou le Sahara.

## Ce que le jeu de données ne dit PAS

- Bouhouda vers Al Wahda : déversement amont-aval cité par Le360 (17/04/2026), pas un ouvrage.
- Aucun tracé de conduite : les sources lues ne publient pas de coordonnées de tracé.
- lat/lon seulement pour des barrages lus sur Wikipédia/Wikidata (Bin El Ouidane n'est pas dans un lien). Les conversions DMS vers décimal sont de l'arithmétique.
- Bin El Ouidane vers Ahmed El Hansali : aucun lien direct documenté. Bin El Ouidane est sur l'oued El Abid, Ahmed El Hansali sur l'Oum Er-Rbia ; seul le projet Sebou-Bouregreg les cite ensemble comme sources de 180 Mm3 (Le360, 07/06/2023). Ne pas dessiner de flèche.
- Al Massira, Mohamed V : aucun barrage voisin nommé dans les pages lues. Hassan II (Midelt) vers Mohamed V est un lien d'après la motivation de construction (envasement de Mohamed V) ; la page FR place Hassan II sur l'oued Za, Wikidata sur la Moulouya : verified false.
- Oum Er-Rbia : Wikipédia FR liste Al Massira, Imfout, Daourat, Maâchou sans ordre ; aucune cascade dessinée. Ahmed El Hansali : pas de position relative documentée.
- Al Massira vers Marrakech : documenté par le rapport d'achèvement de la BAD (19/12/2022, PDF lu avec pdftotext) : prise sur le barrage, 2,5 m3/s nominal, mise en service partielle 27/03/2022 (environ 500 l/s) ; débit nominal prévu vers juillet 2023, non confirmé. Longueur totale non lue.

## UNVERIFIED (non lu ou illisible)

- Aoulouz vers Taroudant (200 l/s, environ 80 km, achevé 14/10/2021) : Médias24, MAP, LesEco, SNRT en 403 ; extraits de recherche seulement.
- Conduite Aoulouz vers Sidi Boushab/Abdelmoumen (50 km, 1 m3/s) : article La Vie Éco lu, mais il annonce une mise en service planifiée juillet 2020 ; statut actuel non lu.
- Trois stations de dessalement Sidi Ifni/Guelmim/Tan-Tan (97 Mm3) : Atalayar en 403.
- Rocade Oum Er-Rbia vers Tensift (environ 300 Mm3/an, 120 km), 70 Mm3/an Al Massira vers Marrakech, Bouregreg-Al Massira (30 m3/s, 209,6 km), débit 3,2 m3/s Makhazine-Dar Khrofa, partenaires PPP : extraits de recherche non lus.
- Médias24 04/06/2026 (Sebou, deux projets) et Medias24 28/10/2025 (échéance fin décembre 2025) : 403.
- Programme national 2020-2027 : le document lui-même n'a pas été lu. Hespress 26/03/2025 (lu) dit que le projet y figure et cite 17 installations de transfert inter-bassins, sans les lister.

## Conflits à ne pas arbitrer

- Longueur du prolongement vers l'Oum Er-Rbia : environ 210 km (Le360 17/04/2026) contre près de 300 km (Le360 29/08/2026).
- Volume annuel Sebou-Bouregreg : 560 Mm3 déjà dépassés (Le360 29/08/2026) ; cumul 953 Mm3 sur août 2023-décembre 2025 (Le360 17/04/2026). Ce sont deux mesures différentes.
- Chiffre 800 Mm3/an : cible du prolongement (Le360 29/08/2026) ou du Sebou-Bouregreg porté à 45 m3/s (Hespress) ; la relation avec les 1 200 Mm3/an n'est pas expliquée.

## Sources principales lues le 2026-11-23

- Le360, 17/04/2026 (mix hydrique) ; Le360, 29/08/2026 (300 km, 800 Mm3) ; Le360, 26/10/2026 (PLF 2027) ; Le360, 31/10/2026 (Dakhla) ; Le360, 07/06/2023.
- Hespress, 26/03/2025 ; Hespress, 19/04/2026 (20 sites de barrages, aucun transfert).
- La Vie Éco, 31/01/2025 ; La Vie Éco, Souss-Massa (2020) ; La Tribune de Marrakech, 31/07/2026 ; FNH, 03/02/2022.
- Wikipédia FR : Allal Al Fassi, Idriss I, Hassan II, Mokhtar Soussi, Oum Errabiâ ; Wikipédia EN : Al Massira, Mohamed V, Al Wahda, Bin el Ouidane ; Wikidata Q2884951.
- Banque africaine de développement, rapport d'achèvement Marrakech (PDF), 19/12/2022.
- Lectures faites via l'outil WebFetch, qui résume la page : les chiffres cités sont ceux restitués par ce résumé, pas relus sur le texte brut.
- Complément : docs/research/02-transfers-and-neighbouring-dams.md (lectures du 2026-11-19).

## Complément du 2026-11-23 : résolution des trous (links-v2)

Détail, URLs et UNVERIFIED : `platform/data-raw/links/resolve-notes.md` ; données : `platform/data-raw/links/links-v2.json` (26 liens, 7 dessinables contre 6).

- Sebou vers Bouregreg : prise en amont du barrage de garde du Sebou près de Kénitra (La Vie Éco 23/09/2024), 66,7 km, deux stations de pompage, 28/08/2023. Aucune coordonnée de la prise ; Wikidata donne deux points contradictoires pour le barrage Sidi Mohammed Ben Abdellah (33,9378 ; -6,7509 non référencé, 33,562 ; -6,4456 référencé), aucun reporté. Aujourd'hui.ma 02/10/2026 cite Al Wahda comme départ : écarté (contredit).
- El Hachef, Tfer, Koudiat Borna : aucune coordonnée trouvée. Tfer est décrit comme barrage de régulation des crues (province de Larache, L'Observateur 16/02/2026) ; le chiffre de 400 Mm3/an est un volume de conception du PLF 2027.
- Aoulouz : Taroudant 80 km, 200 l/s, 250 MDH (achèvement annoncé 10/2021, exploitation non confirmée) ; Sidi Boushab 49-50 km, statut 2026 inconnu ; arc dessiné vers le barrage Abdelmoumen (OSM), pas vers la station.
- Sud : aucun transfert ni conduite documenté vers Souss-Massa-Guelmim-Laâyoune-Dakhla (4 recherches, PLF 2027 lu).
- Dessalement : Casablanca 548 000 m3/j (200 Mm3/an), extension à 822 000 m3/j (environ 300 Mm3/an), mise en service annoncée février 2027 ; Dakhla 97 % (31/10/2026), non en production confirmée ; Safi-Marrakech non confirmée après le 31/07/2026.
