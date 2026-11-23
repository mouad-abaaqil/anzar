"""Part B: monthly change of reconstructed total volume, ridge + LOYO CV, scenarios.
Run after reconstruct.py:  /tmp/srmsm-venv/bin/python pipeline/forecast/forecast.py   (from platform/)"""
import json, os, csv, datetime as dt
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'data-raw'); OUT = os.path.join(ROOT, 'public', 'data'); INTER = os.path.join(RAW, 'forecast')
RIDGE_ALPHA = 20.0   # fixed a priori (strong shrinkage on standardised features); not tuned on held-out years
NAMES = {'youssef-ben-tachfine': 'youssef_ben_tachfine', 'abdelmoumen': 'abdelmoumen', 'aoulouz': 'aoulouz', 'moulay-abdellah': 'moulay_abdellah'}

def read_rain(key):
    return {r['month']: float(r['catchment_mean_mm']) for r in csv.DictReader(open(os.path.join(RAW, 'rain', f'{key}-monthly.csv'))) if r['complete'] == 'True'}

def station_ratios():
    rows = [r for r in csv.DictReader(open(os.path.join(RAW, 'rain', 'ybt-station-monthly.csv'))) if r['station_mm'] and r['era5_catchment_mean'] and '1990' <= r['month'][:4] <= '2024']
    ratio = {}
    for m in range(1, 13):
        rr = [r for r in rows if int(r['month'][5:]) == m]
        s = sum(float(r['station_mm']) for r in rr); e = sum(float(r['era5_catchment_mean']) for r in rr)
        ratio[m] = (s / e if e > 0 else 1.0, len(rr))
    return ratio  # station / ERA5 : multiply ERA5 by this

def hy(m): y, mo = int(m[:4]), int(m[5:]); return y if mo >= 9 else y - 1
def addm(m, k):
    y, mo = int(m[:4]), int(m[5:]) - 1 + k; return f'{y + mo // 12:04d}-{mo % 12 + 1:02d}'

