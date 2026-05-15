export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export function validateFile(file: File | null): string | null {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Format non accepté. Veuillez importer une image ou un PDF.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Le fichier ne doit pas dépasser 10 MB.";
  }
  return null;
}
