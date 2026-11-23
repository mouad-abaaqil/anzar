"""Part A: V = k*A^b calibration per dam, monthly reconstruction, validation.
Run: /tmp/srmsm-venv/bin/python pipeline/forecast/reconstruct.py   (from platform/)"""
import json, os, datetime as dt, statistics as st
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'data-raw'); OUT = os.path.join(ROOT, 'public', 'data'); INTER = os.path.join(RAW, 'forecast')
DAMS = [('youssef-ben-tachfine', 'Youssef Ben Tachfine'), ('abdelmoumen', 'Abdelmoumen'),
        ('aoulouz', 'Aoulouz'), ('moulay-abdellah', 'Moulay Abdellah')]
AREA_NOISE = 0.03     # relative noise on a single NDWI area (assumption, stated in caveats)
ANCHOR_MAX_LOG_RESID = 0.25  # anchor kept only if consistent with the pairs
ANCHOR_W = 5.0        # weight of the full-pool anchor vs one bulletin pair (pairs are strongly correlated)
VAL_DAYS = 10         # no Sentinel-2 scene exists within 3 days of 2025-11-18 for these dams; scenes within 10 days (stated in output)
B_GRID = np.round(np.arange(1.0, 2.0001, 0.01), 2)
LABEL = 'estimation satellite calée sur les bulletins, non officielle'
D = lambda s: dt.date.fromisoformat(s[:10])

def load(p): return json.load(open(os.path.join(RAW, p)))

def clean_scenes(raw):
    """valid scenes (validFraction>=0.9), outliers flagged (>40 % jump vs previous valid scene within 10 d)."""
    rej = [s for s in raw if s['validFraction'] < 0.9]
    valid = sorted([s for s in raw if s['validFraction'] >= 0.9], key=lambda s: (s['date'], s['sceneId']))
    out, flagged, prev = [], [], None
    for s in valid:
        a = s['areaKm2']
        if prev and (D(s['date']) - D(prev['date'])).days <= 10 and prev['areaKm2'] > 0.3:
            r = a / prev['areaKm2'] - 1
            if abs(r) > 0.4:
                flagged.append({'sceneId': s['sceneId'], 'date': s['date'], 'areaKm2': a, 'previousAreaKm2': prev['areaKm2'],
                                'previousDate': prev['date'], 'change': round(r, 3)})
                continue  # excluded from calibration/series but listed; prev not updated
        out.append(s); prev = s
    return out, flagged, len(rej)

def fit_b(b, A, V, w):
    lk = np.sum(w * (np.log(V) - b * np.log(A))) / np.sum(w)
    return float(np.exp(lk))

def calibrate(pairs, amax, cap):
    A = np.array([p['areaKm2'] for p in pairs] + [amax]); V = np.array([p['volumeMm3'] for p in pairs] + [cap])
    w = np.array([1.0] * len(pairs) + [ANCHOR_W])
    prof = []
    for b in B_GRID:
        k = fit_b(b, A, V, w)
        res = np.log(V) - (np.log(k) + b * np.log(A))
        sse = float(np.sum(w * res ** 2))
        pr = res[:-1]
        prof.append((float(b), k, sse, float(np.sqrt(np.mean(pr ** 2))), float(res[-1])))
    best = min(prof, key=lambda t: t[2])
    anchor_ok = abs(best[4]) <= ANCHOR_MAX_LOG_RESID
    if not anchor_ok:
        # Anchor contradicts the pairs (area saturates near the top: outline/mask caps it). Do not let it drive the fit:
        # pairs-only fit (k per b from pairs), b taken at the midpoint of the plausible range (a-priori rule, not tuned on validation).
        wp = np.ones(len(pairs)); Ap, Vp = A[:-1], V[:-1]
        prof = []
        for bb in B_GRID:
            kk = fit_b(bb, Ap, Vp, wp); res = np.log(Vp) - (np.log(kk) + bb * np.log(Ap))
            prof.append((float(bb), kk, float(np.sum(res ** 2)), float(np.sqrt(np.mean(res ** 2))), float(np.log(cap) - (np.log(kk) + bb * np.log(amax)))))
        tol = max(2 * min(t[3] for t in prof), 0.03)
        ok = [t for t in prof if t[3] <= tol]
        bl, bh = min(t[0] for t in ok), max(t[0] for t in ok)
        bm = round((bl + bh) / 2, 2)
        best = min(prof, key=lambda t: abs(t[0] - bm))
    else:
        tol = max(2 * best[3], 0.03)
        ok = [t for t in prof if t[3] <= tol]
        bl, bh = min(t[0] for t in ok), max(t[0] for t in ok)
    kl = next(t[1] for t in prof if t[0] == bl); kh = next(t[1] for t in prof if t[0] == bh)
    k, b = best[1], best[0]
    pv = k * np.array([p['areaKm2'] for p in pairs]) ** b
    rmse = float(np.sqrt(np.mean((pv - np.array([p['volumeMm3'] for p in pairs])) ** 2)))
    return dict(anchorUsed=anchor_ok, pairMaxArea=float(max(p['areaKm2'] for p in pairs)), k=k, b=b, bLow=bl, bHigh=bh, kLow=kl, kHigh=kh, rmse=rmse, anchorResidLog=best[4], tolLogRmse=tol,
                profile=[(t[0], t[3], t[4]) for t in prof[::10]])

