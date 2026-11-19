# MAM Dashboard

A draft dashboard for the Measuring Access (MAM) project. Users build a multidimensional index of student need for Mississippi and Tennessee school districts from American Community Survey and USDA food access data. They then see how each state's poverty-weight funding would move if their index, instead of the state's current measure, decided which districts have the most need.

It is a static page. Nothing is installed, and nothing a user enters leaves their browser.

## How it works

Each state is ranked on its own. Users go through four steps after a short introduction. Clicking a step's name at the top opens it, and a step opens only once the steps before it are complete (at least two indicators, and weights that add up to 100):

1. **Indicators.** Pick four to six of 18 indicators. The page flags pairs that move closely together (correlation of 0.8 or more within the state), since counting both gives that idea extra weight.
2. **Weights.** Split 100 points among the chosen indicators.
3. **Scaling.** Choose ranks, 0 to 100, or z-scores. A small table shows how five districts score under each method.
4. **Money.** See which districts would gain or lose poverty-weight dollars.

The live panel updates as choices change. It has three views:

- **Need:** a map of the user's index.
- **Funding change:** a map of each district's gain or loss per student.
- **Rankings:** two lists side by side. One ranks districts by the share of students the state counts now, the other by the user's index, and each district shows how many places it moved.

The full district table in the money step also shows each district's rank now, its rank on the user's index, and the move.

### One district

Clicking a district on the map (or selecting it with the keyboard and pressing Enter) zooms the map to that district and the districts that border it. A short panel under the map shows its basic facts, how it does under the user's index, and its bordering districts, which can be clicked in turn. "Whole state" or the Escape key zooms back out.

The panel opens a full district page in place of the steps. It shows all 18 indicators with the district's value, margin of error, the state median and its need rank on each (1 is the most need, and equal values share a rank), plus a table comparing it with its bordering districts. Each district page has its own link, for example `#district-2800750`.

Bordering districts come from `data/neighbors.csv`. Two districts border each other if they are in the same state and share at least 0.00001 degrees (about 1 meter) of border in the full 2024 TIGER/Line boundaries. Districts that touch only at a corner do not count. The full boundaries are used because working this out from the simplified map shapes gave 16 wrong pairs out of 655.

### Index

For each chosen indicator, every district in the state is scaled one of three ways. These are the same rules as the Arizona Student Poverty Index Lab:

- **Ranks:** the share of the other districts with a lower value, times 100.
- **0 to 100:** (value − minimum) / (maximum − minimum) × 100.
- **z-scores:** (value − mean) / population standard deviation.

Median household income is flipped, so lower income counts as more need. Every other indicator, including the Gini index, counts higher as more need. The index is the weighted average of the scaled values, rounded to 9 decimals. Rank 1 is the most need, and exact ties go to the district listed first alphabetically.

### Funding

Anything set in law stays fixed: the base amount, the weights, and the state's total number of students who count. Users choose only which kinds of need matter and how much.

| | Tennessee (TISA) | Mississippi (MSFF) |
|---|---|---|
| Year | 2025-26 | FY26 |
| Base per student | $7,295 | $6,842.61 |
| Poverty weight | 25% for each economically disadvantaged student | 30% for each low-income student |
| Concentrated poverty | 5%, set school by school (not modeled; held at its current amount) | 10% for each low-income student above 35% of enrollment (recomputed) |
| Who counts now | TDOE district profile 2024-25, economically disadvantaged percent × K-12 enrollment | MDE Office of Child Nutrition CEP list (April 14, 2025), identified student percentage × MDE K-12 enrollment 2024-25 |

How the students are re-shared:

1. Districts are ordered by the user's index, highest need first.
2. The state's actual district rates are sorted from highest to lowest and handed out in that order.
3. Each rate is multiplied by the district's K-12 enrollment.
4. The counts are scaled so the statewide total matches the actual total. No district can have more students than it enrolls.
5. The law's weights are applied to the new counts.

The index decides the order. The real spread of rates stays the same.

Limits to know:

