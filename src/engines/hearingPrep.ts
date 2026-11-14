// Hearing prep: turn an agency's numbers into a brief and a ranked list of questions, each tied to its evidence.
import { CITATIONS, FY27_EXPENSE_RISKS, AIMS_FACTS, CAPITAL_FACTS, type CitationId } from "../data/curated";
import type { AgencyFacts } from "./core";
import type { DemandAssessment } from "./demand";
import { date, duration, fy, money, num, pct } from "../lib/format";

export type QuestionSource = { kind: "dataset"; label: string; url: string } | { kind: "citation"; id: CitationId };

export const DATASET_SOURCES = {
  budget: { kind: "dataset", label: "NYC Expense Budget", url: "https://data.cityofnewyork.us/d/mwzb-yiwb" },
  payroll: { kind: "dataset", label: "Citywide Payroll Data", url: "https://data.cityofnewyork.us/d/k397-673e" },
  capital: { kind: "dataset", label: "Capital Projects Dashboard", url: "https://data.cityofnewyork.us/d/fb86-vt7u" },
  schedule: { kind: "dataset", label: "Capital Projects Dashboard schedule history", url: "https://data.cityofnewyork.us/d/95tx-snak" },
  demand: { kind: "dataset", label: "311 Service Requests", url: "https://data.cityofnewyork.us/d/erm2-nwe9" },
} as const satisfies Record<string, QuestionSource>;

export type QuestionTopic = "Overtime" | "Capital" | "Budget lines" | "Service demand" | "Comptroller risks" | "Asset condition";

export interface HearingQuestion {
  id: string;
  topic: QuestionTopic;
  text: string;
  /** The number behind the question, in one line. */
  evidence: string;
  sources: QuestionSource[];
  /** True when the evidence includes a Baseline estimate rather than only published figures. */
  estimate: boolean;
  priority: number;
}

export interface HeadlineFact {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "warn" | "bad" | "good";
  source: QuestionSource;
  estimate?: boolean;
}

export interface HearingBrief {
  agency: string;
  agencyName: string;
  headlines: HeadlineFact[];
  questions: HearingQuestion[];
  facts: AgencyFacts;
  demand: DemandAssessment[];
  comptrollerRisks: { label: string; fy27: number; fy28: number }[];
}

/** Which Comptroller FY2027 risk items fall on which agency. */
export const RISK_AGENCIES: Record<string, string[]> = {
  overtime: ["NYPD", "FDNY", "DOC", "DSNY"],
  para: ["DOE"],
  childcare: ["ACS"],
  twoK: ["DOE"],
  asylum: ["DHS", "DSS"],
  snap: ["DSS"],
  immigration: ["DSS"],
  mta: ["DOT"],
};

const CAPITAL_AGENCIES = new Set(["DOT", "DEP", "DPR", "DCAS", "DDC", "DSNY", "NYPD", "FDNY", "DOC", "LIB", "CUNY", "HHC", "DHS", "ACS", "DCLA", "EDC", "HPD", "DOHMH"]);

