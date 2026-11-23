# Historique détaillé du développement (journal, 19 novembre 2026)

Journal chronologique conservé tel quel : décisions, résultats chiffrés, échecs. Pour l’état actuel et la suite, lire `../HANDOFF.md`. Les passages « Known defects » et « Remaining » ci-dessous sont datés et partiellement périmés.

---

# SRM-SM — handoff to Claude Code

Updated: 19 November 2026. Working directory: `/Users/mouad/Developer/SRMSM`.

## Start here

The user wants to continue development in Claude Code. Their latest request was **folder organization only**. Implementation has stopped at a runnable local MVP. Do not assume that a production SaaS or live sensor integration has been completed.

Read `README.md`, then this file, then `docs/RESEARCH.md`, `docs/BRAND.md`, and `docs/OPEN_SOURCE.md` before making product or data changes.

## Product intent

Build a SaaS for monitoring water resources and water quality in Souss-Massa, Morocco, with a real interactive 3D terrain map. Show dams, groundwater context, desalination, wastewater treatment and reuse. Preserve the regional company's identity and the project's RAMSA internship origin. The user values good UX and asked for parallel subagents, primary-source research, open data and open-source tools.

## Folder map

```text
README.md                 Project entry point and run commands
CLAUDE.md                 Short automatic context for Claude Code
HANDOFF.md                Current state, evidence and next steps
LICENSE                   Original code license
platform/                 New runnable application
  src/App.jsx             Navigation, overview, source register, water-cycle view, auth UI
  src/styles.css          Main visual system and responsive layouts
  src/components/         MapView and QualityPanel, with their CSS
  server/                 Node HTTP API, auth, SQLite, CSV and weather proxy
  public/data/region.json  Reviewed public facts, facilities and source registry
  public/brand/           Authentic SRM-SM logo
  tests/                  API/security/CSV/persistence tests
  data/                   Ignored local private SQLite database
  dist/                   Ignored production build
  node_modules/           Ignored installed dependencies
docs/                     Research, branding, open-source decisions
legacy/                   Original notebook, workbook, Python requirements and README
```

## Run and verify

Requires Node 24 or newer with `node:sqlite` support; last validated on Node 26.3.0.

```sh
cd /Users/mouad/Developer/SRMSM/platform
npm ci
npm run dev
```

UI: `http://127.0.0.1:5173`. API: `http://127.0.0.1:8787`. Vite proxies `/api` to the API. The previous dev processes were stopped for handoff, so the ports should be free.

```sh
npm test
npm run build
npm start
```

The last command serves the built UI and API together at `http://127.0.0.1:8787`. Run from `platform/`. `npm run preview` serves only Vite's frontend preview and does not replace the API server.

There are no default credentials. Create a local account in the interface. Each account currently owns one private workspace; membership invitations and shared team roles are not implemented.

Runtime environment settings are documented in `platform/.env.example`: `DB_PATH`, `PORT`, `HOST`, `COOKIE_SECURE`, and `ALLOWED_ORIGINS`. The server does not automatically load `.env`; set environment variables explicitly or use Node's `--env-file` option.

## Implemented

- React 19 / Vite frontend, in French, with the authentic company logo and blue/green/yellow palette.
- MapLibre GL JS 6.19, OpenFreeMap vector map and actual Mapterhorn DEM terrain. 2D/3D switching, rotation, reset, site selection, layer toggles and low-zoom label decluttering.
- 14 referenced facilities/area markers: 9 dams, Chtouka desalination, M’Zar and Aourir treatment plants, and Souss/Chtouka groundwater reference areas.
- Dated dam-storage overview, facility inspector, source registry, water-cycle explanation, search and public JSON export.
- Real local registration/login/logout, hashed passwords, expiring HttpOnly cookie sessions and SQLite persistence.
- User-owned water-quality records, validation, manual entry, atomic CSV import, export, deletion, filters and graphs of actual imported measurements.
- Server-side Open-Meteo context for Agadir, explicitly labelled modelled weather.
- API tests for authentication, isolation, validation, persistence, atomic imports, CSV formula safety, logout and weather failures.

## Data and scientific constraints

