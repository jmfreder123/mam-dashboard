# MAM Dashboard

A draft dashboard for the Measuring Access (MAM) project. Users build a multidimensional index of student need for Mississippi and Tennessee school districts from American Community Survey data. They then see how each state's poverty-weight funding would move if their index, instead of the state's current measure, decided which districts have the most need.

It is a static page. Nothing is installed, and nothing a user enters leaves their browser.

## How it works

Each state is ranked on its own. Users go through five steps:

1. **Indicators.** Pick four to six of 17 census indicators. The page flags pairs that move closely together (correlation of 0.8 or more within the state), since counting both gives that idea extra weight.
2. **Weights.** Split 100 points among the chosen indicators.
3. **Scaling.** Choose ranks, 0 to 100, or z-scores. A small table shows how five districts score under each method.
4. **Money.** See which districts would gain or lose poverty-weight dollars.
5. **Reflect.** Answer three questions.

The map and the top-ten list update as choices change.

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

## Districts

There are 277 districts: the school systems each state's formula pays.

- **Mississippi:** 137 unified districts.
- **Tennessee:** 140. That is 124 unified districts plus 16 city K-8 systems.
  - **County high-school pieces:** the 16 census "secondary" pieces are county high-school areas inside those cities. Their students are funded through the county system, so they are not shown separately. A county system is described by the census numbers for its own K-12 area only.
  - **Fort Campbell:** Fort Campbell Schools is a census district but is not in TDOE's file and is not funded by TISA, so it is left off.

## Indicators (ACS 2020-2024 5-year)

| Indicator | Census source |
|---|---|
| Kids below 185% of poverty, ages 6 to 17 | B17024, built from counts |
| Kids below poverty, ages 5 to 17 | S1701_C03_004 |
| SNAP households | S2201_C04_001 |
| Kids uninsured, under 19 | S2701_C05_011 |
| Unemployment rate, 16 and over | S2301_C04_001 |
| No broadband | 100 − S2801_C02_014 |
| No computer | S2801_C02_011 |
| Adults 25+ without a high school diploma | 100 − S1501_C02_014 |
| Limited English, 5 and over | S1601_C06_001 |
| No vehicle | S2504_C02_027 |
| Crowded housing (more than 1 person per room) | B25014, built |
| No complete plumbing | B25049, built |
| Rent burden (35% or more of income) | B25070, built ("not computed" left out) |
| Single-parent families | B11003, built |
| Moved in the past year | B07003, built |
| Median household income | B19013_001 |
| Gini index | B19083_001 |

Each value has its margin of error (90%) in `data/indicators.csv`. Built percents use the Census Bureau's approximation formulas from *Understanding and Using American Community Survey Data*.

## Data files

The files in `data/` are exact copies of products from the MAM census database. Each one was made by a logged Stata 19 do-file and checked against an independent recomputation.

| File | Made by | SHA-256 |
|---|---|---|
| `data/districts.csv` | `30_dashboard_districts.do`, run dash_20261119T000312Z | `ea7759ca0e7df88ff6144a75b78101f5ac6504cd1da000c3875a6c53f9db0f8c` |
| `data/indicators.csv` | `31_dashboard_indicators.do`, run dashind_20261119T001320Z | `8c870d39bc5a687368738076dbd63eee73402c34c9a0ec67f26b6c155395010b` |
| `data/map.geojson` | `32_dashboard_map.do`, run dashmap_20261119T001806Z | `1101a3c55047a759cff6ddda4b04fe54520e19779fc23b4d85456ebddb90cc02` |

Sources behind them:

- U.S. Census Bureau, American Community Survey 2020-2024 5-year estimates, Census Data API.
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

The decisions behind these choices are numbered D063 to D071 in the database's decision log.

## Files

- `index.html`, `style.css`, `app.js`: the page
- `data/`: the three data files above

To view it on your own computer, serve the folder (for example `python3 -m http.server`) and open the local address. Opening `index.html` directly from disk will not load the data.

Draft. Built by John M. Fredericks, Arizona State University.
