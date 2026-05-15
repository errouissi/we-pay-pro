import { useEffect, useState, useCallback } from "react";
import { callScript, type ClientRow, type LoggedUser } from "./api";
import { AlertMessage } from "./AlertMessage";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

type Props = { user: LoggedUser };

type PreviewDoc = { title: string; url: string };

export function MyClientsTable({ user }: Props) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sortedClients = [...clients].reverse();
  const filteredClients = sortedClients.filter((client) => {
    if (!normalizedSearch) return true;
    return (
      String(client.cin || "").toLowerCase().includes(normalizedSearch) ||
      String(client.nom || "").toLowerCase().includes(normalizedSearch) ||
      String(client.prenom || "").toLowerCase().includes(normalizedSearch) ||
      String(client.telephone || "").toLowerCase().includes(normalizedSearch) ||
      String(client.operator || "").toLowerCase().includes(normalizedSearch)
    );
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callScript<{ success: boolean; clients?: ClientRow[]; message?: string }>({
        action: "getClients",
        userId: user.user_id,
      });
      if (res.success && res.clients) {
        setClients(res.clients);
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
          <h2 className="text-2xl font-bold text-[#003C18]">Mes clients</h2>
          <p className="mt-1 text-sm text-[#00562B]/80">
            Liste des clients que vous avez enregistrés.
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

      {!loading && clients.length > 0 && (
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
              placeholder="Rechercher par CIN, nom, prénom, téléphone ou opérateur..."
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
              {filteredClients.length} résultat{filteredClients.length === 1 ? "" : "s"} trouvé
              {filteredClients.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">Chargement des clients...</p>
      ) : clients.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">
          Aucun client enregistré pour le moment.
        </p>
      ) : filteredClients.length === 0 ? (
        <p className="py-12 text-center text-sm text-[#00562B]/70">
          Aucun client ne correspond à votre recherche.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#C8D0C4] text-left text-xs font-semibold uppercase tracking-wide text-[#003C18]">
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Client ID</th>
                <th className="px-3 py-3">Nom</th>
                <th className="px-3 py-3">Prénom</th>
                <th className="px-3 py-3">CIN</th>
                <th className="px-3 py-3">Ville</th>
                <th className="px-3 py-3">Téléphone</th>
                <th className="px-3 py-3">Opérateur</th>
                <th className="px-3 py-3">CIN Recto</th>
                <th className="px-3 py-3">CIN Verso</th>
                <th className="px-3 py-3">Pièce jointe</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((c) => (
                <tr
                  key={c.client_id + c.timestamp}
                  className="border-b border-[#C8D0C4]/60 text-[#003C18] transition hover:bg-[#B7F000]/10"
                >
                  <td className="px-3 py-3 whitespace-nowrap">{c.timestamp}</td>
                  <td className="px-3 py-3 font-medium">{c.client_id}</td>
                  <td className="px-3 py-3">{c.nom}</td>
                  <td className="px-3 py-3">{c.prenom}</td>
                  <td className="px-3 py-3">{c.cin}</td>
                  <td className="px-3 py-3">{c.ville}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{c.telephone}</td>
                  <td className="px-3 py-3">{c.operator}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "CIN Recto", url: c.cin_recto_link })}
                    >
                      Voir Recto
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "CIN Verso", url: c.cin_verso_link })}
                    >
                      Voir Verso
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className={linkBtn}
                      onClick={() => setPreview({ title: "Pièce jointe", url: c.piece_jointe_link })}
                    >
                      Voir Pièce
                    </button>
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