export function buildHearingBrief(agency: string, agencyName: string, facts: AgencyFacts, demand: DemandAssessment[]): HearingBrief {
  const headlines: HeadlineFact[] = [];
  const questions: HearingQuestion[] = [];
  const add = (q: Omit<HearingQuestion, "id">) => questions.push({ ...q, id: `${q.topic}-${questions.length}` });

  // ---- Overtime --------------------------------------------------------------------------------------
  const ot = facts.overtime;
  if (ot && ot.latestActual > 0) {
    headlines.push({
      label: `Overtime, ${fy(ot.latestActualFy)}`,
      value: money(ot.latestActual),
      detail: ot.latestAdoptedForActualYear > 0 ? `${money(ot.latestAdoptedForActualYear)} adopted (${ot.latestRatio.toFixed(1)}× over)` : "No adopted overtime line",
      tone: ot.latestRatio >= 1.4 ? "bad" : ot.latestRatio >= 1.1 ? "warn" : "neutral",
      source: DATASET_SOURCES.payroll,
    });
    if (ot.nextAdopted !== null) {
      headlines.push({
        label: `${fy(ot.nextFy)} overtime forecast`,
        value: money(ot.forecast),
        detail: `vs ${money(ot.nextAdopted)} adopted. Baseline estimate, range ${money(ot.forecastLow)}–${money(ot.forecastHigh)}`,
        tone: (ot.expectedShortfall ?? 0) > 0.3 * ot.nextAdopted ? "bad" : (ot.expectedShortfall ?? 0) > 0 ? "warn" : "good",
        source: DATASET_SOURCES.payroll,
        estimate: true,
      });
    }
    if (ot.latestAdoptedForActualYear > 0 && ot.latestRatio >= 1.1) {
      add({
        topic: "Overtime",
        text: `The adopted ${fy(ot.latestActualFy)} budget had ${money(ot.latestAdoptedForActualYear)} for overtime, but the agency paid ${money(ot.latestActual)}. What is the realistic overtime need, and why is the adopted figure set lower?`,
        evidence: `${fy(ot.latestActualFy)}: ${money(ot.latestAdoptedForActualYear)} adopted vs ${money(ot.latestActual)} paid (${ot.latestRatio.toFixed(2)}×).`,
        sources: [DATASET_SOURCES.budget, DATASET_SOURCES.payroll],
        estimate: false,
        priority: 90 + Math.min(10, ot.latestRatio * 3),
      });
    }
    if (ot.nextAdopted !== null && (ot.expectedShortfall ?? 0) > 0) {
      add({
        topic: "Overtime",
        text: `At recent spending levels, ${fy(ot.nextFy)} overtime is likely to land near ${money(ot.forecast)}, ${money(ot.expectedShortfall)} above the ${money(ot.nextAdopted)} adopted. Which drivers (vacancies, events, mandates) explain the gap, and when will the budget be modified?`,
        evidence: `Baseline forecast ${money(ot.forecast)} (range ${money(ot.forecastLow)}–${money(ot.forecastHigh)}) vs ${money(ot.nextAdopted)} adopted for ${fy(ot.nextFy)}.`,
        sources: [DATASET_SOURCES.payroll, DATASET_SOURCES.budget],
        estimate: true,
        priority: 85,
      });
    }
    if (ot.yearsAssessed >= 3 && ot.yearsOver >= 3) {
      add({
        topic: "Overtime",
        text: `Overtime has come in at least 10% above the adopted budget in ${ot.yearsOver} of the last ${ot.yearsAssessed} years. What would it take to budget overtime accurately at adoption instead of adding it mid-year?`,
        evidence: `${ot.yearsOver} of ${ot.yearsAssessed} recent years over adoption by 10% or more.`,
        sources: [DATASET_SOURCES.budget, DATASET_SOURCES.payroll],
        estimate: false,
        priority: 70 + ot.yearsOver,
      });
    }
  }

  // ---- Capital ---------------------------------------------------------------------------------------
  const cap = facts.capital;
  if (cap && cap.projects > 0) {
    headlines.push({
      label: "Capital projects tracked",
      value: num(cap.projects),
      detail: `${money(cap.totalBudget)} total budget; ${money(cap.totalGrowth, { sign: true })} since first reported`,
      tone: cap.totalGrowth > 0.1 * cap.totalFirstBudget ? "bad" : cap.totalGrowth > 0 ? "warn" : "neutral",
      source: DATASET_SOURCES.capital,
    });
    if (cap.withScheduleCount > 0) {
      headlines.push({
        label: "Projects with a later finish date",
        value: `${num(cap.slippedCount)} of ${num(cap.withScheduleCount)}`,
        detail: cap.slippedCount ? `Median slip ${duration(cap.medianSlipDays)} since first forecast` : "No slips since first forecast",
        tone: cap.slippedCount / cap.withScheduleCount > 0.4 ? "bad" : cap.slippedCount > 0 ? "warn" : "good",
        source: DATASET_SOURCES.schedule,
      });
    }
    if (cap.totalGrowth > 0 && cap.grownCount > 0) {
      const share = cap.totalFirstBudget > 0 ? cap.totalGrowth / cap.totalFirstBudget : 0;
      add({
        topic: "Capital",
        text: `The agency's ${num(cap.projects)} tracked capital projects have grown by ${money(cap.totalGrowth)} (${pct(share)}) since the city first reported them. Which projects account for most of that growth, and what changed in each?`,
        evidence: `${num(cap.grownCount)} projects grew; ${num(cap.over20Count)} grew by 20% or more.`,
        sources: [DATASET_SOURCES.capital],
        estimate: false,
        priority: 80 + Math.min(10, share * 20),
      });
    }
    const worst = facts.worstProjects.filter((p) => p.growth > 0).slice(0, 2);
    for (const w of worst) {
      const p = w.project;
      add({
        topic: "Capital",
        text: `${p.name}: the budget went from ${money(p.firstBudget)} to ${money(p.budget)} (${pct(w.growthPct, { sign: true })}). What is the current estimate at completion${w.topReason ? `, and is "${w.topReason.toLowerCase()}" still the main cause` : ""}?`,
        evidence: `First reported ${date(p.firstPeriod)} at ${money(p.firstBudget)}; now ${money(p.budget)}${w.slipDays > 0 ? `; finish date pushed back ${duration(w.slipDays)}` : ""}.`,
        sources: [DATASET_SOURCES.capital],
        estimate: false,
        priority: 75 + Math.min(10, w.growthPct * 10),
      });
    }
    if (cap.slippedCount > 0) {
      add({
        topic: "Capital",
        text: `${num(cap.slippedCount)} of ${num(cap.withScheduleCount)} projects with a published schedule now have a later finish date than first forecast (median ${duration(cap.medianSlipDays)}). Which of these delays are within the agency's control?`,
        evidence: `Schedule history since ${date("2023-05")}.`,
        sources: [DATASET_SOURCES.schedule],
        estimate: false,
        priority: 65 + Math.min(10, (cap.slippedCount / Math.max(1, cap.withScheduleCount)) * 10),
      });
    }
    const topReason = cap.reasons[0];
    if (topReason) {
      add({
        topic: "Capital",
        text: `The most common reason the agency gives for schedule changes is "${topReason[0].toLowerCase()}" (${num(topReason[1])} times). What is being done to prevent it on new projects?`,
        evidence: `Reasons recorded in the schedule history: ${cap.reasons
          .slice(0, 3)
          .map(([r, n]) => `${r.toLowerCase()} (${n})`)
          .join(", ")}.`,
        sources: [DATASET_SOURCES.schedule],
        estimate: false,
        priority: 55,
      });
    }
    add({
      topic: "Capital",
      text: "Will the agency report each project's cost and schedule against the first published baseline, rather than resetting the baseline at each phase?",
      evidence: `The Comptroller found DDC resets the starting point at each phase, and ${pct(CAPITAL_FACTS.ddc.lateShare)} of its projects were behind their original schedule by ${duration(CAPITAL_FACTS.ddc.avgDelayDays)} on average.`,
      sources: [{ kind: "citation", id: "ddcAudit" }],
      estimate: false,
      priority: 40,
    });
  }

  // ---- Chronic budget lines -----------------------------------------------------------------------
  const lines = facts.chronicLines.slice().sort((a, b) => b.expectedIncrease - a.expectedIncrease);
  if (lines.length) {
    const totalIncrease = lines.reduce((s, l) => s + l.expectedIncrease, 0);
    headlines.push({
      label: "Lines that grow after adoption",
      value: num(lines.length),
      detail: `About ${money(totalIncrease)} expected to be added in-year if the pattern holds (estimate)`,
      tone: "warn",
      source: DATASET_SOURCES.budget,
      estimate: true,
    });
    for (const l of lines.slice(0, 2)) {
      add({
        topic: "Budget lines",
        text: `${titleCaseClass(l.line.objectClass)} ended the year above its adopted budget in ${l.yearsOver} of the last ${l.yearsAssessed} years (median ${l.medianRatio.toFixed(2)}× adoption). Is the ${fy(l.latestAdoptedFy)} adopted amount of ${money(l.latestAdopted)} realistic, or should it be closer to ${money(l.latestAdopted + l.expectedIncrease)}?`,
        evidence: `Last year: ${money(l.lastGap, { sign: true })} added after adoption. Part of in-year growth can be new federal or state grants, so ask what share is city funds.`,
        sources: [DATASET_SOURCES.budget],
        estimate: true,
        priority: 60 + Math.min(15, (l.medianRatio - 1) * 10),
      });
    }
  }

  // ---- 311 demand ----------------------------------------------------------------------------------
  for (const d of demand) {
    if (d.prior12 <= 0) continue;
    if (d.yoy >= 0.1) {
      add({
        topic: "Service demand",
        text: `311 requests about ${d.type.label.toLowerCase()} rose ${pct(d.yoy)} over the past year to ${num(d.last12)}. Does the budget plan the staff and contracts to meet that demand, and how long does a typical request take to close?`,
        evidence: `Last 12 complete months: ${num(d.last12)} vs ${num(d.prior12)} the year before.`,
        sources: [DATASET_SOURCES.demand],
        estimate: false,
        priority: 50 + Math.min(20, d.yoy * 30),
      });
    } else if (d.anomaly === "above" && d.latestMonth) {
      add({
        topic: "Service demand",
        text: `311 requests about ${d.type.label.toLowerCase()} in ${date(d.latestMonth)} were above the range their seasonal pattern predicts. What caused the jump, and is the agency staffed for it?`,
        evidence: `${num(d.latestValue)} requests vs an expected ${num(d.expectedBand?.[0])}–${num(d.expectedBand?.[1])} (Baseline estimate).`,
        sources: [DATASET_SOURCES.demand],
        estimate: true,
        priority: 48,
      });
    }
  }
  if (demand.length) {
    const top = [...demand].sort((a, b) => b.last12 - a.last12)[0];
    headlines.push({
      label: `311: ${top.type.label.toLowerCase()}`,
      value: num(top.last12),
      detail: `Last 12 months, ${pct(top.yoy, { sign: true })} vs the year before`,
      tone: top.yoy >= 0.1 ? "warn" : "neutral",
      source: DATASET_SOURCES.demand,
    });
  }

  // ---- Comptroller FY2027 risks ------------------------------------------------------------------------
  const comptrollerRisks: HearingBrief["comptrollerRisks"] = [];
  for (const item of FY27_EXPENSE_RISKS) {
    if (!RISK_AGENCIES[item.id]?.includes(agency)) continue;
    const [fy27, fy28] = item.values;
    if (fy27 >= 0 && fy28 >= 0) continue;
    comptrollerRisks.push({ label: item.label, fy27, fy28 });
    const shared = (RISK_AGENCIES[item.id]?.length ?? 1) > 1;
    const short = (v: number) => money(-v * 1e6);
    const gapText =
      fy27 < 0 && fy28 < 0
        ? `underbudgeted by ${short(fy27)} in FY27 and ${short(fy28)} in FY28`
        : fy27 < 0
          ? `underbudgeted by ${short(fy27)} in FY27`
          : `funded for FY27 but underbudgeted by ${short(fy28)} in FY28`;
    add({
      topic: "Comptroller risks",
      text: `The Comptroller estimates ${item.label.toLowerCase()} is ${gapText}${shared ? " (citywide figure)" : ""}. Does the agency agree, and what is its own estimate?`,
      evidence: `Comptroller FY2027 Adopted Budget comments, risks to the financial plan.`,
      sources: [{ kind: "citation", id: "fy27Adopted" }],
      estimate: false,
      priority: 72,
    });
  }

  // ---- Asset condition -----------------------------------------------------------------------------
  if (CAPITAL_AGENCIES.has(agency)) {
    add({
      topic: "Asset condition",
      text: "How does the agency check the condition data behind its state-of-good-repair requests, given that AIMS surveys are visual and can be very short?",
      evidence: `Comptroller audit: a ${num(AIMS_FACTS.surveyMinutes.fdnySqft)} sq ft FDNY facility was surveyed in ${AIMS_FACTS.surveyMinutes.fdnyMinutes} minutes; auditors found ${AIMS_FACTS.unreportedConditions.conditions} unreported structural problems at ${AIMS_FACTS.unreportedConditions.assets} sampled assets.`,
      sources: [{ kind: "citation", id: "aimsAudit" }],
      estimate: false,
      priority: 35,
    });
  }

  questions.sort((a, b) => b.priority - a.priority);
  return { agency, agencyName, headlines, questions: questions.slice(0, 12), facts, demand, comptrollerRisks };
}

