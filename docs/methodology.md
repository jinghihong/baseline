# How Baseline's numbers work

_Methodology · November 2026_

Baseline is built so that anyone can check its work. This page explains where the data comes from, how each forecast is made, and where the numbers are weak. When a number on screen is a Baseline estimate rather than a published figure, the screen says so.

## Data sources

Baseline uses public data only. A pipeline (`scripts/fetch-data.mjs`) downloads each source, keeps only what the app needs, and saves a dated snapshot. A scheduled job refreshes the snapshots, and **Data & imports** in the app shows when each one was last refreshed.

| Source | Publisher | What Baseline uses it for |
|---|---|---|
| Expense Budget (`mwzb-yiwb`) | NYC Open Data | Adopted and modified budgets by agency and object class; overtime budgets |
| Citywide Payroll Data (`k397-673e`) | NYC Open Data | Overtime actually paid, by agency and fiscal year (aggregated; no individual records are kept) |
| Capital Projects Dashboard (`fb86-vt7u`, `95tx-snak`) | NYC Open Data | Current budgets, the first budget the city published, completion forecasts and the reasons given for delays |
| Capital Project Detail Data (`wa2y-rh4b`, `s7yh-frbm`) | NYC Open Data | October 2023 snapshot of about 5,000 projects: original budget, current plan and original vs latest completion dates |
| 311 Service Requests (`erm2-nwe9`) | NYC Open Data | Monthly requests for complaint types tied to budget lines, citywide and by Council district |
| City Council Capital Budget (`t474-a92g`) | NYC Open Data | Discretionary capital awards by Council district and sponsor |
| Grants.gov Search2 API | Grants.gov | Open and forecasted federal opportunities where city governments are eligible |
| Comptroller and State Comptroller reports | NYC and NY State Comptrollers | Published figures quoted with their source (AIMS audit, DDC audit, capital data note, budget comments) |

## Shared definitions

Every screen uses the same definitions, kept in one file (`src/engines/core.ts`), so two screens can't disagree about the same number.

### Budget lines that grow after adoption

For each agency and object class, Baseline compares the **adopted** budget with the budget **as modified through June** of the same fiscal year. In the Expense Budget dataset, each June publication carries the adopted amount for the coming year and the modified amount for the year just ending, so the two come from consecutive publications.

- A year counts as "over" when the modified budget ended at least 5% above adoption.
- A line is **chronically under-budgeted** when it has at least five assessed years, was over in at least three of every four, and its median ratio of modified to adopted is 1.2 or more. These thresholds were calibrated on NYC data: looser ones mostly catch grant money recognized mid-year rather than lines set too low.
- The **expected in-year increase** is the latest adopted amount times (median ratio − 1).
- Holding codes and other technical object classes are excluded because they move for accounting reasons.

### Overtime

Adopted and modified overtime come from the overtime object codes in the Expense Budget. Actual overtime comes from total overtime paid in Citywide Payroll Data. Agency names differ between the two datasets, so Baseline maps each spelling to one agency code.

The **forecast** for next year is a damped-trend (Holt) model on up to eight years of actual overtime pay. The damping keeps a single unusual year from running away. The range shown is an 80% band based on how far the model's past one-year-ahead predictions missed. The **expected shortfall** is the forecast minus the adopted budget for that year.

### Capital projects: the baseline never moves

Each project in the Capital Projects Dashboard is measured against the **first budget and first completion date the city published** for it, not the latest re-based plan. Budget growth is current budget minus first budget. Schedule slip is latest forecast completion minus first forecast completion.

Risk levels: **critical** at 50% budget growth or two years of slip; **high** at 20% or one year; **watch** at 5% or three months. Several dashboard rows can share one budget ID; when Baseline adds up dollars it counts each budget ID once.

## Forecasting methods

### Cost forecaster (reference-class forecasting)

A new estimate is compared with what happened to similar past projects in the city. Baseline takes past projects of the same asset class from the October 2023 Capital Project Detail Data and computes, for each one, its current planned total divided by its original budget.

- Projects that are very small, or whose ratios are extreme, are filtered or capped so a handful of outliers can't dominate.
- Projects closer in size to yours, in the same agency or the same borough count more.
- The result is a range: the 50th, 80th and 90th percentile outcomes applied to your estimate. Budgeting at the **80th percentile** means that, if the future looks like the past, four in five similar projects would have come in under it.
- An effective sample size tells you how many comparable projects the estimate really rests on.

