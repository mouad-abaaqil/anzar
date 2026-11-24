# 12. Barrages nationaux : jeu de données ouvert

Date de lecture de toutes les sources : 2026-11-23. Script : `platform/pipeline/dams/build_national_dams.py` (README dans le même dossier). Sortie : `platform/data-raw/dams/national-dams.json`. Aucun fichier existant n'a été modifié.

## Résultat

**97 barrages localisés** dans 11 régions sur 12. 40 ont une capacité en Mm3, 57 non (null). 40 sont joints à une ligne de la table Wikipedia ; 3 ont un bassin déduit ; 22 n'ont que des coordonnées Wikidata.

Couverture par région : Tanger-Tétouan-Al Hoceima 11, Oriental 8, Fès-Meknès 17, Rabat-Salé-Kénitra 6, Béni Mellal-Khénifra 6, Casablanca-Settat 6, Marrakech-Safi 9, Drâa-Tafilalet 18, Souss-Massa 12, Guelmim-Oued Noun 3, Laâyoune-Sakia El Hamra 1, Dakhla-Oued Ed-Dahab 0.

**Le jeu est incomplet.** La table Wikipedia compte 145 grands barrages ; 103 n'ont aucune coordonnée vérifiable (liste dans `national-dams-unlocated.json`) et ne doivent pas être placés sur la carte. Parmi eux de grands ouvrages : Bin el Ouidane (1384 Mm3), M'Daz (700), Oued Za (275), Tiouine (270), Agdez (247), Sidi Abou (200). Raison : 1386 éléments OSM sur 1526 n'ont pas de nom, et Wikidata n'a que 46 barrages avec coordonnées. Ce n'est pas la liste complète des barrages du Maroc. Aucune donnée de remplissage ni de volume actuel : seulement la capacité de conception.

## Méthode

1. **OSM (Overpass)** : `waterway=dam` ou `man_made=dam` dans une boîte englobant tout `morocco-regions.geojson` (lat 20,7 à 36,0 ; lon -17,2 à -0,9), pour inclure les provinces du Sud, puis filtre par point dans polygone. Base OSM du 2026-11-23T14:04:09Z, instance https://lz4.overpass-api.de/api/interpreter. 1526 éléments, 1386 sans nom, 5 noms génériques écartés, 135 nommés après fusion des segments d'un même ouvrage (même wikidata, ou même nom normalisé à moins de 3 km). Pour un ouvrage à plusieurs éléments OSM, la coordonnée est celle du premier élément dans l'ordre de la réponse Overpass ; les autres URL sont listées dans `sources`.
2. **Wikidata (SPARQL)** : instances de barrage (Q12323) dont le pays est le Maroc ou le Sahara occidental : 62 éléments, 16 sans coordonnées. Un élément Wikidata est fusionné avec l'élément OSM le plus proche à moins de 5 km dont le nom a une similarité d'au moins 0,75, sinon il devient un enregistrement à part (coordonnée Wikidata). P2053 n'est pas une capacité (surface du bassin versant) : non utilisé. **Les capacités Wikidata (P2234) ne sont jamais publiées** : elles sont aberrantes (Bin el Ouidane 0,365 Mm3 contre 1384 dans Wikipedia ; Mohamed V équivalent à 0 Mm3 contre 410) ; elles ne servent qu'à détecter des conflits.
3. **Wikipedia fr, « Barrages du Maroc »** (oldid 239787126, révision du 2026-09-24T22:13:34Z) : année, hauteur, capacité (Mm3), fonction. Pas de coordonnées. La page cite des chiffres de water.gov.ma consultés en 2011 : valeurs secondaires, capacité initiale de conception et non volume utile actuel. Le champ `purpose` reprend les codes bruts de la table (E, I, AEPI, BC…), non décodés : la légende n'est pas lue sur la page.
4. **Jointure** Wikipedia vers OSM/Wikidata par nom normalisé (accents, « 1er » vers « I », translittérations), similarité d'au moins 0,88 et écart d'au moins 0,05 avec le deuxième candidat, ou égalité exacte unique. Ambigu : non joint. Score conservé dans `wikipediaMatch`. À relire (score sous 1) : Imaouen/Imaouene, agherghiz/Agherghis, Mechraa Hammadi/Mechra Homadi, 9 April 1947/9 Avril 1947. Le nom affiché est celui de la ligne Wikipedia quand il y a jointure, sinon `name:fr`, sinon la partie latine de `name`.
5. **Région** : lancer de rayon sur Polygon et MultiPolygon. 57 points tombent hors de toutes les régions (îles Canaries, Madère, Algérie, Mauritanie) : exclus, listés dans le fichier unlocated. Les polygones sont simplifiés : un barrage frontalier algérien pourrait y entrer ; les noms d'Oriental et de Drâa-Tafilalet ont été relus, aucun nom étranger évident, mais « Barrage Sfissef » (Oriental) n'a pas été vérifié (UNVERIFIED).
6. **Bassin** : seulement si le cours d'eau Wikidata désigne sans ambiguïté un des 9 bassins du bulletin (table de mots-clés écrite par moi, non vérifiée auprès des agences de bassin : UNVERIFIED). Résultat : 3 barrages. Les autres sont null ; le bassin n'est pas déduit de la région (un bassin traverse plusieurs régions).

## Validation avec les 9 barrages de Souss-Massa (region.json)

