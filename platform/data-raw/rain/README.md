# Rainfall inputs for the four large Souss-Massa dams (S3)

Generated 2026-11-19 by `platform/pipeline/rain/` (Python; run `parse_ybt.py`, `fetch_era5.py`, `fetch_forecast.py`, `process_rain.py`; `points.py` holds the grid points).

## Files
| File | Content |
|---|---|
| `<dam-id>-monthly.csv` (4 files: `youssef_ben_tachfine`, `abdelmoumen`, `aoulouz`, `moulay_abdellah`) | month 1990-01..2026-11, `catchment_mean_mm`, `n_points`, `days_covered`, `days_in_month`, `complete`, then one column per grid point (`p1`..). 2026-11 is partial (`complete=False`). |
| `hydro-year-totals.csv` | Sep-Aug totals per dam. `total_mm` is empty unless all 12 months are complete; `partial_sum_mm` always filled. 2026/2027 is incomplete. First hydro year is 1990/1991 (the series starts in Jan 1990). |
| `grid-points.json` | requested point, grid cell actually returned by Open-Meteo, and its elevation. |
| `ybt-station-monthly.csv` | ABHSM station monthly totals (complete months only) beside the ERA5 series. |
| `bias-report.json` | ERA5 vs station: bias, ratio, correlation, RMSE, per calendar month and per hydrological year. |
| `climatology-terciles.json` | 1990-2025 monthly climatology and dry/normal/wet terciles per calendar month, per dam; hydro-year total terciles. |
| `forecast-16d.json` | latest 16-day forecast, catchment mean per dam, with `fetchedAt`. |

## Method
1. **Grid points (indicative, not a delineated watershed).** For each dam, 7-8 points were placed upstream of the dam (the dam coordinates and GDW catchment area are in `data-raw/dams/dams-souss-massa.json`): the Atlas headwaters east/south-east of the dam, between about 0.2 and 0.9 degrees from it, spread across the valley and the surrounding ridges. Elevations returned by Open-Meteo (about 90 m DEM) were checked for plausibility (valley floors 600-1000 m, ridges 1500-2600 m). No river network or watershed polygon was used. GDW catchments: YBT 3878 km2, Abdelmoumen 1313, Aoulouz 4466, Moulay Abdellah 1248. Points are equally weighted, so the mean is not area- or elevation-weighted. Several points can fall in the same model cell (distinct cells: YBT 6, Abdelmoumen 5, Aoulouz 8, Moulay Abdellah 4), which implicitly weights those cells more.
2. **Reanalysis rainfall.** Open-Meteo archive API, `daily=precipitation_sum`, yearly requests per point, 1990-01-01 to 2026-11-12 (ERA5 latency about 5-7 days), UTC days. Monthly sums per point, then the plain mean over points.
3. **Station ground truth.** ABHSM daily rainfall of the Youssef Ben Tachfine dam (station 8900), 1967-2024, from data.gov.ma (CKAN dataset `pluie-journaliere-du-barrage-y-b-tachfine-1967-2024`, 61 XLSX resources: 58 hydrological-year files 1967/68..2024/25 plus 3 empty templates `precip`, `sdata`, `tabc`, which were skipped). One sheet per hydrological year, columns Sep..Aug, rows day 1-31. Blank/`M`/`?` = missing, `T`/`G`/`TR` = trace (set to 0). A month is used only if all its days are valid. Checked against the sheet's own annual total for 2005/06 (175.4 mm). 38 hydrological years are fully complete; 1967/68, 1969/70 and others have large gaps; 2024/25 only covers Sep-Dec 2024. The XLSX headers give X/Y/Z = 0, so the station position is taken as the dam coordinates from GDW.
4. **Climatology and terciles.** 1990-2025 (36 years) catchment-mean monthly totals; terciles by numpy linear percentile (33.3 / 66.7). Dry months (Jun-Aug) are mostly 0 mm so their terciles are degenerate. Values are raw ERA5, not bias-corrected.
5. **Forecast.** `api.open-meteo.com/v1/forecast`, `forecast_days=16`, default model blend (NWP, independent of the ERA5 reanalysis). Catchment mean over the same points. It is a forecast, not an observation.

## Important limit: ERA5-Land was not usable
The task asked for `models=era5_land`. On 2026-11-19 the Open-Meteo archive returned `null` for `precipitation_sum`, `rain_sum` and hourly `precipitation` with `era5_land` at every location tested (including Paris), while other variables (temperature) were present. The pipeline therefore uses `models=era5` (ECMWF ERA5, 0.25 degrees, about 25 km; set `RAIN_MODEL` to change). This is coarser than ERA5-Land (~9 km) and smooths the relief of the Atlas and Anti-Atlas even more; each cell is a 25 km average. Re-run `fetch_era5.py` with `RAIN_MODEL=era5_land` if the endpoint is fixed.

## Validation result (YBT station, complete months 1990-2024, n = 408)
See `bias-report.json`. ERA5 over-estimates rainfall at this arid site: ratio of totals 1.72 (ERA5 cell at the dam site), 1.87 (nearest catchment point, 22 km away), 1.49 (catchment mean); monthly correlation 0.89-0.90; hydrological-year totals (24 complete years) correlation about 0.84. The bias is largest in the dry months (Apr-Jul ratio 2.8-6.8, small absolute amounts) and about 1.3-1.5 in Dec-Feb. The ERA5 cell centred 10.6 km from the dam has a mean elevation of 108 m, lower than the dam, and a catchment mean is not directly comparable to a point gauge. Do not use the raw ERA5 amounts as absolute catchment rainfall without calibrating them (for example a monthly ratio against the station), and do not treat the single-station comparison as validation for the other three catchments.

## Licences and terms
- Open-Meteo data: CC BY 4.0 (attribution: Open-Meteo.com, contains ERA5 data from Copernicus/ECMWF). The free API tier is for non-commercial use; calls were limited well below 600/min with retry on HTTP 429.
- ABHSM station data (data.gov.ma): ODbL (CKAN `license_id` = odc-odbl). Attribute ABHSM / data.gov.ma and share derived databases under the same licence.
- GDW (catchment areas): CC BY 4.0.
- Requests were sent with a generic User-Agent.
