import { describe, expect, it } from "vitest";
import { annuityPayment, cagr, effectiveSampleSize, histogram, holtForecast, linearRegression, quantile, seasonalForecast, weightedQuantile } from "./stats";

describe("quantiles", () => {
  it("matches numpy's default interpolation", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 0, 5], 0)).toBe(0);
    expect(quantile([10, 0, 5], 1)).toBe(10);
  });
  it("weighted quantile with equal weights stays near the plain median", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(weightedQuantile(xs, [1, 1, 1, 1, 1], 0.5)).toBeCloseTo(3);
  });
  it("weights pull the quantile toward heavy observations", () => {
    expect(weightedQuantile([1, 10], [9, 1], 0.5)).toBeLessThan(5);
  });
  it("effective sample size of equal weights is n", () => {
    expect(effectiveSampleSize([1, 1, 1, 1])).toBeCloseTo(4);
    expect(effectiveSampleSize([1, 0, 0, 0])).toBeCloseTo(1);
  });
});

describe("forecasting", () => {
  it("linear regression recovers a perfect line", () => {
    const r = linearRegression([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(1);
    expect(r.r2).toBeCloseTo(1);
  });
  it("holt forecast continues a steady trend with a band that contains the point", () => {
    const f = holtForecast([100, 110, 120, 130, 140], 2);
    expect(f.point[0]).toBeGreaterThan(140);
    expect(f.point[0]).toBeLessThan(160);
    expect(f.low[0]).toBeLessThanOrEqual(f.point[0]);
    expect(f.high[0]).toBeGreaterThanOrEqual(f.point[0]);
  });
  it("seasonal forecast reproduces a repeating pattern", () => {
    const pattern = [10, 12, 20, 30, 25, 15, 10, 8, 8, 9, 10, 11];
    const months = [...pattern, ...pattern, ...pattern];
    const f = seasonalForecast(months, 1, 12);
    expect(f.point[3]).toBeGreaterThan(f.point[0]); // April above January
    expect(f.seasonal.length).toBe(12);
  });
});

describe("misc", () => {
  it("histogram counts every finite value once", () => {
    const bins = histogram([1, 2, 3, 4, 5, NaN], { bins: 2 });
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(5);
  });
  it("cagr", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
  });
  it("annuity payment for a 30-year bond", () => {
    expect(annuityPayment(1_000_000, 0.04, 30)).toBeCloseTo(57830.1, 0);
    expect(annuityPayment(1200, 0, 12)).toBe(100);
  });
});
