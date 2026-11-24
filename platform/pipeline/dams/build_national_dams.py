#!/usr/bin/env python3
"""Collecte et fusion d'un jeu OUVERT des barrages du Maroc (toutes regions).

Sources (lues a l'execution, jamais inventees) :
  - OpenStreetMap via Overpass (ODbL) : coordonnees, noms, tags
  - Wikidata SPARQL (CC0) : coordonnees, cours d'eau (P206), capacite (P2234, avec unite)
  - Wikipedia fr "Barrages du Maroc" (CC BY-SA 4.0) : annee, hauteur, capacite (Mm3), fonction ; SANS coordonnees

Regles : une coordonnee vient uniquement d'OSM ou de Wikidata ; une ligne Wikipedia sans correspondance
non ambigue n'a jamais de coordonnee (elle va dans national-dams-unlocated.json).
Stdlib uniquement. Usage : python3 build_national_dams.py [--offline | --reuse]  (--offline relit data-raw/dams/raw/ ; --reuse ne retelecharge que les fichiers absents)
"""
import json, sys, re, math, time, unicodedata, difflib, urllib.request, urllib.parse, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # platform/
RAW = ROOT / "data-raw" / "dams" / "raw"
OUT = ROOT / "data-raw" / "dams"
PUB = ROOT / "public" / "data"
UA = "anzar-open-data-research/0.1 (prototype independant; collecte ponctuelle)"
OFFLINE = "--offline" in sys.argv
REUSE = "--reuse" in sys.argv   # reutilise les fichiers deja presents dans raw/, ne telecharge que les manquants
READ_DATE = datetime.date.today().isoformat()
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter"]
# bbox couvrant toute l'emprise de morocco-regions.geojson (sud, ouest, nord, est) ; filtre ensuite par point-dans-polygone
BBOX = (20.7, -17.2, 36.0, -0.9)

def http(url, data=None, headers=None, timeout=200):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def cached(name, fetch):
    RAW.mkdir(parents=True, exist_ok=True)
    p = RAW / name
    if OFFLINE or (REUSE and p.exists()):
        return json.loads(p.read_text())
    d = fetch()
    p.write_text(json.dumps(d, ensure_ascii=False))
    return d

# ---------------------------------------------------------------- OSM
def fetch_osm():
    s, w, n, e = BBOX
    q = '[out:json][timeout:180];(nwr["waterway"="dam"](%s,%s,%s,%s);nwr["man_made"="dam"](%s,%s,%s,%s););out center tags;' % (s, w, n, e, s, w, n, e)
    log = []
    for ep in OVERPASS:
        for attempt in range(1):
            try:
                d = json.loads(http(ep, urllib.parse.urlencode({"data": q}).encode(), timeout=200 if ep == OVERPASS[0] else 120))
                d["_endpoint"] = ep; d["_attempts"] = log
                return d
            except Exception as ex:
                log.append({"endpoint": ep, "error": str(ex)[:120]}); time.sleep(5)
    raise SystemExit("Overpass indisponible : " + json.dumps(log))

# ---------------------------------------------------------------- Wikidata
WDQ = """SELECT ?d ?dLabel ?c ?v ?uLabel ?riv ?rivLabel ?inc WHERE {
 VALUES ?ctry { wd:Q1028 wd:Q6250 } ?d wdt:P17 ?ctry. ?d wdt:P31/wdt:P279* wd:Q12323.
 OPTIONAL{?d wdt:P625 ?c} OPTIONAL{?d wdt:P206 ?riv} OPTIONAL{?d wdt:P571 ?inc}
 OPTIONAL{?d p:P2234 ?st. ?st psv:P2234 ?nv. ?nv wikibase:quantityAmount ?v; wikibase:quantityUnit ?u}
 SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en,ar". } }"""
def fetch_wd():
    for i in range(5):
        try:
            url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": WDQ})
            return json.loads(http(url, headers={"Accept": "application/sparql-results+json"}, timeout=120))
        except Exception as ex:
            time.sleep(65)   # WDQS limite parfois a 1 requete par minute (HTTP 429)
    raise SystemExit("Wikidata indisponible")

