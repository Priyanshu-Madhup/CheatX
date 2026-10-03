import { useState } from "react";

export default function CodeCard({ item }) {
  const c = item.code || {};
  const [showProblem, setShowProblem] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.code || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <article className="item">
      <div className="code-head">
        <span className="code-title">{c.title || "Solution"}</span>
        {c.language && <span className="lang">{c.language}</span>}
      </div>

      <button className="link" onClick={() => setShowProblem(!showProblem)}>
        {showProblem ? "Hide question" : "Show question"}
      </button>
      {showProblem && <p className="question prewrap">{item.question}</p>}

      <div className="codebox">
        <div className="codebox-bar">
          <span className="label">Code</span>
          <button className="link" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre>
          <code>{c.code}</code>
        </pre>
      </div>

      {(c.output || c.input) && (
        <div className="codebox out">
          <div className="codebox-bar">
            <span className="label">Sample output</span>
          </div>
          {c.input && (
            <pre className="io">
              <span className="io-label">Input</span>
              {c.input}
            </pre>
          )}
          <pre className="io">
            <span className="io-label">Output</span>
            {c.output || "(no output)"}
          </pre>
          <p className="note">Traced by the model, not executed. Run the code to confirm.</p>
        </div>
      )}

      {c.explanation && <p className="explain">{c.explanation}</p>}
    </article>
  );
}
