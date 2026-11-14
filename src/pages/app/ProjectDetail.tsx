// One capital project: budget history from the first published number, schedule slips, and what similar projects did.
import { ArrowLeft, ExternalLink, HandCoins, Pin, PinOff, Printer, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { RankedBars, TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  SourceNote,
  Stat,
  StatGrid,
  Textarea,
  toast,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { useDatasets } from "../../data/load";
import { forecastCost, ratioPercentile } from "../../engines/costForecast";
import { assessProject } from "../../engines/core";
import { ConfidenceBadge, ForecastBands, classLabel, togglePin } from "../../features/capital/shared";
import { date, duration, money, num, pct } from "../../lib/format";
import { updateWorkspace, useWorkspace } from "../../state/store";

const periodLabel = (p: unknown) => date(String(p));

/** Router params arrive decoded; decode again only if a raw %-sequence is still present. */
function safeDecode(v: string): string {
  try {
    return /%[0-9a-f]{2}/i.test(v) ? decodeURIComponent(v) : v;
  } catch {
    return v;
  }
}

export default function ProjectDetail() {
  const { id: rawId } = useParams();
  const id = safeDecode(rawId ?? "");
  const data = useDatasets(["capital", "reference", "grants"]);
  const pinned = useWorkspace((w) => w.pinnedProjects.includes(id));
  const savedNote = useWorkspace((w) => w.projectNotes[id] ?? "");
  const [note, setNote] = useState(savedNote);
  useEffect(() => setNote(savedNote), [savedNote, id]);

  const project = useMemo(() => data.data?.capital.projects.find((p) => p.id === id) ?? null, [data.data, id]);
  const assessment = useMemo(() => (project ? assessProject(project) : null), [project]);

  const history = useMemo(() => {
    if (!project || !data.data) return [];
    const periods = data.data.capital.meta.periods;
    const series = project.series ?? (project.firstPeriod ? [[project.firstPeriod, project.firstBudget ?? project.budget] as [string, number]] : []);
    let last: number | null = null;
    return periods.map((period) => {
      const hit = [...series].reverse().find(([p]) => p <= period);
      if (hit) last = hit[1];
      return { period, budget: hit ? last : null };
    });
  }, [project, data.data]);

  const similar = useMemo(() => {
    if (!project || !data.data) return null;
    const first = project.firstBudget && project.firstBudget > 0 ? project.firstBudget : project.budget;
    return forecastCost(data.data.reference.projects, { assetClass: project.cls, agency: project.agency, boro: project.boro, estimate: first });
  }, [project, data.data]);

  const grants = useMemo(() => {
    if (!project || !data.data) return [];
    const themes = new Set(data.data.grants.meta.themes.filter((t) => t.classes.includes(project.cls)).map((t) => t.id));
    const today = new Date().toISOString().slice(0, 10);
    return data.data.grants.opportunities
      .filter((o) => o.themes.some((t) => themes.has(t)) && (!o.closeDate || o.closeDate >= today))
      .sort((a, b) => (a.closeDate ?? "9999").localeCompare(b.closeDate ?? "9999"))
      .slice(0, 5);
  }, [project, data.data]);

  const saveNote = () => {
    if (note === savedNote) return;
    updateWorkspace((w) => {
      if (note.trim()) w.projectNotes[id] = note;
      else delete w.projectNotes[id];
    });
    toast("Note saved");
  };

  if (data.error) return <ErrorBlock error={data.error} />;
  if (data.loading) return <LoadingBlock label="Loading project…" />;
  if (!project || !assessment) {
    return (
      <EmptyState icon={<SearchX className="size-6" />} title="Project not found" action={<ButtonLink to="/app/watchlist">Back to the watchlist</ButtonLink>}>
        No project with the ID “{id}” is in the latest Capital Projects Dashboard. It may have been completed, renamed or removed.
      </EmptyState>
    );
  }

  const first = project.firstBudget ?? project.budget;
  const reasons = Object.entries(project.reasons ?? {}).sort((a, b) => b[1] - a[1]);
  const currentRatio = first > 0 ? project.budget / first : 1;
  const shareAtOrAbove = similar ? 1 - ratioPercentile(similar, currentRatio - 1e-6) : null;

  return (
    <>
      <Link to="/app/watchlist" className="no-print mb-3 inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Project watchlist
      </Link>
      <PageHeader
        eyebrow={`${agencyName(project.agency)}${project.sponsor && project.sponsor !== project.agency ? ` for ${agencyName(project.sponsor)}` : ""}`}
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <RiskBadge level={assessment.level} />
            {project.phase && <Badge>{project.phase}</Badge>}
            <Badge>{project.boro}</Badge>
            <Badge>{classLabel(project.cls)}</Badge>
            <span className="text-ink-3">
              {project.category} · FMS {project.fmsId}
            </span>
          </span>
        }
        actions={
          <>
            <Button icon={pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} onClick={() => togglePin(id)} aria-pressed={pinned}>
              {pinned ? "Unpin" : "Pin"}
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <StatGrid cols={4}>
        <Stat label="First budget reported" value={money(first)} detail={project.firstPeriod ? `in the ${date(project.firstPeriod)} dashboard` : undefined} />
        <Stat
          label="Current budget"
          value={money(project.budget)}
          detail={assessment.growth === 0 ? "No change since first report" : `${money(assessment.growth, { sign: true })} (${pct(assessment.growthPct, { sign: true })}) since first report`}
          tone={assessment.growthPct >= 0.2 ? "bad" : assessment.growthPct > 0 ? "warn" : "good"}
        />
        <Stat label="Spent to date" value={money(project.spend)} detail={project.budget > 0 ? `${pct(project.spend / project.budget)} of the current budget` : undefined} />
        <Stat
          label="Forecast completion"
          value={date(project.forecast, { short: true })}
          detail={assessment.slipDays > 0 ? `${duration(assessment.slipDays)} later than first forecast (${date(project.firstForecast, { short: true })})` : project.firstForecast ? "On its first forecast date" : "No forecast history"}
          tone={assessment.slipDays >= 365 ? "bad" : assessment.slipDays > 0 ? "warn" : "neutral"}
        />
      </StatGrid>

      {assessment.flags.length > 0 && (
        <Callout tone={assessment.level === "critical" ? "bad" : "serious"} title="What stands out" className="mt-4">
          <ul className="list-disc pl-4">
            {assessment.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Budget history" subtitle="Total budget in each dashboard report. The first report is the baseline." />
          <CardBody>
            <TimeSeriesChart
              data={history}
              xKey="period"
              xFormat={periodLabel}
              series={[{ key: "budget", label: "Total budget", slot: 0 }]}
              yFormat={(v) => money(v)}
              referenceLines={[{ y: first, label: "First budget" }]}
              yDomain={[0, "auto"]}
              height={260}
            />
            <SourceNote className="mt-2" href="https://data.cityofnewyork.us/d/fb86-vt7u">
              NYC Capital Projects Dashboard, Citywide Budget and Schedule.
            </SourceNote>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Schedule" subtitle="Completion forecasts over time" />
          <CardBody className="flex flex-col gap-3 text-[14px] text-ink-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[12px] text-ink-3">First forecast</div>
                <div className="font-semibold text-ink">{date(project.firstForecast)}</div>
              </div>
              <div>
                <div className="text-[12px] text-ink-3">Latest forecast</div>
                <div className="font-semibold text-ink">{date(project.forecast)}</div>
              </div>
              <div>
                <div className="text-[12px] text-ink-3">Construction started</div>
                <div className="font-semibold text-ink">{date(project.constructionStart)}</div>
              </div>
              <div>
                <div className="text-[12px] text-ink-3">Total slip</div>
                <div className="font-semibold text-ink">{assessment.slipDays > 0 ? duration(assessment.slipDays) : "None recorded"}</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-ink">Reasons recorded for date changes</div>
              {reasons.length ? (
                <RankedBars rows={reasons.map(([label, n]) => ({ id: label, label, value: n }))} format={(v) => `${num(v)}×`} />
              ) : (
                <p className="text-[13px] text-ink-3">The city recorded no reasons for this project.</p>
              )}
            </div>
            <SourceNote href="https://data.cityofnewyork.us/d/95tx-snak">Capital Projects Dashboard schedule history and variance.</SourceNote>
          </CardBody>
        </Card>
      </div>

      {similar && (
        <Card className="mt-4">
          <CardHeader
            title="What similar projects did"
            subtitle={`Past NYC ${classLabel(project.cls).toLowerCase()} projects with a first budget near ${money(first)}`}
            actions={<ConfidenceBadge confidence={similar.confidence} nEff={similar.nEff} />}
          />
          <CardBody>
            <p className="mb-4 max-w-3xl text-[14px] text-ink-2">
              {assessment.growthPct > 0.001 ? (
                <>
                  This project's budget has grown <strong>{pct(assessment.growthPct)}</strong> since it was first reported.{" "}
                  {shareAtOrAbove !== null && (
                    <>
                      Among similar past projects, <strong>{pct(shareAtOrAbove)}</strong> grew at least this much.
                    </>
                  )}
                </>
              ) : (
                <>This project's budget has not grown since it was first reported. Similar past projects suggest how much room to keep in reserve.</>
              )}{" "}
              If it follows the city's track record, here is where its final cost could land (estimates):
            </p>
            <ForecastBands result={similar} compact />
            <SourceNote className="mt-3">
              Reference class: NYC Capital Project Detail Data, October 2023 snapshot. <Link to="/app/forecaster" className="text-brand hover:underline">Open the cost forecaster</Link> for the full breakdown.
            </SourceNote>
          </CardBody>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="no-print">
          <CardHeader title="Your notes" subtitle="Saved in this browser only" />
          <CardBody>
            <Textarea
              aria-label="Project notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              placeholder="Questions for the agency, what you heard at the last hearing, follow-ups…"
              className="min-h-[140px]"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={saveNote} disabled={note === savedNote}>
                Save note
              </Button>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Open grants that could help"
            subtitle={`Federal opportunities for ${classLabel(project.cls).toLowerCase()}, closing soonest first`}
            actions={
              <ButtonLink to="/app/grants" size="sm" icon={<HandCoins className="size-4" />}>
                Grant finder
              </ButtonLink>
            }
          />
          <CardBody>
            {grants.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {grants.map((g) => (
                  <li key={g.id} className="py-2.5 first:pt-0 last:pb-0">
                    <a href={g.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-ink group-hover:text-brand">{g.title}</span>
                        <span className="block text-[12px] text-ink-3">
                          {g.agency} · {g.closeDate ? `closes ${date(g.closeDate)}` : "no deadline listed"}
                        </span>
                      </span>
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-3">No open opportunities match this project type right now.</p>
            )}
            <SourceNote className="mt-3" href="https://www.grants.gov/">
              Grants.gov, posted and forecasted opportunities open to city governments.
            </SourceNote>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
