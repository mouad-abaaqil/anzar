"""Build final analysis masks and Sentinel-2 water-area series.
usage: build_series.py masks | series <id> | pairs"""
import json, sys, os, datetime as dt, statistics, time
from concurrent.futures import ThreadPoolExecutor
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union, transform
from pyproj import Transformer
import s2_lib
OUT = "/Users/mouad/Developer/SRMSM/platform/data-raw/satellite/"
IDS = ["youssef-ben-tachfine", "abdelmoumen", "aoulouz", "moulay-abdellah"]
BULLETINS = ["2026-10-31", "2026-11-03"] + [f"2026-11-{d:02d}" for d in range(9, 19)]
MIN_VALID = 0.90
def mask_geom(id_):
    return shape(json.load(open(f"{OUT}polygons/{id_}.geojson"))["features"][0]["geometry"]) if False else \
        [shape(f["geometry"]) for f in json.load(open(f"{OUT}polygons/{id_}.geojson"))["features"] if f["properties"]["role"] == "analysis-mask"][0]
def core_geom(id_):
    fs = json.load(open(f"{OUT}polygons/{id_}.geojson"))["features"]
    g = unary_union([shape(f["geometry"]) for f in fs if f["properties"]["role"] in ("osm-outline", "ndwi-max-extent")])
    return mapping(g)
def build_masks():
    utm = Transformer.from_crs(4326, 32629, always_xy=True).transform
    ll = Transformer.from_crs(32629, 4326, always_xy=True).transform
    for id_ in IDS:
        d = json.load(open(f"/tmp/derived_{id_}.json")); res = d["res"]
        nd = shape(d["ndwi"]); osm = shape(d["osm"]) if d.get("osm") else None
        feats = []
        if osm is not None:
            feats.append(dict(type="Feature", properties=dict(id=id_, role="osm-outline", osm=res["osm"], areaKm2=res["osmKm2"]), geometry=mapping(osm)))
        feats.append(dict(type="Feature", properties=dict(id=id_, role="ndwi-max-extent", areaKm2=res["ndwiExtentKm2"], nScenes=res["nScenesForExtent"], note="union of NDWI>0 water pixels seen in >=2 of 60 clear scenes sampled 2017-2026 (6/yr), smoothed"), geometry=mapping(nd)))
        base = unary_union([nd] + ([osm] if osm is not None else []))
        mk = transform(ll, transform(utm, base).buffer(300))
        mk_km2 = round(transform(utm, mk).area / 1e6, 3)
        c = base.centroid
        feats.append(dict(type="Feature", properties=dict(id=id_, role="analysis-mask", areaKm2=mk_km2, bufferM=300, centroid=[round(c.x, 5), round(c.y, 5)], basis="union(OSM outline if any, NDWI max extent) buffered 300 m"), geometry=mapping(mk)))
        json.dump(dict(type="FeatureCollection", features=feats), open(f"{OUT}polygons/{id_}.geojson", "w"))
        print(id_, "mask km2", mk_km2, "centroid", round(c.y, 5), round(c.x, 5))
def pick_candidates(items, mk):
    cov = [i for i in items if shape(i["geometry"]).contains(mk)]
    by = {}
    for i in cov:  # one item per date+tile; prefer highest reprocessing suffix
        k = (i["properties"]["datetime"][:10], i["id"].split("_")[1])
        if k not in by or i["id"] > by[k]["id"]: by[k] = i
    return list(by.values())
def measure(it, mk_d, core_d=None):
    r = s2_lib.read_scene(it, mk_d, core_d)
    if not r or "error" in r: return r or {"error": "empty"}
    r.pop("_water", None); return r
