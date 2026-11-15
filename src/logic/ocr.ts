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

export interface OcrProgress {
  /** 0–1 across the whole job: getting the reader ready, then every image. */
  value: number;
  /** What is happening now, in plain words. */
  stage: string;
}

/** Share of the bar used for downloading and starting the reader (fast once cached). */
const SETUP = 0.15;

/** Reads the text in each image, in order, reporting progress for the whole job. */
export async function readText(files: Blob[], onProgress?: (p: OcrProgress) => void): Promise<string> {
  const report = (value: number, stage: string) => onProgress?.({ value: Math.min(1, Math.max(0, value)), stage });
  const many = files.length > 1;
  const label = (i: number) => (many ? `Reading screenshot ${i + 1} of ${files.length}` : 'Reading the screenshot');
  report(0, 'Getting the reader ready');
  const { createWorker } = await import('tesseract.js');
  let current = 0;
  let recognizing = false;
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        recognizing = true;
        report(SETUP + ((1 - SETUP) * (current + m.progress)) / files.length, label(current));
      } else if (!recognizing && /loading|initializ/.test(m.status)) {
        // Engine and English data: only slow the first time, while they download.
        const downloading = /loading/.test(m.status) && m.progress < 1;
        report(SETUP * (/language/.test(m.status) ? 0.4 + 0.6 * m.progress : 0.4 * m.progress), downloading ? 'Downloading the reader (first time only)' : 'Getting the reader ready');
      }
    },
  });
  try {
    const parts: string[] = [];
    for (const f of files) {
      recognizing = false;
      report(SETUP + ((1 - SETUP) * current) / files.length, label(current));
      const { data } = await worker.recognize(await prepare(f));
      parts.push(data.text);
      current++;
    }
    report(1, 'Matching exercises');
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}
