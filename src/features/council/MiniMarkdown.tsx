// Renders the small subset of Markdown Claude returns here (numbered/bulleted lists, bold, italics, links)
// without injecting HTML.
import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(
        <a key={key} href={m[2]} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
          {label}
        </a>,
      );
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[][] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={list.ordered ? "list-decimal space-y-3 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((parts, i) => (
          <li key={i}>{parts.map((p, j) => <Fragment key={j}>{p}</Fragment>)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/, "");
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const indented = /^\s{2,}/.test(line);
    if (ordered && !indented) {
      if (!list || !list.ordered) {
        flush();
        list = { ordered: true, items: [] };
      }
      list.items.push([inline(ordered[1], `o${idx}`)]);
    } else if ((bullet || (indented && line.trim())) && list?.ordered) {
      // Sub-lines (e.g. "Evidence:") attach to the current numbered item.
      const content = bullet ? bullet[1] : line.trim();
      list.items[list.items.length - 1].push(
        <span key={`s${idx}`} className="mt-1 block text-[13px] text-ink-3">
          {inline(content, `s${idx}`)}
        </span>,
      );
    } else if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { ordered: false, items: [] };
      }
      list.items.push([inline(bullet[1], `b${idx}`)]);
    } else if (/^#{1,3}\s/.test(line)) {
      flush();
      blocks.push(
        <h4 key={`h${idx}`} className="mt-3 font-semibold text-ink">
          {line.replace(/^#{1,3}\s/, "")}
        </h4>,
      );
    } else if (line.trim()) {
      if (list?.ordered && /^Evidence:/i.test(line.trim())) {
        list.items[list.items.length - 1].push(
          <span key={`e${idx}`} className="mt-1 block text-[13px] text-ink-3">
            {inline(line.trim(), `e${idx}`)}
          </span>,
        );
        return;
      }
      flush();
      blocks.push(
        <p key={`p${idx}`} className="mt-2">
          {inline(line, `p${idx}`)}
        </p>,
      );
    }
  });
  flush();
  return <div className={className}>{blocks}</div>;
}
