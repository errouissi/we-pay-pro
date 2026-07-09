import { useState } from "react";
import { callScript, fileToBase64, type LoggedUser } from "./api";
import { FileInput } from "./FileInput";
import { AlertMessage } from "./AlertMessage";
import { SuccessModal } from "./SuccessModal";
import { FullScreenLoadingOverlay } from "./FullScreenLoadingOverlay";
import { validateFile, MAX_COMPRESSED_FILE_SIZE_MB } from "./fileValidation";
import { compressImageFile } from "./imageCompression";

type Props = { user: LoggedUser };

type FormState = {
  nom: string;
  prenom: string;
  cin: string;
  ville: string;
  telephone: string;
  operator: string;
  latitude: number | null;
  longitude: number | null;
  localisationLink: string;
  cinRecto: File | null;
  cinVerso: File | null;
  pieceJointe: File | null;
};

const empty: FormState = {
  nom: "",
  prenom: "",
  cin: "",
  ville: "",
  telephone: "",
  operator: "",
  latitude: null,
  longitude: null,
  localisationLink: "",
  cinRecto: null,
  cinVerso: null,
  pieceJointe: null,
};

function normalizeMoroccanPhone(value: string) {
  return value.replace(/\s/g, "");
}

function isValidMoroccanPhone(value: string) {
  return /^(05|06|07)\d{8}$/.test(normalizeMoroccanPhone(value));
}

export function NewClientForm({ user }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(
    null,
  );
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
    if (!form.operator) {
      setFeedback({ type: "error", msg: "Veuillez sélectionner un opérateur." });
      return;
    }
    if (form.latitude == null || form.longitude == null || !form.localisationLink) {
      setFeedback({
        type: "error",
        msg: "Veuillez récupérer la localisation actuelle avant d’envoyer la demande.",
      });
      return;
    }
    if (!form.cinRecto || !form.cinVerso || !form.pieceJointe) {
      setFeedback({ type: "error", msg: "Veuillez joindre tous les fichiers requis." });
      return;
    }
    setSubmitting(true);
    try {
      const [cinRectoFile, cinVersoFile, pieceJointeFile] = await Promise.all([
        compressImageFile(form.cinRecto),
        compressImageFile(form.cinVerso),
        compressImageFile(form.pieceJointe),
      ]);
      for (const f of [cinRectoFile, cinVersoFile, pieceJointeFile]) {
        const msg = validateFile(f, MAX_COMPRESSED_FILE_SIZE_MB);
        if (msg) {
          setFeedback({ type: "error", msg });
          setSubmitting(false);
          return;
        }
      }
      const [cinRecto, cinVerso, pieceJointe] = await Promise.all([
        fileToBase64(cinRectoFile),
        fileToBase64(cinVersoFile),
        fileToBase64(pieceJointeFile),
      ]);
      const res = await callScript<{ success: boolean; message?: string }>({
        action: "createClient",
        userId: user.user_id,
        userName: user.name,
        nom: form.nom,
        prenom: form.prenom,
        cin: form.cin,
        ville: form.ville,
        telephone: normalizeMoroccanPhone(form.telephone),
        operator: form.operator,
        latitude: form.latitude,
        longitude: form.longitude,
        localisationLink: form.localisationLink,
        cinRecto,
        cinVerso,
        pieceJointe,
      });
      if (res.success) {
        setForm(empty);
        (e.target as HTMLFormElement).reset();
        setShowSuccessModal(true);
      } else {
        setFeedback({
          type: "error",
          msg: res.message || "Erreur lors de l’envoi. Veuillez réessayer.",
        });
      }
    } catch {
      setFeedback({ type: "error", msg: "Erreur lors de l’envoi. Veuillez réessayer." });
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
        <h2 className="text-2xl font-bold text-[#003C18]">Nouveau client</h2>
        <p className="mt-1 text-sm text-[#00562B]/80">
          Veuillez remplir toutes les informations et joindre les documents demandés.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              <span>Nom <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">الاسم العائلي</span>
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
              <span>Prénom <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">الاسم الشخصي</span>
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
              <span>CIN <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">رقم البطاقة الوطنية</span>
            </label>
            <input
              type="text"
              required
              value={form.cin}
              onChange={(e) => setField("cin", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>Ville <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">المدينة</span>
            </label>
            <input
              type="text"
              required
              value={form.ville}
              onChange={(e) => setField("ville", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span>Numéro de téléphone <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">رقم الهاتف</span>
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
              <span>Opérateur <span className="text-[#2F9E32]">*</span></span>
              <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">المشغل</span>
            </label>
            <select
              required
              value={form.operator}
              onChange={(e) => setField("operator", e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>Sélectionner un opérateur</option>
              <option value="INWI">INWI</option>
              <option value="ORANGE">ORANGE</option>
              <option value="IAM">IAM</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-[#C8D0C4]/20 p-4 ring-1 ring-[#C8D0C4]">
          <label className={labelCls}>
            <span>Localisation actuelle <span className="text-[#2F9E32]">*</span></span>
            <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">الموقع الحالي</span>
          </label>
          <button
            type="button"
            onClick={getLocation}
            disabled={locating}
            className="mt-2 rounded-lg border border-[#2F9E32] bg-white px-4 py-2 text-sm font-semibold text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? "Récupération..." : "Obtenir ma localisation"}
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
              Impossible de récupérer la localisation. Veuillez autoriser l’accès à votre
              position.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-[#C8D0C4]/20 p-4 ring-1 ring-[#C8D0C4]">
          <p className="mb-4 text-xs text-[#003C18]/80">
            Formats acceptés: image ou PDF. Les images sont compressées automatiquement avant l'envoi.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FileInput
              label="Image CIN Recto"
              arabic="صورة البطاقة الوطنية - الوجه الأمامي"
              name="cinRecto"
              required
              value={form.cinRecto}
              onChange={(f) => setField("cinRecto", f)}
            />
            <FileInput
              label="Image CIN Verso"
              arabic="صورة البطاقة الوطنية - الوجه الخلفي"
              name="cinVerso"
              required
              value={form.cinVerso}
              onChange={(f) => setField("cinVerso", f)}
            />
            <FileInput
              label="Pièce jointe supplémentaire"
              arabic="وثيقة إضافية"
              name="pieceJointe"
              required
              value={form.pieceJointe}
              onChange={(f) => setField("pieceJointe", f)}
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
            {submitting ? "Envoi en cours..." : "Envoyer la demande"}
          </button>
        </div>
      </form>

      <FullScreenLoadingOverlay
        isVisible={submitting}
        title="Téléchargement des documents..."
        message="Compression et envoi des images en cours. Veuillez patienter quelques secondes."
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Demande envoyée"
        message="Votre demande a été envoyée avec succès."
      />
    </div>
  );
}