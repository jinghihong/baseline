// Built-in analyst: answers common budget questions straight from the datasets, offline, with sources.
// Also builds the compact "context pack" that grounds Claude when the user connects an API key.
import { CITATIONS, AIMS_FACTS, BUDGET_FACTS, CAPITAL_FACTS, FY27_COMPTROLLER_GAP, FY27_EXPENSE_RISKS, FY27_OMB_GAP, FY27_REVENUE_DIFF, FY27_YEARS, type CitationId } from "../data/curated";
import type { BudgetLinesData, CapitalData, DemandData, GrantsData, OvertimeData, ReferenceData } from "../data/types";
import { agencyName } from "../data/agencies";
import { date, duration, fy, money, num, pct } from "../lib/format";
import { median, quantile } from "../lib/stats";
import { assessAllLines, assessAllOvertime, assessAllProjects, summarizeCapital, type ProjectAssessment } from "./core";

export interface AnalystData {
  overtime?: OvertimeData | null;
  capital?: CapitalData | null;
  budgetLines?: BudgetLinesData | null;
  reference?: ReferenceData | null;
  grants?: GrantsData | null;
  demand?: DemandData | null;
}

export type Intent =
  | "overtime"
  | "capital"
  | "delays"
  | "budgetLines"
  | "gap"
  | "revenue"
  | "maintenance"
  | "grants"
  | "demand"
  | "estimate"
  | "help"
  | "unknown";

export interface AnswerSource {
  label: string;
  url: string;
}

export interface AnalystAnswer {
  intent: Intent;
  text: string;
  sources: AnswerSource[];
  followUps: string[];
}

export interface ParsedQuestion {
  intent: Intent;
  agency: string | null;
  boro: string | null;
  assetClass: string | null;
  demandType: string | null;
  grantTheme: string | null;
}

export const SUGGESTED_QUESTIONS = [
  "How much will NYPD overtime run over budget next year?",
  "Which agencies have the most capital projects over budget?",
  "Which DOT projects slipped the most?",
  "Which budget lines are adopted too low every year?",
  "What is the out-year budget gap?",
  "What went wrong with AIMS?",
  "Which federal grants for water infrastructure close soon?",
  "Are pothole complaints going up?",
  "How much does a bridge project usually run over?",
];

