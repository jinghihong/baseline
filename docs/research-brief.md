# Baseline: one set of numbers for city budgets

_Research brief · November 2026_

## Summary

New York City plans a $125.84 billion budget and a capital program of well over $100 billion with numbers it cannot fully trust. Its infrastructure report misses repair costs by half. Most capital projects end up later and more expensive than first planned, and the city's own reporting often hides by how much. Overtime is adopted far below what the city actually pays, every year.

Baseline is software that gives a city's budget office and its council the same independent forecasts, built on the city's own data, with a source on every number. The budget office uses it to set budgets that hold. The council uses it to check them.

## The problem

### The infrastructure report misses badly

The City Charter requires an annual inventory and condition survey of city assets worth at least $10 million with a useful life of at least 10 years. The Office of Management and Budget (OMB) produces it, with consultants and the Department of Design and Construction, as the **Asset Information Management System (AIMS)** report. The FY2023 edition covered 5,093 assets and estimated $14.1 billion of state-of-good-repair need for FY2024–2027. It costs about $4 million a year to produce.

A March 2024 audit by the NYC Comptroller found that AIMS does not tell the city what its repairs will cost:

- **Estimates miss by half.** AIMS estimated $76 million for the Riverside Park bridge at the West 79th Street traffic circle in 2020. The bid a few months later came in at $149.9 million.
- **Inspections are fast and shallow.** Surveyors spent 20 minutes on a 6,164-square-foot FDNY building and 36 minutes on a 105,000-square-foot elementary school. Footings, pavement base and piles are excluded because they are not visible.
- **Problems go unreported.** At just 10 sampled assets, auditors found 57 structural problems AIMS had not reported.
- **Neglect becomes emergency spending.** The city spent more than $150 million on emergency procurements for structural problems over five years.

The Comptroller found no clear link between AIMS cost estimates and what projects actually cost, and called for an "overhauled, refocused" version of the report.

### Capital projects run late and over, and the city can't measure it

- In April 2024 the New York State Comptroller reviewed 5,128 NYC capital projects. **64% were delayed** at least three months, **more than half were over their initial budgets**, and planned spending was **$54.5 billion more** than first anticipated. Nearly two-fifths were more than 20% over.
- In December 2025 the NYC Comptroller audited the Department of Design and Construction (DDC). **80% of its projects were behind their original schedule, by 3.5 years on average.** A sample of 18 large projects grew from $4.14 billion to $4.51 billion. DDC resets the starting point for counting delays at each phase, which hides the total delay, and it has **no system to forecast costs across its portfolio**. It stopped reporting cost against original budget in the Mayor's Management Report from FY2021 to FY2024.
- The Comptroller's December 2025 fiscal note _Flying Blind on Billions_ found the public Capital Projects Dashboard covers only **46.8% of project IDs** and 58.1% of planned commitments, while commitments have grown 13.9% a year since 2022.

### The operating budget has the same habit

- In its review of the FY2027 adopted budget, the Comptroller estimates **overtime is under-budgeted by $589 million** in FY2027, and $511–547 million in each later year. For FY2026 it estimated overtime would reach $2.58 billion, $911 million above the adopted budget.
- The Comptroller also estimates the city leaves out an average of **$3.75 billion a year** of predictable, chronically under-budgeted costs at the preliminary budget stage.
- After restating OMB's plan, the Comptroller sees gaps of $743 million in FY2027 and $7.25 billion, $7.87 billion and $6.84 billion in the following three years.

## What the city's own data shows

We rebuilt these findings from NYC Open Data to test whether software can see them early. These are Baseline's calculations, not published figures:

- **Capital Projects Dashboard, May 2023 to May 2026.** Counting each budget ID once, 40% of projects now carry a budget above the first number the city published, adding $21.9 billion. Of the projects with a published completion forecast, 66% have had that date pushed back.
- **Past projects as a reference class.** In the October 2023 capital project detail data (the same publication the State Comptroller reviewed), 52% of 4,694 projects over $250,000 had grown past their original budget and 41% had grown 20% or more. Together they went from $90.6 billion originally to $132.6 billion planned.
- **Overtime.** Across the 15 agencies where the budget and payroll data line up, the FY2026 adopted overtime budget was $1.54 billion; the city paid $2.78 billion. The NYPD alone was adopted at $565 million and paid $1.05 billion.
- **The Riverside Park test.** Priced the way Baseline prices projects, against 203 past NYC bridge projects weighted toward similar size, a $76 million estimate becomes $102 million at the median and $138 million at 80% confidence. The actual $149.9 million bid falls inside Baseline's 90% range. A planner would have known on day one that $76 million was very unlikely to hold.

The pattern is the same everywhere: a single number is set once, never tested against what similar work has cost before, and then quietly re-based as reality arrives.

## The product

Baseline is one forecasting engine with two focused workspaces. Both sides argue over the same numbers every budget season; Baseline gives them one set they can both inspect.

**Shared core**

- **Original-baseline tracker.** Every project keeps its first published budget and completion date forever, so overruns are always measured from day one.
- **Cost forecaster.** Prices a new project from the city's own past projects of the same type (reference-class forecasting) and returns a range: "80% chance it comes in under $X."
- **Maintenance risk.** Ranks assets by failure risk and consequence, and funds the repairs that buy the most risk reduction per dollar.

**Budget office workspace**

1. Price a project honestly before it enters the capital plan.
2. Early warnings on lines that will run over, from overtime to contracts, months before mid-year.
3. Debt affordability, gap scenarios and a grant finder matched to the project pipeline.

**Council workspace**

1. A second opinion on the executive budget: lines adopted too low year after year, with the reason and the source.
2. Hearing prep: a brief and data-backed questions for each agency.
3. Fiscal notes for proposed bills, and a district view of capital awards and 311 demand.

