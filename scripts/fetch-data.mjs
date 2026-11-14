#!/usr/bin/env node
// Refreshes every dataset Baseline uses and writes compact JSON snapshots to public/data/.
// Usage: node scripts/fetch-data.mjs            (all tasks)
//        node scripts/fetch-data.mjs budget grants   (only some)
import { writeJson, readJson } from "./lib.mjs";
import { buildBudget } from "./tasks/budget.mjs";
import { buildReferenceClass, buildDashboard } from "./tasks/capital.mjs";
import { buildDemand, buildCouncilCapital } from "./tasks/community.mjs";
import { buildGrants } from "./tasks/grants.mjs";
import { buildBacktest } from "./tasks/backtest.mjs";

const TASKS = {
  budget: buildBudget,
  reference: buildReferenceClass,
  dashboard: buildDashboard,
  demand: buildDemand,
  council: buildCouncilCapital,
  grants: buildGrants,
  backtest: buildBacktest,
};

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(TASKS);
const manifest = readJson("manifest.json") ?? { datasets: {} };
let failures = 0;

for (const name of names) {
  const task = TASKS[name];
  if (!task) {
    console.error(`Unknown task "${name}". Choose from: ${Object.keys(TASKS).join(", ")}`);
    process.exit(1);
  }
  const started = Date.now();
  try {
    await task();
    manifest.datasets[name] = { refreshedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), ok: true };
  } catch (err) {
    failures++;
    console.error(`✗ ${name} failed: ${err.message}`);
    manifest.datasets[name] = { ...(manifest.datasets[name] ?? {}), lastError: err.message, lastAttempt: new Date().toISOString(), ok: false };
  }
}

manifest.updatedAt = new Date().toISOString();
writeJson("manifest.json", manifest);
if (failures) {
  console.error(`${failures} task(s) failed. Existing snapshots were kept.`);
  process.exit(1);
}
