// Import a city's own past capital projects. They join the cost forecaster's reference class.
import Papa from "papaparse";
import { CircleCheck, Download, FileUp, Trash, TriangleExclamationPoint } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Callout, downloadFile, EmptyState, Modal, parseMoney, Table, Td, Textarea, Th, toast } from "../../components/ui";
import { AGENCIES } from "../../data/agencies";
import type { AssetClassInfo } from "../../data/types";
import { date, money, num } from "../../lib/format";
import { newId, updateWorkspace, useWorkspace, type ImportedProject } from "../../state/store";

const COLUMNS = ["name", "asset_class", "agency", "borough", "original_budget", "current_budget", "original_end", "current_end"] as const;
const BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island", "Citywide"];

const TEMPLATE = `${COLUMNS.join(",")}
Example: Main St bridge rehab,bridges,DOT,Queens,12500000,16800000,2022-06-30,2024-03-31
Example: Elm Park playground,parks,DPR,Bronx,2.4M,2.9M,2023-09-01,2024-05-15
`;

export interface ParsedRow {
  line: number;
  project: ImportedProject | null;
  errors: string[];
  raw: Record<string, string>;
}

function normDate(v: string | undefined): string | null | "invalid" {
  const s = (v ?? "").trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString().slice(0, 10);
}

function matchAgency(v: string): string {
  const s = v.trim();
  if (!s) return "OTHER";
  const up = s.toUpperCase();
  const byCode = AGENCIES.find((a) => a.code === up);
  if (byCode) return byCode.code;
  const byName = AGENCIES.find((a) => a.name.toUpperCase() === up || a.name.toUpperCase().includes(up));
  return byName?.code ?? up.slice(0, 24);
}

export function parseProjectsCsv(text: string, classes: AssetClassInfo[]): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  });
  return result.data.map((raw, i) => {
    const errors: string[] = [];
    const name = (raw.name ?? "").trim();
    if (!name) errors.push("name is missing");
    const clsRaw = (raw.asset_class ?? "").trim().toLowerCase();
    const cls = classes.find((c) => c.id === clsRaw || c.label.toLowerCase() === clsRaw);
    if (!cls) errors.push(clsRaw ? `asset_class "${raw.asset_class}" isn't recognized` : "asset_class is missing");
    const orig = parseMoney(raw.original_budget ?? "");
    const cur = parseMoney(raw.current_budget ?? "");
    if (orig === null || orig <= 0) errors.push("original_budget must be a positive amount");
    if (cur === null || cur <= 0) errors.push("current_budget must be a positive amount");
    const origEnd = normDate(raw.original_end);
    const curEnd = normDate(raw.current_end);
    if (origEnd === "invalid") errors.push("original_end isn't a date");
    if (curEnd === "invalid") errors.push("current_end isn't a date");
    const boroRaw = (raw.borough ?? "").trim();
    const boro = BOROUGHS.find((b) => b.toLowerCase() === boroRaw.toLowerCase()) ?? (boroRaw || "Citywide");
    const project: ImportedProject | null = errors.length
      ? null
      : {
          id: newId("imp"),
          name: name.slice(0, 120),
          assetClass: cls!.id,
          agency: matchAgency(raw.agency ?? ""),
          boro,
          originalBudget: orig!,
          currentBudget: cur!,
          originalEnd: origEnd as string | null,
          currentEnd: curEnd as string | null,
        };
    return { line: i + 2, project, errors, raw };
  });
}

