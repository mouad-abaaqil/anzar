"""16-day forecast (Open-Meteo forecast API, default best_match NWP blend; independent of ERA5 reanalysis). usage: fetch_forecast.py <out.json>"""
import requests, json, sys, time, datetime
from points import DAMS
H={'User-Agent':'water-research/1.0'}
def get(p):
    for a in range(6):
        r=requests.get('https://api.open-meteo.com/v1/forecast',params=p,headers=H,timeout=60)
        if r.status_code==429: time.sleep(20*(a+1)); continue
        r.raise_for_status(); return r.json()
    raise RuntimeError('retries exhausted')
out={'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),'source':'Open-Meteo forecast API (api.open-meteo.com/v1/forecast), daily precipitation_sum, forecast_days=16, default model blend (best_match)','units':'mm/day','note':'Numerical weather prediction, not an observation; rainfall over mountains is uncertain beyond about day 5-7. Catchment mean = plain mean over the indicative grid points.','licence':'Open-Meteo data CC BY 4.0; free tier non-commercial','dams':{}}
for dam,v in DAMS.items():
    series=[]; dates=None
    for la,lo in v['points']:
        j=get(dict(latitude=la,longitude=lo,daily='precipitation_sum',forecast_days=16,timezone='UTC'))
        dates=j['daily']['time']; series.append(j['daily']['precipitation_sum']); time.sleep(0.3)
    mean=[round(sum(s[i] for s in series if s[i] is not None)/max(1,sum(s[i] is not None for s in series)),2) for i in range(len(dates))]
    out['dams'][dam]=dict(n_points=len(series),dates=dates,catchment_mean_mm=mean,total_16d_mm=round(sum(mean),1),max_point_total_16d_mm=round(max(sum(x or 0 for x in s) for s in series),1))
json.dump(out,open(sys.argv[1],'w'),indent=1)
print(json.dumps({d:v['total_16d_mm'] for d,v in out['dams'].items()}))
