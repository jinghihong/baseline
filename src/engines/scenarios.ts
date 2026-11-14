// Out-year budget gap scenarios, FY2027-FY2030, in $ millions.
// Start from OMB's published gaps and add levers. Published figures come from the Comptroller's FY2027
// Adopted Budget comments; every other number is a labeled Baseline assumption the user can change.
import {
  BUDGET_FACTS,
  FY27_COMPTROLLER_GAP,
  FY27_EXPENSE_RISKS,
  FY27_OMB_GAP,
  FY27_REVENUE_DIFF,
  FY27_UNSUBSTANTIATED_SAVINGS,
  FY27_YEARS,
} from "../data/curated";

export type OvertimeMode = "off" | "comptroller" | "baseline";

export interface ScenarioInputs {
  /** Use the Comptroller's higher revenue forecast. */
  comptrollerRevenue: boolean;
  /** Extra change to tax revenue vs OMB, % of the tax base, every year. */
  taxPct: number;
  /** Annual growth of the OMB tax base after FY27 (assumption; FY27 is published). */
  taxGrowthPct: number;
  /** Recession depth: tax revenue falls this % below plan in FY28 and FY29, half that in FY30. */
  recessionPct: number;
  /** Comptroller expense risks and offsets switched on, by id. */
  risks: Record<string, boolean>;
  overtimeMode: OvertimeMode;
  /** Baseline's FY27 overtime shortfall estimate in $ millions (held flat in out-years). */
  baselineOvertimeM: number;
  /** Labor settlements above plan: % raise per year starting FY28, compounded. */
  laborPct: number;
  /** Payroll base the raise applies to, $ millions (assumption). */
  payrollBaseM: number;
  /** Federal aid cuts beyond those in plan, $ millions per year. */
  federalCutM: number;
  federalStartFy: number;
  /** Include the Comptroller's risk that unspecified savings don't materialize. */
  savingsRisk: boolean;
}

export const DEFAULT_TAX_BASE_M = BUDGET_FACTS.fy27OmbTax / 1e6;
export const DEFAULT_PAYROLL_BASE_M = 35_000;

export const ALL_RISK_IDS = FY27_EXPENSE_RISKS.map((r) => r.id);

export function baseInputs(baselineOvertimeM = 0): ScenarioInputs {
  return {
    comptrollerRevenue: false,
    taxPct: 0,
    taxGrowthPct: 3,
    recessionPct: 0,
    risks: Object.fromEntries(ALL_RISK_IDS.map((id) => [id, false])),
    overtimeMode: "off",
    baselineOvertimeM,
    laborPct: 0,
    payrollBaseM: DEFAULT_PAYROLL_BASE_M,
    federalCutM: 0,
    federalStartFy: 2028,
    savingsRisk: false,
  };
}

export type PresetId = "omb" | "comptroller" | "recession" | "federal";

export const PRESETS: { id: PresetId; label: string; description: string }[] = [
  { id: "omb", label: "OMB plan", description: "The Mayor's financial plan as adopted, no adjustments." },
  { id: "comptroller", label: "Comptroller view", description: "The Comptroller's revenue forecast and every risk and offset in its FY2027 review." },
  { id: "recession", label: "Mild recession", description: "Comptroller view plus tax revenue 5% below plan in FY28-FY29, half that in FY30." },
  { id: "federal", label: "Federal cuts", description: "Comptroller view plus $1B a year in further federal aid cuts from FY28 (assumption)." },
];

export function presetInputs(id: PresetId, baselineOvertimeM = 0): ScenarioInputs {
  const base = baseInputs(baselineOvertimeM);
  if (id === "omb") return base;
  const comptroller: ScenarioInputs = {
    ...base,
    comptrollerRevenue: true,
    risks: Object.fromEntries(ALL_RISK_IDS.map((rid) => [rid, true])),
    overtimeMode: "comptroller",
  };
  if (id === "comptroller") return comptroller;
  if (id === "recession") return { ...comptroller, recessionPct: 5 };
  return { ...comptroller, federalCutM: 1000, federalStartFy: 2028 };
}

export interface Contribution {
  id: string;
  label: string;
  values: number[];
  source: "comptroller" | "baseline" | "assumption";
}

export interface ScenarioResult {
  years: number[];
  omb: number[];
  comptroller: number[];
  scenario: number[];
  contributions: Contribution[];
  taxBase: number[];
  /** Total change vs the OMB plan over the four years. */
  totalChange: number;
}

const recessionFactor = (fy: number) => (fy === 2028 || fy === 2029 ? 1 : fy === 2030 ? 0.5 : 0);

