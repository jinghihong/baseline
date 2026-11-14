import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { headingsOf, parseBlocks } from "./Markdown";
import { parseProjectsCsv } from "./ProjectImport";
import { budgetRiskBrief, capitalDeliveryBrief, estimatesReport } from "./reports";
import { capitalProof, overtimeProof, riversideCheck } from "./proof";

const snapshot = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, "utf8"));

describe("Markdown parser", () => {
  it("splits headings, lists, tables and paragraphs", () => {
    const md = "# Title\n\nIntro line\ncontinues.\n\n## Part one\n\n- a\n- b\n\n1. x\n2. y\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quote";
    const blocks = parseBlocks(md);
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "heading", "list", "list", "table", "quote"]);
    expect(headingsOf(md)).toEqual([{ id: "part-one", text: "Part one" }]);
  });
  it("parses both public documents", () => {
    for (const f of ["docs/research-brief.md", "docs/methodology.md"]) {
      const md = readFileSync(f, "utf8");
      expect(parseBlocks(md).length).toBeGreaterThan(20);
      expect(headingsOf(md).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("project CSV import", () => {
  const classes = [
    { id: "bridges", label: "Bridges" },
    { id: "parks", label: "Parks & playgrounds" },
  ];
  it("accepts good rows and explains bad ones", () => {
    const rows = parseProjectsCsv(
      "Name,Asset Class,Agency,Borough,Original Budget,Current Budget,Original End,Current End\nBridge A,bridges,DOT,queens,12.5M,16800000,2022-06-30,3/31/2024\n,rockets,,, -5,abc,notadate,\nPark B,Parks & playgrounds,Parks,Bronx,\"$2,400,000\",2.9M,,",
      classes,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].project).toMatchObject({ assetClass: "bridges", agency: "DOT", boro: "Queens", originalBudget: 12.5e6, currentBudget: 16.8e6, currentEnd: "2024-03-31" });
    expect(rows[1].project).toBeNull();
    expect(rows[1].errors.length).toBeGreaterThanOrEqual(4);
    expect(rows[2].project).toMatchObject({ assetClass: "parks", agency: "DPR", originalBudget: 2.4e6 });
  });
});

describe("reports and proof points on the real snapshots", () => {
  const overtime = snapshot("overtime.json");
  const lines = snapshot("budget-lines.json");
  const capital = snapshot("capital-projects.json");
  const reference = snapshot("reference-projects.json");

  it("builds every report", () => {
    expect(budgetRiskBrief(overtime, lines)).toContain("## Out-year gap");
    expect(capitalDeliveryBrief(capital)).toContain("## Largest increases");
    expect(estimatesReport([], (x) => x)).toContain("No saved estimates");
  });

  it("computes sensible proof points", () => {
    const cap = capitalProof(capital);
    expect(cap.grownShare).toBeGreaterThan(0.2);
    expect(cap.grownShare).toBeLessThan(0.7);
    expect(cap.currentTotal).toBeGreaterThan(cap.firstTotal);
    const ot = overtimeProof(overtime);
    expect(ot.ratio).toBeGreaterThan(1);
    const check = riversideCheck(reference);
    expect(check.p50).toBeGreaterThan(check.estimate);
    expect(check.p80).toBeGreaterThan(check.p50);
    expect(check.p90).toBeGreaterThanOrEqual(check.p80);
  });
});
