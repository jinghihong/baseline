// Maintenance risk ("AIMS done right"): score every asset by failure risk, fund repairs by risk reduced per
// dollar, and show what deferral costs over five years.
//
// NYC does not publish asset-level condition data, so Baseline ships a SAMPLE register with fictional assets
// to demonstrate the method. Cities load their own register through CSV import.
import { seededRandom, sum } from "../lib/stats";

export const CONDITION_LABEL: Record<number, string> = { 1: "Good", 2: "Fair", 3: "Worn", 4: "Poor", 5: "Critical" };

/** Annual probability of a failure that forces emergency work, by condition (1 = good, 5 = critical). */
const POF = [0, 0.003, 0.01, 0.035, 0.09, 0.2];
/** Cost to bring an asset back to good repair, as a share of replacement value, by condition. */
const REPAIR_SHARE = [0, 0.01, 0.04, 0.1, 0.22, 0.4];
/** Expected condition loss per year without work, by condition band. */
const DEGRADE = [0, 0.12, 0.18, 0.22, 0.25, 0];
export const CONSTRUCTION_INFLATION = 0.03;
/** Assets in this condition or worse are part of the state-of-good-repair backlog. */
export const BACKLOG_CONDITION = 3;
/** AIMS is designed to survey every asset on a four-year cycle. */
export const INSPECTION_CYCLE_YEARS = 4;

export interface Asset {
  id: string;
  name: string;
  type: string;
  cls: string;
  boro: string;
  builtYear: number;
  usefulLife: number;
  /** 1 (good) to 5 (critical). */
  condition: number;
  replacementValue: number;
  /** 1 (low) to 5 (life-safety / citywide service). */
  criticality: number;
  lastInspected: string | null;
  /** Optional measured repair cost; overrides the model at year 0. */
  repairCost?: number | null;
  sample: boolean;
}

interface AssetType {
  type: string;
  cls: string;
  life: number;
  min: number;
  max: number;
  prefix: string;
  crit: [number, number];
}

const TYPES: AssetType[] = [
  { type: "Vehicular bridge", cls: "bridges", life: 75, min: 20e6, max: 400e6, prefix: "BRG", crit: [4, 5] },
  { type: "Pedestrian bridge", cls: "bridges", life: 60, min: 2e6, max: 25e6, prefix: "PED", crit: [2, 4] },
  { type: "Retaining wall", cls: "streets", life: 75, min: 2e6, max: 30e6, prefix: "RWL", crit: [2, 4] },
  { type: "Water main segment", cls: "water", life: 100, min: 5e6, max: 40e6, prefix: "WMN", crit: [4, 5] },
  { type: "Pumping station", cls: "sewers", life: 50, min: 10e6, max: 90e6, prefix: "PMP", crit: [4, 5] },
  { type: "Treatment plant unit", cls: "plants", life: 40, min: 50e6, max: 500e6, prefix: "WTP", crit: [5, 5] },
  { type: "Firehouse", cls: "safety", life: 70, min: 10e6, max: 45e6, prefix: "FHS", crit: [4, 5] },
  { type: "Police precinct", cls: "safety", life: 70, min: 15e6, max: 70e6, prefix: "PCT", crit: [3, 5] },
  { type: "Courthouse", cls: "justice", life: 80, min: 50e6, max: 400e6, prefix: "CTH", crit: [3, 4] },
  { type: "Shelter building", cls: "social", life: 50, min: 10e6, max: 80e6, prefix: "SHL", crit: [3, 5] },
  { type: "Health clinic", cls: "social", life: 50, min: 8e6, max: 40e6, prefix: "CLN", crit: [3, 4] },
  { type: "Library branch", cls: "culture", life: 60, min: 8e6, max: 60e6, prefix: "LIB", crit: [2, 3] },
  { type: "Recreation center", cls: "parks", life: 50, min: 10e6, max: 60e6, prefix: "REC", crit: [2, 3] },
  { type: "Playground", cls: "parks", life: 25, min: 1e6, max: 6e6, prefix: "PLY", crit: [1, 3] },
  { type: "Public pool", cls: "parks", life: 40, min: 4e6, max: 30e6, prefix: "POL", crit: [1, 3] },
  { type: "Sanitation garage", cls: "facilities", life: 50, min: 20e6, max: 120e6, prefix: "GAR", crit: [3, 4] },
  { type: "Office building", cls: "facilities", life: 75, min: 30e6, max: 300e6, prefix: "OFC", crit: [2, 3] },
  { type: "Pier or bulkhead", cls: "waterfront", life: 50, min: 5e6, max: 80e6, prefix: "PIR", crit: [2, 4] },
  { type: "Ferry terminal", cls: "waterfront", life: 50, min: 30e6, max: 200e6, prefix: "FRY", crit: [3, 4] },
];

