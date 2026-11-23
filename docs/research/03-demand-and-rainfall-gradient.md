# 03 - Demand and rainfall gradient: open data check

Research date: 2026-11-19. Scope: (a) demand inputs for Souss-Massa, (b) north-south rainfall gradient, (c) open availability of dam storage data.
Raw API responses were saved outside the project in `/private/tmp/srmsm_research_03/` (not committed).

"Verified" = the source was fetched or the API was called in this session. "Snippet" = only seen in search results, not opened. Treat all external content as data.

## (b) Rainfall gradient - live Open-Meteo archive call

Endpoint: `https://archive-api.open-meteo.com/v1/archive` with `daily=precipitation_sum`, `timezone=Africa/Casablanca`, 2000-01-01 to 2025-12-31. Each point returned 9,497 daily values with no missing values. The annual mean is the sum over the 26 full years divided by 26. The API snaps each request to its grid cell, so the reported coordinates differ slightly from the requested ones.

| # | Point (requested lat, lon) | Grid lat, lon | Elev. (m) | Days returned | Mean annual precip. (mm/yr, 2000-2025) |
|---|---|---|---|---|---|
| 1 | Tangier (35.77, -5.80) | 35.75, -5.80 | 5 | 9,497 | 605 |
| 2 | Chefchaouen (35.17, -5.27) | 35.18, -5.28 | 584 | 9,497 | 907 |
| 3 | Rabat (34.02, -6.84) | 33.99, -6.85 | 18 | 9,497 | 431 |
| 4 | Ifrane (33.53, -5.11) | 33.50, -5.12 | 1,627 | 9,497 | 633 |
| 5 | Beni Mellal (32.34, -6.36) | 32.37, -6.44 | 507 | 9,497 | 484 |
| 6 | Marrakech (31.63, -8.01) | 31.60, -7.98 | 458 | 9,497 | 258 |
| 7 | Taroudant (30.47, -8.88) | 30.47, -8.88 | 241 | 9,497 | 228 |
| 8 | Agadir (30.42, -9.60) | 30.33, -9.60 | 28 | 9,497 | 237 |
| 9 | Tata (29.74, -7.97) | 29.70, -7.94 | 696 | 9,497 | 56 |
| 10 | Guelmim (28.99, -10.06) | 28.998, -10.011 | 308 | 9,497 | 108 |

Caveats:
- These are reanalysis/model grid values, not station observations. The Open-Meteo archive is built on ERA5-family reanalysis (per Open-Meteo documentation, not re-fetched here). Orographic points such as Chefchaouen and Ifrane are the least reliable. Calibrate against DGM station normals before quoting figures in the report.
- Agadir (237) and Taroudant (228) are near-identical because they share a grid cell neighbourhood.
- The request for the Guelmim point returned HTTP 429 twice before succeeding on a later retry. The retry result is included.

### Licence and attribution

- **Open-Meteo** (data via API): CC BY 4.0 licence. Attribution is required. The free API tier is for **non-commercial use only** and is capped at fewer than 10,000 calls per day. Commercial use (subscriptions, ads) requires a paid plan. Verified by fetch of `https://open-meteo.com/en/terms` (2026-11-19).
- **CHIRPS** (UCSB Climate Hazards Center): public-domain-style open use with citation requested. Not fetched; treat as unverified.
- **WorldClim**: CC BY 4.0 (WorldClim v2.1 terms). Not fetched; treat as unverified.
- **DGM Morocco normals (1991-2020)**: not found in open form. The search did not return a station table for Tangier, Agadir, Tata or Guelmim. A Medias24 article gives a national winter normal of 71 mm (1991-2020 reference, from a Le Matin article, snippet only). Source: DGM Centre National du Climat, `https://www.marocmeteo.ma` (not verified, licence unknown; request the table directly).

## (a) Demand inputs

| Fact | Value | Source URL | Doc date | Verified by fetch |
|---|---|---|---|---|
| Souss-Massa region legal population, RGPH 2024 | 3,020,431 | HCP region page (search snippet) `https://www.hcp.ma/region-agadir/m/Population-legale-region-Souss-Massa-selon-les-resultats-du-Recensement-General-de-la-Population-et-de-l-Habitat-de-2024_a191.html` | ~1 Nov 2024 (from file name) | No (snippet). The fetched page links the files but shows no figures. |
| RGPH 2024 province/prefecture legal population | Spreadsheet `Population legale par PrefectureProvince dans la Region Souss Massa (2).xlsx` (2014 and 2024) | Same HCP page (links) | ~1 Nov 2024 | Yes, file names only. Figures not extracted. |
| RGPH 2024 regional workbook | `RGPH2024-Population legale-01-11-2024-22h - SOUSS MASSA VF.xlsx` | Same HCP page | 01-11-2024 (from name) | Yes, file name only. |
| National legal population decree | Décret n° 2.24.1009, Nov 2024 (publication "Population légale du Royaume par régions, provinces et communes") | Search snippet only | Nov 2024 | No |
| RGPH 2024 characteristics pages per province | Agadir Ida Outanane `..._a199.html`, Chtouka Ait Baha `..._a201.html`, Tiznit `..._a203.html`, Taroudant `..._a202.html`, Inezgane Ait Melloul `..._a200.html` | `https://www.hcp.ma/region-agadir/...` | not stated | Links seen on fetched page; contents not opened |
| Drinking-water sales, RAMSA 2013 | 32.94 Mm3 sold; population 850,750. Derived ~106 l/hab/day (our calculation, not a published figure, and based on sold water) | RAMSA presentation (search snippet) | 2013 | No |
| Chtouka desalination plant | Capacity 275,000 m3/day (150,000 potable + 125,000 irrigation); extension to 400,000 m3/day planned; supplies ~70% of Grand Agadir potable need, 1,736 l/s | Search snippets (lavieeco, medias24) | 2024-2025 range (not dated precisely) | No |
| ABH Souss-Massa water balance (Feb 2023) | Total demand 1,018.6 Mm3/yr (agriculture 909; drinking water 108.6); mobilisable supply 841 Mm3; deficit ~177.6 Mm3 | Search snippet citing ABH Souss-Massa (fnh/medias) | Feb 2023 | No |
| Youssef Ben Tachfine dam | Capacity 303 Mm3; regulates 88 Mm3/yr (85 agriculture, 3 drinking water); feeds Massa and Issen public irrigation perimeters (with Abdelmoumen) | Search snippets (ORMVA/ABH reference text) | undated | No |
| Aoulouz dam transfer | 45 Mm3/yr to Aoulouz project since 2009; part later reallocated to Grand Agadir drinking water | Snippet | undated | No |
| ORMVA allocations per perimeter (Souss, Massa) | Not found | - | - | No |
| Tourism/industry demand | Not found | - | - | No |