function titleCaseClass(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function sourceLabel(s: QuestionSource): string {
  if (s.kind === "dataset") return s.label;
  const c = CITATIONS[s.id];
  return `${c.publisher}, ${c.title}`;
}

export function sourceUrl(s: QuestionSource): string {
  return s.kind === "dataset" ? s.url : CITATIONS[s.id].url;
}

/** A plain-text fact sheet: the only material Claude is allowed to use when sharpening questions. */
export function briefToFacts(b: HearingBrief): string {
  const lines: string[] = [`Agency: ${b.agencyName} (${b.agency})`, "", "Headline numbers:"];
  for (const h of b.headlines) lines.push(`- ${h.label}: ${h.value}. ${h.detail}. Source: ${sourceLabel(h.source)}${h.estimate ? " (Baseline estimate)" : ""}.`);
  lines.push("", "Evidence behind draft questions:");
  for (const q of b.questions) lines.push(`- [${q.topic}] ${q.evidence} Source: ${q.sources.map(sourceLabel).join("; ")}${q.estimate ? " (includes a Baseline estimate)" : ""}.`);
  lines.push("", "Draft questions:");
  b.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.text}`));
  return lines.join("\n");
}

export const CLAUDE_SYSTEM = `You help New York City Council finance staff prepare for budget and oversight hearings.
Rewrite and improve the draft hearing questions using ONLY the facts provided. Do not add numbers, projects or claims that are not in the facts.
Rules:
- Write 8 to 10 questions, most important first.
- Each question must name the specific number it rests on.
- After each question, add a line starting with "Evidence:" that restates the number and names its source exactly as given.
- If a fact is marked as a Baseline estimate, say "estimate" in the evidence line.
- Plain, direct English. No preamble and no closing summary.
- Format as a numbered Markdown list.`;

export function briefToMarkdown(b: HearingBrief, generatedOn = new Date()): string {
  const out: string[] = [`# Hearing brief: ${b.agencyName}`, "", `Prepared with Baseline on ${generatedOn.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Every number links to its source. Items marked *estimate* are Baseline forecasts, not published figures.`, "", "## Headline numbers", ""];
  for (const h of b.headlines) out.push(`- **${h.label}:** ${h.value}. ${h.detail}.${h.estimate ? " *(estimate)*" : ""} Source: [${sourceLabel(h.source)}](${sourceUrl(h.source)})`);
  out.push("", "## Questions", "");
  b.questions.forEach((q, i) => {
    out.push(`${i + 1}. ${q.text}`);
    out.push(`   - Evidence: ${q.evidence}${q.estimate ? " *(estimate)*" : ""}`);
    out.push(`   - Source: ${q.sources.map((s) => `[${sourceLabel(s)}](${sourceUrl(s)})`).join("; ")}`);
  });
  return out.join("\n");
}
