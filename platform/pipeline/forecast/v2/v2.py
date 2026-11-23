"""v2: cleaning + refit + held-out validation.  Run: /tmp/srmsm-venv/bin/python pipeline/forecast/v2/v2.py  (from platform/)
Outputs in data-raw/forecast/v2/: <id>-clean.json, results.json.  Inputs: satellite series (already carry coreValidFraction, harmonised BOA offset), bulletins, ticks-2025.json."""
import json, os, datetime as dt, statistics as st
import numpy as np
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','..')); RAW=os.path.join(ROOT,'data-raw'); OUT=os.path.join(RAW,'forecast','v2')
D=lambda s: dt.date.fromisoformat(s[:10])
DAMS=[('youssef-ben-tachfine','Youssef Ben Tachfine'),('abdelmoumen','Abdelmoumen'),('aoulouz','Aoulouz'),('moulay-abdellah','Moulay Abdellah')]
CORE_MIN=0.95; NBR_DAYS=12; JUMP=0.35; SAT_FRAC=0.05; AREA_NOISE=0.03; CLOUD_MAX=30.0
bul=json.load(open(f'{RAW}/bulletins/souss-massa-series.json')); caps=bul['capacitiesMm3']
ticks=json.load(open(f'{OUT}/ticks-2025.json'))
def clean(raw,key):
    log={'coreValidFraction<0.95':0,'duplicateTile':0,'neighbourJump>35%':0,'cloud>30%':0}
    ok=[s for s in raw if s['coreValidFraction']>=CORE_MIN and s['validFraction']>=0.9]; log['coreValidFraction<0.95']=len(raw)-len(ok)
    bydate={}
    for s in ok: bydate.setdefault(s['date'],[]).append(s)
    one=[]
    for d,l in sorted(bydate.items()):
        best=max(l,key=lambda s:(s['validFraction'],s['coreValidFraction'])); one.append(best); log['duplicateTile']+=len(l)-1
    kept=[]
    for s in one:
        nb=[o[key] for o in one if o is not s and abs((D(o['date'])-D(s['date'])).days)<=NBR_DAYS]
        s=dict(s); s['nNeighbours']=len(nb); s['area']=s[key]
        if nb and st.median(nb)>0.05 and abs(s[key]/st.median(nb)-1)>JUMP and max(nb)>0.3:
            log['neighbourJump>35%']+=1; continue
        if s['cloudCover']>CLOUD_MAX: log['cloud>30%']+=1; s['suspectCloud']=True
        kept.append(s)
    return kept,log
def stability(raw,key):
    kept,_=clean(raw,key); r=[]
    for s in kept:
        nb=[o['area'] for o in kept if o is not s and abs((D(o['date'])-D(s['date'])).days)<=NBR_DAYS]
        if len(nb)>=2 and st.median(nb)>0.3 and s['area']>0: r.append(abs(np.log(s['area']/st.median(nb))))
    return dict(n=len(r),medianAbsLogDevFromNeighbours=round(float(np.median(r)),4) if r else None,p90=round(float(np.percentile(r,90)),4) if r else None,scenesKept=len(kept))
def match(scenes,date,r1=3,r2=10):
    for r in (r1,r2):
        c=[s for s in scenes if abs((D(s['date'])-D(date)).days)<=r and not s.get('suspectCloud')]
        if c: return c,r
    return [],None
def fit(pts,amax):
    """pts: (area, V, group). equal total weight per group (2026 bulletins / 2025 ticks). b grid [1,2], k by weighted log-LS."""
    A=np.array([p[0] for p in pts]);V=np.array([p[1] for p in pts]);g=[p[2] for p in pts]
    w=np.array([1.0/g.count(x) for x in g]); w/=w.sum()
    prof=[]
    for b in np.round(np.arange(1,2.0001,0.01),2):
        lk=np.sum(w*(np.log(V)-b*np.log(A))); res=np.log(V)-lk-b*np.log(A)
        prof.append((float(b),float(np.exp(lk)),float(np.sqrt(np.sum(w*res**2)))))
    best=min(prof,key=lambda t:t[2]); tol=max(2*best[2],0.03); ok=[t for t in prof if t[2]<=tol]
    return dict(k=best[1],b=best[0],bLow=min(t[0] for t in ok),bHigh=max(t[0] for t in ok),
                kLow=next(t[1] for t in prof if t[0]==min(x[0] for x in ok)),kHigh=next(t[1] for t in prof if t[0]==max(x[0] for x in ok)),rmseLog=best[2],amax=amax)
