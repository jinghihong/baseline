#!/usr/bin/env node
// A local stand-in for the Anthropic Messages API, for developing and testing Baseline's AI screens without a real
// key or network access. It speaks the same streaming (SSE) format the SDK expects.
//
//   npm run mock:claude                         # listens on http://localhost:5180
//   VITE_ANTHROPIC_BASE_URL=http://localhost:5180 npm run dev
//
// Then save any key that starts with "sk-ant-" in Settings. Replies are canned: they quote the question and the first
// facts from the context pack, so you can see the full flow (key, test connection, streaming, sources) end to end.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_CLAUDE_PORT ?? 5180);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  // "Authorization" is not covered by a wildcard, so echo exactly what the browser asked for.
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
  res.setHeader("Access-Control-Max-Age", "600");
}

function credential(req) {
  const auth = String(req.headers.authorization ?? "");
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return String(req.headers["x-api-key"] ?? "");
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (b && b.type === "text" ? b.text : "")).join(" ");
  return "";
}

function replyFor(body) {
  const system = textOf(body.system);
  const last = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
  const question = textOf(last?.content).trim();
  if (/single word: ready/i.test(system)) return "ready";
  const facts = system
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•]\s/.test(l) && /\$|\d/.test(l))
    .slice(0, 3);
  return [
    `**Mock Claude reply** (local test server, not a real model).`,
    ``,
    `You asked: "${question.slice(0, 200)}"`,
    ``,
    facts.length ? `The first facts in the data pack Baseline sent:` : `Baseline sent a data pack with ${system.length.toLocaleString()} characters of context.`,
    ...facts.map((f) => `- ${f.replace(/^[-•]\s*/, "")}`),
    ``,
    `With a real API key, Claude answers from the same pack and cites its sources.`,
  ].join("\n");
}

function sse(res, event) {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "Not found" } }));
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const key = credential(req);
  if (!key.startsWith("sk-ant-")) {
    res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
    return;
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Body must be JSON" } }));
    return;
  }
  const model = body.model ?? "claude-opus-5-5";
  const text = replyFor(body);
  console.log(`[mock-claude] ${model} · effort=${body.output_config?.effort ?? "-"} · fallbacks=${JSON.stringify(body.fallbacks ?? null)} · ${text.length} chars`);
  if (!body.stream) {
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 } }),
    );
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  sse(res, { type: "message_start", message: { id: "msg_mock", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 1 } } });
  sse(res, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i += 6) {
    sse(res, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: words.slice(i, i + 6).join("") } });
    await sleep(25);
  }
  sse(res, { type: "content_block_stop", index: 0 });
  sse(res, { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: Math.ceil(text.length / 4) } });
  sse(res, { type: "message_stop" });
  res.end();
});

server.listen(PORT, () => console.log(`[mock-claude] listening on http://localhost:${PORT}`));