# ---------------------------------------------------------------- Wikipedia
def fetch_wp():
    url = "https://fr.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "prop": "revisions", "rvprop": "ids|timestamp|content",
          "rvslots": "main", "titles": "Barrages du Maroc", "format": "json", "formatversion": "2"})
    return json.loads(http(url, timeout=60))

def clean(s):
    s = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", s)
    return re.sub(r"<[^>]+>|'''|''", "", s).strip()

def parse_wp(d):
    rev = d["query"]["pages"][0]["revisions"][0]
    t = rev["slots"]["main"]["content"]
    i = t.index("{|"); e = t.index("|}", i)
    rows = []
    for r in t[i:e].split("\n|-")[2:]:
        c = [clean(l[1:]) for l in r.split("\n") if l.startswith("|")]
        if len(c) < 4: continue
        year = re.match(r"\d{4}", c[1]); cap = re.sub(r"[^\d,.]", "", c[3]).replace(",", ".")
        h = re.sub(r"[^\d,.]", "", c[2]).replace(",", ".").strip(".")
        rows.append({"name": c[0].title() if c[0].isupper() else c[0], "yearBuilt": int(year.group()) if year else None,
                     "heightM": float(h) if h else None, "capacityMm3": float(cap) if cap else None,
                     "purposeCodes": c[4] if len(c) > 4 else None})
    return rows, rev

# ---------------------------------------------------------------- noms
GENERIC = {"barrage", "dam", "lac", "collinaire", "barrages", "reservoir", "retenue", "سد", "digue", "bassin"}
def strip_acc(s): return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")
def norm(s):
    s = strip_acc(s).lower().replace("’", "'")
    s = re.sub(r"\b1er\b|\bpremier\b", "i", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = [t for t in s.split() if t not in {"barrage", "dam", "de", "du", "d", "el", "al", "l", "ben", "bin", "ibn", "oued", "of", "the"}]
    s = " ".join(toks)
    return s.replace("ou", "o").replace("aa", "a").replace("ee", "i").replace("y", "i").replace("kh", "k").replace("ch", "c")
AR = re.compile(r"[؀-ۿ]")
def split_names(tags):
    fr = tags.get("name:fr") or tags.get("name:en"); nm = tags.get("name", ""); ar = tags.get("name:ar")
    if not ar and AR.search(nm): ar = AR.sub("", "") or " ".join(w for w in nm.split() if AR.search(w))
    lat = fr or " ".join(w for w in nm.split() if not AR.search(w)).strip()
    return (lat or None), (ar or None)
def is_generic(name):
    if not name: return True
    toks = [t for t in re.split(r"\W+", strip_acc(name).lower()) if t]
    return all(t in GENERIC for t in toks) or "collinaire" in toks

# ---------------------------------------------------------------- geo
def hav(a, b):
    R = 6371.0088; p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1] - a[1]); dp = p2 - p1
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))
def ring_has(ring, x, y):
    ins = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]; xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def poly_has(poly, x, y):
    return ring_has(poly[0], x, y) and not any(ring_has(h, x, y) for h in poly[1:])
def region_of(feats, lat, lon):
    for f in feats:
        g = f["geometry"]; polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        if any(poly_has(p, lon, lat) for p in polys): return f["properties"]["id"]
    return None

BASIN_KW = [("sebou", "Sebou"), ("inaouen", "Sebou"), ("ouergha", "Sebou"), ("moulouya", "Moulouya"),
            ("oum er", "Oum Er-Rbia"), ("oum-er", "Oum Er-Rbia"), ("loukkos", "Loukkos"), ("bouregreg", "Bouregreg"),
            ("tensift", "Tensift"), ("souss", "Souss-Massa"), ("massa", "Souss-Massa"), ("draa", "Drâa-Oued Noun"),
            ("ziz", "Guir-Ziz-Ghriss"), ("guir", "Guir-Ziz-Ghriss"), ("ghriss", "Guir-Ziz-Ghriss")]
def basin_of(rivers, bulletin_basins):
    hits = set()
    for r in rivers:
        n = strip_acc(r).lower()
        for kw, b in BASIN_KW:
            if kw in n and b in bulletin_basins: hits.add(b)
    return (hits.pop(), "river-keyword") if len(hits) == 1 else (None, None)

