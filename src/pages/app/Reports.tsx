import { ArrowRight, Calculator, ClipboardList, Copy, Download, FileText, Gavel, Printer, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, ButtonLink, Card, cn, copyText, downloadFile, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "../../components/ui";
import { useDatasets } from "../../data/load";
import { budgetRiskBrief, capitalDeliveryBrief, estimatesReport } from "../../features/platform/reports";
import { Markdown } from "../../features/platform/Markdown";
import { useWorkspace } from "../../state/store";

type ReportId = "budget" | "capital" | "estimates";

const REPORTS: { id: ReportId; title: string; body: string; icon: typeof Scale; file: string }[] = [
  { id: "budget", title: "Citywide budget risk brief", body: "Out-year gap, overtime shortfalls and lines adopted too low, with questions to ask.", icon: Scale, file: "baseline-budget-risk-brief.md" },
  { id: "capital", title: "Capital delivery brief", body: "Budget growth and schedule slips across the portfolio, by agency and project.", icon: ClipboardList, file: "baseline-capital-delivery-brief.md" },
  { id: "estimates", title: "Saved cost estimates", body: "Every estimate you saved in the Cost forecaster, with its range.", icon: Calculator, file: "baseline-saved-estimates.md" },
];

export default function Reports() {
  const [active, setActive] = useState<ReportId>("budget");
  const { data, loading, error } = useDatasets(["overtime", "budgetLines", "capital", "reference"]);
  const estimates = useWorkspace((w) => w.estimates);

  const markdown = useMemo(() => {
    if (!data) return "";
    if (active === "budget") return budgetRiskBrief(data.overtime, data.budgetLines);
    if (active === "capital") return capitalDeliveryBrief(data.capital);
    const label = (id: string) => data.reference.meta.classes.find((c) => c.id === id)?.label ?? id;
    return estimatesReport(estimates, label);
  }, [data, active, estimates]);

  const report = REPORTS.find((r) => r.id === active)!;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Reports"
        description="Printable briefs for meetings, hearings and memos. Each one lists its sources and labels Baseline's estimates."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="no-print space-y-2">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActive(r.id)}
              aria-pressed={active === r.id}
              className={cn(
                "flex w-full gap-3 rounded-xl border p-3.5 text-left transition",
                active === r.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <r.icon className={cn("mt-0.5 size-4.5 shrink-0", active === r.id ? "text-brand" : "text-ink-3")} />
              <span>
                <span className="block text-[14px] font-semibold text-ink">{r.title}</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-3">{r.body}</span>
                {r.id === "estimates" && <span className="mt-1 block text-[12px] font-medium text-ink-2">{estimates.length} saved</span>}
              </span>
            </button>
          ))}
          <Link to="/app/hearings" className="flex gap-3 rounded-xl border border-dashed border-line-strong p-3.5 text-left hover:border-brand">
            <Gavel className="mt-0.5 size-4.5 shrink-0 text-ink-3" />
            <span>
              <span className="flex items-center gap-1 text-[14px] font-semibold text-ink">
                Agency hearing briefs <ArrowRight className="size-3.5" />
              </span>
              <span className="mt-0.5 block text-[12.5px] text-ink-3">One agency at a time, with suggested questions. Built in Hearing prep.</span>
            </span>
          </Link>
        </div>

        <Card className="min-w-0">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <FileText className="size-4 text-ink-3" /> {report.title}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()} disabled={!markdown}>
                Print or PDF
              </Button>
              <Button size="sm" icon={<Copy className="size-4" />} onClick={() => void copyText(markdown, "Report copied as Markdown")} disabled={!markdown}>
                Copy
              </Button>
              <Button size="sm" icon={<Download className="size-4" />} onClick={() => downloadFile(report.file, markdown, "text/markdown")} disabled={!markdown}>
                .md
              </Button>
            </div>
          </div>
          <div className="px-5 py-6 sm:px-8">
            {error ? (
              <ErrorBlock error={error} />
            ) : loading ? (
              <LoadingBlock label="Building the report…" />
            ) : active === "estimates" && estimates.length === 0 ? (
              <EmptyState icon={<Calculator className="size-6" />} title="No saved estimates yet" action={<ButtonLink to="/app/forecaster" variant="primary">Open the Cost forecaster</ButtonLink>}>
                Price a project and press Save. Every saved estimate appears in this report with its range.
              </EmptyState>
            ) : (
              <Markdown source={markdown} />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
