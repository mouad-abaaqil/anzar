"""Read the yellow 'same day 2025' ticks on page 10 of daily bulletins (pixel measurement, 200 dpi).
Calibration per bulletin: px per % = regression of (bar right edge - 2026 fill-bar left edge) on printed 2026 fill %.
Run: /tmp/srmsm-venv/bin/python pipeline/forecast/v2/read_ticks.py [dates...]  (needs /tmp/v2/p200-<date>-10.ppm from pdftoppm -f 10 -l 10 -r 200 (PPM output))"""
import sys, re, json, numpy as np
ROOT='/Users/mouad/Developer/SRMSM/platform'
bul=json.load(open(f'{ROOT}/data-raw/bulletins/souss-massa-series.json'))
caps=bul['capacitiesMm3']
def read_ppm(path):
    b=open(path,'rb').read(); m=re.match(rb'P6\s+(\d+)\s+(\d+)\s+255\s',b); w,h=int(m.group(1)),int(m.group(2))
    return np.frombuffer(b[m.end():],dtype=np.uint8).reshape(h,w,3).astype(int)
def analyse(date):
    im=read_ppm(f'/tmp/v2/p200-{date}-10.ppm')
    H,W,_=im.shape; R,G,B=im[...,0],im[...,1],im[...,2]
    yellow=(R>225)&(G>170)&(G<225)&(B<150)&(R-B>100)
    light=(R>140)&(R<200)&(G>200)&(B>235)          # 2026 fill bar light blue
    rows=[]; ys=np.where(light[:, 400:].sum(1)>40)[0]
    # group contiguous y
    grp=[]; 
    for y in ys:
        if grp and y-grp[-1][-1]<=2: grp[-1].append(y)
        else: grp.append([y])
    for g in grp:
        if len(g)<30: continue
        yc=int(np.median(g)); ya,yb=g[0]+8,g[-1]-8
        cols=np.where(light[ya:yb,:].mean(0)>0.6)[0]; cols=cols[cols>350]
        # fill bar spans [left,right]; text digits dark inside but bar still continuous in most rows -> use min/max
        left,right=cols.min(),cols.max()
        # tick: yellow columns in the row band (extended to bar track)
        ty=np.where(yellow[g[0]-12:g[-1]+12,350:].sum(0)>=int(0.5*(len(g)+24)*0.6))[0]+350
        tx=float(ty.mean()) if len(ty) else None
        rows.append(dict(yc=yc,left=int(left),right=int(right),tick=tx,ntick=len(ty)))
    return rows
def run(date):
    rows=analyse(date); b=next(x for x in bul['bulletins'] if x['date']==date)
    dams=b['dams']; ids=list(dams)
    # right edge of the fill bar = origin (0 %), common to all rows
    origin=float(np.median([r['right'] for r in rows]))
    # identify rows by assigning dams in decreasing fill to rows by bar length (bar length ~ fill)
    rl=sorted(rows,key=lambda r:-(origin-r['left'])); dl=sorted(ids,key=lambda i:-dams[i]['fillPct'])
    for r,i in zip(rl,dl): r['id']=i
    # scale: weighted least squares through origin using fill >= 30 % (short bars carry minimal-width/rounding effects)
    xs=np.array([dams[r['id']]['fillPct'] for r in rows]); ls=np.array([origin-r['left']+1 for r in rows])
    m=xs>=30; scale=float((xs[m]*ls[m]).sum()/(xs[m]**2).sum())
    out={}
    for r in rows:
        i=r['id']; t=None if r['tick'] is None else round((origin-r['tick'])/scale,1)
        out[i]=dict(tickPct=t, barLenPx=int(origin-r['left']), pxPerPct=round(scale,3), fill2026=dams[i]['fillPct'], fitResidPct=round((origin-r['left']+1)/scale-dams[i]['fillPct'],2))
    return out,origin,scale
if __name__=='__main__':
    res={}
    for d in sys.argv[1:]:
        o,org,sc=run(d); res[d]=o
        print(d,'origin',org,'scale',round(sc,3))
        for i,v in o.items(): print('  ',i,v)
    json.dump(res,open('/tmp/v2/ticks-raw.json','w'),indent=1)
