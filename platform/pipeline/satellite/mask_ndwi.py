"""Derive water-frequency maps from clear Sentinel-2 scenes over a generous region around each dam."""
import json, sys, collections, numpy as np
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import box, mapping, shape
import s2_lib
REGIONS = {  # [minlon,minlat,maxlon,maxlat], generous boxes around the dam / OSM outline
 "youssef-ben-tachfine": [-9.52, 29.755, -9.42, 29.875], "moulay-abdellah": [-9.72, 30.745, -9.63, 30.80],
 "aoulouz": [-8.16, 30.675, -8.06, 30.73], "abdelmoumen": [-9.24, 30.65, -9.12, 30.75]}
def pick(items, region_poly, per_year=6, maxcloud=10):
    ok = [i for i in items if shape(i["geometry"]).contains(region_poly) and i["properties"].get("eo:cloud_cover", 100) < maxcloud]
    bydate = {}
    for i in ok:
        d = i["properties"]["datetime"][:10]
        if d not in bydate or i["properties"]["eo:cloud_cover"] < bydate[d]["properties"]["eo:cloud_cover"]: bydate[d] = i
    out = []
    for y in range(2017, 2027):
        ys = sorted([v for d, v in bydate.items() if d.startswith(str(y))], key=lambda i: i["properties"]["datetime"])
        step = max(1, len(ys) // per_year)
        out += ys[::step][:per_year]
    return out
if __name__ == "__main__":
    for id_, bb in [(k, v) for k, v in REGIONS.items() if k in (sys.argv[1:] or REGIONS)]:
        poly = box(*bb)
        items = s2_lib.stac_search(bb, "2017-03-01", "2026-11-19")
        sel = pick(items, poly)
        print(id_, "items", len(items), "selected", len(sel), flush=True)
        def job(it):
            r = s2_lib.read_scene(it, mapping(poly))
            if not r or "error" in r: return None
            w, v, tr, crs = r["_water"]
            return it["properties"]["datetime"][:10], w, v, tr, crs
        with ThreadPoolExecutor(6) as ex: res = [r for r in ex.map(job, sel) if r]
        shp = collections.Counter(r[1].shape for r in res).most_common(1)[0][0]
        res = [r for r in res if r[1].shape == shp]
        W = np.sum([r[1] for r in res], 0).astype("uint8"); V = np.sum([r[2] for r in res], 0).astype("uint8")
        np.savez_compressed(f"/tmp/freq_{id_}.npz", W=W, V=V, dates=[r[0] for r in res], tr=np.array(res[0][3])[:6], crs=res[0][4])
        print(id_, "scenes used", len(res), "shape", shp, flush=True)
