// Shapes of the JSON snapshots in public/data (written by scripts/fetch-data.mjs).

export interface DataSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  [key: string]: unknown;
}

export interface DatasetMeta {
  fetchedAt: string;
  note?: string;
  sources: DataSource[];
}

// ---- Overtime -------------------------------------------------------------------------------------
export interface OvertimeYear {
  fy: number;
  /** Overtime in the adopted budget. */
  adopted: number | null;
  /** Overtime budget after in-year modifications, as of June of that fiscal year. */
  modified: number | null;
  /** Overtime actually paid (Citywide Payroll Data). */
  actual: number | null;
  hours: number | null;
  regular: number | null;
}
export interface OvertimeAgency {
  code: string;
  name: string;
  years: OvertimeYear[];
}
export interface OvertimeData {
  meta: DatasetMeta & { unmatchedActualOvertime: number };
  agencies: OvertimeAgency[];
}

// ---- Expense budget lines -------------------------------------------------------------------------
export interface BudgetLineYear {
  fy: number;
  adopted: number | null;
  modified: number | null;
}
export interface BudgetLine {
  agency: string;
  agencyCode: string | null;
  objectClass: string;
  years: BudgetLineYear[];
}
export interface BudgetLinesData {
  meta: DatasetMeta;
  lines: BudgetLine[];
}

// ---- Capital: reference class (CPDD Oct 2023) -----------------------------------------------------
export interface ReferenceProject {
  id: string;
  name: string;
  agency: string;
  category: string;
  /** Asset class id, see meta.classes. */
  cls: string;
  boro: string;
  /** Original budget at project creation ($). */
  orig: number;
  /** Latest planned total ($). */
  current: number;
  spent: number;
  delay: string | null;
  origEnd: string | null;
  end: string | null;
  slipDays: number | null;
}
export interface AssetClassInfo {
  id: string;
  label: string;
}
export interface ReferenceData {
  meta: DatasetMeta & { snapshot: string; classes: AssetClassInfo[] };
  projects: ReferenceProject[];
}

// ---- Capital: live dashboard ----------------------------------------------------------------------
export interface CapitalProject {
  id: string;
  fmsId: string;
  name: string;
  agency: string;
  sponsor: string | null;
  phase: string | null;
  boro: string;
  cb: string | null;
  category: string;
  cls: string;
  budget: number;
  firstBudget: number | null;
  firstPeriod: string | null;
  spend: number;
  forecast: string | null;
  firstForecast: string | null;
  slipDays: number | null;
  constructionStart: string | null;
  reasons: Record<string, number>;
  /** Number of projects that report this same FMS budget ID (only set when more than one). Count the budget once. */
  shared?: number;
  /** [reporting period "YYYYMM", total budget] at each change. */
  series?: [string, number][];
}
export interface CapitalData {
  meta: DatasetMeta & { latestPeriod: string; firstPeriod: string; periods: string[] };
  projects: CapitalProject[];
}

// ---- 311 demand -----------------------------------------------------------------------------------
export interface DemandType {
  type: string;
  label: string;
  agency: string;
  /** ["YYYY-MM", count] */
  months: [string, number][];
}
export interface DemandData {
  meta: DatasetMeta;
  types: DemandType[];
  /** district -> complaint type -> year -> count */
  districts: Record<string, Record<string, Record<string, number>>>;
}

// ---- Council capital awards -----------------------------------------------------------------------
export interface CouncilAward {
  fy: string;
  district: number | null;
  sponsor: string | null;
  title: string;
  award: number;
  budgetLine: string | null;
  boro: string | null;
}
export interface CouncilCapitalData {
  meta: DatasetMeta & { fiscalYears: string[] };
  awards: CouncilAward[];
}

// ---- Grants ---------------------------------------------------------------------------------------
export interface GrantOpportunity {
  id: string;
  number: string;
  title: string;
  agency: string;
  agencyCode: string;
  status: string;
  openDate: string | null;
  closeDate: string | null;
  aln: string[];
  themes: string[];
  url: string;
}
export interface GrantTheme {
  id: string;
  label: string;
  classes: string[];
}
export interface GrantsData {
  meta: DatasetMeta & { themes: GrantTheme[] };
  opportunities: GrantOpportunity[];
}

// ---- Manifest -------------------------------------------------------------------------------------
export interface Manifest {
  updatedAt: string;
  datasets: Record<string, { refreshedAt?: string; seconds?: number; ok: boolean; lastError?: string }>;
}

export interface DatasetMap {
  overtime: OvertimeData;
  budgetLines: BudgetLinesData;
  reference: ReferenceData;
  capital: CapitalData;
  demand: DemandData;
  council: CouncilCapitalData;
  grants: GrantsData;
  manifest: Manifest;
}

export const DATASET_FILES: Record<keyof DatasetMap, string> = {
  overtime: "overtime.json",
  budgetLines: "budget-lines.json",
  reference: "reference-projects.json",
  capital: "capital-projects.json",
  demand: "demand-311.json",
  council: "council-capital.json",
  grants: "grants.json",
  manifest: "manifest.json",
};
