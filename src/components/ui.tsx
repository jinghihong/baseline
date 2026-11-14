// Shared UI primitives. Pages compose these; avoid one-off styling in pages when a primitive fits.
import { clsx } from "clsx";
import {
  ExternalLink,
  Info,
  LoaderCircle as Loader2,
  X,
  TriangleExclamationPoint as AlertTriangle,
  CircleCheck as CheckCircle2,
  OctagonExclamationPoint as AlertOctagon,
  CircleExclamationPoint as CircleAlert,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { CITATIONS, type CitationId } from "../data/curated";
import { date as fmtDate } from "../lib/format";

export const cn = clsx;

// ---- Buttons ---------------------------------------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap select-none";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover shadow-card",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 shadow-card",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-bad text-white hover:opacity-90",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  to,
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

// ---- Surfaces --------------------------------------------------------------------------------------
export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & Record<string, unknown>) {
  return (
    <As className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand">{eyebrow}</div>}
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
          {description && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13.5px] text-ink-3">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

// ---- Stats -----------------------------------------------------------------------------------------
export type Tone = "neutral" | "good" | "warn" | "serious" | "bad" | "brand";

const toneText: Record<Tone, string> = {
  neutral: "text-ink-2",
  good: "text-good-ink",
  warn: "text-warn-ink",
  serious: "text-serious-ink",
  bad: "text-bad-ink",
  brand: "text-brand",
};

export function Stat({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
  source,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  source?: CitationId | ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-ink-3">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      </div>
      <div className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-ink">{value}</div>
      {detail && <div className={cn("mt-1 text-[13px]", toneText[tone])}>{detail}</div>}
      {source && <div className="mt-2">{typeof source === "string" && source in CITATIONS ? <Cite id={source as CitationId} /> : source}</div>}
    </Card>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const map = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-2 lg:grid-cols-5" } as const;
  return <div className={cn("grid grid-cols-1 gap-3", map[cols])}>{children}</div>;
}

// ---- Badges & status -------------------------------------------------------------------------------
const badgeTone: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  good: "bg-good-soft text-good-ink border-transparent",
  warn: "bg-warn-soft text-warn-ink border-transparent",
  serious: "bg-serious-soft text-serious-ink border-transparent",
  bad: "bg-bad-soft text-bad-ink border-transparent",
  brand: "bg-brand-soft text-brand border-transparent",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[12px] font-medium leading-4", badgeTone[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export type RiskLevel = "low" | "watch" | "high" | "critical";
const riskMeta: Record<RiskLevel, { tone: Tone; label: string; Icon: typeof CheckCircle2 }> = {
  low: { tone: "good", label: "On track", Icon: CheckCircle2 },
  watch: { tone: "warn", label: "Watch", Icon: CircleAlert },
  high: { tone: "serious", label: "High risk", Icon: AlertTriangle },
  critical: { tone: "bad", label: "Critical", Icon: AlertOctagon },
};

/** Status always ships with an icon and a label, never color alone. */
export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const m = riskMeta[level];
  return (
    <Badge tone={m.tone} icon={<m.Icon className="size-3.5" aria-hidden />}>
      {label ?? m.label}
    </Badge>
  );
}

export function Delta({ value, format, goodWhen = "down", className }: { value: number | null | undefined; format: (v: number) => string; goodWhen?: "up" | "down" | "none"; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="text-ink-3">—</span>;
  const up = value > 0;
  const tone = goodWhen === "none" || value === 0 ? "text-ink-2" : (up && goodWhen === "up") || (!up && goodWhen === "down") ? "text-good-ink" : "text-bad-ink";
  return (
    <span className={cn("tabular font-medium", tone, className)}>
      {value > 0 ? "▲ " : value < 0 ? "▼ " : ""}
      {format(Math.abs(value))}
    </span>
  );
}

// ---- Citations -------------------------------------------------------------------------------------
export function Cite({ id, className }: { id: CitationId; className?: string }) {
  const c = CITATIONS[id];
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      title={`${c.title} (${fmtDate(c.date)})`}
      className={cn("inline-flex max-w-full items-center gap-1 rounded text-[12px] text-ink-3 underline-offset-2 hover:text-brand hover:underline", className)}
    >
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="truncate">
        {c.publisher}, {fmtDate(c.date, { short: true })}
      </span>
    </a>
  );
}

export function SourceNote({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const body = (
    <>
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn("inline-flex items-start gap-1.5 text-[12.5px] text-ink-3 hover:text-brand", className)}>
      {body}
    </a>
  ) : (
    <p className={cn("inline-flex items-start gap-1.5 text-[12.5px] text-ink-3", className)}>{body}</p>
  );
}

export function Callout({ tone = "brand", title, children, icon, className }: { tone?: Tone; title?: ReactNode; children: ReactNode; icon?: ReactNode; className?: string }) {
  const bg: Record<Tone, string> = {
    neutral: "bg-surface-2 border-line",
    brand: "bg-brand-soft border-transparent",
    good: "bg-good-soft border-transparent",
    warn: "bg-warn-soft border-transparent",
    serious: "bg-serious-soft border-transparent",
    bad: "bg-bad-soft border-transparent",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-[14px] text-ink-2", bg[tone], className)}>
      <div className={cn("mt-0.5 shrink-0", toneText[tone])}>{icon ?? <Info className="size-4" aria-hidden />}</div>
      <div className="min-w-0">
        {title && <div className="mb-0.5 font-semibold text-ink">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ---- Form controls ---------------------------------------------------------------------------------
const fieldBase =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink shadow-card placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({ label, hint, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, className)} {...rest} />;
});

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "h-auto min-h-[90px] py-2 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2375736d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

/** Dollar input that accepts "12.5M", "1,200,000" or "3b". */
export function MoneyInput({ value, onChange, id, placeholder, className }: { value: number; onChange: (v: number) => void; id?: string; placeholder?: string; className?: string }) {
  const [text, setText] = useState(() => formatMoneyInput(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(formatMoneyInput(value));
  }, [value]);
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-3">$</span>
      <input
        id={id}
        inputMode="decimal"
        className={cn(fieldBase, "pl-6 tabular")}
        value={text}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(formatMoneyInput(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseMoney(e.target.value);
          if (parsed !== null) onChange(parsed);
        }}
      />
    </div>
  );
}

export function parseMoney(text: string): number | null {
  const m = String(text).trim().replace(/[$,\s]/g, "").match(/^(-?\d*\.?\d+)([kmbt])?$/i);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b" | "t"] ?? 1;
  return Number(m[1]) * mult;
}

function formatMoneyInput(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1e9) return `${+(v / 1e9).toFixed(3)}B`;
  if (Math.abs(v) >= 1e6) return `${+(v / 1e6).toFixed(3)}M`;
  return v.toLocaleString("en-US");
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format = (v: number) => String(v),
  hint,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: ReactNode;
  format?: (v: number) => string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {label}
        </label>
        <span className="tabular text-[13px] font-semibold text-ink">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
      {hint && <p className="mt-1 text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md"; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2 py-1 text-[12.5px]" : "px-3 py-1.5 text-[13px]",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-brand" : "bg-surface-3")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
      {label}
    </label>
  );
}

