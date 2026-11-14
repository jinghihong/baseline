// Chart building blocks on top of Recharts, following the dataviz method:
// fixed categorical order, one y-axis, thin marks, recessive grid, legend for 2+ series, hover tooltips, table view.
import { useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table as TableIcon, ChartLine as LineIcon } from "lucide-react";
import { cn, Table, Th, Td } from "./ui";

export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)", "var(--s7)", "var(--s8)"] as const;
export const seriesColor = (slot: number) => SERIES[slot % SERIES.length];

export interface SeriesSpec {
  key: string;
  label: string;
  /** Categorical slot, 0-based. Assign by entity, never by rank. */
  slot: number;
  kind?: "line" | "bar" | "area";
  dashed?: boolean;
  /** Stack id for stacked bars/areas. */
  stack?: string;
}

export interface BandSpec {
  /** Data key holding [low, high]. */
  key: string;
  label: string;
  slot: number;
}

type Row = Record<string, unknown>;

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: unknown;
  color?: string;
  payload?: Row;
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  band,
  yFormat,
  xFormat,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: unknown;
  series: SeriesSpec[];
  band?: BandSpec;
  yFormat: (v: number) => string;
  xFormat: (v: unknown) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  const bandVal = band ? (row[band.key] as [number, number] | undefined) : undefined;
  return (
    <div className="min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2.5 text-[12.5px] shadow-pop">
      <div className="mb-1.5 font-semibold text-ink">{xFormat(label)}</div>
      <div className="flex flex-col gap-1">
        {series.map((s) => {
          const v = row[s.key];
          if (v === null || v === undefined || Number.isNaN(v)) return null;
          return (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-2">
                <span className="inline-block size-2.5 rounded-sm" style={{ background: seriesColor(s.slot) }} />
                {s.label}
              </span>
              <span className="tabular font-medium text-ink">{yFormat(Number(v))}</span>
            </div>
          );
        })}
        {band && Array.isArray(bandVal) && (
          <div className="flex items-center justify-between gap-4 border-t border-line pt-1">
            <span className="text-ink-3">{band.label}</span>
            <span className="tabular text-ink-2">
              {yFormat(bandVal[0])} – {yFormat(bandVal[1])}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; slot: number; dashed?: boolean; band?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.band ? (
            <span className="inline-block h-2.5 w-4 rounded-sm opacity-30" style={{ background: seriesColor(i.slot) }} />
          ) : i.dashed ? (
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: seriesColor(i.slot) }} />
          ) : (
            <span className="inline-block size-2.5 rounded-sm" style={{ background: seriesColor(i.slot) }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export interface TimeSeriesProps {
  data: Row[];
  xKey: string;
  series: SeriesSpec[];
  band?: BandSpec;
  yFormat: (v: number) => string;
  xFormat?: (v: unknown) => string;
  height?: number;
  /** Shade the forecast region starting at this x value. */
  forecastFrom?: string | number;
  referenceLines?: { y: number; label: string }[];
  yDomain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"];
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  showTableToggle?: boolean;
}

/** Line / bar / area over time with an optional prediction band, forecast shading and a table view. */
export function TimeSeriesChart({
  data,
  xKey,
  series,
  band,
  yFormat,
  xFormat = (v) => String(v),
  height = 280,
  forecastFrom,
  referenceLines,
  yDomain,
  title,
  subtitle,
  footer,
  showTableToggle = true,
}: TimeSeriesProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const legendItems = [
    ...series.map((s) => ({ label: s.label, slot: s.slot, dashed: s.dashed })),
    ...(band ? [{ label: band.label, slot: band.slot, band: true }] : []),
  ];
  const lastX = data.length ? data[data.length - 1][xKey] : undefined;
  return (
    <div>
      {(title || showTableToggle) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <div className="text-[14px] font-semibold text-ink">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</div>}
          </div>
          {showTableToggle && (
            <button
              type="button"
              onClick={() => setView(view === "chart" ? "table" : "chart")}
              className="no-print inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {view === "chart" ? <TableIcon className="size-3.5" /> : <LineIcon className="size-3.5" />}
              {view === "chart" ? "Table" : "Chart"}
            </button>
          )}
        </div>
      )}
      {legendItems.length > 1 && view === "chart" && <Legend items={legendItems} className="mb-2" />}
      {view === "chart" ? (
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />
              {forecastFrom !== undefined && lastX !== undefined && (
                <ReferenceArea x1={forecastFrom as string} x2={lastX as string} fill="var(--surface-3)" fillOpacity={0.5} ifOverflow="extendDomain" />
              )}
              <XAxis
                dataKey={xKey}
                tickFormatter={(v) => xFormat(v)}
                tick={{ fill: "var(--axis-ink)", fontSize: 11.5 }}
                axisLine={{ stroke: "var(--axis)" }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v) => yFormat(Number(v))}
                tick={{ fill: "var(--axis-ink)", fontSize: 11.5 }}
                axisLine={false}
                tickLine={false}
                width={64}
                domain={yDomain ?? [0, "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--axis)", strokeWidth: 1, fill: "var(--surface-2)", fillOpacity: 0.5 }}
                content={(p: unknown) => {
                  const props = p as { active?: boolean; payload?: TooltipEntry[]; label?: unknown };
                  return <ChartTooltip {...props} series={series} band={band} yFormat={yFormat} xFormat={xFormat} />;
                }}
              />
              {band && <Area dataKey={band.key} stroke="none" fill={seriesColor(band.slot)} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />}
              {series.map((s) => {
                const color = seriesColor(s.slot);
                if (s.kind === "bar")
                  return <Bar key={s.key} dataKey={s.key} name={s.label} fill={color} stackId={s.stack} radius={s.stack ? 0 : [4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />;
                if (s.kind === "area")
                  return <Area key={s.key} dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} stackId={s.stack} isAnimationActive={false} />;
                return (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    dot={data.length <= 16 ? { r: 3, strokeWidth: 2, stroke: "var(--chart-surface)", fill: color } : false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface)" }}
                    connectNulls
                    isAnimationActive={false}
                  />
                );
              })}
              {referenceLines?.map((r) => (
                <ReferenceLine
                  key={r.label}
                  y={r.y}
                  stroke="var(--ink-3)"
                  strokeDasharray="3 3"
                  label={{ value: r.label, position: "insideTopRight", fill: "var(--ink-3)", fontSize: 11 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
          <Table>
            <thead>
              <tr>
                <Th>{xKey === "fy" ? "Fiscal year" : "Period"}</Th>
                {series.map((s) => (
                  <Th key={s.key} align="right">
                    {s.label}
                  </Th>
                ))}
                {band && <Th align="right">{band.label}</Th>}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <Td>{xFormat(row[xKey])}</Td>
                  {series.map((s) => (
                    <Td key={s.key} align="right">
                      {row[s.key] === null || row[s.key] === undefined ? "—" : yFormat(Number(row[s.key]))}
                    </Td>
                  ))}
                  {band && (
                    <Td align="right">
                      {Array.isArray(row[band.key]) ? `${yFormat((row[band.key] as number[])[0])} – ${yFormat((row[band.key] as number[])[1])}` : "—"}
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

/** Horizontal ranked bars with direct value labels. One measure, one color unless `tone` marks status. */
export function RankedBars({
  rows,
  format,
  slot = 0,
  max,
  onSelect,
  selected,
}: {
  rows: { id: string; label: ReactNode; value: number; sublabel?: ReactNode; highlight?: boolean }[];
  format: (v: number) => string;
  slot?: number;
  max?: number;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const w = Math.max(0.5, (Math.abs(r.value) / top) * 100);
        const Comp = onSelect ? "button" : "div";
        return (
          <Comp
            key={r.id}
            type={onSelect ? "button" : undefined}
            onClick={onSelect ? () => onSelect(r.id) : undefined}
            className={cn(
              "group grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px]",
              onSelect && "hover:bg-surface-2",
              selected === r.id && "bg-surface-2",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{r.label}</span>
              {r.sublabel && <span className="block truncate text-[12px] text-ink-3">{r.sublabel}</span>}
            </span>
            <span className="h-2.5 w-full rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: `${w}%`, background: seriesColor(slot), opacity: r.highlight === false ? 0.45 : 1 }} />
            </span>
            <span className="tabular w-16 text-right font-medium text-ink">{format(r.value)}</span>
          </Comp>
        );
      })}
    </div>
  );
}

/** Distribution of outcomes with percentile markers (used by the cost forecaster). */
export function DistributionChart({
  bins,
  markers,
  xFormat,
  height = 220,
  slot = 0,
  yLabel = "Projects",
}: {
  bins: { x0: number; x1: number; weight: number; count: number }[];
  markers: { x: number; label: string }[];
  xFormat: (v: number) => string;
  height?: number;
  slot?: number;
  yLabel?: string;
}) {
  const data = bins.map((b) => ({ mid: (b.x0 + b.x1) / 2, range: `${xFormat(b.x0)} – ${xFormat(b.x1)}`, weight: b.weight, count: b.count }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 4 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="mid" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => xFormat(Number(v))} tick={{ fill: "var(--axis-ink)", fontSize: 11.5 }} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
          <YAxis tick={{ fill: "var(--axis-ink)", fontSize: 11.5 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
            content={(p: unknown) => {
              const props = p as { active?: boolean; payload?: TooltipEntry[] };
              if (!props.active || !props.payload?.length) return null;
              const row = props.payload[0].payload as { range: string; count: number };
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop">
                  <div className="font-semibold text-ink">{row.range}</div>
                  <div className="text-ink-2">
                    {row.count} {yLabel.toLowerCase()}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" isAnimationActive={false} radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(slot)} fillOpacity={0.85} />
            ))}
          </Bar>
          {markers.map((m) => (
            <ReferenceLine key={m.label} x={m.x} stroke="var(--ink)" strokeDasharray="3 3" label={{ value: m.label, position: "top", fill: "var(--ink-2)", fontSize: 11 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline trend line for tables and tiles. Purely decorative: the adjacent number carries the value. */
export function Sparkline({ values, slot = 0, width = 88, height = 24 }: { values: (number | null)[]; slot?: number; width?: number; height?: number }) {
  const pts = values.map((v, i) => [i, v] as const).filter(([, v]) => v !== null && Number.isFinite(v)) as [number, number][];
  if (pts.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => ((x - x0) / (x1 - x0 || 1)) * (width - 4) + 2;
  const sy = (y: number) => height - 2 - ((y - y0) / (y1 - y0 || 1)) * (height - 4);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden className="inline-block overflow-visible align-middle">
      <path d={d} fill="none" stroke={seriesColor(slot)} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(last[0])} cy={sy(last[1])} r={2.5} fill={seriesColor(slot)} />
    </svg>
  );
}
