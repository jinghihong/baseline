import { CircleCheck, ExternalLink, Eye, EyeOff, KeyRound, Lock, Monitor, Moon, ShieldCheck, Sparkles, Sun, TriangleExclamationPoint } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Callout, Card, CardBody, CardHeader, Field, Input, PageHeader, Segmented, Select, toast } from "../../components/ui";
import { ROLE_LABEL, ROLE_TAGLINE } from "../../app/nav";
import { MODELS, testConnection } from "../../lib/ai/claude";
import { WorkspaceTools } from "../../features/platform/WorkspaceTools";
import { applyTheme, setRole, updateWorkspace, useWorkspace, type Role, type Workspace } from "../../state/store";

const EFFORTS: { value: Workspace["ai"]["effort"]; label: string; note: string }[] = [
  { value: "low", label: "Low", note: "Fastest and cheapest. Good for quick lookups." },
  { value: "medium", label: "Medium", note: "Balanced. Recommended." },
  { value: "high", label: "High", note: "Most thorough. Slower and costs more." },
];

export default function Settings() {
  const role = useWorkspace((w) => w.role);
  const theme = useWorkspace((w) => w.theme);
  const district = useWorkspace((w) => w.council.district);
  const ai = useWorkspace((w) => w.ai);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Your workspace, appearance and optional AI connection. Settings are saved in this browser." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Workspace" subtitle="Both workspaces use the same data. The role changes what Home shows and how tools are grouped." />
            <CardBody className="space-y-5">
              <Field label="Your role">
                <Segmented<Role>
                  value={role}
                  onChange={(r) => {
                    setRole(r);
                    toast(`Switched to the ${ROLE_LABEL[r].toLowerCase()} workspace`);
                  }}
                  options={[
                    { value: "budget", label: ROLE_LABEL.budget },
                    { value: "council", label: ROLE_LABEL.council },
                  ]}
                />
              </Field>
              <p className="-mt-2 text-[13px] text-ink-3">{ROLE_TAGLINE[role]}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City" hint="More cities are added as their open data is connected.">
                  <Input value="New York City" readOnly aria-readonly />
                </Field>
                <Field label="Your Council district" hint="Used by District view. Optional." htmlFor="district">
                  <Select
                    id="district"
                    value={district ?? ""}
                    onChange={(e) =>
                      updateWorkspace((w) => {
                        w.council.district = e.target.value ? Number(e.target.value) : null;
                      })
                    }
                  >
                    <option value="">No district</option>
                    {Array.from({ length: 51 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        District {d}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Appearance" />
            <CardBody>
              <Segmented<Workspace["theme"]>
                value={theme}
                onChange={(t) => {
                  updateWorkspace((w) => {
                    w.theme = t;
                  });
                  applyTheme(t);
                }}
                options={[
                  { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" /> Light</span> },
                  { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" /> Dark</span> },
                  { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-3.5" /> System</span> },
                ]}
              />
            </CardBody>
          </Card>

          <AiSettings ai={ai} />

          <Card>
            <CardHeader title="Workspace data" subtitle="Back up, move or clear everything you've created." />
            <CardBody>
              <WorkspaceTools />
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ShieldCheck className="size-4 text-brand" /> Privacy
            </div>
            <ul className="mt-3 space-y-2.5 text-[13px] text-ink-2">
              <li>Baseline has no account system and no server that stores your work. Estimates, notes, imports and settings stay in this browser.</li>
              <li>The city data Baseline shows is public and is loaded as static files.</li>
              <li>If you connect Claude, your questions and a summary of public data are sent from your browser to Anthropic's API with your key. Nothing goes to Baseline.</li>
              <li>Exports never include your API key.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

function AiSettings({ ai }: { ai: Workspace["ai"] }) {
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const connected = !!ai.apiKey;
  const masked = ai.apiKey ? `${ai.apiKey.slice(0, 10)}…${ai.apiKey.slice(-4)}` : "";

  const save = () => {
    const key = draft.trim();
    if (!key) return;
    updateWorkspace((w) => {
      w.ai.apiKey = key;
    });
    setDraft("");
    setResult(null);
    toast("API key saved in this browser");
  };

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    const r = await testConnection();
    setTesting(false);
    setResult(r.ok ? { ok: true, text: `Connected. Claude replied using ${r.model}.` } : { ok: false, text: r.error });
  };

  return (
    <Card>
      <CardHeader
        title="AI connection"
        subtitle="Optional. Every tool works without AI. Connect Claude to answer open-ended questions in Ask Baseline."
        actions={
          <Badge tone={connected ? "brand" : "neutral"} icon={<Sparkles className="size-3.5" />}>
            {connected ? "Claude connected" : "Not connected"}
          </Badge>
        }
      />
      <CardBody className="space-y-5">
        {connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
            <div className="flex items-center gap-2 text-[13.5px] text-ink">
              <KeyRound className="size-4 text-ink-3" />
              <span className="font-mono text-[13px]">{masked}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={runTest} loading={testing}>
                Test connection
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-bad-ink"
                onClick={() => {
                  updateWorkspace((w) => {
                    w.ai.apiKey = "";
                  });
                  setResult(null);
                  toast("API key removed");
                }}
              >
                Remove key
              </Button>
            </div>
          </div>
        ) : (
          <Field label="Anthropic API key" htmlFor="api-key" hint={<>Create one in the <a className="text-brand underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Anthropic Console <ExternalLink className="inline size-3" /></a>. Set a spending limit on it.</>}>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="sk-ant-…"
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
                  aria-label={show ? "Hide key" : "Show key"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button type="submit" variant="primary" disabled={!draft.trim()}>
                Save key
              </Button>
            </form>
          </Field>
        )}

        {result && (
          <Callout tone={result.ok ? "good" : "bad"} icon={result.ok ? <CircleCheck className="size-4" /> : <TriangleExclamationPoint className="size-4" />}>
            {result.text}
          </Callout>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Model" htmlFor="model" hint={MODELS.find((m) => m.id === ai.model)?.note}>
            <Select
              id="model"
              value={ai.model}
              onChange={(e) =>
                updateWorkspace((w) => {
                  w.ai.model = e.target.value;
                })
              }
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Effort" htmlFor="effort" hint={EFFORTS.find((x) => x.value === ai.effort)?.note}>
            <Select
              id="effort"
              value={ai.effort}
              onChange={(e) =>
                updateWorkspace((w) => {
                  w.ai.effort = e.target.value as Workspace["ai"]["effort"];
                })
              }
            >
              {EFFORTS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Callout tone="warn" title="How your key is stored" icon={<Lock className="size-4" />}>
          The key is saved in this browser's local storage and sent only to Anthropic's API (api.anthropic.com), straight from your browser. Anyone who can use this browser profile could read it, so remove it on shared computers and use a key with a spending limit. Usage is billed to your Anthropic account.
        </Callout>
      </CardBody>
    </Card>
  );
}
