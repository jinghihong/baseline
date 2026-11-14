import { Copy, Download, Gavel, Printer, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  copyText,
  downloadFile,
  ErrorBlock,
  Field,
  LoadingBlock,
  PageHeader,
  RiskBadge,
  Section,
  Select,
  Table,
  Td,
  Th,
} from "../../components/ui";
import { useDatasets } from "../../data/load";
import { agencyName } from "../../data/agencies";
import { buildAgencyFacts } from "../../engines/core";
import { assessAllDemand, demandForAgency } from "../../engines/demand";
import {
  briefToFacts,
  briefToMarkdown,
  buildHearingBrief,
  CLAUDE_SYSTEM,
  sourceLabel,
  sourceUrl,
  type HearingQuestion,
  type QuestionSource,
} from "../../engines/hearingPrep";
import { duration, money, pct } from "../../lib/format";
import { hasClaude, streamClaude, AiError } from "../../lib/ai/claude";
import { useWorkspace } from "../../state/store";
import { MiniMarkdown } from "../../features/council/MiniMarkdown";

export default function Hearings() {
  const { data, error, loading } = useDatasets(["overtime", "capital", "budgetLines", "demand"]);
  const [params, setParams] = useSearchParams();
  const hasKey = useWorkspace((w) => !!w.ai.apiKey);

  const facts = useMemo(() => (data ? buildAgencyFacts({ overtime: data.overtime, capital: data.capital, budgetLines: data.budgetLines }) : null), [data]);
  const demandAll = useMemo(() => (data ? assessAllDemand(data.demand) : []), [data]);

  const agencies = useMemo(() => {
    if (!facts) return [];
    return [...facts.values()]
      .filter((f) => f.overtime || (f.capital && f.capital.projects > 0) || f.chronicLines.length)
      .map((f) => ({ code: f.code, name: agencyName(f.code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [facts]);

  const selected = params.get("agency") ?? (agencies.find((a) => a.code === "NYPD") ? "NYPD" : agencies[0]?.code ?? "");

  const brief = useMemo(() => {
    if (!facts || !selected || !facts.get(selected)) return null;
    return buildHearingBrief(selected, agencyName(selected), facts.get(selected)!, demandForAgency(demandAll, selected));
  }, [facts, selected, demandAll]);

  if (loading) return <LoadingBlock label="Loading budget, payroll, capital and 311 data…" />;
  if (error) return <ErrorBlock error={error} />;
  if (!brief) return <ErrorBlock error="No agencies with data were found." />;

  const markdown = briefToMarkdown(brief);

  return (
    <>
      <PageHeader
        eyebrow="Council tools"
        title="Hearing prep"
        description="Pick an agency to get its key numbers and a ranked list of questions. Each question shows the number behind it and where that number comes from."
        actions={
          <>
            <Button icon={<Copy className="size-4" />} onClick={() => copyText(markdown, "Brief copied as Markdown")}>
              Copy
            </Button>
            <Button icon={<Download className="size-4" />} onClick={() => downloadFile(`hearing-brief-${brief.agency.toLowerCase()}.md`, markdown, "text/markdown")}>
              Download .md
            </Button>
            <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <Card className="no-print mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Agency" htmlFor="hearing-agency" className="w-full sm:w-80">
            <Select id="hearing-agency" value={selected} onChange={(e) => setParams({ agency: e.target.value })}>
              {agencies.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {["NYPD", "FDNY", "DOC", "DSNY", "DOT", "DEP", "DPR"]
              .filter((c) => agencies.some((a) => a.code === c))
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setParams({ agency: c })}
                  className={`rounded-md border px-2 py-1 text-[12.5px] font-medium ${c === selected ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:bg-surface-2"}`}
                >
                  {c}
                </button>
              ))}
          </div>
        </div>
      </Card>

      <div className="print-only mb-4">
        <h1 className="text-2xl font-semibold">Hearing brief: {brief.agencyName}</h1>
        <p className="text-sm">Prepared with Baseline. Items marked "estimate" are Baseline forecasts, not published figures.</p>
      </div>

      <Section title={brief.agencyName} description="Headline numbers for the hearing.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brief.headlines.map((h) => (
            <Card key={h.label} className="p-4">
              <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-3">
                <span>{h.label}</span>
                {h.estimate && <Badge tone="brand">Estimate</Badge>}
              </div>
              <div className="mt-1.5 text-[24px] font-semibold tracking-tight text-ink">{h.value}</div>
              <div className={`mt-1 text-[13px] ${h.tone === "bad" ? "text-bad-ink" : h.tone === "warn" ? "text-warn-ink" : h.tone === "good" ? "text-good-ink" : "text-ink-2"}`}>{h.detail}</div>
              <SourceLink source={h.source} className="mt-2" />
            </Card>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Section title={`${brief.questions.length} questions to ask`} description="Ranked by how large and how well documented the gap is.">
          <ol className="flex flex-col gap-3">
            {brief.questions.map((q, i) => (
              <QuestionCard key={q.id} q={q} index={i + 1} />
            ))}
          </ol>
        </Section>

        <div className="flex flex-col gap-6">
          <ClaudePanel key={brief.agency} facts={briefToFacts(brief)} agency={brief.agencyName} hasKey={hasKey} />

          {brief.comptrollerRisks.length > 0 && (
            <Card>
              <CardHeader title="Comptroller's FY27 risks" subtitle="Items the Comptroller says are underbudgeted that fall on this agency. $ millions." />
              <CardBody className="pt-3">
                <Table>
                  <thead>
                    <tr>
                      <Th>Item</Th>
                      <Th align="right">FY27</Th>
                      <Th align="right">FY28</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {brief.comptrollerRisks.map((r) => (
                      <tr key={r.label}>
                        <Td>{r.label}</Td>
                        <Td align="right">{r.fy27 < 0 ? money(r.fy27 * 1e6) : "—"}</Td>
                        <Td align="right">{r.fy28 < 0 ? money(r.fy28 * 1e6) : "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <SourceLink source={{ kind: "citation", id: "fy27Adopted" }} className="mt-3" />
              </CardBody>
            </Card>
          )}

          {brief.facts.worstProjects.filter((p) => p.growth > 0).length > 0 && (
            <Card>
              <CardHeader title="Projects that grew most" subtitle="Budget now vs first reported." />
              <ul className="divide-y divide-line">
                {brief.facts.worstProjects
                  .filter((p) => p.growth > 0)
                  .slice(0, 5)
                  .map((p) => (
                    <li key={p.project.id} className="px-5 py-3">
                      <Link to={`/app/watchlist/${encodeURIComponent(p.project.id)}`} className="text-[13.5px] font-medium text-ink hover:text-brand hover:underline">
                        {p.project.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
                        <span>
                          {money(p.project.firstBudget)} → {money(p.project.budget)} ({pct(p.growthPct, { sign: true })})
                        </span>
                        {p.slipDays > 0 && <span>· {duration(p.slipDays)} later</span>}
                        <RiskBadge level={p.level} />
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function SourceLink({ source, className }: { source: QuestionSource; className?: string }) {
  return (
    <a href={sourceUrl(source)} target="_blank" rel="noreferrer" className={`inline-flex max-w-full items-center gap-1 text-[12px] text-ink-3 hover:text-brand hover:underline ${className ?? ""}`}>
      <span className="truncate">Source: {sourceLabel(source)}</span>
    </a>
  );
}

function QuestionCard({ q, index }: { q: HearingQuestion; index: number }) {
  return (
    <li>
      <Card className="p-4">
        <div className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand">{index}</span>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge>{q.topic}</Badge>
              {q.estimate && <Badge tone="brand">Uses a Baseline estimate</Badge>}
            </div>
            <p className="text-[14.5px] leading-relaxed text-ink">{q.text}</p>
            <p className="mt-2 text-[13px] text-ink-2">
              <span className="font-medium text-ink-3">Evidence: </span>
              {q.evidence}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {q.sources.map((s) => (
                <SourceLink key={sourceUrl(s)} source={s} />
              ))}
              <button type="button" onClick={() => copyText(`${q.text}\n(Evidence: ${q.evidence})`, "Question copied")} className="no-print ml-auto text-[12px] text-ink-3 hover:text-brand">
                Copy
              </button>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}

function ClaudePanel({ facts, agency, hasKey }: { facts: string; agency: string; hasKey: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    if (!hasClaude()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setErr(null);
    setBusy(true);
    try {
      await streamClaude({
        system: CLAUDE_SYSTEM,
        messages: [{ role: "user", content: `Facts for the ${agency} hearing:\n\n${facts}\n\nWrite the improved questions now.` }],
        onText: (_d, full) => setText(full),
        signal: ctrl.signal,
        maxTokens: 4000,
      });
    } catch (e) {
      if (!(e instanceof AiError && e.message === "Stopped.")) setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="no-print">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-4 text-brand" /> Sharpen with Claude
          </span>
        }
        subtitle="Claude rewrites the questions using only the facts on this page."
      />
      <CardBody className="pt-4">
        {!hasKey ? (
          <Callout tone="neutral" title="Optional">
            The questions on this page are built from the data and work without AI. To have Claude tighten the wording, add your Anthropic API key in{" "}
            <Link to="/app/settings" className="font-medium text-brand underline">
              Settings
            </Link>
            .
          </Callout>
        ) : (
          <>
            <div className="flex gap-2">
              {busy ? (
                <Button icon={<Square className="size-3.5" />} onClick={() => abort.current?.abort()}>
                  Stop
                </Button>
              ) : (
                <Button variant="primary" icon={<Gavel className="size-4" />} onClick={run}>
                  {text ? "Rewrite again" : "Rewrite questions"}
                </Button>
              )}
              {text && !busy && (
                <Button icon={<Copy className="size-4" />} onClick={() => copyText(text, "Claude's questions copied")}>
                  Copy
                </Button>
              )}
            </div>
            {err && <ErrorBlock error={err} className="mt-3" />}
            {(text || busy) && (
              <div className="mt-4 max-h-[520px] overflow-y-auto rounded-lg border border-line bg-surface-2 p-3 text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
                {text ? <MiniMarkdown text={text} /> : <span className="text-ink-3">Thinking…</span>}
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-3">Check every number against the evidence lines before using Claude's version.</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

