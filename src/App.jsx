import { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "./lib/supabase.js";
import { addItem, createTest, deleteTest, listItems, listTests } from "./lib/db.js";
import { fileToDataUrl } from "./lib/image.js";
import { extractQuestion, structureSpoken, transcribeAudio } from "./lib/groq.js";
import { pickAnswer } from "./lib/wity.js";
import Auth from "./components/Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ItemCard from "./components/ItemCard.jsx";
import ManualSheet from "./components/ManualSheet.jsx";
import VoiceSheet from "./components/VoiceSheet.jsx";
import { CameraIcon, MicIcon, TypeIcon, UploadIcon } from "./components/Icons.jsx";

const STAGES = {
  reading: "Reading the question",
  transcribing: "Transcribing",
  structuring: "Structuring the question",
  deciding: "Scoring the options",
  saving: "Saving",
};
const titleOf = (q) => (q.length > 48 ? q.slice(0, 45).trim() + "..." : q);

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
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const audioRef = useRef(null);
  const endRef = useRef(null);
  const activeRef = useRef(null);

  const [tests, setTests] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [items, setItems] = useState([]);
  const [pending, setPending] = useState(null); // { image, stage, question?, error? }
  const [sheet, setSheet] = useState(null); // "manual" | "voice" | null
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

  // Shared pipeline: produce a structured question -> Wity -> save to the active test.
  async function run(image, firstStage, produce) {
    setLoadError("");
    setSheet(null);
    try {
      setPending({ image, stage: firstStage });
      const q = await produce((stage) => setPending({ image, stage }));
      setPending({ image, stage: "deciding", question: q.question });
      const r = await pickAnswer(q);
      setPending({ image, stage: "saving", question: q.question });

      let testId = activeRef.current;
      if (!testId) {
        const t = await createTest(titleOf(q.question));
        setTests((prev) => [t, ...prev]);
        testId = t.id;
        setActive(testId);
      }
      const saved = await addItem(testId, {
        question: q.question,
        context: q.context,
        options: q.options,
        choice: r.choice,
        probabilities: r.probabilities,
      });
      setItems((prev) => [...prev, saved]);
      setPending(null);
    } catch (err) {
      setPending({ image, stage: null, error: err.message || "Something went wrong." });
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let image;
    try {
      image = await fileToDataUrl(file);
    } catch (err) {
      return setPending({ image: null, stage: null, error: err.message });
    }
    run(image, "reading", () => extractQuestion(image));
  }

  const runSpeech = (blob, filename) =>
    run(null, "transcribing", async (setStage) => {
      const text = await transcribeAudio(blob, filename);
      setStage("structuring");
      return structureSpoken(text);
    });

  function handleAudioFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) runSpeech(file, file.name || "speech.m4a");
  }

  // Microphone capture needs HTTPS; on plain http (LAN dev) fall back to the phone recorder.
  function startVoice() {
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) setSheet("voice");
    else audioRef.current.click();
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
          <button className="link menu" onClick={() => setSideOpen(true)}>
            History
          </button>
          <span className="brand">CheatX</span>
          <button className="link" onClick={newTest}>
            New test
          </button>
        </header>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
        <input ref={uploadRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <input ref={audioRef} type="file" accept="audio/*" capture hidden onChange={handleAudioFile} />

        <div className="scroll">
          {empty && (
            <section className="hero">
              <h1>
                Snap a question.
                <br />
                Get the answer.
              </h1>
              <p>Photograph, type or speak a multiple choice question and see the correct option with how sure we are.</p>
            </section>
          )}

          {loadError && (
            <div className="card error">
              <p>{loadError}</p>
            </div>
          )}

          <div className="feed">
            {items.map((it) => (
              <ItemCard key={it.id} item={it} />
            ))}

            {pending && (
              <div className="item">
                {pending.image && (
                  <div className="shot">
                    <img src={pending.image} alt="Captured question" />
                    {busy && <div className="scan" />}
                  </div>
                )}
                {pending.question && <p className="question">{pending.question}</p>}
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
          <button className="btn primary" disabled={busy} aria-label="Take photo" title="Take photo" onClick={() => cameraRef.current.click()}>
            <CameraIcon />
          </button>
          <button className="btn" disabled={busy} aria-label="Upload image" title="Upload image" onClick={() => uploadRef.current.click()}>
            <UploadIcon />
          </button>
          <button className="btn" disabled={busy} aria-label="Type a question" title="Type a question" onClick={() => setSheet("manual")}>
            <TypeIcon />
          </button>
          <button className="btn" disabled={busy} aria-label="Voice" title="Voice" onClick={startVoice}>
            <MicIcon />
          </button>
        </footer>

        {sheet === "manual" && (
          <ManualSheet onClose={() => setSheet(null)} onSubmit={(q) => run(null, "deciding", async () => q)} />
        )}
        {sheet === "voice" && <VoiceSheet onClose={() => setSheet(null)} onDone={runSpeech} />}
      </main>
    </div>
  );
}
