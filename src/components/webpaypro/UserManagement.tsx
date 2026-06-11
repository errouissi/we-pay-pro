import { useEffect, useState, useCallback } from "react";
import { createUser, getUsers, updateUser, type UserRow, type LoggedUser } from "./api";
import { AlertMessage } from "./AlertMessage";

type Props = { user: LoggedUser };

type CreateForm = {
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
};

type EditForm = {
  name: string;
  username: string;
  status: "active" | "blocked";
  password: string;
  confirmPassword: string;
};

const emptyCreateForm: CreateForm = { name: "", username: "", password: "", confirmPassword: "" };
const emptyEditForm: EditForm = { name: "", username: "", status: "active", password: "", confirmPassword: "" };

export function UserManagement({ user }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const setCreateField = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) =>
    setCreateForm((f) => ({ ...f, [key]: value }));

  const setEditField = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setEditForm((f) => ({ ...f, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsers(user);
      if (res.success && res.users) setUsers(res.users);
      else setError(res.message || "Erreur lors du chargement.");
    } catch {
      setError("Erreur lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, [user.user_id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFeedback(null);
    if (createForm.password !== createForm.confirmPassword) {
      setCreateFeedback({ type: "error", msg: "Les mots de passe ne correspondent pas." });
      return;
    }
    setCreateSubmitting(true);
    try {
      const res = await createUser(user, {
        name: createForm.name.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
      });
      if (res.success) {
        setCreateFeedback({ type: "success", msg: "Utilisateur créé avec succès." });
        setCreateForm(emptyCreateForm);
        load();
      } else {
        setCreateFeedback({ type: "error", msg: res.message || "Erreur lors de la création." });
      }
    } catch {
      setCreateFeedback({ type: "error", msg: "Erreur lors de la création." });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEdit = (u: UserRow) => {
    const status = String(u.status || "").toLowerCase() === "blocked" ? "blocked" : "active";
    setEditTarget(u);
    setEditForm({ name: u.name, username: u.username, status, password: "", confirmPassword: "" });
    setEditFeedback(null);
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditFeedback(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFeedback(null);
    if (editForm.password && editForm.password !== editForm.confirmPassword) {
      setEditFeedback({ type: "error", msg: "Les mots de passe ne correspondent pas." });
      return;
    }
    setEditSubmitting(true);
    try {
      const payload: Parameters<typeof updateUser>[1] = {
        user_id: editTarget!.user_id,
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        status: editForm.status,
      };
      if (editForm.password) payload.password = editForm.password;
      const res = await updateUser(user, payload);
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

  const toggleBlock = async (u: UserRow, newStatus: "active" | "blocked") => {
    setActionLoading(u.user_id);
    setError(null);
    try {
      const res = await updateUser(user, {
        user_id: u.user_id,
        name: u.name,
        username: u.username,
        status: newStatus,
      });
      if (res.success) {
        load();
      } else {
        setError(res.message || "Erreur lors de la mise à jour.");
      }
    } catch {
      setError("Erreur lors de la mise à jour.");
    } finally {
      setActionLoading(null);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-[#C8D0C4] bg-white px-3 py-2.5 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30";
  const labelCls = "mb-1 block text-sm font-medium text-[#003C18]";

  const statusBadge = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "active")
      return <span className="rounded bg-[#2F9E32]/15 px-2 py-0.5 text-xs font-medium text-[#00562B]">Actif</span>;
    if (s === "blocked")
      return <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">Bloqué</span>;
    return <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{status}</span>;
  };

  return (
    <>
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 sm:p-8">
            <header className="mb-5 flex items-center justify-between border-b border-[#C8D0C4] pb-4">
              <h3 className="text-xl font-bold text-[#003C18]">Modifier l'utilisateur</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-[#003C18]/60 transition hover:bg-[#C8D0C4]/30"
              >
                ✕
              </button>
            </header>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    Nom complet <span className="text-[#2F9E32]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditField("name", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Nom d'utilisateur <span className="text-[#2F9E32]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={editForm.username}
                    onChange={(e) => setEditField("username", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Statut <span className="text-[#2F9E32]">*</span>
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditField("status", e.target.value as "active" | "blocked")}
                    className={inputCls}
                  >
                    <option value="active">Actif</option>
                    <option value="blocked">Bloqué</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={editForm.password}
                    onChange={(e) => {
                      setEditField("password", e.target.value);
                      if (!e.target.value) setEditField("confirmPassword", "");
                    }}
                    className={inputCls}
                  />
                </div>
              </div>
              {editForm.password && (
                <div>
                  <label className={labelCls}>
                    Confirmer le mot de passe <span className="text-[#2F9E32]">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditField("confirmPassword", e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
              <p className="text-xs text-[#00562B]/70">
                Laissez le mot de passe vide pour le conserver.
              </p>
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

      <div className="space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
          <header className="mb-6 border-b border-[#C8D0C4] pb-4">
            <h2 className="text-2xl font-bold text-[#003C18]">Créer un utilisateur</h2>
            <p className="mt-1 text-sm text-[#00562B]/80">
              Ajouter un nouveau compte commercial.
            </p>
          </header>

          <form onSubmit={submitCreate} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className={labelCls}>
                  Nom complet <span className="text-[#2F9E32]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateField("name", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Nom d'utilisateur <span className="text-[#2F9E32]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={createForm.username}
                  onChange={(e) => setCreateField("username", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Mot de passe <span className="text-[#2F9E32]">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateField("password", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Confirmer le mot de passe <span className="text-[#2F9E32]">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateField("confirmPassword", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <p className="text-xs text-[#00562B]/70">
              Le nouvel utilisateur sera créé avec le rôle Commercial.
            </p>

            {createFeedback && (
              <AlertMessage type={createFeedback.type}>{createFeedback.msg}</AlertMessage>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={createSubmitting}
                className="rounded-lg bg-[#2F9E32] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00562B] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createSubmitting ? "Création en cours..." : "Créer l'utilisateur"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#C8D0C4] pb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#003C18]">Utilisateurs</h2>
              <p className="mt-1 text-sm text-[#00562B]/80">
                Liste de tous les comptes enregistrés.
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

          {loading ? (
            <p className="py-12 text-center text-sm text-[#00562B]/70">
              Chargement des utilisateurs...
            </p>
          ) : users.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#00562B]/70">
              Aucun utilisateur trouvé.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-[#C8D0C4] text-left text-xs font-semibold uppercase tracking-wide text-[#003C18]">
                    <th className="px-3 py-3">User ID</th>
                    <th className="px-3 py-3">Nom d'utilisateur</th>
                    <th className="px-3 py-3">Nom complet</th>
                    <th className="px-3 py-3">Rôle</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.user_id}
                      className="border-b border-[#C8D0C4]/60 text-[#003C18] transition hover:bg-[#B7F000]/10"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-[#00562B]/70">{u.user_id}</td>
                      <td className="px-3 py-3 font-medium">{u.username}</td>
                      <td className="px-3 py-3">{u.name}</td>
                      <td className="px-3 py-3">
                        {u.role === "admin" ? (
                          <span className="rounded bg-[#B7F000] px-2 py-0.5 text-xs font-bold text-[#003C18]">
                            ADMIN
                          </span>
                        ) : (
                          <span className="rounded bg-[#C8D0C4]/60 px-2 py-0.5 text-xs font-medium text-[#003C18]">
                            COMMERCIAL
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">{statusBadge(u.status)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-md border border-[#2F9E32]/60 px-2.5 py-1 text-xs font-medium text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white"
                          >
                            Modifier
                          </button>
                          {u.user_id !== user.user_id && (
                            String(u.status || "").toLowerCase() === "blocked" ? (
                              <button
                                type="button"
                                onClick={() => toggleBlock(u, "active")}
                                disabled={actionLoading === u.user_id}
                                className="rounded-md border border-[#2F9E32]/60 px-2.5 py-1 text-xs font-medium text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white disabled:opacity-50"
                              >
                                {actionLoading === u.user_id ? "..." : "Débloquer"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleBlock(u, "blocked")}
                                disabled={actionLoading === u.user_id}
                                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                              >
                                {actionLoading === u.user_id ? "..." : "Bloquer"}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
