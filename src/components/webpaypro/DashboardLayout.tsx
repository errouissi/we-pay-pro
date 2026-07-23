import { useEffect, useState } from "react";
import type { LoggedUser } from "./api";
import { NewClientForm } from "./NewClientForm";
import { MyClientsTable } from "./MyClientsTable";
import { NewAgentForm } from "./NewAgentForm";
import { MyAgentsTable } from "./MyAgentsTable";
import { NewWafacashForm } from "./NewWafacashForm";
import { MyWafacashTable } from "./MyWafacashTable";
import { NewWePayProForm } from "./NewWePayProForm";
import { MyWePayProTable } from "./MyWePayProTable";
import { UserManagement } from "./UserManagement";

type View =
  | "new"
  | "list"
  | "agent"
  | "agents"
  | "wafacash"
  | "wafacash-list"
  | "wepaypro"
  | "wepaypro-list"
  | "users";

function hashToView(hash: string): View {
  if (hash === "#new") return "new";
  if (hash === "#clients") return "list";
  if (hash === "#agent") return "agent";
  if (hash === "#agents") return "agents";
  if (hash === "#wafacash") return "wafacash";
  if (hash === "#wafacash-list") return "wafacash-list";
  if (hash === "#cache") return "wafacash"; // backward compatibility with the old "Form cache" route
  if (hash === "#wepaypro") return "wepaypro";
  if (hash === "#wepaypro-list") return "wepaypro-list";
  if (hash === "#users") return "users";
  return "new";
}

type Props = {
  user: LoggedUser;
  onLogout: () => void;
};

export function DashboardLayout({ user, onLogout }: Props) {
  const [view, setView] = useState<View>(() => hashToView(window.location.hash));
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setView(hashToView(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navBtn = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-[#2F9E32] text-white shadow" : "text-[#003C18] hover:bg-[#B7F000]/30"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#B7F000]/10 via-white to-[#8FDD32]/10">
      <header className="sticky top-0 z-20 border-b border-[#C8D0C4] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#003C18] text-sm font-black text-[#B7F000]">
              W
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold text-[#003C18]">We Pay Pro</p>
              <p className="text-[11px] text-[#00562B]/70">Espace interne</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-[#00562B]/70">Connecté</p>
              <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-[#003C18]">
                {user.name}
                {user.role === "admin" && (
                  <span className="rounded bg-[#B7F000] px-1.5 py-0.5 text-[10px] font-bold text-[#003C18]">
                    ADMIN
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg border border-[#003C18] px-3 py-1.5 text-xs font-medium text-[#003C18] transition hover:bg-[#003C18] hover:text-white"
            >
              Déconnexion
            </button>
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="rounded-lg border border-[#C8D0C4] p-2 text-[#003C18]"
              aria-label="Menu"
              aria-expanded={navOpen}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
        {navOpen && (
          <div className="border-t border-[#C8D0C4] bg-white px-4 py-3">
            <div className="flex flex-col flex-wrap gap-2 sm:flex-row">
              <button
                onClick={() => {
                  window.location.hash = "#new";
                  setNavOpen(false);
                }}
                className={navBtn(view === "new")}
              >
                Nouveau client
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#clients";
                  setNavOpen(false);
                }}
                className={navBtn(view === "list")}
              >
                {user.role === "admin" ? "Tous les clients" : "Mes clients"}
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#agent";
                  setNavOpen(false);
                }}
                className={navBtn(view === "agent")}
              >
                Nouvel agent
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#wafacash";
                  setNavOpen(false);
                }}
                className={navBtn(view === "wafacash")}
              >
                Wafacash
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#wafacash-list";
                  setNavOpen(false);
                }}
                className={navBtn(view === "wafacash-list")}
              >
                {user.role === "admin" ? "Tous les Wafacash" : "Mes Wafacash"}
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#wepaypro";
                  setNavOpen(false);
                }}
                className={navBtn(view === "wepaypro")}
              >
                We Pay Pro Form
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#wepaypro-list";
                  setNavOpen(false);
                }}
                className={navBtn(view === "wepaypro-list")}
              >
                {user.role === "admin" ? "Tous les We Pay Pro" : "Mes We Pay Pro"}
              </button>
              <button
                onClick={() => {
                  window.location.hash = "#agents";
                  setNavOpen(false);
                }}
                className={navBtn(view === "agents")}
              >
                {user.role === "admin" ? "Tous les agents" : "Mes agents"}
              </button>
              {user.role === "admin" && (
                <button
                  onClick={() => {
                    window.location.hash = "#users";
                    setNavOpen(false);
                  }}
                  className={navBtn(view === "users")}
                >
                  Gestion utilisateurs
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {view === "new" ? (
          <NewClientForm user={user} />
        ) : view === "list" ? (
          <MyClientsTable user={user} />
        ) : view === "agent" ? (
          <NewAgentForm user={user} />
        ) : view === "agents" ? (
          <MyAgentsTable user={user} />
        ) : view === "wafacash" ? (
          <NewWafacashForm user={user} />
        ) : view === "wafacash-list" ? (
          <MyWafacashTable user={user} />
        ) : view === "wepaypro" ? (
          <NewWePayProForm user={user} />
        ) : view === "wepaypro-list" ? (
          <MyWePayProTable user={user} />
        ) : user.role === "admin" ? (
          <UserManagement user={user} />
        ) : (
          <NewClientForm user={user} />
        )}
      </main>

      <footer className="border-t border-[#C8D0C4] py-6 text-center text-xs text-[#00562B]/60">
        © {new Date().getFullYear()} We Pay Pro — Outil interne
      </footer>
    </div>
  );
}
