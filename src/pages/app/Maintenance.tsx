// Maintenance risk ("AIMS done right"): rank assets by failure risk and fund repairs by risk removed per dollar.
import Papa from "papaparse";
import { Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  EmptyState,
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
  downloadFile,
  toCsv,
  toast,
  type Tone,
} from "../../components/ui";
import { AIMS_FACTS } from "../../data/curated";
import {
  ASSET_TEMPLATE_CSV,
  CONDITION_LABEL,
  INSPECTION_CYCLE_YEARS,
  assessAsset,
  generateSampleAssets,
  parseAssetRows,
  planYear,
  simulate,
  type Asset,
  type AssetAssessment,
} from "../../engines/maintenance";
import { classLabel } from "../../features/capital/shared";
import { money, num, pct } from "../../lib/format";
import { sum } from "../../lib/stats";

const STORAGE_KEY = "baseline:maintenance-assets";
const AS_OF = 2026;
const SAMPLE = generateSampleAssets(400, 2027, AS_OF);

function loadImported(): Asset[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Asset[]) : null;
  } catch {
    return null;
  }
}
function saveImported(assets: Asset[] | null) {
  try {
    if (assets) localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    toast("Could not save the register in this browser. It will be lost on reload.", "bad");
  }
}

const conditionTone: Record<number, Tone> = { 1: "good", 2: "neutral", 3: "warn", 4: "serious", 5: "bad" };
const ConditionBadge = ({ c }: { c: number }) => <Badge tone={conditionTone[Math.round(c)] ?? "neutral"}>{`${Math.round(c)} · ${CONDITION_LABEL[Math.round(c)] ?? "?"}`}</Badge>;

type View = "funded" | "unfunded" | "all";

