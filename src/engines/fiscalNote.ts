// Fiscal notes: estimate what a proposed bill costs, year by year, with a low/high range.
// The output follows the shape of a NYC Council Finance Fiscal Impact Statement.
import { fiscalYearOf } from "../lib/format";

export interface StaffLine {
  id: string;
  title: string;
  fte: number;
  salary: number;
}

export interface FiscalInput {
  title: string;
  billNumber: string;
  agency: string;
  sponsor: string;
  summary: string;
  effectiveDate: string; // YYYY-MM-DD
  staff: StaffLine[];
  /** Fringe benefits as a share of salary (pension, health, payroll taxes). */
  fringeRate: number;
  /** Share of positions filled in the first fiscal year. */
  firstYearHiring: number;
  /** Annual contracts and other than personal services (OTPS). */
  annualOtps: number;
  /** One-time costs in the year of enactment (IT, vehicles, equipment, fit-out). */
  oneTime: number;
  /** Annual new revenue (fees, fines). Negative for revenue lost. */
  annualRevenue: number;
  /** Share of billed revenue actually collected. */
  collectionRate: number;
  salaryGrowth: number;
  otpsGrowth: number;
  /** +/- uncertainty for each component. */
  uncertainty: { staff: number; otps: number; oneTime: number; revenue: number };
  fundingSource: "City funds" | "City and federal funds" | "City and state funds" | "Federal funds" | "State funds";
  preparedBy: string;
  notes: string;
}

/** Typical full-time salaries. Assumptions for a first estimate; replace with the agency's actual title rates. */
export const SALARY_ASSUMPTIONS: { title: string; salary: number }[] = [
  { title: "Inspector", salary: 72_000 },
  { title: "Supervising inspector", salary: 92_000 },
  { title: "Caseworker", salary: 66_000 },
  { title: "Program manager", salary: 98_000 },
  { title: "Policy or data analyst", salary: 85_000 },
  { title: "Attorney", salary: 105_000 },
  { title: "Clerical associate", salary: 52_000 },
  { title: "IT project manager", salary: 125_000 },
];

export const DEFAULT_FRINGE = 0.55;

let seq = 0;
export const staffId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function blankInput(): FiscalInput {
  const fy = fiscalYearOf();
  return {
    title: "",
    billNumber: "",
    agency: "",
    sponsor: "",
    summary: "",
    effectiveDate: `${fy}-01-01`,
    staff: [],
    fringeRate: DEFAULT_FRINGE,
    firstYearHiring: 0.5,
    annualOtps: 0,
    oneTime: 0,
    annualRevenue: 0,
    collectionRate: 0.85,
    salaryGrowth: 0.03,
    otpsGrowth: 0.025,
    uncertainty: { staff: 0.1, otps: 0.25, oneTime: 0.3, revenue: 0.4 },
    fundingSource: "City funds",
    preparedBy: "",
    notes: "",
  };
}

export interface FiscalTemplate {
  id: string;
  name: string;
  description: string;
  build: () => FiscalInput;
}

export const TEMPLATES: FiscalTemplate[] = [
  {
    id: "inspection",
    name: "New inspection program",
    description: "Inspectors and supervisors, vehicles, and fines collected from violations.",
    build: () => ({
      ...blankInput(),
      title: "A Local Law to require annual inspections of [facility type]",
      agency: "DOB",
      summary: "Requires the agency to inspect every covered facility once a year and to issue violations for non-compliance.",
      staff: [
        { id: staffId(), title: "Inspector", fte: 12, salary: 72_000 },
        { id: staffId(), title: "Supervising inspector", fte: 2, salary: 92_000 },
        { id: staffId(), title: "Clerical associate", fte: 1, salary: 52_000 },
      ],
      annualOtps: 250_000,
      oneTime: 480_000,
      annualRevenue: 600_000,
    }),
  },
  {
    id: "reporting",
    name: "Reporting requirement",
    description: "Analysts to compile and publish a recurring report, plus a one-time data system.",
    build: () => ({
      ...blankInput(),
      title: "A Local Law to require an annual report on [topic]",
      agency: "OTI",
      summary: "Requires the agency to publish an annual report and post the underlying data on the Open Data portal.",
      staff: [{ id: staffId(), title: "Policy or data analyst", fte: 2, salary: 85_000 }],
      annualOtps: 50_000,
      oneTime: 150_000,
      uncertainty: { staff: 0.1, otps: 0.3, oneTime: 0.4, revenue: 0 },
    }),
  },
  {
    id: "service",
    name: "Service expansion",
    description: "Caseworkers plus contracted providers to serve more residents.",
    build: () => ({
      ...blankInput(),
      title: "A Local Law to expand [service] to all eligible residents",
      agency: "DSS",
      summary: "Expands eligibility for the program and requires the agency to contract with community providers.",
      staff: [
        { id: staffId(), title: "Caseworker", fte: 25, salary: 66_000 },
        { id: staffId(), title: "Program manager", fte: 2, salary: 98_000 },
      ],
      annualOtps: 2_500_000,
      oneTime: 300_000,
      fundingSource: "City and state funds",
      uncertainty: { staff: 0.1, otps: 0.3, oneTime: 0.3, revenue: 0 },
    }),
  },
];

