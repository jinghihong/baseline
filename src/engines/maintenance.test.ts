import { describe, expect, it } from "vitest";
import { assessAsset, generateSampleAssets, parseAssetRows, planYear, probabilityOfFailure, simulate, type Asset } from "./maintenance";

describe("sample register", () => {
  it("is deterministic and clearly marked as sample", () => {
    const a = generateSampleAssets(50, 7);
    const b = generateSampleAssets(50, 7);
    expect(a).toEqual(b);
    expect(a).toHaveLength(50);
    expect(a.every((x) => x.sample && x.id.startsWith("SAMPLE-"))).toBe(true);
    expect(a.every((x) => x.condition >= 1 && x.condition <= 5)).toBe(true);
  });
});

describe("risk scoring", () => {
  const asset: Asset = {
    id: "A",
    name: "Test",
    type: "Bridge",
    cls: "bridges",
    boro: "Queens",
    builtYear: 1950,
    usefulLife: 75,
    condition: 5,
    replacementValue: 100e6,
    criticality: 5,
    lastInspected: "2018-01-01",
    sample: false,
  };
  it("worse condition and older assets fail more often", () => {
    expect(probabilityOfFailure(5, 1)).toBeGreaterThan(probabilityOfFailure(2, 0.2));
    expect(probabilityOfFailure(3, 1.3)).toBeGreaterThan(probabilityOfFailure(3, 0.5));
  });
  it("assesses risk, repair cost and overdue inspections", () => {
    const a = assessAsset(asset, 2026);
    expect(a.inBacklog).toBe(true);
    expect(a.inspectionOverdue).toBe(true);
    expect(a.repairCost).toBeCloseTo(40e6);
    expect(a.risk).toBeCloseTo(a.pof * 100e6);
    expect(a.priority).toBeGreaterThan(0);
  });
  it("uses a measured repair cost when one is supplied", () => {
    expect(assessAsset({ ...asset, repairCost: 5e6 }).repairCost).toBe(5e6);
  });
});

describe("planning and simulation", () => {
  const assets = generateSampleAssets(200, 11);
  it("never spends more than the budget", () => {
    const plan = planYear(assets, 50e6);
    expect(plan.spent).toBeLessThanOrEqual(50e6);
    expect(plan.funded.length).toBeGreaterThan(0);
    expect(plan.funded.length + plan.unfunded.length).toBe(assets.filter((a) => a.condition >= 3).length);
  });
  it("funding everything shrinks the backlog and risk compared with doing nothing", () => {
    const none = simulate(assets, 0, 5);
    const all = simulate(assets, Infinity, 5);
    expect(none).toHaveLength(5);
    expect(none[4].backlog).toBeGreaterThan(none[0].backlog);
    expect(all[4].backlog).toBeLessThan(none[4].backlog);
    expect(all[0].risk).toBeLessThan(none[0].risk);
    expect(none.every((y) => y.spent === 0)).toBe(true);
  });
});

describe("CSV import", () => {
  it("accepts valid rows and explains invalid ones", () => {
    const r = parseAssetRows([
      { id: "B1", name: "Bridge", type: "Bridge", asset_class: "bridges", borough: "Bronx", year_built: "1960", useful_life: "75", condition: "4", replacement_value: "$50,000,000", criticality: "5", last_inspected: "2022-01-01", repair_cost: "" },
      { id: "", name: "", year_built: "x", useful_life: "0", condition: "9", replacement_value: "-1", criticality: "0" },
      { id: "", name: "" },
    ]);
    expect(r.assets).toHaveLength(1);
    expect(r.assets[0].replacementValue).toBe(50e6);
    expect(r.assets[0].repairCost).toBeNull();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Row 3/);
    expect(r.errors[0]).toMatch(/condition must be 1/);
  });
});
