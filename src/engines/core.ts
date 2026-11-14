// Shared definitions every screen uses. If two screens disagree on a number, the bug is here.
import type { RiskLevel } from "../components/ui";
import type { BudgetLine, CapitalData, CapitalProject, OvertimeAgency, OvertimeData, BudgetLinesData } from "../data/types";
import { holtForecast, median } from "../lib/stats";

// ---- Expense budget: lines that grow after adoption -------------------------------------------------
/** Object classes that move for technical reasons (holding codes, central allocations). Excluded from rankings. */
export const TECHNICAL_CLASSES = new Set(["AMOUNTS TO BE SCHEDULED", "OTPS HOLDING CODES", "TRANSFERS FOR DEBT SERVICE", "UNALLOCATED", "Unclassified"]);

export interface LineYear {
  fy: number;
  adopted: number;
  modified: number;
  ratio: number;
  gap: number;
}

export interface LineAssessment {
  line: BudgetLine;
  key: string;
  years: LineYear[];
  /** Median of modified / adopted over the assessed years. */
  medianRatio: number;
  /** Years where the modified budget ended at least 5% above adoption. */
  yearsOver: number;
  yearsAssessed: number;
  lastGap: number;
  lastRatio: number;
  /** Latest adopted amount (may be the upcoming year with no modified figure yet). */
  latestAdopted: number;
  latestAdoptedFy: number;
  /** Expected in-year increase for the latest adopted year if the pattern holds. */
  expectedIncrease: number;
  chronic: boolean;
  level: RiskLevel;
  technical: boolean;
}

export const lineKey = (l: BudgetLine) => `${l.agency}||${l.objectClass}`;

export function assessLine(line: BudgetLine, window = 8): LineAssessment {
  const complete = line.years
    .filter((y) => y.adopted !== null && y.modified !== null && (y.adopted ?? 0) > 0)
    .map((y) => ({ fy: y.fy, adopted: y.adopted as number, modified: y.modified as number }))
    .map((y) => ({ ...y, ratio: y.modified / y.adopted, gap: y.modified - y.adopted }))
    .slice(-window);
  const latest = [...line.years].reverse().find((y) => (y.adopted ?? 0) > 0);
  const latestAdopted = latest?.adopted ?? 0;
  const ratios = complete.map((y) => y.ratio);
  const medianRatio = ratios.length ? median(ratios) : 1;
  const yearsOver = complete.filter((y) => y.ratio >= 1.05).length;
  const last = complete.at(-1);
  const technical = TECHNICAL_CLASSES.has(line.objectClass);
  // Calibrated on NYC data: 5+ years of history, above adoption in 3 of every 4 years, by a median of 20%+.
  // Looser thresholds mostly catch grant money recognized mid-year rather than lines set too low.
  const chronic = !technical && complete.length >= 5 && yearsOver / complete.length >= 0.75 && medianRatio >= 1.2;
  const expectedIncrease = Math.max(0, latestAdopted * (medianRatio - 1));
  let level: RiskLevel = "low";
  if (!technical && complete.length >= 3) {
    if (chronic && medianRatio >= 1.5) level = "critical";
    else if (chronic) level = "high";
    else if (yearsOver >= 2 && medianRatio >= 1.05) level = "watch";
  }
  return {
    line,
    key: lineKey(line),
    years: complete,
    medianRatio,
    yearsOver,
    yearsAssessed: complete.length,
    lastGap: last?.gap ?? 0,
    lastRatio: last?.ratio ?? 1,
    latestAdopted,
    latestAdoptedFy: latest?.fy ?? 0,
    expectedIncrease,
    chronic,
    level,
    technical,
  };
}

export function assessAllLines(data: BudgetLinesData): LineAssessment[] {
  return data.lines.map((l) => assessLine(l)).sort((a, b) => b.expectedIncrease - a.expectedIncrease);
}

// ---- Overtime -------------------------------------------------------------------------------------
export interface OvertimeAssessment {
  agency: OvertimeAgency;
  latestActualFy: number;
  latestActual: number;
  latestAdoptedForActualYear: number;
  /** Actual / adopted in the latest year with actuals. */
  latestRatio: number;
  /** Years (of the last 6 with both figures) where actual beat adopted by 10%+. */
  yearsOver: number;
  yearsAssessed: number;
  /** Next fiscal year: adopted budget (if published) and Baseline's forecast of actual spending. */
  nextFy: number;
  nextAdopted: number | null;
  forecast: number;
  forecastLow: number;
  forecastHigh: number;
  expectedShortfall: number | null;
  level: RiskLevel;
}

