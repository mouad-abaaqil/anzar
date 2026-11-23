# 09 - National dam stock (bulletin 2026-11-18), desalination inventory, and basin-to-region mapping

Prepared 2026-11-19. Research and data provenance only. Nothing here is a live reading, a pipeline route, a quality score or an official commissioning claim. Where sources disagree, both values are kept and dated.

Source tiers used: primary = ONEE, Ministère de l'Équipement et de l'Eau, MAP, Le360, Hespress (the permitted list). Secondary = Medias24, Ledesk, H24info, SNRT, Le Matin, or any search-result summary I did not open in full. "Fetched = yes" means I opened the article and read it.

## Part A - National dam stock, bulletin of 2026-11-18

- Source: https://maadialna.ma/sites/default/files/barrages/2026-11-18/ar/etat_global.pdf (12 pages; footer "وزارة التجهيز والماء والغابات").
- Method: the PDF has no text layer. Pages rendered with `pdftoppm -r 110` and read visually. Values were checked arithmetically: the nine basin stored volumes sum to the national stored total (11,276.32 vs 11,276.31, rounding); the nine basin capacities sum exactly to 17,027.59; every basin fill % reproduces from stored/capacity; every basin's dam volumes sum to its total.
- Full transcription, `transcribedFrom` per page, and per-row flags: `platform/data-raw/national/bulletin-2026-11-18.json`.

National (page 1 for fill and same-day, page 2 for volumes):

| Item | Value |
|---|---|
| Fill | 66.22 % |
| Stored | 11,276.31 Mm3 |
| Capacity | 17,027.59 Mm3 |
| Same day 2025 | 31.13 % |
| Change vs same day 2025 (printed) | +112.7 % |

Basins (pages 4-12; page 3 is the ranking):

| Page | Basin (AR / FR) | Fill % | Stored Mm3 | Capacity Mm3 | Same day 2025 |
|---|---|---|---|---|---|
| 4 | أم الربيع / Oum Er-Rbia | 59.71 | 2,987.52 | 5,003.37 | 8.69 % |
| 5 | اللوكوس / Loukkos | 72.13 | 1,411.31 | 1,956.55 | 44.46 % |
| 6 | ملوية / Moulouya | 71.98 | 504.96 | 701.49 | 27.70 % |
| 7 | سبو / Sebou | 73.72 | 3,958.96 | 5,370.33 | 41.70 % |
| 8 | أبي رقراق / Bouregreg | 76.11 | 1,121.41 | 1,473.39 | 46.78 % |
| 9 | تانسيفت / Tensift | 81.00 | 164.56 | 203.17 | 48.91 % |
| 10 | سوس - ماسة / Souss-Massa | 53.00 | 383.13 | 722.83 | 19.56 % |
| 11 | درعة - واد نون / Drâa-Oued Noun | 39.69 | 416.05 | 1,048.18 | 28.22 % |
| 12 | كير- زيز- غريس / Guir-Ziz-Ghriss | 59.90 | 328.42 | 548.28 | 46.33 % |

Nine basins, 69 dam rows. The Sahara basin is not in the bulletin, and the nine capacities sum exactly to the national capacity.

Dam names: French equivalents are my transliterations, not printed in the bulletin. Several are marked "unverified" in the JSON. Corrections made after review: "سد على واد زا" is a barrage on the Oued Za ("على" means "on"); "أكدز" is Agdz; "م. لحسن بن المهدي" has an unverified expansion of "م.".

Reading flags (lower confidence):
- White labels on pale bars: Imfout 12.97, Jamaa 17.94, Toudghi 8.92, Hamar 5.34, Imi El Khenk 30.47, Mokhtar Soussi 10.61, Touizgui Ramz 25.38, Moulay Ali Cherif 22.14.
- Barrage on the Oued Za (page 6) reads 100.00 % with 87.92 Mm3 stored.
- "+112.7 %" (page 2) is a printed comparison with the same day in 2025, read as a relative change in stored volume.

## Part B - Sea-water desalination by region

Status is given with the date of the source, because sources conflict and the most recent primary item is dated 29 Oct 2026. Dates below are publication dates unless noted.

Aggregates, which conflict:
- Le360, 13 May 2025 (fetched): 16 stations, 277.12 Mm3/yr; 5 projects under construction; Casablanca 300 Mm3/yr, works launched 10 June 2024; five projects 430.15 Mm3/yr.
- Hespress, Aug 2025 (fetched; ministerial reply late July 2025): 17 stations, 320 Mm3/yr; four under construction, 532 Mm3/yr; target 1.7 billion m3/yr by 2030.
- Le360, undated in fetch (fetched): 12 stations, 179 Mm3/yr plus about 37 Mm3/yr brackish water.
- Hespress, 29 Oct 2026 (fetched): national target 1.8 billion m3 by 2031; the article gives no station capacities and describes no station as operational.
- Mobile units: 244 units, about 1,563 l/s (Hespress, secondary summary).

