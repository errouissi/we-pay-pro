import { useState } from "react";
import { callScript, STORAGE_KEY, type LoggedUser } from "./api";
import { AlertMessage } from "./AlertMessage";

type Props = { onLoggedIn: (u: LoggedUser) => void };

export function LoginPage({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await callScript<{ success: boolean; user?: LoggedUser; message?: string }>({
        action: "login",
        username,
        password,
      });
      if (res.success && res.user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
        onLoggedIn(res.user);
      } else {
        setError("Identifiants incorrects. Veuillez réessayer.");
      }
    } catch {
      setError("Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#003C18] via-[#00562B] to-[#2F9E32] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#B7F000] text-2xl font-black text-[#003C18] shadow-lg">
            W
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">We Pay Pro</h1>
          <p className="mt-1 text-sm text-[#B7F000]">Espace interne</p>
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#003C18]">
                Nom d’utilisateur
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-[#C8D0C4] bg-white px-3 py-2.5 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[#003C18]">
                Mot de passe
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#C8D0C4] bg-white px-3 py-2.5 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
              />
            </div>
            {error && <AlertMessage type="error">{error}</AlertMessage>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2F9E32] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00562B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-white/70">
          © {new Date().getFullYear()} We Pay Pro — Outil interne
        </p>
      </div>
    </div>
  );
}