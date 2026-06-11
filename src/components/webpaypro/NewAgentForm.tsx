import { useState } from "react";
import { createAgent, fileToBase64, type LoggedUser } from "./api";
import { FileInput } from "./FileInput";
import { AlertMessage } from "./AlertMessage";
import { SuccessModal } from "./SuccessModal";
import { FullScreenLoadingOverlay } from "./FullScreenLoadingOverlay";
import { validateFile } from "./fileValidation";

type Props = { user: LoggedUser };

type FormState = {
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  typeAgent: "agence" | "détaillant" | "";
  latitude: number | null;
  longitude: number | null;
  localisationLink: string;
  photoDocument: File | null;
  cinRecto: File | null;
  cinVerso: File | null;
  photoLocal: File | null;
};

const empty: FormState = {
  nom: "",
  prenom: "",
  telephone: "",
  email: "",
  typeAgent: "",
  latitude: null,
  longitude: null,
  localisationLink: "",
  photoDocument: null,
  cinRecto: null,
  cinVerso: null,
  photoLocal: null,
};

function normalizeMoroccanPhone(value: string) {
  return value.replace(/\s/g, "");
}

function isValidMoroccanPhone(value: string) {
  return /^(05|06|07)\d{8}$/.test(normalizeMoroccanPhone(value));
}