Units: national targets are billions of m3/yr. Station capacities are m3/day unless stated.

| Region | Site | Status (as of, source) | Capacity (as stated) | Date | Operator | Source | Fetched |
|---|---|---|---|---|---|---|---|
| Souss-Massa | Agadir / Chtouka Aït Baha | Operational since 29 Jan 2022 (Le360, 30 Jan 2022). Extension to 400,000 m3/d announced, no date (Le360 search summary, 2 Nov 2026, secondary) | 400,000 m3/d at term, split equally drinking/irrigation (Le360 2022); 275,000 m3/d currently (Hespress, secondary) | 2022 | PPP; ONEE and Ministry of Agriculture as partners (Le360 2022); ORMVA/SM announced | fr.le360.ma/economie/...-254009 | yes (2022 article) |
| Souss-Massa | Region-wide programme | Planned (Hespress 29 Oct 2026 lists Souss-Massa among renewable-powered new stations, commissioning 2029-2030) | not stated | 2029-2030 | not stated | hespress.com/494317 | yes |
| Laâyoune-Sakia El Hamra | Laâyoune | Operational (Le360 aggregate, undated) | 26,000 m3/d (Ledesk, secondary); ONEE Dec 2025 presentation cites 52,000 m3/d (secondary) | not confirmed | ONEE (per Ledesk; not in fetched text) | le360.ma/...WKKL3I3N3RDLFF3AQVXZ65PK2U (fetched, undated, no capacity) | partial |
| Laâyoune-Sakia El Hamra | Boujdour, Tarfaya | Boujdour operational; Tarfaya planned extension (Le360 undated; Tarfaya capacity secondary) | Tarfaya 1,300 m3/d (secondary) | not stated | not stated | le360.ma (fetched) | partial |
| Dakhla-Oued Eddahab | Dakhla | Conflicting. Hespress 29 Oct 2026 (latest primary): planned, due to enter service 2027. Hespress Aug 2025: under construction about 78 %, mid-2026. Le360 15 Apr 2025: "bientôt opérationnelle", 37,000 (unit not stated). A Le360 item dated 2 Mar 2026 reporting commissioning appeared in search only; not opened, so not used | 112,000 m3/d (Medias24 May 2024, secondary); first unit 17,300 m3/d 2015 (ONEE brochure, secondary) | 2027 per latest primary | PPP, wind-powered (60 MW) | hespress.com/494317 (fetched); hespress.com/437711 (fetched); le360 Apr 2025 (fetched) | yes |
| Guelmim-Oued Noun | Tan-Tan | Existing, small/medium (Le360 undated) | not stated | not stated | not stated | le360.ma (fetched) | yes |
| Guelmim-Oued Noun | Guelmim | Planned (Le360 May 2025; Hespress 29 Oct 2026 lists Guelmim-Tan-Tan among renewable-powered new stations, 2029-2030) | not stated | 2029-2030 | not stated | le360 May 2025 (fetched); hespress.com/494317 (fetched) | yes |
| Guelmim-Oued Noun | Sidi Ifni | Being launched or commissioned (Le360 undated) | 8,640 m3/d, extensible to 17,280 (ONEE, secondary) | not stated | ONEE (secondary) | le360.ma (fetched); h24info (secondary) | partial |
| Casablanca-Settat | Grand Casablanca (Dar Bouazza per request; location not confirmed in sources) | Conflicting. Le360 May 2025: works launched 10 June 2024. Hespress Aug 2025: about 40 % complete, commissioning end 2026. Hespress 29 Oct 2026: first tranche planned, launch 2027 | 300 Mm3/yr (Le360, Hespress); 548,000 m3/d in a secondary presentation. The request's "548 Mm3/an" appears to be m3/d | 2026 or 2027 (conflict) | PPP; no operator named | le360 May 2025 (fetched); hespress.com/437711 (fetched); hespress.com/494317 (fetched) | yes |
| Casablanca-Settat | El Jadida (Jorf Lasfar) | Partly operational since 2023; extension supported by OCP; full capacity expected end 2026 (Hespress Aug 2025) | not stated | end 2026 (Aug 2025 forecast) | Ministry of Equipment and Water with OCP | hespress.com/437711 (fetched) | yes |
| Marrakech-Safi | Safi and Jorf Lasfar (combined) | Operational (Le360 undated). Safi extension to supply Marrakech planned, 2027 (Hespress 29 Oct 2026) | 110 Mm3 combined (Le360, undated); Safi 26,000 m3/d (secondary) | 2027 (extension) | OCP group (Le360); Ministry with OCP (Hespress) | le360.ma (fetched); hespress.com/494317 (fetched) | yes |
| Marrakech-Safi | Essaouira | Planned; study finalised (Le360 May 2025) | not stated | not stated | not stated | le360 May 2025 (fetched) | yes |
| Tanger-Tétouan-Al Hoceima | Tanger | Planned; studies finalised (Hespress Aug 2025); renewable-powered, 2029-2030 (Hespress 29 Oct 2026) | not stated | 2029-2030 | not stated | hespress.com/437711; hespress.com/494317 (both fetched) | yes |
| Tanger-Tétouan-Al Hoceima | Al Hoceima | Operational (Le360 undated) | 17,280 m3/d (ONEE 2021 brochure, secondary) | 2020 (secondary) | not stated | le360.ma (fetched) | partial |
| Oriental | Nador, Saïdia | Not found. Nador appears only in a secondary summary at 250 Mm3/yr | not found | not found | not found | not found | no |
| Oriental | Regional programme | Planned; renewable-powered, 2029-2030 (Hespress 29 Oct 2026) | not stated | 2029-2030 | not stated | hespress.com/494317 (fetched) | yes |
| Rabat-Salé-Kénitra | Rabat | Planned (Le360 May 2025; Hespress 29 Oct 2026 lists Rabat among renewable-powered stations, 2029-2030) | not stated | 2029-2030 | not stated | le360 May 2025; hespress.com/494317 (both fetched) | yes |

