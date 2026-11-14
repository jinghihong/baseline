import { describe, expect, it } from "vitest";
import { linesFromCsvRows, normalizeProfile, parseAmount, projectLine, sampleLines, statusFor, summarize, WINTER_PROFILE } from "./spendTracker";
import type { CustomBudgetLine } from "../state/store";

const line = (over: Partial<CustomBudgetLine> = {}): CustomBudgetLine => ({
  id: "l1",
  name: "Test line",
  agency: "DOT",
  adopted: 120,
  monthly: [10, 10, 10, 10],
  ...over,
});

describe("normalizeProfile", () => {
  it("falls back to an even profile for bad input", () => {
    expect(normalizeProfile(undefined)).toHaveLength(12);
    expect(normalizeProfile([1, 2])[0]).toBeCloseTo(1 / 12);
    expect(normalizeProfile(Array(12).fill(-1))[5]).toBeCloseTo(1 / 12);
  });
  it("rescales to sum to one", () => {
    const p = normalizeProfile(Array(12).fill(2));
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe("projectLine", () => {
  it("run rate and seasonal agree on a flat profile", () => {
    const p = projectLine(line());
    expect(p.runRate).toBeCloseTo(120);
    expect(p.seasonal).toBeCloseTo(120);
    expect(p.blended).toBeCloseTo(120);
    expect(p.variance).toBeCloseTo(0);
    expect(p.level).toBe("low");
  });

  it("flags a line spending ahead of its budget", () => {
    const p = projectLine(line({ monthly: [12, 13, 12, 13] }));
    expect(p.projected).toBeCloseTo(150);
    expect(p.variancePct).toBeCloseTo(0.25);
    expect(p.level).toBe("critical");
    expect(p.low).toBeLessThanOrEqual(p.projected);
    expect(p.high).toBeGreaterThanOrEqual(p.projected);
  });

  it("uses the seasonal profile so a quiet summer does not hide a winter-heavy line", () => {
    const winter = projectLine(line({ adopted: 45, monthly: [0.45, 0.45, 0.45, 0.9], profile: WINTER_PROFILE }));
    expect(winter.runRate).toBeCloseTo(6.75);
    expect(winter.seasonal).toBeCloseTo(2.25 / 0.05);
    expect(winter.blended).toBeGreaterThan(winter.runRate);
  });

  it("returns the actual total once all twelve months are in", () => {
    const p = projectLine(line({ monthly: Array(12).fill(11) }));
    expect(p.projected).toBe(132);
    expect(p.high).toBe(132);
    expect(p.path.at(-1)?.actual).toBe(132);
  });

  it("builds a cumulative path that ends at the projection", () => {
    const p = projectLine(line({ monthly: [12, 13, 12, 13] }));
    expect(p.path).toHaveLength(12);
    expect(p.path[3].actual).toBe(50);
    expect(p.path[4].actual).toBeNull();
    expect(p.path[11].projected).toBeCloseTo(p.projected);
    expect(p.path[11].budget).toBeCloseTo(120);
  });

  it("handles a line with no months reported", () => {
    const p = projectLine(line({ monthly: [] }));
    expect(p.projected).toBe(120);
    expect(p.monthsReported).toBe(0);
  });
});

describe("status and summary", () => {
  it("maps variance to levels", () => {
    expect(statusFor(0)).toBe("low");
    expect(statusFor(0.03)).toBe("watch");
    expect(statusFor(0.08)).toBe("high");
    expect(statusFor(0.2)).toBe("critical");
  });
  it("sums a portfolio", () => {
    const s = summarize([projectLine(line()), projectLine(line({ id: "l2", monthly: [12, 13, 12, 13] }))]);
    expect(s.lines).toBe(2);
    expect(s.adopted).toBe(240);
    expect(s.atRisk).toBe(1);
  });
  it("sample lines are labeled as samples", () => {
    expect(sampleLines().every((l) => l.name.startsWith("SAMPLE"))).toBe(true);
  });
});

describe("CSV import", () => {
  it("parses amounts in several formats", () => {
    expect(parseAmount("$1,200,000")).toBe(1_200_000);
    expect(parseAmount("1.5M")).toBe(1_500_000);
    expect(parseAmount("450k")).toBe(450_000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNaN();
  });
  it("reads valid rows and reports bad ones", () => {
    const { lines, errors } = linesFromCsvRows([
      { name: "Fuel", agency: "DCAS", adopted: "120M", jul: "10M", aug: "9.5M", sep: "" },
      { name: "", agency: "", adopted: "" },
      { name: "Broken", adopted: "-5" },
      { name: "Gappy", adopted: "10", jul: "1", aug: "", sep: "1" },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].monthly).toEqual([10_000_000, 9_500_000]);
    expect(errors).toHaveLength(2);
  });
});
