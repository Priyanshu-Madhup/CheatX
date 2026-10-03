import { useState } from "react";

export default function ItemCard({ item }) {
  const [open, setOpen] = useState(false);
  const chosen = item.options.find((o) => o.id === item.choice);
  const pct = (id) => Math.round((item.probabilities?.[id] ?? 0) * 100);
  const sorted = [...item.options].sort((a, b) => (item.probabilities?.[b.id] ?? 0) - (item.probabilities?.[a.id] ?? 0));

  return (
    <article className="item">
      <p className="question">{item.question}</p>
      <div className="answer">
        <div className="label">Correct answer</div>
        <div className="answer-main">
          <span className="badge">{item.choice}</span>
          <span className="answer-text">{chosen?.text}</span>
        </div>
        <div className="conf">{pct(item.choice)}% likely</div>
      </div>
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? "Hide option scores" : "Show option scores"}
      </button>
      {open && (
        <ul className="options">
          {sorted.map((o) => (
            <li key={o.id} className={o.id === item.choice ? "win" : ""}>
              <div className="row">
                <span className="opt-id">{o.id}</span>
                <span className="opt-text">{o.text}</span>
                <span className="opt-pct">{pct(o.id)}%</span>
              </div>
              <div className="bar">
                <i style={{ width: `${Math.max(pct(o.id), 1)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
