# 04 - Open geodata and a defensible method for reservoir decision support

Research date: 19 November 2026. Scope: Souss-Massa (ABHSM) dams, Morocco.

"Verified by fetch" means the page or file was retrieved in this session. "Not verified" means it was not retrieved, or the fetch failed, and the statement comes from background knowledge or from a search snippet. Nothing here is a pipeline route, a live reading, or an official ABHSM position.

---

## 1. Summary

- Global dam databases give coordinates and capacity for major reservoirs. None of the sources fetched here gives dead storage, which is required for usable storage.
- No open pipeline or conduit network for Souss-Massa was found. An OpenStreetMap query returned water-supply pipelines, but these are not a verified transmission network and cannot be used as hydraulic routes.
- Recommended indicators: usable storage, days of coverage, fill-rate trend, and a percentile against the same date in each dam's own history. Absolute fill % should not be used to compare dams.
- Pywr (GPLv3, Python, JSON or Python API) is a plausible server-side engine for a small node-and-capacity network, but this has not been tested.
- The first release should be a read-only comparison tool. It should not output "transfer X Mm³ from A to B" until the validation steps in section 6 are met.

---

## 2. Geodata inventory

| Dataset | URL | Licence (as found) | Format | Size | Version / date | Verified by fetch |
|---|---|---|---|---|---|---|
| GRanD (Global Reservoir and Dam Database) | https://www.globaldamwatch.org/grand | Not stated on page; disclaimer only ("provides these data without any warranty"). Check the download terms before use. | Not stated on page | Not stated | v1.3, 7,320 records (458 added in v1.3). Page says GRanD "is now superseded by the GDW database." | Yes (page text). Data file not downloaded. |
| GDW (Global Dam Watch) consensus database | https://www.globaldamwatch.org/database | CC BY (page: "distributed under a free CC BY license") | Download form; viewer at gdw-viewer.web.app. Format not stated. | Not stated | GDW v1, undated. 41,145 barrier locations, 35,295 reservoir polygons, cumulative storage 7,405 km³ (page). | Yes (page text). Data file not downloaded. |
| GDW dam directory | https://www.globaldamwatch.org/directory | Not stated | Not stated | Not stated | Not checked | Not verified |
| HydroLAKES | https://www.hydrosheds.org/products/hydrolakes | CC BY 4.0 (page) | Geodatabase and shapefile. Polygons 763 MB (gdb) / 820 MB (shp). Pour points 81 MB (gdb) / 79 MB (shp). | As listed | Downloads labelled v10 | Yes (page text) |
| HydroBASINS | https://www.hydrosheds.org/ | Not found on fetched pages. Terms are per product, and the product page was not retrieved. | Not stated | Not stated | Not stated | Not verified |
| HydroRIVERS | https://www.hydrosheds.org/ | Same as HydroBASINS | Not stated | Not stated | Not stated | Not verified |
| HydroSHEDS general terms | https://www.hydrosheds.org/terms-of-use | Site terms prohibit "commercial use or any resale or redistribution" for personal permission. Each downloaded product carries its own licence. Attribution is required. | n/a | n/a | Latest listed: HydroSHEDS v2 (first release covers the Americas) | Yes (page text) |
| OpenStreetMap, via Overpass | https://overpass-api.de/api/interpreter (502 on test); mirrors https://lz4.overpass-api.de/api/interpreter and https://maps.mail.ru/osm/tools/overpass/api/interpreter (200) | ODbL (standard OSM licence; not fetched this session) | JSON | 100 KB for the test query | OSM base timestamp 2026-11-19 14:14 UTC (maps.mail.ru) and 14:16 UTC (lz4 mirror). | Yes, live query (see section 3) |
| Copernicus DEM GLO-30 | https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model (ECONNREFUSED); https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM | Free licence. Redistribution to the public requires the attribution "provided under COPERNICUS by the European Union and ESA; all rights reserved." | GeoTIFF / DTED; 30 m; EGM2008 vertical reference (EPSG 3855). COG not mentioned on the page. | Not stated | Not stated | Yes (dataspace page). Download not tested; free registration is needed. |
| Mapterhorn | https://mapterhorn.com/ | Code BSD-3. Terrain data from "various open-data sources", listed at https://mapterhorn.com/attribution. The Copernicus lineage was not confirmed. | Terrain tiles; tile format not stated on the page. Data access page: https://mapterhorn.com/data-access | Not stated | Not stated | Yes (home page). Attribution and data-access pages not fetched. |
| geoBoundaries, Morocco ADM1 | https://www.geoboundaries.org/api/current/gbOpen/MAR/ADM1/ | API reports ODbL 1.0 for MAR ADM1 (boundary source: OpenStreetMap, Wambacher). The website says CC BY 4.0. These should be reconciled before use. | GeoJSON (GitHub release, commit 9469f09) | Not measured | Year represented 2017. Built 12 Dec 2023. | Yes, API returned 200 and JSON was parsed. File not downloaded. |
| geoBoundaries, Morocco ADM2 | https://www.geoboundaries.org/api/current/gbOpen/MAR/ADM2/ | Not parsed | Not parsed | Not measured | Not checked | API returned 200 only |
| ABHSM basin polygon | Not found. No public download was located in search. | Unknown | Unknown | Unknown | Unknown | Not verified |
| Overture Maps | https://docs.overturemaps.org/getting-data/ ; https://docs.overturemaps.org/attribution/ | Per theme (attribution page): Transportation, Base, Buildings and Divisions are ODbL. Places is mostly CDLA Permissive 2.0. Addresses varies by source. | Cloud GeoParquet; S3 at s3://overturemaps-us-west-2/release/... | Not measured | Example path uses release 2026-11-18.0. The page does not confirm that this is the latest release. | Yes (both pages). Data not downloaded. |

