"""Assemble data-raw/forecast/v2/ticks-2025.json from read_ticks.run(). Run after the PPM renders exist."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import read_ticks as rt
DATES=['2026-10-29','2026-11-01','2026-11-04','2026-11-08','2026-11-12','2026-11-16','2026-11-18']
CALIB=['2026-10-29','2026-11-04','2026-11-12']   # fixed before any model error was computed
old=next(b for b in rt.bul['bulletins'] if b['date']=='2026-11-18')['dams']
out=[]
for d in DATES:
    o,org,sc=rt.run(d); b=next(x for x in rt.bul['bulletins'] if x['date']==d)
    dams={}
    for i,v in o.items():
        t=v['tickPct']
        dams[i]=None if t is None else dict(pct=t, mm3=round(t/100*rt.caps[i],2), uncertaintyPoints=1.0, uncertaintyMm3=round(rt.caps[i]/100,2))
    known=sum(x['mm3'] for x in dams.values() if x)
    out.append(dict(bulletinDate=d, date2025=d.replace('2026','2025'), role='calibration' if d in CALIB else 'heldout',
        pxPerPct=round(sc,3), printedRegionSameDay2025Pct=b['sameDayPreviousYearPct'], printedRegionSameDay2025Mm3=round(b['sameDayPreviousYearPct']/100*rt.bul['basinCapacityPrintedMm3'],2),
        sumOfReadTicksMm3=round(known,2), dams=dams))
chk=[]
for d in out:
    chk.append((d['bulletinDate'], d['printedRegionSameDay2025Mm3'], d['sumOfReadTicksMm3'], round(d['printedRegionSameDay2025Mm3']-d['sumOfReadTicksMm3'],2)))
cons={i:dict(v1_read=old[i].get('sameDay2025EstimatedPct'), v2_read=(out[-1]['dams'][i] or {}).get('pct')) for i in old}
doc=dict(note="Yellow 'same day 2025' ticks on page 10 of daily bulletins, measured by pixel position at 200 dpi; pct = (bar right edge - tick) / px-per-% with px-per-% fitted per bulletin from that bulletin's own 2026 bars (fills >= 30 %). Uncertainty +/-1 point. Sidi Abdellah has no tick on any bulletin (null). A bulletin 2026-MM-DD gives the value for 2025-MM-DD.",
  split="role fixed a priori: calibration = 2026-10-29, 11-04, 11-12 ticks (plus all 2026 pairs); heldout = 11-01, 11-08, 11-16 (even ranks) and 11-18 (the v1 validation date). 11-16 and 11-18 ticks are nearly identical so not independent.",
  consistencyWith_2026_11_18_v1_read=cons,
  regionSumCheck=dict(columns=['bulletin','printedRegion2025_Mm3','sumNineMinusSidi_Mm3','residual_Mm3(Sidi Abdellah + reading error)'], rows=chk),
  bulletins=out)
json.dump(doc,open('/Users/mouad/Developer/SRMSM/platform/data-raw/forecast/v2/ticks-2025.json','w'),indent=1,ensure_ascii=False)
for r in chk: print(r)
for i,v in cons.items(): print(i,v)
