"""Variation de precipitation 2026-2050 vs 1991-2020 par bassin (Open-Meteo Climate API, CMIP6).

usage: python3 fetch_climate_outlook.py <out.json> [<raw_dir>]
  <out.json>  ex. ../../public/data/climate-outlook.json
  <raw_dir>   optionnel : copie des reponses brutes (a garder HORS du depot)

Un seul point representatif par bassin (indicatif, voir POINTS) : la valeur n'est pas une moyenne de bassin.
Appels sequentiels, attente progressive sur HTTP 429.
"""
import json, sys, time, datetime, statistics, os
import urllib.request, urllib.parse, urllib.error

URL = 'https://climate-api.open-meteo.com/v1/climate'
H = {'User-Agent': 'water-research/1.0'}
# Modeles et scenario : https://open-meteo.com/en/docs/climate-api (consultee le 2026-11-23).
# Sept modeles. Un appel de 60 ans x 7 modeles est compte ~1 850 appels par Open-Meteo (limite gratuite : 5 000 par heure, 10 000 par jour) :
# neuf bassins demandent donc plusieurs heures ; la reprise depuis raw_dir evite de refaire un appel deja recupere.
ALL_MODELS = ['CMCC_CM2_VHR4', 'FGOALS_f3_H', 'HiRAM_SIT_HR', 'MRI_AGCM3_2_S', 'EC_Earth3P_HR', 'MPI_ESM1_2_XR', 'NICAM16_8S']
MODELS = ALL_MODELS
BASE = (1991, 2020)
FUT = (2026, 2050)
MAX_GAP = 0.05  # modele ecarte pour un point si plus de 5 % des jours sont vides

# Noms identiques a public/data/national-bulletin.json. Points indicatifs (zone des barrages principaux).
POINTS = {
    'Loukkos':         (35.00, -5.60),
    'Moulouya':        (34.30, -3.40),
    'Sebou':           (34.00, -5.20),
    'Bouregreg':       (33.70, -6.50),
    'Oum Er-Rbia':     (32.10, -6.40),
    'Tensift':         (31.40, -8.20),
    'Souss-Massa':     (30.50, -8.50),
    'Drâa-Oued Noun':  (30.60, -6.90),
    'Guir-Ziz-Ghriss': (31.90, -4.40),
}

def get(params):
    req = urllib.request.Request(URL + '?' + urllib.parse.urlencode(params), headers=H)
    for a in range(40):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(75); continue
            raise RuntimeError(f'HTTP {e.code}: {e.read()[:300]!r}')
    raise RuntimeError('retries exhausted')

def annual_sums(times, vals):
    by = {}; nulls = 0
    for t, v in zip(times, vals):
        if v is None: nulls += 1; continue
        by.setdefault(int(t[:4]), []).append(v)
    return by, nulls

def period_mean(by, y0, y1):
    # annees completes seulement (>= 360 jours renseignes) : une annee absente (ex. 2050 pour EC_Earth3P_HR) n'est pas comptee comme sec
    yrs = [y for y in range(y0, y1 + 1) if len(by.get(y, [])) >= 360]
    return sum(sum(by[y]) for y in yrs) / len(yrs)

def main():
    out_path = sys.argv[1]; raw_dir = sys.argv[2] if len(sys.argv) > 2 else None
    if raw_dir: os.makedirs(raw_dir, exist_ok=True)
    out = {
        'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'label': "Projection modélisée, usage non commercial, incertitude entre modèles. Ce n'est ni une prévision ni un relevé.",
        'source': 'Open-Meteo Climate API (climate-api.open-meteo.com/v1/climate), CMIP6, precipitation_sum quotidienne',
        'sourceDoc': 'https://open-meteo.com/en/docs/climate-api',
        'licence': 'CMIP6 CC BY 4.0 (attribution Open-Meteo et programme CMIP6) ; API gratuite : usage non commercial uniquement',
        'scenario': "Modèles décrits par Open-Meteo comme « aussi proches que possible de RCP8.5 dans CMIP6 » ; pas de trajectoire basse disponible",
        'resolution': "réduction d'échelle à 10 km (ERA5-Land) selon la documentation Open-Meteo",
        'periods': {'reference': list(BASE), 'projection': list(FUT)},
        'method': "Par modèle : moyenne annuelle (mm/an) des jours renseignés ; variation = projection - référence, en mm et en %. Un point représentatif par bassin (indicatif). Modèle écarté si plus de 5 % de jours vides. Médiane, min, max sur les modèles retenus.",
        'caveats': ["Un seul point par bassin : l'orographie (Rif, Moyen et Haut Atlas) n'est pas représentée.",
                    "Modèles de climat, pas de météo : les années isolées ne sont pas prédites.",
                    "Sur les bassins arides (Drâa, Guir) un pourcentage élevé peut ne représenter que quelques mm : voir changeMm."],
        'basins': {}}
    for name, (la, lo) in POINTS.items():
        cache = os.path.join(raw_dir, name.replace(' ', '_') + '.json') if raw_dir else None
        if cache and os.path.exists(cache):
            j = json.load(open(cache))  # reprise : reponse brute deja recuperee
        else:
          j = get(dict(latitude=la, longitude=lo, start_date='1991-01-01', end_date='2050-12-31',
                     models=','.join(MODELS), daily='precipitation_sum', timezone='UTC'))
        if cache and not os.path.exists(cache): json.dump(j, open(cache, 'w'))
        times = j['daily']['time']
        res = {}; dropped = {}
        for k, v in j['daily'].items():
            if not k.startswith('precipitation_sum'): continue
            model = k.replace('precipitation_sum_', '') if k != 'precipitation_sum' else MODELS[0]
            if model not in MODELS: continue
            by, nulls = annual_sums(times, v)
            gap = nulls / len(times)
            if gap > MAX_GAP:
                dropped[model] = round(gap, 3); continue
            b = period_mean(by, *BASE); f = period_mean(by, *FUT)
            res[model] = dict(referenceMmYr=round(b, 1), projectionMmYr=round(f, 1),
                              changeMm=round(f - b, 1), changePct=round(100 * (f - b) / b, 1) if b > 0 else None,
                              emptyDays=nulls)
        pcts = [m['changePct'] for m in res.values() if m['changePct'] is not None]
        mms = [m['changeMm'] for m in res.values()]
        out['basins'][name] = dict(
            point=dict(lat=la, lon=lo, gridLat=j.get('latitude'), gridLon=j.get('longitude'), elevationM=j.get('elevation')),
            models=res, droppedModels=dropped,
            summary=dict(nModels=len(res),
                         medianPct=round(statistics.median(pcts), 1) if pcts else None,
                         minPct=min(pcts) if pcts else None, maxPct=max(pcts) if pcts else None,
                         medianMm=round(statistics.median(mms), 1) if mms else None,
                         referenceMedianMmYr=round(statistics.median([m['referenceMmYr'] for m in res.values()]), 1) if res else None))
        print(name, out['basins'][name]['summary'], dropped, flush=True)
        time.sleep(5)
    json.dump(out, open(out_path, 'w'), indent=1, ensure_ascii=False)

main()
