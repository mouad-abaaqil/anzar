# Satellite water-surface extent vs official fill, Souss-Massa (proof of concept)

Prepared 2026-11-19. Scope: can free satellite imagery estimate the water surface of Souss-Massa reservoirs, and does that track the official fill rate? Writes only this note. Scripts, intermediate JSON and NDWI outputs are in `/tmp/srmsm-sat/` (outside the project). Nothing in `platform/` was read or changed.

**Read this first**

- Every area number below was computed in this session from Sentinel-2 L2A COGs. Fill rates, stored volumes and capacities are the user-supplied ministry bulletin for 18 Nov 2026 and were **not verified** here.
- The bulletin gives **one** official snapshot. The correlation with fill is therefore across dams at one date (n = 6). No within-dam correlation with fill is possible.
- Only 2026 and 2025 same-period imagery was analysed. There is no 2025 fill data to compare against.
- Result: detected surface area tracks the size of the reservoir (stored volume) much better than it tracks fill. A surface-area *trend* can be claimed only for dams with an outline that is not a ceiling. Volume cannot be derived without each dam's area-capacity curve.

## 1. Tooling

- Python 3.15.2 (Homebrew). No numpy, rasterio or GDAL system-wide; `gdalinfo` absent.
- Venv at `/tmp/srmsm-sat/venv`: numpy 2.5.5, rasterio 1.5.2 (GDAL 3.12.2), scipy, shapely, matplotlib, requests. Nothing installed system-wide.
- Earth Search STAC (`https://earth-search.aws.element84.com/v1/search`) answered HTTP 200. Assets `green`, `nir`, `scl` are public COGs on `sentinel-cogs.s3.us-west-2`, read with GDAL `/vsicurl/` window reads.
- Requests to Nominatim and Overpass were sent with the User-Agent `srmsm-research-script/1.0`. The project name is in that string. Later requests should use a generic agent name. Overpass returned 502 at times (busy).

## 2. Coordinates (checked against OSM / Nominatim)

| Dam | User-supplied | Used | Note |
|---|---|---|---|
| Moulay Abdellah | -9.67, 30.77 | -9.6724, 30.7738 | Consistent. No OSM reservoir outline within 4 km |
| Aoulouz | -8.14, 30.69 | -8.1379, 30.6927 | Consistent |
| Abdelmoumen | -9.18, 30.62 | -9.1987, 30.6754 | About 6 km apart. The only OSM outline near it is 0.096 km² and is not used |
| Youssef Ben Tachfine | -9.38, 30.07 | -9.4764, 29.8144 (OSM water node) | **About 28 km apart.** The user point gave no reservoir in OSM and was dropped |
| Ahl Souss, Dkhila, Sidi Abdellah | not given | OSM/Nominatim | Added because the bulletin lists them |
| Mokhtar Soussi, Imi El Khenk | not given | **not located** | Not computed. Mokhtar Soussi is under raising works (see `01-dams-to-service-areas.md`), so its outline also changes |

## 3. Method (what was actually run)

1. STAC search per dam: 13 km box, `eo:cloud_cover < 10` (tile-level), 25 Oct to 18 Nov, for 2025 and 2026. 80 scene-tile records (72 usable, 8 with no data in the window).
2. Read green (B03), NIR (B08) and SCL over the window, clipped to the granule. Cloud mask: SCL in {0, 1, 3, 8, 9, 10} removed.
3. NDWI = (green - NIR)/(green + NIR) on **raw DN**. An earlier run applied the BOA offset (-1000) first. That made the denominator cross zero over dark water and gave values outside [-1, 1]. It was fixed. A second earlier bug ignored granule clipping at tile edges, which misregistered windows that straddle two tiles. Also fixed.
4. Water = NDWI > 0 (thr0). Otsu areas were also computed and compared (section 4).
5. Area methods:
   - **OSM polygon** where a reservoir outline exists (Aoulouz, Youssef Ben Tachfine, Ahl Souss, Dkhila): water pixels inside the outline.
   - **Seed disc** where no outline is mapped (Moulay Abdellah, Sidi Abdellah, Abdelmoumen): largest water component touching a 1.5 km disc around the seed point. Abdelmoumen was run this way because its only OSM outline is a fragment.
6. Sentinel-2 tiles overlap by about 10 km. One scene per dam and date was used (most valid pixels, then lowest tile cloud). Overlapping tiles were not summed. For the seed-disc Abdelmoumen run, the two overlapping tiles gave the same value on each date (see table), which is a useful cross-check. A scene counts only if at least 90 % of the area of interest is valid.

## 4. Computed results

Area in km², NDWI > 0, cloud-masked. Dates are acquisition dates, not bulletin dates. Official fill is user-supplied.

