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
    // Tolerate reasoning preambles: drop <think> blocks and keep the outermost JSON object.
    const raw = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, "");
    return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    throw new Error("The model returned an unreadable response.");
  }
}

const CODE_MODEL = import.meta.env.VITE_GROQ_CODE_MODEL || VISION_MODEL;

const PROBLEM_PROMPT = `These images are parts of one programming question, in order. Transcribe it exactly: the full problem statement, constraints, input and output format, examples, and any code shown.
Return only JSON: {"problem": "the full text"}. If the images contain no programming question, return {"problem": ""}.`;

// images: array of data URLs (Groq accepts up to 3 per request)
export async function extractProblem(images) {
  const parsed = await chatJson(CODE_MODEL, [
    {
      role: "user",
      content: [{ type: "text", text: PROBLEM_PROMPT }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))],
    },
  ]);
  const problem = String(parsed.problem || "").trim();
  if (!problem) throw new Error("No programming question found. Try clearer photos.");
  return problem;
}

export async function solveCode(problem, language = "Auto") {
  const lang = language === "Auto" ? "the language the problem asks for, otherwise Python" : language;
  const parsed = await chatJson(
    CODE_MODEL,
    [
      {
        role: "system",
        content: `You are an expert programmer. Solve the problem with correct, clean, complete code in ${lang}.
Return only JSON: {"title": "short title", "language": "language name", "explanation": "2-4 sentences on the approach and complexity", "code": "complete runnable source", "input": "the sample input you traced, or empty string", "output": "the exact text the program prints for that sample"}.
Trace your code step by step on the example given in the problem (or a small example you choose) to produce the output. Do not guess it.`,
      },
      { role: "user", content: problem },
    ],
    { temperature: 0.2, max_completion_tokens: 6000 }
  );
  if (!String(parsed.code || "").trim()) throw new Error("The model did not return any code. Try again.");
  return {
    title: String(parsed.title || "Solution"),
    language: String(parsed.language || "").toLowerCase(),
    explanation: String(parsed.explanation || ""),
    code: String(parsed.code),
    input: String(parsed.input || ""),
    output: String(parsed.output || ""),
  };
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
