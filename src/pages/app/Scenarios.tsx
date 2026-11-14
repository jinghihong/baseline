// Gap scenarios: start from OMB's published out-year gaps, add the Comptroller's risks and your own assumptions.
import { RotateCcw, Save, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Cite,
  cn,
  EmptyState,
  Field,
  Input,
  MoneyInput,
  PageHeader,
  Section,
  Segmented,
  Select,
  Slider,
  Stat,
  StatGrid,
  Table,
  Td,
  Th,
  toast,
  Toggle,
} from "../../components/ui";
import { FY27_EXPENSE_RISKS, FY27_REVENUE_DIFF, FY27_YEARS } from "../../data/curated";
import { useDataset } from "../../data/load";
import { totalOvertimeShortfall } from "../../engines/budgetRisk";
import { assessAllOvertime } from "../../engines/core";
import {
  ALL_RISK_IDS,
  decodeInputs,
  encodeInputs,
  presetInputs,
  PRESETS,
  runScenario,
  type Contribution,
  type OvertimeMode,
  type PresetId,
  type ScenarioInputs,
} from "../../engines/scenarios";
import { date, fy, money } from "../../lib/format";
import { newId, updateWorkspace, useWorkspace } from "../../state/store";

const m = (v: number) => money(v * 1e6);
const SOURCE_TONE: Record<Contribution["source"], { label: string; tone: "brand" | "neutral" | "warn" }> = {
  comptroller: { label: "Comptroller", tone: "brand" },
  baseline: { label: "Baseline estimate", tone: "neutral" },
  assumption: { label: "Your assumption", tone: "warn" },
};

