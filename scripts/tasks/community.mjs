// 311 service demand and City Council discretionary capital awards.
import { soql, num, round, titleCase, writeJson, source } from "../lib.mjs";

// Complaint types that drive budget lines (repairs, sanitation, housing, homelessness, water).
export const DEMAND_TYPES = [
  { type: "Street Condition", label: "Potholes & street condition", agency: "DOT" },
  { type: "Sidewalk Condition", label: "Sidewalk condition", agency: "DOT" },
  { type: "Street Light Condition", label: "Street lights out", agency: "DOT" },
  { type: "Traffic Signal Condition", label: "Traffic signals", agency: "DOT" },
  { type: "Water System", label: "Water system problems", agency: "DEP" },
  { type: "Sewer", label: "Sewer backups & catch basins", agency: "DEP" },
  { type: "HEAT/HOT WATER", label: "No heat or hot water", agency: "HPD" },
  { type: "UNSANITARY CONDITION", label: "Unsanitary housing conditions", agency: "HPD" },
  { type: "Dirty Condition", label: "Dirty streets & lots", agency: "DSNY" },
  { type: "Missed Collection", label: "Missed trash collection", agency: "DSNY" },
  { type: "Rodent", label: "Rodents", agency: "DOHMH" },
  { type: "Damaged Tree", label: "Damaged trees", agency: "DPR" },
  { type: "Homeless Person Assistance", label: "Homeless person assistance", agency: "DHS" },
  { type: "Noise - Residential", label: "Residential noise", agency: "NYPD" },
  { type: "Illegal Parking", label: "Illegal parking", agency: "NYPD" },
];

export async function buildDemand() {
  console.log("• 311 service requests");
  const types = DEMAND_TYPES.map((t) => `'${t.type.replace(/'/g, "''")}'`).join(",");
  const monthly = [];
  // One query per type keeps each request fast on a very large dataset.
  for (const t of DEMAND_TYPES) {
    const rows = await soql("erm2-nwe9", {
      select: "date_trunc_ym(created_date) as m, count(*) as n",
      where: `complaint_type='${t.type.replace(/'/g, "''")}' AND created_date >= '2020-01-01T00:00:00'`,
      group: "m",
      order: "m",
      limit: 1000,
    });
    monthly.push({ type: t.type, label: t.label, agency: t.agency, months: rows.map((r) => [String(r.m).slice(0, 7), num(r.n)]) });
  }
  const thisYear = new Date().getFullYear();
  const byDistrict = await soql("erm2-nwe9", {
    select: "council_district, complaint_type, date_extract_y(created_date) as y, count(*) as n",
    where: `complaint_type in (${types}) AND created_date >= '${thisYear - 3}-01-01T00:00:00' AND council_district IS NOT NULL`,
    group: "council_district, complaint_type, y",
    limit: 50000,
  });
  const districts = {};
  for (const r of byDistrict) {
    const d = Number(r.council_district);
    if (!Number.isFinite(d) || d < 1 || d > 51) continue;
    districts[d] ??= {};
    districts[d][r.complaint_type] ??= {};
    districts[d][r.complaint_type][r.y] = num(r.n);
  }
  writeJson("demand-311.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      note: "Monthly 311 service requests for complaint types tied to budget lines, citywide since 2020, plus yearly counts by Council district.",
      sources: [source("erm2-nwe9", "311 Service Requests from 2010 to Present")],
    },
    types: monthly,
    districts,
  });
}

export async function buildCouncilCapital() {
  console.log("• City Council capital awards");
  const rows = await soql("t474-a92g", {
    select: "fiscal_year, council_district, sponsor, title, award, budget_line, borough, description",
    limit: 20000,
  });
  // Keep the four most recent fiscal years with a full set of awards (out-year rows are sparse).
  const counts = {};
  for (const r of rows) if (r.fiscal_year) counts[r.fiscal_year] = (counts[r.fiscal_year] ?? 0) + 1;
  const fys = Object.keys(counts).filter((fy) => counts[fy] >= 100).sort().slice(-4);
  const awards = rows
    .filter((r) => num(r.award) > 0 && fys.includes(r.fiscal_year))
    .map((r) => ({
      fy: r.fiscal_year,
      district: r.council_district ? Number(r.council_district) : null,
      sponsor: r.sponsor ? titleCase(r.sponsor) : null,
      title: titleCase(r.title).slice(0, 120),
      award: round(num(r.award)),
      budgetLine: r.budget_line ?? null,
      boro: r.borough ? titleCase(r.borough) : null,
    }));
  writeJson("council-capital.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      fiscalYears: fys,
      note: "Discretionary capital funding allocated by Council Members and Borough-wide delegations.",
      sources: [source("t474-a92g", "City Council Capital Budget")],
    },
    awards,
  });
}
