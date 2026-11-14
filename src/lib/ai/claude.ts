// Claude client for the browser. The user's own API key stays in their browser (localStorage) and is sent
// only to the Anthropic API. The SDK is loaded on demand so it never weighs down pages that don't use AI.
import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, getWorkspace } from "../../state/store";

export const MODELS: { id: string; label: string; note: string }[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Best analysis. Default." },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Faster, lower cost." },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest, lowest cost." },
];

export type AiErrorKind = "no_key" | "auth" | "rate_limit" | "refusal" | "network" | "bad_request" | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  system: string;
  messages: ChatTurn[];
  onText?: (delta: string, fullSoFar: string) => void;
  signal?: AbortSignal;
  maxTokens?: number;
}

export interface StreamResult {
  text: string;
  stopReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export function hasClaude(): boolean {
  return !!getWorkspace().ai.apiKey;
}

/**
 * Where requests go. Unset in production builds, so the SDK uses https://api.anthropic.com.
 * Set VITE_ANTHROPIC_BASE_URL at build or dev time to route through a company proxy, or to the local mock
 * server (npm run mock:claude) to develop and test the AI screens without a real key.
 */
const BASE_URL = (import.meta.env.VITE_ANTHROPIC_BASE_URL as string | undefined) || undefined;

let sdk: Promise<typeof import("@anthropic-ai/sdk")> | null = null;
const loadSdk = () => (sdk ??= import("@anthropic-ai/sdk"));

/** Stream a reply from Claude. Throws AiError with a plain-language message on failure. */
export async function streamClaude({ system, messages, onText, signal, maxTokens = 8000 }: StreamOptions): Promise<StreamResult> {
  const { apiKey, model: chosen, effort } = getWorkspace().ai;
  if (!apiKey) throw new AiError("no_key", "Add your Anthropic API key in Settings to use Claude.");
  const model = chosen || DEFAULT_MODEL;
  const mod = await loadSdk();
  const AnthropicClient = mod.default;
  const client = new AnthropicClient({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, ...(BASE_URL ? { baseURL: BASE_URL } : {}) });

  // Server-side fallback re-runs a declined request on a suitable model inside the same call.
  // Claude Haiku 5.5 has no server-side fallback, so it is sent without one.
  const useFallback = !model.startsWith("claude-haiku");
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    thinking: { type: "adaptive" as const },
    output_config: { effort },
    ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };

  let text = "";
  try {
    const stream = client.beta.messages.stream(params as Parameters<typeof client.beta.messages.stream>[0], { signal });
    stream.on("text", (delta: string) => {
      text += delta;
      onText?.(delta, text);
    });
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new AiError("refusal", "Claude declined to answer this request. Try rephrasing the question.");
    }
    return {
      text,
      stopReason: final.stop_reason ?? null,
      model: final.model,
      inputTokens: final.usage?.input_tokens ?? 0,
      outputTokens: final.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    throw toAiError(err, AnthropicClient);
  }
}

/** Cheap round trip used by Settings to check a key. */
export async function testConnection(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const r = await streamClaude({ system: "Reply with the single word: ready", messages: [{ role: "user", content: "Are you there?" }], maxTokens: 64 });
    return { ok: true, model: r.model };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function toAiError(err: unknown, A: typeof Anthropic): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof A.AuthenticationError || err instanceof A.PermissionDeniedError) {
    return new AiError("auth", "The API key was rejected. Check that it is complete and still active in the Anthropic Console.");
  }
  if (err instanceof A.RateLimitError) return new AiError("rate_limit", "Claude is rate limited right now. Wait a moment and try again.");
  if (err instanceof A.BadRequestError) return new AiError("bad_request", `Claude could not process the request: ${err.message}`);
  if (err instanceof A.APIConnectionError) return new AiError("network", "Could not reach the Anthropic API. Check your connection.");
  if (err instanceof A.APIError) return new AiError("unknown", `Claude returned an error (${err.status ?? "unknown status"}).`);
  if (err instanceof Error && err.name === "AbortError") return new AiError("network", "Stopped.");
  return new AiError("unknown", err instanceof Error ? err.message : "Unknown error");
}
