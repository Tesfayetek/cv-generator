import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { app } from '../firebase';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export function validateImageFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const validExt =
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp');
  if (!ACCEPTED_MIME_TYPES.has(file.type) && !validExt) {
    return 'Unsupported format. Please upload JPG, JPEG, PNG, or WebP.';
  }
  if (file.size > 12 * 1024 * 1024) {
    return 'Image file is larger than 12 MB. Please select a smaller image.';
  }
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = src;
  });
}

export interface ProcessImageOptions {
  maxDimension?: number;
  rotation?: number; // 0, 90, 180, 270 or arbitrary deg
  cropZoom?: number; // >= 1
  cropOffsetX?: number; // -50 to 50 %
  cropOffsetY?: number; // -50 to 50 %
  preserveTransparency?: boolean;
  removeBackground?: boolean;
  bgThreshold?: number; // 15..95
}

/**
 * Removes solid or near-uniform studio backgrounds by sampling edge corners
 * and clearing connected/matching pixels with smooth edge feathering.
 */
export async function stripImageBackground(
  dataUrl: string,
  threshold = 42
): Promise<string> {
  const img = await loadHtmlImage(dataUrl);
  const maxDim = 640;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample 4 corners to estimate dominant backdrop color
  const sampleCoords = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
  ];
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  for (const [sx, sy] of sampleCoords) {
    const x = Math.max(0, Math.min(w - 1, sx));
    const y = Math.max(0, Math.min(h - 1, sy));
    const idx = (y * w + x) * 4;
    if (data[idx + 3] > 20) {
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count += 1;
    }
  }
  if (count === 0) return dataUrl;
  const bgR = rSum / count;
  const bgG = gSum / count;
  const bgB = bSum / count;

  // Flood-fill from border pixels so interior white details (e.g. collar/eyes) stay intact
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const colorDist = (pixelIdx: number) => {
    const o = pixelIdx * 4;
    const dr = data[o] - bgR;
    const dg = data[o + 1] - bgG;
    const db = data[o + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    if (colorDist(p) <= threshold * 1.45) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryEnqueue(0, y);
    tryEnqueue(w - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);
    const dist = colorDist(curr);
    const o = curr * 4;
    if (dist <= threshold) {
      data[o + 3] = 0;
    } else {
      const feather = Math.min(1, (dist - threshold) / (threshold * 0.45));
      data[o + 3] = Math.round(data[o + 3] * feather);
    }
    tryEnqueue(cx + 1, cy);
    tryEnqueue(cx - 1, cy);
    tryEnqueue(cx, cy + 1);
    tryEnqueue(cx, cy - 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Compresses, crops, and rotates an image safely under ~150KB for instant preview,
 * Firestore persistence, and vector PDF/DOCX embedding.
 */
export async function processImageToDataUrl(
  src: string,
  options: ProcessImageOptions = {}
): Promise<string> {
  let workingSrc = src;
  if (options.removeBackground) {
    workingSrc = await stripImageBackground(src, options.bgThreshold ?? 42);
  }

  const img = await loadHtmlImage(workingSrc);
  const maxDim = options.maxDimension || 640;
  const rotation = ((options.rotation || 0) * Math.PI) / 180;
  const zoom = Math.max(1, options.cropZoom || 1);
  const offX = options.cropOffsetX || 0;
  const offY = options.cropOffsetY || 0;

  const targetScale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const outW = Math.max(1, Math.round(img.width * targetScale));
  const outH = Math.max(1, Math.round(img.height * targetScale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return workingSrc;

  ctx.clearRect(0, 0, outW, outH);
  ctx.save();
  ctx.translate(outW / 2 + (offX / 100) * outW, outH / 2 + (offY / 100) * outH);
  ctx.rotate(rotation);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -outW / 2, -outH / 2, outW, outH);
  ctx.restore();

  const usePng = Boolean(options.preserveTransparency || options.removeBackground || workingSrc.startsWith('data:image/png'));
  let result = usePng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);

  // Enforce <160KB size budget when falling back to Data URL persistence
  if (result.length > 165_000) {
    result = canvas.toDataURL('image/jpeg', 0.72);
  }
  return result;
}

/**
 * Uploads processed asset to Firebase Storage if reachable, cleanly falling back
 * to the compressed Data URL so cover pages always work regardless of bucket CORS.
 */
export async function uploadCoverImageAsset(
  userId: string,
  assetKey: string,
  dataUrl: string
): Promise<string> {
  if (!userId || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  try {
    const storage = getStorage(app);
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const path = `users/${userId}/cover-assets/${assetKey}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);

    const uploadPromise = (async () => {
      await uploadString(storageRef, dataUrl, 'data_url');
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 3500)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch {
    // Seamless fallback to compressed Data URL so asset upload never blocks the user
    return dataUrl;
  }
}