// ---- Parsing ---------------------------------------------------------------------------------------
const AGENCY_PATTERNS: [string, RegExp][] = [
  ["NYPD", /\b(nypd|police)\b/],
  ["FDNY", /\b(fdny|fire department|firefighters?|ems)\b/],
  ["DOC", /\b(doc|correction|corrections|jails?|rikers)\b/],
  ["DSNY", /\b(dsny|sanitation)\b/],
  ["DOT", /\b(dot|transportation)\b/],
  ["DEP", /\b(dep|environmental protection)\b/],
  ["DPR", /\b(dpr|parks department|parks dept|parks and recreation)\b/],
  ["DSS", /\b(dss|hra|social services|human resources administration)\b/],
  ["DHS", /\b(dhs|homeless services)\b/],
  ["ACS", /\b(acs|children'?s services)\b/],
  ["DOE", /\b(doe|department of education|education department)\b/],
  ["DCAS", /\b(dcas|citywide administrative)\b/],
  ["DOHMH", /\b(dohmh|health department|health and mental hygiene)\b/],
  ["DDC", /\b(ddc|design and construction)\b/],
  ["HPD", /\b(hpd|housing preservation)\b/],
  ["NYCHA", /\b(nycha|housing authority)\b/],
  ["HHC", /\b(h\+h|hhc|health \+ hospitals|health and hospitals|public hospitals?)\b/],
  ["CUNY", /\b(cuny|city university)\b/],
  ["LIB", /\b(librar(y|ies))\b/],
  ["EDC", /\b(edc|economic development)\b/],
];

const BORO_PATTERNS: [string, RegExp][] = [
  ["Manhattan", /\bmanhattan\b/],
  ["Bronx", /\bbronx\b/],
  ["Brooklyn", /\bbrooklyn\b/],
  ["Queens", /\bqueens\b/],
  ["Staten Island", /\bstaten island\b/],
];

const CLASS_PATTERNS: [string, RegExp][] = [
  ["bridges", /\bbridges?\b/],
  ["parks", /\b(parks?|playgrounds?|pools?)\b/],
  ["streets", /\b(streets?|roads?|sidewalks?|street reconstruction)\b/],
  ["sewers", /\b(sewers?|stormwater)\b/],
  ["water", /\b(water mains?|water supply)\b/],
  ["plants", /\b(treatment plants?|wastewater plants?)\b/],
  ["schools", /\b(schools?|classrooms?)\b/],
  ["culture", /\b(librar(y|ies)|museums?)\b/],
  ["safety", /\b(police station|precincts?|firehouses?|fire stations?)\b/],
  ["social", /\b(shelters?|clinics?|senior centers?)\b/],
  ["housing", /\b(housing|apartments?)\b/],
  ["justice", /\b(courts?|courthouses?|jails?)\b/],
  ["waterfront", /\b(ferry|ferries|piers?|waterfront)\b/],
  ["lighting", /\b(street ?lights?|lamp ?posts?|traffic signals?)\b/],
  ["facilities", /\b(office buildings?|city buildings?|garages?)\b/],
];

const DEMAND_PATTERNS: [string, RegExp][] = [
  ["Street Condition", /\b(potholes?|street condition)\b/],
  ["Sidewalk Condition", /\bsidewalks?\b/],
  ["Street Light Condition", /\b(street ?lights?)\b/],
  ["Traffic Signal Condition", /\b(traffic signals?)\b/],
  ["Water System", /\b(water system|water main break|no water)\b/],
  ["Sewer", /\b(sewers?|catch basins?|backups?)\b/],
  ["HEAT/HOT WATER", /\b(heat|hot water)\b/],
  ["UNSANITARY CONDITION", /\b(unsanitary|mold)\b/],
  ["Dirty Condition", /\b(dirty|litter)\b/],
  ["Missed Collection", /\b(missed (trash|collection|pickup)|trash pickup)\b/],
  ["Rodent", /\b(rats?|rodents?|mice)\b/],
  ["Damaged Tree", /\b(trees?)\b/],
  ["Homeless Person Assistance", /\b(homeless (person|people|assistance))\b/],
  ["Noise - Residential", /\b(noise)\b/],
  ["Illegal Parking", /\b(illegal parking|parking)\b/],
];

const GRANT_THEME_PATTERNS: [string, RegExp][] = [
  ["water", /\b(water|wastewater|stormwater|sewer)\b/],
  ["transportation", /\b(transportation|transit|bridges?|roads?|streets?|safe streets)\b/],
  ["resilience", /\b(resilien\w*|flood\w*|hazard|climate adaptation)\b/],
  ["housing", /\b(housing|homeless\w*|community development)\b/],
  ["energy", /\b(energy|electric|ev|decarboni\w*)\b/],
  ["safety", /\b(public safety|police|law enforcement|justice|emergency)\b/],
  ["health", /\b(health|opioid|child care|behavioral)\b/],
  ["parks", /\b(parks?|recreation|libraries|arts|forestry)\b/],
  ["digital", /\b(broadband|cyber\w*|digital)\b/],
  ["workforce", /\b(workforce|jobs|small business|brownfields?|economic)\b/],
];

const INTENT_KEYWORDS: [Intent, RegExp, number][] = [
  ["overtime", /\b(overtime|over time|ot)\b/g, 3],
  ["delays", /\b(delay\w*|late|behind schedule|slip\w*|pushed back|on time|schedule)\b/g, 3],
  ["capital", /\b(capital|projects?|overruns?|over budget|cost growth|construction|grew)\b/g, 2],
  ["budgetLines", /\b(under-?budget\w*|chronic\w*|adopted too low|budget lines?|second opinion|modified|after adoption|lowball\w*)\b/g, 3],
  ["gap", /\b(gap|deficit|out-?years?|shortfall|balanced budget|financial plan)\b/g, 3],
  ["revenue", /\b(revenue|tax(es)?|income|collections)\b/g, 2],
  ["maintenance", /\b(aims|maintenance|state of good repair|deferred|asset (report|inventory|condition)|inspections?)\b/g, 3],
  ["grants", /\b(grants?|federal funding|funding opportunit\w*|grants\.gov|nofo)\b/g, 3],
  ["demand", /\b(311|complaints?|service requests?|potholes?|rodents?|rats?|heat|noise)\b/g, 3],
  ["estimate", /\b(how much (does|do|will|would|should) an?|usually (run|cost)|typical (overrun|cost)|estimate|price a|reference class)\b/g, 2],
  ["help", /\b(help|what can you|what do you know|how do you work)\b/g, 2],
];

const PRIORITY: Intent[] = ["overtime", "maintenance", "grants", "demand", "budgetLines", "delays", "estimate", "gap", "revenue", "capital", "help"];

export function parseQuestion(question: string): ParsedQuestion {
  const q = ` ${question.toLowerCase().replace(/[’']/g, "'")} `;
  const scores = new Map<Intent, number>();
  for (const [intent, re, weight] of INTENT_KEYWORDS) {
    const hits = q.match(re)?.length ?? 0;
    if (hits) scores.set(intent, (scores.get(intent) ?? 0) + hits * weight);
  }
  // "how much will NYPD overtime run over budget" is overtime, not capital.
  if (scores.has("overtime")) scores.set("capital", Math.max(0, (scores.get("capital") ?? 0) - 2));
  // An estimate question names an asset class.
  const assetClass = CLASS_PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null;
  if (scores.has("estimate") && !assetClass) scores.set("estimate", 0);
  let intent: Intent = "unknown";
  let best = 0;
  for (const i of PRIORITY) {
    const s = scores.get(i) ?? 0;
    if (s > best) {
      best = s;
      intent = i;
    }
  }
  return {
    intent,
    agency: AGENCY_PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null,
    boro: BORO_PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null,
    assetClass,
    demandType: DEMAND_PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null,
    grantTheme: GRANT_THEME_PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null,
  };
}

// ---- Helpers ---------------------------------------------------------------------------------------
const cite = (id: CitationId): AnswerSource => ({ label: `${CITATIONS[id].publisher}: ${CITATIONS[id].title}`, url: CITATIONS[id].url });
const metaSources = (meta?: { sources: { title: string; url: string; publisher: string }[] }): AnswerSource[] =>
  (meta?.sources ?? []).map((s) => ({ label: `${s.publisher}: ${s.title}`, url: s.url }));
const uniqueSources = (list: AnswerSource[]) => [...new Map(list.map((s) => [s.url, s])).values()];
const period = (p?: string | null) => (p ? date(p) : "the latest report");

function missing(what: string): AnalystAnswer {
  return {
    intent: "unknown",
    text: `The ${what} data hasn't loaded yet. Try again in a moment.`,
    sources: [],
    followUps: [],
  };
}

/**
 * Several dashboard rows can share one FMS budget ID and repeat the same budget. Count each budget once
 * when adding up dollars or listing the biggest increases.
 */
export function uniqueByFms(items: ProjectAssessment[]): ProjectAssessment[] {
  const seen = new Set<string>();
  const out: ProjectAssessment[] = [];
  for (const a of items) {
    const key = a.project.fmsId || a.project.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function projectLine(a: ProjectAssessment): string {
  const p = a.project;
  return `**${p.name}** (${p.agency}, ${p.boro}): ${money(p.firstBudget ?? p.budget)} → ${money(p.budget)} (${pct(a.growthPct, { sign: true })})`;
}

// ---- Answers ---------------------------------------------------------------------------------------
function answerOvertime(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.overtime) return missing("overtime");
  const all = assessAllOvertime(data.overtime);
  const sources = uniqueSources([...metaSources(data.overtime.meta), cite("fy27Adopted")]);
  const followUps = ["Which budget lines are adopted too low every year?", "What is the out-year budget gap?"];
  const target = parsed.agency ? all.find((a) => a.agency.code === parsed.agency) : null;
  if (parsed.agency && !target) {
    return {
      intent: "overtime",
      text: `I don't have matched overtime budget and payroll data for ${agencyName(parsed.agency)}. Agencies with data: ${all.map((a) => a.agency.code).join(", ")}.`,
      sources,
      followUps,
    };
  }
  if (target) {
    const a = target;
    const lines = [
      `**${a.agency.name} overtime, ${fy(a.latestActualFy)}:** ${money(a.latestActual)} actually paid against ${money(a.latestAdoptedForActualYear)} in the adopted budget (${a.latestRatio.toFixed(2)}× the adopted amount).`,
      `Actual overtime beat the adopted budget by 10% or more in **${a.yearsOver} of the last ${a.yearsAssessed} years**.`,
    ];
    if (a.nextAdopted !== null) {
      lines.push(
        `For ${fy(a.nextFy)}, the adopted overtime budget is ${money(a.nextAdopted)}. Baseline's estimate of actual spending is **${money(a.forecast)}** (80% range ${money(a.forecastLow)}–${money(a.forecastHigh)}), which implies a shortfall of about **${money(a.expectedShortfall)}**.`,
      );
    }
    lines.push(`_The estimate is a damped-trend forecast on eight years of actual overtime pay. All funds; the Comptroller's figures cover city funds, so the two won't match exactly._`);
    return { intent: "overtime", text: lines.join("\n\n"), sources, followUps: [`Which ${a.agency.code} capital projects are over budget?`, ...followUps] };
  }
  const fyLatest = Math.max(...all.map((a) => a.latestActualFy));
  const inYear = all.filter((a) => a.latestActualFy === fyLatest);
  const adopted = inYear.reduce((s, a) => s + a.latestAdoptedForActualYear, 0);
  const actual = inYear.reduce((s, a) => s + a.latestActual, 0);
  const shortfall = all.reduce((s, a) => s + Math.max(0, a.expectedShortfall ?? 0), 0);
  const top = [...all].sort((x, y) => (y.expectedShortfall ?? 0) - (x.expectedShortfall ?? 0)).slice(0, 5);
  const text = [
    `**Citywide overtime, ${fy(fyLatest)} (${inYear.length} agencies with matched data):** ${money(actual)} paid against ${money(adopted)} adopted, or ${(actual / adopted).toFixed(2)}× the adopted budget.`,
    `Adding up Baseline's agency forecasts, next year's overtime is likely to exceed the adopted budget by about **${money(shortfall)}** (estimate). The largest expected shortfalls:`,
    top.map((a) => `- **${a.agency.code}**: forecast ${money(a.forecast)} vs ${money(a.nextAdopted)} adopted (${money(a.expectedShortfall, { sign: true })})`).join("\n"),
    `For comparison, the NYC Comptroller estimates FY27 overtime will run **${money(589e6)}** above budget (city funds).`,
  ].join("\n\n");
  return { intent: "overtime", text, sources, followUps: ["How much will NYPD overtime run over budget next year?", ...followUps] };
}

function filterProjects(parsed: ParsedQuestion, data: AnalystData) {
  const all = assessAllProjects(data.capital!);
  return all.filter((a) => (!parsed.agency || a.project.agency === parsed.agency) && (!parsed.boro || a.project.boro === parsed.boro));
}

function scopeLabel(parsed: ParsedQuestion) {
  const parts = [parsed.agency ? agencyName(parsed.agency) : null, parsed.boro].filter(Boolean);
  return parts.length ? parts.join(", ") : "citywide";
}

function answerCapital(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.capital) return missing("capital projects");
  const items = filterProjects(parsed, data);
  const sources = uniqueSources([...metaSources(data.capital.meta), cite("dinapoli2024"), cite("ddcAudit")]);
  if (!items.length) return { intent: "capital", text: `No projects in the Capital Projects Dashboard match ${scopeLabel(parsed)}.`, sources, followUps: [] };
  const unique = uniqueByFms(items);
  const s = summarizeCapital(unique);
  const lines = [
    `**Capital projects, ${scopeLabel(parsed)}** (Capital Projects Dashboard, ${period(data.capital.meta.firstPeriod)} to ${period(data.capital.meta.latestPeriod)}): ${num(s.projects)} projects with ${money(s.totalBudget)} in total budgets (each budget ID counted once).`,
    `**${num(s.grownCount)} (${pct(s.grownCount / s.projects)})** now carry a budget above the first number the city published, adding **${money(s.totalGrowth)}**. ${num(s.over20Count)} are up 20% or more.`,
  ];
  if (!parsed.agency) {
    const byAgency = new Map<string, { growth: number; count: number }>();
    for (const a of unique) {
      const cur = byAgency.get(a.project.agency) ?? { growth: 0, count: 0 };
      if (a.growth > 0) {
        cur.growth += a.growth;
        cur.count++;
      }
      byAgency.set(a.project.agency, cur);
    }
    const top = [...byAgency.entries()].sort((x, y) => y[1].growth - x[1].growth).slice(0, 5);
    lines.push(`Agencies with the most budget growth:\n${top.map(([code, v]) => `- **${code}**: ${money(v.growth)} across ${num(v.count)} projects`).join("\n")}`);
  }
  const worst = [...unique].sort((x, y) => y.growth - x.growth).slice(0, 5);
  lines.push(`Largest increases since first report:\n${worst.map((a) => `- ${projectLine(a)}`).join("\n")}`);
  lines.push(`_Baseline measures every project against its first published budget and never rebases. The NY State Comptroller found more than half of 5,128 projects over their initial budgets in 2024._`);
  return {
    intent: "capital",
    text: lines.join("\n\n"),
    sources,
    followUps: [parsed.agency ? `Which ${parsed.agency} projects slipped the most?` : "Which DOT projects slipped the most?", "How much does a bridge project usually run over?"],
  };
}

function answerDelays(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.capital) return missing("capital projects");
  const items = filterProjects(parsed, data).filter((a) => a.project.firstForecast);
  const sources = uniqueSources([...metaSources(data.capital.meta), cite("ddcAudit")]);
  if (!items.length) return { intent: "delays", text: `No projects with schedule history match ${scopeLabel(parsed)}.`, sources, followUps: [] };
  const s = summarizeCapital(items);
  const worst = [...items].sort((x, y) => y.slipDays - x.slipDays).slice(0, 5);
  const text = [
    `**Schedules, ${scopeLabel(parsed)}:** of ${num(s.withScheduleCount)} projects with a published completion forecast, **${num(s.slippedCount)} (${pct(s.slippedCount / Math.max(1, s.withScheduleCount))})** have had that date pushed back since the first report. The median push-back is **${duration(s.medianSlipDays)}**.`,
    s.reasons.length ? `Most common reasons the city gave:\n${s.reasons.slice(0, 4).map(([r, n]) => `- ${r} (${num(n)} times)`).join("\n")}` : "",
    `Longest slips:\n${worst.map((a) => `- **${a.project.name}** (${a.project.agency}): ${date(a.project.firstForecast)} → ${date(a.project.forecast)} (${duration(a.slipDays)})`).join("\n")}`,
    `_The Comptroller's December 2025 audit found 80% of DDC-managed projects behind their original schedule, by 3.5 years on average, partly because DDC resets the start point for counting delays at each phase._`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { intent: "delays", text, sources, followUps: ["Which agencies have the most capital projects over budget?"] };
}

function answerBudgetLines(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.budgetLines) return missing("expense budget");
  const lines = assessAllLines(data.budgetLines).filter((a) => a.chronic && (!parsed.agency || a.line.agencyCode === parsed.agency));
  const sources = uniqueSources([...metaSources(data.budgetLines.meta), cite("fy26Prelim")]);
  if (!lines.length) return { intent: "budgetLines", text: `No budget lines${parsed.agency ? ` for ${agencyName(parsed.agency)}` : ""} meet Baseline's test for chronic under-budgeting.`, sources, followUps: [] };
  const total = lines.reduce((s, a) => s + a.expectedIncrease, 0);
  const text = [
    `**${num(lines.length)} budget lines${parsed.agency ? ` at ${agencyName(parsed.agency)}` : ""}** ended the year at least 5% above their adopted amount in three of every four recent years, by a median of 20% or more. If the pattern holds, they will need about **${money(total)}** more than adopted this year (estimate).`,
    `Largest expected increases:\n${lines
      .slice(0, 8)
      .map((a) => `- **${a.line.agencyCode ?? a.line.agency} · ${a.line.objectClass.toLowerCase()}**: adopted ${money(a.latestAdopted)}, typically ends ${pct(a.medianRatio - 1, { sign: true })} higher (${a.yearsOver} of ${a.yearsAssessed} years)`)
      .join("\n")}`,
    `_Mid-year increases can also come from federal or state grants recognized after adoption, so treat a flag as a question to ask, not proof of a lowball. The Comptroller estimates the city leaves out about ${money(BUDGET_FACTS.chronicUnderbudgetingAvg)} a year of predictable costs at the preliminary budget stage._`,
  ].join("\n\n");
  return { intent: "budgetLines", text, sources, followUps: ["How much will NYPD overtime run over budget next year?", "What is the out-year budget gap?"] };
}

function answerGap(): AnalystAnswer {
  const rows = FY27_YEARS.map((y, i) => `| ${fy(y)} | ${money(FY27_OMB_GAP[i] * 1e6)} | ${money(FY27_COMPTROLLER_GAP[i] * 1e6)} |`).join("\n");
  const risks = [...FY27_EXPENSE_RISKS].filter((r) => r.kind === "expense").sort((a, b) => a.values[1] - b.values[1]).slice(0, 4);
  const text = [
    `**Out-year budget gaps after the FY27 adopted budget** ($${(BUDGET_FACTS.fy27Adopted / 1e9).toFixed(2)}B). Negative numbers are gaps to close:`,
    `| Year | Mayor's plan (OMB) | Comptroller's view |\n|---|---|---|\n${rows}`,
    `The Comptroller expects higher tax revenue than OMB (${money(FY27_REVENUE_DIFF.tax[0] * 1e6)} more in FY27, ${money(FY27_REVENUE_DIFF.tax[3] * 1e6)} more by FY30) but also costs OMB has not budgeted. The biggest in FY28:\n${risks.map((r) => `- ${r.label}: ${money(r.values[1] * 1e6)}`).join("\n")}`,
    `Try your own assumptions in **Gap scenarios**.`,
  ].join("\n\n");
  return { intent: "gap", text, sources: [cite("fy27Adopted")], followUps: ["How much will NYPD overtime run over budget next year?", "Which budget lines are adopted too low every year?"] };
}

function answerRevenue(): AnalystAnswer {
  const text = [
    `**FY27 tax revenue:** OMB projects ${money(BUDGET_FACTS.fy27OmbTax)}; the Comptroller projects ${money(BUDGET_FACTS.fy27ComptrollerTax)}, about ${money(BUDGET_FACTS.fy27ComptrollerTax - BUDGET_FACTS.fy27OmbTax)} more.`,
    `The Comptroller's tax forecast runs above OMB's in every year of the plan: ${FY27_YEARS.map((y, i) => `${fy(y)} ${money(FY27_REVENUE_DIFF.tax[i] * 1e6, { sign: true })}`).join(", ")}.`,
    `Higher revenue doesn't close the gap on its own, because the Comptroller also sees more unbudgeted spending. See **Gap scenarios** to combine both.`,
  ].join("\n\n");
  return { intent: "revenue", text, sources: [cite("fy27Adopted")], followUps: ["What is the out-year budget gap?"] };
}

function answerMaintenance(): AnalystAnswer {
  const f = AIMS_FACTS;
  const text = [
    `**AIMS** is the city's annual report on the condition of its infrastructure and what it needs for upkeep. The FY2023 report covered ${num(f.assets)} assets and estimated ${money(f.needFy24to27)} of need for FY2024–2027. It costs about ${money(f.annualCost)} a year to produce.`,
    `A March 2024 Comptroller audit found serious problems:`,
    [
      `- **Estimates miss badly.** AIMS put the Riverside Park bridge at the W. 79th St traffic circle at ${money(f.riverside.aimsEstimate)}; the bid came in at ${money(f.riverside.bid, { digits: 1 })}, almost double.`,
      `- **Inspections are quick visual checks.** A ${num(f.surveyMinutes.fdnySqft)} sq ft FDNY building got ${f.surveyMinutes.fdnyMinutes} minutes; a ${num(f.surveyMinutes.schoolSqft)} sq ft school got ${f.surveyMinutes.schoolMinutes}.`,
      `- **Problems go unreported.** Auditors found ${f.unreportedConditions.conditions} structural problems AIMS never reported at just ${f.unreportedConditions.assets} sampled assets.`,
      `- **Repairs turn into emergencies.** The city spent over ${money(f.emergencyProcurements)} on emergency procurements for structural problems over five years.`,
    ].join("\n"),
    `Baseline's **Maintenance risk** tool ranks assets by failure risk and funds the repairs with the most risk reduction per dollar.`,
  ].join("\n\n");
  return { intent: "maintenance", text, sources: [cite("aimsAudit"), cite("betterAims")], followUps: ["How much does a bridge project usually run over?"] };
}

function answerGrants(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.grants) return missing("grants");
  const theme = parsed.grantTheme ? data.grants.meta.themes.find((t) => t.id === parsed.grantTheme) : null;
  const today = new Date().toISOString().slice(0, 10);
  const open = data.grants.opportunities.filter((o) => (!o.closeDate || o.closeDate >= today) && (!theme || o.themes.includes(theme.id)));
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const soon = open.filter((o) => o.closeDate && o.closeDate <= in30);
  // Grants.gov keyword search is broad, so put opportunities whose title matches the theme first.
  const themeRe = parsed.grantTheme ? GRANT_THEME_PATTERNS.find(([id]) => id === parsed.grantTheme)?.[1] : null;
  const relevant = (o: { title: string }) => (themeRe ? themeRe.test(o.title.toLowerCase()) : true);
  const ranked = (list: typeof open) => [...list.filter(relevant), ...list.filter((o) => !relevant(o))];
  const list = ranked(soon.filter(relevant).length ? soon : open).slice(0, 6);
  const text = [
    `**${num(open.length)} open or forecasted federal opportunities${theme ? ` for ${theme.label.toLowerCase()}` : ""}** list city governments as eligible on Grants.gov. ${num(soon.length)} close in the next 30 days.`,
    list.length ? `${soon.length ? "Closing soonest" : "A few to look at"}:\n${list.map((o) => `- [${o.title}](${o.url}) — ${o.agency}${o.closeDate ? `, closes ${date(o.closeDate)}` : ", no close date posted"}`).join("\n")}` : "",
    `Open **Grant finder** to match opportunities to specific capital projects.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { intent: "grants", text, sources: metaSources(data.grants.meta), followUps: ["Which federal grants for water infrastructure close soon?"] };
}

function answerDemand(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.demand) return missing("311");
  const sources = metaSources(data.demand.meta);
  const trend = (months: [string, number][]) => {
    // Compare the last 12 complete months with the 12 before. The current month is partial, so drop it.
    const full = months.slice(0, -1);
    const last = full.slice(-12).reduce((s, m) => s + m[1], 0);
    const prev = full.slice(-24, -12).reduce((s, m) => s + m[1], 0);
    return { last, prev, change: prev ? last / prev - 1 : 0, through: full.at(-1)?.[0] ?? "" };
  };
  const target = parsed.demandType ? data.demand.types.find((t) => t.type === parsed.demandType) : null;
  if (target) {
    const t = trend(target.months);
    const peak = [...target.months].sort((a, b) => b[1] - a[1])[0];
    const text = [
      `**${target.label}** (311, handled mostly by ${target.agency}): ${num(t.last)} requests in the 12 months through ${date(t.through)}, ${pct(t.change, { sign: true })} versus the year before.`,
      `The busiest month on record since 2020 was ${date(peak[0])} with ${num(peak[1])} requests.`,
      `Open **311 demand** for the monthly forecast and its range.`,
    ].join("\n\n");
    return { intent: "demand", text, sources, followUps: ["Which DOT projects slipped the most?"] };
  }
  const rows = data.demand.types.map((x) => ({ x, t: trend(x.months) })).sort((a, b) => b.t.change - a.t.change);
  const text = [
    `**311 demand, last 12 complete months vs the year before:**`,
    rows.map(({ x, t }) => `- ${x.label} (${x.agency}): ${num(t.last)} (${pct(t.change, { sign: true })})`).join("\n"),
  ].join("\n\n");
  return { intent: "demand", text, sources, followUps: ["Are pothole complaints going up?"] };
}

function answerEstimate(parsed: ParsedQuestion, data: AnalystData): AnalystAnswer {
  if (!data.reference) return missing("reference projects");
  const cls = parsed.assetClass;
  const label = data.reference.meta.classes.find((c) => c.id === cls)?.label ?? "capital projects";
  const pool = data.reference.projects.filter((p) => p.orig >= 250_000 && (!cls || p.cls === cls));
  const sources = metaSources(data.reference.meta);
  if (pool.length < 10) return { intent: "estimate", text: `There are too few past ${label.toLowerCase()} projects to say. Try the Cost forecaster with a broader class.`, sources, followUps: [] };
  const ratios = pool.map((p) => Math.min(10, Math.max(0.5, p.current / p.orig)));
  const slips = pool.map((p) => p.slipDays).filter((d): d is number => d !== null && d > 0);
  const text = [
    `**${label}: ${num(pool.length)} past NYC projects** (Capital Project Detail Data, October 2023).`,
    `- Half ended up at least **${pct(median(ratios) - 1, { sign: true })}** versus their original budget.`,
    `- To be 80% sure of covering the cost, budget **${quantile(ratios, 0.8).toFixed(2)}×** the first estimate.`,
    `- ${pct(ratios.filter((r) => r > 1.001).length / ratios.length)} grew past their original budget; ${pct(ratios.filter((r) => r >= 1.2).length / ratios.length)} grew 20% or more.`,
    slips.length ? `- Projects that slipped were pushed back a median of ${duration(median(slips))}.` : "",
    `\nThese are planned totals for projects still under way in 2023, so final overruns may be larger. The **Cost forecaster** weights the projects most similar to yours in size, agency and borough.`,
  ]
    .filter(Boolean)
    .join("\n");
  return { intent: "estimate", text, sources, followUps: ["What went wrong with AIMS?", "Which agencies have the most capital projects over budget?"] };
}

function answerHelp(): AnalystAnswer {
  return {
    intent: "help",
    text: [
      `I answer questions from Baseline's data: the city's expense budget, payroll, capital projects, 311 requests, federal grants and the Comptroller's published reviews. Every answer lists its sources.`,
      `Things you can ask:\n${SUGGESTED_QUESTIONS.slice(0, 6).map((q) => `- ${q}`).join("\n")}`,
      `Connect Claude in **Settings** for open-ended questions; Claude only sees the same facts and is told to cite them.`,
    ].join("\n\n"),
    sources: [],
    followUps: SUGGESTED_QUESTIONS.slice(0, 3),
  };
}

