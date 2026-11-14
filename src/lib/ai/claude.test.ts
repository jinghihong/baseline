// Integration test for the Claude client: the real Anthropic SDK runs against a simulated Messages API stream,
// so the request shape, streaming, and error handling are all exercised without a network call or a real key.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateWorkspace } from "../../state/store";
import { AiError, streamClaude } from "./claude";

const FAKE_KEY = "sk-ant-test-not-a-real-key";

function sse(events: Record<string, unknown>[]): string {
  return events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

function streamBody(text: string[], stopReason: string): string {
  return sse([
    {
      type: "message_start",
      message: { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 42, output_tokens: 1 } },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ...text.map((t) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 17 } },
    { type: "message_stop" },
  ]);
}

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function mockFetch(respond: () => Response): { calls: Captured[] } {
  const calls: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? "{}")) });
      return respond();
    }),
  );
  return { calls };
}

const sseResponse = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });

describe("streamClaude", () => {
  beforeEach(() =>
    updateWorkspace((w) => {
      w.ai = { apiKey: FAKE_KEY, model: "claude-opus-5-5", effort: "medium" };
    }),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("streams text and sends the expected request", async () => {
    const { calls } = mockFetch(() => sseResponse(streamBody(["NYPD overtime ", "is likely $552M ", "over budget."], "end_turn")));
    const deltas: string[] = [];
    const r = await streamClaude({
      system: "Answer only from the facts provided.",
      messages: [{ role: "user", content: "How much is NYPD overtime over budget?" }],
      onText: (d) => deltas.push(d),
    });

    expect(r.text).toBe("NYPD overtime is likely $552M over budget.");
    expect(deltas).toEqual(["NYPD overtime ", "is likely $552M ", "over budget."]);
    expect(r.stopReason).toBe("end_turn");
    expect(r.inputTokens).toBe(42);
    expect(r.outputTokens).toBe(17);

    expect(calls).toHaveLength(1);
    const { url, headers, body } = calls[0];
    expect(url).toContain("/v1/messages");
    // SDK 1.x sends API keys as a bearer token (older SDKs used x-api-key); accept either.
    expect(headers.get("authorization") === `Bearer ${FAKE_KEY}` || headers.get("x-api-key") === FAKE_KEY).toBe(true);
    expect(headers.get("anthropic-version")).toBeTruthy();
    expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.stream).toBe(true);
    expect(body.fallbacks).toBe("default");
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.system).toBe("Answer only from the facts provided.");
    expect(body).not.toHaveProperty("temperature");
  });

  it("does not ask for server-side fallback on Haiku, which has none", async () => {
    updateWorkspace((w) => {
      w.ai.model = "claude-haiku-5-5";
    });
    const { calls } = mockFetch(() => sseResponse(streamBody(["ok"], "end_turn")));
    await streamClaude({ system: "s", messages: [{ role: "user", content: "hi" }] });
    expect(calls[0].body.model).toBe("claude-haiku-5-5");
    expect(calls[0].body).not.toHaveProperty("fallbacks");
    expect(calls[0].headers.get("anthropic-beta") ?? "").not.toContain("server-side-fallback");
  });

  it("turns a refusal into a plain-language error", async () => {
    mockFetch(() => sseResponse(streamBody([], "refusal")));
    const err = await streamClaude({ system: "s", messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe("refusal");
  });

  it("maps a rejected key to an auth error", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    const err = await streamClaude({ system: "s", messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe("auth");
  });

  it("refuses to call the API without a key", async () => {
    updateWorkspace((w) => {
      w.ai.apiKey = "";
    });
    const { calls } = mockFetch(() => sseResponse(""));
    const err = await streamClaude({ system: "s", messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect((err as AiError).kind).toBe("no_key");
    expect(calls).toHaveLength(0);
  });
});
