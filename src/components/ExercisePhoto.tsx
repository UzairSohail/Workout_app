import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef } from 'react';
import { db } from '../db';

/** Object URL for the user's own photo of this exercise, if they added one. */
export function useExercisePhoto(exerciseId: string | undefined): string | undefined {
  const row = useLiveQuery(() => (exerciseId ? db.exercisePhotos.get(exerciseId) : undefined), [exerciseId]);
  const url = useMemo(() => (row ? URL.createObjectURL(row.photo) : undefined), [row]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

/** Shrinks a camera photo to at most `max` px on the long side so it doesn't eat phone storage. */
async function shrink(file: File, max = 1000): Promise<Blob> {
  const img = new Image();
  const src = URL.createObjectURL(file);
  try {
    img.src = src;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82));
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Add / replace / remove the user's own photo for an exercise. */
export function PhotoControls({ exerciseId, hasPhoto }: { exerciseId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    await db.exercisePhotos.put({ exerciseId, photo: await shrink(file), updatedAt: Date.now() });
  };
  return (
    <div className="row">
      <input ref={input} type="file" accept="image/*" hidden aria-label="Exercise photo"
        onChange={(e) => { pick(e.target.files?.[0]).catch(() => alert("Couldn't save that photo.")); e.target.value = ''; }} />
      <button className="secondary grow" onClick={() => input.current?.click()}>📷 {hasPhoto ? 'Replace your photo' : 'Add your own photo'}</button>
      {hasPhoto && <button className="ghost danger" onClick={() => db.exercisePhotos.delete(exerciseId)}>Remove</button>}
    </div>
  );
}
