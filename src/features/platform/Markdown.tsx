// A small, safe Markdown renderer: builds React elements, never injects HTML.
// Supports headings, paragraphs, bullet and numbered lists, tables, blockquotes, rules,
// **bold**, _italic_, `code`, and [links](url) (internal links starting with "/" use the router).
import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "../../components/ui";

type Block =
  | { type: "heading"; level: number; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "quote"; text: string }
  | { type: "rule" };

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim(), id: slugify(h[2]) });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: parts.join(" ") });
      continue;
    }
    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const re = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i].replace(re, "");
        i++;
        // Indented continuation lines belong to the item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !bullet.test(lines[i]) && !numbered.test(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i++;
        }
        items.push(item);
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

/** Inline formatting. Order matters: links and code first so their contents aren't re-parsed. */
export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|((?:^|(?<=[\s(]))_([^_]+)_(?=$|[\s.,;:!?)]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${k++}`;
    if (m[1]) {
      const href = m[3];
      const label = renderInline(m[2], key);
      if (href.startsWith("/")) {
        out.push(
          <Link key={key} to={href} className="font-medium text-brand underline-offset-2 hover:underline">
            {label}
          </Link>,
        );
      } else if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-2">
            {label}
          </a>,
        );
      } else {
        out.push(<Fragment key={key}>{label}</Fragment>);
      }
    } else if (m[4]) {
      out.push(
        <code key={key} className="rounded bg-surface-2 px-1 py-0.5 text-[0.92em]">
          {m[5]}
        </code>,
      );
    } else if (m[6]) {
      out.push(
        <strong key={key} className="font-semibold text-ink">
          {renderInline(m[7], key)}
        </strong>,
      );
    } else if (m[8]) {
      out.push(
        <em key={key} className="text-ink-3">
          {renderInline(m[9], key)}
        </em>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className, compact = false }: { source: string; className?: string; compact?: boolean }) {
  const blocks = parseBlocks(source);
  const gap = compact ? "mb-2.5 last:mb-0" : "";
  return (
    <div className={cn(compact ? "text-[14px] leading-relaxed text-ink-2" : "prose-baseline", className)}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "heading": {
            const content = renderInline(b.text, key);
            if (compact) return <div key={key} className="mb-1.5 font-semibold text-ink">{content}</div>;
            if (b.level === 1) return <h1 key={key} id={b.id}>{content}</h1>;
            if (b.level === 2) return <h2 key={key} id={b.id}>{content}</h2>;
            return <h3 key={key} id={b.id}>{content}</h3>;
          }
          case "paragraph":
            return <p key={key} className={gap}>{renderInline(b.text, key)}</p>;
          case "list": {
            const items = b.items.map((it, j) => <li key={j}>{renderInline(it, `${key}-${j}`)}</li>);
            const cls = compact ? cn("mb-2.5 space-y-1 pl-5 last:mb-0", b.ordered ? "list-decimal" : "list-disc") : undefined;
            return b.ordered ? <ol key={key} className={cls}>{items}</ol> : <ul key={key} className={cls}>{items}</ul>;
          }
          case "table":
            return (
              <div key={key} className={cn("overflow-x-auto", compact && "mb-2.5 rounded-lg border border-line")}>
                <table className={cn(compact && "w-full text-[13px]")}>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j} className={cn(compact && "border-b border-line bg-surface-2 px-2.5 py-1.5 text-left font-semibold text-ink")}>
                          {renderInline(h, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, ci) => (
                          <td key={ci} className={cn("tabular", compact && "border-b border-line px-2.5 py-1.5 last:border-b-0")}>
                            {renderInline(c, `${key}-${j}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return <blockquote key={key} className={cn(compact && "mb-2.5 border-l-2 border-brand pl-3 text-ink")}>{renderInline(b.text, key)}</blockquote>;
          case "rule":
            return <hr key={key} className="my-6 border-line" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

/** Table of contents from level-2 headings, for long documents. */
export function headingsOf(md: string): { id: string; text: string }[] {
  return parseBlocks(md)
    .filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.level === 2)
    .map((b) => ({ id: b.id, text: b.text.replace(/\*\*/g, "") }));
}
