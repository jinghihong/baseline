// Report builders. Each returns Markdown, so the same text can be printed, copied or downloaded.
import { CAPITAL_FACTS, CITATIONS, FY27_COMPTROLLER_GAP, FY27_EXPENSE_RISKS, FY27_OMB_GAP, FY27_REVENUE_DIFF, FY27_YEARS, BUDGET_FACTS } from "../../data/curated";
import type { BudgetLinesData, CapitalData, OvertimeData } from "../../data/types";
import { agencyName } from "../../data/agencies";
import { date, duration, fy, money, num, pct } from "../../lib/format";
import { assessAllLines, assessAllOvertime, assessAllProjects, summarizeCapital, type ProjectAssessment } from "../../engines/core";
import { uniqueByFms } from "../../engines/analyst";
import type { SavedEstimate } from "../../state/store";

const today = () => date(new Date().toISOString().slice(0, 10));
const cell = (s: string) => s.replace(/\|/g, "/");
const link = (id: keyof typeof CITATIONS) => `[${CITATIONS[id].publisher}, ${CITATIONS[id].title}](${CITATIONS[id].url})`;

export function budgetRiskBrief(overtime: OvertimeData, lines: BudgetLinesData): string {
  const ot = assessAllOvertime(overtime);
  const chronic = assessAllLines(lines).filter((a) => a.chronic);
  const fyLatest = Math.max(...ot.map((a) => a.latestActualFy));
  const shortfall = ot.reduce((s, a) => s + Math.max(0, a.expectedShortfall ?? 0), 0);
  const chronicTotal = chronic.reduce((s, a) => s + a.expectedIncrease, 0);
  const out: string[] = [];
  out.push(`# Citywide budget risk brief`);
  out.push(`_New York City · Prepared ${today()} with Baseline · Estimates are labeled as estimates_`);
  out.push(`## Summary`);
  out.push(
    [
      `- The Mayor's financial plan shows out-year gaps of ${FY27_YEARS.slice(1).map((y, i) => `${money(FY27_OMB_GAP[i + 1] * 1e6)} in ${fy(y)}`).join(", ")}. The Comptroller's restated view is ${FY27_YEARS.map((y, i) => `${money(FY27_COMPTROLLER_GAP[i] * 1e6)} (${fy(y)})`).join(", ")}.`,
      `- Overtime is adopted below what agencies pay. Baseline's forecasts imply next-year overtime will exceed adopted budgets by about **${money(shortfall)}** (estimate, all funds). The Comptroller estimates FY27 overtime is under-budgeted by ${money(589e6)} (city funds).`,
      `- **${num(chronic.length)} budget lines** have ended the year well above adoption in most recent years. If the pattern holds they will need about **${money(chronicTotal)}** more than adopted (estimate).`,
    ].join("\n"),
  );
  out.push(`## Out-year gap`);
  out.push(
    `| Fiscal year | Mayor's plan (OMB) | Comptroller restated | Comptroller tax revenue vs OMB |\n|---|---|---|---|\n` +
      FY27_YEARS.map((y, i) => `| ${fy(y)} | ${money(FY27_OMB_GAP[i] * 1e6)} | ${money(FY27_COMPTROLLER_GAP[i] * 1e6)} | ${money(FY27_REVENUE_DIFF.tax[i] * 1e6, { sign: true })} |`).join("\n"),
  );
  out.push(`Source: ${link("fy27Adopted")}. FY27 adopted budget: ${money(BUDGET_FACTS.fy27Adopted)}.`);
  out.push(`## Risks the Comptroller identified ($ millions, negative adds to the gap)`);
  out.push(
    `| Item | ${FY27_YEARS.map(fy).join(" | ")} |\n|---|${FY27_YEARS.map(() => "---").join("|")}|\n` +
      FY27_EXPENSE_RISKS.map((r) => `| ${r.label} | ${r.values.map((v) => num(v)).join(" | ")} |`).join("\n"),
  );
  out.push(`## Overtime: adopted vs actual, with Baseline's forecast`);
  out.push(
    `| Agency | ${fy(fyLatest)} adopted | ${fy(fyLatest)} actual | Next year adopted | Baseline forecast | Expected shortfall |\n|---|---|---|---|---|---|\n` +
      ot
        .slice(0, 12)
        .map((a) => `| ${a.agency.code} | ${money(a.latestAdoptedForActualYear)} | ${money(a.latestActual)} | ${money(a.nextAdopted)} | ${money(a.forecast)} | ${money(a.expectedShortfall, { sign: true })} |`)
        .join("\n"),
  );
  out.push(`Sources: Expense Budget and Citywide Payroll Data, NYC Open Data. Forecast: damped-trend model on up to eight years of actual overtime pay.`);
  out.push(`## Lines that grow after adoption`);
  out.push(
    chronic.length
      ? `| Agency | Object class | Latest adopted | Typical end-of-year change | Years over | Expected increase |\n|---|---|---|---|---|---|\n` +
          chronic
            .slice(0, 15)
            .map((a) => `| ${cell(a.line.agencyCode ?? a.line.agency)} | ${cell(a.line.objectClass.toLowerCase())} | ${money(a.latestAdopted)} | ${pct(a.medianRatio - 1, { sign: true })} | ${a.yearsOver} of ${a.yearsAssessed} | ${money(a.expectedIncrease)} |`)
            .join("\n")
      : "No lines meet Baseline's test.",
  );
  out.push(`Mid-year increases can also reflect grants recognized after adoption. Treat each line as a question to ask. Source: Expense Budget, NYC Open Data.`);
  out.push(`## Questions to ask`);
  out.push(
    [
      `1. Which overtime drivers (staffing levels, events, court time) explain the gap between adopted and actual overtime, and why isn't the adopted budget closer to recent spending?`,
      `2. For each line above that ends the year well above adoption, how much of the increase is new grant money and how much is spending the city knew it would need?`,
      `3. What is the plan to close the ${fy(FY27_YEARS[1])} gap, and which of the Comptroller's risks does the plan already account for?`,
    ].join("\n"),
  );
  return out.join("\n\n");
}

