#!/usr/bin/env python3
"""Etape 2 : construit data-raw/dams/located-v2.json a partir de national-dams.json (non modifie).
Entrees : national-dams.json, national-dams-unlocated.json, public/data/morocco-regions.geojson (lecture seule).
Les decisions (jointures, preuves) sont ecrites ici en dur, avec leurs sources, et expliquees dans resolve-notes.md.
Capacite : bulletin quotidien officiel Maa Dialna / ministere de l'Equipement et de l'Eau du 2026-11-23
(https://maadialna.ma/sites/default/files/barrages/2026-11-23/fr/etat_global.pdf, PDF image lu a la main).
Le bulletin donne par barrage un stock (Mm3) et un taux de remplissage (%) : capacite = stock / taux
(validation : la somme par bassin retombe sur le total du bulletin, voir resolve-notes.md). Precision ~1 %.
Usage : python3 -I resolve_located_v2.py
"""
import json, os, math
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DD = os.path.join(ROOT, 'data-raw', 'dams')
READ = '2026-11-23'
BUL_URL = 'https://maadialna.ma/sites/default/files/barrages/2026-11-23/fr/etat_global.pdf'
# (nom bulletin, stock Mm3, taux %) ; total bassin du bulletin (Mm3) pour controle
BULLETIN = {
 'Loukkos': (1956.55, [('Kharroub',167.62,88.81),('Tanger Med',19.18,84.80),('Charif El Idrissi',110.58,82.87),('Smir',35.57,78.96),('MLY Lahssen Ben Lmahdi',23.23,78.60),('Dar Khroufa',368.81,77.68),('Chefchaouen',8.83,75.53),('9 avril 1947',203.39,66.55),('Oued El Makhazine',454.70,65.35),('Nakhla',2.47,58.65),('Ben Abdelkrim Khattabi',3.81,36.20),('Ibn Battouta',9.34,32.02),('Joumoua',0.95,17.57)]),
 'Oum Er-Rbia': (5003.37, [('Sidi Idriss',0.52,95.10),('Timinoutine',0.69,93.98),('Moulay Youssef',109.07,84.83),('Ahmed El Hanssali',572.16,82.07),('Hassan 1er',187.26,81.51),('Bin El Ouidane',1004.98,78.92),('Douarat',3.28,64.38),('Sidi Said Maachou',0.47,60.80),('Al Massira',1107.10,41.78),('Ait Messaoud',3.20,36.31),('Imfout',0.75,8.32)]),
 'Moulouya': (701.49, [('Sur Oued Za',87.92,100.00),('Sfisif',17.27,98.90),('Rkiza',13.80,88.46),('Tamalout',41.77,87.26),('Mohamed 5',114.62,69.49),('Hassan 2',216.44,61.20),('Mechraa Homadi',2.51,53.76),('Injil',3.45,36.99)]),
 'Sebou': (5370.33, [('Garde Sebou',21.18,97.04),('Allal El Fassi',14.98,95.55),('El Kensera',187.74,91.65),('Sahla',63.55,89.30),('Bab Louta',29.31,85.00),('Bouhouda',34.64,77.17),('Al Wahda',2550.03,73.87),('Idriss 1er',772.08,71.81),('Sidi Echahed',93.04,60.41),('Asfalou',168.68,57.21),('Michlifen',0.75,54.63)]),
 'Bouregreg': (1473.39, [('Tiddas',401.19,79.32),('Tamesna',40.25,77.99),('Sidi Med Ben Abdellah',663.40,76.83),('El Maleh',18.98,48.91),('El Hmer',0.74,5.37)]),
 'Tansift': (203.17, [('Abou Abbass El Sabti',19.97,89.25),('MLY Abderrahmane',49.91,83.66),('Lalla Takerkousst',40.43,80.21),('Yaacoub El Manssour',46.07,79.49),('Ben Slimane El Jazouli',9.21,72.16)]),
 'Souss-Massa': (722.83, [('Moulay Abdallah',78.16,95.39),('Ahl Souss',4.58,93.21),('Oulouze',71.75,80.65),('Youssef Ben Tachfine',144.24,49.59),('Dkhila',0.11,48.22),('Sidi Abdallah',4.99,47.74),('Abdelmoumene',72.48,36.53),('Imi El Kheng',2.18,30.09),('Med Mokhtar Soussi',4.22,10.61)]),
 'Draa-Oued Noun': (1048.18, [('Manssour Dahbi',220.23,49.46),('Agdez',117.31,47.93),('Touizgui Ramz',19.80,25.38),('Sultan Mly Ali Cherif',62.25,22.22)]),
 'Guir-Ziz-Gheris': (548.28, [('Hassan Addakhil',229.73,79.89),('Kadoussa',96.38,42.99),('Toudgha',3.23,8.84)]),
}
BUL = {}
for basin, (tot, rows) in BULLETIN.items():
    for n, s, p in rows:
        BUL[n] = {'basin': basin, 'stock': s, 'pct': p, 'cap': s / (p / 100.0)}
