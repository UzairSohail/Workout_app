import { useEffect, useState } from 'react';
import type { Exercise } from '../types';
import { imageUrl } from '../exercises';

/** Shows the exercise's start/end photos, flipping between them like a GIF when animate is on. */
export function ExerciseImage({ exercise, animate = false, className = 'thumb' }: {
  exercise?: Exercise;
  animate?: boolean;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const images = exercise?.images ?? [];

  useEffect(() => {
    if (!animate || images.length < 2) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % images.length), 900);
    return () => clearInterval(t);
  }, [animate, images.length]);

  if (!exercise || images.length === 0 || failed) {
    return <div className={`${className} placeholder`}>{exercise?.name.charAt(0) ?? '?'}</div>;
  }
  return (
    <div className={className}>
      {images.slice(0, animate ? images.length : 1).map((p, i) => (
        <img
          key={p}
          src={imageUrl(p, fallback)}
          alt={i === 0 ? exercise.name : ''}
          loading="lazy"
          style={{ opacity: i === frame ? 1 : 0 }}
          onError={() => (fallback ? setFailed(true) : setFallback(true))}
        />
      ))}
    </div>
  );
}