def main():
    rec = json.load(open(os.path.join(OUT, 'storage-reconstruction.json')))
    est = [d['id'] for d in rec['dams']]
    monthly = json.load(open(os.path.join(INTER, 'monthly-volumes.json')))
    ratio = station_ratios()
    rain = {i: read_rain(NAMES[i]) for i in est}
    corr = {i: {m: v * ratio[int(m[5:])][0] for m, v in rain[i].items()} for i in est}
    allm = sorted(set.intersection(*[set(corr[i]) for i in est]))
    R = {m: float(np.mean([corr[i][m] for i in est])) for m in allm}   # mean over catchments (corrected)
    V = {m: sum(monthly[m][i][0] for i in est) for m in monthly if all(i in monthly[m] for i in est)}
    capsum = sum(d['capacityMm3'] for d in rec['dams'])

    def feats(m, r_t, r1, r3, vprev):
        mo = int(m[5:]); return [r_t, r1, r3, vprev, np.sin(2 * np.pi * mo / 12), np.cos(2 * np.pi * mo / 12)]
    X, y, ms = [], [], []
    for m in sorted(V):
        p = addm(m, -1)
        if p in V and all(addm(m, -k) in R for k in (0, 1, 2, 3)) and m in R:
            X.append(feats(m, R[m], R[p], R[addm(m, -1)] + R[addm(m, -2)] + R[addm(m, -3)], V[p])); y.append(V[m] - V[p]); ms.append(m)
    X = np.array(X); y = np.array(y); yrs = np.array([hy(m) for m in ms]); cm = np.array([int(m[5:]) for m in ms])

    def ridge(Xt, yt):
        mu, sd = Xt.mean(0), Xt.std(0) + 1e-9; Z = (Xt - mu) / sd; ym = yt.mean()
        w = np.linalg.solve(Z.T @ Z + RIDGE_ALPHA * np.eye(Z.shape[1]), Z.T @ (yt - ym))
        return lambda Xn: ((np.atleast_2d(Xn) - mu) / sd) @ w + ym
    pm, pp, pc, tr = [], [], [], []
    years = sorted(set(yrs.tolist()))
    for yr in years:
        te = yrs == yr; trn = ~te
        if trn.sum() < 10: continue
        f = ridge(X[trn], y[trn]); pm.append(f(X[te])); 
        pc.append(np.array([y[trn & (cm == c)].mean() if (trn & (cm == c)).any() else 0.0 for c in cm[te]]))
        pp.append(np.zeros(te.sum())); tr.append(y[te])
    pm, pp, pc, tr = map(np.concatenate, (pm, pp, pc, tr))
    mets = lambda p: (float(np.mean(np.abs(p - tr))), float(np.sqrt(np.mean((p - tr) ** 2))))
    mm, mp, mc = mets(pm), mets(pp), mets(pc)
    beats = bool(mm[0] < mp[0] and mm[0] < mc[0])
    skill = 1 - mm[0] / mp[0] if mp[0] > 0 else None
    resid = pm - tr; q90 = float(np.quantile(np.abs(resid), 0.9))
    final = ridge(X, y)
    # ---- scenarios
    bul = json.load(open(os.path.join(RAW, 'bulletins', 'souss-massa-series.json')))
    b18 = next(b for b in bul['bulletins'] if b['date'] == '2026-11-18')
    v0 = sum(b18['dams'][i]['storedMm3'] for i in est)
    fc = json.load(open(os.path.join(RAW, 'rain', 'forecast-16d.json')))
    fdays = {}
    for i in est:
        d = fc['dams'][NAMES[i]]
        for dd, v in zip(d['dates'], d['catchment_mean_mm']): fdays.setdefault(dd, []).append(v)
    fday = {k: float(np.mean(v)) for k, v in fdays.items() if len(v) == len(est)}   # NWP, NOT bias-corrected (not ERA5)
    # corrected climatology 1990-2025 per calendar month: terciles
    def scen_rate(mo):
        vals = np.array([R[m] for m in allm if int(m[5:]) == mo and m[:4] <= '2025'])
        s = np.sort(vals); n = len(s); t = max(1, n // 3)
        return {'sec': float(s[:t].mean()), 'normal': float(np.median(vals)), 'humide': float(s[-t:].mean())}, n
    nov, dec = scen_rate(11), scen_rate(12)
    nov_obs = {m: None for m in []}
    # Nov 2026 observed days 1-12 (ERA5, partial) corrected
    part = [r for r in csv.DictReader(open(os.path.join(RAW, 'rain', 'youssef_ben_tachfine-monthly.csv'))) if r['month'] == '2026-11']
    nov_partial = np.mean([float(next(r for r in csv.DictReader(open(os.path.join(RAW, 'rain', f'{NAMES[i]}-monthly.csv'))) if r['month'] == '2026-11')['catchment_mean_mm']) for i in est]) * ratio[11][0]
    d_f = lambda a, b: sum(fday.get(str(a + dt.timedelta(k)), 0.0) for k in range((b - a).days + 1))
    start = dt.date(2026, 11, 18); end = start + dt.timedelta(30)
    f_end = max(dt.date.fromisoformat(k) for k in fday)
    out_sc = []; scen_names = {'sec': 'bas', 'normal': 'moyen', 'humide': 'haut'}
    for nm in ('sec', 'normal', 'humide'):
        rn, rd = nov[0][nm], dec[0][nm]
        # window 2026-11-19..2026-12-18: forecast days where available, scenario rate elsewhere
        w = 0.0
        for k in range(1, 31):
            d = start + dt.timedelta(k)
            w += fday[str(d)] if str(d) in fday else (rn / 30 if d.month == 11 else rd / 31)
        # November total estimate: observed 1-12 (ERA5, corrected) + 13-18 scenario + 19-30 forecast/scenario
        nov_tot = nov_partial + 6 * rn / 30 + sum(fday[str(dt.date(2026, 11, dd))] if str(dt.date(2026, 11, dd)) in fday else rn / 30 for dd in range(19, 31))
        r3 = R['2026-08'] + R['2026-09'] + R['2026-10'] if all(m in R for m in ('2026-08', '2026-09', '2026-10')) else None
        r3 = (R.get('2026-09', 0) + R.get('2026-10', 0) + nov_tot)
        x = feats('2026-12', w, nov_tot, r3, v0)
        dv = float(final(np.array(x))[0])
        vend = v0 + dv
        lo, hi = vend - q90, vend + q90
        cl = lambda v: float(min(max(v, 0.0), capsum))
        out_sc.append({'name': nm, 'tercile': scen_names[nm], 'rain30dMm': round(w, 1), 'deltaMm3': round(dv, 2),
                       'points': [{'date': str(start), 'volumeMm3': round(v0, 2), 'low': round(v0, 2), 'high': round(v0, 2)},
                                  {'date': str(end), 'volumeMm3': round(cl(vend), 2), 'low': round(min(cl(lo), cl(vend)), 2), 'high': round(max(cl(hi), cl(vend)), 2)}]})
    meta = {'cvResidualQ90Mm3': q90, 'ridgeAlpha': RIDGE_ALPHA, 'nObs': int(len(y))}
    note = ("À afficher tel quel, même si le modèle perd. " + ("Le modèle fait mieux que persistance et climatologie sur la MAE hors échantillon." if beats else "Le modèle ne fait PAS mieux que les deux références sur la MAE hors échantillon."))
    doc = {'status': 'ready', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'label': 'prévision expérimentale',
           'target': f"variation mensuelle du stock reconstitué (Mm³) des grands barrages estimés ({', '.join(est)}), somme ; départ des scénarios = bulletins officiels du 2026-11-18",
           'inputs': ['pluie ERA5 mensuelle (grille amont) corrigée par ratio mensuel station/ERA5 de Youssef Ben Tachfine', 'pluie cumulée du mois précédent et des 3 mois précédents', 'stock courant (mois précédent)', 'mois (sin/cos)'],
           'backtest': {'scheme': 'leave-one-hydrological-year-out (sept→août ; année = année de septembre)', 'years': [int(v) for v in years],
                        'nMonths': int(len(y)),
                        'metrics': [{'model': 'modèle', 'maeMm3': round(mm[0], 2), 'rmseMm3': round(mm[1], 2)},
                                    {'model': 'persistance', 'maeMm3': round(mp[0], 2), 'rmseMm3': round(mp[1], 2)},
                                    {'model': 'climatologie', 'maeMm3': round(mc[0], 2), 'rmseMm3': round(mc[1], 2)}],
                        'beatsBaselines': beats, 'skillVsPersistence': round(skill, 3), 'note': note, 'ridgeAlpha': RIDGE_ALPHA},
           'scenarios': out_sc,
           'scenarioBasis': (f"terciles de pluie historiques (ERA5 corrigée 1990-2025, moyenne du tercile bas / médiane / moyenne du tercile haut pour novembre et décembre) ; "
                             f"prévision numérique Open-Meteo 16 jours ({min(fday)}→{max(fday)}) utilisée telle quelle (non corrigée du biais ERA5) pour les jours couverts, terciles pour les jours restants ; "
                             f"pluie observée ERA5 corrigée du 1er au 12 novembre ; départ : bulletins officiels du 2026-11-18 ({v0:.2f} Mm³)"),
           'caveats': [
               "Prévision expérimentale : projection du stock des grands barrages sur 30 jours selon des scénarios de pluie, pas une prévision d'exploitation.",
               "Lâchers, irrigation, eau potable, prélèvements et évaporation ne sont pas modélisés ; la variation de stock reflète seulement la relation statistique pluie → variation observée dans la série reconstruite.",
               "La cible est elle-même une estimation satellite non officielle (surface saturée pour plusieurs barrages) ; l'apprentissage porte sur ~9 années hydrologiques de stock reconstruit, ridge fortement régularisé (alpha fixé a priori).",
               "La correction de biais de la pluie (ratio mensuel station/ERA5) n'est validée qu'à Youssef Ben Tachfine et appliquée aux autres bassins sans validation ; ERA5 0,25° (ERA5-Land indisponible).",
               "Bandes = quantile 90 % des erreurs absolues de validation croisée ; elles ne couvrent pas l'erreur d'exploitation ni la correction de pluie.",
               "Les scénarios n'ont pas de valeur de vérité tant que les stocks observés des 30 jours ne sont pas publiés ; les résultats du backtest sont publiés tels quels." ] + ([f"Avantage sur les références faible (compétence vs persistance {skill:.2f}) sur ~{len(y)} mois et {len(years)} années hydrologiques, la première (2017) et la dernière (2026) étant partielles : à ne pas surinterpréter."] if beats else []) + ([] if beats else ["Le modèle ne bat pas les références sur le test : ne pas s'y fier."]),
           }
    json.dump(doc, open(os.path.join(OUT, 'fill-forecast.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({'months': ms, 'y': y.tolist(), 'cv_pred': None, 'meta': meta}, open(os.path.join(INTER, 'forecast-training.json'), 'w'))
    print('dams', est, 'n', len(y), 'years', years); print('model', mm, 'persist', mp, 'clim', mc, 'beats', beats, 'skill', skill, 'q90', q90)
    for s in out_sc: print(s['name'], s['rain30dMm'], s['deltaMm3'], s['points'][1])
if __name__ == '__main__': main()