def predict(c,A,cap):
    f=lambda k,b,a:k*max(a,1e-6)**b
    sat=A>=(1-SAT_FRAC)*c['amax']
    cands=[f(k,b,A*m) for k,b in ((c['kLow'],c['bLow']),(c['k'],c['b']),(c['kHigh'],c['bHigh'])) for m in (1-AREA_NOISE,1+AREA_NOISE)]
    v=f(c['k'],c['b'],A); lo=min(cands); hi=max(cands)
    if sat: return dict(v=min(v,cap),lo=min(lo,cap),hi=cap,saturated=True)
    return dict(v=min(v,cap),lo=min(lo,cap),hi=min(hi,cap),saturated=False)
def main():
    res={'dams':[],'validation':[],'thresholdTest':{},'cleaning':{}}; fits={}; scn={}
    for did,name in DAMS:
        raw=json.load(open(f'{RAW}/satellite/{did}-series.json')); cap=caps[did]
        st0=stability(raw,'areaKm2'); st1=stability(raw,'areaKm2_ndwi01'); res['thresholdTest'][did]={'ndwi>0':st0,'ndwi>0.1':st1}
        # threshold choice, fixed rule: use ndwi>0 unless the 0.1 variant is clearly stabler (median deviation < 0.8x) for that dam
        key='areaKm2_ndwi01' if (st1['medianAbsLogDevFromNeighbours'] or 9)<0.8*(st0['medianAbsLogDevFromNeighbours'] or 9) else 'areaKm2'
        kept,log=clean(raw,key); scn[did]=kept; res['cleaning'][did]=dict(raw=len(raw),kept=len(kept),removed=log,thresholdUsed='NDWI>0.1' if key=='areaKm2_ndwi01' else 'NDWI>0')
        json.dump(dict(id=did,rules=dict(coreValidFractionMin=CORE_MIN,singleTilePerDate='highest validFraction',neighbourJump=f'>{JUMP:.0%} vs median of scenes within +/-{NBR_DAYS} d dropped (isolated scenes kept)',cloudCoverFlag=CLOUD_MAX,areaField=key,
            note='coreValidFraction and validFraction come from the COG reads of pipeline/satellite/s2_lib.read_scene (same read function and offset harmonisation, boaOffset fields in the series); no re-read of COGs was needed.'),removed=log,scenes=[{k:s[k] for k in ('date','sceneId','area','validFraction','coreValidFraction','cloudCover','nNeighbours') }|({'suspectCloud':True} if s.get('suspectCloud') else {}) for s in kept]),
            open(f'{OUT}/{did}-clean.json','w'),indent=1)
        amax=max(s['area'] for s in kept)
        pts=[];pairs=[]
        for b in bul['bulletins']:
            c=[s for s in kept if abs((D(s['date'])-D(b['date'])).days)<=2 and not s.get('suspectCloud')]
            if c:
                s=min(c,key=lambda s:abs((D(s['date'])-D(b['date'])).days)); pts.append((s['area'],b['dams'][did]['storedMm3'],'2026')); pairs.append(dict(bulletin=b['date'],scene=s['date'],areaKm2=s['area'],volumeMm3=b['dams'][did]['storedMm3'],group='2026 bulletin'))
        for t in ticks['bulletins']:
            if t['role']!='calibration' or not t['dams'][did]: continue
            c,r=match(kept,t['date2025'],3,3)
            if c and not any(abs((D(s['date'])-D(t['date2025'])).days)>3 for s in c):
                med=st.median(s['area'] for s in c); v=t['dams'][did]['mm3']; pts.append((med,v,'2025')); pairs.append(dict(bulletin=t['bulletinDate'],date=t['date2025'],scene=[s['date'] for s in c],areaKm2=round(med,4),volumeMm3=v,group='2025 tick (calibration)'))
        c=fit(pts,amax); fits[did]=(c,cap); n25=sum(1 for p in pts if p[2]=='2025')
        fd=dict(id=did,name=name,capacityMm3=cap,fit=dict(k=round(c['k'],5),b=c['b'],bLow=c['bLow'],bHigh=c['bHigh'],kLow=round(c['kLow'],5),kHigh=round(c['kHigh'],5),rmseLog=round(c['rmseLog'],3),nPairs=len(pts),n2025CalibrationPairs=n25,pairs=pairs,maxCleanAreaKm2=round(amax,4),saturationRule=f'area >= {1-SAT_FRAC:.0%} of max clean area -> volume reported as [V(area), capacity], flag saturated',anchorUsed=False),estimated=True)
        fd['identified']=n25>=1
        res['dams'].append(fd)
    # validation
    def one(did,date,off,offsrc,unc):
        c,cap=fits[did]; sc,r=match(scn[did],date,3,10)
        if not sc: return dict(name=f'{did} {date}',official=off,estimated=None,note='aucune scène propre à ≤10 jours',usedInCalibration=False)
        med=st.median(s['area'] for s in sc); p=predict(c,med,cap)
        e=p['v']; inb=p['lo']<=off<=p['hi']
        return dict(name=f"{dict(DAMS)[did]}, repère 2025 du bulletin {date.replace('2025','2026')}",dam=did,date=date,official=round(off,2),officialSource=offsrc,officialUncertaintyMm3=round(unc,2),estimated=round(e,2),estimatedLow=round(p['lo'],2),estimatedHigh=round(p['hi'],2),
            errorMm3=round(e-off,2),errorPct=round(100*(e-off)/off,1),errorPctOfCapacity=round(100*(e-off)/cap,1),insideBand=bool(inb),withinOfficialUncertainty=bool(abs(e-off)<=unc),saturated=p['saturated'],areaKm2=round(med,3),sceneOffsetDays=[(D(s['date'])-D(date)).days for s in sc],matchRadiusDays=r,usedInCalibration=False,timingCaveat=bool(date>='2025-11-16' and all(x['date']<='2025-11-12' for x in sc)))
    for t in ticks['bulletins']:
        if t['role']!='heldout': continue
        for did,_ in DAMS:
            tk=t['dams'][did]
            if tk: res['validation'].append(one(did,t['date2025'],tk['mm3'],f"bulletin {t['bulletinDate']} tick {tk['pct']} % x {caps[did]} Mm3 (+/-1 point)",tk['uncertaintyMm3']))
    # region held-out: dates where all 4 dams have a scene
    smallids=[i for i in caps if i not in dict(DAMS)]
    for t in ticks['bulletins']:
        if t['role']!='heldout': continue
        rows=[r for r in res['validation'] if r.get('date')==t['date2025'] and r.get('estimated') is not None]
        if len(rows)<4: res['validation'].append(dict(name=f"Région, repère 2025 du bulletin {t['bulletinDate']}",date=t['date2025'],official=t['printedRegionSameDay2025Mm3'],estimated=None,note=f'{len(rows)}/4 grands barrages avec scène propre à ≤10 j',usedInCalibration=False)); continue
        small=sum(t['dams'][i]['mm3'] for i in smallids if t['dams'][i]); e=sum(r['estimated'] for r in rows)+small; lo=sum(r['estimatedLow'] for r in rows)+small; hi=sum(r['estimatedHigh'] for r in rows)+small
        off=t['printedRegionSameDay2025Mm3']
        res['validation'].append(dict(name=f"Région, même jour 2025 (bulletin {t['bulletinDate']})",date=t['date2025'],official=off,officialSource='bulletin : % imprimé même jour 2025 x 722,83',estimated=round(e,2),estimatedLow=round(lo,2),estimatedHigh=round(hi,2),errorMm3=round(e-off,2),errorPct=round(100*(e-off)/off,1),insideBand=bool(lo<=off<=hi),
            composition='4 grands barrages (satellite) + petits barrages lus sur graphique (Sidi Abdellah sans repère, non compté)',breakdownMm3={r['dam']:r['errorMm3'] for r in rows},usedInCalibration=False))
    for r in res['validation']:
        if r.get('timingCaveat'): r['timingNote']='scène antérieure à la crue de 2025-11-13..16 (les repères montent), écart de date et non de modèle ; comparaison non concluante'
    # press 2025-06-11
    rows=[]
    for did,_ in DAMS:
        c,cap=fits[did]; sc,r=match(scn[did],'2025-06-11',7,7)
        if sc: p=predict(c,st.median(s['area'] for s in sc),cap); rows.append((did,p))
    off=0.2083*722.83
    if len(rows)==4: res['validation'].append(dict(name='Région, presse 2025-06-11',date='2025-06-11',official=round(off,2),estimated=round(sum(p['v'] for _,p in rows),2),estimatedLow=round(sum(p['lo'] for _,p in rows),2),estimatedHigh=round(sum(p['hi'] for _,p in rows),2),note='4 grands barrages seulement, petits barrages non inclus; source presse faible',press=True,usedInCalibration=False))
    else: res['validation'].append(dict(name='Région, presse 2025-06-11',date='2025-06-11',official=round(off,2),estimated=None,note=f'{len(rows)}/4 grands barrages avec scène propre à ≤7 j',press=True,usedInCalibration=False))
    res.update(status='experimental',generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),label='estimation satellite calée sur les bulletins, non officielle',
      split=ticks['split'])
    json.dump(res,open(f'{OUT}/results.json','w'),indent=1,ensure_ascii=False)
    for v in res['validation']: print(v['name'][:60],v.get('official'),v.get('estimated'),v.get('errorMm3'),v.get('errorPct'),v.get('insideBand'),v.get('matchRadiusDays'),v.get('saturated'))
    for d in res['dams']: print(d['id'],d['fit']['b'],d['fit']['bLow'],d['fit']['bHigh'],d['fit']['nPairs'],d['fit']['n2025CalibrationPairs'],d['fit']['maxCleanAreaKm2'])
    print(json.dumps(res['thresholdTest'],indent=0)); print(json.dumps(res['cleaning']))
if __name__=='__main__': main()
