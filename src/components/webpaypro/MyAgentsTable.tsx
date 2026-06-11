import { useEffect, useState, useCallback } from "react";
import { getAgents, type AgentRow, type LoggedUser } from "./api";
import { AlertMessage } from "./AlertMessage";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

type Props = { user: LoggedUser };

type PreviewDoc = { title: string; url: string };

export function MyAgentsTable({ user }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const isAdmin = user.role === "admin";
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCommercial, setFilterCommercial] = useState("");

  const datePart = (s: string) => {
    const p = String(s || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : "";
  };

  const commercials = [...new Set(agents.map((a) => a.created_by_username).filter(Boolean))].sort();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sortedAgents = [...agents].reverse();
  const filteredAgents = sortedAgents.filter((agent) => {
    if (isAdmin && filterDateFrom && datePart(agent.created_at) < filterDateFrom) return false;
    if (isAdmin && filterDateTo && datePart(agent.created_at) > filterDateTo) return false;
    if (isAdmin && filterCommercial && agent.created_by_username !== filterCommercial) return false;
    if (!normalizedSearch) return true;
    return (
      String(agent.nom || "").toLowerCase().includes(normalizedSearch) ||
      String(agent.prenom || "").toLowerCase().includes(normalizedSearch) ||
      String(agent.telephone || "").toLowerCase().includes(normalizedSearch) ||
      String(agent.email || "").toLowerCase().includes(normalizedSearch) ||
      String(agent.type_agent || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAgents(user);
      if (res.success && res.agents) {
        setAgents(res.agents);
      } else {
        setError(res.message || "Erreur lors du chargement.");
      }
    } catch {
      setError("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [user.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  const linkBtn =
    "inline-flex items-center rounded-md bg-[#B7F000]/20 px-2.5 py-1 text-xs font-medium text-[#00562B] ring-1 ring-[#2F9E32]/40 transition hover:bg-[#2F9E32] hover:text-white";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#C8D0C4] pb-4">
        <div>
          <h2 className="text-2xl font-bold text-[#003C18]">
            {isAdmin ? "Tous les agents" : "Mes agents"}
          </h2>
          <p className="mt-1 text-sm text-[#00562B]/80">
            {isAdmin
              ? "Tous les agents enregistrés par tous les commerciaux."
              : "Liste des agents que vous avez enregistrés."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-[#2F9E32] bg-white px-4 py-2 text-sm font-medium text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white disabled:opacity-60"
        >
          {loading ? "Chargement..." : "Actualiser"}
        </button>
      </header>

      {error && <AlertMessage type="error">{error}</AlertMessage>}

      {isAdmin && !loading && agents.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-[#C8D0C4]/20 p-4 ring-1 ring-[#C8D0C4]">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#003C18]">Date de</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-[#C8D0C4] bg-white px-3 py-2 text-sm text-[#003C18] outline-none focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#003C18]">Date à</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-[#C8D0C4] bg-white px-3 py-2 text-sm text-[#003C18] outline-none focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#003C18]">Commercial</label>
            <select
              value={filterCommercial}
              onChange={(e) => setFilterCommercial(e.target.value)}
              className="rounded-lg border border-[#C8D0C4] bg-white px-3 py-2 text-sm text-[#003C18] outline-none focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
            >
              <option value="">Tous les commerciaux</option>
              {commercials.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          {(filterDateFrom || filterDateTo || filterCommercial) && (
            <button
              type="button"
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterCommercial(""); }}
              className="self-end rounded-lg border border-[#003C18]/30 px-3 py-2 text-xs font-medium text-[#003C18] transition hover:bg-[#003C18]/10"
            >
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {!loading && agents.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#00562B]/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, prénom, téléphone, email ou type d'agent..."
              className="w-full rounded-lg border border-[#C8D0C4] bg-white py-2.5 pl-9 pr-20 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-2 my-1 rounded-md px-2 text-xs font-medium text-[#00562B] transition hover:bg-[#B7F000]/30"
              >
                Effacer
              </button>
            )}
          </div>
          {normalizedSearch && (
            <p className="text-xs text-[#00562B]/70">
              {filteredAgents.length} résultat{filteredAgents.length === 1 ? "" : "s"} trouvé
              {filteredAgents.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">Chargement des agents...</p>
      ) : agents.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">
          Aucun agent enregistré pour le moment.
        </p>
      ) : filteredAgents.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">
          Aucun agent ne correspond à votre recherche.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-sm ${isAdmin ? "min-w-[1450px]" : "min-w-[1300px]"}`}>
            <thead>
              <tr className="border-b-2 border-[#C8D0C4] text-left text-xs font-semibold uppercase tracking-wide text-[#003C18]">
                <th className="px-3 py-3">Date</th>
                {isAdmin && <th className="px-3 py-3">Commercial</th>}
                <th className="px-3 py-3">Nom</th>
                <th className="px-3 py-3">Prénom</th>
                <th className="px-3 py-3">Téléphone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Type agent</th>
                <th className="px-3 py-3">Photo document</th>
                <th className="px-3 py-3">CIN Recto</th>
                <th className="px-3 py-3">CIN Verso</th>
                <th className="px-3 py-3">Photo local</th>
                <th className="px-3 py-3">Localisation</th>
                <th className="px-3 py-3">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((a, idx) => (
                <tr
                  key={`${a.created_at}-${idx}`}
                  className="border-b border-[#C8D0C4]/60 text-[#003C18] transition hover:bg-[#B7F000]/10"
                >
                  <td className="px-3 py-3 whitespace-nowrap">{a.created_at}</td>
                  {isAdmin && <td className="px-3 py-3 text-[#00562B]/80">{a.created_by_username}</td>}
                  <td className="px-3 py-3">{a.nom}</td>
                  <td className="px-3 py-3">{a.prenom}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{a.telephone}</td>
                  <td className="px-3 py-3">{a.email}</td>
                  <td className="px-3 py-3">{a.type_agent}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "Photo document", url: a.document_photo_url })}
                    >
                      Voir photo
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "CIN Recto", url: a.cin_recto_url })}
                    >
                      Voir Recto
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "CIN Verso", url: a.cin_verso_url })}
                    >
                      Voir Verso
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "Photo local", url: a.local_photo_url })}
                    >
                      Voir photo
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={a.localisation_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkBtn}
                    >
                      Voir localisation
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    {a.agent_pdf_url ? (
                      <a
                        href={a.agent_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkBtn}
                      >
                        Ouvrir PDF
                      </a>
                    ) : (
                      <span className="text-[#003C18]/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentPreviewModal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        fileUrl={preview?.url ?? ""}
      />
    </div>
  );
}