# id national -> nom bulletin (jointure par nom ; 'moyen' = nom approximatif, a revoir)
JOIN = {
 'ahmed-el-hansali': ('Ahmed El Hanssali','fort'), 'barrage-bin-el-ouidane': ('Bin El Ouidane','fort'), 'hassan-premier': ('Hassan 1er','fort'),
 'moulay-youssef': ('Moulay Youssef','fort'), 'al-massira': ('Al Massira','fort'), 'daourat': ('Douarat','fort'), 'sidi-said-maachou': ('Sidi Said Maachou','fort'),
 'imfout': ('Imfout','fort'), 'barrage-sfissef': ('Sfisif','moyen'), 'mechra-homadi': ('Mechraa Homadi','fort'), 'mohamed-v': ('Mohamed 5','fort'), 'barrage-hassan-ii-2': ('Hassan 2','fort'),
 'allal-al-fassi': ('Allal El Fassi','fort'), 'el-kansera': ('El Kensera','fort'), 'bab-louta': ('Bab Louta','fort'), 'bouhouda': ('Bouhouda','fort'), 'al-wahda': ('Al Wahda','fort'),
 'idriss-1er': ('Idriss 1er','fort'), 'sidi-chahed': ('Sidi Echahed','fort'), 'asfalou': ('Asfalou','fort'), 'barrage-de-michlifen': ('Michlifen','fort'), '': ('Sahla','moyen'),
 'tiddas': ('Tiddas','fort'), 'barrage-sidi-mohammed-ben-abdallah': ('Sidi Med Ben Abdellah','fort'),
 'lalla-takerkoust': ('Lalla Takerkousst','fort'), 'yaacoub-el-mansour': ('Yaacoub El Manssour','fort'),
 'moulay-abdellah': ('Moulay Abdallah','fort'), 'ahl-souss': ('Ahl Souss','fort'), 'aoulouz': ('Oulouze','fort'), 'youssef-ben-tachfine': ('Youssef Ben Tachfine','fort'),
 'dkhila': ('Dkhila','fort'), 'barrage-sidi-abdellah': ('Sidi Abdallah','fort'), 'abdelmoumen': ('Abdelmoumene','fort'), 'barrage-imi-el-kheng': ('Imi El Kheng','fort'), 'moukhtar-soussi': ('Med Mokhtar Soussi','fort'),
 'mansour-eddahbi': ('Manssour Dahbi','fort'), 'hassan-addakhil': ('Hassan Addakhil','fort'), 'kaddoussa': ('Kadoussa','fort'),
 'oued-el-makhazine': ('Oued El Makhazine','fort'), '9-avril-1947': ('9 avril 1947','fort'), 'smir': ('Smir','fort'), 'nakhla': ('Nakhla','fort'),
 'mohamed-ben-abdelkrim-el-khattabi-dam': ('Ben Abdelkrim Khattabi','fort'), 'barrage-dar-khrofa': ('Dar Khroufa','fort'),
}
# lignes de la table Wikipedia (non localisees) rattachees a un enregistrement existant
TABLE_ROW = {
 'barrage-bin-el-ouidane': 'Bine El Ouidane', 'mohamed-ben-abdelkrim-el-khattabi-dam': 'Mohamed B. A. El Khattabi',
 'barrage-m-dez': 'M’Daz', 'barrage-douiss': 'Douiss Errachidia', 'barrage-hassan-ii-2': 'Hassan Ii',
 'barrage-sidi-mohammed-ben-abdallah': 'Sidi Mohamed Ben Abdallah', '': 'Sahla',
}
def km(a, b, c, d):
    r = math.radians; h = math.sin(r(c - a) / 2) ** 2 + math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))
