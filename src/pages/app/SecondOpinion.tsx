// Second opinion: budget lines adopted too low, year after year, plus the Comptroller's published review.
import { Copy, Download, Funnel, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Sparkline } from "../../components/charts";
import {
  Button,
  Callout,
  Card,
  Cite,
  copyText,
  downloadFile,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Section,
  Segmented,
  Select,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  toCsv,
  Toggle,
  useSort,
  type RiskLevel,
} from "../../components/ui";
import { BUDGET_FACTS, FY27_EXPENSE_RISKS } from "../../data/curated";
import { useDatasets } from "../../data/load";
import { councilQuestions, isPayrollLine, lineAgency, objectClassLabel } from "../../engines/budgetRisk";
import { assessAllLines, assessAllOvertime, type LineAssessment } from "../../engines/core";
import { LineDrawer } from "../../features/budget/LineDrawer";
import { RiskRegister } from "../../features/budget/RiskRegister";
import { fy, money, pct } from "../../lib/format";
import { useRole } from "../../state/store";

type LevelFilter = "flagged" | "critical" | "high" | "watch" | "all";
type SortKey = "expected" | "ratio" | "years" | "adopted";

const MIN_OPTIONS = [
  { value: 0, label: "Any size" },
  { value: 10e6, label: "$10M+" },
  { value: 50e6, label: "$50M+" },
  { value: 100e6, label: "$100M+" },
  { value: 500e6, label: "$500M+" },
];

const PAGE = 25;
const LEVEL_RANK: Record<RiskLevel, number> = { critical: 3, high: 2, watch: 1, low: 0 };

