import { ArrowUp, Bot, Copy, ExternalLink, KeyRound, LoaderCircle, MessageSquareText, RotateCcw, Sparkles, Square, Trash } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Badge, Button, ButtonLink, Callout, Card, cn, copyText, ErrorBlock, PageHeader } from "../../components/ui";
import { useDatasets } from "../../data/load";
import { answerQuestion, buildContextPack, CLAUDE_SYSTEM_PROMPT, SUGGESTED_QUESTIONS, type AnalystData, type AnswerSource } from "../../engines/analyst";
import { Markdown } from "../../features/platform/Markdown";
import { AiError, hasClaude, MODELS, streamClaude, type ChatTurn } from "../../lib/ai/claude";
import { useWorkspace } from "../../state/store";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  engine?: "builtin" | "claude";
  model?: string;
  sources?: AnswerSource[];
  followUps?: string[];
  error?: string;
  pending?: boolean;
}

const HISTORY_KEY = "baseline:ask-history";

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as Message[]) : [];
    return Array.isArray(parsed) ? parsed.filter((m) => !m.pending) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.filter((m) => !m.pending).slice(-40)));
  } catch {
    // Storage full or blocked: the conversation still works for this visit.
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Ask() {
  const { data, loading, error } = useDatasets(["overtime", "capital", "budgetLines", "reference", "grants", "demand"]);
  const analystData: AnalystData | null = data;
  const apiKey = useWorkspace((w) => w.ai.apiKey);
  const modelId = useWorkspace((w) => w.ai.model);
  const claudeOn = !!apiKey;
  const modelLabel = MODELS.find((m) => m.id === modelId)?.label ?? modelId;

  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [params, setParams] = useSearchParams();
  const askedFromUrl = useRef(false);

  const contextPack = useMemo(() => (analystData ? buildContextPack(analystData) : ""), [analystData]);

  useEffect(() => saveHistory(messages), [messages]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const patch = (id: string, change: Partial<Message>) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...change } : m)));

  const answerBuiltin = useCallback(
    (question: string, id: string) => {
      if (!analystData) return;
      const a = answerQuestion(question, analystData);
      patch(id, { text: a.text, sources: a.sources, followUps: a.followUps, engine: "builtin", pending: false, error: undefined });
    },
    [analystData],
  );

  const ask = useCallback(
    async (raw: string, { forceBuiltin = false }: { forceBuiltin?: boolean } = {}) => {
      const question = raw.trim();
      if (!question || !analystData || busy) return;
      setInput("");
      const userMsg: Message = { id: uid(), role: "user", text: question };
      const reply: Message = { id: uid(), role: "assistant", text: "", pending: true };
      const history = messages;
      setMessages((list) => [...list, userMsg, reply]);

      if (!hasClaude() || forceBuiltin) {
        answerBuiltin(question, reply.id);
        return;
      }

      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      // Related sources come from the built-in analyst's reading of the same question.
      const related = answerQuestion(question, analystData);
      const turns: ChatTurn[] = [
        ...history
          .filter((m) => !m.error && !m.pending && m.text)
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.text })),
        { role: "user", content: question },
      ];
      // The API expects the conversation to start with a user turn.
      while (turns.length && turns[0].role !== "user") turns.shift();
      try {
        const result = await streamClaude({
          system: `${CLAUDE_SYSTEM_PROMPT}\n\n${contextPack}`,
          messages: turns,
          signal: controller.signal,
          onText: (_d, full) => patch(reply.id, { text: full }),
        });
        patch(reply.id, {
          text: result.text || "_No answer came back._",
          pending: false,
          engine: "claude",
          model: result.model,
          sources: related.sources,
          followUps: related.followUps,
        });
      } catch (err) {
        const message = err instanceof AiError || err instanceof Error ? err.message : String(err);
        setMessages((list) =>
          list.map((m) => (m.id === reply.id ? { ...m, pending: false, error: controller.signal.aborted ? "Stopped." : message, engine: "claude" } : m)),
        );
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [analystData, busy, messages, contextPack, answerBuiltin],
  );

  // Questions sent from the command palette arrive as ?q=
  useEffect(() => {
    const q = params.get("q");
    if (q && analystData && !askedFromUrl.current) {
      askedFromUrl.current = true;
      setParams({}, { replace: true });
      void ask(q);
    }
  }, [params, analystData, ask, setParams]);

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    stop();
    setMessages([]);
    inputRef.current?.focus();
  };

  const lastUserQuestion = (beforeId: string) => {
    const idx = messages.findIndex((m) => m.id === beforeId);
    for (let i = idx - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].text;
    return "";
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Ask Baseline"
        description="Ask a question about the budget, capital projects, overtime, 311 or grants. Every answer lists where its numbers come from."
        actions={
          <>
            <Badge tone={claudeOn ? "brand" : "neutral"} icon={claudeOn ? <Sparkles className="size-3.5" /> : <Bot className="size-3.5" />}>
              {claudeOn ? `Claude · ${modelLabel}` : "Built-in analyst"}
            </Badge>
            {messages.length > 0 && (
              <Button size="sm" variant="ghost" icon={<Trash className="size-4" />} onClick={clear}>
                Clear
              </Button>
            )}
          </>
        }
      />

      {error && <ErrorBlock error={error} className="mb-4" />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="flex min-h-[560px] flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {messages.length === 0 ? (
              <EmptyChat onPick={(q) => void ask(q)} disabled={loading || !analystData} />
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[14.5px] text-brand-ink">{m.text}</div>
                  </div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    modelLabel={MODELS.find((x) => x.id === m.model)?.label ?? m.model ?? modelLabel}
                    onFollowUp={(q) => void ask(q)}
                    onBuiltin={() => {
                      const q = lastUserQuestion(m.id);
                      if (q) answerBuiltin(q, m.id);
                    }}
                    disabled={busy}
                  />
                ),
              )
            )}
            <div ref={endRef} />
          </div>
          <form
            className="border-t border-line bg-surface-2/60 p-3 sm:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
          >
            <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 shadow-card focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <label htmlFor="ask-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="ask-input"
                ref={inputRef}
                rows={1}
                value={input}
                disabled={loading || !analystData}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(160, e.target.scrollHeight)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
                placeholder={loading ? "Loading the city's data…" : "e.g. How much will NYPD overtime run over budget next year?"}
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] text-ink outline-none placeholder:text-ink-3"
              />
              {busy ? (
                <Button variant="secondary" size="md" onClick={stop} icon={<Square className="size-3.5" />} aria-label="Stop">
                  Stop
                </Button>
              ) : (
                <Button type="submit" variant="primary" size="md" disabled={!input.trim() || loading || !analystData} aria-label="Send" icon={<ArrowUp className="size-4" />}>
                  Ask
                </Button>
              )}
            </div>
            <p className="mt-2 px-1 text-[12px] text-ink-3">
              {claudeOn
                ? "Claude answers only from Baseline's cited data pack. Your question and the pack go to Anthropic with your key."
                : "The built-in analyst answers common questions offline. Connect Claude in Settings for open-ended questions."}
            </p>
          </form>
        </Card>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="text-[13.5px] font-semibold text-ink">Try asking</div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy || loading || !analystData}
                  onClick={() => void ask(q)}
                  className="rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[13.5px] font-semibold text-ink">How answers work</div>
            <ul className="mt-2 space-y-2 text-[13px] text-ink-2">
              <li>Numbers come from NYC Open Data, Grants.gov and published Comptroller reports.</li>
              <li>Baseline estimates, like forecasts, are labeled as estimates.</li>
              <li>{claudeOn ? "Claude sees only the same facts and is told to cite them." : "No AI is used unless you connect Claude."}</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink to="/methodology" size="sm" variant="ghost">
                Methodology
              </ButtonLink>
              {!claudeOn && (
                <ButtonLink to="/app/settings" size="sm" icon={<KeyRound className="size-4" />}>
                  Connect Claude
                </ButtonLink>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function EmptyChat({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <MessageSquareText className="size-6" />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold text-ink">What do you want to know about the budget?</h2>
      <p className="mt-1 max-w-md text-[14px] text-ink-3">Start with one of these, or type your own question below.</p>
      <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink-2 shadow-card hover:border-brand hover:text-ink disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
      {disabled && (
        <p className="mt-5 inline-flex items-center gap-2 text-[13px] text-ink-3">
          <LoaderCircle className="size-4 animate-spin" /> Loading the city's data…
        </p>
      )}
    </div>
  );
}

function AssistantMessage({
  message: m,
  modelLabel,
  onFollowUp,
  onBuiltin,
  disabled,
}: {
  message: Message;
  modelLabel: string;
  onFollowUp: (q: string) => void;
  onBuiltin: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", m.engine === "claude" ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-2")}>
        {m.engine === "claude" ? <Sparkles className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[12px] font-medium text-ink-3">{m.engine === "claude" ? `Claude · ${modelLabel}` : m.engine === "builtin" ? "Built-in analyst" : "Baseline"}</div>
        {m.pending && !m.text ? (
          <div className="inline-flex items-center gap-2 text-[14px] text-ink-3">
            <LoaderCircle className="size-4 animate-spin" /> Reading the data…
          </div>
        ) : m.error ? (
          <Callout tone="bad" title="Claude couldn't answer">
            <p>{m.error}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" icon={<RotateCcw className="size-4" />} onClick={onBuiltin}>
                Answer with the built-in analyst
              </Button>
              <ButtonLink to="/app/settings" size="sm" variant="ghost">
                Check settings
              </ButtonLink>
            </div>
          </Callout>
        ) : (
          <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3">
            <Markdown source={m.text} compact />
            {m.pending && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-brand align-middle" />}
          </div>
        )}
        {!m.pending && !m.error && (
          <div className="mt-2 space-y-2">
            {m.sources && m.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[12px] font-medium text-ink-3">{m.engine === "claude" ? "Related sources" : "Sources"}</span>
                {m.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[260px] items-center gap-1 text-[12px] text-ink-3 hover:text-brand">
                    <ExternalLink className="size-3 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {m.followUps?.slice(0, 2).map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={disabled}
                  onClick={() => onFollowUp(q)}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-2 hover:border-brand hover:text-ink disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
              <button type="button" onClick={() => void copyText(m.text, "Answer copied")} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-ink-3 hover:bg-surface-2 hover:text-ink">
                <Copy className="size-3.5" /> Copy
              </button>
            </div>
          </div>
        )}
        {m.engine === "claude" && !m.pending && !m.error && (
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            AI-written from Baseline's data pack. Check key figures in the linked tools, such as the <Link to="/app/overtime" className="underline">Overtime monitor</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
