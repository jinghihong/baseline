import { describe, expect, it } from "vitest";
import { addMonths, assessDemand, contiguous, splitPartial } from "./demand";
import type { DemandType } from "../data/types";

const pattern = [100, 110, 150, 180, 170, 140, 120, 110, 105, 100, 95, 98];

function makeType(years: number, spikeLast = 1): DemandType {
  const months: [string, number][] = [];
  for (let i = 0; i < years * 12; i++) {
    const ym = addMonths("2021-01", i);
    months.push([ym, Math.round(pattern[i % 12] * (1 + i * 0.002))]);
  }
  months[months.length - 1][1] = Math.round(months[months.length - 1][1] * spikeLast);
  return { type: "Street Condition", label: "Potholes", agency: "DOT", months };
}

describe("month helpers", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2025-11", 3)).toBe("2026-02");
    expect(addMonths("2025-01", -1)).toBe("2024-12");
  });
  it("fills missing months with zero", () => {
    expect(contiguous([["2025-01", 5], ["2025-03", 7]])).toEqual([["2025-01", 5], ["2025-02", 0], ["2025-03", 7]]);
  });
  it("treats the fetch month as partial", () => {
    const r = splitPartial([["2026-10", 10], ["2026-11", 3]], "2026-11-14T00:00:00Z");
    expect(r.partial).toEqual(["2026-11", 3]);
    expect(r.complete.length).toBe(1);
  });
});

describe("assessDemand", () => {
  it("forecasts 12 months and keeps the seasonal shape", () => {
    const a = assessDemand(makeType(4), "2025-01-05T00:00:00Z");
    expect(a.points.filter((p) => p.actual === null).length).toBe(12);
    expect(a.next12).toBeGreaterThan(0);
    expect(a.next12Low).toBeLessThanOrEqual(a.next12);
    expect(a.anomaly).toBe("within");
    expect(Math.abs(a.yoy)).toBeLessThan(0.1);
  });

  it("flags a month far above its expected range", () => {
    const a = assessDemand(makeType(4, 3), "2025-01-05T00:00:00Z");
    expect(a.anomaly).toBe("above");
    expect(a.peak?.ratio).toBeGreaterThan(2);
  });
});