export default function SecondOpinion() {
  const role = useRole();
  const { data, error, loading } = useDatasets(["budgetLines", "overtime"]);
  const [agency, setAgency] = useState("all");
  const [level, setLevel] = useState<LevelFilter>("flagged");
  const [minAdopted, setMinAdopted] = useState(0);
  const [payrollOnly, setPayrollOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<LineAssessment | null>(null);
  const sort = useSort<SortKey>("expected");

  const assessed = useMemo(() => (data ? assessAllLines(data.budgetLines).filter((a) => !a.technical && a.yearsAssessed >= 3) : []), [data]);
  const overtime = useMemo(() => (data ? assessAllOvertime(data.overtime) : []), [data]);

  const agencies = useMemo(() => [...new Set(assessed.map(lineAgency))].sort(), [assessed]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = assessed.filter((a) => {
      if (agency !== "all" && lineAgency(a) !== agency) return false;
      if (payrollOnly && !isPayrollLine(a)) return false;
      if (a.latestAdopted < minAdopted) return false;
      if (level === "flagged" && a.level === "low") return false;
      if (level !== "flagged" && level !== "all" && a.level !== level) return false;
      if (q && !`${lineAgency(a)} ${a.line.objectClass}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (a: LineAssessment) =>
      sort.key === "ratio" ? a.medianRatio : sort.key === "years" ? a.yearsOver / Math.max(1, a.yearsAssessed) + LEVEL_RANK[a.level] / 100 : sort.key === "adopted" ? a.latestAdopted : a.expectedIncrease;
    return [...rows].sort((x, y) => (val(x) - val(y)) * dir);
  }, [assessed, agency, payrollOnly, minAdopted, level, query, sort.key, sort.dir]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock error={error ?? "No data"} />;

  const chronic = assessed.filter((a) => a.chronic);
  const expectedTotal = chronic.reduce((s, a) => s + a.expectedIncrease, 0);
  const latestFy = assessed.length ? Math.max(...assessed.map((a) => a.latestAdoptedFy)) : 0;
  const firstFy = assessed.length ? Math.min(...assessed.flatMap((a) => a.years.map((y) => y.fy))) : 0;
  const comptrollerFy27 = FY27_EXPENSE_RISKS.reduce((s, r) => s + r.values[0], 0);
  const questions = councilQuestions(assessed, overtime, 6);
  const sourceUrl = data.budgetLines.meta.sources[0]?.url;

  const exportCsv = () => {
    const rows = filtered.map((a) => ({
      agency: lineAgency(a),
      object_class: objectClassLabel(a.line.objectClass),
      status: a.level,
      chronic: a.chronic ? "yes" : "no",
      years_over: a.yearsOver,
      years_assessed: a.yearsAssessed,
      median_end_vs_adopted_pct: ((a.medianRatio - 1) * 100).toFixed(1),
      latest_adopted_fy: a.latestAdoptedFy,
      latest_adopted: Math.round(a.latestAdopted),
      expected_in_year_increase_estimate: Math.round(a.expectedIncrease),
      ...Object.fromEntries(a.years.map((y) => [`fy${y.fy}_end_vs_adopted_pct`, ((y.ratio - 1) * 100).toFixed(1)])),
    }));
    downloadFile(`baseline-second-opinion-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
  };

  const questionsBlock = (
    <Section
      title={role === "council" ? "Questions for budget hearings" : "Questions the council is likely to ask"}
      description="Drafted from the lines and overtime flagged on this page. Edit them before you use them."
      actions={
        <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => copyText(questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n"), "Questions copied")}>
          Copy all
        </Button>
      }
    >
      <Card className="divide-y divide-line">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-3 px-5 py-3.5 text-[14px] text-ink-2">
            <span className="tabular mt-0.5 text-[12.5px] font-semibold text-brand">{i + 1}</span>
            <p>{q}</p>
          </div>
        ))}
      </Card>
    </Section>
  );

  return (
    <>
      <PageHeader
        eyebrow="Budget risk"
        title="Second opinion"
        description={`Which budget lines are adopted too low, year after year? Baseline compares every agency's adopted budget with where each line ended the year${firstFy ? `, from ${fy(firstFy)} to ${fy(latestFy - 1)}` : ""}.`}
        actions={
          <Button icon={<Download className="size-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <StatGrid cols={4}>
        <Stat label="Chronic lines" value={chronic.length} detail={`of ${assessed.length} material lines ended 3 in 4 years above adoption, by a median of 20%+`} tone={chronic.length ? "serious" : "good"} />
        <Stat
          label={`Expected in-year growth, ${fy(latestFy)}`}
          value={money(expectedTotal)}
          detail="Estimate if each chronic line repeats its typical pattern"
          tone="serious"
        />
        <Stat label="Comptroller: chronically under-budgeted" value={money(BUDGET_FACTS.chronicUnderbudgetingAvg)} detail="Average a year left out of the preliminary budget" source="fy26Prelim" />
        <Stat label="Comptroller: FY27 spending risks, net" value={money(Math.abs(comptrollerFy27) * 1e6)} detail="More than OMB budgeted for FY27" source="fy27Adopted" />
      </StatGrid>

      <Callout tone="warn" className="mt-4" title="What this does and doesn't tell you">
        A line can grow during the year because the city recognizes new state or federal grants, not only because it was adopted too low. Treat a flag as a reason to ask, not proof. Overtime, which comes from actual payroll, is the cleanest signal: see the{" "}
        <Link className="font-medium text-brand underline-offset-2 hover:underline" to="/app/overtime">
          Overtime monitor
        </Link>
        .
      </Callout>

      {role === "council" && <div className="mt-8">{questionsBlock}</div>}

      <Section title="Lines that grow after adoption" description="Ranked by expected in-year growth. Click a line to see every year." className="mt-8">
        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <Field label="Search" className="w-full sm:w-56" htmlFor="so-q">
              <Input id="so-q" placeholder="Agency or line" value={query} onChange={(e) => (setQuery(e.target.value), setShown(PAGE))} />
            </Field>
            <Field label="Agency" className="w-full sm:w-64" htmlFor="so-agency">
              <Select id="so-agency" value={agency} onChange={(e) => (setAgency(e.target.value), setShown(PAGE))}>
                <option value="all">All agencies</option>
                {agencies.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Adopted size" className="w-full sm:w-36" htmlFor="so-min">
              <Select id="so-min" value={minAdopted} onChange={(e) => (setMinAdopted(Number(e.target.value)), setShown(PAGE))}>
                {MIN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Status</span>
              <Segmented<LevelFilter>
                size="sm"
                value={level}
                onChange={(v) => (setLevel(v), setShown(PAGE))}
                options={[
                  { value: "flagged", label: "Flagged" },
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "watch", label: "Watch" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
            <div className="pb-2">
              <Toggle checked={payrollOnly} onChange={(v) => (setPayrollOnly(v), setShown(PAGE))} label="Payroll lines only" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Funnel className="size-6" />} title="No lines match these filters">
                Try a different agency, a smaller size, or the “All” status.
              </EmptyState>
            </div>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Agency · line</Th>
                    <Th>End vs adopted, by year</Th>
                    <Th align="right" onClick={() => sort.toggle("years")} sorted={sort.sortedFor("years")}>
                      Years over
                    </Th>
                    <Th align="right" onClick={() => sort.toggle("ratio")} sorted={sort.sortedFor("ratio")}>
                      Typical
                    </Th>
                    <Th align="right" onClick={() => sort.toggle("adopted")} sorted={sort.sortedFor("adopted")}>
                      Adopted {fy(latestFy)}
                    </Th>
                    <Th align="right" onClick={() => sort.toggle("expected")} sorted={sort.sortedFor("expected")}>
                      Expected growth
                    </Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, shown).map((a) => (
                    <tr key={a.key} className="cursor-pointer hover:bg-surface-2/70" onClick={() => setSelected(a)}>
                      <Td className="max-w-[280px]">
                        <button type="button" className="block w-full text-left" onClick={() => setSelected(a)}>
                          <span className="block truncate font-medium text-ink">{lineAgency(a)}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">{objectClassLabel(a.line.objectClass)}</span>
                        </button>
                      </Td>
                      <Td>
                        <Sparkline values={a.years.map((y) => y.ratio)} slot={a.chronic ? 1 : 0} />
                      </Td>
                      <Td align="right">
                        {a.yearsOver}/{a.yearsAssessed}
                      </Td>
                      <Td align="right" className={a.medianRatio >= 1.1 ? "text-bad-ink" : undefined}>
                        {pct(a.medianRatio - 1, { sign: true })}
                      </Td>
                      <Td align="right">{money(a.latestAdopted)}</Td>
                      <Td align="right" className="font-medium text-ink">
                        {a.expectedIncrease > 0 ? money(a.expectedIncrease) : "—"}
                      </Td>
                      <Td>
                        <RiskBadge level={a.level} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12.5px] text-ink-3">
                <span>
                  Showing {Math.min(shown, filtered.length)} of {filtered.length} lines. “Typical” is the median change between adoption and year-end. Expected growth is an estimate.
                </span>
                {shown < filtered.length && (
                  <Button size="sm" onClick={() => setShown((s) => s + PAGE)}>
                    Show {Math.min(PAGE, filtered.length - shown)} more
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </Section>

      <Section
        title="The Comptroller's line-by-line review"
        description="An independent forecast already exists for NYC. Baseline puts it next to its own numbers so you can see where they agree."
      >
        <RiskRegister />
      </Section>

      {role !== "council" && questionsBlock}

      <Card className="flex items-start gap-3 p-4 text-[13px] text-ink-3">
        <Scale className="mt-0.5 size-4 shrink-0" />
        <div>
          How Baseline decides: a line is <strong className="text-ink">chronic</strong> when, over at least five complete years, it ended 5% or more above adoption in at least 75% of them and its median year ended 20% or more above. Looser rules mostly catch grant money added during the year. Holding codes and central allocations are excluded. Data:{" "}
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
            NYC Open Data Expense Budget
          </a>{" "}
          (June adopted-budget publications, all funds). Comptroller figures: <Cite id="fy27Adopted" />
        </div>
      </Card>

      <LineDrawer item={selected} onClose={() => setSelected(null)} sourceUrl={sourceUrl} />
    </>
  );
}