export function assessOvertime(agency: OvertimeAgency): OvertimeAssessment {
  const withActual = agency.years.filter((y) => y.actual !== null && y.actual > 0);
  const latest = withActual.at(-1);
  const latestActualFy = latest?.fy ?? 0;
  const both = withActual.filter((y) => (y.adopted ?? 0) > 0).slice(-6);
  const yearsOver = both.filter((y) => (y.actual as number) >= (y.adopted as number) * 1.1).length;
  // Forecast from the last eight years of actual spending; damped trend keeps one spike from running away.
  const series = withActual.slice(-8).map((y) => y.actual as number);
  const f = holtForecast(series, 1);
  const nextFy = latestActualFy + 1;
  const next = agency.years.find((y) => y.fy === nextFy);
  const nextAdopted = next?.adopted ?? null;
  const forecast = Math.max(0, f.point[0] ?? latest?.actual ?? 0);
  const ratio = latest && (latest.adopted ?? 0) > 0 ? (latest.actual as number) / (latest.adopted as number) : 1;
  const expectedShortfall = nextAdopted !== null ? forecast - nextAdopted : null;
  const shortfallShare = nextAdopted ? (expectedShortfall ?? 0) / nextAdopted : 0;
  let level: RiskLevel = "low";
  if (shortfallShare >= 0.75 || ratio >= 2) level = "critical";
  else if (shortfallShare >= 0.3 || ratio >= 1.4) level = "high";
  else if (shortfallShare >= 0.1 || ratio >= 1.1) level = "watch";
  return {
    agency,
    latestActualFy,
    latestActual: latest?.actual ?? 0,
    latestAdoptedForActualYear: latest?.adopted ?? 0,
    latestRatio: ratio,
    yearsOver,
    yearsAssessed: both.length,
    nextFy,
    nextAdopted,
    forecast,
    forecastLow: Math.max(0, f.low[0] ?? forecast),
    forecastHigh: f.high[0] ?? forecast,
    expectedShortfall,
    level,
  };
}

export function assessAllOvertime(data: OvertimeData): OvertimeAssessment[] {
  return data.agencies.map(assessOvertime).sort((a, b) => (b.expectedShortfall ?? 0) - (a.expectedShortfall ?? 0));
}

// ---- Capital projects -----------------------------------------------------------------------------
export interface ProjectAssessment {
  project: CapitalProject;
  growth: number;
  growthPct: number;
  slipDays: number;
  level: RiskLevel;
  flags: string[];
  topReason: string | null;
  /** The budget is an FMS ID shared with other projects; count its dollars once. */
  sharedBudget: boolean;
}

export function assessProject(p: CapitalProject): ProjectAssessment {
  const first = p.firstBudget && p.firstBudget > 0 ? p.firstBudget : p.budget;
  const growth = p.budget - first;
  const growthPct = first > 0 ? p.budget / first - 1 : 0;
  const slipDays = Math.max(0, p.slipDays ?? 0);
  const flags: string[] = [];
  if (growthPct >= 0.2) flags.push(`Budget up ${Math.round(growthPct * 100)}% since first report`);
  if (slipDays >= 365) flags.push(`Completion pushed back ${(slipDays / 365).toFixed(1)} years`);
  else if (slipDays >= 90) flags.push(`Completion pushed back ${Math.round(slipDays / 30.4)} months`);
  const reasons = Object.entries(p.reasons ?? {}).sort((a, b) => b[1] - a[1]);
  let level: RiskLevel = "low";
  if (growthPct >= 0.5 || slipDays >= 730) level = "critical";
  else if (growthPct >= 0.2 || slipDays >= 365) level = "high";
  else if (growthPct >= 0.05 || slipDays >= 90) level = "watch";
  const sharedBudget = (p.shared ?? 1) > 1;
  if (sharedBudget) flags.push(`Budget ID shared by ${p.shared} projects`);
  return { project: p, growth, growthPct, slipDays, level, flags, topReason: reasons[0]?.[0] ?? null, sharedBudget };
}

