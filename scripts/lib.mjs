// Shared helpers for the data pipeline: Socrata queries with retries, agency matching, file output.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_DIR = join(ROOT, "public", "data");
const SOCRATA = "https://data.cityofnewyork.us/resource/";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run a SoQL query against NYC Open Data. `params` keys are SoQL clauses without the `$`. */
export async function soql(datasetId, params, { attempts = 5, timeoutMs = 180_000 } = {}) {
  const qs = Object.entries(params)
    .map(([k, v]) => `$${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `${SOCRATA}${datasetId}.json?${qs}`;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const started = Date.now();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json", "User-Agent": "baseline-data-pipeline" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const rows = await res.json();
      console.log(`  ✓ ${datasetId} ${rows.length} rows in ${Date.now() - started}ms`);
      return rows;
    } catch (err) {
      lastErr = err;
      const wait = 1500 * 2 ** i;
      console.log(`  … ${datasetId} attempt ${i + 1} failed (${err.cause?.code || err.message}); retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw new Error(`Query failed for ${datasetId}: ${lastErr?.message}`);
}

/** Page through a large result set. */
export async function soqlAll(datasetId, params, pageSize = 50_000) {
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await soql(datasetId, { ...params, limit: pageSize, offset });
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

const AGENCIES = JSON.parse(readFileSync(join(ROOT, "src", "data", "agencies.json"), "utf8"));
const compiled = AGENCIES.map((a) => ({ ...a, res: a.patterns.map((p) => new RegExp(p)) }));

export function normalizeAgency(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bDEPT\b\.?/g, "DEPARTMENT")
    .replace(/\bSVCS?\b/g, "SERVICES")
    .replace(/\bSERVICE\b/g, "SERVICES")
    .replace(/\bENVIRONMENTAL\b/g, "ENVIRONMENT")
    .replace(/[.,'’()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map any agency spelling used across NYC datasets to a canonical code (or null). */
export function agencyCode(raw) {
  const upper = String(raw || "").toUpperCase().trim();
  const exact = compiled.find((a) => a.acronyms.includes(upper));
  if (exact) return exact.code;
  const norm = normalizeAgency(raw);
  for (const a of compiled) if (a.res.some((re) => re.test(norm))) return a.code;
  return null;
}

export const agencyName = (code) => AGENCIES.find((a) => a.code === code)?.name ?? code;

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round = (n, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function titleCase(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Nyc|Nypd|Fdny|Ada|Hvac|Ps|Is|Ms|Hs|Cuny|Dep|Dot|Dsny|Doc|Nycha|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|The|For|In|At|To|On|A)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase())
    .trim();
}

export function writeJson(name, data) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, name);
  const body = JSON.stringify(data);
  writeFileSync(file, body);
  console.log(`  → wrote public/data/${name} (${(body.length / 1024).toFixed(0)} KB)`);
}

export function readJson(name) {
  try {
    return JSON.parse(readFileSync(join(OUT_DIR, name), "utf8"));
  } catch {
    return null;
  }
}

export const source = (id, title, extra = {}) => ({
  id,
  title,
  url: `https://data.cityofnewyork.us/d/${id}`,
  publisher: "NYC Open Data",
  ...extra,
});