export function NewAgentForm({ user }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const getLocation = () => {
    setLocError(false);
    if (!navigator.geolocation) {
      setLocError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm((f) => ({
          ...f,
          latitude,
          longitude,
          localisationLink: `https://www.google.com/maps?q=${latitude},${longitude}`,
        }));
        setLocating(false);
      },
      () => {
        setLocError(true);
        setLocating(false);
      },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!isValidMoroccanPhone(form.telephone)) {
      setFeedback({
        type: "error",
        msg: "Veuillez saisir un numéro marocain valide commençant par 05, 06 ou 07.",
      });
      return;
    }
    const emailTrimmed = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setFeedback({ type: "error", msg: "Veuillez saisir une adresse email valide." });
      return;
    }
    if (!form.typeAgent) {
      setFeedback({ type: "error", msg: "Veuillez sélectionner un type d'agent." });
      return;
    }
    if (form.latitude == null || form.longitude == null || !form.localisationLink) {
      setFeedback({
        type: "error",
        msg: "Veuillez récupérer la localisation du local avant d'envoyer la demande.",
      });
      return;
    }
    if (!form.photoDocument || !form.cinRecto || !form.cinVerso || !form.photoLocal) {
      setFeedback({ type: "error", msg: "Veuillez joindre tous les fichiers requis." });
      return;
    }
    for (const f of [form.photoDocument, form.cinRecto, form.cinVerso, form.photoLocal]) {
      const msg = validateFile(f);
      if (msg) {
        setFeedback({ type: "error", msg });
        return;
      }
    }
    setSubmitting(true);
    try {
      const [photoDocument, cinRecto, cinVerso, photoLocal] = await Promise.all([
        fileToBase64(form.photoDocument),
        fileToBase64(form.cinRecto),
        fileToBase64(form.cinVerso),
        fileToBase64(form.photoLocal),
      ]);
      const res = await createAgent(user, {
        nom: form.nom,
        prenom: form.prenom,
        telephone: normalizeMoroccanPhone(form.telephone),
        email: emailTrimmed,
        typeAgent: form.typeAgent as "agence" | "détaillant",
        latitude: form.latitude!,
        longitude: form.longitude!,
        localisationLink: form.localisationLink,
        photoDocument,
        cinRecto,
        cinVerso,
        photoLocal,
      });
      if (res.success) {
        setForm(empty);
        (e.target as HTMLFormElement).reset();
        setShowSuccessModal(true);
      } else {
        setFeedback({
          type: "error",
          msg: res.message || "Erreur lors de l'envoi. Veuillez réessayer.",
        });
      }
    } catch {
      setFeedback({ type: "error", msg: "Erreur lors de l'envoi. Veuillez réessayer." });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-[#C8D0C4] bg-white px-3 py-2.5 text-sm text-[#003C18] outline-none transition focus:border-[#2F9E32] focus:ring-2 focus:ring-[#2F9E32]/30";
  const labelCls = "mb-1 flex flex-col gap-0.5 text-sm font-medium text-[#003C18]";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-black/5 sm:p-8">
      <header className="mb-6 border-b border-[#C8D0C4] pb-4">
        <h2 className="text-2xl font-bold text-[#003C18]">Nouvel agent</h2>
        <p className="mt-1 text-sm text-[#00562B]/80">
          Veuillez remplir toutes les informations et joindre les documents demandés.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              <span>
                Nom <span className="text-[#2F9E32]">*</span>
              </span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
                الاسم العائلي
              </span>
            </label>
            <input
              type="text"
              required
              value={form.nom}
              onChange={(e) => setField("nom", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>
                Prénom <span className="text-[#2F9E32]">*</span>
              </span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
                الاسم الشخصي
              </span>
            </label>
            <input
              type="text"
              required
              value={form.prenom}
              onChange={(e) => setField("prenom", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>
                Numéro de téléphone <span className="text-[#2F9E32]">*</span>
              </span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
                رقم الهاتف
              </span>
            </label>
            <input
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78"
              value={form.telephone}
              onChange={(e) => setField("telephone", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>
                Email <span className="text-[#2F9E32]">*</span>
              </span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
                البريد الإلكتروني
              </span>
            </label>
            <input
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              placeholder="exemple@domaine.com"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>
                Type d'agent <span className="text-[#2F9E32]">*</span>
              </span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
                نوع الوكيل
              </span>
            </label>
            <select
              required
              value={form.typeAgent}
              onChange={(e) =>
                setField("typeAgent", e.target.value as "agence" | "détaillant" | "")
              }
              className={inputCls}
            >
              <option value="" disabled>
                Sélectionner un type
              </option>
              <option value="agence">Agence</option>
              <option value="détaillant">Détaillant</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-[#C8D0C4]/20 p-4 ring-1 ring-[#C8D0C4]">
          <label className={labelCls}>
            <span>
              Localisation du local / magasin <span className="text-[#2F9E32]">*</span>
            </span>
            <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
              الموقع الجغرافي للمحل
            </span>
          </label>
          <button
            type="button"
            onClick={getLocation}
            disabled={locating}
            className="mt-2 rounded-lg border border-[#2F9E32] bg-white px-4 py-2 text-sm font-semibold text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? "Récupération..." : "Obtenir la localisation"}
          </button>
          {form.localisationLink && (
            <div className="mt-3 text-sm text-[#00562B]">
              <p className="font-medium">Localisation récupérée avec succès.</p>
              <p className="mt-1 text-xs text-[#003C18]/80">
                {form.latitude}, {form.longitude} —{" "}
                <a
                  href={form.localisationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#2F9E32] underline"
                >
                  Voir sur Google Maps
                </a>
              </p>
            </div>
          )}
          {locError && (
            <p className="mt-3 text-sm text-red-600">
              Impossible de récupérer la localisation. Veuillez autoriser l'accès à votre position.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[#C8D0C4]/20 p-4 ring-1 ring-[#C8D0C4]">
          <p className="mb-4 text-xs text-[#003C18]/80">
            Formats acceptés : image ou PDF. Taille maximale : 10 MB par fichier.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <FileInput
              label="Photo document"
              arabic="صورة الوثيقة"
              name="photoDocument"
              required
              value={form.photoDocument}
              onChange={(f) => setField("photoDocument", f)}
            />
            <FileInput
              label="CIN Recto"
              arabic="صورة البطاقة الوطنية - الوجه الأمامي"
              name="cinRecto"
              required
              value={form.cinRecto}
              onChange={(f) => setField("cinRecto", f)}
            />
            <FileInput
              label="CIN Verso"
              arabic="صورة البطاقة الوطنية - الوجه الخلفي"
              name="cinVerso"
              required
              value={form.cinVerso}
              onChange={(f) => setField("cinVerso", f)}
            />
            <FileInput
              label="Photo du local / magasin"
              arabic="صورة المحل / المتجر"
              name="photoLocal"
              required
              value={form.photoLocal}
              onChange={(f) => setField("photoLocal", f)}
            />
          </div>
        </div>

        {feedback && <AlertMessage type={feedback.type}>{feedback.msg}</AlertMessage>}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#2F9E32] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00562B] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Envoi en cours..." : "Enregistrer l'agent"}
          </button>
        </div>
      </form>

      <FullScreenLoadingOverlay
        isVisible={submitting}
        title="Enregistrement en cours..."
        message="Veuillez patienter, ne fermez pas cette page."
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Agent enregistré"
        message="L'agent a été enregistré avec succès."
      />
    </div>
  );
}
