// Year-end spending projections for budget lines the user tracks month by month.
// Three methods: run rate, seasonal profile, and a blend. All projections are estimates.
import type { RiskLevel } from "../components/ui";
import type { CustomBudgetLine } from "../state/store";
import { mean, stdev, sum } from "../lib/stats";

/** City fiscal year months, July first. */
export const FISCAL_MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const;

export type Method = "runRate" | "seasonal" | "blended";

export const METHOD_LABEL: Record<Method, string> = {
  runRate: "Run rate",
  seasonal: "Seasonal profile",
  blended: "Blended",
};

/** 12 positive shares summing to 1. Missing, short or invalid input falls back to an even (flat) profile. */
export function normalizeProfile(profile?: number[] | null): number[] {
  if (!profile || profile.length !== 12 || profile.some((v) => !Number.isFinite(v) || v < 0)) return Array(12).fill(1 / 12);
  const total = sum(profile);
  if (total <= 0) return Array(12).fill(1 / 12);
  return profile.map((v) => v / total);
}

export function isFlatProfile(profile?: number[] | null): boolean {
  const p = normalizeProfile(profile);
  return p.every((v) => Math.abs(v - 1 / 12) < 1e-6);
}

export interface PathPoint {
  month: string;
  /** Cumulative actual spending through this month (null after the last reported month). */
  actual: number | null;
  /** Where cumulative spending "should" be if the adopted budget is spent on the profile. */
  budget: number;
  /** Cumulative projection from the last reported month to June. */
  projected: number | null;
  /** [low, high] of the cumulative projection. */
  band: [number, number] | null;
}

export interface LineProjection {
  line: CustomBudgetLine;
  monthsReported: number;
  ytd: number;
  /** Share of the year's spending the profile expects by now. */
  shareElapsed: number;
  runRate: number;
  seasonal: number;
  blended: number;
  projected: number;
  low: number;
  high: number;
  method: Method;
  variance: number;
  variancePct: number;
  /** Positive variance = projected overspend. */
  level: RiskLevel;
  under: boolean;
  path: PathPoint[];
  /** Budget left for the rest of the year and what that allows per remaining month. */
  remainingBudget: number;
  allowedPerMonth: number | null;
}

const Z80 = 1.2816;

export function statusFor(variancePct: number): RiskLevel {
  if (variancePct >= 0.15) return "critical";
  if (variancePct >= 0.05) return "high";
  if (variancePct >= 0.02) return "watch";
  return "low";
}

/** Project one line's year-end total. Only the first 12 numeric months are used. */
export function projectLine(line: CustomBudgetLine, method: Method = "blended"): LineProjection {
  const monthly = (line.monthly ?? []).slice(0, 12).map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  const n = monthly.length;
  const profile = normalizeProfile(line.profile);
  const ytd = sum(monthly);
  const shareElapsed = n ? sum(profile.slice(0, n)) : 0;
  const adopted = Math.max(0, line.adopted || 0);

  let runRate: number;
  let seasonal: number;
  if (n === 0) {
    runRate = adopted;
    seasonal = adopted;
  } else {
    runRate = n >= 12 ? ytd : (ytd / n) * 12;
    seasonal = n >= 12 ? ytd : shareElapsed > 0 ? ytd / shareElapsed : runRate;
  }
  // With a flat profile the two methods agree; with a real profile, lean on it as the year matures.
  const w = isFlatProfile(line.profile) ? 0.5 : Math.min(0.8, 0.5 + n * 0.05);
  const blended = n >= 12 ? ytd : w * seasonal + (1 - w) * runRate;
  const projected = method === "runRate" ? runRate : method === "seasonal" ? seasonal : blended;

  // Uncertainty: spread of each month's implied annual total, shrinking as less of the year remains.
  const implied = monthly.map((v, i) => (profile[i] > 0 ? v / profile[i] : v * 12));
  const remainingShare = Math.max(0, 1 - shareElapsed);
  let half: number;
  if (n >= 12) half = 0;
  else if (n >= 2) half = Z80 * stdev(implied) * remainingShare * Math.sqrt(1 + 1 / n);
  else half = Math.abs(projected || adopted) * 0.15 * remainingShare;
  // Never claim more precision than ±2% of the projection while months remain.
  if (n < 12) half = Math.max(half, Math.abs(projected) * 0.02 * remainingShare);
  const low = Math.max(ytd, projected - half);
  const high = projected + half;

  const variance = projected - adopted;
  const variancePct = adopted > 0 ? variance / adopted : 0;

  const cum = profile.reduce<number[]>((acc, p, i) => {
    acc.push((acc[i - 1] ?? 0) + p);
    return acc;
  }, []);
  const cumAtLast = n ? cum[n - 1] : 0;
  let running = 0;
  const path: PathPoint[] = FISCAL_MONTHS.map((month, i) => {
    if (i < n) running += monthly[i];
    const actual = i < n ? running : null;
    let proj: number | null = null;
    let band: [number, number] | null = null;
    if (n === 0 || i >= n - 1) {
      const frac = cumAtLast >= 1 ? 1 : (cum[i] - cumAtLast) / (1 - cumAtLast);
      const f = Math.max(0, Math.min(1, frac));
      proj = ytd + (projected - ytd) * f;
      band = [ytd + (low - ytd) * f, ytd + (high - ytd) * f];
    }
    return { month, actual, budget: adopted * cum[i], projected: proj, band };
  });

  const monthsLeft = 12 - n;
  const remainingBudget = adopted - ytd;
  return {
    line,
    monthsReported: n,
    ytd,
    shareElapsed,
    runRate,
    seasonal,
    blended,
    projected,
    low,
    high,
    method,
    variance,
    variancePct,
    level: statusFor(variancePct),
    under: variancePct <= -0.1,
    path,
    remainingBudget,
    allowedPerMonth: monthsLeft > 0 ? remainingBudget / monthsLeft : null,
  };
}

