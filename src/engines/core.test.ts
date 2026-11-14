import { describe, expect, it } from "vitest";
import { assessLine, assessOvertime, assessProject, summarizeCapital } from "./core";
import type { BudgetLine, CapitalProject, OvertimeAgency } from "../data/types";

const line = (ratios: number[], objectClass = "CONTRACTUAL SERVICES"): BudgetLine => ({
  agency: "TEST AGENCY",
  agencyCode: "NYPD",
  objectClass,
  years: [...ratios.map((r, i) => ({ fy: 2018 + i, adopted: 100, modified: 100 * r })), { fy: 2018 + ratios.length, adopted: 120, modified: null }],
});

describe("assessLine", () => {
  it("flags a line that ends the year well above adoption most years", () => {
    const a = assessLine(line([1.5, 1.6, 1.4, 1.7, 1.55, 1.6]));
    expect(a.chronic).toBe(true);
    expect(a.level).toBe("critical");
    expect(a.yearsOver).toBe(6);
    expect(a.latestAdopted).toBe(120);
    expect(a.expectedIncrease).toBeCloseTo(120 * 0.575, 5);
  });

  it("does not flag a line that tracks its adopted budget", () => {
    const a = assessLine(line([1.0, 1.02, 0.98, 1.01, 1.0]));
    expect(a.chronic).toBe(false);
    expect(a.level).toBe("low");
    expect(a.expectedIncrease).toBe(0);
  });

  it("ignores technical object classes", () => {
    const a = assessLine(line([2, 2, 2, 2, 2], "OTPS HOLDING CODES"));
    expect(a.technical).toBe(true);
    expect(a.chronic).toBe(false);
  });
});

describe("assessOvertime", () => {
  const agency: OvertimeAgency = {
    code: "NYPD",
    name: "Police Department",
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((fy, i): OvertimeAgency["years"][number] => ({
      fy,
      adopted: 500e6,
      modified: 900e6,
      actual: 800e6 + i * 40e6,
      hours: null,
      regular: null,
    })).concat([{ fy: 2027, adopted: 560e6, modified: null, actual: null, hours: null, regular: null }]),
  };

  it("forecasts next year from actual spending and compares it with the adopted budget", () => {
    const a = assessOvertime(agency);
    expect(a.latestActualFy).toBe(2026);
    expect(a.nextFy).toBe(2027);
    expect(a.nextAdopted).toBe(560e6);
    expect(a.forecast).toBeGreaterThan(1.05e9);
    expect(a.forecast).toBeLessThan(1.2e9);
    expect(a.expectedShortfall).toBeGreaterThan(400e6);
    expect(a.level).toBe("critical");
    expect(a.yearsOver).toBe(6);
  });
});

describe("capital projects", () => {
  const base: CapitalProject = {
    id: "x",
    fmsId: "x",
    name: "Test",
    agency: "DOT",
    sponsor: null,
    phase: "Construction",
    boro: "Queens",
    cb: null,
    category: "Bridges",
    cls: "bridges",
    budget: 150e6,
    firstBudget: 100e6,
    firstPeriod: "202305",
    spend: 10e6,
    forecast: "2029-01-01",
    firstForecast: "2027-01-01",
    slipDays: 731,
    constructionStart: null,
    reasons: { "Changes in Scope/Design": 2 },
  };

  it("measures growth from the first published budget and never rebases", () => {
    const a = assessProject(base);
    expect(a.growth).toBe(50e6);
    expect(a.growthPct).toBeCloseTo(0.5);
    expect(a.level).toBe("critical");
    expect(a.topReason).toBe("Changes in Scope/Design");
    expect(a.flags.length).toBe(2);
  });

  it("summarizes a portfolio", () => {
    const s = summarizeCapital([assessProject(base), assessProject({ ...base, id: "y", budget: 100e6, slipDays: 0 })]);
    expect(s.projects).toBe(2);
    expect(s.totalGrowth).toBe(50e6);
    expect(s.grownCount).toBe(1);
    expect(s.slippedCount).toBe(1);
    expect(s.byLevel.critical).toBe(1);
  });
});
