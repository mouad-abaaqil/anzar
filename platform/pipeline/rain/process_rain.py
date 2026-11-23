"""Build monthly CSVs, hydro-year totals, YBT comparison + bias report, climatology/terciles.
usage: process_rain.py <cache dir> <ybt monthly csv from parse_ybt.py> <outdir>"""
import sys, json, glob, os, math, datetime
import numpy as np, pandas as pd
from points import DAMS
cache, ybt_csv, out = sys.argv[1:4]
MODEL = os.environ.get('RAIN_MODEL','era5')

def load(name):
    fr=[]; meta=None
    for f in sorted(glob.glob(f'{cache}/{name}_*.json')):
        j=json.load(open(f)); meta=(j['latitude'],j['longitude'],j['elevation'])
        fr.append(pd.DataFrame({'date':pd.to_datetime(j['daily']['time']),'mm':j['daily']['precipitation_sum']}))
    d=pd.concat(fr).drop_duplicates('date').set_index('date')['mm'].astype(float)
    return d, meta

def monthly(d):
    g=d.groupby(d.index.to_period('M'))
    return pd.DataFrame({'mm':g.sum(min_count=1),'days':g.count(),'expected':pd.Series({p:p.days_in_month for p in g.size().index})})

def hydro(d_month):  # d_month index Period M
    idx=getattr(d_month,'index',d_month)
    hy=[p.year if p.month>=9 else p.year-1 for p in idx]
    return hy

pm={}; meta={}; ptsinfo={}
for dam,v in DAMS.items():
    cols={}
    for i,(la,lo) in enumerate(v['points']):
        n=f'{dam}_p{i+1}'; d,m=load(n); mo=monthly(d); pm[n]=mo; meta[n]=m
        cols[f'p{i+1}']=mo
        ptsinfo.setdefault(dam,[]).append(dict(id=f'p{i+1}',requested_lat=la,requested_lon=lo,grid_lat=round(m[0],3),grid_lon=round(m[1],3),elevation_m=m[2]))
    df=pd.DataFrame({k:x['mm'] for k,x in cols.items()})
    days=pd.DataFrame({k:x['days'] for k,x in cols.items()}).min(axis=1)
    exp=list(cols.values())[0]['expected']
    res=pd.DataFrame({'month':[str(p) for p in df.index]})
    res['catchment_mean_mm']=df.mean(axis=1,skipna=False).round(2).values
    res['n_points']=df.notna().sum(axis=1).values
    res['days_covered']=days.values; res['days_in_month']=exp.values
    res['complete']=(days.values==exp.values)
    for k in df: res[k]=df[k].round(2).values
    res.to_csv(f'{out}/{dam}-monthly.csv',index=False)
    DAMS[dam]['_df']=df; DAMS[dam]['_res']=res; DAMS[dam]['_cm']=pd.Series(res.catchment_mean_mm.values,index=df.index); DAMS[dam]['_complete']=pd.Series(res.complete.values,index=df.index)

# hydro-year totals
rows=[]
for dam,v in DAMS.items():
    cm=v['_cm']; comp=v['_complete']; hy=pd.Series(hydro(cm),index=cm.index)
    for y in sorted(set(hy)):
        sel=hy==y; n=int(sel.sum()); ok=n==12 and bool(comp[sel].all())
        rows.append(dict(dam_id=dam,hydro_year=f'{y}/{y+1}',total_mm=round(float(cm[sel].sum()),1) if ok else None,partial_sum_mm=round(float(cm[sel].sum()),1),months_present=n,complete=ok))
pd.DataFrame(rows).to_csv(f'{out}/hydro-year-totals.csv',index=False)
hyt=pd.DataFrame(rows)

# ---- YBT validation
st=pd.read_csv(ybt_csv); st['p']=pd.PeriodIndex(st['month'],freq='M'); st=st.set_index('p')
sm=st['station_mm_complete_months_only']
dref,mref=load('ref_ybt_dam'); ref=monthly(dref)
ybt=DAMS['youssef_ben_tachfine']; sta=(29.84556,-9.49444)
def hav(a,b): 
    R=6371;p=math.pi/180
    h=math.sin((b[0]-a[0])*p/2)**2+math.cos(a[0]*p)*math.cos(b[0]*p)*math.sin((b[1]-a[1])*p/2)**2
    return 2*R*math.asin(math.sqrt(h))
