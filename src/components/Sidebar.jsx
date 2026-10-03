export default function Sidebar({ open, tests, activeId, email, onClose, onNew, onSelect, onDelete, onSignOut }) {
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="side-top">
          <span className="brand">CheatX</span>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>

        <button className="btn primary new" onClick={onNew}>
          New test
        </button>

        <div className="label side-label">History</div>
        <nav className="history">
          {tests.length === 0 && <p className="empty">No tests yet.</p>}
          {tests.map((t) => (
            <div key={t.id} className={`hist-row ${t.id === activeId ? "active" : ""}`}>
              <button className="hist-title" onClick={() => onSelect(t.id)}>
                <span>{t.title}</span>
                <small>{new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
              </button>
              <button
                className="hist-del"
                aria-label="Delete test"
                onClick={() => window.confirm("Delete this test and its answers?") && onDelete(t.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <span className="email">{email}</span>
          <button className="link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
