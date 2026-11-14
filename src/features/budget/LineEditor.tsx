// Add or edit a tracked budget line: adopted amount, monthly actuals so far, and an optional spending profile.
import { useEffect, useState } from "react";
import { Button, Callout, Field, Input, Modal, MoneyInput, Segmented } from "../../components/ui";
import { FISCAL_MONTHS, isFlatProfile, normalizeProfile, parseAmount, WINTER_PROFILE } from "../../engines/spendTracker";
import type { CustomBudgetLine } from "../../state/store";

type ProfileMode = "flat" | "winter" | "custom";

const sameProfile = (a: number[] | undefined, b: number[]) => !!a && a.length === 12 && normalizeProfile(a).every((v, i) => Math.abs(v - normalizeProfile(b)[i]) < 1e-6);

export interface LineDraft {
  name: string;
  agency: string;
  adopted: number;
  monthly: number[];
  profile?: number[];
}

export function LineEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: CustomBudgetLine | null;
  onClose: () => void;
  onSave: (draft: LineDraft) => void;
}) {
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [adopted, setAdopted] = useState(0);
  const [months, setMonths] = useState<string[]>(Array(12).fill(""));
  const [mode, setMode] = useState<ProfileMode>("flat");
  const [custom, setCustom] = useState<string[]>(Array(12).fill((100 / 12).toFixed(1)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial?.name ?? "");
    setAgency(initial?.agency ?? "");
    setAdopted(initial?.adopted ?? 0);
    setMonths(Array.from({ length: 12 }, (_, i) => (initial?.monthly[i] !== undefined ? String(initial.monthly[i]) : "")));
    const p = initial?.profile;
    if (!p || isFlatProfile(p)) setMode("flat");
    else if (sameProfile(p, WINTER_PROFILE)) setMode("winter");
    else {
      setMode("custom");
      setCustom(normalizeProfile(p).map((v) => (v * 100).toFixed(1)));
    }
  }, [open, initial]);

  const save = () => {
    if (!name.trim()) return setError("Give the line a name.");
    if (!(adopted > 0)) return setError("Enter the adopted budget for the year.");
    const monthly: number[] = [];
    let ended = false;
    for (let i = 0; i < 12; i++) {
      const v = parseAmount(months[i]);
      if (v === null) {
        ended = true;
        continue;
      }
      if (!Number.isFinite(v) || v < 0) return setError(`${FISCAL_MONTHS[i]} is not a valid amount.`);
      if (ended) return setError("Fill months in order from July, with no gaps.");
      monthly.push(v);
    }
    let profile: number[] | undefined;
    if (mode === "winter") profile = [...WINTER_PROFILE];
    if (mode === "custom") {
      const vals = custom.map((c) => Number(c));
      if (vals.some((v) => !Number.isFinite(v) || v < 0) || vals.reduce((a, b) => a + b, 0) <= 0) return setError("Each profile share must be a number of 0 or more.");
      profile = normalizeProfile(vals);
    }
    onSave({ name: name.trim(), agency: agency.trim() || "Unassigned", adopted, monthly, profile });
  };

  const customTotal = custom.reduce((s, c) => s + (Number(c) || 0), 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit tracked line" : "Track a budget line"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {initial ? "Save changes" : "Add line"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Line name" htmlFor="le-name">
          <Input id="le-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Snow removal overtime" />
        </Field>
        <Field label="Agency" htmlFor="le-agency">
          <Input id="le-agency" value={agency} onChange={(e) => setAgency(e.target.value)} placeholder="e.g. DSNY" />
        </Field>
        <Field label="Adopted budget for the year" htmlFor="le-adopted" hint='Type "45M" or "1.9B" for millions and billions.'>
          <MoneyInput id="le-adopted" value={adopted} onChange={setAdopted} />
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">Spending by month so far</div>
        <p className="mb-2 text-[12px] text-ink-3">The city's fiscal year starts in July. Leave future months blank.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FISCAL_MONTHS.map((m, i) => (
            <label key={m} className="flex flex-col gap-1 text-[12px] text-ink-3">
              {m}
              <Input
                inputMode="decimal"
                aria-label={`${m} spending`}
                value={months[i]}
                placeholder="—"
                onChange={(e) => setMonths((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className="h-8 px-2 text-[13px]"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-[13px] font-medium text-ink-2">When does this line usually spend?</div>
        <Segmented<ProfileMode>
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "flat", label: "Evenly" },
            { value: "winter", label: "Mostly in winter" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {mode === "custom" && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {FISCAL_MONTHS.map((m, i) => (
                <label key={m} className="flex flex-col gap-1 text-[12px] text-ink-3">
                  {m} %
                  <Input
                    inputMode="decimal"
                    aria-label={`${m} share of annual spending`}
                    value={custom[i]}
                    onChange={(e) => setCustom((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className="h-8 px-2 text-[13px]"
                  />
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-3">Shares add up to {customTotal.toFixed(1)}%. Baseline rescales them to 100%.</p>
          </>
        )}
      </div>

      {error && (
        <Callout tone="bad" className="mt-4">
          {error}
        </Callout>
      )}
    </Modal>
  );
}
