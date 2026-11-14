import { describe, expect, it } from "vitest";
import { citywideOvertime, councilQuestions, isPayrollLine, lineAgency, lineReading, titleCaseName, totalOvertimeShortfall } from "./budgetRisk";
import { assessLine, assessOvertime } from "./core";
import type { BudgetLine, OvertimeData } from "../data/types";

const line = (agency: string, agencyCode: string | null, objectClass: string, ratios: number[]): BudgetLine => ({
  agency,
  agencyCode,
  objectClass,
  years: [...ratios.map((r, i) => ({ fy: 2019 + i, adopted: 100e6, modified: 100e6 * r })), { fy: 2019 + ratios.length, adopted: 110e6, modified: null }],
});

describe("names", () => {
  it("title-cases raw agency names", () => {
    expect(titleCaseName("OFFICE OF ADMIN TRIALS & HEARINGS")).toBe("Office of Administrative Trials & Hearings");
    expect(titleCaseName("DEPARTMENT OF ENVIRONMENTAL PROTECT.")).toBe("Department of Environmental Protection");
  });
  it("uses the registry name when the agency code is known", () => {
    const a = assessLine(line("POLICE DEPARTMENT", "NYPD", "FULL TIME SALARIED", [1, 1, 1]));
    expect(lineAgency(a)).toBe("Police Department");
    expect(isPayrollLine(a)).toBe(true);
  });
  it("falls back to the raw name for unknown agencies", () => {
    const a = assessLine(line("CITY COUNCIL", null, "CONTRACTUAL SERVICES", [1, 1, 1]));
    expect(lineAgency(a)).toBe("City Council");
    expect(isPayrollLine(a)).toBe(false);
  });
});

describe("lineReading", () => {
  it("explains a chronic line with an estimate", () => {
    const a = assessLine(line("FIRE DEPARTMENT", "FDNY", "ADDITIONAL GROSS PAY", [1.4, 1.5, 1.3, 1.45, 1.6]));
    const text = lineReading(a);
    expect(text).toMatch(/5 of the last 5 years/);
    expect(text).toMatch(/estimate/);
  });
  it("explains a steady line", () => {
    const a = assessLine(line("FIRE DEPARTMENT", "FDNY", "SUPPLIES AND MATERIALS", [1, 1.01, 0.99, 1]));
    expect(lineReading(a)).toMatch(/close to its adopted amount/);
  });
});

describe("citywide overtime", () => {
  const data: OvertimeData = {
    meta: { fetchedAt: "", sources: [], unmatchedActualOvertime: 0 },
    agencies: [
      { code: "NYPD", name: "Police Department", years: [2022, 2023, 2024, 2025, 2026].map((fy, i) => ({ fy, adopted: 500, modified: 900, actual: 800 + i * 50, hours: 10, regular: 0 })).concat([{ fy: 2027, adopted: 560, modified: null, actual: null, hours: null, regular: null }] as never[]) },
      { code: "FDNY", name: "Fire Department", years: [2022, 2023, 2024, 2025, 2026].map((fy) => ({ fy, adopted: 300, modified: 500, actual: 520, hours: 5, regular: 0 })).concat([{ fy: 2027, adopted: 320, modified: null, actual: null, hours: null, regular: null }] as never[]) },
    ],
  };
  it("sums agencies by year and forecasts the next one", () => {
    const c = citywideOvertime(data);
    expect(c.rows.find((r) => r.fy === 2026)?.actual).toBe(1520);
    expect(c.latestActualFy).toBe(2026);
    expect(c.nextFy).toBe(2027);
    expect(c.nextAdopted).toBe(880);
    expect(c.forecast).toBeGreaterThan(1520);
    expect(c.low).toBeLessThanOrEqual(c.forecast);
  });
  it("totals positive shortfalls and drafts questions", () => {
    const items = data.agencies.map(assessOvertime);
    expect(totalOvertimeShortfall(items)).toBeGreaterThan(0);
    const qs = councilQuestions([assessLine(line("FIRE DEPARTMENT", "FDNY", "ADDITIONAL GROSS PAY", [1.4, 1.5, 1.3, 1.45, 1.6]))], items);
    expect(qs.length).toBeGreaterThanOrEqual(2);
    expect(qs[0]).toMatch(/overtime/);
  });
});