export interface PortfolioSummary {
  lines: number;
  adopted: number;
  ytd: number;
  projected: number;
  variance: number;
  atRisk: number;
}

export function summarize(projections: LineProjection[]): PortfolioSummary {
  return {
    lines: projections.length,
    adopted: sum(projections.map((p) => p.line.adopted)),
    ytd: sum(projections.map((p) => p.ytd)),
    projected: sum(projections.map((p) => p.projected)),
    variance: sum(projections.map((p) => p.variance)),
    atRisk: projections.filter((p) => p.level === "high" || p.level === "critical").length,
  };
}

// ---- CSV import -----------------------------------------------------------------------------------
export const CSV_TEMPLATE_HEADERS = ["name", "agency", "adopted", ...FISCAL_MONTHS.map((m) => m.toLowerCase())];

export function csvTemplate(): string {
  const example = ["Example: Snow removal overtime", "DSNY", "45000000", "400000", "300000", "300000", "1200000", "", "", "", "", "", "", "", ""];
  return [CSV_TEMPLATE_HEADERS.join(","), example.join(",")].join("\n");
}

/** Accepts "$1,200,000", "1.2M", "450k" or plain numbers. Empty cells return null. */
export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(-?\d*\.?\d+)([kmb])?$/i);
  if (!m) return NaN;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Number(m[1]) * mult;
}

export interface CsvResult {
  lines: Omit<CustomBudgetLine, "id">[];
  errors: string[];
}

/** Turn parsed CSV rows (header: true) into budget lines. Months must be contiguous from July. */
export function linesFromCsvRows(rows: Record<string, unknown>[]): CsvResult {
  const errors: string[] = [];
  const lines: Omit<CustomBudgetLine, "id">[] = [];
  rows.forEach((raw, idx) => {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) row[k.trim().toLowerCase()] = v;
    const rowNo = idx + 2; // header is row 1
    const name = String(row.name ?? "").trim();
    if (!name && Object.values(row).every((v) => !String(v ?? "").trim())) return; // blank line
    if (!name) {
      errors.push(`Row ${rowNo}: missing a name.`);
      return;
    }
    const adopted = parseAmount(row.adopted);
    if (adopted === null || !Number.isFinite(adopted) || adopted <= 0) {
      errors.push(`Row ${rowNo} (${name}): "adopted" must be a positive amount.`);
      return;
    }
    const monthly: number[] = [];
    let ended = false;
    for (const m of FISCAL_MONTHS) {
      const v = parseAmount(row[m.toLowerCase()]);
      if (v === null) {
        ended = true;
        continue;
      }
      if (!Number.isFinite(v) || v < 0) {
        errors.push(`Row ${rowNo} (${name}): "${m}" is not a valid amount.`);
        return;
      }
      if (ended) {
        errors.push(`Row ${rowNo} (${name}): months must be filled in order from July with no gaps.`);
        return;
      }
      monthly.push(v);
    }
    lines.push({ name, agency: String(row.agency ?? "").trim() || "Unassigned", adopted, monthly });
  });
  return { lines, errors };
}

// ---- Sample lines (clearly labeled, fictional amounts) ----------------------------------------------
export const WINTER_PROFILE = [0.01, 0.01, 0.01, 0.02, 0.08, 0.18, 0.25, 0.25, 0.12, 0.04, 0.02, 0.01];

export function sampleLines(): Omit<CustomBudgetLine, "id">[] {
  return [
    {
      name: "SAMPLE · Snow removal overtime",
      agency: "DSNY",
      adopted: 45_000_000,
      monthly: [420_000, 380_000, 350_000, 1_900_000],
      profile: WINTER_PROFILE,
    },
    {
      name: "SAMPLE · Shelter provider contracts",
      agency: "DHS",
      adopted: 1_900_000_000,
      monthly: [171_000_000, 176_000_000, 179_000_000, 184_000_000],
    },
    {
      name: "SAMPLE · Fleet fuel",
      agency: "DCAS",
      adopted: 120_000_000,
      monthly: [9_600_000, 9_800_000, 10_100_000, 9_900_000],
    },
  ];
}

export const averageMonthly = (line: CustomBudgetLine) => (line.monthly.length ? mean(line.monthly) : 0);