export function capitalDeliveryBrief(capital: CapitalData): string {
  const all = assessAllProjects(capital);
  const unique = uniqueByFms(all);
  const s = summarizeCapital(unique);
  const sched = summarizeCapital(all);
  const byAgency = new Map<string, ProjectAssessment[]>();
  for (const a of unique) byAgency.set(a.project.agency, [...(byAgency.get(a.project.agency) ?? []), a]);
  const agencies = [...byAgency.entries()].map(([code, list]) => ({ code, s: summarizeCapital(list) })).sort((a, b) => b.s.totalGrowth - a.s.totalGrowth);
  const worst = [...unique].sort((a, b) => b.growth - a.growth).slice(0, 12);
  const out: string[] = [];
  out.push(`# Capital delivery brief`);
  out.push(`_New York City · Capital Projects Dashboard, ${date(capital.meta.firstPeriod)} to ${date(capital.meta.latestPeriod)} · Prepared ${today()} with Baseline_`);
  out.push(`## Summary`);
  out.push(
    [
      `- **${num(s.grownCount)} of ${num(s.projects)} projects (${pct(s.grownCount / s.projects)})** now carry a budget above the first number the city published. Together they added **${money(s.totalGrowth)}**, taking the portfolio from ${money(s.totalFirstBudget)} to ${money(s.totalBudget)}.`,
      `- ${num(s.over20Count)} projects are up 20% or more since their first report.`,
      `- Of ${num(sched.withScheduleCount)} projects with a published completion forecast, **${num(sched.slippedCount)} (${pct(sched.slippedCount / Math.max(1, sched.withScheduleCount))})** have been pushed back, by a median of ${duration(sched.medianSlipDays)}.`,
    ].join("\n"),
  );
  out.push(`Budgets are measured against the first figure the city published and never re-based. Each budget ID is counted once.`);
  out.push(`## By agency`);
  out.push(
    `| Agency | Projects | Total budget | Growth since first report | Up 20%+ |\n|---|---|---|---|---|\n` +
      agencies
        .slice(0, 12)
        .map((a) => `| ${a.code} | ${num(a.s.projects)} | ${money(a.s.totalBudget)} | ${money(a.s.totalGrowth, { sign: true })} | ${num(a.s.over20Count)} |`)
        .join("\n"),
  );
  out.push(`## Largest increases`);
  out.push(
    `| Project | Agency | Borough | First budget | Current budget | Change |\n|---|---|---|---|---|---|\n` +
      worst.map((a) => `| ${cell(a.project.name)} | ${a.project.agency} | ${a.project.boro} | ${money(a.project.firstBudget ?? a.project.budget)} | ${money(a.project.budget)} | ${pct(a.growthPct, { sign: true })} |`).join("\n"),
  );
  if (sched.reasons.length) {
    out.push(`## Why schedules slip (reasons the city reported)`);
    out.push(sched.reasons.slice(0, 6).map(([r, n]) => `- ${r}: ${num(n)} times`).join("\n"));
  }
  out.push(`## Published context`);
  out.push(
    [
      `- The NY State Comptroller found ${pct(CAPITAL_FACTS.dinapoli.delayedShare)} of ${num(CAPITAL_FACTS.dinapoli.projects)} NYC projects delayed and more than half over their initial budgets, with ${money(CAPITAL_FACTS.dinapoli.extraPlannedSpending)} more planned spending than first anticipated. ${link("dinapoli2024")}`,
      `- The NYC Comptroller found ${pct(CAPITAL_FACTS.ddc.lateShare)} of DDC-managed projects behind their original schedule by 3.5 years on average, and that DDC re-bases schedules at each phase. ${link("ddcAudit")}`,
      `- The public dashboard covers only ${pct(CAPITAL_FACTS.dashboard.fmsIdCoverage, { digits: 1 })} of project IDs, so these totals are a floor. ${link("flyingBlind")}`,
    ].join("\n"),
  );
  return out.join("\n\n");
}

