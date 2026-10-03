import { useRef, useState } from "react";
import { fileToDataUrl } from "./lib/image.js";
import { extractQuestion } from "./lib/groq.js";
import { pickAnswer } from "./lib/wity.js";

const STAGES = { reading: "Reading the question", deciding: "Scoring the options" };

export default function App() {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const [image, setImage] = useState(null);
  const [stage, setStage] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const reset = () => {
    setImage(null);
    setStage(null);
    setExtracted(null);
    setResult(null);
    setError("");
  };

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      setStage("reading");
      const q = await extractQuestion(dataUrl);
      setExtracted(q);
      setStage("deciding");
      const r = await pickAnswer(q);
      setResult(r);
      setStage(null);
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setStage(null);
    }
  }

  const sorted = extracted
    ? [...extracted.options].sort(
        (a, b) => (result?.probabilities?.[b.id] ?? 0) - (result?.probabilities?.[a.id] ?? 0)
      )
    : [];
  const busy = Boolean(stage);

  return (
    <main className="app">
      <header className="top">
        <span className="brand">CheatX</span>
        {image && !busy && (
          <button className="link" onClick={reset}>
            New
          </button>
        )}
      </header>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {!image && (
        <section className="hero">
          <h1>
            Snap a question.
            <br />
            Get the answer.
          </h1>
          <p>Photograph or upload a multiple choice question and see the correct option with how sure we are.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => cameraRef.current.click()}>
              Take photo
            </button>
            <button className="btn" onClick={() => uploadRef.current.click()}>
              Upload image
            </button>
          </div>
        </section>
      )}

      {image && (
        <section className="stack">
          <div className="shot">
            <img src={image} alt="Captured question" />
            {busy && <div className="scan" />}
          </div>

          {busy && (
            <div className="status">
              <span className="dot" />
              {STAGES[stage]}
            </div>
          )}

          {error && (
            <div className="card error">
              <p>{error}</p>
              <button className="btn" onClick={reset}>
                Try again
              </button>
            </div>
          )}

          {extracted && (
            <div className="card">
              <div className="label">Question</div>
              <p className="question">{extracted.question}</p>
            </div>
          )}

          {extracted && result && (
            <>
              <div className="answer">
                <div className="label">Correct answer</div>
                <div className="answer-main">
                  <span className="badge">{result.choice}</span>
                  <span className="answer-text">
                    {extracted.options.find((o) => o.id === result.choice)?.text}
                  </span>
                </div>
                <div className="conf">
                  {Math.round((result.probabilities[result.choice] ?? 0) * 100)}% likely
                </div>
              </div>

              <div className="card">
                <div className="label">Option scores</div>
                <ul className="options">
                  {sorted.map((o) => {
                    const p = result.probabilities[o.id] ?? 0;
                    const win = o.id === result.choice;
                    return (
                      <li key={o.id} className={win ? "win" : ""}>
                        <div className="row">
                          <span className="opt-id">{o.id}</span>
                          <span className="opt-text">{o.text}</span>
                          <span className="opt-pct">{Math.round(p * 100)}%</span>
                        </div>
                        <div className="bar">
                          <i style={{ width: `${Math.max(p * 100, 1)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button className="btn primary" onClick={() => cameraRef.current.click()}>
                Scan another
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
