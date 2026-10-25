// Vercel serverless proxy for OpenRouter: keeps the key off the client and only allows the fallback models.
const ALLOWED = new Set(["qwen/qwen3.7-flash", "typesafe/jev-router"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ detail: "Method Not Allowed" });
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ detail: "OpenRouter API key is not configured on the server." });

  const b = req.body || {};
  if (!ALLOWED.has(b.model)) return res.status(400).json({ detail: "Model not allowed." });

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...b, stream: false, max_tokens: Math.min(Number(b.max_tokens) || 4000, 8000) }),
    });
    res.status(upstream.status).setHeader("Content-Type", "application/json").send(await upstream.text());
  } catch (err) {
    res.status(502).json({ detail: `Upstream request failed: ${err.message}` });
  }
}
