# Dam dimensions: Souss-Massa and neighbouring basins (research note 07)

Prepared 2026-11-19. Machine-readable output: `platform/data-raw/dams/dams-souss-massa.json`. Every value there carries its source, URL, date and licence. Null means "not found in any source checked on 2026-11-19", not "the dam has no such value".

## 1. What was obtained

- **GDW v1.0** (Global Dam Watch, Figshare, published 2024-07-25, CC BY 4.0). The shapefile was downloaded and the barriers DBF parsed. Morocco rows: 76. The brief named v1.3; only v1.0 was publicly downloadable from Figshare. Field names are upper case in the DBF (`CAP_MCM`, `AREA_SKM`, `DAM_HGT_M`, `DAM_LEN_M`, `CATCH_SKM`, `ELEV_MASL`). Missing values are -99.
- **Wikipedia FR** for Mokhtar Soussi and Youssef Ben Tachfine (fetched, summarised by the fetch tool).
- **RCC Dams** and **Structurae** for Aoulouz; **Structurae** for Moulay Youssef.
- **JICA** Table VI1.1 (via the existing note 01, source S2) for Dkhila, Imi El Kheng, Sidi Abdellah and the JICA values for Abdelmoumen.
- **ABHSM press release** (16 Jan 2026) and **MAP** article (3 Feb 2026) for Mokhtar Soussi raising. Both were already in note 01.

## 2. Not obtained

- **HydroLAKES**: not downloaded. GDW carries `HYLAK_ID`, so the link exists, but the volumes were not read.
- **OSM** reservoir polygons: the Overpass query returned a non-JSON response.
- **ICOLD** and the **DGH registre**: not reached.
- **Second sources** for Lalla Takerkoust, Mansour Eddahbi, Sidi Driss and Hassan Addakhil: the guessed Wikipedia FR and Structurae titles returned 404 or index pages. Their values are GDW only.
- **Not in GDW by name**: Mokhtar Soussi (only Wikipedia/ABHSM), Dkhila, Ahl Souss, Imi El Kheng, Sidi Abdellah. A name search of the Morocco rows found no match. "Sidi Mohamed Ben Abdellah" in GDW is a different dam on the Bou Regreg and must not be matched to Sidi Abdellah.

## 3. Table (values as sourced; null = not found)

Capacity is the normal-retention or GDW representative value unless the note says otherwise. Area is GDW `AREA_SKM` (= `AREA_POLY`) unless stated. Ratio = Mm³/km², numerically the mean depth in m.

| Dam | Basin | Capacity (Mm³) | Height (m) | Crest length (m) | Area (km²) | Catchment (km²) | River | Year | Type | Purpose | Ratio Mm³/km² |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aoulouz | Souss-Massa | 110 (RCC, GDW); 108 (snippet) | 79 | 476 (RCC "Length") | 3.261 | 4,466 | Souss | 1991 | Gravity, concrete | Flood control, GW recharge, irrigation | 33.7 |
| Mokhtar Soussi | Souss-Massa | 50 (pre-raise, Wikipedia FR); 281 target (ABHSM) | 62 | null | 8.74 (post-raise, MAP "c. 874 ha") | null | Aouzioua | 2001 | Earth/rockfill, concrete face | Irrigation | 32.2 PROVISIONAL |
| Abdelmoumen | Souss-Massa | 216 (GDW, JICA) | 94 | null | 3.702 | 1,313 | Issen | 1981 | Concrete | Hydro, irrigation, drinking | 58.4 |
| Youssef Ben Tachfine | Souss-Massa | 320 (GDW); 303.5 (Wikipedia) | 85 | null | 6.171 | 3,878 | Massa | 1972 | Embankment | Irrigation, drinking, industrial | 51.9 (GDW); 49.2 (cross-source) |
| Dkhila | Souss-Massa | null (JICA present 0.7) | 32 | null | null | null | null | 1986 | Earth-fill | Regulates Abdelmoumen | null |
| Ahl Souss | Souss-Massa | null | null | null | null | null | null | null | null | null | null |
| Imi El Kheng | Souss-Massa | 12 (JICA present); regulated 4.5 | 39 | null | 10.0 (JICA "1,000 ha") SUSPECT | null | Oued Berhil | 1993 | code BCR | Irrigation, GW recharge | 1.2 NOT USABLE |
| Moulay Abdellah | Souss-Massa | 110 (GDW) | 65 | 325 | 5.859 | 1,248 | Ougar | 2004 | Dam (GDW) | Water supply | 18.8 |
| Sidi Abdellah | Souss-Massa (Ouaar) | null (JICA regulated 10) | 65 | null | null | null | Ouaar | 1965 (UNVERIFIED) | Earth-fill | Aquifer recharge, programmed in JICA text | null |
| Lalla Takerkoust | Tensift | 96 (GDW) | 71 | null | 4.789 | 1,699 | N'Fis | 1935 | Dam (GDW) | Irrigation | 20.1 |
| Moulay Youssef | Tensift | 200 (GDW) | 100 | null | 3.618 | 1,405 | Tessaout | 1969 (Structurae 1970) | Embankment (Structurae) | Hydro, irrigation, drinking | 55.3 |
| Sidi Driss | Tadla / Tensift area | 7 (GDW) SUSPECT | 42 | null | 4.583 | 1,683 | Lakhdar | 1984 | Dam (GDW) | not given | 1.5 SUSPECT |
| Mansour Eddahbi | Draa-Oued Noun | 592 (GDW); 445–530 (snippets) | 70 | null | 33.506 | 14,962 | Draa | 1972 | Dam (GDW) | Irrigation | 17.7 (14.9 with 500) |
| Hassan Addakhil | Ziz (Meknes-Tafilalet in GDW) | 380 (GDW) | 85 | null | 5.343 | 4,404 | Ziz | 1971 | Dam (GDW) | Irrigation | 71.1 |

