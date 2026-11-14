import { describe, expect, it } from "vitest";
import { awardsForDistrict, decodeDistrictCode, districtBorough, districtDemand, likelyMember, lineCategory, summarizeAwards } from "./district";
import type { CouncilAward, DemandData } from "../data/types";

describe("district codes", () => {
  it("maps districts to boroughs", () => {
    expect(districtBorough(1)).toBe("Manhattan");
    expect(districtBorough(14)).toBe("Bronx");
    expect(districtBorough(25)).toBe("Queens");
    expect(districtBorough(40)).toBe("Brooklyn");
    expect(districtBorough(50)).toBe("Staten Island");
  });

  it("decodes joint allocation codes", () => {
    expect(decodeDistrictCode(7)).toEqual({ members: [7], speaker: false, groups: [] });
    expect(decodeDistrictCode(2125).members).toEqual([21, 25]);
    expect(decodeDistrictCode(1400)).toEqual({ members: [14], speaker: true, groups: [] });
    expect(decodeDistrictCode(193)).toEqual({ members: [1], speaker: false, groups: ["Manhattan Delegation"] });
    expect(decodeDistrictCode(0).speaker).toBe(true);
    expect(decodeDistrictCode(93).members).toEqual([]);
  });

  it("labels budget lines", () => {
    expect(lineCategory("E  D001")).toBe("Schools");
    expect(lineCategory("P D018")).toBe("Parks");
    expect(lineCategory("HW-0200")).toBe("Streets & highways");
    expect(lineCategory(null)).toBe("Other");
  });
});

describe("awards", () => {
  const awards: CouncilAward[] = [
    { fy: "FY26", district: 1, sponsor: "Marte", title: "Playground", award: 500, budgetLine: "P D018", boro: "M" },
    { fy: "FY26", district: 1, sponsor: "Marte", title: "School", award: 1000, budgetLine: "E D001", boro: "M" },
    { fy: "FY25", district: 102, sponsor: "Speaker, Marte, Brewer", title: "Library", award: 300, budgetLine: "LN-0001", boro: "M" },
    { fy: "FY26", district: 7, sponsor: "Other", title: "Elsewhere", award: 900, budgetLine: "P D018", boro: "M" },
  ];

  it("collects direct and shared awards for a district", () => {
    const list = awardsForDistrict(awards, 1);
    expect(list.length).toBe(3);
    expect(list[0].award).toBe(1000);
    expect(list.find((a) => a.title === "Library")?.shared).toBe(true);
    const s = summarizeAwards(list, ["FY25", "FY26"]);
    expect(s.total).toBe(1800);
    expect(s.byFy.find((r) => r.fy === "FY26")?.total).toBe(1500);
    expect(s.byCategory[0].category).toBe("Schools");
    expect(likelyMember(list, "FY26")).toBe("Marte");
  });
});

describe("districtDemand", () => {
  const data: DemandData = {
    meta: { fetchedAt: "2026-11-14T00:00:00Z", sources: [] },
    types: [{ type: "Rodent", label: "Rodents", agency: "DOHMH", months: [] }],
    districts: {
      "1": { Rodent: { "2024": 50, "2025": 100 } },
      "2": { Rodent: { "2025": 50 } },
    },
  };
  it("indexes a district against the average district", () => {
    const [row] = districtDemand(data, 1, 2025);
    expect(row.average).toBe(75);
    expect(row.index).toBeCloseTo(100 / 75);
    expect(row.change).toBeCloseTo(1);
  });
});
