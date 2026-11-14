import { describe, expect, it } from "vitest";
import type { ReferenceProject } from "../data/types";
import { clipRatio, confidenceFor, forecastCost, importedToReference, normalizeBoro, ratioPercentile } from "./costForecast";

let seq = 0;
const project = (over: Partial<ReferenceProject>): ReferenceProject => ({
  id: `p${seq++}`,
  name: "Test project",
  agency: "DOT",
  category: "Bridges",
  cls: "bridges",
  boro: "Queens",
  orig: 10e6,
  current: 12e6,
  spent: 0,
  delay: null,
  origEnd: "2024-01-01",
  end: "2025-01-01",
  slipDays: 366,
  ...over,
});

// 100 bridge projects: ratios spread evenly from 1.0 to 1.99.
const bridges = Array.from({ length: 100 }, (_, i) => project({ orig: 10e6, current: 10e6 * (1 + i / 100), delay: i % 2 ? "Changes in Scope/Design" : "Budgetary Constraints" }));
// 20 parks projects that all came in at 3x.
const parks = Array.from({ length: 20 }, () => project({ cls: "parks", agency: "DPR", orig: 5e6, current: 15e6, slipDays: 0 }));

describe("forecastCost", () => {
  it("returns percentiles from the same asset class", () => {
    const r = forecastCost([...bridges, ...parks], { assetClass: "bridges", estimate: 10e6 })!;
    expect(r.pool).toBe("class");
    expect(r.fellBack).toBe(false);
    expect(r.ratios.p50).toBeGreaterThan(1.45);
    expect(r.ratios.p50).toBeLessThan(1.55);
    expect(r.ratios.p80).toBeGreaterThan(r.ratios.p50);
    expect(r.ratios.p90).toBeGreaterThan(r.ratios.p80);
    expect(r.dollars.p50).toBeCloseTo(r.ratios.p50 * 10e6);
    expect(r.contingencyP80).toBeCloseTo(r.ratios.p80 - 1);
    expect(r.confidence).toBe("high");
    expect(r.comparables).toHaveLength(12);
    expect(r.reasons.map((x) => x.label)).toContain("Changes in Scope/Design");
    expect(r.slip?.p50).toBe(366);
  });

  it("widens to all classes when the class is too thin and says so", () => {
    const r = forecastCost([...bridges, ...parks.slice(0, 5)], { assetClass: "parks", estimate: 5e6 })!;
    expect(r.fellBack).toBe(true);
    expect(r.pool).toBe("all");
    expect(r.classCount).toBe(5);
  });

  it("drops tiny original budgets and clips extreme ratios", () => {
    const r = forecastCost([project({ orig: 100_000, current: 5e6 }), ...bridges], { assetClass: "bridges", estimate: 10e6 })!;
    expect(r.poolSize).toBe(100);
    expect(clipRatio(40)).toBe(10);
    expect(clipRatio(0.1)).toBe(0.5);
  });

  it("weights projects of similar size more heavily", () => {
    const small = Array.from({ length: 60 }, () => project({ orig: 1e6, current: 1e6 }));
    const big = Array.from({ length: 60 }, () => project({ orig: 500e6, current: 1000e6 }));
    const r = forecastCost([...small, ...big], { assetClass: "bridges", estimate: 400e6 })!;
    expect(r.ratios.p50).toBeGreaterThan(1.8);
  });

  it("rejects a non-positive estimate", () => {
    expect(forecastCost(bridges, { assetClass: "bridges", estimate: 0 })).toBeNull();
  });

  it("ratioPercentile reports where an outcome sits in the distribution", () => {
    const r = forecastCost(bridges, { assetClass: "bridges", estimate: 10e6 })!;
    expect(ratioPercentile(r, 1.0)).toBeLessThan(0.05);
    expect(ratioPercentile(r, 2.0)).toBeCloseTo(1);
  });
});

describe("helpers", () => {
  it("normalizes borough spellings", () => {
    expect(normalizeBoro("Richmond")).toBe("Staten Island");
    expect(normalizeBoro("Queens")).toBe("Queens");
  });
  it("labels confidence by effective sample size", () => {
    expect(confidenceFor(10)).toBe("low");
    expect(confidenceFor(40)).toBe("medium");
    expect(confidenceFor(200)).toBe("high");
  });
  it("maps imported projects and computes their slip", () => {
    const [p] = importedToReference([
      { id: "a", name: "My bridge", assetClass: "bridges", agency: "DOT", boro: "Bronx", originalBudget: 1e6, currentBudget: 2e6, originalEnd: "2024-01-01", currentEnd: "2024-12-31" },
    ]);
    expect(p.cls).toBe("bridges");
    expect(p.slipDays).toBe(365);
  });
});

describe("real NYC reference data", () => {
  it("prices the Riverside Park bridge case from the city's own track record", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const file = "public/data/reference-projects.json";
    if (!existsSync(file)) return;
    const data = JSON.parse(readFileSync(file, "utf8"));
    const r = forecastCost(data.projects, { assetClass: "bridges", agency: "DOT", boro: "Manhattan", estimate: 76e6 })!;
    expect(r).not.toBeNull();
    expect(r.nEff).toBeGreaterThan(10);
    expect(r.ratios.p90).toBeGreaterThanOrEqual(r.ratios.p50);
    // On the Oct 2023 snapshot the bid ($149.9M, ratio 1.97) lands between P80 and P90.
    expect(r.ratios.p80).toBeLessThan(149.9e6 / 76e6 + 0.5);
  });
});
