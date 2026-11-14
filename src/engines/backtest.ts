// Out-of-sample backtest of the cost forecaster. For each finished project the forecaster never saw, price it from
// the April 2019 reference class using its original budget, then check where its final cost landed.
// A well-calibrated forecaster has ~50% of final costs at or below P50, ~80% at or below P80, ~90% at or below P90.
import type { BacktestData, BacktestProject, ReferenceProject } from "../data/types";
import { median } from "../lib/stats";
import { MIN_ORIGINAL_BUDGET, forecastCost } from "./costForecast";

export interface BacktestCase {
  project: BacktestProject;
  finalRatio: number;
  p50: number;
  p80: number;
  p90: number;
  /** Where the final cost fell: "p50" = at or below P50, "p80" = between P50 and P80, and so on. */
  band: "p50" | "p80" | "p90" | "above";
}

export interface CoverageRow {
  label: string;
  target: number;
  actual: number;
}

export interface BacktestResult {
  n: number;
  trainingSize: number;
  trainingPub: string;
  coverage: CoverageRow[];
  /** Share of finished projects whose final cost stayed at or below the original budget: the city's own estimate. */
  originalHeld: number;
  /** Share at or below Baseline's P80: the budget Baseline recommends. */
  p80Held: number;
  /** Median contingency Baseline's P80 adds on top of the original budget. */
  medianContingency: number;
  /** Median final cost / original budget among finished projects. */
  medianFinalRatio: number;
  byClass: { cls: string; n: number; p80Held: number; originalHeld: number }[];
  /** The finished projects that most exceeded Baseline's P90. */
  worstMisses: BacktestCase[];
  cases: BacktestCase[];
}

const toReference = (p: BacktestProject): ReferenceProject => ({
  id: p.id,
  name: p.name,
  agency: p.agency,
  category: p.cls,
  cls: p.cls,
  boro: p.boro,
  orig: p.orig,
  current: p.current,
  spent: 0,
  delay: null,
  origEnd: null,
  end: null,
  slipDays: null,
});

export function runBacktest(data: BacktestData): BacktestResult {
  const train = data.train.map(toReference);
  const cases: BacktestCase[] = [];
  for (const p of data.test) {
    if (p.orig < MIN_ORIGINAL_BUDGET || p.current <= 0) continue;
    const r = forecastCost(train, { assetClass: p.cls, agency: p.agency, boro: p.boro, estimate: p.orig });
    if (!r) continue;
    const finalRatio = p.current / p.orig;
    const { p50, p80, p90 } = r.ratios;
    const band = finalRatio <= p50 + 1e-9 ? "p50" : finalRatio <= p80 + 1e-9 ? "p80" : finalRatio <= p90 + 1e-9 ? "p90" : "above";
    cases.push({ project: p, finalRatio, p50, p80, p90, band });
  }
  const n = cases.length;
  const share = (f: (c: BacktestCase) => boolean, list = cases) => (list.length ? list.filter(f).length / list.length : 0);
  const atOrBelow = (q: "p50" | "p80" | "p90") => (c: BacktestCase) => c.finalRatio <= c[q] + 1e-9;

  const classes = [...new Set(cases.map((c) => c.project.cls))];
  const byClass = classes
    .map((cls) => {
      const list = cases.filter((c) => c.project.cls === cls);
      return { cls, n: list.length, p80Held: share(atOrBelow("p80"), list), originalHeld: share((c) => c.finalRatio <= 1 + 1e-9, list) };
    })
    .filter((r) => r.n >= 10)
    .sort((a, b) => b.n - a.n);

  return {
    n,
    trainingSize: train.length,
    trainingPub: data.meta.trainingPub,
    coverage: [
      { label: "P50", target: 0.5, actual: share(atOrBelow("p50")) },
      { label: "P80", target: 0.8, actual: share(atOrBelow("p80")) },
      { label: "P90", target: 0.9, actual: share(atOrBelow("p90")) },
    ],
    originalHeld: share((c) => c.finalRatio <= 1 + 1e-9),
    p80Held: share(atOrBelow("p80")),
    medianContingency: n ? median(cases.map((c) => c.p80 - 1)) : 0,
    medianFinalRatio: n ? median(cases.map((c) => c.finalRatio)) : 1,
    byClass,
    worstMisses: [...cases].filter((c) => c.band === "above").sort((a, b) => b.finalRatio / b.p90 - a.finalRatio / a.p90).slice(0, 8),
    cases,
  };
}
