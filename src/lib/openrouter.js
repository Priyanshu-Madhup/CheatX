// Silent fallbacks, called through the /api/openrouter proxy (Vercel function in prod, Vite proxy in dev).
export const FALLBACK_MODEL = "qwen/qwen3.7-flash";
export const JEV_MODEL = "typesafe/jev-router";

export async function openRouterChat(model, messages, { temperature = 0, maxTokens = 4000, json = true } = {}) {
  const res = await fetch("/api/openrouter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      // Qwen flash is a reasoning model and can spend its whole budget thinking; the router picks its own effort.
      ...(model.startsWith("qwen/") ? { reasoning: { enabled: false } } : {}),
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Fallback error (${res.status}). ${await res.text()}`.slice(0, 300));
  const data = await res.json();
  return data.choices[0].message.content || "";
}

// Parses a JSON object out of model text, tolerating <think> blocks and surrounding prose.
export function parseJson(raw) {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}
