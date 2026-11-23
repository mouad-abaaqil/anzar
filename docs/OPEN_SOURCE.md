# Cartography and open-source choices

Research checked 19 November 2026. This project uses an actual interactive geographic map with elevation tiles, not a decorative 3D illustration.

## Implemented map stack

| Component | Purpose | License / terms | Primary source |
| --- | --- | --- | --- |
| MapLibre GL JS (`maplibre-gl`) | WebGL map rendering, navigation, actual 3D terrain, selectable facilities | BSD-3-Clause; retain bundled copyright and license notices | https://github.com/maplibre/maplibre-gl-js and https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/ |
| OpenFreeMap public Liberty style | Vector basemap, roads, water and place labels | Commercial use allowed; public instance requires no API key and advertises no map-view/request limits. No SLA. Respect attribution to OpenFreeMap, OpenMapTiles and OpenStreetMap. | https://openfreemap.org/ and https://openfreemap.org/quick_start/ |
| Mapterhorn | Global 30 m elevation data used as a terrain mesh and hillshade | Project code BSD-3; terrain datasets have their own open-data terms. Attribution is included by the TileJSON and links to the full source list. | https://mapterhorn.com/ and https://mapterhorn.com/attribution/ |
| Lucide React (`lucide-react`) | Interface controls | ISC; retain dependency license notices | https://github.com/lucide-icons/lucide |

Endpoints:

```text
Basemap style: https://tiles.openfreemap.org/styles/liberty
Alternative dark style: https://tiles.openfreemap.org/styles/dark
Terrain TileJSON: https://tiles.mapterhorn.com/tilejson.json
Terrain individual tiles: https://tiles.mapterhorn.com/{z}/{x}/{y}.webp
```

Mapterhorn tiles are **Terrarium encoded, 512 px**. Do not decode them as Mapbox RGB. The implementation applies 1.3× vertical exaggeration to improve visibility at regional scale. This visual exaggeration is not a height measurement. The displayed 30 m resolution describes the global source grid, not positional certainty for individual facilities.

The basemap is vector cartography with real DEM relief; it is not satellite imagery. No satellite-provider entitlement, account or token is assumed. The map initially covers the Souss-Massa region and supports pan, zoom, pitch, bearing, a 2D view and site selection. Public tile services can fail or change terms. Before offering an uptime guarantee to paying customers, provide suitable contracted or self-hosted tile infrastructure. OpenFreeMap publishes its infrastructure for self-hosting. Preserve on-map attribution in every layout and screenshot.

HTTP checks on the research date returned status 200 and `Access-Control-Allow-Origin: *` for both OpenFreeMap style JSONs and Mapterhorn TileJSON when requested with a browser User-Agent and Origin. This confirms tested accessibility, not an uptime guarantee.

## Authoritative regional inventory

The Moroccan national open-data portal publishes ABHSM's dam list under ODbL:

- Dataset: https://data.gov.ma/data/fr/dataset/liste-des-barrages-dans-le-bassin-hydraulique-de-souss-massa
- CKAN metadata: https://data.gov.ma/data/api/3/action/package_show?id=liste-des-barrages-dans-le-bassin-hydraulique-de-souss-massa
- XLSX resource: https://data.gov.ma/data/fr/dataset/88d28afd-bf15-4c0e-a97e-25c050f6f256/resource/9f82d649-ddd9-4f7e-8a09-70122c2ca1eb/download/barrage_souss_massa.xlsx

Metadata says last modified 20 June 2023. The inspected XLSX contains nine dam point records and columns `FID`, `Type`, `nom`, `X`, `Y`. The coordinates are projected rather than longitude/latitude. The resource does not declare its CRS in the spreadsheet. Determine and document the source CRS before transforming them; never feed the raw X/Y into a WGS84 map. The second resource is described as `shp.xml`, but the downloaded 352-byte file is a point shapefile without accompanying `.prj`, `.shx` or `.dbf`. This inventory has no live dam-storage measurements or water-quality observations. The downloads tested successfully server-side; their responses did not expose CORS, so ingest them server-side or distribute a documented extracted snapshot rather than fetching them directly from a browser.

## Additional useful projects and datasets

- **deck.gl** (MIT, https://github.com/visgl/deck.gl): appropriate for later aggregation, large sensor collections and explicit flow/arc layers. Its MapboxOverlay supports MapLibre (https://deck.gl/docs/api-reference/mapbox/mapbox-overlay). It is unnecessary for the initial set of facility markers. A rendered arc must not imply a verified pipeline unless actual network geometry is available.
- **CesiumJS** (Apache-2.0, https://github.com/CesiumGS/cesium): useful for a future globe, photogrammetry or 3D Tiles digital twin. CesiumJS itself is open source, while Cesium ion services need a separate access token and terms (https://cesium.com/learn/cesiumjs/ref-doc/Ion.html). The MapLibre stack delivers regional terrain without creating an ion-account dependency.
- **Mapzen Terrain Tiles** (https://registry.opendata.aws/terrain-tiles/): alternative global bare-earth terrain. Terrarium PNG endpoint: `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png`, 256 px. Dataset-source terms vary and required credits are listed at https://github.com/tilezen/joerd/blob/master/docs/attribution.md. The regional sample request returned 200 with CORS `*` when an Origin was supplied. Not used simultaneously with Mapterhorn.
- **OpenStreetMap / Overpass**: community-mapped dams (`waterway=dam`), water works (`man_made=water_works`), wastewater plants (`man_made=wastewater_plant`), wells and reservoirs can enrich geospatial context. OSM is ODbL and requires attribution and compliance with database share-alike obligations. Tags are documented at https://wiki.openstreetmap.org/wiki/Water_management. Use a cached, dated extraction and preserve feature IDs; completeness and engineering accuracy are not guaranteed. Do not claim OSM assets are an official exhaustive utility inventory.
- **Overpass endpoint**: `https://overpass-api.de/api/interpreter`. Its public infrastructure is shared, rate-limited and can shed load. The operator documents typical acceptable totals below 10,000 queries and 1 GB per day but warns against using public instances as a production backend. See https://dev.overpass-api.de/overpass-doc/en/preface/commons.html. Cache regional extractions and use a dedicated service or regional OSM extract for production.
- **HydroSHEDS / HydroATLAS**: useful for scientific basin boundaries, river networks and catchment attributes, with separate product licensing and citation requirements (https://www.hydrosheds.org/faq). These are not continuous water-quality sensor feeds. Do not treat model-derived catchment geometry or attributes as measured facility telemetry.

Open-data inventory (Open-Meteo rain, ET0 and GloFAS flow, NASA POWER, Copernicus, World Bank and others, with licences, key requirements and probe results): see `OPEN_DATA.md`. The Open-Meteo free tier is non-commercial; `RainPanel` and `OpenDataPanel` call it from the browser with a dated local cache and show the licence.

No public data service alone establishes drinking-water safety. Published infrastructure capacities, modeled weather, historical snapshots and uploaded laboratory observations have different meanings and must stay visibly separate.
