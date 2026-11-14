// Cost forecaster: price a capital project from what happened to similar NYC projects.
import { BookOpen, Calculator, Download, Printer, RotateCcw, Save, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { DistributionChart, RankedBars } from "../../components/charts";
import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  MoneyInput,
  PageHeader,
  Section,
  Select,
  SourceNote,
  Table,
  Td,
  Th,
  Toggle,
  downloadFile,
  toCsv,
  toast,
} from "../../components/ui";
import { agencyName } from "../../data/agencies";
import { AIMS_FACTS } from "../../data/curated";
import { useDataset } from "../../data/load";
import { forecastFromData, ratioPercentile } from "../../engines/costForecast";
import { BOROUGHS, ConfidenceBadge, ForecastBands, agencyOptions, classLabelMap, ratioChange } from "../../features/capital/shared";
import { date, duration, money, pct } from "../../lib/format";
import { newId, updateWorkspace, useWorkspace } from "../../state/store";

interface FormState {
  name: string;
  assetClass: string;
  agency: string;
  boro: string;
  estimate: number;
}

const DEFAULT_FORM: FormState = { name: "", assetClass: "bridges", agency: "", boro: "", estimate: 25e6 };
const RIVERSIDE: FormState = { name: AIMS_FACTS.riverside.project, assetClass: "bridges", agency: "DOT", boro: "Manhattan", estimate: AIMS_FACTS.riverside.aimsEstimate };

