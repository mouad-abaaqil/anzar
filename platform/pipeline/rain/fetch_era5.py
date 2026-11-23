"""Fetch daily precipitation_sum (Open-Meteo archive; model chosen via env RAIN_MODEL, default era5 because era5_land precipitation is null), yearly chunks, per point. Cached in CACHE dir."""
import requests, json, os, sys, time, datetime
from points import DAMS
MODEL=os.environ.get('RAIN_MODEL','era5')  # era5_land returns null precipitation on the archive API (checked 2026-11-19)
H={'User-Agent':'water-research/1.0'}
CACHE=sys.argv[1]; os.makedirs(CACHE,exist_ok=True)
END=datetime.date.today()-datetime.timedelta(days=7)   # ERA5-Land latency ~5 d
def get(url,params):
    for a in range(8):
        try: r=requests.get(url,params=params,headers=H,timeout=90)
        except requests.exceptions.RequestException: time.sleep(10*(a+1)); continue
        if r.status_code==429: time.sleep(20*(a+1)); continue
        if r.status_code>=500: time.sleep(5*(a+1)); continue
        r.raise_for_status(); return r.json()
    raise RuntimeError('retries exhausted')
pts=[('ref_ybt_dam',)+DAMS['youssef_ben_tachfine']['dam']]
for d,v in DAMS.items():
    for i,(la,lo) in enumerate(v['points']): pts.append((f'{d}_p{i+1}',la,lo))
for name,la,lo in pts:
    for y in range(1990,END.year+1):
        fn=f'{CACHE}/{name}_{y}.json'
        if os.path.exists(fn): continue
        e=min(END,datetime.date(y,12,31))
        j=get('https://archive-api.open-meteo.com/v1/archive',dict(latitude=la,longitude=lo,start_date=f'{y}-01-01',end_date=e.isoformat(),daily='precipitation_sum',models=MODEL,timezone='UTC'))
        json.dump(j,open(fn,'w')); time.sleep(0.2)
    print(name,'ok',flush=True)