Notes on the datasets:

- GRanD and GDW store coordinates and capacity. Neither fetched page lists dead storage, and no per-record storage field was confirmed for GDW (only a cumulative total). The field list in each file must be inspected before relying on it.
- Dead storage (the volume below the lowest outlet, sometimes called minimum operating or "volume mort") must come from another source, probably ABHSM or DGH technical sheets for each dam. Not verified in this session. Without it, usable storage cannot be computed honestly.
- Capacity figures for the Souss-Massa system conflict in press reports. A 2021 article gives 731.4 Mm³ for eight main dams. A 2025 article gives more than 740 Mm³. A 2026 article gives about 16,762.5 Mm³ for the national system. These may cover different perimeters. The capacity used in the tool must be recorded with its source and date.

---

## 3. OpenStreetMap test query (Souss-Massa)

Bounding box: lat 30.2 to 30.9, lon -9.9 to -8.6 (covers Agadir, Taroudant and the Chtouka area).

Query (Overpass QL, run against two mirrors):

```
[out:json][timeout:90];
( way["man_made"="pipeline"](30.2,-9.9,30.9,-8.6);
  way["waterway"="canal"](30.2,-9.9,30.9,-8.6);
  way["man_made"="water_works"](30.2,-9.9,30.9,-8.6);
  node["man_made"="water_works"](30.2,-9.9,30.9,-8.6);
  node["waterway"="dam"](30.2,-9.9,30.9,-8.6);
  way["waterway"="dam"](30.2,-9.9,30.9,-8.6);
  node["waterway"="weir"](30.2,-9.9,30.9,-8.6); );
out tags center;
```

Results (counts only). Raw output is saved outside the repository in `/private/tmp/srmsm_research/`:

- Primary endpoint, overpass-api.de: HTTP 502. No data.
- kumi.systems endpoint: connection failed.
- lz4.overpass-api.de and maps.mail.ru mirrors: HTTP 200, 501 elements each, identical counts. The only difference is the OSM timestamp. No remark field, so the result does not appear truncated. Completeness was not checked against a second source.
- Pipelines (`man_made=pipeline`): 335 ways (327 with `substance=water`, 8 untagged).
- Canals (`waterway=canal`): 18 ways (1 named).
- Dam lines (`waterway=dam`): 148 ways (10 named). These may be embankment outlines and not reservoirs. Inspect before use.
- Water works (`man_made=water_works`): 0 nodes or ways.
- Standalone dam nodes: 0.
- Elements tagged `location=underground`: 69 (not split by type).

