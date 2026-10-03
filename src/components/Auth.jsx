import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Auth() {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: err } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) return setError(err.message);
    if (mode === "up" && !data.session) setNotice("Check your email to confirm your account, then sign in.");
  }

  return (
    <main className="auth">
      <span className="brand">CheatX</span>
      <h1>{mode === "in" ? "Welcome back." : "Create your account."}</h1>
      <p className="sub">Your tests and answers are saved to your account.</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="form-msg bad">{error}</div>}
        {notice && <div className="form-msg">{notice}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Please wait" : mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <button
        className="link center"
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError("");
          setNotice("");
        }}
      >
        {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