| Dam | Area method | 2025 scenes (km²) | 2026 scenes (km²) | Official fill 18 Nov 2026 (user) |
|---|---|---|---|---|
| Moulay Abdellah | seed disc | 3.44 (11 Nov) | 5.60 (25 Oct), 5.59 (30 Oct), 5.58 (4 Nov) | 95.90 % |
| Ahl Souss | OSM polygon, 0.46 km² | 0.093 (1 Nov), 0.090 (8 Nov), 0.090 (11 Nov) | no usable scene (4 Nov: 0 % valid) | 93.40 % |
| Aoulouz | OSM polygon, 4.92 km² | 2.54, 2.54, 2.54, 2.49, 2.54 (1, 6, 8, 11, 16 Nov) | 4.39 (16 Nov); 13 Nov rejected (14 % valid) | 80.81 % |
| Dkhila | OSM polygon, 0.073 km² | 0.023 (1 Nov), 0.029 (8 Nov), 0.029 (9 Nov), 0.028 (11 Nov) | 0.027 (25 Oct), 0.033 (4 Nov) | 67.79 % |
| Youssef Ben Tachfine | OSM relation, 5.78 km² | 3.35 (8 Nov), 3.35 (9 Nov), 3.03 (11 Nov) | 5.63 (25 Oct), 5.74 (4 Nov); 13 to 16 Nov only partly valid (63 to 70 %) | 49.59 % |
| Abdelmoumen | seed disc (outline unusable) | 0.79 (1, 8, 11 Nov, both tiles agree) | 4.03 (25 Oct), 4.06 (25 Oct, 2nd tile), 4.01 (30 Oct), 3.2 (4 Nov, 96 % valid), 4.32 (16 Nov); 14 Nov rejected (81 % valid) | 36.50 % |
| Sidi Abdellah | seed disc | 0.37 (1 Nov), 0.31 (6 Nov), 0.35 (8 Nov), 0.035 (11 Nov) | 0.31 (16 Nov) | 45.92 % |
| Imi El Khenk, Mokhtar Soussi | not located | not computed | not computed | 30.47 %, 10.61 % |

**Otsu versus threshold 0 (all 77 usable scenes with area above 0.01 km²).** Median difference -1.1 %. Where the Otsu threshold is in a sensible range (about 0 to 0.25), the two agree within about 3 %. Where the window is land-dominated, Otsu gives a negative threshold (down to -0.36) and inflates the area by orders of magnitude (Sidi Abdellah: 0.07 km² becomes 12 km²). Otsu is therefore not used for claims. Thresholds are on the raw-DN NDWI scale.

**Cross-dam check at one date (n = 6, latest usable 2026 scene per dam, 4 to 16 Nov):**

| Pair | Pearson r | p | Spearman | p |
|---|---|---|---|---|
| Area vs official fill | 0.24 | 0.65 | 0.31 | 0.54 |
| Area vs stored volume | 0.92 | 0.009 | | |
| Area vs fill, Youssef Ben Tachfine excluded (n = 5) | 0.43 | 0.47 | 0.60 | 0.28 |

Area follows dam size (stored volume), not fill. Across dams of very different size, the surface mostly reflects how big each reservoir is, so the raw correlation with fill is weak and not significant. A fairer comparison would be detected area divided by outline area against fill. That is possible only for outlines that are trusted, of which there are two (Aoulouz 0.89, Dkhila 0.45). That is too few to test anything.

**Same period, 2025 vs 2026 (median of usable scenes):** Moulay Abdellah 3.44 to 5.6 (+60 %); Aoulouz 2.54 to 4.39 (+70 %, one 2026 scene); Youssef Ben Tachfine 3.35 to 5.7 (+70 %, ceiling-limited, see below); Abdelmoumen 0.79 to about 4.0 (about 5x); Dkhila 0.029 to 0.030 (flat); Sidi Abdellah about 0.31 to 0.31 (flat, with one 11 Nov outlier); Ahl Souss 0.09 to n/a. Without 2025 fill, these rises cannot be linked to fill.

## 5. Sanity checks and limits per dam

- **Youssef Ben Tachfine:** the 2025 scenes cover 58 % of the 5.78 km² outline, and the 2026 scenes cover 97 to 99 %. The outline is acting as a ceiling. The direction of the rise is supported, but the size of the rise is a **lower bound**. The bulletin's 291 Mm³ capacity on a 5.8 km² outline would imply a mean depth of about 50 m, so the outline is probably incomplete.
- **Aoulouz:** 4.39 of 4.92 km² (89 %) in 2026, so it is close to the same ceiling. Its 2025 level (about 52 %) is also an upper bound on the true lake. Plausibility: 89 Mm³ capacity over 4.4 km² at 81 % fill is about 16 m mean depth, which is reasonable. Treat the rise as a lower bound.
- **Abdelmoumen:** the seed-disc value of about 4 km² in 2026 and 0.79 km² in 2025 is consistent with 72 Mm³ stored at 36.5 %, a mean depth of about 18 m. It is not visually verified, and the 1.5 km disc may include other water. Both overlapping tiles give the same value, which supports it.
- **Ahl Souss:** 4.9 Mm³ capacity at 93 % fill. A reservoir of that volume with a typical mean depth of about 10 m would cover roughly 0.5 km². The 0.09 km² detected may be an under-count or a misplaced outline. Not trusted.
- **Dkhila:** 0.16 Mm³ over 0.027 km² gives a mean depth of about 6 m, which is consistent. This is the most internally coherent case, but it is also the smallest.
- **Moulay Abdellah, Sidi Abdellah:** seed-disc components may merge with river or wetland pixels. Not verified visually.

