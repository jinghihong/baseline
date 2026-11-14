// Project watchlist: every capital project measured against the first number the city published. Never rebased.
import { ChevronLeft, ChevronRight, Download, Pin, PinOff, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { RankedBars } from "../../components/charts";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Select,
  SourceNote,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  Toggle,
  downloadFile,
  toCsv,
  useSort,
  type RiskLevel,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { CAPITAL_FACTS } from "../../data/curated";
import { useDataset } from "../../data/load";
import { assessAllProjects, summarizeCapital, type ProjectAssessment } from "../../engines/core";
import { BOROUGHS, CLASS_LABELS, INACTIVE_PHASES, agencyOptions, classLabel, togglePin } from "../../features/capital/shared";
import { date, duration, money, num, pct } from "../../lib/format";
import { useWorkspace } from "../../state/store";

type SortKey = "budget" | "growth" | "growthPct" | "slip" | "name";
const PAGE_SIZE = 50;
const LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High risk" },
  { value: "watch", label: "Watch" },
  { value: "low", label: "On track" },
];

export default function Watchlist() {
  const capital = useDataset("capital");
  const pinned = useWorkspace((w) => w.pinnedProjects);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const sort = useSort<SortKey>("growth");

  const filters = {
    q: params.get("q") ?? "",
    agency: params.get("agency") ?? "",
    boro: params.get("boro") ?? "",
    level: params.get("level") ?? "",
    cls: params.get("cls") ?? "",
    phase: params.get("phase") ?? "",
    all: params.get("all") === "1",
    pinned: params.get("pinned") === "1",
  };
  const setFilter = (key: string, value: string | boolean) => {
    const next = new URLSearchParams(params);
    if (value === "" || value === false) next.delete(key);
    else next.set(key, value === true ? "1" : String(value));
    setParams(next, { replace: true });
    setPage(0);
  };

  const assessed = useMemo(() => (capital.data ? assessAllProjects(capital.data) : []), [capital.data]);
  const agencies = useMemo(() => agencyOptions(assessed.map((a) => a.project.agency)), [assessed]);
  const phases = useMemo(() => [...new Set(assessed.map((a) => a.project.phase).filter(Boolean) as string[])].sort(), [assessed]);
  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return assessed.filter((a) => {
      const p = a.project;
      if (!filters.all && p.phase && INACTIVE_PHASES.has(p.phase)) return false;
      if (filters.pinned && !pinnedSet.has(p.id)) return false;
      if (filters.agency && p.agency !== filters.agency && p.sponsor !== filters.agency) return false;
      if (filters.boro && p.boro !== filters.boro) return false;
      if (filters.level && a.level !== filters.level) return false;
      if (filters.cls && p.cls !== filters.cls) return false;
      if (filters.phase && p.phase !== filters.phase) return false;
      if (q && !`${p.name} ${p.fmsId} ${p.id} ${p.category} ${agencyName(p.agency)}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessed, params, pinnedSet]);

  const sorted = useMemo(() => {
    const val = (a: ProjectAssessment): number | string => {
      switch (sort.key) {
        case "budget":
          return a.project.budget;
        case "growth":
          return a.growth;
        case "growthPct":
          return a.growthPct;
        case "slip":
          return a.slipDays;
        case "name":
          return a.project.name.toLowerCase();
      }
    };
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [filtered, sort.key, sort.dir]);

  const summary = useMemo(() => summarizeCapital(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const meta = capital.data?.meta;

  const exportCsv = () => {
    downloadFile(
      "baseline-watchlist.csv",
      toCsv(
        sorted.map((a) => ({
          id: a.project.id,
          fms_id: a.project.fmsId,
          name: a.project.name,
          managing_agency: a.project.agency,
          sponsor_agency: a.project.sponsor ?? "",
          borough: a.project.boro,
          type: classLabel(a.project.cls),
          phase: a.project.phase ?? "",
          first_budget: Math.round(a.project.firstBudget ?? a.project.budget),
          first_reported: a.project.firstPeriod ?? "",
          current_budget: Math.round(a.project.budget),
          change: Math.round(a.growth),
          change_pct: (a.growthPct * 100).toFixed(1),
          first_forecast_completion: a.project.firstForecast ?? "",
          latest_forecast_completion: a.project.forecast ?? "",
          slip_days: a.slipDays,
          risk: a.level,
          top_delay_reason: a.topReason ?? "",
        })),
      ),
      "text/csv",
    );
  };

  if (capital.error) return <ErrorBlock error={capital.error} />;

  return (
    <>
      <PageHeader
        eyebrow="Capital"
        title="Project watchlist"
        description="Every project in the city's Capital Projects Dashboard, measured against the first budget and completion date the city published. Baseline never resets the starting point."
        actions={
          <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!sorted.length}>
            Export CSV
          </Button>
        }
      />

      {capital.loading && <LoadingBlock label="Loading capital projects…" />}

      {capital.data && meta && (
        <>
          <Callout title="Why the starting point matters" className="mb-6">
            The Comptroller found that the Department of Design and Construction resets the start date it counts delays from at each phase, which hides how late projects really are, and that the city cannot
            track a project's cost from its original budget to its final cost. Baseline keeps the first number the city published (the dashboard began in {date(meta.firstPeriod)}) and measures from there. The
            dashboard itself covers only {pct(CAPITAL_FACTS.dashboard.fmsIdCoverage, { digits: 1 })} of the city's capital project IDs.
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Cite id="ddcAudit" />
              <Cite id="flyingBlind" />
            </div>
          </Callout>

          <StatGrid cols={4}>
            <Stat
              label="Projects shown"
              value={num(summary.projects)}
              detail={`${money(summary.totalBudget)} across ${num(summary.budgetIds)} budget IDs${summary.budgetIds < summary.projects ? " (shared IDs counted once)" : ""}`}
            />
            <Stat
              label="Budgets that grew since first report"
              value={num(summary.grownCount)}
              detail={`${money(summary.totalGrowth, { sign: true })} across the budgets shown`}
              tone={summary.totalGrowth > 0 ? "bad" : "neutral"}
            />
            <Stat label="Grew 20% or more" value={num(summary.over20Count)} detail={summary.budgetIds ? `${pct(summary.over20Count / summary.budgetIds)} of budgets shown` : undefined} tone="serious" />
            <Stat
              label="Completion pushed back"
              value={num(summary.slippedCount)}
              detail={summary.withScheduleCount ? `of ${num(summary.withScheduleCount)} with dates · median ${duration(summary.medianSlipDays)}` : "No schedule data"}
              tone="warn"
            />
          </StatGrid>

          <Card className="no-print mt-6">
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
                <Input aria-label="Search projects" placeholder="Search by name, ID or agency" className="pl-9" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} />
              </div>
              <Select aria-label="Agency" value={filters.agency} onChange={(e) => setFilter("agency", e.target.value)}>
                <option value="">All agencies</option>
                {agencies.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Borough" value={filters.boro} onChange={(e) => setFilter("boro", e.target.value)}>
                <option value="">All boroughs</option>
                {[...BOROUGHS, "Citywide"].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
              <Select aria-label="Risk level" value={filters.level} onChange={(e) => setFilter("level", e.target.value)}>
                <option value="">Any risk level</option>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Project type" value={filters.cls} onChange={(e) => setFilter("cls", e.target.value)}>
                <option value="">All project types</option>
                {Object.entries(CLASS_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select aria-label="Phase" value={filters.phase} onChange={(e) => setFilter("phase", e.target.value)}>
                <option value="">Any phase</option>
                {phases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap items-center gap-4">
                <Toggle checked={filters.all} onChange={(v) => setFilter("all", v)} label="Include finished" />
                <Toggle checked={filters.pinned} onChange={(v) => setFilter("pinned", v)} label={`Pinned (${pinned.length})`} />
              </div>
            </CardBody>
          </Card>

          <Card className="mt-4">
            {current.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No projects match these filters">Try clearing a filter or searching for a different name.</EmptyState>
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">
                      <span className="sr-only">Pin</span>
                    </Th>
                    <Th onClick={() => sort.toggle("name")} sorted={sort.sortedFor("name")}>
                      Project
                    </Th>
                    <Th>Phase</Th>
                    <Th align="right">First budget</Th>
                    <Th align="right" onClick={() => sort.toggle("budget")} sorted={sort.sortedFor("budget")}>
                      Current
                    </Th>
                    <Th align="right" onClick={() => sort.toggle("growth")} sorted={sort.sortedFor("growth")}>
                      Change
                    </Th>
                    <Th align="right" onClick={() => sort.toggle("slip")} sorted={sort.sortedFor("slip")}>
                      Completion
                    </Th>
                    <Th>Risk</Th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((a) => {
                    const p = a.project;
                    const isPinned = pinnedSet.has(p.id);
                    return (
                      <tr key={p.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => navigate(`/app/watchlist/${encodeURIComponent(p.id)}`)}>
                        <Td>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(p.id);
                            }}
                            className={isPinned ? "text-brand" : "text-ink-3 hover:text-ink"}
                            aria-label={isPinned ? `Unpin ${p.name}` : `Pin ${p.name}`}
                            aria-pressed={isPinned}
                          >
                            {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                          </button>
                        </Td>
                        <Td className="max-w-[320px]">
                          <Link to={`/app/watchlist/${encodeURIComponent(p.id)}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:text-brand" title={p.name}>
                            {p.name}
                          </Link>
                          <div className="truncate text-[12px] text-ink-3">
                            {p.agency}
                            {p.sponsor && p.sponsor !== p.agency ? ` for ${p.sponsor}` : ""} · {p.boro} · {classLabel(p.cls)}
                            {p.shared ? (
                              <span title="The city reports one budget ID for several projects. Totals count it once." className="ml-1.5 rounded bg-surface-2 px-1 text-[11px] text-ink-2">
                                Shared budget ×{p.shared}
                              </span>
                            ) : null}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap">{p.phase ?? "—"}</Td>
                        <Td align="right">{money(p.firstBudget ?? p.budget)}</Td>
                        <Td align="right" className="font-medium text-ink">
                          {money(p.budget)}
                        </Td>
                        <Td align="right" className={a.growthPct >= 0.2 ? "text-bad-ink" : a.growthPct < 0 ? "text-good-ink" : undefined}>
                          {a.growth === 0 ? "—" : `${money(a.growth, { sign: true })} (${pct(a.growthPct, { sign: true })})`}
                        </Td>
                        <Td align="right" className="whitespace-nowrap">
                          <div>{date(p.forecast, { short: true })}</div>
                          {a.slipDays > 0 && <div className="text-[12px] text-warn-ink">+{duration(a.slipDays)}</div>}
                        </Td>
                        <Td>
                          <RiskBadge level={a.level} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-3">
              <span>
                {sorted.length ? `${num(page * PAGE_SIZE + 1)}–${num(Math.min(sorted.length, (page + 1) * PAGE_SIZE))} of ${num(sorted.length)} projects` : "0 projects"}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" icon={<ChevronLeft className="size-4" />} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="px-2 tabular">
                  {page + 1} / {pages}
                </span>
                <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="flex-row-reverse" icon={<ChevronRight className="size-4" />}>
                  Next
                </Button>
              </div>
            </div>
          </Card>
          <SourceNote className="mt-2" href="https://data.cityofnewyork.us/d/fb86-vt7u">
            NYC Capital Projects Dashboard, {date(meta.firstPeriod)} to {date(meta.latestPeriod)} reports. Change = latest total budget minus the first total budget reported. Completion = latest forecast; the
            delay is measured from the first forecast reported.
          </SourceNote>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Why completion dates moved" subtitle="Reasons recorded each time a forecast changed, for the projects shown" />
              <CardBody>
                {summary.reasons.length ? (
                  <RankedBars rows={summary.reasons.slice(0, 8).map(([label, n]) => ({ id: label, label, value: n }))} format={(v) => num(v)} />
                ) : (
                  <p className="text-[14px] text-ink-3">No delay reasons recorded for these projects.</p>
                )}
                <SourceNote className="mt-3" href="https://data.cityofnewyork.us/d/95tx-snak">
                  Capital Projects Dashboard schedule history. Counts are schedule changes, not projects.
                </SourceNote>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Risk mix" subtitle="Critical: budget up 50%+ or 2+ years late. High: up 20%+ or 1+ year late. Watch: up 5%+ or 3+ months late." />
              <CardBody>
                <RankedBars
                  rows={LEVELS.map((l) => ({ id: l.value, label: <RiskBadge level={l.value} />, value: summary.byLevel[l.value] }))}
                  format={(v) => num(v)}
                  onSelect={(id) => setFilter("level", filters.level === id ? "" : id)}
                  selected={filters.level || null}
                />
                <p className="mt-3 text-[12.5px] text-ink-3">Click a level to filter the table.</p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