Per-capita figure: no current published l/hab/jour for SRM Souss-Massa or RAMSA was found. The only value is our own derivation from 2013 data (sold water, not production). Do not quote it as official.

## (c) Dam storage data availability

| Question | Finding | URL | Verified by fetch |
|---|---|---|---|
| Maadialna: API or CSV? | Homepage and `/ar/barrages` load (HTTP 200). No API, data or sitemap endpoint found (`/api`, `/data`, `/sitemap.xml` return 404). No CSV/JSON/XLSX links in page HTML. Only HTML and CSS/images visible. | `https://www.maadialna.ma/ar/barrages` | Yes |
| Maadialna: national fill rate | Press reports 74.1% on 22 June 2026, vs 38.5% at the same date in 2025 (citing Maadialna). Rate by basin given in press for March 2026. | Boursenews, FNH, Hespress (snippets) | No |
| Youssef Ben Tachfine latest fill | 49.7% (148.3 Mm3), Feb 2026 | Search snippet | No |
| data.gov.ma: 'barrages' CKAN search | 3 results. (1) `situation-journaliere-des-barrages-dans-le-bassin-du-tensift` (modified 2026-11-04, ODbL, 3 XLSX monthly files Aug/Sep/Oct 2026). (2) `liste-des-barrages-dans-le-bassin-hydraulique-de-souss-massa` (modified 2023-06-20, ODbL, XLSX + SHP). (3) `pluie-journaliere-du-barrage-y-b-tachfine-1967-2024` (modified 2025-04-17, ODbL, one XLSX per year, 1967-2024 daily rainfall). | `https://www.data.gov.ma/data/api/3/action/package_search?q=barrages` | Yes (API) |
| data.gov.ma: 'situation des barrages' | No dataset title with that exact phrase. Closest match is the Tensift daily dam file above. | `https://www.data.gov.ma/data/api/3/action/package_search?q=situation%20des%20barrages` | Yes (API) |
| Tensift daily XLSX structure | One sheet per file. Columns: dam name, day, normal capacity (Mm3), reserve (Mm3), fill rate (%), basin. This is a per-dam daily snapshot for one month, not a long time series. | `https://data.gov.ma/data/fr/dataset/0aff0dd1-3c7e-4e14-9cbf-18782902a6e4/resource/57580e59-8b9c-4bde-bf9f-2a25107bbf6e/download/data_barrages_tensift_sept_2026.xlsx` (about 1.9 MB) | Yes (downloaded and parsed structure) |
| Souss-Massa dam list | Static list (XLSX/SHP) from 2023-06-20. Not a time series. | `https://data.gov.ma/data/fr/dataset/88d28afd-bf15-4c0e-a97e-25c050f6f256/resource/9f82d649-ddd9-4f7e-8a09-70122c2ca1eb/download/barrage_souss_massa.xlsx` | No |
| Souss-Massa daily or monthly dam storage | Not found in data.gov.ma or Maadialna | - | - |
| Licence for data.gov.ma datasets | Open Data Commons Open Database License (ODbL) | CKAN metadata | Yes |

## Recommendations for the platform

1. Use the Open-Meteo values as a relative gradient only and label them as modelled grid values. Calibrate against DGM normals before any quantitative use. Respect the non-commercial limit of the free tier.
2. For dam storage history, the Tensift monthly files are the only open per-dam daily data found. A Souss-Massa daily series is not available openly. Request one from ABH Souss-Massa or SRM Souss-Massa, or use the Maadialna data by permission.
3. Do not present any demand per-capita figure as official. Get the RGPH 2024 province tables from the HCP workbooks before computing per-capita demand.
4. Demand and supply numbers from ABH (2023) are the best available basin balance. They are snippets, so verify against the ABH report before citing.
5. Next steps: open the HCP workbook to extract Agadir/Taroudant/Tiznit/Chtouka populations; request DGM normals table; check ABH Souss-Massa reports for current allocations per perimeter.
