// Shrinks photos before they're stored. Images are saved inside Firestore
// documents as data URLs, and a document can be at most 1 MiB, so a full-size
// camera photo (often 1–3 MB) made the whole save fail.

/** Longest side, in pixels, for receipt photos. */
export const RECEIPT_MAX_SIDE = 1024;
/** Longest side, in pixels, for profile pictures. */
export const AVATAR_MAX_SIDE = 400;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });

/** Draw a video frame or image scaled so its longest side is at most `maxSide`, as a JPEG data URL. */
export const drawScaledJpeg = (
  source: HTMLVideoElement | HTMLImageElement,
  maxSide: number,
  quality = 0.7,
): string => {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

/** Shrink an image data URL. */
export const compressDataUrl = async (dataUrl: string, maxSide: number, quality = 0.7) =>
  drawScaledJpeg(await loadImage(dataUrl), maxSide, quality);

/** Read an image file and shrink it. */
export const compressImageFile = (file: File, maxSide: number, quality = 0.7) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => compressDataUrl(reader.result as string, maxSide, quality).then(resolve, reject);
    reader.readAsDataURL(file);
  });
