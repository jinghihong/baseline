// Spend tracker: enter adopted budgets and monthly actuals, see where each line lands on June 30.
import Papa from "papaparse";
import { FileDown, FileUp, Gauge, Pencil, Plus, Sparkles, Trash } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  downloadFile,
  EmptyState,
  PageHeader,
  ProgressBar,
  RiskBadge,
  Section,
  Segmented,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  toast,
} from "../../components/ui";
import { LineEditor, type LineDraft } from "../../features/budget/LineEditor";
import { csvTemplate, FISCAL_MONTHS, isFlatProfile, linesFromCsvRows, METHOD_LABEL, projectLine, sampleLines, summarize, type Method } from "../../engines/spendTracker";
import { fiscalYearOf, fy, money, pct } from "../../lib/format";
import { newId, updateWorkspace, useWorkspace, type CustomBudgetLine } from "../../state/store";

export default function SpendTracker() {
  const lines = useWorkspace((w) => w.customLines);
  const [method, setMethod] = useState<Method>("blended");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomBudgetLine | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const projections = useMemo(() => lines.map((l) => projectLine(l, method)), [lines, method]);
  const summary = summarize(projections);
  const selected = projections.find((p) => p.line.id === selectedId) ?? projections[0] ?? null;
  const currentFy = fiscalYearOf();

  const addSamples = () => {
    const samples = sampleLines();
    updateWorkspace((w) => {
      const existing = new Set(w.customLines.map((l) => l.name));
      for (const s of samples) if (!existing.has(s.name)) w.customLines.push({ ...s, id: newId("line") });
    });
    toast("Added sample lines. They are labeled SAMPLE and use made-up amounts.");
  };

  const saveDraft = (draft: LineDraft) => {
    if (editing) {
      updateWorkspace((w) => {
        const i = w.customLines.findIndex((l) => l.id === editing.id);
        if (i >= 0) w.customLines[i] = { ...w.customLines[i], ...draft };
      });
      toast("Line updated");
    } else {
      const id = newId("line");
      updateWorkspace((w) => {
        w.customLines.push({ ...draft, id });
      });
      setSelectedId(id);
      toast("Line added");
    }
    setEditorOpen(false);
    setEditing(null);
  };

  const remove = (id: string) => {
    updateWorkspace((w) => {
      w.customLines = w.customLines.filter((l) => l.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
    toast("Line removed");
  };

  const onFile = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const { lines: parsed, errors } = linesFromCsvRows(res.data);
        setImportErrors(errors);
        if (parsed.length) {
          updateWorkspace((w) => {
            for (const l of parsed) w.customLines.push({ ...l, id: newId("line") });
          });
          toast(`Imported ${parsed.length} line${parsed.length === 1 ? "" : "s"}`);
        } else if (!errors.length) {
          setImportErrors(["The file had no rows. Use the template's column names."]);
        }
      },
      error: (err) => setImportErrors([`Could not read the file: ${err.message}`]),
    });
  };

  const actions = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button icon={<FileDown className="size-4" />} onClick={() => downloadFile("baseline-spend-tracker-template.csv", csvTemplate(), "text/csv")}>
        Template
      </Button>
      <Button icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
        Import CSV
      </Button>
      <Button
        variant="primary"
        icon={<Plus className="size-4" />}
        onClick={() => {
          setEditing(null);
          setEditorOpen(true);
        }}
      >
        Add line
      </Button>
    </>
  );

  const chartRows = selected
    ? selected.path.map((p) => ({ month: p.month, actual: p.actual, budget: p.budget, projected: p.projected, band: p.band ?? undefined }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Budget risk"
        title="Spend tracker"
        description={`Enter a line's adopted budget and what it has spent each month. Baseline projects where it will land on June 30, so you see an overrun in the fall, not in the spring. Tracking ${fy(currentFy)}.`}
        actions={actions}
      />

      {importErrors.length > 0 && (
        <Callout tone="warn" className="mb-4" title="Some rows were not imported">
          <ul className="list-disc pl-4">
            {importErrors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Callout>
      )}

      {lines.length === 0 ? (
        <EmptyState
          icon={<Gauge className="size-6" />}
          title="No lines tracked yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => {
                  setEditing(null);
                  setEditorOpen(true);
                }}
              >
                Add a line
              </Button>
              <Button icon={<Sparkles className="size-4" />} onClick={addSamples}>
                Add sample lines
              </Button>
            </div>
          }
        >
          Add a line by hand, import a CSV of monthly actuals, or load three sample lines to see how projections work. Your lines are saved in this browser only.
        </EmptyState>
      ) : (
        <>
          <StatGrid cols={4}>
            <Stat label="Lines tracked" value={summary.lines} detail={`${summary.atRisk} projected 5%+ over budget`} tone={summary.atRisk ? "serious" : "good"} />
            <Stat label="Adopted" value={money(summary.adopted)} detail={`Spent so far ${money(summary.ytd)}`} />
            <Stat label="Projected year-end" value={money(summary.projected)} detail={`${METHOD_LABEL[method]} method · estimate`} tone="brand" />
            <Stat
              label="Projected variance"
              value={money(summary.variance, { sign: true })}
              detail={summary.adopted ? `${pct(summary.variance / summary.adopted, { sign: true })} vs adopted` : undefined}
              tone={summary.variance > 0 ? "bad" : "good"}
            />
          </StatGrid>

          <Section
            className="mt-8"
            title="Tracked lines"
            description="Click a line to see its path through the year."
            actions={
              <Segmented<Method>
                size="sm"
                value={method}
                onChange={setMethod}
                options={[
                  { value: "blended", label: "Blended" },
                  { value: "runRate", label: "Run rate" },
                  { value: "seasonal", label: "Seasonal" },
                ]}
              />
            }
          >
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Line</Th>
                    <Th align="right">Months in</Th>
                    <Th align="right">Spent so far</Th>
                    <Th align="right">Adopted</Th>
                    <Th align="right">Projected</Th>
                    <Th align="right">Variance</Th>
                    <Th>Status</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map((p) => (
                    <tr key={p.line.id} className={p.line.id === selected?.line.id ? "bg-brand-soft/50" : "cursor-pointer hover:bg-surface-2/70"} onClick={() => setSelectedId(p.line.id)}>
                      <Td className="max-w-[260px]">
                        <button type="button" className="block w-full text-left" onClick={() => setSelectedId(p.line.id)}>
                          <span className="block truncate font-medium text-ink">{p.line.name}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">{p.line.agency}</span>
                        </button>
                      </Td>
                      <Td align="right">{p.monthsReported}/12</Td>
                      <Td align="right">
                        <div>{money(p.ytd)}</div>
                        <div className="mt-1 ml-auto w-20">
                          <ProgressBar value={p.line.adopted ? p.ytd / p.line.adopted : 0} tone={p.level === "low" ? "brand" : p.level === "watch" ? "warn" : "bad"} />
                        </div>
                      </Td>
                      <Td align="right">{money(p.line.adopted)}</Td>
                      <Td align="right" title={`80% range ${money(p.low)} – ${money(p.high)}`}>
                        {money(p.projected)}
                      </Td>
                      <Td align="right" className={p.variance > 0 ? "font-medium text-bad-ink" : "text-good-ink"}>
                        {money(p.variance, { sign: true })}
                        <div className="text-[11.5px] text-ink-3">{pct(p.variancePct, { sign: true })}</div>
                      </Td>
                      <Td>{p.under ? <Badge tone="neutral">Underspending</Badge> : <RiskBadge level={p.level} />}</Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit ${p.line.name}`}
                            onClick={() => {
                              setEditing(p.line);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Remove ${p.line.name}`} onClick={() => remove(p.line.id)}>
                            <Trash className="size-3.5" />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12.5px] text-ink-3">
                <span>Projections are estimates. Hover a projection for its 80% range. Saved in this browser only.</span>
                <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5" />} onClick={addSamples}>
                  Add sample lines
                </Button>
              </div>
            </Card>
          </Section>

          {selected && (
            <Section title={selected.line.name} description={selected.line.name.startsWith("SAMPLE") ? "Sample line with made-up amounts." : selected.line.agency}>
              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardBody>
                    <TimeSeriesChart
                      title="Cumulative spending through the year"
                      subtitle="The budget path shows where spending would be if the adopted amount were spent on the line's usual monthly pattern."
                      data={chartRows}
                      xKey="month"
                      yFormat={(v) => money(v)}
                      series={[
                        { key: "budget", label: "Budget path", slot: 0, dashed: true },
                        { key: "actual", label: "Spent so far", slot: 1 },
                        { key: "projected", label: "Projection", slot: 1, dashed: true },
                      ]}
                      band={{ key: "band", label: "Projection range (80%)", slot: 1 }}
                      forecastFrom={selected.monthsReported > 0 && selected.monthsReported < 12 ? FISCAL_MONTHS[selected.monthsReported] : undefined}
                      height={280}
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Projection methods" subtitle={isFlatProfile(selected.line.profile) ? "Spends evenly through the year" : "Uses this line's monthly pattern"} />
                  <CardBody className="space-y-3 text-[13.5px]">
                    {(["runRate", "seasonal", "blended"] as Method[]).map((m) => {
                      const v = m === "runRate" ? selected.runRate : m === "seasonal" ? selected.seasonal : selected.blended;
                      return (
                        <div key={m} className="flex items-baseline justify-between gap-3">
                          <span className={m === method ? "font-semibold text-ink" : "text-ink-2"}>{METHOD_LABEL[m]}</span>
                          <span className="tabular font-medium text-ink">{money(v)}</span>
                        </div>
                      );
                    })}
                    <p className="border-t border-line pt-3 text-[12.5px] text-ink-3">
                      Run rate repeats the average month so far. Seasonal assumes the rest of the year follows the line's usual pattern. Blended weighs the two, leaning on the pattern as the year goes on.
                    </p>
                    <div className="rounded-lg bg-surface-2 p-3 text-ink-2">
                      {selected.allowedPerMonth === null ? (
                        <>The year is complete.</>
                      ) : selected.remainingBudget <= 0 ? (
                        <>The adopted budget is already spent, with {12 - selected.monthsReported} months to go.</>
                      ) : (
                        <>
                          To stay within budget, the remaining {12 - selected.monthsReported} months can average <strong className="text-ink">{money(selected.allowedPerMonth)}</strong>.
                        </>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Section>
          )}
        </>
      )}

      <LineEditor
        open={editorOpen}
        initial={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSave={saveDraft}
      />
    </>
  );
}
