// Reference-class cost forecasting: price a new capital project from what happened to similar past projects.
//
// Method (see /methodology):
// 1. Pool: past projects of the same asset class. If they are too few (effective sample < 30), widen to all
//    classes and give same-class projects double weight.
// 2. Drop projects whose original budget was under $250K (tiny budgets produce meaningless ratios).
// 3. Outcome per project = latest planned total / original budget, clipped to [0.5, 10] so a handful of
//    re-scoped projects can't swamp the distribution.
// 4. Weight each project by how close its original budget is to the new estimate (Gaussian kernel on the
//    log of size, bandwidth 1.0), x1.5 if the same agency manages it, x1.2 if it is in the same borough.
// 5. Weighted percentiles of the outcome, times the estimate, give the P10/P50/P80/P90 cost.
import type { ReferenceData, ReferenceProject } from "../data/types";
import { effectiveSampleSize, histogram, sum, weightedQuantile, type Bin } from "../lib/stats";
import type { ImportedProject } from "../state/store";

export const MIN_ORIGINAL_BUDGET = 250_000;
export const RATIO_FLOOR = 0.5;
export const RATIO_CAP = 10;
export const BANDWIDTH = 1.0;
export const MIN_EFFECTIVE_N = 30;

export interface ForecastInput {
  assetClass: string;
  agency?: string | null;
  boro?: string | null;
  /** The new project's current cost estimate in dollars. */
  estimate: number;
}

export interface Comparable {
  project: ReferenceProject;
  weight: number;
  /** Clipped outcome ratio (latest planned total / original budget). */
  ratio: number;
  imported: boolean;
}

export type Confidence = "low" | "medium" | "high";

export interface Percentiles {
  p10: number;
  p50: number;
  p80: number;
  p90: number;
}

export interface ForecastResult {
  input: ForecastInput;
  /** "class" = same asset class only; "all" = widened to every class because the class was too thin. */
  pool: "class" | "all";
  fellBack: boolean;
  classCount: number;
  poolSize: number;
  nEff: number;
  confidence: Confidence;
  ratios: Percentiles;
  dollars: Percentiles;
  /** Contingency needed on top of the estimate to reach P80. */
  contingencyP80: number;
  /** Weighted share of comparables whose budget grew at all / by 20% or more. */
  shareOver: number;
  shareOver20: number;
  slip: { p50: number; p80: number; shareLate: number; n: number } | null;
  reasons: { label: string; share: number }[];
  /** Top comparables by weight. */
  comparables: Comparable[];
  /** Every weighted comparable (used for percentile lookups). */
  all: Comparable[];
  /** Histogram of ratios for comparables of broadly similar size (kernel weight >= 0.1). */
  bins: Bin[];
  binRange: [number, number];
}

const BORO_ALIASES: Record<string, string> = { richmond: "Staten Island", "staten island": "Staten Island" };

export function normalizeBoro(b: string | null | undefined): string {
  const s = String(b ?? "").trim();
  return BORO_ALIASES[s.toLowerCase()] ?? s;
}

export const clipRatio = (r: number) => Math.min(RATIO_CAP, Math.max(RATIO_FLOOR, r));

/** Turn the user's own imported projects into reference projects so they join the pool. */
export function importedToReference(items: ImportedProject[]): ReferenceProject[] {
  return items
    .filter((p) => p.originalBudget > 0 && p.currentBudget > 0)
    .map((p) => ({
      id: `imported-${p.id}`,
      name: p.name,
      agency: p.agency,
      category: "Imported",
      cls: p.assetClass,
      boro: p.boro,
      orig: p.originalBudget,
      current: p.currentBudget,
      spent: 0,
      delay: null,
      origEnd: p.originalEnd,
      end: p.currentEnd,
      slipDays: p.originalEnd && p.currentEnd ? Math.round((new Date(p.currentEnd).getTime() - new Date(p.originalEnd).getTime()) / 86_400_000) : null,
    }));
}

function kernel(orig: number, estimate: number): number {
  const d = Math.abs(Math.log(orig) - Math.log(estimate));
  return Math.exp(-0.5 * (d / BANDWIDTH) ** 2);
}

function weigh(projects: ReferenceProject[], input: ForecastInput, importedIds: Set<string>, classBoost: number): Comparable[] {
  const boro = normalizeBoro(input.boro);
  return projects
    .filter((p) => p.orig >= MIN_ORIGINAL_BUDGET && p.current > 0)
    .map((p) => {
      let w = kernel(p.orig, input.estimate);
      if (input.agency && p.agency === input.agency) w *= 1.5;
      if (boro && normalizeBoro(p.boro) === boro) w *= 1.2;
      if (classBoost !== 1 && p.cls === input.assetClass) w *= classBoost;
      return { project: p, weight: w, ratio: clipRatio(p.current / p.orig), imported: importedIds.has(p.id) };
    })
    .filter((c) => c.weight > 1e-6);
}