export interface FiscalYearRow {
  fy: number;
  /** Share of the year the law is in effect. */
  activeShare: number;
  staffCost: number;
  otps: number;
  oneTime: number;
  revenue: number;
  expenditures: number;
  net: number;
  netLow: number;
  netHigh: number;
  fte: number;
}

export interface FiscalResult {
  enactmentFy: number;
  rows: FiscalYearRow[];
  totalFte: number;
  annualSalaryBase: number;
  /** The three columns of a Fiscal Impact Statement. */
  statement: {
    effective: FiscalYearRow;
    succeeding: FiscalYearRow;
    full: FiscalYearRow;
  };
  fiveYearNet: number;
  fiveYearLow: number;
  fiveYearHigh: number;
}

/** Share of the city fiscal year (July 1 - June 30) remaining from a date. */
export function remainingShare(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 1;
  const fy = fiscalYearOf(d);
  const end = new Date(fy, 5, 30); // June 30 of FY
  const start = new Date(fy - 1, 6, 1); // July 1 of the prior calendar year
  const total = end.getTime() - start.getTime();
  return Math.min(1, Math.max(0, (end.getTime() - d.getTime()) / total));
}

export function computeFiscal(input: FiscalInput, years = 5): FiscalResult {
  const effective = input.effectiveDate || `${fiscalYearOf()}-07-01`;
  const enactmentFy = fiscalYearOf(new Date(`${effective}T00:00:00`));
  const share = remainingShare(effective);
  const totalFte = input.staff.reduce((s, l) => s + Math.max(0, l.fte), 0);
  const salaryBase = input.staff.reduce((s, l) => s + Math.max(0, l.fte) * Math.max(0, l.salary), 0);
  const u = input.uncertainty;
  const rows: FiscalYearRow[] = [];
  for (let i = 0; i < years; i++) {
    const fy = enactmentFy + i;
    const activeShare = i === 0 ? share : 1;
    // Hiring ramps: the first-year share in year one, fully staffed from year two.
    const staffing = i === 0 ? input.firstYearHiring : 1;
    const salaryFactor = (1 + input.salaryGrowth) ** i;
    const otpsFactor = (1 + input.otpsGrowth) ** i;
    const staffCost = salaryBase * (1 + input.fringeRate) * staffing * activeShare * salaryFactor;
    const otps = input.annualOtps * activeShare * otpsFactor;
    const oneTime = i === 0 ? input.oneTime : 0;
    const revenue = input.annualRevenue * input.collectionRate * activeShare * otpsFactor;
    const expenditures = staffCost + otps + oneTime;
    const net = expenditures - revenue;
    const netLow = staffCost * (1 - u.staff) + otps * (1 - u.otps) + oneTime * (1 - u.oneTime) - revenue * (1 + u.revenue);
    const netHigh = staffCost * (1 + u.staff) + otps * (1 + u.otps) + oneTime * (1 + u.oneTime) - revenue * (1 - u.revenue);
    rows.push({ fy, activeShare, staffCost, otps, oneTime, revenue, expenditures, net, netLow, netHigh, fte: totalFte * staffing });
  }
  return {
    enactmentFy,
    rows,
    totalFte,
    annualSalaryBase: salaryBase,
    statement: { effective: rows[0], succeeding: rows[1] ?? rows[0], full: rows[1] ?? rows[0] },
    fiveYearNet: rows.reduce((s, r) => s + r.net, 0),
    fiveYearLow: rows.reduce((s, r) => s + r.netLow, 0),
    fiveYearHigh: rows.reduce((s, r) => s + r.netHigh, 0),
  };
}

/** Written method paragraph for the statement. */
export function methodText(input: FiscalInput, r: FiscalResult): string {
  const parts: string[] = [];
  if (r.totalFte > 0) {
    parts.push(
      `Personnel costs assume ${r.totalFte} full-time positions with combined salaries of $${Math.round(r.annualSalaryBase).toLocaleString("en-US")} a year, plus fringe benefits at ${Math.round(input.fringeRate * 100)}% of salary. ${Math.round(input.firstYearHiring * 100)}% of positions are assumed filled in the first year, with full staffing from the second year. Salaries grow ${(input.salaryGrowth * 100).toFixed(1)}% a year.`,
    );
  }
  if (input.annualOtps > 0) parts.push(`Other than personal services (contracts, supplies) are estimated at $${Math.round(input.annualOtps).toLocaleString("en-US")} a year, growing ${(input.otpsGrowth * 100).toFixed(1)}% a year.`);
  if (input.oneTime > 0) parts.push(`One-time costs of $${Math.round(input.oneTime).toLocaleString("en-US")} fall in the year of enactment.`);
  if (input.annualRevenue !== 0)
    parts.push(`Revenue of $${Math.round(Math.abs(input.annualRevenue)).toLocaleString("en-US")} a year is ${input.annualRevenue > 0 ? "expected" : "lost"}, with ${Math.round(input.collectionRate * 100)}% assumed collected.`);
  parts.push(
    `Costs in the year the law takes effect are prorated for the ${Math.round(r.rows[0].activeShare * 100)}% of the fiscal year remaining after the effective date. The range reflects uncertainty of ±${Math.round(input.uncertainty.staff * 100)}% on personnel, ±${Math.round(input.uncertainty.otps * 100)}% on contracts, ±${Math.round(input.uncertainty.oneTime * 100)}% on one-time costs and ±${Math.round(input.uncertainty.revenue * 100)}% on revenue.`,
  );
  return parts.join(" ");
}
