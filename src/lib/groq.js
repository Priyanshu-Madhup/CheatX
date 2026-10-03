const KEY = import.meta.env.VITE_GROQ_API_KEY;
const VISION_MODEL = import.meta.env.VITE_GROQ_MODEL || "qwen/qwen3.8-27b";
const STT_MODEL = import.meta.env.VITE_GROQ_STT_MODEL || "whisper-large-v3-turbo";
const TEXT_MODEL = import.meta.env.VITE_GROQ_TEXT_MODEL || "openai/gpt-oss-20b";
const API = "https://api.groq.com/openai/v1";

const SHAPE = `{
  "question": "full question text, including any passage or data needed to answer it",
  "context": "short description of any diagram, figure or table that matters, or empty string",
  "options": [{ "id": "A", "text": "option text" }]
}`;

const IMAGE_PROMPT = `You read a photo of a multiple-choice question. Extract it exactly.
Return only JSON in this shape:
${SHAPE}
Use the option labels printed in the image as ids (A, B, C, 1, 2 ...). If unlabeled, use A, B, C in order.
If the image has no question with options, return {"question": "", "context": "", "options": []}.`;

const SPEECH_PROMPT = `You receive a spoken transcript of someone reading out a multiple-choice question and its options.
Clean up transcription mistakes and return only JSON in this shape:
${SHAPE}
Use the option labels the speaker says (A, B, C, one, two ...) as ids, normalised to A, B, C... or 1, 2, 3...; if none are spoken, use A, B, C in order.
Do not answer the question and do not invent options. If no question with options was spoken, return {"question": "", "context": "", "options": []}.`;

function requireKey() {
  if (!KEY || KEY.startsWith("your_")) throw new Error("Add VITE_GROQ_API_KEY to .env.");
}

async function groqError(res, label) {
  return new Error(`${label} (${res.status}). ${await res.text()}`.slice(0, 300));
}

function normalise(parsed, emptyMessage) {
  const options = (parsed.options || []).filter((o) => o && o.id != null && String(o.text || "").trim());
  if (!String(parsed.question || "").trim() || options.length < 2) throw new Error(emptyMessage);
  return {
    question: String(parsed.question).trim(),
    context: String(parsed.context || ""),
    options: options.map((o) => ({ id: String(o.id), text: String(o.text).trim() })),
  };
}

async function chatJson(model, messages, extra = {}) {
  requireKey();
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages, ...extra }),
  });
  if (!res.ok) throw await groqError(res, "Model error");
  const data = await res.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    throw new Error("The model returned an unreadable response.");
  }
}

export async function extractQuestion(dataUrl) {
  const parsed = await chatJson(VISION_MODEL, [
    {
      role: "user",
      content: [
        { type: "text", text: IMAGE_PROMPT },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);
  return normalise(parsed, "No question with options found. Try a clearer photo.");
}

export async function transcribeAudio(blob, filename = "speech.webm") {
  requireKey();
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", STT_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const res = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw await groqError(res, "Transcription error");
  const { text } = await res.json();
  if (!text || !text.trim()) throw new Error("No speech detected. Try again closer to the mic.");
  return text.trim();
}

export async function structureSpoken(transcript) {
  const parsed = await chatJson(
    TEXT_MODEL,
    [
      { role: "system", content: SPEECH_PROMPT },
      { role: "user", content: transcript },
    ],
    { reasoning_effort: "low" }
  );
  return normalise(parsed, "Say the question and at least two options.");
}
