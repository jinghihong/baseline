// Published figures Baseline cites, each tied to its source document. Nothing here is estimated by Baseline.
// When a figure is updated, change it here and the whole app picks it up.

export interface Citation {
  id: string;
  title: string;
  publisher: string;
  date: string; // ISO
  url: string;
}

export const CITATIONS = {
  aimsAudit: {
    id: "aimsAudit",
    title: "Audit of OMB's Asset Information Management System (AIMS) report",
    publisher: "NYC Comptroller",
    date: "2024-03-15",
    url: "https://comptroller.nyc.gov/newsroom/audit-new-york-city-is-failing-to-accurately-identify-its-infrastructure-repair-needs/",
  },
  betterAims: {
    id: "betterAims",
    title: "The Need for Better AIMS",
    publisher: "NYC Comptroller",
    date: "2024-03-15",
    url: "https://comptroller.nyc.gov/reports/the-need-for-the-better-aims",
  },
  dinapoli2024: {
    id: "dinapoli2024",
    title: "DiNapoli: Better Reporting and Monitoring of NYC Capital Projects Needed",
    publisher: "NY State Comptroller",
    date: "2024-04-05",
    url: "https://www.osc.ny.gov/press/releases/2024/04/dinapoli-better-reporting-and-monitoring-nyc-capital-projects-needed",
  },
  ddcAudit: {
    id: "ddcAudit",
    title: "Audit of DDC's Mitigation of Delays and Cost Overruns on Capital Construction Projects (SE23-073A)",
    publisher: "NYC Comptroller",
    date: "2025-12-26",
    url: "https://comptroller.nyc.gov/wp-content/uploads/2026/02/SE23-073A.pdf",
  },
  flyingBlind: {
    id: "flyingBlind",
    title: "Flying Blind on Billions: How Weak Capital Data Undermines NYC's Infrastructure Investments (Fiscal Note 8-2025)",
    publisher: "NYC Comptroller",
    date: "2025-12-05",
    url: "https://comptroller.nyc.gov/wp-content/uploads/documents/Capital-Data-Fiscal-Note-12.5.25.pdf",
  },
  fy27Adopted: {
    id: "fy27Adopted",
    title: "Comments on New York City's Fiscal Year 2027 Adopted Budget",
    publisher: "NYC Comptroller",
    date: "2026-08-12",
    url: "https://comptroller.nyc.gov/reports/comments-on-new-york-citys-fiscal-year-2027-adopted-budget/",
  },
  fy26Adopted: {
    id: "fy26Adopted",
    title: "Comments on New York City's Fiscal Year 2026 Adopted Budget",
    publisher: "NYC Comptroller",
    date: "2025-08-01",
    url: "https://comptroller.nyc.gov/reports/comments-on-new-york-citys-fiscal-year-2026-adopted-budget/",
  },
  fy26Prelim: {
    id: "fy26Prelim",
    title: "Comments on New York City's Preliminary Budget for FY2026 and Financial Plan FY2025-2029",
    publisher: "NYC Comptroller",
    date: "2025-03-01",
    url: "https://comptroller.nyc.gov/wp-content/uploads/documents/Comments-on-NYCs-Preliminary-Budget-for-FY-2026-and-Financial-Plan-for-Fiscal-Years-2025-2029-1.pdf",
  },
  councilAiHearing: {
    id: "councilAiHearing",
    title: "Leading AI companies fail to impress at City Council AI hearing",
    publisher: "Route Fifty",
    date: "2026-10-05",
    url: "https://www.route-fifty.com/artificial-intelligence/2026/10/leading-ai-companies-fail-impress-city-council-ai-hearing/416435/",
  },
  censusGov: {
    id: "censusGov",
    title: "Local Governments in the U.S.: A Breakdown by Number and Type",
    publisher: "Federal Reserve Bank of St. Louis (2022 Census of Governments)",
    date: "2024-03-01",
    url: "https://www.stlouisfed.org/publications/regional-economist/2024/march/local-governments-us-number-type",
  },
} satisfies Record<string, Citation>;

export type CitationId = keyof typeof CITATIONS;

// ---- AIMS: the asset report ------------------------------------------------------------------------
export const AIMS_FACTS = {
  assets: 5093,
  needFy24to27: 14.1e9,
  needFy28to33: 14.4e9,
  annualCost: 4e6,
  riverside: { project: "Riverside Park Bridge at the W. 79th Street Traffic Circle", aimsEstimate: 76e6, estimateYear: 2020, bid: 149.9e6 },
  unreportedConditions: { conditions: 57, assets: 10 },
  surveyMinutes: { fdnyMinutes: 20, fdnySqft: 6164, schoolMinutes: 36, schoolSqft: 105000 },
  emergencyProcurements: 150e6,
  cite: "aimsAudit" as CitationId,
};

// ---- Capital delivery --------------------------------------------------------------------------------
export const CAPITAL_FACTS = {
  dinapoli: {
    projects: 5128,
    delayedShare: 0.64,
    overBudgetShare: 0.5,
    overBy20Share: 0.4,
    extraPlannedSpending: 54.5e9,
    excludedCommitments: 73.9e9,
    excludedShare: 0.472,
    cite: "dinapoli2024" as CitationId,
  },
  ddc: {
    lateShare: 0.8,
    lateProjects: 877,
    avgDelayDays: 1265,
    sampleProjects: 18,
    sampleStart: 4.14e9,
    sampleNow: 4.51e9,
    extrapolatedIncrease: 870e6,
    extrapolatedPct: 0.091,
    cite: "ddcAudit" as CitationId,
  },
  dashboard: {
    fmsIdCoverage: 0.468,
    commitmentCoverage: 0.581,
    commitmentGrowth: 0.139,
    liquidationGrowth: 0.166,
    cite: "flyingBlind" as CitationId,
  },
};