/** Keep one project per FMS budget ID, so dollar totals don't double count shared budgets. */
export function uniqueBudgets(items: ProjectAssessment[]): ProjectAssessment[] {
  const seen = new Set<string>();
  return items.filter((a) => {
    const key = a.project.fmsId || a.project.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface CapitalSummary {
  projects: number;
  /** Distinct FMS budget IDs among the projects. Dollar totals and growth counts are per budget ID. */
  budgetIds: number;
  totalBudget: number;
  totalFirstBudget: number;
  totalGrowth: number;
  grownCount: number;
  over20Count: number;
  slippedCount: number;
  withScheduleCount: number;
  medianSlipDays: number;
  byLevel: Record<RiskLevel, number>;
  reasons: [string, number][];
}

export function summarizeCapital(items: ProjectAssessment[]): CapitalSummary {
  const byLevel: Record<RiskLevel, number> = { low: 0, watch: 0, high: 0, critical: 0 };
  const reasons = new Map<string, number>();
  let totalBudget = 0;
  let totalFirst = 0;
  let grown = 0;
  let over20 = 0;
  let slipped = 0;
  let withSchedule = 0;
  const slips: number[] = [];
  const seenBudgets = new Set<string>();
  for (const a of items) {
    byLevel[a.level]++;
    const budgetKey = a.project.fmsId || a.project.id;
    if (!seenBudgets.has(budgetKey)) {
      // Money and growth counts are per budget ID; a shared ID is counted once.
      seenBudgets.add(budgetKey);
      totalBudget += a.project.budget;
      totalFirst += a.project.firstBudget ?? a.project.budget;
      if (a.growthPct > 0.001) grown++;
      if (a.growthPct >= 0.2) over20++;
    }
    if (a.project.firstForecast) {
      withSchedule++;
      if (a.slipDays > 0) {
        slipped++;
        slips.push(a.slipDays);
      }
    }
    for (const [r, n] of Object.entries(a.project.reasons ?? {})) reasons.set(r, (reasons.get(r) ?? 0) + n);
  }
  return {
    projects: items.length,
    budgetIds: seenBudgets.size,
    totalBudget,
    totalFirstBudget: totalFirst,
    totalGrowth: totalBudget - totalFirst,
    grownCount: grown,
    over20Count: over20,
    slippedCount: slipped,
    withScheduleCount: withSchedule,
    medianSlipDays: slips.length ? median(slips) : 0,
    byLevel,
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function assessAllProjects(data: CapitalData): ProjectAssessment[] {
  return data.projects.map(assessProject);
}

// ---- Per-agency rollup (used by Home, Hearing prep and Ask) -----------------------------------------
export interface AgencyFacts {
  code: string;
  overtime: OvertimeAssessment | null;
  capital: CapitalSummary | null;
  worstProjects: ProjectAssessment[];
  chronicLines: LineAssessment[];
}

export function buildAgencyFacts(input: { overtime?: OvertimeData | null; capital?: CapitalData | null; budgetLines?: BudgetLinesData | null }): Map<string, AgencyFacts> {
  const out = new Map<string, AgencyFacts>();
  const get = (code: string) => {
    if (!out.has(code)) out.set(code, { code, overtime: null, capital: null, worstProjects: [], chronicLines: [] });
    return out.get(code)!;
  };
  if (input.overtime) for (const a of assessAllOvertime(input.overtime)) get(a.agency.code).overtime = a;
  if (input.capital) {
    const byAgency = new Map<string, ProjectAssessment[]>();
    for (const a of assessAllProjects(input.capital)) {
      const list = byAgency.get(a.project.agency) ?? [];
      list.push(a);
      byAgency.set(a.project.agency, list);
    }
    for (const [code, list] of byAgency) {
      const f = get(code);
      f.capital = summarizeCapital(list);
      f.worstProjects = uniqueBudgets([...list].sort((x, y) => y.growth - x.growth)).slice(0, 8);
    }
  }
  if (input.budgetLines) {
    for (const a of assessAllLines(input.budgetLines)) {
      if (a.chronic && a.line.agencyCode) get(a.line.agencyCode).chronicLines.push(a);
    }
  }
  return out;
}
