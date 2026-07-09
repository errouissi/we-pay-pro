export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Client/Agent/Wafacash uploads are compressed client-side before base64,
// but this caps the post-compression (or PDF, uncompressed) size so the
// Apps Script request payload stays small. See imageCompression.ts.
export const MAX_COMPRESSED_FILE_SIZE_MB = 3;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export function validateFile(file: File | null, maxSizeMB: number = MAX_FILE_SIZE_MB): string | null {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Format non accepté. Veuillez importer une image ou un PDF.";
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `Le fichier ne doit pas dépasser ${maxSizeMB} MB.`;
  }
  return null;
}
