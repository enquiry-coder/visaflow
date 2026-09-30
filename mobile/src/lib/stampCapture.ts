import { Platform } from 'react-native';

export interface StampMeta {
  matchedBy: string;
  clientName: string;
  regNo: string;
  matchedAt: string; // ISO string
}

/**
 * Format an ISO datetime into "Hong Kong time (UTC+8)" local wall-clock text.
 * We do NOT rely on the device zone — staff and clients span many zones — so we
 * render the fixed office zone (Asia/Hong_Kong, UTC+8 always, no DST).
 */
function hkTime(iso: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  return new Intl.DateTimeFormat('en-HK', opts).format(d);
}

/**
 * Burn a "MATCHED" evidence stamp (badge + timestamp + staff + client) INTO the
 * pixels of a Zoom capture image. Returns a new PNG as a data URL so the result
 * can be uploaded to Storage and printed as a single self-contained image.
 *
 * Web only — uses an offscreen <canvas>. On native this throws a clear error so
 * the caller can fall back to storing the raw capture.
 */
export async function stampCapture(
  imageUrl: string,
  meta: StampMeta,
): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new Error('Image stamping requires the web app (canvas).');
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Canvas is not available in this environment.');
  }

  // 1. Load the image as a raw bitmap.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load the capture image.'));
    el.src = imageUrl;
  });

  // 2. Canvas sized to the NATURAL image dimensions so nothing is downscaled.
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 3. Draw a semi-transparent footer band at the bottom.
  const bandH = Math.max(64, Math.round(canvas.height * 0.09));
  const y = canvas.height - bandH;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, y, canvas.width, bandH);

  // 4. "MATCHED" badge on the left.
  const fs = Math.max(18, Math.round(bandH * 0.38));
  ctx.font = `700 ${fs}px sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const badge = '\u2713 MATCHED';
  const badgeW = ctx.measureText(badge).width;
  const badgeColor = '#22c55e'; // green
  // rounded badge behind text
  const bx = 16;
  const by = y + Math.round((bandH - fs) / 2);
  const bh = Math.round(fs * 1.55);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, bx - 8, by - Math.round(fs * 0.28), badgeW + 16, bh, 8);
  ctx.fill();
  ctx.fillStyle = badgeColor;
  ctx.fillText(badge, bx, by + fs);

  // 5. Timestamp + staff + client on the right side of the band.
  const lineFs = Math.max(12, Math.round(bandH * 0.24));
  const line1 = hkTime(meta.matchedAt) + ' (Hong Kong time, UTC+8)';
  const line2 = `Matched by ${meta.matchedBy} \u00b7 ${meta.clientName} \u00b7 ${meta.regNo}`;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${lineFs}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(line1, canvas.width - 16, y + Math.round(bandH * 0.36));
  ctx.fillText(line2, canvas.width - 16, y + Math.round(bandH * 0.72));
  ctx.textAlign = 'left';

  // 6. Export as PNG data URL.
  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
