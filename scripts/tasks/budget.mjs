// Expense budget + payroll: adopted vs end-of-year modified budgets, and actual overtime paid.
//
// How the NYC Expense Budget dataset (mwzb-yiwb) works, as verified against the data:
// each June publication carries `fiscal_year` = the budget year being adopted (FY X).
//   adopted_budget_amount          -> FY X adopted budget
//   current_modified_budget_amount -> FY X-1 budget as modified through June (the year just ending)
//   financial_plan_amount          -> FY X+1 plan
// So FY X "adopted" comes from the FY X publication, and FY X "modified" from the FY X+1 publication.
import { soql, agencyCode, agencyName, num, round, writeJson, source } from "../lib.mjs";

const OT_NAMES = ["OVERTIME", "OVERTIME UNIFORM FORCES"];

async function adoptedPublications() {
  const rows = await soql("mwzb-yiwb", {
    select: "fiscal_year, publication_date, count(*) as n",
    group: "fiscal_year, publication_date",
    order: "publication_date",
    limit: 500,
  });
  // The adopted budget is the last publication for each fiscal year that falls in May-June of the prior calendar year.
  const byFy = new Map();
  for (const r of rows) {
    const fy = Number(r.fiscal_year);
    const month = Number(String(r.publication_date).slice(4, 6));
    const year = Number(String(r.publication_date).slice(0, 4));
    if (year === fy - 1 && month >= 5) {
      const prev = byFy.get(fy);
      if (!prev || r.publication_date > prev) byFy.set(fy, r.publication_date);
    }
  }
  return [...byFy.entries()].sort((a, b) => a[0] - b[0]).map(([fy, pub]) => ({ fy, pub }));
}

const latestActual = (ag) => [...ag.years].reverse().find((y) => y.actual != null)?.actual ?? 0;