export function estimatesReport(estimates: SavedEstimate[], classLabel: (id: string) => string): string {
  const out: string[] = [];
  out.push(`# Saved cost estimates`);
  out.push(`_Prepared ${today()} with Baseline's cost forecaster · Reference class: past NYC capital projects (Capital Project Detail Data, NYC Open Data)_`);
  if (!estimates.length) {
    out.push(`No saved estimates yet. Price a project in the Cost forecaster and save it to include it here.`);
    return out.join("\n\n");
  }
  const totalBase = estimates.reduce((s, e) => s + e.baseEstimate, 0);
  const totalP80 = estimates.reduce((s, e) => s + e.p80, 0);
  out.push(
    `Across ${num(estimates.length)} projects, the original estimates add up to **${money(totalBase)}**. Budgeting at 80% confidence would take **${money(totalP80)}** (${pct(totalP80 / Math.max(1, totalBase) - 1, { sign: true })}). These are Baseline estimates based on how similar city projects turned out.`,
  );
  out.push(
    `| Project | Type | Agency | Estimate | Median outcome | 80% confidence | 90% confidence | Likely delay | Comparables |\n|---|---|---|---|---|---|---|---|---|\n` +
      estimates
        .map(
          (e) =>
            `| ${cell(e.name || "Untitled")} | ${cell(classLabel(e.assetClass))} | ${e.agency ? cell(agencyName(e.agency)) : "Any"} | ${money(e.baseEstimate)} | ${money(e.p50)} | ${money(e.p80)} | ${money(e.p90)} | ${e.expectedSlipDays ? duration(e.expectedSlipDays) : "—"} | ${num(e.comparables)} |`,
        )
        .join("\n"),
  );
  const noted = estimates.filter((e) => e.notes);
  if (noted.length) out.push(`## Notes\n\n${noted.map((e) => `- **${e.name}:** ${e.notes}`).join("\n")}`);
  out.push(`The 80% figure means four in five similar past projects came in under it. Past projects were mostly still under way in 2023, so real overruns may be larger.`);
  return out.join("\n\n");
}