export default function Forecaster() {
  const reference = useDataset("reference");
  const imported = useWorkspace((w) => w.importedProjects);
  const estimates = useWorkspace((w) => w.estimates);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [useImported, setUseImported] = useState(true);
  const [preset, setPreset] = useState<"riverside" | null>(null);

  const labels = useMemo(() => classLabelMap(reference.data?.meta.classes), [reference.data]);
  const agencies = useMemo(() => agencyOptions(reference.data?.projects.map((p) => p.agency) ?? []), [reference.data]);
  const result = useMemo(() => {
    if (!reference.data) return null;
    return forecastFromData(
      reference.data,
      { assetClass: form.assetClass, agency: form.agency || null, boro: form.boro || null, estimate: form.estimate },
      useImported ? imported : [],
    );
  }, [reference.data, form, imported, useImported]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key !== "name") setPreset(null);
  };

  const save = () => {
    if (!result) return;
    updateWorkspace((w) => {
      w.estimates.unshift({
        id: newId("est"),
        createdAt: new Date().toISOString(),
        name: form.name.trim() || `${labels.get(form.assetClass) ?? "Project"} estimate`,
        assetClass: form.assetClass,
        agency: form.agency || null,
        boro: form.boro || null,
        baseEstimate: form.estimate,
        p50: result.dollars.p50,
        p80: result.dollars.p80,
        p90: result.dollars.p90,
        expectedSlipDays: result.slip ? Math.round(result.slip.p50) : null,
        comparables: Math.round(result.nEff),
      });
    });
    toast("Estimate saved");
  };

  const exportEstimates = () => {
    downloadFile(
      "baseline-estimates.csv",
      toCsv(
        estimates.map((e) => ({
          name: e.name,
          asset_class: labels.get(e.assetClass) ?? e.assetClass,
          agency: e.agency ? agencyName(e.agency) : "",
          borough: e.boro ?? "",
          estimate: Math.round(e.baseEstimate),
          p50: Math.round(e.p50),
          p80: Math.round(e.p80),
          p90: Math.round(e.p90),
          expected_slip_days: e.expectedSlipDays ?? "",
          effective_comparables: e.comparables,
          saved: e.createdAt.slice(0, 10),
        })),
      ),
      "text/csv",
    );
  };

  if (reference.error) return <ErrorBlock error={reference.error} />;

  const riverside = preset === "riverside" && result ? result : null;
  const bidRatio = AIMS_FACTS.riverside.bid / AIMS_FACTS.riverside.aimsEstimate;

  return (
    <>
      <PageHeader
        eyebrow="Plan & price"
        title="Cost forecaster"
        description="Price a capital project from what actually happened to similar NYC projects. Enter today's estimate and see the range of likely final costs, with a budget you can defend."
        actions={
          <>
            <Button
              icon={<Calculator className="size-4" />}
              onClick={() => {
                setForm(RIVERSIDE);
                setPreset("riverside");
              }}
            >
              Try the Riverside Park case
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="no-print h-fit lg:sticky lg:top-20">
          <CardHeader title="Your project" subtitle="Change any field and the forecast updates." />
          <CardBody className="flex flex-col gap-4">
            <Field label="Project name" htmlFor="f-name">
              <Input id="f-name" value={form.name} placeholder="e.g. Hamilton Ave bridge rehab" onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Type of project" htmlFor="f-class">
              <Select id="f-class" value={form.assetClass} onChange={(e) => set("assetClass", e.target.value)}>
                {(reference.data?.meta.classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Managing agency" htmlFor="f-agency" hint="Projects managed by the same agency count 1.5x.">
              <Select id="f-agency" value={form.agency} onChange={(e) => set("agency", e.target.value)}>
                <option value="">Any agency</option>
                {agencies.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Borough" htmlFor="f-boro">
              <Select id="f-boro" value={form.boro} onChange={(e) => set("boro", e.target.value)}>
                <option value="">Any borough</option>
                {BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Current cost estimate" htmlFor="f-est" hint='Type "25M", "1.2B" or a full number.'>
              <MoneyInput id="f-est" value={form.estimate} onChange={(v) => set("estimate", v)} />
            </Field>
            {imported.length > 0 && <Toggle checked={useImported} onChange={setUseImported} label={`Include my ${imported.length} imported projects`} />}
            <div className="flex gap-2">
              <Button variant="primary" icon={<Save className="size-4" />} onClick={save} disabled={!result} className="flex-1">
                Save estimate
              </Button>
              <Button
                variant="ghost"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  setForm(DEFAULT_FORM);
                  setPreset(null);
                }}
                aria-label="Reset form"
              />
            </div>
          </CardBody>
        </Card>

        <div className="min-w-0">
          {reference.loading && <LoadingBlock label="Loading 5,000 past NYC projects…" />}
          {reference.data && !result && (
            <EmptyState icon={<Calculator className="size-6" />} title="Enter an estimate to see the forecast">
              The estimate must be a positive dollar amount.
            </EmptyState>
          )}
          {result && (
            <>
              <div className="print-only mb-4">
                <h2 className="text-xl font-semibold">{form.name || "Project estimate"}</h2>
                <p className="text-sm">
                  {labels.get(form.assetClass)} · {form.agency ? agencyName(form.agency) : "Any agency"} · {form.boro || "Any borough"} · Estimate {money(form.estimate)}
                </p>
              </div>

              {riverside && (
                <Callout tone={riverside.dollars.p80 >= AIMS_FACTS.riverside.bid ? "good" : "warn"} title="The Riverside Park bridge, priced with hindsight" className="mb-4">
                  <p>
                    In {AIMS_FACTS.riverside.estimateYear}, the city's AIMS report estimated {money(AIMS_FACTS.riverside.aimsEstimate)} for this repair. A few months later the bid came in at{" "}
                    <strong>{money(AIMS_FACTS.riverside.bid)}</strong>, almost double.
                  </p>
                  <p className="mt-1.5">
                    For a {money(AIMS_FACTS.riverside.aimsEstimate)} bridge project, the city's own track record puts the P80 at <strong>{money(riverside.dollars.p80)}</strong> and the P90 at{" "}
                    <strong>{money(riverside.dollars.p90)}</strong>. The actual bid ({ratioChange(bidRatio)}) sits at about the <strong>{pct(ratioPercentile(riverside, bidRatio))}</strong> mark of what
                    similar projects did. {riverside.dollars.p80 >= AIMS_FACTS.riverside.bid ? "A P80 budget would have covered it." : "A P80 budget would have narrowed the gap; a P90 budget would have covered it."}
                  </p>
                  <div className="mt-2">
                    <Cite id="aimsAudit" />
                  </div>
                </Callout>
              )}

              <ForecastBands result={result} />

              <Card className="mt-4">
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl text-[14px] text-ink-2">
                    <div className="text-[15px] font-semibold text-ink">
                      Budget {money(result.dollars.p80)}, a {pct(Math.max(0, result.contingencyP80))} contingency on {money(form.estimate)}.
                    </div>
                    <p className="mt-1">
                      Similar projects usually cost more than their first budget: {pct(result.shareOver)} grew, and {pct(result.shareOver20)} grew by 20% or more. Budgeting at P80 means the project has an 80% chance of
                      fitting, based on {Math.round(result.nEff)} comparable NYC projects. Budgeting at the estimate alone means it probably won't.
                    </p>
                    {result.fellBack && (
                      <p className="mt-1.5 text-[13px] text-warn-ink">
                        Only {result.classCount} past projects of this type were usable, so Baseline widened the pool to all project types and counted same-type projects double.
                      </p>
                    )}
                  </div>
                  <ConfidenceBadge confidence={result.confidence} nEff={result.nEff} />
                </CardBody>
              </Card>

              <Section title="How similar projects ended up" description="Latest planned cost compared with the original budget, for past projects of broadly similar size." className="mt-6">
                <Card>
                  <CardBody>
                    <DistributionChart
                      bins={result.bins}
                      xFormat={(v) => ratioChange(v)}
                      markers={[
                        { x: Math.min(result.ratios.p50, result.binRange[1]), label: "P50" },
                        { x: Math.min(result.ratios.p80, result.binRange[1]), label: "P80" },
                      ]}
                    />
                    <SourceNote className="mt-2">
                      Change from original budget. The last bar includes projects that grew 3x or more. Source: NYC Capital Project Detail Data, October 2023 snapshot.
                    </SourceNote>
                  </CardBody>
                </Card>
              </Section>

              <div className="mb-8 grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader title="Schedule" subtitle="How far completion dates moved for similar projects" />
                  <CardBody>
                    {result.slip ? (
                      <div className="text-[14px] text-ink-2">
                        <div className="text-[24px] font-semibold text-ink">{duration(result.slip.p50)}</div>
                        <p>typical delay versus the original completion date (median).</p>
                        <p className="mt-2">
                          {pct(result.slip.shareLate)} of similar projects finished later than first planned. 1 in 5 slipped by more than <strong>{duration(result.slip.p80)}</strong>.
                        </p>
                        <p className="mt-2 text-[12.5px] text-ink-3">Estimate based on {result.slip.n} projects with milestone data.</p>
                      </div>
                    ) : (
                      <p className="text-[14px] text-ink-3">No schedule data for these projects.</p>
                    )}
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Why similar projects were delayed" subtitle="Reasons the city recorded, weighted by similarity" />
                  <CardBody>
                    {result.reasons.length ? (
                      <RankedBars rows={result.reasons.map((r) => ({ id: r.label, label: r.label, value: r.share }))} format={(v) => pct(v)} max={1} />
                    ) : (
                      <p className="text-[14px] text-ink-3">No delay reasons were recorded for these projects.</p>
                    )}
                  </CardBody>
                </Card>
              </div>

              <Section title="Closest comparable projects" description="The past projects that weigh most in this forecast.">
                <Card>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Project</Th>
                        <Th>Agency</Th>
                        <Th align="right">Original</Th>
                        <Th align="right">Latest plan</Th>
                        <Th align="right">Change</Th>
                        <Th align="right">Delay</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comparables.map((c) => (
                        <tr key={c.project.id}>
                          <Td className="max-w-[280px]">
                            <div className="truncate font-medium text-ink" title={c.project.name}>
                              {c.project.name}
                            </div>
                            <div className="text-[12px] text-ink-3">
                              {c.project.boro} · {c.imported ? "Your import" : c.project.id}
                            </div>
                          </Td>
                          <Td>{c.project.agency}</Td>
                          <Td align="right">{money(c.project.orig)}</Td>
                          <Td align="right">{money(c.project.current)}</Td>
                          <Td align="right" className={c.ratio > 1.2 ? "text-bad-ink" : c.ratio < 1 ? "text-good-ink" : undefined}>
                            {ratioChange(c.project.current / c.project.orig)}
                          </Td>
                          <Td align="right">{c.project.slipDays && c.project.slipDays > 0 ? duration(c.project.slipDays) : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
                <SourceNote className="mt-2" href="https://data.cityofnewyork.us/d/wa2y-rh4b">
                  NYC Capital Project Detail Data (Dollars and Milestones), October 2023 publication: the same snapshot the NY State Comptroller reviewed in April 2024.
                </SourceNote>
              </Section>

              <Callout tone="neutral" title="How this forecast works" icon={<BookOpen className="size-4" />} className="no-print mb-8">
                Baseline looks at past NYC capital projects of the same type, weights them by how close their original budget is to yours (and by agency and borough), and reads off the share that came in under each
                cost level. This is called reference-class forecasting. Projects that are still underway may grow further, so treat these numbers as a floor on risk.{" "}
                <Link to="/methodology" className="font-medium text-brand hover:underline">
                  Read the methodology
                </Link>
                .
              </Callout>
            </>
          )}
        </div>
      </div>

      <Section
        title="Saved estimates"
        description="Stored in this browser. Export them to share."
        actions={
          estimates.length > 0 && (
            <Button size="sm" icon={<Download className="size-4" />} onClick={exportEstimates}>
              Export CSV
            </Button>
          )
        }
        className="no-print mt-4"
      >
        {estimates.length === 0 ? (
          <EmptyState title="No saved estimates yet">Save a forecast to compare projects side by side and include them in reports.</EmptyState>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th align="right">Estimate</Th>
                  <Th align="right">P50</Th>
                  <Th align="right">P80</Th>
                  <Th align="right">Typical delay</Th>
                  <Th>Saved</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {estimates.map((e) => (
                  <tr key={e.id}>
                    <Td className="font-medium text-ink">{e.name}</Td>
                    <Td>{labels.get(e.assetClass) ?? e.assetClass}</Td>
                    <Td align="right">{money(e.baseEstimate)}</Td>
                    <Td align="right">{money(e.p50)}</Td>
                    <Td align="right" className="font-medium text-ink">
                      {money(e.p80)}
                    </Td>
                    <Td align="right">{e.expectedSlipDays ? duration(e.expectedSlipDays) : "—"}</Td>
                    <Td>{date(e.createdAt.slice(0, 10))}</Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${e.name}`}
                        icon={<Trash className="size-4" />}
                        onClick={() =>
                          updateWorkspace((w) => {
                            w.estimates = w.estimates.filter((x) => x.id !== e.id);
                          })
                        }
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </Section>
    </>
  );
}
