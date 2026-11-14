// 311 service demand: seasonal forecasts, year-over-year change and anomaly checks for each complaint type.
import type { DemandData, DemandType } from "../data/types";
import { seasonalForecast, sum } from "../lib/stats";

/** The budget line each complaint type puts pressure on. Plain-language labels, not official codes. */
export const BUDGET_LINK: Record<string, string> = {
  "Street Condition": "DOT street maintenance and resurfacing; Highways capital (HW)",
  "Sidewalk Condition": "DOT sidewalk inspection and repair",
  "Street Light Condition": "DOT street lighting maintenance",
  "Traffic Signal Condition": "DOT traffic signal maintenance",
  "Water System": "DEP water distribution operations; water main capital",
  Sewer: "DEP sewer maintenance; sewer capital (SE)",
  "HEAT/HOT WATER": "HPD code enforcement and the Emergency Repair Program",
  "UNSANITARY CONDITION": "HPD code enforcement",
  "Dirty Condition": "DSNY street cleaning",
  "Missed Collection": "DSNY refuse collection",
  Rodent: "DOHMH pest control",
  "Damaged Tree": "Parks forestry and tree maintenance",
  "Homeless Person Assistance": "DHS street outreach",
  "Noise - Residential": "NYPD patrol",
  "Illegal Parking": "NYPD traffic enforcement",
};

export interface MonthPoint {
  month: string; // YYYY-MM
  actual: number | null;
  forecast: number | null;
  band: [number, number] | null;
}

export type AnomalyLevel = "above" | "within" | "below";

export interface DemandAssessment {
  type: DemandType;
  /** Complete months only (the current month to date is split out). */
  complete: [string, number][];
  partial: [string, number] | null;
  last12: number;
  prior12: number;
  yoy: number;
  latestMonth: string | null;
  latestValue: number | null;
  expectedLatest: number | null;
  expectedBand: [number, number] | null;
  anomaly: AnomalyLevel;
  next12: number;
  next12Low: number;
  next12High: number;
  /** Peak month in the last 12 complete months compared with the same month a year earlier. */
  peak: { month: string; value: number; priorYearValue: number | null; ratio: number | null } | null;
  points: MonthPoint[];
  trendPerYear: number;
}

const monthIndex = (ym: string) => Number(ym.slice(5, 7));

export function addMonths(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}`;
}

/** Split off the in-progress month: a month is partial when it is the month the data was fetched in. */
export function splitPartial(months: [string, number][], fetchedAt: string): { complete: [string, number][]; partial: [string, number] | null } {
  const fetchedMonth = fetchedAt.slice(0, 7);
  const last = months.at(-1);
  if (last && last[0] >= fetchedMonth) return { complete: months.slice(0, -1), partial: last };
  return { complete: months, partial: null };
}

/** Fill gaps so the series is contiguous month by month. */
export function contiguous(months: [string, number][]): [string, number][] {
  if (!months.length) return [];
  const map = new Map(months);
  const out: [string, number][] = [];
  for (let m = months[0][0]; m <= months[months.length - 1][0]; m = addMonths(m, 1)) out.push([m, map.get(m) ?? 0]);
  return out;
}

export function assessDemand(type: DemandType, fetchedAt: string, horizon = 12): DemandAssessment {
  const { complete: rawComplete, partial } = splitPartial(type.months, fetchedAt);
  const complete = contiguous(rawComplete);
  const values = complete.map((m) => m[1]);
  const startMonth = complete.length ? monthIndex(complete[0][0]) : 1;
  const last12 = sum(values.slice(-12));
  const prior12 = sum(values.slice(-24, -12));
  const yoy = prior12 > 0 ? last12 / prior12 - 1 : 0;

  // Anomaly: refit without the latest complete month, then see where that month landed.
  let expectedLatest: number | null = null;
  let expectedBand: [number, number] | null = null;
  let anomaly: AnomalyLevel = "within";
  if (values.length >= 25) {
    const hold = seasonalForecast(values.slice(0, -1), startMonth, 1);
    expectedLatest = hold.point[0];
    expectedBand = [hold.low[0], hold.high[0]];
    const v = values[values.length - 1];
    if (v > hold.high[0]) anomaly = "above";
    else if (v < hold.low[0]) anomaly = "below";
  }

  const f = seasonalForecast(values, startMonth, horizon);
  const lastMonth = complete.at(-1)?.[0] ?? null;
  const points: MonthPoint[] = complete.map(([m, v]) => ({ month: m, actual: v, forecast: null, band: null }));
  if (lastMonth) {
    // Join the forecast line to the last actual so the chart reads continuously.
    points[points.length - 1].forecast = values[values.length - 1];
    f.point.forEach((p, i) => {
      points.push({ month: addMonths(lastMonth, i + 1), actual: null, forecast: Math.round(p), band: [Math.round(f.low[i]), Math.round(f.high[i])] });
    });
  }

  let peak: DemandAssessment["peak"] = null;
  const recent = complete.slice(-12);
  if (recent.length) {
    const top = recent.reduce((a, b) => (b[1] > a[1] ? b : a));
    const priorKey = addMonths(top[0], -12);
    const prior = complete.find((m) => m[0] === priorKey)?.[1] ?? null;
    peak = { month: top[0], value: top[1], priorYearValue: prior, ratio: prior && prior > 0 ? top[1] / prior : null };
  }

  return {
    type,
    complete,
    partial,
    last12,
    prior12,
    yoy,
    latestMonth: lastMonth,
    latestValue: values.at(-1) ?? null,
    expectedLatest,
    expectedBand,
    anomaly,
    next12: sum(f.point),
    next12Low: sum(f.low),
    next12High: sum(f.high),
    peak,
    points,
    trendPerYear: f.trendPerYear,
  };
}

export function assessAllDemand(data: DemandData): DemandAssessment[] {
  return data.types.map((t) => assessDemand(t, data.meta.fetchedAt)).sort((a, b) => b.last12 - a.last12);
}

/** Last 12 complete months vs the prior 12, for one agency's complaint types. */
export function demandForAgency(all: DemandAssessment[], agency: string): DemandAssessment[] {
  return all.filter((d) => d.type.agency === agency);
}
