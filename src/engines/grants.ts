// Grant finder: classify federal opportunities, filter them, and match them to capital projects by asset class.
import type { CapitalProject, GrantOpportunity, GrantTheme } from "../data/types";

export type GrantKind = "program" | "research" | "international";

const RESEARCH_AGENCY = /National Institutes of Health|National Institute of Justice|National Science Foundation|Food and Drug Administration|National Endowment for the Humanities/i;
const RESEARCH_TITLE = /\bresearch\b|\bevaluation\b|clinical trial|\b(R0[13]|R21|R34|R61|U01|U24|K99|F3[12]|T32|P50)\b/i;
const INTERNATIONAL = /U\.S\. Mission|Embassy|Consulate|USAID/i;

/** Program grants fund city work. Research grants mostly fund universities. International ones are rarely relevant. */
export function grantKind(o: GrantOpportunity): GrantKind {
  if (INTERNATIONAL.test(o.agency)) return "international";
  if (RESEARCH_AGENCY.test(o.agency) || RESEARCH_TITLE.test(o.title)) return "research";
  return "program";
}

const CITY_WORDS = /\b(local|municipal|city|community|infrastructure|transportation|safety|housing|resilien|water|energy|emergency|youth|justice assistance|JAG|highway|transit|broadband|brownfield|workforce|homeless|park)/gi;

/** Higher = more likely to matter to a city budget office. Used for the default sort. */
export function relevanceScore(o: GrantOpportunity): number {
  const kind = grantKind(o);
  let score = kind === "program" ? 10 : kind === "research" ? 2 : 0;
  score += Math.min(6, (o.title.match(CITY_WORDS) ?? []).length * 2);
  score += Math.min(3, o.themes.length);
  if (o.status === "posted") score += 1;
  return score;
}

export function daysUntil(isoDate: string | null, today: Date = new Date()): number | null {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T23:59:59`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

export type Urgency = "closing" | "soon" | "open" | "unknown";

export function urgency(days: number | null): Urgency {
  if (days === null) return "unknown";
  if (days <= 7) return "closing";
  if (days <= 30) return "soon";
  return "open";
}

export interface GrantFilters {
  query: string;
  theme: string; // "" = all
  agency: string; // "" = all
  status: "all" | "posted" | "forecasted";
  closingWithin: number | null; // days
  includeResearch: boolean;
  savedOnly: boolean;
}

export const DEFAULT_FILTERS: GrantFilters = {
  query: "",
  theme: "",
  agency: "",
  status: "all",
  closingWithin: null,
  includeResearch: false,
  savedOnly: false,
};

export function filterGrants(list: GrantOpportunity[], f: GrantFilters, saved: Set<string>, today: Date = new Date()): GrantOpportunity[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((o) => {
    if (f.savedOnly && !saved.has(o.id)) return false;
    const kind = grantKind(o);
    if (kind === "international") return false;
    if (!f.includeResearch && kind === "research") return false;
    if (f.theme && !o.themes.includes(f.theme)) return false;
    if (f.agency && o.agency !== f.agency) return false;
    if (f.status !== "all" && o.status !== f.status) return false;
    if (f.closingWithin !== null) {
      const d = daysUntil(o.closeDate, today);
      if (d === null || d < 0 || d > f.closingWithin) return false;
    }
    if (q && !`${o.title} ${o.agency} ${o.number} ${o.aln.join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface ProjectMatch {
  classes: string[];
  projects: number;
  budget: number;
}

/** Count watchlist projects in the asset classes an opportunity's themes cover. */
export function buildClassIndex(projects: CapitalProject[]): Map<string, { count: number; budget: number }> {
  const idx = new Map<string, { count: number; budget: number }>();
  for (const p of projects) {
    const cur = idx.get(p.cls) ?? { count: 0, budget: 0 };
    cur.count++;
    cur.budget += p.budget;
    idx.set(p.cls, cur);
  }
  return idx;
}

export function matchProjects(o: GrantOpportunity, themes: GrantTheme[], classIndex: Map<string, { count: number; budget: number }>): ProjectMatch {
  const classes = [...new Set(o.themes.flatMap((t) => themes.find((x) => x.id === t)?.classes ?? []))];
  let projects = 0;
  let budget = 0;
  for (const c of classes) {
    const hit = classIndex.get(c);
    if (hit) {
      projects += hit.count;
      budget += hit.budget;
    }
  }
  return { classes, projects, budget };
}

export function sortGrants(list: GrantOpportunity[], by: "relevance" | "deadline" | "newest", today: Date = new Date()): GrantOpportunity[] {
  const copy = [...list];
  if (by === "deadline") {
    return copy.sort((a, b) => (daysUntil(a.closeDate, today) ?? 1e9) - (daysUntil(b.closeDate, today) ?? 1e9));
  }
  if (by === "newest") return copy.sort((a, b) => (b.openDate ?? "").localeCompare(a.openDate ?? ""));
  return copy.sort((a, b) => relevanceScore(b) - relevanceScore(a) || (daysUntil(a.closeDate, today) ?? 1e9) - (daysUntil(b.closeDate, today) ?? 1e9));
}

// ---- Saved grants (per browser) ----------------------------------------------------------------------
const SAVED_KEY = "baseline:grants-saved";

export function loadSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function storeSaved(ids: string[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be blocked; the list still works for this session.
  }
}