You can add your city's own completed projects in **Data & imports** to calibrate the forecaster.

#### How accurate is it? An out-of-sample backtest

To test the forecaster honestly, Baseline replays history without hindsight:

1. **Train** only on the city's first Capital Project Detail Data publication (April 25, 2019): 4,817 projects as they looked then.
2. **Test** on 497 projects that were created after that date (so the forecaster never saw them) and were at least 80% spent by their last appearance in the data.
3. For each one, price its original budget with the April 2019 reference class, then check where its final cost landed.

| | Target | Result |
|---|---:|---:|
| Final cost at or below P50 | 50% | 45% |
| Final cost at or below P80 | 80% | 85% |
| Final cost at or below P90 | 90% | 93% |

The city's original budget held for **40%** of these finished projects. Baseline's recommended P80 budget held for **85%**. The ranges are well calibrated (the upper end is slightly cautious), and they are wide: in the typical case the P80 budget sits about twice the original estimate, because that is how widely NYC project outcomes vary.

The Cost forecaster page reruns this test live in your browser every time the data refreshes, with results by project type. Caveats: the test set leans toward projects short enough to finish within four years, and "80% spent" is a proxy for finished.

### 311 demand

Monthly forecasts use a seasonal index for each calendar month (each month's typical share of the year, from centered 12-month averages) and a linear trend fitted to the most recent 36 months after removing seasonality. The band is an 80% range from the trend's residuals.

### Spend tracker

Year-end spending for a line is projected from monthly actuals to date, using the run rate so far, a seasonal spending profile, or a blend of both, and compared with the adopted amount.

### Maintenance risk

Each asset gets a **probability of failure** from its condition rating and its age relative to its useful life, and a **consequence** from its criticality and replacement value. Risk is probability times consequence. Given a budget, Baseline funds the repairs that remove the most risk per dollar first, and projects how the backlog grows if repairs are deferred. The asset register shown in the app is **sample data** for demonstration, because the city does not publish AIMS condition data in machine-readable form. Cities can import their own register.

### Gap scenarios

Scenarios start from the out-year gaps in the Mayor's financial plan and let you apply the Comptroller's published adjustments (revenue and each expense risk) or your own assumptions, such as a recession, a labor settlement or federal cuts. Published figures come from the Comptroller's FY2027 Adopted Budget comments.

### Fiscal notes

A bill's cost is built from its parts: new staff (positions × salary × fringe benefits, phased by hiring date), contracts, one-time technology or capital costs, and any revenue it raises or loses, projected over five years with a low and high range. Default salaries and rates are editable assumptions, not official figures.

### Debt and affordability

New borrowing is converted to annual debt service with a level-payment bond formula, and compared with projected tax revenue to show how today's capital plan constrains future budgets. Rates, terms and growth are editable assumptions.

### Ask Baseline

The built-in analyst answers common questions directly from the datasets above, with no AI involved. If you connect Claude with your own API key, Claude receives a compact data pack of the same facts and is instructed to answer only from it, cite sources, and say when data is missing. Your key and questions go from your browser to Anthropic's API and nowhere else.

## Known limitations

- **All funds vs city funds.** Baseline's budget and payroll figures include federal, state and other funds. The Comptroller's estimates usually cover city funds only, so the two won't match exactly.
- **Mid-year increases aren't always under-budgeting.** A modified budget can rise because a grant was recognized after adoption. Treat a flag as a question to ask, not proof.
- **The 2023 reference projects were mostly unfinished.** Their current plans are a floor on final cost, so real overruns are likely larger than the forecaster shows.
- **Incomplete capital data.** The dashboard leaves out many projects (the Comptroller found it covers under half of project IDs) and has existed only since 2023, so first-reported budgets may already include earlier growth.
- **Agency matching.** Agency names are matched across datasets by rule. A small share of overtime pay (agencies outside the budget, such as NYCHA) is not matched.
- **Short history.** Annual series have fewer than fifteen points, so forecast ranges are wide on purpose.
- **Not an official source.** Baseline is independent and not affiliated with the City of New York.
