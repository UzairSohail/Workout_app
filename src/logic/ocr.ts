/**
 * On-device text recognition for plan screenshots (Tesseract, free, no account).
 * The library is loaded only when someone imports a screenshot; the first run downloads
 * the engine and English data (a few MB) from the jsDelivr CDN, after which the browser caches them.
 */

/** Greyscale, dark text on light (plan apps are usually dark mode), and big enough for small print. */
async function prepare(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width < 1000 ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = y;
    sum += y;
  }
  if (sum / (px.length / 4) < 128) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the image'))), 'image/png'));
}

/** Reads the text in each image, in order. `onProgress` gets 0–1 across all of them. */
export async function readText(files: Blob[], onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  let current = 0;
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.((current + m.progress) / files.length);
    },
  });
  try {
    const parts: string[] = [];
    for (const f of files) {
      const { data } = await worker.recognize(await prepare(f));
      parts.push(data.text);
      current++;
      onProgress?.(current / files.length);
    }
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}