- The original notebook/workbook concern Faridpur-style well records, not the regional dam dataset. They are preserved under `legacy/` and are not used by the new dashboard.
- The notebook's historical raw weighted-sum “WQI” has no established scientific basis in the repository. The new app does not use it or produce potability classifications.
- No open current regional chemistry feed was verified. No operational quality samples are seeded. Users must supply laboratory/measurement data with provenance.
- The official public snapshot bundled is **13 November 2026**: **383.01 Mm³ / 722.83 Mm³, 52.99%**. A second snapshot is bundled for 9 November. These are dated documents, not automatically refreshed telemetry. Preserve the publisher's total; rounded individual rows sum to 382.99 Mm³.
- The official bulletin lists nine dams, including Sidi Abdellah, despite the original brief listing eight.
- Facility positions are explicitly approximate. Groundwater points are schematic reference areas, not wells, sensors or verified aquifer boundaries. No pipeline geometry is fabricated.
- Chtouka's 275,000 m³/day is documented initial capacity. 400,000 m³/day is an expansion objective. M’Zar's 24 Mm³/year is a documented target, not confirmed current production.
- The ODbL dam inventory has projected coordinates without declared CRS metadata. It was not silently transformed into GPS coordinates.
- Free Open-Meteo hosting is non-commercial; a commercial SaaS must configure an appropriate service. OpenFreeMap/Mapterhorn have third-party availability and attribution constraints. See the research and open-source docs.
- The logo is a real government-hosted SRM-SM asset and remains its owner's property. This is an independent prototype, not an officially commissioned company portal.

## Verification completed

On 19 November 2026:

- `npm test`: 3 tests passed. Each contains multiple API/security assertions.
- `npm run build`: passed after the latest application edits.
- `npm audit --omit=dev`: 0 known vulnerabilities. A full audit also returned 0 after upgrading MapLibre to 6.19.
- Browser verification: actual terrain rendered, responsive layout inspected, local registration succeeded, and a clearly labelled QA-only measurement was saved and displayed in the registry and graph.
- The QA account and its single synthetic test measurement were removed after verification. They are not demo data.
- Security review found a logout request-format mismatch and a CSV formula-escaping gap; both were fixed and regression-tested.
- MapLibre 6 requires a Vite worker URL import and `setWorkerUrl`. This is implemented. Do not remove it merely because the production build succeeds without a browser test.

Remaining verification: repeat final desktop/mobile visual checks after the last typography and map decluttering refinements. Browser form input for `datetime-local` required native accessibility input in this environment; the completed save flow succeeded. No production deployment was tested.

## Phase 2 — reliability pass (19 November 2026, still uncommitted)

Changed:
- `src/App.jsx`, `vite.config.js`: `MapView` and `QualityPanel` are lazy-loaded; MapLibre has its own chunk. Main chunk 1,362 kB → 258 kB. The MapLibre worker-URL import is intact; the 3D map was re-checked in the browser.
- `tests/region.test.mjs` (new): facility sources/accuracy flags, snapshot totals 383.01/722.83/52.99, nine dams, and no computed WQI or potable/non-potable labels in UI source. `npm test` now runs 8 tests, all passing.
- `src/styles.css`, `src/components/MapView.css`, `QualityPanel.css`: 44px touch targets at ≤760px or coarse pointer, and a higher-contrast focus ring. Map markers were already keyboard-operable buttons with French aria-labels.

Verified: all five views on desktop; 390px mobile layout through an iframe (Chrome would not shrink the window), with no horizontal overflow and no console errors; touch targets re-measured after the CSS changes.

Source check of `region.json` (primary documents fetched): the 13 and 9 Nov 2026 dam figures, ONEE desalination 275,000 → 400,000 m³/day, M'Zar 11 → 24 Mm³/year target, and the Aourir plant description and coordinates all match. Still UNVERIFIED because the documents were unreachable: the M'Zar 2019 study, the ABHSM 2023 capacities PDF, and the body of the CREM 2017 report. The Chtouka desalination point near Douira is not named in the ONEE release, so its position stays labelled approximate. ORMVASM's undated page says 5 dams / 658 Mm³; this is not comparable with the 9-dam bulletin and is not used as a balance.

Remaining from this phase: search button (35px) and map markers (38px) are slightly under 44px on mobile; no real-device test; the five extra facts found (ONEE works began 2018 and ~1.6 M inhabitants served, Taddart quarry reservoirs planned for 2025–2035, Aourir current flow ~1,600 m³/day) are not yet added to `region.json`.

## Phase 3 — pivot to resource decision support (19 November 2026, uncommitted)

