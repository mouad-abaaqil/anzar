"""Parse ABHSM daily-rainfall XLSX files (Youssef Ben Tachfine, station 8900) into daily + monthly CSV.
usage: parse_ybt.py <dir with xlsx> <outdir>"""
import sys, glob, os, re, calendar, collections
import openpyxl, pandas as pd
src, out = sys.argv[1], sys.argv[2]
MONTHS = ['Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août']
MNUM = [9,10,11,12,1,2,3,4,5,6,7,8]
rows=[]; log=[]
for f in sorted(glob.glob(os.path.join(src,'*.xlsx'))):
    ws = openpyxl.load_workbook(f, data_only=True).active
    g = list(ws.iter_rows(values_only=True))
    hy = None
    for r in g[:4]:
        for c in r:
            m = re.fullmatch(r'\s*(\d{4})\s*/\s*(\d{4})\s*', str(c)) if c else None
            if m: hy = int(m.group(1))
    if hy is None: log.append((os.path.basename(f),'no hydro year (empty template)')); continue
    hdr = next(i for i,r in enumerate(g) if r[1]=='Jour')
    cols = {j:MNUM[MONTHS.index(c)] for j,c in enumerate(g[hdr]) if c in MONTHS}
    nvalid=0
    for r in g[hdr+1:hdr+32]:
        d = r[1]
        if not isinstance(d,int): continue
        for j,mn in cols.items():
            y = hy if mn>=9 else hy+1
            if d > calendar.monthrange(y,mn)[1]: continue
            v = r[j]; flag=''
            if v is None or (isinstance(v,str) and v.strip()==''): val=None; flag='missing'
            elif isinstance(v,(int,float)): val=float(v)
            else:
                s=str(v).strip().upper()
                if s in('T','G','TR'): val=0.0; flag='trace'
                elif s in ('M','?'): val=None; flag='missing'
                else:
                    try: val=float(s.replace(',','.'))
                    except: val=None; flag='unparsed:'+s
            if val is not None: nvalid+=1
            rows.append((y,mn,d,val,flag))
    log.append((os.path.basename(f),f'hy {hy}/{hy+1}, valid days {nvalid}'))
df = pd.DataFrame(rows,columns=['year','month','day','rain_mm','flag'])
df = df.drop_duplicates(['year','month','day'],keep='last')
m = df.groupby(['year','month']).agg(n_days=('day','count'),n_valid=('rain_mm','count'),station_mm=('rain_mm','sum')).reset_index()
m['expected_days']=[calendar.monthrange(y,mo)[1] for y,mo in zip(m.year,m.month)]
m['complete']=m.n_valid==m.expected_days
m.loc[~m.complete,'station_mm_complete']=float('nan'); m.loc[m.complete,'station_mm_complete']=m.station_mm
m['month_str']=[f'{y}-{mo:02d}' for y,mo in zip(m.year,m.month)]
m=m.sort_values(['year','month'])
m[['month_str','station_mm_complete','station_mm','n_valid','expected_days','complete']].rename(columns={'month_str':'month','station_mm_complete':'station_mm_complete_months_only','station_mm':'station_mm_sum_of_valid_days'}).to_csv(os.path.join(out,'ybt-station-monthly.csv'),index=False,float_format='%.2f')
print('\n'.join(f'{a}: {b}' for a,b in log))
print('unparsed flags:', df[df.flag.str.startswith('unparsed')].flag.unique())