def rec(it, r):
    p = it["properties"]
    return dict(date=p["datetime"][:10], sceneId=it["id"], areaKm2=r["areaKm2"], areaKm2_ndwi01=r["areaKm2_ndwi01"], validFraction=r["validFraction"], coreValidFraction=r["coreValidFraction"],
                cloudCover=round(p.get("eo:cloud_cover", -1), 2), boaOffsetApplied=r["boaOffsetApplied"], offsetSubtractedByUs=r["offsetSubtractedByUs"],
                processingBaseline=p.get("s2:processing_baseline"))
def series(id_):
    mk = mask_geom(id_); mk_d = mapping(mk); core_d = core_geom(id_); bb = list(mk.bounds)
    items = s2_lib.stac_search(bb, "2017-03-01", "2026-11-19")
    cand = pick_candidates(items, mk)
    print(id_, "items", len(items), "covering", len(cand), flush=True)
    months = {}
    for i in cand: months.setdefault(i["properties"]["datetime"][:7], []).append(i)
    sel = {}
    for m, l in months.items():
        for i in sorted(l, key=lambda i: i["properties"].get("eo:cloud_cover", 100))[:3]: sel[i["id"]] = (i, "monthly")
    bul_pairs = {}
    for b in BULLETINS:
        bd = dt.date.fromisoformat(b)
        near = sorted([i for i in cand if abs((dt.date.fromisoformat(i["properties"]["datetime"][:10]) - bd).days) <= 2],
                      key=lambda i: (abs((dt.date.fromisoformat(i["properties"]["datetime"][:10]) - bd).days), i["properties"].get("eo:cloud_cover", 100)))
        bul_pairs[b] = near
        for i in near: sel.setdefault(i["id"], (i, "bulletin"))
    print(id_, "scenes to read", len(sel), flush=True)
    t0 = time.time()
    with ThreadPoolExecutor(8) as ex:
        results = dict(zip(sel, ex.map(lambda k: measure(sel[k][0], mk_d, core_d), sel)))
    fails = [k for k, r in results.items() if "error" in r]
    ok = {k: rec(sel[k][0], r) for k, r in results.items() if "error" not in r and r["validFraction"] >= MIN_VALID and r["coreValidFraction"] >= MIN_VALID}
    # monthly: keep up to 2 passing, lowest cloud
    keep = set()
    for m, l in months.items():
        c = [k for k in (i["id"] for i in sorted(l, key=lambda i: i["properties"].get("eo:cloud_cover", 100))[:3]) if k in ok]
        keep.update(c[:2])
    pairs = []
    for b, near in bul_pairs.items():
        for i in near:
            if i["id"] in ok:
                keep.add(i["id"]); pairs.append(dict(id=id_, bulletinDate=b, sceneDate=ok[i["id"]]["date"], areaKm2=ok[i["id"]]["areaKm2"], sceneId=i["id"],
                                                      validFraction=ok[i["id"]]["validFraction"])); break
    ser = sorted((ok[k] for k in keep), key=lambda r: (r["date"], r["sceneId"]))
    json.dump(ser, open(f"{OUT}{id_}-series.json", "w"), indent=1)
    json.dump(pairs, open(f"/tmp/pairs_{id_}.json", "w"))
    json.dump(dict(failed=fails, errors={k: results[k]["error"] for k in fails}, nRead=len(sel), nRejectedValid=sum(1 for k, r in results.items() if "error" not in r and k not in ok),
                   seconds=round(time.time() - t0)), open(f"/tmp/stats_{id_}.json", "w"))
    print(id_, "series", len(ser), "pairs", len(pairs), "failed", len(fails), "rejected(valid<0.9)", sum(1 for k, r in results.items() if "error" not in r and k not in ok), flush=True)
if __name__ == "__main__":
    if sys.argv[1] == "masks": build_masks()
    elif sys.argv[1] == "series":
        for i in sys.argv[2:]: series(i)
    elif sys.argv[1] == "pairs":
        allp = [p for i in IDS for p in json.load(open(f"/tmp/pairs_{i}.json"))]
        json.dump(allp, open(f"{OUT}bulletin-date-areas.json", "w"), indent=1); print(len(allp))