- **Tennessee rounding:** TDOE publishes the economically disadvantaged percent as a whole number, so a district's count can be off by up to half a percentage point.
- **Mississippi measure:** the CEP identified student percentage is the school meals measure. It is close to, but not confirmed identical to, the low-income count MSFF uses.
- **Mississippi K-12 enrollment:** it is total enrollment minus Pre-K, Grade 13, adult education and other non-K-12 groups. Where one of those cells is starred (fewer than 10 students), it is counted as 0, so 47 districts' K-12 counts can be high by up to 9 per starred cell.
- **Mississippi base:** the FY26 base of $6,842.61 comes from George County School District's FY26 budget hearing (July 29, 2025). It has not yet been confirmed in an MDE document.
- **Census figures:** they describe everyone living in a district, not enrolled students.

## Downloads

The Download the data section at the bottom of the page (also reached from the Download data button at the top) lets anyone pick:

- **Data:** the indicators, the funding inputs, their own results, or the map boundaries.
- **State:** Mississippi, Tennessee or both.
- **File type:** CSV, Excel (.xlsx), Stata (.dta, format 118 for Stata 14 or later) or JSON. Map boundaries come as GeoJSON only.

Every file is built in the browser from the files in `data/`. Nothing is sent anywhere.

- **Indicators:** the columns of `data/indicators.csv` plus `foodkids_est` and `foodkids_moe` from `data/food.csv`. The CSV keeps the numbers exactly as they are written in those files.
- **Funding inputs:** the columns of `data/districts.csv` plus the funding rules in law for each state (formula, year, base amount, poverty weight, concentrated poverty weight and line).
- **Your results:** for each district, the value, scaled value and weight of each chosen indicator, the scaling method, the index, rank now, rank under the index, places moved, students counted now and after re-sharing, poverty-weight dollars now and after, and the change in total and per student. With both states, each state is still ranked on its own.
- **Map boundaries:** the features of `data/map.geojson` for the chosen state.

The Excel, Stata and JSON files also say what each variable means and carry notes on the sources. In Stata, type `notes` to see them.

## Districts

There are 277 districts: the school systems each state's formula pays.

- **Mississippi:** 137 unified districts.
- **Tennessee:** 140. That is 124 unified districts plus 16 city K-8 systems.
  - **County high-school pieces:** the 16 census "secondary" pieces are county high-school areas inside those cities. Their students are funded through the county system, so they are not shown separately. A county system is described by the census numbers for its own K-12 area only.
  - **Fort Campbell:** Fort Campbell Schools is a census district but is not in TDOE's file and is not funded by TISA, so it is left off.

## Indicators

Seventeen indicators come from the ACS 2020-2024 5-year estimates. Food access comes from USDA. The indicators are grouped into five domains for now. These will be renamed to MAM domains as more domains are added.

| Domain | Indicator | Source |
|---|---|---|
| Income and work | Kids below 185% of poverty, ages 6 to 17 | B17024, built from counts |
| Income and work | Kids below poverty, ages 5 to 17 | S1701_C03_004 |
| Income and work | Unemployment rate, 16 and over | S2301_C04_001 |
| Income and work | Median household income | B19013_001 |
| Income and work | Gini index | B19083_001 |
| Food | Kids far from a SNAP store, ages 0 to 17 | USDA ERS SRAM, driving distance (see below) |
| Food | SNAP households | S2201_C04_001 |
| Health and housing | Kids uninsured, under 19 | S2701_C05_011 |
| Health and housing | Crowded housing (more than 1 person per room) | B25014, built |
| Health and housing | No complete plumbing | B25049, built |
| Health and housing | Rent burden (35% or more of income) | B25070, built ("not computed" left out) |
| Health and housing | Moved in the past year | B07003, built |
| Getting around and getting online | No vehicle | S2504_C02_027 |
| Getting around and getting online | No broadband | 100 − S2801_C02_014 |
| Getting around and getting online | No computer | S2801_C02_011 |
| Family and language | Adults 25+ without a high school diploma | 100 − S1501_C02_014 |
| Family and language | Limited English, 5 and over | S1601_C06_001 |
| Family and language | Single-parent families | B11003, built |

Each ACS value has its margin of error (90%) in `data/indicators.csv`. Built percents use the Census Bureau's approximation formulas from *Understanding and Using American Community Survey Data*.

### Food access

The share of kids 0 to 17 who live far from a store that takes SNAP. Far means more than 1 mile by road in an urban census tract, or more than 10 miles by road in a rural one.