User direction (French, 19 Nov 2026): the core of the product is **strategic decisions on water resources**: when a dam is full or low, look at neighbouring dams that could supply, find which dams feed which neighbourhoods, and show the north–south rainfall imbalance. Water quality is an **annex**, not the core. Also requested: a modern ERP-like design with the exact logo colours, a landing page, a Souss-Massa frame, 3D dam and desalination visuals, rainfall-driven dam-fill prediction, and an operator selector (SRM per region). The user wants the app usable in practice, built the way their "Blackbird terminal" was (reference not located; ask for a path or screenshot).

Done so far (workers: Haiku; orchestrator: Sonnet; advisor: Opus):
- `docs/DESIGN_SPEC.md`; ERP restyle (`tokens.css`, `styles.css`, `Shell.jsx`, pages); landing at `#/` and the app at `#/app/<page>` (hash routing in `App.jsx`); `App.jsx` split into `pages/`, `components/`, `lib/`.
- Souss-Massa frame: `public/data/souss-massa-region.geojson` and `souss-massa-provinces.geojson` (HDX/OCHA COD-AB, CC BY-IGO, 2024-12-19; only 10 of 12 regions in that dataset). Drawn in `MapView.jsx` as boundary, mask and provinces; HDX added to `region.json` sources.
- `GET /api/rain` (`server/rain.mjs`): Open-Meteo modelled rainfall (30 past days, 7 forecast days) for Aoulouz, Agadir and the 9 dam points; 3 h cache; honest failures. Not yet shown in the UI.
- `region.json` updated to the **18 Nov 2026** bulletin (383.13 / 722.83 Mm³, 53.00 %, same day 2025: 19.56 %, region only). Test updated accordingly. Dated bulletin PDFs exist at `maadialna.ma/sites/default/files/barrages/<date>/ar/etat_global.pdf` only for recent dates (found: 31 Oct, 3 Nov, 9–18 Nov; older dates 404), so there is no historical archive there.
- Research notes (Haiku-written, read the UNVERIFIED flags): `docs/research/01-dams-to-service-areas.md`, `02-transfers-and-neighbouring-dams.md`, `03-demand-and-rainfall-gradient.md`, `04-geodata-and-decision-methods.md`.

Key research findings:
- Rain (Open-Meteo ERA5, 2000–2025 mean mm/yr): Chefchaouen 907, Tangier 605, Rabat 431, Marrakech 258, Agadir 237, Taroudant 228, Guelmim 108, Tata 56. Modelled, not station data; free tier is non-commercial.
- Bulletin 18 Nov: national 66.22 %; Sebou 73.72 %; Oum Er-Rbia 59.71 %; Souss-Massa 53.00 %; Draa–Oued Noun 39.69 %. Bulletins are per hydraulic basin, no open basin polygons.
- The only operational inter-basin transfer found is Sebou→Bouregreg (15 m³/s, since Aug 2023). **No physical link from Tensift, Draa or Guelmim into Souss-Massa was found.** Only published conduit inside the basin: the 90 km Aoulouz irrigation canal. Do not present neighbouring dams as able to supply each other.
- About 70 % of Grand Agadir drinking water comes from the Chtouka desalination plant (1,736 l/s), not from dams (La Vie Éco, Feb 2024; fetched). Moulay Abdellah → Tamri plant (1,100 l/s) → 13 km DN1000 line to Agadir (ONEE, Aug 2025; completion unconfirmed). Mokhtar Soussi raising 50 → 281 Mm³, >85 % done (Le360, 15 Oct 2026), commissioning early 2027.
- No public dataset maps quartiers to a dam or treatment plant (provisional: data.gov.ma and operator notices not fully checked). Dead storage per dam is not in open sources; demand per area and per-capita use are weakly sourced.
- No open historical dam-storage series for Souss-Massa (Maa Dialna has no API; data.gov.ma has only a Tensift daily file). Fill-rate prediction stays disabled until a validated history exists.
- 12 SRM operators and phases are in the earlier operator research (only 4 confirmed by fetched sources); Sidi Ifni desalination is in Guelmim-Oued Noun, outside Souss-Massa.

### Phase 3b — regions, national context, satellite (19 Nov 2026, same day)