dist=[(hav(sta,(la,lo)),i) for i,(la,lo) in enumerate(ybt['points'])]; dn,inear=min(dist)
near=ybt['_df'][f'p{inear+1}']
ref_ok=ref['days']==ref['expected']; ref_s=ref['mm'].where(ref_ok)
series={'era5_cell_at_dam_site':ref_s,'era5_nearest_catchment_point':near.where(pm[f'youssef_ben_tachfine_p{inear+1}']['days']==pm[f'youssef_ben_tachfine_p{inear+1}']['expected']),'era5_catchment_mean':ybt['_cm'].where(ybt['_complete'])}
fin=pd.DataFrame({'month':[str(p) for p in sm.index],'station_mm':sm.values},index=sm.index)
for k,s in series.items(): fin[k]=s.reindex(sm.index).round(2).values
fin.to_csv(f'{out}/ybt-station-monthly.csv',index=False)

def stats(s,e,label):
    df=pd.DataFrame({'s':s,'e':e}).dropna()
    if len(df)<3: return dict(n=len(df))
    return dict(n=int(len(df)),station_mean_mm=round(df.s.mean(),2),era5_mean_mm=round(df.e.mean(),2),mean_bias_mm=round((df.e-df.s).mean(),2),ratio_sum=round(df.e.sum()/df.s.sum(),3) if df.s.sum()>0 else None,pearson_r=round(float(df.s.corr(df.e)),3),rmse_mm=round(float(np.sqrt(((df.e-df.s)**2).mean())),2))
rep=dict(generated=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),era5_model=MODEL,
  station=dict(name='Barrage Youssef Ben Tachfine',station_no=8900,source='ABHSM daily rainfall 1967-2024, data.gov.ma, ODbL',lat=sta[0],lon=sta[1],coordinates_note='dam coordinates from GDW (LAT_RIV/LONG_RIV); XLSX headers carry X/Y/Z = 0'),
  note='Negative bias = ERA5 below station. Only months complete (all days valid) at both sides. ERA5 here is the 0.25 deg model because era5_land precipitation is null on the Open-Meteo archive.',
  nearest_catchment_point=dict(id=f'p{inear+1}',distance_km=round(dn,1),grid=ptsinfo['youssef_ben_tachfine'][inear]),
  era5_cell_at_dam_site=dict(grid_lat=round(mref[0],3),grid_lon=round(mref[1],3),elevation_m=mref[2],distance_km=round(hav(sta,mref[:2]),1)),
  overlap_1990_2024={}, overlap_2000_2024={}, per_calendar_month_1990_2024={}, per_hydro_year={})
for lab,per in (('overlap_1990_2024',slice('1990-01','2024-12')),('overlap_2000_2024',slice('2000-01','2024-12'))):
    for k,s in series.items(): rep[lab][k]=stats(sm[per],s.reindex(sm.index)[per],k)
for mth in range(1,13):
    idx=[p for p in sm.index if p.month==mth and '1990'<=str(p.year)<='2024']
    rep['per_calendar_month_1990_2024'][str(mth)]={k:stats(sm[idx],s.reindex(sm.index)[idx],k) for k,s in series.items() if k!='era5_nearest_catchment_point'}
# hydro-year totals station (complete 12 months)
hys=pd.Series(hydro(sm),index=sm.index)
hyrows=[]
for y in sorted(set(hys)):
    sel=hys==y
    if sel.sum()==12 and sm[sel].notna().all():
        r=dict(hydro_year=f'{y}/{y+1}',station_mm=round(float(sm[sel].sum()),1))
        for k,s in series.items():
            e=s.reindex(sm.index)[sel]
            r[k]=round(float(e.sum()),1) if e.notna().all() else None
        r['ratio_cell_at_dam_site']=round(r['era5_cell_at_dam_site']/r['station_mm'],3) if r['era5_cell_at_dam_site'] is not None and r['station_mm']>0 else None
        r['ratio_catchment_mean']=round(r['era5_catchment_mean']/r['station_mm'],3) if r['era5_catchment_mean'] is not None and r['station_mm']>0 else None
        hyrows.append(r)
