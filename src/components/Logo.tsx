import { cn } from "./ui";

/** Baseline mark: three bars standing on a line that never moves. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <rect x="8" y="14" width="4" height="9" rx="1.5" fill="#fff" opacity="0.75" />
      <rect x="14" y="9" width="4" height="14" rx="1.5" fill="#fff" />
      <rect x="20" y="12" width="4" height="11" rx="1.5" fill="#fff" opacity="0.75" />
      <rect x="6" y="24" width="20" height="2" rx="1" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">Baseline</span>
    </span>
  );
}
