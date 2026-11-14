// Debt affordability: what today's capital commitments cost in future debt service.
// Each year's commitments are financed with level-payment bonds; payments start the following year.
import { annuityPayment } from "../lib/stats";

export interface DebtInput {
  /** First fiscal year of the projection. */
  startFy: number;
  /** Capital commitments to be financed in each year, starting at startFy. */
  commitments: number[];
  /** Interest rate on new bonds (0.045 = 4.5%). */
  rate: number;
  /** Bond term in years. */
  term: number;
  /** Debt service on debt already issued, in the first year. */
  existingDebtService: number;
  /** Share of existing debt service that rolls off each year (0 = stays flat). */
  existingRunoff: number;
  /** Tax revenue in the first year. */
  taxRevenue: number;
  taxGrowth: number;
  /** Affordability benchmark: debt service as a share of tax revenue. */
  threshold: number;
  /** Extra cost applied to every commitment, e.g. 0.33 if projects run 33% over. */
  overrun: number;
}

export interface DebtYear {
  fy: number;
  commitments: number;
  newDebtService: number;
  existingDebtService: number;
  total: number;
  taxRevenue: number;
  share: number;
  overThreshold: boolean;
}

export function projectDebt(input: DebtInput): DebtYear[] {
  const n = input.commitments.length;
  const financed = input.commitments.map((c) => Math.max(0, c) * (1 + Math.max(0, input.overrun)));
  const payments = financed.map((c) => annuityPayment(c, input.rate, input.term));
  const out: DebtYear[] = [];
  for (let t = 0; t < n; t++) {
    let newDs = 0;
    for (let s = 0; s < t; s++) {
      if (t - s <= input.term) newDs += payments[s];
    }
    const existing = input.existingDebtService * (1 - input.existingRunoff) ** t;
    const total = newDs + existing;
    const taxRevenue = input.taxRevenue * (1 + input.taxGrowth) ** t;
    const share = taxRevenue > 0 ? total / taxRevenue : 0;
    out.push({
      fy: input.startFy + t,
      commitments: financed[t],
      newDebtService: newDs,
      existingDebtService: existing,
      total,
      taxRevenue,
      share,
      overThreshold: share > input.threshold,
    });
  }
  return out;
}

/** First fiscal year where debt service crosses the benchmark, or null. */
export function firstBreach(years: DebtYear[]): number | null {
  return years.find((y) => y.overThreshold)?.fy ?? null;
}

/** Headroom: how much more annual debt service fits under the benchmark in a given year. */
export function headroom(year: DebtYear, threshold: number): number {
  return year.taxRevenue * threshold - year.total;
}

/** Lifetime interest on one year's commitments. */
export function lifetimeInterest(principal: number, rate: number, term: number): number {
  return annuityPayment(principal, rate, term) * term - principal;
}
