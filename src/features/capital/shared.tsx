// Helpers shared by the capital pages (forecaster, watchlist, project detail, maintenance, debt).
import type { ReactNode } from "react";
import type { AssetClassInfo } from "../../data/types";
import { agencyName } from "../../data/agencies";
import type { Confidence, ForecastResult } from "../../engines/costForecast";
import { CONFIDENCE_COPY } from "../../engines/costForecast";
import { money, pct } from "../../lib/format";
import { Badge, Card, InfoTip, cn } from "../../components/ui";
import { updateWorkspace } from "../../state/store";

export const BOROUGHS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"] as const;

/** Asset-class labels (mirrors ASSET_CLASSES in scripts/tasks/capital.mjs) so pages don't need the reference file for names. */
export const CLASS_LABELS: Record<string, string> = {
  parks: "Parks & playgrounds",
  streets: "Streets & sidewalks",
  bridges: "Bridges",
  water: "Water mains & supply",
  sewers: "Sewers & stormwater",
  plants: "Treatment plants & utilities",
  housing: "Public & affordable housing",
  schools: "Schools & universities",
  safety: "Police, fire & EMS facilities",
  justice: "Courts & jails",
  social: "Shelters, health & social services",
  culture: "Libraries & cultural",
  facilities: "City buildings & office space",
  waterfront: "Ferries, ports & waterfront",
  lighting: "Lighting & traffic systems",
  tech: "Technology & equipment",
  land: "Land, development & other",
};

export const classLabel = (id: string | null | undefined) => (id ? CLASS_LABELS[id] ?? id : "Other");

/** Phases that mean the project is no longer active. */
export const INACTIVE_PHASES = new Set(["Completed", "Close-out", "Closeout", "Cancelled", "Withdrawn", "Inactive", "Transferred"]);

export function classLabelMap(classes: AssetClassInfo[] | undefined): Map<string, string> {
  return new Map((classes ?? []).map((c) => [c.id, c.label]));
}

/** Ratio of final to original cost, shown as a change: 1.34 -> "+34%". */
export const ratioChange = (r: number) => pct(r - 1, { sign: true });

export function agencyOptions(codes: string[]): { value: string; label: string }[] {
  return [...new Set(codes)]
    .filter(Boolean)
    .map((c) => ({ value: c, label: agencyName(c) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function ConfidenceBadge({ confidence, nEff }: { confidence: Confidence; nEff: number }) {
  const tone = confidence === "high" ? "good" : confidence === "medium" ? "warn" : "serious";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{confidence[0].toUpperCase() + confidence.slice(1)} confidence</Badge>
      <InfoTip>
        {CONFIDENCE_COPY[confidence]} Effective sample: about {Math.round(nEff)} similar projects after weighting by size, agency and borough.
      </InfoTip>
    </span>
  );
}

/** The three headline numbers of a forecast. */
export function ForecastBands({ result, compact = false }: { result: ForecastResult; compact?: boolean }) {
  const items: { key: string; label: string; value: number; ratio: number; note: string; highlight?: boolean }[] = [
    { key: "p50", label: "Likely cost (P50)", value: result.dollars.p50, ratio: result.ratios.p50, note: "Half of similar projects ended at or below this." },
    { key: "p80", label: "Budget at P80", value: result.dollars.p80, ratio: result.ratios.p80, note: "8 in 10 similar projects ended at or below this.", highlight: true },
    { key: "p90", label: "Plan for the worst (P90)", value: result.dollars.p90, ratio: result.ratios.p90, note: "Only 1 in 10 similar projects went higher." },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <Card key={i.key} className={cn("p-4", i.highlight && "border-brand ring-1 ring-brand/30")}>
          <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-3">
            {i.label}
            {i.highlight && <Badge tone="brand">Recommended</Badge>}
          </div>
          <div className={cn("mt-1.5 font-semibold tracking-tight text-ink", compact ? "text-[22px]" : "text-[26px]")}>{money(i.value)}</div>
          <div className="mt-1 text-[13px] text-ink-2">
            <span className="tabular font-medium text-ink">{ratioChange(i.ratio)}</span> vs. the estimate
          </div>
          {!compact && <p className="mt-1.5 text-[12.5px] text-ink-3">{i.note}</p>}
        </Card>
      ))}
    </div>
  );
}

export function MiniStat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-[17px] font-semibold text-ink">{value}</div>
      {sub && <div className="text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

export const moneyRange = (lo: number, hi: number) => `${money(lo)} – ${money(hi)}`;

/** Pin or unpin a capital project on the watchlist (stored in the workspace). */
export function togglePin(id: string) {
  updateWorkspace((w) => {
    w.pinnedProjects = w.pinnedProjects.includes(id) ? w.pinnedProjects.filter((p) => p !== id) : [id, ...w.pinnedProjects];
  });
}
