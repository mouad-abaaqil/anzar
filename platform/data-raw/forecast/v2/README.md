# Forecast v2: reconstruction refit (experimental, unofficial)

Code: `pipeline/forecast/v2/` (`read_ticks.py`, `make_ticks_json.py`, `v2.py`). Outputs here: `ticks-2025.json`, `<id>-clean.json`, `results.json`. Nothing in `public/` or `src/` was touched.

## 1. 2025 ticks
Page 10 of 7 bulletins (10-29, 11-01, 11-04, 11-08, 11-12, 11-16, 11-18) measured by pixel at 200 dpi; px per % fitted on each bulletin's own 2026 bars (about 5.01-5.02). Re-read of 11-18 agrees with the earlier read within 0.2 point for every dam. The nine read ticks sum to within 0.6-1.3 Mm3 of the printed region same-day-2025 figure (Sidi Abdellah has no tick). 2025 fill is nearly flat until a rise on 2025-11-13..16 (region 117.8 -> 141.3 Mm3).
Split fixed before any error was computed: calibration = 10-29, 11-04, 11-12 plus all 2026 pairs; held-out = 11-01, 11-08, 11-16 and 11-18 (v1 date) plus press 2025-06-11. 11-16 and 11-18 are not independent.

## 2. Cleaning
coreValidFraction >= 0.95 (field already in the series from `s2_lib.read_scene`, same offset harmonisation; no COG re-read needed), one tile per date (highest validFraction), scenes differing >35 % from the median of neighbours within +/-12 d dropped, scenes with cloud >30 % flagged and excluded from calibration. Counts per dam in `results.json` -> `cleaning`.
NDWI threshold test (median |log deviation| from neighbours): NDWI>0 is stabler or equal for all four dams, including Aoulouz (0.0122 vs 0.0196, p90 0.047 vs 0.096). NDWI>0 kept. The Aoulouz tile mixing is small once cleaned: the two tiles agree (4.33 vs 4.35 km2 on 2026-11-16). The remaining Aoulouz problem was an isolated 2026-11-01 scene with 50 % cloud (2.22 km2).

## 3. Refit
V = k A^b, b in [1,2], equal total weight for the 2026 group and the 2025-tick group, band from b-range plus 3 % area. No anchor at (max area, capacity). Saturation: area >= 95 % of the dam's max clean area gives [V(area), capacity] and `saturated`. All 2026 areas are saturated for YBT, Abdelmoumen and Moulay Abdellah range-wise.

## 4. Held-out results (11-18 tick, Mm3 and %)
| dam | v1 | v2 | in band |
|---|---|---|---|
| Youssef Ben Tachfine | -3.2 (-8.7 %) | +16.6 (+44.3 %) | yes (wide) |
| Abdelmoumen | -14.3 (-67.8 %) | -13.6 (-63.9 %), scene before the crue: inconclusive | no |
| Aoulouz | +16.1 (+52.5 %) | -0.7 (-2.4 %) | yes |
| Moulay Abdellah | -12.4 (-27.4 %) | -7.2 (-15.9 %) | yes (wide) |
| Region | -14.9 (-10.6 %) | -5.5 (-3.9 %), compensation | yes |
Other held-out dates: Aoulouz 11-01/11-08/11-16: -0.7/-1.7/-0.8 %; Abdelmoumen 11-01/11-08: +5.1/-1.0 %; YBT +44.5 to +45.6 %. Region on 11-01 and 11-08 and press 2025-06-11 not computable (Moulay Abdellah, or a dam, has no clean scene in window). Full list in `results.json` -> `validation`.

## 5. Recommendation
- Aoulouz: can be estimated (identified, held-out within 3 %).
- Abdelmoumen: reserve; 3 calibration points at ~0.8 km2, held-out fine pre-crue (+5, -1 %), post-crue untested; show with wide band only.
- Youssef Ben Tachfine: "non estime". b is at the grid edge because no 2025 scene lies within 3 days of a calibration tick (its only 2025 scene near the window is 11-08, held-out); not identified. This was not re-tuned after seeing the error.
- Moulay Abdellah: "non estime" (no clean 2025 scene in window; b unidentified).
- Region: show the official bulletin total, not a satellite sum.
Limits: very thin held-out sample; reading error +/-1 point; operations not modelled.