function Amount({ v, strong }: { v: number; strong?: boolean }) {
  if (Math.abs(v) < 0.5) return <span className="text-ink-3">—</span>;
  return <span className={cn("tabular", v < 0 ? "text-bad-ink" : "text-good-ink", strong && "font-semibold")}>{m(v)}</span>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function Scenarios() {
  const overtime = useDataset("overtime");
  const saved = useWorkspace((w) => w.scenarios);
  const otM = useMemo(() => (overtime.data ? Math.round(totalOvertimeShortfall(assessAllOvertime(overtime.data)) / 1e6) : 0), [overtime.data]);

  const [inputs, setInputs] = useState<ScenarioInputs>(() => presetInputs("comptroller"));
  const [activePreset, setActivePreset] = useState<PresetId | null>("comptroller");
  const [name, setName] = useState("");

  const effective = { ...inputs, baselineOvertimeM: otM };
  const result = runScenario(effective);

  const change = (patch: Partial<ScenarioInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
    setActivePreset(null);
  };
  const setRisk = (id: string, on: boolean) => change({ risks: { ...inputs.risks, [id]: on } });
  const applyPreset = (id: PresetId) => {
    setInputs(presetInputs(id, otM));
    setActivePreset(id);
  };

  const saveScenario = () => {
    const label = name.trim() || `Scenario ${saved.length + 1}`;
    updateWorkspace((w) => {
      w.scenarios.unshift({ id: newId("scn"), name: label, createdAt: new Date().toISOString(), adjustments: encodeInputs(effective) });
    });
    setName("");
    toast(`Saved “${label}”`);
  };

  const chartRows = result.years.map((year, i) => ({ fy: year, omb: result.omb[i], comptroller: result.comptroller[i], scenario: result.scenario[i] }));
  const all = chartRows.flatMap((r) => [r.omb, r.comptroller, r.scenario]);
  const lo = Math.min(...all);
  const hi = Math.max(0, ...all);
  const pad = (hi - lo) * 0.12 || 500;
  const contribTotals = result.years.map((_, i) => result.contributions.reduce((s, c) => s + c.values[i], 0));
  const expenseRisks = FY27_EXPENSE_RISKS.filter((r) => r.id !== "overtime");
  const otComptroller = FY27_EXPENSE_RISKS.find((r) => r.id === "overtime");

  return (
    <>
      <PageHeader
        eyebrow="Budget risk"
        title="Gap scenarios"
        description="The adopted plan balances FY27 and shows gaps of $6.4B to $8.5B a year after that. Start from those published numbers, switch on the risks the Comptroller found, and add your own assumptions to see how large the gap could get."
      />

      <Card className="mb-6 p-4">
        <div className="mb-2 text-[13px] font-medium text-ink-2">Start from a preset</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              aria-pressed={activePreset === p.id}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                activePreset === p.id ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong hover:bg-surface-2",
              )}
            >
              <div className={cn("text-[13.5px] font-semibold", activePreset === p.id ? "text-brand" : "text-ink")}>{p.label}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-ink-3">{p.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader
            title="Levers"
            subtitle="Every change is applied on top of OMB's plan."
            actions={
              <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => applyPreset("omb")}>
                Reset
              </Button>
            }
          />
          <Group title="Revenue">
            <Toggle
              checked={inputs.comptrollerRevenue}
              onChange={(v) => change({ comptrollerRevenue: v })}
              label={`Use the Comptroller's revenue forecast (+${m(FY27_REVENUE_DIFF.total[0])} in FY27, +${m(FY27_REVENUE_DIFF.total[3])} by FY30)`}
            />
            <Slider
              label="Tax revenue vs plan, every year"
              value={inputs.taxPct}
              onChange={(v) => change({ taxPct: v })}
              min={-10}
              max={5}
              step={0.5}
              format={(v) => `${v > 0 ? "+" : ""}${v}%`}
              hint="Your assumption, applied to OMB's tax base."
            />
            <Slider
              label="Recession depth"
              value={inputs.recessionPct}
              onChange={(v) => change({ recessionPct: v })}
              min={0}
              max={15}
              step={1}
              format={(v) => (v ? `−${v}% tax` : "None")}
              hint="Tax revenue falls this far below plan in FY28 and FY29, and half as far in FY30."
            />
            <Slider
              label="Tax base growth after FY27"
              value={inputs.taxGrowthPct}
              onChange={(v) => change({ taxGrowthPct: v })}
              min={0}
              max={6}
              step={0.5}
              format={(v) => `${v}% a year`}
              hint="Assumption used only to size the levers above. FY27 is OMB's published $88.7B."
            />
          </Group>

          <Group title="Spending risks the Comptroller found">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => change({ risks: Object.fromEntries(ALL_RISK_IDS.map((id) => [id, true])) })}>
                All on
              </Button>
              <Button size="sm" variant="ghost" onClick={() => change({ risks: Object.fromEntries(ALL_RISK_IDS.map((id) => [id, false])) })}>
                All off
              </Button>
            </div>
            <div className="space-y-2.5">
              {expenseRisks.map((r) => {
                const total = r.values.reduce((s, v) => s + v, 0);
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3">
                    <Toggle checked={!!inputs.risks[r.id]} onChange={(v) => setRisk(r.id, v)} label={r.label} />
                    <span className="shrink-0 pt-0.5 text-[12px]">
                      <Amount v={total} />
                      <span className="text-ink-3"> / 4 yrs</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Group>

          <Group title="Overtime">
            <Segmented<OvertimeMode>
              size="sm"
              value={inputs.overtimeMode}
              onChange={(v) => change({ overtimeMode: v })}
              options={[
                { value: "off", label: "Off" },
                { value: "comptroller", label: "Comptroller" },
                { value: "baseline", label: "Baseline" },
              ]}
            />
            <p className="text-[12.5px] text-ink-3">
              Comptroller: {m(Math.abs(otComptroller?.values[0] ?? 0))} short in FY27 (city funds). Baseline: {overtime.loading ? "loading…" : `${m(otM)} a year`} (estimate, all funds, from the Overtime monitor, held flat).
            </p>
          </Group>

          <Group title="Your assumptions">
            <Slider
              label="Labor settlements above plan"
              value={inputs.laborPct}
              onChange={(v) => change({ laborPct: v })}
              min={0}
              max={5}
              step={0.25}
              format={(v) => (v ? `+${v}% a year` : "None")}
              hint="Raises beyond what the plan funds, compounding from FY28."
            />
            <Field label="Payroll base the raises apply to" htmlFor="sc-payroll" hint="Assumption. Default $35B.">
              <MoneyInput id="sc-payroll" value={inputs.payrollBaseM * 1e6} onChange={(v) => change({ payrollBaseM: Math.max(0, v / 1e6) })} />
            </Field>
            <Slider
              label="Further federal aid cuts"
              value={inputs.federalCutM}
              onChange={(v) => change({ federalCutM: v })}
              min={0}
              max={3000}
              step={100}
              format={(v) => (v ? `${m(v)} a year` : "None")}
            />
            <Field label="Federal cuts start" htmlFor="sc-fedstart">
              <Select id="sc-fedstart" value={inputs.federalStartFy} onChange={(e) => change({ federalStartFy: Number(e.target.value) })}>
                {FY27_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {fy(y)}
                  </option>
                ))}
              </Select>
            </Field>
            <Toggle checked={inputs.savingsRisk} onChange={(v) => change({ savingsRisk: v })} label="Savings the plan counts on don't happen (Comptroller)" />
          </Group>
        </Card>

        <div className="min-w-0 space-y-6">
          <StatGrid cols={4}>
            {result.years.map((year, i) => {
              const diff = result.scenario[i] - result.omb[i];
              return (
                <Stat
                  key={year}
                  label={`${fy(year)} gap`}
                  value={m(result.scenario[i])}
                  detail={Math.abs(diff) < 0.5 ? "Same as OMB" : `${m(diff)} vs OMB`}
                  tone={diff < -0.5 ? "bad" : diff > 0.5 ? "good" : "neutral"}
                />
              );
            })}
          </StatGrid>

          <Card>
            <CardBody>
              <TimeSeriesChart
                title="Budget gap by fiscal year"
                subtitle="Below zero means spending exceeds revenue. The city must close every year's gap before it adopts that year's budget."
                data={chartRows}
                xKey="fy"
                xFormat={(v) => fy(Number(v))}
                yFormat={(v) => m(v)}
                series={[
                  { key: "omb", label: "OMB plan", slot: 0 },
                  { key: "comptroller", label: "Comptroller", slot: 1 },
                  { key: "scenario", label: "Your scenario", slot: 2 },
                ]}
                referenceLines={[{ y: 0, label: "Balanced" }]}
                yDomain={[Math.floor(lo - pad), Math.ceil(hi + pad / 3)]}
                height={300}
              />
              <p className="mt-3 text-[12.5px] text-ink-3">
                OMB and Comptroller lines are published figures <Cite id="fy27Adopted" />. Your scenario adds the levers on the left; anything marked as an assumption is yours to change.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What moves the gap" subtitle="Each lever's effect by year. Red widens the gap; green narrows it." />
            <Table>
              <thead>
                <tr>
                  <Th>Lever</Th>
                  <Th>Source</Th>
                  {result.years.map((y) => (
                    <Th key={y} align="right">
                      {fy(y)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td className="text-ink">OMB plan gap</Td>
                  <Td>
                    <Badge tone="brand">Published</Badge>
                  </Td>
                  {result.omb.map((v, i) => (
                    <Td key={i} align="right">
                      <Amount v={v} />
                    </Td>
                  ))}
                </tr>
                {result.contributions.map((c) => (
                  <tr key={c.id}>
                    <Td className="text-ink-2">{c.label}</Td>
                    <Td>
                      <Badge tone={SOURCE_TONE[c.source].tone}>{SOURCE_TONE[c.source].label}</Badge>
                    </Td>
                    {c.values.map((v, i) => (
                      <Td key={i} align="right">
                        <Amount v={v} />
                      </Td>
                    ))}
                  </tr>
                ))}
                {result.contributions.length > 0 && (
                  <tr className="bg-surface-2/60">
                    <Td className="font-semibold text-ink" >
                      All levers
                    </Td>
                    <Td />
                    {contribTotals.map((v, i) => (
                      <Td key={i} align="right">
                        <Amount v={v} strong />
                      </Td>
                    ))}
                  </tr>
                )}
                <tr className="border-t-2 border-line-strong bg-brand-soft/50">
                  <Td className="font-semibold text-ink">Your scenario</Td>
                  <Td />
                  {result.scenario.map((v, i) => (
                    <Td key={i} align="right">
                      <Amount v={v} strong />
                    </Td>
                  ))}
                </tr>
              </tbody>
            </Table>
            {result.contributions.length === 0 && <p className="px-5 py-3 text-[13px] text-ink-3">No levers are on. This is OMB's plan as adopted.</p>}
          </Card>

          <Callout tone="neutral" title="How to read this">
            A scenario is not a forecast. It shows what the gap would be if the assumptions you chose come true. Over four years, this scenario changes the total gap by{" "}
            <strong className="text-ink">{m(result.totalChange)}</strong> compared with OMB's plan.
          </Callout>

          <Section title="Saved scenarios" description="Saved in this browser.">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Name this scenario" className="min-w-[200px] flex-1" htmlFor="sc-name">
                  <Input id="sc-name" value={name} placeholder="e.g. Recession plus labor deal" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveScenario()} />
                </Field>
                <Button variant="primary" icon={<Save className="size-4" />} onClick={saveScenario}>
                  Save
                </Button>
              </div>
              {saved.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="No saved scenarios">Save one to compare it later or bring it to a meeting.</EmptyState>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {saved.map((s) => {
                    const r = runScenario(decodeInputs(s.adjustments, otM));
                    return (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium text-ink">{s.name}</div>
                          <div className="text-[12.5px] text-ink-3">
                            Saved {date(s.createdAt.slice(0, 10))} · FY30 gap {m(r.scenario[3])}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setInputs(decodeInputs(s.adjustments, otM));
                              setActivePreset(null);
                              toast(`Loaded “${s.name}”`);
                            }}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${s.name}`}
                            onClick={() =>
                              updateWorkspace((w) => {
                                w.scenarios = w.scenarios.filter((x) => x.id !== s.id);
                              })
                            }
                          >
                            <Trash className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
