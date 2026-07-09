// Shared client-side image compression before base64 upload. Resizes to a
// max dimension and re-encodes as JPEG via canvas — used by every upload
// form to keep the Apps Script JSON/base64 request payload small. PDFs and
// GIFs pass through unchanged (canvas re-encoding would flatten GIF
// animation). Falls back to the original file on any failure or if
// compression doesn't actually shrink it.
export type CompressImageOptions = {
  maxDimension?: number;
  quality?: number;
};

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_QUALITY = 0.75;

export async function compressImageFile(
  file: File,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY }: CompressImageOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const targetWidth = Math.round(img.naturalWidth * scale);
    const targetHeight = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
