"""Sentinel-2 L2A window reads from Earth Search COGs; water area within a mask."""
import json, time, os
import numpy as np, requests, rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.warp import transform_geom, transform_bounds
from shapely.geometry import shape, mapping
UA = {"User-Agent": "water-research/1.0"}
STAC = "https://earth-search.aws.element84.com/v1/search"
os.environ.update(GDAL_HTTP_USERAGENT="water-research/1.0", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                  CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="2",
                  GDAL_HTTP_TIMEOUT="60", VSI_CACHE="TRUE")
def _post(body, tries=6):
    for k in range(tries):
        try:
            r = requests.post(STAC, json=body, headers=UA, timeout=60); r.raise_for_status(); return r.json()
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(3 * (k + 1))
def _stac_range(bbox, start, end, extra=None):
    body = {"collections": ["sentinel-2-l2a"], "bbox": bbox, "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z", "limit": 100}
    items = []
    while True:
        j = _post(body); items += j["features"]
        nxt = [l for l in j.get("links", []) if l["rel"] == "next"]
        if not nxt or not j["features"]: return items
        body = dict(body); body.update(nxt[0].get("body") or {})
def stac_search(bbox, start, end):
    """Search in <=3-month chunks (large single queries return 502 intermittently)."""
    import datetime as dt
    s, e = dt.date.fromisoformat(start), dt.date.fromisoformat(end); out = {}
    while s <= e:
        m = s.month + 3; y = s.year + (m - 1) // 12; m = (m - 1) % 12 + 1
        nxt = dt.date(y, m, 1); ce = min(e, nxt - dt.timedelta(days=1))
        for it in _stac_range(bbox, s.isoformat(), ce.isoformat()): out[it["id"]] = it
        s = nxt
    return list(out.values())
def read_scene(item, mask_geom_wgs84, core_geom_wgs84=None, retries=3):
    """Return dict with area stats or None. mask_geom_wgs84: GeoJSON geometry dict."""
    a = item["assets"]; p = item["properties"]
    err = None
    for k in range(retries):
        try:
            with rasterio.Env():
                with rasterio.open(a["green"]["href"]) as g:
                    crs = g.crs
                    geom = transform_geom("EPSG:4326", crs, mask_geom_wgs84)
                    bx = shape(geom).bounds
                    win = from_bounds(*bx, transform=g.transform).round_offsets().round_lengths()
                    win = win.intersection(rasterio.windows.Window(0, 0, g.width, g.height))
                    tr = g.window_transform(win)
                    green = g.read(1, window=win).astype("float32")
                    shp = green.shape
                with rasterio.open(a["nir"]["href"]) as n:
                    nir = n.read(1, window=win, out_shape=shp).astype("float32")
                with rasterio.open(a["scl"]["href"]) as s:
                    sw = from_bounds(*_bounds(tr, shp), transform=s.transform)
                    scl = s.read(1, window=sw, out_shape=shp, resampling=Resampling.nearest, boundless=True, fill_value=0)
            m = rasterize([(geom, 1)], out_shape=shp, transform=tr, fill=0, dtype="uint8").astype(bool)
            off = p.get("earthsearch:boa_offset_applied")
            try: pb = float(p.get("s2:processing_baseline", "0"))
            except Exception: pb = 0.0
            # +1000 DN offset exists only in baseline >= 04.00 data; Earth Search flags True when it already removed it.
            # Pre-04.00 items carry flag False but have NO offset, so subtracting there would be wrong.
            # Empirical guard: a real +1000 offset puts EVERY pixel >= 1000 DN (min reflectance 0), so the 0.5th percentile of NIR
            # DN must be >= 1000. Checked scenes with flag False (2022-2025) had NIR minima of ~25-150 DN -> no offset present.
            pos = nir[nir > 0]
            has_off = bool(pos.size and np.percentile(pos, 0.5) >= 1000)
            sub = 1000.0 if (off is False and pb >= 4.0 and has_off) else 0.0
            gr = np.clip(green - sub, 0, None) / 10000.0; nr = np.clip(nir - sub, 0, None) / 10000.0
            den = gr + nr
            ndwi = np.where(den > 0, (gr - nr) / np.where(den > 0, den, 1), np.nan)
            valid = m & np.isin(scl, (4, 5, 6, 7)) & (green > 0) & (nir > 0)
            cm = rasterize([(transform_geom("EPSG:4326", crs, core_geom_wgs84), 1)], out_shape=shp, transform=tr, fill=0, dtype="uint8").astype(bool) if core_geom_wgs84 else m
            cvf = float((valid & cm).sum()) / max(1, int(cm.sum()))
            nm = int(m.sum())
            if nm == 0: return None
            vf = float(valid.sum()) / nm
            w0 = valid & (ndwi > 0); w1 = valid & (ndwi > 0.1)
            return dict(validFraction=round(vf, 4), coreValidFraction=round(cvf, 4), pix_valid=int(valid.sum()), pix_mask=nm,
                        areaKm2=round(float(w0.sum()) * 1e-4, 4), areaKm2_ndwi01=round(float(w1.sum()) * 1e-4, 4),
                        boaOffsetApplied=off, offsetSubtractedByUs=bool(sub), _water=(w0, valid, tr, str(crs)) )
        except Exception as e:
            err = e; time.sleep(2 * (k + 1))
    return {"error": str(err)}
def _bounds(tr, shp):
    return (tr.c, tr.f + tr.e * shp[0], tr.c + tr.a * shp[1], tr.f)
