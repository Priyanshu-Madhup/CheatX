import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120;

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return "";
}

export default function VoiceSheet({ onDone, onClose }) {
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelledRef = useRef(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  useEffect(() => {
    let timer;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = pickMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recRef.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (cancelledRef.current) return;
          const type = rec.mimeType || mime || "audio/webm";
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          onDone(new Blob(chunksRef.current, { type }), `speech.${ext}`);
        };
        rec.start();
        setLive(true);
        timer = setInterval(() => {
          setSeconds((s) => {
            if (s + 1 >= MAX_SECONDS) rec.state === "recording" && rec.stop();
            return s + 1;
          });
        }, 1000);
      } catch {
        setError("Microphone access was blocked. Allow it in your browser settings and try again.");
      }
    })();
    return () => {
      clearInterval(timer);
      cancelledRef.current = true;
      if (recRef.current?.state === "recording") recRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="sheet-wrap">
      <div className="scrim show" onClick={onClose} />
      <div className="sheet voice">
        <div className="sheet-head">
          <span className="label">Voice</span>
          <button className="link" onClick={onClose}>
            Cancel
          </button>
        </div>

        {error ? (
          <p className="form-msg bad">{error}</p>
        ) : (
          <>
            <div className={`pulse ${live ? "on" : ""}`} />
            <div className="timer">{mmss}</div>
            <p className="hint center">Say the question, then each option.</p>
            <button className="btn primary" disabled={!live} onClick={() => recRef.current?.stop()}>
              Stop and send
            </button>
          </>
        )}
      </div>
    </div>
  );
}