## 6. Limits

- **Clouds:** tile-level cloud cover under 10 % still left several dates with 0 to 30 % of an area valid (Aoulouz 13 Nov 2026 at 14 %; Youssef Ben Tachfine 13 to 16 Nov at 63 to 70 %; Abdelmoumen 14 Nov at 81 %). These are marked as rejected or partial in the table, not averaged in.
- **Narrow reservoirs:** 10 m pixels with mixed water and shore pixels underestimate small or narrow bodies (Dkhila, Sidi Abdellah).
- **Shadows:** not tested on steep terrain. The dams sit in relief, so this is a real risk.
- **Turbidity and sediment:** not separated from land in NDWI. Pale or turbid water can fall below 0 and be missed.
- **Area to volume:** needs each dam's own area-capacity curve (bathymetry or the operator's table). Without it, only area can be reported.
- **Outlines:** OSM outlines are not the full-supply level and may be incomplete or ceiling-limited. This is the largest source of error for the outline-based dams.
- **Water versus land ambiguity:** a fixed NDWI threshold of 0 is adequate for these dams in these scenes. Otsu is not.

## 7. Alternative free products (not computed)

- **JRC Global Surface Water (monthly history):** from memory, the monthly history covers 1984 to 2021 and is accessed through Google Earth Engine or the bulk download bucket. The bucket root answered HTTP 200, but the tile layout was not checked. It cannot give 2026 data, so it can only give a long-term baseline.
- **Copernicus Global Land Service water bodies:** from memory, a 300 m product. Pixels are coarse relative to the Dkhila and Ahl Souss outlines, so it works only for the largest reservoirs. Not fetched.
- **Sentinel-1 SAR:** the `sentinel-1-grd` collection is in Earth Search and answered a query. It returned 6 scenes over Aoulouz between 26 Oct and 18 Nov 2026, about one every 6 days, so it is cloud-independent. Water classification from VV or VH was **not run**. No SAR numbers are reported.
- **JavaScript or no-Python route:** realistic in principle. `geotiff.js` can read COG windows through HTTP range requests, and the S3 bucket serves ranges. CORS on the bucket was not tested in a browser, so this is untested.

## 8. Conclusions

- **Can claim, with caveats:** for Aoulouz, Youssef Ben Tachfine, Moulay Abdellah and Abdelmoumen, the detected water surface was larger in Oct and Nov 2026 than in the same period of 2025. For Aoulouz and Youssef Ben Tachfine the outline caps the rise, so it is a lower bound. The bulletin shows these dams at 36 to 96 % fill now, so a rise in surface is directionally consistent. The 2025 fill is not known and does not confirm it.
- **Cannot claim:** a reliable correlation between surface area and official fill. Across six dams at one date, the correlation is weak (r = 0.24) and not significant. Area tracks dam size instead (r = 0.92 with stored volume).
- **Cannot claim:** any volume estimate from area. That requires each dam's curve.
- **Next steps if the work continues:** obtain full-supply outlines for the large reservoirs from the operator (ABHSM). Add bulletins for several dates so a time series can be correlated with fill, and compare detected area divided by outline area. Run Sentinel-1 water masks as a cloud-free check. Locate Mokhtar Soussi and Imi El Khenk outlines.

## 9. Files (outside the project)

- `/tmp/srmsm-sat/sat_water.py`: v1 (seed-based; contains the offset bug; kept as a record). Also defines the STAC search and the dam list
- `/tmp/srmsm-sat/sat_poly.py`: v2 (OSM polygons, raw-DN NDWI, granule-clip fix). Output `/tmp/srmsm-sat/out/items_v2.json`
- `/tmp/srmsm-sat/abdelmoumen_seed.py`: Abdelmoumen seed-disc rerun. Output `/tmp/srmsm-sat/out/abdelmoumen_seed_v2.json`
- `/tmp/srmsm-sat/aggregate.py`: one scene per dam and date. Output `/tmp/srmsm-sat/out/agg_v2.json`
- `/tmp/srmsm-sat/out/overpass.json`: OSM geometries used (4 km around seeds)
- NDWI rasters from v1 were deleted when the v1 bug was fixed. v2 does not write rasters.
