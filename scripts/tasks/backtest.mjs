// Backtest data for the cost forecaster: a time-split test with no look-ahead.
//
// Training set: every project as the city's Capital Project Detail Data showed it in the FIRST publication
// (April 2019). Its outcome ratio is what was known then (planned total / original budget).
// Test set: projects that first appear in a LATER publication (so the forecaster never saw them) and that were
// substantially finished by their last appearance (at least 80% of the planned total already spent).
// Their final outcome = last planned total / original budget at creation.
// The app runs the real forecaster on the training set for each test project and scores the ranges.
import { soqlAll, agencyCode, num, round, titleCase, writeJson, source } from "../lib.mjs";
import { assetClass } from "./capital.mjs";

const SPENT_SHARE_DONE = 0.8;

export async function buildBacktest() {
  console.log("• Cost forecaster backtest (CPDD publications 2019-2023)");
  const rows = await soqlAll("wa2y-rh4b", {
    select:
      "project_id, pub_date, max(project_descr) as name, max(managing_agcy) as agency, max(typ_category_name) as category, max(boro) as boro, sum(orig_bud_amt) as orig, sum(city_plan_total) as city_plan, sum(noncity_plan_total) as noncity_plan, sum(city_prior_actual) as city_spent, sum(noncity_prior_actual) as noncity_spent",
    group: "project_id, pub_date",
    order: "project_id, pub_date",
  });
  const pubs = [...new Set(rows.map((r) => r.pub_date))].sort((a, b) => normPub(a).localeCompare(normPub(b)));
  const firstPub = pubs[0];
  const lastPub = pubs[pubs.length - 1];

  const byProject = new Map();
  for (const r of rows) {
    const list = byProject.get(r.project_id) ?? [];
    list.push(r);
    byProject.set(r.project_id, list);
  }

  const toItem = (r, extra = {}) => {
    const orig = num(r.orig) * 1000; // dataset is in $ thousands
    const plan = (num(r.city_plan) + num(r.noncity_plan)) * 1000;
    return {
      id: r.project_id,
      name: titleCase(r.name).slice(0, 80),
      agency: agencyCode(r.agency) ?? titleCase(r.agency),
      cls: assetClass(r.category, r.name),
      boro: titleCase(r.boro),
      orig: round(orig),
      current: round(plan),
      ...extra,
    };
  };

  const train = [];
  const test = [];
  for (const [, list] of byProject) {
    list.sort((a, b) => normPub(a.pub_date).localeCompare(normPub(b.pub_date)));
    const first = list[0];
    const last = list[list.length - 1];
    if (first.pub_date === firstPub) {
      const item = toItem(first);
      if (item.orig > 0 && item.current > 0) train.push(item);
      continue;
    }
    // New after the training snapshot: a genuine out-of-sample project.
    const final = toItem(last);
    const spent = (num(last.city_spent) + num(last.noncity_spent)) * 1000;
    const origAtCreation = num(first.orig) * 1000;
    if (origAtCreation <= 0 || final.current <= 0) continue;
    const spentShare = spent / final.current;
    if (spentShare < SPENT_SHARE_DONE) continue;
    test.push({ ...final, orig: round(origAtCreation), firstPub: normPub(first.pub_date), lastPub: normPub(last.pub_date), spentShare: round(spentShare, 3) });
  }

  writeJson("backtest.json", {
    meta: {
      fetchedAt: new Date().toISOString(),
      trainingPub: normPub(firstPub),
      lastPub: normPub(lastPub),
      publications: pubs.map(normPub),
      doneThreshold: SPENT_SHARE_DONE,
      note: "Training = projects as published in the first snapshot. Test = projects created after it and at least 80% spent by their last appearance. Outcome = last planned total / original budget at creation.",
      sources: [source("wa2y-rh4b", "Capital Project Detail Data - Dollars", { publications: pubs.map(normPub) })],
    },
    train,
    test,
  });
  console.log(`  training ${train.length} · out-of-sample finished ${test.length}`);
}

// Publication dates come as YYYYMMDD, with one malformed value ("2021122"). Normalize to YYYY-MM-DD-ish for sorting.
function normPub(p) {
  const s = String(p);
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (s.length === 7) return `${s.slice(0, 4)}-${s.slice(4, 6)}-0${s.slice(6)}`;
  return s;
}
