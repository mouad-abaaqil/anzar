# 06 - Historical dam storage series (Morocco, Souss-Massa focus)

Research date: 2026-11-19. Goal: find an open historical series of reservoir storage to validate a rainfall-to-fill-rate model.

## Bottom line

No usable multi-year, per-dam storage series for Souss-Massa is openly available. What exists:

- One open, machine-readable per-dam daily storage series: Tensift basin (not Souss-Massa), 5 dams, August to October 2026 (3 months). Downloaded and converted (see below).
- Open daily rainfall and river-flow series for the Souss-Massa area from ABHSM on data.gov.ma (1967 to 2024), including a rain series at the Youssef Ben Tachfine dam. These are model drivers, not storage.
- The Souss-Massa dam list (9 dams) with coordinates, from ABHSM.
- Daily bulletins on maadialna.ma exist as PDFs for recent dates only. No archived copies were found.

## Candidates

| # | Source | URL | Coverage | Granularity | Format | Licence | Status |
|---|---|---|---|---|---|---|---|
| 1 | ABHT (Tensift) daily dam situation, data.gov.ma | https://www.data.gov.ma/data/api/3/action/package_search?q=barrages (dataset `situation-journaliere-des-barrages-dans-le-bassin-du-tensift`) | Aug, Sep, Oct 2026 (one workbook per month) | Daily, per dam: reserve (Mm3) and fill (%) | XLSX (one sheet per month, dams as column pairs) | ODbL | **Downloaded and inspected.** Converted to CSV: `platform/data-raw/history/tensift_daily_reserves_2026-08_to_10.csv` (462 rows, 5 dams). Continuity checked: Aug 31 and Sep 1 values match for Yacoub El Mansour. Basin: Tensift, not Souss-Massa. |
| 2 | ABHSM dam list, data.gov.ma | https://data.gov.ma/data/fr/dataset/88d28afd-bf15-4c0e-a97e-25c050f6f256/resource/9f82d649-ddd9-4f7e-8a09-70122c2ca1eb/download/barrage_souss_massa.xlsx | Static (2023 metadata) | 9 dams, X/Y coordinates (projection not stated; likely Lambert, unverified) | XLSX | ODbL | **Downloaded and inspected.** CSV: `platform/data-raw/history/souss_massa_dam_list_abhsm.csv`. Contains no storage. |
| 3 | ABHSM daily rain at Y.B. Tachfine dam, data.gov.ma | https://data.gov.ma/data/fr/dataset/16a867e2-1b7f-4cd8-9322-24a11cbf7ddb (61 resources, 1967 to 2024, one file per year or pair of years) | 1967 to 2024 | Daily rainfall, one station | XLSX (one sheet per hydrological year, days by month) | ODbL | **Two files downloaded and inspected** (2024/2025 and 2020/2021). Rainfall only, no storage. Rainfall driver for the model. Parsing not yet done. |
| 4 | Same dataset, other resources | same dataset | `sdata.xlsx` is empty; `tabc.xlsx` is a day-by-month rainfall grid for 2014 and 2015 only | - | XLSX | ODbL | **Inspected.** Not useful for storage. |
| 5 | ABHSM rain and flow stations, data.gov.ma | Talaint rain 2007 to 2024; Ait Melloul rain 2011 to 2024; ABHSM DRH Agadir rain 1986 to 2024; Talaint flow 1993 to 2024; Ait Melloul flow 1970 to 2024 | 1970 to 2024 | Daily | XLSX | ODbL | **Not downloaded.** Listed in the CKAN catalogue. Candidate rainfall and inflow drivers. |
| 6 | Wayback CDX for maadialna.ma bulletins | `https://web.archive.org/cdx/search/cdx?url=maadialna.ma/sites/default/files/barrages/*&matchType=prefix&output=json` | 0 captures returned | - | - | - | **Queried.** Returned an empty list. A domain-wide query returned about 300 captures, all article pages, homepage redirects, or `ar` news pages, none of them bulletin PDFs. A later retry hit an Internet Archive outage, so this is "none found in successful queries", not a full check. |
| 7 | Other maadialna bulletin PDFs | `https://maadialna.ma/sites/default/files/barrages/YYYY-MM-DD/ar/etat_global.pdf` | Known dates only (2026-10-31, 11-03, 11-09 to 11-18). Older dates return 404 per prior check | Daily, national and basin totals | PDF | not stated | No bulk download attempted. No archived copies found. |
| 8 | ministry sites (equipement.gov.ma, water.gov.ma, eau.gov.ma) | - | - | - | - | - | equipement.gov.ma did not connect. Not pursued further. |
| 9 | GitHub, Zenodo, Kaggle, HDX | web search | none found | - | - | - | Web search found no open dataset of Moroccan dam levels. Press articles only. |
| 10 | Press reports (ABHSM and national figures) | e.g. Telquel, FNH, Hespress, Medias24, Le360 | Point values: Souss-Massa stock 100.186 Mm3 (12 Feb 2024, 13.5%), 101.261 Mm3 (13 Mar 2024, 13.7%), 20.83% (11 Jun 2025), 406 Mm3 (Feb 2026); national totals in 2024 to 2026 | Irregular, aggregate | Web text | not applicable | Used only as sanity checks. Not a series, not for training. |
| 11 | ABHSM and DGH annual reports | - | Not located | - | - | - | No annual report PDFs were found in the search results. |

## Modelling implications

- Validation of a rainfall-to-fill-rate model for Souss-Massa is not possible with openly published per-dam storage data. The usable open series are the rain and flow drivers (candidate 3 and 5) plus static dam metadata (candidate 2).
- The Tensift series (candidate 1) lets the model be tested on one basin for three months. It is too short for seasonal validation, but it does show daily fill dynamics for dams of comparable size.
- Requesting the historical per-dam series directly from ABHSM (open-data contact on data.gov.ma, or the agency) is the most likely route to a multi-year Souss-Massa series. This has not been attempted.
- Any future bulletin archive would need a separate collection process (for example, saving bulletins daily from now on), since the Wayback Machine holds none found so far.

## Files written

- `platform/data-raw/history/tensift_daily_reserves_2026-08_to_10.csv`
- `platform/data-raw/history/souss_massa_dam_list_abhsm.csv`
- `platform/data-raw/history/README.md` (source, retrieval date and licence for each file)

Downloads (raw XLSX) were kept outside the repository in a temporary folder and were not executed; they were parsed with a standard-library reader.
