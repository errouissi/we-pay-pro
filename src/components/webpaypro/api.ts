// Replace this with your deployed Google Apps Script Web App URL.
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPboQLtXsHhS3QTP5b-8_mKkh6pTQMfGaKAHeiVMa1uJ83ydzPPQaRzjy9JmnJK1um6A/exec";

export type LoggedUser = {
  user_id: string;
  name: string;
  username: string;
};

export type ClientRow = {
  timestamp: string;
  client_id: string;
  nom: string;
  prenom: string;
  cin: string;
  ville: string;
  telephone: string;
  operator: string;
  cin_recto_link: string;
  cin_verso_link: string;
  piece_jointe_link: string;
  created_by_user_id: string;
  created_by_name: string;
};

// Google Apps Script Web Apps don't accept custom headers without triggering
// a CORS preflight, so we send a plain text body that the script JSON.parses.
export async function callScript<T = any>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Network error");
  return (await res.json()) as T;
}

export function fileToBase64(file: File): Promise<{ name: string; type: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ name: file.name, type: file.type, base64 });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const STORAGE_KEY = "wpp_user";

export function getStoredUser(): LoggedUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoggedUser) : null;
  } catch {
    return null;
  }
}