**Trust by design.** Every figure links to its dataset or report. Forecasts are labeled as estimates and show their range. The AI analyst works offline from the same facts; connecting Claude is optional, uses the customer's own key, and is instructed to answer only from the cited data.

## Competition

| Company | What it does | Gap Baseline fills |
|---|---|---|
| OpenGov | Budgeting, permitting, procurement and asset management suite; 1,900+ public-sector customers | Forecasts the city's own trend lines; does not measure what was adopted against what gets spent |
| ClearGov | Budget books and transparency; AI writes narrative and grades books against GFOA criteria | Helps produce the document, not test whether its numbers hold |
| Euna Solutions (Questica) | Budgeting, payments, procurement and grants; Euna AI adds search and automation | No capital cost forecasting from the city's own project history |
| Tyler Technologies | ERP and records systems for local government | Bundled into the ERP; seen as the executive's tool; National City, CA declined a $250K AI budgeting contract without a clearer cost-benefit case |
| Meeting AI (CitizenPortal, citymeetings.nyc) | Transcribes and summarizes public meetings | Tells you what was said, not whether the numbers were right |

Incumbents sell to the finance department and help it run its process. Nobody we found builds independent forecasting for legislative oversight staff, and nobody prices capital projects from the city's own track record.

## Market

The 2022 Census of Governments counted **90,837 local governments** in the United States, including about **19,500 municipal governments** and **16,200 townships**. Every one adopts a budget, and most have a governing board that must approve it.

Our beachhead is large cities and counties that run a multi-year capital program and have dedicated council finance staff, starting with New York City, where the data is public and the problem is documented in detail. The same open-data pattern (budget, payroll, capital and 311 datasets) exists in many large U.S. cities, which keeps onboarding cost low.

## Business model

Proposed pricing, to be tested in pilots:

- **Pilot:** free for 90 days for one budget office or council finance team, on public data.
- **Council:** annual subscription for a legislative body and its staff.
- **City:** annual subscription for the budget office, priced by population and capital program size, including private data connections.

Pilots are sized to start small and prove value on one budget cycle before a larger procurement.

## Risks

- **Trust in AI.** On October 5, 2026 the NYC Council held a special hearing on AI risks with testimony from frontier AI companies and whistleblowers. Councils will reject a black box. Baseline's answer is sources on every number, ranges instead of point estimates, and AI as an optional layer over cited facts.
- **Data quality.** The city's capital data is incomplete (under half of project IDs on the dashboard), uses inconsistent IDs, and mixes all funds with city funds. Mid-year budget increases can reflect new grants rather than under-budgeting. Baseline flags these limits instead of hiding them.
- **Forecast accuracy.** The 2023 reference projects were mostly still under way, so their overruns are a floor. We need to backtest on completed projects before claiming accuracy.
- **Politics.** A tool seen as the Council's weapon will not be bought by the Mayor's office, and the reverse. Both workspaces must run on identical numbers.
- **Sales cycles and incumbents.** Government procurement is slow, and suite vendors can bundle AI features. Starting with low-cost pilots and the council side, where incumbents are weakest, reduces both risks.

## Sources

- NYC Comptroller, [Audit of OMB's AIMS report](https://comptroller.nyc.gov/newsroom/audit-new-york-city-is-failing-to-accurately-identify-its-infrastructure-repair-needs/) and [The Need for Better AIMS](https://comptroller.nyc.gov/reports/the-need-for-the-better-aims), March 15, 2024
- NY State Comptroller, [Better Reporting and Monitoring of NYC Capital Projects Needed](https://www.osc.ny.gov/press/releases/2024/04/dinapoli-better-reporting-and-monitoring-nyc-capital-projects-needed), April 5, 2024
- NYC Comptroller, [Audit of DDC's Mitigation of Delays and Cost Overruns (SE23-073A)](https://comptroller.nyc.gov/wp-content/uploads/2026/02/SE23-073A.pdf), December 26, 2025
- NYC Comptroller, [Flying Blind on Billions (Fiscal Note 8-2025)](https://comptroller.nyc.gov/wp-content/uploads/documents/Capital-Data-Fiscal-Note-12.5.25.pdf), December 2025
- NYC Comptroller, [Comments on the FY2027 Adopted Budget](https://comptroller.nyc.gov/reports/comments-on-new-york-citys-fiscal-year-2027-adopted-budget/), August 12, 2026; [FY2026 Adopted Budget](https://comptroller.nyc.gov/reports/comments-on-new-york-citys-fiscal-year-2026-adopted-budget/); [FY2026 Preliminary Budget](https://comptroller.nyc.gov/wp-content/uploads/documents/Comments-on-NYCs-Preliminary-Budget-for-FY-2026-and-Financial-Plan-for-Fiscal-Years-2025-2029-1.pdf)
- Route Fifty, [Leading AI companies fail to impress at City Council AI hearing](https://www.route-fifty.com/artificial-intelligence/2026/10/leading-ai-companies-fail-impress-city-council-ai-hearing/416435/), October 2026
- Federal Reserve Bank of St. Louis, [Local Governments in the U.S.](https://www.stlouisfed.org/publications/regional-economist/2024/march/local-governments-us-number-type) (2022 Census of Governments)
- NYC Open Data: [Expense Budget](https://data.cityofnewyork.us/d/mwzb-yiwb), [Citywide Payroll Data](https://data.cityofnewyork.us/d/k397-673e), [Capital Projects Dashboard](https://data.cityofnewyork.us/d/fb86-vt7u), [Capital Project Detail Data](https://data.cityofnewyork.us/d/wa2y-rh4b), [311 Service Requests](https://data.cityofnewyork.us/d/erm2-nwe9)
