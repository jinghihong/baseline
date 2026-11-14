import { CircleCheck, Database, ExternalLink, FileText, TriangleExclamationPoint } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, ErrorBlock, LoadingBlock, PageHeader, Section, Table, Td, Th } from "../../components/ui";
import { CITATIONS } from "../../data/curated";
import { useDatasets } from "../../data/load";
import type { DataSource, DatasetMap } from "../../data/types";
import { date, num, timeAgo } from "../../lib/format";
import { ProjectImport } from "../../features/platform/ProjectImport";
import { WorkspaceTools } from "../../features/platform/WorkspaceTools";

interface DatasetRow {
  key: string;
  name: string;
  purpose: string;
  rows: string;
  sources: DataSource[];
  fetchedAt: string;
  task: string;
}

function describe(d: Omit<DatasetMap, "manifest">): DatasetRow[] {
  return [
    {
      key: "budgetLines",
      name: "Expense budget lines",
      purpose: "Adopted vs modified budgets by agency and object class",
      rows: `${num(d.budgetLines.lines.length)} lines`,
      sources: d.budgetLines.meta.sources,
      fetchedAt: d.budgetLines.meta.fetchedAt,
      task: "budget",
    },
    {
      key: "overtime",
      name: "Overtime: budget and payroll",
      purpose: "Adopted, modified and actual overtime by agency",
      rows: `${num(d.overtime.agencies.length)} agencies × ${num(new Set(d.overtime.agencies.flatMap((a) => a.years.map((y) => y.fy))).size)} years`,
      sources: d.overtime.meta.sources,
      fetchedAt: d.overtime.meta.fetchedAt,
      task: "budget",
    },
    {
      key: "capital",
      name: "Capital Projects Dashboard",
      purpose: `Budgets and schedules, ${date(d.capital.meta.firstPeriod)} to ${date(d.capital.meta.latestPeriod)}`,
      rows: `${num(d.capital.projects.length)} projects`,
      sources: d.capital.meta.sources,
      fetchedAt: d.capital.meta.fetchedAt,
      task: "dashboard",
    },
    {
      key: "reference",
      name: "Past projects (reference class)",
      purpose: "Original vs current budgets for the cost forecaster",
      rows: `${num(d.reference.projects.length)} projects`,
      sources: d.reference.meta.sources,
      fetchedAt: d.reference.meta.fetchedAt,
      task: "reference",
    },
    {
      key: "demand",
      name: "311 service requests",
      purpose: "Monthly demand by type, and yearly by Council district",
      rows: `${num(d.demand.types.length)} request types × ${num(Math.max(...d.demand.types.map((t) => t.months.length)))} months`,
      sources: d.demand.meta.sources,
      fetchedAt: d.demand.meta.fetchedAt,
      task: "demand",
    },
    {
      key: "council",
      name: "Council capital awards",
      purpose: `Discretionary capital funding, ${d.council.meta.fiscalYears.join(", ")}`,
      rows: `${num(d.council.awards.length)} awards`,
      sources: d.council.meta.sources,
      fetchedAt: d.council.meta.fetchedAt,
      task: "council",
    },
    {
      key: "grants",
      name: "Federal grant opportunities",
      purpose: "Open and forecasted grants where cities are eligible",
      rows: `${num(d.grants.opportunities.length)} opportunities`,
      sources: d.grants.meta.sources,
      fetchedAt: d.grants.meta.fetchedAt,
      task: "grants",
    },
    {
      key: "backtest",
      name: "Forecaster backtest",
      purpose: "Out-of-sample accuracy test for the cost forecaster (Cost forecaster, Methodology)",
      rows: `${num(d.backtest.train.length)} training · ${num(d.backtest.test.length)} finished test projects`,
      sources: d.backtest.meta.sources,
      fetchedAt: d.backtest.meta.fetchedAt,
      task: "backtest",
    },
  ];
}

export default function Data() {
  const { data, loading, error } = useDatasets(["budgetLines", "overtime", "capital", "reference", "demand", "council", "grants", "backtest", "manifest"]);
  const rows = data ? describe(data) : [];
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Data & imports"
        description="Where every number in Baseline comes from, when it was last refreshed, and how to add your own projects."
      />

      <Section title="Datasets" description="Public data, downloaded and summarized by Baseline's pipeline. Nothing here is edited by hand.">
        {error ? (
          <ErrorBlock error={error} />
        ) : loading || !data ? (
          <Card>
            <LoadingBlock label="Reading dataset details…" />
          </Card>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Dataset</Th>
                  <Th>Size</Th>
                  <Th>Source</Th>
                  <Th>Refreshed</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = data.manifest.datasets[r.task];
                  return (
                    <tr key={r.key}>
                      <Td>
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-[12.5px] text-ink-3">{r.purpose}</div>
                      </Td>
                      <Td className="whitespace-nowrap">{r.rows}</Td>
                      <Td>
                        <div className="flex flex-col gap-0.5">
                          {r.sources.map((s) => (
                            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-brand hover:underline">
                              <ExternalLink className="size-3 shrink-0" />
                              {s.title}
                            </a>
                          ))}
                          <span className="text-[12px] text-ink-3">{r.sources[0]?.publisher}</span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap" title={r.fetchedAt}>
                        {timeAgo(r.fetchedAt)}
                      </Td>
                      <Td>
                        {status?.ok === false ? (
                          <Badge tone="serious" icon={<TriangleExclamationPoint className="size-3.5" />}>
                            Last refresh failed
                          </Badge>
                        ) : (
                          <Badge tone="good" icon={<CircleCheck className="size-3.5" />}>
                            Current
                          </Badge>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="border-t border-line px-4 py-3 text-[12.5px] text-ink-3">
              Snapshots updated {timeAgo(data.manifest.updatedAt)}. A scheduled job refreshes them; the pipeline is <code>scripts/fetch-data.mjs</code> in the source code.
            </div>
          </Card>
        )}
      </Section>

      <Section title="Published reports Baseline cites" description="Figures quoted from these reports are shown with a link back to the source.">
        <Card>
          <ul className="divide-y divide-line">
            {Object.values(CITATIONS).map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-[14px] font-medium text-ink hover:text-brand hover:underline">
                    {c.title}
                  </a>
                  <div className="text-[12.5px] text-ink-3">
                    {c.publisher} · {date(c.date)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Import your past capital projects">
        <Card>
          <CardBody>{data ? <ProjectImport classes={data.reference.meta.classes} /> : <LoadingBlock label="Loading asset classes…" />}</CardBody>
        </Card>
      </Section>

      <Section title="Your workspace">
        <Card>
          <CardHeader title="Backup and reset" subtitle="Everything you create in Baseline is stored in this browser." actions={<Database className="size-4 text-ink-3" />} />
          <CardBody>
            <WorkspaceTools />
          </CardBody>
        </Card>
      </Section>
    </>
  );
}