Interpretation: OSM contains a large number of pipeline segments in this area, but they are not documented as a network. They lack capacity, diameter, pressure class, direction and operator. They may include irrigation or local distribution. They cannot support a route, a capacity or a feasibility claim. The OSM data should only be used for context, and only with an ODbL attribution.

---

## 4. Methods: what can be computed honestly

All inputs must be sourced and dated. Each output must carry the source and date of each input.

### 4.1 Indicators

| Indicator | Formula | Inputs | Notes |
|---|---|---|---|
| Usable storage | U = S − D | S = stored volume (Mm³), D = dead storage (Mm³) | D must come from a documented source. If D is unknown, the output must be marked "not computable". Do not assume D = 0. |
| Days of coverage | C = U / Q | Q = sourced daily demand (Mm³/day) | Q is not published per dam in the sources found. A demand allocation must be sourced, dated and labelled. |
| Fill-rate trend | slope of S over the last n weeks (Mm³/week), or ΔS / Δt | dated series of S | Need a regular series. Gaps must be flagged, not interpolated silently. |
| Historical percentile | P = share of past values of S for dam i, on the same date ±k days, that are below the current S | multi-year series per dam | Requires a minimum record (e.g. 10 years, a design choice). Dams with shorter records get "insufficient history". |
| Surplus / deficit class | from P (e.g. P ≥ 67 = surplus, P ≤ 33 = deficit, otherwise normal) | P | Thresholds are a configurable design choice, not a scientific standard. Document them in the interface. |

Why the basin's own history is used: a dam at 40% of capacity may be in surplus for its climate and season, while a dam at 70% may be in deficit relative to its own history. Comparing each dam with its own same-date record gives a relative judgement that is more defensible than comparing fill percentages.

### 4.2 Why absolute fill % misleads across dams

- Capacity differs by orders of magnitude between reservoirs, so the same % represents very different volumes and days of supply.
- Dead storage is a larger share of gross capacity in some dams. Fill % of gross capacity overstates usable water in those dams.
- Purposes differ (drinking water, irrigation, hydropower, flood reservation). A flood-control reserve can make a high level operationally "low".
- Inflows are dominated by different sub-basins. A dam in a dry sub-basin can be lower than its neighbour for hydrological reasons, not operational ones.
- A single snapshot cannot distinguish a dam that is rising from one that is falling.

### 4.3 Geometry: what is honest and what is not

Computable from published data:

- Straight-line (great-circle) distance between two dam coordinates.
- Elevation difference between two dam crest or water-level elevations, taken from the DEM or from the dam record.

Not computable without conduit data:

- Pipeline length, route, pressure, pumping head, capacity, losses, energy use or cost.

These two geometric values must be labelled "straight-line, not a route". They show only that two dams are near each other, and can support a shortlist, not a feasibility decision.

### 4.4 Validation before any transfer recommendation

A recommendation such as "transfer X Mm³ from dam A to dam B" needs all of the following. None is met by the open data alone:

1. Dead storage and outlet levels for both dams, from the operator or a technical document.
2. Current stored volume and a dated series from an authoritative source, with the publisher's total reconciled against the rounded per-dam rows.
3. Demand and allocation data for both dams, including legal allocation rights and priorities.
4. Conduit data: route, diameter, capacity, pressure class, existing connections, pumping stations, and operator consent. Not available as open data.
5. Hydraulic model confirmation (steady or unsteady), including losses and energy.
6. Water quality compatibility of the source and destination water, from measured data with provenance.
7. A backtest on historical data showing the method's classifications were stable and sensible.
8. Review by the water operator or basin agency before any use in decisions.

---

## 5. Existing tools and open-source options

