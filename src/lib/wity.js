import { JEV_MODEL, openRouterChat, parseJson } from "./openrouter.js";

const INSTRUCTIONS = "Which option is the correct answer to the question? Choose the single best, factually correct option.";

// Wity goes through /api/wity (Vercel function in prod, Vite proxy in dev); it does not allow browser CORS.
async function viaWity({ question, context, options }) {
  const criteria = Object.fromEntries(options.map((o) => [o.id, o.text]));

  const body = (reasoning) => ({
    state: { question, ...(context ? { context } : {}), options: criteria },
    questions: { answer: { type: "choice", instructions: INSTRUCTIONS, criteria } },
    reasoning,
  });

  const call = (reasoning) =>
    fetch("/api/wity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body(reasoning)),
      signal: AbortSignal.timeout(60000),
    });

  // "always" can 500 on some inputs upstream; "auto" still thinks on close calls, so fall back to it.
  let res = await call("always");
  if (res.status >= 500) res = await call("auto");
  if (!res.ok) throw new Error(`Decision error (${res.status}). ${await res.text()}`.slice(0, 300));
  const a = (await res.json()).answers.answer;
  return { choice: a.choice, confidence: a.confidence, probabilities: a.probabilities };
}

// Backup decider: TypeSafe Jev via OpenRouter. It is a chat router, so the per-option probabilities
// are the model's own stated certainty (normalised), not Wity's calibrated distribution.
async function viaJev({ question, context, options }) {
  const ids = options.map((o) => o.id);
  const raw = await openRouterChat(
    JEV_MODEL,
    [
      {
        role: "system",
        content: `${INSTRUCTIONS}
Return only JSON: {"choice": "<option id>", "probabilities": {${ids.map((i) => `"${i}": <0..1>`).join(", ")}}}.
The probabilities express how likely each option is to be the correct answer and must sum to 1.`,
      },
      {
        role: "user",
        content: JSON.stringify({ question, ...(context ? { context } : {}), options: Object.fromEntries(options.map((o) => [o.id, o.text])) }),
      },
    ],
    { maxTokens: 1500 }
  );
  const j = parseJson(raw);

  const weights = ids.map((i) => Math.max(0, Number(j.probabilities?.[i]) || 0));
  const total = weights.reduce((s, w) => s + w, 0);
  let probabilities;
  if (total > 0) {
    probabilities = Object.fromEntries(ids.map((id, i) => [id, weights[i] / total]));
  } else if (ids.includes(String(j.choice))) {
    probabilities = Object.fromEntries(ids.map((id) => [id, id === String(j.choice) ? 1 : 0]));
  } else {
    throw new Error("Backup decider returned no usable answer.");
  }
  const choice = ids.reduce((best, id) => (probabilities[id] > probabilities[best] ? id : best), ids[0]);
  return { choice, confidence: probabilities[choice], probabilities };
}

export async function pickAnswer(q) {
  try {
    return await viaWity(q);
  } catch (err) {
    try {
      return await viaJev(q);
    } catch {
      throw err;
    }
  }
}
