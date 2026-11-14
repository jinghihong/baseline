// Debt & affordability: what today's capital plan costs in future debt service.
import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  Field,
  MoneyInput,
  PageHeader,
  Section,
  Segmented,
  Slider,
  SourceNote,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
} from "../../components/ui";
import { BUDGET_FACTS } from "../../data/curated";
import { useDatasets } from "../../data/load";
import { firstBreach, headroom, lifetimeInterest, projectDebt, type DebtInput } from "../../engines/debt";
import { fy, money, pct } from "../../lib/format";
import { median, sum } from "../../lib/stats";

const START_FY = 2027;
const YEARS = 10;
const DEFAULT_COMMITMENT = 15e9;

type OverrunMode = "none" | "median" | "portfolio" | "custom";

export default function Debt() {
  const data = useDatasets(["budgetLines", "reference"]);

  // Debt service lines in the adopted Expense Budget (agency "DEBT SERVICE") for the first projection year.
  const adoptedDebtService = useMemo(() => {
    if (!data.data) return null;
    const lines = data.data.budgetLines.lines.filter((l) => /DEBT SERVICE/i.test(l.agency));
    const total = sum(lines.map((l) => l.years.find((y) => y.fy === START_FY)?.adopted ?? 0));
    return total > 0 ? total : null;
  }, [data.data]);

  const overrunStats = useMemo(() => {
    if (!data.data) return null;
    const ps = data.data.reference.projects.filter((p) => p.orig >= 250_000 && p.current > 0);
    const ratios = ps.map((p) => p.current / p.orig);
    return { median: Math.max(0, median(ratios) - 1), portfolio: Math.max(0, sum(ps.map((p) => p.current)) / sum(ps.map((p) => p.orig)) - 1), n: ps.length };
  }, [data.data]);

  const [commitments, setCommitments] = useState<number[]>(() => Array(YEARS).fill(DEFAULT_COMMITMENT));
  const [rate, setRate] = useState(0.045);
  const [term, setTerm] = useState(25);
  const [existingOverride, setExistingOverride] = useState<number | null>(null);
  const [runoff, setRunoff] = useState(0.03);
  const [taxGrowth, setTaxGrowth] = useState(0.03);
  const [threshold, setThreshold] = useState(0.15);
  const [overrunMode, setOverrunMode] = useState<OverrunMode>("none");
  const [customOverrun, setCustomOverrun] = useState(0.2);

  const existing = existingOverride ?? adoptedDebtService ?? 5e9;
  const overrun =
    overrunMode === "none" ? 0 : overrunMode === "median" ? (overrunStats?.median ?? 0) : overrunMode === "portfolio" ? (overrunStats?.portfolio ?? 0) : customOverrun;

  const input: DebtInput = {
    startFy: START_FY,
    commitments,
    rate,
    term,
    existingDebtService: existing,
    existingRunoff: runoff,
    taxRevenue: BUDGET_FACTS.fy27OmbTax,
    taxGrowth,
    threshold,
    overrun,
  };
  const years = useMemo(() => projectDebt(input), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps
  const baseline = useMemo(() => projectDebt({ ...input, overrun: 0 }), [JSON.stringify({ ...input, overrun: 0 })]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = years[years.length - 1];
  const peak = years.reduce((m, y) => (y.share > m.share ? y : m), years[0]);
  const breach = firstBreach(years);
  const overrunCost = last.total - baseline[baseline.length - 1].total;
  const totalBorrowed = sum(years.map((y) => y.commitments));

  const chart = years.map((y) => ({ fy: y.fy, existing: y.existingDebtService, added: y.newDebtService, share: y.share }));

  const reset = () => {
    setCommitments(Array(YEARS).fill(DEFAULT_COMMITMENT));
    setRate(0.045);
    setTerm(25);
    setExistingOverride(null);
    setRunoff(0.03);
    setTaxGrowth(0.03);
    setThreshold(0.15);
    setOverrunMode("none");
  };

  return (
    <>
      <PageHeader
        eyebrow="Plan & price"
        title="Debt & affordability"
        description="Every capital dollar the city commits today is borrowed and repaid for decades. See what the plan adds to debt service, and when it crowds out the operating budget."
        actions={
          <Button icon={<RotateCcw className="size-4" />} onClick={reset}>
            Reset assumptions
          </Button>
        }
      />

      <Callout tone="warn" title="This is a planning model, not a forecast" className="mb-6">
        Commitments, interest rate and bond term below are editable assumptions, not city figures. Replace them with your Capital Commitment Plan and your finance office's borrowing assumptions. Tax revenue starts from
        OMB's FY2027 forecast of {money(BUDGET_FACTS.fy27OmbTax)}. <Cite id="fy27Adopted" />
      </Callout>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader title="Assumptions" />
          <CardBody className="flex flex-col gap-5">
            <Field label="Capital commitments per year (assumption)" hint="Applied to every year. Edit single years in the table below.">
              <MoneyInput value={commitments[0]} onChange={(v) => setCommitments(Array(YEARS).fill(Math.max(0, v)))} />
            </Field>
            <Slider label="Interest rate on new bonds" value={rate} min={0.02} max={0.07} step={0.0025} onChange={setRate} format={(v) => pct(v, { digits: 2 })} />
            <Slider label="Bond term" value={term} min={10} max={35} step={1} onChange={setTerm} format={(v) => `${v} years`} />
            <Field
              label="Debt service on existing debt"
              hint={
                adoptedDebtService
                  ? `Default: ${money(adoptedDebtService)}, the Debt Service lines in the FY2027 adopted Expense Budget. Some city debt (such as TFA bonds) is budgeted elsewhere and the city prepays debt service in good years, so treat this as a floor.`
                  : "Enter your city's current annual debt service."
              }
            >
              <MoneyInput value={existing} onChange={(v) => setExistingOverride(Math.max(0, v))} />
            </Field>
            <Slider label="Existing debt service rolling off each year" value={runoff} min={0} max={0.1} step={0.005} onChange={setRunoff} format={(v) => pct(v, { digits: 1 })} />
            <Slider label="Tax revenue growth per year" value={taxGrowth} min={0} max={0.06} step={0.0025} onChange={setTaxGrowth} format={(v) => pct(v, { digits: 2 })} />
            <Slider
              label="Affordability benchmark"
              value={threshold}
              min={0.08}
              max={0.2}
              step={0.005}
              onChange={setThreshold}
              format={(v) => `${pct(v, { digits: 1 })} of tax revenue`}
              hint="A common rule of thumb keeps debt service near or below 15% of tax revenue."
            />
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-ink-2">If projects run over budget</div>
              <Segmented<OverrunMode>
                size="sm"
                value={overrunMode}
                onChange={setOverrunMode}
                className="flex-wrap"
                options={[
                  { value: "none", label: "As planned" },
                  { value: "median", label: `Typical (${pct(overrunStats?.median ?? 0, { sign: true })})` },
                  { value: "portfolio", label: `History (${pct(overrunStats?.portfolio ?? 0, { sign: true })})` },
                  { value: "custom", label: "Custom" },
                ]}
              />
              {overrunMode === "custom" && (
                <div className="mt-3">
                  <Slider label="Overrun on every commitment" value={customOverrun} min={0} max={1} step={0.05} onChange={setCustomOverrun} format={(v) => pct(v, { sign: true })} />
                </div>
              )}
              {overrunStats && (
                <p className="mt-2 text-[12px] text-ink-3">
                  Typical = the median project in the city's October 2023 capital data. History = all {overrunStats.n.toLocaleString()} projects' latest plans versus their original budgets, in dollars.
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0">
          <StatGrid cols={4}>
            <Stat label={`Debt service ${fy(START_FY)}`} value={money(years[0].total)} detail={`${pct(years[0].share, { digits: 1 })} of tax revenue`} />
            <Stat label={`Debt service ${fy(last.fy)}`} value={money(last.total)} detail={`${pct(last.share, { digits: 1 })} of tax revenue (estimate)`} tone={last.overThreshold ? "bad" : "neutral"} />
            <Stat label="Peak share of tax revenue" value={pct(peak.share, { digits: 1 })} detail={`in ${fy(peak.fy)}`} tone={peak.overThreshold ? "bad" : "good"} />
            <Stat
              label="Crosses the benchmark"
              value={breach ? fy(breach) : "Stays under"}
              detail={breach ? `above ${pct(threshold, { digits: 1 })} of tax revenue` : `${money(headroom(last, threshold))} of headroom in ${fy(last.fy)}`}
              tone={breach ? "bad" : "good"}
            />
          </StatGrid>

          {overrun > 0 && (
            <Callout tone="serious" title={`Overruns add ${money(overrunCost)} a year by ${fy(last.fy)}`} className="mt-4">
              If every commitment costs {pct(overrun, { sign: true })} more than planned, the city borrows {money(totalBorrowed - sum(baseline.map((y) => y.commitments)))} more over ten years, and debt service in{" "}
              {fy(last.fy)} rises from {money(baseline[baseline.length - 1].total)} to {money(last.total)}. Pricing projects honestly up front (see the cost forecaster) keeps this visible before the bonds are sold.
            </Callout>
          )}

          <Section title="Debt service by year" description="Existing debt rolling off, plus new bonds for each year's commitments. Payments start the year after borrowing." className="mt-6">
            <Card>
              <CardBody>
                <TimeSeriesChart
                  data={chart}
                  xKey="fy"
                  xFormat={(v) => fy(Number(v))}
                  series={[
                    { key: "existing", label: "Existing debt", slot: 0, kind: "bar", stack: "ds" },
                    { key: "added", label: "New borrowing", slot: 1, kind: "bar", stack: "ds" },
                  ]}
                  yFormat={(v) => money(v)}
                  height={260}
                />
              </CardBody>
            </Card>
          </Section>

          <Section title="Debt service as a share of tax revenue" description="Estimate, compared with your benchmark.">
            <Card>
              <CardBody>
                <TimeSeriesChart
                  data={chart}
                  xKey="fy"
                  xFormat={(v) => fy(Number(v))}
                  series={[{ key: "share", label: "Debt service / tax revenue", slot: 0 }]}
                  yFormat={(v) => pct(v, { digits: 1 })}
                  referenceLines={[{ y: threshold, label: "Benchmark" }]}
                  yDomain={[0, Math.max(threshold * 1.3, peak.share * 1.15)]}
                  height={220}
                />
              </CardBody>
            </Card>
          </Section>

          <Section title="Year by year" description="Edit any year's commitments directly.">
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Fiscal year</Th>
                    <Th align="right">Commitments</Th>
                    <Th align="right">Borrowed</Th>
                    <Th align="right">Existing</Th>
                    <Th align="right">New</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Tax revenue</Th>
                    <Th align="right">Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y, i) => (
                    <tr key={y.fy}>
                      <Td className="font-medium text-ink">{fy(y.fy)}</Td>
                      <Td align="right" className="min-w-[130px]">
                        <MoneyInput
                          value={commitments[i]}
                          onChange={(v) => setCommitments((c) => c.map((x, j) => (j === i ? Math.max(0, v) : x)))}
                          className="ml-auto w-[130px]"
                        />
                      </Td>
                      <Td align="right">{money(y.commitments)}</Td>
                      <Td align="right">{money(y.existingDebtService)}</Td>
                      <Td align="right">{money(y.newDebtService)}</Td>
                      <Td align="right" className="font-medium text-ink">
                        {money(y.total)}
                      </Td>
                      <Td align="right">{money(y.taxRevenue)}</Td>
                      <Td align="right" className={y.overThreshold ? "font-medium text-bad-ink" : undefined}>
                        {pct(y.share, { digits: 1 })}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            <SourceNote className="mt-2">
              Level debt service: each year's borrowing is repaid in equal annual payments over the bond term. Lifetime interest on one year's {money(commitments[0])} of commitments at {pct(rate, { digits: 2 })} over{" "}
              {term} years: {money(lifetimeInterest(commitments[0] * (1 + overrun), rate, term))}.
            </SourceNote>
          </Section>
        </div>
      </div>
    </>
  );
}