Added after the user insisted on executing their requests (see `docs/research/05`–`09`):
- **Region selector + "Régions & collaboration" page** (`#/app/regions/<id>`; `src/pages/RegionsPage.jsx`, `src/components/RegionSelector.jsx`, `src/lib/regions.js`). Data: `public/data/regions.json` (12 regions: operator, status/date/evidence level, sources, geometry-derived neighbours, indicative basin, documented desalination, documented transfers), `national-bulletin.json` (all 9 basins, 18 Nov 2026), `morocco-regions.geojson` (geoBoundaries ADM1, ODbL, simplified). Neighbours were computed from geometry (≤3 km between vertices), not from memory. Tests: `tests/regions.test.mjs`; 24 tests pass.
- Collaboration table = **proposal, not fact**: neighbours' basin fill % and the difference in points; "lien documenté" only for Sebou→Bouregreg. No transfer volumes anywhere (tested). Basin↔region attachment is indicative except Souss-Massa.
- **Operator logos: 12/12.** SRM-SM from the government portal; 6 from emploi-public.ma/Commons; 4 supplied by the user (Tanger-Tétouan-Al Hoceima via somei.fr, Rabat-Salé-Kénitra via a LinkedIn image of low resolution, Oriental via anre.ma, Drâa-Tafilalet via brainman.ma). All are owners' trademarks with no reuse licence; provenance in `public/brand/operators/LOGOS.json` and `regions.json`. Weakest: Rabat-Salé-Kénitra (LinkedIn, low-res), Fès-Meknès (8 kB WebP; a sharper PNG with a site watermark was offered by the user and not used).
- **Research results to keep**: no open historical per-dam storage series for Souss-Massa (only 5 Tensift dams, Aug–Oct 2026, in `platform/data-raw/history/`); Maa Dialna bulletins exist as dated image PDFs only from 31 Oct 2026 (no archive, no text layer, no OCR installed). **Start archiving each daily bulletin from now on** (needs OCR, e.g. Homebrew tesseract, or manual reading; ask the user before installing anything). Bulletin gives same-day-2025 fill for the region and for each basin; per-dam 2025 ticks are unlabelled bars.
- **Dam dimensions** (`platform/data-raw/dams/dams-souss-massa.json`, GDW v1.0 CC BY 4.0): capacity, area, height for 10 of 14 dams; dead storage, normal retention level and area–volume curves are absent from every open source found.
- **Satellite proof of concept** (`docs/research/08-satellite-water-extent.md`; scripts were in `/tmp/srmsm-sat/`, lost on reboot): Sentinel-2 L2A via the keyless Earth Search STAC API, NDWI>0, cloud-masked. It measures **water surface area** reliably, but area tracks reservoir **size**, not fill (cross-dam r=0.24 with fill, 0.92 with stored volume, n=6). Claimable: relative change vs the same period of 2025 (Aoulouz, Youssef Ben Tachfine, Moulay Abdellah about +60–70 % surface; Abdelmoumen about ×5; lower bounds for two dams whose OSM outline caps the area). Not possible yet: volume or fill % from area, because each dam's area–capacity curve is unknown and only one dated bulletin was available for calibration. Imi El Kheng and Mokhtar Soussi were not located in OSM. The user's Youssef Ben Tachfine coordinate is ~28 km from the OSM reservoir, Abdelmoumen ~6 km: re-derive dam positions from reservoir polygons before using them. Sentinel-1 radar, JRC Global Surface Water and a browser-side COG reader were not tested.
- **Fill prediction stays disabled.** Needed first: a per-dam calibration from daily bulletins (area vs stored volume, accumulating), plus a backtest by hydrological year against persistence and climatology. Rain drivers exist: `/api/rain` (forecast) and the ABHSM Youssef Ben Tachfine daily rainfall 1967–2024 (ODbL, downloaded for 2 years only, not parsed).
- Privacy note: the satellite worker's Nominatim/Overpass requests carried a User-Agent containing the project name (`srmsm-research-script/1.0`). Use generic names in future requests.
- Mobile (390 px, iframe): no horizontal overflow on all six screens. Remaining under-44px targets were handed to a worker (search button, region source links, MapLibre controls); re-measure.

### Phase 3c — satellite reconstruction and experimental forecast (19 Nov 2026)