Notes:
- No primary source gave Dar Bouazza, Nador or Saïdia capacities. The Dar Bouazza location in the request is not confirmed.
- Medias24 (2024), Ledesk, h24info and SNRT figures are secondary and not used for status.

## Part C - Hydraulic basins (ABH) and the regions they mostly cover

Basins and administrative regions do not coincide. A basin often crosses several regions, and a region is often split between basins. The table below is indicative.

What the primary sources establish:
- Loi 36-15 on water (consolidated version of 30 July 2025, fetched): the zone of action of each ABH, its operating mode and its seat are fixed by regulation. The law does not list the regions. The zone is defined as a basin or set of basins.
- Arrêté conjoint n° 852 of 11 Sept 2003 (fetched and extracted with pdftotext): assigns public hydraulic domain assets to the Souss-Massa ABH within its zone of action; the list of dams is in an annex that is not in the extracted text. It does not define regional coverage.
- Decree n° 2-00-480 of 14 Nov 2000 (search summary only, not fetched): set the Souss-Massa zone as the Souss-Massa basin, seat Agadir.
- ABH Souss-Massa communiqué, 16 Jan 2026 (fetched): the agency's work covers the Souss-Massa region, including Tiznit province (Sidi Yaâcoub dam project) and the Mokhtar Soussi dam.
- Moulouya basin covers most of the Oriental region, including Nador, Figuig, Jerada, Oujda-Angad and Berkane-Taourirt (search summary; not fetched).
- Sebou agency seat: Fès (search summary).

Indicative mapping (the regions column is background knowledge unless marked):

| ABH (basin) | Regions mostly covered (indicative) | Verification |
|---|---|---|
| Loukkos | Tanger-Tétouan-Al Hoceima; part of Rabat-Salé-Kénitra | Background, unverified |
| Sebou | Fès-Meknès; part of Rabat-Salé-Kénitra | Seat Fès from search summary; boundaries unverified |
| Bouregreg-Chaouia | Rabat-Salé-Kénitra; part of Casablanca-Settat | Background, unverified |
| Oum Er-Rbia | Béni Mellal-Khénifra; part of Casablanca-Settat; part of Marrakech-Safi | Background, unverified |
| Tensift | Marrakech-Safi | Background, unverified |
| Souss-Massa | Souss-Massa (including Tiznit province) | Partly verified: ABH communiqué 16 Jan 2026 and decree 2-00-480 (summary). Guelmim-Oued Noun extent unverified |
| Drâa-Oued Noun | Guelmim-Oued Noun; part of Drâa-Tafilalet | Background, unverified. An amending decree uses "Souss-Massa-Drâa" (search summary) |
| Guir-Ziz-Ghriss | Drâa-Tafilalet (Errachidia area) | Background, unverified |
| Moulouya | Oriental (most of it) | Verified via search summary |

Basins outside the bulletin's nine (Sahara; Laâyoune-Sakia El Hamra and Dakhla-Oued Eddahab territories) do not have a confirmed ABH assignment in the sources reviewed.

## Open items

1. Obtain the annex of Loi 36-15's implementing decree (or the ABH zone decrees, including Decree 2-00-480 and its amendment) to confirm Part C.
2. Confirm the Dakhla commissioning status: the 2 Mar 2026 Le360 item and the 29 Oct 2026 Hespress "planned for 2027" conflict.
3. Confirm Casablanca first-tranche status and location against an ONEE or ministry communiqué.
4. Obtain capacities for Laâyoune, Tan-Tan, Boujdour and Sidi Ifni from ONEE, since the only figures are secondary.
5. Locate ministry or ONEE figures for Nador and Saïdia.
6. Verify the French dam names against a published ministry dam list before use.