export async function buildBudget() {
  console.log("• Expense budget (adopted vs modified) and payroll overtime");
  const pubs = await adoptedPublications();
  const pubList = pubs.map((p) => `'${p.pub}'`).join(",");
  console.log(`  adopted publications: ${pubs.map((p) => `FY${p.fy}=${p.pub}`).join(" ")}`);

  const classRows = await soql("mwzb-yiwb", {
    select:
      "publication_date, fiscal_year, agency_name, object_class_name, sum(adopted_budget_amount) as adopted, sum(current_modified_budget_amount) as modified",
    where: `publication_date in (${pubList})`,
    group: "publication_date, fiscal_year, agency_name, object_class_name",
    limit: 200000,
  });
  const otRows = await soql("mwzb-yiwb", {
    select:
      "publication_date, fiscal_year, agency_name, sum(adopted_budget_amount) as adopted, sum(current_modified_budget_amount) as modified",
    where: `publication_date in (${pubList}) AND object_code_name in (${OT_NAMES.map((n) => `'${n}'`).join(",")})`,
    group: "publication_date, fiscal_year, agency_name",
    limit: 50000,
  });

  const fyOfPub = new Map(pubs.map((p) => [p.pub, p.fy]));

  // ---- Chronic under-budgeting: agency x object class -------------------------------------------
  const lines = new Map(); // key -> { agency, agencyCode, objectClass, years: Map(fy -> {adopted, modified}) }
  const touch = (agency, objectClass) => {
    const key = `${agency}||${objectClass}`;
    if (!lines.has(key)) {
      lines.set(key, { agency, agencyCode: agencyCode(agency), objectClass, years: new Map() });
    }
    return lines.get(key);
  };
  for (const r of classRows) {
    const fy = fyOfPub.get(r.publication_date);
    if (!fy) continue;
    const line = touch(r.agency_name, r.object_class_name || "Unclassified");
    const cur = line.years.get(fy) ?? { adopted: null, modified: null };
    cur.adopted = (cur.adopted ?? 0) + num(r.adopted);
    line.years.set(fy, cur);
    const prev = line.years.get(fy - 1) ?? { adopted: null, modified: null };
    prev.modified = (prev.modified ?? 0) + num(r.modified);
    line.years.set(fy - 1, prev);
  }

  const lineOut = [];
  for (const l of lines.values()) {
    const years = [...l.years.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([fy, v]) => ({ fy, adopted: v.adopted === null ? null : round(v.adopted), modified: v.modified === null ? null : round(v.modified) }));
    const peak = Math.max(...years.map((y) => Math.max(y.adopted ?? 0, y.modified ?? 0)));
    if (peak < 5_000_000) continue; // keep material lines only
    lineOut.push({ agency: l.agency, agencyCode: l.agencyCode, objectClass: l.objectClass, years });
  }
  lineOut.sort((a, b) => (b.years.at(-1)?.adopted ?? 0) - (a.years.at(-1)?.adopted ?? 0));

  // ---- Payroll overtime actuals ------------------------------------------------------------------
  const payRows = await soql("k397-673e", {
    select:
      "fiscal_year, payroll_number, agency_name, sum(total_ot_paid) as ot, sum(ot_hours) as hours, sum(regular_gross_paid) as regular",
    group: "fiscal_year, payroll_number, agency_name",
    limit: 50000,
  });
  // FY2026+ rows lost agency_name in the source; recover it from payroll_number using earlier years.
  const nameByPayroll = new Map();
  for (const r of [...payRows].sort((a, b) => Number(a.fiscal_year) - Number(b.fiscal_year))) {
    if (r.agency_name && r.payroll_number) nameByPayroll.set(String(r.payroll_number), r.agency_name);
  }
  const actual = new Map(); // code -> Map(fy -> {ot, hours, regular})
  let unmatchedOt = 0;
  for (const r of payRows) {
    const name = r.agency_name || nameByPayroll.get(String(r.payroll_number));
    const code = agencyCode(name);
    const fy = Number(r.fiscal_year);
    if (!code) {
      unmatchedOt += num(r.ot);
      continue;
    }
    if (!actual.has(code)) actual.set(code, new Map());
    const m = actual.get(code);
    const cur = m.get(fy) ?? { ot: 0, hours: 0, regular: 0 };
    cur.ot += num(r.ot);
    cur.hours += num(r.hours);
    cur.regular += num(r.regular);
    m.set(fy, cur);
  }

  // ---- Overtime budget by agency -----------------------------------------------------------------
  const otBudget = new Map(); // code -> Map(fy -> {adopted, modified})
  for (const r of otRows) {
    const fy = fyOfPub.get(r.publication_date);
    const code = agencyCode(r.agency_name);
    if (!fy || !code) continue;
    if (!otBudget.has(code)) otBudget.set(code, new Map());
    const m = otBudget.get(code);
    const cur = m.get(fy) ?? { adopted: null, modified: null };
    cur.adopted = (cur.adopted ?? 0) + num(r.adopted);
    m.set(fy, cur);
    const prev = m.get(fy - 1) ?? { adopted: null, modified: null };
    prev.modified = (prev.modified ?? 0) + num(r.modified);
    m.set(fy - 1, prev);
  }

  const codes = [...new Set([...otBudget.keys()].filter((c) => actual.has(c)))];
  const agencies = codes
    .map((code) => {
      const b = otBudget.get(code);
      const a = actual.get(code);
      const fys = [...new Set([...b.keys(), ...a.keys()])].filter((fy) => fy >= 2014).sort((x, y) => x - y);
      return {
        code,
        name: agencyName(code),
        years: fys.map((fy) => ({
          fy,
          adopted: b.get(fy)?.adopted == null ? null : round(b.get(fy).adopted),
          modified: b.get(fy)?.modified == null ? null : round(b.get(fy).modified),
          actual: a.get(fy) ? round(a.get(fy).ot) : null,
          hours: a.get(fy) ? round(a.get(fy).hours) : null,
          regular: a.get(fy) ? round(a.get(fy).regular) : null,
        })),
      };
    })
    .filter((ag) => ag.years.some((y) => (y.actual ?? 0) > 10_000_000))
    .sort((x, y) => latestActual(y) - latestActual(x));

  const fetchedAt = new Date().toISOString();
  writeJson("overtime.json", {
    meta: {
      fetchedAt,
      note:
        "Adopted = overtime object codes in the adopted budget. Modified = the same lines as modified through June of that fiscal year. Actual = total overtime paid in Citywide Payroll Data. All funds.",
      unmatchedActualOvertime: round(unmatchedOt),
      sources: [
        source("mwzb-yiwb", "Expense Budget", { publications: pubs }),
        source("k397-673e", "Citywide Payroll Data (Fiscal Year)"),
      ],
    },
    agencies,
  });

  writeJson("budget-lines.json", {
    meta: {
      fetchedAt,
      note:
        "Each line is an agency x object class. For every fiscal year: the adopted amount and the amount after in-year modifications. Lines whose modified budget repeatedly ends above adoption are under-budgeted at adoption.",
      sources: [source("mwzb-yiwb", "Expense Budget", { publications: pubs })],
    },
    lines: lineOut,
  });
}