Pipeline (Sonnet workers): `platform/pipeline/{satellite,rain,forecast}/` → `public/data/storage-reconstruction.json` and `fill-forecast.json` (schemas in `docs/FORECAST_SCHEMAS.md`) → page `#/app/forecast` (`ForecastPage.jsx`, `lib/forecast.js`). Bulletins: 18 daily PDFs 29 Oct–18 Nov 2026 in `data-raw/bulletins/` (3 days missing, nothing earlier); `pipeline/archive_bulletins.sh` archives new ones (not scheduled). Rain: ERA5 monthly 1990–2026 per catchment (`data-raw/rain/`); ERA5-Land returns null precipitation on Open-Meteo so plain ERA5 (25 km) is used.

**Honest status: usable as a regional order of magnitude, NOT per dam, and the forecast is not decision-grade.**
- Independent validation, 2025-11-18 (same-day-2025 ticks read on the bulletin, ±1 point): Youssef Ben Tachfine −3.2 Mm³ (−8.7 %), Abdelmoumen −14.3 (−67.8 %), Aoulouz +16.1 (+52.5 %), Moulay Abdellah −12.4 (−27.4 %); all four outside their stated uncertainty. Region −14.9 Mm³ (−10.6 % of 141.4 official) only because errors of opposite sign cancel. Press point 2025-06-11: 4-dam sum −36 Mm³ (−24 %), small dams excluded. 2024-02-12: no scene within 7 days.
- Backtest (87 months, leave-one-hydrological-year-out, ridge): MAE model 18.5 / persistence 19.7 / climatology 23.0 Mm³; skill vs persistence 0.057 → the page now says « gain négligeable… à ne pas utiliser pour décider » (threshold `SKILL_MIN` 0.10 in `lib/forecast.js`, not just `beatsBaselines`). It scores the forecast of the reconstruction, not of official storage. Scenarios (30 days from 367.1 Mm³ on 2026-11-18, band ±42): dry 366, normal 374, wet 394 Mm³; releases, irrigation and drinking-water draw are not modelled.
- Root causes: (1) NDWI area saturates at Youssef Ben Tachfine and Abdelmoumen: pair areas equal the 2017–2026 maximum while the dams are about half full (the record covers drought years), so the "max extent = capacity" anchor was wrong by construction; (2) Aoulouz pairs mix 2.2 and 4.3 km² scenes while volume barely moves (tile edge / valid coverage / turbidity); (3) the per-dam bands are fit bands, not error bands — the page shows a « Non validé à l’échelle du barrage » banner with each dam's held-out error.
- **v2 outcome (decided: NOT swapped into `public/`)**: 2025 ticks read on 7 bulletins agree with the 11-18 read within 0.2 point. Split fixed before computing errors (calibration: ticks 10-29, 11-04, 11-12 + 2026 pairs; held-out: 11-01, 11-08, 11-16, 11-18 + press 2025-06-11). Held-out 2025-11-18 error v1 → v2 (Mm³): YBT −3.2 → +16.6 (+44 %), Abdelmoumen −14.3 → −13.6 (invalid: scene predates the 13–16 Nov 2025 rise), Aoulouz +16.1 → −0.7 (−2.4 %), Moulay Abdellah −12.4 → −7.2 (one scene), region −14.9 → −5.5 (−3.9 %, hides YBT +16.6 vs Abdelmoumen −13.6). Aoulouz looks estimable but the held-out dates are nearly identical (2025 stock flat before the rise), so it tests one regime. The Aoulouz problem was a single 50 %-cloud scene on 2026-11-01 (excluded; rule set from reading the problem, not tuned on errors); NDWI>0 is stabler than >0.1 on all four dams. v2 has fit parameters and held-out tables only (no series), in `data-raw/forecast/v2/results.json`. Conclusion: satellite water area is a trend indicator vs the same period of 2025, not a per-dam volume gauge. Next step if pursued: find 2025 bulletins at different fill levels (none online) or per-dam bathymetry/area–capacity curves from ABHSM/DGH; archive daily bulletins from now on so the calibration range widens.
- A v2 recalibration (worker S6) writes to `data-raw/forecast/v2/` and does NOT overwrite `public/`; swap in only if held-out per-dam errors fall inside the bands. It reads 2025 ticks from ~6 bulletins (each daily bulletin carries its own same-day-2025 tick) and cleans Aoulouz scenes.
- ERA5 rain vs the ABHSM Youssef Ben Tachfine station (1990–2024, 408 months): ×1.49 catchment mean, ×1.72 at the dam cell, r≈0.9, much worse in dry months; bias correction is validated only at that one station.
- Processes: a Sentinel-2 series run used `/tmp/srmsm-venv` (lost on reboot; scripts are in `pipeline/`). The satellite/Overpass requests of the first proof of concept carried a User-Agent with the project name; later runs use a generic one.

