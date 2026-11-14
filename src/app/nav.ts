// Navigation for both workspaces. Each role sees the same tools, grouped and ordered around its own jobs.
import {
  Calculator,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  Gavel,
  Gauge,
  HandCoins,
  House,
  Landmark,
  ChartLine,
  MapPin,
  MessageSquareText,
  PhoneCall,
  Scale,
  Settings,
  Timer,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../state/store";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** One line shown in the command palette and page headers. */
  blurb: string;
  keywords?: string;
}

export const NAV: Record<string, NavItem> = {
  home: { path: "/app", label: "Home", icon: House, blurb: "Your briefing: what changed and what needs attention." },
  forecaster: { path: "/app/forecaster", label: "Cost forecaster", icon: Calculator, blurb: "Price a capital project from the city's own track record.", keywords: "estimate capital reference class p80" },
  watchlist: { path: "/app/watchlist", label: "Project watchlist", icon: ClipboardList, blurb: "Every capital project against its first published budget and date.", keywords: "capital overrun delay baseline" },
  maintenance: { path: "/app/maintenance", label: "Maintenance risk", icon: Wrench, blurb: "Rank assets by failure risk and fund the repairs that matter most.", keywords: "aims state of good repair asset backlog" },
  debt: { path: "/app/debt", label: "Debt & affordability", icon: Landmark, blurb: "What today's capital plan costs in future debt service.", keywords: "bonds borrowing debt service" },
  secondOpinion: { path: "/app/second-opinion", label: "Second opinion", icon: Scale, blurb: "Budget lines that are adopted too low, year after year.", keywords: "underbudget risk comptroller gap" },
  overtime: { path: "/app/overtime", label: "Overtime monitor", icon: Timer, blurb: "Adopted vs actual overtime by agency, with next year's forecast.", keywords: "ot police fire correction" },
  tracker: { path: "/app/spend-tracker", label: "Spend tracker", icon: Gauge, blurb: "Project year-end spending from monthly actuals.", keywords: "variance year-end run rate" },
  scenarios: { path: "/app/scenarios", label: "Gap scenarios", icon: ChartLine, blurb: "Stress-test the out-year budget gap.", keywords: "revenue recession forecast gap" },
  hearings: { path: "/app/hearings", label: "Hearing prep", icon: Gavel, blurb: "A data-backed brief and questions for any agency hearing.", keywords: "council questions commissioner" },
  fiscalNotes: { path: "/app/fiscal-notes", label: "Fiscal notes", icon: FileSpreadsheet, blurb: "Estimate what a proposed bill will cost.", keywords: "bill legislation cost estimate intro" },
  district: { path: "/app/district", label: "District view", icon: MapPin, blurb: "Capital awards, projects and 311 demand for one district.", keywords: "council member district awards" },
  demand: { path: "/app/demand", label: "311 demand", icon: PhoneCall, blurb: "Service demand trends and forecasts tied to budget lines.", keywords: "complaints potholes heat" },
  grants: { path: "/app/grants", label: "Grant finder", icon: HandCoins, blurb: "Open federal funding matched to the city's projects.", keywords: "federal funding grants.gov" },
  ask: { path: "/app/ask", label: "Ask Baseline", icon: MessageSquareText, blurb: "Ask a question about the budget and get an answer with sources.", keywords: "ai chat analyst claude" },
  reports: { path: "/app/reports", label: "Reports", icon: FileText, blurb: "Printable briefs for meetings, hearings and memos.", keywords: "export pdf memo" },
  data: { path: "/app/data", label: "Data & imports", icon: Database, blurb: "Where every number comes from, and how to add your own.", keywords: "sources csv upload" },
  settings: { path: "/app/settings", label: "Settings", icon: Settings, blurb: "Workspace, AI connection and theme.", keywords: "api key theme export" },
};

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  budget: [
    { label: "", items: [NAV.home] },
    { label: "Plan & price", items: [NAV.forecaster, NAV.watchlist, NAV.maintenance, NAV.debt] },
    { label: "Budget risk", items: [NAV.secondOpinion, NAV.overtime, NAV.tracker, NAV.scenarios] },
    { label: "Demand & funding", items: [NAV.demand, NAV.grants] },
    { label: "Council side", items: [NAV.hearings, NAV.fiscalNotes, NAV.district] },
    { label: "Workspace", items: [NAV.ask, NAV.reports, NAV.data, NAV.settings] },
  ],
  council: [
    { label: "", items: [NAV.home] },
    { label: "Oversight", items: [NAV.secondOpinion, NAV.hearings, NAV.fiscalNotes, NAV.watchlist] },
    { label: "Your district", items: [NAV.district, NAV.demand] },
    { label: "Check the numbers", items: [NAV.overtime, NAV.scenarios, NAV.forecaster, NAV.maintenance] },
    { label: "Funding", items: [NAV.grants, NAV.debt, NAV.tracker] },
    { label: "Workspace", items: [NAV.ask, NAV.reports, NAV.data, NAV.settings] },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  budget: "Budget office",
  council: "City council",
};

export const ROLE_TAGLINE: Record<Role, string> = {
  budget: "Build a budget that holds: honest project prices, early warnings, fewer mid-year surprises.",
  council: "Check the mayor's numbers: independent forecasts, sharper hearings, cost estimates for every bill.",
};
