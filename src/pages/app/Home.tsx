// Home: a role-specific briefing. Same data for both roles; different questions answered first.
import { ArrowRight, Calculator, ClipboardList, FileSpreadsheet, Gavel, Gauge, HandCoins, MapPin, Pin, Scale, Timer, Wrench } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { RankedBars, TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Section,
  SourceNote,
  Stat,
  StatGrid,
  type RiskLevel,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { AIMS_FACTS, FY27_COMPTROLLER_GAP, FY27_OMB_GAP } from "../../data/curated";
import { useDatasets } from "../../data/load";
import { assessAllLines, assessAllOvertime, assessAllProjects, summarizeCapital, uniqueBudgets } from "../../engines/core";
import { date, duration, fy, money, num, pct } from "../../lib/format";
import { useWorkspace, type Role } from "../../state/store";

const LEVEL_ORDER: Record<RiskLevel, number> = { critical: 3, high: 2, watch: 1, low: 0 };

interface Alert {
  id: string;
  level: RiskLevel;
  title: string;
  detail: string;
  to: string;
  kind: string;
}

export default function Home() {
  const role = useWorkspace((w) => w.role);
  const pinned = useWorkspace((w) => w.pinnedProjects);
  const estimates = useWorkspace((w) => w.estimates);
  const { data, error, loading } = useDatasets(["overtime", "capital", "budgetLines", "manifest"]);

  const model = useMemo(() => {
    if (!data) return null;
    const ot = assessAllOvertime(data.overtime);
    const projects = assessAllProjects(data.capital);
    const capital = summarizeCapital(projects);
    const lines = assessAllLines(data.budgetLines).filter((l) => !l.technical);
    const chronic = lines.filter((l) => l.chronic);

    const nextFy = Math.max(...ot.map((o) => o.nextFy));
    const otNext = ot.filter((o) => o.nextFy === nextFy && o.nextAdopted !== null);
    const otAdopted = otNext.reduce((s, o) => s + (o.nextAdopted ?? 0), 0);
    const otForecast = otNext.reduce((s, o) => s + o.forecast, 0);

    // Citywide overtime series across matched agencies.
    const years = new Map<number, { fy: number; adopted: number; actual: number }>();
    for (const o of data.overtime.agencies) {
      for (const y of o.years) {
        if (y.fy < 2017) continue;
        const cur = years.get(y.fy) ?? { fy: y.fy, adopted: 0, actual: 0 };
        cur.adopted += y.adopted ?? 0;
        cur.actual += y.actual ?? 0;
        years.set(y.fy, cur);
      }
    }
    const otSeries = [...years.values()]
      .sort((a, b) => a.fy - b.fy)
      .map((y) => ({ fy: y.fy, adopted: y.adopted || null, actual: y.actual || null }));

    // Growth by agency since first report.
    const distinct = uniqueBudgets(projects);
    const growthByAgency = new Map<string, number>();
    for (const p of distinct) if (p.growth > 0) growthByAgency.set(p.project.agency, (growthByAgency.get(p.project.agency) ?? 0) + p.growth);
    const growthRows = [...growthByAgency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([code, v]) => ({ id: code, label: agencyName(code), value: v }));

    const alerts: Alert[] = [];
    for (const o of ot.filter((o) => o.level === "critical" || o.level === "high").slice(0, 4)) {
      alerts.push({
        id: `ot-${o.agency.code}`,
        kind: "Overtime",
        level: o.level,
        title: `${o.agency.name}: overtime likely ${money(o.expectedShortfall)} above the ${fy(o.nextFy)} budget`,
        detail: `Paid ${money(o.latestActual)} in ${fy(o.latestActualFy)} against ${money(o.latestAdoptedForActualYear)} adopted.`,
        to: "/app/overtime",
      });
    }
    // Projects whose first budget was tiny usually had only design money at first report; rank by dollars but skip those.
    for (const p of [...distinct].filter((a) => (a.project.firstBudget ?? 0) >= 25e6).sort((a, b) => b.growth - a.growth).slice(0, 4)) {
      alerts.push({
        id: `cap-${p.project.id}`,
        kind: "Capital",
        level: p.level,
        title: `${p.project.name}: budget up ${money(p.growth)} (${pct(p.growthPct)})`,
        detail: `${agencyName(p.project.agency)} · first reported ${money(p.project.firstBudget)} in ${date(p.project.firstPeriod)}${p.slipDays ? ` · ${duration(p.slipDays)} later than first forecast` : ""}.`,
        to: `/app/watchlist/${encodeURIComponent(p.project.id)}`,
      });
    }
    for (const l of chronic.slice(0, 3)) {
      alerts.push({
        id: `line-${l.key}`,
        kind: "Budget line",
        level: l.level,
        title: `${titleCase(l.line.agency)} · ${titleCase(l.line.objectClass)} ends the year above adoption`,
        detail: `Above adoption in ${l.yearsOver} of ${l.yearsAssessed} years; typical increase ${pct(l.medianRatio - 1)}. Expect about ${money(l.expectedIncrease)} more in ${fy(l.latestAdoptedFy)}.`,
        to: "/app/second-opinion",
      });
    }
    alerts.sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);

    const pinnedProjects = projects.filter((p) => pinned.includes(p.project.id));
    return { ot, capital, chronic, nextFy, otAdopted, otForecast, otSeries, growthRows, alerts, pinnedProjects, latestPeriod: data.capital.meta.latestPeriod };
  }, [data, pinned]);

  if (loading) return <LoadingBlock label="Building your briefing…" />;
  if (error || !model) return <ErrorBlock error={error ?? "No data"} />;

  const chronicIncrease = model.chronic.reduce((s, l) => s + l.expectedIncrease, 0);
  const gapDelta = FY27_COMPTROLLER_GAP[1] - FY27_OMB_GAP[1];

  return (
    <>
      <PageHeader
        eyebrow={role === "budget" ? "Budget office briefing" : "Council oversight briefing"}
        title={role === "budget" ? "Where this budget is likely to slip" : "What to question in this budget"}
        description={
          role === "budget"
            ? "The lines and projects most likely to cost more than planned, measured against the city's own track record."
            : "Independent checks on the mayor's numbers, ranked by how much money is at stake."
        }
        actions={<Badge tone="neutral">Capital data through {date(model.latestPeriod)}</Badge>}
      />

      <StatGrid cols={4}>
        {role === "budget" ? (
          <>
            <Stat
              label="Capital budgets since first report"
              value={money(model.capital.totalGrowth, { sign: true })}
              detail={`${num(model.capital.grownCount)} of ${num(model.capital.budgetIds)} project budgets grew`}
              tone="bad"
              source={<SourceNote>Capital Projects Dashboard</SourceNote>}
            />
            <Stat
              label="Project budgets 20%+ over first report"
              value={num(model.capital.over20Count)}
              detail={`${pct(model.capital.over20Count / model.capital.budgetIds)} of tracked budgets`}
              tone="serious"
            />
            <Stat
              label={`${fy(model.nextFy)} overtime: budget vs forecast`}
              value={money(model.otForecast - model.otAdopted, { sign: true })}
              detail={`${money(model.otAdopted)} adopted · ${money(model.otForecast)} expected (estimate)`}
              tone="bad"
              source={<SourceNote>Expense Budget + Payroll</SourceNote>}
            />
            <Stat
              label="Lines that grow after adoption"
              value={num(model.chronic.length)}
              detail={`About ${money(chronicIncrease)} expected in-year increase`}
              tone="warn"
            />
          </>
        ) : (
          <>
            <Stat
              label={`${fy(2028)} gap: Comptroller vs OMB`}
              value={money(gapDelta * 1e6, { sign: true })}
              detail={`OMB ${money(FY27_OMB_GAP[1] * 1e6)} · Comptroller ${money(FY27_COMPTROLLER_GAP[1] * 1e6)}`}
              tone="bad"
              source="fy27Adopted"
            />
            <Stat
              label={`${fy(model.nextFy)} overtime likely above budget`}
              value={money(model.otForecast - model.otAdopted)}
              detail="Baseline estimate from actual payroll"
              tone="bad"
            />
            <Stat
              label="Projects finishing later than first promised"
              value={num(model.capital.slippedCount)}
              detail={`of ${num(model.capital.withScheduleCount)} with schedules · median ${duration(model.capital.medianSlipDays)}`}
              tone="serious"
            />
            <Stat label="Budget lines adopted too low" value={num(model.chronic.length)} detail={`≈ ${money(chronicIncrease)} added mid-year`} tone="warn" />
          </>
        )}
      </StatGrid>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Needs attention" subtitle="Ranked by risk level. Every item links to the evidence." />
          <ul className="divide-y divide-line">
            {model.alerts.slice(0, 9).map((a) => (
              <li key={a.id}>
                <Link to={a.to} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2">
                  <div className="mt-0.5 w-[92px] shrink-0">
                    <RiskBadge level={a.level} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{a.title}</div>
                    <div className="mt-0.5 text-[12.5px] text-ink-3">
                      <span className="font-medium text-ink-2">{a.kind}</span> · {a.detail}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-6">
          <QuickActions role={role} />
          {model.pinnedProjects.length > 0 && (
            <Card>
              <CardHeader title="Pinned projects" subtitle="Projects you are tracking" />
              <ul className="divide-y divide-line">
                {model.pinnedProjects.slice(0, 6).map((p) => (
                  <li key={p.project.id}>
                    <Link to={`/app/watchlist/${encodeURIComponent(p.project.id)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <Pin className="size-3.5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{p.project.name}</span>
                      <RiskBadge level={p.level} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {role === "budget" && estimates.length > 0 && (
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-ink">{estimates.length} saved estimate{estimates.length === 1 ? "" : "s"}</div>
                    <div className="text-[12.5px] text-ink-3">Latest: {estimates[0].name}</div>
                  </div>
                  <Link to="/app/forecaster" className="text-[13px] font-medium text-brand hover:underline">
                    Open
                  </Link>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <TimeSeriesChart
              title="Overtime: adopted vs actually paid"
              subtitle={`${model.ot.length} largest agencies, all funds`}
              data={model.otSeries}
              xKey="fy"
              xFormat={(v) => fy(Number(v))}
              yFormat={(v) => money(v)}
              series={[
                { key: "adopted", label: "Adopted budget", slot: 0, kind: "bar" },
                { key: "actual", label: "Actually paid", slot: 1 },
              ]}
              height={250}
              footer={<SourceNote href="https://data.cityofnewyork.us/d/k397-673e">NYC Expense Budget and Citywide Payroll Data</SourceNote>}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Where capital budgets grew" subtitle="Increase since each project was first reported, by managing agency" actions={<Link to="/app/watchlist" className="text-[13px] font-medium text-brand hover:underline">Watchlist</Link>} />
          <CardBody>
            <RankedBars rows={model.growthRows} format={(v) => money(v)} slot={1} />
          </CardBody>
        </Card>
      </div>

      <Section className="mt-8">
        <Callout tone="neutral" title="Why Baseline exists">
          In 2020 the city's asset survey (AIMS) estimated {money(AIMS_FACTS.riverside.aimsEstimate)} to repair the Riverside Park bridge at W. 79th Street. The bid came in at{" "}
          {money(AIMS_FACTS.riverside.bid)}. Baseline prices work from what similar projects actually cost, and keeps the first number on record. <Cite id="aimsAudit" className="ml-1" />
        </Callout>
      </Section>
    </>
  );
}

function QuickActions({ role }: { role: Role }) {
  const items =
    role === "budget"
      ? [
          { to: "/app/forecaster", icon: Calculator, label: "Price a project", hint: "P50 / P80 from past projects" },
          { to: "/app/maintenance", icon: Wrench, label: "Rank repairs", hint: "Fund the riskiest assets first" },
          { to: "/app/spend-tracker", icon: Gauge, label: "Track a line", hint: "Year-end from monthly actuals" },
          { to: "/app/grants", icon: HandCoins, label: "Find funding", hint: "Open federal grants" },
        ]
      : [
          { to: "/app/hearings", icon: Gavel, label: "Prep a hearing", hint: "Brief + questions with sources" },
          { to: "/app/second-opinion", icon: Scale, label: "Second opinion", hint: "Lines adopted too low" },
          { to: "/app/fiscal-notes", icon: FileSpreadsheet, label: "Cost a bill", hint: "5-year fiscal impact" },
          { to: "/app/district", icon: MapPin, label: "Your district", hint: "Awards, projects, 311" },
        ];
  const more =
    role === "budget"
      ? { to: "/app/overtime", icon: Timer, label: "Overtime monitor" }
      : { to: "/app/watchlist", icon: ClipboardList, label: "Project watchlist" };
  return (
    <Card>
      <CardHeader title="Start here" />
      <div className="grid grid-cols-2 gap-px bg-line">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className="flex flex-col gap-1 bg-surface p-4 hover:bg-surface-2">
            <i.icon className="size-4 text-brand" />
            <span className="text-[14px] font-semibold text-ink">{i.label}</span>
            <span className="text-[12.5px] text-ink-3">{i.hint}</span>
          </Link>
        ))}
      </div>
      <Link to={more.to} className="flex items-center gap-2 border-t border-line px-5 py-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
        <more.icon className="size-4" />
        {more.label}
        <ArrowRight className="ml-auto size-4" />
      </Link>
    </Card>
  );
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Of|And|For|The)\b/g, (m) => m.toLowerCase());
}
