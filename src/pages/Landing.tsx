import {
  ArrowRight,
  BookOpen,
  Calculator,
  CircleCheck,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Gavel,
  Gauge,
  HandCoins,
  Landmark,
  Lock,
  MapPin,
  MessageSquareText,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
  Timer,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ButtonLink, Card, Cite, cn, Skeleton } from "../components/ui";
import { AIMS_FACTS, CAPITAL_FACTS, COMPETITORS, BUDGET_FACTS } from "../data/curated";
import { useDatasets } from "../data/load";
import { date, fy, money, num, pct } from "../lib/format";
import { capitalProof, overtimeProof, riversideCheck } from "../features/platform/proof";

export default function Landing() {
  return (
    <>
      <Hero />
      <AimsStory />
      <Product />
      <HowItWorks />
      <Comparison />
      <Trust />
      <Pricing />
      <Faq />
      <FinalCta />
    </>
  );
}

function SectionShell({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow: string; title: ReactNode; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 border-t border-line", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <div className="text-[12.5px] font-semibold tracking-wide text-brand uppercase">{eyebrow}</div>
          <h2 className="mt-2 text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">{title}</h2>
          {intro && <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{intro}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

// ---- Hero --------------------------------------------------------------------------------------------
function Hero() {
  const { data, loading, error } = useDatasets(["capital", "overtime"]);
  const cap = data ? capitalProof(data.capital) : null;
  const ot = data ? overtimeProof(data.overtime) : null;
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 lg:pt-24 lg:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-2 shadow-card">
            <span className="size-1.5 rounded-full bg-good" /> Live on New York City's open data
          </span>
          <h1 className="mt-6 text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[56px]">
            The budget office and the council, finally working from the same numbers.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-pretty text-ink-2 sm:text-[18px]">
            Baseline forecasts what capital projects will really cost and which budget lines will run over, using the city's own track record. Every figure links to its source.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink to="/app" variant="primary" size="lg" icon={<ArrowRight className="size-4" />} className="w-full flex-row-reverse sm:w-auto">
              Open the app
            </ButtonLink>
            <ButtonLink to="/brief" size="lg" icon={<BookOpen className="size-4" />} className="w-full sm:w-auto">
              Read the research brief
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-ink-3">No sign-up. Runs in your browser on public data.</p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-3">
          <ProofTile
            loading={loading}
            error={!!error}
            value={cap ? pct(cap.grownShare) : ""}
            label="of NYC capital projects now cost more than the first budget the city published"
            detail={cap ? `${money(cap.growth)} added since ${date(cap.firstPeriod)}` : ""}
            source="Capital Projects Dashboard, NYC Open Data · Baseline analysis"
          />
          <ProofTile
            loading={loading}
            error={!!error}
            value={ot ? `${ot.ratio.toFixed(1)}×` : ""}
            label={ot ? `overtime paid vs. adopted in ${fy(ot.fy)}` : "overtime paid vs. adopted"}
            detail={ot ? `${money(ot.actual)} paid against ${money(ot.adopted)} budgeted, ${ot.agencies} agencies` : ""}
            source="Expense Budget + Citywide Payroll, NYC Open Data"
          />
          <ProofTile
            loading={loading}
            error={!!error}
            value={cap ? pct(cap.slippedShare) : ""}
            label="of tracked completion dates have been pushed back since first published"
            detail={cap ? `of ${num(cap.withSchedule)} projects with a published forecast` : ""}
            source="Capital Projects Dashboard schedule history"
          />
        </div>
      </div>
    </section>
  );
}

function ProofTile({ value, label, detail, source, loading, error }: { value: string; label: string; detail: string; source: string; loading: boolean; error: boolean }) {
  return (
    <Card className="p-5">
      {loading ? (
        <>
          <Skeleton className="h-9 w-24" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </>
      ) : error ? (
        <p className="text-[13.5px] text-ink-3">Live figures could not load. Open the app to retry.</p>
      ) : (
        <>
          <div className="text-[34px] leading-none font-semibold tracking-tight text-ink">{value}</div>
          <p className="mt-2 text-[14px] leading-snug text-ink-2">{label}</p>
          <p className="mt-2 text-[13px] font-medium text-ink">{detail}</p>
        </>
      )}
      <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-ink-3">{source}</p>
    </Card>
  );
}

// ---- AIMS story -----------------------------------------------------------------------------------------
function AimsStory() {
  const { data, loading } = useDatasets(["reference"]);
  const check = data ? riversideCheck(data.reference) : null;
  const scaleMax = check ? Math.max(check.p90, check.actual) * 1.05 : 1;
  const rows = check
    ? [
        { label: "AIMS estimate (2020)", value: check.estimate, tone: "muted" as const },
        { label: "Baseline, median", value: check.p50, tone: "brand" as const },
        { label: "Baseline, 80% confidence", value: check.p80, tone: "brand" as const },
        { label: "Baseline, 90% confidence", value: check.p90, tone: "brand" as const },
        { label: "Actual bid", value: check.actual, tone: "ink" as const },
      ]
    : [];
  return (
    <SectionShell
      eyebrow="The problem"
      title="New York's infrastructure report missed a bridge repair by half."
      intro={
        <>
          The city's AIMS report is supposed to tell planners what repairs will cost. In 2020 it put the Riverside Park bridge at the West 79th Street traffic circle at {money(AIMS_FACTS.riverside.aimsEstimate)}. A few months later the bid came in at{" "}
          {money(AIMS_FACTS.riverside.bid, { digits: 1 })}. <Cite id="aimsAudit" />
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid gap-3">
          {[
            { k: `${AIMS_FACTS.surveyMinutes.fdnyMinutes} minutes`, v: `to survey a ${num(AIMS_FACTS.surveyMinutes.fdnySqft)} sq ft FDNY building. Inspections are quick visual checks.` },
            { k: `${AIMS_FACTS.unreportedConditions.conditions} problems`, v: `of structural integrity that AIMS never reported, found by auditors at just ${AIMS_FACTS.unreportedConditions.assets} assets.` },
            { k: `${money(AIMS_FACTS.emergencyProcurements)}+`, v: "spent on emergency procurements for structural problems over five years." },
            { k: pct(CAPITAL_FACTS.ddc.lateShare), v: "of projects at the city's construction agency behind their original schedule, by 3.5 years on average." },
          ].map((f) => (
            <Card key={f.k} className="flex gap-4 p-4">
              <div className="w-28 shrink-0 text-[22px] leading-tight font-semibold tracking-tight text-ink">{f.k}</div>
              <p className="text-[14px] text-ink-2">{f.v}</p>
            </Card>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Cite id="aimsAudit" />
            <Cite id="betterAims" />
            <Cite id="ddcAudit" />
          </div>
        </div>
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-semibold tracking-wide text-brand uppercase">Would Baseline have caught it?</div>
              <h3 className="mt-1 text-[18px] font-semibold text-ink">Pricing the bridge against the city's own history</h3>
            </div>
            <Calculator className="size-5 shrink-0 text-ink-3" />
          </div>
          {loading || !check ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-5 space-y-3" role="list">
                {rows.map((r) => (
                  <div key={r.label} role="listitem" className="grid grid-cols-[130px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[170px_minmax(0,1fr)_72px]">
                    <span className={cn("text-[13px]", r.tone === "ink" ? "font-semibold text-ink" : "text-ink-2")}>{r.label}</span>
                    <span className="h-3 rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(r.value / scaleMax) * 100}%`,
                          background: r.tone === "brand" ? "var(--s1)" : r.tone === "ink" ? "var(--ink)" : "var(--axis)",
                        }}
                      />
                    </span>
                    <span className="tabular text-right text-[13.5px] font-semibold text-ink">{money(r.value)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[14px] leading-relaxed text-ink-2">
                Compared against {num(check.comparables)} past NYC bridge projects, weighted toward ones of similar size, agency and borough, the {money(check.estimate)} estimate becomes {money(check.p50)} at the median and{" "}
                {money(check.p80)} at 80% confidence. The actual bid lands {check.actual <= check.p90 ? "inside" : "outside"} Baseline's 90% range. A planner would have known on day one that {money(check.estimate)} was unlikely to hold.
              </p>
              <p className="mt-3 text-[12px] text-ink-3">Baseline estimate from Capital Project Detail Data (NYC Open Data, Oct 2023). Ranges, not promises.</p>
            </>
          )}
        </Card>
      </div>
    </SectionShell>
  );
}

// ---- Product ---------------------------------------------------------------------------------------------
const BUDGET_FEATURES = [
  { icon: Calculator, title: "Cost forecaster", body: "Price a project from what similar city projects really cost, as a range you can defend.", to: "/app/forecaster" },
  { icon: Timer, title: "Overtime monitor", body: "See adopted vs. actual overtime for each agency, with next year's forecast and shortfall.", to: "/app/overtime" },
  { icon: Wrench, title: "Maintenance risk", body: "Rank assets by failure risk and fund the repairs that remove the most risk per dollar.", to: "/app/maintenance" },
  { icon: Gauge, title: "Spend tracker", body: "Project year-end spending from monthly actuals before mid-year modifications.", to: "/app/spend-tracker" },
];
const COUNCIL_FEATURES = [
  { icon: Scale, title: "Second opinion", body: "Budget lines adopted too low year after year, with the history to prove it.", to: "/app/second-opinion" },
  { icon: Gavel, title: "Hearing prep", body: "A brief and data-backed questions for any agency, ready before the hearing.", to: "/app/hearings" },
  { icon: FileSpreadsheet, title: "Fiscal notes", body: "Estimate what a proposed bill will cost over five years, with a range.", to: "/app/fiscal-notes" },
  { icon: MapPin, title: "District view", body: "Capital awards, projects at risk and 311 demand for one Council district.", to: "/app/district" },
];

function Product() {
  return (
    <SectionShell
      id="product"
      eyebrow="Product"
      title="One forecasting engine. Two workspaces, each built around a real job."
      intro="Both sides argue over the same numbers every budget season. Baseline gives them one set they can both inspect, then focuses each workspace on what that team actually has to do."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <RoleCard icon={Landmark} role="Budget office" tagline="Build a budget that holds." features={BUDGET_FEATURES} />
        <RoleCard icon={Gavel} role="City council" tagline="Check the numbers you're asked to approve." features={COUNCIL_FEATURES} />
      </div>
      <Card className="mt-4 grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        {[
          { icon: ClipboardList, title: "Project watchlist", body: "Every project against its first published budget and date. The baseline never moves." },
          { icon: HandCoins, title: "Grant finder", body: "Open federal funding that city governments can apply for, matched to project types." },
          { icon: MessageSquareText, title: "Ask Baseline", body: "Ask in plain English and get an answer with its sources. Works offline; Claude is optional." },
        ].map((f) => (
          <div key={f.title} className="flex gap-3">
            <f.icon className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <div className="text-[14.5px] font-semibold text-ink">{f.title}</div>
              <p className="mt-0.5 text-[13.5px] text-ink-2">{f.body}</p>
            </div>
          </div>
        ))}
      </Card>
    </SectionShell>
  );
}

function RoleCard({ icon: Icon, role, tagline, features }: { icon: typeof Landmark; role: string; tagline: string; features: typeof BUDGET_FEATURES }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="size-5" />
        </span>
        <div>
          <div className="text-[17px] font-semibold text-ink">{role}</div>
          <div className="text-[13.5px] text-ink-3">{tagline}</div>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {features.map((f) => (
          <Link key={f.title} to={f.to} className="group flex gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-line hover:bg-surface-2">
            <f.icon className="mt-0.5 size-4.5 shrink-0 text-ink-3 group-hover:text-brand" />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[14.5px] font-semibold text-ink">
                {f.title}
                <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
              </span>
              <span className="block text-[13.5px] text-ink-2">{f.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ---- How it works ----------------------------------------------------------------------------------------
function HowItWorks() {
  const steps = [
    { icon: Database, title: "Start from the city's own data", body: "Expense budget, payroll, capital projects, 311 and federal grants, refreshed from NYC Open Data and Grants.gov." },
    { icon: Calculator, title: "Test every number against history", body: "Each estimate is compared with what similar work actually cost and how long it took. Each budget line with how it really ended the year." },
    { icon: MessageSquareText, title: "Answer with sources", body: "Ranges instead of single numbers, a link behind every figure, and plain-English answers your colleagues can check." },
  ];
  return (
    <SectionShell eyebrow="How it works" title="No black box. Just the city's record, used well.">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className="h-full p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-page">{i + 1}</span>
                <s.icon className="size-5 text-brand" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
            </Card>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

// ---- Comparison ------------------------------------------------------------------------------------------
function Comparison() {
  return (
    <SectionShell
      eyebrow="Landscape"
      title="Existing tools help run the budget process. Baseline checks whether the numbers will hold."
      intro="Incumbents sell to the finance department and help it produce documents. Nobody we found prices capital projects from the city's own history, or builds for council oversight staff."
    >
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="bg-surface-2 text-[12.5px] text-ink-3">
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">What it does</th>
              <th className="px-4 py-3 font-semibold">AI today</th>
              <th className="px-4 py-3 font-semibold">Where it stops</th>
            </tr>
          </thead>
          <tbody>
            {COMPETITORS.map((c) => (
              <tr key={c.name} className="border-t border-line align-top">
                <td className="px-4 py-3 font-semibold whitespace-nowrap text-ink">{c.name}</td>
                <td className="px-4 py-3 text-ink-2">{c.what}</td>
                <td className="px-4 py-3 text-ink-2">{c.aiAngle}</td>
                <td className="px-4 py-3 text-ink-2">{c.gap}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-brand-soft align-top">
              <td className="px-4 py-3 font-semibold whitespace-nowrap text-brand">Baseline</td>
              <td className="px-4 py-3 text-ink">Independent forecasts for the budget office and the council on the same numbers.</td>
              <td className="px-4 py-3 text-ink">Optional analyst that answers only from cited city data.</td>
              <td className="px-4 py-3 text-ink">Prices projects from the city's own track record; flags lines adopted too low; never rebases.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-ink-3">Based on public product announcements and coverage through November 2026. See the research brief for sources.</p>
    </SectionShell>
  );
}

// ---- Trust -----------------------------------------------------------------------------------------------
function Trust() {
  const items = [
    { icon: Quote, title: "Every number has a source", body: "Each figure links to the dataset or report it came from. Estimates are labeled as estimates." },
    { icon: Gauge, title: "Ranges, not guesses", body: "Forecasts show how wide the uncertainty is, and how many past cases they rest on." },
    { icon: Sparkles, title: "AI is optional", body: "The built-in analyst works without AI. Connect Claude with your own key, and it answers only from the same cited facts." },
    { icon: Lock, title: "Your work stays with you", body: "Estimates, notes and imports live in your browser. An API key is sent only to Anthropic, never to us." },
  ];
  return (
    <SectionShell
      eyebrow="Trust"
      title="Built for people who have to defend their numbers in public."
      intro={
        <>
          In October 2026 the NYC Council held a special hearing on the risks of AI. <Cite id="councilAiHearing" /> Councils are right to be skeptical. Baseline earns trust the boring way: show the work.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((t) => (
          <Card key={t.title} className="p-5">
            <t.icon className="size-5 text-brand" />
            <h3 className="mt-3 text-[15px] font-semibold text-ink">{t.title}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{t.body}</p>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

// ---- Pricing ---------------------------------------------------------------------------------------------
function Pricing() {
  const tiers = [
    {
      name: "Pilot",
      price: "$0",
      period: "for 90 days",
      body: "One budget office or council finance team, on public data.",
      features: ["Every tool in both workspaces", "Your city's open data loaded", "Onboarding session", "Export everything you make"],
      cta: "Start with the demo",
      highlight: false,
    },
    {
      name: "Council",
      price: "From $30K",
      period: "per year",
      body: "For a legislative body and its finance and member staff.",
      features: ["Second opinion and hearing prep", "Fiscal notes for every bill", "District views for each member", "Unlimited staff seats"],
      cta: "Explore the council workspace",
      highlight: true,
    },
    {
      name: "City",
      price: "From $75K",
      period: "per year",
      body: "For the budget office. Priced by population and capital program size.",
      features: ["Cost forecaster on your project history", "Private data connections", "Maintenance and debt planning", "Single sign-on and support"],
      cta: "Explore the budget workspace",
      highlight: false,
    },
  ];
  return (
    <SectionShell eyebrow="Pricing" title="Start free on one budget cycle." intro="Proposed pilot pricing. It will change with what we learn from the first cities.">
      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.name} className={cn("flex flex-col p-6", t.highlight && "border-brand ring-1 ring-brand")}>
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-ink">{t.name}</div>
              {t.highlight && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] font-semibold text-brand">Fastest to buy</span>}
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-[32px] font-semibold tracking-tight text-ink">{t.price}</span>
              <span className="text-[13.5px] text-ink-3">{t.period}</span>
            </div>
            <p className="mt-1 text-[13.5px] text-ink-2">{t.body}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13.5px] text-ink-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
                  {f}
                </li>
              ))}
            </ul>
            <ButtonLink to="/app" variant={t.highlight ? "primary" : "secondary"} className="mt-6 w-full">
              {t.cta}
            </ButtonLink>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

// ---- FAQ -------------------------------------------------------------------------------------------------
function Faq() {
  const faqs = [
    {
      q: "Is Baseline an official city tool?",
      a: "No. Baseline is independent and not affiliated with the City of New York. It uses the data the city publishes, and the reviews published by the NYC and New York State Comptrollers.",
    },
    {
      q: "Where do the numbers come from?",
      a: "NYC Open Data (expense budget, payroll, capital projects, 311 and Council capital awards), Grants.gov, and published Comptroller reports. The Data & imports page lists every source and when it was last refreshed.",
    },
    {
      q: "How accurate are the forecasts?",
      a: `They are as good as the city's own history. The cost forecaster shows a range and how many past projects it rests on. The 2023 reference projects were mostly still under way, so real overruns are likely larger. Read the methodology for every known limit.`,
    },
    {
      q: "Do I need an AI subscription?",
      a: "No. Every tool, including Ask Baseline, works without AI. If you add your own Anthropic API key, Claude can answer open-ended questions, using only the facts Baseline gives it.",
    },
    {
      q: "Does my data leave my browser?",
      a: "Your estimates, notes and imports are stored in your browser. If you connect Claude, your questions and a summary of public data go to Anthropic's API with your key. Nothing is sent to Baseline.",
    },
    {
      q: "Can we use our own data?",
      a: "Yes. Import your past capital projects to calibrate the cost forecaster, or your asset register for maintenance planning. Paid tiers add private data connections.",
    },
  ];
  return (
    <SectionShell eyebrow="FAQ" title="Questions we hear from budget staff.">
      <div className="grid gap-3 md:grid-cols-2">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-xl border border-line bg-surface p-5 shadow-card open:shadow-pop">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-semibold text-ink">
              {f.q}
              <span className="mt-0.5 text-ink-3 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

// ---- Final CTA -------------------------------------------------------------------------------------------
function FinalCta() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <Card className="relative overflow-hidden p-8 text-center sm:p-12">
          <ShieldCheck className="mx-auto size-8 text-brand" />
          <h2 className="mx-auto mt-4 max-w-2xl text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">
            Next June, walk into the budget negotiation with numbers both sides can check.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15.5px] text-ink-2">
            The Comptroller estimates FY27 overtime alone is under-budgeted by {money(589e6)}, and that predictable costs averaging {money(BUDGET_FACTS.chronicUnderbudgetingAvg)} a year are left out of preliminary budgets.
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <Cite id="fy27Adopted" />
            <Cite id="fy26Prelim" />
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/app" variant="primary" size="lg" icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
              Open the app
            </ButtonLink>
            <ButtonLink to="/methodology" size="lg">
              How the forecasts work
            </ButtonLink>
          </div>
        </Card>
      </div>
    </section>
  );
}
