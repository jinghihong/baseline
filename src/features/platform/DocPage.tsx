// Long-form document page with a sticky table of contents, print and Markdown download.
import { Download, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Button, downloadFile } from "../../components/ui";
import { headingsOf, Markdown } from "./Markdown";

export function DocPage({ source, filename, eyebrow, aside }: { source: string; filename: string; eyebrow: string; aside?: ReactNode }) {
  const toc = headingsOf(source);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="no-print hidden lg:block">
          <div className="sticky top-24">
            <div className="text-[12px] font-semibold tracking-wide text-brand uppercase">{eyebrow}</div>
            <nav aria-label="On this page" className="mt-3 flex flex-col gap-1 border-l border-line">
              {toc.map((h) => (
                <a key={h.id} href={`#${h.id}`} className="-ml-px border-l border-transparent py-1 pl-3 text-[13px] text-ink-3 hover:border-brand hover:text-ink">
                  {h.text}
                </a>
              ))}
            </nav>
            <div className="mt-6 flex flex-col gap-2">
              <Button size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
                Print or save PDF
              </Button>
              <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadFile(filename, source, "text/markdown")}>
                Download Markdown
              </Button>
            </div>
            {aside && <div className="mt-6">{aside}</div>}
          </div>
        </aside>
        <article className="min-w-0 max-w-[720px]">
          <div className="no-print mb-6 flex flex-wrap gap-2 lg:hidden">
            <Button size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              Print
            </Button>
            <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadFile(filename, source, "text/markdown")}>
              Markdown
            </Button>
          </div>
          <Markdown source={source} />
        </article>
      </div>
    </div>
  );
}
