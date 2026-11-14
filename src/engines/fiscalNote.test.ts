import { describe, expect, it } from "vitest";
import { blankInput, computeFiscal, methodText, remainingShare, TEMPLATES } from "./fiscalNote";

describe("remainingShare", () => {
  it("is the full year on July 1 and about half on January 1", () => {
    expect(remainingShare("2026-07-01")).toBeCloseTo(1, 2);
    expect(remainingShare("2027-01-01")).toBeGreaterThan(0.45);
    expect(remainingShare("2027-01-01")).toBeLessThan(0.52);
  });
});

describe("computeFiscal", () => {
  const input = {
    ...blankInput(),
    effectiveDate: "2026-07-01",
    staff: [{ id: "a", title: "Inspector", fte: 10, salary: 100_000 }],
    fringeRate: 0.5,
    firstYearHiring: 0.5,
    annualOtps: 100_000,
    oneTime: 200_000,
    annualRevenue: 0,
    salaryGrowth: 0,
    otpsGrowth: 0,
  };

  it("phases hiring, applies fringe and adds one-time costs in year one", () => {
    const r = computeFiscal(input);
    expect(r.enactmentFy).toBe(2027);
    expect(r.rows.length).toBe(5);
    // Year 1: 10 FTE x $100K x 1.5 fringe x 50% staffed = $750K, + $100K OTPS + $200K one-time
    expect(r.rows[0].expenditures).toBeCloseTo(1_050_000, -3);
    // Year 2: fully staffed $1.5M + $100K
    expect(r.rows[1].expenditures).toBeCloseTo(1_600_000, -3);
    expect(r.statement.full.fy).toBe(2028);
    expect(r.rows[1].netLow).toBeLessThan(r.rows[1].net);
    expect(r.rows[1].netHigh).toBeGreaterThan(r.rows[1].net);
  });

  it("nets out collected revenue", () => {
    const r = computeFiscal({ ...input, annualRevenue: 1_000_000, collectionRate: 0.8 });
    expect(r.rows[1].revenue).toBeCloseTo(800_000, -3);
    expect(r.rows[1].net).toBeCloseTo(800_000, -3);
  });

  it("templates produce a positive cost and a method paragraph", () => {
    for (const t of TEMPLATES) {
      const i = t.build();
      const r = computeFiscal(i);
      expect(r.fiveYearNet).toBeGreaterThan(0);
      expect(methodText(i, r).length).toBeGreaterThan(50);
    }
  });
});
