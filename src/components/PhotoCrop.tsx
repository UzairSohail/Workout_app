import { useEffect, useRef, useState } from 'react';
import { XIcon } from './Icons';

const VIEW = 280; // size of the crop circle on screen, in CSS px
const OUT = 256; // saved picture size, in px

/**
 * Full-screen cropper for a profile photo: drag to move, pinch or use the slider to zoom.
 * The circle shows exactly what's kept; it saves a small square JPEG (shown as a circle everywhere).
 */
export function PhotoCrop({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // At zoom 1 the photo's short side fills the circle.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : 0;
  const h = img ? img.naturalHeight * base * zoom : 0;
  // Keep the circle covered: the photo can't be dragged past its edges.
  const clamp = (p: { x: number; y: number }, z = zoom) => {
    if (!img) return p;
    const mx = (img.naturalWidth * base * z - VIEW) / 2;
    const my = (img.naturalHeight * base * z - VIEW) / 2;
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  };
  const setZoomClamped = (z: number) => {
    const nz = Math.max(1, Math.min(4, z));
    setZoom(nz);
    setPos((p) => clamp(p, nz));
  };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      setZoomClamped(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
    } else if (pointers.current.size === 1) {
      setPos((p) => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
    }
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext('2d')!;
    const k = OUT / VIEW;
    ctx.drawImage(img, (VIEW / 2 + pos.x - w / 2) * k, (VIEW / 2 + pos.y - h / 2) * k, w * k, h * k);
    onSave(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div className="modal crop-modal" role="dialog" aria-modal="true" aria-label="Crop your photo">
      <div className="modal-head">
        <h2>Move and zoom</h2>
        <button className="icon-btn" onClick={onCancel} aria-label="Cancel"><XIcon /></button>
      </div>
      <div className="crop-stage" style={{ width: VIEW, height: VIEW }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {img && (
          <img src={img.src} alt="" draggable={false}
            style={{ width: w, height: h, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }} />
        )}
        <div className="crop-ring" />
      </div>
      <label className="crop-zoom">
        <span>Zoom</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomClamped(Number(e.target.value))} />
      </label>
      <button className="wide" onClick={save} disabled={!img}>Use this photo</button>
    </div>
  );
}