geo = json.load(open(os.path.join(ROOT, 'public', 'data', 'morocco-regions.geojson'), encoding='utf-8'))
def inring(ring, lat, lon):
    ins = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def region(lat, lon):
    for f in geo['features']:
        g = f['geometry']; polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for p in polys:
            if inring(p[0], lat, lon) and not any(inring(h, lat, lon) for h in p[1:]): return f['properties']['id']
    return None
def src(name, url): return {'name': name, 'url': url, 'readDate': READ}
OSMN = 'OpenStreetMap (Overpass, base du 2026-11-23T14:04:09Z)'
nat = json.load(open(os.path.join(DD, 'national-dams.json'), encoding='utf-8'))
_u = json.load(open(os.path.join(DD, 'national-dams-unlocated.json'), encoding='utf-8'))
unl = {u['name']: u for u in _u['unlocated'] + _u['ambiguous']}
byid = {d['id']: d for d in nat}
out = []
DROP = {'sidi-mohammed-ben-abdellah-dam'}  # doublon Wikidata, coordonnee cebwiki erronee (voir notes)
def first_src(d):
    s = d['sources'][0]; return {'name': s['name'], 'url': s['url'], 'readDate': s['readDate']}
EXTRA = {
 'barrage-bin-el-ouidane': dict(name='Bin el Ouidane', second=[src('Wikipedia fr, Barrage Bin el Ouidane (32.106667, -6.463889)', 'https://fr.wikipedia.org/?curid=416804'), src('Wikipedia en, Bin el Ouidane Dam (32.10666667, -6.46361111)', 'https://en.wikipedia.org/?curid=32836327')], status='corrigé',
   note='Aucune erreur de coordonnee : la ligne Wikipedia « Bine El Ouidane » n avait pas ete jointe a cause de l orthographe. Jointure ajoutee ; points OSM/Wikipedia a moins de 0,1 km.'),
 'barrage-sidi-mohammed-ben-abdallah': dict(name='Sidi Mohamed Ben Abdellah', second=[src('Wikidata Q12215598, premiere valeur P625 (33.937811, -6.750905)', 'https://www.wikidata.org/wiki/Q12215598'), src('Wikipedia de, Stausee Sidi Mohammed Ben Abdallah (33.93888889, -6.75055556)', 'https://de.wikipedia.org/?curid=12888403')], status='corrigé',
   note='Deux positions a 40 km : 33,94/-6,75 est correcte (OSM, Wikidata premiere valeur, Wikipedia de, a moins de 0,1 km ; Wikipedia ar : barrage a Oum Azza, province de Skhirate-Temara, a 24 km de Rabat ; bulletin 2026-11-23 : bassin du Bouregreg). 33,562/-6,4456 est une seconde valeur P625 dont la reference est la Wikipedia en cebuano (Q837615) : rejetee, doublon supprime.'),
 'barrage-hassan-ii-2': dict(name='Hassan II (Midelt)', second=[src('Wikipedia fr, Barrage Hassan II : coordonnees 32.7916, -4.76837 (le texte de la page parle a tort de l oued Za)', 'https://fr.wikipedia.org/?curid=4077379'), src('Wikipedia en, Hassan II Dam (32.7914, -4.7681)', 'https://en.wikipedia.org/?curid=41887720'), src('OpenStreetMap relation 5745429 (retenue, centre 32.8181, -4.8048, a 4,5 km)', 'https://www.openstreetmap.org/relation/5745429')], status='corrigé',
   note='Ligne « Hassan Ii » (2006, 115 m, 400 Mm3) jointe : barrage sur la Moulouya a 13 km au nord de Midelt (Wikipedia en) ; bulletin 2026-11-23 : Hassan 2 dans le bassin Moulouya.'),
 'mohamed-ben-abdelkrim-el-khattabi-dam': dict(name='Mohamed Ben Abdelkrim El Khattabi', second=[], status='corrigé', note='Jointure par nom a la ligne « Mohamed B. A. El Khattabi » (1981, 33,6 Mm3). Le bulletin 2026-11-23 donne une capacite derivee ~10,5 Mm3 : conflit avec la table, la valeur du bulletin est retenue.'),
 'barrage-m-dez': dict(name='M’Daz (Madaz)', second=[], status='corrigé', note='Wikidata Q130337597 : « Madaz Dam », sur l oued Sebou (description ar), 33,6816/-4,5257 (Fes-Meknes). Rattache a la ligne « M’Daz » (2025, 700 Mm3) par le nom (Madaz) ; une seule source de coordonnee, capacite 700 Mm3 = table Wikipedia seule (non confirmee, absente du bulletin).'),
 'barrage-douiss': dict(name='Douiss (Errachidia)', second=[], status='corrigé', note='Nominatim/OSM : « Barrage Douiss », caidat d Oued Naam, cercle et province d Errachidia (retenue way 1103665206, 0,5 km). Rattache a « Douiss Errachidia » (0,95 Mm3) ; « Douiss Figuig » reste non localise. Une seule source.'),
 'youssef-ben-tachfine': dict(name=None, second=[src('Wikipedia fr, Barrage Youssef Ibn Tachfin (29.84556, -9.49444)', 'https://fr.wikipedia.org/?curid=1258502')], status='inchangé',
   note='L ouvrage OSM way 385158725 (waterway=dam, lu via api.openstreetmap.org) couvre lat 29,8424-29,8485, lon -9,4980 a -9,4929 : son centre est 29,8454/-9,4955, soit la valeur de ce fichier, a 0,1 km de Wikipedia fr. platform/public/data/region.json (29,809193/-9,472591, « way/385158725 ») est a 4,6 km hors de l emprise du way : coordonnee erronee, a corriger.'),
 'barrage-sakia-el-hamra': dict(name=None, second=[src('Wikipedia fr, Barrage Sakia El Hamra (27.156429, -13.17433)', 'https://fr.wikipedia.org/?curid=14103032'), src('OpenStreetMap way 368097056 (retenue 27,051-27,159 / -13,176 a -13,085 ; le point Wikidata est a son coin nord-ouest)', 'https://www.openstreetmap.org/way/368097056')], status='ambigu',
   note='Coordonnee coherente (Wikidata = Wikipedia fr, au bord de la retenue OSM) mais la capacite reste null : table 110 Mm3 (« Saquia El Hamra ») contre 112 Mm3 dans le texte de Wikipedia fr, sans source officielle.'),
 'barrage-hassan-ii': dict(name=None, second=[], status='ambigu', note='Ouvrage OSM « Hassan II » (commune d Ahl Oued Za). Le barrage de l oued Za (province de Taourirt, le360 2026-02-14) n a pas de coordonnee propre dans les sources lues : ce point est peut-etre le barrage sur l oued Za mal nomme, ou un autre ouvrage. Nom et lien avec la ligne « Barrage sur Oued Za » non confirmes : ne pas promouvoir le nom.'),
 '-2': dict(name=None, second=[], status='ambigu', note='Probable doublon de lalla-takerkoust (Wikidata Q138337607, a 5,3 km de la position OSM : au-dela du seuil de 5 km, non fusionne).'),
}
for d in nat:
    if d['id'] in DROP: continue
    r = json.loads(json.dumps(d))
    ex = EXTRA.get(d['id'], {})
    r['coordSourceType'] = d['coordSource']
    r['coordSource'] = first_src(d)
    if ex.get('name'): r['name'] = ex['name']
    if ex.get('second'): r['sources'] = d['sources'] + ex['second']
    r['status'] = ex.get('status', 'inchangé')
    if ex.get('note'): r['note'] = ex['note']
    reg = region(r['lat'], r['lon'])
    r['regionCheck'] = 'ok' if reg == r['regionId'] else 'ECART:%s' % reg
    row = TABLE_ROW.get(d['id'])
    if row and row in unl:
        u = unl[row]
        r['yearBuilt'] = u['yearBuilt']; r['heightM'] = u['heightM']; r['purpose'] = u['purposeCodes']
        r['sources'].append(src('Wikipedia fr, Barrages du Maroc (oldid 239787126), ligne « %s »' % row, 'https://fr.wikipedia.org/w/index.php?title=Barrages_du_Maroc&oldid=239787126'))
        r['wikipediaMatch'] = {'row': row, 'score': None, 'joinedBy': 'revue manuelle (resolve-notes.md)'}
        r['capacityWikipediaMm3'] = u['capacityMm3']
    elif d.get('capacityMm3') is not None:
        r['capacityWikipediaMm3'] = d['capacityMm3']
    j = JOIN.get(d['id'])
    if j:
        b = BUL[j[0]]
        r['capacityMm3'] = round(b['cap'], 1)
        r['capacityMm3Source'] = 'maadialna-bulletin-2026-11-23 (stock / taux de remplissage)'
        r['basin'] = b['basin']
        r['capacityCheck'] = {'bulletinName': j[0], 'joinConfidence': j[1], 'stockMm3': b['stock'], 'fillPct': b['pct'], 'derivedCapacityMm3': round(b['cap'], 1),
                              'wikipediaMm3': r.get('capacityWikipediaMm3'), 'source': src('Ministere de l Equipement et de l Eau, situation journaliere des barrages du 2026-11-23 (Maa Dialna)', BUL_URL)}
        r['sources'].append(src('Bulletin Maa Dialna du 2026-11-23 (capacite, bassin)', BUL_URL))
    elif r.get('capacityWikipediaMm3') is not None and ex.get('status') != 'ambigu':
        r['capacityMm3'] = r['capacityWikipediaMm3']
        r['capacityMm3Source'] = 'wikipedia'
    else:
        r['capacityMm3'] = d.get('capacityMm3')
    out.append(r)
# controle : somme des capacites derivees par bassin contre le total du bulletin
ctrl = {b: {'bulletinTotal': t, 'sumDerived': round(sum(BUL[n]['cap'] for n, _, _ in rows), 1)} for b, (t, rows) in BULLETIN.items()}
for b in ctrl: ctrl[b]['bulletinTotal'] = ctrl[b]['bulletinTotal']
json.dump(out, open(os.path.join(DD, 'located-v2.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'enregistrements')
print(json.dumps(ctrl, ensure_ascii=False, indent=1))
print('ecarts region :', [(r['id'], r['regionCheck']) for r in out if r['regionCheck'] != 'ok'])
from collections import Counter; print(Counter(r['status'] for r in out))
print('capacites bulletin vs table :')
for r in out:
    if 'capacityCheck' in r:
        c = r['capacityCheck']; print('  %-34s bulletin %8.1f  table %s  %s' % (r['name'], c['derivedCapacityMm3'], c['wikipediaMm3'], c['joinConfidence']))
