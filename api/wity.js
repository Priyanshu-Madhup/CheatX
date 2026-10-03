// Vercel serverless proxy: browsers cannot call Wity directly (no CORS), and this keeps the key off the client.
const BASE = (process.env.VITE_WITY_BASE_URL || "https://wity-proxy-production-2c33.up.railway.app").replace(/\/$/, "");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ detail: "Method Not Allowed" });
  }
  const key = process.env.WITY_API_KEY || process.env.VITE_WITY_API_KEY;
  if (!key) return res.status(500).json({ detail: "Wity API key is not configured on the server." });

  try {
    const upstream = await fetch(`${BASE}/v1/systemone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(upstream.status).setHeader("Content-Type", "application/json").send(await upstream.text());
  } catch (err) {
    res.status(502).json({ detail: `Upstream request failed: ${err.message}` });
  }
}