| Tool | Licence (as found) | Verified | Relevance |
|---|---|---|---|
| WEAP (SEI) | Commercial licence; free-of-charge terms for some non-profit or academic users (background knowledge). | Not verified. The fetch failed (ECONNRESET). | Full water-systems modelling. Heavy, and not open source. Suitable for a planning study, not an embedded tool. |
| RiverWare (CADSWES, University of Colorado) | Licence agreement required (licensing pages linked). The fetch did not give the terms or confirm open source. | Partly. Licence terms not retrieved. | Reservoir operations modelling. Not open source. |
| HEC-ResSim (US Army Corps of Engineers) | Distributed by USACE. Not verified. | Not verified. The fetch returned 404. | Reservoir simulation with storage zones. Useful reference for the storage-zone model. Not open source. |
| Pywr | GPLv3, per the repository LICENSE file (GPLv3, 29 June 2007). The README says "GPL version 1 or later", which conflicts with the LICENSE file. Resolve before relying on it. | Yes (LICENSE file and repository page). | Python library. Models are defined in a JSON document or through the Python API. Could run server-side as a library on a small network of nodes, links, storage and capacities. Version and release date not confirmed. |
| WRI Aqueduct | CC BY 4.0 | Yes. | Water-risk indices at basin or country scale. No reservoir-level storage. Useful as context, not as a storage source. |
| Morocco (ABHSM, Ministry of Equipment and Water) | Official weekly and daily communiqués. Found only through press reports in this session. No open dataset or portal confirmed. | Not verified directly. Press figures are inconsistent. | Primary authority for the storage data. Its publications must be obtained from the agency. Press reports are not a source of record. |

Pywr licence implications, for the developer to confirm with counsel: GPLv3 requires that distributed modified versions carry the licence. Running an unmodified copy on a server does not by itself count as distribution under GPLv3, but this should be checked against the planned deployment. AGPL would be needed to cover network use of a modified version, and GPLv3 does not.

Pywr feasibility (not yet tested): a minimal test would define an input node, a storage node with maximum and minimum volume (the minimum volume could hold dead storage), a demand node and a link. It would then run a short time series. Confirm the node names, parameters and version against the documentation before building on them.

---

## 6. Recommended minimal decision-support design

### 6.1 Inputs

- Dam register: ID, name, coordinates, source, capacity and its date, dead storage and its source, purpose, basin or sub-basin membership.
- Dated storage observations: value, date, publisher, URL, and retrieval date. Store the publisher's total alongside the per-dam rows.
- Demand or allocation per dam, labelled with source and year. Leave it empty when unknown.
- Optional geometry: straight-line distance and elevation difference between dams, labelled as such.
- Historical storage series for each dam, with a stated minimum length.

### 6.2 Outputs

- Per dam: usable storage (or "not computable"), days of coverage (if demand is sourced), fill-rate trend, percentile against the same date in its history, and a surplus / normal / deficit class.
- Data-quality flags: missing dead storage, short history, gap in the series, stale observation, conflicting capacity sources.
- For a selected deficit dam: a shortlist of neighbouring dams ranked by surplus percentile and straight-line distance. The list is labelled "candidates for further assessment, not feasible transfers".
- No transfer volumes, routes, costs or capacities.

### 6.3 Mandatory disclaimers (shown wherever outputs appear)

1. This tool is a decision-support aid for exploring data. It is not an operational instruction and not an official ABHSM product.
2. Storage values are from dated public sources and may be provisional. Check the date shown on every value.
3. Straight-line distances and elevation differences are not pipeline routes, and they say nothing about hydraulic feasibility.
4. Dead storage and demand values are shown only when sourced. Missing values mean the indicator is not computed.
5. Percentile classes depend on the historical record and on thresholds chosen for this tool.
6. Any transfer decision requires conduit, hydraulic, legal-allocation and operator validation (section 4.4).
7. The tool does not imply official commissioning or endorsement by any authority.

### 6.4 Build order

1. Data register with sources, dates and licences recorded (no computation yet).
2. Indicators and percentiles on a verified storage series, with a backtest.
3. Shortlist view with straight-line geometry, clearly labelled.
4. Only after conduit data is obtained, consider a Pywr network prototype. It should stay a separate experiment until validated.

---

## 7. Open items

- Obtain dead storage and capacity for each Souss-Massa dam from the ABHSM or DGH, with the document reference.
- Obtain the ABHSM weekly bulletin archive or a formal data request. The press figures are not a source of record.
- Confirm the GRanD and GDW download licences and file fields. Confirm the HydroBASINS and HydroRIVERS licences.
- Confirm the ABHSM basin boundary. Check the geoBoundaries licence conflict (CC BY 4.0 on the website, ODbL 1.0 in the API).
- Test Pywr's latest version, licence header and a three-node network.
- Retry the Copernicus DEM download and the WEAP and HEC-ResSim pages. They failed in this session.
- Inspect the 148 OSM `waterway=dam` ways before using them.
