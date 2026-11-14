import { describe, expect, it } from "vitest";
import { briefToFacts, briefToMarkdown, buildHearingBrief } from "./hearingPrep";
import { assessLine, assessOvertime, assessProject, summarizeCapital, type AgencyFacts } from "./core";
import type { CapitalProject, OvertimeAgency } from "../data/types";
import type { DemandAssessment } from "./demand";

const otAgency: OvertimeAgency = {
  code: "NYPD",
  name: "Police Department",
  years: [
    ...[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((fy, i) => ({ fy, adopted: 500e6, modified: 900e6, actual: 800e6 + i * 40e6, hours: null, regular: null })),
    { fy: 2027, adopted: 560e6, modified: null, actual: null, hours: null, regular: null },
  ],
};

const project: CapitalProject = {
  id: "NYPD-1",
  fmsId: "PO-1",
  name: "Precinct House Rebuild",
  agency: "NYPD",
  sponsor: null,
  phase: "Design",
  boro: "Queens",
  cb: null,
  category: "Police Facilities",
  cls: "safety",
  budget: 180e6,
  firstBudget: 120e6,
  firstPeriod: "202305",
  spend: 5e6,
  forecast: "2030-01-01",
  firstForecast: "2028-01-01",
  slipDays: 731,
  constructionStart: null,
  reasons: { "Changes in Scope/Design": 3 },
};

const facts: AgencyFacts = {
  code: "NYPD",
  overtime: assessOvertime(otAgency),
  capital: summarizeCapital([assessProject(project)]),
  worstProjects: [assessProject(project)],
  chronicLines: [
    assessLine({
      agency: "POLICE DEPARTMENT",
      agencyCode: "NYPD",
      objectClass: "OTHER SERVICES AND CHARGES",
      years: [1.4, 1.5, 1.3, 1.6, 1.5].map((r, i) => ({ fy: 2020 + i, adopted: 10e6, modified: 10e6 * r })),
    }),
  ],
};

const demand = [
  {
    type: { type: "Noise - Residential", label: "Residential noise", agency: "NYPD", months: [] },
    last12: 1200,
    prior12: 1000,
    yoy: 0.2,
    anomaly: "within",
  } as unknown as DemandAssessment,
];

describe("buildHearingBrief", () => {
  const b = buildHearingBrief("NYPD", "Police Department", facts, demand);

  it("builds headline numbers and 8-12 questions, each with evidence and a source", () => {
    expect(b.headlines.length).toBeGreaterThanOrEqual(4);
    expect(b.questions.length).toBeGreaterThanOrEqual(8);
    expect(b.questions.length).toBeLessThanOrEqual(12);
    for (const q of b.questions) {
      expect(q.evidence.length).toBeGreaterThan(10);
      expect(q.sources.length).toBeGreaterThan(0);
    }
  });

  it("puts the overtime gap first and includes the Comptroller overtime risk", () => {
    expect(b.questions[0].topic).toBe("Overtime");
    expect(b.comptrollerRisks.map((r) => r.label)).toContain("Overtime");
  });

  it("marks forecast-based questions as estimates", () => {
    expect(b.questions.some((q) => q.estimate && q.topic === "Overtime")).toBe(true);
  });

  it("exports markdown and a fact sheet", () => {
    const md = briefToMarkdown(b, new Date(2026, 10, 14));
    expect(md).toContain("# Hearing brief: Police Department");
    expect(md).toContain("Evidence:");
    expect(briefToFacts(b)).toContain("Draft questions:");
  });
});