export function runScenario(inputs: ScenarioInputs): ScenarioResult {
  const years = [...FY27_YEARS];
  const taxBase = years.map((_, i) => DEFAULT_TAX_BASE_M * (1 + inputs.taxGrowthPct / 100) ** i);
  const contributions: Contribution[] = [];
  const add = (c: Contribution) => {
    if (c.values.some((v) => Math.abs(v) > 1e-9)) contributions.push(c);
  };

  if (inputs.comptrollerRevenue) {
    add({ id: "comptrollerRevenue", label: "Comptroller revenue forecast", values: [...FY27_REVENUE_DIFF.total], source: "comptroller" });
  }
  add({ id: "taxPct", label: `Tax revenue ${inputs.taxPct >= 0 ? "+" : ""}${inputs.taxPct}% vs plan`, values: taxBase.map((b) => (b * inputs.taxPct) / 100), source: "assumption" });
  add({
    id: "recession",
    label: `Recession (tax −${inputs.recessionPct}%)`,
    values: years.map((fy, i) => (-taxBase[i] * inputs.recessionPct * recessionFactor(fy)) / 100),
    source: "assumption",
  });

  for (const r of FY27_EXPENSE_RISKS) {
    if (r.id === "overtime") continue;
    if (inputs.risks[r.id]) add({ id: r.id, label: r.label, values: [...r.values], source: "comptroller" });
  }
  const ot = FY27_EXPENSE_RISKS.find((r) => r.id === "overtime");
  if (inputs.overtimeMode === "comptroller" && ot) {
    add({ id: "overtime", label: "Overtime (Comptroller estimate)", values: [...ot.values], source: "comptroller" });
  } else if (inputs.overtimeMode === "baseline") {
    add({ id: "overtime", label: "Overtime (Baseline forecast)", values: years.map(() => -Math.abs(inputs.baselineOvertimeM)), source: "baseline" });
  }

  add({
    id: "labor",
    label: `Labor settlements +${inputs.laborPct}%/yr from FY28`,
    values: years.map((_, i) => -inputs.payrollBaseM * ((1 + inputs.laborPct / 100) ** i - 1)),
    source: "assumption",
  });
  add({
    id: "federal",
    label: `Further federal cuts from FY${String(inputs.federalStartFy).slice(-2)}`,
    values: years.map((fy) => (fy >= inputs.federalStartFy ? -Math.abs(inputs.federalCutM) : 0)),
    source: "assumption",
  });
  if (inputs.savingsRisk) {
    add({ id: "savings", label: "Unsubstantiated savings don't materialize", values: [...FY27_UNSUBSTANTIATED_SAVINGS], source: "comptroller" });
  }

  const omb = [...FY27_OMB_GAP];
  const scenario = years.map((_, i) => omb[i] + contributions.reduce((s, c) => s + c.values[i], 0));
  const totalChange = scenario.reduce((s, v, i) => s + (v - omb[i]), 0);
  return { years, omb, comptroller: [...FY27_COMPTROLLER_GAP], scenario, contributions, taxBase, totalChange };
}

// ---- Persistence: ScenarioDraft.adjustments is a flat Record<string, number> ------------------------
const OT_CODES: Record<OvertimeMode, number> = { off: 0, comptroller: 1, baseline: 2 };

export function encodeInputs(inputs: ScenarioInputs): Record<string, number> {
  const out: Record<string, number> = {
    comptrollerRevenue: inputs.comptrollerRevenue ? 1 : 0,
    taxPct: inputs.taxPct,
    taxGrowthPct: inputs.taxGrowthPct,
    recessionPct: inputs.recessionPct,
    overtimeMode: OT_CODES[inputs.overtimeMode],
    laborPct: inputs.laborPct,
    payrollBaseM: inputs.payrollBaseM,
    federalCutM: inputs.federalCutM,
    federalStartFy: inputs.federalStartFy,
    savingsRisk: inputs.savingsRisk ? 1 : 0,
  };
  for (const id of ALL_RISK_IDS) out[`risk_${id}`] = inputs.risks[id] ? 1 : 0;
  return out;
}

export function decodeInputs(adj: Record<string, number>, baselineOvertimeM = 0): ScenarioInputs {
  const base = baseInputs(baselineOvertimeM);
  const n = (k: string, fallback: number) => (Number.isFinite(adj[k]) ? adj[k] : fallback);
  const otCode = n("overtimeMode", 0);
  return {
    ...base,
    comptrollerRevenue: n("comptrollerRevenue", 0) === 1,
    taxPct: n("taxPct", 0),
    taxGrowthPct: n("taxGrowthPct", base.taxGrowthPct),
    recessionPct: n("recessionPct", 0),
    overtimeMode: otCode === 2 ? "baseline" : otCode === 1 ? "comptroller" : "off",
    laborPct: n("laborPct", 0),
    payrollBaseM: n("payrollBaseM", base.payrollBaseM),
    federalCutM: n("federalCutM", 0),
    federalStartFy: n("federalStartFy", base.federalStartFy),
    savingsRisk: n("savingsRisk", 0) === 1,
    risks: Object.fromEntries(ALL_RISK_IDS.map((id) => [id, n(`risk_${id}`, 0) === 1])),
  };
}
