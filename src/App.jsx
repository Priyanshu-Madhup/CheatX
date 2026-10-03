import { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./lib/supabase.js";
import { addItem, createTest, deleteTest, listItems, listTests } from "./lib/db.js";
import { fileToDataUrl } from "./lib/image.js";
import { extractProblem, extractQuestion, solveCode, structureSpoken, transcribeAudio } from "./lib/groq.js";
import { pickAnswer } from "./lib/wity.js";
import Auth from "./components/Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ItemCard from "./components/ItemCard.jsx";
import CodeCard from "./components/CodeCard.jsx";
import AddSheet from "./components/AddSheet.jsx";
import { PlusIcon } from "./components/Icons.jsx";

const STAGES = {
  reading: "Reading the question",
  transcribing: "Transcribing",
  structuring: "Structuring the question",
  deciding: "Scoring the options",
  solving: "Writing the solution",
  saving: "Saving",
};
const titleOf = (q) => {
  const t = q.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 45).trim() + "..." : t;
};

export default function App() {
  if (!supabaseConfigured) {
    return (
      <main className="auth">
        <span className="brand">CheatX</span>
        <h1>Supabase is not configured.</h1>
        <p className="sub">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.</p>
      </main>
    );
  }
  return <Gate />;
}

function Gate() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <main className="auth" />;
  if (!session) return <Auth />;
  return <Workspace session={session} />;
}

function Workspace({ session }) {
  const endRef = useRef(null);
  const activeRef = useRef(null);

  const [tests, setTests] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(null); // { image, stage, question?, error? }
  const [adding, setAdding] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  const setActive = (id) => {
    activeRef.current = id;
    setActiveId(id);
  };

  useEffect(() => {
    listTests().then(setTests).catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, pending?.stage]);

  async function selectTest(id) {
    setSideOpen(false);
    setPending(null);
    setActive(id);
    setItems([]);
    try {
      const rows = await listItems(id);
      if (activeRef.current === id) setItems(rows);
    } catch (e) {
      setLoadError(e.message);
    }
  }

  function newTest() {
    setSideOpen(false);
    setPending(null);
    setActive(null);
    setItems([]);
    setLoadError("");
  }

  async function removeTest(id) {
    try {
      await deleteTest(id);
      setTests((t) => t.filter((x) => x.id !== id));
      if (activeRef.current === id) newTest();
    } catch (e) {
      setLoadError(e.message);
    }
  }

  // Saves an item into the active test, creating the test (titled from the question) on first use.
  async function persist(payload) {
    let testId = activeRef.current;
    if (!testId) {
      const t = await createTest(titleOf(payload.code?.title || payload.question));
      setTests((prev) => [t, ...prev]);
      testId = t.id;
      setActive(testId);
    }
    const saved = await addItem(testId, payload);
    setItems((prev) => [...prev, saved]);
    setPending(null);
  }

  // MCQ pipeline: produce a structured question -> Wity -> save.
  async function runMcq(image, firstStage, produce) {
    setLoadError("");
    setAdding(false);
    try {
      setPending({ image, stage: firstStage });
      const q = await produce((stage) => setPending({ image, stage }));
      setPending({ image, stage: "deciding", question: q.question });
      const r = await pickAnswer(q);
      setPending({ image, stage: "saving", question: q.question });
      await persist({
        kind: "mcq",
        question: q.question,
        context: q.context,
        options: q.options,
        choice: r.choice,
        probabilities: r.probabilities,
      });
    } catch (err) {
      setPending({ image, stage: null, error: err.message || "Something went wrong." });
    }
  }

  async function handleMcq(job) {
    if (job.kind === "manual") return runMcq(null, "deciding", async () => job.q);
    if (job.kind === "voice") {
      return runMcq(null, "transcribing", async (setStage) => {
        const text = await transcribeAudio(job.blob, job.filename);
        setStage("structuring");
        return structureSpoken(text);
      });
    }
    let image;
    try {
      image = await fileToDataUrl(job.file);
    } catch (err) {
      setAdding(false);
      return setPending({ image: null, stage: null, error: err.message });
    }
    runMcq(image, "reading", () => extractQuestion(image));
  }

  // Coding pipeline: images / speech / text -> problem statement -> solution with sample output -> save.
  async function handleCode({ images = [], text = "", voice, language = "Auto" }) {
    setLoadError("");
    setAdding(false);
    const image = images[0] || null;
    try {
      let problem = text;
      if (voice) {
        setPending({ image, stage: "transcribing" });
        problem = await transcribeAudio(voice.blob, voice.filename);
      } else if (images.length) {
        setPending({ image, stage: "reading" });
        problem = await extractProblem(images);
      }
      setPending({ image, stage: "solving", question: problem });
      const solution = await solveCode(problem, language);
      setPending({ image, stage: "saving", question: problem });
      await persist({ kind: "code", question: problem, code: solution });
    } catch (err) {
      setPending({ image, stage: null, error: err.message || "Something went wrong." });
    }
  }

  const busy = Boolean(pending?.stage);
  const empty = items.length === 0 && !pending;

  return (
    <div className="shell">
      <Sidebar
        open={sideOpen}
        tests={tests}
        activeId={activeId}
        email={session.user.email}
        onClose={() => setSideOpen(false)}
        onNew={newTest}
        onSelect={selectTest}
        onDelete={removeTest}
        onSignOut={() => supabase.auth.signOut()}
      />

      <main className="main">
        <header className="top">
          <button className="pill menu" onClick={() => setSideOpen(true)}>
            History
          </button>
          <span className="brand">CheatX</span>
          <button className="pill" onClick={newTest}>
            New test
          </button>
        </header>

        <div className="scroll">
          {empty && (
            <section className="hero">
              <h1>
                Snap a question.
                <br />
                Get the answer.
              </h1>
              <p>
                Add a multiple choice question to see the correct option and how sure we are, or a coding question to get
                a solution with its output.
              </p>
            </section>
          )}

          {loadError && (
            <div className="card error">
              <p>{loadError}</p>
            </div>
          )}

          <div className="feed">
            {items.map((it) => (it.kind === "code" ? <CodeCard key={it.id} item={it} /> : <ItemCard key={it.id} item={it} />))}

            {pending && (
              <div className="item">
                {pending.image && (
                  <div className="shot">
                    <img src={pending.image} alt="Captured question" />
                    {busy && <div className="scan" />}
                  </div>
                )}
                {pending.question && <p className="question clamp">{pending.question}</p>}
                {busy && (
                  <div className="status">
                    <span className="dot" />
                    {STAGES[pending.stage]}
                  </div>
                )}
                {pending.error && (
                  <div className="card error">
                    <p>{pending.error}</p>
                    <button className="btn" onClick={() => setPending(null)}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={endRef} />
        </div>

        <footer className="dock">
          <button className="btn primary add" disabled={busy} onClick={() => setAdding(true)}>
            <PlusIcon />
            Add question
          </button>
        </footer>

        {adding && <AddSheet onClose={() => setAdding(false)} onMcq={handleMcq} onCode={handleCode} />}
      </main>
    </div>
  );
}
