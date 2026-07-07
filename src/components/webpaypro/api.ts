// Replace this with your deployed Google Apps Script Web App URL.
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4nyvKPAdToMaYSjW6xpWdlQ76SmQpDOAHtw7rJyQFYuiVn1Ejto8Yu2Xv3Q4jUmQXLA/exec";

export type LoggedUser = {
  user_id: string;
  name: string;
  username: string;
  role?: "admin" | "commercial";
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

export type AgentRow = {
  created_at: string;
  created_by_user_id: string;
  created_by_username: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  type_agent: string;
  document_photo_url: string;
  cin_recto_url: string;
  cin_verso_url: string;
  local_photo_url: string;
  latitude: string;
  longitude: string;
  localisation_link: string;
  agent_pdf_url: string;
};

export type WafacashRow = {
  created_at: string;
  wafacash_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
  latitude: string;
  longitude: string;
  localisation_link: string;
  cin_recto_url: string;
  cin_verso_url: string;
  created_by_user_id: string;
  created_by_username: string;
};

/** @deprecated use WafacashRow — kept as a backward-compatible alias. */
export type CacheRow = WafacashRow;

export type UserRow = {
  user_id: string;
  username: string;
  name: string;
  role: "admin" | "commercial";
  status: string;
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

type FileUpload = { name: string; type: string; base64: string };

export async function createAgent(
  user: LoggedUser,
  data: {
    nom: string;
    prenom: string;
    telephone: string;
    email: string;
    typeAgent: "agence" | "détaillant";
    latitude: number;
    longitude: number;
    localisationLink: string;
    photoDocument: FileUpload;
    cinRecto: FileUpload;
    cinVerso: FileUpload;
    photoLocal: FileUpload;
  },
): Promise<{ success: boolean; message?: string }> {
  return callScript({
    action: "createAgent",
    userId: user.user_id,
    userName: user.username,
    ...data,
  });
}

export async function getAgents(
  user: LoggedUser,
): Promise<{ success: boolean; agents?: AgentRow[]; message?: string }> {
  return callScript({ action: "getAgents", userId: user.user_id });
}

export async function createWafacash(
  user: LoggedUser,
  data: {
    nom: string;
    prenom: string;
    telephone: string;
    adresse: string;
    latitude: number;
    longitude: number;
    localisationLink: string;
    cinRecto: FileUpload;
    cinVerso: FileUpload;
  },
): Promise<{ success: boolean; message?: string }> {
  return callScript({
    action: "createWafacash",
    userId: user.user_id,
    userName: user.username,
    ...data,
  });
}

/** @deprecated use createWafacash — kept as a backward-compatible alias. */
export async function createCache(
  user: LoggedUser,
  data: {
    nom: string;
    prenom: string;
    telephone: string;
    adresse: string;
    latitude: number;
    longitude: number;
    localisationLink: string;
    cinRecto: FileUpload;
    cinVerso: FileUpload;
  },
): Promise<{ success: boolean; message?: string }> {
  return createWafacash(user, data);
}

export async function getWafacash(
  user: LoggedUser,
): Promise<{ success: boolean; wafacash?: WafacashRow[]; message?: string }> {
  return callScript({
    action: "getWafacash",
    userId: user.user_id,
  });
}

export async function createUser(
  requester: LoggedUser,
  data: {
    username: string;
    password: string;
    name: string;
  },
): Promise<{ success: boolean; message?: string; user_id?: string }> {
  return callScript({
    action: "createUser",
    requesterId: requester.user_id,
    role: "commercial",
    ...data,
  });
}

export async function getUsers(
  requester: LoggedUser,
): Promise<{ success: boolean; users?: UserRow[]; message?: string }> {
  return callScript({ action: "getUsers", requesterId: requester.user_id });
}

export async function updateUser(
  requester: LoggedUser,
  data: {
    user_id: string;
    username: string;
    name: string;
    status: "active" | "blocked";
    password?: string;
  },
): Promise<{ success: boolean; message?: string }> {
  return callScript({
    action: "updateUser",
    requesterId: requester.user_id,
    ...data,
  });
}
