// Extra budget-risk logic on top of core.ts: display helpers, plain-language readings, citywide overtime.
import { agencyName, isKnownAgency } from "../data/agencies";
import type { OvertimeData } from "../data/types";
import { money, pct } from "../lib/format";
import { holtForecast } from "../lib/stats";
import type { LineAssessment, OvertimeAssessment } from "./core";

/** Object classes that are pay or pay-related. Overtime sits inside ADDITIONAL GROSS PAY. */
export const PAYROLL_CLASSES = new Set(["FULL TIME SALARIED", "OTHER SALARIED", "UNSALARIED", "ADDITIONAL GROSS PAY", "FRINGE BENEFITS"]);

const SMALL_WORDS = new Set(["of", "and", "the", "for", "in", "on", "at", "to", "a", "&"]);
const KEEP_UPPER = new Set(["NYC", "NYPD", "FDNY", "CUNY", "HRA", "DOE", "DOT", "OTPS", "PS", "MTA", "II", "III"]);

export function titleCaseName(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (KEEP_UPPER.has(up.replace(/[.,]/g, ""))) return up;
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/\bAdmin Trials\b/g, "Administrative Trials")
    .replace(/\bAdmin\b/g, "Administration")
    .replace(/\bDept\b/g, "Department")
    .replace(/\bProtect\.$/, "Protection");
}

/** Agency label for a budget line: registry name when known, otherwise the raw name title-cased. */
export function lineAgency(a: Pick<LineAssessment, "line">): string {
  const code = a.line.agencyCode;
  return code && isKnownAgency(code) ? agencyName(code) : titleCaseName(a.line.agency);
}

export const objectClassLabel = (raw: string) => titleCaseName(raw).replace(/^Otps\b/, "OTPS");

export const isPayrollLine = (a: Pick<LineAssessment, "line">) => PAYROLL_CLASSES.has(a.line.objectClass);

/** One or two plain sentences describing what a line's history shows. */
export function lineReading(a: LineAssessment): string {
  const name = `${objectClassLabel(a.line.objectClass)} at ${lineAgency(a)}`;
  if (a.technical) return `${name} is a technical holding line that moves when money is reallocated, so Baseline does not rank it.`;
  if (!a.yearsAssessed) return `${name} does not yet have a full year of adopted and modified figures to compare.`;
  const over = `${a.yearsOver} of the last ${a.yearsAssessed} years`;
  if (a.chronic) {
    return `${name} ended ${over} at least 5% above its adopted amount. In a typical year it finished ${pct(a.medianRatio - 1)} above adoption. If that pattern holds, the ${money(a.latestAdopted)} adopted for FY${String(a.latestAdoptedFy).slice(-2)} would grow by about ${money(a.expectedIncrease)} during the year (estimate).`;
  }
  if (a.level === "watch") return `${name} ended ${over} above its adopted amount, but not by enough, or often enough, to call it chronic. Worth watching.`;
  return `${name} usually ends the year close to its adopted amount (median ${pct(a.medianRatio - 1, { sign: true })}).`;
}

export interface CitywideOvertimeRow {
  fy: number;
  adopted: number | null;
  modified: number | null;
  actual: number | null;
  hours: number | null;
}

export interface CitywideOvertime {
  rows: CitywideOvertimeRow[];
  latestActualFy: number;
  nextFy: number;
  nextAdopted: number | null;
  forecast: number;
  low: number;
  high: number;
  agencies: number;
}

/** Sum the matched agencies by fiscal year. A year counts only where every agency with data in that field reported. */
export function citywideOvertime(data: OvertimeData, fromFy = 2016): CitywideOvertime {
  const fys = [...new Set(data.agencies.flatMap((a) => a.years.map((y) => y.fy)))].filter((fy) => fy >= fromFy).sort((a, b) => a - b);
  const total = (fy: number, key: "adopted" | "modified" | "actual" | "hours") => {
    let s = 0;
    let any = false;
    for (const a of data.agencies) {
      const v = a.years.find((y) => y.fy === fy)?.[key];
      if (v !== null && v !== undefined) {
        s += v;
        any = true;
      }
    }
    return any ? s : null;
  };
  const rows = fys.map((fy) => ({ fy, adopted: total(fy, "adopted"), modified: total(fy, "modified"), actual: total(fy, "actual"), hours: total(fy, "hours") }));
  const withActual = rows.filter((r) => (r.actual ?? 0) > 0);
  const latestActualFy = withActual.at(-1)?.fy ?? 0;
  const f = holtForecast(withActual.slice(-8).map((r) => r.actual as number), 1);
  const nextFy = latestActualFy + 1;
  return {
    rows,
    latestActualFy,
    nextFy,
    nextAdopted: rows.find((r) => r.fy === nextFy)?.adopted ?? null,
    forecast: Math.max(0, f.point[0] ?? 0),
    low: Math.max(0, f.low[0] ?? 0),
    high: f.high[0] ?? 0,
    agencies: data.agencies.length,
  };
}

/** Sum of Baseline's expected FY overtime shortfalls (forecast minus adopted), positive only. */
export function totalOvertimeShortfall(items: OvertimeAssessment[]): number {
  return items.reduce((s, a) => s + Math.max(0, a.expectedShortfall ?? 0), 0);
}

/** Questions a council finance committee could ask, built from the top flagged lines. */
export function councilQuestions(lines: LineAssessment[], overtime: OvertimeAssessment[], max = 6): string[] {
  const qs: string[] = [];
  const topOt = overtime.filter((o) => (o.expectedShortfall ?? 0) > 0).slice(0, 2);
  for (const o of topOt) {
    qs.push(
      `${o.agency.name}: overtime paid in FY${String(o.latestActualFy).slice(-2)} was ${money(o.latestActual)}, ${pct(o.latestRatio)} of what was adopted. Why is FY${String(o.nextFy).slice(-2)} adopted at ${money(o.nextAdopted)} when spending is forecast near ${money(o.forecast)}?`,
    );
  }
  for (const a of lines.filter((l) => l.chronic).slice(0, max - qs.length)) {
    qs.push(
      `${lineAgency(a)}, ${objectClassLabel(a.line.objectClass).toLowerCase()}: this line ended ${a.yearsOver} of the last ${a.yearsAssessed} years above adoption (typically ${pct(a.medianRatio - 1, { sign: true })}). What share of that growth is new grant money, and what share is spending the adopted budget didn't plan for?`,
    );
  }
  return qs.slice(0, max);
}