def slug(s): return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", strip_acc(s).lower())).strip("-")

# ---------------------------------------------------------------- main
def main():
    osm = cached("osm-overpass.json", fetch_osm)
    wd = cached("wikidata-sparql.json", fetch_wd)
    wp = cached("wikipedia-barrages-du-maroc.json", fetch_wp)
    osm_ts = osm["osm3s"]["timestamp_osm_base"]
    feats = json.loads((PUB / "morocco-regions.geojson").read_text())["features"]
    bulletin = {b["name"] for b in json.loads((PUB / "national-bulletin.json").read_text())["basins"]}
    wp_rows, rev = parse_wp(wp)

    # --- OSM : elements nommes non generiques
    osm_items = []; osm_total = len(osm["elements"]); osm_unnamed = 0; osm_generic = 0
    for el in osm["elements"]:
        tg = el.get("tags", {}); la = el.get("lat") or (el.get("center") or {}).get("lat"); lo = el.get("lon") or (el.get("center") or {}).get("lon")
        if la is None: continue
        fr, ar = split_names(tg)
        if not (fr or ar): osm_unnamed += 1; continue
        if is_generic(fr) and not ar or (fr and is_generic(fr) and ar and not AR.search(ar)): osm_generic += 1; continue
        if is_generic(fr) and ar is None: osm_generic += 1; continue
        osm_items.append({"name": fr or ar, "nameAr": ar, "lat": la, "lon": lo, "wikidata": tg.get("wikidata"),
                          "url": "https://www.openstreetmap.org/%s/%s" % (el["type"], el["id"]), "tags": tg})
    # dedupe OSM-OSM : meme wikidata, ou meme nom normalise a < 3 km
    merged = []
    for it in osm_items:
        for m in merged:
            same = (it["wikidata"] and it["wikidata"] == m["wikidata"]) or (norm(it["name"]) == norm(m["name"]) and hav((it["lat"], it["lon"]), (m["lat"], m["lon"])) < 3)
            if same:
                m["osmUrls"].append(it["url"]); m["nameAr"] = m["nameAr"] or it["nameAr"]; m["wikidata"] = m["wikidata"] or it["wikidata"]
                m["tags"] = {**it["tags"], **m["tags"]}; break
        else:
            merged.append({**it, "osmUrls": [it["url"]], "src": {"osm"}, "osmCoord": (it["lat"], it["lon"]), "wdCoord": None, "rivers": set(), "wd": None})
    # --- Wikidata
    wdm = {}
    for b in wd["results"]["bindings"]:
        q = b["d"]["value"].rsplit("/", 1)[-1]; e = wdm.setdefault(q, {"qid": q, "name": b["dLabel"]["value"], "coord": None, "rivers": set(), "cap": None, "inc": None})
        if "c" in b:
            m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", b["c"]["value"])
            if m: e["coord"] = (float(m.group(2)), float(m.group(1)))
        if "rivLabel" in b: e["rivers"].add(b["rivLabel"]["value"])
        if "inc" in b: e["inc"] = int(b["inc"]["value"][:4]) if re.match(r"\d{4}", b["inc"]["value"]) else None
        if "v" in b and "uLabel" in b:
            u = b["uLabel"]["value"].lower(); v = float(b["v"]["value"])
            if u in ("cubic metre", "mètre cube", "cubic meter"): e["cap"] = v / 1e6
            elif "million" in u and ("cubic" in u or "cube" in u): e["cap"] = v
            if e["cap"] is not None and e["cap"] < 0.01: e["cap"] = None; e["capDropped"] = v   # valeur implausible (erreur d unite probable), ecartee
    wd_unplaced = 0
    for q, e in wdm.items():
        if not e["coord"]: wd_unplaced += 1; continue
        if re.fullmatch(r"Q\d+", e["name"]): continue   # pas de libelle
        qn = norm(e["name"]); best = None
        for m in merged:
            if m["wikidata"] == q: best = m; break
            if m["osmCoord"] and m["wd"] is None and hav(m["osmCoord"], e["coord"]) < 5:
                r_ = difflib.SequenceMatcher(None, qn, norm(m["name"])).ratio()
                if r_ >= 0.75 and (best is None or r_ > best[0]): best = (r_, m)
        if isinstance(best, tuple): best = best[1]
        for m in ([best] if best else []):
            if True:
                m["wd"] = e; m["wdCoord"] = e["coord"]; m["rivers"] |= e["rivers"]; m["src"].add("wikidata"); m["wikidata"] = q; break
        else:
            merged.append({"name": e["name"], "nameAr": None, "lat": e["coord"][0], "lon": e["coord"][1], "wikidata": q, "osmUrls": [], "tags": {},
                           "src": {"wikidata"}, "osmCoord": None, "wdCoord": e["coord"], "rivers": set(e["rivers"]), "wd": e})
    # --- Wikipedia : jointure par nom normalise (flou strict, ambigu = non joint)
    for m in merged: m["_k"] = norm(m["name"]); m["wp"] = None
    unlocated = []; ambiguous = []; claimed = {}
    for row in wp_rows:
        k = norm(row["name"]); sc = sorted(((difflib.SequenceMatcher(None, k, m["_k"]).ratio(), i) for i, m in enumerate(merged)), reverse=True)
        best = sc[0] if sc else (0, -1); second = sc[1][0] if len(sc) > 1 else 0
        exact = [i for i, m in enumerate(merged) if m["_k"] == k and i not in claimed]
        if len(exact) == 1: best, second = (1.0, exact[0]), 0
        if best[0] >= 0.88 and best[0] - second >= 0.05 and best[1] not in claimed:
            claimed[best[1]] = row; merged[best[1]]["wp"] = row; merged[best[1]]["wpScore"] = round(best[0], 3)
        elif best[0] >= 0.88:
            ambiguous.append({**row, "reason": "match ambigu ou deja pris", "bestScore": round(best[0], 3), "candidate": merged[best[1]]["name"]})
        else:
            unlocated.append({**row, "reason": "aucune correspondance OSM/Wikidata (meilleur score %.2f)" % best[0]})

    # --- sortie
    out = []; used = set(); no_region = []; notes_conflict = []
    for m in merged:
        lat, lon = m["osmCoord"] or m["wdCoord"]; csrc = "osm" if m["osmCoord"] else "wikidata"
        reg = region_of(feats, lat, lon)
        if reg is None: no_region.append({"name": m["name"], "lat": lat, "lon": lon, "url": (m["osmUrls"] or [None])[0]}); continue
        wp_ = m["wp"]; cap = None; capsrc = None
        disp = wp_["name"] if wp_ else (m["tags"].get("name:fr") or " ".join(w for w in m["name"].split() if not AR.search(w)) or m["name"])
        if wp_ and wp_["capacityMm3"] is not None: cap, capsrc = wp_["capacityMm3"], "wikipedia"
        # capacite Wikidata jamais publiee : valeurs aberrantes constatees (Bin el Ouidane 0,365 Mm3), usage limite a la detection de conflits
        if m["wd"] and m["wd"]["cap"] and wp_ and wp_["capacityMm3"] and abs(m["wd"]["cap"] - wp_["capacityMm3"]) / wp_["capacityMm3"] > 0.1:
            notes_conflict.append({"name": m["name"], "wikipediaMm3": wp_["capacityMm3"], "wikidataMm3": round(m["wd"]["cap"], 3)})
        basin, bm = basin_of(m["rivers"], bulletin)
        sid = slug(wp_["name"] if wp_ else m["name"]); n = 1; base = sid
        while sid in used: n += 1; sid = "%s-%d" % (base, n)
        used.add(sid)
        srcs = [{"name": "OpenStreetMap (Overpass, base du %s)" % osm_ts, "url": u, "readDate": READ_DATE} for u in m["osmUrls"][:3]]
        if m["wikidata"]: srcs.append({"name": "Wikidata", "url": "https://www.wikidata.org/wiki/" + m["wikidata"], "readDate": READ_DATE})
        if wp_: srcs.append({"name": "Wikipedia fr, Barrages du Maroc (oldid %s)" % rev["revid"], "url": "https://fr.wikipedia.org/w/index.php?title=Barrages_du_Maroc&oldid=%s" % rev["revid"], "readDate": READ_DATE})
        rec = {"id": sid, "name": disp, "lat": round(lat, 6), "lon": round(lon, 6), "regionId": reg, "basin": basin, "river": sorted(m["rivers"])[0] if m["rivers"] else None,
               "capacityMm3": cap, "capacityMm3Source": capsrc, "coordSource": csrc, "sources": srcs,
               "license": "Coordonnees : OpenStreetMap (c) contributeurs, ODbL 1.0 ; Wikidata CC0 ; Wikipedia fr CC BY-SA 4.0 (attribution requise)"}
        if m["nameAr"]: rec["nameAr"] = m["nameAr"]
        if bm: rec["basinMethod"] = bm
        yb = (wp_ or {}).get("yearBuilt") or (m["wd"] or {}).get("inc")
        if yb: rec["yearBuilt"] = yb
        if wp_ and wp_.get("purposeCodes"): rec["purpose"] = wp_["purposeCodes"]
        if wp_: rec["heightM"] = wp_["heightM"]; rec["wikipediaMatch"] = {"row": wp_["name"], "score": m["wpScore"]}
        out.append(rec)
    out.sort(key=lambda r: (r["regionId"], r["name"]))
    (OUT / "national-dams.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    (OUT / "national-dams-unlocated.json").write_text(json.dumps({"note": "Lignes Wikipedia sans coordonnee verifiable : jamais placees sur la carte.", "unlocated": unlocated, "ambiguous": ambiguous, "outsideAllRegions": no_region}, ensure_ascii=False, indent=1))

    # --- validation Souss-Massa (les 9 barrages de region.json)
    reg_json = json.loads((PUB / "region.json").read_text())
    val = []
    for f in reg_json["facilities"]:
        if f.get("kind") != "dam": continue
        ref = (f["coordinates"][1], f["coordinates"][0]); k = norm(f["name"])
        cands = sorted(((difflib.SequenceMatcher(None, k, m["_k"]).ratio(), m) for m in merged), key=lambda x: -x[0])[:1]
        row = {"name": f["name"], "refCoord": ref, "refSource": f.get("locationUrl")}
        if cands and cands[0][0] >= 0.8:
            m = cands[0][1]; row["matched"] = m["name"]; row["score"] = round(cands[0][0], 3)
            row["locationUrlInOsmUrls"] = f.get("locationUrl") in m["osmUrls"]
            row["osmKm"] = round(hav(ref, m["osmCoord"]), 2) if m["osmCoord"] else None
            row["wikidataKm"] = round(hav(ref, m["wdCoord"]), 2) if m["wdCoord"] else None
            row["note"] = "reference region.json = point OSM : l'ecart OSM est circulaire, seul wikidataKm est independant"
        else: row["matched"] = None
        val.append(row)
    (OUT / "validation-souss-massa.json").write_text(json.dumps(val, ensure_ascii=False, indent=1))

    by_reg = {}
    for r in out: by_reg[r["regionId"]] = by_reg.get(r["regionId"], 0) + 1
    meta = {"readDate": READ_DATE, "overpassEndpoint": osm.get("_endpoint"), "overpassAttempts": osm.get("_attempts"), "osmBaseTimestamp": osm_ts,
            "osmElements": osm_total, "osmUnnamed": osm_unnamed, "osmGeneric": osm_generic, "osmNamedMerged": len(osm_items),
            "wikidataItems": len(wdm), "wikidataWithoutCoord": wd_unplaced, "wikipediaRows": len(wp_rows), "wikipediaOldid": rev["revid"], "wikipediaRevTimestamp": rev["timestamp"],
            "records": len(out), "withCapacity": sum(1 for r in out if r["capacityMm3"] is not None), "withWikipediaMatch": sum(1 for r in out if "wikipediaMatch" in r),
            "wikipediaUnlocated": len(unlocated), "wikipediaAmbiguous": len(ambiguous), "outsideAllRegions": len(no_region), "withBasin": sum(1 for r in out if r["basin"]),
            "byRegion": by_reg, "capacityConflicts": notes_conflict}
    (OUT / "national-dams.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(json.dumps(meta, ensure_ascii=False, indent=1))

main()
