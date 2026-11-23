# SRM-SM — Observatoire de l’eau

A local water-resources and water-quality application for Souss-Massa, Morocco, evolving from a RAMSA internship project. Independent prototype, not an officially commissioned company service.

**Continuing in Claude Code? Read [HANDOFF.md](HANDOFF.md) first.** `CLAUDE.md` provides the automatic entry point.

## Folder organization

| Folder | Purpose |
| --- | --- |
| `platform/` | New React/Vite app and Node/SQLite API |
| `platform/src/` | Landing, ERP interface, 3D map, region selector and forecast pages |
| `platform/server/` | Authentication, private observations, CSV, weather and rainfall API |
| `platform/public/` | Datasets (`data/`), company and operator logos (`brand/`), landing screenshots |
| `platform/pipeline/`, `platform/data-raw/` | Scripts and dated raw data behind the satellite and rainfall figures |
| `platform/tests/` | API, data-integrity, region and forecast tests (38) |
| `docs/` | Index, research notes, design spec, schemas, history |
| `legacy/` | Original notebook, workbook, Python requirements and original README |

## Run locally

Use Node 24 or newer. Last verified on Node 26.3.0.

```sh
cd platform
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The API runs on port 8787. Create an account to save private analyses; there are no default credentials.

```sh
npm test
npm run build
npm start
```

After building, `npm start` serves the complete app and API at `http://127.0.0.1:8787`. Environment-variable names are in `platform/.env.example`; `.env` is not loaded automatically.

## Current capabilities

- Actual 3D terrain with MapLibre, OpenFreeMap and Mapterhorn, plus 2D switching and facility layers.
- Landing page, ERP-style interface in French with the exact SRM-SM logo colours.
- Nine dams, one desalination plant, two wastewater plants and two groundwater reference areas, with the official Souss-Massa boundary and provinces.
- Region selector for the 12 Moroccan regions: responsible SRM operator with dated status, evidence level, sources and logo; national basin ranking; neighbouring regions as an analysis proposal (never a physical link).
- Dated reservoir figures, rainfall (modelled) per dam and the north–south gradient, satellite water-surface trend and an experimental forecast with its validation shown.
- Private local accounts, persistent water-quality observations (an annex), CSV import/export and measurement graphs.

The bundled reservoir bulletin is dated **18 November 2026**. It is not a live sensor feed. Facility positions are approximate; groundwater markers are schematic areas. No chemical readings are prefilled and no potability score is calculated.

## Sources and methodology

Start with [the documentation index](docs/README.md). Exact source URLs, dates and limitations are also stored in `platform/public/data/region.json`.

The original notebook's workbook is preserved under `legacy/`; it does not substantiate the eight-dam monitoring system in the historical brief. Its experimental weighted-sum WQI is not used by the new application.

## Status

The local build and API tests pass. This is a development MVP: hosted deployment, billing, team membership, email verification/recovery, automatic reservoir ingestion and live laboratory/sensor feeds remain to be implemented. See [HANDOFF.md](HANDOFF.md) for evidence and remaining checks.

No commits, pushes or deployment have been performed for this revival. Private SQLite files, dependencies and build outputs are ignored by Git.

## Origin and licensing

The original project was developed during an internship at RAMSA in Agadir. The original README is preserved verbatim in [legacy/README.original.md](legacy/README.original.md), and the Git history remains intact.

The original [MIT license](LICENSE) applies to code as stated there. Third-party datasets, tiles and logo assets retain their own rights and attribution requirements. The SRM-SM logo remains the property of its owner. Free hosted Open-Meteo access is non-commercial; commercial SaaS deployment requires suitable service terms.
