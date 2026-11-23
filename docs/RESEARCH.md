# Souss-Massa water research and data register

Research date: **19 November 2026**. This file records sources actually inspected for the platform. The original RAMSA internship notebook and its Faridpur workbook remain historical artifacts; their scores and records are not used as Moroccan water observations.

## What the product can honestly show

The first version combines a geographically grounded asset inventory, two official dam-storage snapshots, documented infrastructure context, and the user's separately imported laboratory observations. These categories must remain visibly distinct. Storage percentage measures water availability. It does not measure water quality, drinking-water safety, or operational service continuity.

The bundled dataset is `platform/public/data/region.json`. Each facility has source references, a location-accuracy flag, and, where relevant, an observation date. No current chemical readings, groundwater levels, treatment performance, source-mix percentages, live sensor connection, WQI, or production flows have been invented.

## Regional findings

**Water sources.** ORMVASM identifies the Souss and Massa rivers and their tributaries, regulated by dams, alongside the Souss and Chtouka aquifers. Its undated website is useful for system context, but its aggregate numbers should not be presented as a current water balance. Source: [ORMVASM — Service de l’eau](https://www.ormvasm.ma/index.php/fr/metiers/gestion-des-reseaux.html).

**Desalination.** ONEE's 2 February 2022 release documents progressive drinking-water supply to RAMSA after final tests beginning 29 January 2022. The shared initial design capacity was 275,000 m³/day, split between drinking water (150,000) and irrigation (125,000). It described a future 400,000 m³/day configuration. These are design figures, not a current production meter or a verified statement that the extension is complete. Source: [ONEE release, 2 February 2022](https://www.onep.org.ma/Communiques-Presse-ONEP/communiques-2022/02/CDP-Agadir-ONEE-02-02-2022/CDP-Agadir-ONEE-VF-02-02-2022.pdf).

**Groundwater pressure.** The OSS/CREM strategic data-needs study discusses depletion, local salinity and nitrogen pollution associated with domestic and agricultural pressures. It is historical context; its classifications cannot substitute for recent sampling. Source: [OSS/CREM report, 2017](https://projet.oss-online.org/maghreb-eau/sites/default/files/2020-01/RAPPORT-DEFINITIF-CHTOUKA%20DU%20MAROC-PROJET-CREM-CAPION.pdf).

**Wastewater and reuse.** Agadir's Green City Action Plan reports reuse for green spaces and golf courses and describes the M’Zar upgrade, with a reference 11 million m³/year and a target 24 million m³/year in 2026. The target is not treated as achieved. It also reports the transfer of RAMSA and relevant ONEE activities to SRM Souss-Massa on 15 October 2024. This supports preserving the RAMSA internship history while recognizing the current regional company. Source: [City of Agadir / EBRD Green City Action Plan, 2025, Water section](https://www.ebrdgreencities.com/assets/downloads/Agadir-GCAP_English_1.0.pdf).

M’Zar's historical process includes sedimentation, sand infiltration-percolation and UV disinfection. Aourir uses activated sludge with tertiary filtration and UV. Their papers provide geographically specific historical evidence, not current compliance certificates. Aourir's 7,600 m³/day is a 2030 saturation design, not a present-day measured flow. Sources: [Bourouache et al., 2019](https://d-nb.info/1201541182/34), [Hajji et al., 2021](https://www.jeeng.net/pdf-137360-65156?filename=Study-of-Physicochemical-.pdf). These publications also motivate retaining microbiological parameters and use-specific criteria in any later quality assessment.

## Official storage observations used

The following two PDF pages were downloaded and **visually checked**, because their content is image-based and ordinary text extraction is empty:

- [Maa Dialna, 9 November 2026, French PDF, page 10](https://www.maadialna.ma/sites/default/files/barrages/2026-11-09/fr/etat_global.pdf): Souss-Massa storage **333.15 Mm³**, capacity **722.83 Mm³**, filling **46.09%**.
- [Maa Dialna, 13 November 2026, Arabic PDF, page 10](https://maadialna.ma/sites/default/files/barrages/2026-11-13/ar/etat_global.pdf): storage **383.01 Mm³**, capacity **722.83 Mm³**, filling **52.99%**.

The latter has **nine** dam entries: Moulay Abdellah, Dkhila, Ahl Souss, Aoulouz, Sidi Abdellah, Youssef Ben Tachfine, Abdelmoumen, Imi El Kheng and Mokhtar Soussi. The original eight-dam brief omitted Sidi Abdellah. Names are normalized in the app while original publication URLs remain accessible. Reported aggregate storage is preserved: the sum of rounded displayed dam values is 382.99 Mm³, differing from the published total by 0.02 Mm³. This is consistent with row rounding; it is not silently corrected.

Only these two dates are bundled. A line between them is a visual connection, not additional daily measurements. PDF dates are observation dates; research and retrieval dates are distinct. Newer values must not be inferred from the app's current date. The PDF is publicly accessible but no explicit redistribution license was found in it. Do not label the snapshot itself ODbL merely because a separate inventory has that license.

## Inventory and map coordinates

The [ABHSM national open-data inventory](https://data.gov.ma/data/dataset/liste-des-barrages-dans-le-bassin-hydraulique-de-souss-massa) was inspected through CKAN and its actual XLSX. It was updated **20 June 2023**, lists nine dams, and declares **Open Data Commons ODbL**.

Verified no-key endpoints:

- Metadata: `https://data.gov.ma/data/api/3/action/package_show?id=liste-des-barrages-dans-le-bassin-hydraulique-de-souss-massa`
- Workbook: `https://data.gov.ma/data/fr/dataset/88d28afd-bf15-4c0e-a97e-25c050f6f256/resource/9f82d649-ddd9-4f7e-8a09-70122c2ca1eb/download/barrage_souss_massa.xlsx`

The XLSX columns are `FID, Type, nom, X, Y`. **No coordinate reference system is declared in the inspected resources.** The companion advertised QGIS resource downloads a small point `.shp`, without the other normal shapefile parts or an inspected `.prj`. A Merchich-zone guess would be an unverified geodetic assumption, so the app does not silently reproject those coordinates.

Instead, dam and desalination markers use **approximate OpenStreetMap feature representative points**, looked up directly through Nominatim. Each record includes its OSM feature URL. These are locations of assets/reservoirs, not surveyed instrument positions. OpenStreetMap requires attribution and is ODbL: [copyright and license](https://www.openstreetmap.org/copyright).

M’Zar and Aourir use the published geographic positions in their primary research papers. Decimal-degree conversions preserve western longitudes as negative. Groundwater markers are explicitly schematic reference points within the named plains: they represent neither a well nor a mapped aquifer boundary. Do not draw them as monitored sensors or interpret distance to them as a hydrogeological result.

## Further open data and access limits

The ABHSM organization on data.gov.ma also advertises daily rainfall for Youssef Ben Tachfine (1967–2024), ABHSMD/Agadir (1986–2024), Talaint (2007–2024), Aït Melloul (2011–2024), plus daily flow at Talaint (1993–2024) and Aït Melloul (1970–2024). They are promising historical hydrology sources, not real-time chemistry. Their individual resources and internal schemas still need inspection before incorporation. [Filtered producer catalog](https://www.data.gov.ma/data/fr/dataset/?_organization_limit=0&_res_format_limit=0&_tags_limit=0&groups=agriculture&license_id=odc-odbl&organization=agence-du-bassin-hydraulique-de-souss-massa).

[Open-Meteo](https://open-meteo.com/en/pricing) supplies keyless weather for non-commercial prototyping. Its weather data is CC BY 4.0; the hosted free API is limited to non-commercial use (currently 10,000 daily requests) and carries no uptime guarantee. Commercial SaaS needs an appropriate commercial endpoint/license or suitable self-hosting. Forecasts and reanalysis are model data, not water-sample measurements. A usable prototype request is `https://api.open-meteo.com/v1/forecast?latitude=30.42&longitude=-9.60&daily=precipitation_sum,temperature_2m_max&timezone=Africa%2FCasablanca&forecast_days=7`.

[GEMStat](https://gemstat.org/data-gemstat/data-portal/) provides an open subset through [Zenodo](https://doi.org/10.5281/zenodo.13881899), updated annually. Other portal downloads have request/access steps. The portal reports an October 2026 service disruption. Relevant Souss-Massa station coverage was **not verified**. It is a candidate source, not a connected feed.

The Moroccan health ministry publishes regional historical water-control summaries and the environment ministry publishes beach-water reports. Those are different sampling populations from dam water and distribution-network samples. This search did **not** establish an open, current, machine-readable chemical-quality API for the facilities displayed. A credible next data integration is laboratory CSV/API ingestion with site, timestamp, parameter, value, unit, method, provenance and validation status.

## Product decisions supported by the research

1. Distinguish availability, infrastructure design, modeled weather and laboratory quality in every view.
2. Show dated source references and missing data rather than synthetic live statistics.
3. Keep thresholds specific to intended use and governing reference; no universal WQI or potability verdict from the historical notebook.
4. Treat 3D terrain as geographical context. Do not imply that schematic links are surveyed pipes, or that asset markers are active IoT sensors.
5. Preserve third-party data attribution and identify commercial API obligations before release to paying customers.
