// "How accurate is this?" The forecaster's out-of-sample track record, computed live from the backtest snapshot.
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardBody, CardHeader, LoadingBlock, SourceNote, cn } from "../../components/ui";
import { useDataset } from "../../data/load";
import { runBacktest, type BacktestResult } from "../../engines/backtest";
import { date, num, pct } from "../../lib/format";

export function BacktestCard({ classLabel }: { classLabel: (id: string) => string }) {
  const { data, error } = useDataset("backtest");
  const [result, setResult] = useState<BacktestResult | null>(null);

  useEffect(() => {
    if (!data) return;
    // A few hundred forecasts: run after the page has painted so the form stays responsive.
    const t = window.setTimeout(() => setResult(runBacktest(data)), 30);
    return () => window.clearTimeout(t);
  }, [data]);

  if (error) return null;
  return (
    <Card className="no-print mb-8">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FlaskConical className="size-4 text-brand" />
            How accurate is this forecaster?
          </span>
        }
        subtitle="Tested on finished NYC projects it had never seen, using only what the city's data showed at the start."
      />
      <CardBody>
        {!result ? (
          <LoadingBlock className="min-h-[160px]" label="Running the backtest…" />
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-ink-2">
              Baseline learned only from the city's {date(result.trainingPub)} snapshot ({num(result.trainingSize)} projects), then priced{" "}
              <strong className="text-ink">{num(result.n)} projects created later and since finished</strong> from their original budgets. Their actual final cost stayed within the original budget{" "}
              <strong className="text-ink">{pct(result.originalHeld)}</strong> of the time and within Baseline's recommended P80 budget <strong className="text-ink">{pct(result.p80Held)}</strong> of the time.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {result.coverage.map((c) => {
                const gap = c.actual - c.target;
                return (
                  <div key={c.label} className="rounded-lg border border-line bg-surface-2 p-3">
                    <div className="text-[12.5px] text-ink-3">Finished at or below {c.label}</div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-[22px] font-semibold text-ink">{pct(c.actual)}</span>
                      <span className="text-[12.5px] text-ink-3">target {pct(c.target)}</span>
                    </div>
                    <div className="relative mt-2 h-2 rounded-full bg-surface-3" aria-hidden>
                      <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--s1)]" style={{ width: `${c.actual * 100}%` }} />
                      <span className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `${c.target * 100}%` }} />
                    </div>
                    <div className={cn("mt-1.5 text-[12px]", Math.abs(gap) <= 0.05 ? "text-good-ink" : "text-warn-ink")}>
                      {Math.abs(gap) <= 0.05 ? "Well calibrated" : gap > 0 ? "A little cautious" : "Too optimistic"}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[13.5px] text-ink-2">
              The trade-off: in the typical case the P80 budget sits {pct(result.medianContingency)} above the original estimate. That is what the city's own record implies; a narrower range would simply be wrong
              more often.
            </p>
            {result.byClass.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="text-[12px] text-ink-3">
                      <th className="py-1.5 pr-3 font-semibold">Project type</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Finished projects</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Original budget held</th>
                      <th className="py-1.5 text-right font-semibold">P80 budget held</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byClass.slice(0, 6).map((r) => (
                      <tr key={r.cls} className="border-t border-line">
                        <td className="py-1.5 pr-3 text-ink">{classLabel(r.cls)}</td>
                        <td className="py-1.5 pr-3 text-right tabular text-ink-2">{num(r.n)}</td>
                        <td className="py-1.5 pr-3 text-right tabular text-ink-2">{pct(r.originalHeld)}</td>
                        <td className="py-1.5 text-right tabular font-medium text-ink">{pct(r.p80Held)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <SourceNote className="mt-3">
              Capital Project Detail Data, {result.trainingPub} to latest publication. "Finished" = at least 80% of the planned total spent at the project's last appearance.{" "}
              <Link to="/methodology" className="text-brand hover:underline">
                Method
              </Link>
            </SourceNote>
          </>
        )}
      </CardBody>
    </Card>
  );
}
