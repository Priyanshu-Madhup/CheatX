import { useRef, useState } from "react";
import { fileToDataUrl } from "../lib/image.js";
import ManualSheet from "./ManualSheet.jsx";
import VoiceSheet from "./VoiceSheet.jsx";
import { CameraIcon, CodeIcon, ListIcon, MicIcon, TypeIcon, UploadIcon } from "./Icons.jsx";

const LANGS = ["Auto", "Python", "JavaScript", "Java", "C++", "C"];
const MAX_IMAGES = 3; // Groq vision limit per request

function Languages({ value, onChange }) {
  return (
    <div className="chips">
      {LANGS.map((l) => (
        <button key={l} type="button" className={`chip ${value === l ? "on" : ""}`} onClick={() => onChange(l)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export default function AddSheet({ onClose, onMcq, onCode }) {
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);
  const audioRef = useRef(null);

  const [type, setType] = useState(null); // "mcq" | "code"
  const [view, setView] = useState("type"); // type | input | manual | voice | codetext | images
  const [images, setImages] = useState([]);
  const [language, setLanguage] = useState("Auto");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const isCode = type === "code";

  function pickType(t) {
    setType(t);
    setView("input");
  }

  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setError("");
    if (!isCode) return onMcq({ kind: "image", file: files[0] });
    try {
      const urls = await Promise.all(files.slice(0, MAX_IMAGES).map((f) => fileToDataUrl(f)));
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
      setView("images");
    } catch (err) {
      setError(err.message);
    }
  }

  const sendVoice = (blob, filename) =>
    isCode ? onCode({ voice: { blob, filename }, language }) : onMcq({ kind: "voice", blob, filename });

  function startVoice() {
    // Microphone capture needs HTTPS; on plain http (LAN dev) fall back to the phone recorder.
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) setView("voice");
    else audioRef.current.click();
  }

  if (view === "manual") return <ManualSheet onClose={() => setView("input")} onSubmit={(q) => onMcq({ kind: "manual", q })} />;
  if (view === "voice") return <VoiceSheet onClose={() => setView("input")} onDone={sendVoice} />;

  const back = view === "type" ? null : view === "input" ? () => setView("type") : () => setView("input");
  const title = view === "type" ? "Add question" : view === "input" ? (isCode ? "Coding question" : "Multiple choice") : "Coding question";

  return (
    <div className="sheet-wrap">
      <div className="scrim show" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-head">
          {back ? (
            <button className="link" onClick={back}>
              Back
            </button>
          ) : (
            <span className="label">{title}</span>
          )}
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>
        {back && <div className="label sheet-title">{title}</div>}

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
        <input ref={uploadRef} type="file" accept="image/*" multiple={isCode} hidden onChange={onFiles} />
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          capture
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) sendVoice(f, f.name || "speech.m4a");
          }}
        />

        {view === "type" && (
          <div className="choice-grid">
            <button className="choice" onClick={() => pickType("mcq")}>
              <ListIcon />
              <b>Multiple choice</b>
              <small>Pick the correct option</small>
            </button>
            <button className="choice" onClick={() => pickType("code")}>
              <CodeIcon />
              <b>Coding</b>
              <small>Get a solution and its output</small>
            </button>
          </div>
        )}

        {view === "input" && (
          <div className="tiles">
            <button className="tile" onClick={() => cameraRef.current.click()}>
              <CameraIcon />
              <span>Photo</span>
            </button>
            <button className="tile" onClick={() => uploadRef.current.click()}>
              <UploadIcon />
              <span>{isCode ? "Images" : "Upload"}</span>
            </button>
            <button className="tile" onClick={() => setView(isCode ? "codetext" : "manual")}>
              <TypeIcon />
              <span>Type</span>
            </button>
            <button className="tile" onClick={startVoice}>
              <MicIcon />
              <span>Voice</span>
            </button>
          </div>
        )}

        {view === "codetext" && (
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) onCode({ text: text.trim(), language });
            }}
          >
            <textarea
              className="field"
              rows={6}
              placeholder="Describe or paste the coding question"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <Languages value={language} onChange={setLanguage} />
            <button className="btn primary" disabled={!text.trim()}>
              Solve
            </button>
          </form>
        )}

        {view === "images" && (
          <div className="stack-form">
            <div className="thumbs">
              {images.map((src, i) => (
                <div className="thumb" key={i}>
                  <img src={src} alt={`Page ${i + 1}`} />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => {
                      const next = images.filter((_, j) => j !== i);
                      setImages(next);
                      if (!next.length) setView("input");
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <>
                  <button type="button" className="thumb add" aria-label="Take another photo" onClick={() => cameraRef.current.click()}>
                    <CameraIcon />
                  </button>
                  <button type="button" className="thumb add" aria-label="Upload more images" onClick={() => uploadRef.current.click()}>
                    <UploadIcon />
                  </button>
                </>
              )}
            </div>
            <p className="hint">Up to {MAX_IMAGES} images, read in order as one question.</p>
            <Languages value={language} onChange={setLanguage} />
            <button className="btn primary" onClick={() => onCode({ images, language })}>
              Solve
            </button>
          </div>
        )}

        {error && <div className="form-msg bad">{error}</div>}
      </div>
    </div>
  );
}
