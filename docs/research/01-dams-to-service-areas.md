# Souss-Massa: which dam feeds which water systems (research note)

Prepared 2026-11-19. Scope: dam -> drinking-water plant/scheme -> served cities/communes -> irrigation -> allocations -> operator. Built from fresh searches and fetches only. `platform/public/data/region.json` was not consulted.

**Read this first**

- No source found in this pass gives a complete dam-to-commune mapping for the basin. Most "which dam feeds which city" statements below come from press articles, and several are summaries of a fetched page rather than the page text itself.
- Several dam capacities and allocations conflict across sources. Conflicts are listed, not resolved.
- Sources marked **fetched** were opened (PDF downloaded and read with `pdftotext`, or a web page fetched). The fetch tool returns model-written summaries of web pages, so quotes from web pages are reliable only for the fact that the sentence exists. Sources marked **snippet** were seen only in search results and were not opened.
- Several primary sites returned 403, refused connections or DNS failures (abhsm.ma, ORMVASM, CIHEAM, Medias24 2022, Telquel 2025/2026, Ledesk). Those are listed under "not reached".

## 1. Source register

| ID | Document | Date | URL | Status |
|---|---|---|---|---|
| S1 | ABHSM board press release (Conseil d'administration, session 2025) | 16 Jan 2026 | https://abhsm.njt-group.com/uploads/communiques_presse/1/attachment/fr/1781176181_sg8knkgm_cp-ca-abhsm-vfr-fin-f.pdf | **fetched** (PDF downloaded, read with pdftotext; local copy `/private/tmp/srmsm-dams-research/abhsm_cp.pdf`) |
| S2 | JICA, *Étude de faisabilité ... barrages moyens dans le milieu rural*, Vol. III, Rapport de soutien VI, Table VI1.1 (large dams, list incl. Souss-Massa basin) | **UNVERIFIED** (report date not on the extracted pages; content predates Mokhtar Soussi's 2002 start, so likely early 2000s) | https://openjicareport.jica.go.jp/pdf/11657632_15.pdf | **fetched** (PDF downloaded and read; local copy `/private/tmp/srmsm-dams-research/jica_15.txt`) |
| S3 | MAP article, "Taroudant: le barrage Mokhtar Soussi, un ouvrage hydraulique structurant" | 3 Feb 2026 | https://www.maroc.ma/index%2Ephp/fr/actualites/taroudant-le-barrage-mokhtar-soussi-un-ouvrage-hydraulique-structurant-au-bassin-de-souss-massa | **fetched** (summarised by fetch tool) |
| S4 | Le360, Mokhtar Soussi raising above 85% | 15 Oct 2026 | https://fr.le360.ma/economie/taroudant-les-travaux-de-surelevation-du-barrage-mokhtar-soussi-depassent-85-davancement_VGO7RRUJ5RGCJNWAFB52XM5LGE/ | **fetched** |
| S5 | La Vie Eco, "Souss-Massa: 3 milliards de dirhams d'investissements dans l'eau" | 25 Feb 2024 | https://www.lavieeco.com/affaires/souss-massa-3-milliards-de-dirhams-dinvestissements-dans-leau/ | **fetched** |
| S6 | La Vie Eco, "Eau: investissements massifs dans le Souss-Massa" | 19 Jan 2026 | https://www.lavieeco.com/affaires/secteurs/eau-investissements-massifs-dans-le-souss-massa/ | **fetched** |
| S7 | Hespress FR, "Agadir: l'ONEE lance les travaux pour sécuriser l'eau potable à partir du barrage Moulay Abdellah" | 20 Aug 2025 | https://fr.hespress.com/438182-agadir-lonee-lance-les-travaux-pour-securiser-leau-potable-a-partir-du-barrage-moulay-abdellah.html | **fetched** |
| S8 | Telquel, ONEE 132 MDH project for Agadir | 21 Aug 2025 | https://telquel.ma/instant-t/2025/08/21/souss-massa-lonee-lance-un-projet-de-132-millions-dh-pour-securiser-leau-potable-dagadir_1947184/ | snippet only (fetch 403) |
| S9 | CIHEAM document on Souss-Massa dams and irrigation (Youssef Ben Tachfine 303 Mm3, 88 Mm3/yr; Aoulouz 108 Mm3; Chtouka 18,050 ha) | year and authors UNVERIFIED | https://ressources.ciheam.org/ressources/om/pdf/b59/00800709.pdf | snippet only (domain did not resolve) |
| S10 | Hespress FR, Chtouka desalination 275,000 m3/day | c. 2024 (exact date UNVERIFIED) | https://fr.hespress.com/384157-384157.html | snippet only |
| S11 | Telquel, Souss-Massa reservoirs 406 Mm3 (54.8%) | 18 Feb 2026 | https://telquel.ma/instant-t/2026/02/18/souss-massa-les-retenues-des-barrages-depassent-406-millions-m3_1975718/ | snippet only (fetch 403) |
| S12 | Medias24, irrigation suspension by dam | 3 Nov 2022 | https://medias24.com/2022/11/03/voici-une-analyse-des-barrages-concernes-par-la-suspension-de-lirrigation/ | snippet only (fetch 403) |
| S13 | Medias24/SNRT/FNH/Le360 on the SRM (société régionale multiservices) reform | 2024 to 2025 | e.g. https://fnh.ma/articles/srm-134-44-milliards-de-dh-d-investissements-programmes-d-ici-2030 ; https://medias24.com/2024/07/17/srm-souss-massa-un-capital-de-150-mdh-et-un-programme-previsionnel-dinvestissement-de-197-mmdh/ | snippet only |

Not reached: abhsm.ma (connection refused), ORMVASM (no site found), afrik21 (empty page), Ledesk ?p=296530 (403), Medias24 2024/2022 pages (403), CIHEAM (DNS failure).

## 2. Dam-by-dam findings

Columns: fact | value | unit | source (ID, date) | verified by fetch.

### 2.1 Youssef Ben Tachfine (Massa)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type, start of service | Earth-fill, 1972 (JICA); CIHEAM snippet gives 1973 | year | S2 (date UNVERIFIED); S9 snippet | yes (S2); no (S9) |
| Height | 85 | m | S2 | yes |
| Regulated volume | 90.00 | Mm3 | S2 (column header read as "Regulated volume") | yes |
| Present capacity | 303.5 | Mm3 | S2 | yes. Search snippets give 296, 298.9 and 303 Mm3; these conflict |
| Use code | I, AEPI (irrigation and drinking water) | code | S2 | yes |
| Drinking-water role | Supplies Tiznit region; strengthening project "en phase d'achèvement" | qualitative | S6 (19 Jan 2026): "un projet de renforcement à partir du barrage Youssef Ibn Tachfine est en phase d'achèvement" | yes (summary) |
| Drinking-water role, Tlat Lakhssas and Sidi Ifni | Claimed in a KfW/ONEE snippet | qualitative | search snippet only (no URL opened) | no. UNVERIFIED |
| Irrigation | Chtouka perimeter (c. 18,050 ha) served via pumping station SP1 and a 44 km main canal; 85 Mm3/yr agriculture and 3 Mm3/yr drinking water (88 Mm3/yr regulated) | Mm3/yr | S9 snippet only | **no. UNVERIFIED** |
| Irrigation to Massa/Chtouka | Stopped 2019 (undated in the search summary) | year | search summary only | no. UNVERIFIED |
| Operator | ONEE (historic, drinking water); no primary source on current operator for this dam | | | UNVERIFIED |

Conflict: CIHEAM (snippet) and JICA give different start years (1972 vs 1973). Drinking-water allocation: 3 Mm3/yr (snippet) vs "Youssef Ben Tachfine ... Tiznit" with no figure (S6). Treat the 3 Mm3/yr figure as UNVERIFIED.

### 2.2 Mokhtar Soussi (Taroudant province, Ouzioua valley, c. 100 km east of Taroudant)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Operational since | 2002 | year | S3 (3 Feb 2026) | yes |
| Capacity before raising | 50 | Mm3 | S3 | yes |
| Capacity after raising (target) | 281 | Mm3 | S1 (16 Jan 2026), S3, S4 (15 Oct 2026) | yes. S3 also says "sept fois" (seven times), which contradicts 281/50 = 5.6 |
| Surface after raising | c. 874 | ha | S3 | yes |
| Mean annual inflow | 133 | Mm3/yr | S3 | yes |
| Raising progress | 77% (S1, Jan 2026); >75% (S3, Feb 2026); >85% (S4, Oct 2026) | % | S1, S3, S4 | yes |
| Commissioning | early 2027 | date | S3, S4 | yes |
| Cost (civil works) | c. 1.3 bn MAD (S3); 1.19 bn MAD (earlier snippet) | MDH | S3 | yes (S3); conflict noted |
| Works started | May 2021 (snippet) | date | search snippet | no |
| Drinking water | Taroudant city and surrounding localities ("localités avoisinantes"); "villages voisins" | qualitative | S3; S4 names only Taroudant city and nearby localities | yes |
| Irrigation | Downstream agricultural land (no perimeter named) | qualitative | S3, S4 | yes |
| Operator | Supervised by the Ministry of Equipment and Water (works supervision); the operator for water supply is not named | | S3 | yes |

Note: The S3 article says the 90 km irrigation canal starts at "barrage d'Oulouz" (Aoulouz), not Mokhtar Soussi, and goes to the Sebt El Guerdane area. That is an Aoulouz fact (see 2.5).

### 2.3 Abdelmoumen (Issen)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type, start | Concrete (C), 1981 | year | S2 | yes (S2; date of report UNVERIFIED) |
| Height | 94 | m | S2 | yes |
| Regulated volume | 68.5 | Mm3 | S2 | yes |
| Present capacity | 216 | Mm3 | S2 | yes. Search summaries give 198.4 and 142.8 Mm3 (snippets); unresolved |
| Use | E, I, AEPI (hydro, irrigation, drinking water) | code | S2 | yes |
| Hydro capacity | 30 | MW | S2 | yes |
| Drinking-water flow | Limited to 50 l/s at the time of the article | l/s | S5 (25 Feb 2024) | yes |
| Combined drinking-water flow, Moulay Abdallah + Abdelmoumen | 200 | l/s | S5 | yes |
| Irrigation | Issen area named among areas where dam irrigation was suspended (Nov 2022) | qualitative | S12 (snippet only) | no |
| Operator | ONEE (historic). Current operator UNVERIFIED | | | UNVERIFIED |

### 2.4 Dkhila (Issen)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type, start | Earth-fill (B), 1986 | year | S2 | yes |
| Height | 32 | m | S2 | yes |
| Present capacity | 0.7 | Mm3 | S2 | yes |
| Function code | BC (not explained in S2) | code | S2 | yes; meaning UNVERIFIED |
| Role | Built downstream to regulate the flow of Abdelmoumen | qualitative | S2 | yes |
| Drinking-water or irrigation system | None found | | | not found |

### 2.5 Aoulouz (Souss, Sebt El Guerdane area)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type, start | Earth-fill (BCR), 1991 | year | S2 | yes |
| Height | 79 | m | S2 | yes |
| Regulated volume | 312 | Mm3 | S2 | yes |
| Present capacity | 110 | Mm3 | S2 | yes. CIHEAM snippet gives 108 Mm3 |
| Function code | ANS (not explained in S2) | code | S2 | yes; meaning UNVERIFIED |
| Canal to the Sebt El Guerdane / Al-Gardan area | 90 km canal starts at the Aoulouz dam | km | S3 (3 Feb 2026) | yes |
| Supplementary irrigation of Sebt El Guerdane perimeter | 45 | Mm3/yr | snippet from a Medias24 article and S9 snippet; not opened | **no. UNVERIFIED** |
| Drinking water | Regional Aoulouz adduction "s'impose comme une infrastructure stratégique" for Ighrem and nearby Taroudant communes, with a peak deficit up to 75% | qualitative | S6 (19 Jan 2026) | yes (summary) |
| Operator | UNVERIFIED | | | UNVERIFIED |

Conflict: the 45 Mm3/yr figure is not in a fetched primary source. The phrase "Aoulouz ... feeds the Souss aquifer" (S9 snippet) and the Sebt El Guerdane irrigation are not confirmed.

### 2.6 Imi El Kheng (Oued Berhil)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type, start | BCR, 1993 | year | S2 | yes |
| Height | 39 | m | S2 | yes |
| Regulated volume | 4.5 | Mm3 | S2 | yes |
| Present capacity | 12 | Mm3 | S2 | yes |
| Surface area | 1,000 | ha | S2 | yes |
| Use code | I, AN (irrigation, groundwater recharge; meaning of AN UNVERIFIED) | code | S2 | yes |
| Drinking water | None found | | | not found |

### 2.7 Moulay Abdellah (Tamri / north of Agadir, Ida-Outanane)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Role | Raw-water source for the Tamri treatment station, which is expanded to 1,100 l/s | l/s | S5 (25 Feb 2024), S7 (20 Aug 2025) | yes |
| Conveyance to Agadir | 13 km of steel pipe, DN 1000, from the Moulay Abdellah area to Agadir reservoirs | km, mm | S7 | yes |
| Cost and status | 132 MDH; commissioning planned December 2025 | MDH, date | S7; S8 snippet | yes (S7). Completion **not confirmed** |
| Separate 110 MDH project | Doubling of the discharge line between the Aourir relay station and the Hay El-Mohammadi reservoirs (13 km of large-diameter pipe), commissioning planned early 2026. S6 says "la ville" (city not named) | MDH, km | S6 (19 Jan 2026) | yes. Likely a different component; the 13 km figure matches S7, so the two descriptions may overlap. UNVERIFIED |
| Drinking-water flow, Moulay Abdellah + Abdelmoumen | 200 | l/s | S5 | yes |
| Served localities | Greater Agadir (S7); Agadir reservoirs; no quartiers named | qualitative | S7 | yes |
| Operator | ONEE (S7 names ONEE as the project owner) | | S7 | yes |
| Saturation | Expected end-July 2024 (dam filling announcement) | date | S5 | yes |

### 2.8 Ahl Souss

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Role | Named in the Jan 2026 ABHSM-era press on the Souss-Massa supply; "il faut, dès le premier trimestre 2026, anticiper les déficits" | qualitative | S6 | yes (summary) |
| Saturation | Expected end-July 2024 | date | S5 | yes |
| Capacity | c. 4.7 Mm3 (derived by a search summary from a fill level of 4.631 Mm3 at 99.4%) | Mm3 | search summary of S11 (snippet). Derived, not published | no. UNVERIFIED |
| Drinking-water system and cities served | Not found | | | not found |
| Irrigation perimeter | Not found | | | not found |
| Operator | UNVERIFIED | | | UNVERIFIED |

### 2.9 Sidi Abdellah (Ouaar)

| Fact | Value | Unit | Source | Verified by fetch |
|---|---|---|---|---|
| Type | Earth-fill (E), 1965 (second table of JICA; start year UNVERIFIED) | | S2 (Table VI1.1 2/2) | yes (table line) |
| Height | 65 | m | S2 | yes |
| Regulated volume | 10 | Mm3 | S2 | yes |
| Mean annual supply | 8.2 | Mm3/yr | S2 | yes |
| Function code | RN, I (meaning of RN UNVERIFIED) | code | S2 | yes |
| Purpose | Recharge of the Sebt El Guerdane aquifer near Taroudant; programmed (not built, in the JICA text) | qualitative | S2 text (VI-7) | yes. Status today UNVERIFIED |

### 2.10 Igui N'ouaqa (planned) and Abdelmoumen Amont (proposed)

Both listed as proposed in S2 (no. 23 Igui N'ouaqa on oued Aguerd; no. 24 Abdelmoumen Amont on oued Issen). Current status UNVERIFIED.

### 2.11 Moulay Abdellah, Ahl Souss and Mokhtar Soussi are not in the JICA tables

S2 Table VI1.1 does not list Moulay Abdellah, Ahl Souss, Mokhtar Soussi (operational 2002, after the JICA report), or Tamri (under construction). Their data come only from press and ABHSM sources above.

### 2.12 Other dams in the ABHSM basin

| Dam | Fact | Source | Verified by fetch |
|---|---|---|---|
| Tamri | Capacity 204 Mm3; preventive filling planned H1 2026; completion "imminent" (Jan 2026) | S1 | yes |
| Tamri | Purpose: Greater Agadir drinking water and nearby irrigation | S8/search snippet | no |
| Sidi Yaacoub (Tiznit province) | Works launched (Jan 2026) | S1 | yes |
| Idaougnidif, Akhfamane, Kourayzen | Small dams with the Ministry of Interior | S1 | yes |
| Imi Mikki (Agadir Ida-Outanane) | Dam mentioned | S5 | yes |
| Igui N'ouaqa | Proposed | S2 | yes |

## 3. Treatment plants and pipeline schemes

| Scheme | Facts | Source | Verified by fetch |
|---|---|---|---|
| Tamri drinking-water plant (ONEE) | Fed by Moulay Abdellah dam; capacity 1,100 l/s after expansion (about 95,000 m3/day) | S5, S7 | yes |
| Moulay Abdellah to Agadir conveyance | 13 km, DN 1000 steel; 132 MDH; ONEE | S7 | yes |
| Chtouka Ait Baha seawater desalination (ONEE) | 1,736 l/s drinking water (S5, Feb 2024); MAP-quoted 275,000 m3/day = 150,000 m3/day drinking water + 125,000 m3/day irrigation (S10 snippet); extension target 400,000 m3/day (about 146 Mm3/yr), which ABHSM (S1) gives as the extension target "à l'horizon 2026" | S1, S5 fetched; S10 snippet | partly. The 1,736 l/s and 146 Mm3/yr figures are fetched. The 150,000 / 125,000 split is a snippet |
| Chtouka pipeline | 44 km conveyance; breakages since 2022 commissioning; study to connect Oulad Teima | S5 | yes |
| Chtouka supplies | c. 70% of Greater Agadir's drinking water (S5); the Jan 2026 article names the southern Agadir zones it serves: Biougra, Sidi Bibi, Temsia, Drarga, Oulad Dahou | S5, S6 | yes |
| Tiznit (Aglou) desalination (ONEE) | Unit of 70.4 Mm3/yr: 10.4 Mm3/yr drinking water and 60 Mm3/yr irrigation (S5). Investment 190 MDH (S5); 2.7 MMDH in a snippet. Commissioning 2024 planned, not confirmed | S5 fetched; conflict on cost | partly |
| Sidi Ifni desalination (ONEE) | First phase 100 l/s (8,640 m3/day), extendable to 200 l/s; serves Sidi Ifni, Mirleft and nearby douars | S5 fetched; capacity snippet | partly |
| Souss-Moyen desalination | Planned, 176 Mm3/yr | S5 | yes (planned) |
| Agadir north desalination | Monobloc unit acquisition | S5 | yes |
| Monobloc units (Agadir Ida-Outanane) | 200 l/s combined, under construction | S7 | yes |
| Youssef Ben Tachfine Tiznit reinforcement | 145 l/s increase of Tiznit production capacity (S6) | S6 | yes (summary) |

Note: Chtouka and the Aglou and Sidi Ifni plants are seawater desalination. They are not fed by a dam. That matters for any "dam to tap" chain: the dam feeds some systems directly, and the largest drinking supply for Greater Agadir (Chtouka desalination, c. 70%) does not depend on a dam.

## 4. Served localities

| Locality | Supply link | Source | Verified by fetch |
|---|---|---|---|
| Agadir (Greater Agadir) | Tamri plant (Moulay Abdellah), Chtouka desalination | S5, S7 | yes |
| Taroudant city and nearby localities | Mokhtar Soussi (after raising); Aoulouz (regional adduction, Ighrem and nearby communes) | S3, S4; S6 | yes |
| Tiznit region | Youssef Ben Tachfine (reinforcement); Aglou desalination | S5, S6 | yes |
| Sidi Ifni, Mirleft | Sidi Ifni desalination (ONEE) | S5 | yes |
| Biougra, Sidi Bibi, Temsia, Drarga, Oulad Dahou (south of Agadir) | Chtouka desalination | S6 | yes (summary) |
| Tamri, Oulad Teima | Tamri/Chtouka systems | S5 | yes (S5 says Oulad Teima is a study) |
| Ighrem, nearby Taroudant communes | Aoulouz regional adduction | S6 | yes (summary) |
| Tlat Lakhssas | Youssef Ben Tachfine (KfW financing snippet) | snippet | **no. UNVERIFIED** |

**Quartiers (neighbourhoods):** Not established. S7 names only "Grand Agadir" and "Agadir reservoirs". No quartier is named in any fetched source. The Hay El-Mohammadi reservoirs (S6) are the only reservoir named inside Agadir, and no source ties it to a dam by quartier. Data.gov.ma and RAMSA/SRM outage notices were **not searched** in this pass. Until that is done, the correct statement is: no public source found that maps quartiers to a dam or plant.

**Communes (HCP RGPH 2024):** Not done. This research did not fetch HCP tables, so no commune population is given.

## 5. Irrigation perimeters

| Perimeter | Source of water | Allocation | Verified by fetch |
|---|---|---|---|
| Chtouka (c. 18,050 ha) | Youssef Ben Tachfine via SP1 and a 44 km canal (S9 snippet); Chtouka desalination (S5/S10) | Agri 85 Mm3/yr (S9 snippet); desalination irrigation 125,000 m3/day (S10 snippet) or 43 Mm3/yr for 15,000 ha (search summary) | **no** for allocations |
| Massa | Youssef Ben Tachfine (historic); suspended per search summary | UNVERIFIED | no |
| Souss aval | Aoulouz; groundwater (Souss aquifer, recharge) | UNVERIFIED | no |
| Sebt El Guerdane / Al-Gardan | Aoulouz (90 km canal, S3); Aoulouz complementary supply of 45 Mm3/yr (snippet) | 45 Mm3/yr (snippet, UNVERIFIED) | partly |
| Issen area | Abdelmoumen / Dkhila; irrigation suspended in Nov 2022 (S12 snippet) | UNVERIFIED | no |
| Taroudant downstream | Mokhtar Soussi (after raising) | UNVERIFIED | no |

Basin-level demand from S5 (25 Feb 2024, citing the PDAIRE): 108 Mm3/yr for drinking and industrial water, and 918 Mm3/yr for agriculture. S5 also cites water supply of 840 to 1,168 Mm3/yr by 2050. S1 notes that the PNAEPI 2020-2027 target is "au moins 80% des besoins en eau d'irrigation" and a capacity above 1.7 bn m3 by 2030 (national, not Souss-Massa specific).

Note on the 2019/2023 irrigation cut-off: the search summary says irrigation from Youssef Ben Tachfine to Massa and Chtouka was stopped in 2019, but its source does not give a date. It is UNVERIFIED.

## 6. Operators

| Item | Finding | Source | Verified by fetch |
|---|---|---|---|
| Drinking-water distribution, historic | ONEE (branche eau) | S5, S7 | yes |
| Dam operation | ABHSM (Agence du bassin hydraulique) runs the basin dam data and communiqués | S1, S5 | yes |
| SRM Souss-Massa (société régionale multiservices) | Created under Law 83-21; capital 150 MDH; investment programme 19.7 MMDH | S13 snippets | no |
| Transfer of ONEE distribution to SRM | Stated as completed on 1 Nov 2025 | S13 (FNH snippet) | no. UNVERIFIED |
| Implementing decree | Decree n° 2.23.1035 (Conseil de gouvernement, 1 Feb 2024) per a snippet; second decree on ONEE asset compensation | S13 snippet | no |
| Current operator of each plant and dam | Not established. A decree transfer would make SRM the distribution operator, but this was not confirmed against a primary text | | UNVERIFIED |

## 7. Conflicts to resolve with primary documents

1. Youssef Ben Tachfine: present capacity 303.5 Mm3 (S2) vs 296, 298.9 Mm3 (snippets); start 1972 (S2) vs 1973 (snippet).
2. Mokhtar Soussi: "sept fois" capacity increase (S3) vs 281/50 (= 5.6x).
3. Mokhtar Soussi raising progress: 77% (Jan 2026) vs >85% (Oct 2026) - not a conflict, a different date.
4. Chtouka desalination irrigation volume: 43 Mm3/yr for 15,000 ha (search summary) vs 140 Mm3/yr (search summary) vs 125,000 m3/day (about 46 Mm3/yr) (S10 snippet). Source-dependent.
5. Abdelmoumen capacity: 216 Mm3 (S2) vs 198.4 and 142.8 Mm3 (snippets).
6. Aoulouz capacity: 110 Mm3 (S2) vs 108 Mm3 (S9 snippet).
7. Tiznit Aglou desalination cost: 190 MDH (S5) vs 2.7 MMDH (snippet).
8. Moulay Abdellah pipeline: 132 MDH, 13 km, commissioning Dec 2025 (S7) vs a 110 MDH line doubling from Aourir to Hay El-Mohammadi, 13 km, commissioning early 2026 (S6). Probably the same or overlapping works.
9. Tamri plant capacity: 1,100 l/s (S5, S7).

## 8. What does not exist publicly (on evidence so far)

- A dam-to-quartier mapping for Agadir, Taroudant or Tiznit: none found. Not yet checked on data.gov.ma or in SRM/RAMSA outage notices.
- A published treatment-plant register for Souss-Massa with capacities per plant: none found. Only scattered press figures.
- A per-dam annual allocation table (Mm3/yr split between drinking water and each perimeter) from ABHSM or ORMVASM: not found. The CIHEAM snippet is the closest, and it is not verified.
- Current operating status of Ahl Souss, Dkhila, Imi El Kheng and Sidi Abdellah as drinking-water or irrigation sources: not found.

## 9. Next steps (not done in this pass)

1. Reach ABHSM documents directly (abhsm.ma returned a refused connection; try other hosts or the njt-group site listing).
2. Obtain the Bulletin officiel texts for Law 83-21 implementation and the decree creating SRM Souss-Massa, to confirm the transfer date.
3. Fetch the HCP RGPH 2024 tables for the communes tied to Taroudant, Tiznit, Agadir-Ida-Outanane and Chtouka.
4. Search data.gov.ma and SRM/RAMSA outage notices for named quartiers before concluding that none exist.
5. Fetch the CIHEAM and Medias24 pages (blocked in this pass) to verify the Youssef Ben Tachfine and Aoulouz allocation figures.
