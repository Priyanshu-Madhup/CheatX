import { useState } from "react";

const LETTERS = "ABCDEFGH";
const MAX = LETTERS.length;

export default function ManualSheet({ onSubmit, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const filled = options.map((t) => t.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && filled.length >= 2;

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));

  function submit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      question: question.trim(),
      context: "",
      options: filled.map((text, i) => ({ id: LETTERS[i], text })),
    });
  }

  return (
    <div className="sheet-wrap">
      <div className="scrim show" onClick={onClose} />
      <form className="sheet" onSubmit={submit}>
        <div className="sheet-head">
          <span className="label">Type a question</span>
          <button type="button" className="link" onClick={onClose}>
            Cancel
          </button>
        </div>

        <textarea
          className="field"
          rows={3}
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          autoFocus
        />

        <div className="opt-list">
          {options.map((t, i) => (
            <div className="opt-input" key={i}>
              <span className="opt-badge">{LETTERS[i]}</span>
              <input
                className="field"
                placeholder={`Option ${LETTERS[i]}`}
                value={t}
                onChange={(e) => setOpt(i, e.target.value)}
              />
              {options.length > 2 && (
                <button type="button" className="link" onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="sheet-foot">
          {options.length < MAX ? (
            <button type="button" className="link" onClick={() => setOptions((o) => [...o, ""])}>
              Add option
            </button>
          ) : (
            <span />
          )}
          <span className={`hint ${filled.length < 2 ? "bad" : ""}`}>
            {filled.length < 2 ? "At least 2 options required" : `${filled.length} options`}
          </span>
        </div>

        <button className="btn primary" disabled={!valid}>
          Get answer
        </button>
      </form>
    </div>
  );
}