export function confidenceFor(nEff: number): Confidence {
  if (nEff < 20) return "low";
  if (nEff < 60) return "medium";
  return "high";
}

function weightedShare(items: Comparable[], test: (c: Comparable) => boolean): number {
  const total = sum(items.map((c) => c.weight));
  if (!total) return 0;
  return sum(items.filter(test).map((c) => c.weight)) / total;
}

export function forecastCost(reference: ReferenceProject[], input: ForecastInput, imported: ReferenceProject[] = []): ForecastResult | null {
  if (!Number.isFinite(input.estimate) || input.estimate <= 0) return null;
  const importedIds = new Set(imported.map((p) => p.id));
  const everything = [...reference, ...imported];
  const sameClass = everything.filter((p) => p.cls === input.assetClass);
  let pool: "class" | "all" = "class";
  let comps = weigh(sameClass, input, importedIds, 1);
  let nEff = effectiveSampleSize(comps.map((c) => c.weight));
  if (nEff < MIN_EFFECTIVE_N) {
    pool = "all";
    comps = weigh(everything, input, importedIds, 2);
    nEff = effectiveSampleSize(comps.map((c) => c.weight));
  }
  if (!comps.length) return null;
  const ratios = comps.map((c) => c.ratio);
  const weights = comps.map((c) => c.weight);
  const q = (p: number) => weightedQuantile(ratios, weights, p);
  const r: Percentiles = { p10: q(0.1), p50: q(0.5), p80: q(0.8), p90: q(0.9) };
  const dollars: Percentiles = { p10: r.p10 * input.estimate, p50: r.p50 * input.estimate, p80: r.p80 * input.estimate, p90: r.p90 * input.estimate };

  const withSlip = comps.filter((c) => c.project.slipDays !== null && Number.isFinite(c.project.slipDays));
  const slip = withSlip.length
    ? {
        p50: Math.max(0, weightedQuantile(withSlip.map((c) => Math.max(0, c.project.slipDays as number)), withSlip.map((c) => c.weight), 0.5)),
        p80: Math.max(0, weightedQuantile(withSlip.map((c) => Math.max(0, c.project.slipDays as number)), withSlip.map((c) => c.weight), 0.8)),
        shareLate: weightedShare(withSlip, (c) => (c.project.slipDays as number) > 30),
        n: withSlip.length,
      }
    : null;

  const withReason = comps.filter((c) => c.project.delay);
  const reasonTotal = sum(withReason.map((c) => c.weight));
  const reasonMap = new Map<string, number>();
  for (const c of withReason) reasonMap.set(c.project.delay as string, (reasonMap.get(c.project.delay as string) ?? 0) + c.weight);
  const reasons = [...reasonMap.entries()]
    .map(([label, w]) => ({ label, share: reasonTotal ? w / reasonTotal : 0 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);

  const similar = comps.filter((c) => kernel(c.project.orig, input.estimate) >= 0.1);
  const binRange: [number, number] = [RATIO_FLOOR, 4];
  const bins = histogram(
    similar.map((c) => Math.min(c.ratio, binRange[1] - 1e-9)),
    { bins: 28, min: binRange[0], max: binRange[1] },
  );

  return {
    input,
    pool,
    fellBack: pool === "all",
    classCount: sameClass.length,
    poolSize: comps.length,
    nEff,
    confidence: confidenceFor(nEff),
    ratios: r,
    dollars,
    contingencyP80: r.p80 - 1,
    shareOver: weightedShare(comps, (c) => c.ratio > 1.001),
    shareOver20: weightedShare(comps, (c) => c.ratio >= 1.2),
    slip,
    reasons,
    comparables: [...comps].sort((a, b) => b.weight - a.weight).slice(0, 12),
    all: comps,
    bins,
    binRange,
  };
}

/** Weighted share of comparables whose outcome ratio was at or below `ratio` (0-1). */
export function ratioPercentile(result: ForecastResult, ratio: number): number {
  return weightedShare(result.all, (c) => c.ratio <= ratio + 1e-9);
}

/** Convenience: run the forecaster against the loaded reference dataset. */
export function forecastFromData(data: ReferenceData, input: ForecastInput, imported: ImportedProject[] = []): ForecastResult | null {
  return forecastCost(data.projects, input, importedToReference(imported));
}

export const CONFIDENCE_COPY: Record<Confidence, string> = {
  low: "Few similar past projects. Treat the range as a rough guide.",
  medium: "A reasonable number of similar past projects.",
  high: "Many similar past projects. The range is well grounded.",
};
