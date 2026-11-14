// Capital projects: the reference class for cost forecasting (CPDD, Oct 2023) and the live
// Capital Projects Dashboard (2023-2026) with budget and schedule history that is never rebased.
import { soql, soqlAll, agencyCode, num, round, titleCase, writeJson, source } from "../lib.mjs";

// Friendly asset classes built from the city's "type category" labels.
export const ASSET_CLASSES = [
  ["parks", "Parks & playgrounds", /PARK|PLAYGROUND|RECREATION|TREE PLANTING|ZOO|BOTANICAL|BEACH|POOL/],
  ["streets", "Streets & sidewalks", /STREET|PEDESTRIAN|SIDEWALK|HIGHWAY|ROADWAY|RESURFAC|PLAZA/],
  ["bridges", "Bridges", /BRIDGE/],
  ["water", "Water mains & supply", /WATER SUPPLY|DISTRIBUTION MAIN|WATER MAIN|TRUNK|DAM|AQUEDUCT|WATER QUALITY/],
  ["sewers", "Sewers & stormwater", /SEWER|STORM|GREEN INFRASTRUCTURE|DRAINAGE|COMBINED SEWER/],
  ["plants", "Treatment plants & utilities", /PLANT UPGRADING|TREATMENT|POLLUTION CONTROL|SLUDGE|UTILIT/],
  ["housing", "Public & affordable housing", /HOUSING|DWELLING|RESIDENTIAL|NEIGHBORHOOD REVITALIZATION/],
  ["schools", "Schools & universities", /SCHOOL|EDUCATION|COLLEGE|UNIVERSITY|CLASSROOM/],
  ["safety", "Police, fire & EMS facilities", /POLICE|FIRE|EMS|EMERGENCY/],
  ["justice", "Courts & jails", /COURT|CORRECTION|DETENTION|JAIL/],
  ["social", "Shelters, health & social services", /SHELTER|HOMELESS|SOCIAL SERVICE|HEALTH|HOSPITAL|CHILD|SENIOR|AGING|DAY CARE/],
  ["culture", "Libraries & cultural", /LIBRAR|CULTURAL|MUSEUM|THEATER|ARTS/],
  ["facilities", "City buildings & office space", /OFFICE SPACE|BUILDING|FACILIT|GARAGE|RECONSTRUCTION|RENOVATION|ESSENTIAL|RETROFIT|ENERGY/],
  ["waterfront", "Ferries, ports & waterfront", /FERRY|WATERFRONT|PIER|MARINE|PORT|WHARF/],
  ["lighting", "Lighting & traffic systems", /LAMPPOST|LUMINAIRE|LIGHTING|TRAFFIC|SIGNAL/],
  ["tech", "Technology & equipment", /TECHNOLOGY|COMPUTER|EQUIPMENT|VEHICLE|SYSTEM|TELECOM|RADIO/],
  ["land", "Land, development & other", /.*/],
];

export function assetClass(category, description = "") {
  const text = `${category || ""} ${description || ""}`.toUpperCase();
  const byCategory = ASSET_CLASSES.find(([, , re]) => re.test(String(category || "").toUpperCase()) && re.source !== ".*");
  if (byCategory) return byCategory[0];
  const byText = ASSET_CLASSES.find(([, , re]) => re.test(text) && re.source !== ".*");
  return byText ? byText[0] : "land";
}

const BORO = { MN: "Manhattan", BX: "Bronx", BK: "Brooklyn", QN: "Queens", SI: "Staten Island" };
const boroName = (b) => {
  const s = String(b || "").trim();
  if (BORO[s.toUpperCase()]) return BORO[s.toUpperCase()];
  if (!s || /CITYWIDE|^CW$/i.test(s)) return "Citywide";
  return titleCase(s);
};

const dayDiff = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86_400_000) : null);
const isoDay = (d) => (d ? String(d).slice(0, 10) : null);

export async function buildReferenceClass() {
  console.log("• Capital Project Detail Data (reference class)");
  const PUB = "20231026";
  const dollars = await soql("wa2y-rh4b", {
    select:
      "project_id, max(project_descr) as name, max(managing_agcy) as agency, max(typ_category_name) as category, max(boro) as boro, max(delay_desc) as delay, sum(orig_bud_amt) as orig, sum(city_plan_total) as city_plan, sum(noncity_plan_total) as noncity_plan, sum(city_prior_actual) as city_spent, sum(noncity_prior_actual) as noncity_spent",
    where: `pub_date='${PUB}'`,
    group: "project_id",
    limit: 50000,
  });
  const milestones = await soql("s7yh-frbm", {
    select:
      "project_id, min(orig_start_date) as orig_start, max(orig_end_date) as orig_end, min(task_start_date) as start, max(task_end_date) as end, count(*) as tasks",
    where: `pub_date='${PUB}'`,
    group: "project_id",
    limit: 50000,
  });
  const ms = new Map(milestones.map((m) => [m.project_id, m]));

  const projects = [];
  for (const d of dollars) {
    const orig = num(d.orig) * 1000; // dataset reports $ thousands
    const current = (num(d.city_plan) + num(d.noncity_plan)) * 1000;
    if (orig <= 0 || current <= 0) continue;
    const m = ms.get(d.project_id);
    projects.push({
      id: d.project_id,
      name: titleCase(d.name).slice(0, 90),
      agency: agencyCode(d.agency) ?? titleCase(d.agency),
      category: titleCase(d.category),
      cls: assetClass(d.category, d.name),
      boro: boroName(d.boro),
      orig: round(orig),
      current: round(current),
      spent: round((num(d.city_spent) + num(d.noncity_spent)) * 1000),
      delay: d.delay ? titleCase(String(d.delay).replace(/^PROJECT DELAYED (DUE TO |PENDING |RESULTING FROM )?/i, "")) : null,
      origEnd: m ? isoDay(m.orig_end) : null,
      end: m ? isoDay(m.end) : null,
      slipDays: m ? dayDiff(m.orig_end, m.end) : null,
    });
  }
  writeJson("reference-projects.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      snapshot: "October 2023 Capital Project Detail Data, the same publication the NY State Comptroller reviewed in April 2024.",
      note: "orig = original budget at project creation. current = latest planned total (prior spending + five-year plan + required to complete). slipDays = latest planned completion minus originally planned completion.",
      classes: ASSET_CLASSES.map(([id, label]) => ({ id, label })),
      sources: [source("wa2y-rh4b", "Capital Project Detail Data - Dollars"), source("s7yh-frbm", "Capital Project Detail Data - Milestones")],
    },
    projects,
  });
}

