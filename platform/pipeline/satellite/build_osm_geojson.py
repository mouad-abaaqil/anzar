"""Build raw OSM polygon GeoJSON from cached Overpass JSON (/tmp) for dams where OSM has a usable outline."""
import json, sys
sys.path.insert(0, ".")
from osm_polygons import geom, OUT
from shapely.geometry import mapping
from shapely.ops import transform
from pyproj import Transformer
utm = Transformer.from_crs(4326, 32629, always_xy=True).transform
SRC = {"youssef-ben-tachfine": ("/tmp/q_1354186.json", 1354186), "moulay-abdellah": ("/tmp/q_5961856.json", 5961856),
       "aoulouz": ("/tmp/osm_aoulouz.json", 26349903)}
for id_, (f, oid) in SRC.items():
    d = json.load(open(f))
    el = [e for e in d["elements"] if e["id"] == oid][0]
    g = geom(el); g = g if g.is_valid else g.buffer(0)
    a = transform(utm, g).area / 1e6
    c = g.centroid
    print(id_, el["type"], oid, round(a, 3), "km2", round(c.y, 5), round(c.x, 5), g.geom_type, g.bounds)
    json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"id": id_, "osm": f"{el['type']}/{oid}", "role": "osm-outline", "areaKm2": round(a, 3)}, "geometry": mapping(g)}]}, open(f"/tmp/osmraw_{id_}.geojson", "w"))