The Guelmim–Oued Noun dams were not identified by name. Two unnamed GDW records sit in the Souss-Massa-Draâ admin unit (GDW_ID 9284: 18.7 Mm³, 1.18 km²; 39012: 40 Mm³, 2.42 km²) at 30.67°N 8.53°W and 30.73°N 7.98°W. They are not matched to any dam and are listed in the JSON only.

Coordinates for GDW dams are river points (`LAT_RIV`, `LONG_RIV`), because the dam-point fields are 0 for these rows. Structurae and Wikipedia DMS coordinates were converted and are in the JSON.

## 4. Area–volume ratio (order-of-magnitude only)

Computed only where both capacity and normal-level area are sourced. Each ratio is an order-of-magnitude shape assumption (volume ÷ area ≈ mean depth). It is **not** a measured bathymetric curve. GDW's area is a consolidated polygon area, not a documented normal-level surface, and GDW's capacity can be a statistical estimate where none was reported (GDW technical documentation, section 2.7).

- Aoulouz 33.7 and Youssef Ben Tachfine 51.9 use GDW for both values, so the pair is internally consistent.
- Mokhtar Soussi 32.2 uses the raised target (281 Mm³) and the post-raise surface (c. 874 ha). The raise is not commissioned and the capacity sources conflict. Treat as provisional.
- Imi El Kheng 1.2 is not usable: the JICA surface of 1,000 ha is probably not the reservoir surface.
- Sidi Driss 1.5 is suspect: 7 Mm³ does not fit a 42 m dam with 4.6 km².
- All other ratios are GDW-only and carry the GDW caveats above.

## 5. Conflicts (not resolved)

1. **Aoulouz capacity**: 110 Mm³ (RCC, GDW) vs 108 Mm³ (Infomediaire snippet; note 01 cites CIHEAM snippet 108).
2. **Aoulouz completion**: 1990 (Structurae) vs 1991 (RCC, GDW, Infomediaire).
3. **Aoulouz area**: GDW polygon 3.261 km² vs GDW reported 0.5 km².
4. **Aoulouz dam volume**: Structurae lists 850,000 m³. This is a dam body volume, not storage.
5. **Mokhtar Soussi capacity**: 50 Mm³ base (Wikipedia, MAP) vs 281 Mm³ target (ABHSM 16 Jan 2026; Le360 PLF 2027 gives 280). MAP's "sept fois" (seven times) contradicts 281/50 = 5.6.
6. **Youssef Ben Tachfine capacity**: 320 Mm³ (GDW) vs 303.5 Mm³ (Wikipedia FR; JICA/CIHEAM snippets 303). GDW `CAP_MIN` is 300.
7. **Youssef Ben Tachfine reservoir altitude**: 96 m (Wikipedia, meaning unclear) vs 97 m (GDW DEM-derived `ELEV_MASL`).
8. **Abdelmoumen capacity**: 216 Mm³ (GDW, JICA present capacity) vs 198.4 and 142.8 (snippets, note 01). Area: GDW polygon 3.7 km² vs GDW reported 8.0 km².
9. **Dkhila**: JICA present capacity 0.7 Mm³. Press fill percentages (Mar 2025: 0.158 Mm³ = 79%) imply about 0.2 Mm³. That is arithmetic, not a stated value; not used.
10. **Imi El Kheng surface**: JICA 1,000 ha is inconsistent with 12 Mm³ at 39 m.
11. **Sidi Abdellah**: JICA table lists it with a 1965 start, while the text says "programmed, not built". Current status unverified.
12. **Sidi Driss**: GDW capacity 7 Mm³ vs 42 m height. GDW reported area 10 km² vs polygon 4.6 km².
13. **Mansour Eddahbi capacity**: GDW 592 Mm³ (CAP_MIN 560) vs 500, 530 and 445.3 Mm³ in search snippets (note 02; not opened). Area: GDW polygon 33.5 km² vs reported 49 km².
14. **Hassan Addakhil**: GDW CAP_MCM 380 vs CAP_REP 369.
15. **Moulay Youssef year**: 1969 (GDW) vs 1970 (Structurae).
16. **Moulay Abdellah**: GDW gives 110 Mm³ and 65 m; existing note 01 gives no capacity. Not in JICA.

## 6. Null fields

Dead storage (volume mort) was not published for any dam. The JICA "regulated volume" is not dead storage and is kept as a separate field. Crest elevation and normal retention level (m NGM) were not published for any dam. GDW `ELEV_MASL` is a DEM-derived reservoir-surface minimum and is not used as a normal level. Crest length is null except where stated.

## 7. Licences

- GDW: CC BY 4.0 (Figshare metadata).
- Wikipedia FR: CC BY-SA 4.0 by default; not checked on the page.
- RCC Dams, Structurae, MAP, ABHSM and JICA: licence not stated or not checked. Treat as all rights reserved until checked.

## 8. Next steps

- Download HydroLAKES and read `Vol_total` and `Lake_area` for the matched `HYLAK_ID`s.
- Retry OSM Overpass with a smaller query, or use an extract.
- Obtain the ABHSM or DGH fiche technique for Mokhtar Soussi, Dkhila, Ahl Souss, Imi El Kheng and Sidi Abdellah.
- Check the GDW v1.3 release if it becomes available, since the brief named it.