Les points de region.json viennent d'OSM : l'écart OSM est circulaire. Seul l'écart Wikidata est indépendant, et il n'existe que pour 3 barrages (Aoulouz 0,48 km, Youssef Ben Tachfine 4,56 km, Mokhtar Soussi 1,06 km, plus Sidi Abdellah 0,05 km). Détails dans `validation-souss-massa.json`. Colonne « même objet OSM » : l'URL OSM de region.json figure-t-elle parmi les URL de l'enregistrement national ?

| Barrage | écart OSM (km) | écart Wikidata (km) | même objet OSM |
|---|---|---|---|
| Moulay Abdellah | 1.63 | n/d | non |
| Dkhila | 0.02 | n/d | oui |
| Ahl Souss | 0.02 | n/d | oui |
| Aoulouz | 2.89 | 0.48 | oui |
| Sidi Abdellah | 0 | 0.05 | oui |
| Youssef Ben Tachfine | 4.59 | 4.56 | oui |
| Abdelmoumen | 1.88 | n/d | oui |
| Imi El Kheng | 0.01 | n/d | oui |
| Mokhtar Soussi | 1.11 | 1.06 | non |

Écarts à signaler : Youssef Ben Tachfine 4,59 km (OSM) et 4,56 km (Wikidata) : les deux sources concordent entre elles mais pas avec region.json, qui est donc à revérifier. Aoulouz 2,89 km (mais 0,48 km avec Wikidata). Abdelmoumen 1,88 km. Moulay Abdellah 1,63 km et Mokhtar Soussi 1,11 km : l'URL OSM de region.json n'est pas dans l'enregistrement, donc un autre élément OSM du même nom a été retenu. Aucune coordonnée n'est corrigée automatiquement ; à trancher à la main avant tout usage cartographique fin.

## Anomalies et jointures non faites

- « Hassan II » et « Sidi Mohamed Ben Abdallah » restent non joints (candidats multiples). « Saquia El Hamra » (110 Mm3) n'est pas joint au « barrage Sakia El Hamra » de Laâyoune (capacité null), probablement le même ouvrage : orthographe trop éloignée pour une jointure automatique.
- « Barrage Tizguit » et « Barrage Tizguit Haut » (0,9 km) sont conservés comme deux ouvrages distincts, à confirmer.

## Sources testées

- Overpass : overpass-api.de HTTP 200 au premier essai, puis 502 à la collecte finale ; overpass.kumi.systems : expiration sans réponse ; lz4.overpass-api.de : 502 au premier essai, 200 à la collecte finale (retenu). Essais enregistrés dans `national-dams.meta.json`.
- Wikidata SPARQL : HTTP 429 (limite 1 requête/minute) aux premiers essais, 200 ensuite.
- Wikipedia fr API : 200.
- GRanD / Global Dam Watch : non obtenu. La page globaldamwatch.org/grand répond 200 mais ne contient aucun lien de téléchargement sans JavaScript ; un essai direct sur figshare a répondu 403. GeoDAR : non testé (UNVERIFIED). HDX (recherche « morocco dams ») : 0 résultat.

## Licences et attribution

OSM : ODbL 1.0, « (c) contributeurs OpenStreetMap » ; Wikidata : CC0 ; Wikipedia fr : CC BY-SA 4.0 (attribution à la page et à son historique, partage à l'identique). Chaque enregistrement porte ses URL et sa date de lecture.

## Limites

57 barrages sur 97 sans capacité. Dakhla et presque tout le Sud absents. Les points OSM sont des centres d'éléments, pas des sites de capteurs. Aucune liaison hydraulique n'est déduite.


## Ajouts : résolution v2 (2026-11-23)

Détails, preuves et décisions : `platform/data-raw/dams/resolve-notes.md`. Sortie : `platform/data-raw/dams/located-v2.json` (national-dams.json inchangé). Scripts : `platform/pipeline/dams/harvest_candidates.py`, `resolve_located_v2.py`.

- Aucun point nouveau : les 98 lignes encore non localisées (dont Tiouine, M'Daz côté source géographique unique, Agdez, Sidi Abou, Oued Za) n'ont aucune coordonnée citable dans OSM/Nominatim, Wikipédia ou Wikidata. 5 lignes de la table ont été rattachées à des points existants (Bin el Ouidane, Khattabi, M'Daz, Douiss Errachidia) ; Sidi Mohamed Ben Abdellah et Hassan II sont tranchés.
- Sidi Mohamed Ben Abdellah : 33,94 / -6,75 correct (OSM, Wikidata, Wikipédia de, Wikipédia ar : Oum Azza, Skhirate-Témara). L'autre point (33,562 / -6,4456) est une valeur Wikidata sourcée de Wikipédia en cebuano, rejetée.
- Youssef Ben Tachfine : OSM et Wikipédia fr concordent (29,8454 / -9,4955) ; `region.json` (29,8092 / -9,4726) est à 4,6 km, hors de l'emprise du way OSM cité : à corriger.
- Hassan II (Midelt, Moulouya) distinct de l'ouvrage de l'oued Za ; Wikipédia fr mélange texte (Za) et coordonnées (Midelt).
- Capacités : le bulletin officiel du 2026-11-23 (https://maadialna.ma/sites/default/files/barrages/2026-11-23/fr/etat_global.pdf) donne stock et taux par barrage ; capacité = stock / taux, validée par la somme de chaque bassin. Écarts forts avec la table Wikipédia (Mohamed V 165 contre 410, Bouhouda 45 contre 275) : à confirmer avant publication.
- Tamesna (OSM, province de Settat) rejeté : le bulletin place Tamesna dans le bassin du Bouregreg.
