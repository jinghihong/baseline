import { describe, expect, it } from "vitest";
import { buildClassIndex, daysUntil, DEFAULT_FILTERS, filterGrants, grantKind, matchProjects, sortGrants, urgency } from "./grants";
import type { CapitalProject, GrantOpportunity, GrantTheme } from "../data/types";

const opp = (over: Partial<GrantOpportunity>): GrantOpportunity => ({
  id: "1",
  number: "N-1",
  title: "Safe Streets and Roads for All",
  agency: "DOT Federal Highway Administration",
  agencyCode: "DOT-FHWA",
  status: "posted",
  openDate: "2026-10-01",
  closeDate: "2026-12-01",
  aln: ["20.939"],
  themes: ["transportation"],
  url: "https://example.org",
  ...over,
});

const themes: GrantTheme[] = [
  { id: "transportation", label: "Streets", classes: ["streets", "bridges"] },
  { id: "water", label: "Water", classes: ["water"] },
];

const today = new Date(2026, 10, 14); // Nov 14, 2026

describe("grantKind", () => {
  it("separates research and international grants from program grants", () => {
    expect(grantKind(opp({}))).toBe("program");
    expect(grantKind(opp({ agency: "National Institutes of Health", title: "Cancer biology (R01)" }))).toBe("research");
    expect(grantKind(opp({ agency: "U.S. Mission to Egypt" }))).toBe("international");
  });
});

describe("deadlines", () => {
  it("counts days to the close date", () => {
    expect(daysUntil("2026-11-21", today)).toBe(7);
    expect(daysUntil(null, today)).toBeNull();
    expect(urgency(3)).toBe("closing");
    expect(urgency(20)).toBe("soon");
    expect(urgency(90)).toBe("open");
  });
});

describe("filters and matching", () => {
  const list = [
    opp({ id: "a" }),
    opp({ id: "b", agency: "National Institutes of Health", title: "Research on X", themes: ["water"] }),
    opp({ id: "c", closeDate: "2026-11-18", status: "forecasted", themes: ["water"] }),
  ];

  it("hides research by default and applies the closing window", () => {
    expect(filterGrants(list, DEFAULT_FILTERS, new Set(), today).map((o) => o.id)).toEqual(["a", "c"]);
    expect(filterGrants(list, { ...DEFAULT_FILTERS, includeResearch: true }, new Set(), today).length).toBe(3);
    expect(filterGrants(list, { ...DEFAULT_FILTERS, closingWithin: 7 }, new Set(), today).map((o) => o.id)).toEqual(["c"]);
    expect(filterGrants(list, { ...DEFAULT_FILTERS, savedOnly: true }, new Set(["a"]), today).map((o) => o.id)).toEqual(["a"]);
  });

  it("sorts by deadline", () => {
    expect(sortGrants(list, "deadline", today)[0].id).toBe("c");
  });

  it("matches opportunities to projects by asset class", () => {
    const projects = [
      { cls: "streets", budget: 10 },
      { cls: "bridges", budget: 20 },
      { cls: "parks", budget: 5 },
    ] as CapitalProject[];
    const m = matchProjects(opp({}), themes, buildClassIndex(projects));
    expect(m.projects).toBe(2);
    expect(m.budget).toBe(30);
  });
});