def vol(c, A):
    A = np.asarray(A, float); A = np.maximum(A, 1e-6)
    return c['k'] * A ** c['b']

def band(c, A, cap=None):
    """low/high: envelope of the b-range fits (each refit through the anchor) with +/-AREA_NOISE on area."""
    cands = []
    for kk, bb in ((c['kLow'], c['bLow']), (c['k'], c['b']), (c['kHigh'], c['bHigh'])):
        for f in (1 - AREA_NOISE, 1 + AREA_NOISE):
            cands.append(kk * np.maximum(A * f, 1e-6) ** bb)
    lo, hi = min(cands), max(cands)
    if cap is not None and not c['anchorUsed'] and A >= 0.97 * c['pairMaxArea']:
        hi = max(hi, cap)   # area cannot discriminate above the pair range: upper bound = full capacity
    return lo, hi

def main():
    bul = load('bulletins/souss-massa-series.json')
    caps = bul['capacitiesMm3']
    b18 = next(b for b in bul['bulletins'] if b['date'] == '2026-11-18')
    gen = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    dams_out, notest, monthly_vol, caveats = [], [], {}, []
    fits = {}
    for did, name in DAMS:
        path = os.path.join(RAW, 'satellite', f'{did}-series.json')
        if not os.path.exists(path):
            notest.append({'id': did, 'reason': 'série satellite non disponible au moment du calcul (production en cours) ; relancer reconstruct.py'}); continue
        raw = json.load(open(path)); cap = caps[did]
        scenes, flagged, nrej = clean_scenes(raw)
        poly = json.load(open(os.path.join(RAW, 'satellite', 'polygons', f'{did}.geojson')))
        roles = {f['properties']['role']: f['properties'] for f in poly['features']}
        pairs = []
        for b in bul['bulletins']:
            c = [s for s in scenes if abs((D(s['date']) - D(b['date'])).days) <= 2 and s['areaKm2'] > 0]
            if not c: continue
            s = min(c, key=lambda s: (abs((D(s['date']) - D(b['date'])).days), -s['validFraction']))
            pairs.append({'date': b['date'], 'areaKm2': s['areaKm2'], 'volumeMm3': b['dams'][did]['storedMm3'], 'sceneId': s['sceneId'], 'sceneDate': s['date']})
        amax = max(s['areaKm2'] for s in scenes)
        cal = calibrate(pairs, amax, cap)
        cal['_cap'] = cap; fits[did] = (cal, scenes, cap)
        # diagnostics on anchor consistency
        pa = [p['areaKm2'] for p in pairs]
        dam_cav = []
        ndwi = roles.get('ndwi-max-extent', {}).get('areaKm2'); osm = roles.get('osm-outline', {}).get('areaKm2')
        if not cal['anchorUsed']:
            dam_cav.append(f"{name} : la surface NDWI sature : les paires (≈{cal['pairMaxArea']:.2f} km² pour {min(p['volumeMm3'] for p in pairs):.0f}-{max(p['volumeMm3'] for p in pairs):.0f} Mm³) et le maximum historique ({amax:.2f} km² pour {cap} Mm³) sont incompatibles avec une loi de puissance (écart log {cal['anchorResidLog']:+.2f} sur l'ancre pour b ≤ 2). L'ancrage plein bassin est donc écarté du calage (ajustement sur les paires seules, b au milieu de [1, 2]) et, pour les mois dont la surface est proche du maximum des paires, la borne haute est portée à la capacité (champ saturated).")
        if max(pa) / amax > 0.98 or min(pa) / amax > 0.8:
            dam_cav.append(f"{name} : les paires couvrent une plage étroite de surface ({min(pa):.2f}-{max(pa):.2f} km² pour un maximum de {amax:.2f} km²), l'exposant b n'est pas identifié par les paires et repose sur le prior [1, 2] (et sur l'ancrage seulement s'il est cohérent).")
        if ndwi and amax < 0.8 * ndwi:
            dam_cav.append(f"{name} : le maximum historique de la série ({amax:.2f} km²) est nettement inférieur à l'emprise NDWI maximale ({ndwi:.2f} km²) ; l'ancrage plein bassin peut être sous-estimé.")
        if cal['rmse'] > 0.05 * cap:
            dam_cav.append(f"{name} : l'ajustement reste imprécis sur les paires (RMSE {cal['rmse']:.1f} Mm³ = {100*cal['rmse']/cap:.0f} % de la capacité) ; la relation surface-volume n'est pas bien contrainte.")
        caveats.extend(dam_cav)
        # monthly series
        bymonth = {}
        for s in scenes: bymonth.setdefault(s['date'][:7], []).append(s)
        series = []
        for m in sorted(bymonth):
            ss = bymonth[m]; med = st.median(s['areaKm2'] for s in ss)
            rep = min(ss, key=lambda s: abs(s['areaKm2'] - med))
            v = float(vol(cal, med)); lo, hi = band(cal, med, cap)
            sat = (not cal['anchorUsed']) and med >= 0.97 * cal['pairMaxArea']
            cap_lim = 1.05 * cap
            clipped = v > cap_lim or hi > cap_lim
            v, lo, hi = min(v, cap_lim), min(float(lo), cap_lim), min(float(hi), cap_lim)
            lo = min(lo, v); hi = max(hi, v)
            series.append({'date': rep['date'], 'month': m, 'areaKm2': round(med, 4), 'volumeMm3': round(v, 2), 'low': round(lo, 2), 'high': round(hi, 2),
                           'fillPct': round(100 * v / cap, 1), 'estimated': True, 'saturated': bool(sat), 'nScenes': len(ss), 'sceneId': rep['sceneId']})
            monthly_vol.setdefault(m, {})[did] = (v, lo, hi)
        # validation 2025-11-18 vs ticks
        def _unused(date, days):
            c = [s for s in scenes if abs((D(s['date']) - D(date)).days) <= days]
            if not c: return None
            med = st.median(s['areaKm2'] for s in c)
            lo, hi = band(cal, med); return dict(v=float(vol(cal, med)), lo=float(lo), hi=float(hi), area=med, n=len(c), ids=[s['sceneId'] for s in c])
        dams_out.append({
            'id': did, 'name': name, 'capacityMm3': cap, 'capacitySource': 'stock ÷ taux du bulletin du 2026-11-18',
            'polygon': {'source': (f"OSM {roles['osm-outline']['osm']} ; " if 'osm-outline' in roles else '') + 'emprise NDWI maximale 2017-2026 ; masque d\'analyse = union tamponnée 300 m',
                        'centroid': roles['analysis-mask'].get('centroid'), 'areaKm2AtMax': round(amax, 3),
                        'ndwiMaxExtentKm2': ndwi, 'osmOutlineKm2': osm},
            'fit': {'k': round(cal['k'], 5), 'b': cal['b'], 'bLow': cal['bLow'], 'bHigh': cal['bHigh'], 'kLow': round(cal['kLow'], 5), 'kHigh': round(cal['kHigh'], 5),
                    'nPairs': len(pairs), 'pairs': pairs, 'residualRmseMm3': round(cal['rmse'], 2),
                    'anchorUsed': cal['anchorUsed'], 'anchor': {'areaKm2': round(amax, 4), 'volumeMm3': cap, 'weight': ANCHOR_W, 'logResidual': round(cal['anchorResidLog'], 3), 'definition': 'maximum historique des scènes valides, capacité = stock ÷ taux du bulletin 2026-11-18'},
                    'bPrior': [1.0, 2.0], 'bRangeRule': 'b de la grille [1,2] dont le RMSE relatif sur les paires reste ≤ max(2×meilleur, 3 %)', 'areaNoise': AREA_NOISE},
            'quality': {'scenesValid': len(scenes), 'scenesRejectedValidFraction': nrej, 'outliersFlagged': flagged},
            'series': series, 'estimated': True})
    # coverage-consistent region total: months where all estimated dams present
    est_ids = [d['id'] for d in dams_out]
    capsum = sum(caps[i] for i in est_ids)
    region = []
    for m in sorted(monthly_vol):
        if all(i in monthly_vol[m] for i in est_ids):
            v = sum(monthly_vol[m][i][0] for i in est_ids); lo = sum(monthly_vol[m][i][1] for i in est_ids); hi = sum(monthly_vol[m][i][2] for i in est_ids)
            region.append({'date': m + '-15', 'month': m, 'volumeMm3': round(v, 2), 'low': round(lo, 2), 'high': round(hi, 2), 'coveredShare': round(capsum / bul['basinCapacityPrintedMm3'], 3), 'estimated': True})
    # ---- validation (never used in calibration)
    val = []
    tick = {i: b18['dams'][i] for i in b18['dams']}
    def official_tick(i):
        t = tick[i]; return (t.get('sameDay2025EstimatedMm3'), t.get('uncertaintyPoints'))
    est_val = {}
    for d in dams_out:
        did = d['id']; cal, scenes, cap = fits[did]
        c = [s for s in scenes if abs((D(s['date']) - D('2025-11-18')).days) <= VAL_DAYS]
        off, up = official_tick(did)
        if not c or off is None:
            val.append({'name': f"{d['name']}, même jour 2025 (lecture graphique)", 'date': '2025-11-18', 'official': None, 'estimated': None, 'usedInCalibration': False, 'note': f'aucune scène valide à ≤{VAL_DAYS} jours'}); continue
        med = st.median(s['areaKm2'] for s in c); lo, hi = band(cal, med, cap); e = float(vol(cal, med))
        est_val[did] = (e, float(lo), float(hi))
        u = (up or 1.0) / 100 * cap
        val.append({'name': f"{d['name']}, même jour 2025 (lecture graphique)", 'date': '2025-11-18', 'official': off,
                    'officialSource': f"bulletin 2026-11-18 : repère de l'an dernier lu sur graphique, {tick[did]['sameDay2025EstimatedPct']} % × {cap} Mm³ (±{up} point = ±{u:.1f} Mm³)",
                    'officialUncertaintyMm3': round(u, 2), 'estimated': round(e, 2), 'estimatedLow': round(float(lo), 2), 'estimatedHigh': round(float(hi), 2),
                    'errorMm3': round(e - off, 2), 'errorPct': round(100 * (e - off) / off, 1), 'errorPctOfCapacity': round(100 * (e - off) / cap, 1),
                    'withinUncertainty': abs(e - off) <= u, 'scenes': [s['sceneId'] for s in c], 'sceneOffsetDays': [(D(s['date']) - D('2025-11-18')).days for s in c], 'areaKm2': round(med, 3), 'usedInCalibration': False})
    small = [i for i in b18['dams'] if i not in [x for x, _ in DAMS]]
    smallv = {i: tick[i].get('sameDay2025EstimatedMm3') for i in small}
    known_small = sum(v for v in smallv.values() if v is not None)
    reg_off = 141.4; reg_src = 'bulletin 2026-11-18 : 19,56 % × 722,83 Mm³'
    fall = [x for x, _ in DAMS if x not in est_val]
    parts = [est_val[i] for i in est_val] + []
    fb = sum(official_tick(i)[0] or 0 for i in fall)
    e4 = sum(v[0] for v in est_val.values()); l4 = sum(v[1] for v in est_val.values()); h4 = sum(v[2] for v in est_val.values())
    tot = e4 + fb + known_small; lt = l4 + fb + known_small; ht = h4 + fb + known_small
    unc_ticks = (1.0 / 100) * sum(caps[i] for i in caps if tick.get(i, {}).get('sameDay2025EstimatedPct') is not None) # linear sum bound on tick uncertainty
    note = (f"quatre grands barrages : estimation satellite ({', '.join(est_val)}) ; cinq petits barrages : valeurs lues sur graphique, non estimées par satellite"
            f" ({known_small:.2f} Mm³ ; Sidi Abdellah sans repère lisible, non compté)")
    if fall: note += f" ; grands barrages sans estimation, valeur lue sur graphique : {', '.join(fall)} ({fb:.2f} Mm³)"
    val.append({'name': 'Région, même jour 2025', 'date': '2025-11-18', 'official': reg_off, 'officialSource': reg_src,
                'estimated': round(tot, 2), 'estimatedLow': round(lt, 2), 'estimatedHigh': round(ht, 2), 'errorMm3': round(tot - reg_off, 2), 'errorPct': round(100 * (tot - reg_off) / reg_off, 1),
                'errorPctOfBasinCapacity': round(100 * (tot - reg_off) / 722.83, 2), 'officialUncertaintyMm3': round(unc_ticks, 1), 'composition': note, 'usedInCalibration': False})
    # press points (weaker): 4-dam estimate only, small dams unknown
    smallcap = round(722.83 - capsum, 2)
    for nm, date, off, src in (('Région, presse 2024-02-12', '2024-02-12', 100.186, 'presse : Souss-Massa 100,186 Mm³ (source presse, plus faible)'),
                               ('Région, presse 2025-06-11', '2025-06-11', 0.2083 * 722.83, 'presse : 20,83 % × 722,83 Mm³ ≈ 150,6 Mm³ (source presse, plus faible)')):
        ee = {}
        for d in dams_out:
            cal, scenes, cap = fits[d['id']]
            c = [s for s in scenes if abs((D(s['date']) - D(date)).days) <= 7]
            if c:
                med = st.median(s['areaKm2'] for s in c); lo, hi = band(cal, med, cal['_cap']); ee[d['id']] = (float(vol(cal, med)), float(lo), float(hi))
        if len(ee) < len(dams_out) or not ee:
            val.append({'name': nm, 'date': date, 'official': round(off, 2), 'officialSource': src, 'estimated': None, 'usedInCalibration': False, 'note': 'pas de scène valide à ≤7 jours pour tous les grands barrages', 'press': True}); continue
        e = sum(v[0] for v in ee.values())
        val.append({'name': nm, 'date': date, 'official': round(off, 2), 'officialSource': src, 'press': True,
                    'estimated': round(e, 2), 'estimatedLow': round(sum(v[1] for v in ee.values()), 2), 'estimatedHigh': round(sum(v[2] for v in ee.values()), 2),
                    'errorMm3': round(e - off, 2), 'errorPct': round(100 * (e - off) / off, 1),
                    'composition': f"somme des {len(ee)} grands barrages estimés par satellite (scènes à ≤7 jours) ; les cinq petits barrages ({smallcap} Mm³ de capacité) ne sont PAS inclus faute de valeur : l'erreur réelle est comprise entre {round(e - off, 1)} et {round(e + smallcap - off, 1)} Mm³",
                    'errorRangeMm3': [round(e - off, 2), round(e + smallcap - off, 2)], 'usedInCalibration': False})
    rv = [v for v in val if v['name'].startswith('Région, même')]
    if rv: caveats.append(f"Validation région 2025-11-18 : erreur {rv[0]['errorMm3']:+.1f} Mm³ ({rv[0]['errorPct']:+.1f} %), (validation, non utilisée au calage ; non corrigée par réglage a posteriori). Les erreurs par barrage sont plus grandes que l'erreur régionale : elles se compensent en partie.")
    for v in val:
        if v.get('errorPct') is not None and abs(v['errorPct']) > 25 and not v['name'].startswith('Région'):
            caveats.append(f"{v['name']} : erreur {v['errorMm3']:+.1f} Mm³ ({v['errorPct']:+.1f} %) contre la lecture graphique ; non corrigée a posteriori.")
    caveats = [
        "Estimation satellite calée sur les bulletins, non officielle. Les pourcentages de remplissage affichés sont estimés, jamais mesurés.",
        f"Calage sur ~3 semaines de bulletins (plage étroite de remplissage) plus un ancrage plein bassin (surface maximale historique, capacité dérivée des bulletins) ; l'exposant b est contraint à [1, 2] et non identifié par les seules paires. La bande couvre les ajustements b ∈ [bLow, bHigh] plus ±{int(AREA_NOISE*100)} % sur la surface.",
        "Le niveau d'eau, le marnage et le volume mort ne sont pas observés ; la relation V = k·A^b suppose une géométrie stable du réservoir (envasement ignoré) et une surface NDWI sans biais de seuil (les petites retenues sont mal résolues par Sentinel-2 à 10 m).",
        "Scènes avec validFraction < 0,9 écartées ; sauts de surface > 40 % en ≤10 jours listés dans quality.outliersFlagged et exclus de la série mensuelle.",
        "Les repères 2025 des bulletins sont lus sur graphique (±1 point) et servent uniquement à la validation, jamais au calage. Les points de presse sont plus faibles que les bulletins officiels.",
        "Le total région 2025-11-18 combine l'estimation satellite des grands barrages et des valeurs lues sur graphique pour les cinq petits barrages (non estimées par satellite).",
    ] + caveats
    if notest: caveats.append('Barrages sans estimation : ' + ', '.join(n['id'] for n in notest) + ' (voir notEstimated).')
    for did_ in ['ahl-souss', 'dkhila', 'sidi-abdellah', 'imi-el-kheng', 'mokhtar-soussi']:
        notest.append({'id': did_, 'reason': 'retenue trop petite pour Sentinel-2 (10 m) ou non traitée ; valeur de bulletin seulement, non estimée par satellite'})
    doc = {'status': 'ready', 'generatedAt': gen,
           'method': 'V = k·A^b par barrage, A = surface NDWI Sentinel-2 (médiane mensuelle des scènes valides), calage sur bulletins officiels 2026-10-29..11-18 + ancrage plein bassin, b ∈ [1, 2]',
           'label': LABEL, 'dams': dams_out, 'notEstimated': notest, 'regionTotal': region, 'validation': val, 'caveats': caveats}
    json.dump(doc, open(os.path.join(OUT, 'storage-reconstruction.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({m: {i: list(v) for i, v in d.items()} for m, d in monthly_vol.items()}, open(os.path.join(INTER, 'monthly-volumes.json'), 'w'), indent=0)
    for d in dams_out:
        f = d['fit']; print(d['id'], 'k', f['k'], 'b', f['b'], f['bLow'], f['bHigh'], 'rmse', f['residualRmseMm3'], 'anchor', f['anchor']['areaKm2'], f['anchor']['logResidual'], 'pairsA', pairs and [p['areaKm2'] for p in f['pairs']][:3], 'outl', len(d['quality']['outliersFlagged']))
    for v in val: print(v['name'], v.get('official'), v.get('estimated'), v.get('errorMm3'), v.get('errorPct'))
    print('not estimated big:', [n['id'] for n in notest if n['id'] in dict(DAMS)])

if __name__ == '__main__': main()
