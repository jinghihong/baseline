// Fiscal notes: estimate what a proposed bill will cost over five years and produce a Fiscal Impact Statement.
import { Copy, FilePlus2, Plus, Printer, Save, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeSeriesChart } from "../../components/charts";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  MoneyInput,
  PageHeader,
  Section,
  Select,
  Slider,
  Table,
  Td,
  Textarea,
  Th,
  copyText,
  toast,
} from "../../components/ui";
import { AGENCIES, agencyName } from "../../data/agencies";
import {
  SALARY_ASSUMPTIONS,
  TEMPLATES,
  blankInput,
  computeFiscal,
  methodText,
  staffId,
  type FiscalInput,
  type FiscalResult,
} from "../../engines/fiscalNote";
import { date, fy, money, num, pct } from "../../lib/format";
import { newId, updateWorkspace, useWorkspace, type FiscalNoteDraft } from "../../state/store";

const FUNDING: FiscalInput["fundingSource"][] = ["City funds", "City and federal funds", "City and state funds", "Federal funds", "State funds"];

function draftToInput(d: FiscalNoteDraft): FiscalInput | null {
  try {
    const parsed = JSON.parse(String(d.inputs.json ?? "")) as FiscalInput;
    return { ...blankInput(), ...parsed, uncertainty: { ...blankInput().uncertainty, ...(parsed.uncertainty ?? {}) } };
  } catch {
    return null;
  }
}

