// Export, import and reset the browser workspace. API keys are never written to an export.
import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Callout, Modal, toast } from "../../components/ui";
import { getWorkspace, replaceWorkspace, resetWorkspace, useWorkspace, type Workspace } from "../../state/store";
import { num } from "../../lib/format";

const countsOf = (w: Partial<Workspace>) => [
  { label: "saved estimates", n: w.estimates?.length ?? 0 },
  { label: "pinned projects", n: w.pinnedProjects?.length ?? 0 },
  { label: "project notes", n: Object.keys(w.projectNotes ?? {}).length },
  { label: "tracked budget lines", n: w.customLines?.length ?? 0 },
  { label: "fiscal notes", n: w.fiscalNotes?.length ?? 0 },
  { label: "imported projects", n: w.importedProjects?.length ?? 0 },
  { label: "saved scenarios", n: w.scenarios?.length ?? 0 },
];

export function exportWorkspace() {
  const w = getWorkspace();
  const safe = { ...w, ai: { ...w.ai, apiKey: "" } };
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `baseline-workspace-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Workspace exported (without your API key)");
}

export function WorkspaceTools() {
  const workspace = useWorkspace((w) => w);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Partial<Workspace> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onFile = async (file: File) => {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Workspace>;
      if (!parsed || typeof parsed !== "object" || parsed.version !== 1) throw new Error("This file isn't a Baseline workspace export.");
      setPending(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read the file.");
    }
  };

  const total = countsOf(workspace).reduce((s, c) => s + c.n, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        {countsOf(workspace).map((c) => (
          <span key={c.label}>
            <span className="font-semibold text-ink">{num(c.n)}</span> {c.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Download className="size-4" />} onClick={exportWorkspace}>
          Export workspace
        </Button>
        <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
          Import workspace
        </Button>
        <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setConfirmReset(true)} className="text-bad-ink">
          Reset workspace
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {importError && (
        <Callout tone="bad" title="Import failed">
          {importError}
        </Callout>
      )}
      <p className="text-[12.5px] text-ink-3">Your workspace lives in this browser only. Export it to move it to another computer or keep a backup. Exports never include your API key.</p>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Replace this workspace?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const current = getWorkspace();
                replaceWorkspace({ ...pending, ai: { ...current.ai }, onboarded: true });
                setPending(null);
                toast("Workspace imported");
              }}
            >
              Import
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-ink-2">The file contains:</p>
        <ul className="mt-2 space-y-1 text-[14px] text-ink-2">
          {pending &&
            countsOf(pending).map((c) => (
              <li key={c.label}>
                <span className="font-semibold text-ink">{num(c.n)}</span> {c.label}
              </li>
            ))}
        </ul>
        <p className="mt-3 text-[13px] text-ink-3">Everything currently in this browser's workspace will be replaced. Your API key and AI settings stay as they are.</p>
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the workspace?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetWorkspace();
                try {
                  localStorage.removeItem("baseline:ask-history");
                } catch {
                  /* ignore */
                }
                setConfirmReset(false);
                toast("Workspace reset");
              }}
            >
              Delete {total ? `${num(total)} items` : "everything"}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-ink-2">
          This permanently deletes your saved estimates, notes, pins, tracked lines, fiscal notes, imported projects, scenarios and Ask history from this browser. It can't be undone. Export first if you might want them back.
        </p>
        <p className="mt-2 text-[13px] text-ink-3">Your API key is also removed. Your role and theme are kept.</p>
      </Modal>
    </div>
  );
}