- **Source:** USDA Economic Research Service, SNAP-Authorized Retailer Access Map (SRAM), July 2026 release. Stores are as of June 2025. People come from the 2020 Census, on 2020 tracts.
- **Count:** `DD_SRAM_lakids1` in urban tracts and `DD_SRAM_lakids10` in rural tracts, divided by `TractKids`. USDA's own kids share columns divide by a tract's total population, so they are not used.
- **Tracts to districts:** each tract's counts are split by the share of its people living in each district, from the team's 2024 tract-to-district crosswalk. This treats kids as spread like everyone else within a tract.
- **Driving, not straight-line:** with straight-line distance, almost every rural tract is zero (685 of 697 in Tennessee, 438 of 490 in Mississippi).
- **Kids, not everyone:** within a tract, the kids, all-residents and low-income shares are nearly identical (correlation 1.00), so only one is used.
- **No margin of error:** USDA publishes none. The `foodkids_moe` column is empty.
- **Zeros:** six districts are at 0: Nettleton and South Pike in Mississippi, and Fayetteville City, Bradford, Trenton and West Carroll in Tennessee.

## Data files

The files in `data/` are exact copies of products from the MAM census database. Each one was made by a logged Stata 19 do-file and checked against an independent recomputation.

| File | Made by | SHA-256 |
|---|---|---|
| `data/districts.csv` | `30_dashboard_districts.do`, run dash_20261119T000312Z | `ea7759ca0e7df88ff6144a75b78101f5ac6504cd1da000c3875a6c53f9db0f8c` |
| `data/indicators.csv` | `31_dashboard_indicators.do`, run dashind_20261119T001320Z | `8c870d39bc5a687368738076dbd63eee73402c34c9a0ec67f26b6c155395010b` |
| `data/map.geojson` | `32_dashboard_map.do`, run dashmap_20261119T001806Z | `1101a3c55047a759cff6ddda4b04fe54520e19779fc23b4d85456ebddb90cc02` |
| `data/food.csv` | `33_dashboard_food.do`, run dashfood_20261119T164127Z | `09e699a888f049d0f6bae32380924b46135f9444dec8a0bb8c8c63355933f6ef` |
| `data/neighbors.csv` | `34_dashboard_neighbors.do`, run dashnbr_20261119T180245Z | `06b550f90b61e61bfc12ec76f108aabd5f7dbe9e7cc511350d69a2a27ad19574` |

Sources behind them:

- U.S. Census Bureau, American Community Survey 2020-2024 5-year estimates, Census Data API.
- USDA Economic Research Service, [SNAP-Authorized Retailer Access Map data](https://www.ers.usda.gov/media/29395/2025-snap-authorized-retailer-access-map-sram-data.zip?v=84679), July 2026 release.
- MAM team tract-to-district population shares, 2024 school district boundaries, built from 2020 Census blocks.
- Tennessee Department of Education, district profile 2024-25 ([data downloads](https://www.tn.gov/education/districts/federal-programs-and-oversight/data/data-downloads.html)).
- Mississippi Department of Education:
  - [Enrollment data download](https://newreports.mdek12.org/DataDownload)
  - Office of Child Nutrition [CEP annual notification of LEAs](https://mdek12.org/wp-content/uploads/sites/9/2025/04/2025-04-15-LEA-Notification.pdf), April 14, 2025.
- NCES Common Core of Data, 2024-25 preliminary directory (state and federal district IDs).
- U.S. Census Bureau, TIGER/Line 2024 school district boundaries. Each district is simplified to about 200 meters, so shared borders can differ slightly at full zoom.
- Funding rules:
  - [TISA Overview, TISA Review Committee, April 2026](https://www.tn.gov/content/dam/tn/stateboardofeducation/documents/tisa-review-committee/april-27-2026-meeting/presentations/2%20-%202026.04_TISA%20Overview_TISA%20Review%20Committee.pdf)
  - [Mississippi Student Funding Formula, TPC](https://tpcref.org/mississippi-student-funding-formula/)
  - [George County School District FY26 budget hearing](https://irp.cdn-website.com/5877256e/files/uploaded/2025-2026+Public+Hearing+July+29-+2025.pdf)

The decisions behind these choices are numbered D063 to D074 in the database's decision log.

## Files

- `index.html`, `style.css`, `app.js`: the page
- `dl.js`: the downloads (CSV, Excel, Stata and JSON writers)
- `data/`: the five data files above

To view it on your own computer, serve the folder (for example `python3 -m http.server`) and open the local address. Opening `index.html` directly from disk will not load the data.

Draft. Built by John M. Fredericks, Arizona State University.
