// Goes through /api/wity (Vercel function in prod, Vite proxy in dev); Wity does not allow browser CORS.
export async function pickAnswer({ question, context, options }) {
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

  const res = await fetch("/api/wity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