// ---- FY2027 adopted budget: Comptroller vs OMB -------------------------------------------------------
// Table 4 of the Comptroller's FY2027 Adopted Budget comments, $ millions. Negative = adds to the gap.
export const FY27_YEARS = [2027, 2028, 2029, 2030] as const;

export interface RiskItem {
  id: string;
  label: string;
  kind: "expense" | "revenue" | "offset";
  values: [number, number, number, number];
  note?: string;
}

export const FY27_EXPENSE_RISKS: RiskItem[] = [
  { id: "overtime", label: "Overtime", kind: "expense", values: [-589, -511, -511, -547], note: "Overtime is budgeted below recent spending every year." },
  { id: "mta", label: "Contributions to the MTA", kind: "expense", values: [-213, -42, -105, -125] },
  { id: "para", label: "DOE paraprofessional payments", kind: "expense", values: [-350, 0, 0, 0] },
  { id: "childcare", label: "Child care vouchers", kind: "expense", values: [0, -490, -608, -608] },
  { id: "twoK", label: "Early childhood education (2-K)", kind: "expense", values: [0, 0, -425, -425] },
  { id: "asylum", label: "Asylum seeker expenses", kind: "expense", values: [139, -238, -31, 117] },
  { id: "snap", label: "Federal SNAP administration funding cut", kind: "expense", values: [-75, -100, -100, -100] },
  { id: "immigration", label: "Immigration legal services", kind: "expense", values: [0, -63, -63, -63] },
  { id: "pension", label: "Pension bills", kind: "expense", values: [-76, -60, -60, -62] },
  { id: "temps", label: "Temporary and professional services", kind: "expense", values: [-50, -95, -95, -100] },
  { id: "payables", label: "Prior-year payable adjustment", kind: "offset", values: [0, 400, 400, 400] },
  { id: "returns", label: "Pension investment returns", kind: "offset", values: [0, 65, 200, 329] },
];

export const FY27_REVENUE_DIFF = { total: [472, 324, 1737, 2861], tax: [485, 431, 1838, 2963] } as const;
export const FY27_OMB_GAP = [0, -6440, -8207, -8516] as const;
export const FY27_COMPTROLLER_GAP = [-743, -7250, -7868, -6839] as const;
export const FY27_UNSUBSTANTIATED_SAVINGS = [-668, -586, -559, -547] as const;
export const FY27_GAP_WITH_SAVINGS_RISK = [-1411, -7836, -8427, -7386] as const;

export const BUDGET_FACTS = {
  fy27Adopted: 125.84e9,
  fy27GeneralReserve: 450e6,
  fy27OmbTax: 88.674e9,
  fy27ComptrollerTax: 89.159e9,
  fy26OvertimeEstimate: 2.58e9,
  fy26OvertimeShortfall: 911e6,
  chronicUnderbudgetingAvg: 3.75e9,
  cite: "fy27Adopted" as CitationId,
};

// ---- Market ------------------------------------------------------------------------------------------
export const MARKET_FACTS = {
  localGovernments: 90837,
  municipalGovernments: 19491,
  townshipGovernments: 16214,
  cite: "censusGov" as CitationId,
};

export interface Competitor {
  name: string;
  what: string;
  aiAngle: string;
  gap: string;
}

export const COMPETITORS: Competitor[] = [
  {
    name: "OpenGov",
    what: "Cloud suite for budgeting, permitting, procurement and asset management; reports 1,900+ public-sector customers; majority-owned by Cox Enterprises.",
    aiAngle: "AI forecasting from historical actuals, OG Assist, scenario builder for asset backlogs.",
    gap: "Sold to the finance department. Forecasts the city's own trend lines, not the gap between what was adopted and what gets spent.",
  },
  {
    name: "ClearGov",
    what: "Budget-book and transparency software for local governments and school districts.",
    aiAngle: "ClearGov AI (Sept 2025): drafts budget-book narrative and grades books against GFOA award criteria.",
    gap: "Helps produce the document. Does not test whether the numbers in it will hold.",
  },
  {
    name: "Euna Solutions (Questica)",
    what: "Public-sector budgeting, payments, procurement and grants software.",
    aiAngle: "Euna AI (2026): plain-language budget book search and workflow automation.",
    gap: "Workflow and search. No capital cost forecasting from the city's own project history.",
  },
  {
    name: "Tyler Technologies",
    what: "ERP and records systems used by thousands of local governments.",
    aiAngle: "Machine-learning budgeting pitched to cities such as National City, CA, whose council did not approve a $250K contract without a clearer cost-benefit case.",
    gap: "Bundled into the ERP; long sales cycles; councils see it as the executive's tool.",
  },
  {
    name: "Meeting AI (CitizenPortal, citymeetings.nyc)",
    what: "Transcribe and summarize public meetings.",
    aiAngle: "Searchable hearing summaries.",
    gap: "Tells you what was said, not whether the numbers were right.",
  },
];
