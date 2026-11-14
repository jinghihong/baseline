// 311 demand: what residents report, how it moves through the year, and what the next 12 months probably look like.
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Sparkline, TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Delta,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  Section,
  SourceNote,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  cn,
  downloadFile,
  toCsv,
  type Tone,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { useDataset } from "../../data/load";
import { BUDGET_LINK, assessAllDemand, type AnomalyLevel, type DemandAssessment } from "../../engines/demand";
import { compactNum, date, num, pct } from "../../lib/format";

const ANOMALY: Record<AnomalyLevel, { tone: Tone; label: string }> = {
  above: { tone: "serious", label: "Above expected" },
  within: { tone: "good", label: "As expected" },
  below: { tone: "neutral", label: "Below expected" },
};

export default function Demand() {
  const { data, error, loading } = useDataset("demand");
  const all = useMemo(() => (data ? assessAllDemand(data) : []), [data]);
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <LoadingBlock label="Loading 311 requests…" />;
  if (error || !data) return <ErrorBlock error={error ?? "No data"} />;

  const current = all.find((a) => a.type.type === selected) ?? all[0];
  const last12 = all.reduce((s, a) => s + a.last12, 0);
  const prior12 = all.reduce((s, a) => s + a.prior12, 0);
  const anomalies = all.filter((a) => a.anomaly === "above");
  // Biggest spike: a recent month at least twice the same month a year earlier.
  const spike = [...all].filter((a) => (a.peak?.ratio ?? 0) >= 2).sort((a, b) => (b.peak?.ratio ?? 0) - (a.peak?.ratio ?? 0))[0];

  const exportCsv = () =>
    downloadFile(
      "baseline-311-demand.csv",
      toCsv(
        all.map((a) => ({
          complaint_type: a.type.type,
          label: a.type.label,
          agency: a.type.agency,
          last_12_months: a.last12,
          prior_12_months: a.prior12,
          change: a.yoy.toFixed(3),
          forecast_next_12_months: Math.round(a.next12),
          forecast_low: Math.round(a.next12Low),
          forecast_high: Math.round(a.next12High),
          latest_month: a.latestMonth,
          latest_vs_expected: a.anomaly,
        })),
      ),
      "text/csv",
    );

  return (
    <>
      <PageHeader
        eyebrow="Demand"
        title="311 demand"
        description="Residents' 311 requests are an early signal of where spending pressure will land: potholes for street repair crews, heat complaints for housing inspectors, missed pickups for sanitation."
        actions={
          <Button icon={<Download className="size-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Requests, last 12 months" value={compactNum(last12)} detail={`${all.length} budget-linked complaint types`} />
        <Stat label="Change vs prior 12 months" value={<Delta value={prior12 ? last12 / prior12 - 1 : 0} format={(v) => pct(v)} goodWhen="none" />} detail={`${compactNum(prior12)} the year before`} />
        <Stat
          label="Latest month above expected"
          value={num(anomalies.length)}
          detail={anomalies.length ? anomalies.map((a) => a.type.label).slice(0, 2).join(", ") : "Every type within its normal range"}
          tone={anomalies.length ? "serious" : "good"}
        />
        <Stat label="Data refreshed" value={date(data.meta.fetchedAt.slice(0, 10))} detail="Updated weekly from NYC Open Data" />
      </StatGrid>

      {spike?.peak && (
        <Callout tone="warn" className="mt-6" title={`${spike.type.label}: ${num(spike.peak.value)} requests in ${date(spike.peak.month)}`}>
          That is {spike.peak.ratio!.toFixed(1)}× the {num(spike.peak.priorYearValue ?? 0)} in the same month a year earlier. A spike like this usually means a repair backlog, and a budget line ({BUDGET_LINK[spike.type.type] ?? agencyName(spike.type.agency)})
          that may need money before the year ends.
        </Callout>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader title="Complaint types" subtitle="Last 12 months · click to see the trend" />
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
            {all.map((a) => (
              <li key={a.type.type}>
                <button
                  type="button"
                  onClick={() => setSelected(a.type.type)}
                  aria-pressed={current?.type.type === a.type.type}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2", current?.type.type === a.type.type && "bg-brand-soft")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{a.type.label}</span>
                    <span className="block text-[12px] text-ink-3">
                      {a.type.agency} · {compactNum(a.last12)} · <Delta value={a.yoy} format={(v) => pct(v)} goodWhen="none" className="font-normal" />
                    </span>
                  </span>
                  <Sparkline values={a.complete.slice(-24).map((m) => m[1])} slot={0} width={72} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {current && <TypeDetail a={current} />}
      </div>

      <Section className="mt-8" title="All types at a glance">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Complaint type</Th>
                <Th>Agency</Th>
                <Th align="right">Last 12 months</Th>
                <Th align="right">Change</Th>
                <Th align="right">Next 12 months (forecast)</Th>
                <Th>Latest month</Th>
              </tr>
            </thead>
            <tbody>
              {all.map((a) => (
                <tr key={a.type.type}>
                  <Td className="font-medium text-ink">{a.type.label}</Td>
                  <Td>{a.type.agency}</Td>
                  <Td align="right">{num(a.last12)}</Td>
                  <Td align="right">
                    <Delta value={a.yoy} format={(v) => pct(v)} goodWhen="none" />
                  </Td>
                  <Td align="right">
                    {compactNum(a.next12)}{" "}
                    <span className="text-ink-3">
                      ({compactNum(a.next12Low)}–{compactNum(a.next12High)})
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={ANOMALY[a.anomaly].tone}>{ANOMALY[a.anomaly].label}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <SourceNote href="https://data.cityofnewyork.us/d/erm2-nwe9" className="mt-2">
          NYC 311 Service Requests (NYC Open Data). Forecasts are Baseline estimates: a seasonal pattern plus a trend fitted on the last 36 months, with an 80% range. The current month is partial and left out.
        </SourceNote>
      </Section>
    </>
  );
}

function TypeDetail({ a }: { a: DemandAssessment }) {
  const rows = a.points.slice(-48).map((p) => ({ month: p.month, actual: p.actual, forecast: p.forecast, band: p.band }));
  const lastActual = a.points.filter((p) => p.actual !== null).at(-1)?.month;
  return (
    <Card>
      <CardHeader
        title={a.type.label}
        subtitle={`${agencyName(a.type.agency)} · drives: ${BUDGET_LINK[a.type.type] ?? "agency operations"}`}
        actions={<Badge tone={ANOMALY[a.anomaly].tone}>{ANOMALY[a.anomaly].label}</Badge>}
      />
      <CardBody>
        <TimeSeriesChart
          data={rows}
          xKey="month"
          xFormat={(v) => date(String(v), { short: true })}
          yFormat={(v) => compactNum(v)}
          series={[
            { key: "actual", label: "Requests", slot: 0 },
            { key: "forecast", label: "Forecast (estimate)", slot: 1, dashed: true },
          ]}
          band={{ key: "band", label: "80% range", slot: 1 }}
          forecastFrom={lastActual}
          height={270}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Next 12 months" value={compactNum(a.next12)} detail={`range ${compactNum(a.next12Low)}–${compactNum(a.next12High)}`} />
          <MiniStat
            label={`Latest month (${date(a.latestMonth, { short: true })})`}
            value={num(a.latestValue)}
            detail={a.expectedLatest !== null ? `expected about ${compactNum(a.expectedLatest)}` : "not enough history"}
          />
          <MiniStat label="Trend" value={`${a.trendPerYear >= 0 ? "+" : "−"}${compactNum(Math.abs(a.trendPerYear))}/mo per year`} detail="change in the seasonally adjusted monthly level" />
        </div>
      </CardBody>
    </Card>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="text-[18px] font-semibold text-ink">{value}</div>
      <div className="text-[12px] text-ink-3">{detail}</div>
    </div>
  );
}

