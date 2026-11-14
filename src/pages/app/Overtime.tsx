// Overtime monitor: adopted vs modified vs actually paid, by agency, with next year's forecast.
import { Download, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  downloadFile,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Section,
  SourceNote,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  toCsv,
  useSort,
} from "../../components/ui";
import { BUDGET_FACTS, FY27_EXPENSE_RISKS } from "../../data/curated";
import { useDataset } from "../../data/load";
import { citywideOvertime, totalOvertimeShortfall } from "../../engines/budgetRisk";
import { assessAllOvertime, type OvertimeAssessment } from "../../engines/core";
import { compactNum, fy, money, pct } from "../../lib/format";

type SortKey = "shortfall" | "ratio" | "actual";

export default function Overtime() {
  const { data, error, loading } = useDataset("overtime");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const sort = useSort<SortKey>("shortfall");

  const items = useMemo(() => (data ? assessAllOvertime(data) : []), [data]);
  const city = useMemo(() => (data ? citywideOvertime(data, 2017) : null), [data]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (a: OvertimeAssessment) => (sort.key === "ratio" ? a.latestRatio : sort.key === "actual" ? a.latestActual : a.expectedShortfall ?? -Infinity);
    return [...items].sort((x, y) => (val(x) - val(y)) * dir);
  }, [items, sort.key, sort.dir]);

  if (loading) return <LoadingBlock />;
  if (error || !data || !city) return <ErrorBlock error={error ?? "No data"} />;

  const selected = items.find((a) => a.agency.code === selectedCode) ?? sorted[0];
  const latest = city.rows.find((r) => r.fy === city.latestActualFy);
  const shortfall = totalOvertimeShortfall(items);
  const comptrollerNext = Math.abs(FY27_EXPENSE_RISKS.find((r) => r.id === "overtime")?.values[0] ?? 0) * 1e6;
  const latestGap = latest && latest.actual !== null && latest.adopted !== null ? latest.actual - latest.adopted : null;

  const cityRows = city.rows
    .filter((r) => r.fy <= city.nextFy)
    .map((r) => ({
      fy: r.fy,
      adopted: r.adopted,
      modified: r.modified,
      actual: r.actual,
      forecast: r.fy === city.latestActualFy ? r.actual : r.fy === city.nextFy ? city.forecast : null,
      band: r.fy === city.latestActualFy && r.actual !== null ? [r.actual, r.actual] : r.fy === city.nextFy ? [city.low, city.high] : undefined,
    }));

  const agencyRows = selected
    ? selected.agency.years
        .filter((y) => y.fy >= 2017 && y.fy <= selected.nextFy)
        .map((y) => ({
          fy: y.fy,
          adopted: y.adopted,
          modified: y.modified,
          actual: y.actual,
          hours: y.hours,
          forecast: y.fy === selected.latestActualFy ? y.actual : y.fy === selected.nextFy ? selected.forecast : null,
          band: y.fy === selected.latestActualFy && y.actual !== null ? [y.actual, y.actual] : y.fy === selected.nextFy ? [selected.forecastLow, selected.forecastHigh] : undefined,
        }))
    : [];

  const exportCsv = () => {
    downloadFile(
      `baseline-overtime-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        items.map((a) => ({
          agency: a.agency.name,
          [`paid_fy${a.latestActualFy}`]: Math.round(a.latestActual),
          [`adopted_fy${a.latestActualFy}`]: Math.round(a.latestAdoptedForActualYear),
          paid_vs_adopted_pct: ((a.latestRatio - 1) * 100).toFixed(1),
          years_10pct_over: `${a.yearsOver}/${a.yearsAssessed}`,
          [`adopted_fy${a.nextFy}`]: a.nextAdopted === null ? "" : Math.round(a.nextAdopted),
          forecast_estimate: Math.round(a.forecast),
          forecast_low: Math.round(a.forecastLow),
          forecast_high: Math.round(a.forecastHigh),
          expected_shortfall_estimate: a.expectedShortfall === null ? "" : Math.round(a.expectedShortfall),
          status: a.level,
        })),
      ),
      "text/csv",
    );
  };

  const series = [
    { key: "adopted", label: "Adopted budget", slot: 0 },
    { key: "modified", label: "Budget after changes", slot: 1 },
    { key: "actual", label: "Actually paid", slot: 2 },
    { key: "forecast", label: "Baseline forecast", slot: 2, dashed: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Budget risk"
        title="Overtime monitor"
        description="Overtime is adopted low and paid high, almost every year. Baseline lines up three numbers for each agency: what the adopted budget set aside, what the budget grew to by June, and what payroll actually paid."
        actions={
          <Button icon={<Download className="size-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <StatGrid cols={4}>
        <Stat
          label={`Overtime paid, ${fy(city.latestActualFy)}`}
          value={money(latest?.actual)}
          detail={latest?.adopted ? `${pct((latest.actual ?? 0) / latest.adopted)} of the ${money(latest.adopted)} adopted` : undefined}
          tone="serious"
        />
        <Stat label={`Adopted for ${fy(city.nextFy)}`} value={money(city.nextAdopted)} detail={`${city.agencies} largest overtime agencies`} />
        <Stat
          label={`Baseline forecast, ${fy(city.nextFy)}`}
          value={money(city.forecast)}
          detail={`Estimate. 80% range ${money(city.low)} – ${money(city.high)}`}
          tone="brand"
        />
        <Stat
          label={`Expected shortfall, ${fy(city.nextFy)}`}
          value={money(shortfall)}
          detail="Forecast minus adopted, summed by agency (estimate)"
          tone={shortfall > 0 ? "bad" : "good"}
        />
      </StatGrid>

      <Card className="mt-6">
        <CardBody>
          <TimeSeriesChart
            title="Citywide overtime: budgeted vs paid"
            subtitle={`Sum of the ${city.agencies} agencies matched across the budget and payroll data. All funds. Shaded year is a forecast.`}
            data={cityRows}
            xKey="fy"
            xFormat={(v) => fy(Number(v))}
            yFormat={(v) => money(v)}
            series={series}
            band={{ key: "band", label: "Forecast range (80%)", slot: 2 }}
            forecastFrom={city.nextFy}
            height={300}
          />
          <SourceNote className="mt-3" href={data.meta.sources[1]?.url}>
            Adopted and modified: NYC Open Data Expense Budget, overtime object codes. Paid: Citywide Payroll Data, total overtime paid. The forecast uses a damped trend on the last eight years of actual spending.
          </SourceNote>
        </CardBody>
      </Card>

      <Section title="How this compares with the Comptroller" className="mt-8">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-ink">{fy(city.nextFy)}: how far overtime may run past the budget</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-[12px] text-ink-3">Baseline (estimate)</div>
                <div className="mt-1 text-xl font-semibold text-ink">{money(shortfall)}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-[12px] text-ink-3">Comptroller</div>
                <div className="mt-1 text-xl font-semibold text-ink">{money(comptrollerNext)}</div>
                <Cite id="fy27Adopted" className="mt-1" />
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-ink">{fy(city.latestActualFy)}: the year that just closed</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-[12px] text-ink-3">Paid above adopted (payroll)</div>
                <div className="mt-1 text-xl font-semibold text-ink">{money(latestGap)}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="text-[12px] text-ink-3">Comptroller's estimate at adoption</div>
                <div className="mt-1 text-xl font-semibold text-ink">{money(BUDGET_FACTS.fy26OvertimeShortfall)}</div>
                <Cite id="fy26Adopted" className="mt-1" />
              </div>
            </div>
          </Card>
        </div>
        <Callout tone="neutral" className="mt-3" title="Why the numbers differ">
          Baseline counts all funds (city, state and federal) for the {city.agencies} agencies it can match between the budget and payroll data. The Comptroller counts city funds for every agency and forecasts before the year is over. Both point the same way: overtime is
          budgeted well below what the city pays.
        </Callout>
      </Section>

      <Section title="By agency" description="Click an agency to see its own history and forecast.">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Agency</Th>
                <Th align="right" onClick={() => sort.toggle("actual")} sorted={sort.sortedFor("actual")}>
                  Paid {fy(city.latestActualFy)}
                </Th>
                <Th align="right">Adopted {fy(city.latestActualFy)}</Th>
                <Th align="right" onClick={() => sort.toggle("ratio")} sorted={sort.sortedFor("ratio")}>
                  Paid ÷ adopted
                </Th>
                <Th align="right">Years 10%+ over</Th>
                <Th align="right">Adopted {fy(city.nextFy)}</Th>
                <Th align="right">Forecast {fy(city.nextFy)}</Th>
                <Th align="right" onClick={() => sort.toggle("shortfall")} sorted={sort.sortedFor("shortfall")}>
                  Expected shortfall
                </Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr
                  key={a.agency.code}
                  className={a.agency.code === selected?.agency.code ? "bg-brand-soft/50" : "cursor-pointer hover:bg-surface-2/70"}
                  onClick={() => setSelectedCode(a.agency.code)}
                >
                  <Td>
                    <button type="button" className="text-left font-medium text-ink" onClick={() => setSelectedCode(a.agency.code)}>
                      {a.agency.name}
                    </button>
                  </Td>
                  <Td align="right">{money(a.latestActual)}</Td>
                  <Td align="right">{money(a.latestAdoptedForActualYear)}</Td>
                  <Td align="right" className={a.latestRatio >= 1.4 ? "font-medium text-bad-ink" : undefined}>
                    {a.latestAdoptedForActualYear > 0 ? `${a.latestRatio.toFixed(1)}×` : "—"}
                  </Td>
                  <Td align="right">
                    {a.yearsOver}/{a.yearsAssessed}
                  </Td>
                  <Td align="right">{money(a.nextAdopted)}</Td>
                  <Td align="right" title={`80% range ${money(a.forecastLow)} – ${money(a.forecastHigh)}`}>
                    {money(a.forecast)}
                  </Td>
                  <Td align="right" className="font-medium text-ink">
                    {a.expectedShortfall === null ? "—" : money(a.expectedShortfall, { sign: true })}
                  </Td>
                  <Td>
                    <RiskBadge level={a.level} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-3 text-[12.5px] text-ink-3">Forecasts and shortfalls are Baseline estimates. Hover a forecast for its 80% range.</p>
        </Card>
      </Section>

      {selected && (
        <Section title={selected.agency.name} description={`${selected.yearsOver} of the last ${selected.yearsAssessed} years paid at least 10% more than adopted.`}>
          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardBody>
                <TimeSeriesChart
                  title="Overtime dollars"
                  data={agencyRows}
                  xKey="fy"
                  xFormat={(v) => fy(Number(v))}
                  yFormat={(v) => money(v)}
                  series={series}
                  band={{ key: "band", label: "Forecast range (80%)", slot: 2 }}
                  forecastFrom={selected.nextFy}
                  height={280}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Overtime hours" subtitle="Hours paid, from payroll" />
              <CardBody>
                <TimeSeriesChart
                  data={agencyRows.filter((r) => r.hours !== null)}
                  xKey="fy"
                  xFormat={(v) => fy(Number(v))}
                  yFormat={(v) => compactNum(v)}
                  series={[{ key: "hours", label: "Hours", slot: 6, kind: "bar" }]}
                  height={220}
                  showTableToggle={false}
                />
                <div className="mt-3 rounded-lg bg-surface-2 p-3 text-[13px] text-ink-2">
                  <div className="flex items-center gap-2 font-medium text-ink">
                    <Timer className="size-4 text-ink-3" /> Next year
                  </div>
                  <p className="mt-1">
                    {selected.nextAdopted !== null ? (
                      <>
                        Adopted at {money(selected.nextAdopted)}. Baseline expects about {money(selected.forecast)} (range {money(selected.forecastLow)} – {money(selected.forecastHigh)}), an estimate based on the last eight years.
                      </>
                    ) : (
                      <>The next adopted budget has not been published yet. Baseline expects about {money(selected.forecast)}.</>
                    )}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>
      )}
    </>
  );
}