export function answerQuestion(question: string, data: AnalystData): AnalystAnswer {
  const parsed = parseQuestion(question);
  switch (parsed.intent) {
    case "overtime":
      return answerOvertime(parsed, data);
    case "capital":
      return answerCapital(parsed, data);
    case "delays":
      return answerDelays(parsed, data);
    case "budgetLines":
      return answerBudgetLines(parsed, data);
    case "gap":
      return answerGap();
    case "revenue":
      return answerRevenue();
    case "maintenance":
      return answerMaintenance();
    case "grants":
      return answerGrants(parsed, data);
    case "demand":
      return answerDemand(parsed, data);
    case "estimate":
      return answerEstimate(parsed, data);
    case "help":
      return answerHelp();
    default: {
      // An agency or borough on its own most often means "how is this agency doing on capital?"
      if (parsed.agency || parsed.boro) return answerCapital({ ...parsed, intent: "capital" }, data);
      return {
        intent: "unknown",
        text: `I couldn't match that to the data I have. I can answer questions about overtime, capital project overruns and delays, under-budgeted lines, the budget gap, tax revenue, AIMS and maintenance, federal grants and 311 demand.\n\nTry one of these:\n${SUGGESTED_QUESTIONS.slice(0, 4)
          .map((q) => `- ${q}`)
          .join("\n")}`,
        sources: [],
        followUps: SUGGESTED_QUESTIONS.slice(0, 3),
      };
    }
  }
}

