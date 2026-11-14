// Number and date formatting used across the app. Keep every display rule here so numbers read the same everywhere.

const compactUnits: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** $1.2B, $640M, $12.5K. `digits` controls significant decimals. */
export function money(value: number | null | undefined, opts: { compact?: boolean; digits?: number; sign?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const { compact = true, digits, sign = false } = opts;
  const abs = Math.abs(value);
  const prefix = value < 0 ? "−" : sign && value > 0 ? "+" : "";
  if (compact) {
    for (const [size, unit] of compactUnits) {
      if (abs >= size) {
        const scaled = abs / size;
        const d = digits ?? (scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2);
        return `${prefix}$${trimZeros(scaled.toFixed(d))}${unit}`;
      }
    }
  }
  return `${prefix}$${abs.toLocaleString("en-US", { maximumFractionDigits: digits ?? 0 })}`;
}

/** 0.234 -> "23%"; with sign -> "+23%". */
export function pct(value: number | null | undefined, opts: { digits?: number; sign?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const { digits = 0, sign = false } = opts;
  const v = value * 100;
  const prefix = v < 0 ? "−" : sign && v > 0 ? "+" : "";
  return `${prefix}${Math.abs(v).toFixed(digits)}%`;
}

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function compactNum(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  for (const [size, unit] of compactUnits) {
    if (abs >= size) return `${value < 0 ? "−" : ""}${trimZeros((abs / size).toFixed(abs / size >= 10 ? 0 : 1))}${unit}`;
  }
  return num(value);
}

/** Days -> "3.5 yrs", "8 mo", "21 days". */
export function duration(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  const sign = days < 0 ? "−" : "";
  const d = Math.abs(days);
  if (d >= 365) return `${sign}${trimZeros((d / 365).toFixed(1))} yrs`;
  if (d >= 60) return `${sign}${Math.round(d / 30.4)} mo`;
  return `${sign}${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-18" -> "May 18, 2026"; "2026-05" -> "May 2026"; "202605" -> "May 2026". */
export function date(value: string | null | undefined, opts: { short?: boolean } = {}): string {
  if (!value) return "—";
  const s = String(value);
  const ym = s.match(/^(\d{4})-?(\d{2})$/);
  if (ym) return `${MONTHS[Number(ym[2]) - 1]} ${ym[1]}`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!ymd) return s;
  const m = MONTHS[Number(ymd[2]) - 1];
  return opts.short ? `${m} ${ymd[1]}` : `${m} ${Number(ymd[3])}, ${ymd[1]}`;
}

export const fy = (year: number) => `FY${String(year).slice(-2)}`;

/** City fiscal year for a date: July 1 starts the next fiscal year. */
export function fiscalYearOf(d: Date = new Date()): number {
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${num(n)} ${n === 1 ? word : pluralWord}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 60) return `${days} days ago`;
  return date(iso.slice(0, 10));
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
