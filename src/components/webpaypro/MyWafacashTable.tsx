import { useEffect, useState, useCallback } from "react";
import { getWafacash, updateWafacash, type WafacashRow, type LoggedUser } from "./api";
import { AlertMessage } from "./AlertMessage";
import { DocumentPreviewModal } from "./DocumentPreviewModal";

type Props = { user: LoggedUser };

type PreviewDoc = { title: string; url: string };

type EditForm = { status: "inactive" | "active"; first_recharge: string };
const emptyEditForm: EditForm = { status: "inactive", first_recharge: "" };

type TabKey = "all" | "active" | "rechargeable";

function isRechargeable(w: WafacashRow) {
  return String(w.first_recharge || "").trim() !== "";
}

function statusLabel(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "Active";
  return "Inactive";
}

function statusBadgeCls(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "bg-[#2F9E32]/15 text-[#00562B]";
  return "bg-[#C8D0C4]/60 text-[#003C18]";
}

export function MyWafacashTable({ user }: Props) {
  const [wafacash, setWafacash] = useState<WafacashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const isAdmin = user.role === "admin";
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterCommercial, setFilterCommercial] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [editTarget, setEditTarget] = useState<WafacashRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const datePart = (s: string) => {
    const p = String(s || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : "";
  };

  const commercials = [...new Set(wafacash.map((w) => w.created_by_username).filter(Boolean))].sort();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sortedWafacash = [...wafacash].reverse();
  const baseFilteredWafacash = sortedWafacash.filter((w) => {
    if (isAdmin && filterDateFrom && datePart(w.created_at) < filterDateFrom) return false;
    if (isAdmin && filterDateTo && datePart(w.created_at) > filterDateTo) return false;
    if (isAdmin && filterCommercial && w.created_by_username !== filterCommercial) return false;
    if (!normalizedSearch) return true;
    return (
      String(w.nom || "").toLowerCase().includes(normalizedSearch) ||
      String(w.prenom || "").toLowerCase().includes(normalizedSearch) ||
      String(w.telephone || "").toLowerCase().includes(normalizedSearch) ||
      String(w.adresse || "").toLowerCase().includes(normalizedSearch)
    );
  });
  const tabCounts = {
    all: baseFilteredWafacash.length,
    active: baseFilteredWafacash.filter((w) => String(w.status || "").toLowerCase() === "active").length,
    rechargeable: baseFilteredWafacash.filter(isRechargeable).length,
  };
  const filteredWafacash = baseFilteredWafacash.filter((w) => {
    if (activeTab === "active") return String(w.status || "").toLowerCase() === "active";
    if (activeTab === "rechargeable") return isRechargeable(w);
    return true;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWafacash(user);
      if (res.success && res.wafacash) {
        setWafacash(res.wafacash);
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

  const openEdit = (w: WafacashRow) => {
    const status: EditForm["status"] = w.status === "active" ? "active" : "inactive";
    setEditTarget(w);
    setEditForm({ status, first_recharge: w.first_recharge || "" });
    setEditFeedback(null);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditFeedback(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditFeedback(null);
    setEditSubmitting(true);
    try {
      const res = await updateWafacash(user, {
        wafacash_id: editTarget.wafacash_id,
        status: editForm.status,
        first_recharge: editForm.first_recharge.trim(),
      });
      if (res.success) {
        closeEdit();
        load();
      } else {
        setEditFeedback({ type: "error", msg: res.message || "Erreur lors de la mise à jour." });
      }
    } catch {
      setEditFeedback({ type: "error", msg: "Erreur lors de la mise à jour." });
    } finally {
      setEditSubmitting(false);
    }
  };

  const linkBtn =
    "inline-flex items-center rounded-md bg-[#B7F000]/20 px-2.5 py-1 text-xs font-medium text-[#00562B] ring-1 ring-[#2F9E32]/40 transition hover:bg-[#2F9E32] hover:text-white";

  const modalInputCls =
    "w-full rounded-lg border border-[#C8D0C4] bg-white px-3 py-2.5 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30";
  const modalLabelCls = "mb-1 block text-sm font-medium text-[#003C18]";

  return (
    <>
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 sm:p-8">
            <header className="mb-5 flex items-center justify-between border-b border-[#C8D0C4] pb-4">
              <h3 className="text-xl font-bold text-[#003C18]">
                Modifier — {editTarget.nom} {editTarget.prenom}
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-[#003C18]/60 transition hover:bg-[#C8D0C4]/30"
              >
                ✕
              </button>
            </header>
            <form onSubmit={submitEdit} className="space-y-4">
              <div>
                <label className={modalLabelCls}>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value as EditForm["status"] }))
                  }
                  className={modalInputCls}
                >
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div>
                <label className={modalLabelCls}>First recharge</label>
                <input
                  type="text"
                  value={editForm.first_recharge}
                  onChange={(e) => setEditForm((f) => ({ ...f, first_recharge: e.target.value }))}
                  className={modalInputCls}
                />
              </div>
              {editFeedback && <AlertMessage type={editFeedback.type}>{editFeedback.msg}</AlertMessage>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg border border-[#C8D0C4] px-5 py-2.5 text-sm font-medium text-[#003C18] transition hover:bg-[#C8D0C4]/30"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg bg-[#2F9E32] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00562B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#C8D0C4] pb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#003C18]">
              {isAdmin ? "Tous les Wafacash" : "Mes Wafacash"}
            </h2>
            <p className="mt-1 text-sm text-[#00562B]/80">
              {isAdmin
                ? "Tous les Wafacash enregistrés par tous les commerciaux."
                : "Liste des Wafacash que vous avez enregistrés."}
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

        {!loading && wafacash.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "Tous les Wafacash", count: tabCounts.all },
                { key: "active", label: "Active", count: tabCounts.active },
                { key: "rechargeable", label: "Rechargeable", count: tabCounts.rechargeable },
              ] as { key: TabKey; label: string; count: number }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "bg-[#2F9E32] text-white shadow-md"
                    : "border border-[#C8D0C4] bg-white text-[#003C18] hover:bg-[#C8D0C4]/30"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {isAdmin && !loading && wafacash.length > 0 && (
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

        {!loading && wafacash.length > 0 && (
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
                placeholder="Rechercher par nom, prénom ou adresse..."
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
                {filteredWafacash.length} résultat{filteredWafacash.length === 1 ? "" : "s"} trouvé
                {filteredWafacash.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-[#00562B]/70">Chargement des Wafacash...</p>
        ) : wafacash.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#00562B]/70">
            Aucun Wafacash enregistré pour le moment.
          </p>
        ) : filteredWafacash.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#00562B]/70">
            Aucun Wafacash ne correspond à votre recherche.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full border-collapse text-sm ${isAdmin ? "min-w-[1550px]" : "min-w-[1400px]"}`}>
              <thead>
                <tr className="border-b-2 border-[#C8D0C4] text-left text-xs font-semibold uppercase tracking-wide text-[#003C18]">
                  <th className="px-3 py-3">Date</th>
                  {isAdmin && <th className="px-3 py-3">Commercial</th>}
                  <th className="px-3 py-3">Nom</th>
                  <th className="px-3 py-3">Prénom</th>
                  <th className="px-3 py-3">Téléphone</th>
                  <th className="px-3 py-3">Adresse</th>
                  <th className="px-3 py-3">CIN Recto</th>
                  <th className="px-3 py-3">CIN Verso</th>
                  <th className="px-3 py-3">Photo du local</th>
                  <th className="px-3 py-3">Localisation</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">First recharge</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWafacash.map((w, idx) => (
                  <tr
                    key={`${w.wafacash_id || w.created_at}-${idx}`}
                    className="border-b border-[#C8D0C4]/60 text-[#003C18] transition hover:bg-[#B7F000]/10"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">{w.created_at}</td>
                    {isAdmin && <td className="px-3 py-3 text-[#00562B]/80">{w.created_by_username}</td>}
                    <td className="px-3 py-3">{w.nom}</td>
                    <td className="px-3 py-3">{w.prenom}</td>
                    <td className="px-3 py-3">{w.telephone}</td>
                    <td className="px-3 py-3">{w.adresse}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={linkBtn}
                        onClick={() => setPreview({ title: "CIN Recto", url: w.cin_recto_url })}
                      >
                        Voir Recto
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={linkBtn}
                        onClick={() => setPreview({ title: "CIN Verso", url: w.cin_verso_url })}
                      >
                        Voir Verso
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {w.photo_local_url ? (
                        <button
                          type="button"
                          className={linkBtn}
                          onClick={() => setPreview({ title: "Photo du local", url: w.photo_local_url })}
                        >
                          Voir photo
                        </button>
                      ) : (
                        <span className="text-[#00562B]/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={w.localisation_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkBtn}
                      >
                        Voir localisation
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeCls(w.status)}`}>
                        {statusLabel(w.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isRechargeable(w) ? (
                        w.first_recharge
                      ) : (
                        <span className="text-[#00562B]/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(w)}
                        className="rounded-md border border-[#2F9E32]/60 px-2.5 py-1 text-xs font-medium text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white"
                      >
                        Modifier
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
    </>
  );
}