### Phase 3d — landing, region-driven screens (19 Nov 2026, last pass)

- Landing (`#/`, `src/pages/Landing.jsx`/`landing.css`, rewritten): sticky header, hero with a real cropped screenshot of the overview indicators, three true feature blocks, source registry, "Ce que l'outil ne fait pas encore", licences. Numbers are fetched at runtime from `region.json`, `national-bulletin.json`, `regions.json`. Screenshots in `public/landing/` are real captures taken with headless Chrome (`--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=… --virtual-time-budget=…`); WebGL is unavailable there so the 3D map shows "carte indisponible" — screenshots avoid it. Headless Chrome clamps the window to ≥500 px: test 390 px with an iframe inside a local HTML file. Mobile (390 px) checked: no clipping after hiding bars in tables and the thin hero figure.
- Region selector now drives the Overview and Map screens (`RegionOverview.jsx`, `RegionMap.jsx`, `lib/regions.js`: `parseRoute`, `canonicalHash`…). Hash `#/app/<page>[/<regionId>]`, `souss-massa` omitted. For regions other than Souss-Massa: operator card, indicative basin card, documented desalination, neighbours' basin fill, and a notice that per-dam detail exists only for Souss-Massa. Operator logos are wide: tiles widened (`RegionSelector.css`, `regions.css`).
- Still not region-aware: the weather block (always Agadir), the search palette (Souss-Massa sites), the Quality and Cycle pages (notice only). 3D columns remain illegible at regional zoom and unvalidated; the Chrome extension was disconnected after `/login` with another account, so no browser-driven check of the 3D map was possible in this pass.
- Stopped idle background workers (S2/S3) that were waiting on finished shells; all pipeline outputs parse (`data-raw/satellite/*.json`, `public/data/*.json`). 38 tests pass; `npm run build` passes.

Known defects:
- 3D dam/desalination columns (`MapView.jsx`) are built and rendered (19 features confirmed through a dev-only `window.__srmMap` hook) but are not legible at regional zoom and could not be validated visually; their legend is hidden (`SHOW_COLUMN_LEGEND`). Use the hook plus `flyTo` rather than mouse-driving the camera. The hook uses `import.meta.env.MODE`, because the shell sets NODE_ENV=production so `DEV` is false.
- The landing layout is rough (oversized logo header, spacing, no real screenshot). Mobile re-check of the new design is not done. Operator selector, rain widget in the UI, and Chtouka/Mokhtar Soussi facts in `region.json` are not done.

## Next development work

1. Run the app and review all five navigation views on desktop and mobile. Keep 3D terrain genuinely geographic; avoid fictitious networks or operational readings.
2. Agree the production hosting and identity model before deploying. The current Node/SQLite backend is not a Cloudflare Worker. Deploying via Sites requires adapting server/storage/auth to its supported runtime, rather than publishing the frontend with broken APIs.
3. Add production needs deliberately: HTTPS, backups/restore, secure deployment configuration, email verification/recovery, real team membership, and a security review. Billing/subscriptions are not implemented.
4. Obtain a reliable updated source for reservoir observations and verified sampling stations. Add ingestion with provenance rather than pretending the bundled snapshot is live.
5. Define scientifically appropriate parameter limits by intended use and source before adding alert rules or indices. Temporal prediction requires appropriate timestamped observations and independent validation.
6. Optimize loading: Vite reports a large MapLibre/application bundle. Lazy loading/code splitting is still pending.

## Git state and preservation

Remote: `https://github.com/mouad-abaaqil/WaterQualityProject.git`. Branch: `main`. Original HEAD: `accae5235790e9c503ba85255bc7d1a4ed6ecc36`.

All new implementation and folder organization are local, uncommitted changes. No commit, push or deployment was performed. The original tracked notebook, workbook and requirements were moved into `legacy/`; their content was preserved. Git will show their old paths as removed and their new paths as additions until changes are reviewed/staged. Do not reset or clean the worktree, or drop these new untracked files.

The README from the original commit is preserved as `legacy/README.original.md`. The original license and Git history remain intact. Keep private SQLite files, `.env`, `node_modules/` and `dist/` out of commits.