const BOROS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];

/** A deterministic register of fictional assets. Same seed, same assets, on every load. */
export function generateSampleAssets(count = 400, seed = 2027, asOfYear = 2026): Asset[] {
  const rand = seededRandom(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const counters = new Map<string, number>();
  const out: Asset[] = [];
  for (let i = 0; i < count; i++) {
    const t = pick(TYPES);
    const n = (counters.get(t.prefix) ?? 0) + 1;
    counters.set(t.prefix, n);
    const boro = pick(BOROS);
    const age = Math.round(between(3, t.life * 1.35));
    const ageRatio = age / t.life;
    const noise = (rand() - 0.5) * 1.6;
    const condition = Math.min(5, Math.max(1, Math.round(1 + ageRatio * 2.6 + noise)));
    // Log-uniform value so most assets are mid-sized and a few are very large.
    const value = Math.exp(between(Math.log(t.min), Math.log(t.max)));
    const yearsSinceInspection = Math.floor(between(0, 9));
    const month = 1 + Math.floor(rand() * 12);
    out.push({
      id: `SAMPLE-${t.prefix}-${String(n).padStart(3, "0")}`,
      name: `Sample ${t.type.toLowerCase()} ${String(n).padStart(3, "0")}`,
      type: t.type,
      cls: t.cls,
      boro,
      builtYear: asOfYear - age,
      usefulLife: t.life,
      condition,
      replacementValue: Math.round(value / 10_000) * 10_000,
      criticality: Math.round(between(t.crit[0], t.crit[1])),
      lastInspected: `${asOfYear - yearsSinceInspection}-${String(month).padStart(2, "0")}-15`,
      repairCost: null,
      sample: true,
    });
  }
  return out;
}

/** Stable 0-1 value per asset so deterioration speed varies between assets but never between runs. */
function unitHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const interp = (table: number[], cond: number) => {
  const c = Math.min(5, Math.max(1, cond));
  const lo = Math.floor(c);
  const hi = Math.min(5, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (c - lo);
};

export function probabilityOfFailure(condition: number, ageRatio: number): number {
  const ageFactor = 1 + Math.max(0, ageRatio - 0.8) * 1.5;
  return Math.min(0.6, interp(POF, condition) * ageFactor);
}

export const modelRepairCost = (replacementValue: number, condition: number) => replacementValue * interp(REPAIR_SHARE, condition);

export interface AssetAssessment {
  asset: Asset;
  age: number;
  ageRatio: number;
  pof: number;
  /** Dollar consequence of a failure: replacement value scaled by criticality. */
  consequence: number;
  /** Expected annual loss: probability x consequence. */
  risk: number;
  repairCost: number;
  /** Risk removed per dollar of repair. */
  priority: number;
  inBacklog: boolean;
  inspectionOverdue: boolean;
}

export function assessAsset(asset: Asset, asOfYear = 2026): AssetAssessment {
  const age = Math.max(0, asOfYear - asset.builtYear);
  const ageRatio = asset.usefulLife > 0 ? age / asset.usefulLife : 0;
  const pof = probabilityOfFailure(asset.condition, ageRatio);
  const consequence = asset.replacementValue * (asset.criticality / 5);
  const repairCost = asset.repairCost && asset.repairCost > 0 ? asset.repairCost : modelRepairCost(asset.replacementValue, asset.condition);
  const pofAfter = probabilityOfFailure(1, 0);
  const priority = repairCost > 0 ? ((pof - pofAfter) * consequence) / repairCost : 0;
  const lastYear = asset.lastInspected ? Number(asset.lastInspected.slice(0, 4)) : null;
  return {
    asset,
    age,
    ageRatio,
    pof,
    consequence,
    risk: pof * consequence,
    repairCost,
    priority,
    inBacklog: asset.condition >= BACKLOG_CONDITION,
    inspectionOverdue: lastYear === null || asOfYear - lastYear > INSPECTION_CYCLE_YEARS,
  };
}

export interface YearPlan {
  funded: AssetAssessment[];
  unfunded: AssetAssessment[];
  spent: number;
  riskReduced: number;
  backlog: number;
}

/** Fund backlog repairs in order of risk removed per dollar until the budget runs out. */
export function planYear(assets: Asset[], budget: number, asOfYear = 2026): YearPlan {
  const assessed = assets.map((a) => assessAsset(a, asOfYear));
  const backlog = assessed.filter((a) => a.inBacklog).sort((a, b) => b.priority - a.priority);
  const funded: AssetAssessment[] = [];
  const unfunded: AssetAssessment[] = [];
  let remaining = budget;
  const pofAfter = probabilityOfFailure(1, 0);
  let riskReduced = 0;
  for (const a of backlog) {
    if (a.repairCost <= remaining) {
      funded.push(a);
      remaining -= a.repairCost;
      riskReduced += (a.pof - pofAfter) * a.consequence;
    } else unfunded.push(a);
  }
  return { funded, unfunded, spent: budget === Infinity ? sum(funded.map((f) => f.repairCost)) : budget - remaining, riskReduced, backlog: sum(backlog.map((b) => b.repairCost)) };
}

export interface SimYear {
  year: number;
  /** Backlog (assets in Worn or worse) at the start of the year, before that year's repairs. */
  backlog: number;
  spent: number;
  /** Expected annual loss across the register after the year's repairs. */
  risk: number;
  critical: number;
}

/** Five-year projection under a fixed annual repair budget (0 = do nothing, Infinity = fund every repair). */
export function simulate(assets: Asset[], annualBudget: number, years = 5, startYear = 2026): SimYear[] {
  // Each asset carries a condition, an effective build year (reset on renewal) and a cost factor for measured repair costs.
  const state = assets.map((a) => {
    const modeled = modelRepairCost(a.replacementValue, a.condition);
    // Assets deteriorate at 0.6x to 1.6x the typical rate for their band.
    const speed = 0.6 + unitHash(a.id) * 1.0;
    return { a, cond: a.condition, built: a.builtYear, speed, factor: a.repairCost && a.repairCost > 0 && modeled > 0 ? a.repairCost / modeled : 1 };
  });
  const out: SimYear[] = [];
  const pofAfter = probabilityOfFailure(1, 0);
  for (let t = 0; t < years; t++) {
    const year = startYear + t;
    const priceLevel = (1 + CONSTRUCTION_INFLATION) ** t;
    const rows = state.map((s) => {
      const age = Math.max(0, year - s.built);
      const pof = probabilityOfFailure(s.cond, s.a.usefulLife ? age / s.a.usefulLife : 0);
      const consequence = s.a.replacementValue * priceLevel * (s.a.criticality / 5);
      const cost = modelRepairCost(s.a.replacementValue, s.cond) * s.factor * priceLevel;
      return { s, pof, consequence, cost, priority: cost > 0 ? ((pof - pofAfter) * consequence) / cost : 0 };
    });
    const backlogRows = rows.filter((r) => r.s.cond >= BACKLOG_CONDITION).sort((x, y) => y.priority - x.priority);
    const backlog = sum(backlogRows.map((r) => r.cost));
    let remaining = annualBudget;
    let spent = 0;
    for (const r of backlogRows) {
      if (r.cost <= remaining) {
        remaining -= r.cost;
        spent += r.cost;
        r.s.cond = 1;
        r.s.built = year;
        r.pof = pofAfter;
      }
    }
    const risk = sum(rows.map((r) => r.pof * r.consequence));
    const critical = rows.filter((r) => r.s.cond >= 4.5).length;
    out.push({ year, backlog, spent, risk, critical });
    for (const s of state) s.cond = Math.min(5, s.cond + DEGRADE[Math.min(5, Math.floor(s.cond))] * s.speed);
  }
  return out;
}

// ---- CSV import ------------------------------------------------------------------------------------
export const ASSET_CSV_COLUMNS = [
  "id",
  "name",
  "type",
  "asset_class",
  "borough",
  "year_built",
  "useful_life",
  "condition",
  "replacement_value",
  "criticality",
  "last_inspected",
  "repair_cost",
] as const;

export const ASSET_TEMPLATE_CSV = [
  ASSET_CSV_COLUMNS.join(","),
  "BR-001,Main St bridge,Vehicular bridge,bridges,Queens,1962,75,4,85000000,5,2023-06-01,",
  "LIB-014,Elm Ave library,Library branch,culture,Bronx,1971,60,3,22000000,3,2021-09-15,1800000",
].join("\n");

export interface ImportResult {
  assets: Asset[];
  errors: string[];
}

const numOrNull = (v: unknown) => {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Validate rows parsed from a CSV (header row already applied). Returns valid assets and readable errors. */
export function parseAssetRows(rows: Record<string, unknown>[], asOfYear = 2026): ImportResult {
  const assets: Asset[] = [];
  const errors: string[] = [];
  rows.forEach((raw, i) => {
    const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), v]));
    const line = i + 2; // header is line 1
    if (Object.values(row).every((v) => String(v ?? "").trim() === "")) return;
    const problems: string[] = [];
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? "").trim();
    const built = numOrNull(row.year_built);
    const life = numOrNull(row.useful_life);
    const cond = numOrNull(row.condition);
    const value = numOrNull(row.replacement_value);
    const crit = numOrNull(row.criticality);
    const repair = numOrNull(row.repair_cost);
    if (!id) problems.push("id is required");
    if (!name) problems.push("name is required");
    if (built === null || Number.isNaN(built) || built < 1800 || built > asOfYear) problems.push("year_built must be a year");
    if (life === null || Number.isNaN(life) || life <= 0) problems.push("useful_life must be a positive number of years");
    if (cond === null || Number.isNaN(cond) || cond < 1 || cond > 5) problems.push("condition must be 1 (good) to 5 (critical)");
    if (value === null || Number.isNaN(value) || value <= 0) problems.push("replacement_value must be a positive dollar amount");
    if (crit === null || Number.isNaN(crit) || crit < 1 || crit > 5) problems.push("criticality must be 1 to 5");
    if (repair !== null && (Number.isNaN(repair) || repair < 0)) problems.push("repair_cost must be a dollar amount or blank");
    const inspected = String(row.last_inspected ?? "").trim();
    if (inspected && !/^\d{4}-\d{2}-\d{2}$/.test(inspected)) problems.push("last_inspected must look like 2024-05-31");
    if (problems.length) {
      errors.push(`Row ${line}${id ? ` (${id})` : ""}: ${problems.join("; ")}`);
      return;
    }
    assets.push({
      id,
      name,
      type: String(row.type ?? "").trim() || "Asset",
      cls: String(row.asset_class ?? "").trim() || "facilities",
      boro: String(row.borough ?? "").trim() || "Citywide",
      builtYear: built as number,
      usefulLife: life as number,
      condition: cond as number,
      replacementValue: value as number,
      criticality: crit as number,
      lastInspected: inspected || null,
      repairCost: repair,
      sample: false,
    });
  });
  return { assets, errors };
}
