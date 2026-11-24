#!/usr/bin/env python3
"""Etape 1 de located-v2 : collecte de coordonnees CANDIDATES pour les barrages non localises.
Sources : Nominatim (OSM), Wikipedia fr/en (prop=coordinates), Wikidata (wbsearchentities + P625).
Rien n'est accepte ici : resolve_located_v2.py decide (point dans region, 2 sources <= 5 km, relecture manuelle).
Usage : python3 -I harvest_candidates.py OUT.json   (1 requete/s vers Nominatim, User-Agent generique)
"""
import json, sys, time, urllib.parse, urllib.request, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UNL = os.path.join(ROOT, 'data-raw', 'dams', 'national-dams-unlocated.json')
UA = 'anzar-open-data-research/0.1 (prototype; contact via repository)'
# variantes d'orthographe usuelles (noms ecrits autrement dans la table Wikipedia)
ALIAS = {
 'Bine El Ouidane': ['Bin el Ouidane', 'Bine El Ouidane'],
 'Mohamed B. A. El Khattabi': ['Mohamed Ben Abdelkrim El Khattabi'],
 'Barrage sur Oued Za': ['Oued Za', 'Za'],
 'EL MALLEH Amont': ['El Malleh', 'Mellah Amont'],
 'Sidi M’Hamed Ben Slimane El Jazouli': ['Sidi Mohamed Ben Slimane El Jazouli', 'Sidi M Hamed Ben Slimane El Jazouli'],
 'M’Daz': ['M Daz', 'Mdaz'],
 'Saquia El Hamra': ['Sakia El Hamra', 'Saquia el Hamra'],
 'Garde Du Sebou': ['Garde du Sebou', 'Gardes du Sebou'],
}
def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            time.sleep(1.2)
            with urllib.request.urlopen(req, timeout=25) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            err = str(e); time.sleep(10 + 10*i)
    return {'_error': err}
def q(**kw): return urllib.parse.urlencode(kw)
def norm(n): return n.replace('’', "'")
def cands(name):
    out = []
    names = [name] + ALIAS.get(name, [])
    for nm in names:
        nm = norm(nm)
        for term in (('barrage ' + nm,) if nm == names[0] and not ALIAS.get(name) else ('barrage ' + nm, nm + ' dam')):
            j = get('https://nominatim.openstreetmap.org/search?' + q(q=term, format='jsonv2', countrycodes='ma,eh', limit=5))
            if isinstance(j, list):
                for r in j:
                    out.append({'src': 'nominatim', 'query': term, 'label': r.get('display_name', '')[:140], 'osmType': r.get('osm_type'), 'category': r.get('category'), 'type': r.get('type'),
                                'lat': float(r['lat']), 'lon': float(r['lon']),
                                'url': 'https://www.openstreetmap.org/%s/%s' % (r['osm_type'], r['osm_id'])})
        for lang in (('fr',) if nm != names[0] or ALIAS.get(name) is None else ('fr',)):
            j = get('https://%s.wikipedia.org/w/api.php?' % lang + q(action='query', generator='search', gsrsearch='barrage %s Maroc' % nm if lang == 'fr' else '%s dam Morocco' % nm,
                        gsrlimit=3, prop='coordinates', format='json'))
            for p in (j.get('query', {}).get('pages', {}) or {}).values():
                for c in p.get('coordinates', []) or []:
                    out.append({'src': 'wikipedia-' + lang, 'query': nm, 'label': p['title'], 'lat': c['lat'], 'lon': c['lon'],
                                'url': 'https://%s.wikipedia.org/?curid=%s' % (lang, p['pageid'])})
        j = get('https://www.wikidata.org/w/api.php?' + q(action='wbsearchentities', search=nm, language='fr', limit=5, format='json', type='item'))
        ids = [e['id'] for e in j.get('search', []) if 'dam' in (e.get('description') or '').lower() or 'barrage' in (e.get('description') or '').lower()]
        if ids:
            k = get('https://www.wikidata.org/w/api.php?' + q(action='wbgetentities', ids='|'.join(ids), props='claims|labels', format='json'))
            for i, e in (k.get('entities') or {}).items():
                for c in e.get('claims', {}).get('P625', []):
                    v = c['mainsnak'].get('datavalue', {}).get('value')
                    if v:
                        out.append({'src': 'wikidata', 'query': nm, 'label': (e.get('labels', {}).get('fr') or e.get('labels', {}).get('en') or {}).get('value', i),
                                    'lat': v['latitude'], 'lon': v['longitude'], 'url': 'https://www.wikidata.org/wiki/' + i})
    return out
if __name__ == '__main__':
    only = sys.argv[2:] 
    unl = json.load(open(UNL, encoding='utf-8'))['unlocated']
    res = {}
    for u in unl:
        if only and u['name'] not in only: continue
        res[u['name']] = cands(u['name'])
        print(u['name'], len(res[u['name']]), flush=True)
        json.dump(res, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
