const KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = import.meta.env.VITE_GROQ_MODEL || "qwen/qwen3.8-27b";

const PROMPT = `You read a photo of a multiple-choice question. Extract it exactly.
Return only JSON in this shape:
{
  "question": "full question text, including any passage or data needed to answer it",
  "context": "short description of any diagram, figure or table that matters, or empty string",
  "options": [{ "id": "A", "text": "option text" }]
}
Use the option labels printed in the image as ids (A, B, C, 1, 2 ...). If unlabeled, use A, B, C in order.
If the image has no question with options, return {"question": "", "context": "", "options": []}.`;

export async function extractQuestion(dataUrl) {
  if (!KEY || KEY.startsWith("your_")) throw new Error("Add VITE_GROQ_API_KEY to .env.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Vision model error (${res.status}). ${await res.text()}`.slice(0, 300));
  const data = await res.json();
  let parsed;
  try {
    parsed = JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("Vision model returned an unreadable response.");
  }
  const options = (parsed.options || []).filter((o) => o && o.id != null && o.text);
  if (!parsed.question || options.length < 2) {
    throw new Error("No question with options found. Try a clearer photo.");
  }
  return {
    question: String(parsed.question),
    context: String(parsed.context || ""),
    options: options.map((o) => ({ id: String(o.id), text: String(o.text) })),
  };
}
