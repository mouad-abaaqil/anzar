"""Turn water-frequency maps into polygons: NDWI max-extent union; compare with OSM outline; write final masks."""
import json, sys, numpy as np
from affine import Affine
from rasterio.features import shapes
from scipy import ndimage as ndi
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, transform
from pyproj import Transformer
OUT = "/Users/mouad/Developer/SRMSM/platform/data-raw/satellite/"
DAMPT = {"abdelmoumen": (-9.1987, 30.6754)}  # Nominatim dam way 289868587
OSM = {"youssef-ben-tachfine": "relation/1354186", "moulay-abdellah": "relation/5961856", "aoulouz": "way/26349903"}
def run(id_, minfreq=2):
    z = np.load(f"/tmp/freq_{id_}.npz", allow_pickle=True)
    W, V, tr, crs = z["W"], z["V"], Affine(*z["tr"]), str(z["crs"])
    n = len(z["dates"])
    wet = (W >= minfreq) & (V >= 3)   # max extent: union of pixels wet in >=2 clear scenes
    wet = ndi.binary_closing(wet, iterations=2); wet = ndi.binary_opening(wet, iterations=1)
    lab, k = ndi.label(wet)
    sizes = ndi.sum(wet, lab, range(1, k + 1))
    to_utm = Transformer.from_crs(4326, crs, always_xy=True).transform
    osmp = None
    try:
        osmp = shape(json.load(open(f"/tmp/osmraw_{id_}.geojson"))["features"][0]["geometry"]); osmp_u = transform(to_utm, osmp)
    except Exception: osmp_u = None
    comps = []
    for l in range(1, k + 1):
        if sizes[l - 1] < 300: continue   # < 3 ha
        m = (lab == l).astype("uint8")
        g = unary_union([shape(s) for s, v in shapes(m, mask=m.astype(bool), transform=tr) if v == 1])
        comps.append((l, sizes[l - 1] * 100 / 1e6, g))
    comps.sort(key=lambda c: -c[1])
    print(id_, "scenes", n, "components(km2)", [round(c[1], 2) for c in comps[:6]])
    if osmp_u is not None:
        keep = [c for c in comps if c[2].intersects(osmp_u)]
    else:
        pt = transform(to_utm, Point(*DAMPT[id_])).buffer(4000)
        keep = [c for c in comps if c[2].intersects(pt) and c[1] > 0.3]
    ndwi_u = unary_union([c[2] for c in keep]); ndwi_km2 = ndwi_u.area / 1e6
    res = dict(id=id_, nScenesForExtent=n, ndwiExtentKm2=round(ndwi_km2, 3), crs=crs)
    if osmp_u is not None:
        res["osmKm2"] = round(osmp_u.area / 1e6, 3); res["osm"] = OSM[id_]
        res["ndwiInsideOsmKm2"] = round(ndwi_u.intersection(osmp_u).area / 1e6, 3)
        res["ndwiOutsideOsmKm2"] = round(ndwi_u.difference(osmp_u).area / 1e6, 3)
        res["osmOutside300mBufferKm2"] = round(ndwi_u.difference(osmp_u.buffer(300)).area / 1e6, 3)
    print(json.dumps(res))
    return ndwi_u, osmp_u, res, crs
if __name__ == "__main__":
    for id_ in sys.argv[1:]:
        ndwi_u, osmp_u, res, crs = run(id_)
        to_ll = Transformer.from_crs(crs, 4326, always_xy=True).transform
        json.dump(dict(ndwi=mapping(transform(to_ll, ndwi_u)), osm=mapping(transform(to_ll, osmp_u)) if osmp_u is not None else None, res=res), open(f"/tmp/derived_{id_}.json", "w"))
