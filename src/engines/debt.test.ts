import { describe, expect, it } from "vitest";
import { firstBreach, headroom, lifetimeInterest, projectDebt, type DebtInput } from "./debt";

const base: DebtInput = {
  startFy: 2027,
  commitments: Array(10).fill(10e9),
  rate: 0.04,
  term: 30,
  existingDebtService: 5e9,
  existingRunoff: 0,
  taxRevenue: 90e9,
  taxGrowth: 0,
  threshold: 0.15,
  overrun: 0,
};

describe("projectDebt", () => {
  it("starts new debt service the year after commitments", () => {
    const y = projectDebt(base);
    expect(y).toHaveLength(10);
    expect(y[0].newDebtService).toBe(0);
    expect(y[1].newDebtService).toBeCloseTo(578.301e6, -4);
    expect(y[2].newDebtService).toBeCloseTo(2 * y[1].newDebtService);
    expect(y[0].total).toBe(5e9);
  });

  it("cost overruns raise the borrowing and the debt service", () => {
    const a = projectDebt(base);
    const b = projectDebt({ ...base, overrun: 0.3 });
    expect(b[9].newDebtService).toBeCloseTo(a[9].newDebtService * 1.3);
    expect(b[0].commitments).toBeCloseTo(13e9);
  });

  it("finds the first year above the benchmark", () => {
    const y = projectDebt({ ...base, commitments: Array(10).fill(40e9) });
    const breach = firstBreach(y);
    expect(breach).not.toBeNull();
    expect(y.find((r) => r.fy === breach)!.share).toBeGreaterThan(0.15);
    expect(firstBreach(projectDebt(base))).toBeNull();
  });

  it("runoff shrinks existing debt service", () => {
    const y = projectDebt({ ...base, existingRunoff: 0.1 });
    expect(y[1].existingDebtService).toBeCloseTo(4.5e9);
  });

  it("headroom and lifetime interest", () => {
    const y = projectDebt(base);
    expect(headroom(y[0], 0.15)).toBeCloseTo(90e9 * 0.15 - 5e9);
    expect(lifetimeInterest(1e6, 0.04, 30)).toBeCloseTo(57830.1 * 30 - 1e6, -1);
  });
});
