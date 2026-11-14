import { describe, expect, it } from "vitest";
import { answerQuestion, buildContextPack, parseQuestion, SUGGESTED_QUESTIONS, type AnalystData } from "./analyst";
import type { CapitalData, CapitalProject, DemandData, GrantsData, OvertimeData, ReferenceData } from "../data/types";

const meta = { fetchedAt: "2026-11-14T00:00:00Z", sources: [{ id: "x", title: "Test", url: "https://example.org/x", publisher: "NYC Open Data" }] };

const overtime: OvertimeData = {
  meta: { ...meta, unmatchedActualOvertime: 0 },
  agencies: [
    {
      code: "NYPD",
      name: "Police Department",
      years: [
        ...[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((fy, i) => ({ fy, adopted: 500e6, modified: 900e6, actual: 800e6 + i * 30e6, hours: null, regular: null })),
        { fy: 2027, adopted: 600e6, modified: null, actual: null, hours: null, regular: null },
      ],
    },
    {
      code: "DOT",
      name: "Department of Transportation",
      years: [
        ...[2022, 2023, 2024, 2025, 2026].map((fy) => ({ fy, adopted: 50e6, modified: 60e6, actual: 100e6, hours: null, regular: null })),
        { fy: 2027, adopted: 50e6, modified: null, actual: null, hours: null, regular: null },
      ],
    },
  ],
};

const project = (id: string, agency: string, boro: string, first: number, budget: number, slip: number | null): CapitalProject => ({
  id,
  fmsId: id,
  name: `Project ${id}`,
  agency,
  sponsor: null,
  phase: "Construction",
  boro,
  cb: null,
  category: "Bridges",
  cls: "bridges",
  budget,
  firstBudget: first,
  firstPeriod: "202305",
  spend: 0,
  forecast: slip ? "2028-01-01" : null,
  firstForecast: slip ? "2027-01-01" : null,
  slipDays: slip,
  constructionStart: null,
  reasons: (slip ? { "Changes in Scope/Design": 1 } : {}) as Record<string, number>,
});

const capital: CapitalData = {
  meta: { ...meta, latestPeriod: "202605", firstPeriod: "202305", periods: ["202305", "202605"] },
  projects: [project("a", "DOT", "Queens", 100e6, 160e6, 365), project("b", "DOT", "Bronx", 50e6, 50e6, 0), project("c", "DEP", "Queens", 10e6, 12e6, null)],
};

const reference: ReferenceData = {
  meta: { ...meta, snapshot: "Oct 2023", classes: [{ id: "bridges", label: "Bridges" }] },
  projects: Array.from({ length: 40 }, (_, i) => ({
    id: `r${i}`,
    name: `Ref ${i}`,
    agency: "DOT",
    category: "Bridges",
    cls: "bridges",
    boro: "Queens",
    orig: 10e6,
    current: 10e6 * (0.9 + i * 0.03),
    spent: 0,
    delay: null,
    origEnd: null,
    end: null,
    slipDays: i % 2 ? 200 : 0,
  })),
};

const months = (n: number, base: number): [string, number][] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2023, i, 1));
    return [`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, base + i * 10];
  });

const demand: DemandData = {
  meta,
  types: [{ type: "Street Condition", label: "Potholes & street condition", agency: "DOT", months: months(36, 1000) }],
  districts: {},
};

const grants: GrantsData = {
  meta: { ...meta, themes: [{ id: "water", label: "Water & sewer", classes: ["water"] }] },
  opportunities: [
    { id: "1", number: "EPA-1", title: "Clean Water Grants", agency: "EPA", agencyCode: "EPA", status: "posted", openDate: null, closeDate: "2099-01-01", aln: [], themes: ["water"], url: "https://www.grants.gov/search-results-detail/1" },
    { id: "2", number: "OLD-1", title: "Expired", agency: "DOT", agencyCode: "DOT", status: "posted", openDate: null, closeDate: "2001-01-01", aln: [], themes: ["water"], url: "https://www.grants.gov/search-results-detail/2" },
  ],
};

const data: AnalystData = { overtime, capital, reference, demand, grants, budgetLines: null };

describe("parseQuestion", () => {
  it("reads intent and agency", () => {
    const p = parseQuestion("How much will NYPD overtime run over budget next year?");
    expect(p.intent).toBe("overtime");
    expect(p.agency).toBe("NYPD");
  });
  it("tells delays from overruns", () => {
    expect(parseQuestion("Which DOT projects slipped the most?").intent).toBe("delays");
    expect(parseQuestion("Which agencies have the most capital projects over budget?").intent).toBe("capital");
  });
  it("detects boroughs, 311 types and grant themes", () => {
    expect(parseQuestion("capital projects in Staten Island").boro).toBe("Staten Island");
    const pothole = parseQuestion("Are pothole complaints going up?");
    expect(pothole.intent).toBe("demand");
    expect(pothole.demandType).toBe("Street Condition");
    const g = parseQuestion("Which federal grants for water infrastructure close soon?");
    expect(g.intent).toBe("grants");
    expect(g.grantTheme).toBe("water");
  });
  it("routes estimate questions only when an asset class is named", () => {
    expect(parseQuestion("How much does a bridge project usually run over?").intent).toBe("estimate");
    expect(parseQuestion("What went wrong with AIMS?").intent).toBe("maintenance");
    expect(parseQuestion("What is the out-year budget gap?").intent).toBe("gap");
  });
  it("matches every suggested question to a real intent", () => {
    for (const q of SUGGESTED_QUESTIONS) expect(parseQuestion(q).intent).not.toBe("unknown");
  });
});

describe("answerQuestion", () => {
  it("answers agency overtime with the adopted budget and a forecast", () => {
    const a = answerQuestion("NYPD overtime next year", data);
    expect(a.intent).toBe("overtime");
    expect(a.text).toContain("Police Department");
    expect(a.text).toContain("FY27");
    expect(a.sources.length).toBeGreaterThan(0);
  });
  it("answers citywide capital growth from the first published budget", () => {
    const a = answerQuestion("Which agencies have the most capital projects over budget?", data);
    expect(a.text).toContain("3 projects");
    expect(a.text).toContain("DOT");
  });
  it("filters delays by agency", () => {
    const a = answerQuestion("Which DOT projects slipped the most?", data);
    expect(a.intent).toBe("delays");
    expect(a.text).toContain("Project a");
    expect(a.text).not.toContain("Project c");
  });
  it("only lists open grants", () => {
    const a = answerQuestion("water grants", data);
    expect(a.text).toContain("Clean Water Grants");
    expect(a.text).not.toContain("Expired");
  });
  it("summarizes a reference class", () => {
    const a = answerQuestion("How much does a bridge project usually run over?", data);
    expect(a.intent).toBe("estimate");
    expect(a.text).toContain("40 past NYC projects");
  });
  it("reports missing data instead of guessing", () => {
    const a = answerQuestion("Which budget lines are adopted too low every year?", data);
    expect(a.text).toMatch(/hasn't loaded/);
  });
  it("offers suggestions for questions it can't match", () => {
    const a = answerQuestion("What's the weather tomorrow?", data);
    expect(a.intent).toBe("unknown");
    expect(a.followUps.length).toBeGreaterThan(0);
  });
});

describe("buildContextPack", () => {
  it("includes every loaded dataset and the published figures", () => {
    const pack = buildContextPack(data);
    expect(pack).toContain("Published figures");
    expect(pack).toContain("Overtime by agency");
    expect(pack).toContain("Capital projects");
    expect(pack).toContain("Reference class");
    expect(pack).toContain("311 requests");
    expect(pack).toContain("Clean Water Grants");
    expect(pack).not.toContain("Expired");
  });
});
