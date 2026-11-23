# Official dam bulletins, Souss-Massa (S1)

Daily "etat global des barrages" PDFs from the ministry portal (maadialna.ma, `/sites/default/files/barrages/<date>/ar/etat_global.pdf`), kept as received.

## Contents
- `<date>.pdf`: 18 bulletins (12 pages, JPEG infographics, no text layer). Page 10 is the Souss-Massa basin.
- `souss-massa-series.json`: hand transcription of page 10 (basin fill %, stored Mm3, same-day-previous-year %, per-dam stored Mm3 and fill %), checks, derived capacities, and a calibrated read of the 2025 ticks on 2026-11-18.
- `../../pipeline/archive_bulletins.sh`: download-only, idempotent, not scheduled.

## Coverage
Probed every day 2026-09-01 to 2026-11-19 with HEAD. Published: 2026-10-29 to 2026-11-18, except 2026-11-06, 11-10 and 11-14 (404 in `ar` and `fr`; `en` is 404 on a known date). Nothing exists before 2026-10-29 in that range. 2026-11-19 was not yet published at fetch time.

## Transcription
Page 10 rendered at 110 dpi and read visually, one bulletin at a time (`transcribedBy: "visual read"`). Dam order in the bars changes between bulletins; values are keyed by Arabic name. 2026-11-18 matches the supplied reference exactly.
- 2026-10-29 is printed at reduced precision (integer fill %, stored to 0.1 Mm3, basin 46.6 % of 722.8). Treat as approximate.
- sumOk: dam stocks sum to the header within 0.05 Mm3 for all 18 (10-29 within printing rounding).
- capacityStable: stored/fill within 1 % of the 2026-11-18 capacity. Three bulletins (10-30, 11-02, 11-17) flag Dkhila only; its 0.13-0.22 Mm3 stock cannot resolve capacity better than a few percent, so this is rounding or source noise, not a read error. No other dam fails.
- Capacities (Mm3, from 2026-11-18): sum 722.85 vs printed 722.83.

## 2025 same-day values (2026-11-18)
Yellow tick positions were measured at 200 dpi; origin is the bar's right edge (bars grow right to left), scale 4.985 px per %. Reported as "lu sur graphique, +/-1 point". Sidi Abdellah shows no tick, so it is null. The nine-dam sum excluding Sidi Abdellah is 140.3 Mm3 vs printed 19.56 % x 722.83 = 141.4 Mm3, a 1.1 Mm3 residual within combined reading error.

## Limits
Visual transcription can contain slips; the sum and capacity checks catch most. Some values look odd but are as printed (for example Dkhila 94.87 % on 11-01, 11-12 and 11-13; Sidi Abdellah 7.14 on 11-13 then 5.31 on 11-15). These are ministry figures, not independently verified. Page images were rendered to /tmp only and are not stored.