export async function buildDashboard() {
  console.log("• Capital Projects Dashboard (live watchlist)");
  const periods = await soql("fb86-vt7u", { select: "distinct reporting_period", order: "reporting_period", limit: 500 });
  const allPeriods = periods.map((p) => p.reporting_period).filter(Boolean).sort();
  const latest = allPeriods.at(-1);
  console.log(`  periods ${allPeriods[0]}…${latest} (${allPeriods.length})`);

  const current = await soqlAll("fb86-vt7u", {
    select:
      "pid, fms_id, fms_project_name, agency_project_name, managing_agency, sponsor_agency, current_phase, borough, community_board, ten_year_plan_category, budget_line, total_budget, spend_to_date, forecast_completion, actual_design_start, actual_construction_start",
    where: `reporting_period='${latest}'`,
    order: "fms_id",
  });
  const history = await soqlAll("fb86-vt7u", {
    select: "reporting_period, fms_id, pid, total_budget, forecast_completion",
    order: "fms_id, reporting_period",
  });
  const schedule = await soqlAll("95tx-snak", {
    select: "pid, managing_agency, reporting_period, completion_date, completion_date_type, variance_day, reason_for_forecast_completion_change",
    order: "pid, reporting_period",
  });

  const keyOf = (r) => `${r.fms_id || ""}|${r.pid || ""}`;
  const hist = new Map();
  for (const h of history) {
    const k = keyOf(h);
    if (!hist.has(k)) hist.set(k, []);
    hist.get(k).push(h);
  }
  const sched = new Map();
  for (const s of schedule) {
    const k = `${s.managing_agency}|${s.pid}`;
    if (!sched.has(k)) sched.set(k, []);
    sched.get(k).push(s);
  }

  const projects = [];
  for (const r of current) {
    const budget = num(r.total_budget);
    if (budget <= 0) continue;
    const h = (hist.get(keyOf(r)) ?? []).sort((a, b) => a.reporting_period.localeCompare(b.reporting_period));
    const first = h.find((x) => num(x.total_budget) > 0) ?? null;
    // Compress the budget series to the points where the number changed.
    const series = [];
    for (const x of h) {
      const v = round(num(x.total_budget));
      if (!series.length || series.at(-1)[1] !== v) series.push([x.reporting_period, v]);
    }
    const s = (sched.get(`${r.managing_agency}|${r.pid}`) ?? []).filter((x) => x.completion_date);
    const forecasts = s.filter((x) => x.completion_date_type === "Forecast");
    const firstForecast = forecasts[0]?.completion_date ?? null;
    const lastForecast = forecasts.at(-1)?.completion_date ?? r.forecast_completion ?? null;
    const reasons = {};
    for (const x of s) {
      const reason = x.reason_for_forecast_completion_change;
      if (reason) {
        const label = titleCase(reason.replace(/^PROJECT DELAYED (DUE TO |PENDING |RESULTING FROM )?/i, ""));
        reasons[label] = (reasons[label] ?? 0) + 1;
      }
    }
    const name = titleCase(r.agency_project_name || r.fms_project_name || r.fms_id);
    projects.push({
      id: r.pid ? `${r.managing_agency}-${r.pid}` : r.fms_id,
      fmsId: r.fms_id,
      name: name.slice(0, 100),
      agency: agencyCode(r.managing_agency) ?? r.managing_agency,
      sponsor: agencyCode(r.sponsor_agency) ?? r.sponsor_agency ?? null,
      phase: String(r.current_phase || "").replace(/[()]/g, "") || null,
      boro: boroName(r.borough),
      cb: r.community_board ?? null,
      category: titleCase(r.ten_year_plan_category),
      cls: assetClass(r.ten_year_plan_category, name),
      budget: round(budget),
      firstBudget: first ? round(num(first.total_budget)) : null,
      firstPeriod: first?.reporting_period ?? null,
      spend: round(num(r.spend_to_date)),
      forecast: isoDay(lastForecast),
      firstForecast: isoDay(firstForecast),
      slipDays: dayDiff(firstForecast, lastForecast),
      constructionStart: isoDay(r.actual_construction_start),
      reasons,
      series: series.length > 1 ? series : undefined,
    });
  }
  projects.sort((a, b) => b.budget - a.budget);
  writeJson("capital-projects.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      latestPeriod: latest,
      firstPeriod: allPeriods[0],
      periods: allPeriods,
      note:
        "Budget and completion dates as first reported in the Capital Projects Dashboard compared with the latest report. Baseline never rebases: the first number the city published stays the baseline.",
      sources: [
        source("fb86-vt7u", "Capital Projects Dashboard - Citywide Budget and Schedule"),
        source("95tx-snak", "Capital Projects Dashboard - Citywide Schedule History and Variance"),
      ],
    },
    projects,
  });
}