export function ProjectImport({ classes }: { classes: AssetClassInfo[] }) {
  const imported = useWorkspace((w) => w.importedProjects);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const valid = useMemo(() => (rows ?? []).filter((r) => r.project), [rows]);
  const labelOf = (id: string) => classes.find((c) => c.id === id)?.label ?? id;

  const load = (text: string) => setRows(parseProjectsCsv(text, classes));

  const commit = () => {
    const list = valid.map((r) => r.project!);
    updateWorkspace((w) => {
      w.importedProjects.push(...list);
    });
    toast(`Imported ${num(list.length)} project${list.length === 1 ? "" : "s"}`);
    setRows(null);
    setPaste("");
    setShowPaste(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-ink-2">
        The cost forecaster prices new projects from how past projects turned out. Add your city's own finished or under-way projects here and they join the comparison, so estimates reflect your contractors, your market and your agencies.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={<FileUp className="size-4" />} onClick={() => fileRef.current?.click()}>
          Upload CSV
        </Button>
        <Button onClick={() => setShowPaste((s) => !s)}>{showPaste ? "Hide paste box" : "Paste CSV"}</Button>
        <Button variant="ghost" icon={<Download className="size-4" />} onClick={() => downloadFile("baseline-projects-template.csv", TEMPLATE, "text/csv")}>
          Download template
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) load(await f.text());
            e.target.value = "";
          }}
        />
      </div>
      {showPaste && (
        <div className="space-y-2">
          <label htmlFor="csv-paste" className="text-[13px] font-medium text-ink-2">
            Paste rows with a header line
          </label>
          <Textarea id="csv-paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={TEMPLATE} className="font-mono text-[12.5px]" rows={6} />
          <Button size="sm" onClick={() => load(paste)} disabled={!paste.trim()}>
            Check rows
          </Button>
        </div>
      )}
      <details className="rounded-lg border border-line bg-surface-2/60 p-3 text-[13px] text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">Column guide</summary>
        <ul className="mt-2 space-y-1">
          <li>
            <code>name</code> (required), <code>asset_class</code> (required): one of {classes.map((c) => c.id).join(", ")}
          </li>
          <li>
            <code>original_budget</code>, <code>current_budget</code> (required): dollars, such as 12500000 or 12.5M
          </li>
          <li>
            <code>agency</code>: code like DOT or a name; <code>borough</code>: Manhattan, Bronx, Brooklyn, Queens, Staten Island or Citywide
          </li>
          <li>
            <code>original_end</code>, <code>current_end</code> (optional): planned and actual or latest completion dates, YYYY-MM-DD
          </li>
        </ul>
      </details>

      {rows && (
        <div className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="text-[14px] text-ink">
              <span className="font-semibold">{num(valid.length)}</span> of {num(rows.length)} rows ready to import
              {rows.length - valid.length > 0 && <span className="text-bad-ink"> · {num(rows.length - valid.length)} need fixing</span>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRows(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" disabled={!valid.length} onClick={commit}>
                Import {num(valid.length)}
              </Button>
            </div>
          </div>
          <Table className="max-h-[360px] overflow-y-auto">
            <thead>
              <tr>
                <Th>Row</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th align="right">Original</Th>
                <Th align="right">Current</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.line}>
                  <Td>{r.line}</Td>
                  <Td className="max-w-[220px] truncate">{r.raw.name || "—"}</Td>
                  <Td>{r.project ? labelOf(r.project.assetClass) : r.raw.asset_class || "—"}</Td>
                  <Td align="right">{r.project ? money(r.project.originalBudget) : r.raw.original_budget || "—"}</Td>
                  <Td align="right">{r.project ? money(r.project.currentBudget) : r.raw.current_budget || "—"}</Td>
                  <Td>
                    {r.errors.length ? (
                      <span className="inline-flex items-start gap-1 text-[12.5px] text-bad-ink">
                        <TriangleExclamationPoint className="mt-0.5 size-3.5 shrink-0" />
                        {r.errors.join("; ")}
                      </span>
                    ) : (
                      <Badge tone="good" icon={<CircleCheck className="size-3.5" />}>
                        Ready
                      </Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {rows.length > 50 && <p className="px-4 py-2 text-[12.5px] text-ink-3">Showing the first 50 rows.</p>}
        </div>
      )}

      {imported.length === 0 ? (
        !rows && (
          <EmptyState icon={<FileUp className="size-6" />} title="No projects imported yet">
            Start from the template. Two example rows show the format.
          </EmptyState>
        )
      ) : (
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-[14px] font-semibold text-ink">{num(imported.length)} imported projects</div>
            <Button size="sm" variant="ghost" className="text-bad-ink" icon={<Trash className="size-4" />} onClick={() => setConfirmClear(true)}>
              Remove all
            </Button>
          </div>
          <Table className="max-h-[360px] overflow-y-auto">
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Agency</Th>
                <Th>Borough</Th>
                <Th align="right">Original</Th>
                <Th align="right">Current</Th>
                <Th align="right">Change</Th>
                <Th>Finished</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {imported.map((p) => (
                <tr key={p.id}>
                  <Td className="max-w-[220px] truncate font-medium text-ink">{p.name}</Td>
                  <Td>{labelOf(p.assetClass)}</Td>
                  <Td>{p.agency}</Td>
                  <Td>{p.boro}</Td>
                  <Td align="right">{money(p.originalBudget)}</Td>
                  <Td align="right">{money(p.currentBudget)}</Td>
                  <Td align="right">{`${p.currentBudget >= p.originalBudget ? "+" : "−"}${Math.abs(Math.round((p.currentBudget / p.originalBudget - 1) * 100))}%`}</Td>
                  <Td>{date(p.currentEnd)}</Td>
                  <Td align="right">
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-bad-ink"
                      onClick={() =>
                        updateWorkspace((w) => {
                          w.importedProjects = w.importedProjects.filter((x) => x.id !== p.id);
                        })
                      }
                    >
                      <Trash className="size-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <Callout tone="neutral" title="Where imported projects go">
        They are saved in this browser only, and the Cost forecaster includes them when you price a project of the same type. Export your workspace in Settings to back them up.
      </Callout>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Remove all imported projects?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                updateWorkspace((w) => {
                  w.importedProjects = [];
                });
                setConfirmClear(false);
                toast("Imported projects removed");
              }}
            >
              Remove {num(imported.length)}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-ink-2">This deletes them from this browser and can't be undone. Saved estimates you already made are kept.</p>
      </Modal>
    </div>
  );
}
