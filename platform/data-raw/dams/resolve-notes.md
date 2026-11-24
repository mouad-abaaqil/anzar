# Résolution des coordonnées de barrages, v2

Lecture : 2026-11-23. Scripts : `platform/pipeline/dams/harvest_candidates.py` (candidats Nominatim, Wikipédia fr/en, Wikidata ; rien n'y est accepté), `resolve_located_v2.py` (construit `located-v2.json`, décisions et preuves en dur). `national-dams.json` n'est pas modifié. Aucune écriture dans src/ ni public/data/.

## Résultat en bref

`status` décrit uniquement les coordonnées et la jointure de ligne. Les changements de capacité (44 enregistrements) ne se voient que dans `capacityMm3Source` et `capacityCheck`, même quand `status` vaut « inchangé ». Deux enregistrements de national-dams.json ont un identifiant invalide, repris tels quels : `""` (« سد ساهلة », Sahla) et `"-2"` (Lalla Takerkoust arabe) ; à régénérer avant toute clé sur `id`.

- 96 enregistrements (97 moins un doublon Wikidata supprimé) : 87 inchangés, 6 corrigés, 3 ambigus. Aucun nouveau point n'a été ajouté sur la carte : les 103 lignes non localisées sont presque toutes de petits ouvrages sans entrée OSM nommée ni Wikidata.
- 5 lignes de la table Wikipédia rattachées à un enregistrement déjà localisé (Bine El Ouidane, Mohamed B. A. El Khattabi, M'Daz, Douiss Errachidia, Sahla via son nom arabe, confiance moyenne) ; les 2 correspondances ambiguës d'origine (Sidi Mohamed Ben Abdallah, Hassan II) sont tranchées. Restent **98 lignes sans coordonnées**.
- Capacités : 44 enregistrements reçoivent la capacité du bulletin officiel du 2026-11-23 (voir plus bas) ; la valeur Wikipédia reste dans `capacityWikipediaMm3`.
- Les 96 points de located-v2.json passent le test point-dans-polygone (région du fichier = région du polygone, 0 écart).

## Sidi Mohamed Ben Abdellah : 33,94 / -6,75 est correct

Preuves (toutes lues le 2026-11-23) :
- OSM way 289906319 : 33,937868 / -6,75037.
- Wikidata Q12215598 (https://www.wikidata.org/wiki/Q12215598) a **deux** valeurs P625 : 33,937811 / -6,750905 (sans référence) et 33,562 / -6,4456 dont la référence est Q837615 = Wikipédia en cebuano (import automatique, valeur à rejeter).
- Wikipédia de, « Stausee Sidi Mohammed Ben Abdallah » (https://de.wikipedia.org/?curid=12888403) : 33,93888889 / -6,75055556, barrage sur le Bou Regreg, préfecture de Skhirate-Témara.
- Wikipédia ar (https://ar.wikipedia.org/?curid=838103) : situé à Oum Azza, province de Skhirate-Témara, à 24 km de Rabat, construit 1971-1973, reçoit Oued Grou et Korifla. Nominatim place Oum Azza à 33,88 / -6,79 (https://www.openstreetmap.org/node/10089193282), à 7 km du point retenu, contre environ 45 km pour 33,56 / -6,45.
- Bulletin officiel 2026-11-23 : le barrage est dans le bassin du Bouregreg (stock 663,40 Mm3 à 76,83 %).
Décision : enregistrement unique, coordonnées OSM, doublon Wikidata (33,562/-6,4456) supprimé. Capacité du bulletin : 863,5 Mm3 (table Wikipédia : 1025). La page Wikipédia fr n'a pas été trouvée sous les titres testés (non lue : UNVERIFIED) ; ABH Bouregreg et la presse n'ont pas été lus.

## Youssef Ben Tachfine : les points OSM/Wikidata sont corrects, region.json est faux

- OSM way 385158725 (api.openstreetmap.org, géométrie lue) : lat 29,8424 à 29,8485, lon -9,4980 à -9,4929, centre 29,8454 / -9,4955 = valeur de national-dams.json.
- Wikipédia fr « Barrage Youssef Ibn Tachfin » : 29,84556 / -9,49444 (0,1 km).
- `platform/public/data/region.json` : 29,809193 / -9,472591 avec `locationUrl` = ce même way 385158725, mais le point est à 4,6 km hors de l'emprise du way. À corriger dans region.json (je n'y ai pas touché) : 29,8454 / -9,4955. Les autres écarts de validation-souss-massa.json (Aoulouz 2,9 km, Abdelmoumen 1,9 km, Moulay Abdellah 1,6 km, Mokhtar Soussi 1,1 km) n'ont pas été examinés ici (UNVERIFIED).

## Hassan II et Oued Za (confusion de sources)

- Wikipédia fr « Barrage Hassan II » dit « sur l'oued Za, 54 km en amont de Taourirt, 400 Mm3 » mais donne les coordonnées de Midelt (32,7916 / -4,76837). Wikipédia en « Hassan II Dam » : barrage-poids sur la Moulouya, 13 km au nord de Midelt, 32,7914 / -4,7681. Le bulletin range « Hassan 2 » (353,7 Mm3 dérivés) et « Sur Oued Za » comme deux barrages distincts du bassin Moulouya.
- Décision : « Hassan II » (ligne 2006, 115 m, 400 Mm3) = Midelt, coordonnées Wikidata Q2884951 + Wikipédia fr + en (même zone) ; l'élément OSM de la retenue (relation 5745429) est à 4,5 km. Statut corrigé (nom « Hassan II (Midelt) », capacité 353,7 du bulletin ; table : 400).
- L'ouvrage OSM « Barrage Hassan II » (way 151579585, 34,2067 / -2,6399, commune d'Ahl Oued Za) reste ambigu : probablement le barrage de l'oued Za mal nommé, non prouvé. « Barrage sur Oued Za » (table : 275 Mm3 ; le360 2026-02-14 : province de Taourirt, retenue 156 Mm3 ; bulletin : 87,92 Mm3 à 100 %, donc capacité du bulletin incohérente avec le stock record de 156 Mm3) reste **sans coordonnées et sans capacité fiable**.

## Autres décisions

- **Bin el Ouidane** : déjà localisé (OSM way 504108035 / 428259386, Wikidata Q2884936). La ligne Wikipédia « Bine El Ouidane » n'était pas jointe à cause de l'orthographe. Points Wikipédia fr (32,106667 / -6,463889) et en à moins de 0,1 km. Capacité du bulletin : 1273,4 Mm3 (1004,98 Mm3 à 78,92 %) ; table : 1384.
- **M'Daz** : Wikidata Q130337597 « Madaz Dam », sur l'oued Sebou, 33,6816 / -4,5257 (Fès-Meknès) ; rattaché à la ligne « M'Daz » (2025, 700 Mm3) par le nom. Une seule source ; capacité 700 Mm3 non confirmée (absent du bulletin).
- **Douiss Errachidia** : OSM « Barrage Douiss », province d'Errachidia (retenue way 1103665206, 0,5 km). Une seule source. « Douiss Figuig » reste sans coordonnées.
- **Mohamed Ben Abdelkrim El Khattabi** : jointure par nom à la ligne de 1981 ; bulletin : 10,5 Mm3 dérivés contre 33,6 dans la table. Valeur du bulletin retenue.
- **Sakia El Hamra** : coordonnée cohérente (Wikidata = Wikipédia fr = coin nord-ouest de la retenue OSM way 368097056, 15 km de long). Le point OSM central est à 9 km : c'est le centre de la retenue, pas le barrage. Capacité laissée null : table 110, Wikipédia fr 112, aucune source officielle lue. Statut ambigu.
- **Tamesna rejeté** : Nominatim donne « Barrage Tamesna » (way 136001154) à M'Garto, province de Settat. Le bulletin range Tamesna dans le bassin du Bouregreg (près de Rabat) : l'objet de Settat n'est pas le barrage de la table. Non ajouté.
- **Lalla Takerkoust** : doublon Wikidata arabe (Q138337607, id « -2 ») à 5,3 km de la position OSM : au-delà du seuil de 5 km, non fusionné, statut ambigu.
- **Oued El Maleh** (Wikidata Q27513866, construit en 1930) : correspond peut-être à la ligne « Mellah » (1931, 6,6 Mm3) ; le bulletin « El Maleh » (38,8 Mm3) serait plutôt « EL MALLEH Amont » (2012). Non joint, enregistrement inchangé.
- **Sfissef** (OSM node 2516958173) joint au bulletin « Sfisif » (bassin Moulouya) avec confiance « moyenne » ; son point (32,336 / -1,346) est dans la région Oriental mais près de la frontière : à garder sous contrôle. Même confiance moyenne pour « Sahla » (nom arabe).

## Capacités : bulletin officiel du 2026-11-23

Source : Ministère de l'Équipement et de l'Eau, « Situation journalière des barrages », 23 novembre 2026, publié par Maa Dialna : https://maadialna.ma/sites/default/files/barrages/2026-11-23/fr/etat_global.pdf (PDF composé d'images, 12 pages, lu à l'œil page par page). Taux global : 66,09 % (11 253,50 sur 17 027,59 Mm3). Par barrage, la page du bassin donne le **stock (Mm3) et le taux de remplissage** ; la capacité est dérivée : capacité = stock / taux. Contrôle : pour les 9 bassins, la somme des capacités dérivées retombe sur le total « sur X Mm3 » du bulletin (écart au plus 0,4 Mm3 sur 5 003), ce qui valide la lecture et la méthode, pas la saisie individuelle de chaque ligne (relue une fois). Précision individuelle : environ 1 %. Le bulletin ne dit pas si cette capacité est « normale » ou « utile actuelle » : c'est la capacité sur laquelle le ministère calcule le taux du jour.

Écarts importants avec la table Wikipédia (capacité de conception de 2011) : Mohamed V 164,9 (table 410), Bouhouda 44,9 (275), Allal Al Fassi 15,7 (81,5), Imfout 9,0 (27), Mohamed Ben Abdelkrim El Khattabi 10,5 (33,6), Moulay Youssef 128,6 (175), Al Wahda 3452 (3800), Al Massira 2650 (2760), Bin el Ouidane 1273 (1384), Idriss 1er 1075 (1186), Oued El Makhazine 696 (773), Ahmed El Hansali 697 (740). Les valeurs du bulletin sont retenues dans `capacityMm3` ; la table reste dans `capacityWikipediaMm3` et `capacityCheck.wikipediaMm3`. Un écart aussi fort que Bouhouda ou Mohamed V (envasement, redéfinition de la capacité ou erreur de table) n'est pas expliqué par une source lue : à confirmer avant publication.

Autre contrôle : la capacité dérivée de Hassan II (353,7) est proche de 353,691 Mm3 (valeur « bulletins ABHM » citée par une recherche web, non lue par moi : UNVERIFIED). Les données remplissage du bulletin (stock, taux) ne sont pas copiées dans le jeu : seulement la capacité dérivée, avec stock et taux dans `capacityCheck` pour audit.

Barrages du bulletin sans coordonnées ni enregistrement : Kharroub, Charif El Idrissi, Moulay Lahssen Ben Lmahdi, Chefchaouen, Tanger Med, Ibn Battouta, Joumoua, Sidi Idriss, Timinoutine, Aït Messaoud, Rkiza, Tamalout, Injil, Garde Sebou, Tamesna, El Hmer, Oued Za, Abou Abbass Es-Sabti, Moulay Abderrahmane, Ben Slimane El Jazouli, Agdez, Touizgui Ramz, Sultan Moulay Ali Chérif, Toudgha. Tiouine et Sidi Abou ne figurent pas dans le bulletin.

## Ce qui reste sans coordonnées (98 lignes)

Aucune coordonnée acceptée parmi : Tiouine (270 Mm3), Agdez (M'Daz n'a qu'un point Wikidata, voir plus haut), Sidi Abou (200), Oued Za, Tamesna, Tamalout, Touizgui Remz, Mazer, Sfeissif, Al Himer, Tanger Med, Ibn Batouta, Timi N'Outine, Garde du Loukkos, Garde du Sebou, Enjil, Ait Messaoud, My Hassan Bel Mehdi, Koudiat El Garn, etc. Tentatives : Nominatim (« barrage X », « X dam », variantes d'orthographe et noms arabes pour Tiouine, M'Daz, Sidi Abou, Agdez, Touizgui Remz, Tamalout, Sahla, Maleh, Tamesna : 0 résultat), Wikipédia fr/en (recherche + prop=coordinates : seulement des articles de villes ou de rivières, rejetés), Wikidata (wbsearchentities). Les sites officiels water.gov.ma, equipement.gov.ma et les pages d'agences de bassin n'ont pas répondu (échec de connexion) : non lus. Garde du Sebou : la recherche renvoie Allal Al Fassi (autre barrage, rejeté).

## Limites

- Les points OSM de retenues (natural=water) sont des centres de plan d'eau, pas des sites de mur. Aucun point n'est un capteur.
- Une seule source pour Douiss Errachidia, M'Daz, Sfissef : règle « 2 sources à 5 km » non applicable.
- Le bulletin est lu sur images ; une erreur de lecture sur un chiffre isolé est possible malgré le contrôle par somme de bassin.