// ---- Context pack for Claude -----------------------------------------------------------------------
/** A compact, factual summary of everything Baseline knows, used as Claude's only source of truth. */
export function buildContextPack(data: AnalystData): string {
  const out: string[] = [];
  out.push(`# Baseline data pack (New York City)\nGenerated ${new Date().toISOString().slice(0, 10)}. Money in US dollars. FY = city fiscal year (July 1 to June 30).`);

  out.push(
    `## Published figures (cite the source named)\n` +
      [
        `- FY27 adopted budget: ${money(BUDGET_FACTS.fy27Adopted)} [NYC Comptroller, FY27 Adopted Budget comments, Aug 2026]`,
        `- Out-year gaps, OMB plan: ${FY27_YEARS.map((y, i) => `${fy(y)} ${money(FY27_OMB_GAP[i] * 1e6)}`).join(", ")} [same]`,
        `- Out-year gaps, Comptroller restated: ${FY27_YEARS.map((y, i) => `${fy(y)} ${money(FY27_COMPTROLLER_GAP[i] * 1e6)}`).join(", ")} [same]`,
        `- Comptroller expense risks vs OMB ($M, FY27-FY30; negative adds to the gap): ${FY27_EXPENSE_RISKS.map((r) => `${r.label} ${r.values.join("/")}`).join("; ")} [same]`,
        `- Comptroller tax revenue above OMB ($M): ${FY27_REVENUE_DIFF.tax.join("/")}; FY27 tax revenue OMB ${money(BUDGET_FACTS.fy27OmbTax)} vs Comptroller ${money(BUDGET_FACTS.fy27ComptrollerTax)} [same]`,
        `- FY26 overtime estimated at ${money(BUDGET_FACTS.fy26OvertimeEstimate)}, ${money(BUDGET_FACTS.fy26OvertimeShortfall)} above the adopted budget [NYC Comptroller, FY26 Adopted Budget comments]`,
        `- About ${money(BUDGET_FACTS.chronicUnderbudgetingAvg)} a year of chronically under-budgeted costs left out of the preliminary budget [NYC Comptroller, FY26 Preliminary Budget comments]`,
        `- AIMS: ${num(AIMS_FACTS.assets)} assets; ${money(AIMS_FACTS.needFy24to27)} need FY24-27; Riverside Park bridge AIMS estimate ${money(AIMS_FACTS.riverside.aimsEstimate)} vs bid ${money(AIMS_FACTS.riverside.bid, { digits: 1 })}; ${AIMS_FACTS.unreportedConditions.conditions} unreported structural conditions at ${AIMS_FACTS.unreportedConditions.assets} sampled assets; FDNY building surveyed in ${AIMS_FACTS.surveyMinutes.fdnyMinutes} minutes; over ${money(AIMS_FACTS.emergencyProcurements)} in emergency procurements over five years [NYC Comptroller AIMS audit, Mar 2024]`,
        `- NY State Comptroller (Apr 2024): ${num(CAPITAL_FACTS.dinapoli.projects)} NYC capital projects reviewed; ${pct(CAPITAL_FACTS.dinapoli.delayedShare)} delayed; more than half over initial budget; ${money(CAPITAL_FACTS.dinapoli.extraPlannedSpending)} more planned spending than first budgeted`,
        `- NYC Comptroller DDC audit (Dec 2025): ${pct(CAPITAL_FACTS.ddc.lateShare)} of DDC projects behind original schedule, average ${num(CAPITAL_FACTS.ddc.avgDelayDays)} days (3.5 years); 18 large projects grew from ${money(CAPITAL_FACTS.ddc.sampleStart)} to ${money(CAPITAL_FACTS.ddc.sampleNow)}; DDC rebases schedules and cannot forecast portfolio costs`,
        `- Capital Projects Dashboard covers only ${pct(CAPITAL_FACTS.dashboard.fmsIdCoverage, { digits: 1 })} of FMS project IDs [NYC Comptroller, Flying Blind on Billions, Dec 2025]`,
      ].join("\n"),
  );

  if (data.overtime) {
    const all = assessAllOvertime(data.overtime);
    out.push(
      `## Overtime by agency (Expense Budget + Citywide Payroll Data, all funds; Baseline forecast is an estimate)\n` +
        all
          .map(
            (a) =>
              `- ${a.agency.code} (${a.agency.name}): ${fy(a.latestActualFy)} adopted ${money(a.latestAdoptedForActualYear)}, actual ${money(a.latestActual)}; beat adopted by 10%+ in ${a.yearsOver}/${a.yearsAssessed} years; ${fy(a.nextFy)} adopted ${money(a.nextAdopted)}, Baseline forecast ${money(a.forecast)} (80% range ${money(a.forecastLow)}-${money(a.forecastHigh)})`,
          )
          .join("\n"),
    );
  }

  if (data.capital) {
    const items = uniqueByFms(assessAllProjects(data.capital));
    const s = summarizeCapital(items);
    const byAgency = new Map<string, ProjectAssessment[]>();
    for (const a of items) byAgency.set(a.project.agency, [...(byAgency.get(a.project.agency) ?? []), a]);
    const agencyRows = [...byAgency.entries()]
      .map(([code, list]) => ({ code, s: summarizeCapital(list) }))
      .sort((a, b) => b.s.totalGrowth - a.s.totalGrowth)
      .slice(0, 12);
    out.push(
      `## Capital projects (Capital Projects Dashboard ${period(data.capital.meta.firstPeriod)} to ${period(data.capital.meta.latestPeriod)}; growth is measured from the first published budget; each FMS budget ID counted once)\n` +
        `- Citywide: ${num(s.projects)} projects, ${money(s.totalBudget)} total; ${num(s.grownCount)} above first budget (+${money(s.totalGrowth)}); ${num(s.over20Count)} up 20%+; ${num(s.slippedCount)} of ${num(s.withScheduleCount)} with schedules pushed back, median ${duration(s.medianSlipDays)}\n` +
        `- Top delay reasons: ${s.reasons.slice(0, 5).map(([r, n]) => `${r} (${n})`).join("; ")}\n` +
        agencyRows.map((r) => `- ${r.code}: ${num(r.s.projects)} projects, ${money(r.s.totalBudget)}, growth ${money(r.s.totalGrowth)}, ${num(r.s.over20Count)} up 20%+, ${num(r.s.slippedCount)} slipped`).join("\n") +
        `\n- Largest increases: ` +
        [...items]
          .sort((a, b) => b.growth - a.growth)
          .slice(0, 10)
          .map((a) => `${a.project.name} (${a.project.agency}) ${money(a.project.firstBudget ?? a.project.budget)}→${money(a.project.budget)}`)
          .join("; "),
    );
  }

  if (data.budgetLines) {
    const chronic = assessAllLines(data.budgetLines).filter((a) => a.chronic).slice(0, 15);
    out.push(
      `## Budget lines that grow after adoption (Expense Budget, all funds; mid-year increases may include grants)\n` +
        chronic
          .map((a) => `- ${a.line.agencyCode ?? a.line.agency} / ${a.line.objectClass}: latest adopted ${money(a.latestAdopted)} (${fy(a.latestAdoptedFy)}); median end-of-year ${a.medianRatio.toFixed(2)}x adopted; over in ${a.yearsOver}/${a.yearsAssessed} years; expected increase ${money(a.expectedIncrease)}`)
          .join("\n"),
    );
  }

  if (data.reference) {
    const classes = data.reference.meta.classes
      .map((c) => {
        const pool = data.reference!.projects.filter((p) => p.cls === c.id && p.orig >= 250_000);
        if (pool.length < 20) return null;
        const r = pool.map((p) => Math.min(10, Math.max(0.5, p.current / p.orig)));
        return `- ${c.label}: ${pool.length} projects, median ${median(r).toFixed(2)}x original budget, P80 ${quantile(r, 0.8).toFixed(2)}x, ${pct(r.filter((x) => x > 1.001).length / r.length)} over`;
      })
      .filter(Boolean);
    out.push(`## Reference class: past NYC capital projects (CPDD, Oct 2023; current planned total vs original budget)\n${classes.join("\n")}`);
  }

  if (data.demand) {
    out.push(
      `## 311 requests, last 12 complete months vs prior 12\n` +
        data.demand.types
          .map((t) => {
            const full = t.months.slice(0, -1);
            const last = full.slice(-12).reduce((s, m) => s + m[1], 0);
            const prev = full.slice(-24, -12).reduce((s, m) => s + m[1], 0);
            return `- ${t.label} (${t.agency}): ${num(last)} (${prev ? pct(last / prev - 1, { sign: true }) : "n/a"})`;
          })
          .join("\n"),
    );
  }

  if (data.grants) {
    const today = new Date().toISOString().slice(0, 10);
    const open = data.grants.opportunities.filter((o) => !o.closeDate || o.closeDate >= today);
    out.push(
      `## Federal grants open to city governments (Grants.gov)\n- ${num(open.length)} open or forecasted\n` +
        open
          .slice(0, 12)
          .map((o) => `- ${o.title} (${o.agency}; closes ${o.closeDate ?? "n/a"}; themes ${o.themes.join(", ")})`)
          .join("\n"),
    );
  }

  return out.join("\n\n");
}

export const CLAUDE_SYSTEM_PROMPT = `You are Baseline's budget analyst for New York City. You help city budget office staff and City Council staff understand budgets, capital projects, overtime and service demand.

Rules:
- Answer only from the data pack below. If the pack doesn't contain what's needed, say what's missing and suggest which Baseline tool or public source could answer it.
- Name the source for every number (for example "Expense Budget, NYC Open Data" or "NYC Comptroller, FY27 Adopted Budget comments").
- Say clearly when a number is a Baseline estimate rather than a published figure.
- Write in plain, clear English for a smart non-specialist. Short paragraphs, bullets where they help, no jargon.
- Be even-handed between the Mayor's office and the Council. Present numbers, not political conclusions.
- Keep answers under 250 words unless the user asks for more.`;