// ---- Tables ----------------------------------------------------------------------------------------
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  );
}
export function Th({ children, className, align = "left", onClick, sorted }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; onClick?: () => void; sorted?: "asc" | "desc" | null }) {
  return (
    <th
      onClick={onClick}
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
      className={cn(
        "sticky top-0 z-[1] border-b border-line bg-surface-2 px-3 py-2 text-[12px] font-semibold whitespace-nowrap text-ink-3",
        align === "right" && "text-right",
        align === "center" && "text-center",
        onClick && "cursor-pointer select-none hover:text-ink",
        className,
      )}
    >
      {children}
      {sorted && <span className="ml-1">{sorted === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
export function Td({ children, className, align = "left", title }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; title?: string }) {
  return (
    <td title={title} className={cn("border-b border-line px-3 py-2.5 align-middle text-ink-2", align === "right" && "text-right tabular", align === "center" && "text-center", className)}>
      {children}
    </td>
  );
}

/** Simple client-side sort state for tables. */
export function useSort<K extends string>(initial: K, initialDir: "asc" | "desc" = "desc") {
  const [key, setKey] = useState<K>(initial);
  const [dir, setDir] = useState<"asc" | "desc">(initialDir);
  const toggle = (k: K) => {
    if (k === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setKey(k);
      setDir("desc");
    }
  };
  const sortedFor = (k: K) => (k === key ? dir : null);
  return { key, dir, toggle, sortedFor };
}

// ---- Feedback --------------------------------------------------------------------------------------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-3/70", className)} />;
}

export function LoadingBlock({ label = "Loading data…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[220px] flex-col items-center justify-center gap-3 text-[13px] text-ink-3", className)}>
      <Loader2 className="size-5 animate-spin text-brand" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorBlock({ error, className }: { error: Error | string; className?: string }) {
  return (
    <Callout tone="bad" title="Something went wrong" icon={<AlertOctagon className="size-4" />} className={className}>
      {typeof error === "string" ? error : error.message}
    </Callout>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-md text-[13.5px] text-ink-3">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = { neutral: "bg-ink-3", brand: "bg-brand", good: "bg-good", warn: "bg-warn", serious: "bg-serious", bad: "bg-bad" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full", color[tone])} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-ink-3">{children}</kbd>;
}

// ---- Overlays --------------------------------------------------------------------------------------
export function Drawer({ open, onClose, title, subtitle, children, width = "max-w-2xl" }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className={cn("relative flex h-full w-full flex-col overflow-hidden border-l border-line bg-surface shadow-pop", width)}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className={cn("relative w-full rounded-2xl border border-line bg-surface shadow-pop", width)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info className="size-3.5 cursor-help text-ink-3" aria-hidden />
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-2.5 text-[12.5px] leading-snug font-normal text-ink-2 opacity-0 shadow-pop transition-opacity group-hover:opacity-100">
        {children}
      </span>
    </span>
  );
}

// ---- Toasts ----------------------------------------------------------------------------------------
type ToastItem = { id: number; text: string; tone: Tone };
const toastListeners = new Set<(t: ToastItem[]) => void>();
let toasts: ToastItem[] = [];
let toastSeq = 0;

export function toast(text: string, tone: Tone = "good") {
  const item = { id: ++toastSeq, text, tone };
  toasts = [...toasts, item];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    toastListeners.forEach((l) => l(toasts));
  }, 3200);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink shadow-pop">
          {t.tone === "bad" ? <AlertOctagon className="size-4 text-bad" /> : <CheckCircle2 className="size-4 text-good" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---- Utilities -------------------------------------------------------------------------------------
export function downloadFile(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export async function copyText(text: string, message = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast("Copy failed. Select the text and copy it manually.", "bad");
  }
}
