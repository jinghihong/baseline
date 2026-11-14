// Council district view: decode award district codes, roll up awards, compare 311 demand with the average district.
import type { CouncilAward, DemandData } from "../data/types";
import { mean } from "../lib/stats";

export const DISTRICTS = Array.from({ length: 51 }, (_, i) => i + 1);

export function districtBorough(d: number): string {
  if (d >= 1 && d <= 10) return "Manhattan";
  if (d <= 18) return "Bronx";
  if (d <= 32) return "Queens";
  if (d <= 48) return "Brooklyn";
  if (d <= 51) return "Staten Island";
  return "Citywide";
}

const DELEGATIONS: Record<number, string> = {
  90: "LGBT Caucus",
  91: "Bronx Delegation",
  92: "Brooklyn Delegation",
  93: "Manhattan Delegation",
  94: "Queens Delegation",
  95: "Staten Island Delegation",
  97: "Black, Latino and Asian Caucus",
  98: "Women's Caucus",
  99: "Technical adjustments",
};

export interface DecodedDistrict {
  members: number[];
  speaker: boolean;
  groups: string[];
}

/**
 * The Council capital dataset encodes joint allocations by joining two-digit codes: "2125" is districts 21 and 25,
 * "1400" is district 14 plus a Speaker allocation (00), "193" is district 1 plus the Manhattan Delegation (93).
 */
export function decodeDistrictCode(code: number | null): DecodedDistrict {
  const out: DecodedDistrict = { members: [], speaker: false, groups: [] };
  if (code === null || !Number.isFinite(code)) return out;
  const parts = code >= 100 ? [Math.floor(code / 100), code % 100] : [code];
  for (const p of parts) {
    if (p === 0) out.speaker = true;
    else if (p >= 1 && p <= 51) out.members.push(p);
    else if (DELEGATIONS[p]) out.groups.push(DELEGATIONS[p]);
  }
  return out;
}

/** Plain-language category for a capital budget line prefix (e.g. "E" schools, "P" parks). */
const LINE_PREFIX: [RegExp, string][] = [
  [/^E\b|^E /, "Schools"],
  [/^P\b|^P /, "Parks"],
  [/^HW/, "Streets & highways"],
  [/^HB/, "Bridges"],
  [/^T|^TF/, "Traffic & transit"],
  [/^PV/, "Cultural institutions"],
  [/^L[NBQ]/, "Libraries"],
  [/^HH/, "Health + Hospitals"],
  [/^HL/, "Public health"],
  [/^HN/, "CUNY"],
  [/^HD|^HO/, "Housing"],
  [/^AG/, "Senior services"],
  [/^PO/, "Police"],
  [/^F/, "Fire"],
  [/^S[EW]?/, "Sanitation & sewers"],
  [/^W/, "Water"],
  [/^ED/, "Economic development"],
  [/^PW/, "Public buildings"],
  [/^CS/, "Children's services"],
  [/^HR/, "Social services"],
  [/^C/, "Correction & courts"],
];

export function lineCategory(budgetLine: string | null): string {
  const s = String(budgetLine ?? "").trim().toUpperCase();
  if (!s) return "Other";
  for (const [re, label] of LINE_PREFIX) if (re.test(s)) return label;
  return "Other";
}

export interface DistrictAward extends CouncilAward {
  shared: boolean;
  category: string;
}

export function awardsForDistrict(awards: CouncilAward[], district: number): DistrictAward[] {
  const out: DistrictAward[] = [];
  for (const a of awards) {
    const d = decodeDistrictCode(a.district);
    if (!d.members.includes(district)) continue;
    out.push({ ...a, shared: d.members.length > 1 || d.groups.length > 0 || (a.district ?? 0) >= 100, category: lineCategory(a.budgetLine) });
  }
  return out.sort((x, y) => y.award - x.award);
}

export interface AwardSummary {
  total: number;
  count: number;
  byFy: { fy: string; total: number; count: number }[];
  byCategory: { category: string; total: number; count: number }[];
  sponsors: string[];
}

export function summarizeAwards(list: DistrictAward[], fiscalYears: string[]): AwardSummary {
  const byFy = fiscalYears.map((fy) => {
    const rows = list.filter((a) => a.fy === fy);
    return { fy, total: rows.reduce((s, a) => s + a.award, 0), count: rows.length };
  });
  const cats = new Map<string, { total: number; count: number }>();
  for (const a of list) {
    const c = cats.get(a.category) ?? { total: 0, count: 0 };
    c.total += a.award;
    c.count++;
    cats.set(a.category, c);
  }
  const sponsors = [...new Set(list.map((a) => a.sponsor).filter(Boolean) as string[])];
  return {
    total: list.reduce((s, a) => s + a.award, 0),
    count: list.length,
    byFy,
    byCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total),
    sponsors,
  };
}

/** The sponsor most often named on a district's own (unshared) awards in the latest year: usually its Council Member. */
export function likelyMember(list: DistrictAward[], latestFy: string): string | null {
  const counts = new Map<string, number>();
  for (const a of list) {
    if (a.fy !== latestFy || a.shared || !a.sponsor) continue;
    for (const name of a.sponsor.split(",").map((s) => s.trim())) {
      if (!name || /speaker|delegation|caucus/i.test(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

export interface DistrictDemandRow {
  type: string;
  label: string;
  agency: string;
  district: number;
  average: number;
  /** District count / average district count. 1 = typical. */
  index: number;
  prior: number | null;
  change: number | null;
}

/** 311 requests for a district in `year` versus the average district, plus change from the year before. */
export function districtDemand(data: DemandData, district: number, year: number): DistrictDemandRow[] {
  const rows: DistrictDemandRow[] = [];
  for (const t of data.types) {
    const counts = Object.values(data.districts).map((d) => d[t.type]?.[String(year)] ?? 0);
    const average = mean(counts);
    const own = data.districts[String(district)]?.[t.type] ?? {};
    const value = own[String(year)] ?? 0;
    const prior = own[String(year - 1)] ?? null;
    rows.push({
      type: t.type,
      label: t.label,
      agency: t.agency,
      district: value,
      average,
      index: average > 0 ? value / average : 0,
      prior,
      change: prior && prior > 0 ? value / prior - 1 : null,
    });
  }
  return rows.sort((a, b) => b.index - a.index);
}

/** Years present in the district 311 data, ascending. */
export function demandYears(data: DemandData): number[] {
  const ys = new Set<number>();
  for (const d of Object.values(data.districts)) for (const t of Object.values(d)) for (const y of Object.keys(t)) ys.add(Number(y));
  return [...ys].sort((a, b) => a - b);
}
