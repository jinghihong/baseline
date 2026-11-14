// Cmd/Ctrl+K: jump to any tool, or send a question straight to Ask Baseline.
import { ArrowRight, MessageSquareText, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { NAV } from "../../app/nav";
import { cn, Kbd } from "../ui";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = Object.values(NAV);
    const matched = q
      ? items.filter((i) => `${i.label} ${i.blurb} ${i.keywords ?? ""}`.toLowerCase().includes(q))
      : items;
    return matched.slice(0, 9);
  }, [query]);

  const showAsk = query.trim().length > 3;
  const total = results.length + (showAsk ? 1 : 0);

  const go = (index: number) => {
    if (index < results.length) navigate(results[index].path);
    else if (showAsk) navigate(`/app/ask?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(total - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter" && total) go(active);
            }}
            placeholder="Jump to a tool or ask a question…"
            className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {results.map((r, i) => (
            <li key={r.path}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", active === i && "bg-surface-2")}
              >
                <r.icon className="size-4 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-ink">{r.label}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">{r.blurb}</span>
                </span>
                {active === i && <ArrowRight className="size-4 text-ink-3" />}
              </button>
            </li>
          ))}
          {showAsk && (
            <li>
              <button
                type="button"
                onMouseEnter={() => setActive(results.length)}
                onClick={() => go(results.length)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", active === results.length && "bg-surface-2")}
              >
                <MessageSquareText className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                  Ask Baseline: <span className="font-medium">“{query.trim()}”</span>
                </span>
              </button>
            </li>
          )}
          {!total && <li className="px-3 py-6 text-center text-[13px] text-ink-3">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