export default function Maintenance() {
  const [imported, setImported] = useState<Asset[] | null>(() => loadImported());
  const [errors, setErrors] = useState<string[]>([]);
  const [view, setView] = useState<View>("funded");
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const assets = imported ?? SAMPLE;
  const isSample = !imported;

  const assessed = useMemo(() => assets.map((a) => assessAsset(a, AS_OF)), [assets]);
  const backlogTotal = useMemo(() => sum(assessed.filter((a) => a.inBacklog).map((a) => a.repairCost)), [assessed]);
  const step = backlogTotal > 5e9 ? 50e6 : backlogTotal > 5e8 ? 5e6 : 500e3;
  const sliderMax = Math.max(step, Math.ceil(backlogTotal / step) * step);
  const [budget, setBudget] = useState<number>(() => Math.round((backlogTotal * 0.3) / step) * step);
  const effectiveBudget = Math.min(budget, sliderMax);

  const plan = useMemo(() => planYear(assets, effectiveBudget, AS_OF), [assets, effectiveBudget]);
  const sims = useMemo(
    () => ({
      none: simulate(assets, 0, 5, AS_OF),
      plan: simulate(assets, effectiveBudget, 5, AS_OF),
      all: simulate(assets, Infinity, 5, AS_OF),
    }),
    [assets, effectiveBudget],
  );
  const chartData = sims.none.map((y, i) => ({
    year: y.year,
    none: y.backlog,
    plan: sims.plan[i].backlog,
    all: sims.all[i].backlog,
    noneRisk: y.risk,
    planRisk: sims.plan[i].risk,
    allRisk: sims.all[i].risk,
  }));
  const totalRisk = sum(assessed.map((a) => a.risk));
  const overdue = assessed.filter((a) => a.inspectionOverdue).length;
  const fundedIds = useMemo(() => new Set(plan.funded.map((f) => f.asset.id)), [plan]);

  const rows: AssetAssessment[] = useMemo(() => {
    if (view === "funded") return plan.funded;
    if (view === "unfunded") return plan.unfunded;
    return [...assessed].sort((a, b) => b.risk - a.risk);
  }, [view, plan, assessed]);
  const visible = showAll ? rows : rows.slice(0, 25);

  const onFile = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const { assets: parsed, errors: problems } = parseAssetRows(res.data, AS_OF);
        setErrors(problems);
        if (!parsed.length) {
          toast("No valid assets found in that file.", "bad");
          return;
        }
        setImported(parsed);
        saveImported(parsed);
        const backlog = sum(parsed.map((a) => assessAsset(a, AS_OF)).filter((a) => a.inBacklog).map((a) => a.repairCost));
        setBudget(Math.round(backlog * 0.3));
        toast(`Imported ${num(parsed.length)} assets${problems.length ? ` (${problems.length} rows skipped)` : ""}`);
      },
      error: (err) => {
        setErrors([`Could not read the file: ${err.message}`]);
      },
    });
  };

  const exportPlan = () => {
    downloadFile(
      "baseline-maintenance-plan.csv",
      toCsv(
        [...assessed]
          .sort((a, b) => b.priority - a.priority)
          .map((a, i) => ({
            rank: i + 1,
            id: a.asset.id,
            name: a.asset.name,
            type: a.asset.type,
            borough: a.asset.boro,
            condition: a.asset.condition,
            age_years: a.age,
            useful_life: a.asset.usefulLife,
            criticality: a.asset.criticality,
            replacement_value: Math.round(a.asset.replacementValue),
            repair_cost: Math.round(a.repairCost),
            annual_failure_probability: a.pof.toFixed(4),
            expected_annual_loss: Math.round(a.risk),
            funded_this_year: fundedIds.has(a.asset.id) ? "yes" : "no",
            inspection_overdue: a.inspectionOverdue ? "yes" : "no",
            sample_data: a.asset.sample ? "yes" : "no",
          })),
      ),
      "text/csv",
    );
  };

  const riskRemovedShare = totalRisk > 0 ? plan.riskReduced / totalRisk : 0;
  const fiveYearExtra = sims.none[4].backlog - sims.all[4].backlog;

  return (
    <>
      <PageHeader
        eyebrow="Plan & price"
        title="Maintenance risk"
        description="Rank every asset by how likely it is to fail and what a failure would cost, then fund the repairs that remove the most risk per dollar. This is what the city's AIMS report was meant to be."
        actions={
          <>
            <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => downloadFile("baseline-asset-template.csv", ASSET_TEMPLATE_CSV, "text/csv")}>
              CSV template
            </Button>
            <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
              Import register
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Import asset register CSV"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            {!isSample && (
              <Button
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  setImported(null);
                  saveImported(null);
                  setErrors([]);
                  setBudget(Math.round((sum(SAMPLE.map((a) => assessAsset(a, AS_OF)).filter((a) => a.inBacklog).map((a) => a.repairCost)) * 0.3) / step) * step);
                }}
              >
                Back to sample
              </Button>
            )}
            <Button icon={<Download className="size-4" />} onClick={exportPlan}>
              Export plan
            </Button>
          </>
        }
      />

      {isSample ? (
        <Callout tone="warn" title="Sample data" className="mb-6">
          These {num(SAMPLE.length)} assets are fictional (IDs start with SAMPLE-). NYC does not publish asset-level condition data, so Baseline uses a sample register to show the method. Import your own register
          (CSV) to rank real assets. Your file stays in this browser.
        </Callout>
      ) : (
        <Callout tone="good" title={`Your register: ${num(assets.length)} assets`} className="mb-6">
          Rankings below use the register you imported. It is stored only in this browser.
        </Callout>
      )}
      {errors.length > 0 && (
        <Callout tone="bad" title={`${errors.length} row${errors.length === 1 ? "" : "s"} skipped`} className="mb-6">
          <ul className="list-disc pl-4 text-[13px]">
            {errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {errors.length > 8 && <p className="mt-1 text-[13px]">…and {errors.length - 8} more.</p>}
        </Callout>
      )}

      <Section title="Why the city's asset report needs a rebuild" description="What the NYC Comptroller found when it audited the AIMS process.">
        <div className="grid gap-3 md:grid-cols-3">
          <Stat
            label="Estimate vs. reality"
            value={`${money(AIMS_FACTS.riverside.aimsEstimate)} → ${money(AIMS_FACTS.riverside.bid)}`}
            detail="AIMS estimate for the Riverside Park bridge repair, and the bid a few months later."
            source="aimsAudit"
          />
          <Stat
            label="Surface-level surveys"
            value={`${AIMS_FACTS.surveyMinutes.fdnyMinutes} minutes`}
            detail={`to survey a ${num(AIMS_FACTS.surveyMinutes.fdnySqft)} sq ft FDNY building. Auditors found ${AIMS_FACTS.unreportedConditions.conditions} unreported structural problems at ${AIMS_FACTS.unreportedConditions.assets} assets.`}
            source="aimsAudit"
          />
          <Stat
            label="The repair bill AIMS reports"
            value={money(AIMS_FACTS.needFy24to27)}
            detail={`for FY2024–27 across ${num(AIMS_FACTS.assets)} assets, with no link to what actually gets funded.`}
            source="aimsAudit"
          />
        </div>
      </Section>

      <Card className="mb-6">
        <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <Slider
              label="Annual repair budget"
              value={effectiveBudget}
              min={0}
              max={sliderMax}
              step={step}
              onChange={setBudget}
              format={(v) => money(v)}
              hint={`Fund-all would take ${money(backlogTotal)} this year.`}
            />
            <p className="mt-4 text-[13.5px] text-ink-2">
              Baseline funds repairs in order of <strong>risk removed per dollar</strong>: the drop in expected annual loss from fixing an asset, divided by the repair cost. Cheap fixes on critical, failing assets
              come first.
            </p>
          </div>
          <StatGrid cols={2}>
            <Stat label="Repair backlog today" value={money(plan.backlog)} detail={`${num(assessed.filter((a) => a.inBacklog).length)} assets in Worn condition or worse`} />
            <Stat label="Funded this year" value={num(plan.funded.length)} detail={`${money(plan.spent)} of ${money(effectiveBudget)}`} tone="brand" />
            <Stat label="Risk removed" value={pct(riskRemovedShare)} detail={`of expected annual losses (${money(plan.riskReduced)} a year, estimate)`} tone="good" />
            <Stat label="Inspections overdue" value={num(overdue)} detail={`not inspected in the last ${INSPECTION_CYCLE_YEARS} years (AIMS cycle)`} tone={overdue ? "warn" : "good"} />
          </StatGrid>
        </CardBody>
      </Card>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Repair backlog over five years" subtitle="Estimate. Deferred repairs get worse and cost more; construction prices rise 3% a year." />
          <CardBody>
            <TimeSeriesChart
              data={chartData}
              xKey="year"
              xFormat={(v) => `FY${String(v).slice(-2)}`}
              series={[
                { key: "none", label: "Do nothing", slot: 1 },
                { key: "plan", label: "Your budget", slot: 0 },
                { key: "all", label: "Fund every repair", slot: 2 },
              ]}
              yFormat={(v) => money(v)}
              height={240}
            />
            <p className="mt-2 text-[13px] text-ink-2">
              Doing nothing leaves a backlog <strong>{money(fiveYearExtra)}</strong> larger in five years than funding every repair now.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Expected annual loss" subtitle="Estimate. Chance of failure × cost of a failure, summed across all assets." />
          <CardBody>
            <TimeSeriesChart
              data={chartData}
              xKey="year"
              xFormat={(v) => `FY${String(v).slice(-2)}`}
              series={[
                { key: "noneRisk", label: "Do nothing", slot: 1 },
                { key: "planRisk", label: "Your budget", slot: 0 },
                { key: "allRisk", label: "Fund every repair", slot: 2 },
              ]}
              yFormat={(v) => money(v)}
              height={240}
            />
          </CardBody>
        </Card>
      </div>

      <Section
        title="This year's plan"
        description="Ranked by risk removed per dollar."
        actions={
          <Segmented<View>
            size="sm"
            value={view}
            onChange={(v) => {
              setView(v);
              setShowAll(false);
            }}
            options={[
              { value: "funded", label: `Funded (${plan.funded.length})` },
              { value: "unfunded", label: `Not funded (${plan.unfunded.length})` },
              { value: "all", label: "All assets" },
            ]}
          />
        }
      >
        <Card>
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState title={view === "funded" ? "Nothing funded yet" : "Nothing here"}>
                {view === "funded" ? "Raise the annual repair budget to fund the highest-risk repairs." : "Every backlog repair fits in this budget."}
              </EmptyState>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Asset</Th>
                  <Th>Condition</Th>
                  <Th align="right">Age / life</Th>
                  <Th align="right">Criticality</Th>
                  <Th align="right">Repair cost</Th>
                  <Th align="right">Chance of failure / yr</Th>
                  <Th align="right">Risk removed per $1M</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.asset.id}>
                    <Td className="max-w-[260px]">
                      <div className="truncate font-medium text-ink" title={a.asset.name}>
                        {a.asset.name}
                      </div>
                      <div className="truncate text-[12px] text-ink-3">
                        {a.asset.id} · {a.asset.type} · {a.asset.boro} · {classLabel(a.asset.cls)}
                      </div>
                    </Td>
                    <Td>
                      <ConditionBadge c={a.asset.condition} />
                    </Td>
                    <Td align="right">
                      {a.age} / {a.asset.usefulLife} yrs
                    </Td>
                    <Td align="right">{a.asset.criticality} / 5</Td>
                    <Td align="right">{money(a.repairCost)}</Td>
                    <Td align="right">{pct(a.pof, { digits: 1 })}</Td>
                    <Td align="right">{a.inBacklog ? `${money(a.priority * 1e6)}/yr` : "—"}</Td>
                    <Td>
                      {fundedIds.has(a.asset.id) ? (
                        <Badge tone="good">Funded</Badge>
                      ) : a.inBacklog ? (
                        <Badge tone="warn">Deferred</Badge>
                      ) : (
                        <Badge>Routine upkeep</Badge>
                      )}
                      {a.inspectionOverdue && <div className="mt-1 text-[11.5px] text-warn-ink">Inspection overdue</div>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {rows.length > 25 && (
            <div className="border-t border-line px-4 py-3 text-center">
              <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show top 25" : `Show all ${num(rows.length)}`}
              </Button>
            </div>
          )}
        </Card>
        <SourceNote className="mt-2">
          {isSample ? "Sample register (fictional assets). " : "Your imported register. "}
          Failure probabilities, repair costs and deterioration rates are Baseline's model assumptions, described on the methodology page. Replace them with your engineers' figures by adding a repair_cost
          column.
        </SourceNote>
      </Section>

      <Callout tone="neutral" title="How this improves on AIMS" className="mb-8">
        AIMS lists repair needs but has no stated purpose in the City Charter and no link to what gets funded. The Comptroller recommended tying condition assessments to the 10-year capital strategy and ranking work
        by deterioration, public-safety risk and how critical an asset is. This view does that: every asset carries a failure probability, a consequence and a cost, and the budget slider shows what each level of
        funding buys. <Cite id="betterAims" />
      </Callout>
    </>
  );
}