rep['per_hydro_year']=hyrows
hd=pd.DataFrame(hyrows)
if len(hd):
    for k in ('era5_cell_at_dam_site','era5_catchment_mean'):
        x=hd[['station_mm',k]].dropna(); rep.setdefault('hydro_year_summary',{})[k]=dict(n_years=len(x),pearson_r=round(float(x.station_mm.corr(x[k])),3),ratio_sum=round(float(x[k].sum()/x.station_mm.sum()),3),mean_bias_mm=round(float((x[k]-x.station_mm).mean()),1))
rep['station_years_parsed']=int(len(set(hydro(st['station_mm_sum_of_valid_days'][st.n_valid>0].index))))
rep['station_complete_hydro_years_1967_2024']=int(len([1 for y in set(hydro(sm.index)) if (hys==y).sum()==12 and sm[hys==y].notna().all()]))
json.dump(rep,open(f'{out}/bias-report.json','w'),indent=1,ensure_ascii=False)

# ---- climatology / terciles 1990-2025
clim={'period':'1990-01..2025-12','source':f'Open-Meteo archive, model {MODEL}, catchment mean of indicative grid points','units':'mm per month','tercile_rule':'dry: < lower_tercile (33.3rd pct); wet: > upper_tercile (66.7th pct); normal otherwise. numpy linear percentile over 36 years.','note':'In dry-season months (Jun-Aug) many values are 0 mm so the terciles degenerate; treat with care. Values are raw ERA5, not bias-corrected.','dams':{}}
for dam,v in DAMS.items():
    cm=v['_cm']; per=cm[(cm.index.year>=1990)&(cm.index.year<=2025)]
    byc={}
    for m in range(1,13):
        x=per[per.index.month==m].dropna().values
        byc[str(m)]=dict(n_years=int(len(x)),mean_mm=round(float(x.mean()),1),median_mm=round(float(np.median(x)),1),std_mm=round(float(x.std(ddof=1)),1),min_mm=round(float(x.min()),1),max_mm=round(float(x.max()),1),lower_tercile_mm=round(float(np.percentile(x,100/3)),1),upper_tercile_mm=round(float(np.percentile(x,200/3)),1))
    h=hyt[(hyt.dam_id==dam)&hyt.complete&(hyt.hydro_year.str[:4].astype(int)>=1990)&(hyt.hydro_year.str[:4].astype(int)<=2024)].total_mm.values
    clim['dams'][dam]=dict(catchment_km2=v['catch_km2'],monthly_by_calendar_month=byc,hydro_year_total=dict(years='1990/91..2024/25',n=int(len(h)),mean_mm=round(float(h.mean()),1),lower_tercile_mm=round(float(np.percentile(h,100/3)),1),upper_tercile_mm=round(float(np.percentile(h,200/3)),1)))
json.dump(clim,open(f'{out}/climatology-terciles.json','w'),indent=1)
json.dump(dict(note='Indicative points, not a delineated watershed. grid_* is the cell Open-Meteo actually returned for the model.',model=MODEL,dam_site_reference={'youssef_ben_tachfine':dict(grid_lat=round(mref[0],3),grid_lon=round(mref[1],3),elevation_m=mref[2])},dams={d:dict(dam_lat=v['dam'][0],dam_lon=v['dam'][1],gdw_catchment_km2=v['catch_km2'],points=ptsinfo[d]) for d,v in DAMS.items()}),open(f'{out}/grid-points.json','w'),indent=1)
print(json.dumps({k:rep[k] for k in ('nearest_catchment_point','era5_cell_at_dam_site','overlap_1990_2024','overlap_2000_2024','hydro_year_summary','station_years_parsed','station_complete_hydro_years_1967_2024')},indent=1))
