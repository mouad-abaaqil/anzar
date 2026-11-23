"""Fetch OSM reservoir outlines near each dam and save GeoJSON + buffered mask."""
import json, time, sys, requests
from shapely.geometry import Polygon, MultiPolygon, mapping, shape
from shapely.ops import unary_union, transform
from pyproj import Transformer
UA = {"User-Agent": "water-research/1.0"}
MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
DAMS = {  # approx centres from Nominatim search (verified by overpass result, not trusted blindly)
 "youssef-ben-tachfine": (29.82, -9.48), "abdelmoumen": (30.675, -9.20),
 "aoulouz": (30.69, -8.14), "moulay-abdellah": (30.77, -9.67)}
OUT = "/Users/mouad/Developer/SRMSM/platform/data-raw/satellite/"
def q(lat, lon, r=6000):
    return f"""[out:json][timeout:90];(
 way(around:{r},{lat},{lon})["natural"="water"];
 relation(around:{r},{lat},{lon})["natural"="water"];
 way(around:{r},{lat},{lon})["water"="reservoir"];
 relation(around:{r},{lat},{lon})["water"="reservoir"];
);out geom tags;"""
def run(query):
    for m in MIRRORS * 3:
        try:
            r = requests.post(m, data={"data": query}, headers=UA, timeout=100)
            if r.status_code == 200: return r.json()
            print(m, r.status_code, file=sys.stderr)
        except Exception as e: print(m, e, file=sys.stderr)
        time.sleep(8)
    raise SystemExit("overpass failed")
def geom(el):
    if el["type"] == "way":
        pts = [(p["lon"], p["lat"]) for p in el.get("geometry", [])]
        return Polygon(pts) if len(pts) >= 4 else None
    outers = []; inners = []
    for mb in el.get("members", []):
        pts = [(p["lon"], p["lat"]) for p in mb.get("geometry", [])]
        if len(pts) >= 4 and pts[0] == pts[-1]:
            (outers if mb["role"] == "outer" else inners).append(Polygon(pts))
    if not outers: return None
    g = unary_union(outers)
    for i in inners: g = g.difference(i)
    return g
if __name__ == "__main__":
    res = {}
    for id_, (lat, lon) in DAMS.items():
        data = run(q(lat, lon)); cands = []
        for el in data["elements"]:
            g = geom(el)
            if g is None or not g.is_valid and not (g := g.buffer(0)): continue
            c = g.centroid
            utm = Transformer.from_crs(4326, 32629, always_xy=True)
            a = transform(utm.transform, g).area / 1e6
            cands.append(dict(osm=f"{el['type']}/{el['id']}", name=el.get("tags", {}).get("name"), tags=el.get("tags", {}), areaKm2=round(a, 3), lat=round(c.y, 5), lon=round(c.x, 5)))
        cands.sort(key=lambda c: -c["areaKm2"])
        print("==", id_, len(cands))
        for c in cands[:6]: print("  ", c["osm"], c["name"], c["areaKm2"], c["lat"], c["lon"], {k: v for k, v in c["tags"].items() if k in ("water", "natural", "landuse")})
        res[id_] = cands
        json.dump(data, open(f"/tmp/osm_{id_}.json", "w"))
        time.sleep(2)
