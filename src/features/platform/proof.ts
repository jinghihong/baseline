// Live proof points for the landing page and reports, computed from the real snapshots.
import { AIMS_FACTS } from "../../data/curated";
import type { CapitalData, OvertimeData, ReferenceData } from "../../data/types";
import { forecastCost } from "../../engines/costForecast";
import { assessAllProjects, summarizeCapital } from "../../engines/core";
import { uniqueByFms } from "../../engines/analyst";

export interface CapitalProof {
  projects: number;
  grownShare: number;
  growth: number;
  firstTotal: number;
  currentTotal: number;
  slippedShare: number;
  withSchedule: number;
  firstPeriod: string;
  latestPeriod: string;
}

export function capitalProof(capital: CapitalData): CapitalProof {
  const all = assessAllProjects(capital);
  const unique = summarizeCapital(uniqueByFms(all));
  // Schedules are tracked per project row, so slip uses every row.
  const sched = summarizeCapital(all);
  return {
    projects: unique.projects,
    grownShare: unique.projects ? unique.grownCount / unique.projects : 0,
    growth: unique.totalGrowth,
    firstTotal: unique.totalFirstBudget,
    currentTotal: unique.totalBudget,
    slippedShare: sched.withScheduleCount ? sched.slippedCount / sched.withScheduleCount : 0,
    withSchedule: sched.withScheduleCount,
    firstPeriod: capital.meta.firstPeriod,
    latestPeriod: capital.meta.latestPeriod,
  };
}

export interface OvertimeProof {
  fy: number;
  agencies: number;
  adopted: number;
  actual: number;
  ratio: number;
}

/** Latest fiscal year with actual overtime, summed over agencies that have both an adopted budget and actuals. */
export function overtimeProof(overtime: OvertimeData): OvertimeProof {
  const fy = Math.max(...overtime.agencies.flatMap((a) => a.years.filter((y) => (y.actual ?? 0) > 0).map((y) => y.fy)));
  let adopted = 0;
  let actual = 0;
  let agencies = 0;
  for (const a of overtime.agencies) {
    const y = a.years.find((x) => x.fy === fy);
    if (y && (y.adopted ?? 0) > 0 && (y.actual ?? 0) > 0) {
      adopted += y.adopted as number;
      actual += y.actual as number;
      agencies++;
    }
  }
  return { fy, agencies, adopted, actual, ratio: adopted ? actual / adopted : 0 };
}

export interface ReferenceCheck {
  estimate: number;
  actual: number;
  comparables: number;
  effective: number;
  p50: number;
  p80: number;
  p90: number;
}

/**
 * Price the Riverside Park bridge with the same engine and inputs as the Cost forecaster's preset,
 * so the landing page and the tool always show the same numbers.
 */
export function riversideCheck(reference: ReferenceData): ReferenceCheck {
  const estimate = AIMS_FACTS.riverside.aimsEstimate;
  const r = forecastCost(reference.projects, { assetClass: "bridges", agency: "DOT", boro: "Manhattan", estimate });
  return {
    estimate,
    actual: AIMS_FACTS.riverside.bid,
    comparables: r?.poolSize ?? 0,
    effective: r?.nEff ?? 0,
    p50: r?.dollars.p50 ?? estimate,
    p80: r?.dollars.p80 ?? estimate,
    p90: r?.dollars.p90 ?? estimate,
  };
}