export default function FiscalNotes() {
  const drafts = useWorkspace((w) => w.fiscalNotes);
  const [input, setInput] = useState<FiscalInput>(() => TEMPLATES[0].build());
  const [draftId, setDraftId] = useState<string | null>(null);
  const result = useMemo(() => computeFiscal(input), [input]);
  const set = (patch: Partial<FiscalInput>) => setInput((i) => ({ ...i, ...patch }));

  const save = () => {
    const now = new Date().toISOString();
    const id = draftId ?? newId("fn");
    updateWorkspace((w) => {
      const entry: FiscalNoteDraft = {
        id,
        createdAt: w.fiscalNotes.find((d) => d.id === id)?.createdAt ?? now,
        updatedAt: now,
        title: input.title || "Untitled bill",
        billNumber: input.billNumber,
        agency: input.agency,
        inputs: { json: JSON.stringify(input) },
      };
      w.fiscalNotes = [entry, ...w.fiscalNotes.filter((d) => d.id !== id)];
    });
    setDraftId(id);
    toast("Fiscal note saved in this browser");
  };

  const markdown = statementMarkdown(input, result);

  return (
    <>
      <PageHeader
        eyebrow="Council tools"
        title="Fiscal notes"
        description="Estimate what a proposed bill will cost: staff, contracts, one-time costs and any new revenue, over five fiscal years with a low-to-high range. The output follows the shape of a Council Finance Fiscal Impact Statement."
        actions={
          <>
            <Button icon={<Save className="size-4" />} variant="primary" onClick={save}>
              {draftId ? "Save changes" : "Save draft"}
            </Button>
            <Button icon={<Copy className="size-4" />} onClick={() => copyText(markdown, "Statement copied as Markdown")}>
              Copy
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-3">Start from:</span>
        {TEMPLATES.map((t) => (
          <Button
            key={t.id}
            size="sm"
            title={t.description}
            aria-label={`Start from the ${t.name} template`}
            onClick={() => {
              setInput(t.build());
              setDraftId(null);
            }}
          >
            {t.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          icon={<FilePlus2 className="size-3.5" />}
          onClick={() => {
            setInput(blankInput());
            setDraftId(null);
          }}
        >
          Blank
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="no-print flex flex-col gap-6">
          <Card>
            <CardHeader title="The bill" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Bill number" htmlFor="fn-num">
                <Input id="fn-num" placeholder="e.g. Int. 0123-2026" value={input.billNumber} onChange={(e) => set({ billNumber: e.target.value })} />
              </Field>
              <Field label="Agency that carries it out" htmlFor="fn-agency">
                <Select id="fn-agency" value={input.agency} onChange={(e) => set({ agency: e.target.value })}>
                  <option value="">Choose an agency</option>
                  {AGENCIES.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title" htmlFor="fn-title" className="sm:col-span-2">
                <Input id="fn-title" value={input.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="What the bill does" htmlFor="fn-summary" className="sm:col-span-2">
                <Textarea id="fn-summary" value={input.summary} onChange={(e) => set({ summary: e.target.value })} />
              </Field>
              <Field label="Sponsor" htmlFor="fn-sponsor">
                <Input id="fn-sponsor" value={input.sponsor} onChange={(e) => set({ sponsor: e.target.value })} />
              </Field>
              <Field label="Takes effect" htmlFor="fn-eff" hint={`${pct(result.rows[0].activeShare)} of ${fy(result.enactmentFy)} remains after this date.`}>
                <Input id="fn-eff" type="date" value={input.effectiveDate} onChange={(e) => set({ effectiveDate: e.target.value })} />
              </Field>
              <Field label="Source of funds" htmlFor="fn-funds">
                <Select id="fn-funds" value={input.fundingSource} onChange={(e) => set({ fundingSource: e.target.value as FiscalInput["fundingSource"] })}>
                  {FUNDING.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prepared by" htmlFor="fn-prep">
                <Input id="fn-prep" placeholder="Name, office" value={input.preparedBy} onChange={(e) => set({ preparedBy: e.target.value })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Staff"
              subtitle="Salaries are typical starting points. Replace them with the agency's title rates."
              actions={
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ staff: [...input.staff, { id: staffId(), title: SALARY_ASSUMPTIONS[0].title, fte: 1, salary: SALARY_ASSUMPTIONS[0].salary }] })}>
                  Add position
                </Button>
              }
            />
            <CardBody className="flex flex-col gap-3">
              {input.staff.length === 0 && <p className="text-[13.5px] text-ink-3">No new positions. Add one if the bill needs staff.</p>}
              {input.staff.map((s, i) => (
                <div key={s.id} className="grid grid-cols-[minmax(0,1.4fr)_70px_minmax(0,1fr)_auto] items-end gap-2">
                  <Field label={i === 0 ? "Title" : ""} htmlFor={`st-${s.id}`}>
                    <Input
                      id={`st-${s.id}`}
                      list="salary-titles"
                      value={s.title}
                      onChange={(e) => {
                        const known = SALARY_ASSUMPTIONS.find((t) => t.title === e.target.value);
                        set({ staff: input.staff.map((x) => (x.id === s.id ? { ...x, title: e.target.value, salary: known ? known.salary : x.salary } : x)) });
                      }}
                    />
                  </Field>
                  <Field label={i === 0 ? "FTEs" : ""} htmlFor={`fte-${s.id}`}>
                    <Input
                      id={`fte-${s.id}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={s.fte}
                      onChange={(e) => set({ staff: input.staff.map((x) => (x.id === s.id ? { ...x, fte: Number(e.target.value) } : x)) })}
                    />
                  </Field>
                  <Field label={i === 0 ? "Salary each" : ""}>
                    <MoneyInput value={s.salary} onChange={(v) => set({ staff: input.staff.map((x) => (x.id === s.id ? { ...x, salary: v } : x)) })} />
                  </Field>
                  <Button variant="ghost" size="sm" aria-label={`Remove ${s.title}`} onClick={() => set({ staff: input.staff.filter((x) => x.id !== s.id) })}>
                    <Trash className="size-4" />
                  </Button>
                </div>
              ))}
              <datalist id="salary-titles">
                {SALARY_ASSUMPTIONS.map((t) => (
                  <option key={t.title} value={t.title} />
                ))}
              </datalist>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <Slider label="Fringe benefits (share of salary)" value={input.fringeRate} min={0.2} max={0.8} step={0.01} format={(v) => pct(v)} onChange={(v) => set({ fringeRate: v })} hint="Pension, health insurance and payroll taxes. Assumption." />
                <Slider label="Positions filled in year one" value={input.firstYearHiring} min={0.1} max={1} step={0.05} format={(v) => pct(v)} onChange={(v) => set({ firstYearHiring: v })} hint="Hiring takes time; full staffing from year two." />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Other costs and revenue" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Contracts and supplies, per year" hint="Other than personal services (OTPS).">
                <MoneyInput value={input.annualOtps} onChange={(v) => set({ annualOtps: v })} />
              </Field>
              <Field label="One-time costs" hint="IT systems, vehicles, equipment, fit-out.">
                <MoneyInput value={input.oneTime} onChange={(v) => set({ oneTime: v })} />
              </Field>
              <Field label="New revenue, per year" hint="Fees or fines billed. Use a minus sign for revenue lost.">
                <MoneyInput value={input.annualRevenue} onChange={(v) => set({ annualRevenue: v })} />
              </Field>
              <Slider label="Share of revenue collected" value={input.collectionRate} min={0.3} max={1} step={0.05} format={(v) => pct(v)} onChange={(v) => set({ collectionRate: v })} />
              <Slider label="Salary growth per year" value={input.salaryGrowth} min={0} max={0.06} step={0.005} format={(v) => pct(v, { digits: 1 })} onChange={(v) => set({ salaryGrowth: v })} />
              <Slider label="Contract cost growth per year" value={input.otpsGrowth} min={0} max={0.06} step={0.005} format={(v) => pct(v, { digits: 1 })} onChange={(v) => set({ otpsGrowth: v })} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Uncertainty" subtitle="How far each estimate could be off, either way. Drives the low and high range." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {(["staff", "otps", "oneTime", "revenue"] as const).map((k) => (
                <Slider
                  key={k}
                  label={{ staff: "Staff costs", otps: "Contracts", oneTime: "One-time costs", revenue: "Revenue" }[k]}
                  value={input.uncertainty[k]}
                  min={0}
                  max={0.75}
                  step={0.05}
                  format={(v) => `±${pct(v)}`}
                  onChange={(v) => set({ uncertainty: { ...input.uncertainty, [k]: v } })}
                />
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Statement input={input} r={result} />
          <Card className="no-print">
            <CardHeader title="Five-year view" subtitle="Net cost each fiscal year, with the low-to-high range (estimate)." />
            <CardBody>
              <TimeSeriesChart
                data={result.rows.map((r) => ({ fy: r.fy, expenditures: r.expenditures, revenue: r.revenue, net: r.net, band: [r.netLow, r.netHigh] }))}
                xKey="fy"
                xFormat={(v) => fy(Number(v))}
                yFormat={(v) => money(v)}
                series={[
                  { key: "expenditures", label: "Expenditures", slot: 0, kind: "bar" },
                  { key: "revenue", label: "Revenue", slot: 2, kind: "bar" },
                  { key: "net", label: "Net cost", slot: 1 },
                ]}
                band={{ key: "band", label: "Net cost range", slot: 1 }}
                height={240}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <Section className="no-print mt-8" title="Saved fiscal notes" description="Stored in this browser. Export your workspace from Settings to back them up.">
        {drafts.length === 0 ? (
          <p className="text-[13.5px] text-ink-3">Nothing saved yet.</p>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Bill</Th>
                  <Th>Agency</Th>
                  <Th>Updated</Th>
                  <Th align="right">5-year net cost</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => {
                  const parsed = draftToInput(d);
                  const net = parsed ? computeFiscal(parsed).fiveYearNet : null;
                  return (
                    <tr key={d.id} className={d.id === draftId ? "bg-brand-soft/50" : undefined}>
                      <Td className="max-w-[360px]">
                        <div className="truncate font-medium text-ink">{d.title}</div>
                        {d.billNumber && <div className="text-[12px] text-ink-3">{d.billNumber}</div>}
                      </Td>
                      <Td>{d.agency || "—"}</Td>
                      <Td>{date(d.updatedAt.slice(0, 10))}</Td>
                      <Td align="right">{money(net)}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={!parsed}
                          onClick={() => {
                            if (parsed) {
                              setInput(parsed);
                              setDraftId(d.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }
                          }}
                        >
                          Open
                        </Button>{" "}
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Delete ${d.title}`}
                          onClick={() => {
                            updateWorkspace((w) => {
                              w.fiscalNotes = w.fiscalNotes.filter((x) => x.id !== d.id);
                            });
                            if (draftId === d.id) setDraftId(null);
                          }}
                        >
                          <Trash className="size-4" />
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </Section>
    </>
  );
}

function Statement({ input, r }: { input: FiscalInput; r: FiscalResult }) {
  const cols = [
    { label: `Effective ${fy(r.statement.effective.fy)}`, row: r.statement.effective },
    { label: `${fy(r.statement.succeeding.fy)} (succeeding)`, row: r.statement.succeeding },
    { label: `Full fiscal impact ${fy(r.statement.full.fy)}`, row: r.statement.full },
  ];
  return (
    <Card>
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold tracking-wide text-brand uppercase">Fiscal impact statement</span>
          <Badge tone="warn">Estimate</Badge>
        </div>
        <h2 className="mt-1 text-[17px] font-semibold text-ink">{input.title || "Untitled bill"}</h2>
        <div className="mt-0.5 text-[13px] text-ink-3">
          {[input.billNumber, input.agency ? agencyName(input.agency) : null, input.sponsor ? `Sponsor: ${input.sponsor}` : null].filter(Boolean).join(" · ") || "Add the bill number, agency and sponsor"}
        </div>
      </div>
      <CardBody>
        {input.summary && <p className="mb-4 text-[14px] text-ink-2">{input.summary}</p>}
        <Table className="rounded-lg border border-line">
          <thead>
            <tr>
              <Th />
              {cols.map((c) => (
                <Th key={c.label} align="right">
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>Revenues</Td>
              {cols.map((c) => (
                <Td key={c.label} align="right">
                  {money(c.row.revenue)}
                </Td>
              ))}
            </tr>
            <tr>
              <Td>Expenditures</Td>
              {cols.map((c) => (
                <Td key={c.label} align="right">
                  {money(c.row.expenditures)}
                </Td>
              ))}
            </tr>
            <tr>
              <Td className="font-semibold text-ink">Net</Td>
              {cols.map((c) => (
                <Td key={c.label} align="right" className="font-semibold text-ink">
                  {money(c.row.net)}
                </Td>
              ))}
            </tr>
            <tr>
              <Td className="text-ink-3">Range</Td>
              {cols.map((c) => (
                <Td key={c.label} align="right" className="text-ink-3">
                  {money(c.row.netLow)}–{money(c.row.netHigh)}
                </Td>
              ))}
            </tr>
          </tbody>
        </Table>
        <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
          <div>
            <dt className="text-ink-3">Five-year net cost</dt>
            <dd className="font-semibold text-ink">
              {money(r.fiveYearNet)} <span className="font-normal text-ink-3">({money(r.fiveYearLow)}–{money(r.fiveYearHigh)})</span>
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Positions</dt>
            <dd className="font-semibold text-ink">{num(r.totalFte, r.totalFte % 1 ? 1 : 0)} full-time</dd>
          </div>
          <div>
            <dt className="text-ink-3">Source of funds</dt>
            <dd className="text-ink">{input.fundingSource}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Effective date</dt>
            <dd className="text-ink">{date(input.effectiveDate)}</dd>
          </div>
        </dl>
        <h3 className="mt-5 text-[13.5px] font-semibold text-ink">Method</h3>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{methodText(input, r)}</p>
        {input.preparedBy && <p className="mt-3 text-[13px] text-ink-3">Prepared by {input.preparedBy}</p>}
        <Callout tone="neutral" className="mt-4 text-[13px]">
          Salaries, fringe rates and growth rates are labeled assumptions. Confirm them with the agency and the Council Finance Division before this estimate is cited.
        </Callout>
      </CardBody>
    </Card>
  );
}

function statementMarkdown(input: FiscalInput, r: FiscalResult): string {
  const row = (label: string, pick: (x: FiscalResult["rows"][number]) => number) =>
    `| ${label} | ${money(pick(r.statement.effective))} | ${money(pick(r.statement.succeeding))} | ${money(pick(r.statement.full))} |`;
  return [
    `# Fiscal impact statement (estimate)`,
    `**${input.title || "Untitled bill"}**${input.billNumber ? ` (${input.billNumber})` : ""}`,
    input.agency ? `Agency: ${agencyName(input.agency)}` : "",
    input.sponsor ? `Sponsor: ${input.sponsor}` : "",
    "",
    input.summary,
    "",
    `| | Effective ${fy(r.statement.effective.fy)} | ${fy(r.statement.succeeding.fy)} | Full impact ${fy(r.statement.full.fy)} |`,
    `|---|---:|---:|---:|`,
    row("Revenues", (x) => x.revenue),
    row("Expenditures", (x) => x.expenditures),
    row("Net", (x) => x.net),
    "",
    `Five-year net cost: ${money(r.fiveYearNet)} (range ${money(r.fiveYearLow)} to ${money(r.fiveYearHigh)}).`,
    `Source of funds: ${input.fundingSource}.`,
    "",
    `**Method.** ${methodText(input, r)}`,
    "",
    "_Prepared with Baseline. Salary, fringe and growth figures are assumptions to confirm with the agency._",
  ]
    .filter((l) => l !== null)
    .join("\n");
}
