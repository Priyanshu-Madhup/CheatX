const KEY = import.meta.env.VITE_WITY_API_KEY;
const BASE = (import.meta.env.VITE_WITY_BASE_URL || "https://wity-proxy-production-2c33.up.railway.app").replace(/\/$/, "");

export async function pickAnswer({ question, context, options }) {
  if (!KEY || KEY.startsWith("your_")) throw new Error("Add VITE_WITY_API_KEY to .env.");

  const criteria = {};
  options.forEach((o) => {
    criteria[o.id] = o.text;
  });

  const body = {
    state: { question, ...(context ? { context } : {}), options: criteria },
    questions: {
      answer: {
        type: "choice",
        instructions:
          "Which option is the correct answer to the question? Choose the single best, factually correct option.",
        criteria,
      },
    },
    reasoning: "always",
  };

  const res = await fetch(`${BASE}/v1/systemone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Decision error (${res.status}). ${await res.text()}`.slice(0, 300));
  const { answers } = await res.json();
  const a = answers.answer;
  return {
    choice: a.choice,
    confidence: a.confidence,
    probabilities: a.probabilities,
  };
}
