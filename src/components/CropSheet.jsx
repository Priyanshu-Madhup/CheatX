import { useRef, useState } from "react";
import { cropDataUrl } from "../lib/image.js";

const MIN = 0.08; // smallest crop side, as a fraction of the image
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function CropSheet({ src, index = 0, total = 1, onDone, onCancel }) {
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const [box, setBox] = useState({ x: 0.04, y: 0.04, w: 0.92, h: 0.92 });
  const [busy, setBusy] = useState(false);

  function start(e, mode) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, rect: wrapRef.current.getBoundingClientRect(), box };
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.rect.width;
    const dy = (e.clientY - d.sy) / d.rect.height;
    let { x, y, w, h } = d.box;
    if (d.mode === "move") {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      if (d.mode.includes("w")) {
        const nx = clamp(x + dx, 0, x + w - MIN);
        w += x - nx;
        x = nx;
      }
      if (d.mode.includes("e")) w = clamp(w + dx, MIN, 1 - x);
      if (d.mode.includes("n")) {
        const ny = clamp(y + dy, 0, y + h - MIN);
        h += y - ny;
        y = ny;
      }
      if (d.mode.includes("s")) h = clamp(h + dy, MIN, 1 - y);
    }
    setBox({ x, y, w, h });
  }

  const end = () => {
    drag.current = null;
  };

  async function finish(full) {
    setBusy(true);
    try {
      onDone(await cropDataUrl(src, full ? { x: 0, y: 0, w: 1, h: 1 } : box));
    } catch {
      setBusy(false);
    }
  }

  const pct = (v) => `${v * 100}%`;
  const style = { left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) };
  const events = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  return (
    <div className="crop">
      <div className="crop-head">
        <span className="label">Crop to the question{total > 1 ? ` · ${index + 1} of ${total}` : ""}</span>
        <button className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <div className="crop-stage">
        <div className="crop-wrap" ref={wrapRef}>
          <img src={src} alt="To crop" draggable={false} />
          <div className="crop-clip">
            <div className="crop-dim" style={style} />
          </div>
          <div className="crop-box" style={style} onPointerDown={(e) => start(e, "move")} {...events}>
            {HANDLES.map((h) => (
              <span key={h} className={`h ${h}`} onPointerDown={(e) => start(e, h)} {...events} />
            ))}
          </div>
        </div>
      </div>

      <p className="hint center">Drag the corners or edges to frame it. Several questions in one shot are all picked up.</p>

      <div className="crop-actions">
        <button className="btn" disabled={busy} onClick={() => finish(true)}>
          Use full image
        </button>
        <button className="btn primary" disabled={busy} onClick={() => finish(false)}>
          Crop
        </button>
      </div>
    </div>
  );
}
