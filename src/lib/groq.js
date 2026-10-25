import { FALLBACK_MODEL, openRouterChat, parseJson } from "./openrouter.js";

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

const MAX_QUESTIONS = 10;

const IMAGE_PROMPT = `You read a photo of one or more multiple-choice questions. Extract every distinct question that has options, in the order they appear, each exactly as written.
Return only JSON in this shape:
{ "questions": [ ${SHAPE} ] }
If several questions share a passage, figure or table, repeat what is needed in each question's "context".
Use the option labels printed in the image as ids (A, B, C, 1, 2 ...). If unlabeled, use A, B, C in order.
Ignore questions that have no options. If the image has no question with options, return {"questions": []}.`;

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

async function groqCompletion(model, messages, extra) {
  requireKey();
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages, ...extra }),
  });
  if (!res.ok) throw await groqError(res, "Model error");
  return (await res.json()).choices[0].message.content || "";
}

// Groq first; on any error (rate limit, outage, unreadable output) quietly retry on OpenRouter.
async function chatJson(model, messages, extra = {}) {
  const attempts = [
    () => groqCompletion(model, messages, extra),
    () => openRouterChat(FALLBACK_MODEL, messages, { temperature: extra.temperature ?? 0, maxTokens: extra.max_completion_tokens }),
  ];
  let first;
  for (const attempt of attempts) {
    try {
      return parseJson(await attempt());
    } catch (err) {
      first = first || err;
    }
  }
  throw first instanceof SyntaxError ? new Error("The model returned an unreadable response.") : first;
}

const CODE_MODEL = import.meta.env.VITE_GROQ_CODE_MODEL || VISION_MODEL;

const PROBLEM_PROMPT = `These images, in order, show one or more programming questions. If the images together show a single question (for example one that continues across images), return one entry. If they show several separate questions, return one entry per question.
Transcribe each exactly: the full problem statement, constraints, input and output format, examples, and any code shown.
Return only JSON: {"problems": ["full text of question 1", "..."]}. If there is no programming question, return {"problems": []}.`;

// images: array of data URLs (Groq accepts up to 3 per request). Returns one problem string per question found.
export async function extractProblems(images) {
  const parsed = await chatJson(CODE_MODEL, [
    {
      role: "user",
      content: [{ type: "text", text: PROBLEM_PROMPT }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))],
    },
  ]);
  const problems = (Array.isArray(parsed.problems) ? parsed.problems : []).map((p) => String(p || "").trim()).filter(Boolean);
  if (!problems.length) throw new Error("No programming question found. Try clearer photos.");
  return problems.slice(0, 5);
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

// Returns every multiple-choice question found in the image (at least one, else throws).
export async function extractQuestions(dataUrl) {
  const parsed = await chatJson(VISION_MODEL, [
    {
      role: "user",
      content: [
        { type: "text", text: IMAGE_PROMPT },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);
  const found = [];
  for (const q of Array.isArray(parsed.questions) ? parsed.questions : []) {
    try {
      found.push(normalise(q || {}, ""));
    } catch {
      /* skip a question that has no usable options */
    }
  }
  if (!found.length) throw new Error("No question with options found. Try a clearer photo.");
  return found.slice(0, MAX_QUESTIONS);
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
